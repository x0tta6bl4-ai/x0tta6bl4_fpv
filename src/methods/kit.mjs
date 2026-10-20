// Лаборатория методов: одна сцена — несколько способов посчитать.
// Эксперимент описывается данными (см. SPEC.md), а этот модуль строит экран:
// сцена → условия → методы → живой экран → таблица → график → уравнение · код · книга · сверка.

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const fmt = (n, d = 0) =>
  Number.isFinite(n)
    ? Number(n)
        .toFixed(d)
        .replace(/^-(?=0(\.0*)?$)/, "") // −0,0 → 0,0
        .replace(".", ",")
        .replace(/^-?\d+/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, " ")) // разряды — только в целой части
        .replace(/^-/, "−")
    : "—";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Яркая палитра методов: читается и на тёмном экране, и на светлой странице.
export const PALETTE = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419", "#cc5de8", "#ff922b", "#22b8cf"];

export const STATUS = {
  match: { label: "Совпадает с книгой", icon: "✓", cls: "ok" },
  simplified: { label: "Упрощение — но по книге", icon: "≈", cls: "warn" },
  beyond: { label: "Сверх книги: физика глубже", icon: "↗", cls: "info" },
  review: { label: "На проверке", icon: "?", cls: "bad" },
};

// Подготовка холста с учётом плотности пикселей.
// При увеличении сцены (масштаб в data-zoom у родителя) холст рисуется в большем разрешении — без «мыла».
export function fitCanvas(canvas) {
  const cw = canvas.clientWidth || canvas.getBoundingClientRect().width, chh = canvas.clientHeight || canvas.getBoundingClientRect().height;
  const zoomEl = canvas.closest("[data-zoom]");
  const z = zoomEl ? Math.min(3, Math.max(1, Number(zoomEl.dataset.zoom) || 1)) : 1;
  let dpr = Math.min(2, window.devicePixelRatio || 1) * z;
  dpr = Math.min(dpr, Math.sqrt(4.5e6 / Math.max(1, cw * chh))); // не больше ~4,5 млн пикселей
  const w = Math.max(10, Math.round(cw * dpr)), h = Math.max(10, Math.round(chh * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

// Подсветка кода: строки, числа, комментарии, ключевые слова — без внешних библиотек.
function highlight(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|return|function|for|if|else|while|of|in|new|Math)\b|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)/g;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "n";
    out += `<span class="hl-${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}
// Достаём функцию по имени из исходного текста модуля (функции, стрелки, константы).
export function extractFn(raw, name) {
  const re = new RegExp(`(^|\\n)((?:export )?(?:function ${name}\\b|const ${name}\\s*=))`);
  const m = re.exec(raw);
  if (!m) return `// ${name}: не найдено в исходнике`;
  const start = m.index + m[1].length;
  let i = raw.indexOf("{", start), depth = 0;
  // Константа-значение без фигурных скобок до конца строки.
  const eol = raw.indexOf("\n", start);
  if (i < 0 || (eol > 0 && i > eol && !/=>\s*$|\(\s*$/.test(raw.slice(start, eol)))) return raw.slice(start, eol < 0 ? undefined : eol);
  for (; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}" && --depth === 0) break;
  }
  let end = i + 1;
  while (end < raw.length && /[);,]/.test(raw[end])) end++;
  return raw.slice(start, end);
}
function sourceOf(fn) {
  const s = fn.toString();
  const lines = s.split("\n");
  // Убираем общий отступ, чтобы код читался.
  const pad = Math.min(...lines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length), 99);
  return [lines[0], ...lines.slice(1).map((l) => l.slice(Number.isFinite(pad) ? pad : 0))].join("\n");
}

// График: линии методов по развёртке параметра, отметка текущего значения и точки из книги.
function drawChart(canvas, exp, P, series, active, focus, refs, live) {
  const { w, h, dpr } = fitCanvas(canvas);
  const g = canvas.getContext("2d");
  const css = getComputedStyle(canvas);
  const ink = css.getPropertyValue("--mx-ink").trim() || "#ccc";
  const faint = css.getPropertyValue("--mx-faint").trim() || "#444";
  g.clearRect(0, 0, w, h);
  const L = 54 * dpr, R = 14 * dpr, T = 14 * dpr, B = 40 * dpr;
  const ch = exp.chart;
  let ymin = ch.y.min, ymax = ch.y.max;
  if (ymin === undefined || ymax === undefined) {
    const ys = series.flatMap((s) => s.pts.map((p) => p[1])).filter(Number.isFinite);
    if (ymin === undefined) ymin = Math.min(...ys);
    if (ymax === undefined) ymax = Math.max(...ys);
    if (!(ymax > ymin)) ymax = ymin + 1;
  }
  const xmin = ch.x.min, xmax = ch.x.max;
  const X = (x) => L + ((x - xmin) / (xmax - xmin)) * (w - L - R);
  const Y = (y) => T + (1 - (clamp(y, ymin, ymax) - ymin) / (ymax - ymin)) * (h - T - B);
  g.font = `${11 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
  g.lineWidth = dpr;
  g.strokeStyle = faint;
  g.fillStyle = ink;
  const ticks = (a, b, n) => {
    const step = Math.pow(10, Math.floor(Math.log10((b - a) / n)));
    const k = [1, 2, 5, 10].find((m) => (b - a) / (step * m) <= n) * step;
    const out = [];
    for (let v = Math.ceil(a / k) * k; v <= b + 1e-9; v += k) out.push(+v.toFixed(10));
    return out;
  };
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (const v of ticks(ymin, ymax, 5)) {
    g.beginPath();
    g.moveTo(L, Y(v));
    g.lineTo(w - R, Y(v));
    g.stroke();
    g.fillText(fmt(v, Math.abs(ymax - ymin) < 5 ? 1 : 0), L - 6 * dpr, Y(v));
  }
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const v of ticks(xmin, xmax, 6)) {
    g.beginPath();
    g.moveTo(X(v), T);
    g.lineTo(X(v), h - B);
    g.stroke();
    const lab = fmt(v, Math.abs(xmax - xmin) < 5 ? 1 : 0), half = g.measureText(lab).width / 2;
    g.fillText(lab, clamp(X(v), L + half, w - half - 2 * dpr), h - B + 6 * dpr); // крайние подписи не вылезают за холст
  }
  g.fillText(`${ch.x.label}${ch.x.unit ? ", " + ch.x.unit : ""}`, (L + w - R) / 2, h - 16 * dpr);
  g.save();
  g.translate(14 * dpr, (T + h - B) / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(`${ch.y.label}${ch.y.unit ? ", " + ch.y.unit : ""}`, 0, -6 * dpr);
  g.restore();
  // Зоны (например, «связь потеряна»).
  for (const band of ch.bands ? ch.bands(P) : []) {
    g.fillStyle = band.color;
    g.globalAlpha = 0.14;
    g.fillRect(L, Y(band.to), w - L - R, Y(band.from) - Y(band.to));
    g.globalAlpha = 0.9;
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.fillText(band.label, L + 6 * dpr, Y(band.to) + 14 * dpr);
    g.globalAlpha = 1;
  }
  // Линии методов: выбранный — толще и со свечением.
  for (const s of series) {
    if (!active.has(s.id)) continue;
    const isF = s.id === focus;
    g.strokeStyle = s.color;
    g.lineWidth = (isF ? 3 : 1.8) * dpr;
    g.shadowColor = isF ? s.color : "transparent";
    g.shadowBlur = isF ? 10 * dpr : 0;
    g.setLineDash(s.dash ? [6 * dpr, 5 * dpr] : []);
    g.beginPath();
    let pen = false;
    for (const [x, y] of s.pts) {
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      if (!pen) g.moveTo(X(x), Y(y));
      else g.lineTo(X(x), Y(y));
      pen = true;
    }
    g.stroke();
  }
  g.setLineDash([]);
  g.shadowBlur = 0;
  // Точки из книги.
  for (const r of refs || []) {
    if (r.x === undefined) continue;
    g.fillStyle = ink;
    g.beginPath();
    const cx = X(r.x), cy = Y(r.y), d = 5 * dpr;
    g.moveTo(cx, cy - d);
    g.lineTo(cx + d, cy);
    g.lineTo(cx, cy + d);
    g.lineTo(cx - d, cy);
    g.closePath();
    g.fill();
  }
  // Живые точки: методы, которые нельзя «прогнать» по всей оси (например, численная волна).
  for (const p of live || []) {
    if (!Number.isFinite(p.y)) continue;
    g.fillStyle = p.color;
    g.shadowColor = p.color;
    g.shadowBlur = 12 * dpr;
    g.beginPath();
    g.arc(X(p.x), Y(p.y), 6 * dpr, 0, TAU);
    g.fill();
    g.shadowBlur = 0;
  }
  // Текущее значение параметра.
  const cur = P[ch.x.param];
  if (cur !== undefined) {
    g.strokeStyle = ink;
    g.globalAlpha = 0.6;
    g.lineWidth = dpr;
    g.setLineDash([3 * dpr, 4 * dpr]);
    g.beginPath();
    g.moveTo(X(cur), T);
    g.lineTo(X(cur), h - B);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
}

// Главная функция: строит эксперимент в root.
export function mountExperiment(root, exp, { book = [], images = () => ({}), onEvent, zoomer } = {}) {
  const methods = exp.methods.map((m, i) => ({ ...m, color: m.color || PALETTE[i % PALETTE.length] }));
  const P = {};
  for (const p of exp.params) P[p.id] = p.value;
  const active = new Set(methods.map((m) => m.id));
  let focus = methods[0].id;
  let scene = exp.scenes[0];
  let tab = "eq";
  Object.assign(P, scene.set || {});

  root.innerHTML = `<section class="mx" style="--mx-accent:${exp.accent || "#4dabf7"}">
    <header class="mx-head"><button type="button" class="mx-fullbtn" data-full aria-pressed="false">⛶ На весь экран</button><div class="eyebrow">Опыт · ${esc(exp.chapters)}</div><h2>${esc(exp.title)}</h2><p class="mx-lead">${exp.lead}</p></header>
    <div class="mx-scenes" role="radiogroup" aria-label="Сцена">${exp.scenes.map((s) => `<button type="button" role="radio" class="mx-scene" data-scene="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></button>`).join("")}</div>
    <div class="mx-grid">
      <div class="mx-stage"><canvas class="mx-canvas" style="aspect-ratio:${exp.aspect || "16 / 9"}" aria-label="${esc(exp.stageLabel || exp.title)}" role="img"></canvas><div class="mx-hud" aria-live="polite"></div></div>
      <aside class="mx-side">
        <div class="mx-h">Условия</div><div class="mx-params"></div>
        <div class="mx-h">Методы <small>отметь, что сравнивать; нажми имя — подробности</small></div><div class="mx-methods"></div>
      </aside>
    </div>
    <div class="mx-results"></div>
    <div class="mx-chartbox"><div class="mx-h">${esc(exp.chart.title)}</div><div class="mx-chartwrap"><canvas class="mx-chart" role="img" aria-label="${esc(exp.chart.title)}"></canvas></div><div class="mx-chartlegend"></div></div>
    <div class="mx-detail"><div class="mx-tabs" role="tablist">${[["eq", "Уравнение"], ["code", "Код"], ["book", "Книга"], ["review", "Сверка"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}">${l}</button>`).join("")}</div><div class="mx-tabbody"></div></div>
    ${exp.try && exp.try.length ? `<div class="mx-try"><div class="mx-h">Попробуй</div><ol>${exp.try.map((t) => `<li>${t}</li>`).join("")}</ol></div>` : ""}
  </section>`;
  const $ = (q) => root.querySelector(q);
  const stageCanvas = $(".mx-canvas"), chartCanvas = $(".mx-chart");

  // Условия.
  const paramsBox = $(".mx-params");
  for (const p of exp.params) {
    const id = `mx-${exp.id}-${p.id}`;
    if (p.options) {
      const wrap = document.createElement("div");
      wrap.className = "mx-param mx-seg";
      wrap.innerHTML = `<span><b>${esc(p.label)}</b></span><div role="radiogroup" aria-label="${esc(p.label)}">${p.options.map(([v, l]) => `<button type="button" role="radio" data-opt="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-opt]");
        if (!b) return;
        const opt = p.options.find(([v]) => String(v) === b.dataset.opt);
        P[p.id] = opt[0];
        p._sync();
        changed();
      });
      p._sync = () => wrap.querySelectorAll("[data-opt]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.opt === String(P[p.id]))));
      paramsBox.appendChild(wrap);
      continue;
    }
    const wrap = document.createElement("label");
    wrap.className = "mx-param";
    wrap.htmlFor = id;
    wrap.innerHTML = `<span><b>${esc(p.label)}</b><output></output></span><input id="${id}" type="range" min="${p.min}" max="${p.max}" step="${p.step}">`;
    const input = wrap.querySelector("input"), out = wrap.querySelector("output");
    const show = () => (out.textContent = p.fmt ? p.fmt(P[p.id]) : `${fmt(P[p.id], p.digits || 0)}${p.unit ? " " + p.unit : ""}`);
    input.addEventListener("input", () => {
      P[p.id] = Number(input.value);
      show();
      changed();
    });
    p._sync = () => {
      input.value = P[p.id];
      show();
    };
    paramsBox.appendChild(wrap);
  }
  // Методы.
  const mBox = $(".mx-methods");
  mBox.innerHTML = methods.map((m) => `<div class="mx-method" data-m="${m.id}" style="--c:${m.color}"><label><input type="checkbox" data-on="${m.id}" checked><span class="mx-dot"></span></label><button type="button" class="mx-mname" data-focus="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.short || "")}</small></button><span class="mx-badge ${STATUS[m.review?.status || "review"].cls}" title="${esc(STATUS[m.review?.status || "review"].label)}">${STATUS[m.review?.status || "review"].icon}</span></div>`).join("");

  let results = {}, series = [], dirty = true;
  function compute() {
    results = {};
    for (const m of methods) {
      try {
        results[m.id] = m.run(P, scene);
      } catch (e) {
        results[m.id] = { value: NaN, error: e.message };
      }
    }
    // Развёртка для графика: тот же метод, меняем один параметр.
    const ch = exp.chart;
    const N = ch.samples || 60;
    series = methods.map((m) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = ch.x.min + ((ch.x.max - ch.x.min) * i) / N;
        let y = NaN;
        try {
          const r = (m.sweep || m.run)({ ...P, [ch.x.param]: x }, scene);
          y = ch.y.pick ? ch.y.pick(r) : r.value;
        } catch (e) {}
        pts.push([x, y]);
      }
      return { id: m.id, color: m.color, pts, dash: m.dash };
    });
    dirty = false;
  }
  function renderResults() {
    const ref = exp.reference ? exp.reference(P, scene) : null;
    const rows = methods
      .filter((m) => active.has(m.id))
      .map((m) => {
        const r = results[m.id] || {};
        const val = r.error ? `ошибка: ${esc(r.error)}` : `${exp.metric.fmt ? exp.metric.fmt(r.value) : fmt(r.value, exp.metric.digits || 0)}${exp.metric.unit ? " " + exp.metric.unit : ""}`;
        let diff = "";
        if (ref && Number.isFinite(r.value) && Number.isFinite(ref.value)) {
          const d = r.value - ref.value;
          const ad = fmt(Math.abs(d), exp.metric.digits || 0);
          diff = `${d < 0 && /[1-9]/.test(ad) ? "−" : "+"}${ad}`;
        }
        const st = STATUS[m.review?.status || "review"];
        return `<tr class="${m.id === focus ? "on" : ""}" data-focus="${m.id}" style="--c:${m.color}"><td><span class="mx-dot"></span>${esc(m.name)}</td><td class="mx-val">${val}${r.note ? `<small>${esc(r.note)}</small>` : ""}</td>${ref ? `<td class="mx-diff">${diff}</td>` : ""}<td><span class="mx-badge ${st.cls}">${st.icon}</span> <small>${esc(st.label)}</small></td></tr>`;
      })
      .join("");
    $(".mx-results").innerHTML = `<table class="mx-table"><thead><tr><th>Метод</th><th>${esc(exp.metric.label)}</th>${ref ? `<th>Разница с «${esc(ref.label)}»</th>` : ""}<th>Сверка</th></tr></thead><tbody>${rows}</tbody></table>${ref && ref.note ? `<p class="mx-refnote">${ref.note}</p>` : ""}`;
  }
  function renderChart() {
    const refs = exp.chart.refs ? exp.chart.refs(P, scene) : [];
    const live = methods.filter((m) => m.live && active.has(m.id)).map((m) => ({ x: P[exp.chart.x.param], y: exp.chart.y.pick ? exp.chart.y.pick(results[m.id] || {}) : (results[m.id] || {}).value, color: m.color }));
    drawChart(chartCanvas, exp, P, series, active, focus, refs, live);
    $(".mx-chartlegend").innerHTML = methods.filter((m) => active.has(m.id)).map((m) => `<span style="--c:${m.color}"><i class="${m.dash ? "dash" : ""}"></i>${esc(m.name)}</span>`).join("") + (refs.length ? `<span><i class="dia"></i>точка из книги</span>` : "") + (live.some((p) => Number.isFinite(p.y)) ? `<span><i class="live"></i>живая точка: посчитана при текущих условиях</span>` : "");
  }
  let shownBook = "";
  function renderDetail() {
    if (tab === "book" && shownBook === focus) return; // книга не зависит от условий: не сворачиваем открытую страницу
    shownBook = tab === "book" ? focus : "";
    const m = methods.find((x) => x.id === focus);
    const r = results[m.id] || {};
    let body = "";
    if (tab === "eq") body = `<div class="mx-eq">${m.eq}</div>${m.explain ? `<div class="mx-live"><div class="mx-h">С твоими числами</div>${m.explain(P, r, scene)}</div>` : ""}${m.assume ? `<p class="mx-assume"><b>Допущения:</b> ${m.assume}</p>` : ""}`;
    if (tab === "code") body = `<p class="mx-assume">Это та самая функция, которая сейчас посчитала результат на экране. Её вызывают с твоими условиями.</p>${(m.src && exp.raw ? m.src.map((n) => extractFn(exp.raw, n)) : (m.source || [m.run]).map(sourceOf)).map((s) => `<pre class="mx-code"><code>${highlight(s)}</code></pre>`).join("")}`;
    if (tab === "book") {
      const refs = m.refs || [];
      body = refs.length
        ? refs
            .map((ref) => {
              const page = book.flatMap((c) => c.pages).find((p) => p.page === ref.page);
              const found = page && ref.quote && page.text.replace(/\s+/g, " ").includes(ref.quote.replace(/\s+/g, " "));
              return `<figure class="mx-quote"><blockquote>«${esc(ref.quote)}»</blockquote><figcaption>Книга, с. ${ref.page}${ref.quote ? (found ? ` · <span class="ok">цитата найдена на странице</span>` : ` · <span class="bad">цитата не найдена дословно — пересказ</span>`) : ""} <button type="button" class="mx-page" data-page="${ref.page}">Показать страницу</button></figcaption><div class="mx-pageimg" data-for="${ref.page}"></div></figure>`;
            })
            .join("")
        : `<p class="mx-assume">Этого метода в книге нет: он показывает физику глубже книги. Смотри «Сверку».</p>`;
    }
    if (tab === "review") {
      const st = STATUS[m.review?.status || "review"];
      body = `<div class="mx-review ${st.cls}"><span class="mx-badge ${st.cls}">${st.icon}</span><div><b>${esc(st.label)}</b>${m.review?.tol ? `<p>Допуск: ${esc(m.review.tol)}</p>` : ""}<p>${m.review?.note || "Рецензент ещё не проверял этот метод."}</p>${m.review?.by ? `<small>${esc(m.review.by)}</small>` : ""}</div></div>`;
    }
    $(".mx-tabbody").innerHTML = `<div class="mx-tabhead" style="--c:${m.color}"><span class="mx-dot"></span><b>${esc(m.name)}</b><span class="mx-switch">${methods.map((x) => `<button type="button" data-focus="${x.id}" style="--c:${x.color}" aria-pressed="${x.id === focus}" title="${esc(x.name)}"><span class="mx-dot"></span></button>`).join("")}</span></div>${body}`;
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    root.querySelectorAll(".mx-method").forEach((el) => el.classList.toggle("on", el.dataset.m === focus));
  }
  function renderHud() {
    const html = exp.hud ? exp.hud(P, results, scene, focus) : "";
    const hud = $(".mx-hud");
    if (hud.innerHTML !== html) hud.innerHTML = html;
  }
  let raf = 0;
  function changed() {
    dirty = true;
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
        renderResults();
        renderChart();
        renderDetail();
        renderHud();
        if (stageApi && stageApi.update) stageApi.update(P, results, scene, focus);
        onEvent && onEvent({ type: "change", P, results, scene, focus });
      });
  }
  function setScene(s) {
    scene = s;
    Object.assign(P, s.set || {});
    exp.params.forEach((p) => p._sync());
    root.querySelectorAll("[data-scene]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.scene === s.id)));
    if (stageApi && stageApi.reset) stageApi.reset(P, scene);
    changed();
  }

  const mx = root.querySelector(".mx");
  const setFull = (on) => {
    mx.classList.toggle("full", on);
    document.body.classList.toggle("noscroll", on);
    const b = root.querySelector("[data-full]");
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "✕ Закрыть" : "⛶ На весь экран";
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
  const onKey = (e) => {
    if (e.key === "Escape" && mx.classList.contains("full")) setFull(false);
  };
  document.addEventListener("keydown", onKey);
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-full]")) return setFull(!mx.classList.contains("full"));
    const sc = e.target.closest("[data-scene]");
    if (sc) return setScene(exp.scenes.find((s) => s.id === sc.dataset.scene));
    const f = e.target.closest("[data-focus]");
    if (f) {
      focus = f.dataset.focus;
      changed();
      return;
    }
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      renderDetail();
      return;
    }
    const pg = e.target.closest("[data-page]");
    if (pg) {
      // Цитат с одной страницы может быть несколько: открываем блок именно под той, где нажали.
      const box = pg.closest(".mx-quote").querySelector(".mx-pageimg");
      const src = images()[pg.dataset.page];
      if (box.innerHTML) box.innerHTML = "";
      else box.innerHTML = src ? `<img alt="Страница ${esc(pg.dataset.page)} книги" src="${src}">` : `<pre>${esc((book.flatMap((c) => c.pages).find((p) => String(p.page) === pg.dataset.page) || {}).text || "Страница не найдена")}</pre>`;
    }
  });
  root.addEventListener("change", (e) => {
    const c = e.target.closest("[data-on]");
    if (!c) return;
    if (c.checked) active.add(c.dataset.on);
    else active.delete(c.dataset.on);
    changed();
  });

  // Живой экран: эксперимент рисует сам, кит даёт цикл и размер.
  const stageApi = exp.stage ? exp.stage(stageCanvas, { fitCanvas, P, scene, notify: () => changed() }) : null;
  // Масштаб: экран эксперимента и график. Экран перерисовывается каждый кадр сам, график — по сигналу.
  // Ручки масштаба храним, чтобы снять их наблюдатели при закрытии эксперимента.
  const zooms = zoomer
    ? [zoomer(root.querySelector(".mx-stage"), () => stageCanvas, { maxH: 0.62 }), zoomer(root.querySelector(".mx-chartwrap"), () => chartCanvas, { maxH: 0.6, onChange: () => alive && renderChart() })]
    : [];
  let frame = 0, last = 0, visible = true, alive = true;
  const tick = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (stageApi && stageApi.frame) stageApi.frame(dt, P, results, scene, focus, still());
    renderHud();
    frame = alive && visible ? requestAnimationFrame(tick) : 0;
  };
  const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((en) => {
    visible = en[en.length - 1].isIntersecting;
    if (visible && !frame && alive) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }, { rootMargin: "80px 0px" }) : null;
  if (io) io.observe(stageCanvas);
  const onResize = () => renderChart();
  window.addEventListener("resize", onResize);
  setScene(scene);
  frame = requestAnimationFrame(tick);
  return {
    destroy() {
      alive = false;
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("noscroll");
      cancelAnimationFrame(frame);
      cancelAnimationFrame(raf); // отложенный пересчёт после движения ползунка
      zooms.forEach((z) => z && z.destroy && z.destroy());
      if (io) io.disconnect();
      window.removeEventListener("resize", onResize);
      if (stageApi && stageApi.dispose) stageApi.dispose();
    },
    get state() {
      return { P, results, scene: scene.id, focus, active: [...active] };
    },
  };
}
