window.__set = (id, v) => { const r = document.querySelector(`[data-ctl="${id}"]`); if (r.type === "checkbox") { if (r.checked !== !!v) r.click(); } else { r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); } };
window.__seg = (id, v) => document.querySelector(`[data-seg="${id}"][data-value="${v}"]`).click();
