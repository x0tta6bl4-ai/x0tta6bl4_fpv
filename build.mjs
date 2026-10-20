// Сборка: автономный HTML (по умолчанию) или фрагмент для публикации на claude.ai (--artifact).
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { ISO_CSS } from "./kit/iso-kit.mjs";

const noImages = process.argv.includes("--no-images");
const artifact = process.argv.includes("--artifact");
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) || (artifact ? "dist/fpv-anatomy-artifact.html" : "dist/fpv-anatomy-v4.html");
// «?raw» — подключить файл как текст: вкладка «Код» лаборатории методов показывает настоящий исходник, а не сжатый.
const rawPlugin = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, "")), namespace: "raw" }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, async (a) => ({ contents: await fs.promises.readFile(a.path, "utf8"), loader: "text" }));
  },
};
const r = await build({ entryPoints: ["src/app.mjs"], bundle: true, format: "iife", write: false, minify: true, target: "es2020", legalComments: "none", plugins: [rawPlugin] });
const js = r.outputFiles[0].text;

// Темы: токены на :root — светлые по умолчанию, тёмные по системной теме или по явному data-theme="dark".
function take(css, re) {
  const m = css.match(re);
  if (!m) throw new Error("token block not found: " + re);
  return [m[1], css.replace(m[0], "")];
}
let iso = ISO_CSS, page = readFileSync("src/style.css", "utf8");
let isoDark, isoLight, myLight, myDark;
[isoDark, iso] = take(iso, /\.iso\{([^}]*)\}/);
[isoLight, iso] = take(iso, /\.iso\[data-theme="light"\]\{([^}]*)\}/);
[myLight, page] = take(page, /\.iso\{([^}]*)\}/);
[myDark, page] = take(page, /\.iso:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
const tokens = `:root{${isoDark};${isoLight};${myLight};color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${isoDark};${myDark};color-scheme:dark}}
:root[data-theme="dark"]{${isoDark};${myDark};color-scheme:dark}
`;
const css = tokens + iso + page;
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Literata:opsz,wght@7..72,400;7..72,500&display=swap">`;
const json = (s) => s.replace(/</g, "\\u003c");
// Текст и сканы книги лежат вне git (см. README): без них учебник собирается, но без раздела «Материал книги».
const book = (f, empty) => {
  if (fs.existsSync(f)) return json(readFileSync(f, "utf8"));
  console.warn(`нет ${f} — сборка без него`);
  return empty;
};
const pages = book("data/book-pages.json", "[]");
const imgs = noImages ? "{}" : book("data/book-images.json", "{}");
const title = "FPV Anatomy";
const body = `<header class="top"><div class="brand">FPV / ANATOMY <span>· V4 · по книге, ред. 7</span></div><span class="stars" id="stars" title="Звёзды за выполненные миссии">★ 0</span><span class="sync" id="sync">Прогресс — в этом браузере</span><div class="grow"></div><select id="chsel" aria-label="Глава книги"></select><label class="switch"><input type="checkbox" id="fast"> Быстрый проход ①</label><button type="button" id="theme">Тёмная тема</button></header>
<div class="layout"><aside id="toc" aria-label="Оглавление и повторения"></aside><main id="main"><noscript><p>Для учебника и стендов включи JavaScript.</p></noscript></main></div>
<footer class="foot">Учебные иллюстрации и модели, а не эмулятор прошивки или паспорт оборудования. Числа на стендах — оценки по упрощённым моделям с метками «закон / оценка». Источник: книга «FPV-дрон: понять, а не зазубрить», редакция 7, октябрь 2026, 92 с. Стенды построены на наборе <a href="https://github.com/wheresryan22/anatomy" rel="noopener" target="_blank">Anatomy</a> (MIT). Клавиши: [ и ] — предыдущая и следующая глава.</footer>
<div class="sr" aria-live="polite" id="announce"></div><div id="toast" class="toast" role="status" hidden></div><div id="boot-error" hidden role="alert"></div>
<script type="application/json" id="book-pages">${pages}</script>
<script type="application/json" id="book-images">${imgs}</script>
<script>window.addEventListener("error",function(e){var b=document.getElementById("boot-error");b.hidden=false;b.textContent="Ошибка интерактивной части: "+(e.message||e.error)+". Текст книги доступен в оглавлении.";});</script>
<script>${js.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
const html = artifact
  ? `<title>${title}</title><meta name="claude:viewport-fit-sides" content="cover"><meta name="description" content="Интерактивный учебник по книге «FPV-дрон: понять, а не зазубрить»">${fonts}<style>${css}</style>\n${body}`
  : `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title><meta name="description" content="Интерактивный учебник по книге «FPV-дрон: понять, а не зазубрить» (редакция 7): загадки, стенды, самопроверка и интервальное повторение.">${fonts}<style>${css}</style></head>\n<body class="iso">\n${body}\n</body></html>`;
mkdirSync("dist", { recursive: true });
writeFileSync(out, html);
console.log("wrote", out, (html.length / 1024 / 1024).toFixed(2), "MB; js", (js.length / 1024).toFixed(0), "KB");
