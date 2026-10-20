// Эксперимент «Сколько продержится батарея» (гл. 6–7): две формулы книги, формула с просадкой и численный разряд.
// Все методы получают одно и то же: ёмкость, число банок, среднюю мощность полёта, температуру и сопротивление банки.
import { fmt, clamp, lerp, TAU } from "./kit.mjs";

export const V_NOM = 3.7; // номинал банки LiPo, В (книга, с. 27, 32)
export const CUTOFF = 3.5; // садиться при 3,5 В на банку под нагрузкой (книга, с. 7, 28, 29)
export const RESERVE = 0.8; // реально доступно 70–80 % ёмкости (книга, с. 32)

// Напряжение банки LiPo без нагрузки в зависимости от заряда: [доля заряда, вольты]. Типичная таблица производителей.
export const OCV_TABLE = [[0, 3.27], [0.05, 3.61], [0.1, 3.69], [0.15, 3.71], [0.2, 3.73], [0.25, 3.75], [0.3, 3.77], [0.35, 3.79], [0.4, 3.8], [0.45, 3.82], [0.5, 3.84], [0.55, 3.85], [0.6, 3.87], [0.65, 3.91], [0.7, 3.95], [0.75, 3.98], [0.8, 4.02], [0.85, 4.08], [0.9, 4.11], [0.95, 4.15], [1, 4.2]];

// Напряжение без нагрузки при заряде soc (0…1): линейно между точками таблицы.
export function ocv(soc) {
  const s = clamp(soc, 0, 1) * 20;
  const k = Math.min(19, Math.floor(s));
  return OCV_TABLE[k][1] + (OCV_TABLE[k + 1][1] - OCV_TABLE[k][1]) * (s - k);
}

// Сопротивление банки, Ом: на холоде растёт (×1,9 при 0 °C, ×2,4 при −10 °C, ×3,1 при −20 °C), в тепле немного падает.
// Почти пустая банка (заряд меньше 10–15 %) тоже хуже отдаёт ток: множитель до ×1,5 при нуле.
export function cellResistance(r25mOhm, tempC, soc = 1) {
  return (r25mOhm / 1000) * Math.exp(0.025 * (25 - clamp(tempC, -30, 45))) * (1 + 0.5 * Math.exp(-clamp(soc, 0, 1) / 0.08));
}

// Ток банки при постоянной мощности: моторам нужна мощность, поэтому при просадке ток растёт.
// p = V·I и V = E − I·R  →  R·I² − E·I + p = 0. Берём меньший корень. Нет корня — батарея не может отдать такую мощность.
export function cellCurrent(E, R, pCell) {
  const D = E * E - 4 * R * pCell;
  if (D < 0) return NaN;
  return (E - Math.sqrt(D)) / (2 * R);
}

// Метод 1. По ёмкости (книга, с. 32–33): ток из мощности через номинал, затем t = Q / I × 60 × 0,8.
export function byCapacity(capMah, S, powerW) {
  const I = powerW / (V_NOM * S); // А, из P = V × I
  const tFull = (capMah / (I * 1000)) * 60; // мА·ч / мА = ч, × 60 = мин
  return { I, tFull, t: tFull * RESERVE };
}

// Метод 2. По энергии (книга, с. 26): Вт·ч = V × А·ч, время = Вт·ч / Вт (в часах), × 60 × 0,8.
export function byEnergy(capMah, S, powerW) {
  const wh = V_NOM * S * (capMah / 1000);
  const tFull = (wh / powerW) * 60;
  return { wh, tFull, t: tFull * RESERVE };
}

// Метод 3. Энергия минус нагрев: напряжение под нагрузкой ниже номинала на I·R, значит ток больше,
// а часть энергии греет саму батарею. Форма кривой разряда не учитывается — запас по-прежнему 0,8.
export function energyMinusHeat(capMah, S, powerW, r25mOhm, tempC) {
  const R = cellResistance(r25mOhm, tempC);
  const I = cellCurrent(V_NOM, R, powerW / S);
  if (!Number.isFinite(I)) return { R, I: NaN, vLoad: NaN, heatShare: 1, t: 0 };
  const vLoad = V_NOM - I * R;
  const t = (capMah / (I * 1000)) * 60 * RESERVE;
  return { R, I, vLoad, heatShare: (I * R) / V_NOM, t };
}

// Метод 4. Разряд с просадкой: шаг за шагом считаем заряд, ток, напряжение под нагрузкой и нагрев батареи.
// Посадка — когда напряжение банки под нагрузкой опустилось до 3,5 В.
export function simulateDischarge(P, record = false, fine = 1) {
  const S = P.S, Q = P.cap / 1000, pCell = P.power / S;
  const mass = (Q * V_NOM * S) / 150; // кг: у LiPo около 150 Вт·ч на килограмм
  const heatCap = 1000 * mass; // Дж/К: теплоёмкость ≈ 1 кДж на кг и градус
  const cool = 1.2 * Math.pow(mass, 2 / 3); // Вт/К: обдув пропеллерами
  const est = (Q * 3600 * V_NOM) / pCell; // грубая длительность, с
  const dt = clamp(est / 800, 0.1, 60) / fine; // fine > 1 — мельче шаг (для проверки точности)
  let soc = 1, T = P.temp, t = 0, prev = null, reason = "empty", I0 = NaN, V0 = NaN, R0 = NaN;
  const tr = record ? { t: [], v: [], e: [], soc: [], T: [], I: [] } : null;
  const every = Math.max(1, Math.round(est / dt / 320));
  const tEnd = 3 * est;
  for (let n = 0; t < tEnd; n++) {
    const R = cellResistance(P.r, T, soc);
    const E = ocv(soc);
    const I = cellCurrent(E, R, pCell);
    const V = Number.isFinite(I) ? E - I * R : 0;
    if (n === 0) {
      I0 = I;
      V0 = Number.isFinite(I) ? V : NaN; // напряжение «рухнуло» — просадку не выдумываем
      R0 = R;
    }
    if (tr && (n % every === 0 || V <= CUTOFF || !Number.isFinite(I))) {
      tr.t.push(t / 60);
      tr.v.push(Math.max(V, 2.9));
      tr.e.push(E);
      tr.soc.push(soc);
      tr.T.push(T);
      tr.I.push(I);
    }
    if (!Number.isFinite(I)) {
      reason = "collapse";
      break;
    }
    if (V <= CUTOFF) {
      reason = n === 0 ? "takeoff" : "cutoff";
      if (prev) {
        // Уточняем момент пересечения 3,5 В между двумя шагами.
        const f = (prev.V - CUTOFF) / (prev.V - V);
        t = prev.t + f * dt;
        soc = prev.soc + f * (soc - prev.soc);
        T = prev.T + f * (T - prev.T);
        if (tr) {
          const k = tr.t.length - 1;
          tr.t[k] = t / 60;
          tr.v[k] = CUTOFF;
          tr.e[k] = ocv(soc);
          tr.soc[k] = soc;
          tr.T[k] = T;
        }
      }
      break;
    }
    if (soc <= 0) break;
    prev = { V, t, soc, T };
    soc -= (I * dt) / (Q * 3600);
    T += ((S * I * I * R - cool * (T - P.temp)) * dt) / heatCap;
    t += dt;
  }
  return { minutes: t / 60, reason, soc: Math.max(0, soc), Tend: T, I0, V0, R0, traj: tr };
}

function simRun(P) {
  const s = simulateDischarge(P);
  const note =
    s.reason === "collapse" ? "батарея не может отдать такую мощность" :
    s.reason === "takeoff" ? "просадка ниже 3,5 В сразу на взлёте" :
    `сел при 3,5 В, в банках осталось ${fmt(s.soc * 100)} %, батарея ${fmt(s.Tend)} °C`;
  return { value: s.minutes, note, I0: s.I0, V0: s.V0, R0: s.R0, Tend: s.Tend, soc: s.soc, reason: s.reason };
}

const keyOf = (P) => `${P.cap}|${P.S}|${P.power}|${P.temp}|${P.r}`;

// Живой экран: кривые напряжения во времени, линия 3,5 В, «бак» батареи и дрон на шкале времени.
export function createStage(canvas, { fitCanvas }) {
  const g = canvas.getContext("2d");
  let sim = null, key = "", clock = 0;
  const ensure = (P) => {
    const k = keyOf(P);
    if (k !== key) {
      sim = simulateDischarge(P, true);
      key = k;
      clock = 0;
    }
  };
  const interp = (arr, tm) => {
    const ts = sim.traj.t;
    if (tm <= ts[0]) return arr[0];
    for (let i = 1; i < ts.length; i++) if (ts[i] >= tm) return lerp(arr[i - 1], arr[i], (tm - ts[i - 1]) / Math.max(1e-9, ts[i] - ts[i - 1]));
    return arr[arr.length - 1];
  };
  const COL = { cap: "#fcc419", energy: "#ff922b", heat: "#cc5de8", sim: "#51cf66" };
  return {
    reset(P) {
      key = "";
      ensure(P);
    },
    update(P) {
      ensure(P);
    },
    frame(dt, P, results, scene, focus, calm) {
      ensure(P);
      if (!calm) clock += dt;
      // На узком экране (телефон) холст выше, чтобы подписи не налезали друг на друга.
      const cssW = canvas.clientWidth; // ширина в раскладке (без учёта увеличения)
      const narrow = cssW > 0 && cssW < 560;
      const wantH = narrow ? `${Math.round(cssW * 0.85)}px` : "";
      if (canvas.style.height !== wantH) canvas.style.height = wantH;
      const { w, h, dpr } = fitCanvas(canvas);
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0b1020");
      bg.addColorStop(1, "#070b16");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const font = (px, wt = 500) => `${wt} ${px * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
      const tv = (id) => (results[id] && Number.isFinite(results[id].value) ? results[id].value : NaN);
      const times = { cap: tv("cap"), energy: tv("energy"), heat: tv("heat"), sim: tv("sim") };
      const tMax = Math.max(0.5, ...Object.values(times).filter(Number.isFinite)) * 1.1;
      const REV = 7, HOLD = 2.5;
      const phase = clock % (REV + HOLD);
      const tc = calm ? tMax : tMax * Math.min(1, phase / REV);
      // Поле графика.
      const tankW = clamp(w * 0.17, 70 * dpr, 130 * dpr);
      const L = 40 * dpr, Rr = w - tankW - (narrow ? 14 : 24) * dpr, T = (narrow ? 96 : 84) * dpr, B = h - 56 * dpr;
      const VMIN = 2.8, VMAX = narrow ? 4.65 : 4.5;
      const X = (tm) => L + (clamp(tm, 0, tMax) / tMax) * (Rr - L);
      const Y = (v) => T + ((VMAX - clamp(v, VMIN, VMAX)) / (VMAX - VMIN)) * (B - T);
      // Опасная зона ниже 3,5 В.
      const zone = g.createLinearGradient(0, Y(CUTOFF), 0, Y(VMIN));
      zone.addColorStop(0, "rgba(255,80,80,.22)");
      zone.addColorStop(1, "rgba(255,80,80,.04)");
      g.fillStyle = zone;
      g.fillRect(L, Y(CUTOFF), Rr - L, Y(VMIN) - Y(CUTOFF));
      // Сетка по вольтам.
      g.font = font(10.5);
      g.textBaseline = "middle";
      for (const [v, lab] of [[4.2, "4,2 полная"], [3.7, "3,7 номинал"], [3.3, "3,3"], [3.0, "3,0"]]) {
        g.strokeStyle = "rgba(160,190,255,.12)";
        g.lineWidth = dpr;
        g.beginPath();
        g.moveTo(L, Y(v));
        g.lineTo(Rr, Y(v));
        g.stroke();
        g.fillStyle = "rgba(200,215,255,.55)";
        g.textAlign = "right";
        const roomy = Math.abs(Y(v) - Y(CUTOFF)) > 13 * dpr;
        if (roomy && (v !== 3.3 || Math.abs(Y(3.3) - Y(3.0)) > 13 * dpr)) g.fillText(fmt(v, 1), L - 5 * dpr, Y(v));
        if (lab.length > 3) {
          g.textAlign = "left";
          g.fillText(lab.split(" ")[1], L + 6 * dpr, Y(v) - 8 * dpr);
        }
      }
      // Линия посадки 3,5 В — светится.
      g.strokeStyle = "#ff6b6b";
      g.shadowColor = "#ff6b6b";
      g.shadowBlur = 10 * dpr;
      g.lineWidth = 2 * dpr;
      g.setLineDash([7 * dpr, 5 * dpr]);
      g.beginPath();
      g.moveTo(L, Y(CUTOFF));
      g.lineTo(Rr, Y(CUTOFF));
      g.stroke();
      g.setLineDash([]);
      g.shadowBlur = 0;
      g.fillStyle = "#ff8787";
      g.textAlign = "right";
      g.fillText("3,5", L - 5 * dpr, Y(CUTOFF));
      // Шкала времени.
      const step = [0.25, 0.5, 1, 2, 5, 10, 15, 20, 30].find((s) => tMax / s <= 7) || 60;
      g.font = font(10.5);
      g.textBaseline = "top";
      g.textAlign = "center";
      for (let m = 0; m <= tMax + 1e-9; m += step) {
        g.strokeStyle = "rgba(160,190,255,.08)";
        g.beginPath();
        g.moveTo(X(m), T);
        g.lineTo(X(m), B);
        g.stroke();
        g.fillStyle = "rgba(200,215,255,.55)";
        g.fillText(fmt(m, step < 1 ? 2 : 0), X(m), B + 4 * dpr);
      }
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillStyle = "rgba(220,230,255,.8)";
      g.font = font(11, 600);
      g.fillText("Напряжение одной банки, В", L, T - 8 * dpr);
      g.textAlign = "right";
      g.fillStyle = "rgba(200,215,255,.6)";
      g.font = font(10.5);
      g.fillText("минуты полёта →", Rr - 4 * dpr, B - 6 * dpr);
      // Кривые методов.
      const isF = (id) => id === focus;
      const stroke = (id, dash) => {
        g.strokeStyle = COL[id];
        g.lineWidth = (isF(id) ? 3.2 : 1.8) * dpr;
        g.shadowColor = COL[id];
        g.shadowBlur = (isF(id) ? 14 : 5) * dpr;
        g.globalAlpha = isF(id) ? 1 : 0.75;
        g.setLineDash(dash ? [8 * dpr, 6 * dpr] : []);
        g.stroke();
        g.setLineDash([]);
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      };
      const flat = (id, v, tEnd, dash) => {
        if (!Number.isFinite(tEnd) || !Number.isFinite(v)) return;
        g.beginPath();
        g.moveTo(X(0), Y(v));
        g.lineTo(X(Math.min(tc, tEnd)), Y(v));
        if (tc >= tEnd) g.lineTo(X(tEnd), Y(VMIN));
        stroke(id, dash);
      };
      // Книга: «бумажная» батарея держит 3,7 В, пока не израсходовано 80 %.
      flat("cap", V_NOM, times.cap, false);
      flat("energy", V_NOM, times.energy, true);
      // Энергия минус нагрев: ровная линия, но ниже на просадку I·R.
      const hr = energyMinusHeat(P.cap, P.S, P.power, P.r, P.temp);
      flat("heat", hr.vLoad, times.heat, false);
      // Численный разряд: без нагрузки (тонкий пунктир) и под нагрузкой (яркая линия).
      const tr = sim.traj;
      if (tr && tr.t.length > 1) {
        const path = (arr) => {
          g.beginPath();
          g.moveTo(X(tr.t[0]), Y(arr[0]));
          for (let i = 1; i < tr.t.length; i++) {
            if (tr.t[i] > tc) {
              g.lineTo(X(tc), Y(interp(arr, tc)));
              break;
            }
            g.lineTo(X(tr.t[i]), Y(arr[i]));
          }
        };
        path(tr.e);
        g.strokeStyle = "rgba(81,207,102,.55)";
        g.lineWidth = 1.3 * dpr;
        g.setLineDash([3 * dpr, 4 * dpr]);
        g.stroke();
        g.setLineDash([]);
        path(tr.v);
        stroke("sim", false);
        // Просадка: стрелка между «без нагрузки» и «под нагрузкой» в текущий момент.
        const tNow = Math.min(tc, sim.minutes);
        const e = interp(tr.e, tNow), v = interp(tr.v, tNow);
        if (e - v > 0.02) {
          g.strokeStyle = "rgba(255,255,255,.55)";
          g.lineWidth = dpr;
          g.beginPath();
          g.moveTo(X(tNow), Y(e));
          g.lineTo(X(tNow), Y(v));
          g.stroke();
          g.fillStyle = "rgba(255,255,255,.8)";
          g.font = font(10);
          g.textAlign = "left";
          g.textBaseline = "middle";
          const sl = `просадка ${fmt(e - v, 2)} В`;
          const fits = X(tNow) + g.measureText(sl).width + 8 * dpr < Rr;
          g.textAlign = fits ? "left" : "right";
          g.fillText(sl, X(tNow) + (fits ? 6 : -6) * dpr, (Y(e) + Y(v)) / 2);
        }
      }
      // Отметки посадки сверху графика.
      const order = ["cap", "energy", "heat", "sim"];
      const names = { cap: "ёмкость", energy: "энергия", heat: "минус нагрев", sim: "разряд" };
      g.textBaseline = "alphabetic";
      order.forEach((id, i) => {
        const tm = times[id];
        if (!Number.isFinite(tm) || tc < tm) return;
        const x = X(tm), y = T + (10 + (i % 4) * (narrow ? 11 : 12)) * dpr;
        g.fillStyle = COL[id];
        g.shadowColor = COL[id];
        g.shadowBlur = 8 * dpr;
        g.beginPath();
        g.arc(x, y - 3.5 * dpr, 3.5 * dpr, 0, TAU);
        g.fill();
        g.shadowBlur = 0;
        g.font = font(narrow ? 9.5 : 10.5, isF(id) ? 700 : 500);
        const lab = `${names[id]} ${fmt(tm, 1)} мин`;
        const right = x + g.measureText(lab).width + 10 * dpr > Rr;
        g.textAlign = right ? "right" : "left";
        g.fillText(lab, x + (right ? -7 : 7) * dpr, y);
      });
      // Подпись линии посадки — поверх кривых, на тёмной подложке.
      g.font = font(11, 600);
      g.textAlign = "left";
      g.textBaseline = "middle";
      const cutLab = "3,5 В под нагрузкой — пора садиться";
      g.fillStyle = "rgba(7,11,22,.8)";
      g.fillRect(L + 3 * dpr, Y(CUTOFF) + 4 * dpr, g.measureText(cutLab).width + 6 * dpr, 15 * dpr);
      g.fillStyle = "#ff8787";
      g.fillText(cutLab, L + 6 * dpr, Y(CUTOFF) + 11.5 * dpr);
      g.textBaseline = "alphabetic";
      // Курсор времени.
      if (!calm && tc < tMax) {
        g.strokeStyle = "rgba(255,255,255,.35)";
        g.lineWidth = dpr;
        g.beginPath();
        g.moveTo(X(tc), T);
        g.lineTo(X(tc), B);
        g.stroke();
      }
      // Дорожка с дроном.
      const gy = h - 9 * dpr;
      g.strokeStyle = "rgba(160,190,255,.25)";
      g.lineWidth = dpr;
      g.beginPath();
      g.moveTo(L, gy);
      g.lineTo(Rr, gy);
      g.stroke();
      order.forEach((id) => {
        const tm = times[id];
        if (!Number.isFinite(tm)) return;
        g.fillStyle = COL[id];
        g.globalAlpha = isF(id) ? 1 : 0.6;
        g.fillRect(X(tm) - 1 * dpr, gy - 9 * dpr, 2 * dpr, 9 * dpr);
        g.globalAlpha = 1;
      });
      const tLand = times[focus];
      const landed = Number.isFinite(tLand) && tc >= tLand;
      const dx = X(Number.isFinite(tLand) ? Math.min(tc, tLand) : tc);
      const dy = landed ? gy - 4 * dpr : gy - 19 * dpr + (calm ? 0 : Math.sin(clock * 5) * 1.5 * dpr);
      g.strokeStyle = COL[focus];
      g.fillStyle = COL[focus];
      g.shadowColor = COL[focus];
      g.shadowBlur = 10 * dpr;
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.moveTo(dx - 11 * dpr, dy);
      g.lineTo(dx + 11 * dpr, dy);
      g.stroke();
      g.fillRect(dx - 4 * dpr, dy - 3 * dpr, 8 * dpr, 6 * dpr);
      for (const sx of [-11, 11]) {
        const spin = landed || calm ? 1 : Math.abs(Math.cos(clock * 40 + sx));
        g.beginPath();
        g.ellipse(dx + sx * dpr, dy - 3 * dpr, 7 * dpr * (0.3 + 0.7 * spin), 1.6 * dpr, 0, 0, TAU);
        g.stroke();
      }
      g.shadowBlur = 0;
      // «Бак» батареи для выбранного метода.
      const bx = Rr + 16 * dpr, bw = tankW - 8 * dpr, by = T + 10 * dpr, bh = B - T - 30 * dpr;
      let frac;
      if (focus === "sim" && tr && tr.t.length) frac = interp(tr.soc, Math.min(tc, sim.minutes));
      else frac = Number.isFinite(tLand) && tLand > 0 ? 1 - RESERVE * Math.min(1, tc / tLand) : 1;
      frac = clamp(frac, 0, 1);
      const fc = frac > 0.5 ? "#51cf66" : frac > 0.25 ? "#fcc419" : "#ff6b6b";
      g.fillStyle = "rgba(160,190,255,.25)";
      g.fillRect(bx + bw * 0.35, by - 7 * dpr, bw * 0.3, 7 * dpr);
      g.strokeStyle = "rgba(200,215,255,.7)";
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.roundRect ? g.roundRect(bx, by, bw, bh, 8 * dpr) : g.rect(bx, by, bw, bh);
      g.stroke();
      g.save();
      g.beginPath();
      g.rect(bx + 3 * dpr, by + 3 * dpr, bw - 6 * dpr, bh - 6 * dpr);
      g.clip();
      const top = by + 3 * dpr + (1 - frac) * (bh - 6 * dpr);
      const fg = g.createLinearGradient(0, top, 0, by + bh);
      fg.addColorStop(0, fc);
      fg.addColorStop(1, "rgba(20,40,30,.6)");
      g.fillStyle = fg;
      g.shadowColor = fc;
      g.shadowBlur = 16 * dpr;
      g.beginPath();
      g.moveTo(bx, by + bh);
      for (let x = 0; x <= bw; x += 3 * dpr) g.lineTo(bx + x, top + (calm ? 0 : Math.sin(x / (9 * dpr) + clock * 3) * 2 * dpr));
      g.lineTo(bx + bw, by + bh);
      g.closePath();
      g.fill();
      g.restore();
      g.shadowBlur = 0;
      // Отметка «запас 20 %».
      const y20 = by + 3 * dpr + 0.8 * (bh - 6 * dpr);
      g.strokeStyle = "rgba(255,255,255,.6)";
      g.lineWidth = dpr;
      g.setLineDash([4 * dpr, 3 * dpr]);
      g.beginPath();
      g.moveTo(bx, y20);
      g.lineTo(bx + bw, y20);
      g.stroke();
      g.setLineDash([]);
      const pctPx = clamp(bw / dpr / 4.2, 12, 18);
      const pctY = by + Math.min(bh * 0.3, 14 * dpr + pctPx * dpr);
      g.textAlign = "center";
      if (y20 - pctY > (pctPx + 16) * dpr) {
        g.fillStyle = "rgba(255,255,255,.75)";
        g.font = font(9.5);
        g.textBaseline = "bottom";
        g.fillText("запас 20 %", bx + bw / 2, y20 - 2 * dpr);
      }
      g.fillStyle = "#fff";
      g.font = font(pctPx, 700);
      g.textBaseline = "middle";
      g.fillText(`${fmt(frac * 100)} %`, bx + bw / 2, pctY);
      g.font = font(10, 600);
      g.fillStyle = COL[focus];
      g.textBaseline = "top";
      g.fillText(names[focus], bx + bw / 2, by + bh + 6 * dpr);
      if (focus === "sim" && tr && tr.T.length) {
        g.fillStyle = "rgba(220,230,255,.8)";
        g.font = font(10);
        g.fillText(`батарея ${fmt(interp(tr.T, Math.min(tc, sim.minutes)))} °C`, bx + bw / 2, by + bh + 20 * dpr);
      }
      g.textBaseline = "alphabetic";
      g.fillStyle = "rgba(220,230,255,.8)";
      g.font = font(10.5, 600);
      g.fillText("заряд", bx + bw / 2, by - 12 * dpr);
    },
  };
}

export default {
  id: "flight",
  title: "Сколько продержится батарея",
  chapters: "Главы 6–7",
  accent: "#51cf66",
  lead: "Одна и та же батарея, один и тот же дрон и один стиль полёта — четыре способа посчитать, сколько минут лететь до посадки. На экране — напряжение одной банки во времени: формулы книги считают напряжение постоянным — 3,7 В на банку, а настоящая батарея проседает под нагрузкой, и на холоде линия 3,5 В «пора садиться» приходит раньше.",
  stageLabel: "Кривые напряжения банки во времени для четырёх методов, линия посадки 3,5 В, уровень заряда батареи и дрон на шкале времени",
  scenes: [
    { id: "summer", name: "Летний крейсер", desc: "6S 6000 мА·ч, 30 А — пример 1 из книги", set: { cap: 6000, S: 6, power: 666, temp: 25, r: 8 } },
    { id: "winter", name: "Зима −10 °C", desc: "та же батарея и полёт, но батарея с мороза", set: { cap: 6000, S: 6, power: 666, temp: -10, r: 8 } },
    { id: "race", name: "Гонка на максимуме", desc: "6S 1300 мА·ч 100C, газ почти всё время", set: { cap: 1300, S: 6, power: 900, temp: 25, r: 10 } },
    { id: "cargo", name: "Тяжёлый груз", desc: "6S 10 000 мА·ч, 1600 Вт (≈72 А, нагрузка 0,7 по книге); 6 мОм — для такой большой батареи это уже износ", set: { cap: 10000, S: 6, power: 1600, temp: 15, r: 6 } },
  ],
  params: [
    { id: "cap", label: "Ёмкость батареи", min: 1000, max: 12000, step: 100, value: 6000, unit: "мА·ч" },
    { id: "S", label: "Банок последовательно (S)", min: 3, max: 12, step: 1, value: 6, fmt: (v) => `${v}S · ${fmt(V_NOM * v, 1)} В` },
    { id: "power", label: "Средняя мощность полёта (стиль)", min: 100, max: 2500, step: 10, value: 666, unit: "Вт" },
    { id: "temp", label: "Температура батареи и воздуха", min: -20, max: 40, step: 1, value: 25, unit: "°C" },
    { id: "r", label: "Сопротивление банки при 25 °C (растёт с возрастом)", min: 2, max: 30, step: 0.5, value: 8, unit: "мОм", digits: 1 },
  ],
  metric: { label: "Время полёта до посадки", unit: "мин", digits: 1 },
  reference: (P) => ({
    label: "разряд с просадкой",
    value: simRun(P).value,
    note: "«Разряд с просадкой» здесь играет роль опыта: компьютер шаг за шагом разряжает батарею и сажает дрон, когда банка под нагрузкой опустилась до 3,5 В. Плюс — метод обещает больше минут, чем будет на деле.",
  }),
  methods: [
    {
      id: "cap",
      name: "По ёмкости (книга)",
      short: "t = мА·ч ÷ мА × 60 × 0,8",
      color: "#fcc419",
      eq: `<p class="mx-f">I = P ÷ (3,7 × S)</p><p class="mx-f">t = Q (мА·ч) ÷ I (мА) × 60 × 0,8</p><p><b>Ёмкость</b> (мА·ч) — сколько заряда в «баке». Делим её на <b>ток</b> (сколько заряда уходит в час) — получаем часы, × 60 — минуты. × 0,8 — батарею не высаживают до нуля, оставляем 20 % запаса. Ток берём из мощности: I = P ÷ V, где V — номинал 3,7 В на банку.</p>`,
      explain: (P, r) => {
        const b = byCapacity(P.cap, P.S, P.power);
        return `<p>I = ${fmt(P.power)} ÷ (3,7 × ${P.S}) = ${fmt(P.power)} ÷ ${fmt(V_NOM * P.S, 1)} = <b>${fmt(b.I, 1)} А</b> = ${fmt(b.I * 1000)} мА.</p><p>t = ${fmt(P.cap)} ÷ ${fmt(b.I * 1000)} × 60 = ${fmt(b.tFull, 1)} мин; × 0,8 = <b>${fmt(r.value, 1)} мин</b>.</p><p>Температура и сопротивление на ответ не влияют: формула о них не знает.</p>`;
      },
      assume: "напряжение всё время 3,7 В на банку, ток постоянный, ёмкость как на наклейке, запас 20 %",
      run: (P) => ({ value: byCapacity(P.cap, P.S, P.power).t }),
      src: ["byCapacity"],
      refs: [
        { page: 32, quote: "t = Q(мА·ч) / I(мА) × 60" },
        { page: 33, quote: "Дано: Q = 6000 мА·ч, I = 30 А = 30 000 мА. Ищем: t. Формула: t = Q / I × 60. Подстановка: 6000 / 30 000 × 60 = 12 мин. С учётом 80 %: 12 × 0,8 ≈ 9–10 мин." },
        { page: 87, quote: "4000 / 20 000 × 60 = 12 мин × 0,8 ≈ 9–10 мин." },
        { page: 32, quote: "Батарею не высаживают до нуля: реально доступно около 70–80 % ёмкости." },
        { page: 31, quote: "P = V × I, I = P / V, V = P / I." },
      ],
      review: { status: "match", tol: "оба примера книги воспроизведены точно: 6000 мА·ч при 30 А и 4000 мА·ч при 20 А → 12 мин × 0,8 = 9,6 мин (книга: «≈ 9–10 мин»)", note: "Формула и коэффициент 0,8 — как в книге. Чтобы все методы получали одно и то же, ток здесь получается из мощности через номинал 3,7 В на банку (книга, с. 31–32)." },
    },
    {
      id: "energy",
      name: "По энергии (книга)",
      short: "t = Вт·ч ÷ Вт × 60 × 0,8",
      color: "#ff922b",
      dash: true,
      eq: `<p class="mx-f">E (Вт·ч) = 3,7 × S × Q (А·ч)</p><p class="mx-f">t = E ÷ P × 60 × 0,8</p><p><b>Энергия</b> (Вт·ч) — сколько работы может сделать батарея. <b>Мощность</b> (Вт) — сколько работы в секунду забирают моторы. «100 Вт·ч при нагрузке 100 Вт = 1 час».</p>`,
      explain: (P, r) => {
        const e = byEnergy(P.cap, P.S, P.power);
        return `<p>E = 3,7 × ${P.S} × ${fmt(P.cap / 1000, 1)} = <b>${fmt(e.wh, 1)} Вт·ч</b>.</p><p>t = ${fmt(e.wh, 1)} ÷ ${fmt(P.power)} × 60 = ${fmt(e.tFull, 1)} мин; × 0,8 = <b>${fmt(r.value, 1)} мин</b>.</p><p>Ответ тот же, что «по ёмкости»: если напряжение считать равным 3,7 × S, это одна формула, просто записанная через P = V × I.</p>`;
      },
      assume: "энергия = номинал × ёмкость, вся она доходит до моторов, запас 20 %",
      run: (P) => ({ value: byEnergy(P.cap, P.S, P.power).t }),
      src: ["byEnergy"],
      refs: [
        { page: 26, quote: "Вт·ч — полная энергия = V × А·ч. 100 Вт·ч при нагрузке 100 Вт = 1 час." },
        { page: 28, quote: "Энергия: 22,2 В × 1,3 А·ч ≈ 28,9 Вт·ч." },
        { page: 86, quote: "Пример 3: 5 × 22,2 / 0,25 = 444 Вт." },
      ],
      review: { status: "match", tol: "отличие от метода «По ёмкости» меньше 10⁻¹³ мин в 244 тестах (4 сцены × 61 точка графика); пример книги 5 А·ч × 22,2 В за 15 мин → 444 Вт обращается точно: 444 Вт → 15,0 мин без запаса 0,8 (с запасом — 12,0 мин)", note: "Формула из книги. Совпадение с первым методом — не случайность: при V = 3,7 × S обе записи равны. Обе не знают ни про холод, ни про просадку." },
    },
    {
      id: "heat",
      name: "Энергия минус нагрев",
      short: "просадка I·R, ток растёт",
      color: "#cc5de8",
      eq: `<p class="mx-f">V = 3,7 − I·R,  P = S · V · I</p><p class="mx-f">t = Q ÷ I × 60 × 0,8</p><p><b>Внутреннее сопротивление</b> R — «узость трубы» внутри самой батареи. Под нагрузкой на нём теряется I·R вольт: напряжение на моторах ниже, и чтобы получить ту же мощность, ток должен быть больше. Эта часть энергии просто греет батарею. На холоде R растёт в разы.</p>`,
      explain: (P, r) => {
        const x = energyMinusHeat(P.cap, P.S, P.power, P.r, P.temp);
        if (!Number.isFinite(x.I)) return `<p>R = ${fmt(x.R * 1000, 1)} мОм: при таком сопротивлении банка не может отдать ${fmt(P.power / P.S)} Вт — полёт невозможен.</p>`;
        return `<p>R при ${fmt(P.temp)} °C = ${fmt(P.r, 1)} × ${fmt(x.R * 1000 / P.r, 2)} = <b>${fmt(x.R * 1000, 1)} мОм</b>.</p><p>Решаем R·I² − 3,7·I + ${fmt(P.power / P.S, 1)} = 0 → I = <b>${fmt(x.I, 1)} А</b> (по книге было бы ${fmt(P.power / (V_NOM * P.S), 1)} А).</p><p>Среднее напряжение под нагрузкой: 3,7 − ${fmt(x.I, 1)} А × ${fmt(x.R * 1000, 1)} мОм = <b>${fmt(x.vLoad, 2)} В</b>; на нагрев уходит ${fmt(x.heatShare * 100)} % энергии.</p><p>t = ${fmt(P.cap)} ÷ ${fmt(x.I * 1000)} × 60 × 0,8 = <b>${fmt(r.value, 1)} мин</b>.</p>${x.vLoad < CUTOFF ? `<p><b>Внимание:</b> ${fmt(x.vLoad, 2)} В ниже линии посадки 3,5 В${x.vLoad < 3 ? " и даже ниже 3,0 В, где банка портится (книга, с. 27)" : ""}. Формула этого не замечает и всё равно обещает минуты. Если бы банка правда держала столько, тревога LOW BATTERY сработала бы сразу после взлёта. На деле полная банка даёт не 3,7, а 4,2 В, и сколько получится на самом деле, показывает «Разряд с просадкой» — сравни.</p>` : ""}`;
      },
      assume: "напряжение без нагрузки всё время 3,7 В (среднее), сопротивление не меняется за полёт, батарея не нагревается, запас 20 %. Линию посадки 3,5 В формула не проверяет: на экране её ровная линия — это <i>среднее</i> напряжение под нагрузкой, а не мгновенное",
      run: (P) => {
        const x = energyMinusHeat(P.cap, P.S, P.power, P.r, P.temp);
        const note = !Number.isFinite(x.I) ? "банка не может отдать такую мощность" : `ток ${fmt(x.I, 1)} А вместо ${fmt(P.power / (V_NOM * P.S), 1)} А по книге; на нагрев ${fmt(x.heatShare * 100)} %` + (x.vLoad < CUTOFF ? `; под нагрузкой ${fmt(x.vLoad, 2)} В — ниже 3,5 В: по этой формуле тревога LOW BATTERY горела бы с самого взлёта` : "");
        return { value: x.t, note };
      },
      src: ["energyMinusHeat", "cellResistance", "cellCurrent"],
      refs: [
        { page: 26, quote: "Под нагрузкой оно проседает тем сильнее, чем больше внутреннее сопротивление, а оно растёт с возрастом, на холоде и после переразряда." },
        { page: 5, quote: "Закон Ома: ток = напряжение / сопротивление (I = U / R)" },
        { page: 31, quote: "P = V × I, I = P / V, V = P / I." },
      ],
      review: { status: "simplified", tol: "6S 6000 мА·ч, 8 мОм: при 25 °C короче книги на 2 % (200 Вт) … 42 % (2500 Вт), невозможен полёт только выше 2567 Вт — за краем ползунка; при −10 °C — на 5 % (200 Вт) … 50 % (1070 Вт), а с 1080 Вт полёт невозможен; от «Разряда с просадкой» в 4 сценах отличается на 0,0–1,9 мин", note: "Книга говорит о просадке словами и даёт закон Ома. Метод добавляет число: насколько вырастет ток. Множитель сопротивления на холоде (×1,9 при 0 °C, ×2,4 при −10 °C) — типичное значение для литиевых банок, не из книги." },
    },
    {
      id: "sim",
      name: "Разряд с просадкой",
      short: "численный разряд до 3,5 В",
      color: "#51cf66",
      eq: `<p class="mx-f">каждые доли секунды:  E = E(заряд),  R = R(температура, заряд)</p><p class="mx-f">R·I² − E·I + P/S = 0  →  I,   V = E − I·R</p><p class="mx-f">заряд −= I·Δt,   T += (S·I²·R − охлаждение)·Δt ÷ C</p><p>E — напряжение банки без нагрузки: оно падает по мере разряда, сначала медленно, в конце «ступенькой». Под нагрузкой из него вычитается просадка I·R. Дрон садится, когда V = 3,5 В. Батарея за полёт греется — сопротивление падает.</p>`,
      explain: (P, r) => {
        if (r.reason === "collapse" || r.reason === "takeoff") return `<p>На старте: R = ${fmt(r.R0 * 1000, 1)} мОм, ${r.reason === "takeoff" ? `напряжение под нагрузкой ${fmt(r.V0, 2)} В — уже ниже 3,5 В` : "банка не может отдать нужную мощность"}. Лететь нельзя: <b>0 мин</b>.</p>`;
        return `<p>Старт: без нагрузки 4,20 В, R = ${fmt(r.R0 * 1000, 1)} мОм, ток <b>${fmt(r.I0, 1)} А</b>, под нагрузкой <b>${fmt(r.V0, 2)} В</b> (просадка ${fmt(4.2 - r.V0, 2)} В).</p><p>Посадка при 3,5 В через <b>${fmt(r.value, 1)} мин</b>. В банках осталось ${fmt(r.soc * 100)} % — без нагрузки банка «отскочит» к ${fmt(ocv(r.soc), 2)} В. Батарея нагрелась до ${fmt(r.Tend)} °C.</p>`;
      },
      assume: "кривая напряжения — типичная для LiPo, сопротивление одно на всё (банка, провода, медленная химическая просадка), мощность в полёте постоянная, пики газа не учтены",
      run: (P) => simRun(P),
      src: ["simulateDischarge", "ocv", "OCV_TABLE", "cellCurrent", "cellResistance"],
      refs: [
        { page: 26, quote: "у батареи напряжение падает по мере разряда не пропорционально, а «ступенькой» в конце." },
        { page: 28, quote: "Садиться разумно при 3,5–3,6 В под нагрузкой." },
        { page: 27, quote: "После посадки, без нагрузки, напряжение банки заметно «отскакивает» вверх. Поэтому 3,5 В под нагрузкой и 3,5 В в покое — разные состояния." },
        { page: 29, quote: "На морозе внутреннее сопротивление растёт, напряжение проседает, и LOW V придёт раньше." },
        { page: 32, quote: "Под нагрузкой напряжение проседает, и LOW V придёт раньше, чем «кончится бак»." },
      ],
      review: { status: "beyond", tol: "шаг по времени в 10 раз мельче меняет ответ не больше чем на 0,017 мин (≈1 с) в 4 сценах × 61 точка графика; летом 666 Вт: 10,8 мин против 9,6 по книге (в банках остаётся 10 %), при −10 °C: 6,4 мин (остаётся 45 %)", note: "Численной модели нет в книге, но каждое её правило книга называет словами: «ступенька» в конце, просадка от сопротивления, холод, посадка при 3,5 В под нагрузкой. Модель показывает, что 0,8 — это запас на обычный летний полёт, а на морозе и при большой нагрузке его не хватает." },
    },
  ],
  chart: {
    title: "Время полёта в зависимости от средней мощности",
    x: { param: "power", min: 200, max: 2500, label: "средняя мощность полёта", unit: "Вт" },
    y: { label: "время до посадки", unit: "мин", min: 0 },
    samples: 60,
    refs: (P) => {
      const out = [];
      if (P.S === 6 && P.cap === 6000) out.push({ x: 22.2 * 30, y: 9.6 }); // с. 33: 6000 мА·ч, 30 А → 12 × 0,8
      if (P.S === 6 && P.cap === 4000) out.push({ x: 22.2 * 20, y: 9.6 }); // с. 87: 4000 мА·ч, 20 А → 12 × 0,8
      return out;
    },
  },
  hud: (P, results) => {
    const s = results.sim || {};
    const sag = Number.isFinite(s.V0) ? 4.2 - s.V0 : NaN;
    return `<span>${P.S}S · ${fmt(V_NOM * P.S, 1)} В · ${fmt((V_NOM * P.S * P.cap) / 1000)} Вт·ч</span><span>ток на старте ≈ ${fmt(s.I0, 1)} А</span><span>R банки ${fmt((s.R0 || NaN) * 1000, 1)} мОм</span><span class="${!(sag <= 0.45) ? "bad" : sag > 0.25 ? "warn" : "ok"}">просадка ${fmt(sag, 2)} В</span>`;
  },
  stage: createStage,
  try: [
    "Сцена «Летний крейсер»: книга даёт 9,6 мин, а разряд — больше. Значит, 0,8 — это запас, а не закон: в тёплый день он с избытком.",
    "Переключись на «Зима −10 °C»: книжные формулы не изменились ни на секунду, а разряд с просадкой стал короче книги. Подними температуру до 25 °C — так работает совет «держать батарею в тепле».",
    "Увеличь сопротивление банки вдвое (старая батарея) — смотри, как растёт просадка на старте и сдвигается посадка.",
    "Сцена «Гонка на максимуме»: при большой мощности на маленькой батарее просадка огромная. Попробуй найти мощность, при которой дрон садится уже на взлёте.",
    "Удвой ёмкость, не меняя мощность — время удвоится. Но в жизни дрон станет тяжелее и мощность вырастет (книга, гл. 7): подними мощность и посмотри, что останется от выигрыша.",
  ],
};

export const __test = { simulateDischarge, energyMinusHeat, byCapacity, byEnergy, ocv, cellResistance, cellCurrent };
