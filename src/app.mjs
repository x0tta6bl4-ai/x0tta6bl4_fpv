// FPV Anatomy v4: учебник по книге «FPV-дрон: понять, а не зазубрить» (ред. 7) со стендами anatomy.
import { mountFigure } from "./stage.mjs";
import * as thrust from "./figs/thrust.mjs";
import * as path from "./figs/path.mjs";
import * as battery from "./figs/battery.mjs";
import * as radio from "./figs/radio.mjs";
import * as pid from "./figs/pid.mjs";
import * as failsafe from "./figs/failsafe.mjs";
import * as quad from "./figs/quad.mjs";
import * as link from "./figs/link.mjs";
import * as pair from "./figs/pair.mjs";
import * as goggles from "./figs/goggles.mjs";
import * as antenna from "./figs/antenna.mjs";
import * as jamfield from "./figs/jamfield.mjs";
import * as flighttime from "./figs/flighttime.mjs";
import * as bench from "./figs/bench.mjs";
import * as bfdesk from "./figs/bfdesk.mjs";
import * as flyfield from "./figs/flyfield.mjs";
import * as waterworks from "./figs/waterworks.mjs";
import * as preflight from "./figs/preflight.mjs";
import * as workshop from "./figs/workshop.mjs";
import * as navdesk from "./figs/navdesk.mjs";
import * as armcase from "./figs/armcase.mjs";
import * as lowv from "./figs/lowv.mjs";
import { CHAPTERS_A } from "../data/chapters-a.mjs";
import { CHAPTERS_B } from "../data/chapters-b.mjs";
import { CHAPTERS_C } from "../data/chapters-c.mjs";
import { GLOSSARY, CORRECTIONS, CLI, PROCEDURES, VERSIONS, SOURCES, REFTABLES } from "../data/appendix.mjs";
import { LABS } from "./labs/index.mjs";
import { KIDS } from "../data/kids.mjs";
import { HINTS } from "../data/hints.mjs";
import { INTROS } from "../data/intros.mjs";
import { EXPERIMENTS } from "./methods/index.mjs";
import { mountExperiment, STATUS } from "./methods/kit.mjs";
import { attachZoom } from "./zoom.mjs";
import { mountNotes } from "./notes.mjs";
import SREZ from "../docs/content/srez.json";
import SREZ_COV from "../docs/content/srez-coverage.json";
import { shuffle } from "./labkit.mjs";

const FIGS = { quad, path, thrust, battery, pid, radio, failsafe, link, pair, goggles, antenna, jamfield, flighttime, bench, bfdesk, flyfield, waterworks, preflight, workshop, navdesk, armcase, lowv };
const FIG_ORDER = ["quad", "path", "pid", "thrust", "battery", "radio", "failsafe", "link", "pair", "goggles", "antenna", "jamfield", "flighttime", "bench", "bfdesk", "flyfield", "waterworks", "preflight", "workshop", "navdesk", "armcase", "lowv"];
const CHAPTERS = [...CHAPTERS_A, ...CHAPTERS_B, ...CHAPTERS_C];
const HERE = ["Тяга", "Питание", "Мозг", "Управление", "Видео", "Практика"];
const APPX = [
  { id: "А", title: "Глоссарий", pages: [76, 77] },
  { id: "Б", title: "Справочные таблицы", pages: [78, 79] },
  { id: "В", title: "Пошаговые процедуры", pages: [80, 81] },
  { id: "Г", title: "Командная строка Betaflight", pages: [82, 82] },
  { id: "Д", title: "Журнал исправлений и расхождений", pages: [83, 85] },
  { id: "Е", title: "Ответы на вопросы", pages: [86, 87] },
  { id: "Ж", title: "Источники", pages: [88, 89] },
  { id: "З", title: "Версии и совместимость", pages: [90, 90] },
  { id: "И", title: "Вопросы среза" },
];
const PARTS = ["Перед стартом", "Часть I · Как дрон летает и чем питается", "Часть II · Радио", "Часть III · Собрать и настроить", "Часть IV · Полёт в реальном мире"];
const BLOCK = {
  key: "Ключ к пониманию", analogy: "Аналогия", follows: "Что из этого следует", remember: "Запомни", trap: "Ловушка", exam: "На экзамене", safety: "Безопасность", myth: "Миф и правда", note: "Заметка",
};
const PRIO = { 1: "① главное", 2: "② понимание", 3: "③ любопытным" };
const DAY = 864e5;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tags = (html) => String(html ?? "").replace(/\{(закон|оценка|версия|пример)\}/g, (_, t) => `<span class="tag" data-tag="${t}">${t === "версия" ? "зависит от версии" : t}</span>`);

// ── Хранилище прогресса (только в этом браузере) ──
const KEY = "fpv-anatomy-v4";
let S = { done: {}, guess: {}, grade: {}, ans: {}, rep: {}, exam: "", fast: false, theme: "", last: "start", seen: {}, miss: {}, pred: {}, ready: {}, qmin: false, updated: 0 };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = { ...S, ...JSON.parse(raw) };
} catch (e) {}
S.pred = S.pred || {};
S.ready = S.ready || {};
// Время локального прогресса до первого render()/save(): они ставят S.updated = сейчас,
// и тогда облако всегда казалось бы старше, а его прогресс затирался бы пустым.
const LOCAL_UPDATED = S.updated || 0;
// Облако (если страница открыта на claude.ai): личный документ data/users/<id>/progress.
let CLOUD = null; // { ref } когда доступно
let cloudBusy = false, cloudDirty = false, cloudTimer = 0;
function cloudStatus(text, ok) {
  const el = document.getElementById("sync");
  if (el) {
    el.textContent = text;
    el.dataset.ok = ok ? "1" : "0";
  }
}
async function cloudFlush() {
  if (!CLOUD || cloudBusy) return;
  cloudBusy = true;
  cloudDirty = false;
  try {
    await CLOUD.ref.set(JSON.parse(JSON.stringify(S)));
    cloudStatus("Прогресс сохранён в облаке", true);
  } catch (e) {
    if (e && e.code === "invalid_argument") {
      CLOUD = null;
      cloudStatus("Прогресс — только в этом браузере", false);
    } else {
      // Временный сбой сети: не делаем вид, что всё сохранено, и пробуем ещё раз.
      cloudStatus("Облако недоступно — прогресс пока в этом браузере, повторю", false);
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(cloudFlush, 5000);
    }
  }
  cloudBusy = false;
  if (cloudDirty) cloudFlush();
}
const save = () => {
  S.updated = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
  if (CLOUD) {
    cloudDirty = true;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudFlush, 1500);
  }
};
async function cloudInit() {
  const use = window.claude && window.claude.use;
  if (!use) return;
  try {
    const [user, db] = await Promise.all([window.claude.use("user"), window.claude.use("db")]);
    if (!user || !db) return;
    const id = await user.id();
    if (!id) return;
    const ref = db.doc("data/users/" + id + "/progress");
    const snap = await ref.get();
    const remote = snap.exists ? snap.data() : null;
    CLOUD = { ref };
    if (remote && (remote.updated || 0) > LOCAL_UPDATED) {
      S = { ...S, ...JSON.parse(JSON.stringify(remote)) };
      try {
        localStorage.setItem(KEY, JSON.stringify(S));
      } catch (e) {}
      applyTheme();
      render();
      cloudStatus("Прогресс загружен из облака", true);
    } else if (S.updated) {
      cloudDirty = true;
      cloudFlush();
    } else cloudStatus("Прогресс сохраняется в облаке", true);
  } catch (e) {
    CLOUD = null;
  }
}

// ── Книга: страницы текста и сканы (из v3) ──
let BOOK = [];
try {
  BOOK = JSON.parse($("#book-pages").textContent);
} catch (e) {}
let IMAGES = null;
const images = () => {
  if (!IMAGES) {
    try {
      IMAGES = JSON.parse($("#book-images").textContent);
    } catch (e) {
      IMAGES = {};
    }
  }
  return IMAGES;
};

// ── Повторение: через 1 день, через 3–4 дня, за неделю до экзамена (как в книге) ──
function reps(ch) {
  const r = S.rep[ch.id];
  if (!r) return null;
  const start = r.start;
  const exam = S.exam ? new Date(S.exam).getTime() : null;
  return [
    { label: "через 1 день", due: start + DAY, done: !!r.d1 },
    { label: "через 3–4 дня", due: start + 3.5 * DAY, done: !!r.d3 },
    { label: "за неделю до экзамена", due: exam ? exam - 7 * DAY : null, done: !!r.dw },
  ];
}
function dueList() {
  const now = Date.now();
  const out = [];
  for (const ch of CHAPTERS) {
    const r = reps(ch);
    if (!r) continue;
    r.forEach((x, i) => {
      if (!x.done && x.due && x.due <= now) out.push({ ch, i, label: x.label });
    });
  }
  return out;
}
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—");

function chScore(ch) {
  const qs = ch.questions || [];
  if (!qs.length) return null;
  let sum = 0, n = 0;
  qs.forEach((_, i) => {
    const g = S.grade[`${ch.id}:${i}`];
    if (g !== undefined) {
      sum += g;
      n++;
    }
  });
  return { sum, max: qs.length * 2, n, total: qs.length };
}

// ── Оглавление ──
function tocHtml(active) {
  const due = dueList();
  let html = `<div class="today"><div class="eyebrow">Сегодня повторить</div>${due.length ? `<ul>${due.slice(0, 6).map((d) => `<li><a href="#${d.ch.id}">Гл. ${d.ch.id} · ${esc(d.label)}</a></li>`).join("")}</ul>` : `<p class="muted">Нечего. Изученные главы появятся здесь по графику книги.</p>`}<label class="exam">Дата экзамена <input type="date" id="examdate" value="${esc(S.exam)}"></label></div>`;
  html += `<nav aria-label="Оглавление"><a class="toc-start${active === "start" ? " on" : ""}" href="#start">Как пользоваться книгой</a>`;
  for (const part of PARTS) {
    html += `<div class="toc-part">${esc(part)}</div>`;
    for (const ch of CHAPTERS.filter((c) => c.part === part)) {
      const sc = chScore(ch);
      const mark = S.done[ch.id] ? "✓" : sc && sc.n ? "◐" : "";
      html += `<a href="#${ch.id}" class="${active === ch.id ? "on" : ""}"><span class="n">${ch.num}</span><span class="t">${esc(ch.title)}</span><span class="m" aria-label="${S.done[ch.id] ? "изучена" : ""}">${mark}</span></a>`;
    }
  }
  html += `<div class="toc-part">Приложения</div>`;
  for (const a of APPX) html += `<a href="#${a.id}" class="${active === a.id ? "on" : ""}"><span class="n">${a.id}</span><span class="t">${esc(a.title)}</span></a>`;
  html += `</nav>`;
  return html;
}

// ── Части главы ──
function hereStrip(ch) {
  return `<div class="here" aria-label="Вы здесь"><span>Вы здесь:</span>${HERE.map((h, i) => `<b class="${ch.here && ch.here.includes(i) ? "on" : ""}">${h}</b>`).join("")}</div>`;
}
function glossaryOf(word) {
  // Ищем точное совпадение слова или его части с частью термина. Подстроки не годятся:
  // короткие термины «S», «P», «TX» иначе цепляются почти к любому слову.
  const w = word.toLowerCase().trim();
  const parts = (t) => t.toLowerCase().split(/[\/,()]/).map((p) => p.trim()).filter(Boolean);
  const toks = w.split(/[\s\/,()]+/).filter(Boolean);
  const hit =
    GLOSSARY.find(([t]) => t.toLowerCase() === w || parts(t).includes(w)) ||
    GLOSSARY.find(([t]) => parts(t).some((p) => toks.includes(p))) ||
    GLOSSARY.find(([t]) => parts(t).some((p) => p.length >= 4 && toks.some((k) => k.split(/[-_]/)[0] === p)));
  return hit ? `${hit[0]} — ${hit[1]}` : "";
}
const OPEN_BLK = new Set(["key", "safety", "exam", "remember", "trap"]);
function blockHtml(b) {
  const head = b.title ? `${BLOCK[b.type]}: ${b.title}` : BLOCK[b.type];
  // Открыто то, что нужно на срезе и в поле: ключ, безопасность, «на экзамене», «запомни», ловушка.
  // Свёрнуто пояснительное: аналогия, «что из этого следует», миф, заметка (или b.open в данных).
  const open = OPEN_BLK.has(b.type) || b.open ? " open" : "";
  const text = tags(b.text);
  const body = /<(?:p|h[1-6]|ul|ol|dl|table|div|details)(?:\s|>)/i.test(text) ? text : `<p>${text}</p>`;
  return `<details class="blk" data-type="${b.type}"${open}><summary class="blk-h">${tags(head)}</summary><div class="blk-body">${body}${b.breaks ? `<p class="breaks"><b>Где ломается:</b> ${tags(b.breaks)}</p>` : ""}</div></details>`;
}
function sectionHtml(sec) {
  // ③ «любопытным» не на пути по умолчанию: свёрнут, открывается касанием.
  if (sec.prio === 3) return `<details class="sec-more"><summary>${PRIO[3]}: ${esc(sec.title)}</summary>${sectionBody(sec)}</details>`;
  return sectionBody(sec);
}
function sectionBody(sec) {
  return `<section class="sec" data-prio="${sec.prio}"><div class="sec-h"><h3>${esc(sec.title)}</h3><span class="prio" data-prio="${sec.prio}">${PRIO[sec.prio]}</span></div>${tags(sec.body || "")}${sec.w ? `<div class="nw" data-w="${esc(sec.w)}"></div>` : ""}${(sec.blocks || []).map(blockHtml).join("")}</section>`;
}
function questionsHtml(ch) {
  const qs = ch.questions || [];
  if (!qs.length) return "";
  const sc = chScore(ch);
  return `<section class="check" id="check"><div class="sec-h"><h2>Проверь себя</h2>${sc ? `<span class="score" id="score">${sc.sum} / ${sc.max}</span>` : ""}</div>
  <p class="muted small">Ответь своими словами, открой ответ и оцени себя: <b>2</b> — объяснил почему, <b>1</b> — верно без объяснения, <b>0</b> — неверно.</p>
  <ol class="qs">${qs
    .map((q, i) => {
      const id = `${ch.id}:${i}`;
      const g = S.grade[id];
      return `<li class="q" data-q="${id}"><p class="q-t">${q.q}${q.ch ? ` <a class="q-ch" href="#${q.ch}">гл. ${q.ch}</a>` : ""}${q.k ? ` <span class="q-k" title="Вопрос по конспекту инструктора">конспект</span>` : ""}</p>
      <textarea rows="2" placeholder="Мой ответ…" data-ans="${id}">${esc(S.ans[id] || "")}</textarea>
      <div class="q-row"><button type="button" class="ghost" data-show="${id}" aria-expanded="false">Показать ответ</button>
      <span class="grades" role="group" aria-label="Самооценка">${[0, 1, 2].map((v) => `<button type="button" data-grade="${id}" data-v="${v}" aria-pressed="${g === v}">${v}</button>`).join("")}</span></div>
      <p class="q-a" hidden><b>Ответ (Прил. Е):</b> ${q.a}</p></li>`;
    })
    .join("")}</ol>${ch.mixed ? `<div id="weak" class="weak"></div>` : ""}</section>`;
}
function repeatHtml(ch) {
  if (ch.mixed || !(ch.questions || []).length) return "";
  const r = reps(ch);
  if (!r) return `<div class="repeat"><span>Повтори:</span> <button type="button" class="ghost" id="startrep">Я прошёл главу — запустить график повторения</button></div>`;
  return `<div class="repeat"><span>Повтори:</span>${r
    .map((x, i) => `<label class="${!x.done && x.due && x.due <= Date.now() ? "due" : ""}"><input type="checkbox" data-rep="${["d1", "d3", "dw"][i]}" ${x.done ? "checked" : ""}> ${esc(x.label)} <small>${x.due ? fmtDate(x.due) : "укажи дату экзамена"}</small></label>`)
    .join("")}</div>`;
}
function sourceHtml(id, pages) {
  const b = BOOK.find((x) => x.id === id);
  if (!b) return "";
  return `<details class="source" id="source"><summary>Материал книги · с. ${b.start}–${b.end}</summary><p class="muted small">Извлечённый текст редакции 7 с номерами страниц. Таблицы и рисунки в PDF имеют исходную компоновку — включи сканы страниц.</p><label class="check"><input type="checkbox" id="scans"> Показывать оригинальные страницы с рисунками</label><div id="pages">${b.pages.map((p) => `<article class="page" data-page="${p.page}"><div class="page-n">с. ${p.page}</div><pre>${esc(p.text)}</pre></article>`).join("")}</div></details>`;
}

// ── Лаборатории и миссии ──
// У главы может быть несколько стендов (ch.figs, вкладки в шапке лаборатории); ch.fig — первый из них.
// Выбранная вкладка запоминается (S.figTab). Ключи заданий у стендов одной главы не должны совпадать.
// Вкладкой может быть и лаборатория ({ lab: "drone3d", tab: "…" }) — например, 3D-модель рядом со схемой главы.
const tabKey = (f) => f.id || `lab:${f.lab}`;
const tabMod = (f) => (f.lab ? LABS[f.lab] : FIGS[f.id]);
function figsOf(ch) {
  return (ch.figs && ch.figs.length ? ch.figs : ch.fig ? [ch.fig] : []).filter((f) => (f.lab ? LABS[f.lab] : FIGS[f.id]));
}
function activeFig(ch) {
  const all = figsOf(ch);
  const want = S.figTab && S.figTab[ch.id];
  return all.find((f) => tabKey(f) === want) || all[0] || null;
}
function interactiveOf(ch) {
  if (ch.lab && LABS[ch.lab]) return { kind: "lab", mod: LABS[ch.lab], missions: LABS[ch.lab].meta.missions, title: LABS[ch.lab].meta.title };
  const f = activeFig(ch);
  if (f && f.lab) return { kind: "lab", mod: LABS[f.lab], missions: LABS[f.lab].meta.missions, title: LABS[f.lab].meta.title };
  if (f) return { kind: "fig", mod: FIGS[f.id], missions: FIGS[f.id].meta.missions || [], title: FIGS[f.id].meta.title };
  return null;
}
// Все задания главы — со всех её стендов (для звёзд и оглавления лабораторий).
function allMissionsOf(ch) {
  if (ch.lab && LABS[ch.lab]) return LABS[ch.lab].meta.missions;
  return figsOf(ch).flatMap((f) => tabMod(f).meta.missions || []);
}
const missKey = (ch, id) => `${ch.id}:${id}`;
function starsTotal() {
  // Считаем только миссии, которые есть сейчас: старые ключи из сохранений не дают «больше, чем всего».
  let all = 0, got = 0;
  for (const c of CHAPTERS) {
    const ms = allMissionsOf(c);
    all += ms.length;
    got += ms.filter((m) => (S.miss || {})[missKey(c, m.id)]).length;
  }
  return { got, all };
}
function updateStars() {
  const st = starsTotal();
  const el = document.getElementById("stars");
  if (el) el.textContent = `★ ${st.got} / ${st.all}`;
}
// Карточка «Что это · Что делаешь · Зачем» над стендом (data/intros.mjs); без неё — общая подсказка.
function introHtml(it) {
  const I = it.kind === "fig" ? INTROS[it.mod.meta.id] : null;
  // «Что это» — над списком деталей под сценой; здесь только зачем стенд и что на нём делать.
  if (I) return `<div class="lab-intro"><p><b>Зачем.</b> ${esc(I.why)}</p><p><b>Что делаешь.</b> ${esc(I.do)}</p></div>`;
  return it.missions.length ? `<p class="lab-howto">Выполняй задания по очереди — текущее всегда в панели заданий. Двигай ползунки и кнопки, смотри на схему: когда получится, задание засчитается само.</p>` : "";
}
function interactiveHtml(ch) {
  const it = interactiveOf(ch);
  if (!it) return "";
  const done = it.missions.filter((m) => S.miss[missKey(ch, m.id)]).length;
  const body = it.kind === "lab" ? `<div id="labroot" class="labroot"></div>` : `<section class="workspace"><div class="ws-fig"><div id="fig"></div><div class="metrics" id="metrics"></div><p class="fig-note" id="fignote"></p><div class="fig-info" id="figinfo"></div></div><aside class="ws-side" id="side"></aside></section>`;
  return `<section class="labcard" id="labcard" data-kind="${it.kind}">
    ${figsOf(ch).length > 1 ? `<div class="lab-tabs" role="tablist" aria-label="Стенды главы">${figsOf(ch).map((f) => { const ms = tabMod(f).meta.missions || []; const got = ms.filter((m) => S.miss[missKey(ch, m.id)]).length; const on = tabKey(f) === tabKey(activeFig(ch)); return `<button type="button" role="tab" aria-selected="${on}" data-figtab="${tabKey(f)}">${esc(f.tab || tabMod(f).meta.title)} <small>${got}/${ms.length}★</small></button>`; }).join("")}</div>` : ""}
    ${ch.tabsHint && figsOf(ch).length > 1 ? `<p class="lab-tabs-hint">${esc(ch.tabsHint)}</p>` : ""}
    <div class="lab-head"><div><div class="eyebrow">Лаборатория главы ${ch.num}</div><h2>${esc(it.title)}</h2></div><div class="lab-tools"><span class="lab-score" id="labscore">${done} / ${it.missions.length} ★</span><button type="button" id="full" aria-pressed="false">На весь экран</button></div></div>
    ${introHtml(it)}
    ${body}
    ${it.missions.length ? `<div class="quest${S.qmin ? " min" : ""}" id="quest" aria-live="polite">${questHtml(ch, it)}</div>` : ""}
  </section>`;
}
function kidHtml(ch) {
  const k = KIDS[ch.id];
  if (!k) return "";
  const law = (l) => `<article class="law"><h3>${esc(l.t)}</h3><div class="law-f">${l.f.split(" · ").join("<br>")}</div>${l.parts && l.parts.length ? `<dl class="law-p">${l.parts.map(([s, d]) => `<div><dt>${s}</dt><dd>${d}</dd></div>`).join("")}</dl>` : ""}${l.ex ? `<p class="law-ex"><b>Пример.</b> ${tags(l.ex)}</p>` : ""}${l.drone ? `<p class="law-dr"><b>Для дрона:</b> ${tags(l.drone)}</p>` : ""}${l.q ? `<details class="law-q"><summary>Проверь себя: ${l.q[0]}</summary><p>${l.q[1]}</p></details>` : ""}</article>`;
  return `<section class="kid"><div class="eyebrow">Физика по-школьному</div>${k.text.map((p) => `<p>${tags(p)}</p>`).join("")}${k.laws && k.laws.length ? `<div class="laws">${k.laws.map(law).join("")}</div>` : ""}${k.words && k.words.length ? `<dl class="kid-words">${k.words.map(([w, d]) => `<div><dt>${esc(w)}</dt><dd>${d}</dd></div>`).join("")}</dl>` : ""}</section>`;
}
let toastTimer = 0;
function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}
// Панель «Текущее задание»: одно задание за раз, «как сделать» открыто, точки — переход между заданиями.
const QUEST = { ch: "", i: 0, min: false, t: 0, how: null };
function questIndex(ch, it) {
  if (QUEST.ch !== ch.id) {
    QUEST.ch = ch.id;
    const first = it.missions.findIndex((m) => !S.miss[missKey(ch, m.id)]);
    QUEST.i = first < 0 ? 0 : first;
  }
  QUEST.min = !!S.qmin; // свёрнута ли панель — выбор ученика, общий для всех глав
  return Math.min(QUEST.i, it.missions.length - 1);
}
function questHtml(ch, it) {
  const ms = it.missions, i = questIndex(ch, it), m = ms[i];
  const ok = (x) => !!S.miss[missKey(ch, x.id)];
  const got = ms.filter(ok).length;
  // Подсказка — строка (старый формат) или { how, why }: «как сделать» и «почему так» после выполнения.
  const H = HINTS[`${it.mod.meta.id}:${m.id}`];
  const hint = H && (H.how || (typeof H === "string" ? H : ""));
  const why = H && H.why;
  const all = got === ms.length;
  const nextI = ms.findIndex((x, j) => j > i && !ok(x)) >= 0 ? ms.findIndex((x, j) => j > i && !ok(x)) : ms.findIndex((x) => !ok(x));
  // Свёрнута — маленькая кнопка в углу: сколько звёзд и какое задание; нажал — панель раскрылась.
  // Точки заданий остаются в разметке (скрыты), чтобы прогресс читался одинаково.
  const dots = `<ol class="q-dots" id="missions">${ms.map((x, j) => `<li data-m="${esc(x.id)}" class="${ok(x) ? "ok" : ""}${j === i ? " on" : ""}"><button type="button" data-qi="${j}" aria-label="Задание ${j + 1}${ok(x) ? ", выполнено" : ""}">${ok(x) ? "★" : j + 1}</button></li>`).join("")}</ol>`;
  // Задание-опыт: сначала прогноз (predict), после опыта — подтверждающий признак (confirm); звезда — за верный признак.
  const key = missKey(ch, m.id), pred = (S.pred || {})[key], ready = !ok(m) && !!(S.ready || {})[key] && m.confirm;
  const askPred = !ok(m) && m.predict && pred === undefined;
  const opts = (attr, list) => `<div class="q-opts">${list.map((o, j) => `<button type="button" class="q-opt" ${attr}="${j}" data-mid="${esc(m.id)}">${esc(o)}</button>`).join("")}</div>`;
  const ask = askPred
    ? `<div class="q-ask"><b>Сначала прогноз.</b> ${esc(m.predict.q)}${opts("data-pred", m.predict.options)}</div>`
    : ready
      ? `<div class="q-ask"><b>${esc(m.confirm.head || "Опыт получился.")}</b> ${esc(m.confirm.q)}${opts("data-conf", m.confirm.options)}${QUEST.wrong === key ? `<p class="q-wrong">Не то. ${esc(m.confirm.miss || "Посмотри на схему и показатели ещё раз.")}</p>` : ""}</div>`
      : "";
  const predLine = m.predict && pred !== undefined ? (ok(m) ? `<p class="q-how q-pred">${pred === m.predict.right ? `Твой прогноз «${esc(m.predict.options[pred])}» подтвердился.` : `Твой прогноз «${esc(m.predict.options[pred])}» не подтвердился: на опыте — «${esc(m.predict.options[m.predict.right])}».`}</p>` : `<p class="q-how q-pred">Твой прогноз: «${esc(m.predict.options[pred])}». Проверь его на опыте.</p>`) : "";
  if (QUEST.min) return `<button type="button" class="q-pill" data-qmin aria-expanded="false" title="Развернуть задания"><b>★ ${got}/${ms.length}</b>${all ? "пройдено" : `задание ${i + 1}`}<span aria-hidden="true">▴</span></button>${dots}`;
  return `<div class="q-bar"><button type="button" class="q-min" data-qmin aria-expanded="true" title="Свернуть задания">${all ? "Лаборатория пройдена ★" : `<span class="q-word">Задание </span>${i + 1} из ${ms.length}`}</button>
    ${dots}<button type="button" class="q-fold" data-qmin aria-expanded="true" aria-label="Свернуть задания" title="Свернуть">Свернуть <span aria-hidden="true">▾</span></button></div>
    ${QUEST.min ? "" : `${m.adv ? `<span class="q-adv">Расширенная диагностика · по желанию</span>` : ""}<p class="q-task">${ok(m) ? "<b class=\"q-star\">★ Готово:</b> " : ""}${esc(m.text)}</p>
    ${!ok(m) && (m.see || (m.touch && m.touch.length)) ? lookLine(it, m) : ""}
    ${ask}${askPred || ready ? "" : predLine}${!ok(m) && !askPred && !ready && m.feedback && QUEST.fb ? `<p class="q-wrong">Не здесь. ${esc(QUEST.fb)}</p>` : ""}
    ${hint && !ok(m) && !askPred && !ready ? `<details class="q-hd"${QUEST.how ?? !(typeof innerWidth === "number" && innerWidth < 600) ? " open" : ""}><summary>Как сделать</summary><p class="q-how"><b>Как:</b> ${esc(hint)}</p></details>` : ""}
    ${H && H.answer && !ok(m) && !askPred && !ready ? `<details class="q-ans"${QUEST.ans === key ? " open" : ""}><summary>Показать ответ</summary><p class="q-how"><b>Ответ:</b> ${esc(H.answer)}</p></details>` : ""}
    ${ok(m) && why ? `<p class="q-how"><b class="q-why">Почему так:</b> ${esc(why)}</p>` : ""}
    ${ok(m) && nextI >= 0 ? `<button type="button" class="q-next" data-qi="${nextI}">Следующее задание →</button>` : ""}
    ${all ? `<p class="q-how">Все задания выполнены. Можно пройти любое ещё раз — нажми его номер.</p>` : ""}`}`;
}
// «Смотри: … · Меняй: …» — названия берём из панели условий стенда.
function lookLine(it, m) {
  const ctls = (it.mod && it.mod.controls) || [];
  const names = (m.touch || []).map((t) => {
    const [id, val] = String(t).split("=");
    const c = ctls.find((x) => x.id === id);
    if (!c) return "";
    const opt = val !== undefined && c.options ? c.options.find((o) => Array.isArray(o) && String(o[0]) === val) : null;
    return opt ? `«${c.label}» → «${opt[1]}»` : `«${c.label}»`;
  }).filter(Boolean);
  return `<p class="q-look">${m.see ? `<span><b>Смотри:</b> ${esc(m.see)}</span>` : ""}${names.length ? `<span><b>Меняй:</b> ${esc(names.join(", "))}</span>` : ""}</p>`;
}
// Подсветка детали и ручки на стенде для текущего (невыполненного) задания.
function questLook(ch, it) {
  if (!it || it.kind !== "fig" || !figCtl || !figCtl.look) return;
  const m = it.missions[questIndex(ch, it)];
  const done = m && S.miss[missKey(ch, m.id)];
  figCtl.look(m && !done ? m.look || [] : [], m && !done ? m.touch || [] : []);
}
function questDraw() {
  const ch = CUR, it = ch && interactiveOf(ch), box = document.getElementById("quest");
  if (box && it) {
    box.innerHTML = questHtml(ch, it);
    box.classList.toggle("min", !!QUEST.min);
    questLook(ch, it);
  }
}
// Опыт получился, но звезда — только после верного подтверждающего признака (вопрос в панели задания).
function missionReady(ch, id) {
  const key = missKey(ch, id);
  if (!ch || S.miss[key] || S.ready[key]) return;
  const it = interactiveOf(ch);
  const i = it ? it.missions.findIndex((x) => x.id === id) : -1;
  S.ready[key] = 1;
  save();
  if (QUEST.ch === ch.id) {
    if (QUEST.i !== i) toast(`${it.missions[i] && it.missions[i].confirm && it.missions[i].confirm.head ? "Готово" : "Опыт получился"} — ответь на вопрос в задании ${i + 1}`);
    questDraw();
    const box = document.getElementById("quest");
    if (box) {
      box.classList.remove("pop");
      void box.offsetWidth;
      box.classList.add("pop");
    }
  }
  const live = document.getElementById("announce");
  if (live) live.textContent = "Опыт получился. Ответь, какой признак это подтверждает.";
}
function missionDone(ch, id) {
  const key = missKey(ch, id);
  if (!ch || S.miss[key]) return;
  const it = interactiveOf(ch);
  const m = it && it.missions.find((x) => x.id === id);
  if (!m) return;
  S.miss[key] = 1;
  save();
  const done = it.missions.filter((x) => S.miss[missKey(ch, x.id)]).length;
  const sc = document.getElementById("labscore");
  if (sc) sc.textContent = `${done} / ${it.missions.length} ★`;
  updateStars();
  // Выполнили текущее задание — панель показывает «Готово» и объяснение «Почему так» и ждёт кнопки
  // «Следующее задание»: сама не перелистывает, чтобы объяснение успели прочитать.
  const cur = it.missions[QUEST.i];
  const wasCurrent = QUEST.ch === ch.id && cur && cur.id === id;
  if (QUEST.ch === ch.id) {
    questDraw(); // свёрнутую панель не раскрываем: звёзды на кнопке, «готово» — во всплывающей подсказке
    const box = document.getElementById("quest");
    if (box) {
      box.classList.remove("pop");
      void box.offsetWidth;
      box.classList.add("pop");
    }
    clearTimeout(QUEST.t);
  }
  if (!wasCurrent || done === it.missions.length) toast(done === it.missions.length ? `Лаборатория пройдена! ★ ${done} из ${it.missions.length}` : `★ Задание ${done} из ${it.missions.length} выполнено`);
  const live = document.getElementById("announce");
  if (live) live.textContent = `Миссия выполнена: ${m.text}`;
}

// ── Экран главы ──
let figCtl = null;
let labCtl = null;
// Загадка до чтения (без «Главного») или в «Подробнее» (глава с `core`).
const riddleHtml = (ch) => (ch.riddle ? `<section class="riddle"><div class="eyebrow">Загадка</div><p class="riddle-t">${esc(ch.riddle)}</p><p class="muted small">Ответь до чтения, даже наугад. Разгадка — в конце главы.</p><textarea rows="2" id="guess" placeholder="Моя догадка…">${esc(S.guess[ch.id] || "")}</textarea></section>` : "");
// Пилот обсуждения 004: у главы с полем `core` — стенд, под ним короткое «Главное» по темам, весь прежний
// текст — в свёрнутом «Подробнее». `?pilot=a` в адресе показывает главу как раньше (вариант «до» для живого замера).
// `window.__FPV_TEST_CORE` — только для теста движка, пока текста нет в данных.
const PILOT_A = typeof location !== "undefined" && /[?&]pilot=a(&|$)/.test(location.search);
// «Схема сначала» (решение владельца 27.10): стенд — первым, «Главное» под ним свёрнуто по темам; открыт только жирный
// абзац-предупреждение (безопасность). `?pilot=b` — запасной вид: «Главное» текстом целиком, стенд после него.
const PILOT_B = typeof location !== "undefined" && /[?&]pilot=b(&|$)/.test(location.search);
function coreAccordion(core) {
  const out = [];
  for (const p of core.split(/(?=<p><b>[^<]+<\/b><\/p>)/)) {
    const m = p.match(/^<p><b>([^<]+)<\/b><\/p>([\s\S]*)$/);
    if (!m) { out.push({ html: p }); continue; }
    // Жирная строка с точкой — предупреждение, не тема: остаётся открытой, текст после неё — к предыдущей теме.
    if (/[.!]$/.test(m[1].trim())) {
      const last = out.filter((x) => x.title).pop();
      out.push({ warn: m[1] });
      if (last) last.html += m[2]; else out.push({ html: m[2] });
      continue;
    }
    out.push({ title: m[1], html: m[2] });
  }
  return out.map((x) => (x.warn ? `<p class="core-warn"><b>${x.warn}</b></p>` : x.title ? `<details class="core-topic"><summary>${x.title}</summary>${tags(x.html)}</details>` : tags(x.html))).join("");
}
function coreOf(ch) {
  if (PILOT_A) return "";
  return ch.core || (typeof window !== "undefined" && window.__FPV_TEST_CORE && window.__FPV_TEST_CORE[ch.id]) || "";
}
function chapterView(ch) {
  const ci = CHAPTERS.indexOf(ch);
  const prev = ci > 0 ? CHAPTERS[ci - 1] : null;
  const next = ci < CHAPTERS.length - 1 ? CHAPTERS[ci + 1] : APPX[0];
  const core = coreOf(ch);
  const figIndex = activeFig(ch) ? FIG_ORDER.indexOf(activeFig(ch).id) + 1 : 0;
  return `<article class="chapter" data-ch="${ch.id}">
  <div class="eyebrow">${ch.num === 20 ? "Глава 20" : `Глава ${ch.num}`} · с. ${ch.pages[0]}–${ch.pages[1]} · ${esc(ch.part)}</div>
  <h1>${esc(ch.title)}</h1>
  ${ch.fieldChecklist && ch.fieldChecklist.length ? `<div class="ch-fast-nav"><a href="#field-card" class="field-card-jump" role="button">📋 Чеклист на поле</a></div>` : ""}
  ${ch.here && ch.here.length ? hereStrip(ch) : ""}
  ${ch.lead ? `<p class="lead">${tags(ch.lead)}</p>` : ""}
  ${core ? "" : riddleHtml(ch)}
  ${ch.goals ? `<div class="goals"><div><div class="eyebrow">После главы ты сможешь</div><ul>${ch.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>${ch.words ? `<div><div class="eyebrow">Новые слова</div><p class="words">${ch.words.map((w) => `<span class="word" tabindex="0" title="${esc(glossaryOf(w))}">${esc(w)}</span>`).join("")}</p></div>` : ""}</div>` : ""}
  ${core ? `${!PILOT_B ? `${interactiveHtml(ch)}<section class="core core-acc" id="core"><div class="eyebrow">Главное — коснись темы</div>${coreAccordion(core)}</section>` : `<section class="core" id="core"><div class="eyebrow">Главное</div>${tags(core)}</section>${interactiveHtml(ch)}`}<details class="more" id="more"><summary>Подробнее: весь текст главы</summary>${riddleHtml(ch)}` : ch.standAfter === undefined ? interactiveHtml(ch) : ""}
  ${ch.calc === "scale" ? scaleCalc() : ""}
  ${(ch.sections || []).map((sec, i) => sectionHtml(sec) + (!core && ch.standAfter === i ? interactiveHtml(ch) : "")).join("")}
  ${ch.corrections ? `<p class="lab-note"><b>Уточнение лаборатории.</b> ${esc(ch.corrections.replace(/^Уточнение( лаборатории)?: /, ""))}</p>` : ""}
  ${ch.answer ? `<section class="solution"><div class="eyebrow">Разгадка</div><p class="muted small" id="myguess">${S.guess[ch.id] ? `Твоя догадка: «${esc(S.guess[ch.id])}»` : "Ты не записал догадку — ничего страшного."}</p><button type="button" class="ghost" id="reveal" aria-expanded="false">Открыть разгадку</button><p class="answer" hidden>${esc(ch.answer)}</p></section>` : ""}
  ${core ? "</details>" : ""}
  ${ch.summary ? `<section class="summary"><div class="eyebrow">Итог</div><p>${esc(ch.summary)}</p></section>` : ""}
  ${ch.fieldChecklist && ch.fieldChecklist.length ? `
  <section class="field-card" id="field-card" aria-label="Чеклист пилота на поле">
    <div class="field-card-h">
      <span class="field-card-badge">В поле</span>
      <h3>Чеклист пилота на поле</h3>
    </div>
    <ul class="field-card-list">
      ${ch.fieldChecklist.map((it) => `
        <li class="field-card-item">
          <span class="field-card-icon" aria-hidden="true">${esc(it.icon)}</span>
          <span class="field-card-rule">${tags(it.rule)}</span>
        </li>
      `).join("")}
    </ul>
  </section>` : ""}
  ${questionsHtml(ch)}
  ${repeatHtml(ch)}
  ${extraHtml(ch)}
  <div class="ch-actions"><button type="button" id="markdone" aria-pressed="${!!S.done[ch.id]}">${S.done[ch.id] ? "✓ Глава изучена" : "Отметить главу изученной"}</button></div>
  ${sourceHtml(ch.id)}
  <nav class="pager">${prev ? `<a href="#${prev.id}">← ${prev.num}. ${esc(prev.title)}</a>` : `<a href="#start">← Как пользоваться книгой</a>`}<a href="#${next.id}">${next.num !== undefined ? `${next.num}. ` : `${next.id}. `}${esc(next.title)} →</a></nav>
  </article>`;
}
// Формулы «по-школьному» и опыт лаборатории методов — не на пути ученика: после итога и вопросов, свёрнуто.
function extraHtml(ch) {
  const inner = kidHtml(ch) + methodsInline(ch);
  return inner ? `<details class="extra" id="extra"><summary>Физика: откуда это <span class="muted">(по желанию)</span></summary>${inner}</details>` : "";
}
function scaleCalc() {
  return `<section class="calc"><div class="eyebrow">Счётная линейка масштаба</div><div class="calc-row"><label>Масштаб 1 : <input type="number" id="sc-m" value="50000" step="1000" min="1000"></label><label>На карте, см <input type="number" id="sc-cm" value="2" step="0.5" min="0"></label><output id="sc-out"></output></div><p class="muted small">1 см на карте = масштаб ÷ 100 метров. Ветер называют по тому, <b>откуда</b> он дует.</p></section>`;
}

function startView() {
  const total = CHAPTERS.length;
  const done = CHAPTERS.filter((c) => S.done[c.id]).length;
  const all = CHAPTERS.reduce((a, c) => a + (c.questions || []).length, 0);
  const graded = CHAPTERS.reduce((a, c) => a + (c.questions || []).filter((_, i) => S.grade[`${c.id}:${i}`] !== undefined).length, 0);
  return `<article class="chapter start">
  <div class="eyebrow">Перед стартом · по книге «FPV-дрон: понять, а не зазубрить» · редакция 7</div>
  <h1>Дрон по частям. Книга по главам.</h1>
  <div class="mx-hero"><span class="mx-hero-glow"></span><small>Опыты «формула книги против точной модели»</small><b>Они живут внутри глав</b><span>Волна огибает холм, PID держит угол на ветру, батарея садится на морозе. Каждый опыт стоит в своей главе, сразу после стенда.</span><span class="mx-hero-links">${EXPERIMENTS.map((e) => { const h = CHAPTERS.find((c) => c.id === homeChapter(e)); return `<a href="#lab-${e.id}">гл. ${h ? h.num : ""} · ${esc(e.title)}</a>`; }).join("")}</span></div>
  <p class="lead">Учебник для подготовки к экзамену оператора FPV. Здесь объясняется, почему дрон ведёт себя так, а не иначе: когда понятна причина, ответ не нужно зубрить — его можно вывести. Каждая глава построена вокруг вопросов, а рядом стоит стенд, на котором механизм можно покрутить руками.</p>
  <div class="stats"><div><b>${done} / ${total}</b><span>глав изучено</span></div><div><b>${graded} / ${all}</b><span>вопросов с самооценкой</span></div><div><b>${dueList().length}</b><span>повторений на сегодня</span></div><div><b id="stars2">★ ${starsTotal().got} / ${starsTotal().all}</b><span>звёзд за миссии</span></div></div>
  <section class="sec"><div class="sec-h"><h3>Как устроена каждая глава</h3></div><ol><li><b>«Вы здесь»</b>: полоска подсистем показывает, о какой части дрона глава.</li><li><b>Загадка.</b> Ответь до чтения, даже наугад, и запиши догадку. Разгадка — в конце главы.</li><li><b>Цели и новые слова.</b> Наведи на слово — появится определение из глоссария.</li><li><b>Физика по-школьному.</b> Законы главы: формула, что значит каждая буква, пример на числах, что это значит для дрона и вопрос «проверь себя».</li><li><b>Лаборатория.</b> Своя интерактивная схема в каждой главе и 4 задания со звёздами. Текущее задание и подсказка «как сделать» — в панели внизу экрана; задание засчитывается само, когда ты добился нужного результата.</li><li><b>Объяснение</b> с аналогиями (и строкой «где ломается»), выводами и ловушками.</li><li><b>Конец главы</b>: разгадка, итог в трёх строках, «Проверь себя» с ответами из Приложения Е.</li></ol></section>
  <section class="sec"><div class="sec-h"><h3>Что учить в первую очередь</h3></div><p><span class="prio" data-prio="1">① главное</span> учи в первую очередь: это нужно на срезе и в поле. <span class="prio" data-prio="2">② понимание</span> объясняет, почему так, и помогает вывести ответ. <span class="prio" data-prio="3">③ любопытным</span> свёрнуто — открой, если интересно. Формулы и опыты «откуда это» — в конце главы, в блоке «Физика: откуда это (по желанию)».</p><p><b>Быстрый проход</b> (переключатель в шапке): только разделы ① и концы глав. Это займёт вечер.</p></section>
  <section class="sec"><div class="sec-h"><h3>Цветные блоки</h3></div><div class="legend-blocks">${Object.entries(BLOCK).filter(([k]) => k !== "note").map(([k, v]) => `<aside class="blk" data-type="${k}"><div class="blk-h">${v}</div><p>${{ key: "Главная мысль главы.", analogy: "Знакомая вещь, похожая на механизм. Внизу — «где ломается»: где сходство заканчивается.", follows: "Только то, что выводится из объяснения выше. Закрой ладонью и выведи сам.", remember: "Факты, которые не выводятся, а просто есть: названия, числа, пункты меню.", trap: "Типичная ошибка на экзамене и в работе.", exam: "Где ключ теста расходится с физикой или документацией. Подробности — в Приложении Д.", safety: "Где ошибка может кого-то ранить или что-то сжечь.", myth: "Популярное заблуждение и почему оно неверно." }[k]}</p></aside>`).join("")}</div>
  <p>Метки у чисел: <span class="tag" data-tag="закон">закон</span> верно всегда · <span class="tag" data-tag="оценка">оценка</span> прикидка по паспортным числам или упрощённой модели · <span class="tag" data-tag="версия">зависит от версии</span> сверяй со своей прошивкой · <span class="tag" data-tag="пример">пример</span> условные числа.</p></section>
  <section class="sec"><div class="sec-h"><h3>Как учиться по книге</h3></div><p>Прочитал главу — закрой её, ответь на «Проверь себя» и оцени себя (2 — объяснил почему, 1 — верно без объяснения, 0 — неверно). Повтори через 1 день, через 3–4 дня и за неделю до экзамена; укажи дату экзамена слева — график посчитается сам. Глава 20 — всё вперемешку. Самопроверка и интервальное повторение — самые надёжные из изученных техник учёбы [19].</p></section>
  <aside class="blk" data-type="safety"><div class="blk-h">Граница книги</div><p>Книга даёт понимание. Она не заменяет инструктора, документацию оборудования и правила курса. Практику (пайку, подключение батареи, первые включения, полёты) начинай только под контролем преподавателя. Остановить занятие при неисправности — правильное решение, а не слабость.</p></aside>
  <section class="sec"><div class="sec-h"><h3>Лаборатории глав</h3></div><div class="fig-index">${CHAPTERS.map((c) => { const it = interactiveOf(c); if (!it) return ""; const ms = allMissionsOf(c); const got = ms.filter((m) => S.miss[missKey(c, m.id)]).length; const title = figsOf(c).length > 1 ? figsOf(c).map((f) => tabMod(f).meta.title).join(" · ") : it.title; return `<a class="lab-link" href="#${c.id}"><b>${c.num}. ${esc(title)}</b><span>${got} / ${ms.length} ★</span></a>`; }).join("")}</div></section>
  <nav class="pager"><span></span><a href="#0">0. Азбука: слова и единицы →</a></nav>
  </article>`;
}

function appendixView(a) {
  let body = "";
  if (a.id === "А") body = `<input type="search" id="gsearch" placeholder="Найти термин…" aria-label="Поиск по глоссарию"><dl class="gloss" id="gloss">${GLOSSARY.map(([t, d, c]) => `<div data-g="${esc((t + " " + d).toLowerCase())}"><dt>${esc(t)}</dt><dd>${esc(d)} <a href="#${c}">→ ${/^\d+$/.test(c) ? "гл. " + c : "Прил. " + c}</a></dd></div>`).join("")}</dl>`;
  if (a.id === "Б") body = tags(REFTABLES);
  if (a.id === "В") body = `<p class="muted">Пути меню зависят от версии прошивки пульта и модулей. Сверяй с оборудованием курса. <span class="tag" data-tag="версия">зависит от версии</span></p>${PROCEDURES.map((p) => `<section class="sec"><h3>${esc(p.title)}</h3><ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("")}`;
  if (a.id === "Г") body = `<table class="t cli">${CLI.map(([c, d]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(d)}</td></tr>`).join("")}</table><p>Восстановить настройки: вставить сохранённый вывод <code>diff all</code> в CLI и выполнить <code>save</code>. После переноса на другой борт обязательно проверить моторы и режимы.</p>`;
  if (a.id === "Д") {
    const verdicts = ["Все", "Неверно", "Частный случай", "Уточнить", "Верно", "Устарело"];
    body = `<p>Где материалы курса расходятся между собой или с документацией. Вердикт — верно ли утверждение; опора — насколько надёжно подтверждено: <b>П</b> первичный документ, <b>В</b> вторичный обзор, <b>Т</b> теория или проверка размерности, <b>К</b> только материалы курса. Если ключ требует спорный ответ, записывай: «в материале курса — X; подтверждённое объяснение — Y [n]; вопрос преподавателю — Z». Ошибку ключа не переносить в практику. Большая часть записей — неточности самого текста книги (пометка «книга»): в главах и на стендах они уже исправлены, а исходные страницы книги оставлены как есть.</p><div class="filters" role="group" aria-label="Фильтр по вердикту">${verdicts.map((v, i) => `<button type="button" data-vf="${esc(v)}" aria-pressed="${i === 0}">${esc(v)}</button>`).join("")}</div><input type="search" id="dsearch" placeholder="Поиск по журналу…" aria-label="Поиск по журналу"><table class="t corr" id="corr"><tr><th>Утверждение в материалах</th><th>Как правильно</th><th>Вердикт</th><th>Опора</th></tr>${CORRECTIONS.map(([a1, b, c, d]) => `<tr data-v="${esc(c)}" data-s="${esc((a1 + " " + b).toLowerCase())}"><td>${esc(a1)}</td><td>${esc(b)}</td><td><span class="verdict" data-verdict="${esc(c.split(/[;(]/)[0].trim())}">${esc(c)}</span></td><td>${esc(d)}</td></tr>`).join("")}</table>`;
  }
  if (a.id === "Е") body = CHAPTERS.filter((c) => (c.questions || []).length).map((c) => `<section class="sec"><h3><a href="#${c.id}">Глава ${c.num}. ${esc(c.title)}</a></h3><ol>${c.questions.map((q) => `<li><p class="q-t">${q.q}</p><p class="muted">${q.a}</p></li>`).join("")}</ol></section>`).join("");
  if (a.id === "Ж") body = `<p>Номер в квадратных скобках в тексте ведёт сюда. Тип: П — первичный документ, В — вторичный обзор. Материалы курса использованы как исходный текст и формулировки ключа; их утверждения не считаются независимо подтверждёнными.</p><table class="t">${SOURCES.map(([n, t, s, w]) => `<tr><td>[${n}]</td><td>${t}</td><td>${esc(s)}</td><td class="muted">${esc(w)}</td></tr>`).join("")}</table>`;
  if (a.id === "З") body = `<p>Самые быстро меняющиеся вещи — прошивки. Перед любым обновлением запиши версии всего комплекта и сделай резервную копию.</p><table class="t"><tr><th>Что</th><th>Что изменилось</th><th>Что из этого следует</th></tr>${VERSIONS.map(([a1, b, c]) => `<tr><td>${esc(a1)}</td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</table><section class="sec"><h3>Безопасное обновление прошивки</h3><ol><li>CLI → diff all → сохранить в файл. Записать версии: полётник, ESC, приёмник, передатчик, пульт, очки.</li><li>Обновлять по одной системе за раз, по инструкции этой версии.</li><li>После обновления — проверка на стенде без пропеллеров: каналы, режимы, моторы, Failsafe.</li><li>Что-то не так — откат: прежняя версия, сохранённый diff all, save, снова проверка.</li></ol></section>`;
  if (a.id === "И") body = srezHtml();
  const ai = APPX.indexOf(a);
  const prev = ai > 0 ? APPX[ai - 1] : CHAPTERS[CHAPTERS.length - 1];
  const next = ai < APPX.length - 1 ? APPX[ai + 1] : null;
  return `<article class="chapter appx"><div class="eyebrow">Приложение ${a.id} · ${a.pages ? `с. ${a.pages[0]}–${a.pages[1]}` : "опросник курса"}</div><h1>${esc(a.title)}</h1>${body}${sourceHtml(a.id)}<nav class="pager"><a href="#${prev.id}">← ${prev.num !== undefined ? prev.num : prev.id}. ${esc(prev.title)}</a>${next ? `<a href="#${next.id}">${next.id}. ${esc(next.title)} →</a>` : "<span></span>"}</nav></article>`;
}

// ── Вопросы среза (docs/content/srez.json) и где учебник их объясняет (srez-coverage.json) ──
const srezList = (a) => (Array.isArray(a) ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>${esc(a)}</p>`);
const srezBlk = (type, title, text) => (text ? `<aside class="blk" data-type="${type}"><div class="blk-h">${title}</div><p>${esc(text)}</p></aside>` : "");
function srezGo(cv) {
  const ch = cv && cv.ch != null ? CHAPTERS.find((c) => c.id === String(cv.ch)) : null;
  if (cv && cv.fix) return srezBlk("trap", "Учебник уточняет", cv.fix) + (ch ? `<p class="small">Подробнее: <a href="#${ch.id}" data-srz-sec="${esc(cv.sec || "")}">глава ${ch.num}${cv.sec ? ` · «${esc(cv.sec)}»` : ""}</a></p>` : "");
  if (!ch || !["full", "partial"].includes(cv.status)) return `<p class="muted small">В главах подробного разбора пока нет — ответ выше из опросника.</p>`;
  const where = cv.sec === "#check" ? "«Проверь себя»" : cv.sec ? `«${esc(cv.sec)}»` : "";
  return `<p class="small">${cv.status === "full" ? "Объяснение" : "Частично объяснено"}: <a href="#${ch.id}" data-srz-sec="${esc(cv.sec || "")}">глава ${ch.num}${where ? ` · ${where}` : ""}</a></p>`;
}
function srezHtml() {
  const cov = new Map(SREZ_COV.items.map((c) => [String(c.n), c]));
  const inCat = (it, c) => it.c === c || it.also === c;
  const explained = SREZ.items.filter((it) => ["full", "partial"].includes(cov.get(String(it.n))?.status)).length;
  const item = (it) => {
    const cv = cov.get(String(it.n));
    const num = typeof it.n === "number" ? `№${it.n}` : it.n;
    return `<details class="srz" data-c="${esc([it.c, it.also].filter(Boolean).join(" "))}" data-s="${esc((num + " " + it.q + " " + [].concat(it.a).join(" ")).toLowerCase())}"><summary><span class="srz-n">${esc(num)}</span> ${esc(it.q)}</summary>
    <div class="srz-a"><div class="eyebrow">${it.own ? "Ответ инструктора" : "Ответ как в таблице"}</div>${srezList(it.a)}${srezBlk("note", "Уточнение", it.note)}${it.unsure ? `<p class="muted small">${esc(it.unsure)}</p>` : ""}${srezBlk("analogy", "На пальцах", it.simple)}${srezBlk("remember", "Запомни", it.mem)}${srezBlk(inCat(it, "safe") ? "safety" : "follows", "Что делать", it.todo)}${srezGo(cv)}</div></details>`;
  };
  return `<div class="srz-modes" role="tablist" aria-label="Режимы страницы">
    <button type="button" class="lab-btn" id="srz-mode-catalog" aria-pressed="true">📖 Каталог вопросов (${SREZ.items.length})</button>
    <button type="button" class="lab-btn" id="srz-mode-exam" aria-pressed="false">🎯 Пробный срез (20 вопросов)</button>
  </div>
  <div id="srz-catalog-view">
    <p>Все вопросы опросника курса: ${SREZ.items.length} (номера из таблицы «вопросы для контроля», ситуации С и теория Т от инструктора). Сначала ответь сам, потом открой ответ. Ссылка под ответом ведёт в главу, где это объяснено подробно. Объяснено в главах: <b>${explained} из ${SREZ.items.length}</b>.</p>
    <div class="filters" role="group" aria-label="Темы"><button type="button" data-srzc="" aria-pressed="true">Все</button>${SREZ.cats.map(([id, t]) => `<button type="button" data-srzc="${esc(id)}" aria-pressed="false">${esc(t)} · ${SREZ.items.filter((it) => inCat(it, id)).length}</button>`).join("")}</div>
    <input type="search" id="srzq" placeholder="Поиск по вопросам…" aria-label="Поиск по вопросам среза">
    <div id="srz">${SREZ.cats.map(([id, t]) => `<section class="sec" data-srzsec="${esc(id)}"><div class="sec-h"><h3>${esc(t)}</h3></div>${SREZ.items.filter((it) => it.c === id).map(item).join("")}</section>`).join("")}</div>
  </div>
  <div id="srz-exam-view" hidden>
    <div id="srz-exam-box"></div>
  </div>`;
}

// ── Лаборатория методов: одна сцена — несколько способов посчитать ──
let mxCtl = null;
const plural = (n, one, few, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;
function statusCounts(e) {
  const c = {};
  for (const m of e.methods) c[m.review?.status || "review"] = (c[m.review?.status || "review"] || 0) + 1;
  return Object.entries(c).map(([k, n]) => `<span class="mx-badge ${STATUS[k].cls}" title="${esc(STATUS[k].label)}">${STATUS[k].icon} ${n}</span>`).join("");
}
function labHomeView() {
  return `<article class="chapter mx-home">
  <div class="eyebrow">Лаборатория методов</div>
  <h1>Одна сцена — несколько способов посчитать</h1>
  <p class="lead">Здесь формулы книги соревнуются с настоящей физикой. Выбери сцену, покрути условия и включи несколько методов сразу: увидишь, где простая формула из книги работает отлично, а где её граница. Рядом с каждым методом — уравнение с твоими числами, код, который это посчитал, цитата из книги с номером страницы и вердикт проверки.</p>
  <ol class="mx-steps"><li><b>Сцена</b><span>готовый набор условий: поле, лес, мороз, гонка</span></li><li><b>Условия</b><span>ползунки: расстояние, частота, ветер, ёмкость</span></li><li><b>Методы</b><span>одни и те же входные данные — разные способы расчёта</span></li><li><b>Сверка</b><span>каждый метод проверен по книге и физике</span></li></ol>
  <div class="mx-cards">${EXPERIMENTS.map((e) => `<a class="mx-card" href="#lab-${e.id}" style="--mx-accent:${e.accent}"><span class="mx-card-glow"></span><small>${esc(e.chapters)}</small><b>${esc(e.title)}</b><span class="mx-card-lead">${plural(e.methods.length, "метод", "метода", "методов")}: ${e.methods.map((m) => esc(m.name)).join(" · ")}</span><span class="mx-card-st">${statusCounts(e)}</span></a>`).join("")}</div>
  <section class="sec"><div class="sec-h"><h3>Что значат значки сверки</h3></div><ul class="mx-legend-st">${Object.values(STATUS).map((s) => `<li><span class="mx-badge ${s.cls}">${s.icon}</span> <b>${esc(s.label)}</b> — ${{ ok: "формула и числа те же, что в книге", warn: "книга объясняет словами; метод добавляет пороги и коэффициенты из практики", info: "метода нет в книге: это модель глубже, она показывает границы простых формул", bad: "рецензент сомневается — смотри заметку" }[s.cls]}</li>`).join("")}</ul></section>
  <section class="sec"><div class="sec-h"><h3>Как это собрано</h3></div><p>Методы и числа взяты из страниц книги (номер страницы — у каждой цитаты, скан страницы открывается кнопкой). Каждый эксперимент написан по общей спецификации: все методы получают одни и те же входные данные, поэтому их можно честно сравнить. Затем реализации сверены с книгой и физикой; где метод выходит за книгу или расходится с ней — это помечено. Численные модели проверены тестами: в «Сверке» указано, с чем и насколько совпало.</p></section>
  </article>`;
}
// Основная глава опыта — первая в списке; в других главах темы — ссылка на него.
const homeChapter = (e) => e.chapterIds[0];
function methodsInline(ch) {
  const own = EXPERIMENTS.find((e) => homeChapter(e) === ch.id);
  const others = EXPERIMENTS.filter((e) => e !== own && e.chapterIds.includes(ch.id));
  const links = others.length
    ? `<aside class="mx-callout">${others.map((e) => { const h = CHAPTERS.find((c) => c.id === homeChapter(e)); return `<a href="#lab-${e.id}" style="--mx-accent:${e.accent}"><span>⚗ Опыт по этой теме — в главе ${h ? h.num : homeChapter(e)}</span><b>${esc(e.title)}</b><small>Формула книги против точной модели</small></a>`; }).join("")}</aside>`
    : "";
  if (!own) return links;
  const ref = own.methods.length;
  return `<section class="mx-inline" id="mxsec" style="--mx-accent:${own.accent}">
    <div class="mx-intro"><div class="eyebrow">Проверь формулу книги</div>
      <p>Одно явление посчитано ${plural(ref, "способом", "способами", "способами")}: от формулы книги до точной модели. Выбери сцену, двигай условия и смотри колонку «Разница» — где формула книги перестаёт работать. ✓ — как в книге, ≈ — упрощение, ↗ — физика глубже книги. Нажми на имя способа — появятся уравнение, код и страница книги.</p>
    </div>
    <div id="mx"></div>
  </section>${links}`;
}

// ── Маршрутизация и привязка событий ──
function current() {
  let id = location.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch (e) {} // битая ссылка (#%) не должна ронять книгу
  return id || S.last || "start";
}
function render() {
  // Полноэкранный режим старой страницы не должен блокировать прокрутку новой.
  document.body.classList.remove("noscroll");
  let id = current();
  // Старые ссылки на опыт (#lab-waves) открывают его главу прямо на опыте.
  const linked = id.startsWith("lab-") ? EXPERIMENTS.find((e) => `lab-${e.id}` === id) : null;
  if (linked) {
    id = homeChapter(linked);
    try {
      history.replaceState(null, "", "#" + id);
    } catch (e) {}
  }
  const ch = CHAPTERS.find((c) => c.id === id);
  const a = APPX.find((x) => x.id === id);
  const isLab = id === "lab";
  const view = ch ? chapterView(ch) : a ? appendixView(a) : isLab ? labHomeView() : startView();
  S.last = ch || a || isLab ? id : "start";
  save();
  $("#toc").innerHTML = tocHtml(S.last);
  $("#chsel").value = isLab ? "start" : S.last;
  $("#main").innerHTML = view;
  mountNotes($("#main"));
  if (mxCtl) mxCtl.destroy();
  mxCtl = null;
  const exp = ch ? EXPERIMENTS.find((e) => homeChapter(e) === ch.id) : null;
  if (exp && $("#mx")) {
    // Опыт лежит в свёрнутом блоке: запускаем его, когда блок открыт (в скрытом блоке у сцены нулевой размер).
    const mountMx = () => {
      if (mxCtl || !$("#mx")) return;
      try {
        mxCtl = mountExperiment($("#mx"), exp, { book: BOOK, images, zoomer: attachZoom });
      } catch (e) {
        $("#mx").innerHTML = `<p class="muted">Опыт не запустился: ${esc(e.message)}</p>`;
      }
    };
    const extra = $("#extra");
    if (linked && extra) extra.open = true;
    if (!extra || extra.open) mountMx();
    else extra.addEventListener("toggle", () => extra.open && mountMx());
    if (linked) requestAnimationFrame(() => $("#mxsec") && $("#mxsec").scrollIntoView({ block: "start" }));
  }
  document.body.toggleAttribute("data-fast", !!S.fast);
  figCtl = null;
  if (labCtl && labCtl.destroy) labCtl.destroy();
  labCtl = null;
  const it = ch ? interactiveOf(ch) : null;
  if (it && it.kind === "fig") {
    const fig = it.mod;
    let lastCheck = 0, lastCtl = null, lastState = null;
    // Миссии стенда проверяются по кадрам и сразу после действия ученика (стенд может быть за краем экрана).
    const checkMissions = () => {
      if (!lastCtl || CUR !== ch) return;
      const facts = lastCtl.facts ? lastCtl.facts() : {};
      // Задание не засчитывается по испорченной модели: любое нечисловое значение (NaN, бесконечность) — пропуск.
      const finite = (v) => (typeof v === "number" ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === "object" ? Object.values(v).every(finite) : true);
      if (!finite(facts)) return;
      // Подсказка при неверной детали — в панели текущего задания (меняется — перерисовываем панель).
      const cur = it.missions[QUEST.i];
      const fb = cur && cur.feedback && !S.miss[missKey(ch, cur.id)] && !S.ready[missKey(ch, cur.id)] ? cur.feedback(facts, lastState) : "";
      if (fb !== (QUEST.fb || "")) {
        QUEST.fb = fb;
        questDraw();
      }
      for (const m of it.missions) {
        const key = missKey(ch, m.id);
        if (S.miss[key] || S.ready[key] || !m.check) continue;
        if (m.predict && S.pred[key] === undefined) continue; // опыт засчитывается только после прогноза
        if (m.check(facts, lastState)) m.confirm ? missionReady(ch, m.id) : missionDone(ch, m.id);
      }
    };
    figCtl = mountFigure($("#fig"), fig, {
      number: ch.num,
      preset: activeFig(ch).preset,
      sidebar: $("#side"),
      metricsEl: $("#metrics"),
      note: $("#fignote"),
      infoEl: $("#figinfo"),
      intro: (INTROS[fig.meta.id] || {}).what || "",
      onChange: () => setTimeout(checkMissions, 150),
      onFrame: (ctl, state, byUser) => {
        lastCtl = ctl;
        lastState = state;
        const now = performance.now();
        if (!byUser || now - lastCheck < 250) return;
        lastCheck = now;
        checkMissions();
      },
    });
    questLook(ch, it);
  }
  if (it && it.kind === "lab") {
    try {
      labCtl = it.mod.mount($("#labroot"), { done: (id) => missionDone(ch, id), chapter: ch });
      const lr = $("#labroot");
      // Одна схема в начале — на широком экране она встаёт слева и прилипает, управление справа.
      if (lr.querySelectorAll(".lab-stage").length === 1 && lr.firstElementChild && lr.firstElementChild.classList.contains("lab-stage")) lr.classList.add("split");
      // Каждую схему лаборатории можно увеличивать: два пальца, двойное касание, кнопки +/−.
      lr.querySelectorAll(".lab-stage").forEach((st) => attachZoom(st, () => st.querySelector("svg"), { maxH: 0.6, bar: true }));
    } catch (e) {
      $("#labroot").innerHTML = `<p class="muted">Лаборатория не запустилась: ${esc(e.message)}</p>`;
    }
  }
  updateStars();
  CUR = ch || null;
  bind(ch, a);
  requestAnimationFrame(watchSticky);
  const title = ch ? `${ch.num}. ${ch.title}` : a ? `${a.id}. ${a.title}` : exp ? `Лаборатория методов · ${exp.title}` : isLab ? "Лаборатория методов" : "Как пользоваться книгой";
  document.title = `FPV Anatomy · ${title}`;
  // Ссылка «Объяснение» из вопросов среза открывает главу сразу на нужном разделе.
  const secEl = !ch || !render.sec ? null : render.sec === "#check" ? $("#check") : $$("#main section.sec").find((s) => s.querySelector("h3")?.textContent === render.sec);
  render.sec = null;
  for (let el = secEl && secEl.parentElement; el; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true;
  if (secEl) secEl.scrollIntoView({ block: "start" });
  else if (render.keepLab && document.getElementById("labcard")) document.getElementById("labcard").scrollIntoView({ block: "start" });
  else if (!render.first) window.scrollTo(0, 0);
  render.keepLab = false;
  render.first = false;
}
render.first = true;

let CUR = null;
// Липкие схемы: схема прилипает к верху, только если под ней остаётся место для управления.
// Иначе кнопки проезжали бы под схемой. У стенда со стиками рисунок ужимается, чтобы сцена и пульт
// были на одном экране: иначе стики ниже сгиба, а при прокрутке к ним сцена уезжает.
const STICKY = ".workspace #fig, .labroot > .lab-stage:first-child, .mx-stage";
const ROOM = 200; // столько пикселей экрана оставляем под ползунки и кнопки
const STICK_GAP = 16;
const STICK_MIN = 150; // ниже рисунок уже не разобрать
let stickyRO = null;
function dockTop() {
  const card = document.getElementById("labcard");
  if (card && card.classList.contains("full")) return 0;
  const bar = document.querySelector(".top");
  if (!bar || getComputedStyle(bar).position !== "sticky") return 0;
  return Math.ceil(bar.getBoundingClientRect().height);
}
// Возвращает true, если это стенд со стиками: липкость решает он сам, общий порог ROOM не применяем.
function fitStickScene(fig) {
  const ws = fig.closest(".workspace");
  const sticks = ws && ws.querySelector(".ctl-sticks");
  const svg = fig.querySelector(".iso-svg");
  if (!ws || !sticks || !svg) return false;
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return false;
  const vh = (window.visualViewport && window.visualViewport.height) || innerHeight;
  const top = dockTop();
  const stickH = Math.ceil(sticks.getBoundingClientRect().height) || 160;
  const figR = fig.getBoundingClientRect();
  const svgR = svg.getBoundingClientRect();
  const chrome = Math.max(36, Math.round(figR.height - svgR.height));
  const maxSvg = Math.floor(vh - top - stickH - chrome - STICK_GAP);
  const stage = svg.closest(".iso-stage");
  const maxW = Math.max(120, (stage ? stage.clientWidth : fig.clientWidth) || 120);
  const ratio = vb.height / vb.width;
  let w = maxW;
  let h = w * ratio;
  const fits = maxSvg >= STICK_MIN;
  if (h > maxSvg) {
    h = Math.max(STICK_MIN, maxSvg);
    w = h / ratio;
  }
  h = Math.round(h);
  w = Math.round(Math.min(w, maxW));
  const prevH = parseFloat(svg.style.height) || 0;
  if (Math.abs(prevH - h) > 2) {
    svg.style.height = h + "px";
    svg.style.width = w + "px";
    svg.style.maxWidth = "100%";
  }
  const figH = chrome + h;
  const sticksTop = top + figH;
  const curTop = parseFloat(ws.style.getPropertyValue("--sticks-top")) || 0;
  if (Math.abs(curTop - sticksTop) > 2) {
    ws.style.setProperty("--dock-top", top + "px");
    ws.style.setProperty("--sticks-top", sticksTop + "px");
  }
  // Влезает — сцена и стики липнут вместе. Не влезает даже минимальный рисунок — не запираем пульт под схемой.
  fig.classList.toggle("nosticky", !fits);
  ws.classList.toggle("stick-dock", fits);
  return true;
}
function fitSticky() {
  const vh = (window.visualViewport && window.visualViewport.height) || innerHeight;
  const quest = document.getElementById("quest");
  // На телефоне панель задания стоит в общем потоке над стендом (не прилипает) — её высоту не учитываем.
  const questFlow = !!(quest && quest.closest("#labcard[data-kind='fig']") && innerWidth <= 700);
  if (quest) quest.style.maxHeight = questFlow ? "" : Math.round(vh * 0.34) + "px";
  const qh = quest && !questFlow ? quest.getBoundingClientRect().height : 0;
  for (const el of document.querySelectorAll(STICKY)) {
    // nosticky, поставленный самой лабораторией (например, карта), не трогаем
    if (el.dataset.ownNs === undefined) el.dataset.ownNs = el.classList.contains("nosticky") ? "1" : "";
    if (el.dataset.ownNs) continue;
    if (el.id === "fig" && fitStickScene(el)) continue;
    // Панель задания прилипает к низу: в лаборатории — всегда, у стенда главы — на телефоне (пульт там под стендом).
    const inLab = el.closest("#labcard") || (el.id === "fig" && innerWidth <= 700);
    const h = el.getBoundingClientRect().height;
    el.classList.toggle("nosticky", h + (inLab ? qh : 0) + ROOM > vh);
  }
}
function watchSticky() {
  if (stickyRO) stickyRO.disconnect();
  fitSticky();
  if (typeof ResizeObserver !== "function") return;
  let raf = 0;
  stickyRO = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fitSticky);
  });
  document.querySelectorAll(`${STICKY}, #quest`).forEach((el) => stickyRO.observe(el));
}
window.addEventListener("resize", () => requestAnimationFrame(fitSticky));
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => requestAnimationFrame(fitSticky));
function bindOnce() {
  const main = $("#main");
  main.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.ans) {
      S.ans[t.dataset.ans] = t.value;
      save();
    }
  });
  // «Как сделать» в панели задания: на телефоне свёрнуто, чтобы панель не закрывала пульт; выбор запоминаем.
  main.addEventListener("toggle", (e) => {
    if (e.target.classList && e.target.classList.contains("q-hd")) QUEST.how = e.target.open;
    // «Показать ответ» остаётся открытым, пока панель перерисовывается (например, при подсказке «Не здесь»).
    if (e.target.classList && e.target.classList.contains("q-ans") && CUR) {
      const it = interactiveOf(CUR), m = it && it.missions[QUEST.i];
      QUEST.ans = e.target.open && m ? missKey(CUR, m.id) : null;
    }
  }, true);
  main.addEventListener("click", (e) => {
    const jmp = e.target.closest(".field-card-jump");
    if (jmp) {
      e.preventDefault();
      const card = $("#field-card");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const ch = CUR;
    // Вкладка стенда главы: перерисовываем главу и остаёмся у лаборатории.
    const ft = e.target.closest("[data-figtab]");
    if (ft && ch) {
      if (activeFig(ch) && tabKey(activeFig(ch)) === ft.dataset.figtab) return;
      S.figTab = { ...(S.figTab || {}), [ch.id]: ft.dataset.figtab };
      QUEST.ch = "";
      render.keepLab = true;
      render();
      return;
    }
    const qi = e.target.closest("[data-qi]");
    if (qi && ch) {
      clearTimeout(QUEST.t);
      QUEST.i = Number(qi.dataset.qi);
      QUEST.min = false;
      questDraw();
      return;
    }
    // Прогноз перед опытом и подтверждающий признак после него.
    const pr = e.target.closest("[data-pred]"), cf = e.target.closest("[data-conf]");
    if ((pr || cf) && ch) {
      const it = interactiveOf(ch), b = pr || cf;
      const m = it && it.missions.find((x) => x.id === b.dataset.mid);
      if (!m) return;
      const key = missKey(ch, m.id), v = Number(pr ? pr.dataset.pred : cf.dataset.conf);
      if (pr) {
        S.pred[key] = v;
        save();
        // Опыт начинается с исходного состояния: условия прошлого задания не мешают.
        if (m.setup && figCtl && figCtl.preset) figCtl.preset({ ...(activeFig(ch) && activeFig(ch).preset), ...m.setup });
        questDraw();
      } else if (v === m.confirm.right) {
        QUEST.wrong = null;
        missionDone(ch, m.id);
      } else {
        QUEST.wrong = key;
        questDraw();
      }
      return;
    }
    if (e.target.closest("[data-qmin]") && ch) {
      QUEST.min = S.qmin = !QUEST.min;
      save();
      questDraw();
      return;
    }
    const show = e.target.closest("[data-show]");
    if (show) {
      const li = show.closest(".q");
      const ans = $(".q-a", li);
      ans.hidden = !ans.hidden;
      show.setAttribute("aria-expanded", String(!ans.hidden));
      show.textContent = ans.hidden ? "Показать ответ" : "Скрыть ответ";
    }
    const gr = e.target.closest("[data-grade]");
    if (gr && ch) {
      const id = gr.dataset.grade;
      S.grade[id] = Number(gr.dataset.v);
      save();
      $$(`[data-grade="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b === gr)));
      const sc = chScore(ch);
      if ($("#score") && sc) $("#score").textContent = `${sc.sum} / ${sc.max}`;
      if (ch.mixed) weak(ch);
      $("#toc").innerHTML = tocHtml(S.last);
    }
  });
}

function bind(ch, a) {
  // Ссылки расчётов работают и из главы, и внутри самой шпаргалки.
  $$("#main [data-srz-sec]").forEach((link) => link.addEventListener("click", (event) => {
    render.sec = link.dataset.srzSec || null;
    if (link.hash !== location.hash) return;
    event.preventDefault();
    const target = render.sec === "#check" ? $("#check") : $$("#main section.sec").find((s) => s.querySelector("h3")?.textContent === render.sec);
    if (target) {
      for (let el = target; el; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true;
      target.scrollIntoView({ block: "start" });
    }
    render.sec = null;
  }));
  const full = $("#full");
  if (full)
    full.addEventListener("click", () => {
      const card = $("#labcard");
      const on = !card.classList.contains("full");
      card.classList.toggle("full", on);
      document.body.classList.toggle("noscroll", on);
      full.setAttribute("aria-pressed", String(on));
      full.textContent = on ? "Закрыть" : "На весь экран";
      window.dispatchEvent(new Event("resize"));
    });
  const guess = $("#guess");
  if (guess)
    guess.addEventListener("input", () => {
      S.guess[ch.id] = guess.value;
      save();
      const my = $("#myguess");
      if (my) my.textContent = guess.value ? `Твоя догадка: «${guess.value}»` : "Ты не записал догадку — ничего страшного.";
    });
  const reveal = $("#reveal");
  if (reveal)
    reveal.addEventListener("click", () => {
      const ans = $(".solution .answer");
      ans.hidden = !ans.hidden;
      reveal.setAttribute("aria-expanded", String(!ans.hidden));
      reveal.textContent = ans.hidden ? "Открыть разгадку" : "Скрыть разгадку";
    });
  const done = $("#markdone");
  if (done)
    done.addEventListener("click", () => {
      S.done[ch.id] = !S.done[ch.id];
      if (S.done[ch.id] && !S.rep[ch.id] && (ch.questions || []).length && !ch.mixed) S.rep[ch.id] = { start: Date.now(), auto: 1 };
      if (!S.done[ch.id]) {
        delete S.done[ch.id];
        // Сняли отметку по ошибке: убираем и расписание повторений, если оно началось само и ещё не тронуто.
        const rp = S.rep[ch.id];
        if (rp && rp.auto && !rp.d1 && !rp.d3 && !rp.dw) delete S.rep[ch.id];
      }
      save();
      render();
    });
  const sr = $("#startrep");
  if (sr)
    sr.addEventListener("click", () => {
      S.rep[ch.id] = { start: Date.now() };
      save();
      render();
    });
  $$("[data-rep]").forEach((cb) =>
    cb.addEventListener("change", () => {
      S.rep[ch.id][cb.dataset.rep] = cb.checked;
      save();
      $("#toc").innerHTML = tocHtml(S.last);
    }),
  );
  const scans = $("#scans");
  if (scans)
    scans.addEventListener("change", () => {
      const imgs = images();
      $$(".page").forEach((pg) => {
        const n = pg.dataset.page;
        const old = $("img", pg);
        if (scans.checked && imgs[n] && !old) {
          const img = new Image();
          img.alt = `Страница ${n} книги`;
          img.loading = "lazy";
          img.src = imgs[n];
          pg.insertBefore(img, $("pre", pg));
        }
        if (old) old.hidden = !scans.checked;
        $("pre", pg).hidden = scans.checked && !!imgs[n];
      });
    });
  // Чек-листы книги: галочки сохраняются в этом браузере.
  $$("ul.ck").forEach((ul, u) =>
    $$("li", ul).forEach((li, i) => {
      const key = `ck:${S.last}:${u}:${i}`;
      li.innerHTML = `<label><input type="checkbox" data-ck="${key}" ${S.seen[key] ? "checked" : ""}> ${li.innerHTML}</label>`;
    }),
  );
  $$("[data-ck]").forEach((cb) =>
    cb.addEventListener("change", () => {
      if (cb.checked) S.seen[cb.dataset.ck] = 1;
      else delete S.seen[cb.dataset.ck];
      save();
    }),
  );
  if (ch && ch.mixed) weak(ch);
  if (ch && ch.calc === "scale") {
    const upd = () => {
      const m = Number($("#sc-m").value) || 0, cm = Number($("#sc-cm").value) || 0;
      const meters = (m / 100) * cm;
      $("#sc-out").textContent = `= ${meters >= 1000 ? (meters / 1000).toLocaleString("ru-RU") + " км" : meters.toLocaleString("ru-RU") + " м"} (1 см = ${(m / 100).toLocaleString("ru-RU")} м)`;
    };
    $("#sc-m").addEventListener("input", upd);
    $("#sc-cm").addEventListener("input", upd);
    upd();
  }
  if (a && a.id === "А")
    $("#gsearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      $$("#gloss > div").forEach((d) => (d.hidden = q && !d.dataset.g.includes(q)));
    });
  if (a && a.id === "И") {
    let cat = "";
    const apply = () => {
      const q = ($("#srzq")?.value || "").trim().toLowerCase();
      // С фильтром темы видны и вопросы, отнесённые к ней дополнительно (also), — они лежат в своём основном разделе.
      $$("#srz details.srz").forEach((d) => (d.hidden = (cat && !d.dataset.c.split(" ").includes(cat)) || (q && !d.dataset.s.includes(q))));
      $$("#srz section[data-srzsec]").forEach((s) => (s.hidden = !s.querySelector("details.srz:not([hidden])")));
    };
    $$("[data-srzc]").forEach((b) =>
      b.addEventListener("click", () => {
        cat = b.dataset.srzc;
        $$("[data-srzc]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        apply();
      }),
    );
    $("#srzq")?.addEventListener("input", apply);

    // Пробный срез (20 случайных вопросов)
    const cov = new Map(SREZ_COV.items.map((c) => [String(c.n), c]));
    let exam = null;

    const renderExamCard = () => {
      const box = $("#srz-exam-box");
      if (!box || !exam) return;
      if (exam.done) {
        const pct = Math.round((exam.score / exam.items.length) * 100);
        const pass = pct >= 80;
        box.innerHTML = `<div class="srz-exam-card">
          <div class="eyebrow">Итог пробного экзамена</div>
          <h2>Результат: ${exam.score} из ${exam.items.length} (${pct} %)</h2>
          <p style="margin:12px 0">${pass ? `<span class="tag" data-tag="закон" style="font-size:14px;padding:4px 10px">✓ Зачёт (≥ 80 %)</span>` : `<span class="tag" style="color:var(--bad);box-shadow:0 0 0 1px currentColor;font-size:14px;padding:4px 10px">✗ Не сдал (< 80 %)</span>`}</p>
          ${exam.missed.length ? `<div style="margin:20px 0"><div class="eyebrow">Вопросы для повторения (${exam.missed.length})</div>${exam.missed.map((m) => {
            const num = typeof m.n === "number" ? `№${m.n}` : m.n;
            const cv = cov.get(String(m.n));
            return `<div class="srz-miss-item"><b>${esc(num)}. ${esc(m.q)}</b>${srezGo(cv)}</div>`;
          }).join("")}</div>` : `<p class="muted">Отличный результат! Все вопросы пройдены без ошибок.</p>`}
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
            <button type="button" class="lab-btn" id="srz-exam-restart">Пройти заново (новые 20 вопросов)</button>
            <button type="button" class="lab-btn" id="srz-exam-to-cat">Вернуться в каталог</button>
          </div>
        </div>`;
        $("#srz-exam-restart")?.addEventListener("click", startExam);
        $("#srz-exam-to-cat")?.addEventListener("click", () => switchMode("catalog"));
        box.querySelectorAll("[data-srz-sec]").forEach((l) => l.addEventListener("click", () => (render.sec = l.dataset.srzSec || null)));
        return;
      }

      const it = exam.items[exam.idx];
      const num = typeof it.n === "number" ? `№${it.n}` : it.n;
      box.innerHTML = `<div class="srz-exam-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="eyebrow">Вопрос ${exam.idx + 1} из ${exam.items.length} · ${esc(num)}</span>
          <span class="fc-prog">Верно: ${exam.score}</span>
        </div>
        <p class="fc-q" style="margin:12px 0 16px">${esc(it.q)}</p>
        ${exam.revealed
          ? `<div class="srz-a" style="margin:14px 0;padding-top:10px;border-top:1px dashed var(--anatomy-faint)">
              <div class="eyebrow">${it.own ? "Ответ инструктора" : "Ответ как в таблице"}</div>
              ${srezList(it.a)}
              ${srezBlk("note", "Уточнение", it.note)}
              ${cov.get(String(it.n))?.fix ? srezBlk("trap", "Учебник уточняет", cov.get(String(it.n)).fix) : ""}
            </div>
            <div class="fc-btns">
              <button type="button" class="lab-btn bad" id="exam-act-bad">✗ Не знал / Ошибся</button>
              <button type="button" class="lab-btn good" id="exam-act-good">✓ Ответил точно</button>
            </div>`
          : `<button type="button" class="lab-btn" id="exam-act-reveal" style="width:100%;min-height:50px">Показать ответ</button>`
        }
      </div>`;

      $("#exam-act-reveal")?.addEventListener("click", () => {
        exam.revealed = true;
        renderExamCard();
      });
      $("#exam-act-good")?.addEventListener("click", () => {
        exam.score++;
        nextExamCard();
      });
      $("#exam-act-bad")?.addEventListener("click", () => {
        exam.missed.push(it);
        // Ошибка пробного среза идёт в повтор колоды «Срез» (гл. 20): вопрос станет «к повтору сегодня».
        try {
          const sc = JSON.parse(localStorage.getItem("fpv_srez_sched") || "{}");
          sc[`srez:${it.n}`] = { step: 0, interval: 0, due: Date.now(), last: Date.now() };
          localStorage.setItem("fpv_srez_sched", JSON.stringify(sc));
        } catch (e) {}
        nextExamCard();
      });
    };

    const nextExamCard = () => {
      if (exam.idx + 1 < exam.items.length) {
        exam.idx++;
        exam.revealed = false;
      } else {
        exam.done = true;
      }
      renderExamCard();
    };

    const startExam = () => {
      const items = shuffle([...SREZ.items], Date.now()).slice(0, 20);
      exam = { items, idx: 0, score: 0, revealed: false, missed: [], done: false };
      renderExamCard();
    };

    const switchMode = (mode) => {
      const isExam = mode === "exam";
      $("#srz-mode-catalog")?.setAttribute("aria-pressed", String(!isExam));
      $("#srz-mode-exam")?.setAttribute("aria-pressed", String(isExam));
      if ($("#srz-catalog-view")) $("#srz-catalog-view").hidden = isExam;
      if ($("#srz-exam-view")) $("#srz-exam-view").hidden = !isExam;
      if (isExam && (!exam || exam.done)) startExam();
    };

    $("#srz-mode-catalog")?.addEventListener("click", () => switchMode("catalog"));
    $("#srz-mode-exam")?.addEventListener("click", () => switchMode("exam"));
  }
  if (a && a.id === "Д") {
    let vf = "Все";
    const apply = () => {
      const q = ($("#dsearch").value || "").trim().toLowerCase();
      $$("#corr tr[data-v]").forEach((tr) => (tr.hidden = (vf !== "Все" && !tr.dataset.v.startsWith(vf) && !tr.dataset.v.includes(vf)) || (q && !tr.dataset.s.includes(q))));
    };
    $$("[data-vf]").forEach((b) =>
      b.addEventListener("click", () => {
        vf = b.dataset.vf;
        $$("[data-vf]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        apply();
      }),
    );
    $("#dsearch").addEventListener("input", apply);
  }
}
function weak(ch) {
  const box = $("#weak");
  if (!box) return;
  const bad = {};
  let graded = 0;
  ch.questions.forEach((q, i) => {
    const g = S.grade[`${ch.id}:${i}`];
    if (g === undefined) return;
    graded++;
    if (g < 2) bad[q.ch] = (bad[q.ch] || 0) + 1;
  });
  const list = Object.keys(bad).sort((x, y) => Number(x) - Number(y));
  box.innerHTML = graded ? (list.length ? `<b>Повтори только эти главы:</b> ${list.map((c) => `<a href="#${c}">гл. ${c}</a>`).join(", ")}. Через 3–4 дня — снова весь тест.` : `<b>Всё на 2.</b> Через 3–4 дня — снова весь тест.`) : "Оцени ответы — здесь появится список глав для повторения.";
}

// Тема: по умолчанию как у системы (или как выбрал зритель на claude.ai); кнопка ставит явный выбор.
function effectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme() {
  if (S.theme === "dark" || S.theme === "light") document.documentElement.setAttribute("data-theme", S.theme);
  const btn = document.getElementById("theme");
  if (btn) btn.textContent = effectiveTheme() === "dark" ? "Светлая тема" : "Тёмная тема";
}

// ── Шапка ──
function header() {
  const opts = [`<option value="start">Как пользоваться книгой</option>`, ...CHAPTERS.map((c) => `<option value="${c.id}">${c.num}. ${esc(c.title)} · с. ${c.pages[0]}</option>`), ...APPX.map((a) => `<option value="${a.id}">${a.id}. ${esc(a.title)}</option>`)];
  $("#chsel").innerHTML = opts.join("");
  $("#chsel").addEventListener("change", (e) => (location.hash = e.target.value));
  const fast = $("#fast");
  fast.checked = !!S.fast;
  fast.addEventListener("change", () => {
    S.fast = fast.checked;
    save();
    document.body.toggleAttribute("data-fast", S.fast);
  });
  const theme = $("#theme");
  theme.addEventListener("click", () => {
    S.theme = effectiveTheme() === "dark" ? "light" : "dark";
    applyTheme();
    save();
  });
  applyTheme();
  document.addEventListener("change", (e) => {
    if (e.target.id === "examdate") {
      S.exam = e.target.value;
      save();
      render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.querySelector("#labcard.full")) {
      $("#full").click();
      return;
    }
    if (e.target.closest("input, textarea, select, .iso-stage, .labroot")) return;
    const id = S.last;
    const order = ["start", ...CHAPTERS.map((c) => c.id), ...APPX.map((a) => a.id)];
    const i = order.indexOf(id);
    if (e.key === "]" && i < order.length - 1) location.hash = order[i + 1];
    if (e.key === "[" && i > 0) location.hash = order[i - 1];
  });
}

window.addEventListener("hashchange", render);
setTimeout(cloudInit, 0);
header();
bindOnce();
if (!document.body.classList.contains("iso")) document.body.classList.add("iso");
render();
