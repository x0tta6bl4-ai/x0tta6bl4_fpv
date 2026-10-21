// Единственное место расчётов, сохранённые источники и рабочие ссылки шпаргалки.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { CHAPTERS_A as A } from '../data/chapters-a.mjs';
import { CHAPTERS_B as B } from '../data/chapters-b.mjs';
import { CHAPTERS_C as C } from '../data/chapters-c.mjs';
import { KIDS } from '../data/kids.mjs';
import { HINTS } from '../data/hints.mjs';
const chapters=[...A,...B,...C], guide=chapters.find(c=>c.id==='20');
assert.equal(chapters.reduce((n,c)=>n+(c.questions?.length||0),0),146,'chapter questions preserved');
assert.doesNotMatch(chapters.find(c=>c.id==='12').sections.find(s=>s.title==='Диапазоны и таблицы каналов').body,/910, 980|1405, 1430/,'channel grids are reference material');
const calculations=chapters.flatMap(c=>c.sections.flatMap(s=>[...s.body.matchAll(/data-calc-id="([^"]+)"/g)].map(m=>({id:m[1],ch:c.id,section:s}))));
assert.equal(calculations.length,11);assert.equal(new Set(calculations.map(x=>x.id)).size,11);
assert.equal(calculations.filter(c=>c.ch==='20').length,10);
assert.equal(calculations.find(c=>c.id==='temperature').ch,'19');
for(const calc of calculations.filter(c=>c.ch==='20')){assert.match(calc.section.body,/Пример/);assert.match(calc.section.body,/Граница/);}
assert.equal(KIDS['20'],undefined);
assert.equal(Object.keys(KIDS).length,19);
assert.match(JSON.stringify(KIDS['0']),/Закон Ома/);
assert.equal(Object.values(KIDS).flatMap(k=>k.laws||[]).filter(l=>/^I = U ÷ R/.test(l.f)).length,0);
const lostVideo=chapters.find(c=>c.id==='18').questions.find(q=>q.q.startsWith('Пропало видео'));
assert.match(lostVideo.a,/только при подтверждённом свободном безопасном пространстве/);
for(const [id,hint] of Object.entries(HINTS))if(id.endsWith(':emerg'))assert.match(hint.why,/только при подтверждённом свободном безопасном пространстве/,id);
for(const file of ['../src/figs/preflight.mjs','../src/labs/gonogo.mjs'])assert.match(fs.readFileSync(new URL(file,import.meta.url),'utf8'),/высота — только при свободном безопасном пространстве/);

for(const c of chapters)for(const s of c.sections)for(const b of s.blocks||[])if(['safety','trap'].includes(b.type))assert.match(b.text,/^Если /,`${c.id}: ${b.type}`);
assert.equal((guide.sections[0].body.match(/<li><b>Если /g)||[]).length,12);
const coverage=JSON.parse(fs.readFileSync(new URL('../docs/content/srez-coverage.json',import.meta.url)));
assert.equal(coverage.items.length,143);assert.equal(coverage.items.filter(c=>c.status==='conflict').length,13);assert.equal(coverage.items.filter(c=>['partial','none'].includes(c.status)).length,0);
console.log('PASS operator static: 10 расчётов + погода, 12 действий, 143 вопроса, сохранена дополнительная физика');
if(process.argv.includes('--static'))process.exit(0);
const { chromium }=await import('playwright');const browser=await chromium.launch({args:['--no-sandbox']});
try{
 fs.mkdirSync('tests/out',{recursive:true});
 for(const width of [360,390,412,599,600,650,700,701,1280]){
  const page=await browser.newPage({viewport:{width,height:width>=599&&width<=700?390:844},isMobile:width<=700,hasTouch:width<=700});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['light','dark']){
   await page.goto(pathToFileURL(resolve('dist/dev.html')).href+'#20');await page.waitForSelector('.operator-rules');
   await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
   assert.equal(await page.locator('.operator-rules > li').count(),12);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`width ${width} ${theme}`);
   await page.locator('.operator-rules > li').first().scrollIntoViewIfNeeded();
   await page.screenshot({path:`tests/out/operator-${width}-${theme}-rules.png`});
   await page.locator('a[data-srz-sec="Расчёт 10. Масштаб карты"]').first().click();
   assert.equal(await page.locator('[data-calc-id="scale"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}),true,'same-chapter jump');
   await page.screenshot({path:`tests/out/operator-${width}-${theme}.png`});
  }
  await page.goto(pathToFileURL(resolve('dist/dev.html')).href+'#8');
  await page.locator('a[data-srz-sec="Расчёт 4. Длина волны"]').first().click();
  await page.waitForSelector('[data-calc-id="wave"]');
  assert.equal(await page.locator('[data-calc-id="wave"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}),true,'cross-chapter jump');
  await page.goto(pathToFileURL(resolve('dist/dev.html')).href+'#3');
  const rich = page.locator('details.blk').filter({hasText:'Любопытным: геометрия зазоров'}).first();
  await rich.locator('summary').click();
  assert.notEqual((await rich.locator('.blk-body').evaluate(e=>e.firstElementChild.textContent)).trim(),'','no empty parser-repaired paragraph');
  await page.goto(pathToFileURL(resolve('dist/dev.html')).href+'#0');
  const physics=page.locator('#extra');
  assert.equal(await physics.evaluate(e=>e.open),false,'physics closed at chapter end');
  await physics.locator(':scope > summary').click();
  await page.waitForSelector('#extra .kid');
  assert.ok(await physics.locator('.law').count()>0,'physics retained in the shared chapter fold');
  {
   await page.goto(pathToFileURL(resolve('dist/dev.html')).href+'#7');
   await page.waitForSelector('[data-fig="flighttime"] .fig-tools');
   const overlaps=await page.evaluate(()=>{const s=document.querySelector('#fig .iso-stage').getBoundingClientRect(),t=document.querySelector('#fig .fig-tools').getBoundingClientRect();return t.left<s.right&&t.right>s.left&&t.top<s.bottom&&t.bottom>s.top;});
   assert.equal(overlaps,false,'toolbar does not cover the tank');
   await page.locator('#fig').scrollIntoViewIfNeeded();
   await page.screenshot({path:`tests/out/operator-tank-${width}.png`});
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS operator ${width}: links and width`);
 }
}finally{await browser.close();}

// Повторяем исходную проверку касаний главы 7 без изменения её допусков.
const { spawnSync } = await import('node:child_process');
const tapped = spawnSync(process.execPath, [resolve('tests/tap-parts.mjs'), pathToFileURL(resolve('dist/dev.html')).href, '7'], {encoding:'utf8'});
const hit = tapped.stdout.match(/OK (\d+)\/(\d+)/);
assert.equal(tapped.status, 0, tapped.stderr);
if (!hit || Number(hit[1]) !== Number(hit[2])) await import('./operator-tap-diagnostic.mjs');
assert.ok(hit && Number(hit[1]) === Number(hit[2]) && Number(hit[2]) > 0, tapped.stdout);
assert.match(tapped.stdout, /errors \[\]/);
console.log('PASS operator: все детали главы 7 отвечают на касание');
