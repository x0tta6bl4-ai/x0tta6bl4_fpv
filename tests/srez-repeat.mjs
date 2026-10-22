// Повтор колоды «Срез» (гл. 20) и «Пробный срез» (прил. И) — пробелы, найденные ревью Grok 023:
// лестница интервалов 1 → 3 → 7 → 14 → 30 дней (дальше 30); карточка раньше срока не показывается («на сегодня всё»),
// «повторить всё равно» расписание не сдвигает; ошибки пробного среза считаются точно, уходят в повтор сегодня,
// ссылка ведёт в главу из карты покрытия; у расхождений с ключом видно «Учебник уточняет».
// Время в странице сдвигается через localStorage.__dt (Date.now + сдвиг) — так проверяем дни без ожидания.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const SREZ = JSON.parse(readFileSync(resolve(ROOT, "docs/content/srez.json"), "utf8"));
const COV = new Map(JSON.parse(readFileSync(resolve(ROOT, "docs/content/srez-coverage.json"), "utf8")).items.map((c) => [String(c.n), c]));
const DAY = 864e5, KEY = "fpv_srez_sched";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { const real = Date.now.bind(Date); Date.now = () => real() + Number(localStorage.getItem("__dt") || 0); });
const p = await ctx.newPage();
const errs = [], res = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const W = (ms) => p.waitForTimeout(ms);
const sched = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
const setSched = (v) => p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, v]);
const openDeck = async () => { await p.goto(BASE + "#20"); await p.reload(); await W(800); await p.click('[data-pool="srez"]'); await W(200); };
const cardKey = async () => { const t = await p.$eval("#card small", (e) => e.textContent); const m = t.match(/Срез · (?:№)?([^\s·]+)/); return m ? `srez:${m[1]}` : null; };
const grade = async (k) => { await p.click("[data-flip]"); await W(60); await p.click(`[data-k="${k}"]`); await W(120); };

await p.goto(BASE + "#20"); await W(500);
await p.evaluate((k) => { localStorage.removeItem(k); localStorage.removeItem("__dt"); }, KEY);
await openDeck();
const K = await cardKey();
await grade(1);
let r = (await sched())[K];
rep("первое «знал» — повтор через 1 день", !!r && r.interval === 1 && Math.abs(r.due - Date.now() - DAY) < 120000, JSON.stringify(r));

// Остальные вопросы — в далёком будущем, чтобы к сроку K была единственной картой к повтору
const far = Object.fromEntries(SREZ.items.map((it) => [`srez:${it.n}`, { step: 5, interval: 30, due: Date.now() + 400 * DAY, last: Date.now() }]));
far[K] = (await sched())[K];
await setSched(far);
const ladder = [3, 7, 14, 30, 30];
const got = [];
for (const want of ladder) {
  const due = (await sched())[K].due;
  await p.evaluate((dt) => localStorage.setItem("__dt", String(dt)), due - Date.now() + 60000 + Number(await p.evaluate(() => localStorage.getItem("__dt") || 0)));
  await openDeck();
  const k = await cardKey();
  if (k !== K) { got.push(`не та карта ${k}`); break; }
  await grade(1);
  got.push((await sched())[K].interval);
}
rep("лестница: после 1 дня — 3, 7, 14, 30 и дальше 30", JSON.stringify(got) === JSON.stringify(ladder), JSON.stringify(got));

// Раньше срока — «на сегодня всё», карточек нет
await openDeck();
const rest = await p.$eval("#card", (e) => e.textContent);
rep("раньше срока карточки не показываются — «на сегодня всё»", /на сегодня всё/.test(rest) && !(await p.$("[data-flip]")), rest.slice(0, 60));
const before = await sched();
await p.click("[data-again]"); await W(150);
const P = await cardKey();
await grade(1);
const after = (await sched())[P];
rep("«повторить всё равно»: «знал» раньше срока расписание не сдвигает", !!P && JSON.stringify(after) === JSON.stringify(before[P]), JSON.stringify({ P, before: before[P]?.interval, after: after?.interval }));

// Пробный срез: 20 вопросов, 5 ошибок
await p.evaluate(() => localStorage.removeItem("__dt"));
await setSched({});
await p.goto(BASE + "#И"); await p.reload(); await W(800);
await p.click("#srz-mode-exam"); await W(300);
if (!(await p.$("#exam-act-reveal"))) { const st = await p.$("#srz-exam-start, [data-exam-start]"); if (st) await st.click(); await W(200); }
const missed = [], fixSeen = [];
for (let i = 0; i < 20; i++) {
  const num = await p.$eval("#srz-exam-box .eyebrow", (e) => e.textContent.replace(/^.*· /, "").replace(/^№/, "").trim());
  await p.click("#exam-act-reveal"); await W(60);
  if (COV.get(num)?.fix) fixSeen.push([num, /Учебник уточняет/.test(await p.$eval("#srz-exam-box", (e) => e.textContent))]);
  if (i % 4 === 0) { missed.push(num); await p.click("#exam-act-bad"); } else await p.click("#exam-act-good");
  await W(60);
}
const out = await p.evaluate(() => ({ t: document.querySelector("#srz-exam-box").textContent, links: [...document.querySelectorAll("#srz-exam-box .srz-miss-item")].map((d) => ({ q: d.querySelector("b")?.textContent || "", href: d.querySelector("a[href]")?.getAttribute("href") || "" })) }));
rep("итог пробного среза: 15 из 20, к повтору ровно 5", /15 из 20/.test(out.t) && out.links.length === 5, out.t.slice(0, 80));
// Глава из карты: у full/partial и у расхождений (fix) с главой ссылка обязана быть; у прочих ссылки нет
const badLinks = out.links.map((l, i) => ({ ...l, n: missed[i] })).filter((l) => { const cv = COV.get(l.n); const want = cv && cv.ch != null && (cv.fix || ["full", "partial"].includes(cv.status)) ? `#${cv.ch}` : ""; return l.href !== want; });
rep("ссылка каждой ошибки ведёт в главу этого вопроса по карте покрытия", !badLinks.length, JSON.stringify(badLinks.slice(0, 3)));
const sc = await sched();
rep("ошибки пробного среза — в повторе колоды «Срез» сегодня", missed.every((n) => sc[`srez:${n}`] && sc[`srez:${n}`].due <= Date.now() + 1000), JSON.stringify(missed));
// Выборка случайная: проходим новые срезы, пока не встретится вопрос с расхождением (13 из 143 — почти всегда в первых двух)
for (let round = 0; round < 8 && !fixSeen.length; round++) {
  await p.click("#srz-exam-restart"); await W(150);
  for (let i = 0; i < 20 && !fixSeen.length; i++) {
    const num = await p.$eval("#srz-exam-box .eyebrow", (e) => e.textContent.replace(/^.*· /, "").replace(/^№/, "").trim());
    await p.click("#exam-act-reveal"); await W(40);
    if (COV.get(num)?.fix) fixSeen.push([num, /Учебник уточняет/.test(await p.$eval("#srz-exam-box", (e) => e.textContent))]);
    await p.click("#exam-act-good"); await W(40);
  }
}
rep("у вопросов, где ключ неверен, в пробном срезе видно «Учебник уточняет»", fixSeen.length > 0 && fixSeen.every(([, ok]) => ok), JSON.stringify(fixSeen));

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
