// Быстрый просмотр стенда: статический рендер в карточке, обе темы.
import { writeFileSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";
const [,, name, theme = "light", json = "{}"] = process.argv;
const fig = await import(`./src/figs/${name}.mjs`);
const state = { ...fig.defaults, ...JSON.parse(json) };
const t0 = performance.now();
const built = fig.render(state);
const ms = performance.now() - t0;
const body = k.plateHtml({ fig: "Fig", title: fig.meta.title, hint: fig.meta.hint, readout: "readout", keys: fig.meta.keys, caption: fig.meta.caption, body: `<div class="iso-stage">${built.svg}</div>` });
writeFileSync(`preview/${name}-${theme}.html`, k.pageHtml({ title: name, theme, body, width: 900 }));
console.log(name, theme, "items", built.parts, "svg KB", (built.svg.length / 1024).toFixed(0), "ms", ms.toFixed(0));
