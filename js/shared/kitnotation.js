/* 鼓組譜 → MusicXML(OSMD 畫)。純函式:不碰 DOM、不 import i18n,Node 可以直接跑(tools/test/checks/kitxml.mjs)。
   鼓件的位置與符頭照 data/drumkey.json(STAGES.md 決定 3;大部分是常見寫法、待依 PAS 指南核對,圖例會標出來 → js/shared/legend.js)。
   各種記號 OSMD 畫不畫得出來、哪些要自己補畫:docs/NOTATION.md。

   scoreXML(spec) → MusicXML 字串;資料不合法就丟出 Error(訊息是中文,說哪一小節哪個聲部)
   spec = {
     lines: 5 | 1          五線(整組鼓)/ 單線(RSL 小鼓視奏;只能有小鼓,畫在線上)
     time: "4/4"           拍號:x/2、x/4、x/8(1–15 拍);不規則的 x/8 可以寫分組,例如 "2+2+3/8"(連桿照分組;每一組只能是 2 或 3 個八分音符,
                           x/2、x/4 不能寫分組 → 丟出錯誤)。沒寫分組時:5/8 = 3+2、7/8 = 2+2+3、其他奇數 x/8 = 2+…+2+1(常見寫法,待核對)
     showTime: true        印不印拍號
     measures: [{ voices: [手, 腳], slash: false, time: "6/8", hideEmpty: false }]
                           voices[0] = 手(voice 1、符桿朝上)、voices[1] = 腳(voice 2、符桿朝下;只能有 kick、hhFoot);
                           不滿一小節的部分自動補休止;整份譜都沒有腳的話就不畫 voice 2(手的一個聲部)。
                           slash = 自由發揮的小節:每拍一個斜線符頭(不畫符桿),內容不看;time = 從這一小節起換拍號;
                           hideEmpty = 這一小節空的聲部(voices[i] 是 [] 或沒寫)不印整小節休止符(<note print-object="no">,時值照算、OSMD 不畫;
                           例如還沒有全休止符的級數,腳整小節沒有打)
     dyn: [{ m, beat, mark, end }]
                           m = 第幾小節(0 起算)、beat = 從小節開頭算幾個四分音符(0 = 第一拍;要對到某個音或休止符的開頭)、
                           mark = p mp mf f pp ff sfz | cresc | dim(cresc/dim 畫成 wedge,end = { m, beat } 結束的位置,沒寫就到那一小節結束);
                           同一個位置(m + beat)只能有一個力度記號、一個 wedge 開始
     title: ""             work-title(OSMD 不畫標題)
     key: drumkey.json     沒給就用 examdata.js 已經載入的那份
   }
   ev(一個音、一個和弦或一個休止符)= {
     value: "8"            時值代號(STAGES.md §2):1 2 2. 4 4. 8 8. 16 16. 32;連音 8t3 4t3 16t3 16t5 16t6 16t7 32t9 32t10;二連音 dup;
                           休止符寫 "r8"(或 value:"8", rest:true)
     tie: true             連到同一聲部的下一個音(同一個鼓件)
     tuplet: "stop"        連音自動分組:同一種比例(3:2、5:4……)連續的音是一段,加起來等於段裡某一種的一組長度(span),
                           而且至少一拍(段裡最長的一組比一拍短時 = 那一組的長度)就結束一組。所以 [8t3, 16t3, 16t3, 8t3] 是一組「3」(一拍)、
                           [16t3 ×3] 是半拍一組、[4t3, 8t3] 是一拍一組、[4t3 ×3] 是兩拍一組;
                           "stop" = 在這裡提早結束(加起來要剛好是段裡某一種的一組長度,例如 [8t3, 16t3] = 半拍的 16t3 一組);
                           "continue" = 已經滿一組也不要在這裡結束(例如 [16t3 ×3(第 3 個寫 continue), 16t3, 8t3] 一拍一組)
     roll: 2               滾奏斜線數(1–3;tremolo,OSMD 會畫)
     buzz: true            多次反彈滾奏(符桿上的 z;<tremolo type="unmeasured">,OSMD 會畫)
                           roll / buzz 只准手的聲部。roll 的時值要四分音符以上(沒有連桿:1 2 2. 4 4. 4t3):八分音符的符尾 / 連桿
                           加上斜線,畫出來分不清是幾條(常理;待依 PAS 指南核對);buzz 要八分音符以上(含附點、8t3、4t3、二連音),
                           十六分音符以下(含 16t、32t 連音)不可
     notes: [{ piece, accent, ghost, open, closed, flam, drag }]
                           piece = drumkey.json 的鼓件 id;ghost = 鬼音(符頭加括號);open / closed = HH 開 o / 閉 +
                           (只准手打的 hh;hhOpen、hhClosed 本身就帶 o / +,不能再寫相反的;開閉不能同時;連結線接續的音不再畫 o / +);
                           flam = 一個帶斜線的八分裝飾音、drag = 兩個十六分裝飾音(只准手的聲部;同一個音或和弦只能 flam、drag 擇一)
   }
   其他匯出:DIV、valueInfo(code)、parseTime(time)、checkScore(spec) → 錯誤清單(不丟出)、piecesUsed(spec) → 用到的鼓件(圖例用)、
   osmdXML(xml) → 交給 OSMD 的版本(<open/> 換成 <open-string/>,見 docs/NOTATION.md)、legendSrc(key, piece, lines) → 圖例格子的出處小字、
   scoreMarks(xml) 不在這裡:OSMD 不畫的記號(鬼音括號、開 HH 的 o)由 legend.js 的 decorate 照 MusicXML 補畫 */
import { VALUE_CODES, drumKeyCached } from "./examdata.js";

/* 一個四分音符 = 2520(8、9、5、7、3 的公倍數:32 分音符、九連音、五連音、七連音、三連音都是整數) */
export const DIV = 2520;
const BASE = { "1": [4, "whole", 0], "2": [2, "half", 0], "4": [1, "quarter", 0], "8": [0.5, "eighth", 1], "16": [0.25, "16th", 2], "32": [0.125, "32nd", 3] };
// 連音:[基本時值, 實際個數, 佔幾個基本時值, 一組的長度(四分音符)]
const TUP = {
  "8t3": ["8", 3, 2, 1], "4t3": ["4", 3, 2, 2], "16t3": ["16", 3, 2, 0.5], "16t5": ["16", 5, 4, 1], "16t6": ["16", 6, 4, 1],
  "16t7": ["16", 7, 4, 1], "32t9": ["32", 9, 8, 1], "32t10": ["32", 10, 8, 1], "dup": ["8", 2, 3, 1.5]
};
export const DYN_MARKS = ["pp", "p", "mp", "mf", "f", "ff", "sfz"];
export const WEDGES = { cresc: "crescendo", dim: "diminuendo" };
const FEET = new Set(["kick", "hhFoot"]);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* 時值代號 → { code, type, dot, beams, dur(divisions), tuplet:{actual, normal, type, span} | null };不認得回 null */
export function valueInfo(code){
  if (!VALUE_CODES.includes(code)) return null;
  if (TUP[code]) {
    const [b, actual, normal, span] = TUP[code], [q, type, beams] = BASE[b];
    return { code, type, dot: false, beams, dur: q * DIV * normal / actual, tuplet: { actual, normal, type, span: span * DIV, ratio: actual + ":" + normal } };
  }
  const dot = code.endsWith("."), [q, type, beams] = BASE[dot ? code.slice(0, -1) : code];
  return { code, type, dot, beams, dur: q * DIV * (dot ? 1.5 : 1), tuplet: null };
}

/* 拍號 → { beats, type, len(一小節 divisions), groups(連桿 / 補休止的分組,divisions), text } */
export function parseTime(time){
  const m = /^((\d+)(\+\d+)*)\/(2|4|8)$/.exec(String(time || ""));
  if (!m) throw new Error(`拍號寫錯:${time}`);
  const parts = m[1].split("+").map(Number), beats = parts.reduce((a, b) => a + b, 0), type = Number(m[4]);
  if (beats < 1 || beats > 15) throw new Error(`拍號寫錯:${time}`);
  if (parts.length > 1 && type !== 8) throw new Error(`拍號分組只支援 x/8(${time}):x/2、x/4 照拍子分組,不寫加號`);
  if (parts.length > 1 && parts.some(p => p !== 2 && p !== 3)) throw new Error(`拍號分組每一組要是 2 或 3 個八分音符(${time})`);
  const unit = DIV * 4 / type, len = beats * unit;
  let groups;
  if (parts.length > 1) groups = parts.map(p => p * unit);
  else if (type === 8 && beats % 3 === 0) groups = Array(beats / 3).fill(3 * unit);            // 3/8、6/8、9/8、12/8:附點四分一組
  else if (type === 8 && beats === 5) groups = [3 * unit, 2 * unit];
  else if (type === 8 && beats === 7) groups = [2 * unit, 2 * unit, 3 * unit];
  else if (type === 8) groups = [...Array(beats >> 1).fill(2 * unit), ...(beats % 2 ? [unit] : [])];
  else groups = Array(len / DIV).fill(DIV);                                                      // x/4、x/2:每個四分音符一組
  return { beats, type, len, groups, text: m[1] + "/" + type, parts };
}

/* 一個 ev 整理成內部格式;不合法丟出 Error */
function normEv(ev, where){
  if (!ev || typeof ev !== "object") throw new Error(`${where}:不是物件`);
  let code = String(ev.value ?? ""), rest = !!ev.rest;
  if (code[0] === "r") { rest = true; code = code.slice(1); }
  const info = valueInfo(code);
  if (!info) throw new Error(`${where}:時值代號不認得(${ev.value})`);
  const notes = rest ? [] : (ev.notes || []);
  if (!rest && !notes.length) throw new Error(`${where}:音符沒有 notes(休止符要寫 r)`);
  if (ev.roll != null && !(Number.isInteger(ev.roll) && ev.roll >= 1 && ev.roll <= 3)) throw new Error(`${where}:roll 要是 1–3`);
  if (ev.roll && ev.buzz) throw new Error(`${where}:roll 和 buzz 只能選一個`);
  if (ev.tuplet != null && ev.tuplet !== "stop" && ev.tuplet !== "continue") throw new Error(`${where}:tuplet 只能是 "stop" 或 "continue"(${ev.tuplet})`);
  if (ev.tuplet != null && !info.tuplet) throw new Error(`${where}:不是連音卻寫了 tuplet`);
  return { info, rest, notes, tie: !!ev.tie && !rest, roll: rest ? 0 : (ev.roll || 0), buzz: !rest && !!ev.buzz,
    tupletStop: ev.tuplet === "stop", tupletCont: ev.tuplet === "continue", src: ev };
}

/* 連音分組:同一種比例(3:2、5:4……)連續的音是一段;加起來等於段裡某一種的一組長度(span)、而且 ≥ min(一拍, 段裡最長的 span)
   就結束一組(所以 8t3 與 16t3 混在一拍裡是一組「3」;16t3 ×3 是半拍一組);
   "stop" 提早結束(要剛好是段裡某一種的一組長度)、"continue" 到了也不結束(之後的長度上限 = 這種比例最長的 span) */
const bt = d => +(d / DIV).toFixed(3);
const RATIO_MAX = {};
for (const [, actual, normal, span] of Object.values(TUP)) { const r = actual + ":" + normal; RATIO_MAX[r] = Math.max(RATIO_MAX[r] || 0, span * DIV); }
function tupletGroups(evs, where){
  let open = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], t = e.info.tuplet, at = `${where} 第 ${i + 1} 個`;
    if (!t) { if (open) throw new Error(`${at}:連音還沒結束就接了一般時值`); continue; }
    if (open && open.ratio !== t.ratio) throw new Error(`${at}:連音還沒結束就換了另一種連音(${open.ratio} → ${t.ratio})`);
    if (!open) { open = { ratio: t.ratio, acc: 0, spans: new Set(), max: 0, members: [] }; e.tupStart = true; }
    open.acc += e.info.dur; open.spans.add(t.span); open.max = Math.max(open.max, t.span); open.members.push(e);
    e.tupGroup = open;
    const limit = open.cont ? RATIO_MAX[open.ratio] : open.max;
    if (open.acc > limit) throw new Error(`${at}:連音一組超過長度(${bt(open.acc)} 拍 > ${bt(limit)} 拍)`);
    if (e.tupletCont) { open.cont = true; continue; }
    if (e.tupletStop && !open.spans.has(open.acc)) throw new Error(`${at}:連音在這裡結束(stop)的話長度 ${bt(open.acc)} 拍不是完整的一組`);
    if (e.tupletStop || (open.spans.has(open.acc) && open.acc >= Math.min(DIV, open.max))) { e.tupStop = true; open.span = open.acc; open = null; }
  }
  if (open) throw new Error(`${where}:連音最後一組沒有結束`);
}

/* 補休止:從 pos 補到 end(都不在連音裡);拍點對齊的地方用大的休止符 */
const REST_FILL = ["8", "16", "32"].map(valueInfo);
function fillRests(pos, end, meter, where){
  const out = [];
  const bounds = [0]; for (const g of meter.groups) bounds.push(bounds[bounds.length - 1] + g);
  while (pos < end) {
    const gi = bounds.findIndex(b => b > pos), gEnd = Math.min(end, bounds[gi]), gStart = bounds[gi - 1];
    if (pos === gStart && gEnd === bounds[gi]) {
      // 一整組:附點四分(複拍子)、四分;4/4、2/2 的第 1、3 拍開始的兩拍可以合成二分休止符
      const g = bounds[gi] - gStart;
      if (g === DIV && meter.type !== 8 && pos % (2 * DIV) === 0 && bounds[gi + 1] != null && bounds[gi + 1] <= end && meter.len % (2 * DIV) === 0) {
        out.push(restEv("2")); pos += 2 * DIV; continue;
      }
      const code = g === DIV ? "4" : g === 1.5 * DIV ? "4." : g === 0.5 * DIV ? "8" : g === 3 * DIV ? "2." : null;
      if (code) { out.push(restEv(code)); pos += g; continue; }
    }
    const v = REST_FILL.find(v => v.dur <= gEnd - pos && pos % v.dur === 0);
    if (!v) throw new Error(`${where}:補不了休止符(位置 ${pos / DIV} 拍,可能是連音沒有結束)`);
    out.push(restEv(v.code)); pos += v.dur;
  }
  return out;
}
const restEv = code => ({ info: valueInfo(code), rest: true, notes: [], tie: false, roll: 0, buzz: false, filled: true });

/* 一組連桿裡每一層的 begin / continue / end / hook(照 js/tech/notation.js) */
function beamLevels(group){
  const out = group.map(() => []);
  const max = Math.max(0, ...group.map(n => (n.rest ? 0 : n.info.beams)));
  if (group.filter(n => !n.rest && n.info.beams >= 1).length < 2) return out;
  for (let L = 1; L <= max; L++) {
    const has = group.map(n => !n.rest && n.info.beams >= L);
    for (let i = 0; i < group.length; i++) {
      if (!has[i]) continue;
      const prev = i > 0 && has[i - 1], next = i + 1 < group.length && has[i + 1];
      if (prev && next) out[i].push([L, "continue"]);
      else if (!prev && next) out[i].push([L, "begin"]);
      else if (prev && !next) out[i].push([L, "end"]);
      else if (L > 1 && (i > 0 && has.slice(0, i).some(Boolean) || has.slice(i + 1).some(Boolean))) out[i].push([L, i + 1 < group.length && has.slice(i + 1).some(Boolean) && !has.slice(0, i).some(Boolean) ? "forward hook" : "backward hook"]);
    }
  }
  return out;
}
/* 連桿:每個分組(拍)裡連續、沒有休止符隔開的八分以下音符連在一起 */
function assignBeams(evs, meter){
  const bounds = [0]; for (const g of meter.groups) bounds.push(bounds[bounds.length - 1] + g);
  let run = [], runG = -1;
  const flush = () => {
    // 休止符把連桿切開
    let seg = [];
    const segs = [];
    for (const e of run) { if (e.rest || e.info.beams < 1) { if (seg.length) segs.push(seg); seg = []; } else seg.push(e); }
    if (seg.length) segs.push(seg);
    for (const s of segs) { const lv = beamLevels(s); s.forEach((e, i) => { e.beams = lv[i]; }); }
    run = [];
  };
  for (const e of evs) {
    e.beams = [];
    const g = bounds.findIndex(b => b > e.pos) - 1, end = e.pos + e.info.dur;
    const inGroup = end <= bounds[g + 1];
    if (g !== runG || !inGroup) { flush(); runG = g; }
    if (inGroup) run.push(e); else { flush(); runG = -1; }
  }
  flush();
}

/* 修飾記號合不合理(不合理丟出 Error):
   - open / closed:只准手打的 hh 類(hh、hhOpen、hhClosed);開閉不能同時(hhOpen 不能寫 closed、hhClosed 不能寫 open)
   - flam / drag:只准手的聲部;同一個音、同一個和弦只能擇一
   - roll / buzz:只准手的聲部;roll 要四分音符以上(沒有連桿:1 2 4 含附點、4t3),buzz 要八分音符以上(連桿 ≤ 1 條:再加 8 8. 8t3 dup) */
const HH_HAND = new Set(["hh", "hhOpen", "hhClosed"]);
function checkMods(e, where, voice, key){
  if (e.rest) return;
  let fl = false, dr = false;
  for (const n of e.notes) {
    const mark = key.pieces[n.piece].mark;
    if ((n.open || n.closed) && (voice !== 1 || !HH_HAND.has(n.piece))) throw new Error(`${where}:開 / 閉(open / closed)只能寫在手打的 Hi-hat(${n.piece})`);
    if ((n.open || mark === "o") && (n.closed || mark === "+")) throw new Error(`${where}:Hi-hat 不能同時開又閉(${n.piece})`);
    if ((n.flam || n.drag) && voice !== 1) throw new Error(`${where}:Flam / Drag 只能在手的聲部(${n.piece})`);
    if (n.flam && n.drag) throw new Error(`${where}:同一個音 Flam、Drag 只能選一個(${n.piece})`);
    fl = fl || !!n.flam; dr = dr || !!n.drag;
  }
  if (fl && dr) throw new Error(`${where}:同一個和弦 Flam、Drag 只能選一個`);
  if (e.roll || e.buzz) {
    if (voice !== 1) throw new Error(`${where}:滾奏(roll / buzz)只能在手的聲部`);
    if (e.roll && e.info.beams > 0) throw new Error(`${where}:滾奏斜線(roll)的時值要四分音符以上,八分音符以下不可(${e.info.code})`);
    if (e.buzz && e.info.beams > 1) throw new Error(`${where}:多次反彈(buzz)的時值要八分音符以上,十六分音符以下不可(${e.info.code})`);
  }
}

/* 一個聲部整理好(補休止、連音、連桿);voice = 1 手、2 腳 */
function buildVoice(raw, meter, where, voice, key, lines, hide = false){
  const evs = (raw || []).map((ev, i) => normEv(ev, `${where} 第 ${i + 1} 個`));
  for (const e of evs) for (const n of e.notes) {
    const p = key.pieces[n.piece];
    if (!p) throw new Error(`${where}:鼓件不在 drumkey.json(${n.piece})`);
    if (lines === 1 && n.piece !== key.singleLine.piece) throw new Error(`${where}:單線譜只能有${key.singleLine.piece}(${n.piece})`);
    if (voice === 2 && !FEET.has(n.piece)) throw new Error(`${where}:腳的聲部只能有 kick、hhFoot(${n.piece})`);
    if (voice === 1 && FEET.has(n.piece)) throw new Error(`${where}:${n.piece} 要放在腳的聲部(voices[1])`);
  }
  evs.forEach((e, i) => checkMods(e, `${where} 第 ${i + 1} 個`, voice, key));
  tupletGroups(evs, where);
  let pos = 0;
  for (const e of evs) { e.pos = pos; pos += e.info.dur; }
  if (pos > meter.len) throw new Error(`${where}:時值加起來 ${pos / DIV} 拍,超過一小節 ${meter.len / DIV} 拍`);
  if (!evs.length) return [{ measureRest: true, hidden: !!hide, rest: true, notes: [], pos: 0, info: { dur: meter.len }, beams: [] }];
  const out = [...evs, ...fillRests(pos, meter.len, meter, where)];
  pos = 0; for (const e of out) { e.pos = pos; pos += e.info.dur; }
  assignBeams(out, meter);
  return out;
}

const pitchOf = (key, piece, lines) => {
  if (lines === 1) return ["E", 4];
  const p = key.pieces[piece]; return [p.step, p.oct];
};
const unpitched = ([s, o]) => `<unpitched><display-step>${s}</display-step><display-octave>${o}</display-octave></unpitched>`;
const headXML = (key, n) => {
  const h = key.pieces[n.piece].head, paren = n.ghost ? ' parentheses="yes"' : "";
  return h === "normal" && !paren ? "" : `<notehead${paren}>${h}</notehead>`;
};
const isOpen = (key, n) => !!n.open || key.pieces[n.piece].mark === "o";
const isClosed = (key, n) => !!n.closed || key.pieces[n.piece].mark === "+";

/* 一個 ev → <note> 們(裝飾音、主音、和弦) */
function noteXML(e, ctx){
  const { voice, key, lines, nextTie } = ctx, stem = voice === 1 ? "up" : "down", out = [];
  const tm = e.info && e.info.tuplet ? `<time-modification><actual-notes>${e.info.tuplet.actual}</actual-notes><normal-notes>${e.info.tuplet.normal}</normal-notes><normal-type>${e.info.tuplet.type}</normal-type></time-modification>` : "";
  if (e.measureRest) return [`<note${e.hidden ? ' print-object="no"' : ""}>${restEl(ctx, true)}<duration>${e.info.dur}</duration><voice>${voice}</voice><type>whole</type></note>`];
  if (e.rest) {
    return [`<note>${restEl(ctx, false)}<duration>${e.info.dur}</duration><voice>${voice}</voice><type>${e.info.type}</type>${e.info.dot ? "<dot/>" : ""}${tm}` +
      (e.tupStart || e.tupStop ? `<notations>${tupletXML(e)}</notations>` : "") + `</note>`];
  }
  // 裝飾音(和弦裡有 flam / drag 的鼓件各一個)
  const fl = e.notes.filter(n => n.flam), dr = e.notes.filter(n => n.drag);
  fl.forEach((n, i) => out.push(`<note><grace slash="yes"/>${i ? "<chord/>" : ""}${unpitched(pitchOf(key, n.piece, lines))}<voice>${voice}</voice><type>eighth</type><stem>${stem}</stem>${headXML(key, { piece: n.piece })}` +
    (i ? "" : `<notations><slur type="start" number="2" placement="${voice === 1 ? "below" : "above"}"/></notations>`) + `</note>`));
  for (let k = 0; k < 2 && dr.length; k++) dr.forEach((n, i) => out.push(`<note><grace/>${i ? "<chord/>" : ""}${unpitched(pitchOf(key, n.piece, lines))}<voice>${voice}</voice><type>16th</type><stem>${stem}</stem>${headXML(key, { piece: n.piece })}` +
    (i ? "" : `<beam number="1">${k ? "end" : "begin"}</beam><beam number="2">${k ? "end" : "begin"}</beam>`) +
    (i || k || fl.length ? "" : `<notations><slur type="start" number="2" placement="${voice === 1 ? "below" : "above"}"/></notations>`) + `</note>`));
  // 和弦:由低到高(OSMD 不在乎順序;固定順序讓輸出穩定)
  const notes = [...e.notes].sort((a, b) => ord(pitchOf(key, a.piece, lines)) - ord(pitchOf(key, b.piece, lines)));
  notes.forEach((n, i) => {
    const nt = [], art = [], tech = [];
    if (i === 0) {
      if (fl.length || dr.length) nt.push('<slur type="stop" number="2"/>');
      nt.push(tupletXML(e));
      if (e.roll) nt.push(`<ornaments><tremolo type="single">${e.roll}</tremolo></ornaments>`);
      if (e.buzz) nt.push(`<ornaments><tremolo type="unmeasured">0</tremolo></ornaments>`);
    }
    if (ctx.prevTie && ctx.prevTie.has(n.piece)) nt.push('<tied type="stop"/>');
    if (e.tie && nextTie && nextTie.has(n.piece)) nt.push('<tied type="start"/>');
    if (n.accent) art.push(`<accent placement="${voice === 1 ? "above" : "below"}"/>`);
    // 連結線接續的音:開 / 閉只畫在第一個音
    const cont = ctx.prevTie && ctx.prevTie.has(n.piece);
    if (!cont && isOpen(key, n)) tech.push('<open placement="above"/>');
    else if (!cont && isClosed(key, n)) tech.push('<stopped placement="above"/>');
    if (art.length) nt.push(`<articulations>${art.join("")}</articulations>`);
    if (tech.length) nt.push(`<technical>${tech.join("")}</technical>`);
    const ties = (ctx.prevTie && ctx.prevTie.has(n.piece) ? '<tie type="stop"/>' : "") + (e.tie && nextTie && nextTie.has(n.piece) ? '<tie type="start"/>' : "");
    const body = nt.filter(Boolean).join("");
    out.push(`<note>${i ? "<chord/>" : ""}${unpitched(pitchOf(key, n.piece, lines))}<duration>${e.info.dur}</duration>${ties}<voice>${voice}</voice><type>${e.info.type}</type>${e.info.dot ? "<dot/>" : ""}${tm}<stem>${stem}</stem>${headXML(key, n)}` +
      (i ? "" : e.beams.map(([L, v]) => `<beam number="${L}">${v}</beam>`).join("")) + (body ? `<notations>${body}</notations>` : "") + `</note>`);
  });
  return out;
}
const ord = ([s, o]) => o * 7 + "CDEFGAB".indexOf(s);
/* 休止符:兩個聲部時手的休止符放高、腳的放低(不跟另一個聲部疊在一起);整小節休止符(全休止符掛在線下)腳的放在 G4 */
const REST_AT = { 1: ["C", 5], 2: ["E", 4] }, MREST_AT = { 1: ["D", 5], 2: ["G", 4] };
const restEl = (ctx, measure) => {
  const a = measure ? ' measure="yes"' : "";
  if (ctx.voices !== 2) return `<rest${a}/>`;
  const [s, o] = (measure ? MREST_AT : REST_AT)[ctx.voice];
  return `<rest${a}><display-step>${s}</display-step><display-octave>${o}</display-octave></rest>`;
};
function tupletXML(e){
  if (!e.tupStart && !e.tupStop) return "";
  const g = e.tupGroup;
  const bracket = g.members.some(x => x.rest || x.info.beams < 1) ? "yes" : "no";
  return (e.tupStart ? `<tuplet type="start" bracket="${bracket}" show-number="actual"/>` : "") + (e.tupStop ? `<tuplet type="stop"/>` : "");
}

/* 自由發揮的小節:每一組(拍)一個斜線符頭,不畫符桿 */
function slashXML(meter, lines){
  const pitch = lines === 1 ? ["E", 4] : ["B", 4];
  return meter.groups.map(g => {
    const code = g === DIV ? "4" : g === 1.5 * DIV ? "4." : g === 0.5 * DIV ? "8" : g === 2 * DIV ? "2" : "4";
    const v = valueInfo(code);
    return `<note>${unpitched(pitch)}<duration>${g}</duration><voice>1</voice><type>${v.type}</type>${v.dot ? "<dot/>" : ""}<stem>none</stem><notehead>slash</notehead></note>`;
  });
}

function dynXML(d, placement){
  if (WEDGES[d.mark]) return `<direction placement="${placement}"><direction-type><wedge type="${WEDGES[d.mark]}"/></direction-type></direction>`;
  if (d.mark === "stop") return `<direction placement="${placement}"><direction-type><wedge type="stop"/></direction-type></direction>`;
  return `<direction placement="${placement}"><direction-type><dynamics><${d.mark}/></dynamics></direction-type></direction>`;
}

/* 整份譜 → MusicXML */
export function scoreXML(spec){
  const key = spec.key || drumKeyCached();
  if (!key || !key.pieces) throw new Error("還沒有載入 drumkey.json");
  const lines = spec.lines === 1 ? 1 : 5;
  if (spec.lines != null && spec.lines !== 1 && spec.lines !== 5) throw new Error(`lines 只能是 1 或 5(${spec.lines})`);
  const measures = spec.measures || [];
  if (!measures.length) throw new Error("沒有小節");
  const showTime = spec.showTime !== false;
  const placement = lines === 1 ? "below" : "above";
  // 有沒有腳的聲部:整份譜任何一小節有,每一小節都畫(沒有的補整小節休止)
  const feet = lines === 5 && measures.some(m => !m.slash && m.voices && m.voices[1] && m.voices[1].length);
  if (lines === 1 && measures.some(m => m.voices && m.voices[1] && m.voices[1].length)) throw new Error("單線譜只有一個聲部(voices[1] 要是空的)");
  // 力度:照小節分好,wedge 補上結束的位置
  const dyn = measures.map(() => []);
  for (const [i, d] of (spec.dyn || []).entries()) {
    const where = `力度第 ${i + 1} 個`;
    if (!d || !Number.isInteger(d.m) || d.m < 0 || d.m >= measures.length) throw new Error(`${where}:小節 m 不對(${d && d.m})`);
    if (!(typeof d.beat === "number" && d.beat >= 0 && isFinite(d.beat))) throw new Error(`${where}:beat 不對(${d.beat})`);
    if (!DYN_MARKS.includes(d.mark) && !WEDGES[d.mark]) throw new Error(`${where}:不認得的力度記號(${d.mark})`);
    const at = Math.round(d.beat * DIV), kind = WEDGES[d.mark] ? "wedge" : "dyn";
    if (dyn[d.m].some(x => x.at === at && x.kind === kind)) throw new Error(`${where}:第 ${d.m + 1} 小節 ${d.beat} 拍已經有${kind === "wedge" ? "漸強 / 漸弱" : "力度記號"}了(同一個位置只能一個)`);
    dyn[d.m].push({ at, mark: d.mark, voice: 1, kind });
    if (WEDGES[d.mark]) {
      const end = d.end || { m: d.m, beat: null };
      if (!Number.isInteger(end.m) || end.m < d.m || end.m >= measures.length) throw new Error(`${where}:wedge 結束的小節不對(${end.m})`);
      dyn[end.m].push({ at: end.beat == null ? null : Math.round(end.beat * DIV), mark: "stop", wedgeEnd: true });
    }
  }
  let meter = parseTime(spec.time || "4/4"), prevTime = null;
  const xm = [];
  let tieCarry = [null, null];   // 上一小節最後一個音的 tie(跨小節的連結線)
  measures.forEach((m, mi) => {
    if (m.time) meter = parseTime(m.time);
    const where = `第 ${mi + 1} 小節`;
    const attrs = [];
    if (mi === 0) attrs.push(`<divisions>${DIV}</divisions><key print-object="no"><fifths>0</fifths></key>`);
    if (meter.text !== prevTime) {
      const beats = meter.parts.length > 1 ? meter.parts.join("+") : meter.beats;
      attrs.push(`<time${showTime ? "" : ' print-object="no"'}><beats>${beats}</beats><beat-type>${meter.type}</beat-type></time>`);
      prevTime = meter.text;
    }
    if (mi === 0) attrs.push(`<clef><sign>percussion</sign></clef><staff-details><staff-lines>${lines}</staff-lines></staff-details>`);
    const body = [];
    if (m.pct) {
      // 一小節反覆記號(跟前一小節一模一樣):小節裡放看不見的整小節休止,% 記號由畫譜的人畫(js/tech/route.js 的 drawPct)
      body.push(`<note print-object="no"><rest measure="yes"/><duration>${meter.len}</duration><voice>1</voice></note>`);
      if (feet) body.push(`<backup><duration>${meter.len}</duration></backup><note print-object="no"><rest measure="yes"/><duration>${meter.len}</duration><voice>2</voice></note>`);
      tieCarry = [null, null];
    } else if (m.slash) {
      body.push(...slashXML(meter, lines));
      tieCarry = [null, null];
      // 力度在斜線小節:放在對應的拍上
      const ds = dyn[mi];
      if (ds.length) body.unshift(...ds.filter(d => d.at === 0).map(d => dynXML(d, placement)));
      body.push(...ds.filter(d => d.at === null || d.at === meter.len).map(d => dynXML(d, placement)));
      for (const d of ds) if (d.at !== 0 && d.at !== null && d.at !== meter.len && meter.groups.reduce((a, g, i) => (a.push(a[i] + g), a), [0]).indexOf(d.at) < 0) throw new Error(`${where}:力度的位置對不到拍(${d.at / DIV})`);
    } else {
      const vs = [buildVoice(m.voices && m.voices[0], meter, where + " 手", 1, key, lines, m.hideEmpty)];
      if (feet) vs.push(buildVoice(m.voices && m.voices[1], meter, where + " 腳", 2, key, lines, m.hideEmpty));
      const used = new Set();
      vs.forEach((evs, vi) => {
        const voice = vi + 1;
        if (vi) body.push(`<backup><duration>${meter.len}</duration></backup>`);
        let prevTie = tieCarry[vi];
        evs.forEach((e, ei) => {
          // 這個位置的力度記號(手的聲部優先;手在這裡沒有音才放到腳)
          for (const [di, d] of dyn[mi].entries()) {
            if (used.has(di) || d.at !== e.pos) continue;
            if (vi === 0 || !vs[0].some(x => x.pos === d.at)) { body.push(dynXML(d, placement)); used.add(di); }
          }
          const next = evs[ei + 1] || null;
          const nextTie = e.tie ? new Set(((next && !next.rest) ? next.notes : ((measures[mi + 1] && !measures[mi + 1].slash && firstNotes(measures[mi + 1], vi)) || [])).map(n => n.piece)) : null;
          if (e.tie && !nextTie.size) throw new Error(`${where}:連結線後面沒有同一個鼓件的音`);
          if (e.tie) for (const n of e.notes) if (!nextTie.has(n.piece)) throw new Error(`${where}:連結線後面沒有同一個鼓件(${n.piece})`);
          body.push(...noteXML(e, { voice, key, lines, voices: vs.length, prevTie, nextTie }));
          prevTie = e.tie ? new Set(e.notes.map(n => n.piece)) : null;
        });
        tieCarry[vi] = prevTie;
      });
      for (const [di, d] of dyn[mi].entries()) {
        if (used.has(di)) continue;
        if (d.at === null || d.at === meter.len) { body.push(dynXML(d, placement)); used.add(di); continue; }
        throw new Error(`${where}:力度的位置 ${d.at / DIV} 拍對不到任何音或休止符的開頭`);
      }
    }
    const last = mi === measures.length - 1;
    // spec.repeat = N:整份畫反覆記號,上面寫 ×N(兩小節一樣的律動縮成一小節)
    const rep = spec.repeat > 1;
    const left = rep && mi === 0 ? `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>` : "";
    const words = rep && mi === 0 ? `<direction placement="above"><direction-type><words font-size="11">×${spec.repeat}</words></direction-type><voice>1</voice></direction>` : "";
    xm.push(`<measure number="${mi + 1}">${left}${attrs.length ? `<attributes>${attrs.join("")}</attributes>` : ""}${words}${body.join("")}` +
      (last ? (rep ? `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="${spec.repeat}"/></barline>` : `<barline location="right"><bar-style>light-heavy</bar-style></barline>`) : "") + `</measure>`);
  });
  if (tieCarry.some(Boolean)) throw new Error("最後一個音有連結線但後面沒有音");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${esc(spec.title || "")}</work-title></work>
<part-list><score-part id="P1"><part-name print-object="no">${lines === 1 ? "Snare" : "Drum kit"}</part-name></score-part></part-list>
<part id="P1">${xm.join("\n")}</part></score-partwise>`;
}
// 下一小節同一聲部的第一個 ev(跨小節的連結線)
function firstNotes(m, vi){
  const ev = m.voices && m.voices[vi] && m.voices[vi][0];
  if (!ev) return [];
  const v = String(ev.value || "");
  return ev.rest || v[0] === "r" ? [] : (ev.notes || []);
}

/* 檢查(不丟出):回傳錯誤訊息清單 */
export function checkScore(spec){
  try { scoreXML(spec); return []; } catch (e) { return [e.message]; }
}

/* 用到的鼓件(圖例用;照 drumkey.json 的順序)。開 / 閉 HH 寫成 hh + open/closed 的也算進 hhOpen / hhClosed */
export function piecesUsed(spec){
  const key = spec.key || drumKeyCached(), set = new Set();
  for (const m of spec.measures || []) {
    if (m.slash) continue;
    for (const v of m.voices || []) for (const ev of v || []) for (const n of ev.notes || []) {
      set.add(n.open && n.piece === "hh" ? "hhOpen" : n.closed && n.piece === "hh" ? "hhClosed" : n.piece);
    }
  }
  const order = key ? Object.keys(key.pieces) : [...set];
  return order.filter(p => set.has(p));
}

/* 每一小節每個聲部的時值合計(divisions;kitxml.mjs 用 MusicXML 自己再算一次比對) */
export function measureLengths(spec){
  let meter = parseTime(spec.time || "4/4");
  return (spec.measures || []).map(m => { if (m.time) meter = parseTime(m.time); return meter.len; });
}

/* 圖例的一格:一個鼓件一個四分音符(腳朝下),不印譜號、拍號、小節線 */
export function legendXML(piece, { key = drumKeyCached(), lines = 5 } = {}){
  if (!key || !key.pieces[piece]) throw new Error(`鼓件不在 drumkey.json(${piece})`);
  const n = { piece }, voice = FEET.has(piece) ? 2 : 1, stem = voice === 1 ? "up" : "down";
  const tech = isOpen(key, n) ? '<technical><open placement="above"/></technical>' : isClosed(key, n) ? '<technical><stopped placement="above"/></technical>' : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">${esc(piece)}</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>${DIV}</divisions><key print-object="no"><fifths>0</fifths></key><time print-object="no"><beats>1</beats><beat-type>4</beat-type></time>` +
`<clef print-object="no"><sign>percussion</sign></clef><staff-details><staff-lines>${lines}</staff-lines></staff-details></attributes>` +
`<note>${unpitched(pitchOf(key, piece, lines))}<duration>${DIV}</duration><voice>${voice}</voice><type>quarter</type><stem>${stem}</stem>${headXML(key, n)}${tech ? `<notations>${tech}</notations>` : ""}</note>` +
`<barline location="right"><bar-style>none</bar-style></barline></measure></part></score-partwise>`;
}


/* 交給 OSMD 的 MusicXML:OSMD 不讀 <open/>(MusicXML 4.0 的開 HH),換成 <open-string/>,OSMD 會畫小圓圈並預留位置
   (跟重音、力度、漸強線疊放好);legend.js 的 decorate 再把小圓圈藏起來、在同一個位置補畫清楚的大 o。MusicXML 本身仍維持 <open/> */
export function osmdXML(xml){
  return String(xml).replace(/<open(\s[^>]*)?\/>/g, (m, a) => `<open-string${a || ""}/>`);
}

/* 圖例格子的出處小字:{ lines: [[中, 英], …](最多兩行), pending, wide }
   - 第一行 = drumkey.json srcs[鼓件的 src].short(沒有 short 就用 label;找不到出處 = 待核對)
   - 第二行:官方只確認符頭 / 記號、位置待核對的(posSrc 是待核對)= srcs[posSrc].posShort;
     單線譜的小鼓 = singleLine.short(單線譜為 App 的選擇),這一格比較寬(wide:佔兩格)
   - pending = 有任何一行是待核對 */
export function legendSrc(key, piece, lines = 5){
  const p = key && key.pieces[piece];
  if (!p) throw new Error(`鼓件不在 drumkey.json(${piece})`);
  const single = lines === 1 && piece === key.singleLine.piece;
  const s = key.srcs[single ? key.singleLine.src : p.src];
  const lab = x => (x && Array.isArray(x.short) ? x.short : x && Array.isArray(x.label) ? x.label : null);
  const PEND = ["待核對", "Pending"];
  const out = [lab(s) || PEND];
  let pending = !s || !!s.pending;
  if (single) out.push(key.singleLine.short || key.singleLine.note);
  else if (!pending && p.posSrc) {
    const ps = key.srcs[p.posSrc];
    if (!ps || ps.pending) { out.push((ps && ps.posShort) || ["位置待核對", "Pos. pending"]); pending = true; }
  }
  return { lines: out, pending, wide: single };
}
