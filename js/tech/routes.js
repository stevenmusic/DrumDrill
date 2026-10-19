/* 今日練習的路線與關卡(DrumDrill;引擎 js/shared/daily.js、卡片 js/shared/dailycard.js、譜的寫法 js/tech/routespec.js)。
   全部都是 App 編排的練習(練習設定,不是考試要求):律動 30 關(第 0 組 1 + A 4 + B 8 + C 5 + D 6 + E 3 + F 3)+ 過門 19 關(過門在律動過了 B2「8 Beat 基本節奏」才開放)。
   - 第 0 組(初學基礎,系統化 2026-10):「跟拍點數拍」只用右手四分音符跟拍點(oneHand: "R" = 左右手全部標 R);快速通道照舊可以快速跳過
   - 時值由慢到快(使用者要求,給完全初學的人):每條路線第 1 關一定是四分音符 → 八分 → 後面才十六分 / 三連音
   - start / target(♩;12/8 是 ♩.)、up(每穩一次加快;沒寫 = 8)、check(重點 2–3 項:鼓墊量不到的手腳、音量,自己檢查)
   - pat = 譜(寫法見 routespec.js);「@kick8」之類 = 每天不一樣(種子 = 日期 + 關卡,同一天同一題)
   - rl:false = 這一關預設不標左右手(難度明顯上升以後:律動的十六分 / 三連音、過門的後半);題目卡的「標示左右手」可以自己切(每條路線記住)
   - vary:複習的變化(沒寫 = daily.js 的預設:原樣 → 拍點只響 2、4 → 只響第 1 拍 → 中途消失 2 小節 → 中途消失 + 最快) */
const Q = "x--- x--- x--- x---", E8 = "x-x- x-x- x-x- x-x-", S16 = "xxxx xxxx xxxx xxxx";
const BD13 = "x--- ---- x--- ----", SD24 = "---- x--- ---- x---", BD1 = "x--- ---- ---- ----";
const BEAT8 = { hh: E8, sd: SD24, bd: BD13 };
// 過門前一小節:Crash + 大鼓落在 1(Hi-hat 從 1& 接回)
const LAND = { cr: "x--- ---- ---- ----", hh: "--x- x-x- x-x- x-x-", sd: SD24, bd: BD13 };
const HH12 = "x-x- x-x- ---- ----", HH123 = "x-x- x-x- x-x- ----";   // 過門那一小節:Hi-hat 打到過門前
const fill = bar2 => [LAND, bar2];
const c = (zh, en) => [zh, en];

const GROOVE = [
  // ── 0 初學基礎 ──
  { id: "G01", g: "0", name: c("跟拍點數拍", "Count with the click"), start: 56, target: 80, oneHand: "R", pat: { sd: Q },
    check: [c("只用右手,邊打邊數 1 2 3 4", "Right hand only; count 1 2 3 4 out loud"), c("跟拍點同時下去", "Land with the click")] },
  // ── A 四分音符(手腳對齊)──
  { id: "A1", g: "A", name: c("右手和大鼓一起", "Hand and kick together"), start: 56, target: 80, pat: { hh: Q, bd: Q },
    check: [c("Hi-hat 和大鼓同時下去", "Hi-hat and kick land together"), c("數出來:1、2、3、4", "Count out loud: 1 2 3 4")] },
  { id: "A2", g: "A", name: c("Hi-hat 和小鼓", "Hi-hat with snare on 2 & 4"), start: 56, target: 84, pat: { hh: Q, sd: SD24 },
    check: [c("右手 Hi-hat、左手小鼓", "Right hand hi-hat, left hand snare"), c("2、4 拍兩手同時", "Both hands together on 2 and 4")] },
  { id: "A3", g: "A", name: c("大鼓和小鼓輪流", "Kick and snare trade"), start: 60, target: 96, pat: { sd: SD24, bd: BD13 },
    check: [c("大鼓 1、3,小鼓 2、4", "Kick on 1 & 3, snare on 2 & 4"), c("間隔一樣,不要越打越快", "Even spacing, don't rush")] },
  { id: "A4", g: "A", name: c("四分音符的基本節奏", "Quarter-note beat"), start: 60, target: 96, pat: { hh: Q, sd: SD24, bd: BD13 },
    check: [c("三樣一起對齊", "All three line up"), c("跟著拍點數 1 2 3 4", "Count 1 2 3 4 with the click")] },
  // ── B 八分音符的 8 Beat(固定手、變化大鼓)──
  { id: "B1", g: "B", name: c("右手八分、大鼓 1、3", "Eighths over kick on 1 & 3"), start: 60, target: 92, pat: { hh: E8, bd: BD13 },
    check: [c("右手平均、不停", "Right hand even, never stops"), c("數 1 & 2 & 3 & 4 &(& 唸 and = 拍子的後半)", "Count 1 & 2 & 3 & 4 & (& = the second half of the beat)")] },
  { id: "B2", g: "B", name: c("8 Beat 基本節奏", "Basic 8-beat"), start: 60, target: 100, pat: BEAT8,
    check: [c("之後每一關的底子", "The base for every level after"), c("Hi-hat 每一下一樣大", "Even hi-hat"), c("小鼓 2、4 打清楚", "Clear snare on 2 & 4")] },
  { id: "B3", g: "B", name: c("大鼓加在 3&", "Kick on 3&"), start: 60, target: 96, pat: { ...BEAT8, bd: "x--- ---- x-x- ----" },
    check: [c("3& 的大鼓跟 Hi-hat 同時", "The 3& kick lands with the hi-hat"), c("手不要跟著腳變", "Hands stay the same")] },
  { id: "B4", g: "B", name: c("大鼓加在 1&", "Kick on 1&"), start: 60, target: 96, pat: { ...BEAT8, bd: "x-x- ---- x--- ----" },
    check: [c("1& 之後,小鼓 2 不要提早", "After 1&, don't rush the snare on 2"), c("兩下大鼓一樣大", "Both kicks even")] },
  { id: "B5", g: "B", name: c("大鼓連兩下", "Two kicks in a row"), start: 60, target: 92, pat: { ...BEAT8, bd: "x-x- ---- x-x- ----" },
    check: [c("兩下一樣大", "Both kicks even"), c("腳踩完就放鬆", "Relax the foot after each kick")] },
  { id: "B6", g: "B", name: c("大鼓在 2&", "Kick on 2&"), start: 60, target: 92, pat: { ...BEAT8, bd: "x--- --x- x--- ----" },
    check: [c("2& 的大鼓緊接在小鼓後面", "The 2& kick comes right after the snare"), c("數 1 & 2 & 3 & 4 &", "Count 1 & 2 & 3 & 4 &")] },
  { id: "B7", g: "B", name: c("兩小節一句", "Two-bar phrase"), start: 60, target: 92, pat: [BEAT8, { ...BEAT8, bd: "x--- ---- x-x- --x-" }],
    check: [c("第 2 小節 4& 的大鼓接回第 1 拍", "The 4& kick in bar 2 leads back to 1"), c("心裡數著兩小節", "Count both bars")] },
  { id: "B8", g: "B", name: c("讀大鼓(每天不一樣)", "Read the kick (new daily)"), start: 60, target: 88, pat: { hh: E8, sd: SD24, bd: "@kick8" },
    check: [c("先看譜再打", "Read it before you play"), c("手不跟著腳變", "Hands stay the same")] },
  // ── C 手的變化(八分)──
  { id: "C1", g: "C", name: c("小鼓加在 4&", "Snare on 4&"), start: 60, target: 92, pat: { hh: E8, sd: "---- x--- ---- x-x-", bd: BD13 },
    check: [c("4& 的小鼓跟 Hi-hat 同時", "The 4& snare lands with the hi-hat"), c("第 4 拍兩下小鼓一樣大", "Both snares on 4 even")] },
  { id: "C2", g: "C", name: c("Hi-hat 重音在拍上", "Accent the beats"), start: 60, target: 100, pat: { hh: "X-x- X-x- X-x- X-x-", sd: SD24, bd: BD13 },
    check: [c("拍上重、& 輕", "Loud on the beat, soft on the &"), c("音量鼓墊量不到,自己聽", "Pads can't hear volume — listen")] },
  { id: "C3", g: "C", name: c("Cross stick 抒情節奏", "Cross-stick ballad"), start: 56, target: 80, pat: { hh: E8, xs: SD24, bd: BD13 },
    check: [c("左手鼓棒平放,敲鼓框", "Left stick flat, click the rim"), c("比 Hi-hat 小聲、柔和", "Softer than the hi-hat")] },
  { id: "C4", g: "C", name: c("Half-time(小鼓在第 3 拍)", "Half-time feel"), start: 60, target: 96, pat: { hh: E8, sd: "---- ---- x--- ----", bd: "x--- --x- ---- ----" },
    check: [c("小鼓只在第 3 拍", "Snare only on 3"), c("感覺慢一半,Hi-hat 照常", "Feels half as fast; hi-hat as usual")] },
  { id: "C5", g: "C", name: c("讀小鼓(每天不一樣)", "Read the snare (new daily)"), start: 60, target: 88, pat: { hh: E8, sd: "@snare8", bd: BD13 },
    check: [c("先看譜再打", "Read it before you play"), c("右手不停", "Right hand keeps going")] },
  // ── D 加入左腳(四肢;先換到 Ride,再加左腳:每一關只加一件新東西)──
  { id: "DR", g: "D", name: c("Ride 上的 8 Beat", "8-beat on the ride"), start: 60, target: 96, pat: { ride: E8, sd: SD24, bd: BD13 },
    check: [c("右手換到 Ride", "Right hand moves to the ride"), c("跟 Hi-hat 上一樣平均", "As even as on the hi-hat")] },
  { id: "D1", g: "D", name: c("加左腳:踩 2、4", "Add the foot: hi-hat on 2 & 4"), start: 60, target: 92, pat: { ride: E8, sd: SD24, bd: BD13, hf: SD24 },
    check: [c("左腳和小鼓同時", "Left foot with the snare"), c("右手 Ride 不受影響", "Ride hand stays steady")] },
  { id: "D2", g: "D", name: c("左腳每一拍踩", "Foot hi-hat on every beat"), start: 60, target: 92, pat: { ride: E8, sd: SD24, bd: BD13, hf: Q },
    check: [c("左腳穩定,不跟著大鼓亂", "Left foot steady, not pulled by the kick"), c("腳跟可以跟著拍子點", "Let the heel mark the beat")] },
  { id: "D3", g: "D", name: c("開 Hi-hat 在 4&", "Open hi-hat on 4&"), start: 60, target: 92, pat: { hh: "x-x- x-x- x-x- x-o-", sd: SD24, bd: BD13 },
    check: [c("4& 左腳放開,讓 Hi-hat 響", "Lift the left foot on 4& so it rings"), c("下一個 1 左腳踩下去關好", "Close it with the foot on the next 1")] },
  { id: "D5", g: "D", name: c("四肢 + 讀大鼓(每天不一樣)", "All four limbs, read the kick"), start: 56, target: 84, pat: { ride: E8, sd: SD24, hf: SD24, bd: "@kick8" },
    check: [c("先看大鼓", "Read the kick first"), c("左腳一直在 2、4", "Left foot stays on 2 & 4")] },
  { id: "D4", g: "D", name: c("左腳踩在 &", "Foot hi-hat on the &s"), start: 56, target: 84, pat: { ride: E8, sd: SD24, bd: BD13, hf: "--x- --x- --x- --x-" },
    check: [c("左腳在 &,跟 Ride 同時", "Left foot on the &, with the ride"), c("拍上不要踩", "Not on the beats")] },
  // ── E 十六分音符(預設不標左右手)──
  { id: "E1", g: "E", name: c("十六分 Hi-hat(一隻手)", "16th-note hi-hat, one hand"), start: 50, target: 76, rl: false, pat: { hh: S16, sd: SD24, bd: BD13 },
    check: [c("手腕放鬆,用彈的", "Loose wrist, let it bounce"), c("小鼓那一下 Hi-hat 照打", "Keep the hi-hat going on the snare")] },
  { id: "E2", g: "E", name: c("大鼓在 2 拍最後一個十六分", "Kick on the 'a' of 2"), start: 50, target: 76, rl: false, pat: { hh: S16, sd: SD24, bd: "x--- ---x x--- ----" },
    check: [c("數 1 e & a", "Count 1 e & a"), c("那一下大鼓緊貼著 3", "That kick leads straight into 3")] },
  { id: "E3", g: "E", name: c("八分 Hi-hat 下的十六分大鼓", "16th kick under eighth hi-hat"), start: 56, target: 84, rl: false, pat: { hh: E8, sd: SD24, bd: "x--- ---x x-x- ----" },
    check: [c("大鼓落在兩下 Hi-hat 中間", "The kick falls between hi-hat notes"), c("心裡數十六分", "Count 16ths in your head")] },
  // ── F 三連音感(預設不標左右手)──
  { id: "F1", g: "F", name: c("12/8 抒情節奏", "12/8 ballad"), time: "12/8", start: 40, target: 60, rl: false,
    pat: { hh: "xxx xxx xxx xxx", sd: "--- x-- --- x--", bd: "x-- --- x-- ---" },
    check: [c("一拍三下平均", "Three even notes per beat"), c("小鼓在第 2、4 大拍", "Snare on big beats 2 & 4")] },
  { id: "F2", g: "F", name: c("Shuffle", "Shuffle"), start: 60, target: 96, rl: false, pat: { hh: "x-x x-x x-x x-x", sd: "--- x-- --- x--", bd: "x-- --- x-- ---" },
    check: [c("長—短、長—短", "Long–short, long–short"), c("第二下是三連音的最後一個", "The short note is the last triplet")] },
  { id: "F3", g: "F", name: c("Shuffle 大鼓接一下", "Shuffle with a kick pickup"), start: 60, target: 92, rl: false, pat: { hh: "x-x x-x x-x x-x", sd: "--- x-- --- x--", bd: "x-- --x x-- ---" },
    check: [c("2 拍最後那下大鼓接到 3", "The last triplet of 2 leads into 3"), c("Hi-hat 照樣長—短", "Hi-hat stays long–short")] }
];

const FILLS = [
  // ── FA 四分、八分音符的過門 ──
  { id: "FA1", g: "FA", name: c("小鼓四分兩下(第 3、4 拍)", "Two snare quarters on 3 & 4"), start: 60, target: 100,
    pat: [{ hh: Q, sd: SD24, bd: BD13 }, { hh: "x--- x--- ---- ----", sd: "---- x--- x--- x---", bd: BD1 }],   // 全部四分音符(第 1 關)
    check: [c("過門完馬上回到 Hi-hat", "Straight back to the hi-hat"), c("數著 3、4,回到 1", "Count 3, 4, back to 1")] },
  { id: "FA2", g: "FA", name: c("落在 Crash", "Land on the crash"), start: 60, target: 100,
    pat: fill({ hh: HH12, sd: "---- x--- x--- x---", bd: BD1 }),
    check: [c("Crash 和大鼓一起落在 1", "Crash and kick together on 1"), c("Hi-hat 從 1& 接回", "Hi-hat comes back on 1&")] },
  { id: "FA3", g: "FA", name: c("四分音符繞鼓", "Quarter notes around the drums"), start: 60, target: 100,
    pat: fill({ sd: "x--- ---- ---- ----", t1: "---- x--- ---- ----", t2: "---- ---- x--- ----", ft: "---- ---- ---- x---", bd: BD1 }),
    check: [c("小鼓 → Tom 1 → Tom 2 → 落地鼓", "Snare → Tom 1 → Tom 2 → floor tom"), c("手臂帶著移動,速度不變", "Move from the arm, keep the time")] },
  { id: "FA4", g: "FA", name: c("第 4 拍小鼓八分兩下", "Two snare eighths on 4"), start: 60, target: 100,
    pat: fill({ hh: HH123, sd: "---- x--- ---- x-x-", bd: BD13 }),
    check: [c("第 4 拍的兩下一樣大", "Both notes on 4 even"), c("過門完馬上回到 Crash", "Straight back to the crash")] },
  { id: "FA5", g: "FA", name: c("落地鼓加大鼓", "Floor tom with kick"), start: 60, target: 92,
    pat: fill({ hh: HH12, sd: "---- x--- x-x- ----", ft: "---- ---- ---- x-x-", bd: "x--- ---- ---- x-x-" }),
    check: [c("落地鼓和大鼓同時", "Floor tom and kick together"), c("最後落在 Crash", "Land on the crash")] },
  // ── FB 十六分音符的過門 ──
  { id: "FB1", g: "FB", name: c("第 4 拍小鼓十六分四下", "Four snare 16ths on 4"), start: 60, target: 88,
    pat: fill({ hh: HH123, sd: "---- x--- ---- xxxx", bd: BD13 }),
    check: [c("四下一樣大", "Four even notes"), c("不要拖慢", "Don't slow down")] },
  { id: "FB2", g: "FB", name: c("小鼓兩下、Tom 1 兩下", "Snare 2, Tom 1 2"), start: 60, target: 88,
    pat: fill({ hh: HH123, sd: "---- x--- ---- xx--", t1: "---- ---- ---- --xx", bd: BD13 }),
    check: [c("換鼓時手不要舉太高", "Keep the sticks low when moving"), c("換鼓那下不斷", "No gap when you move")] },
  { id: "FB3", g: "FB", name: c("第 3、4 拍小鼓十六分八下", "Eight snare 16ths on 3 & 4"), start: 60, target: 84,
    pat: fill({ hh: HH12, sd: "---- x--- xxxx xxxx", bd: BD1 }),
    check: [c("兩手交替 RLRL", "Alternate RLRL"), c("八下一樣大", "All eight even")] },
  { id: "FB4", g: "FB", name: c("八分接十六分", "Eighths, then 16ths"), start: 60, target: 88,
    pat: fill({ hh: HH12, sd: "---- x--- x-x- ----", t1: "---- ---- ---- xx--", ft: "---- ---- ---- --xx", bd: BD1 }),
    check: [c("換成十六分不要搶拍", "Don't rush into the 16ths"), c("落地鼓那兩下不要晚", "Floor tom notes on time")] },
  { id: "FB5", g: "FB", name: c("繞鼓 2-2-2-2", "Around the drums, 2 each"), start: 60, target: 84, rl: false,
    pat: fill({ hh: HH12, sd: "---- x--- xx-- ----", t1: "---- ---- --xx ----", t2: "---- ---- ---- xx--", ft: "---- ---- ---- --xx", bd: BD1 }),
    check: [c("手臂帶著移動", "Move from the arm"), c("每個鼓音量一樣", "Even on every drum")] },
  // ── FC 一整小節的過門(預設不標左右手)──
  { id: "FC1", g: "FC", name: c("一小節十六分漸強", "One bar of 16ths, crescendo"), start: 56, target: 80, rl: false,
    pat: fill({ sd: S16, bd: BD1 }), dyn: [{ m: 1, beat: 0, mark: "p" }, { m: 1, beat: 0, mark: "cresc" }], cresc: { m: 1 },
    check: [c("從小聲漸漸變大聲", "Grow from soft to loud"), c("音量鼓墊量不到,自己聽", "Pads can't hear volume — listen")] },
  { id: "FC2", g: "FC", name: c("繞鼓 4-4-4-4", "Four on each drum"), start: 56, target: 80, rl: false,
    pat: fill({ sd: "xxxx ---- ---- ----", t1: "---- xxxx ---- ----", t2: "---- ---- xxxx ----", ft: "---- ---- ---- xxxx", bd: BD1 }),
    check: [c("每換一個鼓,速度不變", "Same speed on every drum"), c("落地鼓之後落在 Crash", "Land on the crash after the floor tom")] },
  { id: "FC3", g: "FC", name: c("留一點空", "Leave some space"), start: 56, target: 84, rl: false,
    pat: fill({ sd: "x--- --xx ---- ----", t1: "---- ---- x-xx ----", ft: "---- ---- ---- x-x-", bd: BD1 }),
    check: [c("休息的地方也要數", "Count the rests too"), c("落地準", "Land exactly on 1")] },
  // ── FT 三連音的過門(預設不標左右手)──
  { id: "FT1", g: "FT", name: c("第 4 拍三連音", "Triplet on beat 4"), start: 60, target: 88, rl: false,
    pat: fill({ hh: HH123, sd: "---- x--- ---- xxx", bd: BD13 }),
    check: [c("三下平均", "Three even notes"), c("回到 1 不要搶", "Don't rush back to 1")] },
  { id: "FT2", g: "FT", name: c("兩拍三連音", "Two beats of triplets"), start: 60, target: 84, rl: false,
    pat: fill({ hh: HH12, sd: "---- x--- xxx ---", t1: "---- ---- --- xx-", ft: "---- ---- --- --x", bd: BD1 }),
    check: [c("數 1-2-3、2-2-3", "Count 1-2-3, 2-2-3"), c("兩手交替", "Alternate hands")] },
  { id: "FT3", g: "FT", name: c("三連音繞鼓", "Triplets around the drums"), start: 56, target: 80, rl: false,
    pat: fill({ sd: "xxx --- --- ---", t1: "--- xxx --- ---", t2: "--- --- xxx ---", ft: "--- --- --- xxx", bd: "x-- --- --- ---" }),
    check: [c("三下一組平均", "Even groups of three"), c("換鼓不斷", "No gap between drums")] },
  // ── FD 樂句與讀譜(預設不標左右手)──
  { id: "FD1", g: "FD", name: c("4 小節一句", "Four-bar phrase"), start: 60, target: 92, rl: false,
    pat: [LAND, BEAT8, BEAT8, { hh: HH123, sd: "---- x--- ---- xx--", t1: "---- ---- ---- --xx", bd: BD13 }],
    check: [c("數到第 4 小節才過門", "Count to bar 4 before the fill"), c("回到第 1 小節的 Crash", "Back to the crash in bar 1")] },
  { id: "FD2", g: "FD", name: c("4 小節、兩拍過門", "Four bars, two-beat fill"), start: 60, target: 88, rl: false,
    pat: [LAND, BEAT8, BEAT8, { hh: HH12, sd: "---- x--- xx-- ----", t1: "---- ---- --xx ----", t2: "---- ---- ---- xx--", ft: "---- ---- ---- --xx", bd: BD1 }],
    check: [c("過門前一拍就準備好", "Get ready a beat before the fill"), c("數著 4 小節", "Count all four bars")] },
  { id: "FD3", g: "FD", name: c("讀過門(每天不一樣)", "Read the fill (new daily)"), start: 56, target: 84, rl: false,
    pat: fill({ hh: HH12, sd: SD24.slice(0, 9) + " ---- ----", bd: BD1, fill: "@fill2" }),
    check: [c("先看譜再打", "Read it before you play"), c("落地準", "Land exactly on 1")] }
];

/* 律動:C 組以後預設不標左右手(審查定案 2026-10;A、B 組標,只標第 1 小節);
   重點那一行第一個固定寫手怎麼分(「右手 Hi-hat、左手小鼓」,有 Ride 寫「右手 Ride」;check 裡已經寫了的不重複;dailycard 的 level.handsLine) */
for (const L of GROOVE) {
  if (["C", "D"].includes(L.g) && L.rl == null) L.rl = false;
  const pats = Array.isArray(L.pat) ? L.pat : [L.pat], has = k => pats.some(p => p && p[k]);
  if ((has("sd") || has("xs")) && (has("ride") || has("hh")) && !L.check.some(x => /右手/.test(x[0])))
    L.handsLine = has("ride") ? c("右手 Ride、左手小鼓", "RH ride, LH snare") : c("右手 Hi-hat、左手小鼓", "RH hi-hat, LH snare");
}
export const ROUTES = [
  { id: "groove", name: ["律動", "Grooves"], levels: GROOVE },
  { id: "fill", name: ["過門", "Fills"], unlock: { route: "groove", passed: "B2" }, levels: FILLS }
];

/* 暖身(現有的基本打法畫面;不過關、只記時間):照律動的進度一層一層加進來,只從最新的兩層挑(照日子輪流;標「再練」的優先)。
   一開始是 RSL 練習型的寫法(rudiments.js 的 pattern():單擊四分、八分),PAS 原譜(三十二分、滾奏斜線)等到十六分那一組練過才出現。
   after = 律動過了哪一關才加進來 */
export const WARM = [
  { pas: 1, sticking: "single", value: "4", name: ["單擊 四分音符 RL", "Singles in quarters, RL"], check: [c("鼓棒高度一樣", "Same stick height"), c("兩手音量一樣", "Both hands equally loud")] },
  { pas: 1, sticking: "single", value: "8", after: "A2", name: ["單擊 八分音符 RLRL", "Singles in eighths, RLRL"] },
  { pas: 6, sticking: "double", value: "8", after: "B2", name: ["雙擊 八分音符 RRLL", "Doubles in eighths, RRLL"] },
  { pas: 16, value: "8", after: "B2" },
  { pas: 20, value: "4", after: "C5" },
  { pas: 31, value: "4", after: "C5" },
  { pas: 22, value: "8", after: "D5" },
  { pas: 19, value: "8", after: "D5" },
  { pas: 16, after: "E3" }, { pas: 20, after: "E3" }, { pas: 7, after: "E3" }, { pas: 6, after: "E3" }
];
