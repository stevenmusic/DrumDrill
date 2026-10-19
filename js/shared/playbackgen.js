/* Trinity Rock & Pop Playback 的 song chart 產生器(STAGES.md S10 + S11;Initial–8 級)。
   純函式:不碰 DOM、不 import i18n,Node 可以直接跑(tools/test/checks/gen-playback.mjs 每級 1000 個種子檢查)。

   genChart(params, seed) → {
     grade, seed, time(第一個拍號), times(用到的拍號,照出現順序),
     phrases: [{ bars, start(第幾小節起), time, measures, dyn(m 從這一句的第一小節算) }],
     dyn(整份;m 從 0 算), totalBars, spec(kitnotation scoreXML 吃的:{ lines:5, time, measures, dyn }),
     notes: [說明 key](NOTES 有中英文與出處種類), src(頁碼)
   }
   params = examdata.js 的 playbackFor(g, data)(累積白名單);playbackParams(g, data) = 同一份再加上 fresh(這一級新增的項目,出題時加重,練習設定)。
   同一個 params + 同一個 seed → 同一題。

   只用累積白名單 [Trinity RP p.62–63 → data/exam-trinity.json playback.grades]:
   拍號、音符時值、休止符、力度 / 重音 / 漸強漸弱、鼓件、同時幾個聲部、連結線、腳踩 HH、反拍大鼓、開閉 HH、rim-click(drumkey 的 xstick)、
   Flam、Drag、幽靈音、換拍號。白名單以外一律不出;7 級「任何常見術語與記號」不另外加東西(只用前面各級列過的)。
   不出:滾奏、Ruff(大綱沒寫寫法與種類;NOTES.noRollRuff)、Ride bell(大綱沒列;NOTES.fullKit)、
         docs/NOTATION.md「做不到」的記號(分組拍號分子、% 反覆、choke、半開 HH、rim-shot)。速度不在這裡(官方沒寫)。

   出題設計(App 的,不是官方;docs/GENERATORS.md,標「練習設定」或「推估」):
   - 一句 = 律動小節 + 最後一小節過門(整小節或後半小節);下一句開頭常有 Crash(過門的落點)。最後一句可能用 Crash 長音收尾。
   - 一個「組」= 拍號的一拍(x/4、x/2 = 四分音符;6/8、9/8、12/8、3/8 = 附點四分;5/8 = 3+2、7/8 = 2+2+3 個八分音符,照 kitnotation 的分組)。
     每一組從節奏格(CELL_Q / CELL_DQ)挑一格,格子裡的時值與休止符都要在白名單裡;三連音、六連音、四分三連音只在 x/4、x/2,二連音只在 6/8、9/8、12/8、3/8。
   - 聲部數 = 同一個時間點同時打的肢體數(和弦的音 + 腳;Flam / Drag 多算一隻手;連結線接續的音不算)[推估]。
     Initial:一次一個(手腳輪流,一拍內不換聲部);1 級「部分 2 聲部」= 至少一小節、最多一半的小節有 2 個同時;
     2 級「大多 2 聲部」= 超過一半的小節有 2 個同時、最多 2 個;3 級起最多 3 個,而且每題至少一個時間點 3 個。
   - 1、2 級還沒有全休止符、八分休止符:沒有打的聲部只用白名單裡的休止符(整拍休止),所以一拍內手腳不換;
     腳整小節沒有打 → 不印休止符(kitnotation 的 hideEmpty;Initial 一樣);3 級起整小節沒有打的聲部是整小節休止(全休止符)。
   - 2 級以前的大鼓只在拍點上(3 級才有反拍大鼓)。2/2 半小節一拍:律動的小鼓反拍只在第 3 個四分音符 [推估]。
   - 連結線只接「跨拍」的音:前一個音八分音符以上、結束在拍點(可以跨小節線,不跨句子);同一拍內的短音不連。
   - 總長度不含回打的小節 [推估]:譜上每一句只寫一次,回打由播放器處理。換拍號只在句子之間 [推估];
     8 級每題換 1–2 次(最多 3 種拍號),優先換到相近的拍號(REL_TIME;練習設定)。
   - phraseSpec(單句的譜)開頭一定有力度:這一句開頭沒寫的話,補上前面最後一個力度記號。 */
import { DIV, parseTime } from "./kitnotation.js";
import { playbackFor } from "./examdata.js";

const Q = DIV;
const LEVELS = ["pp", "p", "mp", "mf", "f", "ff"];
/* 時值(四分音符 = 1;自己的表,不用 kitnotation 的 valueInfo) */
const QV = { "1": 4, "2": 2, "2.": 3, "4": 1, "4.": 1.5, "8": 0.5, "8.": 0.75, "16": 0.25, "16.": 0.375, "32": 0.125, "8t3": 1 / 3, "4t3": 2 / 3, "16t3": 1 / 6, "16t6": 1 / 6, dup: 0.75 };
export const codeDur = c => Math.round(QV[String(c).replace(/^r/, "")] * DIV);

/* 說明 key(UI 用 tr(zh, en) 顯示;kind = assumed 推估 / practice 練習設定 / omit 不出的項目) */
export const NOTES = {
  totalExcludesRepeat: { kind: "assumed", text: ["總長度不含回打的小節:譜上每一句寫一次", "Total bars exclude the repeats: each phrase is written once"] },
  noTempo: { kind: "omit", text: ["速度:官方沒寫,出題器不定速度", "Tempo: not in the syllabus; not set by the generator"] },
  design: { kind: "practice", text: ["拍型與組合方式是 App 的出題設計,不是官方題目", "Patterns and their combination are the App's design, not official tests"] },
  voices: { kind: "assumed", text: ["聲部數 = 同時打的肢體數;「部分 / 大多」是 App 的解讀", "Parts = limbs struck together; 'some / mostly' is the App's reading"] },
  lowTom: { kind: "assumed", text: ["官方的 LT(Low Tom)用落地鼓的位置與聲音", "Official LT (low tom) uses the floor tom"] },
  noRollRuff: { kind: "omit", text: ["滾奏、Ruff 不出:大綱沒寫寫法與種類", "Rolls and ruffs are not generated: the syllabus does not say which or how"] },
  fullKit: { kind: "assumed", text: ["全套鼓:App 用小鼓、大鼓、三個 Toms、Hi-hat、Ride、Crash、rim-click;不用 Ride bell(大綱沒列)", "Full kit: snare, kick, 3 toms, hi-hat, ride, crash, rim-click; no ride bell (not listed)"] },
  compound: { kind: "assumed", text: ["複拍子依附點四分分組;5/8 = 3+2、7/8 = 2+2+3(常見寫法,待核對)", "Compound time grouped in dotted crotchets; 5/8 = 3+2, 7/8 = 2+2+3 (common use, pending check)"] },
  independence: { kind: "practice", text: ["進階手腳獨立:App 用比較多樣的大鼓節奏表示", "Extended independence: the App uses more varied kick rhythms"] },
  anyTerms: { kind: "practice", text: ["「任何常見術語與記號」只用前面各級列過的", "'Any common terms and signs': only those listed in earlier grades"] },
  meterChange: { kind: "assumed", text: ["換拍號只在句子之間", "Metre changes only between phrases"] },
  rimClick: { kind: "assumed", text: ["rim-click 用 drumkey 的 cross stick(xstick)符號與聲音", "Rim-click uses the drum key's cross-stick (xstick) symbol and sound"] },
  singleLine: { kind: "assumed", text: ["Initial「只有單線」解讀成一次只打一個(手腳輪流,不同時)", "Initial 'single line' read as one stroke at a time (hands and feet alternate)"] },
  cutTime: { kind: "assumed", text: ["2/2 半小節一拍:律動的小鼓反拍在第 3 個四分音符", "2/2 has two beats a bar: the groove backbeat is on the 3rd crotchet"] }
};

/* ── 節奏格(App 的出題設計;練習設定)── */
const mk = (s, w = 1) => {
  const codes = s.split(" ");
  let p = 0; const on = [];
  for (const c of codes) { if (c[0] !== "r") on.push(p); p += codeDur(c); }
  return { s, codes, len: p, w, notes: on.length, onsets: on, startOnly: on.length === 1 && on[0] === 0,
    tup: codes.some(c => /t\d/.test(c)), dup: codes.includes("dup") };
};
// 一拍(四分音符;5/8、7/8 的兩個八分音符一組也用,但不放連音)
const CELL_Q = [
  ["4", 3], ["8 8", 3], ["8 16 16", 1.5], ["16 16 8", 1.5], ["16 8 16", 0.8], ["16 16 16 16", 1.5], ["8. 16", 1.5], ["16 8.", 0.6],
  ["8t3 8t3 8t3", 2], ["16t3 16t3 16t3 8", 1], ["8 16t3 16t3 16t3", 1], ["16t3 16t3 16t3 16 16", 0.6], ["16 16 16t3 16t3 16t3", 0.6],
  ["16t3 16t3 16t3 16t3 16t3 16t3", 0.6], ["16t6 16t6 16t6 16t6 16t6 16t6", 1.2], ["8t3 16t3 16t3 8t3", 0.6],
  ["16. 32 8", 1], ["8 16. 32", 0.8], ["16. 32 16. 32", 0.8], ["32 32 16 8", 0.8], ["8 32 32 16", 0.6], ["16 32 32 16 16", 0.6], ["32 32 32 32 8", 0.6],
  ["r4", 0.4], ["r8 8", 1], ["8 r8", 0.8], ["r8 16 16", 0.8], ["16 16 r8", 0.6], ["r16 16 8", 0.6], ["r16 16 16 16", 0.6], ["8 r16 16", 0.6],
  ["r8. 16", 0.8], ["16 r8.", 0.5], ["r16 8.", 0.5], ["r16. 32 8", 0.6], ["8 r16. 32", 0.5]
].map(([s, w]) => mk(s, w));
// 跨幾拍(x/4、x/2):二分、附點二分、全音符、附點四分 + 八分、四分三連音(只用 3 個四分三連音放進 2 拍;一拍內 4t3 + 8t3 的寫法不出)
const CELL_QM = [["2", 2], ["2.", 1], ["1", 1], ["4. 8", 1.5], ["4t3 4t3 4t3", 1.5]].map(([s, w]) => mk(s, w));
// 附點四分一組(6/8、9/8、12/8、3/8;5/8、7/8 的三個八分音符一組不放二連音)
const CELL_DQ = [
  ["4.", 2], ["4 8", 3], ["8 4", 1], ["8 8 8", 3], ["16 16 8 8", 1.2], ["8 16 16 8", 1.2], ["8 8 16 16", 1.2], ["16 16 16 16 16 16", 1],
  ["16 16 16 16 8", 0.8], ["8 16 16 16 16", 0.8], ["8. 16 8", 1.2], ["dup dup", 2], ["16. 32 8 8", 0.8], ["8 8 16. 32", 0.6],
  ["r4.", 0.4], ["r8 8 8", 1], ["8 r8 8", 1], ["8 8 r8", 0.6], ["r4 8", 1], ["4 r8", 0.8], ["r8 4", 0.6], ["r8. 16 8", 0.6], ["r16 16 8 8", 0.6], ["r16 16 16 16 8", 0.5]
].map(([s, w]) => mk(s, w));
const CELL_DQM = [["2.", 1]].map(([s, w]) => mk(s, w));
// 律動的鈸(固定一句):四分 / 八分 / 十六分;附點四分一組:附點四分 / 四分 + 八分 / 三個八分
const OST_Q = [["8 8", 4], ["4", 1.5], ["16 16 16 16", 1]].map(([s, w]) => mk(s, w));
const OST_DQ = [["8 8 8", 4], ["4 8", 1.2], ["4.", 1]].map(([s, w]) => mk(s, w));
// 大鼓
const KICK_Q = [["4", 4], ["8 8", 1.5], ["r8 8", 1.5], ["8 r8", 1], ["8. 16", 1], ["r8. 16", 0.8], ["16 r8.", 0.5], ["8 16 16", 0.6], ["16 16 8", 0.5], ["r16 16 8", 0.5]].map(([s, w]) => mk(s, w));
const KICK_DQ = [["4.", 3], ["4 8", 2], ["r4 8", 1.2], ["8 r8 8", 1], ["8 8 8", 0.6], ["r8 8 8", 0.8], ["4 r8", 0.8], ["8. 16 8", 0.5]].map(([s, w]) => mk(s, w));

/* ── 亂數(mulberry32)── */
function rng(seed){
  let s = (Number(seed) >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, a) => a[Math.floor(R() * a.length)];
function wpick(R, items, w){
  const ws = items.map(w), sum = ws.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  let x = R() * sum;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
  return items[items.length - 1];
}

/* playbackFor + fresh(這一級新增的項目;出題時加重,練習設定) */
export function playbackParams(g, data){
  const p = playbackFor(g, data);
  if (!p) return null;
  const q = g > 0 ? playbackFor(g - 1, data) : null;
  p.fresh = {};
  for (const k of ["time", "values", "rests", "dyn", "pieces", "extra"]) p.fresh[k] = p[k].filter(x => !q || !q[k].includes(x));
  return p;
}

function config(p){
  const has = (k, x) => Array.isArray(p[k]) && p[k].includes(x);
  const fresh = new Set(p.fresh ? Object.values(p.fresh).flat() : []);
  const C = {
    grade: p.grade, times: [...p.time], values: new Set(p.values), rests: new Set(p.rests), pieces: new Set(p.pieces), fresh,
    marks: LEVELS.filter(m => has("dyn", m)), accent: has("dyn", "accent"), cresc: has("dyn", "cresc"), dim: has("dyn", "dim"), sfz: has("dyn", "sfz"),
    ties: has("extra", "ties"), footHH: has("extra", "footHH") && has("pieces", "hhFoot"), offbeatBD: has("extra", "offbeatBD"),
    openClose: has("extra", "hhOpenClose"), rim: has("extra", "rimclick"), flam: has("extra", "flam"), drag: has("extra", "drag"),
    ghost: has("extra", "ghost"), meterChange: has("extra", "meterChange"), indep: has("extra", "independence"),
    maxV: p.voices || 1, amount: p.voicesAmount || null, total: p.total, phrase: p.phrase
  };
  C.drums = ["snare", "tomHi", "tomMid", "tomFloor"].filter(x => C.pieces.has(x));
  C.cyms = ["hh", "ride"].filter(x => C.pieces.has(x));
  C.crash = C.pieces.has("crash"); C.kick = C.pieces.has("kick");
  C.r = c => C.rests.has(c);
  return C;
}
const cellOK = (C, cell, meter) => cell.codes.every(c => (c[0] === "r" ? C.rests.has(c) : C.values.has(c))) &&
  (!cell.tup || meter.type !== 8) && (!cell.dup || (meter.type === 8 && meter.beats % 3 === 0));
const freshW = (C, cell) => cell.w * (cell.codes.some(c => C.fresh.has(c)) ? 3 : 1);

/* 拍號資訊:每一組的開始位置與種類(q = 四分音符長、dq = 附點四分長) */
function meterInfo(time){
  const m = parseTime(time), starts = [];
  let p = 0; for (const g of m.groups) { starts.push(p); p += g; }
  return { ...m, time, starts, kinds: m.groups.map(g => (g === Q ? "q" : g === 1.5 * Q ? "dq" : "x")), simple: m.type !== 8, compound: m.type === 8 && m.beats % 3 === 0 };
}
/* 相近的拍號(8 級換拍號優先換到這些;練習設定):分母一樣(x/4 ↔ x/4、x/8 ↔ x/8),加上每小節拍數相近的幾組 */
const REL_TIME = [["2/2", "4/4"], ["2/2", "2/4"], ["4/4", "12/8"], ["4/4", "6/8"], ["2/4", "6/8"], ["3/4", "6/8"], ["3/4", "9/8"]];
export const relatedTime = (a, b) => a !== b && (a.split("/")[1] === b.split("/")[1] || REL_TIME.some(([x, y]) => (x === a && y === b) || (x === b && y === a)));
/* 在第 gi 組可以放的格子(一組的、或跨幾組的);endG = 不能超過的組 */
function cellsAt(C, meter, gi, endG, pool, multi){
  const kind = meter.kinds[gi], out = [];
  for (const c of pool) if (c.len === meter.groups[gi] && cellOK(C, c, meter)) out.push({ cell: c, span: 1 });
  if (!multi) return out;
  const nG = meter.groups.length;
  if (meter.simple && kind === "q") for (const c of CELL_QM) {
    const k = c.len / Q;
    if (!cellOK(C, c, meter) || gi + k > endG) continue;
    if (k === 2 && gi % 2) continue;
    if (k === 3 && gi !== 0) continue;
    if (k === 4 && !(gi === 0 && nG === 4)) continue;
    out.push({ cell: c, span: k });
  }
  if (meter.compound) for (const c of CELL_DQM) {
    const k = c.len / (1.5 * Q);
    if (cellOK(C, c, meter) && gi % 2 === 0 && gi + k <= endG) out.push({ cell: c, span: k });
  }
  return out;
}
const restEv = (pos, code) => ({ pos, code, rest: true, notes: [], whole: true });
const groupRest = (meter, gi) => restEv(meter.starts[gi], meter.kinds[gi] === "dq" ? "4." : "4");
function cellEvents(cell, pos, noteFn, role){
  const out = []; let p = pos, k = 0;
  for (const c of cell.codes) {
    if (c[0] === "r") out.push({ pos: p, code: c.slice(1), rest: true, notes: [], role });
    else { out.push({ pos: p, code: c, rest: false, notes: noteFn(k, c), role }); k++; }
    p += codeDur(c);
  }
  return out;
}
/* 每個時間點同時打幾個肢體(和弦的音 + 腳;Flam / Drag 多一隻手;連結線接續的音不算) */
function strikes(evs, map = new Map()){
  for (const e of evs) if (!e.rest && !e.cont) {
    const k = e.notes.length + (e.notes.some(n => n.flam || n.drag) ? 1 : 0);
    map.set(e.pos, (map.get(e.pos) || 0) + k);
  }
  return map;
}
const barStrikes = bar => strikes(bar.feet, strikes(bar.hand));
const maxStrikes = bar => Math.max(0, ...barStrikes(bar).values());
/* 反拍:x/4 單數的組;3/8(一小節一組)單數的小節;x/2 半小節一拍 → 第 3 個四分音符(gi = 2,推估) */
const backbeat = (gi, b, meter) => (meter.groups.length === 1 ? b % 2 === 1 : meter.type === 2 ? gi % 4 === 2 : gi % 2 === 1);

/* 大鼓的格子(白名單;2 級以前只在拍點上;cap = 跟手加起來最多幾個) */
function kickCell(C, R, meter, gi, handEvs, { startOnly = false, need0 = false } = {}){
  const pool = meter.kinds[gi] === "dq" ? KICK_DQ : KICK_Q;
  const hs = strikes(handEvs);
  const ok = pool.filter(c => c.len === meter.groups[gi] && cellOK(C, c, meter) && (C.offbeatBD || c.startOnly) && (!startOnly || c.startOnly) && (!need0 || c.onsets[0] === 0) &&
    (C.indep || c.notes <= 2) && c.onsets.every(o => (hs.get(meter.starts[gi] + o) || 0) + 1 <= C.maxV));
  return wpick(R, ok, c => freshW(C, c));
}
const kickEvents = (cell, pos, piece = "kick") => cellEvents(cell, pos, () => [{ piece }], "kick");

/* ── 一小節:單線(Initial、1 級)── 每一組手或腳其中一個打(另一個整拍休止);coord = 這一小節要有 2 個同時(1 級) */
function lineBar(C, R, meter, kind, o){
  const nG = meter.groups.length, endG = o.hitFrom ?? nG, hand = [], feet = [];
  const walk = drumWalk(C, R);
  let gi = 0, gf = 0;
  while (gi < endG) {
    const strong = gi % 2 === 0;
    let feetAct = C.kick && !(gi === 0 && o.crashStart) && R() < (kind === "groove" ? (strong ? 0.5 : 0.12) : (strong ? 0.15 : 0));
    let pickd = null;
    if (feetAct) { const c = kickCell(C, R, meter, gi, [], { startOnly: !C.offbeatBD }); if (c) pickd = { cell: c, span: 1 }; else feetAct = false; }
    if (!pickd) {
      const pool = cellsAt(C, meter, gi, endG, CELL_Q.concat(CELL_DQ), true).filter(x => kind === "fill" ? x.cell.notes > 0 : true);
      pickd = wpick(R, pool, x => freshW(C, x.cell) * (kind === "fill" ? 0.6 + 0.3 * Math.min(x.cell.notes, 6) : 1) * (x.span > 1 ? 0.6 : 1));
    }
    const { cell, span } = pickd, pos = meter.starts[gi];
    if (feetAct) {
      feet.push(...kickEvents(cell, pos));
      for (let k = 0; k < span; k++) hand.push(groupRest(meter, gi + k));
    } else {
      const piece = kind === "fill" ? walk(gf) : (R() < 0.8 || C.drums.length < 2 ? "snare" : pick(R, C.drums));
      const evs = cellEvents(cell, pos, (k) => [{ piece: k === 0 && gi === 0 && o.crashStart ? "crash" : piece }], kind === "fill" ? "fill" : "line");
      hand.push(...evs);
      // 2 個同時:這一組第一個音下面加大鼓(1 級)
      if (o.coord && span === 1 && !evs[0].rest && C.kick && R() < 0.5) feet.push(...kickEvents(mk(meter.kinds[gi] === "dq" ? "4." : "4"), pos));
      else for (let k = 0; k < span; k++) feet.push(groupRest(meter, gi + k));
      gf++;
    }
    gi += span;
  }
  const bar = { hand, feet };
  if (o.coord && maxStrikes(bar) < 2) kickUnder(C, R, meter, bar, 2, ["line", "fill"]);
  return bar;
}
/* 在手的某個音(在組的開頭、腳在這一組整拍休止)下面加大鼓,讓這個時間點剛好 need 個同時;roles = 哪些手的音可以 */
function kickUnder(C, R, meter, bar, need, roles){
  if (!C.kick) return false;
  const hs = barStrikes(bar);
  const cand = bar.hand.filter(e => !e.rest && !e.cont && roles.includes(e.role) && (hs.get(e.pos) || 0) === need - 1 &&
    bar.feet.some(f => f.whole && f.pos === e.pos));
  if (!cand.length) return false;
  const e = pick(R, cand), fi = bar.feet.findIndex(f => f.whole && f.pos === e.pos);
  bar.feet[fi] = { pos: e.pos, code: bar.feet[fi].code, rest: false, notes: [{ piece: "kick" }], role: "kick" };
  return true;
}
/* 過門的鼓:小鼓 → 高 → 中 → 落地(往下走;有時候往上),每一組一個鼓 */
function drumWalk(C, R){
  const order = R() < 0.2 ? [...C.drums].reverse() : [...C.drums];
  let idx = Math.floor(R() * Math.min(2, order.length));
  const per = [];
  return gf => {
    while (per.length <= gf) { per.push(order[idx]); if (R() < 0.65) idx = Math.min(idx + 1, order.length - 1); }
    return per[gf];
  };
}

/* ── 一小節:律動(2 級起)── 鈸固定節奏、反拍小鼓(或 rim-click)、大鼓;upto = 律動到第幾組(後面是過門) */
function grooveSetup(C, R){
  const cym = wpick(R, C.cyms, c => (c === "hh" ? 2 : 1) * (C.fresh.has(c) ? 2 : 1));
  const ostQ = wpick(R, OST_Q.filter(c => c.codes.every(x => C.values.has(x))), c => c.w);
  const ostDQ = wpick(R, OST_DQ.filter(c => c.codes.every(x => C.values.has(x))), c => c.w);
  return {
    cym, ostQ, ostDQ,
    back: C.rim && R() < 0.3 ? "xstick" : "snare",
    ghost: C.ghost && R() < 0.6,
    open: C.openClose && cym === "hh" && R() < 0.6,
    foot: C.footHH && cym === "ride" && R() < 0.75,
    feetPlan: {}
  };
}
function grooveGroups(C, R, meter, b, S, o, hand, feet, upto){
  const nG = meter.groups.length;
  for (let gi = 0; gi < upto; gi++) {
    const kind = meter.kinds[gi], pos = meter.starts[gi], bb = backbeat(gi, b, meter);
    const halfOff = meter.type === 2 && gi % 2 === 1;   // x/2 拍與拍之間的四分音符:大鼓少一點
    let ost = kind === "dq" ? S.ostDQ : S.ostQ;
    if (!ost || ost.len !== meter.groups[gi] || !cellOK(C, ost, meter)) ost = mk(kind === "dq" ? (C.values.has("4.") ? "4." : "4 8") : "4");
    // 幽靈音:鈸八分音符的組改成十六分,單數的十六分是小鼓幽靈音
    let ghostCell = null;
    if (S.ghost && (ost.s === "8 8" || ost.s === "8 8 8") && C.values.has("16") && R() < 0.55) ghostCell = mk(kind === "dq" ? "16 16 16 16 16 16" : "16 16 16 16");
    const cell = ghostCell || ost;
    const crash = gi === 0 && o.crashStart;
    const evs = cellEvents(cell, pos, (k) => {
      if (ghostCell && k % 2 === 1) return [{ piece: "snare", ghost: true }];
      const ns = [{ piece: crash && k === 0 ? "crash" : S.cym }];
      if (crash && k === 0 && C.accent && R() < 0.5) ns[0].accent = true;
      if (k === 0 && bb) ns.push({ piece: S.back });
      return ns;
    }, "groove");
    hand.push(...evs);
    // 腳
    const pk = gi + (bb ? "b" : "");   // 3/8 一小節一拍:反拍是單數的小節,分開記
    let plan = S.feetPlan[pk];
    if (!plan || o.vary && R() < 0.3 || crash) {
      if (crash && C.kick) plan = { piece: "kick", cell: kickCell(C, R, meter, gi, evs, { need0: true, startOnly: !C.offbeatBD }) };
      else if (bb && S.foot) plan = { piece: "hhFoot", cell: mk(kind === "dq" ? "4." : "4") };
      else if (bb) plan = C.maxV >= 3 && C.kick && R() < (C.indep ? 0.5 : 0.3) ? { piece: "kick", cell: kickCell(C, R, meter, gi, evs, { startOnly: !C.offbeatBD }) } : { rest: true };
      else plan = C.kick && R() < (halfOff ? 0.35 : 0.85) ? { piece: "kick", cell: kickCell(C, R, meter, gi, evs, { startOnly: !C.offbeatBD }) } : { rest: true };
      if (!crash) S.feetPlan[pk] = plan;
    }
    const hs = strikes(evs);
    const fits = plan.cell && plan.cell.len === meter.groups[gi] && cellOK(C, plan.cell, meter) && plan.cell.onsets.every(x => (hs.get(pos + x) || 0) + 1 <= C.maxV);
    if (!plan.rest && fits) feet.push(...kickEvents(plan.cell, pos, plan.piece));
    else feet.push(groupRest(meter, gi));
  }
  // 開 HH:一小節最多一次,下一個 HH 寫閉(+)
  if (S.open && R() < 0.4) {
    const hh = hand.filter(e => e.role === "groove" && !e.rest && e.notes.some(n => n.piece === "hh"));
    const cand = hh.slice(0, -1).filter(e => e.notes.length === 1);
    if (cand.length) {
      const e = pick(R, cand), nx = hh[hh.indexOf(e) + 1];
      e.notes[0].open = true; nx.notes.find(n => n.piece === "hh").closed = true;
    }
  }
}

/* ── 過門(手:小鼓、筒鼓;腳:有時候大鼓或腳踩 HH)── from..to 組 */
function fillGroups(C, R, meter, from, to, hand, feet){
  const walk = drumWalk(C, R);
  const pulseFoot = C.footHH && R() < 0.25;
  let gi = from, gf = 0;
  while (gi < to) {
    const pool = cellsAt(C, meter, gi, to, CELL_Q.concat(CELL_DQ), true).filter(x => x.cell.notes > 0 && (x.span === 1 || x.cell.tup || x.cell.s === "4. 8"));
    const { cell, span } = wpick(R, pool, x => freshW(C, x.cell) * (0.6 + 0.3 * Math.min(x.cell.notes, 6)));
    const pos = meter.starts[gi], split = cell.notes >= 4 && R() < 0.35, p1 = walk(gf), p2 = walk(gf + 1);
    const evs = cellEvents(cell, pos, (k) => [{ piece: split && k >= cell.notes / 2 ? p2 : p1 }], "fill");
    // 重音、Flam / Drag(八分音符以上)、幽靈音(十六分音符的小鼓;更短的音加括號會擠在一起)
    evs.filter(e => !e.rest).forEach((e, k) => {
      const n = e.notes[0], d = codeDur(e.code);
      if (C.accent && (k === 0 ? R() < 0.45 : R() < 0.08)) n.accent = true;
      if (d >= Q / 2 && (C.flam || C.drag) && R() < 0.3) { if (C.flam && (!C.drag || R() < 0.55)) n.flam = true; else n.drag = true; }
      else if (C.ghost && !n.accent && n.piece === "snare" && e.code === "16" && R() < 0.3) n.ghost = true;
    });
    hand.push(...evs);
    const hs = strikes(evs);
    for (let k = 0; k < span; k++) {
      const g = gi + k, gp = meter.starts[g];
      let fe = null;
      if (C.maxV >= 2 && span === 1) {
        if (pulseFoot) { const c = mk(meter.kinds[g] === "dq" ? "4." : "4"); if ((hs.get(gp) || 0) + 1 <= C.maxV) fe = kickEvents(c, gp, "hhFoot"); }
        else if (C.kick && R() < (C.maxV >= 3 ? 0.35 : 0.3)) {
          const c = C.maxV >= 3 ? kickCell(C, R, meter, g, evs, { startOnly: !C.offbeatBD }) : kickCell(C, R, meter, g, evs, { startOnly: true });
          if (c) fe = kickEvents(c, gp);
        }
      }
      feet.push(...(fe || [groupRest(meter, g)]));
    }
    gi += span; gf += split ? 2 : 1;
  }
}

/* 收尾的 Crash 長音:最後一小節的最後幾組(白名單的時值);回傳 { from(組), code } 或 null */
function hitOptions(C, meter, barsInPhrase){
  const nG = meter.groups.length, out = [];
  if (meter.simple) {
    if (C.values.has("4")) out.push({ k: 1, code: "4", w: 1 });
    if (nG >= 2 && (nG - 2) % 2 === 0 && C.values.has("2")) out.push({ k: 2, code: "2", w: 2 });
    if (nG === 3 && C.values.has("2.")) out.push({ k: 3, code: "2.", w: 1.5 });
    if (nG === 4 && C.values.has("1")) out.push({ k: 4, code: "1", w: 3 });
  } else {
    const last = meter.kinds[nG - 1];
    if (last === "dq" && C.values.has("4.")) out.push({ k: 1, code: "4.", w: 1 });
    if (last === "q" && C.values.has("4")) out.push({ k: 1, code: "4", w: 1 });
    if (meter.compound && nG >= 2 && (nG - 2) % 2 === 0 && C.values.has("2.")) out.push({ k: 2, code: "2.", w: 2 });
  }
  return out.filter(h => h.k < nG || barsInPhrase >= 2);   // 整小節的長音:前一小節是過門
}

/* ── 一句 ── */
function genPhrase(C, R, n, time, o){
  const meter = meterInfo(time), nG = meter.groups.length;
  let hit = null;
  if (o.last && R() < 0.55) { const opts = hitOptions(C, meter, n); hit = opts.length ? wpick(R, opts, h => h.w * (C.fresh.has(h.code) ? 3 : 1)) : null; }
  const wholeHit = hit && hit.k === nG;
  const fillBar = wholeHit ? n - 2 : n - 1;
  const S = C.cyms.length ? grooveSetup(C, R) : null;
  const bars = [];
  let fillPos = null, fillM = fillBar;
  for (let b = 0; b < n; b++) {
    const crashStart = b === 0 && C.crash && R() < (o.first ? 0.45 : 0.8);
    const hitFrom = b === n - 1 && hit ? nG - hit.k : null;
    let bar;
    if (b > fillBar) bar = { hand: [], feet: [] };
    else if (!S) {
      bar = lineBar(C, R, meter, b === fillBar ? "fill" : "groove", { crashStart, coord: o.coordBars.has(o.start + b), hitFrom });
      if (b === fillBar) { const f = bar.hand.find(e => e.role === "fill"); fillPos = f ? f.pos : 0; }
    } else {
      bar = { hand: [], feet: [] };
      const end = hitFrom ?? nG;
      let fs = b === fillBar ? (nG >= 2 && R() < 0.5 ? Math.max(1, Math.floor(nG / 2)) : 0) : end;
      if (fs > end) fs = end;
      grooveGroups(C, R, meter, b, S, { crashStart, vary: b > 0 }, bar.hand, bar.feet, fs);
      if (fs < end) { fillGroups(C, R, meter, fs, end, bar.hand, bar.feet); if (b === fillBar) fillPos = meter.starts[fs]; }
    }
    if (hitFrom != null) {
      const pos = meter.starts[hitFrom], note = { piece: C.crash ? "crash" : "snare" };
      if (C.accent && R() < 0.6) note.accent = true;
      bar.hand.push({ pos, code: hit.code, rest: false, notes: [note], role: "hit" });
      const kickOK = C.kick && C.maxV >= 2 && (C.amount !== "some" || o.coordBars.has(o.start + b));
      if (kickOK) bar.feet.push({ pos, code: hit.code, rest: false, notes: [{ piece: "kick" }], role: "hit" });
      else for (let g = hitFrom; g < nG; g++) bar.feet.push(groupRest(meter, g));
    }
    bars.push(bar);
  }
  if (fillPos == null) fillPos = 0;
  return { meter, bars, fillM, fillPos, hit };
}

/* 白名單裡的整拍休止合併成大的(二分、附點二分);整小節都沒有打 → [](整小節休止 = 全休止符,3 級起) */
function mergeRests(C, meter, evs){
  if (evs.length && evs.every(e => e.rest) && C.r("r1")) return [];
  const out = [];
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], gi = meter.starts.indexOf(e.pos);
    if (e.whole && gi >= 0) {
      const run = []; for (let j = i; j < evs.length && evs[j].whole && evs[j].pos === meter.starts[gi + (j - i)]; j++) run.push(evs[j]);
      if (meter.simple && meter.kinds[gi] === "q") {
        if (gi === 0 && run.length === 3 && meter.groups.length === 3 && C.r("r2.")) { out.push(restEv(e.pos, "2.")); i += 2; continue; }
        if (gi % 2 === 0 && run.length >= 2 && C.r("r2")) { out.push(restEv(e.pos, "2")); i += 1; continue; }
      }
      if (meter.compound && gi % 2 === 0 && run.length >= 2 && C.r("r2.")) { out.push(restEv(e.pos, "2.")); i += 1; continue; }
    }
    out.push(e);
  }
  return out;
}

/* 長度:總長度在範圍內、每一句在範圍內(常常每句一樣長;練習設定) */
function chooseLengths(C, R){
  const [tmin, tmax] = C.total, [pmin, pmax] = C.phrase;
  const totals = []; for (let t = tmin; t <= tmax; t++) totals.push(t);
  for (let tries = 0; tries < 50; tries++) {
    const T = pick(R, totals);
    const eq = []; for (let L = pmin; L <= pmax; L++) if (T % L === 0) eq.push(L);
    if (eq.length && R() < 0.6) { const L = pick(R, eq); return Array(T / L).fill(L); }
    // 隨機切(每一種切法機會一樣)
    const ways = [1]; for (let t = 1; t <= T; t++) { ways[t] = 0; for (let L = pmin; L <= Math.min(pmax, t); L++) ways[t] += ways[t - L]; }
    if (!ways[T]) continue;
    const out = []; let left = T;
    while (left > 0) {
      const opts = []; for (let L = pmin; L <= Math.min(pmax, left); L++) if (ways[left - L]) opts.push(L);
      const L = wpick(R, opts, L => ways[left - L]); out.push(L); left -= L;
    }
    return out;
  }
  throw new Error("Playback:找不到合乎範圍的長度");
}

/* 連結線(2 級起):過門 / 單線的音接到下一個同一個鼓件(下一個音下面沒有腳;不跨句子)。
   只接「跨拍」的:前一個音八分音符以上、結束在拍點(組的開頭或小節線;可以跨小節線);同一拍內的短音不連 */
function addTies(C, R, ph){
  const seq = [], meter = ph.meter, beatAt = new Set([...meter.starts, meter.len]);
  ph.bars.forEach((bar, b) => { const fs = new Set([...strikes(bar.feet).keys()]); for (const e of bar.hand) seq.push({ e, b, feet: fs.has(e.pos) }); });
  const cand = [];
  for (let i = 0; i + 1 < seq.length; i++) {
    const a = seq[i], z = seq[i + 1];
    if (a.e.rest || z.e.rest || z.feet || a.e.cont || a.e.tie) continue;
    const d = codeDur(a.e.code), end = a.e.pos + d;
    if (d < Q / 2 || !beatAt.has(end) || (end === meter.len ? z.b !== a.b + 1 || z.e.pos !== 0 : z.b !== a.b || z.e.pos !== end)) continue;
    if (!/^(fill|line)$/.test(a.e.role) || !/^(fill|line)$/.test(z.e.role)) continue;
    if (a.e.notes.length !== 1 || z.e.notes.length !== 1 || a.e.notes[0].piece === "crash") continue;
    cand.push([a.e, z.e]);
  }
  const n = cand.length ? 1 + (R() < 0.3 ? 1 : 0) : 0;
  for (let k = 0; k < n && cand.length; k++) {
    const [a, z] = cand.splice(Math.floor(R() * cand.length), 1)[0];
    if (a.tie || z.cont || z.tie) continue;
    a.tie = true; z.cont = true; z.notes = [{ piece: a.notes[0].piece }];
  }
}

const cleanNote = n => { const o = { piece: n.piece }; for (const k of ["accent", "ghost", "open", "closed", "flam", "drag"]) if (n[k]) o[k] = true; return o; };
const toEv = e => (e.rest ? { value: "r" + e.code } : { value: e.code, notes: e.notes.map(cleanNote), ...(e.tie ? { tie: true } : {}) });

/* ── 主程式 ── */
export function genChart(params, seed = 1){
  if (!params || !Array.isArray(params.time) || !params.time.length || !params.total || !params.phrase) throw new Error("Playback:參數不完整(用 playbackFor / playbackParams)");
  const C = config(params), R = rng(seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const chart = build(C, R, params, seed);
    if (chart) return chart;
  }
  throw new Error(`Playback:${params.grade} 級種子 ${seed} 產生不出合乎規則的題目`);
}

function build(C, R, params, seed){
  const lens = chooseLengths(C, R), total = lens.reduce((a, b) => a + b, 0);
  // 拍號:一份一個;8 級句子之間換 1–2 次(最多 3 種),優先換到相近的拍號
  const times = Array(lens.length).fill(wpick(R, C.times, t => (C.fresh.has(t) ? 3 : 1)));
  if (C.meterChange && lens.length > 1 && C.times.length > 1) {
    const k = Math.min(lens.length - 1, R() < 0.6 ? 1 : 2), bounds = [...Array(lens.length - 1).keys()].map(i => i + 1), at = [];
    while (at.length < k) at.push(bounds.splice(Math.floor(R() * bounds.length), 1)[0]);
    let cur = times[0];
    for (const i of at.sort((a, b) => a - b)) {
      const t = wpick(R, C.times.filter(x => x !== cur), x => (relatedTime(cur, x) ? 6 : 1));
      for (let j = i; j < lens.length; j++) times[j] = t;
      cur = t;
    }
  }
  // 1 級「部分 2 聲部」:挑 1 到一半的小節
  const coordBars = new Set();
  if (C.amount === "some") {
    const k = 1 + Math.floor(R() * Math.floor(total / 2)), all = [...Array(total).keys()];
    while (coordBars.size < k) coordBars.add(all.splice(Math.floor(R() * all.length), 1)[0]);
  }
  const phs = [];
  let start = 0;
  for (let i = 0; i < lens.length; i++) {
    const ph = genPhrase(C, R, lens[i], times[i], { first: i === 0, last: i === lens.length - 1, start, coordBars });
    ph.start = start; ph.time = times[i]; ph.n = lens[i];
    phs.push(ph); start += lens[i];
  }
  // 聲部數的規則
  const allBars = phs.flatMap(p => p.bars);
  const maxes = allBars.map(maxStrikes);
  if (Math.max(...maxes) > C.maxV) return null;
  if (C.maxV === 1 && allBars.some(b => b.hand.some(e => e.notes.length > 1))) return null;
  if (C.amount === "some") {
    const k = maxes.filter(x => x >= 2).length;
    if (k < 1 || k > Math.floor(total / 2) || allBars.some((b, i) => maxes[i] >= 2 && !coordBars.has(i))) return null;
  }
  if (C.amount === "mostly" && !(maxes.filter(x => x >= 2).length > total / 2)) return null;
  // 3 級起每題至少一個 3 個同時:沒有的話在律動的反拍(鈸 + 小鼓)下面加大鼓
  if (C.maxV >= 3 && !maxes.some(x => x >= 3) && !allBars.some(bar => kickUnder(C, R, null, bar, 3, ["groove"]))) return null;
  if (C.ties) for (const ph of phs) if (R() < 0.45) addTies(C, R, ph);

  // 力度:每句開頭(換了才寫);漸強 / 漸弱放在過門,接到下一句的新力度;sfz 放在某個過門的第一個音
  const dyn = [];
  if (C.marks.length) {
    let cur = wpick(R, C.marks, m => (C.fresh.has(m) ? 3 : 1));
    dyn.push({ m: 0, beat: 0, mark: cur });
    const wedged = new Set();
    for (let i = 1; i < phs.length; i++) {
      if (R() >= 0.55 || C.marks.length < 2) continue;
      const nm = wpick(R, C.marks.filter(m => m !== cur), m => (C.fresh.has(m) ? 3 : 1));
      const up = LEVELS.indexOf(nm) > LEVELS.indexOf(cur), prev = phs[i - 1];
      if (((up && C.cresc) || (!up && C.dim)) && R() < 0.7) {
        dyn.push({ m: prev.start + prev.fillM, beat: prev.fillPos / Q, mark: up ? "cresc" : "dim" });
        wedged.add(i - 1);
      }
      dyn.push({ m: phs[i].start, beat: 0, mark: nm });
      cur = nm;
    }
    if (C.sfz && R() < 0.5) {
      const cands = phs.map((p, i) => i).filter(i => !wedged.has(i));
      if (cands.length) {
        const ph = phs[pick(R, cands)], bar = ph.bars[ph.fillM];
        const e = bar.hand.find(x => x.role === "fill" && !x.rest && !x.cont && x.pos >= ph.fillPos);
        const m = ph.start + ph.fillM;
        // 不放在句子的第一拍(單句的譜要在那裡補力度記號)
        if (e && !(m === ph.start && e.pos === 0) && !dyn.some(d => d.m === m && Math.round(d.beat * Q) === e.pos && !/cresc|dim/.test(d.mark))) dyn.push({ m, beat: e.pos / Q, mark: "sfz" });
      }
    }
  }

  // 輸出
  const anyFeet = allBars.some(b => b.feet.some(e => !e.rest));
  const measures = [];
  phs.forEach((ph, i) => {
    ph.bars.forEach((bar, b) => {
      const m = { voices: [mergeRests(C, ph.meter, bar.hand).map(toEv)] };
      // 腳整小節沒有打、還沒有全休止符(Initial–2 級):不印休止符(hideEmpty)
      if (anyFeet) {
        if (bar.feet.every(e => e.rest) && !C.r("r1")) { m.voices.push([]); m.hideEmpty = true; }
        else m.voices.push(mergeRests(C, ph.meter, bar.feet).map(toEv));
      }
      if (b === 0 && i > 0 && ph.time !== phs[i - 1].time) m.time = ph.time;
      measures.push(m);
    });
  });
  dyn.sort((a, b) => a.m - b.m || a.beat - b.beat);
  const phrases = phs.map(ph => ({
    bars: ph.n, start: ph.start, time: ph.time, measures: measures.slice(ph.start, ph.start + ph.n),
    dyn: dyn.filter(d => d.m >= ph.start && d.m < ph.start + ph.n).map(d => ({ ...d, m: d.m - ph.start }))
  }));
  const usedTimes = [...new Set(times)];
  const notes = ["totalExcludesRepeat", "design", "noTempo"];
  if (C.maxV > 1 || C.amount) notes.push("voices");
  if (allBars.some(b => b.hand.some(e => e.notes.some(n => n.piece === "tomFloor")))) notes.push("lowTom");
  if ((params.extra || []).some(x => x === "roll" || x === "ruff")) notes.push("noRollRuff");
  if ((params.extra || []).includes("fullKit")) notes.push("fullKit");
  if (usedTimes.some(t => /\/8$/.test(t))) notes.push("compound");
  if (C.indep) notes.push("independence");
  if ((params.extra || []).includes("anyTerms")) notes.push("anyTerms");
  if (C.meterChange) notes.push("meterChange");
  if (C.rim) notes.push("rimClick");
  if (C.amount === "only") notes.push("singleLine");
  if (usedTimes.includes("2/2") && C.cyms.length) notes.push("cutTime");
  return {
    grade: params.grade, seed, time: times[0], times: usedTimes, phrases, dyn, totalBars: total,
    spec: { lines: 5, time: times[0], measures, dyn },
    notes, src: params.src || []
  };
}

/* 一句單獨的譜(聽力回打用):拍號 = 這一句的;沒有腳的話不畫腳的聲部;
   開頭沒有力度記號的話,補上整份譜在這一句開頭之前最後一個力度(p mp mf f pp ff;不含漸強漸弱、sfz) */
export function phraseSpec(chart, i){
  const ph = chart.phrases[i];
  if (!ph) return null;
  const feet = ph.measures.some(m => m.voices[1] && m.voices[1].some(e => e.notes));
  const dyn = ph.dyn.map(d => ({ ...d }));
  if (!dyn.some(d => d.m === 0 && d.beat === 0 && LEVELS.includes(d.mark))) {
    const prev = chart.dyn.filter(d => LEVELS.includes(d.mark) && (d.m < ph.start || (d.m === ph.start && d.beat === 0))).pop();
    if (prev) dyn.unshift({ m: 0, beat: 0, mark: prev.mark });
  }
  return { lines: 5, time: ph.time, dyn, measures: ph.measures.map(m => ({ voices: feet ? m.voices : [m.voices[0]], ...(feet && m.hideEmpty ? { hideEmpty: true } : {}) })) };
}
