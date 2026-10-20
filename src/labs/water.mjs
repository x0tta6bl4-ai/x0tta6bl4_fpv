// Гл. 0. Электричество на водопроводе: бак (напряжение), труба (сопротивление), поток (ток), колесо (мощность).
import { loop, slider, choice, button, clamp, fmt, TAU, shuffle, esc } from "../labkit.mjs";

export const meta = {
  id: "water",
  title: "Водопровод вместо проводов",
  missions: [
    { id: "i2", text: "Сделай так, чтобы ток был ровно 2 А" },
    { id: "p50", text: "Раскрути колесо: мощность больше 50 Вт" },
    { id: "narrow", text: "Почти останови колесо, не опуская бак ниже 10 В (сузь трубу)" },
    { id: "units", text: "Ответь правильно на 3 вопроса про приставки подряд" },
  ],
};

const QUIZ = [
  ["2,4 ГГц — это сколько МГц?", ["2400 МГц", "240 МГц", "24 000 МГц"], 0],
  ["1000 мА·ч — это сколько А·ч?", ["1 А·ч", "10 А·ч", "0,1 А·ч"], 0],
  ["5800 МГц — это сколько ГГц?", ["5,8 ГГц", "58 ГГц", "0,58 ГГц"], 0],
  ["25 мВт — это сколько ватт?", ["0,025 Вт", "2,5 Вт", "25 000 Вт"], 0],
  ["1,6 Вт — это сколько милливатт?", ["1600 мВт", "160 мВт", "16 мВт"], 0],
  ["6000 мА·ч — это сколько А·ч?", ["6 А·ч", "60 А·ч", "0,6 А·ч"], 0],
  ["Ток 30 А — это сколько мА?", ["30 000 мА", "3000 мА", "300 мА"], 0],
  ["Что больше: 900 МГц или 2,4 ГГц?", ["2,4 ГГц", "900 МГц", "одинаково"], 0],
];

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 230" class="lab-svg" role="img" aria-label="Бак с водой, труба и водяное колесо">
    <rect x="0" y="0" width="360" height="230" class="lab-field"/>
    <g id="tank"></g><g id="pipe"></g><g id="drops"></g><g id="wheel"></g><g id="labels"></g></svg></div>
    <div class="lab-ctl"></div>
    <div class="lab-chips" id="chips"></div>
    <p class="lab-read" aria-live="polite"></p>
    <div class="lab-quiz" id="quiz"></div>`;
  const $ = (s) => root.querySelector(s);
  const ctl = $(".lab-ctl");
  const s = { V: 12, R: 8, angle: 0, drops: Array.from({ length: 26 }, (_, i) => i / 26), streak: 0 };
  slider(ctl, { label: "Высота бака = напряжение", min: 1, max: 24, step: 1, value: s.V, fmt: (v) => `${v} В`, onInput: (v) => (s.V = v) });
  slider(ctl, { label: "Узость трубы = сопротивление", min: 1, max: 24, step: 1, value: s.R, fmt: (v) => `${v} Ом`, onInput: (v) => (s.R = v) });
  // Мини-игра на приставки.
  const quiz = $("#quiz");
  let order = shuffle(QUIZ.map((_, i) => i)), qi = 0, answered = false;
  const ask = () => {
    answered = false;
    const [q, opts] = QUIZ[order[qi % order.length]];
    const shuffled = shuffle(opts.map((o, i) => [o, i]), Date.now() + qi);
    quiz.innerHTML = `<b>Приставки: кило ×1000, мега ×1 000 000, гига ×1 000 000 000, милли ÷1000</b><p>${esc(q)}</p><div class="lab-row">${shuffled.map(([o, i]) => `<button type="button" class="lab-btn" data-i="${i}">${esc(o)}</button>`).join("")}</div><small>Серия правильных ответов: ${s.streak}</small>`;
  };
  quiz.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    // Один ответ на вопрос: пока не показан следующий, повторные нажатия не считаются.
    if (!b || answered) return;
    answered = true;
    const ok = b.dataset.i === "0";
    s.streak = ok ? s.streak + 1 : 0;
    b.classList.add(ok ? "good" : "bad");
    if (s.streak >= 3) ctx.done("units");
    setTimeout(() => {
      qi++;
      ask();
    }, ok ? 500 : 1100);
  });
  ask();
  const read = $(".lab-read"), chips = $("#chips");
  const L = loop(root, (dt, calm) => {
    const I = s.V / s.R, P = s.V * I;
    if (Math.abs(I - 2) < 0.05) ctx.done("i2");
    if (P > 50) ctx.done("p50");
    if (s.V >= 10 && P < 6) ctx.done("narrow");
    // Бак: уровень воды = напряжение.
    const lvl = 10 + (s.V / 24) * 150;
    $("#tank").innerHTML = `<rect x="20" y="40" width="70" height="160" rx="6" class="w-tank"/><rect x="24" y="${200 - lvl}" width="62" height="${lvl - 4}" rx="3" class="w-water"/><path d="M20 200H140" class="w-ground"/>${Array.from({ length: 7 }, (_, i) => `<path d="M90 ${200 - i * 25}h6" class="lab-tick"/>`).join("")}`;
    // Труба: толщина обратна сопротивлению.
    const w = clamp(22 - s.R * 0.8, 3, 20);
    const py = 186;
    $("#pipe").innerHTML = `<path d="M86 ${py}H250" class="w-pipe-out" style="stroke-width:${w + 6}"/><path d="M86 ${py}H250" class="w-pipe-in" style="stroke-width:${w}"/>`;
    // Капли бегут со скоростью тока.
    if (!calm) s.drops = s.drops.map((d) => (d + dt * I * 0.08) % 1);
    $("#drops").innerHTML = s.drops.map((d, i) => `<circle cx="${(88 + d * 160).toFixed(1)}" cy="${(py + ((i % 3) - 1) * w * 0.25).toFixed(1)}" r="${Math.max(1.2, w * 0.18).toFixed(1)}" class="w-drop"/>`).join("");
    // Колесо: крутится от мощности.
    if (!calm) s.angle += dt * Math.min(P, 120) * 0.08;
    let wheel = `<circle cx="292" cy="150" r="46" class="w-wheel"/>`;
    for (let k = 0; k < 8; k++) {
      const a = s.angle + (k * TAU) / 8;
      wheel += `<path d="M292 150L${(292 + Math.cos(a) * 46).toFixed(1)} ${(150 + Math.sin(a) * 46).toFixed(1)}" class="w-spoke"/><rect x="${(292 + Math.cos(a) * 46 - 6).toFixed(1)}" y="${(150 + Math.sin(a) * 46 - 6).toFixed(1)}" width="12" height="12" rx="2" class="w-bucket"/>`;
    }
    wheel += `<circle cx="292" cy="150" r="6" class="w-hub"/><path d="M250 ${py}q20 0 30 -10" class="w-pipe-in" style="stroke-width:${w}"/>`;
    $("#wheel").innerHTML = wheel;
    $("#labels").innerHTML = `<text x="55" y="30" class="lt" text-anchor="middle">Бак = батарея</text><text x="292" y="92" class="lt" text-anchor="middle">Колесо = мотор</text><text x="168" y="${py - w / 2 - 10}" class="lt" text-anchor="middle">труба = провод</text>`;
    const html = `<div class="chip"><small>Напряжение (давление)</small><b>${fmt(s.V)} В</b></div><div class="chip"><small>Ток (сколько течёт)</small><b>${fmt(I, 2)} А</b></div><div class="chip"><small>Мощность (сила колеса)</small><b>${fmt(P, 1)} Вт</b></div>`;
    if (chips.innerHTML !== html) chips.innerHTML = html;
    const msg = `Ток = напряжение ÷ сопротивление = ${fmt(s.V)} ÷ ${fmt(s.R)} = ${fmt(I, 2)} А. Мощность = напряжение × ток = ${fmt(s.V)} × ${fmt(I, 2)} = ${fmt(P, 1)} Вт.`;
    if (read.textContent !== msg) read.textContent = msg;
  });
  return { destroy: () => L.stop() };
}
