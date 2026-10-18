// 視奏的拍點與小節時間軸(js/sight/meter.js)的檢查,verify.mjs 會呼叫;也可以單獨跑:node tools/test/checks/sight-meter.mjs
//   1. 每種拍號的拍點(手抄:x/4 每個四分、x/2 每個二分、複拍子每個附點四分、5/8 = 3+2、7/8 = 2+2+3)與播放器的一拍(有 x/8 用八分音符)
//   2. 拍點的強弱(預備拍第一下、每小節第一拍重):手抄一小節 + 預備拍的樣子
//   3. Trinity Playback 每級 200 題(含 8 級換拍號)、RSL 整組鼓 4、5 級、小鼓 Debut–3:時間軸長度 = specBeats、小節開頭 = 拍號累加、
//      每個事件落在某一小節裡、拍點都在整數個 unit 上(播放器打得到)、每小節第一拍是重拍、預備拍 ≥ 2 個拍點
//   4. 題目指紋(fingerprint.js):整組鼓的題目換一個鼓件指紋就不同;小鼓的指紋跟以前一樣(只看時值)
import fs from "node:fs";
import { pulsesOf, timeline, clickAt, barAt } from "../../../js/sight/meter.js";
import { specBeats, toEvents } from "../../../js/shared/kitevents.js";
import { genChart, playbackParams } from "../../../js/shared/playbackgen.js";
import { genRslKit } from "../../../js/shared/kitgen.js";
import { genSnare } from "../../../js/sight/gen.js";
import { fingerprintOf } from "../../../js/sight/fingerprint.js";

const root = new URL("../../../", import.meta.url).pathname;
// 手抄:拍點(四分音符 = 1)、unit、一小節 + 預備拍的強弱(預備拍在前)
const HAND = {
  "4/4": [[0, 1, 2, 3], 1, "2111" + "2111"], "2/4": [[0, 1], 1, "21" + "21"], "3/4": [[0, 1, 2], 1, "211" + "211"],
  "5/4": [[0, 1, 2, 3, 4], 1, "21111" + "21111"], "7/4": [[0, 1, 2, 3, 4, 5, 6], 1, "2111111" + "2111111"], "2/2": [[0, 2], 1, "2010" + "2010"],
  "6/8": [[0, 1.5], 0.5, "200100" + "200100"], "9/8": [[0, 1.5, 3], 0.5, "200100100" + "200100100"], "12/8": [[0, 1.5, 3, 4.5], 0.5, "200100100100" + "200100100100"],
  "3/8": [[0], 0.5, "200100" + "200"], "5/8": [[0, 1.5], 0.5, "20010" + "20010"], "7/8": [[0, 1, 2], 0.5, "2010100" + "2010100"]
};

export default function check(ok){
  for (const [t, [pulses, unit, pat]] of Object.entries(HAND)) {
    ok(JSON.stringify(pulsesOf(t)) === JSON.stringify(pulses), `拍點 ${t}:${JSON.stringify(pulsesOf(t))},應該是 ${JSON.stringify(pulses)}`);
    const tl = timeline({ time: t, measures: [{}] });
    ok(tl.unit === unit, `拍點 ${t}:unit ${tl.unit},應該是 ${unit}`);
    let got = "";
    for (let u = -tl.countIn.len / tl.unit; u < tl.len / tl.unit - 1e-9; u++) got += clickAt(tl, u);
    ok(got === pat, `拍點 ${t}:預備拍 + 一小節 ${got},應該是 ${pat}`);
  }
  // 換拍號:4/4 → 6/8 → 3/4
  const mix = timeline({ time: "4/4", measures: [{}, { time: "6/8" }, { time: "3/4" }] });
  ok(JSON.stringify(mix.bars.map(b => [b.start, b.len])) === "[[0,4],[4,3],[7,3]]" && mix.unit === 0.5 && mix.len === 10, `換拍號的時間軸 ${JSON.stringify(mix.bars.map(b => [b.start, b.len]))}`);
  ok(barAt(mix, 5.6).i === 1 && Math.abs(barAt(mix, 5.6).progress - 1.6 / 3) < 1e-9 && barAt(mix, 5.6).pulse === 1, "barAt 換拍號的位置不對");

  const tri = JSON.parse(fs.readFileSync(root + "data/exam-trinity.json", "utf8")), rsl = JSON.parse(fs.readFileSync(root + "data/exam-rsl.json", "utf8"));
  const audit = (where, spec, bpm = 80) => {
    const tl = timeline(spec);
    let bad = 0;
    const fail = m => { if (bad++ < 3) ok(false, `${where}:${m}`); };
    if (Math.abs(tl.len - specBeats(spec)) > 1e-9) fail(`時間軸 ${tl.len} 拍,譜 ${specBeats(spec)} 拍`);
    // 只有 x/4、x/2 的譜用四分音符當一拍;用八分音符的一定有 x/8(有 x/8 也可能是 1:例如只有 6/8 的偶數小節不會,3/8 會)
    const x8 = tl.bars.some(b => /\/8$/.test(b.time));
    if (!x8 && tl.unit !== 1) fail(`沒有 x/8 卻用八分音符當一拍`);
    if (tl.unit === 0.5 && !x8) fail("unit 0.5 但沒有 x/8");
    tl.bars.forEach((b, i) => {
      if (i && Math.abs(b.start - tl.bars[i - 1].start - tl.bars[i - 1].len) > 1e-9) fail(`第 ${i + 1} 小節開頭 ${b.start}`);
      if (clickAt(tl, b.start / tl.unit) !== 2) fail(`第 ${i + 1} 小節第一拍不是重拍`);
      for (const p of b.pulses) if (Math.abs((b.start + p) / tl.unit - Math.round((b.start + p) / tl.unit)) > 1e-9) fail(`第 ${i + 1} 小節拍點 ${p} 不在整數個 unit 上`);
    });
    if (tl.countIn.pulses.length < 2) fail("預備拍不到 2 個拍點");
    for (const e of toEvents(spec, { bpm })) if (!e.grace && (e.beat < -1e-9 || e.beat >= tl.len - 1e-9 || barAt(tl, e.beat).i !== e.m)) { fail(`事件 ${e.beat} 不在第 ${e.m + 1} 小節`); break; }
  };
  for (let g = 0; g <= 8; g++) {
    const P = playbackParams(g, tri);
    for (let i = 0; i < 200; i++) { const c = genChart(P, 7919 * i + g); audit(`Trinity ${g} 級 種子 ${7919 * i + g}`, c.spec); }
  }
  for (const g of [4, 5]) for (let i = 0; i < 200; i++) audit(`RSL ${g} 級 種子 ${i}`, genRslKit(rsl.sight[g], i + 1, g).spec);
  for (const g of [0, 1, 2, 3]) for (let i = 0; i < 50; i++) { const t = genSnare(rsl.sight[g], i + 1, g); audit(`RSL ${g} 級小鼓 種子 ${i}`, { time: t.time, measures: t.measures }); }

  // 4. 指紋
  const k = genRslKit(rsl.sight[4], 3, 4), a = { ...k, system: "rsl" };
  const b = JSON.parse(JSON.stringify(a));
  const ev = b.measures[0].voices[0].find(e => e.notes);
  ev.notes[0].piece = ev.notes[0].piece === "snare" ? "tomHi" : "snare";
  ok(fingerprintOf(a) !== fingerprintOf(b), "指紋:整組鼓換一個鼓件,指紋卻一樣");
  ok(fingerprintOf(a) === fingerprintOf(JSON.parse(JSON.stringify(a))), "指紋:同一題指紋不一樣");
  const s = genSnare(rsl.sight[3], 5, 3);
  ok(fingerprintOf(s) === fingerprintOf({ grade: s.grade, time: s.time, bars: s.bars, measures: s.measures.map(m => ({ voices: m.voices.map(v => v.map(e => ({ value: e.value }))) })) }), "指紋:小鼓的指紋應該只看時值(跟以前一樣)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let n = 0, f = 0;
  check((c, m) => { n++; if (!c) { f++; console.log("✗ " + m); } });
  console.log(f ? `✗ ${f} 項失敗(共 ${n} 項)` : `✓ 視奏拍點時間軸全部通過(${n} 項)`);
  process.exit(f ? 1 : 0);
}
