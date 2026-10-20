// Эксперимент «Сколько тянет винт» (гл. 2 и 5): тяга винта при заданных оборотах четырьмя способами.
// Все методы получают одно и то же: обороты n, диаметр D, шаг, высоту над морем (→ плотность воздуха ρ).
// Единицы внутри: метры, секунды, ньютоны; наружу — граммы-силы («сколько покажут весы») и ватты.
import { fmt, clamp, TAU } from "./kit.mjs";
import { thrustStand, MOTORS, PROPS } from "../models.mjs";

const IN = 0.0254, G0 = 9.81, RHO0 = 1.225;
const toGrams = (newton) => (newton / G0) * 1000;
const diskArea = (d) => Math.PI * ((d * IN) / 2) ** 2; // площадь круга, который «метёт» винт, м²

// Опорный замер для «простых» методов (пример, не паспорт): винт 5×4,3×3 на 25 000 об/мин
// тянет около 1 050 г и берёт около 310 Вт с вала мотора.
// Порядок величин: открытые стендовые таблицы 5″ трёхлопастных винтов на моторах 22xx при 6S дают
// около 1 кгс при 24–26 тыс. об/мин и 380–400 Вт от батареи; с КПД мотора и ESC ≈ 0,8 на валу ≈ 310 Вт.
// Проверка согласованности: идеальный диск для 1 050 г берёт 188 Вт, 188 / 310 ≈ 0,6 = FM ниже.
export const REF = { d: 5, pitch: 4.3, rpm: 25000, grams: 1050, shaft: 310 };

// Плотность воздуха на высоте h. Температура падает на 0,6 °C на 100 м (книга, с. 73),
// давление — по барометрической формуле; у моря 15 °C и 1,225 кг/м³.
export function airDensity(h) {
  const L = 0.006, T0 = 288.15, R = 287.05, g = 9.80665;
  const T = T0 - L * Math.max(0, h);
  return RHO0 * (T / T0) ** (g / (L * R) - 1);
}

// Метод 1. Закон подобия: T = Ct·ρ·n²·D⁴, P = Cp·ρ·n³·D⁵. Ct и Cp взяты из ОДНОГО замера (REF).
// Закон верен для винтов той же формы: шаг и число лопастей он «не видит».
export function similarityLaw(rpm, d, rho) {
  const n = rpm / 60, D = d * IN;
  const nR = REF.rpm / 60, DR = REF.d * IN;
  const ct = ((REF.grams / 1000) * G0) / (RHO0 * nR ** 2 * DR ** 4);
  const cp = REF.shaft / (RHO0 * nR ** 3 * DR ** 5);
  const thrust = ct * rho * n * n * D ** 4; // Н
  const shaft = cp * rho * n ** 3 * D ** 5; // Вт
  return { grams: toGrams(thrust), shaft, ct, cp };
}

// Метод 2. Теория импульса (идеальный диск): винт каждую секунду отбрасывает массу воздуха ρ·A·v
// и разгоняет её до 2v. Тяга T = 2ρAv². Скорость задаёт шаг — «шуруп» проходит шаг за оборот,
// но в воздухе проскальзывает: далеко за винтом струя летит со скоростью s·шаг·n (s из того же замера REF).
// Идеальная мощность P = T^1,5 / √(2ρA); настоящая больше: делим на FM ≈ 0,6 (качество винта;
// у маленьких нагруженных винтов обычно 0,5–0,7; 0,6 согласовано с опорной точкой REF).
export const FM = 0.6;
export function momentumDisk(rpm, d, pitch, rho) {
  const A = diskArea(d), Ar = diskArea(REF.d);
  const vpR = REF.pitch * IN * (REF.rpm / 60);
  const TR = (REF.grams / 1000) * G0;
  const slip = Math.sqrt(TR / (0.5 * RHO0 * Ar)) / vpR; // доля «шаговой скорости», которую получает струя
  const vp = pitch * IN * (rpm / 60); // шаговая скорость, м/с
  const vi = (slip * vp) / 2; // скорость воздуха в плоскости винта
  const thrust = 2 * rho * A * vi * vi;
  const ideal = thrust > 0 ? thrust ** 1.5 / Math.sqrt(2 * rho * A) : 0;
  return { grams: toGrams(thrust), vi, slip, vp, ideal, shaft: ideal / FM };
}

// Обратная задача теории импульса: какую тягу даст диск, если ему дать мощность P на валу.
// T = (FM·P·√(2ρA))^(2/3). Нужна для честной сверки методов «на одной мощности».
export function thrustFromPower(shaft, d, rho, fm = FM) {
  return shaft > 0 ? toGrams((fm * shaft * Math.sqrt(2 * rho * diskArea(d))) ** (2 / 3)) : 0;
}

// Метод 3. Модель лопасти (упрощённый BEM): режем лопасть на 24 кусочка от втулки до кончика.
// На каждом: угол установки θ из шага, поток сверху вниз со скоростью v → угол атаки α = θ − φ,
// подъёмная сила Cl = 0,9·2π·α (до срыва), за срывом Cl не растёт, а сопротивление резко растёт.
// Скорость v на каждом кусочке подбираем так, чтобы тяга кусочка = импульсу, который он отдал воздуху.
export const BLADE = { a: 0.9 * TAU, stall: (12 * Math.PI) / 180, cd0: 0.02, x0: 0.15, N: 24 };
export function chordRatio(x) {
  // Ширина лопасти / радиус: типичная форма гоночного винта — шире всего на 40 % радиуса.
  return x < 0.4 ? 0.15 + ((x - 0.15) / 0.25) * 0.06 : 0.21 - ((x - 0.4) / 0.6) * 0.09;
}
export function airfoil(alpha) {
  const { a, stall, cd0 } = BLADE;
  const cl = alpha <= stall ? a * alpha : a * stall; // ограничение: срыв потока
  const cd = cd0 + 0.8 * alpha * alpha + (alpha > stall ? 2 * (alpha - stall) : 0);
  return { cl, cd };
}
export function bladeStation(x, theta, sigma, B) {
  // Невязка: импульс (4F·λ²·x) минус лопасть (½σ(x²+λ²)(Cl·cosφ − Cd·sinφ)); ищем λ делением пополам.
  const f = (lam) => {
    const phi = Math.atan2(lam, x);
    const ft = ((B / 2) * (1 - x)) / (x * Math.max(Math.sin(phi), 1e-4));
    const F = (2 / Math.PI) * Math.acos(Math.exp(-ft)); // потери на кончике (Прандтль)
    const { cl, cd } = airfoil(theta - phi);
    const blade = 0.5 * sigma * (x * x + lam * lam) * (cl * Math.cos(phi) - cd * Math.sin(phi));
    return { r: 4 * F * lam * lam * x - blade, phi, cl, cd, blade };
  };
  let lo = 0, hi = x * Math.tan(theta);
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid).r > 0) hi = mid;
    else lo = mid;
  }
  const lam = (lo + hi) / 2, s = f(lam);
  return { lam, alpha: theta - s.phi, phi: s.phi, dCT: s.blade, dCP: 0.5 * sigma * (x * x + lam * lam) * (s.cl * Math.sin(s.phi) + s.cd * Math.cos(s.phi)) * x };
}
export function bladeElement(rpm, d, pitch, rho, B = 3) {
  const R = (d * IN) / 2, W = (rpm / 60) * TAU * R; // скорость кончика, м/с
  const { x0, N, stall } = BLADE;
  const dx = (1 - x0) / N;
  let CT = 0, CP = 0;
  const st = [];
  for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * dx;
    const theta = Math.atan(pitch / (Math.PI * d * x)); // шаг / длина окружности на этом радиусе
    const sigma = (B * chordRatio(x)) / Math.PI;
    const s = bladeStation(x, theta, sigma, B);
    CT += s.dCT * dx;
    CP += s.dCP * dx;
    st.push({ x, theta, alpha: s.alpha, phi: s.phi, dT: s.dCT, stall: s.alpha > stall });
  }
  const thrust = W > 0 ? CT * rho * Math.PI * R * R * W * W : 0;
  const shaft = W > 0 ? CP * rho * Math.PI * R * R * W ** 3 : 0;
  const k75 = st.reduce((b, s) => (Math.abs(s.x - 0.75) < Math.abs(b.x - 0.75) ? s : b), st[0]);
  return { grams: toGrams(thrust), shaft, st, at75: k75, tip: W, stalled: st.filter((s) => s.stall).length / N };
}

// Метод 4. Как на тяговом стенде главы 5: та же модель, что на стенде (src/models.mjs).
// Стенд знает три винта; для другого размера берём ближайший и переносим по закону подобия (×D⁴).
export function nearestStandProp(d, pitch) {
  let best = null;
  for (const [key, p] of Object.entries(PROPS)) {
    const dist = Math.abs(p.d - d) + Math.abs(p.pitch - pitch);
    if (!best || dist < best.dist) best = { key, p, dist };
  }
  return best;
}
export function standModel(rpm, d, pitch, rho, motorKey) {
  const { key, p, dist } = nearestStandProp(d, pitch);
  const motor = MOTORS[motorKey] ? motorKey : "2207-1950";
  const probe = thrustStand({ motor, prop: key, cells: 6, throttle: 0.6 }); // на стенде тяга ∝ n², берём «тягу на об/мин²»
  const scale = (d / p.d) ** 4 * (rho / RHO0);
  const k = probe.grams / probe.rpm ** 2, kp = probe.shaft / probe.rpm ** 3;
  const exact = dist < 1e-6;
  // Предел мотора: полный газ на 6S — выше этих оборотов этот мотор с этим винтом не раскрутит.
  const rpmMax = MOTORS[motorKey] ? thrustStand({ motor, prop: key, cells: 6, throttle: 1 }).rpm * ((p.d / d) ** 5 * (RHO0 / rho)) ** (1 / 3) : Infinity; // другой винт или воздух: та же мощность на валу (∝ ρ·n³·D⁵)
  if (rpm > rpmMax + 1) return { grams: NaN, shaft: NaN, key, exact, rpmMax, motor };
  return { grams: k * rpm * rpm * scale, shaft: kp * rpm ** 3 * scale * ((d / p.d) ** 1), key, exact, rpmMax, motor };
}

const C = { law: "#fcc419", mom: "#4dabf7", bem: "#51cf66", stand: "#ff6b6b" };
const rhoOf = (P) => airDensity(P.alt);
const gw = (g, w) => (w > 1 ? ` · ${fmt(g / w, 1)} г/Вт` : "");
const pnote = (g, w) => (Number.isFinite(w) ? `вал ≈ ${fmt(w)} Вт${gw(g, w)}` : "");

function runLaw(P) {
  const r = similarityLaw(P.rpm, P.d, rhoOf(P));
  return { value: r.grams, note: pnote(r.grams, r.shaft), shaft: r.shaft };
}
function runMom(P) {
  const r = momentumDisk(P.rpm, P.d, P.pitch, rhoOf(P));
  return { value: r.grams, note: `${pnote(r.grams, r.shaft)} · струя ${fmt(2 * r.vi)} м/с`, shaft: r.shaft, vi: r.vi };
}
function runBem(P, scene) {
  const r = bladeElement(P.rpm, P.d, P.pitch, rhoOf(P), scene.blades || 3);
  return { value: r.grams, note: `${pnote(r.grams, r.shaft)} · срыв на ${fmt(r.stalled * 100)} % лопасти`, shaft: r.shaft, bem: r };
}
function runStand(P, scene) {
  const r = standModel(P.rpm, P.d, P.pitch, rhoOf(P), scene.motor);
  if (!Number.isFinite(r.grams)) return { value: NaN, note: `мотор ${MOTORS[r.motor].name} с этим винтом на 6S не раскрутится выше ${fmt(r.rpmMax / 1000, 1)} тыс. об/мин` };
  return { value: r.grams, note: `${pnote(r.grams, r.shaft)}${r.exact ? "" : ` · пересчёт от винта ${PROPS[r.key].name}`}`, shaft: r.shaft };
}

// Подпись, которая ужимается, чтобы влезть в ширину (узкий экран телефона).
function fitText(g, text, x, y, maxW, size, align = "left", weight = 400) {
  let s = size;
  g.font = `${weight} ${s}px "IBM Plex Sans", system-ui, sans-serif`;
  const m = g.measureText(text).width;
  if (m > maxW) {
    s = Math.max(size * 0.6, (size * maxW) / m);
    g.font = `${weight} ${s}px "IBM Plex Sans", system-ui, sans-serif`;
  }
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(text, x, y);
}

// Скорость воздуха в плоскости винта по тяге (теория импульса) — для экрана.
const inducedFromThrust = (grams, d, rho) => (grams > 0 ? Math.sqrt(((grams / 1000) * G0) / (2 * rho * diskArea(d))) : 0);

export function createStage(canvas, { fitCanvas }) {
  const parts = Array.from({ length: 200 }, () => ({ u: Math.random() * 2 - 1, s: -2.4 + Math.random() * 6 }));
  let spin = 0, gScale = 1500, bemCache = { key: "", r: null };
  const bemFor = (P, scene, results) => {
    if (results.bem && results.bem.bem) return results.bem.bem;
    const key = `${P.rpm}|${P.d}|${P.pitch}|${P.alt}`;
    if (bemCache.key !== key) bemCache = { key, r: bladeElement(P.rpm, P.d, P.pitch, rhoOf(P), scene.blades || 3) };
    return bemCache.r;
  };
  return {
    reset() {
      for (const p of parts) p.s = -2.4 + Math.random() * 6;
    },
    frame(dt, P, results, scene, focus, calm) {
      const { w, h, dpr } = fitCanvas(canvas);
      const g = canvas.getContext("2d");
      const rho = rhoOf(P);
      // Фон-экран: тёмный, чуть светлее в центре; на высоте — холоднее.
      const bg = g.createRadialGradient(w * 0.42, h * 0.3, 10, w * 0.42, h * 0.3, Math.max(w, h) * 0.8);
      bg.addColorStop(0, P.alt > 1500 ? "#0d1530" : "#0e1428");
      bg.addColorStop(1, "#060912");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      const topH = h * 0.64;
      const fRes = results[focus] || {};
      const fCol = C[focus] || "#fff";
      const fOk = Number.isFinite(fRes.value), fG = fOk ? fRes.value : 0;
      const vi = focus === "mom" && fRes.vi !== undefined ? fRes.vi : inducedFromThrust(fG, P.d, rho);
      const vals = Object.values(results).map((r) => r.value).filter(Number.isFinite);
      const want = Math.max(800, ...vals) * 1.25;
      gScale += (want - gScale) * Math.min(1, dt * 4);

      // Геометрия бокового вида.
      const narrow = w / dpr < 560;
      const pad = (narrow ? 62 : 46) * dpr; // место под HUD сверху
      const cx = w * (narrow ? 0.36 : 0.4), dy = pad + (topH - pad) * 0.4;
      const Rmax = Math.min(w * 0.3, (topH - pad) * 0.62);
      const Rpx = Rmax * clamp(P.d / 8, 0.25, 1);
      const sTop = -dy / Rpx, sBot = (topH - dy) / Rpx;
      const vel = (s) => 1 + s / Math.sqrt(s * s + 1); // скорость на оси идеального диска / v
      const rad = (s) => Math.min(6, Math.sqrt(1 / Math.max(vel(s), 0.04))); // сечение струи: расход тот же
      // Линии тока: струя сужается под винтом до 0,71 радиуса (теория импульса).
      g.lineWidth = dpr;
      g.strokeStyle = "rgba(120,190,255,.13)";
      for (let u = -0.9; u <= 0.91; u += 0.3) {
        g.beginPath();
        for (let s = Math.max(sTop, -3); s <= sBot; s += 0.08) {
          const X = cx + u * Rpx * rad(s), Y = dy + s * Rpx;
          s === Math.max(sTop, -3) ? g.moveTo(X, Y) : g.lineTo(X, Y);
        }
        g.stroke();
      }
      // Частицы воздуха: скорость и яркость растут к винту и под ним (2v далеко внизу).
      // Штрихи собираем в 4 группы по яркости — по одному stroke на группу (быстро).
      g.globalCompositeOperation = "lighter";
      const speedPx = 12 * dpr; // пикселей в секунду на 1 м/с
      const NB = 4, buckets = Array.from({ length: NB }, () => []);
      for (const p of parts) {
        const v = vi * vel(p.s);
        if (!calm) p.s += (Math.max(v, 0.12 * vi) * speedPx * dt) / Rpx;
        if (p.s > sBot + 0.1 || p.s < sTop - 4) {
          p.s = Math.max(sTop, -2.6) - Math.random() * 0.2;
          p.u = Math.random() * 2 - 1;
        }
        const X = cx + p.u * Rpx * rad(p.s), Y = dy + p.s * Rpx;
        if (Y < 0) continue;
        const t = clamp(v / 30, 0, 1);
        const tail = Math.max(3 * dpr, calm ? 8 * dpr * t : Math.min(40 * dpr, v * speedPx * 0.06));
        buckets[Math.min(NB - 1, Math.floor(t * NB))].push(X, Y, tail);
      }
      for (let b = 0; b < NB; b++) {
        const q = buckets[b];
        if (!q.length) continue;
        const t = (b + 0.5) / NB;
        g.beginPath();
        for (let i = 0; i < q.length; i += 3) {
          g.moveTo(q[i], q[i + 1] - q[i + 2]);
          g.lineTo(q[i], q[i + 1]);
        }
        // Два прохода: широкий тусклый (свечение) и тонкий яркий.
        g.strokeStyle = `rgba(80,170,255,${0.08 + 0.18 * t})`;
        g.lineWidth = (4 + 4 * t) * dpr;
        g.stroke();
        g.strokeStyle = `rgba(${Math.round(110 + 140 * t)},${Math.round(205 + 45 * t)},255,${0.35 + 0.6 * t})`;
        g.lineWidth = (1 + 1.2 * t) * dpr;
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";

      // Мотор и луч рамы под винтом.
      const mw = Math.min(14 * dpr, Rpx * 0.22), mh = Math.min(24 * dpr, Rpx * 0.4); // мотор не больше винта
      g.fillStyle = "#1a2236";
      g.fillRect(0, dy + 2 * dpr + mh, cx - mw, 7 * dpr);
      const mg = g.createLinearGradient(cx - mw, 0, cx + mw, 0);
      mg.addColorStop(0, "#2b3550");
      mg.addColorStop(0.5, "#56627f");
      mg.addColorStop(1, "#232c44");
      g.fillStyle = mg;
      g.fillRect(cx - mw, dy + 4 * dpr, 2 * mw, mh);
      g.fillStyle = "#8fa0c4";
      g.fillRect(cx - 2 * dpr, dy - 6 * dpr, 4 * dpr, 10 * dpr);

      // Винт сбоку: диск-«размытие» и лопасти, которые крутятся (при calm — стоят).
      if (!calm) spin += Math.min(P.rpm / 25000, 1.6) * 7 * dt;
      const tilt = 0.16;
      g.fillStyle = "rgba(160,200,255,.07)";
      g.beginPath();
      g.ellipse(cx, dy, Rpx, Rpx * tilt, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(170,210,255,.35)";
      g.lineWidth = dpr;
      g.stroke();
      const B = scene.blades || 3;
      for (let k = 0; k < B; k++) {
        const psi = spin + (k * TAU) / B;
        const front = Math.sin(psi) > 0;
        g.strokeStyle = front ? "rgba(225,235,255,.95)" : "rgba(140,155,190,.6)";
        g.lineWidth = (front ? 4 : 3) * dpr;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(cx, dy);
        g.lineTo(cx + Rpx * Math.cos(psi), dy + Rpx * tilt * Math.sin(psi));
        g.stroke();
      }
      g.lineCap = "butt";

      // Стрелка тяги: длина ∝ тяге выбранного метода; метки остальных методов на той же шкале.
      const room = dy - pad - 4 * dpr;
      const len = (gr) => (clamp(gr, 0, gScale) / gScale) * room;
      const L = len(fG);
      g.strokeStyle = fCol;
      g.fillStyle = fCol;
      g.shadowColor = fCol;
      g.shadowBlur = 16 * dpr;
      g.lineWidth = 6 * dpr;
      g.beginPath();
      g.moveTo(cx, dy - 6 * dpr);
      g.lineTo(cx, dy - 6 * dpr - Math.max(0, L - 12 * dpr));
      g.stroke();
      if (L > 4 * dpr) {
        g.beginPath();
        g.moveTo(cx, dy - 6 * dpr - L);
        g.lineTo(cx - 11 * dpr, dy - 6 * dpr - L + 16 * dpr);
        g.lineTo(cx + 11 * dpr, dy - 6 * dpr - L + 16 * dpr);
        g.closePath();
        g.fill();
      }
      g.shadowBlur = 0;
      g.font = `700 ${13 * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.fillText(fOk ? `тяга ${fmt(fG)} г` : "тяга —", cx - 16 * dpr, dy - 6 * dpr - Math.max(L, 14 * dpr) + 8 * dpr);
      for (const [id, r] of Object.entries(results)) {
        if (!Number.isFinite(r.value) || id === focus) continue;
        const y = dy - 6 * dpr - len(r.value);
        g.strokeStyle = C[id] || "#fff";
        g.lineWidth = 2.5 * dpr;
        g.beginPath();
        g.moveTo(cx + 8 * dpr, y);
        g.lineTo(cx + 22 * dpr, y);
        g.stroke();
      }
      // Подписи потока.
      g.font = `600 ${(narrow ? 10 : 11) * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      g.fillStyle = "rgba(200,225,255,.85)";
      g.textAlign = "left";
      const lw = (narrow ? 112 : 150) * dpr, lx = Math.min(w - lw, cx + Rpx + 14 * dpr);
      g.fillText(fOk ? `у винта v ≈ ${fmt(vi, 1)} м/с` : "у винта v —", lx, dy);
      g.fillText(fOk ? `ниже струя ≈ ${fmt(2 * vi, 1)} м/с` : "ниже струя —", Math.min(w - lw, cx + Rpx * 0.71 + 14 * dpr), Math.min(topH - 10 * dpr, dy + Rpx * 1.6));

      // Нижняя полоса: одна лопасть сверху — подъёмная сила по радиусу (модель лопасти).
      const bem = bemFor(P, scene, results);
      const y0 = topH + 6 * dpr, sh = h - y0 - 6 * dpr;
      const isB = focus === "bem";
      g.fillStyle = isB ? "rgba(81,207,102,.07)" : "rgba(255,255,255,.03)";
      g.fillRect(0, y0, w, sh);
      const hx = w * 0.06, tx = w * 0.6, yb = y0 + sh * 0.78, span = tx - hx;
      const X = (x) => hx + ((x - BLADE.x0) / (1 - BLADE.x0)) * span;
      g.fillStyle = "#3a4562";
      g.beginPath();
      g.moveTo(X(BLADE.x0), yb);
      for (let x = BLADE.x0; x <= 1.0001; x += 0.05) g.lineTo(X(x), yb - chordRatio(x) * span * 0.28);
      for (let x = 1; x >= BLADE.x0 - 1e-4; x -= 0.05) g.lineTo(X(x), yb + chordRatio(x) * span * 0.12);
      g.closePath();
      g.fill();
      const maxT = Math.max(1e-9, ...bem.st.map((s) => s.dT));
      const room2 = sh * (narrow ? 0.45 : 0.55);
      for (let i = 0; i < bem.st.length; i += 2) {
        const s = bem.st[i];
        const col = s.stall ? "#ff6b6b" : s.alpha > BLADE.stall * 0.8 ? "#ffa94d" : "#51cf66";
        const a = (Math.max(0, s.dT) / maxT) * room2;
        const x = X(s.x);
        g.strokeStyle = col;
        g.fillStyle = col;
        g.shadowColor = col;
        g.shadowBlur = (isB ? 10 : 4) * dpr;
        g.lineWidth = 2.5 * dpr;
        g.beginPath();
        g.moveTo(x, yb - 4 * dpr);
        g.lineTo(x, yb - 4 * dpr - a);
        g.stroke();
        if (a > 6 * dpr) {
          g.beginPath();
          g.moveTo(x, yb - 8 * dpr - a);
          g.lineTo(x - 4 * dpr, yb - a);
          g.lineTo(x + 4 * dpr, yb - a);
          g.closePath();
          g.fill();
        }
      }
      g.shadowBlur = 0;
      g.fillStyle = "rgba(220,230,255,.75)";
      g.font = `${10.5 * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      g.textAlign = "left";
      g.fillText("втулка", hx, yb + sh * 0.14);
      g.textAlign = "right";
      g.fillText("кончик", tx, yb + sh * 0.14);
      g.textAlign = "left";
      const cap = narrow ? "лопасть: подъёмная сила по радиусу · красные — срыв" : "одна лопасть сверху: стрелки — подъёмная сила по радиусу · оранжевые — близко к срыву · красные — срыв";
      fitText(g, cap, hx, y0 + 11 * dpr, tx - hx + w * 0.04, 10.5 * dpr);

      // Сечение лопасти на 3/4 радиуса: угол установки θ, поток φ, угол атаки α = θ − φ.
      const k = bem.at75;
      const ax = w * 0.82, ay = y0 + sh * 0.5, cl = Math.min(w * 0.14, sh * 0.7);
      g.save();
      g.translate(ax, ay);
      g.strokeStyle = "rgba(255,255,255,.25)";
      g.lineWidth = dpr;
      g.setLineDash([3 * dpr, 4 * dpr]);
      g.beginPath();
      g.moveTo(-cl * 0.7, 0);
      g.lineTo(cl * 0.7, 0);
      g.stroke();
      g.setLineDash([]);
      // Набегающий поток: сбоку (вращение) + сверху (струя) → под углом φ.
      const fl = cl * 0.62;
      g.strokeStyle = "#74c0fc";
      g.fillStyle = "#74c0fc";
      g.lineWidth = 2 * dpr;
      const ex = Math.cos(k.phi), ey = Math.sin(k.phi);
      g.beginPath();
      g.moveTo(-fl * ex - cl * 0.45, -fl * ey);
      g.lineTo(-cl * 0.08 * ex - cl * 0.45, -cl * 0.08 * ey);
      g.stroke();
      g.save();
      g.translate(-cl * 0.08 * ex - cl * 0.45, -cl * 0.08 * ey);
      g.rotate(k.phi);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-8 * dpr, -4 * dpr);
      g.lineTo(-8 * dpr, 4 * dpr);
      g.closePath();
      g.fill();
      g.restore();
      // Профиль, повёрнутый на θ (носом влево — туда, куда движется лопасть).
      g.rotate(k.theta);
      const pf = g.createLinearGradient(0, -8 * dpr, 0, 8 * dpr);
      pf.addColorStop(0, isB ? "#8ce99a" : "#b8c4dc");
      pf.addColorStop(1, isB ? "#2b8a3e" : "#4c5875");
      g.fillStyle = pf;
      g.beginPath();
      g.moveTo(-cl * 0.45, 0);
      g.bezierCurveTo(-cl * 0.4, -cl * 0.12, cl * 0.05, -cl * 0.1, cl * 0.45, 0);
      g.bezierCurveTo(cl * 0.05, -cl * 0.02, -cl * 0.4, cl * 0.04, -cl * 0.45, 0);
      g.fill();
      g.restore();
      const deg = (r) => fmt((r * 180) / Math.PI, 1);
      g.textAlign = "center";
      g.fillStyle = k.alpha > BLADE.stall ? "#ff8787" : "#8ce99a";
      fitText(g, `угол атаки α = ${deg(k.alpha)}°`, ax, y0 + 11 * dpr, 2 * (w - ax) - 6 * dpr, 12 * dpr, "center", 700);
      g.fillStyle = "rgba(220,230,255,.75)";
      fitText(g, `на 3/4 радиуса: θ ${deg(k.theta)}° − φ ${deg(k.phi)}°`, ax, h - 10 * dpr, 2 * (w - ax) - 24 * dpr, 10 * dpr, "center");
    },
  };
}

export default {
  id: "thrust",
  title: "Сколько тянет винт",
  chapters: "Главы 2 и 5",
  accent: "#ff922b",
  lead: "Сбоку — винт на моторе. Он отбрасывает воздух вниз (светящийся поток), а сам тянется вверх (стрелка). <b>Тяга</b> — сила, с которой винт тянет мотор вверх; меряем её в граммах: столько покажут весы на тяговом стенде. Четыре способа посчитать тягу при одних и тех же оборотах, размере винта и плотности воздуха — от закона подобия до модели, которая считает каждый кусочек лопасти.",
  stageLabel: "Винт сбоку: поток воздуха вниз, стрелка тяги вверх; внизу — лопасть со стрелками подъёмной силы по радиусу и сечение лопасти с углом атаки",
  scenes: [
    { id: "race5", name: "5″ гоночный", desc: "5×4,3×3, мотор 2207 1950KV, 6S", motor: "2207-1950", blades: 3, set: { rpm: 25000, d: 5, pitch: 4.3, alt: 0 } },
    { id: "lr7", name: "7″ дальнолёт", desc: "7×4×3 (7040×3), мотор 2812 1700KV", motor: "2812-1700", blades: 3, set: { rpm: 20000, d: 7, pitch: 4, alt: 0 } },
    { id: "whoop3", name: "3″ синевуп", desc: "3×3×3 в защитном кольце для съёмки (cinewhoop, гл. 3); кольцо в расчёте не учтено", motor: null, blades: 3, set: { rpm: 32000, d: 3, pitch: 3, alt: 0 } },
    { id: "alt3000", name: "Высокогорье 3000 м", desc: "тот же 5″, но воздух на четверть реже", motor: "2207-1950", blades: 3, set: { rpm: 25000, d: 5, pitch: 4.3, alt: 3000 } },
  ],
  params: [
    { id: "rpm", label: "Обороты винта", min: 2000, max: 40000, step: 500, value: 25000, fmt: (v) => `${fmt(v)} об/мин` },
    { id: "d", label: "Диаметр винта (первое число: 5×4,3×3)", min: 2.5, max: 8, step: 0.1, value: 5, fmt: (v) => `${fmt(v, 1)}″` },
    { id: "pitch", label: "Шаг: путь за оборот (второе число)", min: 1.5, max: 6, step: 0.1, value: 4.3, fmt: (v) => `${fmt(v, 1)}″` },
    { id: "alt", label: "Высота над морем (реже воздух)", min: 0, max: 5000, step: 100, value: 0, fmt: (v) => `${fmt(v)} м` },
  ],
  metric: { label: "Тяга одного винта", unit: "г", digits: 0 },
  reference: (P, scene) => ({ label: "модель лопасти", value: bladeElement(P.rpm, P.d, P.pitch, rhoOf(P), scene.blades || 3).grams, note: "Разница — с моделью лопасти: её не подгоняли под замер, и только она считает угол атаки и срыв потока по всей лопасти. 1 000 г тяги — это сила, с которой гиря 1 кг давит на весы. Ватты в таблице — мощность на валу мотора; от батареи нужно больше (мотор и ESC тоже греются)." }),
  methods: [
    {
      id: "law",
      name: "Закон подобия",
      short: "один замер → любой размер",
      color: C.law,
      eq: `<p class="mx-f">T = C<sub>T</sub>·ρ·n²·D⁴ &nbsp;&nbsp; P = C<sub>P</sub>·ρ·n³·D⁵</p><p>n — обороты в секунду, D — диаметр, ρ — плотность воздуха. Коэффициенты C<sub>T</sub> и C<sub>P</sub> берут из одного замера на стенде. Вдвое больше обороты — тяга ×4. Диаметр больше на 20 % — тяга ×2.</p>`,
      explain: (P, r) => {
        const s = similarityLaw(P.rpm, P.d, rhoOf(P));
        return `<p>Опорный замер: 5×4,3×3 на ${fmt(REF.rpm)} об/мин → ${fmt(REF.grams)} г, ${fmt(REF.shaft)} Вт на валу (пример стендового замера, не паспорт).</p><p>T = ${fmt(REF.grams)} г × (${fmt(P.rpm)} / ${fmt(REF.rpm)})² × (${fmt(P.d, 1)} / ${REF.d})⁴ × (${fmt(rhoOf(P), 3)} / 1,225) = <b>${fmt(r.value)} г</b></p><p>Мощность на валу: ${fmt(REF.shaft)} Вт × (n-отношение)³ × (D-отношение)⁵ × ρ-отношение = <b>${fmt(s.shaft)} Вт</b>.</p><p>Шаг ${fmt(P.pitch, 1)}″ в формулу не входит: закон считает, что винт той же формы, что и эталон, то есть шаг/диаметр = 0,86. Для ${fmt(P.d, 1)}″ это винт ${fmt(P.d, 1)}×${fmt(0.86 * P.d, 1)}${Math.abs(P.pitch / P.d - 0.86) > 0.05 ? `, а у тебя шаг/диаметр ${fmt(P.pitch / P.d, 2)} — поэтому закон ${P.pitch / P.d < 0.86 ? "переоценивает" : "недооценивает"} и тягу, и мощность` : ""}.</p>`;
      },
      assume: "винт той же формы, что и опорный (шаг/диаметр и ширина лопастей те же); один замер переносится на другие обороты и размеры",
      run: (P) => runLaw(P),
      src: ["similarityLaw", "airDensity"],
      refs: [
        { page: 23, quote: "Больший диаметр или шаг — как широкие вёсла: гребёшь больше воздуха, больше тяга и скорость, но больше ток, и тяжелее быстро менять обороты." },
        { page: 25, quote: "Больший проп требует большего момента: мотор берёт больший ток" },
        { page: 73, quote: "Температура падает примерно на 0,6 °C на каждые 100 м высоты." },
      ],
      review: {
        status: "simplified",
        tol: "отношение к модели лопасти не зависит от оборотов и высоты (обе модели ∝ n²·ρ по построению) и задаётся только формой винта: при шаге/диаметре 0,86, как у опорного, −2,5 % для любого диаметра; при шаге/диаметре 0,5–1,1 — от −11 до +71 %; на трёх винтах стенда гл. 5 выше стенда на 14 % (5×4,3), 36 % (6×4) и 51 % (7×4)",
        note: "Книга говорит словами: больше диаметр — больше тяга и ток. Формула T ∝ n²·D⁴ — закон подобия из аэродинамики, им же пользуется тяговый стенд главы 5. Он точен для винтов той же формы; про шаг он не знает, поэтому у 7×4 с более плоской лопастью переоценивает тягу: по сути он считает винт 7×6 (модель лопасти для 7×6 даёт 2 643 г, закон — 2 582 г).",
      },
    },
    {
      id: "mom",
      name: "Теория импульса",
      short: "идеальный диск: воздух вниз — винт вверх",
      color: C.mom,
      eq: `<p class="mx-f">T = 2·ρ·A·v² &nbsp;&nbsp; v = s·(шаг·n) / 2</p><p class="mx-f">P<sub>идеал</sub> = T<sup>1,5</sup> / √(2ρA) &nbsp;&nbsp; P<sub>вал</sub> = P<sub>идеал</sub> / FM</p><p>Винт — «диск», который каждую секунду отбрасывает массу воздуха ρ·A·v и разгоняет её до 2v. Сколько импульса отдал воздуху — столько тяги получил (третий закон Ньютона). <b>Допустим (это наше допущение, а не закон)</b>, что скорость струи задаёт шаг: «шуруп» за оборот проходит шаг, но в воздухе проскальзывает (доля s).</p>`,
      explain: (P, r) => {
        const m = momentumDisk(P.rpm, P.d, P.pitch, rhoOf(P));
        const A = diskArea(P.d);
        return `<p>Шаговая скорость = ${fmt(P.pitch, 1)}″ × ${fmt(P.rpm)}/60 = <b>${fmt(m.vp, 1)} м/с</b>. Проскальзывание s = ${fmt(m.slip, 2)} (из опорного замера) → у винта v = ${fmt(m.vi, 1)} м/с, внизу струя ${fmt(2 * m.vi, 1)} м/с.</p><p>A = π·(${fmt(P.d, 1)}″/2)² = ${fmt(A, 4)} м² (${fmt(A * 1e4, 1)} см²). T = 2 × ${fmt(rhoOf(P), 3)} × ${fmt(A, 4)} × ${fmt(m.vi, 1)}² = ${fmt((r.value / 1000) * G0, 2)} Н ≈ <b>${fmt(r.value)} г</b>.</p><p>Идеальная мощность ${fmt(m.ideal)} Вт; настоящий винт теряет больше (FM = ${fmt(FM, 2)}) → <b>${fmt(m.shaft)} Вт</b> на валу, ${m.shaft > 1 ? fmt(r.value / m.shaft, 1) : "—"} г/Вт.</p><p>Большой диск выгоднее: та же тяга при меньшей скорости струи — меньше ватт. Поэтому на одну и ту же тягу 7″ берёт меньше ватт, чем 5″ (сравнивать граммы на ватт честно только при одинаковой тяге).</p><p><b>Проверка согласованности (не подтверждение).</b> Дадим диску ровно столько ватт, сколько насчитал закон подобия (${fmt(similarityLaw(P.rpm, P.d, rhoOf(P)).shaft)} Вт): теория импульса даст ${fmt(thrustFromPower(similarityLaw(P.rpm, P.d, rhoOf(P)).shaft, P.d, rhoOf(P)))} г, закон — ${fmt(similarityLaw(P.rpm, P.d, rhoOf(P)).grams)} г. Совпадение заложено заранее: оба метода откалиброваны по одной точке, поэтому разница всегда одна и та же. Зато видно главное: при одинаковых оборотах методы спорят не о физике тяги, а о том, <b>сколько мощности винт забирает</b>. Это задаёт шаг: плоский винт берёт меньше ватт и тянет меньше.</p>`;
      },
      assume: "воздух идёт ровной струёй через весь диск, без закрутки; струя за винтом летит со скоростью s·шаг·n, s одно для всех винтов; качество FM = 0,6 постоянно; при том же шаге тяга растёт только как D² (не D⁴) — большой винт с тем же шагом метод недооценивает",
      run: (P) => runMom(P),
      src: ["momentumDisk", "thrustFromPower", "airDensity"],
      refs: [
        { page: 23, quote: "5 — шаг: путь за 1 оборот" },
        { page: 23, quote: "как шуруп в дереве: на сколько «вкрутится» в воздух" },
        { page: 32, quote: "Мощность по тяге P ≈ тяга(г) / удельная тяга(г/Вт)" },
        { page: 23, quote: "у воздуха нет «точки опоры», как у воды. Эффективность зависит от оборотов и формы лопасти." },
      ],
      review: { status: "beyond", tol: "отношение к модели лопасти не зависит от оборотов и высоты (по построению) и задаётся только формой винта: при шаге/диаметре 0,86, как у опорного, −2,5 %; при шаге/диаметре 0,5–1,1 — от −42 до +45 %; от стенда гл. 5: +14 % (5×4,3), −18 % (6×4), −33 % (7×4)", note: "Теории импульса нет в книге: это закон сохранения импульса для потока (Рэнкин, Фруд). Формула мощности объясняет «удельную тягу (г/Вт)» из книги: она растёт с размером диска. Слабое место — связь скорости струи с шагом: тяга растёт как шаг², это слишком круто для плоских винтов. Проверка «на одной мощности» — это проверка согласованности, а не независимое подтверждение: оба метода откалиброваны по одной точке, поэтому при ваттах закона подобия теория импульса всегда отличается от него на одну и ту же долю (сейчас −0,6 %). Она показывает, что расхождение на одинаковых оборотах — это разная оценка мощности, которую берёт винт." },
    },
    {
      id: "bem",
      name: "Модель лопасти",
      short: "упрощённый BEM: 24 кусочка лопасти",
      color: C.bem,
      eq: `<p class="mx-f">θ = arctg(шаг / 2πr) &nbsp;&nbsp; α = θ − φ &nbsp;&nbsp; C<sub>L</sub> = 0,9·2π·α</p><p class="mx-f">dT = ½·ρ·W²·c·B·(C<sub>L</sub>·cos φ − C<sub>D</sub>·sin φ)·dr</p><p>Лопасть режем на кусочки. На каждом кусочке — крыло: θ — угол установки (из шага), φ — угол, под которым набегает воздух (вращение плюс струя сверху), α — угол атаки. W — скорость воздуха относительно кусочка, c — ширина лопасти, B — число лопастей. За углом срыва (12°) подъёмная сила больше не растёт.</p>`,
      explain: (P, r) => {
        const b = r.bem || bladeElement(P.rpm, P.d, P.pitch, rhoOf(P));
        const k = b.at75, deg = (x) => fmt((x * 180) / Math.PI, 1);
        return `<p>Кончик лопасти летит со скоростью <b>${fmt(b.tip)} м/с</b> (${fmt(b.tip * 3.6)} км/ч). На 3/4 радиуса: θ = ${deg(k.theta)}°, воздух набегает под φ = ${deg(k.phi)}°, угол атаки α = ${deg(k.alpha)}° ${k.alpha > BLADE.stall ? "— <b>за срывом</b>" : "— поток держится"}.</p><p>Сумма по 24 кусочкам: <b>${fmt(r.value)} г</b>, на валу ${fmt(b.shaft)} Вт. Срыв на ${fmt(b.stalled * 100)} % длины лопасти (у втулки угол установки самый крутой).</p><p>Больше шаг → больше θ → больше α → больше подъёмной силы при тех же оборотах. Но после 12° срыв: тяга почти не растёт, а мощность растёт.</p>${b.tip > 240 ? `<p><b>Осторожно:</b> кончик летит быстрее 0,7 скорости звука (звук ≈ 340 м/с). Появляются ударные волны, и все модели здесь завышают тягу.</p>` : ""}`;
      },
      assume: "форма лопасти типичная для гоночного винта (самая широкая на 40 % радиуса); тонкий профиль с наклоном 0,9·2π; срыв при 12° как резкое ограничение; кусочки не влияют друг на друга, кроме общей струи; шаг считаем одинаковым до самой втулки — у настоящих винтов у втулки лопасть положе, поэтому «срыв» у втулки здесь преувеличен; у кончика часть тяги теряется на перетекание (поправка Прандтля)",
      run: (P, scene) => runBem(P, scene),
      src: ["bladeElement", "bladeStation", "airfoil", "chordRatio"],
      refs: [
        { page: 11, quote: "Угол атаки α — угол между крылом (лопастью) и набегающим потоком." },
        { page: 11, quote: "Задерёшь слишком сильно — поток сорвётся, и рука будет просто тормозить." },
        { page: 11, quote: "Лопасть пропеллера — та же ладонь, только вращается." },
        { page: 23, quote: "Высокий шаг — лопасть повёрнута круче, низкий — более плоская." },
      ],
      review: { status: "beyond", tol: "без подгонки: 5×4,3×3 на 25 000 об/мин — 1 077 г против опорного замера 1 050 г (+2,6 %); стенд гл. 5 ниже модели на 14 % (5×4,3), 10 % (6×4) и 4 % (7×4) — отношения не зависят от оборотов; тяга растёт как n^2,000, а по диаметру как D^4,000 только при постоянном отношении шаг/диаметр — при том же шаге показатель зависит от размера: от ≈ D^2,5 (большой винт, пологий шаг) до ≈ D^4,3 (маленький винт, крутой шаг)", note: "Книга объясняет угол атаки и срыв на ладони в окне машины (гл. 2). Модель лопасти считает это число за числом. Её не калибровали по замеру: ширина лопасти и угол срыва — типичные значения, поэтому совпадение с замером — проверка модели, а не подгонка." },
    },
    {
      id: "stand",
      name: "Тяговый стенд гл. 5",
      short: "та же модель, что на стенде",
      color: C.stand,
      dash: true,
      eq: `<p class="mx-f">T = C<sub>T</sub>(шаг/D, лопасти)·ρ·n²·D⁴</p><p>Модель тягового стенда из главы 5 этого учебника: закон подобия, но коэффициент C<sub>T</sub> растёт с отношением шага к диаметру. Стенд знает три винта (5×4,3×3, 6×4×3, 7×4×3) и моторы 2207 и 2812: выше «полного газа» на 6S кривая обрывается.</p>`,
      explain: (P, r, scene) => {
        const s = standModel(P.rpm, P.d, P.pitch, rhoOf(P), scene.motor);
        const lim = Number.isFinite(s.rpmMax) ? ` Мотор ${MOTORS[s.motor].name} на 6S при полном газе раскрутит этот винт до ${fmt(s.rpmMax)} об/мин (без нагрузки по книге было бы KV × V = ${fmt(MOTORS[s.motor].kv)} × 24,3 В (6S по 4,05 В на банку; полностью заряженная — 25,2 В) ≈ ${fmt(MOTORS[s.motor].kv * 24.3)}).` : "";
        return `<p>Винт стенда: ${PROPS[s.key].name}${s.exact ? "" : ` — ближайший к ${fmt(P.d, 1)}×${fmt(P.pitch, 1)}, пересчитан ×(${fmt(P.d, 1)}/${PROPS[s.key].d})⁴${Math.abs(P.pitch - PROPS[s.key].pitch) > 0.05 ? ` — шаг ${fmt(P.pitch, 1)}″ вместо ${fmt(PROPS[s.key].pitch, 1)}″ не учтён` : ""}`}. Тяга = <b>${fmt(r.value)} г</b>.${lim}</p>`;
      },
      assume: "коэффициенты стенда — учебная оценка; 3″ и другие размеры пересчитаны от ближайшего винта стенда",
      run: (P, scene) => runStand(P, scene),
      src: ["standModel", "nearestStandProp"],
      refs: [
        { page: 22, quote: "1700KV — сколько оборотов в минуту мотор даёт на каждый вольт без нагрузки." },
        { page: 26, quote: "Выше давление — быстрее мотор (обороты = KV × V)." },
        { page: 25, quote: "Пропеллер подбирают под мотор, KV и батарею." },
      ],
      review: { status: "simplified", tol: "5×4,3×3 на 25 000 об/мин — 921 г, на 12 % меньше опорного замера (1 050 г); от модели лопасти −14 % (5×4,3), −10 % (6×4), −4 % (7×4) — отношения не зависят от оборотов и высоты", note: "Это модель, на которой работает тяговый стенд главы 5. Обрыв кривой показывает слова книги: «пропеллер подбирают под мотор, KV и батарею» — мотор с тяжёлым винтом не докрутит до оборотов KV × V." },
    },
  ],
  chart: {
    title: "Тяга винта в зависимости от оборотов",
    x: { param: "rpm", min: 0, max: 40000, label: "обороты", unit: "об/мин" },
    y: { label: "тяга", unit: "г", min: 0 },
    samples: 60,
  },
  hud: (P, results, scene, focus) => {
    const r = results[focus] || {};
    const rho = rhoOf(P);
    return `<span>${fmt(P.d, 1)}×${fmt(P.pitch, 1)}×${scene.blades || 3} · ${fmt(P.rpm)} об/мин</span><span>ρ = ${fmt(rho, 3)} кг/м³${P.alt ? ` (−${fmt((1 - rho / RHO0) * 100)} %)` : ""}</span><span>4 винта: ${Number.isFinite(r.value) ? fmt((4 * r.value) / 1000, 2) + " кг" : "—"}</span>`;
  },
  stage: createStage,
  try: [
    "Сцена «5″ гоночный»: подними обороты с 12 500 до 25 000 — вдвое. Тяга у всех методов вырастет в 4 раза: тяга ∝ n². (Жёлтую линию закона подобия здесь не видно: она лежит под синей линией теории импульса — для винта 5×4,3 они совпадают по калибровке.)",
    "Сцена «5″ гоночный», не меняя оборотов, увеличь шаг с 3 до 5,5″. «Закон подобия» стоит на месте — он не знает про шаг. «Модель лопасти» растёт с 763 до 1 185 г, но всё медленнее: угол атаки на 3/4 радиуса доходит до 15°, а доля лопасти за срывом растёт с 25 до 88 % (у втулки срыв в модели преувеличен).",
    "Сцена «Высокогорье 3000 м»: воздух реже на 26 % — и тяга всех методов падает на те же 26 %. Чтобы висеть, мотору придётся крутить быстрее.",
    "Сцена «7″ дальнолёт»: поставь 15 500 об/мин — модель лопасти даст около 1 050 г, как 5″ на 25 000. Сравни мощность: ≈ 200 Вт против ≈ 330 Вт у 5″ (5,2 против 3,3 г/Вт). Большой диск отбрасывает больше воздуха медленнее — на ту же тягу нужно меньше ватт. Закон подобия здесь не согласен: он считает 7″ винтом 7×6 и даёт ≈ 1 550 г.",
    "Сцена «7″ дальнолёт», обороты до упора: линия «стенда» обрывается около 28 500 об/мин. Мотор 2812 1700KV с этим винтом быстрее не раскрутит — так проп «на вырост» перегружает мотор (гл. 5).",
  ],
};
