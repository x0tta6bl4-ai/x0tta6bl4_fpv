// Все автотесты подряд. Каждый тест печатает свою строку итога; здесь она проверяется по образцу.
// Запуск: npm test (сначала собирает dist/dev.html). Код выхода 1, если хоть один тест не прошёл.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const T = [
  // [файл, что проверяет, как понять, что всё хорошо]
  ["missions.mjs", "задания всех стендов проходятся как ученик", (o) => /^ERR 0 /m.test(o) && starsDone(o)],
  ["labs.mjs", "плоская лаба гл. 20 (карточки)", (o) => /^ERRORS 0 /m.test(o) && !/☆/.test(o)],
  ["routes.mjs", "все страницы открываются без ошибок (ПК и телефон)", (o) => (o.match(/routes \d+ errors \[\]/g) || []).length === 2],
  ["width.mjs", "ни одна страница не шире экрана телефона", (o) => /too wide: \[\]/.test(o)],
  ["phone.mjs", "приёмка телефона (3 размера экрана)", (o) => /FAIL 0,/.test(o)],
  ["tap-parts.mjs", "касание детали объясняет её", (o) => { const m = o.match(/OK (\d+)\/(\d+)/); return !!m && Number(m[2]) - Number(m[1]) <= 1 && /errors \[\]/.test(o); }],
  ["armcase.mjs", "гл. 17: все 30 дел разбора закрываются", (o) => /ERR 0 \[\]/.test(o)],
  ["drone3d.mjs", "гл. 3: 3D-модель крутится, детали касанием, 4 задания", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["path3d.mjs", "гл. 1: 3D два радиомоста, пакеты, три задания", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["lowv.mjs", "гл. 6: урок LOW V — звезда только за причину, исправление и контроль", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["drone3d-details.mjs", "гл. 3: геометрия модели, разборка и фокус на 4 ширинах, режим без WebGL", (o) => /PASS режим без WebGL/.test(o)],
  ["srez.mjs", "вопросы среза: у каждого есть место в учебнике, цитаты на месте", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["study.mjs", "порядок главы, свернутые блоки, расписание повтора, пробный срез", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["chapter-path.mjs", "путь главы: физика и опыт в конце свёрнуты, ③ свёрнуты, «① главное», без PID-опыта", (o) => /FAIL 0$/m.test(o) && /^ERR 0 \[\]/m.test(o)],
  ["operator-guide.mjs", "шпаргалка оператора: расчёты в одном месте, ссылки, ширина, касания гл. 7", (o) => /PASS operator: все детали главы 7/.test(o)],
];
// В missions.mjs звёзды печатаются по ходу опыта (☆ — ещё не сделано); итог главы — её последняя строка со звёздами.
function starsDone(o) {
  const last = new Map();
  for (const line of o.split("\n")) if (/[★☆]/.test(line)) last.set(line.split(" ")[0], line);
  return last.size > 0 && [...last.values()].every((l) => !l.includes("☆"));
}
const only = process.argv.slice(2);
let failed = 0;
for (const [file, what, ok] of T) {
  if (only.length && !only.some((x) => file.startsWith(x))) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [resolve(ROOT, "tests", file)], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && ok(out);
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${file.padEnd(15)} ${what}  (${Math.round((Date.now() - t0) / 1000)} с)`);
  if (!pass) console.log(out.split("\n").filter((l) => /FAIL|ERR|☆|error|Error|too wide|OK \d| → /.test(l)).slice(0, 25).map((l) => "      " + l).join("\n"));
}
console.log(failed ? `\nНе прошло: ${failed}` : "\nВсё прошло.");
process.exit(failed ? 1 : 0);
