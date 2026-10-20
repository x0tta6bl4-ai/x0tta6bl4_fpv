// Fig: тренажёр полёта. Поле в клетку, стартовая площадка, флажок; дрон управляется стиками (Mode 2), режим как
// Angle: правый стик задаёт наклон, отпустил — дрон выравнивается. Над дроном — стрелка тяги T вдоль оси моторов
// и вес mg вниз; тень на земле показывает высоту. Физика — та же, что в плоском тренажёре книги.
import { k, G, scene, basePlate, labelPlate, propSvg, fmt, clamp, TAU, labelsAt, ellipseOnTop } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -80, y: -108, w: 160, d: 216, r: 8 };
// Поле тренажёра в «точках» (360 × 260, 30 точек = 1 м) → мир стенда.
const SC = 0.55;
const toW = (px, py) => [(py - 130) * SC, -(px - 180) * SC];
const zOf = (h) => 6 + Math.min(h, 150) * 0.4;
const MOTORS = [
  { n: 1, x: 1, y: 1, cw: true },
  { n: 2, x: 1, y: -1, cw: false },
  { n: 3, x: -1, y: 1, cw: false },
  { n: 4, x: -1, y: -1, cw: true },
];
const MAXT = (35 * Math.PI) / 180;
const PX_M = 30;
const YAW_GOAL = 2.6;
const FLAG = [290, 80];
const START = { x: 180, y: 190 };
const ARM = 16; // вынос моторов от центра (мир)

export const meta = {
  id: "flyfield",
  title: "Тренажёр полёта",
  hint: "Стики пульта — под стендом",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Стрелка T — тяга винтов вдоль оси моторов; вниз — вес mg; тень — где дрон над землёй" },
    { mark: "raised", label: "Поле в клетку (1 м), стартовая площадка, флажок, дрон с номерами моторов" },
    { mark: "edge", label: "Прозрачный диск у винта — чем плотнее, тем быстрее крутится мотор" },
  ],
  caption: "Газ (левый стик вверх) одинаково ускоряет все четыре мотора. Поворот: полётник ускоряет одну диагональ (винты 2 и 3 крутятся против часовой, 1 и 4 — по часовой) и замедляет другую — реактивный момент больше не уравновешен, корпус разворачивается. Наклон: быстрее крутятся моторы с одной стороны; вверх идёт только T·cos α, вбок — T·sin α, поэтому в наклоне нужно больше газа. Упрощения: висение около 50 % газа, сопротивление воздуха завышено, ветра нет.",
  aria: "Под стендом два стика пульта: левый — газ и поворот, правый — наклоны. Галочка «Неправильный винт на моторе 2».",
  missions: [
    {
      id: "takeoff", look: ["drone"], touch: ["sticks"], see: "тень дрона и диски винтов",
      text: "Взлети: подними левый стик (газ), пока дрон не оторвётся от земли",
      check: (f) => f.air,
      predict: { q: "Что делает левый стик вверх-вниз?", options: ["Наклоняет дрон вперёд", "Газ: все четыре мотора крутятся быстрее", "Поворачивает дрон"], right: 1 },
      setup: { wrong: false, throttle: 0, yaw: 0, roll: 0, pitch: 0 },
    },
    {
      id: "yaw", look: ["drone"], touch: ["sticks"], see: "диски винтов: какая диагональ быстрее",
      text: "Разверни дрон носом в другую сторону только левым стиком (влево-вправо)",
      check: (f) => f.yawTurned,
      predict: { q: "Как квадрокоптер поворачивается без руля?", options: ["Ускоряет винты одной диагонали и замедляет другую", "Наклоняется набок", "Выключает один мотор"], right: 0 },
      setup: { wrong: false, throttle: 0, yaw: 0, roll: 0, pitch: 0 },
    },
    {
      id: "flag", look: ["flag", "drone"], touch: ["sticks"], see: "флажок и стрелку тяги при наклоне",
      text: "Долети до флажка правым стиком",
      check: (f) => f.atFlag,
      predict: { q: "Как полететь вперёд?", options: ["Правый стик от себя: задние моторы быстрее, нос опускается", "Левый стик вверх", "Левый стик вбок"], right: 0 },
      setup: { wrong: false, throttle: 0, yaw: 0, roll: 0, pitch: 0 },
    },
    {
      id: "flip", look: ["drone"], touch: ["wrong", "sticks"], see: "мотор 2 с красным кольцом",
      text: "Включи «неправильный винт» и попробуй взлететь. Что случилось?",
      check: (f) => f.flipped,
      predict: { q: "На моторе 2 стоит винт не того направления вращения. Что будет на взлёте?", options: ["Взлетит, но медленнее", "Кувырнётся: тяга этого угла направлена вниз", "Будет крутиться на месте"], right: 1 },
      setup: { wrong: false, throttle: 0, yaw: 0, roll: 0, pitch: 0 },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [0, 0, zOf(150) + 10]], W, H, { pad: 18, azimuth: 36 });
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  basePlate(S, PLATE);
  labelPlate(S, { x: 56, y: 84, w: 18, d: 18, r: 1.5 });
  // ── Поле в клетку: шаг 1 м ──
  S.group = null;
  let grid = "";
  for (let px = 0; px <= 360; px += 30) { const a = toW(px, 10), b = toW(px, 250); grid += k.lineOnTop([a[0], a[1]], [b[0], b[1]], 0, P); }
  for (let py = 10; py <= 250; py += 30) { const a = toW(0, py), b = toW(360, py); grid += k.lineOnTop([a[0], a[1]], [b[0], b[1]], 0, P); }
  S.raw(-5e8, k.lineSvg(grid, { tone: "faint" }), { layer: 0.2 });
  const [sx, sy] = toW(START.x, START.y);
  S.group = "pad";
  S.raw(-4.9e8, k.lineSvg(k.ring(sx, sy, 12, 0, P, 48) + k.ring(sx, sy, 10.6, 0, P, 48), { tone: "mid" }), { layer: 0.25 });
  // ── Флажок с кругом цели ──
  S.group = "flag";
  const [fx, fy] = toW(FLAG[0], FLAG[1]);
  S.raw(-4.8e8, `<path class="ff-target" d="${k.ring(fx, fy, 22 * SC, 0, P, 48)}"/>`, { layer: 0.25 });
  S.cyl(fx, fy, 2.4, 0, 1.2, { tone: "mid" });
  S.tube([[fx, fy, 1.2], [fx, fy, 28]], 0.6, { tone: "mid" });
  const fl = [[fx, fy, 28], [fx, fy - 9, 25], [fx, fy, 22]].map((p) => k.iso(p, P));
  S.raw([fx, fy - 4, 25], `<path class="ff-flag" d="M${fl.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/>`, { bias: 1 });
  S.group = "drone";
  S.raw([0, 0, 300], `<g data-part="drone"></g>`, { bias: 1e5 });
  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Тренажёр полёта: поле в клетку, стартовая площадка, флажок и дрон, которым управляют стики пульта.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Флажок", [fx, fy, 28], "Цель задания 3. Долети до круга вокруг флажка."],
    ["Старт дрона", [sx, sy, 0], "Здесь дрон стоит до взлёта; после кувырка возвращается сюда. В полёте у моторов появляются их номера в Betaflight и стрелки — направление вращения."],
  ]);
  return { svg, P, labels, parts: S.count() };
}

export const defaults = { wrong: false, throttle: 0, yaw: 0, roll: 0, pitch: 0 };
export const controls = [
  { id: "sticks", label: "Стики пульта (Mode 2) — тяни кружки", type: "sticks", fmt: (s) => `газ ${Math.round((s.throttle || 0) * 100)} % · поворот ${Math.round((s.yaw || 0) * 100)} % · тангаж ${Math.round((s.pitch || 0) * 100)} % · крен ${Math.round((s.roll || 0) * 100)} %` },
  { id: "wrong", label: "Неправильный винт на моторе 2", type: "check", rebuild: true, resets: ["throttle", "yaw", "roll", "pitch"] },
];
export const tour = [
  { at: 0, set: { throttle: 0.62 } },
  { at: 2.5, set: { throttle: 0.55, yaw: 1 } },
  { at: 4.5, set: { yaw: 0 } },
  { at: 5.5, set: { pitch: 0.7 } },
  { at: 7, set: { pitch: 0 } },
  { at: 9, set: { throttle: 0 } },
];

export function controller(root, built, state) {
  const P = built.P;
  const el = root.querySelector('[data-part="drone"]');
  const s = { ...START, h: 0, vx: 0, vy: 0, vh: 0, yaw: -Math.PI / 2, wy: 0, flip: 0, yaw0: null, tp: 0, tr: 0, spin: [0, 0, 0, 0], m: [0, 0, 0, 0], total: 0, air: false, flipped: false, yawTurned: false, atFlag: false, msg: "" };
  const reset = () => Object.assign(s, { ...START, h: 0, vx: 0, vy: 0, vh: 0, yaw: -Math.PI / 2, wy: 0, flip: 0, yaw0: null, tp: 0, tr: 0 });
  function step(dt, st) {
    const thr = st.throttle || 0, iy = st.yaw || 0, ip = st.pitch || 0, ir = st.roll || 0;
    const raw = MOTORS.map((M) => thr + ip * 0.18 * (M.y > 0 ? 1 : -1) + ir * 0.18 * (M.x < 0 ? 1 : -1) + iy * 0.16 * (M.cw ? -1 : 1));
    const over = Math.max(...raw) - 1;
    const m = raw.map((v) => clamp(over > 0 ? v - over : v, 0, 1));
    const thrust = m.map((v, i) => (st.wrong && i === 1 ? -0.35 * v : v));
    const total = thrust.reduce((a, b) => a + b, 0);
    s.m = m;
    s.total = total;
    const air = s.h > 0.5;
    const k0 = Math.min(1, dt * 6);
    s.tp += ((air ? ip * MAXT : 0) - s.tp) * k0;
    s.tr += ((air ? ir * MAXT : 0) - s.tr) * k0;
    const tilt = Math.min(Math.hypot(s.tp, s.tr), MAXT * 1.2);
    if (s.flip > 0) {
      s.flip -= dt;
      if (s.flip <= 0) reset();
      return;
    }
    if (st.wrong && thr > 0.3) {
      s.flip = 1.6;
      s.flipped = true;
      s.msg = "<b>Кувырок на взлёте!</b> На моторе 2 винт не того направления вращения: он гонит воздух вверх, и тяга этого угла направлена вниз. Тяга несимметрична — дрон опрокидывается при первой попытке взлететь.";
      return;
    }
    s.vh += (total * Math.cos(tilt) * 2.1 - 4.2) * dt * 9;
    s.vh *= 1 - dt * 1.6;
    s.h = Math.min(150, Math.max(0, s.h + s.vh * dt));
    if (s.h === 0 && s.vh < 0) s.vh = 0;
    if (s.h === 150 && s.vh > 0) s.vh = 0;
    const torque = (m[1] + m[2] - m[0] - m[3]) / 2;
    if (air) {
      const Th = Math.min(Math.max(total, 0), 2.6);
      const fwd = Th * Math.sin(s.tp) * 190, side = Th * Math.sin(s.tr) * 190;
      s.vx += (Math.cos(s.yaw) * fwd + Math.cos(s.yaw + Math.PI / 2) * side) * dt;
      s.vy += (Math.sin(s.yaw) * fwd + Math.sin(s.yaw + Math.PI / 2) * side) * dt;
      s.wy += torque * 30 * dt;
    }
    s.vx *= 1 - dt * 1.8;
    s.vy *= 1 - dt * 1.8;
    s.wy *= 1 - dt * 4;
    s.yaw += s.wy * dt;
    s.x = clamp(s.x + s.vx * dt, 20, 340);
    s.y = clamp(s.y + s.vy * dt, 20, 240);
    if (air) {
      s.air = true;
      if (s.yaw0 === null) s.yaw0 = s.yaw;
      if (Math.abs(s.yaw - s.yaw0) > YAW_GOAL) s.yawTurned = true;
      if (Math.hypot(s.x - FLAG[0], s.y - FLAG[1]) < 22) s.atFlag = true;
    }
    const deg = Math.round((tilt * 180) / Math.PI);
    const vert = s.vh > 0.4 ? "up" : s.vh < -0.4 ? "down" : "hold";
    if (!air) s.msg = thr < 0.45 ? "Дрон на земле. Подними левый стик вверх — это газ: все четыре мотора крутятся быстрее." : "Ещё чуть-чуть газа: тяга почти равна весу.";
    else if (Math.abs(iy) > 0.2) s.msg = `<b>Поворот ${iy > 0 ? "вправо" : "влево"}:</b> полётник ускоряет винты ${iy > 0 ? "2 и 3 (против часовой)" : "1 и 4 (по часовой)"} и замедляет другую диагональ, сохраняя общую тягу. «Закручивание» корпуса больше не уравновешено — дрон разворачивается.`;
    else if (deg > 4) {
      const dir = Math.abs(ip) >= Math.abs(ir) ? (ip > 0 ? "Вперёд: задние моторы 1 и 3 быстрее, нос опускается" : "Назад: быстрее передние моторы 2 и 4") : ir > 0 ? "Вправо: быстрее левые моторы 3 и 4" : "Влево: быстрее правые моторы 1 и 2";
      s.msg = `<b>${dir}.</b> Наклон ${deg}°: вверх идёт только T·cos α, вбок — T·sin α. ${vert === "down" ? "Дрон проседает — добавь газа." : vert === "up" ? "Газа с запасом — дрон ещё и поднимается." : "Газа хватает, высота держится."}`;
    } else if (vert === "up") s.msg = "<b>Подъём:</b> тяга больше веса. Соседние винты крутятся в разные стороны, моменты уравновешены — дрон не вертится.";
    else if (vert === "down") s.msg = "<b>Снижение:</b> тяга меньше веса. Добавь газа, чтобы зависнуть.";
    else s.msg = "<b>Висим:</b> тяга равна весу. Все четыре мотора крутятся одинаково, соседние — в разные стороны.";
  }
  function draw(st) {
    const S2 = scene(P);
    const [cx, cy] = toW(s.x, s.y);
    const z0 = zOf(s.h);
    const flipA = s.flip > 0 ? (1.6 - s.flip) * 9 : 0;
    // В точках поля нос смотрит вдоль (cos yaw, sin yaw); в мире это (sin yaw, −cos yaw), правый борт — (cos yaw, sin yaw).
    const F = [Math.sin(s.yaw), -Math.cos(s.yaw)];
    const R = [Math.cos(s.yaw), Math.sin(s.yaw)];
    const tp = s.flip > 0 ? Math.sin(flipA) * 1.2 : s.tp, tr = s.flip > 0 ? flipA : s.tr;
    // Тень и отвес до земли.
    const sh = `<path class="ff-shadow" style="opacity:${(0.32 - Math.min(s.h, 150) / 600).toFixed(2)}" d="${ellipseOnTop(cx, cy, 20, 20, 0, P, 40)}"/>` + (s.h > 2 ? `<path class="ff-plumb" d="${k.segment([cx, cy, 0], [cx, cy, z0 - 2], P)}"/>` : "");
    S2.raw(-1e6, sh, { layer: 0 });
    // Корпус, лучи, моторы.
    S2.cyl(cx, cy, 7.6, z0 - 1.6, 4, { tone: "hi", crease: "lo" }, { steps: 28 });
    const nose = [cx + F[0] * 9.4, cy + F[1] * 9.4, z0 + 1.6 - Math.sin(tp) * 9.4];
    S2.solid(G.sphereOf(nose, 2, P, { steps: 20 }), { tone: "hi", lit: true }, nose, { bias: 0.5 });
    const pos = MOTORS.map((M, i) => {
      const f = -M.y, r = M.x; // вперёд / вправо в долях выноса
      const x = cx + (F[0] * f + R[0] * r) * ARM * 0.7071 * 1.4;
      const y = cy + (F[1] * f + R[1] * r) * ARM * 0.7071 * 1.4;
      const z = z0 - f * ARM * Math.sin(tp) - r * ARM * Math.sin(tr);
      return [x, y, z, i];
    });
    for (const [x, y, z] of pos) S2.tube([[cx, cy, z0], [x, y, z]], 1.3, { tone: "mid", maxLength: 30 });
    let top = "";
    pos.forEach(([x, y, z, i]) => {
      S2.cyl(x, y, 4.2, z - 1, 4.6, { tone: "hi", crease: "lo" }, { steps: 20 });
      const pz = z + 4;
      const R2 = 11;
      const wrong = st.wrong && i === 1;
      top += `<path class="ff-disc${wrong ? " bad" : ""}" style="opacity:${(0.08 + s.m[i] * 0.42).toFixed(2)}" d="${ellipseOnTop(x, y, R2, R2, pz, P, 32)}"/>`;
      top += propSvg(P, x, y, pz, R2, s.spin[i], { blades: 2 });
      if (wrong) top += `<path class="iso-line" data-tone="red" style="stroke-width:1.3" d="${k.ring(x, y, R2 + 2, pz, P, 32)}"/>`;
      // Номера и направление вращения нужны, когда о моторах идёт речь: в полёте (подсказка называет
      // «винты 2 и 3»), при кувырке и с «неправильным винтом». На земле они только загромождают дрон.
      if (s.h > 0.5 || s.flip > 0 || st.wrong) {
        const n = k.iso([x, y, pz + 4], P);
        top += `<text x="${n[0].toFixed(1)}" y="${n[1].toFixed(1)}" class="ff-n" text-anchor="middle">${MOTORS[i].n}${MOTORS[i].cw ? "↻" : "↺"}</text>`;
      }
    });
    // Силы: тяга вдоль оси моторов и вес вниз.
    const T = Math.min(Math.max(0, s.total) * 7, 26);
    const nrm = [F[0] * Math.sin(tp) + R[0] * Math.sin(tr), F[1] * Math.sin(tp) + R[1] * Math.sin(tr), Math.cos(Math.hypot(tp, tr))];
    const a0 = [cx, cy, z0 + 3];
    const tip = [a0[0] + nrm[0] * T, a0[1] + nrm[1] * T, a0[2] + nrm[2] * T];
    const arrow = (p0, p1, cls) => {
      const A = k.iso(p0, P), B = k.iso(p1, P);
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
      if (L < 3) return "";
      const ux = dx / L, uy = dy / L;
      return `<path class="${cls}" d="M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}M${(B[0] - ux * 5 - uy * 3).toFixed(1)} ${(B[1] - uy * 5 + ux * 3).toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}L${(B[0] - ux * 5 + uy * 3).toFixed(1)} ${(B[1] - uy * 5 - ux * 3).toFixed(1)}"/>`;
    };
    let forces = "";
    if (s.flip <= 0 && s.total > 0.05) forces += arrow(a0, tip, "ff-t");
    if (s.h > 0.5 || s.flip > 0) forces += arrow([cx, cy, z0 - 2], [cx, cy, z0 - 16], "ff-g");
    el.innerHTML = S2.svg() + top + forces;
    el.dataset.pos = `${s.x.toFixed(1)} ${s.y.toFixed(1)} ${s.yaw.toFixed(3)}`; // для автотестов: точка поля и курс
  }
  return {
    tick(dt, calm, st) {
      if (!calm) {
        step(Math.min(dt, 0.05), st);
        s.spin = s.spin.map((a, i) => a + (s.m[i] * 18 + 1) * Math.min(dt, 0.05) * (MOTORS[i].cw ? 1 : -1));
      }
      draw(st);
      return true;
    },
    reset,
    // Камера на телефоне следит за дроном, пока он в воздухе (или кувыркается). Кадр чуть смещён
    // к флажку (на треть пути), чтобы цель задания 3 было видно, а дрон оставался в рамке.
    follow() {
      if (s.h <= 2 && s.flip <= 0) return null;
      const [cx, cy] = toW(s.x, s.y), [fx, fy] = toW(FLAG[0], FLAG[1]);
      const d = k.iso([cx, cy, zOf(s.h)], P), f = k.iso([fx, fy, 20], P);
      return [d[0] + (f[0] - d[0]) * 0.3, d[1] + (f[1] - d[1]) * 0.3];
    },
    facts() {
      return { air: s.air, yawTurned: s.yawTurned, atFlag: s.atFlag, flipped: s.flipped };
    },
    readout() {
      // Прогресс разворота — прямо в строке над сценой: отпустил стик раньше — дрон затормозил, и видно, сколько осталось.
      const turned = s.yaw0 === null ? 0 : Math.round((Math.abs(s.yaw - s.yaw0) * 180) / Math.PI);
      const goal = Math.round((YAW_GOAL * 180) / Math.PI);
      const yawChip = s.yawTurned ? " · ✓ развернулся" : s.air && turned >= 10 ? ` · разворот ${Math.min(turned, goal)}° из ${goal}°` : "";
      return `высота ${fmt(s.h / 10, 1)} м · газ ${Math.round((state.throttle || 0) * 100)} %${yawChip}`;
    },
    explain(chip) {
      if (/^разворот/.test(chip)) return "Держи левый стик вбок, пока не дойдёт до цели: отпустишь — винты выровняются, дрон затормозит и остановится. Тогда просто доверни.";
      if (/развернулся/.test(chip)) return "Нос смотрит в другую сторону: одна диагональ винтов крутилась быстрее, и корпус развернуло.";
      return "";
    },
    metrics() {
      const head = Math.round(((((s.yaw + Math.PI / 2) * 180) / Math.PI) % 360 + 360) % 360);
      return [
        ["Высота", `${fmt(s.h / 10, 1)} м`, ""],
        ["Курс", `${head}°`, ""],
        ["До флажка", `${fmt(Math.hypot(s.x - FLAG[0], s.y - FLAG[1]) / PX_M, 1)} м`, ""],
        ["Разворот", s.yaw0 === null ? "—" : `${Math.min(180, Math.round((Math.abs(s.yaw - s.yaw0) * 180) / Math.PI))}° из ${Math.round((YAW_GOAL * 180) / Math.PI)}°`, ""],
      ];
    },
    note() {
      return s.msg || "Подними левый стик вверх — это газ.";
    },
  };
}
