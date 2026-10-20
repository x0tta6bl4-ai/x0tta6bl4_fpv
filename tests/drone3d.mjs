// Гл. 3, вкладка «3D: дрон целиком»: модель крутится пальцем (страница стоит), касание детали на модели выбирает её,
// все 4 задания проходятся как ученик, щипок/колесо меняют масштаб, тёмная тема и смена темы без ошибок.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href) + "#3";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const errs = [], res = [];
const rep = (tag, item, ok, info = "") => { res.push(ok); console.log(`${tag} ${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const W = (p, ms) => p.waitForTimeout(ms);

// Телефон: касания через CDP, как настоящий палец.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(U); await W(p, 800);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 3, radiusY: 3, force: 1 })) });
  const tapAt = async ([x, y]) => { await touch("touchStart", [[x, y]]); await W(p, 60); await touch("touchEnd", []); await W(p, 350); };
  const D = () => p.evaluate(() => ({ ...document.querySelector("#labroot").dataset, score: document.querySelector("#labscore")?.textContent || "" }));
  const at = (id) => p.evaluate((id) => document.querySelector("#labroot").__d3.at(id), id);
  await p.click('[data-figtab="lab:drone3d"]'); await W(p, 700);
  const has = await p.evaluate(() => ({ canvas: !!document.querySelector(".d3-canvas"), d3: !!(document.querySelector("#labroot") || {}).__d3 }));
  rep("390", "вкладка 3D открывается, WebGL работает", has.canvas && has.d3, JSON.stringify(has));
  await p.evaluate(() => document.querySelector(".d3-stage").scrollIntoView({ block: "start" })); await W(p, 400);
  // 1. Вращение пальцем, страница не прокручивается
  const box = await p.evaluate(() => { const r = document.querySelector(".d3-canvas").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  const d0 = await D(), y0 = await p.evaluate(() => scrollY);
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] * 0.8;
  await touch("touchStart", [[cx, cy]]);
  for (let i = 1; i <= 10; i++) { await touch("touchMove", [[cx + i * 12, cy - i * 6]]); await W(p, 16); }
  await touch("touchEnd", []); await W(p, 300);
  const d1 = await D(), y1 = await p.evaluate(() => scrollY);
  rep("390", "палец крутит модель, страница стоит", Math.abs(d1.yaw - d0.yaw) > 0.2 && Math.abs(d1.pitch - d0.pitch) > 0.05 && Math.abs(y1 - y0) < 2, `yaw ${d0.yaw}→${d1.yaw}, pitch ${d0.pitch}→${d1.pitch}, scrollY ${y0}→${y1}`);
  // 2. Щипок двумя пальцами
  const z0 = (await D()).zoom;
  await touch("touchStart", [[cx - 30, cy - 60], [cx + 30, cy - 60]]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [[cx - 30 - i * 10, cy - 60], [cx + 30 + i * 10, cy - 60]]); await W(p, 16); }
  await touch("touchEnd", []); await W(p, 300);
  const z1 = (await D()).zoom;
  rep("390", "щипок приближает", Number(z1) < Number(z0) * 0.8, `zoom ${z0}→${z1}`);
  await p.click('[data-view="home"]'); await W(p, 900);
  // 3. Задание «stack»: разобрать и коснуться полётника на модели
  await p.click('[data-act="explode"]'); await W(p, 1200);
  await tapAt(await at("fc"));
  let d = await D();
  rep("390", "касание полётника на разобранной модели выбирает его", d.sel === "fc", `sel ${d.sel}, exploded ${d.exploded}`);
  const info = await p.$eval(".d3-info", (e) => e.textContent);
  rep("390", "описание детали — из того же текста, что у плоской схемы", /Полётный контроллер/.test(info) && /IMU/.test(info), info.slice(0, 60));
  // 4. Задание «cw»: два винта по часовой (диагональ) — касанием на модели
  await p.click('[data-act="explode"]'); await W(p, 1200);
  await p.click('[data-view="top"]'); await W(p, 900);
  await tapAt(await at("prop_fl")); const s1 = (await D()).sel;
  await tapAt(await at("prop_rr")); const s2 = (await D()).sel;
  rep("390", "касание винтов на модели (вид сверху)", s1 === "prop_fl" && s2 === "prop_rr", `${s1}, ${s2}`);
  const sp0 = await p.evaluate(() => document.querySelector("#labroot").__d3.angle("prop_rr")); await W(p, 300);
  const sp1 = await p.evaluate(() => document.querySelector("#labroot").__d3.angle("prop_rr"));
  rep("390", "выбранный винт крутится по часовой (сверху)", sp1 < sp0, `угол ${sp0.toFixed(2)}→${sp1.toFixed(2)}`);
  // 5. Задание «cam»: вид сбоку + камера
  await p.click('[data-view="side"]'); await W(p, 1000);
  await tapAt(await at("camera"));
  d = await D();
  rep("390", "камера выбирается касанием на виде сбоку", d.sel === "camera", `sel ${d.sel}, yaw ${d.yaw}, pitch ${d.pitch}`);
  // 6. Задание «ants»: антенны — из списка деталей
  await p.click('[data-part="ant_vtx"]'); await W(p, 200);
  await p.click('[data-part="ant_rx"]'); await W(p, 300);
  d = await D();
  rep("390", "все 4 задания засчитаны", /4\s*\/\s*4/.test(d.score), d.score);
  const shot = await p.locator(".d3-canvas").screenshot();
  rep("390", "модель нарисована (кадр не пустой)", shot.length > 15000, `${shot.length} байт`);
  await ctx.close();
}
// ПК, тёмная тема: мышь крутит, колесо меняет масштаб, смена темы перерисовывает
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(U); await W(p, 800);
  await p.click('[data-figtab="lab:drone3d"]'); await W(p, 700);
  await p.evaluate(() => document.querySelector(".d3-stage").scrollIntoView({ block: "center" })); await W(p, 300);
  const r = await p.evaluate(() => { const q = document.querySelector(".d3-canvas").getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  const D = () => p.evaluate(() => ({ ...document.querySelector("#labroot").dataset }));
  const a = await D();
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[0] + 120, r[1] + 30, { steps: 8 }); await p.mouse.up(); await W(p, 200);
  await p.mouse.wheel(0, -400); await W(p, 300);
  const c = await D();
  rep("1280", "мышь крутит, колесо приближает", Math.abs(c.yaw - a.yaw) > 0.3 && Number(c.zoom) < Number(a.zoom), `yaw ${a.yaw}→${c.yaw}, zoom ${a.zoom}→${c.zoom}`);
  await p.click("#theme"); await W(p, 400);
  const shot = await p.locator(".d3-canvas").screenshot();
  rep("1280", "после смены темы модель на месте", shot.length > 15000, `${shot.length} байт`);
  await p.click('[data-figtab="quad"]'); await W(p, 600);
  rep("1280", "назад на вкладку схемы", await p.evaluate(() => !!document.querySelector("#fig .iso-stage") && !document.querySelector(".d3-canvas")), "");
  await ctx.close();
}
await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
