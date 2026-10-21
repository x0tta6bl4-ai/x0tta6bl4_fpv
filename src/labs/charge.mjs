// Гл. 6, вкладка «Подготовь к зарядке»: ученик сам устанавливает параметры батареи (осмотр, наклейка, паспорт,
// измерение банок, расчёт по Вт·ч), подключает силовой провод и балансир, настраивает зарядник и запускает зарядку —
// или обоснованно отказывается. Дела и критерии — исследование GPT `docs/content/battery-trainer-research.md`
// и `docs/content/battery-trainer-cases.json` (карточки 031, 032). Первая версия: B01–B09 и B13–B15.
// Скрытая модель (`physicalTruth`) в интерфейс до решения не попадает: ответы строятся только по собранным уликам.
import CASES from "../../docs/content/battery-trainer-cases.json";

export const meta = {
  id: "charge",
  title: "Подготовь батарею к зарядке",
  missions: [
    { id: "example", text: "Дело B01: осмотри, установи параметры, подключи, настрой 0,5C и проконтролируй зарядку" },
    { id: "unknown", text: "Батарея без наклейки и паспорта (B03 или B04): реши, можно ли её заряжать" },
    { id: "fix", text: "Найди ошибку подключения или настройки до запуска (B07, B08 или B09) и заряди без опасной попытки" },
    { id: "wh", text: "Ёмкость стёрта, но есть Вт·ч и вольты (B13 или B14): вычисли ёмкость и прими решение" },
    { id: "damaged", text: "Повреждённая батарея (B06): останови работу до подключения" },
  ],
};

const ORDER = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B13", "B14", "B15"];
const BY = Object.fromEntries(CASES.cases.map((c) => [c.id, c]));
// Шаблоны учебного зарядника: конечное напряжение на банку задаёт выбранный тип (как на приборах вида D200neo, S2).
const TYPES = { LiPo: 4.2, LiHV: 4.35, LiIon: 4.1 };
const TASKS = { balance: "Balance Charge", charge: "Charge", storage: "Storage" };
const STEP = 0.1;
const REASONS = {
  chem: "Химия и предел заряда не подтверждены",
  cap: "Ёмкость и допустимый ток не подтверждены",
  damaged: "Батарея повреждена",
};
// Что ученик видит до решения: ситуация без подсказки. Названия дел в JSON выдают ответ («…LiHV», «Нет балансира»,
// «Конфликт S») — их показываем только в разборе после решения.
const SITU = {
  B01: "Батарея с наклейкой — подготовь к зарядке", B07: "Батарея с наклейкой — подготовь к зарядке", B08: "Батарея с наклейкой — подготовь к зарядке", B09: "Батарея с наклейкой — подготовь к зарядке",
  B02: "Наклейка частично стёрта", B03: "Батарея без наклейки", B04: "Батарея без наклейки", B05: "На наклейке только тип и число банок",
  B06: "Батарея из ящика после полётов", B13: "Наклейка стёрта, остались вольты и Вт·ч", B14: "Наклейка стёрта, остались вольты и Вт·ч", B15: "Наклейка стёрта, осталась надпись «150 W»",
};
const ru = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");

export function mount(root, ctx) {
  root.innerHTML = `<div class="ct">
    <div class="ct-cases" role="group" aria-label="Дело">${ORDER.map((id) => `<button type="button" data-case="${id}" aria-pressed="false">${id}</button>`).join("")}</div>
    <p class="ct-title"></p>
    <div class="ct-stage"><svg viewBox="0 0 360 150" class="lab-svg" role="img" aria-label="Батарея и зарядник на столе"><g class="ct-pic"></g></svg></div>
    <p class="ct-now" aria-live="polite"></p>
    <section class="ct-sec"><h4>1. Осмотр и сведения</h4><div class="lab-row"><button type="button" class="lab-btn" data-act="look">Осмотреть батарею</button><button type="button" class="lab-btn" data-act="label">Прочитать наклейку</button><button type="button" class="lab-btn" data-act="passport">Найти паспорт</button></div><div class="ct-ev"></div></section>
    <section class="ct-sec"><h4>2. Что установлено</h4><table class="t ct-known"></table><div class="lab-row ct-calc"></div></section>
    <section class="ct-sec"><h4>3. Подключение</h4><div class="lab-row"><button type="button" class="lab-btn" data-act="main" aria-pressed="false">Силовой провод</button><button type="button" class="lab-btn" data-act="balance" aria-pressed="false">Балансир</button><button type="button" class="lab-btn" data-act="measure">Измерить банки</button></div><div class="ct-cells"></div></section>
    <section class="ct-sec"><h4>4. Зарядник</h4><div class="ct-charger"></div></section>
    <section class="ct-sec"><h4>5. Решение</h4><div class="lab-row"><button type="button" class="lab-btn good" data-act="start">Запустить зарядку</button><button type="button" class="lab-btn bad" data-act="decline">Не заряжать</button></div><div class="ct-reasons" hidden></div><div class="ct-run"></div></section>
    <p class="lab-read ct-msg" aria-live="polite"></p></div>`;
  const $ = (q) => root.querySelector(q);
  let s = null, timer = 0;

  function load(id) {
    clearInterval(timer);
    const c = BY[id], ev = c.availableEvidence;
    const conn = { main: !!ev.initialConnections?.main, balance: !!ev.initialConnections?.balance };
    // Зарядник «помнит» прошлый профиль: по умолчанию LiPo 1S 1,0 А; в B08 остался 6S, в B09 — LiHV (4,35 В).
    const set = { type: ev.configuredEndVoltagePerCell_V === 4.35 ? "LiHV" : "LiPo", s: ev.configuredSeries || 1, task: "balance", a: 1.0 };
    s = { id, c, ev, conn, set, seen: { look: false, label: false, passport: false, measured: false, derived: null, power: null }, phase: "work", critical: false, connectedEver: conn.main || conn.balance, run: null, msg: "" };
    root.querySelectorAll("[data-case]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.case === id)));
    $(".ct-reasons").hidden = true;
    draw();
  }
  // Что ученик уже установил — только из собранных улик.
  function known() {
    const k = {};
    const cf = s.ev.confirmed || {};
    if (s.seen.passport && s.seen.label) {
      if (cf.chemistry) k.chem = [cf.chemistry, "паспорт"];
      if (cf.series) k.series = [cf.series, "паспорт"];
      if (cf.capacity_mAh) k.cap = [cf.capacity_mAh, "паспорт"];
      if (cf.endVoltagePerCell_V) k.endV = [cf.endVoltagePerCell_V, "паспорт"];
      if (cf.maxChargeCurrent_A) k.maxA = [cf.maxChargeCurrent_A, "паспорт"];
    }
    if (!k.cap && s.seen.derived) k.cap = [s.seen.derived, "вычислено: Вт·ч ÷ В"];
    if (s.seen.measured) k.measuredS = s.ev.cellVoltages_V.length;
    return k;
  }
  const now = () => {
    if (s.phase === "done") return "Дело закрыто. Выбери следующее дело сверху.";
    if (s.phase === "charging") return "Зарядка идёт (симуляция ускорена). Проверь банки и температуру — или останови.";
    if (!s.seen.look) return "Сейчас: осмотри батарею — повреждение важнее любой маркировки.";
    if (!s.seen.label || !s.seen.passport) return "Сейчас: прочитай наклейку и найди паспорт этого экземпляра.";
    if (!s.conn.balance || !s.conn.main) return "Сейчас: подключи силовой провод и балансир (или откажись, если заряжать нельзя).";
    if (!s.seen.measured) return "Сейчас: измерь банки — зарядник покажет их число и напряжения.";
    return "Сейчас: настрой зарядник по установленным сведениям и прими решение.";
  };

  function draw() {
    const { c, ev, conn, set } = s;
    $(".ct-title").innerHTML = `<b>${c.id}.</b> ${s.phase === "done" ? `${c.title} <span class="muted small">(разбор)</span>` : SITU[c.id]}`;
    $(".ct-now").textContent = now();
    // Улики
    const ev1 = [];
    if (s.seen.look) ev1.push(`<li><b>Осмотр:</b> ${ev.appearance}${ev.damaged ? " — <b>повреждение</b>" : ""}.</li>`);
    if (s.seen.label) ev1.push(`<li><b>Наклейка:</b> ${ev.labelText ? `«${ev.labelText}»` : "наклейки нет"}.</li>`);
    if (s.seen.passport) ev1.push(`<li><b>Паспорт:</b> ${ev.source && Object.keys(ev.confirmed || {}).length ? ev.source : "паспорта, связанного с этой батареей, нет"}.</li>`);
    $(".ct-ev").innerHTML = ev1.length ? `<ul>${ev1.join("")}</ul>` : "";
    // Что установлено
    const k = known();
    const row = (name, v) => `<tr><td>${name}</td><td>${v ? `<b>${v[0]}</b> <span class="muted small">(${v[1]})</span>` : `<span class="muted">не установлено</span>`}</td></tr>`;
    $(".ct-known").innerHTML = row("Химия", k.chem) + row("Банок (S)", k.series || (k.measuredS ? [k.measuredS, "по балансиру — это число банок, не химия"] : null)) + row("Ёмкость", k.cap && [`${k.cap[0]} мА·ч`, k.cap[1]]) + row("Предел заряда", k.endV && [`${ru(k.endV[0])} В на банку`, k.endV[1]]) + row("Допустимый ток заряда", k.maxA && [`${ru(k.maxA[0], 1)} А`, k.maxA[1]]);
    // Расчёты по наклейке
    const calc = [];
    if (s.seen.label && ev.nominalEnergy_Wh && ev.nominalVoltage_V) calc.push(`<button type="button" class="lab-btn" data-act="deriveWh">Ёмкость = ${ru(ev.nominalEnergy_Wh, 1)} Вт·ч ÷ ${ru(ev.nominalVoltage_V, 1)} В</button>`);
    if (s.seen.label && ev.power_W && ev.measuredPackVoltage_V) calc.push(`<button type="button" class="lab-btn" data-act="derivePower">Посчитать по ${ev.power_W} Вт и ${ev.measuredPackVoltage_V} В</button>`);
    $(".ct-calc").innerHTML = calc.join("") + (s.seen.power ? `<p class="small">${s.seen.power}</p>` : "") + (s.seen.derived ? `<p class="small">${ru(ev.nominalEnergy_Wh, 1)} ÷ ${ru(ev.nominalVoltage_V, 1)} = ${ru(s.seen.derived / 1000, 1)} А·ч = <b>${s.seen.derived} мА·ч</b> — номинальная ёмкость. Химию и предел заряда это не устанавливает.</p>` : "");
    // Подключение
    root.querySelector('[data-act="main"]').setAttribute("aria-pressed", String(conn.main));
    root.querySelector('[data-act="balance"]').setAttribute("aria-pressed", String(conn.balance));
    root.querySelector('[data-act="main"]').textContent = `Силовой ${ev.powerLead}${conn.main ? " ✓" : ""}`;
    root.querySelector('[data-act="balance"]').textContent = `Балансир (${ev.balanceWireCount} пров.)${conn.balance ? " ✓" : ""}`;
    $(".ct-cells").innerHTML = s.seen.measured ? `<p class="small">Банки: ${ev.cellVoltages_V.map((v) => ru(v)).join(" · ")} В — <b>${ev.cellVoltages_V.length} шт.</b> Сейчас ≈ ${ru(ev.cellVoltages_V.reduce((a, b) => a + b, 0) / ev.cellVoltages_V.length)} В на банку: это текущий заряд, а не тип батареи.</p>` : "";
    // Зарядник
    const target = k.cap ? Math.round((k.cap[0] / 1000) * 0.5 * 100) / 100 : null;
    $(".ct-charger").innerHTML = `<div class="ct-screen" aria-live="polite">${conn.main && conn.balance && s.seen.measured ? `Банок: ${ev.cellVoltages_V.length} · ` : ""}${set.type} ${set.s}S · ${TASKS[set.task]} · ${ru(TYPES[set.type])} В/банку · ${ru(set.a, 1)} А</div>
      <div class="ct-set"><span>Тип</span>${Object.keys(TYPES).map((t) => `<button type="button" data-type="${t}" aria-pressed="${set.type === t}">${t}</button>`).join("")}</div>
      <div class="ct-set"><span>Банок</span><button type="button" data-s="-1" aria-label="Меньше банок">−</button><b>${set.s}S</b><button type="button" data-s="1" aria-label="Больше банок">+</button></div>
      <div class="ct-set"><span>Задача</span>${Object.entries(TASKS).map(([t, n]) => `<button type="button" data-task="${t}" aria-pressed="${set.task === t}">${n}</button>`).join("")}</div>
      <div class="ct-set"><span>Ток</span><button type="button" data-a="-1" aria-label="Меньше ток">−</button><b class="ct-a">${ru(set.a, 1)} А</b><button type="button" data-a="1" aria-label="Больше ток">+</button>${target ? `<span class="muted small">цель курса 0,5C = ${ru(target)} А</span>` : ""}</div>`;
    $(".ct-msg").innerHTML = s.msg;
    drawPic();
  }
  function drawPic() {
    const { ev, conn } = s;
    const bulge = s.seen.look && ev.damaged;
    const label = s.seen.label ? (ev.labelText || "") : "";
    $(".ct-pic").innerHTML = `
      <rect x="20" y="${bulge ? 44 : 50}" width="130" height="${bulge ? 62 : 50}" rx="${bulge ? 22 : 6}" class="ct-bat${bulge ? " ct-bad" : ""}"/>
      <text x="85" y="80" text-anchor="middle" class="ct-lbl">${label.length > 22 ? label.slice(0, 21) + "…" : label || (s.seen.label ? "наклейки нет" : "")}</text>
      <rect x="230" y="40" width="110" height="70" rx="8" class="ct-chg"/><rect x="240" y="50" width="90" height="26" rx="3" class="ct-scr"/>
      <text x="285" y="67" text-anchor="middle" class="ct-scrt">${s.phase === "charging" ? "ЗАРЯД" : conn.main ? "ГОТОВ" : "—"}</text>
      <path d="M150 64 C 190 64 190 ${conn.main ? 90 : 130} ${conn.main ? 230 : 175} ${conn.main ? 90 : 130}" class="ct-wire${conn.main ? " on" : ""}"/>
      <path d="M150 86 C 185 86 185 ${conn.balance ? 100 : 140} ${conn.balance ? 230 : 170} ${conn.balance ? 100 : 140}" class="ct-wire thin${conn.balance ? " on" : ""}"/>
      <text x="${conn.main ? 205 : 176}" y="${conn.main ? 84 : 128}" class="ct-tag">${ev.powerLead}</text>
      <text x="${conn.balance ? 200 : 168}" y="${conn.balance ? 112 : 148}" class="ct-tag">баланс</text>`;
  }
  const say = (html) => { s.msg = html; draw(); };

  // Проверка перед запуском: первая найденная проблема объясняется; опасные попытки запоминаются.
  function preflight() {
    const k = known(), ev = s.ev, set = s.set;
    const crit = (t) => ({ ok: false, critical: true, t });
    const soft = (t) => ({ ok: false, critical: false, t });
    if (!s.seen.look) return soft("Сначала осмотри батарею: повреждение важнее хорошей маркировки.");
    if (ev.damaged) return crit("Батарея вздута — заряжать нельзя. Работа с этим экземпляром прекращается до любых подключений.");
    if (!s.seen.label || !s.seen.passport) return soft("Сначала прочитай наклейку и найди паспорт: настройки берут из подтверждённых сведений.");
    if (!s.conn.main || !s.conn.balance) return soft(`Подключи ${!s.conn.balance ? "балансир: без него зарядник не видит отдельные банки и не выравнивает их" : "силовой провод: по нему идёт зарядный ток"}.`);
    if (!s.seen.measured) return soft("Измерь банки: зарядник должен увидеть их число и напряжения до запуска.");
    if (!k.chem || !k.endV) return crit("Химия и предел заряда не подтверждены. По напряжению банок LiPo и LiHV не различить — запуск наугад опасен.");
    if (!k.cap || !k.maxA) return crit(`Ёмкость${!k.maxA ? " и допустимый ток" : ""} не подтверждены${s.ev.nominalEnergy_Wh && !s.seen.derived ? " (ёмкость можно вычислить по Вт·ч и вольтам с наклейки)" : ""} — ток зарядки рассчитать не из чего.`);
    if (set.s !== k.series?.[0] || set.s !== k.measuredS) return crit(`На заряднике ${set.s}S, а банок ${k.measuredS} по балансиру и ${k.series?.[0]} по паспорту. Конфликт не исправляют сменой типа — выставь ${k.measuredS}S и проверь подключение.`);
    const v = TYPES[set.type];
    if (v > k.endV[0] + 1e-9) return crit(`Выбраны ${ru(v)} В на банку (${set.type}), а подтверждённый предел этой батареи — ${ru(k.endV[0])} В. Это перезаряд.`);
    if (v < k.endV[0] - 1e-9) return soft(`Выбраны ${ru(v)} В на банку — ниже подтверждённых ${ru(k.endV[0])} В: батарея недозарядится. Выбери профиль по паспорту.`);
    if (set.task !== "balance") return soft(`Для многобаночной батареи — Balance Charge: зарядник выравнивает банки по балансиру. ${set.task === "storage" ? "Storage — для хранения, не для полёта." : ""}`);
    if (set.a > k.maxA[0] + 1e-9) return crit(`Ток ${ru(set.a, 1)} А выше паспортного допустимого ${ru(k.maxA[0], 1)} А.`);
    const target = (k.cap[0] / 1000) * 0.5;
    if (set.a > target + 1e-9) return soft(`Ток ${ru(set.a, 1)} А выше цели курса 0,5C = ${ru(target)} А. Это не превышение паспорта, но задание — заряд 0,5C.`);
    if (set.a < target - STEP + 1e-9) return soft(`Ток ${ru(set.a, 1)} А заметно ниже цели 0,5C = ${ru(target)} А: так безопасно, но медленно. Ближайшая установка не выше цели — ${ru(Math.floor(target / STEP + 1e-9) * STEP, 1)} А.`);
    return { ok: true };
  }
  function start() {
    const r = preflight();
    if (!r.ok) {
      if (r.critical) s.critical = true;
      return say(`<b>✗ Не запускаем.</b> ${r.t}${r.critical ? " <span class=\"muted small\">Опасная попытка записана: это дело засчитается только как учебный разбор.</span>" : ""}`);
    }
    s.phase = "charging";
    const endV = known().endV[0];
    const cells = s.ev.cellVoltages_V.slice();
    s.run = { t: 0, cells, endV };
    s.msg = "<b>Зарядка запущена.</b> Смотри банки на экране зарядника.";
    timer = setInterval(() => {
      s.run.t += 1;
      s.run.cells = s.run.cells.map((v) => Math.min(endV, v + (endV - v) * 0.18));
      $(".ct-run").innerHTML = runHtml();
    }, 400);
    draw();
    $(".ct-run").innerHTML = runHtml();
  }
  const runHtml = () => s.phase !== "charging" ? "" : `<div class="ct-screen">Банки: ${s.run.cells.map((v) => ru(v)).join(" · ")} В · ${ru(s.set.a, 1)} А · 23 °C · <span class="muted">ускорено</span></div><div class="lab-row"><button type="button" class="lab-btn good" data-act="control">Проверил: банки ровные, температура норма</button><button type="button" class="lab-btn" data-act="stop">Остановить</button></div>`;
  function finishCharge() {
    clearInterval(timer);
    s.phase = "done";
    $(".ct-run").innerHTML = "";
    const clean = !s.critical;
    const id = s.id;
    if (id === "B01") ctx.done("example");
    if (clean && ["B07", "B08", "B09"].includes(id)) ctx.done("fix");
    if (id === "B14" && s.seen.derived) ctx.done("wh");
    say(`<b>✓ Дело закрыто:</b> ${s.c.expected.reason}.${clean ? "" : " Была опасная попытка — это учебный разбор; чистый зачёт — в следующем деле."}`);
  }
  function decline(reason) {
    const exp = s.c.expected.outcome, id = s.id;
    const declineCase = ["decline", "decline_before_connect", "derive_then_decline"].includes(exp);
    if (!declineCase) return say(`<b>✗ Отказ без причины.</b> В этом деле параметры подтверждены${["B07", "B08", "B09"].includes(id) ? ": ошибку подключения или настройки надо исправить, а не бросать батарею" : ""}. Задача не завершена.`);
    if (!s.seen.look) return say("<b>✗ Рано.</b> Сначала осмотри батарею: отказ должен опираться на улику.");
    if (reason === "damaged") {
      if (!s.ev.damaged) return say("<b>✗ Причина не та.</b> Повреждений при осмотре нет.");
    } else {
      if (s.ev.damaged) return say("<b>✗ Причина не та.</b> Главное здесь — повреждение: маркировка его не отменяет.");
      if (!s.seen.label || !s.seen.passport) return say("<b>✗ Рано.</b> Проверь наклейку и паспорт: отказ «не подтверждено» должен опираться на то, что сведений действительно нет.");
      const k = known();
      if (reason === "chem" && k.chem) return say("<b>✗ Причина не та.</b> Химия как раз подтверждена — посмотри, чего не хватает.");
      if (reason === "cap" && (k.cap && k.maxA)) return say("<b>✗ Причина не та.</b> Ёмкость и ток установлены.");
      if (id === "B13" && !s.seen.derived) return say("<b>✗ Не всё установлено.</b> Ёмкость здесь можно вычислить по Вт·ч и вольтам с наклейки — сделай это, а потом решай.");
    }
    s.phase = "done";
    $(".ct-reasons").hidden = true;
    if ((id === "B03" || id === "B04") && reason === "chem") ctx.done("unknown");
    if (id === "B13" && s.seen.derived) ctx.done("wh");
    if (id === "B06" && reason === "damaged" && !s.connectedEver) ctx.done("damaged");
    const reveal = id === "B03" || id === "B04" ? ` <span class="muted small">Разбор: внутри была ${s.c.physicalTruth.chemistry} — по осмотру и напряжениям это не узнать, поэтому ответ одинаковый.</span>` : "";
    const late = id === "B06" && s.connectedEver ? " Но батарею уже подключали — повреждённую не подключают вовсе." : "";
    say(`<b>✓ Верно: не заряжаем.</b> ${s.c.expected.reason}.${late}${reveal}`);
  }

  root.addEventListener("click", (e) => {
    const cs = e.target.closest("[data-case]");
    if (cs) return load(cs.dataset.case);
    if (!s) return;
    const b = e.target.closest("[data-act],[data-type],[data-s],[data-task],[data-a],[data-reason]");
    if (!b) return;
    if (s.phase === "done" && !b.dataset.case) return;
    if (s.phase === "charging" && !["control", "stop"].includes(b.dataset.act)) return say("Идёт зарядка: настройки меняют после остановки.");
    const act = b.dataset.act;
    if (act === "look") { s.seen.look = true; return say(s.ev.damaged ? "<b>Вздутая оболочка.</b> Дальше с этой батареей не работают." : "Повреждений не видно."); }
    if (act === "label") { s.seen.label = true; return say(s.ev.labelText ? "Наклейка прочитана." : "Наклейки нет."); }
    if (act === "passport") { s.seen.passport = true; return say(s.ev.source && Object.keys(s.ev.confirmed || {}).length ? "Паспорт найден: сведения в таблице «Что установлено»." : "Паспорта, связанного с этой батареей, нет. Похожее фото из каталога — не связь с экземпляром."); }
    if (act === "deriveWh") { s.seen.derived = Math.round((s.ev.nominalEnergy_Wh / s.ev.nominalVoltage_V) * 1000); return say("Ёмкость вычислена по номинальным величинам с наклейки."); }
    if (act === "derivePower") { s.seen.power = `${s.ev.power_W} Вт ÷ ${s.ev.measuredPackVoltage_V} В = <b>${ru(s.ev.power_W / s.ev.measuredPackVoltage_V, 0)} А</b> — ток в этой рабочей точке. Ватты — не ватт-часы: ёмкость отсюда не получить.`; return draw(); }
    if (act === "main" || act === "balance") {
      if (s.ev.damaged && !s.conn[act]) { s.critical = true; s.connectedEver = true; s.conn[act] = true; return say("<b>✗ Повреждённую батарею не подключают.</b> Отключи и прекрати работу с ней."); }
      s.conn[act] = !s.conn[act];
      if (s.conn[act]) s.connectedEver = true;
      s.seen.measured = false;
      return say(s.conn[act] ? `${act === "main" ? "Силовой провод" : "Балансир"} подключён.` : "Отключено. Измерение надо повторить.");
    }
    if (act === "measure") {
      if (!s.conn.balance) return say("<b>Банок не видно:</b> без балансира зарядник видит только общее напряжение. Подключи балансир.");
      s.seen.measured = true;
      return say("Измерено. Число банок — по балансиру; химию и ёмкость это не показывает.");
    }
    if (b.dataset.type) { s.set.type = b.dataset.type; return draw(); }
    if (b.dataset.s) { s.set.s = Math.max(1, Math.min(8, s.set.s + Number(b.dataset.s))); return draw(); }
    if (b.dataset.task) { s.set.task = b.dataset.task; return draw(); }
    if (b.dataset.a) { s.set.a = Math.max(STEP, Math.min(10, Math.round((s.set.a + Number(b.dataset.a) * STEP) * 10) / 10)); return draw(); }
    if (act === "start") return start();
    if (act === "decline") { $(".ct-reasons").hidden = false; $(".ct-reasons").innerHTML = `<p class="small">Почему не заряжаем?</p>${Object.entries(REASONS).map(([k, t]) => `<button type="button" class="lab-btn" data-reason="${k}">${t}</button>`).join("")}`; return; }
    if (b.dataset.reason) return decline(b.dataset.reason);
    if (act === "control") { if (s.run && s.run.t >= 2) return finishCharge(); return say("Подожди пару секунд: контроль — по показаниям, а не сразу после кнопки."); }
    if (act === "stop") { clearInterval(timer); s.phase = "work"; $(".ct-run").innerHTML = ""; return say("Зарядка остановлена. Проверь настройки и запусти снова."); }
  });
  load("B01");
  return { destroy() { clearInterval(timer); } };
}
