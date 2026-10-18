/* 檢定頁共用的小元件(技巧、視奏、聽力的「考試摘要」與「規格卡」),不寫死前綴:元素一律由模組傳進來。
   - 中英版面一樣:每一個會換行的文字都是一個區塊、用 pairText 設(保留兩種語言比較高的高度);
     出處(「RSL p.42」「Trinity p.62」)跟語言無關,用 data-src 由 CSS 的 ::after 以小字接在值後面(drum.css .spec-v),
     「推估 / Assumed」跟語言有關,寫在值的文字裡(pairText 量得到)
   - 資料都來自 data/exam-*.json(照官方大綱整理,每項帶頁碼);這裡只負責把代號翻成文字,不加任何要求
   - 練習回饋不放在這裡(考試摘要有等第門檻,同一個畫面不能有練習的結果) */
import { tr, T, pairText, unpair, getLang } from "./i18n.js";

/* [中, 英] → 目前語言 */
export const L = pair => (Array.isArray(pair) ? tr(pair[0], pair[1]) : pair == null ? "" : String(pair));
/* 出處小字:官方頁碼 */
export const srcOf = (sys, p) => (p ? `${sys === "rsl" ? "RSL" : "Trinity"} p.${p}` : "");
/* 「推估」「練習設定」(接在值的文字後面) */
export const assumed = (on = true) => (on ? " · " + T("srcAssumed") : "");

/* 一張「標籤:值」表。rows:[{ k:() => 標籤, v:() => 值, src:"RSL p.48"(可省略)}];值是 null 的列不畫 */
export function fillSpec(el, rows){
  el.innerHTML = "";
  el.classList.add("spec");
  for (const r of rows) {
    if (!r) continue;
    const k = document.createElement("div"), v = document.createElement("div");
    k.className = "spec-k"; v.className = "spec-v";
    if (r.src) v.dataset.src = r.src;
    el.append(k, v);
    pairText(k, r.k); pairText(v, r.v);
  }
}
/* 段落(說明、備註):pairText;fn 回傳空字串時藏起來 */
export function para(el, fn){
  pairText(el, fn);
  el.hidden = !el.textContent.trim();
}
/* 一張卡片裡的段落區塊(動態產生的卡片內容用):回傳 <p class="cls"> 並 pairText */
export function addPara(parent, fn, cls = "spec-note", src){
  const p = document.createElement("p");
  p.className = cls;
  if (src) p.dataset.src = src;
  parent.appendChild(p);
  pairText(p, fn);
  return p;
}

/* ── 代號 → 文字 ── */
const VALUE_NAMES = {
  "1": ["全音符", "semibreves"], "2": ["二分音符", "minims"], "2.": ["附點二分音符", "dotted minims"],
  "4": ["四分音符", "crotchets"], "4.": ["附點四分音符", "dotted crotchets"], "8": ["八分音符", "quavers"], "8.": ["附點八分音符", "dotted quavers"],
  "16": ["十六分音符", "semiquavers"], "16.": ["附點十六分音符", "dotted semiquavers"], "32": ["三十二分音符", "demisemiquavers"],
  "8t3": ["八分三連音", "quaver triplets"], "4t3": ["四分三連音", "crotchet triplets"], "16t3": ["十六分三連音", "semiquaver triplets"],
  "16t5": ["十六分五連音", "semiquaver quintuplets"], "16t6": ["十六分六連音", "sextuplets"], "16t7": ["十六分七連音", "semiquaver septuplets"],
  "32t9": ["三十二分九連音", "demisemiquaver nonuplets"], "32t10": ["三十二分十連音", "double quintuplets"], "dup": ["二連音", "duplets"]
};
const REST_NAMES = {
  "1": ["全休止符", "semibreve rests"], "2": ["二分休止符", "minim rests"], "2.": ["附點二分休止符", "dotted minim rests"],
  "4": ["四分休止符", "crotchet rests"], "4.": ["附點四分休止符", "dotted crotchet rests"], "8": ["八分休止符", "quaver rests"],
  "8.": ["附點八分休止符", "dotted quaver rests"], "16": ["十六分休止符", "semiquaver rests"], "16.": ["附點十六分休止符", "dotted semiquaver rests"]
};
/* 單一時值(技巧練習型的名稱用,單數、短) */
const VALUE_SHORT = {
  "4": ["四分音符", "crotchets"], "8": ["八分音符", "quavers"], "16": ["十六分音符", "semiquavers"], "32": ["三十二分音符", "demisemiquavers"],
  "8t3": ["八分三連音", "quaver triplets"], "16t5": ["十六分五連音", "quintuplets"], "16t6": ["十六分六連音", "sextuplets"],
  "16t7": ["十六分七連音", "septuplets"], "32t9": ["三十二分九連音", "nonuplets"], "32t10": ["三十二分十連音", "double quintuplets"]
};
const DYN_NAMES = { accent: ["重音", "accents"], cresc: ["漸強", "crescendo"], dim: ["漸弱", "diminuendo"] };
const SEP = () => tr("、", ", ");
export const valueName = c => L(VALUE_SHORT[c] || VALUE_NAMES[c] || [c, c]);
export const values = list => (list || []).map(c => L(VALUE_NAMES[c] || [c, c])).join(SEP());
export const rests = list => (list || []).map(c => L(REST_NAMES[c.slice(1)] || [c, c])).join(SEP());
export const dyns = list => (list || []).map(c => (DYN_NAMES[c] ? L(DYN_NAMES[c]) : c)).join(SEP());
/* 鼓件(名稱照 data/drumkey.json;kit = 整組鼓) */
export function pieces(list, key){
  return (list || []).map(id => {
    if (key && key.pieces && key.pieces[id]) return L(key.pieces[id].name);
    if (key && key.groups && key.groups[id]) return L(key.groups[id].name);
    return id;
  }).join(SEP());
}
export const list = (arr, sep) => (arr || []).map(L).join(sep || SEP());
/* 速度:70 → ♩=70;[80, 120] → ♩=80–120 */
export const bpmText = b => (b == null ? "" : Array.isArray(b) ? (b[0] === b[1] ? `♩=${b[0]}` : `♩=${b[0]}–${b[1]}`) : `♩=${b}`);
/* 等第門檻:{pass, merit, dist} → Pass 9 · Merit 11 · Distinction 13(等第名稱照官方英文,兩種語言一樣) */
export const bandsText = (b, unit = "") => (b ? `Pass ${b.pass}${unit} · Merit ${b.merit}${unit} · Distinction ${b.dist}${unit}` : "");
/* 秒 → 「1 分 30 秒」/「1:30」 */
export const secText = s => tr(s >= 60 ? `${Math.floor(s / 60)} 分${s % 60 ? ` ${s % 60} 秒` : ""}` : `${s} 秒`, s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`);

/* 考試摘要的共同部分:整場門檻、考試時間、本 App 不提供、資料版本(各模組再加自己這一項的配分) */
export function summaryRows(sys, data, g){
  if (!data) return [];
  const rows = [];
  if (sys === "rsl") {
    const m = data.marks.gradeExam;
    rows.push({ k: () => tr("整場門檻", "Overall"), v: () => tr(`滿分 ${m.total.max}:`, `Out of ${m.total.max}: `) + bandsText(m.total.bands, "%"), src: srcOf(sys, m.src.p) });
    const min = data.minutes.gradeExam[g];
    if (min != null) rows.push({ k: () => tr("考試時間", "Exam length"), v: () => tr(`${min} 分鐘`, `${min} minutes`), src: srcOf(sys, data.minutes.src.p) });
  } else {
    const t = data.marks.total;
    rows.push({ k: () => tr("整場門檻", "Overall"), v: () => tr("滿分 100:", "Out of 100: ") + bandsText(t.bands), src: srcOf(sys, t.src.p) });
    const min = data.minutes.faceToFace[g];
    if (min != null) rows.push({ k: () => tr("考試時間", "Exam length"), v: () => tr(`現場 ${min} 分鐘`, `${min} minutes (face-to-face)`), src: srcOf(sys, data.minutes.src.p) });
  }
  return rows;
}
/* 本 App 不提供的項目、資料版本與核對日期 */
export function notInApp(sys, data){
  const arr = sys === "rsl" ? data.other.notInApp : data.notInApp;
  return { k: () => tr("本 App 不提供", "Not in the App"), v: () => list(arr, tr(";", "; ")) };
}
export function dataRow(data){
  return { k: () => tr("資料", "Data"), v: () => `${data.doc.title}` + tr(` · ${data.doc.checked} 核對`, ` · checked ${data.doc.checked}`) };
}

/* 兩種語言疊在同一格(grid 同一個位置,另一種語言 visibility:hidden):高度自然是兩者比較高的那個,
   版面變寬變窄、字型晚到都不用重量(pairText 量一次的高度在窄畫面偶爾不準時用這個;drum.css .pstack) */
export function pairStack(el, fn){
  const tmp = document.createElement("span");
  pairText(tmp, fn);
  const [zh, en] = tmp._pair; unpair(tmp);
  el.classList.add("pstack");
  el.innerHTML = "";
  for (const [lang, t] of [["zh", zh], ["en", en]]) {
    const s = document.createElement("span");
    s.textContent = t;
    if (lang !== getLang()) { s.className = "ps-off"; s.setAttribute("aria-hidden", "true"); }
    el.appendChild(s);
  }
}
