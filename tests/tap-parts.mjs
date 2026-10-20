// Для каждой подписи: находим группу рисунка в её точке, берём точку этой группы подальше от самой точки подписи
// (≥10 px, сверху лежит та же группа), тапаем и смотрим, какая деталь объяснилась.
import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:1 }); const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e => errs.push(e.message));
const cdp = await ctx.newCDPSession(p);
const U = DEV; const ns0 = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number); const ns = ns0.length ? ns0 : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
let tot = 0, ok = 0, miss = [];
for (const n of ns) {
  await p.goto(U+'#'+n); await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#fig').scrollIntoView({block:'start'})); await p.waitForTimeout(300);
  const L = await p.evaluate(()=>document.querySelector('#fig .iso-stage').__anchors());
  for (let i = 0; i < L.length; i++) {
    // сброс
    await p.goto('about:blank'); await p.goto(U+'#'+n); await p.waitForTimeout(900);
    await p.evaluate(()=>document.querySelector('#fig').scrollIntoView({block:'start'})); await p.waitForTimeout(250);
    const pt = await p.evaluate((i) => {
      const st = document.querySelector('#fig .iso-stage'); const l = st.__anchors()[i]; if (!l.a) return null;
      const key = (el) => { const n = el && el.closest && el.closest('.it[data-g], [data-pick]'); return n && st.contains(n) ? (n.dataset.c || n.dataset.pick || 'g:' + n.dataset.g) : ''; };
      let k = l.pick; if (!k) for (const el of document.elementsFromPoint(l.a[0], l.a[1])) if ((k = key(el))) break;
      if (!k) return { x: l.a[0], y: l.a[1], k: '-', vv: visualViewport.offsetTop };
      const sr = st.getBoundingClientRect();
      for (let r = 10; r <= 30; r += 4) for (let j = 0; j < 12; j++) { const x = l.a[0] + Math.cos(j / 12 * 6.283) * r, y = l.a[1] + Math.sin(j / 12 * 6.283) * r; if (x < sr.left + 4 || x > sr.right - 4 || y < sr.top + 4 || y > sr.bottom - 4) continue; const top = document.elementFromPoint(x, y); if (top && key(top) === k) return { x, y, k, r, vv: visualViewport.offsetTop }; }
      return { x: l.a[0], y: l.a[1], k, r: 0, vv: visualViewport.offsetTop };
    }, i);
    if (!pt) continue;
    tot++;
    const y = pt.y - pt.vv;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] }); await p.waitForTimeout(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
    const info = await p.evaluate(() => document.querySelector('#fig .finfo-flow')?.textContent || '');
    const name = L[i].text;
    const good = info.startsWith(name.slice(0, 18));
    if (good) ok++; else miss.push(`ch${n} «${name.slice(0, 30)}» [${pt.k} r${pt.r}] → «${info.slice(0, 40)}»`);
  }
}
console.log(`OK ${ok}/${tot}`); console.log(miss.join('\n')); console.log('errors', errs); await b.close();
