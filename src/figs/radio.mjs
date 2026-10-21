// Fig: радиотрасса. Две телескопические мачты на рельсе, между ними макет холма из террас
// и стоячий шаблон из оргстекла с гравировкой зоны Френеля. Длина антенн — четверть волны (в масштабе).
import { k, G, scene, basePlate, rulerStrip, labelPlate, knob, plug, TAU, fmt, clamp, labelsAt } from "../figkit.mjs";
import { radio } from "../models.mjs";

const W = 660, H = 390;
const PLATE = { x: -185, y: -70, w: 370, d: 140, r: 8 };
const TXX = -150, RXX = 150, LINK_Y = -8;
const VS = 4; // единиц на метр высоты (вертикальный масштаб преувеличен)
const BASE_Z = 14;
const TPL = { x: -132, y: -38, w: 264, d: 3, r: 0.8 }; // шаблон Френеля
const TPL_H = 92;
export const FREQS = [[433, "433 МГц"], [915, "915 МГц"], [2400, "2,4 ГГц"], [5800, "5,8 ГГц"]];
export const DISTS = [[500, "0,5 км"], [1000, "1 км"], [2000, "2 км"]];

export const meta = {
  id: "radio",
  title: "Радиотрасса",
  hint: "Холм — ползунок или ← →",
  keys: [
    { mark: "lit", label: "Антенны: длина ¼ λ в масштабе" },
    { mark: "raised", label: "Мачты, макет холма" },
    { mark: "edge", label: "Гравировка: линия прямой видимости, зона Френеля и её 60 %" },
  ],
  caption: "Сигнал идёт не по линии, а «толстым облаком» — зоной Френеля: r = √(λ·d/4) посередине трассы (закон). Холм, залезший в 60 % зоны, ослабляет связь, хотя дрон «видно». Высоты на макете показаны в другом масштабе, чем расстояние по сравнению с расстоянием. RSSI считается как мощность + усиления − потери в свободном пространстве − поляризация − КСВ − затенение (оценка).",
  try: [
    "Переключи 5,8 ГГц → 915 МГц: антенна станет длиннее, а зона Френеля толще — холм начнёт мешать.",
    "Подними мачты вместо мощности: часто это даёт больше, чем VTX 400 → 800 мВт.",
    "Поставь «противоположная поляризация»: потери 20–30 дБ съедят почти весь запас; убавь мощность до 25 мВт — и LQ рухнет.",
  ],
  missions: [
    { id: "block", look: ["hill","template"], touch: ["hill"], see: "линию прямой видимости на шаблоне",  text: "Подними холм так, чтобы он закрыл прямую линию", check: (f) => f.blocked >= 1 },
    { id: "mast", look: ["masts","template"], touch: ["txH","rxH"], see: "эллипс Френеля над холмом",  text: "При холме 8 м и выше освободи «зону Френеля», подняв мачты", check: (f, s) => s.hill >= 8 && f.blocked <= 0.1 },
    { id: "lost", look: ["indicator"], touch: ["pol","power"], see: "шкалу RSSI и LQ в показателях",  text: "Потеряй связь: доведи LQ ниже 50 %", check: (f) => f.lq < 50,
      predict: { q: "Трасса короткая, холм линию не закрыл. Что роняет LQ?", options: ["Только расстояние", "Противоположная поляризация и малая мощность вместе", "Более высокая мачта"], right: 1 },
      confirm: { q: "LQ ниже 50 % на короткой трассе — это про что?", options: ["Дрон слишком далеко", "Запас съели поляризация или мощность, не километры", "Сломался шаблон Френеля"], right: 1, miss: "Посмотри мощность и поляризацию: расстояние на этой трассе ни при чём." } },
    { id: "low", look: ["template","indicator"], touch: ["freq=915"], see: "запас связи в показателях",  text: "При холме 9 м и выше перейди с 5,8 ГГц на 915 МГц — запас вырастет", check: (f, s) => s.hill >= 9 && s.freq === 915 },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [TXX, LINK_Y, BASE_Z + 15 * VS + 40], [RXX, LINK_Y, BASE_Z + 15 * VS + 40], [TPL.x, TPL.y, BASE_Z + TPL_H], [TPL.x + TPL.w, TPL.y, BASE_Z + TPL_H]], W, H, { pad: 22, azimuth: 62 });
}

// Потери со знаком минус, но без «−0»: нулевые потери пишем просто как 0.
const loss = (v, d = 0) => {
  const t = fmt(v, d);
  return /[1-9]/.test(t) ? `−${t}` : t;
};
// Длина ¼ λ в масштабе (см → единицы): все четыре частоты помещаются без обрезки, ниже частота — длиннее антенна.
const quarterUnits = (f) => clamp((300 / f / 4) * 100 * 2.2, 2.5, 40);

function mast(S, x, y, h, P, side) {
  // Каретка на рельсе, три колена мачты, хомуты.
  S.box({ x: x - 16, y: y - 14, w: 32, d: 28, r: 3 }, 0, 6, { tone: "mid" }, { bevel: 0.6 });
  S.dots(k.corners({ x: x - 16, y: y - 14, w: 32, d: 28 }, 4).map(([a, b]) => [a, b, 6]), { size: 0.45 }, [x, y, 6.1]);
  const tz = BASE_Z + h * VS;
  const sec = [[4.6, 6, BASE_Z + 4], [3.4, BASE_Z + 4, BASE_Z + 4 + (tz - BASE_Z - 4) * 0.55], [2.4, BASE_Z + 4 + (tz - BASE_Z - 4) * 0.55, tz]];
  S.cyl(x, y, 7, 6, 3, { tone: "mid" });
  for (const [r, z0, z1] of sec) {
    S.cyl(x, y, r, z0, z1 - z0, { tone: "mid", crease: "none" }, { ref: [x, y, (z0 + z1) / 2] });
    S.cyl(x, y, r + 1.2, z1 - 2.4, 2.4, { tone: "hi" }, { ref: [x, y, z1 - 1] });
  }
  // Ручка-фиксатор на нижнем колене.
  S.box({ x: x + 4, y: y - 1.2, w: 4, d: 2.4, r: 0.6 }, BASE_Z, 2.4, { tone: "mid" }, { steps: 2, bias: 1 });
  S.cyl(x + 9, y, 2, BASE_Z - 1, 4.4, { tone: "mid", inner: k.lineSvg(k.knurl(x + 9, y, 2, BASE_Z - 1, BASE_Z + 3.4, 12, P), { tone: "lo" }) }, { bias: 1.2 });
  return tz;
}

function antenna(S, x, y, z, P, { type, f, lit }) {
  const L = quarterUnits(f);
  S.cyl(x, y, 3, z, 3, { tone: "mid", inner: k.lineSvg(k.knurl(x, y, 3, z, z + 3, 12, P), { tone: "lo" }) }, { ref: [x, y, z + 1.5] });
  if (type === "horizontal") {
    S.cyl(x, y, 1.6, z + 3, 3, { tone: "hi" });
    S.tube([[x - L / 2, y, z + 7], [x + L / 2, y, z + 7]], 1.1, { tone: lit ? "lit" : "hi", maxLength: 60 });
    S.solid(G.sphereOf([x, y, z + 7], 2, P), { tone: "hi" }, [x, y, z + 7], { bias: 1 });
    return z + 9;
  }
  if (type === "clover") {
    S.tube([[x, y, z + 3], [x, y, z + 3 + L * 0.6]], 0.9, { tone: "hi" });
    const c = [x, y, z + 3 + L * 0.6 + 5];
    S.solid(G.sphereOf(c, 6, P), { tone: "hi", lit }, c);
    S.line(G.arcOf(G.frameOf(c, [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 6, P), { tone: "faint" }, [c[0], c[1] + 6, c[2]], { bias: 0.4 });
    return c[2] + 6;
  }
  S.tube([[x, y, z + 3], [x, y, z + 3 + L]], 1.1, { tone: "hi", maxLength: 60 });
  S.solid(G.sphereOf([x, y, z + 3 + L], 1.6, P), { tone: "hi", lit }, [x, y, z + 3 + L], { bias: 0.5 });
  return z + 3 + L;
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  basePlate(S, PLATE);
  rulerStrip(S, { x: -170, y: PLATE.y + PLATE.d - 15, w: 340, d: 7, r: 1 }, { step: 4, every: 10 });
  labelPlate(S, { x: 120, y: PLATE.y + 8, w: 44, d: 18, r: 1.5 }, "LINK");
  S.group = "rail";
  // Рельс вдоль всей трассы.
  for (const dy of [-12, 10]) S.box({ x: -172, y: LINK_Y + dy, w: 344, d: 4, r: 1 }, 0, 2.5, { tone: "mid" }, { bevel: 0.3, layer: 0.4, steps: 2 });
  for (const x of [-176, 172]) S.box({ x, y: LINK_Y - 16, w: 4, d: 34, r: 1 }, 0, 6, { tone: "mid" }, { bevel: 0.4, layer: 0.5 });
  const r = radio(state);
  S.group = "template";
  // Шаблон Френеля на двух ножках позади линии связи.
  const z0 = BASE_Z;
  for (const x of [TPL.x + 12, TPL.x + TPL.w - 12]) S.box({ x: x - 8, y: TPL.y - 6, w: 16, d: 15, r: 2 }, 0, 6, { tone: "mid" }, { bevel: 0.4, layer: 0.55 });
  S.box(TPL, 6, TPL_H, { tone: "lo" }, { bevel: 0.3, ref: [0, TPL.y + 1.5, 50], layer: 0.55, bias: 1, steps: 2 });
  const fy = TPL.y + TPL.d;
  const txZ = BASE_Z + state.txH * VS, rxZ = BASE_Z + state.rxH * VS;
  const toTpl = (x) => clamp(x, TPL.x + 1, TPL.x + TPL.w - 1);
  // Линия прямой видимости и эллипсы (100 % и 60 %), в плоскости шаблона, обрезанные его краями.
  const ellipse = (frac) => {
    const pts = [];
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = TXX + (RXX - TXX) * u;
      const zc = txZ + (rxZ - txZ) * u;
      const rr = r.r1 * VS * frac * Math.sqrt(4 * u * (1 - u));
      pts.push([x, zc + rr]);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      const x = TXX + (RXX - TXX) * u;
      const zc = txZ + (rxZ - txZ) * u;
      const rr = r.r1 * VS * frac * Math.sqrt(4 * u * (1 - u));
      pts.push([x, zc - rr]);
    }
    return pts;
  };
  const clipId = "fz-clip";
  const tplFace = [[TPL.x, 6], [TPL.x + TPL.w, 6], [TPL.x + TPL.w, 6 + TPL_H], [TPL.x, 6 + TPL_H]].map(([x, z]) => at([x, fy, z]));
  const dOf = (pts) => "M" + pts.map(([x, z]) => at([x, fy, z]).map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
  let eng = `<clipPath id="${clipId}"><path d="M${tplFace.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/></clipPath><g clip-path="url(#${clipId})">`;
  eng += `<path class="fz-fill" data-part="fzfill" d="${dOf(ellipse(1))}"/>`;
  eng += k.lineSvg(dOf(ellipse(1)), { tone: "mid" }) + k.lineSvg(dOf(ellipse(0.6)), { tone: "lo", dashed: true });
  // Профиль холма, перенесённый на шаблон: так видно, залез ли он в зону.
  if (state.hill > 0) {
    const n = Math.max(1, Math.round(state.hill / 1.5));
    const hh = (state.hill * VS + BASE_Z - 2.5) / n; // холм рисуем от той же базы, что мачты и линия связи
    const prof = [[TPL.x, 6]];
    const steps = [];
    for (let i = 0; i < n; i++) steps.push({ half: (34 + 120 * (1 - i / n)) / 2, z: 2.5 + (i + 1) * hh });
    prof.push([6 - steps[0].half, 6]);
    for (const st of steps) prof.push([6 - st.half, prof[prof.length - 1][1]], [6 - st.half, st.z]);
    for (let i = steps.length - 1; i >= 0; i--) prof.push([6 + steps[i].half, steps[i].z], [6 + steps[i].half, i ? steps[i - 1].z : 6]);
    prof.push([TPL.x + TPL.w, 6]);
    eng += `<path class="hill-prof" d="${dOf(prof)}"/>` + k.lineSvg(dOf(prof), { tone: "mid" });
  }
  eng += k.lineSvg("M" + [[TXX, txZ], [RXX, rxZ]].map(([x, z]) => at([x, fy, z]).map((v) => v.toFixed(1)).join(" ")).join("L"), { tone: "hi" });
  eng += "</g>";
  S.raw([0, fy + 0.1, 50], eng, { layer: 0.55, bias: 2 });

  S.group = "hill";
  // Макет холма: террасы вокруг середины трассы.
  const hill = state.hill;
  const steps = Math.max(1, Math.round(hill / 1.5));
  for (let i = 0; i < steps; i++) {
    const f = 1 - i / steps;
    const w = 34 + 120 * f, d = 26 + 44 * f;
    const plan = { x: -w / 2 + 6, y: LINK_Y - d / 2 + 4, w, d, r: Math.min(12, d / 2) };
    const h = hill > 0 ? (hill * VS + BASE_Z - 2.5) / steps : 0;
    S.box(plan, 2.5 + i * h, h, { tone: i === steps - 1 ? "hi" : "mid" }, { steps: 8, bevel: 0.4, ref: [6, LINK_Y + 4, 2.5 + i * h + h / 2], layer: 0.6 + i * 0.01 });
  }
  if (hill > 0) {
    S.raw([6, LINK_Y + 4, BASE_Z + hill * VS + 1], `<g data-part="hilltop"></g>`, { layer: 0.7 });
    // Одинокие деревья на вершине (листва — для огибания на низких частотах).
    for (const [dx, dy] of [[-10, 2], [8, -4], [18, 6]]) {
      const zt = BASE_Z + hill * VS;
      S.cyl(6 + dx, LINK_Y + 4 + dy, 0.9, zt, 5, { tone: "mid" }, { layer: 0.71 });
      S.solid(G.sphereOf([6 + dx, LINK_Y + 4 + dy, zt + 8], 4.2, P, { steps: 24 }), { tone: "mid" }, [6 + dx, LINK_Y + 4 + dy, zt + 8], { layer: 0.72 });
    }
  }

  S.group = "masts";
  // Мачты и антенны.
  const tz = mast(S, TXX, LINK_Y, state.txH, P, "tx");
  const rz = mast(S, RXX, LINK_Y, state.rxH, P, "rx");
  const polTx = state.pol === "mixed" ? "clover" : "vertical";
  const polRx = state.pol === "cross" ? "horizontal" : state.pol === "mixed" ? "vertical" : "vertical";
  if (!state.open) antenna(S, TXX, LINK_Y, tz, P, { type: polTx, f: state.freq, lit: true });
  else S.cyl(TXX, LINK_Y, 3, tz, 3, { tone: "mid", inner: k.lineSvg(k.knurl(TXX, LINK_Y, 3, tz, tz + 3, 12, P), { tone: "lo" }) });
  antenna(S, RXX, LINK_Y, rz, P, { type: polRx, f: state.freq, lit: true });
  // Передатчик у подножия мачты, кабель вверх по мачте.
  const txBox = { x: TXX - 30, y: LINK_Y + 18, w: 26, d: 18, r: 2 };
  S.box(txBox, 0, 10, { tone: "mid", inner: k.lineSvg(k.sideSeam(txBox, 3, P, 3), { tone: "faint" }) }, { bevel: 0.6 });
  S.raw([txBox.x + 7, txBox.y + 9, 10.2], k.dotsSvg(k.dotGrid(txBox.x + 4, txBox.y + 4, 4, 4, 2.4, 10, P), { size: 0.4, tone: "lo" }));
  S.tube([[txBox.x + txBox.w, txBox.y + 6, 5], [TXX - 6, LINK_Y + 8, 8], [TXX - 4.2, LINK_Y + 2, BASE_Z + 6], [TXX - 3.2, LINK_Y + 1, tz - 6], [TXX - 1.5, LINK_Y, tz - 2]], 0.8, { tone: "mid", bendR: 5, maxLength: 20 });
  const rxBox = { x: RXX + 4, y: LINK_Y + 18, w: 26, d: 18, r: 2 };
  S.box(rxBox, 0, 10, { tone: "mid", inner: k.lineSvg(k.sideSeam(rxBox, 3, P, 3), { tone: "faint" }) }, { bevel: 0.6 });
  S.line(k.planOutline({ x: rxBox.x + 4, y: rxBox.y + 4, w: 12, d: 9, r: 1 }, 10, P, 2), { tone: "lo" }, [rxBox.x + 10, rxBox.y + 8, 10.1]);
  S.tube([[rxBox.x, rxBox.y + 6, 5], [RXX + 6, LINK_Y + 8, 8], [RXX + 4.2, LINK_Y + 2, BASE_Z + 6], [RXX + 3.2, LINK_Y + 1, rz - 6], [RXX + 1.5, LINK_Y, rz - 2]], 0.8, { tone: "mid", bendR: 5, maxLength: 20 });
  S.group = "indicator";
  // Индикатор уровня у приёмника — шкала RSSI (стрелка перестраивается).
  const dial = { c: [RXX - 4, LINK_Y + 46], R: 12 };
  S.box({ x: dial.c[0] - 9, y: dial.c[1] - 9, w: 18, d: 18, r: 3 }, 0, 4, { tone: "mid" });
  S.cyl(dial.c[0], dial.c[1], 3, 4, 4, { tone: "mid" });
  S.cyl(dial.c[0], dial.c[1], dial.R, 8, 6, { tone: "hi", crease: "lo" }, { bevel: 0.6 });
  const tk = k.radialTicks(dial.c[0], dial.c[1], dial.R - 1.6, 20, 5, 14, [1, 2.2], P, -2.2, 4.4);
  S.line(tk.minor, { tone: "lo" }, [dial.c[0], dial.c[1], 14.1]);
  S.line(tk.major, { tone: "mid" }, [dial.c[0], dial.c[1], 14.1]);
  S.line(k.ring(dial.c[0], dial.c[1], dial.R - 1.2, 14, P, 48), { tone: "lo" }, [dial.c[0], dial.c[1], 14.05]);
  S.raw([dial.c[0], dial.c[1], 30], `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d=""/>`, { bias: 50 });
  const needle = (t) => {
    const a = -2.2 + clamp(t, 0, 1) * 4.4;
    return k.lineOnTop([dial.c[0] - Math.sin(a) * 2, dial.c[1] + Math.cos(a) * 2], [dial.c[0] + Math.sin(a) * (dial.R - 3), dial.c[1] - Math.cos(a) * (dial.R - 3)], 14.2, P);
  };
  S.group = "template";
  // Пакеты по линии прямой видимости на шаблоне.
  S.raw([0, fy + 0.3, 60], `<g data-part="packets"></g>`, { layer: 0.55, bias: 3 });
  const los = [at([TXX, fy, txZ]), at([RXX, fy, rxZ])];
  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Радиотрасса на столе: две телескопические мачты с антеннами, между ними макет холма из террас, позади — шаблон из оргстекла с гравировкой зоны Френеля.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Передатчик", [TXX - 17, LINK_Y + 27, 10], "Источник радиоволн: чем больше мощность, тем дальше связь."],
    ["Антенна передатчика", [TXX, LINK_Y, BASE_Z + state.txH * VS + 8], "Длина антенны — четверть длины волны: ниже частота — длиннее антенна."],
    ["Приёмник", [RXX + 17, LINK_Y + 27, 10], "Принимает сигнал. Если сигнал слабее порога чувствительности, пакеты теряются."],
    ["Индикатор сигнала", [RXX - 4, LINK_Y + 46, 14], "Показывает силу сигнала (RSSI) на входе приёмника."],
    state.hill > 0 ? ["Холм", [0, LINK_Y + 20, BASE_Z + state.hill * VS * 0.7], "Холм, залезший в зону Френеля, ослабляет сигнал, даже если антенны «видят» друг друга."] : null,
    ["Зона Френеля на шаблоне", [0, TPL.y, BASE_Z + TPL_H * 0.8], "Вытянутая область вокруг линии связи. Если свободно 60 % её радиуса — потерь почти нет."],
  ]);
  return { svg, P, labels, live: { needle, los, model: r }, parts: S.count() };
}

export const defaults = { freq: 915, distance: 2000, txH: 6, rxH: 6, hill: 3, power: 100, pol: "same", open: false, rate: 50, gainRx: 2 };
export const controls = [
  { id: "hill", label: "Высота холма", type: "range", min: 0, max: 14, step: 0.5, fmt: (v) => `${fmt(v, 1)} м`, rebuild: true },
  { id: "freq", label: "Частота", type: "seg", options: FREQS, num: true, rebuild: true },
  { id: "distance", label: "Расстояние", type: "select", options: DISTS, num: true, rebuild: true },
  { id: "txH", label: "Мачта передатчика", type: "range", min: 1, max: 15, step: 0.5, fmt: (v) => `${fmt(v, 1)} м`, rebuild: true },
  { id: "rxH", label: "Мачта приёмника", type: "range", min: 1, max: 15, step: 0.5, fmt: (v) => `${fmt(v, 1)} м`, rebuild: true },
  { id: "power", label: "Мощность", type: "select", options: [[25, "25 мВт"], [100, "100 мВт"], [400, "400 мВт"], [800, "800 мВт"], [1600, "1,6 Вт"]], num: true },
  { id: "gainRx", label: "Антенна приёмника", type: "select", options: [[2, "диполь ≈2 dBi"], [8, "патч ≈8 dBi"]], num: true },
  { id: "pol", label: "Поляризация", type: "select", options: [["same", "одинаковая"], ["mixed", "круговая + линейная"], ["cross", "противоположная"]], rebuild: true },
  { id: "rate", label: "Packet rate ELRS", type: "select", options: [[25, "25 Гц"], [50, "50 Гц (курс)"], ["D50", "D50"], [500, "500 Гц (2,4 ГГц)"]] },
  { id: "open", label: "Антенна передатчика не прикручена", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { hill: 2 } },
  { at: 3, set: { hill: 6 } },
  { at: 6, set: { hill: 9 } },
  { at: 9, set: { hill: 4 } },
];

export function controller(root, built, state) {
  const L = built.live;
  const needle = root.querySelector('[data-part="needle"]');
  const pk = root.querySelector('[data-part="packets"]');
  const fill = root.querySelector('[data-part="fzfill"]');
  const sim = { t: 0, rssi: L.model.rssi };
  let r = L.model;
  return {
    tick(dt, calm, st) {
      sim.t += dt;
      r = radio({ ...st, rate: st.rate === "D50" ? "D50" : Number(st.rate) });
      sim.rssi += (r.rssi - sim.rssi) * (calm ? 1 : 1 - Math.exp(-dt / 0.3));
      needle.setAttribute("d", L.needle((sim.rssi + 130) / 100));
      // Пакеты: сколько из 10 доходит — по LQ.
      let html = "";
      if (!calm) {
        const [a, b] = L.los;
        for (let i = 0; i < 6; i++) {
          const u = (sim.t * 0.35 + i / 6) % 1;
          const lost = ((i * 7919 + Math.floor(sim.t * 0.35 + i / 6) * 31) % 100) >= r.lq;
          const uu = 0.07 + u * 0.86;
          const x = a[0] + (b[0] - a[0]) * uu, y = a[1] + (b[1] - a[1]) * uu;
          const fade = Math.min(1, u * 8, (1 - u) * 8);
          if (lost && u > 0.5) continue;
          html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" class="pk" style="opacity:${fade.toFixed(2)}"/>`;
        }
      }
      pk.innerHTML = html;
      if (fill) fill.dataset.blocked = r.blocked > 0 ? (r.blocked >= 1 ? "2" : "1") : "0";
      return true;
    },
    facts() {
      return { lq: r.lq, blocked: r.blocked, margin: r.margin };
    },
    readout() {
      return `RSSI ${fmt(sim.rssi)} dBm · запас ${fmt(r.margin)} дБ · LQ ${fmt(r.lq)} %`;
    },
    metrics() {
      const fresnel = r.blocked <= 0 ? "свободна" : r.blocked < 1 ? `перекрыта на ${fmt(r.blocked * 60)} % радиуса` : "холм закрыл линию";
      return [
        ["Длина волны", `${fmt(r.lambda * 100, 1)} см · ¼ λ = ${fmt(r.quarter, 1)} см`, "закон"],
        ["Зона Френеля (середина)", `r = ${fmt(r.r1, 1)} м · ${fresnel}`, "закон"],
        ["Потери в пространстве", `${fmt(r.fspl, 1)} дБ`, "закон"],
        ["Поляризация / КСВ", `${loss(r.polLoss)} дБ / ${loss(r.mismatch, 1)} дБ${state.open ? " · передатчик греется!" : ""}`, "оценка"],
        ["Затенение холмом", `${loss(r.shadow, 1)} дБ`, "оценка"],
        ["Чувствительность / тревога", `${r.sens} / ${r.alarm} dBm`, "ELRS"],
      ];
    },
  };
}
