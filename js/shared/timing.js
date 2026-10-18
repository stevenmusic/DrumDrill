/* 觸控鼓墊的節奏評分(純函式,沒有 DOM、沒有 AudioContext;docs/STAGES.md S7,tools/test/checks/timing.mjs 測試)。
   每條 lane(鼓墊)各自用 PianoDrill 的 scoreRhythm(js/shared/onsets.js,兩個 App 同一份)評分,再合併成總結。
   - 時間一律是「從第一拍(預備拍之後)算起的秒數」:預期 = 拍子 × 60 / bpm;敲擊 = 鼓墊的音訊時間 − player.beatToTime(0)
   - 固定的延遲(裝置延遲、習慣晚一點)不算節奏錯:先用全部的敲擊估計整體偏移,扣掉再評,另外顯示
     「整體慢約 X 毫秒(已先扣掉)」(跟 PianoDrill 視奏一樣,≥ 80 毫秒才提)
   - 偏移超過 OFFSET_LIMIT 就不扣(多半是整段晚了一拍,或藍牙耳機延遲太大):照原本的時間只算命中 / 漏 / 多,不給分數,改提醒
   容許範圍沿用 PianoDrill(max(70 ms, ¼ 拍),上限 160 ms)、OFFSET_LIMIT、合併分數的算法都是「練習設定」(大綱沒有規定)。
   結果是練習回饋,不是考試分數(不換算成 Pass / Merit / Distinction)。 */
import { scoreRhythm } from "./onsets.js";

/* 鼓墊的分組(鼓件 id 照 data/drumkey.json):1 個鼓墊 = 小鼓(所有事件都算在這一個);3 個 = 鈸 / 鼓 / 大鼓與腳踩 HH。
   key = 鍵盤(F / J / K;不用 Space,Space 是播放) */
export const LANES = {
  1: [{ id: "snare", label: ["小鼓", "Snare"], key: ["j", "f"], pieces: null }],
  3: [
    { id: "cym", label: ["鈸", "Cymbal"], key: "f", pieces: ["hh", "hhClosed", "hhOpen", "ride", "rideBell", "crash"] },
    { id: "drum", label: ["鼓", "Drum"], key: "j", pieces: ["snare", "xstick", "tomHi", "tomMid", "tomFloor"] },
    { id: "foot", label: ["大鼓・腳踩", "Kick · HH"], key: "k", pieces: ["kick", "hhFoot"] }
  ]
};
export const SAME_TIME = 0.04;      // 同一條 lane 相差這麼近的擊打算一下(兩手、手腳一起打;跟 PianoDrill expectedOnsets 一樣)
export const OFFSET_LIMIT = 0.3;    // 整體偏移超過這麼多就不扣(練習設定)
export const LAG_NOTE_MS = 80;      // 整體偏移 ≥ 這麼多才提(跟 PianoDrill 視奏一樣)

const laneOf = (lanes, piece) => {
  for (const l of lanes) if (!l.pieces || l.pieces.includes(piece)) return l.id;
  return null;
};
const dedupe = times => {
  const s = [...times].sort((a, b) => a - b);
  return s.filter((t, i) => i === 0 || t - s[i - 1] > SAME_TIME);
};

/* 事件 [{beat, piece}] → { laneId: [秒…] }(依鼓墊分組;同一條 lane 同一時間的多個擊打算一下;不屬於任何 lane 的鼓件不算) */
export function expectedByLane(events, bpm, lanes = LANES[1]){
  const sec = 60 / bpm, out = {};
  for (const l of lanes) out[l.id] = [];
  for (const e of events || []) {
    if (!e || !isFinite(e.beat)) continue;
    const id = laneOf(lanes, e.piece);
    if (id != null) out[id].push(e.beat * sec);
  }
  for (const id of Object.keys(out)) out[id] = dedupe(out[id]);
  return out;
}

/* 不扣偏移時用:跟 scoreRhythm 一樣的最近配對與容許範圍,只算命中 / 漏 / 多(scoreRhythm 一定會先扣偏移,所以不能拿它算) */
function matchOnly(expected, taps, tolerance){
  const used = new Set(), errors = [];
  for (const time of expected) {
    let bi = -1, be = Infinity;
    taps.forEach((v, i) => { const err = Math.abs(v - time); if (!used.has(i) && err < be) { be = err; bi = i; } });
    if (bi !== -1 && be <= tolerance) { used.add(bi); errors.push(be); }
  }
  const hits = errors.length;
  return { score: null, hits, total: expected.length, missed: expected.length - hits, extra: taps.length - hits,
    meanErrorMs: Math.round((hits ? errors.reduce((a, b) => a + b, 0) / hits : 0) * 1000), offsetMs: 0, toleranceMs: Math.round(tolerance * 1000) };
}

/* expected = expectedByLane 的結果;taps = [{lane, time}](秒,跟 expected 同一個時鐘,還沒扣偏移)。
   回傳 { score(0–100;不扣偏移時 null), hits, total, missed, extra, meanErrorMs, toleranceMs,
          offsetMs(整體偏移,正 = 慢), offsetApplied, offsetTooLarge, lanes: { id: scoreRhythm 的結果(offsetMs = 扣掉整體之後各自剩的) } } */
export function scoreLanes(expected, taps, { tempoBpm = 80, offsetLimit = OFFSET_LIMIT } = {}){
  const ids = [...new Set([...Object.keys(expected || {}), ...(taps || []).map(t => t.lane)])];
  const tapsOf = id => (taps || []).filter(t => t.lane === id && isFinite(t.time)).map(t => t.time).sort((a, b) => a - b);
  const toleranceMs = scoreRhythm([], [], { tempoBpm }).toleranceMs;
  // 1. 整體偏移:全部 lane 合在一起估(同一時間的算一下),中位數
  const allExp = dedupe(Object.values(expected || {}).flat());
  const allTaps = (taps || []).filter(t => isFinite(t.time)).map(t => t.time).sort((a, b) => a - b);
  const offset = allExp.length && allTaps.length ? scoreRhythm(allExp, allTaps, { tempoBpm }).offsetMs / 1000 : 0;
  const tooLarge = Math.abs(offset) > offsetLimit;
  const shift = tooLarge ? 0 : offset;
  // 2. 每條 lane 各自評
  const lanes = {};
  for (const id of ids) {
    const exp = (expected && expected[id]) || [], tp = tapsOf(id).map(t => t - shift);
    if (tooLarge) lanes[id] = matchOnly(exp, tp, toleranceMs / 1000);
    else if (!exp.length) lanes[id] = { ...scoreRhythm([], [], { tempoBpm }), extra: tp.length };   // 這條 lane 沒有要打的:敲的都是多的
    else lanes[id] = scoreRhythm(exp, tp, { tempoBpm });
  }
  // 3. 合併:命中、漏、多相加;誤差照命中數加權;分數照各 lane 的音數加權,
  //    沒有要打的 lane 上多敲的,照 scoreRhythm 的「多一下算半個錯」再打折(練習設定)
  const L = Object.values(lanes);
  const sum = k => L.reduce((a, r) => a + r[k], 0);
  const hits = sum("hits"), total = sum("total"), extra = sum("extra");
  const meanErrorMs = hits ? Math.round(L.reduce((a, r) => a + r.meanErrorMs * r.hits, 0) / hits) : 0;
  let score = null;
  if (!tooLarge) {
    const stray = ids.filter(id => !((expected && expected[id]) || []).length).reduce((a, id) => a + lanes[id].extra, 0);
    const base = total ? L.reduce((a, r) => a + r.score * r.total, 0) / total : 0;
    score = Math.round(base * (0.5 + 0.5 * hits / Math.max(1, hits + stray * 0.5)));
  }
  return { score, hits, total, missed: total - hits, extra, meanErrorMs, toleranceMs,
    offsetMs: Math.round(offset * 1000), offsetApplied: !tooLarge && offset !== 0, offsetTooLarge: tooLarge, lanes };
}

/* 整體偏移的說明 [中, 英](不用提時 null) */
export function offsetNote(r){
  const ms = Math.abs(r.offsetMs);
  if (r.offsetTooLarge) return r.offsetMs > 0
    ? [`整體慢約 ${ms} 毫秒,太多了沒有扣掉;跟著預備拍再打一次(藍牙耳機延遲較大)`, `About ${ms} ms late overall — too much to remove; follow the count-in and try again (Bluetooth adds delay)`]
    : [`整體快約 ${ms} 毫秒,太多了沒有扣掉;跟著預備拍再打一次`, `About ${ms} ms early overall — too much to remove; follow the count-in and try again`];
  if (ms < LAG_NOTE_MS) return null;
  return r.offsetMs > 0 ? [`整體慢約 ${ms} 毫秒(已先扣掉)`, `About ${ms} ms late overall (removed first)`]
    : [`整體快約 ${ms} 毫秒(已先扣掉)`, `About ${ms} ms early overall (removed first)`];
}
