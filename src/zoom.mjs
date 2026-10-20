// Масштабирование сцен: два пальца — увеличить и подвинуть, двойное касание — приблизить, кнопки +/−/⤢,
// Ctrl + колесо на компьютере. Одним пальцем страница листается вверх-вниз как обычно (touch-action: pan-y),
// а увеличенную сцену можно двигать вбок. Перетаскиваемые элементы сцены продолжают работать.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Элементы, которые сами ловят палец: на них панорамирование не начинаем.
const OWN = ".lab-hit, [data-drag], .zoom-ui, input, select, textarea, button, a";

// bar: кнопки стоят полосой под сценой и не закрывают её (для схем лабораторий).
export function attachZoom(viewport, getContent, { min = 1, max = 4, initial = 1, onChange, grow = true, maxH = 0.6, bar = false, dblTap = true } = {}) {
  if (!viewport || viewport.dataset.zoomReady) return null;
  viewport.dataset.zoomReady = "1";
  viewport.classList.add("zoomable");
  let s = 1, tx = 0, ty = 0;
  // hold — масштаб задаёт программа (камера следит за дроном): рамка не растёт в высоту, чтобы страница
  // не прыгала под пальцем. userAt — когда человек сам последний раз трогал масштаб.
  let hold = false, userAt = -1e9;
  const touched = () => {
    userAt = performance.now();
    hold = false;
  };
  const ui = document.createElement("div");
  ui.className = bar ? "zoom-ui zoom-bar" : "zoom-ui";
  ui.innerHTML = `<button type="button" data-z="in" aria-label="Увеличить сцену" title="Увеличить (или два пальца, Ctrl + колесо)">+</button><button type="button" data-z="out" aria-label="Уменьшить сцену" title="Уменьшить">−</button><button type="button" data-z="reset" aria-label="Вернуть масштаб" title="Вернуть как было">⤢</button>`;
  viewport.appendChild(ui);
  const box = () => ({ w: viewport.clientWidth, h: viewport.clientHeight });
  let notifyT = 0;
  function apply(quiet) {
    const c = getContent();
    s = clamp(s, min, max);
    // У SVG нет offsetHeight — берём clientHeight (высота в раскладке, без учёта увеличения).
    const w = viewport.clientWidth, h0 = (c && (c.offsetHeight ?? c.clientHeight)) || viewport.clientHeight;
    // При увеличении сцена растёт и в высоту (не выше доли экрана): верх и низ не обрезаются.
    let H = h0;
    const extra = bar ? ui.offsetHeight : 0; // полоса кнопок под сценой — в высоту сцены не входит
    if (grow && !hold) {
      H = s > 1.001 ? Math.min(h0 * s, Math.max(h0, innerHeight * maxH)) : h0;
      const want = s > 1.001 ? `${Math.round(H + extra)}px` : "";
      if (viewport.style.height !== want) viewport.style.height = want;
    } else if (grow) {
      if (viewport.style.height) viewport.style.height = "";
      H = h0;
    } else H = viewport.clientHeight - extra;
    tx = clamp(tx, w - w * s, 0);
    ty = clamp(ty, H - h0 * s, 0);
    if (c) {
      c.style.transformOrigin = "0 0";
      c.style.transform = s > 1.001 ? `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})` : "";
    }
    viewport.dataset.zoom = s.toFixed(3);
    viewport.classList.toggle("zoomed", s > 1.001);
    ui.querySelector('[data-z="out"]').disabled = s <= min + 0.001;
    ui.querySelector('[data-z="in"]').disabled = s >= max - 0.001;
    ui.querySelector('[data-z="reset"]').disabled = s <= 1.001;
    // Перерисовку (резкость холстов) просим не чаще раза в 120 мс.
    if (onChange && !quiet) {
      clearTimeout(notifyT);
      notifyT = setTimeout(() => onChange(s), 120);
    }
  }
  // Короткая анимация перехода (для приближения к детали); подписи догоняют после неё.
  let glideT = 0;
  function glide() {
    const c = getContent();
    if (!c || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    c.style.transition = "transform .35s ease";
    clearTimeout(glideT);
    glideT = setTimeout(() => {
      c.style.transition = "";
      if (onChange) onChange(s);
    }, 380);
  }
  function zoomAt(ns, cx, cy) {
    ns = clamp(ns, min, max);
    const k = ns / s;
    tx = cx - (cx - tx) * k;
    ty = cy - (cy - ty) * k;
    s = ns;
    apply();
  }
  const local = (e) => {
    const r = viewport.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  ui.addEventListener("click", (e) => {
    const b = e.target.closest("[data-z]");
    if (!b) return;
    e.stopPropagation();
    touched();
    const { w, h } = box();
    if (b.dataset.z === "in") zoomAt(s * 1.5, w / 2, h / 2);
    if (b.dataset.z === "out") zoomAt(s / 1.5, w / 2, h / 2);
    if (b.dataset.z === "reset") {
      s = 1;
      tx = ty = 0;
      apply();
    }
  });
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return; // обычное колесо листает страницу
      e.preventDefault();
      touched();
      const [x, y] = local(e);
      zoomAt(s * Math.exp(-e.deltaY * 0.0025), x, y);
    },
    { passive: false },
  );
  // Жесты пальцами и мышью.
  const pts = new Map();
  let mode = "", start = null, moved = false, suppress = false, lastTap = { t: 0, x: 0, y: 0 };
  const two = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const [x, y] = local(e);
    // На выбираемой детали (data-pick) двойное касание — это «следующий слой», а не увеличение.
    pts.set(e.pointerId, { x, y, own: !!e.target.closest(OWN), pick: !!e.target.closest("[data-pick]") });
    moved = false;
    if (pts.size === 2) {
      // Второй палец: щипок работает всегда, даже если первый лёг на перетаскиваемую деталь.
      const g = two();
      touched();
      mode = "pinch";
      start = { ...g, s, tx, ty };
      for (const id of pts.keys()) {
        try {
          viewport.setPointerCapture(id);
        } catch (err) {}
      }
    } else if (pts.size === 1) {
      mode = pts.get(e.pointerId).own ? "" : "pan?";
      start = { x, y, tx, ty };
    }
  });
  viewport.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const [x, y] = local(e);
    p.x = x;
    p.y = y;
    if (mode === "pinch" && pts.size >= 2) {
      const g = two();
      const ns = clamp(start.s * (g.d / start.d), min, max);
      const k = ns / start.s;
      tx = g.mx - (start.mx - start.tx) * k;
      ty = g.my - (start.my - start.ty) * k;
      s = ns;
      moved = true;
      apply();
      return;
    }
    // Палец при касании почти всегда чуть сдвигается: до 14 px это ещё нажатие, а не перетаскивание.
    if (mode === "pan?" && s > 1.001 && Math.hypot(x - start.x, y - start.y) > (e.pointerType === "mouse" ? 5 : 14)) {
      mode = "pan";
      touched();
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    if (mode === "pan") {
      tx = start.tx + (x - start.x);
      ty = start.ty + (y - start.y);
      moved = true;
      apply(true);
    }
  });
  const end = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (!p) return;
    if (moved) {
      suppress = true;
      setTimeout(() => (suppress = false), 300);
      if (mode === "pan") apply();
    } else if (dblTap && e.type === "pointerup" && e.pointerType === "touch" && !p.own && !p.pick && pts.size === 0) {
      // Двойное касание: приблизить к пальцу или вернуть.
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        touched();
        if (s > 1.2) {
          s = 1;
          tx = ty = 0;
          apply();
        } else zoomAt(2.5, p.x, p.y);
        lastTap.t = 0;
      } else lastTap = { t: now, x: p.x, y: p.y };
    }
    if (pts.size < 2 && mode === "pinch") {
      // Один палец остался: им можно дальше двигать увеличенную сцену.
      const [q] = pts.values();
      mode = q ? "pan?" : "";
      if (q) start = { x: q.x, y: q.y, tx, ty };
    }
    if (pts.size === 0) mode = "";
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  // После сдвига или щипка не считаем отпускание пальца нажатием на деталь сцены.
  viewport.addEventListener(
    "click",
    (e) => {
      if (suppress && !e.target.closest(".zoom-ui")) {
        e.stopPropagation();
        e.preventDefault();
        suppress = false;
      }
    },
    true,
  );
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => apply(true)) : null;
  if (ro) ro.observe(viewport);
  // Начальный масштаб — по центру.
  if (initial > 1) {
    requestAnimationFrame(() => {
      const { w } = box();
      s = initial;
      tx = -(w * s - w) / 2;
      ty = 0;
      apply();
    });
  } else apply(true);
  return {
    get scale() {
      return s;
    },
    get userAt() {
      return userAt;
    },
    // Точка экрана → координаты картинки (без увеличения).
    toContent(clientX, clientY) {
      const r = viewport.getBoundingClientRect();
      return [(clientX - r.left - tx) / s, (clientY - r.top - ty) / s];
    },
    // Программная «камера»: точка картинки (cx, cy) в центре рамки, масштаб ns; высота рамки не меняется.
    setView(cx, cy, ns) {
      s = clamp(ns, min, max);
      hold = s > 1.001;
      const c = getContent();
      const h0 = (c && (c.offsetHeight ?? c.clientHeight)) || viewport.clientHeight;
      tx = viewport.clientWidth / 2 - cx * s;
      ty = h0 / 2 - cy * s;
      apply(true);
    },
    reset(smooth) {
      hold = false;
      if (smooth) glide();
      s = 1;
      tx = ty = 0;
      apply();
    },
    // Плавно приблизить точку экрана (clientX, clientY) до масштаба ns и поставить её в центр рамки.
    focus(clientX, clientY, ns) {
      hold = false;
      const r = viewport.getBoundingClientRect();
      const px = (clientX - r.left - tx) / s, py = (clientY - r.top - ty) / s;
      glide();
      s = clamp(ns, min, max);
      apply(true);
      const w = viewport.clientWidth, H = viewport.clientHeight;
      tx = w / 2 - px * s;
      ty = H / 2 - py * s;
      apply();
    },
    destroy() {
      if (ro) ro.disconnect();
      ui.remove();
    },
  };
}
