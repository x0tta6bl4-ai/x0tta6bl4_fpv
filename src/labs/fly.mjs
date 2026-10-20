// Гл. 2. Тренажёр сверху: два стика (Mode 2), четыре мотора, нумерация Betaflight, props in.
// Режим как Angle: правый стик задаёт угол наклона, отпустил — дрон выравнивается. Высота — тяга винтов
// против веса с учётом наклона: вверх идёт только T·cos α. Внизу слева — вид сбоку со стрелками сил.
import { loop, stick, toggle, button, clamp, fmt, TAU, svgText } from "../labkit.mjs";

export const meta = {
  id: "fly",
  title: "Тренажёр: поворот без руля",
  missions: [
    { id: "takeoff", text: "Взлети: подними левый стик (газ), пока дрон не оторвётся от земли" },
    { id: "yaw", text: "Разверни дрон носом в другую сторону только левым стиком (влево-вправо)" },
    { id: "flag", text: "Долети до флажка правым стиком" },
    { id: "flip", text: "Включи «неправильный винт» и попробуй взлететь. Что случилось?" },
  ],
};

// Моторы: 1 задний правый, 2 передний правый, 3 задний левый, 4 передний левый. props in: 1 и 4 по часовой.
const MOTORS = [
  { n: 1, x: 1, y: 1, cw: true },
  { n: 2, x: 1, y: -1, cw: false },
  { n: 3, x: -1, y: 1, cw: false },
  { n: 4, x: -1, y: -1, cw: true },
];
const MAXT = (35 * Math.PI) / 180; // предельный наклон, как angle_limit в режиме Angle (упрощённо)
const PX_M = 30; // клетка поля — 1 м
const YAW_GOAL = 2.6; // разворот для задания, рад (≈150°)

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 260" class="lab-svg" role="img" aria-label="Поле с дроном, вид сверху; внизу слева — вид сбоку со стрелками сил">
    <defs><pattern id="fgrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" class="lab-grid"/></pattern>
    <marker id="fv-arr-t" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" class="fv-ht"/></marker><marker id="fv-arr-g" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" class="fv-hg"/></marker></defs>
    <rect x="0" y="0" width="360" height="260" class="lab-field"/><rect x="0" y="0" width="360" height="260" fill="url(#fgrid)"/>
    <g id="flag"></g><g id="shadow"></g><g id="drone"></g><g id="hud"></g><g id="side"></g></svg></div>
    <div class="lab-ctl lab-sticks"></div><p class="lab-read" aria-live="polite"></p>
    <p class="lab-note"><b>Как устроен тренажёр.</b> Вид сверху, режим как Angle: правый стик задаёт угол наклона (до 35°), отпустил — дрон сам выравнивается и тормозит. Газ (левый стик вверх-вниз) не пружинит и остаётся там, где оставил. В режиме Acro, который в симуляторах часто стоит по умолчанию, иначе: стик задаёт скорость вращения, а отпущенный стик не выравнивает дрон — он остаётся наклонённым. На компьютере можно двумя руками: щёлкни по полю, затем W/S — газ, A/D — поворот, стрелки — наклоны. Упрощения: висение здесь около 50 % газа (у настоящего 5″ — обычно 25–35 %), сопротивление воздуха сильно завышено, чтобы дрон быстро останавливался, ветра нет.</p>`;
  const droneG = root.querySelector("#drone"), shadowG = root.querySelector("#shadow"), flagG = root.querySelector("#flag"), hud = root.querySelector("#hud"), sideG = root.querySelector("#side");
  const read = root.querySelector(".lab-read");
  const ctl = root.querySelector(".lab-ctl");
  const START = { x: 180, y: 190, h: 0, vx: 0, vy: 0, vh: 0, yaw: -Math.PI / 2, wy: 0, flip: 0, yaw0: null, tp: 0, tr: 0 };
  const s = { ...START, thr: 0, in: { yaw: 0, pitch: 0, roll: 0 }, wrong: false, spin: [0, 0, 0, 0], flag: [290, 80] };
  const stL = stick(ctl, { label: "Левый: газ ↕ и поворот ↔", spring: [true, false], value: [0, -1], onMove: ([x, y]) => { s.thr = (y + 1) / 2; s.in.yaw = x; } });
  const stR = stick(ctl, { label: "Правый: наклоны вперёд-назад и вбок", spring: [true, true], onMove: ([x, y]) => { s.in.roll = x; s.in.pitch = y; } });
  // Клавиатура на компьютере — две руки, как на пульте: W/S газ, A/D поворот, стрелки — наклоны. Работает после
  // щелчка по полю или стикам (поле получает фокус), чтобы стрелки не мешали прокручивать страницу.
  const stage = root.querySelector(".lab-stage");
  stage.tabIndex = 0;
  const KEYS = ["KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const keys = new Set(), kb = { yaw: false, pr: false };
  const onKey = (e) => {
    if (!KEYS.includes(e.code)) return;
    e.preventDefault();
    if (e.type === "keydown") keys.add(e.code);
    else keys.delete(e.code);
  };
  stage.addEventListener("keydown", onKey);
  stage.addEventListener("keyup", onKey);
  stage.addEventListener("focus", () => stage.setAttribute("data-kb", ""));
  stage.addEventListener("blur", () => { keys.clear(); stage.removeAttribute("data-kb"); });
  for (const el of [stage, ctl]) el.addEventListener("pointerdown", (e) => { if (!e.target.closest("input, button, label")) stage.focus({ preventScroll: true }); });
  const opts = document.createElement("div");
  opts.className = "lab-row";
  ctl.appendChild(opts);
  toggle(opts, { label: "Неправильный винт на моторе 2", value: false, onToggle: (v) => { s.wrong = v; } });
  button(opts, "Сброс", () => Object.assign(s, START));
  flagG.innerHTML = `<circle cx="${s.flag[0]}" cy="${s.flag[1]}" r="20" class="lab-target"/><path d="M${s.flag[0]} ${s.flag[1]}V${s.flag[1] - 26}l16 6-16 6" class="lab-flag"/>`;
  let msg = "";
  const L = loop(root, (dt, calm) => {
    if (keys.size || kb.yaw || kb.pr) {
      const k = (c) => (keys.has(c) ? 1 : 0);
      if (k("KeyW") || k("KeyS")) s.thr = clamp(s.thr + (k("KeyW") - k("KeyS")) * dt * 0.6, 0, 1);
      const yw = k("KeyD") - k("KeyA");
      if (yw || kb.yaw) { s.in.yaw = yw; kb.yaw = !!yw; }
      const pt = k("ArrowUp") - k("ArrowDown"), rl = k("ArrowRight") - k("ArrowLeft");
      if (pt || rl || kb.pr) { s.in.pitch = pt; s.in.roll = rl; kb.pr = !!(pt || rl); }
      stL.set([s.in.yaw, s.thr * 2 - 1]);
      stR.set([s.in.roll, s.in.pitch]);
    }
    // Миксер: каждый манёвр — разница оборотов.
    const raw = MOTORS.map((M) => {
      let v = s.thr;
      v += s.in.pitch * 0.18 * (M.y > 0 ? 1 : -1); // вперёд: задние быстрее
      v += s.in.roll * 0.18 * (M.x < 0 ? 1 : -1); // вправо: левые быстрее
      v += s.in.yaw * 0.16 * (M.cw ? -1 : 1); // поворот вправо: ускорить винты против часовой
      return v;
    });
    // Как в полётнике: если какой-то мотор упёрся в 100 %, газ всех сдвигается вниз — разница между моторами
    // (а с ней наклон и поворот) сохраняется. Иначе на полном газе дрон начинал бы сам вращаться.
    const over = Math.max(...raw) - 1;
    const m = raw.map((v) => clamp(over > 0 ? v - over : v, 0, 1));
    const thrust = m.map((v, i) => (s.wrong && i === 1 ? -0.35 * v : v));
    const total = thrust.reduce((a, b) => a + b, 0);
    // Наклон (Angle): стик задаёт угол, дрон доходит до него за доли секунды; на земле не наклоняется.
    const air = s.h > 0.5;
    const k0 = Math.min(1, dt * 6);
    s.tp += ((air ? s.in.pitch * MAXT : 0) - s.tp) * k0;
    s.tr += ((air ? s.in.roll * MAXT : 0) - s.tr) * k0;
    const tilt = Math.min(Math.hypot(s.tp, s.tr), MAXT * 1.2);
    if (s.flip > 0) {
      s.flip -= dt;
      if (s.flip <= 0) Object.assign(s, START); // flip: 0 — иначе подсказка застревает на «Кувырок!»
    } else {
      // Неправильный винт: тяга несимметрична с первой же попытки взлететь — дрон кувыркается прямо на старте.
      if (s.wrong && s.thr > 0.3) {
        s.flip = 1.6;
        ctx.done("flip");
        msg = "Кувырок на взлёте! На моторе 2 винт не того направления вращения: он гонит воздух вверх, и тяга этого угла направлена вниз. Тяга несимметрична — дрон опрокидывается при первой попытке взлететь.";
      } else {
        // Высота: вверх идёт только часть тяги T·cos α (висение около 50 % газа на ровном дроне).
        s.vh += (total * Math.cos(tilt) * 2.1 - 4.2) * dt * 9;
        s.vh *= 1 - dt * 1.6;
        s.h = Math.max(0, s.h + s.vh * dt);
        if (s.h === 0 && s.vh < 0) s.vh = 0;
        const torque = (m[1] + m[2] - m[0] - m[3]) / 2; // винты против часовой минус по часовой
        if (air) {
          // Вбок и вперёд тянет T·sin α по направлению наклона (тягу ограничиваем чуть выше висения, чтобы на полном
          // газе дрон не становился вдвое резвее — иначе в тренажёре невозможно попасть во флажок).
          const Th = Math.min(Math.max(total, 0), 2.6);
          const fwd = Th * Math.sin(s.tp) * 190, side = Th * Math.sin(s.tr) * 190;
          s.vx += (Math.cos(s.yaw) * fwd + Math.cos(s.yaw + Math.PI / 2) * side) * dt;
          s.vy += (Math.sin(s.yaw) * fwd + Math.sin(s.yaw + Math.PI / 2) * side) * dt;
          s.wy += torque * 30 * dt;
        }
        s.vx *= 1 - dt * 1.8;
        s.vy *= 1 - dt * 1.8;
        s.wy *= 1 - dt * 4;
        s.yaw += s.wy * dt;
        s.x = clamp(s.x + s.vx * dt, 20, 340);
        s.y = clamp(s.y + s.vy * dt, 20, 240);
        if (air) {
          ctx.done("takeoff");
          if (s.yaw0 === null) s.yaw0 = s.yaw;
          if (Math.abs(s.yaw - s.yaw0) > YAW_GOAL) ctx.done("yaw"); // засчитываем и если стик отпустили, а дрон довернул по инерции
          if (Math.hypot(s.x - s.flag[0], s.y - s.flag[1]) < 22) ctx.done("flag");
        }
        const deg = Math.round((tilt * 180) / Math.PI);
        const vert = s.vh > 0.4 ? "up" : s.vh < -0.4 ? "down" : "hold";
        if (!air) msg = s.thr < 0.45 ? "Дрон на земле. Подними левый стик вверх — это газ: все четыре мотора крутятся быстрее." : "Ещё чуть-чуть газа: тяга почти равна весу.";
        else if (Math.abs(s.in.yaw) > 0.2) msg = `Поворот ${s.in.yaw > 0 ? "вправо" : "влево"}: полётник ускоряет винты ${s.in.yaw > 0 ? "2 и 3 (против часовой)" : "1 и 4 (по часовой)"} и замедляет другую диагональ, стараясь сохранить суммарную тягу. «Закручивание» корпуса больше не уравновешено — дрон разворачивается.`;
        else if (deg > 4) {
          const dir = Math.abs(s.in.pitch) >= Math.abs(s.in.roll) ? (s.in.pitch > 0 ? "Вперёд: задние моторы 1 и 3 быстрее, нос опускается" : "Назад: быстрее передние моторы 2 и 4") : s.in.roll > 0 ? "Вправо: быстрее левые моторы 3 и 4" : "Влево: быстрее правые моторы 1 и 2";
          msg = `${dir}. Наклон ${deg}°: вверх идёт только T·cos α, вбок — T·sin α. ${vert === "down" ? "Дрон проседает — добавь газа." : vert === "up" ? "Газа с запасом — дрон ещё и поднимается." : "Газа хватает, высота держится."}`;
        } else if (vert === "up") msg = "Подъём: суммарная тяга больше веса — дрон набирает высоту. Соседние винты крутятся в разные стороны, моменты уравновешены, поэтому дрон не вертится.";
        else if (vert === "down") msg = "Снижение: суммарная тяга меньше веса — дрон опускается. Добавь газа, чтобы зависнуть.";
        else msg = "Висим: тяга равна весу. Все четыре мотора крутятся одинаково, соседние — в разные стороны, поэтому дрон не вертится.";
      }
    }
    if (!calm) s.spin = s.spin.map((a, i) => a + (m[i] * 18 + 1) * dt * (MOTORS[i].cw ? 1 : -1));
    // Рисуем.
    const k = 1 + s.h * 0.012;
    const flipA = s.flip > 0 ? (1.6 - s.flip) * 9 : 0;
    const arm = 34 * k;
    let d = "";
    d += `<g transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${((s.yaw * 180) / Math.PI + 90 + flipA * 60).toFixed(1)})">`;
    // Сектор обзора курсовой камеры: куда смотрит камера — туда дрон летит при стике «от себя».
    d += `<path d="M0 ${(-20 * k).toFixed(1)}L${(-34 * k).toFixed(1)} ${(-86 * k).toFixed(1)}A${(74 * k).toFixed(1)} ${(74 * k).toFixed(1)} 0 0 1 ${(34 * k).toFixed(1)} ${(-86 * k).toFixed(1)}Z" class="fly-fov"/>`;
    d += `<path d="M${-arm * 0.7} ${-arm * 0.7}L${arm * 0.7} ${arm * 0.7}M${arm * 0.7} ${-arm * 0.7}L${-arm * 0.7} ${arm * 0.7}" class="fly-arm"/>`;
    d += `<rect x="${-9 * k}" y="${-14 * k}" width="${18 * k}" height="${28 * k}" rx="4" class="fly-body"/>`;
    d += `<path d="M0 ${-22 * k}l-6 8h12z" class="fly-nose"/>`;
    MOTORS.forEach((M, i) => {
      const cx = M.x * arm * 0.7, cy = M.y * arm * 0.7, r = 15 * k;
      const a = s.spin[i];
      const wrong = s.wrong && i === 1;
      d += `<circle cx="${cx}" cy="${cy}" r="${r}" class="fly-disc" style="opacity:${(0.15 + m[i] * 0.6).toFixed(2)}" ${wrong ? 'data-bad="1"' : ""}/>`;
      d += `<path d="M${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}L${cx - Math.cos(a) * r} ${cy - Math.sin(a) * r}" class="fly-blade"/>`;
      const sweep = M.cw ? 1 : 0;
      const a0 = a + 0.4, a1 = a + 1.6;
      d += `<path d="M${cx + Math.cos(a0) * (r + 4)} ${cy + Math.sin(a0) * (r + 4)}A${r + 4} ${r + 4} 0 0 ${sweep} ${cx + Math.cos(a1) * (r + 4)} ${cy + Math.sin(a1) * (r + 4)}" class="fly-dir"/>`;
      d += `<text x="${cx}" y="${cy + 4}" class="fly-n" text-anchor="middle">${M.n}</text>`;
    });
    d += "</g>";
    droneG.innerHTML = d;
    shadowG.innerHTML = s.h > 0.5 ? `<ellipse cx="${(s.x + s.h * 0.6).toFixed(1)}" cy="${(s.y + s.h * 0.8).toFixed(1)}" rx="${30 - Math.min(s.h, 40) * 0.3}" ry="${22 - Math.min(s.h, 40) * 0.2}" class="fly-shadow"/>` : "";
    // Полоски оборотов моторов: направление вращения, при повороте подсвечена ускоренная диагональ.
    const yawOn = Math.abs(s.in.yaw) > 0.2 && s.flip <= 0;
    let bars = `<rect x="8" y="8" width="146" height="${s.yaw0 !== null ? 106 : 95}" rx="6" class="lab-hud"/>`;
    MOTORS.forEach((M, i) => {
      const y = 16 + i * 11;
      const hot = yawOn && (s.in.yaw > 0 ? !M.cw : M.cw);
      bars += svgText(14, y + 7, `М${M.n}${M.cw ? "↻" : "↺"}`, hot ? "lab-small fly-hot" : "lab-small", "start");
      bars += `<rect x="50" y="${y}" width="80" height="7" rx="3" class="lab-track"/><rect x="50" y="${y}" width="${(80 * m[i]).toFixed(1)}" height="7" rx="3" class="lab-fill${hot ? " warn" : ""}"/>`;
    });
    // Курс, расстояние до флажка, разворот для задания.
    const head = Math.round(((((s.yaw + Math.PI / 2) * 180) / Math.PI) % 360 + 360) % 360);
    const dist = Math.hypot(s.x - s.flag[0], s.y - s.flag[1]) / PX_M;
    bars += svgText(14, 70, `высота ${fmt(s.h / 10, 1)} м`, "lab-small", "start");
    bars += svgText(14, 81, `курс ${head}°`, "lab-small", "start");
    bars += svgText(14, 92, `до флажка ${fmt(dist, 1)} м`, "lab-small", "start");
    if (s.yaw0 !== null) bars += svgText(14, 103, `разворот ${Math.min(180, Math.round((Math.abs(s.yaw - s.yaw0) * 180) / Math.PI))}° из ${Math.round((YAW_GOAL * 180) / Math.PI)}°`, "lab-small", "start");
    hud.innerHTML = bars;
    // Вид сбоку или сзади: дрон наклонён на α, тяга T вдоль оси моторов, её доли вверх (T·cos α) и вбок (T·sin α), вес mg вниз.
    const sx = 78, sy = 226;
    // Тангаж виден сбоку (с левого борта, нос справа: вперёд — нос вниз), крен — сзади (вправо — правый борт вниз).
    // Показываем ту плоскость, где наклон больше, со знаком наклона в ней.
    const rollView = s.flip <= 0 && Math.abs(s.tr) > Math.abs(s.tp);
    const al = s.flip > 0 ? flipA : rollView ? s.tr : s.tp;
    const T = Math.min(Math.max(0, total) * 9, 30), ux = Math.sin(al), uy = -Math.cos(al);
    const arrow = (x1, y1, x2, y2, cls) => (Math.hypot(x2 - x1, y2 - y1) > 2 ? `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}" marker-end="url(#fv-arr-${cls === "fv-g" ? "g" : "t"})"/>` : "");
    let sv = `<rect x="8" y="182" width="140" height="72" rx="6" class="lab-hud"/>`;
    sv += svgText(14, 193, rollView ? "вид сзади" : "вид сбоку", "lab-small", "start");
    sv += svgText(18, 242, rollView ? "лев." : "хвост", "lab-small fv-side", "start");
    sv += svgText(138, 242, rollView ? "прав." : "нос", "lab-small fv-side", "end");
    sv += `<line x1="16" y1="246" x2="140" y2="246" class="fv-ground"/>`;
    sv += `<g transform="translate(${sx} ${sy}) rotate(${((al * 180) / Math.PI).toFixed(1)})"><rect x="-16" y="-2.5" width="32" height="5" rx="2" class="fly-body"/><rect x="-18" y="-5" width="7" height="3" rx="1" class="fly-nose"/><rect x="11" y="-5" width="7" height="3" rx="1" class="fly-nose"/></g>`;
    sv += arrow(sx, sy, sx + ux * T, sy + uy * T, "fv-t");
    if (Math.abs(al) > 0.05 && s.flip <= 0) {
      sv += arrow(sx, sy, sx, sy - T * Math.cos(al), "fv-c"); // вверх: T·cos α
      sv += arrow(sx, sy, sx + T * Math.sin(al), sy, "fv-c"); // вбок: T·sin α
    }
    sv += arrow(sx, sy, sx, sy + 18, "fv-g");
    sv += svgText(sx + ux * T + (ux >= 0 ? 5 : -5), sy + uy * T + 3, "T", "lab-small fv-lt", ux >= 0 ? "start" : "end");
    sv += svgText(sx + 5, sy + 20, "mg", "lab-small fv-lg", "start");
    sv += svgText(142, 193, s.flip > 0 ? "кувырок" : `${rollView ? "крен" : "тангаж"} ${Math.round((Math.abs(al) * 180) / Math.PI)}°`, "lab-small", "end");
    sideG.innerHTML = sv;
    if (read.textContent !== msg) read.textContent = msg;
  });
  return { destroy: () => L.stop() };
}
