// 鼓組記譜的樣張(notation-preview.html?kit=…、notation.mjs、checks/kitxml.mjs 共用):每個鼓件 × 每種修飾、拍號、連音、力度、自由發展小節、單線譜
// 這些只是記號的樣張(看 OSMD 畫不畫得出來),不是題目
import key from "../../data/drumkey.json" with { type: "json" };
const N = (piece, o = {}) => ({ piece, ...o });
const ev = (value, notes = [], o = {}) => ({ value, notes: Array.isArray(notes) ? notes : [notes], ...o });
const r = value => ({ value: "r" + value });
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const FEET = new Set(["kick", "hhFoot"]);

/* 一個鼓件的修飾:第 1 小節 一般 / 重音 / 鬼音 / Flam / Drag;第 2 小節 滾奏 / 連結線 / 三連音;HH 加開、閉 */
function pieceSample(id){
  if (FEET.has(id)) {
    const feet = [ev("4", N(id)), ev("8", N(id, { accent: true })), ev("8", N(id, { ghost: true })), ev("4", N(id), { tie: true }), ev("4", N(id))];
    return { id: "piece-" + id, group: "pieces", piece: id, spec: { time: "4/4", measures: [{ voices: [[], feet] }] } };
  }
  const m1 = [ev("4", N(id)), ev("8", N(id, { accent: true })), ev("8", N(id, { ghost: true })), ev("4", N(id, { flam: true })), ev("4", N(id, { drag: true }))];
  const m2 = [ev("4", N(id), { roll: 2 }), ev("8", N(id), { tie: true }), ev("8", N(id)), ...rep(3, () => ev("8t3", N(id))), r("4")];
  const measures = [{ voices: [m1] }, { voices: [m2] }];
  if (id === "hh") measures.push({ voices: [[ev("8", N("hh", { closed: true })), ev("8", N("hh", { open: true })), ev("8", N("hh", { closed: true })), ev("8", N("hh", { open: true, accent: true })), ev("2", N("hh"))]] });
  return { id: "piece-" + id, group: "pieces", piece: id, spec: { time: "4/4", measures } };
}

/* 一小節基本的 8 beat(拍號換了照拍數排) */
const rock = (hand = "hh") => ({ voices: [
  rep(8, i => ev("8", i % 4 === 2 ? [N(hand), N("snare")] : [N(hand)])),
  [ev("4", N("kick")), r("4"), ev("8", N("kick")), ev("8", N("kick")), r("4")]
] });

const OTHER = [
  // 律動:手腳兩個聲部、各種鈸、開閉 HH、鬼音、cross stick、腳踩 HH
  { id: "groove-rock", group: "grooves", spec: { time: "4/4", measures: [rock(), { voices: [
    [ev("8", N("crash", { accent: true })), ev("8", N("hh", { closed: true })), ev("8", [N("hh", { open: true }), N("snare")]), ev("8", N("hh", { closed: true })),
      ev("16", N("snare")), ev("16", N("snare", { ghost: true })), ev("16", N("snare", { ghost: true })), ev("16", N("snare")), ev("8", [N("hhOpen"), N("snare", { accent: true })]), ev("8", N("hhClosed"))],
    [ev("4", N("kick")), ev("4", N("hhFoot")), ev("4", N("kick")), ev("4", N("hhFoot"))]] }] } },
  { id: "groove-ride", group: "grooves", spec: { time: "4/4", measures: [{ voices: [
    [ev("4", N("ride")), ev("8", N("ride")), ev("8", [N("ride"), N("xstick")]), ev("4", N("rideBell")), ev("8", N("rideBell", { accent: true })), ev("8", [N("rideBell"), N("xstick")])],
    [ev("4", N("kick")), ev("4", N("hhFoot")), ev("4", N("kick")), ev("4", N("hhFoot"))]] },
    { voices: [[ev("16", N("tomHi")), ev("16", N("tomHi")), ev("16", N("tomMid")), ev("16", N("tomMid")), ev("16", N("snare", { flam: true })), ev("16", N("snare")), ev("16", N("tomFloor")), ev("16", N("tomFloor")),
      ev("8", N("tomFloor", { accent: true })), ev("8", N("snare", { drag: true })), ev("4", [N("crash", { accent: true })])],
      [r("2"), ev("8", N("kick")), ev("8", N("kick")), ev("4", N("kick"))]] }] } },
  // 拍號:複拍子、不規則拍、2/2、換拍號(一份譜裡)
  ...[["3/4", 6], ["2/4", 4], ["2/2", 8], ["5/4", 10], ["7/4", 14]].map(([t, n]) => ({ id: "time-" + t.replace("/", "-"), group: "meters", spec: { time: t, measures: [{ voices: [
    rep(n, i => ev("8", i % 4 === 2 ? [N("hh"), N("snare")] : [N("hh")])), [ev("4", N("kick"))]] }] } })),
  ...[["6/8", 6], ["9/8", 9], ["12/8", 12], ["3/8", 3], ["5/8", 5], ["7/8", 7], ["2+2+3/8", 7]].map(([t, n]) => ({ id: "time-" + t.replace(/\W/g, "-"), group: "meters", spec: { time: t, measures: [{ voices: [
    rep(n, i => ev("8", i === 3 ? [N("hh"), N("snare")] : [N("hh")])), [ev("4.", N("kick"))]] }] } })),
  { id: "time-change", group: "meters", spec: { time: "4/4", measures: [rock(), { time: "3/4", voices: [rep(6, () => ev("8", N("hh"))), [ev("2.", N("kick"))]] },
    { time: "6/8", voices: [rep(6, () => ev("8", N("ride"))), [ev("4.", N("kick")), ev("4.", N("kick"))]] }, { time: "7/8", voices: [rep(7, () => ev("8", N("snare")))] }, { time: "4/4", voices: [[ev("1", N("crash"))], [ev("1", N("kick"))]] }] } },
  { id: "time-hidden", group: "meters", spec: { time: "4/4", showTime: false, measures: [rock()] } },
  // 連音:每一種時值代號
  { id: "tuplets-1", group: "tuplets", spec: { time: "4/4", measures: [{ voices: [[...rep(3, () => ev("8t3", N("snare"))), ...rep(3, () => ev("4t3", N("snare"))), ...rep(3, () => ev("16t3", N("snare"))), ev("8", N("snare"))]] },
    { voices: [[...rep(5, () => ev("16t5", N("snare"))), ...rep(6, () => ev("16t6", N("snare"))), ...rep(7, () => ev("16t7", N("snare"))), ev("4", N("snare"))]] },
    { voices: [[...rep(9, () => ev("32t9", N("snare"))), ...rep(10, () => ev("32t10", N("snare"))), ev("8t3", N("snare")), r("8t3"), ev("8t3", N("snare")), ev("4t3", N("snare")), ev("8t3", N("snare"))]] }] } },
  { id: "tuplets-dup", group: "tuplets", spec: { time: "6/8", measures: [{ voices: [[ev("dup", N("snare")), ev("dup", N("snare")), ev("8", N("snare")), ev("8", N("snare")), ev("8", N("snare"))], [ev("4.", N("kick")), ev("4.", N("kick"))]] }] } },
  { id: "values", group: "tuplets", spec: { time: "4/4", measures: [{ voices: [[ev("1", N("snare"))]] }, { voices: [[ev("2", N("snare")), ev("2", N("snare"))]] }, { voices: [[ev("2.", N("snare")), ev("4", N("snare"))]] },
    { voices: [[ev("4.", N("snare")), ev("8", N("snare")), ev("8.", N("snare")), ev("16", N("snare")), ev("16.", N("snare")), ev("32", N("snare")), ev("8", N("snare"))]] },
    { voices: [[r("2."), r("8"), r("16"), r("32"), ev("32", N("snare"))]] }] } },
  // 力度與重音、連結線(跨小節)
  { id: "dynamics", group: "dyn", spec: { time: "4/4", dyn: [{ m: 0, beat: 0, mark: "pp" }, { m: 0, beat: 1, mark: "p" }, { m: 0, beat: 2, mark: "mp" }, { m: 0, beat: 3, mark: "mf" },
    { m: 1, beat: 0, mark: "f" }, { m: 1, beat: 2, mark: "ff" }, { m: 1, beat: 3, mark: "sfz" }, { m: 2, beat: 0, mark: "cresc", end: { m: 2, beat: 4 } }, { m: 3, beat: 0, mark: "dim", end: { m: 4, beat: 2 } }],
    measures: [{ voices: [rep(4, () => ev("4", N("snare")))] }, { voices: [rep(4, () => ev("4", N("snare", { accent: true })))] }, { voices: [rep(8, () => ev("8", N("snare")))] },
      { voices: [rep(8, () => ev("8", N("snare")))] }, { voices: [[ev("2", N("snare"), { tie: true }), ev("2", N("snare"))]] }] } },
  { id: "ties", group: "dyn", spec: { time: "4/4", measures: [{ voices: [[ev("2", N("snare")), ev("4", N("snare")), ev("4", [N("crash"), N("snare")], { tie: true })], [r("2."), ev("4", N("kick"), { tie: true })]] },
    { voices: [[ev("4", [N("crash"), N("snare")]), r("4"), ev("2", N("snare"))], [ev("4", N("kick")), r("2.")]] }] } },
  // 自由發展的小節(斜線)
  { id: "slash", group: "slash", spec: { time: "4/4", measures: [rock(), rock(), { slash: true }, { slash: true }] } },
  { id: "slash-68", group: "slash", spec: { time: "6/8", measures: [{ voices: [rep(6, () => ev("8", N("hh"))), [ev("4.", N("kick")), ev("4.", N("kick"))]] }, { slash: true }] } },
  // 單線譜(RSL 小鼓視奏):小節線、拍號、重音、力度、休止、連結線
  { id: "line1", group: "line1", spec: { lines: 1, time: "4/4", dyn: [{ m: 0, beat: 0, mark: "mf" }, { m: 2, beat: 0, mark: "cresc", end: { m: 2, beat: 4 } }, { m: 3, beat: 0, mark: "f" }], measures: [
    { voices: [[ev("4", N("snare", { accent: true })), ev("4", N("snare")), ev("8", N("snare")), ev("8", N("snare")), r("4")]] },
    { voices: [[ev("8", N("snare")), r("8"), ev("8", N("snare")), ev("8", N("snare")), ev("2", N("snare"), { tie: true })]] },
    { voices: [[ev("4", N("snare")), ...rep(3, () => ev("8t3", N("snare"))), ev("16", N("snare")), ev("16", N("snare")), ev("8", N("snare")), ev("4", N("snare"))]] },
    { voices: [[ev("2", N("snare", { accent: true })), r("2")]] }] } },
  { id: "line1-34", group: "line1", spec: { lines: 1, time: "3/4", measures: [{ voices: [[ev("4", N("snare")), ev("4", N("snare")), ev("4", N("snare"))]] }, { voices: [[ev("2.", N("snare"))]] }] } }
];
// 每個鼓件 × 每種修飾(照 drumkey.json 的順序)在最前面
export const KIT_SAMPLES = [...Object.keys(key.pieces).map(pieceSample), ...OTHER];
export const KIT_GROUPS = ["pieces", "grooves", "meters", "tuplets", "dyn", "slash", "line1"];
/* ?kit= 的值:all、群組名稱、樣張 id、鼓件 id(逗號分開) */
export function pickSamples(q){
  const want = String(q || "all").split(",").map(s => s.trim()).filter(Boolean);
  if (want.includes("all")) return KIT_SAMPLES;
  return KIT_SAMPLES.filter(s => want.includes(s.group) || want.includes(s.id) || want.includes(s.piece));
}
