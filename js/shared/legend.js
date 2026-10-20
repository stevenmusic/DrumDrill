/* 鼓組譜的圖例(drum key)與 OSMD 畫不出來的記號(補畫);瀏覽器用(要 DOM 與 OSMD)。
   - drawLegend(el, { pieces, lines, key }):el 加 role="img" + aria-label(鼓件清單,a11y.js);依用到的鼓件畫一排格子,每格 = OSMD 畫一個音 + 底下名稱(中英)+ 出處小字(最多兩行);
     出處用 drumkey.json srcs[…].short(「Trinity DK p.107」「Trinity 勘誤」「RSL p.31–43」;不是官方的寫「待核對」,
     官方只確認符頭、位置待核對的第二行寫「位置待核對」;單線譜的小鼓第二行寫「單線譜為 App 的選擇」,那一格佔兩格寬)→ kitnotation.js 的 legendSrc
     每一份鼓組譜旁邊一定要有圖例(STAGES.md 決定 3),圖例的說明不能說是官方圖例:「App 採用的記譜方式;考試用書可能不同,以書上圖例為準」。
     中英版面一樣:格子固定寬度(drum.css .kit-legend),名稱、出處、說明都用 pairText(保留兩種語言比較高的高度)
   - decorate(osmd, xml, svg):OSMD 畫完之後,照 MusicXML 補畫 OSMD 不會畫的記號(docs/NOTATION.md):
       鬼音 <notehead parentheses="yes"> → 符頭兩邊的括號;
       開 HH <technical><open/>:交給 OSMD 的是 osmdXML(xml)(換成 <open-string/>,OSMD 畫小圓圈並預留位置、跟重音疊好),
       decorate 把那個小圓圈藏起來(class kit-ah),在同一個中心補畫清楚的大 o(class kit-open)
     (閉 HH <stopped/> OSMD 會畫 +;做法跟 js/tech/app.js 的 drawSticking 一樣:量符頭的位置,在 SVG 上加東西)
   - 載入鼓組譜:setupKit(osmd, lines, xml) → osmd.load(osmdXML(xml)) → render → decorate(osmd, xml, svg) */
import { tr, pairText } from "./i18n.js";
import { legendXML, legendSrc, osmdXML, DIV } from "./kitnotation.js";
import { drumKeyCached } from "./examdata.js";
import { imgLabel, pieceNames } from "./a11y.js";

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
      const ghost = !!head && head.getAttribute("parentheses") === "yes", open = !!el.querySelector("technical > open, technical > open-string");
      if (ghost || open) out.push({ mi, voice: Number(el.querySelector("voice").textContent), t: start, k, ghost, open });
    }
  });
  return out;
}
/* OSMD 畫出來的每個音(不含裝飾音):{ mi, voice, t, k, gn };tools/test/notation.mjs 也用來檢查符頭位置 */
export function graphicalNotes(osmd){
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
/* decorate 之後 svg.dataset.kitTight > 0 = 有鬼音的括號放不下(OSMD 把一小節擠進太窄的寬度):呼叫的人把 zoom 調小再 render + decorate 一次 */
/* 一個音的符頭(SVG 的 bbox)與它上方最高的東西(符桿頂端、連桿、重音等記號)的 y */
export function headBox(gn){
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
/* OSMD 照 <open-string/> 畫的小圓圈(VexFlow 的 "ah" 字形):這個音的 .vf-modifiers 裡、全是曲線(沒有直線)、內外兩圈(M ≥ 3)、
   接近正圓、水平中心對到符頭的那個 path;找過的會加 class kit-ah(重複 decorate 時直接用) */
function openCircle(gn, head, sp){
  const g = gn.getSVGGElement && gn.getSVGGElement(), mg = g && g.querySelector(".vf-modifiers");
  if (!mg) return null;
  const done = mg.querySelector(".kit-ah");
  if (done) return done;
  const hx = head.x + head.width / 2;
  let best = null, by = Infinity;
  for (const el of mg.children) {
    if (el.tagName !== "path") continue;
    const d = el.getAttribute("d") || "";
    if (/[LlHhVvAa]/.test(d) || (d.match(/M/g) || []).length < 3) continue;
    const bb = el.getBBox();
    if (!bb.width || !bb.height || bb.width / bb.height < 0.5 || bb.width / bb.height > 1.15 || bb.height > sp * 1.2) continue;
    if (Math.abs(bb.x + bb.width / 2 - hx) > sp * 0.5) continue;
    if (bb.y < by) { best = el; by = bb.y; }
  }
  return best;
}
export function decorate(osmd, xml, svg){
  if (!osmd || !svg || !osmd.GraphicSheet) return 0;
  svg.querySelectorAll(".kit-mark").forEach(e => e.remove());
  const marks = marksOf(xml);
  const gns = marks.length ? graphicalNotes(osmd) : [], frag = document.createDocumentFragment();
  let n = 0;
  const text = (x, y, t, size, cls, extra = {}) => {
    const el = document.createElementNS(NS, "text");
    el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("text-anchor", "middle");
    el.setAttribute("font-family", "Times New Roman, Times, serif"); el.setAttribute("font-size", size);
    el.setAttribute("class", "kit-mark " + cls);
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    el.textContent = t; frag.appendChild(el); n++;
  };
  const found = marks.map(m => { const g = gns.find(x => x.mi === m.mi && x.voice === m.voice && x.t === m.t && x.k === m.k); return [g, g && headBox(g.gn)]; });
  // 鬼音括號的空間:同一排(上下有重疊)左右最近的符頭;鄰居也是鬼音的話一人一半。放不下就把括號縮小(最小 0.5 倍)
  const ghostHeads = found.filter(([, b], i) => b && marks[i].ghost).map(([, b]) => b.head);
  const heads = ghostHeads.length ? [...svg.querySelectorAll(".vf-notehead")].filter(e => !e.closest(".vf-modifiers")).map(e => e.getBBox()) : [];
  const room = (h, side) => {
    const near = heads.filter(o => o.y < h.y + h.height && o.y + o.height > h.y && (side < 0 ? o.x + o.width <= h.x + 0.5 : o.x >= h.x + h.width - 0.5) && Math.abs(o.x - h.x) > 1);
    if (!near.length) return Infinity;
    const o = side < 0 ? near.reduce((a, c) => (c.x > a.x ? c : a)) : near.reduce((a, c) => (c.x < a.x ? c : a));
    const gap = side < 0 ? h.x - (o.x + o.width) : o.x - (h.x + h.width);
    return ghostHeads.some(gh => Math.abs(gh.x - o.x) < 0.5 && Math.abs(gh.y - o.y) < 0.5) ? gap / 2 : gap;
  };
  let tight = 0;   // 縮到 0.5 倍還放不下的鬼音(譜被擠得太密;呼叫的人應該把 zoom 調小再畫一次)
  marks.forEach((m, mi) => {
    const [g, b] = found[mi];
    if (!b) return;
    const h = b.head, cy = h.y + h.height / 2, sp = h.height;   // sp ≈ 一格譜線間距
    if (m.ghost) {
      // 括號:比符頭高一點、貼在符頭兩邊(字形墨水 ≈ 字級 0.25 寬;離符頭 0.05–0.43 格,算 0.5 格留一點空)
      const rl = room(h, -1), rr = room(h, 1), fit = r => Math.max(0.5, Math.min(1, r / (sp * 0.5)));
      const fl = fit(rl), fr = fit(rr);
      if (Math.min(rl, rr) < sp * 0.5 * 0.5) tight++;
      text(h.x - sp * 0.24 * fl, cy + sp * 0.42 * fl, "(", sp * 1.5 * fl, "kit-ghost");
      text(h.x + h.width + sp * 0.24 * fr, cy + sp * 0.42 * fr, ")", sp * 1.5 * fr, "kit-ghost");
    }
    if (m.open) {
      // o:OSMD 照 <open-string/> 畫的小圓圈(已經跟重音、力度排好位置)藏起來,在同一個中心畫大一點的 o;找不到圓圈才放在這個音最高的東西上方
      const ah = openCircle(g.gn, h, sp);
      let cx = h.x + h.width / 2, cy = b.top - sp * 0.6;
      if (ah) { const c = ah.getBBox(); cx = c.x + c.width / 2; cy = c.y + c.height / 2; ah.style.visibility = "hidden"; ah.classList.add("kit-ah"); }
      const el = document.createElementNS(NS, "ellipse");
      el.setAttribute("cx", cx); el.setAttribute("cy", cy); el.setAttribute("rx", sp * 0.33); el.setAttribute("ry", sp * 0.39);
      el.setAttribute("class", "kit-mark kit-open"); el.setAttribute("style", `fill:none;stroke:#16130D;stroke-width:${sp * 0.13}`);
      el.dataset.at = `${m.mi}:${m.voice}:${m.t}:${m.k}`;   // notation.mjs 對回這個音檢查位置
      frag.appendChild(el); n++;
    }
  });
  svg.appendChild(frag);
  svg.dataset.kitTight = tight;
  liftAbove(osmd, svg);
  // 字超出 OSMD 預留的範圍時把畫布撐大(照 drawSticking)
  const vb = svg.viewBox.baseVal, bb = svg.getBBox();
  if (vb && vb.height) {
    const k = parseFloat(svg.getAttribute("height")) / vb.height;
    const y0 = Math.min(vb.y, bb.y - 4), y1 = Math.max(vb.y + vb.height, bb.y + bb.height + 4);
    if (y0 < vb.y || y1 > vb.y + vb.height) { svg.setAttribute("viewBox", `${vb.x} ${y0} ${vb.width} ${y1 - y0}`); svg.setAttribute("height", (y1 - y0) * k); }
  }
  return n;
}

/* 譜上方的東西讓開 o 與重音等記號(OSMD 2.1.0 / VexFlow 實測:連音數字只看符桿頂端、不看記號;力度、漸強線的高度也沒算到小圓圈):
   1. 連音數字(與括號)在上方、跟這一組音的記號(o、重音、+)疊到的,往上移到記號上方
   2. 每一行譜上方的力度、漸強線(.vf-text、.vf-line)跟記號或連音數字疊到的,整排一起往上移(保持對齊)
   用 transform 移;移過的加 class kit-lift(重複 decorate 前先還原) */
function liftAbove(osmd, svg){
  for (const e of svg.querySelectorAll(".kit-lift")) { e.removeAttribute("transform"); e.classList.remove("kit-lift"); }
  const bbox = e => { const b = e.getBBox(); return { x: b.x, y: b.y, r: b.x + b.width, b: b.y + b.height }; };
  const head = svg.querySelector(".vf-notehead"), sp = head ? head.getBBox().height : 10, gap = sp * 0.25;
  const obst = [...svg.querySelectorAll(".kit-open, .vf-modifiers > path:not(.kit-ah)")].map(bbox).filter(b => b.r > b.x);
  const lift = (els, dy) => { if (dy <= 0) return; for (const e of els) { e.setAttribute("transform", `translate(0,${-dy})`); e.classList.add("kit-lift"); } };
  const need = (box, obs) => Math.max(0, ...obs.filter(o => o.r > box.x - gap && o.x < box.r + gap && o.b > box.y - gap && (o.y + o.b) / 2 > (box.y + box.b) / 2).map(o => box.b + gap - o.y));
  // 1. 連音
  const parts = [...svg.querySelectorAll(".vf-measure > path, .vf-measure > rect")].map(e => [e, bbox(e)]).filter(([e, b]) => e.tagName === "rect" ? b.r - b.x < 200 && b.b - b.y < 20 : /[CQ]/.test(e.getAttribute("d") || ""));
  const tupObs = [];
  for (const row of (osmd.GraphicSheet && osmd.GraphicSheet.MeasureList) || []) for (const gm of row || []) {
    if (!gm || !gm.vftuplets) continue;
    for (const t of Object.values(gm.vftuplets).flat()) {
      if (!t || t.location !== 1 || t.x_pos == null || t.y_pos == null) continue;
      const pt = t.point || 28, x0 = t.x_pos - 3, x1 = t.x_pos + t.width + 3;
      const mine = parts.filter(([, b]) => b.x >= x0 && b.r <= x1 && b.y >= t.y_pos - pt && b.b <= t.y_pos + pt * 0.6);
      if (!mine.length) continue;
      const box = { x: Math.min(...mine.map(([, b]) => b.x)), r: Math.max(...mine.map(([, b]) => b.r)), y: Math.min(...mine.map(([, b]) => b.y)), b: Math.max(...mine.map(([, b]) => b.b)) };
      const dy = need({ ...box, x: t.x_pos, r: t.x_pos + t.width }, obst);
      lift(mine.map(([e]) => e), dy);
      mine.forEach(([e]) => e.classList.add("kit-tuplet"));
      tupObs.push({ ...box, y: box.y - dy, b: box.b - dy });
    }
  }
  // 2. 力度、漸強線(只動譜上方的)
  const all = [...obst, ...tupObs];
  for (const line of svg.querySelectorAll(".staffline")) {
    const ys = [...line.querySelectorAll(".vf-measure > path")].map(p => /^M\s*([\d.-]+)\s+([\d.-]+)\s*L\s*([\d.-]+)\s+([\d.-]+)$/.exec(p.getAttribute("d") || "")).filter(m => m && m[2] === m[4]).map(m => Number(m[2]));
    if (!ys.length) continue;
    const top = Math.min(...ys);
    const movs = [...line.querySelectorAll(":scope > .vf-text, :scope > .vf-line")].map(e => [e, bbox(e)]).filter(([, b]) => b.b <= top + 1);
    if (!movs.length) continue;
    lift(movs.map(([e]) => e), Math.max(0, ...movs.map(([, b]) => need(b, all))));
  }
}

/* 鼓組譜的 OSMD 設定(建立 OSMD 之後、load 之前呼叫一次;xml 給了的話依內容調整):
   - PercussionOneLineCutoff = 0(五線):OSMD 的規則是「用到的位置少於 3 個」的打擊樂譜縮成一條線(2.1.0 實測有 display-step 時沒有縮,設 0 是保險),
     單線譜維持預設 3(設 0 的話 E4 會畫在線下兩格;notation.mjs 檢查符頭高度)
   - 連音每一組都標數字(跟技巧一樣)
   - 平的連桿(FlatBeams;鼓譜慣用,不跟著音高斜)
   - 有鬼音(括號是 decorate 補畫的,OSMD 不知道)時音符間距放寬一點,連續十六分鬼音的括號才不會擠在一起
   - 五線譜行與行之間至少留 KIT_SYSTEM_GAP 格(compacttight 預設 1 格):decorate 的 liftAbove 會把力度、漸強線、連音數字往上移開
     o 與重音(最多約 1.5 格),OSMD 排行距時沒算到,不留空間的話會碰到上一行譜的最下面那條線(notation.mjs 檢查) */
export const KIT_SYSTEM_GAP = 3;
let SPACING = null;
export function setupKit(osmd, lines = 5, xml = ""){
  const R = osmd.EngravingRules;
  // 單線譜維持 OSMD 預設(3):跟技巧的單線譜一樣,E4 畫在線上
  R.PercussionOneLineCutoff = lines === 1 ? 3 : 0;
  R.TupletNumberLimitConsecutiveRepetitions = false;
  R.FlatBeams = true;
  if (!SPACING) SPACING = new WeakMap();
  if (!SPACING.has(R)) SPACING.set(R, [R.VoiceSpacingMultiplierVexflow, R.VoiceSpacingAddendVexflow, R.MinSkyBottomDistBetweenSystems]);
  const [mul, add, sky] = SPACING.get(R), ghost = /parentheses="yes"/.test(xml || "");
  R.MinSkyBottomDistBetweenSystems = lines === 1 ? sky : Math.max(sky, KIT_SYSTEM_GAP);
  R.VoiceSpacingMultiplierVexflow = ghost ? mul * 1.5 : mul;
  R.VoiceSpacingAddendVexflow = ghost ? add + 2 : add;
}

/* ── 圖例 ── */
const OSMD_OPTS = { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
  drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true };
/* el:放圖例的容器(會清空);pieces:用到的鼓件 id(照 drumkey.json 的順序,kitnotation.js 的 piecesUsed);lines:1 = 單線譜;
   plain:不寫出處小字(考試的頁碼)與考試用書的說明(視奏分頁的讀譜練習:畫面上不寫考試名稱、頁碼) */
/* 畫面上「待核對」改寫「App 記法」(資料的 pending 不變:官方還沒核對到,這是 App 的寫法) */
const APP_NOTE = { "待核對": ["App 記法", "App notation"], "位置待核對": ["位置:App 記法", "Pos.: App"] };
const appNote = (zh, en) => APP_NOTE[zh] || [zh, en];
export async function drawLegend(el, { pieces, lines = 5, key = drumKeyCached(), plain = false } = {}){
  el.innerHTML = "";
  el.classList.add("kit-legend");
  if (!key) { imgLabel(el, null); return; }
  const order = Object.keys(key.pieces), list = (pieces || order).filter(p => key.pieces[p]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // 無障礙:圖例整塊當一張圖,說明 = 鼓件清單(格子裡畫的音符螢幕閱讀器讀不到)
  imgLabel(el, () => tr(`圖例:${pieceNames(list, key)}(${lines === 1 ? "單線譜" : "五線譜"})`, `Drum key: ${pieceNames(list, key)} (${lines === 1 ? "single-line staff" : "five-line staff"})`));
  // 只有小鼓一個鼓件(單線譜):一行字就是圖例(「圖例:單線 = 小鼓」;檢定頁加出處),不畫格子
  if (list.length === 1 && list[0] === "snare" && lines === 1) {
    const ls = legendSrc(key, "snare", lines), p = key.pieces.snare;
    const line = document.createElement("p"); line.className = "kl-cell kl-line"; line.dataset.piece = "snare";
    el.appendChild(line);
    pairText(line, () => tr(`圖例:單線 = ${p.name[0]}`, `Drum key: single line = ${p.name[1].toLowerCase()}`) + (plain ? "" : tr("(", " (") + ls.lines.map(([zh, en]) => tr(...appNote(zh, en))).join(tr(";", "; ")) + tr(")", ")")));
    return;
  }
  const head = document.createElement("div"); head.className = "kl-head";
  el.appendChild(head); pairText(head, () => tr("圖例", "Drum key"));
  const cells = document.createElement("div"); cells.className = "kl-cells"; el.appendChild(cells);
  const jobs = [];
  let anyApp = false;
  for (const id of list) {
    const p = key.pieces[id], cell = document.createElement("figure");
    cell.className = "kl-cell"; cell.dataset.piece = id;
    const note = document.createElement("div"); note.className = "kl-note";
    const name = document.createElement("figcaption"); name.className = "kl-name";
    const src = document.createElement("div"); src.className = "kl-src";
    // 出處小字(kitnotation.js 的 legendSrc;單線譜的小鼓 = singleLine.src + 「單線譜為 App 的選擇」,佔兩格寬)
    const ls = legendSrc(key, id, lines);
    if (ls.pending) cell.classList.add("pending");
    if (ls.wide && !plain) cell.classList.add("wide");
    cell.append(note, name);
    if (!plain) cell.append(src);
    cells.appendChild(cell);
    pairText(name, () => tr(p.name[0], p.name[1]));
    // 「待核對」(= App 的寫法)不在每一格寫,圖例下面寫一次;格子裡只留官方出處
    const official = ls.lines.filter(([zh]) => !APP_NOTE[zh]);
    if (official.length < ls.lines.length) anyApp = true;
    pairText(src, () => official.map(([zh, en]) => tr(zh, en)).join("\n"));
    jobs.push([note, legendXML(id, { key, lines })]);
  }
  // 自由練習(plain)沒有考卷可以對照:圖例下面不寫那一行
  if (!plain) {
    const foot = document.createElement("p"); foot.className = "kl-foot"; el.appendChild(foot);
    pairText(foot, () => (anyApp ? tr("沒標頁碼的是 App 的寫法;記法以考試用書上的圖例為準", "No page = the App's notation; follow the exam book's key")
      : tr("記法以考試用書上的圖例為準", "Follow the exam book's key")));
  }
  // 一格一個 OSMD(放在格子裡、寬度固定);畫完補畫 o 等記號
  const svgs = [];
  for (const [box, xml] of jobs) {
    try {
      const o = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS);
      setupKit(o, lines, xml);
      await o.load(osmdXML(xml));
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
    up: Math.max(6, ...bs.map(b => (mid - b.y) / sp)), down: Math.max(5, ...bs.map(b => (b.y + b.height - mid) / sp)) };   // 至少上 6、下 5 格:單線譜的一格跟五線的格子一樣大
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
