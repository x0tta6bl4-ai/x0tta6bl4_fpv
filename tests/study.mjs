// Автотест для задачи 017:
// 1. Порядок главы (цели и новые слова — перед стендом и объяснением).
// 2. Свёрнутые блоки (details.blk, summary.blk-h от 44 px, key открыт, note свёрнут).
// 3. Расписание повтора колоды «Срез» (quiz.mjs, интервалы 1, 3, 7, 14, 30 дн., fpv_srez_sched).
// 4. Пробный срез на странице «И. Вопросы среза» (20 случайных вопросов, показ ответа, оценка, итог с ошибками).

import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = pathToFileURL(resolve(ROOT, "dist/dev.html")).href;

const res = [];
const rep = (item, ok, info = "") => {
  res.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));

await page.goto(DEV + "#1");
await page.waitForTimeout(600);

// 1. Проверка порядка главы
const orderCheck = await page.evaluate(() => {
  const ch = document.querySelector(".chapter");
  if (!ch) return { found: false };
  const goals = ch.querySelector(".goals");
  const kid = ch.querySelector(".kid");
  const stage = ch.querySelector(".iso-stage, #fig");
  const sec = ch.querySelector(".sec");

  if (!goals || !sec) return { found: true, goalsBeforeSec: false };

  // Индексы в DOM
  const children = Array.from(ch.children);
  const goalsIdx = children.findIndex((el) => el.contains(goals) || el === goals);
  const kidIdx = kid ? children.findIndex((el) => el.contains(kid) || el === kid) : -1;
  const stageIdx = stage ? children.findIndex((el) => el.contains(stage) || el === stage) : -1;
  const secIdx = children.findIndex((el) => el.contains(sec) || el === sec);

  return {
    found: true,
    goalsIdx,
    kidIdx,
    stageIdx,
    secIdx,
    goalsBeforeKid: kidIdx === -1 || goalsIdx < kidIdx,
    goalsBeforeStage: stageIdx === -1 || goalsIdx < stageIdx,
    goalsBeforeSec: goalsIdx < secIdx
  };
});

rep("цели и новые слова стоят перед объяснением", orderCheck.goalsBeforeSec, `goals=${orderCheck.goalsIdx}, sec=${orderCheck.secIdx}`);
rep("цели и новые слова стоят перед интерактивом стенда", orderCheck.goalsBeforeStage, `goals=${orderCheck.goalsIdx}, stage=${orderCheck.stageIdx}`);

// 2. Проверка свёрнутых блоков
const blkCheck = await page.evaluate(() => {
  const detailsBlk = Array.from(document.querySelectorAll(".chapter details.blk"));
  const keys = detailsBlk.filter((d) => d.dataset.type === "key");
  const notes = detailsBlk.filter((d) => d.dataset.type === "note");

  const keyOpen = keys.every((d) => d.open);
  const noteClosed = notes.length === 0 || notes.some((d) => !d.open);

  const summaries = Array.from(document.querySelectorAll(".chapter details.blk summary.blk-h"));
  const h44 = summaries.every((s) => s.getBoundingClientRect().height >= 43.5);

  return {
    total: detailsBlk.length,
    keyOpen,
    noteClosed,
    h44,
    summaryCount: summaries.length
  };
});

rep("блоки оформлены через details.blk", blkCheck.total > 0, `всего: ${blkCheck.total}`);
rep("ключевой блок открыт, а заметки свёрнуты", blkCheck.keyOpen && blkCheck.noteClosed, `keys open: ${blkCheck.keyOpen}, notes closed: ${blkCheck.noteClosed}`);
rep("заголовок summary.blk-h имеет тач-высоту от 44 px", blkCheck.h44, `проверено ${blkCheck.summaryCount} заголовков`);

// Интерактивное раскрытие блока
await page.evaluate(() => {
  const firstNote = document.querySelector('.chapter details.blk:not([open]) summary.blk-h');
  if (firstNote) firstNote.click();
});
await page.waitForTimeout(150);
const opened = await page.evaluate(() => {
  const firstNote = document.querySelector('.chapter details.blk:not([data-type="key"])');
  return firstNote ? firstNote.open : false;
});
rep("клик по summary.blk-h раскрывает блок", opened);

// 3. Проверка расписания повтора колоды «Срез»
await page.goto(DEV + "#20");
await page.waitForTimeout(600);

// Переключаемся на колоду «Срез»
await page.click('button[data-pool="srez"]');
await page.waitForTimeout(200);

const isSrezPool = await page.evaluate(() => {
  const btn = document.querySelector('button[data-pool="srez"]');
  return btn && btn.getAttribute("aria-checked") === "true";
});
rep("выбор колоды «Срез» переключает тренажёр", isSrezPool);

// Отвечаем «Знал»
await page.click("[data-flip]");
await page.waitForTimeout(150);
await page.click('[data-k="1"]');
await page.waitForTimeout(200);

// Отвечаем «Не знал»
await page.click("[data-flip]");
await page.waitForTimeout(150);
await page.click('[data-k="0"]');
await page.waitForTimeout(200);

const schedCheck = await page.evaluate(() => {
  try {
    const raw = localStorage.getItem("fpv_srez_sched");
    if (!raw) return { ok: false, reason: "нет fpv_srez_sched" };
    const sched = JSON.parse(raw);
    const keys = Object.keys(sched);
    if (!keys.length) return { ok: false, reason: "пустой sched" };
    const entries = Object.values(sched);
    const hasKnown = entries.some((e) => e.step === 1 && e.interval === 1 && e.due > Date.now());
    const hasUnknown = entries.some((e) => e.step === 0 && e.due <= Date.now());
    return { ok: hasKnown && hasUnknown, keysCount: keys.length, hasKnown, hasUnknown };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});
rep("колода «Срез» сохраняет интервальное расписание", schedCheck.ok, JSON.stringify(schedCheck));

// 4. Проверка режима «Пробный срез» на странице «И»
await page.goto(DEV + "#И");
await page.waitForTimeout(600);

const hasExamBtn = await page.evaluate(() => !!document.getElementById("srz-mode-exam"));
rep("на странице «И» есть переключатель «Пробный срез»", hasExamBtn);

// Переключаемся в режим экзамена
await page.click("#srz-mode-exam");
await page.waitForTimeout(300);

const examStarted = await page.evaluate(() => {
  const examView = document.getElementById("srz-exam-view");
  const catalogView = document.getElementById("srz-catalog-view");
  const box = document.getElementById("srz-exam-box");
  const text = box ? box.textContent : "";
  return {
    examVisible: examView && !examView.hidden,
    catalogHidden: catalogView && catalogView.hidden,
    hasQuestion: text.includes("Вопрос 1 из 20"),
    hasRevealBtn: !!document.getElementById("exam-act-reveal")
  };
});
rep("запуск пробного среза показывает карточку экзамена", examStarted.examVisible && examStarted.catalogHidden && examStarted.hasQuestion && examStarted.hasRevealBtn);

// Раскрываем ответ
await page.click("#exam-act-reveal");
await page.waitForTimeout(150);
const hasEvalBtns = await page.evaluate(() => {
  return !!document.getElementById("exam-act-bad") && !!document.getElementById("exam-act-good");
});
rep("раскрытие вопроса в экзамене показывает кнопки оценки", hasEvalBtns);

// Проходим остальные 19 вопросов в тесте (комбинация знал и ошибся)
for (let i = 0; i < 20; i++) {
  const isDone = await page.evaluate(() => !document.getElementById("exam-act-reveal") && !document.getElementById("exam-act-good"));
  if (isDone) break;

  const needsReveal = await page.evaluate(() => !!document.getElementById("exam-act-reveal"));
  if (needsReveal) {
    await page.click("#exam-act-reveal");
    await page.waitForTimeout(50);
  }

  // На некоторых вопросах жмём «Не знал» (ошиблись), на остальных — «Ответил точно»
  if (i === 1 || i === 3) {
    await page.click("#exam-act-bad");
  } else {
    await page.click("#exam-act-good");
  }
  await page.waitForTimeout(50);
}

// Проверяем экран итога
const resultCheck = await page.evaluate(() => {
  const box = document.getElementById("srz-exam-box");
  const text = box ? box.textContent : "";
  const hasScore = text.includes("Результат:");
  const hasMissed = text.includes("Вопросы для повторения") && box.querySelectorAll(".srz-miss-item").length > 0;
  const hasDeepLinks = box.querySelectorAll(".srz-miss-item a[data-srz-sec]").length > 0;
  const hasRestartBtn = !!document.getElementById("srz-exam-restart");
  const hasToCatBtn = !!document.getElementById("srz-exam-to-cat");
  return { hasScore, hasMissed, hasDeepLinks, hasRestartBtn, hasToCatBtn };
});

rep("экран итога показывает оценку и ошибки с ссылками на главы", resultCheck.hasScore && resultCheck.hasMissed && resultCheck.hasDeepLinks && resultCheck.hasRestartBtn);

// Возврат в каталог
await page.click("#srz-exam-to-cat");
await page.waitForTimeout(200);

const catalogRestored = await page.evaluate(() => {
  const cat = document.getElementById("srz-catalog-view");
  const exam = document.getElementById("srz-exam-view");
  const count = document.querySelectorAll("#srz details.srz").length;
  return cat && !cat.hidden && exam && exam.hidden && count === 143;
});
rep("возврат в каталог восстанавливает список 143 вопросов", catalogRestored);

await browser.close();

const failCount = res.filter((x) => !x).length;
console.log(`\nИТОГ: ${res.length} проверок, FAIL ${failCount}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(failCount || errs.length ? 1 : 0);
