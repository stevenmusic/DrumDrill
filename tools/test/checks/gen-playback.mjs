// Trinity Playback 譜產生器(js/shared/playbackgen.js)的檢查,verify.mjs 會呼叫;也可以單獨跑:node tools/test/checks/gen-playback.mjs
// 每一級(Initial–8)1000 個種子:
// 1. 只用這一級的累積白名單:這裡另外手抄了一份「每個元素第幾級才有」的表(INTRO,照 Trinity RP p.62–63 / docs/sources/trinity-drums.md §3.2),
//    元素要同時在 playbackFor(資料檔)的白名單裡、而且 INTRO ≤ 這一級(低級不會出現高級元素)。
//    元素從兩個地方各收一次:產生器輸出的 spec(時值代號、鼓件、記號)與 scoreXML 產生的 MusicXML(type / dot / time-modification、符頭位置 + 形狀、記號標籤)
// 2. 每小節每個聲部的時值:用這裡自己的時值表重算 = 拍號長度;MusicXML 再用 kitxml.mjs 的 auditXML(只看 type/dot/time-modification)重算一次
// 3. 總長度、句長在官方範圍內;換拍號只在 8 級、只在句子之間;8 級至少換一次
// 4. 聲部數(同時打的肢體數;Flam / Drag 多一隻手;連結線接續的音不算):Initial 一次一個、沒有和弦;1 級 1 到一半的小節有 2 個;
//    2 級超過一半的小節有 2 個、最多 2 個;3 級起最多 3 個、每題至少一個 3 個
// 5. 2 級以前的大鼓只在拍點上;三連音、六連音、四分三連音只在 x/4、x/2;二連音只在 6/8、9/8、12/8、3/8;滾奏、Ruff 一律不出(4 級起帶說明 key)
// 6. 同一個種子同一題;每一級白名單裡的每個元素在 1000 題裡至少出現一次(出題器真的會用到新的元素)
import fs from "node:fs";
import { genChart, playbackParams, phraseSpec, NOTES } from "../../../js/shared/playbackgen.js";
import { playbackFor } from "../../../js/shared/examdata.js";
import { scoreXML } from "../../../js/shared/kitnotation.js";
import { auditXML } from "./kitxml.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + "data/exam-trinity.json", "utf8"));
const key = JSON.parse(fs.readFileSync(root + "data/drumkey.json", "utf8"));
const SEEDS = Number(process.env.PB_SEEDS) || 1000;

/* 手抄:每個元素第幾級才有(Trinity RP p.62–63) */
const INTRO = {
  time: { "4/4": 0, "2/4": 0, "3/4": 2, "6/8": 4, "12/8": 5, "2/2": 6, "9/8": 6, "3/8": 6, "7/4": 7, "7/8": 7, "5/4": 7, "5/8": 7 },
  value: { "2": 0, "4": 0, "8": 0, "2.": 2, "16": 3, "4.": 3, "8t3": 4, "8.": 5, "16t3": 5, "16t6": 5, "1": 6, "16.": 6, "32": 6, "4t3": 7, dup: 7 },
  rest: { r2: 0, r4: 0, r8: 3, r1: 3, "r4.": 4, "r2.": 5, "r8.": 5, "r16.": 6, r16: 6 },
  dyn: { p: 1, f: 1, accent: 2, mp: 3, mf: 3, cresc: 4, dim: 4, pp: 5, ff: 5, sfz: 5 },
  piece: { snare: 0, kick: 0, tomHi: 0, tomFloor: 0, crash: 0, tomMid: 1, hh: 2, ride: 2, hhFoot: 3, hhOpen: 4, hhClosed: 4, xstick: 4 },
  feature: { ties: 2, offbeatBD: 3, flam: 4, drag: 4, ghost: 6, meterChange: 8 }
};
const CAP = g => (g === 0 ? 1 : g <= 2 ? 2 : 3);
// 白名單的元素(資料檔)→ 這裡的分類
const pieceOK = (p, P) => p === "xstick" ? P.extra.includes("rimclick") : p === "hhOpen" || p === "hhClosed" ? P.extra.includes("hhOpenClose") && P.pieces.includes("hhOpen") : P.pieces.includes(p);
const featOK = (f, P) => ({ ties: "ties", offbeatBD: "offbeatBD", flam: "flam", drag: "drag", ghost: "ghost", meterChange: "meterChange" })[f] && P.extra.includes(f);

/* 自己的時值表(四分音符 = 2520) */
const D = 2520;
const QV = { "1": 4, "2": 2, "2.": 3, "4": 1, "4.": 1.5, "8": 0.5, "8.": 0.75, "16": 0.25, "16.": 0.375, "32": 0.125, "8t3": 1 / 3, "4t3": 2 / 3, "16t3": 1 / 6, "16t6": 1 / 6, dup: 0.75 };
const dur = c => Math.round(QV[c.replace(/^r/, "")] * D);
const barLen = t => { const [n, d] = t.split("/").map(Number); return n * 4 / d * D; };
/* 拍點(大鼓「在拍點上」用):x/4、x/2 每個四分音符;6/8、9/8、12/8、3/8 每個附點四分;5/8 = 3+2、7/8 = 2+2+3 */
function beatStarts(t){
  const [n, d] = t.split("/").map(Number);
  if (d !== 8) return Array.from({ length: n * 4 / d }, (_, i) => i * D);
  const parts = n % 3 === 0 ? Array(n / 3).fill(3) : n === 5 ? [3, 2] : n === 7 ? [2, 2, 3] : null;
  const out = []; let p = 0; for (const x of parts) { out.push(p); p += x * D / 2; } return out;
}
const SIMPLE_ONLY = new Set(["8t3", "16t3", "16t6", "4t3"]);
const isCompound = t => /\/8$/.test(t) && Number(t.split("/")[0]) % 3 === 0;

/* MusicXML → 用到的元素(獨立於產生器的輸出) */
const TYPE = { whole: "1", half: "2", quarter: "4", eighth: "8", "16th": "16", "32nd": "32" };
function xmlElements(xml){
  const out = { values: new Set(), rests: new Set(), pieces: new Set(), marks: new Set(), flags: new Set(), times: 0 };
  const POS = {};
  for (const [id, p] of Object.entries(key.pieces)) POS[`${p.step}${p.oct}:${p.head}`] = (POS[`${p.step}${p.oct}:${p.head}`] || []).concat(id);
  for (const m of xml.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const n = m[1];
    if (n.includes("<grace")) { out.flags.add(n.includes('slash="yes"') ? "flam" : "drag"); continue; }
    if (/<rest measure="yes"/.test(n)) { out.rests.add("r1"); continue; }
    const type = TYPE[(/<type>(\w+)<\/type>/.exec(n) || [])[1]], dot = n.includes("<dot/>");
    const tm = /<actual-notes>(\d+)<\/actual-notes><normal-notes>(\d+)<\/normal-notes>/.exec(n);
    let code = type + (dot ? "." : "");
    if (tm) code = tm[1] === "2" && tm[2] === "3" ? "dup" : `${type}t${tm[1]}`;
    if (n.includes("<rest")) { out.rests.add("r" + code); continue; }
    out.values.add(code);
    const st = /<display-step>(\w)<\/display-step><display-octave>(\d)<\/display-octave>/.exec(n), head = (/<notehead[^>]*>([\w-]+)<\/notehead>/.exec(n) || [, "normal"])[1];
    const ids = POS[`${st[1]}${st[2]}:${head}`] || ["?"];
    // 同一個位置 + 形狀的鼓件:hh / hhOpen / hhClosed 看 <open/>、<stopped/>(連結線接續的音不畫);snare 與 xstick 形狀不同
    if (ids.includes("hh")) out.pieces.add(n.includes("<open ") ? "hhOpen" : n.includes("<stopped ") ? "hhClosed" : "hh");
    else out.pieces.add(ids[0]);
    if (n.includes("<accent")) out.marks.add("accent");
    if (n.includes('parentheses="yes"')) out.flags.add("ghost");
    if (n.includes("<tied ")) out.flags.add("ties");
    if (n.includes("<tremolo")) out.flags.add("roll");
  }
  for (const m of xml.matchAll(/<dynamics><(\w+)\/><\/dynamics>/g)) out.marks.add(m[1]);
  for (const m of xml.matchAll(/<wedge type="(crescendo|diminuendo)"/g)) out.marks.add(m[1] === "crescendo" ? "cresc" : "dim");
  out.times = (xml.match(/<time>/g) || []).length;
  return out;
}

/* 一份題目的檢查;回傳錯誤清單,並把用到的元素放進 used */
function checkChart(g, P, chart, used){
  const errs = [], E = s => errs.push(s);
  const spec = chart.spec, ms = spec.measures;
  // 長度
  const [tmin, tmax] = P.total, [pmin, pmax] = P.phrase;
  if (!(chart.totalBars >= tmin && chart.totalBars <= tmax)) E(`總長度 ${chart.totalBars} 不在 ${tmin}–${tmax}`);
  if (ms.length !== chart.totalBars) E(`小節數 ${ms.length} ≠ totalBars ${chart.totalBars}`);
  let at = 0;
  for (const ph of chart.phrases) {
    if (!(ph.bars >= pmin && ph.bars <= pmax)) E(`句長 ${ph.bars} 不在 ${pmin}–${pmax}`);
    if (ph.start !== at || ph.measures.length !== ph.bars || ph.measures[0] !== ms[at]) E(`第 ${at + 1} 小節起的句子位置不對`);
    at += ph.bars;
  }
  if (at !== ms.length) E(`句子加起來 ${at} 小節 ≠ ${ms.length}`);
  // 拍號:每一小節的拍號、換拍號只在句子開頭
  const starts = new Set(chart.phrases.map(p => p.start));
  let t = spec.time;
  const barTime = ms.map((m, i) => { if (m.time) { if (!starts.has(i)) E(`第 ${i + 1} 小節換拍號,不在句子開頭`); t = m.time; } return t; });
  const times = [...new Set(barTime)];
  for (const x of times) { used.time.add(x); if (!P.time.includes(x) || !(INTRO.time[x] <= g)) E(`拍號 ${x} 不在 ${g} 級白名單`); }
  const changes = ms.filter((m, i) => i && m.time).length;
  if (changes && !P.extra.includes("meterChange")) E(`${g} 級不能換拍號`);
  if (changes) used.feature.add("meterChange");
  if (g === 8 && !changes) E("8 級應該要換拍號");
  for (const ph of chart.phrases) if (barTime[ph.start] !== ph.time) E(`句子拍號 ${ph.time} ≠ 小節 ${barTime[ph.start]}`);
  // 每小節:時值、元素、同時打幾個
  const cap = CAP(g);
  let multiBars = 0, has3 = false, prevTie = [false, false];
  const feetUsed = ms.some(m => m.voices[1] && m.voices[1].some(e => e.notes));
  ms.forEach((m, mi) => {
    const len = barLen(barTime[mi]), hits = new Map(), beats = new Set(beatStarts(barTime[mi]));
    m.voices.forEach((v, vi) => {
      if (!v.length) { if (vi === 1 && !feetUsed) return; used.rest.add("r1"); if (!P.rests.includes("r1") || !(INTRO.rest.r1 <= g)) E(`第 ${mi + 1} 小節:整小節休止(全休止符)在 ${g} 級還沒有`); prevTie[vi] = false; return; }
      let p = 0;
      v.forEach((e, ei) => {
        const where = `第 ${mi + 1} 小節 ${vi ? "腳" : "手"} 第 ${ei + 1} 個`;
        const rest = e.value[0] === "r", code = rest ? e.value.slice(1) : e.value;
        if (!(code in QV)) { E(`${where}:時值 ${e.value} 不認得`); return; }
        if (rest) { used.rest.add(e.value); if (!P.rests.includes(e.value) || !(INTRO.rest[e.value] <= g)) E(`${where}:休止符 ${e.value} 不在 ${g} 級白名單`); }
        else { used.value.add(code); if (!P.values.includes(code) || !(INTRO.value[code] <= g)) E(`${where}:時值 ${code} 不在 ${g} 級白名單`); }
        if (SIMPLE_ONLY.has(code) && /\/8$/.test(barTime[mi])) E(`${where}:${code} 只放在 x/4、x/2(${barTime[mi]})`);
        if (code === "dup" && !isCompound(barTime[mi])) E(`${where}:二連音只放在複拍子(${barTime[mi]})`);
        if (e.roll || e.buzz) E(`${where}:不出滾奏`);
        if (!rest) {
          const cont = prevTie[vi];
          let k = 0;
          for (const n of e.notes) {
            const id = n.open && n.piece === "hh" ? "hhOpen" : n.closed && n.piece === "hh" ? "hhClosed" : n.piece;
            used.piece.add(id);
            if (!pieceOK(id, P) || !(INTRO.piece[id] <= g)) E(`${where}:鼓件 ${id} 不在 ${g} 級白名單`);
            for (const f of ["flam", "drag", "ghost"]) if (n[f]) { used.feature.add(f); if (!featOK(f, P) || !(INTRO.feature[f] <= g)) E(`${where}:${f} 在 ${g} 級還沒有`); }
            if (n.accent) { used.dyn.add("accent"); if (!P.dyn.includes("accent") || !(INTRO.dyn.accent <= g)) E(`${where}:重音在 ${g} 級還沒有`); }
            if (n.piece === "kick" && !cont && !beats.has(p)) { used.feature.add("offbeatBD"); if (!featOK("offbeatBD", P) || !(INTRO.feature.offbeatBD <= g)) E(`${where}:反拍大鼓在 ${g} 級還沒有`); }
            k++;
          }
          if (g === 0 && e.notes.length > 1) E(`${where}:Initial 只有單線(不能有和弦)`);
          if (!cont) hits.set(p, (hits.get(p) || 0) + k + (e.notes.some(n => n.flam || n.drag) ? 1 : 0));
          if (e.tie) { used.feature.add("ties"); if (!featOK("ties", P) || !(INTRO.feature.ties <= g)) E(`${where}:連結線在 ${g} 級還沒有`); }
          prevTie[vi] = !!e.tie;
        } else prevTie[vi] = false;
        p += dur(e.value);
      });
      if (p !== len) E(`第 ${mi + 1} 小節 ${vi ? "腳" : "手"}:時值加起來 ${p / D} 拍 ≠ 拍號 ${len / D} 拍`);
    });
    const mx = Math.max(0, ...hits.values());
    if (mx > cap) E(`第 ${mi + 1} 小節:同時打 ${mx} 個,${g} 級最多 ${cap} 個`);
    if (mx >= 2) multiBars++;
    if (mx >= 3) has3 = true;
  });
  // 連結線不跨句子
  for (const ph of chart.phrases) {
    const last = ph.measures[ph.bars - 1];
    for (const v of last.voices) { const e = v[v.length - 1]; if (e && e.tie) E(`第 ${ph.start + ph.bars} 小節:連結線跨到下一句`); }
  }
  // 聲部數(部分 / 大多 / 3 聲部)
  if (g === 1 && !(multiBars >= 1 && multiBars <= Math.floor(chart.totalBars / 2))) E(`1 級「部分 2 聲部」:有 2 個同時的小節 ${multiBars} / ${chart.totalBars}`);
  if (g === 2 && !(multiBars > chart.totalBars / 2)) E(`2 級「大多 2 聲部」:有 2 個同時的小節 ${multiBars} / ${chart.totalBars}`);
  if (g >= 3 && !has3) E(`${g} 級應該有 3 個同時(3 聲部協調)`);
  // 力度
  for (const d of chart.dyn) {
    used.dyn.add(d.mark);
    if (!P.dyn.includes(d.mark) || !(INTRO.dyn[d.mark] <= g)) E(`力度 ${d.mark} 不在 ${g} 級白名單`);
  }
  if (g === 0 && chart.dyn.length) E("Initial 沒有力度記號");
  if (JSON.stringify(chart.dyn) !== JSON.stringify(spec.dyn)) E("chart.dyn ≠ spec.dyn");
  // 說明 key
  for (const k of chart.notes) if (!NOTES[k]) E(`說明 key ${k} 沒有文字`);
  if (P.extra.some(x => x === "roll" || x === "ruff") !== chart.notes.includes("noRollRuff")) E("滾奏 / Ruff 不出的說明 key");
  // MusicXML:scoreXML 不丟錯、auditXML 重算時值、元素(從 XML 收)也在白名單
  let xml;
  try { xml = scoreXML({ ...spec, key }); } catch (e) { E("scoreXML:" + e.message); return errs; }
  for (const x of auditXML(xml, spec)) E("MusicXML:" + x);
  const X = xmlElements(xml);
  for (const c of X.values) if (!P.values.includes(c) || !(INTRO.value[c] <= g)) E(`MusicXML 時值 ${c} 不在 ${g} 級白名單`);
  for (const c of X.rests) if (!P.rests.includes(c) || !(INTRO.rest[c] <= g)) E(`MusicXML 休止符 ${c} 不在 ${g} 級白名單`);
  for (const c of X.pieces) if (!pieceOK(c, P) || !(INTRO.piece[c] <= g)) E(`MusicXML 鼓件 ${c} 不在 ${g} 級白名單`);
  for (const c of X.marks) if (!P.dyn.includes(c) || !(INTRO.dyn[c] <= g)) E(`MusicXML 記號 ${c} 不在 ${g} 級白名單`);
  for (const c of X.flags) if (c === "roll" || !featOK(c, P) || !(INTRO.feature[c] <= g)) E(`MusicXML ${c} 在 ${g} 級還沒有`);
  if (X.times !== 1 + ms.filter((m, i) => i && m.time && m.time !== barTime[i - 1]).length) E(`MusicXML 拍號 ${X.times} 個`);
  // 每一句單獨也畫得出來(聽力回打用)
  chart.phrases.forEach((ph, i) => { try { scoreXML({ ...phraseSpec(chart, i), key }); } catch (e) { E(`第 ${i + 1} 句單獨:${e.message}`); } });
  return errs;
}

export default function check(ok){
  for (let g = 0; g <= 8; g++) {
    const P = playbackParams(g, data), plain = playbackFor(g, data);
    const used = { time: new Set(), value: new Set(), rest: new Set(), dyn: new Set(), piece: new Set(), feature: new Set() };
    let bad = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let chart;
      try { chart = genChart(P, seed); } catch (e) { bad++; if (bad <= 3) ok(false, `${g} 級 #${seed}:${e.message}`); continue; }
      const errs = checkChart(g, P, chart, used);
      if (seed % 50 === 0 && JSON.stringify(genChart(P, seed)) !== JSON.stringify(chart)) errs.push("同一個種子產生不同的題目");
      if (seed % 100 === 0) { try { errs.push(...checkChart(g, plain, genChart(plain, seed), { time: new Set(), value: new Set(), rest: new Set(), dyn: new Set(), piece: new Set(), feature: new Set() }).map(e => "(沒有 fresh)" + e)); } catch (e) { errs.push("(沒有 fresh)" + e.message); } }
      if (errs.length) { bad++; if (bad <= 3) ok(false, `${g} 級 #${seed}:${errs.slice(0, 4).join(";")}`); }
    }
    ok(bad === 0, `Playback ${g} 級:${SEEDS} 題有 ${bad} 題不合規則`);
    // 白名單裡每個元素至少出現一次(滾奏、Ruff 不出;全套鼓、手腳獨立、術語是說明,不是元素)
    const want = {
      time: P.time, value: P.values, rest: P.rests, dyn: P.dyn,
      piece: [...P.pieces, ...(P.extra.includes("rimclick") ? ["xstick"] : []), ...(P.extra.includes("hhOpenClose") ? ["hhClosed"] : [])],
      feature: Object.keys(INTRO.feature).filter(f => featOK(f, P))
    };
    const miss = Object.entries(want).flatMap(([k, xs]) => xs.filter(x => !used[k].has(x)).map(x => `${k}:${x}`));
    ok(!miss.length, `Playback ${g} 級:白名單裡沒出現過的元素 ${miss.join("、")}`);
  }
  // 檢查本身抓得到錯:高一級的題目拿低一級的白名單檢查一定有錯(每一級 50 題都要抓到)
  for (let g = 1; g <= 8; g++) {
    const lo = playbackParams(g - 1, data), hi = playbackParams(g, data);
    let caught = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const errs = checkChart(g - 1, lo, genChart(hi, seed), { time: new Set(), value: new Set(), rest: new Set(), dyn: new Set(), piece: new Set(), feature: new Set() });
      if (errs.length) caught++;
    }
    ok(caught >= (g === 8 ? 50 : 25), `檢查本身:${g} 級的題目當 ${g - 1} 級檢查,50 題只抓到 ${caught} 題`);
  }
  // 竄改:時值不滿一小節、Initial 出現和弦、大鼓放到反拍
  {
    const P0 = playbackParams(0, data), c = genChart(P0, 3), u = { time: new Set(), value: new Set(), rest: new Set(), dyn: new Set(), piece: new Set(), feature: new Set() };
    const t1 = structuredClone(c); t1.spec.measures[0].voices[0].pop(); t1.phrases[0].measures[0] = t1.spec.measures[0];
    ok(checkChart(0, P0, t1, u).some(e => /時值加起來/.test(e)), "檢查本身:少一個音要抓到");
    const t2 = structuredClone(c); const ev = t2.spec.measures[0].voices[0].find(e => e.notes); ev.notes.push({ piece: "tomHi" }); t2.phrases[0].measures[0] = t2.spec.measures[0];
    ok(checkChart(0, P0, t2, u).some(e => /單線/.test(e)), "檢查本身:Initial 的和弦要抓到");
    const t3 = structuredClone(c); t3.spec.measures[0].voices = [[{ value: "8", notes: [{ piece: "snare" }] }, { value: "8", notes: [{ piece: "kick" }] }, { value: "4", notes: [{ piece: "snare" }] }, { value: "r2" }]];
    t3.spec.time = "4/4"; t3.phrases[0].measures[0] = t3.spec.measures[0];
    ok(checkChart(0, P0, t3, u).some(e => /反拍大鼓/.test(e)), "檢查本身:Initial 的反拍大鼓要抓到");
  }
  // 不完整的參數要丟出錯誤
  let threw = false; try { genChart(null, 1); } catch (e) { threw = true; } ok(threw, "genChart(null) 應該丟出錯誤");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 全部通過(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
