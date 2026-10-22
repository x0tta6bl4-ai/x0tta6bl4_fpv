// Гл. 20, вкладка «Что первым?» (src/labs/first.mjs, карточка 037) по ситуациям docs/content/first-action.json (036):
// данные — ровно один верный вариант и «почему» у каждого; признак → таймер → выбор → разбор («почему», «первым»,
// «что дальше», ссылка в главу); время вышло — ошибка; ошибка ставит вопросы среза в повтор сегодня и возвращает
// ситуацию в теме; звёзды за тему, «в воздухе» и круг вперемешку; «Вперемешку» закрыто, пока не пройдены все темы;
// порядок вариантов не выдаёт ответ; переход из прил. «И»; 360 px без прокрутки вбок, кнопки от 44 px.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const FA = JSON.parse(readFileSync(resolve(ROOT, "docs/content/first-action.json"), "utf8"));
const res = [], errs = [];
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };

// Данные
const badData = FA.filter((x) => x.options.filter((o) => o.correct).length !== 1 || x.options.some((o) => !o.why) || !x.cue || !x.then || !x.chapter);
rep("данные: у каждой ситуации ровно один верный вариант, «почему» у каждого, признак, продолжение, глава", FA.length >= 25 && !badData.length, `${FA.length} ситуаций; плохие: ${badData.map((x) => x.id).join(", ")}`);
const badTime = FA.filter((x) => (x.place === "air" && !(x.seconds >= 5 && x.seconds <= 8)) || (x.place === "safety" && x.seconds !== null));
rep("данные: в воздухе 5–8 с, первая помощь без таймера", !badTime.length, badTime.map((x) => x.id).join(", "));

const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const W = (ms) => p.waitForTimeout(ms);
const done = (m) => p.evaluate((m) => !!document.querySelector(`#missions li[data-m="${m}"]`)?.classList.contains("ok"), m);
const cue = () => p.$eval(".fa .fa-q", (e) => e.textContent.trim());
const cur = async () => { const c = await cue(); return FA.find((x) => x.cue === c); };
const box = () => p.$eval(".fa .fa-box", (e) => e.textContent.replace(/\s+/g, " ").trim());
const pickText = async (text) => { await p.evaluate((t) => [...document.querySelectorAll(".fa [data-opt]")].find((x) => x.textContent.trim() === t).click(), text); await W(60); };
const answerRight = async () => { const x = await cur(); await pickText(x.options.find((o) => o.correct).text); return x; };
const answerWrong = async () => { const x = await cur(); await pickText(x.options.find((o) => !o.correct).text); return x; };
const nextCard = async () => { await p.click(".fa [data-next]"); await W(60); };
const topic = async (t) => { await p.click(`.fa [data-topic="${t}"]`); await W(100); };
// Пройти тему до конца: верно на каждую ситуацию
const finish = async () => { for (let i = 0; i < 40 && (await p.$(".fa [data-opt]")); i++) { if (await p.$(".fa [data-opt]:not([disabled])")) await answerRight(); await nextCard(); } };

// Переход из прил. «И» открывает гл. 20 на вкладке «Что первым?»
await p.goto(BASE + "#И"); await W(600);
await p.evaluate(() => localStorage.clear());
await p.goto(BASE + "#И"); await p.reload(); await W(800);
await p.click('[data-go-tab="lab:first"]'); await W(900);
rep("прил. «И» → гл. 20, вкладка «Что первым?» открыта", /#20$/.test(p.url()) && !!(await p.$(".fa .fa-topics")) && (await p.$eval('[data-figtab="lab:first"]', (e) => e.getAttribute("aria-selected"))) === "true", p.url());
const mixBtn = await p.$eval('.fa [data-topic="mix"]', (e) => ({ dis: e.disabled, t: e.textContent }));
rep("«Вперемешку» закрыто, пока не пройдены все темы", mixBtn.dis && /после всех тем/.test(mixBtn.t), mixBtn.t);

// Первая помощь: без таймера; ошибка — разбор, повтор среза, ситуация возвращается
await topic("safety");
const s1 = await cur();
rep("первая помощь: таймера нет", !(await p.$(".fa .fa-time")) && /без таймера/.test(await box()), s1 && s1.id);
const w1 = await answerWrong();
const t1 = await box();
const wrongOpt = w1.options.find((o) => !o.correct), good1 = w1.options.find((o) => o.correct);
rep("ошибка: объяснено, почему не это, что первым и почему, что дальше", t1.includes("Не первым") && t1.includes(wrongOpt.why.replace(/\s+/g, " ")) && t1.includes(good1.text) && t1.includes(w1.then.replace(/\s+/g, " ")), t1.slice(0, 120));
const href1 = await p.$eval(".fa .fa-res a[href]", (e) => e.getAttribute("href"));
rep("ссылка «Разбор в главе» ведёт в главу ситуации", href1 === `#${w1.chapter}`, href1);
const sc1 = await p.evaluate(() => JSON.parse(localStorage.getItem("fpv_srez_sched") || "{}"));
rep("ошибка ставит вопросы среза ситуации в повтор сегодня", (w1.srez || []).length > 0 && w1.srez.every((n) => sc1[`srez:${n}`] && sc1[`srez:${n}`].due <= Date.now() + 1000 && sc1[`srez:${n}`].step === 0), JSON.stringify(w1.srez));
rep("пока тема не пройдена — звезды нет", !(await done("topic")));
await nextCard();
const seen = [s1.id];
for (let i = 0; i < 6 && (await p.$(".fa [data-opt]")); i++) { const x = await answerRight(); seen.push(x.id); await nextCard(); }
rep("ошибочная ситуация вернулась и решена — тема пройдена, звезда «тема»", seen.filter((id) => id === s1.id).length === 2 && (await done("topic")) && /Тема пройдена/.test(await box()), seen.join(" "));

// В воздухе: таймер, опоздание = ошибка, звезда «в воздухе» только когда все верно и в срок
await topic("air");
const a1 = await cur();
rep("в воздухе: идёт таймер на секунды ситуации", !!(await p.$(".fa .fa-time")) && a1.seconds >= 5, `${a1.id}: ${a1.seconds} с`);
await W(a1.seconds * 1000 + 600);
const tl = await box();
rep("время вышло — засчитано как ошибка, показано верное первое действие", /Время вышло/.test(tl) && tl.includes(a1.options.find((o) => o.correct).text) && !!(await p.$(".fa [data-opt].ok")), tl.slice(0, 100));
rep("опоздание не даёт звезды «в воздухе»", !(await done("air")));
await nextCard();
await finish();
rep("в воздухе: все ситуации верно и в срок — звезда «в воздухе»", await done("air"));

// Порядок вариантов перемешан: верный не всегда на одном месте
await topic("bench");
const pos = [];
for (let i = 0; i < 12 && (await p.$(".fa [data-opt]:not([disabled])")); i++) {
  const x = await cur();
  const texts = await p.$$eval(".fa [data-opt]", (els) => els.map((e) => e.textContent.trim()));
  pos.push(texts.indexOf(x.options.find((o) => o.correct).text));
  await answerRight(); await nextCard();
}
rep("место верного варианта меняется — кнопка ответ не подсказывает", new Set(pos).size > 1, pos.join(""));
// Ширина 360 и кнопки
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
const small = await p.evaluate(() => [...document.querySelectorAll(".fa button")].filter((x) => x.offsetParent && x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim().slice(0, 20)));
rep("360 px: не шире экрана, кнопки не ниже 44 px", sw <= 360 && !small.length, `scrollWidth ${sw}; мелкие: ${small.join(", ")}`);
await finish();
await topic("charge"); await finish();

// Вперемешку открыт после всех тем; 7 из 10 — без звезды, 10 из 10 — звезда
const mix2 = await p.$eval('.fa [data-topic="mix"]', (e) => e.disabled);
rep("после всех тем «Вперемешку» открыт", !mix2);
await topic("mix");
const places = new Set();
for (let i = 0; i < 10; i++) { const x = i < 3 ? await answerWrong() : await answerRight(); places.add(x.place); await nextCard(); }
rep("вперемешку: 10 ситуаций, 7 верно — итог без зачёта", /верно 7 из 10/.test(await box()) && !(await done("mixed")), (await box()).slice(0, 80));
await p.click(".fa [data-again]"); await W(100);
for (let i = 0; i < 10; i++) { await answerRight(); await nextCard(); }
rep("вперемешку: 10 из 10 — звезда «вперемешку»", (await done("mixed")) && /верно 10 из 10/.test(await box()));

// Прогресс тем сохраняется между заходами
await p.reload(); await W(900);
const kept = await p.$eval('.fa [data-topic="mix"]', (e) => !e.disabled).catch(() => false);
rep("пройденные темы помнятся после перезагрузки", kept);

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
