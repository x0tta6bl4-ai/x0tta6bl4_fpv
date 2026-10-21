// Fig: волна и антенна. Генератор с переключателем частоты и своей антенной (прямой или «клевер»),
// стоячая пластина из оргстекла, на которой бежит волна в масштабе, приёмная антенна-телескоп на поворотном
// шарнире с транспортиром, линейка в сантиметрах и стрелочный индикатор «сколько дошло». Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, knob, dialGauge, fmt, clamp, TAU, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -92, y: -116, w: 158, d: 224, r: 8 };
const GEN = { x: -80, y: 50, w: 32, d: 40 };
const SHEET = { x: -40, y: -104, w: 3, d: 150, z0: 8, h: 54 };
const SW = SHEET.d - 6; // ширина картинки на пластине
const CM = 1.6; // единиц пластины на сантиметр волны
const RXP = [26, -62]; // шарнир приёмной антенны
const PIV = 14; // высота шарнира
const RU = 2.4; // единиц линейки на сантиметр антенны
const METER = [36, 4];

export const FREQS = [[433, "433 МГц"], [915, "915 МГц"], [2400, "2,4 ГГц"], [5800, "5,8 ГГц"]];
const FL = Object.fromEntries(FREQS);

export function antennaModel(s) {
  const f = Number(s.f);
  const lam = 30000 / f; // см
  const quarter = lam / 4;
  const ok = Math.abs(s.len - quarter) / quarter < 0.1;
  const lin = Math.cos((s.ang * Math.PI) / 180) ** 2;
  const sig = s.circ ? 0.5 : lin;
  return { f, lam, quarter, ok, sig };
}

export const meta = {
  id: "antenna",
  title: "Волна и антенна",
  hint: "Длина антенны — ползунок справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Волна на пластине; светлый отрезок — четверть волны, такой длины нужна антенна" },
    { mark: "raised", label: "Генератор, пластина с волной, антенна-телескоп на шарнире, линейка, индикатор" },
    { mark: "edge", label: "Транспортир за антенной — угол поворота относительно антенны генератора" },
  ],
  caption: "Чем выше частота, тем короче волна. Расчёт — в «Шпаргалке оператора» главы 20. Антенна лучше всего работает, когда её длина — четверть волны: 915 МГц → λ ≈ 33 см → антенна ≈ 8 см; 5,8 ГГц → λ ≈ 5 см → антенна ≈ 1,3 см. Поляризация: линейные антенны должны стоять одинаково. Поперёк (90°) почти ничего не доходит. Круговая антенна («клевер») с линейной теряет половину мощности (−3 дБ) при любом повороте, зато без провалов.",
  aria: "Справа: частота генератора, длина приёмной антенны, её поворот и переключатель круговой антенны на генераторе.",
  missions: [
    {
      id: "a915", look: ["sheet", "rx", "ruler"], touch: ["len"], see: "светлую четверть волны на пластине и метку ¼λ на линейке",
      text: "Подбери длину антенны под 915 МГц (антенна загорится)",
      check: (f) => f.f === 915 && f.ok,
      predict: { q: "Волна 915 МГц длиной около 33 см. Какой длины нужна антенна?", options: ["33 см — во всю волну", "Около 8 см — четверть волны", "Около 1 см"], right: 1 },
      setup: { f: 915, len: 3, ang: 0, circ: false },
    },
    {
      id: "a58", look: ["gen", "sheet", "rx"], touch: ["f=5800", "len"], see: "как сжалась волна на пластине",
      text: "Теперь подбери антенну под 5,8 ГГц",
      check: (f) => f.f === 5800 && f.ok,
      predict: { q: "Частота выросла с 915 МГц до 5,8 ГГц. Антенна должна стать…", options: ["длиннее", "короче: волна короче", "такой же"], right: 1 },
      setup: { f: 915, len: 8.2, ang: 0, circ: false },
    },
    {
      id: "cross", look: ["rx", "meter"], touch: ["ang"], see: "стрелку индикатора и транспортир",
      text: "Поверни антенну приёмника так, чтобы сигнал почти пропал",
      check: (f, s) => !s.circ && f.sig < 0.05,
      predict: { q: "Антенну приёмника положили поперёк антенны генератора (90°). Сколько сигнала дойдёт?", options: ["Всё: расстояние то же", "Почти ничего", "Ровно половина"], right: 1 },
      setup: { f: 915, len: 8.2, ang: 0, circ: false },
    },
    {
      id: "circ", look: ["gen", "meter"], touch: ["circ", "ang"], see: "стрелку индикатора, пока крутишь антенну",
      text: "Поставь круговую антенну на генератор. Сколько сигнала осталось?",
      check: (f, s) => !!s.circ,
      predict: { q: "На генератор поставили круговую антенну («клевер»), приёмная — прямая. Сколько дойдёт?", options: ["Всё", "Половина при любом повороте", "Ничего"], right: 1 },
      confirm: { q: "Почему круговая + прямая = половина при любом повороте?", options: ["Круговая волна вращается — прямая антенна в любом положении ловит её половину", "Круговые антенны слабее", "Так совпало при этом угле"], right: 0, miss: "Покрути «Поворот антенны приёмника» при включённом «клевере»: стрелка стоит на 50 %." },
      setup: { f: 915, len: 8.2, ang: 60, circ: false },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [GEN.x + 6, GEN.y + GEN.d / 2, 84], [RXP[0], RXP[1], PIV + 25 * RU + 6], [SHEET.x, SHEET.y, SHEET.z0 + SHEET.h + 2]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = antennaModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 30, y: 58, w: 26, d: 40, r: 1.5 });

  // ── Генератор: корпус, переключатель частоты, табло, антенна ──
  S.group = "gen";
  S.box({ ...GEN, r: 3 }, 0, 18, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(GEN, 5, P, 4), { tone: "faint" }) }, { bevel: 0.6 });
  const kn = knob(S, GEN.x + 22, GEN.y + 12, 18, 4.4, 3, { tone: "mid" });
  const FA = { 433: -1.1, 915: -0.37, 2400: 0.37, 5800: 1.1 };
  S.line(Object.values(FA).map((a) => k.lineOnTop([GEN.x + 22 + Math.sin(a) * 5.8, GEN.y + 12 - Math.cos(a) * 5.8], [GEN.x + 22 + Math.sin(a) * 7.4, GEN.y + 12 - Math.cos(a) * 7.4], 18, P)).join(""), { tone: "mid" }, [GEN.x + 22, GEN.y + 12, 18.1]);
  S.raw([GEN.x + 22, GEN.y + 12, 30], k.lineSvg(kn.pointer(FA[M.f] ?? -0.37), { tone: "lit" }), { bias: 2 });
  const gface = k.sideMatrix([GEN.x + GEN.w, GEN.y + GEN.d - 3], 15, P, "right");
  S.raw([GEN.x + GEN.w + 0.4, GEN.y + GEN.d / 2, 9], `<g transform="${gface}"><rect x="0" y="0" width="${GEN.d - 6}" height="11" rx="1.2" class="osd-screen"/>${txt(2.2, 4.6, FL[M.f], "an-t")}${txt(2.2, 9.4, `λ ≈ ${fmt(M.lam, M.lam < 10 ? 1 : 0)} см`, "an-t")}</g>`, { bias: 3 });
  const tx = [GEN.x + 8, GEN.y + GEN.d / 2];
  S.cyl(tx[0], tx[1], 2.6, 18, 3.4, { tone: "mid" });
  const txTop = state.circ ? 60 : 82;
  S.tube([[tx[0], tx[1], 21.4], [tx[0], tx[1], txTop]], 1, { tone: "hi", maxLength: 40 });
  if (!state.circ) S.solid(G.sphereOf([tx[0], tx[1], txTop], 1.6, P), { tone: "hi" }, [tx[0], tx[1], txTop]);
  else S.raw([tx[0], tx[1], txTop + 8], `<g data-part="clover"></g>`, { bias: 4 });

  // ── Пластина из оргстекла с бегущей волной (на грани, обращённой к зрителю) ──
  S.group = "sheet";
  S.box({ x: SHEET.x - 4, y: SHEET.y - 4, w: 11, d: SHEET.d + 8, r: 1.5 }, 0, SHEET.z0, { tone: "mid" }, { bevel: 0.4 });
  S.box({ ...SHEET, r: 0.8 }, SHEET.z0, SHEET.h, { tone: "hi", inner: k.lineSvg(k.sideSeam(SHEET, SHEET.z0 + 3, P, 2), { tone: "faint" }) }, { bevel: 0.3, ref: [SHEET.x + SHEET.w, SHEET.y + SHEET.d / 2, SHEET.z0 + SHEET.h / 2] });
  const sface = k.sideMatrix([SHEET.x + SHEET.w, SHEET.y + SHEET.d - 3], SHEET.z0 + SHEET.h - 3, P, "right");
  S.raw([SHEET.x + SHEET.w + 0.4, SHEET.y + SHEET.d / 2, SHEET.z0 + SHEET.h / 2], `<g transform="${sface}"><rect x="0" y="0" width="${SW}" height="${SHEET.h - 6}" rx="1" class="an-sheet"/><g data-part="wave"></g></g>`, { bias: 3 });

  // ── Линейка в сантиметрах рядом с антенной ──
  S.group = "ruler";
  const rp = { x: RXP[0] - 2, y: RXP[1] + 14, w: 4, d: 4 };
  S.box({ x: rp.x - 4, y: rp.y - 4, w: 12, d: 12, r: 1.4 }, 0, 4, { tone: "mid" }, { bevel: 0.3 });
  S.box({ ...rp, r: 0.4 }, 4, PIV - 4 + 25 * RU + 2, { tone: "hi" }, { steps: 2, bevel: 0.2, ref: [rp.x + rp.w, rp.y + rp.d / 2, 40] });
  const rface = k.sideMatrix([rp.x + rp.w, rp.y + rp.d], PIV + 25 * RU, P, "right");
  let rt = "";
  for (let c = 0; c <= 25; c++) {
    const y = (25 - c) * RU;
    rt += `<path class="an-tick" d="M0 ${y.toFixed(2)}h${c % 5 ? 1.4 : 2.6}"/>`;
    if (c % 5 === 0) rt += txt(-0.6, y + 1.3, c, "an-num", "end");
  }
  if (M.quarter <= 25) rt += `<path class="an-target" d="M-0.4 ${((25 - M.quarter) * RU).toFixed(2)}h4.4"/>`;
  S.raw([rp.x + rp.w + 0.3, rp.y + rp.d / 2, 40], `<g transform="${rface}">${rt}</g>`, { bias: 3 });

  // ── Приёмная антенна: основание, шарнир, транспортир, телескоп ──
  S.group = "rx";
  S.cyl(RXP[0], RXP[1], 11, 0, 4, { tone: "mid" });
  S.box({ x: RXP[0] - 3, y: RXP[1] - 4, w: 6, d: 8, r: 1 }, 4, PIV - 4, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  const plate = { x: RXP[0] - 8, y: RXP[1] - 34, w: 2, d: 38, r: 0.4 };
  S.box(plate, 4, 34, { tone: "hi" }, { steps: 2, ref: [plate.x + plate.w, RXP[1] - 15, 20] });
  const pface = k.sideMatrix([plate.x + plate.w, RXP[1]], PIV, P, "right");
  let pr = "";
  for (let d = 0; d <= 90; d += 5) {
    const a = (d * Math.PI) / 180, r0 = d % 15 ? 26 : 24;
    pr += `<path class="an-tick" d="M${(Math.sin(a) * r0).toFixed(2)} ${(-Math.cos(a) * r0).toFixed(2)}L${(Math.sin(a) * 28).toFixed(2)} ${(-Math.cos(a) * 28).toFixed(2)}"/>`;
    if (d % 45 === 0) pr += txt((Math.sin(a) * 21).toFixed(2), (-Math.cos(a) * 21 + 1.4).toFixed(2), `${d}°`, "an-num", "middle");
  }
  pr += `<path class="an-arc" d="M0 -28A28 28 0 0 1 28 0"/>`;
  S.raw([plate.x + plate.w + 0.3, RXP[1] - 15, 20], `<g transform="${pface}">${pr}</g>`, { bias: 2 });
  const a = (state.ang * Math.PI) / 180;
  const L = state.len * RU;
  const tip = [RXP[0], RXP[1] - Math.sin(a) * L, PIV + Math.cos(a) * L];
  S.tube([[RXP[0], RXP[1], PIV], tip], 0.9, { tone: M.ok ? "hi" : "mid", maxLength: 12 }, { bias: 1 });
  S.solid(G.sphereOf(tip, 1.8, P), { tone: "hi", lit: M.ok }, tip, { bias: 1.5 });
  S.raw(tip, `<g data-part="glow"></g>`, { bias: 2 });

  // ── Индикатор «сколько дошло» ──
  S.group = "meter";
  S.box({ x: METER[0] - 16, y: METER[1] - 16, w: 32, d: 32, r: 3 }, 0, 6, { tone: "mid" }, { bevel: 0.5 });
  const dial = dialGauge(S, METER[0], METER[1], 6, 13, { h: 5, ticks: 20, every: 5, from: -2.2, span: 4.4, face: "%" });
  S.raw([METER[0], METER[1], 20], `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${dial.needle(M.sig)}"/>`, { bias: 40 });

  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Стенд «волна и антенна»: генератор с антенной, пластина с волной, приёмная антенна на шарнире с линейкой и транспортиром, индикатор сигнала.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Генератор", [GEN.x + GEN.w / 2, GEN.y + GEN.d / 2, 18], "Излучает волну выбранной частоты. На табло — частота и длина волны."],
    ["Волна в масштабе", [SHEET.x + SHEET.w, SHEET.y + SHEET.d / 2, SHEET.z0 + SHEET.h], "Светлый отрезок — четверть волны: такой длины нужна антенна."],
    ["Антенна приёмника", [tip[0], tip[1], tip[2]], "Телескоп: длина — ползунком, наклон — поворотом шарнира."],
    ["Индикатор", [METER[0], METER[1], 11], "Сколько сигнала дошло из-за поляризации: 100 % — антенны стоят одинаково."],
  ]);
  return { svg, P, labels, model: M, live: { tip: at(tip), clover: [tx[0], tx[1], txTop + 6], needle: dial.needle }, parts: S.count() };
}

export const defaults = { f: 915, len: 3, ang: 0, circ: false };
export const controls = [
  { id: "f", label: "Частота генератора", type: "seg", options: FREQS, num: true, rebuild: true },
  { id: "len", label: "Длина антенны приёмника", type: "range", min: 0.5, max: 25, step: 0.1, fmt: (v) => `${fmt(v, 1)} см`, rebuild: true },
  { id: "ang", label: "Поворот антенны приёмника", type: "range", min: 0, max: 90, step: 1, fmt: (v) => `${v}°`, rebuild: true },
  { id: "circ", label: "Круговая антенна на генераторе («клевер»)", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { f: 915, len: 3 } },
  { at: 2, set: { len: 8.2 } },
  { at: 5, set: { f: 5800, len: 1.3 } },
  { at: 8, set: { f: 915, len: 8.2, ang: 85 } },
  { at: 11, set: { ang: 0 } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const waveEl = q("wave"), cloverEl = q("clover"), glowEl = q("glow");
  const sim = { t: 0 };
  let M = built.model;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      M = antennaModel(st);
      // Волна на пластине: длина в масштабе CM единиц на сантиметр.
      const px = M.lam * CM, mid = 22, amp = 11;
      let d = "";
      for (let x = 2; x <= SW - 2; x += 0.8) d += `${x === 2 ? "M" : "L"}${x.toFixed(1)} ${(mid - Math.sin(((x - 2) / px) * TAU - sim.t * 5) * amp).toFixed(2)}`;
      // Четверть волны — от нуля до гребня, ближайшего к левому краю.
      const ph = ((sim.t * 5) / TAU) % 1;
      const x0 = 2 + ph * px;
      let qd = "";
      for (let x = x0; x <= Math.min(SW - 2, x0 + px / 4); x += 0.5) qd += `${x === x0 ? "M" : "L"}${x.toFixed(1)} ${(mid - Math.sin(((x - 2) / px) * TAU - sim.t * 5) * amp).toFixed(2)}`;
      let w = `<path class="an-axis" d="M2 ${mid}H${SW - 2}"/><path class="an-wave" d="${d}"/>${qd ? `<path class="an-quarter" d="${qd}"/>` : ""}`;
      w += txt(2.4, 5.4, `Длина волны: ${fmt(M.lam, 1)} см при ${M.f} МГц`, "an-t2");
      if (px < SW - 6) w += `<path class="an-dim" d="M3 41h${px.toFixed(1)}M3 38.6v4.8M${(3 + px).toFixed(1)} 38.6v4.8"/>` + txt(3 + px / 2, 46.4, "одна волна", "an-t3", "middle");
      else w += txt(SW / 2, 46.4, "волна длиннее пластины", "an-t3", "middle");
      waveEl.innerHTML = w;
      // «Клевер»: три лепестка вращаются вокруг вершины.
      if (cloverEl) {
        let c = "";
        for (let i = 0; i < 3; i++) {
          const a0 = (calm ? 0 : sim.t * 2.4) + (i * TAU) / 3;
          const cx = L.clover[0] + Math.cos(a0) * 4.2, cy = L.clover[1] + Math.sin(a0) * 4.2;
          c += `<path class="iso-line" data-tone="hi" style="stroke-width:1.2" d="${k.ring(cx, cy, 4.4, L.clover[2] + Math.sin(a0) * 1.5, P, 24)}"/>`;
        }
        cloverEl.innerHTML = c;
      }
      glowEl.innerHTML = M.ok ? `<circle cx="${L.tip[0].toFixed(1)}" cy="${L.tip[1].toFixed(1)}" r="${(6 + Math.sin(sim.t * 4) * 1.2).toFixed(1)}" class="an-glow"/>` : "";
      return true;
    },
    facts() {
      return { f: M.f, ok: M.ok, sig: M.sig, quarter: M.quarter };
    },
    readout() {
      return `λ ≈ ${fmt(M.lam, 1)} см · ¼λ ≈ ${fmt(M.quarter, 1)} см · антенна ${fmt(state.len, 1)} см · дошло ${fmt(M.sig * 100)} %`;
    },
    metrics() {
      return [
        ["Длина волны", `${fmt(M.lam, 1)} см`, "300 ÷ f"],
        ["Нужна антенна (¼λ)", `${fmt(M.quarter, 1)} см`, ""],
        ["Антенна сейчас", `${fmt(state.len, 1)} см${M.ok ? " · резонанс" : ""}`, ""],
        ["Дошло из-за поляризации", `${fmt(M.sig * 100)} %${state.circ ? " (−3 дБ)" : ""}`, ""],
      ];
    },
    note() {
      const len = M.ok ? `<b>Резонанс:</b> антенна ${fmt(state.len, 1)} см — четверть волны (${fmt(M.quarter, 1)} см), она «звучит в такт» волне и работает лучше всего.` : `Нужна антенна около ¼ длины волны: <b>${fmt(M.quarter, 1)} см</b>. Чем выше частота, тем короче волна и тем короче антенна.`;
      const pol = state.circ ? " Круговая + прямая: теряется половина мощности при любом повороте." : state.ang > 75 ? " Антенны крест-накрест — почти ничего не доходит, как через два поляризационных стекла под 90°." : "";
      return len + pol;
    },
  };
}
