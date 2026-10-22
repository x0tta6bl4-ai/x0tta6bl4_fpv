// Гл. 6, «Подготовь к зарядке» (src/labs/charge.mjs) — критерии приёмки из docs/content/battery-trainer-research.md:
// B01 — полный путь до контроля; B03/B04 — одинаковые наблюдения и отказ без угадывания химии; B05 — нет
// «безопасного» тока без ёмкости; B06 — стоп до подключения; B07 — балансир обязателен; B08/B09 — конфликт S и
// профиль HV ловятся до запуска, опасная попытка не даёт чистого зачёта; ток 0,5C с округлением; B13/B14 — ёмкость
// по Вт·ч и вольтам; B15 — ватты не ватт-часы; смена дела сбрасывает подключения. Плюс старый стенд «Батарея»:
// звезда за пойманную ошибку LiHV до 4,20 В, а не за перезаряд. Ревью 034: после опасной попытки в деле — разбор без
// звезды (B01, B03, B10, B12); «ёмкость» у B03/B04 — не главная причина; B11 без химии в заголовке; B08; проход B14.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href) + "#6";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const errs = [], res = [];
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(U); await W(900);
await p.click('[data-figtab="lab:charge"]'); await W(600);
const act = async (a) => { await p.click(`.ct [data-act="${a}"]`); await W(60); };
const caseGo = async (id) => { await p.click(`.ct [data-case="${id}"]`); await W(80); };
const txt = (sel) => p.$eval(`.ct ${sel}`, (e) => e.textContent.replace(/\s+/g, " ").trim());
const msg = () => txt(".ct-msg");
const done = (m) => p.evaluate((m) => !!document.querySelector(`#missions li[data-m="${m}"]`)?.classList.contains("ok"), m);
const setS = async (n) => { for (let i = 0; i < 8; i++) await p.click('.ct [data-s="-1"]'); for (let i = 1; i < n; i++) await p.click('.ct [data-s="1"]'); };
const setA = async (a) => { const cur = Number((await txt(".ct-a")).replace(",", ".").replace(/[^\d.]/g, "")); const n = Math.round((a - cur) * 10); for (let i = 0; i < Math.abs(n); i++) await p.click(`.ct [data-a="${n > 0 ? 1 : -1}"]`); };
const gather = async () => { for (const a of ["look", "label", "passport", "main", "balance", "measure"]) await act(a); };

// B01: до улик ничего не «известно», до измерения зарядник не пишет число банок
const k0 = await txt(".ct-known");
const scr0 = await txt(".ct-screen");
rep("B01: до улик химия, ёмкость и ток «не установлено»", (k0.match(/не установлено/g) || []).length === 5, k0.slice(0, 80));
rep("B01: до подключения и измерения зарядник не показывает число банок", !/Банок:/.test(scr0), scr0);
await gather();
await setS(4); await setA(0.8);
await act("start");
rep("ток 0,8 А выше цели 0,5C = 0,75 А — учебное замечание, не запуск", /выше цели курса/.test(await msg()) && !(await p.$(".ct-run .ct-screen")), (await msg()).slice(0, 80));
await setA(0.5); await act("start");
rep("ток 0,5 А — ниже цели: подсказка «ближайшая установка не выше цели — 0,7 А»", /0,7 А/.test(await msg()), (await msg()).slice(0, 90));
await setA(0.7); await act("start"); await W(1000);
rep("B01: верные настройки — зарядка запущена, есть кнопка остановки", !!(await p.$('.ct [data-act="stop"]')), await msg());
await act("control");
rep("B01: после контроля дело закрыто, задание «пример» засчитано", await done("example") && /Дело закрыто/.test(await msg()), await msg());

// B03 и B04: одинаковые наблюдения и одинаковый отказ
const obs = {};
for (const id of ["B03", "B04"]) {
  await caseGo(id);
  rep(`${id}: смена дела сбрасывает подключения и улики`, !/✓/.test(await txt('[data-act="main"]')) && (await txt(".ct-known")).match(/не установлено/g).length === 5);
  await gather();
  obs[id] = [(await txt(".ct-title")).replace(/^B0\d\./, ""), await txt(".ct-ev"), await txt(".ct-known"), await txt(".ct-cells")].join(" | ");
  await p.click('.ct [data-type="LiHV"]'); await setS(4); await setA(0.7);
  await act("start");
  rep(`${id}: запуск с угаданным LiHV не проходит — химия не подтверждена`, /Химия и предел заряда не подтверждены/.test(await msg()), (await msg()).slice(0, 80));
  await act("decline"); await p.click('.ct [data-reason="cap"]'); await W(60);
}
rep("B03 и B04: наблюдения до разбора одинаковые", obs.B03 === obs.B04, obs.B03.slice(0, 80));
await caseGo("B04");
const t4 = await txt(".ct-title");
rep("B04: заголовок дела до решения не выдаёт химию", !/LiHV|LiPo/.test(t4), t4);
await caseGo("B04"); await gather(); await act("decline"); await p.click('.ct [data-reason="chem"]'); await W(60);
rep("B04: отказ «химия не подтверждена» засчитан, в разборе — скрытая химия", await done("unknown") && /LiHV/.test(await msg()), (await msg()).slice(0, 120));

// B05: нет ёмкости — нет «безопасного» тока
await caseGo("B05"); await gather();
const k5 = await txt(".ct-known"), ch5 = await txt(".ct-charger");
rep("B05: ёмкость не установлена, цель 0,5C не предлагается", /Ёмкость\s*не установлено/.test(k5) && !/цель курса/.test(ch5), k5.slice(0, 120));
await act("decline"); await p.click('.ct [data-reason="chem"]'); await W(60);
rep("B05: причина «химия» отклонена — химия как раз подтверждена", /Причина не та/.test(await msg()));
await p.click('.ct [data-reason="cap"]'); await W(60);
rep("B05: отказ «ёмкость и ток не подтверждены» верен", /Верно: не заряжаем/.test(await msg()));

// B06: повреждение — стоп до подключения
await caseGo("B06"); await act("look"); await act("main");
rep("B06: подключение повреждённой батареи — опасная попытка с объяснением", /не подключают/.test(await msg()));
await act("decline"); await p.click('.ct [data-reason="damaged"]'); await W(60);
rep("B06: отказ после подключения — без звезды и с замечанием", !(await done("damaged")) && /уже подключали/.test(await msg()));
await caseGo("B06"); await act("look"); await act("decline"); await p.click('.ct [data-reason="damaged"]'); await W(60);
rep("B06: отказ до подключения — звезда «повреждение»", await done("damaged"));

// B09: оставшийся профиль HV — опасная попытка без чистого зачёта; B07: балансир, чистый зачёт
await caseGo("B09"); await gather(); await setS(4); await setA(0.7);
await act("start");
rep("B09: запуск с профилем HV остановлен: «4,35 В … предел 4,20 В»", /4,35 В.*4,20 В/.test(await msg()), (await msg()).slice(0, 100));
await p.click('.ct [data-type="LiPo"]'); await act("start"); await W(1000); await act("control");
rep("B09: после исправления дело закрыто как учебный разбор, задание «ошибка» не засчитано", /учебный разбор/.test(await msg()) && !(await done("fix")));
await caseGo("B07");
rep("B07: силовой уже подключён, балансира нет", /✓/.test(await txt('[data-act="main"]')) && !/✓/.test(await txt('[data-act="balance"]')));
for (const a of ["look", "label", "passport"]) await act(a);
await act("measure");
rep("B07: без балансира банок не видно", /Банок не видно/.test(await msg()));
await act("balance"); await act("measure"); await setS(4); await setA(0.7);
await act("start"); await W(1000); await act("control");
rep("B07: балансир подключён, зарядка без опасной попытки — задание «ошибка» засчитано", await done("fix"));

// B13/B14: ёмкость по Вт·ч и вольтам; B15: ватты не ватт-часы
await caseGo("B13"); await act("look"); await act("label"); await act("passport");
await act("decline"); await p.click('.ct [data-reason="chem"]'); await W(60);
rep("B13: отказ до расчёта ёмкости — «сначала вычисли»", /вычислить/.test(await msg()));
await act("deriveWh");
rep("B13: 133,2 Вт·ч ÷ 22,2 В = 6000 мА·ч", /6000 мА·ч/.test(await txt(".ct-calc")) && /6000 мА·ч \(вычислено/.test(await txt(".ct-known")));
await p.click('.ct [data-reason="chem"]'); await W(60);
rep("B13: ёмкость установлена, химия нет — отказ верен, задание «Вт·ч»", await done("wh"));
await caseGo("B15"); await act("look"); await act("label"); await act("passport"); await act("derivePower");
rep("B15: 150 Вт ÷ 15 В = 10 А, ёмкость не установлена", /10 А/.test(await txt(".ct-calc")) && /Ёмкость\s*не установлено/.test(await txt(".ct-known")));

// B10/B11: профиля нет у зарядника — не подгонять химию; B12: нагрев во время зарядки — остановить
await caseGo("B10"); await gather(); await setS(4); await setA(0.7); await p.click('.ct [data-type="LiHV"]');
await act("start");
rep("B10: запуск с ближайшим LiHV 4,35 В не проходит — у зарядника нет профиля 4,45 В", /нет профиля 4,45 В/.test(await msg()), (await msg()).slice(0, 100));
await act("decline"); await p.click('.ct [data-reason="chem"]'); await W(60);
rep("B10: причина «химия не подтверждена» отклонена", /Причина не та/.test(await msg()));
await p.click('.ct [data-reason="charger"]'); await W(60);
rep("B10: «зарядник не даёт подтверждённый профиль» — задание «профиль»", await done("profile"), (await msg()).slice(0, 80));
await caseGo("B11"); await gather(); await setS(4); await setA(2.2); await p.click('.ct [data-type="LiPo"]');
await act("start");
rep("B11: LiPo ради 4,20 В не проходит — шаблон LiIon этого зарядника 4,10 В", /шаблон LiIon — 4,10 В/.test(await msg()), (await msg()).slice(0, 100));
await caseGo("B03"); await gather(); await act("decline"); await p.click('.ct [data-reason="charger"]'); await W(60);
rep("B03: причина «зарядник» отклонена — не хватает сведений о батарее", /Дело не в заряднике/.test(await msg()));
await caseGo("B12"); await gather(); await setS(4); await setA(0.7);
await act("start"); await W(1400);
const hot = await txt(".ct-run");
await act("control");
rep("B12: при нагреве «проверил: норма» не закрывает дело", /греется/.test(hot) && /Температура не в норме/.test(await msg()) && !(await done("heat")), hot.slice(0, 80));
await act("stop");
rep("B12: остановка при нагреве — дело закрыто, задание «нагрев»", await done("heat") && /остановил/.test(await msg()));

const sw = await p.evaluate(() => document.documentElement.scrollWidth);
const small = await p.evaluate(() => [...document.querySelectorAll(".ct button")].filter((x) => x.offsetParent && x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim().slice(0, 20)));
rep("вкладка не шире экрана, кнопки не ниже 44 px", sw <= 390 && !small.length, `scrollWidth ${sw}, мелкие: ${small.join(", ")}`);

// Старый стенд «Батарея»: перезаряд звезды не даёт
await p.click('[data-figtab="battery"]'); await W(700);
const q = (sel) => p.evaluate((sel) => { const e = document.querySelector("#quest " + sel); if (e) e.click(); return !!e; }, sel);
await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]');
await p.evaluate(() => document.querySelector("#fig").scrollIntoView({ block: "start" }));
await W(16000);
await p.evaluate(() => { const x = [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Заряд LiPo"); x && x.click(); });
await W(1200);
const hv = await p.evaluate(() => ({ conf: !!document.querySelector("#quest [data-conf]"), done: !!document.querySelector('#missions li[data-m="hv"].ok') }));
rep("стенд «Батарея»: режим сменили после перезаряда — звезды нет", !hv.conf && !hv.done, JSON.stringify(hv));

// Ревью 034 (карточка 038): после опасной попытки в том же деле — только учебный разбор, без звезды. Звёзды выше
// уже получены, поэтому — чистый профиль ученика в новом контексте.
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errs.push(e.message));
p2.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p2.goto(U); await p2.waitForTimeout(900);
await p2.click('[data-figtab="lab:charge"]'); await p2.waitForTimeout(600);
const W2 = (ms) => p2.waitForTimeout(ms);
const act2 = async (a) => { await p2.click(`.ct [data-act="${a}"]`); await W2(60); };
const case2 = async (id) => { await p2.click(`.ct [data-case="${id}"]`); await W2(80); };
const txt2 = (sel) => p2.$eval(`.ct ${sel}`, (e) => e.textContent.replace(/\s+/g, " ").trim());
const msg2 = () => txt2(".ct-msg");
const done2 = (m) => p2.evaluate((m) => !!document.querySelector(`#missions li[data-m="${m}"]`)?.classList.contains("ok"), m);
const setS2 = async (n) => { for (let i = 0; i < 8; i++) await p2.click('.ct [data-s="-1"]'); for (let i = 1; i < n; i++) await p2.click('.ct [data-s="1"]'); };
const setA2 = async (a) => { const cur = Number((await txt2(".ct-a")).replace(",", ".").replace(/[^\d.]/g, "")); const n = Math.round((a - cur) * 10); for (let i = 0; i < Math.abs(n); i++) await p2.click(`.ct [data-a="${n > 0 ? 1 : -1}"]`); };
const gather2 = async () => { for (const a of ["look", "label", "passport", "main", "balance", "measure"]) await act2(a); };

await gather2(); await setS2(4); await setA2(0.7); await p2.click('.ct [data-type="LiHV"]'); await act2("start");
await p2.click('.ct [data-type="LiPo"]'); await act2("start"); await W2(1000); await act2("control");
rep("B01: после опасной попытки (LiHV) дело — учебный разбор, звезды «пример» нет", /учебный разбор/.test(await msg2()) && !(await done2("example")), (await msg2()).slice(0, 100));
await case2("B03"); await gather2(); await p2.click('.ct [data-type="LiHV"]'); await setS2(4); await act2("start");
await act2("decline"); await p2.click('.ct [data-reason="chem"]'); await W2(60);
rep("B03: угаданный запуск, затем отказ «химия» — разбор без звезды", /Верно: не заряжаем/.test(await msg2()) && /учебный разбор/.test(await msg2()) && !(await done2("unknown")), (await msg2()).slice(0, 100));
await case2("B04"); await gather2(); await act2("decline"); await p2.click('.ct [data-reason="cap"]'); await W2(60);
const m4 = await msg2();
rep("B04: причина «ёмкость» — правда, но не главная: дело не закрыто, химия не раскрыта", /Не главная причина/.test(m4) && !/LiHV|LiPo|Верно/.test(m4) && !!(await p2.$('.ct [data-reason="chem"]')), m4.slice(0, 100));
await case2("B11");
rep("B11: заголовок до наклейки и паспорта не называет химию", !/Li-?ion/i.test(await txt2(".ct-title")), await txt2(".ct-title"));
await case2("B10"); await gather2(); await act2("start");
const m10 = await msg2();
await setS2(4); await act2("start");
const m10b = await msg2();
await act2("decline"); await p2.click('.ct [data-reason="charger"]'); await W2(60);
rep("B10: запуск с 1S — опасная попытка; отказ «зарядник» после неё без звезды «профиль»", /Опасная попытка/.test(m10) && /учебный разбор/.test(await msg2()) && !(await done2("profile")), m10.slice(0, 80));
rep("B10: химия — как на наклейке, без внутреннего имени «HV-4.45»", !/HV-4/.test(m10b + (await txt2(".ct-known"))) && /нет профиля 4,45 В/.test(m10b), m10b.slice(0, 100));
await case2("B12"); await gather2(); await setA2(0.7); await act2("start");
await setS2(4); await act2("start"); await W2(1400); await act2("stop");
rep("B12: после опасной попытки остановка при нагреве — разбор без звезды «нагрев»", /остановил/.test(await msg2()) && /учебный разбор/.test(await msg2()) && !(await done2("heat")), (await msg2()).slice(0, 100));
await case2("B08"); await gather2();
const ev8 = await txt2(".ct-ev");
await setA2(0.7); await act2("start");
rep("B08: на заряднике остался 6S при 4 банках — запуск остановлен до зарядки", /6S, а банок 4/.test(await msg2()) && !(await p2.$(".ct-run .ct-screen")), (await msg2()).slice(0, 100));
rep("B08: паспорт не называет чужое дело", !/B0\d|B1\d/.test(ev8), ev8.slice(0, 120));
await case2("B14"); await gather2(); await act2("deriveWh"); await act2("start");
await case2("B14"); await gather2(); await act2("deriveWh"); await setS2(6); await setA2(3);
await act2("start"); await W2(1000); await act2("control");
rep("B14: 133,2 Вт·ч ÷ 22,2 В = 6000 мА·ч, 6S, 3 А — зарядка проконтролирована, задание «Вт·ч»", /Дело закрыто/.test(await msg2()) && (await done2("wh")), (await msg2()).slice(0, 100));
await ctx2.close();

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
