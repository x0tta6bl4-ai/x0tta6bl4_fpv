// Гл. 3. Дрон целиком в 3D: крутить пальцем, разобрать на этажи, нажать деталь — описание как у плоской схемы.
// Модель собрана из простых фигур кодом (src/gl3d.mjs), размеры — типичный 5″: диагональ 225 мм, винты 5″, стек 30,5 мм.
import { createViewer, Mesh, M4 } from "../gl3d.mjs";
import { COMPONENTS } from "../figs/quad.mjs";

export const meta = {
  id: "drone3d",
  title: "Дрон в 3D",
  missions: [
    { id: "stack", text: "Нажми «Разобрать» и найди этаж стека, где стоит полётный контроллер (нажми на него)" },
    { id: "cw", text: "Найди оба винта, которые крутятся по часовой стрелке, если смотреть сверху. Нажатый винт показывает своё вращение" },
    { id: "cam", text: "Поверни дрон боком (или кнопка «Сбоку») и нажми на камеру: видно, что она наклонена вверх" },
    { id: "ants", text: "Найди обе антенны: видеопередатчика и приёмника" },
  ],
};

const C = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));
const R = 7.95; // половина диагонали 225 мм по осям X и Z, см
const MOTORS = { fl: [-R, R], fr: [R, R], rl: [-R, -R], rr: [R, -R] };
// Диагональные винты крутятся в одну сторону: так реактивные моменты пар гасят друг друга (гл. 2, гл. 5).
const SPIN = { fl: "cw", rr: "cw", fr: "ccw", rl: "ccw" };
const PLACE = { fl: "передний левый", fr: "передний правый", rl: "задний левый", rr: "задний правый" };
const DIR = { cw: "по часовой стрелке", ccw: "против часовой стрелки" };

const info = (id) => (C[id] ? { name: C[id].name, text: `${C[id].sub}. ${C[id].text}`, ref: C[id].ref || "" } : null);
const PARTS = {
  frame: info("frame"),
  esc: info("esc"),
  fc: info("fc"),
  cap: info("cap"),
  motor: { name: "Моторы", text: "Бесколлекторные outrunner: снаружи вращается колокол с магнитами, внутри неподвижные обмотки. Размер 2207 — статор 22 мм в диаметре и 7 мм в высоту; KV — обороты на вольт без нагрузки.", ref: "гл. 5" },
  ...Object.fromEntries(Object.keys(MOTORS).map((k) => [`prop_${k}`, { name: `Винт ${PLACE[k]}`, text: `Крутится ${DIR[SPIN[k]]}, если смотреть сверху. Винт по диагонали от него крутится так же, соседние — наоборот: моменты пар гасят друг друга, и дрон не вращается на месте. Поднятая кромка лопасти идёт первой.`, ref: "гл. 2, гл. 5" }])),
  camera: info("camera"),
  vtx: info("vtx"),
  rx: info("rx"),
  ant_vtx: { name: "Антенна видео", text: "Круговая антенна-«леденец» 5,8 ГГц на разъёме видеопередатчика. Включать VTX без неё нельзя: мощность отражается и греет выходной каскад.", ref: "гл. 8, гл. 12" },
  ant_rx: { name: "Антенна приёмника", text: "Т-антенна 2,4 ГГц: два тонких уса на конце кабеля, выведены за раму, чтобы карбон не закрывал сигнал. Усы — разные половины диполя, их не скручивают вместе.", ref: "гл. 8, гл. 10" },
  battery: info("battery"),
};
const CHIPS = ["frame", "esc", "fc", "cap", "motor", "prop_fl", "prop_fr", "prop_rl", "prop_rr", "camera", "vtx", "rx", "ant_vtx", "ant_rx", "battery"];
const SHORT = { frame: "Рама", esc: "ESC", fc: "Полётник FC", cap: "Конденсатор", motor: "Моторы", prop_fl: "Винт П-Л", prop_fr: "Винт П-П", prop_rl: "Винт З-Л", prop_rr: "Винт З-П", camera: "Камера", vtx: "VTX", rx: "Приёмник", ant_vtx: "Антенна видео", ant_rx: "Антенна RX", battery: "АКБ" };

// Детали: сетка, цвет (светлая/тёмная тема), смещение при разборке. Одна деталь может состоять из нескольких кусков (рама).
function build(dark) {
  const carbon = dark ? [0.36, 0.37, 0.4] : [0.2, 0.21, 0.23];
  const list = [];
  const add = (id, mesh, color, off, center) => { const o = { id, mesh, color, off, center }; list.push(o); return o; };

  const bottom = new Mesh().box(4.4, 0.5, 8.6, M4.t(0, 0, 0));
  for (const [x, z] of Object.values(MOTORS)) {
    const L = Math.hypot(x, z) - 1;
    bottom.box(1.5, 0.5, L, M4.chain(M4.t(x / 2, 0, z / 2), M4.ry(Math.atan2(x, z))));
    bottom.cyl(1.5, 0.5, 20, M4.t(x, 0, z));
  }
  for (const [x, z] of [[-1.6, -3.4], [1.6, -3.4], [-1.6, 3.4], [1.6, 3.4]]) bottom.tube([x, 0.25, z], [x, 2.85, z], 0.22, 8);
  // Боковые пластины держат камеру за винты по бокам; передняя часть камеры и объектив выступают — сбоку виден наклон.
  for (const x of [-1.35, 1.35]) bottom.box(0.25, 2.1, 1.4, M4.t(x, 1.25, 3.1));
  add("frame", bottom, carbon, [0, 0, 0], [0, 0.3, 0]);
  add("frame", new Mesh().box(3.8, 0.3, 7.6, M4.t(0, 3.0, 0)), carbon, [0, 6.5, 0], [0, 3, 0]);

  const esc = new Mesh().box(3.6, 0.45, 3.6, M4.t(0, 0.9, 0));
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) esc.box(0.7, 0.25, 0.7, M4.t(x, 1.22, z));
  add("esc", esc, [0.15, 0.36, 0.25], [0, 1.2, 0], [0, 0.9, 0]);
  const fc = new Mesh().box(3.6, 0.4, 3.6, M4.t(0, 1.9, 0)).box(1.0, 0.25, 1.0, M4.t(0, 2.2, 0)).box(0.5, 0.2, 0.5, M4.t(1.0, 2.15, 1.0));
  add("fc", fc, [0.16, 0.24, 0.46], [0, 2.8, 0], [0, 1.9, 0]);
  add("cap", new Mesh().cyl(0.5, 1.8, 16, M4.chain(M4.t(0, 0.85, -2.6), M4.rz(Math.PI / 2))), [0.12, 0.14, 0.3], [0, 0.6, -2.5], [0, 0.85, -2.6]);

  const motors = new Mesh();
  for (const [x, z] of Object.values(MOTORS)) motors.lathe([[1.4, 0.25], [1.4, 1.55], [1.15, 1.8], [0.35, 1.9], [0.25, 2.25], [0, 2.25]], 24, M4.t(x, 0, z));
  add("motor", motors, dark ? [0.72, 0.74, 0.78] : [0.58, 0.6, 0.64], [0, 1.3, 0], [R, 1.2, R]);

  for (const k of Object.keys(MOTORS)) {
    const [x, z] = MOTORS[k];
    const tilt = SPIN[k] === "cw" ? -0.32 : 0.32;
    const m = new Mesh().cyl(0.6, 0.6, 16, M4.t(0, 2.45, 0));
    for (let b = 0; b < 3; b++) m.box(5.6, 0.12, 1.15, M4.chain(M4.ry((b * Math.PI * 2) / 3), M4.t(3.2, 2.5, 0), M4.rx(tilt)));
    // Сетка винта — вокруг своей оси (начало координат); на место мотора её ставит model() вместе с вращением.
    const pr = add(`prop_${k}`, m, dark ? [0.55, 0.62, 0.72] : [0.42, 0.5, 0.6], [0, 3, 0], [x, 2.5, z]);
    pr.spin = SPIN[k];
    pr.pivot = [x, z];
  }
  const cam = new Mesh().box(1.9, 1.9, 1.9).cyl(0.62, 0.9, 18, M4.chain(M4.t(0, 0, 1.3), M4.rx(Math.PI / 2)));
  add("camera", new Mesh().push(cam.p, cam.n, cam.i, M4.chain(M4.t(0, 1.3, 3.7), M4.rx(-0.44))), [0.1, 0.1, 0.12], [0, 0.5, 3.5], [0, 1.5, 4.6]);
  add("vtx", new Mesh().box(2.2, 0.35, 1.8, M4.t(0, 2.35, -3.0)), [0.34, 0.2, 0.44], [0, 3.5, -2.5], [0, 2.35, -3]);
  add("rx", new Mesh().box(1.0, 0.25, 1.5, M4.t(1.75, 2.4, -3.0)), [0.42, 0.42, 0.46], [2, 3.5, -2.5], [1.75, 2.4, -3]);
  const av = new Mesh().tube([0, 2.4, -3.9], [0, 4.3, -6.2], 0.2, 10).lathe([[0.01, -0.5], [0.8, -0.3], [0.9, 0], [0.8, 0.3], [0.01, 0.5]], 18, M4.chain(M4.t(0, 4.55, -6.5), M4.rx(0.7)));
  add("ant_vtx", av, dark ? [0.86, 0.36, 0.3] : [0.72, 0.22, 0.18], [0, 3.5, -2.5], [0, 4.2, -6.2]);
  const ar = new Mesh().tube([1.75, 2.35, -3.6], [3.4, 2.0, -5.6], 0.1, 8).tube([4.48, 2.0, -4.7], [2.32, 2.0, -6.5], 0.07, 6);
  add("ant_rx", ar, dark ? [0.9, 0.9, 0.86] : [0.62, 0.62, 0.58], [2, 3.5, -2.5], [3.4, 2.0, -5.6]);
  const bat = new Mesh().box(3.5, 3.2, 7.2, M4.t(0, 4.75, -0.3)).box(1.4, 0.6, 0.8, M4.t(0, 3.7, -4.3));
  add("battery", bat, [0.86, 0.64, 0.18], [0, 9, 0], [0, 4.75, -0.3]);
  return list;
}

// Цвет CSS-переменной → [r, g, b] 0..1 (через пробный элемент: переменные бывают color-mix и т.п.).
function cssColor(root, v, fb) {
  const d = document.createElement("i");
  d.style.cssText = `position:absolute;visibility:hidden;color:var(${v})`;
  root.appendChild(d);
  const m = getComputedStyle(d).color.match(/[\d.]+/g);
  d.remove();
  return m && m.length >= 3 ? m.slice(0, 3).map((x) => Number(x) / 255) : fb;
}

const VIEWS = { top: [0.0001, 1.3], side: [Math.PI / 2, 0.08], under: [0.7, -1.1], home: [0.7, 0.42] };

export function mount(root, ctx) {
  root.innerHTML = `<div class="d3-stage"><canvas class="d3-canvas" role="img" aria-label="Трёхмерная модель FPV-дрона: рама, стек FC и ESC, моторы, винты, камера, видеопередатчик, приёмник, антенны, аккумулятор"></canvas>
    <p class="d3-hint">Крути пальцем · два пальца — ближе или дальше · касание — деталь</p></div>
    <div class="d3-bar" role="group" aria-label="Вид и разборка"><button type="button" class="lab-btn" data-act="explode" aria-pressed="false">Разобрать</button><button type="button" class="lab-btn" data-view="top">Сверху</button><button type="button" class="lab-btn" data-view="side">Сбоку</button><button type="button" class="lab-btn" data-view="under">Снизу</button><button type="button" class="lab-btn" data-view="home">Сброс</button></div>
    <div class="d3-parts" role="group" aria-label="Детали">${CHIPS.map((id) => `<button type="button" data-part="${id}" aria-pressed="false">${SHORT[id]}</button>`).join("")}</div>
    <p class="lab-read d3-info" aria-live="polite">Нажми на деталь на модели или в списке — здесь появится, что это и зачем.</p>`;
  const $ = (q) => root.querySelector(q);
  const canvas = $(".d3-canvas"), infoEl = $(".d3-info");
  const s = { sel: null, ex: 0, exTo: 0, seen: new Set(), spin: {} };
  let viewer;
  try {
    viewer = createViewer(canvas, { onPick: (id) => select(id, "tap"), onView: () => checkView() });
  } catch (e) {
    viewer = null;
  }
  if (!viewer) {
    $(".d3-stage").innerHTML = `<p class="lab-read">Этот браузер не показывает 3D (WebGL выключен или не поддерживается). Плоская схема — на вкладке «Состав FPV-дрона».</p>`;
    return { destroy() {} };
  }
  const isDark = () => { const [r, g, b] = cssColor(root, "--anatomy-page", [1, 1, 1]); return r * 0.3 + g * 0.59 + b * 0.11 < 0.5; };
  let parts = [];
  const theme = () => {
    viewer.look.bg = cssColor(root, "--anatomy-page", [1, 1, 1]);
    viewer.look.hi = cssColor(root, "--accent", [0.2, 0.5, 1]);
    parts = build(isDark());
    for (const p of parts) {
      p.angle = 0;
      p.model = () => {
        const o = p.off.map((v) => v * ease(s.ex));
        if (!p.pivot) return M4.t(...o);
        return M4.chain(M4.t(o[0] + p.pivot[0], o[1], o[2] + p.pivot[1]), M4.ry(p.angle));
      };
    }
    viewer.setParts(parts);
  };
  const ease = (t) => t * t * (3 - 2 * t);
  theme();
  const mo = new MutationObserver(theme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (mq && mq.addEventListener) mq.addEventListener("change", theme);

  let camTo = null, last = 0;
  viewer.onFrame = () => {
    const now = performance.now(), dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    let anim = false;
    if (s.ex !== s.exTo) {
      s.ex += Math.sign(s.exTo - s.ex) * Math.min(Math.abs(s.exTo - s.ex), dt * 1.8);
      anim = true;
    }
    // Разобранный дрон выше: поднимаем точку, вокруг которой крутится камера, и чуть отодвигаемся.
    viewer.view.target[1] = 1.5 + 4 * ease(s.ex);
    viewer.view.radius = 13.5 + 3 * ease(s.ex);
    if (camTo) {
      const v = viewer.view, k = 1 - Math.exp(-dt * 7);
      let dy = camTo[0] - v.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      v.yaw += dy * k;
      v.pitch += (camTo[1] - v.pitch) * k;
      if (Math.abs(dy) < 0.003 && Math.abs(camTo[1] - v.pitch) < 0.003) { v.yaw = camTo[0]; v.pitch = camTo[1]; camTo = null; checkView(); }
      anim = true;
    }
    // Выбранный винт показывает своё вращение (~1 оборот в 2 с); сверху по часовой — отрицательный угол вокруг оси Y.
    for (const p of parts) if (p.spin && p.id === s.sel) { p.angle += (p.spin === "cw" ? -1 : 1) * Math.PI * dt; anim = true; }
    root.dataset.yaw = viewer.view.yaw.toFixed(3);
    root.dataset.pitch = viewer.view.pitch.toFixed(3);
    root.dataset.zoom = viewer.view.zoom.toFixed(3);
    return anim;
  };
  viewer.invalidate();

  function select(id, how) {
    s.sel = id && PARTS[id] ? id : null;
    viewer.look.sel = s.sel;
    root.dataset.sel = s.sel || "";
    root.querySelectorAll("[data-part]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === s.sel)));
    if (!s.sel) infoEl.textContent = how === "tap" ? "Мимо детали — попробуй ещё раз или выбери в списке." : "Нажми на деталь на модели или в списке.";
    else {
      const P = PARTS[s.sel];
      const hidden = (s.sel === "fc" || s.sel === "esc" || s.sel === "cap") && s.ex < 0.5 ? " Сейчас она спрятана внутри рамы — нажми «Разобрать»." : "";
      infoEl.innerHTML = `<b>${P.name}.</b> ${P.text}${hidden}${P.ref ? ` <small class="muted">${P.ref}</small>` : ""}`;
      s.seen.add(s.sel);
    }
    checkMissions();
    viewer.invalidate();
  }
  function sideView() {
    const v = viewer.view;
    return Math.abs(Math.sin(v.yaw)) > 0.85 && Math.abs(v.pitch) < 0.35;
  }
  function checkView() {
    root.dataset.yaw = viewer.view.yaw.toFixed(3);
    root.dataset.pitch = viewer.view.pitch.toFixed(3);
    checkMissions();
  }
  function checkMissions() {
    if (s.sel === "fc" && s.exTo === 1) ctx.done("stack");
    if (s.seen.has("prop_fl") && s.seen.has("prop_rr")) ctx.done("cw");
    if (s.sel === "camera" && sideView()) ctx.done("cam");
    if (s.seen.has("ant_vtx") && s.seen.has("ant_rx")) ctx.done("ants");
  }
  root.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-part]");
    if (pb) return select(pb.dataset.part === s.sel ? null : pb.dataset.part, "chip");
    const vb = e.target.closest("[data-view]");
    if (vb) { camTo = VIEWS[vb.dataset.view]; if (vb.dataset.view === "home") viewer.view.zoom = 1; viewer.invalidate(); return; }
    const xb = e.target.closest("[data-act='explode']");
    if (xb) {
      s.exTo = s.exTo ? 0 : 1;
      xb.setAttribute("aria-pressed", String(!!s.exTo));
      xb.textContent = s.exTo ? "Собрать" : "Разобрать";
      root.dataset.exploded = String(!!s.exTo);
      if (s.sel) select(s.sel, "chip");
      checkMissions();
      viewer.invalidate();
    }
  });
  // Для автотестов: экранная точка центра детали с учётом разборки.
  root.__d3 = {
    viewer,
    at(id) {
      const p = parts.find((q) => q.id === id && !q.hidden);
      const o = p.off.map((v) => v * ease(s.ex));
      const [x, y] = viewer.project([p.center[0] + o[0], p.center[1] + o[1], p.center[2] + o[2]]);
      const r = canvas.getBoundingClientRect();
      return [r.left + x, r.top + y];
    },
    angle: (id) => (parts.find((q) => q.id === id) || {}).angle,
  };
  return {
    destroy() {
      mo.disconnect();
      if (mq && mq.removeEventListener) mq.removeEventListener("change", theme);
      viewer.destroy();
    },
  };
}
