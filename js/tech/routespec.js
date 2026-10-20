/* 今日練習的關卡譜(js/tech/routes.js 的 pat)→ 鼓組譜 spec(js/shared/kitnotation.js)、播放事件、左右手。
   純函式:不碰 DOM、不 import i18n,node 可以直接跑(tools/test/checks/routes.mjs)。

   ── 寫法(DSL)──
   pat = 一小節(兩小節一樣)或 [小節, 小節, …];一小節 = { 鼓件那一行: "x--- x--- x--- x---" }
   - 一行 = 4 個「拍」用空白隔開;一拍的字數決定格子:4 字 = 十六分、2 字 = 八分、3 字 = 三連音(4/4)或八分(12/8 的一拍 = 附點四分)
   - 同一拍、同一個聲部(手 / 腳)的行字數要一樣;整拍都是 "-" 的不算(字數隨便)
   - 字:x 打、X 重音、o 開 Hi-hat(只有 hh)、g 鬼音(只有 sd)、- 沒有
   - 行:hh(Hi-hat)ride cr(Crash)sd(小鼓)xs(Cross stick)t1 t2 ft(Tom 1、Tom 2、落地鼓)= 手;bd(大鼓)hf(腳踩 Hi-hat)= 腳
   - "@名稱" = 每天不一樣的那一行(GENS;同一個種子同一題):bd: "@kick8"、sd: "@snare8"、fill: "@fill2"(第 3–4 拍的過門,寫進 sd / t1 / t2 / ft)
   ── 左右手(R / L,練習設定:常見的教法)──
   - 這一拍有鈸(Hi-hat、Ride、Crash):鈸 = 右手、同一拍的鼓 = 左手(右手打鈸、左手打小鼓)
   - 沒有鈸的拍(過門):兩手交替 —— 十六分照位置(拍上、反拍 = R,e、a = L)、八分 R L、四分一下一下 R L 輪流、三連音一路 R L R L
   - 腳不標 */
import { toEvents, specBeats } from "../shared/kitevents.js";
import { DIV } from "../shared/kitnotation.js";
import { rng, pick } from "../shared/kitgen.js";

export const HAND_LINES = { hh: "hh", ride: "ride", cr: "crash", sd: "snare", xs: "xstick", t1: "tomHi", t2: "tomMid", ft: "tomFloor" };
export const FOOT_LINES = { bd: "kick", hf: "hhFoot" };
const CYM = new Set(["hh", "ride", "crash"]);
export const LINE_ORDER = ["cr", "ride", "hh", "t1", "t2", "sd", "xs", "ft", "hf", "bd"];

/* 一拍的寫法:格子 n(4 = 十六分、3 = 三連音、c = 12/8 的三個八分)× 遮罩 → [時值, 佔幾格] */
const CELLS = {
  4: { 0: "r4", 1: "4", 2: "r16 8.", 3: "16 8.", 4: "r8 8", 5: "8 8", 6: "r16 16 8", 7: "16 16 8", 8: "r8. 16", 9: "8. 16",
       10: "r16 8 16", 11: "16 8 16", 12: "r8 16 16", 13: "8 16 16", 14: "r16 16 16 16", 15: "16 16 16 16" },
  3: { 0: "r4", 1: "4", 2: "r8t3 8t3 r8t3", 3: "8t3 4t3", 4: "r4t3 8t3", 5: "4t3 8t3", 6: "r8t3 8t3 8t3", 7: "8t3 8t3 8t3" },
  c: { 0: "r4.", 1: "4.", 2: "r8 8 r8", 3: "8 4", 4: "r4 8", 5: "4 8", 6: "r8 8 8", 7: "8 8 8" }
};
const SLOTS = { 4: { "4": 4, "8.": 3, "8": 2, "16": 1 }, 3: { "4": 3, "4t3": 2, "8t3": 1 }, c: { "4.": 3, "4": 2, "8": 1 } };
export const cellOf = (grid, mask) => CELLS[grid][mask];

/* 每天不一樣的那一行(App 的練習設計;checks/routes.mjs 每個 1000 個種子檢查規則) */
const POS8 = { "1&": [0, 2], "2&": [1, 2], "3": [2, 0], "3&": [2, 2], "4&": [3, 2] };
const beatsOf = s => s.split(" ");
const setSlot = (str, beat, slot) => { const b = beatsOf(str); b[beat] = b[beat].slice(0, slot) + "x" + b[beat].slice(slot + 1); return b.join(" "); };
/* 兩小節的大鼓八分位置(0–15)有沒有三個連續(頭尾相接也算:循環播) */
export function threeInRow(bars, line = "bd"){
  const on = [];
  for (const b of bars) for (const beat of beatsOf(b[line] || "---- ---- ---- ----")) { const c = beat.padEnd(4, "-"); on.push(c[0] !== "-", c.length === 4 ? c[2] !== "-" : false); }
  const n = on.length;
  return on.some((x, i) => x && on[(i + 1) % n] && on[(i + 2) % n]);
}
export const GENS = {
  /* 讀大鼓:每小節第 1 拍一定有;另外從 1&、2&、3、3&、4& 挑 1–2 個(3 出現的機率 70%);兩小節不一樣;不能三個八分連續(頭尾相接也算) */
  kick8(R, bars, line){
    for (let guard = 0; guard < 200; guard++) {
      const out = bars.map(() => {
        let s = "x--- ---- ---- ----";
        const extra = new Set();
        if (R() < 0.7) extra.add("3");
        const want = R() < 0.5 ? 1 : 2;
        while (extra.size < want) extra.add(pick(R, ["1&", "2&", "3&", "4&", "3"]));
        for (const p of extra) s = setSlot(s, ...POS8[p]);
        return s;
      });
      if (out.length > 1 && out[0] === out[1]) continue;
      const test = bars.map((b, i) => ({ ...b, [line]: out[i] }));
      if (threeInRow(test, line)) continue;
      return test;
    }
    throw new Error("kick8:產生不出來");
  },
  /* 讀小鼓:2、4 一定有;每小節再從 1&、2&、3&、4& 挑 1 個;兩小節不一樣 */
  snare8(R, bars, line){
    const opts = ["1&", "2&", "3&", "4&"];
    const a = pick(R, opts); let b = pick(R, opts);
    while (bars.length > 1 && b === a) b = pick(R, opts);
    return bars.map((bar, i) => ({ ...bar, [line]: setSlot("---- x--- ---- x---", ...POS8[i ? b : a]) }));
  },
  /* 讀過門:那一小節第 3、4 拍,每一拍挑一種(四個十六分、換鼓的兩個 + 兩個、兩個八分、三連音),鼓件由高到低(小鼓 → Tom 1 → Tom 2 → 落地鼓)不往回走 */
  fill2(R, bars, line, at){
    const DR = ["sd", "t1", "t2", "ft"];
    return bars.map((bar, bi) => {
      if (!at.includes(bi)) return bar;
      const b = { ...bar }; delete b[line];
      const beats = {}; for (const k of DR) beats[k] = beatsOf(b[k] || "---- ---- ---- ----");
      let d = R() < 0.6 ? 0 : 1;
      for (const beat of [2, 3]) {
        const kinds = ["16", "8", "trip"].concat(d < DR.length - 1 ? ["split"] : []);
        const kind = pick(R, kinds);
        const len = kind === "trip" ? 3 : 4, blank = "-".repeat(len);
        for (const k of DR) beats[k][beat] = blank;
        if (kind === "16") beats[DR[d]][beat] = "xxxx";
        else if (kind === "8") beats[DR[d]][beat] = "x-x-";
        else if (kind === "trip") beats[DR[d]][beat] = "xxx";
        else { beats[DR[d]][beat] = "xx--"; d++; beats[DR[d]][beat] = "--xx"; }
        if (d < DR.length - 1 && R() < 0.6) d++;
      }
      for (const k of DR) { const s = beats[k].join(" "); if (/x/.test(s)) b[k] = s; else delete b[k]; }
      return b;
    });
  }
};

/* 關卡的小節(展開 @ 產生器):seed 同一個 → 同一題 */
export function barsOf(level, seed = 1){
  let bars = (Array.isArray(level.pat) ? level.pat : [level.pat, level.pat]).map(b => ({ ...b }));
  const R = rng(seed), seen = new Set();
  for (let i = 0; i < bars.length; i++) for (const [line, v] of Object.entries(bars[i])) {
    if (typeof v !== "string" || v[0] !== "@") continue;
    const name = v.slice(1);
    if (seen.has(name + ":" + line)) continue;
    seen.add(name + ":" + line);
    const g = GENS[name]; if (!g) throw new Error(`產生器不認得:${v}`);
    const at = bars.map((b, j) => (b[line] === v ? j : -1)).filter(j => j >= 0);
    bars = g(R, bars, line, at);
  }
  return bars;
}
export const hasGen = level => (Array.isArray(level.pat) ? level.pat : [level.pat]).some(b => Object.values(b).some(v => typeof v === "string" && v[0] === "@"));

const NOTE = { x: {}, X: { accent: true }, o: { open: true }, g: { ghost: true } };
/* 一小節的一個聲部 → kitnotation 的 ev[](含每個手打的音的左右手 hand) */
function voiceOf(bar, lines, { compound, where, hands, key }){
  const used = Object.keys(bar).filter(k => lines[k]);
  const out = [];
  let alt = 0;   // 過門的兩手交替(四分、三連音)
  for (let beat = 0; beat < 4; beat++) {
    const strs = used.map(k => [k, beatsOf(bar[k])[beat]]);
    for (const [k, s] of strs) if (s == null) throw new Error(`${where}:${k} 不是 4 拍`);
    const live = strs.filter(([, s]) => /[^-]/.test(s));
    if (!live.length) { out.push({ value: compound ? "r4." : "r4" }); continue; }
    const lens = new Set(live.map(([, s]) => s.length));
    if (lens.size > 1) throw new Error(`${where}:第 ${beat + 1} 拍各行的字數不一樣(${live.map(([k, s]) => k + " " + s).join("、")})`);
    let len = [...lens][0], cells = live.map(([k, s]) => [k, s]);
    if (len === 2 && !compound) { cells = cells.map(([k, s]) => [k, s[0] + "-" + s[1] + "-"]); len = 4; }
    const grid = compound ? (len === 3 ? "c" : null) : len === 4 ? 4 : len === 3 ? 3 : null;
    if (!grid) throw new Error(`${where}:第 ${beat + 1} 拍字數不對(${len};${compound ? "12/8 一拍 3 字" : "4/4 一拍 2、3 或 4 字"})`);
    let mask = 0;
    for (const [k, s] of cells) for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "-") continue;
      if (!NOTE[c]) throw new Error(`${where}:不認得的字「${c}」(${k})`);
      if (c === "o" && k !== "hh") throw new Error(`${where}:o(開 Hi-hat)只能寫在 hh`);
      if (c === "g" && k !== "sd") throw new Error(`${where}:g(鬼音)只能寫在 sd`);
      mask |= 1 << i;
    }
    const code = CELLS[grid][mask], cym = hands && cells.some(([k]) => CYM.has(lines[k]));
    const eighthsOnly = grid === 4 && !(mask & 0b1010);
    let slot = 0;
    for (const tok of code.split(" ")) {
      const rest = tok[0] === "r", v = rest ? tok.slice(1) : tok, w = SLOTS[grid][v];
      if (rest) { out.push({ value: tok }); slot += w; continue; }
      const notes = cells.filter(([, s]) => s[slot] !== "-").map(([k, s]) => {
        const n = { piece: lines[k], ...NOTE[s[slot]] };
        if (hands) {
          if (cym) { n.hand = CYM.has(n.piece) ? "R" : "L"; n.groove = true; }   // 有鈸的拍 = 律動(過門只標過門的音)
          else if (grid === 4 && mask === 1) n.hand = alt % 2 ? "L" : "R";
          else if (grid === 4) n.hand = eighthsOnly ? (slot === 0 ? "R" : "L") : (slot % 2 ? "L" : "R");
          else n.hand = alt % 2 ? "L" : "R";
        }
        return n;
      });
      if (hands && !cym && !(grid === 4 && mask !== 1)) alt++;
      if (hands && cym) alt = 0;
      if (hands && notes.length > 1 && !cym) notes.forEach(n => { n.hand = notes[0].hand; });
      out.push({ value: v, notes });
      slot += w;
    }
  }
  // 整拍休止:4/4 第 1、3 拍開始的兩拍合成二分休止;最後的休止交給 kitnotation 補
  if (!compound) for (let i = 0; i + 1 < out.length; i++) if (out[i].value === "r4" && out[i + 1].value === "r4" && beatStart(out, i) % 2 === 0) out.splice(i, 2, { value: "r2" });
  while (out.length && out[out.length - 1].value[0] === "r") out.pop();
  return out;
}
function beatStart(evs, i){
  let pos = 0;
  for (let j = 0; j < i; j++) pos += lenQ(evs[j].value);
  return Math.round(pos * 1e6) / 1e6;
}
const LEN_Q = { "1": 4, "2": 2, "2.": 3, "4": 1, "4.": 1.5, "8": 0.5, "8.": 0.75, "16": 0.25, "8t3": 1 / 3, "4t3": 2 / 3 };
const lenQ = v => LEN_Q[v[0] === "r" ? v.slice(1) : v];

/* 畫面用的譜(播放照原本的 spec):
   - 每一小節都一模一樣(兩小節一樣的律動)= 一小節 + 反覆記號 ×times(spec.repeat)
   - 跟前一小節一模一樣的小節 = 一小節反覆記號 %(m.pct;不在每一行的開頭也照樣用)
   回傳 { spec, len(畫面上一輪幾拍,四分音符), collapsed } */
export function displaySpec(spec, times = 4){
  const ms = spec.measures, sig = m => JSON.stringify(m.voices);
  if (ms.length >= 2 && ms.every(m => sig(m) === sig(ms[0])))
    return { spec: { ...spec, measures: [ms[0]], repeat: times, dyn: (spec.dyn || []).filter(d => d.m === 0) }, len: specBeats(spec) / ms.length, collapsed: true };
  const out = ms.map((m, i) => (i && sig(m) === sig(ms[i - 1]) && !(spec.dyn || []).some(d => d.m === i) ? { ...m, pct: true } : m));
  return { spec: { ...spec, measures: out }, len: specBeats(spec), collapsed: false, pct: out.map(m => !!m.pct) };
}
/* 這一關最短的音符(題目卡的標籤;關卡名稱不放時值括號):三連音 > 十六分 > 八分 > 四分(休止也算:十六分休止 = 十六分的律動) */
export function valueTag(spec){
  let min = Infinity, tri = false;
  for (const m of spec.measures) for (const v of m.voices) for (const e of v) {
    const val = e.value[0] === "r" ? e.value.slice(1) : e.value;
    if (/t3/.test(val)) tri = true;
    const q = LEN_Q[val]; if (q == null) continue;
    min = Math.min(min, q === 0.75 ? 0.25 : q === 1.5 ? 0.5 : q);   // 附點八分 = 跟十六分一組;12/8 的附點四分 = 三個八分
  }
  if (tri) return ["三連音", "Triplets"];
  return min <= 0.25 ? ["十六分音符", "16th notes"] : min <= 0.5 ? ["八分音符", "Eighth notes"] : ["四分音符", "Quarter notes"];
}
/* 關卡 → { spec, bars(DSL 展開後), pieces, lenBeats(四分音符), time, compound, pulse(一拍幾個四分音符), seed } */
export function toSpec(level, seed = 1, { key = null } = {}){
  const time = level.time || "4/4", compound = time === "12/8";
  if (time !== "4/4" && !compound) throw new Error(`${level.id}:拍號只支援 4/4、12/8(${time})`);
  const bars = barsOf(level, seed);
  const measures = bars.map((b, mi) => {
    for (const k of Object.keys(b)) if (!HAND_LINES[k] && !FOOT_LINES[k]) throw new Error(`${level.id} 第 ${mi + 1} 小節:不認得的行 ${k}`);
    const where = `${level.id} 第 ${mi + 1} 小節`;
    return { voices: [voiceOf(b, HAND_LINES, { compound, where: where + " 手", hands: true }), voiceOf(b, FOOT_LINES, { compound, where: where + " 腳", hands: false })] };
  });
  // 只用一隻手的關(第 0 組「跟拍點數拍」:右手):手打的音全部標這隻手
  if (level.oneHand) for (const m of measures) for (const e of m.voices[0]) for (const n of e.notes || []) if (n.hand) n.hand = level.oneHand;
  const spec = { lines: 5, time, measures, dyn: level.dyn || [] };
  if (key) spec.key = key;
  const pieces = new Set();
  for (const m of measures) for (const v of m.voices) for (const e of v) for (const n of e.notes || []) pieces.add(n.open && n.piece === "hh" ? "hhOpen" : n.piece);
  return { spec, bars, pieces: [...pieces], lenBeats: specBeats(spec), time, compound, pulse: compound ? 1.5 : 1, seed };
}
/* 播放事件(四分音符拍子;速度 = 四分音符 bpm)。漸強(level.cresc = { m }):那一小節的音量從 p 直線到 f(播放用,譜上是 p + 漸強線) */
export function eventsOf(r, qbpm, level = {}){
  const ev = toEvents(r.spec, { bpm: qbpm });
  if (level.cresc) {
    const m = level.cresc.m, s0 = r.spec.measures.slice(0, m).length * (r.lenBeats / r.spec.measures.length), len = r.lenBeats / r.spec.measures.length;
    for (const e of ev) if (e.m === m && !e.grace) e.vel = Math.round((0.4 + 0.5 * Math.max(0, Math.min(1, (e.beat - s0) / len))) * 1000) / 1000;
  }
  return ev;
}
/* 左右手:[{ mi, t(這一小節的 divisions), k(和弦裡由低到高第幾個), hand }](legend.js graphicalNotes 的對法) */
export function handsOf(spec, key){
  const out = [], ord = p => { const x = key.pieces[p]; return x.oct * 7 + "CDEFGAB".indexOf(x.step); };
  spec.measures.forEach((m, mi) => {
    let t = 0;
    for (const e of m.voices[0] || []) {
      const v = e.value[0] === "r" ? e.value.slice(1) : e.value;
      if (e.notes) [...e.notes].sort((a, b) => ord(a.piece) - ord(b.piece)).forEach((n, k) => { if (n.hand) out.push({ mi, t: Math.round(t), k, hand: n.hand, groove: !!n.groove }); });
      t += lenQ(v) * DIV;
    }
  });
  return out;
}
