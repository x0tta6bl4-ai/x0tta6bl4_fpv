// Эксперимент «Как мозг держит угол» (гл. 4): одна ось крена дрона, пять регуляторов.
// Модель: дрон — тело, которое вращается (момент инерции J), моторы отвечают с задержкой,
// их сила ограничена, воздух немного тормозит вращение. Шаг расчёта 1 мс, 2 секунды полёта.
import { fmt, clamp, PALETTE, TAU } from "./kit.mjs";

export const DT = 0.001; // шаг расчёта, с (полётник в Betaflight считает 4000 раз в секунду, нам хватает 1000)
export const T_END = 2; // длительность опыта, с
export const NSTEP = Math.round(T_END / DT);
export const REC = 5; // запись для экрана: каждые 5 мс
export const J = 0.003; // момент инерции по крену, кг·м² (оценка для 5-дюймового дрона)
export const A_MAX = 200; // наибольшее угловое ускорение от моторов, рад/с² (момент J·A_MAX = 0,6 Н·м); оценка с запасом: у гоночного 5″ до 2–4 раз больше
export const AERO = 10; // торможение вращения воздухом и пропеллерами, 1/с (оценка)
export const K0 = { kp: 150, ki: 300, kd: 10 }; // коэффициенты «×1» в единицах ускорения: 1/с², 1/с³, 1/с
export const RAMP = 0.08; // стик нельзя сдвинуть мгновенно: команда нарастает за 80 мс
export const D_LPF = 90; // фильтр D в «Betaflight», Гц
export const RELAX_HZ = 3, RELAX_TH = 0.03; // «I-term relax»: пока стик движется, память почти не копит
export const I_LIM = 0.5 * A_MAX; // предел памяти: не больше половины силы моторов
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const JIT_FROM = Math.round(0.8 / DT); // дрожь моторов меряем с 0,8 с, когда манёвр уже закончен
const f1 = (v) => fmt(Math.abs(v) < 0.05 ? 0 : v, 1); // без «−0,0»

// Шум гироскопа: вибрация моторов (170 Гц) плюс случайный шум. Один и тот же для всех методов.
function makeNoise(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
  const gyro = new Float32Array(NSTEP), acc = new Float32Array(NSTEP);
  for (let i = 0; i < NSTEP; i++) {
    gyro[i] = 0.7 * Math.sin(TAU * 170 * i * DT + 0.3) + 0.7 * gauss();
    acc[i] = gauss();
  }
  return { gyro, acc };
}
const NOISE = makeNoise(20261014);

// Команда стика: плавный переход от 0 к amp за RAMP секунд. Возвращает угол, скорость и ускорение цели.
// (Один и тот же объект на каждый вызов — так расчёт не мусорит память 2000 раз за опыт.)
const CMD = { sp: 0, rate: 0, acc: 0 };
export function stickCommand(scene, t) {
  const x = (t - scene.tStep) / RAMP;
  const A = (scene.amp || 0) * D2R;
  CMD.rate = CMD.acc = 0;
  if (!A || x <= 0) CMD.sp = 0;
  else if (x >= 1) CMD.sp = A;
  else {
    CMD.sp = (A * (1 - Math.cos(Math.PI * x))) / 2;
    CMD.rate = ((A * Math.PI) / (2 * RAMP)) * Math.sin(Math.PI * x);
    CMD.acc = ((A * Math.PI * Math.PI) / (2 * RAMP * RAMP)) * Math.cos(Math.PI * x);
  }
  return CMD;
}

// Помеха: ветер (появляется в момент tGust и держится) или смещённый груз (с самого начала). Толкает влево.
export function disturbance(P, scene, t) {
  const a = (-P.wind / 100) * A_MAX;
  if (scene.dist === "const") return a;
  if (t < scene.tGust) return 0;
  return a * Math.min(1, (t - scene.tGust) / 0.03);
}

// Физика оси крена: моторы догоняют команду с задержкой, угловое ускорение = (моторы + помеха − воздух).
export function rollPlant(st, u, aDist, lagMs) {
  const uSat = clamp(u, -A_MAX, A_MAX); // моторы не дадут больше 100 %
  st.am += ((uSat - st.am) * DT) / (lagMs / 1000); // задержка моторов: первый порядок
  st.w += (st.am + aDist - AERO * st.w) * DT; // ω — скорость вращения, рад/с
  st.th += st.w * DT; // θ — угол крена, рад (полунеявный Эйлер: сначала скорость, потом угол)
  return uSat;
}

// ─── Регуляторы. Вход: ошибка угла err = цель − угол, gyro — скорость вращения от гироскопа. Выход: желаемое ускорение. ───

// P — пружина: тянет к цели тем сильнее, чем больше ошибка.
export function ctrlP(c, s, k) {
  return k.kp * s.err;
}

// PI — пружина + память: память копит ошибку, пока она есть, и так перебарывает постоянный ветер.
export function ctrlPI(c, s, k, dt) {
  c.i += k.ki * s.err * dt;
  return k.kp * s.err + c.i;
}

// PD — пружина + амортизатор: D тормозит вращение (смотрит на гироскоп), чтобы не проскочить цель.
export function ctrlPD(c, s, k) {
  return k.kp * s.err - k.kd * s.gyro;
}

// PID «как в Betaflight»: те же три буквы + фильтр на D, предел памяти и «I-term relax».
export function ctrlBetaflight(c, s, k, dt) {
  c.d += (s.gyro - c.d) * (dt / (dt + 1 / (TAU * D_LPF))); // фильтр D первого порядка: ослабляет быструю дрожь (на 170 Гц примерно в 2,5 раза)
  c.spLow += (s.sp - c.spLow) * (dt / (dt + 1 / (TAU * RELAX_HZ)));
  const relax = Math.max(0, 1 - Math.abs(s.sp - c.spLow) / RELAX_TH); // стик движется → память «отдыхает»
  c.i = clamp(c.i + k.ki * s.err * dt * relax, -I_LIM, I_LIM);
  return k.kp * s.err + c.i - k.kd * c.d;
}

// PID + feedforward: регулятор знает, какой поворот просит стик, и сразу даёт нужный момент, не дожидаясь ошибки.
export function ctrlFeedforward(c, s, k, dt) {
  const ff = s.acc + (AERO + k.kd) * s.rate; // ускорение цели + компенсация торможения воздухом и D
  return ctrlBetaflight(c, s, k, dt) + ff;
}

export function gains(P) {
  return { kp: K0.kp * P.kp, ki: K0.ki * P.ki, kd: K0.kd * P.kd };
}

// Общий опыт: одна и та же физика, одни и те же команды и помехи — меняется только регулятор.
export function simulate(P, scene, ctrl, record) {
  const k = gains(P);
  const st = { th: 0, w: 0, am: 0 };
  const c = { i: 0, d: 0, spLow: 0 };
  const nz = scene.noise || 0;
  let est = 0, gyro = 0; // угол, который «видит» полётник (гироскоп + акселерометр), и показание гироскопа
  let sumErr = 0, uLow = 0, jit = 0, maxDev = 0, peak = -Infinity, lastOut = -1, flipped = false, tail = 0;
  const amp = scene.amp || 0;
  const tEv = amp ? scene.tStep : scene.dist === "const" ? 0 : scene.tGust;
  const iEv = Math.round(tEv / DT);
  const iEnd = amp && scene.dist !== "const" && P.wind ? Math.round(scene.tGust / DT) : NSTEP; // порыв после наклона: успокоение после стика меряем до порыва
  const band = amp ? Math.max(1, 0.05 * amp) : 1; // «успокоился» — ошибка меньше 1° (или 5 % от наклона)
  const nRec = record ? NSTEP / REC + 1 : 0;
  const tr = record ? { th: new Float32Array(nRec), sp: new Float32Array(nRec), u: new Float32Array(nRec) } : null;
  const sens = { err: 0, gyro: 0, sp: 0, rate: 0, acc: 0 }; // что видит полётник на этом шаге
  const dLow = DT / (DT + 1 / (TAU * 40));
  let cmd = stickCommand(scene, 0);
  for (let i = 0; i < NSTEP; i++) {
    const t = i * DT;
    sens.err = cmd.sp - est;
    sens.gyro = gyro;
    sens.sp = cmd.sp;
    sens.rate = cmd.rate;
    sens.acc = cmd.acc;
    const u = rollPlant(st, ctrl(c, sens, k, DT), disturbance(P, scene, t), P.lag);
    gyro = st.w + nz * NOISE.gyro[i];
    est += gyro * DT; // угол из гироскопа…
    est += (st.th + 0.03 * nz * NOISE.acc[i] - est) * 0.01; // …понемногу поправляем по акселерометру
    cmd = stickCommand(scene, t + DT);
    const spN = cmd.sp;
    const e = (spN - st.th) * R2D;
    const ae = Math.min(Math.abs(e), 180);
    sumErr += ae;
    if (Math.abs(st.th) > Math.PI / 2) flipped = true;
    uLow += (u - uLow) * dLow; // всё, что быстрее ~40 Гц, — дрожь, а не манёвр
    if (i >= JIT_FROM) jit += (u - uLow) ** 2;
    if (i >= iEv) {
      if (ae > band && i < iEnd) lastOut = i;
      if (amp) peak = Math.max(peak, st.th * R2D);
      else maxDev = Math.max(maxDev, ae);
    }
    if (i >= NSTEP - 300) tail += e;
    if (record && (i + 1) % REC === 0) {
      const r = (i + 1) / REC;
      tr.th[r] = clamp(st.th * R2D, -180, 180);
      tr.sp[r] = spN * R2D;
      tr.u[r] = (u / A_MAX) * 100;
    }
  }
  return {
    value: sumErr / NSTEP,
    overshoot: amp ? Math.max(0, ((peak - amp) / amp) * 100) : NaN,
    maxDev,
    settle: lastOut >= iEnd - 30 ? NaN : Math.max(0, lastOut + 1 - iEv) * Math.round(DT * 1000),
    steady: tail / 300,
    jitter: (Math.sqrt(jit / (NSTEP - JIT_FROM)) / A_MAX) * 100,
    flipped,
    trace: tr,
  };
}

// Подпись под числом: перерегулирование, время успокоения, остаточная ошибка, дрожь моторов.
function noteOf(r, scene) {
  const parts = [];
  if (r.flipped) parts.push("угол ушёл за 90° — дрон кувыркнулся бы");
  if (scene.noise) parts.push(`дрожь моторов ±${fmt(r.jitter, 1)} %`);
  if (scene.amp) parts.push(`проскок ${fmt(r.overshoot, 0)} %`);
  else parts.push(`сдуло до ${fmt(r.maxDev, 1)}°`);
  parts.push(Number.isFinite(r.settle) ? `успокоился за ${fmt(r.settle)} мс` : "не успокоился за 2 с");
  parts.push(`в конце ошибка ${f1(r.steady)}°`);
  return parts.join(" · ");
}
function runWith(ctrl) {
  return (P, scene) => {
    const r = simulate(P, scene, ctrl, true);
    return { ...r, note: noteOf(r, scene) };
  };
}
function sweepWith(ctrl) {
  return (P, scene) => ({ value: simulate(P, scene, ctrl, false).value });
}

// Числа для объяснений: «с твоими числами».
const N_M = (a) => fmt(J * a, 3); // ускорение → момент, Н·м
function springLine(P, scene) {
  const k = gains(P);
  const e0 = (scene.amp || 10) * D2R;
  return `Kp = ${K0.kp} × ${fmt(P.kp, 1)} = <b>${fmt(k.kp)}</b> 1/с², в моменте Kp·J = ${N_M(k.kp)} Н·м на радиан. ${scene.amp ? "Ошибка" : "Например, при ошибке"} ${fmt(e0 * R2D)}° = ${fmt(e0, 2)} рад → P сразу просит ${N_M(k.kp * e0)} Н·м (${fmt(Math.min(100, ((k.kp * e0) / A_MAX) * 100))} % силы моторов, максимум ${N_M(A_MAX)} Н·м).`;
}
function windLine(P, scene) {
  const k = gains(P);
  const cg = scene.dist === "const";
  if (!P.wind) return `<p>${cg ? "Груза сейчас нет. Добавь груз" : "Ветра сейчас нет. Добавь ветер"} ползунком — увидишь, держит ли метод угол.</p>`;
  const aw = (P.wind / 100) * A_MAX;
  return `<p>${cg ? "Груз" : "Ветер"} ${fmt(P.wind)} % = ${N_M(aw)} Н·м. Одна пружина уравновесит его, только когда ошибка станет ${N_M(aw)} ÷ ${N_M(k.kp)} = <b>${fmt((aw / k.kp) * R2D, 1)}°</b> — ${aw / k.kp > Math.PI / 2 ? "это больше 90°: дрон перевернётся раньше, чем пружина его удержит" : "дрон так и висит с наклоном"}.</p>`;
}
const total = (r) => `<p>Итог: средняя ошибка <b>${fmt(r.value, 1)}°</b>${r.note ? ` (${r.note})` : ""}.</p>`;

const METHODS = [
  {
    id: "p",
    name: "Только P (пружина)",
    short: "тянет к цели, но качается",
    eq: `<p class="mx-f">u = Kp · e</p><p>e — ошибка: насколько угол отличается от цели. u — сколько поворачивающей силы (момента) просим у моторов. Больше ошибка — сильнее тянет, как пружина. Тормоза нет: пружина с грузом раскачивается.</p>`,
    explain: (P, r, scene) => `<p>${springLine(P, scene)}</p>${windLine(P, scene)}${total(r)}`,
    assume: "одна ось (крен); один регулятор на угол — в Betaflight их два, вложенных",
    run: runWith(ctrlP),
    sweep: sweepWith(ctrlP),
    src: ["ctrlP", "rollPlant"],
    refs: [
      { page: 20, quote: "Исправляет ошибку прямо сейчас: больше ошибка — сильнее исправление" },
      { page: 21, quote: "PID: P пружина, I память, D амортизатор." },
    ],
    review: { status: "simplified", tol: "в 24 тестах (ветер 5–20 %, Kp ×0,6…×1,4, у P и у PD) остаточная ошибка в симуляции отличается от формулы «ветер ÷ Kp» не больше чем на 0,14°", note: "Формула u = Kp·e — это слова книги «больше ошибка — сильнее исправление», записанные числом. Книга объясняет P, I, D словами и для скорости вращения (Acro); здесь — то же правило для угла, коэффициенты примерные." },
  },
  {
    id: "pi",
    name: "PI (пружина + память)",
    short: "убирает снос от ветра",
    eq: `<p class="mx-f">u = Kp · e + Ki · ∫e dt</p><p>∫e dt — «память»: сумма ошибки за всё время. Пока дрон висит криво, память растёт и добавляет момент, пока снос не исчезнет.</p>`,
    explain: (P, r, scene) => {
      const k = gains(P);
      return `<p>${springLine(P, scene)}</p><p>Ki = ${K0.ki} × ${fmt(P.ki, 1)} = <b>${fmt(k.ki)}</b> 1/с³: ошибка 1° за 1 с добавляет в память ${N_M(k.ki * D2R)} Н·м.</p>${P.wind ? `<p>Чтобы перебороть ${scene.dist === "const" ? "груз" : "ветер"} ${fmt(P.wind)} %, память должна накопить ${N_M((P.wind / 100) * A_MAX)} Н·м — тогда ошибка уходит в ноль.</p>` : ""}${total(r)}`;
    },
    assume: "без амортизатора: память добавляет запаздывание, и раскачка становится сильнее, чем у одной пружины",
    run: runWith(ctrlPI),
    sweep: sweepWith(ctrlPI),
    src: ["ctrlPI"],
    refs: [
      { page: 20, quote: "Исправляет накопившийся снос: ветер, смещённый центр тяжести" },
      { page: 86, quote: "I — накопленный снос" },
    ],
    review: { status: "simplified", tol: "под ветром 10 % ошибка к концу опыта 0,1° против 7,6° у P и PD; в сценах со стиком PI к концу 2 с ещё качается: средняя ошибка за последние 0,3 с до 1,5°, отклонение до 5,9° (размах до 10,8°)", note: "Книга объясняет P, I, D словами и для скорости вращения (Acro); здесь — то же правило для угла, коэффициенты примерные. Как в книге, память убирает постоянный снос. Видно и то, о чём книга молчит: без D память раскачивает дрон ещё сильнее." },
  },
  {
    id: "pd",
    name: "PD (пружина + амортизатор)",
    short: "не проскакивает цель",
    eq: `<p class="mx-f">u = Kp · e − Kd · ω</p><p>ω — скорость вращения, её меряет гироскоп. D давит против вращения: чем быстрее дрон поворачивается, тем сильнее тормоз. Так он подходит к цели и не проскакивает.</p>`,
    explain: (P, r, scene) => {
      const k = gains(P);
      return `<p>${springLine(P, scene)}</p><p>Kd = ${K0.kd} × ${fmt(P.kd, 1)} = <b>${fmt(k.kd)}</b> 1/с: при вращении 100 °/с (${fmt(100 * D2R, 2)} рад/с) D тормозит моментом ${N_M(k.kd * 100 * D2R)} Н·м.</p>${windLine(P, scene)}${total(r)}`;
    },
    assume: "D без фильтра: весь шум гироскопа идёт прямо в моторы",
    run: runWith(ctrlPD),
    sweep: sweepWith(ctrlPD),
    src: ["ctrlPD"],
    refs: [
      { page: 20, quote: "Притормаживает, чтобы не проскочить цель" },
      { page: 86, quote: "D — гасит проскок." },
    ],
    review: { status: "simplified", tol: "проскок при наклоне на 30°: у P 43 %, у PD 4 %; под ветром 10 % ошибка остаётся 7,6°, как у P", note: "Книга объясняет P, I, D словами и для скорости вращения (Acro); здесь — то же правило для угла, коэффициенты примерные. Как в книге, амортизатор гасит проскок. Снос от ветра D не лечит — это работа I." },
  },
  {
    id: "bf",
    name: "PID (как в Betaflight)",
    short: "все три + фильтр D",
    eq: `<p class="mx-f">u = Kp · e + Ki · ∫e dt − Kd · ω<sub>фильтр</sub></p><p>Пружина, память и амортизатор вместе. Плюс три приёма из Betaflight: фильтр на D (ослабляет дрожь гироскопа), предел памяти и «отдых памяти», пока стик движется (I-term relax), — чтобы память не накопила лишнего и дрон не проскочил.</p>`,
    explain: (P, r, scene) => {
      const k = gains(P);
      return `<p>Kp = <b>${fmt(k.kp)}</b>, Ki = <b>${fmt(k.ki)}</b>, Kd = <b>${fmt(k.kd)}</b> (в моментах: ${N_M(k.kp)} Н·м/рад, ${N_M(k.ki)} Н·м/(рад·с), ${N_M(k.kd)} Н·м·с/рад).</p><p>Фильтр D пропускает медленные изменения, а быструю дрожь ослабляет: на 170 Гц примерно в 2,5 раза. Память не больше ${N_M(I_LIM)} Н·м.</p>${total(r)}`;
    },
    assume: "один регулятор на угол (как режим Angle), а не два вложенных; фильтр — одно звено вместо набора фильтров Betaflight",
    run: runWith(ctrlBetaflight),
    sweep: sweepWith(ctrlBetaflight),
    src: ["ctrlBetaflight"],
    refs: [
      { page: 19, quote: "Сотни и тысячи раз в секунду полётник сравнивает, как дрон должен вращаться (команда стика) и как он вращается на самом деле (гироскоп). Разницу (ошибку) он исправляет оборотами моторов." },
      { page: 21, quote: "Гироскоп чувствует любую дрожь. Вибрация моторов для него — шум, будто дрон всё время дёргают, и полётник «исправляет» несуществующие движения: моторы греются, дрон дрожит." },
      { page: 21, quote: "основную вибрацию убирают ещё и фильтры в прошивке и балансировка пропов" },
    ],
    review: { status: "simplified", tol: "проскок при наклоне на 30°: 5 % против 29 % у PID без «отдыха памяти»; при шумном гироскопе дрожь моторов в 2,3–2,4 раза меньше, чем у PD без фильтра (5 тестов, Kd ×0,5…×3)", note: "Книга объясняет PID словами и говорит про фильтры. Устройство фильтра D, предела памяти и «отдыха памяти» — как в Betaflight, а числа подобраны под эту модель (в Betaflight: отдых 15 Гц, фильтр D 75–150 Гц)." },
  },
  {
    id: "ff",
    name: "PID + feedforward (сверх книги)",
    short: "момент сразу по стику",
    dash: true,
    eq: `<p class="mx-f">u = PID + θ̈<sub>цели</sub> + (b + Kd) · θ̇<sub>цели</sub></p><p>Feedforward — «упреждение»: регулятор знает, как быстро ты двигаешь стик, и сразу даёт нужный момент, не дожидаясь, пока появится ошибка. b — торможение воздухом.</p>`,
    explain: (P, r, scene) => {
      const k = gains(P);
      const a = scene.amp ? ((scene.amp * D2R * Math.PI * Math.PI) / (2 * RAMP * RAMP)) : 0;
      return scene.amp
        ? `<p>Стик проходит ${fmt(scene.amp)}° за ${fmt(RAMP * 1000)} мс. В начале движения цель разгоняется с ускорением ${fmt(a)} рад/с² — feedforward сразу просит ${N_M(Math.min(a, A_MAX))} Н·м${a > A_MAX ? " (упирается в предел моторов)" : ""}, ещё до того, как P заметит ошибку. Пока цель вращается, воздух (b = ${AERO} 1/с) и амортизатор D тормозят и нужное вращение — добавка (b + Kd) × θ̇ = (${AERO} + ${fmt(k.kd)}) × θ̇ заранее возмещает этот тормоз.</p>${total(r)}`
        : `<p>Стик не двигается — feedforward молчит, работает обычный PID.</p>${total(r)}`;
    },
    assume: "регулятор точно знает J и торможение воздухом; задержку моторов не предсказывает",
    run: runWith(ctrlFeedforward),
    sweep: sweepWith(ctrlFeedforward),
    src: ["ctrlFeedforward", "stickCommand"],
    refs: [],
    review: { status: "beyond", tol: "в 36 тестах (3 сцены со стиком × Kp ×0,6…×1,5 × задержка моторов 20–60 мс) средняя ошибка в 1,4–2,1 раза меньше, чем у того же PID без упреждения; хуже не было ни разу", note: "Feedforward в книге нет, это настройка Betaflight. Здесь он сделан как «обратная модель» дрона: какой момент нужен, чтобы повторить движение стика." },
  },
];
METHODS.forEach((m, i) => (m.color = m.color || PALETTE[i % PALETTE.length]));

// ─── Экран: кривые угла по времени для всех методов + дрон сбоку, который повторяет выбранный метод. ───
export function createStage(canvas, { fitCanvas }) {
  let play = 0, hold = 0, spin = 0, streak = 0;
  const root = typeof canvas.closest === "function" ? canvas.closest(".mx") : null;
  const isOn = (id) => {
    const el = root && root.querySelector(`[data-on="${id}"]`);
    return !el || el.checked;
  };
  const at = (arr, t) => {
    const x = clamp(t / (REC * DT), 0, arr.length - 1), i = Math.floor(x), f = x - i;
    return i + 1 < arr.length ? arr[i] + (arr[i + 1] - arr[i]) * f : arr[i];
  };
  return {
    reset() {
      play = 0;
      hold = 0;
    },
    frame(dt, P, results, scene, focus, calm) {
      // На узком экране холсту нужна высота побольше: график сверху, дрон снизу.
      const cssW = canvas.clientWidth; // ширина в раскладке (без учёта увеличения)
      const wantH = cssW && cssW < 560 ? `${Math.round(cssW * 0.9)}px` : "";
      if (canvas.style.height !== wantH) canvas.style.height = wantH;
      const { w, h, dpr } = fitCanvas(canvas);
      const g = canvas.getContext("2d");
      if (calm) play = T_END;
      else if (play >= T_END) {
        hold += dt;
        if (hold > 1.2) {
          play = 0;
          hold = 0;
        }
      } else play = Math.min(T_END, play + dt * 0.5); // замедленный повтор: ×0,5
      if (!calm) {
        spin += dt * 40;
        streak += dt;
      }
      // Фон-экран.
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#070b16");
      bg.addColorStop(1, "#0b1020");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const narrow = w < 560 * dpr;
      // Слева сверху — угол, под ним полоска «команда моторам», справа (или снизу на телефоне) — дрон.
      const top = (narrow ? 100 : 68) * dpr, bottom = narrow ? h * 0.64 - 20 * dpr : h - 28 * dpr;
      const gx = 46 * dpr, gw = (narrow ? w : w * 0.62) - gx - 12 * dpr;
      const gh = narrow ? bottom - top : (bottom - top) * 0.76; // на телефоне полоску моторов не рисуем — мало места
      const G = { x: gx, y: top, w: gw, h: gh };
      const U = narrow ? { x: gx, y: top + gh, w: gw, h: 0 } : { x: gx, y: top + gh + 16 * dpr, w: gw, h: bottom - top - gh - 16 * dpr };
      const D = narrow ? { x: 0, y: h * 0.64, w, h: h * 0.36 } : { x: w * 0.62, y: 0, w: w * 0.38, h };
      const list = METHODS.filter((m) => isOn(m.id) && results[m.id] && results[m.id].trace);
      // Диапазон углов.
      let lo = 0, hi = scene.amp || 5;
      for (const m of list) {
        const tr = results[m.id].trace;
        for (let i = 0; i < tr.th.length; i += 2) {
          lo = Math.min(lo, tr.th[i]);
          hi = Math.max(hi, tr.th[i]);
        }
      }
      lo = Math.max(-90, lo);
      hi = Math.min(90, hi);
      const pad = (hi - lo) * 0.1 + 1;
      lo -= pad;
      hi += pad;
      const X = (t) => G.x + (t / T_END) * G.w, Y = (a) => G.y + (1 - (clamp(a, lo, hi) - lo) / (hi - lo)) * G.h;
      // Сетка и подписи.
      g.font = `${10.5 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
      g.lineWidth = dpr;
      g.strokeStyle = "rgba(140,170,255,.10)";
      g.fillStyle = "rgba(200,215,255,.55)";
      const span = hi - lo, stp = span > 120 ? 30 : span > 60 ? 20 : span > 25 ? 10 : 5;
      g.textAlign = "right";
      g.textBaseline = "middle";
      for (let v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) {
        g.beginPath();
        g.moveTo(G.x, Y(v));
        g.lineTo(G.x + G.w, Y(v));
        g.stroke();
        g.fillText(`${fmt(v)}°`, G.x - 6 * dpr, Y(v));
      }
      g.textAlign = "center";
      g.textBaseline = "top";
      for (let t = 0; t <= T_END + 1e-9; t += 0.5) {
        g.beginPath();
        g.moveTo(X(t), G.y);
        g.lineTo(X(t), U.y + U.h);
        g.stroke();
        g.fillText(`${fmt(t, 1)} с`, X(t), U.y + U.h + 5 * dpr);
      }
      g.textAlign = "left";
      g.fillText("угол крена", G.x + 4 * dpr, G.y - 16 * dpr);
      // Где действует помеха.
      if (P.wind > 0) {
        const t0 = scene.dist === "const" ? 0 : scene.tGust;
        g.fillStyle = "rgba(77,171,247,.07)";
        g.fillRect(X(t0), G.y, X(T_END) - X(t0), G.h);
        g.fillStyle = "rgba(116,192,252,.75)";
        g.textAlign = "right";
        g.fillText(scene.dist === "const" ? `груз ${fmt(P.wind)} %` : `← ветер ${fmt(P.wind)} %`, G.x + G.w - 4 * dpr, G.y - 16 * dpr);
      }
      // Цель — то, что просит стик (пунктир).
      const any = list[0] && results[list[0].id].trace;
      if (any) {
        g.strokeStyle = "rgba(255,255,255,.75)";
        g.lineWidth = 1.5 * dpr;
        g.setLineDash([6 * dpr, 5 * dpr]);
        g.beginPath();
        for (let i = 0; i < any.sp.length; i++) (i ? g.lineTo : g.moveTo).call(g, X(i * REC * DT), Y(any.sp[i]));
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = "rgba(255,255,255,.8)";
        g.textAlign = "right";
        g.textBaseline = "bottom";
        g.fillText("цель (стик)", G.x + G.w - 4 * dpr, Y(any.sp[any.sp.length - 1]) - 4 * dpr);
      }
      // Кривые методов: выбранный — ярче, со свечением, «рисуется» вместе с повтором.
      g.lineJoin = "round";
      const path = (tr, upto) => {
        g.beginPath();
        const n = Math.min(tr.th.length - 1, Math.floor(upto / (REC * DT)));
        for (let i = 0; i <= n; i++) (i ? g.lineTo : g.moveTo).call(g, X(i * REC * DT), Y(tr.th[i]));
        if (upto < T_END) g.lineTo(X(upto), Y(at(tr.th, upto)));
        g.stroke();
      };
      for (const m of list) {
        if (m.id === focus) continue;
        g.strokeStyle = m.color;
        g.globalAlpha = 0.55;
        g.lineWidth = 1.6 * dpr;
        g.setLineDash(m.dash ? [5 * dpr, 4 * dpr] : []);
        path(results[m.id].trace, T_END);
      }
      g.setLineDash([]);
      g.globalAlpha = 1;
      const fm = METHODS.find((m) => m.id === focus);
      const ftr = results[focus] && results[focus].trace;
      if (fm && ftr && isOn(focus)) {
        g.strokeStyle = fm.color;
        g.globalAlpha = 0.25;
        g.lineWidth = 2 * dpr;
        path(ftr, T_END);
        g.globalAlpha = 1;
        g.lineWidth = 3.2 * dpr;
        g.shadowColor = fm.color;
        g.shadowBlur = 12 * dpr;
        path(ftr, play);
        g.beginPath();
        g.fillStyle = fm.color;
        g.arc(X(play), Y(at(ftr.th, play)), 5 * dpr, 0, TAU);
        g.fill();
        g.shadowBlur = 0;
      }
      // Полоска «команда моторам» выбранного метода: шум гироскопа, пропущенный через D, виден как «ворс».
      if (U.h > 0) {
        g.fillStyle = "rgba(255,255,255,.03)";
        g.fillRect(U.x, U.y, U.w, U.h);
        const UY = (v) => U.y + U.h / 2 - (clamp(v, -50, 50) / 50) * (U.h / 2); // шкала ±50 % — чтобы дрожь была видна
        g.strokeStyle = "rgba(255,255,255,.18)";
        g.beginPath();
        g.moveTo(U.x, UY(0));
        g.lineTo(U.x + U.w, UY(0));
        g.stroke();
        if (fm && ftr) {
          g.strokeStyle = fm.color;
          g.lineWidth = 1.2 * dpr;
          g.globalAlpha = 0.9;
          g.beginPath();
          for (let i = 0; i < ftr.u.length; i++) (i ? g.lineTo : g.moveTo).call(g, X(i * REC * DT), UY(ftr.u[i]));
          g.stroke();
          g.globalAlpha = 1;
        }
        g.fillStyle = "rgba(200,215,255,.55)";
        g.font = `${9.5 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
        g.textAlign = "right";
        g.textBaseline = "middle";
        g.fillText("±50 %", U.x - 6 * dpr, U.y + U.h / 2);
        g.textAlign = "left";
        g.textBaseline = "top";
        g.fillText("команда моторам (выбранный метод)", U.x + 4 * dpr, U.y + 2 * dpr);
      }
      // Бегунок времени.
      g.strokeStyle = "rgba(255,255,255,.25)";
      g.lineWidth = dpr;
      g.beginPath();
      g.moveTo(X(play), G.y);
      g.lineTo(X(play), U.y + U.h);
      g.stroke();

      // ── Дрон сбоку. ──
      const cx = D.x + D.w * (narrow ? 0.36 : 0.5), cy = D.y + D.h * (narrow ? 0.58 : 0.46);
      const L = narrow ? Math.min(D.w * 0.26, D.h * 0.42) : Math.min(D.w * 0.36, D.h * 0.3);
      if (!narrow) {
        g.strokeStyle = "rgba(140,170,255,.12)";
        g.beginPath();
        g.moveTo(D.x, 16 * dpr);
        g.lineTo(D.x, h - 16 * dpr);
        g.stroke();
      }
      const th = ftr ? at(ftr.th, play) : 0, sp = ftr ? at(ftr.sp, play) : 0, u = ftr ? at(ftr.u, play) : 0;
      // Горизонт.
      g.strokeStyle = "rgba(255,255,255,.15)";
      g.setLineDash([3 * dpr, 5 * dpr]);
      g.beginPath();
      g.moveTo(cx - L * 1.3, cy);
      g.lineTo(cx + L * 1.3, cy);
      g.stroke();
      g.setLineDash([]);
      // Ветер дует справа налево и кренит дрон влево (помеха в модели отрицательная).
      const tNow = play;
      const windOn = P.wind > 0 && (scene.dist === "const" || tNow >= scene.tGust);
      if (windOn && scene.dist !== "const") {
        g.strokeStyle = "rgba(116,192,252,.55)";
        g.lineWidth = 1.5 * dpr;
        for (let j = 0; j < 6; j++) {
          const yy = cy - L * 0.9 + j * L * 0.36;
          const ph = ((streak * 0.9 + j * 0.37) % 1) * D.w;
          const x0 = D.x + D.w - ph;
          g.globalAlpha = 0.25 + 0.5 * Math.min(1, P.wind / 20);
          g.beginPath();
          g.moveTo(x0, yy);
          g.lineTo(x0 + (20 + P.wind) * dpr, yy);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      // Цель: призрак дрона.
      g.save();
      g.translate(cx, cy);
      g.rotate(sp * D2R);
      g.strokeStyle = "rgba(255,255,255,.4)";
      g.setLineDash([4 * dpr, 4 * dpr]);
      g.lineWidth = 1.5 * dpr;
      g.strokeRect(-L, -4 * dpr, 2 * L, 8 * dpr);
      g.setLineDash([]);
      g.restore();
      // Сам дрон.
      const col = fm ? fm.color : "#4dabf7";
      const shake = scene.noise && !calm ? (Math.random() - 0.5) * 2.4 * dpr * scene.noise : 0;
      g.save();
      g.translate(cx, cy + shake);
      g.rotate(th * D2R);
      g.fillStyle = "#1a2236";
      g.strokeStyle = col;
      g.lineWidth = 2 * dpr;
      g.shadowColor = col;
      g.shadowBlur = 10 * dpr;
      g.beginPath();
      g.rect(-L, -3 * dpr, 2 * L, 6 * dpr);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      // Полётник посередине.
      g.fillStyle = "#0f1626";
      g.fillRect(-16 * dpr, -12 * dpr, 32 * dpr, 12 * dpr);
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.lineWidth = dpr;
      g.strokeRect(-16 * dpr, -12 * dpr, 32 * dpr, 12 * dpr);
      g.fillStyle = col;
      g.font = `600 ${8.5 * dpr}px "IBM Plex Mono", monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("FC", 0, -6 * dpr);
      // Груз.
      if (scene.dist === "const" && P.wind > 0) {
        const gx = -L * 0.62, sz = (10 + P.wind * 0.5) * dpr;
        g.strokeStyle = "rgba(255,255,255,.5)";
        g.beginPath();
        g.moveTo(gx, 3 * dpr);
        g.lineTo(gx, 14 * dpr);
        g.stroke();
        g.fillStyle = "#fcc419";
        g.shadowColor = "#fcc419";
        g.shadowBlur = 8 * dpr;
        g.fillRect(gx - sz / 2, 14 * dpr, sz, sz);
        g.shadowBlur = 0;
        g.fillStyle = "#111";
        g.fillText("груз", gx, 14 * dpr + sz / 2);
      }
      // Моторы, пропеллеры и стрелки тяги: левый тянет сильнее, чтобы наклонить вправо.
      const thrust = [clamp(50 + u / 2, 0, 100), clamp(50 - u / 2, 0, 100)];
      [-1, 1].forEach((sd, j) => {
        const mx = sd * L;
        g.fillStyle = "#2b3550";
        g.fillRect(mx - 7 * dpr, -12 * dpr, 14 * dpr, 10 * dpr);
        const pw = L * 0.42 * (0.55 + 0.45 * Math.abs(Math.cos(spin * (0.8 + thrust[j] / 100) + j)));
        g.strokeStyle = "rgba(220,235,255,.75)";
        g.lineWidth = 2.5 * dpr;
        g.beginPath();
        g.moveTo(mx - pw, -14 * dpr);
        g.lineTo(mx + pw, -14 * dpr);
        g.stroke();
        g.fillStyle = "rgba(220,235,255,.08)";
        g.beginPath();
        g.ellipse(mx, -14 * dpr, L * 0.42, 3.5 * dpr, 0, 0, TAU);
        g.fill();
        const len = (8 + thrust[j] * 0.5) * dpr * (L / (90 * dpr));
        g.strokeStyle = col;
        g.fillStyle = col;
        g.lineWidth = 3 * dpr;
        g.shadowColor = col;
        g.shadowBlur = 8 * dpr;
        g.beginPath();
        g.moveTo(mx, -18 * dpr);
        g.lineTo(mx, -18 * dpr - len);
        g.stroke();
        g.beginPath();
        g.moveTo(mx - 5 * dpr, -18 * dpr - len + 2 * dpr);
        g.lineTo(mx + 5 * dpr, -18 * dpr - len + 2 * dpr);
        g.lineTo(mx, -18 * dpr - len - 6 * dpr);
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
      });
      g.restore();
      // Число угла и подписи.
      const tx = narrow ? D.x + D.w * 0.8 : cx, ty = narrow ? cy - 4 * dpr : cy + L * 0.75 + 8 * dpr;
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 10 * dpr;
      g.font = `600 ${22 * dpr}px "IBM Plex Mono", monospace`;
      g.fillText(`${f1(th)}°`, tx, ty);
      g.shadowBlur = 0;
      g.font = `${10.5 * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      g.fillStyle = "rgba(220,230,255,.75)";
      if (narrow) {
        g.fillText(`цель ${f1(sp)}°`, tx, ty + 17 * dpr);
        g.fillText(`t = ${fmt(play, 2)} с`, tx, ty + 32 * dpr);
      } else g.fillText(`цель ${f1(sp)}° · t = ${fmt(play, 2)} с${calm ? "" : " · повтор ×0,5"}`, tx, ty + 18 * dpr);
      // Полоски моторов: видно, как D передаёт дрожь гироскопа моторам.
      if (!narrow) {
        const by = h - 30 * dpr, bw = D.w * 0.32;
        ["мотор слева", "мотор справа"].forEach((lab, j) => {
          const bx = cx + (j ? 8 * dpr : -8 * dpr - bw);
          g.fillStyle = "rgba(255,255,255,.08)";
          g.fillRect(bx, by, bw, 8 * dpr);
          g.fillStyle = col;
          g.fillRect(bx, by, (bw * thrust[j]) / 100, 8 * dpr);
          g.fillStyle = "rgba(220,230,255,.6)";
          g.font = `${9.5 * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
          g.textAlign = j ? "left" : "right";
          g.fillText(`${lab} ${fmt(thrust[j])} %`, j ? bx : bx + bw, by - 4 * dpr);
        });
      }
    },
  };
}

export default {
  id: "pid",
  title: "Как мозг держит угол",
  chapters: "Глава 4",
  accent: "#51cf66",
  lead: "Слева — как меняется угол крена дрона после команды стика, справа — сам дрон в замедленном повторе. Физика у всех одна: тело с моментом инерции, моторы с задержкой и пределом силы. Меняется только «мозг»: одна пружина P, пружина с памятью I, пружина с амортизатором D или все три вместе.",
  stageLabel: "Кривые угла крена по времени для каждого регулятора, пунктир — цель от стика; справа дрон сбоку наклоняется так, как наклонялся бы с выбранным регулятором",
  scenes: [
    { id: "step", name: "Резкий наклон стиком", desc: "стик вправо на 30°: кто проскочит цель?", amp: 30, tStep: 0.1, dist: "gust", tGust: 1.2, noise: 0, set: { wind: 0, kp: 1, ki: 1, kd: 1, lag: 30 } },
    { id: "wind", name: "Постоянный ветер сбоку", desc: "ветер давит и не отпускает — нужна память I", amp: 0, tStep: 0, dist: "gust", tGust: 0.2, noise: 0, set: { wind: 10, kp: 1, ki: 1, kd: 1, lag: 30 } },
    { id: "cg", name: "Груз смещён", desc: "тяжёлая камера сбоку, потом наклон на 20°", amp: 20, tStep: 1, dist: "const", tGust: 0, noise: 0, set: { wind: 8, kp: 1, ki: 1, kd: 1, lag: 30 } },
    { id: "noise", name: "Шумный гироскоп", desc: "вибрация моторов: D передаёт дрожь моторам", amp: 30, tStep: 0.1, dist: "gust", tGust: 1.2, noise: 1, set: { wind: 0, kp: 1, ki: 1, kd: 1, lag: 30 } },
  ],
  params: [
    { id: "kp", label: "P — жёсткость пружины (Kp)", min: 0.2, max: 3, step: 0.1, value: 1, digits: 1, fmt: (v) => `×${fmt(v, 1)}` },
    { id: "ki", label: "I — сила памяти (Ki)", min: 0, max: 3, step: 0.1, value: 1, digits: 1, fmt: (v) => `×${fmt(v, 1)}` },
    { id: "kd", label: "D — сила амортизатора (Kd)", min: 0, max: 3, step: 0.1, value: 1, digits: 1, fmt: (v) => `×${fmt(v, 1)}` },
    { id: "wind", label: "Ветер или груз, % от силы моторов", min: 0, max: 30, step: 1, value: 0, unit: "%" },
    { id: "lag", label: "Задержка моторов (как быстро раскручиваются)", min: 10, max: 60, step: 5, value: 30, unit: "мс" },
  ],
  metric: { label: "Средняя ошибка угла за 2 с", unit: "°", digits: 1 },
  methods: METHODS,
  chart: {
    title: "Средняя ошибка в зависимости от жёсткости пружины P: слабая — дрон вялый и сносится, слишком жёсткая без амортизатора — раскачивается",
    x: { param: "kp", min: 0.2, max: 3, label: "Kp, во сколько раз жёстче обычного", unit: "" },
    y: { label: "средняя ошибка", unit: "°", min: 0, max: 20 },
    samples: 40,
  },
  hud: (P, results, scene, focus) => {
    const m = METHODS.find((x) => x.id === focus);
    const r = results[focus] || {};
    return `<span>Kp ×${fmt(P.kp, 1)} · Ki ×${fmt(P.ki, 1)} · Kd ×${fmt(P.kd, 1)}</span><span>моторы: ${fmt(P.lag)} мс</span><span>${scene.dist === "const" ? "груз" : "ветер"}: ${fmt(P.wind)} %${scene.noise ? " · шум гироскопа" : ""}</span>${m ? `<span style="color:${m.color}">${m.name}: ${fmt(r.value, 1)}°</span>` : ""}`;
  },
  stage: createStage,
  try: [
    "Сцена «Резкий наклон»: выбери «Только P» — дрон проскакивает 30° и качается. Теперь «PD»: амортизатор гасит проскок.",
    "Сцена «Постоянный ветер»: P и PD так и висят с наклоном. Поставь у PID память Ki = 0 — снос вернётся. Это и есть работа I.",
    "Подними задержку моторов до 60 мс: «Только P» и «PI» раскачиваются сильнее, а с амортизатором D дрон всё ещё спокоен.",
    "Сцена «Шумный гироскоп»: сравни дрожь моторов у PD и у PID как в Betaflight (подпись под числом). Подними Kd до ×3 — дрожь растёт: моторы бы грелись.",
    "Включи только PID и PID + feedforward: с упреждением дрон поворачивается сразу за стиком, ошибка меньше.",
  ],
};

export const __test = { simulate, gains, ctrlP, ctrlPI, ctrlPD, ctrlBetaflight, ctrlFeedforward, NOISE };
