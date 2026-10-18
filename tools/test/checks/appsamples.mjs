// App 打包的取樣數(tools/build/app-samples.mjs 的 PIECES)= App 實際會用到的數(js/shared/audio.js 小記憶體的上限),verify.mjs 會呼叫;
// 也可以單獨跑:node tools/test/checks/appsamples.mjs
// iOS App(iPhone 與 iPad)在 audio.js 一律是 LOW_MEM:小鼓用 RR_LIMIT 的小記憶體值、鼓皮 / 鈸用 KIT_RR 的小記憶體值。
// 用 regex 直接讀 audio.js 的原始碼(audio.js 要瀏覽器才能 import),不一致就失敗:
// 打包少了 App 會缺聲音,多了只是白白變大(docs/STAGES.md 決定 11)
import fs from "node:fs";
import { PIECES } from "../../build/app-samples.mjs";

const root = new URL("../../../", import.meta.url).pathname;

export default function check(ok){
  const src = fs.readFileSync(root + "js/shared/audio.js", "utf8");
  const rr = src.match(/const RR_LIMIT = LOW_MEM \? (\d+) : (\d+);/);
  const kit = src.match(/const KIT_RR = LOW_MEM \? \{ head: (\d+), cymbal: (\d+) \} : \{ head: (\d+), cymbal: (\d+) \};/);
  const cym = src.match(/const KIT_CYMBALS = new Set\(\[([^\]]*)\]\);/);
  const voices = src.match(/const DRUM_VOICES = \{([\s\S]*?)\n\};/);
  ok(rr, "audio.js 找不到 `const RR_LIMIT = LOW_MEM ? 小 : 大;`(改了寫法要一起改 checks/appsamples.mjs)");
  ok(kit, "audio.js 找不到 `const KIT_RR = LOW_MEM ? { head, cymbal } : { head, cymbal };`");
  ok(cym, "audio.js 找不到 KIT_CYMBALS");
  ok(voices, "audio.js 找不到 DRUM_VOICES");
  if (!rr || !kit || !cym || !voices) return;
  const low = { snare: +rr[1], head: +kit[1], cymbal: +kit[2] };
  const cymbals = new Set([...cym[1].matchAll(/"([^"]+)"/g)].map(m => m[1]));
  const pieces = [...new Set([...voices[1].matchAll(/piece: "([^"]+)"/g)].map(m => m[1]))].sort();
  ok(Object.keys(PIECES).sort().join() === pieces.join(),
    `app-samples.mjs 的 PIECES 鼓件 ${Object.keys(PIECES).sort().join(",")} ≠ audio.js DRUM_VOICES 的 ${pieces.join(",")}`);
  for (const [name, n] of Object.entries(PIECES)) {
    const want = name === "snare" ? low.snare : cymbals.has(name) ? low.cymbal : low.head;
    const from = name === "snare" ? "RR_LIMIT" : cymbals.has(name) ? "KIT_RR.cymbal" : "KIT_RR.head";
    ok(n === want, `app-samples.mjs 的 PIECES.${name} = ${n},audio.js 小記憶體(iOS App)的 ${from} = ${want}`);
  }
}

// 單獨跑
if (import.meta.url === "file://" + process.argv[1]) {
  let fails = 0, n = 0;
  check((c, m) => { n++; if (!c) { fails++; console.log("✗ " + m); } });
  console.log(fails ? `✗ ${fails} 項失敗(共 ${n} 項)` : `✓ App 打包的取樣數跟 audio.js 一致(${n} 項)`);
  process.exit(fails ? 1 : 0);
}
