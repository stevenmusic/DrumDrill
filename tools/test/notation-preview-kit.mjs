// notation-preview.html?kit=…:鼓組記譜樣張 + 圖例(樣張清單在 kitsamples.mjs)
// notation-preview.html?playback=all(或 0,3,8)&per=2&seed=1:Trinity Playback 產生器(js/shared/playbackgen.js)每一級畫 per 題(種子 seed 起),
//   每一級放在 #pb-<級> 裡(notation.mjs 截圖 playback-<級>.png);標題 = 級數 · 種子 · 拍號 · 句長 · 力度 · 說明 key
// notation-preview.html?rslkit=4,5&per=2&seed=1:RSL 整組鼓視奏(js/shared/kitgen.js)每一級 per 題,放在 #rk-<級>(截圖 rslkit-<級>.png)
// notation-preview.html?fill=0..8&per=1&seed=1:RSL 聽力 Fill(js/ear/gen.js)每一級 per 題 + 干擾選項(答案標 ✓),放在 #fill-<級>(截圖 fill-<級>.png)
// notation-preview.html?groove=0..8&per=1&seed=1:RSL 聽力 Groove 每一級 per 題,放在 #gr-<級>(截圖 groove-<級>.png)
//   級數可以寫 all、0..8(範圍)或 0,3,8
// 每張樣張用 OSMD 畫在白色紙張上(跟 App 的 .paper 一樣),放不下就縮小(最小 0.45);window.__kit 給 notation.mjs 檢查
const Q = new URLSearchParams(location.search);
const lang = Q.get("lang");
if (lang === "zh" || lang === "en") { try { localStorage.setItem("drumdrill-lang", lang); } catch (e) {} }
for (const href of ["../../css/app.css", "../../css/drum.css"]) {
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
  await new Promise(r => { l.onload = l.onerror = r; });
}
const style = document.createElement("style");
style.textContent = `body{margin:0;padding:12px;background:var(--bg);color:var(--ivory)}#out{display:flex;flex-direction:column;gap:12px;max-width:1100px;margin:0 auto}
.kp-title{font-size:13px;font-weight:700;color:var(--gold-bright);margin:0 0 6px}.kp-err{color:#c33;font-size:12px}.kit-paper{background:var(--paper);border-radius:var(--radius-sm);padding:8px;overflow:hidden}`;
document.head.appendChild(style);
const { KIT_SAMPLES, pickSamples } = await import("./kitsamples.mjs");
const { scoreXML, piecesUsed, osmdXML } = await import("../../js/shared/kitnotation.js");
const { drawLegend, decorate, setupKit } = await import("../../js/shared/legend.js");
const { tr } = await import("../../js/shared/i18n.js");
window.__L = await import("../../js/shared/legend.js");   // notation.mjs 用(符頭位置、補畫的記號)
const key = await (await fetch("../../data/drumkey.json")).json();
const out = document.getElementById("out");
let samples;
const gradeList = (q, all) => (!q || q === "all" ? all : /^\d\.\.\d$/.test(q) ? all.filter(g => g >= Number(q[0]) && g <= Number(q[3])) : q.split(",").map(Number));
const perOf = def => Number(Q.get("per")) || def, seed0 = Number(Q.get("seed")) || 1;   // 每一級幾題(沒寫:Playback、整組鼓視奏 2 題,Fill、Groove 1 題)
const NOTE_SRC = (NOTES, ks) => ks.map(k => `${k}${NOTES[k] ? ":" + NOTES[k].kind[0] : ""}`).join(", ");
if (Q.get("rslkit") != null || Q.get("fill") != null || Q.get("groove") != null) {
  const rsl = await (await fetch("../../data/exam-rsl.json")).json();
  samples = [];
  if (Q.get("rslkit") != null) {
    const { genRslKit, NOTES } = await import("../../js/shared/kitgen.js");
    for (const g of gradeList(Q.get("rslkit"), [4, 5])) for (let k = 0; k < perOf(2); k++) {
      const seed = seed0 + k, q = genRslKit(rsl.sight[g], seed, g);
      samples.push({ id: `rk-${g}-${seed}`, group: `rk-${g}`, box: true, spec: q.spec, events: q.events,
        label: `RSL ${rsl.gradeNames[g][1]} sight reading · seed ${seed} · ♩=${q.bpm} (${q.bpmRange.join("–")}) · ${q.cyms.join("/")} · develop bars ${q.develop.from + 1}–${q.develop.from + q.develop.bars} · [${NOTE_SRC(NOTES, q.notes)}]` });
    }
  }
  if (Q.get("fill") != null) {
    const { genFill, fillOptions, NOTES } = await import("../../js/ear/gen.js");
    for (const g of gradeList(Q.get("fill"), [0, 1, 2, 3, 4, 5, 6, 7, 8])) for (let k = 0; k < perOf(1); k++) {
      const seed = seed0 + k, f = genFill(rsl.ear[g], seed, g), o = fillOptions(f, seed);
      o.options.forEach((x, i) => samples.push({ id: `fill-${g}-${seed}-${i}`, group: `fill-${g}`, box: true, spec: x.spec, events: x.events,
        label: `RSL ${rsl.gradeNames[g][1]} fill · seed ${seed} · ${"ABC"[i]}${i === o.answer ? " ✓ answer" : ` (beat ${x.changed + 1} changed)`} · ♩=${x.bpm} · ${x.cells.join(" ")}` +
          (i === 0 ? ` · [${NOTE_SRC(NOTES, f.notes)}]` : "") }));
    }
  }
  if (Q.get("groove") != null) {
    const { genGroove, NOTES } = await import("../../js/ear/gen.js");
    for (const g of gradeList(Q.get("groove"), [0, 1, 2, 3, 4, 5, 6, 7, 8])) for (let k = 0; k < perOf(1); k++) {
      const seed = seed0 + k, q = genGroove(rsl.ear[g], seed, g);
      samples.push({ id: `gr-${g}-${seed}`, group: `gr-${g}`, box: true, spec: q.spec, events: q.events,
        label: `RSL ${rsl.gradeNames[g][1]} groove · seed ${seed} · ♩=${q.bpm} (${q.bpmRange.join("–")}) · ×${q.repeat} · ${q.pieces.join(" ")} · [${NOTE_SRC(NOTES, q.notes)}]` });
    }
  }
} else if (Q.get("playback") != null) {
  const { genChart, playbackParams } = await import("../../js/shared/playbackgen.js");
  const data = await (await fetch("../../data/exam-trinity.json")).json();
  const gs = gradeList(Q.get("playback"), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  samples = gs.flatMap(g => Array.from({ length: perOf(2) }, (_, k) => {
    const seed = seed0 + k, c = genChart(playbackParams(g, data), seed);
    const label = `${data.gradeNames[g][1]} · seed ${seed} · ${c.times.join(" → ")} · ${c.phrases.map(p => p.bars).join("+")} = ${c.totalBars} bars` +
      (c.dyn.length ? " · " + c.dyn.map(d => d.mark).join(" ") : "") + " · [" + c.notes.join(", ") + "]";
    return { id: `pb-${g}-${seed}`, group: `pb-${g}`, box: true, label, spec: c.spec };
  }));
} else samples = pickSamples(Q.get("kit"));
window.__kit = [];

// 圖例:樣張用到的所有鼓件(五線)、單線譜的小鼓
const card = (title, host = out) => { const c = document.createElement("section"); c.className = "card"; const h = document.createElement("h3"); h.className = "kp-title"; h.textContent = title; c.appendChild(h); host.appendChild(c); return c; };
// 出題器的題目(Playback、RSL):每一級一個框(截圖用)
const groupBox = id => { let el = document.getElementById(id); if (!el) { el = document.createElement("div"); el.id = id; el.style.cssText = "display:flex;flex-direction:column;gap:12px"; out.appendChild(el); } return el; };
const used = new Set(samples.filter(s => s.spec.lines !== 1).flatMap(s => piecesUsed({ ...s.spec, key })));
if (used.size) { const c = card(tr("圖例(五線)", "Drum key (5-line)")); const el = document.createElement("div"); el.id = "legend5"; c.appendChild(el); await drawLegend(el, { pieces: [...used], lines: 5, key }); }
if (samples.some(s => s.spec.lines === 1)) { const c = card(tr("圖例(單線)", "Drum key (1-line)")); const el = document.createElement("div"); el.id = "legend1"; c.appendChild(el); await drawLegend(el, { pieces: [key.singleLine.piece], lines: 1, key }); }

for (const s of samples) {
  const c = card(s.label || s.id, s.box ? groupBox(s.group) : out), paper = document.createElement("div"), box = document.createElement("div");
  c.dataset.sample = s.id; paper.className = "kit-paper"; paper.appendChild(box); c.appendChild(paper);
  const rec = { id: s.id, group: s.group, lines: s.spec.lines || 5, xml: null, err: null, zoom: null, marks: 0, events: s.events || null };
  window.__kit.push(rec);
  try {
    rec.xml = scoreXML({ ...s.spec, key, title: s.id });
    const o = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false, drawMeasureNumbers: false, drawingParameters: "compacttight" });
    setupKit(o, rec.lines, rec.xml);
    await o.load(osmdXML(rec.xml));
    // 放不下就縮小(最小 0.45);鬼音括號放不下(decorate 的 kitTight)也縮小,讓 OSMD 有寬度排開
    let z = Number(Q.get("zoom")) || 0.8;
    for (let k = 0; k < 8; k++) {
      o.zoom = z; o.render();
      rec.marks = decorate(o, rec.xml, box.querySelector("svg"));
      const svg = box.querySelector("svg"), w = svg.getBoundingClientRect().width, avail = paper.clientWidth - 16, tight = Number(svg.dataset.kitTight) > 0;
      if ((w <= avail + 1 && !tight) || z <= 0.45) break;
      z = Math.max(0.45, w > avail + 1 ? z * avail / w * 0.98 : z * 0.85);
    }
    rec.zoom = z;
    rec.osmd = o; rec.el = c;
  } catch (e) {
    console.error(s.id, e); rec.err = e.message;
    const p = document.createElement("p"); p.className = "kp-err"; p.textContent = "ERR " + e.message; c.appendChild(p);
  }
}
