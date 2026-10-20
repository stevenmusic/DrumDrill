// 瀏覽器實際畫譜檢查(對應 PianoDrill 的 notation.mjs):用 OSMD(vendor)把譜畫出來,讀 SVG 比對
//  1. PAS 40 個基本打法(js/tech/notation.js,notation-preview.html?n=1..40):沒有錯誤;SVG 的符頭數 = MusicXML 的 <note> 數(含裝飾音、休止符)
//  2. 鼓組記譜樣張(js/shared/kitnotation.js,notation-preview.html?kit=all;樣張在 kitsamples.mjs):
//     沒有錯誤;符頭數 = <note> 數(<note print-object="no"> 要畫成透明,數量一樣);每種符頭形狀(一般 / x / 菱形 / 圈 x / 斜線)的數量 = MusicXML;
//     每個符頭的高度 = drumkey.json 的位置(五線:E4 = 最下面那條線;單線:在線上);
//     補畫的記號(鬼音括號、開 HH 的 o)數量 = MusicXML;閉 HH 的 + 是 OSMD 畫的(lefthandpizzicato);
//     連音組數 = MusicXML 的 <tuplet type="start">(8t3 與 16t3 混在一拍是一組);
//     開 HH 的 o:OSMD 照 <open-string/> 畫的小圓圈有藏起來(每個 o 一個)、o 的中心跟符頭中心水平差 < 0.1 符頭高、
//     不碰到力度、漸強線、重音、+、連桿、符桿、其他符頭與補畫記號(兩種縮放:0.8 與 1.3);
//     decorate 抬高的力度、漸強線、連音數字(kit-lift)不碰到上一行譜、不超出譜面與紙張的上緣
//  3. 折疊機 280 寬:樣張不超出紙張、沒有橫向捲動;圖例中英版面一樣(每一格的位置、大小相同)、出處小字最多兩行、沒有 undefined
//  4. 視奏(S8):RSL Debut–3 的小鼓單線譜在視奏分頁實際畫出來(1000 / 280 寬,每級 4 題)
//  5. Trinity Playback 產生器(notation-preview.html?playback=all):每一級 2 題做跟樣張一樣的檢查;320 寬不超出紙張
//  6. RSL 出題器(?rslkit=4,5&fill=0..8&groove=0..8):整組鼓視奏、聽力 Fill(含干擾選項)、Groove,跟樣張一樣的檢查;320 寬不超出紙張
// 截圖存到 tools/test/out/notation/(基本打法、樣張 1000 寬 + 每一張、280 寬中英、視奏 sight-*.png、playback-0.png … playback-8.png、rslkit-4/5.png、fill-0…8.png、groove-0…8.png)
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
async function kitPage(width, lang, shots, { kit = "all", zoom = null, query = "" } = {}){
  const { page, errors, close } = await open({ viewport: { width, height: 900 }, path: `tools/test/notation-preview.html?kit=${kit}${lang ? "&lang=" + lang : ""}${zoom ? "&zoom=" + zoom : ""}${query}` });
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  const res = await page.evaluate(({ GLYPH }) => {
    const L = window.__L, out = [];
    const ord = (s, o) => o * 7 + "CDEFGAB".indexOf(s);
    for (const r of window.__kit) {
      const o = { id: r.id, err: r.err, issues: [], zoom: r.zoom };
      out.push(o);
      if (r.err || !r.osmd) continue;
      const svg = r.el.querySelector(".kit-paper svg"), doc = new DOMParser().parseFromString(r.xml, "application/xml");
      // 符頭數
      // 不印的音(<note print-object="no">,hideEmpty 的整小節休止):OSMD 畫成透明(fill #00000000),不算符頭,但數量要一樣
      const clear = h => [...h.querySelectorAll("path")].every(p => /^#[0-9a-f]{6}00$|^transparent$|^none$/i.test(p.getAttribute("fill") || ""));
      const heads = [...svg.querySelectorAll(".vf-notehead")], hidden = heads.filter(clear).length;
      const want = (r.xml.match(/<note>/g) || []).length, got = heads.length - hidden, wantHidden = (r.xml.match(/<note print-object="no">/g) || []).length;
      if (want !== got) o.issues.push(`符頭 ${got} 個,MusicXML 有 ${want} 個`);
      if (hidden !== wantHidden) o.issues.push(`不印的音 畫成透明的 ${hidden} 個,MusicXML 有 ${wantHidden} 個`);
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
      // 連音組數:OSMD 讀到的 Tuplet = MusicXML 的 <tuplet type="start">
      const tups = new Set();
      for (const mm of r.osmd.Sheet.SourceMeasures) for (const c of mm.VerticalSourceStaffEntryContainers) for (const se of c.StaffEntries) if (se) for (const ve of se.VoiceEntries) for (const n of ve.Notes) if (n.NoteTuplet) tups.add(n.NoteTuplet);
      const wantTup = (r.xml.match(/<tuplet type="start"/g) || []).length;
      if (tups.size !== wantTup) o.issues.push(`連音組 OSMD 讀到 ${tups.size} 組,MusicXML 有 ${wantTup} 組`);
      // 開 HH 的 o:位置(對到符頭中心)、OSMD 的小圓圈藏起來、不碰到別的東西
      const opens = marks.filter(m => m.open), ahs = svg.querySelectorAll(".kit-ah");
      if (ahs.length !== opens.length) o.issues.push(`OSMD 的開 HH 小圓圈藏起來 ${ahs.length} 個,應該 ${opens.length} 個(找不到的話 o 位置是猜的)`);
      // 位置要算進 transform(decorate 把連音數字、力度往上移是用 transform)
      const box = e => { const b = e.getBBox(), m = e.getCTM(), sm = svg.getCTM(); const k = m && sm ? sm.inverse().multiply(m) : { e: 0, f: 0 }; return { x: b.x + k.e, y: b.y + k.f, w: b.width, h: b.height }; };
      const hit = (a, b, pad) => a.x + pad < b.x + b.w && b.x + pad < a.x + a.w && a.y + pad < b.y + b.h && b.y + pad < a.y + a.h;
      // 連音數字(.vf-measure 底下直接畫的曲線字形)也算
      const others = [...svg.querySelectorAll(".vf-text text, .vf-line path, .vf-modifiers > path:not(.kit-ah), .kit-mark, .vf-beam path, .vf-stem, .vf-notehead path, .vf-stavetie path"),
        ...[...svg.querySelectorAll(".vf-measure > path")].filter(p => /C/.test(p.getAttribute("d") || ""))];
      let oChecked = 0;
      for (const m of opens) {
        const at = `${m.mi}:${m.voice}:${m.t}:${m.k}`, el = svg.querySelector(`.kit-open[data-at="${at}"]`);
        const g = gns.find(x => x.mi === m.mi && x.voice === m.voice && x.t === m.t && x.k === m.k), hb = g && L.headBox(g.gn);
        if (!el || !hb) { o.issues.push(`開 HH 第 ${m.mi + 1} 小節 ${m.t / 2520} 拍:找不到 o 或符頭`); continue; }
        const ob = box(el), hx = hb.head.x + hb.head.width / 2, dx = Math.abs(ob.x + ob.w / 2 - hx);
        if (dx >= 0.1 * hb.head.height) o.issues.push(`開 HH 第 ${m.mi + 1} 小節 ${(m.t / 2520).toFixed(2)} 拍:o 跟符頭中心差 ${(dx / hb.head.height).toFixed(2)} 符頭高`);
        if (ob.y + ob.h > hb.head.y) o.issues.push(`開 HH 第 ${m.mi + 1} 小節 ${(m.t / 2520).toFixed(2)} 拍:o 不在符頭上方`);
        for (const x of others) {
          if (x === el) continue;
          const xb = box(x);
          if ((xb.w || xb.h) && hit(ob, xb, 0.3)) { o.issues.push(`開 HH 第 ${m.mi + 1} 小節 ${(m.t / 2520).toFixed(2)} 拍:o 碰到 ${x.closest("[class]").getAttribute("class")}${x.tagName === "text" ? "「" + x.textContent + "」" : ""}`); break; }
        }
        oChecked++;
      }
      o.oChecked = oChecked;
      // 鬼音的括號:彼此不疊在一起(連續十六分鬼音)。text 的 bbox 是字寬(advance),墨水 ≈ 中間 75%
      const gh = [...svg.querySelectorAll(".kit-ghost")].map(box).map(b => ({ ...b, x: b.x + b.w * 0.125, w: b.w * 0.75 }));
      for (let i = 0; i < gh.length; i++) for (let j = i + 1; j < gh.length; j++) if (hit(gh[i], gh[j], 0.3)) { o.issues.push(`鬼音括號疊在一起(x ${Math.round(gh[i].x)} / ${Math.round(gh[j].x)})`); i = gh.length; break; }
      // 抬高的力度、漸強線、連音數字(legend.js decorate 的 liftAbove,class kit-lift):不碰到上一行譜的任何東西、不超出 SVG 與紙張的上緣
      const lifted = [...svg.querySelectorAll(".kit-lift")], rows = [...svg.querySelectorAll(".staffline")], vb = svg.viewBox && svg.viewBox.baseVal;
      const paperTop = r.el.querySelector(".kit-paper").getBoundingClientRect().top;
      let liftChecked = 0;
      for (const e of lifted) {
        const b = box(e), li = rows.findIndex(l => l.contains(e)), what = e.getAttribute("class") + (e.textContent ? "「" + e.textContent + "」" : "");
        if (vb && vb.height && b.y < vb.y - 0.5) o.issues.push(`抬高的 ${what} 超出譜面上緣(${b.y.toFixed(1)} < ${vb.y.toFixed(1)})`);
        if (e.getBoundingClientRect().top < paperTop - 1) o.issues.push(`抬高的 ${what} 超出紙張`);
        if (li > 0) {
          const prev = [...rows[li - 1].querySelectorAll("path, rect, text")].map(box).filter(x => x.w || x.h);
          const hitPrev = prev.find(x => hit(b, x, 0.3));
          if (hitPrev) o.issues.push(`抬高的 ${what}(第 ${li + 1} 行)碰到上一行譜(y ${hitPrev.y.toFixed(1)}–${(hitPrev.y + hitPrev.h).toFixed(1)})`);
        }
        liftChecked++;
      }
      o.liftChecked = liftChecked;
      // 樣張不超出紙張
      const pr = r.el.querySelector(".kit-paper").getBoundingClientRect(), gr = svg.getBoundingClientRect();
      if (gr.right > pr.right + 1 || gr.left < pr.left - 1) o.issues.push(`超出紙張(${Math.round(gr.left)}–${Math.round(gr.right)} / ${Math.round(pr.left)}–${Math.round(pr.right)},縮放 ${r.zoom.toFixed(2)})`);
    }
    // 圖例每一格的位置(中英比對用)
    const legend = [...document.querySelectorAll(".kit-legend")].map(l => ({ id: l.id, h: Math.round(l.getBoundingClientRect().height), cells: [...l.querySelectorAll(".kl-cell")].map(c => { const b = c.getBoundingClientRect(); return [c.dataset.piece, Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(":"); }) }));
    const overflow = document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0;
    const cellOverflow = [...document.querySelectorAll(".kl-cell, .kl-name, .kl-src")].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).slice(0, 5);
    // 出處小字:最多兩行(格子 74px 寬)、沒有 undefined;Trinity DK 寫明 DK、Ride bell 寫勘誤
    const srcIssues = [];
    for (const e of document.querySelectorAll(".kl-src")) {
      const lh = parseFloat(getComputedStyle(e).lineHeight), n = Math.round(e.getBoundingClientRect().height / lh), id = e.closest(".kl-cell").dataset.piece;
      if (n > 2) srcIssues.push(`${id} 出處 ${n} 行:${e.textContent.replace(/\n/g, " / ")}`);
      if (/undefined|null|NaN|Trinity p\./.test(e.textContent)) srcIssues.push(`${id} 出處:${e.textContent}`);
    }
    const cellSrc = Object.fromEntries([...document.querySelectorAll("#legend5 .kl-cell, #legend1 .kl-cell")].map(c => [c.closest(".kit-legend").id + ":" + c.dataset.piece, (c.querySelector(".kl-src") || c).textContent]));
    return { out, legend, overflow, cellOverflow, srcIssues, cellSrc };
  }, { GLYPH });
  if (shots === "groups") {
    // 出題器每一級一個框:pb-N → playback-N.png、rk-N → rslkit-N.png、fill-N → fill-N.png、gr-N → groove-N.png
    const NAME = { pb: "playback", rk: "rslkit", fill: "fill", gr: "groove" };
    for (const id of await page.$$eval("#out > div[id]", els => els.filter(e => !e.dataset.sample).map(e => e.id))) {
      const [, pre, g] = /^(\w+)-(\d)$/.exec(id) || [];
      if (NAME[pre]) await (await page.$("#" + id)).screenshot({ path: OUT + `${NAME[pre]}-${g}.png` });
    }
  } else if (shots) {
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
  for (const i of r.srcIssues) fail("圖例:" + i);
  // 出處的字(英文):Trinity DK p.107 + 位置待核對、Ride bell = Trinity errata、單線譜小鼓 = RSL p.31–43 + 1-line: App's choice
  // 「待核對」(App 的寫法)不在格子裡寫,圖例下面寫一次「沒標頁碼的是 App 的寫法」;只有小鼓的單線譜圖例是一行字(出處接在括號裡)
  const want = { "legend5:hhFoot": "Trinity DK p.107", "legend5:hhOpen": "Trinity DK p.107", "legend5:rideBell": "Trinity errata", "legend5:kick": "" };
  for (const [k, v] of Object.entries(want)) if (r.cellSrc[k] !== v) fail(`圖例 ${k} 出處「${r.cellSrc[k]}」,應該「${v}」`);
  if (!/RSL p\.31–43.*1-line: App's choice/.test(r.cellSrc["legend1:snare"] || "")) fail(`圖例 legend1:snare 出處「${r.cellSrc["legend1:snare"]}」`);
  if (bad === n0) ok(`鼓組記譜樣張 ${r.out.length} 張:OSMD 畫出來沒有錯誤,符頭數、形狀、高度(${r.out.reduce((s, o) => s + (o.checked || 0), 0)} 個音)、補畫記號、閉 HH 的 +、連音組數、開 HH 的 o(${r.out.reduce((s, o) => s + (o.oChecked || 0), 0)} 個)、抬高的記號(${r.out.reduce((s, o) => s + (o.liftChecked || 0), 0)} 個)都對;圖例出處`);
}
{
  // 另一種縮放(1.3):開 HH 的 o 位置、不碰撞
  const n0 = bad;
  const r = await kitPage(1000, "en", false, { kit: "open-hh,piece-hh,piece-hhOpen,groove-rock,pieces", zoom: 1.3 });
  for (const o of r.out) { if (o.err) fail(`縮放 1.3 樣張 ${o.id}:${o.err}`); for (const i of o.issues) fail(`縮放 1.3 樣張 ${o.id}:${i}`); }
  for (const e of r.errors) fail("縮放 1.3 console:" + e);
  const zs = r.out.map(o => o.zoom).filter(Boolean);
  if (bad === n0) ok(`縮放 1.3(實際 ${Math.min(...zs).toFixed(2)}–${Math.max(...zs).toFixed(2)}):開 HH 的 o(${r.out.reduce((s, o) => s + (o.oChecked || 0), 0)} 個)對到符頭中心、沒有碰到別的記號`);
}
{
  const n0 = bad;
  const zh = await kitPage(280, "zh", true), en = await kitPage(280, "en", true);
  for (const [lang, r] of [["中", zh], ["英", en]]) {
    for (const o of r.out) for (const i of o.issues) fail(`280 寬 ${lang} 樣張 ${o.id}:${i}`);
    for (const e of r.errors) fail(`280 寬 ${lang} console:` + e);
    if (r.overflow) fail(`280 寬 ${lang}:橫向捲動 ${r.overflow}`);
    for (const t of r.cellOverflow) fail(`280 寬 ${lang}:圖例的字超出格子:${t}`);
    for (const t of r.srcIssues) fail(`280 寬 ${lang}:圖例:${t}`);
  }
  if (JSON.stringify(zh.legend) !== JSON.stringify(en.legend)) {
    for (let i = 0; i < Math.max(zh.legend.length, en.legend.length); i++) {
      const a = zh.legend[i] || {}, b = en.legend[i] || {};
      if (a.h !== b.h) fail(`280 寬 圖例 ${a.id}:中文高 ${a.h}、英文高 ${b.h}`);
      (a.cells || []).forEach((c, k) => { if (c !== (b.cells || [])[k]) fail(`280 寬 圖例格子 中 ${c} ≠ 英 ${(b.cells || [])[k]}`); });
    }
  }
  if (bad === n0) ok(`280 寬:樣張都在紙張裡、抬高的記號(${zh.out.reduce((s, o) => s + (o.liftChecked || 0), 0)} 個)不碰上一行、沒有橫向捲動;圖例中英版面一樣(${zh.legend.map(l => l.cells.length).join(" + ")} 格)`);
}

/* 4. 視奏(S8):RSL Debut–3 的小鼓單線譜(js/sight/gen.js → kitnotation lines:1 → 視奏分頁實際畫出來);1000 與 280 寬,每級 4 題
   沒有繪製錯誤;符頭數 = MusicXML 的 <note> 數;每個符頭都在那一行的線上(單線譜);譜在紙張裡;每行幾小節照考卷規則(4、2,放不下才交給 OSMD);
   縮放不小於 0.45(每行 4 小節時不小於 0.55);有圖例(小鼓,單線譜)*/
for (const width of [1000, 280]) {
  const n0 = bad;
  const { page, errors, close } = await open({ viewport: { width, height: 900 }, mobile: width < 600 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "sight", sub: { sight: "rhythm", tech: "roll", exam: "tech" } })); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  let tests = 0;
  for (const g of [0, 1, 2, 3]) {
    await page.evaluate(g => { window.__shell.setExam("rsl", g); window.__sight.goto("rsl", g); }, g);
    for (let k = 0; k < 4; k++) {
      if (k) { const d = await page.evaluate(() => window.__sight.state.drawn); await page.evaluate(() => window.__sight.newTest()); await page.waitForFunction(d => window.__sight.state.drawn > d, d, { timeout: 20000 }).catch(() => {}); }
      await page.waitForFunction(() => window.__sight.state.drawn > 0 && !document.querySelector("#s-score[aria-busy]"), null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const S = window.__sight, svg = document.querySelector("#s-score svg"), issues = [];
        if (!svg) return { issues: ["沒有譜"] };
        const want = (S.xml.match(/<note>/g) || []).length, got = svg.querySelectorAll(".vf-notehead").length;
        if (want !== got) issues.push(`符頭 ${got} 個,MusicXML 有 ${want} 個`);
        if (/失敗/.test(document.getElementById("s-message").textContent)) issues.push("訊息:" + document.getElementById("s-message").textContent);
        // 單線譜:每個音符(不含休止符)的符頭中心在那一行的線上
        for (const line of svg.querySelectorAll(".staffline")) {
          const ys = [...line.querySelectorAll(".vf-measure > path")].map(p => /^M\s*([\d.-]+)\s+([\d.-]+)\s*L\s*([\d.-]+)\s+([\d.-]+)$/.exec(p.getAttribute("d") || "")).filter(m => m && m[2] === m[4]).map(m => Number(m[2]));
          const lineY = [...new Set(ys.map(y => Math.round(y)))];
          if (lineY.length !== 1) { issues.push(`一行裡有 ${lineY.length} 條譜線`); continue; }
          for (const n of line.querySelectorAll(".vf-stavenote")) {
            if (/rest/.test(n.getAttribute("class") || "") || n.querySelector(".vf-rest")) continue;
            const h = [...n.querySelectorAll(".vf-notehead")].find(e => !e.closest(".vf-modifiers")); if (!h) continue;
            const b = h.getBBox(), cy = b.y + b.height / 2;
            if (b.height < 20 && Math.abs(cy - ys[0]) > b.height * 0.3 && !/𝄽|rest/.test(h.textContent)) { issues.push(`符頭不在線上(差 ${(cy - ys[0]).toFixed(1)})`); break; }
          }
        }
        const pr = document.getElementById("s-stage").getBoundingClientRect(), gr = svg.getBoundingClientRect();
        if (gr.right > pr.right + 1 || gr.left < pr.left - 1) issues.push(`譜超出紙張(${Math.round(gr.left)}–${Math.round(gr.right)} / ${Math.round(pr.left)}–${Math.round(pr.right)})`);
        const L = S.layout || {};
        if (![4, 2, 0].includes(L.measuresPerLine)) issues.push(`每行 ${L.measuresPerLine} 小節`);
        if (!(L.zoom >= 0.45 - 1e-9) || (L.measuresPerLine === 4 && L.zoom < 0.55 - 1e-9)) issues.push(`縮放 ${L.zoom}`);
        const leg = document.querySelector("#s-legend .kl-cell[data-piece='snare']");
        if (!leg) issues.push("沒有圖例");
        return { issues, layout: L, grade: S.state.grade };
      });
      tests++;
      for (const i of r.issues) fail(`視奏 ${width} 寬 ${g} 級 第 ${k + 1} 題:${i}`);
    }
    if (width === 1000 || g === 3) await page.locator("#s-scoreCard").screenshot({ path: OUT + `sight-${width}-g${g}.png` });
  }
  for (const e of errors) fail(`視奏 ${width} 寬 console:` + e);
  if (bad === n0) ok(`視奏 ${width} 寬:${tests} 題小鼓單線譜都畫得出來、符頭數 = MusicXML、都在線上、在紙張裡、每行小節數與縮放照考卷規則、有圖例`);
  await close();
}

{
  // 5. Trinity Playback 產生器(js/shared/playbackgen.js):每一級 2 題,跟樣張一樣的檢查(符頭數、形狀、高度、補畫記號、閉 HH、連音組數、開 HH 的 o、鬼音括號、不超出紙張)
  //    截圖 playback-0.png … playback-8.png(1000 寬);再用 320 寬檢查不超出紙張、沒有橫向捲動
  const n0 = bad;
  const r = await kitPage(1000, "en", "groups", { kit: "", query: "&playback=all&per=2&seed=1" });
  for (const o of r.out) { if (o.err) fail(`Playback ${o.id}:${o.err}`); for (const i of o.issues) fail(`Playback ${o.id}:${i}`); }
  for (const e of r.errors) fail("Playback console:" + e);
  if (r.overflow) fail(`Playback 1000 寬有橫向捲動 ${r.overflow}`);
  const n = await kitPage(320, "zh", false, { kit: "", query: "&playback=all&per=1&seed=7" });
  for (const o of n.out) { if (o.err) fail(`Playback 320 寬 ${o.id}:${o.err}`); for (const i of o.issues) fail(`Playback 320 寬 ${o.id}:${i}`); }
  for (const e of n.errors) fail("Playback 320 寬 console:" + e);
  if (n.overflow) fail(`Playback 320 寬有橫向捲動 ${n.overflow}`);
  if (bad === n0) ok(`Playback 產生器 ${r.out.length} + ${n.out.length} 題:OSMD 畫出來沒有錯誤,符頭數、形狀、高度(${r.out.reduce((s, o) => s + (o.checked || 0), 0)} 個音)、補畫記號、連音組數、開 HH 的 o 都對;320 寬不超出紙張`);
}

{
  // 6. RSL 出題器:整組鼓視奏(js/shared/kitgen.js;4、5 級各 2 題,最後 2 小節斜線)、聽力 Fill(js/ear/gen.js;每一級 1 題 + 干擾選項,單線譜)、
  //    Groove(每一級 1 題):跟樣張一樣的檢查(符頭數、形狀含斜線、高度、補畫記號、閉 HH 的 +、連音組數、開 HH 的 o、不超出紙張)
  //    截圖 rslkit-4/5.png、fill-0…8.png、groove-0…8.png(1000 寬);再用 320 寬(換種子)檢查不超出紙張、沒有橫向捲動
  const n0 = bad;
  const q = "&rslkit=4,5&fill=0..8&groove=0..8&seed=1";
  const r = await kitPage(1000, "en", "groups", { kit: "", query: q });
  for (const o of r.out) { if (o.err) fail(`RSL ${o.id}:${o.err}`); for (const i of o.issues) fail(`RSL ${o.id}:${i}`); }
  for (const e of r.errors) fail("RSL console:" + e);
  if (r.overflow) fail(`RSL 1000 寬有橫向捲動 ${r.overflow}`);
  const want = 2 * 2 + [2, 2, 2, 2, 3, 3, 3, 3, 3].reduce((a, b) => a + b, 0) + 9;
  if (r.out.length !== want) fail(`RSL 題目畫了 ${r.out.length} 張(應該 ${want})`);
  const n = await kitPage(320, "zh", false, { kit: "", query: "&rslkit=4,5&fill=0..8&groove=0..8&per=1&seed=9" });
  for (const o of n.out) { if (o.err) fail(`RSL 320 寬 ${o.id}:${o.err}`); for (const i of o.issues) fail(`RSL 320 寬 ${o.id}:${i}`); }
  for (const e of n.errors) fail("RSL 320 寬 console:" + e);
  if (n.overflow) fail(`RSL 320 寬有橫向捲動 ${n.overflow}`);
  if (bad === n0) ok(`RSL 出題器 ${r.out.length} + ${n.out.length} 張(整組鼓視奏、Fill 含干擾選項、Groove):OSMD 畫出來沒有錯誤,符頭數、形狀(含斜線)、高度(${r.out.reduce((s, o) => s + (o.checked || 0), 0)} 個音)、補畫記號、連音組數、開 HH 的 o 都對;320 寬不超出紙張`);
}

/* 7. 視奏分頁實際畫出來的整組鼓譜(S9:RSL 4、5;S10/S11:Trinity Playback Initial–8),1000 與 320 寬,每級 2 題:
   沒有繪製錯誤;小節數 = 題目;譜在紙張裡;每行幾小節照考卷規則(5 / 4 / 3 / 2,放不下才交給 OSMD)、縮放不小於 0.45(每行 3 小節以上不小於 0.55);
   圖例格子 = 這一題用到的鼓件(五線);自由發揮的斜線符頭(RSL)= 2 小節 × 4 拍 */
for (const width of [1000, 320]) {
  const n0 = bad;
  const { page, errors, close } = await open({ viewport: { width, height: 900 }, mobile: width < 600 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "sight", sub: { sight: "groove", tech: "roll", exam: "tech" } })); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  let tests = 0;
  for (const [sys, g] of [["rsl", 4], ["rsl", 5], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(g => ["trinity", g])]) {
    await page.evaluate(([s, g]) => { window.__shell.setExam(s, g); window.__sight.goto(s, g); }, [sys, g]);
    for (let k = 0; k < 2; k++) {
      if (k) { const d = await page.evaluate(() => window.__sight.state.drawn); await page.evaluate(() => window.__sight.newTest()); await page.waitForFunction(d => window.__sight.state.drawn > d, d, { timeout: 30000 }).catch(() => {}); }
      await page.waitForFunction(() => window.__sight.state.drawn > 0 && !document.querySelector("#s-score[aria-busy]"), null, { timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll("#s-legend .kl-cell svg").length >= document.querySelectorAll("#s-legend .kl-cell").length && document.querySelectorAll("#s-legend .kl-cell").length > 0, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(200);
      const r = await page.evaluate(async () => {
        const S = window.__sight, svg = document.querySelector("#s-score svg"), issues = [];
        if (!svg) return { issues: ["沒有譜"] };
        if (/失敗/.test(document.getElementById("s-message").textContent)) issues.push("訊息:" + document.getElementById("s-message").textContent);
        const ids = new Set([...svg.querySelectorAll("g.vf-measure")].map(e => Number(e.id)).filter(n => n >= 1));
        if (ids.size !== S.test.bars) issues.push(`畫出 ${ids.size} 小節,題目 ${S.test.bars} 小節`);
        const pr = document.getElementById("s-stage").getBoundingClientRect(), gr = svg.getBoundingClientRect();
        if (gr.right > pr.right + 1 || gr.left < pr.left - 1) issues.push(`譜超出紙張(${Math.round(gr.left)}–${Math.round(gr.right)} / ${Math.round(pr.left)}–${Math.round(pr.right)})`);
        const L = S.layout || {};
        if (![5, 4, 3, 2, 0].includes(L.measuresPerLine)) issues.push(`每行 ${L.measuresPerLine} 小節`);
        if (!(L.zoom >= 0.45 - 1e-9) || (L.measuresPerLine >= 3 && L.zoom < 0.55 - 1e-9)) issues.push(`縮放 ${L.zoom}`);
        const { piecesUsed } = await import("./js/shared/kitnotation.js");
        const want = piecesUsed({ ...S.test.score }), got = [...document.querySelectorAll("#s-legend .kl-cell")].map(c => c.dataset.piece);
        if (want.join() !== got.join()) issues.push(`圖例 ${got.join(",")},用到的鼓件 ${want.join(",")}`);
        if (S.test.develop) {
          const slash = (S.xml.match(/<notehead>slash<\/notehead>/g) || []).length;
          if (slash !== S.test.develop.bars * 4) issues.push(`自由發揮斜線 ${slash} 個`);
        }
        return { issues, layout: L };
      });
      tests++;
      for (const i of r.issues) fail(`視奏 ${width} 寬 ${sys} ${g} 級 第 ${k + 1} 題:${i}`);
    }
    if (width === 1000 || g === 8 || g === 4) await page.locator("#s-scoreCard").screenshot({ path: OUT + `sight-${sys}${g}-${width}.png` });
  }
  for (const e of errors) fail(`視奏整組鼓 ${width} 寬 console:` + e);
  if (bad === n0) ok(`視奏 ${width} 寬:RSL 4、5 與 Trinity Initial–8 共 ${tests} 題整組鼓譜都畫得出來、小節數對、在紙張裡、每行小節數與縮放照考卷規則、圖例 = 用到的鼓件、自由發揮 8 個斜線`);
  await close();
}

console.log(bad ? `✗ ${bad} 項問題` : `✓ 全部通過(截圖在 ${OUT})`);
process.exit(bad ? 1 : 0);
