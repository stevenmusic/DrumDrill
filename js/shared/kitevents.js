/* 鼓組譜(kitnotation.js 的 spec)→ 播放器的事件 [{ beat, piece, vel }](js/shared/player.js 的 play({ events }))。
   純函式:不碰 DOM、不 import audio / i18n,Node 可以直接跑(tools/test/checks/gen-kit.mjs、gen-ear.mjs、gen-playback 的題目都用這一支)。
   RSL 整組鼓視奏(kitgen.js)、RSL 聽力(js/ear/gen.js)、Trinity Playback(playbackgen.js 的 chart.spec / phraseSpec)共用
   (視奏分頁 js/sight/app.js:RSL 4–5 整組鼓、Trinity Playback 看譜練習都用這一支;聽力的 Trinity 回打是 S13)。

   toEvents(spec, { bpm = 80, dyn }) → [{ beat, piece, vel, m, grace?, accent?, ghost? }](照 beat 排好)
   - beat = 從第一小節開頭算幾個四分音符(拍號換了照新的小節長度);時值照 kitnotation 的 valueInfo(連音、附點都算)
   - piece = drumkey.json 的鼓件 id(audio.playKit 的 KIT_VOICE 換成取樣):手打 HH 寫了 open → hhOpen、closed → hhClosed(開閉 HH 的聲音)
   - 自由發揮的小節(slash)不出聲(播放器照 click 打拍點);休止符、連結線接續的音(同一個鼓件)不出聲
   - vel(0–1)= 那裡的力度(練習設定,大綱沒有規定;跟 player.js 的 DYN_VEL 同一張表,gen-kit.mjs 核對):
       pp .25 / p .4 / mp .55 / mf .7 / f .85 / ff 1.0
       沒寫力度(那個位置前面沒有力度記號、也沒給 opts.dyn)= 鼓件預設音量 PIECE_VEL(練習設定:鈸比鼓小聲、Crash 最大聲,律動才有層次;
       RSL 視奏 / 聽力與 Trinity Initial 都沒有力度記號,都用這張表);給了 opts.dyn = 沒寫力度的地方全部用那一級(舊的寫法)
       漸強 / 漸弱(cresc / dim):從開始的力度直線變到結束位置(或之後)的下一個力度記號;後面沒有力度記號就變一級
       sfz = 那一下 1.0;重音 +0.2(最多 1.0);鬼音 ×0.4
   - Flam / Drag 的裝飾音:跟技巧模組的示範播放(js/tech/app.js schedulePlay)一樣提前,裝飾音在主音前 min(32 ms, 1/10 拍)
     (Drag 兩下:2 倍、1 倍);拍子 = 秒 × bpm / 60,所以要給 bpm(改速度後要重算)。音量 = 那裡的力度 × 0.5(技巧 0.3 / 0.6),
     事件帶 grace:true;評分(timing.js expectedByLane)要先用 hitsOnly(events) 拿掉裝飾音。
     第一拍就有 Flam / Drag 時,裝飾音的 beat < 0:player.play 只播 [-countInBeats, lenBeats) 的事件,所以要有預備拍(countInBeats > 0)才播得到
   specBeats(spec) → 整份譜幾拍(四分音符);repeatEvents(events, lenBeats, times) → 重複播 times 遍 */
import { DIV, valueInfo, parseTime } from "./kitnotation.js";

export const DYN_VEL = { pp: 0.25, p: 0.4, mp: 0.55, mf: 0.7, f: 0.85, ff: 1.0 };
export const LEVELS = ["pp", "p", "mp", "mf", "f", "ff"];
export const ACCENT_ADD = 0.2, GHOST_MUL = 0.4, GRACE_MUL = 0.5, SFZ_VEL = 1.0;
export const GRACE_SEC = 0.032, GRACE_MAX_BEAT = 0.1;
/* 鼓件預設音量(沒寫力度時;練習設定,大綱沒有規定):鈸(HH、Ride)比小鼓、大鼓、筒鼓小聲,Crash 最大聲;
   drumkey.json 的 13 個鼓件都要有(gen-kit.mjs 核對) */
export const PIECE_VEL = {
  hh: 0.55, hhClosed: 0.55, hhOpen: 0.6, hhFoot: 0.5, ride: 0.6, rideBell: 0.65, crash: 0.85,
  snare: 0.75, xstick: 0.7, kick: 0.75, tomHi: 0.75, tomMid: 0.75, tomFloor: 0.75
};
export const pieceVel = piece => (PIECE_VEL[piece] != null ? PIECE_VEL[piece] : DYN_VEL.mf);
/* 說明 key(UI 用 tr(zh, en);kind 同 playbackgen.js 的 NOTES) */
export const EVENT_NOTES = {
  velocity: { kind: "practice", text: ["播放音量:pp 到 ff、重音、鬼音的音量對照是 App 自訂的", "Playback volume for pp–ff, accents and ghost notes is the App's setting"] },
  pieceVel: { kind: "practice", text: ["沒寫力度時各鼓件的音量(鈸比鼓小聲)是 App 自訂的", "Default volume per drum when no dynamic is written is the App's setting"] }
};

/* 裝飾音在主音前幾拍(技巧模組:min(32 ms, 1/10 拍)) */
export const graceBeats = bpm => Math.min(GRACE_SEC * (bpm > 0 ? bpm : 80) / 60, GRACE_MAX_BEAT);

/* 每一小節的開始拍與長度(四分音符) */
function barStarts(spec){
  let meter = parseTime(spec.time || "4/4"), at = 0;
  return (spec.measures || []).map(m => {
    if (m.time) meter = parseTime(m.time);
    const b = { start: at, len: meter.len / DIV };
    at += b.len;
    return b;
  });
}
export const specBeats = spec => barStarts(spec).reduce((s, b) => s + b.len, 0);

/* 力度的時間軸:靜態力度(含漸強漸弱沒有接力度記號時補的那一級)、漸強漸弱區段、sfz 的位置 */
function dynTimeline(spec, bars, base){
  const at = d => bars[d.m].start + d.beat;
  const marks = (spec.dyn || []).filter(d => bars[d.m]).map(d => ({ ...d, at: at(d) })).sort((a, b) => a.at - b.at);
  // base:opts.dyn(沒給 = null → 沒寫力度的地方用鼓件預設音量)
  const statics = [{ at: -Infinity, vel: base == null ? null : DYN_VEL[base] != null ? DYN_VEL[base] : DYN_VEL.mf }];
  const wedges = [], sfz = new Set();
  const levelAt = t => { let v = statics[0].vel; for (const s of statics) if (s.at <= t + 1e-9) v = s.vel; return v; };
  for (const d of marks) {
    if (DYN_VEL[d.mark] != null) statics.push({ at: d.at, vel: DYN_VEL[d.mark] });
    else if (d.mark === "sfz") sfz.add(+d.at.toFixed(6));
  }
  statics.sort((a, b) => a.at - b.at);
  for (const d of marks) {
    if (d.mark !== "cresc" && d.mark !== "dim") continue;
    const e = d.end && bars[d.end.m] ? bars[d.end.m].start + (d.end.beat == null ? bars[d.end.m].len : d.end.beat) : bars[d.m].start + bars[d.m].len;
    const from = levelAt(d.at) != null ? levelAt(d.at) : DYN_VEL.mf;   // 漸強漸弱前面沒有力度:從 mf 算
    const next = statics.find(s => s.at >= e - 1e-9);
    let to;
    if (next) to = next.vel;
    else {
      // 後面沒有力度記號:變一級,而且結束之後維持那一級
      const i = LEVELS.findIndex(l => Math.abs(DYN_VEL[l] - from) < 1e-9);
      const j = Math.max(0, Math.min(LEVELS.length - 1, (i < 0 ? 3 : i) + (d.mark === "cresc" ? 1 : -1)));
      to = DYN_VEL[LEVELS[j]];
      statics.push({ at: e, vel: to }); statics.sort((a, b) => a.at - b.at);
    }
    wedges.push({ s: d.at, e, from, to });
  }
  const velAt = t => {
    for (const w of wedges) if (t >= w.s - 1e-9 && t < w.e - 1e-9 && w.e > w.s) return w.from + (w.to - w.from) * (t - w.s) / (w.e - w.s);
    return levelAt(t);
  };
  return { velAt, isSfz: t => sfz.has(+t.toFixed(6)) };
}

const r3 = x => Math.round(x * 1000) / 1000, r6 = x => Math.round(x * 1e6) / 1e6;
export const soundPiece = n => (n.piece === "hh" && n.open ? "hhOpen" : n.piece === "hh" && n.closed ? "hhClosed" : n.piece);

export function toEvents(spec, { bpm = 80, dyn = null } = {}){
  const bars = barStarts(spec), T = dynTimeline(spec, bars, dyn), g = graceBeats(bpm), out = [];
  let carry = [null, null];
  (spec.measures || []).forEach((m, mi) => {
    if (m.slash) { carry = [null, null]; return; }
    (m.voices || []).forEach((v, vi) => {
      let pos = bars[mi].start, prevTie = carry[vi];
      for (const ev of v || []) {
        let code = String(ev.value), rest = !!ev.rest;
        if (code[0] === "r") { rest = true; code = code.slice(1); }
        const info = valueInfo(code);
        if (!info) throw new Error(`toEvents:第 ${mi + 1} 小節時值不認得(${ev.value})`);
        if (!rest) {
          const at = T.velAt(pos), sfz = T.isSfz(pos);
          for (const n of ev.notes || []) {
            if (prevTie && prevTie.has(n.piece)) continue;   // 連結線接續的音
            const piece = soundPiece(n), lvl = at != null ? at : pieceVel(piece);
            let vel = sfz ? SFZ_VEL : lvl;
            if (n.accent) vel = Math.min(1, vel + ACCENT_ADD);
            if (n.ghost) vel *= GHOST_MUL;
            const e = { beat: r6(pos), piece, vel: r3(vel), m: mi };
            if (n.accent) e.accent = true;
            if (n.ghost) e.ghost = true;
            out.push(e);
            const k = n.flam ? 1 : n.drag ? 2 : 0;
            for (let j = k; j >= 1; j--) out.push({ beat: r6(pos - j * g), piece: piece === "hhOpen" ? "hh" : piece, vel: r3(lvl * GRACE_MUL), m: mi, grace: true });
          }
        }
        prevTie = !rest && ev.tie ? new Set((ev.notes || []).map(n => n.piece)) : null;
        pos += info.dur / DIV;
      }
      carry[vi] = prevTie;
    });
    // 這一小節沒有寫腳的聲部:上一小節腳的連結線不會接過來
    if (!(m.voices && m.voices[1])) carry[1] = null;
  });
  return out.map((e, i) => [e, i]).sort((a, b) => a[0].beat - b[0].beat || a[1] - b[1]).map(x => x[0]);
}

/* 評分用:拿掉裝飾音(Flam / Drag 的前置音不是學生要對齊的拍子) */
export const hitsOnly = events => (events || []).filter(e => !e.grace);

/* 重複播 times 遍(RSL Groove「repeated」:兩小節播兩遍,推估) */
export function repeatEvents(events, lenBeats, times = 2){
  const out = [];
  for (let k = 0; k < times; k++) for (const e of events) out.push({ ...e, beat: r6(e.beat + k * lenBeats) });
  return out;
}
