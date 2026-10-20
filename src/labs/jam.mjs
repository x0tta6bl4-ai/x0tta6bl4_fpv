// Гл. 13. Помеха бьёт по приёмнику; ППРЧ; холм и ретранслятор; поднятая антенна.
import { loop, toggle, slider, drag, clamp, fmt } from "../labkit.mjs";

export const meta = {
  id: "jam",
  title: "Кого глушит помеха",
  missions: [
    { id: "neartx", text: "Перетащи глушилку вплотную к пульту. Управление дроном живо?" },
    { id: "kill", text: "Теперь подвинь глушилку к дрону, чтобы управление пропало" },
    { id: "fhss", text: "Глушилка рядом с дроном, но управление работает. Как? (подсказка: ППРЧ)" },
    { id: "relay", text: "Опусти дрон за холм и верни связь ретранслятором" },
  ],
};
const KM = 0.02; // 1 точка схемы = 20 м

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 240" class="lab-svg" role="img" aria-label="Вид сбоку: оператор, холм, дрон и глушилка, которую можно двигать">
    <rect width="360" height="240" class="lab-field"/><g id="land"></g><g id="links"></g><g id="who"></g><g id="hud"></g></svg></div>
    <p class="lab-hint">Глушилку (красную) и дрон можно двигать пальцем. Высоты на схеме растянуты в 10 раз, чтобы их было видно.</p>
    <div class="lab-ctl"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const svg = $("svg"), ctl = $(".lab-ctl");
  const G = 200; // уровень земли
  const s = { op: [34, G], dr: [300, 70], jm: [150, 40], mast: 0, hill: 70, fhss: false, relay: false, t: 0 };
  slider(ctl, { label: "Высота холма", min: 0, max: 130, step: 5, value: s.hill, fmt: (v) => `${fmt(v * 2)} м`, onInput: (v) => (s.hill = v) });
  slider(ctl, { label: "Мачта антенны оператора (вынос вверх)", min: 0, max: 60, step: 2, value: 0, fmt: (v) => `${fmt(v * 2)} м`, onInput: (v) => (s.mast = v) });
  toggle(ctl, { label: "ППРЧ: связь прыгает по частотам (как ELRS)", value: false, onToggle: (v) => (s.fhss = v) });
  toggle(ctl, { label: "Ретранслятор на вершине холма", value: false, onToggle: (v) => (s.relay = v) });
  const hitJ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const hitD = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  [hitJ, hitD].forEach((h) => { h.setAttribute("r", "22"); h.setAttribute("class", "lab-hit"); svg.appendChild(h); });
  drag(svg, hitJ, (x, y) => { s.jm = [clamp(x, 10, 350), clamp(y, 14, G - 6)]; });
  drag(svg, hitD, (x, y) => { s.dr = [clamp(x, 200, 345), clamp(y, 20, G - 8)]; });
  const hillY = (x) => G - s.hill * Math.exp(-(((x - 170) / 42) ** 2));
  const blocked = (a, b) => {
    for (let k = 1; k < 40; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / 40, y = a[1] + ((b[1] - a[1]) * k) / 40;
      if (y > hillY(x) - 2) return true;
    }
    return false;
  };
  const dist = (a, b) => Math.max(0.05, Math.hypot(a[0] - b[0], (a[1] - b[1]) / 10) * KM); // высоты растянуты в 10 раз: по вертикали 1 точка = 2 м
  // Сигнал на входе приёмника против помехи там же. Пульт 1 Вт, глушилка 20 мВт, холм −30 дБ.
  const link = (tx, rx, ppr) => {
    const sig = 30 - 20 * Math.log10(dist(tx, rx)) - (blocked(tx, rx) ? 30 : 0);
    const jam = 13 - 20 * Math.log10(dist(s.jm, rx)) - (ppr ? 20 : 0);
    const snr = sig - jam;
    return { ok: sig > -10 && snr > 6, snr, sig, weak: sig <= -10 };
  };
  const L = loop(root, (dt, calm) => {
    if (!calm) s.t += dt;
    const ant = [s.op[0], G - 22 - s.mast];
    const top = [170, hillY(170) - 14];
    const direct = link(ant, s.dr, s.fhss);
    const viaRelay = s.relay ? (() => { const a = link(ant, top, s.fhss), b = link(top, s.dr, s.fhss); return { ok: a.ok && b.ok, a, b }; })() : null;
    const ctrlOk = direct.ok || (viaRelay && viaRelay.ok);
    // Видео идёт обратно: приёмник у оператора, глушилка рядом с ним — бьёт по видео.
    const video = link(s.dr, ant, false);
    const dJop = dist(s.jm, s.op), dJdr = dist(s.jm, s.dr);
    if (dJop < 0.6 && ctrlOk) ctx.done("neartx");
    if (!ctrlOk && !direct.weak && dJdr < dJop) ctx.done("kill");
    if (s.fhss && ctrlOk && dJdr < 0.9) ctx.done("fhss");
    if (s.relay && !direct.ok && blocked(ant, s.dr) && ctrlOk) ctx.done("relay");
    // Земля, холм.
    let hp = `M0 ${G}`;
    for (let x = 0; x <= 360; x += 6) hp += `L${x} ${hillY(x).toFixed(1)}`;
    $("#land").innerHTML = `<path d="${hp}L360 240H0Z" class="hill"/><path d="M0 ${G}H360" class="w-ground"/>`;
    // Линии связи.
    const line = (a, b, ok, cls) => `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="${cls} ${ok ? "ok" : "bad"}"/>`;
    let l = "";
    if (viaRelay) l += line(ant, top, viaRelay.a.ok, "ln-ctl") + line(top, s.dr, viaRelay.b.ok, "ln-ctl");
    else l += line(ant, s.dr, direct.ok, "ln-ctl");
    l += `<path d="M${s.dr[0]} ${s.dr[1] + 8}L${ant[0] + 6} ${ant[1] + 10}" class="ln-vid ${video.ok ? "ok" : "bad"}"/>`;
    // Круги от глушилки.
    for (let i = 0; i < 3; i++) {
      const r = ((s.t * 30 + i * 20) % 60) + 6;
      l += `<circle cx="${s.jm[0]}" cy="${s.jm[1]}" r="${r.toFixed(1)}" class="jam-ring" style="opacity:${(1 - r / 66).toFixed(2)}"/>`;
    }
    $("#links").innerHTML = l;
    // Оператор, мачта, ретранслятор, дрон, глушилка.
    let w = `<path d="M${s.op[0]} ${G}v-14" class="person-b"/><circle cx="${s.op[0]}" cy="${G - 20}" r="6" class="person"/><path d="M${ant[0] + 8} ${G}V${ant[1]}" class="wv-ant"/><text x="${s.op[0]}" y="${G + 16}" class="lab-small" text-anchor="middle">оператор</text>`;
    if (s.relay) w += `<path d="M170 ${hillY(170)}V${top[1]}" class="wv-ant"/><rect x="162" y="${top[1] - 8}" width="16" height="10" rx="2" class="fly-body"/><text x="170" y="${top[1] - 12}" class="lab-small" text-anchor="middle">ретранслятор</text>`;
    w += `<g transform="translate(${s.dr[0]} ${s.dr[1]})"><path d="M-16 0H16" class="fly-arm"/><rect x="-7" y="-4" width="14" height="9" rx="2" class="fly-body"/><ellipse cx="-16" cy="-3" rx="9" ry="2.2" class="fly-disc"/><ellipse cx="16" cy="-3" rx="9" ry="2.2" class="fly-disc"/></g>`;
    w += `<g transform="translate(${s.jm[0]} ${s.jm[1]})"><rect x="-9" y="-7" width="18" height="14" rx="3" class="jammer"/><path d="M4 -7V-18" class="wv-ant"/></g>`;
    $("#who").innerHTML = w;
    hitJ.setAttribute("cx", s.jm[0]); hitJ.setAttribute("cy", s.jm[1]);
    hitD.setAttribute("cx", s.dr[0]); hitD.setAttribute("cy", s.dr[1]);
    const lamp = (x, label, ok) => `<rect x="${x}" y="8" width="112" height="24" rx="12" class="${ok ? "lamp ok" : "lamp bad"}"/><text x="${x + 56}" y="24" class="lab-small" text-anchor="middle">${label}: ${ok ? "есть" : "нет"}</text>`;
    $("#hud").innerHTML = lamp(8, "управление", ctrlOk) + lamp(126, "видео", video.ok) + `<text x="352" y="24" class="lab-small" text-anchor="end">${fmt(dist(s.op, s.dr), 1)} км</text>`;
    // Почему пропало управление: холм на пути (прямом или через ретранслятор) или глушилка.
    const hillCut = !ctrlOk && (viaRelay ? blocked(ant, top) || blocked(top, s.dr) : blocked(ant, s.dr));
    const msg = hillCut && !viaRelay
      ? "Холм закрывает дрон: радиоволны этих частот плохо огибают препятствия. Подними антенну (вынос вверх) или поставь ретранслятор на вершину."
      : hillCut
        ? "Даже с вершины холма дрон не виден: склон закрывает путь от ретранслятора. Подними дрон выше или отведи его от склона."
      : !ctrlOk
        ? "Глушилка рядом с дроном перекрикивает пульт прямо у приёмника на дроне — управление пропало."
        : dJop < 0.6
          ? `Глушилка у пульта, а управление живо: помеха действует на ПРИЁМНИК, а приёмник управления — на дроне. Зато видео ${video.ok ? "держится" : "пропало"}: его приёмник — у оператора.`
          : s.fhss && dJdr < 0.9
            ? "ППРЧ: связь всё время прыгает по частотам, и узкая помеха попадает лишь изредка. Против широкой глушилки, которая забивает весь диапазон, ППРЧ не помогает."
            : "Зелёная линия — управление (к дрону), синяя пунктирная — видео (от дрона к оператору).";
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
