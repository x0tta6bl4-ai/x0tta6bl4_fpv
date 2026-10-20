import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const only0 = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const only = only0.length ? only0 : ["20"]; // номера глав с плоской лабой; сейчас она одна — гл. 20 (карточки)
const b = await chromium.launch({args:['--no-sandbox']});
const p = await b.newPage({ viewport:{width:1280,height:900}});
const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(DEV); await p.waitForTimeout(600);
await p.evaluate(()=>{ try{localStorage.clear()}catch(e){} });
const W = (ms) => p.waitForTimeout(ms);
const R = '#labroot';
const ok = () => p.evaluate(()=>[...document.querySelectorAll('#missions li')].map(li=>(li.classList.contains('ok')?'★':'☆')+li.dataset.m).join(' '));
const go = async (h) => { await p.evaluate(h=>location.hash=h, h); await W(500); await p.evaluate(()=>document.querySelector('#labroot').scrollIntoView({block:'start'})); await W(300); };
const slider = (label, v) => p.evaluate(([label,v])=>{ const w=[...document.querySelectorAll('#labroot .lab-slider')].find(x=>x.textContent.includes(label)); if(!w) throw new Error('no slider '+label); const i=w.querySelector('input'); i.value=v; i.dispatchEvent(new Event('input',{bubbles:true})); }, [label,v]);
const pick = (group, text) => p.evaluate(([group,text])=>{ const g=[...document.querySelectorAll('#labroot .lab-choice')].find(x=>x.querySelector('b')&&x.querySelector('b').textContent.includes(group)); if(!g) throw new Error('no choice '+group); const bt=[...g.querySelectorAll('button')].find(x=>x.textContent.trim()===text); if(!bt) throw new Error('no option '+text); bt.click(); }, [group,text]);
const tog = (label, v) => p.evaluate(([label,v])=>{ const w=[...document.querySelectorAll('#labroot .lab-toggle')].find(x=>x.textContent.includes(label)); if(!w) throw new Error('no toggle '+label); const i=w.querySelector('input'); if(i.checked!==v) i.click(); }, [label,v]);
const btn = (text) => p.evaluate((text)=>{ const bt=[...document.querySelectorAll('#labroot button')].find(x=>x.textContent.includes(text) && !x.disabled); if(!bt) throw new Error('no button '+text); bt.click(); }, text);
// перевод координат viewBox → экран
const pt = (svgSel, x, y) => p.evaluate(([s,x,y])=>{ const svg=document.querySelector(s); const r=svg.getBoundingClientRect(); const vb=svg.viewBox.baseVal; return [r.left+(x-vb.x)/vb.width*r.width, r.top+(y-vb.y)/vb.height*r.height]; }, [svgSel,x,y]);
const dragSvg = async (svgSel, from, to, hold=0) => { const a=await pt(svgSel,...from), c=await pt(svgSel,...to); await p.mouse.move(...a); await p.mouse.down(); for (let i=1;i<=8;i++) await p.mouse.move(a[0]+(c[0]-a[0])*i/8, a[1]+(c[1]-a[1])*i/8); if (hold) await W(hold); await p.mouse.up(); await W(150); };
const stickHold = async (idx, x, y, ms) => { const s=`#labroot .lab-stick:nth-of-type(${idx}) svg`; const sel = await p.evaluate((i)=>{ const all=[...document.querySelectorAll('#labroot .lab-stick svg')]; all.forEach((e,k)=>e.dataset.si=k); return `[data-si="${i}"]`; }, idx); const a=await pt(sel,0,0), c=await pt(sel,x*42,-y*42); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, {steps:6}); await W(ms); await p.mouse.up(); await W(100); };
const res = {};
const run = async (id, fn) => { if (only.length && !only.includes(id)) return; await go(id); try { await fn(); } catch (e) { res[id]='ERR '+e.message; } await W(400); res[id] = (res[id]||'') + ' ' + await ok(); console.log(id.padEnd(3), res[id]); };

await run('0', async () => {
  console.log('   start', await ok());
  await slider('бака', 12); await slider('трубы', 6); await W(300);
  await slider('бака', 24); await slider('трубы', 8); await W(300);
  await slider('бака', 10); await slider('трубы', 24); await W(300);
  for (let k=0;k<4;k++){ await p.evaluate(()=>document.querySelector('#quiz button[data-i="0"]').click()); await W(700); }
});
await run('2', async () => {
  await stickHold(0, 0, 1, 1500); // газ вверх (ось Y без пружины)
  await stickHold(0, 1, 1, 2500); // поворот, газ держим
  await stickHold(1, 0.6, 0.8, 1800);
  for (let k=0;k<16 && !(await ok()).includes('★flag');k++){ const st=await p.evaluate(()=>{const g=document.querySelector('#drone g'); return g.getAttribute('transform');}); const m=st.match(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/); const [x,y,rot]=m.slice(1).map(Number); const yaw=(rot-90)*Math.PI/180; const dx=290-x, dy=80-y; // в систему дрона
    const f = Math.cos(yaw)*dx+Math.sin(yaw)*dy, r = -Math.sin(yaw)*dx+Math.cos(yaw)*dy; const n=Math.hypot(f,r)||1; const g=Math.min(1, n/90); await stickHold(1, Math.max(-1,Math.min(1,g*r/n)), Math.max(-1,Math.min(1,g*f/n)), 300); }
  await tog('Неправильный винт', true); await stickHold(0, 0, -1, 300); await btn('Сброс'); await W(300); await stickHold(0, 0, 1, 2500);
});
await run('7', async () => {
  console.log('   start', await ok());
  await pick('Батарея','6S 6000 мА·ч 15C'); await pick('Как летим','плавно'); await W(300);
  await pick('Батарея','2 × 6S 6000 параллельно'); await W(300);
  await pick('Батарея','6S 1300 мА·ч 100C'); await pick('Как летим','максимум'); await W(300);
  await pick('Батарея','6S 6000 мА·ч 15C'); await W(300);
});
await run('8', async () => {
  console.log('   start', await ok());
  await slider('Длина', 8.2); await W(300); await pick('Частота','5,8 ГГц'); await slider('Длина', 1.3); await W(300);
  await slider('Поворот', 90); await W(300); await tog('Круговая', true); await W(300);
});
await run('10', async () => {
  console.log('   start', await ok());
  await p.evaluate(()=>{ const g=document.querySelectorAll('#crx .lab-choice')[2]; [...g.querySelectorAll('button')].find(x=>x.textContent.includes('2,4')).click(); }); await W(300);
  await p.evaluate(()=>{ for (const id of ['#ctx','#crx']) [...document.querySelectorAll(id+' .lab-choice')[1].querySelectorAll('button')].find(x=>x.textContent==='4.0').click(); }); await W(300);
  await pick('Порядок каналов в Betaflight','TAER'); await stickHold(1, 0.9, 0, 600); await pick('Порядок каналов в Betaflight','AETR'); await W(300);
  await tog('Model Match', true); await W(400);
});
await run('11', async () => {
  console.log('   start', await ok());
  await slider('Расстояние', 1); await slider('Помехи', 5); await W(400);
  await slider('Помехи', 0); await slider('Расстояние', 30); await W(400);
  await slider('Расстояние', 5); await slider('Помехи', 7); await pick('Packet rate','D50'); await W(400);
  await slider('Помехи', 0); await pick('Packet rate','500 Гц (2,4 ГГц)'); await slider('Расстояние', 40); await W(400);
});
await run('12', async () => {
  console.log('   start', await ok());
  await slider('Расстояние', 1.1); await W(300); await slider('Расстояние', 1.3); await W(300); await slider('Расстояние', 0.3);
  await pick('Освещение','поздние сумерки (0,05 лк)'); await pick('Камера','камера 0,001 лк'); await W(300); await tog('Друг', true); await W(300);
});
await run('13', async () => {
  console.log('   start', await ok());
  const S='#labroot svg';
  await dragSvg(S,[150,40],[45,180]); await W(400);
  await dragSvg(S,[45,180],[270,95]); await W(400);
  await tog('ППРЧ', true); await dragSvg(S,[270,95],[270,110]); await W(400);
  await tog('ППРЧ', false); await dragSvg(S,[270,110],[100,40]); await dragSvg(S,[300,70],[262,185]); await W(300); await tog('Ретранслятор', true); await W(400);
});
await run('14', async () => {
  const c = (sel)=>p.evaluate((sel)=>document.querySelector('#labroot '+sel).dispatchEvent(new MouseEvent('click',{bubbles:true})), sel);
  for (const [r,f] of [['G','G'],['5V','5V'],['TX','R2'],['RX','T2']]) { await c(`[data-rx="${r}"]`); await c(`[data-fc="${f}"]`); }
  await btn('Проверить пайку'); await W(300); await p.evaluate(()=>document.querySelector('#uart [data-u="2"]').click());
  await p.evaluate(()=>document.querySelector('[data-j="cold"]').click());
  await p.evaluate(()=>{ for (const cb of document.querySelectorAll('[data-c]')) { const i=+cb.dataset.c; if (i<4) cb.click(); } document.querySelector('[data-go]').click(); });
});
await run('15', async () => {
  const tab=(t)=>p.evaluate((t)=>document.querySelector(`[data-tab="${t}"]`).click(), t);
  const sel=(k,v)=>p.evaluate(([k,v])=>{ const s=document.querySelector(`#labroot select[data-k="${k}"]`); s.value=v; s.dispatchEvent(new Event('change',{bubbles:true})); }, [k,v]);
  await btn('diff all'); await btn('Сохранить в файл');
  await tab('ports'); await p.evaluate(()=>document.querySelector('[data-uart="2"]').click());
  await tab('rx'); await sel('prov','CRSF'); await sel('map','AETR');
  await tab('modes'); await sel('arm','AUX1');
  await tab('setup'); await p.evaluate(()=>document.querySelector('[data-k="tilt"]').click()); await btn('Калибровать'); await tab('cfg'); await sel('angle','180');
  await tab('motors'); await sel('proto','DSHOT600'); await p.evaluate(()=>{ document.querySelector('[data-k="props"]').click(); document.querySelector('[data-k="batt"]').click(); }); await btn('Тест моторов');
  await btn('Тумблер ARM'); await W(300); console.log('   ', await p.evaluate(()=>document.querySelector('#labroot .lab-read').textContent.slice(0,90)));
});
await run('17', async () => {
  const solveWith = async (cid, checks, decide) => { await p.evaluate((c)=>document.querySelector(`[data-case="${c}"]`).click(), cid); const out=[]; for (const i of checks) { await p.evaluate((i)=>document.querySelector(`[data-check="${i}"]`).click(), i); out.push(await p.evaluate((i)=>document.querySelectorAll('.det-clue b')[document.querySelectorAll('.det-clue b').length-1].textContent, i)); } const v=decide(out); await p.evaluate((v)=>document.querySelector(`[data-v="${v}"]`).click(), v); await W(200); console.log('    ', cid, JSON.stringify(out), v, await p.evaluate(()=>document.querySelector('#labroot .lab-read').textContent.slice(0,50))); };
  await solveWith('sticks',[0], o=>o[0].includes('газа')?'map':'rev');
  await solveWith('flip',[0,1], o=>o[0].includes('по часовой')?'dir':o[1].includes('другого')?'prop':'orient');
  await solveWith('ant',[0,1], o=>o[0].includes('без штырька')?'sma':o[1].includes('ON')?'pit':'pol');
  await solveWith('cam',[0,1], o=>o[0]==='0 В'?'pwr':o[1].includes('оторван')?'vid':'dead');
  await solveWith('lowv',[0,1,3], o=>o[0].includes('+2 ')?'cold':o[1].includes('делит')?'cells':o[1].includes('одна 4,05')?'old':'weak');
  await solveWith('arm',[0,1,2], o=>o[0].includes('NO_ACC')?'acc':o[1].includes('трижды')?'mm':o[2].includes('UART1')?'port':'wire');
});
await run('18', async () => {
  const OKS = ['зона свободна, наблюдатель на месте','есть место для взлёта, посадки и запасное','ветер слабый, без осадков','все чек-листы пройдены','полёт здесь разрешён','выспался, спокоен'];
  for (let k=0;k<70;k++){ const texts=await p.evaluate(()=>[...document.querySelectorAll('.gng-f span')].map(s=>s.textContent)); const go=texts.every(t=>OKS.includes(t)); await p.evaluate((g)=>document.querySelector(`[data-go="${g?1:0}"]`).click(), go); await W(1500); const st=await ok(); if (!st.includes('☆streak')&&!st.includes('☆allok')&&!st.includes('☆unknown')) break; }
  for (let k=0;k<2;k++){ await p.evaluate(()=>document.querySelector('#em [data-e="0"]').click()); await W(900); }
});
await run('19', async () => {
  console.log('   start', await ok());
  const S='#mapsvg';
  await dragSvg(S,[124,160],[142,160]); await W(300);
  await pick('Масштаб','1:25 000'); await dragSvg(S,[142,160],[214,160]); await W(300);
  await p.evaluate(()=>document.querySelector('[data-side="N"]').dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await slider('Высота', 500); await W(300);
});
await run('20', async () => {
  const flip=()=>p.evaluate(()=>document.querySelector('[data-flip]').click());
  const ans=(k)=>p.evaluate((k)=>document.querySelector(`[data-k="${k}"]`).click(), k);
  await flip(); await ans(0);
  for (let k=0;k<40;k++){ await flip(); await ans(1); }
});
console.log('ERRORS', errs.length, errs.slice(0,5));
await b.close();
