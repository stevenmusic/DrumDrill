// 視奏出題器(js/sight/gen.js,RSL Debut–3 小鼓視奏)的檢查,verify.mjs 會呼叫;也可以單獨跑:node tools/test/checks/gen-sight.mjs
// 每一級 1000 個種子:
//   1. 只出現白名單的時值與休止符(data/exam-rsl.json 的 sight[g];另外照 RSL p.31、35、39、43 手抄一份核對資料本身)
//   2. 每小節加總 = 4 拍(自己照時值代號算);kitnotation 的 MusicXML 每小節 = 4 拍、沒有自動補的休止符(補的可能是白名單外的 r2)、單線譜
//   3. 同一個種子同一題;速度是整數、在官方範圍內(3 級 70–80 兩頭都出現過);小節數 = 官方
//   4. 結尾停在四分或二分音符;二分音符只在第 1、3 拍;每小節至少 2 個音;每一題至少一次這一級最短的時值;mixed 標記跟節奏格一致
//   5. events(播放、評分用)= 譜上每一個音的拍點;題目指紋大多不同,generateUnique 連出 30 題不重複
//   6. 4 級以上(整組鼓)、Trinity 不出題(丟錯)
import fs from "node:fs";
import { genSnare, valuesUsed, cellsFor, CELLS, SNARE_GRADES } from "../../../js/sight/gen.js";
import { scoreXML } from "../../../js/shared/kitnotation.js";
import { fingerprintOf, createHistory, generateUnique } from "../../../js/sight/fingerprint.js";

const root = new URL("../../../", import.meta.url).pathname;
// 照 docs/sources/rsl-drums.md §4.1(RSL p.31、35、39、43)手抄:不從 JSON 讀
const HAND = {
  0: { values: ["2", "4"], rests: ["r4"], bpm: [80, 80], bars: 4 },
  1: { values: ["4", "8"], rests: ["r4"], bpm: [80, 80], bars: 4 },
  2: { values: ["4", "8", "16"], rests: ["r4", "r8"], bpm: [70, 70], bars: 4 },
  3: { values: ["4", "8", "16"], rests: ["r4", "r8"], bpm: [70, 80], bars: 4 }
};
const LEN = { "2": 2, "4": 1, "8": 0.5, "16": 0.25 };
const MUST = { 0: "2", 1: "8", 2: "16", 3: "16" };
const N = 1000;

export default function check(ok){
  const rsl = JSON.parse(fs.readFileSync(root + "data/exam-rsl.json", "utf8"));
  const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));
  for (const g of SNARE_GRADES) {
    const spec = rsl.sight[g], h = HAND[g], at = `視奏 ${g} 級`;
    // 資料本身 = 手抄的大綱
    ok(spec.type === "snare", `${at}:type 要是 snare`);
    ok(JSON.stringify([...spec.values].sort()) === JSON.stringify([...h.values].sort()) && JSON.stringify([...spec.rests].sort()) === JSON.stringify([...h.rests].sort()), `${at}:資料的時值 / 休止符跟大綱手抄不同`);
    ok(JSON.stringify(spec.bpm) === JSON.stringify(h.bpm) && spec.bars === h.bars, `${at}:資料的速度 / 小節數跟大綱手抄不同`);
    ok(spec.time && spec.time.v === "4/4" && spec.time.assumed === true, `${at}:拍號要是 4/4 而且標推估`);
    const allowed = new Set([...h.values, ...h.rests]);
    ok(cellsFor(spec, g).every(c => c.evs.every(v => allowed.has(v))), `${at}:節奏格有白名單以外的時值`);
    let bad = 0, bpms = new Set(), fps = new Set();
    for (let i = 0; i < N && bad < 5; i++) {
      const seed = (i * 2654435761 + g * 97) >>> 0;
      let t;
      try { t = genSnare(spec, seed, g); } catch (e) { ok(false, `${at} 種子 ${seed}:丟錯 ${e.message}`); bad++; continue; }
      const where = `${at} 種子 ${seed}`;
      const fail = m => { ok(false, `${where}:${m}`); bad++; };
      // 1. 白名單
      const used = valuesUsed(t);
      if (!used.every(v => allowed.has(v))) fail(`有白名單以外的時值 ${used.filter(v => !allowed.has(v)).join(",")}`);
      // 2. 每小節 4 拍
      if (t.measures.length !== h.bars || t.bars !== h.bars) fail(`小節數 ${t.measures.length}`);
      t.measures.forEach((m, mi) => {
        const sum = m.voices[0].reduce((s, ev) => s + LEN[ev.value.replace(/^r/, "")], 0);
        if (Math.abs(sum - 4) > 1e-9) fail(`第 ${mi + 1} 小節 ${sum} 拍`);
        const notes = m.voices[0].filter(ev => ev.value[0] !== "r");
        if (notes.length < 2) fail(`第 ${mi + 1} 小節只有 ${notes.length} 個音`);
        if (!notes.every(ev => ev.notes && ev.notes.length === 1 && ev.notes[0].piece === "snare")) fail(`第 ${mi + 1} 小節有小鼓以外的鼓件`);
        let pos = 0;
        for (const ev of m.voices[0]) { if (ev.value === "2" && pos % 2) fail(`第 ${mi + 1} 小節二分音符在第 ${pos + 1} 拍`); pos += LEN[ev.value.replace(/^r/, "")]; }
      });
      if (i < 200 || g === 3) {   // MusicXML(慢一點,每級抽 200 題;3 級全部)
        let xml = "";
        try { xml = scoreXML({ key, lines: 1, time: t.time, measures: t.measures }); } catch (e) { fail("scoreXML 丟錯 " + e.message); }
        if (xml) {
          const ms = [...xml.matchAll(/<measure number="\d+">([\s\S]*?)<\/measure>/g)].map(m => m[1]);
          ms.forEach((m, mi) => { const d = [...m.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((s, x) => s + Number(x[1]), 0); if (d !== 4 * 2520) fail(`MusicXML 第 ${mi + 1} 小節 ${d / 2520} 拍`); });
          const want = t.measures.reduce((s, m) => s + m.voices[0].length, 0);
          if ((xml.match(/<note>/g) || []).length !== want) fail(`MusicXML 音符 + 休止符 ${(xml.match(/<note>/g) || []).length} 個,應該 ${want} 個(有自動補的休止符?)`);
          if (!/<staff-lines>1<\/staff-lines>/.test(xml) || /undefined|NaN/.test(xml)) fail("MusicXML 不是單線譜或有 undefined");
        }
      }
      // 3. 同種子同題、速度
      if (JSON.stringify(genSnare(spec, seed, g)) !== JSON.stringify(t)) fail("同一個種子出了不同的題目");
      if (!(Number.isInteger(t.bpm) && t.bpm >= h.bpm[0] && t.bpm <= h.bpm[1])) fail(`速度 ${t.bpm} 不在 ${h.bpm.join("–")}`);
      bpms.add(t.bpm);
      // 4. 結尾、最短時值、mixed
      const lastBar = t.measures[t.measures.length - 1].voices[0], lastEv = lastBar[lastBar.length - 1];
      if (!["4", "2"].includes(lastEv.value)) fail(`最後一個是 ${lastEv.value}`);
      if (!used.includes(MUST[g])) fail(`沒有用到這一級的 ${MUST[g]}`);
      const mixed = t.cells.some(b => b.some(id => CELLS.find(c => c.id === id).mixed));
      if (mixed !== t.mixed) fail("mixed 標記不對");
      // 5. events
      const evs = [];
      t.measures.forEach((m, mi) => { let pos = mi * 4; for (const ev of m.voices[0]) { if (ev.value[0] !== "r") evs.push(pos); pos += LEN[ev.value.replace(/^r/, "")]; } });
      if (JSON.stringify(evs) !== JSON.stringify(t.events.map(e => e.beat)) || t.events.some(e => e.piece !== "snare")) fail("events 跟譜不一致");
      if (t.lenBeats !== h.bars * 4) fail(`lenBeats ${t.lenBeats}`);
      fps.add(fingerprintOf(t));
    }
    ok(bad === 0, `${at}:${N} 個種子的題目都符合(白名單、每小節 4 拍、同種子同題、速度、結尾、events)`);
    if (h.bpm[0] !== h.bpm[1]) ok(bpms.has(h.bpm[0]) && bpms.has(h.bpm[1]) && bpms.size > 5, `${at}:範圍速度沒有隨機取到(${[...bpms].sort().join(",")})`);
    ok(fps.size > N * 0.8, `${at}:${N} 題只有 ${fps.size} 種(重複太多)`);
    // generateUnique:連出 30 題不重複
    let seed = 7;
    const hist = createHistory({ capacity: 60 }), seen = new Set();
    for (let k = 0; k < 30; k++) { const { fingerprint } = generateUnique(() => genSnare(spec, seed++, g), hist); seen.add(fingerprint); }
    ok(seen.size === 30, `${at}:generateUnique 連出 30 題有重複(${seen.size})`);
  }
  // 6. 整組鼓、QSP、Trinity 不出題
  for (const g of [4, 5, 6, 8]) { let threw = false; try { genSnare(rsl.sight[g], 1, g); } catch (e) { threw = true; } ok(threw, `視奏 ${g} 級不是小鼓視奏,genSnare 應該丟錯`); }
  { let threw = false; try { genSnare({ ...rsl.sight[0], time: { v: "3/4", assumed: true } }, 1, 0); } catch (e) { threw = true; } ok(threw, "拍號不是 4/4 應該丟錯"); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, checks = 0;
  check((c, m) => { checks++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${checks} 項)` : `✓ 全部通過(${checks} 項)`);
  process.exit(fails ? 1 : 0);
}
