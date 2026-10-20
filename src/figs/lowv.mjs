// Fig: «LOW V: проверь, прежде чем чинить» (гл. 6, пилот обсуждения 001) — урок по шагам, а не перебор кнопок.
// Порядок урока — docs/content/ch06-pilot.md: ⓪ безопасность (посадка отдельно от диагноза) → смысл «покой и нагрузка» →
// показанный пример A → похожий случай B с подсказками → вспомнить объяснение (самопроверка) → новый случай C без
// подсказок → повтор после перерыва с новыми данными. Случаи, улики, исправления и контроль — данные GPT
// (docs/content/ch06-cases.json), здесь только сцена и ход урока. Звезда — за найденную причину + верное исправление +
// контроль результата; выбор слова, погасшая надпись или посадка дело не закрывают.
import { k, G, scene, basePlate, labelPlate, labelsAt } from "../figkit.mjs";
import CASES from "../../docs/content/ch06-cases.json";
import { CHAPTERS_A } from "../../data/chapters-a.mjs";

const W = 660, H = 420;
const PLATE = { x: -82, y: -108, w: 168, d: 218, r: 8 };
const SCR = { x: -76, y: -62, w: 4, d: 100, z0: 4, h: 52 }; // ноутбук с Betaflight
const SW = SCR.d - 8;
const MON = { x: -6, y: -104, w: 5, d: 40, z0: 3, h: 30 }; // экран OSD полётника
const MET = { x: 26, y: -40, w: 7, d: 24, z0: 0, h: 34 }; // независимый мультиметр
const BAT = { x: 16, y: 34, w: 24, d: 44, r: 3 }; // аккумулятор 6S
const BATH = 22;
const TH = [58, 70]; // термометр

export const STEPS = CASES.STEPS.map((s, i) => ({ ...s, n: "①②③④⑤"[i] }));
const SI = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
const LOOK = { inspect: ["bat"], voltage: ["meter", "osd"], cells: ["bf", "bat"], load: ["bf"], compare: ["bf", "temp"] };
const SC = Object.fromEntries(CASES.SCENARIOS.map((s) => [s.id, s]));
// Вопрос для «вспомни» — ch06-q13 реестра GPT; текст и ответ берём из самой главы 6 (они совпадают, реестр большой).
const Q13 = (() => {
  const ch = CHAPTERS_A.find((c) => c.id === "6");
  const q = ch && (ch.questions || []).find((x) => x.q === CASES.lesson_flow.recall.prompt);
  return q ? { question: q.q, current_answer: q.a } : { question: CASES.lesson_flow.recall.prompt, current_answer: "" };
})();
const LATER_MIN = 30; // перерыв перед повтором, минут
const LKEY = "fpv-ch6-lowv";

export const LESSON = [
  ["entry", "Посадка"],
  ["meaning", "Смысл"],
  ["worked", "Пример"],
  ["guided", "С подсказкой"],
  ["recall", "Вспомни"],
  ["transfer", "Сам"],
  ["later", "Позже"],
];
const LI = Object.fromEntries(LESSON.map(([id], i) => [id, i]));

const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const f2 = (v) => v.toFixed(2).replace(".", ",");

// Повтор позже: та же форма дела, новые числа (учебные). Причина может совпасть с прежней.
function laterScenario(seed) {
  const n = Number(seed) || 1;
  if (n % 2) {
    const s = 4, rest = 16.8, I = 25, cold = 13.6, ctl = 15.6;
    const base = SC.guided_temperature_B;
    return {
      ...base, id: "later_temperature", mode: "later", help: { kind: "none_until_attempt_complete" },
      example: { ...base.example, cells_actual: s, cells_configured: s, rest_V: rest, current_A: I, cold_load_V: cold, control_load_V: ctl },
      evidence: {
        inspect: ["ok", "По учебной записи повреждений нет."],
        voltage: ["ok", `FC и независимый прибор согласованы: в покое ${f1(rest)} В.`],
        cells: ["ok", `Маркировка и измерения подтверждают ${s}S; в настройке тоже ${s}S.`],
        load: ["hint", `При ${I} А оба прибора показывают ${f1(cold)} В. Просадка есть, но одна она причину не отличает.`],
        compare: ["bad", `При том же заряде, токе и соединениях в допустимых контрольных условиях — ${f1(ctl)} В вместо ${f1(cold)} В. Различающий контроль подтверждает температурный эффект.`],
      },
    };
  }
  const real = 4, set = 5, tot = 16.0;
  const base = SC.transfer_cell_count_C;
  return {
    ...base, id: "later_cell_count", mode: "later",
    example: { ...base.example, cells_actual: real, cells_configured: set, measured_total_V: tot, fc_total_V: tot },
    evidence: {
      inspect: ["ok", "По учебной записи батарея не повреждена."],
      voltage: ["ok", `FC и независимый прибор показывают ${f1(tot)} В в одних условиях.`],
      cells: ["bad", `Подтверждены ${real}S, но в настройке ${set}S. Среднее ${f1(tot)}/${set} ≈ ${f2(tot / set)} В; для реальных ${real}S оно равно ${f2(tot / real)} В.`],
      load: ["hint", "Нагрузочного измерения в этом варианте нет. По одному предупреждению просадку не объявляют измеренной."],
      compare: ["hint", "Температурный контроль в этом варианте не выполнен. Причина S подтверждается своей проверкой."],
    },
    postfix_checks: [`После повторной проверки настройка соответствует ${real}S.`, `Общее показание осталось ${f1(tot)} В и согласовано с независимым.`, `Вычисленное среднее стало ${f2(tot / real)} В; контроль выполнен, а не только выбрано слово «S».`],
  };
}
export function scenarioOf(st) {
  const flow = CASES.lesson_flow;
  if (st.stage === "worked") return SC[flow.worked.scenario_id];
  if (st.stage === "guided") return SC[flow.guided.scenario_id];
  if (st.stage === "transfer") return SC[flow.transfer.scenario_id];
  if (st.stage === "later") return laterScenario(st.seed);
  return null;
}
// Порядок вариантов перемешан (верный не всегда первый) и меняется от этапа и попытки.
function order(n, salt) {
  const P = n === 3 ? [[0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0]] : [[0, 1], [1, 0]];
  return P[(salt * 7 + 3) % P.length];
}
const EXPECT = { ok: "ok", hint: "clue", bad: "here" };
const CHOICES = [["ok", "Норма — дальше"], ["clue", "Улика, но причина не здесь — дальше"], ["here", "Причина здесь — исправляю"]];
function wrongWhy(choice, tone, text) {
  if (tone === "ok") return choice === "here" ? `Здесь всё по норме: ${text} Чинить то, что работает, нельзя — добавишь новую неисправность.` : `Здесь ничего необычного: ${text}`;
  if (tone === "bad") return `Посмотри ещё раз: ${text} Это и есть подтверждение причины.`;
  return choice === "here" ? `Отклонение есть, но оно ещё не отличает одну причину от другой: ${text} Запомни улику и проверяй дальше.` : `Не совсем норма: ${text} Это улика.`;
}
const MEANING = {
  q: "В покое тестер показал 25,2 В. Под нагрузкой 40 А — 20,4 В. Что это значит?",
  options: [
    ["Под нагрузкой напряжение ниже, чем в покое, — так и должно быть. Важно, насколько и в каких условиях.", ""],
    ["Батарея неисправна: напряжение упало.", "Под нагрузкой напряжение всегда ниже покоя: часть его теряется на внутреннем сопротивлении. Само падение — не диагноз."],
    ["Один из приборов врёт.", "Числа сняты в разных состояниях — в покое и под нагрузкой. Приборы сравнивают только в одинаковых условиях."],
  ],
};
const SHORT = "Напряжение батареи без нагрузки и во время работы может отличаться. Надпись LOW V — повод проверить данные, а не готовый диагноз. Сначала сравним показания и условия, затем решим, что менять.";

const SETUP = { stage: "entry", ph: "look", step: 0, open: 0, ans: "", mistakes: 0, log: "", help: 0, prog: "", seed: 1 };
export const defaults = { ...SETUP };
export const controls = [
  { id: "proc", label: "Панель урока", type: "hidden" },
  { id: "stage", label: "Этап", type: "hidden", rebuild: true },
  { id: "seed", label: "Попытка", type: "hidden" },
];
export const tour = [];

const has = (st, t) => String(st.prog || "").split(",").includes(t);
const addProg = (st, t) => (has(st, t) ? String(st.prog || "") : [String(st.prog || ""), t].filter(Boolean).join(","));

export const meta = {
  id: "lowv",
  title: "LOW V: проверь, прежде чем чинить",
  hint: "Урок по шагам — в панели",
  proc: true,
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Ярко — то, что проверяешь на этом шаге" },
    { mark: "raised", label: "Аккумулятор, термометр, мультиметр, экран OSD полётника, ноутбук с Betaflight" },
  ],
  caption: "LOW V на экране — повод проверить, а не диагноз. Одна и та же надпись бывает от реальной просадки (например, на холоде) и от ошибки настройки (неверное число банок S). В полёте сначала безопасная посадка, причину ищут уже на столе: осмотр → два прибора → число банок → запись нагрузки → сравнение условий. Исправляют только подтверждённую причину и проверяют результат.",
  aria: "Панель урока: этапы от посадки до самостоятельного случая; на каждом шаге — что сделать, что видно и вывод на выбор, затем исправление и контроль.",
  missions: [
    { id: "safe", look: [], touch: ["proc"], see: "этап «Посадка» в панели", text: "LOW V в полёте: выбери первое действие — до поиска причины", check: (f) => f.safe },
    { id: "guided", look: [], touch: ["proc"], see: "шаги ①–⑤ и контроль в панели", text: "Реши случай с подсказками: найди причину, исправь и выполни контроль", check: (f) => f.guided },
    { id: "solo", look: [], touch: ["proc"], see: "этап «Сам» в панели", text: "Новый случай без подсказок: та же надпись, но причина может быть другой", check: (f) => f.solo },
    { id: "later", look: [], touch: ["proc"], see: "этап «Позже» — откроется через полчаса", adv: true, text: "Повтори после перерыва: новый случай с другими числами", check: (f) => f.later },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [SCR.x, SCR.y, SCR.z0 + SCR.h + 2], [SCR.x, SCR.y + SCR.d, SCR.z0 + SCR.h + 2], [MON.x, MON.y, MON.z0 + MON.h + 2], [MET.x, MET.y + MET.d, MET.h + 2], [BAT.x + BAT.w, BAT.y + BAT.d, BATH], [TH[0], TH[1], 40]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const screenOn = (S, P, R, part, cls) => {
  S.box({ ...R, r: 1.4 }, R.z0, R.h, { tone: "mid" }, { bevel: 0.4, ref: [R.x + R.w, R.y + R.d / 2, R.z0 + R.h / 2] });
  const tf = k.sideMatrix([R.x + R.w, R.y + R.d - 3], R.z0 + R.h - 3, P, "right");
  S.raw([R.x + R.w + 0.4, R.y + R.d / 2, R.z0 + R.h / 2], `<g transform="${tf}"><rect x="0" y="0" width="${R.d - 6}" height="${R.h - 6}" rx="1.2" class="${cls}"/><g data-part="${part}"></g></g>`, { bias: 4 });
};

export function render() {
  const P = projection();
  const S = scene(P);
  basePlate(S, PLATE);
  labelPlate(S, { x: 66, y: -100, w: 16, d: 20, r: 1.5 });
  // Ноутбук: вкладка «Питание и батарея» или запись полёта — по шагу.
  S.group = "bf";
  const base = { x: SCR.x + 4, y: SCR.y, w: 30, d: SCR.d, r: 2.4 };
  S.box(base, 0, 3.4, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  const keys = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) keys.push([base.x + 6 + r * 5, base.y + 10 + c * 7.4, 3.4]);
  S.dots(keys, { size: 0.5, tone: "lo" }, [base.x + 14, base.y + base.d / 2, 3.5]);
  screenOn(S, P, SCR, "bfs", "bf-screen");
  // Экран OSD полётника (что пилот видел в очках).
  S.group = "osd";
  S.box({ x: MON.x - 6, y: MON.y + 8, w: 14, d: MON.d - 16, r: 2 }, 0, 3, { tone: "lo" }, { bevel: 0.4 });
  screenOn(S, P, MON, "osds", "osd-screen");
  // Независимый мультиметр со щупами к разъёму батареи.
  S.group = "meter";
  screenOn(S, P, MET, "mets", "osd-screen");
  S.tube([[MET.x + 3, MET.y + MET.d, 4], [MET.x + 6, BAT.y - 8, 2], [BAT.x + BAT.w / 2 - 2, BAT.y - 2, 6]], 0.7, { tone: "hi", bendR: 6, maxLength: 14 });
  S.tube([[MET.x + 5, MET.y + MET.d, 4], [MET.x + 9, BAT.y - 6, 2], [BAT.x + BAT.w / 2 + 2, BAT.y - 2, 6]], 0.7, { tone: "lo", bendR: 6, maxLength: 14 });
  // Аккумулятор с наклейкой и разъёмом.
  S.group = "bat";
  S.box(BAT, 0, BATH, { tone: "hi", crease: "lo" }, { bevel: 1.2 });
  S.raw([BAT.x + BAT.w, BAT.y + BAT.d / 2, BATH / 2], `<g data-part="batl"></g>`, { bias: 3 });
  S.box({ x: BAT.x + BAT.w / 2 - 4, y: BAT.y - 6, w: 8, d: 6, r: 1 }, 4, 5, { tone: "mid" }, { bevel: 0.3 });
  // Термометр: холодно или в допустимых условиях — по шагу «контроль».
  S.group = "temp";
  S.cyl(TH[0], TH[1], 3.4, 0, 2, { tone: "mid" });
  S.tube([[TH[0], TH[1], 2], [TH[0], TH[1], 34]], 1.4, { tone: "hi" });
  S.solid(G.sphereOf([TH[0], TH[1], 4], 2.6, P), { tone: "hi" }, [TH[0], TH[1], 4], { bias: 1 });
  S.raw([TH[0], TH[1], 20], `<g data-part="therm"></g>`, { bias: 6 });
  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Стол разбора LOW V: аккумулятор, термометр, мультиметр со щупами на разъёме, экран OSD полётника, ноутбук с Betaflight.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Аккумулятор", [BAT.x + BAT.w / 2, BAT.y + BAT.d / 2, BATH], "Учебная батарея. Сначала осмотр: вздутую, мятую или горячую не нагружают и не заряжают (шаг ①). Число банок — по маркировке и измерению (шаг ③)."],
    ["Мультиметр", [MET.x + MET.w, MET.y + MET.d / 2, MET.h * 0.7], "Независимый прибор. Если он и полётник показывают одно и то же общее напряжение, само измерение верно (шаг ②)."],
    ["OSD полётника", [MON.x + MON.w, MON.y + MON.d / 2, MON.z0 + MON.h * 0.7], "Что видел пилот: общее напряжение, среднее на банку и надпись LOW V. Среднее = общее ÷ число банок в настройке."],
    ["Ноутбук · Betaflight", [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h], "Вкладка питания: сколько банок указано в настройке (шаг ③). Запись полёта: напряжение под током (шаг ④) и сравнение условий (шаг ⑤)."],
    ["Термометр", [TH[0], TH[1], 30], "Условия опыта. Холод — улика, но не диагноз: подтверждает только сравнение при том же заряде, токе и соединениях (шаг ⑤)."],
  ]);
  return { svg, P, labels, live: {}, parts: S.count() };
}

// Что показывают приборы на текущем шаге (учебные данные случая).
function readings(sc, sid, solved) {
  const ex = sc.example;
  const set = solved && sc.cause_id === "cell_count" ? ex.cells_actual : ex.cells_configured;
  const total = ex.measured_total_V ?? (sid === "load" ? ex.cold_load_V : sid === "compare" ? ex.control_load_V : ex.rest_V);
  const osdTotal = ex.fc_total_V ?? (sid === "compare" && solved ? ex.control_load_V : ex.cold_load_V);
  const avg = osdTotal / set;
  return { total, osdTotal, set, avg, low: avg < ex.profile_warning_cell_V };
}
function bfScreen(sc, sid, solved) {
  const w = SW, ex = sc ? sc.example : null;
  const head = (t) => txt(3, 7, t, "bf-t");
  if (!ex || !sid) return head("Betaflight · подключено") + txt(4, 18, "Вкладки и записи откроются", "bd-r") + txt(4, 25, "на своих шагах разбора.", "bd-r");
  if (sid === "cells" || sid === "inspect" || sid === "voltage") {
    const r = readings(sc, sid, solved);
    const bad = sid === "cells" && ex.cells_configured !== ex.cells_actual && !solved;
    return head("Питание и батарея") + txt(4, 17, "Общее напряжение", "bd-r") + txt(w - 3, 17, `${f1(r.osdTotal)} В`, "bd-r", "end") + (sid === "cells" ? txt(4, 25, "Элементов в настройке", "bd-r") + txt(w - 3, 25, `${r.set}S`, `bf-t${bad ? " bad" : ""}`, "end") + txt(4, 33, "Среднее на банку", "bd-r") + txt(w - 3, 33, `${f2(r.avg)} В`, `bd-r${r.low ? " bad" : ""}`, "end") + txt(4, 41, "предупреждение учебного профиля: " + f1(ex.profile_warning_cell_V) + " В", "bd-r") : txt(4, 27, "число банок — на шаге ③", "bd-r"));
  }
  const X0 = 6, X1 = w - 6, Y0 = 38, Y1 = 12;
  const vmin = 3.0, vmax = 4.4;
  const y = (v) => Y0 - ((v - vmin) / (vmax - vmin)) * (Y0 - Y1);
  if (ex.rest_V == null) return head(sid === "load" ? "Запись полёта" : "Сравнение условий") + txt(w / 2, 26, sid === "load" ? "нагрузочной записи нет" : "контроль не выполнялся", "bf-t", "middle");
  const s = ex.cells_actual, rest = ex.rest_V / s, cold = ex.cold_load_V / s, ctl = ex.control_load_V / s;
  const line = (v, cls) => `<path class="${cls}" d="M${X0} ${y(rest).toFixed(1)}L${(X0 + 14).toFixed(1)} ${y(rest).toFixed(1)}L${(X0 + 18).toFixed(1)} ${y(v).toFixed(1)}L${X1} ${y(v).toFixed(1)}"/>`;
  let g = head(sid === "load" ? `Запись: ${ex.current_A} А` : `Сравнение при ${ex.current_A} А`) + `<path class="bf-track" d="M${X0} ${Y0}H${X1}"/>`;
  g += `<path class="lv-warn" d="M${X0} ${y(ex.profile_warning_cell_V).toFixed(1)}H${X1}"/>` + txt(X1, y(ex.profile_warning_cell_V) - 1.2, `${f1(ex.profile_warning_cell_V)} В/банку`, "bd-r", "end");
  g += line(cold, "lv-cold") + txt(X0 + 20, y(cold) + 4.2, `холодно: ${f1(ex.cold_load_V)} В`, "bd-r");
  if (sid === "compare") g += line(ctl, "lv-ctl") + txt(X0 + 20, y(ctl) - 1.6, `контроль: ${f1(ex.control_load_V)} В`, "bd-r");
  return g + txt(X0, y(rest) - 1.6, `покой ${f1(ex.rest_V)} В`, "bd-r");
}
function osdScreen(sc, sid, solved, entry, blink) {
  const w = MON.d - 6;
  if (entry) return txt(w / 2, 9, "ПОЛЁТ", "ac-ph", "middle") + (blink ? txt(w / 2, 17, "LOW V", "lv-osd bad", "middle") : "") + txt(w / 2, 23, "надпись мигает", "ac-pt", "middle");
  if (!sc || !sid || sid === "inspect") return txt(w / 2, 13, "OSD", "ac-ph", "middle") + txt(w / 2, 20, "запись полёта", "ac-pt", "middle");
  const r = readings(sc, sid, solved);
  return txt(2, 6, "OSD", "ac-ph") + txt(w - 2, 6, `${f1(r.osdTotal)} В`, "ac-pt b", "end") + txt(2, 12, "на банку", "ac-pt") + txt(w - 2, 12, `${f2(r.avg)} В`, `ac-pt b${r.low ? " bad" : ""}`, "end") + (r.low ? txt(w / 2, 20, "LOW V", "lv-osd bad", "middle") : txt(w / 2, 20, "норма", "lv-osd good", "middle"));
}
function meterScreen(sc, sid, solved) {
  const w = MET.d - 6;
  if (!sc || !sid || sid === "inspect") return txt(w / 2, 14, "— — —", "lv-dig", "middle");
  const r = readings(sc, sid, solved);
  return txt(w / 2, 13, f1(r.total), "lv-dig", "middle") + txt(w / 2, 21, "V", "ac-pt", "middle");
}

export function controller(root, built, state) {
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const bfEl = q("bfs"), osdEl = q("osds"), metEl = q("mets"), batEl = q("batl"), thEl = q("therm");
  const svgEl = root.querySelector("svg");
  const items = svgEl ? [...svgEl.querySelectorAll(".it[data-g]")] : [];
  const sim = { t: 0, focusKey: "", cam: null, camKey: "" };
  const now = () => (typeof performance === "object" ? performance.now() : 0);
  const store = { get() { try { return JSON.parse(localStorage.getItem(LKEY) || "{}"); } catch (e) { return {}; } }, set(v) { try { localStorage.setItem(LKEY, JSON.stringify(v)); } catch (e) {} } };
  // Пройденные этапы и текущий этап хранятся в браузере: к «повтору позже» возвращаются через полчаса, а не с начала.
  const saved = store.get();
  if (!String(state.prog || "") && saved.prog) Object.assign(state, { prog: saved.prog, stage: saved.stage || "entry", seed: saved.seed || 1, ph: "look", step: 0, open: 0, ans: "", log: "", help: 0, mistakes: 0 });
  const remember = (next) => store.set({ ...store.get(), prog: next.prog, stage: next.stage, seed: next.seed });
  const laterLeft = () => { const t = store.get().soloAt; return t ? Math.max(0, LATER_MIN - (Date.now() - t) / 60000) : LATER_MIN; };
  const curStep = (st) => (scenarioOf(st) && st.ph === "look" && st.open ? STEPS[st.step].id : scenarioOf(st) && st.ph !== "look" ? scenarioOf(st).at : "");
  const solvedNow = (st) => st.ph === "solved";
  let recallText = "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function panelScenario(st, sc) {
    const step = Number(st.step), ph = st.ph || "look", log = String(st.log || ""), ans = String(st.ans || "");
    const at = SI[sc.at];
    const pills = STEPS.map((s, i) => `<li class="${i < log.length ? `done ${log[i]}` : ph !== "look" && i === at ? "done b" : ph === "look" && i === step ? "cur" : ""}" title="${s.name}">${s.n}</li>`).join("");
    const mode = sc.mode;
    let h = `<ol class="proc-steps" aria-label="Шаги разбора">${pills}</ol>`;
    if (mode === "worked") {
      // Показанный пример: шаги открываются по очереди, вывод объяснён, ученик только прослеживает.
      if (ph === "look") {
        const s = STEPS[step], [tone, seen] = sc.evidence[s.id];
        const verdict = tone === "ok" ? "норма" : tone === "hint" ? "улика — запоминаем, но причина ещё не доказана" : "причина подтверждена";
        h += `<div class="proc-card"><h4>Пример · шаг ${s.n} ${s.name}</h4><p class="proc-do"><b>Что делаем:</b> ${s.do}</p><p class="proc-see"><b>Что видим:</b> ${seen}</p><p><b>Вывод:</b> ${verdict}.</p>${step === 0 ? `<p class="proc-small">${sc.help.text}</p>` : ""}<button type="button" class="proc-go" data-fig-act="wnext">${tone === "bad" ? "Как исправить →" : "Следующий шаг →"}</button></div>`;
      } else {
        h += `<div class="proc-card"><h4>Пример · исправление и контроль</h4><p><b>Верно:</b> ${sc.fix[0][0]}</p>${sc.fix.slice(1).map(([t, why]) => `<p><b>Неверно:</b> ${t} <i>${why}</i></p>`).join("")}<p><b>Контроль:</b></p><ul class="lv-checks">${sc.postfix_checks.map((c) => `<li>✓ ${c}</li>`).join("")}</ul><button type="button" class="proc-go" data-fig-act="lesson:guided">Теперь сам, с подсказками →</button></div>`;
      }
      return h;
    }
    if (ph === "look") {
      const s = STEPS[step];
      let fb = "";
      if (ans.startsWith("w:")) fb = `<p class="proc-fb bad">✗ ${wrongWhy(ans.slice(2), sc.evidence[s.id][0], sc.evidence[s.id][1])}</p>`;
      if (ans.startsWith("p:")) fb = `<p class="proc-fb ok">✓ Шаг ${STEPS[Number(ans.split(":")[1])].n}: ${ans.endsWith(":h") ? "верно, это улика" : "верно, норма"}.</p>`;
      const helps = mode === "guided" ? sc.help.levels : [];
      const hl = Number(st.help || 0);
      const helpHtml = helps.length ? `${helps.slice(0, hl).map((t, i) => `<p class="proc-small">Подсказка ${i + 1}: ${t}</p>`).join("")}${hl < helps.length ? `<button type="button" class="proc-opt lv-help" data-fig-act="help">Подсказка (${hl}/${helps.length})</button>` : ""}` : "";
      if (!st.open) {
        h += `${fb}<div class="proc-card"><h4>Шаг ${s.n} · ${s.name}</h4><p class="proc-do"><b>Что делаешь:</b> ${s.do}</p><button type="button" class="proc-go" data-fig-act="open">Выполнить проверку</button>${helpHtml}</div>`;
        return h;
      }
      h += `${fb}<div class="proc-card"><h4>Шаг ${s.n} · ${s.name}</h4><p class="proc-do"><b>Что делаешь:</b> ${s.do}</p><p class="proc-see"><b>Что видишь:</b> ${sc.evidence[s.id][1]}</p><p class="proc-q"><b>Твой вывод?</b></p>${CHOICES.map(([id, label]) => `<button type="button" class="proc-opt" data-fig-act="i:${id}">${label}</button>`).join("")}${helpHtml}</div>`;
      return h;
    }
    if (ph === "fix") {
      const fb = ans.startsWith("f:") ? `<p class="proc-fb bad">✗ ${sc.fix[Number(ans.slice(2))][1]}</p>` : "";
      h += `<p class="proc-fb ok">✓ Причина подтверждена на шаге ${STEPS[at].n}.</p>${fb}<div class="proc-card"><h4>Что меняешь?</h4>${order(3, Number(st.seed) + LI[st.stage]).map((i) => `<button type="button" class="proc-opt" data-fig-act="f:${i}">${sc.fix[i][0]}</button>`).join("")}</div>`;
      return h;
    }
    if (ph === "ctrl") {
      h += `<p class="proc-fb ok">✓ Выбрано: ${sc.fix[0][0]}</p><div class="proc-card"><h4>Контроль результата</h4><p>Дело закрыто, только когда результат проверен. Погасшая надпись сама по себе — не проверка.</p><button type="button" class="proc-go" data-fig-act="ctrl">Выполнить контроль</button></div>`;
      return h;
    }
    const next = mode === "guided" ? ["lesson:recall", "Дальше: вспомни объяснение →"] : mode === "transfer" ? ["lesson:later", "Дальше: повтор позже →"] : ["restart", "Пройти урок заново"];
    h += `<div class="proc-card done"><h4>Случай закрыт</h4><p><b>Причина:</b> ${sc.title}.</p><p><b>Исправление:</b> ${sc.fix[0][0]}</p><ul class="lv-checks">${sc.postfix_checks.map((c) => `<li>✓ ${c}</li>`).join("")}</ul><p class="proc-small">Ошибок в выводах и исправлении: ${st.mistakes}${mode === "guided" ? ` · подсказок: ${st.help}` : ""}.</p><button type="button" class="proc-go" data-fig-act="${next[0]}">${next[1]}</button></div>`;
    return h;
  }

  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      const sc = scenarioOf(st), sid = curStep(st), solved = solvedNow(st);
      const look = st.stage === "entry" ? ["osd"] : st.stage === "meaning" ? ["meter", "bf"] : sid ? LOOK[sid] : [];
      const fk = look.join(",");
      if (svgEl && fk !== sim.focusKey) {
        sim.focusKey = fk;
        if (look.length) svgEl.setAttribute("data-focus", "step");
        else svgEl.removeAttribute("data-focus");
        items.forEach((el) => (look.includes(el.dataset.g) ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
      }
      const key = `${st.stage}:${st.step}:${st.open}:${st.ph}`;
      if (key !== sim.camKey) { sim.camKey = key; sim.cam = look.length ? now() : null; }
      const blink = calm || (sim.t % 1.2) < 0.75;
      osdEl.innerHTML = osdScreen(sc, sid, solved, st.stage === "entry", blink);
      metEl.innerHTML = st.stage === "meaning" ? txt((MET.d - 6) / 2, 13, "25,2 → 20,4", "lv-dig sm", "middle") + txt((MET.d - 6) / 2, 21, "покой → 40 А", "ac-pt", "middle") : meterScreen(sc, sid, solved);
      bfEl.innerHTML = st.stage === "meaning" ? bfScreen({ example: SC.worked_temperature_A.example }, "load", false) : bfScreen(sc, sid, solved);
      const cells = sc ? sc.example.cells_actual : 6;
      const bp = k.iso([BAT.x + BAT.w, BAT.y + BAT.d / 2, BATH * 0.55], P);
      batEl.innerHTML = `<text x="${bp[0].toFixed(1)}" y="${bp[1].toFixed(1)}" class="lv-bat" text-anchor="middle">${cells}S LiPo</text>`;
      const tp = k.iso([TH[0], TH[1], 38], P);
      // Температура известна только из записи: на шаге ④ — холодное условие, на шаге ⑤ — ещё и контрольное.
      const tl = sc && sc.example.rest_V != null ? (sid === "load" ? "холодно" : sid === "compare" ? "холодно · контроль" : "") : "";
      thEl.innerHTML = tl ? `<text x="${tp[0].toFixed(1)}" y="${tp[1].toFixed(1)}" class="lv-th" text-anchor="middle">${tl}</text>` : "";
      return true;
    },
    follow() {
      if (!sim.cam || now() - sim.cam > 6000) return null;
      const g = sim.focusKey.split(",")[0];
      const p = { bf: [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h * 0.55], osd: [MON.x + MON.w, MON.y + MON.d / 2, MON.z0 + MON.h * 0.5], meter: [MET.x + MET.w, MET.y + MET.d / 2, MET.h * 0.6], bat: [BAT.x + BAT.w / 2, BAT.y + BAT.d / 2, BATH], temp: [TH[0], TH[1], 22] }[g];
      if (!p) return null;
      const a = k.iso(p, P);
      return [a[0], a[1], 1.6];
    },
    panel(st) {
      const stage = st.stage;
      const pills = LESSON.map(([id, name], i) => `<li class="${has(st, id) ? "done o" : id === stage ? "cur" : ""}" title="${name}">${name}</li>`).join("");
      let h = `<div class="proc-top"><b>Урок: LOW V</b><span>ошибок: ${st.mistakes}</span></div><ol class="proc-steps lv-lesson" aria-label="Этапы урока">${pills}</ol>`;
      const ans = String(st.ans || "");
      if (stage === "entry") {
        const E = CASES.ENTRY;
        if (has(st, "entry")) return h + `<p class="proc-fb ok">✓ ${E.choices.find((c) => c.correct).why}</p><div class="proc-card"><p>${E.phase_notice}</p><p class="proc-small">${E.credit}</p><button type="button" class="proc-go" data-fig-act="lesson:meaning">Дальше →</button></div>`;
        const fb = ans.startsWith("e:") ? `<p class="proc-fb bad">✗ ${E.choices.find((c) => c.id === ans.slice(2)).why}</p>` : "";
        return h + `${fb}<div class="proc-card"><h4>Симптом</h4><p class="proc-see">${E.prompt}</p>${order(3, Number(st.seed)).map((i) => E.choices[i]).map((c) => `<button type="button" class="proc-opt" data-fig-act="e:${c.id}">${c.text}</button>`).join("")}</div>`;
      }
      if (stage === "meaning") {
        if (has(st, "meaning")) return h + `<p class="proc-fb ok">✓ ${MEANING.options[0][0]}</p><div class="proc-card"><p>${SHORT}</p><p class="lv-formula"><b>Оценка:</b> U<sub>нагрузки</sub> ≈ U<sub>покоя</sub> − I × R<sub>экв</sub></p><p class="proc-small">R<sub>экв</sub> — сопротивление всего силового пути до точки измерения, а не одной банки. Это оценка, а не паспорт батареи.</p><button type="button" class="proc-go" data-fig-act="lesson:worked">Посмотреть пример →</button></div>`;
        const fb = ans.startsWith("m:") ? `<p class="proc-fb bad">✗ ${MEANING.options[Number(ans.slice(2))][1]}</p>` : "";
        return h + `${fb}<div class="proc-card"><h4>Покой и нагрузка</h4><p class="proc-see">${MEANING.q}</p>${order(3, Number(st.seed) + 1).map((i) => `<button type="button" class="proc-opt" data-fig-act="m:${i}">${MEANING.options[i][0]}</button>`).join("")}</div>`;
      }
      if (stage === "recall") {
        const shown = ans === "r:show" || ans.startsWith("r:self");
        const self = { ok: "вспомнил верно", part: "вспомнил частично", no: "не вспомнил" };
        let card = `<div class="proc-card"><h4>Вспомни без подсказки</h4><p class="proc-see">${Q13.question || CASES.lesson_flow.recall.prompt}</p><textarea class="lv-recall" rows="3" placeholder="Своими словами. Не проверяется автоматически — сравнишь сам с образцом." aria-label="Твой ответ">${esc(recallText)}</textarea>`;
        if (!shown) card += `<button type="button" class="proc-go" data-fig-act="rshow">Сравнить с образцом</button>`;
        else card += `<p class="proc-see"><b>Образец:</b> ${Q13.current_answer || ""}</p>${ans.startsWith("r:self") ? `<p class="proc-fb ok">Отмечено: ${self[ans.split(":")[2]]}. Тема вернётся в повторе позже.</p><button type="button" class="proc-go" data-fig-act="lesson:transfer">Дальше: новый случай сам →</button>` : `<p class="proc-q"><b>Как вспомнил?</b></p>${Object.entries(self).map(([k2, v]) => `<button type="button" class="proc-opt" data-fig-act="rself:${k2}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}`}`;
        return h + card + "</div>";
      }
      if (stage === "later" && !has(st, "later") && laterLeft() > 0 && st.ph === "look" && !st.open && st.step === 0 && !st.log) {
        const left = Math.ceil(laterLeft());
        return h + `<div class="proc-card"><h4>Повтор после перерыва</h4><p>Вспоминать полезнее после паузы: откроется через ${left} мин после самостоятельного случая. Пока можно читать главу дальше — звёзды и пройденные этапы сохранены.</p><p class="proc-small">Новый случай — с другими числами; причина может совпасть с прежней, а может и нет.</p></div>`;
      }
      if (stage === "end") return h + `<div class="proc-card done"><h4>Урок пройден</h4><p>Ты прошёл путь от надписи LOW V до подтверждённой причины и проверенного исправления.</p><button type="button" class="proc-go" data-fig-act="restart">Пройти заново</button></div>`;
      const sc = scenarioOf(st);
      return sc ? h + panelScenario(st, sc) : h;
    },
    act(a, st, apply0) {
      const apply = (patch) => { remember({ ...st, ...patch }); return apply0(patch); };
      const sc = scenarioOf(st);
      if (a === "restart") { const v = store.get(); delete v.soloAt; store.set(v); return apply({ ...SETUP, seed: Number(st.seed || 1) + 1, prog: "" }); }
      if (a.startsWith("lesson:")) {
        const to = a.slice(7);
        return apply({ stage: to, ph: "look", step: 0, open: 0, ans: "", log: "", help: 0, mistakes: 0 });
      }
      if (a.startsWith("e:") && st.stage === "entry") {
        const c = CASES.ENTRY.choices.find((x) => x.id === a.slice(2));
        if (!c) return;
        if (!c.correct) return apply({ ans: a, mistakes: Number(st.mistakes) + 1 });
        return apply({ ans: "", prog: addProg(st, "entry") });
      }
      if (a.startsWith("m:") && st.stage === "meaning") {
        const i = Number(a.slice(2));
        if (i !== 0) return apply({ ans: a, mistakes: Number(st.mistakes) + 1 });
        return apply({ ans: "", prog: addProg(st, "meaning") });
      }
      if (a === "rshow" && st.stage === "recall") {
        const ta = document.querySelector(".fig-proc .lv-recall");
        if (ta) recallText = ta.value;
        return apply({ ans: "r:show" });
      }
      if (a.startsWith("rself:") && st.stage === "recall") return apply({ ans: `r:self:${a.slice(6)}`, prog: addProg(st, "recall") });
      if (!sc) return;
      if (a === "wnext" && sc.mode === "worked") {
        const s = STEPS[st.step], [tone] = sc.evidence[s.id];
        if (st.ph === "look" && tone !== "bad") return apply({ step: Number(st.step) + 1, log: String(st.log || "") + (tone === "hint" ? "h" : "o") });
        return apply({ ph: "fix", prog: addProg(st, "worked") });
      }
      if (a === "help" && sc.mode === "guided") return apply({ help: Math.min(sc.help.levels.length, Number(st.help) + 1) });
      if (a === "open" && st.ph === "look") return apply({ open: 1, ans: "" });
      if (a.startsWith("i:") && st.ph === "look" && st.open) {
        const choice = a.slice(2), [tone] = sc.evidence[STEPS[st.step].id];
        if (choice !== EXPECT[tone]) return apply({ ans: `w:${choice}`, mistakes: Number(st.mistakes) + 1 });
        if (tone === "bad") return apply({ ph: "fix", ans: "" });
        const mark = tone === "hint" ? "h" : "o";
        return apply({ step: Number(st.step) + 1, open: 0, log: String(st.log || "") + mark, ans: `p:${st.step}:${mark}` });
      }
      if (a.startsWith("f:") && st.ph === "fix") {
        const i = Number(a.slice(2));
        if (i !== 0) return apply({ ans: a, mistakes: Number(st.mistakes) + 1 });
        return apply({ ph: "ctrl", ans: "" });
      }
      if (a === "ctrl" && st.ph === "ctrl") {
        const tag = sc.mode === "guided" ? "guided" : sc.mode === "transfer" ? "transfer" : "later";
        if (tag === "transfer") { const v = store.get(); store.set({ ...v, soloAt: v.soloAt || Date.now() }); }
        return apply({ ph: "solved", ans: "", prog: addProg(st, tag) });
      }
    },
    facts() {
      return { safe: has(state, "entry"), guided: has(state, "guided"), solo: has(state, "transfer"), later: has(state, "later"), stage: state.stage, ph: state.ph, mistakes: Number(state.mistakes), help: Number(state.help) };
    },
    readout() {
      const sc = scenarioOf(state);
      const name = (LESSON.find(([id]) => id === state.stage) || [0, "урок"])[1];
      if (state.stage === "entry") return has(state, "entry") ? "✓ посадка · причина ещё не найдена" : "✗ LOW V в полёте";
      if (!sc) return `Этап: ${name}`;
      if (state.ph === "solved") return `✓ ${name}: причина подтверждена, контроль выполнен`;
      return `${name} · ${state.ph === "look" ? `шаг ${STEPS[state.step].n} ${STEPS[state.step].name.toLowerCase()}` : state.ph === "fix" ? "выбор исправления" : "контроль"} · ошибок ${state.mistakes}`;
    },
    explain(chip) {
      if (/LOW V в полёте/.test(chip)) return "Начни урок в панели: сначала безопасность, потом поиск причины на столе.";
      if (/посадка/.test(chip)) return "Посадка снижает риск, но не устанавливает причину надписи.";
      if (/шаг/.test(chip) && STEPS[state.step]) return STEPS[state.step].do;
      if (/контроль выполнен/.test(chip)) return "Звезда — только после подтверждения причины, верного исправления и контроля.";
      return "";
    },
    metrics() {
      return [
        ["Этап", (LESSON.find(([id]) => id === state.stage) || [0, "конец"])[1], ""],
        ["Ошибок", String(state.mistakes), "цель 0"],
        ["Подсказок", String(state.help || 0), "в случае с подсказкой"],
        ["Пройдено", `${String(state.prog || "").split(",").filter(Boolean).length} из ${LESSON.length}`, ""],
      ];
    },
    note() {
      return CASES.label + " Порядок проверки: осмотр → два прибора → число банок → запись нагрузки → сравнение условий. Исправляют только подтверждённую причину и проверяют результат.";
    },
  };
}
