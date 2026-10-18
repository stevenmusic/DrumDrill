// 觸控鼓墊的節奏評分(js/shared/timing.js + js/shared/onsets.js 的 scoreRhythm;docs/STAGES.md S7),verify.mjs 會呼叫;
// 也可以單獨跑:node tools/test/checks/timing.mjs
//  1. 一個鼓墊:已知整體偏移 0 / 80 / 200 ms 加 ±15 ms 抖動 → 偏移估對(差 ≤ 15 ms)、全部命中、沒有多的;估出來 ≥ 80 ms 才有「整體慢約」說明
//  2. 漏一下 → missed 1;多一下(敲在休止的地方)→ extra 1;偏移照樣估對
//  3. 偏移超過上限(450 ms)→ 不扣、有旗標、不給分數、說明是「太多了沒有扣掉」
//  4. 三個鼓墊(鈸 / 鼓 / 大鼓與腳踩 HH):expectedByLane 分組正確(同一條 lane 同一時間算一下);各自評分,
//     漏打大鼓只算在大鼓那條、多敲小鼓只算在鼓那條,鈸全部命中;打錯鼓墊 = 那條漏、另一條多
//  5. 一條 lane 單獨晚(大鼓整條晚 300 / 600 ms,其他對):整體偏移不受影響、大鼓那條不另外扣偏移 → 那條低分、總分 < 90,
//     有 lag 旗標(lagLanes)與 laneNote 提示;晚 40 ms(< 容許範圍一半)沒有旗標;大家一起晚 = 整體偏移,沒有旗標
//  6. 只有一條 lane 時行為不變:結果跟 scoreRhythm 直接評一模一樣(偏移 0 / 80 / 200 ms、漏一下、多一下;3 個鼓墊只用到一條也一樣)
import { expectedByLane, scoreLanes, offsetNote, laneNote, LANES, OFFSET_LIMIT } from "../../../js/shared/timing.js";
import { scoreRhythm } from "../../../js/shared/onsets.js";

function rng(seed){   // mulberry32:固定種子,每次結果一樣
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const JIT = 0.015;

export default function check(ok){
  const BPM = 100, sec = 60 / BPM;
  // 小鼓兩小節:四分、八分混合,第 7 拍休止(多敲的放這裡)
  const beats = [0, 1, 2, 2.5, 3, 4, 5, 5.5, 6, 8, 9, 9.5, 10, 11];
  const snare = beats.map(beat => ({ beat, piece: "snare", vel: "mf" }));
  const exp1 = expectedByLane(snare, BPM, LANES[1]);
  ok(exp1.snare.length === beats.length, `一個鼓墊:預期 ${beats.length} 下,算出 ${exp1.snare.length}`);
  const tapsAt = (times, lane, off, r) => times.map(t => ({ lane, time: t + off + (r() * 2 - 1) * JIT }));

  // 1. 已知偏移
  for (const off of [0, 0.08, 0.2]) {
    const r = scoreLanes(exp1, tapsAt(exp1.snare, "snare", off, rng(7 + off * 1000)), { tempoBpm: BPM });
    ok(Math.abs(r.offsetMs - off * 1000) <= JIT * 1000, `偏移 ${off * 1000} ms:估成 ${r.offsetMs} ms`);
    ok(r.hits === r.total && r.total === beats.length && r.missed === 0 && r.extra === 0, `偏移 ${off * 1000} ms:應該全部命中,實際 ${r.hits}/${r.total}、漏 ${r.missed}、多 ${r.extra}`);
    ok(!r.offsetTooLarge && r.score >= 90, `偏移 ${off * 1000} ms:分數 ${r.score}(應該 ≥ 90)、不超過上限`);
    const note = offsetNote(r);
    ok(r.offsetMs >= 80 ? note && /整體慢約/.test(note[0]) && /late/.test(note[1]) : note === null, `偏移 ${off * 1000} ms(估成 ${r.offsetMs})的說明不對:${note}`);
    if (off === 0.2) ok(note && note[0] === `整體慢約 ${r.offsetMs} 毫秒(已先扣掉)`, `偏移 200 ms 的說明:${note}`);
  }
  // 2. 漏一下、多一下
  {
    const taps = tapsAt(exp1.snare, "snare", 0.08, rng(11));
    const miss = taps.filter((_, i) => i !== 4);
    let r = scoreLanes(exp1, miss, { tempoBpm: BPM });
    ok(r.missed === 1 && r.extra === 0 && r.hits === beats.length - 1, `漏一下:應該 missed 1 / extra 0,實際 ${r.missed} / ${r.extra}`);
    ok(Math.abs(r.offsetMs - 80) <= JIT * 1000, `漏一下:偏移估成 ${r.offsetMs}`);
    const more = [...taps, { lane: "snare", time: 7 * sec + 0.08 }];
    r = scoreLanes(exp1, more, { tempoBpm: BPM });
    ok(r.missed === 0 && r.extra === 1 && r.hits === beats.length, `多一下:應該 missed 0 / extra 1,實際 ${r.missed} / ${r.extra}`);
    ok(r.score < 100, `多一下:分數應該扣一點,實際 ${r.score}`);
  }
  // 3. 超過上限
  {
    const r = scoreLanes(exp1, tapsAt(exp1.snare, "snare", 0.45, rng(3)), { tempoBpm: BPM });
    ok(r.offsetTooLarge && !r.offsetApplied && r.score === null, `偏移 450 ms(上限 ${OFFSET_LIMIT * 1000}):應該不扣、有旗標、不給分數,實際 tooLarge=${r.offsetTooLarge} applied=${r.offsetApplied} score=${r.score}`);
    ok(Math.abs(r.offsetMs - 450) <= JIT * 1000, `偏移 450 ms:估成 ${r.offsetMs}`);
    ok(r.hits < r.total && r.missed > 0, `偏移 450 ms 不扣:照原本的時間不會全部對到,實際命中 ${r.hits}/${r.total}`);
    const note = offsetNote(r);
    ok(note && /太多了沒有扣掉/.test(note[0]) && /too much/.test(note[1]), `偏移 450 ms 的說明不對:${note}`);
  }
  // 4. 三個鼓墊
  {
    const ev = [];
    for (let b = 0; b < 8; b += 0.5) ev.push({ beat: b, piece: b % 4 === 3.5 ? "hhOpen" : "hhClosed" });   // 鈸:八分
    for (const b of [1, 3, 5, 7]) ev.push({ beat: b, piece: "snare" });                                  // 鼓:2、4 拍
    ev.push({ beat: 6.5, piece: "tomHi" });
    for (const b of [0, 2, 2.5, 4, 6]) ev.push({ beat: b, piece: "kick" });                              // 大鼓
    for (const b of [0, 4]) ev.push({ beat: b, piece: "hhFoot" });                                       // 腳踩 HH 跟大鼓同時 = 一下
    ev.push({ beat: 7, piece: "crash" }, { beat: 7, piece: "hhClosed" });                                 // 同一條 lane 同時兩個 = 一下
    const exp = expectedByLane(ev, BPM, LANES[3]);
    ok(exp.cym.length === 16 && exp.drum.length === 5 && exp.foot.length === 5, `三個鼓墊分組:鈸 ${exp.cym.length}(16)、鼓 ${exp.drum.length}(5)、大鼓 ${exp.foot.length}(5)`);
    const one = expectedByLane(ev, BPM, LANES[1]);
    ok(one.snare.length === 16, `一個鼓墊:所有鼓件同一時間算一下,應該 16 下,實際 ${one.snare.length}`);
    const r0 = rng(21), taps = [];
    for (const id of ["cym", "drum", "foot"]) taps.push(...tapsAt(exp[id], id, 0.06 + (id === "foot" ? 0.01 : 0), r0));
    let r = scoreLanes(exp, taps, { tempoBpm: BPM });
    ok(r.hits === 26 && r.missed === 0 && r.extra === 0 && Math.abs(r.offsetMs - 60) <= 20, `三個鼓墊都打對:命中 ${r.hits}/26、漏 ${r.missed}、多 ${r.extra}、偏移 ${r.offsetMs}`);
    // 漏一下大鼓、多敲一下小鼓(拍 2 = 鼓這條沒有音的地方)
    const kickDrop = taps.findIndex(t => t.lane === "foot" && Math.abs(t.time - 2.5 * sec - 0.07) < 0.03);
    const t2 = taps.filter((_, i) => i !== kickDrop).concat([{ lane: "drum", time: 2 * sec + 0.06 }]);
    r = scoreLanes(exp, t2, { tempoBpm: BPM });
    const L = r.lanes;
    ok(kickDrop >= 0 && L.foot.missed === 1 && L.foot.extra === 0, `漏打大鼓:大鼓那條應該 missed 1,實際 ${L.foot.missed} / extra ${L.foot.extra}`);
    ok(L.drum.extra === 1 && L.drum.missed === 0, `多敲小鼓:鼓那條應該 extra 1,實際 extra ${L.drum.extra} / missed ${L.drum.missed}`);
    ok(L.cym.hits === 16 && L.cym.missed === 0 && L.cym.extra === 0, `鈸那條應該全部命中,實際 ${L.cym.hits}/16、漏 ${L.cym.missed}、多 ${L.cym.extra}`);
    ok(r.missed === 1 && r.extra === 1, `合併:missed 1 / extra 1,實際 ${r.missed} / ${r.extra}`);
    // 打錯鼓墊:鼓的音都敲在鈸上 → 鼓那條全漏、鈸那條多
    const wrong = taps.map(t => (t.lane === "drum" ? { ...t, lane: "cym" } : t));
    r = scoreLanes(exp, wrong, { tempoBpm: BPM });
    ok(r.lanes.drum.missed === 5 && r.lanes.cym.extra >= 1, `打錯鼓墊:鼓那條應該漏 5、鈸那條有多的,實際漏 ${r.lanes.drum.missed}、多 ${r.lanes.cym.extra}`);
    // 沒有要打的 lane 上敲:算多的,分數打折
    const stray = scoreLanes({ drum: exp.drum }, [...tapsAt(exp.drum, "drum", 0.05, rng(5)), { lane: "foot", time: 1 }], { tempoBpm: BPM });
    ok(stray.extra === 1 && stray.lanes.foot.extra === 1 && stray.score < 100, `沒有要打的鼓墊上敲一下:extra ${stray.extra}、分數 ${stray.score}`);
    ok(!scoreLanes(exp, taps, { tempoBpm: BPM }).lagLanes.length, "三個鼓墊都打對:不應該有 lag 旗標");
  }
  // 5. 一條 lane 單獨晚
  {
    const ev = [];
    for (let b = 0; b < 8; b += 0.5) ev.push({ beat: b, piece: "hhClosed" });
    for (const b of [1, 3, 5, 7]) ev.push({ beat: b, piece: "snare" });
    for (const b of [0, 2, 2.5, 4, 6]) ev.push({ beat: b, piece: "kick" });
    const exp = expectedByLane(ev, BPM, LANES[3]);
    const mk = (footLate, all = 0, seed = 31) => {
      const r = rng(seed), t = [];
      for (const id of ["cym", "drum", "foot"]) t.push(...tapsAt(exp[id], id, all + (id === "foot" ? footLate : 0), r));
      return scoreLanes(exp, t, { tempoBpm: BPM });
    };
    for (const late of [0.3, 0.6]) {
      const r = mk(late), f = r.lanes.foot, note = laneNote(r, LANES[3]);
      ok(Math.abs(r.offsetMs) <= 20, `大鼓單獨晚 ${late * 1000} ms:整體偏移應該不受影響,實際 ${r.offsetMs}`);
      ok(f.score <= 20 && f.hits <= 1, `大鼓單獨晚 ${late * 1000} ms:大鼓那條不能高分,實際 ${f.score} 分、命中 ${f.hits}/${f.total}`);
      ok(r.score < 90, `大鼓單獨晚 ${late * 1000} ms:總分不能高分(< 90),實際 ${r.score}`);
      ok(f.lag && r.lagLanes.join() === "foot" && Math.abs(f.offsetMs - late * 1000) <= 20, `大鼓單獨晚 ${late * 1000} ms:應該只有大鼓有 lag 旗標、剩的偏移 ≈ ${late * 1000},實際 lag=${f.lag} lagLanes=${r.lagLanes} offset=${f.offsetMs}`);
      ok(note && note[0].includes("大鼓・腳踩") && note[0].includes("慢約") && /Kick · HH \d+ ms behind/.test(note[1]), `大鼓單獨晚 ${late * 1000} ms 的提示:${note}`);
      ok(r.lanes.cym.hits === 16 && r.lanes.drum.hits === 4 && !r.lanes.cym.lag && !r.lanes.drum.lag, `大鼓單獨晚 ${late * 1000} ms:鈸、鼓應該全部命中、沒有旗標`);
    }
    const small = mk(0.04);
    ok(!small.lanes.foot.lag && laneNote(small) === null && small.score >= 90, `大鼓晚 40 ms(< 容許範圍一半):不該有旗標、分數 ≥ 90,實際 lag=${small.lanes.foot.lag} 分數 ${small.score}`);
    const all = mk(0, 0.15);
    ok(Math.abs(all.offsetMs - 150) <= 20 && !all.lagLanes.length && all.score >= 90, `三條一起晚 150 ms:整體偏移 ${all.offsetMs}、旗標 ${all.lagLanes}、分數 ${all.score}(應該扣掉、沒有旗標、≥ 90)`);
    const early = mk(-0.3);
    ok(early.lanes.foot.lag && early.lanes.foot.offsetMs < 0 && laneNote(early)[0].includes("快約"), `大鼓單獨早 300 ms:應該有旗標、說「快約」,實際 ${early.lanes.foot.offsetMs} ${laneNote(early)}`);
  }
  // 6. 只有一條 lane:跟 scoreRhythm 直接評一模一樣
  {
    const cases = [];
    for (const off of [0, 0.08, 0.2]) cases.push([`偏移 ${off * 1000} ms`, tapsAt(exp1.snare, "snare", off, rng(41 + off * 1000))]);
    const base = tapsAt(exp1.snare, "snare", 0.08, rng(43));
    cases.push(["漏一下", base.filter((_, i) => i !== 3)], ["多一下", [...base, { lane: "snare", time: 7 * sec + 0.07 }]]);
    for (const [name, taps] of cases) {
      const r = scoreLanes(exp1, taps, { tempoBpm: BPM });
      const want = scoreRhythm(exp1.snare, taps.map(t => t.time).sort((a, b) => a - b), { tempoBpm: BPM });
      const got = { score: r.score, hits: r.hits, total: r.total, missed: r.missed, extra: r.extra, meanErrorMs: r.meanErrorMs, offsetMs: r.offsetMs, toleranceMs: r.toleranceMs };
      ok(JSON.stringify(got) === JSON.stringify(want), `一個鼓墊(${name}):應該跟 scoreRhythm 一樣 ${JSON.stringify(want)},實際 ${JSON.stringify(got)}`);
      ok(r.lanes.snare.offsetMs === 0 && !r.lanes.snare.lag && !r.lagLanes.length, `一個鼓墊(${name}):不應該有 lane 剩的偏移或旗標`);
    }
    // 3 個鼓墊只用到鼓那條
    const ev = [0, 1, 2, 3, 4, 5, 6, 7].map(beat => ({ beat, piece: "snare" }));
    const exp = expectedByLane(ev, BPM, LANES[3]), taps = tapsAt(exp.drum, "drum", 0.12, rng(47));
    const r = scoreLanes(exp, taps, { tempoBpm: BPM }), want = scoreRhythm(exp.drum, taps.map(t => t.time), { tempoBpm: BPM });
    ok(r.score === want.score && r.hits === want.hits && r.offsetMs === want.offsetMs && !r.lagLanes.length, `3 個鼓墊只用到一條:應該跟 scoreRhythm 一樣(${want.score} 分、偏移 ${want.offsetMs}),實際 ${r.score} 分、偏移 ${r.offsetMs}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 節奏評分全部通過(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
