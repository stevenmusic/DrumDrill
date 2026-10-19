// 不用瀏覽器的檢查(APPWWW=1 另外跑 App 打包檢查):基本打法資料(照 PAS 官方表)、鼓譜 MusicXML(技巧的單線譜、鼓組譜)、RSL 依大綱時值的練習型、考試資料(照 RSL / Trinity 官方大綱)、Trinity Playback 譜產生器、RSL 整組鼓視奏與聽力出題器、節奏評分、視奏出題器、版本指紋、兩個 App 的共用檔案(sync.mjs)
// 執行:node tools/test/verify.mjs
import { execFileSync } from "node:child_process";
import { RUDIMENTS, CATEGORIES, strokes, cycleLength, mainStrokes, withLead, DIV } from "../../js/tech/rudiments.js";
import { rudimentXML } from "../../js/tech/notation.js";
import examdata from "./checks/examdata.mjs";
import appsamples from "./checks/appsamples.mjs";
import patterncheck from "./checks/pattern.mjs";
import kitxml from "./checks/kitxml.mjs";
import timing, { checkMic } from "./checks/timing.mjs";
import gensight from "./checks/gen-sight.mjs";
import genplayback from "./checks/gen-playback.mjs";
import genkit from "./checks/gen-kit.mjs";
import genear from "./checks/gen-ear.mjs";
import sightmeter from "./checks/sight-meter.mjs";
import dailycheck from "./checks/daily.mjs";
import routescheck from "./checks/routes.mjs";
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
// 6a. RSL「依大綱時值」練習型(rudiments.js pattern():整數拍、左右手 = PAS 序列重複、MusicXML 時值與連音標記;checks/pattern.mjs)
try { patterncheck(ok); } catch (e) { ok(false, "練習型檢查出錯:" + e.stack); }
// 6b. App 打包的取樣數(tools/build/app-samples.mjs 的 PIECES)= audio.js 小記憶體的 RR_LIMIT / KIT_RR(iOS App 一律走小記憶體)
try { appsamples(ok); } catch (e) { ok(false, "App 取樣數檢查出錯:" + e.stack); }
// 6c. 鼓組譜 MusicXML(js/shared/kitnotation.js):樣張、每小節每個聲部的時值 = 拍號、鼓件都在 drumkey、隨機 500 小節(checks/kitxml.mjs)
try { kitxml(ok); } catch (e) { ok(false, "鼓組譜檢查出錯:" + e.stack); }
// 6d. 觸控鼓墊的節奏評分(js/shared/timing.js + onsets.js 的 scoreRhythm):已知偏移、漏打 / 多打、偏移超過上限、三個鼓墊各自評分
try { timing(ok); } catch (e) { ok(false, "節奏評分檢查出錯:" + e.stack); }
// 6d(續). 麥克風的起音偵測(S15;timing.js 的 detectHits,合成訊號;Naked Drums 取樣的混音在 tools/test/mic-check.mjs)
try { checkMic(ok); } catch (e) { ok(false, "麥克風偵測檢查出錯:" + e.stack); }
// 6e. 視奏出題器(js/sight/gen.js,RSL Debut–3 小鼓):每級 1000 個種子只出現白名單時值、每小節 4 拍、同種子同題、速度在範圍內(checks/gen-sight.mjs)
try { gensight(ok); } catch (e) { ok(false, "視奏出題器檢查出錯:" + e.stack); }
// 6f. Trinity Playback 譜產生器(js/shared/playbackgen.js):每級 1000 個種子,只用累積白名單、時值、長度、聲部數、換拍號(checks/gen-playback.mjs)
try { genplayback(ok); } catch (e) { ok(false, "Playback 產生器檢查出錯:" + e.stack); }
// 6g. RSL 4–5 級整組鼓視奏出題器(js/shared/kitgen.js)+ 共用播放事件 toEvents(js/shared/kitevents.js;也拿 Trinity Playback 的題目核對):
//     每級 1000 個種子,白名單(手抄大綱表)、時值、自由發展在最後 2 小節、事件 = MusicXML、竄改一定抓到(checks/gen-kit.mjs)
try { genkit(ok); } catch (e) { ok(false, "RSL 整組鼓視奏出題器檢查出錯:" + e.stack); }
// 6h. RSL 聽力出題器(js/ear/gen.js):Fill(♩=70、小鼓單線、白名單、干擾選項只改一拍且聽起來不同)、Groove(鼓件照級數、速度範圍、播兩遍、不出風格題)(checks/gen-ear.mjs)
try { genear(ok); } catch (e) { ok(false, "RSL 聽力出題器檢查出錯:" + e.stack); }
// 6i. 視奏的拍點與小節時間軸(js/sight/meter.js:拍號的拍點、複拍子用八分音符當一拍、換拍號;Trinity / RSL 題目的事件都落在小節裡)+ 題目指紋(checks/sight-meter.mjs)
try { sightmeter(ok); } catch (e) { ok(false, "視奏拍點時間軸檢查出錯:" + e.stack); }
// 6j. 今日練習引擎(js/shared/daily.js;兩個 App 同一份):菜單、速度階梯、連續 N 次過關、快速通道、歡迎回來、複習盒與變化、拍點模式、消毒(checks/daily.mjs)
try { dailycheck(ok); } catch (e) { ok(false, "今日練習引擎檢查出錯:" + e.stack); }
// 6k. 今日練習的路線(js/tech/routes.js + routespec.js):律動 28、過門 19 關的譜、拍數、速度、左右手、時值由慢到快、每天不一樣的關 1000 個種子(checks/routes.mjs)
try { routescheck(ok); } catch (e) { ok(false, "今日練習路線檢查出錯:" + e.stack); }
// 6j. 可選:APPWWW=1 時跑 App 打包檢查(tools/test/app-www.mjs:先跑 app-www 再檢查 app/www 完整;要下載取樣,所以預設不跑)
if (process.env.APPWWW) {
  try { console.log(execFileSync("node", [new URL("./app-www.mjs", import.meta.url).pathname], { stdio: "pipe" }).toString().trim().split("\n").pop()); checks++; }
  catch (e) { fails++; checks++; console.log((e.stdout || "").toString().trim()); }
}
// 7. 版本指紋與 sw.js 預快取清單
try { execFileSync("node", [new URL("../build/stamp.mjs", import.meta.url).pathname, "--check"], { stdio: "pipe" }); checks++; }
catch (e) { fails++; checks++; console.log("✗ " + (e.stdout || "").toString().trim()); }
// 8. 兩個 App 的共用檔案(PIANODRILL=…;找不到 PianoDrill 就略過)
try { console.log(execFileSync("node", [new URL("./sync.mjs", import.meta.url).pathname], { stdio: "pipe" }).toString().trim()); checks++; }
catch (e) { fails++; checks++; console.log((e.stdout || "").toString().trim()); }

console.log(fails ? `\n✗ ${fails} 項失敗(共 ${checks} 項)` : `✓ 全部通過(${checks} 項)`);
process.exit(fails ? 1 : 0);
