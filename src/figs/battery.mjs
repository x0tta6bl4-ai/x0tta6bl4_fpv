// Fig: батарея на балансире. Банки стоят рядами S×P, перемычки соединяют их последовательно,
// балансир (S + 1 провод) идёт в тестер с колонками напряжения, силовые провода — в зарядку или нагрузку.
import { k, G, scene, basePlate, rulerStrip, labelPlate, knob, plug, TAU, fmt, clamp, labelsAt } from "../figkit.mjs";
import { battery } from "../models.mjs";

const W = 640, H = 380;
const PLATE = { x: -170, y: -84, w: 340, d: 168, r: 8 };
const CELL = { w: 10, d: 30, h: 30, gap: 2.6 };
const PACK0 = [-150, -52];
const CHK = { x: 6, y: -70, w: 96, d: 34, r: 3 };
const RACK = { x: 10, y: -72, w: 88, d: 6, r: 0.2 };
const COL_Z0 = 14, COL_SCALE = 34; // мм колонки на вольт выше 3,0 В
const LOAD = { x: 40, y: 18, w: 70, d: 40, r: 3 };
const CHG = { x: -66, y: 30, w: 64, d: 38, r: 3 };
const THERMO = [138, -46];
export const CONFIGS = { "3S": [3, 1], "4S": [4, 1], "6S": [6, 1], "3S2P": [3, 2], "4S2P": [4, 2] };

export const meta = {
  id: "battery",
  title: "Батарея на балансире",
  hint: "Нагрузка — ползунок или ← →",
  keys: [
    { mark: "lit", label: "Самая слабая банка" },
    { mark: "raised", label: "Банки, перемычки, балансир" },
    { mark: "edge", label: "Риски 3,5 · 3,8 · 4,2 В на стойке тестера" },
  ],
  caption: "Последовательно (S) складываются вольты, параллельно (P) — ёмкость и допустимый ток. Колонки тестера показывают напряжение каждой банки: под нагрузкой оно проседает на ток × внутреннее сопротивление, на холоде и у старой батареи — сильнее. Кривая разряда типовая (оценка).",
  try: [
    "Поставь нагрузку 60 А и включи «Мороз»: тревога LOW BATTERY придёт раньше, хотя батарея заряжена.",
    "Выбери «Заряд как LiHV» и смотри, как колонки уходят выше риски 4,2 — это перезаряд обычной LiPo. Останови сменой режима.",
    "Сравни 3S2P и 6S: сколько проводов на балансире и какая ёмкость?",
  ],
  missions: [
    { id: "p2", look: ["pack","balancer"], touch: ["config"], see: "ряды банок и провода балансира",  text: "Собери батарею с банками «рядом» (буква P)", check: (f) => f.p >= 2,
      predict: { q: "Добавляем второй ряд банок параллельно (3S → 3S2P). Что изменится?", options: ["Напряжение вырастет вдвое", "Ёмкость и допустимый ток вырастут вдвое, напряжение то же", "Ничего не изменится"], right: 1 },
      confirm: { q: "Сколько проводов на балансире у 3S2P?", options: ["4 — как у 3S: банок в цепочке три", "7 — по проводу на каждую банку и ещё один", "8 — вдвое больше, чем у 3S"], right: 0, miss: "Балансир меряет каждую ступень цепочки. Параллельные банки стоят на одной ступени, поэтому проводов S + 1." } , setup: { config: "3S", mode: "load", load: 25, soc: 0.85, cold: false, aged: false, mah: 1300 } },
    // Практическая звезда — за пойманную до перезаряда ошибку, а не за перезаряд (исследование 031, карточка 032).
    { id: "hv", look: ["charger","checker"], touch: ["mode=charge"], see: "колонки тестера и риску 4,2 В",  text: "Обычную LiPo по ошибке заряжают как LiHV — переключи на «Заряд LiPo», пока банки не выше 4,20 В", check: (f, s) => f.hvRan && !f.overSeen && s.mode !== "hv",
      predict: { q: "Обычную LiPo 6S по ошибке поставили заряжаться в режиме LiHV. Что делаешь?", options: ["Жду: зарядник сам остановится на 4,20 В", "Сразу меняю режим на «Заряд LiPo» — предел 4,20 В на банку", "Ничего: LiHV просто заряжает быстрее"], right: 1 },
      confirm: { q: "Почему нельзя дать банкам дойти до 4,35 В?", options: ["Ничего страшного, просто зарядится полнее", "Перезаряд: банка деградирует, вздувается, может загореться", "Батарея не зарядится совсем"], right: 1, miss: "Полная LiPo — 4,20 В. Всё выше — перезаряд: банка портится и может загореться. Режим зарядника выбирают по подтверждённому пределу батареи, а не по названию на кнопке." }, setup: { config: "6S", mode: "hv", load: 0, soc: 0.6, cold: false, aged: false, mah: 1300 } },
    { id: "low", look: ["checker","thermo","load"], touch: ["cold","load"], see: "самую слабую колонку тестера и риску 3,5 В",  text: "Доведи батарею до тревоги LOW BATTERY (ниже 3,5 В на банку): мороз и большой ток", check: (f, s) => s.mode === "load" && f.minCell < 3.5 && f.soc > 0.4,
      predict: { q: "Батарея заряжена на 85 %. Включаем мороз −15 °C и ток 80 А. Что покажет тестер?", options: ["Всё в норме: заряд же большой", "Напряжение просядет ниже 3,5 В — тревога LOW BATTERY", "Батарея за секунду разрядится до нуля"], right: 1 },
      confirm: { q: "Почему тревога пришла, хотя заряд ещё есть?", options: ["На морозе выросло внутреннее сопротивление: просадка = ток × сопротивление", "Батарея на самом деле разрядилась", "Мороз сломал тестер"], right: 0, miss: "Посмотри, что будет с колонками, если снять мороз или убавить ток: напряжение вернётся. Значит, заряд на месте — мешает сопротивление." } , setup: { config: "6S", mode: "load", load: 25, soc: 0.85, cold: false, aged: false, mah: 1300 } },
    { id: "store", look: ["checker","charger"], touch: ["mode=storage"], see: "колонки тестера и риску 3,8 В",  text: "Переведи батарею на хранение и дождись 3,8 В на банку", check: (f, s) => s.mode === "storage" && Math.abs(f.minCell - 3.8) < 0.03,
      predict: { q: "Батарея заряжена (около 4 В на банку). Включаем Storage. Что сделает зарядник?", options: ["Дозарядит до 4,20 В", "Разрядит до 3,80–3,85 В", "Ничего: Storage только для пустых батарей"], right: 1 } , setup: { config: "6S", mode: "load", load: 0, soc: 0.85, cold: false, aged: false, mah: 1300 } },
  ],

};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [RACK.x, RACK.y, COL_Z0 + 60], [RACK.x + RACK.w, RACK.y, COL_Z0 + 60]], W, H, { pad: 24, azimuth: 44 });
}

function cellsOf(s, p) {
  const out = [];
  for (let j = 0; j < p; j++)
    for (let i = 0; i < s; i++) out.push({ i, j, x: PACK0[0] + i * (CELL.w + CELL.gap), y: PACK0[1] + j * (CELL.d + 8) });
  return out;
}

export function render(state) {
  const [s, p] = CONFIGS[state.config];
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  basePlate(S, PLATE);
  rulerStrip(S, { x: -150, y: PLATE.y + PLATE.d - 15, w: 170, d: 7, r: 1 });
  labelPlate(S, { x: 112, y: PLATE.y + PLATE.d - 28, w: 44, d: 18, r: 1.5 }, `${s}S${p}P`);

  S.group = "pack";
  // Поддон пачки.
  const pw = s * (CELL.w + CELL.gap) + 8, pd = p * (CELL.d + 8) + 2;
  const tray = { x: PACK0[0] - 6, y: PACK0[1] - 6, w: pw + 4, d: pd + 4, r: 3 };
  S.box(tray, 0, 3, { tone: "lo" }, { bevel: 0.5, layer: 0.5 });
  S.line(k.planOutline(k.insetPlan(tray, 2.5), 3, P, 4), { tone: "faint" }, [tray.x + tray.w / 2, tray.y + tray.d / 2, 3.1], { layer: 0.5 });

  // Банки: «пауч» со швом, два лепестка сверху.
  const cells = cellsOf(s, p);
  const cellRef = [];
  for (const c of cells) {
    const plan = { x: c.x, y: c.y, w: CELL.w, d: CELL.d, r: 1.6 };
    S.box(plan, 3, CELL.h, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(plan, 3 + CELL.h - 4, P, 3), { tone: "faint" }) }, { bevel: 0.5, steps: 3, ref: [c.x + 5, c.y + 15, 18] });
    S.raw([c.x + 5, c.y + 15, 3 + CELL.h + 0.2], `<g data-cell="${c.i}-${c.j}"></g>`, { bias: 1 });
    cellRef.push(c);
  }
  // Перемычки: соединяют соседние банки последовательно, ряды P — параллельно по концам.
  const zt = 3 + CELL.h;
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < s - 1; i++) {
      const x = PACK0[0] + i * (CELL.w + CELL.gap) + CELL.w / 2;
      const y = PACK0[1] + j * (CELL.d + 8) + (i % 2 ? 6 : CELL.d - 6);
      S.box({ x: x - 1, y: y - 2.5, w: CELL.w + CELL.gap + 2, d: 5, r: 0.6 }, zt, 1.2, { tone: "mid" }, { steps: 2, ref: [x + 6, y, zt + 0.6] });
      S.dots([[x + 1.5, y, zt + 1.2], [x + CELL.w + CELL.gap - 0.5, y, zt + 1.2]], { size: 0.45 }, [x + 6, y, zt + 1.3]);
    }
  }
  if (p > 1) {
    for (const end of [0, s - 1]) {
      const x = PACK0[0] + end * (CELL.w + CELL.gap) + CELL.w / 2;
      S.box({ x: x - 2.4, y: PACK0[1] + 3, w: 4.8, d: CELL.d * 2 + 8 - 6, r: 0.6 }, zt + 1.2, 1.2, { tone: "mid" }, { steps: 2, ref: [x, PACK0[1] + CELL.d + 4, zt + 2] });
    }
  }
  // Силовые выводы: «+» с последней банки, «−» с первой, к разъёму XT60.
  const lastX = PACK0[0] + (s - 1) * (CELL.w + CELL.gap) + CELL.w / 2;
  const firstX = PACK0[0] + CELL.w / 2;
  const yFront = PACK0[1] + (p - 1) * (CELL.d + 8) + CELL.d - 4;
  const xt = [-26, 4];
  const lead = (x, tone, dy) => S.tube([[x, yFront, zt + 1], [x, yFront + 10, zt - 4], [xt[0] - 14, xt[1] + dy, 8], [xt[0] - 5, xt[1] + dy, 6]], 1.7, { tone, bendR: 6, maxLength: 12 });
  lead(lastX, "hi", -3);
  lead(firstX, "mid", 3);
  plug(S, xt[0], xt[1], 2, 8, 14, 8, { tone: "hi" });
  S.line(k.planOutline({ x: xt[0] - 2.6, y: xt[1] - 5, w: 5.2, d: 10, r: 1 }, 10, P, 2), { tone: "lo" }, [xt[0], xt[1], 10.1]);
  S.group = "balancer";
  // Балансир: S + 1 провод от каждого стыка.
  const jx = (n) => (n === 0 ? firstX - 3 : n === s ? lastX + 3 : PACK0[0] + n * (CELL.w + CELL.gap) - CELL.gap / 2);
  const conn = [CHK.x + 14, CHK.y + CHK.d + 8];
  const cw = 3 + s * 1.6;
  // Отводы от каждого стыка спускаются по задней грани к гребёнке, дальше — один плоский жгут.
  const comb = { x: jx(0) - 2, y: PACK0[1] - 12, w: jx(s) - jx(0) + 4, d: 4, r: 0.8 };
  for (let n = 0; n <= s; n++) {
    const x0 = jx(n);
    S.tube([[x0, PACK0[1] + 1, zt - 1], [x0, PACK0[1] - 3, zt - 1], [x0, PACK0[1] - 8, 9], [x0, comb.y + 2, 6.4]], 0.32, { tone: n === 0 || n === s ? "mid" : "lo", bendR: 2.5 }, { bias: -2 });
  }
  S.box(comb, 3, 3.4, { tone: "mid" }, { steps: 2, ref: [comb.x + comb.w / 2, comb.y + 2, 4.5] });
  S.tube([[comb.x + comb.w, comb.y + 2, 4.8], [comb.x + comb.w + 10, comb.y + 2, 4.8], [CHK.x - 10, conn[1] - 2, 4.8], [conn[0] - cw / 2 - 1, conn[1] + 1.5, 4.5]], 1.25, { tone: "mid", bendR: 8, maxLength: 16 });
  plug(S, conn[0], conn[1] + 1.5, 2, cw, 4, 5, { tone: "mid" });

  S.group = "checker";
  // Тестер банок: основание, стойка с рисками, колонки.
  S.box(CHK, 0, 14, { tone: "mid", inner: k.lineSvg(k.sideSeam(CHK, 4, P, 4), { tone: "faint" }) }, { bevel: 0.7 });
  S.line(k.planOutline({ x: CHK.x + 4, y: CHK.y + 10, w: CHK.w - 8, d: CHK.d - 14, r: 1.5 }, 14, P, 3), { tone: "faint" }, [CHK.x + CHK.w / 2, CHK.y + CHK.d / 2, 14.1]);
  S.box(RACK, 14, 62, { tone: "mid" }, { bevel: 0.5, ref: [RACK.x + RACK.w / 2, RACK.y + 3, 40], bias: -20 });
  const fy = RACK.y + RACK.d;
  const marks = [3.5, 3.8, 4.2].map((v) => k.segment([RACK.x, fy, COL_Z0 + (v - 3) * COL_SCALE], [RACK.x + RACK.w, fy, COL_Z0 + (v - 3) * COL_SCALE], P)).join("");
  const minor = [];
  for (let v = 3.0; v <= 4.51; v += 0.1) minor.push(k.segment([RACK.x, fy, COL_Z0 + (v - 3) * COL_SCALE], [RACK.x + 3, fy, COL_Z0 + (v - 3) * COL_SCALE], P));
  S.raw([RACK.x + RACK.w / 2, fy, 40], k.lineSvg(k.segment([RACK.x + RACK.w, fy, 14], [RACK.x + RACK.w, fy, 76], P), { tone: "faint" }) + k.lineSvg(marks, { tone: "mid" }) + k.lineSvg(minor.join(""), { tone: "lo" }) + k.lineSvg(k.segment([RACK.x, fy, COL_Z0 + 1.2 * COL_SCALE], [RACK.x + RACK.w, fy, COL_Z0 + 1.2 * COL_SCALE], P), { tone: "lo", dashed: true }), { bias: -19 });
  const colX = (i) => CHK.x + 12 + i * ((CHK.w - 20) / Math.max(5, s - 1)) * (s > 1 ? 1 : 0);
  const cols = [];
  for (let i = 0; i < s; i++) {
    const x = colX(i);
    S.line(k.ring(x, CHK.y + 8, 3.6, 14, P, 20), { tone: "lo" }, [x, CHK.y + 8, 14.05]);
    cols.push([x, CHK.y + 8]);
  }
  S.raw([CHK.x + CHK.w / 2, CHK.y + 8, 40], `<g data-part="cols"></g>`, { bias: 5 });
  for (const [i, y] of [[0, CHK.y + 20], [1, CHK.y + 27]]) S.cyl(CHK.x + CHK.w - 10, y, 2, 14, 1.4, { tone: "hi" });

  S.group = "charger";
  // Зарядное устройство и нагрузка (резисторы на радиаторе).
  S.box(CHG, 0, 16, { tone: "mid", inner: k.lineSvg(k.sideSeam(CHG, 5, P, 4), { tone: "faint" }) }, { bevel: 0.7 });
  S.line(k.planOutline({ x: CHG.x + 6, y: CHG.y + 6, w: 30, d: 16, r: 1 }, 16, P, 3), { tone: "lo" }, [CHG.x + 21, CHG.y + 14, 16.1]);
  S.line(k.planOutline({ x: CHG.x + 7.5, y: CHG.y + 7.5, w: 27, d: 13, r: 0.6 }, 16, P, 2), { tone: "faint" }, [CHG.x + 21, CHG.y + 14, 16.15]);
  const chgKnob = knob(S, CHG.x + 50, CHG.y + 14, 16, 5, 4);
  S.raw([CHG.x + 20, CHG.y + 30, 16.2], k.dotsSvg(k.dotGrid(CHG.x + 8, CHG.y + 27, 10, 3, 2.6, 16, P), { size: 0.4, tone: "lo" }));
  S.group = "load";
  S.box(LOAD, 0, 6, { tone: "mid" }, { bevel: 0.6 });
  for (let i = 0; i < 9; i++) S.box({ x: LOAD.x + 5 + i * 7, y: LOAD.y + 4, w: 2.2, d: LOAD.d - 8, r: 0.4 }, 6, 10, { tone: "mid" }, { steps: 2, ref: [LOAD.x + 6 + i * 7, LOAD.y + LOAD.d / 2, 11] });
  for (const x of [LOAD.x + 12, LOAD.x + 34, LOAD.x + 56]) S.box({ x: x - 7, y: LOAD.y + LOAD.d / 2 - 4, w: 14, d: 8, r: 1 }, 16, 6, { tone: "hi", crease: "lo" }, { steps: 2, ref: [x, LOAD.y + LOAD.d / 2, 19] });
  const loadKnob = knob(S, LOAD.x + LOAD.w + 10, LOAD.y + 12, 0, 6, 6);
  S.box({ x: LOAD.x + LOAD.w + 2, y: LOAD.y + 2, w: 16, d: 20, r: 2 }, 0, 0.1, { tone: "lo" }, { steps: 2, bias: -5 });
  S.group = "leads";
  // Провода от XT60 к зарядке и к нагрузке.
  const toChg = S.tube([[xt[0] - 3, xt[1] + 7, 6], [xt[0] - 6, xt[1] + 16, 6], [CHG.x + CHG.w - 10, CHG.y - 4, 8], [CHG.x + CHG.w - 10, CHG.y + 1, 8]], 1.2, { tone: "mid", bendR: 6 });
  const toLoad = S.tube([[xt[0] + 4, xt[1] + 5, 6], [xt[0] + 14, xt[1] + 10, 6], [LOAD.x + 4, LOAD.y - 4, 8], [LOAD.x + 6, LOAD.y + 1, 8]], 1.2, { tone: "mid", bendR: 6 });

  S.group = "thermo";
  // Термометр окружающего воздуха.
  S.box({ x: THERMO[0] - 8, y: THERMO[1] - 8, w: 16, d: 16, r: 3 }, 0, 4, { tone: "mid" });
  S.cyl(THERMO[0], THERMO[1], 2.4, 4, 40, { tone: "hi", crease: "none" });
  S.raw([THERMO[0], THERMO[1], 30], `<g data-part="thermo"></g>`, { bias: 3 });
  S.cyl(THERMO[0], THERMO[1], 3.6, 44, 3, { tone: "mid" });

  S.group = null;
  const live = { cols, s, p, cells: cellRef, chgPointer: chgKnob.pointer, loadPointer: loadKnob.pointer, routes: { chg: toChg.map(at), load: toLoad.map(at) } };
  S.raw([0, 0, 300], `<path data-part="chgptr" class="iso-line" data-tone="hi" d="${chgKnob.pointer(0)}"/><path data-part="loadptr" class="iso-line" data-tone="hi" d="${loadKnob.pointer(0)}"/><g data-part="flow"></g>`, { bias: 1e4 });
  const svg = k.figureSvg({ width: W, height: H, label: `Батарея ${s}S${p}P из отдельных банок на поддоне, балансир на ${s + 1} проводов к тестеру с колонками напряжения, зарядное устройство и блок нагрузки.`, body: S.svg() });
  const labels = labelsAt(P, [
    ["Банки LiPo", [PACK0[0] + 30, PACK0[1] + 30, 33], "Каждая банка — 3,7 В в среднем и 4,2 В полная. Буква S — сколько банок соединено подряд."],
    ["Тестер банок", [RACK.x + RACK.w / 2, RACK.y + 3, 50], "Столбики — напряжение каждой банки. Когда садиться, решает самая слабая банка."],
    ["Зарядка", [CHG.x + CHG.w / 2, CHG.y + CHG.d / 2, 16], "Заряжает до 4,2 В на банку и выравнивает банки через балансир."],
    ["Нагрузка (моторы)", [LOAD.x + LOAD.w / 2, LOAD.y + LOAD.d / 2, 16], "Изображает моторы: чем больше ток, тем сильнее проседает напряжение."],
    ["Термометр воздуха", [THERMO[0], THERMO[1], 44], "На морозе сопротивление банок растёт, и под нагрузкой напряжение падает сильнее."],
  ]);
  return { svg, P, labels, live, parts: S.count() };
}

export const defaults = { config: "6S", mode: "load", load: 25, soc: 0.85, cold: false, aged: false, mah: 1300 };
export const controls = [
  { id: "mode", label: "Режим", type: "seg", options: [["load", "Полёт"], ["storage", "Storage"], ["charge", "Заряд LiPo"], ["hv", "Заряд как LiHV"]] },
  { id: "load", label: "Ток нагрузки", type: "range", min: 0, max: 80, step: 1, fmt: (v) => `${v} А` },
  { id: "config", label: "Сборка", type: "select", options: Object.keys(CONFIGS).map((c) => [c, c]), rebuild: true },
  { id: "mah", label: "Ёмкость банки", type: "select", options: [[1300, "1300 мА·ч"], [6000, "6000 мА·ч"]], num: true },
  { id: "cold", label: "Мороз −15 °C", type: "check" },
  { id: "aged", label: "Старая батарея (сопротивление ×2)", type: "check" },
];
export const tour = [
  { at: 0, set: { mode: "load", load: 15, cold: false } },
  { at: 4, set: { load: 60 } },
  { at: 8, set: { cold: true } },
  { at: 12, set: { load: 20, cold: false } },
];

export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const colsEl = q("cols"), flow = q("flow"), chgptr = q("chgptr"), loadptr = q("loadptr"), thermo = q("thermo");
  const sim = { soc: state.soc, h: [], t: 0, load: state.load };
  let b = battery({ s: L.s, p: L.p, mah: state.mah, soc: sim.soc, load: 0 });
  const colH = (v) => clamp((v - 3) * COL_SCALE, 0.5, 62);
  return {
    tick(dt, calm, st) {
      sim.t += dt;
      const fast = 40; // ускорение времени
      let current = 0;
      if (st.mode === "load") current = st.load;
      sim.load += (current - sim.load) * (calm ? 1 : 1 - Math.exp(-dt / 0.25));
      const cap = (st.mah / 1000) * L.p * 3600;
      if (st.mode === "load") sim.soc = clamp(sim.soc - (sim.load * dt * fast) / cap, 0.02, 1.08);
      if (st.mode === "storage") sim.soc += (0.5 - sim.soc) * (1 - Math.exp(-dt / 1.5));
      // Балансир не пускает ни одну банку выше 4,2 В: у самой «бодрой» банки разброс +1 %, поэтому общий заряд — до 99 %.
      if (st.mode === "charge") sim.soc = Math.min(0.99, sim.soc + dt * 0.06);
      if (st.mode === "hv") { sim.hvRan = true; sim.soc = Math.min(1.08, sim.soc + dt * 0.03); }
      if (st.mode === "load" && sim.soc <= 0.03) sim.soc = 0.95; // новая батарея в туре
      b = battery({ s: L.s, p: L.p, mah: st.mah, soc: sim.soc, load: sim.load, cold: st.cold, aged: st.aged });
      if (b.cells.some((v) => v > 4.21)) sim.overSeen = true; // перезаряд запоминаем на каждом кадре
      const weakest = b.cells.indexOf(b.minCell);
      let html = "";
      const items = L.cols.map(([x, y], i) => ({ x, y, i, d: k.depthOf([x, y, 0], P) })).sort((a, c) => a.d - c.d);
      for (const { x, y, i } of items) {
        const v = b.cells[i];
        html += k.solidSvg(k.cylinder(x, y, 2.8, COL_Z0, colH(v), P, 18), { tone: v > 4.21 ? "red" : "hi", lit: i === weakest, crease: "lo" });
      }
      colsEl.innerHTML = html;
      chgptr.setAttribute("d", L.chgPointer(st.mode === "storage" ? -1 : st.mode === "charge" ? 0.6 : st.mode === "hv" ? 1.5 : -2));
      loadptr.setAttribute("d", L.loadPointer(-2.4 + (st.mode === "load" ? (sim.load / 80) * 4.8 : 0)));
      // Storage: выше 50 % банки отдают энергию (как разряд), ниже — заряжаются.
      const route = st.mode === "load" ? L.routes.load : st.mode === "storage" && sim.soc > 0.5 ? L.routes.load : L.routes.chg;
      flow.innerHTML = calm ? "" : `<path class="iso-line" data-tone="lit" data-flow style="stroke-width:1.2" d="M${route.map((pt) => pt.map((v) => v.toFixed(1)).join(" ")).join("L")}"/>`;
      // Термометр: столбик «ртути».
      const tz = st.cold ? 10 : 30;
      thermo.innerHTML = `<path class="iso-line" data-tone="lit" style="stroke-width:1.6" d="${k.segment([THERMO[0], THERMO[1] + 2.4, 6], [THERMO[0], THERMO[1] + 2.4, 6 + tz], P)}"/>`;
      return true;
    },
    facts() {
      // Ошибку поймали (задание hv): заряд как LiHV шёл, режим сменили, а ни одна банка не ушла выше 4,21 В.
      return { minCell: b.minCell, over: b.cells.some((v) => v > 4.21), p: L.p, soc: sim.soc, hvRan: !!sim.hvRan, overSeen: !!sim.overSeen };
    },
    readout() {
      const mode = { load: `под ${fmt(sim.load)} А`, storage: "Storage", charge: "заряд", hv: "заряд HV" }[state.mode];
      return `${L.s}S${L.p}P · ${fmt(b.vRest, 1)} В покой · ${fmt(b.vLoad, 1)} В ${mode} · мин. ${fmt(b.minCell, 2)} В`;
    },
    metrics() {
      const warn = b.minCell < 3.5 ? "пора садиться (LOW BATTERY)" : b.minCell < 3.6 ? "скоро садиться" : b.cells.some((v) => v > 4.21) ? "ПЕРЕЗАРЯД" : "норма";
      const iMax = b.iMax;
      return [
        ["Номинал / полная", `${fmt(b.nominal, 1)} В / ${fmt(b.full, 1)} В`, "3,7 и 4,2 × S"],
        ["Ёмкость сборки", `${fmt(b.capacity)} мА·ч · ${fmt(b.wh, 1)} Вт·ч`, "закон"],
        ["Провода балансира", `${b.leads} (S + 1)`, "закон"],
        ["Токоотдача на бумаге", `${fmt(iMax)} А (${fmt(b.capacity / 1000, 1)} А·ч × 100C)`, "оценка"],
        ["Просадка под нагрузкой", `${fmt(b.sag, 2)} В`, "закон Ома"],
        ["Состояние", warn, ""],
      ];
    },
    reset() {
      sim.soc = state.soc;
      sim.load = state.load;
    },
  };
}
