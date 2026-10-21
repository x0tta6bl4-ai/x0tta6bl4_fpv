// Приёмка первого шага и остановившихся мостов. Старые проверки не меняются.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({args:['--no-sandbox']});
const out = resolve(ROOT, 'tests/out/path3d-novice'); mkdirSync(out,{recursive:true});
let fail = 0; const errors=[];
function check(label, ok, detail='') { console.log(`${ok?'PASS':'FAIL'} ${label} ${detail}`); if(!ok) fail++; }
for (const [width,height] of [[360,740],[390,844],[412,915]]) for (const theme of ['light','dark']) {
 const context = await browser.newContext({viewport:{width,height},colorScheme:theme,isMobile:true,hasTouch:true});
 // Внешние шрифты не относятся к работе модели и могут быть недоступны в среде CI.
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const tag=`${width} ${theme}`;
 await page.goto(pathToFileURL(resolve(ROOT,'dist/dev.html')).href+'#1');
 await page.locator('[data-figtab="lab:path3d"]').click();
 await page.waitForFunction(()=>document.querySelector('#labroot')?.__p3);
 await page.evaluate(()=>document.querySelector("#labcard").scrollIntoView({block:"start"}));
 const initial=await page.evaluate(()=>({
   bottom:Math.max(...[...document.querySelectorAll('[data-sym]')].map(b=>b.getBoundingClientRect().bottom)),
   hidden:document.querySelector('.d3-parts').hidden,
   width:document.documentElement.scrollWidth,
   labels:[...document.querySelectorAll('.p3-flow')].map(l=>({text:l.textContent,pe:getComputedStyle(l).pointerEvents})),
 }));
 check(`${tag}: три симптома на первом экране`, initial.bottom<=height, String(initial.bottom));
 check(`${tag}: детали раскрываются после действия`,initial.hidden);
 check(`${tag}: нет горизонтальной прокрутки`,initial.width<=width);
 check(`${tag}: подписи пропускают касания`,initial.labels.length===2&&initial.labels.every(l=>l.pe==='none'));
 await page.screenshot({path:resolve(out,`${width}-${theme}-start.png`)});
 await page.locator('[data-sym="cmd"]').click();
 await page.locator('[data-part="fc"]').click();
 check(`${tag}: полётник не закрывает диагноз`,!(await page.locator('[data-m="deaf"]').getAttribute('class')||'').includes('ok'));
 await page.locator('[data-part="beam_cmd"]').click();
 await page.waitForFunction(()=>document.querySelector('.d3-marker').textContent.includes('встал'));
 const dead=await page.evaluate(()=>{const r=document.querySelector('#labroot');return {packets:r.__p3.packets(),hi:r.__p3.highlight(),accent:r.__p3.accent(),fc:document.querySelector('[data-part="fc"]').hasAttribute('data-off')};});
 check(`${tag}: выбранный мёртвый мост не оживает`,dead.packets.cmd===0&&dead.packets.vid>=5&&JSON.stringify(dead.hi)!==JSON.stringify(dead.accent));
 check(`${tag}: полётник приглушён, но доступен`,dead.fc&&await page.locator('[data-part="fc"]').isEnabled());
 await page.locator('[data-part="fc"]').click();
 check(`${tag}: развилка по движениям стиков`,/Приёмник.*видит ли FC.*Не видит.*Видит/.test(await page.locator('.d3-info').textContent()));
 await page.locator('[data-part="rx"]').click();
 check(`${tag}: RX закрывает диагноз`,(await page.locator('[data-m="deaf"]').getAttribute('class')||'').includes('ok'));
 // Без скрытия тоста или ожидания его исчезновения — сразу следующее действие.
 await page.locator('[data-sym="vid"]').click();
 await page.locator('[data-part="beam_vid"]').click();
 await page.waitForFunction(()=>document.querySelector('#labroot').__p3.packets().vid===0);
 check(`${tag}: второй симптом срабатывает сразу`,await page.locator('#labroot').getAttribute('data-mode')==='vid');
 const toast=await page.evaluate(()=>{const t=document.querySelector('#toast');return {pe:getComputedStyle(t).pointerEvents,h:t.hidden?0:t.getBoundingClientRect().height};});
 check(`${tag}: тост не блокирует и не растёт`,toast.pe==='none'&&toast.h<=60,JSON.stringify(toast));
 await page.locator('.d3-stage').scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(out,`${width}-${theme}-stopped.png`)});
 await context.close();
}
// Отказ WebGL оставляет те же диагностические действия доступными.
const context=await browser.newContext({viewport:{width:360,height:740}});
await context.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const page=await context.newPage();await page.goto(pathToFileURL(resolve(ROOT,'dist/dev.html')).href+'#1');
await page.locator('[data-figtab="lab:path3d"]').click();
check('без WebGL: детали доступны',await page.locator('[data-part="fc"]').isVisible());
await page.locator('[data-sym="cmd"]').click();await page.locator('[data-part="rx"]').click();
check('без WebGL: диагноз засчитан',(await page.locator('[data-m="deaf"]').getAttribute('class')||'').includes('ok'));
await browser.close();console.log(`ИТОГ: FAIL ${fail}, ERR ${errors.length}`);process.exit(fail||errors.length?1:0);
