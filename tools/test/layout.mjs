// 版面檢查:各種裝置尺寸(手機直/橫、折疊機、平板、筆電、大螢幕)× 每個畫面狀態,檢查
//  1. 沒有橫向捲動;可見元素沒有超出畫面左右
//  2. 按鈕文字沒有被截斷(刻意用省略號的除外)、點擊區域夠大
//  3. 頂欄品牌名和右邊按鈕不重疊;底部分頁列不蓋住內容(捲到底時最後一個元素在分頁列上方)
//  4. 對話框放得進畫面(放不下時可以捲動)
//  5. 樂譜不超出紙張
// 每種尺寸存截圖到 out/layout-*.png
// PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):檢查函式一模一樣,畫面狀態腳本放在 @app 區段
import { open } from "./harness.mjs";
import fs from "node:fs";
const OUT = new URL("./out/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const VPS_ALL = [
  ["fold-280", 280, 653, true], ["se1-320", 320, 568, true], ["se-375", 375, 667, true], ["iphone-390", 390, 844, true],
  ["promax-430", 430, 932, true], ["android-360", 360, 800, true], ["android-412", 412, 915, true],
  ["se-land", 667, 375, true], ["iphone-land", 844, 390, true], ["promax-land", 932, 430, true],
  ["ipad-mini", 744, 1133, true], ["ipad", 820, 1180, true], ["ipad-land", 1180, 820, true], ["ipad-pro", 1024, 1366, true], ["ipad-pro-land", 1366, 1024, true],
  ["laptop", 1280, 800, false], ["desktop", 1440, 900, false], ["fhd", 1920, 1080, false], ["narrow-window", 500, 900, false]
];
const VPS = ONLY ? VPS_ALL.filter(v => ONLY.includes(v[0])) : VPS_ALL;
let bad = 0; const issues = [];
const report = (vp, state, msg) => { bad++; issues.push(`${vp} ${state}: ${msg}`); };

async function audit(page, vp, state){
  const r = await page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight, out = [];
    const vis = e => { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || e.closest("[hidden]")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    if (document.documentElement.scrollWidth > W + 1) out.push(`橫向捲動 ${document.documentElement.scrollWidth} > ${W}`);
    // 可見元素超出畫面(橫向捲動的 .opts 容器裡的除外;樂譜紙張 overflow hidden)
    for (const e of document.querySelectorAll("body *")) {
      if (!vis(e) || e.closest(".opts") || e.closest("#t-scroll") || e.id === "t-playline" || e.closest(".stage") || e.closest(".modal") && !e.closest(".modal-card")) continue;
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.right > W + 1) { out.push(`超出畫面:${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${[...e.classList].join(".")} [${Math.round(r.left)},${Math.round(r.right)}]`); if (out.length > 12) break; }
    }
    // 按鈕文字被截斷
    for (const e of document.querySelectorAll("button, .q-tag, label, .lbl")) {
      if (!vis(e) || e.closest(".setup-summary") || e.id === "examChip") continue;   // 摘要列刻意省略號
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== "visible") out.push(`文字被截斷:${e.textContent.trim().slice(0, 30)}(${e.scrollWidth}>${e.clientWidth})`);
    }
    // 點擊區域(手指):至少 28×28
    for (const e of document.querySelectorAll("button, select, input[type=range]")) {
      if (!vis(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.height < 28 || r.width < 28) out.push(`點擊區域太小:${(e.id || e.textContent.trim()).slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    // 頂欄重疊
    const h1 = document.querySelector("header h1").getBoundingClientRect(), hr = document.querySelector(".header-right").getBoundingClientRect();
    if (h1.right > hr.left + 1 && h1.bottom > hr.top && h1.top < hr.bottom) out.push(`頂欄重疊:品牌名到 ${Math.round(h1.right)},按鈕從 ${Math.round(hr.left)}`);
    // 樂譜不超出紙張
    const svg = document.querySelector("#t-osmd svg"), paper = document.querySelector("#mod-tech .paper");
    // 樂譜一整行:比紙張長時要能左右滑(#scroll),比紙張短時要置中
    if (svg && vis(paper)) {
      const sc = document.getElementById("t-scroll"), pr = paper.getBoundingClientRect(), gr = svg.getBoundingClientRect();
      if (pr.right > W + 1) out.push("樂譜紙張超出畫面");
      if (gr.width <= sc.clientWidth && Math.abs((gr.left + gr.right) / 2 - (pr.left + pr.right) / 2) > 3) out.push(`樂譜沒有置中(差 ${Math.round((gr.left + gr.right) / 2 - (pr.left + pr.right) / 2)}px)`);
      if (gr.width > sc.clientWidth + 2 && sc.scrollWidth <= sc.clientWidth) out.push("樂譜比紙張長卻不能左右滑");
    }
    // 對話框
    const mc = document.querySelector(".modal-card");
    if (mc && vis(mc)) { const r = mc.getBoundingClientRect(), m = document.querySelector(".modal"); if ((r.height > H + 1) && m.scrollHeight <= m.clientHeight) out.push(`對話框放不下又不能捲 ${Math.round(r.height)} > ${H}`); }
    return out;
  });
  for (const m of [...new Set(r)]) report(vp, state, m);
  // 捲到底:最後的內容不被底部分頁列蓋住
  const cover = await page.evaluate(async () => {
    // 播放中譜面會自己捲(stage.js 換行時平滑捲動):量的時候要真的在最底下,不在就再捲一次(最多 8 次)
    for (let k = 0; k < 8; k++) {
      window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 120));
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) break;
    }
    const tb = document.getElementById("tabbar").getBoundingClientRect();
    const items = [...document.querySelectorAll("main .card, main > footer")].filter(e => !e.closest("[hidden]") && e.getBoundingClientRect().height > 0);
    const lastBottom = Math.max(...items.map(e => e.getBoundingClientRect().bottom));
    const left = Math.min(...items.map(e => e.getBoundingClientRect().left));
    window.scrollTo(0, 0);
    // 分頁列在下面:最後的內容要在它上面;手機橫放時分頁列是左邊的直欄:內容要在它右邊
    if (tb.height > innerHeight / 2) return left < tb.right - 1 ? `內容被左邊的分頁列蓋住(${Math.round(left)} < ${Math.round(tb.right)})` : null;
    return lastBottom > tb.top + 1 ? `最後的內容被底部分頁列蓋住(${Math.round(lastBottom)} > ${Math.round(tb.top)})` : null;
  });
  if (cover) report(vp, state, cover);
  // 飽滿(使用者要求):每種裝置的第一個畫面,題目卡要在畫面上半部(設定卡不能把題目擠到下面去)
  const quizTop = await page.evaluate(() => {
    const q = [...document.querySelectorAll(".mod:not([hidden]) .quiz")].find(e => !e.closest("[hidden]") && e.getBoundingClientRect().height > 0);
    // 使用者自己打開的設定卡把題目往下推是正常的;只檢查設定卡都收著(或在兩欄的左欄)的時候
    const opened = [...document.querySelectorAll(".setup.open, .picker.open")].some(e => !e.closest("[hidden]") && !e.closest(".mod-side, #examSetup") || (e.closest("#examSetup") && innerWidth < 1100));
    const sideOpen = innerWidth < 1100 && [...document.querySelectorAll(".mod-side .setup.open, .mod-side .picker.open")].some(e => !e.closest("[hidden]"));
    if (opened || sideOpen) return null;
    return q ? { top: Math.round(q.getBoundingClientRect().top + scrollY), H: innerHeight } : null;
  });
  // 手機橫放(高度 ≤ 500):頂欄 + 兩條收起來的設定列就佔掉一半,放寬到 60%(題目標題仍在第一個畫面)
  const limit = quizTop && quizTop.H <= 500 ? 0.6 : 0.5;
  if (quizTop && !/對話框|設定展開|選擇器|字級/.test(state) && quizTop.top > quizTop.H * limit) report(vp, state, `題目卡太下面(${quizTop.top} > 畫面 ${Math.round(limit * 100)}% ${Math.round(quizTop.H * limit)})`);
}

for (const [name, w, h, mobile] of VPS) {
  const { page, errors, close } = await open({ viewport: { width: w, height: h }, mobile, hasTouch: mobile, dpr: 1 });
  const shot = async st => page.screenshot({ path: `${OUT}layout-${name}-${st}.png` });
  const tab = v => page.click(`#tabbar button[data-view="${v}"]`).then(() => page.waitForTimeout(400));
  const sub = v => page.click(`#subSeg button[data-v="${v}"]`).then(() => page.waitForTimeout(500));
  const expand = async sel => { if (await page.isVisible(sel + " .setup-summary")) await page.click(sel + " .setup-summary"); };
  // @app-begin:各 App 的畫面狀態
  // S14 模擬考(檢定頁):技巧 RSL 3(開始前 / 進行中 / 播放中 / 結果 / 中止的說明)、視奏 RSL 3、RSL 4、Trinity 4(準備中 / 作答中 / 結果)、
  //   聽力 RSL 4(聽題目 / 練習 / 選譜 / 結果)、Trinity 4(看譜 / 結果);check(狀態名稱) = 這支測試自己的檢查
  async function mockTour(page, check){
    const ev = (f, a) => page.evaluate(f, a);
    const wait = (f, a) => page.waitForFunction(f, a, { timeout: 60000 });
    await ev(() => { window.__shell.setExam("rsl", 3); window.__shell.showView("exam", "tech"); }); await page.waitForTimeout(400);
    await check("模擬考 技巧 開始前");
    await ev(() => document.getElementById("t-mockBtn").click()); await page.waitForTimeout(700);
    await check("模擬考 技巧 進行中");
    await ev(() => document.getElementById("t-playBtn").click()); await wait(() => window.__tech.state.play); await page.waitForTimeout(400);
    await check("模擬考 技巧 播放中");
    await ev(() => window.__tech.mockFinishRun());
    for (let i = 0; i < 8 && (await ev(() => window.__tech.state.mock)) === "run"; i++) { await ev(() => window.__tech.mockNext()); await page.waitForTimeout(200); }
    await page.waitForTimeout(300); await check("模擬考 技巧 結果");
    await ev(() => document.getElementById("t-mockBtn").click()); await page.waitForTimeout(300);
    await ev(() => window.__shell.showView("tech")); await page.waitForTimeout(300);
    await ev(() => window.__shell.showView("exam", "tech")); await page.waitForTimeout(400);
    await check("模擬考 技巧 中止");
    await ev(() => document.getElementById("t-mockClose").click()); await page.waitForTimeout(200);
    for (const [sys, g] of [["rsl", 3], ["rsl", 4], ["trinity", 4]]) {
      const at = `模擬考 視奏 ${sys} ${g}`;
      await ev(([s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("exam", "sight"); }, [sys, g]); await page.waitForTimeout(400);
      if (sys === "rsl" && g === 3) await check("模擬考 視奏 開始前");
      await ev(() => document.getElementById("s-mockBtn").click());
      await wait(() => window.__sight.state.drawn > 0 && !window.__sight.state.pending && window.__sight.state.loading == null && window.__sight.mock.state === "run"); await page.waitForTimeout(500);
      await check(`${at} 準備中`);
      await ev(() => window.__sight.mockSkipPrep());
      await wait(() => window.__sight.state.phase === "perform"); await page.waitForTimeout(600);
      await check(`${at} 作答中`);
      await ev(() => window.__sight.finishNow());
      await wait(() => window.__sight.mock.state === "result"); await page.waitForTimeout(400);
      await check(`${at} 結果`);
    }
    for (const sys of ["rsl", "trinity"]) {
      await ev(s => { window.__shell.setExam(s, 4); window.__shell.showView("exam", "ear"); }, sys); await page.waitForTimeout(400);
      await ev(() => document.getElementById("e-mockBtn").click());
      if (sys === "rsl") {
        await wait(() => window.__ear.state.kind === "listen"); await page.waitForTimeout(500);
        await check("模擬考 聽力 rsl 聽題目");
        await ev(() => window.__ear.finishNow()); await page.waitForTimeout(300); await check("模擬考 聽力 rsl 練習");
        await ev(() => document.getElementById("e-performBtn").click()); await wait(() => window.__ear.state.kind === "perform");
        await page.keyboard.press("j"); await ev(() => window.__ear.finishNow());
        await wait(() => window.__ear.state.optsDrawn === window.__ear.state.options); await page.waitForTimeout(500);
        await check("模擬考 聽力 rsl 選譜");
        await ev(() => window.__ear.choose(0)); await page.waitForTimeout(300);
        await ev(() => window.__ear.mockNext()); await wait(() => window.__ear.state.kind === "listen");
        await ev(() => window.__ear.finishNow()); await page.waitForTimeout(200);
        await ev(() => document.getElementById("e-performBtn").click()); await wait(() => window.__ear.state.kind === "perform");
        await ev(() => window.__ear.finishNow()); await page.waitForTimeout(500);
        await ev(() => window.__ear.mockNext());
      } else {
        await wait(() => window.__ear.state.phase === "study" && !window.__ear.state.pending); await page.waitForTimeout(600);
        await check("模擬考 聽力 trinity 看譜");
        await ev(() => window.__ear.mockSkipStudy()); await wait(() => window.__ear.state.kind === "pass");
        await ev(() => window.__ear.finishNow()); await wait(() => window.__ear.state.kind === "pass" && window.__ear.state.pass === 1);
        await page.keyboard.press("j"); await ev(() => window.__ear.finishNow());
      }
      await wait(() => window.__ear.mock.state === "result"); await page.waitForTimeout(400);
      await check(`模擬考 聽力 ${sys} 結果`);
      await ev(() => document.getElementById("e-mockClose").click()); await page.waitForTimeout(200);
    }
  }
  // 第一次打開:對話框
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  await audit(page, name, "對話框"); await shot("onboard");
  await page.click('#obSystem button[data-v="rsl"]'); await page.click('#obGradeSeg button[data-v="8"]'); await page.click("#obYes");
  await page.waitForTimeout(300);
  // 檢定:技巧(本級要求還沒有)、視奏、聽力
  await audit(page, name, "檢定 技巧"); await shot("exam");
  // S3:檢定頁 RSL 0/3/8、Trinity 0/4/8 × 技巧/視奏/聽力;考試摘要收著時,技巧的本級要求清單開頭要在第一個畫面
  for (const [sys, g] of [["rsl", 0], ["rsl", 3], ["rsl", 4], ["rsl", 8], ["trinity", 0], ["trinity", 4], ["trinity", 8]]) {
    await page.evaluate(([s, g]) => window.__shell.setExam(s, g), [sys, g]); await page.waitForTimeout(250);
    for (const p of ["tech", "sight", "ear"]) {
      await sub(p); await audit(page, name, `檢定 ${sys} ${g} ${p}`);
      if (p !== "tech") continue;
      const top = await page.evaluate(() => (document.querySelector(".setup.open") ? null : Math.round(document.getElementById("t-listCard").getBoundingClientRect().top + scrollY)));
      if (top != null && top + 40 > h) report(name, `檢定 ${sys} ${g} 技巧`, `本級要求清單被擠到第一個畫面以下(${top} > ${h - 40})`);
      if (sys === "trinity" && g === 4) await shot("exam-trinity4");
    }
  }
  await sub("tech"); await page.evaluate(() => window.__shell.setExam("rsl", 8)); await page.waitForTimeout(250);
  // S4:依大綱時值的練習型(7、8 級 A 組的最長:十六分七連音、三十二分十連音;4 級 C 組 Flam tap 推估)→ 技巧分頁的目標橫幅 + 鼓譜
  for (const [g, key] of [[8, "rsl-8-A-10"], [7, "rsl-7-A-7"], [4, "rsl-4-C-1"]]) {
    await page.evaluate(g => { window.__shell.setExam("rsl", g); window.__shell.showView("exam", "tech"); }, g); await page.waitForTimeout(300);
    await page.click(`#t-qGroups button.xitem[data-key="${key}"]`); await page.waitForTimeout(900);
    await audit(page, name, "技巧 練習型 " + key);
    if (key === "rsl-8-A-10") await shot("pattern");
    await page.click("#t-targetClose"); await page.waitForTimeout(200);
  }
  await page.evaluate(() => { window.__shell.setExam("rsl", 8); window.__shell.showView("exam", "tech"); }); await page.waitForTimeout(250);
  await page.click('#gradeSeg button[data-v="0"]'); await page.click('#systemSeg button[data-v="trinity"]'); await page.waitForTimeout(300);
  await audit(page, name, "檢定 Trinity 設定展開");
  await sub("sight"); await audit(page, name, "檢定 視奏");
  await sub("ear"); await audit(page, name, "檢定 聽力");
  // 技巧:四大類,選擇器展開;最長的打法(40 三 Ratamacue × 8)
  await tab("tech");
  for (const c of ["roll", "diddle", "flam", "drag"]) { await sub(c); await audit(page, name, "技巧 " + c); }
  await shot("drag");
  await expand("#t-picker"); await page.waitForTimeout(200);
  await page.click('#t-picker .opt[data-v="40"]'); await page.waitForTimeout(500);
  await page.click('#t-picker .opts[data-k="reps"] .opt[data-v="8"]'); await page.waitForTimeout(600);
  await audit(page, name, "技巧 選擇器展開 40×8"); await shot("picker");
  await sub("roll"); await page.click('#t-picker .opt[data-v="12"]').catch(() => {}); await page.waitForTimeout(400);
  await audit(page, name, "技巧 12 左手先選項");
  // 手機橫式技巧播放中(land-play):樂譜卡貼到頂欄下、譜面放大到滿版;停止後收回
  if (w > h && h <= 500) {
    await sub("flam"); await page.waitForFunction(() => window.__tech.state.noteXs > 0);
    await page.click("#t-playBtn");
    await page.waitForFunction(() => window.__tech.state.play && document.body.classList.contains("land-play"), null, { timeout: 30000 });
    await page.waitForTimeout(900);
    await audit(page, name, "技巧 手機橫式播放中"); await shot("land-play");
    await page.click("#t-playBtn"); await page.waitForTimeout(600);
    if (await page.evaluate(() => document.body.classList.contains("land-play"))) report(name, "技巧 手機橫式播放中", "停止後 land-play 沒有拿掉");
  }
  await tab("sight"); await audit(page, name, "視奏"); await tab("ear"); await audit(page, name, "聽力");
  // S8 + S9 + S10/S11 視奏:RSL Debut、3(小鼓)、4、5(整組鼓)、Trinity 0、4、8(Playback 看譜)× 題目 / 準備中 / 作答中 / 結果 / 正確版本;
  // RSL 6 級(Quick Study Piece 說明卡 + 「用 5 級參數練讀譜」)
  const sightReady = () => page.waitForFunction(() => window.__sight.state.drawn > 0 && !window.__sight.state.pending && window.__sight.state.loading == null && !document.querySelector("#s-score[aria-busy]"), null, { timeout: 60000 }).then(() => page.waitForTimeout(400));
  const sClick = id => page.evaluate(id => document.getElementById(id).click(), id);
  for (const [sys, g] of [["rsl", 0], ["rsl", 3], ["rsl", 4], ["rsl", 5], ["trinity", 0], ["trinity", 4], ["trinity", 8]]) {
    const at = `視奏 ${sys} ${g}`;
    await page.evaluate(([s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("sight", String(g)); }, [sys, g]); await sightReady();
    await audit(page, name, at);
    if (g === 4 || g === 8) await shot(`sight-${sys}${g}`);
    const lanes = await page.evaluate(() => window.__sight.state.lanes);
    if (lanes !== (sys === "rsl" && g <= 3 ? 1 : 3)) report(name, at, `鼓墊 ${lanes} 個`);
    if (!(await page.evaluate(() => document.querySelectorAll("#s-legend .kl-cell").length))) report(name, at, "沒有圖例");
    await sClick("s-prepare"); await page.waitForTimeout(700);
    await audit(page, name, `${at} 準備中`); if (g === 3) await shot("sight-prep");
    await sClick("s-prepare"); await page.waitForTimeout(200);
    await page.evaluate(() => window.__sight.setBpm(240));
    await sClick("s-playAlong");
    await page.waitForFunction(() => window.__sight.state.phase === "perform", null, { timeout: 20000 }); await page.waitForTimeout(1200);
    for (let k = 0; k < 4; k++) { await page.keyboard.press("j"); await page.waitForTimeout(150); }
    await audit(page, name, `${at} 作答中`);
    if (sys === "trinity") await page.evaluate(() => window.__sight.finishNow());
    await page.waitForFunction(() => window.__sight.state.phase === "result", null, { timeout: 30000 }); await page.waitForTimeout(300);
    await audit(page, name, `${at} 結果`); if (g === 3 || g === 4) await shot(`sight-result-${sys}${g}`);
    await sClick("s-play"); await page.waitForFunction(() => window.__sight.state.kind === "listen", null, { timeout: 20000 }); await page.waitForTimeout(600);
    await audit(page, name, `${at} 正確版本`);
    await sClick("s-play"); await page.waitForTimeout(200);
    await page.evaluate(() => window.__sight.setBpm(window.__sight.test.bpm));
  }
  await page.evaluate(() => { window.__shell.setExam("rsl", 6); window.__shell.showView("sight", "6"); }); await page.waitForTimeout(400);
  await audit(page, name, "視奏 rsl 6 說明卡"); await shot("sight-rsl6");
  if (!(await page.evaluate(() => !!document.querySelector("#s-specCards .s-go")))) report(name, "視奏 rsl 6 說明卡", "沒有「用 5 級整組鼓參數練讀譜」");
  // S12 / S13 聽力:RSL 0/4/8 × Fill(題目 / 聽題目 / 練習 / 回打中 / 選譜 / 結果)、Groove(題目 / 回打中 / 結果);
  //   Trinity 0/4/8 Playback(題目 / 看譜 / 第一次 / 兩次之間 / 結果 / 聽整份);不適用的題型說明卡;鼓墊至少 80×96
  const eGo = async (sys, g, t) => {
    await page.evaluate(([s, g, t]) => { window.__shell.setExam(s, g); window.__shell.showView("ear", t); }, [sys, g, t]);
    await page.waitForFunction(k => window.__ear.state.key === k && !window.__ear.state.pending, `${sys}-${g}-${t}`, { timeout: 20000 }); await page.waitForTimeout(600);
  };
  const eDo = (fn, arg) => page.evaluate(([f, a]) => window.__ear[f](a), [fn, arg]);
  const eKind = k => page.waitForFunction(k => window.__ear.state.kind === k, k, { timeout: 120000 }).then(() => page.waitForTimeout(700));
  const ePads = async st => {
    const bad = await page.evaluate(() => [...document.querySelectorAll("#e-pads .tap-pad")].filter(b => b.getBoundingClientRect().width < 79.5 || b.getBoundingClientRect().height < 95.5).map(b => `${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`));
    if (bad.length) report(name, st, `鼓墊太小:${bad.join(", ")}`);
  };
  for (const g of [0, 4, 8]) {
    await eGo("rsl", g, "fill"); await audit(page, name, `聽力 rsl ${g} fill`); await ePads(`聽力 rsl ${g} fill`);
    await eDo("listen"); await eKind("listen"); await audit(page, name, `聽力 rsl ${g} fill 聽題目`);
    await eDo("finishNow"); await page.waitForTimeout(300); await audit(page, name, `聽力 rsl ${g} fill 練習`);
    await eDo("perform"); await eKind("perform");
    for (let k = 0; k < 3; k++) { await page.keyboard.press("j"); await page.waitForTimeout(120); }
    await audit(page, name, `聽力 rsl ${g} fill 回打中`);
    await eDo("finishNow"); await page.waitForFunction(() => window.__ear.state.optsDrawn === window.__ear.state.options, null, { timeout: 20000 }); await page.waitForTimeout(500);
    await audit(page, name, `聽力 rsl ${g} fill 選譜`); if (g === 4) await shot("ear-fill-choose");
    await eDo("choose", 0); await page.waitForTimeout(1200);
    await audit(page, name, `聽力 rsl ${g} fill 結果`); if (g === 4) await shot("ear-fill-result");
    await eGo("rsl", g, "groove"); await audit(page, name, `聽力 rsl ${g} groove`); await ePads(`聽力 rsl ${g} groove`);
    await eDo("listen"); await eKind("listen"); await eDo("finishNow");
    await eDo("perform"); await eKind("perform");
    for (const k of ["f", "j", "k"]) { await page.keyboard.press(k); await page.waitForTimeout(120); }
    await audit(page, name, `聽力 rsl ${g} groove 回打中`);
    await eDo("finishNow"); await page.waitForTimeout(1200);
    await audit(page, name, `聽力 rsl ${g} groove 結果`); if (g === 8) await shot("ear-groove-result");
  }
  for (const g of [0, 4, 8]) {
    await eGo("trinity", g, "playback"); await audit(page, name, `聽力 trinity ${g}`); await ePads(`聽力 trinity ${g}`);
    await eDo("study"); await page.waitForTimeout(600); await audit(page, name, `聽力 trinity ${g} 看譜`);
    await eDo("study");
    await eDo("perform"); await eKind("pass"); await audit(page, name, `聽力 trinity ${g} 第一次`);
    await eDo("finishNow"); await page.waitForTimeout(300); await audit(page, name, `聽力 trinity ${g} 兩次之間`);
    await eDo("perform"); await eKind("pass");
    for (const k of ["f", "j", "k"]) { await page.keyboard.press(k); await page.waitForTimeout(120); }
    await eDo("finishNow"); await page.waitForTimeout(400); await audit(page, name, `聽力 trinity ${g} 結果`); if (g === 8) await shot("ear-trinity-result");
    await eDo("listen"); await eKind("listen"); await audit(page, name, `聽力 trinity ${g} 聽整份`);
    await eDo("listen"); await page.waitForTimeout(200);
  }
  for (const [sys, t] of [["rsl", "playback"], ["trinity", "fill"]]) {
    await page.evaluate(([s, t]) => { window.__shell.setExam(s, 3); window.__shell.showView("ear", t); }, [sys, t]); await page.waitForTimeout(500);
    await audit(page, name, `聽力 ${sys} ${t} 說明卡`);
  }
  // 聽力的譜卡:到檢定頁、不適用的題型(說明卡)再回來,同一題的譜還在(Trinity 一直有譜;RSL 揭曉後有譜)
  {
    const svgOk = () => page.evaluate(() => !document.getElementById("e-scoreCard").hidden && !!document.querySelector("#e-osmd svg"));
    const back = async (sys, t, label) => {
      const key = await page.evaluate(() => window.__ear.state.key);
      for (const [v, s] of [["exam", "ear"], ["ear", sys === "rsl" ? "playback" : "fill"]]) {
        await page.evaluate(([v, s]) => window.__shell.showView(v, s), [v, s]); await page.waitForTimeout(300);
        await page.evaluate(t => window.__shell.showView("ear", t), t);
        await page.waitForFunction(k => window.__ear.state.key === k && !window.__ear.state.pending, key, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(500);
        if (!(await svgOk())) report(name, `聽力 ${label}`, `從${v === "exam" ? "檢定頁" : "說明卡"}回來,譜卡或譜不見了`);
      }
    };
    await eGo("trinity", 4, "playback"); await back("trinity", "playback", "trinity 4 回來");
    await eGo("rsl", 3, "fill"); await eDo("reveal"); await page.waitForTimeout(800); await back("rsl", "fill", "rsl 3 fill 揭曉後回來");
  }
  const MOCK_SHOTS = { "模擬考 技巧 進行中": "mock-tech", "模擬考 視奏 rsl 3 準備中": "mock-sight-prep", "模擬考 視奏 rsl 3 結果": "mock-sight-result", "模擬考 聽力 rsl 結果": "mock-ear-result", "模擬考 技巧 中止": "mock-aborted" };
  await mockTour(page, async st => { await audit(page, name, st); if (MOCK_SHOTS[st]) await shot(MOCK_SHOTS[st]); });
  await page.evaluate(() => window.__shell.setExam("trinity", 8));
  // 英文(字比較長)
  await tab("tech"); await page.click("#langToggle"); await page.waitForTimeout(500);
  await audit(page, name, "英文 技巧"); await shot("english");
  await tab("exam"); await audit(page, name, "英文 檢定");
  // @app-end
  // 動態字級 200%(無障礙;iOS「更大的文字」):根字級 17px → 34px(app.css 的字級代幣是 rem,最多 2 倍),每個分頁看一次:
  // 沒有橫向捲動、元素不超出畫面、按鈕文字不被截斷(題目卡的位置不檢查:字大了本來就會往下)
  await page.evaluate(() => { window.scrollTo(0, 0); document.documentElement.style.fontSize = "34px"; });
  for (const v of ["tech", "sight", "ear", "exam"]) { await tab(v); await page.waitForTimeout(300); await audit(page, name, `字級 200% ${v}`); await shot(`font200-${v}`); }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  for (const e of errors) report(name, "console", e);
  await close();
}
console.log(issues.slice(0, 120).join("\n"));
console.log(bad ? `✗ ${bad} 項問題` : `✓ ${VPS.length} 種尺寸全部通過`);
process.exit(bad ? 1 : 0);
