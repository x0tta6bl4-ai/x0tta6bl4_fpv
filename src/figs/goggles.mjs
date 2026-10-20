// Fig: видеотракт. Дрон с камерой и видеопередатчиком на каретке, приёмная станция с двумя антеннами,
// два монитора сзади (аналог и цифра), настольная лампа — освещение, флажки на рельсе — где начинается «снег»
// и где край цифры. Зритель смотрит с +x: экраны мониторов обращены к нему.
import { k, G, scene, basePlate, labelPlate, motor, propSvg, fmt, clamp, labelsAt, ellipseOnTop } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -104, y: -142, w: 200, d: 262, r: 8 };
const RAIL_X = 30, Y0 = 70, Y1 = -128; // ход каретки: от станции (y0) вдаль (y1)
const D_MIN = 0.05, D_MAX = 4;
const ST = { x: 14, y: 84, w: 32, d: 22 }; // приёмная станция
const MONS = [
  { id: "a", y: 6, title: "АНАЛОГ" },
  { id: "d", y: -64, title: "ЦИФРА" },
];
const MW = 60, MZ0 = 28, MH = 52; // ширина, низ и высота панели монитора
const SW = MW - 8, SH = MH - 8; // экран
const LAMP = [-66, -116];
const FRIEND = [64, 80];

export const POWERS = [[25, "25 мВт"], [200, "200"], [400, "400"], [800, "800"], [1600, "1,6 Вт"]];
export const LIGHT = [["day", "день"], ["dusk", "сумерки (0,05 лк)"], ["night", "ночь без луны"]];
const LUX = { day: 10000, dusk: 0.05, night: 0.002 };
export const CAMS = [[0.1, "камера 0,1 лк"], [0.001, "камера 0,001 лк"]];

// Модель (учебная): ×4 мощности ≈ ×2 расстояния; 400 мВт ≈ 1,2 км до края цифры.
export function videoModel(s) {
  const range = s.pit ? 0.03 : 1.2 * Math.sqrt(Number(s.p) / 400);
  const q = s.d / range;
  const bright = clamp(Math.log10(LUX[s.light] / Number(s.cam)) / 2, 0, 1);
  const hissA = clamp((q - 0.55) / 0.85, 0, 1);
  const digOk = s.smooth ? q < 1.5 : q < 1.0;
  const blocks = s.smooth ? clamp((q - 0.8) / 0.7, 0, 1) : 0;
  return { range, q, bright, hissA, digOk, blocks };
}
const yOf = (d) => Y0 + (Y1 - Y0) * (Math.log(clamp(d, D_MIN, D_MAX) / D_MIN) / Math.log(D_MAX / D_MIN));
const km = (v) => (v < 1 ? fmt(v, 2) : fmt(v, 1));

export const meta = {
  id: "goggles",
  title: "Видеотракт",
  hint: "Расстояние — ползунок или ← →",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Флажки на рельсе: жёлтый — здесь аналог начинает «снежить», красный — край цифры" },
    { mark: "raised", label: "Дрон с камерой и видеопередатчиком, приёмная станция, два монитора, лампа" },
    { mark: "edge", label: "Кольца у второго передатчика — друг на твоём канале" },
  ],
  caption: "Камера снимает, видеопередатчик (VTX) шлёт картинку, станция принимает её и показывает на мониторах: слева аналог, справа цифра. Чем дальше дрон, тем слабее сигнал. Аналог портится постепенно — растёт «снег». Многие цифровые системы держат чёткую картинку до самого края, а потом замирают; HDZero деградирует плавно. Аналоговый канал открытый: чужой передатчик на той же частоте лезет в картинку. Камера видит в темноте, только если света больше её порога в люксах. Дальности учебные: ×4 мощности ≈ ×2 расстояния.",
  aria: "Ползунок «Расстояние» двигает каретку с дроном по рельсу; мощность передатчика двигает флажки края; освещение меняет лампу; камера меняет объектив; «друг на канале» включает второй передатчик.",
  missions: [
    {
      id: "hiss", look: ["rail", "mons"], touch: ["d"], see: "оба монитора и жёлтый флажок на рельсе",
      text: "Отлети так, чтобы аналог «снежил», а цифра была ещё чёткой",
      check: (f) => f.hissA > 0.25 && f.digOk && f.blocks < 0.2, // при 400 мВт — от ~0,95 до 1,15 км
      predict: { q: "Дрон улетает всё дальше. Как портятся картинки?", options: ["Обе одинаково покрываются «снегом»", "Аналог постепенно «снежит», цифра чёткая почти до края", "Цифра портится раньше аналога"], right: 1 },
      setup: { d: 0.3 },
    },
    {
      id: "freeze", look: ["rail", "mons"], touch: ["d"], see: "правый монитор у красного флажка",
      text: "Найди расстояние, где цифра замирает, а в аналоге ещё что-то видно",
      check: (f, s) => !f.digOk && f.hissA < 0.92 && !s.smooth,
      predict: { q: "Цифра на краю дальности. Что увидишь в очках?", options: ["«Снег», как в аналоге", "Картинка замрёт, потом «сигнал потерян»", "Чёрно-белую картинку"], right: 1 },
      confirm: { q: "Где на краю дальности ещё можно что-то разглядеть?", options: ["В аналоге — сквозь «снег»", "В цифре — она же чётче", "Нигде"], right: 0, miss: "Сравни мониторы за красным флажком: цифра стоит, а аналог ещё показывает ворота сквозь шум." },
      setup: { d: 0.9 },
    },
    {
      id: "dusk", look: ["lamp", "cam"], touch: ["cam"], see: "лампу, объектив камеры и яркость картинки",
      text: "Наступили поздние сумерки: подбери камеру, которая видит",
      check: (f, s) => s.light === "dusk" && f.bright > 0.5,
      predict: { q: "Сумерки, 0,05 лк. Камера с порогом 0,1 лк увидит?", options: ["Да, сумерки — это ещё не ночь", "Нет: света меньше её порога — нужна камера чувствительнее (0,001 лк)", "Да, если поднять мощность передатчика"], right: 1 },
      setup: { d: 0.3, light: "dusk" },
    },
    {
      id: "friend", look: ["friend", "mons"], touch: ["friend"], see: "левый монитор и кольца у второго передатчика",
      text: "Друг включил передатчик на твоём канале. Что стало с аналогом?",
      check: (f, s) => s.friend && f.hissA < 0.9,
      predict: { q: "Друг включил аналоговый передатчик на твоём канале. Что в очках?", options: ["Ничего: мой сигнал сильнее", "Чужая картинка и полосы поверх моей", "Картинка станет чёрно-белой"], right: 1 },
      confirm: { q: "Как этого избежать?", options: ["Договориться о каналах до взлёта", "Поднять мощность до 1,6 Вт", "Включить PIT Mode"], right: 0, miss: "Аналоговый канал открытый: любой передатчик на той же частоте попадает в картинку. Мощность не спасает — нужен свой канал." },
      setup: { d: 0.3 },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [-96, MONS[0].y + MW, MZ0 + MH + 2], [-96, MONS[1].y, MZ0 + MH + 2], [LAMP[0], LAMP[1], 80]], W, H, { pad: 18, azimuth: 36 });
}

const flagSvg = (P, x, y, cls) => {
  const pts = [[x, y, 26], [x, y - 10, 22], [x, y, 18]].map((p) => k.iso(p, P));
  return `<path class="iso-line" data-tone="mid" d="${k.segment([x, y, 0], [x, y, 26], P)}"/><path class="${cls}" d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/>`;
};

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const m = videoModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 60, y: PLATE.y + 10, w: 26, d: 40, r: 1.5 });

  // ── Рельс вдоль y со шкалой километров ──
  S.group = "rail";
  for (const dx of [-7, 7]) S.box({ x: RAIL_X + dx - 1.8, y: Y1 - 14, w: 3.6, d: Y0 - Y1 + 26, r: 0.8 }, 0, 2.6, { tone: "mid" }, { steps: 2, bevel: 0.3, layer: 0.4 });
  for (const y of [Y1 - 19, Y0 + 12]) S.box({ x: RAIL_X - 12, y, w: 24, d: 5, r: 1 }, 0, 7, { tone: "mid" }, { bevel: 0.4, layer: 0.45 });
  const sx = RAIL_X + 13;
  S.box({ x: sx, y: Y1 - 6, w: 9, d: Y0 - Y1 + 12, r: 1 }, 0, 0.6, { tone: "lo", crease: "none" }, { layer: 0.3, steps: 2 });
  let ticks = "", major = "", nums = "";
  for (const v of [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 4]) {
    const y = yOf(v), big = [0.1, 0.5, 1, 2, 4].includes(v);
    (big ? (major += k.lineOnTop([sx, y], [sx + 4.4, y], 0.6, P)) : (ticks += k.lineOnTop([sx, y], [sx + 2.6, y], 0.6, P)));
    if (big) nums += `<g transform="${k.topMatrix([sx + 5, y + 2], 0.6, P, "y")}"><text x="0" y="3.6" class="gg-num">${String(v).replace(".", ",")}${v === 4 ? " км" : ""}</text></g>`;
  }
  S.raw([sx + 4, (Y0 + Y1) / 2, 0.7], k.lineSvg(ticks, { tone: "lo" }) + k.lineSvg(major, { tone: "mid" }) + nums, { layer: 0.35 });
  // Флажки: где аналог начинает «снежить» и где край цифры.
  const fl = [];
  if (!state.pit) {
    const ySnow = yOf(m.range * 0.55), yEdge = yOf(m.range * (state.smooth ? 1.5 : 1));
    if (m.range * 0.55 <= D_MAX) fl.push(flagSvg(P, RAIL_X - 12, ySnow, "gg-flag warn"));
    if (m.range * (state.smooth ? 1.5 : 1) <= D_MAX) fl.push(flagSvg(P, RAIL_X - 12, yEdge, "gg-flag bad"));
  }
  S.raw([RAIL_X - 12, 0, 10], fl.join(""), { layer: 0.6 });

  // ── Приёмная станция: коробка, патч-антенна, «гриб», кабель к мониторам ──
  S.group = "station";
  S.box({ ...ST, r: 2.4 }, 0, 12, { tone: "mid", inner: k.lineSvg(k.sideSeam(ST, 4, P, 3), { tone: "faint" }) }, { bevel: 0.5 });
  S.cyl(ST.x + 8, ST.y + 6, 1, 12, 14, { tone: "mid", crease: "none" });
  S.box({ x: ST.x + 3, y: ST.y + 1, w: 10, d: 10, r: 1 }, 26, 2, { tone: "hi" }, { bevel: 0.3 });
  S.cyl(ST.x + 24, ST.y + 15, 1.4, 12, 3, { tone: "mid" });
  S.tube([[ST.x + 24, ST.y + 15, 15], [ST.x + 24, ST.y + 15, 34]], 0.8, { tone: "hi" });
  S.solid(G.sphereOf([ST.x + 24, ST.y + 15, 36], 3.2, P), { tone: "hi" }, [ST.x + 24, ST.y + 15, 36]);
  S.tube([[ST.x, ST.y + 11, 3], [ST.x - 10, ST.y + 11, 1.2], [-84, 40, 1.2], [-84, MONS[0].y + MW / 2, 1.2], [-88, MONS[0].y + MW / 2, 4]], 0.9, { tone: "mid", bendR: 8, maxLength: 14 });

  // ── Мониторы: аналог (слева) и цифра (справа), экраны смотрят на зрителя ──
  S.group = "mons";
  for (const mo of MONS) {
    const cy = mo.y + MW / 2;
    S.box({ x: -96, y: cy - 14, w: 20, d: 28, r: 2.4 }, 0, 4, { tone: "mid" }, { bevel: 0.4 });
    S.cyl(-90, cy, 2.4, 4, MZ0 - 4, { tone: "mid", crease: "none" });
    const pan = { x: -96, y: mo.y, w: 4, d: MW, r: 2 };
    S.box(pan, MZ0, MH, { tone: "mid", inner: k.lineSvg(k.sideSeam(pan, MZ0 + 4, P, 3), { tone: "faint" }) }, { bevel: 0.5, ref: [-92, cy, MZ0 + MH / 2] });
    const face = k.sideMatrix([-92, mo.y + MW - 4], MZ0 + MH - 4, P, "right");
    S.raw([-91.6, cy, MZ0 + MH / 2], `<g transform="${face}"><rect x="0" y="0" width="${SW}" height="${SH}" rx="1.4" class="osd-screen"/><text x="2" y="5.2" class="gg-title">${mo.title}</text><svg x="1" y="7" width="${SW - 2}" height="${SH - 8}" viewBox="0 0 166 124" preserveAspectRatio="none"><g data-part="scr-${mo.id}"></g></svg></g>`, { bias: 5 });
  }

  // ── Лампа: основание, колено, абажур; свет — пятно на плите ──
  S.group = "lamp";
  const [lx, ly] = LAMP;
  S.cyl(lx, ly, 10, 0, 3, { tone: "mid" });
  const head = [lx + 44, ly + 4, 66];
  S.tube([[lx, ly, 3], [lx, ly, 64], [lx + 40, ly + 4, 74]], 1.4, { tone: "mid", bendR: 6, maxLength: 14 });
  S.cyl(head[0], head[1], 6.4, head[2] - 2, 7, { tone: "mid" });
  const on = state.light === "day" ? "hi" : state.light === "dusk" ? "mid" : "lo";
  S.solid(G.sphereOf([head[0], head[1], head[2] - 3], 3.4, P), { tone: on, lit: state.light === "day" }, [head[0], head[1], head[2] - 3.5], { bias: -1 });
  if (state.light !== "night") S.raw(-5e8, `<path class="gg-pool${state.light === "dusk" ? " dim" : ""}" d="${ellipseOnTop(head[0] + 30, head[1] + 40, 64, 64, 0, P)}"/>`, { layer: 0.2 });

  // ── Второй передатчик («друг на канале») ──
  S.group = "friend";
  const [fx, fy] = FRIEND;
  S.box({ x: fx - 9, y: fy - 7, w: 18, d: 14, r: 2 }, 0, 8, { tone: "mid" }, { bevel: 0.4 });
  S.tube([[fx + 4, fy + 3, 8], [fx + 4, fy + 3, 28]], 0.8, { tone: "hi" });
  S.solid(G.sphereOf([fx + 4, fy + 3, 29.6], 2.6, P), { tone: state.friend ? "hi" : "mid", lit: !!state.friend }, [fx + 4, fy + 3, 29.6]);
  S.raw([fx, fy, 1], `<g data-part="rings"></g>`, { layer: 0.6 });

  // ── Дрон на каретке: смотрит камерой на зрителя ──
  S.group = "drone";
  const dy = yOf(state.d), dx = RAIL_X;
  S.box({ x: dx - 15, y: dy - 17, w: 30, d: 34, r: 3 }, 2.6, 4, { tone: "mid" }, { bevel: 0.5 });
  const zt = 9;
  S.box({ x: dx - 7, y: dy - 8, w: 14, d: 16, r: 2.4 }, zt, 6, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  const mot = [[dx + 14, dy + 16], [dx + 14, dy - 16], [dx - 14, dy + 16], [dx - 14, dy - 16]];
  for (const [mx, my] of mot) S.tube([[dx, dy, zt + 2], [mx, my, zt + 2]], 1.6, { tone: "mid", maxLength: 30 });
  const props = [];
  mot.forEach(([mx, my], i) => props.push([mx, my, motor(S, mx, my, zt + 1, { r: 4.6, h: 5, ribs: 10 }).top + 1.2, i]));
  // VTX и антенна-«гриб» сзади, светодиод PIT.
  S.tube([[dx - 5, dy, zt + 6], [dx - 5, dy, zt + 26]], 0.8, { tone: "hi" });
  S.solid(G.sphereOf([dx - 5, dy, zt + 28], 2.8, P), { tone: "hi" }, [dx - 5, dy, zt + 28]);
  const vled = [dx + 2, dy + 5, zt + 6];
  S.raw([vled[0], vled[1], vled[2] + 1], `<g data-part="vled"></g>`, { bias: 3 });
  // Камера спереди: у ночной камеры объектив крупнее.
  S.group = "cam";
  const night = Number(state.cam) < 0.01;
  const cam = { x: dx + 7, y: dy - 6, w: 7, d: 12, r: 1.2 };
  S.box(cam, zt + 1, 9, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  const lens = k.sideMatrix([cam.x + cam.w, dy], zt + 5.5, P, "right");
  S.raw([cam.x + cam.w + 0.3, dy, zt + 5.5], `<g transform="${lens}"><circle cx="0" cy="0" r="${night ? 4.2 : 2.8}" class="gg-lens"/><circle cx="0" cy="0" r="${night ? 2.4 : 1.4}" class="gg-glass"/></g>`, { bias: 2 });
  S.group = "drone";
  props.forEach(([x, y, z, i]) => S.raw([x, y, z + 6], `<g data-prop="${i}">${propSvg(P, x, y, z, 10.5, i * 0.7, { blades: 3 })}</g>`, { bias: 20 }));

  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Видеотракт на столе: дрон с камерой на каретке, приёмная станция, мониторы аналога и цифры, лампа и второй передатчик.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Дрон: камера + VTX", [dx, dy, 18], "Камера снимает, видеопередатчик (VTX) шлёт картинку на станцию. Чем дальше, тем слабее сигнал."],
    ["Камера", [cam.x + cam.w, dy, zt + 10], "Порог в люксах: меньше число — лучше видит в темноте. У ночной камеры 0,001 лк."],
    ["Станция (видеоприёмник)", [ST.x + ST.w / 2, ST.y + ST.d / 2, 14], "Принимает видео и показывает его на мониторах — как очки пилота."],
    ["Мониторы: аналог · цифра", [-92, MONS[0].y, MZ0 + MH], "Слева аналоговая картинка, справа цифровая. Сравни, как они портятся с расстоянием."],
    ["Лампа", [LAMP[0], LAMP[1], 60], "Освещение: день, поздние сумерки (0,05 лк) или ночь без луны (0,002 лк)."],
    ["Второй передатчик", [fx, fy, 10], "Передатчик друга. На твоём канале он лезет в аналоговую картинку."],
  ]);
  return { svg, P, labels, model: m, live: { props, friendC: FRIEND, vled: at(vled) }, parts: S.count() };
}

export const defaults = { d: 0.3, p: 400, light: "day", cam: 0.1, friend: false, pit: false, smooth: false };
export const controls = [
  { id: "d", label: "Расстояние до дрона", type: "range", min: D_MIN, max: D_MAX, step: 0.05, fmt: (v) => `${km(v)} км`, rebuild: true },
  { id: "p", label: "Мощность видеопередатчика", type: "seg", options: POWERS, num: true, rebuild: true },
  { id: "light", label: "Освещение", type: "seg", options: LIGHT, rebuild: true },
  { id: "cam", label: "Камера (меньше люкс — лучше в темноте)", type: "seg", options: CAMS, num: true, rebuild: true },
  { id: "friend", label: "Друг на том же канале", type: "check", rebuild: true },
  { id: "pit", label: "PIT Mode (почти не излучает)", type: "check", rebuild: true },
  { id: "smooth", label: "Цифра с плавной деградацией (как HDZero)", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { d: 0.2 } },
  { at: 3, set: { d: 0.9 } },
  { at: 6, set: { d: 1.4 } },
  { at: 9, set: { d: 0.3, friend: true } },
  { at: 12, set: { friend: false } },
];

function picture(gx, bright, ghost) {
  const g = clamp(bright, 0, 1);
  let h = `<g style="opacity:${(0.08 + g * 0.92).toFixed(2)}"><rect x="0" y="0" width="166" height="70" class="sky"/><rect x="0" y="70" width="166" height="54" class="ground"/>`;
  h += `<path d="M26 70v-22" class="trunk"/><circle cx="26" cy="42" r="14" class="crown"/>`;
  const gxx = 20 + (gx % 1) * 126;
  h += `<path d="M${gxx.toFixed(1)} 94V56H${(gxx + 30).toFixed(1)}V94" class="gate"/><path d="M83 54v14M76 62h14" class="osd"/></g>`;
  if (ghost) h += `<g style="opacity:.45"><path d="M120 114V34H160V114" class="gate"/><rect x="0" y="${((ghost * 60) % 124).toFixed(1)}" width="166" height="10" class="snow"/></g>`;
  return h;
}

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const aEl = q("scr-a"), dEl = q("scr-d"), ringEl = q("rings"), ledEl = q("vled");
  const propEls = [...root.querySelectorAll("[data-prop]")];
  const sim = { t: 0, dT: 0, frozenT: 0, spin: 0 };
  let m = built.model;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      m = videoModel(st);
      const gx = sim.t * 0.18;
      if (m.digOk) { sim.dT = gx; sim.frozenT = 0; } else if (!calm) sim.frozenT += dt;
      // Аналог: картинка + «снег», который растёт к краю; друг на канале — чужая картинка поверх.
      let a = picture(gx, m.bright * (1 - m.hissA * 0.75), st.friend ? Math.max(0.01, sim.t * 2) : 0);
      const n = Math.round(m.hissA * 90 + (st.friend ? 12 : 0));
      const seed = calm ? 0 : Math.floor(sim.t * 30);
      const rnd = (i) => { const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
      for (let i = 0; i < n; i++) a += `<rect x="${(rnd(i * 3 + 1) * 150).toFixed(0)}" y="${(rnd(i * 3) * 124).toFixed(0)}" width="${(6 + rnd(i * 3 + 2) * 24).toFixed(0)}" height="1.6" class="snow"/>`;
      aEl.innerHTML = a;
      // Цифра: чётко, пока хватает данных; потом стоп-кадр и «сигнал потерян». Плавная — квадратики.
      let d = m.digOk ? picture(gx, m.bright, 0) : picture(sim.dT, m.bright * 0.7, 0);
      if (m.blocks > 0) for (let i = 0; i < Math.round(m.blocks * 40); i++) d += `<rect x="${(i * 37) % 150}" y="${(i * 53 + Math.floor(sim.t * 6) * 11) % 112}" width="${12 + (i % 3) * 6}" height="12" class="mosaic"/>`;
      if (!m.digOk) d += `<rect x="12" y="44" width="142" height="30" rx="6" class="gg-hud"/><text x="83" y="64" class="gg-big" text-anchor="middle">${sim.frozenT > 1 ? "СИГНАЛ ПОТЕРЯН" : "картинка замерла"}</text>`;
      dEl.innerHTML = d;
      // Кольца вокруг антенны друга.
      let rings = "";
      if (st.friend) for (let i = 0; i < 3; i++) {
        const ph = calm ? i / 3 : (sim.t * 0.6 + i / 3) % 1;
        rings += `<path class="iso-line jam-ring" style="opacity:${((1 - ph) * 0.7).toFixed(2)}" d="${k.ring(L.friendC[0] + 4, L.friendC[1] + 3, 8 + ph * 26, 1, P, 48)}"/>`;
      }
      ringEl.innerHTML = rings;
      // Светодиод VTX: в PIT Mode мигает.
      const lit = !st.pit || Math.floor(sim.t * 2) % 2 === 0;
      ledEl.innerHTML = `<ellipse cx="${L.vled[0].toFixed(1)}" cy="${L.vled[1].toFixed(1)}" rx="2" ry="1.3" class="led${lit ? (st.pit ? " warn" : " on") : ""}"/>`;
      if (!calm) sim.spin += dt * 1.2;
      propEls.forEach((el) => {
        const [x, y, z, i] = L.props[Number(el.dataset.prop)];
        el.innerHTML = propSvg(P, x, y, z, 10.5, i * 0.7 + sim.spin * (i === 0 || i === 3 ? 1 : -1), { blades: 3 });
      });
      return true;
    },
    facts() {
      return { hissA: m.hissA, digOk: m.digOk, blocks: m.blocks, bright: m.bright, q: m.q };
    },
    readout() {
      return `${km(state.d)} км · край цифры ≈ ${km(m.range)} км · пройдено ${fmt(Math.min(m.q, 9.99) * 100)} %`;
    },
    metrics() {
      const an = m.hissA < 0.05 ? "чисто" : m.hissA < 0.6 ? "«снег»" : m.hissA < 0.95 ? "сильный «снег»" : "почти один «снег»";
      const dg = m.digOk ? (m.blocks > 0.05 ? "квадраты" : "чётко") : "замерла";
      return [
        ["Край цифры", `${km(m.range)} км${state.pit ? " (PIT)" : ""}`, "учебная"],
        ["Пройдено до края", `${fmt(Math.min(m.q, 9.99) * 100)} %`, ""],
        ["Аналог · цифра", `${an} · ${dg}`, ""],
        ["Света для камеры", m.bright > 0.5 ? "хватает" : m.bright > 0.2 ? "мало" : "темно", ""],
      ];
    },
    note() {
      const lux = LUX[state.light], cam = Number(state.cam);
      if (state.pit && state.d > m.range) return "<b>PIT Mode</b> — режим для настройки на столе: передатчик почти молчит. В полёте его выключают.";
      if (m.bright < 0.2) return lux < cam ? `<b>Темно для этой камеры:</b> ей нужно хотя бы ${String(cam).replace(".", ",")} лк. Чем меньше число люкс у камеры, тем лучше она видит в темноте.` : `<b>Света (${String(lux).replace(".", ",")} лк) едва хватает</b> этой камере (порог ${String(cam).replace(".", ",")} лк): картинка тёмная. Нужна камера чувствительнее или больше света.`;
      if (state.friend) return "<b>Аналоговый канал открытый:</b> любой передатчик на той же частоте лезет в твою картинку. Договаривайтесь о каналах до взлёта!";
      if (!m.digOk) return m.hissA < 0.92 ? "<b>Цифра потеряла поток данных и замерла</b>, а аналог ещё «шипит, но видно». Так ведут себя многие цифровые системы — но не все (HDZero деградирует плавно)." : "<b>Слишком далеко:</b> цифра пропала, а в аналоге почти один «снег». Подлети ближе.";
      if (m.hissA > 0.3) return "<b>Аналог портится постепенно</b> — появляется «снег». Цифра пока держит чёткую картинку.";
      return "Рядом обе картинки чистые. Отлетай дальше — следи за флажками на рельсе.";
    },
  };
}
