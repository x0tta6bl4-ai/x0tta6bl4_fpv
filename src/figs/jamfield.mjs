// Fig: полигон помех. Пост оператора (пульт, видеоприёмник, мачта), холм из террас, дрон на телескопической
// стойке, глушилка на дорожке вдоль трассы, ретранслятор на вершине. Линии: управление — к дрону,
// видео — от дрона к оператору. Модель та же, что в книге: сигнал против помехи у входа приёмника.
import { k, G, scene, basePlate, labelPlate, motor, propSvg, fmt, clamp, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -70, y: -132, w: 140, d: 268, r: 8 };
// Профиль трассы в «точках» старой схемы: 1 точка = 20 м по горизонтали и 2 м по высоте.
const GL = 200, OPU = 34, HILLU = 170, KM = 0.02;
const U2Y = (u) => 116 - u * 0.68; // точка трассы → мировая y (зритель смотрит с +x, трасса идёт слева направо)
const ZS = 0.3; // единиц высоты на точку
const LINE_X = 0;

// Модель (из плоской лаборатории): пульт 1 Вт, глушилка 20 мВт, холм −30 дБ, ППРЧ −20 дБ помехи.
export function jamModel(s) {
  const hillY = (u) => GL - s.hill * Math.exp(-(((u - HILLU) / 42) ** 2));
  const blocked = (a, b) => {
    for (let i = 1; i < 40; i++) {
      const u = a[0] + ((b[0] - a[0]) * i) / 40, y = a[1] + ((b[1] - a[1]) * i) / 40;
      if (y > hillY(u) - 2) return true;
    }
    return false;
  };
  const dist = (a, b) => Math.max(0.05, Math.hypot(a[0] - b[0], (a[1] - b[1]) / 10) * KM);
  const op = [OPU, GL];
  const ant = [OPU, GL - 22 - s.mast];
  const dr = [OPU + s.drKm / KM, GL - s.drH / 2];
  const ju = clamp(OPU + s.jamKm / KM, 10, 350);
  const jm = [ju, GL - 6]; // глушилка стоит на дорожке у трассы, на земле
  const top = [HILLU, hillY(HILLU) - 14];
  const link = (tx, rx, ppr) => {
    const sig = 30 - 20 * Math.log10(dist(tx, rx)) - (blocked(tx, rx) ? 30 : 0);
    const jam = 13 - 20 * Math.log10(dist(jm, rx)) - (ppr ? 20 : 0);
    return { ok: sig > -10 && sig - jam > 6, snr: sig - jam, sig, weak: sig <= -10, hill: blocked(tx, rx) };
  };
  const direct = link(ant, dr, s.fhss);
  const relay = s.relay ? (() => { const a = link(ant, top, s.fhss), b = link(top, dr, s.fhss); return { ok: a.ok && b.ok, a, b }; })() : null;
  const ctrlOk = direct.ok || !!(relay && relay.ok);
  const video = link(dr, ant, false);
  const dJop = dist(jm, op), dJdr = dist(jm, dr);
  const hillCut = !ctrlOk && (relay ? relay.a.hill || relay.b.hill : direct.hill);
  return { hillY, op, ant, dr, jm, top, direct, relay, ctrlOk, video, dJop, dJdr, hillCut, blockedDirect: direct.hill };
}

export const meta = {
  id: "jamfield",
  title: "Полигон помех",
  hint: "Глушилка и дрон — ползунки справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Сплошная линия — управление (к дрону), пунктир — видео (от дрона к оператору); красная — связи нет" },
    { mark: "raised", label: "Пост оператора с мачтой, холм, дрон на стойке, глушилка, ретранслятор" },
    { mark: "edge", label: "Кольца — помеха от глушилки" },
  ],
  caption: "Помеха бьёт по приёмнику. Приёмник управления стоит на дроне, приёмник видео — у оператора. Поэтому глушилка у оператора портит видео, а глушилка у дрона отнимает управление. ППРЧ (ELRS прыгает по частотам) спасает от узкой помехи, но не от широкой. Холм закрывает прямую видимость: нужно поднять антенну или поставить ретранслятор на вершину. Высоты на стенде растянуты в 10 раз.",
  aria: "Справа: высота холма, мачта оператора, место глушилки, дальность и высота дрона, ППРЧ и ретранслятор.",
  missions: [
    {
      id: "neartx", look: ["jam", "op"], touch: ["jamKm"], see: "табло поста оператора: управление и видео",
      text: "Поставь глушилку вплотную к пульту. Управление дроном живо?",
      check: (f) => f.dJop < 0.6 && f.ctrlOk,
      predict: { q: "Глушилку поставили вплотную к оператору. Что пропадёт?", options: ["Управление дроном", "Видео в очках, а управление останется", "Ничего"], right: 1 },
      confirm: { q: "Почему управление живо?", options: ["Помеха бьёт по приёмнику, а приёмник управления — на дроне, далеко от глушилки", "Пульт мощнее любой глушилки", "Глушилка не работает на земле"], right: 0, miss: "Посмотри, какая линия покраснела: пунктир видео. Его приёмник — у оператора, рядом с глушилкой." },
      setup: { jamKm: 2.3 },
    },
    {
      id: "kill", look: ["jam", "drone"], touch: ["jamKm"], see: "сплошную линию управления к дрону",
      text: "Теперь подвинь глушилку к дрону, чтобы управление пропало",
      check: (f) => !f.ctrlOk && !f.weak && f.dJdr < f.dJop,
      predict: { q: "Где глушилка опаснее для управления?", options: ["Рядом с оператором", "Рядом с дроном", "Без разницы"], right: 1 },
      setup: { jamKm: 2.3 },
    },
    {
      id: "fhss", look: ["jam", "drone"], touch: ["fhss"], see: "линию управления при глушилке под дроном",
      text: "Глушилка рядом с дроном, но управление работает. Как? (подсказка: ППРЧ)",
      check: (f, s) => s.fhss && f.ctrlOk && f.dJdr < 0.9,
      predict: { q: "Глушилка под дроном, управление пропало. Что поможет?", options: ["ППРЧ — связь прыгает по частотам", "Поднять мощность видео", "Повернуть очки"], right: 0 },
      confirm: { q: "От какой помехи ППРЧ НЕ спасает?", options: ["От широкой, которая забивает весь диапазон", "От узкой на одной частоте", "Спасает от любой"], right: 0, miss: "ППРЧ уходит от помехи на другие частоты. Если забит весь диапазон — уходить некуда." },
      setup: { jamKm: 5.3 },
    },
    {
      id: "relay", look: ["hill", "relay", "drone"], touch: ["relay"], see: "линии через вершину холма",
      text: "Опусти дрон за холм и верни связь ретранслятором",
      check: (f, s) => s.relay && !f.directOk && f.blockedDirect && f.ctrlOk,
      predict: { q: "Дрон опустился за холм, связь пропала. Что вернёт её?", options: ["Ретранслятор на вершине холма", "Включить ППРЧ", "Повернуть антенну пульта"], right: 0 },
      setup: { jamKm: 3.5, drH: 260 },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [LINE_X, U2Y(OPU), 110 * ZS + 60], [LINE_X, U2Y(300), 180 * ZS + 20], [LINE_X, U2Y(HILLU), 130 * ZS + 40]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const W3 = (p) => [LINE_X, U2Y(p[0]), (GL - p[1]) * ZS]; // точка профиля → мир

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = jamModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 34, y: 92, w: 24, d: 34, r: 1.5 });

  // ── Холм: террасы по профилю книги ──
  S.group = "hill";
  if (state.hill > 0) {
    const n = Math.max(1, Math.round(state.hill / 14));
    for (let i = 0; i < n; i++) {
      const h0 = (state.hill * i) / n, h1 = (state.hill * (i + 1)) / n;
      const half = 42 * Math.sqrt(Math.log(state.hill / Math.max(h0, state.hill * 0.04))) * 0.68;
      const plan = { x: LINE_X - half * 0.7, y: U2Y(HILLU) - half, w: half * 1.4, d: half * 2, r: Math.min(half * 0.7, 20) };
      S.box(plan, h0 * ZS, (h1 - h0) * ZS, { tone: i === n - 1 ? "hi" : "mid" }, { steps: 10, bevel: 0.4, ref: [LINE_X, U2Y(HILLU), h0 * ZS + 1], layer: 0.6 + i * 0.01 });
    }
  }

  // ── Пост оператора: стол, пульт, видеоприёмник, мачта, табло ──
  S.group = "op";
  const oy = U2Y(OPU);
  const desk = { x: LINE_X - 16, y: oy - 28, w: 32, d: 56, r: 2 };
  S.box(desk, 0, 8, { tone: "mid", inner: k.lineSvg(k.sideSeam(desk, 3, P, 3), { tone: "faint" }) }, { bevel: 0.5 });
  S.box({ x: LINE_X - 12, y: oy - 2, w: 16, d: 12, r: 3 }, 8, 4, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  for (const gy of [oy + 1, oy + 7]) S.cyl(LINE_X - 4, gy, 1.6, 12, 1, { tone: "mid" });
  S.box({ x: LINE_X - 14, y: oy - 13, w: 12, d: 8, r: 1.4 }, 8, 5, { tone: "mid" }, { bevel: 0.3 });
  const ant = W3(M.ant);
  const mastBase = [LINE_X - 10, oy + 20];
  S.cyl(mastBase[0], mastBase[1], 2.2, 8, 2, { tone: "mid" });
  S.tube([[mastBase[0], mastBase[1], 10], [mastBase[0], mastBase[1], ant[2]]], 1, { tone: "hi", maxLength: 30 });
  S.solid(G.sphereOf([mastBase[0], mastBase[1], ant[2]], 1.8, P), { tone: "hi" }, [mastBase[0], mastBase[1], ant[2]]);
  const pface = k.sideMatrix([desk.x + desk.w, desk.y + desk.d - 3], 7, P, "right");
  S.raw([desk.x + desk.w + 0.3, oy, 4], `<g transform="${pface}"><g data-part="lamps"></g></g>`, { bias: 3 });

  // ── Ретранслятор на вершине ──
  if (state.relay) {
    S.group = "relay";
    const t = W3([HILLU, M.hillY(HILLU)]);
    S.box({ x: t[0] - 6, y: t[1] - 5, w: 12, d: 10, r: 1.4 }, t[2], 6, { tone: "hi", crease: "lo" }, { bevel: 0.3, layer: 0.8 });
    S.tube([[t[0] + 2, t[1], t[2] + 6], [t[0] + 2, t[1], W3(M.top)[2]]], 0.8, { tone: "hi" }, { layer: 0.8 });
    S.solid(G.sphereOf([t[0] + 2, t[1], W3(M.top)[2]], 1.5, P), { tone: "hi" }, [t[0] + 2, t[1], W3(M.top)[2]], { layer: 0.8 });
  }

  // ── Дорожка и глушилка на ней (стоит на земле или на склоне) ──
  S.group = "jam";
  S.box({ x: LINE_X + 26, y: U2Y(350) - 4, w: 6, d: U2Y(10) - U2Y(350) + 8, r: 1 }, 0, 0.8, { tone: "lo", crease: "none" }, { layer: 0.3, steps: 2 });
  const jw = W3(M.jm);
  const jx = LINE_X + 29;
  const jz = Math.max(0.8, jw[2] - 6 * ZS);
  S.box({ x: jx - 7, y: jw[1] - 6, w: 14, d: 12, r: 2 }, jz, 8, { tone: "mid", inner: k.lineSvg(k.sideSeam({ x: jx - 7, y: jw[1] - 6, w: 14, d: 12 }, jz + 3, P, 3), { tone: "faint" }) }, { bevel: 0.4, layer: 0.9 });
  S.tube([[jx + 3, jw[1] + 3, jz + 8], [jx + 3, jw[1] + 3, jz + 22]], 0.7, { tone: "hi" }, { layer: 0.9 });
  S.solid(G.sphereOf([jx + 3, jw[1] + 3, jz + 23.4], 1.6, P), { tone: "hi", lit: true }, [jx + 3, jw[1] + 3, jz + 23.4], { layer: 0.9 });
  if (jz > 1) S.tube([[jx, jw[1], 0.8], [jx, jw[1], jz]], 0.8, { tone: "mid" }, { layer: 0.9 });
  S.raw([jx, jw[1], jz], `<g data-part="rings"></g>`, { layer: 0.95 });

  // ── Дрон на телескопической стойке ──
  S.group = "drone";
  const dw = W3(M.dr);
  S.cyl(LINE_X, dw[1], 6, 0, 2, { tone: "mid" });
  S.tube([[LINE_X, dw[1], 2], [LINE_X, dw[1], dw[2] - 3]], 0.7, { tone: "mid", maxLength: 30 });
  S.box({ x: LINE_X - 5, y: dw[1] - 6, w: 10, d: 12, r: 2 }, dw[2] - 3, 4.5, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  const mot = [[LINE_X + 10, dw[1] + 11], [LINE_X + 10, dw[1] - 11], [LINE_X - 10, dw[1] + 11], [LINE_X - 10, dw[1] - 11]];
  for (const [mx, my] of mot) S.tube([[LINE_X, dw[1], dw[2] - 1], [mx, my, dw[2] - 1]], 1.2, { tone: "mid", maxLength: 20 });
  const props = [];
  mot.forEach(([mx, my], i) => props.push([mx, my, motor(S, mx, my, dw[2] - 2, { r: 3.6, h: 4, ribs: 8 }).top + 1, i]));
  props.forEach(([x, y, z, i]) => S.raw([x, y, z + 6], `<g data-prop="${i}">${propSvg(P, x, y, z, 8, i * 0.7, { blades: 3 })}</g>`, { bias: 20 }));

  S.group = null;
  S.raw([0, 0, 400], `<g data-part="links"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Полигон помех: пост оператора с мачтой, холм, дрон на стойке, глушилка на дорожке и ретранслятор на вершине.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Пост оператора", [LINE_X, oy, 12], "Пульт (передатчик управления) и видеоприёмник. На табло — есть ли управление и видео."],
    ["Мачта (вынос антенны)", [mastBase[0], mastBase[1], ant[2]], "Поднятая антенна видит дальше и выше холма."],
    ["Глушилка", [jx, jw[1], jz + 8], "Шумит на частотах связи. Мешает тому приёмнику, который рядом с ней."],
    ["Дрон", [LINE_X, dw[1], dw[2]], "Приёмник управления — на дроне. Видео он передаёт оператору."],
    state.hill > 0 ? ["Холм", W3([HILLU, GL - state.hill * 0.6]), "Радиоволны этих частот плохо огибают холм: нужна прямая видимость."] : null,
    state.relay ? ["Ретранслятор", W3(M.top), "Видит и оператора, и дрон за холмом — передаёт сигнал дальше."] : null,
  ]);
  return {
    svg, P, labels, model: M,
    live: { ant: at([mastBase[0], mastBase[1], ant[2]]), dr: at([LINE_X, dw[1], dw[2] + 2]), top: at(W3(M.top)), jam: [jx + 3, jw[1] + 3, jz + 1], props },
    parts: S.count(),
  };
}

export const defaults = { hill: 70, mast: 0, jamKm: 2.3, drKm: 5.3, drH: 260, fhss: false, relay: false };
export const controls = [
  { id: "jamKm", label: "Глушилка: расстояние от оператора", type: "range", min: 0, max: 6.2, step: 0.1, fmt: (v) => `${fmt(v, 1)} км`, rebuild: true },
  { id: "drKm", label: "Дрон: расстояние от оператора", type: "range", min: 3.4, max: 6.2, step: 0.1, fmt: (v) => `${fmt(v, 1)} км`, rebuild: true },
  { id: "drH", label: "Дрон: высота", type: "range", min: 16, max: 360, step: 4, fmt: (v) => `${v} м`, rebuild: true },
  { id: "hill", label: "Высота холма", type: "range", min: 0, max: 130, step: 5, fmt: (v) => `${v * 2} м`, rebuild: true },
  { id: "mast", label: "Мачта антенны оператора (вынос вверх)", type: "range", min: 0, max: 60, step: 2, fmt: (v) => `${v * 2} м`, rebuild: true },
  { id: "fhss", label: "ППРЧ: связь прыгает по частотам (как ELRS)", type: "check", rebuild: true },
  { id: "relay", label: "Ретранслятор на вершине холма", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { jamKm: 0.2 } },
  { at: 3, set: { jamKm: 5.3 } },
  { at: 6, set: { fhss: true } },
  { at: 9, set: { fhss: false, jamKm: 2.3 } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const linksEl = q("links"), ringEl = q("rings"), lampsEl = q("lamps");
  const propEls = [...root.querySelectorAll("[data-prop]")];
  const sim = { t: 0, spin: 0 };
  const M = built.model;
  const seg = (a, b, ok, cls) => `<path class="${cls} ${ok ? "ok" : "bad"}" d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}"/>`;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      let l = "";
      if (M.relay) l += seg(L.ant, L.top, M.relay.a.ok, "jf-ctl") + seg(L.top, L.dr, M.relay.b.ok, "jf-ctl");
      else l += seg(L.ant, L.dr, M.direct.ok, "jf-ctl");
      l += seg([L.dr[0], L.dr[1] + 4], [L.ant[0] + 4, L.ant[1] + 6], M.video.ok, "jf-vid");
      // Бегущие «пакеты» по живым линиям.
      if (!calm) {
        const dot = (a, b, u) => `<circle class="jf-bit" cx="${(a[0] + (b[0] - a[0]) * u).toFixed(1)}" cy="${(a[1] + (b[1] - a[1]) * u).toFixed(1)}" r="1.6"/>`;
        const u = (sim.t * 0.5) % 1;
        if (M.relay) { if (M.relay.a.ok) l += dot(L.ant, L.top, u); if (M.relay.b.ok) l += dot(L.top, L.dr, u); } else if (M.direct.ok) l += dot(L.ant, L.dr, u);
      }
      linksEl.innerHTML = l;
      let r = "";
      for (let i = 0; i < 3; i++) {
        const ph = calm ? i / 3 : (sim.t * 0.6 + i / 3) % 1;
        r += `<path class="iso-line jam-ring" style="opacity:${((1 - ph) * 0.8).toFixed(2)}" d="${k.ring(L.jam[0], L.jam[1], 8 + ph * 34, L.jam[2], P, 48)}"/>`;
      }
      ringEl.innerHTML = r;
      lampsEl.innerHTML = `<rect x="0" y="0" width="24" height="5.4" rx="1.4" class="jf-lamp ${M.ctrlOk ? "ok" : "bad"}"/>${txt(12, 4, `УПР ${M.ctrlOk ? "есть" : "нет"}`, "jf-lt", "middle")}<rect x="26" y="0" width="24" height="5.4" rx="1.4" class="jf-lamp ${M.video.ok ? "ok" : "bad"}"/>${txt(38, 4, `ВИДЕО ${M.video.ok ? "есть" : "нет"}`, "jf-lt", "middle")}`;
      if (!calm) sim.spin += dt * 1.2;
      propEls.forEach((el) => {
        const [x, y, z, i] = L.props[Number(el.dataset.prop)];
        el.innerHTML = propSvg(P, x, y, z, 8, i * 0.7 + sim.spin * (i === 0 || i === 3 ? 1 : -1), { blades: 3 });
      });
      return true;
    },
    facts() {
      return { ctrlOk: M.ctrlOk, videoOk: M.video.ok, dJop: M.dJop, dJdr: M.dJdr, weak: M.direct.weak, directOk: M.direct.ok, blockedDirect: M.blockedDirect };
    },
    readout() {
      return `управление: ${M.ctrlOk ? "есть" : "нет"} · видео: ${M.video.ok ? "есть" : "нет"} · глушилка в ${fmt(M.dJdr, 1)} км от дрона`;
    },
    metrics() {
      const snr = M.relay ? Math.min(M.relay.a.snr, M.relay.b.snr) : M.direct.snr;
      return [
        ["Управление (у дрона)", M.ctrlOk ? "есть" : "нет", ""],
        ["Сигнал над помехой", `${fmt(snr)} дБ (нужно > 6)`, "оценка"],
        ["Видео (у оператора)", M.video.ok ? "есть" : "нет", ""],
        ["Глушилка: до оператора · до дрона", `${fmt(M.dJop, 1)} · ${fmt(M.dJdr, 1)} км`, ""],
      ];
    },
    note() {
      if (M.hillCut && !M.relay) return "<b>Холм закрывает дрон:</b> радиоволны этих частот плохо огибают препятствия. Подними антенну (мачта) или поставь ретранслятор на вершину.";
      if (M.hillCut) return "<b>Даже с вершины дрон не виден:</b> склон закрывает путь от ретранслятора. Подними дрон выше или отведи его от склона.";
      if (!M.ctrlOk) return "<b>Глушилка рядом с дроном</b> перекрикивает пульт прямо у приёмника на дроне — управление пропало.";
      if (M.dJop < 0.6) return `<b>Глушилка у оператора, а управление живо:</b> помеха действует на ПРИЁМНИК, а приёмник управления — на дроне. Зато видео ${M.video.ok ? "держится" : "пропало"}: его приёмник — у оператора.`;
      if (state.fhss && M.dJdr < 0.9) return "<b>ППРЧ:</b> связь всё время прыгает по частотам, и узкая помеха попадает лишь изредка. Против широкой глушилки, которая забивает весь диапазон, ППРЧ не помогает.";
      return "Сплошная линия — управление (к дрону), пунктир — видео (от дрона к оператору). Подвигай глушилку вдоль дорожки.";
    },
  };
}
