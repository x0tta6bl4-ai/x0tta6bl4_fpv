import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(DEV); await p.waitForTimeout(500);
  const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(Boolean))]);
  let n = 0;
  for (const id of ['start', ...ids, 'lab']) { await p.evaluate(x => location.hash = x, id); await p.waitForTimeout(350); n++;
    const bad = await p.evaluate(() => /NaN|undefined|Infinity/.test(document.querySelector('#main')?.innerText || '')); if (bad) errs.push('text NaN/undefined on ' + id); }
  console.log(w, 'routes', n, 'errors', JSON.stringify(errs.slice(0, 5)));
  await p.close();
}
await b.close();
