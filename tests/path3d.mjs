// Гл. 1, вкладка «3D: два моста»: первая вкладка остаётся схемой со стиками,
// 3D крутится, оба моста на экране, пакеты гаснут по симптому, три задания закрываются касанием.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href) + "#1";
mkdirSync(resolve(ROOT, "tests/out"), { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const errs = [], res = [];
const rep = (tag, item, ok, info = "") => { res.push(ok); console.log(`${tag} ${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const W = (p, ms) => p.waitForTimeout(ms);

{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(U); await W(p, 900);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 3, radiusY: 3, force: 1 })) });
  const tapAt = async ([x, y]) => { await touch("touchStart", [[x, y]]); await W(p, 60); await touch("touchEnd", []); await W(p, 350); };
  const D = () => p.evaluate(() => ({ ...document.querySelector("#labroot").dataset, score: document.querySelector("#labscore")?.textContent || "" }));
  const at = (id) => p.evaluate((id) => document.querySelector("#labroot").__p3.at(id), id);
  const show = () => p.evaluate(() => document.querySelector(".d3-canvas").scrollIntoView({ block: "center" }));
  const first = await p.evaluate(() => ({
    iso: !!document.querySelector("#fig .iso-stage"),
    sticks: !!document.querySelector(".ctl-sticks"),
    d3: !!document.querySelector(".d3-canvas"),
    tab: document.querySelector(".lab-tabs [aria-selected='true']")?.textContent || "",
  }));
  rep("390", "сначала открыта схема со стиками, не 3D", first.iso && first.sticks && !first.d3 && /Схема/.test(first.tab), JSON.stringify(first));
  const wide0 = await p.evaluate(() => document.documentElement.scrollWidth);
  rep("390", "вкладки главы не шире экрана", wide0 <= 390, `scrollWidth ${wide0}`);
  await p.click('[data-figtab="lab:path3d"]'); await W(p, 800);
  const has = await p.evaluate(() => ({ canvas: !!document.querySelector(".d3-canvas"), p3: !!(document.querySelector("#labroot") || {}).__p3, webgl: document.querySelector("#labroot")?.dataset.webgl }));
  rep("390", "вкладка 3D открывается, WebGL работает", has.canvas && has.p3 && has.webgl === "1", JSON.stringify(has));
  await p.evaluate(() => document.querySelector(".d3-stage").scrollIntoView({ block: "center" })); await W(p, 400);
  const inside = await p.evaluate(() => {
    const root = document.querySelector("#labroot");
    const c = document.querySelector(".d3-canvas").getBoundingClientRect();
    const hit = (id) => {
      const [x, y] = root.__p3.at(id);
      return { x: Math.round(x), y: Math.round(y), ok: x > c.left + 6 && x < c.right - 6 && y > c.top + 6 && y < c.bottom - 6 };
    };
    return { cmd: hit("beam_cmd"), vid: hit("beam_vid"), w: Math.round(c.width), h: Math.round(c.height) };
  });
  rep("390", "середины обоих мостов в кадре", inside.cmd.ok && inside.vid.ok, JSON.stringify(inside));
  const pk0 = await p.evaluate(() => document.querySelector("#labroot").__p3.packets());
  rep("390", "пакеты идут по обоим мостам", pk0.cmd >= 5 && pk0.vid >= 5, JSON.stringify(pk0));
  await p.locator(".d3-canvas").screenshot({ path: resolve(ROOT, "tests/out/path3d-390.png") });
  const box = await p.evaluate(() => { const r = document.querySelector(".d3-canvas").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  const d0 = await D(), y0 = await p.evaluate(() => scrollY);
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] * 0.72;
  await touch("touchStart", [[cx, cy]]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [[cx + i * 14, cy - i * 4]]); await W(p, 16); }
  await touch("touchEnd", []); await W(p, 250);
  const d1 = await D(), y1 = await p.evaluate(() => scrollY);
  rep("390", "палец крутит сцену, страница стоит", Math.abs(d1.yaw - d0.yaw) > 0.15 && Math.abs(y1 - y0) < 2, `yaw ${d0.yaw}→${d1.yaw}, scrollY ${y0}→${y1}`);
  await p.click('[data-view="home"]'); await W(p, 900);
  await show(); await W(p, 250);
  await tapAt(await at("beam_cmd"));
  let d = await D();
  rep("390", "касание синего моста выбирает его", d.sel === "beam_cmd", `sel ${d.sel}`);
  await tapAt(await at("beam_vid"));
  d = await D();
  rep("390", "касание оранжевого моста выбирает его", d.sel === "beam_vid", `sel ${d.sel}`);
  const air = await p.evaluate(() => document.querySelector('#missions li[data-m="air"]')?.classList.contains("ok"));
  rep("390", "задание «оба моста» засчитано", !!air, `score ${(await D()).score}`);
  await p.click('[data-sym="cmd"]'); await W(p, 200);
  await show(); await W(p, 200);
  const pk1 = await p.evaluate(() => document.querySelector("#labroot").__p3.packets());
  d = await D();
  rep("390", "«Нет управления»: синие пакеты встали, оранжевые идут", d.mode === "cmd" && pk1.cmd === 0 && pk1.vid >= 5, JSON.stringify(pk1));
  await p.locator(".d3-canvas").screenshot({ path: resolve(ROOT, "tests/out/path3d-cmd.png") });
  await tapAt(await at("rx"));
  d = await D();
  const deaf = await p.evaluate(() => document.querySelector('#missions li[data-m="deaf"]')?.classList.contains("ok"));
  rep("390", "приёмник на замолчавшем синем мосте закрывает задание", d.sel === "rx" && !!deaf, `sel ${d.sel}`);
  await p.click('[data-sym="vid"]'); await W(p, 200);
  await show(); await W(p, 200);
  const pk2 = await p.evaluate(() => document.querySelector("#labroot").__p3.packets());
  rep("390", "«Нет картинки»: оранжевые пакеты встали, синие идут", pk2.vid === 0 && pk2.cmd >= 5, JSON.stringify(pk2));
  // Всплывающая «задание выполнено» три секунды лежит поверх модели.
  await p.evaluate(() => { const t = document.getElementById("toast"); if (t) t.hidden = true; });
  await tapAt(await at("vtx"));
  d = await D();
  const dark = await p.evaluate(() => document.querySelector('#missions li[data-m="dark"]')?.classList.contains("ok"));
  rep("390", "VTX на замолчавшем оранжевом мосте закрывает задание", d.sel === "vtx" && !!dark, `sel ${d.sel}, score ${d.score}`);
  rep("390", "все 3 задания засчитаны", /3\s*\/\s*3/.test(d.score), d.score);
  const wide1 = await p.evaluate(() => document.documentElement.scrollWidth);
  rep("390", "3D-вкладка не шире экрана", wide1 <= 390, `scrollWidth ${wide1}`);
  const shot = await p.locator(".d3-canvas").screenshot();
  rep("390", "сцена нарисована (кадр не пустой)", shot.length > 8000, `${shot.length} байт`);
  await p.click('[data-figtab="path"]'); await W(p, 700);
  const back = await p.evaluate(() => ({ iso: !!document.querySelector("#fig .iso-stage"), d3: !!document.querySelector(".d3-canvas") }));
  rep("390", "назад на схему со стиками", back.iso && !back.d3, JSON.stringify(back));
  await ctx.close();
}

{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(U); await W(p, 800);
  await p.click('[data-figtab="lab:path3d"]'); await W(p, 700);
  await p.evaluate(() => document.querySelector(".d3-stage").scrollIntoView({ block: "center" })); await W(p, 300);
  await p.click('[data-view="top"]'); await W(p, 1000);
  await p.locator(".d3-canvas").screenshot({ path: resolve(ROOT, "tests/out/path3d-top.png") });
  const r = await p.evaluate(() => { const q = document.querySelector(".d3-canvas").getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  const D = () => p.evaluate(() => ({ ...document.querySelector("#labroot").dataset }));
  const a = await D();
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[0] + 140, r[1] + 20, { steps: 8 }); await p.mouse.up(); await W(p, 200);
  const c = await D();
  rep("1280", "мышь крутит модель", Math.abs(c.yaw - a.yaw) > 0.25, `yaw ${a.yaw}→${c.yaw}`);
  await p.click("#theme"); await W(p, 400);
  const shot = await p.locator(".d3-canvas").screenshot({ path: resolve(ROOT, "tests/out/path3d-dark.png") });
  rep("1280", "после смены темы сцена на месте", shot.length > 8000, `${shot.length} байт`);
  await ctx.close();
}

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
