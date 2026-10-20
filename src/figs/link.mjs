// Fig: полигон связи. Пульт с модулем ELRS на подставке, дрон на каретке по длинному рельсу (расстояние),
// полоса леса, «чужой» передатчик-помеха и монитор очков с OSD. Пакеты летят по дуге от антенны пульта
// к антенне дрона: дошедшие гаснут у приёмника, потерянные краснеют. Числа — та же модель, что в книге.
import { k, G, scene, basePlate, rulerStrip, labelPlate, knob, motor, propSvg, TAU, fmt, clamp, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -150, y: -72, w: 300, d: 144, r: 8 };
const RAIL_Y = 10, X0 = -34, X1 = 122; // ход каретки по рельсу
const D_MIN = 0.2, D_MAX = 40; // км, шкала логарифмическая
const PULT = [-116, RAIL_Y];
const JAM = [10, -46]; // чужой передатчик — рядом с трассой дрона
const MON = { x: 66, y: -64, w: 68, d: 10, z0: 34, h: 46 }; // монитор очков (экран смотрит на зрителя)
const FOREST = { x: -80, y: -50, w: 32, d: 58, r: 4 }; // за линией связи, чтобы не заслонять пульт

// Чувствительность ELRS (по книге): чем реже пакеты, тем тише сигнал можно разобрать.
export const RATES = {
  25: { l: "25 Гц", sens: -123, f: 915, hz: 25, a: -0.9 },
  50: { l: "50 Гц", sens: -120, f: 915, hz: 50, a: -0.3 },
  D50: { l: "D50", sens: -112, f: 915, hz: 50, dup: true, a: 0.3 },
  500: { l: "500 Гц", sens: -105, f: 2440, hz: 500, a: 0.9 },
};
// Модель: 1 Вт (30 dBm), антенны по 2 dBi, потери в свободном пространстве и 20 дБ запаса на землю и реальный мир.
export function linkModel(st) {
  const r = RATES[st.rate] || RATES[50];
  const d = clamp(st.d, D_MIN, D_MAX);
  const fspl = 20 * Math.log10(d) + 20 * Math.log10(r.f) + 32.44;
  const rssi = 30 + 4 - fspl - 20 - (st.forest ? 15 : 0);
  const sensEff = r.sens + st.noise * 2; // помехи поднимают «шумовой пол»
  const margin = rssi - sensEff;
  const pSig = 1 / (1 + Math.exp(-(margin - 2) / 1.5)); // пакет «услышан» над порогом
  let pNoise = 1 - clamp(st.noise * 0.045, 0, 0.9); // помеха «съедает» пакет целиком
  if (r.dup) pNoise = 1 - (1 - pNoise) ** 4; // D50: каждый пакет 4 раза на разных частотах
  const lq = Math.round(pSig * pNoise * 100);
  const pct = Math.round(clamp((rssi + 130) / 100, 0, 1) * 100); // RSSI в процентах по шкале −130…−30
  return { r, d, fspl, rssi, sensEff, margin, lq, pct };
}
const xOf = (d) => X0 + (X1 - X0) * (Math.log(clamp(d, D_MIN, D_MAX) / D_MIN) / Math.log(D_MAX / D_MIN));

export const meta = {
  id: "link",
  title: "Полигон связи",
  hint: "Расстояние — ползунок или ← →",
  narrowZoom: 1.15, // широкая сцена: на телефоне видны и пульт, и экран очков справа
  keys: [
    { mark: "lit", label: "Пакеты команд: светлые дошли, красные потеряны" },
    { mark: "raised", label: "Пульт, дрон на каретке, лес, чужой передатчик, монитор очков" },
    { mark: "edge", label: "Кольца вокруг чужого передатчика — помеха в эфире" },
  ],
  caption: "Пульт (1 Вт) шлёт дрону пакеты с положением стиков. RSSI — громкость принятого сигнала, LQ — сколько пакетов дошло целыми. Громкость падает с расстоянием и за лесом, а помеха рядом с дроном портит пакеты даже при громком сигнале. Медленнее пакеты (25–50 Гц) — тише сигнал можно разобрать, связь дальше; 500 Гц — быстрый отклик, но предел приёма −105 dBm. D50 повторяет каждый пакет на разных частотах: спасает от помех, но не от тишины. Модель учебная: чувствительность — по книге (ELRS), потери на землю и деревья — оценка.",
  aria: "Ползунок «Расстояние» двигает каретку с дроном по рельсу; переключатель на модуле пульта меняет packet rate; «Помехи» включает чужой передатчик; «Лес» поднимает полосу деревьев.",
  try: [
    "Включи помехи 8 при расстоянии 1 км: RSSI высокий, а LQ падает — «громко, но неразборчиво».",
    "Отъедь на 15 км без помех: RSSI ниже −100 dBm, а LQ ещё 100 — «тихо, но чисто». Запаса почти нет.",
    "Переключи 50 Гц → 500 Гц: предел приёма поднимется на 15 дБ, связь оборвётся раньше.",
  ],
  missions: [
    {
      id: "loud", look: ["jam", "osd"], touch: ["noise"], see: "RSSI и LQ на мониторе очков и красные пакеты",
      text: "Сделай «громко, но неразборчиво»: RSSI ближе к нулю, чем −80 dBm, а LQ ниже 80 %",
      check: (f) => f.rssi > -80 && f.lq < 80,
      predict: { q: "Дрон в 1 км, сигнал громкий. Рядом с дроном включили сильную помеху. Что будет с RSSI и LQ?", options: ["Оба упадут до нуля", "RSSI останется громким, LQ упадёт", "Ничего: громкий сигнал помехам не по зубам"], right: 1 },
      confirm: { q: "Что значит «RSSI в норме, LQ низкий»?", options: ["Дрон слишком далеко", "Помехи на той же частоте портят пакеты", "Сломалась антенна приёмника"], right: 1, miss: "Посмотри на монитор: громкость почти не изменилась, а пакеты краснеют. Значит, мешает не расстояние, а шум рядом." },
      setup: { d: 1, noise: 0, rate: "50", forest: false },
    },
    {
      id: "quiet", look: ["rail", "osd"], touch: ["d", "forest"], see: "RSSI на мониторе: падает, а LQ держится",
      text: "Сделай «тихо, но чисто»: RSSI ниже −100 dBm, а LQ ещё не ниже 95 %",
      check: (f) => f.rssi < -100 && f.lq >= 95,
      predict: { q: "Дрон далеко, помех нет. RSSI упал до −105 dBm. Что с LQ?", options: ["Тоже упал до нуля", "Может быть ещё около 100 %: сигнал тихий, но чистый", "LQ всегда равен RSSI в процентах"], right: 1 },
      confirm: { q: "Чем опасно «RSSI плохой, LQ хороший»?", options: ["Ничем, LQ же 100 %", "Запаса почти нет: ещё немного — и связь оборвётся резко", "Дрон начнёт дёргаться прямо сейчас"], right: 1, miss: "Отъедь ещё чуть-чуть: LQ держится до последнего и падает почти сразу до нуля." },
      setup: { d: 2, noise: 0, rate: "50", forest: false },
    },
    {
      id: "far", look: ["pult", "osd"], touch: ["rate", "d"], see: "переключатель packet rate на модуле пульта и LQ",
      text: "Улети на 30 км и держи LQ не ниже 95 %",
      check: (f) => f.d >= 30 && f.lq >= 95,
      predict: { q: "Какой packet rate даст самую большую дальность?", options: ["500 Гц — пакеты чаще", "25 Гц — пакеты реже", "D50 — с повторами"], right: 1 },
      confirm: { q: "Почему редкие пакеты бьют дальше?", options: ["На каждый пакет больше времени и энергии — приёмник разберёт и тихий сигнал", "Пульт сам поднимает мощность", "В эфире становится меньше помех"], right: 0, miss: "Сравни «предел приёма» в показателях: у 25 Гц он −123 dBm, у 500 Гц — −105." },
      setup: { d: 2, noise: 0, rate: "50", forest: false },
    },
    {
      id: "d50", look: ["jam", "pult"], touch: ["rate=D50"], see: "пакеты при сильной помехе: сколько доходит",
      text: "При сильной помехе (6 и больше) подними LQ выше 85 %, не меняя расстояния",
      check: (f) => f.noise >= 6 && f.lq > 85 && f.rate === "D50",
      predict: { q: "Помеха сильная, дрон недалеко. Какой режим спасёт LQ?", options: ["500 Гц", "D50 — каждый пакет несколько раз на разных частотах", "25 Гц"], right: 1 },
      setup: { d: 2, noise: 6, rate: "50", forest: false },
    },
    {
      id: "lost", look: ["rail", "osd"], touch: ["rate=500", "d"], see: "расстояние, где LQ падает до нуля",
      text: "Включи 500 Гц и найди расстояние, где связь пропадает",
      check: (f) => f.rate === "500" && f.lq === 0,
      predict: { q: "На 500 Гц связь пропадёт раньше или позже, чем на 50 Гц?", options: ["Раньше: предел приёма выше (−105 против −120 dBm)", "Позже: пакеты чаще", "Одинаково"], right: 0 },
      setup: { d: 2, noise: 0, rate: "50", forest: false },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [PULT[0], PULT[1], 84], [MON.x, MON.y, MON.z0 + MON.h + 2], [MON.x + MON.w, MON.y, MON.z0 + MON.h + 2]], W, H, { pad: 18, azimuth: 36 });
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const m = linkModel(state);
  basePlate(S, PLATE);
  rulerStrip(S, { x: X0 - 6, y: RAIL_Y + 20, w: X1 - X0 + 12, d: 7, r: 1 }, { step: 3.9, every: 5 });
  labelPlate(S, { x: PLATE.x + 10, y: PLATE.y + 10, w: 46, d: 18, r: 1.5 }, "LINK");

  // ── Рельс с концевиками ──
  S.group = "rail";
  for (const dy of [-7, 7]) S.box({ x: X0 - 14, y: RAIL_Y + dy - 1.8, w: X1 - X0 + 28, d: 3.6, r: 0.8 }, 0, 2.6, { tone: "mid" }, { steps: 2, bevel: 0.3, layer: 0.4 });
  for (const x of [X0 - 19, X1 + 14]) {
    S.box({ x, y: RAIL_Y - 12, w: 5, d: 24, r: 1 }, 0, 7, { tone: "mid" }, { bevel: 0.4, layer: 0.45 });
    S.dots([[x + 2.5, RAIL_Y - 7, 7], [x + 2.5, RAIL_Y + 7, 7]], { size: 0.45 }, [x + 2.5, RAIL_Y, 7.1], { layer: 0.45 });
  }

  // ── Пульт на подставке, модуль ELRS с переключателем packet rate ──
  S.group = "pult";
  const [px, py] = PULT;
  const stand = { x: px - 26, y: py - 22, w: 52, d: 44, r: 3 };
  S.box(stand, 0, 5, { tone: "mid" }, { bevel: 0.5 });
  S.dots(k.corners(stand, 4).map(([a, b]) => [a, b, 5]), { size: 0.45 }, [px, py, 5.1]);
  const body = { x: px - 22, y: py - 12, w: 44, d: 30, r: 6 };
  S.box(body, 5, 11, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(body, 11, P, 6), { tone: "faint" }) }, { bevel: 0.8 });
  for (const gx of [px - 11, px + 11]) {
    S.cyl(gx, py + 4, 6, 16, 1.4, { tone: "mid" });
    S.line(k.ring(gx, py + 4, 4.4, 17.4, P, 24), { tone: "lo" }, [gx, py + 4, 17.5]);
    S.cyl(gx, py + 4, 0.9, 17.4, 7, { tone: "mid", crease: "none" }, { bias: 1 });
    S.solid(G.sphereOf([gx, py + 4, 25.4], 2, P), { tone: "hi" }, [gx, py + 4, 25.4], { bias: 1.2 });
  }
  const bay = { x: px - 15, y: py - 21, w: 30, d: 11, r: 2 };
  S.box(bay, 5, 17, { tone: "mid", inner: k.lineSvg(k.sideSeam(bay, 14, P, 3), { tone: "faint" }) }, { bevel: 0.5 });
  const kx = px + 7, ky = py - 15.5, kz = 22;
  const sel = knob(S, kx, ky, kz, 3.4, 2.6, { tone: "hi" });
  const RATE_A = { 25: -1.1, 50: -0.37, D50: 0.37, 500: 1.1 };
  S.line(Object.values(RATE_A).map((a) => k.lineOnTop([kx + Math.sin(a) * 4.6, ky - Math.cos(a) * 4.6], [kx + Math.sin(a) * 6, ky - Math.cos(a) * 6], kz, P)).join(""), { tone: "mid" }, [kx, ky, kz + 0.1]);
  S.raw([kx, ky, kz + 12], k.lineSvg(sel.pointer(RATE_A[state.rate] ?? -0.37), { tone: "lit" }), { bias: 2 });
  const txBase = [px - 7, py - 15.5, 22];
  S.cyl(txBase[0], txBase[1], 2.6, 22, 3.4, { tone: "mid", inner: k.lineSvg(k.knurl(txBase[0], txBase[1], 2.6, 22, 25.4, 12, P), { tone: "lo" }) });
  const txTip = [txBase[0], txBase[1], 80];
  S.tube([[txBase[0], txBase[1], 25.4], txTip], 1.2, { tone: "hi", maxLength: 40 });
  S.solid(G.sphereOf(txTip, 2, P), { tone: "hi" }, txTip, { bias: 0.5 });

  // ── Полоса леса: поперёк трассы между пультом и дроном (поднимается) ──
  S.group = "forest";
  S.box(FOREST, 0, 2, { tone: "lo" }, { bevel: 0.4, layer: 0.5 });
  const trees = [];
  for (let i = 0; i < 6; i++) trees.push([FOREST.x + 8 + (i % 2) * 15, FOREST.y + 8 + i * 8.4]);
  if (state.forest) {
    for (const [tx, ty] of trees) {
      const h = 18 + ((Math.round(tx * 7 + ty * 13) % 4) + 4) % 4 * 2;
      S.cyl(tx, ty, 1.3, 2, h - 8, { tone: "mid", crease: "none" }, { ref: [tx, ty, 8] });
      S.solid(G.sphereOf([tx, ty, h], 5.8, P, { steps: 24 }), { tone: "mid" }, [tx, ty, h]);
      S.solid(G.sphereOf([tx + 1, ty + 1, h + 6], 4, P, { steps: 20 }), { tone: "hi" }, [tx + 1, ty + 1, h + 6], { bias: 0.2 });
    }
  } else {
    for (const [tx, ty] of trees) S.line(k.ring(tx, ty, 1.8, 2, P, 12), { tone: "faint" }, [tx, ty, 2.1]);
  }

  // ── Чужой передатчик у трассы: коробка, антенна, кольца помехи (рисует контроллер) ──
  S.group = "jam";
  const jb = { x: JAM[0] - 15, y: JAM[1] - 11, w: 30, d: 22, r: 2.4 };
  S.box(jb, 0, 11, { tone: "mid", inner: k.lineSvg(k.sideSeam(jb, 4, P, 3), { tone: "faint" }) }, { bevel: 0.5 });
  S.raw([JAM[0] - 4, JAM[1], 11.2], k.dotsSvg(k.dotGrid(JAM[0] - 11, JAM[1] - 6, 4, 3, 3, 11, P), { size: 0.45, tone: "lo" }));
  S.cyl(JAM[0] + 8, JAM[1] - 5, 1.6, 11, 1, { tone: state.noise ? "hi" : "mid", lit: !!state.noise }, { bias: 0.5 });
  const jamTip = [JAM[0] + 6, JAM[1] + 4, 44];
  S.cyl(jamTip[0], jamTip[1], 2.2, 11, 2.8, { tone: "mid" });
  S.tube([[jamTip[0], jamTip[1], 13.8], jamTip], 1, { tone: "hi", maxLength: 30 });
  S.solid(G.sphereOf(jamTip, 1.6, P), { tone: "hi" }, jamTip, { bias: 0.5 });
  S.raw([JAM[0], JAM[1], 1], `<g data-part="rings"></g>`, { layer: 0.6 });

  // ── Монитор очков: экран в плоскости передней грани ──
  S.group = "osd";
  const mx = MON.x, my = MON.y, mcx = mx + MON.w / 2;
  S.box({ x: mcx - 13, y: my - 6, w: 26, d: 18, r: 2.4 }, 0, 4, { tone: "mid" }, { bevel: 0.4 });
  S.cyl(mcx, my + 3, 2.4, 4, MON.z0 - 4, { tone: "mid", crease: "none" });
  const scr = { x: mx, y: my, w: MON.w, d: MON.d, r: 2 };
  S.box(scr, MON.z0, MON.h, { tone: "mid", inner: k.lineSvg(k.sideSeam(scr, MON.z0 + 4, P, 3), { tone: "faint" }) }, { bevel: 0.6, ref: [mcx, my + MON.d, MON.z0 + MON.h / 2] });
  // Экран: локальные координаты (x вдоль грани, y вниз от верхней кромки).
  const face = k.sideMatrix([mx + 3, my + MON.d], MON.z0 + MON.h - 3, P, "left");
  S.raw([mcx, my + MON.d + 0.4, MON.z0 + MON.h / 2], `<g transform="${face}"><rect x="0" y="0" width="${MON.w - 6}" height="${MON.h - 6}" rx="1.8" class="osd-screen"/><g data-part="osd"></g></g>`, { bias: 5 });

  // ── Каретка с дроном (едет по рельсу) ──
  S.group = "drone";
  const dx = xOf(state.d), dy = RAIL_Y;
  const car = { x: dx - 17, y: dy - 15, w: 34, d: 30, r: 3 };
  S.box(car, 2.6, 4, { tone: "mid" }, { bevel: 0.5 });
  const zt = 9;
  S.box({ x: dx - 8, y: dy - 6, w: 16, d: 12, r: 2.4 }, zt, 6, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  const mot = [[dx + 17, dy + 15], [dx + 17, dy - 15], [dx - 17, dy + 15], [dx - 17, dy - 15]];
  for (const [mx2, my2] of mot) S.tube([[dx, dy, zt + 2], [mx2, my2, zt + 2]], 1.6, { tone: "mid", maxLength: 30 });
  const props = [];
  mot.forEach(([mx2, my2], i) => {
    const top = motor(S, mx2, my2, zt + 1, { r: 5, h: 5, ribs: 10 }).top;
    props.push([mx2, my2, top + 1.2, i]);
  });
  const rxTip = [dx - 5, dy + 3, zt + 36];
  S.tube([[dx - 5, dy + 3, zt + 6], rxTip], 0.9, { tone: "hi", maxLength: 30 });
  S.solid(G.sphereOf(rxTip, 1.4, P), { tone: "hi" }, rxTip, { bias: 0.5 });
  props.forEach(([x, y, z, i]) => S.raw([x, y, z + 6], `<g data-prop="${i}">${propSvg(P, x, y, z, 11, i * 0.7, { blades: 3 })}</g>`, { bias: 20 }));

  // ── Луч связи и пакеты (рисует контроллер) — поверх всего ──
  S.group = null;
  S.raw([0, 0, 400], `<g data-part="packets"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Полигон связи на столе: пульт с модулем ELRS, дрон на каретке по рельсу, полоса леса, чужой передатчик и монитор очков с RSSI и LQ.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Пульт · модуль ELRS", [px, py - 4, 18], "Отправляет пакеты с положением стиков. Переключатель на модуле — packet rate: сколько пакетов в секунду."],
    ["Дрон на каретке", [dx, dy, 16], "Чем дальше каретка, тем тише сигнал на входе приёмника (RSSI падает)."],
    ["Чужой передатчик", [JAM[0], JAM[1], 14], "Помеха на той же частоте: громкость не меняет, но портит пакеты (LQ падает)."],
    ["Экран очков (OSD)", [mcx, my + MON.d, MON.z0 + MON.h], "RSSI — громкость, LQ — сколько пакетов дошло. Главный показатель — LQ."],
    ["Лес", [FOREST.x + FOREST.w / 2, FOREST.y + FOREST.d / 2, state.forest ? 30 : 4], "Деревья между пультом и дроном ослабляют сигнал примерно на 15 дБ (оценка)."],
  ]);
  return { svg, P, labels, live: { txTip: at(txTip), rxTip: at(rxTip), jamC: JAM, props, model: m }, parts: S.count() };
}

export const defaults = { d: 2, noise: 0, rate: "50", forest: false };
export const controls = [
  { id: "rate", label: "Packet rate (переключатель на модуле)", type: "seg", options: Object.entries(RATES).map(([v, r]) => [v, r.l]), rebuild: true },
  { id: "d", label: "Расстояние до дрона", type: "range", min: D_MIN, max: D_MAX, step: 0.1, fmt: (v) => `${fmt(v, 1)} км`, rebuild: true },
  { id: "noise", label: "Помехи (чужой передатчик)", type: "range", min: 0, max: 10, step: 1, fmt: (v) => (v ? `${v} из 10` : "выкл.") },
  { id: "forest", label: "Между нами лес", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { d: 1, noise: 0, rate: "50", forest: false } },
  { at: 3, set: { noise: 8 } },
  { at: 7, set: { noise: 0, d: 25 } },
  { at: 11, set: { forest: true } },
  { at: 15, set: { forest: false, d: 2 } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const pkEl = q("packets"), ringEl = q("rings"), osdEl = q("osd");
  const propEls = [...root.querySelectorAll("[data-prop]")];
  const sim = { t: 0, rssi: L.model.rssi, lqShown: L.model.lq, pk: [], acc: 0, spin: 0 };
  let m = L.model;
  const arcAt = (u) => {
    const [a, b] = [L.txTip, L.rxTip];
    const lift = Math.min(60, 18 + Math.abs(b[0] - a[0]) * 0.12);
    const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - lift;
    const x = (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * mx + u * u * b[0];
    const y = (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * my + u * u * b[1];
    return [x, y];
  };
  return {
    tick(dt, calm, st) {
      sim.t += dt;
      m = linkModel(st);
      sim.rssi += (m.rssi - sim.rssi) * (calm ? 1 : 1 - Math.exp(-dt / 0.3));
      sim.lqShown += (m.lq - sim.lqShown) * (calm ? 1 : 1 - Math.exp(-dt / 0.4));
      // Пакеты: темп растёт с packet rate (в замедленном показе), исход — по LQ.
      const rate = m.r.hz >= 500 ? 7 : m.r.hz >= 50 ? 3 : 1.7;
      if (!calm) {
        sim.acc += dt * rate;
        while (sim.acc >= 1) {
          sim.acc -= 1;
          sim.pk.push({ u: 0, ok: Math.random() * 100 < m.lq, dup: !!m.r.dup });
        }
        sim.pk.forEach((p) => (p.u += dt * 0.5));
        sim.pk = sim.pk.filter((p) => p.u < 1.15);
      }
      // Дуга от антенны пульта к антенне дрона: по ней летят пакеты.
      let html = `<path class="link-beam${m.lq === 0 ? " dead" : ""}" d="M${arcAt(0).map((v) => v.toFixed(1)).join(" ")}${Array.from({ length: 24 }, (_, i) => "L" + arcAt((i + 1) / 24).map((v) => v.toFixed(1)).join(" ")).join("")}"/>`;
      for (const p of sim.pk) {
        const u = Math.min(p.u, 1);
        const [x, y] = arcAt(u);
        const fadeIn = Math.min(1, p.u * 10);
        if (!p.ok && p.u > 0.55) {
          const o = clamp(1 - (p.u - 0.55) * 1.8, 0, 1);
          html += `<path class="pk-lost" style="opacity:${o.toFixed(2)}" d="M${(x - 3.4).toFixed(1)} ${(y - 3.4 + (p.u - 0.55) * 30).toFixed(1)}l6.8 6.8m0 -6.8l-6.8 6.8"/>`;
          continue;
        }
        const o = p.u > 1 ? clamp(1 - (p.u - 1) * 7, 0, 1) : fadeIn;
        html += `<rect class="pk" x="${(x - 4.5).toFixed(1)}" y="${(y - 2.7).toFixed(1)}" width="9" height="5.4" rx="1.6" style="opacity:${o.toFixed(2)}"/>`;
        if (p.dup) html += `<rect class="pk" x="${(x - 4.5).toFixed(1)}" y="${(y + 4).toFixed(1)}" width="9" height="5.4" rx="1.6" style="opacity:${(o * 0.7).toFixed(2)}"/>`;
      }
      pkEl.innerHTML = html;
      // Кольца помехи вокруг антенны чужого передатчика.
      let rings = "";
      if (st.noise > 0 && !calm) {
        const n = 3;
        for (let i = 0; i < n; i++) {
          const ph = (sim.t * 0.6 + i / n) % 1;
          const rr = 8 + ph * (14 + st.noise * 4);
          const o = (1 - ph) * (0.25 + st.noise * 0.06);
          rings += `<path class="iso-line jam-ring" data-tone="mid" style="opacity:${o.toFixed(2)}" d="${k.ring(L.jamC[0] + 6, L.jamC[1] + 4, rr, 1, P, 48)}"/>`;
        }
      } else if (st.noise > 0) rings = `<path class="iso-line jam-ring" data-tone="mid" d="${k.ring(L.jamC[0] + 6, L.jamC[1] + 4, 16 + st.noise * 2, 1, P, 48)}"/>`;
      ringEl.innerHTML = rings;
      // Экран очков: как OSD — громкость и разборчивость.
      const lq = Math.round(sim.lqShown);
      const bad = lq < 50 ? " bad" : lq < 80 ? " warn" : "";
      const bw = MON.w - 14;
      const rFrac = clamp((sim.rssi + 130) / 100, 0, 1);
      osdEl.innerHTML = `<text x="4" y="9" class="osd-t">RSSI ${fmt(sim.rssi)} dBm</text><rect x="4" y="12" width="${bw}" height="3.6" rx="1.4" class="osd-track"/><rect x="4" y="12" width="${(bw * rFrac).toFixed(1)}" height="3.6" rx="1.4" class="osd-bar"/>`
        + `<text x="4" y="25" class="osd-t${bad}">LQ ${lq} %</text><rect x="4" y="28" width="${bw}" height="3.6" rx="1.4" class="osd-track"/><rect x="4" y="28" width="${(bw * lq / 100).toFixed(1)}" height="3.6" rx="1.4" class="osd-bar${bad}"/>`
        + `<text x="${MON.w - 10}" y="37.4" class="osd-s" text-anchor="end">${m.r.l}${lq === 0 ? " · FAILSAFE" : ""}</text>`;
      // Винты дрона медленно вращаются.
      if (!calm) sim.spin += dt * 1.2;
      propEls.forEach((el) => {
        const [x, y, z, i] = L.props[Number(el.dataset.prop)];
        el.innerHTML = propSvg(P, x, y, z, 11, i * 0.7 + sim.spin * (i === 0 || i === 3 ? 1 : -1), { blades: 3 });
      });
      return true;
    },
    facts() {
      return { rssi: m.rssi, lq: m.lq, d: m.d, noise: state.noise, rate: String(state.rate), margin: m.margin };
    },
    readout() {
      return `RSSI ${fmt(sim.rssi)} dBm · LQ ${fmt(m.lq)} % · ${m.r.l} · ${fmt(m.d, 1)} км`;
    },
    metrics() {
      return [
        ["RSSI — громкость", `${fmt(m.rssi)} dBm · ${m.pct} %`, "оценка"],
        ["Предел приёма", `${fmt(m.sensEff)} dBm${state.noise ? " (с помехами)" : ""}`, "ELRS"],
        ["Запас до предела", `${fmt(m.margin)} дБ`, ""],
        ["LQ — разборчивость", `${m.lq} из 100 пакетов`, ""],
      ];
    },
    note() {
      if (m.lq === 0) return "<b>Связь потеряна:</b> сигнал тише предела приёма — ни один пакет не разобран. Дрон уходит в Failsafe.";
      if (m.rssi > -80 && m.lq < 80) return "<b>Громко, но неразборчиво.</b> RSSI отличный, а помеха «съедает» пакеты. Смотри на LQ — это главный показатель.";
      if (m.margin < 0) return `<b>Сигнал на ${fmt(-m.margin)} дБ тише предела</b> — доходят лишь редкие пакеты. Срочно возвращайся! Медленнее пакеты (25–50 Гц) — слышно дальше.`;
      if (m.margin < 10) return `<b>До предела всего ${fmt(m.margin)} дБ.</b> LQ ещё держится, но оборвётся резко — пора возвращаться.`;
      if (state.rate === "D50") return "<b>D50</b> повторяет каждый пакет на разных частотах: в толкучке почти все доходят, но предел хуже (−112 dBm) — дальность меньше.";
      return "Каждый прямоугольник — пакет с командами. Светлый дошёл, красный крестик — потерян. Пульт и дрон далеко друг от друга — громкость (RSSI) падает.";
    },
  };
}
