// Fig: связка пульт — приёмник — полётник. Пульт с экраном настроек, приёмник ELRS с антенной и светодиодом,
// четыре провода UART к полётнику, ноутбук с вкладкой «Приёмник» Betaflight. Волны между антеннами — радио,
// огоньки по проводам — CRSF, полоски на ноутбуке — то, что полётник понял.
import { k, G, scene, basePlate, labelPlate, pcb, plug, fmt, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -106, y: -130, w: 206, d: 252, r: 8 };
// Зритель смотрит с +x: «вперёд от зрителя» — это −x, «вправо» — +y.
const PULT = [54, 64];
const GIM = [[60, 51], [60, 77]]; // левый стик (газ) — ближе к −y, правый — к +y
const RX = { x: 30, y: -104, w: 22, d: 30 };
const FC = { x: -26, y: -52, w: 46, d: 46 };
const LAP = { x: -90, y: -64, w: 44, d: 128 }; // ноутбук сзади, экран смотрит на зрителя (+x)
const SCR = { x: -96, y: -64, w: 4, d: 128, z0: 4, h: 76 };
const SW = SCR.d - 8; // ширина картинки на экране

export const PHRASES = [["sokol", "sokol"], ["sapsan", "sapsan"], ["orel", "orel"]];
export const VERS = [[3, "3.5"], [4, "4.0"]];
export const REG = [["2G4", "2,4 ГГц"], ["915", "915 МГц"], ["868", "868 МГц"]];
const REG_L = { "2G4": "2,4 ГГц", 915: "915 МГц", 868: "868 МГц" };
const ORD = [["AETR", "AETR"], ["TAER", "TAER"]];
const NAMES = { A: "Крен", E: "Тангаж", R: "Рыскание", T: "Газ" };

// Модель: бинд (три условия), Model Match, порядок каналов.
export function pairModel(s) {
  const diff = [];
  if (s.txPh !== s.rxPh) diff.push("бинд-фраза");
  if (s.txV !== s.rxV) diff.push("основная версия (3.x и 4.x не дружат)");
  if (s.txReg !== s.rxReg) diff.push("диапазон (2,4 ГГц и 900 МГц — разное железо)");
  const bound = diff.length === 0;
  const mmBad = bound && !!s.mm && Number(s.rxNum) !== 1;
  const cmd = bound && !mmBad;
  const val = { T: 1000 + (s.throttle || 0) * 1000, A: 1500 + (s.roll || 0) * 500, E: 1500 + (s.pitch || 0) * 500, R: 1500 + (s.yaw || 0) * 500 };
  const ch = [...s.txOrd].map((c) => val[c]);
  const read = {};
  [...s.bfOrd].forEach((c, i) => (read[c] = ch[i]));
  const wrong = s.txOrd !== s.bfOrd;
  const flag = !cmd ? "RXLOSS" : read.T > 1050 ? "THROTTLE" : "";
  return { diff, bound, mmBad, cmd, val, read, wrong, flag };
}

export const meta = {
  id: "pair",
  title: "Связка пульт — приёмник",
  hint: "Настройки — под стендом",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Волны — радио между антеннами; огоньки на проводах — команды CRSF к полётнику" },
    { mark: "raised", label: "Пульт с экраном, приёмник ELRS, полётник, ноутбук с Betaflight" },
    { mark: "edge", label: "Светодиод приёмника: горит ровно, мигает медленно или трижды" },
  ],
  caption: "Команда проходит три «языка»: радио от пульта к приёмнику (ELRS), провода UART от приёмника к полётнику (CRSF), потом полётник — регуляторам (DShot). Бинд получается, только если у пульта и приёмника совпали бинд-фраза, основная версия прошивки и диапазон. Порядок каналов (AETR у Radiomaster, TAER у TBS) должен совпадать на пульте и в Betaflight. Model Match пропускает команды только от модели с «своим» номером — в курсе его выключают.",
  aria: "Справа настройки пульта (фраза, версия, диапазон, порядок каналов, Model Match), приёмника (фраза, версия, диапазон, номер модели) и Betaflight (порядок каналов), ниже стики пульта.",
  missions: [
    {
      id: "bind", look: ["pult", "rx"], touch: ["txReg", "rxReg"], see: "экран пульта, наклейку приёмника и светодиод",
      text: "Пульт и приёмник не видят друг друга. Найди отличие и добейся ровного света светодиода",
      check: (f) => f.bound,
      predict: { q: "Фраза и версия у пульта и приёмника одинаковые, но пульт на 2,4 ГГц, а приёмник на 915 МГц. Свяжутся?", options: ["Да, фраза ведь одна", "Нет: это разные диапазоны и разное железо", "Свяжутся, но LQ будет низкий"], right: 1 },
      setup: {},
    },
    {
      id: "v4", look: ["pult", "rx"], touch: ["txV", "rxV"], see: "светодиод приёмника и волны между антеннами",
      text: "Обнови пульт до версии 4.0 — связь пропадёт. Верни её",
      check: (f, s) => f.bound && Number(s.txV) === 4 && Number(s.rxV) === 4,
      predict: { q: "Пульт обновили до ELRS 4.0, приёмник остался на 3.5. Что будет?", options: ["Всё работает: фраза та же", "Связь пропадёт: основные версии 3 и 4 не связываются", "Работает, но медленнее"], right: 1 },
      setup: { rxReg: "2G4" },
    },
    {
      id: "order", look: ["laptop"], touch: ["bfOrd", "sticks"], see: "полоску «Газ» в Betaflight при движении крена",
      text: "В Betaflight стоит порядок не как на пульте. Подвигай крен, посмотри на газ — и исправь",
      check: (f) => f.cmd && !f.wrong && f.read.T < 1050,
      predict: { q: "Пульт шлёт AETR, Betaflight ждёт TAER. Что покажет полоска «Газ» при отпущенных стиках?", options: ["1000 — газ внизу", "Около 1500 — и флаг THROTTLE", "Ничего, полоска пустая"], right: 1 },
      confirm: { q: "Почему при неверном порядке арм запрещён?", options: ["Betaflight читает крен (1500) как газ: газ «не внизу» — флаг THROTTLE", "Пульт и приёмник не связаны", "Слабый сигнал"], right: 0, miss: "Поставь снова TAER и посмотри на строку «Газ» и флаг вверху экрана ноутбука." },
      setup: { rxReg: "2G4", bfOrd: "TAER" },
    },
    {
      id: "mm", look: ["rx", "laptop"], touch: ["mm"], see: "светодиод приёмника и полоски в Betaflight",
      text: "Включи Model Match, когда приёмник помнит другой номер модели. Связь есть, а дрон не слушается — почему?",
      check: (f) => f.mmBad,
      predict: { q: "Включили Model Match на пульте (модель №1), а приёмник запомнил №2. Что будет?", options: ["Связь пропадёт полностью", "Радио есть, но приёмник не отдаёт команды полётнику — RXLOSS", "Всё работает как раньше"], right: 1 },
      confirm: { q: "Как по приёмнику понять, что виноват Model Match?", options: ["Светодиод мигает трижды подряд", "Светодиод горит ровно", "Светодиод мигает медленно"], right: 0, miss: "Посмотри на светодиод приёмника: три коротких вспышки и пауза." },
      setup: { rxReg: "2G4" },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [PULT[0] - 20, PULT[1] - 20, 102], [SCR.x, SCR.y, SCR.z0 + SCR.h + 2], [SCR.x, SCR.y + SCR.d, SCR.z0 + SCR.h + 2]], W, H, { pad: 18, azimuth: 36 });
}

const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = pairModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: PLATE.x + 10, y: PLATE.y + 10, w: 46, d: 18, r: 1.5 }, "BIND");

  // ── Пульт: корпус, гимбалы, блок с экраном настроек, антенна модуля ──
  S.group = "pult";
  const [px, py] = PULT;
  const stand = { x: px - 32, y: py - 34, w: 62, d: 68, r: 3 };
  S.box(stand, 0, 5, { tone: "mid" }, { bevel: 0.5 });
  S.dots(k.corners(stand, 4).map(([a, b]) => [a, b, 5]), { size: 0.45 }, [px, py, 5.1]);
  const body = { x: px - 28, y: py - 30, w: 52, d: 60, r: 7 };
  S.box(body, 5, 11, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(body, 11, P, 6), { tone: "faint" }) }, { bevel: 0.8 });
  for (const [gx, gy] of GIM) {
    S.line(k.ring(gx, gy, 8, 16, P, 40) + k.ring(gx, gy, 6.6, 16, P, 40), { tone: "lo" }, [gx, gy, 16.05]);
    S.cyl(gx, gy, 5, 16, 1.4, { tone: "hi" }, { ref: [gx, gy, 16.7] });
  }
  // Блок с экраном — у дальнего края пульта, экран смотрит на зрителя.
  const blk = { x: px - 26, y: py - 27, w: 12, d: 54, r: 2 };
  S.box(blk, 5, 52, { tone: "mid", inner: k.lineSvg(k.sideSeam(blk, 40, P, 3), { tone: "faint" }) }, { bevel: 0.5, ref: [blk.x + blk.w, py, 30] });
  const tface = k.sideMatrix([blk.x + blk.w, blk.y + blk.d - 3], 55, P, "right");
  const tScr = `<rect x="0" y="0" width="${blk.d - 6}" height="21" rx="1.2" class="osd-screen"/>`
    + txt(2.4, 6, `ELRS ${Number(state.txV) === 4 ? "4.0" : "3.5"} · ${REG_L[state.txReg]}`, "pr-t")
    + txt(2.4, 12, `фраза: ${state.txPh}`, "pr-t")
    + txt(2.4, 18, `${state.txOrd} · MM ${state.mm ? "вкл · №1" : "выкл"}`, "pr-t");
  S.raw([blk.x + blk.w + 0.4, py, 45], `<g transform="${tface}">${tScr}</g>`, { bias: 3 });
  const txBase = [blk.x + 6, py - 20, 57];
  S.cyl(txBase[0], txBase[1], 2.6, 57, 3.4, { tone: "mid", inner: k.lineSvg(k.knurl(txBase[0], txBase[1], 2.6, 57, 60.4, 12, P), { tone: "lo" }) });
  const txTip = [txBase[0], txBase[1], 100];
  S.tube([[txBase[0], txBase[1], 60.4], txTip], 1.2, { tone: "hi", maxLength: 40 });
  S.solid(G.sphereOf(txTip, 2, P), { tone: "hi" }, txTip, { bias: 0.5 });
  S.raw([GIM[0][0], GIM[0][1], 40], `<g data-part="sticks"></g>`, { bias: 40 });

  // ── Приёмник ELRS на поролоне: плата, светодиод, наклейка, антенна-диполь ──
  S.group = "rx";
  S.box({ x: RX.x - 2, y: RX.y - 2, w: RX.w + 4, d: RX.d + 4, r: 2 }, 0, 3, { tone: "lo" }, { bevel: 0.4 });
  const rxTop = pcb(S, { ...RX, r: 1 }, 3, { holes: false, chips: [{ x: RX.x + 11, y: RX.y + 12, w: 10, d: 10, h: 1.4, dot: true }, { x: RX.x + 11, y: RX.y + 24, w: 8, d: 4, h: 1 }], pads: [0, 1, 2, 3].map((i) => [RX.x + 1.8, RX.y + 6 + i * 5]) });
  const ledP = [RX.x + RX.w - 4, RX.y + 4.5, rxTop + 0.6];
  S.raw([ledP[0], ledP[1], ledP[2] + 1], `<g data-part="led"></g>`, { bias: 6 });
  // Наклейка на поролоне: что прошито в приёмник (в жизни это видно в настройках ELRS по Wi-Fi).
  const tag = { x: RX.x + RX.w + 5, y: RX.y - 8, w: 19, d: 46 };
  S.box({ ...tag, r: 1 }, 0, 0.6, { tone: "mid" }, { steps: 2, layer: 0.5 });
  const tagM = k.topMatrix([tag.x + 1.4, tag.y + tag.d - 1.6], 0.6, P, "y");
  S.raw([tag.x + tag.w / 2, tag.y + tag.d / 2, 0.7], `<g transform="${tagM}">${txt(0, 4.6, `RX · ${REG_L[state.rxReg]}`, "pr-tag")}${txt(0, 10, `ELRS ${Number(state.rxV) === 4 ? "4.0" : "3.5"}`, "pr-tag")}${txt(0, 15.4, `${state.rxPh} · №${state.rxNum}`, "pr-tag")}</g>`, { layer: 0.5, bias: 1 });
  const coax = [[RX.x + RX.w - 5, RX.y + RX.d - 1, rxTop + 0.6], [RX.x + RX.w - 5, RX.y + RX.d + 1, rxTop + 6], [RX.x + RX.w - 5, RX.y + RX.d + 1, 40]];
  S.tube(coax, 0.7, { tone: "mid", bendR: 2, maxLength: 12 });
  const rxTip = [RX.x + RX.w - 5, RX.y + RX.d + 1, 40];
  S.tube([[rxTip[0] - 9, rxTip[1], 40], [rxTip[0] + 9, rxTip[1], 40]], 0.8, { tone: "hi", maxLength: 10 });
  S.cyl(rxTip[0], rxTip[1], 1.4, 38.6, 2.8, { tone: "mid" }, { bias: 0.4 });

  // ── Провода UART: приёмник → полётник ──
  S.group = "wires";
  const routes = [0, 1, 2, 3].map((i) => {
    const y0 = RX.y + 6 + i * 5;
    const y1 = FC.y + 14 + i * 5;
    return [[RX.x + 1.8, y0, rxTop + 0.4], [RX.x - 6, y0, 1.2], [FC.x + FC.w + 8, y1, 1.2], [FC.x + FC.w - 3, y1, 7.6 + 1.6]];
  });
  routes.forEach((r) => S.tube(r, 0.55, { tone: "mid", bendR: 3, maxLength: 10 }));

  // ── Полётник на стойках ──
  S.group = "fc";
  for (const [sx, sy] of k.corners(FC, 4)) S.cyl(sx, sy, 1.8, 0, 7.6, { tone: "mid", crease: "none" });
  const fcTop = pcb(S, { ...FC, r: 2 }, 7.6, { chips: [{ x: FC.x + 25, y: FC.y + 24, w: 13, d: 13, h: 1.4, dot: true, legs: 7 }, { x: FC.x + 36, y: FC.y + 11, w: 6, d: 6, h: 1 }, { x: FC.x + 13, y: FC.y + 38, w: 8, d: 5, h: 1.6 }], pads: [0, 1, 2, 3].map((i) => [FC.x + FC.w - 3, FC.y + 14 + i * 5]) });
  plug(S, FC.x + 4, FC.y + FC.d - 9, fcTop, 5, 7, 2.6);

  // ── Ноутбук с Betaflight ──
  S.group = "laptop";
  S.box({ ...LAP, r: 3 }, 0, 4, { tone: "hi", crease: "lo" }, { bevel: 0.6 });
  const keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 15; c++) keys.push([LAP.x + 6 + r * 5.4, LAP.y + 12 + c * 7.2, 4]);
  S.dots(keys, { size: 0.5, tone: "lo" }, [LAP.x + 14, LAP.y + LAP.d / 2, 4.1]);
  S.line(k.planOutline({ x: LAP.x + 30, y: LAP.y + LAP.d / 2 - 18, w: 10, d: 36, r: 1.2 }, 4, P, 3), { tone: "lo" }, [LAP.x + 35, LAP.y + LAP.d / 2, 4.1]);
  S.box({ ...SCR, r: 2 }, SCR.z0, SCR.h, { tone: "mid", inner: k.lineSvg(k.sideSeam(SCR, SCR.z0 + 4, P, 3), { tone: "faint" }) }, { bevel: 0.5, ref: [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2] });
  const lface = k.sideMatrix([SCR.x + SCR.w, SCR.y + SCR.d - 4], SCR.z0 + SCR.h - 4, P, "right");
  S.raw([SCR.x + SCR.w + 0.4, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2], `<g transform="${lface}"><rect x="0" y="0" width="${SW}" height="${SCR.h - 8}" rx="1.6" class="bf-screen"/><g data-part="bf"></g></g>`, { bias: 5 });
  // USB от ноутбука к полётнику.
  S.group = "usb";
  S.tube([[LAP.x + LAP.w, LAP.y + LAP.d - 30, 2], [LAP.x + LAP.w + 8, LAP.y + LAP.d - 28, 1.2], [FC.x - 4, FC.y + FC.d - 9, 1.2], [FC.x + 1.5, FC.y + FC.d - 9, fcTop + 1.3]], 0.9, { tone: "mid", bendR: 5, maxLength: 12 });

  S.group = null;
  S.raw([0, 0, 400], `<g data-part="air"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Стенд связки: пульт с экраном настроек, приёмник ELRS на поролоне, провода к полётнику, ноутбук с вкладкой «Приёмник» Betaflight.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Пульт", [px, py, 18], "Шлёт по радио положение стиков. На экране: версия ELRS, диапазон, бинд-фраза, порядок каналов, Model Match."],
    ["Приёмник ELRS", [RX.x + RX.w / 2, RX.y + RX.d / 2, rxTop], "Ловит радио от пульта и по проводам UART отдаёт команды полётнику (протокол CRSF). Светодиод: ровно — связь, медленно мигает — нет связи, трижды — Model Match."],
    ["Полётник", [FC.x + FC.w / 2, FC.y + FC.d / 2, fcTop], "Получает каналы и раскладывает их по схеме из Betaflight (AETR или TAER)."],
    ["Betaflight · «Приёмник»", [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h], "Полоски каналов: так полётник понял стики. Газ внизу должен быть около 1000."],
  ]);
  return {
    svg, P, labels, model: M,
    live: { txTip: at(txTip), rxTip: at(rxTip), led: at(ledP), gim: GIM, routes: routes.map((r) => r.map(at)) },
    parts: S.count(),
  };
}

export const defaults = { txPh: "sokol", txV: 3, txReg: "2G4", txOrd: "AETR", mm: false, rxPh: "sokol", rxV: 3, rxReg: "915", rxNum: 2, bfOrd: "AETR", throttle: 0, yaw: 0, roll: 0, pitch: 0 };
export const controls = [
  { id: "txPh", label: "Пульт: бинд-фраза", type: "seg", options: PHRASES, rebuild: true },
  { id: "txV", label: "Пульт: версия ELRS", type: "seg", options: VERS, num: true, rebuild: true },
  { id: "txReg", label: "Пульт: диапазон (модуль)", type: "seg", options: REG, rebuild: true },
  { id: "rxPh", label: "Приёмник: бинд-фраза", type: "seg", options: PHRASES, rebuild: true },
  { id: "rxV", label: "Приёмник: версия ELRS", type: "seg", options: VERS, num: true, rebuild: true },
  { id: "rxReg", label: "Приёмник: диапазон (железо)", type: "seg", options: REG, rebuild: true },
  { id: "sticks", label: "Стики пульта (Mode 2) — тяни кружки", type: "sticks", fmt: (s) => `газ ${Math.round((s.throttle || 0) * 100)} % · крен ${Math.round((s.roll || 0) * 100)} %` },
  { id: "txOrd", label: "Порядок каналов на пульте (Radiomaster — AETR)", type: "seg", options: ORD, rebuild: true },
  { id: "bfOrd", label: "Порядок каналов в Betaflight", type: "seg", options: ORD, rebuild: true },
  { id: "mm", label: "Model Match на пульте (модель №1)", type: "check", rebuild: true },
  { id: "rxNum", label: "Номер модели, запомненный приёмником", type: "seg", options: [[1, "№1"], [2, "№2"]], num: true, rebuild: true },
];
export const tour = [
  { at: 0, set: { rxReg: "915" } },
  { at: 3, set: { rxReg: "2G4" } },
  { at: 6, set: { roll: 0.8 } },
  { at: 8, set: { roll: 0, throttle: 0.5 } },
  { at: 10, set: { throttle: 0 } },
  { at: 12, set: { rxReg: "915" } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const airEl = q("air"), ledEl = q("led"), bfEl = q("bf"), sticksEl = q("sticks");
  const sim = { t: 0, view: {} };
  let M = built.model;
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const along = (pts, u) => {
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
    let d = u * tot;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) return lerp(pts[i], pts[i + 1], d / seg[i]); d -= seg[i]; }
    return pts[pts.length - 1];
  };
  function drawSticks(st) {
    for (const key of ["thr", "roll", "pitch", "yaw"]) {
      const want = key === "thr" ? st.throttle || 0 : st[key] || 0;
      sim.view[key] = (sim.view[key] ?? want) + (want - (sim.view[key] ?? want)) * 0.3;
    }
    let s = "";
    for (const [[gx, gy], [fwd, right]] of [[L.gim[0], [(sim.view.thr - 0.5) * 1.6, sim.view.yaw]], [L.gim[1], [sim.view.pitch * 0.8, sim.view.roll]]]) {
      const tip = [gx - fwd * 5, gy + right * 5, 30];
      s += k.solidSvg(k.cylinder(gx, gy, 2.2, 17.4, 2, P, 18), { tone: "mid" });
      s += `<path class="iso-line" data-tone="hi" style="stroke-width:2.2" d="${k.segment([gx, gy, 19], tip, P)}"/>`;
      s += k.solidSvg(G.sphereOf(tip, 2.4, P, { steps: 24 }), { tone: "hi" });
    }
    if (sticksEl.innerHTML !== s) sticksEl.innerHTML = s;
  }
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      M = pairModel(st);
      drawSticks(st);
      // Радио: дуги летят от антенны пульта. Без бинда приёмник их «не понимает» — гаснут на полпути.
      let air = "";
      const a = L.txTip, b = L.rxTip;
      const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny);
      for (let i = 0; i < 4; i++) {
        const u = calm ? 0.2 + i * 0.2 : (sim.t * 0.55 + i / 4) % 1;
        const reach = M.bound ? 1 : 0.55;
        if (u > reach) continue;
        const o = M.bound ? Math.min(1, u * 6) * (1 - Math.max(0, u - 0.85) * 6) : Math.min(1, u * 6) * (1 - u / reach);
        const [cx, cy] = lerp(a, b, u);
        const r = 5 + u * 6;
        const ux = (nx / nl) * r, uy = (ny / nl) * r;
        const dx = ((b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1])) * 3, dy = ((b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])) * 3;
        air += `<path class="pr-wave${M.bound ? "" : " off"}" style="opacity:${o.toFixed(2)}" d="M${(cx - ux).toFixed(1)} ${(cy - uy).toFixed(1)}Q${(cx + dx * 2).toFixed(1)} ${(cy + dy * 2).toFixed(1)} ${(cx + ux).toFixed(1)} ${(cy + uy).toFixed(1)}"/>`;
      }
      if (!M.bound) {
        const [cx, cy] = lerp(a, b, 0.62);
        air += `<path class="pk-lost" d="M${(cx - 4).toFixed(1)} ${(cy - 4).toFixed(1)}l8 8m0 -8l-8 8"/>`;
      }
      // CRSF по проводам: огоньки бегут к полётнику, только если приёмник отдаёт команды.
      if (M.cmd && !calm) for (const r of L.routes) for (let j = 0; j < 2; j++) {
        const [x, y] = along(r, (sim.t * 0.9 + j / 2) % 1);
        air += `<circle class="pr-bit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5"/>`;
      }
      airEl.innerHTML = air;
      // Светодиод приёмника.
      const ph = sim.t % 1.6;
      const on = calm ? M.bound : !M.bound ? Math.floor(sim.t * 1.2) % 2 === 0 : M.mmBad ? ph < 0.9 && Math.floor(ph * 6.6) % 2 === 0 : true;
      const [lx, ly] = L.led;
      ledEl.innerHTML = `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="2.6" ry="1.6" class="led${on ? (M.cmd ? " on" : " warn") : ""}"/>${on ? `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="5" ry="3.1" class="pr-glow${M.cmd ? "" : " warn"}"/>` : ""}`;
      // Экран Betaflight: вкладка «Приёмник».
      const w = SW;
      let bf = txt(3, 7, `Приёмник · ждёт ${st.bfOrd}`, "bf-t") + txt(w - 3, 7, M.flag ? M.flag : "флагов нет", `bf-t ${M.flag ? "bad" : "good"}`, "end");
      ["A", "E", "R", "T"].forEach((c, i) => {
        const y = 13 + i * 11;
        const v = M.cmd ? M.read[c] : null;
        bf += txt(3, y + 4.6, NAMES[c], "bf-t") + `<rect x="34" y="${y}" width="${w - 64}" height="5.6" rx="2.6" class="bf-track"/>`;
        if (v) bf += `<rect x="34" y="${y}" width="${(((v - 1000) / 1000) * (w - 64)).toFixed(1)}" height="5.6" rx="2.6" class="bf-bar${c === "T" && v > 1050 ? " bad" : ""}"/>` + txt(w - 3, y + 4.8, fmt(v), "bf-t", "end");
      });
      if (!M.cmd) bf += txt(w / 2, 61, M.bound ? "радио есть, команд нет" : "нет сигнала", "bf-t bad", "middle");
      if (bfEl.innerHTML !== bf) bfEl.innerHTML = bf;
      return true;
    },
    facts() {
      return { bound: M.bound, cmd: M.cmd, mmBad: M.mmBad, wrong: M.wrong, read: { T: M.read.T, A: M.read.A, E: M.read.E, R: M.read.R } };
    },
    readout() {
      // То же, что на экране ноутбука и на светодиоде, — отдельными пунктами (✗ / ✓ — цвет плашки на телефоне).
      const led = !M.bound ? "диод мигает: ищет пульт" : M.mmBad ? "диод мигает трижды" : "диод горит";
      const gas = M.cmd ? `${M.read.T > 1050 ? "✗" : "✓"} газ ${fmt(M.read.T)}` : M.bound ? "✗ команд нет" : "✗ нет сигнала";
      const ord = M.cmd ? `${M.wrong ? "✗" : "✓"} ${state.txOrd}→${state.bfOrd}` : `${state.txOrd}→${state.bfOrd}`;
      return `${M.bound ? "✓ бинд есть" : "✗ бинда нет"} · ${M.flag ? `✗ ${M.flag}` : "✓ флагов нет"} · ${gas} · ${led} · ${ord}`;
    },
    // Объяснение плашки итога (телефон: нажатие на плашку).
    explain(chip) {
      const c = chip.replace(/^[✗✓]\s*/, "");
      if (/^бинда нет/.test(c)) return "Пульт и приёмник не видят друг друга: должны совпасть бинд-фраза, основная версия ELRS и диапазон.";
      if (/^бинд есть/.test(c)) return "Пульт и приёмник связаны по радио.";
      if (/^RXLOSS/.test(c)) return "Betaflight не получает команды с приёмника — арм запрещён.";
      if (/^THROTTLE/.test(c)) return "Газ не внизу: каналы перепутаны, на место газа попал другой стик (≈1500). Арм запрещён.";
      if (/^флагов нет/.test(c)) return "Полётник получает команды, запретов по приёмнику нет.";
      if (/^газ /.test(c)) return M.read.T > 1050 ? "В покое газ должен быть ≈1000. Здесь больше — порядок каналов не совпадает." : "Газ внизу ≈ 1000 — так и должно быть в покое.";
      if (/^команд нет/.test(c)) return "Радио есть, а команд на полётник нет — так бывает при включённом Model Match.";
      if (/^нет сигнала/.test(c)) return "Приёмник ничего не передаёт полётнику: бинда нет.";
      if (/^диод/.test(c)) return "Светодиод приёмника: мигает медленно — ищет пульт, мигает трижды — Model Match не совпал, горит — всё связано.";
      if (/→/.test(c)) return "Порядок каналов: как шлёт пульт → как ждёт Betaflight. Должны совпадать (в курсе — AETR).";
      return "";
    },
    metrics() {
      return [
        ["Радио (бинд)", M.bound ? "есть" : "нет", ""],
        ["Команды полётнику", M.cmd ? "идут (CRSF)" : M.bound ? "нет — Model Match" : "нет", ""],
        ["Газ в Betaflight", M.cmd ? fmt(M.read.T) : "—", ""],
        ["Флаг арма", M.flag || "нет", ""],
      ];
    },
    note() {
      if (!M.bound) return `<b>Не видят друг друга.</b> Бинд — один ключ на два замка: должны совпасть фраза, основная версия и диапазон. Сейчас отличается: ${M.diff.join(", ")}.`;
      if (M.mmBad) return "<b>Model Match:</b> приёмник слушается только модель со «своим» номером. Радио есть, светодиод мигает трижды, а команд на полётник нет — в Betaflight флаг RXLOSS. В курсе Model Match выключают.";
      if (M.wrong) return `<b>Пульт шлёт ${state.txOrd}, Betaflight ждёт ${state.bfOrd}.</b> Каналы читаются не те: на место газа попадает крен, поэтому в покое «газ» ≈ 1500 — флаг THROTTLE, арма не будет.`;
      return "<b>Всё совпало.</b> Двигай стики — полоски на ноутбуке повторяют их. Газ внизу ≈ 1000. Огоньки на проводах — команды CRSF от приёмника к полётнику.";
    },
  };
}
