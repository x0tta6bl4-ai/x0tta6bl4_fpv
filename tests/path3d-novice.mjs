// Гл. 1, 3D «два моста»: первый шаг новичка (решение обсуждения 003, карточка 026). Проверки — из сводки:
// K1 первый экран — холст и три кнопки симптома над панелью задания, детали и ракурсы после первого действия,
// «Как вначале» — когда ракурс ушёл; K2 замолчавший мост не «оживает» при касании; K3 звенья вне цепочки бледные, но
// нажимаются, полётник объясняет развилку; K4 подписи направлений у линий не ловят касание; K5 строка у вкладок;
// K6 тост не перехватывает касания и занимает одну строку. Старые проверки сцены — в tests/path3d.mjs.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href) + "#1";
mkdirSync(resolve(ROOT, "tests/out"), { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const errs = [], res = [];
const rep = (tag, item, ok, info = "") => { res.push(ok); console.log(`${tag} ${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };
const W = (p, ms) => p.waitForTimeout(ms);

async function phone(w, h, deep) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(U); await W(p, 900);
  await p.click('[data-figtab="lab:path3d"]'); await W(p, 900);
  // K1, K5: первый экран с вкладками сверху
  const first = await p.evaluate(() => {
    document.querySelector(".lab-tabs").scrollIntoView({ block: "start" });
    const syms = [...document.querySelectorAll("[data-sym]")].map((x) => x.getBoundingClientRect());
    const q = document.querySelector("#quest")?.getBoundingClientRect();
    const hint = document.querySelector(".lab-tabs-hint");
    const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; };
    return {
      symsBottom: Math.round(Math.max(...syms.map((r) => r.bottom))), questTop: q ? Math.round(q.top) : innerHeight, vh: innerHeight,
      partsHidden: !vis(".d3-parts"), topHidden: !vis('[data-view="top"]'), sideHidden: !vis('[data-view="side"]'), homeHidden: !vis('[data-view="home"]'),
      hint: hint ? hint.textContent : "", hintTop: hint ? Math.round(hint.getBoundingClientRect().top) : -1, sw: document.documentElement.scrollWidth,
    };
  });
  rep(tag, "K1: три кнопки симптома в первом экране и над панелью задания", first.symsBottom <= Math.min(first.vh, first.questTop), `низ кнопок ${first.symsBottom}, панель ${first.questTop}, экран ${first.vh}`);
  rep(tag, "K1: до первого действия детали и «Сверху / Сбоку / Как вначале» скрыты", first.partsHidden && first.topHidden && first.sideHidden && first.homeHidden, JSON.stringify(first));
  rep(tag, "K5: строка у вкладок про схему и 3D, страница не шире экрана", /стиками/.test(first.hint) && /симптом/.test(first.hint) && first.hintTop >= 0 && first.hintTop < 200 && first.sw <= w, `${first.hint.slice(0, 40)}…, top ${first.hintTop}, scrollWidth ${first.sw}`);
  if (deep) {
    const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 3, radiusY: 3, force: 1 })) });
    const tapAt = async ([x, y]) => { await touch("touchStart", [[x, y]]); await W(p, 60); await touch("touchEnd", []); await W(p, 350); };
    const at = (id) => p.evaluate((id) => document.querySelector("#labroot").__p3.at(id), id);
    const D = () => p.evaluate(() => ({ ...document.querySelector("#labroot").dataset }));
    const show = () => p.evaluate(() => document.querySelector(".d3-canvas").scrollIntoView({ block: "center" }));
    const done = (m) => p.evaluate((m) => !!document.querySelector(`#missions li[data-m="${m}"]`)?.classList.contains("ok"), m);
    await p.screenshot({ path: resolve(ROOT, `tests/out/path3d-novice-${w}.png`) });
    // K4: подписи направлений у линий, касание середины моста попадает в мост, а не в подпись
    await show(); await W(p, 300);
    const lanes = await p.evaluate(() => [...document.querySelectorAll(".p3-lane")].map((e) => ({ t: e.textContent, pe: getComputedStyle(e).pointerEvents, vis: !e.hidden })));
    rep(tag, "K4: подписи «Команды: пульт → дрон» и «Видео: дрон → очки» у линий, касание не ловят", lanes.length === 2 && lanes.some((l) => l.t === "Команды: пульт → дрон" && l.vis) && lanes.some((l) => l.t === "Видео: дрон → очки" && l.vis) && lanes.every((l) => l.pe === "none"), JSON.stringify(lanes));
    // K1: «Как вначале» появляется, когда ракурс ушёл
    const box = await p.evaluate(() => { const r = document.querySelector(".d3-canvas").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.7]; });
    await touch("touchStart", [box]);
    for (let i = 1; i <= 8; i++) { await touch("touchMove", [[box[0] + i * 14, box[1] - i * 3]]); await W(p, 16); }
    await touch("touchEnd", []); await W(p, 250);
    const homeShown = await p.evaluate(() => !document.querySelector('[data-view="home"]').hidden);
    rep(tag, "K1: после поворота сцены видна «Как вначале»", homeShown);
    await p.click('[data-view="home"]'); await W(p, 1100);
    const homeGone = await p.evaluate(() => document.querySelector('[data-view="home"]').hidden);
    rep(tag, "K1: на домашнем ракурсе «Как вначале» снова скрыта", homeGone);
    // «оба моста»: касание середин мостов
    await show(); await W(p, 250);
    await tapAt(await at("beam_cmd"));
    rep(tag, "K4: касание середины синего моста выбирает мост, не подпись", (await D()).sel === "beam_cmd", `sel ${(await D()).sel}`);
    await tapAt(await at("beam_vid"));
    rep(tag, "задание «оба моста» засчитано", await done("air"));
    // Задание «Нет картинки» раньше очереди (текущее — «Нет управления»): тогда учебник показывает тост
    await p.click('[data-sym="vid"]'); await W(p, 200);
    const after = await p.evaluate(() => ({ parts: !document.querySelector(".d3-parts").hidden, top: !document.querySelector('[data-view="top"]').hidden }));
    rep(tag, "K1: после первого симптома видны детали и «Сверху / Сбоку»", after.parts && after.top, JSON.stringify(after));
    await show(); await W(p, 250);
    await tapAt(await at("vtx"));
    rep(tag, "задание «Нет картинки» засчитано", await done("dark"));
    // K6: тост в одну строку, кнопка симптома под ним нажимается сразу
    const t = await p.evaluate(() => { const e = document.getElementById("toast"); const r = e.getBoundingClientRect(); return { shown: !e.hidden, h: Math.round(r.height), pe: getComputedStyle(e).pointerEvents, text: e.textContent }; });
    rep(tag, "K6: тост в одну строку (не выше 60 px) и не ловит касания", t.shown && t.h <= 60 && t.pe === "none" && /Задание 2 из 3 выполнено/.test(t.text), JSON.stringify(t));
    // Кнопку ставим на место тоста (низ экрана, над панелью задания нельзя — тост ниже панели); касаемся в точке, где лежит тост
    const hit = await p.evaluate(() => {
      const b = document.querySelector('[data-sym="cmd"]'), e = document.getElementById("toast");
      b.scrollIntoView({ block: "center" });
      const r = b.getBoundingClientRect(), tr = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, toastTop: tr.top, toastBottom: tr.bottom, under: document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2)?.closest?.("#toast") ? "toast" : "сквозь" };
    });
    rep(tag, "K6: точка внутри тоста — касание проходит сквозь него", hit.under === "сквозь", JSON.stringify(hit));
    await tapAt([hit.x, hit.y]);
    rep(tag, "K6: кнопка «Нет управления» сразу после звезды срабатывает без скрытия тоста", (await D()).mode === "cmd", `mode ${(await D()).mode}`);
    // K3: полётник бледный, но нажимается и объясняет развилку; задание он не закрывает
    const off = await p.evaluate(() => ({ fc: document.querySelector('[data-part="fc"]').hasAttribute("data-off"), rx: document.querySelector('[data-part="rx"]').hasAttribute("data-off"), cam: document.querySelector('[data-part="camera"]').hasAttribute("data-off") }));
    rep(tag, "K3: в режиме «Нет управления» полётник и камера бледные, приёмник — нет", off.fc && off.cam && !off.rx, JSON.stringify(off));
    await p.click('[data-part="fc"]'); await W(p, 200);
    const fcText = await p.evaluate(() => document.querySelector(".d3-info").textContent);
    rep(tag, "K3: полётник нажимается, объясняет развилку через вкладку «Приёмник» и задание не закрывает", /«Приёмник»/.test(fcText) && /камера не первая/.test(fcText) && !(await done("deaf")), fcText.slice(-120));
    // K2: замолчавший мост при касании серый, маркер «встал»; касание моста закрывает задание
    await show(); await W(p, 250);
    await tapAt(await at("beam_cmd"));
    await W(p, 200);
    const k2 = await p.evaluate(() => { const r = document.querySelector("#labroot"); return { sel: r.dataset.sel, pk: r.__p3.packets(), hi: r.__p3.hi(), accent: r.__p3.accent(), marker: document.querySelector(".d3-marker").textContent }; });
    const same = k2.hi.every((v, i) => Math.abs(v - k2.accent[i]) < 0.01);
    rep(tag, "K2: замолчавший синий мост при касании серый, маркер «встал», пакетов 0", k2.sel === "beam_cmd" && k2.pk.cmd === 0 && /встал/.test(k2.marker) && !same, JSON.stringify(k2));
    rep(tag, "касание звена синего моста закрывает задание, все 3 из 3", await done("deaf") && /3\s*\/\s*3/.test((await D()).score || await p.evaluate(() => document.querySelector("#labscore").textContent)));
  }
  await ctx.close();
}

await phone(360, 740, true);
await phone(390, 844, false);
await phone(412, 915, false);

// Широкий экран: места хватает — всё видно сразу
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(U); await W(p, 800);
  await p.click('[data-figtab="lab:path3d"]'); await W(p, 800);
  const d = await p.evaluate(() => ({ parts: !document.querySelector(".d3-parts").hidden, top: !document.querySelector('[data-view="top"]').hidden }));
  rep("1280", "на широком экране детали и ракурсы видны сразу", d.parts && d.top, JSON.stringify(d));
  await ctx.close();
}

await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
