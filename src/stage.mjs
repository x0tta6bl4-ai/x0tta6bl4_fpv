// Оболочка стенда: карточка, цикл анимации, тур, клавиатура, панель условий опыта.
import { attachZoom } from "./zoom.mjs";
import { stick } from "./labkit.mjs";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const still = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

const SWATCH = (mark) => {
  const d = mark === "edge" || mark === "dim" || mark === "dotted" || mark === "dashed" || mark === "red" || mark === "green" || mark === "blue" ? "M1 5H15" : "M1 6.5 8 2.5 15 6.5 8 10.5Z";
  return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 13" aria-hidden="true"><path d="${d}"/></svg>`;
};

// Обозначения и подробное устройство стенда (свёрнуто на телефоне).
function legendHtml(fig, outside) {
  const open = !((typeof innerWidth === "number" && innerWidth < 700) || fig.meta.legendClosed || outside);
  return `<figcaption class="iso-legend"><details class="fig-more"${open ? " open" : ""}><summary>Обозначения и как устроен стенд</summary><span class="iso-keys">${fig.meta.keys.map((key) => `<span class="iso-key">${SWATCH(key.mark)}${esc(key.label)}</span>`).join("")}</span><span class="iso-caption">${esc(fig.meta.caption)}</span></details></figcaption>`;
}

export function mountFigure(host, fig, { number = 1, preset = {}, sidebar, metricsEl, note, infoEl, intro, onChange, onFrame } = {}) {
  const state = { ...fig.defaults, ...preset };
  host.innerHTML = `<figure class="iso-figure fig-card" data-fig="${fig.meta.id}">
    <div class="iso-plate">
      <div class="iso-plate-corners" aria-hidden="true">
        <span class="iso-plate-corner" data-corner="fig">Fig ${number}</span>
        <span class="iso-plate-corner" data-corner="title">${esc(fig.meta.title)}</span>
        <span class="iso-plate-corner" data-corner="hint">${esc(fig.meta.hint)}</span>
        <span class="iso-plate-corner" data-corner="readout" data-readout></span>
      </div>
      <div class="iso-stage" tabindex="0" role="group" aria-roledescription="интерактивный стенд" aria-label="${esc(fig.meta.title)}. ${esc(fig.meta.aria || "Стрелки влево и вправо меняют главный параметр, пробел — пауза.")}"></div>
      <div class="fig-tools">
        <button type="button" data-act="pause" aria-pressed="false">Пауза</button>
        <button type="button" data-act="labels" aria-pressed="true" title="Показать или скрыть номера деталей">Номера</button>
        ${fig.meta.explode ? `<button type="button" data-act="explode" aria-pressed="false">Разобрать · E</button>` : ""}
        <button type="button" data-act="reset">Сброс</button>
      </div>
    </div>
    <div class="fig-parts-wrap"><div class="fig-parts" role="group" aria-label="Состав: выбери деталь" hidden></div><button type="button" class="parts-arr" data-dir="-1" tabindex="-1" aria-label="Детали левее">‹</button><button type="button" class="parts-arr" data-dir="1" tabindex="-1" aria-label="Ещё детали правее">›</button></div>
    ${infoEl ? "" : legendHtml(fig, false)}
  </figure>`;
  // Под сценой (отдельно от неё): «Что на столе» — номера деталей с объяснениями, ниже обозначения.
  if (infoEl) infoEl.innerHTML = `<div class="fig-key"><div class="fig-key-h"><b>Что на столе</b>${intro ? ` <span>${esc(intro)}</span>` : ""}</div><ol class="fig-key-list"></ol></div>${legendHtml(fig, true)}`;
  const keyList = infoEl ? infoEl.querySelector(".fig-key-list") : null;
  const stage = host.querySelector(".iso-stage");
  // Картинка живёт в отдельном слое: его можно увеличивать и двигать, не трогая кнопки масштаба.
  const layer = document.createElement("div");
  layer.className = "zoom-content";
  stage.appendChild(layer);
  const narrow = typeof innerWidth === "number" && innerWidth < 600;
  // На телефоне стенд прилипает к верху экрана, поэтому растёт не выше 45 % высоты.
  // Подписи деталей: отдельный слой поверх картинки. Он не масштабируется, поэтому текст
  // остаётся читаемым при любом увеличении, а точки привязки следуют за деталями.
  const partsBar = host.querySelector(".fig-parts");
  partsBar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-part-pick]");
    if (!b) return;
    takeOver();
    apply({ select: state.select === b.dataset.partPick ? "" : b.dataset.partPick });
    placeTags();
  });
  // Строка деталей может не влезать по ширине и прокручивается вбок: у края, за которым есть ещё детали,
  // она затухает, а колесо мыши прокручивает её вбок, пока есть куда (дальше — обычная прокрутка страницы).
  const partsWrap = partsBar.parentElement;
  function partsMore() {
    const m = partsBar.hidden ? 0 : partsBar.scrollWidth - partsBar.clientWidth;
    const r = m > 2 && partsBar.scrollLeft < m - 2, l = m > 2 && partsBar.scrollLeft > 2;
    for (const el of [partsBar, partsWrap]) {
      el.classList.toggle("more-r", r);
      el.classList.toggle("more-l", l);
    }
  }
  // Стрелки по краям строки — заметный знак, что деталей больше, чем видно; нажатие листает строку.
  partsWrap.querySelectorAll(".parts-arr").forEach((b) => b.addEventListener("click", () => partsBar.scrollBy({ left: Number(b.dataset.dir) * partsBar.clientWidth * 0.7, behavior: still.matches ? "auto" : "smooth" })));
  partsBar.addEventListener("scroll", partsMore, { passive: true });
  partsBar.addEventListener("wheel", (e) => {
    const m = partsBar.scrollWidth - partsBar.clientWidth;
    if (m <= 2 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const next = Math.max(0, Math.min(m, partsBar.scrollLeft + e.deltaY));
    if (Math.abs(next - partsBar.scrollLeft) < 1) return;
    partsBar.scrollLeft = next;
    e.preventDefault();
    partsMore();
  }, { passive: false });
  if (typeof ResizeObserver === "function") new ResizeObserver(partsMore).observe(partsBar);
  const tags = document.createElement("div");
  tags.className = "fig-labels";
  tags.innerHTML = `<svg class="fig-leaders" aria-hidden="true"></svg>`;
  stage.appendChild(tags);
  const leaders = tags.firstChild;
  // Номера деталей на сцене по умолчанию скрыты: деталь объясняется касанием её самой.
  // Номер виден только у выбранной детали (маячок); кнопка «Номера» показывает все (выбор запоминается).
  let showTags = false, hoverPick = "";
  try {
    showTags = localStorage.getItem("fpv-marks") === "1";
  } catch (e) {}
  // Сцена открывается целиком, без увеличения: сначала видно весь стол, приближают пальцами или кнопкой «+».
  // На телефоне кнопок +/− не видно, пока сцена не увеличена (увеличивают двумя пальцами или касанием детали):
  // они не закрывают картинку. После увеличения появляется ⤢ — вернуть всё в рамку.
  // Двойное касание здесь не увеличивает: касание детали уже приближает её (и второе — отдаляет).
  const zoom = attachZoom(stage, () => layer, { initial: 1, maxH: narrow ? 0.45 : 0.75, dblTap: false, onChange: () => placeTags() });
  const readout = host.querySelector("[data-readout]");
  const toolsEl = host.querySelector(".fig-tools");
  if (narrow) {
    readout.classList.add("fig-status");
    stage.after(readout);
  }
  const pauseBtn = host.querySelector('[data-act="pause"]');
  const explodeBtn = host.querySelector('[data-act="explode"]');
  let built, ctl;
  let paused = false;
  // Автоматический показ отключён: условия опыта меняет только ученик (сцена не должна «жить сама»).
  // Механизм тура оставлен на случай явной кнопки «Показать», но сам он не запускается.
  const AUTO_TOUR = false;
  let touring = AUTO_TOUR && !still.matches;
  // Как стенд выглядел до тура: когда ученик берёт управление, показ тура откатывается,
  // чтобы миссии не засчитывались за то, что сделал тур.
  let tourBase = touring ? { ...state } : null;
  let tourClock = 0;
  let idle = 0;
  let frame = 0;
  let last = 0;
  let visible = false;
  let lastMetrics = "", procEl = null, lastProc = "";

  function build() {
    built = fig.render(state);
    layer.innerHTML = built.svg;
    ctl = fig.controller(stage, built, state, { announce });
    lastMetrics = "";
    buildTags();
    applyLook();
    draw(0, true);
  }
  // «Смотри сюда · меняй это» для текущего задания: деталь на схеме (группа или узел) и ручка в панели.
  // touch: "mode" — вся ручка, "mode=hv" — ещё и конкретная кнопка ряда.
  let lookIds = [], touchIds = [];
  function applyLook() {
    const svgEl = layer.querySelector("svg");
    if (svgEl) {
      svgEl.querySelectorAll(".it[data-look]").forEach((el) => el.removeAttribute("data-look"));
      if (lookIds.length) {
        svgEl.setAttribute("data-look", "");
        svgEl.querySelectorAll(".it").forEach((el) => { if (lookIds.includes(el.dataset.g) || lookIds.includes(el.dataset.c)) el.setAttribute("data-look", ""); });
      } else svgEl.removeAttribute("data-look");
    }
    if (!sidebar) return;
    sidebar.querySelectorAll(".ctl-hint, .seg-hint").forEach((el) => el.classList.remove("ctl-hint", "seg-hint"));
    for (const t of touchIds) {
      const [id, val] = String(t).split("=");
      const el = sidebar.querySelector(`[data-ctl="${id}"], [data-seg="${id}"], [data-sticks="${id}"]`);
      const box = el && (el.closest(".ctl") || el);
      if (box) box.classList.add("ctl-hint");
      if (val !== undefined) { const b = sidebar.querySelector(`[data-seg="${id}"][data-value="${val}"]`); if (b) b.classList.add("seg-hint"); }
    }
  }
  // ── Подписи ──
  let tagEls = [], tagAt = 0, focusIdx = -1;
  function buildTags() {
    tags.querySelectorAll(".flabel, .fmark").forEach((el) => el.remove());
    if (typeof bubble === "object" && bubble) hideInfo();
    tagEls = (built.labels || []).map((l, i) => {
      const active = l.pick || l.info;
      const el = document.createElement(active ? "button" : "span");
      if (active) el.type = "button";
      el.className = "flabel" + (active ? " pickable" : "");
      el.textContent = l.text;
      if (l.pick) el.dataset.for = l.pick;
      if (l.info) el.title = l.info;
      tags.appendChild(el);
      // Номер детали на сцене: маленький кружок вместо подписи, сама подпись — только у выбранной.
      const mk = document.createElement("button");
      mk.type = "button";
      mk.className = "fmark";
      mk.textContent = String(i + 1);
      mk.setAttribute("aria-label", `${i + 1}: ${l.text}`);
      mk.dataset.key = String(i);
      if (l.tone) mk.dataset.tone = l.tone; // стенд может окрасить номер: bad — красный, ok — зелёный
      tags.appendChild(mk);
      return { l, el, mk, i, w: 0, h: 0 };
    });
    if (keyList) keyList.innerHTML = tagEls.map((t) => `<li><button type="button" data-key="${t.i}"><span class="fk-n">${t.i + 1}</span><span class="fk-t"><b>${esc(t.l.text)}</b>${t.l.info ? ` — ${esc(t.l.info)}` : ""}</span></button></li>`).join("");
    if (keyList) keyList.closest(".fig-key").hidden = !tagEls.length;
    if (focusIdx >= tagEls.length) focusIdx = -1;
    tags.hidden = !tagEls.length;
    tagAt = 0;
    // Состав списком под картинкой: кнопка — деталь, нажатие подсвечивает её на схеме.
    const picks = tagEls.filter((t) => t.l.pick);
    partsBar.hidden = !picks.length;
    partsBar.innerHTML = picks.map((t) => `<button type="button" data-part-pick="${esc(t.l.pick)}">${esc(t.l.text)}</button>`).join("");
    partsMore();
    placeTags();
  }
  function anchorOf(l, svgEl, ctm) {
    // Стенд может сам назвать точку подписи (в координатах рисунка): у подвижных деталей она едет вместе с ними.
    const own = l.pick && ctl && ctl.anchor ? ctl.anchor(l.pick) : null;
    if (own && ctm && Number.isFinite(own[0]) && Number.isFinite(own[1])) {
      const pt = svgEl.createSVGPoint();
      pt.x = own[0];
      pt.y = own[1];
      const q = pt.matrixTransform(ctm);
      return [q.x, q.y];
    }
    if (l.pick && !l.at) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      layer.querySelectorAll(`[data-pick="${l.pick}"]`).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (!r.width && !r.height) return;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      });
      return x0 === Infinity ? null : [(x0 + x1) / 2, y0 + (y1 - y0) * 0.4];
    }
    if (!ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = l.at[0];
    pt.y = l.at[1];
    const q = pt.matrixTransform(ctm);
    return [q.x, q.y];
  }
  function placeTags() {
    if (tags.hidden || !tagEls.length) return;
    const sr = stage.getBoundingClientRect();
    if (!sr.width) return;
    const svgEl = layer.querySelector("svg");
    const ctm = svgEl && svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    const W = sr.width, H = sr.height, items = [], marks = [], anchorsOnly = [];
    for (const t of tagEls) {
      if (!t.w) {
        t.w = t.el.offsetWidth;
        t.h = t.el.offsetHeight;
      }
      const hot = t.i === focusIdx || (t.l.pick && (t.l.pick === state.select || t.l.pick === hoverPick));
      // На телефоне подпись-плашка не нужна (объяснение — строкой под сценой): выбранный номер просто светится.
      const wanted = hot && !narrow;
      t.mk.classList.toggle("on", !!hot);
      const a = anchorOf(t.l, svgEl, ctm);
      const ax = a ? a[0] - sr.left : -1, ay = a ? a[1] - sr.top : -1;
      const inside = a && ax > 6 && ax < W - 6 && ay > 6 && ay < H - 6;
      // Номер стоит прямо на детали; если её подпись открыта, номер прячется под подписью.
      const showMk = inside && !wanted && (showTags || hot);
      t.mk.style.visibility = showMk ? "" : "hidden";
      if (showMk) marks.push({ t, ax, ay, x: ax, y: ay });
      else if (inside) anchorsOnly.push([ax, ay]);
      t.el.style.visibility = inside && wanted ? "" : "hidden";
      if (!inside || !wanted) continue;
      // Подпись — в сторону ближайшего края, чтобы не лезть на центр детали.
      const left = t.l.side ? t.l.side === "left" : ax < W / 2;
      items.push({ t, ax, ay, left, x: left ? ax - 22 - t.w : ax + 22, y: ay - t.h - 10 });
    }
    // Раздвигаем подписи по вертикали, отдельно слева и справа. Справа внизу — кнопки масштаба:
    // правый столбец не опускается ниже них (если не влезает — поджимаем столбец вверх).
    const zu = stage.querySelector(".zoom-ui");
    const zr = zu && zu.offsetParent ? zu.getBoundingClientRect() : null;
    const rightBottom = zr && zr.height ? Math.min(H, zr.top - sr.top) : H;
    for (const side of [true, false]) {
      const col = items.filter((i) => i.left === side).sort((a, b) => a.y - b.y);
      const bottom = side ? H : rightBottom;
      for (let i = 0; i < col.length; i++) {
        col[i].y = Math.max(4, Math.min(col[i].y, H - col[i].t.h - 4));
        if (i && col[i].y < col[i - 1].y + col[i - 1].t.h + 3) col[i].y = col[i - 1].y + col[i - 1].t.h + 3;
      }
      for (let i = col.length - 1; i >= 0; i--) {
        const lim = i === col.length - 1 ? bottom - 4 : col[i + 1].y - 3;
        if (col[i].y + col[i].t.h > lim) col[i].y = Math.max(4, lim - col[i].t.h);
      }
    }
    // Номера близких деталей не должны лежать друг на друге: раздвигаем кружки,
    // а от сдвинутого номера к детали тянем тонкую черту.
    // Номер не ложится на саму деталь: он стоит рядом, как булавка, — чуть вверх и наружу от центра сцены,
    // а к точке на детали тянется черта. Так видно и номер, и деталь под ним.
    const D = 24, OFF = narrow ? 20 : 24;
    if (marks.length) {
      const cx = marks.reduce((a, m) => a + m.ax, 0) / marks.length, cy = marks.reduce((a, m) => a + m.ay, 0) / marks.length;
      for (const m of marks) {
        const dx = m.ax - cx, dy = m.ay - cy, d = Math.hypot(dx, dy) || 1;
        let vx = (dx / d) * 0.55, vy = (dy / d) * 0.55 - 0.85;
        const v = Math.hypot(vx, vy) || 1;
        m.x = m.ax + (vx / v) * OFF;
        m.y = m.ay + (vy / v) * OFF;
      }
    }
    const pins = marks.map((m) => [m.ax, m.ay]).concat(anchorsOnly);
    const tr = toolsEl && toolsEl.offsetParent ? toolsEl.getBoundingClientRect() : null;
    const tb = tr && tr.width && tr.bottom > sr.top && tr.top < sr.bottom ? { l: tr.left - sr.left, b: tr.bottom - sr.top } : null;
    for (let it = 0; it < 16; it++) {
      let moved = false;
      // Номер не закрывает точки деталей (свою и чужие).
      for (const m of marks) for (const [qx, qy] of pins) {
        let dx = m.x - qx, dy = m.y - qy, d = Math.hypot(dx, dy);
        if (d >= 15) continue;
        if (d < 0.01) { dx = 0; dy = -1; d = 1; }
        m.x += (dx / d) * (15 - d); m.y += (dy / d) * (15 - d);
        moved = true;
      }
      for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
        const m = marks[i], n = marks[j];
        let dx = n.x - m.x, dy = n.y - m.y, d = Math.hypot(dx, dy);
        if (d >= D) continue;
        if (d < 0.01) { dx = 1; dy = 0.3 * (j - i); d = Math.hypot(dx, dy); }
        const p = (D - d) / 2 + 0.5;
        m.x -= dx / d * p; m.y -= dy / d * p; n.x += dx / d * p; n.y += dy / d * p;
        moved = true;
      }
      for (const m of marks) {
        m.x = Math.max(11, Math.min(W - 11, m.x));
        m.y = Math.max(11, Math.min(H - 11, m.y));
        // Кнопки «Пауза / Номера / Сброс» в правом верхнем углу: номер под ними не прячем.
        if (tb && m.x > tb.l - 11 && m.y < tb.b + 11) m.y = tb.b + 11;
      }
      if (!moved) break;
    }
    let lines = "";
    for (const m of marks) {
      m.t.mk.style.transform = `translate(${(m.x - 10).toFixed(1)}px, ${(m.y - 10).toFixed(1)}px)`;
      if (Math.hypot(m.x - m.ax, m.y - m.ay) > 6) lines += `<path class="mk-lead" d="M${m.ax.toFixed(1)} ${m.ay.toFixed(1)}L${m.x.toFixed(1)} ${m.y.toFixed(1)}"/><circle class="mk-dot" cx="${m.ax.toFixed(1)}" cy="${m.ay.toFixed(1)}" r="2.6"/>`;
    }
    for (const i of items) {
      i.x = Math.max(4, Math.min(i.x, W - i.t.w - 4));
      i.t.el.style.transform = `translate(${i.x.toFixed(1)}px, ${i.y.toFixed(1)}px)`;
      const ex = i.left ? i.x + i.t.w : i.x, ey = i.y + i.t.h / 2;
      lines += `<path d="M${i.ax.toFixed(1)} ${i.ay.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle cx="${i.ax.toFixed(1)}" cy="${i.ay.toFixed(1)}" r="2.6"/>`;
    }
    leaders.setAttribute("viewBox", `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
    leaders.innerHTML = lines;
    const sel = state.select;
    partsBar.querySelectorAll("[data-part-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.partPick === sel)));
    for (const t of tagEls) {
      t.el.classList.toggle("on", (!!t.l.pick && t.l.pick === sel) || t.i === focusIdx);
    }
    if (keyList) keyList.querySelectorAll("[data-key]").forEach((b) => b.classList.toggle("on", Number(b.dataset.key) === focusIdx || (!!tagEls[Number(b.dataset.key)]?.l.pick && tagEls[Number(b.dataset.key)].l.pick === sel)));
  }
  function announce(text) {
    const live = document.getElementById("announce");
    if (live) live.textContent = text;
  }
  // Цвет плашки итога: явная беда — красноватая, «есть / готов» — зелёная, остальное нейтральное.
  const BAD = /(^|\s)нет(\s|$)|LOSS|не хватает|обрыв|запрещ|сгор|перегрев|FAIL|пропал/i;
  const GOOD = /(^|\s)есть(\s|$)|(^|\s)OK(\s|$)|готов/i;
  // Стенд может пометить пункт явно: «✗ …» — беда, «✓ …» — порядок.
  const chipTone = (x) => (/^✗/.test(x) || (!/^✓/.test(x) && BAD.test(x)) ? ' data-tone="bad"' : /^✓/.test(x) || GOOD.test(x) ? ' data-tone="good"' : "");
  // Камера на телефоне: стенд может попросить следить за точкой (ctl.follow() → [x, y] рисунка или null),
  // например за дроном в полёте. Сцена плавно приближается (×1,7) и ведёт точку; без точки — плавно назад.
  // Если человек сам трогал масштаб или нажал номер детали, камера 5 с не вмешивается.
  let cam = null, camHoldAt = -1e9;
  const CAM_S = 1.7;
  function follow(dt) {
    const quietSince = Math.max(zoom.userAt, camHoldAt);
    const busy = performance.now() - quietSince < 5000;
    let p = !touring && !busy ? ctl.follow(state) : null; // [x, y] или [x, y, масштаб]
    if (p && Number.isFinite(p[2]) && p[2] < 1.05) p = null; // приближать незачем — вся сцена в рамке
    const a = Math.min(1, (dt > 0 ? dt : 0.016) * 2.5);
    let target = null;
    const svgEl = p && layer.querySelector("svg");
    const ctm = svgEl && svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    if (ctm && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      const pt = svgEl.createSVGPoint();
      pt.x = p[0];
      pt.y = p[1];
      const q = pt.matrixTransform(ctm);
      target = zoom.toContent(q.x, q.y);
    }
    const w = stage.clientWidth, h = layer.offsetHeight || stage.clientHeight;
    if (target) {
      if (!cam) {
        const r = stage.getBoundingClientRect();
        const c = zoom.toContent(r.left + w / 2, r.top + h / 2);
        cam = { s: zoom.scale, x: c[0], y: c[1] };
      }
      cam.s += ((Number.isFinite(p[2]) ? p[2] : CAM_S) - cam.s) * a;
      cam.x += (target[0] - cam.x) * a;
      cam.y += (target[1] - cam.y) * a;
      zoom.setView(cam.x, cam.y, cam.s);
    } else if (cam) {
      if (busy) return void (cam = null); // человек взял масштаб на себя
      cam.s += (1 - cam.s) * a;
      cam.x += (w / 2 - cam.x) * a;
      cam.y += (h / 2 - cam.y) * a;
      if (cam.s < 1.01) {
        zoom.reset();
        cam = null;
      } else zoom.setView(cam.x, cam.y, cam.s);
    }
  }
  function draw(dt, calm) {
    ctl.tick(dt, calm, state);
    if (narrow && zoom && ctl.follow) {
      follow(dt);
      stage.classList.toggle("cam", !!cam);
    }
    // Детали двигаются (разборка, масштаб): подписи догоняют их не чаще 10 раз в секунду.
    const now = typeof performance === "object" ? performance.now() : 0;
    if (now - tagAt > 100) {
      tagAt = now;
      placeTags();
    }
    if (onFrame) onFrame(ctl, state, !touring);
    if (procEl && ctl.panel) {
      const html = ctl.panel(state);
      if (html !== lastProc) {
        procEl.innerHTML = html;
        lastProc = html;
      }
    }
    const text = ctl.readout();
    if (readout.textContent !== text) {
      // На телефоне итог опыта — крупной строкой под сценой, каждое значение отдельной плашкой
      // (разделители « · » остаются в тексте, textContent не меняется).
      if (narrow) readout.innerHTML = text.split(" · ").map((x) => `<span${chipTone(x)}${ctl.explain && ctl.explain(x) ? ' role="button" tabindex="0" data-explain=""' : ""}>${esc(x)}</span>`).join('<i aria-hidden="true"> · </i>');
      else readout.textContent = text;
    }
    if (metricsEl && ctl.metrics) {
      const rows = ctl.metrics();
      const html = rows.map(([label, value, tag]) => `<div class="metric"><small>${esc(label)}${tag ? ` <span class="tag" data-tag="${esc(tag)}">${esc(tag)}</span>` : ""}</small><b>${esc(value)}</b></div>`).join("");
      if (html !== lastMetrics) {
        metricsEl.innerHTML = html;
        lastMetrics = html;
      }
    }
    if (note && ctl.note) {
      const n = ctl.note();
      if (note.innerHTML !== n) note.innerHTML = n;
    }
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    if (touring && fig.tour && fig.tour.length) {
      tourClock += dt;
      const period = fig.tour[fig.tour.length - 1].at + 4;
      const t = tourClock % period;
      let step = fig.tour[0];
      for (const s of fig.tour) if (t >= s.at) step = s;
      if (step !== tick.step) {
        tick.step = step;
        apply(step.set, true);
      }
    } else if (!touring && !paused && !calm) {
      idle += dt;
      if (AUTO_TOUR && idle > 9 && fig.tour) {
        touring = true;
        tourBase = { ...state };
        tourClock = 0;
        tick.step = null;
      }
    }
    // Ошибка в одном кадре не должна останавливать стенд навсегда: кадры продолжаются, ошибка — в консоль.
    try {
      draw(paused ? 0 : dt, calm);
    } catch (e) {
      if (!tick.errShown) console.error(e);
      tick.errShown = true;
    }
    frame = visible && !paused ? requestAnimationFrame(tick) : 0;
  }
  const run = () => {
    if (!frame && visible && !paused) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };
  function takeOver() {
    if (touring && tourBase) {
      touring = false;
      let rebuild = false;
      for (const [key, value] of Object.entries(tourBase)) {
        if (state[key] === value) continue;
        const c = (fig.controls || []).find((x) => x.id === key);
        if (c && c.rebuild) rebuild = true;
      }
      Object.assign(state, tourBase);
      // Картинку пересобираем, только если тур менял «тяжёлые» условия; иначе — только модель
      // (её память: «уже наклонял», «был обрыв связи»). Так нажатие на деталь сцены не теряется.
      if (rebuild) build();
      else {
        ctl = fig.controller(stage, built, state, { announce });
        lastMetrics = "";
      }
      syncControls();
      if (explodeBtn) explodeBtn.setAttribute("aria-pressed", String(!!state.apart));
    }
    touring = false;
    idle = 0;
  }
  function apply(patch, fromTour = false) {
    let rebuild = false;
    for (const [key, value] of Object.entries(patch)) {
      if (state[key] === value) continue;
      state[key] = value;
      const c = (fig.controls || []).find((x) => x.id === key);
      if (c && c.rebuild) rebuild = true;
      // Смена этого условия начинает опыт заново: перечисленные в resets условия (стики, тумблеры)
      // возвращаются к исходным, если их не задали в том же patch.
      if (c && c.resets) {
        // resetTo(значение) — исключения: например, поломка «тумблер был включён при подаче питания» начинается с включённым тумблером.
        const over = c.resetTo ? c.resetTo(value) || {} : {};
        for (const r of c.resets) if (!(r in patch)) state[r] = r in over ? over[r] : r in preset ? preset[r] : fig.defaults[r];
      }
      // sets — скрытые условия, которые включает смена этого (например, «показать сектор обзора камеры»).
      if (c && c.sets) for (const [k2, v2] of Object.entries(c.sets)) if (!(k2 in patch)) state[k2] = v2;
    }
    if (rebuild) build();
    syncControls();
    if (!fromTour && onChange) onChange(state);
    if (!frame) draw(0, still.matches);
    run();
  }
  // Панель условий опыта.
  function controlsHtml() {
    return (fig.controls || [])
      .map((c) => {
        const id = `c-${fig.meta.id}-${c.id}`;
        if (c.type === "range") return `<label class="ctl" for="${id}"><span>${esc(c.label)} <output data-out="${c.id}"></output></span><input id="${id}" type="range" data-ctl="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}"></label>`;
        if (c.type === "select") return `<label class="ctl" for="${id}"><span>${esc(c.label)}</span><select id="${id}" data-ctl="${c.id}">${c.options.map((o) => (Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<optgroup label="${esc(o.group)}">${o.items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</optgroup>`)).join("")}</select></label>`;
        if (c.type === "check") return `<label class="ctl check" for="${id}"><input id="${id}" type="checkbox" data-ctl="${c.id}"><span>${esc(c.label)}</span></label>`;
        if (c.type === "sticks") return `<div class="ctl ctl-sticks" data-sticks="${c.id}"><span>${esc(c.label)}</span><div class="ctl-pads"></div><small class="ctl-stickout" data-stickout></small></div>`;
        if (c.type === "seg") return `<div class="ctl"><span>${esc(c.label)}</span><div class="seg" role="radiogroup" aria-label="${esc(c.label)}">${c.options.map(([v, l]) => `<button type="button" role="radio" data-seg="${c.id}" data-value="${esc(v)}">${esc(l)}</button>`).join("")}</div></div>`;
        return "";
      })
      .join("");
  }
  function syncControls() {
    if (explodeBtn) explodeBtn.setAttribute("aria-pressed", String(!!state.apart));
    if (!sidebar) return;
    for (const c of fig.controls || []) {
      const el = sidebar.querySelector(`[data-ctl="${c.id}"]`);
      if (c.type === "range" && el) {
        el.value = state[c.id];
        const out = sidebar.querySelector(`[data-out="${c.id}"]`);
        if (out) out.textContent = c.fmt ? c.fmt(state[c.id]) : state[c.id];
      } else if (c.type === "select" && el) el.value = String(state[c.id]);
      else if (c.type === "check" && el) el.checked = !!state[c.id];
      else if (c.type === "seg") sidebar.querySelectorAll(`[data-seg="${c.id}"]`).forEach((b) => b.setAttribute("aria-checked", String(String(state[c.id]) === b.dataset.value)));
      else if (c.type === "sticks" && sticks[c.id]) {
        const [L, R] = sticks[c.id];
        L.set([state.yaw || 0, (state.throttle || 0) * 2 - 1]);
        R.set([state.roll || 0, state.pitch || 0]);
        const out = sidebar.querySelector(`[data-sticks="${c.id}"] [data-stickout]`);
        if (out && c.fmt) out.textContent = c.fmt(state);
      }
    }
  }
  // Стики пульта (Mode 2): левый — газ ↕ (не пружинит) и рыскание ↔, правый — тангаж ↕ и крен ↔.
  const sticks = {};
  function mountSticks() {
    for (const c of fig.controls || []) {
      if (c.type !== "sticks") continue;
      const pads = sidebar.querySelector(`[data-sticks="${c.id}"] .ctl-pads`);
      if (!pads) continue;
      const move = (patch) => {
        takeOver();
        apply(patch);
      };
      sticks[c.id] = [
        stick(pads, { label: "Левый: газ ↕ · рыскание ↔", spring: [true, false], value: [state.yaw || 0, (state.throttle || 0) * 2 - 1], onMove: ([x, y]) => move({ yaw: Math.round(x * 20) / 20, throttle: Math.round(((y + 1) / 2) * 100) / 100 }) }),
        stick(pads, { label: "Правый: тангаж ↕ · крен ↔", spring: [true, true], value: [state.roll || 0, state.pitch || 0], onMove: ([x, y]) => move({ roll: Math.round(x * 20) / 20, pitch: Math.round(y * 20) / 20 }) }),
      ];
    }
  }
  if (sidebar) {
    // Стенд-разбор (meta.proc): вместо ползунков — своя панель шагов с кнопками (ctl.panel / ctl.act).
    const visibleCtl = (fig.controls || []).some((c) => c.type !== "hidden");
    sidebar.innerHTML = `${fig.meta.proc ? `<div class="fig-proc" data-ctl="proc" aria-live="polite"></div>` : ""}${visibleCtl ? `<div class="ctl-head">Условия опыта</div>${controlsHtml()}` : ""}${fig.meta.try && !(fig.meta.missions || []).length ? `<div class="ctl-try"><b>Попробуй</b><ul>${fig.meta.try.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}`;
    procEl = sidebar.querySelector(".fig-proc");
    if (procEl)
      procEl.addEventListener("click", (e) => {
        const b = e.target.closest("[data-fig-act]");
        if (!b || !ctl || !ctl.act) return;
        takeOver();
        ctl.act(b.dataset.figAct, state, apply);
        placeTags();
      });
    mountSticks();
    sidebar.addEventListener("input", (e) => {
      const el = e.target.closest("[data-ctl]");
      if (!el) return;
      const c = fig.controls.find((x) => x.id === el.dataset.ctl);
      // Сначала читаем, что выбрал ученик: takeOver() откатывает тур и перерисовывает панель.
      let v = c.type === "check" ? el.checked : c.type === "range" ? Number(el.value) : el.value;
      if (c.num) v = Number(v);
      takeOver();
      apply({ [c.id]: v });
    });
    sidebar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-seg]");
      if (!b) return;
      const c = fig.controls.find((x) => x.id === b.dataset.seg);
      takeOver();
      apply({ [c.id]: c.num ? Number(b.dataset.value) : b.dataset.value });
    });
  }
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.textContent = paused ? "Пуск" : "Пауза";
    if (!paused) run();
  });
  host.querySelector('[data-act="reset"]').addEventListener("click", () => {
    Object.assign(state, fig.defaults, preset);
    touring = false; // сброс сам задаёт исходный вид — откат тура не нужен
    build();
    ctl.reset && ctl.reset();
    syncControls();
    takeOver();
    if (explodeBtn) explodeBtn.setAttribute("aria-pressed", String(!!state.apart));
    run();
  });
  const labelsBtn = host.querySelector('[data-act="labels"]');
  const syncLabelsBtn = () => {
    labelsBtn.setAttribute("aria-pressed", String(showTags));
    labelsBtn.hidden = !tagEls.length;
  };
  labelsBtn.addEventListener("click", () => {
    showTags = !showTags;
    try {
      localStorage.setItem("fpv-marks", showTags ? "1" : "0");
    } catch (e) {}
    syncLabelsBtn();
    placeTags();
  });
  // Объяснение детали простыми словами — всплывает под подписью.
  const bubble = document.createElement("div");
  // На телефоне окошко поверх картинки закрывает саму сцену: там объяснение — строкой под ней,
  // строка видна всегда и подсказывает, что номера нажимаются.
  const flowInfo = narrow;
  const INFO_HINT = "Нажми на любую деталь — узнаешь, что это.";
  bubble.className = flowInfo ? "finfo finfo-flow" : "finfo";
  bubble.setAttribute("role", "status");
  if (flowInfo) (readout.classList.contains("fig-status") ? readout : stage).after(bubble);
  else tags.appendChild(bubble);
  let bubbleFor = null, bubbleT = 0;
  // Нажатие на плашку итога: стенд объясняет её (ctl.explain(текст) → строка или "").
  if (flowInfo) readout.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-explain]");
    const t = chip && ctl.explain ? ctl.explain(chip.textContent) : "";
    if (!t) return;
    bubbleFor = null;
    bubble.classList.remove("idle");
    bubble.innerHTML = `<b>${esc(chip.textContent.replace(/^[✗✓]\s*/, ""))}.</b> ${esc(t)}`;
    announce(`${chip.textContent}. ${t}`);
  });
  function hideInfo() {
    bubbleFor = null;
    if (!flowInfo) return void (bubble.hidden = true);
    bubble.classList.add("idle");
    bubble.textContent = INFO_HINT;
  }
  hideInfo();
  function showInfo(t) {
    if (bubbleFor === t && (flowInfo ? !bubble.classList.contains("idle") : !bubble.hidden)) return hideInfo();
    bubbleFor = t;
    bubble.innerHTML = `<b>${esc(t.l.text)}.</b> ${esc(t.l.info)}`;
    bubble.hidden = false;
    if (flowInfo) {
      bubble.classList.remove("idle");
      announce(`${t.l.text}. ${t.l.info}`);
      return;
    }
    const sr = stage.getBoundingClientRect(), lr = t.el.getBoundingClientRect();
    const bw = Math.min(260, sr.width - 16);
    bubble.style.width = `${bw}px`;
    const x = Math.max(8, Math.min(lr.left - sr.left, sr.width - bw - 8));
    let y = lr.bottom - sr.top + 6;
    if (y + bubble.offsetHeight > sr.height - 8) y = Math.max(8, lr.top - sr.top - bubble.offsetHeight - 6);
    bubble.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    announce(`${t.l.text}. ${t.l.info}`);
    clearTimeout(bubbleT);
    bubbleT = setTimeout(hideInfo, 7000);
  }
  // Нажатие на подпись выбирает деталь (где детали выбираются) или объясняет её.
  // Номер на сцене или строка в списке «Что на столе» открывают подпись детали и объяснение; повторно — закрывают.
  // На телефоне детали мелкие: выбранная деталь плавно приближается (×2,2), без выбора — вся сцена в рамке.
  function zoomTo(t) {
    if (!narrow || !zoom) return;
    camHoldAt = performance.now();
    const svgEl = layer.querySelector("svg");
    const a = t ? anchorOf(t.l, svgEl, svgEl && svgEl.getScreenCTM ? svgEl.getScreenCTM() : null) : null;
    if (a) zoom.focus(a[0], a[1], Math.max(2.2, zoom.scale));
    else if (zoom.scale > 1.001) zoom.reset(true);
  }
  // Деталь под пальцем → номер её подписи (−1 — рядом ничего). Сравниваем группы рисунка под пальцем
  // с группой в точке каждой подписи; среди подходящих — ближайшая подпись. Без группы — подпись ближе 28 px.
  function labelAt(px, py) {
    if (!tagEls.length) return -1;
    const svgEl = layer.querySelector("svg");
    const ctm = svgEl && svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    const keyOf = (el) => {
      const n = el && el.closest && el.closest(".it[data-g], [data-pick]");
      return n && layer.contains(n) ? n.dataset.c || n.dataset.pick || `g:${n.dataset.g}` : "";
    };
    // near — группы прямо под пальцем и в 8 px от него, far — в кольце 16 px.
    const near = new Set(), far = new Set();
    const collect = (x, y, set) => {
      for (const el of document.elementsFromPoint(x, y)) {
        const key = keyOf(el);
        if (key) set.add(key);
      }
    };
    collect(px, py, near);
    for (const [rr, set] of [[8, near], [16, far]]) for (let j = 0; j < 8; j++) collect(px + Math.cos((j / 8) * Math.PI * 2) * rr, py + Math.sin((j / 8) * Math.PI * 2) * rr, set);
    let best = -1, bs = Infinity;
    for (const t of tagEls) {
      const a = anchorOf(t.l, svgEl, ctm);
      if (!a) continue;
      let key = t.l.pick || "";
      if (!key) for (const el of document.elementsFromPoint(a[0], a[1])) if ((key = keyOf(el))) break;
      const d = Math.hypot(a[0] - px, a[1] - py);
      const sc = key && near.has(key) ? d : key && far.has(key) ? d + 15 : d < 28 ? d + 10 : Infinity;
      if (sc < bs) { bs = sc; best = t.i; }
    }
    return best;
  }
  // Для автотестов: точки подписей на экране.
  stage.__anchors = () => {
    const svgEl = layer.querySelector("svg");
    const ctm = svgEl && svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    return tagEls.map((t) => ({ text: t.l.text, pick: t.l.pick || "", a: anchorOf(t.l, svgEl, ctm) }));
  };
  // Касание детали на стенде без выбора деталей (ctl.pick): то же, что нажатие её номера.
  function tapLabel(px, py) {
    const li = labelAt(px, py);
    if (li >= 0) focusKey(li);
    else if (focusIdx >= 0) focusKey(focusIdx); // пустое место — закрыть
  }
  function focusKey(i) {
    const t = tagEls[i];
    if (!t) return;
    if (t.l.pick && ctl.pick) {
      takeOver();
      ctl.pick(t.l.pick, state, apply);
    }
    focusIdx = focusIdx === i ? -1 : i;
    placeTags();
    zoomTo(focusIdx === i ? t : null);
    if (focusIdx === i && t.l.info) {
      bubbleFor = null;
      showInfo(t);
    } else hideInfo();
  }
  tags.addEventListener("click", (e) => {
    const m = e.target.closest(".fmark");
    if (m && performance.now() - tapDone < 800) return; // уже обработали касание номера
    if (m) return focusKey(Number(m.dataset.key));
    const b = e.target.closest(".flabel.pickable");
    if (!b) return;
    const t = tagEls.find((x) => x.el === b);
    if (t) focusKey(t.i);
  });
  if (keyList) keyList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-key]");
    if (b) focusKey(Number(b.dataset.key));
  });
  if (explodeBtn)
    explodeBtn.addEventListener("click", () => {
      takeOver();
      apply({ apart: !state.apart });
      explodeBtn.setAttribute("aria-pressed", String(!!state.apart));
    });
  const primary = (fig.controls || []).find((c) => c.type === "range");
  stage.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      pauseBtn.click();
      return;
    }
    if ((e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") && explodeBtn) {
      explodeBtn.click();
      return;
    }
    if (!primary) return;
    const step = primary.step * (e.shiftKey ? 10 : Math.max(1, Math.round((primary.max - primary.min) / primary.step / 40)));
    if (!["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    takeOver(); // шаг считаем от значения после отката тура
    let v = state[primary.id];
    if (e.key === "ArrowRight" || e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= step;
    else if (e.key === "Home") v = primary.min;
    else if (e.key === "End") v = primary.max;
    apply({ [primary.id]: Math.max(primary.min, Math.min(primary.max, +v.toFixed(4))) });
  });
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".fig-labels")) return; // нажатие на подпись — не жест по стенду
    takeOver();
    if (ctl.pointer) ctl.pointer(e, stage, state, apply);
  });
  let lastTap = null, tapDown = null, tapDone = 0;
  // Номер под пальцем (центр кружка ближе 13 px) — индекс детали или −1.
  function markAt(px, py) {
    let best = -1, bd = 13;
    for (const t of tagEls) {
      if (t.mk.style.visibility === "hidden" || tags.hidden) continue;
      const r = t.mk.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
      if (d < bd) { bd = d; best = t.i; }
    }
    return best;
  }
  // На телефоне касание детали сразу объясняет её строкой под картинкой.
  function explainSelected() {
    if (!flowInfo) return;
    const t = state.select && tagEls.find((x) => x.l.pick === state.select);
    focusIdx = t ? t.i : -1;
    zoomTo(t || null);
    if (t && t.l.info) {
      bubbleFor = null;
      showInfo(t);
    } else hideInfo();
  }
  // Кнопки прямо на картинке (тумблер на пульте, экран очков): стенд обрабатывает их сам.
  function tapButton(px, py) {
    if (!ctl.tap) return false;
    for (const el of document.elementsFromPoint(px, py)) {
      const n = el.closest && el.closest("[data-tap]");
      if (n && layer.contains(n)) {
        takeOver();
        ctl.tap(n.dataset.tap, state, apply);
        placeTags();
        return true;
      }
    }
    return false;
  }
  function selectAt(px, py) {
    if (tapButton(px, py)) return;
    // Детали на картинке перекрывают друг друга. Под пальцем собираем все детали сверху вниз:
    // первое касание выбирает верхнюю, повторное касание того же места — следующую под ней.
    // Детали нарисованы контурами: между линиями пусто, и палец часто попадает в промежуток.
    // Поэтому ищем детали в круге вокруг пальца — сначала точно под ним, потом кольцами до 26 px.
    const ids = [];
    const collect = (x, y) => {
      for (const el of document.elementsFromPoint(x, y)) {
        const n = el.closest && el.closest("[data-pick]");
        if (n && layer.contains(n) && !ids.includes(n.dataset.pick)) ids.push(n.dataset.pick);
      }
    };
    collect(px, py);
    for (const r of [6, 12, 19, 26]) {
      // Хватит искать, если нашли что-то кроме уже выбранной детали.
      if (ids.some((id) => id !== state.select)) break;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        collect(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
    }
    if (!ids.length) {
      // Пустое место (рядом ни одной детали): снять выделение.
      if (state.select) {
        takeOver();
        apply({ select: "" });
        lastTap = null;
        placeTags();
        explainSelected();
      }
      return;
    }
    // Новое место — верхняя деталь под пальцем. Касание того же места ещё раз — слой глубже (по кругу).
    // «То же место» — рядом с прошлым касанием и сверху та же деталь (на маленьком экране соседние детали близко).
    const same = lastTap && Math.hypot(px - lastTap.x, py - lastTap.y) < 14 && ids[0] === lastTap.ids[0] && lastTap.ids[lastTap.i] === state.select;
    let i = same ? (lastTap.i + 1) % lastTap.ids.length : 0;
    const list = same ? lastTap.ids : ids;
    if (!same && list[0] === state.select && list.length > 1) i = 1; // нажали на уже выбранную — сразу слой ниже
    const next = list[i];
    lastTap = { x: px, y: py, ids: list, i };
    takeOver();
    if (next === state.select) ctl.pick(next, state, apply); // под пальцем только эта деталь — снять выбор
    else apply({ select: next });
    placeTags(); // название выбранной детали — сразу, не ждём кадра
    explainSelected();
  }
  // Выбор детали. На телефонах выбираем прямо по отпусканию пальца (короткое касание почти без сдвига),
  // не дожидаясь «click»: некоторые браузеры Android его не присылают или присылают с задержкой.
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    if (e.isPrimary) tapDown = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), n: 1 };
    else if (tapDown) tapDown.n = 2; // второй палец — это щипок, не выбор
  });
  stage.addEventListener("pointerup", (e) => {
    const d = tapDown;
    if (e.pointerType === "mouse" || !d || d.id !== e.pointerId) return;
    tapDown = null;
    if (d.n > 1 || e.target.closest(".zoom-ui, .fig-tools")) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || performance.now() - d.t > 700) return;
    // Номер детали: на сенсорном экране он сам палец не ловит (браузер иначе «притягивает» касание
    // к ближайшей кнопке, и тап по детали попадает в соседний номер) — попадание считаем здесь.
    const mi = markAt(d.x, d.y);
    if (mi >= 0) {
      tapDone = performance.now();
      focusKey(mi);
      return;
    }
    if (e.target.closest(".fig-labels")) return;
    tapDone = performance.now();
    if (ctl.pick) selectAt(d.x, d.y);
    else if (!tapButton(d.x, d.y)) tapLabel(d.x, d.y);
  });
  stage.addEventListener("pointercancel", () => (tapDown = null));
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".fig-labels, .zoom-ui") || (!ctl.pick && e.target.closest("[data-drag]"))) return;
    if (performance.now() - tapDone < 800) return; // уже выбрали по касанию
    if (ctl.pick) selectAt(e.clientX, e.clientY);
    else if (!tapButton(e.clientX, e.clientY)) tapLabel(e.clientX, e.clientY);
  });
  // Наведение мышью показывает название детали (на телефоне — только выбор касанием).
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !ctl.pick) return;
    const node = e.target.closest("[data-pick]");
    const id = node ? node.dataset.pick : "";
    if (id !== hoverPick) {
      hoverPick = id;
      placeTags();
    }
  });
  stage.addEventListener("pointerleave", () => {
    if (hoverPick) {
      hoverPick = "";
      placeTags();
    }
  });
  if (typeof IntersectionObserver === "function")
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run();
    }, { rootMargin: "120px 0px" }).observe(stage);
  else visible = true;
  build();
  syncControls();
  syncLabelsBtn();
  run();
  return {
    state,
    look: (ids = [], touch = []) => {
      lookIds = ids || [];
      touchIds = touch || [];
      applyLook();
    },
    set: (patch) => {
      takeOver();
      apply(patch);
    },
    preset: (patch) => {
      Object.assign(state, fig.defaults, patch);
      build();
      syncControls();
      touring = false;
      run();
    },
  };
}
