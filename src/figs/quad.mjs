// Fig: состав FPV-дрона на сборочном столе. Рама, четыре ВМГ, стек FC + ESC, конденсатор,
// камера в клетке, VTX с антенной, приёмник с Т-антенной, батарея с ремнём. Разборка по узлам.
import { k, G, scene, basePlate, rulerStrip, labelPlate, pcb, motor, propSvg, plug, TAU, fmt, clamp } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -150, y: -130, w: 300, d: 260, r: 10 };
const STAND_Z = 14; // дрон стоит на подставке
export const FRAMES = {
  TRUEX: { name: "True-X", motors: [[78, 78], [78, -78], [-78, 78], [-78, -78]], body: { x: -52, y: -22, w: 104, d: 44 } },
  H: { name: "H", motors: [[92, 70], [92, -70], [-92, 70], [-92, -70]], body: { x: -98, y: -22, w: 196, d: 44 } },
  HYBRID: { name: "Гибридный X", motors: [[82, 80], [82, -80], [-82, 80], [-82, -80]], body: { x: -70, y: -22, w: 140, d: 44 } },
  DEADCAT: { name: "Dead Cat", motors: [[50, 116], [50, -116], [-84, 66], [-84, -66]], body: { x: -60, y: -22, w: 120, d: 44 } },
};
// Поле зрения камеры: прямоугольный кадр 4:3 без искажений, объектив наклонён вверх (как в модели: [1, 0, 0.3]).
const PROP_R = 62, LENS_TILT = Math.atan(0.3);
export const FOVS = [["90", "90°"], ["120", "120°"], ["150", "150°"]];
export function lensOf(F) {
  return [F.body.x + F.body.w + 2, 0, STAND_Z + 3.2 + 14.5];
}
// Номера винтов, которые попадают в кадр при горизонтальном угле обзора fov (градусы).
export function propsInView(frame, fov) {
  const F = FRAMES[frame], L = lensOf(F), z = STAND_Z + 3.2 + 16.2;
  const tH = Math.tan((Number(fov) * Math.PI) / 360), tV = tH * 0.75, c = Math.cos(LENS_TILT), sn = Math.sin(LENS_TILT);
  const out = [];
  F.motors.forEach(([mx, my], i) => {
    for (let j = 0; j < 72; j++) {
      const a = (j / 72) * TAU, dx = mx + Math.cos(a) * PROP_R - L[0], dy = my + Math.sin(a) * PROP_R - L[1], dz = z - L[2];
      const f = dx * c + dz * sn, u = -dx * sn + dz * c;
      if (f > 0 && Math.abs(dy) < tH * f && Math.abs(u) < tV * f) return out.push(i);
    }
  });
  return out;
}
export const COMPONENTS = [
  { id: "frame", name: "Рама", sub: "Скелет и крепления", text: "Нижняя пластина с лучами, стойки и верхняя пластина. Размер рамы — диагональ между осями моторов, в дюймах — типовой класс пропеллера; точный допустимый диаметр — по документации рамы. Карбон прочный и лёгкий, но проводит ток и экранирует радио.", ref: "гл. 3 · с. 14–18" },
  { id: "fc", name: "Полётный контроллер · FC", sub: "Датчики и вычисления", text: "Верхний этаж стека на резиновых демпферах: процессор, IMU (гироскоп + акселерометр), OSD, площадки UART. Принимает команды от RX, считает PID и шлёт команды на ESC по DShot.", ref: "гл. 1, 4 · с. 8–10, 19–21" },
  { id: "esc", name: "ESC 4-в-1", sub: "Силовой преобразователь", text: "Нижний этаж стека: превращает команды FC в трёхфазный ток для моторов. Главная цифра — допустимый длительный ток. Одиночные ESC с PDB удобнее на гекса- и октокоптерах.", ref: "гл. 5 · с. 23–24" },
  { id: "cap", name: "Конденсатор", sub: "Подавление выбросов", text: "Low-ESR, около 1000 мкФ, на напряжение с запасом (6S → 35 В и выше). Паяют на силовые площадки ESC коротко, с соблюдением полярности: полоса — минус.", ref: "гл. 5 · с. 25" },
  { id: "vmg", name: "ВМГ: моторы и пропеллеры", sub: "Тяга", text: "Бесколлекторные моторы outrunner и пропеллеры. Диагонали вращаются навстречу друг другу, чтобы гасить реактивные моменты. Номера Betaflight: 1 — задний правый, 2 — передний правый, 3 — задний левый, 4 — передний левый.", ref: "гл. 2, 5 · с. 11–13, 22–23" },
  { id: "camera", name: "Камера", sub: "Изображение с борта", text: "Между боковыми пластинами клетки, наклонена вверх, чтобы на скорости смотреть на горизонт. Аналоговая (TVL, люксы) или цифровая; бывает ночная и тепловизор.", ref: "гл. 3, 12 · с. 16, 51" },
  { id: "vtx", name: "Видеопередатчик · VTX", sub: "Видео в эфир", text: "Передаёт картинку в очки. Без антенны может сгореть: мощность отражается и греет выходной каскад. Канал и мощность меняют с полётника по SmartAudio/Tramp.", ref: "гл. 9, 12 · с. 41, 51" },
  { id: "rx", name: "Приёмник · RX", sub: "Команды от пульта", text: "Ловит команды пульта и по проводу (UART, протокол CRSF) отдаёт их полётнику. Количество площадок, разъёмов и светодиодов зависит от модели. На показанном UART-приёмнике используются питание, земля, TX и RX.", ref: "гл. 10, 14 · с. 43–46, 56" },
  { id: "antenna", name: "Антенны", sub: "Связь с пространством", text: "Антенна видео (здесь — круговая «леденец») и Т-антенна приёмника, выведенные за карбоновую раму. Разъёмы SMA, RP-SMA, MMCX, U.FL; пигтейл — кабель-переходник.", ref: "гл. 3, 8, 9 · с. 17, 35–42" },
  { id: "battery", name: "Аккумулятор · АКБ", sub: "Запас энергии", text: "LiPo на верхней пластине под ремнём, силовой разъём XT60. 6S: 25,2 В полная, 22,2 В номинал. Балансир S + 1 провод.", ref: "гл. 6 · с. 26–30" },
];

export const meta = {
  id: "quad",
  title: "Состав FPV-дрона",
  hint: "Узел — клик · E — разобрать",
  explode: true,
  keys: [
    { mark: "lit", label: "Выбранный узел" },
    { mark: "raised", label: "Остальные узлы борта" },
    { mark: "dim", label: "Сборочный стол и подставка" },
    { mark: "blue", label: "Сектор перед камерой — её поле зрения" },
    { mark: "red", label: "Красное кольцо — винт попал в кадр" },
  ],
  caption: "Десять функциональных узлов по главе 3: рама, FC, ESC (с распределением питания), конденсатор, ВМГ, камера, VTX, RX, антенны, АКБ. Стек = FC + ESC «этажами». Геометрия типовая, это не чертёж конкретной рамы. Сектор перед камерой — её поле зрения на высоте винтов при выбранном угле обзора; красное кольцо — винт попадает в кадр. Модель упрощена: кадр 4:3 без искажений, наклон камеры 17°. Реальные FPV-объективы с «рыбьим глазом» видят шире, и результат зависит от камеры, её наклона и посадки в раме.",
  aria: "Клавиша E разбирает и собирает борт, узел выбирается кликом или в списке «Узел», пробел — пауза.",
  try: ["Разбери борт (E) и найди оба этажа стека.", "Сравни True-X и Dead Cat: попадают ли передние винты в сектор обзора камеры? А при обзоре 150°?", "Выбери «Антенны»: почему их выводят за раму?"],
  missions: [
    { id: "apart", look: ["fc","esc"], touch: ["apart"], see: "этажи стека: ESC снизу, FC сверху",  text: "Разбери дрон на этажи (кнопка «Разобрать»)", check: (f, s) => s.apart },
    {
      id: "esc", touch: ["select"], see: "описание под схемой — что делает выбранная деталь",  text: "Найди регулятор ESC — «мышцы» дрона (нажми на него)", check: (f, s) => s.select === "esc",
      confirm: { head: "Нашёл. Теперь проверь себя:", q: "Какой узел вычисляет команды для моторов, а какой пропускает через себя силовой ток к ним?", options: ["FC вычисляет команды, ESC коммутирует силовой ток", "ESC вычисляет команды, FC пропускает силовой ток", "Оба делают одно и то же, просто стоят этажами"], right: 0, miss: "Вспомни цепочку из главы 1: FC считает PID и шлёт команду по DShot, а ESC по этой команде переключает ток батареи на обмотки мотора." },
    },
    { id: "ant", touch: ["select"], see: "что выведено за пределы рамы",  text: "Найди антенны: на этой схеме видно, что они выведены за раму", check: (f, s) => s.select === "antenna" },
    { id: "cat", look: ["fov","props"], touch: ["frame","fov=120"], see: "голубой сектор перед камерой и красные кольца на винтах",  text: "Камера с обзором 120°: выбери раму, у которой передние винты не попадают в кадр (смотри на сектор перед камерой)", check: (f, s) => Number(s.fov) === 120 && !propsInView(s.frame, s.fov).length },
    { id: "wide", look: ["fov","props"], touch: ["frame=DEADCAT","fov=150"], see: "красные кольца на передних винтах",  adv: true, text: "Поставь на Dead Cat обзор 150°: винты появятся в кадре — форма рамы не гарантия, решает ещё камера", check: (f, s) => s.frame === "DEADCAT" && Number(s.fov) === 150 && propsInView(s.frame, s.fov).length > 0 },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [0, 0, STAND_Z + 150], [-72, 0, STAND_Z + 120], [110, 110, STAND_Z + 70], [-110, -110, STAND_Z + 70]], W, H, { pad: 18, azimuth: 40, elevation: 32 });
}

// Сборочные узлы и их векторы разборки (мир, z вверх, нос дрона — +x).
export const MOVES = {
  battery: [0, 0, 92],
  top: [0, 0, 64],
  fc: [0, 0, 40],
  esc: [0, 0, 18],
  cap: [0, -30, 10],
  camera: [48, 0, 10],
  vtx: [-44, 0, 26],
  rx: [-26, 38, 16],
  props: [0, 0, 44],
  motors: [0, 0, 18],
  frame: [0, 0, 0],
};
const STAGGER = ["battery", "top", "props", "vtx", "fc", "camera", "rx", "cap", "esc", "motors", "frame"];

export function render(state) {
  const P = projection();
  const S = scene(P);
  const F = FRAMES[state.frame];
  const Z0 = STAND_Z;
  basePlate(S, PLATE);
  rulerStrip(S, { x: PLATE.x + 14, y: PLATE.y + PLATE.d - 15, w: 150, d: 7, r: 1 });
  labelPlate(S, { x: 70, y: PLATE.y + PLATE.d - 28, w: 46, d: 18, r: 1.5 }, F.name.toUpperCase());
  // Подставка под раму.
  S.group = "stand";
  for (const [x, y] of [[-34, -14], [34, -14], [-34, 14], [34, 14]]) {
    S.cyl(x, y, 6, 0, 2, { tone: "lo" }, { layer: 0.5 });
    S.cyl(x, y, 3.4, 2, Z0 - 2, { tone: "mid", crease: "none" }, { layer: 0.5 });
  }
  S.box({ x: -40, y: -20, w: 80, d: 40, r: 4 }, Z0 - 4, 2, { tone: "lo" }, { layer: 0.55, steps: 4 });

  // ── Рама: нижняя пластина, лучи, стойки ──
  S.group = "frame"; S.comp = "frame";
  const B = F.body;
  const zb = Z0, tb = 3.2;
  const body = { ...B, r: 6 };
  S.box(body, zb, tb, { tone: "mid" }, { bevel: 0.6, ref: [0, 0, zb + 1] });
  S.line(k.planOutline({ x: B.x + 10, y: -6, w: Math.max(10, B.w * 0.3), d: 12, r: 5 }, zb + tb, P, 5) + k.planOutline({ x: B.x + B.w - 10 - Math.max(10, B.w * 0.18), y: -6, w: Math.max(10, B.w * 0.18), d: 12, r: 5 }, zb + tb, P, 5), { tone: "faint" }, [0, 0, zb + tb + 0.1]);
  const arms = [];
  F.motors.forEach(([mx, my], i) => {
    const ax = clamp(mx, B.x + 12, B.x + B.w - 12), ay = clamp(my, B.y + 8, B.y + B.d - 8);
    const dx = mx - ax, dy = my - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const wRoot = 9, wTip = 7.5;
    const ring = [
      [ax + nx * wRoot - ux * 6, ay + ny * wRoot - uy * 6],
      [mx - ux * 12 + nx * wTip, my - uy * 12 + ny * wTip],
      [mx + nx * 14, my + ny * 14],
      [mx + ux * 15, my + uy * 15],
      [mx - nx * 14, my - ny * 14],
      [mx - ux * 12 - nx * wTip, my - uy * 12 - ny * wTip],
      [ax - nx * wRoot - ux * 6, ay - ny * wRoot - uy * 6],
    ];
    S.solid(k.extrude(ring, zb - 0.6, tb + 0.6, P, { convex: false, bevel: 0.4 }), { tone: "mid" }, [(ax + mx) / 2, (ay + my) / 2, zb], { bias: -1 });
    S.line(k.planOutline({ x: (ax + mx) / 2 - 4, y: (ay + my) / 2 - 4, w: 8, d: 8, r: 4 }, zb + tb, P, 6), { tone: "faint" }, [(ax + mx) / 2, (ay + my) / 2, zb + tb + 0.1], { bias: -0.9 });
    S.dots([[mx + nx * 8, my + ny * 8, zb + tb], [mx - nx * 8, my - ny * 8, zb + tb], [mx - ux * 8, my - uy * 8, zb + tb], [mx + ux * 8, my + uy * 8, zb + tb]], { size: 0.45 }, [mx, my, zb + tb + 0.2]);
    arms.push([mx, my]);
  });
  // Стойки рамы под верхнюю пластину и клетка камеры.
  const ztop = zb + tb + 27;
  const posts = [[B.x + 12, -16], [B.x + 12, 16], [B.x + B.w - 26, -16], [B.x + B.w - 26, 16]];
  for (const [x, y] of posts) S.cyl(x, y, 2.4, zb + tb, ztop - zb - tb, { tone: "mid", crease: "none" }, { ref: [x, y, zb + 14] });
  const camX = B.x + B.w - 10;
  for (const y of [-13, 10]) S.box({ x: camX - 16, y, w: 20, d: 3, r: 1 }, zb + tb, 27, { tone: "mid" }, { bevel: 0.3, steps: 2, ref: [camX - 6, y + 1.5, zb + 16], bias: y > 0 ? 4 : -4 });

  // ── ВМГ ──
  const props = [];
  arms.forEach(([mx, my], i) => {
    S.group = "motors"; S.comp = "vmg";
    const mt = motor(S, mx, my, zb + tb, { r: 13, h: 15 }).top;
    props.push([mx, my, mt + 1.2, i]);
  });
  // Фазные провода по лучам к ESC.
  S.group = "esc"; S.comp = "esc";
  const ez = zb + tb + 5, fz = zb + tb + 16;
  // Стек: стойки M3, ESC, демпферы, FC.
  const stack = { x: -18, y: -18, w: 36, d: 36, r: 3 };
  for (const [x, y] of k.corners(stack, 3)) S.cyl(x, y, 1.6, zb + tb, ez - zb - tb, { tone: "mid" }, { ref: [x, y, ez - 2] });
  const escTop = pcb(S, stack, ez, { chips: [0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => ({ x: stack.x + 8 + j * 10, y: stack.y + 7 + i * 7.5, w: 4.6, d: 4, h: 1 }))), opts: { ref: [0, 0, ez], group: "esc", comp: "esc" } });
  arms.forEach(([mx, my], i) => {
    const sx = Math.sign(mx) * 18, sy = Math.sign(my) * 12;
    S.tube([[sx, sy, escTop], [sx + Math.sign(mx) * 8, sy + Math.sign(my) * 4, zb + tb + 1.4], [mx - Math.sign(mx) * 22, my - Math.sign(my) * 22, zb + tb + 1.2], [mx - Math.sign(mx) * 10, my - Math.sign(my) * 10, zb + tb + 3]], 0.7, { tone: "mid", bendR: 4, maxLength: 16 });
  });
  // XT60-косичка с задней стороны.
  S.tube([[-18, 6, escTop], [-28, 6, zb + tb + 3], [B.x - 4, 8, zb + tb + 3], [B.x - 12, 8, zb + tb + 2]], 1.5, { tone: "hi", bendR: 4 });
  S.tube([[-18, -2, escTop], [-28, -2, zb + tb + 3], [B.x - 4, 0, zb + tb + 3], [B.x - 12, 0, zb + tb + 2]], 1.5, { tone: "mid", bendR: 4 });
  plug(S, B.x - 16, 4, zb + tb - 1, 7, 15, 7, { tone: "hi" });
  // Конденсатор на силовых площадках.
  S.group = "cap"; S.comp = "cap";
  const capF = G.frameOf([-22, -24, zb + tb + 4], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  S.solid(G.solidOf([[0, 4.2], [14, 4.2], [14.6, 3.6]], capF, P), { tone: "hi", inner: k.lineSvg(G.arcOf(capF, 3, 4.2, P), { tone: "lo" }) }, [-29, -24, zb + tb + 4]);
  S.tube([[-20, -24, zb + tb + 4], [-16, -20, escTop + 1], [-15, -16, escTop]], 0.4, { tone: "mid", bendR: 2 });
  // FC на демпферах.
  S.group = "fc"; S.comp = "fc";
  for (const [x, y] of k.corners(stack, 3)) {
    S.cyl(x, y, 1.4, escTop, fz - escTop - 2, { tone: "mid", crease: "none" }, { ref: [x, y, fz - 4] });
    S.cyl(x, y, 2.6, fz - 2.4, 2.4, { tone: "lo" }, { ref: [x, y, fz - 1] });
  }
  const fcTop = pcb(S, stack, fz, {
    chips: [
      { x: 0, y: 0, w: 9, d: 9, h: 1.2, legs: 6, dot: true },
      { x: 9, y: -9, w: 4, d: 4, h: 1 },
      { x: -9, y: 9, w: 6, d: 5, h: 1.1, legs: 3 },
      { x: 11, y: 11, w: 3, d: 2.2, h: 1.4, tone: "mid" },
    ],
    pads: [[-15, -8], [-15, -4], [-15, 0], [-15, 4]],
    opts: { ref: [0, 0, fz], group: "fc", comp: "fc" },
  });
  // Камера в клетке, объектив вперёд и чуть вверх.
  S.group = "camera"; S.comp = "camera";
  const cam = { x: camX - 15, y: -9.5, w: 19, d: 19, r: 2.4 };
  S.box(cam, zb + tb + 5, 19, { tone: "hi", crease: "lo" }, { bevel: 0.6, ref: [camX - 6, 0, zb + 18], bias: 1 });
  const lensF = G.frameOf([camX + 4, 0, zb + tb + 14.5], G.unit3([1, 0, 0.3]), [0, 1, 0], G.unit3([-0.3, 0, 1]));
  S.solid(G.solidOf([[0, 7.4], [2, 7.4], [2, 6.2], [7, 6.2], [7.6, 5.4], [8.4, 5.4]], lensF, P), { tone: "hi" }, [camX + 8, 0, zb + tb + 15], { bias: 2 });
  S.line(G.circleOf(lensF, 8.4, 3.8, P), { tone: "mid" }, [camX + 12, 0, zb + tb + 16], { bias: 2.2 });
  S.tube([[camX - 15, 0, zb + tb + 16], [camX - 22, 0, fcTop + 6], [12, -2, fcTop + 3], [10, -2, fcTop]], 0.5, { tone: "mid", bendR: 3 });
  // VTX сзади, под верхней пластиной, антенна-«леденец» назад-вверх.
  S.group = "vtx"; S.comp = "vtx";
  const vtx = { x: B.x + 4, y: -12, w: 26, d: 24, r: 2 };
  const vz = zb + tb + 8;
  for (const [x, y] of k.corners(vtx, 3)) S.cyl(x, y, 1.2, zb + tb, vz - zb - tb, { tone: "mid" }, { ref: [x, y, vz - 2] });
  const vtxTop = pcb(S, vtx, vz, { chips: [{ x: vtx.x + 7, y: vtx.y + 7, w: 6, d: 5, legs: 3, dot: true }], opts: { ref: [vtx.x + 13, 0, vz], group: "vtx", comp: "vtx" } });
  for (let i = 0; i < 4; i++) S.box({ x: vtx.x + 13 + i * 3, y: vtx.y + 4, w: 1.4, d: 16, r: 0.3 }, vtxTop, 3.4, { tone: "mid" }, { steps: 2, ref: [vtx.x + 14 + i * 3, 0, vtxTop + 2] });
  S.tube([[vtx.x + 2, 6, vtxTop + 0.6], [vtx.x - 6, 6, vtxTop + 3], [B.x - 6, 0, ztop - 4]], 0.6, { tone: "mid", bendR: 3 });
  S.group = "vtx"; S.comp = "antenna";
  const ant0 = [B.x - 6, 0, ztop - 4];
  S.cyl(ant0[0], ant0[1], 3, ant0[2] - 2, 5, { tone: "mid", inner: k.lineSvg(k.knurl(ant0[0], ant0[1], 3, ant0[2] - 2, ant0[2] + 3, 12, P), { tone: "lo" }) }, { ref: ant0 });
  const antTip = [ant0[0] - 20, 0, ant0[2] + 40];
  S.tube([[ant0[0], 0, ant0[2] + 3], antTip], 1.1, { tone: "hi", maxLength: 50 });
  S.solid(G.sphereOf([antTip[0] - 2, 0, antTip[2] + 5], 6.5, P), { tone: "hi" }, [antTip[0] - 2, 0, antTip[2] + 5]);
  // Приёмник на заднем левом луче, Т-антенна в трубках.
  S.group = "rx"; S.comp = "rx";
  const rxp = { x: B.x + 2, y: B.y + B.d - 2, w: 14, d: 11, r: 1 };
  S.box({ x: rxp.x - 1, y: rxp.y - 1, w: rxp.w + 2, d: rxp.d + 2, r: 1.5 }, zb + tb, 2, { tone: "lo" }, { steps: 2 });
  const rxTop = pcb(S, rxp, zb + tb + 2, { holes: false, chips: [{ x: rxp.x + 7, y: rxp.y + 5.5, w: 4.6, d: 4.6, legs: 3, dot: true }], opts: { ref: [rxp.x + 7, rxp.y + 5, zb + tb + 3], group: "rx", comp: "rx" } });
  S.tube([[rxp.x + rxp.w, rxp.y + 3, rxTop], [rxp.x + rxp.w + 8, rxp.y, rxTop + 2], [-15, 4, fcTop + 2], [-15, 4, fcTop]], 0.45, { tone: "hi", bendR: 3 });
  S.group = "rx"; S.comp = "antenna";
  const back = arms.filter(([x]) => x < 0);
  for (const [mx, my] of back) {
    const t0 = [rxp.x + 2, rxp.y + 2, rxTop];
    const t1 = [mx * 0.55, my * 0.55, zb + tb + 2];
    S.tube([t0, [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2, zb + tb + 3], t1], 0.5, { tone: "mid", bendR: 4 });
    const t2 = [mx * 0.55 - 6, my * 0.55 + Math.sign(my) * 22, zb + tb + 2.4];
    S.tube([t1, t2], 1.2, { tone: "hi", maxLength: 30 });
  }
  // Верхняя пластина.
  S.group = "top"; S.comp = "frame";
  const top = { x: B.x + 6, y: -21, w: B.w - 12 - 14, d: 42, r: 6 };
  S.box(top, ztop, 2.4, { tone: "mid" }, { bevel: 0.5, ref: [top.x + top.w / 2, 0, ztop + 1] });
  S.line(k.planOutline({ x: top.x + 8, y: -14, w: top.w - 16, d: 6, r: 3 }, ztop + 2.4, P, 4) + k.planOutline({ x: top.x + 8, y: 8, w: top.w - 16, d: 6, r: 3 }, ztop + 2.4, P, 4), { tone: "faint" }, [top.x + top.w / 2, 0, ztop + 2.5]);
  S.dots(posts.map(([x, y]) => [x, y, ztop + 2.4]), { size: 0.5 }, [0, 0, ztop + 2.6]);
  // Батарея с ремнём.
  S.group = "battery"; S.comp = "battery";
  const zbat = ztop + 2.4;
  const pack = { x: -38, y: -17, w: 76, d: 34, r: 4 };
  S.box(pack, zbat, 30, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(pack, zbat + 8, P, 6), { tone: "faint" }) }, { bevel: 0.8, ref: [0, 0, zbat + 15] });
  S.line(k.planOutline(k.insetPlan(pack, 6), zbat + 30, P, 4), { tone: "faint" }, [0, 0, zbat + 30.1]);
  for (const x of [-16, 8]) {
    S.box({ x, y: pack.y - 1.4, w: 9, d: pack.d + 2.8, r: 0.6 }, zbat + 30, 0.9, { tone: "lo" }, { steps: 2, ref: [x + 4.5, 0, zbat + 30.5] });
    S.box({ x, y: pack.y + pack.d, w: 9, d: 1.4, r: 0.4 }, zbat - 2.4, 33.3, { tone: "lo" }, { steps: 2, ref: [x + 4.5, pack.y + pack.d + 1, zbat + 15] });
  }
  S.tube([[pack.x + 2, 6, zbat + 6], [pack.x - 10, 6, zbat + 4], [B.x - 16, 8, zbat - 6], [B.x - 18, 4, zb + tb + 9]], 1.5, { tone: "hi", bendR: 6 });
  // Пропеллеры (перестраиваются).
  S.group = "props"; S.comp = "vmg";
  props.forEach(([x, y, z, i]) => S.raw([x, y, z + 20], `<g data-prop="${i}">${propSvg(P, x, y, z, 62, i * 0.7, { blades: 3 })}</g>`, { bias: 30 }));
  // Поле зрения камеры на высоте винтов и красные кольца у винтов, попавших в кадр.
  const fov = Number(state.fov) || 120, hit = propsInView(state.frame, fov);
  const L0 = lensOf(F), zf = STAND_Z + 3.2 + 16.2, half = Math.atan(Math.tan((fov * Math.PI) / 360) * Math.cos(LENS_TILT));
  const pt = (q) => k.iso(q, P).map((v) => v.toFixed(1)).join(" ");
  const fan = [[L0[0], 0, zf]];
  for (let j = 0; j <= 24; j++) {
    const a = -half + (2 * half * j) / 24;
    fan.push([L0[0] + Math.cos(a) * 130, Math.sin(a) * 130, zf]);
  }
  S.group = "fov"; S.comp = null;
  S.raw([L0[0] + 40, 0, zf], `<path class="cam-fov${hit.length ? " hit" : ""}" d="M${fan.map(pt).join("L")}Z"/>`, { bias: 25 });
  for (const i of hit) {
    const [mx, my] = F.motors[i], ring = [];
    for (let j = 0; j < 48; j++) ring.push([mx + Math.cos((j / 48) * TAU) * PROP_R, my + Math.sin((j / 48) * TAU) * PROP_R, zf]);
    S.raw([mx, my, zf + 20], `<path class="cam-hit" d="M${ring.map(pt).join("L")}Z"/>`, { bias: 31 });
  }
  S.group = null; S.comp = null;
  const svg = k.figureSvg({ width: W, height: H, label: `Квадрокоптер ${F.name} на сборочном столе: рама, четыре мотора с пропеллерами, стек полётного контроллера и регулятора, конденсатор, камера, видеопередатчик с антенной, приёмник и батарея.`, body: S.svg() });
  // Подписи привязаны к самим деталям: при разборке они едут вместе с ними.
  const SHORT = { frame: "Рама", fc: "Полётник FC", esc: "Регулятор ESC", cap: "Конденсатор", vmg: "Мотор и винт", camera: "Камера", vtx: "Видеопередатчик", rx: "Приёмник", antenna: "Антенны", battery: "Батарея" };
  // Рама и моторы занимают весь стол: их подписи ставим на луч и на один мотор, а не в центр.
  const [m0, , m2] = F.motors;
  const AT = { frame: k.iso([m2[0] * 0.55, m2[1] * 0.55, 6], P), vmg: k.iso([m0[0], m0[1], 18], P) };
  const labels = COMPONENTS.map((c) => ({ text: SHORT[c.id] || c.name, pick: c.id, at: AT[c.id], info: `${c.sub}. ${c.text}${c.id === "camera" ? " Голубой сектор перед ней — поле зрения; красное кольцо — винт попал в кадр." : ""}` }));
  return { svg, P, labels, live: { props, moves: MOVES }, parts: S.count() };
}

// fovOn — скрытое: сектор обзора включён сменой «Обзора камеры».
export const defaults = { frame: "TRUEX", fov: "120", apart: false, select: "", fovOn: false };
export const controls = [
  { id: "frame", label: "Геометрия рамы", type: "seg", options: Object.entries(FRAMES).map(([v, f]) => [v, f.name]), rebuild: true },
  { id: "fov", label: "Обзор камеры", type: "seg", options: FOVS, rebuild: true, sets: { fovOn: true } },
  { id: "select", label: "Узел", type: "select", options: [["", "— все —"], ...COMPONENTS.map((c) => [c.id, c.name])] },
  { id: "apart", label: "Разобрать (E)", type: "check" },
];
export const tour = [
  { at: 0, set: { apart: false, select: "" } },
  { at: 3, set: { apart: true } },
  { at: 4, set: { select: "fc" } },
  { at: 7, set: { select: "esc" } },
  { at: 10, set: { select: "antenna" } },
  { at: 13, set: { select: "", apart: false } },
];

export function controller(root, built, state) {
  const P = built.P;
  const L = built.live;
  const svg = root.querySelector("svg");
  const items = [...root.querySelectorAll(".it")];
  const V = G.viewOf(P);
  const groups = {};
  for (const name of Object.keys(MOVES)) groups[name] = { x: 0, v: 0, target: 0, at: 0 };
  groups.stand = { x: 0, v: 0, target: 0, at: 0 };
  const scr = {};
  for (const [name, mv] of Object.entries(MOVES)) {
    const a = k.iso([0, 0, 0], P), b = k.iso(mv, P);
    scr[name] = [b[0] - a[0], b[1] - a[1], G.dot3(mv, V)];
  }
  scr.stand = [0, 0, 0];
  const props = [...root.querySelectorAll("[data-prop]")];
  const sim = { clock: 0, angle: 0, apart: false, order: "" };
  let lastSel = null;
  function schedule(apart) {
    const list = apart ? STAGGER : [...STAGGER].reverse();
    let n = 0;
    for (const name of list) {
      const g = groups[name];
      const want = apart ? 1 : 0;
      if (g.target === want) continue;
      g.target = want;
      g.at = sim.clock + n * 0.04;
      n++;
    }
  }
  return {
    tick(dt, calm, st) {
      sim.clock += dt;
      if (st.apart !== sim.apart) {
        sim.apart = st.apart;
        schedule(st.apart);
      }
      let moving = false;
      for (const [name, g] of Object.entries(groups)) {
        const want = sim.clock >= g.at ? g.target : g.x > 0.5 ? 1 : 0;
        const goal = sim.clock >= g.at ? g.target : g.x;
        if (calm) {
          g.x = g.target;
          g.v = 0;
          continue;
        }
        for (let i = 0; i < 4; i++) {
          g.v += ((goal - g.x) * 64 - g.v * 14.2) * (dt / 4);
          g.x += g.v * (dt / 4);
        }
        if (Math.abs(goal - g.x) < 5e-4 && Math.abs(g.v) < 5e-4) {
          g.x = goal;
          g.v = 0;
        } else moving = true;
      }
      // Сдвиг и пересортировка.
      const keyed = items.map((el) => {
        const name = el.dataset.g;
        const g = groups[name] || { x: 0 };
        const [sx, sy, lift] = scr[name] || [0, 0, 0];
        const x = g.x;
        if (name === "fov") {
          // Сектор обзора и красные кольца — только про камеру: видны, когда выбрана камера, после смены
          // «Обзора камеры» (пока не выбрана другая деталь) или в задании про обзор; и только пока борт собран.
          const want = st.select === "camera" || (st.fovOn && !st.select) || el.hasAttribute("data-look") ? 1 : 0;
          sim.fovA = sim.fovA === undefined ? want : sim.fovA + (want - sim.fovA) * (calm ? 1 : Math.min(1, dt * 6));
          const a = sim.fovA * (1 - groups.props.x);
          el.style.opacity = a.toFixed(3);
          el.style.visibility = a < 0.02 ? "hidden" : "";
        }
        if (x) el.setAttribute("transform", `translate(${(sx * x).toFixed(2)} ${(sy * x).toFixed(2)})`);
        else el.removeAttribute("transform");
        return { el, key: Number(el.dataset.k) + lift * x };
      });
      keyed.sort((a, b) => a.key - b.key);
      const order = keyed.map((o) => items.indexOf(o.el)).join(",");
      if (order !== sim.order) {
        const frag = document.createDocumentFragment();
        keyed.forEach((o) => frag.appendChild(o.el));
        svg.appendChild(frag);
        sim.order = order;
      }
      // Выделение узла.
      if (st.select !== lastSel) {
        lastSel = st.select;
        if (st.select) svg.setAttribute("data-focus", st.select);
        else svg.removeAttribute("data-focus");
        items.forEach((el) => (el.dataset.c === st.select ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
      }
      // Пропеллеры медленно вращаются, пока борт собран.
      if (!calm) sim.angle += dt * (1 - groups.props.x) * 1.4;
      props.forEach((el) => {
        const [x, y, z, n] = L.props[Number(el.dataset.prop)];
        const dir = n === 0 || n === 3 ? 1 : -1;
        el.innerHTML = propSvg(P, x, y, z, 62, n * 0.7 + sim.angle * dir, { blades: 3, lit: st.select === "vmg" });
      });
      return true;
    },
    readout() {
      const c = COMPONENTS.find((x) => x.id === state.select);
      const phase = Object.values(groups).some((g) => Math.abs(g.x - g.target) > 0.01) ? (state.apart ? "разбираю" : "собираю") : state.apart ? "разобран" : "собран";
      return c ? `${c.name} · ${c.ref}` : `${FRAMES[state.frame].name} · ${phase} · 10 узлов`;
    },
    metrics() {
      const c = COMPONENTS.find((x) => x.id === state.select);
      const hit = propsInView(state.frame, state.fov);
      if (!c) return [["Узлов по главе 3", "10", ""], ["Стек", "FC сверху + ESC снизу", ""], [`Винты в кадре при ${Number(state.fov) || 120}°`, hit.length ? `да, ${hit.length} передних` : "нет", ""]];
      return [["Узел", c.name, ""], ["Назначение", c.sub, ""], ["В книге", c.ref, ""]];
    },
    note() {
      const c = COMPONENTS.find((x) => x.id === state.select);
      return c ? `<b>${c.name}.</b> ${c.text} <span class="muted">Ещё касание того же места — деталь под ней.</span>` : "Коснись детали, чтобы выбрать её. Детали лежат слоями: коснись того же места ещё раз — выберется та, что под ней. Касание пустого места снимает выбор. Разборка (E) показывает этажи стека.";
    },
    pick(id, st, apply) {
      apply({ select: st.select === id ? "" : id });
    },
  };
}
