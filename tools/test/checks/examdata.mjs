// 考試資料(data/exam-rsl.json、data/exam-trinity.json、data/drumkey.json)的檢查,verify.mjs 會呼叫;也可以單獨跑:
//   node tools/test/checks/examdata.mjs
// 1. 結構:每個有數值的節點都有 src.p(自己或上層)、0–8 級都在、PAS 編號對得到 rudiments.js、時值代號在允許清單、bpm 30–240、
//    中英都有(中文一定配英文)、按鈕/標籤的英文 ≤ 22 字元、沒有長段原文、配分加總 100、等第門檻遞增、Trinity 累積後不會變少
// 2. 官方查不到的一定是 null 或 assumed:true(Trinity Playback 速度、RSL 聽力風格清單、RSL Debut–3 視奏拍號……)
// 3. 另外照 docs/sources/*.md 的表手抄一份(配分、等第門檻、不及格段、各級技巧組別與 BPM、視奏/聽力速度、考試時間、Playback 參數與鼓件、
//    Improvising 拍號/風格/solo、自選曲長度與速度、每一段的頁碼),跟 JSON 互相核對
//    (跟 verify.mjs 的 STICK 表同樣做法:改 JSON 時這裡也要照大綱再抄一次)
import fs from "node:fs";
import { RUDIMENTS, CATEGORIES } from "../../../js/tech/rudiments.js";
import { playbackFor, techItems, techPasNos, isValueCode, isRestCode, GRADES } from "../../../js/shared/examdata.js";

const root = new URL("../../../", import.meta.url).pathname;
const read = f => JSON.parse(fs.readFileSync(root + f, "utf8"));
const KEYS = GRADES.map(String);
const CJK = /[㐀-鿿＀-￯　-〿]/;
const PAGE = /^\d+(–\d+)?(, \d+(–\d+)?)*$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function check(ok){
  const rsl = read("data/exam-rsl.json"), tri = read("data/exam-trinity.json"), key = read("data/drumkey.json");
  const PAS = new Set(RUDIMENTS.map(r => r.no)), CATS = new Set(CATEGORIES.map(c => c.id));
  const KIT = new Set([...Object.keys(key.pieces), ...Object.keys(key.groups)]);
  ok(rsl.system === "rsl" && tri.system === "trinity", "exam-*.json 的 system 欄位");

  /* ── 1a. 走過整棵樹:src.p、中英、標籤長度、時值代號、bpm、鼓件 ── */
  const LABEL_KEYS = new Set(["name", "label"]);
  function walk(file, node, path, src){
    if (Array.isArray(node)) {
      // 中英一組 = [中, 英]:中文一定在第一格、配一個不是空的英文
      if (node.length === 2 && node.every(x => typeof x === "string") && CJK.test(node[0])) {
        ok(node[1].trim() && !CJK.test(node[1]), `${file} ${path}:中英一組的英文是空的或有中文`);
        return;
      }
      node.forEach((x, i) => walk(file, x, `${path}[${i}]`, src));
      return;
    }
    if (typeof node === "string") { ok(!CJK.test(node), `${file} ${path}:中文沒有配英文(要寫成 [中, 英]):${node}`); ok(node.length <= 220, `${file} ${path}:文字太長(不要貼原文長句)`); return; }
    if (node === null || typeof node !== "object") return;
    if (node.src && typeof node.src === "object") {
      ok(typeof node.src.p === "string" && PAGE.test(node.src.p), `${file} ${path}.src.p 頁碼格式不對:${JSON.stringify(node.src)}`);
      if (node.src.doc) ok(((file.includes("rsl") ? rsl : tri).doc.docs || {})[node.src.doc], `${file} ${path}.src.doc 不在 doc.docs 裡`);
      src = node.src;
    }
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (k === "src" || k === "doc") continue;
      const nums = typeof v === "number" || (Array.isArray(v) && v.some(x => typeof x === "number"));
      if (nums && !(path === "" && k === "schema")) ok(src, `${file} ${p} 有數值但沒有 src.p(自己或上層)`);
      if (LABEL_KEYS.has(k) && Array.isArray(v)) {
        ok(v.length === 2 && v.every(x => typeof x === "string" && x.trim()), `${file} ${p}:${k} 要是 [中, 英]`);
        ok(v[1] && v[1].length <= 22, `${file} ${p}:按鈕/標籤的英文超過 22 字元:「${v[1]}」(${v[1] && v[1].length})`);
      }
      if (k === "bpm" && v !== null) {
        const r = Array.isArray(v) ? v : [v, v];
        ok(r.length === 2 && r.every(x => Number.isInteger(x) && x >= 30 && x <= 240) && r[0] <= r[1], `${file} ${p}:bpm 要在 30–240:${JSON.stringify(v)}`);
      }
      if ((k === "values" || k === "valueRange") && v !== null) ok(Array.isArray(v) && v.every(isValueCode), `${file} ${p}:時值代號不在允許清單:${JSON.stringify(v)}`);
      if (k === "value") ok(isValueCode(v), `${file} ${p}:時值代號不在允許清單:${v}`);
      if (k === "rests" && v !== null) ok(Array.isArray(v) && v.every(isRestCode), `${file} ${p}:休止符代號不對:${JSON.stringify(v)}`);
      if (k === "pieces" && Array.isArray(v)) ok(v.every(x => KIT.has(x)), `${file} ${p}:鼓件不在 drumkey.json:${JSON.stringify(v)}`);
      if (k === "time" && Array.isArray(v)) ok(v.every(x => /^\d+\/\d+$/.test(x)), `${file} ${p}:拍號格式不對`);
      if (k === "assumed" || /Assumed$/.test(k)) ok(typeof v === "boolean", `${file} ${p}:${k} 要是 true / false`);
      walk(file, v, p, src);
    }
  }
  walk("exam-rsl.json", rsl, "", null);
  walk("exam-trinity.json", tri, "", null);
  ok(!rsl.src && !tri.src, "頁碼不能放在最上層(要放在各段落)");

  /* ── 1b. 0–8 級都在 ── */
  const hasGrades = (o, name) => ok(o && same(Object.keys(o).sort(), KEYS), `${name} 要剛好有 0–8 級`);
  for (const s of ["gradeNames", "tech", "sight", "improv", "ear", "gmq"]) hasGrades(rsl[s], "RSL " + s);
  hasGrades(rsl.minutes.gradeExam, "RSL minutes.gradeExam"); hasGrades(rsl.other.pieceMaxSec, "RSL pieceMaxSec");
  hasGrades(tri.gradeNames, "Trinity gradeNames"); hasGrades(tri.minutes.faceToFace, "Trinity minutes");
  hasGrades(tri.playback.grades, "Trinity playback"); hasGrades(tri.improvising.grades, "Trinity improvising"); hasGrades(tri.ownChoice.grades, "Trinity ownChoice");

  /* ── 1c. RSL 技巧:PAS 編號、kind、sticking ── */
  for (const g of GRADES) {
    const t = rsl.tech[g];
    ok(["optional", "required"].includes(t.click), `RSL ${g} 級 click`);
    ok(same(t.groups.map(x => x.id), "ABCDEF".slice(0, t.groups.length).split("")), `RSL ${g} 級組別要從 A 開始連續`);
    for (const gr of t.groups) {
      ok(gr.bpm === null ? gr.bpmSrc === "backing" : gr.bpmSrc === null, `RSL ${g} 級 ${gr.id} 組:沒有速度數字時 bpmSrc = backing`);
      ok(gr.items.length > 0, `RSL ${g} 級 ${gr.id} 組沒有項目`);
      for (const it of gr.items) {
        const at = `RSL ${g} 級 ${gr.id} 組`;
        if (it.kind === "pas") ok(PAS.has(it.no), `${at}:PAS #${it.no} 不在 rudiments.js`);
        else if (it.kind === "pattern") {
          ok(PAS.has(it.pas), `${at}:pattern 的 PAS #${it.pas} 不在 rudiments.js`);
          ok(it.sticking === undefined || (it.sticking === "single" && it.pas === 1) || (it.sticking === "double" && it.pas === 6), `${at}:sticking single = #1、double = #6`);
          ok([1, 6].includes(it.pas) ? !!it.sticking : !it.sticking, `${at}:#1 / #6 要寫 sticking`);
          // pattern = 大綱的時值跟 PAS 表不同;一樣的話應該用 kind:"pas"
          const r = RUDIMENTS.find(x => x.no === it.pas), vals = new Set(r.groups.flat().map(n => n.value + (n.tuplet ? "t" + n.tuplet : "")));
          ok(!(vals.size === 1 && vals.has(it.value) && !r.groups.flat().some(n => n.trem)), `${at}:#${it.pas} 原譜就是 ${it.value},應該用 kind:"pas"`);
        } else if (it.kind === "book") {
          ok(Array.isArray(it.label), `${at}:book 要有 label`);
          ok(Array.isArray(it.related) && it.related.every(n => PAS.has(n)), `${at}:related 的 PAS 編號`);
        } else ok(false, `${at}:不認得的 kind ${it.kind}`);
      }
    }
    const items = techItems(g, rsl);
    ok(new Set(items.map(i => i.key)).size === items.length, `RSL ${g} 級 techItems 的 key 重複`);
    ok(items.every(i => i.src && i.src.p), `RSL ${g} 級 techItems 要帶頁碼`);
  }
  for (const [g, o] of Object.entries(tri.ownChoice.grades))
    for (const x of o.practice) ok(x.cat ? CATS.has(x.cat) : PAS.has(x.pas), `Trinity ownChoice ${g} 級 practice:${JSON.stringify(x)}`);

  /* ── 1d. 配分加總 100、等第門檻遞增、不及格分數段接得上 ── */
  const sum = items => items.reduce((s, i) => s + i.max * (i.count || 1), 0);
  for (const [name, m] of [["RSL gradeExam", rsl.marks.gradeExam], ["RSL perfCert", rsl.marks.perfCert], ["Trinity faceToFace", tri.marks.faceToFace], ["Trinity digital", tri.marks.digital]]) {
    ok(sum(m.items) === 100 && m.total.max === 100, `${name} 配分加總要是 100(現在 ${sum(m.items)})`);
  }
  const gc = rsl.marks.gradedCert;
  ok(sum(gc.items) === 80, `RSL gradedCert:3 首 × 20 + 技巧 20 = 80(現在 ${sum(gc.items)})`);
  ok(sum(tri.marks.songParts.parts.map(p => ({ max: p.song12 }))) === 25 && sum(tri.marks.songParts.parts.map(p => ({ max: p.song3 }))) === 30, "Trinity 每首歌三個分項加起來 25 / 30");
  ok(sum(tri.marks.overallParts.parts) === tri.marks.digital.items.find(i => i.id === "overall").max, "Trinity Overall performance 兩項加起來 = 20");
  const bandsOk = (name, b, max) => ok(b.pass < b.merit && b.merit < b.dist && (max == null || b.dist <= max), `${name}:等第門檻要遞增 ${JSON.stringify(b)}`);
  function bands(name, o){
    if (!o || typeof o !== "object") return;
    if (o.bands) bandsOk(name, o.bands, o.max);
    if (o.bands && o.belowPass) {
      const { bp1, bp2 } = o.belowPass;
      ok(bp2[1] + 1 === bp1[0] && bp1[1] + 1 === o.bands.pass, `${name}:不及格的分數段要接到 Pass`);
    }
    for (const [k, v] of Object.entries(o)) if (k !== "bands" && typeof v === "object") bands(`${name}.${k}`, v);
  }
  bands("RSL marks", rsl.marks); bands("Trinity", { marks: tri.marks, songBands: tri.songBands, sessionBands: tri.sessionBands, overallBands: tri.overallBands });
  const total = tri.marks.total;
  ok(total.belowPass.bp2[1] + 1 === total.belowPass.bp1[0] && total.belowPass.bp1[1] + 1 === total.bands.pass, "Trinity 總分不及格段接到 60");
  for (const [k, r] of Object.entries(rsl.marks.belowPass)) if (k !== "src") {
    const item = rsl.marks.gradeExam.items.find(i => i.id === k || (k === "piece" && i.id === "piece1"));
    ok(r.bp2[0] === 0 && r.bp2[1] + 1 === r.bp1[0] && r.bp1[1] + 1 === item.bands.pass, `RSL belowPass.${k} 要接到 Pass`);
  }

  /* ── 1e. Trinity Playback 累積:拍號、時值、休止符、鼓件、長度不會變少 ── */
  let prev = null;
  for (const g of GRADES) {
    const pb = playbackFor(g, tri);
    ok(pb && pb.grade === g, `playbackFor(${g}) 沒有結果`);
    if (!pb) continue;
    ok(pb.total && pb.phrase && pb.voices, `playbackFor(${g}) 缺長度或聲部`);
    if (prev) {
      for (const k of ["time", "values", "rests", "dyn", "pieces", "extra"]) ok(prev[k].every(x => pb[k].includes(x)), `playbackFor(${g}).${k} 比前一級少`);
      ok(pb.total[0] >= prev.total[0] && pb.total[1] >= prev.total[1] && pb.voices >= prev.voices, `playbackFor(${g}) 長度或聲部比前一級少`);
    }
    prev = pb;
  }
  ok(playbackFor(9, tri) === null && playbackFor(1, null) === null, "playbackFor 級數不對或沒有資料要回 null");

  /* ── 2. 官方查不到的:null 或 assumed ── */
  ok(tri.playback.flow.bpm === null && tri.playback.flow.style === null, "Trinity Playback 的速度、伴奏風格官方沒寫,要是 null");
  ok(Object.values(tri.playback.grades).every(d => !("bpm" in d)), "Trinity Playback 各級不能有 bpm");
  ok(tri.improvising.flow.bpm === null && Object.values(tri.improvising.grades).every(d => !("bpm" in d)), "Trinity Improvising 的速度要是 null");
  for (const g of GRADES) {
    const s = rsl.sight[g], e = rsl.ear[g];
    ok(e.groove.styleOptions === null, `RSL ${g} 級聽力風格清單官方沒寫,要是 null`);
    ok(e.groove.repeat.assumed === true, `RSL ${g} 級 Groove「repeated」要標 assumed`);
    if (g <= 3) ok(s.time.v === "4/4" && s.time.assumed === true && s.develop === null, `RSL ${g} 級視奏拍號要標 assumed`);
    else if (g <= 5) ok(s.time.assumed === false && s.develop.bars === 2 && s.develop.pos.assumed === true, `RSL ${g} 級視奏 4/4 是官方、自由發展位置要標 assumed`);
    else ok(s.type === "qsp" && s.time === null && s.values === null && s.bpm === null, `RSL ${g} 級 QSP 的拍號、時值、速度要是 null`);
    if (g >= 6) ok(e.fill.values === null && same(e.fill.valueRange, ["4", "16t6"]), `RSL ${g} 級 Fill 時值官方只寫範圍,values 要是 null`);
  }
  ok(rsl.tech[4].groups[2].items[0].assumed === true && rsl.tech[4].groups[2].items[0].pas === 22, "RSL 4 級 C 組 Flam tap 四分音符要標 assumed");
  ok(rsl.minutes.gradedCert === null && rsl.improv[0] === null && rsl.improv[4].prepSec === null, "RSL 錄影考時間、Debut 即興、4 級即興準備時間要是 null");
  ok(rsl.tech[6].groups[4].styles[2].name[1] === "Jazz/Samba/Blues" && rsl.tech[7].groups[5].styles[2].name[1] === "Jazz/Latin/Blues" && rsl.tech[8].groups[5].styles[2].name[1] === "Jazz/Latin/Blues", "6 級是 Samba(2026-06),7、8 級仍是 Latin");

  /* ── 3. 手抄一份(照 docs/sources/*.md 的表),跟 JSON 對 ── */
  // RSL 配分 [滿分, Pass, Merit, Distinction](§2.3,p.16–17)
  const RSL_MARKS = { piece1: [20, 12, 15, 18], piece2: [20, 12, 15, 18], piece3: [20, 12, 15, 18], tech: [15, 9, 11, 13], sight: [10, 6, 7, 9], ear: [10, 6, 7, 9], gmq: [5, 3, 4, 5] };
  for (const it of rsl.marks.gradeExam.items) ok(same([it.max, it.bands.pass, it.bands.merit, it.bands.dist], RSL_MARKS[it.id]), `RSL 配分 ${it.id}`);
  ok(Object.keys(RSL_MARKS).length === rsl.marks.gradeExam.items.length, "RSL 配分項目數");
  ok(same(rsl.marks.gradeExam.total.bands, { pass: 60, merit: 74, dist: 90 }), "RSL Grade Exam 總分門檻 60/74/90");
  ok(same(rsl.marks.perfCert.total.bands, { pass: 60, merit: 75, dist: 90 }) && same(gc.total.bands, { pass: 60, merit: 75, dist: 90 }), "RSL 兩種證書總分門檻 60/75/90");
  ok(same(gc.items.find(i => i.id === "tech").bands, { pass: 12, merit: 15, dist: 18 }), "RSL 錄影考技巧 12/15/18");
  // RSL 考試時間(§2.2,p.15)
  ok(same(KEYS.map(g => rsl.minutes.gradeExam[g]), [15, 20, 20, 23, 25, 25, 30, 30, 30]), "RSL Grade Exam 時間");
  ok(same(["premiere", ...KEYS].map(g => rsl.minutes.perfCert[g]), [10, 12, 15, 15, 18, 20, 20, 23, 23, 26]), "RSL Performance Certificate 時間");
  ok(same(KEYS.map(g => rsl.other.pieceMaxSec[g].v), [60, 75, 90, 120, 135, 150, 165, 190, 225]), "RSL 演奏曲最長時間");
  // RSL 技巧:每組的速度(- = 伴奏音軌,沒有數字)與項目(§3.2)
  //   1s/8 = pattern(#1 單擊, 八分)、6d/16 = pattern(#6 雙擊, 十六分)、16/8 = pattern(#16, 八分)、#16 = PAS 原譜、
  //   22/4? = pattern 標 assumed、7、8 級 A 組的三十二分音符 = #1 原譜(時值跟 PAS 表一樣,照決定 2 用 pas)、book>7 = 只列名稱、相關 PAS #7
  const A45 = "1s/8 1s/8t3 1s/16 6d/8 6d/8t3 6d/16";
  const RSL_TECH = {
    0: "A70: 1s/8 | B70: 6d/8 | C70: 16/8 | D-: book",
    1: "A70: 1s/8 6d/8 | B70: 1s/16 6d/16 | C70: #16 | D-: book",
    2: "A70: 1s/8 6d/8 1s/16 6d/16 | B70: #16 | C70: #20 | D70: 1s/8t3 | E-: book",
    3: "A75: 1s/8 1s/8t3 1s/16 | B75: 6d/8 6d/16 | C75: #16 | D75: #20 #31 | E75: 1s/8t3 | F80: book",
    4: `A75: ${A45} | B75: #16 #18 | C75: 22/4? book | D75: book | E80: book`,
    5: `A80: ${A45} | B80: #16 #18 | C80: #21 #32 | D75: book>7 | E90: book | F90: book`,
    6: "A80: 1s/8t3 1s/16 1s/16t6 6d/8t3 6d/16 6d/16t6 | B80: #24 19/16t6 | C80: #38 | D80: book>7 book>10 | E-: book",
    7: "A65: 1s/4 1s/8 1s/8t3 1s/16 1s/16t5 1s/16t6 1s/16t7 #1 | B80: #24 19/16t6 | C80: #27 | D80: #38 #39 | E85: book>9 book>10 | F-: book",
    8: "A65: 1s/4 1s/8 1s/8t3 1s/16 1s/16t5 1s/16t6 1s/16t7 #1 1s/32t9 1s/32t10 | B90: 19/16t6 book | C85: #28 #27 | D85: #40 | E90: book>9 book | F-: book"
  };
  const code = it => it.kind === "pas" ? "#" + it.no
    : it.kind === "pattern" ? `${it.pas}${it.sticking ? it.sticking[0] : ""}/${it.value}${it.assumed ? "?" : ""}`
    : "book" + (it.related.length ? ">" + it.related.join(",") : "");
  for (const g of GRADES) {
    const got = rsl.tech[g].groups.map(gr => `${gr.id}${gr.bpm ?? "-"}: ${gr.items.map(code).join(" ")}`).join(" | ");
    ok(got === RSL_TECH[g], `RSL ${g} 級技巧:\n    手抄 ${RSL_TECH[g]}\n    JSON ${got}`);
  }
  // 3 級(§3.2):單擊 #1、雙擊 #6(pattern 的熟練度記在 PAS 編號上)、Paradiddle #16、Flam #20、Drag #31
  ok(same(techPasNos(3, rsl), [1, 6, 16, 20, 31]), `techPasNos(3) 要是 [1,6,16,20,31](含 pattern 的 pas):${JSON.stringify(techPasNos(3, rsl))}`);
  ok(same(techPasNos(0, rsl), [1, 6, 16]), `techPasNos(0) 要是 [1,6,16](Debut 都是 pattern):${JSON.stringify(techPasNos(0, rsl))}`);
  // RSL 視奏(§4.1):[小節, 速度, 時值, 休止符]
  const RSL_SIGHT = { 0: [4, [80, 80], "2 4", "r4"], 1: [4, [80, 80], "8 4", "r4"], 2: [4, [70, 70], "4 8 16", "r4 r8"], 3: [4, [70, 80], "4 8 16", "r4 r8"],
    4: [8, [80, 90], "4 4. 8 8. 16", "r4 r8"], 5: [8, [80, 120], "4 4. 8 8. 16", "r4 r8"], 6: [12, null, null, null], 7: [12, null, null, null], 8: [12, null, null, null] };
  for (const g of GRADES) {
    const s = rsl.sight[g], [bars, bpm, v, r] = RSL_SIGHT[g];
    ok(s.bars === bars && same(s.bpm, bpm) && (v === null ? s.values === null : s.values.join(" ") === v) && (r === null || s.rests.join(" ") === r), `RSL ${g} 級視奏參數`);
    ok(g <= 5 ? s.prepSec === 90 && s.metroOption === true && same(s.pieces, [g <= 3 ? "snare" : "kit"]) : s.studySec === 180 && s.plays === 2, `RSL ${g} 級視奏準備時間/鼓件`);
  }
  const RSL_IMPROV = { 1: [4, [70, 80], 30], 2: [4, [70, 80], 30], 3: [4, [80, 100], 30], 4: [8, [80, 120], null], 5: [8, [80, 120], null] };
  for (const [g, [bars, bpm, prep]] of Object.entries(RSL_IMPROV)) ok(same([rsl.improv[g].bars, rsl.improv[g].bpm, rsl.improv[g].prepSec], [bars, bpm, prep]), `RSL ${g} 級即興參數`);
  // RSL 聽力(§5.2):Fill [時值, 休止符, 選項數]、Groove [速度, 風格幾選一, 鼓件]
  const RSL_EAR = {
    0: ["4 8", "", 2, [80, 80], 0, "hh snare kick"], 1: ["4 8", "r4", 2, [80, 80], 0, "hh snare kick"], 2: ["4 8 16", "r4", 2, [80, 80], 0, "hh hhOpen snare kick"],
    3: ["4 8 8t3 16", "r4", 2, [80, 80], 0, "crash hh hhOpen snare kick"], 4: ["4 8 8t3 8. 16", "", 3, [80, 120], 3, "crash hh hhOpen ride rideBell snare kick"],
    5: ["4 8 8t3 8. 16", "", 3, [80, 120], 3, "crash hh hhOpen ride rideBell snare kick xstick"], 6: [null, "r4 r8", 3, [80, 140], 4, "kit"],
    7: [null, "r4 r8 r16", 3, [80, 140], 4, "kit"], 8: [null, "r4 r8 r16", 3, [80, 160], 4, "kit"]
  };
  for (const g of GRADES) {
    const { fill: f, groove: gr } = rsl.ear[g], [v, r, opt, gbpm, sty, pcs] = RSL_EAR[g];
    ok(f.bars === 1 && same(f.pieces, ["snare"]) && f.bpm === 70 && f.plays === 2 && f.countInBars === 1 && f.options === opt, `RSL ${g} 級 Fill:1 小節小鼓 ♩=70、聽兩次、${opt} 個選項`);
    ok((v === null ? f.values === null : f.values.join(" ") === v) && f.rests.join(" ") === r, `RSL ${g} 級 Fill 時值`);
    ok(gr.bars === 2 && same(gr.bpm, gbpm) && gr.styleChoices === sty && gr.pieces.join(" ") === pcs, `RSL ${g} 級 Groove 參數`);
  }
  ok(KEYS.every(g => rsl.gmq[g].questions === 5), "RSL 樂理問答 5 題");
  // Trinity 配分與門檻(§2)
  ok(same(tri.marks.faceToFace.items.map(i => [i.id, i.max]), [["song1", 25], ["song2", 25], ["session", 20], ["song3", 30]]), "Trinity 現場配分 25/25/20/30");
  ok(same(tri.marks.digital.items.map(i => [i.id, i.max]), [["song1", 25], ["song2", 25], ["song3", 30], ["overall", 20]]), "Trinity 數位配分 25/25/30/20");
  ok(same(tri.marks.total.bands, { pass: 60, merit: 75, dist: 87 }), "Trinity 總分門檻 60/75/87");
  ok(same(tri.songBands.song12.bands, { pass: 15, merit: 19, dist: 22 }) && same(tri.songBands.song3.bands, { pass: 18, merit: 22, dist: 26 }), "Trinity 每首歌等第");
  ok(same(tri.sessionBands.bands, { pass: 12, merit: 15, dist: 17 }), "Trinity Session skills 12/15/17");
  ok(same(tri.overallBands.bands, { pass: 6, merit: 8, dist: 9 }), "Trinity Overall performance 6/8/9");
  ok(same(tri.marks.songParts.parts.map(p => [p.song12, p.song3]), [[8, 8], [8, 12], [9, 10]]), "Trinity 歌曲分項 8/8/9、8/12/10");
  ok(same(KEYS.map(g => tri.minutes.faceToFace[g]), [13, 13, 15, 15, 20, 20, 25, 25, 30]), "Trinity 考試時間");
  ok(tri.playback.flow.studySec === 30 && tri.playback.flow.plays === 2 && tri.playback.flow.countIn === true, "Trinity Playback:看譜 30 秒、播兩次、有 count-in");
  // Trinity Playback(§3.2):每一級新增的(空字串 = 沒有新增),累積後跟 playbackFor 對
  const TR_PB = {
    0: { total: [8, 8], phrase: [2, 2], time: "4/4 2/4", values: "2 4 8", rests: "r2 r4", dyn: "", voices: 1 },
    1: { time: "", values: "", rests: "", dyn: "p f", voices: 2 },
    2: { time: "3/4", values: "2.", rests: "", dyn: "accent", voices: 2 },
    3: { total: [8, 12], phrase: [2, 4], time: "", values: "16 4.", rests: "r8 r1", dyn: "mp mf", voices: 3 },
    4: { time: "6/8", values: "8t3", rests: "r4.", dyn: "cresc dim" },
    5: { total: [12, 16], time: "12/8", values: "8. 16t3 16t6", rests: "r2. r8.", dyn: "pp ff sfz" },
    6: { total: [16, 20], phrase: [4, 8], time: "2/2 9/8 3/8", values: "1 16. 32", rests: "r8. r16. r16", dyn: "" },
    7: { time: "7/4 7/8 5/4 5/8", values: "4t3 dup", rests: "", dyn: "" },
    8: { total: [20, 24], time: "", values: "", rests: "", dyn: "" }
  };
  const acc = { time: [], values: [], rests: [], dyn: [], total: null, phrase: null, voices: null };
  for (const g of GRADES) {
    const h = TR_PB[g], pb = playbackFor(g, tri);
    for (const k of ["time", "values", "rests", "dyn"]) if (h[k]) for (const x of h[k].split(" ")) if (!acc[k].includes(x)) acc[k].push(x);
    for (const k of ["total", "phrase", "voices"]) if (h[k] !== undefined) acc[k] = h[k];
    for (const k of ["time", "values", "rests", "dyn", "total", "phrase", "voices"]) ok(same(pb[k], acc[k]), `Trinity Playback ${g} 級 ${k}:手抄 ${JSON.stringify(acc[k])},playbackFor ${JSON.stringify(pb[k])}`);
  }
  ok(same(playbackFor(0, tri).pieces, ["snare", "kick", "tomHi", "tomFloor", "crash"]) && playbackFor(1, tri).pieces.includes("tomMid") && ["hh", "ride"].every(p => playbackFor(2, tri).pieces.includes(p)), "Trinity Playback 鼓件:初級 SD BD HT LT CR、1 級加中鼓、2 級加 HH RC");
  ok(same(KEYS.map(g => tri.improvising.grades[g].bars ?? null), [4, null, null, 8, null, 12, 16, null, null]), "Trinity Improvising 總小節數 4/8/12/16");
  ok(tri.improvising.barsAs && tri.improvising.barsAs.v === "loop" && tri.improvising.barsAs.assumed === true, "Trinity Improvising:總小節數 = 循環長度是推估,要標 assumed");
  ok(tri.playback.pieceMap && tri.playback.pieceMap.LT && tri.playback.pieceMap.LT.v === "tomFloor" && tri.playback.pieceMap.LT.assumed === true, "Trinity Playback:LT → 落地鼓是 App 的對應,要標 assumed");
  for (const g of GRADES) for (const gr of rsl.tech[g].groups)
    // 主持人決定(2026-10-18):bpmSrc "backing" 是官方明寫的(配伴奏音軌),不是推估;bpm 維持 null 表示沒有數字 → 不能標 bpmSrcAssumed
    if (gr.bpmSrc === "backing") ok(gr.bpm === null && !("bpmSrcAssumed" in gr), `RSL ${g} 級 ${gr.id} 組:速度 = 伴奏音軌是官方寫的,不標 bpmSrcAssumed(bpm 維持 null)`);
  for (const g of GRADES) if (rsl.ear[g].groove.styleChoices === 0) ok(rsl.ear[g].groove.styleChoicesAssumed === true, `RSL ${g} 級 Groove 沒有風格題(0)是推估,要標 styleChoicesAssumed`);

  /* ── 3b. 更多手抄核對(照 docs/sources/*.md;不是從 JSON 複製):各段頁碼、Trinity 自選曲、Improvising、Playback 鼓件與其他、不及格分數段 ── */
  const pages = o => KEYS.map(g => o[g] && o[g].src ? o[g].src.p : null);
  // RSL 頁碼:技巧 §3.2、視奏 §4.1 + QSP §4.3(長度頁, 流程頁)、聽力 §5.2、樂理問答 §6(Debut 題數 p.30、範圍 p.31)、即興 §4.2
  const RSL_P = {
    tech: ["30", "34", "38", "42", "47", "52", "58", "63", "68"],
    sight: ["31", "35", "39", "43", "48", "53", "57, 59", "62, 64", "67, 69"],
    ear: ["31", "35", "39", "43", "48", "53", "59", "64", "69"],
    gmq: ["30–31", "35", "39", "43", "48", "54", "59", "64", "69"],
    improv: [null, "35", "39", "43", "48", "53", null, null, null]
  };
  for (const [k, want] of Object.entries(RSL_P)) ok(same(pages(rsl[k]), want), `RSL ${k} 頁碼:手抄 ${want.join("/")},JSON ${pages(rsl[k]).join("/")}`);
  ok(same(KEYS.map(g => rsl.other.pieceMaxSec[g].src.p), ["30", "34", "38", "42", "46", "51", "57", "62", "67"]), "RSL 演奏曲最長時間的頁碼(§2.4)");
  ok(rsl.marks.gradeExam.src.p === "16" && rsl.marks.gradedCert.src.p === "17" && rsl.marks.belowPass.src.p === "22–23" && rsl.minutes.src.p === "15", "RSL 配分 p.16、錄影考 p.17、不及格段 p.22–23、時間 p.15");
  // Trinity 頁碼:Playback Initial–4 p.62、5–8 p.63;Improvising Initial–4 p.64、5–8 p.65;自選曲 Initial p.55、1–2 p.56、3–4 p.57、5–6 p.58、7–8 p.59
  const TR_P = {
    playback: ["62", "62", "62", "62", "62", "63", "63", "63", "63"],
    improvising: ["64", "64", "64", "64", "64", "65", "65", "65", "65"],
    ownChoice: ["55", "56", "56", "57", "57", "58", "58", "59", "59"]
  };
  for (const [k, want] of Object.entries(TR_P)) ok(same(pages(tri[k].grades), want), `Trinity ${k} 頁碼:手抄 ${want.join("/")},JSON ${pages(tri[k].grades).join("/")}`);
  ok(tri.playback.flow.src.p === "60" && tri.improvising.flow.src.p === "61", "Trinity Playback 流程 p.60、Improvising 流程 p.61");
  ok(tri.marks.faceToFace.src.p === "46–47" && tri.marks.digital.src.p === "31–32" && tri.marks.total.src.p === "6, 22" && tri.songBands.src.p === "23" && tri.sessionBands.src.p === "23" && tri.minutes.src.p === "48", "Trinity 配分 p.46–47、數位 p.31–32、總分 p.6/22、等第 p.23、時間 p.48");
  // Trinity 自選曲(§4.1):長度(秒)、速度(null = 全範圍、undefined = 這一級沒有新增)
  const TR_OC = { 0: [[45, 120], [60, 130]], 1: [[60, 150], [60, 160]], 2: [[90, 180], [50, 160]], 3: [[90, 210], null], 4: [[150, 240]], 5: [[150, 240]], 6: [[180, 270]], 7: [[180, 270]], 8: [[210, 300]] };
  for (const g of GRADES) {
    const o = tri.ownChoice.grades[g], [len, bpm] = TR_OC[g];
    ok(same(o.lengthSec, len), `Trinity 自選曲 ${g} 級長度:手抄 ${JSON.stringify(len)},JSON ${JSON.stringify(o.lengthSec)}`);
    ok(TR_OC[g].length === 1 ? !("bpm" in o) : same(o.bpm, bpm), `Trinity 自選曲 ${g} 級速度:手抄 ${JSON.stringify(bpm)},JSON ${JSON.stringify(o.bpm)}`);
  }
  ok(Array.isArray(tri.ownChoice.grades[3].bpmText), "Trinity 自選曲 3 級:速度是「全範圍」的文字");
  // Trinity Improvising(§3.4):每一級新增的拍號、風格(英文,小寫比)、solo break 最多幾小節
  const TR_IM = {
    0: ["4/4", "simple rock|pop", null], 1: ["", "ballad|heavy rock"], 2: ["3/4", "country"], 3: ["2/2", "blues"], 4: ["6/8", "reggae|r'n'b"],
    5: ["12/8", "funk|shuffle|disco"], 6: ["9/8", "latin|metal", 2], 7: ["5/4 7/8", "jazz|boogie-woogie|boogie-style rock"], 8: ["", "any style, incl. mixed", 4]
  };
  for (const g of GRADES) {
    const o = tri.improvising.grades[g], [time, sty, solo] = TR_IM[g];
    ok((o.time || []).join(" ") === time, `Trinity Improvising ${g} 級拍號:手抄「${time}」,JSON「${(o.time || []).join(" ")}」`);
    ok(o.styles.map(x => x[1].toLowerCase()).join("|") === sty, `Trinity Improvising ${g} 級風格:手抄 ${sty},JSON ${o.styles.map(x => x[1]).join("|")}`);
    if (solo !== undefined) ok(solo === null ? o.solo === null : o.solo && o.solo.maxBars === solo, `Trinity Improvising ${g} 級 solo break:手抄 ${solo},JSON ${JSON.stringify(o.solo)}`);
    else ok(!("solo" in o), `Trinity Improvising ${g} 級 solo break 沒有新增`);
  }
  ok(tri.improvising.grades[8].meterChange === true, "Trinity Improvising 8 級:會換拍號");
  // Trinity Playback(§3.2):每一級新增的鼓件、其他、聲部說明(LT = 落地鼓 tomFloor、HH 用腳踩 = hhFoot、開/閉 HH = hhOpen)
  const TR_PB2 = {
    0: ["snare kick tomHi tomFloor crash", "", "only"], 1: ["tomMid", "", "some"], 2: ["hh ride", "ties", "mostly"], 3: ["hhFoot", "footHH offbeatBD", null],
    4: ["hhOpen", "fullKit hhOpenClose rimclick roll flam drag ruff"], 5: ["", "independence"], 6: ["", "ghost"], 7: ["", "anyTerms"], 8: ["", "meterChange"]
  };
  for (const g of GRADES) {
    const d = tri.playback.grades[g], [pcs, extra, va] = TR_PB2[g];
    ok((d.pieces || []).join(" ") === pcs, `Trinity Playback ${g} 級鼓件:手抄「${pcs}」,JSON「${(d.pieces || []).join(" ")}」`);
    ok((d.extra || []).join(" ") === extra, `Trinity Playback ${g} 級其他:手抄「${extra}」,JSON「${(d.extra || []).join(" ")}」`);
    ok(va === undefined ? !("voicesAmount" in d) : d.voicesAmount === va, `Trinity Playback ${g} 級聲部說明:手抄 ${va},JSON ${d.voicesAmount}`);
  }
  // 不及格分數段(RSL §2.3 p.22–23;Trinity §2.4 p.6/22/23/28)
  const RSL_BP = { piece: [[6, 11], [0, 5]], tech: [[4, 8], [0, 3]], sight: [[3, 5], [0, 2]], ear: [[3, 5], [0, 2]], gmq: [[2, 2], [0, 1]] };
  for (const [k, [bp1, bp2]] of Object.entries(RSL_BP)) ok(same(rsl.marks.belowPass[k], { bp1, bp2 }), `RSL 不及格段 ${k}:手抄 ${JSON.stringify({ bp1, bp2 })}`);
  ok(same(tri.marks.total.belowPass, { bp1: [45, 59], bp2: [0, 44] }), "Trinity 總分不及格段 45–59 / 0–44");
  ok(same(tri.songBands.song12.belowPass, { bp1: [11, 14], bp2: [0, 10] }) && same(tri.songBands.song3.belowPass, { bp1: [14, 17], bp2: [0, 13] }), "Trinity 每首歌不及格段");
  ok(same(tri.sessionBands.belowPass, { bp1: [9, 11], bp2: [0, 8] }) && same(tri.overallBands.belowPass, { bp1: [4, 5], bp2: [1, 3] }), "Trinity Session skills / Overall performance 不及格段");

  /* ── 4. 鼓組圖例 ── */
  for (const [id, p] of Object.entries(key.pieces)) {
    ok("ABCDEFG".includes(p.step) && Number.isInteger(p.oct) && ["normal", "x", "diamond", "circle-x"].includes(p.head), `drumkey ${id} 位置或符頭不對`);
    ok(key.srcs[p.src] && (!p.posSrc || key.srcs[p.posSrc]), `drumkey ${id} 的 src 不在 srcs 裡`);
    ok(Array.isArray(p.name) && p.name[1].length <= 22, `drumkey ${id} 名稱`);
  }
  for (const [id, s] of Object.entries(key.srcs)) ok(s.pending ? !s.p : PAGE.test(s.p || ""), `drumkey srcs.${id}:官方出處要有頁碼、待核對的不能有`);
  // 圖例格子的出處小字(legend.js;格子 74px 寬,一行放得下):每個出處都要有 short [中, 英],英文 ≤ 16 字元;
  // Trinity 的 Drum Kit 大綱要寫明 DK(不能寫成「Trinity p.107」,會以為是 Rock & Pop 的書)
  const shortOK = v => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === "string" && x.trim() && x.length <= 16);
  for (const [id, s] of Object.entries(key.srcs)) {
    ok(shortOK(s.short), `drumkey srcs.${id}.short 要是 [中, 英](各 ≤ 16 字元):${JSON.stringify(s.short)}`);
    if (s.pending) ok(shortOK(s.posShort), `drumkey srcs.${id}.posShort(位置待核對)要是 [中, 英]`);
    if (/Drum Kit/.test(s.ref || "")) ok((s.short || []).every(x => /Trinity DK p\./.test(x)), `drumkey srcs.${id}:Drum Kit 大綱要寫「Trinity DK p.…」`);
    if (/errata/i.test(s.ref || "")) ok(same(s.short, ["Trinity 勘誤", "Trinity errata"]), `drumkey srcs.${id}:勘誤要寫「Trinity 勘誤」`);
  }
  ok(Array.isArray(key.singleLine.short) && key.singleLine.short[0] === "單線譜為 App 的選擇" && key.singleLine.short[1].length <= 22, "drumkey singleLine.short:單線譜為 App 的選擇");
  const P = key.pieces;
  ok(P.hhFoot.head === "x" && P.hhFoot.src === "trinity-dk-p107" && P.hhOpen.mark === "o" && P.hhClosed.mark === "+", "drumkey:腳踩 HH ×、開 o、閉 +(DK p.107)");
  // DK p.107 只畫 × 符頭與向下的符桿(圖上沒有譜線):位置(線下、D4)不是官方的,要有 posSrc = 待核對
  ok(P.hhFoot.posSrc === "pending-pas-weinberg", "drumkey:腳踩 HH 的位置官方沒畫(DK p.107 沒有譜線),要有 posSrc:pending-pas-weinberg");
  ok(Object.entries(P).every(([id, p]) => p.src === "pending-pas-weinberg" || id === "rideBell" || p.posSrc === "pending-pas-weinberg"), "drumkey:官方只確認符頭/記號的(DK p.107),位置都要標 posSrc 待核對");
  ok(P.rideBell.head === "diamond" && P.rideBell.step === "F" && P.rideBell.oct === 5 && P.rideBell.src === "trinity-errata", "drumkey:Ride bell 菱形在最上線(勘誤)");
  ok(key.singleLine.piece === "snare" && key.srcs[key.singleLine.src], "drumkey:RSL 初中級單線小鼓");
  const official = new Set(["trinity-dk-p107", "trinity-errata"]);
  ok(Object.entries(P).every(([id, p]) => official.has(p.src) ? ["hhFoot", "hhOpen", "hhClosed", "rideBell"].includes(id) : p.src === "pending-pas-weinberg"), "drumkey:只有官方可確認的幾項不是「待核對」");
  walk("drumkey.json", { ...key, srcs: undefined }, "", { p: "0" });
}

// 單獨跑
if (import.meta.url === "file://" + process.argv[1]) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ 考試資料全部通過(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
