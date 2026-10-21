// Fig: Failsafe. Пульт с выключателем, приёмник с ползунком Cut / FS Pos, стойка из четырёх
// ползунков каналов на линейках 1000–2000, таймер этапов и мотор, который глохнет на этапе 2.
import { k, G, scene, basePlate, rulerStrip, labelPlate, pcb, motor, propSvg, dialGauge, TAU, fmt, clamp, labelsAt } from "../figkit.mjs";
import { failsafe, channelValue } from "../models.mjs";

const W = 640, H = 380;
const PLATE = { x: -152, y: -80, w: 304, d: 160, r: 8 };
const RACK = { x: -58, y: -44, w: 148, d: 84, r: 4 };
const SLOT_X0 = RACK.x + 16, SLOT_LEN = 116; // 1000 → SLOT_X0, 2000 → +SLOT_LEN
const SLOTS = [-30, -10, 10, 28].map((dy) => RACK.y + RACK.d / 2 + dy - 4);
const HS = { x: -140, y: -70, w: 62, d: 40, r: 6 };
const RXB = { x: -116, y: 6, w: 24, d: 18, r: 1.5 };
const TIMER = [120, 52];
const MOT = [126, -62];
const CH = ["Газ", "Оси (крен/тангаж/рыскание)", "AUX1 · ARM", "AUX2 · режим"];

export const meta = {
  id: "failsafe",
  title: "Failsafe",
  hint: "Связь — флажок справа",
  keys: [
    { mark: "lit", label: "Ползунки каналов: что FC получает сейчас" },
    { mark: "raised", label: "Пульт, приёмник, стойка каналов" },
    { mark: "edge", label: "Таймер: этап 1 до failsafe_delay, дальше этап 2" },
  ],
  caption: "Связь пропала — приёмник должен замолчать (Cut), тогда полётник это видит: этап 1 ставит каналы в значения failsafe на failsafe_delay (по умолчанию 1,5 с, Betaflight 4.5), этап 2 — Drop, Land или GPS Rescue. В режиме FS Pos приёмник шлёт «запомненные стики», и Failsafe полётника не включается. Значения каналов: ~1000 низ, 1500 центр, 2000 верх.",
  try: [
    "Выключи связь при «Cut»: ползунки встанут по профилю, через 1,5 с мотор заглохнет (Drop).",
    "Поставь «FS Pos» и выключи связь: таймер не идёт, мотор крутится — полётник не знает о потере.",
    "Профиль «выровняться и набрать высоту»: газ встаёт на 1800, режим — ANGLE.",
  ],
  missions: [
    { id: "drop", look: ["timer","motor"], touch: ["link"], see: "таймер этапов и мотор",  text: "Выключи связь и дождись этапа 2: моторы выключатся", check: (f) => f.stage === 2 },
    { id: "hidden", look: ["rx","rack"], touch: ["rx=fspos","link"], see: "каретки каналов после обрыва",  text: "Поставь приёмник в FS Pos и выключи связь: Failsafe не включится", check: (f, s) => s.rx === "fspos" && !s.link && f.since > s.delay + 0.3,
      predict: { q: "Приёмник в FS Pos, связь пропала. Что видит полётник?", options: ["Обрыв: включится Failsafe", "Команды идут — запомненные стики. Failsafe полётника не включится", "Сразу этап 2, моторы глохнут"], right: 1 },
      confirm: { q: "Почему при FS Pos этап Failsafe не начинается?", options: ["Полётник выключен", "Приёмник не замолкает, а шлёт каналы, и полётник думает, что связь есть. В Cut приёмник молчит — Failsafe включается", "AUX всегда держит газ"], right: 1, miss: "Cut: приёмник замолчал — полётник видит обрыв. FS Pos: приёмник шлёт запомненные стики — обрыва полётник не видит." } },
    { id: "climb", look: ["rack","timer"], touch: ["profile=climb","link"], see: "каретки каналов на этапе 1",  text: "Выбери профиль «выровняться и набрать» и посмотри этап 1", check: (f, s) => s.profile === "climb" && f.stage === 1 },
    { id: "back", look: ["rack","motor"], touch: ["link"], see: "возвращается ли управление",  text: "После обрыва верни связь: управление вернулось", check: (f, s) => s.link && f.hadFs },
  ],
};

// Метка failsafe_delay на шкале таймера (3 с на оборот). Двигается без пересборки стенда,
// чтобы смена задержки не обнуляла таймер обрыва.
const delayMark = (delay, top, P) => {
  const da = (delay / 3) * TAU;
  return k.lineOnTop([TIMER[0] + Math.sin(da) * 9, TIMER[1] - Math.cos(da) * 9], [TIMER[0] + Math.sin(da) * 15.4, TIMER[1] - Math.cos(da) * 15.4], top + 0.1, P);
};
function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [MOT[0], MOT[1] - 50, 40], [HS.x, HS.y - 10, 60]], W, H, { pad: 24, azimuth: 46 });
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  basePlate(S, PLATE);
  rulerStrip(S, { x: -138, y: PLATE.y + PLATE.d - 15, w: 170, d: 7, r: 1 });
  labelPlate(S, { x: 46, y: PLATE.y + PLATE.d - 26, w: 44, d: 17, r: 1.5 }, "FAILSAFE");

  S.group = "pult";
  // Пульт с выключателем питания.
  S.box(HS, 0, 12, { tone: "mid", inner: k.lineSvg(k.sideSeam(HS, 6, P, 6), { tone: "faint" }) }, { bevel: 0.9 });
  // Всё, что стоит на крышке пульта, сортируется после корпуса.
  const onTop = { bias: 30 };
  for (const gx of [HS.x + 15, HS.x + HS.w - 15]) {
    S.line(k.ring(gx, HS.y + 20, 8, 12, P, 40), { tone: "lo" }, [gx, HS.y + 20, 12.1], onTop);
    S.cyl(gx, HS.y + 20, 5, 12, 1.4, { tone: "hi" }, onTop);
    S.tube([[gx, HS.y + 20, 13.4], [gx, HS.y + 20, 24]], 1, { tone: "hi" }, onTop);
    S.solid(G.sphereOf([gx, HS.y + 20, 25.5], 2.4, P, { steps: 24 }), { tone: "hi" }, [gx, HS.y + 20, 25.5], onTop);
  }
  S.cyl(HS.x + 8, HS.y + 5, 2.6, 12, 3, { tone: "mid" }, onTop);
  S.tube([[HS.x + 8, HS.y + 5, 15], [HS.x + 8, HS.y + 5, 52]], 1.4, { tone: "hi", maxLength: 40 }, onTop);
  S.raw([HS.x + HS.w / 2, HS.y + HS.d - 8, 13], `<g data-part="power"></g>`, { bias: 2 });

  S.group = "rx";
  // Приёмник с переключателем режима при обрыве.
  S.box({ x: RXB.x - 3, y: RXB.y - 3, w: RXB.w + 6, d: RXB.d + 6, r: 2 }, 0, 4, { tone: "lo" });
  const rxTop = pcb(S, RXB, 4, { holes: false, chips: [{ x: RXB.x + 10, y: RXB.y + 8, w: 6, d: 6, legs: 3, dot: true }] });
  S.raw([RXB.x + 3, RXB.y + RXB.d - 3, rxTop + 0.4], `<g data-part="led"></g>`, { bias: 2 });
  const sw = { x: RXB.x + RXB.w - 7, y: RXB.y + 3, w: 5, d: 10, r: 0.8 };
  S.box(sw, rxTop, 1.6, { tone: "lo" }, { steps: 2 });
  S.box({ x: sw.x + 1, y: state.rx === "cut" ? sw.y + 1 : sw.y + 5.6, w: 3, d: 3.4, r: 0.5 }, rxTop + 1.6, 1.6, { tone: "hi", lit: state.rx === "fspos" }, { steps: 2, bias: 1 });
  S.tube([[RXB.x + 2, RXB.y + 4, rxTop], [RXB.x - 10, RXB.y + 4, 4], [RXB.x - 12, RXB.y + 4, 4]], 0.5, { tone: "mid", bendR: 2 });
  S.tube([[RXB.x - 12, RXB.y - 14, 4], [RXB.x - 12, RXB.y + 22, 4]], 1.1, { tone: "hi", maxLength: 40 });
  // Кабель RX → стойка каналов (это вход полётника).
  S.tube([[RXB.x + RXB.w, RXB.y + 12, rxTop], [RXB.x + RXB.w + 14, RXB.y + 12, 6], [RACK.x - 8, RACK.y + RACK.d - 14, 6], [RACK.x, RACK.y + RACK.d - 14, 6]], 0.9, { tone: "mid", bendR: 8 });

  S.group = "rack";
  // Стойка каналов: корпус, четыре паза с линейками, каретки (каретки двигаются).
  S.box(RACK, 0, 10, { tone: "mid", inner: k.lineSvg(k.sideSeam(RACK, 3, P, 6), { tone: "faint" }) }, { bevel: 0.9 });
  S.line(k.planOutline(k.insetPlan(RACK, 4), 10, P, 6), { tone: "faint" }, [RACK.x + RACK.w / 2, RACK.y + RACK.d / 2, 10.1]);
  const carriages = [];
  SLOTS.forEach((y, i) => {
    const slot = { x: SLOT_X0 - 4, y: y - 2, w: SLOT_LEN + 8, d: 4, r: 2 };
    const C = [RACK.x + RACK.w / 2, RACK.y + RACK.d / 2];
    S.line(k.planOutline(slot, 10, P, 4), { tone: "lo" }, [C[0], C[1], 10.15], { bias: i * 0.1 });
    const strip = { x: SLOT_X0 - 2, y: y + 3.4, w: SLOT_LEN + 4, d: 4.6, r: 0.6 };
    S.box(strip, 10, 0.5, { tone: "lo", crease: "none" }, { steps: 2, ref: [C[0], C[1], 10.2], bias: i * 0.1 });
    const t = k.topTicks(SLOT_X0, SLOT_X0 + SLOT_LEN, SLOT_LEN / 20, 10, y + 3.8, 10.5, [1.2, 3.2], P);
    const mid = k.lineOnTop([SLOT_X0 + SLOT_LEN / 2, y + 3.8], [SLOT_X0 + SLOT_LEN / 2, y + 7.8], 10.5, P);
    S.line(t.minor, { tone: "lo" }, [C[0], C[1], 10.6], { bias: i * 0.1 });
    S.line(t.major + mid, { tone: "mid" }, [C[0], C[1], 10.6], { bias: i * 0.1 });
    S.raw([C[0], C[1], 14], `<g data-slider="${i}"></g>`, { bias: 1 + i * 0.1 });
    carriages.push(y);
  });
  S.group = "timer";
  // Таймер этапов.
  S.box({ x: TIMER[0] - 22, y: TIMER[1] - 22, w: 44, d: 44, r: 4 }, 0, 8, { tone: "mid" }, { bevel: 0.7 });
  const dial = dialGauge(S, TIMER[0], TIMER[1], 8, 18, { h: 7, ticks: 30, every: 5, face: "s" });
  S.raw([TIMER[0], TIMER[1], dial.top + 0.2], k.lineSvg(delayMark(state.delay, dial.top, P), { tone: "hi", free: "start" }).replace("<path", '<path data-part="mark"'), { bias: 1 });
  S.raw([TIMER[0], TIMER[1], 30], `<path data-part="timer" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${dial.needle(0)}"/>`, { bias: 50 });
  S.group = "motor";
  // Мотор на стойке с лучом.
  const arm = { x: MOT[0] - 50, y: MOT[1] - 6, w: 50, d: 12, r: 2 };
  S.box({ x: arm.x - 14, y: arm.y - 8, w: 24, d: 28, r: 3 }, 0, 18, { tone: "mid" }, { bevel: 0.6 });
  S.box(arm, 18, 4, { tone: "mid" }, { bevel: 0.4 });
  const mtop = motor(S, MOT[0], MOT[1], 22, { r: 12, h: 14 }).top;
  S.tube([[arm.x - 4, RACK.y - 0.2, 5], [arm.x - 4, RACK.y - 2, 3.4], [arm.x - 4, arm.y + 13.8, 4.6]], 0.9, { tone: "mid", bendR: 1.2 });
  S.raw([MOT[0], MOT[1], mtop + 30], `<g data-part="prop">${propSvg(P, MOT[0], MOT[1], mtop + 1.2, 46, 0.2)}</g>`, { bias: 100 });
  S.group = null;
  const live = { needle: dial.needle, mtop, carriages, top: dial.top };
  const svg = k.figureSvg({ width: W, height: H, label: "Стенд Failsafe: пульт с выключателем, приёмник с переключателем Cut или FS Pos, стойка с четырьмя ползунками каналов на шкалах от 1000 до 2000, таймер этапов и мотор с пропеллером.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Пульт", [HS.x + HS.w / 2, HS.y + HS.d / 2, 12], "Выключи пульт — связь пропадёт, как при обрыве в полёте."],
    ["Приёмник", [RXB.x + RXB.w / 2, RXB.y + RXB.d / 2, 6], "При обрыве либо молчит (Cut), либо шлёт «запомненные стики» (FS Pos — опасно)."],
    ["Каналы на входе полётника", [RACK.x + RACK.w / 2, RACK.y + RACK.d / 2, 10], "Что полётник получает по каждому каналу: газ, оси, ARM, режим."],
    ["Таймер этапов", [TIMER[0], TIMER[1], 15], "Сколько прошло без связи. Метка — failsafe_delay: после неё начинается этап 2."],
    ["Мотор", [MOT[0], MOT[1], 30], "На этапе 2 Failsafe моторы выключаются."],
  ]);
  return { svg, P, labels, live, parts: S.count() };
}

export const defaults = { link: true, rx: "cut", profile: "default", delay: 1.5, mode: "ANGLE" };
export const controls = [
  { id: "link", label: "Связь с пультом", type: "check" },
  { id: "rx", label: "Приёмник при обрыве", type: "seg", options: [["cut", "Cut (молчит)"], ["fspos", "FS Pos"]], rebuild: true },
  { id: "profile", label: "Профиль каналов", type: "select", options: [["default", "по умолчанию: газ Auto, оси Auto"], ["keep", "«продолжить как летел»: газ Hold"], ["climb", "«выровняться и набрать»: газ Set 1800, режим ANGLE"]] },
  { id: "delay", label: "failsafe_delay", type: "range", min: 0.5, max: 3, step: 0.1, fmt: (v) => `${fmt(v, 1)} с` },
  { id: "mode", label: "Режим полёта до обрыва", type: "seg", options: [["ACRO", "Acro"], ["ANGLE", "Angle"]] },
];
export const tour = [
  { at: 0, set: { link: true } },
  { at: 3, set: { link: false } },
  { at: 8, set: { link: true } },
];

export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const sliders = [...root.querySelectorAll("[data-slider]")];
  const timer = root.querySelector('[data-part="timer"]');
  const mark = root.querySelector('[data-part="mark"]');
  const prop = root.querySelector('[data-part="prop"]');
  const power = root.querySelector('[data-part="power"]');
  const led = root.querySelector('[data-part="led"]');
  const sim = { t: 0, since: 0, spin: 0.6, angle: 0.2, vals: [1350, 1500, 1800, 1800], last: [1350, 1500, 1800, 1800], fs: null };
  const slider = (i, v) => {
    const y = L.carriages[i];
    const x = SLOT_X0 + ((clamp(v, 1000, 2000) - 1000) / 1000) * SLOT_LEN;
    const c = { x: x - 6, y: y - 5, w: 12, d: 10, r: 2 };
    return k.solidSvg(k.slabOf(c, 10, 3.4, P, 3, 0.4), { tone: "hi", lit: true }) + k.lineSvg(k.lineOnTop([x, y - 3], [x, y + 3], 13.4, P), { tone: "mid" }) + k.solidSvg(k.cylinder(x, y, 2, 13.4, 3, P, 16), { tone: "hi" });
  };
  return {
    tick(dt, calm, st) {
      sim.t += dt;
      if (st.link) sim.since = 0;
      else sim.since += dt;
      const fs = failsafe({ armed: true, link: st.link, since: sim.since, delay: st.delay, rx: st.rx, profile: st.profile });
      sim.fs = fs;
      sim.fcSince = fs.hidden ? 0 : sim.since; // FS Pos: полётник не видит потерю, его таймер стоит
      if (fs.stage >= 1) sim.hadFs = true;
      // Живые стики пульта (покачиваются).
      const live = [1350 + Math.sin(sim.t * 0.8) * 120, 1500 + Math.sin(sim.t * 1.3) * 160, 1800, st.mode === "ANGLE" ? 1800 : 1200];
      let target;
      if (st.link) {
        target = live;
        sim.last = live.slice();
      } else if (fs.hidden) target = sim.last; // FS Pos: «запомненные стики»
      else if (fs.stage === 0) target = sim.last;
      else {
        const c = fs.channels;
        target = [channelValue(c.thr, sim.last[0], 1800, true), channelValue(c.axes, sim.last[1], 1500, false), channelValue(c.arm, sim.last[2], 1000, false), channelValue(c.mode, sim.last[3], 1800, false)];
        if (fs.stage === 2) target[0] = 1000;
      }
      sim.vals = sim.vals.map((v, i) => (calm ? target[i] : v + (target[i] - v) * (1 - Math.exp(-dt / 0.18))));
      sliders.forEach((el, i) => (el.innerHTML = slider(i, sim.vals[i])));
      timer.setAttribute("d", L.needle(Math.min(sim.fcSince, 3) / 3));
      if (mark) mark.setAttribute("d", delayMark(st.delay, L.top, P));
      const on = fs.motors ? 0.3 + ((sim.vals[0] - 1000) / 1000) * 1.4 : 0;
      sim.spin += (on - sim.spin) * (calm ? 1 : 1 - Math.exp(-dt / 0.4));
      if (!calm) sim.angle += sim.spin * TAU * dt;
      prop.innerHTML = propSvg(P, MOT[0], MOT[1], L.mtop + 1.2, 46, sim.angle);
      const pwr = [HS.x + HS.w / 2, HS.y + HS.d - 8, 12];
      power.innerHTML = k.solidSvg(k.slabOf({ x: pwr[0] - 4, y: pwr[1] - 2.5, w: 8, d: 5, r: 1 }, 12, 1.4, P, 2), { tone: "mid" }) + k.solidSvg(k.slabOf({ x: pwr[0] + (st.link ? 0 : -3.4), y: pwr[1] - 1.8, w: 3.4, d: 3.6, r: 0.6 }, 13.4, 1.6, P, 2), { tone: "hi", lit: st.link });
      const ledOn = st.link ? 1 : Math.floor(sim.t * 2) % 2 ? 0.2 : 0.9;
      led.innerHTML = k.dotsSvg([k.iso([RXB.x + 3, RXB.y + RXB.d - 3, 5.8], P)], { size: 1.1, tone: "hi" });
      led.style.opacity = ledOn;
      return true;
    },
    facts() {
      return { stage: sim.fs ? sim.fs.stage : 0, since: sim.since, hadFs: !!sim.hadFs };
    },
    readout() {
      return sim.fs ? sim.fs.label : "";
    },
    metrics() {
      const c = sim.fs ? sim.fs.channels : {};
      const modeName = (m) => ({ auto: "Auto", hold: "Hold", set: "Set" })[m] || m;
      const v = sim.vals.map((x) => fmt(x));
      return [
        [CH[0], `${v[0]} · ${modeName(c.thr)}`, ""],
        [CH[1], `${v[1]} · ${modeName(c.axes)}`, ""],
        [CH[2], `${v[2]} · ${modeName(c.arm)} (AUX — только Hold/Set)`, "BF 4.4+"],
        [CH[3], `${v[3]} · ${modeName(c.mode)}`, ""],
        ["Время без связи", `${fmt(sim.fcSince || 0, 1)} с из ${fmt(state.delay, 1)} с`, "по умолч. 1,5 с"],
        ["Поведение борта", behaviour(), ""],
      ];
    },
  };
  function behaviour() {
    const fs = sim.fs;
    if (!fs) return "";
    if (fs.phase === "ok") return "управляется пилотом";
    if (fs.hidden) return "продолжает выполнять последние команды — опасно";
    if (fs.stage === 2) return "моторы выключены (Drop)";
    if (state.profile === "keep") return state.mode === "ACRO" ? "Acro: оси в центр = «не вращаться», держит наклон и летит прежним курсом" : "Angle: выравнивается, газ прежний";
    if (state.profile === "climb") return "Angle выравнивает, газ 1800 поднимает — шанс вернуть связь";
    return "газ в минимум, оси в центр";
  }
}
