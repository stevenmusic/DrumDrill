/* 國際打擊樂協會(PAS)40 個國際標準基本打法(Percussive Arts Society International Drum Rudiments,1984)。
   照 PAS 官方表(pas.org/wp-content/uploads/2024/04/pas-rudiments.pdf,2026-10 逐個核對)一字一字抄:
   每一個的左右手、時值、重音、Flam / Drag、滾奏斜線數都跟官方表一樣。官方表沒有拍號,這裡也不印。
   滾奏照官方的記法(音符加斜線):斜線數決定要打幾下 —— 八分音符 + 2 條斜線 = 32 分音符 × 4(RRLL),
   所以示範播放也是照官方譜算出來的,不是另外編的。

   寫法(一個打法一行,| 分開連桿的組):
     手:R / L;前面加 f = Flam(前面一個另一隻手的裝飾音)、d = Drag(兩個另一隻手的裝飾音)
     > = 重音;/ 後面是時值:32、16、8、8.(附點八分)、4、2;r = 休止符
     ~n = 滾奏(加 n 條斜線);z = 多次反彈(buzz);tN = N 連音(3、5、6、7、9、10;PAS 表只用到 t3 / t6,其他給 RSL 練習型用)
   second = true:官方表印了第二行(左手先)的打法,才給「左手先」的選項(第二行就是左右手對調) */

export const DIV = 24;   // 一個四分音符 = 24
const DUR = { "32": 3, "16": 6, "8": 12, "8.": 18, "4": 24, "2": 48 };
const BEAMS = { "32": 3, "16": 2, "8": 1, "8.": 1, "4": 0, "2": 0 };

export const CATEGORIES = [
  { id: "roll", zh: "滾奏", en: "Rolls", sub: [
    { zh: "單擊滾奏類", en: "Single stroke roll rudiments", from: 1, to: 3 },
    { zh: "多次反彈滾奏類", en: "Multiple bounce roll rudiments", from: 4, to: 5 },
    { zh: "雙擊開放滾奏類", en: "Double stroke open roll rudiments", from: 6, to: 15 }] },
  { id: "diddle", zh: "複點", en: "Diddles", sub: [{ zh: "複點類", en: "Diddle rudiments", from: 16, to: 19 }] },
  { id: "flam", zh: "Flam", en: "Flams", sub: [{ zh: "Flam 類(單裝飾音)", en: "Flam rudiments", from: 20, to: 30 }] },
  { id: "drag", zh: "Drag", en: "Drags", sub: [{ zh: "Drag 類(雙裝飾音)", en: "Drag rudiments", from: 31, to: 40 }] }
];

// [號碼, 英文名(PAS), 中文名, 寫法, 官方表有第二行(左手先)]
const DEFS = [
  [1, "Single Stroke Roll", "單擊滾奏", "R/32 L/32 R/32 L/32 | R/32 L/32 R/32 L/32"],
  [2, "Single Stroke Four", "單擊四連", "R/16t3 L/16t3 R/16t3 L/8 | R/16t3 L/16t3 R/16t3 L/8", true],
  [3, "Single Stroke Seven", "單擊七連", "R/16t6 L/16t6 R/16t6 L/16t6 R/16t6 L/16t6 | R/4", true],
  [4, "Multiple Bounce Roll", "多次反彈滾奏", "R/2z"],
  [5, "Triple Stroke Roll", "三擊滾奏", "R/16t3 R/16t3 R/16t3 L/16t3 L/16t3 L/16t3 | R/16t3 R/16t3 R/16t3 L/16t3 L/16t3 L/16t3"],
  [6, "Double Stroke Open Roll", "雙擊開放滾奏", "R/2~3"],
  [7, "Five Stroke Roll", "五擊滾奏", "R/8~2 R>/8 | L/8~2 L>/8"],
  [8, "Six Stroke Roll", "六擊滾奏", "R>/16 L/8~2 L>/16 | R>/16 L/8~2 L>/16", true],
  [9, "Seven Stroke Roll", "七擊滾奏", "R/8.~2 L>/16 | R/8.~2 L>/16", true],
  [10, "Nine Stroke Roll", "九擊滾奏", "R/4~3 | R>/4 | L/4~3 | L>/4"],
  [11, "Ten Stroke Roll", "十擊滾奏", "R/4~3 | R>/16 L>/16 | r/8 | R/4~3 | R>/16 L>/16 | r/8", true],
  [12, "Eleven Stroke Roll", "十一擊滾奏", "R/4~3 | R/16~1 L>/16 | r/8 | R/4~3 | R/16~1 L>/16 | r/8", true],
  [13, "Thirteen Stroke Roll", "十三擊滾奏", "R/4~3 | R/8~2 R>/8 | L/4~3 | L/8~2 L>/8"],
  [14, "Fifteen Stroke Roll", "十五擊滾奏", "R/4~3 | R/8.~2 L>/16 | R/4~3 | R/8.~2 L>/16", true],
  [15, "Seventeen Stroke Roll", "十七擊滾奏", "R/2~3 | R>/4 | L/2~3 | L>/4"],
  [16, "Single Paradiddle", "單複點", "R>/16 L/16 R/16 R/16 | L>/16 R/16 L/16 L/16"],
  [17, "Double Paradiddle", "雙複點", "R>/16 L/16 R/16 L/16 R/16 R/16 | L>/16 R/16 L/16 R/16 L/16 L/16"],
  [18, "Triple Paradiddle", "三複點", "R>/16 L/16 R/16 L/16 | R/16 L/16 R/16 R/16 | L>/16 R/16 L/16 R/16 | L/16 R/16 L/16 L/16"],
  [19, "Single Paradiddle-diddle", "單複點加雙擊", "R>/16 L/16 R/16 R/16 L/16 L/16 | R>/16 L/16 R/16 R/16 L/16 L/16", true],
  [20, "Flam", "Flam", "fR/4 | fL/4"],
  [21, "Flam Accent", "Flam 重音", "fR>/8 L/8 R/8 | fL>/8 R/8 L/8"],
  [22, "Flam Tap", "Flam Tap", "fR>/16 R/16 fL>/16 L/16 | fR>/16 R/16 fL>/16 L/16"],
  [23, "Flamacue", "Flamacue", "fR/16 L>/16 R/16 L/16 | fR/4", true],
  [24, "Flam Paradiddle", "Flam 複點", "fR>/16 L/16 R/16 R/16 | fL>/16 R/16 L/16 L/16"],
  [25, "Single Flammed Mill", "單 Flam 磨坊", "fR>/16 R/16 L/16 R/16 | fL>/16 L/16 R/16 L/16"],
  [26, "Flam Paradiddle-diddle", "Flam 複點加雙擊", "fR>/16 L/16 R/16 R/16 L/16 L/16 | fL>/16 R/16 L/16 L/16 R/16 R/16"],
  [27, "Pataflafla", "Pataflafla", "fR>/16 L/16 R/16 fL>/16 | fR>/16 L/16 R/16 fL>/16"],
  [28, "Swiss Army Triplet", "瑞士軍隊三連音", "fR>/16t3 R/16t3 L/16t3 fR>/16t3 R/16t3 L/16t3", true],
  [29, "Inverted Flam Tap", "反向 Flam Tap", "fR>/16 L/16 fL>/16 R/16 | fR>/16 L/16 fL>/16 R/16"],
  [30, "Flam Drag", "Flam Drag", "fR>/8 L/16 L/16 R/8 | fL>/8 R/16 R/16 L/8"],
  [31, "Drag", "Drag", "dR/4 | dL/4"],
  [32, "Single Drag Tap", "單 Drag Tap", "dR/8 L>/8 | dL/8 R>/8"],
  [33, "Double Drag Tap", "雙 Drag Tap", "dR/8 dR/8 L>/8 | dL/8 dL/8 R>/8"],
  [34, "Lesson 25", "Lesson 25", "dR/16 L/16 R>/8 | dR/16 L/16 R>/8", true],
  [35, "Single Dragadiddle", "單 Dragadiddle", "R>/16~1 L/16 R/16 R/16 | L>/16~1 R/16 L/16 L/16"],
  [36, "Drag Paradiddle #1", "Drag 複點 #1", "R>/8 dR/16 L/16 R/16 R/16 | L>/8 dL/16 R/16 L/16 L/16"],
  [37, "Drag Paradiddle #2", "Drag 複點 #2", "R>/8 dR/8 | dR/16 L/16 R/16 R/16 | L>/8 dL/8 | dL/16 R/16 L/16 L/16"],
  [38, "Single Ratamacue", "單 Ratamacue", "dR/16t3 L/16t3 R/16t3 L>/8 | dL/16t3 R/16t3 L/16t3 R>/8"],
  [39, "Double Ratamacue", "雙 Ratamacue", "dR/8 dR/16t3 L/16t3 R/16t3 L>/8 | dL/8 dL/16t3 R/16t3 L/16t3 R>/8"],
  [40, "Triple Ratamacue", "三 Ratamacue", "dR/8 dR/8 dR/16t3 L/16t3 R/16t3 L>/8 | dL/8 dL/8 dL/16t3 R/16t3 L/16t3 R>/8"]
];

/* N 連音佔幾個「同樣時值的一般音符」的時間:3:2、5:4、6:4、7:4、9:8、10:8(MusicXML 的 normal-notes) */
export const TUPLET_NORMAL = { 3: 2, 5: 4, 6: 4, 7: 4, 9: 8, 10: 8 };
/* 一個記號 → 一個音 */
export function parseToken(tok){
  const m = tok.match(/^([fd]?)([RLr])(>?)\/(32|16|8\.|8|4|2)(?:~(\d))?(z)?(?:t(3|5|6|7|9|10))?$/);
  if (!m) throw new Error("rudiment token: " + tok);
  const [, orn, hand, acc, val, trem, buzz, tup] = m;
  const n = { hand: hand === "r" ? null : hand, rest: hand === "r", value: val, dur: DUR[val], beams: BEAMS[val] };
  if (acc) n.accent = true;
  if (orn === "f") n.flam = true;
  if (orn === "d") n.drag = true;
  if (trem) n.trem = Number(trem);
  if (buzz) n.buzz = true;
  if (tup) { n.tuplet = Number(tup); n.normal = TUPLET_NORMAL[n.tuplet]; n.dur = n.dur * n.normal / n.tuplet; }   // N 個佔 normal 個的時間(五連音的長度不是整數,MusicXML 端另外放大)
  return n;
}
const other = h => (h === "R" ? "L" : "R");

export const RUDIMENTS = DEFS.map(([no, en, zh, src, second]) => {
  const groups = src.split("|").map(g => g.trim().split(/\s+/).map(parseToken));
  const cat = CATEGORIES.find(c => c.sub.some(s => no >= s.from && no <= s.to));
  return { no, en, zh, cat: cat.id, groups, second: !!second };
});
export const byNo = no => RUDIMENTS.find(r => r.no === no);

/* 左手先:官方表第二行 = 每一個音(含裝飾音)左右對調 */
export function withLead(r, lead){
  if (lead !== "L" || !r.second) return r.groups;
  return r.groups.map(g => g.map(n => (n.hand ? { ...n, hand: other(n.hand) } : n)));
}

/* 實際打的每一下(示範播放、計算擊數用):
   { at: 開始的位置(1/24 四分音符), hand, kind: "tap" | "accent" | "grace" | "roll" | "buzz" }
   滾奏:音符的時值除以「連桿 + 斜線」決定的音符長度,雙擊(RRLL)從音符上寫的那隻手開始;
   多次反彈(buzz):照兩手交替的十六分音符,每一下由取樣的反彈表現(播放端處理)。
   裝飾音:Flam 一下、Drag 兩下,都在主音之前(at 跟主音相同,grace 由播放端提前) */
export function strokes(groups){
  const out = [];
  let at = 0;
  for (const g of groups) for (const n of g) {
    if (n.rest) { at += n.dur; continue; }
    if (n.flam) out.push({ at, hand: other(n.hand), kind: "grace", grace: 1, of: 1 });
    if (n.drag) { out.push({ at, hand: other(n.hand), kind: "grace", grace: 2, of: 2 }); out.push({ at, hand: other(n.hand), kind: "grace", grace: 1, of: 2 }); }
    if (n.trem) {
      const unit = { 1: 12, 2: 6, 3: 3 }[n.beams + n.trem];
      const count = Math.round(n.dur / unit);
      for (let k = 0; k < count; k++) out.push({ at: at + k * unit, hand: Math.floor(k / 2) % 2 ? other(n.hand) : n.hand, kind: k === 0 && n.accent ? "accent" : "roll", first: k === 0 });
    } else if (n.buzz) {
      const unit = 6;   // 兩手交替的十六分音符,每一下多次反彈
      for (let k = 0; k * unit < n.dur; k++) out.push({ at: at + k * unit, hand: k % 2 ? other(n.hand) : n.hand, kind: "buzz" });
    } else out.push({ at, hand: n.hand, kind: n.accent ? "accent" : "tap" });
    at += n.dur;
  }
  return out;
}
/* 一輪的長度(1/24 四分音符;五、七、九、十連音的單音長度不是整數,加總後去掉浮點誤差) */
export const cycleLength = groups => Math.round(groups.flat().reduce((s, n) => s + n.dur, 0) * 1e6) / 1e6;
/* 一輪實際打幾下(不含裝飾音)— 用來核對滾奏的名稱(五擊 = 5 下) */
export const mainStrokes = groups => strokes(groups).filter(s => s.kind !== "grace").length;

/* ══ RSL 技巧的「依大綱時值」練習型(data/exam-rsl.json 的 kind:"pattern";STAGES.md 決定 2、S4)══
   大綱只寫「哪個打法 + 什麼時值」(例如入門級「Paradiddles,八分音符」),譜在付費檢定書裡 → App 用 PAS 官方表的左右手、重音、Flam / Drag,
   每一下換成大綱的時值。這不是官方譜(畫面標「App 依大綱時值排的練習型」),所以:
   - 左右手、重音、裝飾音一律照 PAS 表(strokes() 取主擊),不自己加重音
   - sticking "single" = #1 單擊滾奏的左右手(RL 交替;不是 #1 原譜的三十二分音符)、"double" = #6 雙擊開放滾奏的 RRLL(取滾奏實際打的左右手)
   - 其他 PAS 編號:原譜裡有滾奏斜線(~)或多次反彈(z)的不支援(一個音不是一下)→ 丟出錯誤
   - 左右手序列取最短的重複單位(#1 → RL、#6 → RRLL、#19 → RLRRLL,重音、裝飾音也要一樣才算重複)
   - 一輪 = lcm(序列長, 每拍幾個音) 個音 → 一定是整數拍;每一拍一組連桿(三連音、六連音……一拍一組,每組標數字)
   lead = "L":只有官方表印了第二行的打法才有(withLead 照原本的規則) */
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/* "8t3" → { val:"8", tup:3, perBeat:3 };"16" → { val:"16", tup:0, perBeat:4 } */
export function parseValue(code){
  const m = String(code).match(/^(32|16|8|4|2)(?:t(3|5|6|7|9|10))?$/);
  if (!m) throw new Error("pattern value: " + code);
  const val = m[1], tup = m[2] ? Number(m[2]) : 0;
  const perBeat = tup ? tup * DIV / (DUR[val] * TUPLET_NORMAL[tup]) : DIV / DUR[val];
  if (!Number.isInteger(perBeat) || perBeat < 1) throw new Error("pattern value: " + code + "(每拍不是整數個音)");
  return { val, tup, perBeat };
}
/* PAS 打法 → 主擊序列 [{hand, accent, flam, drag}](最短重複單位) */
export function patternSeq({ pas, sticking, lead = "R" }){
  const no = sticking === "single" ? 1 : sticking === "double" ? 6 : pas;
  if (sticking && pas !== no) throw new Error(`pattern: sticking ${sticking} 要配 PAS #${no}(拿到 #${pas})`);
  const r = byNo(no);
  if (!r) throw new Error("pattern: 沒有 PAS #" + pas);
  if (sticking !== "double" && r.groups.flat().some(n => n.trem || n.buzz)) throw new Error(`pattern: PAS #${no} 有滾奏斜線或多次反彈,不能換時值`);
  const seq = [];
  let grace = 0;
  for (const s of strokes(withLead(r, lead))) {
    if (s.kind === "grace") { grace++; continue; }
    seq.push({ hand: s.hand, accent: s.kind === "accent", flam: grace === 1, drag: grace === 2 });
    grace = 0;
  }
  const same = (a, b) => a.hand === b.hand && a.accent === b.accent && a.flam === b.flam && a.drag === b.drag;
  for (let p = 1; p <= seq.length; p++) if (seq.length % p === 0 && seq.every((x, i) => same(x, seq[i % p]))) return seq.slice(0, p);
  return seq;
}
/* → groups(跟 RUDIMENTS[].groups 同一種格式,記譜、播放、擊數都照用) */
export function pattern({ pas, sticking, value, lead = "R" }){
  const seq = patternSeq({ pas, sticking, lead }), { val, tup, perBeat } = parseValue(value);
  const count = seq.length * perBeat / gcd(seq.length, perBeat);
  const notes = [];
  for (let i = 0; i < count; i++) {
    const x = seq[i % seq.length];
    notes.push(parseToken(`${x.flam ? "f" : x.drag ? "d" : ""}${x.hand}${x.accent ? ">" : ""}/${val}${tup ? "t" + tup : ""}`));
  }
  const groups = [];
  for (let i = 0; i < count; i += perBeat) groups.push(notes.slice(i, i + perBeat));
  return groups;
}
