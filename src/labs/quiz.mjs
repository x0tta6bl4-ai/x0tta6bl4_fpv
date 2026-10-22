// Гл. 20. Карточки вперемешку со всей книги: «Знал / Не знал», невыученные возвращаются через 3 карточки.
import { shuffle } from "../labkit.mjs";
import { CHAPTERS_A } from "../../data/chapters-a.mjs";
import { CHAPTERS_B } from "../../data/chapters-b.mjs";
import { CHAPTERS_C } from "../../data/chapters-c.mjs";
import SREZ from "../../docs/content/srez.json";

export const meta = {
  id: "quiz",
  title: "Карточки вперемешку",
  missions: [
    { id: "ten", text: "Пройди 10 карточек" },
    { id: "streak", text: "Скажи «Знал» 5 раз подряд" },
    { id: "back", text: "Карточка, которую не знал, вернулась — и теперь ты её знаешь" },
    { id: "final", text: "Отметь «Знал» на всех 21 вопросах итогового теста" },
  ],
};

export function mount(root, ctx) {
  const ALL = [...CHAPTERS_A, ...CHAPTERS_B, ...CHAPTERS_C];
  const finalCh = ALL.find((c) => c.mixed);
  const cards = [];
  for (const c of ALL) (c.questions || []).forEach((q, i) => cards.push({ key: `${c.id}:${i}`, q: q.q, a: q.a, ch: q.ch || c.id, final: !!c.mixed, notes: !!q.k }));
  // Колода «Срез» — все вопросы опросника курса (docs/content/srez.json), ответ как в таблице + уточнение.
  const escH = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  for (const it of SREZ.items) cards.push({ key: `srez:${it.n}`, q: escH(it.q), a: [].concat(it.a).map(escH).join("; ") + (it.note ? `<br><i>Уточнение: ${escH(it.note)}</i>` : ""), num: typeof it.n === "number" ? `№${it.n}` : it.n, srez: true });
  // Колода «Конспект» — вопросы глав, помеченные k: 1 (по конспекту инструктора).
  const inPool = (c) => (s.pool === "srez" ? c.srez : c.srez ? false : s.pool === "notes" ? c.notes : s.pool === "all" || c.final);

  // Интервальное расписание повтора для колоды «Срез»
  const loadSched = () => {
    try { return JSON.parse(localStorage.getItem("fpv_srez_sched") || "{}"); } catch { return {}; }
  };
  const saveSched = (sc) => {
    try { localStorage.setItem("fpv_srez_sched", JSON.stringify(sc)); } catch {}
  };
  const sched = loadSched();
  const DAY_MS = 86400000;
  const INTERVALS = [1, 3, 7, 14, 30]; // дни между повторами

  const isDue = (c) => {
    if (!c.srez) return true;
    const r = sched[c.key];
    if (!r || !r.due) return true;
    return r.due <= Date.now();
  };

  // practice — «повторить всё равно»: карточки, срок которых не подошёл; «знал» в нём расписание не сдвигает.
  const s = { pool: "final", queue: [], seen: 0, streak: 0, known: new Set(), missed: new Set(), cur: null, open: false, practice: false };
  const srezDueInitial = cards.filter((c) => c.srez && isDue(c)).length;
  root.innerHTML = `<div class="fc-wrap"><div class="lab-choice"><b>Колода</b><div role="radiogroup"><button type="button" role="radio" data-pool="final" aria-checked="true">Итоговый тест (${cards.filter((c) => c.final).length})</button><button type="button" role="radio" data-pool="all" aria-checked="false">Вся книга (${cards.filter((c) => !c.srez).length})</button>${cards.some((c) => c.notes) ? `<button type="button" role="radio" data-pool="notes" aria-checked="false">Конспект (${cards.filter((c) => c.notes).length})</button>` : ""}<button type="button" role="radio" data-pool="srez" aria-checked="false">Срез (${cards.filter((c) => c.srez).length}${srezDueInitial < cards.filter((c) => c.srez).length ? ` · к повтору: ${srezDueInitial}` : ""})</button></div></div>
    <div class="fc" id="card" tabindex="0"></div><div class="lab-row fc-btns" id="btns"></div><div class="fc-prog" id="prog"></div></div>`;
  const $ = (q) => root.querySelector(q);
  const deal = () => {
    const poolCards = cards.filter(inPool);
    if (s.pool === "srez") {
      // Раньше срока карточку не показываем: иначе «знал» без перерыва растягивает интервал и повтор теряет смысл.
      const dueCards = shuffle(poolCards.filter(isDue), Date.now());
      s.queue = s.practice ? shuffle(poolCards, Date.now()) : dueCards;
      if (!s.queue.length) return rest();
    } else {
      s.queue = shuffle(poolCards, Date.now());
    }
    next();
  };
  const next = () => {
    s.cur = s.queue.shift();
    s.open = false;
    if (!s.cur) { deal(); return; }
    draw();
  };
  const rest = () => {
    s.cur = null;
    const next = Object.values(sched).map((r) => r.due).filter((d) => d > Date.now());
    const t = next.length ? Math.min(...next) : null;
    $("#card").className = "fc open";
    $("#card").innerHTML = `<small>Срез · на сегодня всё</small><p class="fc-q">Все вопросы, которые пора повторить, пройдены.</p><p class="fc-a">Следующий повтор: ${t ? new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "—"}. Знал — вопрос вернётся через 1, 3, 7, 14, 30 дней; не знал — сегодня же.</p>`;
    $("#btns").innerHTML = `<button type="button" class="lab-btn" data-again>Повторить всё равно (расписание не сдвинется)</button>`;
    $("#prog").innerHTML = "";
  };
  const draw = () => {
    const c = s.cur;
    let repNote = "";
    if (c.srez) {
      const r = sched[c.key];
      if (r && r.step > 0 && r.due > Date.now()) {
        const dLeft = Math.ceil((r.due - Date.now()) / DAY_MS);
        repNote = ` · повтор через ${dLeft} дн.`;
      } else if (r && r.step > 0) {
        repNote = ` · срок повтора`;
      }
    }
    $("#card").className = `fc ${s.open ? "open" : ""}`;
    $("#card").innerHTML = `<small>${c.srez ? `Срез · ${c.num}${repNote}` : `${c.notes ? "Конспект" : "Вопрос"} · глава ${c.ch}`}${s.missed.has(c.key) ? " · повтор" : ""}</small><p class="fc-q">${c.q}</p>${s.open ? `<p class="fc-a">${c.a}</p>` : `<p class="fc-hint">Ответь вслух или про себя, потом открой.</p>`}`;
    $("#btns").innerHTML = s.open ? `<button type="button" class="lab-btn bad" data-k="0">✗ Не знал</button><button type="button" class="lab-btn good" data-k="1">✓ Знал</button>` : `<button type="button" class="lab-btn" data-flip>Показать ответ</button>`;
    const fin = cards.filter((x) => x.final);
    if (s.pool === "srez") {
      const srezDue = cards.filter((x) => x.srez && isDue(x)).length;
      const srezLearned = cards.filter((x) => x.srez && sched[x.key] && sched[x.key].step > 0).length;
      $("#prog").innerHTML = `Пройдено за сессию: ${s.seen} · выучено: ${srezLearned} из 143 · на сегодня к повтору: ${srezDue}`;
    } else {
      $("#prog").innerHTML = `Пройдено: ${s.seen} · серия «знал»: ${s.streak} · итоговый тест: ${fin.filter((x) => s.known.has(x.key)).length} из ${fin.length}`;
    }
  };
  root.addEventListener("click", (e) => {
    const p = e.target.closest("[data-pool]");
    if (p) {
      s.pool = p.dataset.pool;
      s.practice = false;
      root.querySelectorAll("[data-pool]").forEach((b) => b.setAttribute("aria-checked", String(b === p)));
      deal();
      return;
    }
    if (e.target.closest("[data-again]")) { s.practice = true; deal(); return; }
    if (!s.cur) return;
    if (e.target.closest("[data-flip]") || (e.target.closest("#card") && !s.open)) { s.open = true; draw(); return; }
    const k = e.target.closest("[data-k]");
    if (!k) return;
    const c = s.cur;
    s.seen++;
    if (k.dataset.k === "1") {
      s.streak++;
      if (s.missed.has(c.key)) ctx.done("back");
      s.known.add(c.key);
      if (c.srez && isDue(c)) {
        const r = sched[c.key] || { step: 0 };
        const step = Math.min((r.step || 0) + 1, INTERVALS.length);
        const days = INTERVALS[step - 1];
        sched[c.key] = { step, interval: days, due: Date.now() + days * DAY_MS, last: Date.now() };
        saveSched(sched);
      }
    } else {
      s.streak = 0;
      s.missed.add(c.key);
      s.known.delete(c.key); // «Не знал» отменяет прежнее «Знал»
      if (c.srez) {
        sched[c.key] = { step: 0, interval: 0, due: Date.now(), last: Date.now() };
        saveSched(sched);
      }
      if (s.queue.length < 3) s.queue.push(...shuffle(cards.filter((x) => inPool(x) && x.key !== c.key && (s.pool !== "srez" || s.practice || isDue(x))), Date.now()));
      s.queue.splice(3, 0, c); // вернётся через 3 карточки
    }
    if (s.seen >= 10) ctx.done("ten");
    if (s.streak >= 5) ctx.done("streak");
    if (finalCh && cards.filter((x) => x.final).every((x) => s.known.has(x.key))) ctx.done("final");
    next();
  });
  deal();
  return { destroy() {} };
}
