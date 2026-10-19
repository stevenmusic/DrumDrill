// 模擬真人操作:用觸控(手機)或滑鼠(桌機)隨機做各種事,每一步之後檢查狀態一致、沒有錯誤。
//   共用的動作:切分頁、切子項目、改考試系統/級數、檢定三項、展開/收起設定、中英切換、主題、旋轉螢幕、重新整理、捲動、切到背景再回來
//   共用的檢查:沒有 console 錯誤;選到的分頁跟顯示的畫面一致;沒有橫向捲動;localStorage 讀得回來;
//         不在畫面上的模組沒有在播放;切到背景時全部停止、回到前景不會自己開始播
// PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):@app 區段(各 App 模組的動作與檢查)以外一模一樣
// 用法:node human.mjs [步數] [種子]
import { open } from "./harness.mjs";
const STEPS = Number(process.argv[2] || 200), SEED = Number(process.argv[3] || 1);
let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pickOne = a => a[Math.floor(rnd() * a.length)];
let bad = 0; const fail = (m) => { bad++; console.log("✗ " + m); };

// @app-begin
// DrumDrill 技巧:點選擇器、播放/停止(含連點)、按住 ±、熟練標記、播放選項;檢查播放狀態跟按鈕文字一致、
//   鼓譜跟題目一致(左右手字母都在)、速度在 30–240 且跟顯示一致
// DrumDrill 視奏(S8):準備 / 結束準備、正式打 / 停止、聽正確版本、點鼓墊、新題目、速度;「正式打到結果」:♩=240 打完要有練習回饋。
//   檢查:視奏不在畫面上(或在檢定頁)時沒有在播放、準備的倒數停了、不在正式打;按鈕文字跟狀態一致
// DrumDrill 聽力(S12 / S13):聽題目、回打 / 停止、選譜、看答案、看譜 30 秒、點鼓墊、下一題、級數、不看譜;
//   「照節奏回打」:RSL Fill / Groove 照題目的節奏 ± 20 毫秒點鼓墊 → 練習回饋要「準」(≥ 80 / 100、全部命中);Trinity 兩次各快轉一次 → 有每一句的回饋。
//   檢查:聽力不在畫面上(或在檢定頁)時沒有在播放、看譜倒數停了、不在回打;回打按鈕、播放鈕跟狀態一致
// DrumDrill 模擬考(S14):開始、下一步(技巧下一組、視奏 / 聽力的準備時間快轉)、「模擬考中途中止」:進行中切分頁 / 重新整理 / 旋轉 / 切到背景
//   → 不能還在播放、倒數不能還在跑;回到檢定頁要看到「模擬考已中止」。檢查:模擬考進行中時那個模組一定在檢定頁上(其他時候不能在 run)
const APP = "drumdrill", SYSTEMS = ["trinity", "rsl"], STORE_KEYS = ["drumdrill.v1", "drumdrill.tech.v1", "drumdrill.sight.v1", "drumdrill.ear.v1"];
const appActions = ({ page, tap, tapAny }) => [
  [10, "技巧選擇器", async () => tapAny("#t-picker .rows .opt")],
  [8, "技巧 播放/停止", async () => tap("#t-playBtn")],
  [2, "技巧 連點播放", async () => { await tap("#t-playBtn"); await tap("#t-playBtn"); return tap("#t-playBtn"); }],
  [4, "速度 ±", async () => tap(pickOne(["#t-bpmUp", "#t-bpmDown"]))],
  [2, "按住 +", async () => { const el = await page.$("#t-bpmUp"); if (!el || !(await el.isVisible())) return false; const b = await el.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up(); return true; }],
  [3, "熟練/待加強", async () => tapAny("#mod-tech .mbtn")],
  [3, "播放選項", async () => tapAny("#mod-tech .play-opts .chip")],
  // S3:檢定清單 → 練習:跳到技巧分頁的打法編號、速度要等於 data/exam-rsl.json(另外讀一次 JSON 核對)
  // S4:「依大綱時值」練習型(pattern)也一起抽:打法 = 它的 PAS 編號,每一個音的時值 = 大綱寫的,鼓譜下面標「App 練習型」
  [4, "檢定清單→練習", async () => {
    await page.evaluate(g => { const sh = window.__shell; if (sh.S.view !== "exam" || sh.S.sub.exam !== "tech" || !sh.S.exam || sh.S.exam.system !== "rsl") { sh.setExam("rsl", g); sh.showView("exam", "tech"); } }, pickOne([1, 2, 3, 4, 5, 6, 7, 8]));
    await page.waitForTimeout(300);
    const els = []; for (const e of await page.$$('#t-qGroups button.xitem[data-act="pas"], #t-qGroups button.xitem[data-act="pattern"]')) if (await e.isVisible()) els.push(e);
    if (!els.length) return false;
    const e = pickOne(els), key = await e.getAttribute("data-key");
    try { if (page.viewportSize().width < 1000) await e.tap({ timeout: 3000 }); else await e.click({ timeout: 3000 }); } catch (er) { return false; }
    await page.waitForTimeout(500);
    const r = await page.evaluate(async key => {
      const [, g, gid, i] = key.split("-"), d = await (await fetch("data/exam-rsl.json")).json();
      const gr = d.tech[g].groups.find(x => x.id === gid), it = gr.items[Number(i) - 1];
      const T = window.__tech;
      const vals = [...new Set(T.groups.flat().map(n => n.value + (n.tuplet ? "t" + n.tuplet : "")))];
      return { view: window.__shell.S.view, no: T.cur && T.cur.no, bpm: T.state.bpm, wantNo: it.kind === "pattern" ? it.pas : it.no, wantBpm: gr.bpm, banner: !document.getElementById("t-target").hidden,
        pattern: it.kind === "pattern", valOk: it.kind !== "pattern" || (vals.length === 1 && vals[0] === it.value), noteShown: !document.getElementById("t-targetNote").hidden };
    }, key);
    if (r.view !== "tech" || r.no !== r.wantNo || r.bpm !== r.wantBpm || !r.banner || !r.valOk || r.noteShown !== r.pattern) fail(`清單→練習 ${key}:${JSON.stringify(r)}`);
    return true;
  }],
  [1, "離開目標", async () => tap("#t-targetClose")],
  // S8 視奏
  [3, "視奏 準備 / 結束準備", async () => tap("#s-prepare")],
  [3, "視奏 正式打 / 停止", async () => tap("#s-performTop")],
  [3, "視奏 聽正確版本", async () => tap("#s-play")],
  [3, "視奏 點鼓墊", async () => tapAny("#s-pads .tap-pad")],
  [2, "視奏 新題目", async () => tap("#s-generate")],
  [1, "視奏 速度 ±", async () => tap(pickOne(["#s-bpmUp", "#s-bpmDown"]))],
  [2, "視奏 正式打到結果", async () => {
    const ok = await page.evaluate(() => !document.getElementById("mod-sight").hidden && !document.getElementById("s-quiz").hidden && !!window.__sight.test && window.__sight.mock.state !== "run");   // 模擬考有自己的動作
    if (!ok) return false;
    await page.evaluate(() => { const S = window.__sight; if (S.state.phase === "perform") document.getElementById("s-performTop").click(); S.setBpm(240); document.getElementById("s-performTop").click(); });
    try { await page.waitForFunction(() => window.__sight.state.phase === "perform", null, { timeout: 60000 }); } catch (e) { return false; }
    for (let k = 0; k < 5; k++) { if (!(await tapAny("#s-pads .tap-pad"))) await page.keyboard.press("j"); await page.waitForTimeout(250); }
    // Trinity Playback 一首很長(8 級 24 小節):打幾下就結束(測試用的 finishNow);RSL 照常打完
    await page.evaluate(() => { if (window.__sight.state.mode === "playback") window.__sight.finishNow(); });
    try { await page.waitForFunction(() => window.__sight.state.phase !== "perform", null, { timeout: 20000 }); } catch (e) { fail("視奏 正式打 20 秒還沒結束"); return true; }
    const r = await page.evaluate(() => ({ phase: window.__sight.state.phase, result: window.__sight.state.result, shown: !document.getElementById("s-alongResult").hidden, sight: !document.getElementById("mod-sight").hidden }));
    if (r.sight && (r.phase !== "result" || !r.result || !r.shown || !(r.result.taps > 0))) fail(`視奏 正式打完沒有練習回饋:${JSON.stringify({ phase: r.phase, shown: r.shown, taps: r.result && r.result.taps })}`);
    await page.evaluate(() => { const S = window.__sight; if (S.test) S.setBpm(S.test.bpm); });
    return true;
  }],
  // S12 / S13 聽力
  [3, "聽力 聽題目 / 停止", async () => tap("#e-playBtn")],
  [3, "聽力 回打 / 停止", async () => tap("#e-performBtn")],
  [2, "聽力 選譜", async () => tapAny("#e-answers .e-opt")],
  [1, "聽力 看答案", async () => tap("#e-revealBtn")],
  [2, "聽力 看譜", async () => tap("#e-studyBtn")],
  [3, "聽力 點鼓墊", async () => tapAny("#e-pads .tap-pad")],
  [2, "聽力 下一題", async () => tap("#e-nextBtn")],
  [1, "聽力 難度", async () => tapAny("#e-levelRow button")],
  [1, "視奏 難度", async () => tapAny("#s-levelRow button")],
  [2, "難度回饋(太簡單 / 剛好 / 太難)", async () => tapAny("#s-alongResult .diff-fb button, #e-alongResult .diff-fb button")],
  [1, "檢定頁 練習這一級的視奏 / 回到規格", async () => tapAny("#s-specCards .s-go, #s-mockClose")],
  [1, "聽力 不看譜", async () => tap("#e-optHide")],
  // S14 模擬考
  [3, "模擬考 開始/停止", async () => tapAny("#t-mockBtn, #s-mockBtn, #e-mockBtn")],
  [3, "模擬考 下一步", async () => page.evaluate(() => {
    const T = window.__tech, S = window.__sight, E = window.__ear;
    if (T.state.mock === "run") { if (T.state.play) T.mockFinishRun(); else T.mockNext(); return true; }
    if (S.mock.state === "run") { if (S.state.phase === "perform") S.finishNow(); else S.mockSkipPrep(); return true; }
    if (E.mock.state === "run") { if (E.state.kind) E.finishNow(); else if (E.state.phase === "study") E.mockSkipStudy(); else if (E.state.phase === "choose") E.choose(0); else if (!document.getElementById("e-performBtn").disabled) document.getElementById("e-performBtn").click(); else E.mockNext(); return true; }
    return false;
  })],
  // 視奏模擬考準備中按 N:不能換題(換題會繞過「不能提早結束」),倒數仍在跑
  [2, "模擬考準備中按 n", async () => {
    const [sys, g] = pickOne([["rsl", 0], ["rsl", 3], ["rsl", 4], ["trinity", 4]]);
    await page.evaluate(([s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("exam", "sight"); }, [sys, g]); await page.waitForTimeout(300);
    await page.evaluate(() => window.__sight.startMock());
    const ok = await page.waitForFunction(() => window.__sight.mock.state === "run" && window.__sight.state.phase === "prep" && window.__sight.state.timer, null, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) return false;
    const a = await page.evaluate(() => { window.__humanTest = window.__sight.test; return window.__sight.state.left; });
    await page.keyboard.press("n"); await page.waitForTimeout(150); await page.keyboard.press("N"); await page.waitForTimeout(1300);
    const b = await page.evaluate(() => ({ same: window.__sight.test === window.__humanTest, st: window.__sight.mock.state, phase: window.__sight.state.phase, timer: window.__sight.state.timer, left: window.__sight.state.left }));
    if (!b.same) fail(`視奏模擬考準備中按 n 換了題(${sys} ${g})`);
    if (b.st !== "run" || b.phase !== "prep" || !b.timer || !(b.left < a)) fail(`視奏模擬考準備中按 n 之後倒數沒有在跑(${sys} ${g}):${a} → ${JSON.stringify(b)}`);
    await page.evaluate(() => { delete window.__humanTest; if (window.__sight.mock.state === "run") document.getElementById("s-mockBtn").click(); });
    return true;
  }],
  [3, "模擬考中途中止", async () => {
    const mod = pickOne(["tech", "sight", "ear"]);
    const sys = mod === "tech" ? "rsl" : pickOne(["rsl", "trinity"]), g = pickOne(mod === "sight" && sys === "rsl" ? [0, 3, 4, 5] : [0, 2, 4, 6, 8]);
    await page.evaluate(([m, s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("exam", m); }, [mod, sys, g]); await page.waitForTimeout(300);
    const api = { tech: "__tech", sight: "__sight", ear: "__ear" }[mod];
    await page.evaluate(a => window[a].startMock(), api);
    const running = () => page.evaluate(([m, a]) => (m === "tech" ? window.__tech.state.mock : window[a].mock.state) === "run", [mod, api]);
    if (!(await running())) return false;
    // 讓它真的在跑:技巧按播放;視奏、聽力已經在準備 / 聽題目 / 看譜
    if (mod === "tech") await page.evaluate(() => { const b = document.getElementById("t-playBtn"); if (!b.disabled) b.click(); });
    await page.waitForTimeout(500 + rnd() * 1200);
    const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
    const how = pickOne(touch ? ["分頁", "重新整理", "旋轉", "背景"] : ["分頁", "重新整理", "背景"]);
    if (how === "分頁") await tap(`#tabbar button[data-view="${pickOne(["tech", "sight", "ear"])}"]`);
    else if (how === "重新整理") { await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1); }
    else if (how === "旋轉") { const v = page.viewportSize(); await page.setViewportSize({ width: v.height, height: v.width }); }
    else await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(400);
    const left = await page.evaluate(() => {
      const out = [];
      if (window.__tech.state.play || window.__tech.state.scheduled) out.push("技巧還在播放");
      if (window.__playback && window.__playback.playing) out.push("視奏還在播放");
      if (window.__sight.state.timer) out.push("視奏倒數還在跑");
      if (window.__ear.play) out.push("聽力還在播放");
      if (window.__ear.state.timer) out.push("聽力倒數還在跑");
      for (const [n, st] of [["技巧", window.__tech.state.mock], ["視奏", window.__sight.mock.state], ["聽力", window.__ear.mock.state]]) if (st === "run") out.push(n + "模擬考還在進行");
      return out;
    });
    if (how === "背景") await page.evaluate(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    if (left.length) fail(`模擬考中途${how}:${left.join("、")}`);
    // 回到檢定頁:要說明「模擬考已中止」
    await page.evaluate(m => window.__shell.showView("exam", m), mod); await page.waitForTimeout(400);
    const r = await page.evaluate(([m, a]) => ({ st: m === "tech" ? window.__tech.state.mock : window[a].mock.state, txt: document.getElementById(m[0] + "-mockText").textContent, card: !document.getElementById(m[0] + "-mockCard").hidden }), [mod, api]);
    if (r.st !== "aborted" || !r.card || !/中止|stopped/.test(r.txt)) fail(`模擬考中途${how}(${mod} ${sys} ${g}):回來沒有說明中止 ${JSON.stringify(r)}`);
    if (how === "旋轉") { const v = page.viewportSize(); await page.setViewportSize({ width: v.height, height: v.width }); }
    return true;
  }],
  [3, "聽力 照節奏回打", async () => {
    const ok = await page.evaluate(() => !document.getElementById("mod-ear").hidden && !document.getElementById("e-quizCard").hidden && !!window.__ear.q && window.__ear.mock.state !== "run");   // 模擬考有自己的動作
    if (!ok) return false;
    const sys = await page.evaluate(() => window.__ear.state.sys);
    if (sys === "trinity") {
      await page.evaluate(() => { const E = window.__ear; E.finishNow(); E.perform(); });
      try { await page.waitForFunction(() => window.__ear.state.kind === "pass", null, { timeout: 60000 }); } catch (e) { return false; }
      await page.evaluate(() => { const E = window.__ear; E.finishNow(); E.perform(); });
      try { await page.waitForFunction(() => window.__ear.state.kind === "pass", null, { timeout: 60000 }); } catch (e) { return false; }
      await page.keyboard.press("j"); await page.evaluate(() => window.__ear.finishNow());
      const r = await page.evaluate(() => ({ st: window.__ear.state, shown: !document.getElementById("e-alongResult").hidden, ear: !document.getElementById("mod-ear").hidden }));
      if (r.ear && (r.st.phase !== "result" || !r.st.result || !r.shown || r.st.pass !== 2)) fail(`聽力 Trinity 兩次之後沒有回饋:${JSON.stringify(r.st)}`);
      return true;
    }
    await page.evaluate(() => { const E = window.__ear; E.finishNow(); E.listen(); });
    try { await page.waitForFunction(() => window.__ear.state.kind === "listen", null, { timeout: 60000 }); } catch (e) { return false; }
    await page.evaluate(() => { const E = window.__ear; E.finishNow(); E.perform(); });
    try { await page.waitForFunction(() => window.__ear.state.kind === "perform", null, { timeout: 60000 }); } catch (e) { return false; }
    const n = await page.evaluate(async () => {
      const { perfToAudioTime } = await import("./js/shared/player.js");
      const E = window.__ear, t0 = E.perfT0(), ex = E.expected(), now = performance.now(), off = perfToAudioTime(now) - now / 1000;
      for (const x of ex) {
        const at = (t0 + x.time - off) * 1000 + (Math.random() * 2 - 1) * 20;
        setTimeout(() => { const b = document.querySelector(`#e-pads .tap-pad[data-lane="${x.lane}"]`); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); }, Math.max(0, at - performance.now()));
      }
      return ex.length;
    });
    try { await page.waitForFunction(() => window.__ear.state.kind !== "perform", null, { timeout: 60000 }); } catch (e) { fail("聽力 回打 60 秒還沒結束"); return true; }
    const r = await page.evaluate(() => ({ st: window.__ear.state, ear: !document.getElementById("mod-ear").hidden && document.visibilityState === "visible" }));
    const res = r.st.result;
    if (r.ear && r.st.kind == null && (!res || res.taps < n || res.hits !== res.total || !(res.score >= 80))) fail(`聽力 照節奏回打不準:${JSON.stringify(res)}(要打 ${n} 下)`);
    return true;
  }],
];
// 在頁面裡跑(不能用外面的變數)
const appCheck = async () => {
  const out = [], sh = window.__shell, view = sh.S.view;
  const shown = ["tech", "sight", "ear"].filter(m => !document.getElementById("mod-" + m).hidden);
  const A = window.__tech;
  if (A && shown[0] === "tech" && view !== "exam") {
    const s = A.state, playLbl = document.getElementById("t-playLabel").textContent;
    if (s.play && !["停止", "Stop"].includes(playLbl)) out.push(`技巧播放中但按鈕寫「${playLbl}」`);
    if (!s.play && !s.starting && !["播放示範", "Play"].includes(playLbl)) out.push(`技巧沒在播放但按鈕寫「${playLbl}」`);
    if (!(s.bpm >= 30 && s.bpm <= 240)) out.push(`速度超出範圍 ${s.bpm}`);
    if (String(s.bpm) !== document.getElementById("t-bpmVal").textContent) out.push("速度顯示不一致");
    if (A.cur) {
      for (let t = 0; t < 60 && !document.querySelector("#t-osmd svg .dd-stick"); t++) await new Promise(r => setTimeout(r, 50));
      const notes = A.groups.flat(), want = notes.reduce((n, x) => n + (x.rest ? 0 : (x.buzz ? 0 : 1) + (x.flam ? 1 : 0) + (x.drag ? 2 : 0)), 0);
      const got = document.querySelectorAll("#t-osmd svg .dd-stick").length;
      if (want !== got) out.push(`左右手字母 ${got} / ${want}(${A.cur.no})`);
    }
  }
  // 檢定頁沒有播放鈕:技巧在檢定頁也不能在播(模擬考進行中除外)
  if (A && shown[0] === "tech" && view === "exam" && A.state.play && A.state.mock !== "run") out.push("技巧在檢定頁卻還在播放");
  // 模擬考進行中:那個模組一定在檢定頁上(離開就要中止)
  const exSub = view === "exam" ? sh.S.sub.exam : null;
  for (const [m, st] of [["tech", A && A.state.mock], ["sight", window.__sight && window.__sight.mock.state], ["ear", window.__ear && window.__ear.mock.state]]) if (st === "run" && exSub !== m) out.push(`${m} 模擬考不在畫面上卻還在進行`);
  // 視奏:不在畫面上(或在檢定頁)時不能在播、倒數要停、不能在正式打;在畫面上時按鈕跟狀態一致
  const Sg = window.__sight;
  if (Sg) {
    const s = Sg.state, onScreen = shown[0] === "sight" && (view !== "exam" || Sg.mock.state === "run") && !document.getElementById("s-quiz").hidden;
    if (!onScreen) {
      if (s.play) out.push("視奏不在畫面上卻還在播放");
      if (s.timer) out.push("視奏不在畫面上,準備的倒數還在跑");
      if (s.phase === "perform" || s.phase === "prep") out.push(`視奏不在畫面上還在 ${s.phase}`);
    } else {
      const lbl = document.getElementById("s-performTop").textContent;
      if ((s.phase === "perform") !== ["停止", "Stop"].includes(lbl)) out.push(`視奏 ${s.phase} 但正式打按鈕寫「${lbl}」`);
      if ((s.kind === "listen") !== document.getElementById("s-play").classList.contains("is-active")) out.push(`視奏播放鈕狀態不一致(${s.kind})`);
      if ((s.phase === "prep") !== s.timer) out.push(`視奏準備倒數不一致(${s.phase}, timer ${s.timer})`);
      if (Sg.mock.state === "run" && view === "exam" && (s.kind === "listen" || !document.getElementById("s-play").disabled)) out.push("視奏模擬考中還能聽正確版本");
      if (s.drawn && !s.pending && !document.querySelector("#s-score svg")) out.push("視奏沒有譜");
      if (s.mode && s.lanes !== (s.mode === "snare" ? 1 : 3)) out.push(`視奏 ${s.mode} 的鼓墊 ${s.lanes} 個`);
      if (s.loading != null && (!document.getElementById("s-play").disabled || !document.getElementById("s-play").classList.contains("busy"))) out.push("整組鼓載入中,▶ 沒有進度環或還能按");
    }
  }
  // 聽力:不在畫面上(或在檢定頁)時不能在播、看譜倒數要停、不能在回打;在畫面上時按鈕跟狀態一致
  const Er = window.__ear;
  if (Er) {
    const s = Er.state, onScreen = shown[0] === "ear" && (view !== "exam" || Er.mock.state === "run") && !document.getElementById("e-quizCard").hidden;
    if (!onScreen) {
      if (Er.play) out.push("聽力不在畫面上卻還在播放");
      if (s.timer) out.push("聽力不在畫面上,看譜倒數還在跑");
      if (["perform", "pass", "study"].includes(s.phase)) out.push(`聽力不在畫面上還在 ${s.phase}`);
    } else if (s.key) {
      const lbl = document.getElementById("e-performBtn").textContent;
      if ((s.kind === "perform" || s.kind === "pass") !== ["停止", "Stop"].includes(lbl)) out.push(`聽力 ${s.kind} 但回打按鈕寫「${lbl}」`);
      if ((s.kind === "listen") !== document.getElementById("e-playBtn").classList.contains("is-active")) out.push(`聽力播放鈕狀態不一致(${s.kind})`);
      if ((s.phase === "study") !== s.timer) out.push(`聽力看譜倒數不一致(${s.phase}, timer ${s.timer})`);
      if (s.phase === "choose" && document.getElementById("e-answers").hidden) out.push("聽力選譜但沒有選項");
    }
  }
  return out;
};
// @app-end

/* 在頁面裡跑:哪些模組正在播放(各模組留給測試的狀態) */
const playingNow = () => {
  const st = { tech: window.__tech && window.__tech.state && (window.__tech.state.play || window.__tech.state.starting),
    sight: window.__playback && window.__playback.playing, ear: window.__ear && window.__ear.play };
  return Object.keys(st).filter(k => st[k]);
};
/* 在頁面裡跑:假裝切到背景(hidden)/ 回到前景(visible) */
const setVisibility = v => {
  if (v === "visible") { delete document.visibilityState; delete document.hidden; }
  else { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); }
  document.dispatchEvent(new Event("visibilitychange"));
};

async function run(vpName, vp){
  const { page, errors, close } = await open(vp);
  const touch = !!vp.mobile;
  const tap = async sel => { const el = await page.$(sel); if (!el || !(await el.isVisible())) return false; try { if (touch) await el.tap({ timeout: 3000 }); else await el.click({ timeout: 3000 }); return true; } catch (e) { return false; } };
  const tapAny = async sel => { const els = (await page.$$(sel)); const vis = []; for (const e of els) if (await e.isVisible()) vis.push(e); if (!vis.length) return false; const e = pickOne(vis); try { if (touch) await e.tap({ timeout: 3000 }); else await e.click({ timeout: 3000 }); return true; } catch (er) { return false; } };
  const log = [];
  // 開始:第一次打開
  await page.evaluate(k => { localStorage.clear(); localStorage.setItem(k, "zh"); }, APP + "-lang");
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  if (rnd() < 0.5) { await tap(`#obSystem button[data-v="${pickOne(SYSTEMS)}"]`); await tap(`#obGradeSeg button[data-v="${Math.floor(rnd() * 9)}"]`); await tap("#obYes"); }
  else await tap("#obNo");
  const ACTIONS = [
    // 外框
    [10, "切分頁", async () => tap(`#tabbar button[data-view="${pickOne(["tech", "sight", "ear", "exam"])}"]`)],
    [8, "切子項目", async () => tapAny("#subSeg button")],
    [3, "考試系統", async () => tapAny("#systemSeg button")],
    [3, "級數", async () => tap(`#gradeSeg button[data-v="${Math.floor(rnd() * 9)}"]`)],
    [2, "檢定三項", async () => tapAny("#subSeg button")],
    [3, "展開/收起設定", async () => tapAny(".setup-summary")],
    [3, "中英切換", async () => tap("#langToggle")],
    [1, "主題", async () => tap("#themeToggle")],
    // 各 App 的模組
    ...appActions({ page, tap, tapAny }),
    // 裝置
    [2, "旋轉螢幕", async () => { if (!touch) return false; const s = page.viewportSize(); await page.setViewportSize({ width: s.height, height: s.width }); return true; }],
    [1, "重新整理", async () => { await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1); return true; }],
    [3, "捲動", async () => { await page.mouse.wheel(0, (rnd() - 0.3) * 1500); return true; }],
    // 切到背景(換 App、鎖屏):全部停止;回到前景不會自己開始播
    [3, "切到背景", async () => {
      await page.evaluate(setVisibility, "hidden"); await page.waitForTimeout(150 + rnd() * 600);
      const bg = await page.evaluate(playingNow), sched = await page.evaluate(() => (window.__tech ? window.__tech.state.scheduled : 0));
      if (bg.length) fail(`${vpName} 切到背景後還在播放:${bg.join("、")}`);
      if (sched) fail(`${vpName} 切到背景後還有 ${sched} 個排程中的聲音`);
      await page.evaluate(setVisibility, "visible"); await page.waitForTimeout(400);
      const fg = await page.evaluate(playingNow);
      if (fg.length) fail(`${vpName} 回到前景自己開始播放:${fg.join("、")}`);
      return true;
    }],
  ];
  const total = ACTIONS.reduce((s, a) => s + a[0], 0);
  for (let i = 0; i < STEPS; i++) {
    let r = rnd() * total, act = ACTIONS[0];
    for (const a of ACTIONS) { r -= a[0]; if (r < 0) { act = a; break; } }
    const did = await act[2]();
    log.push(act[1] + (did ? "" : "(略過)"));
    await page.waitForTimeout(80 + rnd() * 400);
    // ── 檢查 ──
    const st = await page.evaluate(keys => {
      const out = [], sh = window.__shell, view = sh.S.view;
      const selView = document.querySelector('#tabbar [aria-selected="true"]').dataset.view;
      if (view !== selView) out.push(`分頁不一致 ${view} / ${selView}`);
      const shown = ["tech", "sight", "ear"].filter(m => !document.getElementById("mod-" + m).hidden);
      if (shown.length !== 1) out.push(`同時顯示 ${shown.length} 個模組`);
      const want = view === "exam" ? sh.S.sub.exam : view;
      if (shown[0] !== want) out.push(`顯示的模組 ${shown[0]},應該是 ${want}`);
      if (document.getElementById("examSetup").hidden !== (view !== "exam")) out.push("檢定設定卡顯示不對");
      if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push("橫向捲動");
      for (const k of keys) { try { JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { out.push(k + " 壞掉"); } }
      // 離開的模組不能還在播
      if (window.__tech && shown[0] !== "tech" && window.__tech.state.play) out.push("技巧不在畫面上卻還在播放");
      if (shown[0] !== "sight" && window.__playback && window.__playback.playing) out.push("視奏不在畫面上卻還在播放");
      if (shown[0] !== "ear" && window.__ear && window.__ear.play) out.push("聽力不在畫面上卻還在播放");
      return out;
    }, STORE_KEYS);
    st.push(...await page.evaluate(appCheck));
    if (st.length) { fail(`${vpName} 第 ${i + 1} 步(${log.slice(-4).join(" → ")}):${st.join(";")}`); if (bad > 30) break; }
  }
  for (const e of errors) fail(`${vpName} console:${e}`);
  await close();
  console.log(`${vpName}:${STEPS} 步完成`);
}
for (const [name, vp] of [["iPhone", { viewport: { width: 390, height: 844 }, mobile: true, dpr: 1 }], ["SE", { viewport: { width: 320, height: 568 }, mobile: true, dpr: 1 }], ["iPad", { viewport: { width: 820, height: 1180 }, mobile: true, dpr: 1 }], ["桌機", { viewport: { width: 1366, height: 820 } }]]) await run(name, vp);
console.log(bad ? `✗ ${bad} 項問題` : "✓ 模擬操作全部通過");
process.exit(bad ? 1 : 0);
