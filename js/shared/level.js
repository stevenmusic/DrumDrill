/* 自動難度(DrumDrill 的視奏分頁,與沒選考試時的聽力;PianoDrill 不用,視奏是另一套「範圍階段」)。
   - 每個分類各自記一個難度(1–max[cat]);還沒調過時用 start(cat)(模組照考試級數換算;沒選考試 = 1)
   - 設定卡的 ▲ ▼ 手動調(step);每題結果下面一排「太簡單 / 剛好 / 太難」(vote:+1 / 0 / −1,以這一題出結果時的難度為準,改選只算最後一次)
   - auto(cat, 分數):節奏回饋(0–100)連續 AUTO_UP.n 題 ≥ AUTO_UP.score 升一級、連續 AUTO_DOWN.n 題 < AUTO_DOWN.score 降一級;
     回傳要寫在畫面上的變化({ from, to, why: "up" | "down" }),沒變是 null
   - 存在模組自己的 store:store.level = { 分類: n }(調過才有)、store.streak = { 分類: { hi, lo } };讀進來先消毒(createLevels 做)
   難度階段是 App 的練習設定:畫面上不寫考試名稱、級數名、頁碼 */
import { tr, pairText, onLang } from "./i18n.js";

export const AUTO_UP = { n: 3, score: 90 }, AUTO_DOWN = { n: 2, score: 50 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const obj = o => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
const cnt = v => (Number.isInteger(v) && v > 0 ? v : 0);

export function createLevels({ store, save, max, start }){
  const L = store.level = obj(store.level), S = store.streak = obj(store.streak);
  for (const k of Object.keys(L)) { if (!(k in max) || !Number.isFinite(L[k])) delete L[k]; else L[k] = clamp(Math.round(L[k]), 1, max[k]); }
  for (const k of Object.keys(S)) { const v = S[k]; if (!(k in max) || !v || typeof v !== "object") delete S[k]; else S[k] = { hi: cnt(v.hi), lo: cnt(v.lo) }; }
  const top = cat => max[cat] || 1;
  const get = cat => (L[cat] != null ? L[cat] : clamp(Math.round(Number(start(cat)) || 1), 1, top(cat)));
  const set = (cat, n) => { const v = clamp(Math.round(n), 1, top(cat)); if (v !== get(cat) || L[cat] == null) { L[cat] = v; S[cat] = { hi: 0, lo: 0 }; } save(); return v; };
  return {
    get, set, max: top,
    step: (cat, d) => set(cat, get(cat) + d),
    /* 一題的節奏分數 → 自動升降(score 不是數字 = 這一題沒有節奏回饋,不算,連續的計數也不斷) */
    auto(cat, score){
      if (typeof score !== "number" || !Number.isFinite(score)) return null;
      const s = S[cat] || (S[cat] = { hi: 0, lo: 0 }), from = get(cat);
      s.hi = score >= AUTO_UP.score ? s.hi + 1 : 0;
      s.lo = score < AUTO_DOWN.score ? s.lo + 1 : 0;
      let to = from, why = null;
      if (s.hi >= AUTO_UP.n && from < top(cat)) { to = from + 1; why = "up"; }
      else if (s.lo >= AUTO_DOWN.n && from > 1) { to = from - 1; why = "down"; }
      if (why) { L[cat] = to; S[cat] = { hi: 0, lo: 0 }; }
      save();
      return why ? { from, to, why } : null;
    },
    /* 結果下面的三顆鈕:R = 這一題的結果物件(記 R.lv = 出結果時的難度、R.vote = 選的那一顆) */
    vote(cat, R, v){
      if (R.lv == null) R.lv = get(cat);
      R.vote = v;
      return set(cat, R.lv + (v === "easy" ? 1 : v === "hard" ? -1 : 0));
    }
  };
}

/* 難度的一句白話(題目卡「▼ 難度 2 / 4 ▲」旁邊):這個難度用到什麼。cur / prev = 這一個 / 前一個難度的出題參數
   { values, rests, time, dyn, pieces, extra, bpm }(都可以沒有);第一個難度寫 base(),之後寫「加:…」(新的記號),記號一樣就寫速度 */
const NM = {
  values: { "1": ["全音符", "whole"], "2": ["二分", "half"], "2.": ["附點二分", "dotted half"], "4": ["四分", "quarter"], "4.": ["附點四分", "dotted quarter"], "8": ["八分", "eighth"],
    "8.": ["附點八分", "dotted eighth"], "16": ["十六分", "16th"], "16.": ["附點十六分", "dotted 16th"], "32": ["三十二分", "32nd"], "8t3": ["三連音", "triplet"], "16t3": ["十六分三連音", "16th triplet"],
    "16t6": ["六連音", "sextuplet"], "4t3": ["四分三連音", "quarter triplet"], dup: ["二連音", "duplet"] },
  rests: { r1: ["全休止符", "whole rest"], r2: ["二分休止符", "half rest"], "r2.": ["附點二分休止符", "dotted half rest"], r4: ["四分休止符", "quarter rest"], "r4.": ["附點四分休止符", "dotted quarter rest"],
    r8: ["八分休止符", "eighth rest"], "r8.": ["附點八分休止符", "dotted eighth rest"], r16: ["十六分休止符", "16th rest"], "r16.": ["附點十六分休止符", "dotted 16th rest"] },
  dyn: { pp: ["pp", "pp"], p: ["p", "p"], mp: ["mp", "mp"], mf: ["mf", "mf"], f: ["f", "f"], ff: ["ff", "ff"], sfz: ["sfz", "sfz"], accent: ["重音", "accents"], cresc: ["漸強", "crescendo"], dim: ["漸弱", "diminuendo"] },
  pieces: { snare: ["小鼓", "snare"], kick: ["大鼓", "kick"], tomHi: ["Tom 1", "tom 1"], tomMid: ["Tom 2", "tom 2"], tomFloor: ["落地鼓", "floor tom"], hh: ["Hi-hat", "hi-hat"], hhOpen: ["開 Hi-hat", "open hi-hat"],
    hhFoot: ["腳踩 Hi-hat", "foot hi-hat"], ride: ["Ride", "ride"], rideBell: ["Ride bell", "ride bell"], crash: ["Crash", "crash"], xstick: ["Cross stick", "cross stick"], kit: ["整組鼓", "full kit"] },
  extra: { ties: ["連結線", "ties"], footHH: ["腳踩 Hi-hat", "foot hi-hat"], offbeatBD: ["& 上的大鼓", "kick on the &"], hhOpenClose: ["開 / 關 Hi-hat", "open / closed hi-hat"], rimclick: ["Cross stick", "cross stick"],
    roll: ["滾奏", "rolls"], flam: ["Flam", "flams"], drag: ["Drag", "drags"], ruff: ["Ruff", "ruffs"], ghost: ["鬼音", "ghost notes"], meterChange: ["換拍號", "metre changes"], independence: ["手腳獨立", "independence"],
    fullKit: ["整組鼓", "full kit"], anyTerms: ["各種術語", "any terms"] }
};
const names = (k, list) => (list || []).map(x => (k === "time" ? [x, x] : NM[k][x] || null)).filter(Boolean);
export const valueList = (vals, rests) => {
  const v = names("values", vals), r = names("rests", rests);
  return tr([v.length ? v.map(x => x[0]).join("、") + "音符" : "", r.length ? r.map(x => x[0].replace(/休止符$/, "")).join("、") + "休止符" : ""].filter(Boolean).join(","),
    [v.length ? v.map(x => x[1]).join(", ") + " notes" : "", r.length ? r.map(x => x[1].replace(/ rest$/, "")).join(", ") + " rests" : ""].filter(Boolean).join("; "));
};
export function paramDesc(cur, prev, base){
  if (!prev) return base();
  const diff = k => (cur[k] || []).filter(x => !(prev[k] || []).includes(x));
  const add = [...names("time", diff("time")), ...names("values", diff("values")).map(x => [x[0] + "音符", x[1] + " notes"]), ...names("rests", diff("rests")),
    ...names("dyn", diff("dyn")), ...names("pieces", diff("pieces")), ...names("extra", diff("extra"))];
  const uniq = [...new Map(add.map(x => [x[0], x])).values()];
  if (uniq.length) { const s = uniq.slice(0, 4); return tr("加:" + s.map(x => x[0]).join("、") + (uniq.length > 4 ? "…" : ""), "Adds " + s.map(x => x[1]).join(", ") + (uniq.length > 4 ? "…" : "")); }
  const bp = b => (Array.isArray(b) ? (b[0] === b[1] ? `${b[0]}` : `${b[0]}–${b[1]}`) : b != null ? `${b}` : "");
  if (bp(cur.bpm) && bp(cur.bpm) !== bp(prev.bpm)) return tr(`記號一樣,速度 ${bp(cur.bpm)}`, `Same symbols, tempo ${bp(cur.bpm)}`);
  return tr("記號一樣,題目變化更多", "Same symbols, more variety");
}

const VOTES = [["easy", ["太簡單", "Too easy"]], ["ok", ["剛好", "Just right"]], ["hard", ["太難", "Too hard"]]];
/* 難度的一句話(畫面與播報共用):auto = levels.auto 的回傳、vote = 選的那一顆;hint = 已經最高時的建議(模組給,例如「試試律動或樂譜」) */
export function levelText({ auto = null, vote = null, from, to, max, hint = null }){
  if (vote) {
    if (vote === "easy" && from >= max) return tr("已經是最高難度。", "That's the top level.") + (hint ? " " + hint() : "");
    if (vote === "hard" && from <= 1) return tr("已經是最低難度。", "That's the lowest level.");
    if (vote === "ok" || to === from) return tr(`難度維持 ${to}。`, `Level stays at ${to}.`);
    return to > from ? tr(`下一題難度升到 ${to}。`, `Next test: level ${to}.`) : tr(`下一題難度降到 ${to}。`, `Next test: level ${to}.`);
  }
  if (auto) return auto.why === "up" ? tr(`打得很準,難度升到 ${auto.to}。`, `Spot on — level up to ${auto.to}.`)
    : tr(`這幾題比較吃力,難度降到 ${auto.to}。`, `These were tough — level down to ${auto.to}.`);
  return "";
}
/* 在 box 最後加上「這一題的難度」一排三顆鈕 + 一句話。onVote(v) 由模組處理(levels.vote、重畫設定卡、播報);
   R.lvText = 目前要顯示的那一句(函式,換語言重寫) */
let qSeq = 0;
const VOTE_Q = () => tr("這題對你來說?(會調整下一題難度)", "How was it? (sets the next level)");
onLang(() => document.querySelectorAll(".diff-fb[aria-label]").forEach(r => r.setAttribute("aria-label", VOTE_Q())));
export function paintVotes(box, R, onVote){
  const msg = document.createElement("p"); msg.className = "diff-msg"; box.appendChild(msg);
  if (R.lvText) pairText(msg, R.lvText); else msg.hidden = true;
  // 三顆鈕上面不加問句(畫面設計 2026-10:按鈕的字就說清楚了);群組名稱(無障礙)照舊說明按了會怎樣
  const row = document.createElement("div"); row.className = "diff-fb"; row.setAttribute("role", "group");
  row.id = "diffQ" + (++qSeq);
  row.setAttribute("aria-label", VOTE_Q());
  for (const [v, t] of VOTES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.v = v; b.setAttribute("aria-pressed", String(R.vote === v));
    pairText(b, () => tr(t[0], t[1]));
    b.onclick = () => onVote(v);
    row.appendChild(b);
  }
  box.appendChild(row);
}
