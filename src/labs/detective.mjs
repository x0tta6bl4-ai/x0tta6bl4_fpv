// Гл. 17. Шесть детективных дел: улики → проверки → вердикт. Чем меньше проверок, тем лучше.
import { esc } from "../labkit.mjs";

export const meta = {
  id: "detective",
  title: "Детектив: найди поломку",
  missions: [
    { id: "three", text: "Раскрой 3 дела" },
    { id: "sharp", text: "Раскрой дело по уликам: 1–2 проверки и без ошибки" },
    { id: "flip", text: "Раскрой дело «Кувыркнулся на взлёте»" },
    { id: "all", text: "Раскрой все 6 дел" },
  ],
};
// Каждое дело: симптом, возможные причины, проверки (ответ зависит от настоящей причины).
const CASES = [
  {
    id: "arm", title: "Бинд есть, арма нет", sym: "Пульт видит приёмник, а дрон не армится и не реагирует на стики.",
    causes: { wire: "Провод TX приёмника не на R полётника", port: "Serial RX включён не на том UART", mm: "Model Match: номера моделей не совпали", acc: "Акселерометр не откалиброван" },
    checks: [
      ["Флаги запрета арма (вкладка «Система»)", (c) => (c === "acc" ? "NO_ACC_CAL, MSP" : "RXLOSS, MSP")],
      ["Посмотреть на диод приёмника", (c) => (c === "mm" ? "мигает трижды, пауза, снова трижды" : "горит ровно")],
      ["Вкладка «Порты»", (c) => (c === "port" ? "Serial RX стоит на UART1, а приёмник припаян к R2/T2" : "Serial RX на UART2 — как припаяно")],
      ["Осмотреть пайку под лупой", (c) => (c === "wire" ? "TX приёмника припаян к T2 — «рот ко рту»" : "TX → R2, RX → T2, пайка блестит")],
      ["Пульт: настройки модуля ELRS", (c) => (c === "mm" ? "Model Match ON, модель №3, а приёмник запомнил №1" : "Model Match OFF")],
    ],
  },
  {
    id: "flip", title: "Кувыркнулся на взлёте", sym: "Даёшь газ — дрон резко переворачивается на бок.",
    causes: { prop: "Пропеллер не того направления", dir: "Мотор крутится не в ту сторону", orient: "Неверная ориентация платы" },
    checks: [
      ["Вкладка «Моторы» без пропов: направление", (c) => (c === "dir" ? "мотор 3 крутится по часовой, а по схеме — против" : "все крутятся по схеме props in")],
      ["Сверить пропеллеры со схемой", (c) => (c === "prop" ? "на моторе 2 стоит проп для другого направления" : "все пропы по схеме")],
      ["3D-модель: наклоняю борт вперёд", (c) => (c === "orient" ? "модель наклоняется вбок" : "модель повторяет наклоны")],
      ["Флаги запрета арма", () => "только MSP — заармиться можно, флаги тут не помогут"],
    ],
  },
  {
    id: "cam", title: "OSD видно, а картинки нет", sym: "В очках видны надписи (напряжение, таймер), а вместо картинки — серый фон.",
    causes: { vid: "Оторвался провод видео камеры", pwr: "Камера не получает питание", dead: "Камера неисправна" },
    checks: [
      ["Мультиметр: напряжение на камере", (c) => (c === "pwr" ? "0 В" : "5,0 В")],
      ["Осмотреть пайку VID → CAM", (c) => (c === "vid" ? "провод болтается — оторван от площадки" : "держится крепко")],
      ["Подключить заведомо рабочую камеру на те же провода", (c) => (c === "dead" ? "картинка появилась!" : "всё так же пусто")],
      ["Сменить канал видеопередатчика", () => "надписи видно на любом канале — передатчик жив, но это мы и так знали"],
    ],
  },
  {
    id: "ant", title: "Новая антенна — рябит совсем близко", sym: "Поставил новую антенну на видеопередатчик — картинка шумит уже в 100–200 метрах, хотя раньше летал на километр.",
    causes: { sma: "SMA вместо RP-SMA: нет центрального контакта", pit: "Видеопередатчик в PIT Mode", pol: "Антенна противоположной поляризации" },
    checks: [
      ["Заглянуть в разъёмы", (c) => (c === "sma" ? "и у антенны, и у передатчика — гнёзда без штырька" : "штырёк на месте")],
      ["Меню видеопередатчика в OSD", (c) => (c === "pit" ? "PIT: ON" : "PIT: OFF, 400 мВт")],
      ["Наклейки на антенне и на очках", (c) => (c === "pol" ? "на дроне LHCP, на очках RHCP" : "обе RHCP")],
    ],
  },
  {
    id: "sticks", title: "Стики делают не то", sym: "Двигаешь крен — а в Betaflight полоска едет не та или не в ту сторону.",
    causes: { map: "Таблица каналов не совпадает (AETR ↔ TAER)", rev: "На пульте включён реверс канала крена" },
    checks: [
      ["Вкладка «Приёмник»: двигаю крен вправо", (c) => (c === "map" ? "двигается полоска газа, горит флаг THROTTLE" : "полоска крена едет влево")],
      ["Пульт: экран Outputs, двигаю крен", (c) => (c === "rev" ? "у канала 1 стоит галочка «реверс», значения идут наоборот" : "реверса нет, значения идут как надо")],
    ],
  },
  {
    id: "lowv", title: "LOW BATTERY сразу после взлёта", sym: "Только взлетел — в очках мигает LOW BATTERY.",
    causes: { cold: "Холодная батарея", old: "Старая батарея: одна банка «устала»", cells: "Полётник посчитал не то число банок", weak: "Батарея слабее нужного тока (мало C)" },
    checks: [
      ["Потрогать / измерить температуру батареи", (c) => (c === "cold" ? "+2 °C — лежала в машине на морозе" : "+24 °C")],
      ["Банки в покое (балансир)", (c) => (c === "cells" ? "все по 4,15 В (это 4S, 16,6 В), а OSD делит на 5 банок: 3,3 В на банку" : c === "old" ? "пять по 4,15 В, одна 4,05 В" : "все по 4,15 В")],
      ["Банки под нагрузкой", (c) => (c === "old" ? "одна банка проседает до 3,1 В, остальные 3,6 В" : c === "cells" ? "все по 3,95 В — просадка маленькая" : "все проседают до 3,3 В")],
      ["Наклейка батареи", (c) => (c === "weak" ? "1300 мА·ч 25C: максимум 32 А, а моторам надо 80" : "1300 мА·ч 100C")],
    ],
  },
];

export function mount(root, ctx) {
  root.innerHTML = `<div class="det"><div class="det-cases" id="cases"></div><div class="det-board" id="board"></div></div><p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const solved = new Set();
  let cur = null;
  const open = (id) => {
    const c = CASES.find((x) => x.id === id);
    const keys = Object.keys(c.causes);
    cur = { c, truth: keys[Math.floor(Math.random() * keys.length)], done: [], wrong: 0, bad: [], solved: false };
    draw();
  };
  const draw = () => {
    $("#cases").innerHTML = CASES.map((c, i) => `<button type="button" class="det-case ${solved.has(c.id) ? "ok" : ""} ${cur && cur.c.id === c.id ? "sel" : ""}" data-case="${c.id}"><small>Дело №${i + 1}</small>${esc(c.title)}${solved.has(c.id) ? " ✓" : ""}</button>`).join("");
    if (!cur) { $("#board").innerHTML = `<p>Выбери дело. Метод детектива: сначала улики, потом подозреваемые, проверяй по одному — от простого к сложному.</p>`; return; }
    const { c } = cur;
    $("#board").innerHTML = `<h3>${esc(c.title)}</h3><p class="det-sym"><b>Что видим:</b> ${esc(c.sym)}</p>
      <b>Проверки (чем меньше, тем лучше):</b><div class="det-checks">${c.checks.map(([label, fn], i) => cur.done.includes(i) ? `<div class="det-clue"><small>${esc(label)}</small><b>${esc(fn(cur.truth))}</b></div>` : `<button type="button" class="lab-btn" data-check="${i}" ${cur.solved ? "disabled" : ""}>🔍 ${esc(label)}</button>`).join("")}</div>
      <b>Вердикт — в чём причина?</b><div class="det-verdict">${Object.entries(c.causes).map(([k, l]) => `<button type="button" class="lab-btn ${cur.bad.includes(k) ? "bad" : ""}" data-v="${k}" ${cur.solved || cur.bad.includes(k) ? "disabled" : ""}>${esc(l)}</button>`).join("")}</div>
      ${cur.solved ? `<div class="lab-row"><button type="button" class="lab-btn" data-again>Ещё раз это дело (причина может быть другой)</button></div>` : ""}`;
  };
  root.addEventListener("click", (e) => {
    const cs = e.target.closest("[data-case]");
    if (cs) return open(cs.dataset.case);
    if (!cur) return;
    if (e.target.closest("[data-again]")) return open(cur.c.id);
    const ch = e.target.closest("[data-check]");
    if (ch) { cur.done.push(+ch.dataset.check); draw(); return; }
    const v = e.target.closest("[data-v]");
    if (!v) return;
    if (v.dataset.v === cur.truth) {
      cur.solved = true;
      solved.add(cur.c.id);
      if (solved.size >= 3) ctx.done("three");
      if (cur.done.length >= 1 && cur.done.length <= 2 && !cur.wrong) ctx.done("sharp");
      if (cur.c.id === "flip") ctx.done("flip");
      if (solved.size === CASES.length) ctx.done("all");
      $(".lab-read").textContent = `Дело раскрыто за ${cur.done.length} ${cur.done.length === 1 ? "проверку" : cur.done.length < 5 && cur.done.length ? "проверки" : "проверок"}${cur.wrong ? `, ошибок: ${cur.wrong}` : " без ошибок"}. ${cur.done.length === 0 ? "Угадал без улик — повезло, но детектив так не делает!" : ""}`;
    } else {
      cur.wrong++;
      cur.bad.push(v.dataset.v);
      v.classList.add("bad");
      v.disabled = true;
      $(".lab-read").textContent = cur.done.length ? "Улики с этим не сходятся. Перечитай их." : "Догадка без улик. Сначала проверь что-нибудь!";
      return;
    }
    draw();
  });
  draw();
  return { destroy() {} };
}
