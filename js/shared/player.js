/* 視奏、聽力共用的鼓組播放器(docs/STAGES.md S7):照拍子排鼓組事件與拍點,邊播邊排(時間窗)。
   createPlayer({ onTick(beat), onEnd(), onStop(reason), onLate(info) }) → { play(opts), stop(cut), retempo(bpm), beatToTime(b), timeToBeat(t), state }
   play({ events:[{beat, piece, vel}], lenBeats, bpm, countInBeats, click:(beat)=>0|1|2, gaps:[[b0,b1]] }) → 第一拍的音訊時間(沒有開始時 NaN)
   - beat:從第一拍(預備拍之後)算起的拍數(四分音符 = 1 拍);預備拍是負的拍數 -countInBeats … -1
   - piece:data/drumkey.json 的鼓件 id(audio.playKit 照 KIT_VOICE 換成取樣);vel:0–1,或力度記號 "pp"…"ff"(DYN_VEL)
   - bpm 一定要 > 0(不然丟 RangeError);拍子在 [-countInBeats, lenBeats) 以外的事件不播
   - click(beat):每一個整數拍(含預備拍)問一次:0 不響、1 弱拍、2 重拍;沒給就只有預備拍響(第一下重)
   - gaps:這些拍段 [b0, b1) 裡的事件不出聲(學生自己打的段落,例如回打);拍點照 click 決定
   - onTick(beat):每一格畫面,beat = 「現在耳朵聽到的」拍子位置(扣掉輸出延遲:getOutputTimestamp,沒有就 outputLatency,再沒有就 0),
     播放色塊對齊聲音。onTick 裡可以 stop() 或重新 play()(舊的那一輪就不再叫)
   - onStop(reason):播放器自己停下來時(reason = "hidden":頁面切到背景),讓模組把按鈕改回「播放」;呼叫 stop() 不會叫
   - onLate({ n, dropped, beat }):計時器被擋住、有事件或拍點晚了超過 LATE 沒有補播(漏音);n = 這次漏的數目,dropped = 這一輪累計
   取樣要先載好(audio.loadKit、audio.loadClick)、AudioContext 要先叫醒(呼叫的模組負責),播放器只排程。
   排程:每 100 ms(計時器)與每一格畫面(rAF)把「現在到 1.5 秒後」的事件排進 audio(只往前排 1.5 秒,
   停止或改速度時要取消的節點少;計時器在背景會變慢,rAF 在前景補排)。
   state:sent = 真的排進 audio 的數目(playKit / playClick 成功才算)、dropped = 晚了沒補播的、failed = audio 沒有出聲的(取樣沒載好);停止後仍保留上一輪的這三個數字
   停止:audio.cancelFrom(now) 取消還沒開始的,正在響的鈸照錄音自然收尾;stop(true) = audio.stopAll() 全部立刻停(自然播完之後也可以用,收掉還在響的尾音)。
   頁面切到背景:外框會 leave() + stopAll;播放器自己也檢查 document.hidden,看不到就停止(叫 onStop("hidden"))、不再補排;
   看不到時 play() 不開始,回傳 NaN。 */
import * as audio from "./audio.js";

/* 力度記號 → 播放音量(audio.playKit 的力度 0–1)。練習設定:大綱沒有規定,App 自訂(標「練習設定」) */
export const DYN_VEL = { pp: 0.25, p: 0.4, mp: 0.55, mf: 0.7, f: 0.85, ff: 1.0 };
export const DEFAULT_VEL = DYN_VEL.mf;
export const LOOKAHEAD = 1.5;    // 往前排幾秒
export const TIMER_MS = 100;     // 計時器間隔
const START_DELAY = 0.15;        // 按播放到第一下(預備拍)的時間
const RETEMPO_DELAY = 0.06;      // 改速度:這個時間之後的才重排(之前的已經送到音訊執行緒)
const LATE = 0.05;               // 晚超過這麼多(計時器被擋住)的事件不補播,免得擠成一團

export function velOf(v){
  if (typeof v === "string") return DYN_VEL[v] != null ? DYN_VEL[v] : DEFAULT_VEL;
  return typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VEL;
}

/* 「現在耳朵聽到的」音訊時間:AudioContext.getOutputTimestamp() 給「喇叭正在播的那一格 ↔ performance 時間」,
   再加上那之後經過的時間;沒有這個 API(或還沒開始跑)就用 currentTime − outputLatency(沒有就 0)。
   perfMs = performance 時間(毫秒;鼓墊的事件時間),沒給 = 現在。沒有 AudioContext 時 null。pad.js 的 eventToAudioTime 也用這個 */
export function perfToAudioTime(perfMs){
  const ctx = audio.getCtx();
  if (!ctx || typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) return null;
  const perfNow = performance.now(), ts = perfMs == null ? perfNow : perfMs;
  let ct = null, pt = null;
  if (typeof ctx.getOutputTimestamp === "function") {
    try { const o = ctx.getOutputTimestamp(); if (o && o.performanceTime > 0 && o.contextTime > 0) { ct = o.contextTime; pt = o.performanceTime; } } catch (e) {}
  }
  if (ct == null) { ct = ctx.currentTime - (ctx.outputLatency || 0); pt = perfNow; }
  return ct + (ts - pt) / 1000;
}

const hidden = () => typeof document !== "undefined" && document.hidden;

export function createPlayer({ onTick, onEnd, onStop, onLate } = {}){
  let P = null;   // 播放中的狀態;null = 停止
  let last = { sent: 0, dropped: 0, failed: 0 };   // 上一輪(停止後 state 仍看得到)
  let tail = false;                                 // 自然播完、尾音可能還在響(stop(true) 要收掉)
  const call = (fn, ...a) => { if (fn) { try { fn(...a); } catch (e) { console.error(e); } } };
  const beatToTime = b => (P ? P.t0 + b * P.beatSec : NaN);
  const timeToBeat = t => (P ? (t - P.t0) / P.beatSec : NaN);
  const inGap = b => P.gaps.some(([b0, b1]) => b >= b0 - 1e-9 && b < b1 - 1e-9);

  /* 把 [現在, 現在 + LOOKAHEAD) 內還沒排的事件與拍點排進去;播完了就結束 */
  function pump(){
    if (!P) return;
    if (hidden()) { stop(); call(onStop, "hidden"); return; }
    const now = audio.audioNow(), horizon = now + LOOKAHEAD;
    if (now >= beatToTime(P.lenBeats)) { finish(); return; }
    const ev = P.events;
    let late = 0, lateBeat = null;
    while (P.nextEv < ev.length) {
      const e = ev[P.nextEv], at = beatToTime(e.beat);
      if (at >= horizon) break;
      P.nextEv++;
      if (inGap(e.beat)) continue;
      if (at < now - LATE) { late++; if (lateBeat == null) lateBeat = e.beat; continue; }
      if (audio.playKit(e.piece, at, velOf(e.vel))) P.sent++; else P.failed++;
    }
    while (P.nextClick < P.lenBeats) {
      const b = P.nextClick, at = beatToTime(b);
      if (at >= horizon) break;
      P.nextClick++;
      const c = P.click(b);
      if (!c) continue;
      if (at < now - LATE) { late++; if (lateBeat == null || b < lateBeat) lateBeat = b; continue; }
      if (audio.playClick(at, c === 2)) P.sent++; else P.failed++;
    }
    if (late) { P.dropped += late; call(onLate, { n: late, dropped: P.dropped, beat: lateBeat }); }
  }
  function loopRaf(){
    const me = P;
    if (!me) return;
    pump();
    if (P !== me) return;   // pump 裡停了或播完了
    call(onTick, heardBeat());
    if (P !== me) return;   // onTick 裡 stop() 或重新 play() 了:這一輪的 rAF 不再接下去(新的那一輪有自己的)
    me.raf = requestAnimationFrame(loopRaf);
  }
  function heardBeat(){
    const t = perfToAudioTime();
    return timeToBeat(t == null ? audio.audioNow() : t);
  }
  function clearTimers(){
    if (!P) return;
    clearInterval(P.timer); cancelAnimationFrame(P.raf);
  }
  function end(){
    clearTimers();
    last = { sent: P.sent, dropped: P.dropped, failed: P.failed };
    P = null;
  }
  function finish(){
    end(); tail = true;
    call(onEnd);
  }

  function play({ events = [], lenBeats, bpm, countInBeats = 4, click, gaps = [] } = {}){
    if (!(typeof bpm === "number" && isFinite(bpm) && bpm > 0)) throw new RangeError("player.play: bpm 要 > 0(" + bpm + ")");
    if (lenBeats != null && !(typeof lenBeats === "number" && isFinite(lenBeats) && lenBeats >= 0)) throw new RangeError("player.play: lenBeats 要 ≥ 0(" + lenBeats + ")");
    stop();
    if (hidden()) return NaN;   // 看不到:不開始(回到前景由使用者再按播放)
    const ctx = audio.ensureAudio();
    const beatSec = 60 / bpm;
    const ci = Math.max(0, Math.round(countInBeats) || 0);
    let evs = (events || []).filter(e => e && typeof e.beat === "number" && isFinite(e.beat) && e.piece);
    const len = lenBeats != null ? lenBeats : evs.reduce((m, e) => Math.max(m, Math.ceil(e.beat + 1e-9)), 0);
    evs = evs.filter(e => e.beat >= -ci - 1e-9 && e.beat < len - 1e-9).sort((a, b) => a.beat - b.beat);
    tail = false;
    P = {
      t0: ctx.currentTime + START_DELAY + ci * beatSec, beatSec, bpm, lenBeats: len, countIn: ci,
      events: evs, gaps: (gaps || []).map(g => [g[0], g[1]]),
      click: typeof click === "function" ? click : (b => (b < 0 ? (b === -ci ? 2 : 1) : 0)),
      nextEv: 0, nextClick: -ci, sent: 0, dropped: 0, failed: 0, timer: 0, raf: 0
    };
    const me = P;
    me.timer = setInterval(pump, TIMER_MS);
    pump();
    if (P !== me) return NaN;   // 排第一批時就停了(例如 lenBeats = 0 馬上播完)
    me.raf = requestAnimationFrame(loopRaf);
    return me.t0;
  }
  /* 停止:還沒開始的取消、正在響的自然收尾(cut = true:全部立刻停,自然播完後的尾音也收掉)。回傳 = 原本是不是在播 */
  function stop(cut){
    if (!P) {
      if (cut && tail) { tail = false; audio.stopAll(); }
      return false;
    }
    end(); tail = false;
    if (cut) audio.stopAll(); else audio.cancelFrom(audio.audioNow());
    return true;
  }
  /* 播放中改速度:RETEMPO_DELAY 之後的取消、照新速度從同一個拍子位置重排(之前已經送出的不動,不會重複) */
  function retempo(bpm){
    if (!P || !(bpm > 0)) return;
    const beatSec = 60 / bpm;
    if (Math.abs(beatSec - P.beatSec) < 1e-9) return;
    const from = audio.audioNow() + RETEMPO_DELAY, fromBeat = timeToBeat(from);
    audio.cancelFrom(from);
    P.t0 = from - fromBeat * beatSec; P.beatSec = beatSec; P.bpm = bpm;
    // 被取消的 = 原本時間 ≥ from 的 = 拍子 ≥ fromBeat 的:指標退回第一個這樣的事件與拍點
    let i = 0;
    while (i < P.events.length && P.events[i].beat < fromBeat) i++;
    P.nextEv = i;
    P.nextClick = Math.max(-P.countIn, Math.ceil(fromBeat - 1e-9));
    pump();
  }

  return {
    play, stop, retempo, beatToTime, timeToBeat,
    get state(){
      if (!P) return { playing: false, ...last };
      const now = audio.audioNow();
      return { playing: true, bpm: P.bpm, beat: timeToBeat(now), heardBeat: heardBeat(), t0: P.t0, beatSec: P.beatSec, lenBeats: P.lenBeats, countIn: P.countIn,
        nextEv: P.nextEv, events: P.events.length, sent: P.sent, dropped: P.dropped, failed: P.failed };
    }
  };
}
