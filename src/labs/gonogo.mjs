// Гл. 18. «Летим или откладываем» по шести пунктам + что делать при отказе.
import { esc, shuffle } from "../labkit.mjs";

export const meta = {
  id: "gonogo",
  title: "Летим или откладываем?",
  missions: [
    { id: "streak", text: "Прими 5 правильных решений подряд" },
    { id: "allok", text: "Распознай день, когда можно лететь (всё в порядке)" },
    { id: "unknown", text: "Правильно реши, когда что-то «не удалось установить»" },
    { id: "emerg", text: "Ответь правильно на 2 аварийных вопроса" },
  ],
};
const F = [
  ["Люди", "зона свободна, наблюдатель на месте", ["в зоне гуляют посторонние", "наблюдатель не пришёл"]],
  ["Площадка", "есть место для взлёта, посадки и запасное", ["над площадкой провода", "запасного места для посадки нет"]],
  ["Погода", "ветер слабый, без осадков", ["порывистый сильный ветер", "моросит дождь", "мороз, а батареи холодные"]],
  ["Оборудование", "все чек-листы пройдены", ["одна банка батареи вздулась", "Failsafe ещё не проверяли"]],
  ["Правила", "полёт здесь разрешён", ["разрешения на полёт нет"]],
  ["Ты сам", "выспался, спокоен", ["не спал полночи", "торопишься, все ждут"]],
];
const EMERG = [
  ["Пропало видео, а управление есть. Что сразу?", ["Не дёргать стики; наблюдатель, проверенный Angle; высота — только при свободном безопасном пространстве", "Сразу дизарм, где бы ни был", "Резко дать полный газ и крутить стиками, искать картинку"], 0],
  ["Отказал мотор у квадрокоптера. Что делать?", ["На трёх моторах квадрокоптер не летит: сразу дизарм, чтобы винты не крутились при падении; предупредить людей, запомнить место падения", "Лететь домой на трёх моторах", "Включить турбо-режим"], 0],
  ["Батарея задымилась после посадки. Что первым?", ["Люди прочь, дым не вдыхать, при угрозе — 112", "Поднять и понюхать", "Залить водой из бутылки и сразу заряжать снова"], 0],
  ["Приоритет при любой аварии?", ["Люди → обстановка → аппарат", "Аппарат → люди → обстановка", "Сначала найти дрон"], 0],
];

export function mount(root, ctx) {
  root.innerHTML = `<div class="gng"><div class="gng-day" id="day"></div><div class="lab-row gng-btns"><button type="button" class="lab-btn go" data-go="1">✈ Летим</button><button type="button" class="lab-btn nogo" data-go="0">⏸ Откладываем</button></div><p class="lab-read" aria-live="polite"></p><div class="lab-quiz" id="em"></div></div>`;
  const $ = (q) => root.querySelector(q);
  const s = { streak: 0, best: 0, day: null, locked: false, emOk: 0, emIdx: 0 };
  const newDay = () => {
    const allOk = Math.random() < 0.3;
    const unknown = !allOk && Math.random() < 0.3 ? Math.floor(Math.random() * F.length) : -1;
    s.day = F.map(([name, ok, bad], i) => {
      if (i === unknown) return { name, text: "не удалось установить", bad: true, unk: true };
      if (allOk || Math.random() < 0.72) return { name, text: ok, bad: false };
      return { name, text: bad[Math.floor(Math.random() * bad.length)], bad: true };
    });
    s.locked = false;
    $("#day").innerHTML = `<b>Сегодняшний вылет</b>${s.day.map((f) => `<div class="gng-f"><small>${esc(f.name)}</small><span>${esc(f.text)}</span></div>`).join("")}<small class="gng-s">Серия: ${s.streak} · лучшая: ${s.best}</small>`;
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b || s.locked) return;
    s.locked = true;
    const bad = s.day.filter((f) => f.bad);
    const go = b.dataset.go === "1";
    const right = go === (bad.length === 0);
    s.streak = right ? s.streak + 1 : 0;
    s.best = Math.max(s.best, s.streak);
    if (s.streak >= 5) ctx.done("streak");
    if (right && go) ctx.done("allok");
    if (right && !go && bad.some((f) => f.unk)) ctx.done("unknown");
    root.querySelectorAll(".gng-f").forEach((el, i) => el.classList.toggle("bad", s.day[i].bad));
    $(".lab-read").innerHTML = right
      ? go ? "<b class='good'>Верно!</b> Все шесть пунктов в порядке — можно лететь." : `<b class='good'>Верно!</b> Причина отложить: ${bad.map((f) => esc(f.text)).join("; ")}.${bad.some((f) => f.unk) ? " «Не удалось установить» — тоже повод отложить, а не угадывать." : ""}`
      : go ? `<b class='bad'>Опасно!</b> Ты пропустил: ${bad.map((f) => esc(f.text)).join("; ")}. Хватает одного красного пункта.` : "<b class='bad'>Зря отложил:</b> всё было в порядке. Но лучше перестраховаться, чем наоборот.";
    setTimeout(newDay, right ? 1400 : 2600);
  });
  let emAnswered = false;
  const ask = () => {
    emAnswered = false;
    const [q, opts] = EMERG[s.emIdx % EMERG.length];
    $("#em").innerHTML = `<b>Аварийный вопрос: ${esc(q)}</b><div class="lab-col">${shuffle(opts.map((o, i) => [o, i]), Date.now() + s.emIdx).map(([o, i]) => `<button type="button" class="lab-btn" data-e="${i}">${esc(o)}</button>`).join("")}</div><small>Правильных: ${s.emOk}</small>`;
  };
  $("#em").addEventListener("click", (e) => {
    const b = e.target.closest("[data-e]");
    if (!b) return;
    e.stopPropagation();
    // Один ответ на вопрос: пока не показан следующий, повторные нажатия не считаются.
    if (emAnswered) return;
    emAnswered = true;
    const ok = b.dataset.e === "0";
    b.classList.add(ok ? "good" : "bad");
    if (ok) s.emOk++;
    if (s.emOk >= 2) ctx.done("emerg");
    setTimeout(() => { if (ok) s.emIdx++; ask(); }, ok ? 700 : 1200);
  });
  newDay();
  ask();
  return { destroy() {} };
}
