// Fig: сколько я пролечу. Дрон на испытательной стойке с батареей снизу (одна или две параллельно),
// стеклянный «бак» заряда с красной зоной запаса 20 %, ваттметр с экраном (В × А = Вт), стрелочный
// амперметр с красной меткой «сколько может отдать батарея» и шкала времени, по которой едет флажок.
import { k, G, scene, basePlate, labelPlate, motor, propSvg, dialGauge, fmt, clamp, TAU, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -82, y: -122, w: 164, d: 236, r: 8 };
const STAND = [-24, 44];
const DZ = 64; // высота рамы дрона
const TANK = [-44, -36], TR = 13, TZ0 = 4, TH = 58;
const WM = { x: 22, y: 18, w: 22, d: 54 };
const AMP = [30, -66];
const TL = { x: 62, y0: 70, y1: -104 }; // шкала времени вдоль y
const AMAX = 150; // предел шкалы амперметра

export const PACKS = {
  "4s1300": { name: "4S 1300 мА·ч 100C", short: "4S 1300 100C", s: 4, mah: 1300, c: 100, g: 160 },
  "6s1300": { name: "6S 1300 мА·ч 100C", short: "6S 1300 100C", s: 6, mah: 1300, c: 100, g: 230 },
  "6s6000": { name: "6S 6000 мА·ч 15C", short: "6S 6000 15C", s: 6, mah: 6000, c: 15, g: 850 },
  "6s6000x2": { name: "2 × 6S 6000 параллельно", short: "2 × 6S 6000", s: 6, mah: 12000, c: 15, g: 1700 },
};
export const STYLES = [["calm", "плавно", 0.25], ["cruise", "крейсер", 0.5], ["cargo", "груз / ветер", 0.75], ["max", "максимум", 1]];
const DRONE_G = 700;

// Модель из книги (гл. 7): мощность висения растёт как масса^1,5, мощность винта — как обороты³.
export function energyModel(packKey, style) {
  const p = PACKS[packKey] || PACKS["6s1300"];
  const mass = DRONE_G + p.g;
  const pHover = 230 * Math.pow(mass / 930, 1.5);
  const pMax = 2260 * (p.s === 4 ? 0.45 : 1);
  const load = (STYLES.find((x) => x[0] === style) || STYLES[1])[2];
  const V = 3.7 * p.s;
  const P = pHover + (pMax - pHover) * load ** 3;
  const I = P / V, imax = pMax / V;
  const tPaper = (p.mah / (I * 1000)) * 60;
  const tReal = tPaper * 0.8;
  const canGive = (p.mah / 1000) * p.c;
  return { p, mass, V, P, I, imax, tPaper, tReal, canGive, load, weak: imax > canGive };
}
const shortOf = (k2) => PACKS[k2].short;

export const meta = {
  id: "flighttime",
  title: "Сколько я пролечу",
  hint: "Батарея и стиль — справа, «Взлёт» запускает полёт",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Уровень в «баке» — заряд; красная зона внизу — запас 20 %, его не тратят" },
    { mark: "raised", label: "Дрон на стойке с батареей, бак заряда, ваттметр, амперметр, шкала времени" },
    { mark: "edge", label: "Красная метка на амперметре — сколько ампер может отдать батарея (ёмкость × C)" },
  ],
  caption: "Время полёта = ёмкость (мА·ч) ÷ ток (мА) × 60 и ещё ×0,8: LiPo не разряжают до нуля, запас 20 % остаётся. Ток зависит от массы и стиля: мощность винта растёт как обороты³, поэтому на максимуме ток в разы больше, чем в спокойном полёте. Мощность = вольты × амперы. Батарея отдаёт не больше «ёмкость в А·ч × C» ампер — у большой, но медленной (15C) батареи может не хватить тока на максимуме. Цифры дрона — учебная оценка.",
  aria: "Справа: выбор батареи, стиль полёта и переключатель «Взлёт».",
  missions: [
    {
      id: "ten", look: ["tank", "timeline"], touch: ["pack", "style"], see: "шкалу времени и уровень в баке",
      text: "Подбери батарею и стиль, чтобы честно (с запасом) лететь 10 минут или больше",
      check: (f) => f.tReal >= 10,
      predict: { q: "Что даст больше честного времени полёта?", options: ["Лёгкая батарея 1300 мА·ч и полёт на максимуме", "Большая батарея 6000 мА·ч и плавный полёт", "Любая батарея: время зависит только от моторов"], right: 1 },
      setup: { pack: "6s1300", style: "cruise", fly: false },
    },
    {
      id: "double", look: ["drone", "timeline"], touch: ["pack=6s6000x2"], see: "массу дрона и время на шкале",
      text: "Поставь две батареи параллельно. Время выросло ровно вдвое?",
      check: (f, s) => s.pack === "6s6000x2",
      predict: { q: "Ёмкость удвоили второй такой же батареей. Время полёта на крейсере…", options: ["вырастет ровно вдвое", "вырастет меньше чем вдвое", "не изменится"], right: 1 },
      confirm: { q: "Почему не вдвое?", options: ["Дрон потяжелел — ток вырос, и каждая мА·ч тратится быстрее", "Батареи параллельно мешают друг другу", "Напряжение упало вдвое"], right: 0, miss: "Сравни «Ток в полёте» с одной батареей и с двумя: с двумя ток больше, потому что дрон тяжелее на 850 г." },
      setup: { pack: "6s6000", style: "cruise", fly: false },
    },
    {
      id: "kw", look: ["meter"], touch: ["style=max"], see: "экран ваттметра",
      text: "Найди режим, где мощность больше 1000 Вт",
      check: (f) => f.P > 1000,
      predict: { q: "Как растёт мощность, если вдвое поднять обороты винта?", options: ["Вдвое", "Примерно в 8 раз (обороты³)", "Не меняется"], right: 1 },
      setup: { pack: "6s1300", style: "cruise", fly: false },
    },
    {
      id: "weak", look: ["amp"], touch: ["pack", "style=max"], see: "стрелку амперметра и красную метку",
      text: "Найди батарею, которой не хватает тока на максимуме (стрелка за красной меткой)",
      check: (f, s) => f.weak && s.style === "max",
      predict: { q: "У какой батареи может не хватить тока на максимуме?", options: ["6S 1300 100C — маленькая ёмкость", "6S 6000 15C — большая, но медленная (15C)", "У любой хватит"], right: 1 },
      setup: { pack: "6s1300", style: "cruise", fly: false },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [STAND[0], STAND[1], DZ + 20], [TANK[0], TANK[1], TZ0 + TH + 4]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const yOfT = (u) => TL.y0 + (TL.y1 - TL.y0) * u;

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = energyModel(state.pack, state.style);
  basePlate(S, PLATE);
  labelPlate(S, { x: 40, y: 76, w: 26, d: 32, r: 1.5 });

  // ── Стойка и дрон с батареей ──
  S.group = "drone";
  const [sx, sy] = STAND;
  S.cyl(sx, sy, 16, 0, 3, { tone: "mid" });
  S.tube([[sx, sy, 3], [sx, sy, DZ - 14]], 1.4, { tone: "mid", maxLength: 30 });
  const two = state.pack === "6s6000x2";
  const big = M.p.mah >= 6000;
  const bw = big ? 16 : 10, bd = big ? 34 : 24, bh = big ? 12 : 7;
  const packs = two ? [-bw / 2 - 1, bw / 2 + 1] : [0];
  packs.forEach((dx, i) => {
    const plan = { x: sx - bw / 2 + dx, y: sy - bd / 2, w: bw, d: bd, r: 2 };
    S.box(plan, DZ - 2 - bh, bh, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(plan, DZ - 2 - bh / 2, P, 3), { tone: "faint" }) }, { bevel: 0.4 });
    if (i === packs.length - 1) {
      const f = k.sideMatrix([plan.x + plan.w, plan.y + plan.d - 2], DZ - 3, P, "right");
      S.raw([plan.x + plan.w + 0.3, sy, DZ - 2 - bh / 2], `<g transform="${f}">${txt(0, big ? 5 : 3.6, big ? `6S ${two ? "6000 ×2" : "6000"}` : `${M.p.s}S ${M.p.mah}`, "ft-pk")}${big ? txt(0, 10, `${M.p.c}C`, "ft-pk") : ""}</g>`, { bias: 2 });
    }
  });
  S.box({ x: sx - 8, y: sy - 8, w: 16, d: 16, r: 2.4 }, DZ - 2, 5, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  const mot = [[sx + 20, sy + 20], [sx + 20, sy - 20], [sx - 20, sy + 20], [sx - 20, sy - 20]];
  for (const [mx, my] of mot) S.tube([[sx, sy, DZ], [mx, my, DZ]], 1.6, { tone: "mid", maxLength: 30 });
  const props = [];
  mot.forEach(([mx, my], i) => props.push([mx, my, motor(S, mx, my, DZ - 1, { r: 5, h: 5, ribs: 10 }).top + 1.2, i]));
  props.forEach(([x, y, z, i]) => S.raw([x, y, z + 6], `<g data-prop="${i}">${propSvg(P, x, y, z, 13, i * 0.7, { blades: 3 })}</g>`, { bias: 20 }));

  // ── Бак заряда: стеклянный цилиндр, жидкость рисует контроллер ──
  S.group = "tank";
  const [tx, ty] = TANK;
  S.cyl(tx, ty, TR + 3, 0, TZ0, { tone: "mid" });
  S.raw([tx, ty, TZ0 + TH / 2 - 0.5], `<g data-part="liquid"></g>`, { bias: -1 });
  const glass = k.ring(tx, ty, TR, TZ0, P, 48) + k.ring(tx, ty, TR, TZ0 + TH, P, 48);
  const eL = k.segment([tx, ty + TR, TZ0], [tx, ty + TR, TZ0 + TH], P), eR = k.segment([tx, ty - TR, TZ0], [tx, ty - TR, TZ0 + TH], P);
  S.raw([tx, ty, TZ0 + TH / 2], `<path class="iso-line" data-tone="mid" d="${glass}"/><path class="iso-line" data-tone="mid" d="${eL}${eR}"/><path class="iso-line ft-reserve" d="${k.ring(tx, ty, TR + 0.4, TZ0 + TH * 0.2, P, 48)}"/>`, { bias: 1 });
  const tf = k.sideMatrix([tx + TR * 0.7, ty + 9], TZ0 + TH * 0.2 + 1.5, P, "right");
  S.raw([tx + TR, ty, TZ0 + TH * 0.2], `<g transform="${tf}">${txt(0, 0, "запас 20 %", "ft-res")}</g>`, { bias: 2 });

  // ── Ваттметр: экран смотрит на зрителя ──
  S.group = "meter";
  S.box({ ...WM, r: 2.4 }, 0, 20, { tone: "mid", inner: k.lineSvg(k.sideSeam(WM, 4, P, 3), { tone: "faint" }) }, { bevel: 0.5 });
  const wf = k.sideMatrix([WM.x + WM.w, WM.y + WM.d - 3], 17, P, "right");
  S.raw([WM.x + WM.w + 0.4, WM.y + WM.d / 2, 10], `<g transform="${wf}"><rect x="0" y="0" width="${WM.d - 6}" height="15" rx="1.2" class="osd-screen"/><g data-part="wm"></g></g>`, { bias: 3 });
  S.tube([[WM.x, WM.y + 10, 3], [sx + 10, sy - 6, 1.2], [sx + 2, sy - 2, 3]], 0.8, { tone: "mid", bendR: 6, maxLength: 14 });

  // ── Амперметр с красной меткой «может отдать батарея» ──
  S.group = "amp";
  S.box({ x: AMP[0] - 18, y: AMP[1] - 18, w: 36, d: 36, r: 3 }, 0, 5, { tone: "mid" }, { bevel: 0.5 });
  const dial = dialGauge(S, AMP[0], AMP[1], 5, 15, { h: 5, ticks: 30, every: 5, from: -2.2, span: 4.4, face: "А" });
  const lim = clamp(M.canGive / AMAX, 0, 1);
  const la = -2.2 + lim * 4.4;
  const ztop = dial.top + 0.3;
  const limMark = k.lineOnTop([AMP[0] + Math.sin(la) * 9, AMP[1] - Math.cos(la) * 9], [AMP[0] + Math.sin(la) * 13.4, AMP[1] - Math.cos(la) * 13.4], ztop, P);
  S.raw([AMP[0], AMP[1], ztop + 1], `<path class="iso-line ft-lim" d="${limMark}"/>`, { bias: 30 });
  S.raw([AMP[0], AMP[1], ztop + 2], `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${dial.needle(0)}"/>`, { bias: 40 });

  // ── Шкала времени вдоль y: 0, ¼, ½, ¾, честное время ──
  S.group = "timeline";
  S.box({ x: TL.x - 3, y: TL.y1 - 6, w: 6, d: TL.y0 - TL.y1 + 12, r: 1 }, 0, 1, { tone: "lo", crease: "none" }, { layer: 0.3, steps: 2 });
  let tk = "", nums = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((u) => {
    const y = yOfT(u);
    tk += k.lineOnTop([TL.x - 3, y], [TL.x + 3, y], 1, P);
    nums += `<g transform="${k.topMatrix([TL.x + 5, y + 3], 1, P, "y")}">${txt(0, 3.4, `${fmt(M.tReal * u, 1)}`, "ft-num")}${u === 1 ? txt(0, 7.6, "мин", "ft-num") : ""}</g>`;
  });
  S.raw([TL.x, (TL.y0 + TL.y1) / 2, 1.2], k.lineSvg(tk, { tone: "mid" }) + nums, { layer: 0.35 });
  S.raw([TL.x, TL.y0, 4], `<g data-part="flag"></g>`, { layer: 0.9 });

  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Стенд «сколько я пролечу»: дрон на стойке с батареей, бак заряда, ваттметр, амперметр и шкала времени.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Дрон + батарея", [sx, sy, DZ], `Масса ${fmt(M.mass)} г: рама и моторы 700 г + батарея ${fmt(M.p.g)} г. Тяжелее — больше ток.`],
    ["Бак заряда", [tx, ty, TZ0 + TH], "Заряд батареи. Нижние 20 % — запас: на них не летают."],
    ["Ваттметр", [WM.x + WM.w, WM.y + WM.d / 2, 20], "Мощность = вольты × амперы."],
    ["Амперметр", [AMP[0], AMP[1], 10], "Стрелка — ток сейчас. Красная метка — сколько ампер может отдать батарея (ёмкость × C)."],
    ["Шкала времени", [TL.x, yOfT(1), 2], "Честное время полёта (×0,8). Флажок едет, пока дрон летит."],
  ]);
  return { svg, P, labels, model: M, live: { props, tank: TANK, flagAt: (u) => at([TL.x, yOfT(u), 1]), needle: dial.needle }, parts: S.count() };
}

export const defaults = { pack: "6s1300", style: "cruise", fly: false };
export const controls = [
  { id: "pack", label: "Батарея", type: "seg", options: Object.keys(PACKS).map((k2) => [k2, shortOf(k2)]), rebuild: true },
  { id: "style", label: "Как летим", type: "seg", options: STYLES.map(([k2, l]) => [k2, l]), rebuild: true },
  { id: "fly", label: "Взлёт: лететь до посадки", type: "check" },
];
export const tour = [
  { at: 0, set: { pack: "6s1300", style: "cruise", fly: true } },
  { at: 7, set: { fly: false, style: "max" } },
  { at: 10, set: { pack: "6s6000", style: "calm", fly: true } },
  { at: 17, set: { fly: false, style: "cruise", pack: "6s1300" } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const liqEl = q("liquid"), wmEl = q("wm"), flagEl = q("flag"), needleEl = q("needle");
  const propEls = [...root.querySelectorAll("[data-prop]")];
  const sim = { fly: 0, spin: 0, needle: 0 };
  const M = built.model;
  return {
    tick(dt, calm, st) {
      // Полёт: за 6 секунд показа проходит всё честное время; на посадке в баке остаётся 20 %.
      if (st.fly) sim.fly = calm ? 1 : Math.min(1, sim.fly + dt / 6);
      else sim.fly = 0;
      const left = 1 - 0.8 * sim.fly;
      const [tx, ty] = L.tank;
      const h = Math.max(0.6, (TH - 1.2) * left);
      liqEl.innerHTML = k.solidSvg(k.cylinder(tx, ty, TR - 1.2, TZ0 + 0.6, h, P, 40), { tone: left < 0.2001 ? "lo" : "hi", lit: left >= 0.2001 });
      const [fx, fy] = L.flagAt(sim.fly);
      flagEl.innerHTML = `<path class="iso-line" data-tone="mid" d="M${fx.toFixed(1)} ${fy.toFixed(1)}v-16"/><path class="ft-flag" d="M${fx.toFixed(1)} ${(fy - 16).toFixed(1)}l9 3l-9 3z"/>`;
      const want = st.fly && sim.fly >= 1 ? 0 : M.I;
      sim.needle += (want - sim.needle) * (calm ? 1 : 1 - Math.exp(-dt / 0.3));
      needleEl.setAttribute("d", L.needle(clamp(sim.needle / AMAX, 0, 1)));
      needleEl.setAttribute("data-tone", M.I > M.canGive || (st.style === "max" && M.weak) ? "red" : "lit");
      wmEl.innerHTML = txt(2, 5.6, `${fmt(M.V, 1)} В × ${fmt(M.I, 1)} А`, "ft-t") + txt(2, 11.6, `= ${fmt(M.P)} Вт`, `ft-t${M.P > 1000 ? " hot" : ""}`);
      const spinning = !(st.fly && sim.fly >= 1);
      if (!calm && spinning) sim.spin += dt * (1 + M.load * 6);
      propEls.forEach((el) => {
        const [x, y, z, i] = L.props[Number(el.dataset.prop)];
        el.innerHTML = propSvg(P, x, y, z, 13, i * 0.7 + sim.spin * (i === 0 || i === 3 ? 1 : -1), { blades: 3 });
      });
      return true;
    },
    facts() {
      return { tReal: M.tReal, P: M.P, weak: M.weak, I: M.I };
    },
    readout() {
      return `${fmt(M.I, 1)} А · ${fmt(M.P)} Вт · честно ${fmt(M.tReal, 1)} мин`;
    },
    metrics() {
      return [
        ["Ток в полёте", `${fmt(M.I, 1)} А`, ""],
        ["Время на бумаге", `${fmt(M.p.mah)} ÷ ${fmt(M.I * 1000)} × 60 = ${fmt(M.tPaper, 1)} мин`, ""],
        ["Честно (×0,8)", `${fmt(M.tReal, 1)} мин`, ""],
        ["Ток на максимуме / может отдать", `${fmt(M.imax)} / ${fmt(M.canGive)} А${M.weak ? " — НЕ хватит" : ""}`, "ёмкость × C"],
      ];
    },
    note() {
      if (state.pack === "6s6000x2") {
        const one = energyModel("6s6000", state.style);
        const gain = M.tReal / one.tReal;
        return gain > 1.98 ? `<b>На максимуме время ×${fmt(gain, 1)}:</b> моторы и так отдают всю мощность. Но дрон потяжелел на 850 г и разгоняется хуже. Выбери «крейсер»: там прибавка меньше чем вдвое.` : `<b>Ёмкость вдвое больше, а время — только ×${fmt(gain, 1)}:</b> дрон потяжелел на 850 г и берёт больший ток.`;
      }
      if (state.style === "max" && M.weak) return `<b>Батарея не тянет максимум:</b> может отдать ${fmt(M.p.mah / 1000)} А·ч × ${M.p.c}C = ${fmt(M.canGive)} А, а моторам нужно ${fmt(M.imax)} А. Стрелка за красной меткой — напряжение просядет, батарея перегреется.`;
      if (M.P > 1000) return `<b>${fmt(M.V, 1)} В × ${fmt(M.I, 1)} А = ${fmt(M.P)} Вт.</b> Мощность винта растёт как обороты³ — на максимуме это больше киловатта.`;
      return `Время = ${fmt(M.p.mah)} мА·ч ÷ ${fmt(M.I * 1000)} мА × 60 = ${fmt(M.tPaper, 1)} мин, честно ×0,8 = <b>${fmt(M.tReal, 1)} мин</b>. Включи «Взлёт» и смотри на бак.`;
    },
  };
}
