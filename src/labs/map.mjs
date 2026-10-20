// Гл. 19. Масштаб карты, ветер «откуда», температура с высотой.
import { loop, choice, slider, drag, clamp, fmt } from "../labkit.mjs";

export const meta = {
  id: "map",
  title: "Карта, ветер и высота",
  missions: [
    { id: "km50", text: "На карте 1:50 000 отмерь ровно 1 км (двигай точки А и Б)" },
    { id: "cm25", text: "Переключи на 1:25 000 и поставь точки в 4 см друг от друга. Сколько это метров?" },
    { id: "wind", text: "Ветер южный. Нажми на сторону, куда снесёт дрон" },
    { id: "zero", text: "У земли +3 °C. Найди высоту, где будет 0 °C" },
  ],
};
const CM = 36; // точек схемы в 1 см карты
const SCALES = [[25000, "1:25 000"], [50000, "1:50 000"], [100000, "1:100 000"]];
const WINDS = [["N", "северный"], ["S", "южный"], ["W", "западный"], ["E", "восточный"]];
const SIDES = { N: [180, 22, "С"], S: [180, 138, "Ю"], W: [100, 80, "З"], E: [260, 80, "В"] };
const OPP = { N: "S", S: "N", W: "E", E: "W" };

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage nosticky"><svg viewBox="0 0 360 230" class="lab-svg" id="mapsvg" role="img" aria-label="Карта с сеткой, две точки и линейка между ними">
    <rect width="360" height="230" class="map-bg"/><g id="grid"></g><g id="feat"></g><g id="ruler"></g></svg></div>
    <div class="lab-ctl" id="c1"></div><div class="lab-chips" id="calc"></div>
    <div class="lab-stage"><svg viewBox="0 0 360 160" class="lab-svg" id="wsvg" role="img" aria-label="Компас: стороны света и стрелка ветра"><rect width="360" height="160" class="lab-field"/><g id="wind"></g></svg></div>
    <div class="lab-ctl" id="c2"></div>
    <div class="lab-stage"><svg viewBox="0 0 360 150" class="lab-svg" role="img" aria-label="Шкала высоты и градусник"><rect width="360" height="150" class="lab-field"/><g id="temp"></g></svg></div>
    <div class="lab-ctl" id="c3"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const s = { A: [70, 160], B: [124, 160], sc: 50000, wind: "S", guess: null, h: 0, t: 0 };
  choice($("#c1"), { label: "Масштаб карты", options: SCALES, value: s.sc, onPick: (v) => (s.sc = v) });
  choice($("#c2"), { label: "Откуда дует ветер", options: WINDS, value: s.wind, onPick: (v) => { s.wind = v; s.guess = null; } });
  slider($("#c3"), { label: "Высота полёта", min: 0, max: 1000, step: 10, value: 0, fmt: (v) => `${v} м`, onInput: (v) => (s.h = v) });
  const msvg = $("#mapsvg");
  const hA = document.createElementNS("http://www.w3.org/2000/svg", "circle"), hB = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  [hA, hB].forEach((h) => { h.setAttribute("r", "20"); h.setAttribute("class", "lab-hit"); msvg.appendChild(h); });
  drag(msvg, hA, (x, y) => (s.A = [clamp(x, 10, 350), clamp(y, 10, 220)]));
  drag(msvg, hB, (x, y) => (s.B = [clamp(x, 10, 350), clamp(y, 10, 220)]));
  let g = "";
  for (let x = 0; x <= 360; x += CM) g += `<path d="M${x} 0V230" class="map-grid"/>`;
  for (let y = 0; y <= 230; y += CM) g += `<path d="M0 ${y}H360" class="map-grid"/>`;
  $("#grid").innerHTML = g;
  $("#feat").innerHTML = `<path d="M0 60C60 40 90 90 150 70S250 20 360 50" class="map-river"/><ellipse cx="270" cy="160" rx="60" ry="34" class="map-forest"/><ellipse cx="270" cy="160" rx="34" ry="18" class="map-contour"/><ellipse cx="270" cy="160" rx="14" ry="7" class="map-contour"/><text x="270" y="200" class="lab-small" text-anchor="middle">лес и холм</text><text x="40" y="44" class="lab-small">река</text><text x="352" y="222" class="lab-small" text-anchor="end">1 клетка = 1 см</text>`;
  $("#wsvg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-side]");
    if (!b) return;
    s.guess = b.dataset.side;
    if (s.wind === "S" && s.guess === "N") ctx.done("wind");
  });
  const L = loop(root, (dt, calm) => {
    if (!calm) s.t += dt;
    const cm = Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]) / CM;
    const mPerCm = s.sc / 100;
    const meters = cm * mPerCm;
    if (s.sc === 50000 && Math.abs(meters - 1000) <= 40) ctx.done("km50");
    if (s.sc === 25000 && Math.abs(cm - 4) <= 0.1) ctx.done("cm25");
    const T = 3 - (0.6 * s.h) / 100;
    if (Math.abs(T) < 0.05) ctx.done("zero");
    const mid = [(s.A[0] + s.B[0]) / 2, (s.A[1] + s.B[1]) / 2];
    $("#ruler").innerHTML = `<path d="M${s.A[0]} ${s.A[1]}L${s.B[0]} ${s.B[1]}" class="map-line"/><circle cx="${s.A[0]}" cy="${s.A[1]}" r="8" class="map-pt"/><circle cx="${s.B[0]}" cy="${s.B[1]}" r="8" class="map-pt"/><text x="${s.A[0]}" y="${s.A[1] - 12}" class="lt" text-anchor="middle">А</text><text x="${s.B[0]}" y="${s.B[1] - 12}" class="lt" text-anchor="middle">Б</text><rect x="${mid[0] - 40}" y="${mid[1] + 8}" width="80" height="20" rx="6" class="lab-hud"/><text x="${mid[0]}" y="${mid[1] + 22}" class="lab-small" text-anchor="middle">${fmt(cm, 1)} см</text>`;
    hA.setAttribute("cx", s.A[0]); hA.setAttribute("cy", s.A[1]);
    hB.setAttribute("cx", s.B[0]); hB.setAttribute("cy", s.B[1]);
    const html = `<div class="chip"><small>1. Масштаб 1:${fmt(s.sc)}: 1 см на карте =</small><b>${fmt(s.sc)} см = ${fmt(mPerCm)} м</b></div><div class="chip"><small>2. На карте</small><b>${fmt(cm, 1)} см</b></div><div class="chip"><small>3. На местности = ${fmt(cm, 1)} × ${fmt(mPerCm)}</small><b>${meters >= 1000 ? fmt(meters / 1000, 2) + " км" : fmt(meters) + " м"}</b></div>`;
    if ($("#calc").innerHTML !== html) $("#calc").innerHTML = html;
    // Компас: ветер дует ОТКУДА назван, дрон сносит в противоположную сторону.
    const from = SIDES[s.wind], to = SIDES[OPP[s.wind]];
    let w = `<circle cx="180" cy="80" r="56" class="compass"/>`;
    for (const [k, [x, y, l]] of Object.entries(SIDES)) w += `<g data-side="${k}" class="side ${s.guess === k ? (k === OPP[s.wind] ? "ok" : "bad") : ""}"><circle cx="${x}" cy="${y}" r="16" class="side-bg"/><text x="${x}" y="${y + 5}" class="lt" text-anchor="middle">${l}</text></g>`;
    const k = (s.t * 0.6) % 1;
    const px = from[0] + (to[0] - from[0]) * (0.2 + k * 0.6), py = from[1] + (to[1] - from[1]) * (0.2 + k * 0.6);
    w += `<path d="M${from[0] + (to[0] - from[0]) * 0.22} ${from[1] + (to[1] - from[1]) * 0.22}L${px.toFixed(1)} ${py.toFixed(1)}" class="wind-arrow"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" class="wind-head"/>`;
    w += `<text x="20" y="30" class="lab-small" text-anchor="start">ветер ${WINDS.find((x) => x[0] === s.wind)[1]}:</text><text x="20" y="46" class="lab-small" text-anchor="start">дует ОТКУДА назван</text>`;
    if (s.guess) w += `<text x="340" y="150" class="lab-small ${s.guess === OPP[s.wind] ? "good" : "bad"}" text-anchor="end">${s.guess === OPP[s.wind] ? "верно — снесёт туда" : (s.guess === s.wind ? "нет: ветер дует ОТ этой стороны" : "нет: дрон несёт по ветру, а не вбок")}</text>`;
    $("#wind").innerHTML = w;
    // Высота и градусник.
    const hy = 130 - s.h * 0.11;
    let t = `<path d="M40 130V20" class="lab-ruler"/>`;
    for (let m = 0; m <= 1000; m += 100) t += `<path d="M40 ${130 - m * 0.11}h${m % 500 ? 5 : 10}" class="lab-tick"/>${m % 500 ? "" : `<text x="54" y="${134 - m * 0.11}" class="lab-small" text-anchor="start">${m} м</text>`}`;
    t += `<g transform="translate(110 ${hy.toFixed(1)})"><path d="M-12 0H12" class="fly-arm"/><rect x="-5" y="-3" width="10" height="7" rx="2" class="fly-body"/></g><path d="M0 130H360" class="w-ground"/>`;
    const tH = clamp((T + 4) / 8, 0, 1) * 90;
    t += `<rect x="280" y="24" width="16" height="96" rx="8" class="w-tank"/><rect x="283" y="${(117 - tH).toFixed(1)}" width="10" height="${tH.toFixed(1)}" rx="5" class="${T < 0 ? "therm cold" : "therm"}"/><circle cx="288" cy="124" r="11" class="${T < 0 ? "therm cold" : "therm"}"/><text x="270" y="60" class="lt" text-anchor="end">${T > 0 ? "+" : ""}${fmt(T, 1)} °C</text><text x="270" y="78" class="lab-small" text-anchor="end">−0,6 °C на 100 м</text>`;
    $("#temp").innerHTML = t;
    const msg = `Расчёт: 3 − 0,6 × ${fmt(s.h / 100, 1)} = ${fmt(T, 1)} °C. ${T < 0 ? "Ниже нуля: батарея отдаёт меньше, возможно обледенение." : ""}`;
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
