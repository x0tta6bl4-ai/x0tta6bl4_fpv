// Учебные модели. Все числа на стендах берутся отсюда.
// Метки как в книге: закон / оценка / пример. Это не паспорт оборудования.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const RHO = 1.225;

export const MOTORS = {
  "2207-1950": { name: "2207 1950KV", kv: 1950, rm: 0.055, i0: 1.2, stator: [22, 7], cth: 32, rth: 1.6 },
  "2207-2400": { name: "2207 2400KV", kv: 2400, rm: 0.042, i0: 1.5, stator: [22, 7], cth: 32, rth: 1.6 },
  "2812-1700": { name: "2812 1700KV", kv: 1700, rm: 0.048, i0: 1.1, stator: [28, 12], cth: 55, rth: 1.2 },
};
export const PROPS = {
  "5x4.3x3": { name: "5×4,3×3", d: 5, pitch: 4.3, blades: 3 },
  "6x4x3": { name: "6×4×3", d: 6, pitch: 4, blades: 3 },
  "7x4x3": { name: "7×4×3 (7040×3)", d: 7, pitch: 4, blades: 3 },
};

// Пропеллер: тяга T = Ct·ρ·n²·D⁴, мощность на валу Pw = Cp·ρ·n³·D⁵ (закон подобия; коэффициенты — оценка).
function propCoeffs({ d, pitch, blades }) {
  const pd = pitch / d;
  const bl = 1 + 0.26 * (blades - 2);
  return { ct: (0.035 + 0.11 * pd) * bl, cp: (0.012 + 0.07 * pd * pd) * bl };
}

// Мотор + ESC + батарея: ищем обороты, при которых момент мотора равен моменту винта.
export function thrustStand({ motor = "2207-1950", prop = "5x4.3x3", cells = 6, throttle = 0.5, rint = 0.012, cold = false } = {}) {
  const m = MOTORS[motor];
  const p = PROPS[prop];
  const { ct, cp } = propCoeffs(p);
  const D = p.d * 0.0254;
  const kt = 60 / (2 * Math.PI * m.kv);
  const rb = cells * rint * (cold ? 3 : 1);
  const voc = cells * 4.05;
  const d = clamp(throttle, 0, 1);
  const at = (w) => {
    const n = w / (2 * Math.PI);
    const pw = cp * RHO * n ** 3 * D ** 5;
    const q = w > 0 ? pw / w : 0;
    const im = q / kt + m.i0;
    return { n, pw, im };
  };
  // Баланс напряжений: d·(Voc − Rb·Ibat) = ke·ω + Rm·Im, Ibat = d·Im (ESC — понижающий преобразователь).
  let lo = 0;
  let hi = (voc / kt) * 1.05;
  for (let i = 0; i < 80; i++) {
    const w = (lo + hi) / 2;
    const { im } = at(w);
    const vbus = voc - rb * d * im;
    if (kt * w + m.rm * im > d * vbus) hi = w;
    else lo = w;
  }
  const w = (lo + hi) / 2;
  const { n, pw, im } = d < 0.02 ? { n: 0, pw: 0, im: 0 } : at(w);
  const ibat = d * im;
  const vbus = voc - rb * ibat;
  const thrust = ct * RHO * n * n * D ** 4; // Н
  const grams = (thrust / 9.81) * 1000;
  const power = vbus * ibat;
  const copper = im * im * m.rm;
  return {
    rpm: n * 60,
    grams,
    current: ibat,
    phase: im,
    voltage: vbus,
    cell: vbus / cells,
    power,
    shaft: pw,
    copper,
    eff: power > 1 ? grams / power : 0,
    rthK: m.rth,
    cth: m.cth,
    noload: m.kv * cells * 3.7,
  };
}

// Нагрев обмотки: C·dT/dt = Pмедь − (T − Tокр)/Rth. Охлаждение растёт с обдувом (оценка).
export function heatStep(T, { copper, rpm, ambient = 25, cth = 32, rth = 1.6 }, dt) {
  const rEff = rth / (1 + rpm / 30000);
  const dT = (copper - (T - ambient) / rEff) / cth;
  return T + dT * dt;
}

// Банка LiPo: напряжение без нагрузки от степени заряда (типовая кривая, оценка).
const OCV = [
  [0, 3.0],
  [0.05, 3.45],
  [0.1, 3.6],
  [0.2, 3.68],
  [0.35, 3.74],
  [0.5, 3.8],
  [0.65, 3.87],
  [0.8, 3.97],
  [0.9, 4.06],
  [1, 4.2],
];
export function ocv(soc, chem = "LiPo") {
  const s = clamp(soc, 0, 1.08);
  if (s > 1) return 4.2 + (s - 1) * 1.9; // перезаряд: LiPo в режиме HV
  for (let i = 1; i < OCV.length; i++) {
    if (s <= OCV[i][0]) {
      const [a, va] = OCV[i - 1];
      const [b, vb] = OCV[i];
      const v = va + ((s - a) / (b - a)) * (vb - va);
      return chem === "LiHV" ? v + (s > 0.6 ? (s - 0.6) * 0.375 : 0) : v;
    }
  }
  return 4.2;
}

// Батарея S×P: просадка = ток × внутреннее сопротивление (закон Ома), холод — сопротивление ×3 (оценка).
export function battery({ s = 6, p = 1, mah = 1300, c = 100, soc = 0.8, load = 0, cold = false, aged = false, spread = [0, 0.004, -0.006, 0.002, 0.01, -0.003, 0.005, -0.008] } = {}) {
  const rCell = (0.0028 / (mah / 1300)) * (cold ? 3 : 1) * (aged ? 2 : 1);
  const rPack = (rCell * s) / p;
  const iMax = (mah / 1000) * p * c;
  const cells = Array.from({ length: s }, (_, i) => ocv(soc + (spread[i] ?? 0)) - (load / p) * rCell);
  const vRest = cells.reduce((a, v, i) => a + ocv(soc + (spread[i] ?? 0)), 0);
  const vLoad = cells.reduce((a, v) => a + v, 0);
  return {
    cells,
    vRest,
    vLoad,
    sag: vRest - vLoad,
    nominal: 3.7 * s,
    full: 4.2 * s,
    storage: 3.8 * s,
    capacity: mah * p,
    energy: Math.round((3.7 * s * mah * p) / 100) / 10,
    wh: (3.7 * s * mah * p) / 1000,
    iMax,
    leads: s + 1,
    minCell: Math.min(...cells),
    spread: Math.max(...cells) - Math.min(...cells),
    rPack,
  };
}

export const WAVES = {
  433: { band: "433 МГц" },
  915: { band: "868/915 МГц" },
  1200: { band: "1,2 ГГц" },
  2400: { band: "2,4 ГГц" },
  5800: { band: "5,8 ГГц" },
};

// Радиолиния: λ = 300/f (закон), FSPL (закон), зона Френеля (закон), поляризация, КСВ.
export function radio({ freq = 915, distance = 2000, txH = 6, rxH = 6, hill = 2, power = 100, gainTx = 2, gainRx = 2, pol = "same", swr = 1.2, open = false, rate = 50 } = {}) {
  const lambda = 300 / freq;
  const r1 = Math.sqrt((lambda * distance) / 4);
  const losH = (txH + rxH) / 2;
  const clearance = losH - hill;
  const blocked = clamp(1 - clearance / (0.6 * r1), 0, 2);
  const fspl = 20 * Math.log10((4 * Math.PI * distance) / lambda);
  const polLoss = pol === "mixed" ? 3 : pol === "cross" ? 25 : 0;
  const gamma = open ? 1 : (swr - 1) / (swr + 1);
  const reflected = gamma * gamma;
  const mismatch = open ? 40 : -10 * Math.log10(1 - reflected);
  // Затенение зоны Френеля: до ~6 дБ при касании, больше при перекрытии (оценка по клину).
  const shadow = blocked <= 0 ? 0 : blocked < 1 ? 6 * blocked * blocked : 6 + 14 * (blocked - 1);
  const ptx = 10 * Math.log10(Math.max(power, 0.01));
  const rssi = ptx + gainTx + gainRx - fspl - polLoss - mismatch - shadow;
  const sens = { 25: -123, 50: -120, 100: -117, D50: -112, 150: -112, 500: -105 }[rate] ?? -120;
  const margin = rssi - sens;
  const lq = clamp(100 / (1 + Math.exp(-(margin - 2) / 1.6)), 0, 100);
  const quarter = (lambda / 4) * 100;
  return { lambda, quarter, half: quarter * 2, r1, clearance, blocked, fspl, polLoss, reflected, mismatch, shadow, rssi, sens, margin, lq, ptx, alarm: sens + 10 };
}

// Одна ось: угол, угловая скорость; P/I/D по ошибке скорости, режимы Acro/Angle/Horizon.
export function pidStep(s, { mode = "ANGLE", stick = 0, kp = 1, ki = 1, kd = 1, accBias = 0, wind = 0, limit = 55 }, dt) {
  let target;
  const level = clamp((stick * limit - (s.angle + accBias)) * 5, -400, 400);
  if (mode === "ACRO") target = stick * 300;
  else if (mode === "ANGLE") target = level;
  else {
    const mix = clamp((Math.abs(stick) - 0.3) / 0.6, 0, 1);
    target = (1 - mix) * level + mix * stick * 300;
  }
  const err = target - s.rate;
  s.integral = clamp(s.integral + err * dt, -60, 60);
  const dterm = -(s.rate - s.prevRate) / Math.max(dt, 1e-3);
  s.prevRate = s.rate;
  const out = clamp(0.9 * kp * err + 2.2 * ki * s.integral + 0.012 * kd * dterm, -900, 900);
  const accel = out * 6 - s.rate * 0.6 + wind * 420;
  s.rate += accel * dt;
  s.angle += s.rate * dt;
  s.angle = clamp(s.angle, -80, 80);
  if (Math.abs(s.angle) >= 80 && s.angle * s.rate > 0) s.rate = 0; // упор: балка стоит, гироскоп видит 0
  s.target = target;
  s.out = out;
  s.p = 0.9 * kp * err;
  s.i = 2.2 * ki * s.integral;
  s.d = 0.012 * kd * dterm;
  return s;
}

// Failsafe Betaflight 4.5 (упрощённо): режимы каналов и этапы (по книге, гл. 16).
export function failsafe({ armed = true, link = true, since = 0, delay = 1.5, rx = "cut", profile = "default" } = {}) {
  const channels = {
    default: { thr: "auto", axes: "auto", arm: "hold", mode: "hold", stage2: "drop" },
    keep: { thr: "hold", axes: "auto", arm: "hold", mode: "hold", stage2: "drop" },
    climb: { thr: "set", axes: "auto", arm: "hold", mode: "set", stage2: "drop" },
  }[profile];
  if (!armed) return { phase: "disarm", label: "DISARM: моторы не крутятся", motors: false, channels, stage: 0 };
  if (link) return { phase: "ok", label: "связь есть · команды идут", motors: true, channels, stage: 0 };
  if (rx === "fspos") return { phase: "hidden", label: "FS Pos: приёмник шлёт «запомненные стики» — FC не знает о потере", motors: true, channels, stage: 0, hidden: true };
  if (since < 0.3) return { phase: "check", label: "RXLOSS · первые 0,3 с держатся последние значения", motors: true, channels, stage: 0 };
  if (since < delay) return { phase: "stage1", label: `Этап 1 · каналы в значениях failsafe (${(delay - since).toFixed(1).replace(".", ",")} с до этапа 2)`, motors: true, channels, stage: 1 };
  return { phase: "stage2", label: "Этап 2 · Drop: моторы выключены", motors: false, channels, stage: 2 };
}
export function channelValue(mode, last, setValue, isThrottle) {
  if (mode === "auto") return isThrottle ? 1000 : 1500;
  if (mode === "hold") return last;
  return setValue;
}

// Путь команды и видео: где обрывается цепочка при данной неисправности (гл. 1, 10, 14, 15, 17).
export const FAULTS = [
  { id: "ok", group: "Норма", label: "Всё исправно", stop: 99, flag: "—", case: "", note: "Команда проходит стик → TX → RX → FC → ESC → мотор, видео — камера → FC (OSD) → VTX → очки." },
  // Дело №1 — «бинд есть, арма нет»: проверки по пути сигнала.
  { id: "modelmatch", group: "Дело №1 · бинд есть, арма нет", label: "Model Match: номер не совпал", stop: 2, flag: "RXLOSS", case: "Дело №1", note: "Бинд есть, «антенны» на пульте горят, но приёмник не отдаёт команды полётнику. Диод приёмника мигает трижды." },
  { id: "txrx", group: "Дело №1 · бинд есть, арма нет", label: "Провод TX приёмника не на RX полётника", stop: 2, flag: "RXLOSS", case: "Дело №1", note: "Данные — крест-накрест: TX («рот») приёмника → RX («ухо») полётника. Иначе FC ничего не слышит." },
  { id: "uart", group: "Дело №1 · бинд есть, арма нет", label: "Serial RX включён не на том UART", stop: 3, flag: "RXLOSS", case: "Дело №1", note: "Приёмник припаян к R2/T2, а в «Портах» Serial RX стоит на UART1. Полётник слушает не ту дверь." },
  { id: "crsf", group: "Дело №1 · бинд есть, арма нет", label: "Протокол приёмника не CRSF (стоит SBUS)", stop: 3, flag: "RXLOSS", case: "Дело №1", note: "Байты доходят по проводу, но полётник ждёт SBUS и не может их разобрать. Вкладка «Приёмник»: Serial, протокол CRSF." },
  { id: "auxmix", group: "Дело №1 · бинд есть, арма нет", label: "AUX1 (ARM) не назначен в Mixes пульта", stop: 2, flag: "— (тумблер не виден)", case: "Дело №1", note: "Тумблер на пульте щёлкает, но в канал AUX1 его никто не положил: полётник всё время видит 1500 мкс, режим ARM не включается. Флагов нет — нет и попытки арма. В пульте: Mixes → CH5 = тумблер ARM." },
  { id: "armrange", group: "Дело №1 · бинд есть, арма нет", label: "ARM: диапазон в «Режимах» не там, где тумблер", stop: 2, flag: "— (тумблер не в диапазоне)", case: "Дело №1", note: "AUX1 ходит 1000 ↔ 2000 мкс, а жёлтая полоса ARM стоит на 1300–1700: ни одно положение тумблера в неё не попадает. «Режимы» → передвинь диапазон к положению «вкл»." },
  { id: "prearm", group: "Дело №1 · бинд есть, арма нет", label: "В «Режимах» есть PREARM, а он не взведён", stop: 2, flag: "NOPREARM", case: "Дело №1", note: "Prearm — второй ключ: пока его тумблер не взведён, ARM не проходит. Взведи PREARM, потом ARM (или убери PREARM из «Режимов»)." },
  { id: "msp", group: "Дело №1 · бинд есть, арма нет", label: "Подключён USB к Configurator", stop: 2, flag: "MSP", case: "Дело №1", note: "Пока полётник разговаривает с Configurator по USB (MSP), арм запрещён. На столе это норма; чтобы армить — отключи кабель." },
  { id: "acc", group: "Дело №1 · бинд есть, арма нет", label: "Акселерометр не откалиброван (в «Режимах» есть Angle)", stop: 3, flag: "NO_ACC_CAL", case: "Дело №1", note: "Режиму Angle нужен акселерометр, а его ни разу не калибровали — Betaflight запрещает арм. Система → Калибровка акселерометра на ровной поверхности." },
  { id: "proto", group: "Дело №1 · бинд есть, арма нет", label: "Не выбран протокол моторов", stop: 4, flag: "MOTOR_PROTO", case: "Дело №1", note: "Вкладка «Моторы» → DShot300/600." },
  { id: "armsw", group: "Дело №1 · бинд есть, арма нет", label: "Тумблер ARM был включён при подаче питания", stop: 3, flag: "ARMSWITCH", case: "Дело №1", note: "Тумблер был включён, когда появилась связь: Betaflight ставит NOT_DISARMED и ARMSWITCH. Выключи и снова включи тумблер ARM." },
  { id: "motorstop", group: "Дело №1 · бинд есть, арма нет", label: "Motor Stop включён", stop: 99, flag: "— (арм есть)", case: "Дело №1", note: "Арм проходит, моторы просто ждут газа. Motor Stop — не флаг запрета: пока газ внизу, бипер напоминает «армлен».", idle: true },
  // Дело №2 — «кувыркнулся на взлёте»: тяги и моменты несимметричны.
  { id: "propdir", group: "Дело №2 · кувыркнулся на взлёте", label: "На моторе 2 винт не той стороны", stop: 99, flag: "— (арм есть)", case: "Дело №2", note: "Мотор крутится правильно, но лопасти зеркальные: винт гонит воздух вверх и тянет свой угол вниз. Полётник прибавляет этому мотору обороты — становится только хуже." },
  { id: "motordir", group: "Дело №2 · кувыркнулся на взлёте", label: "Мотор 3 крутится не в ту сторону", stop: 99, flag: "— (арм есть)", case: "Дело №2", note: "Винт правильный, но вращается задом наперёд: тяги почти нет, а реактивный момент — в обратную сторону. «Моторы» без пропов: проверь направление, поменяй местами два провода фаз или включи реверс в BLHeli/Bluejay." },
  { id: "motororder", group: "Дело №2 · кувыркнулся на взлёте", label: "Полётник путает номера: моторы 1 и 2 переставлены", stop: 99, flag: "— (арм есть)", case: "Дело №2", note: "Команда «мотор 1» уходит на передний правый, «мотор 2» — на задний правый. Любая поправка тангажа на правой стороне работает наоборот, и дрон раскачивает сам себя. «Моторы» без пропов: крути по одному и сверяй с картинкой." },
  { id: "orient", group: "Дело №2 · кувыркнулся на взлёте", label: "Плата повёрнута на 90°, в настройках 0°", stop: 99, flag: "— (арм есть)", case: "Дело №2", note: "Полётник думает, что его нос — правый бок рамы: крен он принимает за тангаж и поправляет не ту ось. 3D-модель во вкладке «Настройка» наклоняется не туда — выставь Board orientation (Yaw 90°)." },
  { id: "motordead", group: "Дело №2 · кувыркнулся на взлёте", label: "Мотор 4 или его канал ESC неисправен", stop: 99, flag: "— (арм есть)", case: "Дело №2", note: "Команда до мотора доходит, а он не крутится: одной тяги не хватает, угол проседает, дрон заваливается на него. «Моторы» без пропов: этот мотор молчит — проверь пайку фаз и ESC." },
  // Дела №3–4 — видео.
  { id: "cam", group: "Дело №3 · OSD есть, картинки нет", label: "Не пропаян провод камеры", stop: 99, video: 0, flag: "—", case: "Дело №3", note: "OSD видно, картинки нет: участок FC → VTX жив, ищи пайку камеры и площадку CAM." },
  { id: "rpsma", group: "Дело №4 · видео рябит", label: "Антенна SMA на RP-SMA: нет центрального контакта", stop: 99, video: 3, flag: "—", case: "Дело №4", note: "Для передатчика это работа без антенны: мощность отражается и греет выходной каскад." },
  { id: "pit", group: "Дело №4 · видео рябит", label: "VTX в PIT Mode", stop: 99, video: 2, flag: "—", case: "Дело №4", note: "Управление работает, видео почти не излучается: PIT Mode — режим настройки." },
  // Дело №5 — «стики делают не то».
  { id: "taer", group: "Дело №5 · стики делают не то", label: "Порядок каналов AETR ↔ TAER", stop: 3, flag: "THROTTLE", case: "Дело №5", note: "Двигаешь крен — во вкладке «Приёмник» едет газ. Газ «не в нуле» — арм запрещён." },
  { id: "acctilt", group: "Дело №5 · стики делают не то", label: "Акселерометр откалиброван на наклонном столе", stop: 99, flag: "— (арм есть)", case: "", note: "Флагов нет, арм проходит. Но «ровно» для полётника — тот наклон, на котором калибровали (8° вправо). В режиме Angle он его и держит: стики в центре, а дрон кренится вправо и уходит вправо. Пунктир в очках (горизонт OSD) показывает «ровно», а настоящий горизонт завален. Лечится калибровкой на ровной поверхности." },
  // Дело №6 — «LOW V сразу после взлёта».
  { id: "lowv", group: "Дело №6 · LOW V после взлёта", label: "Батарея холодная или старая", stop: 99, flag: "— (арм есть)", case: "Дело №6", note: "В покое 22,8 В (3,8 В на банку), а под нагрузкой напряжение проседает: большое внутреннее сопротивление. Газ — и в очках LOW BATTERY, тяги меньше, висеть приходится на большем газе. Проверка: каждая банка в покое и под нагрузкой, температура батареи." },
];
