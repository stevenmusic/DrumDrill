// 截圖比對(重構前後畫面要一樣):19 種尺寸 × 技巧四類 + 打法 40 ×8 + 檢定頁 × 中英,整頁從上到下一個畫面一張
//   (不用 Playwright 的 fullPage:畫面外的部分每次點陣化都不太一樣)
// 逐像素比對:每個像素的 RGBA 各差多少;同一份程式重新載入再拍,圓角、陰影的抗鋸齒會差 1–3 個色階(Chromium 點陣化的雜訊),
//   所以「差 ≤ 8 個色階」只記成雜訊、不算不一樣;差更多的像素才算(版面、文字、譜面真的動了都是幾十到幾百個色階)。
//   另外播放鈕(圓形)的上緣偶爾整排抗鋸齒不同(約 10 個像素、同一份程式重拍也會出現):差異 ≤ 12 個像素的列為「微小」,
//   兩張都留著、列出來給人看,不算失敗;超過 12 個像素才算不一樣
//   node tools/test/shots.mjs --save      拍基準(存在 out/shots/base/)
//   node tools/test/shots.mjs --compare   拍現在的(out/shots/cur/),跟基準逐像素比對;
//                                         不一樣的兩張都留著(base/、cur/ 同檔名)並列出差異的像素數與範圍
// 手機橫式(orientation:landscape 且高度 ≤ 500)的畫面允許改變(S1 新增 fitLandZoom),只列出、不算失敗
// 為了每次都一樣:日期固定(練習紀錄的星期)、等鼓譜畫完與小鼓取樣載完、滑鼠移到角落
// ONLY=fold-280,se-land 只跑幾種尺寸
import { open } from "./harness.mjs";
import fs from "node:fs";
const MODE = process.argv.includes("--save") ? "save" : process.argv.includes("--compare") ? "compare" : null;
if (!MODE) { console.log("用法:node tools/test/shots.mjs --save | --compare"); process.exit(2); }
const OUT = new URL("./out/shots/", import.meta.url).pathname;
const DIR = OUT + (MODE === "save" ? "base/" : "cur/");
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const VPS_ALL = [
  ["fold-280", 280, 653, true], ["se1-320", 320, 568, true], ["se-375", 375, 667, true], ["iphone-390", 390, 844, true],
  ["promax-430", 430, 932, true], ["android-360", 360, 800, true], ["android-412", 412, 915, true],
  ["se-land", 667, 375, true], ["iphone-land", 844, 390, true], ["promax-land", 932, 430, true],
  ["ipad-mini", 744, 1133, true], ["ipad", 820, 1180, true], ["ipad-land", 1180, 820, true], ["ipad-pro", 1024, 1366, true], ["ipad-pro-land", 1366, 1024, true],
  ["laptop", 1280, 800, false], ["desktop", 1440, 900, false], ["fhd", 1920, 1080, false], ["narrow-window", 500, 900, false]
];
const VPS = ONLY ? VPS_ALL.filter(v => ONLY.includes(v[0])) : VPS_ALL;
const phoneLand = (w, h) => w > h && h <= 500;
// 畫面:外框設定(drumdrill.v1)+ 技巧設定(drumdrill.tech.v1)
const STATES = [
  ["roll", { view: "tech", sub: { tech: "roll" } }, { cat: "roll" }],
  ["diddle", { view: "tech", sub: { tech: "diddle" } }, { cat: "diddle" }],
  ["flam", { view: "tech", sub: { tech: "flam" } }, { cat: "flam" }],
  ["drag", { view: "tech", sub: { tech: "drag" } }, { cat: "drag" }],
  ["r40x8", { view: "tech", sub: { tech: "drag" } }, { cat: "drag", pick: { drag: 40 }, reps: 8 }],
  ["exam", { view: "exam", sub: { tech: "roll", exam: "tech" }, exam: { system: "rsl", grade: 3 } }, { cat: "roll" }]
];
let bad = 0, changedLand = 0, same = 0, shots = 0, noisy = 0, noisePx = 0, tiny = 0;
const fails = [];
const { browser, page: cmpPage, close } = MODE === "compare" ? await open({ viewport: { width: 400, height: 300 } }) : { browser: null, page: null, close: null };

for (const [name, w, h, mobile] of VPS) {
  const { page, errors, close: closeVp } = await open({ viewport: { width: w, height: h }, mobile, hasTouch: mobile, dpr: 1 });
  // 日期固定:2026-10-18(練習紀錄的星期列)
  await page.addInitScript(() => {
    const T = new Date(2026, 9, 18, 10, 0, 0).getTime(), D = Date;
    class FD extends D { constructor(...a){ super(...(a.length ? a : [T])); } static now(){ return T; } }
    window.Date = FD;
  });
  // 先重新載入幾次再拍:前兩次載入時 Service Worker 還在安裝、取樣從網路來,播放鈕圓邊的點陣化跟之後不一樣(之後每次都一樣)
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => { localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "tech" })); });
    await page.reload(); await page.waitForFunction(() => window.__tech && window.__tech.state.noteXs > 0 && !document.getElementById("t-loadingMsg").textContent, null, { timeout: 30000 });
    await page.waitForTimeout(500);
  }
  for (const lang of ["zh", "en"]) for (const [st, shell, tech] of STATES) {
    await page.evaluate(([lang, shell, tech]) => {
      localStorage.clear(); localStorage.setItem("drumdrill-lang", lang);
      localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, ...shell }));
      localStorage.setItem("drumdrill.tech.v1", JSON.stringify(tech));
    }, [lang, shell, tech]);
    await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
    // 技巧:等鼓譜畫好、取樣載完(載入訊息、外圈進度不再變)
    if (shell.view === "tech") await page.waitForFunction(() => document.querySelector("#t-osmd svg") && window.__tech && window.__tech.state.noteXs > 0 && !document.getElementById("t-loadingMsg").textContent, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // 截圖時看不到的東西拿掉、動畫停掉:播放鈕外圈(載完是透明的,但它的合成圖層讓播放鈕的圓邊每次點陣化都不一樣)
    await page.addStyleTag({ content: ".play-ring{display:none !important} *,*::before,*::after{transition:none !important;animation:none !important}" });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    // 從上到下一個畫面一張(最後一張貼齊頁底)
    const pages = await page.evaluate(() => { const H = innerHeight, T = document.documentElement.scrollHeight, ys = []; for (let y = 0; y < T - H; y += H) ys.push(y); ys.push(Math.max(0, T - H)); return [...new Set(ys)]; });
    for (let pi = 0; pi < pages.length; pi++) {
    await page.evaluate(y => window.scrollTo(0, y), pages[pi]); await page.waitForTimeout(250);
    const file = `${name}-${lang}-${st}-${pi + 1}.png`;
    await page.screenshot({ path: DIR + file });
    shots++;
    if (MODE === "compare") {
      const base = OUT + "base/" + file;
      if (!fs.existsSync(base)) { bad++; fails.push(`${file}:沒有基準截圖(先跑 --save)`); continue; }
      const a = fs.readFileSync(base), b = fs.readFileSync(DIR + file);
      let diff = null;
      if (!a.equals(b)) diff = await cmpPage.evaluate(async ([a, b]) => {
        const img = async s => { const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext("2d"); x.drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, d: x.getImageData(0, 0, bm.width, bm.height).data }; };
        const A = await img(a), B = await img(b);
        if (A.w !== B.w || A.h !== B.h) return { size: `${A.w}×${A.h} → ${B.w}×${B.h}` };
        let n = 0, noise = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let i = 0; i < A.d.length; i += 4) {
          const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]), Math.abs(A.d[i + 3] - B.d[i + 3]));
          if (!d) continue;
          if (d <= 8) { noise++; continue; }
          n++; const p = i / 4, x = p % A.w, y = Math.floor(p / A.w); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        return n ? { n, noise, box: `(${x0},${y0})–(${x1},${y1})` } : { n: 0, noise };
      }, [a.toString("base64"), b.toString("base64")]);
      if (diff && !diff.n && !diff.size) { noisy++; noisePx += diff.noise; diff = null; }
      if (!diff) { same++; fs.rmSync(DIR + file); continue; }   // 一樣的不留(只留不一樣的兩張)
      const msg = `${file}:` + (diff.size ? `大小不同 ${diff.size}` : `${diff.n} 個像素不同,範圍 ${diff.box}`);
      if (phoneLand(w, h)) { changedLand++; console.log("△ 手機橫式(允許改變)" + msg); }
      else if (!diff.size && diff.n <= 12) { tiny++; console.log("◇ 微小(≤ 12 個像素,抗鋸齒)" + msg); }
      else { bad++; fails.push(msg); }
    }
    }
    // 基準有、現在沒有的(頁面變短)
    if (MODE === "compare") for (let pi = pages.length; fs.existsSync(OUT + `base/${name}-${lang}-${st}-${pi + 1}.png`); pi++) {
      const msg = `${name}-${lang}-${st}-${pi + 1}.png:基準有這一張,現在頁面比較短`;
      if (phoneLand(w, h)) { changedLand++; console.log("△ 手機橫式(允許改變)" + msg); } else { bad++; fails.push(msg); }
    }
  }
  for (const e of errors) { bad++; fails.push(`${name} console:${e}`); }
  await closeVp();
}
if (close) await close();
const n = VPS.length * 2 * STATES.length;
if (MODE === "save") { console.log(bad ? fails.join("\n") : ""); console.log(bad ? `✗ ${bad} 項問題` : `✓ ${n} 個畫面,已存 ${shots} 張基準截圖(${OUT}base/)`); }
else {
  console.log(fails.join("\n"));
  console.log(`一樣 ${same} 張(其中 ${noisy} 張只有抗鋸齒雜訊,共 ${noisePx} 個像素差 ≤ 8 色階);微小 ${tiny} 張;手機橫式改變 ${changedLand} 張(允許)` + (bad ? `;其他不一樣 ${bad} 張(兩張都留在 ${OUT}base/ 與 cur/)` : ""));
  console.log(bad ? `✗ ${bad} 項問題` : `✓ ${n} 個畫面 ${shots} 張截圖:手機橫式以外全部一樣`);
}
process.exit(bad ? 1 : 0);
