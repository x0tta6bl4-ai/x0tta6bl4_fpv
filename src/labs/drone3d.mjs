// Гл. 3. Дрон целиком в 3D: крутить пальцем, разобрать на этажи, нажать деталь — описание как у плоской схемы.
// Модель собрана из простых фигур кодом (src/gl3d.mjs), размеры — типичный 5″: диагональ 225 мм, винты 5″, стек 30,5 мм.
import { createViewer, M4 } from "../gl3d.mjs";
import { buildDroneParts as build, MOTOR_POSITIONS as MOTORS, MOTOR_SPIN as SPIN } from "./drone-model.mjs";
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
  root.innerHTML = `<div class="d3-stage"><canvas class="d3-canvas" tabindex="0" role="img" aria-label="Трёхмерная модель FPV-дрона: рама, стек FC и ESC, моторы, винты, камера, видеопередатчик, приёмник, антенны, аккумулятор"></canvas>
    <svg class="d3-leaders" aria-hidden="true"><path/></svg>
    <button type="button" class="d3-marker" data-act="focus" hidden aria-label="Рассмотреть выбранную деталь"></button>
    <p class="d3-hint">Крути пальцем · щипок — масштаб · касание — деталь · с клавиатуры: стрелки, +/−</p></div>
    <div class="d3-bar" role="group" aria-label="Вид и разборка"><button type="button" class="lab-btn" data-act="explode" aria-pressed="false">Разобрать</button><button type="button" class="lab-btn" data-view="top">Сверху</button><button type="button" class="lab-btn" data-view="side">Сбоку</button><button type="button" class="lab-btn" data-view="under">Снизу</button><button type="button" class="lab-btn" data-view="home">Сброс</button><button type="button" class="lab-btn" data-act="focus" disabled aria-pressed="false">К детали</button></div>
    <label class="d3-explode">Разборка <input type="range" min="0" max="100" value="0" step="1" aria-label="Степень разборки"><output>0 %</output></label>
    <div class="d3-parts" role="group" aria-label="Детали">${CHIPS.map((id) => `<button type="button" data-part="${id}" aria-pressed="false">${SHORT[id]}</button>`).join("")}</div>
    <p class="lab-read d3-info" aria-live="polite">Нажми на деталь на модели или в списке — здесь появится, что это и зачем.</p>`;
  const $ = (q) => root.querySelector(q);
  const canvas = $(".d3-canvas"), infoEl = $(".d3-info");
  const s = { sel: null, ex: 0, exTo: 0, focus: false, seen: new Set(), spin: {} };
  let viewer;
  try {
    viewer = createViewer(canvas, { onPick: (id) => select(id, "tap"), onView: () => checkView() });
  } catch (e) {
    viewer = null;
  }
  if (!viewer) {
    $(".d3-stage").innerHTML = `<p class="lab-read">Этот браузер не показывает 3D (WebGL выключен или не поддерживается). Плоская схема — на вкладке «Состав FPV-дрона».</p>`;
    $(".d3-bar").hidden = true;
    $(".d3-explode").hidden = true;
    const fallbackClick = (e) => {
      const b = e.target.closest("[data-part]");
      if (!b) return;
      const id = b.dataset.part, part = PARTS[id];
      root.querySelectorAll("[data-part]").forEach(el => el.setAttribute("aria-pressed", String(el === b)));
      infoEl.textContent = `${part.name}. ${part.text} ${part.ref}`;
      root.dataset.sel = id;
    };
    root.addEventListener("click", fallbackClick);
    return { destroy() { root.removeEventListener("click", fallbackClick); } };
  }
  viewer.view.radius = 18.5;
  viewer.look.dimOthers = .18;
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
      const previous = s.ex;
      s.ex += Math.sign(s.exTo - s.ex) * Math.min(Math.abs(s.exTo - s.ex), dt * 1.8);
      anim = true;
      if (previous < .95 && s.ex >= .95) checkMissions();
    }
    // Разобранный дрон выше: поднимаем точку, вокруг которой крутится камера, и чуть отодвигаемся.
    for (const p of viewer.parts) p.hidden = !!p.assembledOnly && s.ex > 0.025;
    const selected = parts.find(p => p.id === s.sel);
    const focusRadius = { frame: 18.5, battery: 5.7, motor: 3, camera: 2.8, ant_vtx: 3.1, ant_rx: 3.1 };
    const target = s.focus && selected ? selected.center.map((v, i) => v + selected.off[i] * ease(s.ex)) : [0, 1.5 + 4 * ease(s.ex), 0];
    const bounds = [];
    for(const [x,z] of Object.values(MOTORS)) for(let i=0;i<16;i++) {
      const a=i*Math.PI/8; bounds.push([x+6.45*Math.cos(a),2.6+3*ease(s.ex),z+6.45*Math.sin(a)]);
    }
    for(const [x,z] of Object.values(MOTORS)) bounds.push([x,0,z]);
    for(const x of [-1.9,1.9]) for(const y of [3,6.6]) for(const z of [-4,3.6]) bounds.push([x,y+9*ease(s.ex),z]);
    bounds.push([0,5.3+3.5*ease(s.ex),-7.4-2.5*ease(s.ex)],[0,2.3+.5*ease(s.ex),5.5+3.5*ease(s.ex)]);
    const fit = viewer.fitRadius(bounds);
    const radius = s.focus && selected ? (s.sel.startsWith("prop_") ? 7.2 : focusRadius[s.sel] || 3.7) : fit;
    const follow = 1 - Math.exp(-dt * 9);
    for (let i=0;i<3;i++) { if (Math.abs(viewer.view.target[i]-target[i]) > .005) anim=true; viewer.view.target[i] += (target[i]-viewer.view.target[i])*follow; }
    if (Math.abs(viewer.view.radius-radius) > .005) anim=true;
    viewer.view.radius += (radius-viewer.view.radius)*follow;
    const marker = $(".d3-marker");
    const leader = $(".d3-leaders path");
    marker.hidden = !selected; leader.setAttribute("d","");
    if (selected) {
      const point = selected.center.map((v,i) => v + selected.off[i] * ease(s.ex));
      const [x,y,visible] = viewer.project(point), rect = canvas.getBoundingClientRect();
      marker.hidden = !visible || x < 0 || x > rect.width || y < 0 || y > rect.height;
      const lx=Math.max(58,Math.min(rect.width-58,x+(x>rect.width/2?-86:86)));
      const ly=Math.max(44,Math.min(rect.height-40,y-26));
      marker.style.left = `${lx}px`; marker.style.top = `${ly}px`;
      if(!marker.hidden) leader.setAttribute("d",`M${x},${y}L${lx},${ly}`);
      marker.textContent = SHORT[s.sel];
    }
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
    root.dataset.focused = String(s.focus);
    root.dataset.yaw = viewer.view.yaw.toFixed(3);
    root.dataset.pitch = viewer.view.pitch.toFixed(3);
    root.dataset.zoom = viewer.view.zoom.toFixed(3);
    return anim;
  };
  viewer.invalidate();

  function select(id, how) {
    s.sel = id && PARTS[id] ? id : null;
    viewer.look.sel = s.sel;
    if (!s.sel) s.focus = false;
    for (const b of root.querySelectorAll('.d3-bar [data-act="focus"]')) { b.disabled = !s.sel; b.setAttribute("aria-pressed",String(s.focus)); }
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
    if (s.sel === "fc" && s.exTo === 1 && s.ex >= .95) ctx.done("stack");
    if (s.seen.has("prop_fl") && s.seen.has("prop_rr")) ctx.done("cw");
    if (s.sel === "camera" && sideView()) ctx.done("cam");
    if (s.seen.has("ant_vtx") && s.seen.has("ant_rx")) ctx.done("ants");
  }
  const handleClick = (e) => {
    const pb = e.target.closest("[data-part]");
    if (pb) return select(pb.dataset.part === s.sel ? null : pb.dataset.part, "chip");
    const vb = e.target.closest("[data-view]");
    if (vb) { s.focus = false; root.querySelector('.d3-bar [data-act="focus"]').setAttribute("aria-pressed","false"); camTo = VIEWS[vb.dataset.view]; if (vb.dataset.view === "home") viewer.view.zoom = 1; viewer.invalidate(); return; }
    const focus = e.target.closest('[data-act="focus"]');
    if (focus && s.sel) {
      s.focus = !s.focus; viewer.view.zoom = 1;
      root.querySelector('.d3-bar [data-act="focus"]').setAttribute("aria-pressed",String(s.focus));
      root.dataset.focused = String(s.focus); viewer.invalidate(); return;
    }
    const xb = e.target.closest("[data-act='explode']");
    if (xb) {
      s.exTo = s.exTo ? 0 : 1;
      xb.setAttribute("aria-pressed", String(!!s.exTo));
      xb.textContent = s.exTo ? "Собрать" : "Разобрать";
      root.dataset.exploded = String(!!s.exTo);
      $(".d3-explode input").value = String(s.exTo * 100);
      $(".d3-explode output").textContent = `${Math.round(s.exTo * 100)} %`;
      if (s.sel) select(s.sel, "chip");
      checkMissions();
      viewer.invalidate();
    }
  };
  root.addEventListener("click",handleClick);
  const explodeInput = $(".d3-explode input");
  const slideExplode = () => {
    s.exTo = Number(explodeInput.value) / 100;
    $(".d3-explode output").textContent = `${Math.round(s.exTo * 100)} %`;
    const btn = $('[data-act="explode"]');
    btn.setAttribute("aria-pressed",String(s.exTo > 0)); btn.textContent = s.exTo > 0 ? "Собрать" : "Разобрать";
    root.dataset.exploded = String(s.exTo > 0);
    if(s.sel) select(s.sel,"chip");
    viewer.invalidate();
  };
  explodeInput.addEventListener("input",slideExplode);
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
      root.removeEventListener("click",handleClick);
      explodeInput.removeEventListener("input",slideExplode);
      mo.disconnect();
      if (mq && mq.removeEventListener) mq.removeEventListener("change", theme);
      viewer.destroy();
    },
  };
}
