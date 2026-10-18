// RSL 聽力出題器(js/ear/gen.js:genFill、distractors、fillOptions、genGroove)的檢查,verify.mjs 會呼叫;
// 也可以單獨跑:node tools/test/checks/gen-ear.mjs(EAR_SEEDS=100 可以少跑一點)
// 每一級(Debut–8)1000 個種子:
// 1. Fill:只用白名單(這裡手抄了大綱的表:RSL p.31…69 / docs/sources/rsl-drums.md §5.2,6–8 級「四分到十六分六連音」= 主持人決定的 4 8 8t3 16 16t6;
//    不從資料檔複製,反過來跟資料檔核對);1 小節 4/4、只有小鼓、單線譜(lines:1)、♩=70、聽兩次、1 小節預備拍;
//    時值自己的表重算 = 4 拍、連音一組從拍點開始(8t3 三個、16t6 六個);MusicXML auditXML + MusicXML 收到的時值也在白名單;事件 = MusicXML
// 2. 干擾選項:數目 = 選項數 − 1(Debut–3 級 1 個、4–8 級 2 個);每個只改一拍(自己把小節切成拍比對)、也只用白名單;
//    擊打時間(從 MusicXML 算)跟答案不同、彼此不同;fillOptions 的答案位置對
// 3. Groove:2 小節 4/4 五線;鼓件不超過這一級(手抄表;開 HH 從 2 級、Crash 3 級、Ride / 碗 4 級、cross stick 5 級、6–8 級整組鼓);
//    速度是整數、在官方範圍;播兩遍(推估)、playEvents = 兩遍;不出風格題(styleOptions null;4–8 級帶 noStyle 說明);事件 = MusicXML
// 4. 同一個種子同一題;每一級白名單的每個時值、休止符、Groove 鼓件在 1000 題裡至少出現一次
// 5. 竄改:白名單外的時值、速度、鼓件、干擾跟答案一樣 / 聽起來一樣 / 改了兩拍、選項數不對、事件錯位 → 一定抓到
import fs from "node:fs";
import { genFill, distractors, fillOptions, genGroove, NOTES } from "../../../js/ear/gen.js";
import { scoreXML } from "../../../js/shared/kitnotation.js";
import { auditXML } from "./kitxml.mjs";
import { xmlEvents, xmlCodes, evKey, evDiff } from "./xmlevents.mjs";
import { hitsOnly } from "../../../js/shared/kitevents.js";

const root = new URL("../../../", import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + "data/exam-rsl.json", "utf8"));
const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));
const SEEDS = Number(process.env.EAR_SEEDS) || 1000;

/* 手抄(RSL p.31、35、39、43、48、53、59、64、69) */
const R68 = ["4", "8", "8t3", "16", "16t6"];   // 6–8 級:依官方範圍(主持人決定)
const FILL = {
  0: { values: ["4", "8"], rests: [], options: 2 },
  1: { values: ["4", "8"], rests: ["r4"], options: 2 },
  2: { values: ["4", "8", "16"], rests: ["r4"], options: 2 },
  3: { values: ["4", "8", "8t3", "16"], rests: ["r4"], options: 2 },
  4: { values: ["4", "8", "8t3", "8.", "16"], rests: [], options: 3 },
  5: { values: ["4", "8", "8t3", "8.", "16"], rests: [], options: 3 },
  6: { values: R68, rests: ["r4", "r8"], options: 3, range: true },
  7: { values: R68, rests: ["r4", "r8", "r16"], options: 3, range: true },
  8: { values: R68, rests: ["r4", "r8", "r16"], options: 3, range: true }
};
const FILL_BPM = 70;
const KIT = ["hh", "hhOpen", "hhClosed", "hhFoot", "snare", "xstick", "kick", "ride", "rideBell", "crash", "tomHi", "tomMid", "tomFloor"];   // 整組鼓(推估)
const GROOVE = {
  0: { pieces: ["hh", "snare", "kick"], bpm: [80, 80], styles: 0 },
  1: { pieces: ["hh", "snare", "kick"], bpm: [80, 80], styles: 0 },
  2: { pieces: ["hh", "hhOpen", "hhClosed", "snare", "kick"], bpm: [80, 80], styles: 0 },
  3: { pieces: ["crash", "hh", "hhOpen", "hhClosed", "snare", "kick"], bpm: [80, 80], styles: 0 },
  4: { pieces: ["crash", "hh", "hhOpen", "hhClosed", "ride", "rideBell", "snare", "kick"], bpm: [80, 120], styles: 3 },
  5: { pieces: ["crash", "hh", "hhOpen", "hhClosed", "ride", "rideBell", "snare", "kick", "xstick"], bpm: [80, 120], styles: 3 },
  6: { pieces: KIT, bpm: [80, 140], styles: 4 },
  7: { pieces: KIT, bpm: [80, 140], styles: 4 },
  8: { pieces: KIT, bpm: [80, 160], styles: 4 }
};
const D = 2520, QV = { "4": D, "8": D / 2, "8.": D * 3 / 4, "16": D / 4, "8t3": D / 3, "16t6": D / 6, "2": 2 * D, "4.": 1.5 * D, "1": 4 * D, "32": D / 8, "16t3": D / 6 };
const MARKS = ["accent", "ghost", "open", "closed", "flam", "drag"];
const pieceId = n => (n.piece === "hh" && n.open ? "hhOpen" : n.piece === "hh" && n.closed ? "hhClosed" : n.piece);

/* 小節切成拍:每一拍的時值代號字串(跨拍的音 → null) */
function beatsOf(voice){
  const out = [[], [], [], []]; let p = 0;
  for (const e of voice) {
    const code = e.value.replace(/^r/, ""), d = Math.round(QV[code]), b = Math.floor(p / D + 1e-9);
    if (!(d > 0) || b > 3) return null;
    if (Math.floor((p + d - 1) / D + 1e-9) !== b) return null;
    out[b].push(e.value); p += d;
  }
  return out.map(x => x.join(" "));
}
const ONSETS = new WeakMap();
/* 一個 Fill(答案或干擾選項)的檢查 */
function checkFillBar(g, f, used, tag = ""){
  const errs = [], E = s => errs.push(tag + s), W = FILL[g];
  if (f.spec.lines !== 1) E("Fill 要是單線譜(只有小鼓)");
  if (f.spec.time !== "4/4" || f.spec.measures.length !== 1) E(`Fill 要 1 小節 4/4(${f.spec.measures.length} 小節 ${f.spec.time})`);
  const m = f.spec.measures[0];
  if (!m || !m.voices || m.voices.length !== 1) { E("Fill 只有一個聲部"); return errs; }
  const v = m.voices[0];
  let p = 0, run = null;
  v.forEach((e, ei) => {
    const where = `第 ${ei + 1} 個`, rest = e.value[0] === "r", code = rest ? e.value.slice(1) : e.value;
    if (!(code in QV)) { E(`${where}:時值 ${e.value} 不認得`); return; }
    if (rest) { used && used.rest.add(e.value); if (!W.rests.includes(e.value)) E(`${where}:休止符 ${e.value} 不在 ${g} 級白名單`); }
    else { used && used.value.add(code); if (!W.values.includes(code)) E(`${where}:時值 ${code} 不在 ${g} 級白名單`); }
    for (const n of e.notes || []) { if (n.piece !== "snare") E(`${where}:Fill 只用小鼓(${n.piece})`); for (const k of MARKS) if (n[k]) E(`${where}:不寫 ${k}`); }
    if (e.tie || e.roll || e.buzz) E(`${where}:不寫連結線、滾奏`);
    // 連音一組從拍點開始:8t3 三個、16t6 六個
    const t = /t(\d)$/.exec(code);
    if (t) {
      if (!run || run.code !== code || run.n === Number(t[1])) { if (run && run.n !== run.need) E(`${where}:連音 ${run.code} 只有 ${run.n} 個`); run = { code, n: 0, need: Number(t[1]) }; if (p % D) E(`${where}:連音 ${code} 要從拍點開始(${p / D} 拍)`); }
      run.n++;
    } else if (run) { if (run.n !== run.need) E(`${where}:連音 ${run.code} 只有 ${run.n} 個`); run = null; }
    p += Math.round(QV[code]);
  });
  if (run && run.n !== run.need) E(`連音 ${run.code} 只有 ${run.n} 個`);
  if (p !== 4 * D) E(`時值加起來 ${p / D} 拍 ≠ 4 拍`);
  let xml;
  try { xml = scoreXML({ ...f.spec, key }); } catch (e) { E("scoreXML:" + e.message); return errs; }
  for (const a of auditXML(xml, f.spec)) E("MusicXML:" + a);
  const X = xmlCodes(xml);
  for (const c of X.values) if (!W.values.includes(c)) E(`MusicXML 時值 ${c} 不在白名單`);
  for (const c of X.rests) if (!W.rests.includes(c)) E(`MusicXML 休止符 ${c} 不在白名單`);
  const XE = xmlEvents(xml, key, 1);
  if (evKey(hitsOnly(f.events)) !== evKey(XE.hits)) E("事件 ≠ MusicXML:" + evDiff(hitsOnly(f.events), XE.hits).join("、"));
  ONSETS.set(f, XE.hits.map(h => h.beat.toFixed(3)).join(","));   // 從 MusicXML 算的擊打時間(比「聽起來一不一樣」)
  return errs;
}
export function checkFill(g, f, ds, used){
  const errs = [], E = s => errs.push(s), W = FILL[g];
  if (f.bpm !== FILL_BPM) E(`Fill 速度 ♩=${f.bpm}(應該 ${FILL_BPM})`);
  if (f.plays !== 2 || f.countInBars !== 1) E("Fill 要聽兩次、每次 1 小節預備拍");
  if (f.options !== W.options) E(`選項數 ${f.options}(${g} 級應該 ${W.options})`);
  if (!!W.range !== f.notes.includes("fillRange")) E("6–8 級要標「依官方範圍」(fillRange)");
  for (const k of f.notes) if (!NOTES[k]) E(`說明 key ${k} 沒有文字`);
  errs.push(...checkFillBar(g, f, used));
  if (ds.length !== W.options - 1) E(`干擾選項 ${ds.length} 個(${g} 級應該 ${W.options - 1} 個)`);
  const ansBeats = beatsOf(f.spec.measures[0].voices[0]), seen = new Set([ONSETS.get(f)]);
  ds.forEach((d, i) => {
    const tag = `干擾 ${i + 1}:`;
    errs.push(...checkFillBar(g, d, used, tag));
    const b = beatsOf(d.spec.measures[0].voices[0]);
    const diff = b && ansBeats ? b.filter((x, k) => x !== ansBeats[k]).length : -1;
    if (diff !== 1) E(`${tag}應該只改一拍(改了 ${diff} 拍)`);
    const on = ONSETS.get(d);
    if (on === ONSETS.get(f)) E(`${tag}擊打時間跟答案一樣(聽起來一樣)`);
    else if (seen.has(on)) E(`${tag}擊打時間跟另一個干擾選項一樣`);
    seen.add(on);
    if (d.bpm !== f.bpm) E(`${tag}速度跟答案不一樣`);
  });
  return errs;
}
export function checkGroove(g, q, used){
  const errs = [], E = s => errs.push(s), W = GROOVE[g];
  if (q.spec.lines !== 5 || q.spec.time !== "4/4" || q.spec.measures.length !== 2) E("Groove 要 2 小節 4/4 五線");
  if (!(Number.isInteger(q.bpm) && q.bpm >= W.bpm[0] && q.bpm <= W.bpm[1])) E(`Groove 速度 ${q.bpm} 不在 ${W.bpm.join("–")}`);
  if (q.repeat !== 2) E(`Groove 播 ${q.repeat} 遍(資料檔推估 2 遍)`);
  if (q.playBeats !== 16 || evKey(q.playEvents) !== evKey([...q.events, ...q.events.map(e => ({ ...e, beat: e.beat + 8 }))])) E("playEvents 不是兩小節播兩遍");
  if (q.styleOptions !== null) E("不出風格題(styleOptions 要是 null)");
  if ((W.styles > 0) !== q.notes.includes("noStyle")) E("4–8 級要說明不出風格題(noStyle)");
  if (q.styleChoices !== W.styles) E(`風格選項數 ${q.styleChoices}(應該 ${W.styles})`);
  if (!q.notes.includes("grooveRepeat") || NOTES.grooveRepeat.kind !== "assumed") E("「repeated」播兩遍要標推估");
  for (const k of q.notes) if (!NOTES[k]) E(`說明 key ${k} 沒有文字`);
  q.spec.measures.forEach((m, mi) => {
    if (m.slash || m.time) E(`第 ${mi + 1} 小節:不能是斜線或換拍號`);
    (m.voices || []).forEach((v, vi) => {
      let p = 0;
      for (const e of v) {
        const code = e.value.replace(/^r/, "");
        if (!(code in QV)) { E(`第 ${mi + 1} 小節:時值 ${e.value} 不認得`); continue; }
        for (const n of e.notes || []) {
          const id = pieceId(n); used.add(id);
          if (!W.pieces.includes(id)) E(`第 ${mi + 1} 小節:鼓件 ${id} 不在 ${g} 級(${W.pieces.join(" ")})`);
          for (const k of ["accent", "ghost", "flam", "drag"]) if (n[k]) E(`第 ${mi + 1} 小節:不寫 ${k}`);
        }
        p += Math.round(QV[code]);
      }
      if (p !== 4 * D) E(`第 ${mi + 1} 小節 ${vi ? "腳" : "手"}:時值 ${p / D} 拍 ≠ 4 拍`);
    });
  });
  let xml;
  try { xml = scoreXML({ ...q.spec, key }); } catch (e) { E("scoreXML:" + e.message); return errs; }
  for (const a of auditXML(xml, q.spec)) E("MusicXML:" + a);
  const XE = xmlEvents(xml, key, 5);
  for (const h of XE.hits) if (!W.pieces.includes(h.piece)) E(`MusicXML 鼓件 ${h.piece} 不在 ${g} 級`);
  if (evKey(hitsOnly(q.events)) !== evKey(XE.hits)) E("事件 ≠ MusicXML:" + evDiff(hitsOnly(q.events), XE.hits).join("、"));
  return errs;
}

export default function check(ok){
  // 手抄的表 = 資料檔
  for (let g = 0; g <= 8; g++) {
    const e = data.ear[g], F = FILL[g], G = GROOVE[g];
    const vals = Array.isArray(e.fill.values) ? e.fill.values : (e.fill.valueRange && e.fill.valueRange.join("–") === "4–16t6" ? R68 : null);
    ok(e.fill.bars === 1 && e.fill.bpm === FILL_BPM && e.fill.options === F.options && e.fill.plays === 2 && e.fill.countInBars === 1 &&
      JSON.stringify(e.fill.pieces) === '["snare"]' && JSON.stringify(vals) === JSON.stringify(F.values) && JSON.stringify(e.fill.rests) === JSON.stringify(F.rests),
      `exam-rsl.json ear[${g}].fill 跟手抄的大綱表不一樣`);
    const gp = e.groove.pieces.includes("kit") ? KIT : e.groove.pieces.flatMap(p => (p === "hhOpen" ? ["hhOpen", "hhClosed"] : [p]));
    ok(e.groove.bars === 2 && e.groove.bpm.join() === G.bpm.join() && e.groove.styleChoices === G.styles && e.groove.styleOptions === null &&
      e.groove.repeat.v === 2 && e.groove.repeat.assumed === true && [...gp].sort().join() === [...G.pieces].sort().join(),
      `exam-rsl.json ear[${g}].groove 跟手抄的大綱表不一樣`);
  }
  for (let g = 0; g <= 8; g++) {
    const used = { value: new Set(), rest: new Set() }, gUsed = new Set(), bpms = new Set();
    let bad = 0, gBad = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let f, ds, errs;
      try { f = genFill(data.ear[g], seed, g); ds = distractors(f, f.options - 1, seed); errs = checkFill(g, f, ds, used); }
      catch (e) { errs = [e.message]; }
      if (!errs.length && seed % 50 === 0) {
        if (JSON.stringify(genFill(data.ear[g], seed, g)) !== JSON.stringify(f) || evKey(distractors(f, f.options - 1, seed).flatMap(d => d.events)) !== evKey(ds.flatMap(d => d.events))) errs.push("同一個種子產生不同的題目");
        const o = fillOptions(f, seed);
        if (o.options.length !== f.options || o.options[o.answer] !== f || new Set(o.options.map(x => x.cells.join())).size !== f.options) errs.push("fillOptions 的選項或答案位置不對");
      }
      if (errs.length) { bad++; if (bad <= 3) ok(false, `RSL Fill ${g} 級 #${seed}:${errs.slice(0, 4).join(";")}`); }
      let q, ge;
      try { q = genGroove(data.ear[g], seed, g); ge = checkGroove(g, q, gUsed); bpms.add(q.bpm); } catch (e) { ge = [e.message]; }
      if (!ge.length && seed % 50 === 0 && JSON.stringify(genGroove(data.ear[g], seed, g)) !== JSON.stringify(q)) ge.push("同一個種子產生不同的題目");
      if (ge.length) { gBad++; if (gBad <= 3) ok(false, `RSL Groove ${g} 級 #${seed}:${ge.slice(0, 4).join(";")}`); }
    }
    ok(bad === 0, `RSL Fill ${g} 級:${SEEDS} 題(含干擾選項)有 ${bad} 題不合規則`);
    ok(gBad === 0, `RSL Groove ${g} 級:${SEEDS} 題有 ${gBad} 題不合規則`);
    const F = FILL[g], miss = [...F.values.filter(x => !used.value.has(x)), ...F.rests.filter(x => !used.rest.has(x))];
    ok(!miss.length, `RSL Fill ${g} 級:白名單裡沒出現過的 ${miss.join("、")}`);
    const gm = GROOVE[g].pieces.filter(x => !gUsed.has(x));
    ok(!gm.length, `RSL Groove ${g} 級:鼓件沒出現過 ${gm.join("、")}`);
    const W = GROOVE[g].bpm;
    ok(SEEDS < 200 || (bpms.has(W[0]) && bpms.has(W[1])), `RSL Groove ${g} 級:速度沒用到範圍兩端`);
  }
  // 竄改:檢查本身抓得到錯
  {
    const g = 3, f = genFill(data.ear[g], 11, g), ds = distractors(f, 1, 11), u = { value: new Set(), rest: new Set() };
    const T = (fn, re, msg, gg = g) => { const a = structuredClone(f), b = structuredClone(ds); fn(a, b); ok(checkFill(gg, a, b, u).some(e => re.test(e)), "檢查本身:" + msg); };
    const six = { value: "16t6", notes: [{ piece: "snare" }] };
    T((a) => { a.spec.measures[0].voices[0].splice(0, beatLen(a, 0), six, six, six, six, six, six); }, /16t6 不在 3 級/, "3 級的六連音要抓到");
    T((a) => { a.bpm = 90; }, /Fill 速度/, "Fill ♩=90 要抓到");
    T((a) => { a.spec.measures[0].voices[0][0].notes = [{ piece: "tomHi" }]; }, /只用小鼓|單線譜只能/, "Fill 用筒鼓要抓到");
    T((a, b) => { b[0] = structuredClone(a); }, /跟答案一樣|只改一拍/, "干擾跟答案一樣要抓到");
    T((a, b) => { b.pop(); }, /干擾選項 0 個/, "干擾選項數不對要抓到");
    T((a) => { a.events[0].beat += 0.5; }, /事件 ≠ MusicXML/, "事件錯位要抓到");
    // 改了兩拍
    T((a, b) => { const w = a.spec.measures[0].voices[0], bs = beatsOf(w), alt = k => (bs[k] === "4" ? ["8", "8"] : ["4"]); b[0].spec.measures[0].voices[0] = rewriteBeats(w, { 0: alt(0), 3: alt(3) }, bs); }, /改了 2 拍/, "干擾改了兩拍要抓到");
    // 聽起來一樣:6 級把某一拍「4」換成「8 r8」(擊打時間一樣)
    let found = false;
    for (let s = 1; s <= 300 && !found; s++) {
      const f6 = genFill(data.ear[6], s, 6), w = f6.spec.measures[0].voices[0], bs = beatsOf(w), k = bs.indexOf("4");
      if (k < 0) continue;
      found = true;
      const d6 = distractors(f6, 2, s), fake = structuredClone(f6);
      fake.spec.measures[0].voices[0] = rewriteBeats(w, { [k]: ["8", "r8"] }, bs);
      ok(checkFill(6, f6, [fake, d6[1]], u).some(e => /聽起來一樣/.test(e)), "檢查本身:干擾只差休止符寫法(聽起來一樣)要抓到");
    }
    ok(found, "檢查本身:找不到有四分音符的 6 級 Fill");
    // Groove
    const q = genGroove(data.ear[1], 4, 1), gu = new Set();
    const TG = (fn, re, msg, gg = 1) => { const a = structuredClone(q); fn(a); ok(checkGroove(gg, a, gu).some(e => re.test(e)), "檢查本身:" + msg); };
    TG(a => { a.spec.measures[0].voices[0][0].notes.push({ piece: "crash" }); }, /crash 不在 1 級/, "1 級的 Crash 要抓到");
    TG(a => { a.bpm = 85; }, /速度 85/, "Groove 1 級 ♩=85 要抓到");
    TG(a => { a.styleOptions = ["Rock", "Funk"]; }, /風格題/, "出了風格題要抓到");
    TG(a => { a.events[2].beat += 0.25; }, /事件 ≠ MusicXML/, "Groove 事件錯位要抓到");
    let xs = 0; for (let s = 1; s <= 200; s++) { const z = genGroove(data.ear[5], s, 5); if (checkGroove(4, z, new Set()).some(e => /xstick 不在 4 級/.test(e))) xs++; }
    ok(xs > 0, "檢查本身:5 級的 cross stick 當 4 級檢查要抓到");
    let threw = false; try { genFill(data.ear[3], 1); } catch (e) { threw = true; } ok(threw, "genFill 沒給級數應該丟出錯誤");
  }
}
/* 一拍(第 k 拍)有幾個 ev(竄改用) */
function beatLen(f, k){ const bs = beatsOf(f.spec.measures[0].voices[0]); return bs[k].split(" ").length; }
/* 把某幾拍換成新的寫法(竄改用;音符都是小鼓) */
function rewriteBeats(voice, repl, bs){
  const out = [];
  bs.forEach((s, k) => {
    const codes = repl[k] || s.split(" ");
    for (const c of codes) out.push(c[0] === "r" ? { value: c } : { value: c, notes: [{ piece: "snare" }] });
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 全部通過(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
