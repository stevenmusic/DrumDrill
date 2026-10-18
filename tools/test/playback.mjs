// 播放的排程與停止(Playwright):
//  1. 技巧 #20 Flam,♩=240,循環播放 20 輪:每輪自然播完時,還排著的聲音節點 ≤ 一輪的節點數 + 拍點數(播完的節點自己移除,不會越積越多)
//  2. 播放中按停止:300ms 後排程中的節點 = 0,技巧的播放狀態是停止
//  3. 切到背景(visibilitychange → hidden):播放停止;回到前景不會自己開始播
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
const click = () => page.click("#t-playBtn");

// 1. 循環 20 輪
{
  const r = await setup(20, 240, { loop: true });
  const ends0 = (await state()).lastEnd.n;
  await click();
  const seen = [];
  for (let k = 1; k <= 20; k++) {
    try { await waitFor(n => window.__tech.state.lastEnd.n >= n, ends0 + k, 30000); }
    catch (e) { fail(`第 ${k} 輪沒有自然播完`); break; }
    const s = await state();
    seen.push(s.lastEnd.scheduled);
    if (s.lastEnd.scheduled > r.perRound) fail(`第 ${k} 輪播完時還排著 ${s.lastEnd.scheduled} 個節點 > 一輪 ${r.perRound}(音 ${r.notes} + 拍點 ${r.clicks})`);
  }
  if (!bad) ok(`#20 Flam ♩=240 循環 20 輪:每輪播完時排程中的節點 ${Math.min(...seen)}–${Math.max(...seen)} ≤ 一輪 ${r.perRound}`);
  await click();   // 停止
  await page.waitForTimeout(300);
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

for (const e of errors) fail("console:" + e);
await close();
console.log(bad ? `✗ ${bad} 項問題` : "✓ 播放排程與停止全部通過");
process.exit(bad ? 1 : 0);
