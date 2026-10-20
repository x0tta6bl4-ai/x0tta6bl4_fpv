// Гл. 14. «Рот к уху»: припаять приёмник к полётнику, выбрать UART, отличить холодную пайку, безопасно подать питание.
import { button, esc, shuffle } from "../labkit.mjs";

export const meta = {
  id: "solder",
  title: "Паяльник без дыма",
  missions: [
    { id: "wire", text: "Припаяй приёмник к полётнику правильно (нажми контакт приёмника, потом площадку полётника)" },
    { id: "uart", text: "Ответь: какой UART теперь включить в Betaflight?" },
    { id: "joint", text: "Найди холодную пайку среди трёх" },
    { id: "power", text: "Подай питание первый раз и ничего не сожги" },
  ],
};
const RXP = ["G", "5V", "TX", "RX"];
const FCP = ["VBAT", "5V", "G", "T1", "R1", "T2", "R2", "CAM"];
const CHECKS = [
  ["Прозвонить мультиметром «+» и «−»: нет короткого замыкания", true],
  ["Прикрутить антенны приёмника и видеопередатчика", true],
  ["Подключить через smoke stopper (ограничитель тока)", true],
  ["Снять пропеллеры", true],
  ["Поставить пропеллеры, чтобы сразу проверить тягу", false],
  ["Подключить сразу самую мощную батарею, без ограничителя", false],
];

export function mount(root, ctx) {
  root.innerHTML = `<div class="lab-stage"><svg viewBox="0 0 360 230" class="lab-svg" role="img" aria-label="Приёмник слева, полётник справа, провода между контактами">
    <rect width="360" height="230" class="lab-field"/><g id="boards"></g><g id="wires"></g></svg></div>
    <div class="lab-row" id="wtools"></div><p class="lab-read" aria-live="polite"></p>
    <div class="lab-quiz" id="uart"></div><div class="lab-quiz" id="joints"></div><div class="lab-quiz" id="pwr"></div>`;
  const $ = (q) => root.querySelector(q);
  const s = { wires: {}, pick: null, checked: false, result: null, smoke: 0 };
  const rxPos = (i) => [70, 60 + i * 34];
  const fcPos = (i) => [i < 4 ? 228 : 300, 52 + (i % 4) * 40];
  const read = $(".lab-read");
  const say = (t) => { if (read.innerHTML !== t) read.innerHTML = t; };
  const draw = () => {
    let b = `<rect x="22" y="40" width="70" height="146" rx="8" class="pcb-rx"/><text x="57" y="206" class="lt" text-anchor="middle">приёмник ELRS</text><path d="M40 40V12" class="wv-ant"/>`;
    RXP.forEach((p, i) => {
      const [x, y] = rxPos(i);
      b += `<g class="pad ${s.pick === p ? "sel" : ""}" data-rx="${p}"><rect x="${x - 14}" y="${y - 11}" width="44" height="22" rx="5" class="pad-bg"/><text x="${x + 8}" y="${y + 5}" class="lt" text-anchor="middle">${p}</text></g>`;
    });
    b += `<rect x="196" y="22" width="148" height="196" rx="10" class="pcb-fc"/><text x="270" y="14" class="lt" text-anchor="middle">полётник</text>`;
    FCP.forEach((p, i) => {
      const [x, y] = fcPos(i);
      b += `<g class="pad" data-fc="${p}"><rect x="${x - 24}" y="${y - 13}" width="48" height="26" rx="5" class="pad-bg"/><text x="${x}" y="${y + 5}" class="lt" text-anchor="middle">${p}</text></g>`;
    });
    $("#boards").innerHTML = b;
    let w = "";
    for (const [r, f] of Object.entries(s.wires)) {
      const [x1, y1] = rxPos(RXP.indexOf(r)), [x2, y2] = fcPos(FCP.indexOf(f));
      const bad = s.result && s.result.bad.includes(r);
      w += `<path d="M${x1 + 30} ${y1}C${x1 + 90} ${y1} ${x2 - 80} ${y2} ${x2 - 24} ${y2}" class="wire ${r === "G" ? "w-g" : r === "5V" ? "w-v" : "w-d"} ${bad ? "bad" : ""}"/>`;
    }
    $("#wires").innerHTML = w;
  };
  root.querySelector("svg").addEventListener("click", (e) => {
    const rx = e.target.closest("[data-rx]"), fc = e.target.closest("[data-fc]");
    if (rx) s.pick = rx.dataset.rx;
    else if (fc && s.pick) {
      for (const k of Object.keys(s.wires)) if (s.wires[k] === fc.dataset.fc) delete s.wires[k];
      s.wires[s.pick] = fc.dataset.fc;
      s.pick = null;
      s.result = null;
    }
    draw();
    say(s.pick ? `Контакт ${s.pick} выбран. Теперь нажми площадку на полётнике.` : `Проводов: ${Object.keys(s.wires).length} из 4.`);
  });
  const tools = $("#wtools");
  button(tools, "Проверить пайку", () => {
    const w = s.wires;
    if (Object.keys(w).length < 4) return say("Нужно 4 провода: G, 5V, TX и RX.");
    const bad = [];
    const notes = [];
    if (w["5V"] === "VBAT") { bad.push("5V"); notes.push("5V приёмника на VBAT — там напряжение батареи (до 25 В). Приёмник сгорит!"); }
    else if (w["5V"] !== "5V") { bad.push("5V"); notes.push("Питание «как есть»: 5V → 5V."); }
    if (w.G !== "G") { bad.push("G"); notes.push("Земля к земле: G → G."); }
    const tx = w.TX, rx = w.RX;
    if (!/^R\d$/.test(tx || "")) { bad.push("TX"); notes.push(tx && tx[0] === "T" ? "TX → T: это «рот ко рту», никто никого не слышит. TX («рот») приёмника — на R («ухо») полётника." : "TX приёмника должен идти на площадку R (приём) полётника."); }
    if (!/^T\d$/.test(rx || "")) { bad.push("RX"); notes.push("RX приёмника — на T полётника."); }
    if (!bad.length && tx[1] !== rx[1]) { bad.push("RX"); notes.push(`TX и RX должны быть одного номера UART: сейчас R${tx[1]} и T${rx[1]}.`); }
    s.result = { bad };
    draw();
    if (bad.length) return say(`<b>Есть ошибки.</b> ${notes.map(esc).join(" ")}`);
    s.uart = tx[1];
    ctx.done("wire");
    say(`<b>Отлично!</b> Питание «как есть», данные — крест-накрест: TX → R${tx[1]}, RX → T${tx[1]}.`);
    askUart();
  });
  button(tools, "Отпаять всё", () => { s.wires = {}; s.result = null; s.pick = null; draw(); say("Начни с контакта приёмника."); });
  const askUart = () => {
    $("#uart").innerHTML = `<b>Приёмник на R${s.uart}/T${s.uart}. Что включить во вкладке «Порты»?</b><div class="lab-row">${shuffle(["1", "2", "3"]).map((n) => `<button type="button" class="lab-btn" data-u="${n}">UART${n} → Serial RX</button>`).join("")}</div>`;
  };
  $("#uart").addEventListener("click", (e) => {
    const b = e.target.closest("[data-u]");
    if (!b) return;
    const ok = b.dataset.u === s.uart;
    b.classList.add(ok ? "good" : "bad");
    if (ok) ctx.done("uart");
    say(ok ? "Верно: цифра у площадок — номер UART." : "Нет: смотри на цифру у площадок R и T, куда припаян приёмник.");
  });
  // Три пайки: блестящая «горка», матовый шарик, перемычка между площадками.
  const J = shuffle([
    ["good", `<path d="M8 40h44" class="pad-line"/><path d="M14 40q16 -26 32 0" class="j-good"/><path d="M30 14V2" class="j-wire"/>`, "Блестящая гладкая «горка» — хорошая пайка."],
    ["cold", `<path d="M8 40h44" class="pad-line"/><circle cx="30" cy="27" r="11" class="j-cold"/><path d="M30 16V2" class="j-wire"/>`, "Матовый зернистый шарик, не растёкся по площадке — холодная пайка: отвалится от вибрации."],
    ["bridge", `<path d="M4 40h20M36 40h20" class="pad-line"/><path d="M8 40q22 -22 44 0" class="j-good"/><path d="M14 18V2M46 18V2" class="j-wire"/>`, "Припой соединил две соседние площадки — это перемычка (замыкание)."],
  ], 7 + Date.now() % 97);
  $("#joints").innerHTML = `<b>Какая из трёх паек холодная?</b><div class="lab-row">${J.map(([k, svg]) => `<button type="button" class="lab-btn joint" data-j="${k}"><svg viewBox="0 0 60 46" aria-hidden="true">${svg}</svg></button>`).join("")}</div><small id="jnote"></small>`;
  $("#joints").addEventListener("click", (e) => {
    const b = e.target.closest("[data-j]");
    if (!b) return;
    const ok = b.dataset.j === "cold";
    b.classList.add(ok ? "good" : "bad");
    if (ok) ctx.done("joint");
    $("#jnote").textContent = J.find((x) => x[0] === b.dataset.j)[2];
  });
  // Первое включение: отметь нужные шаги и подай питание.
  const order = shuffle(CHECKS.map((_, i) => i), 3);
  $("#pwr").innerHTML = `<b>Первое включение. Отметь, что сделаешь ДО подачи питания:</b><div class="lab-checks">${order.map((i) => `<label class="lab-toggle"><input type="checkbox" data-c="${i}"><span>${esc(CHECKS[i][0])}</span></label>`).join("")}</div><div class="lab-row"><button type="button" class="lab-btn" data-go>Подать питание ⚡</button></div><small id="pnote"></small>`;
  $("#pwr").addEventListener("click", (e) => {
    if (!e.target.closest("[data-go]")) return;
    const marked = [...root.querySelectorAll("[data-c]")].filter((x) => x.checked).map((x) => +x.dataset.c);
    const missing = CHECKS.map((c, i) => [c, i]).filter(([c, i]) => c[1] && !marked.includes(i)).map(([c]) => c[0]);
    const wrong = marked.filter((i) => !CHECKS[i][1]).map((i) => CHECKS[i][0]);
    const note = $("#pnote");
    if (!missing.length && !wrong.length) {
      ctx.done("power");
      note.textContent = "Светодиоды загорелись, ничего не дымит. Так и надо!";
      note.className = "good";
    } else {
      note.textContent = `Пшшш… 💨 ${wrong.length ? "Лишнее: " + wrong.join("; ") + ". " : ""}${missing.length ? "Забыл: " + missing.join("; ") + "." : ""}`;
      note.className = "bad";
    }
  });
  draw();
  say("Нажми контакт приёмника (слева), потом площадку полётника (справа). Правило: питание — как есть, данные — крест-накрест.");
  return { destroy() {} };
}
