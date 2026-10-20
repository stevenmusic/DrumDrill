/* RSL 4–5 級整組鼓視奏的出題器(docs/STAGES.md S9;純函式:不碰 DOM、不 import i18n,Node 可以直接跑;
   tools/test/checks/gen-kit.mjs 每級 1000 個種子檢查)。聽力的 Groove(js/ear/gen.js)也用這裡的「一拍 = 十六分格子」寫法(maskVoice)。

   官方參數照 data/exam-rsl.json 的 sight[4]、sight[5](RSL p.48、53;docs/sources/rsl-drums.md §4.1):
     8 小節(含 2 小節自由發揮)、4/4;時值 ♩、♩.、♪、♪.、♬;休止符 𝄽、𝄾;整組鼓;♩=80–90(4 級)、80–120(5 級)
   genRslKit(spec, seed, grade) → {
     grade, seed, time:"4/4", bars, bpm, bpmRange, develop:{ from, bars }(自由發揮的小節,0 起算), cyms:[前段, 後段],
     spec:{ lines:5, time, measures }(kitnotation.js 的 scoreXML 直接用;自由發揮的小節 = { slash:true }),
     measures(= spec.measures), events:[{ beat, piece, vel, m }](kitevents.js 的 toEvents;自由發揮的小節不出聲,播放器只打拍點),
     lenBeats, notes:[說明 key](NOTES:中英文 + kind = assumed 推估 / practice 練習設定), src
   }
   spec = exam-rsl.json 的 sight[g](type 要是 "kit");同一個 spec + seed 一定出同一題(mulberry32,跟 playbackgen.js 同一個寫法)。

   白名單:每一拍照「十六分格子」寫成 MASK_CELL 的寫法,寫法裡的每個時值 / 休止符都要在 spec.values / spec.rests 裡才用
   (所以只會有 4 4. 8 8. 16 與 r4 r8;附點八分只出現在「8. 16」「16 8.」,一定配十六分 = App 的出題限制,不是官方規定(NOTES.design);沒有二分、全休止符、十六分休止符)。
   推估(畫面要標):
   - 鼓件:大綱只寫「整組鼓」→ App 用 HH、小鼓、大鼓、高 / 中 / 落地鼓、Ride、Crash(KIT_SIGHT_PIECES;NOTES.kitPieces)
   - 2 小節自由發揮放在最後兩小節(斜線;NOTES.developEnd;資料檔 develop.pos assumed)
   練習設定(App 的出題設計;docs/GENERATORS.md §2):
   - 一題 = 前段 4 小節(律動 + 第 4 小節末過門)+ 後段 2 小節(Crash 開頭,第 6 小節末過門接自由發揮)+ 2 小節自由發揮
   - 手:鈸(HH 或 Ride,一段固定)的節奏型 + 小鼓反拍(第 2、4 拍)、偶爾多一下小鼓;大鼓:兩拍一組的節奏格;過門:小鼓 → 筒鼓往下走,有時候加大鼓
   - 不寫力度、重音、開閉 HH、鬼音、Flam / Drag(大綱只列時值;NOTES.noMarks)
   - 速度在官方範圍內隨機取整數(NOTES.tempoRandom) */
import { toEvents, specBeats, EVENT_NOTES } from "./kitevents.js";

export const SIGHT_KIT_GRADES = [4, 5];
export const KIT_SIGHT_PIECES = ["hh", "ride", "crash", "snare", "tomHi", "tomMid", "tomFloor", "kick"];
export const NOTES = {
  kitPieces: { kind: "assumed", text: ["大綱只寫「整組鼓」:App 用 Hi-hat、小鼓、大鼓、三個 Toms、Ride、Crash", "Syllabus says 'full kit': the App uses HH, snare, kick, 3 toms, ride, crash"] },
  developEnd: { kind: "assumed", text: ["2 小節自由發揮的位置大綱沒寫,App 放在最後兩小節(斜線)", "Position of the 2-bar development not stated; the App uses the last 2 bars (slashes)"] },
  design: { kind: "practice", text: ["節奏型、過門與組合方式是 App 的出題設計,不是官方題目;附點八分只配十六分是出題限制,不是官方規定", "Grooves, fills and how they combine are the App's design, not official tests; pairing ♪. only with ♬ is the App's limit, not an official rule"] },
  pieceVel: EVENT_NOTES.pieceVel,
  noMarks: { kind: "practice", text: ["大綱只列時值:App 不寫力度、重音、開關 Hi-hat", "The syllabus lists note values only: no dynamics, accents or open hi-hat"] },
  tempoRandom: { kind: "practice", text: ["速度在官方範圍內隨機", "Tempo picked at random within the official range"] },
  developClick: { kind: "practice", text: ["自由發揮的小節播放時只有拍點", "Development bars play the click only"] }
};

/* ── 亂數(mulberry32;同 playbackgen.js)── */
export function rng(seed){
  let s = (Number(seed) >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (R, a) => a[Math.floor(R() * a.length)];
export function wpick(R, items, w){
  const ws = items.map(w), sum = ws.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  let x = R() * sum;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
  return items[items.length - 1];
}
export const randInt = (R, lo, hi) => lo + Math.floor(R() * (hi - lo + 1));

/* ── 一拍 = 四個十六分格子(位元 0 = 拍點、1 = 第 2 個十六分、2 = 反拍八分、3 = 第 4 個十六分)→ 寫法 ──
   開頭是第 2 或第 4 個十六分(要用十六分休止符)的拍子不在表裡 = 不出 */
export const MASK_CELL = { 0: "r4", 1: "4", 5: "8 8", 9: "8. 16", 3: "16 8.", 7: "16 16 8", 13: "8 16 16", 11: "16 8 16", 15: "16 16 16 16", 4: "r8 8", 12: "r8 16 16" };
const SIXTEENTHS = { "4": 4, "8": 2, "8.": 3, "16": 1 };
export const maskOf = slots => slots.reduce((m, s, i) => m | (s.length ? 1 << i : 0), 0);
export const newBar = (beats = 4) => Array.from({ length: beats }, () => [[], [], [], []]);
const whitelist = spec => ({ values: new Set(spec.values || []), rests: new Set(spec.rests || []) });
export const cellOK = (mask, wl) => MASK_CELL[mask] != null && MASK_CELL[mask].split(" ").every(c => (c[0] === "r" ? wl.rests.has(c) : wl.values.has(c)));

/* 一個聲部(一小節):bar = [拍][格子] = [音…] → kitnotation 的 ev[]。
   第 1、3 拍是「4」、下一拍是「r8 8」時,dot 的機會寫成「4. 8」(白名單有附點四分時;練習設定) */
export function maskVoice(bar, wl, R, dot = 0.6){
  const out = [];
  for (let b = 0; b < bar.length; b++) {
    const mask = maskOf(bar[b]);
    if (!cellOK(mask, wl)) throw new Error(`maskVoice:第 ${b + 1} 拍的寫法不在白名單(${mask})`);
    if (mask === 1 && b % 2 === 0 && b + 1 < bar.length && maskOf(bar[b + 1]) === 4 && wl.values.has("4.") && wl.values.has("8") && R() < dot) {
      out.push({ value: "4.", notes: clone(bar[b][0]) }, { value: "8", notes: clone(bar[b + 1][2]) });
      b++; continue;
    }
    let bit = 0;
    for (const c of MASK_CELL[mask].split(" ")) {
      if (c[0] === "r") { out.push({ value: c }); bit += SIXTEENTHS[c.slice(1)]; continue; }
      out.push({ value: c, notes: clone(bar[b][bit]) }); bit += SIXTEENTHS[c];
    }
  }
  return out;
}
const clone = notes => notes.map(n => ({ ...n }));

/* ── 節奏格(App 的出題設計;w = [4 級, 5 級] 的權重)── */
// 鈸的節奏型(一拍):八分、四分、十六分(十六分只在 5 級、♩ ≤ 100)
const OST = [{ mask: 5, w: [5, 5] }, { mask: 1, w: [2, 1.5] }, { mask: 15, w: [0, 1] }];
// 大鼓:兩拍一組 [第一拍, 第二拍];first = 可以放在第 1–2 拍(一定有第 1 拍的拍點)
const KICK_HALF = [
  { m: [1, 0], w: [4, 3.5], first: true }, { m: [5, 0], w: [2, 2], first: true }, { m: [1, 4], w: [3, 3], first: true },
  { m: [5, 4], w: [1.2, 1.5], first: true }, { m: [9, 0], w: [1.2, 1.5], first: true }, { m: [1, 12], w: [0.6, 1], first: true },
  { m: [13, 0], w: [0.5, 1], first: true }, { m: [3, 0], w: [0, 0.6], first: true },
  { m: [4, 0], w: [0.8, 1], first: false }, { m: [0, 4], w: [0.5, 0.8], first: false }
];
// 小鼓多一下:[拍, 格子]
const SNARE_EXTRA = [{ at: [3, 2], w: 1 }, { at: [3, 3], w: 1 }, { at: [1, 3], w: 0.8 }, { at: [2, 2], w: 0.6 }];
// 過門(一拍)
const FILL = [
  { mask: 15, w: [3, 3] }, { mask: 5, w: [3, 2.5] }, { mask: 13, w: [1.5, 2] }, { mask: 7, w: [1.5, 2] }, { mask: 9, w: [1, 1.2] },
  { mask: 1, w: [1, 0.8] }, { mask: 3, w: [0.3, 0.8] }, { mask: 11, w: [0.3, 0.8] }, { mask: 4, w: [0.4, 0.5] }, { mask: 12, w: [0.3, 0.5] }
];
const DRUMS = ["snare", "tomHi", "tomMid", "tomFloor"];
const bitsOf = mask => [0, 1, 2, 3].filter(i => mask & (1 << i));

/* 過門的鼓:小鼓 → 高 → 中 → 落地(往下走) */
function drumWalk(R){
  let idx = R() < 0.6 ? 0 : 1;
  const per = [];
  return k => { while (per.length <= k) { per.push(DRUMS[idx]); if (R() < 0.65) idx = Math.min(idx + 1, DRUMS.length - 1); } return per[k]; };
}

/* 一小節:律動 + (fill 拍以後是過門);plan = { cym, ost, kick:[前半, 後半], crash, fillFrom(0–4;4 = 沒有過門) } */
function grooveBar(C, R, plan){
  const hand = newBar(), feet = newBar(), gi = C.gi;
  for (let b = 0; b < plan.fillFrom; b++) {
    for (const i of bitsOf(plan.ost)) hand[b][i].push({ piece: b === 0 && i === 0 && plan.crash ? "crash" : plan.cym });
    if (b === 1 || b === 3) hand[b][0].push({ piece: "snare" });
  }
  // 小鼓多一下(反拍以外;在過門以前)
  if (R() < [0.35, 0.45][gi]) {
    const ex = wpick(R, SNARE_EXTRA.filter(x => x.at[0] < plan.fillFrom && !hand[x.at[0]][x.at[1]].some(n => n.piece === "snare")), x => x.w);
    if (ex) hand[ex.at[0]][ex.at[1]].push({ piece: "snare" });
  }
  for (let h = 0; h < 2; h++) for (let k = 0; k < 2; k++) {
    const b = h * 2 + k;
    if (b >= plan.fillFrom) break;
    for (const i of bitsOf(plan.kick[h].m[k])) feet[b][i].push({ piece: "kick" });
  }
  // 過門
  if (plan.fillFrom < 4) {
    const walk = drumWalk(R);
    let k = 0;
    for (let b = plan.fillFrom; b < 4; b++) {
      const pool = FILL.filter(f => cellOK(f.mask, C.wl) && (b > plan.fillFrom || (f.mask & 1)));
      const f = wpick(R, pool, x => x.w[gi]);
      const bits = bitsOf(f.mask), split = bits.length >= 4 && R() < 0.35;
      bits.forEach((i, j) => hand[b][i].push({ piece: walk(split && j >= bits.length / 2 ? k + 1 : k) }));
      k += split ? 2 : 1;
      if ((f.mask & 1) && R() < 0.35) feet[b][0].push({ piece: "kick" });
    }
  }
  if (!feet.some(s => maskOf(s))) feet[0][0].push({ piece: "kick" });
  return { hand, feet };
}

export function genRslKit(spec, seed = 1, grade = spec && spec.grade){
  if (!spec || spec.type !== "kit") throw new Error("genRslKit:只出整組鼓視奏(spec.type 要是 kit)");
  const time = spec.time && (spec.time.v || spec.time);
  if (time !== "4/4") throw new Error("genRslKit:拍號只支援 4/4(" + time + ")");
  const g = SIGHT_KIT_GRADES.includes(grade) ? grade : (spec.bpm && spec.bpm[1] > 90 ? 5 : 4);
  const R = rng(seed), wl = whitelist(spec), C = { wl, gi: g === 5 ? 1 : 0 };
  const bars = spec.bars || 8, dev = (spec.develop && spec.develop.bars) || 0, written = bars - dev;
  const [lo, hi] = spec.bpm, bpm = lo === hi ? lo : randInt(R, lo, hi);
  for (let attempt = 0; attempt < 50; attempt++) {
    try { return build(spec, R, C, g, seed, bars, dev, written, bpm); } catch (e) { if (attempt === 49) throw e; }
  }
}

function build(spec, R, C, g, seed, bars, dev, written, bpm){
  const gi = C.gi;
  // 段落:前段 = 開頭到第 4 小節(或寫出來的小節的前 2/3)、後段 = 剩下寫出來的
  const splitAt = written >= 6 ? 4 : Math.max(1, Math.ceil(written * 2 / 3));
  const sections = [[0, splitAt], [splitAt, written]].filter(([a, b]) => b > a);
  const cymA = R() < 0.7 ? "hh" : "ride", cymB = R() < 0.5 ? (cymA === "hh" ? "ride" : "hh") : cymA;
  const ostOK = OST.filter(o => cellOK(o.mask, C.wl) && o.w[gi] > 0 && (o.mask !== 15 || bpm <= 100));
  const kickOK = (first) => KICK_HALF.filter(k => (!first || k.first) && k.w[gi] > 0 && k.m.every(m => cellOK(m, C.wl)));
  const measures = [];
  sections.forEach(([a, b], si) => {
    const cym = si ? cymB : cymA, ost = wpick(R, ostOK, o => o.w[gi]).mask;
    let kick = [wpick(R, kickOK(true), k => k.w[gi]), wpick(R, kickOK(false), k => k.w[gi])];
    for (let m = a; m < b; m++) {
      if (m > a) kick = kick.map((k, h) => (R() < 0.3 ? wpick(R, kickOK(h === 0), x => x.w[gi]) : k));
      const last = m === b - 1;
      const fillFrom = !last ? 4 : wpick(R, si === 0 ? [[3, 2], [2, 3], [0, 0.8]] : [[3, 1.5], [2, 3]], x => x[1])[0];
      const crash = m === a && (si > 0 ? R() < 0.9 : R() < 0.4);
      const { hand, feet } = grooveBar(C, R, { cym, ost, kick, crash, fillFrom });
      measures.push({ voices: [maskVoice(hand, C.wl, R), maskVoice(feet, C.wl, R)] });
    }
  });
  for (let m = written; m < bars; m++) measures.push({ slash: true });
  const specOut = { lines: 5, time: "4/4", measures };
  const events = toEvents(specOut, { bpm });
  const notes = ["kitPieces", "developEnd", "design", "noMarks", "tempoRandom", "developClick", "pieceVel"];
  return {
    grade: g, seed: seed >>> 0, time: "4/4", bars, bpm, bpmRange: [...spec.bpm], develop: { from: written, bars: dev }, cyms: [cymA, cymB],
    spec: specOut, measures, events, lenBeats: specBeats(specOut), notes, src: spec.src || null
  };
}
