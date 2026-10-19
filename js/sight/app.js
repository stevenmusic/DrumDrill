/* 視奏模組(docs/STAGES.md S8 + S9 + S10/S11 的介面;卡片、id、流程照 PianoDrill 的視奏:js/sight/app.js、stage.js、docs/sight/CLAUDE.md)。
   外框(js/main.js)負責頂欄、分頁、考試設定與語言;這裡的元素 id 都加 "s-" 前綴。
   - 視奏分頁(自由練習)練讀譜:子項目 = 分類「節奏 / 律動 / 樂譜」(外框的子項目列),難度由 App 自動調整(js/shared/level.js;每個分類各自記)。
     難度 n = 一組已有的出題參數(CAT_LEVELS;App 的練習設定),畫面上不寫考試名稱、級數名、頁碼、practiceOnly:
       節奏 1–4 = 小鼓單線譜(RSL Debut–3 的參數)、律動 1–2 = 整組鼓 8 小節(RSL 4–5 的參數)、樂譜 1–9 = 長譜(Trinity Playback Initial–8 的參數)
     起點:有選考試 → 對應考試級數(startLevel),沒選 → 1;結果下面「太簡單 / 剛好 / 太難」;節奏回饋連續 3 題 ≥ 90 升一級、連續 2 題 < 50 降一級(畫面寫出來)
   - 檢定頁照考試級數出題(「練習這一級的視奏」= 在檢定頁直接出題作答,xp;模擬考),標「依 RSL N 級參數的練習 · 」+ practiceOnly。三種題目(kind):
       snare    RSL Debut–3 小鼓視奏(js/sight/gen.js,照 data/exam-rsl.json sight[g];單線譜、1 個鼓墊)
       kit      RSL 4–5 整組鼓視奏(js/shared/kitgen.js genRslKit;五線鼓組譜、最後 2 小節自由發展〔斜線,推估〕播放只有拍點、3 個鼓墊)
       playback Trinity Initial–8:Rock & Pop 沒有視奏;Session skills Playback 的看譜練習(js/shared/playbackgen.js genChart;
                30 秒看譜〔官方 p.60〕→ 跟拍點打一遍 → 聽正確版本;速度官方沒寫,預設 ♩=80 = 練習設定;官方配伴奏音軌,App 只有拍點)
     RSL 6–8 Quick Study Piece(拍號、時值、速度大綱沒寫)不出題,只有說明 + 規格卡 + 「到視奏頁練律動」;I&I(1–5 級)只列規格
   - 流程:出題 → 準備(RSL 90 秒 / Trinity 看譜 30 秒,官方;節拍器可開可關;可以在鼓墊上試打,不計分)
     → 正式打(預備拍:第一小節的拍號 1 小節〔長度推估〕;拍點可開關;鼓墊 / 鍵盤)→ 結果(鼓墊的節奏回饋〔練習回饋,不是考試分數〕+ 自我檢查清單)
     → 聽正確版本(js/shared/player.js + js/shared/kitevents.js toEvents〔力度的播放音量是練習設定〕;stage.js 畫目前小節的底色與播放軸)
   - 拍點、小節時間軸(換拍號、複拍子):js/sight/meter.js;有 x/8 的譜播放器用八分音符當一拍
   - 整組鼓取樣:audio.loadKit(這一題用到的鼓件);載入時 ▶ 外圈畫進度、▶ 與正式打先不能按(載完才能開始);enter / leave 時 audio.holdKit / dropKit("sight")(視奏、聽力都放掉 60 秒後 audio.js 釋放;回來就取消)
   - 譜像印出來的考卷(PianoDrill 的 fitScore:每行 4 小節、放不下再縮,不小於 0.55;每行 2 小節的最後手段 0.45;同形狀的題目同一個排法與大小、只縮不放大);
     js/shared/kitnotation.js(單線 / 五線)+ 圖例(js/shared/legend.js,每一份譜都有)
   - 檢定頁:考試摘要 + 規格卡(照官方大綱,每項頁碼);不放練習紀錄、練習回饋(不跟配分、等第同一個畫面)
   - leave():停止播放、準備的倒數、正式打(不算分),題目保留;relang():只重寫文字,不停播放
   - 模擬考(S14,js/shared/mock.js):檢定頁的「模擬考」= 出一題 → 照官方準備時間計時、不能暫停也不能提早結束(RSL 90 秒 / Trinity 看譜 30 秒)
     → 時間到自動正式打一次(RSL 用這一題的官方速度;Trinity 官方沒寫速度,用自己的練習速度)→ 結果(.mock-res:準備、正式打的練習回饋;不算總分、不出現等第、不換算官方分數)。
     進行中考試摘要與規格卡藏起來;中途切分頁、背景、重新整理、旋轉 = 中止(回來時說明)
   - 練習紀錄(js/shared/practicelog.js):連續天數、今天題數、今天分鐘 + 每週目標 + 最近 7 天;秒數 = 準備、正式打、聽正確版本的時間;各分類練過題數 + 目前難度(#s-statsCard)
   - 用麥克風評分節奏(選用,S15;js/shared/micrhythm.js;開關 = 外框 drumdrill.v1 的 mic,經 ctx.micPref / setMicPref,聽力共用):
     勾了以後正式打先開麥克風(拿到才開始預備拍),這一次鼓墊不出聲、不計分,正式打只有預備拍的拍點(拍點跟真的鼓同時響分不開);
     打完整段在裝置上找起音(全部鼓件合併成一條,只評時間),預備拍的拍點被收進去的拿掉(dropBleed);拒絕權限 / 沒有麥克風:這一次照鼓墊評分、說明原因
   - localStorage drumdrill.sight.v1:{ metroPractice, clickPerform, bpmOverride:{ "rsl-3": 75, "rhythm-2": 90 }(檢定頁每一級 / 視奏頁每個分類的每個難度), history(出過的題目指紋),
     stats:{ "rsl-3": {n, hits, total} }(檢定頁的題目), cats:{ rhythm: {n, hits, total} }(視奏頁), level:{ rhythm: 2 }、streak(level.js), log:{ 日期: {n, sec} },
     goal(每週目標分鐘), mockRun(進行中的模擬考標記), layout:{ 形狀: {measuresPerLine, zoom} } }
     讀進來先消毒:bpmOverride 夾在 30–240、不是有限數的刪掉;layout 每一項 zoom 夾在 0.45–1、每行小節數不對的刪掉;stats、cats、log 的數字;舊版的 pick 丟掉 */
import { tr, T as TS, scoped, getLang, pairText } from "../shared/i18n.js";
import { playbackFor } from "../shared/examdata.js";
import * as V from "../shared/examview.js";
import * as audio from "../shared/audio.js";
import { createPlayer } from "../shared/player.js";
import { createPads, showKeys } from "../shared/pad.js";
import { LANES, expectedByLane, scoreLanes, offsetNote, laneNote } from "../shared/timing.js";
import { scoreXML, osmdXML, piecesUsed } from "../shared/kitnotation.js";
import { setupKit, decorate, drawLegend } from "../shared/legend.js";
import { imgLabel, announce, describeSpec } from "../shared/a11y.js";
import { toEvents, hitsOnly, specBeats, EVENT_NOTES } from "../shared/kitevents.js";
import { genRslKit, SIGHT_KIT_GRADES, NOTES as KIT_NOTES } from "../shared/kitgen.js";
import { genChart, playbackParams, NOTES as PB_NOTES } from "../shared/playbackgen.js";
import { createTempo } from "../shared/tempo.js";
import { createStage } from "./stage.js";
import { genSnare, SNARE_GRADES } from "./gen.js";
import { timeline, clickAt, barAt } from "./meter.js";
import { createHistory, generateUnique } from "./fingerprint.js";
import { randomSeed } from "./random.js";
import { addLog, cleanLog, renderLog as paintLog, today, nextGoal, cleanGoal } from "../shared/practicelog.js";
import { createMock, abortText, paintCard, resultNote, mockLabel, cardToTop } from "../shared/mock.js";
import { createMicTake, dropBleed, MIC_LANES, MIC_TEXT, micFailText } from "../shared/micrhythm.js";
import { createLevels, levelText, paintVotes } from "../shared/level.js";
import { createReading, cleanRead } from "./reading.js";
import "./strings.js";
const T = scoped("sight");

const $ = id => document.getElementById("s-" + id);
const ROOT = document.getElementById("mod-sight");

/* ── 設定與紀錄(localStorage;讀不到就用預設值)── */
const KEY = "drumdrill.sight.v1";
/* 視奏分頁(自由練習)的三個分類;難度 n = 用哪一組已有的出題參數(App 的練習設定;不自己編更難的參數,到頂就建議換分類) */
const CATS = ["rhythm", "groove", "chart"];
const CAT_LEVELS = {
  rhythm: [0, 1, 2, 3].map(g => ({ sys: "rsl", g })),             // 小鼓單線譜(RSL Debut–3 小鼓視奏的參數)
  groove: [4, 5].map(g => ({ sys: "rsl", g })),                   // 整組鼓 8 小節:律動、段落最後帶過門、最後 2 小節自由發展(RSL 4–5 整組鼓視奏的參數)
  chart: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(g => ({ sys: "trinity", g }))   // 長譜:換拍號、力度、反覆的句子(Trinity Playback Initial–8 的參數)
};
const CAT_NAME = { rhythm: ["節奏", "Rhythm"], groove: ["律動", "Groove"], chart: ["樂譜", "Chart"] };
const CAT_HINT = { rhythm: () => tr("試試律動或樂譜。", "Try Groove or Chart."), groove: () => tr("試試樂譜。", "Try Chart."), chart: null };
const catName = c => tr(...CAT_NAME[c]);
const LAYOUT_KEEP = 100;
const SS = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  s = { metroPractice: true, clickPerform: true, bpmOverride: {}, history: [], stats: {}, cats: {}, log: {}, layout: {}, ...(s || {}) };
  delete s.pick;   // 舊版:視奏分頁選的級數(現在是分類 + 自動難度)
  for (const k of ["bpmOverride", "stats", "cats", "log", "layout"]) if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = {};
  if (!Array.isArray(s.history)) s.history = [];
  for (const [k, v] of Object.entries(s.bpmOverride)) { if (typeof v === "number" && Number.isFinite(v)) s.bpmOverride[k] = Math.max(30, Math.min(240, Math.round(v))); else delete s.bpmOverride[k]; }
  for (const [k, v] of Object.entries(s.layout)) {
    if (v && typeof v === "object" && typeof v.zoom === "number" && Number.isFinite(v.zoom) && [0, 2, 3, 4, 5].includes(v.measuresPerLine)) v.zoom = Math.max(0.45, Math.min(1, v.zoom));
    else delete s.layout[k];
  }
  trimLayout(s.layout);
  const cnt = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  for (const [k, v] of Object.entries(s.stats)) {
    if (!/^(rsl|trinity)-[0-8]$/.test(k) || !v || typeof v !== "object") { delete s.stats[k]; continue; }
    s.stats[k] = { n: cnt(v.n), total: cnt(v.total), hits: Math.min(cnt(v.hits), cnt(v.total)) };
  }
  for (const [k, v] of Object.entries(s.cats)) {
    if (!CATS.includes(k) || !v || typeof v !== "object") { delete s.cats[k]; continue; }
    s.cats[k] = { n: cnt(v.n), total: cnt(v.total), hits: Math.min(cnt(v.hits), cnt(v.total)) };
  }
  s.log = cleanLog(s.log);
  s.goal = cleanGoal(s.goal);
  s.read = cleanRead(s.read);
  return s;
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SS)); } catch (e) {} };
/* 譜面排法只留最近 LAYOUT_KEEP 筆(物件照寫入順序;用到的那一筆 fitScore 會移到最後) */
function trimLayout(o){ const ks = Object.keys(o); for (const k of ks.slice(0, Math.max(0, ks.length - LAYOUT_KEEP))) delete o[k]; }
/* 模擬考(下面「模擬考」一段):中止時停掉播放與計時,在畫面上就馬上畫出說明 */
const mock = createMock({ store: SS, save, onAbort: () => { stopAll(); if (active) { render(); cardToTop($("mockCard")); } } });
const mockOn = () => mode === "exam" && mock.running();
const history = createHistory({ capacity: 60, load: () => SS.history, save: e => { SS.history = e; save(); } });

/* ── 狀態 ── */
let ctx = null, exam = null, active = false, mode = "free";
let freeCat = "rhythm";       // 視奏分頁的分類(外框的子項目)
let xp = false;               // 檢定頁的「練習這一級的視奏」:在檢定頁直接出這一級的題目作答(規格卡、考試摘要藏起來)
let cur = null;               // { key:"rsl-3" | "rhythm-2", free, cat, lv, sys, grade, kind:"snare"|"kit"|"playback", spec(出題參數), test, xml }
let played = false;            // 視奏分頁:這一題打過(打完或停止)了沒有(▶ 打過才出現)
let phase = "idle";           // idle | prep | ready(準備時間到)| perform | result
let left = 0, countdown = 0, prepStarted = 0, prepEnd = 0;   // 倒數照 performance.now() 的終點算(主執行緒卡住也不會變慢)
let perf = null;              // 正式打:{ t0, bpm, taps:[{lane, time}], startedAt }
let playKind = null;          // 播放器正在播的:"metro"(準備時節拍器)| "perform" | "listen"
let lastResult = null;
let lastMsg = null;
let starting = 0;
const mic = createMicTake();  // 麥克風(選用):正式打時錄一整段
let micFail = null;           // 上一次打開麥克風失敗的原因(denied / none / error;下一次成功或改開關時清掉)
let lastMic = null;           // 測試用(tools/test/mic-check.mjs):上一次麥克風的 { expected, detected, removed, lagMs }(從第一拍算起的秒數)
const micOn = () => !!(ctx && ctx.micPref && ctx.micPref());

const curExam = () => exam || { system: "trinity", grade: 1, auto: true };
const keyOf = (sys, g) => `${sys}-${g}`;
/* 自動難度(js/shared/level.js):起點 = 考試級數換算(節奏 = 級數 0–3 夾住、律動 = 4–5 級用那一級,更高用最高、其他最低、樂譜 = 級數 + 1);沒選考試 = 1 */
function startLevel(cat){
  const ex = curExam();
  if (ex.auto) return 1;
  const g = ex.grade;
  if (cat === "rhythm") return Math.min(g, 3) + 1;
  if (cat === "groove") return g >= 4 ? Math.min(g, 5) - 3 : 1;
  return g + 1;
}
const levels = createLevels({ store: SS, save, max: Object.fromEntries(CATS.map(c => [c, CAT_LEVELS[c].length])), start: startLevel });
/* 現在要出哪一題:檢定頁照考試級數;視奏分頁照分類與難度 */
function target(){
  if (mode === "exam") { const ex = curExam(); return { free: false, sys: ex.system, g: ex.grade, key: keyOf(ex.system, ex.grade) }; }
  const cat = CATS.includes(freeCat) ? freeCat : "rhythm", lv = levels.get(cat), L = CAT_LEVELS[cat][lv - 1];
  return { free: true, cat, lv, sys: L.sys, g: L.g, key: `${cat}-${lv}` };
}
/* 題目卡、譜的說明、設定卡用的名字:檢定頁「RSL 3 級」;視奏分頁「節奏 · 難度 2」 */
const lvName = lv => tr(`難度 ${lv}`, `Level ${lv}`);
const curName = c => (c.free ? `${catName(c.cat)} · ${lvName(c.lv)}` : `${sysName(c.sys)} ${gl(c.grade, c.sys)}`);
/* 題目在畫面上(視奏分頁、模擬考進行中、檢定頁的練習) */
const xpOn = () => mode === "exam" && xp && !mock.running();
const readOn = () => mode === "free" && freeCat === "read";
const freeQ = () => mode === "free" && !readOn() && !!cur && cur.free;   // 視奏分頁(自由練習)的題目
const onPage = () => (mode === "free" && !readOn()) || mockOn() || xpOn();
/* 認譜(視奏分頁的第一格;js/sight/reading.js):一題一個記號,答一題算一題練習 */
const reading = createReading({ $, store: SS.read, save, drumKey: () => drumKey(), onAnswered: sec => addSec(sec, 1) });
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
/* 鼓墊的鍵盤字(1 個鼓墊:J / F;3 個:F / J / K) */
const keysText = ls => (ls.length === 1 ? [].concat(ls[0].key) : ls.map(l => [].concat(l.key)[0])).map(k => k.toUpperCase()).join(" / ");
const isKitKind = k => k === "kit" || k === "playback";
const lanesOf = c => (c && isKitKind(c.kind) ? LANES[3] : LANES[1]);

/* ══ 外框呼叫 ══ */
export async function start(c){
  ctx = c; exam = c.exam;
  renderLog(); renderStats(); renderMic();
  window.__sight = {
    get state(){ const p = player.state; return { phase, play: p.playing, kind: playKind, timer: !!countdown, left, key: cur && cur.key, grade: cur && cur.grade, mode: cur && cur.kind,
      bpm: cur ? bpmNow() : null, drawn, pending: pendingDraw, systems: stage ? stage.systems : 0, loading, loaded: sampleOk, lanes: pads.lanes.length,
      result: lastResult ? { ...lastResult.r, taps: lastResult.taps } : null, taps: perf ? perf.taps.length : 0, unloadPending: audio.kitRelease.pending,
      sent: p.sent, failed: p.failed, dropped: p.dropped, mic: micOn(), micFail, micActive: mic.active }; },
    get lastMic(){ return lastMic; },
    /* 測試用(tools/test/mic-check.mjs):正式打時麥克風要聽到的(從第一拍算起的秒數;全部鼓件一條)、預備拍幾秒 */
    micPlan(){ if (!cur) return null; const b = bpmNow(); return { bpm: b, expected: expectedByLane(hitsOnly(eventsAt(b)), b, MIC_LANES)[MIC_LANES[0].id],
      pieces: hitsOnly(eventsAt(b)).map(e => ({ time: e.beat * 60 / b, piece: e.piece, vel: e.vel })), countIn: cur.test.tl.countIn.len * 60 / b }; },
    get test(){ return cur && cur.test; }, get xml(){ return cur && cur.xml; }, get osmd(){ return osmd; }, get timeline(){ return cur && cur.test.tl; },
    eventsAt: b => (cur ? eventsAt(b) : []),
    newTest, startPrep, startPerform, toggleListen, setBpm: v => setBpm(v), SS,
    /* 測試用:視奏分頁的分類與難度、檢定頁的「練習這一級的視奏」 */
    get cat(){ return freeCat; }, reading, level: c => levels.get(c || freeCat), setLevel: (c, n) => { levels.set(c, n); renderLevel(); renderStats(); }, startXp: () => startXp(), get xp(){ return xpOn(); },
    /* 測試用:舊的「視奏分頁某一級」換成新架構的同一組參數(RSL 0–3 = 節奏、4–5 = 律動、Trinity = 樂譜,難度設成那一組;RSL 6–8 不出題 → 檢定頁的視奏) */
    goto(sys, g){
      const cat = CATS.find(c => CAT_LEVELS[c].some(L => L.sys === sys && L.g === g));
      if (!cat) { ctx.showView("exam", "sight"); return null; }
      levels.set(cat, CAT_LEVELS[cat].findIndex(L => L.sys === sys && L.g === g) + 1);
      ctx.showView("sight", cat); return cat;
    },
    /* 測試用:正式打中馬上結束、照目前收到的敲擊出結果(Trinity 8 級一首要打很久;layout / bilingual / clip 看結果畫面用) */
    finishNow(){ if (phase === "perform" && playKind === "perform") { playKind = null; player.stop(true); tempo.showBeat(null); finishPerform(); } }, get layout(){ return lastLayout; }, perfT0: () => (perf ? perf.t0 : null),
    get unloadMs(){ return audio.kitRelease.ms; }, set unloadMs(v){ audio.kitRelease.ms = v; },   // 等待時間在 audio.js(視奏、聽力共用)
    get mock(){ return { state: mock.state, reason: mock.reason, stage: mock.data ? mock.data.stage : null, result: mock.data && mock.data.result ? { ...mock.data.result.r, taps: mock.data.result.taps } : null }; },
    startMock: () => startMock(),
    /* 測試用:模擬考的準備時間馬上到(90 秒太久) */
    mockSkipPrep(){ if (mockOn() && phase === "prep") { prepEnd = performance.now(); } }
  };
  window.__playback = { get playing(){ return player.state.playing; } };   // human.mjs:「不在畫面上的模組沒有在播放」
}
export function enter(t){
  active = true;
  if (mock.running() && t !== "exam") mock.abort("leave");   // 模擬考進行中離開檢定頁 = 中止
  audio.holdKit("sight");   // 回來了:不釋放整組鼓
  mode = t === "exam" ? "exam" : "free";
  if (mode === "free" && (CATS.includes(t) || t === "read")) freeCat = t;
  const had = cur;
  renderMic();   // 開關跟聽力共用:在聽力改過就照新的
  render();
  // 同一題:在別的分頁時延後的譜、寬度變了的,回到畫面再畫(新題目 render 裡已經畫了);整組鼓被釋放過就重新載
  if (onPage() && cur && cur === had && !$("quiz").hidden) {
    if (pendingDraw || innerWidth !== renderedWidth) requestAnimationFrame(() => drawCurrent());
    preload();
  }
  if (onPage() && cur && !$("quiz").hidden) requestAnimationFrame(() => { if (active) fitTitle(); });
}
/* 離開(切分頁、切到背景):停止播放、準備的倒數、正式打(不算分);題目保留;模擬考進行中就中止(回來時說明)。放掉整組鼓(聽力也沒拿著的話 60 秒後釋放,小鼓保留) */
export function leave(){
  active = false;
  reading.leave();
  // 打開麥克風 / 錄完時 iOS 切換音訊工作階段造成的「打斷」(外框 leave + enter):不是使用者離開,模擬考不中止
  if (!mic.shielded) mock.abort("leave");
  stopAll();
  audio.dropKit("sight");
}
export function setExam(ex){
  const same = exam && ex && exam.system === ex.system && exam.grade === ex.grade && !!exam.auto === !!ex.auto;
  exam = ex;
  // 換了考試或級數:進行中的模擬考中止;結果收起來
  if (!same) { if (!mock.abort("exam") && mock.state === "result") mock.close(); }
  if (!same && active) render();
}
/* 外框的 appCtx(考試資料、圖例)晚到 */
export function onCtx(){ renderMic(); if (active) render(); if (ctx) ctx.examChanged(); }
/* 換語言:只重寫文字(不停止播放、不重新出題) */
export function relang(){
  if (mode === "exam" || !cur || $("quiz").hidden) { if (active || mode === "exam") renderStatic(); }
  $("play").setAttribute("aria-label", playKind === "listen" ? tr("停止", "Stop") : T("playAria"));
  refreshTexts();
  pads.relang(); renderMic(); renderLevel();
  if (readOn()) reading.relang();
  relangPairs($("legend"));
  renderLog(); renderStats();
  if (mode === "exam") renderMockCard();
}
export function examStatus(){
  const ex = curExam(), n = (SS.stats[keyOf(ex.system, ex.grade)] || {}).n || 0;
  if (ex.system === "trinity") return tr(`Playback 看譜 ${n} 題`, `Playback charts: ${n}`);
  if (ex.grade <= 5) return tr(`已練 ${n} 題`, `${n} practised`);
  return tr("只列規格", "Spec only");
}
export function onKey(e){
  if (readOn()) return;
  if (!onPage() || !cur || $("quiz").hidden) return;
  if (pads.key(e)) return;   // J / F(小鼓)、F / J / K(鈸 / 鼓 / 大鼓與腳踩 HH)= 鼓墊
  if (e.code === "Space") {
    e.preventDefault();       // 不要捲動頁面
    if (phase === "perform") stopPerform();
    else if (freeQ() && !played) startPerform();   // 視奏分頁還沒打過(▶ 還沒出現):空白鍵 = 正式打
    else if (!$("play").disabled) toggleListen();
  } else if ((e.key === "n" || e.key === "N") && !mockOn() && !$("generate").disabled) newTest();   // 模擬考中不能換題(換題會繞過「不能提早結束」)
}

/* ══ 畫面:檢定頁(規格 / 練習這一級 / 模擬考)/ 視奏分頁(分類 + 自動難度)══ */
function render(){
  const isExam = mode === "exam";
  // 檢定頁的練習只在模擬考沒有進行、沒有結果時;這一級不出題(RSL 6–8)、沒選考試就回到規格
  if (xp && (!isExam || mock.state !== "idle" || curExam().auto || !practicable(curExam().system, curExam().grade))) { if (isExam) xp = false; }
  const run = isExam && mock.running(), only = isExam && (mock.state === "result" || mock.state === "aborted"), xpo = xpOn();
  ROOT.classList.toggle("mock-run", run);
  // 檢定頁不放練習紀錄;模擬考進行中、結果、檢定頁的練習:考試摘要(配分、等第)與規格卡藏起來(練習回饋不跟等第放在同一個畫面)
  ROOT.querySelectorAll(".pane").forEach(el => { el.hidden = !isExam || run || only || xpo; });
  $("logCard").hidden = $("statsCard").hidden = isExam;
  if (isExam) { $("rdCard").hidden = $("rdOpts").hidden = true; reading.leave(); }
  renderLevel();
  if (run || xpo) {
    showPractice(true); $("setup").hidden = run; $("unsupported").hidden = true; $("specCards").hidden = true;
    if (xpo && (!cur || cur.free || cur.key !== target().key)) newTest();
    renderMockCard(); refreshTexts(); syncButtons();
    if (pendingDraw && active) requestAnimationFrame(() => drawCurrent());   // 出題時卡片還藏著(寬度 0):現在畫
    return;
  }
  if (isExam) { stopAll(); showPractice(false); $("unsupported").hidden = true; $("specCards").hidden = only; renderExam(); renderMockCard(); return; }
  $("mockCard").hidden = true;
  renderStats();
  // 認譜:只有認譜的兩張卡;視奏的卡片都收起來
  const rd = readOn();
  $("rdCard").hidden = $("rdOpts").hidden = !rd;
  if (rd) { stopAll(); showPractice(false); $("unsupported").hidden = true; $("specCards").hidden = true; if (drumKey()) reading.enter(); return; }
  reading.leave();
  const t = target();
  if (!practicable(t.sys, t.g)) { stopAll(); showPractice(false); renderUnsupported(); return; }
  showPractice(true); $("unsupported").hidden = true; $("specCards").hidden = true;
  // 同一個分類有題目就不重新出題(難度改了從下一題開始)
  if (!cur || !cur.free || cur.cat !== t.cat) newTest();
  else refreshTexts();
}
/* 只有說明卡的畫面重寫文字(換語言) */
function renderStatic(){
  if (mode === "exam") { if (!mock.running() && !xpOn()) renderExam(); return; }
  if (readOn()) return;
  const t = target();
  if (!practicable(t.sys, t.g)) renderUnsupported();
}
function showPractice(on){ for (const id of ["setup", "quiz", "scoreCard", "along"]) $(id).hidden = !on; }

/* 視奏分頁出不了題:出題資料或圖例資料還沒到(第一次要連網路)。不放規格卡、不寫考試名稱 */
function renderUnsupported(){
  $("unsupported").hidden = false;
  const t = target(), d = dataOf(t.sys);
  const title = !d ? () => tr("出題資料還沒載好", "Test data not loaded") : () => tr("圖例資料還沒載好", "Drum key not loaded");
  V.pairStack($("unsupportedTitle"), title);
  pairText($("unsupportedText"), () => tr("第一次要連網路,之後會存在裝置上。", "Needs internet once; then it's cached."));
  pairText($("unsupportedNote"), () => "");
  $("specCards").hidden = true; $("specCards").innerHTML = "";
}
/* 設定卡的難度(視奏分頁才有):「難度 3」+ ▲ ▼,旁邊小字「難度階段由 App 安排(練習設定)」 */
function renderLevel(){
  const row = $("levelRow"), show = mode === "free" && !readOn();
  row.hidden = !show;
  if (!show) return;
  const cat = freeCat, lv = levels.get(cat), max = levels.max(cat);
  $("levelVal").textContent = lvName(lv);
  $("lvDown").disabled = lv <= 1 || phase === "perform";
  $("lvUp").disabled = lv >= max || phase === "perform";
  $("lvDown").setAttribute("aria-label", tr("難度降一級", "Level down")); $("lvUp").setAttribute("aria-label", tr("難度升一級", "Level up"));
  pairText($("levelNote"), () => tr(`${catName(cat)}難度 1–${max} · 難度階段由 App 安排(練習設定)`, `${catName(cat)} levels 1–${max} · set by the App (practice setting)`));
}
/* ▲ ▼:馬上換一題這個難度的 */
function stepLevel(d){
  if (mode !== "free" || readOn() || phase === "perform") return;
  const was = levels.get(freeCat), lv = levels.step(freeCat, d);
  renderLevel(); renderStats();
  if (lv !== was) { announce(tr(`${catName(freeCat)}難度 ${lv}`, `${catName(freeCat)} level ${lv}`)); newTest(); }
}
$("lvDown").onclick = () => stepLevel(-1);
$("lvUp").onclick = () => stepLevel(1);

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
/* 「去練習」按鈕:onClick = 在檢定頁出這一級的題目(startXp)/ 到視奏分頁 */
function goButton(c, label, onClick){
  const b = document.createElement("button");
  b.className = "xcat s-go"; b.type = "button";
  b.innerHTML = '<span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  pairText(b.querySelector("span"), label);
  b.onclick = onClick;
  const w = document.createElement("div"); w.className = "xcats"; w.appendChild(b); c.appendChild(w);
  return b;
}

/* withPractice = 檢定頁:有出題的級數加「練習這一級的視奏」(在檢定頁直接出題作答) */
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
    if (withPractice && !curExam().auto && kindOf("rsl", g)) goButton(c, () => tr("練習這一級的視奏(App 出題)", "Practise this grade (App tests)"), startXp);
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
    // 練讀譜:到視奏分頁的「律動」(整組鼓讀譜,難度由 App 調整;不是 QSP)
    if (!curExam().auto && kindOf("rsl", 5)) goButton(c, () => tr("到視奏頁練整組鼓讀譜(律動;不是 QSP)", "Practise kit reading in Sight-reading (Groove; not a QSP)"), () => ctx.showView("sight", "groove"));
  }
}

/* Trinity:Rock & Pop 沒有視奏;Playback 的規格(累積白名單)+「練習 Playback 看譜」(App 依參數出的看譜練習) */
function renderTrinity(d, g, withPractice){
  const pb = playbackFor(g, d);
  if (!pb || !d.playback) { V.addPara(card(() => tr("Playback(看譜)", "Playback (chart)")), () => tr("考試資料還沒載好(第一次要連網路,之後會存在裝置上)。", "Exam data isn't loaded yet (needs internet once; then it's cached).")); return; }
  const key = drumKey(), src = V.srcOf("trinity", pb.src.join(", "));
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
    else goButton(c, () => tr("練習 Playback 看譜(App 出題)", "Practise Playback charts (App tests)"), startXp);
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
  const tg = target(), { sys, g } = tg, kind = kindOf(sys, g);
  if (!practicable(sys, g)) return;
  const P = paramsOf(sys, g, kind);
  let test;
  try { test = generateUnique(() => makeTest(kind, P, randomSeed(), g), history).score; }
  catch (e) { console.error(e); say(() => tr("出題失敗:", "Could not make a test: ") + e.message); return; }
  setTest(tg, kind, P, test);
}
/* 指定題目(tg = target():檢定頁的系統與級數 / 視奏分頁的分類與難度) */
function setTest(tg, kind, P, test){
  const { sys, g } = tg;
  cur = { key: tg.key, free: tg.free, cat: tg.cat || null, lv: tg.lv || null, sys, grade: g, kind, spec: P, test, xml: null, padCym: "hh" };
  if (kind !== "snare") cur.padCym = mainCymbal(eventsAt(bpmNow()));
  phase = "idle"; lastResult = null; perf = null; played = false;
  $("alongResult").hidden = true; showChecklist(null);
  $("countdown").hidden = false; $("countdown").className = "countdown"; $("countdownValue").textContent = String(prepSec());
  ensurePads();
  try { cur.xml = scoreXML({ ...test.score, key: drumKey() }); }
  catch (e) { console.error(e); say(() => tr("譜產生失敗:", "Could not build the score: ") + e.message); }
  $("generate").disabled = false;
  tempoUI();
  refreshTexts();
  say(startMsg);
  drawCurrent();
  preload();
  syncButtons();
}
const startMsg = () => (freeQ() ? tr("先看譜,準備好就按「正式打」。", "Read it, then press Perform.") : cur && cur.kind === "playback"
  ? tr("先按「看譜」看 30 秒,或直接「正式打」。", "Study 30 s (tap Study), or just Perform.")
  : tr("按「準備」看譜,或直接「正式打」。", "Prep when ready, or just Perform."));
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
const bpmNow = () => (cur ? (mockOn() && cur.kind !== "playback" ? cur.test.bpm : SS.bpmOverride[cur.key] || cur.test.bpm) : 80);   // 模擬考:RSL 照這一題的官方速度
const officialRange = () => (cur && cur.kind !== "playback" ? cur.spec.bpm : null);
const officialBpm = b => { const r = officialRange(); return !!r && b >= r[0] && b <= r[r.length - 1]; };
const custom = () => !!(cur && SS.bpmOverride[cur.key]);
const overridden = () => custom() && !officialBpm(bpmNow());
const tempo = createTempo({ $, min: 30, max: 240, get: () => bpmNow(), set: v => setBpm(v) });
tempo.setBeats(4);
function setBpm(v){
  if (!cur || phase === "perform" || mockOn()) return;   // 正式打中不改(評分照開始時的速度);模擬考中不改
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
  pairText($("bpmReset"), () => (pb || cur.free ? tr("預設速度", "Default tempo") : T("bpmReset")));
  if (cur.free) {
    // 視奏分頁:不寫官方速度、頁碼;這個難度的預設速度是練習設定
    const def = pb ? `♩=${PB_BPM}` : V.bpmText(cur.spec.bpm);
    pairText($("tempoNote"), () => (overridden() || (pb && custom()) ? tr(`練習速度(這個難度預設 ${def})`, `Practice tempo (level default ${def})`)
      : tr(`這個難度的預設速度 ${def} · ${TS("srcPractice")}`, `Level default ${def} · ${TS("srcPractice")}`)));
  } else if (pb) pairText($("tempoNote"), () => (custom() ? tr(`練習速度(官方沒寫速度;預設 ♩=${PB_BPM})`, `Practice tempo (not in the syllabus; default ♩=${PB_BPM})`)
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
  $("title").textContent = curName(c);
  $("scoreSub").textContent = c.free ? "" : t.src;
  $("scoreTitle").textContent = tr(...SCORE_TITLE[c.kind]);
  // 視奏分頁不寫「依 RSL N 級參數」、practiceOnly(那些在檢定頁);題目卡的大標題 = 分類 · 難度
  $("practiceOnly").hidden = c.free;
  if (c.free) pairText($("practiceOnly"), () => "");
  else pairText($("practiceOnly"), () => (c.kind === "playback" ? tr(`依 Trinity Playback ${gl(c.grade, c.sys)}參數的練習 · `, `Practice by Trinity Playback ${gl(c.grade, c.sys)} parameters · `)
    : tr(`依 RSL ${gl(c.grade, c.sys)}參數的練習 · `, `Practice by RSL ${gl(c.grade, c.sys)} parameters · `)) + TS("practiceOnly"));
  // 題目卡上的說明:整組鼓的自由發展;Trinity 這是 Playback 的看譜練習(Rock & Pop 沒有視奏)
  const note = $("modeNote");
  note.hidden = c.kind === "snare" || (c.free && c.kind === "playback");
  if (c.kind === "kit" && c.free) {
    const a = t.develop.from + 1, b = t.develop.from + t.develop.bars;
    pairText(note, () => tr(`第 ${a}–${b} 小節是自由發展(斜線):照前面的風格自己打,不評分;播放時只有拍點。`,
      `Bars ${a}–${b} are a development (slashes): carry on in style — not scored; playback is click only.`));
  } else if (c.kind === "kit") {
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
  pairText($("alongNote"), () => (c.free ? tr(`預備拍 ${ci} 小節`, `${ci}-bar count-in`) : c.kind === "playback"
    ? tr(`預備拍 ${ci} 小節(官方有預備拍;長度${TS("srcAssumed")})`, `${ci}-bar count-in (count-in is official; length ${TS("srcAssumed").toLowerCase()})`)
    : tr(`預備拍 ${ci} 小節(${TS("srcAssumed")}:大綱沒寫)`, `${ci}-bar count-in (${TS("srcAssumed").toLowerCase()}: not stated)`))
    + (showKeys() ? tr(`· 鍵盤 ${keys}`, ` · keys ${keys}`) : ""));
  renderConfidence();
  if (lastMsg) say(lastMsg);
  showChecklist(checkKind);
  renderResult();
  if (active) fitTitle();
}
/* 推估 / 練習設定 / 不出的說明(出題器的 NOTES 小字;每一題各自的) */
function renderConfidence(){
  const c = cur, t = c.test;
  if (c.free) {
    pairText($("confidence"), () => tr("難度階段、節奏型、速度與預備拍都是 App 的練習設定。", "Levels, patterns, tempo and count-in are App practice settings."));
    return;
  }
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
    const ci = t.tl.countIn.bars, first = (t.times || [t.time])[0];
    items.push({ kind: "assumed", text: [`預備拍的長度(第一小節的拍號 ${first} ${ci} 小節)大綱沒寫`, `Count-in length (${ci} bar${ci > 1 ? "s" : ""} of ${first}) not stated`] });
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
  const metre = cur.kind === "snare" ? (cur.free ? "4/4" : `4/4 · ${TS("srcAssumed")}`) : pb ? t.times.join(" ") : t.time;
  const tags = cur.free ? [metre, tr(`${t.bars} 小節`, `${t.bars} bars`), overridden() || (pb && custom()) ? `♩=${b} · ${tr("練習", "Practice")}` : `♩=${b}`]
    : [metre, tr(`${t.bars} 小節`, `${t.bars} bars`), pb ? `♩=${b} · ${custom() ? tr("練習", "Practice") : TS("srcPractice")}` : overridden() ? `♩=${b} · ${tr("練習", "Practice")}` : `♩=${b}`];
  $("meta").innerHTML = tags.map(x => `<span class="q-tag">${x}</span>`).join("");
  imgLabel($("score"), scoreLabel);   // 速度改了:譜的說明跟著改
  if (active) fitTags();
}
function renderSum(){
  if (!cur) return;
  const pb = cur.kind === "playback";
  $("sum").textContent = [curName(cur), `♩=${bpmNow()}${overridden() || (cur.free && pb && custom()) ? " " + tr("練習速度", "practice") : pb && !cur.free ? " " + tr("練習設定", "practice") : ""}`,
    tr("節拍器", "Metronome") + " " + (SS.metroPractice ? tr("開", "on") : tr("關", "off"))].join(" · ");
}
function renderPrepareLabel(){
  const sec = prepSec(), pb = cur && cur.kind === "playback";
  const fn = () => (phase === "prep" ? (mockOn() ? (pb ? tr("看譜中…", "Studying…") : tr("準備中…", "Preparing…")) : pb ? tr("結束看譜", "End study") : tr("結束準備", "End prep")) : pb ? tr(`看譜 ${sec} 秒`, `Study ${sec} s`) : tr(`準備 ${sec} 秒`, `Prep ${sec} s`));
  pairText($("prepareLabel"), fn);
  $("prepare").setAttribute("aria-label", fn());   // 窄畫面(≤340)只剩圖示時,螢幕閱讀器還是念得到
}
function renderAlongLabel(){ $("playAlong").textContent = $("performTop").textContent = phase === "perform" ? tr("停止", "Stop") : T("perform"); renderMic(); renderLevel(); }
/* 麥克風開關(選用):正式打中不能改;說明 = 用法,打開失敗時改成原因 */
function renderMic(){
  const box = $("alongMic");
  box.checked = micOn();
  box.disabled = !(ctx && ctx.setMicPref) || phase === "perform" || !!starting;
  pairText($("alongMicLabel"), () => tr(...MIC_TEXT.label));
  const note = $("alongMicNote");
  if (!micOn()) micFail = null;   // 開關關掉了(包括在另一個模組關的):忘掉上一次打開失敗的原因
  note.classList.toggle("warn", !!micFail);
  pairText(note, () => tr(...(micFail ? micFailText(micFail) : MIC_TEXT.note)));
}
$("alongMic").onchange = () => { if (ctx && ctx.setMicPref) ctx.setMicPref($("alongMic").checked); micFail = null; renderMic(); };
/* 狀態訊息:記住產生文字的函式,換語言時重寫;兩種語言保留比較高的高度 */
/* 無障礙:同一個訊息重寫(換語言)、載入百分比、預備拍的每一下(quiet)不播報;其他的寫進共用的 aria-live 區(a11y.js) */
function say(fn, quiet){
  const again = fn === lastMsg;
  lastMsg = fn; pairText($("message"), fn);
  if (!again && !quiet && !fn.loadMsg) announce(fn());
}
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
    const pieces = piecesUsed({ ...c.test.score, key }), lk = c.test.lines + ":" + pieces.join(",") + (c.free ? ":plain" : "");
    if (lk !== legendKey) { legendKey = lk; drawLegend($("legend"), { pieces, lines: c.test.lines, key, plain: c.free }).catch(e => { console.error(e); legendKey = ""; }); }
  }
}
/* 無障礙:譜的文字說明(N 小節小鼓譜 / 整組鼓譜、拍號、速度、每小節的簡述;a11y.js) */
function scoreLabel(){
  if (!cur) return "";
  return describeSpec(cur.test.score, { key: drumKey(), bpm: bpmNow(), title: curName(cur) });
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
  delete SS.layout[shape]; SS.layout[shape] = chosen; trimLayout(SS.layout); save();
  lastLayout = { ...chosen, systems: r.layout.systems.length };
}
let resizeTimer = 0, lastW = innerWidth;
window.addEventListener("resize", () => {
  if (!active || !cur || innerWidth === lastW) return;   // 只看寬度(iOS 捲動時網址列收放只改高度)
  lastW = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (active && onPage()) drawCurrent(); }, 200);
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
let sampleJob = null, sampleKey = "", sampleGen = -1, sampleOk = false, loading = null, msgBeforeLoad = null;
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
  if (sampleJob && sampleKey === k && sampleGen === audio.kitGeneration()) return sampleJob;   // 釋放過(kitGeneration 變了)就重新載
  sampleKey = k; sampleGen = audio.kitGeneration(); sampleOk = false;
  const kitLoad = need.length > 1;
  setLoading(kitLoad ? 0 : null);
  const job = sampleJob = (async () => {
    try {
      await audio.loadKit(need, p => { if (sampleJob === job && kitLoad) setLoading(p); });
      await audio.loadClick();
      if (sampleJob === job) { sampleOk = true; setLoading(null); }
      return true;
    } catch (e) {
      if (sampleJob !== job) return false;
      sampleJob = null; sampleKey = "";
      // 還沒載完就被 unloadKit 釋放("kit unloaded",離開太久):不是失敗;在視奏就靜靜重新載,不在就等回來(enter 會 preload)
      if (e && e.message === "kit unloaded") { if (active && cur) return preload(); setLoading(null); return false; }
      // 載入失敗(網路):下次按播放 / 正式打再試
      setLoading(null); if (kitLoad && active && cur) say(loadFailMsg);
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
  // 訊息列只在還沒開始(idle)時寫百分比;準備、正式打、結果的訊息不蓋掉(進度看 ▶ 外圈)。載完還原先前的訊息
  if (on && active && phase === "idle") {
    if (!(lastMsg && lastMsg.loadMsg)) msgBeforeLoad = lastMsg;
    const fn = () => tr(`載入整組鼓取樣… ${Math.round((loading || 0) * 100)}%`, `Loading the kit… ${Math.round((loading || 0) * 100)}%`);
    fn.loadMsg = true; say(fn);
  } else if (!on && was != null && lastMsg && lastMsg.loadMsg) { say(msgBeforeLoad || startMsg, true); msgBeforeLoad = null; }
}
/* 視奏分頁(自由練習)的題目卡只有兩顆:左邊小的「新題目」、右邊大的「正式打」(進行中變停止);沒有準備倒數(官方準備時間留在檢定頁),
   鼓墊卡沒有「正式打」長條鈕。▶(聽正確版本)還沒打過這一題前不顯示(visibility 保留位置,標題行不跳),打完或停止才出現;檢定頁照舊 */
function syncFree(){
  const free = freeQ();
  $("quiz").classList.toggle("free", free);
  $("prepare").hidden = free;
  if (free) $("countdown").hidden = true;
  $("playAlong").hidden = free;
  $("generate").classList.toggle("small", free);
  $("play").style.visibility = free && !played ? "hidden" : "";
}
function syncButtons(){
  syncFree();
  const ok = !!(cur && cur.xml), busy = loading != null, mk = mockOn();
  // 模擬考:不能聽正確版本、不能換題、準備時間不能提早結束;準備中不能開始正式打(時間到自動開始)
  $("play").disabled = !ok || busy || mk;
  $("playAlong").disabled = !ok || (busy && phase !== "perform") || (mk && phase === "prep");
  $("prepare").disabled = !ok || mk;
  $("generate").hidden = mk;
  $("performTop").disabled = $("playAlong").disabled;
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
      if (n !== countShown) { countShown = n; say(() => tr(`預備拍 ${n}`, `Count-in ${n}`), true); }
      return;
    }
    if (countShown !== 0) { countShown = 0; say(() => (playKind === "perform" ? tr("正式打中…", "Performing…") : tr("正確版本播放中…", "Playing the correct version…"))); }
    if (!stage) return;
    if (q < tl.len) { const r = barAt(tl, q); stage.update(r.i + 1, r.progress); }
    else stage.update(cur.test.bars, 1);
  },
  onEnd: () => {
    const k = playKind; playKind = null; tempo.showBeat(null);
    if (k === "listen") listenSec();
    if (k === "perform") finishPerform();
    else if (k === "listen") { endListenUI(); say(() => tr("播完了。可以再正式打一次,或換新題目。", "Done. Perform again, or try a new test.")); }
  },
  onStop: () => {   // 播放器自己停(頁面切到背景):按鈕回到原本的樣子
    const k = playKind; playKind = null; tempo.showBeat(null);
    if (k === "listen") listenSec();
    if (k === "perform") abortPerform();
    if (k === "listen") endListenUI();
  }
});
function stopPlayer(){ const k = playKind; playKind = null; player.stop(true); tempo.showBeat(null); if (k === "listen") listenSec(); return k; }
/* 聽正確版本的時間也算進今天的練習(真的播放的秒數) */
let listenStarted = 0;
function listenSec(){ if (listenStarted) { addSec((performance.now() - listenStarted) / 1000); listenStarted = 0; } }
/* 照時間軸播一輪:events 的 beat 是四分音符;clickFn(q, c) → 拍點(c = meter.js 的拍點強弱;q = 四分音符拍子) */
function playTimeline({ events, bpm, tail = 0, clickFn }){
  const tl = cur.test.tl, u = tl.unit;
  return player.play({ events: events.map(e => ({ ...e, beat: e.beat / u })), lenBeats: (tl.len + tail) / u, bpm: bpm / u, countInBeats: tl.countIn.len / u,
    click: x => clickFn(x * u, clickAt(tl, x)) });
}

/* 正式打的預備拍裡真的響的拍點(從第一拍算起的秒數;麥克風會收進去,dropBleed 用) */
function countInClicks(p){
  const tl = cur.test.tl, u = tl.unit, n = Math.round(tl.countIn.len / u), out = [];
  for (let x = -n; x < 0; x++) if (p.clickFn(x * u, clickAt(tl, x))) out.push(x * u * 60 / p.bpm);
  return out;
}

/* ── 準備(RSL 90 秒:準備加練習 / Trinity 看譜 30 秒,可以試打;節拍器可開可關;鼓墊可以試打,不計分)── */
function startPrep(){
  if (!cur) return;
  if (phase === "prep") { endPrep(false); return; }   // 「結束準備」
  if (phase === "perform") stopPerform();
  if (playKind === "listen") stopListening();
  phase = "prep"; left = prepSec(); prepStarted = performance.now(); prepEnd = prepStarted + left * 1000;
  lastResult = null;   // 上一次的練習回饋清掉(換語言時 renderResult 不會把它叫回來)
  $("countdown").hidden = false; $("countdown").className = "countdown running"; $("countdownValue").textContent = String(left);
  showFloat(left);
  showChecklist("prep");
  $("alongResult").hidden = true;
  renderPrepareLabel();
  say(() => (cur && cur.kind === "playback" ? tr("看譜中:可以在鼓墊上試打(不計分)。", "Studying: you may try it on the pads (not scored).")
    : tr("準備中:看譜,在鼓墊上試打(不計分)。", "Preparing: read it and try it on the pad (not scored).")), true);
  announce((cur && cur.kind === "playback" ? tr(`開始看譜 ${left} 秒`, `Study started: ${left} seconds`) : tr(`開始準備 ${left} 秒`, `Prep started: ${left} seconds`)) + tr(";可以在鼓墊上試打(不計分)。", "; you may try it on the pads (not scored)."));
  bringScoreIntoView();
  clearInterval(countdown);
  countdown = setInterval(() => {
    const l = Math.max(0, Math.ceil((prepEnd - performance.now()) / 1000 - 1e-3));
    if (l !== left) { left = l; $("countdownValue").textContent = String(left); showFloat(left); }
    if (left <= 0) endPrep(true);
  }, 200);
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
  if (done && mockOn()) { mock.data.stage = "perform"; renderMockCard(); say(() => tr("準備時間到:正式打一次。", "Time's up: perform it once.")); startPerform(); return; }   // 模擬考:時間到自動正式打
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
  if (!cur || starting || mic.opening) return;   // 麥克風打開中(iOS 打斷時外框 leave + enter 會清掉 starting)不能再開始一次
  if (phase === "perform") { stopPerform(); return; }
  if (mockOn() && phase === "prep") return;   // 模擬考:準備時間不能提早結束
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer(), endListenUI();
  const mk = mockOn() ? mock.id : 0;
  if (!(await ready())) { if (mk && mock.alive(mk)) syncButtons(); return; }
  if (playKind || phase === "perform" || (mk && !mock.alive(mk))) return;
  // 用麥克風評分(選用):先打開麥克風(第一次會問權限),拿到才開始預備拍;拿不到 = 這一次照鼓墊評分(說明原因)
  let useMic = false;
  if (micOn()) {
    const c0 = cur, tok = starting = Date.now() + Math.random();
    micFail = null; renderMic(); say(() => tr(...MIC_TEXT.starting));
    const fail = await mic.start();
    // 打開的時候被 iOS 切換工作階段「打斷」(外框 leave + enter,starting 被清掉)而且還在同一題:照樣開始
    const still = (starting === tok || (mic.bumped && !starting)) && active && cur === c0 && !playKind && phase !== "perform" && !(mk && !mock.alive(mk));
    if (starting === tok) starting = 0;
    if (!still) { mic.cancel(); renderMic(); return; }
    if (fail) { micFail = fail; announce(tr(...micFailText(fail))); } else useMic = true;
    renderMic();
    // 開麥克風時 iOS 會切換音訊工作階段,AudioContext 可能停一下:叫醒再開始
    const actx = audio.ensureAudio();
    if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
    if (!active || cur !== c0 || playKind || phase === "perform") { mic.cancel(); return; }
  }
  const b = bpmNow(), len = cur.test.tl.len;
  // 拍點:預備拍一定有;正式打中照「拍點」開關。用麥克風時正式打中不放拍點(拍點跟真的鼓同時響,麥克風分不開)
  const clickFn = (q, c) => (q >= len - 1e-6 ? 0 : q < 0 ? c : SS.clickPerform && !useMic ? c : 0);
  const t0 = playTimeline({ events: [], bpm: b, tail: TAIL, clickFn });
  if (!(t0 > 0)) { mic.cancel(); return; }   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "perform"; phase = "perform"; countShown = null;
  perf = { t0, bpm: b, taps: [], startedAt: performance.now(), mic: useMic, clickFn };
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
  mic.cancel();   // 中途停止:丟掉這次錄音,不評分
  if (perf) addSec((performance.now() - perf.startedAt) / 1000);
  perf = null; phase = "idle"; stage && stage.end();
  if (freeQ()) played = true;
  renderAlongLabel(); renderPrepareLabel(); syncButtons();
  if (active) say(() => (freeQ() ? tr("停止了(不算)。按 ▶ 對照正確版本,或新題目。", "Stopped (not counted). Press ▶ to compare, or New test.") : tr("停止了(這一次不算)。", "Stopped (not counted).")));
  if (mockOn()) { mock.data.stopped = true; mock.finish(); render(); cardToTop($("mockCard")); }   // 模擬考:自己按停止 = 結束(正式打記「中途停止」)
}
/* 打完:照題目的每一個音評節奏(js/shared/timing.js;扣掉整體的固定延遲)→ 練習回饋 + 自我檢查;算一題練習。
   整組鼓:3 個鼓墊各自配對(鈸 / 鼓 / 大鼓與腳踩 HH);裝飾音不算(hitsOnly);自由發展的小節不評分(那裡的敲擊不算多打) */
function finishPerform(){
  if (!perf || !cur) return;
  const p = perf, beatSec = 60 / p.bpm;
  let lanes = lanesOf(cur), raw = p.taps, silent = false;
  perf = null; phase = "result"; if (stage) stage.end();
  const events = hitsOnly(eventsAt(p.bpm));
  if (p.mic) {
    // 麥克風:整段錄完才找起音(全部鼓件一條);預備拍的拍點被收進去的拿掉
    const take = mic.finish(), hits = take ? take.hits.map(t => t - p.t0) : [];
    const d = dropBleed(hits, countInClicks(p));
    lanes = MIC_LANES; silent = !hits.length;
    raw = d.hits.map(time => ({ lane: MIC_LANES[0].id, time }));
    lastMic = { expected: expectedByLane(events, p.bpm, MIC_LANES)[MIC_LANES[0].id], detected: d.hits, all: hits, removed: d.removed, lagMs: d.lagMs, filled: take ? take.filled : 0 };
  }
  const expected = expectedByLane(events, p.bpm, lanes);
  let taps = raw.filter(x => x.time >= -beatSec / 2);   // 預備拍裡太早的不算
  let devTaps = 0;
  if (cur.test.develop && cur.test.develop.bars) {
    const devStart = cur.test.tl.bars[cur.test.develop.from].start * beatSec, tol = Math.min(0.16, Math.max(0.07, beatSec / 4));
    const near = t => events.some(e => Math.abs(e.beat * beatSec - t) <= tol);
    const keep = taps.filter(x => x.time < devStart - 1e-3 || near(x.time));
    devTaps = taps.length - keep.length; taps = keep;
  }
  // 麥克風:整體偏移(裝置的輸入、輸出延遲)不設上限,跟 PianoDrill 視奏的 scoreRhythm 一樣
  const r = scoreLanes(expected, taps, { tempoBpm: p.bpm, ...(p.mic ? { offsetLimit: Infinity } : {}) });
  lastResult = { r, taps: taps.length, devTaps, bpm: p.bpm, practice: cur.free ? overridden() || (cur.kind === "playback" && custom()) : !officialBpm(p.bpm), pb: cur.kind === "playback", lanes,
    src: p.mic ? "mic" : "pad", silent, micFail: p.mic || !micOn() ? null : micFail, free: cur.free, cat: cur.cat };
  // 視奏分頁:節奏回饋自動升降難度(連續 3 題 ≥ 90 升、連續 2 題 < 50 降;沒有敲擊的不算),寫在結果裡
  if (cur.free) {
    const R = lastResult, ch = taps.length && !silent ? levels.auto(cur.cat, r.score) : null;
    R.lv = levels.get(cur.cat);
    if (ch) R.lvText = () => levelText({ auto: ch });
    renderLevel(); renderSum();
  }
  const bucket = cur.free ? SS.cats : SS.stats, bkey = cur.free ? cur.cat : cur.key;
  const st = bucket[bkey] || (bucket[bkey] = { n: 0, hits: 0, total: 0 });
  st.n++;
  if (taps.length) { st.hits += r.hits; st.total += r.total; }   // 沒有敲鼓墊、麥克風沒聽到(例如在真的鼓上打、沒開麥克風):只算題數,不算進命中率
  addSec((performance.now() - p.startedAt) / 1000, 1);
  if (freeQ()) played = true;
  renderAlongLabel(); renderPrepareLabel(); syncButtons();
  renderResult();
  showChecklist("self");
  say(() => (freeQ() ? tr("按 ▶ 對照正確版本,或新題目。", "Press ▶ to compare, or New test.") : tr("打完了。看下面的練習回饋;按 ▶ 聽正確版本,或按「新題目」再一題。", "Done. See the feedback below; tap ▶ to hear it, or New test for another.")), true);
  announce(tr("打完了。", "Done. ") + resultSpeech(lastResult) + (lastResult.lvText ? " " + lastResult.lvText() : ""));
  if (mockOn()) { mock.data.result = lastResult; mock.finish(); render(); cardToTop($("mockCard")); }   // 模擬考:正式打完 = 結果
  renderStats();
  if (ctx) ctx.examChanged();
}
/* 無障礙:結果的一句話摘要(aria-live 播報;詳細的在 #s-alongResult) */
function resultSpeech(R){
  if (!R) return "";
  if (!R.taps) return R.src === "mic" ? tr(...MIC_TEXT.silent) : tr("沒有收到鼓墊的敲擊。", "No pad hits came in.");
  const r = R.r;
  return tr(`練習回饋:節奏吻合度 ${r.score == null ? "—" : r.score} / 100,命中 ${r.hits} / ${r.total}。`, `Practice feedback: rhythm match ${r.score == null ? "—" : r.score} / 100, hit ${r.hits} of ${r.total}.`);
}
/* 練習回饋(不是考試分數,不出現等第字眼,也不換算成官方分數) */
function renderResult(){
  const box = $("alongResult"), R = lastResult;
  if (!R) { box.hidden = true; return; }
  const r = R.r, multi = R.lanes.length > 1, byMic = R.src === "mic";
  box.innerHTML = "";
  const add = (cls, fn) => { const p = document.createElement("p"); if (cls) p.className = cls; box.appendChild(p); pairText(p, fn); return p; };
  add("r-head", () => (byMic ? tr(...MIC_TEXT.head) : tr("練習回饋 · 節奏(觸控鼓墊)", "Practice feedback · rhythm (touch pads)")));
  if (R.micFail) add("", () => tr(...micFailText(R.micFail)));
  if (byMic && (R.silent || !R.taps)) {
    add("", () => tr(...MIC_TEXT.silent));
  } else if (!R.taps) {
    add("", () => (showKeys() ? tr(`沒有收到鼓墊的敲擊。正式打時點鼓墊,或用鍵盤 ${keysText(R.lanes)}。`,
      `No pad hits came in. Tap the pads while you perform, or use keys ${keysText(R.lanes)}.`)
      : tr("沒有收到鼓墊的敲擊。正式打時點鼓墊。", "No pad hits came in. Tap the pads while you perform.")));
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
  const pbOff = R.pb && !R.free;
  const tempoZh = pbOff ? `速度 ♩=${R.bpm}(練習設定;官方沒寫速度)。` : R.practice ? `這一次用練習速度 ♩=${R.bpm}。` : "";
  const tempoEn = pbOff ? ` Tempo ♩=${R.bpm} (practice setting; not in the syllabus).` : R.practice ? ` Practice tempo ♩=${R.bpm} this time.` : "";
  if (byMic) add("disclaimer", () => tr(MIC_TEXT.disclaimer[0] + tempoZh, MIC_TEXT.disclaimer[1] + tempoEn));
  else add("disclaimer", () => tr(`只看敲擊的時間,不看力度與音色${multi ? "(鬼音也算一下:鼓墊沒有力度)" : ""};容許範圍是練習設定。這是練習回饋,不是考試分數,也不能換算成官方分數。${tempoZh}`,
    `Timing only (not dynamics or tone${multi ? "; ghost notes count as hits — the pads have no dynamics" : ""}); the tolerance is a practice setting. This is practice feedback, not an exam mark, and it doesn't convert to one.${tempoEn}`));
  // 下一步(結果不要停在死畫面):聽正確版本 / 再一題
  add("r-next", () => (mockOn() ? "" : tr("下一步:按 ▶ 聽正確版本,或按「新題目」再一題。", "Next: tap ▶ to hear it, or New test for another.")));
  // 視奏分頁:這一題的難度「太簡單 / 剛好 / 太難」(+1 / 0 / −1;自動升降的那一句也寫在這裡)
  if (R.free && R.cat) paintVotes(box, R, v => vote(R, v));
  box.hidden = false;
}
function vote(R, v){
  if (R !== lastResult || !R.free) return;
  const from = R.lv != null ? R.lv : levels.get(R.cat), to = levels.vote(R.cat, R, v), max = levels.max(R.cat), cat = R.cat;
  R.lvText = () => levelText({ vote: v, from, to, max, hint: CAT_HINT[cat] });
  const keep = document.activeElement && document.activeElement.closest(".diff-fb") ? v : null;
  renderResult(); renderLevel(); renderSum(); renderStats();
  if (keep) { const b = $("alongResult").querySelector(`.diff-fb [data-v="${keep}"]`); if (b) b.focus({ preventScroll: true }); }
  announce(R.lvText());
}
$("playAlong").onclick = () => startPerform();
$("performTop").onclick = () => startPerform();

/* ── 觸控鼓墊(小鼓視奏 1 個,鍵盤 J / F;整組鼓 3 個 = 鈸 / 鼓 / 大鼓與腳踩 HH,鍵盤 F / J / K):正式打時記時間,其他時候試打(出聲、不計分)── */
let pads = null;
function ensurePads(){
  const lanes = lanesOf(cur);
  if (pads && pads.lanes === lanes) return;
  if (pads) pads.destroy();
  pads = createPads($("pads"), lanes, ({ lane, time }) => {
    if (time == null) return;
    if (phase === "perform" && perf && perf.mic) return;   // 用麥克風評分的這一次:鼓墊不出聲(會被麥克風收進去)、不計分
    audio.playKit(padPiece(lane), Math.max(time, audio.audioNow()), 0.72);
    if (phase === "perform" && perf) perf.taps.push({ lane, time: time - perf.t0 });
  });
}
ensurePads();

/* ── 聽正確版本(預備拍 + 拍點照「正式打的拍點」設定;自由發展的小節一定有拍點,沒有鼓聲)── */
async function toggleListen(){
  if (!cur || starting) return;
  if (playKind === "listen") { stopListening(); announce(tr("停止播放", "Playback stopped")); return; }   // 只有使用者按停止才播報
  if (phase === "perform") stopPerform();
  if (phase === "prep") endPrep(false);
  if (playKind) stopPlayer();
  if (!(await ready())) return;
  if (playKind || phase === "perform") return;
  const t0 = startListen(bpmNow());
  if (!(t0 > 0)) return;   // 看不到(背景)時 play() 回 NaN:不切按鈕
  playKind = "listen"; countShown = null; listenStarted = performance.now();
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
  $("play").setAttribute("aria-label", on ? tr("停止", "Stop") : T("playAria"));
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
  if (!mic.opening) mic.cancel();   // 麥克風一定關掉(正式打中停止);正在打開的,等打開之後 startPerform 自己判斷要不要關
}

/* ══ 練習紀錄(js/shared/practicelog.js):正式打完一題算一題;準備、正式打、聽正確版本的時間算進今天的秒數(保留 400 天);
   每週目標 = 最近 7 天的分鐘數(點一下換目標,存在 SS.goal)══ */
function addSec(sec, n = 0){
  addLog(SS.log, { sec, n });
  save(); renderLog();
}
function renderLog(){
  paintLog($, SS.log, SS.goal);
  $("logMin").textContent = Math.floor(today(SS.log).sec / 60);
}
$("goalBtn").onclick = () => { SS.goal = nextGoal(SS.goal); save(); renderLog(); };
/* 各分類練過題數 + 目前難度(視奏分頁的題目;長條 = 鼓墊或麥克風的節奏命中率,練習回饋,檢定頁不放) */
function renderStats(){
  $("statsSub").textContent = "";
  const box = $("statsList");
  box.innerHTML = CATS.map(c => {
    const st = SS.cats[c] || { n: 0, hits: 0, total: 0 }, p = st.total ? Math.round(100 * st.hits / st.total) : null;
    return `<div class="srow"><span>${catName(c)} · ${lvName(levels.get(c))}</span><div class="bar"><i class="${p != null && p < 70 ? "low" : ""}" style="width:${p || 0}%"></i></div><small>${tr(`${st.n} 題`, `${st.n}`)}${p != null ? ` · ${p}%` : ""}</small></div>`;
  }).join("");
}

/* ══ 模擬考(S14;js/shared/mock.js):一題,照官方準備時間計時(不能暫停、不能提早結束)→ 時間到自動正式打一次 → 結果 ══ */
function startMock(){
  const ex = curExam();
  if (ex.auto || mode !== "exam" || !practicable(ex.system, ex.grade)) return;
  stopAll(); xp = false;
  mock.begin({ sys: ex.system, grade: ex.grade, stage: "prep", result: null, stopped: false }, { sys: ex.system, grade: ex.grade });
  newTest();
  if (!cur || cur.key !== keyOf(ex.system, ex.grade)) { mock.close(); render(); return; }
  render();
  cardToTop($("mockCard"));
  startPrep();
  say(() => (cur && cur.kind === "playback" ? tr(`模擬考:看譜 ${prepSec()} 秒(不能暫停),時間到自動正式打一次。`, `Mock: ${prepSec()} s to study (no pausing); then you perform it once.`)
    : tr(`模擬考:準備 ${prepSec()} 秒(不能暫停),時間到自動正式打一次。`, `Mock: ${prepSec()} s to prepare (no pausing); then you perform it once.`)));
}
$("mockBtn").onclick = () => {
  if (mock.running()) { mock.close(); stopAll(); render(); return; }   // 停止(不算,回到檢定頁)
  startMock();
};
/* 檢定頁的「練習這一級的視奏」:在檢定頁直接出這一級的題目(準備 → 正式打 → 回饋 → 正確版本);考試摘要、規格卡藏起來,模擬考卡當標題列(回到規格 / 開始模擬考) */
function startXp(){
  const ex = curExam();
  if (mode !== "exam" || mock.running() || ex.auto || !practicable(ex.system, ex.grade)) return;
  if (mock.state !== "idle") mock.close();
  xp = true; render();
  // 兩欄(≥1100):題目卡在右欄最上面 → 捲回頂端;一欄:模擬考卡(回到規格)跟題目卡一起放得下就捲到模擬考卡,放不下(手機橫式)捲到題目卡
  if (innerWidth >= 1100) { window.scrollTo({ top: 0 }); return; }
  const m = $("mockCard").getBoundingClientRect(), q = $("quiz").getBoundingClientRect(), head = document.querySelector("header");
  const room = innerHeight - (head ? head.getBoundingClientRect().height : 0) - 70;
  cardToTop(q.bottom - m.top <= room && q.top >= m.top ? $("mockCard") : $("quiz"));
}
$("mockClose").onclick = () => {
  const st = mock.state;
  if (st === "idle" && !xpOn()) { startXp(); return; }   // 模擬考卡的「練習這一級」
  if (xpOn()) { xp = false; stopAll(); render(); window.scrollTo({ top: 0 }); return; }   // 檢定頁的練習 → 回到規格
  mock.close();
  // 結果:在檢定頁看這一題的譜、聽正確版本(同一題,檢定頁的練習畫面)
  if (st === "result" && cur && !cur.free && cur.key === target().key) { xp = true; render(); cardToTop($("mockCard")); return; }
  render(); window.scrollTo({ top: 0 });
};
$("mockMetro").onclick = () => $("optMetro").click();
function renderMockCard(){
  const ex = curExam(), ms = mock.state, card = $("mockCard");
  card.hidden = mode !== "exam" || (ms === "idle" && ex.auto);
  if (card.hidden) return;
  const { sys, grade: g } = mock.who(ex), pb = sys === "trinity";
  const name = `${sysName(sys)} ${gl(g, sys)}`;
  $("mockOpts").hidden = !(ms === "idle" || (ms === "run" && mock.data.stage === "prep")) || !practicable(ex.system, ex.grade);
  $("mockMetro").setAttribute("aria-pressed", String(!!SS.metroPractice));
  const P = pb ? null : specOf(sys, g), sec = pb ? ((dataOf("trinity") && dataOf("trinity").playback.flow.studySec) || 30) : P && P.prepSec;
  const src = pb ? (dataOf("trinity") ? V.srcOf("trinity", dataOf("trinity").playback.flow.src.p) : "") : P ? V.srcOf("rsl", P.src.p) : "";
  const prepName = () => (pb ? tr(`看譜 ${sec} 秒`, `Study ${sec} s`) : tr(`準備 ${sec} 秒`, `Prepare ${sec} s`));
  if (xpOn()) {
    $("mockOpts").hidden = true;
    paintCard($, { title: () => tr("練習這一級的視奏", "Practise this grade"), sub: name,
      text: () => (pb ? tr(`依這一級 Playback 的參數出題:看譜 ${sec} 秒 → 正式打 → 練習回饋 → 聽正確版本。官方配伴奏音軌,App 只有拍點。`,
        `A chart from this grade's Playback parameters: ${sec} s to study → perform → feedback → hear it back. The exam has a backing track; the App has a click only.`)
        : tr(`依這一級視奏的參數出題:準備 ${sec} 秒 → 正式打 → 練習回饋 → 聽正確版本。`, `A test from this grade's parameters: ${sec} s to prepare → perform → feedback → hear it back.`)),
      btn: { label: () => mockLabel("idle") }, close: { label: () => tr("回到規格", "Back to the spec") }, note: () => TS("practiceOnly") });
    return;
  }
  if (ms === "aborted") {
    paintCard($, { title: () => tr("模擬考已中止", "Mock exam stopped"), sub: name, text: () => abortText(mock.reason),
      btn: practicable(ex.system, ex.grade) && !ex.auto ? { label: () => mockLabel("aborted") } : null, close: { label: () => tr("回到規格", "Back to the spec") } });
    if (active) mock.seen();
    return;
  }
  const rows = () => {
    const d = mock.data, R = d.result, st = d.stage;
    const r1 = { id: "1", name: prepName, detail: () => (st === "prep" ? tr("進行中(不能暫停)", "Now (no pausing)") : tr("時間到", "Time used in full")), mark: st === "prep" ? "cur" : "ok" };
    const r2 = { id: "2", name: () => tr("正式打一次", "Perform once") };
    if (ms === "run") { r2.detail = () => (st === "perform" ? tr("進行中", "Now") : tr("準備時間到自動開始", "Starts when the time is up")); r2.mark = st === "perform" ? "cur" : "todo"; }
    else if (d.stopped) { r2.detail = () => tr("中途停止(這一次沒有打完)", "Stopped part-way (not finished)"); r2.mark = "no"; }
    else if (R && R.taps && !R.silent) { const r = R.r; r2.detail = () => tr(`打完了 · 節奏吻合度 ${r.score == null ? "—" : r.score} / 100 · 命中 ${r.hits} / ${r.total}${R.practice && !R.pb ? ` · 練習速度 ♩=${R.bpm}` : ` · ♩=${R.bpm}`}`,
      `Finished · rhythm match ${r.score == null ? "—" : r.score} / 100 · hit ${r.hits} / ${r.total} · ♩=${R.bpm}`); r2.mark = "ok"; }
    else if (R && R.src === "mic") { r2.detail = () => tr("打完了 · 麥克風沒有聽到鼓聲,沒有節奏回饋", "Finished · the mic heard no drums, so no rhythm feedback"); r2.mark = "ok"; }
    else { r2.detail = () => tr("打完了 · 沒有收到鼓墊的敲擊,沒有節奏回饋", "Finished · no pad hits, so no rhythm feedback"); r2.mark = "ok"; }
    return [r1, r2];
  };
  if (ms === "result") {
    paintCard($, { title: () => tr("模擬考結果", "Mock exam result"), sub: name,
      text: () => (mock.data.result && mock.data.result.src === "mic" ? tr("節奏吻合度只看麥克風聽到的敲擊時間(全部鼓件一條;練習設定的容許範圍)。", "Rhythm match is mic timing only (all drums as one; practice-setting tolerance).")
        : tr("節奏吻合度只看觸控鼓墊的敲擊時間(練習設定的容許範圍)。", "Rhythm match is pad timing only (practice-setting tolerance).")),
      rows: rows(), btn: practicable(ex.system, ex.grade) && !ex.auto ? { label: () => mockLabel("result") } : null,
      close: cur && !cur.free && cur.key === keyOf(ex.system, ex.grade) ? { label: () => tr("看譜、聽正確版本", "See the chart & hear it") } : { label: () => tr("回到規格", "Back to the spec") } });
    return;
  }
  if (ms === "run") {
    paintCard($, { title: () => tr("模擬考 · 視奏", "Mock exam · Sight reading"), sub: name,
      text: () => (pb ? tr(`看譜 ${sec} 秒(${src}),時間到自動正式打一次;官方是聽一句打一句、配伴奏音軌,App 整首跟拍點打一遍。速度 ♩=${bpmNow()}(${TS("srcPractice")})。`,
        `${sec} s to study (${src}), then perform it once. The exam is call-and-response with a backing track; the App plays it through with a click. ♩=${bpmNow()} (${TS("srcPractice").toLowerCase()}).`)
        : tr(`準備 ${sec} 秒(${src}),時間到自動正式打一次;官方速度 ♩=${bpmNow()}。`, `${sec} s to prepare (${src}), then perform it once at the official ♩=${bpmNow()}.`)),
      rows: rows(), btn: { label: () => mockLabel("run") } });
    return;
  }
  // idle(檢定頁)
  const ok = practicable(ex.system, ex.grade);
  paintCard($, { title: () => tr("模擬考", "Mock exam"), sub: `${sysName(ex.system)} ${gl(ex.grade, ex.system)}`,
    text: () => (!dataOf(ex.system) ? tr("考試資料還沒載好。", "Exam data isn't loaded yet.")
      : !ok && ex.system === "rsl" && ex.grade >= 6 ? tr("6–8 級是 Quick Study Piece(要伴奏音軌和 lead sheet),App 不出題,沒有視奏模擬考。", "Grades 6–8 have a Quick Study Piece (backing track and lead sheet), which the App doesn't set, so there's no mock.")
      : !ok ? tr("圖例資料還沒載好。", "The drum key isn't loaded yet.")
      : ex.system === "trinity" ? tr(`Rock & Pop 沒有視奏;這是 Playback 看譜的模擬:App 出一份 song chart,看譜 ${sec} 秒(${src},不能暫停),時間到自動正式打一次,只有拍點。`,
        `Rock & Pop has no sight reading; this mocks the Playback chart: ${sec} s to study (${src}, no pausing), then you perform it once, click only.`)
      : tr(`照考試形式:App 出一題,準備 ${sec} 秒(${src},不能暫停,可以開節拍器、在鼓墊上試打),時間到自動正式打一次。`,
        `Like the exam: the App sets a test, ${sec} s to prepare (${src}, no pausing; metronome and pad try-outs allowed), then you perform it once.`)),
    btn: ok ? { label: () => mockLabel("idle") } : null,
    // 檢定頁一打開就看得到「練習這一級」(不用往下捲到規格卡):在這一頁直接出這一級的題目
    close: ok && !ex.auto ? { label: () => (pb ? tr("練習 Playback 看譜", "Practise charts") : tr("練習這一級", "Practise this grade")) } : null });
}
