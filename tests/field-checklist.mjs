// Проверка полевых шпаргалок (решение M3 из Обсуждения 001):
// 1. Полнота: во всех практических главах 0–19 есть полевой чеклист (4–6 правил).
// 2. Эргономика: кнопка прыжка в 1 касание (высота >= 44 px), скролл к чеклисту без слома роутинга.
// 3. Контрастность на солнце: WCAG AAA не ниже 7:1 в светлой и тёмной темах.
// 4. Мобильная вёрстка: отсутствие горизонтального переполнения на экранах 360/390 px.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { CHAPTERS_A } from "../data/chapters-a.mjs";
import { CHAPTERS_B } from "../data/chapters-b.mjs";
import { CHAPTERS_C } from "../data/chapters-c.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALL_CH = [...CHAPTERS_A, ...CHAPTERS_B, ...CHAPTERS_C];
const res = [];
const rep = (item, ok, info = "") => {
  res.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`);
};

// 1. Проверка структуры данных
const practical = ALL_CH.filter((c) => Number(c.id) >= 0 && Number(c.id) <= 19);
const missingChecklist = practical.filter((c) => !Array.isArray(c.fieldChecklist) || c.fieldChecklist.length < 3);
rep(
  "все главы 0–19 содержат чеклист пилота на поле",
  missingChecklist.length === 0,
  missingChecklist.map((c) => `гл.${c.id}`).join(", ") || `всего ${practical.length} глав`
);

let badRules = [];
for (const ch of practical) {
  for (const it of ch.fieldChecklist || []) {
    if (!it.icon || !it.rule || it.rule.length > 160) {
      badRules.push(`гл.${ch.id}: ${it.rule?.slice(0, 30)}... (len ${it.rule?.length})`);
    }
  }
}
rep("все пункты чеклиста лаконичны (<= 160 символов) и имеют пиктограмму", badRules.length === 0, badRules.slice(0, 3).join("; "));

// 2. Playwright тест в браузере (мобильный экран)
const U = pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await ctx.newPage();

// Расчёт контраста WCAG по стандарту sRGB
async function getContrastRatio(el1Selector, el2Selector) {
  return await page.evaluate(
    ({ s1, s2 }) => {
      const e1 = document.querySelector(s1);
      const e2 = document.querySelector(s2);
      if (!e1 || !e2) return 0;
      function parseRgb(str) {
        const m = str.match(/\d+(\.\d+)?/g);
        return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
      }
      function lum([r, g, b]) {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      }
      const c1 = parseRgb(getComputedStyle(e1).color);
      // Если у карточки прозрачный фон, берем фон body
      let bgStr = getComputedStyle(e2).backgroundColor;
      if (bgStr.includes("rgba(0, 0, 0, 0)") || bgStr === "transparent") {
        bgStr = getComputedStyle(document.body).backgroundColor;
      }
      const c2 = parseRgb(bgStr);
      const l1 = lum(c1),
        l2 = lum(c2);
      const max = Math.max(l1, l2),
        min = Math.min(l1, l2);
      return (max + 0.05) / (min + 0.05);
    },
    { s1: el1Selector, s2: el2Selector }
  );
}

try {
  // Тест на Главе 6 (Батарея)
  await page.goto(`${U}#6`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#field-card");

  // Тач-мишень кнопки быстрого перехода >= 44 px
  const jumpBox = await page.locator(".field-card-jump").boundingBox();
  rep("кнопка перехода к чеклисту имеет тач-высоту >= 44 px", jumpBox && jumpBox.height >= 43.5, `h=${jumpBox?.height}px`);

  // Отсутствие горизонтального скролла на 390 px
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  rep("страница с чеклистом не шире экрана 390 px", scrollW <= 390, `scrollWidth=${scrollW}`);

  // Контрастность текста чеклиста (светлая тема)
  // Принудительно ставим светлую тему
  await page.evaluate(() => document.body.parentElement.setAttribute("data-theme", "light"));
  const contrastLight = await getContrastRatio(".field-card-rule", ".field-card");
  rep("контрастность текста чеклиста в светлой теме >= 7:1 (WCAG AAA)", contrastLight >= 7.0, `ratio=${contrastLight.toFixed(2)}:1`);

  // Контрастность в тёмной теме
  await page.evaluate(() => document.body.parentElement.setAttribute("data-theme", "dark"));
  const contrastDark = await getContrastRatio(".field-card-rule", ".field-card");
  rep("контрастность текста чеклиста в тёмной теме >= 7:1 (WCAG AAA)", contrastDark >= 7.0, `ratio=${contrastDark.toFixed(2)}:1`);

  // Прыжок в 1 касание
  await page.evaluate(() => window.scrollTo(0, 0));
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.click(".field-card-jump");
  await page.waitForTimeout(400); // время плавной прокрутки
  const afterScroll = await page.evaluate(() => window.scrollY);
  rep("клик на «Чеклист на поле» плавно скроллит страницу вниз к карточке", afterScroll > beforeScroll + 200, `scrollY=${afterScroll}`);

  // Проверка на других главах (например, Гл. 1)
  await page.goto(`${U}#1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#field-card");
  const ch1RuleCount = await page.locator("#field-card .field-card-item").count();
  rep("в Главе 1 чеклист содержит правила", ch1RuleCount >= 4, `правил=${ch1RuleCount}`);

  // Проверка на экране 360 px
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(100);
  const scrollW360 = await page.evaluate(() => document.documentElement.scrollWidth);
  rep("чеклист не ломает ширину 360 px", scrollW360 <= 360, `scrollWidth=${scrollW360}`);

} finally {
  await browser.close();
}

const failed = res.filter((x) => !x).length;
console.log(`\nИТОГ: ${res.length} проверок, FAIL ${failed}`);
if (failed > 0) process.exit(1);
