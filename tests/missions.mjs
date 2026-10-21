import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const b = await chromium.launch({args:['--no-sandbox']}); const p = await b.newPage({ viewport:{width:1280,height:900}});
const errs=[]; p.on('pageerror', e => errs.push(e.message));
await p.goto(DEV); await p.waitForTimeout(600);
const set = (id, v) => p.evaluate(([id,v])=>{ const el=document.querySelector(`[data-ctl="${id}"]`); if(!el) return 'no '+id; if(el.type==='checkbox'){ if(el.checked!==v) el.click(); } else { el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); } return 'ok'; }, [id,v]);
const seg = (id, v) => p.evaluate(([id,v])=>{ const el=document.querySelector(`[data-seg="${id}"][data-value="${v}"]`); el&&el.click(); }, [id,v]);
const ok = () => p.evaluate(()=>[...document.querySelectorAll('#missions li')].map(li=>(li.classList.contains('ok')?'★':'☆')+li.dataset.m).join(' '));
const go = async (h) => { await p.evaluate(h=>location.hash=h, h); await p.waitForTimeout(400); await p.evaluate(()=>document.querySelector('#fig').scrollIntoView({block:'center'})); await p.waitForTimeout(300); };
const W = (ms) => p.waitForTimeout(ms);
await go('1');
{ // глава 1: знакомство, прогнозы и подтверждающие признаки — через панель задания
  const qb = async (sel) => { const el = await p.$('#quest ' + sel); if (el) { await el.click(); await W(350); } };
  const pk = async (id) => { await p.evaluate((id) => document.querySelector(`#fig [data-part-pick="${id}"]`).click(), id); await W(250); };
  const nx = () => qb('.q-next');
  for (const id of ['rx', 'fc', 'esc', 'vtx']) await pk(id); await W(400); await nx();
  await qb('[data-pred="1"]'); await set('armed', true); await W(600); await nx();
  await qb('[data-pred="1"]'); await set('fault','modelmatch'); await W(300); await pk('rx'); await W(500); await qb('[data-conf="2"]'); await nx();
  await qb('[data-pred="0"]'); await set('fault','rpsma'); await W(300); await set('armed', true); await W(400); await pk('antenna'); await W(500); await qb('[data-conf="0"]'); await nx();
  await set('fault','motorstop'); await W(200); await set('armed', true); await W(500); await nx();
  await set('fault','propdir'); await W(200); await set('armed', true); await W(300);
  await p.evaluate(()=>{const el=document.querySelectorAll('.ctl-sticks .lab-stick svg')[0];const r=el.getBoundingClientRect();const k=document.querySelectorAll('.ctl-sticks .st-knob')[0].getBoundingClientRect();const o={bubbles:true,pointerId:1,isPrimary:true};const kx=k.x+k.width/2,ky=k.y+k.height/2;el.dispatchEvent(new PointerEvent('pointerdown',{...o,clientX:kx,clientY:ky}));el.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:r.x+r.width/2,clientY:r.y+r.height*0.25}));el.dispatchEvent(new PointerEvent('pointerup',{...o,clientX:r.x+r.width/2,clientY:r.y+r.height*0.25}));}); await W(2500);
}
console.log('ch1', await ok());
await go('3'); await p.evaluate(()=>document.querySelector('[data-act=explode]').click()); await W(300); await set('select','esc'); await W(300);
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(!e) return 'нет '+sel; e.click(); return 'ok';}, sel);
  console.log('ch3 esc до ответа', await ok(), await q('[data-qi="1"]')); await W(300); console.log('ch3 неверный', await q('[data-conf="1"]')); await W(300);
  console.log('ch3 подсказка', await p.evaluate(()=>(document.querySelector('#quest .q-wrong')||{}).textContent||'нет')); await q('[data-conf="0"]'); await W(300); }
await set('select','antenna'); await W(300); await seg('frame','TRUEX'); await W(300); console.log('ch3 truex', await ok()); await seg('frame','DEADCAT'); await W(500); console.log('ch3', await ok()); await seg('fov','150'); await W(500); console.log('ch3 wide', await ok());
await go('4');
await p.evaluate(() => { const e = document.querySelector('#quest [data-pred="1"]'); e && e.click(); }); await W(200);
await seg('mode','ACRO'); await set('stick',0.5); await W(800); await set('stick',0); await W(600);
for (let k = 0; k < 20 && !(await p.$('#quest [data-conf]')); k++) await W(200);
await p.evaluate(() => { const e = document.querySelector('#quest [data-conf="1"]'); e && e.click(); }); await W(200);
await seg('mode','ANGLE'); await set('stick',0.8); await W(1500); await set('stick',0); await W(2500); await set('acc',true); await W(2500); await set('acc',false); await set('wind',true); await set('ki',0); await W(3500); console.log('ch4', await ok());
await go('5');
await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="1"]'); e && e.click(); }); await W(200);
await p.evaluate(() => { const e = document.querySelector('#quest [data-pred="1"]'); e && e.click(); }); await W(200);
await set('throttle',1); await W(9000);
for (let k = 0; k < 24 && !(await p.$('#quest [data-conf]')); k++) { await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="1"]'); e && e.click(); }); await W(250); }
await p.evaluate(() => { const e = document.querySelector('#quest [data-conf="0"]'); e && e.click(); }); await W(200);
await set('cold',true); await W(800); await set('cold',false); await set('throttle',0.2); await W(1500);
// eco — как в подсказке: на винте 5″ больше ≈7,4 г/Вт не выйти, нужен 7×4×3 на ~15 % газа (≈184 г, ≈10 г/Вт). Раньше звезда
// ловилась только всплеском показаний при сбросе газа и в CI не ловилась.
await set('prop','7x4x3'); await W(800); await set('throttle',0.15); await W(1500); console.log('ch5', await ok());
await go('6');
{ const q6 = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 60 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q6('[data-qi="0"]'); await W(150); await q6('[data-pred="1"]'); await W(200); await set('config','3S2P'); await waitConf(); await q6('[data-conf="0"]'); await W(200);
  await q6('[data-qi="1"]'); await W(150); await q6('[data-pred="1"]'); await W(200); await seg('mode','charge'); await waitConf(); await q6('[data-conf="1"]'); await W(200);
  await q6('[data-qi="2"]'); await W(150); await q6('[data-pred="1"]'); await W(200); await set('cold',true); await set('load',80); await waitConf(); await q6('[data-conf="0"]'); await W(200);
  await q6('[data-qi="3"]'); await W(150); await q6('[data-pred="1"]'); await W(200); await seg('mode','storage'); for (let k = 0; k < 60 && (await p.evaluate(()=>document.querySelectorAll('#missions li.ok').length)) < 4; k++) await W(250); }
console.log('ch6', await ok());
await go('9');
await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="2"]'); e && e.click(); }); await W(150);
await p.evaluate(() => { const e = document.querySelector('#quest [data-pred="1"]'); e && e.click(); }); await W(150);
await set('hill',14); await W(600); await set('txH',15); await set('rxH',15); await set('hill',8); await W(600); await set('pol','cross'); await set('hill',14); await W(600); await set('pol','same'); await seg('freq','915'); await W(600); await set('power',25); await set('pol','cross'); await seg('freq','5800'); await W(800);
await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="2"]'); e && e.click(); }); await W(200);
for (let k = 0; k < 20 && !(await p.$('#quest [data-conf]')); k++) await W(200);
await p.evaluate(() => { const e = document.querySelector('#quest [data-conf="1"]'); e && e.click(); }); await W(200);
console.log('ch9', await ok());
await go('16');
await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="1"]'); e && e.click(); }); await W(150);
await p.evaluate(() => { const e = document.querySelector('#quest [data-pred="1"]'); e && e.click(); }); await W(150);
await set('link',false); await W(2500); await set('link',true); await W(600); await set('profile','climb'); await set('link',false); await W(800); await set('link',true); await seg('rx','fspos'); await W(300); await set('link',false); await W(2500);
await p.evaluate(() => { const e = document.querySelector('#quest [data-qi="1"]'); e && e.click(); }); await W(200);
for (let k = 0; k < 20 && !(await p.$('#quest [data-conf]')); k++) await W(200);
await p.evaluate(() => { const e = document.querySelector('#quest [data-conf="1"]'); e && e.click(); }); await W(200);
console.log('ch16', await ok());
await go('10');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('rxReg','2G4'); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('txV','4'); await W(400); await seg('rxV','4'); await W(600);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('bfOrd','AETR'); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('mm',true); await waitConf(); await q('[data-conf="0"]'); await W(300); }
console.log('ch10', await ok());
await go('11');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('noise',6); await waitConf(); await q('[data-conf="1"]'); await W(200);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('d',15); await waitConf(); await q('[data-conf="1"]'); await W(200);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('rate','25'); await set('d',32); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('rate','D50'); await W(600);
  await q('[data-qi="4"]'); await W(150); await q('[data-pred="0"]'); await W(200); await seg('rate','500'); await set('d',20); await W(800); }
console.log('ch11', await ok());
await go('12');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('d',1.05); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('d',1.4); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('cam','0.001'); await W(600);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('friend',true); await waitConf(); await q('[data-conf="0"]'); await W(300); }
console.log('ch12', await ok());
await go('8');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('len',8.2); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('f','5800'); await set('len',1.3); await W(600);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('ang',88); await W(600);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('circ',true); await waitConf(); await q('[data-conf="0"]'); await W(300); }
console.log('ch8', await ok());
await go('13');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('jamKm',0.2); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('jamKm',5.2); await W(600);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="0"]'); await W(200); await set('fhss',true); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="0"]'); await W(200); await set('drH',40); await W(300); await set('relay',true); await W(600); }
console.log('ch13', await ok());
await go('7');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('pack','6s6000'); await seg('style','calm'); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('pack','6s6000x2'); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('style','max'); await W(600);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('pack','6s6000'); await seg('style','max'); await W(600); }
console.log('ch7', await ok());
await go('14');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('wG','G'); await set('w5','5V'); await set('wTX','R1'); await set('wRX','T1'); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('port','2'); await W(600);
  await q('[data-qi="2"]'); await W(150); await seg('pick','1'); await W(400); const fb = await p.evaluate(()=>(document.querySelector('#quest')||{}).textContent.includes('перемычка')); await seg('pick','3'); await W(500); console.log('ch14 feedback', fb);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('power',true); await W(500); const sm = await p.evaluate(()=>document.querySelectorAll('#fig .bn-smoke').length); console.log('ch14 smoke без подготовки', sm);
  await set('power',false); await set('beep',true); await set('ant',true); await set('stop',true); await set('props',false); await W(300); await set('power',true); await W(800); }
console.log('ch14', await ok());
await go('15');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const waitConf = async () => { for (let k = 0; k < 40 && !(await p.evaluate(()=>!!document.querySelector('#quest [data-conf]'))); k++) await W(250); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('backup',true); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="0"]'); await W(200); await seg('uart','2'); await seg('prov','CRSF'); await W(600);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('map','AETR'); await seg('arm','AUX1'); await set('tilt',false); await set('acc',true); await seg('proto','DSHOT600'); await set('armSw',true); await waitConf(); await q('[data-conf="0"]'); await W(200);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('proto','DSHOT600'); await set('props',false); await set('batt',true); await set('mtest',true); await W(700); }
console.log('ch15', await ok());
await go('2');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  // Стики: держим палец на кружке; fx, fy — доли от центра (−1…1), вверх = +1.
  const hold = async (i, fx, fy) => { const g = await p.evaluate((i)=>{const el=document.querySelectorAll('#side .ctl-pads svg')[i];el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const kn=el.querySelector('.st-knob').getBoundingClientRect();return {r:{x:r.x,y:r.y,w:r.width,h:r.height},k:{x:kn.x+kn.width/2,y:kn.y+kn.height/2}};}, i); await p.mouse.move(g.k.x, g.k.y); await p.mouse.down(); await p.mouse.move(g.r.x+g.r.w/2+fx*g.r.w*0.42, g.r.y+g.r.h/2-fy*g.r.h*0.42, {steps:4}); };
  const release = async () => { await p.mouse.up(); };
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(300); await hold(0, 0, 0.35); await release(); await W(2500);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="0"]'); await W(300); await hold(0, 0, 0.3); await release(); await W(1500); await hold(0, 1, 0.3); await W(3500); await release(); await W(500);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="0"]'); await W(300); await hold(0, 0, 0.4); await release(); await W(1500);
  for (let k = 0; k < 24 && !(await p.evaluate(()=>[...document.querySelectorAll('#missions li')].some(li=>li.dataset.m==='flag'&&li.classList.contains('ok')))); k++) {
    const [x, y, yaw] = (await p.evaluate(()=>document.querySelector('#fig [data-part="drone"]').dataset.pos)).split(' ').map(Number);
    const dx = 290 - x, dy = 80 - y; const f = Math.cos(yaw)*dx + Math.sin(yaw)*dy, r = -Math.sin(yaw)*dx + Math.cos(yaw)*dy; const n = Math.hypot(f, r) || 1; const g = Math.min(1, n / 90);
    await hold(1, Math.max(-1, Math.min(1, g*r/n)), Math.max(-1, Math.min(1, g*f/n))); await W(300); await release(); await W(150);
  }
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(300); await set('wrong',true); await W(300); await hold(0, 0, 0.2); await release(); await W(800); }
console.log('ch2', await ok());
await go('0');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('R',6); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="0"]'); await W(200); await set('V',24); await set('R',4); await W(600);
  await q('[data-qi="2"]'); await W(150); await q('[data-pred="0"]'); await W(200); await set('V',10); await set('R',24); await W(600);
  await q('[data-qi="3"]'); await W(150); await seg('q1','240'); await W(400); const fb = await p.evaluate(()=>(document.querySelector('#quest')||{}).textContent.includes('Не так')); console.log('ch0 feedback', fb); await seg('q1','2400'); await seg('q2','6'); await seg('q3','0.025'); await W(600); }
console.log('ch0', await ok());
await go('18');
{ for (const [d, dec] of [[1,'nogo'],[2,'go'],[3,'nogo'],[4,'nogo'],[5,'nogo']]) { await set('day', d); await W(250); await seg('dec', dec); await W(400); }
  await p.evaluate(()=>{const e=document.querySelector('#quest [data-qi="3"]'); e&&e.click();}); await W(200); await set('e1','a'); await W(200); await set('e2','b'); await W(400); const fb = await p.evaluate(()=>(document.querySelector('#quest')||{}).textContent.includes('не так')); console.log('ch18 feedback', fb); await set('e2','a'); await W(500); }
console.log('ch18', await ok());
await go('17');
{ const board = () => p.evaluate(()=>document.querySelector('#fig [data-part="board"]').textContent);
  const CAUSES = { arm: ['wire','port','mm','acc'], flip: ['prop','dir','orient'], cam: ['vid','pwr','dead'], ant: ['sma','pit','pol'], sticks: ['map','rev'], lowv: ['cold','old','cells','weak'] };
  // Сначала «по уликам»: дело «Стики» — одна проверка решает.
  await seg('case','sticks'); await W(300); await set('chk','sticks:0'); await W(400);
  const bt = await board(); await set('verdict', bt.includes('газа') ? 'sticks:map' : 'sticks:rev'); await W(400);
  for (const c of ['arm','flip','cam','ant','lowv']) {
    await seg('case', c); await W(300); await set('chk', c + ':0'); await W(300);
    for (const v of CAUSES[c]) { await set('verdict', c + ':' + v); await W(300); if ((await board()).includes('РАСКРЫТО')) break; }
  }
  await W(400); }
console.log('ch17', await ok());
// Гл. 17, вкладка «Бинд есть — арма нет»: разбор через панель шагов.
await p.evaluate(()=>document.querySelector('[data-figtab="armcase"]').click()); await W(900);
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  const act = async (a) => { await p.evaluate((a)=>{const b=document.querySelector(`.fig-proc [data-fig-act="${a}"]`); b&&b.click();}, a); await W(160); };
  const run = async (answers) => { await act('start'); for (const a of answers) await act('i:' + a); await act('f:0'); await act('arm'); await W(400); };
  await q('[data-qi="0"]'); await W(200); await q('[data-pred="1"]'); await W(200); await run(['ok','ok','here']);
  await q('[data-qi="1"]'); await W(200); await q('[data-pred="1"]'); await W(200); await run(['ok','ok','ok','clue','here']);
  await q('[data-qi="2"]'); await W(200); await q('[data-pred="1"]'); await W(200); await run(['ok','ok','ok','ok','ok','ok','here']);
  await q('[data-qi="3"]'); await W(200); await q('[data-pred="1"]'); await W(200); await run(['ok','ok','ok','ok','ok','ok','here']); }
console.log('ch17b', await ok());
await go('19');
{ const q = (sel) => p.evaluate((sel)=>{const e=document.querySelector('#quest '+sel); if(e) e.click(); return !!e;}, sel);
  await q('[data-qi="0"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('sc','50000'); await set('cm',2); await W(600);
  await q('[data-qi="1"]'); await W(150); await q('[data-pred="1"]'); await W(200); await seg('sc','25000'); await set('cm',4); await W(600);
  await q('[data-qi="2"]'); await W(150); await seg('guess','S'); await W(500); const fb = await p.evaluate(()=>(document.querySelector('#quest')||{}).textContent.includes('Нет:')); console.log('ch19 feedback', fb); await seg('guess','N'); await W(600);
  await q('[data-qi="3"]'); await W(150); await q('[data-pred="1"]'); await W(200); await set('h',500); await W(600); }
console.log('ch19', await ok());
console.log('ERR', errs.length, errs.slice(0,5));
await b.close();
