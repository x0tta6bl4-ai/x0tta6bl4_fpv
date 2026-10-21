// Путь ученика по главе (задача 021): цели и разделы идут до формул; «Физика по-школьному» и опыт лаборатории методов —
// после итога и «Проверь себя», в одном свёрнутом блоке, опыт запускается при раскрытии; разделы ③ свёрнуты; метка
// «① главное»; PID-опыта нет. (Повтор среза и пробный срез проверяет tests/study.mjs.)
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { CHAPTERS_A } from "../data/chapters-a.mjs";
import { CHAPTERS_B } from "../data/chapters-b.mjs";
import { CHAPTERS_C } from "../data/chapters-c.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const CH = [...CHAPTERS_A, ...CHAPTERS_B, ...CHAPTERS_C];
const res = [];
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const W = (ms) => p.waitForTimeout(ms);
const go = async (h) => { await p.evaluate((x) => (location.hash = x), h); await W(700); };
await p.goto(U); await W(800);

// Порядок блоков во всех главах: цели → разделы → итог → «Проверь себя» → свёрнутая физика
const bad = [];
for (const ch of CH) {
  await go(ch.id);
  const o = await p.evaluate(() => {
    const all = [...document.querySelectorAll("#main article.chapter *")];
    const at = (sel) => { const el = document.querySelector("#main " + sel); return el ? all.indexOf(el) : -1; };
    const extra = document.querySelector("#main details.extra");
    return { goals: at(".goals"), sec: at("section.sec, details.sec-more"), summary: at("section.summary"), check: at("#check"), extra: extra ? all.indexOf(extra) : -1, extraOpen: !!extra?.open, kidOut: !!document.querySelector("#main .kid:not(details.extra .kid)"), mxOut: !!document.querySelector("#main #mxsec:not(details.extra #mxsec)") };
  });
  const order = [o.goals, o.sec, o.summary, o.check, o.extra].filter((x) => x >= 0);
  if (order.some((x, i) => i && x < order[i - 1]) || o.extraOpen || o.kidOut || o.mxOut) bad.push(`${ch.id}:${JSON.stringify(o)}`);
}
rep("во всех главах цели и разделы до итога, физика и опыт — в конце и свёрнуты", !bad.length, bad.slice(0, 3).join(" | "));

// Разделы ③ свёрнуты, метка «① главное»
const p3 = CH.flatMap((c) => (c.sections || []).filter((s) => s.prio === 3).map((s) => [c.id, s.title]));
if (p3.length) {
  await go(p3[0][0]);
  const st = await p.evaluate((t) => { const d = [...document.querySelectorAll("#main details.sec-more")].find((x) => x.querySelector("h3")?.textContent === t); return d ? { open: d.open, h: Math.round(d.querySelector("summary").getBoundingClientRect().height) } : null; }, p3[0][1]);
  rep("раздел ③ свёрнут, заголовок свёртки не мельче 44 px", !!st && !st.open && st.h >= 44, JSON.stringify(st));
} else rep("раздел ③ свёрнут", true, "разделов ③ нет");
// Цветные блоки: открыто нужное на срезе и в поле, свёрнуто пояснительное
// (в главах 6, 17, 18 — там правила безопасности и ответы среза; заметку данные могут открыть сами через open)
const blk = { n: 0, closed: 0, bad: [] };
for (const id of ["6", "17", "18"]) {
  await go(id);
  const r = await p.evaluate(() => { const all = [...document.querySelectorAll("#main details.blk")]; const want = new Set(["key", "safety", "exam", "remember", "trap"]); return { n: all.length, closed: all.filter((d) => !d.open).length, bad: all.filter((d) => want.has(d.dataset.type) && !d.open).map((d) => d.dataset.type) }; });
  blk.n += r.n; blk.closed += r.closed; blk.bad.push(...r.bad.map((t) => `${id}:${t}`));
}
rep("блоки «безопасность», «на экзамене», «запомни», «ловушка» открыты, пояснения свёрнуты", blk.n > 0 && blk.closed > 0 && !blk.bad.length, JSON.stringify(blk));
await go("6");
const labels = await p.$$eval("#main .prio", (els) => els.map((e) => e.textContent));
rep("метка «① главное» вместо «① экзамен»", labels.includes("① главное") && !labels.some((l) => /экзамен/.test(l)), [...new Set(labels)].join(", "));

// Опыт запускается при раскрытии блока «Физика: откуда это»
for (const id of ["8", "6"]) {
  await go(id);
  const before = await p.$eval("#mx", (e) => e.childElementCount).catch(() => -1);
  if (before < 0) continue;
  await p.click("#main details.extra > summary"); await W(900);
  const after = await p.$eval("#mx", (e) => ({ n: e.childElementCount, w: Math.round(e.getBoundingClientRect().width) }));
  rep(`гл. ${id}: опыт лаборатории не запущен в свёрнутом блоке и запускается при раскрытии`, before === 0 && after.n > 0 && after.w > 200, `${before} → ${JSON.stringify(after)}`);
  break;
}
// Старая ссылка на опыт (#lab-waves) раскрывает блок и запускает опыт
await go("lab-waves"); await W(600);
const lk = await p.evaluate(() => ({ open: !!document.querySelector("#main details.extra")?.open, n: document.querySelector("#mx")?.childElementCount || 0, hash: location.hash }));
rep("ссылка #lab-… открывает главу с раскрытым блоком и запущенным опытом", lk.open && lk.n > 0, JSON.stringify(lk));
await go("lab");
const pid = await p.evaluate(() => [...document.querySelectorAll(".mx-card")].some((a) => /PID|ПИД|регулятор/i.test(a.textContent)));
rep("PID-опыта в лаборатории методов нет", !pid);
await go("4");
rep("в гл. 4 нет опыта лаборатории методов", !(await p.$("#main #mxsec")));

await go("6");
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
rep("страница не шире экрана телефона", sw <= 391, String(sw));
await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
