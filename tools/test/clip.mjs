// 字被切掉檢查:overflow 不是 visible 的元素裡,文字實際的字框(含 g j p y 的下伸部、上方重音)超出元素可見範圍就列出來。
// 各尺寸 × 各分頁 × 中英文。用法:node tools/test/clip.mjs [尺寸名稱]
// PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):檢查函式一模一樣,畫面狀態腳本放在 @app 區段
import { open } from "./harness.mjs";
const ALL = [["se1-320", 320, 568, true], ["iphone-390", 390, 844, true], ["promax-430", 430, 932, true], ["iphone-land", 844, 390, true],
  ["ipad", 820, 1180, true], ["ipad-land", 1180, 820, true], ["laptop", 1280, 800, false], ["fhd", 1920, 1080, false]];
const only = process.argv[2];
const scan = page => page.evaluate(() => {
  const out = [];
  const clipBox = el => {   // 元素實際會切掉內容的範圍(往上找所有 overflow 不是 visible 的祖先,取交集)
    let r = { t: -1e9, b: 1e9, l: -1e9, r: 1e9 };
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowY !== "visible" || s.overflowX !== "visible") {
        if (s.overflowY === "auto" || s.overflowY === "scroll") continue;   // 會捲的不算切掉
        const b = e.getBoundingClientRect();
        r = { t: Math.max(r.t, b.top), b: Math.min(r.b, b.bottom), l: Math.max(r.l, b.left), r: Math.min(r.r, b.right) };
      }
    }
    return r;
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement, s = getComputedStyle(el);
    if (s.visibility === "hidden" || el.closest("[hidden]") || el.closest("svg") || el.closest(".stage") || el.closest("#t-osmd")) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rects = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const c = clipBox(el);
    if (c.b <= c.t || c.r <= c.l) continue;   // 整個被藏起來(收合)
    for (const r of rects) {
      if (r.bottom <= c.t || r.top >= c.b) continue;   // 整行在可見範圍外(捲動清單的其他列)
      const cutB = r.bottom - c.b, cutT = c.t - r.top;
      if (cutB > 1.5 || cutT > 1.5) { out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${[...el.classList].join(".")} 「${n.textContent.trim().slice(0, 30)}」 ${cutB > 1.5 ? "下面切掉 " + cutB.toFixed(1) : "上面切掉 " + cutT.toFixed(1)}px`); break; }
    }
  }
  return out;
});
// @app-begin
const APP = "drumdrill";
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
const START = { onboarded: true, view: "tech", exam: { system: "rsl", grade: 5 } };
// 子項目 "" = 這一頁沒有子項目
// 視奏:子項目 = 級數(Debut、3 級有題目;6 級是說明卡);more() 再看準備中 / 結果 / 正確版本與 Trinity 的說明卡
const VIEWS = [["tech", ["roll", "diddle", "flam", "drag"]], ["sight", ["0", "3", "4", "6"]], ["ear", ["fill", "groove", "playback"]], ["exam", ["tech", "sight", "ear"]]];
// 聽力:子項目 = 題型(START 是 RSL 5 級:Fill、Groove 有題目,Playback 是說明卡);more() 再看 Fill 的選譜 / 結果、Groove 結果、Trinity 4 級 Playback 的看譜 / 結果
// 同一個畫面再多看幾種內容:技巧每一類的每個打法(不同長度、g j p y 的名稱)
async function more(page, view, s, report){
  // 檢定頁:RSL 0/3/8、Trinity 0/4/8(最後回到 START 的考試)
  if (view === "exam") {
    for (const [sys, g] of [["rsl", 0], ["rsl", 3], ["rsl", 8], ["trinity", 0], ["trinity", 4], ["trinity", 8]]) {
      await page.evaluate(([s, g]) => window.__shell.setExam(s, g), [sys, g]); await page.waitForTimeout(300);
      await report(`${view}/${s} ${sys} ${g}`);
    }
    if (s === "ear") { await mockTour(page, report); await page.evaluate(() => window.__shell.showView("exam", "ear")); }   // S14 模擬考(最後一個子項目時看一次)
    await page.evaluate(ex => window.__shell.setExam(ex.system, ex.grade), START.exam);
    return;
  }
  if (view === "sight") {
    const click = id => page.evaluate(id => document.getElementById(id).click(), id);
    const ready = () => page.waitForFunction(() => window.__sight.state.drawn > 0 && !window.__sight.state.pending && window.__sight.state.loading == null, null, { timeout: 60000 }).catch(() => {});
    const states = async (label, playback) => {
      await ready();
      await click("s-prepare"); await page.waitForTimeout(500); await report(`${label} 準備中`);
      await click("s-prepare"); await page.waitForTimeout(200);
      await page.evaluate(() => window.__sight.setBpm(240));
      await click("s-playAlong"); await page.waitForFunction(() => window.__sight.state.phase === "perform", null, { timeout: 20000 });
      for (let k = 0; k < 3; k++) { await page.keyboard.press("j"); await page.waitForTimeout(300); }
      if (playback) await page.evaluate(() => window.__sight.finishNow());
      await page.waitForFunction(() => window.__sight.state.phase === "result", null, { timeout: 30000 }); await page.waitForTimeout(300);
      await report(`${label} 結果`);
      await click("s-play"); await page.waitForTimeout(600); await report(`${label} 正確版本`);
      await click("s-play"); await page.evaluate(() => window.__sight.setBpm(window.__sight.test.bpm));
    };
    if (s === "6") {   // Trinity 0、4、8 級:Playback 看譜練習(最後回到 START 的考試)
      for (const g of [0, 4, 8]) {
        await page.evaluate(g => { window.__shell.setExam("trinity", g); window.__shell.showView("sight", String(g)); }, g); await page.waitForTimeout(500);
        await ready(); await report(`${view} trinity ${g}`);
        await states(`${view} trinity ${g}`, true);
      }
      await page.evaluate(ex => { window.__shell.setExam(ex.system, ex.grade); window.__shell.showView("sight", "6"); }, START.exam); await page.waitForTimeout(300);
      return;
    }
    await states(`${view}/${s}`, false);
    return;
  }
  if (view === "ear") {
    const eDo = (fn, arg) => page.evaluate(([f, a]) => window.__ear[f](a), [fn, arg]);
    const eKind = k => page.waitForFunction(k => window.__ear.state.kind === k, k, { timeout: 120000 });
    if (s === "playback") {   // RSL 沒有 Playback(說明卡已經看過)→ Trinity 4 級(最後回到 START 的考試)
      await page.evaluate(() => { window.__shell.setExam("trinity", 4); window.__shell.showView("ear", "playback"); });
      await page.waitForFunction(() => window.__ear.state.key === "trinity-4-playback", null, { timeout: 20000 }); await page.waitForTimeout(800);
      await report(`${view} trinity 4`);
      await eDo("study"); await page.waitForTimeout(400); await report(`${view} trinity 4 看譜`); await eDo("study");
      await eDo("perform"); await eKind("pass"); await eDo("finishNow"); await eDo("perform"); await eKind("pass");
      await page.keyboard.press("j"); await eDo("finishNow"); await page.waitForTimeout(400);
      await report(`${view} trinity 4 結果`);
      await page.evaluate(ex => { window.__shell.setExam(ex.system, ex.grade); window.__shell.showView("ear", "playback"); }, START.exam); await page.waitForTimeout(300);
      return;
    }
    await page.waitForFunction(() => window.__ear.state.key && !window.__ear.state.pending, null, { timeout: 20000 }).catch(() => {});
    await eDo("listen"); await eKind("listen"); await eDo("finishNow");
    await eDo("perform"); await eKind("perform"); await page.keyboard.press(s === "fill" ? "j" : "k"); await eDo("finishNow");
    if (s === "fill") { await page.waitForFunction(() => window.__ear.state.optsDrawn === window.__ear.state.options, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400); await report(`${view}/${s} 選譜`); await eDo("choose", 0); }
    await page.waitForTimeout(1200); await report(`${view}/${s} 結果`);
    return;
  }
  if (view !== "tech") return;
  const nos = await page.evaluate(() => [...document.querySelectorAll('#t-picker .opts[data-k="no"] .opt')].map(b => Number(b.dataset.v)));
  for (const no of nos) {
    const b = await page.evaluate(() => window.__scoreReady || 0);
    await page.evaluate(no => window.__tech.setRudiment(no), no);
    await page.waitForFunction(b => (window.__scoreReady || 0) > b, b, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(100);
    await report(`${view}/${s} #${no}`);
  }
}
// @app-end
let bad = 0;
for (const [name, w, h, mobile] of ALL.filter(v => !only || v[0] === only)) {
  const { page, close } = await open({ viewport: { width: w, height: h }, mobile });
  for (const lang of ["en", "zh"]) {
    await page.evaluate(([l, k, ls, st]) => { localStorage.clear(); localStorage.setItem(k, l); localStorage.setItem(ls, JSON.stringify(st)); }, [lang, APP + "-lang", APP + ".v1", START]);
    await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1); await page.waitForTimeout(800);
    const seen = new Set();
    const report = async state => { for (const x of await scan(page)) { if (seen.has(x)) continue; seen.add(x); console.log(`${name} ${lang} ${state}: ${x}`); bad++; } };
    for (const [view, subs] of VIEWS) {
      await page.click(`#tabbar button[data-view="${view}"]`); await page.waitForTimeout(500);
      for (const s of subs) {
        if (s) await page.click(`#subSeg button[data-v="${s}"]`).catch(() => {});
        await page.waitForTimeout(view === "sight" ? 1500 : 600);
        await report(`${view}/${s}`);
        await more(page, view, s, report);
      }
    }
  }
  await close();
}
console.log(bad ? `✗ ${bad} 處文字被切掉` : "✓ 沒有文字被切掉");
process.exit(bad ? 1 : 0);
