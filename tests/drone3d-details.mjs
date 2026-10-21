// Дополнительная приёмка новой геометрии и управления; существующие задания проверяет drone3d.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildDroneParts, MODEL_SPEC, MOTOR_POSITIONS } from "../src/labs/drone-model.mjs";
const ROOT=fileURLToPath(new URL("..",import.meta.url));
const parts=buildDroneParts(), ids=new Set(parts.map(p=>p.id));
assert.equal(ids.size,15);
let triangles=0;
for(const p of parts){
  assert(p.mesh.p.every(Number.isFinite),p.id+": вершины конечны");
  assert.equal(p.mesh.p.length,p.mesh.n.length);
  assert(p.mesh.i.every(i=>Number.isInteger(i)&&i>=0&&i<p.mesh.p.length/3));
  assert(p.mesh.p.length/3<65536,"WebGL1 без расширения Uint32");
  triangles+=p.mesh.i.length/3;
}
assert(triangles<30000,"бюджет геометрии для телефона");
const [fl,rr]=[MOTOR_POSITIONS.fl,MOTOR_POSITIONS.rr];
assert(Math.abs(Math.hypot(fl[0]-rr[0],fl[1]-rr[1])-MODEL_SPEC.diagonal)<1e-8);
for(const p of parts.filter(p=>p.spin)){
  const radius=Math.max(...p.mesh.p.filter((_,i)=>i%3===0).map((x,i)=>Math.hypot(x,p.mesh.p[i*3+2])));
  assert(radius>6.2&&radius<6.5,"5-дюймовый винт: радиус около 6,35 см");
}
console.log(`PASS геометрия: 15 компонентов, ${triangles} треугольников, размеры и индексы допустимы`);
const browser=await chromium.launch({args:["--no-sandbox"]});
const url=(process.argv[2]||pathToFileURL(resolve(ROOT,"dist/dev.html")).href)+"#3";
mkdirSync(resolve(ROOT,"tests/out"),{recursive:true});
const errors=[];
try {
 for(const width of [360,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:width===1280?900:844},hasTouch:width<500,isMobile:width<500,colorScheme:width===1280?"dark":"light"});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url);await page.locator('[data-figtab="lab:drone3d"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#labroot')?.__d3);
  const canvas=page.locator('.d3-canvas'),slider=page.getByRole('slider',{name:'Степень разборки'});
  await canvas.scrollIntoViewIfNeeded();await canvas.focus();
  const before=await page.evaluate(()=>({yaw:+document.querySelector('#labroot').dataset.yaw,y:scrollY}));
  await canvas.press('ArrowRight');await page.waitForTimeout(150);
  const after=await page.evaluate(()=>({yaw:+document.querySelector('#labroot').dataset.yaw,y:scrollY}));
  assert(Math.abs(after.yaw-before.yaw)>.1&&Math.abs(after.y-before.y)<2,'клавиатура крутит модель без прокрутки');
  await slider.focus();await slider.press('Home');for(let i=0;i<3;i++)await slider.press('ArrowRight');
  await page.locator('[data-part="fc"]').click();await page.waitForTimeout(250);
  assert(!/1\s*\/\s*4/.test(await page.locator('#labscore').innerText()),'частичная разборка не закрывает задание стека');
  await slider.focus();await slider.press('End');await page.waitForTimeout(1000);
  assert(/1\s*\/\s*4/.test(await page.locator('#labscore').innerText()),'полная разборка с выбранным FC закрывает задание');
  const radius=await page.evaluate(()=>document.querySelector('#labroot').__d3.viewer.view.radius);
  await page.locator('.d3-bar [data-act="focus"]').click();await page.waitForTimeout(900);
  const focused=await page.evaluate(()=>({r:document.querySelector('#labroot').__d3.viewer.view.radius,f:document.querySelector('#labroot').dataset.focused}));
  assert(focused.f==='true'&&focused.r<radius*.5,'приближение действительно меняет камеру');
  assert(await page.locator('.d3-marker').isVisible(),'подпись выбранной детали видима');
  await page.locator('[data-view="home"]').click();await page.waitForTimeout(1000);
  for(const b of await page.locator('.d3-bar button,.d3-parts button').all()){
   const r=await b.boundingBox();if(r)assert(r.width>=43.5&&r.height>=43.5,'органы управления не меньше 44px');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'нет горизонтального переполнения');
  await canvas.screenshot({path:resolve(ROOT,`tests/out/drone3d-detail-${width}.png`)});
  console.log(`PASS ${width}: клавиатура, разборка, зачёт, фокус, подпись и размеры кнопок`);
  await context.close();
 }
 // Отсутствие WebGL не должно оставлять мёртвый каталог деталей.
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('[data-figtab="lab:drone3d"]').click();
 await page.locator('[data-part="fc"]').click();
 assert(/Полётный контроллер/.test(await page.locator('.d3-info').innerText()));
 assert(!await page.locator('.d3-bar').isVisible());
 assert(!/1\s*\/\s*4/.test(await page.locator('#labscore').innerText()),'описание без 3D не подменяет задание');
 await context.close();
 assert.deepEqual(errors,[]);console.log('PASS режим без WebGL: описания работают, ложного зачёта нет');
} finally {await browser.close();}
