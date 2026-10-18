// 瀏覽器實際畫譜檢查(對應 PianoDrill 的 notation.mjs):用 OSMD(vendor)把譜畫出來,讀 SVG 比對
//  1. PAS 40 個基本打法(js/tech/notation.js,notation-preview.html?n=1..40):沒有錯誤;SVG 的符頭數 = MusicXML 的 <note> 數(含裝飾音、休止符)
//  2. 鼓組記譜樣張(js/shared/kitnotation.js,notation-preview.html?kit=all;樣張在 kitsamples.mjs):
//     沒有錯誤;符頭數 = <note> 數;每種符頭形狀(一般 / x / 菱形 / 圈 x / 斜線)的數量 = MusicXML;
//     每個符頭的高度 = drumkey.json 的位置(五線:E4 = 最下面那條線;單線:在線上);
//     補畫的記號(鬼音括號、開 HH 的 o)數量 = MusicXML;閉 HH 的 + 是 OSMD 畫的(lefthandpizzicato)
//  3. 折疊機 280 寬:樣張不超出紙張、沒有橫向捲動;圖例中英版面一樣(每一格的位置、大小相同)
// 截圖存到 tools/test/out/notation/(基本打法、樣張 1000 寬 + 每一張、280 寬中英)
// 用法:node tools/test/notation.mjs
import { open } from "./harness.mjs";
import fs from "node:fs";
const OUT = new URL("./out/notation/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
const fail = m => { bad++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);

/* 1. PAS 40 個基本打法 */
{
  const nos = Array.from({ length: 40 }, (_, i) => i + 1).join(",");
  const { page, errors, close } = await open({ viewport: { width: 1000, height: 900 }, path: "tools/test/notation-preview.html?n=" + nos });
  const res = await page.evaluate(() => [...document.querySelectorAll(".r")].map(d => ({
    no: Number(d.dataset.no), err: d.dataset.err || null, want: (d._xml.match(/<note>/g) || []).length, got: d.querySelectorAll("svg .vf-notehead").length
  })));
  const n0 = bad;
  if (res.length !== 40) fail(`基本打法只畫了 ${res.length} 個`);
  for (const r of res) {
    if (r.err) fail(`基本打法 ${r.no}:OSMD 錯誤 ${r.err}`);
    else if (r.want !== r.got) fail(`基本打法 ${r.no}:符頭 ${r.got} 個,MusicXML 有 ${r.want} 個`);
  }
  for (const e of errors) fail("基本打法 console:" + e);
  if (bad === n0) ok(`PAS 40 個基本打法:OSMD 畫出來沒有錯誤,符頭數 = MusicXML(共 ${res.reduce((s, r) => s + r.got, 0)} 個)`);
  await page.screenshot({ path: OUT + "rudiments.png", fullPage: true });
  await close();
}

/* 2. 鼓組記譜樣張 */
// MusicXML 的符頭形狀 → VexFlow 畫出來的字形(OSMD 2.1.0 / VexFlow 1.2;一般 = 黑 / 二分 / 全音符,x = 四分以下 / 二分以上)
const GLYPH = { normal: ["vb", "v81", "v1d"], x: ["v3e", "v95", "v92"], "circle-x": ["v3b"], diamond: ["v22", "v27", "v2d"], slash: [undefined] };
async function kitPage(width, lang, shots){
  const { page, errors, close } = await open({ viewport: { width, height: 900 }, path: `tools/test/notation-preview.html?kit=all${lang ? "&lang=" + lang : ""}` });
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  const res = await page.evaluate(({ GLYPH }) => {
    const L = window.__L, out = [];
    const ord = (s, o) => o * 7 + "CDEFGAB".indexOf(s);
    for (const r of window.__kit) {
      const o = { id: r.id, err: r.err, issues: [] };
      out.push(o);
      if (r.err || !r.osmd) continue;
      const svg = r.el.querySelector(".kit-paper svg"), doc = new DOMParser().parseFromString(r.xml, "application/xml");
      // 符頭數
      const want = (r.xml.match(/<note>/g) || []).length, got = svg.querySelectorAll(".vf-notehead").length;
      if (want !== got) o.issues.push(`符頭 ${got} 個,MusicXML 有 ${want} 個`);
      // 每種形狀的數量(不含休止符)
      const wantShape = {}, gotShape = {};
      for (const n of doc.querySelectorAll("note")) { if (n.querySelector("rest")) continue; const h = (n.querySelector("notehead") || { textContent: "normal" }).textContent; wantShape[h] = (wantShape[h] || 0) + 1; }
      const fam = code => Object.keys(GLYPH).find(k => GLYPH[k].includes(code)) || "?" + code;
      for (const row of r.osmd.GraphicSheet.MeasureList) for (const gm of row) if (gm) for (const se of gm.staffEntries) for (const gve of se.graphicalVoiceEntries) for (const gn of gve.notes) {
        if (gn.sourceNote.isRest()) continue;
        const vf = gn.vfnote[0], h = vf.note_heads && vf.note_heads[gn.vfnoteIndex], f = fam(h && h.glyph_code);
        gotShape[f] = (gotShape[f] || 0) + 1;
      }
      const ks = new Set([...Object.keys(wantShape), ...Object.keys(gotShape)]);
      for (const k of ks) if ((wantShape[k] || 0) !== (gotShape[k] || 0)) o.issues.push(`${k} 符頭 畫了 ${gotShape[k] || 0} 個,MusicXML 有 ${wantShape[k] || 0} 個`);
      // 符頭高度:MusicXML 的 display-step → 相對最下面那條線幾個半格
      const gns = L.graphicalNotes(r.osmd);
      let checked = 0;
      [...doc.querySelectorAll("part > measure")].forEach((m, mi) => {
        let t = 0, start = 0, k = 0;
        for (const el of m.children) {
          if (el.tagName === "backup") { t -= Number(el.querySelector("duration").textContent); continue; }
          if (el.tagName !== "note" || el.querySelector("grace")) continue;
          if (el.querySelector("chord")) k++; else { start = t; t += Number(el.querySelector("duration").textContent); k = 0; }
          if (el.querySelector("rest")) continue;
          const voice = Number(el.querySelector("voice").textContent), s = el.querySelector("display-step").textContent, oc = Number(el.querySelector("display-octave").textContent);
          const g = gns.find(x => x.mi === mi && x.voice === voice && x.t === start && x.k === k);
          if (!g) { o.issues.push(`第 ${mi + 1} 小節 聲部 ${voice} ${start / 2520} 拍:找不到 OSMD 畫的音`); continue; }
          const st = g.gn.parentVoiceEntry.parentStaffEntry.parentMeasure.stave, nl = st.getNumLines(), sp = st.getSpacingBetweenLines();
          const b = L.headBox(g.gn); if (!b) { o.issues.push(`第 ${mi + 1} 小節:量不到符頭`); continue; }
          // 單線譜:OSMD 用五線的 stave、只畫中間那條線 → 從中間那條線算
          const ref = r.lines === 1 ? Math.floor((nl - 1) / 2) : nl - 1;
          const cy = b.head.y + b.head.height / 2, steps = (st.getYForLine(ref) - cy) / (sp / 2);
          const want = r.lines === 1 ? 0 : ord(s, oc) - ord("E", 4);
          if (Math.abs(steps - want) > 0.35) o.issues.push(`第 ${mi + 1} 小節 聲部 ${voice} ${start / 2520} 拍 ${s}${oc}:畫在第 ${steps.toFixed(1)} 半格,應該是 ${want}`);
          checked++;
        }
      });
      o.checked = checked;
      // 補畫的記號:鬼音一個括號一對、開 HH 一個 o
      const marks = L.marksOf(r.xml), wantMarks = marks.reduce((s, m) => s + (m.ghost ? 2 : 0) + (m.open ? 1 : 0), 0);
      const gotMarks = svg.querySelectorAll(".kit-mark").length;
      if (wantMarks !== gotMarks) o.issues.push(`補畫的記號 ${gotMarks} 個,應該 ${wantMarks} 個`);
      // 閉 HH:OSMD 把 <stopped/> 讀成 lefthandpizzicato(畫 +)
      const stopped = (r.xml.match(/<stopped /g) || []).length;
      let lhp = 0;
      for (const mm of r.osmd.Sheet.SourceMeasures) for (const c of mm.VerticalSourceStaffEntryContainers) for (const se of c.StaffEntries) if (se) for (const ve of se.VoiceEntries) lhp += ve.Articulations.filter(a => a.articulationEnum === 14).length;
      if (stopped !== lhp) o.issues.push(`閉 HH 的 + :OSMD 讀到 ${lhp} 個,MusicXML 有 ${stopped} 個`);
      // 樣張不超出紙張
      const pr = r.el.querySelector(".kit-paper").getBoundingClientRect(), gr = svg.getBoundingClientRect();
      if (gr.right > pr.right + 1 || gr.left < pr.left - 1) o.issues.push(`超出紙張(${Math.round(gr.left)}–${Math.round(gr.right)} / ${Math.round(pr.left)}–${Math.round(pr.right)},縮放 ${r.zoom.toFixed(2)})`);
    }
    // 圖例每一格的位置(中英比對用)
    const legend = [...document.querySelectorAll(".kit-legend")].map(l => ({ id: l.id, h: Math.round(l.getBoundingClientRect().height), cells: [...l.querySelectorAll(".kl-cell")].map(c => { const b = c.getBoundingClientRect(); return [c.dataset.piece, Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(":"); }) }));
    const overflow = document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0;
    const cellOverflow = [...document.querySelectorAll(".kl-cell, .kl-name, .kl-src")].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).slice(0, 5);
    return { out, legend, overflow, cellOverflow };
  }, { GLYPH });
  if (shots) {
    await page.screenshot({ path: OUT + `kit-${width}${lang ? "-" + lang : ""}.png`, fullPage: true });
    if (shots === "each") for (const id of res.out.map(o => o.id)) { const el = await page.$(`[data-sample="${id}"]`); if (el) await el.screenshot({ path: OUT + `sample-${id}.png` }); }
    if (shots === "each") for (const id of ["legend5", "legend1"]) { const el = await page.$("#" + id); if (el) await el.screenshot({ path: OUT + `${id}.png` }); }
  }
  await close();
  return { ...res, errors };
}

{
  const n0 = bad;
  const r = await kitPage(1000, "en", "each");
  for (const o of r.out) { if (o.err) fail(`樣張 ${o.id}:${o.err}`); for (const i of o.issues) fail(`樣張 ${o.id}:${i}`); }
  for (const e of r.errors) fail("樣張 console:" + e);
  if (r.overflow) fail(`1000 寬有橫向捲動 ${r.overflow}`);
  if (bad === n0) ok(`鼓組記譜樣張 ${r.out.length} 張:OSMD 畫出來沒有錯誤,符頭數、形狀、高度(${r.out.reduce((s, o) => s + (o.checked || 0), 0)} 個音)、補畫記號、閉 HH 的 + 都對`);
}
{
  const n0 = bad;
  const zh = await kitPage(280, "zh", true), en = await kitPage(280, "en", true);
  for (const [lang, r] of [["中", zh], ["英", en]]) {
    for (const o of r.out) for (const i of o.issues) fail(`280 寬 ${lang} 樣張 ${o.id}:${i}`);
    for (const e of r.errors) fail(`280 寬 ${lang} console:` + e);
    if (r.overflow) fail(`280 寬 ${lang}:橫向捲動 ${r.overflow}`);
    for (const t of r.cellOverflow) fail(`280 寬 ${lang}:圖例的字超出格子:${t}`);
  }
  if (JSON.stringify(zh.legend) !== JSON.stringify(en.legend)) {
    for (let i = 0; i < Math.max(zh.legend.length, en.legend.length); i++) {
      const a = zh.legend[i] || {}, b = en.legend[i] || {};
      if (a.h !== b.h) fail(`280 寬 圖例 ${a.id}:中文高 ${a.h}、英文高 ${b.h}`);
      (a.cells || []).forEach((c, k) => { if (c !== (b.cells || [])[k]) fail(`280 寬 圖例格子 中 ${c} ≠ 英 ${(b.cells || [])[k]}`); });
    }
  }
  if (bad === n0) ok(`280 寬:樣張都在紙張裡、沒有橫向捲動;圖例中英版面一樣(${zh.legend.map(l => l.cells.length).join(" + ")} 格)`);
}

console.log(bad ? `✗ ${bad} 項問題` : `✓ 全部通過(截圖在 ${OUT})`);
process.exit(bad ? 1 : 0);
