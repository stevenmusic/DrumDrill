/* 無障礙(VoiceOver / 螢幕閱讀器)的共用小工具(DrumDrill;S16):
   - imgLabel(el, fn):鼓譜容器(OSMD 畫的 SVG,螢幕閱讀器讀不到)加 role="img" + aria-label = fn()。
     fn 用 tr() 產生文字;換語言時自動重算(這裡登記 onLang,等模組的 relang() 跑完才算),模組不用自己再設。fn = null → 拿掉(沒有譜時)
   - announce(text):寫進全頁唯一的 aria-live="polite" 區(index.html 的 #srLive)。只播報「狀態改變」:
     播放 / 停止、準備或看譜倒數開始 / 結束、正式打開始 / 結束、結果出來;不要每秒播報倒數、不要播報預備拍的每一下
   - describeSpec(spec, opts):鼓組譜(kitnotation.js 的 spec)的文字說明:「N 小節小鼓譜 / 整組鼓譜、拍號、速度」+ 每小節的簡述
     (單線小鼓譜:每個音的時值;整組鼓:幾個音、用到哪些鼓件;斜線 = 自由發展)
   - pieceNames(ids, key):鼓件名稱清單(圖例用)
   純文字的部分(describeSpec、valueName)不碰 DOM,Node 可以直接跑 */
import { tr, onLang } from "./i18n.js";

/* ── role="img" + aria-label(換語言自動重算)── */
const labelled = new Set();
export function imgLabel(el, fn){
  if (!el) return;
  if (!fn) { el.removeAttribute("role"); el.removeAttribute("aria-label"); el._ariaFn = null; labelled.delete(el); return; }
  el._ariaFn = fn;
  el.setAttribute("role", "img");
  labelled.add(el);
  apply(el);
  // 呼叫的人常常接著才改標題等文字(fn 可能讀畫面上的字):這一輪做完再算一次
  queueMicrotask(() => apply(el));
}
function apply(el){
  if (!el._ariaFn) return;
  let text = "";
  try { text = el._ariaFn() || ""; } catch (e) { console.error(e); }
  el.setAttribute("aria-label", text);
}
export function relabelAll(){
  for (const el of labelled) {
    if (!el._ariaFn) { labelled.delete(el); continue; }
    apply(el);
  }
}
// 換語言:等每個模組的 relang() 都跑完(標題等文字換好)再重算
onLang(() => queueMicrotask(relabelAll));

/* ── aria-live 區:同一句話連續講兩次也要念(先清空、下一格再寫);
   同一瞬間(60ms 內)的幾句接在一起念(例如視奏的「打完了…」+ 模擬考的「模擬考結束」),不互相蓋掉 ── */
let liveTimer = 0, livePending = [];
export function announce(text){
  if (typeof document === "undefined") return;
  const el = document.getElementById("srLive");
  if (!el || !text) return;
  clearTimeout(liveTimer);
  el.textContent = "";
  if (!livePending.includes(text)) livePending.push(text);
  liveTimer = setTimeout(() => { el.textContent = livePending.join(" "); livePending = []; }, 60);
}

/* ── 時值名稱 ── */
const VALUE_NAMES = {
  "1": ["全音符", "whole"], "2": ["二分", "half"], "2.": ["附點二分", "dotted half"], "4": ["四分", "quarter"], "4.": ["附點四分", "dotted quarter"],
  "8": ["八分", "eighth"], "8.": ["附點八分", "dotted eighth"], "16": ["十六分", "16th"], "16.": ["附點十六分", "dotted 16th"], "32": ["三十二分", "32nd"],
  "8t3": ["八分三連音", "eighth triplet"], "4t3": ["四分三連音", "quarter triplet"], "16t3": ["十六分三連音", "16th triplet"],
  "16t5": ["十六分五連音", "16th quintuplet"], "16t6": ["十六分六連音", "16th sextuplet"], "16t7": ["十六分七連音", "16th septuplet"],
  "32t9": ["三十二分九連音", "32nd nonuplet"], "32t10": ["三十二分十連音", "32nd tuplet of 10"], "dup": ["二連音", "duplet"]
};
export function valueName(code, rest){
  const v = VALUE_NAMES[code];
  const n = v ? tr(v[0], v[1]) : code;
  return rest ? tr(n + "休止", n + " rest") : n;
}
const evCode = ev => (ev.value && ev.value[0] === "r" ? ev.value.slice(1) : ev.value);
const evRest = ev => !!ev.rest || (typeof ev.value === "string" && ev.value[0] === "r") || !(ev.notes && ev.notes.length);

/* 鼓件名稱(drumkey.json 的 pieces[id].name = [中, 英]) */
export function pieceNames(ids, key){
  const list = [...ids].map(id => { const p = key && key.pieces && key.pieces[id]; return p ? tr(p.name[0], p.name[1]) : id; });
  return list.join(tr("、", ", "));
}

/* 一個音(單線譜用):時值 + 重音 / Flam / Drag / 鬼音 / 滾奏 */
function noteWord(ev){
  if (evRest(ev)) return valueName(evCode(ev), true);
  const marks = [];
  const ns = ev.notes || [];
  if (ns.some(n => n.accent)) marks.push(tr("重音", "accent"));
  if (ns.some(n => n.flam)) marks.push("Flam");
  if (ns.some(n => n.drag)) marks.push("Drag");
  if (ns.some(n => n.ghost)) marks.push(tr("鬼音", "ghost"));
  if (ev.roll) marks.push(tr("滾奏", "roll"));
  if (ev.buzz) marks.push(tr("多次反彈", "buzz"));
  return valueName(evCode(ev)) + (marks.length ? tr(`(${marks.join("、")})`, ` (${marks.join(", ")})`) : "");
}

/* 鼓組譜的說明。opts = { key(drumkey.json), bpm, bpmText(自訂速度文字), title(放在最前面), detail(單線譜列出每個音;預設 true) } */
export function describeSpec(spec, opts = {}){
  if (!spec || !Array.isArray(spec.measures)) return "";
  const key = opts.key || null, n = spec.measures.length, snare = spec.lines === 1;
  const head = [];
  if (opts.title) head.push(opts.title);
  head.push(snare ? tr(`${n} 小節小鼓譜`, `${n}-bar snare part`) : tr(`${n} 小節整組鼓譜`, `${n}-bar drum kit part`));
  // 拍號:第一小節的拍號 + 中途換拍號的小節
  let time = spec.time || "4/4";
  const changes = [];
  spec.measures.forEach((m, i) => { if (m.time && m.time !== time && i > 0) { time = m.time; changes.push(tr(`第 ${i + 1} 小節起 ${m.time}`, `${m.time} from bar ${i + 1}`)); } });
  head.push(tr(`拍號 ${spec.time || "4/4"}`, `time ${spec.time || "4/4"}`) + (changes.length ? tr(`(${changes.join("、")})`, ` (${changes.join(", ")})`) : ""));
  if (opts.bpmText) head.push(opts.bpmText);
  else if (opts.bpm) head.push(`♩=${opts.bpm}`);
  const bars = spec.measures.map((m, i) => {
    const label = tr(`第 ${i + 1} 小節`, `bar ${i + 1}`);
    if (m.slash) return label + tr(":自由發展(斜線)", ": free development (slashes)");
    const voices = (m.voices || []).filter(Boolean);
    if (snare && opts.detail !== false) {
      const words = (voices[0] || []).map(noteWord);
      return label + tr(":", ": ") + (words.length ? words.join(tr("、", ", ")) : tr("整小節休止", "whole-bar rest"));
    }
    // 整組鼓:幾個音(同時打的算一下)、用到哪些鼓件
    const starts = new Set(), pieces = new Set();
    for (const v of voices) {
      let t = 0;
      for (const ev of v) {
        const code = evCode(ev), dur = DUR[code] || 0;
        if (!evRest(ev)) { starts.add(Math.round(t * 1000)); for (const nt of ev.notes) pieces.add(nt.piece); }
        t += dur;
      }
    }
    if (!starts.size) return label + tr(":休止", ": rest");
    const order = key && key.pieces ? Object.keys(key.pieces) : [];
    const ps = [...pieces].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return label + tr(`:${starts.size} 下(${pieceNames(ps, key)})`, `: ${starts.size} hit${starts.size > 1 ? "s" : ""} (${pieceNames(ps, key)})`);
  });
  return head.join(tr(",", ", ")) + tr("。", ". ") + bars.join(tr(";", "; ")) + tr("。", ".");
}
/* 時值(四分音符 = 1;連音照實際長度) */
const DUR = { "1": 4, "2": 2, "2.": 3, "4": 1, "4.": 1.5, "8": 0.5, "8.": 0.75, "16": 0.25, "16.": 0.375, "32": 0.125,
  "8t3": 1 / 3, "4t3": 2 / 3, "16t3": 1 / 6, "16t5": 0.2, "16t6": 1 / 6, "16t7": 1 / 7, "32t9": 1 / 9, "32t10": 0.1, "dup": 0.75 };
