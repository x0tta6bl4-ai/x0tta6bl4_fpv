// Гл. 8. Волны и антенны: длина волны, четвертьволновая антенна, поляризация.
import { loop, choice, slider, toggle, clamp, fmt, TAU, drag } from "../labkit.mjs";

export const meta = {
  id: "waves",
  title: "Волна, антенна и поворот",
  missions: [
    { id: "a915", text: "Подбери длину антенны под 915 МГц (антенна загорится)" },
    { id: "a58", text: "Теперь подбери антенну под 5,8 ГГц" },
    { id: "cross", text: "Поверни антенну приёмника так, чтобы сигнал почти пропал" },
    { id: "circ", text: "Поставь круговую антенну на передатчик. Сколько сигнала осталось?" },
  ],
};
const FREQS = [[433, "433 МГц"], [915, "915 МГц"], [2400, "2,4 ГГц"], [5800, "5,8 ГГц"]];

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 330" class="lab-svg" role="img" aria-label="Волна, линейка и антенна; ниже две антенны и полоска силы сигнала">
    <rect width="360" height="330" class="lab-field"/>
    <g id="wave"></g><g id="ruler"></g><g id="ant"></g><path d="M0 170H360" class="lab-sep"/><g id="pol"></g></svg></div>
    <div class="lab-ctl"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const svg = $("svg");
  const ctl = $(".lab-ctl");
  const s = { f: 915, len: 3, t: 0, ang: 0, circ: false, done58: false };
  choice(ctl, { label: "Частота", options: FREQS, value: s.f, onPick: (v) => (s.f = v) });
  const lenS = slider(ctl, { label: "Длина антенны (тяни и на схеме)", min: 0.5, max: 25, step: 0.1, value: s.len, fmt: (v) => `${fmt(v, 1)} см`, onInput: (v) => (s.len = v) });
  slider(ctl, { label: "Поворот антенны приёмника", min: 0, max: 90, step: 1, value: 0, fmt: (v) => `${v}°`, onInput: (v) => (s.ang = v) });
  toggle(ctl, { label: "Круговая антенна на передатчике («клевер»)", value: false, onToggle: (v) => (s.circ = v) });
  // Тянуть кончик антенны пальцем.
  const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  handle.setAttribute("class", "lab-hit");
  svg.appendChild(handle);
  drag(svg, handle, (x, y) => {
    const cm = clamp((150 - y) / 4.4, 0.5, 25);
    s.len = Math.round(cm * 10) / 10;
    lenS.set(s.len);
  });
  const L = loop(root, (dt, calm) => {
    if (!calm) s.t += dt;
    const lam = 30000 / s.f; // см
    const quarter = lam / 4;
    const ok = Math.abs(s.len - quarter) / quarter < 0.1;
    if (ok && s.f === 915) ctx.done("a915");
    if (ok && s.f === 5800) ctx.done("a58");
    // Волна: длина на экране пропорциональна λ (33 см ≈ 150 px).
    const px = lam * 4.4;
    let d = "";
    for (let x = 10; x <= 250; x += 2) d += `${x === 10 ? "M" : "L"}${x} ${(70 + Math.sin(((x - 10) / px) * TAU - s.t * 6) * 26).toFixed(1)}`;
    $("#wave").innerHTML = `<path d="${d}" class="wv-line"/><text x="12" y="24" class="lt" text-anchor="start">Волна ${FREQS.find((q) => q[0] === s.f)[1]}: длина ${fmt(lam, 1)} см</text>${px < 240 ? `<path d="M10 112h${px.toFixed(1)}" class="wv-dim"/><path d="M10 107v10M${(10 + px).toFixed(1)} 107v10" class="wv-dim"/><text x="${(10 + px / 2).toFixed(1)}" y="128" class="lab-small" text-anchor="middle">одна волна</text>` : `<text x="130" y="128" class="lab-small" text-anchor="middle">волна длиннее экрана</text>`}`;
    // Антенна справа на линейке (1 см = 4,4 px).
    const top = 150 - s.len * 4.4;
    const tq = 150 - quarter * 4.4;
    let r = `<path d="M300 150V40" class="lab-ruler"/>`;
    for (let c = 0; c <= 25; c++) r += `<path d="M300 ${150 - c * 4.4}h${c % 5 ? 4 : 8}" class="lab-tick"/>${c % 5 ? "" : `<text x="312" y="${154 - c * 4.4}" class="lab-small">${c}</text>`}`;
    r += quarter <= 25 ? `<path d="M286 ${tq.toFixed(1)}h12" class="wv-target"/><text x="282" y="${(tq + 4).toFixed(1)}" class="lab-small" text-anchor="end">¼ λ</text>` : "";
    $("#ruler").innerHTML = r + `<text x="330" y="168" class="lab-small" text-anchor="end">см</text>`;
    $("#ant").innerHTML = `<rect x="262" y="146" width="18" height="10" rx="2" class="fly-body"/><path d="M271 146V${top.toFixed(1)}" class="${ok ? "wv-ant ok" : "wv-ant"}"/><circle cx="271" cy="${top.toFixed(1)}" r="5" class="${ok ? "wv-tip ok" : "wv-tip"}"/>${ok ? `<text x="240" y="${(top - 8).toFixed(1)}" class="lt good" text-anchor="middle">резонанс!</text>` : ""}`;
    handle.setAttribute("x", "250");
    handle.setAttribute("y", String(top - 14));
    handle.setAttribute("width", "44");
    handle.setAttribute("height", "28");
    // Поляризация: передатчик слева (линейная вертикальная или круговая), приёмник справа (повернуть).
    const lin = Math.cos((s.ang * Math.PI) / 180) ** 2;
    const sig = s.circ ? 0.5 : lin;
    if (!s.circ && sig < 0.05) ctx.done("cross");
    if (s.circ) ctx.done("circ");
    const ra = (s.ang * Math.PI) / 180;
    let p = `<text x="70" y="195" class="lt">передатчик</text><text x="290" y="195" class="lt">приёмник</text>`;
    p += `<rect x="58" y="282" width="24" height="12" rx="2" class="fly-body"/>`;
    if (s.circ) {
      const k = s.t * 3;
      p += `<path d="M70 282V250" class="wv-ant"/>`;
      for (let i = 0; i < 3; i++) {
        const a = k + (i * TAU) / 3;
        p += `<ellipse cx="${70 + Math.cos(a) * 8}" cy="${240 + Math.sin(a) * 3}" rx="9" ry="6" class="wv-lobe"/>`;
      }
    } else p += `<path d="M70 282V214" class="wv-ant"/>`;
    p += `<rect x="278" y="282" width="24" height="12" rx="2" class="fly-body"/><path d="M290 282L${(290 + Math.sin(ra) * 68).toFixed(1)} ${(282 - Math.cos(ra) * 68).toFixed(1)}" class="wv-ant"/>`;
    // Волна между антеннами: высота показывает, сколько дошло.
    let w = "";
    for (let x = 100; x <= 260; x += 2) w += `${x === 100 ? "M" : "L"}${x} ${(250 + Math.sin((x / 18) - s.t * 7) * 16 * (s.circ ? 1 : 1)).toFixed(1)}`;
    p += `<path d="${w}" class="wv-line" style="opacity:.6"/>`;
    p += `<rect x="100" y="300" width="160" height="12" rx="6" class="lab-track"/><rect x="100" y="300" width="${(160 * sig).toFixed(1)}" height="12" rx="6" class="${sig < 0.1 ? "lab-fill bad" : "lab-fill"}"/><text x="180" y="326" class="lab-small" text-anchor="middle">дошло ${fmt(sig * 100)} % сигнала${s.circ ? " (−3 дБ)" : ""}</text>`;
    $("#pol").innerHTML = p;
    const msg = ok
      ? `Антенна ${fmt(s.len, 1)} см — это четверть волны (${fmt(quarter, 1)} см). Такая антенна «звучит в такт» волне и работает лучше всего.`
      : `Нужна антенна около ¼ длины волны: ${fmt(quarter, 1)} см. Чем выше частота, тем короче волна и тем короче антенна.`;
    const pol = s.circ ? " Круговая + линейная: теряется половина мощности." : s.ang > 75 ? " Антенны крест-накрест — почти ничего не доходит, как через два поляризационных стекла под 90°." : "";
    const all = msg + pol;
    if ($(".lab-read").textContent !== all) $(".lab-read").textContent = all;
  });
  return { destroy: () => L.stop() };
}
