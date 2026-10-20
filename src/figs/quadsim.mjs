// Физика квадрокоптера и полётник (режим Angle) для стенда «Два радиомоста».
// Твёрдое тело с моментами от винтов, задержкой моторов, касанием стола и страховочным шнуром.
// Полётник: оценка наклона (с ошибкой акселерометра и ориентацией платы), внешний контур угла,
// PID по скорости, микшер Quad X Betaflight, защита Runaway Takeoff. Все величины — СИ (м, с, рад, Н),
// оси «математические»: x — нос, y — вправо от носа (как на сцене), z — вверх.
// Знаки «человеческих» осей: крен вправо — правый бок вниз, тангаж вперёд — нос вниз, рыскание вправо —
// по часовой сверху (как видно на сцене).

export const QUAD = {
  m: 0.65, // кг, 5" на 6S с батареей
  g: 9.81,
  twr: 7, // полный газ — тяга в 7 весов
  I: [0.0028, 0.0028, 0.005], // кг·м²
  kq: 0.012, // реактивный момент винта на 1 Н тяги, м
  tauMotor: 0.035, // с, разгон мотора с винтом
  idle: 0.055, // dshot_idle_value
  arm: 0.084, // м, плечо до мотора по x и y
  propZ: 0.017, // м, плоскость винтов над центром масс
  // Коэффициенты полётника (доля хода моторов на 1 °/с ошибки; угол — °/с заданной скорости на 1° ошибки).
  pid: { kp: 0.0016, ki: 0.02, kd: 0.00004, kpy: 0.004, kiy: 0.1, ang: 8 },
};
// Моторы в номерах Betaflight: 1 — задний правый, 2 — передний правый, 3 — задний левый, 4 — передний левый.
// spin: +1 — по часовой (на сцене угол винта растёт), −1 — против. Props in: 1 и 4 по часовой.
export const MOT = [
  { x: -1, y: 1, spin: 1 },
  { x: 1, y: 1, spin: -1 },
  { x: -1, y: -1, spin: -1 },
  { x: 1, y: -1, spin: 1 },
];
// Микшер Quad X: крен вправо — 3, 4 быстрее; тангаж вперёд — 1, 3 быстрее; рыскание вправо — 2, 3 быстрее.
const MIX = [
  { r: -1, p: 1, y: -1 },
  { r: -1, p: -1, y: 1 },
  { r: 1, p: 1, y: 1 },
  { r: 1, p: -1, y: -1 },
];
// Точки касания со столом (в осях дрона, м): углы батареи снизу, низ лучей под моторами, верх стоек и камеры.
const CONTACTS = [
  [-0.04, -0.017, -0.03], [0.04, -0.017, -0.03], [-0.04, 0.017, -0.03], [0.04, 0.017, -0.03],
  [-0.084, -0.084, -0.003], [0.084, -0.084, -0.003], [-0.084, 0.084, -0.003], [0.084, 0.084, -0.003],
  [-0.044, -0.016, 0.028], [0.034, -0.016, 0.028], [-0.044, 0.016, 0.028], [0.034, 0.016, 0.028], [0.031, 0, 0.044],
];
const ASYM = [1.012, 0.986, 1.004, 0.995];
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
// R — оси дрона в мире по столбцам: R[0] — нос, R[1] — вправо, R[2] — вверх.
const toWorld = (R, l) => add(add(mul(R[0], l[0]), mul(R[1], l[1])), mul(R[2], l[2]));
const toBody = (R, w) => [dot(R[0], w), dot(R[1], w), dot(R[2], w)];
function orthonormalize(R) {
  const f = mul(R[0], 1 / Math.hypot(...R[0]));
  let s = add(R[1], mul(f, -dot(f, R[1])));
  s = mul(s, 1 / Math.hypot(...s));
  return [f, s, cross(f, s)];
}
// Углы для людей (градусы): крен вправо +, тангаж вперёд +, рыскание вправо +.
export function anglesOf(R) {
  const f = R[0], s = R[1], u = R[2];
  return {
    roll: Math.atan2(-s[2], u[2]) / RAD,
    pitch: Math.asin(clamp(-f[2], -1, 1)) / RAD,
    yaw: Math.atan2(f[1], f[0]) / RAD,
  };
}
const yawRateOf = (x) => 70 * x + 600 * x * x * x; // Actual rates: центр 70°/с, максимум 670°/с

// Новый дрон, стоящий на столе: центр масс в cm0 (м).
export function makeQuad(cm0, opts = {}) {
  return {
    pos: [...cm0],
    vel: [0, 0, 0],
    R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    w: [0, 0, 0], // угловая скорость в осях дрона, рад/с
    c: [0, 0, 0, 0], // обороты моторов 0…1 (фактические)
    cmd: [0, 0, 0, 0], // команды полётника по номерам Betaflight
    phys: [0, 0, 0, 0], // команда, пришедшая на каждый физический мотор
    I: [0, 0, 0], // интегралы PID
    dPrev: null,
    sum: [0, 0, 0], // суммы PID (доля полного хода, как pidSum/1000)
    est: { roll: 0, pitch: 0 },
    anchor: opts.anchor || [cm0[0], cm0[1], 0],
    tether: opts.tether || 0.1,
    attach: [0, 0, -0.03],
    taut: false,
    contact: true,
    runaway: { check: true, trigger: 0, stable: 0 },
    t: 0,
  };
}

// Один шаг полётника и физики. inp: { armed, stopped (Motor Stop при газе внизу), ch (каналы, мкс) или null,
// fault: { accOff (°), boardYaw (°), map [4] (выход FC i → физический мотор map[i]), thrust [4] (множитель тяги),
// spin [4] (множитель направления), dead [4] (мотор не крутится), volt (доля тяги от напряжения батареи) } }.
// Возвращает событие "runaway", если полётник сам дизармил дрон.
export function stepQuad(q, inp, dt) {
  const P = QUAD;
  const G = P.pid;
  const F = inp.fault || {};
  let event = null;
  // Нулевой шаг (сцена на паузе или за краем экрана, а ученик нажал тумблер): полётник пересчитывает
  // команды, а физика стоит на месте. Производную PID при этом не считаем — иначе 0/0 и модель навсегда в NaN.
  if (!(dt > 0) || !Number.isFinite(dt)) dt = 0;
  const steps = Math.max(1, Math.ceil(dt / 0.0005));
  const h = dt / steps;
  const Tmax = (P.twr * P.m * P.g) / 4;
  const by = (F.boardYaw || 0) * RAD; // плата повёрнута относительно рамы
  const cb = Math.cos(by), sb = Math.sin(by);
  for (let k = 0; k < steps; k++) {
    q.t += h;
    // ── Полётник ──
    // Гироскоп и оценка наклона — в осях платы. Плата повёрнута на by вокруг вертикали.
    const fB = add(mul(q.R[0], cb), mul(q.R[1], sb)), sB = add(mul(q.R[0], -sb), mul(q.R[1], cb));
    const wB = [q.w[0] * cb + q.w[1] * sb, -q.w[0] * sb + q.w[1] * cb, q.w[2]];
    const meas = { r: -wB[0] / RAD, p: wB[1] / RAD, y: wB[2] / RAD }; // °/с: крен вправо, тангаж вперёд, рыскание вправо
    q.est = { roll: Math.atan2(-sB[2], q.R[2][2]) / RAD - (F.accOff || 0), pitch: Math.asin(clamp(-fB[2], -1, 1)) / RAD };
    const cmd = [0, 0, 0, 0];
    const ch = inp.ch;
    if (inp.armed && ch && !inp.stopped) {
      const thr = clamp((ch.thr - 1000) / 1000, 0, 1);
      const low = ch.thr < 1050;
      const st = { r: clamp((ch.roll - 1500) / 500, -1, 1), p: clamp((ch.pitch - 1500) / 500, -1, 1), y: clamp((ch.yaw - 1500) / 500, -1, 1) };
      // Angle: стик задаёт наклон до 60°, ошибка наклона превращается в заданную скорость.
      const sp = {
        r: clamp(G.ang * (st.r * 60 - q.est.roll), -500, 500),
        p: clamp(G.ang * (st.p * 60 - q.est.pitch), -500, 500),
        y: yawRateOf(st.y),
      };
      // PID по скорости. На газе ниже min_check интеграл сбрасывается (pid_at_min_throttle: P и D работают).
      const e = { r: sp.r - meas.r, p: sp.p - meas.p, y: sp.y - meas.y };
      if (low) q.I = [0, 0, 0];
      else {
        q.I[0] = clamp(q.I[0] + G.ki * e.r * h, -0.4, 0.4);
        q.I[1] = clamp(q.I[1] + G.ki * e.p * h, -0.4, 0.4);
        q.I[2] = clamp(q.I[2] + G.kiy * e.y * h, -0.32, 0.32);
      }
      const dm = q.dPrev && h > 0 ? { r: (meas.r - q.dPrev.r) / h, p: (meas.p - q.dPrev.p) / h } : q.dD || { r: 0, p: 0 };
      q.dD = q.dD ? { r: q.dD.r + (dm.r - q.dD.r) * Math.min(1, h * 250), p: q.dD.p + (dm.p - q.dD.p) * Math.min(1, h * 250) } : dm;
      q.sum = [
        G.kp * e.r + q.I[0] - G.kd * q.dD.r,
        G.kp * e.p + q.I[1] - G.kd * q.dD.p,
        G.kpy * e.y + q.I[2],
      ];
      // Микшер: доля PID ограничена pidsum_limit (0,5; рыскание 0,4), без Airmode — газ от холостых.
      const u = { r: clamp(q.sum[0], -0.5, 0.5), p: clamp(q.sum[1], -0.5, 0.5), y: clamp(q.sum[2], -0.4, 0.4) };
      const mix = MIX.map((m) => m.r * u.r + m.p * u.p + m.y * u.y);
      const hi = Math.max(...mix), lo = Math.min(...mix), range = hi - lo;
      const sc = range > 1 ? 1 / range : 1;
      for (let i = 0; i < 4; i++) cmd[i] = clamp(P.idle + (1 - P.idle) * clamp(thr + mix[i] * sc, 0, 1), P.idle, 1);
      // Runaway Takeoff: до «устойчивого полёта» — если сумма PID ≥ 60 % при вращении > 15°/с (рыскание > 50°/с)
      // дольше 75 мс, полётник дизармит. Устойчивый полёт: газ ≥ 40 % (или ≥ 20 % со стиком ≥ 15 %), PID < 10 %, 0,5 с.
      const R0 = q.runaway;
      if (R0.check) {
        const big = Math.max(Math.abs(q.sum[0]), Math.abs(q.sum[1]), Math.abs(q.sum[2])) >= 0.6;
        const spin = Math.abs(meas.r) > 15 || Math.abs(meas.p) > 15 || Math.abs(meas.y) > 50;
        if (big && spin) {
          R0.trigger += h;
          if (R0.trigger > 0.075) event = "runaway";
        } else R0.trigger = 0;
        const sticks = Math.max(Math.abs(st.r), Math.abs(st.p), Math.abs(st.y)) >= 0.15;
        const calm = Math.max(Math.abs(q.sum[0]), Math.abs(q.sum[1]), Math.abs(q.sum[2])) < 0.1;
        if (((thr >= 0.2 && sticks) || thr >= 0.4) && calm) {
          R0.stable += h;
          if (R0.stable > (thr >= 0.75 ? 0.25 : 0.5)) R0.check = false;
        }
      }
      q.dPrev = meas;
    } else {
      q.I = [0, 0, 0];
      q.sum = [0, 0, 0];
      q.dPrev = null;
      q.dD = null;
    }
    if (event) {
      for (let i = 0; i < 4; i++) cmd[i] = 0;
    }
    q.cmd = cmd;
    // Провода: выход FC i идёт на физический мотор map[i] (при ошибке в ресурсах — не на тот).
    const map = F.map || [0, 1, 2, 3];
    const phys = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) phys[map[i]] = cmd[i];
    q.phys = phys.slice();
    // Мёртвый мотор (или канал ESC): команда доходит, а мотор не крутится.
    if (F.dead) for (let j = 0; j < 4; j++) if (F.dead[j]) phys[j] = 0;
    // ── Моторы и силы ──
    let force = [0, 0, -P.g * P.m], torque = [0, 0, 0];
    const volt = F.volt ?? 1;
    for (let j = 0; j < 4; j++) {
      q.c[j] += (phys[j] - q.c[j]) * Math.min(1, h / P.tauMotor);
      // Настоящие моторы и винты чуть разные (±1–2 %): исправный полётник это незаметно выровняет,
      // а при перепутанной обратной связи именно эта мелочь раскачивает дрон.
      const tf = (F.thrust ? F.thrust[j] : 1) * ASYM[j]; // винт не той стороны или мотор задом наперёд — тяга вниз
      const T = Tmax * volt * q.c[j] * q.c[j] * tf;
      const r = [MOT[j].x * P.arm, MOT[j].y * P.arm, P.propZ];
      const Fb = [0, 0, T];
      torque = add(torque, cross(r, Fb));
      // Реактивный момент: против вращения винта (мотор задом наперёд — момент тоже обратный).
      const sp = MOT[j].spin * (F.spin ? F.spin[j] : 1);
      torque = add(torque, [0, 0, -sp * P.kq * Math.abs(T)]);
      force = add(force, toWorld(q.R, Fb));
    }
    // Сопротивление воздуха и демпфирование вращения.
    force = add(force, mul(q.vel, -0.35));
    torque = add(torque, mul(q.w, -0.0012));
    // Стол: пружина-демпфер в каждой точке касания, трение по столу.
    q.contact = false;
    for (const cp of CONTACTS) {
      const rw = toWorld(q.R, cp);
      const pz = q.pos[2] + rw[2];
      if (pz >= 0) continue;
      q.contact = true;
      const vp = add(q.vel, cross(toWorld(q.R, q.w), rw));
      const n = Math.max(0, -3000 * pz - 30 * vp[2]);
      const vt = Math.hypot(vp[0], vp[1]);
      const ft = Math.min(0.6 * n, 60 * vt);
      const fw = [vt > 1e-9 ? (-vp[0] / vt) * ft : 0, vt > 1e-9 ? (-vp[1] / vt) * ft : 0, n];
      force = add(force, fw);
      torque = add(torque, toBody(q.R, cross(rw, fw)));
    }
    // Шнур от якоря к низу батареи: натянулся — тянет назад (пружина с демпфером).
    const aw = toWorld(q.R, q.attach);
    const ap = add(q.pos, aw);
    const d = [ap[0] - q.anchor[0], ap[1] - q.anchor[1], ap[2] - q.anchor[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    q.taut = L > q.tether;
    if (q.taut) {
      const nrm = mul(d, 1 / L);
      const va = add(q.vel, cross(toWorld(q.R, q.w), aw));
      const ft = mul(nrm, -(800 * (L - q.tether) + 20 * Math.max(0, dot(va, nrm))));
      force = add(force, ft);
      torque = add(torque, toBody(q.R, cross(aw, ft)));
    }
    // Интегрирование.
    q.vel = add(q.vel, mul(force, h / P.m));
    q.pos = add(q.pos, mul(q.vel, h));
    const Iw = [P.I[0] * q.w[0], P.I[1] * q.w[1], P.I[2] * q.w[2]];
    const gyro = cross(q.w, Iw);
    q.w = [q.w[0] + ((torque[0] - gyro[0]) / P.I[0]) * h, q.w[1] + ((torque[1] - gyro[1]) / P.I[1]) * h, q.w[2] + ((torque[2] - gyro[2]) / P.I[2]) * h];
    // R' = R·[ω]×: каждая ось дрона поворачивается с угловой скоростью ω (в мире).
    const ww = toWorld(q.R, q.w);
    q.R = orthonormalize(q.R.map((ax) => add(ax, mul(cross(ww, ax), h))));
    if (event) break;
  }
  // Скорости в «человеческих» осях (°/с) — для подписей и выбора ракурса.
  q.rates = { r: -q.w[0] / RAD, p: q.w[1] / RAD, y: q.w[2] / RAD };
  return event;
}
