// Гл. 7. Сколько лететь: ёмкость, ток, мощность, запас 20–30 %, вес второй батареи.
import { loop, choice, slider, button, clamp, fmt } from "../labkit.mjs";

export const meta = {
  id: "energy",
  title: "Сколько я пролечу?",
  missions: [
    { id: "ten", text: "Подбери батарею и стиль полёта, чтобы честно (с запасом) лететь 10 минут или больше" },
    { id: "double", text: "Поставь две батареи параллельно. Время выросло ровно вдвое?" },
    { id: "kw", text: "Найди режим, где мощность больше 1000 Вт" },
    { id: "weak", text: "Найди батарею, которой не хватает тока на максимуме (горит красным)" },
  ],
};

const PACKS = {
  "4s1300": { name: "4S 1300 мА·ч 100C", s: 4, mah: 1300, c: 100, g: 160 },
  "6s1300": { name: "6S 1300 мА·ч 100C", s: 6, mah: 1300, c: 100, g: 230 },
  "6s6000": { name: "6S 6000 мА·ч 15C", s: 6, mah: 6000, c: 15, g: 850 },
  "6s6000x2": { name: "2 × 6S 6000 параллельно", s: 6, mah: 12000, c: 15, g: 1700 },
};
const STYLES = [
  ["calm", "плавно", 0.25],
  ["cruise", "крейсер", 0.5],
  ["cargo", "груз / ветер", 0.75],
  ["max", "максимум", 1],
];
const DRONE_G = 700; // рама, моторы, электроника

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 200" class="lab-svg" role="img" aria-label="Батарея как бак топлива и дрон, который летит, пока есть заряд">
    <rect width="360" height="200" class="lab-field"/><g id="tank"></g><g id="path"></g><g id="drone"></g></svg></div>
    <div class="lab-ctl"></div><div class="lab-steps" id="steps"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const ctl = $(".lab-ctl");
  const s = { pack: "6s1300", style: "cruise", fly: 0, running: false, seen: {} };
  choice(ctl, { label: "Батарея", options: Object.entries(PACKS).map(([k, p]) => [k, p.name]), value: s.pack, onPick: (v) => { s.pack = v; s.fly = 0; } });
  choice(ctl, { label: "Как летим", options: STYLES.map(([k, l]) => [k, l]), value: s.style, onPick: (v) => { s.style = v; s.fly = 0; } });
  const row = document.createElement("div");
  row.className = "lab-row";
  ctl.appendChild(row);
  const startBtn = button(row, "Взлёт ▶", () => { s.fly = 0; s.running = true; });
  const calc = (key = s.pack) => {
    const p = PACKS[key];
    const mass = DRONE_G + p.g;
    const pHover = 230 * Math.pow(mass / 930, 1.5); // Вт: мощность висения растёт как масса^1,5 (оценка, гл. 7)
    const pMax = 2260 * (p.s === 4 ? 0.45 : 1); // Вт на полном газу: на 4S моторы крутятся медленнее (оценка)
    const load = STYLES.find((x) => x[0] === s.style)[2];
    const V = 3.7 * p.s;
    const P0 = pHover + (pMax - pHover) * load ** 3; // мощность винта растёт как обороты³
    const I = P0 / V, imax = pMax / V;
    const tPaper = (p.mah / (I * 1000)) * 60;
    const tReal = tPaper * 0.8;
    const P = P0;
    const canGive = (p.mah / 1000) * p.c;
    return { p, mass, imax, I, V, tPaper, tReal, P, canGive, load };
  };
  const L = loop(root, (dt, calm) => {
    const c = calc();
    if (c.tReal >= 10) ctx.done("ten");
    if (s.pack === "6s6000x2") ctx.done("double");
    if (c.P > 1000) ctx.done("kw");
    if (c.imax > c.canGive && s.style === "max") ctx.done("weak");
    if (s.running) s.fly = calm ? 1 : Math.min(1, s.fly + dt / 6);
    if (s.fly >= 1) s.running = false;
    const left = 1 - 0.8 * s.fly; // ось — честное время tReal: к его концу в баке остаётся запас 20 %
    // Бак: уровень = остаток; последние 20 % — красная зона «не высаживать».
    $("#tank").innerHTML = `<rect x="20" y="30" width="56" height="140" rx="8" class="w-tank"/><rect x="24" y="${34 + 132 * (1 - left)}" width="48" height="${132 * left}" rx="4" class="${left < 0.2001 ? "e-low" : "w-water"}"/><path d="M20 ${34 + 132 * 0.8}h56" class="e-reserve"/><text x="48" y="22" class="lt" text-anchor="middle">заряд</text><text x="82" y="${38 + 132 * 0.8}" class="lab-small">запас 20 %</text><rect x="38" y="24" width="20" height="6" rx="2" class="w-tank"/>`;
    const x = 110 + s.fly * 220;
    $("#path").innerHTML = `<path d="M110 150H330" class="e-path"/>${[0, 0.25, 0.5, 0.75, 1].map((f) => `<path d="M${110 + f * 220} 146v8" class="lab-tick"/><text x="${110 + f * 220}" y="168" class="lab-small" text-anchor="middle">${fmt(c.tReal * f, 1)} мин</text>`).join("")}`;
    const bob = Math.sin(performance.now() / 300) * (s.running ? 3 : 0);
    $("#drone").innerHTML = `<g transform="translate(${x.toFixed(1)} ${(110 + bob).toFixed(1)})"><path d="M-22 0H22M-16 -6 16 6M16 -6 -16 6" class="fly-arm"/><rect x="-10" y="-6" width="20" height="12" rx="3" class="fly-body"/><ellipse cx="-22" cy="-4" rx="10" ry="2.5" class="fly-disc"/><ellipse cx="22" cy="-4" rx="10" ry="2.5" class="fly-disc"/><rect x="-9" y="6" width="18" height="${c.p.g > 800 ? 14 : 7}" rx="2" class="${c.p.g > 800 ? "e-heavy" : "fly-body"}"/></g><text x="330" y="40" class="lt" text-anchor="end">масса ${fmt(c.mass)} г</text>`;
    const red = c.imax > c.canGive;
    const steps = `<div class="step"><small>1. Ток в полёте</small><b>${fmt(c.I, 1)} А</b><span>чем тяжелее и резче полёт, тем больше</span></div>
      <div class="step"><small>2. Время на бумаге = мА·ч ÷ мА × 60</small><b>${fmt(c.p.mah)} ÷ ${fmt(c.I * 1000)} × 60 = ${fmt(c.tPaper, 1)} мин</b></div>
      <div class="step"><small>3. Честно: ×0,8 (батарею не высаживают до нуля)</small><b>${fmt(c.tReal, 1)} мин</b></div>
      <div class="step"><small>4. Мощность = вольты × амперы</small><b>${fmt(c.V, 1)} × ${fmt(c.I, 1)} = ${fmt(c.P)} Вт</b></div>
      <div class="step ${red ? "bad" : ""}"><small>5. Хватит ли тока на максимуме? ёмкость (А·ч) × C</small><b>${fmt(c.canGive)} А ${red ? "<" : "≥"} ${fmt(c.imax)} А ${red ? "— НЕ хватит" : "— хватит"}</b></div>`;
    if ($("#steps").innerHTML !== steps) $("#steps").innerHTML = steps;
    // Во сколько раз выросло время по сравнению с одной батареей 6S 6000 при том же стиле полёта.
    const gain = s.pack === "6s6000x2" ? c.tReal / calc("6s6000").tReal : 1;
    const msg = s.pack === "6s6000x2"
      ? gain > 1.98
        ? `На максимуме моторы и так отдают всю мощность, и ток тот же — поэтому время ровно ×${fmt(gain, 1)}. Но дрон потяжелел на ${fmt(PACKS["6s6000"].g)} г и разгоняется хуже. Выбери «крейсер»: там прибавка меньше чем вдвое.`
        : `Ёмкость стала вдвое больше, но дрон потяжелел на ${fmt(PACKS["6s6000"].g)} г и берёт больший ток — поэтому время выросло только в ${fmt(gain, 1)} раза, а не вдвое.`
      : s.running ? "Летим… Смотри, как убывает бак." : s.fly >= 1 ? `Посадка через ${fmt(c.tReal, 1)} мин: честное время вышло, в баке остался запас 20 %.` : "Нажми «Взлёт» и смотри, как тратится заряд.";
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
