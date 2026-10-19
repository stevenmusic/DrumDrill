// 任務腳本(兩個 App 同一份,@app-begin … @app-end 放各自的任務;tools/test/sync.json markers):
// 模擬真人從打開 App 開始完成幾個任務,記錄每個任務「要點幾下才開始練」、要不要捲動、要點的東西在不在畫面上、
// 有沒有點到收起來的卡片裡、有沒有下拉選單、點擊區域夠不夠大(≥ 28×28),最後一步之後的畫面有沒有告訴使用者下一步。
// 目標:≤ 3 下就開始練、開始練之前不用捲動找按鈕、沒有下拉選單、沒有收合卡。超過就印 ✗(結束碼 1)。開始練以後的捲動記在「注意」。
// 第一個畫面:開始練的那一下之後(還沒捲動),task.first 列的東西(子項目列、題目譜框、作答區、最常用的設定)都要整個在畫面裡(頂欄下、分頁列上);
//   soft: true 的(「盡量」看得到,例如音域那行)不在畫面裡只記注意。step.common = 常用設定:開始以後點它也不能要捲動(不常用的設定開始後捲動只記注意)。
// 用法:node tools/test/tasks.mjs [尺寸,…](預設 iphone-390、fold-280、iphone-land、ipad、desktop);TASK=關鍵字 只跑名稱含關鍵字的任務
import { open } from "./harness.mjs";

const SIZES = {
  "iphone-390": { viewport: { width: 390, height: 844 }, mobile: true },
  "fold-280": { viewport: { width: 280, height: 653 }, mobile: true },
  "iphone-land": { viewport: { width: 844, height: 390 }, mobile: true },
  "ipad": { viewport: { width: 820, height: 1180 }, mobile: true },
  "desktop": { viewport: { width: 1400, height: 900 }, mobile: false }
};
const MAX_START = 3;

// @app-begin:各 App 的任務。step = { sel(要點的東西,CSS), say(說明), start(這一步之後就在練了), common(常用設定:要在第一個畫面), wait(點完等幾毫秒), run(不點、做別的,例如等播放結束) }
// first = [{ sel, say, soft }]:開始練的那一刻第一個畫面要看得到的東西
// check(page) → 錯誤訊息或 null(任務完成了沒有);next = 最後的畫面要寫著下一步(選擇器 + 要有的字,中或英)
const APP = "drumdrill";
const LANG_KEY = "drumdrill-lang", SHELL_KEY = "drumdrill.v1";
const onboarded = (o = {}) => ({ [SHELL_KEY]: { onboarded: true, exam: null, theme: "dark", ...o } });
// 認譜的第一個畫面:子項目列、譜框、作答格子、鼓件快捷
const READ_FIRST = [{ sel: "#subSeg", say: "子項目列" }, { sel: "#s-rdScore", say: "譜框" }, { sel: "#s-rdAns", say: "作答格子" }, { sel: "#s-rdQuick", say: "鼓件快捷" }];
const TASKS = [
  { name: "新手想練小鼓節奏", store: null, steps: [
      { sel: "#obNo", say: "第一次的問題:不考,自由練習" },
      { sel: '#tabbar [data-view="sight"]', say: "視奏分頁(預設子項目 = 節奏,題目已經出好)", start: true, wait: 1500 },
      { sel: "#s-performTop", say: "正式打(題目卡上)", wait: 1200 },
      { run: async page => { await page.waitForFunction(() => window.__sight.state.phase === "perform", null, { timeout: 30000 }); await page.evaluate(() => window.__sight.finishNow()); await page.waitForTimeout(400); }, say: "(打完)" }
    ],
    check: async page => page.evaluate(() => (window.__sight.state.phase === "result" && !document.getElementById("s-alongResult").hidden ? null : "沒有結果")),
    next: { sel: "#s-alongResult .diff-fb, #s-message", words: ["新題目", "太簡單", "New test", "Too easy"] } },
  { name: "想練認譜、練到 + Toms(第 2 格)", store: onboarded(), first: READ_FIRST, steps: [
      { sel: '#tabbar [data-view="sight"]', say: "視奏分頁", wait: 800 },
      { sel: '#subSeg [data-v="read"]', say: "認譜(題目馬上出)", wait: 800 },
      { sel: '#s-rdQuick [data-v="toms"]', say: "+ Toms(小鼓 大鼓 HH + Tom 1、Tom 2、落地鼓)", common: true, start: true, wait: 800 },
      { sel: "#s-rdAns .opt", say: "作答一題", wait: 300 }
    ],
    check: async page => page.evaluate(() => { const s = window.__sight.reading.state.setting, t = document.getElementById("s-rdSet").textContent;
      return s === "hh,kick,snare,tomFloor,tomHi,tomMid" && /6 個鼓件|6 drums/.test(t) && document.querySelector('#s-rdQuick [data-v="toms"]').getAttribute("aria-pressed") === "true" ? null : "不是 + Toms:" + s + " / " + t; }),
    next: { sel: "#s-rdMsg, #s-rdSet", words: ["答案", "對了", "Toms", "Right", "It was"] } },
  { name: "考 RSL 2 級的人想練這一級的視奏題", store: onboarded({ exam: { system: "rsl", grade: 2 }, view: "tech" }), steps: [
      { sel: '#tabbar [data-view="exam"]', say: "檢定分頁", wait: 600 },
      { sel: '#subSeg [data-v="sight"]', say: "視奏(子項目列)", wait: 800 },
      { sel: "#s-mockClose", say: "練習這一級(在檢定頁出題)", start: true, wait: 1500 },
      { sel: "#s-prepare", say: "準備 90 秒" }
    ],
    check: async page => page.evaluate(() => (window.__sight.xp && window.__sight.state.key === "rsl-2" && window.__sight.state.phase === "prep" ? null : "沒有出 RSL 2 級的題目:" + JSON.stringify(window.__sight.state.key))),
    next: { sel: "#s-message", words: ["準備", "Prep"] } },
  { name: "沒選考試的人練聽力", store: onboarded(), steps: [
      { sel: '#tabbar [data-view="ear"]', say: "聽力分頁(預設 = 過門,題目已經出好)", wait: 1500 },
      { sel: "#e-playBtn", say: "聽題目", start: true, wait: 600 }
    ],
    check: async page => page.evaluate(() => (window.__ear.state.kind === "listen" || window.__ear.state.listened > 0 ? null : "沒有開始播:" + JSON.stringify(window.__ear.state.kind))),
    next: { sel: "#e-feedback", words: ["聽", "預備", "Listen", "Count"] } }
];
// @app-end

// 第一個看得到的符合元素;在畫面裡(頂欄下、底部分頁列上;手機橫式在左邊分頁列右邊)= 不用捲動。mark = 標記起來給下一步點
async function look(page, sel, mark){
  return page.evaluate(([sel, mark]) => {
    const els = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
    const e = els[0]; if (!e) return null;
    const b = e.getBoundingClientRect(), head = document.querySelector("header"), bar = document.getElementById("tabbar");
    const top = head ? head.getBoundingClientRect().bottom : 0, bb = bar ? bar.getBoundingClientRect() : null;
    const bottom = bb && bb.top > innerHeight / 2 ? bb.top : innerHeight, left = bb && bb.right < innerWidth / 2 && bb.height > innerHeight / 2 ? bb.right : 0;
    // 頂欄、子項目列、分頁列上的按鈕:在畫面裡就算(它們本身就是固定的外框)
    const chrome = e.closest("header, #tabbar, #subnav, .modal, #onboard");
    const inView = chrome ? b.top >= 0 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1
      : b.top >= top - 1 && b.bottom <= bottom + 1 && b.left >= left - 1 && b.right <= innerWidth + 1;
    const fold = e.closest(".setup:not(.open):not(.always-open), .picker:not(.open):not(.always-open)");
    const collapsed = !!fold && getComputedStyle(fold.querySelector(".setup-summary") || fold).display !== "none";
    if (mark) e.setAttribute("data-task-target", "1");
    return { inView, collapsed, w: Math.round(b.width), h: Math.round(b.height) };
  }, [sel, mark]);
}

const only = (process.argv[2] || "").split(",").filter(Boolean);
const sizes = Object.entries(SIZES).filter(([n]) => !only.length || only.includes(n));
const pick = (process.env.TASK || "").trim();
let bad = 0;
const rows = [];
for (const [sname, sz] of sizes) {
  const h = await open({ viewport: sz.viewport, mobile: sz.mobile, dpr: 1 });
  const { page } = h;
  for (const task of TASKS.filter(t => !pick || t.name.includes(pick))) {
    await page.evaluate(([store, lk]) => { localStorage.clear(); localStorage.setItem(lk, "zh"); for (const [k, v] of Object.entries(store || {})) localStorage.setItem(k, JSON.stringify(v)); }, [task.store, LANG_KEY]);
    await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1, null, { timeout: 30000 }); await page.waitForTimeout(800);
    const r = { size: sname, task: task.name, clicks: 0, start: null, scrolls: [], collapsed: [], small: [], notes: [], missing: [], firstMiss: [], fail: null };
    for (const st of task.steps) {
      if (st.run) { try { await st.run(page); } catch (e) { r.fail = `${st.say}:${e.message.split("\n")[0]}`; break; } continue; }
      const info = await look(page, st.sel, true);
      if (!info) { r.missing.push(st.say); r.fail = `找不到「${st.say}」(${st.sel})`; break; }
      // 「不用捲動」指的是開始練之前(第一個畫面就能開始);開始練以後:常用設定(common)也不能要捲動,不常用的捲動只記在注意事項
      if (!info.inView) { if (r.start == null) r.scrolls.push(st.say); else if (st.common) r.scrolls.push(`常用設定「${st.say}」`); else r.notes.push(`開始後捲動到「${st.say}」`); }
      if (info.collapsed) r.collapsed.push(st.say);
      if (info.w < 28 || info.h < 28) { if (st.small) r.notes.push(`${st.say} ${info.w}×${info.h}(${st.small})`); else r.small.push(`${st.say} ${info.w}×${info.h}`); }
      const el = page.locator("[data-task-target='1']").first();
      try { if (sz.mobile) await el.tap({ timeout: 4000 }); else await el.click({ timeout: 4000 }); }
      catch (e) { r.fail = `點不到「${st.say}」:${e.message.split("\n")[0]}`; break; }
      await page.evaluate(() => document.querySelectorAll("[data-task-target]").forEach(e => e.removeAttribute("data-task-target")));
      r.clicks++;
      const starting = st.start && r.start == null;
      if (starting) r.start = r.clicks;
      await page.waitForTimeout(st.wait || 400);
      // 開始練的那一刻(還沒捲動):第一個畫面要有的東西
      if (starting) for (const f of task.first || []) {
        const fi = await look(page, f.sel, false);
        if (fi && fi.inView) continue;
        const why = fi ? `${f.say} 不在第一個畫面` : `第一個畫面找不到 ${f.say}`;
        if (f.soft) r.notes.push(why); else r.firstMiss.push(why);
      }
    }
    if (!r.fail && task.check) r.fail = await task.check(page).catch(e => e.message);
    // 下拉選單:畫面上(目前的分頁)看得到的 <select>
    r.selects = await page.evaluate(() => [...document.querySelectorAll("main select")].filter(e => e.getClientRects().length).length);
    // 結果畫面寫著下一步
    if (!r.fail && task.next) {
      const txt = await page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => e.textContent).join(" "), task.next.sel);
      if (!task.next.words.some(w => txt.includes(w))) r.fail = `最後的畫面沒有寫下一步(${task.next.sel})`;
    }
    const ok = !r.fail && r.start != null && r.start <= MAX_START && !r.scrolls.length && !r.firstMiss.length && !r.collapsed.length && !r.selects && !r.small.length;
    if (!ok) bad++;
    rows.push({ ...r, ok });
    console.log(`${ok ? "✓" : "✗"} ${sname.padEnd(11)} ${task.name}:${r.start ?? "—"} 下開始練(共 ${r.clicks} 下)`
      + (r.scrolls.length ? `;要捲動:${r.scrolls.join("、")}` : "") + (r.firstMiss.length ? `;第一個畫面缺:${r.firstMiss.join("、")}` : "") + (r.collapsed.length ? `;在收起來的卡裡:${r.collapsed.join("、")}` : "")
      + (r.selects ? `;下拉選單 ${r.selects} 個` : "") + (r.small.length ? `;太小:${r.small.join("、")}` : "") + (r.notes.length ? `;注意:${r.notes.join("、")}` : "") + (r.fail ? `;${r.fail}` : ""));
  }
  if (h.errors.length) { bad++; console.log(`✗ ${sname} 頁面錯誤:${h.errors.slice(0, 3).join(" | ")}`); }
  await h.close();
}
console.log(bad ? `✗ ${bad} 個任務沒達標(${APP})` : `✓ 全部任務 ≤ ${MAX_START} 下開始練、不用捲動、第一個畫面有常用設定、沒有下拉與收合卡(${APP})`);
process.exit(bad ? 1 : 0);
