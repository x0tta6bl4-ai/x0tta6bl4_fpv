// Fig: качели PID. Балка с двумя моторами качается на оси; полётник посередине держит угол.
// Транспортир со стрелкой показывает наклон, рычажок — стик, настольный вентилятор даёт порыв ветра.
import { k, G, scene, basePlate, rulerStrip, labelPlate, knob, TAU, fmt, clamp, bar, labelsAt } from "../figkit.mjs";
import { pidStep } from "../models.mjs";

const W = 640, H = 390;
const PLATE = { x: -110, y: -150, w: 220, d: 300, r: 8 };
const ZP = 74; // высота оси
const ARM = 104; // плечо до мотора
const POSTX = 20;
const PRO = { x: POSTX + 7, r: 46 }; // транспортир на ближней стойке
const STICK = [-58, 108];
const FAN = [0, -140];

export const meta = {
  id: "pid",
  title: "Качели PID",
  hint: "Стик — ползунок или ← →",
  keys: [
    { mark: "lit", label: "Балка с полётником и моторами" },
    { mark: "raised", label: "Стойки, ось, транспортир" },
    { mark: "edge", label: "Стрелка — фактический угол" },
  ],
  caption: "Полётник сотни раз в секунду сравнивает, как балка должна вращаться (команда стика) и как вращается (гироскоп), и исправляет разницу оборотами моторов: P — пружина, I — память, D — амортизатор. В Angle стик задаёт угол и горизонт берётся из акселерометра; в Acro стик задаёт скорость вращения, акселерометр не нужен. Модель упрощённая (оценка).",
  aria: "Стрелки меняют положение стика, пробел — пауза.",
  try: [
    "Наклони стиком и отпусти в Angle, потом в Acro: в Acro балка останется наклонённой.",
    "Включи «Удар: акселерометр сбит»: в Angle балку тянет в сторону, в Acro — нет.",
    "Поставь I = 0 и включи ветер: появится постоянный снос. Это и есть работа I.",
  ],
  missions: [
    { id: "acro", look: ["protractor","beam"], touch: ["mode=ACRO","stick"], see: "стрелку транспортира, когда стик вернулся в 0",  text: "Включи Acro, наклони стиком и верни стик в центр: дрон останется наклонённым", check: (f, s) => s.mode === "ACRO" && Math.abs(s.stick) < 0.05 && Math.abs(f.angle) > 15 },
    { id: "level", look: ["protractor","beam"], touch: ["mode=ANGLE","stick"], see: "куда вернётся балка, когда отпустишь стик",  text: "В Angle наклони больше 20° и отпусти стик: дрон выровняется сам", check: (f) => f.leveled },
    { id: "acc", look: ["beam","protractor"], touch: ["mode=ANGLE","acc"], see: "наклон балки при стике в центре",  text: "Включи «удар по акселерометру» в Angle: стик в центре, а дрон висит криво", check: (f, s) => s.acc && s.mode === "ANGLE" && Math.abs(s.stick) < 0.05 && Math.abs(f.angle) > 5 },
    { id: "wind", look: ["fan","beam"], touch: ["wind","ki"], see: "как балку сносит ветром без I",  text: "Включи ветер и убери I (память) в ноль: дрон начнёт сносить", check: (f, s) => s.wind && s.ki === 0 && Math.abs(f.angle) > 2 },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [0, ARM + 60, ZP + 40], [0, -ARM - 60, ZP + 40], [0, ARM + 60, ZP - 50], [0, -ARM - 60, ZP - 50]], W, H, { pad: 20, azimuth: 30, elevation: 26 });
}

const XAX = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

// Балка и всё, что на ней, в повороте θ (градусы, против часовой со стороны +x).
function beamSvg(P, theta, spin, { lit = true, thrustL = 0.5, thrustR = 0.5 } = {}) {
  const t = (theta * Math.PI) / 180;
  const b = [0, Math.cos(t), Math.sin(t)];
  const n = [0, -Math.sin(t), Math.cos(t)];
  const O = [0, 0, ZP];
  const pt = (s, h, x = 0) => [x, O[1] + b[1] * s + n[1] * h, O[2] + b[2] * s + n[2] * h];
  const items = [];
  const V = G.viewOf(P);
  const add = (ref, svg) => items.push({ d: G.dot3(ref, V), svg });
  const fb = G.frameOf(pt(-ARM - 14, 0), b, [1, 0, 0], n);
  add(pt(0, 0), k.solidSvg(G.prismOf(fb, [[-5, -3], [5, -3], [5, 3], [-5, 3]], 0, 2 * ARM + 28, P), { tone: "hi", lit, crease: "lo" }));
  // Втулка на оси.
  const hub = G.frameOf([-9, 0, ZP], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  add([10, 0, ZP], k.solidSvg(G.disc(0, 18, 6.4, hub, P), { tone: "mid" }));
  // Полётник на стойках посередине балки.
  const fcF = G.frameOf(pt(0, 3), n, [1, 0, 0], b);
  add(pt(0, 9), k.solidSvg(G.prismOf(fcF, [[-17, -17], [17, -17], [17, 17], [-17, 17]], 5, 6.6, P), { tone: "mid" }));
  add(pt(0, 10), k.solidSvg(G.prismOf(fcF, [[-4.5, -4.5], [4.5, -4.5], [4.5, 4.5], [-4.5, 4.5]], 6.6, 7.8, P), { tone: "hi", lit, crease: "lo" }));
  add(pt(9, 10, 9), k.solidSvg(G.prismOf(fcF, [[7, 7], [11, 7], [11, 11], [7, 11]], 6.6, 7.6, P), { tone: "hi" }));
  for (const [x, y] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) add(pt(y, 5, x), k.solidSvg(G.prismOf(fcF, [[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]], 0, 5, P), { tone: "lo" }));
  // Моторы и винты на концах.
  for (const [side, thr] of [[-1, thrustL], [1, thrustR]]) {
    const s = side * ARM;
    const mF = G.frameOf(pt(s, 3), n, [1, 0, 0], b);
    add(pt(s, 4), k.solidSvg(G.prismOf(mF, [[-11, -11], [11, -11], [11, 11], [-11, 11]], 0, 2.2, P), { tone: "mid" }));
    const mA = G.frameAlong(pt(s, 5.2), n);
    add(pt(s, 8), k.solidSvg(G.disc(0, 3, 10.5, mA, P), { tone: "mid" }));
    add(pt(s, 12), k.solidSvg(G.disc(3, 15, 11.2, mA, P), { tone: "hi", inner: k.lineSvg(G.arcOf(mA, 6, 11.2, P), { tone: "faint" }) }));
    add(pt(s, 21), k.solidSvg(G.disc(15, 21, 2.2, mA, P), { tone: "mid" }));
    const pF = G.frameOf(pt(s, 20.2), n, [1, 0, 0], b);
    const a0 = spin * (side > 0 ? 1 : -1);
    const R = 46;
    const shape = [[0.12, 0.5], [0.35, 0.95], [0.6, 1], [0.85, 0.82], [1, 0.3], [0.97, -0.3], [0.7, -0.5], [0.35, -0.48], [0.12, -0.35]];
    for (let j = 0; j < 2; j++) {
      const a = a0 + j * Math.PI;
      const c = Math.cos(a), si = Math.sin(a);
      const poly = shape.map(([u, v]) => [c * u * R - si * v * R * 0.15, si * u * R + c * v * R * 0.15]);
      const mid = G.pointOf(pF, 0.5, R * 0.5, a);
      add(mid, k.solidSvg(G.prismOf(pF, poly, 0, 1.2, P), { tone: "hi", crease: "lo" }));
    }
    add(pt(s, 22.4), k.solidSvg(G.disc(-0.4, 3, 4.6, G.frameAlong(pt(s, 20.2), n), P), { tone: "hi" }));
    // Струя: насколько сильно мотор тянет (линии вдоль оси, под винтом — только при тяге).
    if (thr > 0.02) {
      const len = 6 + thr * 26;
      const lines = [];
      for (const off of [-30, -15, 15, 30]) {
        const p0 = pt(s + off, -2), p1 = pt(s + off, -2 - len);
        lines.push(k.segment(p0, p1, P));
      }
      add(pt(s, -2 - len), `<path class="iso-line" data-tone="faint" data-free="both" style="opacity:${(0.25 + thr * 0.6).toFixed(2)}" d="${lines.join("")}"/>`);
    }
  }
  items.sort((p, q) => p.d - q.d);
  return items.map((i) => i.svg).join("");
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  basePlate(S, PLATE);
  rulerStrip(S, { x: PLATE.x + 12, y: PLATE.y + PLATE.d - 15, w: 120, d: 7, r: 1 });
  labelPlate(S, { x: 40, y: PLATE.y + PLATE.d - 28, w: 44, d: 18, r: 1.5 }, "PID");
  S.group = "stands";
  // Две стойки с подшипниками.
  for (const x of [-POSTX, POSTX]) {
    S.box({ x: x - 9, y: -26, w: 18, d: 52, r: 3 }, 0, 6, { tone: "mid" }, { bevel: 0.6, bias: x > 0 ? 10 : -10 });
    S.dots([[x - 5, -20, 6], [x + 5, -20, 6], [x - 5, 20, 6], [x + 5, 20, 6]], { size: 0.45 }, [x, 0, 6.1], { bias: x > 0 ? 10 : -10 });
    const ring = [[-3, -10], [3, -10], [3, 10], [-3, 10]].map(([dx, dy]) => [x + dx, dy]);
    S.solid(k.extrude(ring, 6, ZP - 6 - 2, P), { tone: "mid" }, [x, 0, ZP / 2], { bias: x > 0 ? 40 : -40 });
    S.solid(G.disc(-3.4, 3.4, 9, XAX(x, 0, ZP), P), { tone: "mid" }, [x, 0, ZP], { bias: x > 0 ? 41 : -41 });
    S.line(G.circleOf(XAX(x, 0, ZP), 3.4, 4.2, P), { tone: "lo" }, [x + 3.5, 0, ZP], { bias: x > 0 ? 42 : -42 });
  }
  S.group = "protractor";
  // Транспортир на ближней стойке: дуга с рисками каждые 5°, крупные — каждые 15°.
  const pro = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (-60 + (120 * i) / steps) * (Math.PI / 180);
    pro.push([Math.sin(a) * PRO.r, -Math.cos(a) * PRO.r]);
  }
  const proPoly = [[0, 0], ...pro];
  const proPts = proPoly.map(([y, dz]) => [PRO.x, y, ZP + dz]);
  const proFill = "M" + proPts.map((p) => k.iso(p, P).map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
  const proFace = { fill: proFill, outline: proFill, crease: "", top: "", shades: ["", "", "", proFill] };
  let ticks = "", major = "";
  for (let d = -60; d <= 60; d += 5) {
    const a = (d * Math.PI) / 180;
    const r0 = PRO.r - (d % 15 === 0 ? 7 : 3.6);
    const seg = k.segment([PRO.x + 0.1, Math.sin(a) * r0, ZP - Math.cos(a) * r0], [PRO.x + 0.1, Math.sin(a) * PRO.r, ZP - Math.cos(a) * PRO.r], P);
    if (d % 15 === 0) major += seg;
    else ticks += seg;
  }
  const inner = [];
  for (let i = 0; i <= 48; i++) {
    const a = (-60 + (120 * i) / 48) * (Math.PI / 180);
    inner.push(k.iso([PRO.x + 0.1, Math.sin(a) * (PRO.r - 7), ZP - Math.cos(a) * (PRO.r - 7)], P));
  }
  const innerArc = "M" + inner.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L");
  S.raw([PRO.x, 0, ZP - 20], k.solidSvg(proFace, { tone: "mid" }) + k.lineSvg(innerArc, { tone: "lo" }) + k.lineSvg(ticks, { tone: "lo" }) + k.lineSvg(major, { tone: "mid" }), { bias: 60 });
  S.group = "beam";
  // Стрелка (перестраивается) и балка.
  S.raw([0, 0, ZP], `<g data-part="beam">${beamSvg(P, 0, 0)}</g>`, { bias: 0 });
  S.raw([PRO.x + 1, 0, ZP], `<path data-part="needle" class="iso-line" data-tone="lit" style="stroke-width:1.2" d=""/>`, { bias: 70 });
  S.dots([[PRO.x + 0.6, 0, ZP]], { size: 1.4, tone: "hi" }, [PRO.x + 1, 0, ZP], { bias: 71 });
  S.group = "lever";
  // Пульт-рычажок для стика.
  const box = { x: STICK[0] - 16, y: STICK[1] - 14, w: 32, d: 28, r: 4 };
  S.box(box, 0, 10, { tone: "mid", inner: k.lineSvg(k.sideSeam(box, 3, P, 6), { tone: "faint" }) }, { bevel: 0.8 });
  S.line(k.ring(STICK[0], STICK[1], 8, 10, P, 40) + k.ring(STICK[0], STICK[1], 6.6, 10, P, 40), { tone: "lo" }, [STICK[0], STICK[1], 10.1]);
  S.raw([STICK[0], STICK[1], 20], `<g data-part="stick"></g>`, { bias: 2 });
  S.tube([[box.x + box.w, STICK[1] - 6, 4], [box.x + box.w + 14, STICK[1] - 10, 4], [POSTX - 4, 30, 4], [POSTX - 4, 26, 3]], 0.7, { tone: "lo", bendR: 8 });
  S.group = "fan";
  // Настольный вентилятор на дальнем конце.
  const fanBase = { x: FAN[0] - 14, y: FAN[1] - 8, w: 28, d: 16, r: 4 };
  S.box(fanBase, 0, 5, { tone: "mid" }, { bevel: 0.6 });
  S.cyl(FAN[0], FAN[1], 2.2, 5, 28, { tone: "mid", crease: "none" });
  const fanF = G.frameOf([FAN[0], FAN[1] + 2, 40], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  S.solid(G.disc(-6, 0, 6, fanF, P), { tone: "mid" }, [FAN[0], FAN[1] - 1, 40]);
  S.solid(G.ringBand(0, 3, 17, 18.5, fanF, P), { tone: "mid" }, [FAN[0], FAN[1] + 3, 40], { bias: 2 });
  S.raw([FAN[0], FAN[1] + 2, 40], `<g data-part="fan"></g>`, { bias: 1 });
  S.group = null;
  const live = { beam: (th, sp, o) => beamSvg(P, th, sp, o), fanF };
  const svg = k.figureSvg({ width: W, height: H, label: "Качели PID: балка с двумя моторами и полётником качается на оси между двумя стойками; транспортир со стрелкой показывает угол, рядом рычажок стика и настольный вентилятор.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Полётник", [0, 0, ZP + 8], "Сравнивает нужный угол с настоящим и командует моторами. Это и есть PID."],
    ["Мотор с винтом", [0, ARM, ZP + 6], "Разница тяги двух моторов поворачивает балку."],
    ["Мотор с винтом", [0, -ARM, ZP + 6], "Разница тяги двух моторов поворачивает балку."],
    ["Транспортир: угол", [PRO.x, 0, ZP + PRO.r * 0.75], "Показывает, на сколько градусов наклонена балка."],
    ["Стик пульта", [STICK[0], STICK[1], 18], "В Angle задаёт угол наклона, в Acro — скорость вращения."],
    ["Вентилятор: ветер", [FAN[0], FAN[1], 40], "Дует на балку. Это помеха, которую PID должен побороть."],
  ]);
  return { svg, P, labels, live, parts: S.count() };
}

export const defaults = { mode: "ANGLE", stick: 0, kp: 1, ki: 1, kd: 1, acc: false, wind: false };
export const controls = [
  { id: "stick", label: "Стик (крен)", type: "range", min: -1, max: 1, step: 0.05, fmt: (v) => `${v > 0 ? "+" : ""}${fmt(v * 100)} %` },
  { id: "mode", label: "Режим", type: "seg", options: [["ACRO", "Acro"], ["ANGLE", "Angle"], ["HORIZON", "Horizon"]] },
  { id: "kp", label: "P — пружина", type: "range", min: 0, max: 2, step: 0.1, fmt: (v) => `×${fmt(v, 1)}` },
  { id: "ki", label: "I — память", type: "range", min: 0, max: 2, step: 0.1, fmt: (v) => `×${fmt(v, 1)}` },
  { id: "kd", label: "D — амортизатор", type: "range", min: 0, max: 2, step: 0.1, fmt: (v) => `×${fmt(v, 1)}` },
  { id: "acc", label: "Удар: акселерометр сбит на 8°", type: "check" },
  { id: "wind", label: "Ветер с одной стороны", type: "check" },
];
export const tour = [
  { at: 0, set: { mode: "ANGLE", stick: 0.5 } },
  { at: 2.5, set: { stick: 0 } },
  { at: 5, set: { mode: "ACRO", stick: 0.35 } },
  { at: 5.6, set: { stick: 0 } },
  { at: 9, set: { mode: "ANGLE", stick: 0 } },
];

export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const beam = q("beam"), needle = q("needle"), stick = q("stick"), fan = q("fan");
  const s = { angle: 0, rate: 0, integral: 0, prevRate: 0, target: 0, out: 0, p: 0, i: 0, d: 0 };
  const sim = { spin: 0, fan: 0, stick: state.stick, windNow: 0 };
  return {
    tick(dt, calm, st) {
      sim.stick += (st.stick - sim.stick) * (calm ? 1 : 1 - Math.exp(-dt / 0.12));
      sim.windNow += ((st.wind ? 0.3 : 0) - sim.windNow) * (1 - Math.exp(-dt / 0.6));
      const sub = 4;
      if (dt > 0) for (let i = 0; i < sub; i++) pidStep(s, { mode: st.mode, stick: sim.stick, kp: st.kp, ki: st.ki, kd: st.kd, accBias: st.acc ? 8 : 0, wind: sim.windNow }, dt / sub);
      if (calm && dt === 0) {
        /* статичный кадр */
      }
      if (st.mode === "ANGLE" && Math.abs(s.angle) > 20) sim.tilted = true;
      if (st.mode !== "ANGLE") sim.tilted = false;
      if (sim.tilted && Math.abs(st.stick) < 0.05 && Math.abs(s.angle) < 2) sim.leveled = true;
      const thr = clamp(s.out / 900, -1, 1);
      if (!calm) sim.spin += dt * 9;
      beam.innerHTML = L.beam(-s.angle, sim.spin, { thrustL: clamp(0.5 + thr * 0.5, 0, 1), thrustR: clamp(0.5 - thr * 0.5, 0, 1) });
      const a = (-s.angle * Math.PI) / 180;
      needle.setAttribute("d", k.segment([PRO.x + 0.6, -Math.sin(a) * 6, ZP + Math.cos(a) * 6], [PRO.x + 0.6, Math.sin(a) * (PRO.r - 2), ZP - Math.cos(a) * (PRO.r - 2)], P));
      // Стик.
      const tip = [STICK[0], STICK[1] + sim.stick * 7, 24];
      stick.innerHTML = k.solidSvg(k.cylinder(STICK[0], STICK[1], 3, 10, 2, P, 20), { tone: "mid" }) + `<path class="iso-line" data-tone="hi" style="stroke-width:2" d="${k.segment([STICK[0], STICK[1], 12], tip, P)}"/>` + k.solidSvg(G.sphereOf(tip, 3, P, { steps: 24 }), { tone: "hi" });
      // Вентилятор.
      sim.fan += dt * (st.wind ? 14 : 0);
      let blades = "";
      for (let j = 0; j < 3; j++) {
        const a0 = sim.fan + (j * TAU) / 3;
        const poly = [[0.2, 0.15], [0.95, 0.45], [1, 0], [0.9, -0.3], [0.2, -0.15]].map(([u, v]) => [Math.cos(a0) * u * 15 - Math.sin(a0) * v * 8, Math.sin(a0) * u * 15 + Math.cos(a0) * v * 8]);
        blades += k.solidSvg(G.prismOf(L.fanF, poly, 0.5, 1.4, P), { tone: "hi", crease: "lo" });
      }
      fan.innerHTML = blades;
      return true;
    },
    facts() {
      return { angle: s.angle, leveled: !!sim.leveled };
    },
    readout() {
      // HORIZON: у центра стика — угол, к краю всё больше вращения (как в модели).
      const mix = state.mode === "HORIZON" ? clamp((Math.abs(sim.stick) - 0.3) / 0.6, 0, 1) : 0;
      const tgt = state.mode === "ACRO" || mix > 0.99 ? `цель ${fmt(sim.stick * 300)} °/с` : mix > 0 ? `цель ${fmt(sim.stick * 55)}° + вращение ${fmt(sim.stick * 300)} °/с (${fmt(mix * 100)} %)` : `цель ${fmt(sim.stick * 55)}°`;
      return `${state.mode} · угол ${fmt(s.angle, 1)}° · ${tgt}`;
    },
    metrics() {
      return [
        ["P (ошибка сейчас)", fmt(s.p), ""],
        ["I (накопленный снос)", fmt(s.i), ""],
        ["D (гасит проскок)", fmt(s.d), ""],
        ["Скорость вращения (гироскоп)", `${fmt(s.rate)} °/с`, "гироскоп"],
        ["Угол (настоящий)", `${fmt(s.angle, 1)}°${state.acc ? ` · FC думает ${fmt(s.angle + 8, 1)}°: акселерометр врёт на 8°` : ""}`, state.mode === "ACRO" ? "Acro: акселерометр не нужен" : "по акселерометру"],
        ["Что делает стик", state.mode === "ACRO" ? "скорость вращения" : state.mode === "ANGLE" ? "угол наклона (предел ≈55°)" : "угол, у краёв — вращение", ""],
      ];
    },
    reset() {
      Object.assign(s, { angle: 0, rate: 0, integral: 0, prevRate: 0 });
    },
  };
}
