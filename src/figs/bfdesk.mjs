// Fig: настройка в Betaflight. Ноутбук с Configurator (флаги запрета арма и сводка вкладок), дрон на столе
// по USB (может лежать наклонённым на коробке), батарея, пульт с тумблером ARM. Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, pcb, plug, motor, propSvg, fmt, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -92, y: -126, w: 180, d: 246, r: 8 };
const SCR = { x: -88, y: -60, w: 4, d: 132, z0: 4, h: 72 };
const SW = SCR.d - 8;
const DR = [18, -40]; // центр дрона
const DZ = 12; // высота рамы над столом (на подставке)
const BAT = { x: 46, y: -112, w: 22, d: 34 };
const PULT = [44, 70];

export const FLAGS = {
  RXLOSS: "нет данных с приёмника → «Порты» и протокол",
  THROTTLE: "газ не внизу → порядок каналов",
  NO_ACC_CAL: "акселерометр не откалиброван → «Система»",
  MOTOR_PROTO: "не выбран протокол ESC → «Моторы»",
  ANGLE: "наклон больше угла арма → положи ровно или «Конфигурация» (small_angle)",
  MSP: "подключён Configurator — это норма",
};
const TOUCHED = ["uart", "prov", "map", "arm", "acc", "angle", "proto"];

export function bfModel(s) {
  const f = [];
  const accOk = !!s.acc && !s.tilt;
  if (Number(s.uart) !== 2 || s.prov !== "CRSF") f.push("RXLOSS");
  else if (s.map !== "AETR") f.push("THROTTLE");
  if (!accOk) f.push("NO_ACC_CAL");
  if (s.proto === "none") f.push("MOTOR_PROTO");
  if (s.tilt && Number(s.angle) < 180) f.push("ANGLE");
  f.push("MSP");
  const untouched = TOUCHED.every((key) => String(s[key]) === String(defaults[key]));
  const blockers = f.filter((x) => x !== "MSP");
  const armed = !!s.armSw && s.arm === "AUX1" && !blockers.length;
  const motorTest = !!s.mtest && s.proto !== "none" && !s.props && !!s.batt;
  return { flags: f, blockers, accOk, untouched, armed, motorTest, rxOk: !f.includes("RXLOSS") };
}

export const meta = {
  id: "bfdesk",
  title: "Настройка в Betaflight",
  hint: "Вкладки Betaflight — справа, по порядку",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Флаги на экране — причины, по которым полётник не даёт заармиться; MSP — норма" },
    { mark: "raised", label: "Ноутбук с Configurator, дрон по USB, батарея, пульт с тумблером ARM" },
    { mark: "edge", label: "Строки сводки: зелёная — вкладка настроена, красная — здесь причина флага" },
  ],
  caption: "Порядок настройки: бэкап в CLI (diff all → файл) до любых изменений → «Порты»: Serial RX на UART, куда припаян приёмник → «Приёмник»: протокол CRSF и порядок каналов как на пульте → «Режимы»: ARM на тумблер → «Система»: калибровка акселерометра на ровной поверхности → «Моторы»: протокол DShot, тест моторов только без пропеллеров и от батареи. Флаги запрета арма сами подсказывают, где ошибка.",
  aria: "Справа по порядку: бэкап, порт, протокол и порядок каналов, режим ARM, положение борта и калибровка, угол арма, протокол ESC, пропеллеры, батарея, тумблер ARM и тест моторов.",
  missions: [
    {
      id: "backup", look: ["laptop"], touch: ["backup"], see: "строку «CLI · бэкап» на экране",
      text: "Сделай резервную копию ДО любых изменений",
      check: (f, s) => !!s.backup && f.untouched,
      predict: { q: "С чего начинают настройку дрона в Betaflight?", options: ["Сразу меняют порты и режимы", "С бэкапа: diff all → сохранить в файл", "С прошивки новой версии"], right: 1 },
      setup: {},
    },
    {
      id: "rx", look: ["laptop", "drone"], touch: ["uart", "prov"], see: "флаг RXLOSS и строки «Порты» и «Приёмник»",
      text: "Убери флаг RXLOSS: полётник должен «услышать» приёмник (он припаян к R2/T2)",
      check: (f) => f.rxOk,
      predict: { q: "Приёмник ELRS припаян к R2/T2. Что нужно, чтобы полётник его услышал?", options: ["Serial RX на UART2 и протокол CRSF", "Serial RX на UART1 и протокол SBUS", "Ничего: найдёт сам"], right: 0 },
      setup: { backup: true },
    },
    {
      id: "ready", look: ["laptop", "pult", "drone"], touch: ["map", "arm", "tilt", "acc", "proto", "armSw"], see: "флаги на экране — по одному исчезают",
      text: "Убери все флаги (кроме MSP) и щёлкни тумблером ARM на пульте",
      check: (f) => f.armed,
      predict: { q: "Флаг MSP в списке запретов арма — это…", options: ["Ошибка, надо чинить", "Норма: подключён компьютер; отключишь USB — борт заармится", "Нет связи с приёмником"], right: 1 },
      confirm: { q: "Почему калибруют акселерометр на ровной поверхности?", options: ["Калибровка запоминает «горизонт»: наклонённый борт потом будет уплывать в Angle", "Иначе не загорится светодиод", "Это не важно"], right: 0, miss: "Поставь «Борт лежит наклонённым» — калибровка сбросится. Горизонт запоминается в том положении, в каком борт лежал." },
      setup: { backup: true, uart: 2, prov: "CRSF" },
    },
    {
      id: "motors", look: ["drone", "battery"], touch: ["proto", "props", "batt", "mtest"], see: "моторы дрона — крутятся по очереди",
      text: "Проверь моторы безопасно",
      check: (f) => f.motorTest,
      predict: { q: "Как безопасно проверить моторы во вкладке «Моторы»?", options: ["С пропеллерами, от USB", "Без пропеллеров, от батареи", "С пропеллерами, от батареи"], right: 1 },
      setup: { backup: true, uart: 2, prov: "CRSF" },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [SCR.x, SCR.y, SCR.z0 + SCR.h + 2], [SCR.x, SCR.y + SCR.d, SCR.z0 + SCR.h + 2]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const ZUP = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const M = bfModel(state);
  basePlate(S, PLATE);
  labelPlate(S, { x: 62, y: 96, w: 20, d: 20, r: 1.5 });

  // ── Ноутбук ──
  S.group = "laptop";
  const base = { x: SCR.x + 4, y: SCR.y, w: 40, d: SCR.d, r: 2.4 };
  S.box(base, 0, 3.4, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  const keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 15; c++) keys.push([base.x + 6 + r * 5.4, base.y + 12 + c * 7.6, 3.4]);
  S.dots(keys, { size: 0.5, tone: "lo" }, [base.x + 14, base.y + base.d / 2, 3.5]);
  S.box({ ...SCR, r: 1.6 }, SCR.z0, SCR.h, { tone: "mid", inner: k.lineSvg(k.sideSeam(SCR, SCR.z0 + 3, P, 3), { tone: "faint" }) }, { bevel: 0.4, ref: [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2] });
  const lf = k.sideMatrix([SCR.x + SCR.w, SCR.y + SCR.d - 4], SCR.z0 + SCR.h - 4, P, "right");
  S.raw([SCR.x + SCR.w + 0.4, SCR.y + SCR.d / 2, SCR.z0 + SCR.h / 2], `<g transform="${lf}"><rect x="0" y="0" width="${SW}" height="${SCR.h - 8}" rx="1.4" class="bf-screen"/><g data-part="bf"></g></g>`, { bias: 4 });

  // ── Дрон на подставке (или наклонённым на коробке), USB от ноутбука ──
  S.group = "drone";
  const [cx, cy] = DR;
  const tilt = state.tilt ? 0.24 : 0; // наклон вдоль x (≈14°)
  const zAt = (x) => DZ + (x - cx) * Math.tan(tilt);
  if (state.tilt) S.box({ x: cx + 6, y: cy - 16, w: 24, d: 32, r: 1.5 }, 0, 10, { tone: "mid", inner: k.lineSvg(k.sideSeam({ x: cx + 6, y: cy - 16, w: 24, d: 32 }, 5, P, 3), { tone: "faint" }) }, { bevel: 0.4 });
  else S.box({ x: cx - 12, y: cy - 12, w: 24, d: 24, r: 2 }, 0, DZ - 3, { tone: "lo" }, { bevel: 0.4 });
  const mot = [[cx + 20, cy + 20], [cx + 20, cy - 20], [cx - 20, cy + 20], [cx - 20, cy - 20]];
  const bodyZ = zAt(cx);
  pcb(S, { x: cx - 13, y: cy - 13, w: 26, d: 26, r: 2 }, bodyZ, { chips: [{ x: cx, y: cy, w: 9, d: 9, h: 1.2, dot: true }] });
  for (const [mx, my] of mot) S.tube([[cx, cy, bodyZ + 0.8], [mx, my, zAt(mx) + 0.8]], 1.8, { tone: "mid", maxLength: 30 });
  const motTops = mot.map(([mx, my], i) => [mx, my, motor(S, mx, my, zAt(mx), { r: 6, h: 6, ribs: 12 }).top, i]);
  if (state.props) motTops.forEach(([x, y, z, i]) => S.raw([x, y, z + 6], propSvg(P, x, y, z + 1.4, 16, i * 0.8, { blades: 3 }), { bias: 20 }));
  S.raw([cx, cy, bodyZ + 20], `<g data-part="motors"></g>`, { bias: 30 });
  S.tube([[base.x + base.w, base.y + 28, 2], [cx - 30, cy + 6, 1.2], [cx - 14, cy + 4, bodyZ + 1]], 0.8, { tone: "mid", bendR: 6, maxLength: 12 });

  // ── Батарея ──
  S.group = "battery";
  S.box({ ...BAT, r: 3 }, 0, 14, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(BAT, 7, P, 4), { tone: "faint" }) }, { bevel: 0.6 });
  const plugEnd = state.batt ? [cx + 6, cy - 14] : [BAT.x - 6, BAT.y + BAT.d + 14];
  S.tube([[BAT.x + 8, BAT.y + BAT.d, 4], [BAT.x + 4, BAT.y + BAT.d + 8, 1.4], [plugEnd[0], plugEnd[1], 1.4]], 1, { tone: "mid", bendR: 5, maxLength: 12 });
  plug(S, plugEnd[0], plugEnd[1], 0.6, 5, 6, 3.4, { tone: "hi" });

  // ── Пульт с тумблером ARM ──
  S.group = "pult";
  const [px, py] = PULT;
  const body = { x: px - 14, y: py - 24, w: 28, d: 48, r: 6 };
  S.box(body, 0, 9, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(body, 9, P, 6), { tone: "faint" }) }, { bevel: 0.8 });
  for (const gy of [py - 11, py + 11]) S.cyl(px + 2, gy, 4.4, 9, 1.4, { tone: "mid" });
  const sw = [px - 9, py - 18];
  S.box({ x: sw[0] - 2.4, y: sw[1] - 3, w: 4.8, d: 6, r: 0.8 }, 9, 2, { tone: "mid" }, { steps: 2 });
  const lever = state.armSw ? [sw[0] - 5, sw[1], 17] : [sw[0] + 5, sw[1], 17];
  S.tube([[sw[0], sw[1], 11], lever], 0.7, { tone: "hi" }, { bias: 2 });
  S.solid(G.sphereOf(lever, 1.3, P), { tone: "hi", lit: !!state.armSw }, lever, { bias: 2.4 });
  const pf = k.sideMatrix([body.x + body.w, sw[1] + 6], 7, P, "right");
  S.raw([body.x + body.w + 0.3, sw[1], 4], `<g transform="${pf}">${txt(0, 0, "ARM · AUX1", "bd-lab")}</g>`, { bias: 2 });

  S.group = null;
  const svg = k.figureSvg({ width: W, height: H, label: "Стол настройки: ноутбук с Betaflight Configurator, дрон по USB, батарея и пульт с тумблером ARM.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Betaflight Configurator", [SCR.x + SCR.w, SCR.y + SCR.d / 2, SCR.z0 + SCR.h], "Вверху флаги запрета арма, ниже — сводка вкладок: что уже настроено."],
    ["Дрон по USB", [cx, cy, bodyZ + 4], state.tilt ? "Лежит наклонённым на коробке: калибровать так нельзя, а при угле арма 25° будет флаг ANGLE." : "Лежит ровно — можно калибровать акселерометр."],
    ["Батарея", [BAT.x + BAT.w / 2, BAT.y + BAT.d / 2, 14], "От USB моторы не крутятся: для теста нужна батарея (пропеллеры сняты!)."],
    ["Тумблер ARM", [sw[0], sw[1], 14], "AUX1: в «Режимах» на этот канал назначают ARM."],
  ]);
  return { svg, P, labels, model: M, live: { motTops }, parts: S.count() };
}

export const defaults = { backup: false, uart: 0, prov: "none", map: "TAER", arm: "none", tilt: true, acc: false, angle: 25, proto: "none", props: true, batt: false, armSw: false, mtest: false };
export const controls = [
  { id: "backup", label: "CLI: diff all → сохранить бэкап в файл", type: "check" },
  { id: "uart", label: "Порты: Serial RX на", type: "seg", options: [[0, "—"], [1, "UART1"], [2, "UART2"], [3, "UART3"]], num: true },
  { id: "prov", label: "Приёмник: протокол", type: "seg", options: [["none", "—"], ["SBUS", "SBUS"], ["IBUS", "IBUS"], ["CRSF", "CRSF"]] },
  { id: "map", label: "Приёмник: порядок каналов (пульт шлёт AETR)", type: "seg", options: [["TAER", "TAER"], ["AETR", "AETR"]] },
  { id: "arm", label: "Режимы: ARM на канале", type: "seg", options: [["none", "—"], ["AUX1", "AUX1"], ["AUX2", "AUX2"]] },
  { id: "tilt", label: "Борт лежит наклонённым (на коробке, в руках)", type: "check", rebuild: true, resets: ["acc"] },
  { id: "acc", label: "Система: калибровать акселерометр", type: "check" },
  { id: "angle", label: "Конфигурация: угол арма (small_angle)", type: "seg", options: [[25, "25°"], [180, "180° — по курсу"]], num: true },
  { id: "proto", label: "Моторы: протокол ESC", type: "seg", options: [["none", "—"], ["PWM", "PWM"], ["DSHOT300", "DShot300"], ["DSHOT600", "DShot600"]] },
  { id: "props", label: "Пропеллеры стоят", type: "check", rebuild: true },
  { id: "batt", label: "Батарея подключена", type: "check", rebuild: true },
  { id: "armSw", label: "Тумблер ARM на пульте (AUX1)", type: "check", rebuild: true },
  { id: "mtest", label: "Моторы: тест — крутнуть по очереди", type: "check" },
];
export const tour = [
  { at: 0, set: { backup: true } },
  { at: 2, set: { uart: 2, prov: "CRSF" } },
  { at: 4, set: { map: "AETR", tilt: false } },
  { at: 6, set: { acc: true, proto: "DSHOT600", arm: "AUX1" } },
  { at: 8, set: { armSw: true } },
  { at: 11, set: { armSw: false } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const bfEl = root.querySelector('[data-part="bf"]'), motEl = root.querySelector('[data-part="motors"]');
  const sim = { t: 0 };
  let M = built.model;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      M = bfModel(st);
      // Экран: флаги-чипы и сводка вкладок.
      let s = txt(3, 7, "Betaflight Configurator", "bf-t");
      let x = 3;
      for (const f of M.flags) {
        const w = f.length * 2.5 + 3;
        s += `<rect x="${x.toFixed(1)}" y="10" width="${w.toFixed(1)}" height="6" rx="1.6" class="bd-flag${f === "MSP" ? " ok" : ""}"/>` + txt(x + w / 2, 14.4, f, "bd-ft", "middle");
        x += w + 2;
      }
      if (M.armed) s += txt(SW - 3, 14.4, "ARMED", "bf-t good", "end");
      const rows = [
        ["CLI · бэкап", st.backup ? "сохранён" : "нет", !!st.backup],
        ["Порты · Serial RX", Number(st.uart) ? `UART${st.uart}` : "—", Number(st.uart) === 2],
        ["Приёмник", `${st.prov === "none" ? "—" : st.prov} · ${st.map}${M.rxOk ? ` · газ ${st.map === "AETR" ? "1000" : "1500"}` : ""}`, M.rxOk && st.map === "AETR"],
        ["Режимы · ARM", st.arm === "none" ? "—" : st.arm, st.arm === "AUX1"],
        ["Система · акселерометр", M.accOk ? "откалиброван" : st.acc ? "сбит: был наклон" : "нет", M.accOk],
        ["Конфигурация · угол арма", `${st.angle}°`, !(st.tilt && Number(st.angle) < 180)],
        ["Моторы · протокол", st.proto === "none" ? "—" : st.proto, st.proto !== "none"],
      ];
      rows.forEach(([a, b, ok], i) => {
        const y = 24 + i * 6.6;
        s += `<circle cx="5" cy="${y - 1.3}" r="1.3" class="bd-dot${ok ? " ok" : ""}"/>` + txt(8.5, y, a, "bd-r") + txt(SW - 3, y, b, `bd-r${ok ? " good" : ""}`, "end");
      });
      if (bfEl.innerHTML !== s) bfEl.innerHTML = s;
      // Тест моторов: по очереди 1-2-3-4, кольцо на крутящемся моторе. С пропеллерами — тревога.
      let m = "";
      const blocked = st.mtest && !M.motorTest;
      if (st.mtest && M.motorTest) {
        const i = calm ? 0 : Math.floor(sim.t * 1.6) % 5;
        if (i < 4) { const [mx, my, mz] = L.motTops[i]; m += `<path class="iso-line" data-tone="lit" style="stroke-width:1.1" d="${k.ring(mx, my, 8.5, mz + 0.5, P, 32)}"/>`; }
      } else if (blocked && st.props && st.proto !== "none" && st.batt && Math.floor(sim.t * 3) % 2 === 0) {
        for (const [mx, my, mz] of L.motTops) m += `<path class="iso-line" data-tone="red" style="stroke-width:1" d="${k.ring(mx, my, 17, mz + 1.4, P, 40)}"/>`;
      }
      motEl.innerHTML = m;
      return true;
    },
    facts() {
      return { untouched: M.untouched, rxOk: M.rxOk, armed: M.armed, motorTest: M.motorTest, blockers: M.blockers.length };
    },
    readout() {
      // Флаги с экрана Betaflight — каждый отдельной плашкой: ✗ — причина запрета арма, MSP — норма.
      const msp = "MSP: USB, это норма";
      if (M.armed) return `✓ ARMED · ${msp}`;
      return `${M.blockers.length ? M.blockers.map((x) => `✗ ${x}`).join(" · ") : "✓ причин запрета нет"} · ${msp}`;
    },
    // Объяснение плашки итога (телефон: нажатие на плашку).
    explain(chip) {
      const code = chip.replace(/^[✗✓]\s*/, "").split(":")[0].trim();
      if (FLAGS[code]) return `${FLAGS[code][0].toUpperCase()}${FLAGS[code].slice(1)}.`;
      if (code === "ARMED") return "Полётник заармлен: моторы готовы крутиться. Осторожно!";
      if (/причин запрета нет/.test(chip)) return "Флагов, кроме MSP, нет. Отключишь USB — тумблер ARM заармит борт.";
      return "";
    },
    metrics() {
      return [
        ["Флаги запрета арма", M.blockers.length ? M.blockers.join(", ") : "нет (MSP — норма)", ""],
        ["Приёмник слышен", M.rxOk ? "да" : "нет (RXLOSS)", ""],
        ["Арм", M.armed ? "заармлен" : state.armSw ? "запрещён" : "тумблер выкл.", ""],
        ["Тест моторов", M.motorTest ? "крутятся по очереди" : state.mtest ? "не выполнен" : "—", ""],
      ];
    },
    note() {
      if (state.mtest && !M.motorTest) {
        if (state.proto === "none") return "<b>Сначала выбери протокол ESC</b> во вкладке «Моторы» — например, DShot600.";
        if (state.props) return "<b class='bad'>Стоп!</b> С пропеллерами на столе моторы — это четыре лезвия. Сними пропеллеры.";
        if (!state.batt) return "<b>Моторы молчат:</b> от USB они не питаются. Подключи батарею (пропеллеры сняты!).";
      }
      if (state.mtest && M.motorTest) return "<b>Моторы крутнулись по очереди: 1, 2, 3, 4.</b> Проверь номер и направление вращения каждого.";
      if (state.armSw) {
        if (state.arm !== "AUX1") return "<b>Тумблер щёлкнул, но ARM не назначен на AUX1</b> — ничего не произошло. Вкладка «Режимы».";
        if (M.blockers.length) return `<b>Арм запрещён.</b> Полётник сам называет причины: ${M.blockers.map((x) => `<b>${x}</b> — ${FLAGS[x]}`).join("; ")}.`;
        return "<b>Флагов нет, кроме MSP.</b> MSP значит «подключён компьютер»: отключишь USB — и борт заармится. Готово!";
      }
      if (state.acc && state.tilt) return "<b>Борт лежит наклонённым</b> — калибровка запомнит кривой «горизонт», и в Angle дрон будет уплывать. Положи борт ровно и откалибруй заново.";
      if (state.backup && M.untouched) return "<b>Бэкап сделан до изменений.</b> Теперь любую ошибку можно откатить.";
      if (state.prov !== "none" && state.prov !== "CRSF") return "<b>ELRS и Crossfire говорят с полётником на языке CRSF.</b> Выбери CRSF.";
      if (Number(state.uart) && Number(state.uart) !== 2) return `<b>UART${state.uart}?</b> Приёмник припаян к R2/T2 — там его и ищи.`;
      if (state.proto === "PWM") return "<b>PWM работает, но курс использует DShot:</b> точное число с контрольной суммой, калибровка не нужна.";
      return `Флаги вверху экрана — причины, по которым полётник не даёт заармиться. Сейчас: ${M.blockers.map((x) => `<b>${x}</b> — ${FLAGS[x]}`).join("; ") || "нет"}.`;
    },
  };
}
