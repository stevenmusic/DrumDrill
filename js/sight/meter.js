/* 視奏的拍點與小節時間軸(純函式:不碰 DOM、不 import audio / i18n;tools/test/checks/sight-meter.mjs 檢查)。
   docs/STAGES.md §3.1 原本打算照抄 PianoDrill js/sight/generator/meter.js;那一支是 PianoDrill 出題器的「節奏格換算」
   (3/8 把四分音符格子縮成八分、2/2 放大,依賴它自己的 rhythm.js 與 MusicXML 型別階梯),DrumDrill 的出題器(gen.js、kitgen.js、playbackgen.js)
   不用那種換算,拍號分組也已經在 js/shared/kitnotation.js 的 parseTime。所以這裡只做 DrumDrill 視奏要的部分,不列入 sync.json:
   - 每一小節的開始拍與長度(四分音符 = 1 拍;拍號換了照新的小節長度)
   - 拍點(節拍器 / 預備拍 / 正式打的拍點)打在「拍」上,第一拍重:
       x/4 = 每個四分音符;x/2 = 每個二分音符(2/2 一小節兩拍);
       6/8、9/8、12/8、3/8 = 每個附點四分音符;5/8 = 3+2、7/8 = 2+2+3 個八分音符(kitnotation parseTime 的分組;常見寫法,待核對)
     拍點怎麼打是 App 的練習設定(大綱沒寫;Trinity 只寫「有 count-in、一直有伴奏」)
   - 播放器(js/shared/player.js)只在「整數拍」問 click(beat):有 x/8 的譜改用八分音符當一拍(unit = 0.5),拍點才打得到附點四分音符的位置
     (播放器的 bpm = 四分音符 bpm / unit、事件的 beat / unit;評分仍然用四分音符的拍子與 bpm)
   - 預備拍:第一小節的拍號 1 小節(推估;大綱沒寫長度);一小節不到 2 個拍點(3/8)就 2 小節
   timeline(spec) → { unit, bars:[{ start, len, time, pulses:[從小節開頭算的拍子位置…] }], len, countIn:{ bars, len, pulses } }
   clickAt(tl, u) → 0 | 1 | 2:播放器的第 u 個 unit(預備拍是負的)要不要響、是不是重拍
   barAt(tl, beat) → { i, bar, progress, pulse }:四分音符拍子 beat 在第幾小節、小節裡的進度(0–1)、第幾個拍點 */
import { parseTime, DIV } from "../shared/kitnotation.js";

const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

/* 一小節的拍點(從小節開頭算,四分音符 = 1) */
export function pulsesOf(time){
  const m = parseTime(time || "4/4"), len = m.len / DIV;
  if (m.type === 4) return Array.from({ length: m.beats }, (_, i) => i);
  if (m.type === 2) return Array.from({ length: m.beats }, (_, i) => i * 2);
  const out = []; let p = 0;
  for (const g of m.groups) { out.push(p / DIV); p += g; }
  return out.filter(x => x < len - EPS);
}

export function timeline(spec){
  let time = spec.time || "4/4", at = 0;
  const bars = (spec.measures || []).map(m => {
    if (m.time) time = m.time;
    const len = parseTime(time).len / DIV, b = { start: at, len, time, pulses: pulsesOf(time) };
    at += len;
    return b;
  });
  const all = bars.flatMap(b => b.pulses.map(p => b.start + p));
  const first = bars[0] || { len: 4, time: "4/4", pulses: [0, 1, 2, 3] };
  const ciBars = first.pulses.length < 2 ? 2 : 1;
  const ciPulses = [];
  for (let k = 0; k < ciBars; k++) for (const p of first.pulses) ciPulses.push(k * first.len + p);
  const countIn = { bars: ciBars, len: ciBars * first.len, pulses: ciPulses };
  // 拍點、小節線、預備拍都要落在整數個 unit 上:先試四分音符,不行就八分音符
  const unit = [...all, ...bars.map(b => b.start), countIn.len, ...ciPulses].every(x => near(x, Math.round(x))) ? 1 : 0.5;
  return { unit, bars, len: at, countIn };
}

/* 播放器的第 u 個 unit:預備拍(u < 0)照第一小節的拍點、第一下重;之後照那一小節的拍點、小節第一拍重 */
export function clickAt(tl, u){
  const q = u * tl.unit;
  if (q < 0) {
    const x = q + tl.countIn.len;
    if (near(x, 0)) return 2;
    return tl.countIn.pulses.some(p => near(p, x)) ? 1 : 0;
  }
  const { bar } = barAt(tl, q);
  if (!bar) return 0;
  const x = q - bar.start;
  if (near(x, 0)) return 2;
  return bar.pulses.some(p => near(p, x)) ? 1 : 0;
}

/* 拍子位置 → 小節(最後一小節以後算在最後一小節) */
export function barAt(tl, beat){
  const bars = tl.bars;
  if (!bars.length) return { i: -1, bar: null, progress: 0, pulse: 0 };
  let i = 0;
  while (i + 1 < bars.length && beat >= bars[i + 1].start - EPS) i++;
  const bar = bars[i], x = beat - bar.start;
  let pulse = 0;
  bar.pulses.forEach((p, k) => { if (x >= p - EPS) pulse = k; });
  return { i, bar, progress: Math.max(0, Math.min(1, x / bar.len)), pulse };
}
