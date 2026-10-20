// Проверка зон: ветка ассистента меняет только свои файлы, старые тесты не правятся без ревью.
// В CI: node .github/scripts/zones.mjs <ветка> <база> [метки через запятую]
// Локально перед push: npm run zones   (текущая ветка против origin/main)
import { execFileSync } from "node:child_process";

// Зоны — как в docs/ROLES.md. docs/tasks/ (доска) и docs/discussions/ (обсуждения) — общие: каждый правит только своё.
const COMMON = [/^docs\/tasks\//, /^docs\/discussions\//];
const ZONES = {
  gpt: [/^data\/(chapters-[^/]+|hints|intros|kids|appendix)\.mjs$/, /^docs\/content\//],
  gemini: [/^src\/style\.css$/, /^docs\/qa\//],
  grok: [/^docs\/reviews\//],
  claude: null, // ведущий инженер: весь репозиторий (кроме запретов ниже)
};
const FORBIDDEN = [/^data\/book-(pages|images)\.json$/];
// Старые тесты меняют только с ревью второго (метка tests-reviewed); новые файлы тестов — можно.
const TESTS = /^tests\/.+\.(mjs|js)$/;

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const branch = process.argv[2] || git("rev-parse", "--abbrev-ref", "HEAD");
const base = process.argv[3] || "origin/main";
const labels = (process.argv[4] || "").split(",").map((s) => s.trim()).filter(Boolean);

const changes = git("diff", "--name-status", "--no-renames", `${base}...HEAD`)
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [st, file] = l.split("\t");
    return { st, file };
  });

const who = branch.split("/")[0];
const zone = Object.hasOwn(ZONES, who) ? ZONES[who] : null;
const problems = [];

for (const { st, file } of changes) {
  if (FORBIDDEN.some((r) => r.test(file))) problems.push(`${file} — текст и сканы книги не коммитим (AGENTS.md, запрет 1)`);
  else if (zone && !labels.includes("cross-zone") && ![...zone, ...COMMON].some((r) => r.test(file)))
    problems.push(`${file} — чужая зона для ветки ${who}/ (docs/ROLES.md). Нужна правка — карточка задачи на владельца зоны (docs/tasks/) или метка cross-zone от владельца репозитория`);
  if (TESTS.test(file) && st !== "A" && !labels.includes("tests-reviewed"))
    problems.push(`${file} — меняется существующий тест. Нужно ревью второго ассистента или владельца, затем метка tests-reviewed`);
}

console.log(`ветка ${branch}, база ${base}, файлов изменено: ${changes.length}${labels.length ? `, метки: ${labels.join(", ")}` : ""}`);
if (problems.length) {
  console.log("\nНарушения:");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("Зоны соблюдены.");
