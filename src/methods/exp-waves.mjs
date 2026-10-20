// Эксперимент «Волна и холм» (гл. 8, 9, 13): численная волна против трёх формул.
// Сетка — в масштабе: все размеры в клетках, длина волны 6–24 клетки. Важны отношения (высота холма к λ), а не метры.
import { fmt, clamp } from "./kit.mjs";

export const NX = 260, NY = 180, SPONGE = 30, C2 = 0.25; // число Куранта 0,5 → C² = 0,25
// Земля поднята над нижней «губкой»: высоты отсчитываются от строки G0, чтобы антенны и зона Френеля не попадали в поглощающий слой.
export const G0 = SPONGE;
const XT = 46, XR = NX - 46, X0 = NX / 2; // передатчик, приёмник, препятствие (по горизонтали, клетки)

// Профиль препятствия: высота над нижним краем в клетке x.
export function obstacleHeight(shape, h, x) {
  if (shape === "ridge") return Math.abs(x - X0) < 0.5 ? h : 0;
  if (shape === "hill") return h * Math.exp(-(((x - X0) / 22) ** 2));
  if (shape === "building") return Math.abs(x - X0) <= 18 ? h : 0;
  return 0;
}

// Геометрия пути: насколько вершина препятствия выше линии прямой видимости.
export function pathGeometry(P, shape) {
  const d1 = X0 - XT, d2 = XR - X0;
  const los = P.txH + ((P.rxH - P.txH) * d1) / (d1 + d2);
  let hEff = P.h - los, e1 = d1, e2 = d2;
  if (shape === "building") {
    // У здания два ребра: берём то, что сильнее закрывает линию, и расстояния считаем до него.
    const D = d1 + d2, aL = d1 - 18, aR = d1 + 18;
    const hL = P.h - (P.txH + ((P.rxH - P.txH) * aL) / D), hR = P.h - (P.txH + ((P.rxH - P.txH) * aR) / D);
    if (hL >= hR) [hEff, e1, e2] = [hL, aL, D - aL];
    else [hEff, e1, e2] = [hR, aR, D - aR];
  }
  if (shape === "open") hEff = -Infinity;
  const r1 = Math.sqrt((P.lambda * e1 * e2) / (e1 + e2)); // радиус первой зоны Френеля над вершиной (ребром)
  return { d1: e1, d2: e2, los, hEff, r1 };
}

// Метод 1. Свободное пространство (формула Фрииса): препятствий для неё нет — добавочные потери 0 дБ.
export function freeSpaceLoss() {
  return 0;
}

// Метод 2. Правило «60 % зоны Френеля» (книга, с. 41): свободно 60 % радиуса — потерь нет;
// линия касается вершины — около 6 дБ; линия закрыта — потери быстро растут.
export function fresnelRule(hEff, r1) {
  const clearance = -hEff; // запас над вершиной, клетки
  if (clearance >= 0.6 * r1) return 0;
  if (clearance >= 0) return 6 * (1 - clearance / (0.6 * r1));
  return Math.min(30, 6 + 14 * (-clearance / r1));
}

// Метод 3. Дифракция на остром гребне, ITU-R P.526: параметр v и потери J(v).
export function knifeEdge(hEff, d1, d2, lambda) {
  if (!Number.isFinite(hEff)) return 0;
  const v = hEff * Math.sqrt((2 / lambda) * (1 / d1 + 1 / d2));
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

// Здание — два ребра подряд (метод Эпштейна — Петерсона): потери первого ребра + потери второго,
// каждое считаем как острый гребень между соседними точками пути.
export function twoEdges(P, half = 18) {
  const a = X0 - half, b = X0 + half;
  const line = (xa, ya, xb, yb, x) => ya + ((yb - ya) * (x - xa)) / (xb - xa);
  if (P.txH > P.h || P.rxH > P.h) {
    // Антенна выше крыши: «резинка» от передатчика к приёмнику касается только одного ребра.
    // Считаем его как один гребень от настоящей линии передатчик — приёмник.
    const hA = P.h - line(XT, P.txH, XR, P.rxH, a), hB = P.h - line(XT, P.txH, XR, P.rxH, b);
    return hA >= hB ? knifeEdge(hA, a - XT, XR - a, P.lambda) : knifeEdge(hB, b - XT, XR - b, P.lambda);
  }
  const h1 = P.h - line(XT, P.txH, b, P.h, a); // первое ребро: от передатчика ко второму ребру
  const h2 = P.h - line(a, P.h, XR, P.rxH, b); // второе ребро: от первого ребра к приёмнику
  return knifeEdge(h1, a - XT, b - a, P.lambda) + knifeEdge(h2, b - a, XR - b, P.lambda);
}

// Метод 4. Численная волна (FDTD): шаг волнового уравнения u_tt = c²∇²u на сетке.
// Края — «губка», которая гасит волну, чтобы она не отражалась от стенок экрана.
export function fdtdStep(u, prev, next, solid, sigma) {
  for (let j = 1; j < NY - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      if (solid[k]) {
        next[k] = 0;
        continue;
      }
      const lap = u[k - 1] + u[k + 1] + u[k - NX] + u[k + NX] - 4 * u[k];
      const s = sigma[k];
      next[k] = (2 * u[k] - (1 - s) * prev[k] + C2 * lap) / (1 + s);
    }
  }
}

// Ослабление в точке приёмника: сравниваем среднюю мощность волны с холмом и без него.
export function fdtdMeasure(sumObst, sumFree) {
  return 10 * Math.log10(sumFree / Math.max(sumObst, 1e-12));
}

// Состояние живой симуляции общее для экрана и для метода 4.
const SIM = { key: "", ready: false, value: NaN, progress: 0 };
const simKey = (P, shape) => `${shape}|${P.lambda}|${P.h}|${P.txH}|${P.rxH}`;

function makeSim(P, shape) {
  const N = NX * NY;
  const g = () => ({ u: new Float32Array(N), prev: new Float32Array(N), next: new Float32Array(N), acc: new Float32Array(N) });
  const sim = { obst: g(), free: g(), solid: new Uint8Array(N), none: new Uint8Array(N), sigma: new Float32Array(N), t: 0, P: { ...P }, shape };
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const d = Math.min(i, NX - 1 - i, j, NY - 1 - j);
      sim.sigma[k] = d < SPONGE ? 0.12 * ((SPONGE - d) / SPONGE) ** 3 : 0;
      const oh = obstacleHeight(shape, P.h, i);
      // Клетка твёрдая, если холм занимает хотя бы её половину: иначе низкие края холма
      // превращаются в сплошную «полку» вдоль земли и холм выходит выше, чем нарисован.
      if (oh >= 0.5 && NY - 1 - j < G0 + oh) sim.solid[k] = 1;
    }
  sim.tx = (NY - 1 - G0 - Math.round(P.txH)) * NX + XT;
  sim.rx = (NY - 1 - G0 - Math.round(P.rxH)) * NX + XR;
  sim.period = 2 * P.lambda; // шагов на один период при числе Куранта 0,5
  sim.warm = Math.round((XR - XT) / 0.5 + 8 * sim.period);
  sim.measure = Math.round(16 * sim.period);
  sim.sumO = 0;
  sim.sumF = 0;
  sim.rs = new Float32Array(N); // √r от передатчика — выравнивает яркость (в 2D волна слабеет как 1/√r)
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) sim.rs[j * NX + i] = Math.sqrt(Math.hypot(i - XT, j - (NY - 1 - G0 - P.txH)) + 4);
  return sim;
}
function advance(sim, steps) {
  const w = (2 * Math.PI) / sim.period, a = 1 / (2 * sim.period);
  for (let s = 0; s < steps; s++) {
    sim.t++;
    const src = Math.sin(w * sim.t) * Math.min(1, sim.t / (3 * sim.period));
    for (const [G, solid] of [[sim.obst, sim.solid], [sim.free, sim.none]]) {
      G.u[sim.tx] += src;
      fdtdStep(G.u, G.prev, G.next, solid, sim.sigma);
      const p = G.prev;
      G.prev = G.u;
      G.u = G.next;
      G.next = p;
      if (sim.t > sim.warm * 0.5) for (let k = 0; k < G.u.length; k++) G.acc[k] += (G.u[k] * G.u[k] - G.acc[k]) * a;
    }
    if (sim.t > sim.warm && sim.t <= sim.warm + sim.measure) {
      sim.sumO += sim.obst.u[sim.rx] ** 2;
      sim.sumF += sim.free.u[sim.rx] ** 2;
    }
  }
}

// Цвета: волна — лёд и огонь, карта силы — от чёрного через фиолетовый к жёлтому.
function lut(stops, n = 256) {
  const out = new Uint8ClampedArray(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return out;
}
const WAVE = lut([[102, 217, 255], [28, 126, 214], [16, 24, 48], [7, 10, 22], [16, 24, 48], [247, 103, 7], [255, 212, 59]]);
const HEAT = lut([[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]]);

export function createStage(canvas, { fitCanvas, notify }) {
  const off = document.createElement("canvas");
  off.width = NX;
  off.height = NY;
  const octx = off.getContext("2d");
  const img = octx.createImageData(NX, NY);
  let sim = null, scale = 1;
  const reset = (P, scene) => {
    sim = makeSim(P, scene.shape);
    SIM.key = simKey(P, scene.shape);
    SIM.ready = false;
    SIM.value = NaN;
    SIM.progress = 0;
    scale = 1;
  };
  return {
    reset,
    update(P, results, scene) {
      if (!sim || simKey(P, scene.shape) !== SIM.key) reset(P, scene);
    },
    frame(dt, P, results, scene, focus, calm) {
      if (!sim) reset(P, scene);
      if (!(calm && SIM.ready)) advance(sim, calm ? 24 : 10); // пониженная анимация: досчитали — картинка замирает
      if (!SIM.ready) {
        SIM.progress = clamp(sim.t / (sim.warm + sim.measure), 0, 1);
        if (sim.t > sim.warm + sim.measure) {
          SIM.ready = true;
          SIM.value = fdtdMeasure(sim.sumO, sim.sumF);
          notify();
        }
      }
      // Пиксели поля.
      const d = img.data, heat = P.view === 1;
      let peak = 0;
      for (let k = 0; k < NX * NY; k++) {
        const a = Math.abs(sim.obst.u[k] * sim.rs[k]);
        if (a > peak && !sim.sigma[k]) peak = a;
      }
      scale += ((peak || 1) - scale) * (calm ? 1 : 0.05);
      for (let k = 0, p = 0; k < NX * NY; k++, p += 4) {
        let idx;
        if (heat) {
          const rel = 10 * Math.log10((sim.obst.acc[k] + 1e-9) / (sim.free.acc[k] + 1e-9)); // дБ относительно свободного пространства
          idx = Math.round(clamp((rel + 30) / 36, 0, 1) * 255);
          d[p] = HEAT[idx * 3];
          d[p + 1] = HEAT[idx * 3 + 1];
          d[p + 2] = HEAT[idx * 3 + 2];
        } else {
          const t = clamp((sim.obst.u[k] * sim.rs[k]) / (scale * 0.8), -1, 1);
          idx = Math.round((t * 0.5 + 0.5) * 255);
          d[p] = WAVE[idx * 3];
          d[p + 1] = WAVE[idx * 3 + 1];
          d[p + 2] = WAVE[idx * 3 + 2];
        }
        d[p + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      const { w, h, dpr } = fitCanvas(canvas);
      const g = canvas.getContext("2d");
      // Губку по краям не показываем: обрезаем видимую область.
      const vx = SPONGE - 4, vy = SPONGE - 4, vw = NX - 2 * vx, vh = NY - 1 - (G0 - 8) - vy;
      g.imageSmoothingEnabled = true;
      g.drawImage(off, vx, vy, vw, vh, 0, 0, w, h);
      const X = (x) => ((x - vx) / vw) * w, Y = (yUp) => ((NY - 1 - G0 - yUp - vy) / vh) * h;
      // Под землёй — тёмный грунт (там поглощающий слой, волну не показываем).
      g.fillStyle = "#0b0f18";
      g.fillRect(0, Y(0), w, h - Y(0));
      // Препятствие: тёмная земля с сияющим краем.
      g.beginPath();
      g.moveTo(0, h);
      for (let x = vx; x <= vx + vw; x += 0.5) g.lineTo(X(x), Y(obstacleHeight(scene.shape, P.h, x)));
      g.lineTo(w, h);
      g.closePath();
      const grd = g.createLinearGradient(0, Y(P.h), 0, h);
      grd.addColorStop(0, "#1b2433");
      grd.addColorStop(1, "#0b0f18");
      g.fillStyle = grd;
      g.fill();
      g.strokeStyle = "rgba(160,220,255,.85)";
      g.lineWidth = 1.5 * dpr;
      g.shadowColor = "#4dabf7";
      g.shadowBlur = 8 * dpr;
      g.stroke();
      g.shadowBlur = 0;
      // Земля — нижний край, от него растут препятствия.
      g.strokeStyle = "rgba(160,220,255,.35)";
      g.lineWidth = dpr;
      g.beginPath();
      g.moveTo(0, Y(0));
      g.lineTo(w, Y(0));
      g.stroke();
      if (P.view === 1) {
        // Шкала карты потерь.
        const lw = 160 * dpr, lh = 8 * dpr, lx = w - lw - 14 * dpr, ly = h - 26 * dpr;
        for (let i = 0; i < lw; i++) {
          const idx = Math.round((i / lw) * 255);
          g.fillStyle = `rgb(${HEAT[idx * 3]},${HEAT[idx * 3 + 1]},${HEAT[idx * 3 + 2]})`;
          g.fillRect(lx + i, ly, 1, lh);
        }
        g.fillStyle = "rgba(255,255,255,.85)";
        g.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
        g.textAlign = "left";
        g.fillText("−30 дБ", lx, ly - 4 * dpr);
        g.textAlign = "right";
        g.fillText("+6 дБ к свободному", lx + lw, ly - 4 * dpr);
      }
      // Линия прямой видимости и первая зона Френеля.
      const geo = pathGeometry(P, scene.shape);
      g.fillStyle = "rgba(255,255,255,.06)";
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.setLineDash([4 * dpr, 5 * dpr]);
      g.lineWidth = dpr;
      g.beginPath();
      const D = XR - XT;
      const pts = [];
      for (let x = XT; x <= XR; x += 2) {
        const d1 = x - XT, d2 = XR - x, yl = P.txH + ((P.rxH - P.txH) * d1) / D, r = Math.sqrt((P.lambda * d1 * d2) / D);
        pts.push([x, yl, r]);
      }
      pts.forEach(([x, yl, r], i) => (i ? g.lineTo(X(x), Y(yl + r)) : g.moveTo(X(x), Y(yl + r))));
      [...pts].reverse().forEach(([x, yl, r]) => g.lineTo(X(x), Y(yl - r)));
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(X(XT), Y(P.txH));
      g.lineTo(X(XR), Y(P.rxH));
      g.stroke();
      g.setLineDash([]);
      // Передатчик и приёмник.
      const dot = (x, y, col, label) => {
        g.fillStyle = col;
        g.shadowColor = col;
        g.shadowBlur = 14 * dpr;
        g.beginPath();
        g.arc(X(x), Y(y), 5 * dpr, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "rgba(255,255,255,.9)";
        g.font = `600 ${11 * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
        g.textAlign = "center";
        g.fillText(label, X(x), Y(y) - 10 * dpr);
      };
      dot(XT, P.txH, "#ffd43b", "передатчик");
      dot(XR, P.rxH, SIM.ready ? (SIM.value > 10 ? "#ff6b6b" : SIM.value > 3 ? "#fcc419" : "#51cf66") : "#adb5bd", "приёмник");
    },
  };
}

// Отдаём живой результат численной волны методу 4.
function fdtdResult(P, scene) {
  if (SIM.key !== simKey(P, scene.shape) || !SIM.ready) return { value: NaN, note: "считаю волну… (ход счёта — на экране)" };
  return { value: SIM.value, note: "измерено в точке приёмника" };
}

export default {
  id: "waves",
  title: "Волна и холм",
  chapters: "Главы 8, 9, 13",
  accent: "#4dabf7",
  lead: "Слева передатчик, справа приёмник, посередине препятствие. На экране настоящая волна: компьютер решает волновое уравнение шаг за шагом. Сравни, что предсказывают формулы, с тем, что получилось у «настоящей» волны.",
  stageLabel: "Численная волна: передатчик, препятствие, приёмник, зона Френеля",
  scenes: [
    { id: "ridge", name: "Острый гребень", desc: "тонкая стена — идеальный случай для формулы ITU", shape: "ridge", set: { h: 65, lambda: 12, txH: 50, rxH: 50 } },
    { id: "hill", name: "Круглый холм", desc: "пологая вершина: потери больше, чем у гребня", shape: "hill", set: { h: 65, lambda: 12, txH: 50, rxH: 50 } },
    { id: "building", name: "Здание", desc: "плоская крыша, два ребра: формула одного гребня здесь ошибается", shape: "building", set: { h: 60, lambda: 12, txH: 50, rxH: 50 } },
    { id: "open", name: "Открытое поле", desc: "ничего не мешает: все методы согласны", shape: "open", set: { h: 0, lambda: 12, txH: 50, rxH: 50 } },
  ],
  params: [
    { id: "lambda", label: "Длина волны λ (больше — ниже частота)", min: 6, max: 16, step: 1, value: 12, unit: "клеток" },
    { id: "h", label: "Высота препятствия", min: 0, max: 95, step: 1, value: 65, unit: "клеток" },
    { id: "txH", label: "Высота антенны передатчика", min: 30, max: 100, step: 1, value: 50, unit: "клеток" },
    { id: "rxH", label: "Высота антенны приёмника", min: 30, max: 100, step: 1, value: 50, unit: "клеток" },
    { id: "view", label: "Что показать на экране", options: [[0, "Бегущая волна"], [1, "Карта потерь («мёртвая зона»)"]], value: 0, display: true },
  ],
  metric: { label: "Ослабление из-за препятствия", unit: "дБ", digits: 1 },
  reference: (P, scene) => {
    const r = fdtdResult(P, scene);
    return { label: "численная волна", value: r.value, note: "Численная волна здесь играет роль эксперимента: формулы сравниваются с ней. 3 дБ — половина мощности, 10 дБ — в 10 раз меньше, 20 дБ — в 100 раз." };
  },
  methods: [
    {
      id: "friis",
      name: "Свободное пространство",
      short: "Фриис: препятствий нет",
      eq: `<p class="mx-f">L = 20·lg(4π·d / λ)</p><p>Формула Фрииса считает, как сигнал слабеет с расстоянием, если вокруг пусто. Добавочных потерь от холма в ней нет — <b>0 дБ</b>.</p>`,
      explain: () => `<p>Ослабление из-за препятствия = <b>0 дБ</b>, какой бы высоты ни был холм. Это граница метода, а не ошибка: книга честно говорит «в свободном пространстве».</p>`,
      assume: "вокруг пусто, земли и препятствий нет",
      run: () => ({ value: freeSpaceLoss() }),
      src: ["freeSpaceLoss"],
      refs: [{ page: 7, quote: "+6 дБ ≈ ×2 дальности в свободном пространстве (×4 мощности)." }, { page: 40, quote: "В свободном пространстве сигнал слабеет как квадрат расстояния: вдвое дальше — вчетверо слабее, как свет фонарика." }],
      review: { status: "match", tol: "точно: 0 дБ по определению", note: "Формулу Фрииса книга не пишет — даёт её следствие: «+6 дБ ≈ ×2 дальности в свободном пространстве». Про холм книга (с. 41) говорит: «холм залез в зону — сигнал слабеет» — это показывают остальные методы, а Фриис препятствий не видит." },
    },
    {
      id: "fresnel",
      name: "Правило 60 % Френеля",
      short: "книга, с. 41: «толстое облако»",
      eq: `<p class="mx-f">r₁ = √(λ·d₁·d₂ / (d₁ + d₂))</p><p>Если над вершиной свободно 60 % радиуса r₁ — потерь нет. Линия касается вершины — около 6 дБ. Вершина выше линии — потери быстро растут.</p>`,
      explain: (P, r, scene) => {
        const g = pathGeometry(P, scene.shape);
        const c = -g.hEff;
        const txt = !Number.isFinite(c) ? "Препятствия нет" : c >= 0 ? `Над вершиной свободно ${fmt(c, 1)} клеток (${fmt((c / g.r1) * 100)} % от r₁)` : `Вершина выше линии на ${fmt(-c, 1)} клеток (${fmt((-c / g.r1) * 100)} % от r₁)`;
        return `<p>r₁ = √(${P.lambda} × ${fmt(g.d1)} × ${fmt(g.d2)} / ${fmt(g.d1 + g.d2)}) = <b>${fmt(g.r1, 1)}</b> клеток. ${txt}. Потери ≈ <b>${fmt(r.value, 1)} дБ</b>.</p>`;
      },
      assume: "грубое правило: вместо точной формулы — три ступеньки",
      run: (P, scene) => {
        const g = pathGeometry(P, scene.shape);
        return { value: Number.isFinite(g.hEff) ? fresnelRule(g.hEff, g.r1) : 0 };
      },
      src: ["pathGeometry", "fresnelRule"],
      refs: [
        { page: 41, quote: "Сигнал идёт не по линии, а «толстым облаком» — зоной Френеля" },
        { page: 41, quote: "Ниже частота и длиннее путь — толще зона." },
        { page: 41, quote: "холм залез в зону — сигнал слабеет, хотя дрон «видно»" },
        { page: 53, quote: "Поднятая повыше антенна может улучшить связь (меньше препятствий в зоне Френеля)" },
      ],
      review: { status: "simplified", tol: "гребень и холм: до 6 дБ от численной волны (27 тестов); здание: занижает потери до 16 дБ — правило не знает про второе ребро", note: "Книга объясняет зону Френеля словами, без чисел. Пороги 60 % и 6 дБ при касании взяты из радиотехнической практики, а наклон 14 дБ на радиус зоны в тени — наша грубая подгонка под формулу дифракции. Правило верно показывает направление, но в тени даёт грубую оценку." },
    },
    {
      id: "knife",
      name: "Дифракция на гребне",
      short: "ITU-R P.526: точная формула для тонкой стены",
      eq: `<p class="mx-f">v = h·√(2/λ · (1/d₁ + 1/d₂))</p><p class="mx-f">J(v) = 6,9 + 20·lg(√((v − 0,1)² + 1) + v − 0,1)</p><p>h — насколько вершина выше линии прямой видимости. Чем больше v, тем глубже приёмник в тени.</p>`,
      explain: (P, r, scene) => {
        const g = pathGeometry(P, scene.shape);
        if (!Number.isFinite(g.hEff)) return "<p>Препятствия нет — потерь нет.</p>";
        if (scene.shape === "building") return `<p>У здания два ребра. Метод Эпштейна — Петерсона считает их по очереди как два острых гребня и складывает потери: всего <b>${fmt(r.value, 1)} дБ</b>. Одно ребро дало бы только ${fmt(knifeEdge(g.hEff, g.d1, g.d2, P.lambda), 1)} дБ.</p><p>Сравни с численной волной: глубоко в тени за плоской крышей она теряет ещё больше.</p>`;
        const v = g.hEff * Math.sqrt((2 / P.lambda) * (1 / g.d1 + 1 / g.d2));
        return `<p>h = ${fmt(g.hEff, 1)} клеток → v = ${fmt(g.hEff, 1)} × √(2/${P.lambda} × (1/${fmt(g.d1)} + 1/${fmt(g.d2)})) = <b>${fmt(v, 2)}</b> → J = <b>${fmt(r.value, 1)} дБ</b>.</p>${g.hEff > 0 ? "<p>Сделай λ больше (частоту ниже) — v уменьшится: длинная волна легче огибает холм.</p>" : g.hEff < 0 ? "<p>Линия видимости проходит выше вершины, поэтому v меньше нуля. Здесь длинная волна, наоборот, мешает: зона Френеля толще, v ближе к нулю — потери не падают, а растут (пока v ≤ −0,78, потерь нет совсем).</p>" : "<p>Линия касается вершины: v = 0 при любой λ, потери около 6 дБ.</p>"}`;
      },
      assume: "препятствие — бесконечно тонкий острый гребень (для здания — два гребня подряд); у круглого холма потери на деле больше",
      run: (P, scene) => {
        const g = pathGeometry(P, scene.shape);
        return { value: scene.shape === "building" ? twoEdges(P) : knifeEdge(g.hEff, g.d1, g.d2, P.lambda), note: scene.shape === "building" ? (P.txH > P.h || P.rxH > P.h ? "здание: антенна выше крыши — работает одно ребро" : "здание: два ребра подряд") : undefined };
      },
      src: ["knifeEdge", "twoEdges"],
      refs: [{ page: 36, quote: "Низкие частоты лучше огибают холмы и проходят сквозь листву: длинной волне мелкие препятствия меньше мешают." }],
      review: { status: "beyond", tol: "острый гребень: до 0,9 дБ от численной волны при потерях до 15 дБ, до 3,6 дБ в глубокой тени; круглый холм: формула занижает потери на 1,6–10,3 дБ; здание (два ребра, Эпштейн — Петерсон): у касания совпадает (±0,3 дБ), глубже в тени занижает на 2,4–12,4 дБ; если одна антенна выше крыши, работает одно ребро, и крыша ниже линии даёт 0 дБ, как у численной волны (±4 дБ)", note: "Формулы нет в книге — это стандарт МСЭ (ITU-R P.526). Она количественно подтверждает слова книги: ниже частота — меньше потери за холмом." },
    },
    {
      id: "fdtd",
      name: "Численная волна",
      short: "FDTD: решаем волновое уравнение",
      eq: `<p class="mx-f">∂²u/∂t² = c²·(∂²u/∂x² + ∂²u/∂y²)</p><p>На сетке: новое значение в клетке = 2·текущее − прошлое + 0,25·(сумма четырёх соседей − 4·текущее). Внутри холма волна равна нулю. Потери = средняя мощность без холма ÷ с холмом, в децибелах.</p>`,
      explain: (P, r) => (!Number.isFinite(r.value) ? `<p>Волна ещё не установилась: ${esc2(r.note)}.</p>` : fmt(10 ** (Math.abs(r.value) / 10), 1) === "1,0" ? `<p>Препятствие почти не мешает: мощность в точке приёмника почти такая же, как без него (${fmt(r.value, 1)} дБ).</p>` : r.value < 0 ? `<p>С препятствием сигнал даже в ${fmt(10 ** (-r.value / 10), 1)} раза сильнее, чем без него: край препятствия даёт добавочную волну, и она сложилась с прямой «гребень к гребню».</p>` : `<p>Средняя мощность волны в точке приёмника с препятствием в ${fmt(10 ** (r.value / 10), 1)} раза меньше, чем без него: <b>${fmt(r.value, 1)} дБ</b>.</p>`),
      assume: "двумерная модель; земля не отражает (под ней — поглощающий слой); антенны не ниже 30 клеток над землёй; края экрана гасят волну",
      run: fdtdResult,
      sweep: () => ({ value: NaN }),
      live: true,
      src: ["fdtdStep", "fdtdMeasure"],
      refs: [{ page: 36, quote: "Отсюда мёртвая зона — радиотень за препятствием, куда сигнал не доходит." }],
      review: { status: "beyond", tol: "острый гребень, 9 тестов (λ 8–16 клеток): при потерях до 15 дБ — не больше 0,9 дБ от ITU-R P.526; в глубокой тени (18–20 дБ) численная волна даёт на 3–3,6 дБ больше. Высота антенн 30–50 клеток меняет результат на 0,8 дБ", note: "Метода нет в книге: это «эксперимент в компьютере». Он показывает то, чего не видно в формулах: светлые полосы на краю тени и то, что круглый холм глушит сильнее острого гребня." },
    },
  ],
  chart: {
    title: "Потери за препятствием в зависимости от его высоты",
    x: { param: "h", min: 0, max: 95, label: "высота препятствия", unit: "клеток" },
    y: { label: "ослабление", unit: "дБ", min: -3, max: 30 },
    samples: 70,
  },
  hud: (P, results, scene) => {
    const g = pathGeometry(P, scene.shape);
    const v = Number.isFinite(g.hEff) ? g.hEff * Math.sqrt((2 / P.lambda) * (1 / g.d1 + 1 / g.d2)) : NaN;
    return `<span>λ = ${P.lambda} кл.</span><span>r₁ = ${fmt(g.r1, 1)} кл.</span><span>v = ${Number.isFinite(v) ? fmt(v, 2) : "—"}</span><span class="${SIM.ready ? "ok" : ""}">${SIM.ready ? `волна: ${fmt(SIM.value, 1)} дБ` : `считаю ${Math.round(SIM.progress * 100)} %`}</span>`;
  },
  stage: createStage,
  try: [
    "Сцена «Острый гребень»: сравни «Дифракцию на гребне» и «Численную волну» — они должны почти совпасть.",
    "Увеличь длину волны (ниже частота) — потери за холмом падают. Это и есть «длинная волна лучше огибает».",
    "Переключи экран на карту потерь: за холмом тёмная «мёртвая зона», а на её краю — светлые полосы.",
    "Сцена «Круглый холм»: численная волна теряет больше, чем обещает формула для острого гребня.",
    "Подними антенны выше — зона Френеля освобождается, и все методы сходятся к нулю.",
    "Сцена «Здание»: у плоской крыши два ребра. Формула двух рёбер точна, пока линия едва касается крыши, а глубже в тени численная волна теряет ещё больше.",
  ],
};
function esc2(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}
export const __test = { makeSim, advance };
