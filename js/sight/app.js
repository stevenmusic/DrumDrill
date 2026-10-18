/* 視奏模組(docs/STAGES.md S8 + S9 + S10/S11 的介面;卡片、id、流程照 PianoDrill 的視奏:js/sight/app.js、stage.js、docs/sight/CLAUDE.md)。
   外框(js/main.js)負責頂欄、分頁、考試設定與語言;這裡的元素 id 都加 "s-" 前綴。
   - 子項目 = 級數 0–8(外框的子項目列;沒選考試時用 RSL)。三種題目(mode):
       snare    RSL Debut–3 小鼓視奏(js/sight/gen.js,照 data/exam-rsl.json sight[g];單線譜、1 個鼓墊)
       kit      RSL 4–5 整組鼓視奏(js/shared/kitgen.js genRslKit;五線鼓組譜、最後 2 小節自由發展〔斜線,推估〕播放只有拍點、3 個鼓墊)
       playback Trinity Initial–8:Rock & Pop 沒有視奏;Session skills Playback 的看譜練習(js/shared/playbackgen.js genChart;
                30 秒看譜〔官方 p.60〕→ 跟拍點打一遍 → 聽正確版本;速度官方沒寫,預設 ♩=80 = 練習設定;官方配伴奏音軌,App 只有拍點)
     RSL 6–8 Quick Study Piece(拍號、時值、速度大綱沒寫)不出題,只有說明 + 規格卡 + 「用 5 級整組鼓參數練讀譜」;I&I(1–5 級)只列規格
   - 流程:出題 → 準備(RSL 90 秒 / Trinity 看譜 30 秒,官方;節拍器可開可關;可以在鼓墊上試打,不計分)
     → 正式打(預備拍:第一小節的拍號 1 小節〔長度推估〕;拍點可開關;鼓墊 / 鍵盤)→ 結果(鼓墊的節奏回饋〔練習回饋,不是考試分數〕+ 自我檢查清單)
     → 聽正確版本(js/shared/player.js + js/shared/kitevents.js toEvents〔力度的播放音量是練習設定〕;stage.js 畫目前小節的底色與播放軸)
   - 拍點、小節時間軸(換拍號、複拍子):js/sight/meter.js;有 x/8 的譜播放器用八分音符當一拍
   - 整組鼓取樣:audio.loadKit(這一題用到的鼓件);載入時 ▶ 外圈畫進度、▶ 與正式打先不能按(載完才能開始);離開模組 60 秒後 audio.unloadKit()(回來就取消)
   - 譜像印出來的考卷(PianoDrill 的 fitScore:每行 4 小節、放不下再縮,不小於 0.55;每行 2 小節的最後手段 0.45;同形狀的題目同一個排法與大小、只縮不放大);
     js/shared/kitnotation.js(單線 / 五線)+ 圖例(js/shared/legend.js,每一份譜都有)
   - 檢定頁:考試摘要 + 規格卡(照官方大綱,每項頁碼);不放練習紀錄、練習回饋(不跟配分、等第同一個畫面)
   - leave():停止播放、準備的倒數、正式打(不算分),題目保留;relang():只重寫文字,不停播放
   - localStorage drumdrill.sight.v1:{ pick, metroPractice, clickPerform, bpmOverride:{ "rsl-3": 75, "trinity-4": 96 }, history(出過的題目指紋),
     stats:{ "rsl-3": {n, hits, total} }, log:{ 日期: {n, sec} }, layout:{ 形狀: {measuresPerLine, zoom} } }
     讀進來先消毒:bpmOverride 夾在 30–240、不是有限數的刪掉;layout 每一項 zoom 夾在 0.45–1、每行小節數不對的刪掉 */
import { tr, T as TS, scoped, getLang, pairText } from "../shared/i18n.js";
import { playbackFor } from "../shared/examdata.js";
import * as V from "../shared/examview.js";
import * as audio from "../shared/audio.js";
import { createPlayer } from "../shared/player.js";
import { createPads } from "../shared/pad.js";
import { LANES, expectedByLane, scoreLanes, offsetNote, laneNote } from "../shared/timing.js";
import { scoreXML, osmdXML, piecesUsed } from "../shared/kitnotation.js";
import { setupKit, decorate, drawLegend } from "../shared/legend.js";
import { toEvents, hitsOnly, specBeats, EVENT_NOTES } from "../shared/kitevents.js";
import { genRslKit, SIGHT_KIT_GRADES, NOTES as KIT_NOTES } from "../shared/kitgen.js";
import { genChart, playbackParams, NOTES as PB_NOTES } from "../shared/playbackgen.js";
import { createTempo } from "../shared/tempo.js";
import { createStage } from "./stage.js";
import { genSnare, SNARE_GRADES } from "./gen.js";
import { timeline, clickAt, barAt } from "./meter.js";
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
let cur = null;               // { key:"rsl-3", sys, grade, kind:"snare"|"kit"|"playback", spec(出題參數), test, xml }
let phase = "idle";           // idle | prep | ready(準備時間到)| perform | result
let left = 0, countdown = 0, prepStarted = 0;
let perf = null;              // 正式打:{ t0, bpm, taps:[{lane, time}], startedAt }
let playKind = null;          // 播放器正在播的:"metro"(準備時節拍器)| "perform" | "listen"
let lastResult = null;
let lastMsg = null;
let starting = 0;

const curExam = () => exam || { system: "trinity", grade: 1, auto: true };
/* 自由練習:沒選考試時用 RSL(外框的子項目列也照這個寫 D);檢定頁照考試 */
const sysNow = () => (mode === "exam" || !curExam().auto ? curExam().system : "rsl");
const gradeNow = () => (mode === "exam" ? curExam().grade : freeGrade);
const keyOf = (sys, g) => `${sys}-${g}`;
const dataOf = sys => (ctx && ctx.examData ? ctx.examData(sys) : null);
const drumKey = () => (ctx && ctx.drumKey ? ctx.drumKey() : null);
const specOf = (sys, g) => (sys === "rsl" && dataOf("rsl") && dataOf("rsl").sight ? dataOf("rsl").sight[g] : null);
/* 這一級出哪一種題目(null = 不出題:RSL 6–8 的 Quick Study Piece、資料還沒載好) */
function kindOf(sys, g){
  if (sys === "rsl") {
    const s = specOf(sys, g);
    if (!s) return null;
    if (s.type === "snare" && SNARE_GRADES.includes(g)) return "snare";
    if (s.type === "kit" && SIGHT_KIT_GRADES.includes(g)) return "kit";
    return null;
  }
  const d = dataOf("trinity");
  return sys === "trinity" && d && d.playback && playbackFor(g, d) ? "playback" : null;
}
const practicable = (sys, g) => !!kindOf(sys, g) && !!drumKey();
/* 出題參數:RSL = sight[g];Trinity = Playback 的累積白名單 + 這一級新增的(playbackParams) */
const paramsOf = (sys, g, kind) => (kind === "playback" ? playbackParams(g, dataOf("trinity")) : specOf(sys, g));
const sysName = sys => (sys === "rsl" ? "RSL" : "Trinity");
const gl = (g, sys) => (ctx ? ctx.gradeLabel(g, sys) : String(g));
const PB_BPM = 80;            // Trinity Playback 的預設速度(練習設定:官方沒寫速度)
const TAIL = 0.75;            // 最後一拍之後多收幾拍的敲擊(最後一個音晚一點也算得到)
const UNLOAD_MS = 60000;      // 離開視奏多久釋放整組鼓(docs/STAGES.md 決定 11)
let unloadMs = UNLOAD_MS;     // 測試可以改短(kitaudio.mjs:__sight.unloadMs)
/* 鼓墊的鍵盤字(1 個鼓墊:J / F;3 個:F / J / K) */
const keysText = ls => (ls.length === 1 ? [].concat(ls[0].key) : ls.map(l => [].concat(l.key)[0])).map(k => k.toUpperCase()).join(" / ");
const isKitKind = k => k === "kit" || k === "playback";
const lanesOf = c => (c && isKitKind(c.kind) ? LANES[3] : LANES[1]);

/* ══ 外框呼叫 ══ */
export async function start(c){
  ctx = c; exam = c.exam;
  renderLog();
  window.__sight = {
    get state(){ const p = player.state; return { phase, play: p.playing, kind: playKind, timer: !!countdown, left, key: cur && cur.key, grade: cur && cur.grade, mode: cur && cur.kind,
      bpm: cur ? bpmNow() : null, drawn, pending: pendingDraw, systems: stage ? stage.systems : 0, loading, loaded: sampleOk, lanes: pads.lanes.length,
      result: lastResult ? { ...lastResult.r, taps: lastResult.taps } : null, taps: perf ? perf.taps.length : 0, unloadPending: !!unloadTimer,
      sent: p.sent, failed: p.failed, dropped: p.dropped }; },
    get test(){ return cur && cur.test; }, get xml(){ return cur && cur.xml; }, get osmd(){ return osmd; }, get timeline(){ return cur && cur.test.tl; },
    eventsAt: b => (cur ? eventsAt(b) : []),
    newTest, startPrep, startPerform, toggleListen, setBpm: v => setBpm(v), SS,
    /* 測試用:正式打中馬上結束、照目前收到的敲擊出結果(Trinity 8 級一首要打很久;layout / bilingual / clip 看結果畫面用) */
    finishNow(){ if (phase === "perform" && playKind === "perform") { playKind = null; player.stop(true); tempo.showBeat(null); finishPerform(); } }, get layout(){ return lastLayout; }, perfT0: () => (perf ? perf.t0 : null),
    get unloadMs(){ return unloadMs; }, set unloadMs(v){ unloadMs = Number(v) > 0 ? Number(v) : UNLOAD_MS; }
  };
  window.__playback = { get playing(){ return player.state.playing; } };   // human.mjs:「不在畫面上的模組沒有在播放」
}
export function enter(t){
  active = true;
  clearTimeout(unloadTimer); unloadTimer = 0;   // 回來了:不釋放整組鼓
  mode = t === "exam" ? "exam" : "free";
  if (mode === "free" && /^[0-8]$/.test(String(t))) freeGrade = Number(t);
  const had = cur;
  render();
  // 同一題:在別的分頁時延後的譜、寬度變了的,回到畫面再畫(新題目 render 裡已經畫了);整組鼓被釋放過就重新載
  if (mode === "free" && cur && cur === had && !$("quiz").hidden) {
    if (pendingDraw || innerWidth !== renderedWidth) requestAnimationFrame(() => drawCurrent());
    preload();
  }
  if (mode === "free" && cur && !$("quiz").hidden) requestAnimationFrame(() => { if (active) fitTitle(); });
}
/* 離開(切分頁、切到背景):停止播放、準備的倒數、正式打(不算分);題目保留。60 秒後還沒回來就釋放整組鼓(小鼓保留) */
export function leave(){
  active = false; stopAll();
  clearTimeout(unloadTimer);
  unloadTimer = setTimeout(releaseKit, unloadMs);
}
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
  const ex = curExam(), n = (SS.stats[keyOf(ex.system, ex.grade)] || {}).n || 0;
  if (ex.system === "trinity") return tr(`Playback 看譜 ${n} 題`, `Playback charts: ${n}`);
  if (ex.grade <= 5) return tr(`已練 ${n} 題`, `${n} practised`);
  return tr("只列規格", "Spec only");
}
export function onKey(e){
  if (mode === "exam" || !cur || $("quiz").hidden) return;
  if (pads.key(e)) return;   // J / F(小鼓)、F / J / K(鈸 / 鼓 / 大鼓與腳踩 HH)= 鼓墊
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

/* 這一級 / 這個考試沒有視奏練習(或資料還沒到):說明 + 官方規格卡(不出題) */
function renderUnsupported(sys, g){
  $("unsupported").hidden = false;
  const d = dataOf(sys), name = () => `${sysName(sys)} ${gl(g, sys)}`;
  let title, text;
  if (!d) {
    title = () => tr("考試資料還沒載好", "Exam data not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。", "Needs internet once; then it's cached.");
  } else if (kindOf(sys, g) && !drumKey()) {
    // 有練習的級數,只是圖例資料(data/drumkey.json)還沒到
    title = () => tr("圖例資料還沒載好", "Drum key not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。下面是官方規格。", "Needs internet once; then it's cached. Official spec below.");
  } else if (sys === "trinity") {
    title = () => tr("Rock & Pop 沒有視奏", "No sight-reading in Rock & Pop");
    text = () => tr("Trinity Rock & Pop 沒有視奏項目;最接近的是 Session skills 的 Playback(有譜)。下面是官方規格。",
      "Trinity Rock & Pop has no sight-reading test; the closest is Playback in Session skills (with a chart). Official spec below.");
  } else {
    title = () => tr("Quick Study Piece:只列規格", "Quick Study Piece: spec only");
    text = () => tr(`${name()} 考 Quick Study Piece:要伴奏音軌和 lead sheet,拍號、時值、速度大綱沒寫,App 不出題。可以先用 5 級整組鼓視奏的參數練讀譜。`,
      `${name()} has a Quick Study Piece: it needs a backing track and lead sheet, and the metre, values and tempo aren't stated, so the App sets no tests. You can practise reading with the Grade 5 kit parameters.`);
  }
  V.pairStack($("unsupportedTitle"), title);
  pairText($("unsupportedText"), text);
  pairText($("unsupportedNote"), () => TS("practiceOnly"));
  $("specCards").hidden = !d; $("specCards").innerHTML = "";
  if (d) { if (sys === "rsl") renderRsl(d, g, false); else renderTrinity(d, g, false); }
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
  if (sys === "rsl") renderRsl(d, g, true); else renderTrinity(d, g, true);
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
/* 「去練習」按鈕(帶到視奏分頁的某一級) */
function goButton(c, label, grade){
  const b = document.createElement("button");
  b.className = "xcat s-go"; b.type = "button";
  b.innerHTML = '<span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  pairText(b.querySelector("span"), label);
  b.onclick = () => ctx.showView("sight", String(grade));
  const w = document.createElement("div"); w.className = "xcats"; w.appendChild(b); c.appendChild(w);
  return b;
}

/* withPractice = 檢定頁:有出題的級數加「練習這一級的視奏」(帶到視奏分頁的那一級) */
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
      s.type === "kit" && { k: () => tr("App 用的鼓件", "App's kit"), v: () => V.pieces(["hh", "ride", "crash", "snare", "tomHi", "tomMid", "tomFloor", "kick"], key) + V.assumed() },
      { k: () => tr("速度", "Tempo"), v: () => V.bpmText(s.bpm), src },
      { k: () => tr("準備時間", "Preparation"), v: () => V.secText(s.prepSec) + tr("(準備加練習)", " (study and try)"), src },
      { k: () => tr("節拍器", "Metronome"), v: () => tr("練習時可以開或關", "On or off while preparing"), src },
      { k: () => tr("預備拍、伴奏", "Count-in, backing"), v: notStated }
    ]);
    V.addPara(c, () => V.L(d.sightNote[s.type]));
    V.addPara(c, () => V.L(d.sightNote.examples));
    if (withPractice && !curExam().auto && kindOf("rsl", g)) goButton(c, () => tr("練習這一級的視奏(App 出題)", "Practise this grade (App tests)"), g);
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
    V.addPara(c, () => tr("要伴奏音軌和 lead sheet,拍號、時值、速度大綱也沒寫:App 不出這一項的題目。", "Needs a backing track and lead sheet, and the metre, values and tempo aren't stated: the App sets no tests for it."));
    // 練讀譜:帶到 RSL 5 級的整組鼓視奏(標明是 5 級的參數,不是 QSP)
    if ((!withPractice || !curExam().auto) && kindOf("rsl", 5)) goButton(c, () => tr("用 5 級整組鼓參數練讀譜(5 級參數,不是 QSP)", "Practise reading with Grade 5 kit parameters (not a QSP)"), 5);
  }
}

/* Trinity:Rock & Pop 沒有視奏;Playback 的規格(累積白名單)+「練習 Playback 看譜」(App 依參數出的看譜練習) */
function renderTrinity(d, g, withPractice){
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
  V.addPara(c, () => tr("App 的「Playback 看譜」:依這一級的參數出 song chart,看譜 30 秒、跟拍點打一遍、聽正確版本。官方配伴奏音軌;App 只有拍點。速度官方沒寫,預設 ♩=80(練習設定)。",
    "The App's Playback chart practice: a song chart from this grade's parameters — 30 s to study, play it once with a click, hear it back. The exam has a backing track; the App has a click only. Tempo isn't stated: ♩=80 by default (practice setting)."));
  if (withPractice && kindOf("trinity", g)) {
    if (curExam().auto) V.addPara(c, () => tr("在上面選 Trinity 考試,就可以練 Playback 看譜。", "Choose the Trinity exam above to practise Playback charts."));
    else goButton(c, () => tr("練習 Playback 看譜(App 出題)", "Practise Playback charts (App tests)"), g);
  }
}
const range = r => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

/* ══ 出題 ══ */
/* 三種出題器的結果整理成同一個格式:{ grade, time, bars, measures(指紋用), lines, score(kitnotation 的 spec), events(小鼓:固定)
   lenBeats, bpm(這一題的預設速度), bpmRange(官方;Trinity null), develop, notes(說明 key), src, tl(meter.js 的時間軸)};
   整組鼓的題目帶 system(指紋多看鼓件與記號;小鼓維持原本的指紋) */
function makeTest(kind, P, seed, g){
  let t;
  if (kind === "snare") {
    const s = genSnare(P, seed, g);
    t = { ...s, lines: 1, score: { lines: 1, time: s.time, measures: s.measures }, develop: null, notes: null, src: V.srcOf("rsl", P.src.p) };
  } else if (kind === "kit") {
    const k = genRslKit(P, seed, g);
    t = { ...k, system: "rsl", lines: 5, score: k.spec, src: V.srcOf("rsl", P.src.p) };
  } else {
    const c = genChart(P, seed);
    t = { system: "trinity", grade: g, seed: c.seed, time: c.time, times: c.times, bars: c.totalBars, measures: c.spec.measures, dyn: c.spec.dyn,
      lines: 5, score: c.spec, develop: null, notes: c.notes, bpm: PB_BPM, bpmRange: null, lenBeats: specBeats(c.spec), chart: c,
      src: V.srcOf("trinity", c.src.join(", ")) };
  }
  t.tl = timeline(t.score);
  return t;
}
function newTest(){
  stopAll();
  const sys = sysNow(), g = gradeNow(), kind = kindOf(sys, g);
  if (!practicable(sys, g)) return;
  const P = paramsOf(sys, g, kind);
  let test;
  try { test = generateUnique(() => makeTest(kind, P, randomSeed(), g), history).score; }
  catch (e) { console.error(e); say(() => tr("出題失敗:", "Could not make a test: ") + e.message); return; }
  setTest(sys, g, kind, P, test);
}
/* 指定題目(測試用 __sight;同一個種子同一題) */
function setTest(sys, g, kind, P, test){
  SS.pick = { system: sys, grade: g }; save();
  cur = { key: keyOf(sys, g), sys, grade: g, kind, spec: P, test, xml: null, padCym: "hh" };
  if (kind !== "snare") cur.padCym = mainCymbal(eventsAt(bpmNow()));
  phase = "idle"; lastResult = null; perf = null;
  $("alongResult").hidden = true; showChecklist(null);
  $("countdown").hidden = false; $("countdown").className = "countdown"; $("countdownValue").textContent = String(prepSec());
  ensurePads();
  try { cur.xml = scoreXML({ ...test.score, key: drumKey() }); }
  catch (e) { console.error(e); say(() => tr("譜產生失敗:", "Could not build the score: ") + e.message); }
  $("prepare").disabled = !cur.xml;
  $("generate").disabled = false;
  tempoUI();
  refreshTexts();
  say(startMsg);
  drawCurrent();
  preload();
  syncButtons();
}
const startMsg = () => (cur && cur.kind === "playback"
  ? tr("先看譜 30 秒(按「看譜」);也可以直接「正式打」。", "Study the chart for 30 s (tap Study), or go straight to Perform.")
  : tr("看譜準備好就按「準備」;也可以直接「正式打」。", "Start the prep when ready, or go straight to Perform."));
/* 準備時間:RSL 90 秒(大綱 sight[g].prepSec)、Trinity Playback 看譜 30 秒(大綱 p.60 flow.studySec) */
function prepSec(){
  if (!cur) return 90;
  if (cur.kind === "playback") { const f = dataOf("trinity") && dataOf("trinity").playback.flow; return (f && f.studySec) || 30; }
  return cur.spec.prepSec;
}
const prepSrc = () => (cur && cur.kind === "playback" ? V.srcOf("trinity", dataOf("trinity").playback.flow.src.p) : cur ? V.srcOf("rsl", cur.spec.src.p) : "");
/* 播放、評分用的事件(拍子 = 四分音符):小鼓是出題器給的;整組鼓照速度重算(Flam / Drag 的提前量跟速度有關) */
const eventsAt = b => (cur.kind === "snare" ? cur.test.events : toEvents(cur.test.score, { bpm: b }));
const inDevelop = q => !!(cur && cur.test.develop && cur.test.develop.bars && q >= cur.test.tl.bars[cur.test.develop.from].start - 1e-6);

/* ── 速度:RSL 預設官方(範圍每題隨機);Trinity 官方沒寫 → 預設 ♩=80(練習設定)。使用者改了每一級各自記住(跟這一題的速度脫鉤,換題也照用);
   RSL 設在官方範圍外才是「練習速度」;Trinity 改了就是「練習速度」;官方 / 預設速度鈕清掉自己設的速度 ── */
const bpmNow = () => (cur ? (SS.bpmOverride[cur.key] || cur.test.bpm) : 80);
const officialRange = () => (cur && cur.kind !== "playback" ? cur.spec.bpm : null);
const officialBpm = b => { const r = officialRange(); return !!r && b >= r[0] && b <= r[r.length - 1]; };
const custom = () => !!(cur && SS.bpmOverride[cur.key]);
const overridden = () => custom() && !officialBpm(bpmNow());
const tempo = createTempo({ $, min: 30, max: 240, get: () => bpmNow(), set: v => setBpm(v) });
tempo.setBeats(4);
function setBpm(v){
  if (!cur || phase === "perform") return;   // 正式打中不改(評分照開始時的速度)
  if (!Number.isFinite(Number(v))) return;
  const b = Math.max(30, Math.min(240, Math.round(Number(v)))), r = officialRange();
  const fixed = r ? (r[0] === r[1] ? r[0] : null) : PB_BPM;
  if (fixed != null && b === fixed) delete SS.bpmOverride[cur.key]; else SS.bpmOverride[cur.key] = b;   // 固定速度(Trinity 的預設)設回原值 = 沒有自己設
  applyBpm();
}
/* 官方 / 預設速度鈕:清掉這一級自己設的速度 */
function resetBpm(){
  if (!cur || phase === "perform") return;
  delete SS.bpmOverride[cur.key];
  applyBpm();
}
function applyBpm(){
  save(); tempoUI();
  if (playKind === "listen") retempoListen();
  // 準備中的節拍器:長度是照開始時的速度算的(剩下的秒數 × 速度),照新速度重排一輪
  else if (playKind === "metro") { stopPlayer(); startMetro(); }
}
function tempoUI(){
  tempo.sync(`♩ / ${tr("分", "min")}`);
  if (!cur) return;
  const pb = cur.kind === "playback";
  $("bpmReset").textContent = pb ? tr("預設速度", "Default tempo") : T("bpmReset");
  if (pb) pairText($("tempoNote"), () => (custom() ? tr(`練習速度(官方沒寫速度;預設 ♩=${PB_BPM})`, `Practice tempo (not in the syllabus; default ♩=${PB_BPM})`)
    : tr(`預設 ♩=${PB_BPM} · ${TS("srcPractice")}(官方沒寫速度)`, `Default ♩=${PB_BPM} · ${TS("srcPractice")} (tempo not stated)`)));
  else {
    const off = V.bpmText(cur.spec.bpm), src = V.srcOf("rsl", cur.spec.src.p);
    pairText($("tempoNote"), () => (overridden() ? tr(`練習速度(官方 ${off})`, `Practice tempo (official ${off})`) : tr(`官方速度 ${off} · ${src}`, `Official ${off} · ${src}`)));
  }
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
const SCORE_TITLE = { snare: ["小鼓譜", "Snare part"], kit: ["整組鼓譜", "Kit part"], playback: ["Playback 譜", "Playback chart"] };
const KIND_LABEL = { assumed: () => TS("srcAssumed"), practice: () => TS("srcPractice"), omit: () => tr("不出", "Not set") };
function refreshTexts(){
  if (!cur) return;
  const c = cur, t = c.test;
  $("title").classList.remove("empty");
  $("title").textContent = `${sysName(c.sys)} ${gl(c.grade, c.sys)}`;
  $("scoreSub").textContent = t.src;
  $("scoreTitle").textContent = tr(...SCORE_TITLE[c.kind]);
  pairText($("practiceOnly"), () => (c.kind === "playback" ? tr(`依 Trinity Playback ${gl(c.grade, c.sys)}參數的練習 · `, `Practice by Trinity Playback ${gl(c.grade, c.sys)} parameters · `)
    : tr(`依 RSL ${gl(c.grade, c.sys)}參數的練習 · `, `Practice by RSL ${gl(c.grade, c.sys)} parameters · `)) + TS("practiceOnly"));
  // 題目卡上的說明:整組鼓的自由發展;Trinity 這是 Playback 的看譜練習(Rock & Pop 沒有視奏)
  const note = $("modeNote");
  note.hidden = c.kind === "snare";
  if (c.kind === "kit") {
    const a = t.develop.from + 1, b = t.develop.from + t.develop.bars;
    pairText(note, () => tr(`第 ${a}–${b} 小節是自由發展(斜線;位置是${TS("srcAssumed")}):照前面的風格自己打,不評分;播放時只有拍點。`,
      `Bars ${a}–${b} are the development (slashes; position ${TS("srcAssumed").toLowerCase()}): carry on in style — not scored; playback is click only.`));
  } else if (c.kind === "playback") {
    pairText(note, () => tr(`Rock & Pop 沒有視奏;這是 Session skills Playback 的看譜練習(${prepSrc()}:官方是聽一句打一句、配伴奏音軌)。App 只有拍點,整首跟拍點打一遍。`,
      `Rock & Pop has no sight reading: this is chart practice for Session skills Playback (${prepSrc()}: the exam is call-and-response with a backing track). The App has a click only; play the whole chart once.`));
  }
  tempoUI();
  renderPrepareLabel();
  renderAlongLabel();
  const ci = t.tl.countIn.bars, keys = keysText(lanesOf(c));
  pairText($("alongNote"), () => (c.kind === "playback"
    ? tr(`預備拍 ${ci} 小節(官方有預備拍;長度${TS("srcAssumed")})· 鍵盤 ${keys}`, `${ci}-bar count-in (count-in is official; length ${TS("srcAssumed").toLowerCase()}) · keys ${keys}`)
    : tr(`預備拍 ${ci} 小節(${TS("srcAssumed")}:大綱沒寫)· 鍵盤 ${keys}`, `${ci}-bar count-in (${TS("srcAssumed").toLowerCase()}: not stated) · keys ${keys}`)));
  renderConfidence();
  if (lastMsg) say(lastMsg);
  showChecklist(checkKind);
  renderResult();
  if (active) fitTitle();
}
/* 推估 / 練習設定 / 不出的說明(出題器的 NOTES 小字;每一題各自的) */
function renderConfidence(){
  const c = cur, t = c.test;
  if (c.kind === "snare") {
    const mixed = t.mixed, half = (c.spec.values || []).includes("2");
    pairText($("confidence"), () => tr(
      `拍號 4/4:大綱沒寫 Debut–3 級的拍號(推估)。預備拍 1 小節:大綱沒寫(推估)。節奏格怎麼組合成一拍、結尾停在四分或二分音符${half ? "、二分音符只放第 1、3 拍" : ""}、每小節至少 2 個音、每題至少一次本級最短時值${mixed ? "、一拍裡混合八分與十六分音符" : ""}:練習設定。`,
      `4/4: metre not stated for Debut–3 (assumed). 1-bar count-in: not stated (assumed). Beat patterns, ending on a crotchet or minim${half ? ", minims on beats 1 and 3 only" : ""}, 2+ notes a bar, the grade's shortest value at least once${mixed ? ", mixed quaver–semiquaver beats" : ""}: practice setting.`));
    return;
  }
  const items = [];
  if (c.kind === "kit") {
    for (const k of t.notes) if (KIT_NOTES[k]) items.push(KIT_NOTES[k]);
    items.push({ kind: "assumed", text: ["預備拍 1 小節:大綱沒寫", "1-bar count-in: not stated"] });
  } else {
    for (const k of t.notes) if (PB_NOTES[k]) items.push(PB_NOTES[k]);
    items.push(t.dyn && t.dyn.length ? EVENT_NOTES.velocity : EVENT_NOTES.pieceVel);
    items.push({ kind: "assumed", text: ["預備拍的長度(1 小節)大綱沒寫", "Count-in length (1 bar) not stated"] });
    items.push({ kind: "practice", text: ["拍點打在每一拍(複拍子打附點四分音符、2/2 打二分音符);速度用四分音符算", "Click on each beat (dotted crotchets in compound time, minims in 2/2); tempo in crotchets"] });
  }
  pairText($("confidence"), () => ["assumed", "practice", "omit"].map(kd => {
    const xs = items.filter(x => x.kind === kd);
    return xs.length ? `${KIND_LABEL[kd]()}${tr(":", ": ")}${xs.map(x => tr(x.text[0], x.text[1])).join(tr(";", "; "))}${tr("。", ".")}` : "";
  }).filter(Boolean).join(" "));
}
function renderMeta(){
  if (!cur) return;
  const t = cur.test, b = bpmNow(), pb = cur.kind === "playback";
  const metre = cur.kind === "snare" ? `4/4 · ${TS("srcAssumed")}` : pb ? t.times.join(" ") : t.time;
  const tags = [metre, tr(`${t.bars} 小節`, `${t.bars} bars`), pb ? `♩=${b} · ${custom() ? tr("練習", "Practice") : TS("srcPractice")}` : overridden() ? `♩=${b} · ${tr("練習", "Practice")}` : `♩=${b}`];
  $("meta").innerHTML = tags.map(x => `<span class="q-tag">${x}</span>`).join("");
  if (active) fitTags();
}
function renderSum(){
  if (!cur) return;
  const pb = cur.kind === "playback";
  $("sum").textContent = [`${sysName(cur.sys)} ${gl(cur.grade, cur.sys)}`, `♩=${bpmNow()}${overridden() ? " " + tr("練習速度", "practice") : pb ? " " + tr("練習設定", "practice") : ""}`,
    tr("節拍器", "Metronome") + " " + (SS.metroPractice ? tr("開", "on") : tr("關", "off"))].join(" · ");
}
function renderPrepareLabel(){
  const sec = prepSec(), pb = cur && cur.kind === "playback";
  const fn = () => (phase === "prep" ? (pb ? tr("結束看譜", "End study") : tr("結束準備", "End prep")) : pb ? tr(`看譜 ${sec} 秒`, `Study ${sec} s`) : tr(`準備 ${sec} 秒`, `Prep ${sec} s`));
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

/* ── 看譜重點(準備時)/ 自我檢查(結果出來後):App 的練習建議,不是考試要求(每種題目一樣多條,版面一樣)── */
const PREP_TIPS = {
  snare: [
    ["先看拍號、速度、小節數", "Check the metre, tempo and bar count"],
    ["找出最密的那一拍,用它決定速度", "Find the busiest beat and set the tempo by it"],
    ["休止符、二分音符要數滿", "Count rests and long notes in full"],
    ["在鼓墊上輕輕試打難的地方", "Try the tricky beats on the pad"],
    ["開節拍器跟著數拍子", "Count along with the metronome"],
    ["正式打時錯了不要停,繼續往下打", "When you perform, keep going after a slip"]
  ],
  kit: [
    ["先看速度、小節數、自由發展在哪裡", "Check the tempo, bars and where the development is"],
    ["對照圖例:每個鼓件在哪一線、哪一間", "Use the key: which line or space is each drum"],
    ["看懂律動:鈸、小鼓、大鼓各打什麼", "Read the groove: cymbal, snare and bass drum"],
    ["找出過門,想好從哪個鼓往哪個鼓走", "Find the fills and plan the drum moves"],
    ["自由發展照前面的風格打,不要停", "Keep the style going in the development"],
    ["正式打時錯了不要停,繼續往下打", "When you perform, keep going after a slip"]
  ],
  playback: [
    ["先看拍號、小節數,有沒有換拍號", "Check the metre, bars and any metre changes"],
    ["對照圖例:每個鼓件在哪一線、哪一間", "Use the key: which line or space is each drum"],
    ["找出每一句的開頭和過門", "Find where each phrase starts and its fill"],
    ["看力度、重音等記號", "Note the dynamics, accents and other marks"],
    ["在鼓墊上輕輕試打難的地方", "Try the tricky beats on the pad"],
    ["正式打時錯了不要停,繼續往下打", "When you perform, keep going after a slip"]
  ]
};
const SELF_CHECK = {
  snare: [
    ["從頭打到尾沒有停下來", "Kept going to the end without stopping"],
    ["速度穩定,沒有越打越快或越慢", "Steady tempo — no rushing or dragging"],
    ["休止符有空出來、二分音符有算滿", "Rests left empty, long notes held in full"],
    ["跟預備拍的速度一樣", "Played at the count-in tempo"]
  ],
  kit: [
    ["從頭打到尾沒有停下來", "Kept going to the end without stopping"],
    ["速度穩定,沒有越打越快或越慢", "Steady tempo — no rushing or dragging"],
    ["手腳同時的地方有一起下去", "Hands and feet landed together"],
    ["自由發展跟前面同一個風格", "The development kept the style"]
  ],
  playback: [
    ["從頭打到尾沒有停下來", "Kept going to the end without stopping"],
    ["速度穩定,沒有越打越快或越慢", "Steady tempo — no rushing or dragging"],
    ["手腳同時的地方有一起下去", "Hands and feet landed together"],
    ["力度、重音有照譜上的記號", "Followed the dynamics and accents"]
  ]
};
let checkKind = null;
function showChecklist(kind){
  checkKind = kind;
  $("checkWrap").hidden = !kind;
  if (!kind || !cur) return;
  const list = $("checklist");
  list.classList.toggle("self", kind === "self");
  pairText($("checkTitle"), () => (kind === "self" ? tr("自我檢查(練習回饋)", "Self-check (practice feedback)") : tr("看譜重點", "Reading tips")));
  const items = (kind === "self" ? SELF_CHECK : PREP_TIPS)[cur.kind];
  // 勾選的狀態換語言時保留
  const was = [...list.querySelectorAll("input")].map(i => i.checked);
  list.innerHTML = items.map(() => (kind === "self" ? `<li><label><input type="checkbox"><span></span></label></li>` : `<li><span></span></li>`)).join("");
  [...list.querySelectorAll("li span")].forEach((s, i) => pairText(s, () => tr(items[i][0], items[i][1])));
  if (kind === "self") [...list.querySelectorAll("input")].forEach((x, i) => { x.checked = !!was[i]; });
}

/* ══ 譜:OSMD(單線 / 五線鼓組譜)+ stage.js(目前小節的底色、播放軸)。像印出來的考卷:每行 4 小節,放不下再縮 ══ */
let osmd = null, stage = null, renderedWidth = 0, pendingDraw = false, drawing = false, drawAgain = false, drawn = 0, legendKey = "", lastLayout = null;
const MAX_ZOOM = 1.0, MIN_ZOOM = 0.55, MIN_ZOOM_DENSE = 0.45;
const SCORE_BOTTOM_GAP = 16;
function ensureOsmd(){
  if (osmd) return true;
  if (typeof opensheetmusicdisplay === "undefined") { say(() => tr("樂譜元件載入失敗", "Could not load the notation engine")); return false; }
  osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay($("score"), {
    backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
    drawingParameters: "compacttight", drawMeasureNumbersOnlyAtSystemStart: true, stretchLastSystemLine: true
  });
  osmd.EngravingRules.FixedMeasureWidth = true;   // 每小節一樣寬(像印出來的考卷;整組鼓的譜在 drawOnce 改掉)
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
    setupKit(osmd, c.test.lines, c.xml);
    // 小鼓視奏(4/4、每小節差不多密):每小節一樣寬。整組鼓、Playback(換拍號、7/4 與 3/8 混在一起、律動與過門疏密差很多):
    // 一樣寬會讓每一小節都跟最寬的那一小節一樣寬(一行只放得下一小節),所以照內容排寬度
    osmd.EngravingRules.FixedMeasureWidth = c.kind === "snare";
    await osmd.load(osmdXML(c.xml));
  } catch (e) { console.error(e); say(() => tr("樂譜繪製失敗:", "Could not draw the score: ") + e.message); $("score").classList.remove("entering"); return; }
  if (cur !== c) { drawAgain = true; return; }
  if (!active || !$("stage").clientWidth) { pendingDraw = true; $("score").classList.remove("entering"); return; }
  try { fitScore(c); } catch (e) { console.error(e); say(() => tr("樂譜繪製失敗:", "Could not draw the score: ") + e.message); }
  renderedWidth = innerWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => $("score").classList.remove("entering")));
  drawn++;
  // 圖例:這一題用到的鼓件(每一份鼓組譜旁邊都要有;鼓件或線數變了才重畫)
  const key = drumKey();
  if (key) {
    const pieces = piecesUsed({ ...c.test.score, key }), lk = c.test.lines + ":" + pieces.join(",");
    if (lk !== legendKey) { legendKey = lk; drawLegend($("legend"), { pieces, lines: c.test.lines, key }).catch(e => { console.error(e); legendKey = ""; }); }
  }
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
/* 同形狀:系統與級數、小節數、拍號、寬度分級(Trinity 的換拍號、RSL 小鼓 / 整組鼓各自一組) */
const shapeOf = c => `${c.key}:${c.test.bars}:${(c.test.times || [c.test.time]).join("+")}:${widthClass()}`;
/* 照 PianoDrill js/sight/app.js 的 fitScore:先決定每行幾小節(縮到放得下寬度),再看高度(整份在畫面裡;不小於 MIN_ZOOM);
   同形狀沿用同一個排法與大小,下一題比較密要更小才放得下就一起縮(只縮不放大) */
function fitScore(c){
  const total = c.test.bars, shape = shapeOf(c), cached = SS.layout[shape];
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
  // 還是放不下:交給 OSMD 自己換行。一小節比 4/4 長(5/4、7/4、12/8)的譜一行本來就放不下兩小節,用 0.55(不再縮到 0.45,譜比較看得清楚)
  if (!chosen) chosen = { measuresPerLine: 0, zoom: c.test.tl.bars.some(b => b.len > 4) ? MIN_ZOOM : MIN_ZOOM_DENSE };
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

/* ══ 聲音:鼓的取樣 + 拍點(js/shared/audio.js;不用合成鼓聲)。
   小鼓視奏只載小鼓;整組鼓載這一題用到的鼓件 + 鼓墊試打的聲音(載入時 ▶ 外圈畫進度,載完才能播放、正式打)══ */
let sampleJob = null, sampleKey = "", sampleOk = false, loading = null, unloadTimer = 0;
/* 鼓墊的聲音:鈸 = 這一題最常用的鈸、鼓 = 小鼓、大鼓與腳踩 HH = 大鼓 */
function padPiece(lane){
  if (lane === "snare" || lane === "drum") return "snare";
  if (lane === "foot") return "kick";
  return (cur && cur.padCym) || "hh";
}
function mainCymbal(events){
  const n = {};
  for (const e of events) if (LANES[3][0].pieces.includes(e.piece) && e.piece !== "crash") n[e.piece] = (n[e.piece] || 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || "hh";
}
function neededPieces(){
  if (!cur || cur.kind === "snare") return ["snare"];
  return [...new Set([...eventsAt(bpmNow()).map(e => e.piece), "snare", "kick", padPiece("cym")])].sort();
}
function preload(){
  const need = neededPieces(), k = need.join(",");
  if (sampleJob && sampleKey === k) return sampleJob;
  sampleKey = k; sampleOk = false;
  const kitLoad = need.length > 1;
  setLoading(kitLoad ? 0 : null);
  const job = sampleJob = (async () => {
    try {
      await audio.loadKit(need, p => { if (sampleJob === job && kitLoad) setLoading(p); });
      await audio.loadClick();
      if (sampleJob === job) { sampleOk = true; setLoading(null); }
      return true;
    } catch (e) {
      // 載入失敗(網路),或還沒載完就被 unloadKit 釋放("kit unloaded"):下次按播放 / 正式打再試
      if (sampleJob === job) { sampleJob = null; sampleKey = ""; setLoading(null); if (kitLoad && active && cur) say(loadFailMsg); }
      return false;
    }
  })();
  return job;
}
const loadFailMsg = () => (cur && cur.kind !== "snare" ? tr("整組鼓取樣載入失敗,按 ▶ 或「正式打」重試(需要網路,之後會存在裝置上)", "Could not load the kit — tap ▶ or Perform to retry (needs internet once; then cached)")
  : tr("小鼓取樣載入失敗,再按一次重試(需要網路,之後會存在裝置上)", "Could not load the snare — try again (needs internet once; then cached)"));
/* 載入中:▶ 外圈畫進度、▶ 與正式打先不能按(載完才能開始);訊息列寫百分比 */
function setLoading(p){
  const was = loading;
  loading = p;
  const on = p != null;
  $("play").classList.toggle("busy", on);
  const r = $("playRing");
  r.classList.toggle("indet", on && !(p > 0));
  r.querySelector(".ring-fg").style.strokeDashoffset = String(on && p > 0 ? 1 - Math.max(0.03, p) : 0.82);
  syncButtons();
  if (on && active && phase !== "prep" && phase !== "perform") say(() => tr(`載入整組鼓取樣… ${Math.round((loading || 0) * 100)}%`, `Loading the kit… ${Math.round((loading || 0) * 100)}%`));
  else if (!on && was != null && active && cur && lastMsg && phase === "idle") say(startMsg);
}
function syncButtons(){
  const ok = !!(cur && cur.xml), busy = loading != null;
  $("play").disabled = !ok || busy;
  $("playAlong").disabled = !ok || (busy && phase !== "perform");
}
/* 離開 60 秒:釋放整組鼓(小鼓、拍點保留);下次要用時重新載 */
function releaseKit(){
  unloadTimer = 0;
  if (active) return;
  audio.unloadKit();
  if (sampleKey !== "snare") { sampleJob = null; sampleKey = ""; sampleOk = false; setLoading(null); }
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
/* 叫醒音訊、等取樣;回傳 false = 不能播(取樣沒載到、等的時候離開了 / 換題了) */
async function ready(){
  const token = starting = Date.now() + Math.random(), c0 = cur;
  const actx = audio.ensureAudio();
  if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
  if (!sampleJob && cur && cur.kind === "snare") say(() => tr("載入小鼓取樣…", "Loading snare samples…"));
  const ok = await preload();
  await within(audio.masterReady, 1500);
  const still = starting === token && active && cur === c0;
  if (starting === token) starting = 0;
  if (!ok) { if (still || active) say(loadFailMsg); return false; }
  return still;
}

/* 一個播放器:準備時的節拍器、正式打(只有拍點,學生自己打)、聽正確版本。
   拍子:meter.js 的時間軸;有 x/8 的譜播放器用八分音符當一拍(unit 0.5:播放器的 bpm × 2、拍子 × 2),onTick 換回四分音符 */
const unitNow = () => (cur ? cur.test.tl.unit : 1);
let lightsN = 4, countShown = null;
function showPulse(q){
  const tl = cur.test.tl;
  let bar, x;
  if (q < 0) { bar = tl.bars[0]; x = ((q + tl.countIn.len) % bar.len + bar.len) % bar.len; }
  else { bar = barAt(tl, Math.min(q, tl.len - 1e-6)).bar; x = q - bar.start; }
  if (!bar) return;
  if (bar.pulses.length !== lightsN) { lightsN = bar.pulses.length; tempo.setBeats(lightsN); }
  let k = 0; bar.pulses.forEach((p, i) => { if (x >= p - 1e-6) k = i; });
  tempo.showBeat(k, 0);
}
const player = createPlayer({
  onTick: beat => {
    if (!cur) return;
    const q = beat * unitNow(), tl = cur.test.tl;
    if (playKind === "metro") {
      const first = tl.bars[0], x = ((q % first.len) + first.len) % first.len;
      if (first.pulses.length !== lightsN) { lightsN = first.pulses.length; tempo.setBeats(lightsN); }
      let k = 0; first.pulses.forEach((p, i) => { if (x >= p - 1e-6) k = i; });
      tempo.showBeat(k, 0);
      return;
    }
    showPulse(q);
    if (q < 0) {
      // 預備拍:倒數剩幾下
      const x = q + tl.countIn.len, ps = tl.countIn.pulses;
      let i = 0; ps.forEach((p, j) => { if (x >= p - 1e-6) i = j; });
      const n = ps.length - i;
      if (n !== countShown) { countShown = n; say(() => tr(`預備拍 ${n}`, `Count-in ${n}`)); }
      return;
    }
    if (countShown !== 0) { countShown = 0; say(() => (playKind === "perform" ? tr("正式打中…", "Performing…") : tr("正確版本播放中…", "Playing the correct version…"))); }
    if (!stage) return;
    if (q < tl.len) { const r = barAt(tl, q); stage.update(r.i + 1, r.progress); }
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
function stopPlayer(){ const k = playKind; playKind = null; player.stop(true); tempo.showBeat(null); return k; }
/* 照時間軸播一輪:events 的 beat 是四分音符;clickFn(q, c) → 拍點(c = meter.js 的拍點強弱;q = 四分音符拍子) */
function playTimeline({ events, bpm, tail = 0, clickFn }){
  const tl = cur.test.tl, u = tl.unit;
  return player.play({ events: events.map(e => ({ ...e, beat: e.beat / u })), lenBeats: (tl.len + tail) / u, bpm: bpm / u, countInBeats: tl.countIn.len / u,
    click: x => clickFn(x * u, clickAt(tl, x)) });
}

/* ── 準備(RSL 90 秒:準備加練習 / Trinity 看譜 30 秒,可以試打;節拍器可開可關;鼓墊可以試打,不計分)── */
function startPrep(){
  if (!cur) return;
  if (phase === "prep") { endPrep(false); return; }   // 「結束準備」
  if (phase === "perform") stopPerform();
  if (playKind === "listen") stopListening();
  phase = "prep"; left = prepSec(); prepStarted = performance.now();
  lastResult = null;   // 上一次的練習回饋清掉(換語言時 renderResult 不會把它叫回來)
  $("countdown").hidden = false; $("countdown").className = "countdown running"; $("countdownValue").textContent = String(left);
  showFloat(left);
  showChecklist("prep");
  $("alongResult").hidden = true;
  renderPrepareLabel();
  say(() => (cur && cur.kind === "playback" ? tr("看譜中:可以在鼓墊上試打(不計分)。", "Studying: you may try it on the pads (not scored).")
    : tr("準備中:看譜,在鼓墊上試打(不計分)。", "Preparing: read it and try it on the pad (not scored).")));
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
  const b = bpmNow(), u = unitNow(), first = cur.test.tl.bars[0], units = Math.ceil((left + 2) * b / 60 / u);
  const t0 = player.play({ events: [], lenBeats: units, bpm: b / u, countInBeats: 0, click: x => {
    const q = ((x * u) % first.len + first.len) % first.len;
    return Math.abs(q) < 1e-6 ? 2 : first.pulses.some(p => Math.abs(p - q) < 1e-6) ? 1 : 0;
  } });
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
  if (!done) $("countdownValue").textContent = String(prepSec());
  renderPrepareLabel();
  if (done) say(() => tr("準備時間到。按「正式打」;錯了不要停,繼續往下打。", "Time's up. Tap Perform — keep going after a slip."));
  else if (active) say(startMsg);
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

/* ── 正式打:預備拍(第一小節的拍號 1 小節)+ 拍點(可關);鼓墊的時間扣掉第一拍 → 從第一拍算起的秒數 ── */
async function startPerform(){
  if (!cur || starting) return;
  if (phase === "perform") { stopPerform(); return; }
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer(), endListenUI();
  if (!(await ready())) return;
  if (playKind || phase === "perform") return;
  const b = bpmNow(), len = cur.test.tl.len;
  const t0 = playTimeline({ events: [], bpm: b, tail: TAIL, clickFn: (q, c) => (q >= len - 1e-6 ? 0 : q < 0 ? c : SS.clickPerform ? c : 0) });
  if (!(t0 > 0)) return;   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "perform"; phase = "perform"; countShown = null;
  perf = { t0, bpm: b, taps: [], startedAt: performance.now() };
  lastResult = null; $("alongResult").hidden = true; showChecklist(null);
  renderAlongLabel(); renderPrepareLabel(); syncButtons();
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
  renderAlongLabel(); renderPrepareLabel(); syncButtons();
  if (active) say(() => tr("停止了(這一次不算)。", "Stopped (not counted)."));
}
/* 打完:照題目的每一個音評節奏(js/shared/timing.js;扣掉整體的固定延遲)→ 練習回饋 + 自我檢查;算一題練習。
   整組鼓:3 個鼓墊各自配對(鈸 / 鼓 / 大鼓與腳踩 HH);裝飾音不算(hitsOnly);自由發展的小節不評分(那裡的敲擊不算多打) */
function finishPerform(){
  if (!perf || !cur) return;
  const p = perf, beatSec = 60 / p.bpm, lanes = lanesOf(cur);
  perf = null; phase = "result"; if (stage) stage.end();
  const events = hitsOnly(eventsAt(p.bpm));
  const expected = expectedByLane(events, p.bpm, lanes);
  let taps = p.taps.filter(x => x.time >= -beatSec / 2);   // 預備拍裡太早的不算
  let devTaps = 0;
  if (cur.test.develop && cur.test.develop.bars) {
    const devStart = cur.test.tl.bars[cur.test.develop.from].start * beatSec, tol = Math.min(0.16, Math.max(0.07, beatSec / 4));
    const near = t => events.some(e => Math.abs(e.beat * beatSec - t) <= tol);
    const keep = taps.filter(x => x.time < devStart - 1e-3 || near(x.time));
    devTaps = taps.length - keep.length; taps = keep;
  }
  const r = scoreLanes(expected, taps, { tempoBpm: p.bpm });
  lastResult = { r, taps: taps.length, devTaps, bpm: p.bpm, practice: !officialBpm(p.bpm), pb: cur.kind === "playback", lanes };
  const st = SS.stats[cur.key] || (SS.stats[cur.key] = { n: 0, hits: 0, total: 0 });
  st.n++;
  if (taps.length) { st.hits += r.hits; st.total += r.total; }   // 沒有敲鼓墊(例如在真的鼓上打):只算題數,不算進命中率
  addSec((performance.now() - p.startedAt) / 1000, 1);
  renderAlongLabel(); renderPrepareLabel(); syncButtons();
  renderResult();
  showChecklist("self");
  say(() => tr("打完了。看下面的練習回饋與自我檢查;可以按 ▶ 聽正確版本對照。", "Done. See the feedback and self-check below; tap ▶ to hear the correct version."));
  if (ctx) ctx.examChanged();
}
/* 練習回饋(不是考試分數,不出現等第字眼,也不換算成官方分數) */
function renderResult(){
  const box = $("alongResult"), R = lastResult;
  if (!R) { box.hidden = true; return; }
  const r = R.r, multi = R.lanes.length > 1;
  box.innerHTML = "";
  const add = (cls, fn) => { const p = document.createElement("p"); if (cls) p.className = cls; box.appendChild(p); pairText(p, fn); return p; };
  add("r-head", () => tr("練習回饋 · 節奏(觸控鼓墊)", "Practice feedback · rhythm (touch pads)"));
  if (!R.taps) {
    add("", () => tr(`沒有收到鼓墊的敲擊。正式打時點鼓墊,或用鍵盤 ${keysText(R.lanes)}。`,
      `No pad hits came in. Tap the pads while you perform, or use keys ${keysText(R.lanes)}.`));
  } else {
    const big = document.createElement("div"); big.className = "big"; box.appendChild(big);
    big.innerHTML = `${r.score == null ? "—" : r.score}<small></small>`;
    pairText(big.querySelector("small"), () => tr("/ 100 節奏吻合度", "/ 100 rhythm match"));
    add("", () => tr(`命中 ${r.hits} / ${r.total} · 漏 ${r.missed} · 多 ${r.extra} · 平均差 ${r.meanErrorMs} 毫秒(容許 ±${r.toleranceMs} 毫秒)`,
      `Hit ${r.hits} / ${r.total} · missed ${r.missed} · extra ${r.extra} · average ${r.meanErrorMs} ms off (±${r.toleranceMs} ms allowed)`));
    if (multi) add("", () => R.lanes.map(l => { const x = r.lanes[l.id] || { hits: 0, total: 0 }; return `${tr(l.label[0], l.label[1])} ${x.hits} / ${x.total}`; }).join(" · "));
    const off = offsetNote(r);
    if (off) add("", () => tr(off[0], off[1]));
    const ln = multi ? laneNote(r, R.lanes) : null;
    if (ln) add("", () => tr(ln[0], ln[1]));
  }
  if (R.devTaps || (cur && cur.test.develop)) add("", () => tr("自由發展的小節不評分(那裡的敲擊不算多打)。", "Development bars aren't scored (hits there don't count as extra)."));
  add("disclaimer", () => tr(`只看敲擊的時間,不看力度與音色;容許範圍是練習設定。這是練習回饋,不是考試分數,也不能換算成官方分數。${R.pb ? `速度 ♩=${R.bpm}(練習設定;官方沒寫速度)。` : R.practice ? `這一次用練習速度 ♩=${R.bpm}。` : ""}`,
    `Timing only (not dynamics or tone); the tolerance is a practice setting. This is practice feedback, not an exam mark, and it doesn't convert to one.${R.pb ? ` Tempo ♩=${R.bpm} (practice setting; not in the syllabus).` : R.practice ? ` Practice tempo ♩=${R.bpm} this time.` : ""}`));
  box.hidden = false;
}
$("playAlong").onclick = () => startPerform();

/* ── 觸控鼓墊(小鼓視奏 1 個,鍵盤 J / F;整組鼓 3 個 = 鈸 / 鼓 / 大鼓與腳踩 HH,鍵盤 F / J / K):正式打時記時間,其他時候試打(出聲、不計分)── */
let pads = null;
function ensurePads(){
  const lanes = lanesOf(cur);
  if (pads && pads.lanes === lanes) return;
  if (pads) pads.destroy();
  pads = createPads($("pads"), lanes, ({ lane, time }) => {
    if (time == null) return;
    audio.playKit(padPiece(lane), Math.max(time, audio.audioNow()), 0.72);
    if (phase === "perform" && perf) perf.taps.push({ lane, time: time - perf.t0 });
  });
}
ensurePads();

/* ── 聽正確版本(預備拍 + 拍點照「正式打的拍點」設定;自由發展的小節一定有拍點,沒有鼓聲)── */
async function toggleListen(){
  if (!cur || starting) return;
  if (playKind === "listen") { stopListening(); return; }
  if (phase === "perform") stopPerform();
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer();
  if (!(await ready())) return;
  if (playKind || phase === "perform") return;
  const t0 = startListen(bpmNow());
  if (!(t0 > 0)) return;   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "listen"; countShown = null;
  setPlayState(true);
  if (stage) stage.begin();
  bringScoreIntoView();
}
const listenClick = (q, c) => (q < 0 || inDevelop(q) ? c : SS.clickPerform ? c : 0);
function startListen(b){ return playTimeline({ events: eventsAt(b), bpm: b, clickFn: listenClick }); }
/* 播放中改速度:從目前的位置照新速度接著播(Flam / Drag 裝飾音的提前量照開始時的速度,差幾毫秒;下次播放照新速度重算) */
function retempoListen(){ player.retempo(bpmNow() / unitNow()); }
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
