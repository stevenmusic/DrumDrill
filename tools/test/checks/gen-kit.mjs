// RSL 4–5 級整組鼓視奏出題器(js/shared/kitgen.js)+ 共用的播放事件(js/shared/kitevents.js toEvents)的檢查,verify.mjs 會呼叫;
// 也可以單獨跑:node tools/test/checks/gen-kit.mjs(KIT_SEEDS=100 可以少跑一點)
// 每一級 1000 個種子:
// 1. 只用白名單:這裡另外手抄了大綱的表(RSL p.48、53 / docs/sources/rsl-drums.md §4.1;不從資料檔複製,反過來跟資料檔核對):
//    時值 ♩ ♩. ♪ ♪. ♬、休止符 𝄽 𝄾、4/4、8 小節、♩ 範圍;附點八分只出現在「8. 16」「16 8.」(同一拍);鼓件只有整組鼓的 8 個(推估);
//    不寫力度、重音、開閉 HH、鬼音、裝飾音、滾奏、連結線
// 2. 每小節每個聲部的時值:自己的表重算 = 4 拍;MusicXML 用 kitxml.mjs 的 auditXML 再算一次;MusicXML 收到的時值 / 休止符也在白名單
// 3. 自由發展:剛好 2 小節、在最後(slash);MusicXML 斜線符頭 = 2 × 4 個;寫出來的小節手、腳都有音
// 4. 播放事件 = MusicXML 的音(xmlevents.mjs 只看 MusicXML 算拍位與鼓件);自由發展的小節不出聲
// 5. 同一個種子同一題;速度是整數、在官方範圍;白名單每個時值、休止符、鼓件在 1000 題裡至少出現一次
// 6. toEvents 共用:Trinity Playback(playbackgen.js)每級 200 題 + 每一句單獨的譜,事件 = MusicXML(連音、連結線、換拍號、Flam / Drag 裝飾音);
//    力度音量表 = player.js 的 DYN_VEL;漸強漸弱、sfz、重音、幽靈音的音量方向對;
//    沒寫力度 = 鼓件預設音量(PIECE_VEL,練習設定;這裡手抄 docs/GENERATORS.md §4 的表核對):drumkey 13 個鼓件都有、鈸比鼓小聲、Crash 最大聲;
//    RSL 整組鼓視奏與 Trinity Initial(沒有力度記號)每個音 = 表上的音量;給了 opts.dyn 就全部用那一級
// 7. 竄改:白名單外的時值 / 休止符 / 鼓件、附點八分跨拍、自由發展不在最後、事件錯位、自由發展出聲、速度超出範圍 → 一定抓到
import fs from "node:fs";
import { genRslKit, NOTES } from "../../../js/shared/kitgen.js";
import { toEvents, hitsOnly, graceBeats, DYN_VEL, PIECE_VEL, GRACE_MUL, EVENT_NOTES } from "../../../js/shared/kitevents.js";
import { genChart, playbackParams, phraseSpec } from "../../../js/shared/playbackgen.js";
import { scoreXML } from "../../../js/shared/kitnotation.js";
import { auditXML } from "./kitxml.mjs";
import { xmlEvents, xmlCodes, evKey, evDiff } from "./xmlevents.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + "data/exam-rsl.json", "utf8"));
const trinity = JSON.parse(fs.readFileSync(root + "data/exam-trinity.json", "utf8"));
const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));
const SEEDS = Number(process.env.KIT_SEEDS) || 1000;

/* 手抄(RSL p.48、53):4、5 級整組鼓視奏 */
const WL = {
  4: { bars: 8, dev: 2, time: "4/4", values: ["4", "4.", "8", "8.", "16"], rests: ["r4", "r8"], bpm: [80, 90] },
  5: { bars: 8, dev: 2, time: "4/4", values: ["4", "4.", "8", "8.", "16"], rests: ["r4", "r8"], bpm: [80, 120] }
};
const KIT = ["hh", "ride", "crash", "snare", "tomHi", "tomMid", "tomFloor", "kick"];   // 整組鼓(推估;NOTES.kitPieces)
/* 手抄 docs/GENERATORS.md §4:沒寫力度時的鼓件預設音量(練習設定);gen-ear.mjs 也用 */
export const PIECE_VEL_DOC = {
  hh: 0.55, hhClosed: 0.55, hhOpen: 0.6, hhFoot: 0.5, ride: 0.6, rideBell: 0.65, crash: 0.85,
  snare: 0.75, xstick: 0.7, kick: 0.75, tomHi: 0.75, tomMid: 0.75, tomFloor: 0.75
};
/* 沒有力度記號的譜:每個音(不含裝飾音)= 鼓件預設音量(重音 +0.2、幽靈音 ×0.4) */
export function pieceVelErrs(events){
  const bad = hitsOnly(events).filter(e => {
    let v = PIECE_VEL_DOC[e.piece]; if (v == null) return true;
    if (e.accent) v = Math.min(1, v + 0.2); if (e.ghost) v *= 0.4;
    return Math.abs(e.vel - Math.round(v * 1000) / 1000) > 1e-9;
  });
  return bad.length ? [`沒寫力度的音量不是鼓件預設音量:${bad.slice(0, 3).map(e => `${e.piece}@${e.beat}=${e.vel}`).join("、")}`] : [];
}
const D = 2520, QV = { "4": 1, "4.": 1.5, "8": 0.5, "8.": 0.75, "16": 0.25, "2": 2, "1": 4, "16.": 0.375, "32": 0.125 };
const dur = c => Math.round(QV[c.replace(/^r/, "")] * D);
const MARKS = ["accent", "ghost", "open", "closed", "flam", "drag"];

/* 一題的檢查 → 錯誤清單;used 收集用到的元素 */
export function checkKit(g, q, used = { value: new Set(), rest: new Set(), piece: new Set() }){
  const errs = [], E = s => errs.push(s), W = WL[g];
  const ms = q.spec.measures;
  if (q.spec.time !== W.time || q.time !== W.time) E(`拍號 ${q.spec.time}(應該 ${W.time})`);
  if (q.spec.lines !== 5) E("要是五線譜");
  if (ms.length !== W.bars || q.bars !== W.bars) E(`小節數 ${ms.length}(應該 ${W.bars})`);
  if (q.spec.dyn && q.spec.dyn.length) E("不寫力度記號(大綱沒列)");
  if (!(Number.isInteger(q.bpm) && q.bpm >= W.bpm[0] && q.bpm <= W.bpm[1])) E(`速度 ${q.bpm} 不在 ${W.bpm.join("–")}`);
  // 自由發展:剛好 2 小節、在最後
  const slashAt = ms.map((m, i) => (m.slash ? i : -1)).filter(i => i >= 0);
  if (slashAt.join() !== [W.bars - 2, W.bars - 1].join()) E(`自由發展的小節在 ${slashAt.map(i => i + 1).join("、") || "沒有"}(應該是最後 2 小節)`);
  if (!q.develop || q.develop.from !== W.bars - W.dev || q.develop.bars !== W.dev) E("develop 欄位不對");
  ms.forEach((m, mi) => {
    if (m.time) E(`第 ${mi + 1} 小節換拍號`);
    if (m.slash) return;
    if (!m.voices || m.voices.length !== 2) { E(`第 ${mi + 1} 小節:要有手、腳兩個聲部`); return; }
    m.voices.forEach((v, vi) => {
      const who = `第 ${mi + 1} 小節 ${vi ? "腳" : "手"}`;
      if (!v.some(e => e.notes)) E(`${who}:整小節沒有音`);
      let p = 0;
      v.forEach((e, ei) => {
        const where = `${who} 第 ${ei + 1} 個`, rest = e.value[0] === "r", code = rest ? e.value.slice(1) : e.value;
        if (!(code in QV)) { E(`${where}:時值 ${e.value} 不認得`); return; }
        if (rest) { used.rest.add(e.value); if (!W.rests.includes(e.value)) E(`${where}:休止符 ${e.value} 不在 ${g} 級白名單`); }
        else { used.value.add(code); if (!W.values.includes(code)) E(`${where}:時值 ${code} 不在 ${g} 級白名單`); }
        if (e.tie || e.roll || e.buzz || e.tuplet) E(`${where}:不寫連結線、滾奏、連音`);
        // 附點八分只配十六分:同一拍裡剛好「8. 16」或「16 8.」
        if (code === "8.") {
          const prev = v[ei - 1], next = v[ei + 1], pv = prev && prev.value.replace(/^r/, ""), nv = next && next.value.replace(/^r/, "");
          const okA = p % D === 0 && nv === "16" && next.value[0] !== "r", okB = p % D === D / 4 && pv === "16" && prev.value[0] !== "r";
          if (!okA && !okB) E(`${where}:附點八分要跟十六分音符在同一拍(8. 16 或 16 8.),位置 ${p / D} 拍`);
        }
        for (const n of e.notes || []) {
          used.piece.add(n.piece);
          if (!KIT.includes(n.piece)) E(`${where}:鼓件 ${n.piece} 不在整組鼓(${KIT.join(" ")})`);
          if (vi === 0 && n.piece === "kick") E(`${where}:大鼓要在腳的聲部`);
          if (vi === 1 && n.piece !== "kick") E(`${where}:腳的聲部只有大鼓(${n.piece})`);
          for (const k of MARKS) if (n[k]) E(`${where}:不寫 ${k}(大綱只列時值)`);
        }
        p += dur(e.value);
      });
      if (p !== 4 * D) E(`${who}:時值加起來 ${p / D} 拍 ≠ 4 拍`);
    });
  });
  // 說明 key
  for (const k of q.notes) if (!NOTES[k]) E(`說明 key ${k} 沒有文字`);
  for (const k of ["kitPieces", "developEnd"]) if (!q.notes.includes(k) || NOTES[k].kind !== "assumed") E(`要標推估:${k}`);
  // MusicXML
  let xml;
  try { xml = scoreXML({ ...q.spec, key }); } catch (e) { E("scoreXML:" + e.message); return errs; }
  for (const a of auditXML(xml, q.spec)) E("MusicXML:" + a);
  const X = xmlCodes(xml);
  for (const c of X.values) if (!W.values.includes(c)) E(`MusicXML 時值 ${c} 不在白名單`);
  for (const c of X.rests) if (!W.rests.includes(c)) E(`MusicXML 休止符 ${c} 不在白名單`);
  // 播放事件 = MusicXML 的音;自由發展不出聲
  const XE = xmlEvents(xml, key, 5);
  if (XE.slash.length !== W.dev * 4) E(`MusicXML 斜線符頭 ${XE.slash.length} 個(應該 ${W.dev * 4})`);
  const hits = hitsOnly(q.events);
  if (evKey(hits) !== evKey(XE.hits)) E("播放事件 ≠ MusicXML:" + evDiff(hits, XE.hits).join("、"));
  const devStart = (W.bars - W.dev) * 4;
  if (q.events.some(e => e.beat >= devStart - 1e-9)) E("自由發展的小節有出聲的事件");
  if (q.events.some(e => !(e.vel > 0 && e.vel <= 1))) E("事件音量不在 0–1");
  errs.push(...pieceVelErrs(q.events));
  if (!q.notes.includes("pieceVel")) E("要說明鼓件預設音量(pieceVel,練習設定)");
  if (q.lenBeats !== W.bars * 4) E(`lenBeats ${q.lenBeats}(應該 ${W.bars * 4})`);
  return errs;
}

/* toEvents 對任何鼓組譜:事件 = MusicXML(含裝飾音數量與提前量) */
export function checkEvents(spec, events, bpm, lines = 5){
  const errs = [];
  let xml;
  try { xml = scoreXML({ ...spec, key }); } catch (e) { return ["scoreXML:" + e.message]; }
  const XE = xmlEvents(xml, key, lines), hits = hitsOnly(events), gr = events.filter(e => e.grace).map(e => e.beat).sort((a, b) => a - b);
  if (evKey(hits) !== evKey(XE.hits)) errs.push("事件 ≠ MusicXML:" + evDiff(hits, XE.hits).join("、"));
  const xg = XE.graces.slice().sort((a, b) => a - b), gb = graceBeats(bpm);
  if (gr.length !== xg.length) errs.push(`裝飾音 ${gr.length} 個,MusicXML 有 ${xg.length} 個`);
  else for (let i = 0; i < gr.length; i++) { const d = xg[i] - gr[i]; if (!(d > 1e-6 && d <= 2 * gb + 1e-3)) { errs.push(`裝飾音提前 ${d.toFixed(4)} 拍(應該 0–${(2 * gb).toFixed(3)})`); break; } }
  if (XE.slash.length && events.some(e => XE.slash.some(s => e.beat >= s - 1e-9 && e.beat < s + 1 - 1e-9))) errs.push("斜線小節有出聲");
  if (events.some(e => !(e.vel > 0 && e.vel <= 1))) errs.push("音量不在 0–1");
  return errs;
}

export default function check(ok){
  // 手抄的表 = 資料檔(反過來核對資料檔沒被改壞)
  for (const g of [4, 5]) {
    const s = data.sight[g], W = WL[g];
    ok(s.type === "kit" && s.bars === W.bars && s.time.v === W.time && s.develop.bars === W.dev && JSON.stringify(s.values) === JSON.stringify(W.values) &&
      JSON.stringify(s.rests) === JSON.stringify(W.rests) && s.bpm.join() === W.bpm.join() && s.develop.pos.v === "end" && s.develop.pos.assumed === true,
      `exam-rsl.json sight[${g}] 跟手抄的大綱表(RSL p.${g === 4 ? 48 : 53})不一樣`);
  }
  for (const g of [4, 5]) {
    const used = { value: new Set(), rest: new Set(), piece: new Set() }, bpms = new Set();
    let bad = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let q;
      try { q = genRslKit(data.sight[g], seed, g); } catch (e) { bad++; if (bad <= 3) ok(false, `RSL 整組鼓 ${g} 級 #${seed}:${e.message}`); continue; }
      const errs = checkKit(g, q, used);
      bpms.add(q.bpm);
      if (seed % 50 === 0 && JSON.stringify(genRslKit(data.sight[g], seed, g)) !== JSON.stringify(q)) errs.push("同一個種子產生不同的題目");
      if (errs.length) { bad++; if (bad <= 3) ok(false, `RSL 整組鼓 ${g} 級 #${seed}:${errs.slice(0, 4).join(";")}`); }
    }
    ok(bad === 0, `RSL 整組鼓 ${g} 級:${SEEDS} 題有 ${bad} 題不合規則`);
    const W = WL[g], miss = [...W.values.filter(x => !used.value.has(x)), ...W.rests.filter(x => !used.rest.has(x)), ...KIT.filter(x => !used.piece.has(x))];
    ok(!miss.length, `RSL 整組鼓 ${g} 級:白名單裡沒出現過的元素 ${miss.join("、")}`);
    ok(SEEDS < 200 || (bpms.has(W.bpm[0]) && bpms.has(W.bpm[1])), `RSL 整組鼓 ${g} 級:速度沒有用到範圍的兩端(${[...bpms].sort().join(",")})`);
  }
  // 竄改:檢查本身抓得到錯
  {
    const base = genRslKit(data.sight[4], 7, 4), u = { value: new Set(), rest: new Set(), piece: new Set() };
    const tamper = (fn, re, msg) => { const q = structuredClone(base); fn(q); ok(checkKit(4, q, u).some(e => re.test(e)), "檢查本身:" + msg); };
    const hand = q => q.spec.measures[0].voices[0];
    tamper(q => { hand(q).splice(0, hand(q).length, { value: "2", notes: [{ piece: "snare" }] }, { value: "2", notes: [{ piece: "snare" }] }); }, /時值 2 不在/, "二分音符要抓到");
    tamper(q => { hand(q).splice(0, hand(q).length, { value: "r16" }, { value: "16", notes: [{ piece: "snare" }] }, { value: "8", notes: [{ piece: "snare" }] }, { value: "4", notes: [{ piece: "snare" }] }, { value: "r4" }, { value: "4", notes: [{ piece: "snare" }] }); }, /休止符 r16 不在/, "十六分休止符要抓到");
    tamper(q => { hand(q)[0].notes = [{ piece: "rideBell" }]; }, /rideBell 不在整組鼓/, "Ride 碗要抓到");
    tamper(q => { hand(q).splice(0, hand(q).length, ...["8", "8.", "16", "8", "4", "4"].map(v => ({ value: v, notes: [{ piece: "snare" }] }))); }, /附點八分要跟十六分/, "附點八分跨拍要抓到");
    tamper(q => { const m = q.spec.measures; [m[5], m[6]] = [m[6], m[5]]; }, /自由發展的小節在/, "自由發展不在最後要抓到");
    tamper(q => { q.events[3].beat += 0.25; }, /播放事件 ≠ MusicXML/, "事件錯位要抓到");
    tamper(q => { q.events.push({ beat: 26, piece: "snare", vel: 0.7 }); }, /自由發展的小節有出聲|播放事件 ≠/, "自由發展出聲要抓到");
    tamper(q => { q.bpm = 95; }, /速度 95 不在/, "4 級 ♩=95 要抓到");
    tamper(q => { q.events.forEach(e => { e.vel = 0.7; }); }, /不是鼓件預設音量/, "沒寫力度卻全部 mf(0.7)要抓到");
    tamper(q => { hand(q)[0].notes[0].accent = true; }, /不寫 accent/, "重音要抓到");
    tamper(q => { q.spec.measures[2].voices[1] = [{ value: "r4" }, { value: "r4" }, { value: "r4" }, { value: "r4" }]; }, /整小節沒有音/, "腳整小節空白要抓到");
    // 5 級的題目拿 4 級檢查:速度超過 90 的一定抓到
    let caught = 0, need = 0;
    for (let seed = 1; seed <= 100; seed++) { const q = genRslKit(data.sight[5], seed, 5); if (q.bpm > 90) { need++; if (checkKit(4, q).length) caught++; } }
    ok(need > 0 && caught === need, `檢查本身:5 級(♩>90)當 4 級檢查 ${need} 題只抓到 ${caught} 題`);
    let threw = false; try { genRslKit(data.sight[3], 1, 3); } catch (e) { threw = true; } ok(threw, "genRslKit 給小鼓視奏的參數應該丟出錯誤");
  }

  // toEvents 共用:Trinity Playback 每一級 200 題(整份 + 每一句單獨)
  const PB = Math.min(SEEDS, 200);
  for (let g = 0; g <= 8; g++) {
    const P = playbackParams(g, trinity);
    let bad = 0, graces = 0, ties = 0;
    for (let seed = 1; seed <= PB; seed++) {
      const c = genChart(P, seed), bpm = 60 + (seed % 7) * 15;
      const errs = checkEvents(c.spec, toEvents(c.spec, { bpm }), bpm);
      c.phrases.forEach((ph, i) => { const ps = phraseSpec(c, i); errs.push(...checkEvents(ps, toEvents(ps, { bpm }), bpm).map(e => `第 ${i + 1} 句:${e}`)); });
      graces += toEvents(c.spec, { bpm }).filter(e => e.grace).length;
      if (g === 0) errs.push(...pieceVelErrs(toEvents(c.spec, { bpm })));   // Initial 沒有力度記號
      ties += c.spec.measures.reduce((s, m) => s + m.voices.flat().filter(e => e.tie).length, 0);
      if (errs.length) { bad++; if (bad <= 3) ok(false, `toEvents × Trinity ${g} 級 #${seed}:${errs.slice(0, 3).join(";")}`); }
    }
    ok(bad === 0, `toEvents × Trinity Playback ${g} 級:${PB} 題有 ${bad} 題事件跟 MusicXML 不一樣`);
    if (g >= 4) ok(graces > 0, `toEvents × Trinity ${g} 級:應該有 Flam / Drag 的裝飾音`);
    if (g >= 2) ok(ties > 0, `toEvents × Trinity ${g} 級:應該有連結線(檢查接續的音不出聲)`);
  }
  // 力度音量表 = player.js 的 DYN_VEL(練習設定;兩邊要一樣)
  {
    const src = fs.readFileSync(root + "js/shared/player.js", "utf8"), m = /export const DYN_VEL = (\{[^}]*\})/.exec(src);
    let pv = null; try { pv = Function("return " + m[1])(); } catch (e) {}
    ok(pv && JSON.stringify(pv) === JSON.stringify(DYN_VEL), "kitevents 的 DYN_VEL 跟 player.js 不一樣");
    ok(JSON.stringify(DYN_VEL) === JSON.stringify({ pp: 0.25, p: 0.4, mp: 0.55, mf: 0.7, f: 0.85, ff: 1.0 }), "DYN_VEL 跟 STAGES.md 的表(pp .25 … ff 1.0)不一樣");
    const sn = (v, x = {}) => ({ value: v, notes: [{ piece: "snare", ...x }] });
    const spec = { lines: 5, time: "4/4", measures: [{ voices: [[sn("4"), sn("4"), sn("4"), sn("4")]] }, { voices: [[sn("4"), sn("4", { accent: true }), sn("4", { ghost: true }), sn("4")]] }, { voices: [[sn("4"), sn("4"), sn("4"), sn("4")]] }],
      dyn: [{ m: 0, beat: 0, mark: "p" }, { m: 0, beat: 0, mark: "cresc" }, { m: 1, beat: 0, mark: "f" }, { m: 1, beat: 3, mark: "sfz" }, { m: 2, beat: 0, mark: "dim" }] };
    const v = toEvents(spec).map(e => e.vel);
    ok(v[0] === DYN_VEL.p && v[1] > v[0] && v[2] > v[1] && v[3] > v[2] && v[3] < DYN_VEL.f, `漸強:p → f 要一路變大(${v.slice(0, 5).join(" ")})`);
    ok(v[4] === DYN_VEL.f && v[5] > DYN_VEL.f && v[6] < DYN_VEL.f && v[7] === 1, `重音 > f、幽靈音 < f、sfz = 1(${v.slice(4, 8).join(" ")})`);
    ok(v[8] === DYN_VEL.f && v[11] < v[8] && v[11] > DYN_VEL.mf, `漸弱沒有接力度:f 往 mf 變小(${v.slice(8).join(" ")})`);
    const tie = toEvents({ lines: 5, time: "4/4", measures: [{ voices: [[sn("2"), { ...sn("4"), tie: true }]] }, { voices: [[sn("4"), sn("4"), sn("2")]] }] });
    ok(tie.length === 4 && !tie.some(e => e.beat === 4), "跨小節的連結線:接續的音不出聲");
    const fl = toEvents({ lines: 5, time: "4/4", measures: [{ voices: [[sn("4", { flam: true }), sn("4", { drag: true })]] }] }, { bpm: 60 });
    const gb = graceBeats(60);
    ok(fl.filter(e => e.grace).map(e => e.beat).join() === [-gb, 1 - 2 * gb, 1 - gb].map(x => +x.toFixed(6)).join() && Math.abs(gb - 0.032) < 1e-9, `Flam / Drag 裝飾音提前 32 ms(♩=60:${fl.filter(e => e.grace).map(e => e.beat).join(",")})`);
    ok(graceBeats(300) === 0.1, "快速時裝飾音最多提前 1/10 拍");
    const hh = toEvents({ lines: 5, time: "4/4", measures: [{ voices: [[{ value: "4", notes: [{ piece: "hh", open: true }] }, { value: "4", notes: [{ piece: "hh", closed: true }] }, { value: "4", notes: [{ piece: "hh" }] }, { value: "4", notes: [{ piece: "hhOpen" }] }]] }] });
    ok(hh.map(e => e.piece).join() === "hhOpen,hhClosed,hh,hhOpen", "開閉 HH 對應 hhOpen / hhClosed:" + hh.map(e => e.piece).join());
    // 鼓件預設音量(沒寫力度;練習設定)
    const P = PIECE_VEL_DOC, keyIds = Object.keys(key.pieces);
    ok(JSON.stringify(PIECE_VEL) === JSON.stringify(P), "kitevents 的 PIECE_VEL 跟 docs/GENERATORS.md §4 的表不一樣");
    ok(keyIds.every(id => PIECE_VEL[id] > 0 && PIECE_VEL[id] <= 1) && Object.keys(PIECE_VEL).every(id => keyIds.includes(id)), "PIECE_VEL 要剛好涵蓋 drumkey.json 的鼓件(0–1)");
    const cymMax = Math.max(P.hh, P.hhOpen, P.ride, P.rideBell), drumMin = Math.min(P.snare, P.kick, P.tomHi, P.tomMid, P.tomFloor);
    ok(cymMax < drumMin && P.hhFoot <= P.hh && P.crash > drumMin && P.xstick < P.snare, "鼓件預設音量要有層次:HH / Ride < 鼓、腳踩 HH ≤ HH、Crash 最大聲、cross stick < 小鼓");
    ok(EVENT_NOTES.pieceVel && EVENT_NOTES.pieceVel.kind === "practice", "鼓件預設音量要標練習設定(EVENT_NOTES.pieceVel)");
    const all = Object.keys(P).filter(id => id !== "hhClosed" && id !== "hhOpen");
    const pvs = { lines: 5, time: "4/4", measures: [{ voices: [all.slice(0, 4).map(id => ({ value: "4", notes: [{ piece: id }] }))] }, { voices: [all.slice(4, 8).map(id => ({ value: "4", notes: [{ piece: id }] }))] },
      { voices: [all.slice(8).concat(["snare"]).slice(0, 4).map(id => ({ value: "4", notes: [{ piece: id }] }))] },
      { voices: [[sn("4", { accent: true }), sn("4", { ghost: true }), { value: "4", notes: [{ piece: "hh", open: true }] }, sn("4", { flam: true })]] }] };
    const ev = toEvents(pvs, { bpm: 90 });
    ok(!pieceVelErrs(ev).length && ev.filter(e => e.grace).every(e => e.vel === Math.round(P.snare * GRACE_MUL * 1000) / 1000), "沒寫力度:每個鼓件用預設音量(含重音、幽靈音、開 HH、Flam 裝飾音)" + pieceVelErrs(ev).join(""));
    const half = toEvents({ ...pvs, dyn: [{ m: 2, beat: 0, mark: "f" }] }, { bpm: 90 });
    ok(half.filter(e => e.m < 2).every(e => e.vel === P[e.piece]) && half.filter(e => e.m === 2 && !e.grace).every(e => e.vel === DYN_VEL.f), "力度記號以前用鼓件預設音量、以後全部照力度記號");
    ok(toEvents(pvs, { bpm: 90, dyn: "mf" }).filter(e => e.m < 3).every(e => e.vel === DYN_VEL.mf), "給了 opts.dyn = 沒寫力度的地方全部用那一級");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 全部通過(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
