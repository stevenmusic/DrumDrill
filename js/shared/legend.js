/* 鼓組譜的圖例(drum key)與 OSMD 畫不出來的記號(補畫);瀏覽器用(要 DOM 與 OSMD)。
   - drawLegend(el, { pieces, lines, key }):依用到的鼓件畫一排格子,每格 = OSMD 畫一個音 + 底下名稱(中英)+ 出處小字;
     drumkey.json 的 src(或位置的 posSrc)不是官方的,出處寫「待核對」。
     每一份鼓組譜旁邊一定要有圖例(STAGES.md 決定 3),圖例的說明不能說是官方圖例:「App 採用的記譜方式;考試用書可能不同,以書上圖例為準」。
     中英版面一樣:格子固定寬度(drum.css .kit-legend),名稱、出處、說明都用 pairText(保留兩種語言比較高的高度)
   - decorate(osmd, xml, svg):OSMD 畫完之後,照 MusicXML 補畫 OSMD 不會畫的記號(docs/NOTATION.md):
       鬼音 <notehead parentheses="yes"> → 符頭兩邊的括號;開 HH <technical><open/> → 符頭上方的 o
     (閉 HH <stopped/> OSMD 會畫 +;做法跟 js/tech/app.js 的 drawSticking 一樣:量符頭的位置,在 SVG 上加字) */
import { tr, pairText } from "./i18n.js";
import { legendXML, DIV } from "./kitnotation.js";
import { drumKeyCached } from "./examdata.js";

const NS = "http://www.w3.org/2000/svg";

/* ── 補畫 ── */
/* MusicXML 裡要補畫的音:{ mi(第幾小節), voice, t(divisions), k(和弦裡第幾個,由低到高), ghost, open } */
export function marksOf(xml){
  const doc = new DOMParser().parseFromString(xml, "application/xml"), out = [];
  [...doc.querySelectorAll("part > measure")].forEach((m, mi) => {
    let t = 0, start = 0, k = 0;
    for (const el of m.children) {
      if (el.tagName === "backup") { t -= Number(el.querySelector("duration").textContent); continue; }
      if (el.tagName === "forward") { t += Number(el.querySelector("duration").textContent); continue; }
      if (el.tagName !== "note" || el.querySelector("grace")) continue;
      const dur = Number((el.querySelector("duration") || {}).textContent || 0);
      if (el.querySelector("chord")) k++; else { start = t; t += dur; k = 0; }
      if (el.querySelector("rest")) continue;
      const head = el.querySelector("notehead");
      const ghost = !!head && head.getAttribute("parentheses") === "yes", open = !!el.querySelector("technical > open");
      if (ghost || open) out.push({ mi, voice: Number(el.querySelector("voice").textContent), t: start, k, ghost, open });
    }
  });
  return out;
}
/* OSMD 畫出來的每個音(不含裝飾音):{ mi, voice, t, k, gn } */
function graphicalNotes(osmd){
  const out = [];
  osmd.GraphicSheet.MeasureList.forEach((row, mi) => {
    const gm = row && row[0]; if (!gm) return;
    for (const se of gm.staffEntries) for (const gve of se.graphicalVoiceEntries) {
      const ve = gve.parentVoiceEntry; if (!ve || ve.IsGrace) continue;
      const t = Math.round(ve.Timestamp.RealValue * 4 * DIV), voice = Number(ve.ParentVoice.VoiceId);
      // 和弦裡的音由低到高排(跟 kitnotation.js 輸出的順序一樣)
      const notes = gve.notes.filter(n => !n.sourceNote.isRest()).sort((a, b) => a.sourceNote.Pitch.getHalfTone() - b.sourceNote.Pitch.getHalfTone());
      notes.forEach((gn, k) => out.push({ mi, voice, t, k, gn }));
    }
  });
  return out;
}
/* 一個音的符頭(SVG 的 bbox)與它上方最高的東西(符桿頂端、連桿、重音等記號)的 y */
function headBox(gn){
  const g = gn.getSVGGElement && gn.getSVGGElement();
  if (!g) return null;
  const heads = [...g.querySelectorAll(".vf-notehead")].filter(h => !h.closest(".vf-modifiers")).map(h => h.getBBox());
  if (!heads.length) return null;
  // 和弦:VexFlow 的 keyProps 有每個音的線位置;這個音(vfnoteIndex)在和弦裡由低到高第幾個 → 畫面上由下往上第幾個符頭
  const vf = gn.vfnote && gn.vfnote[0], idx = gn.vfnoteIndex || 0;
  heads.sort((a, b) => b.y - a.y);
  let head = heads[0];
  if (vf && vf.keyProps && vf.keyProps.length === heads.length) {
    const rank = vf.keyProps.map((p, i) => [p.line, i]).sort((a, b) => a[0] - b[0]).findIndex(([, i]) => i === idx);
    head = heads[rank] || heads[0];
  }
  let top = Math.min(...heads.map(h => h.y));
  try { const e = vf.getStemExtents(); if (vf.hasStem()) top = Math.min(top, e.topY, e.baseY); } catch (e) {}
  const mods = g.querySelector(".vf-modifiers"), mb = mods && mods.getBBox();
  if (mb && mb.height && mb.y < top) top = mb.y;
  return { head, top };
}
export function decorate(osmd, xml, svg){
  if (!osmd || !svg || !osmd.GraphicSheet) return 0;
  svg.querySelectorAll(".kit-mark").forEach(e => e.remove());
  const marks = marksOf(xml);
  if (!marks.length) return 0;
  const gns = graphicalNotes(osmd), frag = document.createDocumentFragment();
  let n = 0;
  const text = (x, y, t, size, cls, extra = {}) => {
    const el = document.createElementNS(NS, "text");
    el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("text-anchor", "middle");
    el.setAttribute("font-family", "Times New Roman, Times, serif"); el.setAttribute("font-size", size);
    el.setAttribute("class", "kit-mark " + cls);
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    el.textContent = t; frag.appendChild(el); n++;
  };
  for (const m of marks) {
    const g = gns.find(x => x.mi === m.mi && x.voice === m.voice && x.t === m.t && x.k === m.k);
    const b = g && headBox(g.gn);
    if (!b) continue;
    const h = b.head, cy = h.y + h.height / 2, sp = h.height;   // sp ≈ 一格譜線間距
    if (m.ghost) {
      // 括號:比符頭高一點、貼在符頭兩邊
      text(h.x - sp * 0.28, cy + sp * 0.42, "(", sp * 1.5, "kit-ghost");
      text(h.x + h.width + sp * 0.28, cy + sp * 0.42, ")", sp * 1.5, "kit-ghost");
    }
    if (m.open) {
      // o:在這個音最高的東西(符桿頂端 / 連桿、重音)上方,跟 OSMD 畫閉 HH 的 + 同一個高度
      text(h.x + h.width / 2, b.top - sp * 0.45, "o", sp * 1.8, "kit-open");
    }
  }
  svg.appendChild(frag);
  // 字超出 OSMD 預留的範圍時把畫布撐大(照 drawSticking)
  const vb = svg.viewBox.baseVal, bb = svg.getBBox();
  if (vb && vb.height) {
    const k = parseFloat(svg.getAttribute("height")) / vb.height;
    const y0 = Math.min(vb.y, bb.y - 4), y1 = Math.max(vb.y + vb.height, bb.y + bb.height + 4);
    if (y0 < vb.y || y1 > vb.y + vb.height) { svg.setAttribute("viewBox", `${vb.x} ${y0} ${vb.width} ${y1 - y0}`); svg.setAttribute("height", (y1 - y0) * k); }
  }
  return n;
}

/* 鼓組譜的 OSMD 設定(建立 OSMD 之後、load 之前呼叫一次):
   - PercussionOneLineCutoff = 0(五線):OSMD 預設會把「用到的位置少於 3 個」的打擊樂譜縮成一條線,鼓組譜一律照 MusicXML 的 staff-lines
   - 連音每一組都標數字(跟技巧一樣) */
export function setupKit(osmd, lines = 5){
  const R = osmd.EngravingRules;
  // 單線譜維持 OSMD 預設(3):跟技巧的單線譜一樣,E4 畫在線上
  R.PercussionOneLineCutoff = lines === 1 ? 3 : 0;
  R.TupletNumberLimitConsecutiveRepetitions = false;
}

/* ── 圖例 ── */
const OSMD_OPTS = { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
  drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true };
/* 出處小字:官方 = 「Trinity p.107」;不是官方 = 「待核對」;符頭官方、位置待核對 = 兩行 */
function srcLines(key, p){
  const s = key.srcs[p.src] || {}, pos = p.posSrc && key.srcs[p.posSrc];
  const short = s.pending ? null : s.ref && /RSL|Rockschool/.test(s.ref) ? `RSL p.${s.p}` : `Trinity p.${s.p}`;
  if (!short) return [() => tr("待核對", "Pending"), null, true];
  if (pos && pos.pending) return [() => short, () => tr("位置待核對", "Position pending"), true];
  return [() => short, null, false];
}
/* el:放圖例的容器(會清空);pieces:用到的鼓件 id(照 drumkey.json 的順序,kitnotation.js 的 piecesUsed);lines:1 = 單線譜 */
export async function drawLegend(el, { pieces, lines = 5, key = drumKeyCached() } = {}){
  el.innerHTML = "";
  el.classList.add("kit-legend");
  if (!key) return;
  const order = Object.keys(key.pieces), list = (pieces || order).filter(p => key.pieces[p]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const head = document.createElement("div"); head.className = "kl-head";
  el.appendChild(head); pairText(head, () => tr("圖例", "Drum key"));
  const cells = document.createElement("div"); cells.className = "kl-cells"; el.appendChild(cells);
  const jobs = [];
  for (const id of list) {
    const p = key.pieces[id], cell = document.createElement("figure");
    cell.className = "kl-cell"; cell.dataset.piece = id;
    const note = document.createElement("div"); note.className = "kl-note";
    const name = document.createElement("figcaption"); name.className = "kl-name";
    const src = document.createElement("div"); src.className = "kl-src";
    const [s1, s2, pending] = srcLines(key, p);
    if (pending) cell.classList.add("pending");
    cell.append(note, name, src);
    cells.appendChild(cell);
    pairText(name, () => tr(p.name[0], p.name[1]));
    pairText(src, () => (s2 ? s1() + "\n" + s2() : s1()));
    jobs.push([note, legendXML(id, { key, lines })]);
  }
  const foot = document.createElement("p"); foot.className = "kl-foot"; el.appendChild(foot);
  pairText(foot, () => tr("App 採用的記譜方式;考試用書可能不同,以書上圖例為準。", "The App's notation. Exam books may differ: follow the book's key."));
  // 一格一個 OSMD(放在格子裡、寬度固定);畫完補畫 o 等記號
  const svgs = [];
  for (const [box, xml] of jobs) {
    try {
      const o = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS);
      setupKit(o, lines);
      await o.load(xml);
      o.zoom = 0.62; o.render();
      const svg = box.querySelector("svg");
      decorate(o, xml, svg);
      svgs.push(svg);
    } catch (e) { console.error(e); box.textContent = "?"; }
  }
  fitCells(svgs);
}
/* 圖例格子裡的 SVG:每一格同一個比例、譜線在同一個高度(上下的範圍 = 所有格子的音符、記號合起來),左右只留音符附近一小段 */
function cellGeom(svg){
  // 譜線 = 小節裡水平的 path(M x y L x2 y)
  const ys = [...svg.querySelectorAll(".vf-measure > path")].map(p => /^M\s*([\d.-]+)\s+([\d.-]+)\s*L\s*([\d.-]+)\s+([\d.-]+)$/.exec(p.getAttribute("d") || ""))
    .filter(m => m && m[2] === m[4] && Number(m[3]) - Number(m[1]) > 20).map(m => Number(m[2])).sort((a, b) => a - b);
  const head = svg.querySelector(".vf-notehead");
  const sp = ys.length > 1 ? (ys[ys.length - 1] - ys[0]) / (ys.length - 1) : (head ? head.getBBox().height : 10);
  const mid = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : 0;
  svg.querySelectorAll(".vf-clef").forEach(e => e.remove());   // OSMD 不管 <clef print-object="no">,圖例不要譜號
  const bs = [...svg.querySelectorAll(".vf-stavenote, .kit-mark")].map(e => e.getBBox()).filter(b => b.width || b.height);
  if (!bs.length) return null;
  return { sp, mid, cx: (Math.min(...bs.map(b => b.x)) + Math.max(...bs.map(b => b.x + b.width))) / 2,
    up: Math.max(2.5, ...bs.map(b => (mid - b.y) / sp)), down: Math.max(2.5, ...bs.map(b => (b.y + b.height - mid) / sp)) };
}
function fitCells(svgs){
  const gs = svgs.map(cellGeom);
  const ok = gs.filter(Boolean);
  if (!ok.length) return;
  const up = Math.max(...ok.map(g => g.up)) + 0.6, down = Math.max(...ok.map(g => g.down)) + 0.6;
  svgs.forEach((svg, i) => {
    const g = gs[i]; if (!g) return;
    const h = (up + down) * g.sp, w = h * 74 / 88;   // 跟格子(drum.css .kl-note 74×88)同比例
    svg.setAttribute("viewBox", `${g.cx - w / 2} ${g.mid - up * g.sp} ${w} ${h}`);
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  });
}
