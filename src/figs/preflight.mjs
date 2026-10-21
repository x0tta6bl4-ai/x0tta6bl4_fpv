// Fig: перед вылетом. Поле с зоной полётов, площадкой и запасной площадкой, пилот с пультом и наблюдатель,
// ветроуказатель, столик с дроном и батареей, табличка разрешения. Каждый «день» по-своему расставляет помехи:
// посторонние в зоне, провода над площадкой, ветер, дождь, мороз, вздутая батарея, непроверенный Failsafe, сонный пилот.
// Ученик решает: летим или откладываем. Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, fmt, clamp, TAU, labelsAt, ellipseOnTop } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -86, y: -102, w: 172, d: 204, r: 8 };
const PAD = [4, -6], ZONE = 46, SPARE = [36, -72];
const PILOT = [64, 52], OBS = [68, 30];
const SOCK = [-62, -76];
const TABLE = { x: 40, y: -42, w: 30, d: 44 };
const SIGN = { x: -70, y: 48, w: 3, d: 48, z0: 14, h: 30 };
const POLES = [[-16, 70], [-16, -84]];

export const F = [
  ["Люди", "зона свободна, наблюдатель на месте", ["в зоне гуляют посторонние", "наблюдатель не пришёл"]],
  ["Площадка", "есть место для взлёта, посадки и запасное", ["над площадкой провода", "запасного места для посадки нет"]],
  ["Погода", "ветер слабый, без осадков", ["порывистый сильный ветер", "моросит дождь", "мороз, а батареи холодные"]],
  ["Оборудование", "все чек-листы пройдены", ["одна банка батареи вздулась", "Failsafe ещё не проверяли"]],
  ["Правила", "полёт здесь разрешён", ["разрешения на полёт нет"]],
  ["Ты сам", "выспался, спокоен", ["не спал полночи", "торопишься, все ждут"]],
];
// Первые дни заданы руками (разные случаи), дальше — по «зерну» дня.
const HAND = {
  1: { 2: 0 }, 2: {}, 3: { 4: "?" }, 4: { 0: 0 }, 5: { 3: 0 }, 6: { 5: 0, 1: 0 }, 7: {}, 8: { 1: "?" }, 9: { 2: 1 }, 10: { 3: 1 },
};
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function dayOf(n) {
  let spec = HAND[n];
  if (!spec) {
    const r = rng(n * 9973 + 17);
    spec = {};
    if (r() >= 0.3) {
      const unk = r() < 0.3 ? Math.floor(r() * 6) : -1;
      for (let i = 0; i < 6; i++) {
        if (i === unk) spec[i] = "?";
        else if (r() >= 0.72) spec[i] = Math.floor(r() * F[i][2].length);
      }
      if (!Object.keys(spec).length) spec[Math.floor(r() * 6)] = 0;
    }
  }
  return F.map(([name, ok, bad], i) => {
    const v = spec[i];
    if (v === "?") return { i, name, text: "не удалось установить", bad: true, unk: true };
    if (v === undefined) return { i, name, text: ok, bad: false };
    return { i, name, text: bad[v], bad: true, kind: v };
  });
}
const EM = [
  { id: "e1", q: "Пропало видео, а управление есть", opts: [["a", "Не дёргать стики; наблюдатель, проверенный Angle; высота — только при свободном безопасном пространстве"], ["b", "Сразу дизарм, где бы ни был"], ["c", "Полный газ и крутить стиками, искать картинку"]], why: "Angle выравнивает наклон, но не обнаруживает препятствия. Высоту меняют только в подтверждённом свободном безопасном пространстве, по подсказкам наблюдателя и отработанной процедуре." },
  { id: "e2", q: "Отказал мотор у квадрокоптера", opts: [["b", "Лететь домой на трёх моторах"], ["a", "Сразу дизарм, предупредить людей, запомнить место"], ["c", "Включить турбо-режим"]], why: "На трёх моторах квадрокоптер не летит: дизарм, чтобы винты не крутились при падении." },
];

export function judge(s) {
  const day = dayOf(Number(s.day));
  const bad = day.filter((f) => f.bad);
  const allOk = !bad.length, hasUnk = bad.some((f) => f.unk);
  const right = s.dec ? (s.dec === "go") === allOk : null;
  const emergOk = EM.every((e) => s[e.id] === "a");
  return { day, bad, allOk, hasUnk, right, emergOk };
}

export const meta = {
  id: "preflight",
  title: "Перед вылетом",
  hint: "День и решение — справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "После решения пункты подсвечиваются: зелёный круг — в порядке, красный — причина отложить" },
    { mark: "raised", label: "Зона полётов, площадки, пилот и наблюдатель, ветроуказатель, столик с дроном, табличка разрешения" },
    { mark: "edge", label: "Туман с «?» — этот пункт не удалось установить" },
  ],
  caption: "Перед каждым вылетом проверяют шесть пунктов: люди, площадка, погода, оборудование, правила и ты сам. Хватает одного плохого пункта, чтобы отложить. «Не удалось установить» — тоже повод отложить, а не угадывать. При аварии порядок один: люди → обстановка → аппарат.",
  aria: "Справа: номер дня, решение «летим» или «откладываем» и два аварийных вопроса.",
  missions: [
    {
      id: "streak", look: [], touch: ["dec", "day"], see: "все шесть пунктов на поле",
      text: "Прими 5 правильных решений подряд (решил — переходи к следующему дню)",
      check: (f) => f.streak >= 5,
    },
    {
      id: "allok", look: ["people", "site", "weather"], touch: ["day", "dec=go"], see: "день, где всё в порядке",
      text: "Распознай день, когда можно лететь (всё в порядке)",
      check: (f, s) => f.right === true && s.dec === "go",
    },
    {
      id: "unknown", look: ["rules"], touch: ["day", "dec=nogo"], see: "туман с вопросом над одним из пунктов",
      text: "Правильно реши, когда что-то «не удалось установить»",
      check: (f, s) => f.right === true && s.dec === "nogo" && f.hasUnk,
    },
    {
      id: "emerg", look: ["card"], touch: ["e1", "e2"], see: "аварийную карточку на столике",
      text: "Ответь правильно на 2 аварийных вопроса",
      check: (f) => f.emergOk,
      feedback: (f, s) => EM.filter((e) => s[e.id] && s[e.id] !== "a").map((e) => `«${e.q}»: не так. ${e.why}`).join(" "),
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [POLES[0][0], POLES[0][1], 58], [SOCK[0], SOCK[1], 66], [0, 0, 80]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;

function person(S, P, x, y, { tone = "hi", h = 30 } = {}) {
  S.cyl(x, y, 4.2, 0, h - 8, { tone: "mid" }, { steps: 18 });
  S.solid(G.sphereOf([x, y, h - 3.2], 4, P, { steps: 20 }), { tone }, [x, y, h - 3.2]);
  return [x, y, h];
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const J = judge(state);
  const D = J.day;
  const has = (i, kind) => D[i].bad && !D[i].unk && D[i].kind === kind;
  basePlate(S, PLATE);
  labelPlate(S, { x: 64, y: -104, w: 22, d: 24, r: 1.5 });

  // ── Площадка, зона, запасная площадка ──
  S.group = "site";
  S.raw(-5e8, `<path class="pf-zone" d="${k.ring(PAD[0], PAD[1], ZONE, 0, P, 72)}"/>`, { layer: 0.2 });
  S.box({ x: PAD[0] - 15, y: PAD[1] - 15, w: 30, d: 30, r: 15 }, 0, 1, { tone: "hi" }, { steps: 10, layer: 0.3 });
  S.raw(-4.8e8, `<path class="pf-h" d="${k.lineOnTop([PAD[0] - 5, PAD[1] + 4], [PAD[0] + 5, PAD[1] + 4], 1.05, P)}${k.lineOnTop([PAD[0] - 5, PAD[1] - 4], [PAD[0] + 5, PAD[1] - 4], 1.05, P)}${k.lineOnTop([PAD[0], PAD[1] + 4], [PAD[0], PAD[1] - 4], 1.05, P)}"/>`, { layer: 0.35 });
  if (!has(1, 1)) S.box({ x: SPARE[0] - 8, y: SPARE[1] - 8, w: 16, d: 16, r: 8 }, 0, 0.8, { tone: "mid" }, { steps: 8, layer: 0.3 });
  else for (const [tx, ty] of [[SPARE[0] - 4, SPARE[1] + 2], [SPARE[0] + 5, SPARE[1] - 4]]) {
    S.cyl(tx, ty, 1.2, 0, 8, { tone: "mid", crease: "none" });
    S.solid(G.sphereOf([tx, ty, 13], 6, P, { steps: 20 }), { tone: "mid" }, [tx, ty, 13]);
  }
  if (has(1, 0)) {
    for (const [px, py] of POLES) S.tube([[px, py, 0], [px, py, 56]], 1.2, { tone: "mid", maxLength: 30 });
    for (const dz of [52, 55]) S.raw([POLES[0][0], 0, dz], `<path class="pf-wire" d="M${at([POLES[0][0], POLES[0][1], dz]).join(" ")}Q${at([POLES[0][0], 0, dz - 10]).join(" ")} ${at([POLES[1][0], POLES[1][1], dz]).join(" ")}"/>`, { bias: 30 });
  }

  // ── Люди: посторонние в зоне, наблюдатель ──
  S.group = "people";
  if (has(0, 0)) { person(S, P, PAD[0] + 12, PAD[1] + 28, { h: 28 }); person(S, P, PAD[0] + 26, PAD[1] + 14, { h: 22 }); }
  if (!has(0, 1)) person(S, P, OBS[0], OBS[1], { h: 29 });

  // ── Пилот с пультом ──
  S.group = "pilot";
  const head = person(S, P, PILOT[0], PILOT[1], { h: 31 });
  S.box({ x: PILOT[0] - 8, y: PILOT[1] - 7, w: 5, d: 14, r: 2 }, 18, 4, { tone: "hi" }, { steps: 2, bias: 1 });
  if (has(5, 1)) { S.tube([[PILOT[0] + 12, PILOT[1] - 4, 0], [PILOT[0] + 12, PILOT[1] - 4, 14]], 0.5, { tone: "mid" }); S.raw([PILOT[0] + 12, PILOT[1] - 4, 18], `<g data-part="clock"></g>`, { bias: 4 }); }

  // ── Погода: ветроуказатель, облако с дождём или снегом ──
  S.group = "weather";
  S.tube([[SOCK[0], SOCK[1], 0], [SOCK[0], SOCK[1], 60]], 1.1, { tone: "mid", maxLength: 30 });
  S.raw([SOCK[0], SOCK[1], 60], `<g data-part="sock"></g>`, { bias: 6 });
  if (has(2, 1) || has(2, 2)) {
    for (const [dx, dy, r] of [[0, 0, 8], [6, -8, 7], [-6, 6, 6.4], [2, 10, 5.6]]) S.solid(G.sphereOf([SOCK[0] + 20 + dx, SOCK[1] + 40 + dy, 66], r, P, { steps: 24 }), { tone: "mid" }, [SOCK[0] + 20 + dx, SOCK[1] + 40 + dy, 66], { bias: 40 });
  }
  if (has(2, 2)) { S.cyl(SOCK[0] + 12, SOCK[1] + 6, 1.4, 0, 14, { tone: "hi" }); S.cyl(SOCK[0] + 12, SOCK[1] + 6, 2.2, 0, 2.2, { tone: "hi", lit: true }); }

  // ── Столик: дрон, батарея (вздутая?), бирка Failsafe ──
  S.group = "gear";
  for (const [lx, ly] of k.corners(TABLE, 2)) S.box({ x: lx - 1, y: ly - 1, w: 2, d: 2, r: 0.4 }, 0, 12, { tone: "mid" }, { steps: 2 });
  S.box({ ...TABLE, r: 1.5 }, 12, 2, { tone: "hi" }, { bevel: 0.3 });
  const dc = [TABLE.x + 13, TABLE.y + 12];
  S.cyl(dc[0], dc[1], 4.4, 14, 3, { tone: "hi", crease: "lo" });
  for (const [dx, dy] of [[6, 6], [6, -6], [-6, 6], [-6, -6]]) { S.tube([[dc[0], dc[1], 15.5], [dc[0] + dx, dc[1] + dy, 15.5]], 0.8, { tone: "mid" }); S.cyl(dc[0] + dx, dc[1] + dy, 2.2, 14, 3, { tone: "hi" }); }
  const bat = { x: TABLE.x + 7, y: TABLE.y + 24, w: 12, d: 10, r: has(3, 0) ? 4.8 : 1.4 };
  S.box(bat, 14, has(3, 0) ? 7.5 : 5, { tone: "hi", crease: has(3, 0) ? "red" : "lo" }, { bevel: has(3, 0) ? 1.6 : 0.4, steps: has(3, 0) ? 10 : 3 });
  if (has(3, 1)) {
    S.tube([[dc[0] + 4, dc[1] + 2, 16], [dc[0] + 4, dc[1] + 10, 24]], 0.3, { tone: "mid" });
    const tf = k.sideMatrix([dc[0] + 4, dc[1] + 14], 30, P, "right");
    S.raw([dc[0] + 4.2, dc[1] + 10, 26], `<g transform="${tf}"><rect x="0" y="0" width="12" height="6" rx="0.8" class="pf-tag"/>${txt(6, 4.3, "FS ?", "pf-tagt", "middle")}</g>`, { bias: 4 });
  }
  // Аварийная карточка лежит на столике.
  S.group = "card";
  const card = { x: TABLE.x + 2, y: TABLE.y + 2, w: 20, d: 8 };
  S.box({ ...card, r: 0.6 }, 14, 0.4, { tone: "hi" }, { steps: 2 });
  const cf = k.topMatrix([card.x + 1.2, card.y + card.d - 1], 14.45, P, "y");
  const em = EM.map((e) => (state[e.id] ? (state[e.id] === "a" ? "✓" : "✗") : "?")).join("  ");
  S.raw([card.x + card.w / 2, card.y + card.d / 2, 14.5], `<g transform="${cf}">${txt(0, 3, "АВАРИЯ", "pf-cardt")}${txt(0, 7.4, em, "pf-cardt")}</g>`, { bias: 1 });

  // ── Табличка разрешения ──
  S.group = "rules";
  for (const yy of [SIGN.y + 8, SIGN.y + SIGN.d - 8]) S.tube([[SIGN.x + 1.5, yy, 0], [SIGN.x + 1.5, yy, SIGN.z0]], 0.8, { tone: "mid" });
  S.box({ ...SIGN, r: 0.8 }, SIGN.z0, SIGN.h, { tone: "hi" }, { bevel: 0.3, ref: [SIGN.x + SIGN.w, SIGN.y + SIGN.d / 2, SIGN.z0 + SIGN.h / 2] });
  const sf = k.sideMatrix([SIGN.x + SIGN.w, SIGN.y + SIGN.d - 3], SIGN.z0 + SIGN.h - 3, P, "right");
  const banned = has(4, 0);
  S.raw([SIGN.x + SIGN.w + 0.3, SIGN.y + SIGN.d / 2, SIGN.z0 + SIGN.h / 2], `<g transform="${sf}">${txt((SIGN.d - 6) / 2, 6.4, "ПОЛЁТЫ", "pf-st", "middle")}${txt((SIGN.d - 6) / 2, 13.6, D[4].unk ? "? ? ?" : banned ? "ЗАПРЕЩЕНЫ" : "РАЗРЕШЕНЫ", `pf-st ${D[4].unk ? "" : banned ? "bad" : "good"}`, "middle")}${D[4].unk ? "" : txt((SIGN.d - 6) / 2, 19.6, banned ? "разрешения нет" : "разрешение есть", "pf-ss", "middle")}</g>`, { bias: 3 });

  // ── Пункты: точки на земле (для колец после решения и тумана «?») ──
  S.group = null;
  const SPOT = [[PAD[0] + 18, PAD[1] + 22, 0], [PAD[0], PAD[1], 0], [SOCK[0] + 10, SOCK[1] + 16, 0], [TABLE.x + 13, TABLE.y + 20, 0], [SIGN.x + 8, SIGN.y + SIGN.d / 2, 0], [PILOT[0], PILOT[1], 0]];
  S.raw(-4e8, `<g data-part="rings"></g>`, { layer: 0.4 });
  S.raw([0, 0, 300], `<g data-part="fx"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: `День ${state.day}: поле перед вылетом — зона полётов, площадки, пилот, погода, столик с дроном и табличка разрешения.`, body: S.svg() });
  const labels = labelsAt(P, D.map((f, i) => [`${f.name}: ${f.text}`, [SPOT[i][0], SPOT[i][1], i === 2 ? 50 : i === 4 ? SIGN.z0 + SIGN.h : 20], f.bad ? "Повод отложить вылет." : "В порядке."]));
  // После решения номера пунктов на сцене окрашиваются: красный — причина отложить, зелёный — в порядке.
  if (state.dec) labels.forEach((l, i) => (l.tone = D[i].bad ? "bad" : "ok"));
  return { svg, P, labels, J, live: { spots: SPOT, sock: [SOCK[0], SOCK[1], 60], head: at([head[0], head[1], head[2] + 6]), clock: at([PILOT[0] + 12, PILOT[1] - 4, 18]), cloud: [SOCK[0] + 20, SOCK[1] + 40, 60] }, parts: S.count() };
}

export const defaults = { day: 1, dec: "", e1: "", e2: "", streak: 0, scored: 0 };
export const controls = [
  { id: "day", label: "День", type: "range", min: 1, max: 40, step: 1, fmt: (v) => `№ ${v}`, rebuild: true, resets: ["dec"] },
  { id: "dec", label: "Решение", type: "seg", options: [["", "—"], ["go", "✈ Летим"], ["nogo", "⏸ Откладываем"]], rebuild: true },
  ...EM.map((e) => ({ id: e.id, label: `Авария: ${e.q}`, type: "select", options: [["", "— выбери —"], ...e.opts], rebuild: true })),
];
export const tour = [
  { at: 0, set: { day: 1 } },
  { at: 3, set: { day: 2 } },
  { at: 6, set: { day: 3 } },
  { at: 9, set: { day: 4 } },
];

export function controller(root, built, state) {
  const P = built.P, J = built.J;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const ringsEl = q("rings"), fxEl = q("fx"), sockEl = q("sock"), clockEl = q("clock");
  const sim = { t: 0 };
  // Серия: засчитываем только первое решение за день.
  if (state.dec && Number(state.scored) !== Number(state.day)) {
    state.streak = J.right ? Number(state.streak || 0) + 1 : 0;
    state.scored = Number(state.day);
  }
  const live = built.live;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      const D = J.day;
      // Кольца после решения.
      let r = "";
      // Плохой пункт — красное кольцо и второе, пульсирующее вокруг: его видно и на телефоне.
      if (st.dec) D.forEach((f, i) => {
        const [x, y] = live.spots[i];
        r += `<path class="pf-ring ${f.bad ? "bad" : "ok"}" d="${k.ring(x, y, f.bad ? 13 : 11, 0.2, P, 40)}"/>`;
        if (f.bad) {
          const ph = calm ? 0.5 : (sim.t * 0.9) % 1;
          r += `<path class="pf-ring bad pulse" style="opacity:${(0.75 * (1 - ph)).toFixed(2)}" d="${k.ring(x, y, 14 + ph * 14, 0.2, P, 48)}"/>`;
        }
      });
      ringsEl.innerHTML = r;
      // Ветроуказатель: обвис или полощется на ветру.
      const windy = D[2].bad && D[2].kind === 0;
      const [sx, sy, sz] = live.sock;
      const flap = windy ? Math.sin(sim.t * 9) * 1.2 : 0;
      const pts = [0, 1, 2, 3].map((j) => windy ? [sx + 2 + j * 0.8, sy + 2 + j * 8, sz - 1.5 - j * 0.6 + (j ? flap * (j / 3) * 2 : 0)] : [sx + 1.4, sy + 1.6 + j * 0.8, sz - 2 - j * 6.4]);
      let sock = "";
      for (let j = 0; j < 3; j++) sock += `<path class="pf-sock${j % 2 ? " w" : ""}" style="stroke-width:${(6 - j * 1.4).toFixed(1)}" d="${k.segment(pts[j], pts[j + 1], P)}"/>`;
      sockEl.innerHTML = sock;
      // Эффекты: дождь, снег, «Zz», часы, туман «?».
      let fx = "";
      const [cx, cy, cz] = live.cloud;
      if (D[2].bad && (D[2].kind === 1 || D[2].kind === 2)) for (let i = 0; i < 14; i++) {
        const ph = calm ? i / 14 : (sim.t * (D[2].kind === 1 ? 1.2 : 0.4) + i / 14) % 1;
        const x = cx - 14 + ((i * 37) % 28), y = cy - 12 + ((i * 53) % 26), z = cz - ph * 56;
        const a = k.iso([x, y, z], P);
        fx += D[2].kind === 1 ? `<path class="pf-rain" d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}l-1 4"/>` : `<text x="${a[0].toFixed(1)}" y="${a[1].toFixed(1)}" class="pf-snow">❄</text>`;
      }
      if (D[5].bad && !D[5].unk && D[5].kind === 0) { const [hx, hy] = live.head; const bob = calm ? 0 : Math.sin(sim.t * 2) * 1.5; fx += `<text x="${(hx + 6).toFixed(1)}" y="${(hy - 2 + bob).toFixed(1)}" class="pf-zz">Z z</text>`; }
      D.forEach((f, i) => { if (!f.unk) return; const [x, y] = live.spots[i]; const a = k.iso([x, y, i === 2 ? 40 : 18], P); fx += `<ellipse cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" rx="26" ry="14" class="pf-fog"/><text x="${a[0].toFixed(1)}" y="${(a[1] + 6).toFixed(1)}" class="pf-q" text-anchor="middle">?</text>`; });
      fxEl.innerHTML = fx;
      if (clockEl) { const [ox, oy] = live.clock; const a = calm ? 0 : sim.t * 2; clockEl.innerHTML = `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="5" class="pf-clock"/><path class="pf-hand" d="M${ox.toFixed(1)} ${oy.toFixed(1)}l${(Math.sin(a) * 3.6).toFixed(1)} ${(-Math.cos(a) * 3.6).toFixed(1)}M${ox.toFixed(1)} ${oy.toFixed(1)}l0 -2.6"/>`; }
      return true;
    },
    facts() {
      return { right: J.right, allOk: J.allOk, hasUnk: J.hasUnk, streak: Number(state.streak || 0), emergOk: J.emergOk };
    },
    readout() {
      // После решения — причины отложить отдельными пунктами (✗ — красная плашка на телефоне).
      const why = state.dec ? (J.allOk ? " · ✓ всё в порядке" : J.bad.map((f) => ` · ✗ ${f.unk ? `${f.name.toLowerCase()}: не установлено` : f.text}`).join("")) : "";
      if (!state.dec) return `День ${state.day} · реши: летим или откладываем · серия ${state.streak || 0}`;
      return `${J.right ? "✓ верно" : "✗ неверно"}${why} · День ${state.day} · серия ${state.streak || 0}`;
    },
    // Камера на телефоне после решения подъезжает к плохим пунктам (все в кадре), если они есть.
    follow() {
      if (!state.dec || J.allOk) return null;
      const pts = J.bad.map((f) => { const [x, y] = live.spots[f.i]; return k.iso([x, y, 14], P); });
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      return [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, Math.max(1, Math.min(1.8, W / (w + 220), H / (h + 160)))];
    },
    metrics() {
      return [
        ["Пунктов в порядке", `${6 - J.bad.length} из 6`, ""],
        ["Решение", state.dec === "go" ? "летим" : state.dec === "nogo" ? "откладываем" : "—", ""],
        ["Серия правильных", `${state.streak || 0}`, "нужно 5"],
        ["Аварийные вопросы", `${EM.filter((e) => state[e.id] === "a").length} из 2`, ""],
      ];
    },
    note() {
      const bad = J.bad;
      if (!state.dec) return "Осмотри поле: люди, площадка, погода, столик с оборудованием, табличка, пилот. Хватает одного плохого пункта, чтобы отложить. Нажимай номера на картинке или строки в списке «Что на столе» — так прочитаешь все пункты.";
      if (J.right) return J.allOk ? "<b>Верно!</b> Все шесть пунктов в порядке — можно лететь. Двигай «День» дальше." : `<b>Верно!</b> Причина отложить: ${bad.map((f) => f.text).join("; ")}.${J.hasUnk ? " «Не удалось установить» — тоже повод отложить, а не угадывать." : ""} Двигай «День» дальше.`;
      return state.dec === "go" ? `<b>Опасно!</b> Ты пропустил: ${bad.map((f) => `${f.name.toLowerCase()} — ${f.text}`).join("; ")}. Хватает одного красного пункта.` : "<b>Зря отложил:</b> всё было в порядке. Но лучше перестраховаться, чем наоборот.";
    },
  };
}
