/* RSL Debut–3 級小鼓視奏的出題器(純函式:不碰 DOM、不 import i18n,Node 可以直接跑;tools/test/checks/gen-sight.mjs 測試)。
   docs/STAGES.md S8;官方參數照 data/exam-rsl.json 的 sight[g](RSL p.31、35、39、43:4 小節、只用小鼓、時值與休止符、速度):
     Debut:二分、四分音符;四分休止符;♩=80      1 級:八分、四分音符;四分休止符;♩=80
     2 級:四分、八分、十六分音符;四分、八分休止符;♩=70      3 級:同 2 級;♩=70–80
   App 自己的部分(標示用;畫面照這裡的 SOURCE 寫):
   - 拍號一律 4/4:大綱沒寫 Debut–3 級的拍號 → 推估(spec.time.assumed)
   - 節奏格(把官方時值組合成一拍,STAGES.md 決定 4):練習設定。混合格(♪♬、♬♪:一拍裡八分加十六分)另外標出來
   - 結尾停在四分或二分音符、二分音符只放在第 1、3 拍、每小節至少 2 個音、每一題至少用到一次這一級最短的時值:練習設定
   - 速度:官方值;範圍題(3 級 70–80)隨機取整數
   - 白名單:節奏格只留「用到的時值、休止符都在 spec.values / spec.rests 裡」的,所以出題一定只有官方列的時值與休止符
   genSnare(spec, seed, grade) → {
     grade, seed, time:"4/4", timeAssumed, bars, bpm, bpmRange:[lo,hi], cells:[[格 id…]…], mixed(有沒有用到混合格),
     measures:[{ voices:[[ev…]] }](js/shared/kitnotation.js 的 scoreXML 直接用,lines:1)、
     events:[{ beat, piece:"snare" }](js/shared/player.js 播放、timing.js 評分)、lenBeats
   }
   同一個 seed + spec + grade 一定出同一題(random.js 的 mulberry32) */
import { createRandom } from "./random.js";

export const SNARE_GRADES = [0, 1, 2, 3];
export const BEATS = 4;   // 4/4(推估)
/* 節奏格:一格 = 一拍(四分音符),二分音符一格佔兩拍。w = 各級的權重(練習設定:越低的級數越常出簡單的格) */
export const CELLS = [
  { id: "q", evs: ["4"], beats: 1, w: { 0: 5, 1: 4, 2: 3, 3: 2 } },
  { id: "qr", evs: ["r4"], beats: 1, w: { 0: 2, 1: 1.6, 2: 1.2, 3: 1 } },
  { id: "h", evs: ["2"], beats: 2, w: { 0: 2.4 } },
  { id: "ee", evs: ["8", "8"], beats: 1, w: { 1: 4, 2: 4, 3: 3 } },
  { id: "ssss", evs: ["16", "16", "16", "16"], beats: 1, w: { 2: 2, 3: 3 } },
  { id: "er", evs: ["8", "r8"], beats: 1, w: { 2: 1, 3: 1 } },
  { id: "re", evs: ["r8", "8"], beats: 1, w: { 2: 1, 3: 1.2 } },
  { id: "ess", evs: ["8", "16", "16"], beats: 1, w: { 2: 1, 3: 1.5 }, mixed: true },
  { id: "sse", evs: ["16", "16", "8"], beats: 1, w: { 2: 1, 3: 1.5 }, mixed: true }
];
/* 每一題至少要出現一次的時值(這一級最短的;練習設定) */
const MUST = { 0: "2", 1: "8", 2: "16", 3: "16" };
/* 出處標示(畫面用;頁碼在 spec.src.p) */
export const SOURCE = { time: "assumed", countIn: "assumed", cells: "practice", mixed: "practice", ending: "practice" };

const isRest = c => c[0] === "r";
/* 這一級可以用的節奏格(白名單過濾) */
export function cellsFor(spec, grade){
  const vals = new Set(spec.values || []), rests = new Set(spec.rests || []);
  return CELLS.filter(c => c.w[grade] != null && c.evs.every(v => (isRest(v) ? rests.has(v) : vals.has(v))));
}

export function genSnare(spec, seed, grade = spec && spec.grade){
  if (!spec || spec.type !== "snare") throw new Error("genSnare:只出小鼓視奏(spec.type 要是 snare)");
  if (!SNARE_GRADES.includes(grade)) throw new Error("genSnare:級數要是 0–3(" + grade + ")");
  if ((spec.time && spec.time.v) !== "4/4") throw new Error("genSnare:拍號只支援 4/4(" + (spec.time && spec.time.v) + ")");
  const rnd = createRandom(seed >>> 0);
  const pool = cellsFor(spec, grade);
  if (!pool.length) throw new Error("genSnare:這一級沒有可以用的節奏格");
  const bars = spec.bars, [lo, hi] = spec.bpm;
  const must = MUST[grade];
  let cells = null;
  for (let tries = 0; tries < 200 && !cells; tries++) {
    const all = [];
    for (let m = 0; m < bars; m++) all.push(genBar(rnd, pool, grade, m === bars - 1));
    if (!must || all.some(b => b.some(id => byId(id).evs.includes(must)))) cells = all;
  }
  if (!cells) throw new Error("genSnare:出不了題");
  const bpm = lo === hi ? lo : rnd.int(lo, hi);
  const measures = cells.map(bar => ({ voices: [bar.flatMap(id => byId(id).evs.map(v => (isRest(v) ? { value: v } : { value: v, notes: [{ piece: "snare" }] })))] }));
  const events = [];
  measures.forEach((m, mi) => {
    let pos = mi * BEATS;
    for (const ev of m.voices[0]) { if (!isRest(ev.value)) events.push({ beat: pos, piece: "snare" }); pos += LEN[ev.value.replace(/^r/, "")]; }
  });
  return { grade, seed: seed >>> 0, time: "4/4", timeAssumed: !!(spec.time && spec.time.assumed), bars, bpm, bpmRange: [lo, hi],
    cells, mixed: cells.some(b => b.some(id => byId(id).mixed)), measures, events, lenBeats: bars * BEATS };
}
const LEN = { "2": 2, "4": 1, "8": 0.5, "16": 0.25 };
const byId = id => CELLS.find(c => c.id === id);

/* 一小節:從第 1 拍排到第 4 拍;二分音符只放在第 1、3 拍;最後一小節的最後一拍是四分(或第 3 拍起的二分)音符;至少 2 個音 */
function genBar(rnd, pool, grade, last){
  for (let t = 0; t < 100; t++) {
    const out = [];
    let pos = 0;
    while (pos < BEATS) {
      let opts = pool.filter(c => pos + c.beats <= BEATS && (c.beats < 2 || pos % 2 === 0));
      // 結尾:最後一拍落在四分音符,或第 3 拍起的二分音符(有二分音符的級數一半的機會)
      if (last && pos === BEATS - 1) opts = opts.filter(c => c.id === "q");
      if (last && pos === BEATS - 2 && opts.some(c => c.id === "h") && rnd.chance(0.5)) { out.push("h"); pos += 2; continue; }
      const c = rnd.weighted(opts.map(o => ({ ...o, weight: o.w[grade] })));
      out.push(c.id); pos += c.beats;
    }
    const notes = out.reduce((n, id) => n + byId(id).evs.filter(v => !isRest(v)).length, 0);
    if (notes >= 2) return out;
  }
  return Array(BEATS).fill("q");
}

/* 這一題用到的時值與休止符(檢查用) */
export function valuesUsed(test){
  const out = new Set();
  for (const m of test.measures) for (const ev of m.voices[0]) out.add(ev.value);
  return [...out];
}
