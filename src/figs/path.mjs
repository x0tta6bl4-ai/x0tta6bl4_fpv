// Fig: два радиомоста на целом дроне. Слева оператор (пульт, очки), справа квадрокоптер True-X
// на столе на коротком страховочном шнуре (верхняя пластина снята, батарея снизу на стяжках).
// Команда бежит стик → TX → радио → RX → UART (CRSF) → FC → DShot → ESC → 4 мотора, видео — камера → FC (OSD) → VTX → антенна → очки.
// Дрон живой: полётник в режиме Angle, микшер Quad X, тяга винтов против веса. Газ выше висения — дрон
// поднимается со стола, наклон стиком — кренится и уходит в сторону, пока не натянется шнур.
import { k, G, scene, basePlate, rulerStrip, labelPlate, pcb, motor, propSvg, plug, TAU, clamp } from "../figkit.mjs";
import { FAULTS } from "../models.mjs";
import { makeQuad, stepQuad, anglesOf, MOT as QMOT } from "./quadsim.mjs";

const W = 660, H = 470;
const PLATE = { x: -200, y: -150, w: 400, d: 300, r: 10 };
// Место оператора.
const HS = { x: -192, y: -138, w: 82, d: 50, r: 8 }; // пульт
const GIM = [[HS.x + 20, HS.y + 26], [HS.x + HS.w - 20, HS.y + 26]]; // левый (газ/рыскание), правый (тангаж/крен)
const TXANT = [HS.x + HS.w / 2, HS.y - 6];
const TXTOP = 66;
const ARMSW = [HS.x + 8, HS.y + 6]; // тумблер ARM (AUX1) — крайний левый
const GOG = { x: -190, y: 70, w: 62, d: 30, r: 8 }; // очки
const GANT = [GOG.x + GOG.w - 8, GOG.y + GOG.d - 4];

// ── Борт ──
// Свои координаты дрона: начало — центр масс, x — нос, y — вправо от носа (в этой изометрии ось +y
// на экране лежит справа от носа), z — вверх. На столе центр масс стоит в точке CM0.
// Номера Betaflight: 1 — задний правый, 2 — передний правый, 3 — задний левый, 4 — передний левый.
// Props in: 1 и 4 — по часовой (CW, угол винта растёт), 2 и 3 — против (CCW).
const DX = 60; // где дрон стоит на столе
const ZCM = 30; // высота центра масс, когда дрон стоит на батарее
const CM0 = [DX, 0, ZCM];
const BATT = { x: -40, y: -17, w: 80, d: 34, r: 4 }, BATT_H = 26;
const BZ = -ZCM; // низ батареи — касается стола
const Z0 = BZ + BATT_H + 1.5; // низ рамы
const MOTORS = [
  { n: 1, x: -84, y: 84, cw: true, side: "R" },
  { n: 2, x: 84, y: 84, cw: false, side: "R" },
  { n: 3, x: -84, y: -84, cw: false, side: "L" },
  { n: 4, x: 84, y: -84, cw: true, side: "L" },
];
const TB = 3.2;
const BODY = { x: -56, y: -22, w: 112, d: 44, r: 6 };
const STACK = { x: -18, y: -18, w: 36, d: 36, r: 3 };
const EZ = Z0 + TB + 5, FZ = Z0 + TB + 16;
const PROP_R = 54;
const TETHER = 90; // страховочный шнур 9 см: от якоря на столе до низа батареи

// ── Физика: сама модель — в quadsim.mjs (СИ), здесь — то, что нужно сцене ──
const SLOW = 0.4; // показ замедлен в 2,5 раза: настоящий дрон проходит 9 см за доли секунды
const TWR = 7; // тяговооружённость 5" на 6S: полный газ — тяга в 7 весов
const IDLE = 0.055; // dshot_idle_value 5,5 %
const ACC_OFF = 8; // «сбитый» акселерометр: калибровали на столе с наклоном 8° вправо
const MIN_CHECK = 1050; // газ ниже этого Betaflight считает «внизу»
const HOVER = (1 / Math.sqrt(TWR) - IDLE) / (1 - IDLE); // газ висения (тяга ∝ квадрату оборотов) ≈ 0,34
const RAD = Math.PI / 180;

// Где неисправность — какие детали засчитываются как правильный ответ «нажми на виновную деталь».
// Провод TX→RX можно показать с любого конца; Serial RX и протокол — настройки полётника.
// Ученик нажал не ту деталь при поломке, которую надо найти: короткая подсказка, почему здесь не то и куда смотреть.
const CTRL = ["pult", "rx", "fc", "esc", "vmg"], VIDEO = ["camera", "vtx", "antenna", "goggles"];
function wrongPick(fault, sel) {
  const ok = DIAG[fault];
  if (!ok || !sel || ok.includes(sel)) return "";
  if (LINK[fault]) {
    if (sel === "pult") return "Пульт передаёт: радио до приёмника доходит, бинд есть. Ищи дальше по цепочке пульт → RX → FC.";
    if (sel === "fc") return "Здесь данных уже нет: полётник видит «нет данных». Посмотри, какое звено перед ним перестаёт их передавать.";
    if (sel === "rx") return "Приёмник работает и отдаёт данные. Посмотри, доходят ли они до полётника — провод и настройки порта.";
    if (sel === "esc" || sel === "vmg") return "Это звено после полётника: оно ничего не получает, потому что данные пропали раньше. Ищи, где они перестают идти: пульт → RX → FC.";
    if (sel === "battery") return "Питание в порядке: всё на борту светится и работает. Ищи, где пропадают данные: пульт → RX → FC.";
    return "Это видеоканал — он работает, картинка в очках есть. Поломка в управлении: пульт → RX → FC.";
  }
  if (CTRL.includes(sel) || sel === "battery") return "Это канал управления или питание — они работают: включи ARM, и команда дойдёт до моторов. Ищи в видео: камера → FC (OSD) → VTX → антенна → очки.";
  if (sel === "goggles") return "Очки показывают то, что до них долетает. Ищи раньше: что видно в очках — снег, слабая картинка или только надписи OSD?";
  if (fault === "cam") return sel === "vtx" || sel === "antenna" ? "VTX и антенна работают: надписи OSD доходят до очков. Значит, картинка теряется раньше полётника — между камерой и FC." : "Не здесь. Надписи OSD видны, картинки нет — ищи до полётника.";
  if (sel === "camera") return "Камера работает: картинка доходит до полётника, иначе не было бы и её следа в снегу. Ищи после FC — в передатчике и антенне.";
  if (fault === "pit" && sel === "antenna") return "Антенна прикручена правильно. Картинка есть, но в сильном снегу — передатчик почти не излучает. Посмотри на сам VTX и его режим.";
  return "Не здесь. Посмотри, что видно в очках, и иди по видеоцепочке.";
}
// Какие детали ученик уже открывал (для задания «Знакомство»); живёт, пока открыта страница, переживает «Сброс».
const SEEN = new Set();
const DIAG = { modelmatch: ["rx"], txrx: ["rx", "fc"], uart: ["fc"], crsf: ["fc"], pit: ["vtx"], rpsma: ["antenna", "vtx"], cam: ["camera"] };
export const PARTS = [
  { id: "pult", name: "Пульт (TX)", chain: "cmd", text: "Mode 2: левый стик — газ (вверх-вниз) и рыскание, правый — тангаж и крен. Модуль сзади (ELRS или TBS) превращает положения стиков в радиопакеты." },
  { id: "rx", name: "Приёмник RX", chain: "cmd", text: "Ловит пакеты пульта Т-антенной и по проводу UART пересказывает их полётнику на языке CRSF. TX приёмника → RX полётника (крест-накрест)." },
  { id: "fc", name: "Полётник FC", chain: "both", text: "Верхний этаж стека. Читает каналы с приёмника, гироскоп и акселерометр, держит заданный наклон (режим Angle), считает PID и шлёт каждому мотору число по DShot. Ещё накладывает OSD на видео камеры." },
  { id: "esc", name: "Регулятор ESC 4-в-1", chain: "cmd", text: "Нижний этаж стека. Получает от FC четыре команды DShot и подаёт на каждый мотор три фазы тока. Питается прямо от батареи через XT60." },
  { id: "vmg", name: "Моторы и винты", chain: "cmd", text: "Номера Betaflight: 1 — задний правый, 2 — передний правый, 3 — задний левый, 4 — передний левый. Props in: 1 и 4 крутятся по часовой, 2 и 3 — против. Тяга растёт как квадрат оборотов." },
  { id: "camera", name: "Камера", chain: "vid", text: "Снимает картинку и по проводу отдаёт её полётнику: FC накладывает надписи OSD и передаёт видео на VTX." },
  { id: "vtx", name: "Видеопередатчик VTX", chain: "vid", text: "Отправляет видео в эфир. Канал и мощность меняет полётник по проводу SmartAudio или Tramp (на TX свободного UART)." },
  { id: "antenna", name: "Антенны борта", chain: "both", text: "Т-антенна приёмника на задних лучах (управление, 900 МГц или 2,4 ГГц) и «леденец» видео сзади (5,8 ГГц). Выведены за карбоновую раму." },
  { id: "battery", name: "Батарея", chain: "pwr", text: "6S LiPo под рамой на стяжках (снизу, чтобы был виден стек). Питает ESC через XT60; полётник берёт от ESC и раздаёт 5 В приёмнику и камере, а VTX — 9–12 В. Дрон стоит на ней, как на ножке." },
  { id: "goggles", name: "Очки (VRX)", chain: "vid", text: "Видеоприёмник с экранами. Принимает картинку с VTX на том же канале и с той же поляризацией антенн." },
];

export const meta = {
  id: "path",
  title: "Два радиомоста",
  hint: "Управление — под сценой",
  legendClosed: true, // описание длинное: свёрнуто, чтобы управление стояло сразу под сценой
  narrowZoom: 1, // широкая сцена: на телефоне без увеличения, чтобы были видны пульт, весь дрон и экран очков в левом углу
  keys: [
    { mark: "lit", label: "Пакет команды; синяя линия — докуда дошла команда, оранжевая — видео, серый пунктир — дальше не идёт" },
    { mark: "raised", label: "Весь борт: рама, 4 ВМГ, стек FC + ESC, RX, камера, VTX, батарея снизу" },
    { mark: "red", label: "Красная метка — место поломки или причина запрета" },
  ],
  caption: `Целый квадрокоптер True-X на столе, на коротком страховочном шнуре (верхняя пластина снята для наглядности). Режим полёта — Angle: стик задаёт наклон, отпустил — дрон выравнивается. ARM включён, газ внизу — винты крутятся на холостом ходу (${(IDLE * 100).toFixed(1).replace(".", ",")} %, так Betaflight держит моторы готовыми; чтобы стояли, включают Motor Stop). Газ выше висения (≈${Math.round(HOVER * 100)} %) — дрон поднимается; движение показано в 2,5 раза медленнее. Управление: стик → TX → радио → RX → UART (CRSF) → FC → DShot → ESC → мотор. Видео: камера → FC (OSD) → VTX → радио → очки. В жизни проверки на столе делают без винтов. Границы модели: показан аналоговый видеотракт (в цифровых системах надписи рисуют очки); холостой ход 5,5 % — значение Betaflight по умолчанию, а газ висения, просадка батареи и поведение в полёте — учебная модель, не измерения; команда мотору — доля хода, а не обороты и не тяга.`,
  // Основной путь: знакомство и три опыта (исправный борт, потеря управления, потеря изображения).
  // Перед опытом — прогноз (predict), после — подтверждающий признак (confirm): звезда за понимание, а не за выбор пункта.
  // Motor Stop и кувырок — расширенная диагностика (adv), по желанию.
  missions: [
    { id: "parts", touch: [], see: "детали на схеме или строка деталей под ней",  text: "Знакомство: нажми на схеме или в строке деталей под ней приёмник RX, полётник FC, регулятор ESC и видеопередатчик VTX — под схемой появится, что делает каждый", check: (f) => ["rx", "fc", "esc", "vtx"].every((x) => (f.seen || []).includes(x)) },
    {
      id: "armon", look: ["motors","pult"], touch: ["armed"], see: "винты: закрутятся ли на холостом ходу",  text: "Опыт 1 · исправный борт. Заармь дрон: газ внизу, включи тумблер ARM", check: (f, s) => s.fault === "ok" && f.armed && s.throttle < 0.05,
      predict: { q: "Газ внизу, ты включаешь тумблер ARM. Что сделают винты?", options: ["Останутся стоять, пока не поднимешь газ", "Закрутятся медленно — на холостом ходу", "Раскрутятся, и дрон взлетит со стола"], right: 1 },
    },
    {
      id: "rxloss", touch: ["fault"], see: "блок «Полётник видит» и флаги под схемой",  text: "Опыт 2 · потеря управления. Выбери поломку, при которой полётник пишет RXLOSS, и нажми на схеме деталь, где обрываются данные", check: (f, s) => (DIAG[s.fault] || []).includes(s.select) && f.flag === "RXLOSS", feedback: (f, s) => (LINK[s.fault] ? wrongPick(s.fault, s.select) : ""),
      predict: { q: "Приёмник перестал отдавать команды полётнику. Что продолжит работать?", options: ["Ничего: дрон погаснет целиком", "Видео в очках", "Моторы — они крутятся и без стиков"], right: 1 },
      confirm: { q: "Какой признак подтверждает, что команды не доходят до полётника?", options: ["В очках снег", "Моторы крутятся на холостом ходу", "В блоке «Полётник видит» — «нет данных», флаг RXLOSS"], right: 2, miss: "Смотри под схемой: что полётник получает с приёмника и какие флаги горят. Очки показывают видео — это другой канал." },
    },
    {
      id: "video", touch: ["fault","armed"], see: "экран очков и цепочку «Управление»",  text: "Опыт 3 · потеря изображения. Найди поломку, при которой пропало видео, а управление работает: заармь дрон и нажми на схеме виновную деталь", check: (f, s) => ["pit", "rpsma", "cam"].includes(s.fault) && (DIAG[s.fault] || []).includes(s.select) && f.armed, feedback: (f, s) => (["pit", "rpsma", "cam"].includes(s.fault) ? wrongPick(s.fault, s.select) : ""),
      predict: { q: "Отказал видеотракт: картинка в очки не приходит. Что продолжит работать?", options: ["Управление: команды дойдут до моторов", "Ничего: без видео полётник не армится", "Только пульт — дрон перестанет принимать команды"], right: 0 },
      confirm: { q: "Что доказывает, что управление при этом исправно?", options: ["Арм проходит, пакет команды доходит до моторов, винты крутятся", "В очках снег или чёрный экран", "Флаг RXLOSS"], right: 0, miss: "Признак исправного управления ищи в цепочке «Управление» и у моторов, а не в очках." },
    },
    { id: "idle", look: ["motors"], touch: ["fault","armed"], see: "винты после арма",  adv: true, text: "Найди «поломку», при которой арм есть, а моторы стоят", check: (f, s) => s.fault === "motorstop" && f.armed && s.throttle < 0.05 },
    { id: "flip", look: ["motors"], touch: ["fault","armed","sticks"], see: "дрон после подъёма газа",  adv: true, text: "Дело №2: выбери поломку из этой группы, заармь и подними газ — дрон кувыркнётся, а защита Runaway (в этой модели — всегда) выключит моторы", check: (f, s) => ["propdir", "motordir", "motororder", "orient", "motordead"].includes(s.fault) && f.runaway },
  ],
};

// ── Векторы и поза ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
// Поза дрона — матрица R из модели: оси дрона в мире [нос, вправо, вверх].
const rot = (R, l) => add(add(mul(R[0], l[0]), mul(R[1], l[1])), mul(R[2], l[2]));

function projection() {
  // В кадр входят стол, пульт с антенной, очки и дрон в любой точке, куда пускает шнур.
  const pts = [...k.boxCorners(PLATE, -17, 0), [TXANT[0], TXANT[1], TXTOP + 4], [GANT[0], GANT[1], 48]];
  for (const z of [0, ZCM + TETHER + 80]) for (const [x, y] of [[-150, 0], [150, 0], [0, -150], [0, 150]]) pts.push([DX + x, y, z]);
  return k.fitProjection(pts, W, H, { pad: 14, azimuth: 44, elevation: 30 });
}
// Камера с началом координат в нуле: так рисуется дрон в своих координатах.
const camOf = (P, azimuth = P.azimuth, elevation = P.elevation) => ({ origin: [0, 0], scale: P.scale, azimuth, elevation });
// Дуга радиосвязи между двумя антеннами (квадратичная кривая, точки в мире).
function arc(a, b, lift, n = 18) {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(a[2], b[2]) + lift];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], u * u * a[1] + 2 * u * t * m[1] + t * t * b[1], u * u * a[2] + 2 * u * t * m[2] + t * t * b[2]]);
  }
  return out;
}
// Точка на ломаной (3D) по доле длины.
function along3(points, t) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
    seg.push(l);
    total += l;
  }
  let d = clamp(t, 0, 1) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? d / seg[i] : 0;
      return [0, 1, 2].map((j) => points[i][j] + (points[i + 1][j] - points[i][j]) * f);
    }
    d -= seg[i];
  }
  return points[0];
}

// Сам дрон в своих координатах, нарисованный камерой Pd. Возвращает SVG и 3D-точки проводов и меток.
// lite — облегчённый рисунок для ракурсов в движении (меньше рёбер, чипов и кусочков проводов).
function droneScene(Pd, fault, lite = false) {
  const S = scene(Pd);
  if (lite) {
    // Провод — толстая линия по точкам (в движении детали провода не видны, а трубки рисуются долго).
    const kk = G.scaleOf(Pd);
    S.tube = (pts, r, { tone = "mid" } = {}) => {
      const mid = pts[Math.floor(pts.length / 2)];
      S.put(mid, `<path class="iso-line wire-lite" data-tone="${tone === "hi" ? "mid" : "lo"}" style="stroke-width:${Math.max(0.8, r * 2 * kk).toFixed(2)}" d="${k.pathOf(pts.map((p) => k.iso(p, Pd)))}"/>`);
      return pts;
    };
  }
  // ── Батарея снизу на стяжках ──
  S.group = "battery"; S.comp = "battery";
  S.box(BATT, BZ, BATT_H, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(BATT, 8, Pd, 6), { tone: "faint" }) }, { bevel: 0.8, ref: [0, 0, BZ + BATT_H / 2] });
  for (const x of [-22, 14]) S.box({ x, y: BATT.y - 1.2, w: 8, d: BATT.d + 2.4, r: 0.6 }, BZ + 2, BATT_H + 1.2, { tone: "lo" }, { steps: 2, ref: [x + 4, 0, BZ + BATT_H / 2], bias: 1 });
  const xt = [-62, 6];
  const battLead = S.tube([[BATT.x, 4, BZ + BATT_H - 6], [BATT.x - 10, 4, BZ + BATT_H - 2], [xt[0] - 2, xt[1], Z0 + 1]], 1.4, { tone: "hi", bendR: 4 });
  S.tube([[BATT.x, -2, BZ + BATT_H - 6], [BATT.x - 10, -2, BZ + BATT_H - 2], [xt[0] - 2, xt[1] - 5, Z0 + 1]], 1.4, { tone: "mid", bendR: 4 });
  plug(S, xt[0] - 6, xt[1] - 9, Z0 - 1, 8, 15, 7, { tone: "hi" });

  // ── Рама: нижняя пластина и лучи ──
  S.group = "frame"; S.comp = null;
  S.box(BODY, Z0, TB, { tone: "mid" }, { bevel: 0.6, ref: [0, 0, Z0 + 1] });
  for (const m of MOTORS) {
    const ax = clamp(m.x, BODY.x + 12, BODY.x + BODY.w - 12), ay = clamp(m.y, BODY.y + 8, BODY.y + BODY.d - 8);
    const dx = m.x - ax, dy = m.y - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const ring = [[ax + nx * 9 - ux * 6, ay + ny * 9 - uy * 6], [m.x - ux * 12 + nx * 7.5, m.y - uy * 12 + ny * 7.5], [m.x + nx * 14, m.y + ny * 14], [m.x + ux * 15, m.y + uy * 15], [m.x - nx * 14, m.y - ny * 14], [m.x - ux * 12 - nx * 7.5, m.y - uy * 12 - ny * 7.5], [ax - nx * 9 - ux * 6, ay - ny * 9 - uy * 6]];
    S.solid(k.extrude(ring, Z0 - 0.6, TB + 0.6, Pd, { convex: false, bevel: 0.4 }), { tone: "mid" }, [(ax + m.x) / 2, (ay + m.y) / 2, Z0], { bias: -1 });
  }
  const camX = BODY.x + BODY.w - 10;
  for (const y of [-13, 10]) S.box({ x: camX - 16, y, w: 20, d: 3, r: 1 }, Z0 + TB, 27, { tone: "mid" }, { bevel: 0.3, steps: 2, ref: [camX - 6, y + 1.5, Z0 + 16], bias: y > 0 ? 4 : -4 });
  // Стойки под снятую верхнюю пластину.
  for (const [x, y] of [[BODY.x + 12, -16], [BODY.x + 12, 16], [BODY.x + BODY.w - 26, -16], [BODY.x + BODY.w - 26, 16]]) S.cyl(x, y, 2.4, Z0 + TB, 27, { tone: "mid", crease: "none" }, { ref: [x, y, Z0 + 14] });

  // ── ВМГ ──
  S.group = "motors"; S.comp = "vmg";
  // Камера ортогональная: все четыре мотора выглядят одинаково, поэтому мотор рисуется один раз и переносится.
  const M = scene(Pd);
  if (lite) {
    M.cyl(0, 0, 13 * 0.92, 0, 3.4, { tone: "mid" });
    M.cyl(0, 0, 13, 3.4, 11.6, { tone: "hi" });
    M.cyl(0, 0, 2.6, 15, 7, { tone: "mid" });
  } else motor(M, 0, 0, 0, { r: 13, h: 15 });
  const motorSvg = M.svg();
  for (const m of MOTORS) {
    const o = k.iso([m.x, m.y, Z0 + TB], Pd);
    S.raw([m.x, m.y, Z0 + TB + 7.5], `<g transform="translate(${o[0].toFixed(2)} ${o[1].toFixed(2)})">${motorSvg}</g>`);
  }
  const props = MOTORS.map((m) => ({ ...m, z: Z0 + TB + 15 + 1.2 }));

  // ── Стек: ESC и FC ──
  S.group = "esc"; S.comp = "esc";
  for (const [x, y] of k.corners(STACK, 3)) S.cyl(x, y, 1.6, Z0 + TB, EZ - Z0 - TB, { tone: "mid" }, { ref: [x, y, EZ - 2] });
  const escTop = pcb(S, STACK, EZ, { chips: lite ? [] : [0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => ({ x: STACK.x + 8 + j * 10, y: STACK.y + 7 + i * 7.5, w: 4.6, d: 4, h: 1 }))), opts: { ref: [0, 0, EZ], group: "esc", comp: "esc" } });
  // Три фазы от ESC к каждому мотору по лучу.
  const phase = {};
  for (const m of MOTORS) {
    const sx = Math.sign(m.x) * 18, sy = Math.sign(m.y) * 12;
    const sgx = Math.sign(m.x), sgy = Math.sign(m.y);
    let mid = null;
    for (const d of lite ? [0] : [-1.6, 0, 1.6]) {
      const r = S.tube([[sx, sy + d, escTop], [sx + sgx * 8, sy + sgy * 4 + d, Z0 + TB + 1.4], [m.x - sgx * 22, m.y - sgy * 22 + d, Z0 + TB + 1.2], [m.x - sgx * 10, m.y - sgy * 10 + d, Z0 + TB + 3]], 0.55, { tone: d === 0 ? "hi" : "mid", bendR: 4, maxLength: 16 });
      if (d === 0) mid = r;
    }
    phase[m.n] = mid;
  }
  // Силовые провода XT60 → ESC и конденсатор.
  const pwrEsc = S.tube([[xt[0] + 2, xt[1], Z0 + TB + 2], [-30, 4, Z0 + TB + 3], [-18, 4, escTop]], 1.3, { tone: "hi", bendR: 4 });
  S.tube([[xt[0] + 2, xt[1] - 6, Z0 + TB + 2], [-30, -4, Z0 + TB + 3], [-18, -4, escTop]], 1.3, { tone: "mid", bendR: 4 });
  const capF = G.frameOf([-22, -24, Z0 + TB + 4], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  S.solid(G.solidOf([[0, 4.2], [14, 4.2], [14.6, 3.6]], capF, Pd), { tone: "hi", inner: k.lineSvg(G.arcOf(capF, 3, 4.2, Pd), { tone: "lo" }) }, [-29, -24, Z0 + TB + 4]);
  S.group = "fc"; S.comp = "fc";
  for (const [x, y] of k.corners(STACK, 3)) {
    S.cyl(x, y, 1.4, escTop, FZ - escTop - 2, { tone: "mid", crease: "none" }, { ref: [x, y, FZ - 4] });
    S.cyl(x, y, 2.6, FZ - 2.4, 2.4, { tone: "lo" }, { ref: [x, y, FZ - 1] });
  }
  const fcTop = pcb(S, STACK, FZ, {
    chips: [
      { x: 0, y: 0, w: 9, d: 9, h: 1.2, legs: 6, dot: true },
      { x: 9, y: -9, w: 4, d: 4, h: 1 },
      { x: -9, y: 9, w: 6, d: 5, h: 1.1, legs: 3 },
    ],
    pads: [[-15, -8], [-15, -4], [-15, 0], [-15, 4], [15, -6], [15, 6]],
    opts: { ref: [0, 0, FZ], group: "fc", comp: "fc" },
  });
  // Шлейф FC → ESC (DShot, 4 сигнала) по заднему краю.
  const ribbon = [];
  for (let i = 0; i < 4; i++) {
    const y = -6 + i * 4;
    const r = S.tube([[-16, y, fcTop], [-20.5, y, FZ - 4], [-20.5, y, EZ + 4], [-16, y, escTop]], 0.45, { tone: i === 1 ? "hi" : "mid", bendR: 1.6 });
    if (i === 1) ribbon.push(...r);
  }
  // Питание FC от ESC (BEC 5 В идёт по тому же шлейфу) — отдельная жила.
  const pwrFc = S.tube([[-16, 10, escTop], [-20.5, 10, EZ + 4], [-20.5, 10, FZ - 4], [-16, 10, fcTop]], 0.45, { tone: "hi", bendR: 1.6 });

  // ── Приёмник у заднего правого луча, Т-антенна в трубках ──
  S.group = "rx"; S.comp = "rx";
  const rxp = { x: BODY.x + 2, y: BODY.y + BODY.d - 2, w: 14, d: 11, r: 1 };
  S.box({ x: rxp.x - 1, y: rxp.y - 1, w: rxp.w + 2, d: rxp.d + 2, r: 1.5 }, Z0 + TB, 2, { tone: "lo" }, { steps: 2 });
  const rxTop = pcb(S, rxp, Z0 + TB + 2, { holes: false, chips: [{ x: rxp.x + 7, y: rxp.y + 5.5, w: 4.6, d: 4.6, legs: 3, dot: true }], opts: { ref: [rxp.x + 7, rxp.y + 5, Z0 + TB + 3], group: "rx", comp: "rx" } });
  const led = [rxp.x + 2.4, rxp.y + rxp.d - 2.2, rxTop + 0.2];
  S.raw([led[0], led[1], led[2] + 1], `<g data-part="rxled">${k.dotsSvg([k.iso(led, Pd)], { size: 1.1, tone: "hi" })}</g>`, { bias: 3 });
  // RX → FC: 5V, G, TX→R2, RX→T2 (крест-накрест). При поломке «txrx» данные идут на «не ту» площадку.
  const swap = fault === "txrx";
  const fcPad = (i) => [-15, -8 + i * 4, fcTop];
  const rxWires = [];
  for (let i = 0; i < 4; i++) {
    const pad = swap ? i : [0, 1, 3, 2][i];
    const a = [rxp.x + rxp.w, rxp.y + 2 + i * 2.2, rxTop];
    const b = fcPad(pad);
    rxWires.push(S.tube([a, [a[0] + 7, a[1] - 2, rxTop + 2 + i], [b[0] - 8, b[1] + 3, b[2] + 4 + i], b], 0.42, { tone: i >= 2 ? "hi" : "mid", bendR: 3 }));
  }
  S.group = "rx"; S.comp = "antenna";
  const rxAnt = [];
  for (const m of MOTORS.filter((m) => m.x < 0)) {
    const t0 = [rxp.x + 2, rxp.y + 2, rxTop];
    const t1 = [m.x * 0.55, m.y * 0.55, Z0 + TB + 2];
    S.tube([t0, [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2, Z0 + TB + 3], t1], 0.5, { tone: "mid", bendR: 4 });
    const t2 = [t1[0] - 6, t1[1] + Math.sign(m.y) * 22, Z0 + TB + 2.4];
    S.tube([t1, t2], 1.2, { tone: "hi", maxLength: 30 });
    rxAnt.push(t2);
  }

  // ── Камера в клетке ──
  S.group = "camera"; S.comp = "camera";
  const cam = { x: camX - 15, y: -9.5, w: 19, d: 19, r: 2.4 };
  S.box(cam, Z0 + TB + 5, 19, { tone: "hi", crease: "lo" }, { bevel: 0.6, ref: [camX - 6, 0, Z0 + 18], bias: 1 });
  const lensF = G.frameOf([camX + 4, 0, Z0 + TB + 14.5], G.unit3([1, 0, 0.3]), [0, 1, 0], G.unit3([-0.3, 0, 1]));
  S.solid(G.solidOf([[0, 7.4], [2, 7.4], [2, 6.2], [7, 6.2], [7.6, 5.4], [8.4, 5.4]], lensF, Pd), { tone: "hi" }, [camX + 8, 0, Z0 + TB + 15], { bias: 2 });
  S.line(G.circleOf(lensF, 8.4, 3.8, Pd), { tone: "mid" }, [camX + 12, 0, Z0 + TB + 16], { bias: 2.2 });
  const camEnd = fault === "cam" ? [21, 9, fcTop + 5] : [15, 6, fcTop]; // отпаянный конец висит над площадкой
  const camWire = S.tube([[camX - 15, 0, Z0 + TB + 16], [camX - 22, 2, fcTop + 6], [18, 6, fcTop + 3], camEnd], 0.5, { tone: "mid", bendR: 3 });

  // ── VTX сзади и антенна-«леденец» ──
  S.group = "vtx"; S.comp = "vtx";
  const vtx = { x: BODY.x + 4, y: -14, w: 24, d: 22, r: 2 };
  const vz = Z0 + TB + 8;
  for (const [x, y] of k.corners(vtx, 3)) S.cyl(x, y, 1.2, Z0 + TB, vz - Z0 - TB, { tone: "mid" }, { ref: [x, y, vz - 2] });
  const vtxTop = pcb(S, vtx, vz, { chips: [{ x: vtx.x + 7, y: vtx.y + 7, w: 6, d: 5, legs: 3, dot: true }], opts: { ref: [vtx.x + 12, vtx.y + 11, vz], group: "vtx", comp: "vtx" } });
  if (!lite) for (let i = 0; i < 4; i++) S.box({ x: vtx.x + 12 + i * 3, y: vtx.y + 3, w: 1.4, d: 15, r: 0.3 }, vtxTop, 3.4, { tone: "mid" }, { steps: 2, ref: [vtx.x + 13 + i * 3, vtx.y + 10, vtxTop + 2] });
  const vtxWire = S.tube([[15, -6, fcTop], [10, -14, fcTop + 5], [vtx.x + vtx.w + 4, vtx.y + 4, vtxTop + 5], [vtx.x + vtx.w - 2, vtx.y + 4, vtxTop]], 0.5, { tone: "mid", bendR: 3 });
  const pwrVtx = S.tube([[-15, 8, fcTop], [-24, 8, fcTop + 3], [vtx.x + vtx.w - 4, vtx.y + vtx.d - 3, vtxTop + 4], [vtx.x + vtx.w - 6, vtx.y + vtx.d - 3, vtxTop]], 0.45, { tone: "hi", bendR: 3 });
  const ant0 = [BODY.x - 6, -2, Z0 + TB + 24];
  const pig = S.tube([[vtx.x + 2, vtx.y + 6, vtxTop + 0.6], [vtx.x - 4, vtx.y + 6, vtxTop + 4], ant0], 0.6, { tone: "mid", bendR: 3 });
  S.group = "vtx"; S.comp = "antenna";
  S.cyl(ant0[0], ant0[1], 3, ant0[2] - 2, 5, { tone: "mid", inner: lite ? "" : k.lineSvg(k.knurl(ant0[0], ant0[1], 3, ant0[2] - 2, ant0[2] + 3, 12, Pd), { tone: "lo" }) }, { ref: ant0 });
  const antTip = [ant0[0] - 9, ant0[1], ant0[2] + 28];
  const stub = [ant0[0] - 3, ant0[1], ant0[2] + 9];
  if (fault !== "rpsma") S.tube([[ant0[0], ant0[1], ant0[2] + 3], antTip], 1.1, { tone: "hi", maxLength: 40 });
  else S.tube([[ant0[0], ant0[1], ant0[2] + 3], stub], 1.1, { tone: "hi" });
  const vball = [antTip[0] - 2, antTip[1], antTip[2] + 5];
  if (fault !== "rpsma") S.solid(G.sphereOf(vball, 6, Pd), { tone: "hi" }, vball);
  S.group = null; S.comp = null;
  return {
    svg: S.svg(),
    pts: {
      props,
      rx: rxWires[2],
      swap: [rxWires[2], rxWires[3]],
      ribbon,
      phase,
      cam: camWire,
      vtx: vtxWire,
      pig,
      pw: [[...battLead, ...pwrEsc], pwrFc, pwrVtx],
      rxAnt: rxAnt[0],
      vant: fault === "rpsma" ? stub : vball,
      attach: [0, 0, BZ],
      marks: {
        rx: [rxp.x + rxp.w / 2, rxp.y + rxp.d / 2, rxTop + 2],
        wire: fcPad(2),
        fc: [0, 0, fcTop + 2],
        esc: [-18, 0, escTop],
        cam: [camX - 15, 0, Z0 + TB + 16],
        vtx: [vtx.x + vtx.w / 2, vtx.y + vtx.d / 2, vtxTop + 4],
        ant: [ant0[0], ant0[1], ant0[2] + 3],
        mot: [MOTORS[1].x, MOTORS[1].y, Z0 + TB + 18],
        m1: [MOTORS[0].x, MOTORS[0].y, Z0 + TB + 18],
        m2: [MOTORS[1].x, MOTORS[1].y, Z0 + TB + 18],
        m3: [MOTORS[2].x, MOTORS[2].y, Z0 + TB + 18],
        m4: [MOTORS[3].x, MOTORS[3].y, Z0 + TB + 18],
        bat: [BATT.x + BATT.w, 0, BZ + BATT_H / 2],
        lens: [camX + 8, 0, Z0 + TB + 15],
        usb: [STACK.x + STACK.w, 10, fcTop + 1],
      },
      nums: MOTORS.map((m) => {
        // Номер — рядом с лучом (сбоку, чтобы не мешали бегущие по проводам пакеты), не на моторе.
        const ux = m.x / Math.hypot(m.x, m.y), uy = m.y / Math.hypot(m.x, m.y);
        return [m.x * 0.6 - uy * 16, m.y * 0.6 + ux * 16, Z0];
      }),
    },
  };
}

// Дрон снизу (когда он наклонён от зрителя сильнее, чем камера смотрит сверху). Кит рисует только вид
// сверху, поэтому рисуем дрон, отражённый по высоте (z → −z), обычной камерой: матрица слоя сама
// перевернёт картинку (её определитель станет отрицательным). Детали — упрощённые: снизу видны батарея, рама, моторы.
function droneUnder(Pd, fault) {
  const S = scene(Pd);
  const mz = (z, h) => -(z + h); // низ отражённого бруска
  const wire = (pts, r, tone = "mid") => {
    const q = pts.map(([x, y, z]) => [x, y, -z]);
    S.put(q[Math.floor(q.length / 2)], `<path class="iso-line wire-lite" data-tone="${tone === "hi" ? "mid" : "lo"}" style="stroke-width:${Math.max(0.8, r * 2 * G.scaleOf(Pd)).toFixed(2)}" d="${k.pathOf(q.map((p) => k.iso(p, Pd)))}"/>`);
  };
  S.group = "frame"; S.comp = null;
  S.box(BODY, mz(Z0, TB), TB, { tone: "mid" });
  for (const m of MOTORS) {
    const ax = clamp(m.x, BODY.x + 12, BODY.x + BODY.w - 12), ay = clamp(m.y, BODY.y + 8, BODY.y + BODY.d - 8);
    const dx = m.x - ax, dy = m.y - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const ring = [[ax + nx * 9 - ux * 6, ay + ny * 9 - uy * 6], [m.x - ux * 12 + nx * 7.5, m.y - uy * 12 + ny * 7.5], [m.x + nx * 14, m.y + ny * 14], [m.x + ux * 15, m.y + uy * 15], [m.x - nx * 14, m.y - ny * 14], [m.x - ux * 12 - nx * 7.5, m.y - uy * 12 - ny * 7.5], [ax - nx * 9 - ux * 6, ay - ny * 9 - uy * 6]];
    S.solid(k.extrude(ring, mz(Z0 - 0.6, TB + 0.6), TB + 0.6, Pd, { convex: false }), { tone: "mid" }, [(ax + m.x) / 2, (ay + m.y) / 2, -Z0], { bias: -1 });
  }
  const camX = BODY.x + BODY.w - 10;
  for (const y of [-13, 10]) S.box({ x: camX - 16, y, w: 20, d: 3, r: 1 }, mz(Z0 + TB, 27), 27, { tone: "mid" }, { steps: 2 });
  for (const [x, y] of [[BODY.x + 12, -16], [BODY.x + 12, 16], [BODY.x + BODY.w - 26, -16], [BODY.x + BODY.w - 26, 16]]) S.cyl(x, y, 2.4, mz(Z0 + TB, 27), 27, { tone: "mid", crease: "none" });
  S.group = "motors"; S.comp = "vmg";
  for (const m of MOTORS) {
    S.cyl(m.x, m.y, 12, mz(Z0 + TB, 3.4), 3.4, { tone: "mid" });
    S.cyl(m.x, m.y, 13, mz(Z0 + TB + 3.4, 11.6), 11.6, { tone: "hi" });
  }
  S.group = "esc"; S.comp = "esc";
  S.box(STACK, mz(EZ, 1.6), 1.6, { tone: "mid" });
  S.group = "fc"; S.comp = "fc";
  S.box(STACK, mz(FZ, 1.6), 1.6, { tone: "mid" });
  S.group = "rx"; S.comp = "rx";
  const rxp = { x: BODY.x + 2, y: BODY.y + BODY.d - 2, w: 14, d: 11, r: 1 };
  S.box(rxp, mz(Z0 + TB, 3.6), 3.6, { tone: "mid" });
  S.group = "rx"; S.comp = "antenna";
  for (const m of MOTORS.filter((m) => m.x < 0)) {
    const t1 = [m.x * 0.55, m.y * 0.55, Z0 + TB + 2];
    wire([t1, [t1[0] - 6, t1[1] + Math.sign(m.y) * 22, Z0 + TB + 2.4]], 1.2, "hi");
  }
  S.group = "camera"; S.comp = "camera";
  S.box({ x: camX - 15, y: -9.5, w: 19, d: 19, r: 2.4 }, mz(Z0 + TB + 5, 19), 19, { tone: "hi", crease: "lo" });
  S.group = "vtx"; S.comp = "vtx";
  const vtx = { x: BODY.x + 4, y: -14, w: 24, d: 22, r: 2 };
  S.box(vtx, mz(Z0 + TB, 9.6), 9.6, { tone: "mid" });
  S.group = "vtx"; S.comp = "antenna";
  const ant0 = [BODY.x - 6, -2, Z0 + TB + 24];
  const tip = fault === "rpsma" ? [ant0[0] - 3, ant0[1], ant0[2] + 9] : [ant0[0] - 9, ant0[1], ant0[2] + 28];
  wire([[vtx.x + 2, vtx.y + 6, Z0 + TB + 10], ant0], 0.6);
  wire([ant0, tip], 1.1, "hi");
  if (fault !== "rpsma") S.solid(G.sphereOf([tip[0] - 2, tip[1], -(tip[2] + 5)], 6, Pd), { tone: "hi" }, [tip[0] - 2, tip[1], -(tip[2] + 5)]);
  S.group = "battery"; S.comp = "battery";
  S.box(BATT, mz(BZ, BATT_H), BATT_H, { tone: "hi", crease: "lo" }, { bevel: 0.8 });
  for (const x of [-22, 14]) S.box({ x, y: BATT.y - 1.2, w: 8, d: BATT.d + 2.4, r: 0.6 }, mz(BZ - 1.2, BATT_H + 1.2), BATT_H + 1.2, { tone: "lo" }, { steps: 2, bias: 1 });
  S.group = null; S.comp = null;
  return S.svg();
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (p) => k.iso(p, P);
  basePlate(S, PLATE);
  rulerStrip(S, { x: -60, y: PLATE.y + PLATE.d - 15, w: 150, d: 7, r: 1 });
  labelPlate(S, { x: -180, y: PLATE.y + PLATE.d - 28, w: 46, d: 18, r: 1.5 }, "FPV LINK");
  // Граница «оператор | борт».
  S.put(-6.5e8, k.lineSvg(k.lineOnTop([-120, PLATE.y + 5], [-120, PLATE.y + PLATE.d - 5], 0, P), { tone: "faint" }), { layer: 0 });

  // ── Пульт ──
  S.group = "pult"; S.comp = "pult";
  for (const [x, y] of [[HS.x + 10, HS.y + 8], [HS.x + HS.w - 10, HS.y + 8], [HS.x + 10, HS.y + HS.d - 8], [HS.x + HS.w - 10, HS.y + HS.d - 8]]) S.cyl(x, y, 3, 0, 2, { tone: "lo" }, { ref: [x, y, 1], bias: -30 });
  S.box(HS, 2, 13, { tone: "mid", inner: k.lineSvg(k.sideSeam(HS, 8, P, 6), { tone: "faint" }) }, { bevel: 1, ref: [HS.x + HS.w / 2, HS.y + HS.d / 2, 8] });
  const face = k.insetPlan(HS, 3);
  S.box(face, 15, 1.4, { tone: "mid" }, { bevel: 0.5, ref: [face.x + face.w / 2, face.y + face.d / 2, 15.7] });
  for (const [gx, gy] of GIM) {
    S.line(k.ring(gx, gy, 10, 16.4, P, 48) + k.ring(gx, gy, 8.6, 16.4, P, 48), { tone: "lo" }, [gx, gy, 16.45]);
    S.cyl(gx, gy, 6, 16.4, 1.6, { tone: "hi" }, { ref: [gx, gy, 17] });
  }
  for (const x of [HS.x + 8, HS.x + 18, HS.x + HS.w - 18, HS.x + HS.w - 8]) {
    S.cyl(x, HS.y + 6, 2, 16.4, 1.6, { tone: "mid" }, { ref: [x, HS.y + 6, 17] });
    if (x !== ARMSW[0]) S.tube([[x, HS.y + 6, 17.6], [x, HS.y + 4.6, 23]], 0.55, { tone: "hi" });
  }
  const bay = { x: TXANT[0] - 16, y: HS.y - 9, w: 32, d: 9, r: 1.5 };
  S.box(bay, 3, 13, { tone: "mid" }, { bevel: 0.4 });
  S.cyl(TXANT[0], TXANT[1], 2.8, 16, 4, { tone: "mid" });
  S.tube([[TXANT[0], TXANT[1], 20], [TXANT[0], TXANT[1], TXTOP]], 1.7, { tone: "hi", maxLength: 50 });
  S.raw([GIM[0][0], GIM[0][1], 40], `<g data-part="sticks"></g>`, { bias: 40 });
  S.raw([ARMSW[0], ARMSW[1], 30], `<g data-part="armsw"></g>`, { bias: 45 });

  // ── Очки ──
  S.group = "goggles"; S.comp = "goggles";
  for (const x of [GOG.x + 10, GOG.x + GOG.w - 10]) S.box({ x: x - 6, y: GOG.y + 4, w: 12, d: GOG.d - 8, r: 2 }, 0, 6, { tone: "lo" });
  S.box(GOG, 6, 18, { tone: "mid", inner: k.lineSvg(k.sideSeam(GOG, 12, P, 6), { tone: "faint" }) }, { bevel: 1, ref: [GOG.x + GOG.w / 2, GOG.y + GOG.d / 2, 14] });
  S.box({ x: GOG.x + 3, y: GOG.y - 5, w: GOG.w - 6, d: 5, r: 2 }, 8, 14, { tone: "lo" }, { ref: [GOG.x + GOG.w / 2, GOG.y - 3, 14], bias: -2 });
  S.line(k.planOutline(k.insetPlan(GOG, 5), 24, P, 4), { tone: "faint" }, [GOG.x + GOG.w / 2, GOG.y + GOG.d / 2, 24.1]);
  for (const [x, y] of [[GOG.x + 10, GOG.y + GOG.d - 6], GANT]) {
    S.cyl(x, y, 2.4, 24, 3, { tone: "mid" });
    S.tube([[x, y, 27], [x, y, 40]], 0.9, { tone: "hi" });
    S.solid(G.sphereOf([x, y, 43], 4.2, P), { tone: "hi" }, [x, y, 43]);
  }
  // Якорь страховочного шнура под дроном.
  S.group = null; S.comp = null;
  S.box({ x: DX - 9, y: -9, w: 18, d: 18, r: 2 }, 0, 2.4, { tone: "lo" }, { steps: 3 });

  // ── Дрон: свой слой, двигается целиком ──
  const Pd = camOf(P);
  const D = droneScene(Pd, state.fault);
  const c0 = at(CM0);
  // Пропеллеры рисуются каждый кадр в той же камере, что и дрон.
  const propHtml = D.pts.props.map((m, i) => `<g data-prop="${i}">${propSvg(Pd, m.x, m.y, m.z, PROP_R, i * 0.7, { blades: 3 })}</g>`).join("");
  const t0 = `matrix(1 0 0 1 ${c0[0].toFixed(1)} ${c0[1].toFixed(1)})`;
  const nums = MOTORS.map((m, i) => {
    const p = at(add(CM0, D.pts.nums[i]));
    return `<g class="mnum" data-num="${i}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><circle r="6.4"/><text y="3" text-anchor="middle">${m.n}</text><text class="mpct" data-mpct="${i}" x="9" y="3" text-anchor="start"></text></g>`;
  }).join("");
  // Экран очков: то, что видит пилот, — во весь свободный левый верхний угол (размер подобран по сцене,
  // когда дрон стоит на столе: не задевает стол, пульт, очки, радиодуги и подпись очков), линия ведёт к очкам.
  // Экран лежит под слоями дрона: взлетевший дрон пролетает поверх него и не прячется.
  // Рисунок экрана — в своих единицах 92×56, на сцене он больше чем вдвое.
  const SW = 92, SH = 56, DW = 200, DH = (DW * SH) / SW;
  const gx = 11, gy = 20;
  const stem = at([GOG.x + GOG.w / 2, GOG.y + GOG.d / 2, 24]);
  const screen = `<g class="gscreen" transform="translate(${gx} ${gy})"><path class="gs-stem" d="M${(stem[0] - gx).toFixed(1)} ${(DH + 4).toFixed(1)} L${(stem[0] - gx).toFixed(1)} ${(stem[1] - gy).toFixed(1)}"/><rect class="gs-frame" x="-4" y="-15" width="${DW + 8}" height="${(DH + 19).toFixed(1)}" rx="7"/><text class="gs-title" x="0" y="-5">в очках пилота</text><svg x="0" y="0" width="${DW}" height="${DH.toFixed(1)}" viewBox="0 0 ${SW} ${SH}"><g data-part="gview"></g></svg></g>`;
  // Тумблер ARM на нарисованном пульте можно нажать прямо на сцене.
  const ah = at([ARMSW[0], ARMSW[1], 20]);
  const armHit = `<g class="arm-hit" data-tap="arm"><circle cx="${ah[0].toFixed(1)}" cy="${ah[1].toFixed(1)}" r="11"/><text x="${(ah[0] - 13).toFixed(1)}" y="${(ah[1] + 3).toFixed(1)}" text-anchor="end">ARM</text></g>`;
  const packets = `<g data-part="packets"><circle data-pk="cmd" r="2.6" class="pk" style="opacity:0"/>${MOTORS.map((m) => `<circle data-pk="m${m.n}" r="2.2" class="pk" style="opacity:0"/>`).join("")}<circle data-pk="vid" r="2.6" class="pk pk-vid" style="opacity:0"/>${[0, 1, 2].map((i) => `<circle data-pk="pw${i}" r="2" class="pk pk-pw" style="opacity:0"/>`).join("")}</g>`;
  // Три слоя друг над другом: стол (почти не меняется), дрон с тенью и шнуром, надписи и пакеты.
  // Каждый подвижный слой браузер рисует отдельно, и полёт дрона не перерисовывает стол.
  const over = (cls, inner) => `<svg class="iso-svg iso-layer${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${inner}</svg>`;
  const svg = k.figureSvg({ width: W, height: H, label: "Учебный стол: слева пульт и очки оператора, справа целый квадрокоптер на коротком страховочном шнуре — рама, четыре мотора с винтами, стек полётного контроллера и регулятора, приёмник с Т-антенной, камера, видеопередатчик с антенной и батарея снизу. По проводам и по радио бегут пакет команды и кадр видео; с газом дрон поднимается со стола.", body: S.svg() })
    + over("", `${screen}<path data-part="shadow" class="drone-shadow" d="" style="opacity:0"/><g data-part="arcs"><path class="iso-line" data-tone="faint" data-dashed="" d=""/><path class="iso-line" data-tone="faint" data-dashed="" d=""/></g><path data-part="tether" class="tether" d=""/>`)
    + over(" pickable drone-layer", `<g data-part="drone" transform="${t0}"><g data-part="dbody">${D.svg}</g></g>`)
    + over(" pickable drone-layer", `<g data-part="drone" transform="${t0}"><g class="it" data-g="props" data-c="vmg" data-pick="vmg"><g data-part="dprops">${propHtml}</g></g></g>`)
    + over("", `<g data-part="flow"></g><g data-part="nums">${nums}</g><g data-part="wires"></g>${packets}<g data-part="rings"></g><g data-part="mark"></g>${armHit}`);
  // Подписи пульта и антенн — справа: слева им тесно рядом с очками.
  const labels = PARTS.map((p) => ({ text: p.name, pick: p.id, info: p.text, side: p.id === "pult" || p.id === "antenna" ? "right" : undefined }));
  const live = {
    P,
    D: D.pts,
    body0: D.svg,
    gim: GIM,
    txTip: [TXANT[0], TXANT[1], TXTOP],
    gog: [GANT[0], GANT[1], 43],
    anchor: [DX, 0, 2.4],
    marks: {
      arm: at([ARMSW[0], ARMSW[1], 24]),
      thr: at([GIM[0][0], GIM[0][1], 30]),
      rstick: at([GIM[1][0], GIM[1][1], 30]),
    },
    armsw: { base: [ARMSW[0], ARMSW[1], 17.6] },
    gscreen: { w: SW, h: SH },
  };
  return { svg, P, labels, live, parts: S.count() };
}

export const defaults = { fault: "ok", armed: false, throttle: 0, roll: 0, pitch: 0, yaw: 0, power: false, select: "" };
const pct = (v, neg, pos) => (Math.abs(v) < 0.03 ? "центр" : `${v < 0 ? neg : pos} ${Math.round(Math.abs(v) * 100)} %`);
// Неисправности по делам главы 17 — группами в выпадающем списке.
// Первая группа — три основных опыта главы; остальное — расширенная диагностика по делам главы 17.
const MAIN = ["ok", "modelmatch", "rpsma"];
const faultOptions = [{ group: "Основные опыты", items: MAIN.map((id) => { const f = FAULTS.find((x) => x.id === id); return [f.id, f.label]; }) }];
for (const f of FAULTS) {
  if (MAIN.includes(f.id)) continue;
  const name = `Расширенная · ${f.group}`;
  let g = faultOptions.find((o) => o.group === name);
  if (!g) faultOptions.push((g = { group: name, items: [] }));
  g.items.push([f.id, f.label]);
}
// Порядок — как на пульте у пилота: что сломано, тумблер ARM, стики (на телефоне всё сразу под стендом).
export const controls = [
  // Новая неисправность — новый опыт: дрон на столе, стики в исходном положении, тумблер ARM выключен
  // (кроме «armsw»: в ней тумблер включён с подачи питания — в этом и поломка). Выбранная деталь снимается:
  // справка прошлого опыта не должна заслонять объяснение нового.
  { id: "fault", label: "Неисправность", type: "select", options: faultOptions, rebuild: true, resets: ["throttle", "roll", "pitch", "yaw", "armed", "select"], resetTo: (v) => (v === "armsw" ? { armed: true } : null) },
  { id: "armed", label: "Тумблер ARM включён", type: "check" },
  { id: "sticks", label: "Стики пульта (Mode 2) — тяни кружки", type: "sticks", fmt: (s) => `газ ${Math.round(s.throttle * 100)} % · рыскание ${pct(s.yaw, "влево", "вправо")} · тангаж ${pct(s.pitch, "назад", "вперёд")} · крен ${pct(s.roll, "влево", "вправо")}` },
  { id: "power", label: "Показать питание (батарея → ESC → FC → RX, VTX)", type: "check" },
];
// Автопоказ: сначала арм при газе внизу (иначе THROTTLE), потом газ. Смена поломки начинает опыт заново,
// поэтому тумблер в тех же шагах задан явно.
export const tour = [
  { at: 0, set: { fault: "ok", armed: true, throttle: 0, roll: 0 } },
  { at: 1.5, set: { throttle: 0.35 } },
  { at: 5, set: { roll: 0.6 } },
  { at: 8, set: { roll: 0, fault: "modelmatch", armed: true } },
  { at: 13, set: { fault: "pit", armed: true } },
  { at: 18, set: { fault: "ok" } },
];

// ── Полётник: арм и флаги так, как их видит Betaflight 4.5 ──
// Арм — не положение тумблера, а состояние полётника (mem.armed):
//  • режим ARM включён, только если AUX1 попадает в диапазон из «Режимов» (обычно 1700–2100 мкс);
//  • флаги запрета Betaflight считает, только пока не армлен; THROTTLE — газ не ниже min_check (1050);
//  • ARM включили при любом запрете — встаёт ARMSWITCH и держится, пока тумблер не выключат;
//  • появилась связь, а ARM уже включён (при подаче питания) — NOT_DISARMED;
//  • Runaway Takeoff дизармит сам и ставит RUNAWAY; эти флаги снимает только выключенный ARM;
//  • армлен — газ можно поднимать; выключил тумблер — дизарм (в воздухе моторы встают, дрон падает).
// Тумблер (AUX1) полётник видит только через приёмник: нет данных — нет и тумблера.
const LINK = { modelmatch: [1, "rx", "rx"], txrx: [2, "wire", "uart"], uart: [2, "fc", "uart"], crsf: [2, "fc", "uart"] };
// Физические поломки дела №2 и «сбитый» акселерометр — параметры для модели дрона.
const FPHYS = {
  propdir: { thrust: [1, -0.4, 1, 1], flip: [0, 1, 0, 0] },
  motordir: { thrust: [1, 1, -0.3, 1], spin: [1, 1, -1, 1] },
  motororder: { map: [1, 0, 2, 3] },
  orient: { boardYaw: 90 },
  motordead: { dead: [0, 0, 0, 1] },
  acctilt: { accOff: ACC_OFF },
};
// Батарея 6S: напряжение в покое и внутреннее сопротивление (холодная или старая — в 7 раз больше).
const BATTERY = { ok: { rest: 25.0, rint: 0.018 }, lowv: { rest: 22.8, rint: 0.13 } };
function fcInput(f, st) {
  const sent = { roll: 1500 + 500 * st.roll, pitch: 1500 + 500 * (st.pitch || 0), thr: 1000 + 1000 * st.throttle, yaw: 1500 + 500 * (st.yaw || 0), aux: st.armed ? 2000 : 1000 };
  if (LINK[f.id]) return { sent, ch: null };
  // Пульт шлёт AETR; при «taer» Betaflight читает их как TAER: газ — из канала крена, тангаж — из газа.
  let ch = f.id === "taer" ? { roll: sent.pitch, pitch: sent.thr, thr: sent.roll, yaw: sent.yaw, aux: sent.aux } : { ...sent };
  // AUX1 не назначен в Mixes: пульт шлёт в канал середину, тумблер ни при чём.
  if (f.id === "auxmix") ch.aux = 1500;
  return { sent, ch };
}
// Режим ARM активен: AUX1 в диапазоне из «Режимов».
const boxArm = (f, ch) => !!ch && (f.id === "armrange" ? ch.aux >= 1300 && ch.aux <= 1700 : ch.aux >= 1700);
// Флаги запрета, кроме ARMSWITCH, в порядке битов Betaflight.
function blockers(f, ch, mem) {
  if (!ch) return ["RXLOSS"];
  const out = [];
  if (mem.notDisarmed) out.push("NOT_DISARMED");
  if (mem.runaway) out.push("RUNAWAY");
  if (ch.thr >= MIN_CHECK) out.push("THROTTLE");
  if (f.id === "prearm") out.push("NOPREARM");
  if (f.id === "msp") out.push("MSP");
  if (f.id === "acc") out.push("NO_ACC_CAL");
  if (f.id === "proto") out.push("MOTOR_PROTO");
  return out;
}
// Один шаг автомата арма (вызывается каждый кадр, повторный вызов ничего не меняет).
function armStep(f, st, mem) {
  const { ch } = fcInput(f, st);
  const sw = boxArm(f, ch);
  if (!sw) {
    mem.armed = false;
    mem.armsw = false;
    if (ch) mem.notDisarmed = mem.runaway = false;
  }
  if (mem.armed) return [];
  const b = blockers(f, ch, mem);
  if (sw && b.length) mem.armsw = true;
  if (sw && !b.length && !mem.armsw) {
    mem.armed = true;
    mem.wasArmed = true;
    return [];
  }
  return mem.armsw ? [...b, "ARMSWITCH"] : b;
}
// stop — докуда доходит пакет команды: 1 — до приёмника (радио), 2 — до полётника, 4 — до моторов.
function analyze(f, st, mem) {
  const flags = armStep(f, st, mem);
  const { sent, ch } = fcInput(f, st);
  const sw = boxArm(f, ch);
  const R = { f, sent, flags, flag: flags.join(", ") || "—", sw, armed: mem.armed, where: null, hold: false, stop: 4, chip: {}, fcSees: ch, stopped: false };
  if (!ch) {
    const [stop, where, chip] = LINK[f.id];
    Object.assign(R, { stop, where, hint: "Полётник не получает данных с приёмника: ни стиков, ни тумблера ARM. Моторы стоят, дрон лежит на столе. Бипер пищит «нет связи»; в очках — LINK QUALITY." });
    R.chip[chip] = "lost"; // данные не доходят — не поломка самого звена, а обрыв передачи
    return R;
  }
  if (!mem.armed) {
    R.stop = 2;
    R.where = "fc";
    // Где причина каждого флага.
    // Запрет запуска («block») — полётник сам не пускает моторы; звено показывает, где причина запрета.
    for (const fl of ["NOT_DISARMED", "RUNAWAY", "NOPREARM", "MSP", "NO_ACC_CAL", "ARMSWITCH"]) if (flags.includes(fl)) R.chip.fc = "block";
    if (flags.includes("MOTOR_PROTO")) R.chip.dshot = "block";
    if (flags.includes("THROTTLE")) R.chip[f.id === "taer" ? "fc" : "stick"] = "block"; // TAER — карта каналов в настройках полётника
    if (f.id === "auxmix") R.chip.tx = "block";
    if (f.id === "armrange") R.chip.fc = "block";
    if (!sw) {
      R.hold = true;
      R.chip.fc = R.chip.fc || "hold";
    }
    const why = [];
    if (mem.runaway) why.push("RUNAWAY: полётник увидел, что PID упёрся в предел, а дрон всё равно вращается, — и сам выключил моторы (Runaway Takeoff Prevention). В этой модели защита срабатывает каждый раз; в жизни — только до первого устойчивого полёта, и дрон может удариться раньше. Чтобы снять флаг, выключи тумблер ARM.");
    if (flags.includes("THROTTLE")) why.push(f.id === "taer" ? `Газ для полётника — это канал крена: стик крена в центре, значит «газ» ${Math.round((ch.thr - 1000) / 10)} %, и арм запрещён. Дрон лежит, моторы молчат. Чинится во вкладке «Приёмник»: порядок каналов как на пульте (AETR).` : `Газ не внизу: полётник видит ${Math.round(ch.thr)} мкс, а арм разрешён только ниже ${MIN_CHECK}. Так Betaflight не даёт дрону рвануть со стола в момент арма. Опусти левый стик.`);
    if (flags.includes("ARMSWITCH") && f.id !== "armsw") why.push(flags.length > 1 ? "А ещё ARMSWITCH: тумблер включили, пока арм был запрещён. Когда уберёшь причину, перещёлкни тумблер — выключи и включи." : "Тумблер ARM включили, пока арм был запрещён. Причины уже нет — перещёлкни тумблер: выключи и включи.");
    if (flags.includes("MOTOR_PROTO")) why.push("Без протокола полётник не шлёт DShot: регуляторы сигнала не получают, моторы молчат.");
    R.hint = why.join(" ");
    return R;
  }
  // Motor Stop: пока газ ниже min_check, моторы стоят, и стики крена/тангажа их не будят.
  R.stopped = !!f.idle && ch.thr < MIN_CHECK;
  if (R.stopped) R.hint = "Подними газ выше 5 % — закрутятся.";
  if (f.id === "taer") R.hint = "Арм прошёл обходом: «газ» полётника (канал крена) был внизу. Стики делают не то: правый вбок — газ, левый газ — тангаж. Отпустишь крен — полётник получит 50 % газа и тангаж до упора.";
  return R;
}
// Видео: from — с какого участка идёт кадр (1 — камера не пропаяна, идёт только OSD с полётника), to — докуда.
// PIT Mode: VTX излучает доли милливатта — на столе картинка есть, но в сильном снегу; отойдёшь — пропадёт.
function videoOf(f) {
  if (f.id === "cam") return { from: 1, to: 4, osdOnly: true, chip: { cam: "bad", gog: "hold" } };
  if (f.id === "pit") return { from: 0, to: 4, weak: 0.75, chip: { vtx: "bad", air: "hold", gog: "hold" } };
  if (f.id === "rpsma") return { from: 0, to: 3, chip: { ant: "bad" } };
  return { from: 0, to: 4, chip: {} };
}

export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const D = L.D;
  const svgs = [...root.querySelectorAll("svg.iso-svg")];
  let items = [...root.querySelectorAll(".it")];
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const sticks = q("sticks"), mark = q("mark"), rings = q("rings"), armsw = q("armsw"), gview = q("gview");
  const flowG = q("flow");
  const droneGs = [...root.querySelectorAll('[data-part="drone"]')], dbody = q("dbody"), shadow = q("shadow"), arcsG = q("arcs"), tether = q("tether"), wires = q("wires");
  const numEls = [0, 1, 2, 3].map((i) => root.querySelector(`[data-num="${i}"]`));
  // Номера моторов нужны не всегда: когда моторы крутятся (рядом — их обороты), когда выбраны «Моторы и винты»
  // и при поломках самих моторов. В остальное время не загромождают дрон.
  const MOTOR_FAULTS = ["propdir", "motordir", "motororder", "motordead"];
  const numsG = q("nums");
  const pk = (id) => root.querySelector(`[data-pk="${id}"]`);
  const pkC = pk("cmd"), pkV = pk("vid"), pkM = [1, 2, 3, 4].map((n) => pk(`m${n}`)), pkW = [0, 1, 2].map((i) => pk(`pw${i}`));
  const at = (p) => k.iso(p, P);
  const P0 = camOf(P); // линейная часть основной камеры
  // Сколько CSS-пикселей в одной единице рисунка: нужно для CSS-преобразования слоёв дрона.
  const base = root.querySelector("svg.iso-svg");
  const measure = () => {
    const w = base ? base.clientWidth : 0;
    if (w && Math.abs(w / W - (sim.scale || 0)) > 1e-6) {
      sim.scale = w / W;
      poseKey = ""; // пересчитать положение при новом размере
    }
  };
  // Прошлый контроллер этого стенда (до смены неисправности) больше не нужен: снимаем его наблюдателей.
  if (root._pathCleanup) root._pathCleanup();
  const cleanups = [];
  root._pathCleanup = () => cleanups.splice(0).forEach((fn) => fn());
  if (typeof ResizeObserver === "function" && base) {
    const ro = new ResizeObserver(measure);
    ro.observe(base);
    cleanups.push(() => ro.disconnect());
  }
  // Группы винтов берём по номеру мотора: порядок в документе задан глубиной сцены, а не номером.
  const propEls = [0, 1, 2, 3].map((i) => root.querySelector(`[data-prop="${i}"]`));
  const pctEls = [0, 1, 2, 3].map((i) => root.querySelector(`[data-mpct="${i}"]`));
  const sim = { t: 0, angle: [0, 0.7, 1.4, 2.1], spin: [0, 0, 0, 0], view: { thr: state.throttle, roll: state.roll } };
  // Дрон стоит на столе в месте старта. Смена неисправности — новый опыт, дрон снова на столе.
  // qd — модель (метры, СИ), ph — то же для сцены (миллиметры, градусы).
  const qd = makeQuad(CM0.map((v) => v / 1000), { anchor: [DX / 1000, 0, 0.0024], tether: TETHER / 1000 });
  const ph = { pos: [...CM0], R: qd.R, roll: 0, pitch: 0, yaw: 0, rates: { r: 0, p: 0, y: 0 }, ground: true, side: "", taut: false, est: { roll: 0, pitch: 0 } };
  // «На столе» — касается стола или оторвался меньше чем на 5 мм (подскок): иначе на первом кадре
  // после сброса или при дрожании на столе писалось бы «в воздухе 0 см … снижается».
  const onTable = () => qd.contact || ph.pos[2] - ZCM < 5;
  const syncPh = () => {
    const a = anglesOf(qd.R);
    ph.pos = qd.pos.map((v) => v * 1000);
    ph.R = qd.R;
    Object.assign(ph, { roll: a.roll, pitch: a.pitch, yaw: a.yaw, rates: qd.rates || ph.rates, taut: qd.taut, est: qd.est });
    const upz = qd.R[2][2];
    ph.side = !qd.contact ? "" : upz < -0.5 ? "вверх ногами" : upz < 0.8 ? "на боку" : "";
    ph.ground = qd.contact && Math.hypot(...qd.vel) < 0.05;
  };
  // Состояние полётника. Смена неисправности — новый опыт: тумблер щёлкнули только что, при текущих стиках.
  // «armsw» — тумблер был включён ещё при подаче питания: появилась связь при включённом ARM —
  // NOT_DISARMED и ARMSWITCH висят, пока тумблер не выключат.
  const mem = { armed: false, armsw: state.fault === "armsw", notDisarmed: state.fault === "armsw" && !!state.armed, runaway: false, runawayEver: false };
  const FP = () => FPHYS[state.fault] || {};
  const batt = () => BATTERY[state.fault] || BATTERY.ok;
  sim.V = batt().rest;
  let lastSel = null;
  const fault = () => FAULTS.find((f) => f.id === state.fault) || FAULTS[0];
  const now = () => analyze(fault(), state, mem);
  const armswFixed = () => state.fault === "armsw" && !mem.armsw; // флаг с подачи питания уже снят
  // Щелчок тумблера ARM ловим сразу, а не со следующим кадром: «выключил-включил» не должно потеряться.
  if (typeof document !== "undefined") {
    const onArm = (e) => {
      if (!root.isConnected) return document.removeEventListener("change", onArm, true);
      if (e.target && e.target.dataset && e.target.dataset.ctl === "armed") {
        state.armed = !!e.target.checked;
        now();
      }
    };
    document.addEventListener("change", onArm, true);
    cleanups.push(() => document.removeEventListener("change", onArm, true));
  }

  // ── Ракурсы дрона ──
  // Повернуть дрон — то же, что повернуть камеру вокруг него. Рисунок для каждой камеры (азимут, высота)
  // делается один раз и кешируется; между соседними ракурсами — точная для плоскости рамы аффинная поправка.
  const bodies = new Map();
  const keyOf = (A, E, under = false) => `${under ? "U" : ""}${A}|${E}`;
  const discOf = (Pk, under = false) => D.props.map((m) => k.ring(m.x, m.y, PROP_R, under ? -(m.z + 0.5) : m.z + 0.5, Pk, 64));
  bodies.set(keyOf(P.azimuth, P.elevation), { A: P.azimuth, E: P.elevation, lite: false, svg: L.body0, Pk: camOf(P), disc: discOf(camOf(P)) });
  let shownKey = keyOf(P.azimuth, P.elevation);
  let cur = bodies.get(shownKey);
  const QA = 8, QE = 6; // шаг ракурсов по азимуту и высоте, градусы
  function camFor(Rm) {
    const c = k.cameraOf(P);
    const v = [c.cosA * c.cosE, c.sinA * c.cosE, c.sinE];
    const vp = [dot(Rm[0], v), dot(Rm[1], v), dot(Rm[2], v)];
    const E = Math.asin(clamp(vp[2], -1, 1)) / RAD, A = Math.atan2(vp[1], vp[0]) / RAD;
    const dA = ((((A - P.azimuth) % 360) + 540) % 360) - 180;
    const under = E < 0; // камера смотрит на дрон снизу
    const Ee = Math.abs(E);
    return { A: P.azimuth + Math.round(dA / QA) * QA, E: clamp(P.elevation + Math.round((Ee - P.elevation) / QE) * QE, 6, 84), under, rawA: A, rawE: Ee };
  }
  // Насколько ракурс b далёк от нужного (градусы); другой «верх/низ» — бесконечно далёк.
  const gap = (b, c) => (!!b.under !== c.under ? Infinity : Math.abs(((((b.A - c.rawA) % 360) + 540) % 360) - 180) * Math.cos(c.rawE * RAD) + Math.abs(b.E - c.rawE));
  function nearest(c) {
    let best = cur, bd = Infinity;
    for (const b of bodies.values()) {
      const d = gap(b, c);
      if (d < bd) [best, bd] = [b, d];
    }
    return [best, bd];
  }
  // Очередь рисования ракурсов в свободное время: сначала нужный сейчас, потом круг рыскания про запас.
  // В движении — облегчённый рисунок (~8 мс), когда дрон замер — полный.
  const schedule = typeof requestIdleCallback === "function" ? (fn) => requestIdleCallback(fn, { timeout: 100 }) : (fn) => setTimeout(fn, 16);
  const queue = [];
  let busy = false;
  const have = (key, lite) => {
    const e = bodies.get(key);
    return e && (lite || !e.lite);
  };
  // Нарисовать ракурс сразу (облегчённый — ~8 мс) или поставить в очередь.
  function make(j) {
    const Pk = camOf(P, j.A, j.E);
    bodies.set(j.key, { A: j.A, E: j.E, under: !!j.under, lite: j.under ? false : j.lite, svg: j.under ? droneUnder(Pk, state.fault) : droneScene(Pk, state.fault, j.lite).svg, Pk, disc: discOf(Pk, j.under) });
  }
  function want(A, E, lite, front = false, under = false) {
    const key = keyOf(A, E, under);
    if (have(key, lite) || queue.some((j) => j.key === key && j.lite === lite)) return;
    const job = { key, A, E, lite, under };
    if (front) queue.unshift(job);
    else queue.push(job);
    pump();
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    schedule(() => {
      busy = false;
      if (!root.isConnected) return;
      const t0 = Date.now();
      while (queue.length && Date.now() - t0 < 12) {
        const j = queue.shift();
        if (have(j.key, j.lite)) continue;
        make(j);
        if (j.key === shownKey || !bodies.has(shownKey)) poseKey = ""; // перерисовать с новым рисунком
        else if (j.lite) poseKey = "";
        if (!j.lite) break; // полный рисунок долгий — не больше одного за раз
      }
      if (bodies.size > 140) bodies.delete([...bodies.keys()][1]); // самый старый, кроме исходного ракурса
      pump();
    });
  }
  // Матрица SVG: рисунок камеры Pk → истинное положение (точно для плоскости рамы через центр масс).
  function matrixFor(Rm, Pk) {
    const cx = k.iso([1, 0, 0], Pk), cy = k.iso([0, 1, 0], Pk);
    const tx = k.iso(Rm[0], P0), ty = k.iso(Rm[1], P0);
    const det = cx[0] * cy[1] - cy[0] * cx[1];
    // C = [cx cy] (столбцы), C⁻¹ = [[cy1, −cy0], [−cx1, cx0]] / det; M = T · C⁻¹.
    const i11 = cy[1] / det, i12 = -cy[0] / det, i21 = -cx[1] / det, i22 = cx[0] / det;
    const m11 = tx[0] * i11 + ty[0] * i21, m12 = tx[0] * i12 + ty[0] * i22;
    const m21 = tx[1] * i11 + ty[1] * i21, m22 = tx[1] * i12 + ty[1] * i22;
    return [m11, m21, m12, m22]; // порядок SVG matrix(a b c d)
  }
  let poseKey = "";
  const Wp = (Rm, l) => add(ph.pos, rot(Rm, l)); // точка дрона → мир

  const show = (el, p) => {
    if (p) {
      el.setAttribute("cx", p[0].toFixed(1));
      el.setAttribute("cy", p[1].toFixed(1));
      el.style.opacity = 1;
    } else el.style.opacity = 0;
  };
  const markAt = (p, red = true) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7" class="iso-line" data-tone="${red ? "red" : "lit"}" style="stroke-width:1.4"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" class="${red ? "mk-dot" : "mk-dot mk-hold"}"/>`;
  function drawSticks(st) {
    // Стик на пульте догоняет ползунок плавно, как палец.
    for (const key of ["thr", "roll", "pitch", "yaw"]) {
      const want = key === "thr" ? st.throttle : st[key] || 0;
      sim.view[key] = (sim.view[key] ?? want) + (want - (sim.view[key] ?? want)) * 0.3;
    }
    const [g1, g2] = L.gim;
    let s = "";
    // Вперёд по стику — к антенне пульта (−y), вправо — +x.
    for (const [[gx, gy], [dx, dy]] of [[g1, [sim.view.yaw, (0.5 - sim.view.thr) * 1.6]], [g2, [sim.view.roll, -sim.view.pitch * 0.8]]]) {
      const tip = [gx + dx * 5, gy + dy * 5, 31];
      s += k.solidSvg(k.cylinder(gx, gy, 2.4, 17.9, 2, P, 18), { tone: "mid" });
      s += `<path class="iso-line" data-tone="hi" style="stroke-width:2.2" d="${k.segment([gx, gy, 19.5], tip, P)}"/>`;
      s += k.solidSvg(G.sphereOf(tip, 2.6, P, { steps: 24 }), { tone: "hi" });
    }
    if (sticks.innerHTML !== s) sticks.innerHTML = s;
  }
  const ringD = (c, r) => k.ring(c[0], c[1], r, c[2], P, 48);
  // Короткая подпись у места поломки (плашка с текстом).
  function tagAt(p, text, red, dy = 0) {
    const w = text.length * 4.45 + 10, y = p[1] - 18 + dy;
    const x = p[0] + 10 + w > W - 4 ? Math.max(4, p[0] - 10 - w) : p[0] + 10; // не вылезать за край сцены
    return `<g class="ftag${red ? " red" : ""}"><path class="ftag-leg" d="M${p[0].toFixed(1)} ${(p[1] - 6).toFixed(1)} L${(x + 6).toFixed(1)} ${(y + 12).toFixed(1)}"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="13" rx="3"/><text x="${(x + 5).toFixed(1)}" y="${(y + 9.3).toFixed(1)}">${text}</text></g>`;
  }
  // Что видит пилот: картинка с камеры (или снег, или чёрный экран) и надписи OSD.
  function drawGoggles(R, V) {
    const { w, h } = L.gscreen;
    const air = V.to >= 4; // сигнал доходит до очков
    const noise = !air;
    const thrFc = R.fcSees ? Math.round(clamp((R.fcSees.thr - 1000) / 1000, 0, 1) * 100) : null; // газ, который видит полётник
    // Предупреждения OSD — в том порядке, как их выбирает Betaflight (osd_warnings.c):
    // флаги запрета — только при включённом режиме ARM, по очереди раз в 0,5 с (ARMSWITCH — если он один);
    // затем LINK QUALITY (нет связи), LAND NOW / LOW BATTERY (3,3 / 3,5 В на банку), BATT < FULL (до первого арма).
    const cyc = Math.floor(sim.t * 2);
    const fl = R.flags.length > 1 ? R.flags.filter((x) => x !== "ARMSWITCH") : R.flags;
    const vcell = sim.V / 6;
    const warn = R.sw && !R.armed && fl.length ? fl[cyc % fl.length] : !R.fcSees ? "LINK QUALITY" : vcell < 3.3 ? "LAND NOW" : vcell < 3.5 ? "LOW BATTERY" : !mem.wasArmed && vcell < 4.1 ? "BATT < FULL" : R.armed && sim.t - (sim.armT || 0) < 1.5 ? "ARMED" : "";
    const red = warn && warn !== "ARMED";
    const blink = (warn === "LINK QUALITY" || warn === "LAND NOW" || warn === "LOW BATTERY") && Math.floor(sim.t * 3) % 2;
    const volts = sim.V.toFixed(1);
    const r1 = (x) => Math.round(x);
    const key = `${R.f.id}|${warn}|${blink}|${volts}|${R.armed}|${thrFc}|${noise || V.weak ? Math.floor(sim.t * 12) : 0}|${r1(ph.roll)}|${r1(ph.pitch)}|${r1(ph.yaw)}|${r1(ph.est.roll)}`;
    if (key === sim.gKey) return;
    // Картинка в очках при движении — до 15 кадров в секунду (как и снег), состояние — сразу.
    const gState = `${R.f.id}|${warn}|${blink}|${R.armed}|${thrFc}`;
    if (gState === sim.gState && sim.t - (sim.gT || 0) < 1 / 15) return;
    sim.gState = gState;
    sim.gT = sim.t;
    sim.gKey = key;
    let g = `<rect width="${w}" height="${h}" class="gv-bg"/>`;
    let seed = Math.floor(sim.t * 12) * 97 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const snow = (n, a) => {
      let o = "";
      for (let i = 0; i < n; i++) o += `<rect x="${(rnd() * w).toFixed(1)}" y="${(rnd() * h).toFixed(1)}" width="${(1 + rnd() * 3).toFixed(1)}" height="1.2" class="gv-snow" style="opacity:${(a * (0.3 + rnd() * 0.7)).toFixed(2)}"/>`;
      return o;
    };
    const pxDeg = h / 80; // ~80° по вертикали
    if (noise) {
      // Снег: передатчик в эфир почти не выходит, приёмник очков ловит только шум.
      g += snow(140, 0.85) + `<text x="${w / 2}" y="${h / 2 + 3}" class="gv-big" text-anchor="middle">нет сигнала</text>`;
    } else {
      if (!V.osdOnly) {
        // Картинка с камеры: горизонт ниже центра на угол наклона камеры (17°), поворачивается с истинным креном,
        // поднимается, когда нос опускается; рыскание сдвигает холм.
        const hy = h / 2 + (17 - ph.pitch) * pxDeg;
        const sx = ((((-ph.yaw * pxDeg) % (w * 2)) + w * 3) % (w * 2)) - w * 0.5;
        g += `<g${V.weak ? ` style="opacity:${(1 - V.weak * 0.6).toFixed(2)}"` : ""} transform="rotate(${(-ph.roll).toFixed(1)} ${w / 2} ${h / 2})"><rect x="${-w}" y="${hy.toFixed(1)}" width="${w * 3}" height="${h * 2}" class="gv-ground"/><path d="M${(sx - w * 0.3).toFixed(1)} ${hy.toFixed(1)} Q ${sx.toFixed(1)} ${(hy - h * 0.25).toFixed(1)} ${(sx + w * 0.3).toFixed(1)} ${hy.toFixed(1)} Z" class="gv-hill"/></g>`;
      } else g += `<text x="${w / 2}" y="${h / 2 + 14}" class="gv-dim" text-anchor="middle">нет картинки с камеры</text>`;
      // Слабый сигнал (PIT Mode): картинка есть, но в снегу — так бывает только совсем рядом с дроном.
      if (V.weak) g += snow(Math.round(110 * V.weak), 0.7) + `<text x="${w / 2}" y="${h / 2 + 14}" class="gv-big" text-anchor="middle">слабый сигнал</text>`;
      // OSD: искусственный горизонт — так наклон видит полётник (по гироскопу и акселерометру).
      if (R.fcSees) g += `<g transform="rotate(${(-ph.est.roll).toFixed(1)} ${w / 2} ${h / 2})"><path d="M${w / 2 - 22} ${(h / 2 - ph.est.pitch * pxDeg).toFixed(1)} h14 m16 0 h14" class="gv-ahi"/></g>`;
      g += `<text x="3" y="8" class="gv-osd${vcell < 3.5 ? " warn" : ""}">${volts}V</text>${R.armed ? "" : `<text x="${w - 3}" y="8" class="gv-osd" text-anchor="end">DISARMED</text>`}`;
      if (warn && !blink) g += `<text x="${w / 2}" y="${h * 0.72}" class="gv-osd${red ? " warn" : ""}" text-anchor="middle">${warn}</text>`;
      // Газ и качество связи полётник знает только от приёмника: нет данных по UART — нет и цифр.
      g += `<text x="3" y="${h - 3}" class="gv-osd">THR ${thrFc === null ? "--" : thrFc + "%"}</text><text x="${w - 3}" y="${h - 3}" class="gv-osd${R.fcSees ? "" : " warn"}" text-anchor="end">LQ ${R.fcSees ? 100 : 0}</text>`;
      g += `<path d="M${w / 2 - 4} ${h / 2} H${w / 2 + 4} M${w / 2} ${h / 2 - 3} V${h / 2 + 3}" class="gv-cross"/>`;
    }
    gview.innerHTML = g;
  }
  return {
    tick(dt, calm, st) {
      const numsOn = !!st.armed || st.select === "vmg" || MOTOR_FAULTS.includes(st.fault);
      if (numsG && sim.numsOn !== numsOn) {
        sim.numsOn = numsOn;
        numsG.style.display = numsOn ? "" : "none";
      }
      sim.t += dt;
      let R = now();
      const f = R.f;
      const V = videoOf(f);
      drawSticks(st);
      if (st.select) SEEN.add(st.select);
      // ── Полёт: модель дрона с полётником (время замедлено в 2,5 раза) ──
      // Батарея: под нагрузкой напряжение проседает (ток ∝ кубу оборотов, ~35 А на мотор на полном газе),
      // а тяга винтов — как квадрат напряжения.
      const amps = qd.c.reduce((a, c) => a + 35 * c * c * c, 0);
      sim.V += (batt().rest - batt().rint * amps - sim.V) * Math.min(1, dt * 6);
      const ev = stepQuad(qd, { armed: R.armed, stopped: R.stopped, ch: R.fcSees, fault: { ...FP(), volt: (sim.V / 25.2) ** 2 } }, dt * SLOW);
      // Страховка: если модель всё же разошлась (нечисловые значения), дрон возвращается на стол целым,
      // а не исчезает из сцены. sim.broken не даёт засчитать задание по испорченным числам.
      const fin = (a) => a.every(Number.isFinite);
      if (!(fin(qd.pos) && fin(qd.vel) && fin(qd.w) && fin(qd.c) && fin(qd.cmd) && qd.R.every(fin) && Number.isFinite(sim.V))) {
        Object.assign(qd, makeQuad(CM0.map((v) => v / 1000), { anchor: [DX / 1000, 0, 0.0024], tether: TETHER / 1000 }));
        sim.V = batt().rest;
        sim.broken = (sim.broken || 0) + 1;
      }
      if (ev === "runaway") {
        // Runaway Takeoff Prevention: полётник сам дизармил дрон.
        mem.armed = false;
        mem.runaway = mem.runawayEver = true;
        R = now();
      }
      syncPh();
      if (R.armed && !sim.wasArmed) sim.armT = sim.t;
      sim.wasArmed = R.armed;
      R.motors = qd.cmd;
      R.spinning = qd.cmd.some((m) => m > 0);
      const Rm = qd.R;
      const pk1 = (x) => x.toFixed(1);
      const pKey = `${pk1(ph.pos[0])}|${pk1(ph.pos[1])}|${pk1(ph.pos[2])}|${pk1(ph.roll)}|${pk1(ph.pitch)}|${pk1(ph.yaw)}`;
      if (pKey !== poseKey) {
        poseKey = pKey;
        // Ракурс: точный, если уже нарисован, иначе ближайший с поправкой (а нужный рисуем в фоне).
        const c = camFor(Rm);
        const key = keyOf(c.A, c.E, c.under);
        // В быстром движении держим текущий рисунок, пока поправка небольшая: меньше перерисовок.
        const rate = Math.max(Math.abs(ph.rates.y), Math.abs(ph.rates.r), Math.abs(ph.rates.p));
        let b = rate > 40 && gap(cur, c) < clamp(rate / 12, 10, 26) ? cur : bodies.get(key);
        if (!b) {
          const [nb, dist] = nearest(c);
          // Ближайшего похожего ракурса нет (или он далеко) — рисуем облегчённый сразу, иначе в фоне.
          if (!nb || dist > QA * 2.5) {
            make({ key, A: c.A, E: c.E, lite: true, under: c.under });
            b = bodies.get(key);
          } else {
            b = nb;
            want(c.A, c.E, true, true, c.under);
          }
        }
        // Начал рыскать — рисуем про запас весь круг ракурсов на этой высоте.
        if (Math.abs(ph.rates.y) > 20 && !c.under && !sim.ring?.has(c.E)) {
          sim.ring = sim.ring || new Set();
          sim.ring.add(c.E);
          const dir = Math.sign(ph.rates.y) < 0 ? 1 : -1; // рыскание вправо уменьшает азимут камеры
          for (let i = 1; i < 360 / QA; i++) want(c.A + dir * i * QA - (c.A + dir * i * QA > P.azimuth + 180 ? 360 : c.A + dir * i * QA < P.azimuth - 180 ? -360 : 0), c.E, true);
        }
        const bk = keyOf(b.A, b.E, b.under);
        sim.still = 0;
        if (bk !== shownKey || b !== cur) {
          shownKey = bk;
          cur = b;
          dbody.innerHTML = b.svg;
          items = [...root.querySelectorAll(".it")];
          lastSel = null; // подсветку выбранной детали — заново на новых элементах
        }
        const m = matrixFor(Rm, cur.Pk);
        const c0 = at(ph.pos);
        // Дрон и винты двигаются CSS-преобразованием своих слоёв: браузер сдвигает готовую картинку,
        // а не рисует её заново. Пока размер слоя неизвестен — обычным преобразованием SVG.
        const sc = sim.scale || 0;
        droneGs.forEach((g) => {
          const lay = g.ownerSVGElement;
          if (sc > 0) {
            g.removeAttribute("transform");
            lay.style.transform = `matrix(${m.map((x) => x.toFixed(4)).join(",")},${(c0[0] * sc).toFixed(2)},${(c0[1] * sc).toFixed(2)})`;
          } else {
            lay.style.transform = "";
            g.setAttribute("transform", `matrix(${m.map((x) => x.toFixed(4)).join(" ")} ${c0[0].toFixed(1)} ${c0[1].toFixed(1)})`);
          }
        });
        // Тень на столе: чем выше дрон, тем бледнее.
        const hgt = ph.pos[2] - ZCM;
        shadow.setAttribute("d", hgt > 1 ? k.ring(ph.pos[0], ph.pos[1], 56 + hgt * 0.15, 0.3, P, 40) : "");
        shadow.style.opacity = hgt > 1 ? clamp(0.22 - hgt * 0.0012, 0.05, 0.22).toFixed(2) : "0";
        // Шнур от якоря к низу батареи: провисает, пока не натянут.
        const a = L.anchor, b2 = Wp(Rm, D.attach);
        const span = Math.hypot(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]);
        const sag = ph.taut ? 0 : clamp((TETHER - span) * 0.6, 0, 40);
        const cord = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          cord.push(at([a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, Math.max(0.6, a[2] + (b2[2] - a[2]) * t - sag * 4 * t * (1 - t))]));
        }
        tether.setAttribute("d", hgt > 1 || span > 12 ? k.pathOf(cord) : "");
        tether.classList.toggle("taut", !!ph.taut);
        // Номера моторов едут вместе с дроном.
        numEls.forEach((el, i) => {
          const p = at(Wp(Rm, D.nums[i]));
          el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
        });
        // Радиодуги: пульт → приёмник, VTX → очки.
        sim.cmdArc = arc(L.txTip, Wp(Rm, D.rxAnt), 60);
        sim.vidArc = arc(Wp(Rm, D.vant), L.gog, 50);
        arcsG.firstChild.setAttribute("d", k.pathOf(sim.cmdArc.map(at)));
        arcsG.lastChild.setAttribute("d", k.pathOf(sim.vidArc.map(at)));
      }
      else {
        // Дрон замер на облегчённом рисунке — дорисовываем полный.
        sim.still = (sim.still || 0) + dt;
        if (sim.still > 0.4 && cur.lite) want(cur.A, cur.E, false, true);
      }
      // Пакет команды: радио → провод RX → FC → шлейф → четыре фазы. Дальше stop не идёт.
      const tc = (sim.t % 2.2) / 2.2;
      const legs = [["cmdArc", 0.32], ["rx", 0.2], ["ribbon", 0.14], ["phase", 0.34]];
      const lim = R.stop >= 4 ? 4 : R.stop; // 1 — только радио, 2 — радио и провод до FC
      let acc = 0, pos = null, mpos = null;
      for (let i = 0; i < legs.length; i++) {
        const [name, share] = legs[i];
        if (tc < acc + share) {
          const t = (tc - acc) / share;
          if (i < lim) {
            if (name === "phase") mpos = t;
            else if (name === "cmdArc") pos = at(along3(sim.cmdArc, t));
            else pos = at(Wp(Rm, along3(D[name], t)));
          }
          break;
        }
        acc += share;
      }
      if (calm) pos = mpos = null;
      show(pkC, pos);
      pkM.forEach((el, i) => show(el, mpos === null ? null : at(Wp(Rm, along3(D.phase[i + 1], mpos)))));
      // Кадр видео: камера → FC → VTX → пигтейл → радио → очки (или только OSD с полётника).
      const vph = ((sim.t + 1) % 2.4) / 2.4;
      const vlegs = [["cam", 0.22], ["vtx", 0.22], ["pig", 0.14], ["vidArc", 0.42]];
      let vacc = 0, vpos = null;
      for (let i = 0; i < vlegs.length; i++) {
        if (vph < vacc + vlegs[i][1]) {
          const t = (vph - vacc) / vlegs[i][1];
          if (i >= V.from && i < V.to) vpos = vlegs[i][0] === "vidArc" ? at(along3(sim.vidArc, t)) : at(Wp(Rm, along3(D[vlegs[i][0]], t)));
          break;
        }
        vacc += vlegs[i][1];
      }
      if (calm) vpos = null;
      show(pkV, vpos);
      pkV.classList.toggle("pk-osd", !!V.osdOnly);
      // Питание: батарея → ESC, ESC → FC, FC → VTX.
      pkW.forEach((el, i) => show(el, st.power && !calm ? at(Wp(Rm, along3(D.pw[i], (sim.t * 0.6 + i * 0.33) % 1))) : null));
      // Кольца радио: пульт излучает всегда; VTX в PIT — слабо, без антенны — почти ничего.
      const vidPower = f.id === "pit" ? 0.3 : f.id === "rpsma" ? 0.12 : 1;
      let rh = "";
      if (!calm) {
        const vc = Wp(Rm, D.vant);
        for (let i = 0; i < 3; i++) {
          const r1 = (sim.t * 0.6 + i / 3) % 1;
          rh += `<path class="iso-line" data-tone="mid" style="opacity:${(0.6 * (1 - r1)).toFixed(2)}" d="${ringD(L.txTip, 6 + r1 * 34)}"/>`;
          const r2 = (sim.t * 0.65 + i / 3) % 1;
          rh += `<path class="iso-line" data-tone="mid" style="opacity:${(0.6 * (1 - r2) * vidPower).toFixed(2)}" d="${ringD(vc, 6 + r2 * 34 * (vidPower < 1 ? 0.4 : 1))}"/>`;
        }
      }
      if (rings.innerHTML !== rh) rings.innerHTML = rh;
      // Метки и подписи прямо на сцене: красная — место поломки, светлая — «ждёт» (не поломка).
      // Арм есть, газ внизу, дрон на столе: винты крутятся на холостом ходу (dshot_idle_value), это норма.
      const idleOn = R.armed && !R.stopped && !mem.runaway && onTable() && !!R.fcSees && R.fcSees.thr < MIN_CHECK;
      const mk = `${idleOn}|${f.id}|${R.hold}|${R.flag}|${R.sw}|${R.armed}|${R.spinning}|${R.stopped}|${onTable()}|${mem.runaway}|${st.armed}|${f.id === "lowv" ? sim.V.toFixed(1) : ""}|${ph.pos.map(Math.round).join(",")}|${Math.round(ph.roll)}|${Math.round(ph.pitch)}|${Math.round(ph.yaw)}`;
      // Подписи у летящего дрона обновляем не чаще 12 раз в секунду: глазу хватает, а браузеру легче.
      sim.markT = (sim.markT || 0) + dt;
      const mState = `${idleOn}|${f.id}|${R.hold}|${R.flag}|${R.sw}|${R.armed}|${R.spinning}|${R.stopped}|${onTable()}|${mem.runaway}|${st.armed}`;
      if (sim.markKey !== mk && (sim.markT > 0.08 || mState !== sim.mState || dt === 0)) {
        sim.markKey = mk;
        sim.mState = mState;
        sim.markT = 0;
        const P2 = (l) => at(Wp(Rm, l));
        let html = "", wh = "";
        const line = (pts) => `<path class="fault-wire" d="${k.pathOf(pts.map(P2))}"/>`;
        if (f.id === "txrx") wh += line(D.swap[0]) + line(D.swap[1]);
        if (f.id === "proto") wh += line(D.ribbon);
        if (f.id === "cam") wh += line(D.cam.slice(-3));
        // USB к Configurator: кабель от полётника за край стола.
        if (f.id === "msp") {
          const u0 = P2(D.marks.usb), u1 = at([DX + 140, -PLATE.d / 2 + 6, 0]);
          wh += `<path class="usb-wire" d="M${u0[0].toFixed(1)} ${u0[1].toFixed(1)} Q ${((u0[0] + u1[0]) / 2).toFixed(1)} ${(Math.max(u0[1], u1[1]) + 30).toFixed(1)} ${u1[0].toFixed(1)} ${u1[1].toFixed(1)}"/>`;
        }
        if (wires.innerHTML !== wh) wires.innerHTML = wh;
        // Путь сигнала: докуда команда и видео дошли — цветом, дальше — серым пунктиром.
        if (sim.cmdArc) {
          const seg = (pts, cls) => `<path class="flow ${cls}" d="${k.pathOf(pts)}"/>`;
          let fh = "";
          [sim.cmdArc.map(at), D.rx.map(P2), D.ribbon.map(P2)].forEach((pts, i) => (fh += seg(pts, i < R.stop ? "flow-cmd" : "flow-off")));
          for (const n of [1, 2, 3, 4]) fh += seg(D.phase[n].map(P2), R.stop >= 4 ? "flow-cmd" : "flow-off");
          [D.cam.map(P2), D.vtx.map(P2), D.pig.map(P2), sim.vidArc.map(at)].forEach((pts, i) => (fh += seg(pts, i >= V.from && i < V.to ? (i === 3 && V.weak ? "flow-vid weak" : "flow-vid") : "flow-off")));
          flowG.innerHTML = fh;
        }
        const T = {
          modelmatch: ["rx", "Model Match: номер модели не совпал"],
          txrx: ["wire", "TX → TX: нужно крест-накрест"],
          uart: ["fc", "Serial RX на UART1, а приёмник на UART2"],
          taer: ["fc", "Betaflight ждёт TAER, пульт шлёт AETR"],
          acc: ["fc", "акселерометр не откалиброван, а Angle включён"],
          acctilt: ["fc", "акселерометр калибровали на наклоне 8°"],
          crsf: ["fc", "Serial RX ждёт SBUS, а приёмник говорит CRSF"],
          auxmix: ["arm", "AUX1 не в Mixes: тумблер не доходит до FC"],
          armrange: ["arm", "диапазон ARM 1300–1700: тумблер мимо"],
          prearm: ["arm", "NOPREARM: сначала взведи PREARM"],
          msp: ["fc", "MSP: подключён USB к Configurator"],
          propdir: ["m2", "винт не той стороны: тянет угол вниз"],
          motordir: ["m3", "мотор крутится задом наперёд"],
          motororder: ["m1", "команда «M1» уходит на мотор 2, «M2» — на 1"],
          orient: ["fc", "плата повёрнута на 90°, в настройках 0°"],
          motordead: ["m4", "мотор 4 не крутится"],
          lowv: ["bat", `батарея: ${sim.V.toFixed(1)} В под нагрузкой`],
          proto: ["esc", "протокол ESC не выбран — DShot молчит"],
          armsw: ["arm", "ARM был включён при подаче питания"],
          pit: ["vtx", "PIT Mode: VTX почти не излучает"],
          rpsma: ["ant", "SMA на RP-SMA: нет центрального контакта"],
          cam: ["cam", "провод камеры не пропаян"],
        }[f.id];
        const mp = (id) => L.marks[id] || P2(D.marks[id]);
        // Сама неисправность (настройка или пайка) видна всегда; «armsw» — пока флаг с подачи питания не снят.
        if (T && !armswFixed()) html += markAt(mp(T[0])) + tagAt(mp(T[0]), T[1] + (R.flag === "RXLOSS" ? " · бипер пищит" : ""), true);
        // Флаги, которые зависят от стиков и тумблера: Betaflight проверяет их в момент, когда тумблер включён.
        if (R.sw && R.flags.includes("THROTTLE")) {
          if (f.id === "taer") html += markAt(mp("rstick")) + tagAt(mp("rstick"), "для FC этот стик (крен) — газ: 50 % → THROTTLE", true, 16);
          else html += markAt(mp("thr")) + tagAt(mp("thr"), "THROTTLE: газ не внизу — опусти левый стик", true, 16);
        }
        // ARMSWITCH — следствие: красный, только когда других запретов уже нет.
        if (R.sw && R.flags.includes("ARMSWITCH") && f.id !== "armsw") {
          const only = R.flags.length === 1;
          html += markAt(mp("arm"), only) + tagAt(mp("arm"), only ? "ARMSWITCH: выключи и снова включи тумблер" : "+ ARMSWITCH: потом перещёлкни тумблер", only, -4);
        }
        // Runaway: полётник сам выключил моторы.
        if (mem.runaway) html += markAt(mp("fc")) + tagAt(mp("fc"), "RUNAWAY: полётник сам выключил моторы", true, 18);
        const swNotSeen = f.id === "auxmix" || f.id === "armrange";
        // «ARM выключен» на столе — обычное начальное состояние (его показывают плашки итога), на сцене не висит;
        // в воздухе — это авария, её отмечаем.
        if (R.hold && !(swNotSeen && st.armed) && !onTable()) html += markAt(mp("arm"), false) + tagAt(mp("arm"), "ARM выключен в воздухе — моторы встали, дрон падает", false, -4);
        else if (R.armed && R.stopped) html += tagAt(mp("mot"), "Motor Stop: моторы ждут газа · бипер пищит", false);
        else if (idleOn) html += tagAt(mp("mot"), `ARM включён, газ внизу — холостой ход ${(IDLE * 100).toFixed(1).replace(".", ",")} %`, false);
        if (mark.innerHTML !== html) mark.innerHTML = html;
      }
      // Тумблер ARM на пульте: вперёд — включён, на себя — выключен.
      const on = !!st.armed;
      if (sim.armDrawn !== on) {
        sim.armDrawn = on;
        const b0 = L.armsw.base, tip = [b0[0], b0[1] + (on ? -3.2 : 3.2), b0[2] + 5.4];
        armsw.innerHTML = `<path class="iso-line" data-tone="${on ? "lit" : "hi"}" style="stroke-width:2.4" d="${k.segment(b0, tip, P)}"/>` + k.solidSvg(G.sphereOf(tip, 1.5, P, { steps: 16 }), { tone: "hi", lit: on });
      }
      // Экран очков.
      drawGoggles(R, V);
      // Светодиод приёмника: ровный — связь есть; три вспышки — Model Match.
      const rxled = dbody.querySelector('[data-part="rxled"]');
      if (rxled) rxled.style.opacity = f.id === "modelmatch" ? (Math.floor(sim.t * 6) % 8 < 6 && Math.floor(sim.t * 6) % 2 === 0 ? 1 : 0.15) : 1;
      // Винты: скорость и направление каждого мотора — в той же камере, что и рисунок дрона.
      // Лопасти лежат в плоскости винта, поэтому их поворот — точная аффинная матрица: винт рисуется
      // один раз на ракурс, а каждый кадр меняется только матрица.
      const Bx = k.iso([1, 0, 0], cur.Pk), By = k.iso([0, 1, 0], cur.Pk);
      const det = Bx[0] * By[1] - By[0] * Bx[1];
      const fp = FP();
      qd.c.forEach((v, i) => {
        // Винт i — физический мотор i: его настоящие обороты (с задержкой разгона) и настоящее направление.
        sim.spin[i] += (v - sim.spin[i]) * (calm ? 1 : 1 - Math.exp(-dt / 0.12));
        if (v < 0.01 && sim.spin[i] < 0.03) sim.spin[i] = 0; // мотор выключен — винт останавливается, а не ползёт
        const m = D.props[i];
        const dirSign = QMOT[i].spin * (fp.spin ? fp.spin[i] : 1);
        // Видимая скорость: холостые — заметно крутятся, полный газ — быстро и с диском размытия.
        // Предел ~4 об/с: быстрее глаз и экран (60 кадров) показывают «обратное вращение» трёх лопастей.
        const w = sim.spin[i] > 0.005 ? 0.6 + 3.4 * sim.spin[i] : 0;
        if (!calm) sim.angle[i] += w * TAU * dt * dirSign;
        const el = propEls[i];
        el.dataset.a = sim.angle[i].toFixed(3); // текущий угол — для проверки направления и скорости
        const lit = st.select === "vmg" || sim.spin[i] > 0.6;
        const flip = !!(fp.flip && fp.flip[i]); // винт не той стороны — лопасти зеркальные
        const z = cur.under ? -(m.z + 1.1) : m.z;
        if (el._body !== cur || el._lit !== lit || el._flip !== flip) {
          el._body = cur;
          el._lit = lit;
          el._flip = flip;
          el.innerHTML = `<path class="prop-disc" d="${cur.disc[i]}" style="opacity:0"/><g>${propSvg(cur.Pk, m.x, m.y, z, PROP_R, 0, { blades: 3, lit, flip })}</g>`;
          el._disc = el.firstChild;
          el._blades = el.lastChild;
          el._op = "0";
        }
        const op = sim.spin[i] > 0.02 ? (0.05 + 0.4 * Math.pow(sim.spin[i], 1.4)).toFixed(2) : "0";
        if (op !== el._op) {
          el._op = op;
          el._disc.style.opacity = op;
        }
        // M = B · R(a) · B⁻¹ вокруг центра винта (B — как камера рисует оси x, y плоскости винта).
        const ca = Math.cos(sim.angle[i]), sa = Math.sin(sim.angle[i]);
        const r11 = Bx[0] * ca + By[0] * sa, r12 = -Bx[0] * sa + By[0] * ca, r21 = Bx[1] * ca + By[1] * sa, r22 = -Bx[1] * sa + By[1] * ca;
        const a11 = (r11 * By[1] - r12 * Bx[1]) / det, a12 = (-r11 * By[0] + r12 * Bx[0]) / det;
        const a21 = (r21 * By[1] - r22 * Bx[1]) / det, a22 = (-r21 * By[0] + r22 * Bx[0]) / det;
        const c = k.iso([m.x, m.y, z], cur.Pk);
        el._blades.setAttribute("transform", `matrix(${a11.toFixed(4)} ${a21.toFixed(4)} ${a12.toFixed(4)} ${a22.toFixed(4)} ${(c[0] - a11 * c[0] - a12 * c[1]).toFixed(2)} ${(c[1] - a21 * c[0] - a22 * c[1]).toFixed(2)})`);
        // Подпись у мотора — команда, которая пришла именно на этот мотор (при перепутанных проводах — чужая).
        const txt = qd.phys[i] > 0 ? `${Math.round(qd.phys[i] * 100)}%${fp.dead && fp.dead[i] ? " ✗" : ""}` : "";
        if (pctEls[i] && pctEls[i].textContent !== txt) pctEls[i].textContent = txt;
      });
      if (st.select !== lastSel) {
        lastSel = st.select;
        svgs.forEach((el) => (st.select ? el.setAttribute("data-focus", st.select) : el.removeAttribute("data-focus")));
        items.forEach((el) => (el.dataset.c === st.select ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
      }
      sim.R = R;
      return true;
    },
    facts() {
      const R = sim.R || now();
      return { stop: R.stop, flag: R.flag, armed: R.armed, runaway: mem.runawayEver, airborne: !qd.contact, height: ph.pos[2] - ZCM, roll: ph.roll, pitch: ph.pitch, yaw: ph.yaw, est: ph.est, motors: qd.cmd, volts: sim.V, seen: [...SEEN] };
    },
    readout() {
      const R = sim.R || now();
      const video = R.f.id === "cam" ? "в очках только OSD" : R.f.id === "pit" ? "видео слабое, в снегу" : R.f.video === undefined ? "видео есть" : "видео нет";
      const where = ph.side ? `лежит ${ph.side}` : onTable() ? "на столе" : `в воздухе ${Math.round((ph.pos[2] - ZCM) / 10)} см${ph.taut ? ", шнур натянут" : ""}`;
      const swNotSeen = (R.f.id === "auxmix" || R.f.id === "armrange") && state.armed;
      if (R.hold) return `${swNotSeen ? "тумблер включён, а режим ARM — нет" : "ARM выкл"}${R.flags.length ? ` (запреты: ${R.flag})` : ""} · ${where} · ${video}`;
      if (!R.armed) return `арм запрещён · ${R.flag} · ${where} · ${video}`;
      const mot = R.motors || [0, 0, 0, 0];
      const spin = R.spinning ? `моторы ${Math.round((mot.reduce((a, b) => a + b, 0) / 4) * 100)} %` : "моторы ждут газа";
      return `арм есть · ${spin} · ${where} · ${video}`;
    },
    metrics() {
      const R = sim.R || now();
      const tilt = Math.hypot(ph.roll, ph.pitch);
      return [
        ["Флаги Betaflight", R.armed ? "— (армлен)" : R.flag === "—" ? "— (ARM выкл)" : R.flag, ""],
        ["Дрон", ph.side ? `лежит ${ph.side}` : onTable() ? `на столе${tilt > 3 ? ` · наклон ${Math.round(tilt)}°` : ""}` : `высота ${Math.round((ph.pos[2] - ZCM) / 10)} см · наклон ${Math.round(tilt)}°`, ""],
        ["Батарея", `${sim.V.toFixed(1)} В · ${(sim.V / 6).toFixed(2)} В/банка`, ""],
        ["Дело из гл. 17", R.f.case || "—", ""],
        ["Канал", R.f.video !== undefined ? "видео (оранжевый)" : R.f.id === "ok" || R.f.id === "motorstop" ? "оба исправны" : "управление (синий)", ""],
      ];
    },
    // Под стендом: две цепочки (какое звено сломано), каналы на входе полётника и обороты моторов.
    note() {
      const R = sim.R || now();
      const f = R.f, V = videoOf(f), s = R.stop;
      const c = (key, reached) => R.chip[key] || (reached ? "ok" : "off");
      const cmd = [
        ["Стик", R.chip.stick || "ok"],
        ["TX пульта", R.chip.tx || "ok"],
        ["радио", "ok"],
        ["RX", c("rx", s >= 1)],
        ["UART · CRSF", c("uart", s >= 2)],
        ["FC", c("fc", s >= 2 && !R.chip.uart)],
        ["DShot", c("dshot", s >= 4)],
        ["ESC", c("esc", s >= 4)],
        ["моторы", s >= 4 && R.spinning ? "ok" : s >= 4 ? "hold" : "off"],
      ];
      const vc = (key, ok) => V.chip[key] || (ok ? "ok" : "off");
      const air = V.to >= 4;
      const vid = [
        ["Камера", vc("cam", true)],
        [V.osdOnly ? "FC · только OSD" : "FC · OSD", "ok"],
        ["VTX", vc("vtx", true)],
        ["антенна", vc("ant", true)],
        ["радио", V.chip.air || (air ? "ok" : "off")],
        [V.osdOnly ? "очки: только OSD" : "очки", vc("gog", air)],
      ];
      // Стрелка за звеном, на котором цепочка обрывается (поломка, данные не доходят, запуск запрещён), — красный ✕.
      const cut = (a, b) => ["bad", "lost", "block"].includes(a) && (b === "off" || b === "hold");
      const chain = (title, list) => `<span class="pth-chain"><b>${title}</b>${list.map(([t, st], i) => `<span class="pth-c" data-s="${st}">${t}</span>${i < list.length - 1 ? (cut(st, list[i + 1][1]) ? `<i class="pth-cut" title="Дальше цепочка не идёт">✕</i>` : "<i>→</i>") : ""}`).join("")}</span>`;
      const q5 = (x) => Math.round(x / 5) * 5;
      const bar = (label, val, frac, off) => `<span class="pth-bar${off ? " off" : ""}"><span>${label}</span><span class="pth-track"><span style="width:${Math.round(clamp(frac, 0, 1) * 100)}%"></span></span><b>${val}</b></span>`;
      const ch = R.fcSees;
      const chans = ch
        ? [["Крен", ch.roll], ["Тангаж", ch.pitch], ["Газ", ch.thr], ["Рыскание", ch.yaw], ["AUX1 · ARM", ch.aux]].map(([n, x]) => bar(n, q5(x), (x - 1000) / 1000, false)).join("")
        : ["Крен", "Тангаж", "Газ", "Рыскание", "AUX1 · ARM"].map((n) => bar(n, "—", 0, true)).join("");
      const mot = R.motors || [0, 0, 0, 0];
      const mots = mot.map((x, i) => bar(`M${i + 1}${i === 0 || i === 3 ? " ↻" : " ↺"}`, `${Math.round(x * 100)} %`, x, !R.spinning)).join("");
      const part = PARTS.find((p) => p.id === state.select);
      const swNotSeen = (f.id === "auxmix" || f.id === "armrange") && state.armed;
      let why = armswFixed() ? (R.armed ? "Флаги ARMSWITCH и NOT_DISARMED сняты: тумблер выключили и включили снова — арм прошёл." : R.hold ? "Флаги сняты: тумблер выключен. Включи его — с газом внизу арм пройдёт." : R.hint || "Флаги с подачи питания сняты.") : R.hold && !R.flags.length && !swNotSeen && !mem.runawayEver ? (onTable() ? "Тумблер ARM выключен: полётник получает команды, но запрещает моторам вращаться, даже если стик газа поднят, — регуляторам идёт только команда «стоп»." : "Тумблер ARM выключили в воздухе: полётник сразу останавливает моторы, и дрон падает на стол.") : f.id === "ok" ? R.hint || f.note : f.note + (R.hint ? ` ${R.hint}` : "");
      if (mem.runawayEver && !mem.runaway && !R.armed) why += " Флаг RUNAWAY снят. Дрон после кувырка — нажми «Сброс», чтобы поставить его на стол.";
      // Что сейчас делает дрон и почему — по физике.
      if (R.armed && R.spinning) {
        const thr = ch ? clamp((ch.thr - 1000) / 1000, 0, 1) : 0;
        const tilt = Math.hypot(ph.roll, ph.pitch);
        const hover = (Math.sqrt(1 / (TWR * (sim.V / 25.2) ** 2)) - IDLE) / (1 - IDLE); // висение с учётом просадки батареи
        if (ph.side) why += ` Дрон лежит ${ph.side}, а моторы крутятся — выключи тумблер ARM.`;
        else if (onTable()) why += thr < hover - 0.01 ? ` Газ ${Math.round(thr * 100)} % меньше висения (≈${Math.round(hover * 100)} %): тяга меньше веса, дрон стоит.` : "";
        else why += ` Дрон в воздухе: тяга ${thr > hover + 0.02 ? "больше веса — поднимается" : thr < hover - 0.02 ? "меньше веса — снижается" : "примерно равна весу — висит"}${tilt > 3 ? `; наклон ${Math.round(tilt)}° — часть тяги тянет вбок, дрон уходит в сторону` : ""}${ph.taut ? ", пока не держит шнур" : ""}.`;
      }
      const wp = wrongPick(f.id, state.select);
      const info = part ? `${wp ? `<b class="pth-wrong">Не здесь.</b> ${wp} ` : ""}<b>${part.name}.</b> ${part.text}` : why;
      // Условные обозначения звеньев: поломка, потеря данных и запрет запуска выглядят по-разному.
      const key = `<span class="pth-key"><span class="pth-c" data-s="bad">поломка</span><span class="pth-c" data-s="lost">данные не доходят</span><span class="pth-c" data-s="block">запуск запрещён</span><span class="pth-c" data-s="hold">ждёт</span><span class="pth-c" data-s="off">не дошло</span></span>`;
      return `<span class="pth">${chain("Управление:", cmd)}${chain("Видео:", vid)}${key}<span class="pth-grid"><span class="pth-box"><small>Полётник видит (вкладка «Приёмник»), мкс${ch ? "" : " — нет данных"}</small>${chans}</span><span class="pth-box"><small>Команды моторам от FC (номера Betaflight) — доля хода, а не обороты и не тяга · висение в этой модели ≈ ${Math.round(HOVER * 100)} % газа</small>${mots}</span></span><span class="pth-info">${info}</span></span>`;
    },
    pick(id, st, apply) {
      apply({ select: st.select === id ? "" : id });
    },
    // Точка подписи каждой детали (в координатах рисунка): у деталей дрона — там, где деталь сейчас.
    anchor(id) {
      const P2 = (l) => at(Wp(qd.R, l));
      if (id === "pult") return at([HS.x + HS.w / 2, HS.y + HS.d / 2, 16]);
      if (id === "goggles") return at([GOG.x + GOG.w / 2, GOG.y + GOG.d / 2, 22]);
      const loc = { rx: D.marks.rx, fc: D.marks.fc, esc: D.marks.esc, vmg: D.marks.m2, camera: D.marks.lens, vtx: D.marks.vtx, antenna: D.vant, battery: D.marks.bat }[id];
      return loc ? P2(loc) : null;
    },
    // Нажатие прямо на сцене: тумблер ARM на пульте.
    tap(id, st, apply) {
      if (id === "arm") apply({ armed: !st.armed });
    },
  };
}
