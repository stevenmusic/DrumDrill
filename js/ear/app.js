/* 聽力模組(docs/STAGES.md S12 + S13;卡片、id、流程照 PianoDrill 聽音 js/ear/app.js 與 DrumDrill 視奏 js/sight/app.js)。
   外框(js/main.js)負責頂欄、分頁、考試設定與語言;這裡的元素 id 都加 "e-" 前綴。
   - 子項目 = 題型:過門 Fill / 律動 Groove(RSL;js/ear/gen.js,照 data/exam-rsl.json ear[g])、回打 Playback(Trinity;js/shared/playbackgen.js)。
     有選考試時照考試的系統(不適用的題型只有說明卡 + 規格卡);沒選考試時 Fill / Groove 用 RSL、Playback 用 Trinity。級數在設定卡選(選考試、換級數時跟著考試)
   - RSL Fill(RSL §5.1):配拍點聽兩次,每次前面 1 小節預備拍(官方)→ 練習(使用者自己決定多久,鼓墊試打不計分)→ 回打(預備拍 1 小節〔推估:大綱只寫考官數拍〕+ 拍點;
     1 個鼓墊 = 小鼓)→ 從 2 或 3 個印出來的譜(單線譜)選一個 → 揭曉正確的譜 + 節奏練習回饋。♩=70 固定(官方)
   - RSL Groove:同一個流程,2 小節(播放時兩小節播兩遍,推估)、3 個鼓墊;回打的長度跟播放一樣(推估);4–8 級說出風格那一題不出(風格清單大綱沒寫)
   - Trinity Playback(RP p.60):30 秒看譜(官方;可以在鼓墊上試打;「不看譜」= 播放時把譜蓋起來,看不看譜自己決定〔官方〕)
     → count-in(1 小節,推估)後 App 播一句、接著同樣長度只有拍點的空檔讓使用者打回來(player 的 gaps;一句一句做完)
     → 播兩次:第一次練習不計分、第二次評時間(每一句分開評:timing.scoreLanes 取那一句的空檔)。官方整段配伴奏音軌,App 只有拍點(註明)。
     速度官方沒寫:預設 ♩=80,練習設定,可以改。Improvising 需要伴奏音軌,只在檢定頁列規格
   - 結果只有「練習回饋」(只看敲擊時間;不出現等第字眼、不換算成官方分數);題目卡寫「依 RSL / Trinity N 級參數的練習 · 」+ practiceOnly;
     推估、練習設定、不出的項目寫在回打卡下面(出題器的 NOTES + 這裡的 APP_NOTES);每一份譜旁邊有圖例(js/shared/legend.js)
   - 播放器的「拍」用八分音符(U = 2 個一拍):x/8、5/8、7/8 的拍點照拍號的分組(附點四分、2+2+3),拍點燈號照分組亮
   - 聲音:整組鼓 audio.loadKit(載入進度顯示在題目卡;載不到可以再按一次);enter / leave 時 audio.holdKit / dropKit("ear")
     (視奏、聽力都放掉 60 秒後 audio.js 釋放,小鼓保留)
   - 檢定頁:考試摘要 + 規格卡(照官方大綱,每項頁碼)+「練習這一級」;不放練習紀錄、練習回饋(不跟配分、等第同一個畫面)
   - leave():停止播放、看譜倒數、回打(不算),題目保留;relang():只重寫文字,不停播放
   - 模擬考(S14,js/shared/mock.js):檢定頁的「模擬考」。RSL = Fill → Groove 各一題(自動聽兩次 → 練習 → 回打;Fill 再選譜;不能重聽、不能看答案);
     Trinity = Playback:看譜 30 秒(不能暫停)→ 第一次(練習)→ 第二次(評時間),自動接下去。結果(.mock-res)只有各題的練習回饋(節奏吻合度、選譜對錯、完成與否):
     不算總分、不出現等第、不換算官方分數。進行中考試摘要與規格卡藏起來;中途切分頁、背景、重新整理、旋轉 = 中止(回來時說明)
   - 用麥克風評分節奏(選用,S15;js/shared/micrhythm.js;開關 = 外框 drumdrill.v1 的 mic,經 ctx.micPref / setMicPref,視奏共用):
     RSL 回打、Trinity 第二次先開麥克風(拿到才開始),這一次鼓墊不出聲、不計分;回打 / 空檔裡不放拍點(只有預備拍,Trinity 第一次也一樣);
     打完整段在裝置上找起音(全部鼓件合併成一條,只評時間);App 自己的聲音(預備拍、Trinity App 播的那一句)被收進去的拿掉(dropBleed);
     拒絕權限 / 沒有麥克風:這一次照鼓墊評分、說明原因
   - 練習紀錄(js/shared/practicelog.js):連續天數、今天題數、今天正確率(回打命中的音 + 選對的譜 ÷ 全部)+ 每週目標 + 最近 7 天;
     秒數 = 聽題目、看譜、回打的時間;各題型正確率(#e-statsCard:Fill 選譜、各題型的回打命中率)
   - localStorage drumdrill.ear.v1:{ grades:{ rsl, trinity }(設定卡選的級數), bpmBy(Trinity 每一級的練習速度), hideChart, examSeen,
     stats:{ "rsl-3-fill": {n, picks, ok, hits, total} }, log:{ 日期: {n, sec, hits, total} }, goal(每週目標分鐘), mockRun(進行中的模擬考標記) }
     讀進來先消毒:級數 0–8、速度 30–240、數字 */
import { tr, T as TS, scoped, getLang, pairText } from "../shared/i18n.js";
import { playbackFor } from "../shared/examdata.js";
import * as V from "../shared/examview.js";
import * as audio from "../shared/audio.js";
import { createPlayer } from "../shared/player.js";
import { createPads, showKeys } from "../shared/pad.js";
import { LANES, expectedByLane, scoreLanes, offsetNote, laneNote } from "../shared/timing.js";
import { scoreXML, osmdXML, parseTime, piecesUsed, DIV } from "../shared/kitnotation.js";
import { setupKit, decorate, drawLegend } from "../shared/legend.js";
import { imgLabel, announce, describeSpec } from "../shared/a11y.js";
import { createTempo } from "../shared/tempo.js";
import { createScore } from "../shared/score.js";
import { fitLandZoom, createLandPlay } from "../shared/landscape.js";
import { toEvents, hitsOnly } from "../shared/kitevents.js";
import { genChart, phraseSpec, playbackParams, NOTES as PB_NOTES } from "../shared/playbackgen.js";
import { genFill, fillOptions, genGroove, NOTES as EAR_NOTES } from "./gen.js";
import { addLog, cleanLog, renderLog as paintLog, today, nextGoal, cleanGoal } from "../shared/practicelog.js";
import { createMock, abortText, paintCard, mockLabel, cardToTop } from "../shared/mock.js";
import { createMicTake, dropBleed, MIC_LANES, MIC_TEXT, micFailText } from "../shared/micrhythm.js";
import "./strings.js";
const T = scoped("ear");

const $ = id => document.getElementById("e-" + id);
const ROOT = document.getElementById("mod-ear");
const TYPES = ["fill", "groove", "playback"];
const U = 2;                 // 播放器的一拍 = 八分音符(一個四分音符 = 2)
const TAIL = 1.5;            // 回打最後多收幾個八分音符的敲擊(最後一個音晚一點也算得到)
const BPM_DEFAULT = 80;      // Trinity Playback 的預設速度(官方沒寫;練習設定)

/* ── 設定與紀錄(localStorage;讀不到就用預設值)── */
const KEY = "drumdrill.ear.v1";
const okGrade = g => Number.isInteger(g) && g >= 0 && g <= 8;
const SS = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  s = { grades: {}, bpmBy: {}, hideChart: false, stats: {}, log: {}, ...(s && typeof s === "object" ? s : {}) };
  for (const k of ["grades", "bpmBy", "stats", "log"]) if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = {};
  for (const sys of ["rsl", "trinity"]) if (!okGrade(s.grades[sys])) s.grades[sys] = sys === "trinity" ? 1 : 0;
  // Trinity 的練習速度每一級各自記("trinity-4": 90;跟視奏的 bpmOverride 一樣);舊版的單一 bpm 當作目前 Trinity 級數的
  if (typeof s.bpm === "number" && Number.isFinite(s.bpm) && s.bpm !== BPM_DEFAULT && s.bpmBy["trinity-" + s.grades.trinity] == null) s.bpmBy["trinity-" + s.grades.trinity] = s.bpm;
  delete s.bpm;
  for (const [k, v] of Object.entries(s.bpmBy)) { if (/^trinity-[0-8]$/.test(k) && typeof v === "number" && Number.isFinite(v)) s.bpmBy[k] = Math.max(30, Math.min(240, Math.round(v))); else delete s.bpmBy[k]; }
  // 練過幾題、練習紀錄:數字消毒(負數、非整數、不是數字的丟掉或歸零)
  const cnt = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  for (const [k, v] of Object.entries(s.stats)) {
    if (!/^(rsl|trinity)-[0-8]-(fill|groove|playback)$/.test(k) || !v || typeof v !== "object") { delete s.stats[k]; continue; }
    s.stats[k] = { n: cnt(v.n), picks: cnt(v.picks), ok: Math.min(cnt(v.ok), cnt(v.picks)), total: cnt(v.total), hits: Math.min(cnt(v.hits), cnt(v.total)) };
  }
  s.log = cleanLog(s.log);
  s.goal = cleanGoal(s.goal);
  s.hideChart = !!s.hideChart;
  if (typeof s.examSeen !== "string") s.examSeen = null;
  return s;
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SS)); } catch (e) {} };
/* 模擬考(下面「模擬考」一段):中止時停掉播放與計時,在畫面上就馬上畫出說明 */
const mock = createMock({ store: SS, save, onAbort: () => { stopAll(); if (active) { render(); cardToTop($("mockCard")); } } });
const mockOn = () => mode === "exam" && mock.running();
const mockRes = () => (mockOn() ? mock.data.res[mock.data.i] : null);

/* ── 狀態 ── */
let ctx = null, exam = null, active = false, mode = "free", type = "fill";
let cur = null;        // 目前的題目:{ key, type, sys, grade, seed, q, xml, lines, opts, answer, chosen, revealed, listened, pass, results }
let phase = "idle";    // RSL:idle | practice(聽過了)| perform | choose(Fill 選譜)| result;Trinity:idle | study | ready | pass | between | result
let playKind = null;   // 播放器正在播的:"listen"(RSL 聽題目 / Trinity 聽整份)| "perform"(RSL 回打)| "pass"(Trinity 第一次 / 第二次)
let perf = null;       // 回打中:{ t0, bpm, taps:[{lane, time}], startedAt, tl, pass }
let tl = null;         // 正在播的時間軸(timeline())
const mic = createMicTake();   // 麥克風(選用):RSL 回打、Trinity 第二次錄一整段
let micFail = null;            // 上一次打開麥克風失敗的原因(denied / none / error)
let lastMic = null;            // 測試用(tools/test/mic-check.mjs):上一次麥克風的 { expected, detected, removed, lagMs }
const micOn = () => !!(ctx && ctx.micPref && ctx.micPref());
let lastMsg = null, starting = 0, countdown = 0, left = 0, studyStarted = 0, studyEnd = 0, drawn = 0;   // 看譜倒數照 performance.now() 的終點算

const curExam = () => exam || { system: "trinity", grade: 1, auto: true };
const sysName = sys => (sys === "rsl" ? "RSL" : "Trinity");
const gl = (g, sys) => (ctx ? ctx.gradeLabel(g, sys) : String(g));
const dataOf = sys => (ctx && ctx.examData ? ctx.examData(sys) : null);
const drumKey = () => (ctx && ctx.drumKey ? ctx.drumKey() : null);
/* 有選考試:照考試的系統;沒選考試:Fill / Groove 用 RSL、Playback 用 Trinity */
const sysNow = () => (!curExam().auto ? curExam().system : type === "playback" ? "trinity" : "rsl");
const gradeNow = sys => SS.grades[sys];
const typeOK = (sys, t) => (sys === "rsl" ? t === "fill" || t === "groove" : t === "playback");
const keyOf = (sys, g, t) => `${sys}-${g}-${t}`;
const isRsl = () => !!cur && cur.sys === "rsl";
const practicable = (sys, g, t) => {
  const d = dataOf(sys);
  if (!d || !drumKey() || !typeOK(sys, t)) return false;
  return sys === "rsl" ? !!(d.ear && d.ear[g]) : !!playbackFor(g, d);
};

/* ══ 外框呼叫 ══ */
export async function start(c){
  ctx = c; exam = c.exam;
  followExam(exam);
  renderLog(); renderStats(); renderMic();
  window.__ear = {
    get play(){ return player.state.playing; },
    get state(){
      return { phase, kind: playKind, type, mode, sys: cur && cur.sys, grade: cur && cur.grade, key: cur && cur.key, bpm: cur ? bpmNow() : null,
        listened: cur ? cur.listened : 0, pass: cur ? cur.pass : 0, chosen: cur ? cur.chosen : null, answer: cur ? cur.answer : null, revealed: !!(cur && cur.revealed),
        options: cur && cur.opts ? cur.opts.length : 0, optsDrawn: cur ? cur.optsDrawn : 0, drawn, pending: score.pending, timer: !!countdown, left,
        taps: perf ? perf.taps.length : 0, result: cur && cur.result ? summary(cur.result) : null, lanes: cur ? cur.lanes.length : 0,
        mic: micOn(), micFail, micActive: mic.active };
    },
    get lastMic(){ return lastMic; }, micPlan: () => micPlan(),
    get q(){ return cur && cur.q; }, get xml(){ return cur && cur.xml; }, get tl(){ return tl; },
    newQuestion, listen: toggleListen, perform: startPerform, choose, reveal, study: startStudy, setBpm: v => setBpm(v), SS,
    perfT0: () => (perf ? perf.t0 : null), expected: () => expected(), finishNow,
    get mock(){ return { state: mock.state, reason: mock.reason, i: mock.data ? mock.data.i : null, res: mock.data ? mock.data.res.map(r => ({ type: r.type, stage: r.stage, stopped: !!r.stopped, pick: r.pick || null, score: r.r ? summary(r.r) : null })) : null }; },
    startMock: () => startMock(), mockNext: () => mockNext(),
    /* 測試用:模擬考的看譜時間馬上到 */
    mockSkipStudy(){ if (mockOn() && phase === "study") studyEnd = performance.now(); },
    set unloadMs(v){ audio.kitRelease.ms = v; }, get unloadMs(){ return audio.kitRelease.ms; }   // 等待時間在 audio.js(視奏、聽力共用)
  };
}
export function enter(t){
  active = true;
  if (mock.running() && t !== "exam") mock.abort("leave");   // 模擬考進行中離開檢定頁 = 中止
  audio.holdKit("ear");   // 回來了:不釋放整組鼓
  mode = t === "exam" ? "exam" : "free";
  if (TYPES.includes(t)) type = t;
  const had = cur;
  renderMic();   // 開關跟視奏共用:在視奏改過就照新的
  render();
  if ((mode !== "free" && !mockOn()) || !cur || cur !== had) return;
  preload();   // 同一題:整組鼓被釋放過就重新載(載過的 audio.loadKit 直接回傳)
  // 同一題:在別的分頁時延後的譜、選項,回到畫面再畫
  requestAnimationFrame(() => {
    if (!active || cur !== had) return;
    if (!$("scoreCard").hidden) { if (score.pending || !score.osmd) showScore(); else score.onResize(); }
    if (!$("answers").hidden && cur.optsDrawn < cur.opts.length) drawOptions();
    fitTitle();
  });
}
/* 離開(切分頁、切到背景):停止播放、看譜倒數、回打(不算);題目保留。放掉整組鼓(視奏也沒拿著的話 60 秒後釋放) */
export function leave(){
  active = false;
  // 打開麥克風 / 錄完時 iOS 切換音訊工作階段造成的「打斷」(外框 leave + enter):不是使用者離開,模擬考不中止
  if (!mic.shielded) mock.abort("leave");
  stopAll();
  audio.dropKit("ear");
}
export function setExam(ex){
  const same = exam && ex && exam.system === ex.system && exam.grade === ex.grade && !!exam.auto === !!ex.auto;
  exam = ex;
  if (same) return;
  if (!mock.abort("exam") && mock.state === "result") mock.close();   // 換了考試或級數:進行中的模擬考中止;結果收起來
  followExam(ex);
  if (active) render();
}
/* 選了考試(或換了考試、級數):這個系統的級數跟著考試;同一個考試不重設(設定卡自己選的級數保留) */
function followExam(ex){
  if (!ex || ex.auto || !okGrade(ex.grade) || !["rsl", "trinity"].includes(ex.system)) return;
  const k = `${ex.system}-${ex.grade}`;
  if (SS.examSeen === k) return;
  SS.examSeen = k; SS.grades[ex.system] = ex.grade; save();
}
/* 外框的 appCtx(考試資料、圖例)晚到 */
export function onCtx(){ renderMic(); if (active) render(); if (ctx) ctx.examChanged(); }
/* 換語言:只重寫文字(不停止播放、不重新出題) */
export function relang(){
  if (mode === "exam" || !cur || $("quizCard").hidden) { if (active || mode === "exam") renderStatic(); }
  $("playBtn").setAttribute("aria-label", playKind === "listen" ? tr("停止", "Stop") : T("playAria"));
  renderSetup();
  refreshTexts();
  pads.relang(); renderMic();
  relangPairs($("legend")); relangPairs($("ansLegend"));
  renderLog(); renderStats();
  if (mode === "exam") renderMockCard();
}
export function examStatus(){
  const ex = curExam(), st = k => (SS.stats[k] || {}).n || 0;
  const n = ex.system === "rsl" ? st(keyOf("rsl", ex.grade, "fill")) + st(keyOf("rsl", ex.grade, "groove")) : st(keyOf("trinity", ex.grade, "playback"));
  return tr(`已練 ${n} 題`, `${n} practised`);
}
export function onKey(e){
  if ((mode === "exam" && !mockOn()) || !cur || $("quizCard").hidden) return;
  if (pads.key(e)) return;   // F / J / K = 鼓墊
  if (e.code === "Space") {
    e.preventDefault();       // 不要捲動頁面
    if (playKind === "perform" || playKind === "pass") stopRun(); else if (!$("playBtn").disabled) toggleListen();
  } else if ((e.key === "n" || e.key === "N") && !$("nextBtn").disabled && !$("nextBtn").hidden) $("nextBtn").click();
}

/* ══ 畫面:檢定頁 / 自由練習(有題目 / 只有說明)══ */
function render(){
  const isExam = mode === "exam", run = isExam && mock.running(), only = isExam && (mock.state === "result" || mock.state === "aborted");
  ROOT.classList.toggle("mock-run", run);
  // 檢定頁不放練習紀錄;模擬考進行中、結果:考試摘要(配分、等第)與規格卡藏起來(練習回饋不跟等第放在同一個畫面)
  ROOT.querySelectorAll(".pane").forEach(el => { el.hidden = !isExam || run || only; });
  $("logCard").hidden = $("statsCard").hidden = isExam;
  if (run) {
    showPractice(true); $("setup").hidden = true; $("unsupported").hidden = true; $("specCards").hidden = true;
    renderMockCard(); refreshTexts(); syncButtons();
    return;
  }
  if (isExam) { stopAll(); showPractice(false); $("unsupported").hidden = true; $("specCards").hidden = only; renderExam(); renderMockCard(); return; }
  $("mockCard").hidden = true;
  const sys = sysNow(), g = gradeNow(sys);
  renderSetup(); renderStats();
  if (!practicable(sys, g, type)) { stopAll(); showPractice(false); $("setup").hidden = !typeOK(sys, type) || !dataOf(sys); renderUnsupported(sys, g); return; }
  showPractice(true); $("unsupported").hidden = true; $("specCards").hidden = true;
  if (!cur || cur.key !== keyOf(sys, g, type)) newQuestion();
  else refreshTexts();
}
function renderStatic(){
  if (mode === "exam") { if (!mock.running()) renderExam(); return; }
  const sys = sysNow(), g = gradeNow(sys);
  if (!practicable(sys, g, type)) renderUnsupported(sys, g);
}
function showPractice(on){
  for (const id of ["setup", "quizCard", "along"]) $(id).hidden = !on;
  // 譜卡:RSL 揭曉前藏起來,Trinity 一直在(從檢定頁、不適用的題型回來時要還原,enter 的 rAF 再畫譜)
  $("scoreCard").hidden = !(on && cur && (cur.sys !== "rsl" || cur.revealed));
}

/* 這個題型不適用 / 資料還沒載好:說明 + 官方規格卡(不出題) */
function renderUnsupported(sys, g){
  $("unsupported").hidden = false;
  const d = dataOf(sys);
  let title, text;
  if (!d) {
    title = () => tr("考試資料還沒載好", "Exam data not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。", "Needs internet once; then it's cached.");
  } else if (!typeOK(sys, type) && sys === "rsl") {
    title = () => tr("RSL 沒有 Playback 回打", "No Playback in RSL");
    text = () => tr("Playback(聽一句、馬上打回來)是 Trinity Rock & Pop 的 Session skills。RSL 的聽力是 Fill 與 Groove,在「過門」「律動」練。要練 Playback,到檢定分頁把考試換成 Trinity。下面是 RSL 的官方規格。",
      "Playback (listen and repeat each phrase) is a Trinity Rock & Pop session skill. RSL ear tests are Fill and Groove — see those tabs. To practise Playback, switch the exam to Trinity. RSL's official spec below.");
  } else if (!typeOK(sys, type)) {
    title = () => tr("Rock & Pop 沒有聽力項目", "No ear tests in Rock & Pop");
    text = () => tr("Fill、Groove 是 RSL 的聽力題。Trinity Rock & Pop 最接近的是 Session skills 的 Playback,在「回打」練。要練 Fill / Groove,到檢定分頁把考試換成 RSL。下面是 Trinity 的官方規格。",
      "Fill and Groove are RSL ear tests. The nearest in Trinity Rock & Pop is Playback (session skills) — see the Playback tab. To practise Fill / Groove, switch the exam to RSL. Trinity's official spec below.");
  } else {
    title = () => tr("圖例資料還沒載好", "Drum key not loaded");
    text = () => tr("第一次要連網路,之後會存在裝置上。下面是官方規格。", "Needs internet once; then it's cached. Official spec below.");
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
  $("specCards").innerHTML = "";
  if (!d) {
    V.fillSpec($("sumSpec"), []); $("examSummary").textContent = TS("sumTitle");
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
  if (sys === "rsl") renderRsl(d, g, true); else renderTrinity(d, g, true);
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
/* 檢定頁「練習這一級」:帶到聽力分頁的那個題型,級數設成這一級 */
function goBtn(c, label, sub, sys, g){
  const b = document.createElement("button");
  b.className = "xcat e-go"; b.type = "button"; b.dataset.sub = sub;
  b.innerHTML = '<span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  pairText(b.querySelector("span"), label);
  b.onclick = () => { SS.grades[sys] = g; save(); ctx.showView("ear", sub); };
  const w = document.createElement("div"); w.className = "xcats"; w.appendChild(b); c.appendChild(w);
}

function renderRsl(d, g, withPractice){
  const e = d.ear[g], key = drumKey(), src = V.srcOf("rsl", e.src.p), f = e.fill, gr = e.groove;
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
  if (withPractice) goBtn(c, () => tr("練習這一級的 Fill(App 出題)", "Practise this grade's Fill (App tests)"), "fill", "rsl", g);
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
  if (withPractice) goBtn(c2, () => tr("練習這一級的 Groove 回打(App 出題)", "Practise this grade's Groove (App tests)"), "groove", "rsl", g);
}

function renderTrinity(d, g, withPractice){
  const c = card(() => tr("Playback(聽句回打)", "Playback (listen & repeat)"), V.srcOf("trinity", d.earNote.src.p));
  V.addPara(c, () => V.L(d.earNote.text));
  const fl = d.playback.flow, fsrc = V.srcOf("trinity", fl.src.p);
  specIn(c, [
    { k: () => tr("看譜", "Study"), v: () => V.secText(fl.studySec) + tr("(可以試打;看不看譜自己決定)", " (may try out; reading is optional)"), src: fsrc },
    { k: () => tr("播放", "Plays"), v: () => tr(`${fl.plays} 次(練習、評分);開頭有 count-in`, `${fl.plays} (practice, assessed); count-in first`), src: fsrc },
    { k: () => tr("速度、伴奏風格", "Tempo, style"), v: notStated }
  ]);
  V.addPara(c, () => tr("每一級的拍號、時值、鼓件見「視奏」的 Playback 規格。", "Each grade's metres, values and kit: see Playback under Sight-reading."));
  if (withPractice) goBtn(c, () => tr("練習這一級的 Playback 回打(App 出題)", "Practise this grade's Playback (App tests)"), "playback", "trinity", g);
  // Improvising:累積到這一級的規格(需要伴奏音軌,App 只列規格)
  const im = d.improvising, G = im.grades;
  let bars = null, solo = null; const time = [], styles = [];
  let meterChange = false; const src = [];
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

/* ══ 設定卡:級數、速度(Trinity 可以改;RSL 照官方)、不看譜 ══ */
function renderSetup(){
  const sys = sysNow(), g = gradeNow(sys);
  $("grades").innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k =>
    `<button class="opt" data-v="${k}" aria-pressed="${k === g}" aria-label="${gl(k, sys)}">${k === 0 ? (sys === "rsl" ? "D" : "I") : k}</button>`).join("");
  $("optHide").hidden = sys !== "trinity";
  $("optHide").setAttribute("aria-pressed", String(!!SS.hideChart));
  tempoUI();
}
$("grades").onclick = e => {
  const b = e.target.closest(".opt[data-v]"); if (!b) return;
  const sys = sysNow(), g = Number(b.dataset.v);
  if (!okGrade(g) || g === SS.grades[sys]) return;
  SS.grades[sys] = g; save();
  render();
};
$("optHide").onclick = () => { SS.hideChart = !SS.hideChart; save(); renderSetup(); renderSum(); coverChart(); };

/* ── 速度:RSL 照官方(Fill ♩=70;Groove 在官方範圍內每題隨機);Trinity 官方沒寫 → 預設 ♩=80(練習設定),可以改 ── */
const bpmKey = () => "trinity-" + cur.grade;
const bpmNow = () => (!cur ? BPM_DEFAULT : cur.sys === "rsl" ? cur.q.bpm : SS.bpmBy[bpmKey()] ?? BPM_DEFAULT);
const tempo = createTempo({ $, min: 30, max: 240, get: () => bpmNow(), set: v => setBpm(v) });
function setBpm(v){
  if (!cur || cur.sys !== "trinity" || playKind === "pass" || mockOn()) return;   // RSL 照官方;Trinity 回打中不改(評分照開始時的速度)
  if (!Number.isFinite(Number(v))) return;
  const b = Math.max(30, Math.min(240, Math.round(Number(v))));
  if (b === BPM_DEFAULT) delete SS.bpmBy[bpmKey()]; else SS.bpmBy[bpmKey()] = b;
  save();
  if (playKind === "listen") player.retempo(b * U);
  tempoUI(); renderMeta(); renderSum();
}
function tempoUI(){
  tempo.sync(`♩ / ${tr("分", "min")}`);
  lockTempo();
  if ($("osmd").hasAttribute("role")) imgLabel($("osmd"), scoreLabel);   // 無障礙:譜的說明裡有速度
  if (!cur) { pairText($("tempoNote"), () => ""); return; }
  const src = cur.sys === "rsl" ? V.srcOf("rsl", cur.q.src && cur.q.src.p) : "";
  pairText($("tempoNote"), () => (cur.type === "fill" ? tr(`官方速度 ${V.bpmText(cur.q.bpm)}(固定)· ${src}`, `Official ${V.bpmText(cur.q.bpm)} (fixed) · ${src}`)
    : cur.type === "groove" ? tr(`官方範圍 ${V.bpmText(cur.q.bpmRange)},每題隨機(練習設定)· ${src}`, `Official ${V.bpmText(cur.q.bpmRange)}, random per test (practice setting) · ${src}`)
    : tr("練習速度:官方沒寫速度(練習設定)", "Practice tempo: none in the syllabus (practice setting)")));
}

/* 速度鈕:RSL 照官方不能改;Trinity 第一次 / 第二次進行中也不能改(評分照開始時的速度) */
function lockTempo(){
  const fixed = !cur || cur.sys !== "trinity" || playKind === "pass";
  for (const id of ["bpmDown", "bpmUp", "bpmRange"]) $(id).disabled = fixed;
}

/* ══ 出題 ══ */
const newSeed = () => (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
/* force = { sys, g, t }:模擬考指定考試的系統、級數、題型(不看設定卡) */
function newQuestion(seed = newSeed(), force = null){
  stopAll();
  const sys = force ? force.sys : sysNow(), g = force ? force.g : gradeNow(sys), t = force ? force.t : type, d = dataOf(sys), key = drumKey();
  if (!practicable(sys, g, t)) return;
  let q, opts = null, answer = null, xml = null;
  try {
    if (t === "fill") { q = genFill(d.ear[g], seed, g); const o = fillOptions(q, seed); opts = o.options.map(x => ({ cells: x.cells, spec: x.spec, xml: null })); answer = o.answer; }
    else if (t === "groove") q = genGroove(d.ear[g], seed, g);
    else q = genChart(playbackParams(g, d), seed);
    if (sys === "rsl" && !q.src) q.src = d.ear[g].src;
    xml = scoreXML({ key, ...q.spec });
    if (opts) for (const o of opts) o.xml = scoreXML({ key, ...o.spec });
  } catch (e) { console.error(e); say(() => tr("出題失敗:", "Could not make a test: ") + e.message); return; }
  const lanes = t === "fill" ? LANES[1] : LANES[3];
  cur = { key: keyOf(sys, g, t), type: t, sys, grade: g, seed, q, xml, lines: q.spec.lines === 1 ? 1 : 5, opts, answer, chosen: null, revealed: false,
    listened: 0, pass: 0, result: null, optsDrawn: 0, lanes, padPiece: padPieces(q, lanes), legendFor: null };
  phase = "idle"; perf = null;
  pads.destroy(); pads = makePads(lanes);
  $("answers").hidden = true; $("answers").innerHTML = ""; $("ansLegend").hidden = true;
  $("alongResult").hidden = true;
  $("countdown").hidden = t !== "playback"; $("countdown").className = "countdown";
  $("countdownValue").textContent = String(studySec());
  // 譜:RSL 揭曉才出現;Trinity 的 song chart 一開始就在
  score.clear(); $("legend").innerHTML = ""; imgLabel($("legend"), null);
  $("scoreCard").hidden = sys === "rsl";
  if (sys !== "rsl") showScore();
  setBeatsFor(firstBar());
  syncButtons(); refreshTexts();
  say(idleMsg);
  if (active) preload();
}
/* 每條 lane 點下去出的聲音:題目裡那條 lane 最常出現的鼓件(沒有就用預設) */
function padPieces(q, lanes){
  const ev = hitsOnly(q.events || toEvents(q.spec, { bpm: 80 })), out = {};
  for (const l of lanes) {
    const n = {};
    for (const e of ev) if (!l.pieces || l.pieces.includes(e.piece)) n[e.piece] = (n[e.piece] || 0) + 1;
    const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    out[l.id] = best ? best[0] : { snare: "snare", cym: "hh", drum: "snare", foot: "kick" }[l.id];
  }
  return out;
}
const studySec = () => { const d = dataOf("trinity"); return (d && d.playback.flow.studySec) || 30; };
const studySrc = () => { const d = dataOf("trinity"), f = d && d.playback && d.playback.flow; return V.srcOf("trinity", (f && f.src && f.src.p) || "60"); };

/* ══ 時間軸(八分音符為單位):小節、拍點、預備拍、App 播的段落、學生打的空檔 ══ */
function meterBar(time){ const m = parseTime(time); return { len: m.len / DIV * U, groups: m.groups.map(x => x / DIV * U) }; }
function specBars(spec){ let t = spec.time || "4/4"; return spec.measures.map(m => { if (m.time) t = m.time; return meterBar(t); }); }
const sumLen = bars => bars.reduce((s, b) => s + b.len, 0);
/* parts:[{ kind:"ci" | "app" | "you", bars, events(四分音符,從這一段開頭算), q0(譜上從第幾拍開始,四分音符), mod(譜上一輪幾拍:Groove 兩遍), phrase, take }] */
function timeline(parts, ci){
  const out = { bars: [], events: [], segs: [], gaps: [], countIn: ci.len };
  out.bars.push({ start: -ci.len, ...ci }); out.segs.push({ u0: -ci.len, u1: 0, kind: "ci", take: 1 });
  let at = 0;
  for (const p of parts) {
    const len = sumLen(p.bars);
    let s = at; for (const b of p.bars) { out.bars.push({ start: s, ...b }); s += b.len; }
    for (const e of p.events || []) out.events.push({ ...e, beat: Math.round((e.beat * U + at) * 1e6) / 1e6 });
    // "you"(學生打的段落)不放事件,所以不需要 gaps(gaps 會把下一段句首的裝飾音靜音);out.gaps 一直是 []
    out.segs.push({ u0: at, u1: at + len, kind: p.kind, q0: p.q0 || 0, mod: p.mod || 0, phrase: p.phrase, take: p.take || 1 });
    at += len;
  }
  out.len = at;
  return out;
}
const barAt = (t, b) => { let r = null; for (const x of t.bars) { if (x.start <= b + 1e-9) r = x; else break; } return r && b < r.start + r.len - 1e-9 ? r : null; };
const segAt = (t, b) => t.segs.find(s => b >= s.u0 - 1e-9 && b < s.u1 - 1e-9) || null;
/* 拍點:小節第一拍 = 重拍,其他組的開頭 = 弱拍,組裡的八分音符不響 */
function clickAt(t, b){
  const bar = barAt(t, b); if (!bar) return 0;
  const off = b - bar.start;
  if (Math.abs(off) < 1e-9) return 2;
  let acc = 0;
  for (const g of bar.groups) { acc += g; if (Math.abs(acc - off) < 1e-9 && acc < bar.len) return 1; }
  return 0;
}
/* 拍點燈號:第幾組 */
function groupAt(bar, b){ let acc = 0, k = 0; const off = b - bar.start; for (const g of bar.groups) { if (off < acc + g - 1e-9) return k; acc += g; k++; } return k - 1; }
let beatsN = 0;
function setBeatsFor(bar){ const n = bar ? bar.groups.length : 4; if (n !== beatsN) { beatsN = n; tempo.setBeats(n); } }
function firstBar(){ return cur ? specBars(cur.q.spec)[0] : null; }
/* 每一句的譜(Trinity):小節、事件(四分音符,從句子開頭算)、在整份譜上從第幾拍開始 */
function phrases(bpm){
  const c = cur.q, allBars = specBars(c.spec);
  return c.phrases.map((ph, i) => {
    const bars = allBars.slice(ph.start, ph.start + ph.bars);
    const q0 = sumLen(allBars.slice(0, ph.start)) / U;
    return { i, bars, q0, events: toEvents(phraseSpec(c, i), { bpm }), lenQ: sumLen(bars) / U };
  });
}

/* ══ 播放器:聽題目、回打、Trinity 的兩次 ══ */
let countShown = null, segShown = null;
const player = createPlayer({
  onTick: b => {
    if (!tl) return;
    const bar = barAt(tl, b < tl.len ? b : tl.len - 1e-6);
    if (bar) { setBeatsFor(bar); tempo.showBeat(groupAt(bar, b < tl.len ? b : tl.len - 1e-6), 0); }
    const seg = segAt(tl, b);
    if (seg !== segShown) { segShown = seg; segMsg(seg); }
    if (seg && seg.kind === "ci" && bar) {
      const n = groupAt(bar, b) + 1;
      if (n !== countShown) { countShown = n; segMsg(seg, n); }
    }
    // 播放軸:譜看得到時跟著走(Trinity 的空檔:同一句再走一次)
    if (!$("scoreCard").hidden && score.osmd && seg) {
      if (seg.kind === "ci") { const nx = tl.segs[tl.segs.indexOf(seg) + 1]; score.movePlayline(nx ? nx.q0 : 0, true); }
      else { let q = (b - seg.u0) / U; if (seg.mod) q %= seg.mod; score.movePlayline(seg.q0 + q, true); }
    }
  },
  onEnd: () => {
    const k = playKind; playKind = null; endRunUI();
    if (k === "listen") { listenSec(); finishListen(); }
    else if (k === "perform") finishPerform();
    else if (k === "pass") finishPass();
  },
  onStop: () => {   // 播放器自己停(頁面切到背景):不算,按鈕回到原本的樣子
    const k = playKind; playKind = null; endRunUI();
    if (k === "listen") listenSec();
    if (k === "perform" || k === "pass") abortRun();
  }
});
function stopPlayer(){ const k = playKind; playKind = null; player.stop(true); endRunUI(); if (k === "listen") listenSec(); return k; }
/* 聽題目、聽整份譜的時間也算進今天的練習(真的播放的秒數) */
let listenStarted = 0;
function listenSec(){ if (listenStarted) { addSec((performance.now() - listenStarted) / 1000); listenStarted = 0; } }
function endRunUI(){
  tempo.showBeat(null); segShown = null; countShown = null;
  $("stage").classList.remove("you"); $("along").classList.remove("you");
  setPlayState(false); land.release(); score.home(); coverChart(); syncButtons();
}
/* 播一個時間軸;回傳第一拍的音訊時間(沒有開始時 NaN) */
function run(t, kind, bpm, click = b => clickAt(t, b)){
  tl = t; segShown = null; countShown = null;
  const t0 = player.play({ events: t.events, lenBeats: t.len + (kind === "listen" ? 0 : TAIL), bpm: bpm * U, countInBeats: t.countIn, click, gaps: t.gaps });
  if (t0 > 0) { playKind = kind; coverChart(); syncButtons(); }
  return t0;
}
/* 每一段開始時的訊息(預備拍數到第幾下) */
function segMsg(seg, n){
  $("stage").classList.toggle("you", !!seg && seg.kind === "you"); $("along").classList.toggle("you", !!seg && seg.kind === "you");
  if (!seg) return;
  const k = playKind, ph = seg.phrase != null ? seg.phrase + 1 : 0, nph = cur && cur.q.phrases ? cur.q.phrases.length : 0;
  if (seg.kind === "ci") {
    const c = n || 1;
    if (k === "listen" && isRsl()) say(() => tr(`第 ${seg.take} 次 · 預備拍 ${c}`, `Play ${seg.take} · count-in ${c}`), false, true);
    else say(() => tr(`預備拍 ${c}`, `Count-in ${c}`), false, true);
    return;
  }
  if (k === "listen") say(() => (isRsl() ? tr(`第 ${seg.take} 次播放中…`, `Play ${seg.take}…`) : tr("整份譜播放中…", "Playing the whole chart…")), false, seg.take > 1);
  else if (k === "perform") say(() => tr("回打中:照聽到的打…", "Your turn: play what you heard…"), false, true);   // 不播報:開始時已經念過「回打開始」
  else if (k === "pass") {
    const p = perf ? perf.pass : 1, lbl = p === 1 ? tr("第一次(練習)", "Play 1 (practice)") : tr("第二次(評時間)", "Play 2 (assessed)");
    say(() => (seg.kind === "app" ? tr(`${lbl} · 第 ${ph} / ${nph} 句:聽`, `${lbl} · phrase ${ph} / ${nph}: listen`) : tr(`${lbl} · 第 ${ph} / ${nph} 句:換你打`, `${lbl} · phrase ${ph} / ${nph}: your turn`)), false, true);
  }
}

/* ── 聽題目(RSL:配拍點聽兩次,每次前面 1 小節預備拍)/ 聽整份譜(Trinity,正確版本)── */
async function toggleListen(){
  if (!cur || starting) return;
  if (playKind === "listen") { stopPlayer(); say(() => tr("停止了。", "Stopped.")); return; }
  if (playKind === "perform" || playKind === "pass") stopRun();
  if (phase === "study") endStudy(false);
  const mk = mockOn() ? mock.id : 0;
  // 模擬考(自動聽題目):鼓聲載入失敗就中止(不能重聽,按鈕都鎖著,不中止會卡住)
  if (!(await ready())) { if (loadFailed && mk && mock.alive(mk) && active) mock.abort("load"); return; }
  if (playKind || (mk && !mock.alive(mk))) return;
  const bpm = bpmNow(), c = cur.q;
  let t;
  if (cur.sys === "rsl") {
    const bars = specBars(c.spec), reps = cur.type === "groove" ? c.repeat : 1, playBars = Array(reps).fill(bars).flat();
    const ev = cur.type === "groove" ? c.playEvents : c.events, ci = meterBar("4/4"), plays = cur.type === "fill" ? c.plays : 2;
    const parts = [];
    for (let k = 1; k <= plays; k++) {
      if (k > 1) parts.push({ kind: "ci", bars: [ci], take: k });
      parts.push({ kind: "app", bars: playBars, events: ev, q0: 0, mod: c.lenBeats, take: k });
    }
    t = timeline(parts, ci);
  } else {
    t = timeline([{ kind: "app", bars: specBars(c.spec), events: toEvents(c.spec, { bpm }), q0: 0 }], meterBar(c.phrases[0].time));
  }
  const t0 = run(t, "listen", bpm);
  if (!(t0 > 0)) return;
  listenStarted = performance.now();
  setPlayState(true);
  if (!$("scoreCard").hidden) { score.movePlayline(0, true); revealScore(); }
}
function finishListen(){
  if (!cur) return;
  if (cur.sys === "rsl") {
    cur.listened++;
    if (phase === "idle") phase = "practice";
    if (mockRes() && mockRes().stage === "listen") { mockRes().stage = "practice"; renderMockCard(); }
    syncButtons();
    if (phase === "practice") say(() => tr("練習:在鼓墊上試打(不計分),時間自己決定。準備好了按「回打」。", "Practise on the pad (not scored) as long as you like. Tap Play back when ready."));
    else say(() => tr("播完了。", "Done."));
  } else say(() => tr("播完了。", "Done."));
}
function setPlayState(on){
  $("playBtn").classList.toggle("is-active", on);
  $("playBtn").setAttribute("aria-label", on ? tr("停止", "Stop") : T("playAria"));
  $("playIcon").setAttribute("d", on ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
}

/* ── 麥克風(選用):回打 / 第二次開始前打開(第一次會問權限)。回傳 true = 這一次用麥克風;false = 照鼓墊(失敗的原因寫在開關下面);
   null = 等的時候離開了 / 換題了 / 被別的動作蓋掉(不要開始) ── */
async function openMic(){
  const c0 = cur, k0 = playKind, mk = mockOn() ? mock.id : 0, tok = starting = Date.now() + Math.random();
  micFail = null; renderMic(); syncButtons(); say(() => tr(...MIC_TEXT.starting));
  const fail = await mic.start();
  // 打開的時候被 iOS 切換工作階段「打斷」(外框 leave + enter,starting 被清掉)而且還在同一題:照樣開始
  const still = (starting === tok || (mic.bumped && !starting)) && active && cur === c0 && playKind === k0 && !(mk && !mock.alive(mk));
  if (starting === tok) starting = 0;
  if (!still) { mic.cancel(); renderMic(); syncButtons(); return null; }
  if (fail) { micFail = fail; announce(tr(...micFailText(fail))); }
  renderMic(); syncButtons();
  // 開麥克風時 iOS 會切換音訊工作階段,AudioContext 可能停一下:叫醒再開始
  const actx = audio.ensureAudio();
  if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
  if (!active || cur !== c0 || playKind !== k0) { mic.cancel(); return null; }
  return !fail;
}
/* App 自己發出的聲音(從第一拍算起的秒數;麥克風會收進去,dropBleed 用):響的拍點 + 時間軸上的鼓聲 */
function appSounds(t, click, bpm){
  const sec = 60 / (bpm * U), out = t.events.map(e => e.beat * sec);
  for (let b = -t.countIn; b < t.len; b++) if (click(b)) out.push(b * sec);
  return out;
}
/* 麥克風錄完 → 鼓墊格式的敲擊([{lane, time}],從第一拍算起的秒數;全部鼓件一條)+ 測試用的紀錄 */
function micTaps(p){
  const take = mic.finish(), hits = take ? take.hits.map(t => t - p.t0) : [];
  const d = dropBleed(hits, appSounds(p.tl, p.click, p.bpm));
  return { taps: d.hits.map(time => ({ lane: MIC_LANES[0].id, time })), silent: !hits.length, hits, d };
}
const micLocked = () => !(ctx && ctx.setMicPref) || playKind === "perform" || playKind === "pass" || !!starting;
/* 開關(正式打中不能改);說明 = 用法,打開失敗時改成原因 */
function renderMic(){
  const box = $("alongMic");
  box.checked = micOn();
  box.disabled = micLocked();
  pairText($("alongMicLabel"), () => tr(...MIC_TEXT.label));
  const note = $("alongMicNote");
  if (!micOn()) micFail = null;   // 開關關掉了(包括在另一個模組關的):忘掉上一次打開失敗的原因
  note.classList.toggle("warn", !!micFail);
  pairText(note, () => tr(...(micFail ? micFailText(micFail) : MIC_TEXT.note)));
}
$("alongMic").onchange = () => { if (ctx && ctx.setMicPref) ctx.setMicPref($("alongMic").checked); micFail = null; renderMic(); };

/* ── 回打(RSL):預備拍 1 小節〔推估〕+ 拍點;鼓墊的時間扣掉第一拍 → 從第一拍算起的秒數 ── */
async function startPerform(){
  if (!cur || starting || mic.opening) return;   // 麥克風打開中(iOS 打斷時外框 leave + enter 會清掉 starting)不能再開始一次
  if (cur.sys !== "rsl") { startPass(); return; }
  if (playKind === "perform") { stopRun(); return; }
  if (playKind) stopPlayer();
  if (!(await ready())) return;
  if (playKind) return;
  let useMic = false;
  if (micOn()) { const m = await openMic(); if (m === null) return; useMic = m; }
  const c = cur.q, bpm = bpmNow(), bars = specBars(c.spec), reps = cur.type === "groove" ? c.repeat : 1;
  const t = timeline([{ kind: "you", bars: Array(reps).fill(bars).flat(), events: [], q0: 0, mod: c.lenBeats }], meterBar("4/4"));
  // 用麥克風時回打中不放拍點(只有預備拍):拍點跟真的鼓同時響,麥克風分不開
  const click = b => (useMic && b >= 0 ? 0 : clickAt(t, b));
  const t0 = run(t, "perform", bpm, click);
  if (!(t0 > 0)) { mic.cancel(); return; }
  phase = "perform";
  perf = { t0, bpm, taps: [], startedAt: performance.now(), tl: t, mic: useMic, click };
  announce(tr("回打開始:預備拍 1 小節後照聽到的打。", "Play back started: after a 1-bar count-in, play what you heard."));
  cur.result = null; $("alongResult").hidden = true;
  syncButtons();
  bringIntoView($("pads"));
}
/* 中途停止(按停止、離開):不算 */
function stopRun(){
  if (playKind === "perform" || playKind === "pass") stopPlayer();
  abortRun();
}
function abortRun(){
  if (!perf) return;
  mic.cancel();   // 中途停止:丟掉這次錄音,不評分
  addSec((performance.now() - perf.startedAt) / 1000);
  perf = null;
  if (phase === "perform") phase = cur && cur.listened ? "practice" : "idle";
  if (phase === "pass") phase = cur && cur.pass ? "between" : "ready";
  syncButtons();
  if (active) say(() => tr("停止了(這一次不算)。", "Stopped (not counted)."));
  // 模擬考:自己按停止 = 這一題「中途停止」;RSL 可以按下一題,Trinity 直接看結果
  const mr = mockRes();
  if (mr) { mr.stopped = true; mr.stage = "done"; if (cur && cur.sys === "trinity") finishMock(); else { renderMockCard(); syncButtons(); } }
}
/* RSL 回打完:照題目的每一個音評節奏(js/shared/timing.js;扣掉整體的固定延遲)→ 練習回饋;Fill 再選譜 */
function finishPerform(){
  if (!perf || !cur) return;
  const p = perf, beatSec = 60 / p.bpm, c = cur.q;
  perf = null;
  const ev = cur.type === "groove" ? c.playEvents : c.events;
  let raw = p.taps, lanes = cur.lanes, silent = false;
  if (p.mic) {
    const m = micTaps(p);
    raw = m.taps; lanes = MIC_LANES; silent = m.silent;
    lastMic = { expected: expectedByLane(hitsOnly(ev), p.bpm, MIC_LANES)[MIC_LANES[0].id], detected: m.d.hits, all: m.hits, removed: m.d.removed, lagMs: m.d.lagMs };
  }
  const taps = raw.filter(x => x.time >= -beatSec / 2);   // 預備拍裡太早的不算
  // 麥克風:整體偏移(裝置的輸入、輸出延遲)不設上限,跟 PianoDrill 視奏的 scoreRhythm 一樣
  const r = scoreLanes(expectedByLane(hitsOnly(ev), p.bpm, lanes), taps, { tempoBpm: p.bpm, ...(p.mic ? { offsetLimit: Infinity } : {}) });
  cur.result = { kind: "rsl", r, taps: taps.length, bpm: p.bpm, src: p.mic ? "mic" : "pad", silent, micFail: p.mic || !micOn() ? null : micFail };
  const st = stat();
  st.n++;
  if (taps.length) { st.hits += r.hits; st.total += r.total; }   // 沒有敲鼓墊(在真的鼓上打):只算題數,不算進命中率
  addSec((performance.now() - p.startedAt) / 1000, 1, taps.length ? r.hits : 0, taps.length ? r.total : 0);
  const mr = mockRes();
  if (mr) { mr.r = cur.result; mr.stage = cur.type === "fill" ? "choose" : "done"; }
  if (cur.type === "fill" && cur.chosen == null && !cur.revealed) {
    phase = "choose";
    showOptions();
    say(() => tr("打完了。從下面的譜選一個。", "Done. Pick the matching chart below."), false, true);
    announce(tr("打完了。", "Done. ") + resultSpeech(cur.result) + tr("從下面的譜選一個。", " Pick the matching chart below."));
  } else {
    phase = "result";
    doReveal();
    say(() => tr("打完了。看下面的正確的譜與練習回饋。", "Done. See the correct chart and the feedback below."), false, true);
    announce(tr("打完了。", "Done. ") + resultSpeech(cur.result));
  }
  renderResult(); syncButtons(); renderStats();
  if (mr) { renderMockCard(); if (mr.stage === "done") mockDoneMsg(); }
  if (ctx) ctx.examChanged();
}
const stat = () => SS.stats[cur.key] || (SS.stats[cur.key] = { n: 0, picks: 0, ok: 0, hits: 0, total: 0 });

/* ── Fill:2 或 3 個印出來的譜(單線譜)── */
function showOptions(){
  $("answers").hidden = false;
  if (!$("answers").children.length) {
    $("answers").innerHTML = cur.opts.map((o, i) => `<button class="ans e-opt" type="button" data-i="${i}"><span class="e-letter">${"ABC"[i]}</span><span class="e-paper"></span></button>`).join("");
  }
  markOptions();
  refreshTexts();
  drawOptions();
  bringIntoView($("quizCard"));
}
$("answers").onclick = e => { const b = e.target.closest(".e-opt"); if (b) choose(Number(b.dataset.i)); };
function choose(i){
  if (!cur || !cur.opts || !(i >= 0 && i < cur.opts.length) || cur.chosen != null || cur.revealed) return;
  if (playKind === "perform") return;
  cur.chosen = i;
  const st = stat(); st.picks = (st.picks || 0) + 1; if (i === cur.answer) st.ok = (st.ok || 0) + 1;
  addSec(0, 0, i === cur.answer ? 1 : 0, 1);   // 今天正確率:選對的譜也算
  phase = "result";
  doReveal();
  feedbackPick();
  renderResult(); syncButtons(); renderStats();
  const mr = mockRes();
  if (mr) { mr.pick = { chosen: i, answer: cur.answer }; mr.stage = "done"; renderMockCard(); syncButtons(); }
  if (ctx) ctx.examChanged();
}
function markOptions(){
  [...$("answers").querySelectorAll(".e-opt")].forEach((b, i) => {
    const done = !!cur && (cur.chosen != null || cur.revealed);
    b.classList.toggle("done", done);
    b.classList.toggle("right", done && i === cur.answer);
    b.classList.toggle("wrong", done && i === cur.chosen && i !== cur.answer);
    b.disabled = done;
    b.setAttribute("aria-label", tr(`選項 ${"ABC"[i]}`, `Option ${"ABC"[i]}`) + (done && i === cur.answer ? tr("(正確)", " (correct)") : "")
      + tr(":", ": ") + describeSpec(cur.opts[i].spec, { key: drumKey() }));   // 無障礙:選項的譜(單線小鼓譜:每個音的時值)
  });
}
/* 選項的譜:一個選項一個 OSMD(單線譜,一小節);畫完照比例縮到格子寬(viewBox) */
const OPT_OSMD = { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
  drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true };
let optJob = null;
async function drawOptions(){
  if (!cur || !cur.opts || typeof opensheetmusicdisplay === "undefined") return;
  if (!active || !$("answers").clientWidth) return;   // 看不到:回到畫面再畫
  const c = cur;
  if (optJob && optJob.c === c) return optJob.p;
  const p = (async () => {
    const boxes = [...$("answers").querySelectorAll(".e-paper")];
    for (let i = c.optsDrawn; i < c.opts.length; i++) {
      const box = boxes[i]; if (!box || cur !== c) return;
      box.innerHTML = "";
      try {
        const o = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OPT_OSMD), xml = c.opts[i].xml;
        setupKit(o, 1, xml);
        await o.load(osmdXML(xml));
        if (cur !== c) return;
        o.zoom = 1; o.render();
        const svg = box.querySelector("svg");
        decorate(o, xml, svg);
        fitSvg(svg);
      } catch (e) { console.error(e); box.textContent = "?"; }
      c.optsDrawn = i + 1;
    }
    if (cur === c && !c.ansLegend) { c.ansLegend = true; $("ansLegend").hidden = false; drawLegend($("ansLegend"), { pieces: ["snare"], lines: 1, key: drumKey() }).catch(e => console.error(e)); }
  })();
  optJob = { c, p };
  try { await p; } finally { if (optJob && optJob.c === c) optJob = null; }
}
/* OSMD 的 SVG:用 viewBox 照比例縮放(寬度跟著格子,不用重畫) */
function fitSvg(svg){
  if (!svg) return;
  const w = parseFloat(svg.getAttribute("width")), h = parseFloat(svg.getAttribute("height"));
  if (!(w > 0 && h > 0)) return;
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.style.width = "100%"; svg.style.height = "auto"; svg.style.maxWidth = Math.round(w) + "px";
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}

/* ── 揭曉:正確的譜(+ Fill 標出答案)── */
function reveal(){
  if (!cur || cur.revealed) return;
  if (playKind === "perform") stopRun();
  if (cur.type === "fill" && $("answers").hidden) showOptions();
  phase = "result";
  doReveal();
  renderResult(); syncButtons();
  say(() => tr("答案在下面。可以按 ▶ 跟著譜再聽一次。", "Answer below. Tap ▶ to hear it again with the chart."));
}
function doReveal(){
  cur.revealed = true;
  markOptions();
  refreshTexts();
  if ($("scoreCard").hidden) { $("scoreCard").hidden = false; requestAnimationFrame(() => { if (active) showScore(); }); }
}

/* ══ Trinity Playback:30 秒看譜 → 第一次(練習)→ 第二次(評時間,每一句分開評)══ */
function startStudy(){
  if (!cur || cur.sys !== "trinity") return;
  if (phase === "study") { endStudy(false); return; }
  if (playKind) { if (playKind === "pass") stopRun(); else stopPlayer(); }
  phase = "study"; left = studySec(); studyStarted = performance.now(); studyEnd = studyStarted + left * 1000;
  $("countdown").hidden = false; $("countdown").className = "countdown running"; $("countdownValue").textContent = String(left);
  showFloat(left);
  say(() => tr("看譜中:可以在鼓墊上試打(不計分)。", "Study the chart; try it on the pads (not scored)."), false, true);
  announce(tr(`開始看譜 ${left} 秒;可以在鼓墊上試打(不計分)。`, `Study started: ${left} seconds; try it on the pads (not scored).`));
  bringIntoView($("scoreCard"));
  clearInterval(countdown);
  countdown = setInterval(() => {
    const l = Math.max(0, Math.ceil((studyEnd - performance.now()) / 1000 - 1e-3));
    if (l !== left) { left = l; $("countdownValue").textContent = String(left); showFloat(left); }
    if (left <= 0) endStudy(true);
  }, 200);
  syncButtons();
}
function endStudy(done){
  if (phase !== "study") return;
  clearInterval(countdown); countdown = 0;
  $("studyFloat").hidden = true;
  addSec((performance.now() - studyStarted) / 1000);
  phase = done ? "ready" : (cur && cur.pass ? "between" : "idle");
  $("countdown").className = done ? "countdown done" : "countdown";
  if (!done) $("countdownValue").textContent = String(studySec());
  syncButtons();
  if (done && mockRes()) { mockRes().stage = "pass1"; renderMockCard(); startPass(); return; }   // 模擬考:時間到自動第一次
  if (done) say(() => tr("看譜時間到。按「第一次(練習)」。", "Time's up. Tap Play 1 (practice)."));
  else if (active) say(idleMsg);
}
function showFloat(sec){
  $("studyFloatValue").textContent = String(sec);
  $("studyFloat").classList.toggle("low", sec <= 5);
  placeFloat();
}
/* 浮動倒數:題目卡的倒數看不到時才出現(頂欄下的右邊) */
function placeFloat(){
  const f = $("studyFloat");
  if (phase !== "study" || !active) { f.hidden = true; return; }
  const header = document.querySelector("header"), top = header ? header.getBoundingClientRect().bottom : 0;
  const bar = document.getElementById("tabbar"), bb = bar ? bar.getBoundingClientRect() : null;
  const bottom = bb && bb.top > innerHeight / 2 ? bb.top : innerHeight;
  const cd = $("countdown").getBoundingClientRect();
  if (cd.height > 0 && cd.top >= top && cd.bottom <= bottom) { f.hidden = true; return; }
  f.hidden = false;
  f.style.top = `${Math.round(top + 8)}px`;
}
window.addEventListener("scroll", () => { if (phase === "study" && active) placeFloat(); }, { passive: true });

/* Trinity 一次(第一次 / 第二次)的時間軸:每一句 App 播一遍 + 同樣長度的空檔 */
function passTimeline(bpm){
  const phs = phrases(bpm), parts = [];
  for (const ph of phs) {
    parts.push({ kind: "app", bars: ph.bars, events: ph.events, q0: ph.q0, phrase: ph.i });
    // 空檔:不排鼓聲,只有拍點(events = [];評分用 phs[i].events)。不用 player 的 gaps:下一句句首的 Flam / Drag 裝飾音
    // 在那一句的第一拍之前(落在這個空檔的尾巴),gaps 會把它靜音;空檔的事件留著又會在上一句的尾巴漏出聲
    parts.push({ kind: "you", bars: ph.bars, events: [], q0: ph.q0, phrase: ph.i });
  }
  return { phs, t: timeline(parts, meterBar(cur.q.phrases[0].time)) };
}
/* 測試用(tools/test/mic-check.mjs):下一次回打 / 第二次,麥克風要聽到的(從第一拍算起的秒數):
   expected = 要打的音(全部鼓件一條)、app = App 自己的鼓聲(Trinity 的那一句)、countIn = 預備拍幾秒 */
function micPlan(){
  if (!cur) return null;
  const bpm = bpmNow(), sec = 60 / (bpm * U);
  if (cur.sys === "rsl") {
    const ev = cur.type === "groove" ? cur.q.playEvents : cur.q.events;
    return { bpm, expected: expectedByLane(hitsOnly(ev), bpm, MIC_LANES)[MIC_LANES[0].id], app: [], countIn: meterBar("4/4").len * sec };
  }
  const { phs, t } = passTimeline(bpm);
  return { bpm, expected: expected({ bpm, tl: t, phs }, MIC_LANES).map(x => x.time), app: t.events.map(e => ({ time: e.beat * sec, piece: e.piece, vel: e.vel })), countIn: t.countIn * sec };
}
async function startPass(){
  if (!cur || cur.sys !== "trinity" || starting || mic.opening) return;   // 麥克風打開中(iOS 打斷時外框 leave + enter 會清掉 starting)不能再開始一次
  if (playKind === "pass") { stopRun(); return; }
  if (mockOn() && phase === "study") return;   // 模擬考:看譜時間不能提早結束
  if (phase === "study") endStudy(false);
  if (playKind) stopPlayer();
  const mk = mockOn() ? mock.id : 0;
  // 模擬考(Trinity 自動第一次 / 第二次):鼓聲載入失敗就中止(按鈕只能停止,不中止會卡住)
  if (!(await ready())) { if (loadFailed && mk && mock.alive(mk) && active) mock.abort("load"); return; }
  if (playKind || (mk && !mock.alive(mk))) return;
  const k = cur.pass >= 1 && phase !== "result" ? 2 : 1;
  // 麥克風(選用):第二次(評時間)才錄;第一次(練習)跟第二次一樣,空檔裡不放拍點
  const wantMic = micOn();
  let useMic = false;
  if (wantMic && k === 2) { const m = await openMic(); if (m === null) return; useMic = m; }
  if (k === 1) { cur.pass = 0; cur.result = null; $("alongResult").hidden = true; }
  const bpm = bpmNow(), { phs, t } = passTimeline(bpm);
  // 開了麥克風:空檔(輪到你打)不放拍點(拍點跟真的鼓同時響,麥克風分不開);App 播的那一句照樣有拍點
  const mute = k === 1 ? wantMic : useMic;   // 第二次麥克風沒打開(照鼓墊評):拍點照常
  const click = b => { if (mute && b >= 0) { const sg = segAt(t, b); if (sg && sg.kind === "you") return 0; } return clickAt(t, b); };
  const t0 = run(t, "pass", bpm, click);
  if (!(t0 > 0)) { mic.cancel(); return; }
  phase = "pass";
  perf = { t0, bpm, taps: [], startedAt: performance.now(), tl: t, pass: k, phs, mic: useMic, click };
  announce(k === 1 ? tr("第一次(練習)開始:App 播一句,接著換你打。", "Play 1 (practice) started: the App plays a phrase, then it's your turn.")
    : tr("第二次(評時間)開始:App 播一句,接著換你打。", "Play 2 (assessed) started: the App plays a phrase, then it's your turn."));
  syncButtons();
  bringIntoView($("pads"));   // 輪到你打時鼓墊要在畫面上
}
function finishPass(){
  if (!perf || !cur) return;
  const p = perf; perf = null;
  addSec((performance.now() - p.startedAt) / 1000, p.pass === 2 ? 1 : 0);
  if (p.pass === 1) {
    cur.pass = 1; phase = "between";
    say(() => tr("第一次(練習)完成,不計分。按「第二次(評時間)」。", "Play 1 (practice) done — not scored. Tap Play 2 (assessed)."));
    syncButtons();
    if (mockRes()) { mockRes().stage = "pass2"; renderMockCard(); say(() => tr("第一次(練習)完成:接著第二次(評時間)。", "Play 1 done: now play 2 (assessed).")); startPass(); }   // 模擬考:自動接第二次
    return;
  }
  cur.pass = 2; phase = "result";
  if (p.mic) {
    const m = micTaps(p);
    cur.result = { ...passResult(p, MIC_LANES, m.taps), src: "mic", silent: m.silent };
    lastMic = { expected: expected(p, MIC_LANES).map(x => x.time), detected: m.d.hits, all: m.hits, removed: m.d.removed, lagMs: m.d.lagMs };
  } else cur.result = { ...passResult(p), src: "pad", micFail: wantMicFail(p) };
  const st = stat(); st.n++;
  if (cur.result.taps) { st.hits += cur.result.all.hits; st.total += cur.result.all.total; addSec(0, 0, cur.result.all.hits, cur.result.all.total); }
  save(); renderLog(); renderStats();
  renderResult(); syncButtons();
  say(() => tr("第二次完成:下面是每一句的節奏練習回饋。", "Play 2 done: rhythm feedback for each phrase below."), false, true);
  announce(tr("第二次完成。", "Play 2 done. ") + resultSpeech(cur.result));
  if (mockRes()) { mockRes().r = cur.result; mockRes().stage = "done"; finishMock(); }   // 模擬考:第二次完成 = 結果
  if (ctx) ctx.examChanged();
}
/* 每一句分開評:那一句空檔裡的敲擊(前後各多收半拍 / 0.4 拍)對那一句的音 */
const wantMicFail = p => (p.pass === 2 && micOn() ? micFail : null);   // 第二次想用麥克風但沒打開:照鼓墊評,結果寫原因
function passResult(p, lanes = cur.lanes, tapsIn = p.taps){
  const sec = 60 / (p.bpm * U), beatSec = 60 / p.bpm, gaps = p.tl.segs.filter(s => s.kind === "you");
  const lim = p.mic ? { offsetLimit: Infinity } : {};   // 麥克風:整體偏移不設上限
  const rows = [], allExp = {}, allTaps = [];
  for (const l of lanes) allExp[l.id] = [];
  gaps.forEach((g, i) => {
    const s0 = g.u0 * sec, s1 = g.u1 * sec, ph = p.phs[i];
    const exp = expectedByLane(hitsOnly(ph.events), p.bpm, lanes);
    const taps = tapsIn.filter(x => x.time >= s0 - beatSec / 2 && x.time < s1 + beatSec * 0.4).map(x => ({ lane: x.lane, time: x.time - s0 }));
    const r = scoreLanes(exp, taps, { tempoBpm: p.bpm, ...lim });
    const c = cur.q.phrases[i];
    rows.push({ i, from: c.start + 1, to: c.start + c.bars, r, taps: taps.length });
    for (const [id, v] of Object.entries(exp)) allExp[id].push(...v.map(t => t + s0));
    allTaps.push(...taps.map(x => ({ lane: x.lane, time: x.time + s0 })));
  });
  const all = scoreLanes(allExp, allTaps, { tempoBpm: p.bpm, ...lim });
  return { kind: "trinity", rows, all, taps: allTaps.length, bpm: p.bpm };
}

/* ── 測試用:回打中,每一個要打的音(lane、從第一拍算起的秒數);Trinity = 每一句的空檔 ── */
function expected(p = perf, lanes = cur && cur.lanes){
  if (!p || !cur) return [];
  const out = [];
  if (cur.sys === "rsl") {
    const ev = cur.type === "groove" ? cur.q.playEvents : cur.q.events, e = expectedByLane(hitsOnly(ev), p.bpm, lanes);
    for (const [lane, v] of Object.entries(e)) for (const t of v) out.push({ lane, time: t });
  } else {
    const sec = 60 / (p.bpm * U);
    p.tl.segs.filter(s => s.kind === "you").forEach((g, i) => {
      const e = expectedByLane(hitsOnly(p.phs[i].events), p.bpm, lanes);
      for (const [lane, v] of Object.entries(e)) for (const t of v) out.push({ lane, time: t + g.u0 * sec });
    });
  }
  return out.sort((a, b) => a.time - b.time);
}
/* 測試用:馬上結束這一輪(當作播完;回打照目前收到的敲擊評) */
function finishNow(){
  if (!playKind) return false;
  const k = playKind; playKind = null; player.stop(true); endRunUI();
  if (k === "listen") finishListen(); else if (k === "perform") finishPerform(); else finishPass();
  return true;
}

/* ══ 觸控鼓墊(Fill 1 個 = 小鼓;Groove / Playback 3 個 = 鈸 / 鼓 / 大鼓與腳踩 HH;鍵盤 J / F / K)══ */
function makePads(lanes){
  return createPads($("pads"), lanes, ({ lane, time }) => {
    if (time == null) return;
    if (perf && perf.mic && (playKind === "perform" || playKind === "pass")) return;   // 用麥克風評分的這一次:鼓墊不出聲(會被麥克風收進去)、不計分
    audio.playKit((cur && cur.padPiece[lane]) || "snare", Math.max(time, audio.audioNow()), 0.72);
    if (perf && (playKind === "perform" || playKind === "pass")) perf.taps.push({ lane, time: time - perf.t0 });
  });
}
let pads = makePads(LANES[1]);

/* ══ 譜:一整行 + 播放軸(js/shared/score.js);鼓組譜照 legend.js 的 setupKit / decorate ══ */
const scoreZoom = () => (window.innerWidth < 600 ? 0.9 : window.innerWidth < 1100 ? 1 : 1.15);
const score = createScore({
  $, zoom: scoreZoom,
  setup: osmd => setupKit(osmd, cur ? cur.lines : 5, cur ? cur.xml : ""),
  afterRender: svg => { if (cur && score.osmd && svg) decorate(score.osmd, cur.xml, svg); },
  lenBeats: () => (cur ? cur.q.lenBeats || sumLen(specBars(cur.q.spec)) / U : null),
  playing: () => playKind === "listen" || playKind === "pass",
  isActive: () => active,
  msg: fn => { $("paperMsg").textContent = fn ? fn() : ""; },
  onDrawn: () => { drawn++; coverChart(); },
  fitLand: () => fitLandZoom(score, { $ }),
  label: () => scoreLabel()
});
/* 無障礙:譜的文字說明(a11y.js;N 小節小鼓譜 / 整組鼓譜、拍號、速度、每小節的簡述) */
function scoreLabel(){
  if (!cur) return "";
  if ($("stage").classList.contains("covered")) return tr("譜蓋起來了", "Chart hidden");
  return describeSpec(cur.q.spec, { key: drumKey(), bpm: bpmNow(), title: `${sysName(cur.sys)} ${gl(cur.grade, cur.sys)}` });
}
function showScore(){
  if (!cur || !cur.xml || $("scoreCard").hidden) return;
  if (score.osmd) setupKit(score.osmd, cur.lines, cur.xml);
  score.load(osmdXML(cur.xml));
  const key = drumKey(), pieces = piecesUsed({ key, ...cur.q.spec }), lk = cur.lines + ":" + pieces.join(",");
  if (key && cur.legendFor !== lk) { cur.legendFor = lk; drawLegend($("legend"), { pieces, lines: cur.lines, key }).catch(e => { console.error(e); if (cur) cur.legendFor = null; }); }
}
/* 不看譜:Trinity 播放中把譜蓋起來 */
function coverChart(){
  const on = !!cur && cur.sys === "trinity" && SS.hideChart && playKind === "pass";
  $("stage").classList.toggle("covered", on);
  if ($("osmd").hasAttribute("role")) imgLabel($("osmd"), scoreLabel);
  if (on) $("paperMsg").textContent = tr("譜蓋起來了(看不看譜自己決定)", "Chart hidden (reading is optional)");
  else if ($("paperMsg").textContent && /蓋起來|hidden/.test($("paperMsg").textContent)) $("paperMsg").textContent = "";
}
const land = createLandPlay({ $, score, playing: () => playKind === "listen" && !$("scoreCard").hidden, stop: () => stopPlayer(), reveal: () => revealScore() });
function revealScore(){
  if (land.reveal()) return;
  bringIntoView($("scoreCard"));
}
/* 卡片沒露出來就捲過去(頂欄下、底部分頁列上) */
function bringIntoView(el){
  if (!el || el.hidden) return;
  const r = el.getBoundingClientRect(), header = document.querySelector("header"), top = header ? header.getBoundingClientRect().bottom : 0;
  const bar = document.getElementById("tabbar"), bt = bar ? bar.getBoundingClientRect().top : innerHeight;
  const bottom = bt > innerHeight / 2 ? bt : innerHeight;
  if (r.top < top + 4) window.scrollBy({ top: r.top - top - 8, behavior: "smooth" });
  else if (r.bottom > bottom - 4) window.scrollBy({ top: Math.min(r.bottom - bottom + 8, r.top - top - 8), behavior: "smooth" });
}
const onStageResize = () => {
  if (!active || !cur) return;
  fitTitle();
  land.onResize();
  if (!$("scoreCard").hidden) score.onResize();
  if (!$("answers").hidden && cur.optsDrawn < cur.opts.length) drawOptions();
};
window.addEventListener("resize", onStageResize);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => requestAnimationFrame(onStageResize)).observe($("stage"));

/* ══ 聲音:整組鼓(Fill 只要小鼓)+ 拍點(js/shared/audio.js;不用合成鼓聲)══ */
let kitJob = null;
/* 每次都問 audio.loadKit(audio.js 自己記住載好的;別的地方 unloadKit 之後會重新載) */
function preload(){
  const full = !!cur && cur.type !== "fill";
  const job = kitJob = (async () => {
    try {
      await audio.loadKit(full ? undefined : ["snare"], p => { if (kitJob === job) loading(p < 1 ? p : null); });
      await audio.loadClick();
      if (kitJob === job) loading(null);
      return true;
    } catch (e) {
      // 還沒載完就被釋放("kit unloaded",離開太久):不是失敗;在聽力就靜靜重新載,不在就等回來(enter 會 preload)
      if (e && e.message === "kit unloaded") { if (kitJob !== job) return false; if (active) return preload(); loading(null); return false; }
      console.error(e);
      if (kitJob === job) loading(null);
      return false;
    }
  })();
  return job;
}
let loadFn = null;
function loading(p){
  loadFn = p == null ? null : () => tr(`載入鼓聲 ${Math.round(p * 100)}%`, `Loading drums ${Math.round(p * 100)}%`);
  $("loadingMsg").textContent = loadFn ? loadFn() : "";
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
/* 叫醒音訊、等取樣;回傳 false = 不能播(取樣沒載到、等的時候離開了 / 換題了) */
let loadFailed = false;   // 最近一次 ready() 是不是因為鼓聲載入失敗(模擬考自動開始的那一步用來決定要不要中止)
async function ready(){
  const token = starting = Date.now() + Math.random(), c0 = cur;
  loadFailed = false;
  syncButtons();
  const actx = audio.ensureAudio();
  if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
  const ok = await preload();
  await within(audio.masterReady, 1500);
  const still = starting === token && active && cur === c0;
  if (starting === token) starting = 0;
  syncButtons();
  if (!ok) { loadFailed = true; say(() => tr("鼓聲載入失敗,再按一次重試(需要網路,之後會存在裝置上)", "Could not load the drums — try again (needs internet once; then cached)")); return false; }
  return still;
}

/* 全部停下來(離開、換題、換級數):播放、看譜的倒數、回打(不算) */
function stopAll(){
  starting = 0;
  if (phase === "study") endStudy(false);
  if (playKind === "perform" || playKind === "pass") stopRun();
  if (playKind) stopPlayer();
  setPlayState(false);
  clearInterval(countdown); countdown = 0;
  $("studyFloat").hidden = true;
  if (!mic.opening) mic.cancel();   // 麥克風一定關掉(回打中停止);正在打開的,等打開之後 openMic 自己判斷要不要關
}

/* ══ 按鈕與文字(換語言時全部重寫;不停播放)══ */
function syncButtons(){
  const has = !!cur, rsl = isRsl(), busy = !!starting, mr = mockRes();
  $("playBtn").disabled = !has || busy && !playKind || !!mr;   // 模擬考:不能重聽、不能聽整份譜
  $("nextBtn").hidden = !!mr && !rsl;
  $("nextBtn").disabled = !has || !!mr && mr.stage !== "done";   // 模擬考:這一題做完才能下一題
  $("revealBtn").hidden = !rsl || !!mr; $("studyBtn").hidden = !has || rsl; $("countdown").hidden = !has || rsl;
  $("revealBtn").disabled = !has || cur.revealed;
  $("studyBtn").disabled = !has || playKind === "pass" || !!mr;   // 模擬考:看譜時間不能提早結束
  lockTempo();
  $("alongMic").disabled = micLocked();
  const pb = $("performBtn");
  pb.disabled = !has || busy && !playKind || rsl && !cur.listened && playKind !== "perform"
    || !!mr && (rsl ? !(mr.stage === "practice" || playKind === "perform") : playKind !== "pass");   // 模擬考:RSL 練習時才能回打、Trinity 自動開始(只能停止)
  renderLabels();
}
function renderLabels(){
  const has = !!cur, rsl = isRsl();
  pairText($("revealLabel"), () => tr("看答案", "Answer"));
  const sfn = () => (phase === "study" ? tr("結束看譜", "End study") : tr(`看譜 ${studySec()} 秒`, `Study ${studySec()} s`));
  pairText($("studyLabel"), sfn); $("studyBtn").setAttribute("aria-label", sfn());
  let lbl;
  if (!has) lbl = () => tr("回打", "Play back");
  else if (rsl) lbl = () => (playKind === "perform" ? tr("停止", "Stop") : tr("準備好了,回打", "Ready — play back"));
  else lbl = () => (playKind === "pass" ? tr("停止", "Stop") : cur.pass >= 1 && phase !== "result" ? tr("第二次(評時間)", "Play 2 (assessed)") : phase === "result" ? tr("再來一次(第一次)", "Again (play 1)") : tr("第一次(練習)", "Play 1 (practice)"));
  $("performBtn").textContent = lbl();
  const mr = mockRes();
  pairText($("nextLabel"), () => (mr ? (mock.data.i >= mock.data.queue.length - 1 ? tr("看結果", "Results") : tr("下一題", "Next")) : T("next")));
  const pl = () => (rsl ? (cur && cur.revealed ? tr("跟著譜再聽一次", "Hear it with the chart") : tr("聽題目(兩次)", "Play the test (twice)")) : tr("聽整份譜(正確版本)", "Hear the whole chart"));
  $("playBtn").setAttribute("aria-label", pl()); $("playBtn").title = pl();
}
const idleMsg = () => (!cur ? "" : isRsl() ? tr("按 ▶ 聽題目:配拍點聽兩次,每次前面 1 小節預備拍。", "Tap ▶: the test plays twice with a click, a 1-bar count-in each time.")
  : tr(`先看譜 ${studySec()} 秒(${studySrc()};可以在鼓墊上試打),再按「第一次(練習)」:App 播一句,你接著打同一句。`, `Study the chart for ${studySec()} s (${studySrc()}; try it on the pads), then Play 1 (practice): the App plays a phrase, you play it back.`));
function refreshTexts(){
  if (!cur) return;
  const c = cur, name = `${sysName(c.sys)} ${gl(c.grade, c.sys)}`;
  $("qTitle").classList.remove("empty");
  $("qTitle").textContent = name;
  pairText($("practiceOnly"), () => tr(`依 ${sysName(c.sys)} ${gl(c.grade, c.sys)}參數的練習 · `, `Practice by ${sysName(c.sys)} ${gl(c.grade, c.sys)} parameters · `) + TS("practiceOnly"));
  $("scoreTitle").textContent = c.sys === "rsl" ? tr("正確的譜", "The answer") : tr("Song chart(App 出題)", "Song chart (App test)");
  $("scoreSub").textContent = c.sys === "rsl" ? V.srcOf("rsl", c.q.src && c.q.src.p) : V.srcOf("trinity", (c.q.src || []).join(", "));
  pairText($("stepQ"), () => (phase === "choose" ? tr("哪一個是剛才的過門?", "Which one did you hear?") : ""));
  pairText($("alongNote"), () => alongNote());
  renderNotes();
  renderMeta(); renderSum(); tempoUI();
  if (lastMsg) say(lastMsg, true);
  if (loadFn) $("loadingMsg").textContent = loadFn();
  if (c.opts && !$("answers").hidden) markOptions();
  renderResult();
  renderLabels();
  coverChart();
  if (active) fitTitle();
}
function alongNote(){
  if (!cur) return "";
  const keys = !showKeys() ? "" : " · " + (cur.lanes.length === 1 ? tr("鍵盤 J / F", "keys J / F") : tr("鍵盤 F 鈸 · J 鼓 · K 大鼓", "keys F cymbal · J drum · K kick"));
  if (isRsl()) return tr(`回打前面 1 小節預備拍(推估:大綱只寫考官數拍)${keys}`, `1-bar count-in before you play (assumed: the syllabus says the examiner counts in)${keys}`);
  return tr(`看譜 ${studySec()} 秒(${studySrc()})· 照抄,不要變化也不要即興 · 官方配伴奏音軌;App 只有拍點${keys}`, `${studySec()} s to study (${studySrc()}) · copy it exactly — no variation or improvising · the exam has a backing track; the App has a click only${keys}`);
}
/* 題目卡的標籤 */
function renderMeta(){
  if (!cur) return;
  const c = cur.q, b = bpmNow(), tags = [];
  if (cur.sys === "rsl") {
    tags.push(cur.type === "fill" ? tr("1 小節 · 小鼓", "1 bar · snare") : tr(`2 小節 · 播 ${c.repeat} 遍`, `2 bars × ${c.repeat}`));
    tags.push(`4/4 · ${TS("srcAssumed")}`, `♩=${b}`);
  } else {
    tags.push(c.times.join(" · "), tr(`${c.totalBars} 小節 · ${c.phrases.length} 句`, `${c.totalBars} bars · ${c.phrases.length} phrases`), `♩=${b} · ${tr("練習", "Practice")}`);
  }
  $("qTags").innerHTML = tags.map(x => `<span class="q-tag"></span>`).join("");
  [...$("qTags").children].forEach((el, i) => { el.textContent = tags[i]; });
  if (active) fitTags();
}
function renderSum(){
  const sys = sysNow(), g = gradeNow(sys);
  const parts = [`${sysName(sys)} ${gl(g, sys)}`];
  if (cur && cur.sys === sys) parts.push(cur.sys === "rsl" ? `♩=${bpmNow()}` : `♩=${bpmNow()} ${tr("練習速度", "practice")}`);
  if (sys === "trinity" && SS.hideChart) parts.push(T("optHide"));
  $("sum").textContent = parts.join(" · ");
}
/* 推估、練習設定、不出的項目(出題器的 NOTES + 這裡的 APP_NOTES) */
const APP_NOTES = {
  ciPerform: { kind: "assumed", text: ["回打前的預備拍 1 小節:大綱只寫考官數拍", "1-bar count-in before playing back: the syllabus only says the examiner counts in"] },
  practiceTime: { kind: "practice", text: ["練習時間自己決定(大綱寫「一小段時間」)", "Practice time is up to you (the syllabus says a short time)"] },
  grooveBack: { kind: "assumed", text: ["回打的長度跟播放一樣(兩小節兩遍)", "You play back as much as was played (2 bars twice)"] },
  tolerance: { kind: "practice", text: ["節奏回饋的容許範圍", "The timing tolerance of the feedback"] },
  tempo80: { kind: "practice", text: ["速度:官方沒寫,預設 ♩=80,可以改", "Tempo: not in the syllabus; ♩=80 by default, adjustable"] },
  countIn: { kind: "assumed", text: ["count-in 1 小節(官方有 count-in,沒寫幾小節)", "1-bar count-in (the syllabus has a count-in, length not stated)"] },
  gapSame: { kind: "assumed", text: ["每一句後面留同樣長度的空檔回打", "After each phrase, a gap of the same length to play it back"] },
  phraseScore: { kind: "practice", text: ["第二次每一句分開評時間", "Play 2 is timed phrase by phrase"] },
  backing: { kind: "omit", text: ["伴奏音軌:官方整段配伴奏,App 只有拍點", "Backing track: the exam has one throughout; the App has a click only"] },
  improv: { kind: "omit", text: ["Improvising:需要伴奏音軌,App 只在檢定頁列規格", "Improvising needs a backing track; spec only (Exams tab)"] }
};
function renderNotes(){
  if (!cur) return;
  const keys = cur.sys === "rsl"
    ? [...cur.q.notes.map(k => EAR_NOTES[k]), APP_NOTES.ciPerform, APP_NOTES.practiceTime, ...(cur.type === "groove" ? [APP_NOTES.grooveBack] : []), APP_NOTES.tolerance]
    : [...cur.q.notes.filter(k => k !== "noTempo").map(k => PB_NOTES[k]), APP_NOTES.tempo80, APP_NOTES.countIn, APP_NOTES.gapSame, APP_NOTES.phraseScore, APP_NOTES.tolerance, APP_NOTES.backing, APP_NOTES.improv];
  const by = kind => keys.filter(n => n && n.kind === kind).map(n => n.text);
  const groups = [["assumed", () => TS("srcAssumed")], ["practice", () => TS("srcPractice")], ["omit", () => tr("App 不出", "Not in the App")]];
  pairText($("notes"), () => groups.map(([k, lbl]) => { const a = by(k); return a.length ? `${lbl()}:${a.map(t => tr(t[0], t[1])).join(tr(";", "; "))}${tr("。", ".")}` : ""; }).filter(Boolean).join(" "));
}
/* Fill 選完的回饋 */
function feedbackPick(){
  const fb = $("feedback");
  fb.classList.remove("ok", "no");
  if (!cur || cur.type !== "fill" || cur.chosen == null) return;
  const ok = cur.chosen === cur.answer;
  fb.classList.add(ok ? "ok" : "no");
  say(() => (ok ? tr(`選對了:${"ABC"[cur.answer]}。`, `Right: ${"ABC"[cur.answer]}.`) : tr(`不是 ${"ABC"[cur.chosen]};答案是 ${"ABC"[cur.answer]}。`, `Not ${"ABC"[cur.chosen]}; it was ${"ABC"[cur.answer]}.`)), true);
}
/* 無障礙:結果的一句話摘要(aria-live 播報;詳細的在 #e-alongResult) */
function resultSpeech(R){
  if (!R) return "";
  if (!R.taps) return R.src === "mic" ? tr(...MIC_TEXT.silent) : tr("沒有收到鼓墊的敲擊。", "No pad hits came in.");
  const r = R.kind === "rsl" ? R.r : R.all;
  return tr(`練習回饋:${R.kind === "rsl" ? `節奏吻合度 ${r.score == null ? "—" : r.score} / 100,` : ""}命中 ${r.hits} / ${r.total}。`,
    `Practice feedback: ${R.kind === "rsl" ? `rhythm match ${r.score == null ? "—" : r.score} / 100, ` : ""}hit ${r.hits} of ${r.total}.`);
}
/* 練習回饋(不是考試分數,不出現等第字眼,也不換算成官方分數) */
function renderResult(){
  const box = $("alongResult"), R = cur && cur.result;
  if (!R) { box.hidden = true; return; }
  box.innerHTML = "";
  const add = (cls, fn) => { const p = document.createElement("p"); if (cls) p.className = cls; box.appendChild(p); pairText(p, fn); return p; };
  const line = r => tr(`命中 ${r.hits} / ${r.total} · 漏 ${r.missed} · 多 ${r.extra} · 平均差 ${r.meanErrorMs} 毫秒(容許 ±${r.toleranceMs} 毫秒)`,
    `Hit ${r.hits} / ${r.total} · missed ${r.missed} · extra ${r.extra} · average ${r.meanErrorMs} ms off (±${r.toleranceMs} ms allowed)`);
  const keys = cur.lanes.length === 1 ? "J / F" : "F / J / K";
  const orKeys = (zh, en) => (showKeys() ? [`${zh},或用鍵盤 ${keys}。`, `${en}, or use keys ${keys}.`] : [`${zh}。`, `${en}.`]);
  const byMic = R.src === "mic";
  if (R.kind === "rsl") {
    add("r-head", () => (byMic ? tr(...MIC_TEXT.head) : tr("練習回饋 · 節奏(觸控鼓墊)", "Practice feedback · rhythm (touch pads)")));
    if (R.micFail) add("", () => tr(...micFailText(R.micFail)));
    const r = R.r;
    if (byMic && (R.silent || !R.taps)) add("", () => tr(...MIC_TEXT.silent));
    else if (!R.taps) add("", () => tr(...orKeys("沒有收到鼓墊的敲擊。回打時點鼓墊", "No pad hits came in. Tap the pads while you play")));
    else {
      const big = document.createElement("div"); big.className = "big"; box.appendChild(big);
      big.innerHTML = `${r.score == null ? "—" : r.score}<small></small>`;
      pairText(big.querySelector("small"), () => tr("/ 100 節奏吻合度", "/ 100 rhythm match"));
      add("", () => line(r));
      const off = offsetNote(r); if (off) add("", () => tr(off[0], off[1]));
      const ln = cur.lanes.length > 1 ? laneNote(r, cur.lanes) : null; if (ln) add("", () => tr(ln[0], ln[1]));
    }
  } else {
    add("r-head", () => (byMic ? tr("練習回饋 · 第二次(麥克風,每一句的節奏)", "Practice feedback · play 2 (mic, rhythm per phrase)") : tr("練習回饋 · 第二次(每一句的節奏)", "Practice feedback · play 2 (rhythm per phrase)")));
    if (R.micFail) add("", () => tr(...micFailText(R.micFail)));
    if (byMic && (R.silent || !R.taps)) add("", () => tr(...MIC_TEXT.silent));
    else if (!R.taps) add("", () => tr(...orKeys("沒有收到鼓墊的敲擊。輪到你打的時候點鼓墊", "No pad hits came in. Tap the pads on your turn")));
    else {
      const ol = document.createElement("ol"); ol.className = "e-phrases"; box.appendChild(ol);
      for (const row of R.rows) {
        const li = document.createElement("li"); ol.appendChild(li);
        const r = row.r;
        pairText(li, () => tr(`第 ${row.i + 1} 句(第 ${row.from}–${row.to} 小節):${r.score == null ? "—" : r.score} / 100 · 命中 ${r.hits} / ${r.total} · 漏 ${r.missed} · 多 ${r.extra}`,
          `Phrase ${row.i + 1} (bars ${row.from}–${row.to}): ${r.score == null ? "—" : r.score} / 100 · hit ${r.hits} / ${r.total} · missed ${r.missed} · extra ${r.extra}`));
      }
      add("", () => tr("全部:", "All: ") + line(R.all));
      const off = offsetNote(R.all); if (off) add("", () => tr(off[0], off[1]));
      const ln = laneNote(R.all, cur.lanes); if (ln) add("", () => tr(ln[0], ln[1]));
    }
  }
  if (byMic) add("disclaimer", () => tr(...MIC_TEXT.disclaimer));
  else add("disclaimer", () => tr("只看敲擊的時間,不看力度與音色;容許範圍是練習設定。這是練習回饋,不是考試分數,也不能換算成官方分數。",
    "Timing only (not dynamics or tone); the tolerance is a practice setting. This is practice feedback, not an exam mark, and it doesn't convert to one."));
  box.hidden = false;
}
const summary = R => (R.kind === "rsl" ? { score: R.r.score, hits: R.r.hits, total: R.r.total, taps: R.taps } : { rows: R.rows.map(x => x.r.score), hits: R.all.hits, total: R.all.total, taps: R.taps });
/* 狀態訊息:記住產生文字的函式,換語言時重寫;keep = 保留 ok / no 的顏色 */
function say(fn, keep, quiet){
  const again = fn === lastMsg;
  if (!again && !quiet) announce(fn());   // 無障礙:換語言重寫、預備拍與每一句的進度(quiet)不播報
  lastMsg = fn;
  if (!keep) $("feedback").classList.remove("ok", "no");
  pairText($("feedback"), fn);
}
/* 題目固定一行:太長就把字縮小(中英文版面一樣);標籤先縮字(最多到 0.6) */
function fitTitle(){
  const el = $("qTitle"); el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize);
  const min = Math.max(14, fs * 0.55);
  while (el.scrollWidth > el.clientWidth + 1 && fs > min) { fs -= 1; el.style.fontSize = fs + "px"; }
  fitTags();
}
function fitTags(){
  const g = $("qTags"); let k = 1; g.style.setProperty("--tag-scale", 1);
  const over = () => g.lastElementChild && g.lastElementChild.getBoundingClientRect().right + 2 > g.getBoundingClientRect().right;
  while (over() && k > 0.6) { k -= 0.04; g.style.setProperty("--tag-scale", k); }
}
/* 圖例裡 pairText 的字換語言(drawLegend 只畫一次) */
function relangPairs(root){ for (const el of root.querySelectorAll("*")) if (el._pair) el.textContent = el._pair[getLang() === "en" ? 1 : 0]; }

$("playBtn").onclick = () => toggleListen();
$("performBtn").onclick = () => startPerform();
$("revealBtn").onclick = () => reveal();
$("studyBtn").onclick = () => startStudy();
$("nextBtn").onclick = () => (mockOn() ? mockNext() : newQuestion());

/* ══ 練習紀錄(js/shared/practicelog.js):回打完一題(Trinity:第二次)算一題;聽、看譜、回打的時間算進今天的秒數(保留 400 天);
   今天正確率 = 今天回打命中的音 + 選對的譜 ÷ 全部(沒有敲鼓墊的回打不算);每週目標 = 最近 7 天的分鐘數(點一下換,存在 SS.goal)══ */
function addSec(sec, n = 0, hits = 0, total = 0){
  addLog(SS.log, { sec, n, hits, total });
  save(); renderLog();
}
function renderLog(){
  paintLog($, SS.log, SS.goal);
  const t = today(SS.log);
  $("logAcc").textContent = t.total ? Math.round(100 * t.hits / t.total) + "%" : "–";
}
$("goalBtn").onclick = () => { SS.goal = nextGoal(SS.goal); save(); renderLog(); };
/* 各題型正確率(設定卡的系統與級數):Fill 選譜(答對 ÷ 選過)、各題型的回打命中率(命中的音 ÷ 該打的音)。練習回饋:檢定頁不放 */
function renderStats(){
  const sys = sysNow(), g = gradeNow(sys), rows = [];
  const st = t => SS.stats[keyOf(sys, g, t)] || null;
  // 做過(cnt > 0)就列出來;沒有敲鼓墊的(在真的鼓上打)沒有命中率,寫「—」
  const add = (name, ok, n, cnt) => { if (cnt) rows.push({ name, p: n ? Math.round(100 * ok / n) : null, cnt }); };
  if (sys === "rsl") {
    const f = st("fill"), gr = st("groove");
    if (f) { add(tr("過門 · 選譜", "Fill · pick"), f.ok, f.picks, f.picks); add(tr("過門 · 回打", "Fill · rhythm"), f.hits, f.total, f.n); }
    if (gr) add(tr("律動 · 回打", "Groove · rhythm"), gr.hits, gr.total, gr.n);
  } else { const p = st("playback"); if (p) add(tr("回打 · 第二次", "Playback · play 2"), p.hits, p.total, p.n); }
  $("statsSub").textContent = `${sysName(sys)} ${gl(g, sys)}`;
  const box = $("statsList");
  box.innerHTML = rows.length ? rows.map(r => `<div class="srow"><span></span><div class="bar"><i class="${r.p != null && r.p < 70 ? "low" : ""}" style="width:${r.p || 0}%"></i></div><small>${r.p == null ? "—" : r.p + "%"} · ${r.cnt}</small></div>`).join("") : `<p class="stats-empty"></p>`;
  [...box.querySelectorAll(".srow > span")].forEach((el, i) => { el.textContent = rows[i].name; });
  const empty = box.querySelector(".stats-empty");
  if (empty) pairText(empty, () => tr("做完幾題之後,這裡會顯示這一級各題型的正確率(選譜答對率、回打命中率)。", "After a few tests, accuracy per test type shows here (picks right, pad hit rate)."));
}

/* ══ 模擬考(S14;js/shared/mock.js)══ */
function startMock(){
  const ex = curExam();
  if (ex.auto || mode !== "exam") return;
  const sys = ex.system, g = ex.grade, queue = sys === "rsl" ? ["fill", "groove"] : ["playback"];
  if (!queue.every(t => practicable(sys, g, t))) return;
  stopAll();
  mock.begin({ sys, grade: g, queue, i: 0, res: [] }, { sys, grade: g });
  mockQuestion(0);
}
/* 第 i 題:出題 → 自動開始(RSL 聽兩次;Trinity 看譜 30 秒) */
function mockQuestion(i){
  const m = mock.data, t = m.queue[i];
  m.i = i; m.res[i] = { type: t, stage: t === "playback" ? "study" : "listen" };
  newQuestion(undefined, { sys: m.sys, g: m.grade, t });
  if (!cur || cur.type !== t) { mock.close(); render(); return; }
  render();
  cardToTop($("mockCard"));
  if (!active) return;
  if (t === "playback") startStudy(); else toggleListen();
}
function mockNext(){
  if (!mockOn()) return;
  const m = mock.data, r = m.res[m.i];
  if (!r || r.stage !== "done") return;
  if (m.i >= m.queue.length - 1) finishMock(); else mockQuestion(m.i + 1);
}
function mockDoneMsg(){
  const m = mock.data, last = m.i >= m.queue.length - 1;
  say(() => (last ? tr("這一題做完了。按「看結果」。", "Done. Tap Results.") : tr("這一題做完了。按「下一題」。", "Done. Tap Next.")), true);
}
function finishMock(){
  mock.finish();
  stopAll();
  render();
  cardToTop($("mockCard"));
  if (ctx) ctx.examChanged();
}
$("mockBtn").onclick = () => {
  if (mock.running()) { mock.close(); stopAll(); render(); return; }   // 停止(不算,回到檢定頁)
  startMock();
};
$("mockClose").onclick = () => { mock.close(); render(); window.scrollTo({ top: 0 }); };
const TYPE_NAME = { fill: "Fill Playback & Recognition", groove: "Groove Recall", playback: "Playback" };
/* 一題的練習回饋(節奏吻合度、選譜對錯、完成與否;不算總分) */
function mockDetail(r){
  return () => {
    if (r.stopped) return tr("中途停止(這一題沒有做完)", "Stopped part-way (not finished)");
    const R = r.r, parts = [];
    if (r.type === "playback" && R) parts.push(tr("第一次(練習)完成", "Play 1 (practice) done"));
    if (R) {
      const x = R.kind === "rsl" ? R.r : R.all;
      parts.push(R.taps && !R.silent ? tr(`${R.kind === "rsl" ? "回打" : "第二次"} · 節奏吻合度 ${x.score == null ? "—" : x.score} / 100 · 命中 ${x.hits} / ${x.total}`, `${R.kind === "rsl" ? "Play-back" : "Play 2"} · rhythm match ${x.score == null ? "—" : x.score} / 100 · hit ${x.hits} / ${x.total}`)
        : R.src === "mic" ? tr(`${R.kind === "rsl" ? "回打" : "第二次"} · 麥克風沒有聽到鼓聲`, `${R.kind === "rsl" ? "Play-back" : "Play 2"} · the mic heard no drums`)
        : tr(`${R.kind === "rsl" ? "回打" : "第二次"} · 沒有收到鼓墊的敲擊`, `${R.kind === "rsl" ? "Play-back" : "Play 2"} · no pad hits`));
    }
    if (r.pick) parts.push(r.pick.chosen === r.pick.answer ? tr(`選譜:選對了(${"ABC"[r.pick.answer]})`, `Pick: right (${"ABC"[r.pick.answer]})`)
      : tr(`選譜:選了 ${"ABC"[r.pick.chosen]},答案是 ${"ABC"[r.pick.answer]}`, `Pick: ${"ABC"[r.pick.chosen]}; it was ${"ABC"[r.pick.answer]}`));
    if (!parts.length) {
      const st = { listen: tr("聽題目(兩次)", "Listening (twice)"), practice: tr("練習:準備好了按「回打」", "Practise, then Play back"), perform: tr("回打中", "Playing back"),
        choose: tr("選譜", "Pick the chart"), study: tr(`看譜 ${studySec()} 秒(不能暫停)`, `Study ${studySec()} s (no pausing)`), pass1: tr("第一次(練習,不計分)", "Play 1 (practice, not scored)"),
        pass2: tr("第二次(評時間)", "Play 2 (assessed)") }[r.stage];
      return st || "";
    }
    return parts.join(tr(";", "; "));
  };
}
function renderMockCard(){
  const ex = curExam(), ms = mock.state, card = $("mockCard");
  card.hidden = mode !== "exam" || (ms === "idle" && ex.auto);
  if (card.hidden) return;
  const { sys, grade: g } = mock.who(ex), name = `${sysName(sys)} ${gl(g, sys)}`;
  const queue = ex.system === "rsl" ? ["fill", "groove"] : ["playback"], ok = !ex.auto && queue.every(t => practicable(ex.system, ex.grade, t));
  const rows = () => mock.data.queue.map((t, i) => {
    const r = mock.data.res[i];
    return { id: String(i + 1), name: () => TYPE_NAME[t], detail: r ? mockDetail(r) : () => tr("還沒開始", "Not started"),
      mark: !r ? "todo" : r.stage !== "done" ? (ms === "run" ? "cur" : "no") : r.stopped ? "no" : "ok" };
  });
  if (ms === "aborted") {
    paintCard($, { title: () => tr("模擬考已中止", "Mock exam stopped"), sub: name, text: () => abortText(mock.reason),
      btn: ok ? { label: () => mockLabel("aborted") } : null, close: { label: () => tr("回到規格", "Back to the spec") } });
    if (active) mock.seen();
    return;
  }
  if (ms === "result") {
    paintCard($, { title: () => tr("模擬考結果", "Mock exam result"), sub: name,
      text: () => (mock.data.res.some(x => x.r && x.r.src === "mic") ? tr("節奏吻合度只看敲擊的時間(觸控鼓墊或麥克風;麥克風全部鼓件一條;練習設定的容許範圍)。", "Rhythm match is timing only (pads or mic; the mic merges all drums; practice-setting tolerance).")
        : tr("節奏吻合度只看觸控鼓墊的敲擊時間(練習設定的容許範圍)。", "Rhythm match is pad timing only (practice-setting tolerance).")),
      rows: rows(), btn: ok ? { label: () => mockLabel("result") } : null, close: { label: () => tr("回到規格", "Back to the spec") } });
    return;
  }
  if (ms === "run") {
    const m = mock.data;
    paintCard($, { title: () => tr("模擬考 · 聽力", "Mock exam · Aural"), sub: sys === "rsl" ? tr(`第 ${m.i + 1} / ${m.queue.length} 題`, `Test ${m.i + 1} / ${m.queue.length}`) : name,
      text: () => (sys === "rsl" ? tr("每一題自動配拍點聽兩次(不能重聽);練習好了按「回打」;Fill 打完再選譜。", "Each test plays twice with a click (no replays); practise, then Play back; for Fill, then pick the chart.")
        : tr(`看譜 ${studySec()} 秒(不能暫停),接著自動第一次(練習)、第二次(評時間)。速度 ♩=${bpmNow()}(${TS("srcPractice")});官方配伴奏音軌,App 只有拍點。`,
          `${studySec()} s to study (no pausing), then play 1 (practice) and play 2 (assessed) run on. ♩=${bpmNow()} (${TS("srcPractice").toLowerCase()}); the exam has a backing track, the App a click only.`)),
      rows: rows(), btn: { label: () => mockLabel("run") } });
    return;
  }
  const d = dataOf(ex.system);
  paintCard($, { title: () => tr("模擬考", "Mock exam"), sub: `${sysName(ex.system)} ${gl(ex.grade, ex.system)}`,
    text: () => (!d ? tr("考試資料還沒載好。", "Exam data isn't loaded yet.") : !ok ? tr("圖例資料還沒載好。", "The drum key isn't loaded yet.")
      : ex.system === "rsl" ? tr(`照考試順序:Fill Playback & Recognition → Groove Recall,各一題。每題配拍點聽兩次(${V.srcOf("rsl", d.ear[ex.grade].src.p)}),練習後回打;Fill 再從印出來的譜選一個。`,
        `In exam order: Fill Playback & Recognition, then Groove Recall, one each. Each plays twice with a click (${V.srcOf("rsl", d.ear[ex.grade].src.p)}); practise, play it back; for Fill, pick the printed chart.`)
      : tr(`Rock & Pop 沒有聽力項目;這是 Session skills Playback 的模擬:看譜 ${studySec()} 秒、播兩次(第一次練習、第二次評時間;${studySrc()})。`,
        `Rock & Pop has no aural test; this mocks Session skills Playback: ${studySec()} s to study, two plays (practice, then assessed; ${studySrc()}).`)),
    btn: ok ? { label: () => mockLabel("idle") } : null });
}
