// Гл. 20, вкладка «Что первым?»: признак → таймер → выбор → «почему» → «что дальше» → глава.
// Ситуации — docs/content/first-action.json (карточка 036, GPT), движок — карточка 037. Решение 001 (C3: решение под
// давлением времени) и отчёт docs/research/skills-and-memory.md: пары «признак → первое действие», сначала по темам,
// чередование — только когда пройдена каждая тема. Ошибка или опоздание ставят вопросы среза в повтор колоды «Срез».
import FA from "../../docs/content/first-action.json";
import { shuffle } from "../labkit.mjs";
import { markDue } from "../srs.mjs";

const PLACES = [["air", "В воздухе"], ["bench", "На столе"], ["charge", "Зарядка"], ["safety", "Первая помощь"]];
const MIX_N = 10, MIX_OK = 8;
const KEY = "fpv_first";

export const meta = {
  id: "first",
  title: "Что сделаешь первым?",
  missions: [
    { id: "topic", text: "Пройди одну тему целиком: каждая ситуация хоть раз — верно и в срок" },
    { id: "air", text: "Тема «В воздухе»: все ситуации верно, пока не вышло время" },
    { id: "mixed", text: `Вперемешку (после всех тем): ${MIX_N} ситуаций, не меньше ${MIX_OK} верно` },
  ],
};

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export function mount(root, ctx) {
  // passed — ситуации, решённые верно и в срок хотя бы раз (между сессиями: темы проходятся постепенно).
  const saved = load();
  const passed = new Set(Array.isArray(saved.passed) ? saved.passed.filter((id) => FA.some((x) => x.id === id)) : []);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ passed: [...passed] })); } catch {} };
  const inPlace = (pl) => FA.filter((x) => x.place === pl);
  const placeDone = (pl) => inPlace(pl).every((x) => passed.has(x.id));
  const allDone = () => PLACES.every(([pl]) => placeDone(pl));
  // s.mode: "pick" — выбор темы; "card" — ситуация; "shown" — разбор ответа; "end" — итог круга.
  const s = { mode: "pick", topic: null, queue: [], cur: null, order: [], left: 0, timer: 0, t0: 0, pick: null, late: false, round: { n: 0, ok: 0 } };

  root.innerHTML = `<div class="fa"><div class="fa-topics" role="group" aria-label="Тема"></div><div class="fa-box" aria-live="polite"></div></div>`;
  const $ = (q) => root.querySelector(q);

  const stop = () => { clearInterval(s.timer); s.timer = 0; };
  function topics() {
    const ready = allDone();
    const left = PLACES.filter(([pl]) => !placeDone(pl)).length;
    $(".fa-topics").innerHTML = PLACES.map(([pl, t]) => {
      const all = inPlace(pl), got = all.filter((x) => passed.has(x.id)).length;
      return `<button type="button" class="lab-btn" data-topic="${pl}" aria-pressed="${s.topic === pl}">${t} <small>${got}/${all.length}${got === all.length ? " ✓" : ""}</small></button>`;
    }).join("") + `<button type="button" class="lab-btn" data-topic="mix" aria-pressed="${s.topic === "mix"}"${ready ? "" : " disabled"}>Вперемешку <small>${ready ? `${MIX_N} ситуаций` : `после всех тем · осталось ${left}`}</small></button>`;
  }
  function begin(topic) {
    stop();
    s.topic = topic;
    s.round = { n: 0, ok: 0 };
    // Тема: сначала нерешённые, решённые — в конце (повторить можно, но тема не закрывается перебором уже известного).
    if (topic === "mix") s.queue = shuffle(FA, Date.now()).slice(0, MIX_N);
    else { const all = shuffle(inPlace(topic), Date.now()); s.queue = [...all.filter((x) => !passed.has(x.id)), ...all.filter((x) => passed.has(x.id))]; }
    topics();
    next();
  }
  function next() {
    stop();
    s.cur = s.queue.shift();
    if (!s.cur) return end();
    s.mode = "card";
    s.pick = null;
    s.late = false;
    // Порядок вариантов перемешан при каждом показе: место кнопки ответ не подсказывает.
    s.order = shuffle(s.cur.options.map((_, i) => i), Date.now() + s.cur.id.length);
    draw();
    if (s.cur.seconds) {
      s.t0 = Date.now();
      s.left = s.cur.seconds;
      s.timer = setInterval(() => {
        s.left = Math.max(0, s.cur.seconds - (Date.now() - s.t0) / 1000);
        const bar = $(".fa-time i"), num = $(".fa-time b");
        if (bar) bar.style.width = `${(s.left / s.cur.seconds) * 100}%`;
        if (num) num.textContent = `${Math.ceil(s.left)} с`;
        if (s.left <= 0) answer(null);
      }, 100);
    }
  }
  function answer(i) {
    if (s.mode !== "card") return;
    stop();
    const c = s.cur;
    s.mode = "shown";
    s.pick = i;
    s.late = i === null;
    const ok = i !== null && c.options[i].correct;
    s.round.n++;
    if (ok) {
      s.round.ok++;
      passed.add(c.id);
      save();
    } else {
      markDue(c.srez || []);
      // В теме ошибка возвращается через две ситуации: тема закрывается только верным ответом на каждую.
      if (s.topic !== "mix") s.queue.splice(2, 0, c);
    }
    if (s.topic !== "mix" && placeDone(s.topic)) {
      ctx.done("topic");
      if (s.topic === "air") ctx.done("air");
    }
    topics();
    draw();
  }
  function end() {
    s.mode = "end";
    if (s.topic === "mix" && s.round.ok >= MIX_OK) ctx.done("mixed");
    draw();
  }
  function draw() {
    const box = $(".fa-box");
    if (s.mode === "pick") {
      box.innerHTML = `<p class="fa-lead">Признак — и сразу решение: что делаешь <b>первым</b>? В воздухе на ответ несколько секунд, на столе — больше. Сначала пройди темы по одной; «Вперемешку» откроется, когда пройдены все.</p>`;
      return;
    }
    if (s.mode === "end") {
      const mix = s.topic === "mix";
      box.innerHTML = `<div class="fa-card"><p class="fa-q">${mix ? `Круг вперемешку: верно ${s.round.ok} из ${s.round.n}.${s.round.ok >= MIX_OK ? " Зачёт." : ` Для зачёта нужно ${MIX_OK}.`}` : `Тема пройдена: каждая ситуация решена верно и в срок.`}</p><p class="muted small">Ошибки уже стоят в повторе колоды «Срез» (вкладка «Карточки»).</p><div class="lab-row"><button type="button" class="lab-btn" data-again>${mix ? "Ещё круг" : "Пройти тему ещё раз"}</button></div></div>`;
      return;
    }
    const c = s.cur;
    const place = PLACES.find(([pl]) => pl === c.place)?.[1] || "";
    const head = `<div class="fa-head"><span class="eyebrow">${esc(place)} · ${s.topic === "mix" ? `${s.round.n + (s.mode === "card" ? 1 : 0)} из ${MIX_N}` : `осталось ${s.queue.length + (s.mode === "card" ? 1 : 0)}`}</span>${c.seconds ? `<span class="fa-time" aria-hidden="true"><i style="width:${s.mode === "card" ? (s.left / c.seconds) * 100 : 0}%"></i><b>${s.mode === "card" ? Math.ceil(s.left) + " с" : ""}</b></span>` : `<span class="muted small">без таймера</span>`}</div>`;
    const opts = s.order.map((i) => {
      const o = c.options[i];
      const st = s.mode === "shown" ? (o.correct ? " ok" : i === s.pick ? " bad" : "") : "";
      return `<button type="button" class="lab-btn fa-opt${st}" data-opt="${i}"${s.mode === "shown" ? " disabled" : ""}>${esc(o.text)}</button>`;
    }).join("");
    let res = "";
    if (s.mode === "shown") {
      const good = c.options.find((o) => o.correct);
      const ok = s.pick !== null && c.options[s.pick].correct;
      res = `<div class="fa-res">${ok ? `<p><b class="fa-ok">✓ Верно.</b> ${esc(good.why)}</p>` : `${s.late ? `<p><b class="fa-bad">⏱ Время вышло.</b> В воздухе решение нужно сразу — задержка тоже выбор.</p>` : `<p><b class="fa-bad">✗ Не первым.</b> ${esc(c.options[s.pick].why)}</p>`}<p><b>Первым:</b> ${esc(good.text)} ${esc(good.why)}</p>`}
        <p><b>Что дальше.</b> ${esc(c.then)}</p>${c.note ? `<p class="small"><b>Уточнение.</b> ${esc(c.note)}</p>` : ""}
        <p class="small">${c.srez && c.srez.length ? `Срез: ${c.srez.map(esc).join(", ")} · ` : ""}<a href="#${esc(c.chapter)}">Разбор в главе ${esc(c.chapter)} →</a></p>
        <div class="lab-row"><button type="button" class="lab-btn" data-next>${s.queue.length ? "Следующая ситуация" : "Итог"}</button></div></div>`;
    }
    box.innerHTML = `<div class="fa-card">${head}<p class="fa-q">${esc(c.cue)}</p><div class="fa-opts">${opts}</div>${res}</div>`;
  }

  root.addEventListener("click", (e) => {
    const tp = e.target.closest("[data-topic]");
    if (tp && !tp.disabled) return begin(tp.dataset.topic);
    const op = e.target.closest("[data-opt]");
    if (op && s.mode === "card") return answer(Number(op.dataset.opt));
    if (e.target.closest("[data-next]")) return next();
    if (e.target.closest("[data-again]")) return begin(s.topic);
  });
  topics();
  draw();
  return { destroy() { stop(); } };
}
