/* 視奏模組(docs/STAGES.md S8;卡片、id、流程照 PianoDrill 的視奏:js/sight/app.js、stage.js、docs/sight/CLAUDE.md)。
   外框(js/main.js)負責頂欄、分頁、考試設定與語言;這裡的元素 id 都加 "s-" 前綴。
   - 子項目 = 級數 0–8(外框的子項目列;沒選考試時用 RSL)。RSL Debut–3:小鼓視奏出題(js/sight/gen.js,照 data/exam-rsl.json sight[g]);
     RSL 4–5(整組鼓)下一版、6–8 Quick Study Piece 與 Trinity(Rock & Pop 沒有視奏)只有說明卡 + 規格卡,不出題
   - 流程:出題 → 準備 90 秒(官方:準備加練習的時間;節拍器可開可關〔官方〕;可以在鼓墊上試打,不計分)
     → 正式打(預備拍 1 小節〔推估:大綱沒寫〕;拍點可開關;鼓墊 / 鍵盤 J、F)→ 結果(鼓墊的節奏回饋〔練習回饋,不是考試分數〕+ 自我檢查清單)
     → 聽正確版本(js/shared/player.js;stage.js 畫目前小節的底色與播放軸)
   - 譜像印出來的考卷(PianoDrill 的 fitScore:每行 4 小節、放不下再縮,不小於 0.55;每行 2 小節的最後手段 0.45;同形狀的題目同一個排法與大小、只縮不放大);
     單線譜(js/shared/kitnotation.js lines:1)+ 圖例(js/shared/legend.js)
   - 檢定頁:考試摘要 + 規格卡(照官方大綱,每項頁碼);不放練習紀錄、練習回饋(不跟配分、等第同一個畫面)
   - leave():停止播放、準備的倒數、正式打(不算分),題目保留;relang():只重寫文字,不停播放
   - localStorage drumdrill.sight.v1:{ pick, metroPractice, clickPerform, bpmOverride:{ "rsl-3": 75 }, history(出過的題目指紋), stats:{ "rsl-3": {n, hits, total} }, log:{ 日期: {n, sec} }, layout }
     讀進來先消毒:bpmOverride 夾在 30–240、不是有限數的刪掉;layout 每一項 zoom 夾在 0.45–1、每行小節數不對的刪掉 */
import { tr, T as TS, scoped, getLang, pairText } from "../shared/i18n.js";
import { playbackFor } from "../shared/examdata.js";
import * as V from "../shared/examview.js";
import * as audio from "../shared/audio.js";
import { createPlayer } from "../shared/player.js";
import { createPads } from "../shared/pad.js";
import { LANES, expectedByLane, scoreLanes, offsetNote } from "../shared/timing.js";
import { scoreXML, osmdXML } from "../shared/kitnotation.js";
import { setupKit, decorate, drawLegend } from "../shared/legend.js";
import { createTempo } from "../shared/tempo.js";
import { createStage } from "./stage.js";
import { genSnare, SNARE_GRADES } from "./gen.js";
import { createHistory, generateUnique } from "./fingerprint.js";
import { randomSeed } from "./random.js";
import "./strings.js";
const T = scoped("sight");

const $ = id => document.getElementById("s-" + id);
const ROOT = document.getElementById("mod-sight");

/* ── 設定與紀錄(localStorage;讀不到就用預設值)── */
const KEY = "drumdrill.sight.v1";
const SS = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  s = { pick: { system: "rsl", grade: 0 }, metroPractice: true, clickPerform: true, bpmOverride: {}, history: [], stats: {}, log: {}, layout: {}, ...(s || {}) };
  for (const k of ["bpmOverride", "stats", "log", "layout"]) if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = {};
  if (!Array.isArray(s.history)) s.history = [];
  for (const [k, v] of Object.entries(s.bpmOverride)) { if (typeof v === "number" && Number.isFinite(v)) s.bpmOverride[k] = Math.max(30, Math.min(240, Math.round(v))); else delete s.bpmOverride[k]; }
  for (const [k, v] of Object.entries(s.layout)) {
    if (v && typeof v === "object" && typeof v.zoom === "number" && Number.isFinite(v.zoom) && [0, 2, 3, 4, 5].includes(v.measuresPerLine)) v.zoom = Math.max(0.45, Math.min(1, v.zoom));
    else delete s.layout[k];
  }
  return s;
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SS)); } catch (e) {} };
const history = createHistory({ capacity: 60, load: () => SS.history, save: e => { SS.history = e; save(); } });

/* ── 狀態 ── */
let ctx = null, exam = null, active = false, mode = "free";
let freeGrade = Number.isInteger(SS.pick.grade) ? SS.pick.grade : 0;
let cur = null;               // { key:"rsl-3", sys, grade, spec, test, xml }
let phase = "idle";           // idle | prep | ready(準備時間到)| perform | result
let left = 0, countdown = 0, prepStarted = 0;
let perf = null;              // 正式打:{ t0, bpm, taps:[{lane, time}], startedAt }
let playKind = null;          // 播放器正在播的:"metro"(準備時節拍器)| "perform" | "listen"
let lastResult = null;
let lastMsg = null;
let starting = 0;

const curExam = () => exam || { system: "trinity", grade: 1, auto: true };
/* 自由練習:沒選考試時用 RSL(只有 RSL 有視奏;外框的子項目列也照這個寫 D);檢定頁照考試 */
const sysNow = () => (mode === "exam" || !curExam().auto ? curExam().system : "rsl");
const gradeNow = () => (mode === "exam" ? curExam().grade : freeGrade);
const keyOf = (sys, g) => `${sys}-${g}`;
const dataOf = sys => (ctx && ctx.examData ? ctx.examData(sys) : null);
const drumKey = () => (ctx && ctx.drumKey ? ctx.drumKey() : null);
const specOf = (sys, g) => (sys === "rsl" && dataOf("rsl") && dataOf("rsl").sight ? dataOf("rsl").sight[g] : null);
const practicable = (sys, g) => sys === "rsl" && SNARE_GRADES.includes(g) && !!specOf(sys, g) && specOf(sys, g).type === "snare" && !!drumKey();
const sysName = sys => (sys === "rsl" ? "RSL" : "Trinity");
const gl = (g, sys) => (ctx ? ctx.gradeLabel(g, sys) : String(g));
const COUNT_IN = 4;           // 預備拍 1 小節(4/4;推估:大綱沒寫)
const TAIL = 0.75;            // 最後一拍之後多收幾拍的敲擊(最後一個音晚一點也算得到)

/* ══ 外框呼叫 ══ */
export async function start(c){
  ctx = c; exam = c.exam;
  renderLog();
  window.__sight = {
    get state(){ const p = player.state; return { phase, play: p.playing, kind: playKind, timer: !!countdown, left, key: cur && cur.key, grade: cur && cur.grade, bpm: cur ? bpmNow() : null,
      drawn, pending: pendingDraw, systems: stage ? stage.systems : 0, result: lastResult ? { ...lastResult.r, taps: lastResult.taps } : null, taps: perf ? perf.taps.length : 0 }; },
    get test(){ return cur && cur.test; }, get xml(){ return cur && cur.xml; }, get osmd(){ return osmd; },
    newTest, startPrep, startPerform, toggleListen, setBpm: v => setBpm(v), SS, get layout(){ return lastLayout; }, perfT0: () => (perf ? perf.t0 : null)
  };
  window.__playback = { get playing(){ return player.state.playing; } };   // human.mjs:「不在畫面上的模組沒有在播放」
}
export function enter(t){
  active = true;
  mode = t === "exam" ? "exam" : "free";
  if (mode === "free" && /^[0-8]$/.test(String(t))) freeGrade = Number(t);
  const had = cur;
  render();
  // 同一題:在別的分頁時延後的譜、寬度變了的,回到畫面再畫(新題目 render 裡已經畫了)
  if (mode === "free" && cur && cur === had && !$("quiz").hidden && (pendingDraw || innerWidth !== renderedWidth)) requestAnimationFrame(() => drawCurrent());
  if (mode === "free" && cur && !$("quiz").hidden) requestAnimationFrame(() => { if (active) fitTitle(); });
}
/* 離開(切分頁、切到背景):停止播放、準備的倒數、正式打(不算分);題目保留 */
export function leave(){ active = false; stopAll(); }
export function setExam(ex){
  const same = exam && ex && exam.system === ex.system && exam.grade === ex.grade && !!exam.auto === !!ex.auto;
  exam = ex;
  if (!same && active) render();
}
/* 外框的 appCtx(考試資料、圖例)晚到 */
export function onCtx(){ if (active) render(); if (ctx) ctx.examChanged(); }
/* 換語言:只重寫文字(不停止播放、不重新出題) */
export function relang(){
  if (mode === "exam" || !cur || $("quiz").hidden) { if (active || mode === "exam") renderStatic(); }
  refreshTexts();
  pads.relang();
  relangPairs($("legend"));
  renderLog();
}
export function examStatus(){
  const ex = curExam();
  if (ex.system === "trinity") return tr("沒有視奏項目", "No sight-reading");
  if (SNARE_GRADES.includes(ex.grade)) { const n = (SS.stats[keyOf("rsl", ex.grade)] || {}).n || 0; return tr(`已練 ${n} 題`, `${n} practised`); }
  return ex.grade <= 5 ? tr("下一版提供", "Next version") : tr("只列規格", "Spec only");
}
export function onKey(e){
  if (mode === "exam" || !cur || $("quiz").hidden) return;
  if (pads.key(e)) return;   // J / F = 鼓墊
  if (e.code === "Space") {
    e.preventDefault();       // 不要捲動頁面
    if (phase === "perform") stopPerform(); else if (!$("play").disabled) toggleListen();
  } else if ((e.key === "n" || e.key === "N") && !$("generate").disabled) newTest();
}

/* ══ 畫面:檢定頁 / 自由練習(有題目 / 只有說明)══ */
function render(){
  const isExam = mode === "exam";
  ROOT.querySelectorAll(".pane").forEach(el => { el.hidden = !isExam; });
  $("logCard").hidden = isExam;   // 檢定頁不放練習紀錄
  if (isExam) { stopAll(); showPractice(false); $("unsupported").hidden = true; $("specCards").hidden = false; renderExam(); return; }
  const sys = sysNow(), g = gradeNow();
  if (!practicable(sys, g)) { stopAll(); showPractice(false); renderUnsupported(sys, g); return; }
  showPractice(true); $("unsupported").hidden = true; $("specCards").hidden = true;
  if (!cur || cur.key !== keyOf(sys, g)) newTest();
  else refreshTexts();
}
/* 只有說明卡的畫面重寫文字(換語言) */
function renderStatic(){
  if (mode === "exam") { renderExam(); return; }
  const sys = sysNow(), g = gradeNow();
  if (!practicable(sys, g)) renderUnsupported(sys, g);
}
function showPractice(on){ for (const id of ["setup", "quiz", "scoreCard", "along"]) $(id).hidden = !on; }

/* 這一級 / 這個考試還沒有視奏練習:說明 + 官方規格卡(不出題) */
function renderUnsupported(sys, g){
  $("unsupported").hidden = false;
  const d = dataOf(sys), name = () => `${sysName(sys)} ${gl(g, sys)}`;
  let title, text;
  if (!d) {
    title = () => tr("考試資料還沒載好", "Exam data not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。", "Needs internet once; then it's cached.");
  } else if (sys === "rsl" && SNARE_GRADES.includes(g) && specOf(sys, g) && specOf(sys, g).type === "snare" && !drumKey()) {
    // 小鼓視奏的級數,只是圖例資料(data/drumkey.json)還沒到:不是「整組鼓下一版」
    title = () => tr("圖例資料還沒載好", "Drum key not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。下面是官方規格。", "Needs internet once; then it's cached. Official spec below.");
  } else if (sys === "trinity") {
    title = () => tr("Rock & Pop 沒有視奏", "No sight-reading in Rock & Pop");
    text = () => tr("Trinity Rock & Pop 沒有視奏項目;最接近的是 Session skills 的 Playback(有譜)。Playback 看譜練習下一版提供。下面是官方規格。",
      "Trinity Rock & Pop has no sight-reading test; the closest is Playback in Session skills (with a chart). Playback chart practice comes in the next version. Official spec below.");
  } else if (g <= 5) {
    title = () => tr("整組鼓視奏:下一版提供", "Kit reading: next version");
    text = () => tr(`${name()} 的視奏用整組鼓(8 小節,含 2 小節自由發展),下一版提供;即興(I&I)只列規格。下面是官方規格。`,
      `${name()} sight reading uses the full kit (8 bars incl. a 2-bar development) — next version; I&I is spec only. Official spec below.`);
  } else {
    title = () => tr("Quick Study Piece:只列規格", "Quick Study Piece: spec only");
    text = () => tr(`${name()} 考 Quick Study Piece:要伴奏音軌和 lead sheet,App 只列規格、不出題。`,
      `${name()} has a Quick Study Piece: it needs a backing track and lead sheet, so the App lists the spec only.`);
  }
  V.pairStack($("unsupportedTitle"), title);
  pairText($("unsupportedText"), text);
  pairText($("unsupportedNote"), () => TS("practiceOnly"));
  $("specCards").hidden = !d; $("specCards").innerHTML = "";
  if (d) { if (sys === "rsl") renderRsl(d, g, false); else renderTrinity(d, g); }
}

/* ── 檢定頁:考試摘要 + 規格卡(照官方大綱,資料在 data/exam-*.json,每項帶頁碼)── */
function renderExam(){
  const ex = curExam(), sys = ex.system, g = ex.grade, d = dataOf(sys);
  $("sumSub").textContent = `${sysName(sys)} · ${gl(g, sys)}`;
  pairText($("sumNote"), () => TS("practiceOnly"));
  const cards = $("specCards"); cards.innerHTML = "";
  if (!d) {
    V.fillSpec($("sumSpec"), []); $("examSummary").textContent = TS("sumTitle");
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
  if (sys === "rsl") renderRsl(d, g, true); else renderTrinity(d, g);
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

/* withPractice = 檢定頁:小鼓視奏的級數加「練習這一級的視奏」(帶到視奏分頁的那一級) */
function renderRsl(d, g, withPractice){
  const s = d.sight[g], key = drumKey(), src = V.srcOf("rsl", s.src.p);
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
    if (withPractice && s.type === "snare" && SNARE_GRADES.includes(g)) {
      const b = document.createElement("button");
      b.className = "xcat s-go"; b.type = "button";
      b.innerHTML = '<span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
      pairText(b.querySelector("span"), () => tr("練習這一級的視奏(App 出題)", "Practise this grade (App tests)"));
      b.onclick = () => ctx.showView("sight", String(g));
      const w = document.createElement("div"); w.className = "xcats"; w.appendChild(b); c.appendChild(w);
    }
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
  const pb = playbackFor(g, d), key = drumKey(), src = V.srcOf("trinity", pb.src.join(", "));
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
  V.addPara(c, () => tr("Playback 看譜練習下一版提供。", "Playback chart practice comes in the next version."));
}
const range = r => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

/* ══ 出題 ══ */
function newTest(){
  stopAll();
  const sys = sysNow(), g = gradeNow(), spec = specOf(sys, g);
  if (!practicable(sys, g)) return;
  let test;
  try { test = generateUnique(() => genSnare(spec, randomSeed(), g), history).score; }
  catch (e) { console.error(e); say(() => tr("出題失敗:", "Could not make a test: ") + e.message); return; }
  setTest(sys, g, spec, test);
}
/* 指定題目(測試用 __sight;同一個種子同一題) */
function setTest(sys, g, spec, test){
  SS.pick = { system: sys, grade: g }; save();
  cur = { key: keyOf(sys, g), sys, grade: g, spec, test, xml: null };
  phase = "idle"; lastResult = null; perf = null;
  $("alongResult").hidden = true; showChecklist(null);
  $("countdown").hidden = false; $("countdown").className = "countdown"; $("countdownValue").textContent = String(spec.prepSec);
  try { cur.xml = scoreXML({ key: drumKey(), lines: 1, time: test.time, measures: test.measures }); }
  catch (e) { console.error(e); say(() => tr("譜產生失敗:", "Could not build the score: ") + e.message); }
  $("play").disabled = $("prepare").disabled = $("playAlong").disabled = !cur.xml;
  $("generate").disabled = false;
  tempoUI();
  refreshTexts();
  say(() => tr("看譜準備好就按「準備」;也可以直接「正式打」。", "Start the prep when ready, or go straight to Perform."));
  drawCurrent();
  preload();
}

/* ── 速度:預設官方(3 級 70–80 每題隨機);使用者改了每一級各自記住(跟這一題的速度脫鉤,換題也照用);
   設在官方範圍外才是「練習速度」;官方速度鈕清掉自己設的速度、回到這一題的官方速度 ── */
const bpmNow = () => (cur ? (SS.bpmOverride[cur.key] || cur.test.bpm) : 80);
const officialBpm = b => !!cur && b >= cur.spec.bpm[0] && b <= cur.spec.bpm[cur.spec.bpm.length - 1];
const custom = () => !!(cur && SS.bpmOverride[cur.key]);
const overridden = () => custom() && !officialBpm(bpmNow());
const tempo = createTempo({ $, min: 30, max: 240, get: () => bpmNow(), set: v => setBpm(v) });
tempo.setBeats(4);
function setBpm(v){
  if (!cur || phase === "perform") return;   // 正式打中不改(評分照開始時的速度)
  if (!Number.isFinite(Number(v))) return;
  const b = Math.max(30, Math.min(240, Math.round(Number(v)))), [lo, hi] = cur.spec.bpm;
  if (lo === hi && b === lo) delete SS.bpmOverride[cur.key]; else SS.bpmOverride[cur.key] = b;   // 固定速度的級數設回官方值 = 沒有自己設
  applyBpm();
}
/* 官方速度鈕:清掉這一級自己設的速度 */
function resetBpm(){
  if (!cur || phase === "perform") return;
  delete SS.bpmOverride[cur.key];
  applyBpm();
}
function applyBpm(){
  save(); tempoUI();
  if (playKind === "listen") player.retempo(bpmNow());
  // 準備中的節拍器:長度是照開始時的速度算的(剩下的秒數 × 速度),照新速度重排一輪
  else if (playKind === "metro") { stopPlayer(); startMetro(); }
}
function tempoUI(){
  tempo.sync(`♩ / ${tr("分", "min")}`);
  if (!cur) return;
  const off = V.bpmText(cur.spec.bpm), src = V.srcOf("rsl", cur.spec.src.p);
  pairText($("tempoNote"), () => (overridden() ? tr(`練習速度(官方 ${off})`, `Practice tempo (official ${off})`) : tr(`官方速度 ${off} · ${src}`, `Official ${off} · ${src}`)));
  $("bpmReset").disabled = !custom();
  renderMeta(); renderSum();
}
$("bpmReset").onclick = () => resetBpm();
function syncOpts(){
  $("optMetro").setAttribute("aria-pressed", String(!!SS.metroPractice));
  $("optClick").setAttribute("aria-pressed", String(!!SS.clickPerform));
}
$("optMetro").onclick = () => {
  SS.metroPractice = !SS.metroPractice; save(); syncOpts(); renderSum();
  if (phase === "prep") { if (SS.metroPractice) startMetro(); else if (playKind === "metro") stopPlayer(); }
};
$("optClick").onclick = () => { SS.clickPerform = !SS.clickPerform; save(); syncOpts(); renderSum(); };
syncOpts();

/* ── 文字(換語言時全部重寫;不停播放)── */
function refreshTexts(){
  if (!cur) return;
  $("title").classList.remove("empty");
  $("title").textContent = `${sysName(cur.sys)} ${gl(cur.grade, cur.sys)}`;
  $("scoreSub").textContent = V.srcOf("rsl", cur.spec.src.p);
  pairText($("practiceOnly"), () => tr(`依 RSL ${gl(cur.grade, cur.sys)}參數的練習 · `, `Practice by RSL ${gl(cur.grade, cur.sys)} parameters · `) + TS("practiceOnly"));
  tempoUI();
  renderPrepareLabel();
  renderAlongLabel();
  pairText($("alongNote"), () => tr("預備拍 1 小節(推估:大綱沒寫)· 鍵盤 J / F", "1-bar count-in (assumed: not stated) · keys J / F"));
  const mixed = cur.test.mixed, half = (cur.spec.values || []).includes("2");
  pairText($("confidence"), () => tr(
    `拍號 4/4:大綱沒寫 Debut–3 級的拍號(推估)。預備拍 1 小節:大綱沒寫(推估)。節奏格怎麼組合成一拍、結尾停在四分或二分音符${half ? "、二分音符只放第 1、3 拍" : ""}、每小節至少 2 個音、每題至少一次本級最短時值${mixed ? "、一拍裡混合八分與十六分音符" : ""}:練習設定。`,
    `4/4: metre not stated for Debut–3 (assumed). 1-bar count-in: not stated (assumed). Beat patterns, ending on a crotchet or minim${half ? ", minims on beats 1 and 3 only" : ""}, 2+ notes a bar, the grade's shortest value at least once${mixed ? ", mixed quaver–semiquaver beats" : ""}: practice setting.`));
  if (lastMsg) say(lastMsg);
  showChecklist(checkKind);
  renderResult();
  if (active) fitTitle();
}
function renderMeta(){
  if (!cur) return;
  const t = cur.test, b = bpmNow();
  const tags = [`4/4 · ${TS("srcAssumed")}`, tr(`${t.bars} 小節`, `${t.bars} bars`), overridden() ? `♩=${b} · ${tr("練習", "Practice")}` : `♩=${b}`];
  $("meta").innerHTML = tags.map(x => `<span class="q-tag">${x}</span>`).join("");
  if (active) fitTags();
}
function renderSum(){
  if (!cur) return;
  $("sum").textContent = [`${sysName(cur.sys)} ${gl(cur.grade, cur.sys)}`, `♩=${bpmNow()}${overridden() ? " " + tr("練習速度", "practice") : ""}`,
    tr("節拍器", "Metronome") + " " + (SS.metroPractice ? tr("開", "on") : tr("關", "off"))].join(" · ");
}
function renderPrepareLabel(){
  const sec = cur ? cur.spec.prepSec : 90, fn = () => (phase === "prep" ? tr("結束準備", "End prep") : tr(`準備 ${sec} 秒`, `Prep ${sec} s`));
  pairText($("prepareLabel"), fn);
  $("prepare").setAttribute("aria-label", fn());   // 窄畫面(≤340)只剩圖示時,螢幕閱讀器還是念得到
}
function renderAlongLabel(){ $("playAlong").textContent = phase === "perform" ? tr("停止", "Stop") : T("perform"); }
/* 狀態訊息:記住產生文字的函式,換語言時重寫;兩種語言保留比較高的高度 */
function say(fn){ lastMsg = fn; pairText($("message"), fn); }
/* 題目固定一行:太長就把字縮小(中英文版面一樣);標籤先縮字(最多到 0.6) */
function fitTitle(){
  const el = $("title"); el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize);
  const min = Math.max(14, fs * 0.55);
  while (el.scrollWidth > el.clientWidth + 1 && fs > min) { fs -= 1; el.style.fontSize = fs + "px"; }
  fitTags();
}
function fitTags(){
  const g = $("meta"); let k = 1; g.style.setProperty("--tag-scale", 1);
  const over = () => g.lastElementChild && g.lastElementChild.getBoundingClientRect().right + 2 > g.getBoundingClientRect().right;
  while (over() && k > 0.6) { k -= 0.04; g.style.setProperty("--tag-scale", k); }
}
/* 圖例裡 pairText 的字換語言(drawLegend 只畫一次) */
function relangPairs(root){ for (const el of root.querySelectorAll("*")) if (el._pair) el.textContent = el._pair[getLang() === "en" ? 1 : 0]; }

/* ── 看譜重點(準備時)/ 自我檢查(結果出來後):App 的練習建議,不是考試要求 ── */
const PREP_TIPS = [
  ["先看拍號、速度、小節數", "Check the metre, tempo and bar count"],
  ["找出最密的那一拍,用它決定速度", "Find the busiest beat and set the tempo by it"],
  ["休止符、二分音符要數滿", "Count rests and long notes in full"],
  ["在鼓墊上輕輕試打難的地方", "Try the tricky beats on the pad"],
  ["開節拍器跟著數拍子", "Count along with the metronome"],
  ["正式打時錯了不要停,繼續往下打", "When you perform, keep going after a slip"]
];
const SELF_CHECK = [
  ["從頭打到尾沒有停下來", "Kept going to the end without stopping"],
  ["速度穩定,沒有越打越快或越慢", "Steady tempo — no rushing or dragging"],
  ["休止符有空出來、二分音符有算滿", "Rests left empty, long notes held in full"],
  ["跟預備拍的速度一樣", "Played at the count-in tempo"]
];
let checkKind = null;
function showChecklist(kind){
  checkKind = kind;
  $("checkWrap").hidden = !kind;
  if (!kind) return;
  const list = $("checklist");
  list.classList.toggle("self", kind === "self");
  pairText($("checkTitle"), () => (kind === "self" ? tr("自我檢查(練習回饋)", "Self-check (practice feedback)") : tr("看譜重點", "Reading tips")));
  const items = kind === "self" ? SELF_CHECK : PREP_TIPS;
  // 勾選的狀態換語言時保留
  const was = [...list.querySelectorAll("input")].map(i => i.checked);
  list.innerHTML = items.map(() => (kind === "self" ? `<li><label><input type="checkbox"><span></span></label></li>` : `<li><span></span></li>`)).join("");
  [...list.querySelectorAll("li span")].forEach((s, i) => pairText(s, () => tr(items[i][0], items[i][1])));
  if (kind === "self") [...list.querySelectorAll("input")].forEach((x, i) => { x.checked = !!was[i]; });
}

/* ══ 譜:OSMD(單線譜)+ stage.js(目前小節的底色、播放軸)。像印出來的考卷:每行 4 小節,放不下再縮 ══ */
let osmd = null, stage = null, renderedWidth = 0, pendingDraw = false, drawing = false, drawAgain = false, drawn = 0, legendDrawn = false, lastLayout = null;
const MAX_ZOOM = 1.0, MIN_ZOOM = 0.55, MIN_ZOOM_DENSE = 0.45;
const SCORE_BOTTOM_GAP = 16;
function ensureOsmd(){
  if (osmd) return true;
  if (typeof opensheetmusicdisplay === "undefined") { say(() => tr("樂譜元件載入失敗", "Could not load the notation engine")); return false; }
  osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay($("score"), {
    backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
    drawingParameters: "compacttight", drawMeasureNumbersOnlyAtSystemStart: true, stretchLastSystemLine: true
  });
  osmd.EngravingRules.FixedMeasureWidth = true;   // 每小節一樣寬(像印出來的考卷)
  stage = createStage({ score: $("score"), playline: $("playline"), highlight: $("highlight") });
  return true;
}
async function drawCurrent(){
  if (!cur || !cur.xml) return;
  if (!active || !$("stage").clientWidth) { pendingDraw = true; return; }   // 看不到:寬度是 0,回到畫面再畫
  if (drawing) { drawAgain = true; return; }
  drawing = true; pendingDraw = false;
  $("score").setAttribute("aria-busy", "true");
  try {
    do { drawAgain = false; await drawOnce(cur); } while (drawAgain && active);
  } finally { drawing = false; $("score").removeAttribute("aria-busy"); }
}
async function drawOnce(c){
  if (!ensureOsmd()) return;
  $("score").classList.add("entering");
  try {
    setupKit(osmd, 1, c.xml);
    await osmd.load(osmdXML(c.xml));
  } catch (e) { console.error(e); say(() => tr("樂譜繪製失敗:", "Could not draw the score: ") + e.message); $("score").classList.remove("entering"); return; }
  if (cur !== c) { drawAgain = true; return; }
  if (!active || !$("stage").clientWidth) { pendingDraw = true; $("score").classList.remove("entering"); return; }
  try { fitScore(c); } catch (e) { console.error(e); say(() => tr("樂譜繪製失敗:", "Could not draw the score: ") + e.message); }
  renderedWidth = innerWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => $("score").classList.remove("entering")));
  drawn++;
  if (!legendDrawn && drumKey()) { legendDrawn = true; drawLegend($("legend"), { pieces: ["snare"], lines: 1, key: drumKey() }).catch(e => { console.error(e); legendDrawn = false; }); }
}
/* 寬度分級:同一級的手機共用一個排法 */
function widthClass(){ const w = innerWidth; return w < 500 ? "phone" : w < 900 ? "compact" : w < 1280 ? "medium" : "wide"; }
function renderAt(n, zoom){
  osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = n;
  osmd.zoom = zoom;
  osmd.render();
  const svg = $("score").querySelector("svg");
  decorate(osmd, cur.xml, svg);
  const layout = stage.measure();
  return { layout, fitsHeight: renderedScoreHeight() <= availableScoreHeight() };
}
function renderedScoreHeight(){ const svg = $("score").querySelector("svg"); return svg ? svg.getBoundingClientRect().bottom - $("score").getBoundingClientRect().top : 0; }
/* 樂譜卡捲到頂欄下時,頂欄與底部分頁列之間放得下多高(手機橫式分頁列在左邊,不扣) */
function availableScoreHeight(){
  const header = document.querySelector("header"), top = header ? header.getBoundingClientRect().height : 0;
  const bar = document.getElementById("tabbar"), bb = bar ? bar.getBoundingClientRect() : null;
  const bottom = bb && bb.top > innerHeight / 2 ? bb.top : innerHeight;
  const chrome = $("score").getBoundingClientRect().top - $("scoreCard").getBoundingClientRect().top;
  return Math.max(120, bottom - top - chrome - SCORE_BOTTOM_GAP);
}
/* OSMD 有沒有照要求的「每行 n 小節」排(放不下時它會自己換成別的排法) */
function matchesRequestedLayout(layout, n, totalBars){
  const systems = layout.systems;
  if (systems.length !== Math.ceil(totalBars / n)) return false;
  const remainder = totalBars % n;
  return systems.every((s, i) => s.bars.length === (i === systems.length - 1 && remainder !== 0 ? remainder : n));
}
/* 每行幾小節的候選(多的先試):目標 4;能整除的優先、不留一個小節單獨一行,最後才退到每行 2 小節(照 PianoDrill) */
function perLineCandidates(bars){
  const big = [5, 4, 3].filter(n => n <= bars);
  const even = big.filter(n => bars % n === 0 && (n < 5 || bars >= 10));
  const rest = big.filter(n => n < 5 && bars % n !== 0 && bars % n !== 1);
  return [...new Set([...even, ...rest, 2])].filter(n => n <= bars);
}
/* 照 PianoDrill js/sight/app.js 的 fitScore:先決定每行幾小節(縮到放得下寬度),再看高度(整份在畫面裡;不小於 MIN_ZOOM);
   同形狀(級數、小節數、寬度分級)沿用同一個排法與大小,下一題比較密要更小才放得下就一起縮(只縮不放大) */
function fitScore(c){
  const total = c.test.bars, shape = `${c.grade}:${total}:${widthClass()}`, cached = SS.layout[shape];
  if (cached && cached.zoom) {
    const r = renderAt(cached.measuresPerLine, cached.zoom);
    if (cached.measuresPerLine === 0 || matchesRequestedLayout(r.layout, cached.measuresPerLine, total)) {
      if (r.fitsHeight || cached.zoom <= MIN_ZOOM + 0.001 || cached.measuresPerLine === 0) { lastLayout = { ...cached, systems: r.layout.systems.length }; return; }
    }
  }
  let chosen = null;
  for (const n of perLineCandidates(total)) {
    const fits = z => matchesRequestedLayout(renderAt(n, z).layout, n, total);
    if (!fits(MIN_ZOOM)) continue;
    let lo = MIN_ZOOM, hi = MAX_ZOOM;
    if (fits(MAX_ZOOM)) lo = MAX_ZOOM;
    else for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    let z = lo, r = renderAt(n, z);
    for (let k = 0; k < 4 && !r.fitsHeight && z > MIN_ZOOM + 0.001; k++) {
      z = Math.max(MIN_ZOOM, z * Math.min(0.97, availableScoreHeight() / Math.max(1, renderedScoreHeight())));
      r = renderAt(n, z);
    }
    chosen = { measuresPerLine: n, zoom: Math.round(z * 1000) / 1000 };
    break;
  }
  if (!chosen && total >= 2) {
    const fits = z => matchesRequestedLayout(renderAt(2, z).layout, 2, total);
    for (const z of [0.5, MIN_ZOOM_DENSE]) if (fits(z)) { chosen = { measuresPerLine: 2, zoom: z }; break; }
  }
  if (!chosen) chosen = { measuresPerLine: 0, zoom: MIN_ZOOM_DENSE };   // 還是放不下:交給 OSMD 自己換行
  if (cached && cached.zoom && cached.measuresPerLine === chosen.measuresPerLine) chosen.zoom = Math.min(chosen.zoom, cached.zoom);
  const r = renderAt(chosen.measuresPerLine, chosen.zoom);
  SS.layout[shape] = chosen; save();
  lastLayout = { ...chosen, systems: r.layout.systems.length };
}
let resizeTimer = 0, lastW = innerWidth;
window.addEventListener("resize", () => {
  if (!active || !cur || innerWidth === lastW) return;   // 只看寬度(iOS 捲動時網址列收放只改高度)
  lastW = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (active && mode === "free") drawCurrent(); }, 200);
});
/* 準備、正式打、播放時把樂譜卡捲到頂欄下(譜要在畫面上) */
function bringScoreIntoView(){
  const header = document.querySelector("header"), top = header ? header.getBoundingClientRect().bottom : 0;
  const card = $("scoreCard").getBoundingClientRect();
  if (Math.abs(card.top - top - 8) < 4) return;
  window.scrollTo({ top: Math.max(0, scrollY + card.top - top - 8), behavior: "smooth" });
}

/* ══ 聲音:小鼓取樣 + 拍點(js/shared/audio.js;不用合成鼓聲)══ */
let sampleJob = null;
function preload(){
  if (!sampleJob) sampleJob = (async () => {
    try { await audio.loadKit(["snare"]); await audio.loadClick(); return true; }
    catch (e) { sampleJob = null; return false; }
  })();
  return sampleJob;
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
/* 叫醒音訊、等取樣;回傳 false = 不能播(取樣沒載到、等的時候離開了 / 換題了) */
async function ready(){
  const token = starting = Date.now() + Math.random(), c0 = cur;
  const actx = audio.ensureAudio();
  if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
  if (!sampleJob) say(() => tr("載入小鼓取樣…", "Loading snare samples…"));
  const ok = await preload();
  await within(audio.masterReady, 1500);
  const still = starting === token && active && cur === c0;
  if (starting === token) starting = 0;
  if (!ok) { say(() => tr("小鼓取樣載入失敗,再按一次重試(需要網路,之後會存在裝置上)", "Could not load the snare — try again (needs internet once; then cached)")); return false; }
  return still;
}

/* 一個播放器:準備時的節拍器、正式打(只有拍點,學生自己打)、聽正確版本 */
const player = createPlayer({
  onTick: beat => {
    if (playKind === "metro") { tempo.showBeat(beat, 0); return; }
    tempo.showBeat(beat, COUNT_IN);
    if (!cur) return;
    const len = cur.test.lenBeats;
    if (beat < 0) {
      const n = Math.min(COUNT_IN, Math.ceil(-beat));
      if (n !== countShown) { countShown = n; say(() => tr(`預備拍 ${n}`, `Count-in ${n}`)); }
      return;
    }
    if (countShown !== 0) { countShown = 0; say(() => (playKind === "perform" ? tr("正式打中…", "Performing…") : tr("正確版本播放中…", "Playing the correct version…"))); }
    if (!stage) return;
    if (beat < len) stage.update(Math.floor(beat / 4) + 1, (beat % 4) / 4);
    else stage.update(cur.test.bars, 1);
  },
  onEnd: () => {
    const k = playKind; playKind = null; tempo.showBeat(null);
    if (k === "perform") finishPerform();
    else if (k === "listen") { endListenUI(); say(() => tr("播完了。可以再正式打一次,或換新題目。", "Done. Perform again, or try a new test.")); }
  },
  onStop: () => {   // 播放器自己停(頁面切到背景):按鈕回到原本的樣子
    const k = playKind; playKind = null; tempo.showBeat(null);
    if (k === "perform") abortPerform();
    if (k === "listen") endListenUI();
  }
});
let countShown = null;
function stopPlayer(){ const k = playKind; playKind = null; player.stop(true); tempo.showBeat(null); return k; }

/* ── 準備(官方 90 秒:準備加練習;節拍器可開可關;鼓墊可以試打,不計分)── */
function startPrep(){
  if (!cur) return;
  if (phase === "prep") { endPrep(false); return; }   // 「結束準備」
  if (phase === "perform") stopPerform();
  if (playKind === "listen") stopListening();
  phase = "prep"; left = cur.spec.prepSec; prepStarted = performance.now();
  lastResult = null;   // 上一次的練習回饋清掉(換語言時 renderResult 不會把它叫回來)
  $("countdown").hidden = false; $("countdown").className = "countdown running"; $("countdownValue").textContent = String(left);
  showFloat(left);
  showChecklist("prep");
  $("alongResult").hidden = true;
  renderPrepareLabel();
  say(() => tr("準備中:看譜,在鼓墊上試打(不計分)。", "Preparing: read it and try it on the pad (not scored)."));
  bringScoreIntoView();
  clearInterval(countdown);
  countdown = setInterval(() => {
    left -= 1;
    $("countdownValue").textContent = String(Math.max(0, left)); showFloat(Math.max(0, left));
    if (left <= 0) endPrep(true);
  }, 1000);
  if (SS.metroPractice) startMetro();
}
async function startMetro(){
  if (!(await ready()) || phase !== "prep" || !SS.metroPractice || playKind) return;
  const b = bpmNow(), beats = Math.ceil((left + 2) * b / 60);
  const t0 = player.play({ events: [], lenBeats: beats, bpm: b, countInBeats: 0, click: x => (x % 4 === 0 ? 2 : 1) });
  if (t0 > 0) playKind = "metro";
}
/* done = 時間到;false = 提早結束 / 離開 */
function endPrep(done){
  if (phase !== "prep") return;
  clearInterval(countdown); countdown = 0;
  if (playKind === "metro") stopPlayer();
  $("prepFloat").hidden = true;
  addSec((performance.now() - prepStarted) / 1000);
  phase = done ? "ready" : "idle";
  $("countdown").className = done ? "countdown done" : "countdown";
  if (!done) $("countdownValue").textContent = String(cur ? cur.spec.prepSec : 90);
  renderPrepareLabel();
  if (done) say(() => tr("準備時間到。按「正式打」;錯了不要停,繼續往下打。", "Time's up. Tap Perform — keep going after a slip."));
  else if (active) say(() => tr("看譜準備好就按「準備」;也可以直接「正式打」。", "Start the prep when ready, or go straight to Perform."));
}
function showFloat(sec){
  $("prepFloatValue").textContent = String(sec);
  $("prepFloat").classList.toggle("low", sec <= 5);
  placeFloat();
}
/* 浮動倒數:題目卡的倒數看得到時不顯示(寬螢幕頁面捲不動、題目卡還在畫面上);放在頂欄下的右邊,碰到 ▶ 就移到 ▶ 下面 */
function placeFloat(){
  const f = $("prepFloat");
  if (phase !== "prep" || !active) { f.hidden = true; return; }
  const header = document.querySelector("header"), top = header ? header.getBoundingClientRect().bottom : 0;
  const bar = document.getElementById("tabbar"), bb = bar ? bar.getBoundingClientRect() : null;
  const bottom = bb && bb.top > innerHeight / 2 ? bb.top : innerHeight;
  const cd = $("countdown").getBoundingClientRect();
  if (cd.height > 0 && cd.top >= top && cd.bottom <= bottom) { f.hidden = true; return; }
  f.hidden = false;
  let y = top + 8;
  f.style.top = `${Math.round(y)}px`;
  const fr = f.getBoundingClientRect(), p = $("play").getBoundingClientRect();
  if (p.height && p.bottom > fr.top && p.top < fr.bottom && p.right > fr.left && p.left < fr.right) { y = p.bottom + 8; f.style.top = `${Math.round(y)}px`; }
}
window.addEventListener("scroll", () => { if (phase === "prep" && active) placeFloat(); }, { passive: true });
$("prepare").onclick = () => startPrep();
$("generate").onclick = () => newTest();

/* ── 正式打:預備拍 1 小節(推估)+ 拍點(可關);鼓墊的時間扣掉第一拍 → 從第一拍算起的秒數 ── */
async function startPerform(){
  if (!cur || starting) return;
  if (phase === "perform") { stopPerform(); return; }
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer(), endListenUI();
  if (!(await ready())) return;
  if (playKind || phase === "perform") return;
  const b = bpmNow(), len = cur.test.lenBeats;
  const t0 = player.play({ events: [], lenBeats: len + TAIL, bpm: b, countInBeats: COUNT_IN,
    click: x => (x >= len ? 0 : x < 0 ? (x === -COUNT_IN ? 2 : 1) : SS.clickPerform ? (x % 4 === 0 ? 2 : 1) : 0) });
  if (!(t0 > 0)) return;   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "perform"; phase = "perform"; countShown = null;
  perf = { t0, bpm: b, taps: [], startedAt: performance.now() };
  lastResult = null; $("alongResult").hidden = true; showChecklist(null);
  renderAlongLabel(); renderPrepareLabel();
  if (stage) stage.begin();
  bringScoreIntoView();
}
/* 中途停止:不算分 */
function stopPerform(){
  if (phase !== "perform") return;
  if (playKind === "perform") stopPlayer();
  abortPerform();
}
function abortPerform(){
  if (phase !== "perform") return;
  if (perf) addSec((performance.now() - perf.startedAt) / 1000);
  perf = null; phase = "idle"; stage && stage.end();
  renderAlongLabel(); renderPrepareLabel();
  if (active) say(() => tr("停止了(這一次不算)。", "Stopped (not counted)."));
}
/* 打完:照題目的每一個音評節奏(js/shared/timing.js;扣掉整體的固定延遲)→ 練習回饋 + 自我檢查;算一題練習 */
function finishPerform(){
  if (!perf || !cur) return;
  const p = perf, beatSec = 60 / p.bpm;
  perf = null; phase = "result"; if (stage) stage.end();
  const taps = p.taps.filter(x => x.time >= -beatSec / 2);   // 預備拍裡太早的不算
  const r = scoreLanes(expectedByLane(cur.test.events, p.bpm, LANES[1]), taps, { tempoBpm: p.bpm });
  lastResult = { r, taps: taps.length, bpm: p.bpm, practice: !officialBpm(p.bpm) };
  const st = SS.stats[cur.key] || (SS.stats[cur.key] = { n: 0, hits: 0, total: 0 });
  st.n++;
  if (taps.length) { st.hits += r.hits; st.total += r.total; }   // 沒有敲鼓墊(例如在真的鼓上打):只算題數,不算進命中率
  addSec((performance.now() - p.startedAt) / 1000, 1);
  renderAlongLabel(); renderPrepareLabel();
  renderResult();
  showChecklist("self");
  say(() => tr("打完了。看下面的練習回饋與自我檢查;可以按 ▶ 聽正確版本對照。", "Done. See the feedback and self-check below; tap ▶ to hear the correct version."));
  if (ctx) ctx.examChanged();
}
/* 練習回饋(不是考試分數,不出現等第字眼,也不換算成官方分數) */
function renderResult(){
  const box = $("alongResult"), R = lastResult;
  if (!R) { box.hidden = true; return; }
  const r = R.r;
  box.innerHTML = "";
  const add = (cls, fn) => { const p = document.createElement("p"); if (cls) p.className = cls; box.appendChild(p); pairText(p, fn); return p; };
  add("r-head", () => tr("練習回饋 · 節奏(觸控鼓墊)", "Practice feedback · rhythm (touch pad)"));
  if (!R.taps) {
    add("", () => tr("沒有收到鼓墊的敲擊。正式打時點鼓墊,或用鍵盤 J / F。", "No pad hits came in. Tap the pad while you perform, or use keys J / F."));
  } else {
    const big = document.createElement("div"); big.className = "big"; box.appendChild(big);
    big.innerHTML = `${r.score == null ? "—" : r.score}<small></small>`;
    pairText(big.querySelector("small"), () => tr("/ 100 節奏吻合度", "/ 100 rhythm match"));
    add("", () => tr(`命中 ${r.hits} / ${r.total} · 漏 ${r.missed} · 多 ${r.extra} · 平均差 ${r.meanErrorMs} 毫秒(容許 ±${r.toleranceMs} 毫秒)`,
      `Hit ${r.hits} / ${r.total} · missed ${r.missed} · extra ${r.extra} · average ${r.meanErrorMs} ms off (±${r.toleranceMs} ms allowed)`));
    const off = offsetNote(r);
    if (off) add("", () => tr(off[0], off[1]));
  }
  add("disclaimer", () => tr(`只看敲擊的時間,不看力度與音色;容許範圍是練習設定。這是練習回饋,不是考試分數,也不能換算成官方分數。${R.practice ? `這一次用練習速度 ♩=${R.bpm}。` : ""}`,
    `Timing only (not dynamics or tone); the tolerance is a practice setting. This is practice feedback, not an exam mark, and it doesn't convert to one.${R.practice ? ` Practice tempo ♩=${R.bpm} this time.` : ""}`));
  box.hidden = false;
}
$("playAlong").onclick = () => startPerform();

/* ── 觸控鼓墊(1 個 = 小鼓;鍵盤 J / F):正式打時記時間,其他時候試打(出聲、不計分)── */
const pads = createPads($("pads"), LANES[1], ({ lane, time }) => {
  if (time == null) return;
  audio.playKit("snare", Math.max(time, audio.audioNow()), 0.72);
  if (phase === "perform" && perf) perf.taps.push({ lane, time: time - perf.t0 });
});

/* ── 聽正確版本(預備拍 1 小節 + 拍點照「正式打的拍點」設定)── */
async function toggleListen(){
  if (!cur || starting) return;
  if (playKind === "listen") { stopListening(); return; }
  if (phase === "perform") stopPerform();
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer();
  if (!(await ready())) return;
  if (playKind || phase === "perform") return;
  const b = bpmNow(), len = cur.test.lenBeats;
  const t0 = player.play({ events: cur.test.events, lenBeats: len, bpm: b, countInBeats: COUNT_IN,
    click: x => (x < 0 ? (x === -COUNT_IN ? 2 : 1) : SS.clickPerform ? (x % 4 === 0 ? 2 : 1) : 0) });
  if (!(t0 > 0)) return;   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "listen"; countShown = null;
  setPlayState(true);
  if (stage) stage.begin();
  bringScoreIntoView();
}
function stopListening(){ if (playKind === "listen") stopPlayer(); endListenUI(); }
function endListenUI(){ setPlayState(false); if (stage) stage.end(); }
function setPlayState(on){
  $("play").classList.toggle("is-active", on);
  $("playIcon").setAttribute("d", on ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
}
$("play").onclick = () => toggleListen();

/* 全部停下來(離開、換題、換級數):播放、準備的倒數、正式打(不算分) */
function stopAll(){
  starting = 0;
  if (phase === "prep") endPrep(false);
  if (phase === "perform") stopPerform();
  if (playKind) stopPlayer();
  endListenUI();
  clearInterval(countdown); countdown = 0;
  $("prepFloat").hidden = true;
}

/* ══ 練習紀錄:正式打完一題算一題;準備與正式打的時間算進今天的秒數(保留 400 天)══ */
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function addSec(sec, n = 0){
  const k = dayKey(new Date()), e = SS.log[k] || (SS.log[k] = { n: 0, sec: 0 });
  e.n += n; e.sec += Math.round(Math.max(0, sec || 0));
  const keys = Object.keys(SS.log).sort();
  while (keys.length > 400) delete SS.log[keys.shift()];
  save(); renderLog();
}
function renderLog(){
  const log = SS.log || {}, today = new Date();
  let streak = 0; const d = new Date(today);
  if (!(log[dayKey(d)] && log[dayKey(d)].n)) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)] && log[dayKey(d)].n) { streak++; d.setDate(d.getDate() - 1); }
  $("logStreak").textContent = streak;
  $("logToday").textContent = (log[dayKey(today)] || { n: 0 }).n;
  $("logTotal").textContent = Object.values(SS.stats).reduce((s, x) => s + (x.n || 0), 0);
  const names = getLang() === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["日", "一", "二", "三", "四", "五", "六"];
  let html = "";
  for (let i = 6; i >= 0; i--) {
    const x = new Date(today); x.setDate(x.getDate() - i);
    const e = log[dayKey(x)];
    html += `<span class="${i === 0 ? "today" : ""}"><i class="${e && e.n ? "on" : ""}"></i>${names[x.getDay()]}</span>`;
  }
  $("logWeek").innerHTML = html;
}
