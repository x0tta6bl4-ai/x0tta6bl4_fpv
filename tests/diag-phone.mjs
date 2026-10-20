// Диагностика: что лежит под пальцем на месте ручки стика (гл. 1, телефон 360×780).
// Нужна, когда phone.mjs падает только в CI: печатает раскладку, а не PASS/FAIL. Запуск: node tests/diag-phone.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = pathToFileURL(resolve(ROOT, "dist/dev.html")).href;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(U + "#1");
await p.waitForTimeout(1200);
const snap = (tag) =>
  p.evaluate((tag) => {
    const k = [...document.querySelectorAll(".ctl-sticks .st-knob")].map((e) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
    });
    const at = k.map(([x, y]) => {
      const e = document.elementFromPoint(x, y);
      return e ? `${e.tagName}.${e.className.baseVal ?? e.className}`.slice(0, 50) : null;
    });
    const vv = visualViewport;
    const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
    return { tag, scrollY: Math.round(scrollY), iw: innerWidth, sw: document.documentElement.scrollWidth, vv: [Math.round(vv.offsetTop), Math.round(vv.offsetLeft), vv.scale, Math.round(vv.width)], knobs: k, at, fig: R("#fig"), stage: R("#fig .iso-stage"), pads: R(".ctl-sticks .ctl-pads"), quest: R("#quest"), status: R(".fig-status") };
  }, tag);
const out = [];
out.push(await snap("загрузка"));
await p.evaluate(() => document.querySelector("#fig").scrollIntoView({ block: "start" }));
await p.waitForTimeout(500);
out.push(await snap("после scrollIntoView"));
await p.screenshot({ path: `${ROOT}/tests/out/diag-360.png` });
out.push(await snap("после скриншота"));
await p.waitForTimeout(1500);
out.push(await snap("через 1.5 с"));
for (const o of out) console.log(JSON.stringify(o));
await b.close();
