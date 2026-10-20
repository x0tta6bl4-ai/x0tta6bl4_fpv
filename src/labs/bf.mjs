// Гл. 15. Тренажёр Betaflight: бэкап → Порты → Приёмник → Режимы → Конфигурация → Моторы, живые флаги запрета арма.
import { esc } from "../labkit.mjs";

export const meta = {
  id: "bf",
  title: "Тренажёр Betaflight",
  missions: [
    { id: "backup", text: "Сделай резервную копию ДО любых изменений" },
    { id: "rx", text: "Убери флаг RXLOSS: полётник должен «услышать» приёмник" },
    { id: "ready", text: "Убери все флаги (кроме MSP) и щёлкни тумблером ARM" },
    { id: "motors", text: "Проверь моторы безопасно" },
  ],
};
const TABS = [["cli", "CLI"], ["setup", "Система"], ["ports", "Порты"], ["rx", "Приёмник"], ["modes", "Режимы"], ["cfg", "Конфигурация"], ["motors", "Моторы"]];
const FLAGS = {
  RXLOSS: "нет данных с приёмника → порт, протокол",
  THROTTLE: "газ не внизу → порядок каналов",
  NO_ACC_CAL: "акселерометр не откалиброван → Система",
  MOTOR_PROTO: "не выбран протокол ESC → Моторы",
  ANGLE: "наклон больше угла арма → положи ровно или Конфигурация (small_angle)",
  MSP: "подключён Configurator — это норма",
};

export function mount(root, ctx) {
  const s = { tab: "cli", changes: 0, backup: false, diffShown: false, uart: 0, prov: "none", map: "TAER", arm: "none", acc: false, angle: 25, tilt: true, proto: "none", props: true, batt: false, armSw: false, mot: [0, 0, 0, 0], log: "" };
  root.innerHTML = `<div class="bf"><div class="bf-top"><b>Betaflight Configurator</b><span class="bf-flags" id="flags"></span><button type="button" class="lab-btn" data-armsw>Тумблер ARM (AUX1): выкл</button></div>
    <div class="bf-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}">${l}</button>`).join("")}</div><div class="bf-body" id="body"></div></div>
    <p class="lab-read" aria-live="polite"></p>`;
  const $ = (q) => root.querySelector(q);
  const flags = () => {
    const f = [];
    if (s.uart !== 2 || s.prov !== "CRSF") f.push("RXLOSS");
    else if (s.map !== "AETR") f.push("THROTTLE");
    if (!s.acc) f.push("NO_ACC_CAL");
    if (s.proto === "none") f.push("MOTOR_PROTO");
    if (s.tilt && s.angle < 180) f.push("ANGLE");
    f.push("MSP");
    return f;
  };
  const say = (t) => { $(".lab-read").innerHTML = t; };
  const change = () => {
    s.changes++;
    if (flags().indexOf("RXLOSS") < 0) ctx.done("rx");
  };
  const sel = (key, opts, val) => `<select data-k="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const views = {
    cli: () => `<p>Командная строка. Первое правило: прежде чем что-то менять — сохранить копию настроек.</p><div class="lab-row"><button type="button" class="lab-btn" data-act="diff">diff all</button><button type="button" class="lab-btn" data-act="save" ${s.diffShown ? "" : "disabled"}>Сохранить в файл</button></div><pre class="bf-pre">${s.diffShown ? "# diff all\n# version: Betaflight 4.5\nboard_name SPEEDYBEEF405\nfeature -RX_PARALLEL_PWM\nserial 1 0 115200 57600 0 115200\n..." : "# _"}</pre>${s.backup ? `<p class="good">Файл сохранён: backup.txt</p>` : ""}`,
    ports: () => `<p>Приёмник припаян к <b>R2/T2</b>. Включи Serial RX на нужном UART.</p><table class="bf-t"><tr><th>Порт</th><th>Serial RX</th></tr>${[1, 2, 3].map((n) => `<tr><td>UART${n}</td><td><label class="lab-toggle"><input type="radio" name="bfu" data-uart="${n}" ${s.uart === n ? "checked" : ""}><span>вкл</span></label></td></tr>`).join("")}<tr><td>USB VCP</td><td>не трогать</td></tr></table><p class="lab-small">После «Сохранить» плата перезагрузится.</p>`,
    rx: () => `<label class="bf-f">Режим приёмника ${sel("mode", [["serial", "Serial (через UART)"]], "serial")}</label><label class="bf-f">Протокол ${sel("prov", [["none", "— не выбран —"], ["SBUS", "SBUS"], ["IBUS", "IBUS"], ["CRSF", "CRSF"]], s.prov)}</label><label class="bf-f">Порядок каналов (пульт Radiomaster шлёт AETR) ${sel("map", [["TAER", "TAER"], ["AETR", "AETR"]], s.map)}</label>${s.uart === 2 && s.prov === "CRSF" ? `<p>Газ на пульте внизу. Полоса газа в Betaflight: <b class="${s.map === "AETR" ? "good" : "bad"}">${s.map === "AETR" ? "1000" : "1500"}</b>${s.map === "AETR" ? "" : " — канал крена попал в газ!"}</p>` : `<p class="bad">Полоски каналов стоят — данных нет.</p>`}`,
    modes: () => `<label class="bf-f">ARM включается каналом ${sel("arm", [["none", "— не назначено —"], ["AUX1", "AUX1 (CH5)"], ["AUX2", "AUX2 (CH6)"]], s.arm)}</label><div class="bf-range"><span class="bf-band"></span><span class="bf-pos" style="left:${s.armSw ? 86 : 8}%"></span></div><p class="lab-small">Жёлтая отметка — где сейчас тумблер. Синий диапазон — где ARM включён. ${s.arm === "AUX1" ? "Тумблер ARM на пульте — это AUX1." : ""}</p>`,
    setup: () => `<p>«Система» — пульс борта: 3D-модель, калибровка, флаги запрета арма.</p><label class="lab-toggle"><input type="checkbox" data-k="tilt" ${s.tilt ? "checked" : ""}><span>Борт лежит наклонённым (в руках, на коробке)</span></label><div class="lab-row"><button type="button" class="lab-btn" data-act="acc" ${s.acc ? "disabled" : ""}>${s.acc ? "Акселерометр откалиброван ✓" : "Калибровать акселерометр"}</button></div>`,
    cfg: () => `<label class="bf-f">Угол арма (small_angle) ${sel("angle", [[25, "25° — по умолчанию: не даёт армиться наклонённым"], [180, "180° — по курсу: арм в любом положении"]], s.angle)}</label>`,
    motors: () => `<label class="bf-f">Протокол ESC ${sel("proto", [["none", "— не выбран —"], ["PWM", "PWM"], ["DSHOT300", "DShot300"], ["DSHOT600", "DShot600"]], s.proto)}</label><label class="lab-toggle"><input type="checkbox" data-k="props" ${s.props ? "checked" : ""}><span>Пропеллеры стоят</span></label><label class="lab-toggle"><input type="checkbox" data-k="batt" ${s.batt ? "checked" : ""}><span>Батарея подключена</span></label><div class="lab-row"><button type="button" class="lab-btn" data-act="mtest">Тест моторов: крутнуть по очереди</button></div><div class="bf-mot">${s.mot.map((v, i) => `<div><span style="height:${v * 100}%"></span><small>M${i + 1}</small></div>`).join("")}</div>`,
  };
  const render = () => {
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === s.tab)));
    $("#body").innerHTML = views[s.tab]();
    const f = flags();
    $("#flags").innerHTML = f.map((x) => `<button type="button" class="bf-flag ${x === "MSP" ? "ok" : ""}" data-flag="${x}" title="${esc(FLAGS[x])}">${x}</button>`).join("");
    $("[data-armsw]").textContent = `Тумблер ARM (AUX1): ${s.armSw ? "вкл" : "выкл"}`;
  };
  root.addEventListener("click", (e) => {
    const fl = e.target.closest("[data-flag]");
    if (fl) { say(`<b>${fl.dataset.flag}</b> — ${esc(FLAGS[fl.dataset.flag])}.`); return; }
    const t = e.target.closest("[data-tab]");
    if (t) { s.tab = t.dataset.tab; render(); return; }
    const a = e.target.closest("[data-act]");
    if (a) {
      const act = a.dataset.act;
      if (act === "diff") { s.diffShown = true; say("Это все отличия от заводских настроек. Сохрани их в файл."); }
      if (act === "save") {
        s.backup = true;
        if (s.changes === 0) { ctx.done("backup"); say("Бэкап сделан до изменений. Теперь любую ошибку можно откатить."); }
        else say("Сохранено, но ты уже успел что-то поменять. Правильно — копию ДО изменений.");
      }
      if (act === "acc") {
        if (s.tilt) say("Борт лежит наклонённым — калибровка запомнит кривой «горизонт», и в Angle дрон будет уплывать. Положи борт ровно и повтори.");
        else { s.acc = true; change(); say("Борт стоял ровно — калибровка прошла."); }
      }
      if (act === "mtest") {
        if (s.proto === "none") say("Сначала выбери протокол ESC.");
        else if (s.props) say("<b class='bad'>Стоп!</b> С пропеллерами на столе моторы — это четыре лезвия. Сними пропы.");
        else if (!s.batt) say("Моторы молчат: от USB они не питаются. Подключи батарею (пропы сняты!).");
        else {
          ctx.done("motors");
          say("Моторы крутнулись по очереди: 1, 2, 3, 4. Проверь номер и направление каждого.");
          let i = 0;
          const step = () => { s.mot = s.mot.map((_, k) => (k === i ? 0.7 : 0)); if (s.tab === "motors") render(); i++; if (i <= 4) setTimeout(step, 450); };
          step();
        }
      }
      render();
      return;
    }
    if (e.target.closest("[data-armsw]")) {
      s.armSw = !s.armSw;
      const f = flags().filter((x) => x !== "MSP");
      if (s.armSw) {
        if (s.arm !== "AUX1") say("Тумблер щёлкнул, но ARM не назначен на AUX1 — ничего не произошло. Вкладка «Режимы».");
        else if (f.length) say(`Арм запрещён. Полётник сам называет причины: ${f.map((x) => `<b>${x}</b> — ${esc(FLAGS[x])}`).join("; ")}.`);
        else { ctx.done("ready"); say("Флагов нет, кроме MSP. MSP значит «подключён компьютер» — отключишь USB, и борт заармится. Готово!"); }
      }
      render();
    }
  });
  root.addEventListener("change", (e) => {
    const u = e.target.closest("[data-uart]");
    if (u) { s.uart = +u.dataset.uart; change(); say(s.uart === 2 ? "UART2 — туда и припаян приёмник." : `UART${s.uart}? Приёмник припаян к R2/T2 — там его и ищи.`); render(); return; }
    const k = e.target.closest("[data-k]");
    if (!k) return;
    const key = k.dataset.k;
    if (k.type === "checkbox") s[key] = k.checked;
    else s[key] = key === "angle" ? +k.value : k.value;
    if (key !== "props" && key !== "batt" && key !== "tilt") change();
    if (key === "prov" && s.prov !== "CRSF" && s.prov !== "none") say("ELRS и Crossfire пересказывают полётнику на языке CRSF. Выбери CRSF.");
    if (key === "proto" && s.proto === "PWM") say("PWM работает, но курс использует DShot: точное число с контрольной суммой, калибровка не нужна.");
    render();
  });
  render();
  say("Начни с вкладки CLI. Флаги наверху — причины, по которым полётник не даёт заармиться. Нажми на флаг — узнаешь, куда смотреть.");
  return { destroy() {} };
}
