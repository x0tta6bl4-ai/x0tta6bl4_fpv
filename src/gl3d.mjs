// Маленький 3D-движок на WebGL 1 без библиотек: сетки из простых фигур, свет, вращение пальцем,
// щипок, выбор детали касанием (отдельный проход с цветом-номером детали). Рисует только когда что-то изменилось.
// three.js даже урезанный весит ~500 КБ; для учебных моделей из коробок и цилиндров хватает этого (~10 КБ).

// ── Матрицы 4×4 (по столбцам, как ждёт WebGL) ──
export const M4 = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  t: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
  chain: (...ms) => ms.reduce((a, b) => M4.mul(a, b), M4.id()),
  persp(fovy, asp, n, f) { const k = 1 / Math.tan(fovy / 2); return [k / asp, 0, 0, 0, 0, k, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; },
  look(e, t, u) {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const z = nrm(sub(e, t)), x = nrm(cr(u, z)), y = cr(z, x);
    const d = (a) => -(a[0] * e[0] + a[1] * e[1] + a[2] * e[2]);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, d(x), d(y), d(z), 1];
  },
  apply(m, p, w = 1) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * w, m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * w, m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * w];
  },
};

// ── Сетка: копит вершины, нормали и треугольники; фигуры добавляются с матрицей положения ──
export class Mesh {
  constructor() { this.p = []; this.n = []; this.i = []; }
  push(pos, nrm, idx, m) {
    const base = this.p.length / 3;
    for (let k = 0; k < pos.length; k += 3) {
      this.p.push(...M4.apply(m, [pos[k], pos[k + 1], pos[k + 2]]));
      const v = M4.apply(m, [nrm[k], nrm[k + 1], nrm[k + 2]], 0), l = Math.hypot(...v) || 1;
      this.n.push(v[0] / l, v[1] / l, v[2] / l);
    }
    for (const j of idx) this.i.push(base + j);
    return this;
  }
  // Коробка с центром в начале координат.
  box(sx, sy, sz, m = M4.id()) {
    const P = [], N = [], I = [];
    const F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    const h = [sx / 2, sy / 2, sz / 2];
    for (const [n, u, v] of F) {
      const b = P.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        for (let k = 0; k < 3; k++) P.push((n[k] + a * u[k] + c * v[k]) * h[k]);
        N.push(...n);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return this.push(P, N, I, m);
  }
  // Тело вращения вокруг оси Y по профилю [[r, y], …] (снизу вверх); торцы закрываются, если r на краю > 0.
  lathe(prof, seg = 24, m = M4.id()) {
    const P = [], N = [], I = [];
    for (let j = 0; j < prof.length - 1; j++) {
      const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
      const dy = y1 - y0, dr = r1 - r0, l = Math.hypot(dy, dr) || 1;
      const b = P.length / 3;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        P.push(r0 * c, y0, r0 * sn, r1 * c, y1, r1 * sn);
        N.push((dy / l) * c, -dr / l, (dy / l) * sn, (dy / l) * c, -dr / l, (dy / l) * sn);
      }
      for (let s = 0; s < seg; s++) { const q = b + s * 2; I.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    }
    for (const [end, dir] of [[prof[0], -1], [prof[prof.length - 1], 1]]) {
      if (!end[0]) continue;
      const b = P.length / 3;
      P.push(0, end[1], 0); N.push(0, dir, 0);
      for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2; P.push(end[0] * Math.cos(a), end[1], end[0] * Math.sin(a)); N.push(0, dir, 0); }
      for (let s = 0; s < seg; s++) I.push(b, b + 1 + s, b + 2 + s);
    }
    return this.push(P, N, I, m);
  }
  cyl(r, h, seg = 20, m = M4.id()) { return this.lathe([[r, -h / 2], [r, h / 2]], seg, m); }
  // Трубка от точки a до точки b (провод, антенна).
  tube(a, b, r, seg = 10) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1;
    const yaw = Math.atan2(d[0], d[2]), pitch = Math.acos(Math.max(-1, Math.min(1, d[1] / l)));
    return this.cyl(r, l, seg, M4.chain(M4.t((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), M4.ry(yaw), M4.rx(pitch)));
  }
}

const VS = `attribute vec3 aP;attribute vec3 aN;uniform mat4 uVP;uniform mat4 uM;varying vec3 vN;varying vec3 vW;
void main(){vec4 w=uM*vec4(aP,1.0);vW=w.xyz;vN=(uM*vec4(aN,0.0)).xyz;gl_Position=uVP*w;}`;
const FS = `precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uC;uniform vec3 uHi;uniform float uH;uniform float uDim;
uniform vec3 uEye;uniform vec3 uBg;uniform float uPick;
void main(){if(uPick>0.5){gl_FragColor=vec4(uC,1.0);return;}
vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 L=normalize(vec3(0.45,1.0,0.6));vec3 V=normalize(uEye-vW);
float d=max(dot(n,L),0.0);float f=max(dot(n,normalize(vec3(-0.6,0.2,-0.5))),0.0);float hemi=0.5+0.5*n.y;
float sp=pow(max(dot(n,normalize(L+V)),0.0),28.0);
vec3 c=uC*(0.32+0.18*hemi+0.62*d+0.16*f)+vec3(0.22*sp);
c=mix(c,uHi*(0.55+0.55*d)+vec3(0.25*sp),uH);c=mix(c,uBg,uDim);gl_FragColor=vec4(c,1.0);}`;

// Просмотрщик: canvas, список деталей [{id, mesh, color:[r,g,b] 0..1, model?:()=>M4}], обработчики.
export function createViewer(canvas, { onPick, onView } = {}) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const A = { p: gl.getAttribLocation(prog, "aP"), n: gl.getAttribLocation(prog, "aN") };
  const U = {};
  for (const k of ["uVP", "uM", "uC", "uHi", "uH", "uDim", "uEye", "uBg", "uPick"]) U[k] = gl.getUniformLocation(prog, k);
  const uint = !!gl.getExtension("OES_element_index_uint");
  gl.enable(gl.DEPTH_TEST);

  let parts = [];
  // zoom 1 — модель радиусом radius целиком в кадре при любых пропорциях экрана (узкий телефон тоже).
  const view = { yaw: 0.7, pitch: 0.42, zoom: 1, radius: 13.5, target: [0, 1.5, 0], fov: 0.72, min: 0.45, max: 2.2 };
  const look = { sel: null, hi: [0.2, 0.5, 1], bg: [1, 1, 1], dimOthers: 0.55 };
  let W = 1, H = 1, dirty = true, raf = 0, alive = true, VP = M4.id(), eye = [0, 0, 1];

  function upload(mesh) {
    const big = mesh.p.length / 3 > 65535;
    if (big && !uint) throw new Error("сетка слишком большая для WebGL 1");
    const mk = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
    return { p: mk(gl.ARRAY_BUFFER, new Float32Array(mesh.p)), n: mk(gl.ARRAY_BUFFER, new Float32Array(mesh.n)), i: mk(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(mesh.i) : new Uint16Array(mesh.i)), count: mesh.i.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }
  function setParts(list) {
    for (const p of parts) for (const b of [p.buf.p, p.buf.n, p.buf.i]) gl.deleteBuffer(b);
    parts = list.map((p, k) => ({ ...p, key: k + 1, buf: upload(p.mesh) }));
    invalidate();
  }
  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    W = w; H = h;
    invalidate();
  }
  function camera() {
    const cp = Math.cos(view.pitch), fx = 2 * Math.atan(Math.tan(view.fov / 2) * (W / H));
    const dist = (view.zoom * view.radius) / Math.sin(Math.min(view.fov, fx) / 2);
    eye = [view.target[0] + dist * cp * Math.sin(view.yaw), view.target[1] + dist * Math.sin(view.pitch), view.target[2] + dist * cp * Math.cos(view.yaw)];
    VP = M4.mul(M4.persp(view.fov, W / H, 0.5, 600), M4.look(eye, view.target, [0, 1, 0]));
  }
  function drawAll(pick) {
    gl.viewport(0, 0, W, H);
    if (pick) gl.clearColor(0, 0, 0, 1);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform3fv(U.uBg, look.bg);
    gl.uniform3fv(U.uHi, look.hi);
    gl.uniform1f(U.uPick, pick ? 1 : 0);
    for (const p of parts) {
      if (p.hidden) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf.p); gl.enableVertexAttribArray(A.p); gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf.n); gl.enableVertexAttribArray(A.n); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.buf.i);
      gl.uniformMatrix4fv(U.uM, false, p.model ? p.model() : M4.id());
      const on = look.sel && p.id === look.sel;
      gl.uniform3fv(U.uC, pick ? [p.key / 255, 0, 0] : p.color);
      gl.uniform1f(U.uH, pick ? 0 : on ? 0.55 : 0);
      gl.uniform1f(U.uDim, pick || !look.sel || on ? 0 : look.dimOthers);
      gl.drawElements(gl.TRIANGLES, p.buf.count, p.buf.type, 0);
    }
  }
  function frame() {
    raf = 0;
    if (!alive) return;
    const anim = api.onFrame ? api.onFrame() : false;
    camera();
    drawAll(false);
    dirty = false;
    if (anim) invalidate();
  }
  function invalidate() {
    dirty = true;
    if (!raf && alive) raf = requestAnimationFrame(frame);
  }

  // Выбор касанием: проход с номерами деталей вместо цвета, смотрим окрестность 9×9 пикселей (тонкие антенны).
  let fb = null, fbW = 0, fbH = 0, tex = null, rb = null;
  function pickAt(cx, cy) {
    if (!fb || fbW !== W || fbH !== H) {
      if (fb) { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteRenderbuffer(rb); }
      fb = gl.createFramebuffer(); tex = gl.createTexture(); rb = gl.createRenderbuffer();
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      fbW = W; fbH = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    camera();
    drawAll(true);
    const r = canvas.getBoundingClientRect(), k = W / r.width, R = 4;
    const px = Math.round((cx - r.left) * k), py = Math.round(H - (cy - r.top) * k);
    const x0 = Math.max(0, px - R), y0 = Math.max(0, py - R), w = Math.min(W, px + R + 1) - x0, h = Math.min(H, py + R + 1) - y0;
    let best = null;
    if (w > 0 && h > 0) {
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let bd = 1e9;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const key = buf[(j * w + i) * 4];
        if (!key) continue;
        const d = (x0 + i - px) ** 2 + (y0 + j - py) ** 2;
        if (d < bd) { bd = d; best = key; }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    invalidate();
    const p = parts.find((q) => q.key === best);
    return p ? p.id : null;
  }

  // Палец и мышь: один палец — вращение, два — масштаб, короткое касание без сдвига — выбор детали.
  const pts = new Map();
  let start = null, pinch = 0, moved = false;
  const clampView = () => {
    view.pitch = Math.max(-1.35, Math.min(1.35, view.pitch));
    view.zoom = Math.max(view.min, Math.min(view.max, view.zoom));
  };
  const down = (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); moved = true; }
  };
  const move = (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      const r = canvas.getBoundingClientRect(), s = 3.2 / Math.max(240, r.width);
      view.yaw -= (e.clientX - prev[0]) * s;
      view.pitch += (e.clientY - prev[1]) * s;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) view.zoom *= pinch / Math.max(1, d);
      pinch = d;
    }
    clampView();
    invalidate();
    onView && onView(view, "user");
  };
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (pts.size === 0 && start && !moved && performance.now() - start.t < 600) {
      const id = pickAt(e.clientX, e.clientY);
      onPick && onPick(id);
    }
    if (pts.size === 0) start = null;
  };
  const wheel = (e) => { e.preventDefault(); view.zoom *= Math.exp(e.deltaY * 0.0012); clampView(); invalidate(); onView && onView(view, "user"); };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener("resize", resize);
  resize();

  const api = {
    gl, view, look,
    setParts,
    invalidate,
    pickAt,
    get parts() { return parts; },
    // Экранная точка (CSS-пиксели относительно canvas) для точки сцены — для подсказок и автотестов.
    project(p) {
      camera();
      const v = M4.apply(VP, p), wv = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
      const r = canvas.getBoundingClientRect();
      return [((v[0] / wv) * 0.5 + 0.5) * r.width, (0.5 - (v[1] / wv) * 0.5) * r.height, wv > 0];
    },
    onFrame: null,
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    },
  };
  return api;
}
