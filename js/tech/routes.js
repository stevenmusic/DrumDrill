/* 今日練習的路線與關卡(DrumDrill;引擎 js/shared/daily.js、卡片 js/shared/dailycard.js)。
   **暫時的示範關卡**(第一階段:讓流程可以走一遍;正式的律動 / 過門路線下一階段換掉):2 條路線各 2 關,只用現有的 PAS 打法與練習型。
   rud = { pas, sticking?, value? }:有 value 就是 rudiments.js pattern() 的練習型(PAS 的左右手 + 這個時值),沒有就是 PAS 原譜。
   start / target(♩)、check(重點)、vary(複習的變化;沒寫就用 daily.js 的 DEFAULT_VARY:原樣 → 拍點只響 2、4 → 只響第 1 拍 → 中途消失 → 中途消失 + 最快)
   都是 App 的練習設定 */
export const ROUTES = [
  { id: "single", name: ["單擊", "Singles"], levels: [
    { id: "S1", name: ["單擊 四分音符", "Singles in quarters"], rud: { pas: 1, sticking: "single", value: "4" }, start: 60, target: 80,
      check: [["左右手一樣大聲", "Both hands equal"], ["跟拍點同時", "Right on the click"]] },
    { id: "S2", name: ["單擊 八分音符", "Singles in eighths"], rud: { pas: 1, sticking: "single", value: "8" }, start: 60, target: 88,
      check: [["每一下一樣大聲", "Every stroke even"], ["不要越打越快", "Don't rush"]] }] },
  { id: "double", name: ["雙擊", "Doubles"], unlock: { route: "single", passed: "S1" }, levels: [
    { id: "D1", name: ["雙擊 RRLL 八分音符", "Doubles RRLL in eighths"], rud: { pas: 6, sticking: "double", value: "8" }, start: 56, target: 80,
      check: [["第二下也打清楚", "Second stroke clear too"], ["手腕放鬆", "Loose wrists"]] },
    { id: "D2", name: ["單複點 Paradiddle", "Single paradiddle"], rud: { pas: 16, value: "8" }, start: 56, target: 80,
      check: [["重音清楚、其他輕", "Accents loud, others soft"], ["左右手交替起手", "Lead alternates"]],
      vary: [{}, { click: "two-four" }, { click: "one" }, { click: "gap" }, { click: "gap", fast: true }] }] }
];

/* 暖身的候選(不過關、只記時間):沒選考試時照日子輪流,標「再練」的優先 */
export const WARM = [
  { pas: 1, sticking: "single", value: "8", name: ["單擊交替 RLRL", "Singles RLRL"] },
  { pas: 6, sticking: "double", value: "8", name: ["雙擊 RRLL", "Doubles RRLL"] }
];
