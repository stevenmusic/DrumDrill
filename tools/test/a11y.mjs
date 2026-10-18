// 無障礙檢查(S16;Playwright,不加 npm 依賴、沒有 axe-core:自己寫的簡單規則):
//  每個分頁 × 主要狀態(技巧四類、視奏 RSL 0 / 4 與 Trinity 4 的題目 / 準備 / 結果、聽力 Fill 選譜 / 結果、Groove、Trinity Playback、檢定三項),檢查
//  1. 看得到的鼓譜(OSMD 的 SVG:#t-osmd、#s-score、#e-osmd、圖例)在 role="img" + aria-label 的容器裡(選項的譜在有 aria-label 的按鈕裡)
//     技巧的說明有打法名稱 + 左右手(R / L);視奏 / 聽力的說明有「N 小節」與拍號;圖例的說明有鼓件名稱;中英文跟著語言換
//  2. 按鈕、連結、輸入都有讀得出來的名稱(文字、aria-label、aria-labelledby、title、<label>)
//  3. 沒有重複的 id;全頁只有一個 aria-live 播報區(#srLive,polite)
//  4. 子項目分段鈕、級數格、選擇器的列 = role="group" + 名稱,按鈕有 aria-pressed;分頁列 tablist / tab(只有一個 aria-selected、只有它 tabindex=0)
//  5. 焦點:沒有 tabindex > 0;Tab 走過的元素都看得到、有焦點框(:focus-visible 的 outline);分頁列 ← → 換分頁
//  6. 對話框(第一次的問題):打開時焦點在裡面、Tab 不跑出去、Esc 關掉、焦點回到分頁列
//  7. 鼓墊的名稱有按鍵;播放 / 準備 / 結果、模擬考結束 / 中止會寫進 #srLive(模擬考:技巧 RSL 3 進行中 / 結果 / 中止也跑 1–4、8)
//  8. 文字對比(深淺兩種主題):一般大小的字 ≥ 4.5:1(大字 ≥ 3:1;停用的按鈕、樂譜紙上的字不算)→ 列出不足的地方
// 用法:node tools/test/a11y.mjs [尺寸,預設 iphone-390](例如 desktop)
import { open } from "./harness.mjs";
const SIZES = { "iphone-390": [390, 844, true], "fold-280": [280, 653, true], desktop: [1440, 900, false], "iphone-land": [844, 390, true] };
const size = process.argv[2] || "iphone-390";
const [W, H, mobile] = SIZES[size] || SIZES["iphone-390"];
let bad = 0; const issues = [], contrast = new Map();
const fail = (st, m) => { bad++; issues.push(`${st}: ${m}`); };

const { page, errors, close } = await open({ viewport: { width: W, height: H }, mobile, hasTouch: mobile });
const ev = (f, a) => page.evaluate(f, a);
const wait = (f, a, t = 60000) => page.waitForFunction(f, a, { timeout: t });

/* 一個畫面的檢查(在頁面裡跑);回傳問題清單與對比的量測 */
async function audit(st, expect = {}){
  const r = await ev(expect => {
    const out = [], low = [];
    const vis = e => { if (!e.isConnected || e.closest("[hidden]")) return false; const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden") return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nameOf = e => {
      const lb = e.getAttribute("aria-labelledby");
      if (lb) return lb.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || "").join(" ").trim();
      if (e.getAttribute("aria-label")) return e.getAttribute("aria-label").trim();
      if (e.id) { const l = document.querySelector(`label[for="${e.id}"]`); if (l && l.textContent.trim()) return l.textContent.trim(); }
      { const l = e.closest && e.closest("label"); if (l && l.textContent.trim()) return l.textContent.trim(); }
      const t = (e.innerText || e.textContent || "").trim();
      return t || (e.getAttribute("title") || "").trim();
    };
    // 1. 鼓譜
    for (const svg of document.querySelectorAll("#t-osmd svg, #s-score svg, #e-osmd svg, .kit-legend svg, .e-paper svg")) {
      if (!vis(svg)) continue;
      const img = svg.closest('[role="img"]'), btn = svg.closest("button[aria-label]");
      if (btn) { if (!/[::]/.test(btn.getAttribute("aria-label")) || !/\d/.test(btn.getAttribute("aria-label"))) out.push(`選項的譜沒有說明:${btn.getAttribute("aria-label")}`); continue; }
      if (!img || !(img.getAttribute("aria-label") || "").trim()) { out.push(`鼓譜沒有 role=img + aria-label:${svg.parentElement.id || svg.parentElement.className}`); continue; }
    }
    const lab = id => { const e = document.getElementById(id); return e && vis(e) && e.getAttribute("role") === "img" ? e.getAttribute("aria-label") || "" : null; };
    const zh = document.documentElement.lang !== "en";
    if (expect.tech) {
      const l = lab("t-osmd");
      if (l == null) out.push("技巧的鼓譜沒有 role=img");
      else {
        if (!/\b[RL]\b/.test(l)) out.push(`技巧的說明沒有左右手:${l.slice(0, 80)}`);
        if (!(zh ? /反覆 \d+ 次/ : /repeat ×\d+/).test(l)) out.push(`技巧的說明沒有反覆次數(${zh ? "中" : "英"}):${l.slice(-40)}`);
        if (expect.tech !== true && !l.includes(expect.tech)) out.push(`技巧的說明沒有「${expect.tech}」:${l.slice(0, 80)}`);
      }
    }
    for (const [id, want] of [["s-score", expect.sight], ["e-osmd", expect.ear]]) {
      if (!want) continue;
      const l = lab(id);
      if (l == null) { out.push(`#${id} 沒有 role=img`); continue; }
      if (!(zh ? /\d+ 小節(小鼓譜|整組鼓譜)/ : /\d+-bar (snare|drum kit) part/).test(l) && !/蓋起來|hidden/.test(l)) out.push(`#${id} 的說明沒有「N 小節…譜」(${zh ? "中" : "英"}):${l.slice(0, 80)}`);
      if (!/\d+\/\d+/.test(l) && !/蓋起來|hidden/.test(l)) out.push(`#${id} 的說明沒有拍號:${l.slice(0, 80)}`);
      if (!(zh ? /第 1 小節/ : /bar 1/).test(l) && !/蓋起來|hidden/.test(l)) out.push(`#${id} 的說明沒有每小節的簡述:${l.slice(0, 80)}`);
    }
    for (const lg of document.querySelectorAll(".kit-legend")) {
      if (!vis(lg) || !lg.querySelector(".kl-cell")) continue;
      const l = lg.getAttribute("aria-label") || "";
      if (lg.getAttribute("role") !== "img" || !(zh ? /^圖例:/ : /^Drum key: /).test(l)) out.push(`圖例沒有說明(${lg.id}):${l}`);
    }
    // 2. 名稱
    for (const e of document.querySelectorAll("button, a[href], input, select, textarea, [role=tab]")) {
      if (!vis(e)) continue;
      if (!nameOf(e)) out.push(`沒有名稱:${e.tagName.toLowerCase()}#${e.id || ""}.${[...e.classList].join(".")}`);
    }
    // 3. 重複 id、aria-live
    const ids = new Map();
    // OSMD 自己產生的 id(每個 OSMD 都有 osmdCanvasPage1、SVG 裡的聲部 id)不算:在 role=img 裡面,不會被參照
    for (const e of document.querySelectorAll("[id]")) if (!e.closest("svg") && !/^osmd(Canvas|Svg)Page\d+$/.test(e.id)) ids.set(e.id, (ids.get(e.id) || 0) + 1);
    for (const [id, n] of ids) if (n > 1) out.push(`重複的 id:${id} ×${n}`);
    const lives = [...document.querySelectorAll("[aria-live]")].filter(e => e.getAttribute("aria-live") !== "off");
    if (lives.length !== 1 || lives[0].id !== "srLive" || lives[0].getAttribute("aria-live") !== "polite") out.push(`aria-live 區應該只有 #srLive(polite),實際 ${lives.map(e => e.id || e.className).join(", ")}`);
    if (document.querySelector('[role=status], [role=alert]')) out.push("有另外的 role=status / alert(會跟 #srLive 重複播報)");
    // 4. 群組與分頁
    for (const g of document.querySelectorAll(".seg, .opts")) {
      if (!vis(g) || !g.querySelector("button")) continue;
      const gl = g.getAttribute("aria-labelledby"), gname = gl ? (document.getElementById(gl) || {}).textContent : g.getAttribute("aria-label");
      if (g.getAttribute("role") !== "group" || !(gname || "").trim()) out.push(`分段鈕沒有 role=group + 名稱:#${g.id || g.dataset.k || g.className}`);
      for (const b of g.querySelectorAll("button")) if (!b.hasAttribute("aria-pressed") && !b.hasAttribute("aria-current")) { out.push(`分段鈕的按鈕沒有 aria-pressed:#${g.id || g.dataset.k} ${b.textContent.trim()}`); break; }
      if (g.querySelectorAll('button[aria-pressed="true"]').length > 1 && g.id !== "s-mockOpts") out.push(`分段鈕有兩個以上 aria-pressed=true:#${g.id || g.dataset.k}`);
    }
    const tl = document.getElementById("tabbar");
    if (tl.getAttribute("role") !== "tablist" || !tl.getAttribute("aria-label")) out.push("分頁列不是有名稱的 tablist");
    const tabs = [...tl.querySelectorAll("[role=tab]")], sel = tabs.filter(t => t.getAttribute("aria-selected") === "true");
    if (tabs.length !== 4 || sel.length !== 1) out.push(`分頁 ${tabs.length} 個、選到 ${sel.length} 個`);
    if (tabs.some(t => (t.tabIndex === 0) !== (t === sel[0]))) out.push("分頁的 tabindex 不對(只有選到的那一個是 0)");
    const panel = document.getElementById(sel[0] && sel[0].getAttribute("aria-controls"));
    if (!panel || panel.getAttribute("role") !== "tabpanel" || panel.getAttribute("aria-labelledby") !== sel[0].id) out.push("分頁的 tabpanel / aria-labelledby 不對");
    // 5. tabindex > 0
    for (const e of document.querySelectorAll("[tabindex]")) if (e.tabIndex > 0) out.push(`tabindex > 0:#${e.id}`);
    // 7. 鼓墊
    for (const p of document.querySelectorAll(".tap-pad")) if (vis(p) && !/[FJK]/.test(p.getAttribute("aria-label") || "")) out.push(`鼓墊的名稱沒有按鍵:${p.getAttribute("aria-label")}`);
    // 8. 對比:每個有字的元素(直接的文字節點),跟它實際的背景(往上找不透明的背景色,半透明的疊上去)比
    const rgba = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    const over = (top, bot) => [0, 1, 2].map(i => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
    const bgOf = e => {
      const layers = [];
      for (let x = e; x; x = x.parentElement) {
        const s = getComputedStyle(x), c = rgba(s.backgroundColor);
        if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
        // 卡片頂端的淡色漸層(--card-tint)也疊上去(最壞的情況)
        if (s.backgroundImage.includes("linear-gradient") && x.classList.contains("card")) { const t = rgba(s.backgroundImage); if (t) layers.push(t); }
      }
      let c = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop() : rgba(getComputedStyle(document.body).backgroundColor);
      while (layers.length) c = over(layers.pop(), c);
      return c;
    };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = c => "#" + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    for (const e of document.querySelectorAll("main *, header *, nav *, .modal *")) {
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!vis(e) || e.closest(".paper, .stage, .kit-legend .kl-note, .e-paper, svg, .sr") || e.closest("button:disabled") || e.closest("[aria-hidden=true]")) continue;
      const s = getComputedStyle(e);
      if (parseFloat(s.opacity) < 1 || e.closest('[style*="opacity"]')) continue;
      const fg = rgba(s.color); if (!fg) continue;
      const bg = bgOf(e), col = fg[3] < 1 ? over(fg, bg) : fg, cr = ratio(col, bg);
      const px = parseFloat(s.fontSize), big = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      if (cr < (big ? 3 : 4.5)) low.push({ fg: hex(col), bg: hex(bg), cr: Math.round(cr * 100) / 100, px, sel: `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.classList.length ? "." + [...e.classList].join(".") : ""}`, text: e.textContent.trim().slice(0, 24) });
    }
    return { out, low };
  }, expect);
  for (const m of [...new Set(r.out)]) fail(st, m);
  for (const x of r.low) { const k = `${x.fg} on ${x.bg}`; if (!contrast.has(k)) contrast.set(k, { ...x, states: new Set() }); contrast.get(k).states.add(st); }
}

/* 焦點順序:從頁首按 Tab 走 n 步:每一步的焦點元素看得到、有焦點框,而且一直往後(不會卡住、不會跳回去) */
async function tabWalk(st, n = 30){
  await ev(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const seen = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    const f = await ev(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      const ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== "none";
      const all = [...document.querySelectorAll("*")];
      return { id: e.id || e.textContent.trim().slice(0, 16) || e.className, idx: all.indexOf(e), w: r.width, h: r.height, ring, vis: !e.closest("[hidden]") && s.visibility !== "hidden" };
    });
    if (!f) break;
    if (!f.vis || !f.w || !f.h) fail(st, `Tab 走到看不到的元素:${f.id}`);
    if (!f.ring) fail(st, `Tab 聚焦時沒有焦點框:${f.id}`);
    seen.push(f);
  }
  if (seen.length < 5) fail(st, `Tab 只走到 ${seen.length} 個元素`);
  // 往後走:允許從頁尾回到頂欄一次(分頁列在 DOM 的後面)
  let backs = 0;
  for (let i = 1; i < seen.length; i++) if (seen[i].idx <= seen[i - 1].idx) backs++;
  if (backs > 1) fail(st, `焦點順序跳來跳去(往回 ${backs} 次):${seen.map(s => s.id).join(" → ")}`);
  await ev(() => document.activeElement && document.activeElement.blur());
}

// ── 6. 第一次打開:對話框 ──
await ev(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); });
await page.reload(); await wait(() => window.__stageReady >= 1);
await page.waitForTimeout(300);
{
  const st = "對話框";
  const inDlg = () => ev(() => !!document.activeElement.closest("#onboard, .header-right"));   // 頂欄右邊的主題 / 語言鈕在對話框上面,也在焦點循環裡
  if (!(await ev(() => !!document.activeElement.closest("#onboard")))) fail(st, "打開時焦點不在對話框裡");
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); if (!(await inDlg())) { fail(st, `Tab 第 ${i + 1} 下跑出對話框`); break; } }
  await page.keyboard.press("Shift+Tab"); if (!(await inDlg())) fail(st, "Shift+Tab 跑出對話框");
  if (!(await ev(() => document.querySelector("main").inert))) fail(st, "對話框打開時背景不是 inert");
  await audit(st);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const after = await ev(() => ({ open: !document.getElementById("onboard").hidden, focus: document.activeElement.closest("#tabbar") ? document.activeElement.dataset.view : document.activeElement.id, inert: document.querySelector("main").inert, view: window.__shell.S.view }));
  if (after.open) fail(st, "Esc 沒有關掉對話框");
  if (after.inert) fail(st, "關掉後背景還是 inert");
  if (after.focus !== "tech") fail(st, `關掉後焦點應該回到分頁列(技巧),實際 ${after.focus}`);
}

// ── 技巧:四類;換語言;分頁列的方向鍵 ──
const techReady = () => wait(() => window.__tech.state.noteXs > 0, null, 30000).then(() => page.waitForTimeout(200));
for (const c of ["roll", "diddle", "flam", "drag"]) {
  await ev(c => window.__shell.showView("tech", c), c); await techReady();
  await audit(`技巧 ${c}`, { tech: c === "flam" ? "Flam" : c === "drag" ? "Drag" : true });
}
{
  await ev(() => window.__tech.setRudiment(6)); await techReady();
  const l = await ev(() => document.getElementById("t-osmd").getAttribute("aria-label"));
  if (!/^6\. 雙擊開放滾奏:滾奏:R R L L R R L L/.test(l)) fail("技巧 #6", `說明應該是「6. 雙擊開放滾奏:滾奏:R R L L …」,實際 ${l.slice(0, 60)}`);
  await page.click("#langToggle"); await page.waitForTimeout(400);
  const en = await ev(() => document.getElementById("t-osmd").getAttribute("aria-label"));
  if (!/^6\. Double Stroke Open Roll: roll: R R L L/.test(en) || !/repeat ×\d/.test(en)) fail("技巧 #6 英文", `換英文後說明沒有跟著換:${en.slice(0, 60)}`);
  await audit("技巧 英文", { tech: true });
  await page.click("#langToggle"); await page.waitForTimeout(400);
  // 播放:#srLive 寫「開始播放示範」,停止寫「停止了」
  await ev(() => document.getElementById("t-playBtn").click());
  await wait(() => window.__tech.state.play, null, 30000); await page.waitForTimeout(200);
  if (!/開始/.test(await ev(() => document.getElementById("srLive").textContent))) fail("技巧 播放", "#srLive 沒有寫開始播放");
  await ev(() => document.getElementById("t-playBtn").click()); await page.waitForTimeout(200);
  if (!/停止/.test(await ev(() => document.getElementById("srLive").textContent))) fail("技巧 停止", "#srLive 沒有寫停止");
  await tabWalk("技巧 Tab");
  // 分頁列:聚焦在選到的分頁,→ 換到視奏
  await ev(() => document.querySelector('#tabbar [aria-selected="true"]').focus());
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
  const t = await ev(() => ({ view: window.__shell.S.view, focus: document.activeElement.dataset.view }));
  if (t.view !== "sight" || t.focus !== "sight") fail("分頁列 →", `應該換到視奏並聚焦,實際 ${t.view} / ${t.focus}`);
  await page.keyboard.press("End"); await page.waitForTimeout(300);
  if ((await ev(() => window.__shell.S.view)) !== "exam") fail("分頁列 End", "沒有換到檢定");
  // 鍵盤聚焦在按鈕上按空白鍵 = 按那個按鈕(不轉給模組的播放)
  await ev(() => window.__shell.showView("tech", "roll")); await techReady();
  await ev(() => document.getElementById("t-optLoop").focus());
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");   // 用鍵盤聚焦(:focus-visible)
  const before = await ev(() => document.getElementById("t-optLoop").getAttribute("aria-pressed"));
  await page.keyboard.press("Space"); await page.waitForTimeout(300);
  const after = await ev(() => ({ p: document.getElementById("t-optLoop").getAttribute("aria-pressed"), play: window.__tech.state.play || window.__tech.state.starting }));
  if (after.p === before || after.play) fail("技巧 鍵盤", `聚焦在「循環播放」按空白鍵:應該切換它、不播放(aria-pressed ${before} → ${after.p},播放 ${after.play})`);
  if (after.p !== before) await ev(() => document.getElementById("t-optLoop").click());
}

// ── 視奏:RSL Debut(小鼓)、RSL 4(整組鼓)、Trinity 4(Playback)× 題目 / 準備 / 結果 ──
const sightReady = () => wait(() => window.__sight.state.drawn > 0 && !window.__sight.state.pending && window.__sight.state.loading == null && !document.querySelector("#s-score[aria-busy]")).then(() => page.waitForTimeout(400));
for (const [sys, g] of [["rsl", 0], ["rsl", 4], ["trinity", 4]]) {
  const at = `視奏 ${sys} ${g}`;
  await ev(([s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("sight", String(g)); }, [sys, g]); await sightReady();
  await audit(at, { sight: true });
  await ev(() => document.getElementById("s-prepare").click()); await page.waitForTimeout(300);
  const live = await ev(() => document.getElementById("srLive").textContent);
  if (!/秒/.test(live)) fail(`${at} 準備`, `#srLive 沒有寫準備開始(幾秒):${live}`);
  await audit(`${at} 準備中`, { sight: true });
  await ev(() => document.getElementById("s-prepare").click()); await page.waitForTimeout(200);
  await ev(() => window.__sight.setBpm(240));
  await ev(() => document.getElementById("s-playAlong").click());
  await wait(() => window.__sight.state.phase === "perform", null, 20000); await page.waitForTimeout(800);
  for (let k = 0; k < 3; k++) { await page.keyboard.press("j"); await page.waitForTimeout(120); }
  await ev(() => window.__sight.finishNow());
  await wait(() => window.__sight.state.phase === "result", null, 30000); await page.waitForTimeout(300);
  const res = await ev(() => document.getElementById("srLive").textContent);
  if (!/打完了/.test(res) || !/命中|沒有收到/.test(res)) fail(`${at} 結果`, `#srLive 沒有結果摘要:${res}`);
  await audit(`${at} 結果`, { sight: true });
  await ev(() => window.__sight.setBpm(window.__sight.test.bpm));
}
await tabWalk("視奏 Tab");

// ── 聽力:RSL 4 Fill(揭曉、選項)、Groove、Trinity 4 Playback ──
const eGo = async (sys, g, t) => {
  await ev(([s, g, t]) => { window.__shell.setExam(s, g); window.__shell.showView("ear", t); }, [sys, g, t]);
  await wait(k => window.__ear.state.key === k && !window.__ear.state.pending, `${sys}-${g}-${t}`, 20000); await page.waitForTimeout(500);
};
await eGo("rsl", 4, "fill");
await audit("聽力 rsl fill");
await ev(() => window.__ear.perform()); await wait(() => window.__ear.state.kind === "perform", null, 60000); await page.waitForTimeout(400);
if (!/回打/.test(await ev(() => document.getElementById("srLive").textContent))) fail("聽力 回打", "#srLive 沒有寫回打開始");
await ev(() => window.__ear.finishNow());
await wait(() => window.__ear.state.optsDrawn === window.__ear.state.options && window.__ear.state.options > 0, null, 20000); await page.waitForTimeout(500);
await audit("聽力 rsl fill 選譜");
{
  const l = await ev(() => [...document.querySelectorAll("#e-answers .e-opt")].map(b => b.getAttribute("aria-label")));
  if (!l.length || l.some((x, i) => !x.startsWith(`選項 ${"ABC"[i]}`) || !/第 1 小節/.test(x))) fail("聽力 選項", `選項的名稱應該是「選項 A:…第 1 小節…」:${l.join(" | ").slice(0, 160)}`);
}
await ev(() => window.__ear.choose(0)); await page.waitForTimeout(1200);
await audit("聽力 rsl fill 結果", { ear: true });
await eGo("rsl", 4, "groove");
await ev(() => window.__ear.reveal()); await page.waitForTimeout(1200);
await audit("聽力 rsl groove 揭曉", { ear: true });
await eGo("trinity", 4, "playback"); await page.waitForTimeout(600);
await audit("聽力 trinity playback", { ear: true });
await ev(() => window.__ear.study()); await page.waitForTimeout(300);
if (!/30/.test(await ev(() => document.getElementById("srLive").textContent))) fail("聽力 看譜", "#srLive 沒有寫看譜 30 秒");
await ev(() => window.__ear.study());
await tabWalk("聽力 Tab");

// ── 檢定:三項 ──
for (const p of ["tech", "sight", "ear"]) { await ev(p => window.__shell.showView("exam", p), p); await page.waitForTimeout(500); await audit(`檢定 ${p}`); }
await tabWalk("檢定 Tab");

// ── 模擬考(技巧 RSL 3):進行中 / 結果 / 中止的畫面;結束與中止寫進 #srLive ──
{
  await ev(() => { window.__shell.setExam("rsl", 3); window.__shell.showView("exam", "tech"); }); await page.waitForTimeout(400);
  await ev(() => document.getElementById("t-mockBtn").click()); await page.waitForTimeout(700);
  await audit("模擬考 進行中");
  await ev(() => window.__tech.mockFinishRun());
  for (let i = 0; i < 8 && (await ev(() => window.__tech.state.mock)) === "run"; i++) { await ev(() => window.__tech.mockNext()); await page.waitForTimeout(200); }
  await page.waitForTimeout(300);
  if (!/模擬考結束/.test(await ev(() => document.getElementById("srLive").textContent))) fail("模擬考 結果", "#srLive 沒有寫模擬考結束");
  await audit("模擬考 結果");
  await ev(() => document.getElementById("t-mockBtn").click()); await page.waitForTimeout(300);
  await ev(() => window.__shell.showView("tech")); await page.waitForTimeout(300);
  if (!/模擬考已中止/.test(await ev(() => document.getElementById("srLive").textContent))) fail("模擬考 中止", "#srLive 沒有寫模擬考已中止");
  await ev(() => window.__shell.showView("exam", "tech")); await page.waitForTimeout(400);
  await audit("模擬考 中止");
  await ev(() => document.getElementById("t-mockClose").click()); await page.waitForTimeout(200);
}

// ── 淺色主題:對比 ──
await ev(() => window.__shell.showView("tech", "flam")); await techReady();
await page.click("#themeToggle"); await page.waitForTimeout(300);
await audit("淺色 技巧", { tech: true });
await ev(() => window.__shell.showView("exam", "tech")); await page.waitForTimeout(400); await audit("淺色 檢定");
await eGo("rsl", 4, "fill"); await audit("淺色 聽力");
await ev(() => { window.__shell.setExam("rsl", 4); window.__shell.showView("sight", "4"); }); await sightReady(); await audit("淺色 視奏", { sight: true });
await page.click("#themeToggle"); await page.waitForTimeout(200);

for (const e of errors) fail("console", e);
await close();
if (contrast.size) {
  console.log("對比不足(一般字 < 4.5:1、大字 < 3:1):");
  for (const [k, x] of contrast) console.log(`  ${k} = ${x.cr}:1 · ${x.px}px · ${x.sel}「${x.text}」· ${[...x.states].slice(0, 3).join("、")}`);
  bad += contrast.size;
}
console.log(issues.slice(0, 80).join("\n"));
console.log(bad ? `✗ ${bad} 項問題(${size})` : `✓ 無障礙檢查全部通過(${size})`);
process.exit(bad ? 1 : 0);
