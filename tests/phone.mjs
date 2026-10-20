// Приёмка вертикального телефона для главы 1 (эмуляция Chromium: isMobile, touch, DPR 3).
import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const U = DEV;
const sizes = (process.argv.find((a) => /^\d+x\d+/.test(a)) || '360x780,390x844,412x915').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ args: ['--no-sandbox'] });
const res = [];
const rep = (w, item, ok, info = '') => { res.push({ w, item, ok, info }); console.log(`${w} ${ok === null ? 'N/A ' : ok ? 'PASS' : 'FAIL'} ${item}${info ? ' — ' + info : ''}`); };
for (const [W, H] of sizes) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(U + '#1'); await p.waitForTimeout(1200);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
  const tap = async (sel) => { const r = await p.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }); await touch('touchStart', [r]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(250); };
  const stickout = () => p.$eval('[data-stickout]', (e) => e.textContent);
  const knobs = () => p.$$eval('.ctl-sticks .st-knob', (ks) => ks.map((k) => { const r = k.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  const pads = () => p.$$eval('.ctl-sticks .lab-stick svg', (ks) => ks.map((k) => { const r = k.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  // 1. Ширина
  const wide = await p.evaluate(() => {
    const vw = innerWidth, out = [];
    const scrollable = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return a !== document.documentElement && a !== document.body; } return false; };
    for (const el of document.querySelectorAll('#main *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1) && !scrollable(el)) out.push(el.tagName + '.' + (el.className.baseVal ?? el.className)); }
    return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 5), n: out.length };
  });
  rep(W, 'нет горизонтальной прокрутки страницы', wide.sw <= wide.vw, `scrollWidth ${wide.sw} / ${wide.vw}`);
  rep(W, 'нет вылезающих за край элементов (вне прокручиваемых строк)', wide.n === 0, wide.n ? wide.out.join(', ') : '');
  // 2. Оглавление
  const toc = await p.evaluate(() => ({ nav: getComputedStyle(document.querySelector('#toc nav')).display, sel: !!document.querySelector('.top select')?.offsetParent }));
  rep(W, 'оглавление свёрнуто, главы — выпадающим списком сверху', toc.nav === 'none' && toc.sel, `nav ${toc.nav}`);
  // 3. Стенд и видимость управления рядом со сценой
  await p.evaluate(() => document.querySelector('#fig').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500);
  const lay = async () => p.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; };
    return { fig: R('#fig .iso-stage'), sticks: R('.ctl-sticks .ctl-pads'), arm: R('label.ctl.check:has([data-ctl="armed"])'), fault: R('[data-ctl="fault"]'), quest: R('#quest'), vh: innerHeight, st: getComputedStyle(document.querySelector('#fig')).position };
  });
  let L = await lay();
  const inter = (a, c) => a && c && a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
  rep(W, 'сцена прилипает к верху (sticky)', L.st === 'sticky', L.st);
  rep(W, 'сцена и стики видны одновременно', L.fig.t >= -1 && L.sticks.b <= L.vh + 1, `сцена ${Math.round(L.fig.t)}–${Math.round(L.fig.b)}, стики до ${Math.round(L.sticks.b)}, экран ${L.vh}`);
  for (const [k, n] of [['sticks', 'стики'], ['arm', 'тумблер ARM'], ['fault', 'выбор неисправности']]) rep(W, `панель задания (раскрыта) не закрывает ${n}`, !inter(L.quest, L[k]), inter(L.quest, L[k]) ? `пересечение: задание ${Math.round(L.quest.t)}–${Math.round(L.quest.b)}, ${n} ${Math.round(L[k].t)}–${Math.round(L[k].b)}` : '');
  await p.screenshot({ path: `${ROOT}/tests/out/mob-${W}-a.png` });
  // 4. Стик пальцем без прокрутки страницы
  let k = await knobs(), pd = await pads();
  const y0 = await p.evaluate(() => scrollY);
  await touch('touchStart', [k[0]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[k[0][0], k[0][1] - i * pd[0][3] * 0.06]]); await p.waitForTimeout(16); }
  const so1 = await stickout(); await touch('touchEnd', []); await p.waitForTimeout(200);
  const y1 = await p.evaluate(() => scrollY);
  rep(W, 'газ тянется пальцем, страница не прокручивается', /газ (?!0 %)\d+ %/.test(so1) && Math.abs(y1 - y0) < 2, `${so1.split(' · ')[0]}, scrollY ${y0}→${y1}`);
  // 5. Два стика одновременно, второе касание не сбрасывает первое
  k = await knobs(); pd = await pads();
  await touch('touchStart', [k[0]]);
  await touch('touchMove', [[k[0][0], k[0][1] - pd[0][3] * 0.15]]);
  await touch('touchStart', [[k[0][0], k[0][1] - pd[0][3] * 0.15], k[1]]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[k[0][0], k[0][1] - pd[0][3] * 0.15], [k[1][0] + i * pd[1][2] * 0.05, k[1][1]]]); await p.waitForTimeout(16); }
  const so2 = await stickout();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: k[1][0] + 6 * pd[1][2] * 0.05, y: k[1][1], id: 2 }] }); await p.waitForTimeout(150); // поднят только правый палец (id 2)
  const so3 = await stickout();
  await touch('touchEnd', []); await p.waitForTimeout(200);
  rep(W, 'два стика одновременно (газ + крен)', /крен вправо/.test(so2) && !/газ 0 %/.test(so2), so2);
  rep(W, 'отпустил правый — левый держится, правый вернулся в центр', /крен центр/.test(so3) && !/газ 0 %/.test(so3), so3);
  // 6. Подсказки деталей касанием
  await tap('#fig [data-part-pick="rx"]');
  const info = await p.$eval('.pth-info', (e) => e.textContent.slice(0, 40));
  rep(W, 'подсказка детали открывается касанием чипа (без наведения)', /Приёмник/.test(info), info);
  await tap('#fig [data-part-pick="rx"]'); await p.waitForTimeout(400); // раскладка успокоилась после смены текста подсказки
  // касание самой детали на сцене (батарея снизу дрона — берём точку подписи детали)
  const pt = await p.evaluate(() => { // точка, где сверху лежит именно батарея и рядом нет номера другой детали (касание CDP — в координатах видимой области)
    const mk = [...document.querySelectorAll('#fig .fmark')].filter((m) => m.style.visibility !== 'hidden').map((m) => { const r = m.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    for (const el of document.querySelectorAll('#fig [data-pick="battery"]')) { const r = el.getBoundingClientRect(); for (let fx = 0.2; fx <= 0.8; fx += 0.1) for (let fy = 0.2; fy <= 0.8; fy += 0.1) { const x = r.x + r.width * fx, y = r.y + r.height * fy; const top = document.elementFromPoint(x, y); if (top && top.closest('[data-pick]')?.dataset.pick === 'battery' && mk.every(([mx, my]) => Math.hypot(mx - x, my - y) > 16)) return [x - (visualViewport?.offsetLeft || 0), y - (visualViewport?.offsetTop || 0)] } }
    return [0, 0]; });
  await touch('touchStart', [pt]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(300);
  const info2 = await p.$eval('.pth-info', (e) => e.textContent.slice(0, 40));
  rep(W, 'касание детали на сцене выбирает её', /Батарея/.test(info2), info2);
  if (/Батарея/.test(info2)) { await touch('touchStart', [pt]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(300); }
  // 7. Свёрнутая панель задания
  const qminBtn = await p.$('[data-qmin]');
  if (qminBtn) { await tap('[data-qmin]'); L = await lay(); for (const [k2, n] of [['sticks', 'стики'], ['arm', 'тумблер ARM'], ['fault', 'выбор неисправности']]) rep(W, `свёрнутая панель задания не закрывает ${n}`, !inter(L.quest, L[k2])); await p.screenshot({ path: `${ROOT}/tests/out/mob-${W}-b.png` }); await tap('[data-qmin]'); }
  // 8. Полноэкранный режим
  await p.evaluate(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  const sy0 = await p.evaluate(() => scrollY);
  await tap('#full'); await p.waitForTimeout(400);
  const fullOn = await p.evaluate(() => document.querySelector('#labcard').classList.contains('full'));
  await p.screenshot({ path: `${ROOT}/tests/out/mob-${W}-full.png` });
  await tap('#full'); await p.waitForTimeout(400);
  const fs = await p.evaluate(() => ({ off: !document.querySelector('#labcard').classList.contains('full'), y: scrollY }));
  rep(W, 'полноэкранный режим: вход и выход касанием', fullOn && fs.off);
  rep(W, 'после выхода положение страницы сохранено', Math.abs(fs.y - sy0) < 30, `scrollY ${sy0}→${fs.y}`);
  // 9. Поле ответа: в зоне видимости после касания (экранная клавиатура не эмулируется)
  if (await p.$('#guess')) {
    await p.evaluate(() => document.querySelector('#guess').scrollIntoView({ block: 'end' }));
    await tap('#guess'); await p.waitForTimeout(400);
    const g = await p.evaluate(() => { const r = document.querySelector('#guess').getBoundingClientRect(); return { t: r.top, b: r.bottom, vh: innerHeight, f: document.activeElement === document.querySelector('#guess') }; });
    rep(W, 'поле догадки получает фокус и видно (без клавиатуры)', g.f && g.t >= 0 && g.b <= g.vh, `${Math.round(g.t)}–${Math.round(g.b)} / ${g.vh}`);
  }
  rep(W, 'экранная клавиатура не закрывает поле', null, 'эмулятор не показывает экранную клавиатуру — проверить на живом телефоне');
  // 10. Возврат из фона: заморозка вкладки при газе выше висения
  await p.evaluate(() => document.querySelector('#fig').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
  await tap('label.ctl.check:has([data-ctl="armed"]) input'); await p.waitForTimeout(400);
  k = await knobs(); pd = await pads();
  await touch('touchStart', [k[0]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[k[0][0], k[0][1] - i * pd[0][3] * 0.06]]); await p.waitForTimeout(16); } await touch('touchEnd', []);
  await p.waitForTimeout(2000);
  const before = await p.$eval('[data-readout]', (e) => e.textContent);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await new Promise((r) => setTimeout(r, 6000)); await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await p.waitForTimeout(150);
  const after = await p.$eval('[data-readout]', (e) => e.textContent);
  await p.waitForTimeout(1500);
  const metr = await p.$$eval('#metrics .metric b', (bs) => bs.map((b) => b.textContent).join(' | '));
  const nan = /NaN|Infinity/.test(after + metr);
  rep(W, 'возврат из фона: без NaN и зависания', !nan, `до: ${before} · после: ${after}`);
  // 11. Поворот и возврат
  await p.evaluate(() => { const s = document.querySelector('[data-ctl="fault"]'); s.value = 'pit'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  await tap('label.ctl.check:has([data-ctl="armed"]) input'); await tap('#fig [data-part-pick="vtx"]');
  const st0 = await p.evaluate(() => ({ f: document.querySelector('[data-ctl="fault"]').value, a: document.querySelector('[data-ctl="armed"]').checked, stars: [...document.querySelectorAll('#missions li')].map((l) => (l.classList.contains('ok') ? '★' : '☆')).join('') }));
  await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${ROOT}/tests/out/mob-${W}-land.png` });
  const land = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(800);
  const st1 = await p.evaluate(() => ({ f: document.querySelector('[data-ctl="fault"]').value, a: document.querySelector('[data-ctl="armed"]').checked, stars: [...document.querySelectorAll('#missions li')].map((l) => (l.classList.contains('ok') ? '★' : '☆')).join(''), sw: document.documentElement.scrollWidth, vw: innerWidth }));
  rep(W, 'поворот: состояние опыта сохраняется', st0.f === st1.f && st0.a === st1.a && st0.stars === st1.stars, `${JSON.stringify(st0)} → ${st1.f},${st1.a},${st1.stars}`);
  rep(W, 'поворот: компоновка восстанавливается', land && st1.sw <= st1.vw);
  await p.evaluate(() => document.querySelector('#fig').scrollIntoView({ block: 'start' })); await p.waitForTimeout(400);
  await p.screenshot({ path: `${ROOT}/tests/out/mob-${W}-back.png` });
  rep(W, 'нет ошибок в консоли', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}
const f = res.filter((r) => r.ok === false).length, na = res.filter((r) => r.ok === null).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${f}, N/A ${na}`);
await b.close();
