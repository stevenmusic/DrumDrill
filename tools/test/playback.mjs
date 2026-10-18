// 播放的排程與停止(Playwright):
//  1. 技巧 #20 Flam,♩=240,循環播放 20 輪:每輪自然播完時,還排著的聲音節點 ≤「照每個節點的 stop 時間,這時候還在響的」節點數
//     (測試把 AudioBufferSourceNode 的 start/stop 時間記下來,門檻就是實際值;播完的節點自己移除,不會越積越多)
//  1b. 循環 + 每輪 +4(ramp)跑 5 輪:每輪播完時「排程中 − 還在響」不增加(= 0,沒有一輪一輪累積),速度 +20;
//      另外看「排程中」本身的趨勢:每一輪都比前一輪多、而且累積超過一輪節點數的 5%(至少 3 個)= 低於上限的緩慢累積(上面的比較抓不到)
//  2. 播放中按停止:300ms 後排程中的節點 = 0,技巧的播放狀態是停止
//  3. 切到背景(visibilitychange → hidden):播放停止;回到前景不會自己開始播
//  4. 播放中換語言:不停止播放,題目、選擇器、按鈕文字換成新語言
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
// 記下每個聲音節點的 stop 時間(audio.js:鼓聲 stop 在 min(長度, 2.5 秒)、拍點 0.4 秒;停止時 stopAll 再 stop 一次)
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

for (const e of errors) fail("console:" + e);
await close();
console.log(bad ? `✗ ${bad} 項問題` : "✓ 播放排程與停止全部通過");
process.exit(bad ? 1 : 0);
