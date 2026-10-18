// RSL 技巧的「依大綱時值」練習型(rudiments.js pattern();data/exam-rsl.json 的 kind:"pattern")的檢查,verify.mjs 會呼叫;
// 也可以單獨跑:node tools/test/checks/pattern.mjs
// 每一個 RSL pattern 項目:
//   1. 一輪是整數拍,而且是「左右手序列長」與「每拍幾個音」的最小公倍數(不多排)
//   2. 每一下的左右手、重音、Flam / Drag = PAS 序列重複(single = #1 的 RL 交替、double = #6 滾奏實際打的 RRLL、其他 = 那個 PAS 打法的主擊);
//      不能自己加重音;時值全部是大綱寫的那一種
//   3. MusicXML:<duration> 是整數、加總 / divisions = 一輪的拍數;<time> 的拍數是整數
//   4. 連音:<tuplet type="start"> 數量 = 音數 / N(每一組都標數字),actual-notes = N、normal-notes = 3:2 5:4 6:4 7:4 9:8 10:8、
//      normal-type = 這個音本身的時值(八分三連音是 eighth);沒有連音的不能有 time-modification
// 另外:有滾奏斜線 / 多次反彈的 PAS 打法要丟錯;PAS 表原本的 16t3 / 16t6 照舊是 16th
import fs from "node:fs";
import { RUDIMENTS, byNo, strokes, cycleLength, withLead, pattern, patternSeq, parseToken, DIV } from "../../../js/tech/rudiments.js";
import { rudimentXML } from "../../../js/tech/notation.js";
import { techItems, GRADES } from "../../../js/shared/examdata.js";

const root = new URL("../../../", import.meta.url).pathname;
const TYPE = { "32": "32nd", "16": "16th", "8": "eighth", "4": "quarter", "2": "half" };
const NORMAL = { 3: 2, 5: 4, 6: 4, 7: 4, 9: 8, 10: 8 };     // 照 STAGES.md S4 抄的,不從 rudiments.js 讀
const PER_BEAT = { "4": 1, "8": 2, "16": 4, "32": 8, "8t3": 3, "16t5": 5, "16t6": 6, "16t7": 7, "32t9": 9, "32t10": 10 };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const count = (s, re) => (s.match(re) || []).length;

export default function check(ok){
  const rsl = JSON.parse(fs.readFileSync(root + "data/exam-rsl.json", "utf8"));
  let n = 0;
  for (const g of GRADES) for (const it of techItems(g, rsl).filter(x => x.kind === "pattern")) {
    n++;
    const at = `${it.key}(PAS #${it.pas}${it.sticking ? " " + it.sticking : ""} / ${it.value})`;
    let groups;
    try { groups = pattern(it); } catch (e) { ok(false, `${at}:pattern() 丟錯 ${e.message}`); continue; }
    const notes = groups.flat(), per = PER_BEAT[it.value];
    ok(per != null, `${at}:時值 ${it.value} 不在練習型支援的清單`);
    // PAS 序列(主擊):single = #1、double = #6(滾奏的 RRLL)、其他 = 那個打法
    const src = byNo(it.sticking === "single" ? 1 : it.sticking === "double" ? 6 : it.pas);
    const pas = [];
    let grace = 0;
    for (const s of strokes(withLead(src, "R"))) { if (s.kind === "grace") { grace++; continue; } pas.push({ hand: s.hand, accent: s.kind === "accent", grace }); grace = 0; }
    // 1. 整數拍、長度 = lcm(最短重複單位, 每拍音數)
    const len = cycleLength(groups);
    ok(len % DIV === 0, `${at}:一輪不是整數拍(${len / DIV})`);
    let period = pas.length;
    for (let p = 1; p <= pas.length; p++) if (pas.length % p === 0 && pas.every((x, i) => JSON.stringify(x) === JSON.stringify(pas[i % p]))) { period = p; break; }
    ok(notes.length === period * per / gcd(period, per), `${at}:一輪 ${notes.length} 個音,應該是 lcm(${period}, ${per})`);
    ok(groups.every(gr => gr.length === per), `${at}:每一拍一組連桿(每組 ${per} 個)`);
    ok(Math.abs(len / DIV - notes.length / per) < 1e-9, `${at}:拍數 ${len / DIV} ≠ 音數 / 每拍 ${notes.length / per}`);
    // 2. 左右手、重音、裝飾音 = PAS 序列重複;時值都一樣
    if (it.sticking === "single") ok(notes.every((x, i) => x.hand === (i % 2 ? "L" : "R")), `${at}:單擊要 RL 交替`);
    if (it.sticking === "double") ok(notes.every((x, i) => x.hand === (Math.floor(i / 2) % 2 ? "L" : "R")), `${at}:雙擊要 RRLL`);
    notes.forEach((x, i) => {
      const p = pas[i % pas.length];
      ok(x.hand === p.hand, `${at} 第 ${i + 1} 下:左右手 ${x.hand} ≠ PAS ${p.hand}`);
      ok(!!x.accent === p.accent, `${at} 第 ${i + 1} 下:重音跟 PAS 不同(不能自己加)`);
      ok((x.flam ? 1 : x.drag ? 2 : 0) === p.grace, `${at} 第 ${i + 1} 下:裝飾音跟 PAS 不同`);
      ok(!x.trem && !x.buzz && !x.rest, `${at} 第 ${i + 1} 下:練習型不能有滾奏斜線、多次反彈、休止符`);
      ok(x.value + (x.tuplet ? "t" + x.tuplet : "") === it.value, `${at} 第 ${i + 1} 下:時值 ${x.value}${x.tuplet ? "t" + x.tuplet : ""} ≠ 大綱 ${it.value}`);
    });
    // 3. MusicXML 時值
    const xml = rudimentXML(groups, { reps: 4 });
    const div = Number((xml.match(/<divisions>(\d+)<\/divisions>/) || [])[1]);
    const durs = [...xml.matchAll(/<duration>([^<]+)<\/duration>/g)].map(m => m[1]);
    ok(durs.every(d => /^\d+$/.test(d)), `${at}:MusicXML duration 要是整數:${durs.slice(0, 4).join(",")}`);
    ok(durs.length === notes.length && durs.reduce((s, d) => s + Number(d), 0) === div * len / DIV, `${at}:MusicXML 時值加總 ${durs.reduce((s, d) => s + Number(d), 0)} / ${div} ≠ ${len / DIV} 拍`);
    ok(/<beats>\d+<\/beats>/.test(xml), `${at}:<time> 的拍數要是整數`);
    ok(!/undefined|NaN/.test(xml), `${at}:MusicXML 有 undefined / NaN`);
    // 4. 連音標記
    const t = (it.value.match(/t(\d+)$/) || [])[1];
    if (t) {
      const T = Number(t);
      ok(count(xml, /<tuplet type="start"/g) === notes.length / T && count(xml, /<tuplet type="stop"/g) === notes.length / T, `${at}:連音數字 ${count(xml, /<tuplet type="start"/g)} 組,應該 ${notes.length / T}`);
      ok(count(xml, new RegExp(`<actual-notes>${T}</actual-notes><normal-notes>${NORMAL[T]}</normal-notes><normal-type>${TYPE[it.value.split("t")[0]]}</normal-type>`, "g")) === notes.length,
        `${at}:time-modification 應該是 ${T}:${NORMAL[T]} ${TYPE[it.value.split("t")[0]]}`);
    } else ok(!/time-modification|<tuplet/.test(xml), `${at}:不是連音,不能有 time-modification`);
  }
  ok(n >= 40, `RSL pattern 項目太少(${n}):techItems 讀不到?`);
  // 手寫錨點(照 PAS 官方表另外抄的最短重複單位,不從 rudiments.js 算):f = Flam、d = Drag、> = 重音
  //   #16 單複點 R>LRRL>RLL、#19 單複點加雙擊 R>LRRLL、#22 Flam tap fR>RfL>L、雙擊(#6 實際打的)RRLL、單擊(#1)RL
  const ANCHOR = [[{ pas: 16 }, "R>LRRL>RLL"], [{ pas: 19 }, "R>LRRLL"], [{ pas: 22 }, "fR>RfL>L"], [{ pas: 6, sticking: "double" }, "RRLL"], [{ pas: 1, sticking: "single" }, "RL"]];
  const seqStr = q => q.map(x => (x.flam ? "f" : "") + (x.drag ? "d" : "") + x.hand + (x.accent ? ">" : "")).join("");
  for (const [arg, want] of ANCHOR) {
    let got = ""; try { got = seqStr(patternSeq(arg)); } catch (e) { got = "丟錯 " + e.message; }
    ok(got === want, `錨點 PAS #${arg.pas}${arg.sticking ? " " + arg.sticking : ""}:應該 ${want},實際 ${got}`);
    // 練習型的每一下也要是這個序列重複(用 8 分音符排一次)
    let notes = []; try { notes = pattern({ ...arg, value: "8" }).flat(); } catch (e) {}
    ok(notes.length && seqStr(notes) === want.repeat(notes.length / (want.match(/[RL]/g).length)), `錨點 PAS #${arg.pas}:練習型 ${seqStr(notes)} 不是 ${want} 重複`);
  }
  // 不支援的:滾奏斜線(#7 五擊)、多次反彈(#4)、附點時值
  for (const bad of [{ pas: 7, value: "8" }, { pas: 4, value: "16" }, { pas: 16, value: "8." }, { pas: 6, value: "8" }]) {
    let threw = false; try { pattern(bad); } catch (e) { threw = true; }
    ok(threw, `pattern(${JSON.stringify(bad)}) 應該丟錯`);
  }
  // parseToken 的 tN:N 個佔 normal 個的時間
  for (const [T, N] of Object.entries(NORMAL)) ok(Math.abs(parseToken(`R/16t${T}`).dur * Number(T) - 6 * N) < 1e-9, `parseToken R/16t${T} 的長度`);
  // PAS 表原本的連音(#2 十六分三連音、#3 十六分六連音)normal-type 還是 16th
  for (const no of [2, 3, 28]) ok(/<normal-type>16th<\/normal-type>/.test(rudimentXML(byNo(no).groups)) && !/<normal-type>(eighth|32nd)/.test(rudimentXML(byNo(no).groups)), `PAS #${no} 連音 normal-type 要是 16th`);
  ok(RUDIMENTS.length === 40, "PAS 40 個");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0, checks = 0;
  check((c, m) => { checks++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${checks} 項)` : `✓ 全部通過(${checks} 項)`);
  process.exit(fails ? 1 : 0);
}
