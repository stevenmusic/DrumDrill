/* RSL 聽力的出題器(docs/STAGES.md S12、決定 6;純函式:不碰 DOM、不 import i18n,Node 可以直接跑;tools/test/checks/gen-ear.mjs 每級 1000 個種子檢查)。
   官方參數照 data/exam-rsl.json 的 ear[g](RSL p.31、35、39、43、48、53、59、64、69;docs/sources/rsl-drums.md §5)。

   genFill(spec, seed, grade) → Fill Playback & Recognition 的題目:
     { grade, seed, kind:"fill", time:"4/4", bars:1, bpm, cells:[每一拍的格子 id], pool:[這一級可以用的格子 id],
       spec:{ lines:1, time, measures }(kitnotation 單線譜,只有小鼓)、measures、events(kitevents.toEvents)、lenBeats,
       options(選項數 2 / 3)、plays、countInBars、values / rests(這一級的白名單)、notes、src }
     spec = ear[g](或 ear[g].fill);1 小節、只用小鼓、♩ = 資料檔的 fill.bpm(全部級數 70)、單線譜(App 的選擇,圖例會標)。
     時值白名單 = fill.values / fill.rests;6–8 級官方只寫「四分到十六分六連音的所有時值與組合」(fill.valueRange),
     App 依官方範圍用 RANGE_VALUES(4、8、8t3、8.、16、16t6;附點八分只出「8. 16」「16 8.」)+ 資料檔的休止符(6 級 r4 r8、7–8 級加 r16)(NOTES.fillRange)。
   distractors(fill, n, seed) → n 個干擾選項(同 genFill 的格式,另加 changed = 改了第幾拍):
     每個只改一拍成這一級另一個合法的格子;整小節的擊打時間跟答案不同、彼此也不同(只差休止符寫法、聽起來一樣的不算)。
     n 沒給 = fill.options − 1(Debut–3 級 1 個、4–8 級 2 個)。
   fillOptions(fill, seed) → { options:[答案 + 干擾,洗牌過], answer(答案的位置) }
   genGroove(spec, seed, grade) → Groove Recall 的回打部分:
     { grade, seed, kind:"groove", time:"4/4", bars:2, bpm, pieces(這一級可以用的鼓件), spec:{ lines:5, time, measures }, measures,
       events(兩小節一遍)、lenBeats、repeat(播幾遍;資料檔 repeat.v = 2,推估)、playEvents / playBeats(播 repeat 遍的事件)、
       styleChoices、styleOptions:null(風格清單大綱沒寫 → 不出風格題)、notes、src }
     鼓件照級數(資料檔 groove.pieces;6–8 級「整組鼓」= KIT_GROOVE_PIECES,推估);速度在官方範圍內隨機取整數。
   同一個 spec + seed 一定出同一題(mulberry32,js/shared/kitgen.js 的 rng)。
   節奏格與組合方式是 App 的出題設計(練習設定,docs/GENERATORS.md §3)。 */
import { DIV } from "../shared/kitnotation.js";
import { toEvents, specBeats, repeatEvents, EVENT_NOTES } from "../shared/kitevents.js";
import { rng, wpick, randInt, newBar, maskVoice } from "../shared/kitgen.js";

export const RANGE_VALUES = ["4", "8", "8t3", "8.", "16", "16t6"];
export const KIT_GROOVE_PIECES = ["hh", "hhOpen", "snare", "xstick", "kick", "hhFoot", "ride", "rideBell", "crash", "tomHi", "tomMid", "tomFloor"];
export const NOTES = {
  fillTime: { kind: "assumed", text: ["Fill 的拍號大綱沒寫,App 用 4/4", "Fill metre not stated; the App uses 4/4"] },
  fillLine: { kind: "practice", text: ["只用小鼓 → App 畫成單線譜", "Snare only, so the App writes it on a 1-line staff"] },
  fillRange: { kind: "assumed", text: ["依官方範圍:「四分到十六分六連音」,App 用四分、八分、附點八分、八分三連音、十六分、十六分六連音", "Per the official range 'crotchets to semiquaver sextuplets': the App uses ♩ ♪ ♪., triplet ♪, ♬ and sextuplet ♬"] },
  fillDesign: { kind: "practice", text: ["一拍一格的組合方式是 App 的出題設計", "How beats are combined is the App's design"] },
  distractor: { kind: "practice", text: ["其他選項:只改一拍,聽起來一定不一樣", "Other options change one beat and always sound different"] },
  grooveTime: { kind: "assumed", text: ["律動的拍號大綱沒寫,App 用 4/4", "Groove metre not stated; the App uses 4/4"] },
  grooveRepeat: { kind: "assumed", text: ["「two bar groove that is repeated」:App 兩小節播兩遍", "'Two bar groove that is repeated': the App plays the 2 bars twice"] },
  grooveDesign: { kind: "practice", text: ["大綱只列鼓件:節奏型與每一級的難度遞增是 App 的出題設計", "Only the kit pieces are listed: patterns and how they get harder are the App's design"] },
  kitPieces: { kind: "assumed", text: ["大綱只寫「整組鼓」:App 用 HH(開閉、腳踩)、小鼓、cross stick、大鼓、Ride(含碗)、Crash、三個筒鼓", "'Full kit': HH (open/closed, foot), snare, cross stick, bass drum, ride (and bell), crash, 3 toms"] },
  tempoRandom: { kind: "practice", text: ["速度在官方範圍內隨機", "Tempo picked at random within the official range"] },
  noStyle: { kind: "omit", text: ["風格選項大綱沒寫,App 不出這一題", "Style options are not listed, so the App skips that question"] },
  pieceVel: EVENT_NOTES.pieceVel
};

/* 時值(DIV = 一個四分音符;自己的表)*/
const DUR = { "4": DIV, "8": DIV / 2, "8.": DIV * 3 / 4, "16": DIV / 4, "8t3": DIV / 3, "16t6": DIV / 6 };
/* ── Fill 的格子(一拍;App 的出題設計)。w = 各級權重(沒寫 = 那一級不用;最後還要通過白名單)── */
const T6 = "16t6 16t6 16t6 16t6 16t6 16t6";
export const FILL_CELLS = [
  { id: "q", s: "4", w: [3, 3, 2, 1.5, 1.2, 1.2, 1, 1, 1] },
  { id: "ee", s: "8 8", w: [3, 3, 3, 2.5, 2, 2, 2, 2, 2] },
  { id: "ssss", s: "16 16 16 16", w: [, , 2, 2, 2, 2, 2, 2, 2] },
  { id: "ess", s: "8 16 16", w: [, , 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5] },
  { id: "sse", s: "16 16 8", w: [, , 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5] },
  { id: "ses", s: "16 8 16", w: [, , , 0.6, 0.8, 0.8, 0.8, 0.8, 0.8] },
  { id: "t3", s: "8t3 8t3 8t3", w: [, , , 2.5, 2, 2, 2, 2, 2] },
  { id: "ds", s: "8. 16", w: [, , , , 2.5, 2.5, 1.2, 1.2, 1.2] },
  { id: "sd", s: "16 8.", w: [, , , , 0.8, 0.8, 0.6, 0.6, 0.6] },
  { id: "x6", s: T6, w: [, , , , , , 2.5, 2.5, 2.5] },
  { id: "qr", s: "r4", w: [, 1, 1, 0.8, , , 0.8, 0.5, 0.5] },
  { id: "re", s: "r8 8", w: [, , , , , , 1, 0.6, 0.6] },
  { id: "er", s: "8 r8", w: [, , , , , , 1, 0.6, 0.6] },
  { id: "rss", s: "r8 16 16", w: [, , , , , , 0.8, 0.5, 0.5] },
  { id: "ssr", s: "16 16 r8", w: [, , , , , , 0.8, 0.5, 0.5] },
  { id: "rsse", s: "r16 16 8", w: [, , , , , , , 0.5, 0.5] },
  { id: "rsss", s: "r16 16 16 16", w: [, , , , , , , 0.5, 0.5] },
  { id: "ers", s: "8 r16 16", w: [, , , , , , , 0.4, 0.4] },
  { id: "srs8", s: "16 r16 8", w: [, , , , , , , 0.3, 0.3] }
].map(c => {
  const codes = c.s.split(" "), on = [];
  let p = 0;
  for (const x of codes) { const r = x[0] === "r", v = r ? x.slice(1) : x; if (!r) on.push(p); p += DUR[v]; }
  return { ...c, codes, onsets: on, len: p, notes: on.length };
});
/* 每一級最常要練的時值(每題至少一格用到;練習設定) */
const MUST = { 0: "8", 1: "8", 2: "16", 3: "8t3", 4: "8.", 5: "8.", 6: "16t6", 7: "16t6", 8: "16t6" };
const cellById = id => FILL_CELLS.find(c => c.id === id);

/* 這一級的 Fill 白名單:{ values, rests, range }(6–8 級 values 是 null → RANGE_VALUES) */
export function fillWhitelist(f){
  const range = !Array.isArray(f.values);
  return { values: new Set(range ? RANGE_VALUES : f.values), rests: new Set(f.rests || []), range };
}
const fillPart = spec => (spec && spec.fill ? spec.fill : spec);
export const fillPool = (f, g) => {
  const wl = fillWhitelist(f);
  return FILL_CELLS.filter(c => c.w[g] > 0 && c.codes.every(x => (x[0] === "r" ? wl.rests.has(x) : wl.values.has(x))));
};

/* 一小節的格子 → 輸出 */
function fillOut(base, cells){
  const measures = [{ voices: [cells.flatMap(id => cellById(id).codes.map(x => (x[0] === "r" ? { value: x } : { value: x, notes: [{ piece: "snare" }] })))] }];
  const spec = { lines: 1, time: "4/4", measures };
  return { ...base, cells: [...cells], spec, measures, events: toEvents(spec, { bpm: base.bpm }), lenBeats: specBeats(spec) };
}
/* 整小節的擊打時間(DIV;比較「聽起來一不一樣」) */
export const onsetKey = cells => cells.flatMap((id, b) => cellById(id).onsets.map(o => b * DIV + o)).join(",");
/* 一小節合不合 App 的出題規則(練習設定):至少 4 個音、整拍休止最多一個、四拍不全一樣 */
const barOK = cells => cells.reduce((s, id) => s + cellById(id).notes, 0) >= 4 && cells.filter(id => id === "qr").length <= 1 && new Set(cells).size > 1;

export function genFill(spec, seed = 1, grade = spec && spec.grade){
  const f = fillPart(spec);
  if (!f || f.bars !== 1 || !(f.pieces || []).includes("snare")) throw new Error("genFill:參數不對(要 ear[g] 或 ear[g].fill)");
  const g = Number.isInteger(grade) ? grade : null;
  if (g == null || g < 0 || g > 8) throw new Error("genFill:級數要是 0–8(" + grade + ")");
  const R = rng(seed), pool = fillPool(f, g), must = MUST[g], wl = fillWhitelist(f);
  if (!pool.length) throw new Error("genFill:這一級沒有可以用的格子");
  let cells = null;
  for (let t = 0; t < 300 && !cells; t++) {
    const c = [0, 1, 2, 3].map(() => wpick(R, pool, x => x.w[g] * (x.codes.includes(must) ? 1.5 : 1)).id);
    if (barOK(c) && (!wl.values.has(must) || c.some(id => cellById(id).codes.includes(must)))) cells = c;
  }
  if (!cells) throw new Error("genFill:出不了題");
  const notes = ["fillTime", "fillLine", "fillDesign", "distractor", "pieceVel"];
  if (wl.range) notes.push("fillRange");
  const base = { grade: g, seed: seed >>> 0, kind: "fill", time: "4/4", bars: 1, bpm: f.bpm, pool: pool.map(c => c.id),
    options: f.options, plays: f.plays, countInBars: f.countInBars, values: [...wl.values], rests: [...wl.rests], notes, src: (spec && spec.src) || null };
  return fillOut(base, cells);
}

export function distractors(fill, n = (fill && fill.options ? fill.options - 1 : 1), seed = 1){
  const R = rng((Number(seed) >>> 0) ^ 0x9E3779B9), pool = fill.pool.map(cellById), g = fill.grade;
  const seen = new Set([onsetKey(fill.cells)]), out = [];
  // 先試合乎出題規則的,不夠再放寬(只要求白名單 + 聽起來不一樣)
  for (const strict of [true, false]) {
    for (let t = 0; t < 400 && out.length < n; t++) {
      const b = Math.floor(R() * 4), cur = cellById(fill.cells[b]);
      const cands = pool.filter(c => c.id !== cur.id);
      const c = wpick(R, cands, x => x.w[g] * (Math.abs(x.notes - cur.notes) <= 1 ? 2 : 1));
      if (!c) continue;
      const cells = fill.cells.slice(); cells[b] = c.id;
      const k = onsetKey(cells);
      if (seen.has(k) || (strict && !barOK(cells))) continue;
      seen.add(k);
      out.push({ ...fillOut(fill, cells), changed: b });
    }
  }
  if (out.length < n) throw new Error(`distractors:只找到 ${out.length} 個干擾選項`);
  return out;
}

export function fillOptions(fill, seed = 1){
  const all = [fill, ...distractors(fill, fill.options - 1, seed)];
  const R = rng((Number(seed) >>> 0) ^ 0x51ED27);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { options: all, answer: all.indexOf(fill) };
}

/* ── Groove(2 小節;App 的出題設計 = 練習設定,NOTES.grooveDesign;docs/GENERATORS.md §3.5)──
   鈸(HH;4 級起也可能 Ride 或整段 Ride 碗)用 G_OST 的節奏型;小鼓反拍(5 級起有時候 cross stick;7–8 級有時候半速只在第 3 拍);
   大鼓兩拍一組(G_KICK,級數越高格子越多;Debut 不出「4. 8」切分,改用「4 4」);2 級起開 HH(下一個 HH 寫閉);3 級起第 1 小節第 1 拍 Crash、偶爾多一下小鼓;
   4 級起 Ride 律動有時候碗在拍點或反拍;6–8 級:第 2 小節最後一拍(7–8 級有時候兩拍)筒鼓、Ride / 碗律動有時候腳踩 HH(2、4 拍;7–8 級有時候每拍)。
   難度遞增:每一級可以用的節奏型、大鼓格子、多一下小鼓的機會越來越多 */
const G_WL = { values: new Set(["4", "4.", "8", "8.", "16"]), rests: new Set(["r4", "r8"]) };
/* 鈸的節奏型:p = 四拍的十六分格子(每拍都有拍點,加了小鼓、筒鼓還是在 MASK_CELL 裡);cym = 可以用在哪些鈸;
   w(g) = 權重(碗另外用 wb);max = ♩ 上限;open = 可以開 HH */
const G_OST = [
  { id: "8ths", p: [5, 5, 5, 5], w: g => 5, wb: 1.5, cym: ["hh", "ride", "rideBell"], open: true },
  { id: "4ths", p: [1, 1, 1, 1], w: g => (g <= 1 ? 1.5 : g < 4 ? 1 : 0.6), wb: 0.8, cym: ["hh", "ride", "rideBell"] },
  { id: "16ths", p: [15, 15, 15, 15], w: g => (g < 3 ? 0 : g < 6 ? 0.8 : 1.2), cym: ["hh", "ride"], max: 110 },
  { id: "8-816", p: [5, 13, 5, 13], w: g => (g < 4 ? 0 : g < 6 ? 1 : 1.3), cym: ["hh", "ride"], max: 130, open: true },
  { id: "4-8", p: [1, 5, 1, 5], w: g => (g < 4 ? 0 : 0.7), wb: 1, cym: ["ride", "rideBell"] },
  { id: "dot", p: [9, 9, 9, 9], w: g => (g < 5 ? 0 : g < 6 ? 0.6 : 0.9), cym: ["hh", "ride"], max: 130 },
  { id: "8-16end", p: [5, 5, 5, 15], w: g => (g < 6 ? 0 : 0.9), cym: ["hh", "ride"], max: 120, open: true },
  { id: "1616-8", p: [7, 7, 7, 7], w: g => (g < 7 ? 0 : 0.7), cym: ["hh", "ride"], max: 110 },
  { id: "8-1616", p: [13, 13, 13, 13], w: g => (g < 7 ? 0 : 0.7), cym: ["hh", "ride"], max: 120 }
];
/* 鈸的選擇(4 級起;整段 Ride 碗的權重比較低) */
const G_CYM = { hh: g => (g < 6 ? 3 : 2.6), ride: g => (g === 4 ? 2.4 : g === 5 ? 2.2 : 2.6), rideBell: g => (g === 4 ? 0.6 : 0.5) };
const G_KICK = [
  { m: [1, 0], w: g => 4 }, { m: [5, 0], w: g => 2 }, { m: [1, 1], w: g => (g <= 1 ? 1.5 : g <= 3 ? 0.8 : 0) }, { m: [1, 4], w: g => (g ? 2.5 : 0) }, { m: [5, 4], w: g => (g >= 2 ? 1.2 : 0) },
  { m: [9, 0], w: g => (g >= 2 ? 1.2 : 0) }, { m: [13, 0], w: g => (g >= 4 ? 0.8 : 0) }, { m: [1, 12], w: g => (g >= 4 ? 0.8 : 0) }, { m: [9, 4], w: g => (g >= 4 ? 0.8 : 0) },
  { m: [3, 0], w: g => (g >= 6 ? 1 : 0) }, { m: [5, 12], w: g => (g >= 6 ? 1.2 : 0) }, { m: [13, 4], w: g => (g >= 6 ? 1 : 0) }, { m: [11, 0], w: g => (g >= 6 ? 0.8 : 0) },
  { m: [1, 9], w: g => (g >= 7 ? 0.8 : 0) }, { m: [7, 0], w: g => (g >= 7 ? 0.6 : 0) }, { m: [9, 12], w: g => (g >= 7 ? 0.6 : 0) }
];
// 小鼓多一下(3 級起;[拍, 格子])
const G_EXTRA = [[3, 2], [3, 3], [1, 3], [2, 2], [0, 3]];
// 筒鼓過門一拍的寫法(6 級起;max = ♩ 上限)
const G_TOM = [{ mask: 15, w: 1.5, max: 120 }, { mask: 5, w: 1.2 }, { mask: 13, w: 1 }, { mask: 7, w: 0.8, max: 120 }];
export const groovePieces = gr => {
  const ps = gr.pieces || [];
  return ps.includes("kit") ? [...KIT_GROOVE_PIECES] : [...ps];
};

export function genGroove(spec, seed = 1, grade = spec && spec.grade){
  const gr = spec && spec.groove ? spec.groove : spec;
  if (!gr || gr.bars !== 2 || !Array.isArray(gr.pieces)) throw new Error("genGroove:參數不對(要 ear[g] 或 ear[g].groove)");
  const g = Number.isInteger(grade) ? grade : null;
  if (g == null || g < 0 || g > 8) throw new Error("genGroove:級數要是 0–8(" + grade + ")");
  const P = new Set(groovePieces(gr)), R = rng(seed);
  const [lo, hi] = gr.bpm, bpm = lo === hi ? lo : randInt(R, lo, hi);
  const cyms = ["hh", ...(P.has("ride") ? ["ride"] : []), ...(P.has("rideBell") ? ["rideBell"] : [])];
  const cym = wpick(R, cyms, c => G_CYM[c](g));
  const ostPool = G_OST.filter(o => o.cym.includes(cym) && (cym === "rideBell" ? o.wb > 0 : o.w(g) > 0) && !(o.max && bpm > o.max));
  const ost = wpick(R, ostPool, o => (cym === "rideBell" ? o.wb : o.w(g)));
  // Ride 律動的碗(4 級起):拍點(0)、反拍(2)或不用
  const bellPos = cym === "ride" && P.has("rideBell") ? wpick(R, [[-1, 1], [0, 0.6], [2, 0.45]], x => x[1])[0] : -1;
  const back = P.has("xstick") && R() < (g === 5 ? 0.45 : 0.25) ? "xstick" : "snare";
  const halfTime = g >= 7 && R() < 0.2;   // 半速:小鼓只在第 3 拍
  const openHH = cym === "hh" && P.has("hhOpen") && ost.open && R() < (g === 2 ? 0.8 : g === 3 ? 0.6 : 0.4);
  const crash = P.has("crash") && R() < (g === 3 ? 0.8 : 0.55);
  const footHH = cym !== "hh" && P.has("hhFoot") && R() < 0.45;
  const footAll = footHH && g >= 7 && R() < 0.4;   // 腳踩 HH 每拍
  const toms = ["tomHi", "tomMid", "tomFloor"].filter(t => P.has(t));
  const tomFill = toms.length && R() < (g >= 7 ? 0.65 : 0.6);
  const tomBeats = tomFill ? (g >= 7 && R() < 0.35 ? 2 : 1) : 0;
  const extra = g >= 3 ? (g >= 7 ? 0.65 : g >= 6 ? 0.55 : 0.3) : 0, extra2 = g >= 7 ? 0.3 : 0;
  const kickOK = first => G_KICK.filter(k => k.w(g) > 0 && (!first || (k.m[0] & 1)));
  let kick = [wpick(R, kickOK(true), k => k.w(g)), wpick(R, kickOK(false), k => k.w(g))];
  const backBeats = halfTime ? [2] : [1, 3];
  const measures = [];
  for (let m = 0; m < 2; m++) {
    if (m === 1) kick = kick.map((k, h) => (R() < 0.3 ? wpick(R, kickOK(h === 0), x => x.w(g)) : k));
    const hand = newBar(), feet = newBar();
    const fillBeat = m === 1 && tomBeats ? 4 - tomBeats : 4;
    for (let b = 0; b < fillBeat; b++) {
      for (const i of [0, 1, 2, 3].filter(i => ost.p[b] & (1 << i))) {
        const piece = m === 0 && b === 0 && i === 0 && crash ? "crash" : bellPos === i ? "rideBell" : cym;
        hand[b][i].push({ piece });
      }
      if (backBeats.includes(b)) hand[b][0].push({ piece: back });
    }
    for (let x = 0; x < 2; x++) {
      if (!(R() < (x ? extra2 : extra))) continue;
      const [b, i] = G_EXTRA[Math.floor(R() * G_EXTRA.length)];
      if (b < fillBeat && !hand[b][i].some(n => n.piece === back)) hand[b][i].push({ piece: back });
    }
    for (let h = 0; h < 2; h++) for (let k = 0; k < 2; k++) { const b = h * 2 + k; for (const i of [0, 1, 2, 3].filter(i => kick[h].m[k] & (1 << i))) feet[b][i].push({ piece: "kick" }); }
    if (footHH) for (const b of (footAll ? [0, 1, 2, 3] : [1, 3])) feet[b][0].push({ piece: "hhFoot" });
    // 筒鼓:第 2 小節最後一拍(7–8 級有時候兩拍),從高往低走,大鼓留每一拍的拍點
    if (fillBeat < 4) {
      const masks = [];
      for (let b = fillBeat; b < 4; b++) masks.push(wpick(R, G_TOM.filter(t => !(t.max && bpm > t.max)), t => t.w).mask);
      const bits = masks.flatMap((mk, j) => [0, 1, 2, 3].filter(i => mk & (1 << i)).map(i => [fillBeat + j, i]));
      bits.forEach(([b, i], j) => hand[b][i].push({ piece: toms[Math.min(toms.length - 1, Math.floor(j * toms.length / bits.length))] }));
      for (let b = fillBeat; b < 4; b++) feet[b] = [[{ piece: "kick" }], [], [], []];
    }
    measures.push({ hand, feet });
  }
  // 開 HH:兩小節裡一次,在某一拍的反拍八分(不放最後一個 HH),下一個 HH 寫閉
  if (openHH) {
    const hhAt = [];
    measures.forEach((bar, m) => bar.hand.forEach((beat, b) => beat.forEach((s, i) => { if (s.some(n => n.piece === "hh")) hhAt.push({ m, b, i }); })));
    const cand = hhAt.slice(0, -1).filter(x => x.i === 2 && measures[x.m].hand[x.b][x.i].length === 1);
    if (cand.length) {
      const k = hhAt.indexOf(cand[Math.floor(R() * cand.length)]), a = hhAt[k], z = hhAt[k + 1];
      measures[a.m].hand[a.b][a.i].find(n => n.piece === "hh").open = true;
      measures[z.m].hand[z.b][z.i].find(n => n.piece === "hh").closed = true;
    }
  }
  const ms = measures.map(bar => ({ voices: [maskVoice(bar.hand, G_WL, R), maskVoice(bar.feet, G_WL, R)] }));
  const specOut = { lines: 5, time: "4/4", measures: ms };
  const events = toEvents(specOut, { bpm }), lenBeats = specBeats(specOut);
  const repeat = (gr.repeat && gr.repeat.v) || 1;
  const notes = ["grooveTime", "grooveDesign", "grooveRepeat", "pieceVel"];
  if ((gr.pieces || []).includes("kit")) notes.push("kitPieces");
  if (lo !== hi) notes.push("tempoRandom");
  if (gr.styleChoices > 0) notes.push("noStyle");
  return {
    grade: g, seed: seed >>> 0, kind: "groove", time: "4/4", bars: 2, bpm, bpmRange: [lo, hi], pieces: [...P],
    spec: specOut, measures: ms, events, lenBeats, repeat, playEvents: repeatEvents(events, lenBeats, repeat), playBeats: lenBeats * repeat,
    styleChoices: gr.styleChoices || 0, styleOptions: null, notes, src: (spec && spec.src) || null
  };
}
