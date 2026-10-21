// Маленькие интерактивы внутри разделов глав (поле w у раздела): стики, мотор, батарея, диполь, КСВ, светодиоды, видео.
import { slider, choice, stick, clamp, fmt, esc, shuffle } from "./labkit.mjs";

// ── Интерактивы ──
const W = { sticks, motor, pack, cell, dipole, swr, leds, vrx };
const TASK = {
  sticks: "тяни кружки на квадратах пальцем. Левый — газ и поворот носа, правый — наклоны. Смотри, как двигается дрон и какая ось подсвечивается.",
  motor: "впиши 4 цифры с мотора и его KV, выбери батарею — получишь размеры статора и обороты.",
  cell: "выбери тип банки и двигай напряжение — увидишь, что оно значит и что делать. Ниже впиши наклейку — увидишь, на какие типы она похожа.",
  pack: "выбери тип банки и двигай S и P — смотри, как меняются вольты, ёмкость и число проводов балансира.",
  dipole: "нажми частоту или впиши свою — увидишь длину волны и диполь на линейке. Или наоборот: впиши длину диполя.",
  swr: "двигай три ползунка: КСВ → сколько мощности теряется; во сколько раз мощнее → во сколько раз дальше; dBm → милливатты.",
  leds: "выбери устройство. «Справочник» — что значит каждый огонёк; «Угадай по огоньку» — проверь себя.",
  vrx: "впиши частоту — узнаешь диапазон и канал. Ниже впиши свои числа калибровки min и max — получишь оценку.",
};
export function mountNotes(root) {
  root.querySelectorAll(".nw[data-w]").forEach((el) => {
    const f = W[el.dataset.w];
    if (!f || el.dataset.ready) return;
    el.dataset.ready = "1";
    try {
      f(el);
      if (TASK[el.dataset.w]) el.insertAdjacentHTML("afterbegin", `<p class="nw-task"><b>Что сделать:</b> ${TASK[el.dataset.w]}</p>`);
    } catch (e) {
      el.innerHTML = `<p class="muted small">Интерактив не запустился: ${esc(e.message)}</p>`;
    }
  });
}
const box = (el, cls = "") => {
  el.classList.add("nw-on");
  if (cls) el.classList.add(cls);
  return el;
};
const out = (el, html) => {
  const d = document.createElement("div");
  d.className = "nw-out";
  d.innerHTML = html;
  el.appendChild(d);
  return d;
};

// Mode 2: два стика и вид дрона сверху.
function sticks(el) {
  box(el, "nw-sticks");
  let L = [0, -1], R = [0, 0], yaw = 0, raf = 0;
  el.innerHTML = `<svg class="nw-drone" viewBox="-80 -80 160 160" role="img" aria-label="Дрон, вид сверху"><g class="nw-dr"><line x1="-34" y1="-34" x2="34" y2="34"/><line x1="34" y1="-34" x2="-34" y2="34"/><circle cx="-34" cy="-34" r="16"/><circle cx="34" cy="-34" r="16"/><circle cx="-34" cy="34" r="16"/><circle cx="34" cy="34" r="16"/><rect x="-12" y="-16" width="24" height="32" rx="5"/><path d="M-7 -22 L0 -32 L7 -22 Z" class="nw-nose"/></g></svg>`;
  const pads = document.createElement("div");
  pads.className = "lab-row nw-pads";
  el.appendChild(pads);
  const o = out(el, "");
  const dr = el.querySelector(".nw-dr");
  const word = (v, neg, pos) => (Math.abs(v) < 0.08 ? "центр" : `${v < 0 ? neg : pos} ${Math.round(Math.abs(v) * 100)} %`);
  const draw = () => {
    const thr = (L[1] + 1) / 2;
    dr.setAttribute("transform", `translate(${(R[0] * 22).toFixed(1)} ${(-R[1] * 22).toFixed(1)}) rotate(${yaw.toFixed(1)}) scale(${(0.8 + thr * 0.35).toFixed(3)})`);
    o.innerHTML = `<div class="nw-axes"><span class="${thr > 0.04 ? "on" : ""}"><b>Газ</b> Throttle · левый ↕<i>${Math.round(thr * 100)} %</i></span><span class="${Math.abs(L[0]) > 0.08 ? "on" : ""}"><b>Рыскание</b> Yaw / Rudder · левый ↔<i>${word(L[0], "влево", "вправо")}</i></span><span class="${Math.abs(R[1]) > 0.08 ? "on" : ""}"><b>Тангаж</b> Pitch / Elevator · правый ↕<i>${word(R[1], "нос вверх, назад", "нос вниз, вперёд")}</i></span><span class="${Math.abs(R[0]) > 0.08 ? "on" : ""}"><b>Крен</b> Roll / Aileron · правый ↔<i>${word(R[0], "влево", "вправо")}</i></span></div>`;
  };
  // Рыскание крутит нос, пока стик отклонён.
  const spin = () => {
    raf = 0;
    if (Math.abs(L[0]) < 0.08 || !el.isConnected) return;
    yaw = (yaw + L[0] * 3) % 360;
    draw();
    raf = requestAnimationFrame(spin);
  };
  stick(pads, { label: "Левый: газ и рыскание", spring: [true, false], value: L, onMove: (v) => { L = v; draw(); if (!raf) raf = requestAnimationFrame(spin); } });
  stick(pads, { label: "Правый: тангаж и крен", spring: [true, true], value: R, onMove: (v) => { R = v; draw(); } });
  draw();
}

// Мотор: код статора и KV → размеры и обороты.
function motor(el) {
  box(el);
  const V = [["16.8", "4S LiPo полная · 16,8 В"], ["22.2", "6S номинал · 22,2 В"], ["25.2", "6S LiPo полная · 25,2 В"], ["26.1", "6S LiHV полная · 26,1 В"], ["33.6", "8S LiPo полная · 33,6 В"]];
  const s = { code: "2812", kv: 900, v: 25.2 };
  el.innerHTML = `<div class="nw-row"><label>Код мотора <input type="text" inputmode="numeric" maxlength="4" value="${s.code}" data-k="code"></label><label>KV <input type="number" min="100" max="5000" step="50" value="${s.kv}" data-k="kv"></label></div>`;
  choice(el, { label: "Батарея", options: V, value: "25.2", onPick: (v) => { s.v = Number(v); draw(); } });
  const o = out(el, "");
  const draw = () => {
    const m = /^(\d{2})(\d{2})$/.exec(s.code.trim());
    const rpm = s.kv * s.v;
    o.innerHTML = `${m ? `<p><b>Статор:</b> диаметр ${Number(m[1])} мм, высота ${Number(m[2])} мм.</p>` : `<p class="muted">Код — 4 цифры: первые две — диаметр статора, вторые — высота (мм).</p>`}<p class="nw-big">${fmt(s.kv)} × ${fmt(s.v, 1)} В = <b>${fmt(rpm)} об/мин</b></p><p class="muted small">Без нагрузки; с пропеллером меньше.</p>`;
  };
  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k === "code") s.code = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (k === "kv") s.kv = clamp(Number(e.target.value) || 0, 0, 10000);
    draw();
  });
  draw();
}

// Сборка батареи: тип банки, S, P, ёмкость.
const CELL = { lipo: { n: "LiPo", max: 4.2, nom: 3.7, warn: 3.5, min: 3.3, mah: 1300 }, lihv: { n: "LiHV", max: 4.35, nom: 3.8, warn: 3.5, min: 3.3, mah: 1300 }, liion: { n: "Li-Ion", max: 4.2, nom: 3.65, warn: 3.5, min: 3.3, mah: 3000 } };
function pack(el) {
  box(el);
  const s = { t: "lipo", S: 6, P: 1, mah: 1300 };
  const ctl = document.createElement("div");
  ctl.className = "nw-ctl";
  el.appendChild(ctl);
  let capS;
  choice(ctl, { label: "Банка", options: Object.entries(CELL).map(([k, c]) => [k, c.n]), value: "lipo", onPick: (v) => { s.t = v; s.mah = CELL[v].mah; capS.set(s.mah); draw(); } });
  slider(ctl, { label: "S — последовательно", min: 1, max: 12, value: 6, onInput: (v) => { s.S = v; draw(); } });
  slider(ctl, { label: "P — параллельно", min: 1, max: 4, value: 1, onInput: (v) => { s.P = v; draw(); } });
  capS = slider(ctl, { label: "Ёмкость одной банки", min: 500, max: 5000, step: 100, value: 1300, fmt: (v) => `${fmt(v)} мА·ч`, onInput: (v) => { s.mah = v; draw(); } });
  const pic = document.createElement("div");
  pic.className = "nw-cells";
  el.appendChild(pic);
  const o = out(el, "");
  const draw = () => {
    const c = CELL[s.t];
    const cw = Math.min(26, 300 / s.S), ch = 34, gap = 6;
    const W2 = s.S * cw + 20, H = s.P * (ch + gap) + 18;
    let g = "";
    for (let p = 0; p < s.P; p++) for (let i = 0; i < s.S; i++) g += `<rect x="${10 + i * cw + 1}" y="${8 + p * (ch + gap)}" width="${cw - 3}" height="${ch}" rx="3"/>`;
    pic.innerHTML = `<svg viewBox="0 0 ${W2} ${H}" style="max-width:${Math.min(W2 * 1.6, 520)}px" role="img" aria-label="${s.S} банок в ряд, ${s.P} ряд(а) параллельно">${g}</svg>`;
    const cap = s.mah * s.P;
    o.innerHTML = `<p class="nw-big"><b>${s.S}S${s.P}P</b> · ${c.n} · ${fmt(cap)} мА·ч</p><div class="nw-volts">${[["Полная", c.max, 2], ["Номинал", c.nom, 1], ["Пора садиться", c.warn, 1], ["Минимум", c.min, 1]].map(([n, v, d]) => `<span><small>${n}</small><b>${fmt(v * s.S, d)} В</b><i>${fmt(v, 2)} × ${s.S}</i></span>`).join("")}</div><p>Проводов в балансире: <b>${s.S + 1}</b> (банок = проводов − 1). Энергия ≈ ${fmt((c.nom * s.S * cap) / 1000, 0)} Вт·ч.</p>`;
  };
  draw();
}

// Линейка одной банки: напряжение → состояние и действие; наклейка → тип.
const CHEM = {
  lipo: { n: "LiPo", max: 4.2, nom: 3.7, st: [3.8, 3.85], dmg: 3.0 },
  lihv: { n: "LiHV", max: 4.35, nom: 3.8, st: [3.83, 3.87], dmg: 3.0 },
  liuhv: { n: "LiUHV", max: 4.45, nom: 3.85, st: [3.83, 3.9], dmg: 3.0 },
  liion: { n: "Li-ion", max: 4.2, nom: 3.65, st: [3.7, 3.8], dmg: 2.5 },
};
function cellZone(v, c, load) {
  if (v > c.max + 0.015) return ["bad", "Перезаряд", `выше полного для ${c.n} (${fmt(c.max, 2)} В). Банка деградирует, растёт риск пожара. Так бывает, если зарядить в режиме «старшего» типа.`];
  if (v >= c.max - 0.015) return ["ok", "Полная", "сразу после зарядки. На полку в таком виде не кладут — перевести в Storage."];
  if (v > c.st[1]) return ["ok", "Заряжена", "можно летать."];
  if (v >= c.st[0]) return ["ok", "Хранение (Storage)", "так батарею кладут на полку и возят."];
  if (v >= c.nom - 0.02) return ["ok", "Номинал", "средняя точка разряда — это число пишут на наклейке."];
  // Учебный порог курса: 3,5 В под газом — садиться; 3,5 В в покое — почти пустая (как в тексте главы).
  if (v > 3.505) return load ? (v < 3.6 ? ["warn", "Скоро садиться", "под газом приближаешься к 3,5 В — готовься к возврату."] : ["ok", "Ниже номинала", "летать можно, но заряд заметно израсходован."]) : ["ok", "Ниже номинала", "заряд заметно израсходован; сколько точно осталось, по одному напряжению не сказать. После полёта — на зарядку."];
  if (v >= 3.3) return ["warn", load ? "Пора садиться" : "Почти пустая", load ? "под газом 3,5 В и ниже — сажай дрон сейчас: дальше мощности мало, дрон вялый и нестабилен." : "в покое 3,5 В и ниже — батарея почти разряжена, на зарядку."];
  if (v >= c.dmg) return ["bad", "Переразряд", "ниже минимума курса 3,3 В. Банка теряет ёмкость и вздувается."];
  return ["bad", "Повреждение", `ниже ${fmt(c.dmg, 1)} В банка, скорее всего, испорчена. Не заряжать — к преподавателю.`];
}
function cell(el) {
  box(el);
  const s = { t: "lipo", v: 3.85, load: false, S: 6, lv: 22.2 };
  const ctl = document.createElement("div");
  ctl.className = "nw-ctl";
  el.appendChild(ctl);
  choice(ctl, { label: "Банка", options: Object.entries(CHEM).map(([k, c]) => [k, c.n]), value: "lipo", onPick: (v) => { s.t = v; draw(); } });
  slider(ctl, { label: "Напряжение банки", min: 2.8, max: 4.5, step: 0.01, value: s.v, fmt: (v) => `${fmt(v, 2)} В`, onInput: (v) => { s.v = v; draw(); } });
  choice(ctl, { label: "Когда меряем", options: [["rest", "В покое"], ["load", "В полёте, под газом"]], value: "rest", onPick: (v) => { s.load = v === "load"; draw(); } });
  const pic = document.createElement("div");
  pic.className = "nw-cellbar";
  el.appendChild(pic);
  const o = out(el, "");
  const part = document.createElement("div");
  part.className = "nw-part";
  part.innerHTML = `<p><b>Тип по наклейке.</b> Впиши число банок и номинальное напряжение с наклейки.</p><div class="nw-row"><label>Банок (S) <input type="number" min="1" max="14" step="1" value="${s.S}" data-k="S"></label><label>Напряжение на наклейке, В <input type="number" min="3" max="60" step="0.1" value="${s.lv}" data-k="lv"></label></div>`;
  el.appendChild(part);
  const o2 = out(part, "");
  part.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) { s[k] = Number(e.target.value); guess(); } });
  const X = (v) => 12 + ((clamp(v, 2.8, 4.5) - 2.8) / 1.7) * 456;
  const draw = () => {
    const c = CHEM[s.t];
    const marks = [[c.dmg, "повр."], [3.3, "мин."], [3.5, "садиться"], [c.nom, "номинал"], [c.st[0], "хранение"], [c.max, "полная"]];
    const bands = [[2.8, c.dmg, "bad"], [c.dmg, 3.3, "bad"], [3.3, 3.5, "warn"], [3.5, c.max, "ok"], [c.max, 4.5, "bad"]];
    pic.innerHTML = `<svg viewBox="0 0 480 78" role="img" aria-label="Линейка напряжения банки ${c.n}">${bands.map(([a, b, k]) => `<rect x="${X(a)}" y="22" width="${Math.max(0, X(b) - X(a))}" height="12" class="nw-z ${k}"/>`).join("")}<rect x="${X(c.st[0])}" y="22" width="${X(c.st[1]) - X(c.st[0])}" height="12" class="nw-z st"/>${marks.map(([v, t], i) => `<line x1="${X(v)}" y1="18" x2="${X(v)}" y2="38" class="nw-tick"/><text x="${X(v)}" y="${i % 2 ? 52 : 64}" text-anchor="middle">${fmt(v, 2)}</text><text x="${X(v)}" y="${i % 2 ? 12 : 76}" text-anchor="middle" class="nw-tl">${t}</text>`).join("")}<path d="M${X(s.v)} 36 l-6 -14 h12 Z" class="nw-ptr"/></svg>`;
    const [k, name, what] = cellZone(s.v, c, s.load);
    o.innerHTML = `<p class="nw-big"><b>${fmt(s.v, 2)} В</b> · ${c.n} · <span class="nw-st ${k}">${name}</span></p><p>${what}</p><p class="muted small">У батареи 6S это ${fmt(s.v * 6, 1)} В. Под газом напряжение проседает, после посадки «отскакивает» вверх: 3,5 В в полёте и 3,5 В в покое — разные батареи.</p>`;
  };
  // Номинал даёт только предположение: диапазоны пересекаются (3,7 В — и LiPo, и Li-ion).
  const NOM = [["LiPo", 3.7, 3.7], ["LiHV", 3.8, 3.8], ["LiUHV", 3.85, 3.85], ["Li-ion (в т. ч. плоские призматические)", 3.6, 3.7]];
  const guess = () => {
    const per = s.lv / Math.max(1, s.S);
    const fit = NOM.filter(([, lo, hi]) => per >= lo - 0.03 && per <= hi + 0.03).map(([n]) => n);
    o2.innerHTML = fit.length
      ? `<p class="nw-big">${fmt(per, 2)} В на банку → похоже на: <b>${fit.join(" или ")}</b></p><p>Это только предположение: номиналы разных типов совпадают или почти совпадают. Тип проверяют по маркировке, модели батареи и допустимому напряжению заряда — режим зарядника выбирают по ним, а не по этой подсказке.</p>`
      : `<p class="nw-big">${fmt(per, 2)} В на банку</p><p>Не похоже на номинал известного типа (3,6–3,7 · 3,8 · 3,85). Проверь число банок: может, на наклейке напряжение полной батареи — тогда дели на 4,2 / 4,35 / 4,45.</p>`;
  };
  draw();
  guess();
}

// Диполь: частота ↔ длина.
function dipole(el) {
  box(el);
  const P = [433, 600, 868, 915, 1200, 2400, 5800];
  const s = { f: 868 };
  el.innerHTML = `<div class="nw-row"><label>Частота, МГц <input type="number" min="300" max="6000" step="1" value="${s.f}" data-k="f"></label><label>или длина диполя, см <input type="number" min="2" max="50" step="0.5" placeholder="например 25" data-k="l"></label></div>`;
  const pre = document.createElement("div");
  pre.className = "lab-row nw-pre";
  pre.innerHTML = P.map((f) => `<button type="button" data-f="${f}">${f >= 1000 ? fmt(f / 1000, 1) + " ГГц" : f + " МГц"}</button>`).join("");
  el.appendChild(pre);
  const pic = document.createElement("div");
  el.appendChild(pic);
  const o = out(el, "");
  const draw = (fromLen) => {
    const f = fromLen ? 300 / (2 * (fromLen / 100)) : clamp(s.f, 300, 6000);
    const lam = 300 / f, half = lam / 2;
    const cm = half * 100, k = 9; // 1 см = 9 единиц, линейка 0–50 см
    const len = Math.min(cm, 50) * k;
    pic.innerHTML = `<svg class="nw-dip" viewBox="0 0 470 84" role="img" aria-label="Диполь в масштабе"><line x1="10" y1="56" x2="460" y2="56" class="nw-ruler"/>${[0, 10, 20, 30, 40, 50].map((c) => `<line x1="${10 + c * k}" y1="52" x2="${10 + c * k}" y2="60" class="nw-ruler"/><text x="${10 + c * k}" y="80" text-anchor="middle">${c}</text>`).join("")}<line x1="10" y1="32" x2="${10 + len / 2 - 3}" y2="32" class="nw-arm"/><line x1="${10 + len / 2 + 3}" y1="32" x2="${10 + len}" y2="32" class="nw-arm"/><circle cx="${10 + len / 2}" cy="32" r="5" class="nw-feed"/><text x="${10 + len / 2}" y="18" text-anchor="middle">${fmt(cm, 1)} см</text></svg>`;
    o.innerHTML = `<p class="nw-big">Длина волны: <b>${fmt(lam * 100, 1)} см</b></p><p>Диполь ½ λ = <b>${fmt(cm, 1)} см</b> (каждое плечо ¼ λ = ${fmt(cm / 2, 1)} см).${fromLen ? ` Диполь ${fmt(fromLen, 1)} см соответствует примерно <b>${fmt(f)} МГц</b>.` : ""}</p>`;
  };
  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k === "f") { s.f = Number(e.target.value) || 0; draw(); }
    if (k === "l") {
      const l = Number(e.target.value);
      if (l > 0) {
        s.f = Math.round(300 / (2 * (l / 100)));
        el.querySelector('[data-k="f"]').value = clamp(s.f, 300, 6000);
        draw(l);
      }
    }
  });
  pre.addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    s.f = Number(b.dataset.f);
    el.querySelector('[data-k="f"]').value = s.f;
    el.querySelector('[data-k="l"]').value = "";
    draw();
  });
  draw();
}

// КСВ → потери; мощность → дальность; dBm ↔ мВт.
const SWR_T = [[1, 0], [1.2, 1], [1.5, 4], [1.8, 8], [2, 10], [2.4, 17], [3, 25], [4, 36], [5, 44]];
function swr(el) {
  box(el);
  const s = { k: 1.5, p: 4, dbm: 23 };
  const a = document.createElement("div"), b = document.createElement("div"), c = document.createElement("div");
  a.className = b.className = c.className = "nw-part";
  el.append(a, b, c);
  slider(a, { label: "КСВ", min: 1, max: 5, step: 0.1, value: s.k, fmt: (v) => fmt(v, 1), onInput: (v) => { s.k = v; draw(); } });
  const oa = out(a, "");
  slider(b, { label: "Мощность передатчика, во сколько раз больше", min: 1, max: 16, step: 1, value: s.p, fmt: (v) => `×${v}`, onInput: (v) => { s.p = v; draw(); } });
  const ob = out(b, "");
  slider(c, { label: "Мощность, dBm", min: 0, max: 36, step: 1, value: s.dbm, fmt: (v) => `${v} dBm`, onInput: (v) => { s.dbm = v; draw(); } });
  const oc = out(c, "");
  const draw = () => {
    const g = (s.k - 1) / (s.k + 1), r = g * g;
    const near = SWR_T.reduce((m, x) => (Math.abs(x[0] - s.k) < Math.abs(m[0] - s.k) ? x : m));
    oa.innerHTML = `<p class="nw-big">((${fmt(s.k, 1)} − 1) / (${fmt(s.k, 1)} + 1))² = <b>${fmt(r * 100, 1)} %</b> отражается</p><div class="nw-bar"><i style="width:${(100 - r * 100).toFixed(1)}%"></i><b style="width:${(r * 100).toFixed(1)}%"></b></div><p class="muted small">До антенны доходит ${fmt(100 - r * 100, 1)} %. В таблице конспекта ближе всего: КСВ ${fmt(near[0], 1)} → ${near[1]} %. ${s.k <= 1.5 ? "КСВ до 1,5 — хорошая антенна." : s.k >= 3 ? "КСВ 3 и выше — плохо: передатчик греется." : "Терпимо, но лучше подобрать антенну."}</p>`;
    ob.innerHTML = `<p class="nw-big">Дальность × √${s.p} = <b>×${fmt(Math.sqrt(s.p), 2)}</b></p><p class="muted small">+${fmt(10 * Math.log10(s.p), 1)} дБ; в открытом пространстве.</p>`;
    const mw = Math.pow(10, s.dbm / 10);
    oc.innerHTML = `<p class="nw-big">${s.dbm} dBm = <b>${mw >= 1000 ? fmt(mw / 1000, 2) + " Вт" : fmt(mw, mw < 10 ? 1 : 0) + " мВт"}</b></p><p class="muted small">0 dBm = 1 мВт; каждые +10 dBm — мощность ×10, каждые +3 dBm — примерно ×2.</p>`;
  };
  draw();
}

// Светодиоды TBS и ELRS: справочник и «угадай».
const LED = {
  tbstx: { n: "Передатчик TBS (модуль)", st: [["g", "Зелёный горит ровно", "Бинд есть, связь в порядке"], ["gb", "Зелёный мигает", "Идёт биндинг"], ["y", "Жёлтый (оранжевый)", "Бинда нет"], ["c", "Синий (бирюзовый)", "Запрос на прошивку приёмника: нажми, чтобы согласиться"], ["br", "Мигает синий / красный", "Ошибка прошивки"]] },
  tbsrx: { n: "Приёмник TBS", st: [["g", "Зелёный горит ровно", "Бинд есть"], ["gb", "Зелёный медленно мигает", "Режим поиска (биндинг)"], ["r", "Красный горит", "Бинда нет"], ["rb", "Красный мигает", "Несовпадение прошивки"]] },
  elrsrx: { n: "Приёмник ELRS", st: [["s", "Горит ровно", "Связь с пультом есть"], ["slow", "Медленно мигает", "Ждёт связи с пультом"], ["fast", "Быстро мигает", "Раздаёт Wi-Fi (режим настройки)"], ["dbl", "Двойные вспышки", "Режим бинда"], ["tri", "Тройные вспышки", "Связь есть, но не совпал номер модели (Model Match)"]] },
};
function leds(el) {
  box(el, "nw-leds");
  const s = { dev: "tbstx", mode: "ref", q: null, msg: "" };
  choice(el, { label: "Устройство", options: Object.entries(LED).map(([k, d]) => [k, d.n]), value: s.dev, onPick: (v) => { s.dev = v; s.q = null; s.msg = ""; draw(); } });
  choice(el, { label: "Режим", options: [["ref", "Справочник"], ["quiz", "Угадай по огоньку"]], value: s.mode, onPick: (v) => { s.mode = v; s.q = null; s.msg = ""; draw(); } });
  const o = out(el, "");
  const lamp = (k) => `<span class="nw-led" data-l="${k}" aria-hidden="true"></span>`;
  const draw = () => {
    const d = LED[s.dev];
    if (s.mode === "ref") {
      o.innerHTML = `<ul class="nw-ledlist">${d.st.map(([k, a, b]) => `<li>${lamp(k)}<span><b>${esc(a)}</b><br>${esc(b)}</span></li>`).join("")}</ul>${s.dev === "elrsrx" ? `<p class="muted small">По документации ELRS; узоры могут отличаться у разных приёмников и версий; цвет диода у ELRS бывает разный.</p>` : ""}`;
      return;
    }
    if (!s.q) s.q = d.st[Math.floor(Math.random() * d.st.length)];
    const opts = shuffle(d.st, Date.now());
    o.innerHTML = `<div class="nw-quiz">${lamp(s.q[0])}<p>Что значит этот сигнал на устройстве «${esc(d.n)}»?</p></div><div class="lab-col">${opts.map(([k, , b]) => `<button type="button" class="lab-btn" data-a="${k}">${esc(b)}</button>`).join("")}</div>${s.msg ? `<p class="nw-msg">${s.msg}</p>` : ""}`;
  };
  o.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]");
    if (!b || !s.q) return;
    const ok = b.dataset.a === s.q[0];
    s.msg = ok ? `✓ Верно: ${esc(s.q[1])} — ${esc(s.q[2]).toLowerCase()}. Следующий огонёк.` : `✗ Нет. ${esc(s.q[1])} — это «${esc(s.q[2])}». Попробуй следующий.`;
    s.q = null;
    draw();
  });
  draw();
}

// Частота видео → диапазон и канал; оценка калибровки видеоприёмника.
const BANDS = [[5555, 5945, "5,8 ГГц"], [4900, 5555, "4,9 ГГц"], [4200, 4380, "4,2 ГГц"], [3260, 3420, "3,3 ГГц"], [2240, 2480, "2,4 ГГц"], [1040, 1880, "1,3 ГГц"]];
const TABLES = [
  ["VTX 1,2 ГГц", [910, 980, 1010, 1040, 1080, 1120, 1160, 1200, 1240, 1280, 1320, 1360], (i) => `${i.toString(16).toUpperCase()}</b> (${i + 1}-й по счёту)<b>`],
  ["VTX 1,5 ГГц", [1405, 1430, 1455, 1480, 1505, 1530, 1555, 1580, 1630, 1655, 1680], (i) => `${i.toString(16).toUpperCase()}</b> (${i + 1}-й по счёту)<b>`],
  ["Race Band 5,8 ГГц", [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917], (i) => `R${i + 1}`],
];
function vrx(el) {
  box(el);
  const s = { f: 5800, a: [176, 910], b: [284, 1024] };
  el.innerHTML = `<div class="nw-row"><label>Частота видео, МГц <input type="number" min="800" max="6200" step="1" value="${s.f}" data-k="f"></label></div>`;
  const o1 = out(el, "");
  const cal = document.createElement("div");
  cal.className = "nw-cal";
  cal.innerHTML = `<b>Калибровка RSSI очков</b><div class="nw-row">${["a", "b"].map((x) => `<label>Антенна ${x.toUpperCase()}: min <input type="number" min="0" max="2000" value="${s[x][0]}" data-c="${x}0"></label><label>max <input type="number" min="0" max="2000" value="${s[x][1]}" data-c="${x}1"></label>`).join("")}</div>`;
  el.appendChild(cal);
  const o2 = out(el, "");
  const gmin = (v) => (v <= 300 ? ["отлично", "ok"] : v <= 450 ? ["терпимо: проверь, что все передатчики выключены", "warn"] : ["много фона: рядом работает передатчик?", "bad"]);
  const gmax = (v) => (v >= 1100 ? ["отлично", "ok"] : v >= 1000 ? ["хорошо", "ok"] : v >= 900 ? ["нормально", "warn"] : ["мало: проверь частоту и мощность борта", "bad"]);
  const draw = () => {
    const f = s.f;
    const bands = BANDS.filter(([a, b]) => f >= a && f <= b).map((x) => x[2]);
    const hits = [];
    for (const [n, list, name] of TABLES) {
      const i = list.findIndex((x) => Math.abs(x - f) <= 2);
      if (i >= 0) hits.push(`${n}: канал <b>${name(i)}</b>`);
    }
    o1.innerHTML = `<p class="nw-big">${fmt(f)} МГц → <b>${bands.length ? bands[0] : "вне диапазонов конспекта"}</b></p><p>${hits.length ? hits.join(" · ") : "В таблицах VTX 1,2 / 1,5 ГГц и Race Band такой частоты нет."}</p><p class="muted small">Попробуй 1360, 1505, 5658, 5917.</p>`;
    const row = (x) => {
      const [mn, mx] = s[x];
      const a = gmin(mn), b = gmax(mx);
      return `<li>Антенна ${x.toUpperCase()}: min ${mn} — <span class="nw-${a[1]}">${a[0]}</span>; max ${mx} — <span class="nw-${b[1]}">${b[0]}</span>; запас ${mx - mn}</li>`;
    };
    o2.innerHTML = `<ul>${row("a")}${row("b")}</ul><p class="muted small">Числа — в единицах прибора, пороги по конспекту.</p>`;
  };
  el.addEventListener("input", (e) => {
    if (e.target.dataset.k === "f") s.f = Number(e.target.value) || 0;
    const c = e.target.dataset.c;
    if (c) s[c[0]][Number(c[1])] = Number(e.target.value) || 0;
    draw();
  });
  draw();
}
