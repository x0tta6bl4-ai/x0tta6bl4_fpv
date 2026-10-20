// Эксперимент «Докуда долетит связь» (гл. 9 и 11): один передатчик, одни антенны, одно расстояние —
// три модели распространения волны. Главная величина — RSSI, сила сигнала на приёмнике дрона, в dBm.
import { fmt, clamp, TAU } from "./kit.mjs";

export const FREQS = [915, 2400, 5800]; // МГц: управление ELRS, управление 2,4 ГГц, видео 5,8 ГГц
export const POWERS = [10, 25, 50, 100, 250, 500, 1000]; // мВт: типичные ступени мощности ELRS
export const G_ANT = 2; // dBi на каждом конце: диполь «~2 dBi» (книга, с. 41)
export const CABLE = 1; // дБ на кабели и разъёмы обоих концов: оценка, в книге числа нет («немного ослабляет», с. 53)
export const SENS = [
  { id: "25", label: "25 Гц", dbm: -123, color: "#cc5de8" },
  { id: "50", label: "50 Гц", dbm: -120, color: "#ff6b6b" },
  { id: "D50", label: "D50", dbm: -112, color: "#ff922b" },
  { id: "500", label: "500 Гц", dbm: -105, color: "#fcc419" },
]; // чувствительность ELRS по книге, с. 48
export const COURSE = -120; // режим курса 50 Гц (с. 47–48)
export const ALARM_MARGIN = 10; // тревога «примерно на 10 дБ выше чувствительности» (с. 48)
export const EPS_GROUND = 15; // относительная диэлектрическая проницаемость средней сухой земли
export const TREE_H = 15; // м — высота крон
export const FOREST_START = 0.2; // км — лес начинается в 200 м от оператора

export const dbmOf = (mw) => 10 * Math.log10(mw);

// Общая геометрия и «бюджет» линии: всё, что одинаково для всех методов.
export function geometry(P, scene) {
  const f = FREQS[Math.round(P.fi)] ?? 915;
  const lambda = 299.792458 / f; // м; книга: λ = 300 / f
  const ht = scene && scene.ht !== undefined ? scene.ht : 1.5; // антенна оператора, м
  const hr = Math.max(0.5, P.hr); // дрон, м
  const d = Math.max(1, P.d * 1000); // расстояние по земле, м
  const r = Math.hypot(d, hr - ht); // расстояние между антеннами по прямой, м
  const mw = POWERS[Math.round(P.pw)] ?? 100;
  const ptx = dbmOf(mw);
  const budget = ptx + 2 * G_ANT - CABLE; // dBm: что было бы на приёмнике без потерь на трассе
  return { f, lambda, ht, hr, d, r, mw, ptx, budget };
}

// Потери в свободном пространстве (FSPL): d в км, f в МГц. 1 км на 915 МГц ≈ 91,7 дБ.
export function fspl(dKm, fMHz) {
  return 20 * Math.log10(dKm) + 20 * Math.log10(fMHz) + 32.44;
}

// Метод 1. Свободное пространство (как в книге): вдвое дальше — вчетверо слабее (−6 дБ).
export function freeSpaceRssi(P, scene) {
  const g = geometry(P, scene);
  const loss = fspl(g.r / 1000, g.f);
  return { rssi: g.budget - loss, loss, g };
}

// Коэффициент отражения от плоской земли (формула Френеля), вертикальная поляризация — антенны ELRS стоят вертикально.
// psi — угол скольжения (над горизонтом). При psi → 0 стремится к −1: почти полное отражение со сменой знака.
// Около угла Брюстера (≈14° при ε = 15) отражение почти пропадает — книга, с. 39: так бывает только у вертикальной поляризации.
export function groundReflection(psi, eps) {
  const s = Math.sin(psi), c = Math.cos(psi);
  const q = Math.sqrt(eps - c * c);
  return (eps * s - q) / (eps * s + q);
}

// Метод 2. Двухлучевая модель (Rappaport, «Wireless Communications», §4.6): прямой луч + отражённый от земли.
// Складываем две волны с учётом сдвига фазы φ = 2π·(d₂ − d₁)/λ.
export function twoRayRssi(P, scene) {
  const g = geometry(P, scene);
  const d1 = Math.hypot(g.d, g.hr - g.ht); // прямой путь
  const d2 = Math.hypot(g.d, g.hr + g.ht); // путь через землю (как от «зеркальной» антенны под землёй)
  const delta = (4 * g.ht * g.hr) / (d1 + d2); // d₂ − d₁ без потери точности на больших d
  const phi = (TAU * delta) / g.lambda;
  const psi = Math.atan2(g.ht + g.hr, g.d);
  const G = groundReflection(psi, EPS_GROUND);
  const a = (G * d1) / d2; // отражённая волна прошла чуть дальше и ослаблена отражением
  const re = 1 + a * Math.cos(phi), im = -a * Math.sin(phi);
  const gain = 10 * Math.log10(Math.max(re * re + im * im, 1e-6)); // дБ относительно свободного пространства
  const loss = fspl(d1 / 1000, g.f) - gain;
  const breakpoint = (4 * g.ht * g.hr) / g.lambda; // м: дальше — 40 дБ на декаду
  return { rssi: g.budget - loss, loss, gain, phi, G, delta, d1, d2, breakpoint, g };
}

// Сколько метров прямой линии «оператор → дрон» проходит сквозь кроны (лес от FOREST_START, ширина wood).
export function foliageDepth(P, scene) {
  const g = geometry(P, scene);
  const x0 = FOREST_START * 1000, x1 = x0 + Math.max(0, P.wood);
  // Где линия ниже крон: высота линии y(x) = ht + (hr − ht)·x/d — линейна, значит это один отрезок.
  let a = 0, b = g.d;
  if (Math.abs(g.hr - g.ht) < 1e-9) {
    if (g.ht >= TREE_H) return { depth: 0, from: 0, to: 0 };
  } else {
    const xc = ((TREE_H - g.ht) * g.d) / (g.hr - g.ht);
    if (g.hr > g.ht) b = Math.min(g.d, xc);
    else a = Math.max(0, xc);
  }
  const from = Math.max(a, x0, 0), to = Math.min(b, x1, g.d);
  const flat = Math.max(0, to - from);
  return { depth: flat * (g.r / g.d), from, to }; // вдоль наклонной линии чуть длиннее
}

// Затухание в листве: модифицированная экспоненциальная модель Вайсбергера
// (M. A. Weissberger, ESD-TR-81-101, 1982). f — ГГц, depth — м листвы на пути; годится 0,23–95 ГГц, до 400 м.
export function weissberger(fMHz, depth) {
  const f = fMHz / 1000;
  if (depth <= 0) return 0;
  if (depth <= 14) return 0.45 * Math.pow(f, 0.284) * depth;
  return 1.33 * Math.pow(f, 0.284) * Math.pow(Math.min(depth, 400), 0.588);
}

// Метод 3. Свободное пространство + лес: FSPL плюс затухание в кронах.
export function forestRssi(P, scene) {
  const fs = freeSpaceRssi(P, scene);
  const fol = foliageDepth(P, scene);
  const veg = weissberger(fs.g.f, fol.depth);
  return { rssi: fs.rssi - veg, loss: fs.loss + veg, veg, fol, g: fs.g };
}

// Запас до предела: сколько дБ ещё можно потерять до чувствительности режима.
export function margin(rssi, sens = COURSE) {
  return rssi - sens;
}
function marginNote(rssi, P) {
  const m = margin(rssi);
  const state = m < 0 ? "связь 50 Гц потеряна" : m < ALARM_MARGIN ? "пора тревожиться: запас меньше 10 дБ" : "запас есть";
  const f = FREQS[Math.round(P.fi)];
  const extra = f === 5800 ? " · на 5,8 ГГц ELRS не работает — пороги для сравнения" : f === 2400 ? " · −120 dBm — предел для 900 МГц; у ELRS 2,4 ГГц в режиме 50 Гц около −115 dBm (не из книги)" : "";
  return `запас до предела 50 Гц (−120 dBm): ${fmt(m, 1)} дБ — ${state}${extra}`;
}

const METHOD_FN = { fs: freeSpaceRssi, tworay: twoRayRssi, forest: forestRssi };
const km = (m) => (m < 1000 ? `${fmt(m)} м` : `${fmt(m / 1000, 2)} км`);
const budgetLine = (g) => `P = ${fmt(g.mw)} мВт = ${fmt(g.ptx, 1)} dBm; + ${G_ANT} + ${G_ANT} dBi антенн − ${CABLE} дБ кабелей = <b>${fmt(g.budget, 1)} dBm</b> до потерь на трассе.`;

// ——— Живой экран: вид сбоку ———
const HEAT = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];
function heat(rssi) {
  const t = clamp((rssi + 132) / 72, 0, 1) * (HEAT.length - 1);
  const k = Math.min(HEAT.length - 2, Math.floor(t)), f = t - k;
  const c = HEAT[k].map((v, i) => Math.round(v + (HEAT[k + 1][i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const statusColor = (rssi) => (rssi < COURSE ? "#ff6b6b" : rssi < COURSE + ALARM_MARGIN ? "#fcc419" : "#51cf66");

export function createStage(canvas, { fitCanvas }) {
  const N = 140;
  let key = "", vals = new Float32Array(N + 1), cols = [], t = 0;
  const stars = Array.from({ length: 46 }, (_, i) => [((i * 73) % 97) / 97, ((i * 41) % 53) / 53, 0.3 + ((i * 29) % 7) / 10]);
  function build(P, scene, focus) {
    const fn = METHOD_FN[focus] || freeSpaceRssi;
    for (let i = 0; i <= N; i++) vals[i] = fn({ ...P, d: Math.max(0.01, (P.d * i) / N) }, scene).rssi;
    cols = Array.from(vals, heat);
  }
  const at = (s) => vals[Math.round(clamp(s, 0, 1) * N)];
  return {
    update(P, results, scene, focus) {
      key = "";
    },
    reset() {
      key = "";
    },
    frame(dt, P, results, scene, focus, calm) {
      const k = `${focus}|${P.d}|${P.pw}|${P.fi}|${P.hr}|${P.wood}|${scene.id}`;
      if (k !== key) {
        build(P, scene, focus);
        key = k;
      }
      if (!calm) t += dt;
      const { w, h, dpr } = fitCanvas(canvas);
      const g = canvas.getContext("2d");
      const geo = geometry(P, scene);
      const fol = foliageDepth(P, scene);
      const font = (s, wt = 500) => `${wt} ${s * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      // Небо.
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#070b16");
      sky.addColorStop(1, "#0d1428");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(200,220,255,.5)";
      for (const [sx, sy, sr] of stars) g.fillRect(sx * w, sy * h * 0.5, sr * 1.6 * dpr, sr * 1.6 * dpr);
      // Масштаб: по горизонтали — всё расстояние, по вертикали — до высоты дрона (высоты сильно растянуты).
      const xT = w * 0.1, xR = w * 0.88, gy = h * 0.7, top = h * 0.16;
      const H = Math.max(geo.hr, geo.ht, P.wood > 0 ? TREE_H * 1.25 : 0, 6) * 1.1;
      const X = (m) => xT + (m / geo.d) * (xR - xT);
      const Y = (m) => gy - (m / H) * (gy - top);
      const tx = [xT, Y(geo.ht)], rx = [xR, Y(geo.hr)];
      // Земля.
      const gr = g.createLinearGradient(0, gy, 0, h);
      gr.addColorStop(0, "#14261f");
      gr.addColorStop(1, "#070b10");
      g.fillStyle = gr;
      g.fillRect(0, gy, w, h - gy);
      g.strokeStyle = "rgba(120,240,170,.75)";
      g.lineWidth = 1.5 * dpr;
      g.shadowColor = "#51cf66";
      g.shadowBlur = 8 * dpr;
      g.beginPath();
      g.moveTo(0, gy);
      g.lineTo(w, gy);
      g.stroke();
      g.shadowBlur = 0;
      // Лес.
      if (P.wood > 0) {
        const a = FOREST_START * 1000, b = Math.min(a + P.wood, geo.d);
        if (b > a) {
          const xa = X(a), xb = X(b), step = Math.max(7 * dpr, Math.min(16 * dpr, (xb - xa) / 3));
          for (let x = xa + step / 2, i = 0; x <= xb + 0.1; x += step, i++) {
            const th = TREE_H * (0.8 + 0.2 * Math.sin(i * 2.3));
            const ytop = Y(th), cw = Math.max(step * 0.75, 6 * dpr);
            g.fillStyle = "#3b2a1a";
            g.fillRect(x - dpr, Y(th * 0.35), 2 * dpr, gy - Y(th * 0.35));
            g.fillStyle = i % 2 ? "#1f6b3a" : "#2b8a4a";
            g.beginPath();
            g.moveTo(x, ytop);
            g.lineTo(x + cw / 2, Y(th * 0.3));
            g.lineTo(x - cw / 2, Y(th * 0.3));
            g.closePath();
            g.fill();
          }
          g.fillStyle = "rgba(180,255,200,.85)";
          g.font = font(11);
          g.textAlign = "center";
          g.fillText(`лес ${fmt(Math.min(P.wood, geo.d - a))} м`, (xa + xb) / 2, Y(TREE_H) - 8 * dpr);
          if (focus === "forest" && fol.depth > 0) {
            g.fillStyle = "#ffb26b";
            g.font = font(11, 600);
            g.fillText(`луч в кронах ${fmt(fol.depth)} м: −${fmt(weissberger(geo.f, fol.depth), 1)} дБ`, (xa + xb) / 2, Y(TREE_H) - 22 * dpr);
          }
        }
      }
      // Отражённый луч (только для двухлучевой модели).
      const two = focus === "tworay";
      const xg = xT + ((xR - xT) * (gy - tx[1])) / (gy - tx[1] + gy - rx[1]);
      if (two) {
        g.strokeStyle = "rgba(102,217,255,.8)";
        g.lineWidth = 2 * dpr;
        g.setLineDash([6 * dpr, 5 * dpr]);
        g.shadowColor = "#4dabf7";
        g.shadowBlur = 8 * dpr;
        g.beginPath();
        g.moveTo(...tx);
        g.lineTo(xg, gy);
        g.lineTo(...rx);
        g.stroke();
        g.setLineDash([]);
        g.shadowBlur = 0;
        g.fillStyle = "rgba(160,230,255,.95)";
        g.font = font(11);
        g.textAlign = "center";
        g.fillText("отражённый от земли", Math.max(xg, xT + 85 * dpr), gy + 14 * dpr);
      }
      // Волны от антенны оператора.
      g.lineWidth = 2 * dpr;
      for (let i = 0; i < 6; i++) {
        const ph = ((calm ? 0.15 : t * 0.35) + i / 6) % 1;
        const rad = ph * (xR - xT) * 1.05;
        g.strokeStyle = `rgba(255,212,59,${0.45 * (1 - ph)})`;
        g.beginPath();
        g.arc(tx[0], tx[1], Math.max(1, rad), Math.PI * 1.02, Math.PI * 1.98);
        g.stroke();
      }
      // Прямой луч, раскрашенный силой сигнала вдоль пути.
      g.lineWidth = 4 * dpr;
      g.lineCap = "round";
      const S = 46;
      for (let i = 0; i < S; i++) {
        const s0 = i / S, s1 = (i + 1) / S;
        g.strokeStyle = cols[Math.round(((s0 + s1) / 2) * N)];
        g.beginPath();
        g.moveTo(tx[0] + (rx[0] - tx[0]) * s0, tx[1] + (rx[1] - tx[1]) * s0);
        g.lineTo(tx[0] + (rx[0] - tx[0]) * s1, tx[1] + (rx[1] - tx[1]) * s1);
        g.stroke();
      }
      g.lineCap = "butt";
      // Кусок луча внутри крон.
      if (focus === "forest" && fol.to > fol.from) {
        const s0 = fol.from / geo.d, s1 = fol.to / geo.d;
        g.strokeStyle = "rgba(255,146,43,.95)";
        g.lineWidth = 7 * dpr;
        g.shadowColor = "#ff922b";
        g.shadowBlur = 12 * dpr;
        g.beginPath();
        g.moveTo(tx[0] + (rx[0] - tx[0]) * s0, tx[1] + (rx[1] - tx[1]) * s0);
        g.lineTo(tx[0] + (rx[0] - tx[0]) * s1, tx[1] + (rx[1] - tx[1]) * s1);
        g.stroke();
        g.shadowBlur = 0;
      }
      // Пакеты: светящиеся точки; там, где сигнал ниже предела 50 Гц, гаснут.
      const pkt = (p0, p1, s, dim) => {
        const v = at(s);
        const lost = v < COURSE;
        const a = (lost ? Math.max(0, 1 - (s - firstLost) * 6) * 0.7 : 1) * dim;
        if (a <= 0.02) return;
        const x = p0[0] + (p1[0] - p0[0]) * s, y = p0[1] + (p1[1] - p0[1]) * s;
        g.globalAlpha = a;
        g.fillStyle = lost ? "#ff6b6b" : "#fff3bf";
        g.shadowColor = lost ? "#ff6b6b" : "#ffd43b";
        g.shadowBlur = 12 * dpr;
        g.beginPath();
        g.arc(x, y, (2.2 + 2.6 * clamp((v + 125) / 60, 0, 1)) * dpr, 0, TAU);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      };
      let firstLost = 2;
      for (let i = 0; i <= N; i++)
        if (vals[i] < COURSE) {
          firstLost = i / N;
          break;
        }
      for (let i = 0; i < 7; i++) {
        const s = ((calm ? 0.05 : t * 0.22) + i / 7) % 1;
        pkt(tx, rx, s, 1);
        if (two) {
          const sg = (xg - xT) / (xR - xT);
          if (s < sg) pkt(tx, [xg, gy], s / sg, 0.6);
          else pkt([xg, gy], rx, (s - sg) / (1 - sg), 0.6);
        }
      }
      // Оператор: человечек и мачта с антенной.
      g.strokeStyle = "#dee2e6";
      g.lineWidth = 2 * dpr;
      const px = xT - 16 * dpr, ph = 22 * dpr;
      g.beginPath();
      g.arc(px, gy - ph - 4 * dpr, 4 * dpr, 0, TAU);
      g.moveTo(px, gy - ph);
      g.lineTo(px, gy - 9 * dpr);
      g.lineTo(px - 5 * dpr, gy);
      g.moveTo(px, gy - 9 * dpr);
      g.lineTo(px + 5 * dpr, gy);
      g.moveTo(px, gy - ph + 5 * dpr);
      g.lineTo(px + 8 * dpr, gy - ph + 9 * dpr);
      g.stroke();
      g.strokeStyle = "#adb5bd";
      g.beginPath();
      g.moveTo(xT, gy);
      g.lineTo(...tx);
      g.stroke();
      g.fillStyle = "#ffd43b";
      g.shadowColor = "#ffd43b";
      g.shadowBlur = 16 * dpr;
      g.beginPath();
      g.arc(tx[0], tx[1], 5 * dpr, 0, TAU);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,.9)";
      g.font = font(11, 600);
      g.textAlign = "left";
      g.fillText("пульт", xT - 22 * dpr, gy + 15 * dpr);
      g.font = font(10);
      g.fillStyle = "rgba(255,255,255,.65)";
      g.fillText(`антенна ${fmt(geo.ht, 1)} м`, xT - 22 * dpr, gy + 28 * dpr);
      // Дрон.
      const res = results[focus] || {};
      const rv = Number.isFinite(res.value) ? res.value : at(1);
      const sc = statusColor(rv);
      g.save();
      g.translate(rx[0], rx[1]);
      g.scale(1.35, 1.35);
      g.strokeStyle = sc;
      g.shadowColor = sc;
      g.shadowBlur = 14 * dpr;
      g.lineWidth = 2.5 * dpr;
      g.beginPath();
      g.moveTo(-13 * dpr, 0);
      g.lineTo(13 * dpr, 0);
      g.stroke();
      g.fillStyle = sc;
      g.fillRect(-5 * dpr, -3 * dpr, 10 * dpr, 6 * dpr);
      const spin = calm ? 1 : Math.abs(Math.sin(t * 40));
      g.lineWidth = 1.5 * dpr;
      for (const sx of [-13, 13]) {
        g.beginPath();
        g.ellipse(sx * dpr, -3 * dpr, (3 + 5 * spin) * dpr, 1.6 * dpr, 0, 0, TAU);
        g.stroke();
      }
      g.restore();
      g.textAlign = "right";
      g.font = font(13, 700);
      g.fillStyle = sc;
      g.fillText(`${fmt(rv, 1)} dBm`, rx[0] + 20 * dpr, rx[1] - 16 * dpr);
      g.font = font(10);
      g.fillStyle = "rgba(255,255,255,.7)";
      g.fillText(`дрон ${fmt(geo.hr)} м · ${km(geo.d)}`, rx[0] + 20 * dpr, rx[1] - 32 * dpr);
      // Полоса силы сигнала: что покажет RSSI, если дрон окажется в этой точке пути.
      const by = h * 0.86, bh = 10 * dpr;
      for (let i = 0; i < N; i++) {
        g.fillStyle = cols[i];
        g.fillRect(xT + ((xR - xT) * i) / N, by, (xR - xT) / N + 1, bh);
      }
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = dpr;
      g.strokeRect(xT, by, xR - xT, bh);
      g.font = font(10);
      g.fillStyle = "rgba(255,255,255,.75)";
      g.textAlign = "left";
      g.fillText("сила сигнала, если дрон окажется здесь:", xT, by - 5 * dpr);
      g.textAlign = "center";
      g.fillText("0", xT, by + bh + 12 * dpr);
      g.fillText(km(geo.d / 2), (xT + xR) / 2, by + bh + 12 * dpr);
      g.fillText(km(geo.d), xR, by + bh + 12 * dpr);
      // Метки: где сигнал впервые ниже тревоги и ниже предела 50 Гц.
      const mark = (lvl, col, text, row) => {
        for (let i = 1; i <= N; i++)
          if (vals[i] < lvl && vals[i - 1] >= lvl) {
            const x = xT + ((xR - xT) * i) / N;
            g.strokeStyle = col;
            g.lineWidth = 2 * dpr;
            g.beginPath();
            g.moveTo(x, by - 2 * dpr);
            g.lineTo(x, by + bh + 2 * dpr);
            g.stroke();
            g.fillStyle = col;
            g.font = font(10, 600);
            g.fillText(text, clamp(x, xT + 30 * dpr, xR - 30 * dpr), by + bh + (24 + 12 * row) * dpr);
            return;
          }
      };
      mark(COURSE + ALARM_MARGIN, "#fcc419", "тревога", 0);
      mark(COURSE, "#ff6b6b", "обрыв 50 Гц", 1);
    },
  };
}

export default {
  id: "link",
  title: "Докуда долетит связь",
  chapters: "Главы 9 и 11",
  accent: "#fcc419",
  lead: "Слева пульт, справа дрон. Передатчик, антенны и расстояние одинаковые — а три модели по-разному считают, сколько сигнала долетит: «пустое пространство» из книги, земля, которая отражает волну, и лес на пути. <b>RSSI</b> — сила сигнала на приёмнике в <b>dBm</b> (децибелах относительно 1 милливатта); чем ближе к нулю, тем сильнее.",
  stageLabel: "Вид сбоку: пульт с антенной, дрон, земля, при лесе — деревья; по лучу бегут пакеты, полоса внизу показывает силу сигнала вдоль пути",
  scenes: [
    { id: "field900", name: "Поле, 900 МГц", desc: "ровное поле, дрон на 100 м — частота управления ELRS", ht: 1.5, set: { fi: 0, pw: 3, d: 5, hr: 100, wood: 0 } },
    { id: "field24", name: "Поле, 2,4 ГГц", desc: "то же поле, но частота выше: потери больше", ht: 1.5, set: { fi: 1, pw: 3, d: 5, hr: 100, wood: 0 } },
    { id: "forest", name: "Лес на пути", desc: "лесополоса 200 м, дрон низко — луч идёт сквозь кроны", ht: 1.5, set: { fi: 0, pw: 3, d: 2, hr: 20, wood: 200 } },
    { id: "low", name: "Низко над землёй (антенны 1 м)", desc: "обе антенны на высоте 1 м: земля съедает сигнал", ht: 1, set: { fi: 0, pw: 3, d: 1, hr: 1, wood: 0 } },
  ],
  params: [
    { id: "d", label: "Расстояние до дрона", min: 0.05, max: 20, step: 0.05, value: 5, fmt: (v) => km(v * 1000) },
    { id: "pw", label: "Мощность передатчика", min: 0, max: 6, step: 1, value: 3, fmt: (v) => `${fmt(POWERS[v])} мВт = ${fmt(dbmOf(POWERS[v]), 1)} dBm` },
    { id: "fi", label: "Частота", min: 0, max: 2, step: 1, value: 0, fmt: (v) => ["915 МГц (управление)", "2,4 ГГц (управление)", "5,8 ГГц (видео)"][v] },
    { id: "hr", label: "Высота дрона над землёй", min: 1, max: 150, step: 1, value: 100, unit: "м" },
    { id: "wood", label: "Ширина леса на пути", min: 0, max: 400, step: 10, value: 0, fmt: (v) => (v ? `${fmt(v)} м` : "леса нет") },
  ],
  metric: { label: "Сигнал на приёмнике (RSSI)", unit: "dBm", digits: 1 },
  reference: (P, scene) => ({
    label: "свободное пространство",
    value: freeSpaceRssi(P, scene).rssi,
    note: "Разница — сколько децибел добавляют земля или лес к потерям «пустого пространства». −6 дБ — вчетверо слабее, −20 дБ — в 100 раз. Пределы ELRS (с. 48): 25 Гц −123, 50 Гц −120, D50 −112, 2,4 ГГц 500 Гц −105 dBm.",
  }),
  methods: [
    {
      id: "fs",
      name: "Свободное пространство (книга)",
      short: "вдвое дальше — минус 6 дБ",
      eq: `<p class="mx-f">RSSI = P + G₁ + G₂ − L<sub>каб</sub> − FSPL</p><p class="mx-f">FSPL = 20·lg d<sub>км</sub> + 20·lg f<sub>МГц</sub> + 32,44</p><p>FSPL — потери в свободном пространстве: сколько децибел «съедает» само расстояние, если вокруг пусто. P — мощность передатчика в dBm, G — усиление антенн в dBi. Вдвое дальше — +6 дБ потерь, то есть вчетверо слабее: ровно правило книги «×4 мощности ≈ ×2 дальности».</p>`,
      explain: (P, r, scene) => {
        const s = freeSpaceRssi(P, scene), g = s.g;
        return `<p>${budgetLine(g)}</p><p>FSPL = 20·lg ${fmt(g.r / 1000, 3)} + 20·lg ${g.f} + 32,44 = ${fmt(20 * Math.log10(g.r / 1000), 1)} + ${fmt(20 * Math.log10(g.f), 1)} + 32,44 = <b>${fmt(s.loss, 1)} дБ</b>.</p><p>RSSI = ${fmt(g.budget, 1)} − ${fmt(s.loss, 1)} = <b>${fmt(s.rssi, 1)} dBm</b>. Запас до 50 Гц: ${fmt(margin(s.rssi), 1)} дБ. Предел 50 Гц эта модель обещает на ${(() => { const dk = 10 ** ((g.budget - COURSE - 20 * Math.log10(g.f) - 32.44) / 20); return dk >= 1 ? `${fmt(dk)} км` : km(dk * 1000); })()} — так далеко на деле не бывает из-за земли и препятствий.</p>`;
      },
      assume: "вокруг пусто: ни земли, ни деревьев; антенны смотрят друг на друга, поляризация совпадает",
      run: (P, scene) => {
        const s = freeSpaceRssi(P, scene);
        return { value: s.rssi, note: marginNote(s.rssi, P) };
      },
      src: ["geometry", "fspl", "freeSpaceRssi"],
      refs: [
        { page: 40, quote: "В свободном пространстве сигнал слабеет как квадрат расстояния: вдвое дальше — вчетверо слабее, как свет фонарика." },
        { page: 40, quote: "Каждые ×4 мощности (+6 дБ) ≈ ×2 дальности" },
        { page: 40, quote: "0 dBm = 1 мВт, 14 dBm ≈ 25 мВт, 20 dBm = 100 мВт, 30 dBm = 1 Вт." },
        { page: 41, quote: "Диполь (~2 dBi) → патч (~8 dBi) = +6 дБ" },
        { page: 48, quote: "50 Гц (курс) −120 dBm дальность и устойчивость" },
        { page: 53, quote: "кабель не усиливает, а немного ослабляет" },
      ],
      review: {
        status: "match",
        tol: "в 18 тестах (3 частоты × 6 расстояний 0,1–20 км) FSPL с константой 32,44 отличается от точной формулы Фрииса 20·lg(4πd/λ) не больше 0,01 дБ; 1 км на 915 МГц = 91,67 дБ; удвоение расстояния даёт +6,02 дБ, то есть +6 дБ ≈ ×1,995 дальности (книга: ×2)",
        note: "Совпадает с книгой: квадрат расстояния, +6 дБ на удвоение. Числа dBm и усиление диполя — из книги; 1 дБ на кабели — наша оценка, в книге только «немного ослабляет». Саму формулу FSPL с константой 32,44 книга не даёт — только закон квадрата и +6 дБ на удвоение; формула их точно воспроизводит. Модель честно говорит «в свободном пространстве» — у земли и в лесу она слишком оптимистична.",
      },
    },
    {
      id: "tworay",
      name: "Двухлучевая модель (земля отражает)",
      short: "прямой луч + отражённый",
      eq: `<p class="mx-f">сигнал = прямой луч + Γ · отражённый · сдвиг фазы φ</p><p class="mx-f">φ = 2π · (d₂ − d₁) / λ,  d₂ − d₁ ≈ 2·h₁·h₂ / d</p><p class="mx-f">точка перелома d<sub>п</sub> = 4·h₁·h₂ / λ;  дальше ≈3·d<sub>п</sub>:  L ≈ 40·lg d<sub>м</sub> − 20·lg(h₁·h₂)</p><p>Волна приходит к дрону двумя путями: напрямую (d₁) и отразившись от земли (d₂ чуть длиннее). Γ — коэффициент отражения: какая доля волны отразилась (у земли под малым углом почти −1, то есть волна «переворачивается»). Где гребни совпали — сигнал сильнее, где гребень встретил впадину — провал. В точке перелома лучи складываются последний раз. Дальше они всё сильнее гасят друг друга, и примерно с 3·d<sub>п</sub> сигнал падает на 12 дБ при удвоении расстояния (40 дБ за десятикратное), а не на 6.</p>`,
      explain: (P, r, scene) => {
        const s = twoRayRssi(P, scene), g = s.g;
        const zone = g.d < s.breakpoint ? "ближе неё: здесь сигнал «рябит» — провалы и усиления по очереди" : g.d < Math.PI * s.breakpoint ? "в переходной зоне (от d<sub>п</sub> до ≈3·d<sub>п</sub>): у d<sub>п</sub> лучи складываются последний раз, дальше начинают гасить друг друга" : "дальше ≈3·d<sub>п</sub>: работает правило 40 дБ на декаду, +6 дБ мощности дают только ×1,4 дальности";
        const deg = ((s.phi / TAU) * 360) % 360;
        return `<p>${budgetLine(g)}</p><p>λ = ${fmt(g.lambda * 100, 1)} см, h₁ = ${fmt(g.ht, 1)} м, h₂ = ${fmt(g.hr)} м. Разница путей d₂ − d₁ = ${fmt(s.delta * 100, 2)} см → сдвиг фазы ${fmt(deg)}° (360° — целая волна).${s.phi > TAU ? ` Целых волн в разнице: ${Math.floor(s.phi / TAU)}.` : ""} Угол к земле ${fmt((Math.atan2(g.ht + g.hr, g.d) * 180) / Math.PI, 2)}° → Γ = ${fmt(s.G, 3)}${s.G < 0 ? " (минус: отражение само переворачивает волну, поэтому при сдвиге 180° лучи складываются, а при 0° — гасят друг друга)" : " (плюс: у угла Брюстера отражение слабое и не переворачивает волну)"}.</p><p>Сложение лучей: ${s.gain >= 0 ? "+" : "−"}${fmt(Math.abs(s.gain), 1)} дБ к свободному пространству → потери ${fmt(s.loss, 1)} дБ, RSSI = <b>${fmt(s.rssi, 1)} dBm</b>.</p><p>Точка перелома d<sub>п</sub> = 4 × ${fmt(g.ht, 1)} × ${fmt(g.hr)} / ${fmt(g.lambda, 3)} = <b>${km(s.breakpoint)}</b>. Дрон ${zone}.</p>`;
      },
      assume: "земля ровная и гладкая, как зеркало (диэлектрическая проницаемость 15 — средняя сухая почва), антенны вертикальные (вертикальная поляризация: около угла Брюстера ≈14° земля почти не отражает, поэтому провалы вблизи оператора мелкие); кривизну Земли не учитываем (верно примерно до 30–40 км при дроне на 100 м)",
      run: (P, scene) => {
        const s = twoRayRssi(P, scene);
        return { value: s.rssi, note: marginNote(s.rssi, P) };
      },
      src: ["groundReflection", "twoRayRssi"],
      refs: [
        { page: 40, quote: "У земли, при низко висящих антеннах, сигнал на большой дистанции слабеет ещё быстрее, и +6 дБ дают уже меньше ×2." },
        { page: 38, quote: "От земли отражаются обе поляризации." },
        { page: 39, quote: "малое отражение (угол Брюстера) бывает только у вертикальной поляризации" },
      ],
      review: {
        status: "beyond",
        tol: "в 12 тестах (915/2400 МГц, высоты 1–100 м) на расстоянии 10·d_п модель совпадает с формулой плоской земли 40·lg d − 20·lg(h₁h₂) не хуже 0,14 дБ, наклон дальше — 39,5–39,9 дБ на декаду; от π·d_п до 2π·d_п сигнал падает на 11,5–11,7 дБ (≈12 дБ на удвоение); вблизи (h₁ = 1,5 м, h₂ = 100 м, вертикальная поляризация) провалы мелкие: до −6,3 дБ на 915 МГц (около 70 м) и до −10,8 дБ на 2,4 ГГц, в точке перелома +4,3 и +5,3 дБ",
        note: "Формулы нет в книге — это классическая двухлучевая модель из радиотехники. Она количественно подтверждает слова книги со с. 40: у земли +6 дБ дают меньше ×2 дальности. Настоящая земля неровная, поэтому провалы на деле мельче, а за горизонтом модель не работает.",
      },
    },
    {
      id: "forest",
      name: "Свободное пространство + лес",
      short: "FSPL + затухание в кронах",
      dash: true,
      eq: `<p class="mx-f">RSSI = RSSI<sub>своб</sub> − L<sub>лес</sub></p><p class="mx-f">L<sub>лес</sub> = 1,33 · f<sub>ГГц</sub><sup>0,284</sup> · d<sub>лес</sub><sup>0,588</sup>  (14–400 м листвы)</p><p class="mx-f">L<sub>лес</sub> = 0,45 · f<sub>ГГц</sub><sup>0,284</sup> · d<sub>лес</sub>  (до 14 м)</p><p>Модель Вайсбергера — формула, подобранная по измерениям в лесу. d<sub>лес</sub> — сколько метров прямого луча проходит сквозь кроны (деревья 15 м). Выше частота — сильнее затухание: листва «пьёт» короткие волны.</p>`,
      explain: (P, r, scene) => {
        const s = forestRssi(P, scene), g = s.g;
        const fg = g.f / 1000;
        if (s.fol.depth <= 0) return `<p>${budgetLine(g)}</p><p>Луч не проходит сквозь кроны (${P.wood ? "дрон выше деревьев или лес дальше дрона" : "леса нет"}) → L<sub>лес</sub> = 0, RSSI = <b>${fmt(s.rssi, 1)} dBm</b>, как в свободном пространстве.</p>`;
        const formula = s.fol.depth <= 14 ? `0,45 × ${fmt(fg, 3)}<sup>0,284</sup> × ${fmt(s.fol.depth, 1)}` : `1,33 × ${fmt(fg, 3)}<sup>0,284</sup> × ${fmt(Math.min(400, s.fol.depth), 1)}<sup>0,588</sup>`;
        return `<p>${budgetLine(g)}</p><p>Луч идёт сквозь кроны на участке ${km(s.fol.from)}–${km(s.fol.to)}: d<sub>лес</sub> = <b>${fmt(s.fol.depth, 1)} м</b>.</p><p>L<sub>лес</sub> = ${formula} = <b>${fmt(s.veg, 1)} дБ</b>. RSSI = ${fmt(s.rssi + s.veg, 1)} − ${fmt(s.veg, 1)} = <b>${fmt(s.rssi, 1)} dBm</b>.</p><p>Подними дрон выше крон — луч пройдёт над лесом, и потери исчезнут.</p>`;
      },
      assume: "лес сплошной, деревья 15 м, начинается в 200 м от оператора; земля не отражает; волна не огибает лес сверху (на деле часть сигнала обходит кроны, поэтому при широком лесе модель может завышать потери)",
      run: (P, scene) => {
        const s = forestRssi(P, scene);
        return { value: s.rssi, note: `${s.veg > 0 ? `лес −${fmt(s.veg, 1)} дБ · ` : ""}${marginNote(s.rssi, P)}` };
      },
      src: ["foliageDepth", "weissberger", "forestRssi"],
      refs: [
        { page: 36, quote: "Низкие частоты лучше огибают холмы и проходят сквозь листву: длинной волне мелкие препятствия меньше мешают." },
        { page: 86, quote: "5,8 ГГц хуже огибает препятствия и сильнее поглощается листвой." },
        { page: 39, quote: "Почему видео на 5,8 ГГц пропадает за лесополосой, а управление на 900 МГц держится?" },
      ],
      review: {
        status: "simplified",
        tol: "тест: 100 м листвы — 19,5 дБ на 915 МГц, 25,6 дБ на 2,4 ГГц, 32,9 дБ на 5,8 ГГц; ветви формулы на границе 14 м сходятся с разницей 0,02 дБ; без леса метод совпадает со свободным пространством точно (0 дБ в 4 сценах)",
        note: "Книга говорит словами: низкие частоты лучше проходят сквозь листву, 5,8 ГГц пропадает за лесополосой. Числа даёт эмпирическая модель Вайсбергера (1982) — её подобрали по измерениям, разброс против реального леса бывает несколько децибел, летом с листвой и зимой без неё по-разному.",
      },
    },
  ],
  chart: {
    title: "Сигнал на приёмнике в зависимости от расстояния · ромбики — правило книги «вдвое дальше — минус 6 дБ»",
    x: { param: "d", min: 0.05, max: 20, label: "расстояние до дрона", unit: "км" },
    y: { label: "RSSI", unit: "dBm", min: -140, max: -40 },
    samples: 400,
    bands: () => [
      { from: -140, to: -105, color: "#fcc419", label: "ниже −105: 500 Гц (2,4 ГГц) глохнет" },
      { from: -140, to: -112, color: "#ff922b", label: "ниже −112: D50 глохнет" },
      { from: -140, to: -120, color: "#ff6b6b", label: "ниже −120: 50 Гц глохнет" },
      { from: -140, to: -123, color: "#cc5de8", label: "                              ниже −123: и 25 Гц" },
    ],
    refs: (P, scene) => {
      // Ромбы «правила книги» шагают по расстоянию между антеннами (как и кривая), а не по земле.
      const fs = freeSpaceRssi(P, scene), y0 = fs.rssi, dh = fs.g.hr - fs.g.ht, out = [];
      for (let k = -4; k <= 4; k++) {
        const r = fs.g.r * 2 ** k;
        if (r <= Math.abs(dh)) continue;
        const x = Math.sqrt(r * r - dh * dh) / 1000;
        if (x >= 0.05 && x <= 20) out.push({ x, y: y0 - 6 * k });
      }
      return out;
    },
  },
  hud: (P, results, scene, focus) => {
    const g = geometry(P, scene);
    const r = results[focus] || {};
    const v = Number.isFinite(r.value) ? r.value : NaN;
    const m = margin(v);
    const tw = twoRayRssi(P, scene);
    return `<span>${fmt(g.mw)} мВт = ${fmt(g.ptx, 1)} dBm</span><span>λ = ${fmt(g.lambda * 100, 1)} см</span><span>перелом ${km(tw.breakpoint)}</span><span class="${m < 0 ? "bad" : m < ALARM_MARGIN ? "warn" : "ok"}">RSSI ${fmt(v, 1)} dBm · запас ${fmt(m, 1)} дБ</span>`;
  },
  stage: createStage,
  try: [
    "Сцена «Поле, 900 МГц»: подними мощность с 25 до 100 мВт (×4). Кривая «Свободного пространства» поднимется на 6 дБ: тот же сигнал теперь ловится вдвое дальше (во вкладке «Уравнение» предел 50 Гц прыгнет со 184 до 369 км — в пустом пространстве).",
    "Там же посмотри на «Двухлучевую модель» вблизи (до 2 км): сигнал «рябит» — это прямой и отражённый лучи то складываются, то гасят друг друга.",
    "Сцена «Низко над землёй»: сравни, где каждая модель пересекает предел 50 Гц. Свободное пространство обещает сотни километров, земля оставляет меньше 4 км. Что даст больше: мощность 1000 мВт вместо 100 или дрон на 50 м вместо 1 м?",
    "Сцена «Лес на пути»: переключи частоту 915 → 2,4 → 5,8 ГГц. Лес съедает всё больше — вот почему видео пропадает за лесополосой, а управление держится.",
    "Там же выбери метод «Свободное пространство + лес» и поднимай дрон с 20 до 150 м. Смотри на оранжевый кусок луча внутри крон: он укорачивается, и потери леса падают с 29 дБ до нуля.",
  ],
};

export const __test = { geometry, fspl, freeSpaceRssi, twoRayRssi, foliageDepth, weissberger, forestRssi, groundReflection, margin };
