// Гл. 20. Карточки вперемешку со всей книги: «Знал / Не знал», невыученные возвращаются через 3 карточки.
import { shuffle } from "../labkit.mjs";
import { CHAPTERS_A } from "../../data/chapters-a.mjs";
import { CHAPTERS_B } from "../../data/chapters-b.mjs";
import { CHAPTERS_C } from "../../data/chapters-c.mjs";

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
  // Колода «Конспект» — вопросы глав, помеченные k: 1 (по конспекту инструктора).
  const inPool = (c) => (s.pool === "notes" ? c.notes : s.pool === "all" || c.final);
  const s = { pool: "final", queue: [], seen: 0, streak: 0, known: new Set(), missed: new Set(), cur: null, open: false };
  root.innerHTML = `<div class="fc-wrap"><div class="lab-choice"><b>Колода</b><div role="radiogroup"><button type="button" role="radio" data-pool="final" aria-checked="true">Итоговый тест (${cards.filter((c) => c.final).length})</button><button type="button" role="radio" data-pool="all" aria-checked="false">Вся книга (${cards.length})</button>${cards.some((c) => c.notes) ? `<button type="button" role="radio" data-pool="notes" aria-checked="false">Конспект (${cards.filter((c) => c.notes).length})</button>` : ""}</div></div>
    <div class="fc" id="card" tabindex="0"></div><div class="lab-row fc-btns" id="btns"></div><div class="fc-prog" id="prog"></div></div>`;
  const $ = (q) => root.querySelector(q);
  const deal = () => {
    s.queue = shuffle(cards.filter(inPool), Date.now());
    next();
  };
  const next = () => {
    s.cur = s.queue.shift();
    s.open = false;
    if (!s.cur) { deal(); return; }
    draw();
  };
  const draw = () => {
    const c = s.cur;
    $("#card").className = `fc ${s.open ? "open" : ""}`;
    $("#card").innerHTML = `<small>${c.notes ? "Конспект" : "Вопрос"} · глава ${c.ch}${s.missed.has(c.key) ? " · повтор" : ""}</small><p class="fc-q">${c.q}</p>${s.open ? `<p class="fc-a">${c.a}</p>` : `<p class="fc-hint">Ответь вслух или про себя, потом открой.</p>`}`;
    $("#btns").innerHTML = s.open ? `<button type="button" class="lab-btn bad" data-k="0">✗ Не знал</button><button type="button" class="lab-btn good" data-k="1">✓ Знал</button>` : `<button type="button" class="lab-btn" data-flip>Показать ответ</button>`;
    const fin = cards.filter((x) => x.final);
    $("#prog").innerHTML = `Пройдено: ${s.seen} · серия «знал»: ${s.streak} · итоговый тест: ${fin.filter((x) => s.known.has(x.key)).length} из ${fin.length}`;
  };
  root.addEventListener("click", (e) => {
    const p = e.target.closest("[data-pool]");
    if (p) {
      s.pool = p.dataset.pool;
      root.querySelectorAll("[data-pool]").forEach((b) => b.setAttribute("aria-checked", String(b === p)));
      deal();
      return;
    }
    if (e.target.closest("[data-flip]") || (e.target.closest("#card") && !s.open)) { s.open = true; draw(); return; }
    const k = e.target.closest("[data-k]");
    if (!k) return;
    const c = s.cur;
    s.seen++;
    if (k.dataset.k === "1") {
      s.streak++;
      if (s.missed.has(c.key)) ctx.done("back");
      s.known.add(c.key);
    } else {
      s.streak = 0;
      s.missed.add(c.key);
      s.known.delete(c.key); // «Не знал» отменяет прежнее «Знал»
      if (s.queue.length < 3) s.queue.push(...shuffle(cards.filter((x) => inPool(x) && x.key !== c.key), Date.now()));
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
