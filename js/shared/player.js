/* 視奏、聽力共用的鼓組播放器(docs/STAGES.md S7):照拍子排鼓組事件與拍點,邊播邊排(時間窗)。
   createPlayer({ onTick(beat), onEnd() }) → { play(opts), stop(cut), retempo(bpm), beatToTime(b), timeToBeat(t), state }
   play({ events:[{beat, piece, vel}], lenBeats, bpm, countInBeats, click:(beat)=>0|1|2, gaps:[[b0,b1]] })
   - beat:從第一拍(預備拍之後)算起的拍數(四分音符 = 1 拍);預備拍是負的拍數 -countInBeats … -1
   - piece:data/drumkey.json 的鼓件 id(audio.playKit 照 KIT_VOICE 換成取樣);vel:0–1,或力度記號 "pp"…"ff"(DYN_VEL)
   - click(beat):每一個整數拍(含預備拍)問一次:0 不響、1 弱拍、2 重拍;沒給就只有預備拍響(第一下重)
   - gaps:這些拍段 [b0, b1) 裡的事件不出聲(學生自己打的段落,例如回打);拍點照 click 決定
   取樣要先載好(audio.loadKit、audio.loadClick)、AudioContext 要先叫醒(呼叫的模組負責),播放器只排程。
   排程:每 100 ms(計時器)與每一格畫面(rAF)把「現在到 1.5 秒後」的事件排進 audio(只往前排 1.5 秒,
   停止或改速度時要取消的節點少;計時器在背景會變慢,rAF 在前景補排)。
   停止:audio.cancelFrom(now) 取消還沒開始的,正在響的鈸照錄音自然收尾;stop(true) = audio.stopAll() 全部立刻停。
   頁面切到背景:外框會 leave() + stopAll;播放器自己也檢查 document.hidden,看不到就停止、不再補排。 */
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

export function createPlayer({ onTick, onEnd } = {}){
  let P = null;   // 播放中的狀態;null = 停止
  const beatToTime = b => (P ? P.t0 + b * P.beatSec : NaN);
  const timeToBeat = t => (P ? (t - P.t0) / P.beatSec : NaN);
  const inGap = b => P.gaps.some(([b0, b1]) => b >= b0 - 1e-9 && b < b1 - 1e-9);

  /* 把 [現在, 現在 + LOOKAHEAD) 內還沒排的事件與拍點排進去;播完了就結束 */
  function pump(){
    if (!P) return;
    if (typeof document !== "undefined" && document.hidden) { stop(); return; }
    const now = audio.audioNow(), horizon = now + LOOKAHEAD;
    if (now >= beatToTime(P.lenBeats)) { finish(); return; }
    const ev = P.events;
    while (P.nextEv < ev.length) {
      const e = ev[P.nextEv], at = beatToTime(e.beat);
      if (at >= horizon) break;
      P.nextEv++;
      if (at < now - LATE || inGap(e.beat)) continue;
      audio.playKit(e.piece, at, velOf(e.vel));
      P.sent++;
    }
    while (P.nextClick < P.lenBeats) {
      const b = P.nextClick, at = beatToTime(b);
      if (at >= horizon) break;
      P.nextClick++;
      if (at < now - LATE) continue;
      const c = P.click(b);
      if (c) { audio.playClick(at, c === 2); P.sent++; }
    }
  }
  function loopRaf(){
    if (!P) return;
    pump();
    if (!P) return;
    if (onTick) { try { onTick(timeToBeat(audio.audioNow())); } catch (e) { console.error(e); } }
    P.raf = requestAnimationFrame(loopRaf);
  }
  function clearTimers(){
    if (!P) return;
    clearInterval(P.timer); cancelAnimationFrame(P.raf);
  }
  function finish(){
    clearTimers(); P = null;
    if (onEnd) { try { onEnd(); } catch (e) { console.error(e); } }
  }

  function play({ events = [], lenBeats, bpm, countInBeats = 4, click, gaps = [] } = {}){
    stop();
    const ctx = audio.ensureAudio();
    const beatSec = 60 / bpm;
    const evs = events.filter(e => e && isFinite(e.beat) && e.piece).slice().sort((a, b) => a.beat - b.beat);
    const len = lenBeats != null ? lenBeats : evs.reduce((m, e) => Math.max(m, Math.ceil(e.beat + 1e-9)), 0);
    const ci = Math.max(0, Math.round(countInBeats));
    P = {
      t0: ctx.currentTime + START_DELAY + ci * beatSec, beatSec, bpm, lenBeats: len, countIn: ci,
      events: evs, gaps: gaps.map(g => [g[0], g[1]]),
      click: typeof click === "function" ? click : (b => (b < 0 ? (b === -ci ? 2 : 1) : 0)),
      nextEv: 0, nextClick: -ci, sent: 0, timer: 0, raf: 0
    };
    P.timer = setInterval(pump, TIMER_MS);
    pump();
    P.raf = requestAnimationFrame(loopRaf);
    return P.t0;
  }
  /* 停止:還沒開始的取消、正在響的自然收尾(cut = true:全部立刻停) */
  function stop(cut){
    if (!P) return false;
    clearTimers(); P = null;
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
      if (!P) return { playing: false };
      const now = audio.audioNow();
      return { playing: true, bpm: P.bpm, beat: timeToBeat(now), t0: P.t0, beatSec: P.beatSec, lenBeats: P.lenBeats, countIn: P.countIn,
        nextEv: P.nextEv, events: P.events.length, sent: P.sent };
    }
  };
}
