// Гл. 6, вкладка «Урок: LOW V»: проходит урок как ученик и проверяет правила пилота (docs/content/ch06-pilot.md):
// посадка — отдельная звезда и не диагноз; вывод на шаге открывается только после проверки; неверный вывод и неверное
// исправление объясняются и не закрывают дело; верный выбор без контроля звезды не даёт; прежнее решение «холод» на
// новом случае не засчитывается; повтор позже закрыт до перерыва. Ожидаемые ответы тест берёт из данных случаев —
// это тестовая инфраструктура, ученику они не показываются.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CASES = JSON.parse(readFileSync(resolve(ROOT, "docs/content/ch06-cases.json"), "utf8"));
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href) + "#6";
const EXPECT = { ok: "ok", hint: "clue", bad: "here" };
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [], res = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const W = (ms) => p.waitForTimeout(ms);
const panel = () => p.$eval(".fig-proc", (e) => e.textContent);
const score = () => p.$eval("#labscore", (e) => e.textContent.replace(/\s+/g, " ").trim());
const act = async (a) => { const el = await p.$(`.fig-proc [data-fig-act="${a}"]`); if (!el) throw new Error(`нет кнопки ${a}: ${(await panel()).slice(0, 160)}`); await el.click(); await W(180); };
const actText = async (text) => { const els = await p.$$(".fig-proc [data-fig-act]"); for (const e of els) if ((await e.textContent()).trim() === text) { await e.click(); await W(180); return; } throw new Error(`нет варианта «${text.slice(0, 40)}»`); };

await p.goto(U); await W(900);
await p.click('[data-figtab="lowv"]'); await W(700);
rep("вкладка урока открывается, панель на месте", !!(await p.$(".fig-proc [data-fig-act]")), "");

// ⓪ Посадка: неверный выбор объясняется, верный — звезда «безопасность», но это не диагноз
const E = CASES.ENTRY;
await act(`e:${E.choices.find((c) => !c.correct).id}`);
rep("неверное первое действие объяснено, звезды нет", /✗/.test(await panel()) && /0\s*\/\s*4/.test(await score()), await score());
await act(`e:${E.choices.find((c) => c.correct).id}`);
rep("посадка: звезда за безопасность, причина не найдена", /1\s*\/\s*4/.test(await score()) && /не устанавливает причину/.test(await panel()), await score());
await act("lesson:meaning");
// Смысл: «упало = неисправна» неверно
await act("m:1");
rep("«упало — значит неисправна» объяснено как неверное", /✗/.test(await panel()), "");
await act("m:0");
rep("после ответа показана формула-оценка", /U\s*нагрузки|Uнагрузки/.test((await panel()).replace(/\s/g, "")) || /нагрузки/.test(await panel()), "");
await act("lesson:worked");
// Пример: шаги открываются по очереди, звёзд не даёт
for (let i = 0; i < 6; i++) { const t = await panel(); if (/Как исправить|Следующий шаг/.test(t)) await act("wnext"); else break; }
rep("показанный пример доходит до исправления и контроля", /Контроль/.test(await panel()) && /1\s*\/\s*4/.test(await score()), await score());
await act("lesson:guided");

// Случай с подсказками: правила шагов, подсказка, неверное исправление, контроль
// Что показывают мультиметр и OSD (первое число на каждом экране — общее напряжение).
const instr = () => p.evaluate(() => {
  const num = (sel) => { const m = (document.querySelector(sel)?.textContent || "").match(/\d+,\d/); return m ? m[0] : "—"; };
  return { meter: num('[data-part="mets"]'), osd: num('[data-part="osds"]') };
});
const agree = []; // [шаг, мультиметр, OSD] — на каждом открытом шаге приборы обязаны совпадать
const inline = []; // [шаг, число в карточке шага, число на мультиметре] — показания рядом с действием те же, что на сцене
const cellsLine = []; // [случай, расчёт среднего на шаге «число банок»]
async function solveCase(sc, { wrongFirst = false, useHelp = false, oldFix = null } = {}) {
  const steps = CASES.STEPS.map((s) => s.id);
  let sawGate = true, explained = false;
  for (const sid of steps) {
    const before = await panel();
    if (/Твой вывод/.test(before)) sawGate = false; // вывод виден до проверки
    if (useHelp && sid === "inspect") await act("help");
    await act("open");
    if (sid === "voltage" || sid === "load") { const r = await instr(); agree.push([`${sc.id}:${sid}`, r.meter, r.osd]); const line = (await panel()).match(/мультиметр (\d+,\d) В · OSD (\d+,\d) В/); inline.push([`${sc.id}:${sid}`, line ? line[1] : "—", r.meter]); }
    if (sid === "cells") cellsLine.push([sc.id, ((await panel()).match(/среднее = общее ÷ S = [^;<]+/) || ["—"])[0]]);
    const tone = sc.evidence[sid][0];
    if (wrongFirst && sid === "voltage") { await act("i:here"); explained = /✗/.test(await panel()); }
    await act(`i:${EXPECT[tone]}`);
    if (tone === "bad") break;
  }
  const fixes = sc.fix.map((f) => f[0]);
  if (oldFix) { await actText(oldFix); }
  else await actText(fixes[1]);
  const wrongFixExplained = /✗/.test(await panel()) && !/Случай закрыт/.test(await panel());
  await actText(fixes[0]);
  const ctrlNeeded = /Контроль результата/.test(await panel());
  return { sawGate, explained, wrongFixExplained, ctrlNeeded };
}
const B = CASES.SCENARIOS.find((s) => s.id === CASES.lesson_flow.guided.scenario_id);
const g = await solveCase(B, { wrongFirst: true, useHelp: true });
rep("вывод открывается только после «Выполнить проверку»", g.sawGate, "");
rep("неверный вывод на шаге объяснён", g.explained, "");
rep("неверное исправление объяснено и дело не закрыло", g.wrongFixExplained, "");
rep("верное исправление без контроля звезды не даёт", g.ctrlNeeded && /1\s*\/\s*4/.test(await score()), await score());
await act("ctrl");
rep("после контроля — звезда за случай с подсказкой", /2\s*\/\s*4/.test(await score()) && /подсказок: 1/.test(await panel()), await score());
await act("lesson:recall");
// Вспомни: самопроверка, звезды нет
await p.fill(".fig-proc .lv-recall", "холод — больше сопротивление, больше просадка");
await act("rshow");
const kept = await p.$eval(".fig-proc .lv-recall", (e) => e.value);
rep("образец показан, свой ответ не стёрт", /Образец/.test(await panel()) && /сопротивление/.test(kept), kept.slice(0, 30));
await act("rself:part");
rep("самопроверка не даёт звезду автоматически", /2\s*\/\s*4/.test(await score()), await score());
await act("lesson:transfer");
// Новый случай: прежнее решение «холод» не засчитывается
const C = CASES.SCENARIOS.find((s) => s.id === CASES.lesson_flow.transfer.scenario_id);
const t = await solveCase(C, { oldFix: C.fix[2][0] });
rep("прежнее решение «холод» на новом случае объяснено и не закрыло дело", t.wrongFixExplained, "");
await act("ctrl");
rep("новый случай сам — звезда", /3\s*\/\s*4/.test(await score()), await score());
await act("lesson:later");
rep("повтор позже закрыт до перерыва", /откроется через/.test(await panel()), (await panel()).slice(0, 80));
// Перерыв прошёл (в тесте — сдвиг отметки времени), повтор с новыми числами
await p.evaluate(() => { const v = JSON.parse(localStorage.getItem("fpv-ch6-lowv") || "{}"); v.soloAt = Date.now() - 31 * 60000; v.seed = 1; v.laterSeed = 1; localStorage.setItem("fpv-ch6-lowv", JSON.stringify(v)); });
await p.click('[data-figtab="battery"]'); await W(500); await p.click('[data-figtab="lowv"]'); await W(700);
rep("после ухода с вкладки урок продолжается с этапа «Позже», а не с начала", /Позже|повтор/i.test(await panel()) && !/Симптом/.test(await panel()), (await panel()).slice(0, 60));
// Повтор: seed 1 — температурный случай с новыми числами; шаги и исправления той же формы, что у B
const Lt = await solveCase(B);
rep("повтор позже: неверное исправление объяснено", Lt.wrongFixExplained, "");
await act("ctrl");
rep("повтор позже — звезда, всего 4 из 4", /4\s*\/\s*4/.test(await score()), await score());
const bad = agree.filter(([, m, o]) => m !== o || m === "—");
rep("на шагах «приборы» и «нагрузка» мультиметр и OSD показывают одно и то же", agree.length >= 4 && !bad.length, JSON.stringify(bad.length ? bad : agree));
const exB = B.example;
rep("числа на приборах — из данных случая (покой и холодная нагрузка B)", agree.some(([k, m]) => k === `${B.id}:voltage` && m === String(exB.rest_V).replace(".", ",")) && agree.some(([k, m]) => k === `${B.id}:load` && m === String(exB.cold_load_V).replace(".", ",")), JSON.stringify(agree.filter(([k]) => k.startsWith(B.id))));
rep("показания приборов в карточке шага совпадают со сценой", inline.length >= 4 && inline.every(([, a, m]) => a === m), JSON.stringify(inline));
const Cx = CASES.SCENARIOS.find((s) => s.id === CASES.lesson_flow.transfer.scenario_id).example;
rep("на шаге «число банок» виден расчёт среднего с ошибочным S", cellsLine.some(([id, t]) => id === CASES.lesson_flow.transfer.scenario_id && t.includes(`÷ ${Cx.cells_configured} = 3,43`)), JSON.stringify(cellsLine));
await p.screenshot({ path: `${ROOT}/tests/out/lowv-390.png` });
await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
