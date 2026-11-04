// App Store 截圖(中英各一套,真實畫面):iPhone 6.9 吋(430×932 × 3 = 1290 × 2796)與 iPad 13 吋(1032×1376 × 2 = 2064 × 2752)
// 五張:今日練習(開始後)→ 技巧 #16 Single Paradiddle → 視奏鼓組譜(圖例 + 鼓墊)→ 聽力過門(選譜作答)→ 檢定 RSL 3 級(考試卡 + 本級要求)
// 輸出 app/screenshots/{zh,en}/{iphone,ipad13}-n-名稱.png(Playwright 的 PNG 是 RGB、沒有透明通道)。用法:node tools/test/appshots.mjs
// 參考 PianoDrill 的 tools/test/appshots.mjs(不在 sync.json,兩邊各自的畫面)
import fs from "node:fs";
import { open } from "./harness.mjs";
const ROOT = new URL("../../app/screenshots/", import.meta.url).pathname;
const today = new Date(), k = x => { const y = new Date(today); y.setDate(y.getDate() - x); return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`; };
const techLog = Object.fromEntries([1, 2, 3, 4, 6].map(x => [k(x), { n: 5 - (x % 3), sec: 900 }]));   // 練習紀錄:最近幾天有練(今天還沒,今日練習卡才是「開始」)
const sightLog = Object.fromEntries([1, 2, 4, 5].map(x => [k(x), { n: 4 + (x % 3), sec: 600 }]));
const earLog = Object.fromEntries([1, 3, 4].map(x => [k(x), { n: 8, hits: 6, total: 8, sec: 420 }]));
// 今日練習的進度:律動過了 B2(過門路線開放)、過門過了 FA1 → 今天 = 暖身 → 律動 B3「大鼓加在 3&」→ 過門 FA2(複習都還沒到期)
const passed = ["G01", "A1", "A2", "A3", "A4", "B1", "B2"].map(id => "groove/" + id).concat(["fill/FA1"]);
const daily = { seen: true, prog: { groove: { at: "B3" }, fill: { at: "FA2" } },
  lv: Object.fromEntries(passed.map((id, i) => [id, { tries: 6, streak: 3, passed: k(20 - i), box: 3, due: k(-5) }])) };
for (const lang of ["zh", "en"]) {
  const OUT = `${ROOT}${lang}/`; fs.mkdirSync(OUT, { recursive: true });
  for (const [dev, w, h, dpr] of [["iphone", 430, 932, 3], ["ipad13", 1032, 1376, 2]]) {
    const { page, close, errors } = await open({ viewport: { width: w, height: h }, mobile: true, dpr });
    // 固定亂數種子(每次載入從頭):中英、iPhone / iPad 抽到同一題(視奏的譜、聽力的題目)
    await page.addInitScript(() => { let s = 20261104; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
    const go = async (shell, tech, extra, ear) => {
      await page.evaluate(([shell, tech, logs, lang, ear]) => {
        localStorage.clear(); localStorage.setItem("drumdrill-lang", lang);
        localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, ...shell }));
        localStorage.setItem("drumdrill.tech.v1", JSON.stringify({ log: logs.tech, mastery: {}, ...tech }));
        localStorage.setItem("drumdrill.sight.v1", JSON.stringify({ log: logs.sight }));
        localStorage.setItem("drumdrill.ear.v1", JSON.stringify({ log: logs.ear, ...ear }));
      }, [shell, tech || {}, { tech: techLog, sight: sightLog, ear: earLog }, lang, ear || {}]);
      await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
      await page.waitForTimeout(1500);
      if (extra) await extra();
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
    };
    const shot = name => page.screenshot({ path: `${OUT}${dev}-${name}.png` });
    // 1 今日練習:按「開始今天的練習」後的第一段(題目卡 + 鼓譜 + 鼓墊)
    await go({ view: "tech", sub: { tech: "today" } }, { padMode: true, daily }, async () => {
      await page.click("#t-dailyCard .daily-btn"); await page.waitForTimeout(800);
      if (await page.evaluate(() => window.__tech.dseg && window.__tech.dseg.k === "warm")) await page.evaluate(() => window.__tech.dNext());   // 跳過暖身,到主要路線那一段
    });
    await shot("1-today");
    // 2 技巧:#16 Single Paradiddle(鼓譜、左右手)
    await go({ view: "tech", sub: { tech: "diddle" } }, { cat: "diddle", pick: { diddle: 16 } });
    await shot("2-paradiddle");
    // 3 視奏:鼓組譜(圖例 + 鼓墊)
    await go({ view: "sight", sub: { sight: "groove" } }, { daily: { lv: { "groove/B8": { passed: k(3) } } } });   // 律動過了 B8 才不出「先把今日練習的律動練到…」那行建議
    await shot("3-sight");
    // 4 聽力:過門(聽一段,選對的譜)
    // 聽一遍 → 照節奏打回來(鼓墊)→ 出現 A / B / C 三份譜「哪一個是剛才的過門?」
    await go({ view: "ear", sub: { ear: "fill" } }, null, async () => {
      await page.evaluate(() => window.__ear.listen());
      await page.waitForFunction(() => window.__ear.state.listened >= 1 && !window.__ear.state.kind, null, { timeout: 60000 });
      await page.evaluate(() => window.__ear.perform());
      await page.waitForFunction(() => window.__ear.state.kind === "perform", null, { timeout: 60000 });
      await page.evaluate(async () => {   // 照題目的節奏敲鼓墊(跟 human.mjs 一樣)
        const { perfToAudioTime } = await import("./js/shared/player.js");
        const E = window.__ear, t0 = E.perfT0(), now = performance.now(), off = perfToAudioTime(now) - now / 1000;
        for (const x of E.expected()) setTimeout(() => { const b = document.querySelector(`#e-pads .tap-pad[data-lane="${x.lane}"]`); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); }, Math.max(0, (t0 + x.time - off) * 1000 - performance.now()));
      });
      await page.waitForFunction(() => window.__ear.state.phase === "choose" && window.__ear.state.optsDrawn === window.__ear.state.options, null, { timeout: 60000 });
    }, { level: { fill: 4 } });
    await shot("4-ear");
    // 5 檢定:RSL 3 級(考試卡 + 本級要求)
    await go({ view: "exam", exam: { system: "rsl", grade: 3 }, sub: { exam: "tech" } });
    await shot("5-exam");
    if (errors.length) console.log(dev, lang, errors.slice(0, 3).join("\n"));
    await close();
  }
}
console.log("ok");
