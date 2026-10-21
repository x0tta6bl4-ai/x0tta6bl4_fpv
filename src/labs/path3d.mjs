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
const CMD_A = [-23, 13.2, -6];
const CMD_B = [13.0, 8.0, -6];
const VID_A = [15.8, 7.6, 7.2];
const VID_B = [-16.2, 6.4, 7.2];
const BOUNDS = [
  [-28, 0, -11], [-28, 14.2, -6], [-12, 4, 12],
  [25, 0, -9], [25, 9, 10], [9, 9, -9],
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
    prop: dark ? [0.62, 0.64, 0.68] : [0.22, 0.24, 0.28],
    pad: dark ? [0.20, 0.22, 0.26] : [0.82, 0.84, 0.86],
    stick: [0.86, 0.72, 0.28],
  };
}

function build(dark) {
  const C = palette(dark);
  const parts = [];
  const add = (id, mesh, color, center, extra) => {
    parts.push({ id, mesh, color, center, ...extra });
    return parts[parts.length - 1];
  };
  const radio = new Mesh();
  radio.box(6.8, 2.15, 4.6, M4.t(-23, 1.2, -6));
  add("radio", radio, C.radio, [-23, 1.8, -6]);
  const sticks = new Mesh();
  sticks.cyl(0.28, 1.15, 10, M4.t(-21.15, 2.7, -6.95));
  sticks.cyl(0.28, 1.15, 10, M4.t(-21.15, 2.7, -5.05));
  sticks.box(0.85, 0.28, 0.62, M4.t(-21.15, 3.35, -6.95));
  sticks.box(0.85, 0.28, 0.62, M4.t(-21.15, 3.35, -5.05));
  add("radio", sticks, C.stick, [-23, 1.8, -6]);
  add("radio", new Mesh().box(2.6, 0.14, 1.7, M4.t(-24.3, 2.34, -6)), C.screen, [-23, 1.8, -6]);

  const tx = new Mesh();
  tx.tube([-23, 2.3, -6], CMD_A, 0.09, 8);
  ball(tx, 0.28, CMD_A);
  add("txant", tx, C.metal, CMD_A);

  const gog = new Mesh();
  gog.box(7.6, 2.5, 3.5, M4.t(-20.2, 1.7, 7.2));
  gog.box(0.35, 1.3, 2.6, M4.t(-24.1, 1.9, 7.2));
  add("goggles", gog, C.radio, [-20.2, 1.9, 7.2]);
  const lenses = new Mesh();
  lenses.box(2.3, 0.16, 1.35, M4.t(-21.5, 3.02, 7.2));
  lenses.box(2.3, 0.16, 1.35, M4.t(-18.7, 3.02, 7.2));
  add("goggles", lenses, C.lens, [-20.2, 1.9, 7.2]);
  const gant = new Mesh();
  gant.tube([-16.5, 2.8, 7.2], VID_B, 0.09, 8);
  ball(gant, 0.26, VID_B);
  add("gant", gant, C.metal, VID_B);

  const pad = new Mesh();
  pad.box(16, 0.12, 14, M4.t(-21, 0.06, 0.6));
  pad.box(22, 0.12, 18, M4.t(17, 0.06, 0.6));
  add("pad", pad, C.pad, [-21, 0.1, 0.6]);

  const frame = new Mesh();
  const cy = 2.05, cz = 0.6, cx = 17;
  frame.box(4.4, 0.38, 4.4, M4.t(cx, cy, cz));
  const motors = [[21.4, 4.4], [21.4, -3.2], [12.6, 4.4], [12.6, -3.2]];
  const cans = new Mesh();
  for (const [x, z] of motors) {
    arm(frame, [cx, cz], [x, z], cy, 1.05, 0.3);
    cans.cyl(0.72, 0.7, 14, M4.t(x, cy + 0.4, z));
  }
  add("frame", frame, C.carbon, [cx, cy, cz]);
  add("frame", cans, C.metal, [cx, cy + 0.4, cz]);
  add("battery", new Mesh().box(4.6, 1.55, 2.3, M4.t(16.4, 1.05, cz)), C.batt, [16.4, 1.05, cz]);
  const props = new Mesh();
  for (const [x, z] of motors) {
    props.box(0.22, 0.07, 3.7, M4.chain(M4.t(x, cy + 0.95, z), M4.ry(0.5)));
    props.box(0.22, 0.07, 3.7, M4.chain(M4.t(x, cy + 0.95, z), M4.ry(0.5 + Math.PI / 2)));
  }
  add("frame", props, C.prop, [cx, cy + 1, cz]);

  const fc = new Mesh();
  fc.box(3.05, 0.2, 3.05, M4.t(cx, 2.5, cz));
  add("fc", fc, C.fc, [cx, 2.55, cz]);
  add("fc", new Mesh().box(0.85, 0.12, 0.85, M4.t(cx, 2.66, cz + 0.3)), C.chip, [cx, 2.55, cz]);

  const rx = new Mesh().box(2.3, 0.7, 1.55, M4.t(14.6, 3.35, -4.5));
  add("rx", rx, C.rx, [14.6, 3.4, -4.5]);
  const rxant = new Mesh();
  rxant.tube([14.6, 3.75, -4.5], CMD_B, 0.1, 8);
  rxant.tube([CMD_B[0], CMD_B[1], CMD_B[2] - 1.7], [CMD_B[0], CMD_B[1], CMD_B[2] + 1.7], 0.09, 6);
  ball(rxant, 0.22, CMD_B);
  add("rxant", rxant, C.metal, CMD_B);

  const vtx = new Mesh().box(1.7, 0.7, 1.25, M4.t(15.4, 2.85, 2.9));
  add("vtx", vtx, C.vtx, [15.4, 2.9, 2.9]);
  const vtxant = new Mesh();
  vtxant.tube([15.4, 3.25, 2.9], VID_A, 0.08, 8);
  ball(vtxant, 0.48, VID_A, 12);
  add("vtxant", vtxant, C.metal, VID_A);

  const cam = new Mesh();
  cam.box(1.35, 1.15, 1.35, M4.t(22.2, 2.55, cz));
  cam.cyl(0.32, 0.55, 12, M4.chain(M4.t(23.05, 2.55, cz), M4.rz(-Math.PI / 2)));
  add("camera", cam, C.cam, [22.2, 2.6, cz]);
  add("camera", new Mesh().cyl(0.22, 0.12, 10, M4.chain(M4.t(23.28, 2.55, cz), M4.rz(-Math.PI / 2))), C.glass, [22.2, 2.6, cz]);

  const cmdColor = BLUE.slice();
  const vidColor = ORANGE.slice();
  add("beam_cmd", new Mesh().tube(CMD_A, CMD_B, 0.26, 8), cmdColor, mid(CMD_A, CMD_B), { lane: "cmd" });
  add("beam_vid", new Mesh().tube(VID_A, VID_B, 0.26, 8), vidColor, mid(VID_A, VID_B), { lane: "vid" });
  const ballMesh = sphere(0.5, 12);
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
  cmd: "Синий мост замолчал: пакеты команд не летят, оранжевые идут. В очках картинка есть, дрон стики не слышит. Ищи в управлении, не в камере и не в полётнике.",
  vid: "Оранжевый мост замолчал: картинка не летит, синие пакеты идут. Команды до борта доходят. Ищи в видео: камера, VTX, антенна, очки.",
};

export function mount(root, ctx) {
  root.innerHTML = `<div class="d3-stage"><canvas class="d3-canvas" tabindex="0" role="img" aria-label="Два радиомоста: синий — команды от пульта к приёмнику, оранжевый — картинка от видеопередатчика к очкам"></canvas>
    <svg class="d3-leaders" aria-hidden="true"><path/></svg>
    <span class="d3-marker" hidden style="pointer-events:none"></span>
    <p class="d3-hint">Крути пальцем · щипок — масштаб · касание — деталь</p></div>
    <p class="lab-read" style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center">
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#2f78f6;display:inline-block"></i> синий — управление</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#f27814;display:inline-block"></i> оранжевый — видео</span>
    </p>
    <div class="d3-bar" role="group" aria-label="Какой мост замолчал"><button type="button" class="lab-btn" data-sym="ok" aria-pressed="true">Оба моста</button><button type="button" class="lab-btn" data-sym="cmd" aria-pressed="false">Нет управления</button><button type="button" class="lab-btn" data-sym="vid" aria-pressed="false">Нет картинки</button></div>
    <div class="d3-bar" role="group" aria-label="Ракурс"><button type="button" class="lab-btn" data-view="top">Сверху</button><button type="button" class="lab-btn" data-view="side">Сбоку</button><button type="button" class="lab-btn" data-view="home">Как вначале</button></div>
    <div class="d3-parts" role="group" aria-label="Звенья мостов">${CHIPS.map((id) => `<button type="button" data-part="${id}" aria-pressed="false">${SHORT[id]}</button>`).join("")}</div>
    <p class="lab-read d3-info" aria-live="polite">${MODE_LEAD.ok}</p>`;
  const $ = (q) => root.querySelector(q);
  const canvas = $(".d3-canvas"), infoEl = $(".d3-info");
  const s = { sel: null, act: null, mode: "ok", seen: new Set(), cmdColor: null, vidColor: null, fitted: false, refit: false };
  let camTo = null, last = 0;
  let viewer;
  try { viewer = createViewer(canvas, { onPick: (id) => select(id, "tap"), onView: () => checkView() }); }
  catch (e) { viewer = null; }
  const setPressed = () => {
    root.querySelectorAll("[data-sym]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sym === s.mode)));
    root.querySelectorAll("[data-part]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === s.sel)));
    root.dataset.mode = s.mode;
    root.dataset.sel = s.sel || "";
  };
  function note(id) {
    if (s.mode === "cmd" && id === "fc") return " Сейчас молчит синий мост. Полётник команд по радио не ловит: они приходят проводом от приёмника.";
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
    if (sym) return setMode(sym.dataset.sym);
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
    root.dataset.webgl = "0";
    $(".d3-stage").innerHTML = `<p class="lab-read">Этот браузер не показывает 3D. Звенья те же: синий мост — команды, оранжевый — картинка. Выбери их в списке.</p>`;
    return { destroy() { root.removeEventListener("click", onClick); } };
  }
  root.dataset.webgl = "1";
  viewer.view.yaw = VIEWS.home[0];
  viewer.view.pitch = VIEWS.home[1];
  viewer.view.target = [-2.2, 5.4, 0.5];
  viewer.view.zoom = 1;
  viewer.look.dimOthers = 0.5;
  const theme = () => {
    const [r, g, b] = cssColor(root, "--anatomy-page", [1, 1, 1]);
    viewer.look.bg = [r, g, b];
    viewer.look.hi = cssColor(root, "--accent", [0.2, 0.5, 1]);
    const built = build(r * 0.3 + g * 0.59 + b * 0.11 < 0.5);
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
        marker.textContent = SHORT[s.sel] || PARTS[s.sel].name;
        leader.setAttribute("d", `M${x},${y}L${lx},${ly}`);
      }
    }
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
