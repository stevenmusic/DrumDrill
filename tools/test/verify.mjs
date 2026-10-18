// 不用瀏覽器的檢查:基本打法資料(照 PAS 官方表)、鼓譜 MusicXML、考試資料(照 RSL / Trinity 官方大綱)、節奏評分、版本指紋、兩個 App 的共用檔案(sync.mjs)
// 執行:node tools/test/verify.mjs
import { execFileSync } from "node:child_process";
import { RUDIMENTS, CATEGORIES, strokes, cycleLength, mainStrokes, withLead, DIV } from "../../js/tech/rudiments.js";
import { rudimentXML } from "../../js/tech/notation.js";
import examdata from "./checks/examdata.mjs";
import appsamples from "./checks/appsamples.mjs";
import timing from "./checks/timing.mjs";
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log("✗ " + msg); } };

// 1. 40 個,號碼 1–40 都在,各類範圍照 PAS(滾奏 1–15、複點 16–19、Flam 20–30、Drag 31–40)
ok(RUDIMENTS.length === 40, "應該有 40 個基本打法");
for (let i = 1; i <= 40; i++) ok(RUDIMENTS.some(r => r.no === i), `少了第 ${i} 個`);
const range = { roll: [1, 15], diddle: [16, 19], flam: [20, 30], drag: [31, 40] };
for (const r of RUDIMENTS) ok(r.no >= range[r.cat][0] && r.no <= range[r.cat][1], `${r.no} 的分類不對(${r.cat})`);
ok(CATEGORIES.length === 4, "四大類");

// 2. 滾奏的名稱 = 每一組打的下數(五擊 = 5 下……十七擊 = 17 下);雙擊開放滾奏是 RRLL 交替
const STROKES = { 7: 5, 8: 6, 9: 7, 10: 9, 11: 10, 12: 11, 13: 13, 14: 15, 15: 17 };
for (const [no, n] of Object.entries(STROKES)) {
  const r = RUDIMENTS.find(x => x.no === Number(no));
  ok(mainStrokes(r.groups) === n * 2, `${no}. ${r.en}:每組應該 ${n} 下,實際一輪 ${mainStrokes(r.groups)} 下(兩組)`);
}
const dsr = strokes(RUDIMENTS.find(r => r.no === 6).groups).map(s => s.hand).join("");
ok(dsr === "RRLLRRLLRRLLRRLL", "雙擊開放滾奏應該是 RRLL 交替:" + dsr);

// 3. 官方表的左右手順序(逐個抄的,改資料時一起核對)
const STICK = {
  1: "RLRLRLRL", 2: "RLRLRLRL", 3: "RLRLRLR", 5: "RRRLLLRRRLLL", 16: "RLRRLRLL", 17: "RLRLRRLRLRLL", 18: "RLRLRLRRLRLRLRLL", 19: "RLRRLLRLRRLL",
  21: "RLRLRL", 22: "RRLLRRLL", 23: "RLRLR", 24: "RLRRLRLL", 25: "RRLRLLRL", 26: "RLRRLLLRLLRR", 27: "RLRLRLRL", 28: "RRLRRL", 29: "RLLRRLLR", 30: "RLLRLRRL",
  32: "RLLR", 33: "RRLLLR", 34: "RLRRLR", 35: "RRLRRLLRLL", 36: "RRLRRLLRLL", 37: "RRRLRRLLLRLL", 38: "RLRLLRLR", 39: "RRLRLLLRLR", 40: "RRRLRLLLLRLR"
};
for (const [no, seq] of Object.entries(STICK)) {
  const r = RUDIMENTS.find(x => x.no === Number(no));
  const got = strokes(r.groups).filter(s => s.kind !== "grace").map(s => s.hand).join("");
  ok(got === seq, `${no}. ${r.en} 左右手:應該 ${seq},實際 ${got}`);
}
// Flam = 一個另一隻手的裝飾音、Drag = 兩個
for (const r of RUDIMENTS) for (const n of r.groups.flat()) {
  if (n.flam || n.drag) { const g = strokes([[n]]).filter(s => s.kind === "grace"); ok(g.length === (n.flam ? 1 : 2) && g.every(s => s.hand !== n.hand), `${r.no} 裝飾音不對`); }
}
// 4. 左手先 = 每一個音左右對調(只有官方表印了第二行的才有)
for (const r of RUDIMENTS.filter(x => x.second)) {
  const a = strokes(withLead(r, "R")).map(s => s.hand).join(""), b = strokes(withLead(r, "L")).map(s => s.hand).join("");
  ok(a.replace(/R/g, "x").replace(/L/g, "R").replace(/x/g, "L") === b, `${r.no} 左手先不是左右對調`);
}
// 5. 每一輪的長度是整數拍、MusicXML 每個 <note> 的時值加起來 = 一輪
for (const r of RUDIMENTS) {
  const len = cycleLength(r.groups);
  ok(len % DIV === 0, `${r.no} 一輪不是整數拍(${len / DIV})`);
  const xml = rudimentXML(r.groups, { reps: 4 });
  const dur = [...xml.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((s, m) => s + Number(m[1]), 0);
  ok(dur === len, `${r.no} MusicXML 時值 ${dur} ≠ ${len}`);
  ok((xml.match(/<note>/g) || []).length >= r.groups.flat().length, `${r.no} 音符數不對`);
  ok(!/undefined|NaN/.test(xml), `${r.no} MusicXML 有 undefined`);
}
// 6. 考試資料(data/exam-rsl.json、exam-trinity.json、drumkey.json;細項在 checks/examdata.mjs,裡面另外手抄了一份大綱的表互相核對)
try { examdata(ok); } catch (e) { ok(false, "考試資料檢查出錯:" + e.stack); }
// 6b. App 打包的取樣數(tools/build/app-samples.mjs 的 PIECES)= audio.js 小記憶體的 RR_LIMIT / KIT_RR(iOS App 一律走小記憶體)
try { appsamples(ok); } catch (e) { ok(false, "App 取樣數檢查出錯:" + e.stack); }
// 6c. 觸控鼓墊的節奏評分(js/shared/timing.js + onsets.js 的 scoreRhythm):已知偏移、漏打 / 多打、偏移超過上限、三個鼓墊各自評分
try { timing(ok); } catch (e) { ok(false, "節奏評分檢查出錯:" + e.stack); }
// 7. 版本指紋與 sw.js 預快取清單
try { execFileSync("node", [new URL("../build/stamp.mjs", import.meta.url).pathname, "--check"], { stdio: "pipe" }); checks++; }
catch (e) { fails++; checks++; console.log("✗ " + (e.stdout || "").toString().trim()); }
// 8. 兩個 App 的共用檔案(PIANODRILL=…;找不到 PianoDrill 就略過)
try { console.log(execFileSync("node", [new URL("./sync.mjs", import.meta.url).pathname], { stdio: "pipe" }).toString().trim()); checks++; }
catch (e) { fails++; checks++; console.log((e.stdout || "").toString().trim()); }

console.log(fails ? `\n✗ ${fails} 項失敗(共 ${checks} 項)` : `✓ 全部通過(${checks} 項)`);
process.exit(fails ? 1 : 0);
