// Набор для лабораторий глав: цикл анимации, крупные элементы управления, SVG-помощники.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// «—» вместо NaN/Infinity и без «−0»: отрицательный ноль после округления показываем как 0.
export const fmt = (n, d = 0) =>
  !Number.isFinite(Number(n))
    ? "—"
    : Number(n)
    .toFixed(d)
    .replace(/^-(?=0(\.0*)?$)/, "")
    .replace(".", ",")
    .replace(/^-?\d+/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, " ")) // разряды — только в целой части
    .replace(/^-/, "−");
export const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Цикл: идёт, пока элемент на экране; dt в секундах, не больше 1/30.
export function loop(el, fn) {
  let frame = 0, last = 0, visible = true, alive = true;
  const tick = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    fn(dt, still());
    frame = alive && visible ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (!frame && alive && visible) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };
  let io = null;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((e) => {
      visible = e[e.length - 1].isIntersecting;
      if (visible) run();
    }, { rootMargin: "100px 0px" });
    io.observe(el);
  }
  run();
  return {
    stop() {
      alive = false;
      if (io) io.disconnect();
      cancelAnimationFrame(frame);
    },
    kick: run,
  };
}

// Крупные элементы управления. Возвращают элемент; значение читают через onInput.
let uid = 0;
export function slider(parent, { label, min, max, step = 1, value, fmt: f = (v) => v, onInput }) {
  const id = `ls${++uid}`;
  const wrap = document.createElement("label");
  wrap.className = "lab-slider";
  wrap.htmlFor = id;
  wrap.innerHTML = `<span><b>${esc(label)}</b><output>${esc(f(value))}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const input = wrap.querySelector("input"), out = wrap.querySelector("output");
  input.addEventListener("input", () => {
    const v = Number(input.value);
    out.textContent = f(v);
    onInput(v);
  });
  parent.appendChild(wrap);
  return {
    el: wrap,
    set(v) {
      input.value = v;
      out.textContent = f(Number(v));
    },
  };
}
export function choice(parent, { label, options, value, onPick }) {
  const wrap = document.createElement("div");
  wrap.className = "lab-choice";
  wrap.innerHTML = `${label ? `<b>${esc(label)}</b>` : ""}<div role="radiogroup">${options.map(([v, l]) => `<button type="button" role="radio" data-v="${esc(v)}" aria-checked="${String(v) === String(value)}">${esc(l)}</button>`).join("")}</div>`;
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    const opt = options.find(([v]) => String(v) === b.dataset.v);
    onPick(opt[0]);
  });
  parent.appendChild(wrap);
  return {
    el: wrap,
    set(v) {
      wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.v === String(v))));
    },
  };
}
export function button(parent, label, onClick, cls = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `lab-btn ${cls}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  parent.appendChild(b);
  return b;
}
export function toggle(parent, { label, value, onToggle }) {
  const id = `lt${++uid}`;
  const wrap = document.createElement("label");
  wrap.className = "lab-toggle";
  wrap.htmlFor = id;
  wrap.innerHTML = `<input id="${id}" type="checkbox" ${value ? "checked" : ""}><span>${esc(label)}</span>`;
  const input = wrap.querySelector("input");
  input.addEventListener("change", () => onToggle(input.checked));
  parent.appendChild(wrap);
  return {
    el: wrap,
    set(v) {
      input.checked = !!v;
    },
  };
}

// Перетаскивание точки в SVG (мышь и палец); fn получает координаты в единицах viewBox.
export function drag(svg, el, fn, { onEnd } = {}) {
  const pt = (e) => {
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  el.style.touchAction = "none";
  el.style.cursor = "grab";
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    fn(...pt(e), "start");
    const move = (ev) => fn(...pt(ev), "move");
    const up = (ev) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (onEnd) onEnd(...pt(ev));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  });
}

// Виртуальный стик: квадрат, возвращает x,y в −1…1 и пружинит в центр по отпусканию (кроме газа).
export function stick(parent, { label, spring = [true, true], value = [0, 0], onMove }) {
  const wrap = document.createElement("div");
  wrap.className = "lab-stick";
  wrap.innerHTML = `<svg viewBox="-60 -60 120 120" aria-label="${esc(label)}" role="img"><rect x="-56" y="-56" width="112" height="112" rx="16" class="st-bg"/><line x1="-56" y1="0" x2="56" y2="0" class="st-ax"/><line x1="0" y1="-56" x2="0" y2="56" class="st-ax"/><circle class="st-knob" r="15"/></svg><small>${esc(label)}</small>`;
  const svg = wrap.querySelector("svg"), knob = wrap.querySelector(".st-knob");
  let v = [...value];
  const draw = () => {
    knob.setAttribute("cx", (v[0] * 42).toFixed(1));
    knob.setAttribute("cy", (-v[1] * 42).toFixed(1));
  };
  draw();
  drag(svg, svg, (x, y) => {
    v = [clamp(x / 42, -1, 1), clamp(-y / 42, -1, 1)];
    draw();
    onMove(v);
  }, {
    onEnd: () => {
      v = [spring[0] ? 0 : v[0], spring[1] ? 0 : v[1]];
      draw();
      onMove(v);
    },
  });
  parent.appendChild(wrap);
  return {
    el: wrap,
    set(nv) {
      v = [...nv];
      draw();
    },
  };
}

// Короткая подпись поверх сцены.
export function svgText(x, y, text, cls = "lt", anchor = "middle") {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(text)}</text>`;
}
export function shuffle(arr, seed = Date.now()) {
  const a = [...arr];
  let s = seed % 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
