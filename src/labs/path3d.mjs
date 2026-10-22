// Гл. 1, вкладка «3D: два моста». Схема рядом остаётся первой: там стики и полёт.
// Здесь только два радиомоста в воздухе. Размеры — схема в сантиметрах, не чертёж 5″.
// Синий поток — пакеты команд (пульт → приёмник). Оранжевый — картинка (VTX → очки).
// Дороги разведены по глубине, чтобы сверху были видны две линии, а не одна.
import { createViewer, Mesh, M4 } from "../gl3d.mjs";

export const meta = {
  id: "path3d",
  title: "Два радиомоста в 3D",
  missions: [
    { id: "air", text: "Нажми оба моста: синий — команды, оранжевый — картинка" },
    { id: "deaf", text: "Картинка есть, стики молчат. Включи «Нет управления» и нажми звено синего моста. Полётник не считается" },
    { id: "dark", text: "Стики живы, картинки нет. Включи «Нет картинки» и нажми звено оранжевого моста" },
  ],
};

const BLUE = [0.16, 0.46, 0.98];
const ORANGE = [0.98, 0.46, 0.08];
const BLUE_DEAD = [0.40, 0.44, 0.52];
const ORANGE_DEAD = [0.52, 0.40, 0.32];

// Концы мостов. Z разный и постоянный: сверху две параллельные линии.
// Стол короткий, синий мост высокий: на узком телефоне мосты занимают кадр, а не поля.
const CMD_A = [-15.2, 15.4, -5.6];
const CMD_B = [4.8, 8.0, -5.6];
const VID_A = [6.5, 6.8, 6.0];
const VID_B = [-9.8, 6.0, 6.0];
const BOUNDS = [
  [-18.5, 0.2, -8], [-18.5, 16, -5.6], [14.2, 0.2, -6], [14.2, 8.4, 8],
  CMD_A, CMD_B, VID_A, VID_B,
];
const VIEWS = { top: [0.02, 1.18], side: [0.02, 0.16], home: [0.72, 0.40] };
const CMD_PARTS = new Set(["radio", "txant", "rx", "rxant", "beam_cmd"]);
const VID_PARTS = new Set(["camera", "vtx", "vtxant", "goggles", "gant", "beam_vid"]);

const PARTS = {
  radio: { name: "Пульт (TX)", text: "Mode 2: левый стик — газ и рыскание, правый — тангаж и крен. Модуль сзади (ELRS или TBS) превращает положения стиков в короткие пакеты чисел, не в картинку. Обычно 900 МГц или 2,4 ГГц." },
  txant: { name: "Антенна пульта", text: "От её кончика начинается синий радиомост. Дальше пакеты летят по воздуху до Т-антенны приёмника." },
  beam_cmd: { name: "Радиомост управления", text: "Синие точки — пакеты команд. Им хватает малой скорости, и обычно этот мост бьёт дальше видео. Кончился воздух — дальше только провод: приёмник → UART (CRSF) → полётник." },
  rx: { name: "Приёмник RX", text: "Ловит пакеты пульта и по проводу UART пересказывает их полётнику на языке CRSF. TX приёмника → RX полётника, крест-накрест. Радио здесь уже кончилось." },
  rxant: { name: "Антенна приёмника", text: "Т-антенна: два тонких уса на конце кабеля, выведены за карбон. Это конец синего моста. Усы — разные половины диполя, их не скручивают вместе." },
  fc: { name: "Полётник FC", text: "Читает команды с приёмника по проводу, а не по радио. На видео только накладывает надписи OSD: сам эфир картинки — это VTX. Если картинка есть, а стики молчат, полётник не первая дверь." },
  camera: { name: "Камера", text: "Снимает картинку и по проводу отдаёт её полётнику. Это начало видеоцепи, но ещё не радио: до эфира остаются FC (OSD) и VTX." },
  vtx: { name: "Видеопередатчик VTX", text: "Отдаёт видео в эфир, обычно 5,8 ГГц, иногда 1,2. Канал и мощность меняет полётник по проводу. Включать VTX без антенны нельзя: мощность отражается и греет выходной каскад." },
  vtxant: { name: "Антенна видео", text: "«Леденец» сзади дрона. От него начинается оранжевый мост до антенны очков. Поляризация должна совпасть с очками." },
  beam_vid: { name: "Радиомост видео", text: "Оранжевые точки — картинка. Мост отдельный: свои частота и антенна. Пропал он — команды могут идти как ни в чём не бывало." },
  goggles: { name: "Очки (VRX)", text: "Видеоприёмник с экранами. Показывает то, что долетело с VTX на том же канале. Снег или чёрный экран — претензия к оранжевому мосту, не к стикам." },
  gant: { name: "Антенна очков", text: "Сюда приходит оранжевый мост. Конец видеоцепи у пилота." },
  battery: { name: "Батарея", text: "Питает борт целиком. Село питание — могут погаснуть оба канала сразу. На этой сцене батарея цела: кнопки гасят только один мост." },
  frame: { name: "Рама и моторы", text: "Карбон экранирует радио, поэтому антенны выведены наружу, в сторону пилота. Моторы — уже после полётника, по проводам DShot и фазам ESC, не по радио." },
  pad: { name: "Стол", text: "Пульт с очками и дрон стоят на столе. Между ними по воздуху идут два моста, не один провод." },
};

const CHIPS = ["radio", "txant", "beam_cmd", "rx", "rxant", "fc", "camera", "vtx", "vtxant", "beam_vid", "goggles", "gant", "battery", "frame"];
const SHORT = {
  radio: "Пульт", txant: "Антенна TX", beam_cmd: "Мост команд", rx: "Приёмник", rxant: "Антенна RX",
  fc: "Полётник", camera: "Камера", vtx: "VTX", vtxant: "Антенна VTX", beam_vid: "Мост видео",
  goggles: "Очки", gant: "Антенна очков", battery: "Батарея", frame: "Рама",
};

function cssColor(root, v, fb) {
  const d = document.createElement("i");
  d.style.cssText = `position:absolute;visibility:hidden;color:var(${v})`;
  root.appendChild(d);
  const m = getComputedStyle(d).color.match(/[\d.]+/g);
  d.remove();
  return m && m.length >= 3 ? m.slice(0, 3).map((x) => Number(x) / 255) : fb;
}

function sphere(r, seg = 12) {
  const n = 8, prof = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    const rr = Math.cos(a) * r;
    prof.push([rr < 1e-4 ? 0 : rr, Math.sin(a) * r]);
  }
  return new Mesh().lathe(prof, seg);
}

function ball(mesh, r, at, seg = 10) {
  const n = 8, prof = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    const rr = Math.cos(a) * r;
    prof.push([rr < 1e-4 ? 0 : rr, Math.sin(a) * r]);
  }
  mesh.lathe(prof, seg, M4.t(at[0], at[1], at[2]));
}

function arm(mesh, a, b, y, w, h) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  mesh.box(w, h, L, M4.chain(M4.t((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2), M4.ry(Math.atan2(dx, dz))));
}

function palette(dark) {
  return {
    carbon: dark ? [0.34, 0.37, 0.42] : [0.16, 0.18, 0.22],
    radio: dark ? [0.28, 0.30, 0.34] : [0.14, 0.15, 0.18],
    screen: [0.18, 0.42, 0.72],
    lens: [0.25, 0.70, 0.82],
    metal: [0.74, 0.77, 0.82],
    fc: [0.20, 0.42, 0.86],
    chip: dark ? [0.10, 0.12, 0.16] : [0.08, 0.09, 0.12],
    rx: [0.22, 0.58, 0.92],
    vtx: [0.82, 0.32, 0.12],
    cam: [0.10, 0.11, 0.13],
    glass: [0.55, 0.78, 0.90],
    batt: [0.74, 0.16, 0.18],
    motor: dark ? [0.42, 0.44, 0.48] : [0.28, 0.30, 0.34],
    prop: [0.50, 0.54, 0.60],
    pad: dark ? [0.20, 0.22, 0.26] : [0.82, 0.84, 0.86],
    stick: [0.86, 0.72, 0.28],
    wire: [0.42, 0.45, 0.50],
    gog: dark ? [0.22, 0.26, 0.32] : [0.10, 0.13, 0.18],
    gold: [0.86, 0.70, 0.28],
    bezel: dark ? [0.08, 0.09, 0.11] : [0.05, 0.06, 0.08],
  };
}

// Две лопасти. Хорда нарочно крупнее натуры: иначе на телефоне винт схлопывается в палочку.
// Форма условная, по ней не считают тягу. yaw ставит плоскость винта мимо соседних деталей.
function prop(mesh, x, y, z, yaw, spin) {
  const rows = 8;
  const quad = (pos, normals, idx, a, b, c, d) => {
    const u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1, s = pos.length / 3;
    for (const p of [a, b, c, d]) { pos.push(...p); normals.push(n[0] / len, n[1] / len, n[2] / len); }
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };
  for (let b = 0; b < 2; b++) {
    const rings = [];
    const place = M4.chain(M4.t(x, y, z), M4.ry(yaw + b * Math.PI));
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const radius = 0.22 + t * 1.62;
      const chord = 0.14 + 0.78 * Math.sin(Math.PI * t);
      const sweep = spin * 0.28 * t * t;
      const pitch = spin * (0.5 - 0.2 * t);
      rings.push([[-chord / 2, 0.07], [chord / 2, 0.07], [chord / 2, -0.07], [-chord / 2, -0.07]].map(([zz, h]) =>
        M4.apply(place, [radius, h * Math.cos(pitch) - zz * Math.sin(pitch), sweep + zz * Math.cos(pitch) + h * Math.sin(pitch)])));
    }
    const pos = [], normals = [], idx = [];
    for (let j = 0; j < rows; j++) for (let k = 0; k < 4; k++) quad(pos, normals, idx, rings[j][k], rings[j][(k + 1) % 4], rings[j + 1][(k + 1) % 4], rings[j + 1][k]);
    quad(pos, normals, idx, ...rings[0].slice().reverse());
    quad(pos, normals, idx, ...rings[rows]);
    mesh.push(pos, normals, idx, M4.id());
  }
}

function build(dark) {
  const C = palette(dark);
  const parts = [];
  const add = (id, mesh, color, center, extra) => {
    parts.push({ id, mesh, color, center, ...extra });
    return parts[parts.length - 1];
  };
  const radio = new Mesh();
  radio.box(5.4, 1.35, 3.4, M4.t(-15.3, 1.05, -5.4));
  radio.box(4.4, 0.2, 2.8, M4.t(-15.2, 1.78, -5.4));
  radio.box(1.15, 2.15, 1.2, M4.t(-15.45, 1.35, -7.25));
  radio.box(1.15, 2.15, 1.2, M4.t(-15.45, 1.35, -3.55));
  radio.box(1.4, 1.3, 2.2, M4.t(-18.05, 1.22, -5.4));
  add("radio", radio, C.radio, [-15.2, 1.5, -5.4]);
  const toggles = new Mesh();
  toggles.cyl(0.22, 0.16, 10, M4.t(-17.15, 1.95, -6.55));
  toggles.cyl(0.1, 0.7, 8, M4.chain(M4.t(-17.15, 2.3, -6.55), M4.rz(0.55)));
  toggles.cyl(0.22, 0.16, 10, M4.t(-17.15, 1.95, -4.25));
  toggles.cyl(0.1, 0.7, 8, M4.chain(M4.t(-17.15, 2.3, -4.25), M4.rz(-0.45)));
  add("radio", toggles, C.stick, [-15.2, 1.5, -5.4]);
  const cups = new Mesh();
  const wells = new Mesh();
  const sticks = new Mesh();
  for (const z of [-6.15, -4.65]) {
    cups.cyl(0.92, 0.2, 16, M4.t(-13.5, 1.95, z));
    wells.cyl(0.52, 0.1, 12, M4.t(-13.5, 2.05, z));
    sticks.cyl(0.14, 1.3, 8, M4.t(-13.5, 2.68, z));
    ball(sticks, 0.44, [-13.5, 3.4, z], 10);
  }
  add("radio", cups, C.bezel, [-15.2, 1.5, -5.4]);
  add("radio", wells, C.chip, [-15.2, 1.5, -5.4]);
  add("radio", sticks, C.stick, [-15.2, 1.5, -5.4]);
  add("radio", new Mesh().box(2.55, 0.14, 1.9, M4.t(-16.25, 1.96, -5.4)), C.bezel, [-15.2, 1.5, -5.4]);
  add("radio", new Mesh().box(2.15, 0.1, 1.5, M4.t(-16.25, 2.08, -5.4)), C.screen, [-15.2, 1.5, -5.4]);

  const tx = new Mesh();
  tx.cyl(0.32, 0.4, 10, M4.t(-15.2, 2.15, -5.4));
  tx.tube([-15.2, 2.35, -5.4], CMD_A, 0.14, 8);
  ball(tx, 0.32, CMD_A);
  add("txant", tx, C.metal, CMD_A);

  const gog = new Mesh();
  gog.box(2.8, 1.9, 5.4, M4.t(-13.6, 1.5, 5.8));
  gog.box(0.35, 0.32, 4.4, M4.t(-12.05, 2.5, 5.8));
  gog.tube([-15.15, 1.8, 5.8], [-13.6, 2.85, 5.8], 0.18, 8);
  gog.tube([-13.6, 2.85, 5.8], [-12.05, 1.8, 5.8], 0.18, 8);
  add("goggles", gog, C.gog, [-13.4, 1.7, 5.8]);
  const eyes = new Mesh();
  const lenses = new Mesh();
  for (const z of [4.55, 7.05]) {
    eyes.cyl(0.95, 0.8, 16, M4.chain(M4.t(-11.9, 1.52, z), M4.rz(-Math.PI / 2)));
    lenses.cyl(0.7, 0.1, 16, M4.chain(M4.t(-11.45, 1.52, z), M4.rz(-Math.PI / 2)));
  }
  add("goggles", eyes, C.bezel, [-13.4, 1.7, 5.8]);
  add("goggles", lenses, C.lens, [-13.4, 1.7, 5.8]);
  const gant = new Mesh();
  gant.cyl(0.24, 0.28, 8, M4.t(-12.05, 2.55, 5.8));
  gant.tube([-12.05, 2.7, 5.8], VID_B, 0.12, 8);
  ball(gant, 0.26, VID_B);
  add("gant", gant, C.metal, VID_B);

  const pad = new Mesh();
  pad.box(13, 0.12, 12, M4.t(-14, 0.06, 0.2));
  pad.box(16, 0.12, 13, M4.t(7.6, 0.06, 0));
  add("pad", pad, C.pad, [-14, 0.1, 0.2]);

  const frame = new Mesh();
  const cx = 7.6, cy = 2.05, cz = 0;
  frame.box(4.3, 0.38, 4.2, M4.t(cx, cy, cz));
  const motors = [[11.5, 3.7], [11.5, -3.7], [3.7, 3.7], [3.7, -3.7]];
  const mounts = new Mesh();
  const cans = new Mesh();
  for (const [x, z] of motors) {
    arm(frame, [cx, cz], [x, z], cy, 1.0, 0.28);
    mounts.cyl(1.05, 0.14, 14, M4.t(x, cy + 0.2, z));
    cans.lathe([[0.62, 0.02], [0.9, 0.16], [0.88, 0.58], [0.4, 0.82], [0.18, 0.96]], 16, M4.t(x, cy + 0.22, z));
    cans.cyl(0.2, 0.12, 8, M4.t(x, cy + 1.22, z));
  }
  add("frame", frame, C.carbon, [cx, cy, cz]);
  add("frame", mounts, C.chip, [cx, cy + 0.5, cz]);
  add("frame", cans, C.metal, [cx, cy + 0.5, cz]);
  const batt = new Mesh().box(4.2, 1.45, 2.15, M4.t(7.2, 1.0, cz));
  batt.box(0.16, 1.25, 0.42, M4.t(5.2, 1.05, 0.55));
  batt.box(0.16, 1.25, 0.42, M4.t(9.2, 1.05, 0.55));
  add("battery", batt, C.batt, [7.2, 1.05, cz]);
  add("battery", new Mesh().box(2.2, 1.1, 0.08, M4.t(7.2, 1.2, 1.02)), C.chip, [7.2, 1.05, cz]);
  add("battery", new Mesh().box(0.85, 0.55, 0.62, M4.t(4.7, 1.15, 0)), C.gold, [7.2, 1.05, cz]);
  const props = new Mesh();
  // У заднего мотора у приёмника винт вдоль Z: иначе лопасть входит в корпус RX.
  const propYaw = { "3.7,-3.7": 0.12 };
  motors.forEach(([x, z], i) => {
    prop(props, x, cy + 1.28, z, propYaw[`${x},${z}`] ?? (0.4 + i * 0.7), i % 2 ? 1 : -1);
  });
  add("frame", props, C.prop, [cx, cy + 1.2, cz]);

  const fc = new Mesh();
  fc.box(2.85, 0.18, 2.85, M4.t(cx, 2.46, cz));
  add("fc", fc, C.fc, [cx, 2.52, cz]);
  add("fc", new Mesh().box(0.7, 0.1, 0.7, M4.t(cx - 0.15, 2.6, 0.25)), C.chip, [cx, 2.52, cz]);
  const pins = new Mesh();
  for (let i = 0; i < 6; i++) pins.box(0.1, 0.08, 0.12, M4.t(cx - 1.2, 2.58, -0.75 + i * 0.28));
  pins.box(0.08, 0.05, 0.7, M4.t(cx + 0.75, 2.58, 0));
  pins.box(0.28, 0.05, 0.08, M4.t(cx + 1.05, 2.58, 0));
  add("fc", pins, C.gold, [cx, 2.52, cz]);

  // Приёмник сидит на заднем углу рамы. Т-антенна вынесена в воздух — это конец синего моста.
  const rxAt = [5.5, 2.72, -2.55];
  const rx = new Mesh().box(1.7, 0.55, 1.25, M4.t(rxAt[0], rxAt[1] - 0.1, rxAt[2]));
  rx.box(0.55, 0.12, 0.4, M4.t(rxAt[0], rxAt[1] + 0.22, rxAt[2] + 0.15));
  add("rx", rx, C.rx, rxAt);
  add("rx", new Mesh().tube([6.2, 2.65, -1.75], [7.35, 2.58, -0.5], 0.08, 6), C.wire, rxAt);
  const rxant = new Mesh();
  rxant.tube([rxAt[0], rxAt[1] + 0.25, rxAt[2]], CMD_B, 0.11, 8);
  rxant.tube([CMD_B[0], CMD_B[1], CMD_B[2] - 2.15], [CMD_B[0], CMD_B[1], CMD_B[2] + 2.15], 0.14, 8);
  ball(rxant, 0.28, [CMD_B[0], CMD_B[1], CMD_B[2] - 2.15]);
  ball(rxant, 0.28, [CMD_B[0], CMD_B[1], CMD_B[2] + 2.15]);
  add("rxant", rxant, C.metal, CMD_B);

  const vtxAt = [6.15, 2.82, 2.25];
  add("vtx", new Mesh().box(1.55, 0.55, 1.15, M4.t(...vtxAt)), C.vtx, vtxAt);
  const sink = new Mesh();
  for (let i = 0; i < 4; i++) sink.box(0.14, 0.42, 1.05, M4.t(vtxAt[0] - 0.42 + i * 0.28, vtxAt[1] + 0.46, vtxAt[2]));
  add("vtx", sink, C.metal, vtxAt);
  add("vtx", new Mesh().tube([7.45, 2.58, 0.65], [vtxAt[0] + 0.15, vtxAt[1], vtxAt[2] - 0.3], 0.08, 6), C.wire, vtxAt);
  const vtxant = new Mesh();
  vtxant.tube([vtxAt[0], vtxAt[1] + 0.35, vtxAt[2]], VID_A, 0.11, 8);
  vtxant.lathe([[0.06, -0.16], [1.05, -0.08], [1.25, 0], [1.05, 0.08], [0.06, 0.16]], 18, M4.chain(M4.t(...VID_A), M4.rx(0.95)));
  add("vtxant", vtxant, C.metal, VID_A);

  const camM = M4.chain(M4.t(12.7, 2.5, cz), M4.rz(0.22));
  const cam = new Mesh();
  cam.box(1.45, 1.15, 1.35, camM);
  cam.box(0.35, 0.35, 0.7, M4.chain(camM, M4.t(-0.7, -0.55, 0)));
  cam.cyl(0.42, 0.7, 14, M4.chain(camM, M4.t(0.85, 0, 0), M4.rz(-Math.PI / 2)));
  cam.cyl(0.62, 0.16, 16, M4.chain(camM, M4.t(1.2, 0, 0), M4.rz(-Math.PI / 2)));
  add("camera", cam, C.cam, [12.7, 2.55, cz]);
  add("camera", new Mesh().tube([12.05, 2.5, 0], [8.95, 2.55, 0], 0.08, 6), C.wire, [12.7, 2.55, cz]);
  add("camera", new Mesh().cyl(0.32, 0.08, 12, M4.chain(camM, M4.t(1.28, 0, 0), M4.rz(-Math.PI / 2))), C.glass, [12.7, 2.55, cz]);

  // Мелкая геометрия остаётся в существующих группах выбора деталей.
  // Размеры условные: модель объясняет устройство, не заменяет сборочный чертёж.
  const bolt = (mesh, x, y, z, r = 0.12) => {
    mesh.cyl(r, 0.1, 6, M4.t(x, y, z));
    mesh.box(r * 1.2, 0.015, r * 0.22, M4.t(x, y + 0.058, z));
  };
  const ring = (mesh, outer, inner, height, matrix) => mesh.lathe([
    [inner, -height / 2], [outer, -height / 2], [outer, height / 2],
    [inner, height / 2], [inner, -height / 2],
  ], 20, matrix);

  // Пульт: гнёзда карданов, насечки ручек, энкодеры, кнопки и рёбра рукоятей.
  const gimbals = new Mesh(), knobs = new Mesh();
  for (const z of [-6.15, -4.65]) {
    ring(gimbals, 0.92, 0.60, 0.12, M4.t(-13.5, 2.13, z));
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      bolt(gimbals, -13.5 + Math.cos(angle) * 0.74, 2.23, z + Math.sin(angle) * 0.74, 0.055);
    }
    for (let i = 0; i < 3; i++) ring(knobs, 0.45, 0.40, 0.035, M4.t(-13.5, 3.32 + i * 0.08, z));
  }
  add("radio", gimbals, C.bezel, [-15.2, 1.5, -5.4]);
  add("radio", knobs, C.metal, [-15.2, 1.5, -5.4]);
  const encoderTX = new Mesh(), trimTX = new Mesh();
  for (const z of [-6.75, -4.05]) {
    encoderTX.cyl(0.18, 0.16, 12, M4.t(-16.7, 1.96, z));
    trimTX.box(0.12, 0.035, 0.14, M4.t(-16.7, 2.055, z));
  }
  for (let i = 0; i < 3; i++) trimTX.box(0.15, 0.08, 0.25, M4.t(-17.65, 1.87, -5.8 + i * 0.4));
  add("radio", encoderTX, C.metal, [-15.2, 1.5, -5.4]);
  add("radio", trimTX, C.bezel, [-15.2, 1.5, -5.4]);
  const gripTX = new Mesh();
  for (const z of [-7.25, -3.55]) for (let i = 0; i < 5; i++) gripTX.box(0.07, 0.04, 0.8, M4.t(-15.9 + i * 0.22, 2.44, z));
  add("radio", gripTX, C.bezel, [-15.2, 1.5, -5.4]);

  // Очки: мягкие окуляры, переносица, колёсики фокуса, вентиляция и антенный разъём.
  const ocularRims = new Mesh(), gogglesDetails = new Mesh();
  for (const z of [4.55, 7.05]) {
    ring(ocularRims, 1.0, 0.72, 0.16, M4.chain(M4.t(-11.45, 1.52, z), M4.rz(-Math.PI / 2)));
    gogglesDetails.cyl(0.24, 0.14, 14, M4.t(-13.2, 2.52, z));
  }
  ocularRims.box(0.4, 0.3, 0.6, M4.t(-11.65, 1.1, 5.8));
  for (let i = 0; i < 6; i++) ocularRims.box(0.12, 0.045, 0.7, M4.t(-14.3 + i * 0.27, 2.47, 5.8));
  add("goggles", ocularRims, C.bezel, [-13.4, 1.7, 5.8]);
  add("goggles", gogglesDetails, C.metal, [-13.4, 1.7, 5.8]);
  add("gant", new Mesh().cyl(0.29, 0.22, 6, M4.t(-12.05, 2.75, 5.8)), C.gold, VID_B);

  // Рама: верхние боковины оставляют электронику открытой для касания.
  const rails = new Mesh(), fasteners = new Mesh();
  for (const z of [-1.68, 1.68]) {
    rails.box(4.0, 0.18, 0.28, M4.t(cx, 2.35, z));
    for (const x of [cx - 1.65, cx + 1.65]) {
      fasteners.cyl(0.12, 0.34, 10, M4.t(x, 2.2, z));
      bolt(fasteners, x, 2.48, z);
    }
  }
  add("frame", rails, C.carbon, [cx, cy, cz]);
  add("frame", fasteners, C.metal, [cx, cy, cz]);
  const motorVents = new Mesh(), motorHardware = new Mesh();
  for (const [x,z] of motors) {
    ring(motorHardware, 0.65, 0.35, 0.05, M4.t(x, cy + 0.85, z));
    bolt(motorHardware, x, cy + 1.46, z, 0.18);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      motorVents.box(0.13, 0.28, 0.05, M4.chain(M4.t(x + Math.sin(angle) * 0.90, cy + 0.60, z + Math.cos(angle) * 0.90), M4.ry(angle)));
    }
  }
  add("frame", motorVents, C.bezel, [cx, cy, cz]);
  add("frame", motorHardware, C.motor, [cx, cy + 0.5, cz]);

  // Полётник: стойки стека, разъём USB, отдельные компоненты и контактные площадки.
  const fcHardware = new Mesh(), fcComponents = new Mesh(), pads = new Mesh();
  for (const dx of [-1.1,1.1]) for (const dz of [-1.1,1.1]) {
    fcHardware.cyl(0.11, 0.3, 10, M4.t(cx+dx,2.35,dz));
    bolt(fcHardware,cx+dx,2.64,dz,0.10);
  }
  fcHardware.box(0.44,0.22,0.6,M4.t(cx+1.4,2.63,0));
  fcComponents.box(0.07,0.1,0.35,M4.t(cx+1.64,2.64,0));
  for (let i=0;i<5;i++) {
    pads.box(0.22,0.035,0.14,M4.t(cx-0.7+i*0.35,2.58,1.26));
    fcComponents.box(0.22,0.14,0.13,M4.t(cx-0.65+i*0.3,2.65,-0.85));
  }
  add("fc",fcHardware,C.metal,[cx,2.52,cz]);
  add("fc",fcComponents,C.chip,[cx,2.52,cz]);
  add("fc",pads,C.gold,[cx,2.52,cz]);
  const rxComponents=new Mesh().box(0.46,0.12,0.45,M4.t(5.18,3.04,-2.65));
  const rxPads=new Mesh();
  for(let i=0;i<4;i++) rxPads.box(0.12,0.045,0.16,M4.t(5.0+i*0.3,2.92,-3.08));
  add("rx",rxComponents,C.chip,rxAt); add("rx",rxPads,C.gold,rxAt);
  add("rxant",new Mesh().box(0.45,0.32,0.5,M4.t(4.8,7.82,-5.6)),C.bezel,CMD_B);
  // Три фазных провода к каждому мотору: видимая связь мотор–силовая часть.
  const phaseWires=new Mesh();
  for(const [x,z] of motors) for(let i=0;i<3;i++) {
    const offset=(i-1)*0.12;
    phaseWires.tube([cx+(x-cx)*0.27,2.27,z*0.27+offset],[x-(x-cx)*0.12,2.25,z-z*0.12+offset],0.035,6);
  }
  add("frame",phaseWires,C.wire,[cx,cy,cz]);
  // Ремни аккумулятора и силовой кабель к XT-разъёму.
  const straps=new Mesh();
  for(const x of [6.0,8.4]) {
    straps.box(0.28,0.06,2.25,M4.t(x,1.76,0));
    for(const z of [-1.1,1.1]) straps.box(0.28,1.42,0.055,M4.t(x,1.02,z));
  }
  add("battery",straps,C.bezel,[7.2,1.05,cz]);
  const power=new Mesh().tube([5.2,1.45,0.4],[4.5,1.5,0.4],0.07,8);
  power.tube([4.5,1.5,0.4],[4.65,1.15,0],0.07,8);
  add("battery",power,C.batt,[7.2,1.05,cz]);

  const cmdColor = BLUE.slice();
  const vidColor = ORANGE.slice();
  add("beam_cmd", new Mesh().tube(CMD_A, CMD_B, 0.28, 8), cmdColor, mid(CMD_A, CMD_B), { lane: "cmd" });
  add("beam_vid", new Mesh().tube(VID_A, VID_B, 0.28, 8), vidColor, mid(VID_A, VID_B), { lane: "vid" });
  const ballMesh = sphere(0.52, 12);
  for (let i = 0; i < 6; i++) {
    add("beam_cmd", ballMesh, cmdColor, [0, 0, 0], { packet: true, lane: "cmd", phase: i / 6, a: CMD_A, b: CMD_B, model: fly(i / 6, CMD_A, CMD_B) });
    add("beam_vid", ballMesh, vidColor, [0, 0, 0], { packet: true, lane: "vid", phase: i / 6, a: VID_A, b: VID_B, model: fly(i / 6 + 0.08, VID_A, VID_B) });
  }
  return { parts, cmdColor, vidColor };
}

function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

function fly(phase, a, b) {
  return () => {
    const t = ((clock + phase) % 1 + 1) % 1;
    const lift = Math.sin(t * Math.PI) * 0.35;
    return M4.t(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + lift, a[2] + (b[2] - a[2]) * t);
  };
}

let clock = 0;

const MODE_LEAD = {
  ok: "Оба моста живы. Синие точки бегут от пульта к дрону — это команды. Оранжевые бегут от VTX к очкам — это картинка. Погаси один мост и посмотри, какой поток встал.",
  cmd: "Синий мост замолчал: пакеты команд не летят, оранжевые идут. В очках картинка есть, дрон стики не слышит. Камера — не первая дверь: ищи в управлении. Полётник — развилка: видит ли он стики (нажми его — расскажет, как проверить).",
  vid: "Оранжевый мост замолчал: картинка не летит, синие пакеты идут. Команды до борта доходят. Ищи в видео: камера, VTX, антенна, очки.",
};

export function mount(root, ctx) {
  root.innerHTML = `<div class="d3-stage" data-lab="path3d"><canvas class="d3-canvas" tabindex="0" role="img" aria-label="Два радиомоста: синий — команды от пульта к приёмнику, оранжевый — картинка от видеопередатчика к очкам"></canvas>
    <svg class="d3-leaders" aria-hidden="true"><path/></svg>
    <span class="d3-marker" hidden style="pointer-events:none"></span>
    <span class="p3-lane" data-lane="cmd" hidden>Команды: пульт → дрон</span>
    <span class="p3-lane" data-lane="vid" hidden>Видео: дрон → очки</span>
    <p class="d3-hint">Крути пальцем · поломка — кнопки ниже</p></div>
    <div class="d3-bar" role="group" aria-label="Какой мост замолчал"><button type="button" class="lab-btn" data-sym="ok" aria-pressed="true">Оба моста</button><button type="button" class="lab-btn" data-sym="cmd" aria-pressed="false">Нет управления</button><button type="button" class="lab-btn" data-sym="vid" aria-pressed="false">Нет картинки</button></div>
    <p class="lab-read" style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center">
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#2f78f6;display:inline-block"></i> синий — управление</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#f27814;display:inline-block"></i> оранжевый — видео</span>
    </p>
    <div class="d3-bar p3-views" role="group" aria-label="Ракурс"><button type="button" class="lab-btn" data-view="top">Сверху</button><button type="button" class="lab-btn" data-view="side">Сбоку</button><button type="button" class="lab-btn" data-view="home" hidden>Как вначале</button></div>
    <div class="d3-parts" role="group" aria-label="Звенья мостов">${CHIPS.map((id) => `<button type="button" data-part="${id}" aria-pressed="false">${SHORT[id]}</button>`).join("")}</div>
    <p class="lab-read d3-info" aria-live="polite">${MODE_LEAD.ok}</p>`;
  const $ = (q) => root.querySelector(q);
  const canvas = $(".d3-canvas"), infoEl = $(".d3-info");
  const s = { sel: null, act: null, mode: "ok", seen: new Set(), cmdColor: null, vidColor: null, fitted: false, refit: false, accent: null, bg: [1, 1, 1] };
  // Телефон: до первого действия под холстом только три кнопки симптома (обсуждение 003, K1). Ракурсы «Сверху / Сбоку»
  // и список деталей — после первого симптома или касания детали; «Как вначале» — когда ракурс ушёл с домашнего.
  // На широком экране места хватает — всё видно сразу.
  const phone = !!(window.matchMedia && window.matchMedia("(max-width:700px)").matches);
  const partsEl = $(".d3-parts"), topBtns = [...root.querySelectorAll('[data-view="top"],[data-view="side"]')], homeBtn = $('[data-view="home"]');
  const reveal = () => { partsEl.hidden = false; topBtns.forEach((b) => (b.hidden = false)); };
  if (phone) { partsEl.hidden = true; topBtns.forEach((b) => (b.hidden = true)); } else reveal();
  const dead = (id) => (s.mode === "cmd" && CMD_PARTS.has(id)) || (s.mode === "vid" && VID_PARTS.has(id));
  const chain = () => (s.mode === "cmd" ? CMD_PARTS : s.mode === "vid" ? VID_PARTS : null);
  let camTo = null, last = 0;
  let viewer;
  try { viewer = createViewer(canvas, { onPick: (id) => select(id, "tap"), onView: () => checkView() }); }
  catch (e) { viewer = null; }
  const setPressed = () => {
    root.querySelectorAll("[data-sym]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sym === s.mode)));
    // K3: звенья вне цепочки симптома бледные, но нажимаются — по ним есть «почему не здесь».
    const ch = chain();
    root.querySelectorAll("[data-part]").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.part === s.sel)); b.toggleAttribute("data-off", !!ch && !ch.has(b.dataset.part)); });
    root.dataset.mode = s.mode;
    root.dataset.sel = s.sel || "";
  };
  function note(id) {
    if (s.mode === "cmd" && id === "fc") return " Сейчас молчит синий мост. Полётник команд по радио не ловит: они приходят проводом от приёмника. Картинка есть, а стики молчат — камера не первая дверь. На столе без пропеллеров открой в Betaflight вкладку «Приёмник»: не видит полётник движения стиков — ищи в пульте, приёмнике и проводе до FC; видит — дело в арме, ESC, моторах и их питании.";
    if (s.mode === "cmd" && VID_PARTS.has(id)) return " Это звено видео, а оно как раз живо: оранжевые точки идут. Ищи синий мост.";
    if (s.mode === "vid" && id === "fc") return " Полётник только подписывает картинку. Эфир видео — оранжевый мост, он сейчас молчит.";
    if (s.mode === "vid" && CMD_PARTS.has(id)) return " Это звено управления, а оно живо: синие точки идут. Ищи оранжевый мост.";
    if (id === "battery") return " Батарея здесь ни один мост сама не гасит: для этого есть кнопки над списком.";
    return "";
  }
  function checkMissions() {
    if (s.seen.has("beam_cmd") && s.seen.has("beam_vid")) ctx.done("air");
    // Звезда за выбор уже при этом симптоме. Касание с прошлого задания и сама кнопка режима не считаются.
    if (s.mode === "cmd" && CMD_PARTS.has(s.act)) ctx.done("deaf");
    if (s.mode === "vid" && VID_PARTS.has(s.act)) ctx.done("dark");
  }
  function paintInfo(how) {
    if (!s.sel) infoEl.textContent = how === "tap" ? "Мимо детали. Нажми мост, антенну или строку в списке." : MODE_LEAD[s.mode];
    else {
      const P = PARTS[s.sel];
      infoEl.innerHTML = `<b>${P.name}.</b> ${P.text}${note(s.sel)}`;
    }
  }
  function select(id, how) {
    s.sel = id && PARTS[id] ? id : null;
    if (s.sel && (how === "tap" || how === "chip")) reveal();
    if (viewer) viewer.look.sel = s.sel;
    if (s.sel) s.seen.add(s.sel);
    if (how === "tap" || how === "chip") s.act = s.sel;
    setPressed();
    paintInfo(how);
    checkMissions();
    if (viewer) viewer.invalidate();
  }
  function setMode(mode) {
    if (s.mode === mode) return;
    s.mode = mode;
    s.act = null;
    setPressed();
    paintInfo("mode");
    checkMissions();
    if (viewer) viewer.invalidate();
  }
  const onClick = (e) => {
    const sym = e.target.closest("[data-sym]");
    if (sym) { reveal(); return setMode(sym.dataset.sym); }
    const pb = e.target.closest("[data-part]");
    if (pb) return select(pb.dataset.part === s.sel ? null : pb.dataset.part, "chip");
    const vb = e.target.closest("[data-view]");
    if (vb && viewer) {
      camTo = VIEWS[vb.dataset.view];
      if (vb.dataset.view === "home") viewer.view.zoom = 1;
      s.refit = true;
      viewer.invalidate();
    }
  };
  root.addEventListener("click", onClick);
  if (!viewer) {
    reveal(); // без 3D список звеньев — единственный способ выбрать деталь
    root.dataset.webgl = "0";
    $(".d3-stage").innerHTML = `<p class="lab-read">Этот браузер не показывает 3D. Звенья те же: синий мост — команды, оранжевый — картинка. Выбери их в списке.</p>`;
    return { destroy() { root.removeEventListener("click", onClick); } };
  }
  root.dataset.webgl = "1";
  viewer.view.yaw = VIEWS.home[0];
  viewer.view.pitch = VIEWS.home[1];
  viewer.view.target = [-3.2, 6.2, 0.2];
  viewer.view.zoom = 1;
  viewer.look.dimOthers = 0.5;
  const theme = () => {
    const [r, g, b] = cssColor(root, "--anatomy-page", [1, 1, 1]);
    viewer.look.bg = [r, g, b];
    s.accent = cssColor(root, "--accent", [0.2, 0.5, 1]);
    s.bg = [r, g, b];
    viewer.look.hi = s.accent;
    const built = build(r * 0.3 + g * 0.59 + b * 0.11 < 0.5);
    // Цвета в build() общие по ссылке (один металл у пяти деталей): даём каждой детали свою копию и запоминаем исходный.
    for (const p of built.parts) if (!p.lane) { p.base = p.color.slice(); p.color = p.base.slice(); }
    s.cmdColor = built.cmdColor;
    s.vidColor = built.vidColor;
    viewer.setParts(built.parts);
  };
  theme();
  const mo = new MutationObserver(theme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (mq && mq.addEventListener) mq.addEventListener("change", theme);
  const paint = () => {
    const cmdOn = s.mode !== "cmd", vidOn = s.mode !== "vid";
    const c = cmdOn ? BLUE : BLUE_DEAD, v = vidOn ? ORANGE : ORANGE_DEAD;
    if (s.cmdColor) { s.cmdColor[0] = c[0]; s.cmdColor[1] = c[1]; s.cmdColor[2] = c[2]; }
    if (s.vidColor) { s.vidColor[0] = v[0]; s.vidColor[1] = v[1]; s.vidColor[2] = v[2]; }
    for (const p of viewer.parts) if (p.packet) p.hidden = p.lane === "cmd" ? !cmdOn : !vidOn;
    // K3: детали вне цепочки симптома приглушены к фону, не скрыты (скрытая деталь не ловит касание).
    const ch = chain();
    for (const p of viewer.parts) if (p.base) { const k = ch && !ch.has(p.id) ? 0.6 : 0; for (let i = 0; i < 3; i++) p.color[i] = p.base[i] + (s.bg[i] - p.base[i]) * k; }
    // K2: выбранная деталь замолчавшего моста подсвечивается его серым, а не акцентом — мост не «оживает».
    viewer.look.hi = s.sel && dead(s.sel) ? (s.mode === "cmd" ? BLUE_DEAD : ORANGE_DEAD) : s.accent;
  };
  viewer.onFrame = () => {
    const now = performance.now(), dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    clock += dt * 0.26;
    if (!s.fitted && canvas.clientWidth > 40) {
      viewer.view.radius = viewer.fitRadius(BOUNDS, 1.16);
      s.fitted = true;
    }
    if (camTo) {
      const v = viewer.view, k = 1 - Math.exp(-dt * 7);
      let dy = camTo[0] - v.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      v.yaw += dy * k;
      v.pitch += (camTo[1] - v.pitch) * k;
      if (Math.abs(dy) < 0.004 && Math.abs(camTo[1] - v.pitch) < 0.004) {
        v.yaw = camTo[0]; v.pitch = camTo[1]; camTo = null;
        if (s.refit) { viewer.view.radius = viewer.fitRadius(BOUNDS, 1.16); s.refit = false; }
      }
    }
    paint();
    const marker = $(".d3-marker"), leader = $(".d3-leaders path");
    const selected = s.sel && viewer.parts.find((p) => p.id === s.sel && !p.packet);
    marker.hidden = !selected;
    leader.setAttribute("d", "");
    if (selected) {
      const [x, y, visible] = viewer.project(selected.center);
      const rect = canvas.getBoundingClientRect();
      marker.hidden = !visible || x < 4 || x > rect.width - 4 || y < 4 || y > rect.height - 4;
      if (!marker.hidden) {
        const lx = Math.max(54, Math.min(rect.width - 54, x + (x > rect.width / 2 ? -78 : 78)));
        const ly = Math.max(28, Math.min(rect.height - 28, y - 22));
        marker.style.left = lx + "px";
        marker.style.top = ly + "px";
        marker.textContent = s.sel === "beam_cmd" && dead(s.sel) ? "Мост команд — встал" : s.sel === "beam_vid" && dead(s.sel) ? "Мост видео — встал" : (SHORT[s.sel] || PARTS[s.sel].name) + (dead(s.sel) ? " · мост встал" : "");
        leader.setAttribute("d", `M${x},${y}L${lx},${ly}`);
      }
    }
    // K4: подписи направлений у линий (на трети пути от начала моста), касание не ловят.
    const rect = canvas.getBoundingClientRect();
    for (const [lane, a, b] of [["cmd", CMD_A, CMD_B], ["vid", VID_A, VID_B]]) {
      const el = root.querySelector(`.p3-lane[data-lane="${lane}"]`);
      const [x, y, vis] = viewer.project([a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35 + 1.6, a[2] + (b[2] - a[2]) * 0.35]);
      el.hidden = !vis || x < 30 || x > rect.width - 30 || y < 12 || y > rect.height - 12;
      el.style.left = Math.max(70, Math.min(rect.width - 70, x)) + "px";
      el.style.top = y + "px";
      el.toggleAttribute("data-dead", s.mode === lane);
    }
    syncHome();
    root.dataset.yaw = viewer.view.yaw.toFixed(3);
    root.dataset.pitch = viewer.view.pitch.toFixed(3);
    root.dataset.zoom = viewer.view.zoom.toFixed(3);
    root.dataset.radius = viewer.view.radius.toFixed(3);
    root.dataset.mode = s.mode;
    return true;
  };
  function checkView() {
    root.dataset.yaw = viewer.view.yaw.toFixed(3);
    root.dataset.pitch = viewer.view.pitch.toFixed(3);
    syncHome();
  }
  // «Как вначале» видна, только когда ракурс ушёл с домашнего: тогда она и нужна.
  function syncHome() {
    const v = viewer.view, dy = Math.atan2(Math.sin(v.yaw - VIEWS.home[0]), Math.cos(v.yaw - VIEWS.home[0]));
    const away = Math.abs(dy) > 0.05 || Math.abs(v.pitch - VIEWS.home[1]) > 0.05 || Math.abs(v.zoom - 1) > 0.02;
    if (homeBtn.hidden === away) homeBtn.hidden = !away;
  }
  viewer.invalidate();
  root.__p3 = {
    pick: (x, y) => viewer.pickAt(x, y),
    at(id) {
      const p = viewer.parts.find((q) => q.id === id && !q.packet);
      if (!p) throw new Error("нет детали " + id);
      const [x, y] = viewer.project(p.center);
      const r = canvas.getBoundingClientRect();
      return [r.left + x, r.top + y];
    },
    hi: () => viewer.look.hi.slice(),
    accent: () => s.accent.slice(),
    packets() {
      const n = { cmd: 0, vid: 0 };
      for (const p of viewer.parts) if (p.packet && !p.hidden) n[p.lane]++;
      return n;
    },
  };
  return {
    destroy() {
      root.removeEventListener("click", onClick);
      mo.disconnect();
      if (mq && mq.removeEventListener) mq.removeEventListener("change", theme);
      viewer.destroy();
    },
  };
}
