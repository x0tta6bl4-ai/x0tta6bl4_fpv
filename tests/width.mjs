import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await p.goto(DEV); await p.waitForTimeout(600);
const ids = await p.evaluate(() => ['start', ...new Set([...document.querySelectorAll('#toc a[href^="#"]')].map(a => a.getAttribute('href').slice(1)))]);
const bad = [];
for (const id of ids) { await p.evaluate(h => location.hash = h, id); await p.waitForTimeout(500); const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > 391) bad.push(id + ':' + sw); }
console.log('pages', ids.length, 'too wide:', JSON.stringify(bad));
await b.close();
