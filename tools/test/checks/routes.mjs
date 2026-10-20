// 今日練習的路線與關卡(js/tech/routes.js + routespec.js)的檢查;verify.mjs 呼叫,也可以單獨跑:node tools/test/checks/routes.mjs
//   每一關的譜轉得成 spec、kitnotation 畫得出來、每小節拍數對、手 / 腳聲部分對、起始 < 目標、id 不重複、unlock 指到存在的關、中英名字都有、
//   時值由慢到快(每條路線第 1 關只有四分音符;十六分 / 三連音不早於八分)、左右手(手打的音都有 R / L,腳沒有)、
//   第 0 組、D 組拆兩關、數拍用語;每天不一樣的關(@kick8 / @snare8 / @fill2)每個 1000 個種子:規則都對、同種子同題、兩小節不一樣、不能三個八分大鼓連續;暖身清單的打法都存在
import fs from "node:fs";
import { ROUTES, WARM } from "../../../js/tech/routes.js";
import { toSpec, barsOf, hasGen, threeInRow, eventsOf, handsOf, HAND_LINES, FOOT_LINES } from "../../../js/tech/routespec.js";
import { checkScore, measureLengths, parseTime, DIV } from "../../../js/shared/kitnotation.js";
import { byNo, pattern } from "../../../js/tech/rudiments.js";

const key = JSON.parse(fs.readFileSync(new URL("../../../data/drumkey.json", import.meta.url), "utf8"));

/* 一小節用到的最小時值:4 = 四分(以上)、8 = 八分、16 = 十六分、3 = 三連音 */
function finest(spec){
  let f = 4;
  for (const m of spec.measures) for (const v of m.voices) for (const e of v) {
    const code = e.value[0] === "r" ? e.value.slice(1) : e.value;
    if (/t3/.test(code)) f = Math.max(f, 30);
    else if (code.startsWith("16") || code === "8.") f = Math.max(f, 16);
    else if (code === "8" && !/12\/8/.test(spec.time)) f = Math.max(f, 8);
    else if (code === "8") f = Math.max(f, 8);
  }
  return f;
}

export default function check(ok){
  const ids = new Set();
  let n = 0, bad = [];
  for (const R of ROUTES) {
    ok(Array.isArray(R.name) && R.name.length === 2, `路線 ${R.id} 有中英名字`);
    if (R.unlock) {
      const U = ROUTES.find(x => x.id === R.unlock.route);
      ok(!!U && U.levels.some(l => l.id === R.unlock.passed), `路線 ${R.id} 的 unlock 指到存在的關(${R.unlock.route}/${R.unlock.passed})`);
    }
    let prevFinest = 0;
    R.levels.forEach((L, i) => {
      const where = `${R.id}/${L.id}`;
      if (ids.has(where)) bad.push(where + " id 重複");
      ids.add(where);
      if (!(Array.isArray(L.name) && L.name[0] && L.name[1] && L.name[1].length <= 34)) bad.push(where + " 名字(中英、英文 ≤ 34 字)");
      if (/[((](四分|八分|十六分|三連音)/.test(L.name[0]) || /\((quarters?|eighths?|16ths?|triplets?)/i.test(L.name[1])) bad.push(where + " 名稱不放時值括號:" + L.name[0]);
      if (!((L.g === "0" ? L.start === L.target : L.start < L.target) && L.start >= 40 && L.target <= 200)) bad.push(where + ` 速度 ${L.start} → ${L.target}`);
      if (!(Array.isArray(L.check) && L.check.length >= 2 && L.check.length <= 3 && L.check.every(c => c[0] && c[1]))) bad.push(where + " 重點 2–3 項");
      const seeds = hasGen(L) ? 1000 : 1;
      for (let s = 1; s <= seeds; s++) {
        let r;
        try { r = toSpec(L, s * 7919 + i, { key }); } catch (e) { bad.push(`${where} 種子 ${s}:${e.message}`); break; }
        const errs = checkScore(r.spec);
        if (errs.length) { bad.push(`${where} 種子 ${s}:${errs[0]}`); break; }
        const len = parseTime(r.time).len, lens = measureLengths(r.spec);
        if (!lens.every(x => x === len) || r.lenBeats !== lens.length * len / DIV) bad.push(`${where}:小節長度`);
        if (r.spec.measures.length !== (Array.isArray(L.pat) ? L.pat.length : 2)) bad.push(`${where}:小節數`);
        // 腳的聲部只有大鼓 / 腳踩 Hi-hat;手的聲部每個音都有 R / L、腳沒有
        for (const m of r.spec.measures) {
          for (const e of m.voices[1]) for (const x of e.notes || []) if (!["kick", "hhFoot"].includes(x.piece) || x.hand) bad.push(`${where}:腳的聲部 ${x.piece} ${x.hand || ""}`);
          for (const e of m.voices[0]) for (const x of e.notes || []) if (!(x.hand === "R" || x.hand === "L") || ["kick", "hhFoot"].includes(x.piece)) bad.push(`${where}:手的聲部 ${x.piece} 沒有 R / L`);
        }
        const hs = handsOf(r.spec, key), handNotes = r.spec.measures.reduce((a, m) => a + m.voices[0].reduce((b, e) => b + (e.notes || []).length, 0), 0);
        if (hs.length !== handNotes) bad.push(`${where}:左右手的位置數 ${hs.length} ≠ 手的音 ${handNotes}`);
        const ev = eventsOf(r, 80, L);
        if (!ev.length || ev.some(e => !(e.beat >= 0 && e.beat < r.lenBeats))) bad.push(`${where}:播放事件超出範圍`);
        // 每天不一樣的關:規則
        if (hasGen(L)) {
          const bars = barsOf(L, s * 7919 + i), again = barsOf(L, s * 7919 + i);
          if (JSON.stringify(bars) !== JSON.stringify(again)) bad.push(`${where}:同一個種子不同題`);
          for (const [line, v] of Object.entries(Array.isArray(L.pat) ? L.pat[L.pat.length - 1] : L.pat)) {
            if (v === "@kick8") {
              if (bars[0].bd === bars[1].bd) bad.push(`${where} 種子 ${s}:兩小節大鼓一樣`);
              if (threeInRow(bars)) bad.push(`${where} 種子 ${s}:三個八分大鼓連續 ${bars.map(b => b.bd).join(" | ")}`);
              for (const b of bars) {
                const beats = b.bd.split(" ");
                const extra = beats.join("").replace(/-/g, "").length - 1;
                if (beats[0][0] !== "x" || extra < 1 || extra > 2 || beats.some(x => /x/.test(x[1] + x[3]))) bad.push(`${where} 種子 ${s}:大鼓規則 ${b.bd}`);
              }
            }
            if (v === "@snare8") {
              if (bars[0].sd === bars[1].sd) bad.push(`${where} 種子 ${s}:兩小節小鼓一樣`);
              for (const b of bars) { const bt = b.sd.split(" "); if (bt[1][0] !== "x" || bt[3][0] !== "x" || b.sd.replace(/-| /g, "").length !== 3 || /x/.test(bt.map(x => x[1] + x[3]).join(""))) bad.push(`${where} 種子 ${s}:小鼓規則 ${b.sd}`); }
            }
            if (line === "fill" && v === "@fill2") {
              const b = bars[bars.length - 1], order = ["sd", "t1", "t2", "ft"];
              let last = -1, okFill = true, notes = 0;
              for (const beat of [2, 3]) for (let slot = 0; slot < 4; slot++) order.forEach((k, ki) => {
                const s2 = (b[k] || "---- ---- ---- ----").split(" ")[beat];
                if (s2[slot] && s2[slot] !== "-") { notes++; if (ki < last) okFill = false; last = Math.max(last, ki); }
              });
              if (!okFill || notes < 4 || b.fill) bad.push(`${where} 種子 ${s}:過門規則(由高到低、至少 4 下)`);
            }
          }
        }
        n++;
        // 時值由慢到快:第 1 關只有四分;十六分 / 三連音不早於八分
        if (s === 1) {
          const f = finest(r.spec);
          if (i === 0 && f !== 4) bad.push(`${where}:第 1 關要只有四分音符(最小 ${f})`);
          if (f >= 16 && prevFinest < 8) bad.push(`${where}:還沒練過八分就出十六分 / 三連音`);
          prevFinest = Math.max(prevFinest, f === 30 ? 8 : f);
        }
      }
    });
  }
  ok(!bad.length, `路線關卡:${ROUTES.map(R => R.id + " " + R.levels.length + " 關").join("、")};${n} 份譜都畫得出來、規則都對` + (bad.length ? "\n    " + bad.slice(0, 12).join("\n    ") : ""));
  ok(ROUTES[0].levels.length === 30 && ROUTES[1].levels.length === 19, "律動 30 關(含第 0 組)、過門 19 關");
  // 系統化(2026-10):第 0 組在主路線最前面(「跟拍點數拍」只用右手四分)、D 組先換到 Ride 再加左腳(每一關只加一件新東西)、過門等律動的基礎關(B2)過了才開放
  const G = ROUTES[0].levels, g0 = G[0], r0 = toSpec(g0, 1, { key });
  ok(g0.g === "0" && g0.id === "G01" && r0.spec.measures.every(m => m.voices[0].every(e => (e.notes || []).every(x => x.hand === "R"))) && finest(r0.spec) === 4,
    "第 0 組:跟拍點數拍(右手、四分音符)");
  ok(G.filter(l => l.g === "0").every(l => l.start === l.target && l.need === 2 && l.review === false) && G.filter(l => l.g !== "0").every(l => l.review !== false),
    "第 0 組:起始 = 目標速度、連續 2 次穩就過、不放進複習盒(只有第 0 組)");
  const iDR = G.findIndex(l => l.id === "DR"), iD1 = G.findIndex(l => l.id === "D1");
  ok(iDR >= 0 && iD1 === iDR + 1 && !JSON.stringify(G[iDR].pat).includes("hf") && JSON.stringify(G[iD1].pat).includes("hf"), "D 組:先「Ride 上的 8 Beat」、再加左腳");
  ok(ROUTES[1].unlock && ROUTES[1].unlock.route === "groove" && ROUTES[1].unlock.passed === "B2", "過門在律動 B2 過了才開放");
  // 為什麼練這個(每一組一句):每組都有、中英都有、中文 ≤ 24 字(英數算半個)、英文 ≤ 64 字、沒有多出來的組
  const zhLen = z => [...z].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.5), 0), whyBad = [];
  for (const R of ROUTES) {
    const gs = [...new Set(R.levels.map(l => l.g))];
    for (const g of gs) { const w = R.why && R.why[g]; if (!(Array.isArray(w) && w[0] && w[1] && zhLen(w[0]) <= 24 && w[1].length <= 64)) whyBad.push(`${R.id}/${g}`); }
    for (const g of Object.keys(R.why || {})) if (!gs.includes(g)) whyBad.push(`${R.id}/${g} 沒有這一組`);
  }
  ok(!whyBad.length, "為什麼練這個:每一組一句(中文 ≤ 24 字、英文 ≤ 64 字)" + (whyBad.length ? ":" + whyBad.join("、") : ""));
  // 數拍用語一律「3&」(不寫「3 拍後半」「反拍」)
  const words = ROUTES.flatMap(R => R.levels.flatMap(L => [L.name[0], ...L.check.map(c => c[0])]));
  ok(!words.some(w => /拍後半|反拍/.test(w)), "數拍用語一律「3&」:" + words.filter(w => /拍後半|反拍/.test(w)).join("、"));
  // 暖身:打法存在、練習型做得出來、after 指到律動的關、第一個是四分音符的練習型
  const gids = new Set(ROUTES[0].levels.map(l => l.id));
  const wbad = WARM.filter(w => {
    if (!byNo(w.pas)) return true;
    if (w.after && !gids.has(w.after)) return true;
    if (w.value) { try { pattern({ pas: w.pas, sticking: w.sticking, value: w.value }); } catch (e) { return true; } }
    return false;
  });
  ok(!wbad.length && !WARM[0].after && WARM[0].value === "4", "暖身清單:打法都存在、練習型做得出來、第一個是四分音符的練習型" + (wbad.length ? " " + JSON.stringify(wbad) : ""));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fail = 0;
  check((c, msg) => { console.log((c ? "✓ " : "✗ ") + msg); if (!c) fail++; });
  process.exit(fail ? 1 : 0);
}
