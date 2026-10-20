// Fig: «Бинд есть, арма нет» (гл. 17, дело №1) — пошаговый разбор, как с инструктором.
// На столе: пульт с модулем ELRS и большим экраном, приёмник на поролоне, провода к полётнику на раме, ноутбук
// с Betaflight. Каждое дело прячет одну причину. Разбор идёт строго по пути команды (книга, с. 65–66):
// ⓪ бинд → ① провод → ② порты → ③ приёмник → ④ пульт → ⑤ режимы → ⑥ флаги. На каждом шаге панель говорит,
// что делать руками и что ты видишь, а вывод («норма», «улика», «причина здесь») делает ученик; ошибка
// объясняется. Найдена причина — три варианта исправления, потом проверка тумблером ARM и итог дела.
// Сцена подсвечивает только то, что проверяется на этом шаге. Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, pcb, motor, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -82, y: -108, w: 168, d: 218, r: 8 };
const SCR = { x: -76, y: -62, w: 4, d: 100, z0: 4, h: 52 };
const SW = SCR.d - 8;
const PULT = [44, 70];
const RXP = { x: 14, y: 2, w: 22, d: 26 }; // поролон с приёмником
const DR = [24, -54], DZ = 12; // центр рамы и высота рамы
const FCP = [DR[0] - 4, DR[1] + 2]; // площадки полётника

// Шаги разбора: что проверяем, что делаешь руками, какие группы сцены подсвечены.
export const STEPS = [
  { id: "bind", n: "⓪", name: "Бинд точно есть?", look: ["rx", "pult"], do: "Посмотри на диод приёмника и на модуль пульта. На экране пульта — есть ли связь и телеметрия (RSSI, LQ)." },
  { id: "wire", n: "①", name: "Провод приёмник → полётник", look: ["wire", "rx", "drone"], do: "Без питания осмотри пайку: TX приёмника должен идти на RX полётника (R2), RX приёмника — на TX (T2); 5V и G — как есть." },
  { id: "ports", n: "②", name: "Порты", look: ["laptop"], do: "Betaflight → «Порты». Приёмник припаян к UART2 — на UART2 должен быть включён Serial RX." },
  { id: "rx", n: "③", name: "Приёмник", look: ["laptop"], do: "Betaflight → «Приёмник»: протокол CRSF, порядок каналов как на пульте (AETR). Подвигай стики и щёлкни тумблером — полоски должны ездить, газ внизу ≈ 1000." },
  { id: "pult", n: "④", name: "Пульт", look: ["pult"], do: "На пульте открой настройки модели: External RF = CRSF, Model Match = OFF, тумблер ARM назначен на CH5 в Mixes." },
  { id: "modes", n: "⑤", name: "Режимы", look: ["laptop"], do: "Betaflight → «Режимы»: ARM назначен на AUX1? Щёлкни тумблером — жёлтая метка должна попасть в диапазон. Есть ли режим PREARM?" },
  { id: "flags", n: "⑥", name: "Флаги запрета арма", look: ["laptop", "drone"], do: "Betaflight → «Система» (или команда status в CLI): какие флаги запрещают арм. MSP — это просто USB, норма." },
];
const SI = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));

// Причины. at — шаг, где видна причина; fix — варианты исправления: первый верный, у неверных — почему нет.
export const CAUSES = {
  foreign: { flag: "RXLOSS", at: "bind", title: "приёмник сопряжён с чужим пультом", fix: [["Перебиндить приёмник на свой пульт (та же бинд-фраза)"], ["Поменять антенну приёмника", "Антенна ни при чём: приёмник прекрасно слышит — только не твой пульт."], ["Перепрошить полётник", "Полётник ещё даже не участвует: пульт не связан с этим приёмником."]] },
  wire: { flag: "RXLOSS", at: "wire", title: "TX приёмника припаян к T2, а не к R2", fix: [["Перепаять крест-накрест: TX приёмника → R2, RX → T2"], ["Включить Serial RX на UART1", "Порт выбран верно, беда в пайке: «рот» приёмника припаян к «рту» полётника."], ["Поменять протокол на SBUS", "Протокол не поможет: данные физически не доходят до входа полётника."]] },
  port: { flag: "RXLOSS", at: "ports", title: "Serial RX включён на UART1, а приёмник на UART2", fix: [["«Порты»: Serial RX на UART2 — туда, где приёмник"], ["Включить MSP на UART2", "MSP — для компьютера и OSD, а приёмнику нужен Serial RX."], ["Отключить USB", "USB не мешает приёмнику: полётник просто слушает не тот UART."]] },
  proto: { flag: "RXLOSS", at: "rx", title: "протокол SBUS вместо CRSF", fix: [["«Приёмник»: протокол CRSF"], ["Порядок каналов TAER", "Порядок важен, когда данные приходят. Сейчас полётник не понимает язык приёмника: ELRS говорит на CRSF."], ["Перебиндить приёмник", "Бинд есть, радио работает. Не совпадает язык между приёмником и полётником."]] },
  mm: { flag: "RXLOSS", at: "pult", title: "Model Match: номер модели не совпал", fix: [["Пульт: Model Match = OFF (как в курсе)"], ["Перебиндить с новой фразой", "Бинд и так есть. Model Match — отдельный «пропуск» по номеру модели."], ["Выключить External RF", "Тогда пульт вообще перестанет передавать."]] },
  order: { flag: "THROTTLE", at: "rx", title: "порядок каналов TAER, а пульт шлёт AETR", fix: [["«Приёмник»: порядок каналов как на пульте — AETR"], ["Реверс газа на пульте", "Газ не перевёрнут — на его место попал крен (поэтому ≈ 1500)."], ["Калибровать акселерометр", "Акселерометр ни при чём: полётник видит газ 1500 и не даёт армиться."]] },
  thr: { flag: "THROTTLE", at: "rx", title: "газ внизу = 1100: сбита калибровка стиков", fix: [["Пульт: откалибровать стики, чтобы низ газа был ≈ 1000"], ["Порядок каналов AETR", "Порядок верный: газ ездит, когда двигаешь газ. Просто его низ — 1100."], ["Угол арма 180°", "Угол арма — про наклон борта, а здесь газ не в самом низу."]] },
  mix: { flag: "", at: "pult", title: "тумблер не назначен на CH5 в Mixes", fix: [["Пульт: Mixes — тумблер SA на CH5"], ["«Режимы»: ARM на AUX2", "Сейчас тумблер вообще не передаётся по радио — ни на AUX1, ни на AUX2."], ["Калибровать стики", "Стики работают; не передаётся только тумблер."]] },
  armaux: { flag: "", at: "modes", title: "ARM назначен на AUX2, а тумблер — AUX1", fix: [["«Режимы»: ARM на AUX1 — туда, где тумблер"], ["Включить режим PREARM", "Prearm добавит второй шаг, но ARM всё равно слушает не тот канал."], ["Протокол ESC DShot", "Моторы ни при чём: команда ARM не доходит до режима."]] },
  range: { flag: "", at: "modes", title: "диапазон ARM не накрывает положение тумблера", fix: [["«Режимы»: сдвинуть диапазон ARM под жёлтую метку (1700–2100)"], ["Включить режим PREARM", "Prearm не сдвинет диапазон: метка тумблера всё равно мимо."], ["Калибровать акселерометр", "Акселерометр ни при чём: метка тумблера не попадает в диапазон ARM."]] },
  prearm: { flag: "NOPREARM", at: "modes", title: "включён Prearm, а его тумблер не взведён", fix: [["Сначала взвести Prearm, потом ARM (или убрать режим PREARM)"], ["Сдвинуть диапазон ARM", "Диапазон ARM в порядке: полётник ждёт сначала Prearm."], ["Перебиндить приёмник", "Связь в порядке — это двухшаговый пуск, как тормоз + кнопка Start."]] },
  acc: { flag: "NO_ACC_CAL", at: "flags", title: "акселерометр не откалиброван", fix: [["«Система»: калибровать акселерометр на ровной поверхности"], ["Угол арма 180°", "Угол арма не заменит калибровку: флаг NO_ACC_CAL останется."], ["Протокол ESC DShot", "Протокол уже выбран; флаг говорит про акселерометр."]] },
  angle: { flag: "ANGLE", at: "flags", title: "борт лежит наклонённым — больше угла арма", fix: [["Положить борт ровно (по курсу угол арма 180°)"], ["Калибровать акселерометр прямо так, в наклоне", "Хуже: калибровка запомнит кривой «горизонт», и в Angle дрон будет уплывать."], ["Протокол ESC DShot", "Флаг ANGLE — про наклон борта, не про моторы."]] },
  motor: { flag: "MOTOR_PROTO", at: "flags", title: "не выбран протокол ESC", fix: [["«Моторы»: протокол DShot600"], ["Калибровать акселерометр", "Флаг называет другую причину: MOTOR_PROTO — протокол ESC."], ["Отключить батарею", "Без батареи моторы тем более не закрутятся."]] },
  armsw: { flag: "ARMSWITCH", at: "flags", title: "тумблер ARM был включён при подаче питания", fix: [["Выключить тумблер ARM и включить снова"], ["Перебиндить приёмник", "Связь в порядке: это защита от запуска моторов с включённым тумблером."], ["Сдвинуть диапазон ARM", "Диапазон в порядке: полётник ждёт, пока тумблер выключат."]] },
  mstop: { flag: "", at: "flags", title: "это не поломка: арм есть, Motor Stop держит моторы до газа", fix: [["Ничего не ломать: арм есть. Дать газ (а Motor Stop по курсу выключить)"], ["Заменить регулятор ESC", "ESC исправен: OSD пишет ARMED, моторы просто ждут газа."], ["Калибровать акселерометр", "Флагов нет — полётник уже разрешил арм."]] },
};
const FLAG_TEXT = {
  RXLOSS: "нет данных с приёмника",
  THROTTLE: "газ не в самом низу",
  NOPREARM: "не взведён Prearm",
  NO_ACC_CAL: "акселерометр не откалиброван",
  ANGLE: "наклон больше угла арма",
  MOTOR_PROTO: "не выбран протокол ESC",
  ARMSWITCH: "тумблер ARM был включён при подаче питания",
};
const HAND = ["port", "wire", "mix", "order", "acc", "mstop", "proto", "range", "armsw", "mm", "angle", "prearm", "foreign", "motor", "thr", "armaux"];
const IDS = Object.keys(CAUSES);
export function causeOf(day) {
  const n = Number(day) || 1;
  if (n <= HAND.length) return HAND[n - 1];
  let a = Math.imul(n, 2654435761) >>> 0;
  a = (a ^ (a >>> 13)) >>> 0; // без >>> 0 XOR даёт отрицательное число и пустой индекс
  return IDS[a % IDS.length];
}
const NO_DATA = ["foreign", "wire", "port", "proto", "mm"];

// Что видно на шаге: ok — норма, bad — причина здесь, hint — улика (видно отклонение, но причина в другом месте).
export function evidence(step, c) {
  const noData = NO_DATA.includes(c);
  switch (step) {
    case "bind":
      if (c === "foreign") return ["bad", "Диод приёмника горит ровно, а пульт пишет «нет связи» и телеметрии нет. Приёмник связан с чужим пультом."];
      if (c === "mm") return ["hint", "Пульт пишет «связь есть», а диод приёмника мигает трижды — особый сигнал: приёмник слышит пульт, но его команды не берёт."];
      return ["ok", "Диоды горят ровно и на приёмнике, и на модуле пульта; на пульте «связь есть», RSSI −58, LQ 100."];
    case "wire":
      if (c === "wire") return ["bad", "TX приёмника припаян к T2 полётника — «рот» к «рту». Данные никуда не попадают."];
      return ["ok", "TX приёмника → R2, RX приёмника → T2 (крест-накрест), 5V и G на месте, пайка блестит."];
    case "ports":
      if (c === "port") return ["bad", "Serial RX включён на UART1, а на UART2, где приёмник, — выключен."];
      return ["ok", "Serial RX включён на UART2 — там, где приёмник."];
    case "rx":
      if (c === "proto") return ["bad", "Протокол SBUS, а ELRS говорит на CRSF. Полоски каналов стоят."];
      if (noData) return ["hint", "Протокол CRSF, порядок AETR — настройки верные, но полоски стоят: данные не приходят."];
      if (c === "order") return ["bad", "Порядок TAER. Двигаешь крен — ездит полоска «Газ»; в покое «газ» ≈ 1500."];
      if (c === "thr") return ["bad", "Протокол и порядок верные, но стик газа в самом низу, а полоска «Газ» показывает 1100."];
      if (c === "mix") return ["hint", "Стики двигают свои полоски, а AUX1 стоит на месте, когда щёлкаешь тумблером."];
      return ["ok", "CRSF, AETR; полоски едут за стиками, газ внизу 1000, AUX1 щёлкает 1000 ↔ 2000."];
    case "pult":
      if (c === "mm") return ["bad", "Model Match: ON. В пульте модель №1, а приёмник запомнил №2 — команды он игнорирует."];
      if (c === "mix") return ["bad", "В Mixes нет строки CH5 ← SA: тумблер ARM не передаётся по радио."];
      return ["ok", "External RF: CRSF, Model Match: OFF, тумблер SA на CH5."];
    case "modes":
      if (c === "armaux") return ["bad", "ARM назначен на AUX2, а тумблер шлёт AUX1 — жёлтая метка ARM не двигается."];
      if (c === "range") return ["bad", "ARM на AUX1, диапазон 1300–1700, а тумблер даёт 2000: жёлтая метка мимо диапазона."];
      if (c === "prearm") return ["bad", "Кроме ARM, включён режим PREARM, а его тумблер не взведён."];
      return ["ok", "ARM на AUX1, жёлтая метка тумблера попадает в диапазон 1700–2100, PREARM не используется."];
    case "flags": {
      const f = CAUSES[c].flag;
      if (f) return ["bad", `Горит флаг ${f} — ${FLAG_TEXT[f]}. Полётник сам называет причину.`];
      if (c === "mstop") return ["bad", "Флагов нет, кроме MSP. Щёлкаешь тумблером — OSD пишет ARMED, а моторы стоят: включён Motor Stop."];
      return ["ok", "Флагов нет, кроме MSP (это USB — норма)."];
    }
  }
  return ["ok", ""];
}
const EXPECT = { ok: "ok", hint: "clue", bad: "here" };
const CHOICES = [["ok", "Норма — дальше"], ["clue", "Улика: запомню, но причина не здесь — дальше"], ["here", "Причина здесь — исправляю"]];
function wrongWhy(choice, tone, text) {
  if (tone === "ok") return choice === "here" ? `Здесь всё по норме: ${text} Не чини то, что работает: лишняя правка добавит новую поломку.` : `Здесь нет ничего необычного: ${text} Это просто норма.`;
  if (tone === "bad") return `Посмотри ещё раз: ${text} Это и есть обрыв — дальше идти не нужно.`;
  return choice === "here" ? `Отклонение видно, но настройка здесь верная: ${text} Исправлять тут нечего — запомни улику и иди дальше.` : `Не совсем норма: ${text} Это улика — она подскажет, где искать.`;
}
// Порядок вариантов исправления перемешан от номера дела (верный не всегда первый).
function fixOrder(day) {
  const n = Number(day) || 1;
  return [[0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0]][n % 6];
}
const MEMO = {
  RXLOSS: "RXLOSS — данные не доходят: провод, порт, протокол или Model Match. Бинд при этом может быть.",
  "": "Флагов нет, а тумблер молчит — команда ARM не доходит: Mixes на пульте или «Режимы».",
  flag: "Флаг запрета арма — полётник сам называет причину: читай его, а не гадай.",
  mstop: "Motor Stop арму не мешает: ARMED есть, моторы ждут газа.",
};
function c2fam(c) {
  const f = CAUSES[c].flag;
  if (c === "mstop") return "mstop";
  if (f === "RXLOSS") return "RXLOSS";
  return f ? "flag" : "";
}

export function caseModel(s) {
  const c = causeOf(s.day);
  const C = CAUSES[c];
  const step = Number(s.step ?? -1);
  const phase = s.phase || "intro";
  const armed = phase === "done";
  return { c, C, step, phase, armed, solved: armed, mistakes: Number(s.mistakes || 0) };
}

const SETUP = (day) => ({ day, step: -1, phase: "intro", mistakes: 0, ans: "", log: "" });
export const meta = {
  id: "armcase",
  title: "Бинд есть — арма нет",
  hint: "Разбор по шагам — в панели",
  proc: true,
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Ярко — то, что проверяется на этом шаге; остальное приглушено" },
    { mark: "raised", label: "Пульт с модулем ELRS и экраном, приёмник, провода к полётнику, рама с моторами, ноутбук с Betaflight" },
    { mark: "edge", label: "Красный пунктир — ошибка пайки (шаг ①)" },
  ],
  caption: "Бинд — это радио между пультом и приёмником. Арм — команда, которая дошла до полётника и была им разрешена. Значит, обрыв где-то после приёмника. Порядок проверки: ⓪ бинд точно есть → ① провод TX приёмника → RX полётника → ② «Порты» → ③ «Приёмник» → ④ пульт: External RF, Model Match, Mixes → ⑤ «Режимы» → ⑥ флаги запрета арма. Motor Stop арму не мешает.",
  aria: "Панель разбора: на каждом шаге — что сделать, что видно и три вывода на выбор; затем исправление и проверка тумблером ARM.",
  missions: [
    {
      id: "rxloss", look: [], touch: ["proc"], see: "«Что видишь» на каждом шаге",
      text: "Дело №1: пройди разбор по шагам, найди причину, исправь и заармь",
      check: (f) => f.solved && f.day === 1,
      predict: { q: "Бинд есть, а арма нет. Где обрыв?", options: ["Между пультом и приёмником", "После приёмника: провод, порт, протокол, пульт, режимы или флаги", "В батарее"], right: 1 },
      setup: SETUP(1),
    },
    {
      id: "noflag", look: [], touch: ["proc"], see: "улику на шаге ③ и экран пульта на шаге ④",
      text: "Дело №3: флагов нет, а тумблер ничего не делает — раскрой его",
      check: (f) => f.solved && f.day === 3,
      predict: { q: "Флагов нет, кроме MSP, а тумблер ARM ничего не делает. Где искать?", options: ["В моторах", "На пути тумблера: Mixes на пульте и «Режимы»", "Калибровать акселерометр"], right: 1 },
      setup: SETUP(3),
    },
    {
      id: "flag", look: [], touch: ["proc"], see: "флаг на шаге ⑥",
      text: "Дело №5: дойди до флагов — полётник сам назовёт причину",
      check: (f) => f.solved && f.day === 5,
      predict: { q: "На вкладке «Система» горит флаг запрета арма. Что он даёт?", options: ["Ничего: флаги — для красоты", "Полётник сам называет причину — читай флаг", "Флаг значит: перепрошить полётник"], right: 1 },
      setup: SETUP(5),
    },
    {
      id: "trap", look: [], touch: ["proc"], see: "шаг ⑥: OSD и моторы",
      text: "Дело №6 — ловушка: «арма нет», а на самом деле…",
      check: (f) => f.solved && f.day === 6,
      predict: { q: "Тумблер щёлкнул, OSD пишет ARMED, а моторы стоят. Что это?", options: ["Сгорел ESC", "Motor Stop: арм есть, моторы ждут газа", "Бинда нет"], right: 1 },
      setup: SETUP(6),
    },
    {
      id: "clean", look: [], touch: ["proc"], see: "счётчик ошибок в панели",
      text: "Раскрой любое дело без единой ошибки в выводах и исправлении",
      check: (f) => f.solved && f.mistakes === 0,
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [SCR.x, SCR.y, SCR.z0 + SCR.h + 2], [SCR.x, SCR.y + SCR.d, SCR.z0 + SCR.h + 2], [PULT[0] - 24, PULT[1], 46], [PULT[0] - 18, PULT[1] + 26, 36]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;

export function render(state) {
  const P = projection();
  const S = scene(P);
  const M = caseModel(state);
  const c = M.c;
  basePlate(S, PLATE);
  labelPlate(S, { x: 66, y: -100, w: 16, d: 20, r: 1.5 });

  // ── Ноутбук с Betaflight (экран рисуется каждый кадр) ──
  S.group = "laptop";
  const base = { x: SCR.x + 4, y: SCR.y, w: 30, d: SCR.d, r: 2.4 };
  S.box(base, 0, 3.4, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  const keys = [];
  for (let r = 0; r < 3; r++) for (let cc = 0; cc < 12; cc++) keys.push([base.x + 6 + r * 5, base.y + 10 + cc * 7.4, 3.4]);
  S.dots(keys, { size: 0.5, tone: "lo" }, [base.x + 14, base.y + base.d / 2, 3.5]);
  S.box({ ...SCR, r: 1.6 }, SCR.z0, SCR.h, { tone: "mid" }, { bevel: 0.4, ref: [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2] });
  const lf = k.sideMatrix([SCR.x + SCR.w, SCR.y + SCR.d - 4], SCR.z0 + SCR.h - 4, P, "right");
  S.raw([SCR.x + SCR.w + 0.4, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2], `<g transform="${lf}"><rect x="0" y="0" width="${SW}" height="${SCR.h - 8}" rx="1.4" class="bf-screen"/><g data-part="bf"></g></g>`, { bias: 4 });
  S.tube([[base.x + base.w, base.y + 18, 2], [DR[0] - 30, DR[1] + 10, 1.2], [FCP[0] - 6, FCP[1] + 6, DZ + 1]], 0.8, { tone: "mid", bendR: 6, maxLength: 12 });

  // ── Пульт: корпус, стики, модуль ELRS с антенной и диодом, большой экран, тумблер ARM ──
  S.group = "pult";
  const [px, py] = PULT;
  const body = { x: px - 20, y: py - 34, w: 40, d: 68, r: 8 };
  S.box(body, 0, 10, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(body, 10, P, 7), { tone: "faint" }) }, { bevel: 0.9 });
  for (const gy of [py - 21, py + 21]) {
    S.cyl(px + 4, gy, 6.4, 10, 1.6, { tone: "mid" });
    S.tube([[px + 4, gy, 11.6], [px + 4, gy, 18]], 0.8, { tone: "hi" });
    S.solid(G.sphereOf([px + 4, gy, 18.8], 1.9, P), { tone: "hi" }, [px + 4, gy, 18.8], { bias: 1 });
  }
  const SP = { x: px - 17, y: py - 26, w: 3, d: 52, z0: 10, h: 28 };
  S.box({ x: SP.x - 1, y: SP.y + 4, w: 5, d: SP.d - 8, r: 1 }, 10, 2, { tone: "mid" }, { steps: 2 });
  S.box({ ...SP, r: 1.2 }, SP.z0 + 1, SP.h, { tone: "mid" }, { bevel: 0.4, ref: [SP.x + SP.w, SP.y + SP.d / 2, SP.z0 + SP.h / 2] });
  const pf = k.sideMatrix([SP.x + SP.w, SP.y + SP.d - 2], SP.z0 + SP.h - 1, P, "right");
  S.raw([SP.x + SP.w + 0.3, SP.y + SP.d / 2, SP.z0 + SP.h / 2], `<g transform="${pf}"><rect x="0" y="0" width="${SP.d - 4}" height="${SP.h - 4}" rx="1.2" class="osd-screen"/><g data-part="pscr"></g></g>`, { bias: 3 });
  const mod = { x: px - 27, y: py - 10, w: 8, d: 20, r: 1.2 };
  S.box(mod, 3, 14, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  S.tube([[mod.x + 3.5, mod.y + 9, 17], [mod.x + 2, mod.y + 9, 40]], 0.9, { tone: "hi", maxLength: 30 });
  S.raw([mod.x + mod.w, mod.y + 3, 15], `<g data-part="txled"></g>`, { bias: 4 });
  const sw = [px - 10, py + 28];
  S.box({ x: sw[0] - 2.4, y: sw[1] - 3, w: 4.8, d: 6, r: 0.8 }, 10, 2, { tone: "mid" }, { steps: 2 });
  const swOn = M.armed || (c === "armsw" && M.phase !== "arm");
  const lever = swOn ? [sw[0] - 5, sw[1], 18] : [sw[0] + 5, sw[1], 18];
  S.tube([[sw[0], sw[1], 12], lever], 0.7, { tone: "hi" }, { bias: 2 });
  S.solid(G.sphereOf(lever, 1.3, P), { tone: "hi", lit: swOn }, lever, { bias: 2.4 });

  // ── Приёмник на поролоне: плата, диод, Т-антенна ──
  S.group = "rx";
  S.box({ ...RXP, r: 2 }, 0, 5, { tone: "mid", crease: "none" }, { bevel: 0.6 });
  pcb(S, { x: RXP.x + 4, y: RXP.y + 5, w: 12, d: 15, r: 1 }, 5, { chips: [{ x: RXP.x + 10, y: RXP.y + 12, w: 5, d: 5, h: 0.8 }] });
  const ant = [RXP.x + 7, RXP.y + 8];
  S.tube([[ant[0], ant[1], 6.8], [ant[0], ant[1], 20]], 0.45, { tone: "hi" });
  S.tube([[ant[0], ant[1] - 7, 20], [ant[0], ant[1] + 7, 20]], 0.6, { tone: "hi" });
  S.raw([RXP.x + 14, RXP.y + 17, 7.2], `<g data-part="rxled"></g>`, { bias: 4 });

  // ── Провода приёмник → полётник (цвет и ошибка — каждый кадр) ──
  S.group = "wire";
  S.raw([(RXP.x + FCP[0]) / 2 + 6, (RXP.y + FCP[1]) / 2, 4], `<g data-part="wires"></g>`, { bias: 2 });

  // ── Рама с моторами и полётником (на коробке, пока борт наклонён) ──
  S.group = "drone";
  const [cx, cy] = DR;
  const tilt = c === "angle" && M.phase !== "done" ? 0.26 : 0;
  const zAt = (x) => DZ + (x - cx) * Math.tan(tilt);
  if (tilt) S.box({ x: cx + 4, y: cy - 16, w: 22, d: 32, r: 1.5 }, 0, 10, { tone: "mid" }, { bevel: 0.4 });
  else S.box({ x: cx - 11, y: cy - 11, w: 22, d: 22, r: 2 }, 0, DZ - 3, { tone: "lo" }, { bevel: 0.4 });
  const mot = [[cx + 24, cy + 24], [cx + 24, cy - 24], [cx - 24, cy + 24], [cx - 24, cy - 24]];
  const bodyZ = zAt(cx);
  pcb(S, { x: cx - 13, y: cy - 13, w: 26, d: 26, r: 2 }, bodyZ, { chips: [{ x: cx - 2, y: cy - 2, w: 9, d: 9, h: 1.2, dot: true }] });
  for (const [mx, my] of mot) S.tube([[cx, cy, bodyZ + 0.8], [mx, my, zAt(mx) + 0.8]], 1.8, { tone: "mid", maxLength: 30 });
  const motTops = mot.map(([mx, my], i) => [mx, my, motor(S, mx, my, zAt(mx), { r: 7, h: 7, ribs: 12 }).top, i]);
  const padTf = k.topMatrix([FCP[0] + 9.5, FCP[1] + 7], bodyZ + 1.65, P, "y");
  S.raw([FCP[0] + 8, FCP[1], bodyZ + 1.7], `<g transform="${padTf}">${["G", "5V", "T2", "R2"].map((n, i) => `<rect x="${(1 + i * 3.2).toFixed(1)}" y="0.4" width="2.2" height="2.2" rx="0.4" class="ac-pad"/>${txt((2.1 + i * 3.2).toFixed(1), 4.6, n, "ac-padt", "middle")}`).join("")}</g>`, { bias: 3 });
  S.raw([cx, cy, bodyZ + 20], `<g data-part="motors"></g>`, { bias: 30 });

  S.group = null;
  S.raw([0, 0, 400], `<g data-part="callout"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Стол разбора «бинд есть, арма нет»: пульт с модулем ELRS и экраном, приёмник, провода к полётнику, рама с моторами, ноутбук с Betaflight.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Пульт и модуль ELRS", [SP.x + SP.w, SP.y + SP.d / 2, SP.z0 + SP.h * 0.6], "Передатчик шлёт стики и тумблеры. Диод модуля — шаг ⓪, экран с настройками — шаг ④."],
    ["Тумблер ARM", [sw[0], sw[1], 15], "Канал AUX1 (CH5). Им армят — в конце разбора, чтобы проверить результат."],
    ["Приёмник ELRS", [RXP.x + RXP.w / 2, RXP.y + RXP.d / 2, 8], "Ловит пульт и по проводу отдаёт команды полётнику. Диод — шаг ⓪."],
    ["Провода к полётнику", [(RXP.x + FCP[0]) / 2 + 6, (RXP.y + FCP[1]) / 2, 4], "G, 5V — как есть; TX приёмника → R2, RX → T2: крест-накрест (шаг ①)."],
    ["Полётник на раме", [cx, cy, bodyZ + 3], "Получает команды и решает, можно ли армиться. Флаги запрета — шаг ⑥."],
    ["Ноутбук · Betaflight", [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h], "Вкладки «Порты», «Приёмник», «Режимы», «Система» — шаги ②, ③, ⑤, ⑥."],
  ]);
  return { svg, P, labels, model: M, live: { motTops, txled: [mod.x + mod.w, mod.y + 3, 15.5], rxled: [RXP.x + 14, RXP.y + 17, 7.2], bodyZ }, parts: S.count() };
}

// Всё состояние разбора скрытое: им управляет панель (act). day и phase пересобирают сцену.
export const defaults = { day: 1, step: -1, phase: "intro", ans: "", mistakes: 0, log: "", scored: 0, streak: 0 };
export const controls = [
  { id: "proc", label: "Панель разбора", type: "hidden" },
  { id: "day", label: "Дело", type: "hidden", rebuild: true },
  { id: "phase", label: "Этап", type: "hidden", rebuild: true },
];
export const tour = [];

export function controller(root, built, state) {
  const P = built.P, L = built.live;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const bfEl = q("bf"), pscrEl = q("pscr"), motEl = q("motors"), txLed = q("txled"), rxLed = q("rxled"), wiresEl = q("wires"), calloutEl = q("callout");
  const svgEl = root.querySelector("svg");
  const items = svgEl ? [...svgEl.querySelectorAll(".it[data-g]")] : [];
  let M = caseModel(state);
  // Серия: засчитываем первое закрытие дела.
  if (M.solved && Number(state.scored) !== Number(state.day)) {
    state.streak = Number(state.streak || 0) + 1;
    state.scored = Number(state.day);
  }
  const sim = { t: 0, cam: null, camKey: "", focusKey: "" };
  const now = () => (typeof performance === "object" ? performance.now() : 0);
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      M = caseModel(st);
      const c = M.c, step = M.phase === "intro" || M.phase === "done" ? -1 : M.step;
      const sid = step >= 0 ? STEPS[step].id : "";
      // Камера на телефоне: 6 с после перехода к шагу — к месту проверки.
      const key = `${st.day}:${step}:${M.phase}`;
      if (key !== sim.camKey) {
        sim.camKey = key;
        sim.cam = step >= 0 || M.phase === "done" ? now() : null;
      }
      // Подсветка: ярко — то, что проверяем на этом шаге.
      const look = step >= 0 ? STEPS[step].look : M.phase === "done" ? ["drone", "laptop"] : [];
      const fk = look.join(",");
      if (svgEl && fk !== sim.focusKey) {
        sim.focusKey = fk;
        if (look.length) svgEl.setAttribute("data-focus", "step");
        else svgEl.removeAttribute("data-focus");
        items.forEach((el) => (look.includes(el.dataset.g) ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
      }
      // Диоды: модуль пульта горит; приёмник в деле Model Match мигает трижды.
      const blink3 = (sim.t % 1.6) < 0.9 && Math.floor((sim.t % 1.6) * 6.6) % 2 === 0;
      txLed.innerHTML = ledSvg(k.iso(L.txled, P), true, false);
      rxLed.innerHTML = ledSvg(k.iso(L.rxled, P), calm || c !== "mm" ? true : blink3, c === "mm");
      // Экраны.
      bfEl.innerHTML = screenSvg(sid, c, M);
      pscrEl.innerHTML = pultSvg(sid, c);
      // Провода: цвета по назначению; в деле «wire» с шага ① — красный пунктир, после ремонта — правильно.
      const from = (i) => [RXP.x + 15, RXP.y + 8 + i * 2.6, 7];
      const to = { G: [FCP[0] + 7, FCP[1] + 5.6], V: [FCP[0] + 7, FCP[1] + 2.4], T2: [FCP[0] + 7, FCP[1] - 0.8], R2: [FCP[0] + 7, FCP[1] - 4] };
      const repaired = c === "wire" && (M.phase === "arm" || M.phase === "done");
      const crossed = c === "wire" && !repaired;
      const routes = [[0, "G", "lo"], [1, "V", "red"], [2, crossed ? "T2" : "R2", "tx"], [3, crossed ? "R2" : "T2", "rxw"]];
      const showBad = crossed && M.phase !== "intro" && M.step >= SI.wire;
      let w = "";
      for (const [i, pad, tone] of routes) {
        const a = from(i), b = to[pad];
        const mid = [(a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 + (i - 1.5) * 1.6, 2];
        w += `<path class="ac-wire ${showBad && i >= 2 ? "bad" : tone}" d="M${[a, mid, [b[0], b[1], L.bodyZ + 1.7]].map((p) => k.iso(p, P).map((v) => v.toFixed(1)).join(" ")).join("L")}"/>`;
      }
      wiresEl.innerHTML = w;
      // Выноска на шаге ①: куда идут TX и RX приёмника — крупно, рядом с площадками.
      let co = "";
      if (sid === "wire") {
        const a = k.iso([FCP[0] + 8, FCP[1] - 2, L.bodyZ + 2], P);
        const bad = crossed;
        const x = a[0] - 59, y = a[1] - 58;
        co = `<path class="ac-lead" d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${a[0].toFixed(1)} ${(y + 32).toFixed(1)}"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="118" height="32" rx="6" class="ac-call ${bad ? "bad" : "ok"}"/>${txt(x + 8, y + 13, `TX приёмника → ${bad ? "T2 ✗" : "R2 ✓"}`, "ac-callt")}${txt(x + 8, y + 26, `RX приёмника → ${bad ? "R2 ✗" : "T2 ✓"}`, "ac-callt")}`;
      }
      calloutEl.innerHTML = co;
      // Моторы: дело закрыто (и это не Motor Stop) — крутятся на холостом ходу.
      let mm = "";
      if (M.armed && c !== "mstop") {
        const ph = calm ? 0 : sim.t * 9;
        for (const [x, y, z, i] of L.motTops) mm += `<path class="ac-spin" style="stroke-dashoffset:${((ph + i) * 4).toFixed(1)}" d="${k.ring(x, y, 7.5, z + 0.6, P, 28)}"/>`;
      }
      motEl.innerHTML = mm;
      return true;
    },
    follow() {
      if (!sim.cam || now() - sim.cam > 6000) return null;
      if (M.phase === "done") {
        const a = k.iso([DR[0], DR[1], DZ + 6], P);
        return [a[0], a[1], 1.7];
      }
      const id = STEPS[M.step] ? STEPS[M.step].id : "";
      if (!id) return null;
      const lap = ["ports", "rx", "modes", "flags"].includes(id);
      const p = lap ? [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h * 0.55] : id === "pult" ? [PULT[0] - 10, PULT[1], 20] : id === "bind" ? [(RXP.x + PULT[0]) / 2, (RXP.y + PULT[1]) / 2, 12] : [FCP[0] + 8, FCP[1] + 6, DZ + 14];
      const a = k.iso(p, P);
      return [a[0], a[1], id === "bind" ? 1.6 : lap ? 1.7 : 1.8];
    },
    // Панель разбора: шаги, «что делаешь», «что видишь», выбор вывода, исправление, проверка, итог.
    panel(st) {
      const m = caseModel(st);
      const C = m.C;
      const log = String(st.log || "");
      const at = SI[C.at];
      const pills = STEPS.map((s, i) => {
        const cls = i < log.length ? `done ${log[i]}` : m.phase === "done" && i === at ? "done b" : (m.phase === "fix" || m.phase === "arm") && i === at ? "done b" : m.phase === "look" && i === m.step ? "cur" : "";
        return `<li class="${cls}" title="${s.name}">${s.n}</li>`;
      }).join("");
      let h = `<div class="proc-top"><b>Дело №${st.day}</b><span>ошибок: ${m.mistakes}</span></div><ol class="proc-steps" aria-label="Шаги разбора">${pills}</ol>`;
      const ans = String(st.ans || "");
      if (m.phase === "intro") {
        h += `<div class="proc-card"><h4>Симптом</h4><p class="proc-see">Бинд есть: пульт пишет «связь есть», диоды горят. Щёлкаю тумблером ARM — моторы молчат, на OSD DISARMED.</p><p><b>С чего начать.</b> Бинд — это радио пульт ↔ приёмник. Арм — команда, которую полётник получил и разрешил. Значит, обрыв где-то после приёмника. Идём по пути команды, от простого к сложному, и ничего не меняем, пока не нашли причину.</p><button type="button" class="proc-go" data-fig-act="start">Начать с шага ⓪</button></div>`;
        return h;
      }
      if (m.phase === "done") {
        const path = STEPS.slice(0, at + 1).map((s, i) => `${s.n} ${i < at ? (log[i] === "h" ? "улика" : "норма") : "причина"}`).join(" → ");
        h += `<div class="proc-card done"><h4>${m.c === "mstop" ? "Это была не поломка" : "Дело закрыто: ARMED"}</h4><p><b>Причина:</b> ${C.title}.</p><p><b>Исправление:</b> ${C.fix[0][0]}.</p><p><b>Твой путь:</b> ${path}.</p><p class="proc-memo"><b>Запомни:</b> ${MEMO[c2fam(m.c)]}</p><p class="proc-small">Ошибок в выводах и исправлении: ${m.mistakes}.</p><button type="button" class="proc-go" data-fig-act="next">Следующее дело →</button></div>`;
        return h;
      }
      const s = STEPS[m.step];
      const [tone, seen] = evidence(s.id, m.c);
      if (m.phase === "look") {
        let fb = "";
        if (ans.startsWith("w:")) fb = `<p class="proc-fb bad">✗ ${wrongWhy(ans.slice(2), tone, seen)}</p>`;
        if (ans.startsWith("p:")) {
          const [pi, pt] = ans.slice(2).split(":");
          fb = `<p class="proc-fb ok">✓ Шаг ${STEPS[Number(pi)].n}: ${pt === "h" ? "верно, это улика — запомнили" : "верно, норма"}.</p>`;
        }
        h += `${fb}<div class="proc-card"><h4>Шаг ${s.n} · ${s.name}</h4><p class="proc-do"><b>Что делаешь:</b> ${s.do}</p><p class="proc-see"><b>Что видишь:</b> ${seen}</p><p class="proc-q"><b>Твой вывод?</b></p>${CHOICES.map(([id, label]) => `<button type="button" class="proc-opt" data-fig-act="i:${id}">${label}</button>`).join("")}</div>`;
        return h;
      }
      if (m.phase === "fix") {
        let fb = "";
        if (ans.startsWith("f:")) fb = `<p class="proc-fb bad">✗ ${C.fix[Number(ans.slice(2))][1]}</p>`;
        h += `<p class="proc-fb ok">✓ Причина найдена на шаге ${s.n}: ${seen}</p>${fb}<div class="proc-card"><h4>Как исправить?</h4>${fixOrder(st.day).map((i) => `<button type="button" class="proc-opt" data-fig-act="f:${i}">${C.fix[i][0]}</button>`).join("")}</div>`;
        return h;
      }
      if (m.phase === "arm") {
        h += `<p class="proc-fb ok">✓ Исправлено: ${C.fix[0][0]}.</p><div class="proc-card"><h4>Проверь результат</h4><p>Ремонт закончен, только когда результат проверен. ${m.c === "armsw" ? "Тумблер уже выключен — " : ""}подай питание (пропеллеры сняты!) и щёлкни тумблером ARM.</p><button type="button" class="proc-go" data-fig-act="arm">Щёлкнуть тумблером ARM</button></div>`;
        return h;
      }
      return h;
    },
    act(a, st, apply) {
      const m = caseModel(st);
      if (a === "start") return apply({ step: 0, phase: "look", ans: "", log: "", mistakes: 0 });
      if (a === "next") return apply(SETUP((Number(st.day) % 30) + 1));
      if (a === "arm" && m.phase === "arm") return apply({ phase: "done", ans: "" });
      if (a.startsWith("i:") && m.phase === "look") {
        const choice = a.slice(2);
        const [tone] = evidence(STEPS[m.step].id, m.c);
        if (choice !== EXPECT[tone]) return apply({ ans: `w:${choice}`, mistakes: m.mistakes + 1 });
        if (tone === "bad") return apply({ phase: "fix", ans: "" });
        const mark = tone === "hint" ? "h" : "o";
        return apply({ step: m.step + 1, log: String(st.log || "") + mark, ans: `p:${m.step}:${mark}` });
      }
      if (a.startsWith("f:") && m.phase === "fix") {
        const i = Number(a.slice(2));
        if (i !== 0) return apply({ ans: `f:${i}`, mistakes: m.mistakes + 1 });
        return apply({ phase: "arm", ans: "" });
      }
    },
    facts() {
      return { solved: M.solved, day: Number(state.day), mistakes: M.mistakes, c: M.c, flag: M.C.flag };
    },
    readout() {
      if (M.phase === "intro") return `Дело №${state.day} · бинд есть · ✗ арма нет`;
      if (M.phase === "done") return `Дело №${state.day} · ✓ ${M.c === "mstop" ? "ARMED, моторы ждут газа" : "ARMED"} · ошибок ${M.mistakes}`;
      const s = STEPS[M.step];
      return `Дело №${state.day} · шаг ${s.n} ${s.name.toLowerCase()} · ошибок ${M.mistakes}`;
    },
    explain(chip) {
      if (/^шаг/.test(chip) && STEPS[M.step]) return STEPS[M.step].do;
      if (/ARMED/.test(chip)) return `Причина была: ${M.C.title}.`;
      if (/арма нет/.test(chip)) return "Тумблер ARM щёлкает, а моторы молчат. Начни разбор в панели.";
      if (/ошибок/.test(chip)) return "Сколько раз вывод или исправление были неверными. Цель — ноль.";
      return "";
    },
    metrics() {
      return [
        ["Шаг", M.phase === "intro" ? "симптом" : M.phase === "done" ? "дело закрыто" : `${STEPS[M.step].n} ${STEPS[M.step].name}`, ""],
        ["Этап", { intro: "начало", look: "смотрю и делаю вывод", fix: "выбираю исправление", arm: "проверяю тумблером", done: "готово" }[M.phase], ""],
        ["Ошибок", String(M.mistakes), "цель 0"],
        ["Дел закрыто", String(state.streak || 0), ""],
      ];
    },
    note() {
      return "Разбор идёт по пути команды: пульт → приёмник → провод → полётник (порты, приёмник) → пульт (Mixes) → режимы → флаги. На каждом шаге сначала смотри и делай вывод; исправляй только найденную причину.";
    },
  };
}

function ledSvg(p, on, warn) {
  const [x, y] = p;
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.4" ry="1.5" class="led${on ? (warn ? " warn" : " on") : ""}"/>${on ? `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5" ry="3" class="pr-glow${warn ? " warn" : ""}"/>` : ""}`;
}

// Экран пульта: главный экран; на шаге ④ — настройки модели (ошибка красным).
function pultSvg(sid, c) {
  const pw = 48;
  const rows = sid === "pult"
    ? [["External RF", "CRSF", false], ["Model Match", c === "mm" ? "ON · №1" : "OFF", c === "mm"], ["Mixes: CH5", c === "mix" ? "—" : "← SA", c === "mix"], ["Телеметрия", c === "foreign" ? "нет" : "LQ 100", c === "foreign"]]
    : [["Модель", "№1 · ELRS", false], ["Связь", c === "foreign" ? "нет" : "есть", c === "foreign" && sid === "bind"], ["RSSI", c === "foreign" ? "—" : "−58 dBm", false], ["LQ", c === "foreign" ? "—" : "100 %", false]];
  let s = txt(2, 4.4, sid === "pult" ? "НАСТРОЙКИ МОДЕЛИ" : "ПУЛЬТ", "ac-ph");
  rows.forEach(([a, b, bad], i) => (s += txt(2, 9.6 + i * 4.4, a, "ac-pt") + txt(pw - 2, 9.6 + i * 4.4, b, `ac-pt b${bad ? " bad" : ""}`, "end")));
  return s;
}

// Экран Betaflight: вкладка текущего шага; на остальных шагах — «подключено».
function screenSvg(sid, c, M) {
  const w = SW;
  const noData = NO_DATA.includes(c);
  let s = "";
  const head = (t) => txt(3, 7, t, "bf-t");
  if (sid === "ports") {
    s += head("Порты");
    [1, 2, 3].forEach((u, i) => {
      const on = (c === "port" ? 1 : 2) === u;
      const y = 15 + i * 8;
      s += txt(4, y, `UART${u}`, "bd-r") + txt(30, y, "Serial RX", "bd-r") + `<rect x="${w - 22}" y="${y - 4}" width="10" height="5" rx="2.5" class="ac-tog${on ? " on" : ""}"/><circle cx="${on ? w - 14.5 : w - 19.5}" cy="${y - 1.5}" r="2" class="ac-togk"/>`;
    });
    s += txt(4, 40, "приёмник припаян к UART2 (T2/R2)", "bd-r");
  } else if (sid === "rx") {
    s += head("Приёмник") + txt(w - 3, 7, `${c === "proto" ? "SBUS" : "CRSF"} · ${c === "order" ? "TAER" : "AETR"}`, `bf-t ${c === "proto" || c === "order" ? "bad" : ""}`, "end");
    const vals = noData ? null : { A: 1500, E: 1500, T: c === "order" ? 1500 : c === "thr" ? 1100 : 1000, R: 1500, AUX1: c === "mix" ? 1500 : 2000 };
    ["A", "E", "T", "R", "AUX1"].forEach((n, i) => {
      const y = 11 + i * 6.2;
      s += txt(3, y + 3.6, { A: "Крен", E: "Тангаж", T: "Газ", R: "Рыскание", AUX1: "AUX1" }[n], "bd-r") + `<rect x="30" y="${y}" width="${w - 52}" height="4.2" rx="2" class="bf-track"/>`;
      if (vals) s += `<rect x="30" y="${y}" width="${(((vals[n] - 1000) / 1000) * (w - 52)).toFixed(1)}" height="4.2" rx="2" class="bf-bar${n === "T" && vals.T > 1050 ? " bad" : ""}"/>` + txt(w - 3, y + 3.8, String(vals[n]), "bd-r", "end");
    });
    if (!vals) s += txt(w / 2, 26, "каналы не приходят", "bf-t bad", "middle");
  } else if (sid === "modes") {
    s += head("Режимы");
    const rows = [["ARM", c === "armaux" ? "AUX2" : "AUX1", c === "range" ? [1300, 1700] : [1700, 2100]]];
    if (c === "prearm") rows.push(["PREARM", "AUX3", [1700, 2100]]);
    rows.forEach(([name, ch, [lo, hi]], i) => {
      const y = 13 + i * 13, x0 = 30, ww = w - 40, X = (v) => x0 + ((v - 900) / 1200) * ww;
      const bad = (name === "PREARM" && c === "prearm") || (name === "ARM" && (c === "armaux" || c === "range"));
      s += txt(3, y + 4, name, `bf-t${bad ? " bad" : ""}`) + txt(3, y + 10, ch, "bd-r") + `<rect x="${x0}" y="${y}" width="${ww}" height="6" rx="1" class="bf-track"/><rect x="${X(lo).toFixed(1)}" y="${y}" width="${(X(hi) - X(lo)).toFixed(1)}" height="6" rx="1" class="ac-range"/>`;
      const v = name === "ARM" ? (c === "armaux" ? 1000 : 2000) : 1000;
      s += `<rect x="${(X(v) - 0.8).toFixed(1)}" y="${y - 1.5}" width="1.6" height="9" class="ac-mark"/>` + txt(X(lo) + 1, y + 10.5, `${lo}–${hi}`, "bd-r");
    });
    s += txt(3, 41, "красная метка — где сейчас тумблер", "bd-r");
  } else if (sid === "flags") {
    s += head("Система · флаги");
    const flags = [];
    if (CAUSES[c].flag) flags.push(CAUSES[c].flag);
    flags.push("MSP");
    let x = 3;
    for (const f of flags) {
      const fw = f.length * 2.5 + 3;
      s += `<rect x="${x.toFixed(1)}" y="11" width="${fw.toFixed(1)}" height="6" rx="1.6" class="bd-flag${f === "MSP" ? " ok" : ""}"/>` + txt(x + fw / 2, 15.4, f, "bd-ft", "middle");
      x += fw + 2;
    }
    s += txt(3, 24, "MSP — подключён компьютер: это норма", "bd-r");
    if (c === "mstop") s += txt(3, 31, "OSD: ARMED · Motor Stop — ВКЛ", "bd-r");
  } else if (M.phase === "done") {
    s += head("Betaflight") + txt(w / 2, 26, M.c === "mstop" ? "ARMED · моторы ждут газа" : "ARMED", "bf-t good", "middle");
  } else {
    s += head("Betaflight · подключено по USB") + txt(4, 18, "Вкладки откроются на своих шагах:", "bd-r") + txt(4, 25, "② Порты   ③ Приёмник", "bd-r") + txt(4, 31, "⑤ Режимы   ⑥ Система", "bd-r");
  }
  return s;
}
