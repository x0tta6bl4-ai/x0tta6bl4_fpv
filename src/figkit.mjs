// Общие детали стендов: сцена с порядком художника, плита на ножках, линейка,
// табличка, винты, циферблаты, ручки, платы, моторы, винты-пропеллеры, провода.
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";

export { k, G };
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Сцена: элементы с ключом глубины; layer поднимает целый слой (основание = 0).
export function scene(P) {
  const items = [];
  const V = G.viewOf(P);
  const depth = (p) => G.dot3(p, V);
  const S = {
    P,
    at: (p) => k.iso(p, P),
    depth,
    group: null,
    comp: null,
    put(ref, svg, { bias = 0, layer = 1, group = S.group, comp = S.comp } = {}) {
      if (!svg) return;
      const key = (typeof ref === "number" ? ref : depth(ref)) + bias + layer * 1e5;
      items.push({ key, svg, order: items.length, group, comp });
    },
    solid(paths, style, ref, opts) {
      S.put(ref, k.solidSvg(paths, style), opts);
    },
    box(plan, z, h, style = {}, opts = {}) {
      const steps = opts.steps ?? (plan.r > 3 ? 6 : 3);
      const paths = k.slabOf(plan, z, h, P, steps, opts.bevel ?? (Math.min(plan.w, plan.d) > 10 ? 0.6 : 0));
      S.put(opts.ref ?? [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], k.solidSvg(paths, style), opts);
      return paths;
    },
    cyl(cx, cy, r, z, h, style = {}, opts = {}) {
      const steps = opts.steps ?? (r > 12 ? 56 : r > 5 ? 32 : 18);
      S.put(opts.ref ?? [cx, cy, z + h / 2], k.solidSvg(k.cylinder(cx, cy, r, z, h, P, steps, opts.bevel ?? 0), style), opts);
    },
    line(d, style, ref, opts) {
      S.put(ref, k.lineSvg(d, style), opts);
    },
    dots(points3, style, ref, opts) {
      if (!points3.length) return;
      S.put(ref ?? points3[0], k.dotsSvg(points3.map((p) => k.iso(p, P)), style), opts);
    },
    // Провод/кабель: каждый кусок сортируется по своей глубине.
    tube(points, r, { tone = "mid", maxLength = 14, gaps = [], caps = true, rings = null, bendR = 0 } = {}, opts = {}) {
      const route = bendR ? G.fillet(points, bendR, 7, { P, tube: r }) : points;
      const pieces = tubePieces(route, r, P, { maxLength, gaps, caps, rings });
      for (const piece of pieces) S.put(piece.mid, tubeSvg(piece, { tone }), opts);
      return route;
    },
    raw(ref, svg, opts) {
      S.put(ref, svg, opts);
    },
    svg() {
      return items
        .sort((a, b) => a.key - b.key || a.order - b.order)
        .map((i) => (i.group ? `<g class="it" data-g="${i.group}" data-k="${(i.key - 1e5).toFixed(2)}"${i.comp ? ` data-c="${i.comp}" data-pick="${i.comp}"` : ""}>${i.svg}</g>` : i.svg))
        .join("");
    },
    count: () => items.length,
  };
  return S;
}

export const byDepth = (P, points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Плита на ножках: ореол, ножки, плита, канавка, винты по углам.
export function basePlate(S, PLATE, { h = 12, foot = 5, inset = 22 } = {}) {
  const P = S.P;
  const z0 = -h - foot;
  S.put(-1e9, `<path class="iso-halo" d="${k.haloOf(PLATE, z0, h, P)}"/>`, { layer: 0 });
  for (const [x, y] of byDepth(P, k.corners(PLATE, inset))) {
    S.put(-9e8 + k.depthOf([x, y, 0], P), k.solidSvg(k.cylinder(x, y, 7, z0, 1.6, P, 28), { tone: "lo" }), { layer: 0 });
    S.put(-8.9e8 + k.depthOf([x, y, 0], P), k.solidSvg(k.cylinder(x, y, 5.4, z0 + 1.6, foot - 1.6, P, 28), { tone: "mid" }), { layer: 0 });
  }
  S.put(-8e8, k.solidSvg(k.slabOf(PLATE, -h, h, P, 8, 1.6), { tone: "mid" }), { layer: 0 });
  S.put(-7.9e8, k.lineSvg(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }), { layer: 0 });
  const screws = k.corners(PLATE, 10);
  S.put(-7.8e8, k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }) + k.dotsSvg(screws.map(([x, y]) => k.iso([x, y, 0], P)), { size: 0.5 }), { layer: 0 });
}

// Линейка, врезанная в плиту: риски растут от кромки полосы.
export function rulerStrip(S, strip, { step = 4, every = 5 } = {}) {
  const P = S.P;
  S.put(-7e8, k.solidSvg(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }), { layer: 0 });
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, step, every, strip.y + 0.8, 0.6, [2, 3.6], P);
  S.put(-6.9e8, k.lineSvg(t.minor, { tone: "lo" }) + k.lineSvg(t.major, { tone: "mid" }) + k.dotsSvg([k.iso([strip.x + 2, strip.y + strip.d / 2, 0.6], P), k.iso([strip.x + strip.w - 2, strip.y + strip.d / 2, 0.6], P)], { size: 0.45 }), { layer: 0 });
}

// Табличка с тремя строками «текста» и двумя винтами.
// Подписи деталей для оболочки стенда: [текст, [x, y, z]] → точка на картинке.
export function labelsAt(P, list) {
  return list.filter(Boolean).map(([text, p, info]) => ({ text, at: k.iso(p, P), info }));
}
export function labelPlate(S, plan, text = "") {
  const P = S.P;
  S.put(-6e8, k.solidSvg(k.slabOf(plan, 0, 0.8, P, 4), { tone: "mid" }), { layer: 0 });
  const lines = [0.32, 0.5, 0.68].map((f, i) => k.lineOnTop([plan.x + 4, plan.y + plan.d * f], [plan.x + plan.w * [0.78, 0.62, 0.7][i], plan.y + plan.d * f], 0.8, P)).join("");
  let svg = k.lineSvg(k.planOutline(k.insetPlan(plan, 1.6), 0.8, P, 4), { tone: "faint" }) + k.lineSvg(lines, { tone: "lo", free: true });
  svg += k.dotsSvg([k.iso([plan.x + plan.w - 3.4, plan.y + 3.4, 0.8], P), k.iso([plan.x + plan.w - 3.4, plan.y + plan.d - 3.4, 0.8], P)], { size: 0.42 });
  if (text) svg += k.faceTextSvg(k.topMatrix([plan.x + 4, plan.y + plan.d * 0.22], 0.8, P, "x"), text, { size: 2.2, tone: "mid" });
  S.put(-5.9e8, svg, { layer: 0 });
}

export function screwDots(S, points3, ref, opts) {
  S.dots(points3, { size: 0.45 }, ref, opts);
}

// Циферблат «лицом вверх». Возвращает функцию стрелки.
export function dialGauge(S, cx, cy, z, R, { h = 9, ticks = 50, every = 5, span = TAU, from = 0, tone = "hi", ref, layer = 1, face } = {}) {
  const P = S.P;
  const top = z + h;
  let svg = k.solidSvg(k.cylinder(cx, cy, R, z, h, P, 64, 0.8), { tone, crease: "lo" });
  svg += k.lineSvg(k.knurl(cx, cy, R, top - 3.2, top, 84, P, 0.3), { tone: "lo" });
  svg += k.lineSvg(k.sideArc(cx, cy, R, top - 3.2, P, 40), { tone: "faint" });
  svg += k.lineSvg(k.ring(cx, cy, R - 2, top, P, 64), { tone: "lo" });
  const t = k.radialTicks(cx, cy, R - 2.6, ticks, every, top, [R * 0.06, R * 0.13], P, from, span);
  svg += k.lineSvg(t.minor, { tone: "lo" }) + k.lineSvg(t.major, { tone: "mid" });
  svg += k.lineSvg(k.ring(cx, cy, 1.5, top, P, 16), { tone: "mid" });
  if (face) svg += k.faceTextSvg(k.topMatrix([cx, cy + R * 0.42], top, P, "x"), face, { size: Math.max(1.8, R * 0.11), tone: "lo", anchor: "middle" });
  S.put(ref ?? [cx, cy, z + h / 2], svg, { layer });
  const needle = (turn) => {
    const a = from + turn * span;
    return k.lineOnTop([cx - Math.sin(a) * 3, cy + Math.cos(a) * 3], [cx + Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4)], top + 0.2, P);
  };
  return { needle, top };
}

// Накатанная ручка с указателем; указатель перестраивается.
export function knob(S, cx, cy, z, r, h, opts = {}) {
  const P = S.P;
  let svg = k.solidSvg(k.cylinder(cx, cy, r + 1.2, z, 1.2, P, 32), { tone: "mid" });
  svg += k.solidSvg(k.cylinder(cx, cy, r, z + 1.2, h, P, 36, 0.5), { tone: opts.tone ?? "mid" });
  svg += k.lineSvg(k.knurl(cx, cy, r, z + 1.2, z + 1.2 + h, 36, P), { tone: "lo" });
  S.put(opts.ref ?? [cx, cy, z + h / 2], svg, opts);
  const top = z + 1.2 + h;
  return { top, pointer: (a) => k.lineOnTop([cx, cy], [cx + Math.sin(a) * (r - 1), cy - Math.cos(a) * (r - 1)], top, P) };
}

// Плата: текстолит, отверстия по углам, мелкие компоненты.
export function pcb(S, plan, z, { t = 1.6, chips = [], holes = true, tone = "mid", pads = [], opts = {} } = {}) {
  const P = S.P;
  let svg = k.solidSvg(k.slabOf(plan, z, t, P, 3, 0.4), { tone });
  const top = z + t;
  if (holes) {
    const hs = k.corners(plan, 3.2);
    svg += k.lineSvg(hs.map(([x, y]) => k.ring(x, y, 1.6, top, P, 14)).join(""), { tone: "lo" });
    svg += k.dotsSvg(hs.map(([x, y]) => k.iso([x, y, top], P)), { size: 0.38, tone: "lo" });
  }
  if (pads.length) svg += k.lineSvg(pads.map(([x, y, w = 2.4, d = 1.6]) => k.planOutline({ x: x - w / 2, y: y - d / 2, w, d, r: 0.3 }, top, P, 2)).join(""), { tone: "mid" });
  S.put(opts.ref ?? [plan.x + plan.w / 2, plan.y + plan.d / 2, z], svg, opts);
  for (const c of chips) {
    const cp = { x: c.x - c.w / 2, y: c.y - c.d / 2, w: c.w, d: c.d, r: c.r ?? 0.6 };
    let s = k.solidSvg(k.slabOf(cp, top, c.h ?? 1.2, P, 2, c.w > 6 ? 0.4 : 0), { tone: c.tone ?? "hi", lit: c.lit, crease: "lo" });
    if (c.dot) s += k.dotsSvg([k.iso([cp.x + 1.2, cp.y + 1.2, top + (c.h ?? 1.2)], P)], { size: 0.35, tone: "lo" });
    if (c.legs) {
      const legs = [];
      for (let i = 0; i < c.legs; i++) {
        const f = (i + 0.5) / c.legs;
        legs.push(k.lineOnTop([cp.x + cp.w * f, cp.y + cp.d], [cp.x + cp.w * f, cp.y + cp.d + 0.9], top, P));
        legs.push(k.lineOnTop([cp.x + cp.w, cp.y + cp.d * f], [cp.x + cp.w + 0.9, cp.y + cp.d * f], top, P));
      }
      s += k.lineSvg(legs.join(""), { tone: "mid" });
    }
    S.put(opts.ref ? [opts.ref[0], opts.ref[1], opts.ref[2] + 0.5] : [c.x, c.y, top + 0.5], s, { ...opts, bias: (opts.bias ?? 0) + 0.3 });
  }
  return top;
}

const ZUP = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// Бесколлекторный мотор outrunner на вертикальной оси: основание, колокол с прорезями, вал.
export function motor(S, cx, cy, z, { r = 14, h = 16, lit = false, opts = {}, ribs = 14 } = {}) {
  const P = S.P;
  const F = ZUP(cx, cy, z);
  let svg = "";
  svg += k.solidSvg(G.solidOf([[0, r * 0.92], [2.4, r * 0.92], [2.4, r * 0.78], [3.4, r * 0.78]], F, P), { tone: "mid" });
  const bellProfile = [[3.4, r * 0.98], [3.8, r], [h - 2.2, r], [h - 0.8, r * 0.9, 1], [h, r * 0.62, 1], [h, r * 0.3]];
  const bell = G.solidOf(bellProfile, F, P);
  const ribLines = G.ribsOf(F, 6, h - 3.4, r, ribs, P, { fade: [0.05, 0.5], seams: true });
  svg += k.solidSvg(bell, { tone: "hi", lit, inner: k.fadedSvg(ribLines, { tone: "lo" }) + k.lineSvg(G.arcOf(F, 3.8, r, P), { tone: "faint" }) });
  svg += k.solidSvg(G.solidOf([[h, 2.6], [h + 7, 2.6], [h + 7.6, 2.2]], F, P), { tone: "mid" });
  S.put(opts.ref ?? [cx, cy, z + h / 2], svg, opts);
  return { top: z + h };
}

// Лопасти пропеллера в плоскости z: n лопастей, радиус R, угол поворота a.
export function propSvg(P, cx, cy, z, R, a, { blades = 3, chord = 0.16, lit = false, tone = "hi", flip = false } = {}) {
  let svg = "";
  const shape = [[0.12, 0.5], [0.3, 0.9], [0.55, 1], [0.8, 0.88], [0.97, 0.55], [1, 0.1], [0.98, -0.25], [0.8, -0.45], [0.5, -0.55], [0.25, -0.48], [0.12, -0.35]];
  const parts = [];
  for (let b = 0; b < blades; b++) {
    const t = a + (b * TAU) / blades;
    const c = Math.cos(t), s = Math.sin(t);
    const ring = shape.map(([u, v]) => {
      const rr = u * R, w = (flip ? -v : v) * R * chord; // flip — зеркальный винт (для другого направления вращения)
      return [cx + c * rr - s * w, cy + s * rr + c * w];
    });
    const mid = [cx + c * R * 0.5, cy + s * R * 0.5, z];
    parts.push({ d: k.depthOf(mid, P), svg: k.solidSvg(k.extrude(ring, z, 1.1, P, { convex: false }), { tone, lit, crease: "lo" }) });
  }
  parts.sort((p, q) => p.d - q.d);
  svg += parts.map((p) => p.svg).join("");
  svg += k.solidSvg(k.cylinder(cx, cy, R * 0.09 + 2.2, z - 0.6, 3.4, P, 28, 0.4), { tone: "hi", lit });
  svg += k.solidSvg(k.cylinder(cx, cy, 2.2, z + 2.8, 2.6, P, 6), { tone: "mid" });
  return svg;
}

// Призма вдоль произвольной оси (для наклонных деталей).
export function bar(F, w, d, s0, s1, P) {
  return G.prismOf(F, [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], s0, s1, P);
}

// Разъём-колодка на конце провода.
export function plug(S, x, y, z, w, d, h, opts = {}) {
  S.box({ x: x - w / 2, y: y - d / 2, w, d, r: 0.6 }, z, h, { tone: opts.tone ?? "mid" }, { ...opts, steps: 2, bevel: 0 });
}

export function ellipseOnTop(cx, cy, rx, ry, z, P, steps = 72) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return k.onTop(pts, z, P, true);
}

export function fmt(n, digits = 0) {
  if (!Number.isFinite(Number(n))) return "—";
  return Number(n)
    .toFixed(digits)
    .replace(/^-(?=0(\.0*)?$)/, "") // без «−0»
    .replace(".", ",")
    .replace(/^-?\d+/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, " ")) // разряды — только в целой части
    .replace(/^-/, "−");
}
