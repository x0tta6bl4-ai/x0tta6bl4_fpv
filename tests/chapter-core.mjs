// Пилот обсуждения 004 (карточка 042): у главы с полем `core` открыто «Главное», стенд — сразу после него, весь прежний
// текст — в свёрнутом «Подробнее»; `?pilot=a` — глава как раньше (вариант «до» для живого замера). Пока текста гл. 10
// нет в данных (карточка 041), «Главное» подставляется через window.__FPV_TEST_CORE; без него гл. 10 не меняется.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const res = [], errs = [];
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = async (core) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (core) await ctx.addInitScript((c) => { window.__FPV_TEST_CORE = c; }, core);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  return p;
};
const layout = (p) => p.evaluate(() => {
  const core = document.querySelector("#core"), more = document.querySelector("details.more"), lab = document.querySelector("#labcard");
  const secs = [...document.querySelectorAll("#main section.sec")];
  const before = (a, z) => !!(a && z && a.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING);
  const r = core && core.getBoundingClientRect();
  return {
    core: !!core, coreText: core ? core.textContent.trim() : "", coreVisible: !!(r && r.height > 0 && core.offsetParent),
    more: !!more, moreOpen: !!(more && more.open), secs: secs.length, secsInMore: secs.filter((s) => more && more.contains(s)).length,
    labAfterCore: before(core, lab), labBeforeMore: before(lab, more), riddleInMore: !!(more && more.querySelector(".riddle")),
    riddleOutside: !!document.querySelector("#main .riddle") && !(more && more.querySelector(".riddle")),
    checkOutside: !!document.querySelector("#check") && !(more && more.contains(document.querySelector("#check"))),
    summaryOutside: !!document.querySelector("#main .summary") && !(more && more.contains(document.querySelector("#main .summary"))),
    sw: document.documentElement.scrollWidth,
  };
});

// 1. Без «Главного» гл. 10 — как была
let p = await page(null);
await p.goto(FILE + "#10"); await p.waitForTimeout(900);
let L = await layout(p);
rep("без `core` гл. 10 не меняется: нет «Главного» и «Подробнее», разделы открыты", !L.core && !L.more && L.secs > 0 && L.secsInMore === 0, JSON.stringify({ secs: L.secs }));
await p.context().close();

// 2. С «Главным»
const CORE = { 10: "<p><b>Тест движка.</b> Пульт передаёт команды приёмнику по радио.</p>" };
p = await page(CORE);
await p.goto(FILE + "#10"); await p.waitForTimeout(900);
L = await layout(p);
rep("«Главное» видно сразу, без раскрытия", L.core && L.coreVisible && /Тест движка/.test(L.coreText), L.coreText.slice(0, 40));
rep("весь прежний текст — в свёрнутом «Подробнее»", L.more && !L.moreOpen && L.secs > 0 && L.secsInMore === L.secs, `${L.secsInMore}/${L.secs}`);
rep("стенд — сразу после «Главного», до «Подробнее» (П3)", L.labAfterCore && L.labBeforeMore);
rep("загадка — в «Подробнее»; итог, полевой чеклист и «Проверь себя» — снаружи", L.riddleInMore && L.summaryOutside && L.checkOutside);
rep("390 px: не шире экрана", L.sw <= 390, `scrollWidth ${L.sw}`);
const labOk = await p.evaluate(() => !!document.querySelector("#labcard #missions li, #labcard #quest"));
rep("стенд гл. 10 на месте, с заданиями", labOk);
// Ссылка на раздел из прил. «И» раскрывает «Подробнее» и показывает раздел
await p.goto(FILE + "#И"); await p.waitForTimeout(800);
const link = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href="#10"][data-srz-sec]')].find((x) => x.dataset.srzSec && x.dataset.srzSec !== "#check"); if (!a) return null; a.closest("details") && (a.closest("details").open = true); return a.dataset.srzSec; });
if (link) {
  await p.click(`a[href="#10"][data-srz-sec="${link.replace(/"/g, '\\"')}"]`); await p.waitForTimeout(900);
  const sec = await p.evaluate((t) => { const s = [...document.querySelectorAll("#main section.sec")].find((x) => x.querySelector("h3")?.textContent === t); if (!s) return null; const r = s.getBoundingClientRect(); return { open: !!s.closest("details.more")?.open, top: Math.round(r.top), h: r.height }; }, link);
  rep("ссылка «Объяснение» из прил. «И» раскрывает «Подробнее» и показывает раздел", !!sec && sec.open && sec.h > 0 && sec.top >= -2 && sec.top < 300, `${link}: ${JSON.stringify(sec)}`);
} else rep("ссылка «Объяснение» из прил. «И» раскрывает «Подробнее» и показывает раздел", false, "в прил. «И» нет ссылки на раздел гл. 10");
await p.context().close();

// 3. Вариант «до»: ?pilot=a
p = await page(CORE);
const A = FILE.replace(/(\.html)$/, "$1?pilot=a");
await p.goto(A + "#10"); await p.waitForTimeout(900);
L = await layout(p);
rep("?pilot=a — глава как раньше: нет «Главного», разделы открыты, загадка наверху", !L.core && !L.more && L.secsInMore === 0 && L.riddleOutside);
await p.context().close();

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
