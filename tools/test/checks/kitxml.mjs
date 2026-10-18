// 鼓組譜 MusicXML(js/shared/kitnotation.js)的檢查,verify.mjs 會呼叫;也可以單獨跑:node tools/test/checks/kitxml.mjs
// 1. 樣張(kitsamples.mjs)都產生得出來
// 2. 每一份 MusicXML:每小節每個聲部的時值加起來 = 拍號長度(含複拍子、不規則拍、換拍號);符頭位置 + 形狀都對得到 drumkey.json 的鼓件;
//    沒有 undefined / NaN;標籤成對;連音、連結線、wedge 開始和結束一樣多;整份譜有腳的聲部時每一小節都有
// 3. 隨機產生 500 小節(各種拍號、時值、連音、鼓件、修飾、連結線、力度、斜線小節、單線譜)都合法
// 4. 不合法的資料一定丟出錯誤(超過一小節、鼓件不在 drumkey、腳的鼓件放在手、連音沒結束、時值代號不認得……)
import fs from "node:fs";
import { scoreXML, measureLengths, parseTime, DIV, piecesUsed, legendXML } from "../../../js/shared/kitnotation.js";
import { VALUE_CODES } from "../../../js/shared/examdata.js";
import { KIT_SAMPLES } from "../kitsamples.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));

/* 一份 MusicXML 的結構檢查;回傳錯誤訊息清單 */
export function auditXML(xml, spec){
  const errs = [], lines = spec.lines === 1 ? 1 : 5;
  if (/undefined|NaN|\[object/.test(xml)) errs.push("有 undefined / NaN");
  // 標籤成對(簡單的堆疊;自己關閉的 <x/> 不算)
  const stack = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, "").matchAll(/<(\/?)([\w-]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (!m[1]) stack.push(m[2]);
    else if (stack.pop() !== m[2]) { errs.push(`標籤沒有成對:</${m[2]}>`); break; }
  }
  if (stack.length) errs.push("標籤沒有關:" + stack.join(","));
  const count = re => (xml.match(re) || []).length;
  if (count(/<tuplet type="start"/g) !== count(/<tuplet type="stop"/g)) errs.push("連音的開始和結束數量不一樣");
  if (count(/<tied type="start"/g) !== count(/<tied type="stop"/g)) errs.push("連結線的開始和結束數量不一樣");
  if (count(/<tie type="start"/g) !== count(/<tied type="start"/g)) errs.push("<tie> 與 <tied> 數量不一樣");
  if (count(/<wedge type="(crescendo|diminuendo)"/g) !== count(/<wedge type="stop"/g)) errs.push("wedge 的開始和結束數量不一樣");
  // 符頭位置 + 形狀 → 鼓件
  const POS = new Set(lines === 1 ? ["E4:normal"] : Object.values(key.pieces).map(p => `${p.step}${p.oct}:${p.head}`));
  POS.add(lines === 1 ? "E4:slash" : "B4:slash");
  // 每小節每個聲部的時值
  const lens = measureLengths(spec);
  const ms = [...xml.matchAll(/<measure number="(\d+)">([\s\S]*?)<\/measure>/g)];
  if (ms.length !== spec.measures.length) errs.push(`小節數 ${ms.length} ≠ ${spec.measures.length}`);
  const hasFeet = /<voice>2<\/voice>/.test(xml);
  ms.forEach((m, i) => {
    const sums = {}; let t = 0, max = 0;
    for (const el of m[2].matchAll(/<note>([\s\S]*?)<\/note>|<backup><duration>(\d+)<\/duration><\/backup>/g)) {
      if (el[2]) { t -= Number(el[2]); continue; }
      const n = el[1];
      if (!n.includes("<rest")) {
        const pos = /<display-step>(\w)<\/display-step><display-octave>(\d)<\/display-octave>/.exec(n), head = (/<notehead[^>]*>([\w-]+)<\/notehead>/.exec(n) || [, "normal"])[1];
        if (!pos || !POS.has(`${pos[1]}${pos[2]}:${head}`)) errs.push(`第 ${i + 1} 小節:符頭 ${pos ? pos[1] + pos[2] : "?"} ${head} 對不到 drumkey.json 的鼓件`);
      }
      if (n.includes("<grace")) { if (n.includes("<duration>")) errs.push(`第 ${i + 1} 小節:裝飾音不能有時值`); continue; }
      if (n.includes("<chord/>")) continue;
      const d = Number((/<duration>(\d+)<\/duration>/.exec(n) || [])[1]), v = (/<voice>(\d)<\/voice>/.exec(n) || [])[1];
      if (!(d > 0)) { errs.push(`第 ${i + 1} 小節:時值不對`); continue; }
      sums[v] = (sums[v] || 0) + d; t += d; max = Math.max(max, t);
    }
    for (const [v, s] of Object.entries(sums)) if (s !== lens[i]) errs.push(`第 ${i + 1} 小節 聲部 ${v}:時值 ${s / DIV} 拍 ≠ 拍號 ${lens[i] / DIV} 拍`);
    if (max > lens[i]) errs.push(`第 ${i + 1} 小節超過拍號長度`);
    if (!sums[1]) errs.push(`第 ${i + 1} 小節沒有手的聲部`);
    if (hasFeet && !spec.measures[i].slash && !sums[2]) errs.push(`第 ${i + 1} 小節少了腳的聲部`);
  });
  return errs;
}

/* ── 隨機產生(測試用;不是出題器)── */
function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const HANDS = Object.keys(key.pieces).filter(p => p !== "kick" && p !== "hhFoot");
const TIMES = ["4/4", "3/4", "2/4", "2/2", "5/4", "7/4", "6/8", "9/8", "12/8", "3/8", "5/8", "7/8", "2+2+3/8", "3+2/8"];
export function randomScore(seed, nMeasures = 4){
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)], lines = R() < 0.2 ? 1 : 5;
  const handNotes = () => {
    if (lines === 1) return [{ piece: "snare", accent: R() < 0.3, ghost: R() < 0.1, flam: R() < 0.1, drag: R() < 0.05 }];
    const n = R() < 0.3 ? 2 : 1, set = new Set(); while (set.size < n) set.add(pick(HANDS));
    return [...set].map(piece => ({ piece, accent: R() < 0.2, ghost: R() < 0.1, flam: R() < 0.08, drag: R() < 0.05, open: piece === "hh" && R() < 0.2, closed: piece === "hh" && R() < 0.2 }));
  };
  const footNotes = () => [{ piece: R() < 0.7 ? "kick" : "hhFoot", accent: R() < 0.1 }];
  // 一組(拍)的節奏:一般時值切開,或一組連音
  const groupRhythm = g => {
    if (g === DIV && R() < 0.3) { const c = pick(["8t3", "16t5", "16t6", "16t7", "32t9", "32t10"]), n = Number(c.split("t")[1]); return Array(n).fill(c); }
    if (g === 1.5 * DIV && R() < 0.3) return ["dup", "dup"];
    if (g === 1.5 * DIV && R() < 0.4) return ["4."];
    const out = []; let left = g;
    const opts = ["4", "8", "8", "16", "16", "32", "8.", "16."].map(c => [c, { "4": DIV, "8": DIV / 2, "16": DIV / 4, "32": DIV / 8, "8.": DIV * 0.75, "16.": DIV * 0.375 }[c]]);
    while (left > 0) { const ok = opts.filter(([, d]) => d <= left && (g - left) % (d === DIV * 0.75 || d === DIV * 0.375 ? d / 3 : d) === 0); const [c, d] = pick(ok); out.push(c); left -= d; }
    return out;
  };
  const voice = (meter, notesFn, feet) => {
    const groups = meter.groups.map(groupRhythm);
    // 有時候前兩拍改成四分音符三連音(4t3 × 3)
    if (meter.type !== 8 && groups.length >= 2 && R() < 0.1) groups.splice(0, 2, ["4t3", "4t3", "4t3"]);
    // 後面幾組有時候不寫(補休止);留下的最後一組不是連音的話也可能只寫前半
    let codes;
    if (R() < 0.3) {
      const k = Math.floor(R() * groups.length), next = groups[k];
      codes = groups.slice(0, k).flat();
      if (next && !next.some(c => /t|dup/.test(c))) codes.push(...next.slice(0, Math.floor(R() * next.length)));
    } else codes = groups.flat();
    const evs = codes.map(c => (R() < 0.15 ? { value: "r" + c } : { value: c, notes: notesFn() }));
    if (!feet && lines === 5) evs.forEach(e => { if (e.notes && R() < 0.05) e.roll = 1 + Math.floor(R() * 3); else if (e.notes && R() < 0.03) e.buzz = true; });
    // 連結線:下一個也是音的話,把下一個改成同樣的鼓件
    for (let i = 0; i + 1 < evs.length; i++) if (evs[i].notes && evs[i + 1].notes && R() < 0.1) { evs[i].tie = true; evs[i + 1].notes = evs[i].notes.map(n => ({ piece: n.piece })); }
    return evs;
  };
  const measures = [], dyn = [];
  let time = pick(TIMES);
  const first = time;
  for (let mi = 0; mi < nMeasures; mi++) {
    const m = {};
    if (mi && R() < 0.25) { time = pick(TIMES); m.time = time; }
    const meter = parseTime(time);
    if (R() < 0.08) m.slash = true;
    else {
      m.voices = [voice(meter, handNotes, false)];
      if (lines === 5 && R() < 0.7) m.voices.push(voice(meter, footNotes, true));
      // 力度:放在手的某個音的開頭
      if (R() < 0.3) { let p = 0; const ons = m.voices[0].map(e => { const at = p; p += valueDur(e.value); return at; }); const at = pick(ons.length ? ons : [0]); dyn.push({ m: mi, beat: at / DIV, mark: pick(["pp", "p", "mp", "mf", "f", "ff", "sfz", "cresc", "dim"]) }); }
    }
    measures.push(m);
  }
  // 同一個位置不要放兩個力度
  const seen = new Set();
  return { lines, time: first, measures, dyn: dyn.filter(d => { const k = d.m + ":" + d.beat; if (seen.has(k)) return false; seen.add(k); return true; }) };
}
const valueDur = v => { const c = v[0] === "r" ? v.slice(1) : v; const t = { "8t3": DIV / 3, "4t3": DIV * 2 / 3, "16t3": DIV / 6, "16t5": DIV / 5, "16t6": DIV / 6, "16t7": DIV / 7, "32t9": DIV / 9, "32t10": DIV / 10, dup: DIV * 0.75 }[c]; if (t) return t; const dot = c.endsWith("."); return 4 * DIV / Number(dot ? c.slice(0, -1) : c) * (dot ? 1.5 : 1); };

export default function check(ok){
  // 1. 樣張
  for (const s of KIT_SAMPLES) {
    let xml = null;
    try { xml = scoreXML({ ...s.spec, key }); } catch (e) { ok(false, `樣張 ${s.id}:${e.message}`); continue; }
    for (const e of auditXML(xml, s.spec)) ok(false, `樣張 ${s.id}:${e}`);
    ok(piecesUsed({ ...s.spec, key }).every(p => key.pieces[p]), `樣張 ${s.id}:用到的鼓件不在 drumkey`);
  }
  ok(KIT_SAMPLES.filter(s => s.group === "pieces").length === Object.keys(key.pieces).length, "樣張要有每一個鼓件");
  // 圖例的一格
  for (const p of Object.keys(key.pieces)) {
    const x = legendXML(p, { key });
    ok(!/undefined|NaN/.test(x) && x.includes(`<display-step>${key.pieces[p].step}</display-step>`), `圖例 ${p} 的 MusicXML`);
  }
  // 2–3. 隨機 500 小節(125 份 × 4 小節)
  let measures = 0, bad = 0;
  for (let seed = 1; measures < 500; seed++) {
    const spec = { ...randomScore(seed), key };
    measures += spec.measures.length;
    let xml;
    try { xml = scoreXML(spec); } catch (e) { bad++; if (bad <= 5) ok(false, `隨機 #${seed}:${e.message}`); continue; }
    const errs = auditXML(xml, spec);
    if (errs.length) { bad++; if (bad <= 5) ok(false, `隨機 #${seed}:${errs.slice(0, 3).join(";")}`); }
  }
  ok(bad === 0, `隨機產生的 ${measures} 小節有 ${bad} 份不合法`);
  // 4. 不合法的一定丟出錯誤
  const S = (voices, extra = {}) => ({ key, time: "4/4", measures: [{ voices }], ...extra });
  const q = p => ({ value: "4", notes: [{ piece: p }] });
  const BAD = [
    ["超過一小節", S([[q("snare"), q("snare"), q("snare"), q("snare"), q("snare")]])],
    ["鼓件不在 drumkey", S([[q("cowbell")]])],
    ["腳的鼓件放在手", S([[q("kick")]])],
    ["手的鼓件放在腳", S([[], [q("snare")]])],
    ["時值代號不認得", S([[{ value: "64", notes: [{ piece: "snare" }] }]])],
    ["連音沒有結束", S([[{ value: "8t3", notes: [{ piece: "snare" }] }, { value: "8t3", notes: [{ piece: "snare" }] }, q("snare")]])],
    ["音符沒有 notes", S([[{ value: "4" }]])],
    ["單線譜放了別的鼓件", S([[q("tomHi")]], { lines: 1 })],
    ["單線譜有腳", S([[q("snare")], [q("kick")]], { lines: 1 })],
    ["拍號寫錯", S([[q("snare")]], { time: "4/3" })],
    ["連結線後面不是同一個鼓件", S([[{ ...q("snare"), tie: true }, q("tomHi")]])],
    ["最後一個音有連結線", S([[q("snare"), q("snare"), q("snare"), { ...q("snare"), tie: true }]])],
    ["力度對不到音", S([[q("snare"), q("snare"), q("snare"), q("snare")]], { dyn: [{ m: 0, beat: 0.5, mark: "f" }] })],
    ["不認得的力度", S([[q("snare")]], { dyn: [{ m: 0, beat: 0, mark: "fff" }] })],
    ["力度的小節不對", S([[q("snare")]], { dyn: [{ m: 3, beat: 0, mark: "f" }] })],
    ["lines 不是 1 或 5", S([[q("snare")]], { lines: 3 })],
    ["roll 和 buzz 一起", S([[{ ...q("snare"), roll: 2, buzz: true }]])],
    ["roll 超過 3", S([[{ ...q("snare"), roll: 4 }]])]
  ];
  for (const [name, spec] of BAD) { let threw = false; try { scoreXML(spec); } catch (e) { threw = true; } ok(threw, `不合法的資料要丟出錯誤:${name}`); }
  // 每個時值代號都能用(連音寫一整組,其他寫一個;剩下的自動補休止)
  for (const c of VALUE_CODES) {
    const n = /t(\d+)$/.test(c) ? Number(c.split("t")[1]) : c === "dup" ? 2 : 1, spec = { key, time: c === "dup" ? "6/8" : "4/4", measures: [{ voices: [Array(n).fill(0).map(() => ({ value: c, notes: [{ piece: "snare" }] }))] }] };
    let errs; try { errs = auditXML(scoreXML(spec), spec); } catch (e) { errs = [e.message]; }
    ok(!errs.length, `時值代號 ${c}:${errs.join(";")}`);
    try { const r = { ...spec, measures: [{ voices: [Array(n).fill(0).map(() => ({ value: "r" + c }))] }] }; ok(!auditXML(scoreXML(r), r).length, `休止 r${c}`); } catch (e) { ok(false, `休止 r${c}:${e.message}`); }
  }
  return { measures, bad };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, n = 0;
  const r = check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 鼓組譜 MusicXML 全部通過(${n} 項;隨機 ${r.measures} 小節)`);
  process.exit(fails ? 1 : 0);
}
