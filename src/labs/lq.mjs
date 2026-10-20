// Гл. 11. RSSI (громкость) против LQ (разборчивость), packet rate и чувствительность.
import { loop, choice, slider, toggle, clamp, fmt } from "../labkit.mjs";

export const meta = {
  id: "lq",
  title: "Громко ≠ разборчиво",
  missions: [
    { id: "loud", text: "Сделай так: сигнал громкий (RSSI ближе к нулю, чем −80 dBm, например −70), а LQ ниже 80 %" },
    { id: "far", text: "Улети на 30 км и держи LQ не ниже 95 %" },
    { id: "d50", text: "При сильных помехах (6 и больше) подними LQ выше 85 % без изменения расстояния" },
    { id: "lost", text: "Включи 500 Гц и найди расстояние, где связь пропадает" },
  ],
};
// Чувствительность ELRS (по книге): чем медленнее пакеты, тем тише сигнал можно разобрать.
const RATES = {
  25: { l: "25 Гц", sens: -123, f: 915, hz: 25 },
  50: { l: "50 Гц", sens: -120, f: 915, hz: 50 },
  D50: { l: "D50", sens: -112, f: 915, hz: 50, dup: true },
  500: { l: "500 Гц (2,4 ГГц)", sens: -105, f: 2440, hz: 500 },
};

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 240" class="lab-svg" role="img" aria-label="Пульт отправляет пакеты дрону; часть теряется. Справа шкалы RSSI и LQ">
    <rect width="360" height="240" class="lab-field"/><g id="scene"></g><g id="pk"></g><g id="meters"></g></svg></div>
    <div class="lab-ctl"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const ctl = $(".lab-ctl");
  const s = { d: 2, noise: 0, rate: 50, forest: false, pk: [], acc: 0, lq: 100, seen: 0 };
  choice(ctl, { label: "Packet rate — сколько пакетов в секунду", options: Object.entries(RATES).map(([k, r]) => [k, r.l]), value: "50", onPick: (v) => (s.rate = v) });
  slider(ctl, { label: "Расстояние до дрона", min: 0.2, max: 40, step: 0.1, value: s.d, fmt: (v) => `${fmt(v, 1)} км`, onInput: (v) => (s.d = v) });
  slider(ctl, { label: "Помехи (толкучка в эфире)", min: 0, max: 10, step: 1, value: 0, fmt: (v) => (v ? `${v} из 10` : "нет"), onInput: (v) => (s.noise = v) });
  toggle(ctl, { label: "Между нами лес", value: false, onToggle: (v) => (s.forest = v) });
  const calc = () => {
    const r = RATES[s.rate];
    // 1 Вт (30 dBm), антенны по 2 dBi, потери в свободном пространстве + запас на землю и реальный мир 20 дБ.
    const fspl = 20 * Math.log10(s.d) + 20 * Math.log10(r.f) + 32.44;
    const rssi = 30 + 4 - fspl - 20 - (s.forest ? 15 : 0);
    const sensEff = r.sens + s.noise * 2; // помехи поднимают «шумовой пол»: тихий сигнал тонет раньше
    const margin = rssi - sensEff;
    const pSig = 1 / (1 + Math.exp(-(margin - 2) / 1.5)); // пакет «услышан» над порогом
    let pNoise = 1 - clamp(s.noise * 0.045, 0, 0.9); // помеха «съедает» пакет целиком
    if (r.dup) pNoise = 1 - (1 - pNoise) ** 4; // D50: каждый пакет четыре раза на разных частотах — спасает от помех, но не от тишины
    const p = pSig * pNoise;
    return { r, rssi, margin, sensEff, lq: Math.round(p * 100) };
  };
  const L = loop(root, (dt, calm) => {
    const c = calc();
    s.lq = c.lq;
    if (c.rssi > -80 && c.lq < 80) ctx.done("loud");
    if (s.d >= 30 && c.lq >= 95) ctx.done("far");
    if (s.noise >= 6 && c.lq > 85 && s.rate === "D50") ctx.done("d50");
    if (s.rate === "500" && c.lq === 0) ctx.done("lost");
    // Пакеты: летят от пульта к дрону; потерянные гаснут посередине.
    const speed = c.r.hz >= 500 ? 9 : c.r.hz >= 50 ? 3 : 1.6;
    if (!calm) {
      s.acc += dt * speed;
      while (s.acc >= 1) {
        s.acc -= 1;
        s.pk.push({ x: 0, ok: Math.random() * 100 < c.lq, dup: !!c.r.dup });
      }
      s.pk.forEach((p) => (p.x += dt * 0.55));
      s.pk = s.pk.filter((p) => p.x < 1);
    }
    const X0 = 50, X1 = 250;
    $("#scene").innerHTML = `<rect x="18" y="96" width="48" height="34" rx="9" class="fly-body"/><path d="M58 96V70" class="wv-ant"/><text x="42" y="148" class="lt" text-anchor="middle">пульт</text>
      <g transform="translate(268 110)"><path d="M-18 -8H18M-14 4H14" class="fly-arm"/><rect x="-8" y="-6" width="16" height="12" rx="3" class="fly-body"/><ellipse cx="-18" cy="-10" rx="10" ry="2.5" class="fly-disc"/><ellipse cx="18" cy="-10" rx="10" ry="2.5" class="fly-disc"/></g><text x="268" y="148" class="lt" text-anchor="middle">дрон · ${fmt(s.d, 1)} км</text>
      ${s.forest ? [110, 130, 150, 170, 190].map((x, i) => `<path d="M${x} 136l9 -${24 + (i % 2) * 8} 9 ${24 + (i % 2) * 8}z" class="tree"/>`).join("") : ""}
      ${s.noise ? Array.from({ length: s.noise * 3 }, (_, i) => `<circle cx="${(90 + ((i * 53) % 150)).toFixed(0)}" cy="${(64 + ((i * 37) % 70)).toFixed(0)}" r="${2 + (i % 3)}" class="noise-dot"/>`).join("") : ""}`;
    $("#pk").innerHTML = s.pk
      .map((p) => {
        const x = X0 + (X1 - X0) * p.x, y = 104 - Math.sin(p.x * Math.PI) * 26;
        if (!p.ok && p.x > 0.5) return `<path d="M${x - 4} ${y - 4}l8 8m0 -8l-8 8" class="pk-lost"/>`;
        return `<rect x="${(x - 5).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="10" height="6" rx="2" class="pk"/>${p.dup ? `<rect x="${(x - 5).toFixed(1)}" y="${(y + 5).toFixed(1)}" width="10" height="6" rx="2" class="pk"/>` : ""}`;
      })
      .join("");
    // Шкалы: RSSI в dBm с отметкой чувствительности и тревоги; LQ в процентах.
    const sx = (v) => 20 + ((clamp(v, -130, -30) + 130) / 100) * 320;
    let m = `<text x="20" y="176" class="lab-small" text-anchor="start">RSSI — громкость: ${fmt(c.rssi)} dBm (ближе к нулю — громче)</text><rect x="20" y="182" width="320" height="10" rx="5" class="lab-track"/><rect x="20" y="182" width="${(sx(c.rssi) - 20).toFixed(1)}" height="10" rx="5" class="lab-fill"/>`;
    m += `<path d="M${sx(c.sensEff)} 178v18" class="mk-bad"/><text x="${sx(c.sensEff)}" y="206" class="lab-small" text-anchor="middle">предел ${fmt(c.sensEff)}${s.noise ? " (с помехами)" : ""}</text><path d="M${sx(c.sensEff + 10)} 178v18" class="mk-warn"/>`;
    m += `<text x="20" y="222" class="lab-small" text-anchor="start">LQ — разборчивость: дошло ${c.lq} пакетов из 100</text><rect x="20" y="228" width="320" height="10" rx="5" class="lab-track"/><rect x="20" y="228" width="${(3.2 * c.lq).toFixed(1)}" height="10" rx="5" class="${c.lq < 50 ? "lab-fill bad" : c.lq < 70 ? "lab-fill warn" : "lab-fill"}"/>`;
    m += `<rect x="286" y="10" width="64" height="36" rx="6" class="lab-hud"/><text x="318" y="25" class="lab-small" text-anchor="middle">в очках</text><text x="318" y="40" class="lt" text-anchor="middle">LQ ${c.lq}</text>`;
    $("#meters").innerHTML = m;
    const msg = c.lq === 0
      ? "Связь потеряна: сигнал тише предела, ни один пакет не разобран. Дрон уходит в Failsafe."
      : c.rssi > -80 && c.lq < 80
        ? "Громко, но неразборчиво: RSSI отличный, а помехи «съедают» пакеты. Смотри на LQ — это главный показатель."
        : c.margin < 0
          ? `Сигнал уже на ${fmt(-c.margin)} дБ тише предела — доходят лишь редкие пакеты. Срочно возвращайся! Медленнее пакеты (25 или 50 Гц) — слышно дальше.`
        : c.margin < 10
          ? `До предела всего ${fmt(c.margin)} дБ. Пора возвращаться! Медленнее пакеты (25 или 50 Гц) — слышно дальше.`
          : s.rate === "D50" ? "D50 шлёт каждый пакет четыре раза на разных частотах: в толкучке почти все доходят, но предел хуже (−112), значит, дальность меньше." : "Каждый квадратик — пакет с командами. Красный крестик — потерян.";
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
