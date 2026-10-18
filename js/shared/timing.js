/* 觸控鼓墊的節奏評分(純函式,沒有 DOM、沒有 AudioContext;docs/STAGES.md S7,tools/test/checks/timing.mjs 測試)。
   用 PianoDrill 的 scoreRhythm(js/shared/onsets.js,兩個 App 同一份,不能改)估整體偏移;每條 lane(鼓墊)再用同樣的配對與計分公式評,合併成總結。
   - 時間一律是「從第一拍(預備拍之後)算起的秒數」:預期 = 拍子 × 60 / bpm;敲擊 = 鼓墊的音訊時間 − player.beatToTime(0)
   - 固定的延遲(裝置延遲、習慣晚一點)不算節奏錯:先用全部的敲擊估計整體偏移,扣掉再評,另外顯示
     「整體慢約 X 毫秒(已先扣掉)」(跟 PianoDrill 視奏一樣,≥ 80 毫秒才提)
   - 扣掉整體偏移後,每條 lane 不再各自估偏移(不然大鼓整條晚 300 毫秒也會被扣掉、照樣 100 分):照扣完的時間做最近配對,
     計分公式跟 scoreRhythm 一樣。lane 自己剩下的偏移(scoreRhythm 的估法,laneResidualMs)只拿來顯示:
     跟各 lane 剩的偏移的中位數差超過容許範圍一半 → lag 旗標 + laneNote 提示(啟發式,細節在 scoreLanes 上面);
     各 lane 一致地偏(密集音型整體偏移估錯一格)→ 整體偏移重新對齊後再評
   - 只有一條 lane 有東西(1 個鼓墊,或 3 個鼓墊只用到一條)時,整體偏移就是這條的偏移:結果跟 scoreRhythm 直接評一模一樣(跟 PianoDrill 視奏一致)
   - 偏移超過 OFFSET_LIMIT 就不扣(多半是整段晚了一拍,或藍牙耳機延遲太大):照原本的時間只算命中 / 漏 / 多,不給分數,改提醒
   容許範圍沿用 PianoDrill(max(70 ms, ¼ 拍),上限 160 ms)、OFFSET_LIMIT、lane 旗標門檻、合併分數的算法都是「練習設定」(大綱沒有規定)。
   結果是練習回饋,不是考試分數(不換算成 Pass / Merit / Distinction)。 */
import { scoreRhythm, detectOnsets } from "./onsets.js";

/* 麥克風錄到的一段 → 起音時間(秒,從第一個取樣算起)。用 onsets.js 的 detectOnsets(兩個 App 同一份,不能改),
   鼓比較密(十六分音符、Flam 之後馬上接下一下),參數照 docs/STAGES.md S15:hop 5 ms、refractory 0.05 秒(練習設定)。
   - detectOnsets 固定「10 毫秒一格、回傳格數 × 0.01 秒」:把取樣率乘上 hop / 0.01 傳進去(每格 = hop 秒的取樣數),
     回傳的秒數再乘回來;refractory 照同一個比例換。onsets.js 的預設(10 ms、0.09 秒)與內容不動(PianoDrill 照舊)
   - 整組鼓直接整段丟進去不夠(tools/test/mic-check.mjs 的 node 側,App 真的題目混音:漏 12%、多 7%):
     大鼓、筒鼓的低頻在打下去之後約 75 ms 還會再脹一次(多偵);鈸一直在響、輕的段落(pp)被整段最大聲的那一下定的門檻蓋掉(漏偵)。
     所以先分成兩個頻帶(MIC_BANDS:400–3000 Hz、3000 Hz 以上;低頻只有大鼓的「脹」,不用),每個頻帶切成一段一段
     (前後多帶 0.5 秒)各自找(門檻跟著那一段的音量走),再合起來(refractory 內算一下)。濾波器是兩個一階低通串接,沒有相位問題要管:
     起音的位置照 detectOnsets 的格子。整段的音量太小(最大的一格 RMS < 0.004,跟 detectOnsets 一樣)= 沒有聲音
   - 每一段後面補 30% 長度的靜音(MIC_PAD)再丟進去:detectOnsets 的底噪門檻 = 整段的中位數 × 4(照鋼琴設計);鼓一直打的時候中位數
     就是前一下的尾音,重音中間的輕音(十六分音符、hi-hat)會被蓋掉。補靜音讓中位數落在比較低的位置(約 38 百分位),門檻跟著降
     (node 側混音:漏 3.1% → 0%;代價是多偵變多:大鼓、筒鼓打下去約 60 ms 後低中頻再脹一次的被多算)
   - 所以緊接在前一下後面(< MIC_BLOOM_GAP 0.12 秒)、高頻(3000 Hz 以上)沒有跟著變大(< 1.5 倍)的不算:真的敲擊一定有鼓棒 / 鼓槌的高頻;
     小鼓取樣約 110 ms 的房間反射也是這樣濾掉
     (node 側混音:多偵 5.7% → 3.1%)
   - 已知限制:crash / ride 還在響的時候,同時的輕 hi-hat(只有高頻、沒有變大兩倍)會漏(mic-check 的 RSL 4:官方速度 ♩=89 沒有漏;拉到 ♩=150 約漏兩成);
     全部鼓件合併成一條,分不出是哪個鼓。這些門檻都是練習設定,要用實機的錄音再調(docs/STAGES.md S15) */
export const MIC_HOP = 0.005, MIC_REFRACTORY = 0.05;
export const MIC_BANDS = [{ lo: 400, hi: 3000, chunk: 1 }, { lo: 3000, hi: 0, chunk: 3 }];
export const MIC_OVERLAP = 0.5, MIC_PAD = 0.3, MIC_BLOOM_GAP = 0.12, MIC_BLOOM_RISE = 1.5;
const SILENT_RMS = 0.004;
function lowpass2(x, fc, sr){   // 兩個一階低通串接
  const a = Math.exp(-2 * Math.PI * fc / sr), y = new Float32Array(x.length);
  let p = 0, q = 0;
  for (let i = 0; i < x.length; i++) { p = (1 - a) * x[i] + a * p; q = (1 - a) * p + a * q; y[i] = q; }
  return y;
}
function band(x, lo, hi, sr){
  const top = hi ? lowpass2(x, hi, sr) : x, bot = lo ? lowpass2(x, lo, sr) : null;
  if (!bot) return top;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = top[i] - bot[i];
  return y;
}
export function detectHits(samples, sampleRate, { hop = MIC_HOP, refractory = MIC_REFRACTORY, bands = MIC_BANDS, overlap = MIC_OVERLAP, pad = MIC_PAD,
  bloomGap = MIC_BLOOM_GAP, bloomRise = MIC_BLOOM_RISE } = {}){
  const k = hop / 0.01, n = Math.round(sampleRate * hop), frame = Math.round(sampleRate * k * 0.01);
  if (!samples || samples.length < n * 5) return [];
  let peak = 0;
  for (let f = 0; f + n <= samples.length; f += n) { let s = 0; for (let i = f; i < f + n; i++) s += samples[i] * samples[i]; peak = Math.max(peak, Math.sqrt(s / n)); }
  if (peak < SILENT_RMS) return [];
  const find = x => {
    if (pad > 0) { const y = new Float32Array(x.length + Math.round(x.length * pad)); y.set(x); x = y; }   // 後面補靜音(上面的說明)
    // detectOnsets 的一格 = round(sampleRate × hop) 個樣本,回傳「格數 × 0.01」:照實際的格長換回秒
    // (44.1 kHz 時一格 220.5 → 221 個樣本,直接 × k 會越後面越早,一段 2 秒差到 7 ms;48 kHz 剛好整除,結果不變)
    return detectOnsets(x, sampleRate * k, { refractory: refractory / k }).map(t => t * 100 * frame / sampleRate);
  };
  const all = [];
  let high = null;
  for (const b of bands) {
    const x = band(samples, b.lo, b.hi, sampleRate);
    if (!b.hi && b.lo) high = x;
    if (!b.chunk) { all.push(...find(x)); continue; }
    const N = Math.round(b.chunk * sampleRate), O = Math.round(overlap * sampleRate);
    for (let a = 0; a < x.length; a += N) {
      const from = Math.max(0, a - O), to = Math.min(x.length, a + N + O);
      for (const t of find(x.subarray(from, to))) { const T = t + from / sampleRate; if (T >= a / sampleRate && T < (a + N) / sampleRate) all.push(T); }
    }
  }
  all.sort((a, b) => a - b);
  const merged = [];
  for (const t of all) if (!merged.length || t - merged[merged.length - 1] >= refractory - 1e-9) merged.push(t);
  // 緊接在前一下後面(< bloomGap)、高頻沒有跟著變大的 = 大鼓、筒鼓的低中頻再脹一次或房間反射,不是新的一下(真的敲擊一定有鼓棒 / 鼓槌的高頻)
  const out = [];
  const rms = (x, a, b) => { let s = 0, c = 0; for (let i = Math.max(0, a); i < Math.min(x.length, b); i++) { s += x[i] * x[i]; c++; } return c ? Math.sqrt(s / c) : 0; };
  for (const t of merged) {
    const prev = out.length ? out[out.length - 1] : -Infinity;
    if (high && t - prev < bloomGap) {
      const i = Math.round(t * sampleRate), w = Math.round(sampleRate * 0.005);
      const before = Math.min(rms(high, i - 4 * w, i - 2 * w), rms(high, i - 3 * w, i - w)), after = Math.max(rms(high, i, i + w), rms(high, i + w, i + 2 * w));
      if (after < before * bloomRise) continue;
    }
    out.push(Math.round(t * 1e6) / 1e6);
  }
  return out;
}

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

/* 最近配對 + 跟 scoreRhythm 一樣的計分公式(scoreRhythm 一定會先自己估偏移再扣,扣過整體偏移的 lane 不能再拿它評):
   每個預期的音配還沒用過、最近的那一下,誤差 ≤ 容許範圍才算命中。withScore = false(偏移太大不扣時)不給分數 */
function matchLane(expected, taps, tolerance, withScore = true){
  const used = new Set(), errors = [];
  for (const time of expected) {
    let bi = -1, be = Infinity;
    taps.forEach((v, i) => { const err = Math.abs(v - time); if (!used.has(i) && err < be) { be = err; bi = i; } });
    if (bi !== -1 && be <= tolerance) { used.add(bi); errors.push(be); }
  }
  const hits = errors.length, extra = taps.length - hits;
  const meanError = hits ? errors.reduce((a, b) => a + b, 0) / hits : 0;
  let score = null;
  if (withScore) {
    if (!expected.length) score = 0;   // 跟 scoreRhythm 一樣:沒有要打的 = 0(合併時不算權重,多敲的另外打折)
    else {
      const coverage = hits / expected.length, timing = 1 - 0.3 * (meanError / tolerance), precision = hits / Math.max(1, hits + extra * 0.5);
      score = Math.max(0, Math.min(100, Math.round(100 * coverage * timing * (0.5 + 0.5 * precision))));
    }
  }
  return { score, hits, total: expected.length, missed: expected.length - hits, extra,
    meanErrorMs: Math.round(meanError * 1000), offsetMs: 0, toleranceMs: Math.round(tolerance * 1000), lag: false };
}

/* 一條 lane 扣掉整體偏移後自己剩的偏移(毫秒,只顯示):用 scoreRhythm 的估法。scoreRhythm 只試 ±0.6 秒內的差,
   晚了將近一拍(例如 ♩=100 晚 600 ms)時會找到反方向的鄰居;所以另外先挪 ±0.5 秒各估一次,取對到最多音的(一樣多取偏移小的) */
const RESIDUAL_STEPS = [0, -0.5, 0.5];
function laneResidualMs(exp, tp, tempoBpm){
  let best = null;
  for (const c of RESIDUAL_STEPS) {
    const r = scoreRhythm(exp, tp.map(t => t - c), { tempoBpm }), ms = r.offsetMs + Math.round(c * 1000);
    if (!best || r.hits > best.hits || (r.hits === best.hits && Math.abs(ms) < Math.abs(best.ms))) best = { hits: r.hits, ms };
  }
  return best.ms;
}

const medianOf = v => {   // 真正的中位數(偶數個取中間兩個的平均;兩條 lane 不偏向任何一條)
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return !s.length ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const MAX_REALIGN = 2;   // 整體偏移最多重新對齊幾次

/* expected = expectedByLane 的結果;taps = [{lane, time}](秒,跟 expected 同一個時鐘,還沒扣偏移)。
   回傳 { score(0–100;不扣偏移時 null), hits, total, missed, extra, meanErrorMs, toleranceMs,
          offsetMs(整體偏移,正 = 慢;重新對齊過就是對齊後的值), offsetApplied, offsetTooLarge, realigned(重新對齊的次數),
          lanes: { id: { score, hits, total, missed, extra, meanErrorMs, toleranceMs,
                         offsetMs(這條 lane 比其他 lane 慢多少 = 自己剩的偏移 − 各 lane 剩的偏移的中位數;只顯示、沒有扣),
                         lag(上面那個 > 容許範圍一半), judged(有拿來比:要打的音、敲擊都有,而且至少兩條這樣的 lane) } },
          lagLanes: [lag 旗標的 lane id], judgedLanes: [judged 的 lane id] }
   lane 單獨偏移的判斷是啟發式(練習設定,大綱沒有規定):
   - 密集音型(例如 ♩=140 十六分)的格子上,「整體晚 64 ms」跟「整體晚 64 − 一格」對到的音一樣多,scoreRhythm 可能挑到錯的那個;
     這時每條 lane 剩的偏移都差不多一樣大(中位數明顯不是 0)。中位數超過容許範圍一半、而且過半數的 lane 跟中位數相差不到容許範圍一半
     (各 lane 意見一致,不是一條單獨晚)→ 整體偏移加上這個中位數重新評(不超過 offsetLimit、命中不能變少才採用;最多 MAX_REALIGN 次)
   - lag 看「這條 lane 剩的偏移 − 各 lane 剩的偏移的中位數」,不是看絕對值:大家一起偏的部分不算某一條的問題。
     少於兩條 lane 能比時不判;能比的 lane 全部都亮(例如兩條 lane 一條晚 300 ms,分不出是誰)時,旗標照樣有、laneNote 不說話
   - 會漏報的情況:一條 lane 單獨晚,但它的音最多、整體偏移就是照它估的(其他 lane 反而看起來早);
     或兩條 lane 時分不出是哪一條。分數照樣會扣(扣掉整體偏移後最近配對),只是提示不一定指對 lane */
export function scoreLanes(expected, taps, { tempoBpm = 80, offsetLimit = OFFSET_LIMIT } = {}){
  const ids = [...new Set([...Object.keys(expected || {}), ...(taps || []).map(t => t.lane)])];
  const expOf = id => (expected && expected[id]) || [];
  const tapsOf = id => (taps || []).filter(t => t.lane === id && isFinite(t.time)).map(t => t.time).sort((a, b) => a - b);
  const tolerance = scoreRhythm([], [], { tempoBpm }).toleranceMs / 1000;
  const toleranceMs = Math.round(tolerance * 1000), halfMs = toleranceMs / 2;
  // 1. 整體偏移:全部 lane 合在一起估(同一時間的算一下),scoreRhythm 的估法
  const allExp = dedupe(Object.values(expected || {}).flat());
  const allTaps = (taps || []).filter(t => isFinite(t.time)).map(t => t.time).sort((a, b) => a - b);
  let offset = allExp.length && allTaps.length ? scoreRhythm(allExp, allTaps, { tempoBpm }).offsetMs / 1000 : 0;
  const tooLarge = Math.abs(offset) > offsetLimit;
  const shift0 = tooLarge ? 0 : offset;
  const active = ids.filter(id => expOf(id).length || tapsOf(id).length);
  const judgeable = ids.filter(id => expOf(id).length && tapsOf(id).length);
  const judging = !tooLarge && active.length > 1 && judgeable.length >= 2;
  // 2. 每條 lane:扣掉整體偏移後最近配對(不再各自估偏移);lane 自己剩的偏移另外估(raw = 對整體偏移的剩餘)
  const evalLanes = shift => {
    const lanes = {}, res = {};
    for (const id of ids) {
      const exp = expOf(id), raw = tapsOf(id), tp = raw.map(t => t - shift);
      if (!tooLarge && active.length === 1 && active[0] === id && exp.length) {
        // 只有這一條:整體偏移就是它的偏移,直接用 scoreRhythm(跟 PianoDrill 視奏一模一樣);剩的偏移 = 0
        lanes[id] = { ...scoreRhythm(exp, raw, { tempoBpm }), offsetMs: 0, lag: false, judged: false };
        continue;
      }
      lanes[id] = { ...matchLane(exp, tp, tolerance, !tooLarge), judged: false };
      if (judging && exp.length && tp.length) res[id] = laneResidualMs(exp, tp, tempoBpm);
    }
    return { lanes, res, hits: Object.values(lanes).reduce((a, r) => a + r.hits, 0) };
  };
  let cur = evalLanes(shift0), realigned = 0;
  // 2b. 整體偏移估錯一格(各 lane 剩的偏移一致地不是 0):加上中位數重新評
  while (judging && realigned < MAX_REALIGN) {
    const v = Object.values(cur.res), med = medianOf(v);
    if (Math.abs(med) <= halfMs || v.filter(x => Math.abs(x - med) <= halfMs).length * 2 <= v.length) break;
    const next = offset + med / 1000;
    if (Math.abs(next) > offsetLimit) break;
    const alt = evalLanes(next);
    if (alt.hits < cur.hits) break;
    cur = alt; offset = next; realigned++;
  }
  const lanes = cur.lanes;
  if (judging) {
    const med = medianOf(Object.values(cur.res));
    for (const [id, ms] of Object.entries(cur.res)) {
      const rel = Math.round(ms - med), r = lanes[id];
      r.offsetMs = rel; r.lag = Math.abs(rel) > halfMs; r.judged = true;
    }
  }
  // 3. 合併:命中、漏、多相加;誤差照命中數加權;分數照各 lane 的音數加權,
  //    沒有要打的 lane 上多敲的,照 scoreRhythm 的「多一下算半個錯」再打折(練習設定)
  const L = Object.values(lanes);
  const sum = k => L.reduce((a, r) => a + r[k], 0);
  const hits = sum("hits"), total = sum("total"), extra = sum("extra");
  const meanErrorMs = hits ? Math.round(L.reduce((a, r) => a + r.meanErrorMs * r.hits, 0) / hits) : 0;
  let score = null;
  if (!tooLarge) {
    const stray = ids.filter(id => !expOf(id).length).reduce((a, id) => a + lanes[id].extra, 0);
    const base = total ? L.reduce((a, r) => a + r.score * r.total, 0) / total : 0;
    score = Math.round(base * (0.5 + 0.5 * hits / Math.max(1, hits + stray * 0.5)));
  }
  return { score, hits, total, missed: total - hits, extra, meanErrorMs, toleranceMs,
    offsetMs: Math.round(offset * 1000), offsetApplied: !tooLarge && offset !== 0, offsetTooLarge: tooLarge, realigned, lanes,
    lagLanes: ids.filter(id => lanes[id].lag), judgedLanes: ids.filter(id => lanes[id].judged) };
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
/* lane 單獨偏移的提示 [中, 英](一條一句;沒有 lag 旗標的 lane 時 null;能比的 lane 全部都亮 = 分不出是哪一條,也是 null)。
   lanes = 鼓墊設定(LANES[3] 等,拿名稱) */
export function laneNote(r, lanes = LANES[3]){
  if (!r || !r.lagLanes || !r.lagLanes.length) return null;
  if (r.lagLanes.length >= (r.judgedLanes || r.lagLanes).length) return null;
  const zh = [], en = [];
  for (const id of r.lagLanes) {
    const l = lanes.find(x => x.id === id), ms = Math.abs(r.lanes[id].offsetMs), late = r.lanes[id].offsetMs > 0;
    const name = l ? l.label : [id, id];
    zh.push(`${name[0]}比其他的${late ? "慢" : "快"}約 ${ms} 毫秒(沒有扣掉)`);
    en.push(`${name[1]} ${ms} ms ${late ? "behind" : "ahead of"} the rest (not removed)`);
  }
  return [zh.join(";"), en.join("; ")];
}
