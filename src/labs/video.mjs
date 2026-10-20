// Гл. 12. Аналог против цифры на краю дальности, светочувствительность камеры, общий канал, PIT Mode.
import { loop, choice, slider, toggle, clamp, fmt } from "../labkit.mjs";

export const meta = {
  id: "video",
  title: "Аналог и цифра в очках",
  missions: [
    { id: "hiss", text: "Отлети так, чтобы аналог шипел, а цифра была ещё чёткой" },
    { id: "freeze", text: "Найди расстояние, где цифра замирает, а в аналоге ещё что-то видно" },
    { id: "dusk", text: "Наступили поздние сумерки: подбери камеру, которая видит" },
    { id: "friend", text: "Друг включил передатчик на твоём канале. Что стало с аналогом?" },
  ],
};
const POWERS = [[25, "25 мВт"], [200, "200"], [400, "400"], [800, "800"], [1600, "1,6 Вт"]];
const LIGHT = [["day", "день"], ["dusk", "поздние сумерки (0,05 лк)"], ["night", "ночь без луны"]];
const LUX = { day: 10000, dusk: 0.05, night: 0.002 };
const CAMS = [[0.1, "камера 0,1 лк"], [0.001, "камера 0,001 лк"]];

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 190" class="lab-svg" role="img" aria-label="Два экрана: аналоговый и цифровой">
    <defs><clipPath id="sa"><rect x="8" y="26" width="166" height="124" rx="6"/></clipPath><clipPath id="sd"><rect x="186" y="26" width="166" height="124" rx="6"/></clipPath></defs>
    <rect width="360" height="190" class="lab-field"/><text x="91" y="18" class="lt" text-anchor="middle">Аналог</text><text x="269" y="18" class="lt" text-anchor="middle">Цифра</text>
    <g id="A" clip-path="url(#sa)"></g><g id="D" clip-path="url(#sd)"></g><rect x="8" y="26" width="166" height="124" rx="6" class="scr"/><rect x="186" y="26" width="166" height="124" rx="6" class="scr"/><g id="info"></g></svg></div>
    <div class="lab-ctl"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const ctl = $(".lab-ctl");
  const s = { d: 0.3, p: 400, light: "day", cam: 0.1, friend: false, pit: false, smooth: false, t: 0, frozenT: 0, dT: 0 };
  slider(ctl, { label: "Расстояние", min: 0.05, max: 4, step: 0.05, value: s.d, fmt: (v) => `${fmt(v, 2)} км`, onInput: (v) => (s.d = v) });
  choice(ctl, { label: "Мощность передатчика", options: POWERS, value: s.p, onPick: (v) => (s.p = v) });
  choice(ctl, { label: "Освещение", options: LIGHT, value: s.light, onPick: (v) => (s.light = v) });
  choice(ctl, { label: "Камера (меньше люкс — лучше в темноте)", options: CAMS, value: s.cam, onPick: (v) => (s.cam = v) });
  toggle(ctl, { label: "Друг на том же канале", value: false, onToggle: (v) => (s.friend = v) });
  toggle(ctl, { label: "PIT Mode (почти не излучает)", value: false, onToggle: (v) => (s.pit = v) });
  toggle(ctl, { label: "Цифра с плавной деградацией (как HDZero)", value: false, onToggle: (v) => (s.smooth = v) });
  // Сцена: небо, земля, дерево, ворота, которые плывут — видно движение.
  const scene = (x0, gx, bright, ghost) => {
    const g = clamp(bright, 0, 1);
    let h = `<g style="opacity:${(0.08 + g * 0.92).toFixed(2)}"><rect x="${x0}" y="26" width="166" height="70" class="sky"/><rect x="${x0}" y="96" width="166" height="54" class="ground"/>`;
    h += `<path d="M${x0 + 26} 96v-22" class="trunk"/><circle cx="${x0 + 26}" cy="68" r="14" class="crown"/>`;
    const gxx = x0 + 20 + (gx % 1) * 126;
    h += `<path d="M${gxx} 120V82H${gxx + 30}V120" class="gate"/>`;
    h += `<path d="M${x0 + 83} 80v14M${x0 + 76} 88h14" class="osd"/></g>`;
    if (ghost) h += `<g style="opacity:.45"><path d="M${x0 + 120} 140V60H${x0 + 160}V140" class="gate"/><rect x="${x0}" y="${26 + ((ghost * 60) % 124)}" width="166" height="10" class="snow"/></g>`;
    return h;
  };
  const L = loop(root, (dt, calm) => {
    if (!calm) s.t += dt;
    // Дальность: ×4 мощности ≈ ×2 расстояния. 400 мВт ≈ 1,2 км в этом учебном примере.
    const range = s.pit ? 0.03 : 1.2 * Math.sqrt(s.p / 400);
    const q = s.d / range; // 0 — рядом, 1 — край
    const bright = clamp(Math.log10(LUX[s.light] / s.cam) / 2, 0, 1);
    const hissA = clamp((q - 0.55) / 0.85, 0, 1); // аналог шумит постепенно
    const digOk = s.smooth ? q < 1.5 : q < 1.0;
    const blocks = s.smooth ? clamp((q - 0.8) / 0.7, 0, 1) : 0;
    const gx = s.t * 0.18;
    if (digOk) s.dT = gx;
    else s.frozenT += dt;
    if (digOk) s.frozenT = 0;
    if (hissA > 0.35 && digOk && blocks < 0.2) ctx.done("hiss");
    if (!digOk && hissA < 0.92 && !s.smooth) ctx.done("freeze");
    if (s.light === "dusk" && bright > 0.5) ctx.done("dusk");
    if (s.friend && hissA < 0.9) ctx.done("friend");
    // Аналог: картинка + «снег», который растёт к краю; друг на канале — чужая картинка поверх.
    let a = scene(8, gx, bright * (1 - hissA * 0.75), s.friend ? Math.max(0.01, s.t * 2) : 0); // > 0, иначе без анимации чужая картинка не рисуется
    const n = Math.round(hissA * 90 + (s.friend ? 12 : 0));
    const seed = calm ? 0 : Math.floor(s.t * 30);
    const rnd = (i) => {
      const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let i = 0; i < n; i++) {
      const y = 26 + rnd(i * 3) * 124, x = 8 + rnd(i * 3 + 1) * 150;
      a += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(6 + rnd(i * 3 + 2) * 24).toFixed(0)}" height="1.6" class="snow"/>`;
    }
    $("#A").innerHTML = a;
    // Цифра: чётко, пока хватает данных; потом стоп-кадр и «потеря сигнала». Плавная — квадратики.
    let d = digOk ? scene(186, gx, bright, 0) : scene(186, s.dT, bright * 0.7, 0);
    if (blocks > 0) for (let i = 0; i < Math.round(blocks * 40); i++) {
      const bx = 186 + ((i * 37) % 150), by = 26 + ((i * 53 + Math.floor(s.t * 6) * 11) % 112);
      d += `<rect x="${bx}" y="${by}" width="${12 + (i % 3) * 6}" height="12" class="mosaic"/>`;
    }
    if (!digOk) d += `<rect x="198" y="74" width="142" height="28" rx="6" class="lab-hud"/><text x="269" y="93" class="lt bad" text-anchor="middle">${s.frozenT > 1 ? "СИГНАЛ ПОТЕРЯН" : "картинка замерла"}</text>`;
    $("#D").innerHTML = d;
    $("#info").innerHTML = `<text x="180" y="176" class="lab-small" text-anchor="middle">край ≈ ${fmt(range, 2)} км · пройдено ${fmt(q * 100)} % до края</text>`;
    const msg = s.pit && s.d > range
      ? "PIT Mode — режим для настройки на столе: передатчик почти молчит. В полёте его выключают."
      : bright < 0.2
        ? LUX[s.light] < s.cam
          ? `Темно для этой камеры: ей нужно хотя бы ${String(s.cam).replace(".", ",")} лк. Чем меньше число люкс у камеры, тем лучше она видит в темноте.`
          : `Света (${String(LUX[s.light]).replace(".", ",")} лк) едва хватает этой камере (её порог ${String(s.cam).replace(".", ",")} лк): картинка тёмная. Нужна камера чувствительнее или больше света.`
        : s.friend
          ? "Аналоговый канал открытый: любой передатчик на той же частоте лезет в твою картинку. Договаривайтесь о каналах!"
          : !digOk
            ? hissA < 0.92 ? "Цифра потеряла поток данных и замерла, а аналог ещё «шипит, но видно». Так ведут себя многие цифровые системы — но не все." : "Слишком далеко: цифра пропала, а в аналоге почти один «снег». Подлети ближе."
            : hissA > 0.3
              ? "Аналог портится постепенно — появляется «снег». Цифра пока держит чёткую картинку."
              : "Рядом обе картинки чистые. Отлетай дальше.";
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
