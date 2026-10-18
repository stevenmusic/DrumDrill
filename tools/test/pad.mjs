// 觸控鼓墊(Playwright;js/shared/pad.js + player.js + timing.js,docs/STAGES.md S7)。在現有頁面注入一張測試卡片(題目還沒做,S8 才接進視奏):
//  1. player 播 2 小節(♩=90,預備拍 4):照每個音的時間 page.touchscreen.tap 三個鼓墊(鈸 / 鼓 / 大鼓)→ scoreLanes 全部命中、沒有多的,
//     整體偏移(CDP 送觸控的延遲)在上限內;打到的鼓墊閃一下(.hit)
//  2. 多指同時點擊(CDP 一次送 3 根手指、同一個鼓墊 2 根手指):每根手指都收到,時間幾乎一樣
//  3. 時間是事件時間:主執行緒忙 400 ms 時點下去,處理函式晚跑了,記下的時間仍是手指碰到的時間
//  3b. 沒有 getOutputTimestamp 的瀏覽器(設成 undefined):eventToAudioTime 改用 currentTime − outputLatency 與 performance.now() 配對,
//      換出來的時間跟有 API 時差不到 30 ms;這時點鼓墊,記下的時間仍是點下去的時間
//  4. 鍵盤 F / J / K 打三個鼓墊;按住不放的重複不算;Space 不算(留給播放);
//     輸入法開著(e.key 是「ㄑ」/ "Process")看 e.code(KeyF / KeyJ / KeyK)
//  4b. 沒有 pointerdown 的啟動(VoiceOver、Enter;click 的 detail = 0)也算一下(src "a11y");滑鼠點一下只算一下(pointerdown 算過,click 不重複);
//      按住 Enter 的自動重複只算第一下;a11y 隔 80 ms 兩下都算、隔 5 ms 只算一下;手指隔 20 ms 快速連打每下都算
//  5. 版面:280 / 320 / 390 / 手機橫式 / 桌機,1 個與 3 個鼓墊:每個 ≥ 80×96、在卡片框線內、沒有橫向捲動、字沒被切掉、
//     中英鼓墊在卡片裡的位置大小一模一樣;touch-action:none
// 用法:node tools/test/pad.mjs
import { open } from "./harness.mjs";
let bad = 0;
const fail = m => { bad++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { page, errors, close, ctx } = await open({ viewport: { width: 390, height: 844 }, mobile: true });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "tech", sub: { tech: "roll", exam: "tech" } })); });
await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);

// 注入:一張卡片放在 main 最前面(版面測試照真的卡片),n = 鼓墊數;fixed = 蓋在畫面上方(點擊測試,不用捲動)
const mount = (n, fixed) => page.evaluate(async ([n, fixed]) => {
  const [{ createPads }, { LANES }] = await Promise.all([import("./js/shared/pad.js"), import("./js/shared/timing.js")]);
  if (window.__pt) window.__pt.pads.destroy(), window.__pt.card.remove();
  const card = document.createElement("section");
  card.className = "card"; card.id = "padTestCard";
  if (fixed) card.style.cssText = "position:fixed;left:10px;right:10px;top:70px;z-index:9999";
  const box = document.createElement("div"); card.appendChild(box);
  document.querySelector("main").prepend(card);
  const hits = [];
  const pads = createPads(box, LANES[n], h => {
    const A = window.__A;
    hits.push({ ...h, ranAt: A && A.getCtx() ? A.getCtx().currentTime : null, flashed: box.querySelector(`[data-lane="${h.lane}"]`).classList.contains("hit") });
  });
  window.__pt = { pads, card, box, hits };
  if (!window.__ptKey) { window.__ptKey = true; document.addEventListener("keydown", e => { if (window.__pt) window.__pt.lastKey = window.__pt.pads.key(e); }); }
  return [...box.querySelectorAll(".tap-pad")].map(b => { const r = b.getBoundingClientRect(); return { lane: b.dataset.lane, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
}, [n, fixed]);
// node 的時鐘 ↔ 音訊時鐘:來回最短的那次
async function clockSync(){
  let best = null;
  for (let i = 0; i < 5; i++) {
    const a = Date.now(), ct = await page.evaluate(() => window.__A.getCtx().currentTime), b = Date.now();
    if (!best || b - a < best.rtt) best = { rtt: b - a, mid: (a + b) / 2, ct };
  }
  return t => best.mid + (t - best.ct) * 1000;   // 音訊時間 → node 的 Date.now()
}

await page.evaluate(async () => {
  const A = window.__A = await import("./js/shared/audio.js");
  A.ensureAudio(); A.unlockAudio();
  await A.loadKit(["snare", "kick", "hhClosed"]); await A.loadClick();
  await Promise.race([A.masterReady, new Promise(r => setTimeout(r, 1500))]);
});

// 1. 照時間點擊
{
  const n0 = bad;
  const pads = await mount(3, true), at = Object.fromEntries(pads.map(p => [p.lane, p]));
  const BPM = 90, sec = 60 / BPM;
  const plan = await page.evaluate(async BPM => {
    const { createPlayer } = await import("./js/shared/player.js");
    const ev = [];
    for (let b = 0; b < 8; b++) ev.push({ beat: b, piece: "hhClosed", vel: "mf" });
    for (const b of [1, 3, 5, 7]) ev.push({ beat: b, piece: "snare", vel: "f" });
    for (const b of [0, 2, 4, 6]) ev.push({ beat: b, piece: "kick", vel: "mf" });
    window.__pt.events = ev; window.__pt.ended = false;
    const pl = window.__pt.player = createPlayer({ onEnd: () => { window.__pt.ended = true; } });
    const t0 = pl.play({ events: ev, lenBeats: 8, bpm: BPM, countInBeats: 4, click: b => (b < 0 ? (b === -4 ? 2 : 1) : b % 4 === 0 ? 2 : 1) });
    window.__pt.t0 = t0;
    return { t0, ev };
  }, BPM);
  const toNode = await clockSync();
  const LANE = { hhClosed: "cym", snare: "drum", kick: "foot" };
  const taps = plan.ev.map(e => ({ lane: LANE[e.piece], when: toNode(plan.t0 + e.beat * sec) })).sort((a, b) => a.when - b.when);
  for (const t of taps) {
    const wait = t.when - Date.now();
    if (wait > 0) await sleep(wait);
    await page.touchscreen.tap(at[t.lane].x, at[t.lane].y);
  }
  await page.waitForFunction(() => window.__pt.ended, null, { timeout: 15000 }).catch(() => fail("2 小節播完沒有 onEnd"));
  const r = await page.evaluate(async BPM => {
    const { expectedByLane, scoreLanes, LANES } = await import("./js/shared/timing.js");
    const P = window.__pt, exp = expectedByLane(P.events, BPM, LANES[3]);
    const taps = P.hits.map(h => ({ lane: h.lane, time: h.time - P.t0 }));
    return { res: scoreLanes(exp, taps, { tempoBpm: BPM }), n: P.hits.length, flashed: P.hits.every(h => h.flashed), src: [...new Set(P.hits.map(h => h.src))], state: P.player.state };
  }, BPM);
  const s = r.res;
  if (r.n !== taps.length) fail(`點了 ${taps.length} 下,鼓墊收到 ${r.n} 下`);
  if (s.hits !== s.total || s.extra || s.missed) fail(`照時間點擊:命中 ${s.hits}/${s.total}、漏 ${s.missed}、多 ${s.extra}(各條 ${JSON.stringify(Object.fromEntries(Object.entries(s.lanes).map(([k, v]) => [k, v.hits + "/" + v.total])))})`);
  if (s.offsetTooLarge) fail(`整體偏移 ${s.offsetMs} ms 超過上限`);
  if (!r.flashed) fail("打到的鼓墊沒有閃(.hit)");
  if (r.src.join() !== "pointer") fail(`來源應該是 pointer,實際 ${r.src}`);
  if (r.state.playing) fail("播完後 player.state.playing 還是 true");
  if (bad === n0) ok(`player 播 2 小節、照時間點三個鼓墊 ${taps.length} 下:全部命中(鈸 ${s.lanes.cym.hits}、鼓 ${s.lanes.drum.hits}、大鼓 ${s.lanes.foot.hits}),整體偏移 ${s.offsetMs} ms、平均誤差 ${s.meanErrorMs} ms(容許 ${s.toleranceMs} ms),打到的閃一下`);
}

// 2. 多指同時點擊
{
  const n0 = bad;
  const pads = await mount(3, true);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pads.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(100);
  let h = await page.evaluate(() => window.__pt.hits);
  const lanes = h.map(x => x.lane).sort().join();
  if (lanes !== "cym,drum,foot") fail(`3 根手指同時點三個鼓墊:收到 ${h.length} 下(${lanes})`);
  else if (Math.max(...h.map(x => x.time)) - Math.min(...h.map(x => x.time)) > 0.01) fail(`3 根手指同時點:時間差 ${((Math.max(...h.map(x => x.time)) - Math.min(...h.map(x => x.time))) * 1000).toFixed(1)} ms`);
  await page.evaluate(() => { window.__pt.hits.length = 0; });
  const d = pads.find(p => p.lane === "drum");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: d.x - 15, y: d.y, id: 1 }, { x: d.x + 15, y: d.y, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(100);
  h = await page.evaluate(() => window.__pt.hits);
  if (h.length !== 2 || h.some(x => x.lane !== "drum")) fail(`2 根手指同時點同一個鼓墊:收到 ${h.length} 下(${h.map(x => x.lane)})`);
  // 第一根手指按著不放,第二根點另一個鼓墊
  await page.evaluate(() => { window.__pt.hits.length = 0; });
  const c = pads.find(p => p.lane === "cym"), f = pads.find(p => p.lane === "foot");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }, { x: f.x, y: f.y, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(100);
  h = await page.evaluate(() => window.__pt.hits);
  if (h.map(x => x.lane).join() !== "cym,foot") fail(`一根手指按著、另一根點:收到 ${h.map(x => x.lane)}(應該 cym,foot)`);
  if (bad === n0) ok("多指同時點擊:3 根手指點三個鼓墊都收到(時間差 < 10 ms)、2 根手指點同一個鼓墊 = 2 下、按著一根再點另一根也收到");
}

// 3. 事件時間,不是處理函式執行的時間
{
  const n0 = bad;
  const pads = await mount(3, true), d = pads.find(p => p.lane === "drum");
  const toNode = await clockSync();
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 400) {} }, 30); });
  await sleep(120);   // 主執行緒正在忙
  const tapNode = Date.now();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: d.x, y: d.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(200);
  const h = await page.evaluate(() => window.__pt.hits);
  if (h.length !== 1) fail(`主執行緒忙的時候點一下:收到 ${h.length} 下`);
  else {
    const late = (h[0].ranAt - h[0].time) * 1000, err = toNode(h[0].time) - tapNode;
    if (late < 150) fail(`主執行緒忙 400 ms:處理函式只晚了 ${late.toFixed(0)} ms(測試沒有擋到主執行緒)`);
    if (Math.abs(err) > 60) fail(`主執行緒忙時點下去:記下的時間跟點下去的時間差 ${err.toFixed(0)} ms(應該是事件時間,不是處理的時間)`);
    if (bad === n0) ok(`時間是事件時間:主執行緒忙,處理函式晚 ${late.toFixed(0)} ms 才跑,記下的時間跟點下去只差 ${err.toFixed(0)} ms`);
  }
}

// 3b. 沒有 getOutputTimestamp 的備援路徑
{
  const n0 = bad;
  const pads = await mount(3, true), d = pads.find(p => p.lane === "drum");
  const conv = await page.evaluate(async () => {
    const { eventToAudioTime } = await import("./js/shared/pad.js");
    const ctx = window.__A.getCtx(), t = performance.now();
    const withApi = eventToAudioTime(t);
    ctx.getOutputTimestamp = undefined;
    const ct = ctx.currentTime, lat = ctx.outputLatency || 0, without = eventToAudioTime(performance.now());
    return { withApi, without, expect: ct - lat, api: typeof AudioContext.prototype.getOutputTimestamp };
  });
  const toNode = await clockSync();
  const cdp = await ctx.newCDPSession(page);
  const tapNode = Date.now();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: d.x, y: d.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(150);
  const h = await page.evaluate(() => { delete window.__A.getCtx().getOutputTimestamp; return window.__pt.hits; });
  if (Math.abs(conv.without - conv.expect) > 0.02) fail(`沒有 getOutputTimestamp:換出 ${conv.without.toFixed(3)},應該 ≈ currentTime − outputLatency = ${conv.expect.toFixed(3)}`);
  if (Math.abs(conv.without - conv.withApi) > 0.03) fail(`沒有 getOutputTimestamp:跟有 API 時差 ${((conv.without - conv.withApi) * 1000).toFixed(0)} ms`);
  if (h.length !== 1 || Math.abs(toNode(h[0].time) - tapNode) > 60) fail(`沒有 getOutputTimestamp 時點一下:收到 ${h.length} 下${h[0] ? `、跟點下去差 ${(toNode(h[0].time) - tapNode).toFixed(0)} ms` : ""}`);
  if (bad === n0) ok(`沒有 getOutputTimestamp(備援):換算跟有 API 時差 ${((conv.without - conv.withApi) * 1000).toFixed(1)} ms,點鼓墊記下的時間跟點下去差 ${(toNode(h[0].time) - tapNode).toFixed(0)} ms`);
}

// 4. 鍵盤
{
  const n0 = bad;
  await mount(3, true);
  for (const k of ["f", "j", "k"]) await page.keyboard.press(k);
  await page.keyboard.down("j"); await page.keyboard.down("j"); await page.keyboard.up("j");   // 第二下是按住不放的重複
  await page.keyboard.press("Space");
  const r = await page.evaluate(() => ({ hits: window.__pt.hits.map(h => h.lane + ":" + h.src), last: window.__pt.lastKey, times: window.__pt.hits.map(h => h.time) }));
  if (r.hits.join() !== "cym:key,drum:key,foot:key,drum:key") fail(`鍵盤 F J K + 按住 J:收到 ${r.hits.join()}(應該 cym、drum、foot、drum 各一下,重複不算)`);
  if (r.last !== false) fail("Space 被鼓墊吃掉了(Space 是播放)");
  if (r.times.some(t => !(t > 0))) fail(`鍵盤的時間不對:${r.times}`);
  // 1 個鼓墊:J 與 F 都是小鼓
  await mount(1, true);
  await page.keyboard.press("j"); await page.keyboard.press("f"); await page.keyboard.press("k");
  const one = await page.evaluate(() => window.__pt.hits.map(h => h.lane));
  if (one.join() !== "snare,snare") fail(`1 個鼓墊:J、F 是小鼓、K 不算,實際 ${one.join()}`);
  // 輸入法開著:e.key 對不到,看 e.code
  await mount(3, true);
  const ime = await page.evaluate(() => {
    const send = (key, code) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true }));
    send("ㄑ", "KeyF"); send("Process", "KeyJ"); send("ㄜ", "KeyK"); send("ㄎ", "KeyD"); send(" ", "Space");
    return window.__pt.hits.map(h => h.lane + ":" + h.src);
  });
  if (ime.join() !== "cym:key,drum:key,foot:key") fail(`輸入法開著(e.key = ㄑ / Process / ㄜ):應該照 e.code 打到 cym、drum、foot,實際 ${ime.join()}`);
  if (bad === n0) ok("鍵盤:F / J / K = 鈸 / 鼓 / 大鼓,按住不放的重複不算,Space 不算;1 個鼓墊時 J、F 都是小鼓;注音輸入法開著時照 e.code(KeyF / KeyJ / KeyK)");
}

// 4b. 輔助使用(click detail = 0)與不重複計算
{
  const n0 = bad;
  await mount(3, true);
  const a = await page.evaluate(() => { document.querySelector('#padTestCard .tap-pad[data-lane="foot"]').click(); return window.__pt.hits.map(h => h.lane + ":" + h.src); });
  if (a.join() !== "foot:a11y") fail(`click()(detail 0,VoiceOver 的啟動):應該算一下 foot:a11y,實際 ${a.join()}`);
  await page.evaluate(() => { window.__pt.hits.length = 0; });
  await page.focus('#padTestCard .tap-pad[data-lane="cym"]');
  await page.keyboard.press("Enter");
  const e = await page.evaluate(() => window.__pt.hits.map(h => h.lane + ":" + h.src));
  if (e.join() !== "cym:a11y") fail(`聚焦後按 Enter:應該算一下 cym:a11y,實際 ${e.join()}`);
  // 按住 Enter 不放(自動重複的 keydown,repeat = true):只算第一下
  await page.evaluate(() => { window.__pt.hits.length = 0; });
  await sleep(100);
  await page.focus('#padTestCard .tap-pad[data-lane="drum"]');
  await page.keyboard.down("Enter");
  for (let i = 0; i < 6; i++) { await sleep(35); await page.keyboard.down("Enter"); }
  await page.keyboard.up("Enter");
  const held = await page.evaluate(() => window.__pt.hits.map(h => h.lane + ":" + h.src));
  if (held.join() !== "drum:a11y") fail(`按住 Enter(6 次自動重複):應該只算一下 drum:a11y,實際 ${held.join()}`);
  // 放開再按:照常算;a11y click 隔 80 ms 兩下都算,隔幾毫秒的重複只算一下;手指快速連打(同一個鼓墊、隔 20 ms)每下都算
  const quick = await page.evaluate(async () => {
    const sl = ms => new Promise(r => setTimeout(r, ms));
    window.__pt.hits.length = 0;
    const b = document.querySelector('#padTestCard .tap-pad[data-lane="cym"]');
    await sl(100); b.click(); await sl(80); b.click(); await sl(5); b.click();
    const a11y = window.__pt.hits.map(h => h.lane + ":" + h.src);
    window.__pt.hits.length = 0;
    const f = document.querySelector('#padTestCard .tap-pad[data-lane="foot"]');
    for (let i = 0; i < 4; i++) { f.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 10 + i, button: 0, pointerType: "touch" })); await sl(20); }
    return { a11y, pointer: window.__pt.hits.map(h => h.lane + ":" + h.src) };
  });
  await page.keyboard.press("Enter");
  const again = await page.evaluate(() => window.__pt.hits.filter(h => h.src === "a11y").map(h => h.lane));
  if (quick.a11y.join() !== "cym:a11y,cym:a11y") fail(`a11y click 隔 80 ms 兩下 + 隔 5 ms 的重複:應該算兩下,實際 ${quick.a11y.join()}`);
  if (quick.pointer.join() !== "foot:pointer,foot:pointer,foot:pointer,foot:pointer") fail(`手指快速連打 4 下(隔 20 ms):應該每下都算,實際 ${quick.pointer.join()}`);
  if (again.join() !== "drum") fail(`放開 Enter 再按一次:應該算一下 drum,實際 ${again.join()}`);
  await page.evaluate(() => { window.__pt.hits.length = 0; });
  await page.click('#padTestCard .tap-pad[data-lane="drum"]');                                  // 滑鼠:pointerdown + click(detail 1)
  await page.touchscreen.tap(...(await page.evaluate(() => { const r = document.querySelector('#padTestCard .tap-pad[data-lane="foot"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })));
  await sleep(100);
  // 手指點下去之後馬上又有 detail 0 的 click(有的瀏覽器會這樣):pointerdown 剛算過,不重複
  await page.evaluate(() => document.querySelector('#padTestCard .tap-pad[data-lane="foot"]').click());
  const m = await page.evaluate(() => window.__pt.hits.map(h => h.lane + ":" + h.src));
  if (m.join() !== "drum:pointer,foot:pointer") fail(`滑鼠點、手指點各一下(再加一個 detail 0 的 click):應該 drum:pointer、foot:pointer,實際 ${m.join()}`);
  if (bad === n0) ok("輔助使用:click()(detail 0)與聚焦後 Enter 各算一下(a11y);按住 Enter 的自動重複不算、放開再按照常算;a11y 隔 80 ms 兩下都算、隔 5 ms 只算一下;手指隔 20 ms 連打每下都算;滑鼠點、手指點只算 pointerdown 那一下,緊接的 click 不重複");
}

// 5. 版面
{
  const n0 = bad;
  const sizes = [[280, 653, "折疊機 280"], [320, 568, "SE 320"], [390, 844, "手機 390"], [844, 390, "手機橫式"], [1280, 800, "桌機"]];
  let minW = Infinity, minH = Infinity;
  for (const [w, h, label] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    for (const n of [1, 3]) {
      const per = {};
      for (const lang of ["zh", "en"]) {
        await page.evaluate(async lang => { const I = await import("./js/shared/i18n.js"); if (I.getLang() !== lang) I.setLang(lang); }, lang);
        await mount(n, false);
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(50);
        per[lang] = await page.evaluate(() => {
          const card = document.getElementById("padTestCard"), cr = card.getBoundingClientRect(), box = window.__pt.box;
          return {
            pads: [...box.querySelectorAll(".tap-pad")].map(b => {
              const r = b.getBoundingClientRect(), nm = b.querySelector(".pad-name");
              return { x: Math.round(r.left - cr.left), y: Math.round(r.top - cr.top), w: Math.round(r.width), h: Math.round(r.height), clip: b.scrollHeight > b.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1 || b.scrollWidth > b.clientWidth + 1,
                inCard: r.left >= cr.left + 1 - 0.5 && r.right <= cr.right - 1 + 0.5, text: nm.textContent };
            }),
            hscroll: document.documentElement.scrollWidth > innerWidth, touch: getComputedStyle(box).touchAction + "/" + getComputedStyle(box.querySelector(".tap-pad")).touchAction, vw: innerWidth
          };
        });
      }
      for (const lang of ["zh", "en"]) {
        const m = per[lang];
        if (m.hscroll) fail(`${label} ${n} 個鼓墊(${lang}):有橫向捲動`);
        if (!/^none\/none$/.test(m.touch)) fail(`${label}:touch-action 是 ${m.touch}`);
        for (const p of m.pads) {
          minW = Math.min(minW, p.w); minH = Math.min(minH, p.h);
          if (p.w < 80 || p.h < 96) fail(`${label} ${n} 個鼓墊(${lang})「${p.text}」只有 ${p.w}×${p.h}(至少 80×96)`);
          if (!p.inCard) fail(`${label} ${n} 個鼓墊(${lang})「${p.text}」超出卡片框線`);
          if (p.clip) fail(`${label} ${n} 個鼓墊(${lang})「${p.text}」的字被切掉`);
        }
      }
      const a = JSON.stringify(per.zh.pads.map(({ x, y, w, h }) => [x, y, w, h])), b = JSON.stringify(per.en.pads.map(({ x, y, w, h }) => [x, y, w, h]));
      if (a !== b) fail(`${label} ${n} 個鼓墊:中英版面不一樣 ${a} vs ${b}`);
    }
  }
  await page.evaluate(async () => { const I = await import("./js/shared/i18n.js"); I.setLang("zh"); });
  if (bad === n0) ok(`版面:${sizes.map(s => s[2]).join("、")} × 1 / 3 個鼓墊 × 中英:每個 ≥ 80×96(最小 ${minW}×${minH})、在卡片框線內、沒有橫向捲動、字沒被切掉、中英一樣、touch-action:none`);
}

for (const e of errors) fail("console:" + e);
await close();
console.log(bad ? `✗ ${bad} 項問題` : "✓ 觸控鼓墊全部通過");
process.exit(bad ? 1 : 0);
