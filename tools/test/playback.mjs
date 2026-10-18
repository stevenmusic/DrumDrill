// 播放的排程與停止(Playwright):
//  1. 技巧 #20 Flam,♩=240,循環播放 20 輪:每輪自然播完時,還排著的聲音節點 ≤「照每個節點的 stop 時間,這時候還在響的」節點數
//     (測試把 AudioBufferSourceNode 的 start/stop 時間記下來,門檻就是實際值;播完的節點自己移除,不會越積越多)
//  1b. 循環 + 每輪 +4(ramp)跑 5 輪:每輪播完時「排程中 − 還在響」不增加(= 0,沒有一輪一輪累積),速度 +20;
//      另外看「排程中」本身的趨勢:每一輪都比前一輪多、而且累積超過一輪節點數的 5%(至少 3 個)= 低於上限的緩慢累積(上面的比較抓不到)
//  2. 播放中按停止:300ms 後排程中的節點 = 0,技巧的播放狀態是停止
//  3. 切到背景(visibilitychange → hidden):播放停止;回到前景不會自己開始播
//  4. 播放中換語言:不停止播放,題目、選擇器、按鈕文字換成新語言
//  5. 共用播放器(js/shared/player.js):時間窗排程、改速度不重複、stop 後歸零、切到背景自己停(細項見下面第 5 段)
//  6. 共用播放器的其他行為:gaps 不出聲、預設拍點(只有預備拍、第一下重)、onTick(聽到的拍子,扣輸出延遲)、
//     onTick 裡 stop() / play() 不出錯也不會兩條 rAF、看不到時 play() 不丟例外、切到背景叫 onStop、
//     計時器被擋住時漏的音算進 dropped + onLate、bpm 不合法丟 RangeError、超出 lenBeats 的事件不播、自然播完後 stop(true) 收掉尾音
//  7. 視奏的整組鼓播放(細項見第 7 段):Trinity x/8 用八分音符當一拍、RSL 自由發展只有拍點、換語言不停、停止後排程歸零
//  8. 聽力(js/ear/app.js):RSL Fill 聽題目中換語言不停播、文字換掉;切到技巧分頁 = 停止(題目保留);
//     Trinity Playback ♩=240 第一次:App 播的句子有鼓聲,學生打的空檔只有拍點(每個拍點的時間只有一個聲音節點,沒有鼓聲);
//     第二次快轉:每一句一列練習回饋
// 用法:node tools/test/playback.mjs
import { open } from "./harness.mjs";
let bad = 0;
const fail = m => { bad++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);
const { page, errors, close } = await open({ viewport: { width: 1280, height: 800 } });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "tech", sub: { tech: "flam", exam: "tech" } })); });
await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
const state = () => page.evaluate(() => window.__tech.state);
const waitFor = (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });

// 一輪會排幾個節點:每個音(裝飾音、主音;多次反彈 5 下)× 反覆次數 + 預備拍 4 + 每拍一個拍點
const setup = async (no, bpm, opts) => {
  await page.evaluate(([no, bpm, opts]) => {
    const T = window.__tech;
    Object.assign(T.S, { reps: 4, clickOnly: false, ramp: false, ...opts }); T.setRudiment(no); T.setBpm(bpm, false);
  }, [no, bpm, opts]);
  return page.evaluate(async () => {
    const { strokes, cycleLength, DIV } = await import("./js/tech/rudiments.js");
    const T = window.__tech, g = T.groups, reps = T.S.reps;
    const notes = strokes(g).reduce((n, s) => n + (s.kind === "buzz" ? 5 : 1), 0) * reps;
    const clicks = 4 + Math.ceil(reps * cycleLength(g) / DIV);
    return { notes, clicks, perRound: notes + clicks };
  });
};
// 記下每個聲音節點的 stop 時間(audio.js:鼓聲 stop 在錄音長度(照錄音自然響完)、拍點 0.4 秒;停止時 stopAll 再 stop 一次)
await page.evaluate(() => {
  const P = AudioScheduledSourceNode.prototype, stop0 = P.stop;
  window.__nodes = [];
  P.stop = function(when){ if (!this.__rec) { this.__rec = true; this.__made = this.context.currentTime; window.__nodes.push(this); } this.__stopAt = when || 0; return stop0.apply(this, arguments); };
});
// 自然播完的那一刻(lastEnd.at)還在響的節點:那時候之前就排好(下一輪是同一刻或之後才排,不算)、stop 時間在那之後(多留 0.1 秒給 onended 事件晚一點才到)
const alive = at => page.evaluate(at => window.__nodes.filter(n => n.__made < at && n.__stopAt > at - 0.1).length, at);
const click = () => page.click("#t-playBtn");

// 1. 循環 20 輪
{
  const r = await setup(20, 240, { loop: true });
  const ends0 = (await state()).lastEnd.n;
  await click();
  const seen = [], lims = [];
  for (let k = 1; k <= 20; k++) {
    try { await waitFor(n => window.__tech.state.lastEnd.n >= n, ends0 + k, 30000); }
    catch (e) { fail(`第 ${k} 輪沒有自然播完`); break; }
    const s = await state(), lim = await alive(s.lastEnd.at);
    seen.push(s.lastEnd.scheduled); lims.push(lim);
    if (s.lastEnd.scheduled > lim) fail(`第 ${k} 輪播完時還排著 ${s.lastEnd.scheduled} 個節點 > 照 stop 時間還在響的 ${lim}(一輪共 ${r.perRound})`);
  }
  if (!bad) ok(`#20 Flam ♩=240 循環 20 輪:每輪播完時排程中的節點 ${Math.min(...seen)}–${Math.max(...seen)} ≤ 照 stop 時間還在響的 ${Math.min(...lims)}–${Math.max(...lims)}(一輪共 ${r.perRound})`);
  await click();   // 停止
  await page.waitForTimeout(300);
}

// 1b. 循環 + 每輪 +4,跑 5 輪
{
  const bpm0 = 200, ROUNDS = 5;
  const r = await setup(20, bpm0, { loop: true, ramp: true });
  const ends0 = (await state()).lastEnd.n, n0 = bad;
  await click();
  const seen = [], extra = [];
  for (let k = 1; k <= ROUNDS; k++) {
    try { await waitFor(n => window.__tech.state.lastEnd.n >= n, ends0 + k, 30000); }
    catch (e) { fail(`每輪 +4:第 ${k} 輪沒有自然播完`); break; }
    const s = await state(), lim = await alive(s.lastEnd.at);
    seen.push(s.lastEnd.scheduled); extra.push(Math.max(0, s.lastEnd.scheduled - lim));
  }
  const bpmNow = (await state()).bpm;
  await click(); await page.waitForTimeout(300);
  if (seen.length === ROUNDS) {
    if (extra.some((x, i) => x > (i ? extra[i - 1] : 0))) fail(`每輪 +4:每輪播完時「排程中 − 還在響」在增加 ${extra.join(" → ")}(排程中 ${seen.join(" → ")})`);
    // 趨勢:每一輪都比前一輪多,而且總共多出來的超過門檻 → 一輪一輪慢慢累積(還在上限以內,上面那條抓不到)
    const rising = seen.every((x, i) => !i || x > seen[i - 1]), grow = seen[seen.length - 1] - seen[0], tol = Math.max(3, Math.round(r.perRound * 0.05));
    if (rising && grow > tol) fail(`每輪 +4:排程中的節點每輪都在增加 ${seen.join(" → ")}(多了 ${grow} > ${tol}),有東西沒有收掉`);
    if (bpmNow !== bpm0 + 4 * ROUNDS) fail(`每輪 +4:${ROUNDS} 輪之後速度是 ${bpmNow},應該是 ${bpm0 + 4 * ROUNDS}`);
  }
  if (bad === n0) ok(`#20 循環 + 每輪 +4(♩=${bpm0}→${bpmNow})${ROUNDS} 輪:每輪播完時「排程中 − 還在響」${extra.join(" → ")},沒有增加;排程中 ${seen.join(" → ")} 沒有一輪一輪累積`);
  await page.evaluate(() => { window.__tech.S.ramp = false; });
}

// 2. 播放中按停止
{
  await setup(20, 120, { loop: false });
  await click();
  await waitFor(() => window.__tech.state.play && window.__tech.state.scheduled > 0);
  await page.waitForTimeout(800);
  await click();
  await page.waitForTimeout(300);
  const s = await state();
  if (s.scheduled !== 0) fail(`按停止 300ms 後還排著 ${s.scheduled} 個節點`);
  if (s.play !== false) fail("按停止後技巧還在播放狀態");
  if (s.scheduled === 0 && s.play === false) ok("播放中按停止:300ms 後排程中的節點 = 0,播放狀態停止");
}

// 3. 切到背景
{
  await setup(20, 120, { loop: true });
  await click();
  await waitFor(() => window.__tech.state.play && window.__tech.state.scheduled > 0);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(200);
  let s = await state();
  if (s.play || s.starting) fail("切到背景後技巧還在播放");
  if (s.scheduled) fail(`切到背景後還排著 ${s.scheduled} 個節點`);
  const label = await page.textContent("#t-playLabel");
  if (!["播放示範", "Play"].includes(label)) fail(`切到背景後按鈕寫「${label}」`);
  await page.evaluate(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(1500);
  s = await state();
  if (s.play || s.starting || s.scheduled) fail(`回到前景自己開始播放(play=${s.play} 排程 ${s.scheduled})`);
  else ok("切到背景:播放停止、聲音全停;回到前景不會自己開始播");
}

// 4. 播放中換語言:不停止播放,題目、選擇器、按鈕的文字換成新語言
{
  await setup(1, 120, { loop: true });
  await click();
  await waitFor(() => window.__tech.state.play && window.__tech.state.scheduled > 0);
  const before = await page.evaluate(() => ({ title: document.getElementById("t-qTitle").textContent, picker: document.getElementById("t-picker").textContent }));
  await page.click("#langToggle"); await page.waitForTimeout(300);
  const s = await state();
  const after = await page.evaluate(() => ({ title: document.getElementById("t-qTitle").textContent, picker: document.getElementById("t-picker").textContent, label: document.getElementById("t-playLabel").textContent }));
  const n0 = bad;
  if (!s.play) fail("換語言後播放停止了");
  if (after.title === before.title) fail(`換語言後題目沒換:${after.title}`);
  if (after.picker === before.picker) fail("換語言後選擇器文字沒換");
  if (after.label !== "Stop") fail(`換語言後播放鈕寫「${after.label}」`);
  if (bad === n0) ok(`播放中換語言:繼續播放,題目「${before.title}」→「${after.title}」`);
  await click(); await page.waitForTimeout(300);
  await page.click("#langToggle"); await page.waitForTimeout(300);
}

// 5. 共用播放器(js/shared/player.js,視奏 / 聽力用):24 小節鼓組事件(♩=120,hi-hat 在反拍、大鼓小鼓在正拍,每小節最後一拍開放 hi-hat)
//  5a. 時間窗:每 50 ms 取樣,排程中的節點數 ≤ 2 ×「還在響或 1.5 秒內要響的事件與拍點」;最晚的節點 ≤ 現在 + 1.5 秒(+ 0.25 秒計時器餘裕)
//  5b. 播到第 5 小節(預備拍後約 9 秒)改速度 120 → 150:改之前已經送出的不動,之後的照新速度、每個反拍 hi-hat 只有一個節點(不重複、不漏),
//      舊時間的節點都取消了
//  5c. stop():不再排新的;還沒開始的取消,正在響的自然收尾 → 響完排程中 = 0;stop(true) 立刻歸零
//  5d. 頁面切到背景:播放器自己停止、不再補排(外框的 leave 之外的保險)
{
  const n0 = bad;
  await page.evaluate(async () => {
    const A = window.__A = await import("./js/shared/audio.js");
    A.stopAll(); A.ensureAudio(); A.unlockAudio();
    await A.loadKit(["kick", "snare", "hhClosed", "hhOpen"]); await A.loadClick();
    const P = AudioScheduledSourceNode.prototype, B = AudioBufferSourceNode.prototype;   // AudioBufferSourceNode 有自己的 start
    if (!P.__pl) {
      P.__pl = true;
      const start0 = B.start, stop0 = P.stop;
      B.start = function(when){ this.__at = Math.max(when || 0, this.context.currentTime); this.__made = this.context.currentTime; this.__dur = this.buffer ? this.buffer.duration : 0; (window.__pl || (window.__pl = [])).push(this); return start0.apply(this, arguments); };
      P.stop = function(when){ const st = when || this.context.currentTime; if (this.__at != null && st <= this.__at + 1e-6) this.__cancel = true; return stop0.apply(this, arguments); };
    }
  });
  const BARS = 24, BPM = 120, BPM2 = 150;
  const mkPlay = (opts) => page.evaluate(async ([BARS, BPM, opts]) => {
    const { createPlayer, LOOKAHEAD } = await import("./js/shared/player.js");
    const ev = [];
    for (let bar = 0; bar < BARS; bar++) for (let b = 0; b < 4; b++) {
      const at = bar * 4 + b;
      ev.push({ beat: at, piece: b % 2 ? "snare" : "kick", vel: b === 0 ? "f" : "mf" });
      ev.push({ beat: at + 0.5, piece: b === 3 ? "hhOpen" : "hhClosed", vel: "mp" });
    }
    window.__pl = []; window.__plEnd = 0;
    const pl = window.__player = createPlayer({ onEnd: () => { window.__plEnd++; } });
    const t0 = pl.play({ events: ev, lenBeats: BARS * 4, bpm: BPM, countInBeats: 4, click: b => (b < 0 ? (b === -4 ? 2 : 1) : b % 4 === 0 ? 2 : 1), ...opts });
    window.__plEv = ev;
    return { t0, LOOKAHEAD, n: ev.length };
  }, [BARS, BPM, opts || {}]);
  const sampleWindow = ms => page.evaluate(async ms => {
    const A = window.__A, ctx = A.getCtx(), pl = window.__player, st = A.kitStats();
    const dur = { kick: st.maxSec.kick, snare: st.maxSec.snare, hhClosed: st.maxSec.hhClosed, hhOpen: st.maxSec.hhOpen };
    const out = { worst: 0, latest: 0, samples: 0 };
    const t1 = performance.now() + ms;
    while (performance.now() < t1 && pl.state.playing) {
      const now = ctx.currentTime, s = pl.state, sec = s.beatSec;
      const tm = b => s.t0 + b * sec;
      let win = 0;
      for (const e of window.__plEv) { const t = tm(e.beat); if (t <= now + 1.75 && t + dur[e.piece] > now - 0.1) win++; }
      for (let b = -s.countIn; b < s.lenBeats; b++) { const t = tm(b); if (t <= now + 1.75 && t + 0.4 > now - 0.1) win++; }
      const n = A.scheduledCount();
      const pend = window.__pl.filter(x => !x.__cancel && x.__at > now);
      const latest = pend.reduce((m, x) => Math.max(m, x.__at - now), 0);
      out.samples++;
      out.latest = Math.max(out.latest, latest);
      if (n > 2 * win) out.over = { n, win, beat: +s.beat.toFixed(2) };
      out.worst = Math.max(out.worst, n);
      await new Promise(r => setTimeout(r, 50));
    }
    return out;
  }, ms);

  // 5a + 5b
  const p = await mkPlay();
  const w1 = await sampleWindow(11000);   // 預備拍 2 秒 + 4.5 小節
  if (w1.over) fail(`player 時間窗:第 ${w1.over.beat} 拍排程中 ${w1.over.n} 個節點 > 2 × 時間窗內 ${w1.over.win} 個`);
  if (!(w1.latest > 1)) fail(`player 沒有往前排(最遠 ${w1.latest.toFixed(2)} 秒;測試沒有記到節點?)`);
  if (w1.latest > p.LOOKAHEAD + 0.25) fail(`player 往前排了 ${w1.latest.toFixed(2)} 秒(上限 ${p.LOOKAHEAD} 秒)`);
  const rt = await page.evaluate(BPM2 => {
    const A = window.__A, pl = window.__player, ctx = A.getCtx();
    const before = pl.state;
    const at = ctx.currentTime;
    pl.retempo(BPM2);
    return { at, from: at + 0.06, beatFrom: pl.timeToBeat(at + 0.06), oldT0: before.t0, oldSec: before.beatSec, t0: pl.state.t0, sec: pl.state.beatSec };
  }, BPM2);
  const w2 = await sampleWindow(5000);
  if (w2.over) fail(`改速度後時間窗:第 ${w2.over.beat} 拍排程中 ${w2.over.n} 個 > 2 × ${w2.over.win}`);
  if (w2.latest > p.LOOKAHEAD + 0.25) fail(`改速度後往前排了 ${w2.latest.toFixed(2)} 秒`);
  // 反拍 hi-hat:每一個 = 恰好一個沒被取消的節點(改速度前的照舊時間、之後的照新時間);舊時間 ≥ from 的都被取消
  const dup = await page.evaluate(rt => {
    const nodes = window.__pl.filter(x => !x.__cancel), ctx = window.__A.getCtx(), now = ctx.currentTime;
    const res = { checked: 0, bad: [], stale: 0 };
    for (const e of window.__plEv) {
      if (e.beat % 1 === 0) continue;   // 正拍有大鼓 / 小鼓 + 拍點(交叉淡化兩層),只看反拍的 hi-hat
      const oldT = rt.oldT0 + e.beat * rt.oldSec;
      const t = oldT < rt.from ? oldT : rt.t0 + e.beat * rt.sec;
      if (t > now - 0.05) continue;   // 還沒到的不算(時間窗外可能還沒排)
      const k = nodes.filter(x => Math.abs(x.__at - t) < 0.002).length;
      res.checked++;
      if (k !== 1) res.bad.push(`${e.beat}:${k}`);
      if (oldT >= rt.from && Math.abs(oldT - t) > 0.01 && nodes.some(x => Math.abs(x.__at - oldT) < 0.002 && x.__dur < 1.5)) res.stale++;
    }
    return res;
  }, rt);
  if (dup.bad.length) fail(`改速度後反拍 hi-hat 的節點數不是 1:${dup.bad.slice(0, 8).join("、")}${dup.bad.length > 8 ? "…" : ""}(共 ${dup.checked} 個)`);
  if (dup.stale) fail(`改速度後還有 ${dup.stale} 個 hi-hat 留在舊時間`);
  if (dup.checked < 20) fail(`改速度後只檢查到 ${dup.checked} 個反拍`);
  // 5c. stop()
  const s1 = await page.evaluate(async () => {
    const A = window.__A, pl = window.__player, ctx = A.getCtx();
    const stopAt = ctx.currentTime;
    pl.stop();
    const future = window.__pl.filter(x => !x.__cancel && x.__at > stopAt + 0.01).length;
    const ring = Math.max(0, ...window.__pl.filter(x => !x.__cancel && x.__at <= stopAt + 0.01).map(x => x.__at + x.__dur - ctx.currentTime));
    const made0 = window.__pl.length;
    await new Promise(r => setTimeout(r, Math.min(8000, ring * 1000 + 400)));
    return { future, ring, after: A.scheduledCount(), madeAfter: window.__pl.length - made0, playing: pl.state.playing, end: window.__plEnd };
  });
  if (s1.future) fail(`stop() 之後還有 ${s1.future} 個還沒開始的節點沒取消`);
  if (s1.madeAfter) fail(`stop() 之後又排了 ${s1.madeAfter} 個節點`);
  if (s1.after) fail(`stop() 後響完(${s1.ring.toFixed(1)} 秒)排程中還有 ${s1.after} 個節點`);
  if (s1.playing || s1.end) fail(`stop() 後 playing=${s1.playing}、onEnd 被叫了 ${s1.end} 次(中途停止不算播完)`);
  // stop(true):立刻歸零
  await mkPlay();
  await page.waitForTimeout(3000);
  const s2 = await page.evaluate(async () => { window.__player.stop(true); await new Promise(r => setTimeout(r, 300)); return window.__A.scheduledCount(); });
  if (s2) fail(`stop(true) 後 300 ms 排程中還有 ${s2} 個節點`);
  // 5d. 切到背景
  await mkPlay();
  await page.waitForTimeout(2500);
  const bg = await page.evaluate(async () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await new Promise(r => setTimeout(r, 300));   // 計時器至少跑兩次
    const m0 = window.__pl.length;
    await new Promise(r => setTimeout(r, 1500));
    const r = { playing: window.__player.state.playing, made: window.__pl.length - m0 };
    delete document.hidden; delete document.visibilityState;
    return r;
  });
  if (bg.playing || bg.made) fail(`頁面隱藏後播放器還在跑(playing=${bg.playing}、又排了 ${bg.made} 個節點)`);
  // 自然播完:onEnd 一次
  const end = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    let n = 0;
    const pl = createPlayer({ onEnd: () => n++ });
    pl.play({ events: [{ beat: 0, piece: "snare", vel: 0.8 }, { beat: 1, piece: "kick", vel: "ff" }], lenBeats: 2, bpm: 240, countInBeats: 2 });
    await new Promise(r => setTimeout(r, 1800));
    return { n, playing: pl.state.playing };
  });
  if (end.n !== 1 || end.playing) fail(`自然播完:onEnd ${end.n} 次、playing=${end.playing}`);
  await page.evaluate(() => window.__A.stopAll());
  if (bad === n0) ok(`共用播放器 24 小節(${p.n} 個鼓組事件):排程中最多 ${Math.max(w1.worst, w2.worst)} 個節點,每個時刻都 ≤ 2 × 時間窗內的事件,最遠只往前排 ${Math.max(w1.latest, w2.latest).toFixed(2)} 秒;` +
    `第 ${rt.beatFrom.toFixed(1)} 拍改速度 ${BPM}→${BPM2}:${dup.checked} 個反拍 hi-hat 各一個節點、不重複;stop() 後不再排、響完歸零,stop(true) 立刻歸零;切到背景自己停;自然播完 onEnd 一次`);
}

// 6. 共用播放器的其他行為(細項見檔頭第 6 項)
{
  const n0 = bad;
  await page.evaluate(() => {
    window.__errs = [];
    window.addEventListener("error", e => window.__errs.push(e.message));
    const C = AudioNode.prototype;
    if (!C.__pl6) { C.__pl6 = true; const c0 = C.connect; C.connect = function(dest){ if (this instanceof AudioBufferSourceNode) this.__dest = dest; return c0.apply(this, arguments); }; }
  });
  // 播一段,等播完(或 ms),回傳這段排的節點(相對第一拍的拍子)、state、回呼紀錄
  const run6 = (opts, ms) => page.evaluate(async ([opts, ms]) => {
    const { createPlayer } = await import("./js/shared/player.js");
    const log = { end: 0, stop: [], late: [] };
    const m0 = window.__pl.length;
    const pl = createPlayer({ onEnd: () => log.end++, onStop: r => log.stop.push(r), onLate: x => log.late.push(x) });
    const t0 = pl.play(opts);
    const sec = 60 / opts.bpm;
    await new Promise(r => setTimeout(r, ms));
    const nodes = window.__pl.slice(m0).filter(x => !x.__cancel).map(x => ({ beat: +((x.__at - t0) / sec).toFixed(3), strong: x.__dest && x.__dest.gain ? x.__dest.gain.value === 1 : null }));
    return { t0, nodes, state: pl.state, log };
  }, [opts, ms]);
  const beatsOf = r => [...new Set(r.nodes.map(x => x.beat))].sort((a, b) => a - b);

  // 6a. gaps:[2, 4) 裡的事件不出聲,其他照常;沒有 click、預備拍 0 → 沒有拍點
  {
    const ev = [0, 1, 2, 3, 4, 5, 6, 7].map(beat => ({ beat, piece: "snare", vel: "mf" }));
    const r = await run6({ events: ev, lenBeats: 8, bpm: 240, countInBeats: 0, gaps: [[2, 4]] }, 2600);
    const b = beatsOf(r).join();
    if (b !== "0,1,4,5,6,7") fail(`gaps [2,4):有聲音的拍子應該是 0,1,4,5,6,7,實際 ${b}`);
    if (r.state.sent !== 6 || r.state.dropped || r.state.failed || r.log.end !== 1) fail(`gaps:sent ${r.state.sent}(6)、dropped ${r.state.dropped}、failed ${r.state.failed}、onEnd ${r.log.end}`);
  }
  // 6b. 預設拍點:只有預備拍響(-3 重、-2 -1 弱),第一拍之後不響
  {
    const r = await run6({ events: [], lenBeats: 2, bpm: 240, countInBeats: 3 }, 1700);
    const got = r.nodes.map(x => `${x.beat}${x.strong ? "!" : ""}`).sort().join();
    if (got !== "-1,-2,-3!") fail(`預設拍點:應該是 -3(重)、-2、-1,實際 ${got}`);
    if (r.state.sent !== 3) fail(`預設拍點:sent ${r.state.sent}(應該 3)`);
  }
  // 6c. onTick:每一格畫面一次、拍子一直往前、= 「聽到的」拍子(輸出延遲 0.1 秒、沒有 getOutputTimestamp 時晚 0.1 秒 ÷ 每拍秒數)
  const tick = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    const ctx = window.__A.getCtx();
    const out = {};
    for (const mode of ["api", "latency"]) {
      if (mode === "latency") { ctx.getOutputTimestamp = undefined; Object.defineProperty(ctx, "outputLatency", { configurable: true, get: () => 0.1 }); }
      const ticks = [];
      let pl;
      pl = createPlayer({ onTick: b => ticks.push({ b, raw: pl.timeToBeat(ctx.currentTime) }) });
      pl.play({ events: [], lenBeats: 4, bpm: 120, countInBeats: 2 });
      await new Promise(r => setTimeout(r, 1200));
      pl.stop();
      if (mode === "latency") { delete ctx.getOutputTimestamp; delete ctx.outputLatency; }
      const d = ticks.map(t => t.raw - t.b);
      out[mode] = { n: ticks.length, mono: ticks.every((t, i) => !i || t.b >= ticks[i - 1].b - 1e-6), first: ticks.length ? ticks[0].b : NaN,
        dMin: Math.min(...d), dMax: Math.max(...d) };
    }
    return out;
  });
  for (const [mode, t] of Object.entries(tick)) {
    if (t.n < 20 || !t.mono || !(t.first >= -2.6)) fail(`onTick(${mode}):1.2 秒 ${t.n} 次、遞增 ${t.mono}、第一下 ${t.first}`);
  }
  if (!(tick.api.dMin >= -0.01 && tick.api.dMax <= 0.6)) fail(`onTick(getOutputTimestamp):聽到的拍子應該 ≤ 排程的拍子、差不到 0.3 秒,實際差 ${tick.api.dMin.toFixed(3)}–${tick.api.dMax.toFixed(3)} 拍`);
  if (!(Math.abs(tick.latency.dMin - 0.2) < 0.02 && Math.abs(tick.latency.dMax - 0.2) < 0.02)) fail(`onTick(沒有 getOutputTimestamp、outputLatency 0.1 秒):應該晚 0.2 拍,實際 ${tick.latency.dMin.toFixed(3)}–${tick.latency.dMax.toFixed(3)}`);
  // 6d. onTick 裡 stop():不出錯、停下來、不再叫 onTick;onTick 裡重新 play():只有一條 rAF(onTick 次數 ≤ 畫面數)
  const reent = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    window.__errs.length = 0;
    let pl, n = 0;
    pl = createPlayer({ onTick: () => { n++; if (n === 3) pl.stop(); } });
    pl.play({ events: [{ beat: 0, piece: "snare" }], lenBeats: 4, bpm: 120, countInBeats: 4 });
    await new Promise(r => setTimeout(r, 600));
    const stopRes = { n, playing: pl.state.playing };
    let restarted = 0, ticks = 0, frames = 0, counting = false;
    const pl2 = createPlayer({ onTick: () => { if (counting) ticks++; if (restarted < 1) { restarted++; pl2.play({ events: [], lenBeats: 8, bpm: 60, countInBeats: 0 }); } } });
    pl2.play({ events: [], lenBeats: 8, bpm: 120, countInBeats: 4 });
    await new Promise(r => setTimeout(r, 300));
    counting = true;
    await new Promise(res => { const t1 = performance.now() + 1000; const f = () => { frames++; if (performance.now() < t1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    counting = false;
    const playing2 = pl2.state.playing; pl2.stop(true);
    return { stopRes, ticks, frames, playing2, errs: [...window.__errs] };
  });
  if (reent.stopRes.n !== 3 || reent.stopRes.playing) fail(`onTick 裡 stop():之後又叫了 onTick(共 ${reent.stopRes.n} 次,應該 3)或還在播 ${reent.stopRes.playing}`);
  if (!reent.playing2 || reent.ticks > reent.frames + 2) fail(`onTick 裡重新 play():1 秒 onTick ${reent.ticks} 次 > 畫面 ${reent.frames} 格(兩條 rAF),或沒有在播 ${reent.playing2}`);
  if (reent.errs.length) fail(`onTick 裡 stop / play 出錯:${reent.errs.join(";")}`);
  // 6e. 看不到時 play():不丟例外、回傳 NaN、沒有在播、不排節點;播放中切到背景:onStop("hidden") 一次
  const hid = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    const stops = [];
    const pl = createPlayer({ onStop: r => stops.push(r) });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    const m0 = window.__pl.length;
    let msg = null, ret;
    try { ret = pl.play({ events: [{ beat: 0, piece: "snare" }], lenBeats: 4, bpm: 120 }); } catch (e) { msg = String(e); }
    await new Promise(r => setTimeout(r, 300));
    const a = { msg, ret: String(ret), playing: pl.state.playing, made: window.__pl.length - m0 };
    delete document.hidden;
    pl.play({ events: [{ beat: 0, piece: "snare" }], lenBeats: 16, bpm: 120 });
    await new Promise(r => setTimeout(r, 300));
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    await new Promise(r => setTimeout(r, 400));
    delete document.hidden;
    return { a, stops, playing: pl.state.playing };
  });
  if (hid.a.msg || hid.a.ret !== "NaN" || hid.a.playing || hid.a.made) fail(`看不到時 play():例外 ${hid.a.msg}、回傳 ${hid.a.ret}、playing ${hid.a.playing}、排了 ${hid.a.made} 個節點`);
  if (hid.stops.join() !== "hidden" || hid.playing) fail(`播放中切到背景:onStop 應該叫一次("hidden"),實際 ${JSON.stringify(hid.stops)}、playing ${hid.playing}`);
  // 6f. 漏音:主執行緒卡 2.5 秒 → 晚了的不補播,算進 dropped、onLate 有通知;sent + dropped = 全部事件
  const drop = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    const late = [];
    const ev = [];
    for (let b = 0; b < 16; b += 0.25) ev.push({ beat: b, piece: "hhClosed", vel: "mp" });
    const pl = createPlayer({ onLate: x => late.push(x) });
    pl.play({ events: ev, lenBeats: 16, bpm: 240, countInBeats: 0 });
    await new Promise(r => setTimeout(r, 300));
    const t = performance.now(); while (performance.now() - t < 2500) {}
    await new Promise(r => setTimeout(r, 3000));
    return { s: pl.state, n: ev.length, late, lateSum: late.reduce((a, x) => a + x.n, 0) };
  });
  if (!(drop.s.dropped > 0) || drop.lateSum !== drop.s.dropped || !drop.late.length || drop.late[drop.late.length - 1].dropped !== drop.s.dropped) fail(`漏音:dropped ${drop.s.dropped}、onLate ${drop.late.length} 次合計 ${drop.lateSum}`);
  if (drop.s.sent + drop.s.dropped + drop.s.failed !== drop.n) fail(`漏音:sent ${drop.s.sent} + dropped ${drop.s.dropped} + failed ${drop.s.failed} ≠ ${drop.n} 個事件`);
  // 6g. bpm 不合法 → RangeError、沒有在播;超出 lenBeats(與預備拍之前)的事件不播;自然播完後 stop(true) 收掉還在響的尾音
  const misc = await page.evaluate(async () => {
    const { createPlayer } = await import("./js/shared/player.js");
    const A = window.__A, pl = createPlayer({});
    const errs = [];
    for (const bpm of [0, -60, NaN, undefined, "120"]) { try { pl.play({ events: [], lenBeats: 4, bpm }); errs.push("沒丟"); } catch (e) { errs.push(e.name); } }
    const playing = pl.state.playing;
    pl.play({ events: [{ beat: -9, piece: "snare" }, { beat: 0, piece: "snare" }, { beat: 1, piece: "kick" }, { beat: 2, piece: "snare" }, { beat: 5, piece: "kick" }], lenBeats: 2, bpm: 120, countInBeats: 2 });
    const evN = pl.state.events;
    pl.stop(true);
    let ended = 0;
    const pl2 = createPlayer({ onEnd: () => ended++ });
    pl2.play({ events: [{ beat: 0, piece: "hhOpen", vel: "ff" }], lenBeats: 1, bpm: 240, countInBeats: 0 });
    await new Promise(r => setTimeout(r, 900));
    const before = A.scheduledCount(), ret = pl2.stop(true);
    await new Promise(r => setTimeout(r, 150));
    return { errs, playing, evN, ended, before, ret, after: A.scheduledCount() };
  });
  if (misc.errs.some(e => e !== "RangeError") || misc.playing) fail(`bpm 不合法:應該都丟 RangeError,實際 ${misc.errs.join()}、playing ${misc.playing}`);
  if (misc.evN !== 2) fail(`超出 lenBeats / 預備拍之前的事件:應該只留 2 個,實際 ${misc.evN}`);
  if (misc.ended !== 1 || !(misc.before > 0) || misc.ret !== false || misc.after !== 0) fail(`自然播完後 stop(true):onEnd ${misc.ended}、之前還在響 ${misc.before}、回傳 ${misc.ret}、之後 ${misc.after}(應該 0)`);
  await page.evaluate(() => window.__A.stopAll());
  if (bad === n0) ok(`共用播放器其他行為:gaps 不出聲、預設拍點只有預備拍(第一下重)、onTick 每格一次且扣輸出延遲(沒有 API 時晚 ${tick.latency.dMin.toFixed(2)} 拍)、` +
    `onTick 裡 stop / play 不出錯(重新 play 後 1 秒 ${reent.ticks} 次 / ${reent.frames} 格)、看不到時 play() 回傳 NaN、切到背景叫 onStop、` +
    `卡 2.5 秒漏 ${drop.s.dropped} 個(onLate ${drop.late.length} 次,sent ${drop.s.sent} + dropped = ${drop.n})、bpm 不合法丟 RangeError、超出範圍的事件不播、播完後 stop(true) 收掉尾音`);
}

// 7. 視奏的整組鼓播放(js/sight/app.js + meter.js):聽正確版本照時間軸排程(player 的 sent = 真的排進 audio 的數目)
//  7a. Trinity 4 級(換到有 x/8 的題目:播放器用八分音符當一拍)♩=240 播完:sent = 事件(含裝飾音)+ 拍點(meter.js 的 clickAt;拍點開),failed、dropped = 0
//  7b. RSL 4 級拍點關掉:sent = 事件 + 預備拍 + 自由發展兩小節的拍點(自由發展沒有鼓聲、只有拍點)
//  7c. 播放中換語言不停;按 ▶ 停止後 300 ms 排程中的節點 = 0
{
  const n0 = bad;
  const sightGo = async (sys, g) => {
    await page.evaluate(([s, g]) => { window.__shell.setExam(s, g); window.__shell.showView("sight", String(g)); }, [sys, g]);
    await waitFor(() => window.__sight.state.drawn > 0 && window.__sight.state.loaded && window.__sight.state.loading == null, null, 60000);
  };
  const expected = clickOn => page.evaluate(async clickOn => {
    const { clickAt } = await import("./js/sight/meter.js");
    const S = window.__sight, tl = S.timeline, b = S.state.bpm, u = tl.unit;
    const inDev = q => !!(S.test.develop && q >= tl.bars[S.test.develop.from].start - 1e-6);
    const evs = S.eventsAt(b).filter(e => e.beat >= -tl.countIn.len - 1e-9 && e.beat < tl.len - 1e-9);
    let clicks = 0, devClicks = 0;
    for (let x = -tl.countIn.len / u; x < tl.len / u - 1e-9; x++) { const q = x * u, c = clickAt(tl, x); if (c && (q < 0 || inDev(q) || clickOn)) { clicks++; if (inDev(q)) devClicks++; } }
    return { ev: evs.length, devEv: evs.filter(e => inDev(e.beat)).length, clicks, devClicks, unit: u, times: S.test.times || [S.test.time] };
  }, clickOn);
  const listenToEnd = async () => {
    await page.evaluate(() => document.getElementById("s-play").click());
    await waitFor(() => window.__sight.state.kind === "listen", null, 20000);
    await waitFor(() => !window.__sight.state.play, null, 120000);
    await page.waitForTimeout(200);
    return page.evaluate(() => window.__sight.state);
  };
  // 7a
  await sightGo("trinity", 4);
  for (let k = 0; k < 30 && !(await page.evaluate(() => window.__sight.timeline.unit === 0.5)); k++) {
    const d = await page.evaluate(() => window.__sight.state.drawn); await page.evaluate(() => window.__sight.newTest());
    await waitFor(d => window.__sight.state.drawn > d && window.__sight.state.loading == null && window.__sight.state.loaded, d, 60000);
  }
  await page.evaluate(() => { window.__sight.SS.clickPerform = true; window.__sight.setBpm(240); });
  const ea = await expected(true), sa = await listenToEnd();
  if (ea.unit !== 0.5) fail(`Trinity 4 級 30 題都沒有 x/8(${ea.times.join()})`);
  if (sa.sent !== ea.ev + ea.clicks || sa.failed || sa.dropped) fail(`Trinity 4 級(${ea.times.join(" ")})播完:sent ${sa.sent}(應該 事件 ${ea.ev} + 拍點 ${ea.clicks})、failed ${sa.failed}、dropped ${sa.dropped}`);
  // 7b
  await sightGo("rsl", 4);
  await page.evaluate(() => { window.__sight.SS.clickPerform = false; window.__sight.setBpm(240); });
  const eb = await expected(false), sb = await listenToEnd();
  if (eb.devEv !== 0) fail(`RSL 4 級自由發展的小節有 ${eb.devEv} 個鼓聲事件`);
  if (eb.devClicks !== 8) fail(`RSL 4 級自由發展的拍點 ${eb.devClicks} 個(應該 2 小節 × 4)`);
  if (sb.sent !== eb.ev + eb.clicks || sb.failed || sb.dropped) fail(`RSL 4 級(拍點關)播完:sent ${sb.sent}(應該 事件 ${eb.ev} + 預備拍與自由發展的拍點 ${eb.clicks})、failed ${sb.failed}、dropped ${sb.dropped}`);
  // 7c
  await page.evaluate(() => { window.__sight.SS.clickPerform = true; window.__sight.setBpm(80); document.getElementById("s-play").click(); });
  await waitFor(() => window.__sight.state.kind === "listen", null, 20000); await page.waitForTimeout(1500);
  await page.click("#langToggle"); await page.waitForTimeout(500);
  const still = await page.evaluate(() => window.__sight.state.play && window.__sight.state.kind === "listen");
  if (!still) fail("視奏播放中換語言,播放停了");
  await page.evaluate(() => document.getElementById("s-play").click()); await page.waitForTimeout(300);
  const left = await page.evaluate(async () => (await import("./js/shared/audio.js")).scheduledCount());
  if (left || (await page.evaluate(() => window.__sight.state.play))) fail(`視奏按停止 300 ms 後還有 ${left} 個排程中的節點`);
  await page.click("#langToggle"); await page.waitForTimeout(300);
  await page.evaluate(() => { window.__sight.SS.clickPerform = true; });
  if (bad === n0) ok(`視奏整組鼓播放:Trinity 4 級(${ea.times.join(" ")},八分音符一拍)送出 ${sa.sent} = 事件 ${ea.ev} + 拍點 ${ea.clicks};RSL 4 級拍點關 ${sb.sent} = 事件 ${eb.ev} + 預備拍與自由發展拍點 ${eb.clicks}(自由發展沒有鼓聲);換語言不停、停止後排程歸零`);
}

// 8. 聽力
{
  const n0 = bad;
  await page.evaluate(() => { window.__shell.setExam("rsl", 2); window.__shell.showView("ear", "fill"); });
  await waitFor(() => window.__ear.state.key === "rsl-2-fill");
  await page.evaluate(() => window.__ear.listen());
  await waitFor(() => window.__ear.state.kind === "listen", null, 60000);
  await page.waitForTimeout(800);
  const zh = await page.evaluate(() => document.getElementById("e-feedback").textContent);
  await page.click("#langToggle"); await page.waitForTimeout(500);
  const r1 = await page.evaluate(() => ({ kind: window.__ear.state.kind, play: window.__ear.play, fb: document.getElementById("e-feedback").textContent, perf: document.getElementById("e-performBtn").textContent }));
  if (r1.kind !== "listen" || !r1.play) fail(`聽力 換語言停止了播放(${JSON.stringify(r1)})`);
  if (r1.fb === zh || /[\u4e00-\u9fff]/.test(r1.perf)) fail(`聽力 換語言後文字沒換:「${zh}」→「${r1.fb}」、按鈕「${r1.perf}」`);
  await page.click("#langToggle"); await page.waitForTimeout(300);
  const key = await page.evaluate(() => window.__ear.state.key);
  await page.click('#tabbar button[data-view="tech"]'); await page.waitForTimeout(400);
  const r2 = await page.evaluate(() => ({ play: window.__ear.play, kind: window.__ear.state.kind, sched: window.__A ? window.__A.scheduledCount() : 0 }));
  if (r2.play || r2.kind) fail(`聽力 離開分頁還在播放(${JSON.stringify(r2)})`);
  await page.click('#tabbar button[data-view="ear"]'); await page.waitForTimeout(400);
  if ((await page.evaluate(() => window.__ear.state.key)) !== key) fail("聽力 回到分頁換了題目(leave 不該清題目)");
  // Trinity:空檔只有拍點
  await page.evaluate(() => { window.__shell.setExam("trinity", 1); window.__shell.showView("ear", "playback"); });
  await waitFor(() => window.__ear.state.key === "trinity-1-playback");
  await page.evaluate(() => { window.__pl = []; window.__ear.setBpm(240); window.__ear.perform(); });
  await waitFor(() => window.__ear.state.kind === "pass", null, 60000);
  const t0 = await page.evaluate(() => window.__ear.perfT0());
  await waitFor(() => window.__ear.state.kind === null, null, 90000);
  const g = await page.evaluate(t0 => {
    const tl = window.__ear.tl, sec = 60 / (240 * 2), out = { you: 0, app: 0, badYou: [], clicks: 0 };
    const clickTimes = [];
    for (let b = -tl.countIn; b < tl.len; b++) {
      const bar = tl.bars.filter(x => x.start <= b).pop(); if (!bar || b >= bar.start + bar.len) continue;
      let acc = 0, on = b === bar.start; for (const x of bar.groups) { acc += x; if (b - bar.start === acc && acc < bar.len) on = true; }
      if (on) clickTimes.push(t0 + b * sec);
    }
    out.clicks = clickTimes.length;
    const nodes = (window.__pl || []).filter(n => !n.__cancel && n.__at >= t0 - tl.countIn * sec - 0.01);
    for (const sg of tl.segs.filter(x => x.kind !== "ci")) {
      const a = t0 + sg.u0 * sec, z = t0 + sg.u1 * sec;
      const inSeg = nodes.filter(n => n.__at >= a - 0.005 && n.__at < z - 0.005);
      if (sg.kind === "app") { out.app += inSeg.length; continue; }
      out.you += inSeg.length;
      for (const n of inSeg) {
        const c = clickTimes.find(t => Math.abs(t - n.__at) < 0.004);
        if (c == null) out.badYou.push(+(n.__at - t0).toFixed(3));
      }
      const per = new Map(); for (const n of inSeg) { const k = Math.round(n.__at * 1000); per.set(k, (per.get(k) || 0) + 1); }
      for (const [k, v] of per) if (v > 1) out.badYou.push(`${k / 1000 - t0}×${v}`);
    }
    return out;
  }, t0);
  if (!(g.app > 0)) fail(`聽力 Trinity:App 播的句子沒有聲音節點(${JSON.stringify(g)};測試沒有記到?)`);
  if (g.badYou.length) fail(`聽力 Trinity:學生打的空檔有拍點以外的聲音(${g.badYou.slice(0, 8).join(", ")})`);
  if (!(g.you > 0)) fail("聽力 Trinity:空檔沒有拍點");
  await page.evaluate(() => window.__ear.perform());
  await waitFor(() => window.__ear.state.kind === "pass", null, 60000);
  // 第一句的空檔裡點一下(有敲擊才會列每一句),再快轉
  await page.evaluate(() => new Promise(res => {
    const E = window.__ear, tl = E.tl, g = tl.segs.find(x => x.kind === "you"), sec = 60 / (240 * 2);
    const t = () => { const A = window.__A, now = A.getCtx().currentTime - (E.perfT0() || 0); if (now > g.u0 * sec + 0.05) { document.querySelector('#e-pads .tap-pad[data-lane="drum"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); res(); } else setTimeout(t, 20); };
    t();
  }));
  const res = await page.evaluate(() => { window.__ear.finishNow(); return { st: window.__ear.state, rows: document.querySelectorAll("#e-alongResult .e-phrases li").length, n: window.__ear.q.phrases.length }; });
  if (res.st.phase !== "result" || res.rows !== res.n) fail(`聽力 Trinity 第二次:每一句一列回饋,實際 ${res.rows} / ${res.n} 句(${res.st.phase})`);
  await page.evaluate(() => window.__ear.setBpm(80));
  if (bad === n0) ok(`聽力:播放中換語言不停、離開分頁停止(題目保留);Trinity 空檔只有拍點(App 段 ${g.app} 個節點、空檔 ${g.you} 個拍點)、第二次每一句一列回饋`);
}

for (const e of errors) fail("console:" + e);
await close();
console.log(bad ? `✗ ${bad} 項問題` : "✓ 播放排程與停止全部通過");
process.exit(bad ? 1 : 0);
