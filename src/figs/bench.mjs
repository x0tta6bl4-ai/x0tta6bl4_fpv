// Fig: стол пайки. Приёмник ELRS и полётник с подписанными площадками, четыре провода (куда припаять —
// выбирается справа), ноутбук с вкладкой «Порты», учебная плата с тремя пайками, мотор с пропеллером,
// видеопередатчик с антенной, батарея через smoke stopper и мультиметр для прозвонки. Зритель — с +x.
import { k, G, scene, basePlate, labelPlate, pcb, plug, motor, propSvg, fmt, labelsAt } from "../figkit.mjs";

const W = 660, H = 420;
const PLATE = { x: -92, y: -128, w: 182, d: 248, r: 8 };
const FC = { x: -48, y: -44, w: 66, d: 66 };
const RX = { x: -42, y: 46, w: 36, d: 26 };
const VTX = { x: -78, y: -30, w: 22, d: 26 };
const LAP = { x: -88, y: 34, w: 4, d: 74, z0: 4, h: 50 }; // экран ноутбука (панель), база — перед ним
const PRACT = { x: 32, y: 34, w: 36, d: 76 };
const BAT = { x: 46, y: -110, w: 26, d: 40 };
const STOP = { x: 40, y: -58, w: 16, d: 20 };
const DMM = { x: 50, y: -10, w: 26, d: 34 };
const MOT = [-14, -100];
const SWX = 54; // переключатели Serial RX на экране «Порты»

// Площадки полётника: внешний ряд (ближе к приёмнику) и внутренний.
export const FCP = ["VBAT", "5V", "G", "CAM", "T1", "R1", "T2", "R2"];
const RXP = ["G", "5V", "TX", "RX"];
const padAt = (name) => {
  const i = FCP.indexOf(name);
  const row = i % 4, outer = i < 4;
  return [FC.x + 9 + row * 14, FC.y + FC.d - (outer ? 8 : 24)];
};
const rxPadAt = (i) => [RX.x + 6 + i * 8.4, RX.y + 4];
const COLD = "3"; // №1 — перемычка, №2 — хорошая, №3 — холодная

// Проверка пайки (как в книге): питание «как есть», данные — крест-накрест, один номер UART.
export function wiring(s) {
  const w = { G: s.wG, "5V": s.w5, TX: s.wTX, RX: s.wRX };
  const bad = [], notes = [];
  if (Object.values(w).some((v) => !v || v === "none")) return { done: false, ok: false, bad, notes: ["Нужно 4 провода: G, 5V, TX и RX."], short: false };
  let short = false;
  if (w["5V"] === "VBAT") { bad.push("5V"); short = true; notes.push("5V приёмника на VBAT — там напряжение батареи (до 25 В). Приёмник сгорит!"); }
  else if (w["5V"] !== "5V") { bad.push("5V"); notes.push("Питание «как есть»: 5V → 5V."); }
  if (w.G !== "G") { bad.push("G"); notes.push("Земля к земле: G → G."); }
  if (!/^R\d$/.test(w.TX)) { bad.push("TX"); notes.push(/^T/.test(w.TX) ? "TX → T: это «рот ко рту», никто никого не слышит. TX («рот») приёмника — на R («ухо») полётника." : "TX приёмника должен идти на площадку R (приём) полётника."); }
  if (!/^T\d$/.test(w.RX)) { bad.push("RX"); notes.push("RX приёмника — на T полётника."); }
  if (!bad.length && w.TX[1] !== w.RX[1]) { bad.push("RX"); notes.push(`TX и RX должны быть одного номера UART: сейчас R${w.TX[1]} и T${w.RX[1]}.`); }
  return { done: true, ok: !bad.length, bad, notes, short, uart: !bad.length ? w.TX[1] : null };
}
export function powerUp(s, wr) {
  if (!s.power) return { on: false };
  const issues = [];
  const trip = wr.short && s.stop;
  const smokeRx = wr.short && !s.stop;
  const smokeVtx = !s.ant;
  if (!s.beep) issues.push("не прозвонил «+» и «−» — замыкание по питанию могло бы сжечь всё");
  if (!s.stop) issues.push("подал питание без smoke stopper");
  if (s.props) issues.push("пропеллеры стоят — случайный запуск моторов опасен");
  if (!s.ant) issues.push("видеопередатчик без антенны перегревается");
  if (wr.short) issues.push(trip ? "5V приёмника на VBAT — smoke stopper сработал и спас приёмник" : "5V приёмника на VBAT — приёмник сгорел");
  return { on: true, trip, smokeRx, smokeVtx, issues, ok: !issues.length && !trip };
}

export const meta = {
  id: "bench",
  title: "Стол пайки",
  hint: "Куда паять провода — справа",
  narrowZoom: 1.15,
  keys: [
    { mark: "lit", label: "Провода: тёмный — земля G, светлый — 5V, серые — данные TX/RX; красный — припаян неправильно" },
    { mark: "raised", label: "Приёмник, полётник, ноутбук, учебная плата с пайками, мотор, VTX, батарея, smoke stopper, мультиметр" },
    { mark: "edge", label: "Подписи площадок напечатаны на платах, как на настоящих" },
  ],
  caption: "Приёмник паяют к полётнику: питание «как есть» (G → G, 5V → 5V), данные крест-накрест — TX («рот») приёмника на R («ухо») полётника, RX на T, с одним номером UART. Этот номер включают в Betaflight → «Порты» → Serial RX. Хорошая пайка — гладкая блестящая «горка», холодная — матовый шарик. Перед первым включением: прозвонить «+» и «−», прикрутить антенны, подключить через smoke stopper, снять пропеллеры.",
  aria: "Справа: куда припаян каждый из четырёх проводов приёмника, какой порт включён в Betaflight, какая пайка холодная и подготовка к первому включению.",
  missions: [
    {
      id: "wire", look: ["rx", "fc", "wires"], touch: ["wG", "w5", "wTX", "wRX"], see: "подписи площадок на платах и цвет проводов",
      text: "Припаяй приёмник к полётнику правильно: выбери справа, куда идёт каждый провод",
      check: (f) => f.wireOk,
      predict: { q: "Куда паять провод TX приёмника?", options: ["На TX (T1) полётника — одинаковые к одинаковым", "На RX (R1) полётника — «рот» к «уху»", "На 5V"], right: 1 },
      setup: { wG: "none", w5: "none", wTX: "none", wRX: "none", power: false },
    },
    {
      id: "uart", look: ["laptop", "fc"], touch: ["port"], see: "площадки, куда припаян приёмник, и вкладку «Порты»",
      text: "Приёмник припаян к R2/T2. Включи Serial RX на нужном UART в Betaflight",
      check: (f) => f.portOk,
      predict: { q: "Приёмник припаян к площадкам R2 и T2. Где включить Serial RX?", options: ["UART1", "UART2", "UART3"], right: 1 },
      setup: { wG: "G", w5: "5V", wTX: "R2", wRX: "T2", port: 1, power: false },
    },
    {
      id: "joint", look: ["joints"], touch: ["pick"], see: "три пайки на учебной плате",
      text: "Найди холодную пайку среди трёх на учебной плате",
      check: (f, s) => s.pick === COLD,
      feedback: (f, s) => (s.pick === "1" ? "№1 — перемычка: припой замкнул две площадки. Тоже брак, но не холодная." : s.pick === "2" ? "№2 — хорошая пайка: гладкая блестящая «горка», припой растёкся по площадке." : ""),
      setup: { pick: "0" },
    },
    {
      id: "power", look: ["power", "dmm", "motor", "vtx"], touch: ["beep", "ant", "stop", "props", "power"], see: "светодиоды, smoke stopper и дымок",
      text: "Подай питание первый раз и ничего не сожги",
      check: (f) => f.powerOk,
      predict: { q: "Что обязательно сделать ДО первой подачи питания?", options: ["Поставить пропеллеры, чтобы сразу проверить тягу", "Прозвонить «+»/«−», прикрутить антенны, smoke stopper, снять пропеллеры", "Подключить самую мощную батарею"], right: 1 },
      setup: { wG: "G", w5: "5V", wTX: "R1", wRX: "T1", port: 1, beep: false, ant: false, stop: false, props: true, power: false },
    },
  ],
};

function projection() {
  return k.fitProjection([...k.boxCorners(PLATE, -17, 0), [LAP.x, LAP.y, LAP.z0 + LAP.h + 2], [LAP.x, LAP.y + LAP.d, LAP.z0 + LAP.h + 2], [VTX.x + 8, VTX.y + 13, 40]], W, H, { pad: 18, azimuth: 36 });
}
const txt = (x, y, s, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${s}</text>`;
const ZUP = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

export function render(state) {
  const P = projection();
  const S = scene(P);
  const at = (q) => k.iso(q, P);
  const wr = wiring(state);
  const pw = powerUp(state, wr);
  basePlate(S, PLATE);
  labelPlate(S, { x: 64, y: 86, w: 20, d: 28, r: 1.5 });

  // ── Полётник на стойках, площадки с подписями ──
  S.group = "fc";
  for (const [sx, sy] of k.corners(FC, 4)) S.cyl(sx, sy, 2, 0, 6, { tone: "mid", crease: "none" });
  const fcTop = pcb(S, { ...FC, r: 2 }, 6, { chips: [{ x: FC.x + 30, y: FC.y + 18, w: 14, d: 14, h: 1.4, dot: true, legs: 7 }, { x: FC.x + 54, y: FC.y + 30, w: 6, d: 6, h: 1 }, { x: FC.x + 54, y: FC.y + 12, w: 5, d: 8, h: 1.6 }] });
  let fcl = "";
  for (const name of FCP) {
    const [px, py] = padAt(name);
    S.box({ x: px - 3.5, y: py - 4, w: 7, d: 8, r: 0.8 }, fcTop, 0.5, { tone: "hi" }, { steps: 2, bias: 0.4 });
    fcl += `<g transform="${k.topMatrix([px + 1.6, py - 5.4], fcTop + 0.05, P, "y")}">${txt(0, 0, name, "bn-pad")}</g>`;
  }
  S.raw([FC.x + FC.w / 2, FC.y + FC.d - 15, fcTop + 0.1], fcl, { bias: 0.6 });
  S.raw([FC.x + 58, FC.y + 44, fcTop + 2], `<g data-part="fcled"></g>`, { bias: 3 });
  const ledFc = [FC.x + 58, FC.y + 44, fcTop + 0.8];

  // ── Приёмник на поролоне, антенна ──
  S.group = "rx";
  S.box({ x: RX.x - 2, y: RX.y - 2, w: RX.w + 4, d: RX.d + 4, r: 2 }, 0, 3, { tone: "lo" }, { bevel: 0.4 });
  const rxTop = pcb(S, { ...RX, r: 1 }, 3, { holes: false, chips: [{ x: RX.x + 26, y: RX.y + 18, w: 8, d: 7, h: 1.2, dot: true }] });
  let rxl = "";
  RXP.forEach((name, i) => {
    const [px, py] = rxPadAt(i);
    S.box({ x: px - 2.8, y: py - 2.8, w: 5.6, d: 5.6, r: 0.6 }, rxTop, 0.4, { tone: "hi" }, { steps: 2, bias: 0.4 });
    rxl += `<g transform="${k.topMatrix([px + 1.6, py + 13], rxTop + 0.05, P, "y")}">${txt(0, 0, name, "bn-pad")}</g>`;
  });
  S.raw([RX.x + RX.w / 2, RX.y + RX.d / 2, rxTop + 0.1], rxl, { bias: 0.6 });
  const antBase = [RX.x + RX.w - 4, RX.y + RX.d - 3];
  if (state.ant) {
    S.tube([[antBase[0], antBase[1], rxTop + 0.5], [antBase[0], antBase[1] + 4, rxTop + 6], [antBase[0], antBase[1] + 4, 34]], 0.6, { tone: "mid", bendR: 2 });
    S.tube([[antBase[0] - 7, antBase[1] + 4, 34], [antBase[0] + 7, antBase[1] + 4, 34]], 0.7, { tone: "hi" });
  } else S.cyl(antBase[0], antBase[1], 1.2, rxTop, 1.6, { tone: "mid" });
  S.raw([RX.x + 6, RX.y + 21, rxTop + 2], `<g data-part="rxled"></g>`, { bias: 3 });
  const ledRx = [RX.x + 6, RX.y + 21, rxTop + 0.6];

  // ── Провода приёмник → полётник ──
  S.group = "wires";
  const WIRE = { G: state.wG, "5V": state.w5, TX: state.wTX, RX: state.wRX };
  RXP.forEach((name, i) => {
    const to = WIRE[name];
    if (!to || to === "none") return;
    const [rx, ry] = rxPadAt(i);
    const [fx, fy] = padAt(to);
    const tone = wr.done && wr.bad.includes(name) ? "red" : name === "G" ? "lo" : name === "5V" ? "lit" : "mid";
    S.tube([[rx, ry, rxTop + 0.6], [rx, ry - 6, 2], [fx, FC.y + FC.d + 6, 2], [fx, FC.y + FC.d + 2, fcTop + 1.6], [fx, fy, fcTop + 0.9]], 0.6, { tone, bendR: 3, maxLength: 10 });
    S.solid(G.sphereOf([fx, fy, fcTop + 0.9], 1.2, P, { steps: 16 }), { tone: "hi" }, [fx, fy, fcTop + 1], { bias: 1 });
  });

  // ── Видеопередатчик с антенной ──
  S.group = "vtx";
  const vTop = pcb(S, { ...VTX, r: 1 }, 2, { holes: true, chips: [{ x: VTX.x + 11, y: VTX.y + 12, w: 9, d: 9, h: 1.2 }] });
  S.box({ x: VTX.x - 2, y: VTX.y - 2, w: VTX.w + 4, d: VTX.d + 4, r: 1.4 }, 0, 2, { tone: "lo" }, { bevel: 0.3 });
  const vc = [VTX.x + 5, VTX.y + VTX.d / 2];
  S.cyl(vc[0], vc[1], 1.8, vTop, 3, { tone: "mid" });
  if (state.ant) {
    S.tube([[vc[0], vc[1], vTop + 3], [vc[0], vc[1], vTop + 22]], 0.8, { tone: "hi" });
    S.solid(G.sphereOf([vc[0], vc[1], vTop + 25], 3, P), { tone: "hi" }, [vc[0], vc[1], vTop + 25]);
  }
  S.tube([[VTX.x + VTX.w, VTX.y + 8, vTop], [FC.x - 4, FC.y + 10, 2], [FC.x + 4, FC.y + 10, fcTop + 0.8]], 0.5, { tone: "mid", bendR: 3, maxLength: 10 });

  // ── Ноутбук с вкладкой «Порты» ──
  S.group = "laptop";
  const base = { x: LAP.x + 4, y: LAP.y, w: 36, d: LAP.d, r: 2 };
  S.box(base, 0, 3.4, { tone: "hi", crease: "lo" }, { bevel: 0.5 });
  const keys = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) keys.push([base.x + 6 + r * 5, base.y + 8 + c * 7, 3.4]);
  S.dots(keys, { size: 0.5, tone: "lo" }, [base.x + 12, base.y + base.d / 2, 3.5]);
  S.box({ ...LAP, r: 1.6 }, LAP.z0, LAP.h, { tone: "mid", inner: k.lineSvg(k.sideSeam(LAP, LAP.z0 + 3, P, 3), { tone: "faint" }) }, { bevel: 0.4, ref: [LAP.x + LAP.w, LAP.y + LAP.d / 2, LAP.z0 + LAP.h / 2] });
  const lf = k.sideMatrix([LAP.x + LAP.w, LAP.y + LAP.d - 3], LAP.z0 + LAP.h - 3, P, "right");
  S.raw([LAP.x + LAP.w + 0.4, LAP.y + LAP.d / 2, LAP.z0 + LAP.h / 2], `<g transform="${lf}"><rect x="0" y="0" width="${LAP.d - 6}" height="${LAP.h - 6}" rx="1.4" class="bf-screen"/><g data-part="ports"></g></g>`, { bias: 4 });
  S.tube([[base.x + base.w, base.y + 12, 2], [FC.x - 6, FC.y + FC.d - 4, 1.2], [FC.x + 3, FC.y + FC.d - 4, fcTop + 1]], 0.8, { tone: "mid", bendR: 5, maxLength: 12 });

  // ── Учебная плата с тремя пайками ──
  S.group = "joints";
  const pTop = pcb(S, { ...PRACT, r: 1.4 }, 2, { holes: true });
  const jx = PRACT.x + 15;
  const slots = [PRACT.y + PRACT.d - 15, PRACT.y + PRACT.d / 2, PRACT.y + 15];
  let jl = "";
  slots.forEach((jy, i) => {
    const n = i + 1;
    if (n === 1) {
      for (const dy of [-6, 6]) S.box({ x: jx - 4, y: jy + dy - 3.4, w: 8, d: 6.8, r: 0.6 }, pTop, 0.4, { tone: "hi" }, { steps: 2 });
      S.box({ x: jx - 3.4, y: jy - 9.4, w: 6.8, d: 18.8, r: 3.2 }, pTop + 0.4, 2.6, { tone: "hi" }, { steps: 6, bevel: 0.6 });
      for (const dy of [-6, 6]) S.tube([[jx, jy + dy, pTop + 3], [jx, jy + dy, pTop + 12]], 0.6, { tone: "mid" });
    } else {
      S.box({ x: jx - 4.6, y: jy - 4.6, w: 9.2, d: 9.2, r: 0.8 }, pTop, 0.4, { tone: "hi" }, { steps: 2 });
      if (n === 2) S.solid(G.solidOf([[0, 4.5], [0.5, 4.3], [2.2, 2.8], [3.6, 1.7], [5, 1], [5.3, 0]], ZUP(jx, jy, pTop + 0.4), P), { tone: "hi" }, [jx, jy, pTop + 2.6]);
      else S.solid(G.sphereOf([jx, jy, pTop + 3.6], 3.5, P, { steps: 28 }), { tone: "mid" }, [jx, jy, pTop + 3.6]);
      S.tube([[jx, jy, pTop + (n === 2 ? 5 : 6.8)], [jx, jy, pTop + 14]], 0.6, { tone: "mid" });
    }
    jl += `<g transform="${k.topMatrix([jx + 10, jy + 3], pTop + 0.05, P, "y")}">${txt(0, 1.2, `№${n}`, "bn-num")}</g>`;
  });
  S.raw([jx + 8, PRACT.y + PRACT.d / 2, pTop + 0.1], jl, { bias: 0.6 });

  // ── Мотор с пропеллером на зажиме ──
  S.group = "motor";
  S.box({ x: MOT[0] - 10, y: MOT[1] - 10, w: 20, d: 20, r: 2 }, 0, 6, { tone: "mid" }, { bevel: 0.4 });
  const mt = motor(S, MOT[0], MOT[1], 6, { r: 7, h: 7, ribs: 12 }).top;
  S.tube([[MOT[0], MOT[1] + 8, 3], [MOT[0] - 10, MOT[1] + 30, 1.2], [FC.x + 10, FC.y - 4, 1.2], [FC.x + 10, FC.y + 3, fcTop + 0.8]], 0.6, { tone: "mid", bendR: 5, maxLength: 12 });
  if (state.props) S.raw([MOT[0], MOT[1], mt + 8], `<g data-prop="0">${propSvg(P, MOT[0], MOT[1], mt + 1.6, 22, 0.4, { blades: 3 })}</g>`, { bias: 20 });

  // ── Питание: батарея → (smoke stopper) → полётник ──
  S.group = "power";
  S.box({ ...BAT, r: 3 }, 0, 16, { tone: "hi", crease: "lo", inner: k.lineSvg(k.sideSeam(BAT, 8, P, 4), { tone: "faint" }) }, { bevel: 0.6 });
  const bf = k.sideMatrix([BAT.x + BAT.w, BAT.y + BAT.d - 3], 12, P, "right");
  S.raw([BAT.x + BAT.w + 0.3, BAT.y + BAT.d / 2, 8], `<g transform="${bf}">${txt(0, 0, "LiPo 4S", "bn-pk")}</g>`, { bias: 2 });
  const batOut = [BAT.x + 10, BAT.y + BAT.d, 4];
  const fcIn = [FC.x + FC.w - 6, FC.y - 2];
  if (state.stop) {
    S.box({ ...STOP, r: 2 }, 0, 9, { tone: "mid", inner: k.lineSvg(k.sideSeam(STOP, 3, P, 3), { tone: "faint" }) }, { bevel: 0.4 });
    S.raw([STOP.x + STOP.w - 3, STOP.y + 5, 10], `<g data-part="stopled"></g>`, { bias: 3 });
    const plugged = !!state.power;
    S.tube([batOut, [batOut[0], batOut[1] + 4, 1.4], [STOP.x + 4, STOP.y - (plugged ? 2 : 10), 1.4]], 0.9, { tone: "mid", bendR: 4, maxLength: 12 });
    plug(S, STOP.x + 4, STOP.y - (plugged ? 2 : 10), 0.6, 5, 4, 3, { tone: "hi" });
    S.tube([[STOP.x + 4, STOP.y + STOP.d, 3], [STOP.x + 2, STOP.y + STOP.d + 8, 1.4], [fcIn[0] + 10, fcIn[1] - 6, 1.4], [fcIn[0], fcIn[1] + 4, fcTop + 1]], 0.9, { tone: "mid", bendR: 4, maxLength: 12 });
  } else {
    const end = state.power ? [fcIn[0] + 6, fcIn[1] - 8] : [fcIn[0] + 18, fcIn[1] - 20];
    S.tube([batOut, [batOut[0], batOut[1] + 6, 1.4], [end[0], end[1], 1.4]], 0.9, { tone: "mid", bendR: 4, maxLength: 12 });
    plug(S, end[0], end[1], 0.6, 5, 4, 3, { tone: "hi" });
    S.tube([[fcIn[0] + 6, fcIn[1] - 3, 1.4], [fcIn[0], fcIn[1] + 4, fcTop + 1]], 0.9, { tone: "mid", bendR: 3 });
  }

  // ── Мультиметр: щупы на «+» и «−» полётника, если прозвонил ──
  S.group = "dmm";
  S.box({ ...DMM, r: 3 }, 0, 6, { tone: "hi", crease: "lo" }, { bevel: 0.6 });
  const df = k.topMatrix([DMM.x + 4, DMM.y + DMM.d - 4], 6.05, P, "y");
  S.raw([DMM.x + DMM.w / 2, DMM.y + DMM.d / 2, 6.1], `<g transform="${df}"><rect x="0" y="0" width="${DMM.d - 8}" height="9" rx="1" class="osd-screen"/>${txt(2, 6.4, state.beep ? "OL ✓" : "—", "bn-dmm")}</g>`, { bias: 1 });
  const probes = state.beep ? [[fcIn[0] + 2, fcIn[1] + 2, fcTop + 1], [fcIn[0] - 6, fcIn[1] + 2, fcTop + 1]] : [[DMM.x - 8, DMM.y + 6, 1], [DMM.x - 8, DMM.y + 14, 1]];
  probes.forEach((tip, i) => S.tube([[DMM.x + 4 + i * 6, DMM.y, 3], [DMM.x - 2 + i * 4, DMM.y - 8, 1.2], tip], 0.5, { tone: i ? "lo" : "lit", bendR: 4, maxLength: 12 }));

  S.group = null;
  S.raw([0, 0, 400], `<g data-part="smoke"></g>`, { bias: 1e5 });
  const svg = k.figureSvg({ width: W, height: H, label: "Стол пайки: приёмник, полётник с площадками, провода, ноутбук с вкладкой «Порты», учебная плата с пайками, мотор, видеопередатчик, батарея, smoke stopper и мультиметр.", body: S.svg() });
  const labels = labelsAt(P, [
    ["Приёмник ELRS", [RX.x + RX.w / 2, RX.y + RX.d / 2, rxTop], "Площадки G, 5V, TX, RX. TX — «рот», RX — «ухо»."],
    ["Полётник", [FC.x + FC.w / 2, FC.y + FC.d / 2, fcTop], "Площадки: VBAT (напряжение батареи!), 5V, G, CAM и порты T1/R1, T2/R2."],
    ["Betaflight · «Порты»", [LAP.x + LAP.w, LAP.y + LAP.d / 2, LAP.z0 + LAP.h], "Serial RX включают на том UART, куда припаян приёмник."],
    ["Учебная плата", [PRACT.x + PRACT.w / 2, PRACT.y + PRACT.d / 2, pTop], "Три пайки: найди холодную."],
    ["Smoke stopper", state.stop ? [STOP.x + STOP.w / 2, STOP.y + STOP.d / 2, 9] : null, "Ограничитель тока: при замыкании гасит ток, плата не сгорает."],
    ["Мультиметр", [DMM.x + DMM.w / 2, DMM.y + DMM.d / 2, 6], "Прозвонка «+» и «−»: «OL» — замыкания нет."],
    ["Батарея", [BAT.x + BAT.w / 2, BAT.y + BAT.d / 2, 16], "Подключается к полётнику через smoke stopper (если он стоит)."],
    ["Мотор с пропеллером", [MOT[0], MOT[1], 14], "Перед первым включением пропеллер снимают."],
    ["Видеопередатчик", [VTX.x + VTX.w / 2, VTX.y + VTX.d / 2, 4], "Без антенны включать нельзя — перегреется."],
  ].filter((x) => x[1]));
  return { svg, P, labels, wr, pw, live: { ledFc: at(ledFc), ledRx: at(ledRx), rxC: at([RX.x + RX.w / 2, RX.y + RX.d / 2, rxTop + 4]), vtxC: at([VTX.x + VTX.w / 2, VTX.y + VTX.d / 2, vTop + 4]), stopLed: at([STOP.x + STOP.w - 3, STOP.y + 5, 9.2]), mot: [MOT[0], MOT[1], mt + 1.6] }, parts: S.count() };
}

const PADS = [["none", "— не припаян"], ...FCP.map((p) => [p, p])];
export const defaults = { wG: "none", w5: "none", wTX: "none", wRX: "none", port: 1, pick: "0", beep: false, ant: false, stop: false, props: true, power: false };
export const controls = [
  { id: "wG", label: "Провод G приёмника →", type: "select", options: PADS, rebuild: true },
  { id: "w5", label: "Провод 5V приёмника →", type: "select", options: PADS, rebuild: true },
  { id: "wTX", label: "Провод TX приёмника →", type: "select", options: PADS, rebuild: true },
  { id: "wRX", label: "Провод RX приёмника →", type: "select", options: PADS, rebuild: true },
  { id: "port", label: "Betaflight · Порты: Serial RX на", type: "seg", options: [[1, "UART1"], [2, "UART2"], [3, "UART3"]], num: true },
  { id: "pick", label: "Холодная пайка на учебной плате — это", type: "seg", options: [["0", "—"], ["1", "№1"], ["2", "№2"], ["3", "№3"]] },
  { id: "beep", label: "Прозвонил «+» и «−» мультиметром", type: "check", rebuild: true },
  { id: "ant", label: "Антенны приёмника и VTX прикручены", type: "check", rebuild: true },
  { id: "stop", label: "Питание через smoke stopper", type: "check", rebuild: true },
  { id: "props", label: "Пропеллер стоит на моторе", type: "check", rebuild: true },
  { id: "power", label: "Подать питание ⚡", type: "check", rebuild: true },
];
export const tour = [
  { at: 0, set: { wG: "G", w5: "5V", wTX: "R1", wRX: "T1" } },
  { at: 3, set: { beep: true, ant: true, stop: true, props: false } },
  { at: 6, set: { power: true } },
  { at: 10, set: { power: false } },
];

export function controller(root, built, state) {
  const L = built.live;
  const P = built.P;
  const q = (s) => root.querySelector(`[data-part="${s}"]`);
  const portsEl = q("ports"), fcLed = q("fcled"), rxLed = q("rxled"), stopLed = q("stopled"), smokeEl = q("smoke");
  const propEl = root.querySelector("[data-prop]");
  const sim = { t: 0, spin: 0.4 };
  const wr = built.wr, pw = built.pw;
  const live = () => pw.on && !pw.trip && !pw.smokeRx;
  return {
    tick(dt, calm, st) {
      if (!calm) sim.t += dt;
      const portOk = wr.ok && Number(st.port) === Number(wr.uart);
      // Вкладка «Порты».
      let p = txt(3, 7, "Порты", "bf-t");
      [1, 2, 3].forEach((n, i) => {
        const y = 14 + i * 9;
        const on = Number(st.port) === n;
        p += txt(3, y + 4, `UART${n}`, "bf-t") + txt(24, y + 4, "Serial RX", "bf-t") + `<rect x="${SWX}" y="${y}" width="9" height="5" rx="2.5" class="bn-sw${on ? " on" : ""}"/><circle cx="${on ? SWX + 6.5 : SWX + 2.5}" cy="${y + 2.5}" r="1.9" class="bn-knob"/>`;
      });
      p += txt(3, 46, !wr.done ? "приёмник не припаян" : !wr.ok ? "пайка с ошибкой" : portOk ? `каналы идут · UART${wr.uart}` : `приёмник на UART${wr.uart} — тут тишина`, `bf-t ${portOk ? "good" : "bad"}`);
      if (portsEl.innerHTML !== p) portsEl.innerHTML = p;
      // Светодиоды.
      const blink = Math.floor(sim.t * 2) % 2 === 0;
      fcLed.innerHTML = live() ? `<ellipse cx="${L.ledFc[0].toFixed(1)}" cy="${L.ledFc[1].toFixed(1)}" rx="2.4" ry="1.5" class="led on"/><ellipse cx="${L.ledFc[0].toFixed(1)}" cy="${L.ledFc[1].toFixed(1)}" rx="5" ry="3" class="pr-glow"/>` : "";
      rxLed.innerHTML = live() && wr.ok ? `<ellipse cx="${L.ledRx[0].toFixed(1)}" cy="${L.ledRx[1].toFixed(1)}" rx="2" ry="1.3" class="led${blink ? " on" : ""}"/>` : "";
      if (stopLed) stopLed.innerHTML = pw.on ? `<ellipse cx="${L.stopLed[0].toFixed(1)}" cy="${L.stopLed[1].toFixed(1)}" rx="2.2" ry="1.4" class="led ${pw.trip ? "bn-red" : "on"}"/>` : "";
      // Дым там, где сгорело.
      let sm = "";
      const puff = (c) => { for (let i = 0; i < 4; i++) { const ph = calm ? i / 4 : (sim.t * 0.5 + i / 4) % 1; sm += `<circle class="bn-smoke" cx="${(c[0] + Math.sin(ph * 6 + i) * 4).toFixed(1)}" cy="${(c[1] - ph * 40).toFixed(1)}" r="${(3 + ph * 7).toFixed(1)}" style="opacity:${((1 - ph) * 0.55).toFixed(2)}"/>`; } };
      if (pw.smokeRx) puff(L.rxC);
      if (pw.on && pw.smokeVtx) puff(L.vtxC);
      smokeEl.innerHTML = sm;
      if (propEl && live() && !calm) {
        sim.spin += dt * 0.6; // «дёрнулся» мотор при включении
        propEl.innerHTML = propSvg(P, L.mot[0], L.mot[1], L.mot[2], 22, sim.spin, { blades: 3 });
      }
      return true;
    },
    facts() {
      return { wireOk: wr.ok, portOk: wr.ok && Number(state.port) === Number(wr.uart), powerOk: !!pw.ok && wr.ok };
    },
    readout() {
      return `${!wr.done ? "проводов не хватает" : wr.ok ? `пайка верная · UART${wr.uart}` : "пайка с ошибкой"} · ${pw.on ? (pw.ok && wr.ok ? "питание: всё живо" : "питание: проблемы") : "питание выкл."}`;
    },
    metrics() {
      return [
        ["Пайка", !wr.done ? "не всё припаяно" : wr.ok ? "верно" : `ошибки: ${wr.bad.join(", ")}`, ""],
        ["UART приёмника", wr.ok ? `UART${wr.uart}` : "—", ""],
        ["Serial RX в Betaflight", `UART${state.port}`, ""],
        ["Первое включение", !pw.on ? "не подано" : pw.ok && wr.ok ? "всё живо" : pw.trip ? "сработал smoke stopper" : "есть ошибки", ""],
      ];
    },
    note() {
      if (pw.on && pw.issues.length) return `<b>${pw.smokeRx || pw.smokeVtx ? "Пшшш… 💨" : "Включилось, но"}</b> ${pw.issues.join("; ")}.`;
      if (pw.on && pw.ok && wr.ok) return "<b>Светодиоды загорелись, ничего не дымит.</b> Так и надо: прозвонка, антенны, smoke stopper, без пропеллера.";
      if (wr.done && !wr.ok) return `<b>Есть ошибки.</b> ${wr.notes.join(" ")}`;
      if (wr.ok && Number(state.port) !== Number(wr.uart)) return `<b>Пайка верная:</b> TX → R${wr.uart}, RX → T${wr.uart}. Теперь в «Портах» включи Serial RX на UART${wr.uart} — цифра у площадок и есть номер порта.`;
      if (wr.ok) return `<b>Отлично!</b> Питание «как есть», данные — крест-накрест: TX → R${wr.uart}, RX → T${wr.uart}.`;
      return "Выбери справа, куда идёт каждый провод приёмника. Правило: питание — как есть, данные — крест-накрест.";
    },
  };
}
