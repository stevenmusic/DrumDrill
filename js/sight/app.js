/* 視奏模組:練習還在做(S8 以後);檢定頁先放「考試摘要」與規格卡(照官方大綱,資料在 data/exam-*.json,每項帶頁碼)。
   - RSL:Debut–5 級視奏(1–5 級可以改選即興 Improvisation & Interpretation,只列規格);6–8 級 Quick Study Piece(只列規格)
   - Trinity Rock & Pop:沒有視奏項目;最接近的是 Session skills 的 Playback(有譜,可以看也可以不看)→ 說明 + Playback 參數表
   元素 id 都加 "s-" 前綴;不自己發明題目 */
import { tr, T, pairText } from "../shared/i18n.js";
import { playbackFor } from "../shared/examdata.js";
import * as V from "../shared/examview.js";
const $ = id => document.getElementById("s-" + id);
const ROOT = document.getElementById("mod-sight");
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
  const cards = $("specCards"); cards.innerHTML = "";
  if (!d) {
    V.fillSpec($("sumSpec"), []); $("examSummary").textContent = T("sumTitle");
    V.addPara(card(() => tr("考試規格", "Exam spec")), () => tr("考試資料還沒載好(第一次要連網路,之後會存在裝置上)。", "Exam data isn't loaded yet (needs internet once; then it's cached)."));
    return;
  }
  // 考試摘要:這一項的配分與等第 + 整場門檻、時間、資料版本
  const rows = [];
  if (sys === "rsl") {
    const it = d.marks.gradeExam.items.find(i => i.id === "sight");
    const label = () => (g >= 6 ? "Quick Study Piece" : g === 0 ? tr("視奏", "Sight reading") : tr("視奏或即興", "Sight reading or I&I"));
    rows.push({ k: () => tr("本項配分", "This section"), v: () => label() + tr(` ${it.max} 分:`, `, ${it.max} marks: `) + V.bandsText(it.bands), src: V.srcOf(sys, d.marks.gradeExam.src.p) });
    $("examSummary").textContent = tr(`考試摘要 · ${g >= 6 ? "QSP" : "視奏"} ${it.max} 分`, `Exam summary · ${g >= 6 ? "QSP" : "Sight reading"} ${it.max} marks`);
  } else {
    const b = d.sessionBands;
    rows.push({ k: () => tr("本項配分", "This section"), v: () => tr(`沒有視奏項目;Session skills(Playback 或 Improvising 擇一)${b.max} 分:`, `No sight reading; Session skills (Playback or Improvising), ${b.max} marks: `) + V.bandsText(b.bands), src: V.srcOf(sys, b.src.p) });
    rows.push({ k: () => tr("數位考試", "Digital exam"), v: () => V.L(d.digitalNote.text), src: V.srcOf(sys, d.digitalNote.src.p) });
    $("examSummary").textContent = tr(`考試摘要 · Session skills ${b.max} 分`, `Exam summary · Session skills ${b.max} marks`);
  }
  rows.push(...V.summaryRows(sys, d, g), V.dataRow(d));
  V.fillSpec($("sumSpec"), rows);
  if (sys === "rsl") renderRsl(d, g); else renderTrinity(d, g);
}
/* 一張規格卡:標題 + 右邊的出處;回傳卡片(內容自己加) */
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
  const s = d.sight[g], key = keyOf(), src = V.srcOf("rsl", s.src.p);
  if (s.type !== "qsp") {
    const c = card(() => tr("視奏規格", "Sight reading"), src);
    specIn(c, [
      { k: () => tr("小節數", "Bars"), v: () => String(s.bars) + (s.develop ? tr(`(含 ${s.develop.bars} 小節自由發展)`, ` (incl. a ${s.develop.bars}-bar development)`) : ""), src },
      s.develop && { k: () => tr("自由發展位置", "Development"), v: () => tr("最後兩小節", "Last 2 bars") + V.assumed(s.develop.pos.assumed) },
      { k: () => tr("拍號", "Time signature"), v: () => s.time.v + V.assumed(s.time.assumed), src: s.time.assumed ? "" : src },
      { k: () => tr("音符", "Notes"), v: () => V.values(s.values), src },
      { k: () => tr("休止符", "Rests"), v: () => V.rests(s.rests), src },
      { k: () => tr("鼓件", "Kit"), v: () => (s.type === "snare" ? tr("只用小鼓", "Snare only") : V.pieces(s.pieces, key)), src },
      { k: () => tr("速度", "Tempo"), v: () => V.bpmText(s.bpm), src },
      { k: () => tr("準備時間", "Preparation"), v: () => V.secText(s.prepSec) + tr("(準備加練習)", " (study and try)"), src },
      { k: () => tr("節拍器", "Metronome"), v: () => tr("練習時可以開或關", "On or off while preparing"), src },
      { k: () => tr("預備拍、伴奏", "Count-in, backing"), v: notStated }
    ]);
    V.addPara(c, () => V.L(d.sightNote[s.type]));
    V.addPara(c, () => V.L(d.sightNote.examples));
    const im = d.improv[g];
    if (im) {
      const c2 = card(() => tr("即興(I&I,二選一)", "Improvisation (I&I)"), V.srcOf("rsl", im.src.p)), s2 = V.srcOf("rsl", im.src.p);
      specIn(c2, [
        { k: () => tr("小節數", "Bars"), v: () => String(im.bars), src: s2 },
        { k: () => tr("形式", "Form"), v: () => V.L(im.form), src: s2 },
        { k: () => tr("速度", "Tempo"), v: () => V.bpmText(im.bpm), src: s2 },
        { k: () => tr("準備時間", "Preparation"), v: () => (im.prepSec ? V.secText(im.prepSec) : notStated()), src: im.prepSec ? s2 : "" }
      ]);
      V.addPara(c2, () => V.L(d.improvNote.text));
    }
  } else {
    const c = card("Quick Study Piece", src);
    specIn(c, [
      { k: () => tr("小節數", "Bars"), v: () => String(s.bars), src },
      { k: () => tr("形式", "Form"), v: () => V.L(s.form), src },
      { k: () => tr("研讀時間", "Study time"), v: () => V.secText(s.studySec), src },
      { k: () => tr("播放", "Plays"), v: () => tr(`先聽有示範鼓聲的音軌,再播 ${s.plays} 次(練習、考)`, `Demo track first, then ${s.plays} plays (practice, assessed)`), src },
      { k: () => tr("風格", "Style"), v: () => tr("跟技巧的風格練習曲選同一種", "Same as your Stylistic Study"), src },
      { k: () => tr("拍號、時值、速度", "Metre, values, tempo"), v: notStated }
    ]);
    V.addPara(c, () => V.L(d.sightNote.qsp));
    V.addPara(c, () => tr("要伴奏音軌和 lead sheet,App 不提供這一項的練習。", "Needs a backing track and lead sheet, so the App has no practice for it."));
  }
}

function renderTrinity(d, g){
  const pb = playbackFor(g, d), key = keyOf(), src = V.srcOf("trinity", pb.src.join(", "));
  const c = card(() => tr("Playback(看譜)", "Playback (chart)"), V.srcOf("trinity", d.sightNote.src.p));
  V.addPara(c, () => V.L(d.sightNote.text));
  const codes = d.playback.codes, lt = d.playback.pieceMap && d.playback.pieceMap.LT;
  specIn(c, [
    { k: () => tr("總長度", "Length"), v: () => tr(`${range(pb.total)} 小節`, `${range(pb.total)} bars`), src },
    { k: () => tr("重複的句子", "Phrases"), v: () => tr(`${range(pb.phrase)} 小節`, `${range(pb.phrase)} bars`), src },
    { k: () => tr("拍號", "Time signatures"), v: () => pb.time.join(tr("、", ", ")), src },
    { k: () => tr("音符", "Notes"), v: () => V.values(pb.values), src },
    { k: () => tr("休止符", "Rests"), v: () => V.rests(pb.rests), src },
    { k: () => tr("力度、奏法", "Dynamics"), v: () => (pb.dyn.length ? V.dyns(pb.dyn) : tr("沒有力度或分句記號", "None")), src },
    { k: () => tr("鼓件", "Kit"), v: () => V.pieces(pb.pieces, key) + (lt && pb.pieces.includes(lt.v) ? tr("(LT 用落地鼓", " (LT as floor tom") + V.assumed(lt.assumed) + tr(")", ")") : ""), src },
    { k: () => tr("聲部", "Voices"), v: () => (pb.voicesAmount ? V.L(codes.voicesAmount[pb.voicesAmount]) : tr(`${pb.voices} 聲部協調`, `${pb.voices}-way coordination`)), src },
    pb.extra.length && { k: () => tr("其他", "Also"), v: () => pb.extra.map(x => V.L(codes.extra[x])).join(tr("、", ", ")), src },
    { k: () => tr("速度", "Tempo"), v: notStated }
  ]);
  V.addPara(c, () => V.L(d.playback.legend));
  V.addPara(c, () => V.L(d.playback.flow.text), "spec-note", V.srcOf("trinity", d.playback.flow.src.p));
}
const range = r => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

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
