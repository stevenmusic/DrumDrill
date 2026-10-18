// 鼓組譜 MusicXML(js/shared/kitnotation.js)的檢查,verify.mjs 會呼叫;也可以單獨跑:node tools/test/checks/kitxml.mjs
// 1. 樣張(kitsamples.mjs)都產生得出來
// 2. 每一份 MusicXML:每小節每個聲部的時值加起來 = 拍號長度(含複拍子、不規則拍、換拍號);符頭位置 + 形狀都對得到 drumkey.json 的鼓件;
//    沒有 undefined / NaN;標籤成對;連音、連結線、wedge 開始和結束一樣多;整份譜有腳的聲部時每一小節都有
// 3. 隨機產生 500 小節(各種拍號、時值、連音、鼓件、修飾、連結線、力度、斜線小節、單線譜)都合法
// 4. 不合法的資料一定丟出錯誤(超過一小節、鼓件不在 drumkey、腳的鼓件放在手、連音沒結束、時值代號不認得、
//    開閉 HH 寫錯地方、Flam/Drag/滾奏放在腳、滾奏太短、同一個位置兩個力度……)
// 5. 混用 8t3 與 16t3 的一拍是一個連音組;連結線接續的開 HH 只有第一個音有 o;圖例的出處小字(legendSrc)
// auditXML 的時值不信任 <duration>:每個音用 <type>、<dot/>、<time-modification> 自己重算,再跟 <duration>、拍號、連音組的長度比對
import fs from "node:fs";
import { scoreXML, measureLengths, parseTime, DIV, piecesUsed, legendXML, legendSrc, osmdXML } from "../../../js/shared/kitnotation.js";
import { VALUE_CODES } from "../../../js/shared/examdata.js";
import { KIT_SAMPLES } from "../kitsamples.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));

/* 一個 <note> 的時值,只看 <type>、<dot/>、<time-modification>(不看 <duration>);整小節休止回傳 null */
const TYPE_Q = { whole: 4, half: 2, quarter: 1, eighth: 0.5, "16th": 0.25, "32nd": 0.125, "64th": 0.0625 };
export function noteDur(n){
  if (/<rest measure="yes"/.test(n)) return null;
  const type = (/<type>([\w]+)<\/type>/.exec(n) || [])[1];
  if (!(type in TYPE_Q)) return NaN;
  const dots = (n.match(/<dot\/>/g) || []).length;
  let q = TYPE_Q[type] * (2 - 1 / 2 ** dots);
  const tm = /<time-modification><actual-notes>(\d+)<\/actual-notes><normal-notes>(\d+)<\/normal-notes>(?:<normal-type>([\w]+)<\/normal-type>)?/.exec(n);
  if (tm) q = q * Number(tm[2]) / Number(tm[1]);
  return Math.round(q * DIV * 1e6) / 1e6;
}
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
    const sums = {}, tup = {}; let t = 0, max = 0;
    for (const el of m[2].matchAll(/<note(?: print-object="no")?>([\s\S]*?)<\/note>|<backup><duration>(\d+)<\/duration><\/backup>/g)) {
      if (el[2]) { t -= Number(el[2]); continue; }
      const n = el[1];
      if (!n.includes("<rest")) {
        const pos = /<display-step>(\w)<\/display-step><display-octave>(\d)<\/display-octave>/.exec(n), head = (/<notehead[^>]*>([\w-]+)<\/notehead>/.exec(n) || [, "normal"])[1];
        if (!pos || !POS.has(`${pos[1]}${pos[2]}:${head}`)) errs.push(`第 ${i + 1} 小節:符頭 ${pos ? pos[1] + pos[2] : "?"} ${head} 對不到 drumkey.json 的鼓件`);
      }
      if (n.includes("<grace")) { if (n.includes("<duration>")) errs.push(`第 ${i + 1} 小節:裝飾音不能有時值`); continue; }
      const d = Number((/<duration>(\d+)<\/duration>/.exec(n) || [])[1]), v = (/<voice>(\d)<\/voice>/.exec(n) || [])[1];
      // 時值自己重算(type + dot + time-modification),跟 <duration> 比對
      const rd = noteDur(n), where = `第 ${i + 1} 小節 聲部 ${v} ${t / DIV} 拍`;
      if (rd === null) { if (d !== lens[i]) errs.push(`${where}:整小節休止 ${d / DIV} 拍 ≠ 拍號 ${lens[i] / DIV} 拍`); }
      else if (!(rd > 0)) errs.push(`${where}:<type> 不認得`);
      else if (Math.abs(rd - d) > 1e-6) errs.push(`${where}:<duration> ${d} ≠ 照 type/dot/time-modification 重算 ${rd}`);
      if (n.includes("<chord/>")) continue;
      if (!(d > 0)) { errs.push(`第 ${i + 1} 小節:時值不對`); continue; }
      const dd = rd === null ? d : rd;
      // 連音組:start 到 stop 之間每個音都要有 time-modification、比例一樣;總長(重算的)= 組裡最長的 normal-notes × normal-type
      const tm = /<time-modification><actual-notes>(\d+)<\/actual-notes><normal-notes>(\d+)<\/normal-notes><normal-type>([\w]+)<\/normal-type>/.exec(n);
      const st = /<tuplet type="start"/.test(n), sp = /<tuplet type="stop"/.test(n);
      if (st) { if (tup[v]) errs.push(`${where}:上一個連音組還沒結束又開始一組`); tup[v] = { acc: 0, ratio: tm && tm[1] + ":" + tm[2], spans: [] }; }
      const g = tup[v];
      if (tm && !g) errs.push(`${where}:有 time-modification 卻不在連音組裡`);
      if (g) {
        if (!tm) errs.push(`${where}:連音組裡的音沒有 time-modification`);
        else {
          if (tm[1] + ":" + tm[2] !== g.ratio) errs.push(`${where}:連音組裡比例不一樣(${g.ratio} / ${tm[1]}:${tm[2]})`);
          g.spans.push(Number(tm[2]) * TYPE_Q[tm[3]] * DIV);
        }
        g.acc += dd;
        if (sp) {
          const span = Math.max(...g.spans);
          if (Math.abs(g.acc - span) > 1e-6 && !g.spans.some(x => Math.abs(x - g.acc) < 1e-6)) errs.push(`${where}:連音組總長 ${g.acc / DIV} 拍不是完整的一組(${span / DIV} 拍)`);
          tup[v] = null;
        }
      }
      sums[v] = (sums[v] || 0) + dd; t += d; max = Math.max(max, t);
    }
    for (const [v, g] of Object.entries(tup)) if (g) errs.push(`第 ${i + 1} 小節 聲部 ${v}:連音組沒有結束`);
    for (const [v, s] of Object.entries(sums)) if (Math.abs(s - lens[i]) > 1e-6) errs.push(`第 ${i + 1} 小節 聲部 ${v}:時值 ${s / DIV} 拍 ≠ 拍號 ${lens[i] / DIV} 拍`);
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
    // 裝飾音:一個和弦只有 flam 或 drag 其中一種;開閉 HH 擇一
    const grace = R() < 0.08 ? "flam" : R() < 0.05 ? "drag" : null;
    if (lines === 1) return [{ piece: "snare", accent: R() < 0.3, ghost: R() < 0.1, ...(grace ? { [grace]: true } : {}) }];
    const n = R() < 0.3 ? 2 : 1, set = new Set(); while (set.size < n) set.add(pick(HANDS));
    return [...set].map((piece, i) => { const oc = piece === "hh" ? R() : 1; return { piece, accent: R() < 0.2, ghost: R() < 0.1, ...(grace && (i === 0 || R() < 0.5) ? { [grace]: true } : {}), open: oc < 0.2, closed: oc >= 0.2 && oc < 0.4 }; });
  };
  const footNotes = () => [{ piece: R() < 0.7 ? "kick" : "hhFoot", accent: R() < 0.1 }];
  // 一組(拍)的節奏:一般時值切開,或一組連音
  const groupRhythm = g => {
    if (g === DIV && R() < 0.3) { const c = pick(["8t3", "16t5", "16t6", "16t7", "32t9", "32t10"]), n = Number(c.split("t")[1]); return Array(n).fill(c); }
    // 8t3 與 16t3 混在一拍(一個連音組)
    if (g === DIV && R() < 0.1) return pick([["8t3", "16t3", "16t3", "8t3"], ["16t3", "16t3", "8t3", "8t3"], ["8t3", "8t3", "16t3", "16t3"], ["16t3", "16t3", "16t3", "16t3", "16t3", "16t3"]]);
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
    // 滾奏:手;roll 四分音符以上(沒有連桿)、buzz 八分音符以上(十六分以下不可)
    const rollable = c => /^(1|2\.?|4\.?|4t3)$/.test(c), buzzable = c => !/^(16|32)/.test(c);
    if (!feet && lines === 5) evs.forEach(e => { if (!e.notes) return; if (rollable(e.value) && R() < 0.05) e.roll = 1 + Math.floor(R() * 3); else if (buzzable(e.value) && R() < 0.03) e.buzz = true; });
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
    ["roll 超過 3", S([[{ ...q("snare"), roll: 4 }]])],
    // 開閉 HH
    ["open 寫在小鼓", S([[{ value: "4", notes: [{ piece: "snare", open: true }] }]])],
    ["closed 寫在 Ride", S([[{ value: "4", notes: [{ piece: "ride", closed: true }] }]])],
    ["open 寫在腳踩 HH", S([[], [{ value: "4", notes: [{ piece: "hhFoot", open: true }] }]])],
    ["closed 寫在大鼓", S([[], [{ value: "4", notes: [{ piece: "kick", closed: true }] }]])],
    ["hh 同時 open、closed", S([[{ value: "4", notes: [{ piece: "hh", open: true, closed: true }] }]])],
    ["hhOpen 又寫 closed", S([[{ value: "4", notes: [{ piece: "hhOpen", closed: true }] }]])],
    ["hhClosed 又寫 open", S([[{ value: "4", notes: [{ piece: "hhClosed", open: true }] }]])],
    // Flam / Drag
    ["flam 放在腳", S([[], [{ value: "4", notes: [{ piece: "kick", flam: true }] }]])],
    ["drag 放在腳", S([[], [{ value: "4", notes: [{ piece: "hhFoot", drag: true }] }]])],
    ["同一個音 flam + drag", S([[{ value: "4", notes: [{ piece: "snare", flam: true, drag: true }] }]])],
    ["同一個和弦 flam + drag", S([[{ value: "4", notes: [{ piece: "snare", flam: true }, { piece: "tomHi", drag: true }] }]])],
    // 滾奏
    ["roll 放在腳", S([[], [{ value: "4", notes: [{ piece: "kick" }], roll: 2 }]])],
    ["buzz 放在腳", S([[], [{ value: "4", notes: [{ piece: "kick" }], buzz: true }]])],
    ["roll 在十六分音符", S([[{ value: "16", notes: [{ piece: "snare" }], roll: 1 }]])],
    ["roll 在附點十六分", S([[{ value: "16.", notes: [{ piece: "snare" }], roll: 1 }, { value: "32", notes: [{ piece: "snare" }] }]])],
    ["buzz 在三十二分音符", S([[{ value: "32", notes: [{ piece: "snare" }], buzz: true }]])],
    ["roll 在八分音符", S([[{ value: "8", notes: [{ piece: "snare" }], roll: 1 }, { value: "8", notes: [{ piece: "snare" }] }]])],
    ["roll 在附點八分", S([[{ value: "8.", notes: [{ piece: "snare" }], roll: 2 }, { value: "16", notes: [{ piece: "snare" }] }]])],
    ["roll 在 8t3", S([[...[0, 1, 2].map(i => ({ value: "8t3", notes: [{ piece: "snare" }], ...(i ? {} : { roll: 2 }) }))]])],
    ["buzz 在十六分音符", S([[{ value: "16", notes: [{ piece: "snare" }], buzz: true }]])],
    ["roll 在 16t3", S([[...[0, 1, 2].map(i => ({ value: "16t3", notes: [{ piece: "snare" }], ...(i ? {} : { roll: 2 }) }))]])],
    // 力度
    ["同一個位置兩個力度", S([[q("snare")]], { dyn: [{ m: 0, beat: 0, mark: "f" }, { m: 0, beat: 0, mark: "p" }] })],
    ["同一個位置兩個漸強", S([[q("snare")]], { dyn: [{ m: 0, beat: 0, mark: "cresc" }, { m: 0, beat: 0, mark: "dim" }] })],
    // 連音
    ["tuplet 寫了不認得的值", S([[...[0, 1, 2].map(i => ({ value: "8t3", notes: [{ piece: "snare" }], tuplet: i === 2 ? "end" : undefined }))]])],
    ["一般時值寫 tuplet", S([[{ ...q("snare"), tuplet: "stop" }]])],
    ["連音 stop 時不是完整的一組", S([[{ value: "8t3", notes: [{ piece: "snare" }] }, { value: "8t3", notes: [{ piece: "snare" }], tuplet: "stop" }]])],
    ["混用連音超過一組", S([[{ value: "8t3", notes: [{ piece: "snare" }] }, { value: "8t3", notes: [{ piece: "snare" }] }, { value: "16t3", notes: [{ piece: "snare" }] }, { value: "8t3", notes: [{ piece: "snare" }] }]])],
    // 分組拍號
    ["x/4 寫分組(3+2/4)", S([[q("snare")]], { time: "3+2/4" })],
    ["分組有 4(4+3/8)", S([[q("snare")]], { time: "4+3/8" })]
  ];
  for (const [name, spec] of BAD) { let threw = false; try { scoreXML(spec); } catch (e) { threw = true; } ok(threw, `不合法的資料要丟出錯誤:${name}`); }
  // 5. 混用 8t3 與 16t3:一拍一個連音組(一個「3」)
  const T = (v, o = {}) => ({ value: v, notes: [{ piece: "snare" }], ...o });
  const GOOD = [
    ["[8t3,16t3,16t3,8t3] 一組", [T("8t3"), T("16t3"), T("16t3"), T("8t3")], 1],
    ["[16t3,16t3,8t3,8t3] 一組", [T("16t3"), T("16t3"), T("8t3"), T("8t3")], 1],
    ["[8t3,8t3,16t3,16t3] 一組", [T("8t3"), T("8t3"), T("16t3"), T("16t3")], 1],
    ["[4t3,8t3] 一拍一組", [T("4t3"), T("8t3")], 1],
    ["[4t3 ×3] 兩拍一組", [T("4t3"), T("4t3"), T("4t3")], 1],
    ["[4t3,8t3,8t3,4t3] 一拍一組 × 2", [T("4t3"), T("8t3"), T("8t3"), T("4t3")], 2],
    ["[4t3,8t3(continue),8t3,4t3] 兩拍一組", [T("4t3"), T("8t3", { tuplet: "continue" }), T("8t3"), T("4t3")], 1],
    ["16t3 ×3 兩組", [T("16t3"), T("16t3"), T("16t3"), T("16t3"), T("16t3"), T("16t3")], 2],
    ["continue:[16t3 ×3(continue),16t3,8t3] 一組", [T("16t3"), T("16t3"), T("16t3", { tuplet: "continue" }), T("16t3"), T("8t3")], 1],
    ["stop:[8t3,16t3(stop)] + 16t3 ×3 兩組", [T("8t3"), T("16t3", { tuplet: "stop" }), T("16t3"), T("16t3"), T("16t3")], 2],
    ["休止在混用連音裡", [T("8t3"), { value: "r16t3" }, T("16t3"), T("8t3")], 1]
  ];
  for (const [name, evs, groups] of GOOD) {
    const spec = { key, time: "4/4", measures: [{ voices: [evs] }] };
    let errs, xml = "";
    try { xml = scoreXML(spec); errs = auditXML(xml, spec); } catch (e) { errs = [e.message]; }
    ok(!errs.length, `連音 ${name}:${errs.join(";")}`);
    ok((xml.match(/<tuplet type="start"/g) || []).length === groups, `連音 ${name}:應該 ${groups} 組,XML 有 ${(xml.match(/<tuplet type="start"/g) || []).length} 組`);
  }
  // auditXML 自己重算時值:<duration> 被改掉要抓得到;連音組總長不對要抓得到
  {
    const spec = { key, time: "4/4", measures: [{ voices: [[T("8t3"), T("16t3"), T("16t3"), T("8t3")]] }] }, xml = scoreXML(spec);
    ok(auditXML(xml.replace("<duration>840</duration>", "<duration>841</duration>"), spec).some(e => /重算/.test(e)), "auditXML:<duration> 跟重算的不一樣要抓得到");
    ok(auditXML(xml.replace(/<normal-type>16th<\/normal-type>/g, "<normal-type>eighth</normal-type>").replace(/<type>16th<\/type>/g, "<type>eighth</type>"), spec).length > 0, "auditXML:連音的 type 改掉要抓得到");
    ok(auditXML(xml.replace('<tuplet type="stop"/>', ""), spec).some(e => /連音組/.test(e)), "auditXML:連音組沒有結束要抓得到");
  }
  // 連結線接續的開 HH:只有第一個音有 <open/>;閉 HH 也一樣
  for (const [mk, tag] of [["open", "<open "], ["closed", "<stopped "]]) {
    const spec = { key, time: "4/4", measures: [{ voices: [[{ value: "2", notes: [{ piece: "hh", [mk]: true }], tie: true }, { value: "4", notes: [{ piece: "hh", [mk]: true }] }]] }] };
    let xml = ""; try { xml = scoreXML(spec); } catch (e) { ok(false, `連結線的 ${mk} HH:${e.message}`); }
    ok((xml.match(new RegExp(tag, "g")) || []).length === 1, `連結線接續的 ${mk} HH 只在第一個音畫(現在 ${(xml.match(new RegExp(tag, "g")) || []).length} 個)`);
    const spec2 = { key, time: "4/4", measures: [{ voices: [[{ value: "2", notes: [{ piece: mk === "open" ? "hhOpen" : "hhClosed" }], tie: true }, { value: "2", notes: [{ piece: mk === "open" ? "hhOpen" : "hhClosed" }] }]] }] };
    try { xml = scoreXML(spec2); } catch (e) { xml = ""; ok(false, `連結線的 ${mk} HH(鼓件):${e.message}`); }
    ok((xml.match(new RegExp(tag, "g")) || []).length === 1, `連結線接續的 ${mk === "open" ? "hhOpen" : "hhClosed"} 只在第一個音畫`);
  }
  // 滾奏斜線(roll)在四分音符以上可以;多次反彈(buzz)在八分音符、8t3、二連音也可以
  for (const [v, k] of [["4", "roll"], ["4.", "roll"], ["4t3", "roll"], ["2", "roll"], ["1", "roll"], ["8", "buzz"], ["8.", "buzz"], ["8t3", "buzz"], ["4", "buzz"]]) {
    const n = /t3$/.test(v) ? 3 : 1, spec = { key, time: "4/4", measures: [{ voices: [Array(n).fill(0).map(() => ({ value: v, notes: [{ piece: "snare" }], ...(k === "roll" ? { roll: 2 } : { buzz: true }) }))] }] };
    let errs; try { errs = auditXML(scoreXML(spec), spec); } catch (e) { errs = [e.message]; }
    ok(!errs.length, `${k === "roll" ? "滾奏斜線" : "多次反彈"}在 ${v}:${errs.join(";")}`);
  }
  // hideEmpty:空的聲部整小節休止不印(<note print-object="no">),時值照算;沒寫 hideEmpty 照常印
  {
    const hand = Array(8).fill(0).map(() => ({ value: "8", notes: [{ piece: "hh" }] }));
    const spec = { key, time: "3/4", measures: [{ voices: [hand.slice(0, 6), [{ value: "4", notes: [{ piece: "kick" }] }]] }, { voices: [hand.slice(0, 6), []], hideEmpty: true }, { voices: [hand.slice(0, 6), []] }] };
    let xml = "", errs; try { xml = scoreXML(spec); errs = auditXML(xml, spec); } catch (e) { errs = [e.message]; }
    ok(!errs.length, `hideEmpty:${errs.join(";")}`);
    const hidden = xml.match(/<note print-object="no">[\s\S]*?<\/note>/g) || [];
    ok(hidden.length === 1 && /<rest measure="yes">/.test(hidden[0]) && /<voice>2<\/voice>/.test(hidden[0]) && /<duration>7560<\/duration>/.test(hidden[0]), `hideEmpty:第 2 小節腳的整小節休止不印(${hidden.length} 個)`);
    ok((xml.match(/<note><rest measure="yes">/g) || []).length === 1, "hideEmpty:第 3 小節沒寫 hideEmpty 照常印整小節休止");
  }
  // 交給 OSMD 的版本:<open/> → <open-string/>(其他不動)
  {
    const xml = scoreXML({ key, time: "4/4", measures: [{ voices: [[{ value: "4", notes: [{ piece: "hh", open: true }] }]] }] }), ox = osmdXML(xml);
    ok(/<open placement="above"\/>/.test(xml) && !/<open[ /]/.test(ox) && /<open-string placement="above"\/>/.test(ox) && ox.length === xml.length + 7, "osmdXML:<open/> 換成 <open-string/>");
  }
  // 圖例的出處小字(legendSrc):照 srcs[…].short;DK 寫明「Trinity DK」;沒有 undefined;單線譜的小鼓第二行「單線譜為 App 的選擇」
  const srcText = ls => ls.lines.map(l => l.join("|")).join("/");
  for (const id of Object.keys(key.pieces)) {
    const ls = legendSrc(key, id, 5), t = srcText(ls), p = key.pieces[id];
    ok(ls.lines.length >= 1 && ls.lines.length <= 2 && ls.lines.every(l => Array.isArray(l) && l.length === 2 && l.every(x => typeof x === "string" && x)), `圖例 ${id} 出處:${t}`);
    ok(!/undefined|null|NaN/.test(t) && !/Trinity p\./.test(t), `圖例 ${id} 出處不能有 undefined、不能寫成「Trinity p.」:${t}`);
    ok(same(ls.lines[0], key.srcs[p.src].short), `圖例 ${id} 出處第一行要照 srcs.${p.src}.short:${t}`);
    if (p.src === "trinity-dk-p107") ok(ls.lines[0][0] === "Trinity DK p.107" && same(ls.lines[1], ["位置待核對", "Pos. pending"]) && ls.pending, `圖例 ${id}:Trinity DK p.107 + 位置待核對:${t}`);
    if (p.src === "pending-pas-weinberg") ok(same(ls.lines, [["待核對", "Pending"]]) && ls.pending, `圖例 ${id}:待核對:${t}`);
    if (id === "rideBell") ok(same(ls.lines, [["Trinity 勘誤", "Trinity errata"]]) && !ls.pending, `圖例 Ride bell 寫「Trinity 勘誤」:${t}`);
    ok(!ls.wide, `圖例 ${id}:五線的格子是一般寬`);
  }
  {
    const ls = legendSrc(key, "snare", 1);
    ok(same(ls.lines, [["RSL p.31–43", "RSL p.31–43"], ["單線譜為 App 的選擇", "1-line: App's choice"]]) && !ls.pending && ls.wide, `圖例 單線譜小鼓:${srcText(ls)}`);
  }
  // 之後 src 改成 PAS 指南(不是待核對了):出處寫 PAS 的 short、沒有第二行、沒有 undefined;沒有 short 的出處用 label
  {
    const k2 = JSON.parse(JSON.stringify(key));
    k2.srcs["pas-weinberg"] = { pending: false, label: ["PAS 鼓組記譜指南 p.12", "PAS drumset guide p.12"], short: ["PAS 指南 p.12", "PAS guide p.12"], p: "12" };
    k2.srcs["no-short"] = { pending: false, label: ["某官方資料 p.3", "Some doc p.3"], p: "3" };
    for (const p of Object.values(k2.pieces)) { if (p.src === "pending-pas-weinberg") p.src = "pas-weinberg"; if (p.posSrc) p.posSrc = "pas-weinberg"; }
    for (const id of Object.keys(k2.pieces)) {
      const ls = legendSrc(k2, id, 5), t = srcText(ls);
      ok(!/undefined|null|NaN/.test(t) && !ls.pending && ls.lines.length === 1, `圖例(src 改成 PAS 指南後)${id}:${t}`);
      if (key.pieces[id].src === "pending-pas-weinberg") ok(same(ls.lines[0], ["PAS 指南 p.12", "PAS guide p.12"]), `圖例(src 改成 PAS 指南後)${id} 寫 PAS:${t}`);
    }
    k2.pieces.kick.src = "no-short";
    ok(same(legendSrc(k2, "kick", 5).lines, [["某官方資料 p.3", "Some doc p.3"]]), "圖例:沒有 short 的出處用 label");
    k2.pieces.kick.src = "missing";
    ok(same(legendSrc(k2, "kick", 5).lines, [["待核對", "Pending"]]) && legendSrc(k2, "kick", 5).pending, "圖例:找不到出處 = 待核對");
  }
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
