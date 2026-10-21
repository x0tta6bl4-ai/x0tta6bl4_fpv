// Fig: мастерская детектива. Неисправный дрон на подставке и приборы вокруг: ноутбук с Betaflight, пульт,
// мультиметр, лупа над пайкой, батарея с тестером банок и термометром, очки с OSD, запасная камера,
// схема пропеллеров. Каждая проверка делается своим прибором — он подсвечивается, улика появляется на доске.
// Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, pcb, motor, propSvg, fmt, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -92, y: -118, w: 184, d: 236, r: 8 };
const BOARD = { x: -88, y: -84, w: 3, d: 104, z0: 6, h: 62 };
const DR = [6, -8];
// Где стоят приборы (центр и высота кольца подсветки).
const TOOLS = {
  laptop: [-52, 62, 18], pult: [44, 72, 10], meter: [56, 20, 6], loupe: [6, -8, 30], led: [12, -18, 16],
  props: [-14, -64, 4], cam: [44, -36, 8], goggles: [-50, -96, 10], conn: [-4, 4, 26], labels: [-50, -96, 18],
  thermo: [52, -86, 12], cells: [44, -74, 10],
};
export const CASES = [
  {
    id: "arm", title: "Бинд есть, арма нет", sym: "Пульт видит приёмник, а дрон не армится и не слушается стиков.",
    causes: { wire: "TX приёмника не на R полётника", port: "Serial RX не на том UART", mm: "Model Match: номера не совпали", acc: "Акселерометр не откалиброван" },
    checks: [
      ["Флаги запрета арма", "laptop", (c) => (c === "acc" ? "NO_ACC_CAL, MSP" : "RXLOSS, MSP")],
      ["Светодиод приёмника", "led", (c) => (c === "mm" ? "мигает трижды, пауза, снова трижды" : "горит ровно")],
      ["Вкладка «Порты»", "laptop", (c) => (c === "port" ? "Serial RX на UART1, а приёмник на R2/T2" : "Serial RX на UART2 — как припаяно")],
      ["Пайка под лупой", "loupe", (c) => (c === "wire" ? "TX приёмника на T2 — «рот ко рту»" : "TX → R2, RX → T2, пайка блестит")],
      ["Пульт: настройки ELRS", "pult", (c) => (c === "mm" ? "Model Match ON, модель №3, приёмник помнит №1" : "Model Match OFF")],
    ],
  },
  {
    id: "flip", title: "Кувыркнулся на взлёте", sym: "Даёшь газ — дрон резко переворачивается на бок.",
    causes: { prop: "Пропеллер не того направления", dir: "Мотор крутится не в ту сторону", orient: "Неверная ориентация платы" },
    checks: [
      ["«Моторы» без пропов: направление", "laptop", (c) => (c === "dir" ? "мотор 3 по часовой, а по схеме — против" : "все крутятся по схеме props in")],
      ["Сверить пропеллеры со схемой", "props", (c) => (c === "prop" ? "на моторе 2 проп другого направления" : "все пропы по схеме")],
      ["3D-модель: наклоняю борт вперёд", "laptop", (c) => (c === "orient" ? "модель наклоняется вбок" : "модель повторяет наклоны")],
      ["Флаги запрета арма", "laptop", () => "только MSP — флаги тут не помогут"],
    ],
  },
  {
    id: "cam", title: "OSD видно, картинки нет", sym: "В очках видны надписи (напряжение, таймер), а вместо картинки — серый фон.",
    causes: { vid: "Оторвался провод видео камеры", pwr: "Камера без питания", dead: "Камера неисправна" },
    checks: [
      ["Мультиметр: напряжение на камере", "meter", (c) => (c === "pwr" ? "0 В" : "5,0 В")],
      ["Пайка VID → CAM под лупой", "loupe", (c) => (c === "vid" ? "провод болтается — оторван" : "держится крепко")],
      ["Подключить рабочую камеру", "cam", (c) => (c === "dead" ? "картинка появилась!" : "всё так же пусто")],
      ["Сменить канал видеопередатчика", "goggles", () => "надписи видно на любом канале — передатчик жив"],
    ],
  },
  {
    id: "ant", title: "Новая антенна — рябит рядом", sym: "Поставил новую антенну на видео — шумит уже в 100–200 м, а раньше летал на километр.",
    causes: { sma: "SMA вместо RP-SMA: нет контакта", pit: "Видеопередатчик в PIT Mode", pol: "Антенна другой поляризации" },
    checks: [
      ["Заглянуть в разъёмы", "conn", (c) => (c === "sma" ? "и у антенны, и у передатчика — гнёзда без штырька" : "штырёк на месте")],
      ["Меню видеопередатчика в OSD", "goggles", (c) => (c === "pit" ? "PIT: ON" : "PIT: OFF, 400 мВт")],
      ["Наклейки на антенне и очках", "labels", (c) => (c === "pol" ? "на дроне LHCP, на очках RHCP" : "обе RHCP")],
    ],
  },
  {
    id: "sticks", title: "Стики делают не то", sym: "Двигаешь крен — а в Betaflight едет не та полоска или не в ту сторону.",
    causes: { map: "Порядок каналов не совпадает (AETR ↔ TAER)", rev: "На пульте реверс канала крена" },
    checks: [
      ["«Приёмник»: двигаю крен вправо", "laptop", (c) => (c === "map" ? "едет полоска газа, флаг THROTTLE" : "полоска крена едет влево")],
      ["Пульт: экран Outputs", "pult", (c) => (c === "rev" ? "у канала 1 галочка «реверс»" : "реверса нет")],
    ],
  },
  {
    id: "lowv", title: "LOW BATTERY сразу после взлёта", sym: "Только взлетел — в очках мигает LOW BATTERY.",
    causes: { cold: "Холодная батарея", old: "Старая батарея: одна банка «устала»", cells: "Полётник считает не то число банок", weak: "Батарея слабее нужного тока (мало C)" },
    checks: [
      ["Термометр: температура батареи", "thermo", (c) => (c === "cold" ? "+2 °C — лежала на морозе" : "+24 °C")],
      ["Банки в покое (тестер)", "cells", (c) => (c === "cells" ? "все по 4,15 В (4S), а OSD делит на 5 банок" : c === "old" ? "пять по 4,15 В, одна 4,05 В" : "все по 4,15 В")],
      ["Банки под нагрузкой", "cells", (c) => (c === "old" ? "одна проседает до 3,1 В, остальные 3,6 В" : c === "cells" ? "все по 3,95 В — просадка маленькая" : "все проседают до 3,3 В")],
      ["Наклейка батареи", "labels", (c) => (c === "weak" ? "1300 мА·ч 25C: максимум 32 А, а надо 80" : "1300 мА·ч 100C")],
    ],
  },
];
const byId = (id) => CASES.find((c) => c.id === id) || CASES[0];
const list = (v) => (v ? String(v).split(",").filter(Boolean) : []);

export const meta = {
  id: "workshop",
  title: "Мастерская детектива",
  hint: "Дело, проверки и вердикт — справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Кольцо вокруг прибора — им сейчас сделана проверка; улика — на доске" },
    { mark: "raised", label: "Дрон на подставке, ноутбук, пульт, мультиметр, лупа, батарея с тестером, очки, запасная камера" },
    { mark: "edge", label: "Доска дела: что видим, сделанные проверки и вердикт" },
  ],
  caption: "Метод детектива: сначала улики, потом подозреваемые. Проверяй по одному — от простого к сложному. Хорошая проверка отсекает часть причин. Одинаковый признак может иметь разные причины, поэтому в каждом деле причина выбирается заново — решают улики, а не память.",
  aria: "Справа: выбор дела, выбор проверки (каждая — своим прибором) и вердикт.",
  missions: [
    { id: "sharp", look: ["board"], touch: ["chk", "verdict"], see: "сколько проверок на доске", text: "Раскрой дело по уликам: 1–2 проверки и без ошибки", check: (f) => f.sharp },
    { id: "three", look: ["board"], touch: ["case", "chk", "verdict"], see: "доску дела", text: "Раскрой 3 дела", check: (f) => f.solved >= 3 },
    { id: "flip", look: ["drone", "props"], touch: ["case=flip", "chk", "verdict"], see: "мотор и пропеллеры дрона", text: "Раскрой дело «Кувыркнулся на взлёте»", check: (f) => f.flipSolved },
    { id: "all", look: ["board"], touch: ["case"], see: "отметки ✓ у дел", text: "Раскрой все 6 дел", check: (f) => f.solved >= 6 },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [BOARD.x, BOARD.y, BOARD.z0 + BOARD.h + 2], [BOARD.x, BOARD.y + BOARD.d, BOARD.z0 + BOARD.h + 2]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Состояние дела хранится в state (переживает перестройку сцены): истина, сделанные проверки, ошибки, раскрытые дела.
function settle(state) {
  const c = byId(state.case);
  if (state.truthFor !== c.id) {
    const keys = Object.keys(c.causes);
    state.truth = keys[Math.floor(Math.random() * keys.length)];
    state.truthFor = c.id;
    state.done = "";
    state.bad = "";
    state.verdictSeen = "";
    state.blind = "";
  }
  const [cid, idx] = String(state.chk || "").split(":");
  if (cid === c.id && idx !== undefined && !list(state.done).includes(idx) && !list(state.solvedNow).includes(c.id)) state.done = [...list(state.done), idx].join(",");
  const [vid, vk] = String(state.verdict || "").split(":");
  if (vid === c.id && vk) {
    if (vk === state.truth) {
      const n = list(state.done).length;
      // Верный вердикт без единой проверки — угадайка: дело не раскрыто, звезда не растёт.
      if (n < 1) state.blind = c.id;
      else if (!list(state.solved).includes(c.id)) {
        state.blind = "";
        const solved = new Set(list(state.solved));
        solved.add(c.id);
        state.solved = [...solved].join(",");
        state.solvedNow = c.id;
        const wrong = list(state.bad).length;
        if (n <= 2 && !wrong) state.sharp = 1;
        if (c.id === "flip") state.flipSolved = 1;
      }
    } else if (state.verdictSeen !== state.verdict) {
      state.verdictSeen = state.verdict;
      state.blind = "";
      if (!list(state.bad).includes(vk)) state.bad = [...list(state.bad), vk].join(",");
    }
  }
  return c;
}

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  basePlate(S, PLATE);
  labelPlate(S, { x: 66, y: -110, w: 20, d: 22, r: 1.5 });

  // ── Доска дела ──
  S.group = "board";
  for (const yy of [BOARD.y + 10, BOARD.y + BOARD.d - 10]) S.tube([[BOARD.x + 1.5, yy, 0], [BOARD.x + 1.5, yy, BOARD.z0]], 1, { tone: "mid" });
  S.box({ ...BOARD, r: 1 }, BOARD.z0, BOARD.h, { tone: "hi" }, { bevel: 0.3, ref: [BOARD.x + BOARD.w, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h / 2] });
  const bf = k.sideMatrix([BOARD.x + BOARD.w, BOARD.y + BOARD.d - 4], BOARD.z0 + BOARD.h - 4, P, "right");
  S.raw([BOARD.x + BOARD.w + 0.3, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h / 2], `<g transform="${bf}"><g data-part="board"></g></g>`, { bias: 4 });

  // ── Дрон на подставке: плата, моторы, пропы, приёмник со светодиодом, камера, антенна видео ──
  S.group = "drone";
  const [cx, cy] = DR;
  S.cyl(cx, cy, 12, 0, 3, { tone: "mid" });
  S.cyl(cx, cy, 2.4, 3, 9, { tone: "mid", crease: "none" });
  const z0 = 12;
  pcb(S, { x: cx - 12, y: cy - 12, w: 24, d: 24, r: 2 }, z0, { chips: [{ x: cx, y: cy, w: 8, d: 8, h: 1.2, dot: true }, { x: cx + 6, y: cy - 8, w: 5, d: 4, h: 1 }] });
  const mot = [[cx + 20, cy + 20], [cx + 20, cy - 20], [cx - 20, cy + 20], [cx - 20, cy - 20]];
  for (const [mx, my] of mot) S.tube([[cx, cy, z0 + 0.8], [mx, my, z0 + 0.8]], 1.6, { tone: "mid", maxLength: 30 });
  mot.forEach(([mx, my], i) => { const t = motor(S, mx, my, z0, { r: 5, h: 5, ribs: 10 }).top; S.raw([mx, my, t + 6], propSvg(P, mx, my, t + 1.2, 12, i * 0.9, { blades: 3 }), { bias: 20 }); });
  S.box({ x: cx + 10, y: cy - 6, w: 6, d: 12, r: 1 }, z0 + 1.6, 7, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  S.tube([[cx - 6, cy + 4, z0 + 2], [cx - 6, cy + 4, z0 + 16]], 0.8, { tone: "hi" });
  S.solid(G.sphereOf([cx - 6, cy + 4, z0 + 18], 2.6, P), { tone: "hi" }, [cx - 6, cy + 4, z0 + 18]);
  // Лупа на штативе над платой.
  S.group = "loupe";
  S.cyl(cx - 26, cy - 30, 5, 0, 2, { tone: "mid" });
  S.tube([[cx - 26, cy - 30, 2], [cx - 26, cy - 30, 30], [cx - 4, cy - 10, 30]], 0.8, { tone: "mid", bendR: 4 });
  S.raw([cx - 2, cy - 8, 30], `<path class="iso-line" data-tone="hi" style="stroke-width:1.4" d="${k.ring(cx - 2, cy - 8, 7, 30, P, 40)}"/><path class="ws-glass" d="${k.ring(cx - 2, cy - 8, 6.4, 30, P, 40)}"/>`, { bias: 30 });

  // ── Ноутбук ──
  S.group = "laptop";
  const [lx, ly] = TOOLS.laptop;
  const base = { x: lx - 10, y: ly - 24, w: 26, d: 48, r: 2 };
  S.box(base, 0, 3, { tone: "hi", crease: "lo" }, { bevel: 0.4 });
  S.box({ x: lx - 14, y: ly - 24, w: 3, d: 48, r: 1 }, 3, 30, { tone: "mid" }, { bevel: 0.3, ref: [lx - 11, ly, 18] });
  const lf = k.sideMatrix([lx - 11, ly + 21], 30, P, "right");
  S.raw([lx - 10.7, ly, 18], `<g transform="${lf}"><rect x="0" y="0" width="42" height="24" rx="1" class="bf-screen"/><g data-part="lap"></g></g>`, { bias: 3 });

  // ── Пульт ──
  S.group = "pult";
  const [px, py] = TOOLS.pult;
  S.box({ x: px - 12, y: py - 20, w: 24, d: 40, r: 5 }, 0, 8, { tone: "hi", crease: "lo" }, { bevel: 0.6 });
  for (const gy of [py - 10, py + 10]) S.cyl(px + 2, gy, 3.6, 8, 1.2, { tone: "mid" });
  S.box({ x: px - 10, y: py - 8, w: 4, d: 16, r: 0.8 }, 8, 10, { tone: "mid" }, { steps: 2 });
  const pf = k.sideMatrix([px - 6, py + 7], 17, P, "right");
  S.raw([px - 5.7, py, 13], `<g transform="${pf}"><rect x="0" y="0" width="14" height="7" rx="0.6" class="osd-screen"/><g data-part="pscr"></g></g>`, { bias: 3 });

  // ── Мультиметр ──
  S.group = "meter";
  const [mx, my] = TOOLS.meter;
  S.box({ x: mx - 10, y: my - 14, w: 20, d: 28, r: 3 }, 0, 6, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  const mf = k.topMatrix([mx - 6, my + 10], 6.05, P, "y");
  S.raw([mx, my, 6.1], `<g transform="${mf}"><rect x="0" y="0" width="20" height="8" rx="0.8" class="osd-screen"/><g data-part="mscr"></g></g>`, { bias: 1 });
  S.tube([[mx - 10, my - 4, 3], [mx - 22, my - 14, 1.2], [cx + 12, cy - 2, z0 + 2]], 0.4, { tone: "lit", bendR: 4 });

  // ── Схема пропеллеров ──
  S.group = "props";
  const [sx2, sy2] = TOOLS.props;
  S.box({ x: sx2 - 12, y: sy2 - 16, w: 24, d: 32, r: 1 }, 0, 0.6, { tone: "hi" }, { steps: 2, layer: 0.4 });
  const sf = k.topMatrix([sx2 - 10, sy2 + 14], 0.65, P, "y");
  S.raw([sx2, sy2, 0.7], `<g transform="${sf}">${txt(0, 4, "props in", "ws-s")}<circle cx="7" cy="11" r="4.4" class="ws-sch"/><circle cx="21" cy="11" r="4.4" class="ws-sch"/><circle cx="7" cy="19" r="4.4" class="ws-sch"/><circle cx="21" cy="19" r="4.4" class="ws-sch"/>${txt(7, 12.4, "↻", "ws-s", "middle")}${txt(21, 12.4, "↺", "ws-s", "middle")}${txt(7, 20.4, "↺", "ws-s", "middle")}${txt(21, 20.4, "↻", "ws-s", "middle")}</g>`, { layer: 0.45 });

  // ── Запасная камера ──
  S.group = "cam";
  const [kx, ky] = TOOLS.cam;
  S.box({ x: kx - 5, y: ky - 5, w: 10, d: 10, r: 1.4 }, 0, 9, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
  const kf = k.sideMatrix([kx + 5, ky], 4.5, P, "right");
  S.raw([kx + 5.3, ky, 4.5], `<g transform="${kf}"><circle r="3.2" class="gg-lens"/><circle r="1.8" class="gg-glass"/></g>`, { bias: 2 });

  // ── Очки с OSD ──
  S.group = "goggles";
  const [gx, gy] = TOOLS.goggles;
  S.box({ x: gx - 9, y: gy - 16, w: 18, d: 32, r: 6 }, 0, 12, { tone: "hi", crease: "lo" }, { bevel: 0.8 });
  const gf = k.sideMatrix([gx + 9, gy + 13], 10, P, "right");
  S.raw([gx + 9.3, gy, 6], `<g transform="${gf}"><rect x="0" y="0" width="26" height="8" rx="1.2" class="osd-screen"/><g data-part="gscr"></g></g>`, { bias: 3 });

  // ── Батарея, тестер банок, термометр ──
  S.group = "battery";
  const [bx, by] = TOOLS.cells;
  S.box({ x: bx - 8, y: by - 12, w: 16, d: 24, r: 2.4 }, 0, 10, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  S.box({ x: bx - 6, y: by + 14, w: 12, d: 10, r: 1.2 }, 0, 4, { tone: "mid" }, { bevel: 0.3 });
  const cf = k.topMatrix([bx - 4, by + 22.5], 4.05, P, "y");
  S.raw([bx, by + 19, 4.1], `<g transform="${cf}"><rect x="0" y="0" width="8" height="8" rx="0.6" class="osd-screen"/></g>`, { bias: 1 });
  const [tx, ty] = TOOLS.thermo;
  S.cyl(tx, ty, 1.4, 0, 14, { tone: "hi" });
  S.solid(G.sphereOf([tx, ty, 1.8], 2.2, P), { tone: "hi", lit: true }, [tx, ty, 1.8]);

  S.group = null;
  S.raw([0, 0, 300], `<g data-part="fx"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Мастерская детектива: неисправный дрон и приборы для проверок — ноутбук, пульт, мультиметр, лупа, батарея с тестером, очки, запасная камера.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Доска дела", [BOARD.x + BOARD.w, BOARD.y + BOARD.d / 2, BOARD.z0 + BOARD.h], "Что видим, сделанные проверки и улики."],
    ["Ноутбук · Betaflight", [lx, ly, 30], "Флаги запрета арма, «Порты», «Приёмник», «Моторы», 3D-модель."],
    ["Пульт", [px, py, 10], "Настройки ELRS (Model Match), экран Outputs (реверс)."],
    ["Мультиметр", [mx, my, 6], "Напряжение на камере."],
    ["Лупа", [cx - 2, cy - 8, 30], "Пайка приёмника и камеры."],
    ["Очки", [gx, gy, 12], "Канал и меню видеопередатчика, наклейка поляризации."],
    ["Батарея и тестер", [bx, by, 10], "Банки в покое и под нагрузкой, наклейка, термометр."],
    ["Схема пропеллеров", [sx2, sy2, 1], "Props in: какой проп на каком моторе."],
  ]);
  return { svg, P, labels, live: { tools: Object.fromEntries(Object.entries(TOOLS).map(([key, v]) => [key, v])) }, parts: S.count() };
}

export const defaults = { case: "arm", chk: "", verdict: "", truth: "", truthFor: "", done: "", bad: "", verdictSeen: "", solved: "", solvedNow: "", sharp: 0, flipSolved: 0 };
export const controls = [
  { id: "case", label: "Дело", type: "seg", options: CASES.map((c, i) => [c.id, `№${i + 1}`]), rebuild: true, resets: ["chk", "verdict", "truthFor", "solvedNow"] },
  { id: "chk", label: "Проверить (каждая — своим прибором)", type: "select", options: [["", "— выбери проверку —"], ...CASES.map((c, i) => ({ group: `№${i + 1} · ${c.title}`, items: c.checks.map(([l], j) => [`${c.id}:${j}`, l]) }))] },
  { id: "verdict", label: "Вердикт: в чём причина?", type: "select", options: [["", "— выбери причину —"], ...CASES.map((c, i) => ({ group: `№${i + 1} · ${c.title}`, items: Object.entries(c.causes).map(([key, l]) => [`${c.id}:${key}`, l]) }))] },
];
export const tour = [];

export function controller(root, built, state) {
  const P = built.P, T = built.live.tools;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const boardEl = q("board"), fxEl = q("fx"), lapEl = q("lap"), pEl = q("pscr"), mEl = q("mscr"), gEl = q("gscr");
  const sim = { t: 0 };
  let c = settle(state);
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      c = settle(st);
      const done = list(st.done).map(Number), bad = list(st.bad), solved = list(st.solved);
      const isSolved = st.solvedNow === c.id;
      // Доска.
      let b = txt(2.5, 6, `Дело №${CASES.indexOf(c) + 1} · ${esc(c.title)}`, "ws-bt") + (isSolved ? txt(96, 6, "РАСКРЫТО", "ws-bt good", "end") : "");
      const words = c.sym.split(" ");
      let line = "", y = 12.4;
      for (const w of words) { if ((line + " " + w).length > 40) { b += txt(2.5, y, esc(line.trim()), "ws-bs"); y += 4.6; line = ""; } line += " " + w; }
      b += txt(2.5, y, esc(line.trim()), "ws-bs");
      y += 7;
      b += txt(2.5, y, `Проверки: ${done.length}${bad.length ? ` · ошибок: ${bad.length}` : ""}`, "ws-bh");
      done.slice(-4).forEach((i) => { y += 5.6; const [l, , fn] = c.checks[i]; b += txt(2.5, y, `🔍 ${esc(l)}:`, "ws-bs") ; y += 4.4; b += txt(5.5, y, esc(fn(st.truth)), "ws-bc"); });
      b += txt(2.5, 54.5, `Раскрыто дел: ${solved.length} из 6  ${CASES.map((x) => (solved.includes(x.id) ? "✓" : "·")).join(" ")}`, "ws-bh");
      if (boardEl.innerHTML !== b) boardEl.innerHTML = b;
      // Подсветка прибора последней проверки.
      const last = done.length ? c.checks[done[done.length - 1]] : null;
      let fx = "";
      if (last) { const [x, y2, z] = T[last[1]]; const pulse = calm ? 0 : Math.sin(sim.t * 3) * 1.2; fx += `<path class="ws-ring" d="${k.ring(x, y2, 15 + pulse, z, P, 48)}"/>`; }
      fxEl.innerHTML = fx;
      // Экраны приборов показывают свою улику.
      const clue = (tool) => { const i = [...done].reverse().find((j) => c.checks[j][1] === tool); return i === undefined ? "" : c.checks[i][2](st.truth); };
      const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
      const lc = clue("laptop"), wrap = [];
      if (lc) { let cur = ""; for (const w of lc.split(" ")) { if ((cur + " " + w).trim().length > 19) { wrap.push(cur.trim()); cur = ""; } cur += " " + w; } wrap.push(cur.trim()); }
      lapEl.innerHTML = txt(2, 5, "Betaflight", "bf-t") + wrap.slice(0, 3).map((l, i) => txt(2, 11 + i * 4.6, esc(l), "ws-ls")).join("");
      pEl.innerHTML = clue("pult") ? txt(1, 4.6, esc(cut(clue("pult"), 9)), "ws-ps") : "";
      mEl.innerHTML = txt(10, 6, clue("meter") ? esc(clue("meter")) : "—", "ws-ms", "middle");
      gEl.innerHTML = txt(1.5, 5.6, clue("goggles") ? esc(cut(clue("goggles"), 16)) : "OSD", "ws-gs");
      // Светодиод приёмника: мигает трижды, если улика про Model Match.
      if (done.some((i) => c.checks[i][1] === "led")) {
        const [x, y2, z] = T.led; const a = k.iso([x, y2, z], P);
        const triple = st.truth === "mm" && c.id === "arm";
        const ph = sim.t % 1.6; const on = !triple || (ph < 0.9 && Math.floor(ph * 6.6) % 2 === 0);
        fxEl.innerHTML += `<ellipse cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" rx="2.4" ry="1.5" class="led${on ? " on" : ""}"/>`;
      }
      return true;
    },
    facts() {
      return { solved: list(state.solved).length, sharp: !!Number(state.sharp), flipSolved: !!Number(state.flipSolved) };
    },
    readout() {
      return `Дело №${CASES.indexOf(c) + 1} · проверок ${list(state.done).length} · раскрыто ${list(state.solved).length} из 6`;
    },
    metrics() {
      return [
        ["Дело", c.title, ""],
        ["Проверок сделано", `${list(state.done).length}`, "чем меньше, тем лучше"],
        ["Ошибок в вердикте", `${list(state.bad).length}`, ""],
        ["Раскрыто дел", `${list(state.solved).length} из 6`, ""],
      ];
    },
    note() {
      const [cid] = String(state.chk || "").split(":");
      const [vid, vk] = String(state.verdict || "").split(":");
      if (state.chk && cid !== c.id) return "<b>Эта проверка — из другого дела.</b> Выбери проверку из группы текущего дела.";
      if (state.verdict && vid !== c.id) return "<b>Этот вердикт — из другого дела.</b> Выбери причину из группы текущего дела.";
      if (state.blind === c.id && state.solvedNow !== c.id) return "<b>Вердикт совпал, но улик нет.</b> Сначала сделай проверку — без неё дело не засчитывается.";
      if (state.solvedNow === c.id) { const n = list(state.done).length, w = list(state.bad).length; return `<b>Дело раскрыто</b> за ${n} ${n === 1 ? "проверку" : n >= 2 && n <= 4 ? "проверки" : "проверок"}${w ? `, ошибок: ${w}` : " без ошибок"}. Выбери другое дело. Чтобы повторить это — переключись на другое и вернись: причина может оказаться другой.`; }
      if (vk && list(state.bad).includes(vk)) return list(state.done).length ? "<b>Улики с этим не сходятся.</b> Перечитай их на доске." : "<b>Догадка без улик.</b> Сначала проверь что-нибудь!";
      return `<b>Что видим:</b> ${c.sym} Выбери проверку — прибор подсветится, улика появится на доске.`;
    },
  };
}
