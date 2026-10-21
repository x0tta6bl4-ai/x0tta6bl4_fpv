// Вопросы среза (docs/content/srez.json) против учебника: у каждого вопроса есть запись в карте покрытия
// (docs/content/srez-coverage.json); каждая цитата «где объяснено» дословно есть в тексте своей главы или сцены —
// если объяснение удалили или переписали, тест скажет, какой вопрос остался без него. Затем в браузере: приложение
// «И» показывает все вопросы, фильтр темы работает, ссылка «Объяснение» открывает главу на нужном разделе.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { CHAPTERS_A } from "../data/chapters-a.mjs";
import { CHAPTERS_B } from "../data/chapters-b.mjs";
import { CHAPTERS_C } from "../data/chapters-c.mjs";
import { KIDS } from "../data/kids.mjs";
import { HINTS } from "../data/hints.mjs";
import * as AP from "../data/appendix.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = (f) => JSON.parse(readFileSync(resolve(ROOT, f), "utf8"));
const SREZ = json("docs/content/srez.json");
const COV = json("docs/content/srez-coverage.json");
const res = [];
const rep = (item, ok, info = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${item}${info ? " — " + info : ""}`); };

// Текст так же, как его видит ученик: без разметки, пробелы схлопнуты.
const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const CH = [...CHAPTERS_A, ...CHAPTERS_B, ...CHAPTERS_C];
const chText = new Map();
for (const ch of CH) {
  const parts = [ch.title, ch.lead, ...(ch.goals || []), ch.summary, ch.riddle, ch.answer];
  for (const s of ch.sections || []) parts.push(s.title, s.body, ...(s.blocks || []).flatMap((b) => [b.title, b.text, b.breaks]));
  for (const q of ch.questions || []) parts.push(q.q, q.a);
  const k = KIDS[ch.id];
  if (k) parts.push(...(k.text || []), ...(k.laws || []).flatMap((l) => [l.t, l.f, ...(l.parts || []).flat(), l.ex, l.drone, ...(l.q || [])]));
  chText.set(ch.id, parts.map(strip).join(" \n "));
}
const extra = [...Object.values(HINTS).flatMap((h) => [h.how, h.why]), ...AP.GLOSSARY.flat(), ...AP.PROCEDURES.flatMap((p) => [p.title, ...(p.items || [])]), AP.REFTABLES, ...AP.CORRECTIONS.map((c) => (typeof c === "string" ? c : JSON.stringify(c)))].map(strip).join(" \n ");
const all = [...chText.values(), extra].join(" \n ");

const cov = new Map(COV.items.map((c) => [String(c.n), c]));
const ST = ["full", "partial", "none", "conflict"];
const noEntry = SREZ.items.filter((it) => !ST.includes(cov.get(String(it.n))?.status)).map((it) => it.n);
rep(`у всех ${SREZ.items.length} вопросов есть запись в карте покрытия`, SREZ.items.length > 100 && !noEntry.length, noEntry.join(", "));
const lost = [], badSec = [];
for (const c of COV.items) {
  for (const w of c.where || []) {
    const src = /^src\//.test(w.tag) ? strip(readFileSync(resolve(ROOT, w.tag), "utf8")) : /^(физика )?гл\d+/.test(w.tag) ? chText.get(w.tag.match(/гл(\d+)/)[1]) || "" : all;
    if (!w.quote || !src.includes(strip(w.quote))) lost.push(`${c.n}: ${w.tag} «${String(w.quote).slice(0, 50)}»`);
  }
  const ch = c.ch != null ? CH.find((x) => x.id === String(c.ch)) : null;
  if (["full", "partial"].includes(c.status) && (!ch || (c.sec && c.sec !== "#check" && !(ch.sections || []).some((s) => s.title === c.sec)))) badSec.push(`${c.n}: гл ${c.ch} «${c.sec}»`);
}
rep("каждая цитата «где объяснено» дословно есть в учебнике", !lost.length, lost.slice(0, 8).join(" | "));
rep("ссылка на объяснение ведёт в существующую главу и раздел", !badSec.length, badSec.slice(0, 8).join(" | "));
const count = Object.fromEntries(ST.map((s) => [s, COV.items.filter((c) => c.status === s).length]));
console.log(`покрытие: объяснено ${count.full}, частично ${count.partial}, нет ${count.none}, расходится ${count.conflict}`);

// Браузер: страница вопросов среза на телефоне
const U = (process.argv[2] || pathToFileURL(resolve(ROOT, "dist/dev.html")).href);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto(U + "#И"); await p.waitForTimeout(800);
const n = await p.$$eval("#srz details.srz", (d) => d.length);
rep("приложение «И» показывает все вопросы", n === SREZ.items.length, `${n} из ${SREZ.items.length}`);
const cat = SREZ.cats[0][0];
await p.click(`[data-srzc="${cat}"]`); await p.waitForTimeout(150);
const shown = await p.$$eval("#srz details.srz", (d) => d.filter((x) => !x.hidden).length);
const want = SREZ.items.filter((it) => it.c === cat || it.also === cat).length;
rep("фильтр темы оставляет только её вопросы", shown === want, `${shown} из ${want}`);
await p.click('[data-srzc=""]'); await p.waitForTimeout(150);
const target = COV.items.find((c) => c.status === "full" && c.sec && c.sec !== "#check");
if (target) {
  const det = await p.$(`#srz details.srz:has([data-srz-sec="${target.sec.replace(/"/g, '\\"')}"])`);
  await det.evaluate((d) => (d.open = true));
  await (await det.$("[data-srz-sec]")).click(); await p.waitForTimeout(900);
  const at = await p.evaluate((t) => { const h = [...document.querySelectorAll("#main section.sec h3")].find((x) => x.textContent === t); return { hash: location.hash, top: h ? Math.round(h.getBoundingClientRect().top) : null }; }, target.sec);
  rep("«Объяснение» открывает главу на нужном разделе", at.hash === `#${target.ch}` && at.top !== null && at.top > -10 && at.top < 300, JSON.stringify(at));
} else rep("«Объяснение» открывает главу на нужном разделе", false, "нет ни одного вопроса со статусом full и разделом");
const sw = await p.evaluate(() => (location.hash = "И", new Promise((r) => setTimeout(() => r(document.documentElement.scrollWidth), 500))));
rep("страница не шире экрана телефона", sw <= 391, String(sw));
await b.close();
const fail = res.filter((x) => !x).length;
console.log(`ИТОГ: ${res.length} проверок, FAIL ${fail}`);
console.log("ERR", errs.length, JSON.stringify(errs.slice(0, 5)));
process.exit(fail || errs.length ? 1 : 0);
