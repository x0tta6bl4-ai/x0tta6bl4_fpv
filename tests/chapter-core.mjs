// Пилот обсуждения 004 (карточки 042, 045; у стенда гл. 10 в панели только ручки задания — meta.focus): у главы с полем `core` стенд — первым («схема сначала», решение владельца
// 27.10), под ним «Главное» свёрнуто по темам (открыто только предупреждение), весь прежний текст — в свёрнутом
// «Подробнее»; `?pilot=b` — «Главное» текстом целиком и стенд после него; `?pilot=a` — глава как раньше (вариант «до»). Движок проверяется
// на гл. 11 с временным «Главным» через window.__FPV_TEST_CORE (без него гл. 11 не меняется); гл. 10 — на настоящем
// тексте карточки 041: темы «Главного» в одно касание и вместе отвечают на вопросы её карты 21/21.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";

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
    labAfterCore: before(core, lab), labBeforeMore: before(lab, more), labBeforeCore: before(lab, core), coreBeforeMore: before(core, more),
    topics: document.querySelectorAll("#core details.core-topic").length, topicsOpen: document.querySelectorAll("#core details.core-topic[open]").length,
    warn: [...document.querySelectorAll("#core .core-warn")].map((e) => e.textContent.trim()).join(" | "), riddleInMore: !!(more && more.querySelector(".riddle")),
    riddleOutside: !!document.querySelector("#main .riddle") && !(more && more.querySelector(".riddle")),
    checkOutside: !!document.querySelector("#check") && !(more && more.contains(document.querySelector("#check"))),
    summaryOutside: !!document.querySelector("#main .summary") && !(more && more.contains(document.querySelector("#main .summary"))),
    sw: document.documentElement.scrollWidth,
  };
});

// 1. Без «Главного» глава (гл. 11) — как была
let p = await page(null);
await p.goto(FILE + "#11"); await p.waitForTimeout(900);
let L = await layout(p);
rep("без `core` гл. 11 не меняется: нет «Главного» и «Подробнее», разделы открыты", !L.core && !L.more && L.secs > 0 && L.secsInMore === 0, JSON.stringify({ secs: L.secs }));
await p.context().close();

// 2. С «Главным»
const CORE = { 11: "<p><b>Тест движка: без винтов.</b></p><p><b>Что такое LQ</b></p><p>LQ — доля дошедших пакетов.</p>" };
p = await page(CORE);
await p.goto(FILE + "#11"); await p.waitForTimeout(900);
L = await layout(p);
rep("«Главное» на экране: темы свёрнуты, предупреждение открыто", L.core && L.coreVisible && L.topics === 1 && L.topicsOpen === 0 && /без винтов/.test(L.warn), JSON.stringify({ topics: L.topics, warn: L.warn }));
rep("весь прежний текст — в свёрнутом «Подробнее»", L.more && !L.moreOpen && L.secs > 0 && L.secsInMore === L.secs, `${L.secsInMore}/${L.secs}`);
rep("схема сначала: стенд первым, под ним «Главное», потом «Подробнее»", L.labBeforeCore && L.coreBeforeMore);
await p.click("#core details.core-topic > summary"); await p.waitForTimeout(150);
const topicTxt = await p.evaluate(() => document.querySelector("#core").innerText);
rep("касание темы открывает её текст", /доля дошедших пакетов/.test(topicTxt), topicTxt.slice(0, 60));
rep("загадка — в «Подробнее»; итог, полевой чеклист и «Проверь себя» — снаружи", L.riddleInMore && L.summaryOutside && L.checkOutside);
rep("390 px: не шире экрана", L.sw <= 390, `scrollWidth ${L.sw}`);
const labOk = await p.evaluate(() => !!document.querySelector("#labcard #missions li, #labcard #quest"));
rep("стенд гл. 11 на месте, с заданиями", labOk);
// Ссылка на раздел из прил. «И» раскрывает «Подробнее» и показывает раздел
await p.goto(FILE + "#И"); await p.waitForTimeout(800);
const link = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href="#11"][data-srz-sec]')].find((x) => x.dataset.srzSec && x.dataset.srzSec !== "#check"); if (!a) return null; a.closest("details") && (a.closest("details").open = true); return a.dataset.srzSec; });
if (link) {
  await p.click(`a[href="#11"][data-srz-sec="${link.replace(/"/g, '\\"')}"]`); await p.waitForTimeout(900);
  const sec = await p.evaluate((t) => { const s = [...document.querySelectorAll("#main section.sec")].find((x) => x.querySelector("h3")?.textContent === t); if (!s) return null; const r = s.getBoundingClientRect(); return { open: !!s.closest("details.more")?.open, top: Math.round(r.top), h: r.height }; }, link);
  rep("ссылка «Объяснение» из прил. «И» раскрывает «Подробнее» и показывает раздел", !!sec && sec.open && sec.h > 0 && sec.top >= -2 && sec.top < 300, `${link}: ${JSON.stringify(sec)}`);
} else rep("ссылка «Объяснение» из прил. «И» раскрывает «Подробнее» и показывает раздел", false, "в прил. «И» нет ссылки на раздел гл. 11");
await p.context().close();

// 3. Запасной вид ?pilot=b: «Главное» текстом целиком, стенд после него
p = await page(CORE);
await p.goto(FILE.replace(/(\.html)$/, "$1?pilot=b") + "#11"); await p.waitForTimeout(900);
L = await layout(p);
rep("?pilot=b — «Главное» текстом целиком, стенд после него, прежний текст в «Подробнее»", L.core && L.topics === 0 && /доля дошедших пакетов/.test(L.coreText) && L.labAfterCore && L.labBeforeMore && L.secsInMore === L.secs);
await p.context().close();

// 4. Вариант «до»: ?pilot=a
p = await page(CORE);
const A = FILE.replace(/(\.html)$/, "$1?pilot=a");
await p.goto(A + "#11"); await p.waitForTimeout(900);
L = await layout(p);
rep("?pilot=a — глава как раньше: нет «Главного», разделы открыты, загадка наверху", !L.core && !L.more && L.secsInMore === 0 && L.riddleOutside);
await p.context().close();

// 5. Гл. 10 на настоящем «Главном» (карточка 041): стенд первым, темы свёрнуты, прежний текст свёрнут; после касания
// тем каждый фрагмент карты 21/21 на экране; ?pilot=a — прежний вид
const MAP = readFileSync(resolve(ROOT, "docs/content/ch10-core-map.md"), "utf8");
const frags = [...MAP.split("## Матрица")[0].matchAll(/^\| ([^|]+?) \|.*\| «([^»]+)»[^|]*\|\s*$/gm)].map((m) => [m[1].trim(), m[2]]);
p = await page(null);
await p.goto(FILE + "#10"); await p.waitForTimeout(900);
L = await layout(p);
rep("гл. 10: стенд первым, «Главное» по темам свёрнуто, весь прежний текст свёрнут", L.core && L.coreVisible && L.topics >= 5 && L.topicsOpen === 0 && L.more && !L.moreOpen && L.secsInMore === L.secs && L.labBeforeCore && L.coreBeforeMore, `тем ${L.topics}; предупреждение: ${L.warn}`);
await p.evaluate(() => document.querySelectorAll("#core details.core-topic > summary").forEach((s) => s.click())); await p.waitForTimeout(200);
const coreTxt = await p.evaluate(() => document.querySelector("#core")?.innerText.replace(/\s+/g, " ") || "");
const miss = frags.filter(([, f]) => !coreTxt.includes(f.replace(/\s+/g, " ").replace(/…$/, "").slice(0, 60)));
rep("гл. 10: после касания тем фрагмент «Главного» из карты 21/21 на экране у каждого вопроса", frags.length >= 21 && !miss.length, `${frags.length} строк карты; нет: ${miss.map(([q]) => q.slice(0, 12)).join("; ")}`);
rep("гл. 10: 390 px — не шире экрана", L.sw <= 390, `scrollWidth ${L.sw}`);
// Стенд гл. 10 (meta.focus, совет «базовый режим»): в панели только ручки текущего задания, остальные — по кнопке
const ctl = () => p.evaluate(() => ({ vis: [...document.querySelectorAll("#side .ctl")].filter((x) => getComputedStyle(x).display !== "none").length, all: document.querySelectorAll("#side .ctl").length, hint: document.querySelectorAll("#side .ctl.ctl-hint").length, btn: !!document.querySelector("#side .ctl-all:not([hidden])") }));
const c0 = await ctl();
await p.click("#side .ctl-all"); await p.waitForTimeout(150);
const c1 = await ctl();
rep("стенд гл. 10: видны только ручки задания, «Показать все настройки» открывает остальные", c0.all > 4 && c0.vis === c0.hint && c0.vis > 0 && c0.vis < c0.all && c0.btn && c1.vis === c1.all, JSON.stringify({ c0, c1 }));
await p.context().close();
p = await page(null);
await p.goto(A + "#10"); await p.waitForTimeout(900);
L = await layout(p);
rep("гл. 10 с ?pilot=a — прежний вид для замера «до»", !L.core && !L.more && L.secsInMore === 0);
await p.context().close();

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
