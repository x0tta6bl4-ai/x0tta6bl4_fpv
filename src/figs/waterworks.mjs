// Fig: водопровод вместо проводов. Бак на подъёмной колонне (высота = напряжение), труба с сужением
// (узость = сопротивление), бегущие капли (ток), водяное колесо (мощность) и табличка с переводом приставок.
// Зритель — с +x: колесо и табличка обращены к нему.
import { k, G, scene, basePlate, labelPlate, fmt, clamp, TAU, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -82, y: -104, w: 164, d: 210, r: 8 };
const COL = [-52, 54]; // колонна с баком
const TANK = 28, TANK_H = 26;
const zTank = (V) => 6 + V * 2.4; // низ бака
const WHEEL = [32, -58, 24], WR = 18; // центр колеса и радиус
const BOARD = { x: 44, y: 40, w: 4, d: 52, z0: 8, h: 34 };
const PIPE0 = [-34, 26], PIPE1 = [-2, -10]; // сужение трубы

export const QS = [
  { id: "q1", q: "2,4 ГГц =", opts: [["240", "240 МГц"], ["2400", "2400 МГц"], ["24000", "24 000 МГц"]], right: "2400" },
  { id: "q2", q: "6000 мА·ч =", opts: [["60", "60 А·ч"], ["6", "6 А·ч"], ["0.6", "0,6 А·ч"]], right: "6" },
  { id: "q3", q: "25 мВт =", opts: [["2.5", "2,5 Вт"], ["0.025", "0,025 Вт"], ["25000", "25 000 Вт"]], right: "0.025" },
];
const optLabel = (q, v) => (q.opts.find((o) => o[0] === v) || [, "?"])[1];

export function waterModel(s) {
  const I = s.V / s.R, P = s.V * I;
  const units = QS.map((q) => (s[q.id] ? s[q.id] === q.right : null));
  return { I, P, units, unitsOk: units.every((u) => u === true) };
}

export const meta = {
  id: "waterworks",
  title: "Водопровод вместо проводов",
  hint: "Высота бака и узость трубы — ползунки справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Вода: высота бака — напряжение, бегущие капли — ток, колесо — мощность" },
    { mark: "raised", label: "Бак на колонне со шкалой вольт, труба с сужением, водяное колесо, табличка приставок" },
    { mark: "edge", label: "Чем уже сужение трубы, тем больше сопротивление" },
  ],
  caption: "Электричество как водопровод. Напряжение — высота бака (давление), сопротивление — узость трубы, ток — сколько воды протекает за секунду, мощность — с какой силой вода крутит колесо (мотор). Приставки сдвигают запятую на три знака: кило ×1000, мега ×1 000 000, гига ×1 000 000 000, милли ÷1000.",
  aria: "Справа: высота бака (напряжение), узость трубы (сопротивление) и три вопроса на перевод приставок.",
  missions: [
    {
      id: "i2", look: ["tank", "pipe"], touch: ["V", "R"], see: "капли в трубе и «Ток» в показателях",
      text: "Сделай так, чтобы ток был ровно 2 А",
      check: (f) => Math.abs(f.I - 2) < 0.05,
      predict: { q: "Бак на 12 В. Какую узость трубы поставить, чтобы ток был 2 А?", options: ["2 Ом", "6 Ом", "24 Ом"], right: 1 },
      setup: { V: 12, R: 8 },
    },
    {
      id: "p50", look: ["wheel", "tank"], touch: ["V", "R"], see: "колесо и «Мощность» в показателях",
      text: "Раскрути колесо: мощность больше 50 Вт",
      check: (f) => f.P > 50,
      predict: { q: "Как раскрутить колесо сильнее всего?", options: ["Поднять бак и расширить трубу", "Сузить трубу", "Опустить бак"], right: 0 },
      setup: { V: 12, R: 8 },
    },
    {
      id: "narrow", look: ["pipe", "wheel"], touch: ["R"], see: "сужение трубы и колесо",
      text: "Почти останови колесо, не опуская бак ниже 10 В (сузь трубу)",
      check: (f, s) => s.V >= 10 && f.P < 6,
      predict: { q: "Бак высоко (10 В и выше), а колесо почти стоит. Как такое может быть?", options: ["Труба очень узкая — ток маленький", "В баке слишком много воды", "Колесо слишком лёгкое"], right: 0 },
      setup: { V: 12, R: 8 },
    },
    {
      id: "units", look: ["board"], touch: ["q1", "q2", "q3"], see: "табличку с приставками",
      text: "Переведи приставки на табличке: все три ответа верные",
      check: (f) => f.unitsOk,
      feedback: (f, s) => { const bad = QS.filter((q) => s[q.id] && s[q.id] !== q.right); return bad.length ? `Не так: ${bad.map((q) => `${q.q} ${optLabel(q, s[q.id])}`).join("; ")}. Кило ×1000, милли ÷1000: ГГц → МГц ×1000, мА·ч → А·ч ÷1000, мВт → Вт ÷1000.` : ""; },
      setup: { q1: "", q2: "", q3: "" },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [COL[0], COL[1], zTank(24) + TANK_H + 2], [WHEEL[0], WHEEL[1], WHEEL[2] + WR + 2]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const PR = 4.2; // широкая труба
const pipeR = (R) => clamp(PR / Math.sqrt(R), 0.7, PR);

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = waterModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 54, y: -96, w: 20, d: 26, r: 1.5 });

  // ── Колонна с баком и шкала вольт ──
  S.group = "tank";
  const [cx, cy] = COL;
  const zb = zTank(state.V);
  S.box({ x: cx - 16, y: cy - 16, w: 32, d: 32, r: 2.4 }, 0, 4, { tone: "mid" }, { bevel: 0.4 });
  S.box({ x: cx - 4, y: cy - 4, w: 8, d: 8, r: 1 }, 4, zb - 4, { tone: "hi", crease: "lo" }, { steps: 2, bevel: 0.3 });
  const tank = { x: cx - TANK / 2, y: cy - TANK / 2, w: TANK, d: TANK, r: 2 };
  S.box({ ...tank, x: tank.x + 1.2, y: tank.y + 1.2, w: TANK - 2.4, d: TANK - 2.4 }, zb + 1, TANK_H - 5, { tone: "hi", lit: true }, { bevel: 0.3, bias: -1 });
  const glass = k.planOutline(tank, zb, P, 3) + k.planOutline(tank, zb + TANK_H, P, 3) + k.corners(tank, 2 * (1 - Math.SQRT1_2)).map(([x, y]) => k.segment([x, y, zb], [x, y, zb + TANK_H], P)).join("");
  S.raw([cx, cy, zb + TANK_H / 2], k.lineSvg(glass, { tone: "mid" }), { bias: 2 });
  // Шкала вольт на передней грани стойки-линейки.
  const ru = { x: cx - 2, y: cy + 20, w: 3, d: 4 };
  S.box({ ...ru, r: 0.4 }, 0, zTank(24) + 2, { tone: "hi" }, { steps: 2, ref: [ru.x + ru.w, ru.y + 2, 30] });
  const rf = k.sideMatrix([ru.x + ru.w, ru.y + ru.d], zTank(24), P, "right");
  let rt = "";
  for (let v = 0; v <= 24; v += 2) {
    const y = (24 - v) * 2.4;
    rt += `<path class="an-tick" d="M0 ${y.toFixed(2)}h${v % 6 ? 1.4 : 2.6}"/>`;
    if (v % 6 === 0) rt += txt(-0.8, y + 1.4, v, "an-num", "end");
  }
  rt += `<path class="an-target" d="M-0.4 ${((24 - state.V) * 2.4).toFixed(2)}h4"/>` + txt(4.4, (24 - state.V) * 2.4 + 1.4, `${state.V} В`, "ww-v");
  S.raw([ru.x + ru.w + 0.3, ru.y + 2, 30], `<g transform="${rf}">${rt}</g>`, { bias: 3 });

  // ── Труба: широкая → сужение → широкая → сопло над колесом ──
  S.group = "pipe";
  const r = pipeR(state.R);
  const out = [cx + 4, cy - TANK / 2 + 4];
  const route1 = [[out[0], out[1], zb + 1], [out[0], out[1], 6], [PIPE0[0], PIPE0[1], 4.2]];
  const narrow = [[PIPE0[0], PIPE0[1], 4.2], [PIPE1[0], PIPE1[1], 4.2]];
  const nozzle = [WHEEL[0], WHEEL[1] + WR * 0.55, WHEEL[2] + WR + 6];
  const route2 = [[PIPE1[0], PIPE1[1], 4.2], [WHEEL[0] - 8, WHEEL[1] + 26, 4.2], [WHEEL[0] - 8, WHEEL[1] + 26, nozzle[2]], [nozzle[0], nozzle[1], nozzle[2]]];
  S.tube(route1, PR, { tone: "mid", bendR: 5, maxLength: 12 });
  S.tube(narrow, r, { tone: "hi", maxLength: 10 });
  for (const p of narrow) S.cyl(p[0], p[1], 5.4, 0, 8, { tone: "mid" }, { bias: 0.5 }); // муфты по краям сужения
  S.tube(route2, PR, { tone: "mid", bendR: 5, maxLength: 12 });

  // ── Водяное колесо на стойках, лоток внизу ──
  S.group = "wheel";
  const [wx, wy, wz] = WHEEL;
  for (const dx of [-7, 7]) {
    S.box({ x: wx + dx - 1.5, y: wy - 3, w: 3, d: 6, r: 0.6 }, 0, wz + 1, { tone: "mid" }, { steps: 2, bevel: 0.2 });
  }
  S.box({ x: wx - 12, y: wy - 24, w: 24, d: 48, r: 2 }, 0, 3, { tone: "lo" }, { bevel: 0.3, layer: 0.6 });
  const wf = k.sideMatrix([wx + 1, wy], wz, P, "right");
  S.raw([wx + 1, wy, wz], `<g transform="${wf}"><g data-part="wheel"></g></g>`, { bias: 4 });
  S.tube([[wx - 8, wy, wz], [wx + 9, wy, wz]], 1.1, { tone: "hi" }, { bias: 6 });

  // ── Табличка с приставками ──
  S.group = "board";
  S.box({ x: BOARD.x - 6, y: BOARD.y + 8, w: 12, d: BOARD.d - 16, r: 1.4 }, 0, 3, { tone: "mid" }, { bevel: 0.3 });
  for (const yy of [BOARD.y + 12, BOARD.y + BOARD.d - 12]) S.box({ x: BOARD.x, y: yy - 1, w: 2, d: 2, r: 0.4 }, 3, BOARD.z0 - 3, { tone: "mid" }, { steps: 2 });
  S.box({ ...BOARD, r: 1 }, BOARD.z0, BOARD.h, { tone: "hi" }, { bevel: 0.3, ref: [BOARD.x + BOARD.w, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h / 2] });
  const bf = k.sideMatrix([BOARD.x + BOARD.w, BOARD.y + BOARD.d - 3], BOARD.z0 + BOARD.h - 3, P, "right");
  let bd = txt(1.5, 5, "Приставки", "ww-bt") + txt(1.5, 9.4, "кило ×1000 · милли ÷1000", "ww-bs");
  QS.forEach((q, i) => {
    const y = 16.5 + i * 6.4;
    const v = state[q.id];
    const ok = v ? v === q.right : null;
    bd += txt(1.5, y, q.q, "ww-bq") + txt(BOARD.d - 9, y, v ? optLabel(q, v) : "?", `ww-bq${ok === true ? " good" : ok === false ? " bad" : ""}`, "end") + (ok === null ? "" : txt(BOARD.d - 7.4, y, ok ? "✓" : "✗", `ww-bq${ok ? " good" : " bad"}`));
  });
  S.raw([BOARD.x + BOARD.w + 0.3, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h / 2], `<g transform="${bf}">${bd}</g>`, { bias: 3 });

  S.group = null;
  S.raw([0, 0, 300], `<g data-part="water"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Водопровод на столе: бак на колонне со шкалой вольт, труба с сужением, водяное колесо и табличка с приставками.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Бак = батарея", [cx, cy, zb + TANK_H], "Чем выше бак, тем сильнее давит вода — это напряжение (вольты)."],
    ["Сужение = сопротивление", [(PIPE0[0] + PIPE1[0]) / 2, (PIPE0[1] + PIPE1[1]) / 2, 8], "Чем уже труба, тем меньше воды проходит за секунду (омы)."],
    ["Колесо = мотор", [wx, wy, wz + WR], "Крутится тем сильнее, чем больше и давление, и поток: колесо получает больше энергии."],
    ["Табличка приставок", [BOARD.x + BOARD.w, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h], "Выбери ответы справа: перевод гига, милли и кило."],
  ]);
  const route = [...route1, ...narrow.slice(1), ...route2.slice(1)];
  return { svg, P, labels, model: M, live: { route: route.map(at), nozzle: at(nozzle), wheelC: at([wx + 1, wy, wz]), r }, parts: S.count() };
}

export const defaults = { V: 12, R: 8, q1: "", q2: "", q3: "" };
export const controls = [
  { id: "V", label: "Высота бака = напряжение", type: "range", min: 1, max: 24, step: 1, fmt: (v) => `${v} В`, rebuild: true },
  { id: "R", label: "Узость трубы = сопротивление", type: "range", min: 1, max: 24, step: 1, fmt: (v) => `${v} Ом`, rebuild: true },
  ...QS.map((q) => ({ id: q.id, label: `Табличка: ${q.q}`, type: "seg", options: q.opts, rebuild: true })),
];
export const tour = [
  { at: 0, set: { V: 12, R: 8 } },
  { at: 3, set: { V: 24, R: 4 } },
  { at: 6, set: { V: 12, R: 24 } },
  { at: 9, set: { V: 12, R: 6 } },
];

export function controller(root, built, state) {
  const L = built.live;
  const waterEl = root.querySelector('[data-part="water"]'), wheelEl = root.querySelector('[data-part="wheel"]');
  const sim = { t: 0, drops: Array.from({ length: 30 }, (_, i) => i / 30), angle: 0 };
  const M = built.model;
  // Длины участков маршрута трубы — чтобы капли шли равномерно.
  const pts = L.route, seg = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
  const along = (u) => { let d = u * tot; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= seg[i]; } return pts[pts.length - 1]; };
  return {
    tick(dt, calm) {
      if (!calm) { sim.t += dt; sim.drops = sim.drops.map((d) => (d + dt * M.I * 0.05) % 1); sim.angle += dt * Math.min(M.P, 150) * 0.05; }
      // Капли в трубе и струя на колесо.
      let w = "";
      const rr = Math.max(0.9, L.r * 0.55);
      for (const d of sim.drops) { const [x, y] = along(d); w += `<circle class="ww-drop" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}"/>`; }
      const [nx, ny] = L.nozzle;
      const stream = Math.min(4, 0.6 + M.I * 0.5);
      w += `<path class="ww-stream" style="stroke-width:${stream.toFixed(1)}" d="M${nx.toFixed(1)} ${ny.toFixed(1)}l0 ${(14).toFixed(1)}"/>`;
      waterEl.innerHTML = w;
      // Колесо в плоскости, обращённой к зрителю: обод, спицы, лопатки.
      let g = `<circle r="${WR}" class="ww-rim"/><circle r="${WR - 3}" class="ww-rim2"/>`;
      for (let i = 0; i < 10; i++) {
        const a = sim.angle + (i * TAU) / 10;
        const x = Math.cos(a) * WR, y = Math.sin(a) * WR;
        g += `<path class="ww-spoke" d="M0 0L${x.toFixed(2)} ${y.toFixed(2)}"/><rect x="${(x - 2.6).toFixed(2)}" y="${(y - 2.6).toFixed(2)}" width="5.2" height="5.2" rx="0.8" class="ww-bucket" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
      }
      g += `<circle r="2.4" class="ww-hub"/>`;
      wheelEl.innerHTML = g;
      return true;
    },
    facts() {
      return { I: M.I, P: M.P, unitsOk: M.unitsOk };
    },
    readout() {
      return `${state.V} В ÷ ${state.R} Ом = ${fmt(M.I, 2)} А · ${fmt(M.P, 1)} Вт`;
    },
    metrics() {
      return [
        ["Напряжение (высота бака)", `${state.V} В`, ""],
        ["Ток", `${state.V} ÷ ${state.R} = ${fmt(M.I, 2)} А`, ""],
        ["Мощность = В × А", `${state.V} × ${fmt(M.I, 2)} = ${fmt(M.P, 1)} Вт`, ""],
        ["Приставки", `${M.units.filter((u) => u === true).length} из 3 верно`, ""],
      ];
    },
    note() {
      if (state.V >= 10 && M.P < 6) return "<b>Давление есть, но узкая труба почти не пропускает воду:</b> ток мал, и мощность мала. Высокое сопротивление «душит» поток даже при полном баке.";
      if (M.P > 50) return `<b>${state.V} В × ${fmt(M.I, 2)} А = ${fmt(M.P, 1)} Вт.</b> Высокий бак даёт давление, широкая труба — большой поток; колесо получает и то и другое. Так и мотору нужны и вольты, и амперы.`;
      return `Ток: ${state.V} ÷ ${state.R} = <b>${fmt(M.I, 2)} А</b>. Мощность: <b>${fmt(M.P, 1)} Вт</b>.`;
    },
  };
}
