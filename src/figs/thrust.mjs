// Fig: тяговый стенд. Рычаг на оси: мотор с винтом давит рычагом на тензодатчик,
// индикатор часового типа показывает тягу, биметаллический термометр — нагрев обмотки.
import { k, G, scene, basePlate, rulerStrip, labelPlate, dialGauge, knob, pcb, motor, propSvg, plug, TAU, fmt, labelsAt } from "../figkit.mjs";
import { thrustStand, heatStep, MOTORS, PROPS } from "../models.mjs";

const W = 640, H = 380;
const PLATE = { x: -165, y: -78, w: 330, d: 156, r: 8 };
const BEAM_Z = 44, BEAM_T = 6, BEAM_TOP = BEAM_Z + BEAM_T;
const PIVOT = -20, MOTOR_X = 112, CELL_X = -100;
const BY = -32;
const DIAL = [-72, BY], DIAL_R = 17, DIAL_Z = 84;
const THERMO = [138, 40], THERMO_R = 13;
const TESTER = { x: 18, y: 26, w: 40, d: 24, r: 3 };
const KNOB = [46, 38];

export const meta = {
  id: "thrust",
  title: "Тяговый стенд",
  hint: "Газ — ползунок или ← →",
  keys: [
    { mark: "lit", label: "Винт: тяга вдоль оси мотора" },
    { mark: "raised", label: "Мотор, ESC, батарея" },
    { mark: "edge", label: "Индикатор тяги и термометр обмотки" },
  ],
  caption: "Мотор с винтом стоит на рычаге. Тяга поднимает правое плечо, левое давит на тензодатчик; индикатор переводит усилие в граммы. Ток, мощность и нагрев считаются одной моделью: тяга ∝ n²·D⁴, мощность винта ∝ n³·D⁵ (закон подобия), коэффициенты — оценка.",
  missions: [
    { id: "kg2", look: ["indicator","loadcell"], touch: ["throttle","prop"], see: "стрелку индикатора тяги",  text: "Подними тягу больше 2 кг (газ вверх)", check: (f) => f.grams > 2000 },
    { id: "hot", look: ["thermo","motor"], touch: ["throttle","motor"], see: "термометр обмотки мотора",  text: "Перегрей обмотку мотора выше 130 °C: держи полный газ", check: (f) => f.T > 130,
      predict: { q: "На живом стенде обмотка уже горячая, а газ полный. Что делать?", options: ["Держать полный газ до 130 °C и дальше", "Сбросить газ раньше: 130 °C здесь — метка перегрева модели, не рабочий режим", "Прибавить газ, чтобы быстрее остыло"], right: 1 },
      confirm: { q: "Звезда за «выше 130 °C» значит, что мотор так и надо греть?", options: ["Нет. На живом стенде газ убирают, не дожидаясь такой температуры", "Да, 130 °C — нормальная рабочая температура", "Да, иначе тягу не измерить"], right: 0, miss: "Стенд доводит обмотку до 130 °C, чтобы перегрев было видно. На столе с настоящим мотором газ сбрасывают раньше." } },
    { id: "sag", look: ["battery","wattmeter"], touch: ["cold","throttle"], see: "напряжение банки на ваттметре",  text: "Включи холодную батарею и дай полный газ: банка просядет ниже 3,3 В", check: (f, s) => s.cold && f.cell < 3.3 },
    { id: "eco", look: ["indicator","wattmeter"], touch: ["throttle","prop","motor"], see: "граммы тяги на каждый ватт в показателях",  text: "Найди самый экономный режим: больше 8 г тяги на каждый ватт", check: (f) => f.eff > 8 && f.grams > 150 },
  ],
};

function projection() {
  const pts = [...k.boxCorners(PLATE, -17, 0), [MOTOR_X + 90, BY, 80], [MOTOR_X - 90, BY, 80], [DIAL[0], DIAL[1] + DIAL_R, DIAL_Z + 12], [MOTOR_X, BY + 90, 80], [MOTOR_X, BY - 90, 80]];
  return k.fitProjection(pts, W, H, { pad: 24, azimuth: 52 });
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const YAX = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  basePlate(S, PLATE);
  rulerStrip(S, { x: -150, y: PLATE.y + PLATE.d - 15, w: 196, d: 7, r: 1 });
  labelPlate(S, { x: 66, y: PLATE.y + PLATE.d - 26, w: 42, d: 17, r: 1.5 }, "THRUST");

  S.group = "lever";
  // Ось рычага: основание, две щеки, ось с головками.
  S.box({ x: PIVOT - 16, y: BY - 22, w: 32, d: 44, r: 3 }, 0, 6, { tone: "mid" });
  S.dots([[PIVOT - 11, BY - 17, 6], [PIVOT + 11, BY - 17, 6], [PIVOT - 11, BY + 17, 6], [PIVOT + 11, BY + 17, 6]], { size: 0.45 }, [PIVOT, BY, 6.1]);
  for (const dy of [-16, 11]) S.box({ x: PIVOT - 8, y: BY + dy, w: 16, d: 5, r: 1 }, 6, 48, { tone: "mid" }, { bevel: 0.4, bias: dy > 0 ? 6 : -6 });
  const pinF = YAX(PIVOT, BY - 19, 47);
  S.solid(G.disc(0, 2.4, 4.4, pinF, P), { tone: "mid" }, [PIVOT, BY - 18, 47], { bias: -7 });
  S.solid(G.disc(35.6, 38, 4.4, pinF, P), { tone: "mid" }, [PIVOT, BY + 18, 47], { bias: 7 });
  S.dots([[PIVOT, BY + 19, 47]], { size: 0.6, tone: "hi" }, [PIVOT, BY + 20, 47], { bias: 7.2 });

  // Рычаг.
  const beam = { x: CELL_X - 12, y: BY - 5, w: MOTOR_X - CELL_X + 30, d: 10, r: 1.5 };
  S.box(beam, BEAM_Z, BEAM_T, { tone: "mid" }, { bevel: 0.5, ref: [PIVOT, BY, BEAM_Z + 3] });
  for (const x of [CELL_X + 8, 8, 72]) S.dots([[x, BY - 2.6, BEAM_TOP], [x, BY + 2.6, BEAM_TOP]], { size: 0.4 }, [x, BY, BEAM_TOP + 0.2]);

  S.group = "loadcell";
  // Тензодатчик на стойке под левым плечом.
  S.box({ x: CELL_X - 40, y: BY - 11, w: 16, d: 22, r: 2 }, 0, 40, { tone: "mid" }, { bevel: 0.5 });
  const cell = { x: CELL_X - 40, y: BY - 6, w: 46, d: 12, r: 1 };
  S.box(cell, 28, 12, { tone: "hi", crease: "lo" }, { bevel: 0.4, ref: [CELL_X - 18, BY, 34] });
  const hole = (x) => k.sideRing([x, BY + 6, 34], 3.4, "y", P, 24);
  S.line(hole(CELL_X - 14) + hole(CELL_X - 6) + k.segment([CELL_X - 14, BY + 6, 30.6], [CELL_X - 6, BY + 6, 30.6], P) + k.segment([CELL_X - 14, BY + 6, 37.4], [CELL_X - 6, BY + 6, 37.4], P), { tone: "lo" }, [CELL_X - 10, BY + 6.2, 34], { bias: 2 });
  S.dots([[CELL_X - 36, BY - 3, 40], [CELL_X - 36, BY + 3, 40]], { size: 0.45 }, [CELL_X - 36, BY, 40.2]);
  S.cyl(CELL_X, BY, 3.4, 40, 4, { tone: "hi" }, { ref: [CELL_X, BY, 42] });
  // Плата усилителя и кабель датчика.
  const amp = { x: -152, y: -70, w: 30, d: 20, r: 1.5 };
  pcb(S, amp, 0, { chips: [{ x: -142, y: -62, w: 8, d: 8, legs: 4, dot: true }, { x: -130, y: -56, w: 4, d: 3 }], pads: [[-128, -66], [-124, -66]] });
  S.tube([[CELL_X - 34, BY - 6, 31], [CELL_X - 40, -56, 6], [-127, -63, 2.2]], 0.9, { tone: "mid", bendR: 6 });

  S.group = "indicator";
  // Индикатор тяги на штативе позади рычага.
  const post = [DIAL[0] - 2, BY - 36];
  S.box({ x: post[0] - 13, y: post[1] - 11, w: 26, d: 22, r: 3 }, 0, 14, { tone: "mid" }, { bevel: 0.6 });
  S.line(k.planOutline({ x: post[0] - 10, y: post[1] - 8, w: 20, d: 16, r: 2 }, 14, P, 4), { tone: "faint" }, [post[0], post[1], 14.1]);
  S.cyl(post[0], post[1], 3, 14, DIAL_Z, { tone: "mid", crease: "none" }, { ref: [post[0], post[1], 40] });
  S.line(k.sideArc(post[0], post[1], 3, 40, P, 14) + k.sideArc(post[0], post[1], 3, 70, P, 14), { tone: "faint" }, [post[0], post[1] + 3.2, 55]);
  S.box({ x: post[0] - 6, y: post[1] - 6, w: 12, d: 12, r: 2 }, DIAL_Z + 2, 10, { tone: "mid" }, { bevel: 0.5 });
  S.box({ x: DIAL[0] - 4, y: post[1] + 6, w: 8, d: DIAL[1] - DIAL_R - post[1] - 5, r: 2 }, DIAL_Z + 4, 4, { tone: "mid" }, { bevel: 0.4 });
  S.cyl(DIAL[0], DIAL[1], 1.3, BEAM_TOP, DIAL_Z - BEAM_TOP, { tone: "hi", crease: "none" }, { ref: [DIAL[0], DIAL[1], 70] });
  S.cyl(DIAL[0], DIAL[1], 2.6, BEAM_TOP, 1.6, { tone: "hi" }, { ref: [DIAL[0], DIAL[1], BEAM_TOP + 1] });
  const dial = dialGauge(S, DIAL[0], DIAL[1], DIAL_Z, DIAL_R, { h: 9, ticks: 50, every: 5, face: "0–5 кг", ref: [DIAL[0], DIAL[1], DIAL_Z + 6] });

  S.group = "battery";
  // Батарея с ремнями, балансир, силовые провода.
  const pack = { x: -152, y: 6, w: 74, d: 36, r: 4 };
  S.box(pack, 0, 26, { tone: "mid", inner: k.lineSvg(k.sideSeam(pack, 6, P, 6), { tone: "faint" }) }, { bevel: 0.8 });
  S.line(k.planOutline(k.insetPlan(pack, 6), 26, P, 4), { tone: "faint" }, [pack.x + 37, pack.y + 18, 26.1]);
  // Ремни охватывают пачку: верхняя полоса и полоса на ближней грани (внутренние грани не рисуются).
  for (const x of [-132, -104]) {
    S.box({ x, y: pack.y - 1.5, w: 9, d: pack.d + 3, r: 0.6 }, 26, 0.9, { tone: "lo" }, { ref: [x + 4.5, pack.y + 18, 26.5], steps: 2 });
    S.box({ x, y: pack.y + pack.d, w: 9, d: 1.5, r: 0.4 }, 0, 26.9, { tone: "lo" }, { ref: [x + 4.5, pack.y + pack.d + 1, 13], steps: 2 });
  }
  const cells = state.cells;
  const bw = 4 + cells * 1.3;
  plug(S, -138, 52, 0, bw, 4, 3, { ref: [-138, 52, 1.5] });
  for (let i = 0; i <= cells; i++) {
    const x = -138 - bw / 2 + 2 + i * ((bw - 4) / cells);
    S.tube([[x, pack.y + pack.d - 1, 14], [x, pack.y + pack.d + 4, 8], [x, 50, 3]], 0.3, { tone: "lo", bendR: 2 });
  }
  for (const [i, y] of [[0, 18], [1, 30]]) S.tube([[pack.x + pack.w - 1, y, 12], [-70, y, 12], [-62, y, 6], [-56, y, 4.5]], 1.6, { tone: i ? "mid" : "hi", bendR: 4 });
  plug(S, -54, 24, 1, 6, 18, 7, { tone: "hi" });

  S.group = "wattmeter";
  // Ваттметр.
  const wm = { x: -50, y: 10, w: 46, d: 28, r: 2.5 };
  S.box(wm, 0, 16, { tone: "mid", inner: k.lineSvg(k.sideSeam(wm, 4, P, 3), { tone: "faint" }) }, { bevel: 0.6 });
  S.line(k.planOutline({ x: wm.x + 6, y: wm.y + 5, w: 24, d: 14, r: 1 }, 16, P, 3), { tone: "lo" }, [wm.x + 18, wm.y + 12, 16.1]);
  S.line(k.planOutline({ x: wm.x + 7.5, y: wm.y + 6.5, w: 21, d: 11, r: 0.6 }, 16, P, 2), { tone: "faint" }, [wm.x + 18, wm.y + 12, 16.15]);
  for (const y of [wm.y + 9, wm.y + 19]) S.cyl(wm.x + 39, y, 2.2, 16, 1.4, { tone: "hi" });
  plug(S, -2, 24, 1, 6, 18, 7, { tone: "hi" });

  // Силовые провода ваттметр → ESC на рычаге.
  const esc = { x: 30, y: BY - 7, w: 34, d: 14, r: 3 };
  for (const [i, y] of [[0, 18], [1, 30]]) {
    S.tube([[0, y, 4.5], [10 + i * 6, y, 4.5], [22 + i * 4, BY + 16, 20], [34 + i * 8, BY + 7, BEAM_TOP + 2.5]], 1.4, { tone: i ? "mid" : "hi", bendR: 7 });
  }
  S.box(esc, BEAM_TOP, 5, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(esc, BEAM_TOP + 2.5, P, 6), { tone: "faint" }) }, { bevel: 0.5 });
  S.line(k.planOutline({ x: esc.x + 4, y: esc.y + 3, w: 14, d: 8, r: 0.6 }, BEAM_TOP + 5, P, 2), { tone: "faint" }, [esc.x + 11, BY, BEAM_TOP + 5.1]);
  S.group = "motor";
  // Три фазы к мотору.
  for (const [i, dy] of [[0, -2.6], [1, 0], [2, 2.6]]) {
    S.tube([[esc.x + esc.w, BY + dy, BEAM_TOP + 2.5], [MOTOR_X - 26, BY + dy, BEAM_TOP + 1], [MOTOR_X - 17, BY + dy * 1.8, BEAM_TOP + 3.2]], 0.7, { tone: i === 1 ? "hi" : "mid", bendR: 3 });
  }
  S.group = "tester";
  // Сигнальный провод тестера → ESC.
  S.tube([[TESTER.x + 5, TESTER.y + 1, 8], [TESTER.x + 5, BY + 22, 14], [38, BY + 8, BEAM_Z + 2], [38, BY + 6.5, BEAM_TOP + 1.6]], 0.55, { tone: "lo", bendR: 6 });

  S.group = "motor";
  // Площадка мотора на конце рычага.
  const mp = { x: MOTOR_X - 17, y: BY - 17, w: 34, d: 34, r: 4 };
  S.box(mp, BEAM_TOP, 2.6, { tone: "mid" }, { bevel: 0.5 });
  S.dots(k.corners(mp, 5).map(([x, y]) => [x, y, BEAM_TOP + 2.6]), { size: 0.5 }, [MOTOR_X, BY, BEAM_TOP + 2.7]);
  const mot = MOTORS[state.motor];
  const mr = mot.stator[0] * 0.62, mh = 10 + mot.stator[1] * 0.9;
  const mtop = motor(S, MOTOR_X, BY, BEAM_TOP + 2.6, { r: mr, h: mh, opts: { ref: [MOTOR_X, BY, BEAM_TOP + 8] } }).top;
  S.group = "thermo";
  // Клипса термопары на колоколе и кабель к термометру.
  const clip = [MOTOR_X + mr * 0.72, BY + mr * 0.72];
  S.box({ x: clip[0] - 1.8, y: clip[1] - 1.8, w: 3.6, d: 3.6, r: 0.8 }, BEAM_TOP + 8, 4, { tone: "mid" }, { ref: [clip[0], clip[1], BEAM_TOP + 12], bias: 3 });
  S.tube([[clip[0] + 1, clip[1] + 1, BEAM_TOP + 9], [MOTOR_X + 18, BY + 26, BEAM_TOP - 8], [THERMO[0] - 4, THERMO[1] - THERMO_R - 8, 10], [THERMO[0] - 2, THERMO[1] - 9, 5]], 0.6, { tone: "lo", bendR: 9 });

  S.group = "tester";
  // Тестер газа: корпус, ручка, светодиоды, шкала.
  S.box(TESTER, 0, 12, { tone: "mid", inner: k.lineSvg(k.sideSeam(TESTER, 3, P, 4), { tone: "faint" }) }, { bevel: 0.6 });
  const kn = knob(S, KNOB[0], KNOB[1], 12, 6, 5, { ref: [KNOB[0], KNOB[1], 15] });
  S.dots([[TESTER.x + 7, TESTER.y + 7, 12], [TESTER.x + 7, TESTER.y + 12, 12], [TESTER.x + 7, TESTER.y + 17, 12]], { size: 0.7, tone: "hi" }, [TESTER.x + 7, TESTER.y + 12, 12.1]);
  const sc = k.radialTicks(KNOB[0], KNOB[1], 9.8, 10, 5, 12, [1, 2], P, -2.4, 4.8);
  const arc = [];
  for (let i = 0; i <= 30; i++) {
    const a = -2.4 + (4.8 * i) / 30;
    arc.push([KNOB[0] + Math.sin(a) * 9.8, KNOB[1] - Math.cos(a) * 9.8]);
  }
  S.line(sc.minor + sc.major + k.onTop(arc, 12, P), { tone: "lo" }, [KNOB[0], KNOB[1], 12.05]);

  S.group = "thermo";
  // Биметаллический термометр.
  S.box({ x: THERMO[0] - 10, y: THERMO[1] - 10, w: 20, d: 20, r: 3 }, 0, 4, { tone: "mid" });
  S.cyl(THERMO[0], THERMO[1], 3, 4, 6, { tone: "mid" });
  const thermo = dialGauge(S, THERMO[0], THERMO[1], 10, THERMO_R, { h: 6, ticks: 32, every: 4, from: -2.36, span: 4.72, face: "°C", ref: [THERMO[0], THERMO[1], 13] });

  S.group = null;
  // Подвижные части перестраиваются: винт, стрелки, указатель ручки.
  const prop = PROPS[state.prop];
  const R = prop.d * 12.7 * 0.92;
  S.group = null;
  const live = { propZ: mtop + 1.2, R, blades: prop.blades, needle: dial.needle, thermo: thermo.needle, pointer: kn.pointer };
  S.raw([MOTOR_X, BY, mtop + 30], `<g data-part="prop">${propSvg(P, MOTOR_X, BY, live.propZ, R, 0.3, { blades: prop.blades, lit: true })}</g>`, { bias: 100 });
  S.raw([DIAL[0], BY, DIAL_Z + 20], `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${dial.needle(0)}"/>`, { bias: 50 });
  S.raw([THERMO[0], THERMO[1], 30], `<path data-part="thermo" class="iso-line" data-tone="hi" data-free="start" style="stroke-width:0.9" d="${thermo.needle(0)}"/>`, { bias: 50 });
  S.raw([KNOB[0], KNOB[1], 30], `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="start" d="${kn.pointer(-2.4)}"/>`, { bias: 50 });
  const svg = k.figureSvg({ width: W, height: H, label: "Тяговый стенд: мотор с пропеллером на рычаге, тензодатчик, индикатор тяги, ваттметр, батарея, тестер газа и термометр обмотки.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Батарея", [-115, 24, 26], "Даёт энергию. Больше банок (S) — выше напряжение и быстрее крутится мотор."],
    ["Ваттметр", [-27, 24, 16], "Меряет ток, напряжение и мощность — сколько энергии берёт мотор."],
    ["Регулятор ESC", [47, BY, BEAM_TOP + 5], "Превращает команду газа в трёхфазный ток для мотора."],
    ["Мотор с винтом", [MOTOR_X, BY, BEAM_TOP + 14], "Винт отбрасывает воздух вниз и сам тянется вверх. Это и есть тяга."],
    ["Датчик силы", [CELL_X - 18, BY, 34], "Тензодатчик чувствует, с какой силой рычаг давит на него. Так меряют тягу."],
    ["Индикатор тяги", [DIAL[0], DIAL[1], DIAL_Z + 6], "Стрелка показывает тягу в граммах."],
    ["Рычаг на оси", [PIVOT, BY, BEAM_TOP], "Мотор тянет один конец рычага, другой конец давит на датчик."],
    ["Ручка газа", [TESTER.x + TESTER.w / 2, TESTER.y + TESTER.d / 2, 12], "Задаёт газ от 0 до 100 % — как стик газа на пульте."],
    ["Термометр обмотки", [THERMO[0], THERMO[1], 10], "Обмотка мотора греется от тока. Перегрев портит мотор."],
  ]);
  return { svg, P, labels, live, parts: S.count() };
}

export const defaults = { motor: "2207-1950", prop: "5x4.3x3", cells: 6, throttle: 0.55, cold: false };

export const controls = [
  { id: "throttle", label: "Газ", type: "range", min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + " %" },
  { id: "prop", label: "Пропеллер", type: "select", options: Object.entries(PROPS).map(([v, p]) => [v, p.name]), rebuild: true },
  { id: "motor", label: "Мотор", type: "select", options: Object.entries(MOTORS).map(([v, m]) => [v, m.name]), rebuild: true },
  { id: "cells", label: "Батарея", type: "select", options: [[4, "4S"], [6, "6S"]], rebuild: true, num: true },
  { id: "cold", label: "Холодная батарея (−15 °C)", type: "check" },
];

export const tour = [
  { at: 0, set: { throttle: 0.3 } },
  { at: 3, set: { throttle: 0.75 } },
  { at: 7, set: { throttle: 1 } },
  { at: 10, set: { throttle: 0.45 } },
];

// Живой контроллер: вызывается оболочкой каждый кадр.
export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const prop = q("prop"), needle = q("needle"), thermo = q("thermo"), pointer = q("pointer");
  const sim = { thr: state.throttle, angle: 0.3, T: 25, grams: 0, seconds: 0 };
  let model = thrustStand(state);
  return {
    tick(dt, calm, st) {
      sim.thr = calm ? st.throttle : sim.thr + (st.throttle - sim.thr) * (1 - Math.exp(-dt / 0.35));
      model = thrustStand({ ...st, throttle: sim.thr });
      const mm = MOTORS[st.motor];
      // Время нагрева ускорено ×12, чтобы минута на стенде прошла за 5 с.
      const fast = 12;
      for (let i = 0; i < 4; i++) sim.T = heatStep(sim.T, { ...model, cth: mm.cth, rth: mm.rth, ambient: 25 } /* мороз — только у батареи, мотор в обычном воздухе */, (dt * fast) / 4);
      sim.seconds += dt * fast;
      sim.grams += (model.grams - sim.grams) * (calm ? 1 : 1 - Math.exp(-dt / 0.12));
      // Строб: видимая скорость вращения ограничена, чтобы лопасти читались.
      const visual = Math.min(model.rpm / 60, 2.2) * TAU * 0.6;
      if (!calm) sim.angle += visual * dt;
      prop.innerHTML = propSvg(P, MOTOR_X, BY, L.propZ, L.R, sim.angle, { blades: L.blades, lit: true });
      needle.setAttribute("d", L.needle(Math.min(sim.grams, 5000) / 5000));
      thermo.setAttribute("d", L.thermo(Math.max(0, Math.min(1, (sim.T + 20) / 200))));
      pointer.setAttribute("d", L.pointer(-2.4 + sim.thr * 4.8));
      return true;
    },
    facts() {
      return { grams: sim.grams, T: sim.T, cell: model.cell, eff: model.eff };
    },
    readout() {
      return `${fmt(sim.grams)} г · ${fmt(model.current, 1)} А · ${fmt(model.power)} Вт · ${fmt(model.eff, 2)} г/Вт · ${fmt(sim.T)} °C`;
    },
    metrics() {
      const hot = sim.T > 130 ? "горячо: эмаль обмотки на пределе" : sim.T > 90 ? "греется сильнее нормы" : "в норме";
      return [
        ["Обороты", `${fmt(model.rpm)} об/мин`, "оценка"],
        ["Без нагрузки", `${fmt(MOTORS[state.motor].kv)} × ${fmt(model.voltage, 1)} В ≈ ${fmt(MOTORS[state.motor].kv * model.voltage)} об/мин`, "KV × V"],
        ["Ток батареи", `${fmt(model.current, 1)} А`, "оценка"],
        ["Напряжение под нагрузкой", `${fmt(model.voltage, 2)} В (${fmt(model.cell, 2)} В/банка)`, "закон Ома"],
        ["Обмотка", `${fmt(sim.T)} °C · ${hot}`, "оценка"],
      ];
    },
    reset() {
      sim.T = 25;
      sim.seconds = 0;
    },
  };
}
