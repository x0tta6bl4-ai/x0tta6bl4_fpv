// Гл. 10. Бинд (фраза + версия + регион), порядок каналов AETR/TAER, Model Match.
import { loop, choice, stick, toggle, fmt, esc } from "../labkit.mjs";

export const meta = {
  id: "bind",
  title: "Подружи пульт и приёмник",
  missions: [
    { id: "bind", text: "Пульт и приёмник не видят друг друга. Найди отличие и добейся зелёной лампы" },
    { id: "v4", text: "Обнови пульт до версии 4.0 — связь пропадёт. Верни её" },
    { id: "order", text: "Поставь в Betaflight порядок не как на пульте, подвигай крен, посмотри на газ — и исправь" },
    { id: "mm", text: "Включи Model Match с разными номерами. Связь есть, а дрон не слушается — почему?" },
  ],
};
const PHRASES = [["sokol", "«sokol»"], ["sapsan", "«sapsan»"], ["orel", "«orel»"]];
const VERS = [[3, "3.5"], [4, "4.0"]];
const REG = [["2G4", "2,4 ГГц"], ["915", "915 МГц"], ["868", "868 МГц"]];
const ORD = [["AETR", "AETR"], ["TAER", "TAER"]];
const NAMES = { T: "Газ", A: "Крен", E: "Тангаж", R: "Рыскание" };

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 250" class="lab-svg" role="img" aria-label="Пульт слева, приёмник справа, внизу полоски каналов в Betaflight">
    <rect width="360" height="250" class="lab-field"/><g id="tx"></g><g id="air"></g><g id="rx"></g><g id="bf"></g></svg></div>
    <div class="lab-two"><div class="lab-ctl" id="ctx"><b class="lab-cap">Пульт (передатчик)</b></div><div class="lab-ctl" id="crx"><b class="lab-cap">Приёмник на дроне</b></div></div>
    <div class="lab-ctl lab-sticks" id="cst"></div><div class="lab-ctl" id="cbf"></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const s = {
    tx: { ph: "sokol", v: 3, reg: "2G4", ord: "AETR", mm: false, num: 1 },
    rx: { ph: "sokol", v: 3, reg: "915", num: 2 },
    bf: "AETR",
    st: { thr: 0, yaw: 0, roll: 0, pitch: 0 },
    t: 0,
    wasBound3: false,
    sawWrong: false,
  };
  const cx = $("#ctx"), cr = $("#crx");
  choice(cx, { label: "Бинд-фраза", options: PHRASES, value: s.tx.ph, onPick: (v) => (s.tx.ph = v) });
  choice(cx, { label: "Версия прошивки", options: VERS, value: s.tx.v, onPick: (v) => (s.tx.v = v) });
  choice(cx, { label: "Регион (частота; 2,4 ГГц и 900 МГц — разное железо)", options: REG, value: s.tx.reg, onPick: (v) => (s.tx.reg = v) });
  choice(cr, { label: "Бинд-фраза", options: PHRASES, value: s.rx.ph, onPick: (v) => (s.rx.ph = v) });
  choice(cr, { label: "Версия прошивки", options: VERS, value: s.rx.v, onPick: (v) => (s.rx.v = v) });
  choice(cr, { label: "Регион (частота)", options: REG, value: s.rx.reg, onPick: (v) => (s.rx.reg = v) });
  const cst = $("#cst");
  stick(cst, { label: "Левый: газ ↕, рыскание ↔", spring: [true, false], value: [0, -1], onMove: ([x, y]) => { s.st.thr = (y + 1) / 2; s.st.yaw = x; } });
  stick(cst, { label: "Правый: тангаж ↕, крен ↔", spring: [true, true], onMove: ([x, y]) => { s.st.roll = x; s.st.pitch = y; } });
  const cb = $("#cbf");
  choice(cb, { label: "Порядок каналов на пульте (Radiomaster)", options: ORD, value: s.tx.ord, onPick: (v) => (s.tx.ord = v) });
  choice(cb, { label: "Порядок каналов в Betaflight", options: ORD, value: s.bf, onPick: (v) => (s.bf = v) });
  toggle(cb, { label: "Model Match на пульте (модель №1)", value: false, onToggle: (v) => (s.tx.mm = v) });
  choice(cb, { label: "Номер модели, запомненный приёмником", options: [[1, "№1"], [2, "№2"]], value: s.rx.num, onPick: (v) => (s.rx.num = v) });

  const L = loop(root, (dt, calm) => {
    if (!calm) s.t += dt;
    const diff = [];
    if (s.tx.ph !== s.rx.ph) diff.push("бинд-фраза");
    if (s.tx.v !== s.rx.v) diff.push("версия (3.x и 4.x не дружат)");
    if (s.tx.reg !== s.rx.reg) diff.push("регион");
    const bound = diff.length === 0;
    const mmBad = bound && s.tx.mm && s.rx.num !== 1;
    const cmd = bound && !mmBad;
    if (bound) ctx.done("bind");
    if (bound && s.tx.v === 3) s.wasBound3 = true;
    if (bound && s.tx.v === 4 && s.rx.v === 4 && s.wasBound3) ctx.done("v4");
    if (mmBad) ctx.done("mm");
    // Каналы: пульт кладёт буквы в порядке своей схемы, Betaflight читает по своей.
    const val = { T: 1000 + s.st.thr * 1000, A: 1500 + s.st.roll * 500, E: 1500 + s.st.pitch * 500, R: 1500 + s.st.yaw * 500 };
    const ch = [...s.tx.ord].map((k) => val[k]);
    const read = {};
    [...s.bf].forEach((k, i) => (read[k] = ch[i]));
    const wrong = s.tx.ord !== s.bf;
    if (cmd && wrong && Math.abs(s.st.roll) > 0.5 && read.T === val.A) s.sawWrong = true;
    if (cmd && !wrong && s.sawWrong) ctx.done("order");
    // Пульт.
    const knob = (x0, y0, x, y) => `<rect x="${x0 - 18}" y="${y0 - 18}" width="36" height="36" rx="8" class="st-bg"/><circle cx="${(x0 + x * 13).toFixed(1)}" cy="${(y0 - y * 13).toFixed(1)}" r="6" class="st-knob"/>`;
    $("#tx").innerHTML = `<rect x="10" y="44" width="100" height="70" rx="14" class="fly-body"/>${knob(36, 80, s.st.yaw, s.st.thr * 2 - 1)}${knob(84, 80, s.st.roll, s.st.pitch)}<path d="M98 44V16" class="wv-ant"/><text x="60" y="132" class="lt" text-anchor="middle">пульт · ${esc(s.tx.reg === "2G4" ? "2,4 ГГц" : s.tx.reg + " МГц")}</text>`;
    // Радиоволны между ними — только при бинде.
    let air = "";
    if (bound) for (let i = 0; i < 4; i++) {
      const r = ((s.t * 40 + i * 22) % 88) + 10;
      air += `<path d="M${112 + r * 1.3} ${54 - r * 0.25}q8 ${14 + r * 0.25} 0 ${28 + r * 0.5}" class="air-wave" style="opacity:${(1 - r / 98).toFixed(2)}"/>`;
    }
    else air = `<text x="192" y="76" class="lt bad" text-anchor="middle">✕ не видят</text><text x="192" y="92" class="lt bad" text-anchor="middle">друг друга</text>`;
    $("#air").innerHTML = air;
    // Приёмник: диод горит ровно, мигает трижды (Model Match) или медленно (нет бинда).
    const ph = s.t % 1.6;
    const on = !bound ? Math.floor(s.t * 1.2) % 2 === 0 : mmBad ? ph < 0.9 && Math.floor(ph * 6.6) % 2 === 0 : true;
    $("#rx").innerHTML = `<rect x="276" y="58" width="56" height="40" rx="6" class="pcb-rx"/><path d="M322 58V20" class="wv-ant"/><circle cx="290" cy="78" r="7" class="${on ? (cmd ? "led on" : "led warn") : "led"}"/><text x="304" y="114" class="lt" text-anchor="middle">приёмник</text><text x="350" y="130" class="lab-small" text-anchor="end">${!bound ? "светодиод мигает медленно" : mmBad ? "светодиод мигает трижды" : "светодиод горит ровно"}</text>`;
    // Betaflight: вкладка «Приёмник».
    let bf = `<rect x="10" y="146" width="340" height="96" rx="10" class="lab-hud"/><text x="20" y="164" class="lab-small" text-anchor="start">Betaflight · «Приёмник» · ждёт ${s.bf}</text>`;
    ["A", "E", "R", "T"].forEach((k, i) => {
      const y = 174 + i * 16;
      const v = cmd ? read[k] : null;
      bf += `<text x="20" y="${y + 9}" class="lab-small" text-anchor="start">${NAMES[k]}</text><rect x="92" y="${y}" width="200" height="10" rx="5" class="lab-track"/>${v ? `<rect x="92" y="${y}" width="${((v - 1000) / 5).toFixed(1)}" height="10" rx="5" class="lab-fill"/><text x="340" y="${y + 9}" class="lab-small" text-anchor="end">${fmt(v)}</text>` : ""}`;
    });
    const flags = !cmd ? ["RXLOSS"] : read.T > 1050 ? ["THROTTLE"] : [];
    bf += `<text x="340" y="164" class="lab-small ${flags.length ? "bad" : "good"}" text-anchor="end">${flags.length ? "флаг: " + flags.join(" ") : "флагов нет"}</text>`;
    $("#bf").innerHTML = bf;
    const msg = !bound
      ? `Бинд — как один ключ на два замка. Должны совпасть три вещи: фраза, основная версия и регион. Сейчас отличается: ${diff.join(", ")}.`
      : mmBad
        ? "Model Match: приёмник слушается только модель с «своим» номером. Радио есть (бинд), а команд на полётник нет — в Betaflight флаг RXLOSS. Курс ставит Model Match OFF."
        : wrong
          ? `Пульт шлёт ${s.tx.ord}, а Betaflight ждёт ${s.bf}: каналы читаются не те. Газ попадает на место другого канала, поэтому даже в покое «газ» = 1500 — флаг THROTTLE, арма не будет.`
          : "Всё совпало: двигай стики — полоски повторяют их. Газ внизу ≈ 1000.";
    if ($(".lab-read").textContent !== msg) $(".lab-read").textContent = msg;
  });
  return { destroy: () => L.stop() };
}
