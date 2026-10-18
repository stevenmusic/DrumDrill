/* 聽力模組:練習還在做(S12 以後);檢定頁先放「考試摘要」與規格卡(照官方大綱,資料在 data/exam-*.json,每項帶頁碼)。
   - RSL:Fill Playback & Recognition、Groove Recall(風格選項大綱沒寫 → App 不出那一題)
   - Trinity Rock & Pop:沒有聽力項目;Playback 就是聽一句馬上打回來(官方配伴奏音軌,App 只有鼓和拍點);Improvising 只列規格
   元素 id 都加 "e-" 前綴;不自己發明題目 */
import { tr, T, pairText } from "../shared/i18n.js";
import * as V from "../shared/examview.js";
const $ = id => document.getElementById("e-" + id);
const ROOT = document.getElementById("mod-ear");
let ctx = null, exam = null, tab = "", active = false;
const curExam = () => exam || { system: "trinity", grade: 1 };
const dataOf = sys => (ctx && ctx.examData ? ctx.examData(sys) : null);
const keyOf = () => (ctx && ctx.drumKey ? ctx.drumKey() : null);

function render(){
  const isExam = tab === "exam";
  $("soonCard").hidden = isExam;
  ROOT.querySelectorAll(".pane").forEach(el => { el.hidden = !isExam; });
  $("specCards").hidden = !isExam;
  if (!isExam) { pairText($("soonText"), () => tr("題目正在照官方大綱整理。", "Questions are being built from the official syllabus.")); return; }
  renderExam();
}
function renderExam(){
  const ex = curExam(), sys = ex.system, g = ex.grade, d = dataOf(sys);
  $("sumSub").textContent = `${sys === "rsl" ? "RSL" : "Trinity"} · ${ctx.gradeLabel(g, sys)}`;
  pairText($("sumNote"), () => T("practiceOnly"));
  $("specCards").innerHTML = "";
  if (!d) {
    V.fillSpec($("sumSpec"), []); $("examSummary").textContent = T("sumTitle");
    V.addPara(card(() => tr("考試規格", "Exam spec")), () => tr("考試資料還沒載好(第一次要連網路,之後會存在裝置上)。", "Exam data isn't loaded yet (needs internet once; then it's cached)."));
    return;
  }
  const rows = [];
  if (sys === "rsl") {
    const it = d.marks.gradeExam.items.find(i => i.id === "ear");
    rows.push({ k: () => tr("本項配分", "This section"), v: () => tr(`聽力 ${it.max} 分:`, `Ear tests, ${it.max} marks: `) + V.bandsText(it.bands), src: V.srcOf(sys, d.marks.gradeExam.src.p) });
    rows.push({ k: () => tr("評分", "Marked on"), v: () => V.L(d.marks.criteria.ear[0]), src: V.srcOf(sys, d.marks.criteria.src.p) });
    $("examSummary").textContent = tr(`考試摘要 · 聽力 ${it.max} 分`, `Exam summary · Ear tests ${it.max} marks`);
  } else {
    const b = d.sessionBands;
    rows.push({ k: () => tr("本項配分", "This section"), v: () => tr(`沒有聽力項目;Session skills(Playback 或 Improvising 擇一)${b.max} 分:`, `No aural test; Session skills (Playback or Improvising), ${b.max} marks: `) + V.bandsText(b.bands), src: V.srcOf(sys, b.src.p) });
    rows.push({ k: () => tr("數位考試", "Digital exam"), v: () => V.L(d.digitalNote.text), src: V.srcOf(sys, d.digitalNote.src.p) });
    $("examSummary").textContent = tr(`考試摘要 · Session skills ${b.max} 分`, `Exam summary · Session skills ${b.max} marks`);
  }
  rows.push(...V.summaryRows(sys, d, g), V.dataRow(d));
  V.fillSpec($("sumSpec"), rows);
  if (sys === "rsl") renderRsl(d, g); else renderTrinity(d, g);
}
function card(title, src){
  const c = document.createElement("section");
  c.className = "card spec-card";
  c.innerHTML = `<div class="card-title"><b></b><span class="sub"></span></div>`;
  // 標題兩種語言疊在同一格(寬、高都取比較大的那個):窄畫面標題換行、頁碼換到下一行時,中英版面一樣(drum.css .spec-card .card-title)
  V.pairStack(c.querySelector("b"), typeof title === "function" ? title : () => title);
  c.querySelector(".sub").textContent = src || "";
  $("specCards").appendChild(c);
  return c;
}
const specIn = (c, rows) => { const box = document.createElement("div"); c.appendChild(box); V.fillSpec(box, rows); return box; };
const notStated = () => tr("大綱沒寫", "Not stated");

function renderRsl(d, g){
  const e = d.ear[g], key = keyOf(), src = V.srcOf("rsl", e.src.p), f = e.fill, gr = e.groove;
  const c = card("Fill Playback & Recognition", src);
  specIn(c, [
    { k: () => tr("長度、鼓件", "Length, kit"), v: () => tr(`${f.bars} 小節 · `, `${f.bars} bar · `) + V.pieces(f.pieces, key), src },
    { k: () => tr("速度", "Tempo"), v: () => V.bpmText(f.bpm), src },
    { k: () => tr("音符", "Notes"), v: () => (f.values ? V.values(f.values) : tr(`${V.valueName(f.valueRange[0])}到${V.valueName(f.valueRange[1])}的所有時值與組合`, `All values from ${V.valueName(f.valueRange[0])} to ${V.valueName(f.valueRange[1])}`)), src },
    { k: () => tr("休止符", "Rests"), v: () => (f.rests.length ? V.rests(f.rests) : tr("大綱沒列", "None listed")), src },
    { k: () => tr("播放", "Plays"), v: () => tr(`配節拍器聽 ${f.plays} 次,每次前面 ${f.countInBars} 小節預備拍`, `${f.plays} plays with metronome, ${f.countInBars}-bar count-in each`), src },
    { k: () => tr("選項", "Options"), v: () => tr(`打完從 ${f.options} 個印出來的選項指出是哪一個`, `Then pick it from ${f.options} printed options`), src }
  ]);
  if (!f.values) V.addPara(c, () => V.L(d.earNote.fillValues));
  const c2 = card("Groove Recall", src);
  specIn(c2, [
    { k: () => tr("長度、鼓件", "Length, kit"), v: () => tr(`${gr.bars} 小節 · `, `${gr.bars} bars · `) + V.pieces(gr.pieces, key), src },
    { k: () => tr("速度", "Tempo"), v: () => V.bpmText(gr.bpm), src },
    { k: () => tr("播放", "Plays"), v: () => tr(`兩小節播 ${gr.repeat.v} 遍`, `The 2 bars played ${gr.repeat.v} times`) + V.assumed(gr.repeat.assumed) },
    { k: () => tr("說出風格", "Name the style"), v: () => (gr.styleChoices ? tr(`${gr.styleChoices} 選 1(選項大綱沒寫)`, `1 of ${gr.styleChoices} (options not listed)`) : tr("沒有這一題", "Not asked") + V.assumed(gr.styleChoicesAssumed)), src: gr.styleChoices ? src : "" }
  ]);
  V.addPara(c2, () => V.L(d.earNote.repeat));
  if (gr.styleChoices) V.addPara(c2, () => V.L(d.earNote.styles));
  V.addPara(c2, () => V.L(d.earNote.flow));
}

function renderTrinity(d, g){
  const c = card(() => tr("Playback(聽句回打)", "Playback (listen & repeat)"), V.srcOf("trinity", d.earNote.src.p));
  V.addPara(c, () => V.L(d.earNote.text));
  const fl = d.playback.flow, fsrc = V.srcOf("trinity", fl.src.p);
  specIn(c, [
    { k: () => tr("看譜", "Study"), v: () => V.secText(fl.studySec) + tr("(可以試打;看不看譜自己決定)", " (may try out; reading is optional)"), src: fsrc },
    { k: () => tr("播放", "Plays"), v: () => tr(`${fl.plays} 次(練習、評分);開頭有 count-in`, `${fl.plays} (practice, assessed); count-in first`), src: fsrc },
    { k: () => tr("速度、伴奏風格", "Tempo, style"), v: notStated }
  ]);
  V.addPara(c, () => tr("每一級的拍號、時值、鼓件見「視奏」的 Playback 規格。", "Each grade's metres, values and kit: see Playback under Sight-reading."));
  // Improvising:累積到這一級的規格(需要伴奏音軌,App 只列規格)
  const im = d.improvising, G = im.grades;
  let bars = null, solo = null; const time = [], styles = [];
  let meterChange = false, src = [];
  for (let k = 0; k <= g; k++) {
    const x = G[k];
    if (x.bars != null) bars = x.bars;
    if ("solo" in x) solo = x.solo;
    for (const t of x.time || []) if (!time.includes(t)) time.push(t);
    styles.push(...(x.styles || []));
    if (x.meterChange) meterChange = true;
    if (!src.includes(x.src.p)) src.push(x.src.p);
  }
  const s2 = V.srcOf("trinity", src.join(", "));
  const c2 = card("Improvising", s2);
  V.addPara(c2, () => V.L(im.flow.text), "spec-note", V.srcOf("trinity", im.flow.src.p));
  specIn(c2, [
    { k: () => tr("總小節數", "Total bars"), v: () => String(bars) + tr("(當作一次循環的長度", " (taken as one loop") + V.assumed(im.barsAs.assumed) + tr(")", ")"), src: s2 },
    { k: () => tr("拍號", "Time signatures"), v: () => time.join(tr("、", ", ")) + (meterChange ? tr(",會換拍號", "; metre changes") : ""), src: s2 },
    { k: () => "Solo break", v: () => (solo ? tr(`最多 ${solo.maxBars} 小節`, `Up to ${solo.maxBars} bars`) : tr("沒有", "None")), src: s2 },
    { k: () => tr("風格(累積)", "All styles"), v: () => styles.map(V.L).join(tr("、", ", ")), src: s2 },
    { k: () => tr("速度", "Tempo"), v: notStated }
  ]);
  V.addPara(c2, () => V.L(im.legend));
}

export async function start(c){ ctx = c; exam = c.exam; }
export function enter(t){ active = true; tab = t; render(); }
export function leave(){ active = false; }
export function setExam(ex){
  const same = exam && ex && exam.system === ex.system && exam.grade === ex.grade && !!exam.auto === !!ex.auto;
  exam = ex;
  if (!same && active && tab === "exam") render();
}
export function onCtx(){ if (active) render(); }
export function relang(){ render(); }
export function examStatus(){ return tr("準備中", "Coming"); }
export function onKey(){}
