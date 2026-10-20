import { chromium } from 'playwright';
import { pathToFileURL as __toUrl } from "node:url";
import { resolve as __res, dirname as __dir } from "node:path";
import { fileURLToPath as __fp } from "node:url";
// По умолчанию тест открывает dist/dev.html этого репозитория (npm run build:dev); можно передать свой адрес первым аргументом.
const ROOT = __res(__dir(__fp(import.meta.url)), "..");
const DEV = process.argv[2] && !/^\d/.test(process.argv[2]) ? process.argv[2] : __toUrl(__res(ROOT, "dist/dev.html")).href;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport:{width:1280,height:900} })).newPage();
const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto(DEV + '#17'); await p.waitForTimeout(1200); await p.click('[data-figtab="armcase"]'); await p.waitForTimeout(1200);
const M = await import(__toUrl(__res(ROOT, 'src/figs/armcase.mjs')).href);
const EXPECT = { ok: 'ok', hint: 'clue', bad: 'here' };
const act = async (a) => { const ok = await p.evaluate((a)=>{ const b=document.querySelector(`.fig-proc [data-fig-act="${a}"]`); if(!b) return false; b.click(); return true; }, a); await p.waitForTimeout(120); return ok; };
const panel = () => p.evaluate(()=>document.querySelector('.fig-proc').textContent);
let bad = 0;
for (let d = 1; d <= 30; d++) {
  const c = M.causeOf(d), at = M.STEPS.findIndex(s => s.id === M.CAUSES[c].at);
  if (!(await act('start'))) { console.log(d, 'нет кнопки «Начать»'); bad++; break; }
  for (let i = 0; i <= at; i++) {
    const [tone] = M.evidence(M.STEPS[i].id, c);
    const right = EXPECT[tone], wrong = right === 'ok' ? 'here' : 'ok';
    if (d <= 3) { await act('i:' + wrong); const t = await panel(); if (!/✗/.test(t)) { console.log(d, 'нет объяснения ошибки на шаге', i); bad++; } }
    if (!(await act('i:' + right))) { console.log(d, c, 'нет кнопки вывода на шаге', i); bad++; }
  }
  if (d <= 3) { await act('f:1'); if (!/✗/.test(await panel())) { console.log(d, 'нет объяснения неверного исправления'); bad++; } }
  await act('f:0'); await act('arm');
  const t = await panel(); const ro = await p.evaluate(()=>document.querySelector('[data-readout]').textContent);
  const ok = /Дело закрыто|не поломка/.test(t) && /ARMED/.test(ro);
  if (!ok) bad++;
  console.log(String(d).padStart(2), c.padEnd(8), ok ? 'OK ' : 'ERR', ro.slice(0, 60));
  await act('next'); await p.waitForTimeout(150);
}
console.log('stars', await p.$eval('#stars', e=>e.textContent), 'ERR', bad, errs); await b.close();
