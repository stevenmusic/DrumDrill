// 整組鼓的取樣與播放(Playwright;js/shared/audio.js 的 loadKit / playKit / unloadKit,docs/STAGES.md S6):
//  1. 載入 12 個鼓件(背景補完 round-robin)後,每層的錄音數 = min(manifest 的 rr, 上限),
//     解碼後的記憶體(換成 manifest 的 48kHz 算,立體聲 32-bit 浮點)iPhone UA ≤ 85×10⁶ 位元組、桌機 ≤ 170×10⁶ 位元組(十進位)。
//     參考:ScrollScore 在 iOS 的取樣記憶體預算是 160×10⁶ 位元組;本專案 iPhone 實測約 83×10⁶、桌機約 160×10⁶
//  2. 技巧的小鼓跟整組鼓共用同一份 buffer:之後再 loadDrums(["snare"]) 不會多載、進度直接到 1;小鼓的錄音都比 2.5 秒短(拿掉 2.5 秒截斷聲音不變)
//  3. hhOpen 接 hhClosed(或腳踩 hi-hat):還在響的開放 hi-hat 在 DRUM_CHOKE_FADE 內淡出、播放停止
//  3b. hhOpen 在 t 之前、hhClosed 在 t 之後,cancelFrom(t):開放 hi-hat 不會在舊時間被截(音量恢復、停止時間回到錄音結束);
//      之後 stopAll 再打 hhOpen → hhClosed 仍正常截斷
//  4. crash 連打 6 下:同時響(沒被收掉)的 ≤ DRUM_POLY 上限(4),最舊的兩下在 0.65 秒內收掉
//  5. 鼓皮在力度交界同時播兩層(交叉淡化),鈸只播一層
//  6. unloadKit() 之後只剩小鼓;整組鼓不出聲、小鼓照樣出聲;再 loadKit 會重新載入
//  7. 技巧模組的播放(小鼓)照常:按播放有排程、按停止全停
//  8. 聽力(js/ear/app.js):Groove 題目載入整組鼓;離開聽力 unloadMs(實際 60 秒,測試改 1.5 秒)後只剩小鼓;回到聽力按播放會重新載入
// 用法:node tools/test/kitaudio.mjs
import { open } from "./harness.mjs";
let bad = 0;
const fail = m => { bad++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);
const E6 = 1e6;   // 記憶體一律用十進位 10⁶ 位元組(跟 docs/STAGES.md 決定 11、docs/APPSTORE.md 一樣)
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const { page, errors, close } = await open({ viewport: { width: 1280, height: 800 } });

async function run(label, limit){
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "tech", sub: { tech: "roll", exam: "tech" } })); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  const n0 = bad;
  // 1. 載入
  const r = await page.evaluate(async () => {
    const A = await import("./js/shared/audio.js");
    A.ensureAudio(); A.unlockAudio();
    let prog = 0;
    await A.loadKit(undefined, p => { prog = p; });
    const t0 = Date.now();
    while (A.kitStats().pending > 0 && Date.now() - t0 < 240000) await new Promise(r => setTimeout(r, 200));
    const man = await (await fetch("https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/drums/manifest.json")).json();
    return { st: A.kitStats(), prog, man: man.pieces, ua: navigator.userAgent, ids: A.KIT_PIECES };
  });
  const { st, man } = r;
  const names = Object.keys(st.pieces).sort();
  const want = ["crashL", "hhClosed", "hhOpen", "hhPedal", "kick", "ride", "rideBell", "snare", "tom1", "tom3", "tom5", "xstick"];
  if (names.join() !== want.join()) fail(`${label}:載入的鼓件 ${names.join()},應該是 ${want.join()}`);
  if (r.ids.length !== 13) fail(`${label}:KIT_PIECES 應該是 drumkey.json 的 13 個 id,現在 ${r.ids.length}`);
  if (r.prog !== 1) fail(`${label}:第一輪進度停在 ${r.prog}`);
  if (st.pending) fail(`${label}:背景還有 ${st.pending} 個沒載完`);
  const cym = new Set(["hhClosed", "hhOpen", "hhPedal", "ride", "rideBell", "crashL"]);
  let expect48 = 0;
  for (const n of want) {
    const lim = n === "snare" ? st.limits.snare : cym.has(n) ? st.limits.cymbal : st.limits.head;
    const exp = man[n].layers.map(l => Math.min(l.rr, lim));
    man[n].layers.forEach((l, li) => { expect48 += l.frames / l.rr * exp[li] * 8; });
    if ((st.pieces[n] || []).join() !== exp.join()) fail(`${label}:${n} 每層載了 ${(st.pieces[n] || []).join("/")} 個,應該是 ${exp.join("/")}`);
  }
  const e6 = st.bytes48 / E6;
  if (st.bytes48 > limit) fail(`${label}:解碼後 ${e6.toFixed(1)}×10⁶ 位元組 > 上限 ${limit / E6}×10⁶ 位元組(十進位;ScrollScore iOS 預算 160×10⁶,本專案 iPhone 實測約 83×10⁶)`);
  if (Math.abs(st.bytes48 - expect48) / expect48 > 0.01) fail(`${label}:解碼 ${st.bytes48} 位元組,照 manifest 應該 ${Math.round(expect48)}`);
  if (bad === n0) ok(`${label}(上限 鼓皮 ${st.limits.head}、鈸 ${st.limits.cymbal}、小鼓 ${st.limits.snare}):12 個鼓件解碼 ${e6.toFixed(1)}×10⁶ 位元組(跟 manifest 的 frames 一致)≤ 上限 ${limit / E6}×10⁶ 位元組(十進位;ScrollScore iOS 預算 160×10⁶)`);

  // 2. 技巧的小鼓共用同一份 buffer
  const n2 = bad;
  const sn = await page.evaluate(async () => {
    const A = await import("./js/shared/audio.js");
    let p1 = 0, p2 = 0;
    await A.loadDrums(["snare"], p => { p1 = p; });   // 小鼓已經跟整組鼓一起載過:第 1 輪沒有要載的
    await A.loadDrums(["snare"], p => { p2 = p; });   // 同一組再呼叫一次(memo)
    await new Promise(r => setTimeout(r, 500));
    return { ...A.kitStats(), p1, p2 };
  });
  if (sn.pieces.snare.join() !== st.pieces.snare.join()) fail(`${label}:loadDrums(snare) 之後小鼓每層 ${sn.pieces.snare.join("/")} 個(原本 ${st.pieces.snare.join("/")}):沒有共用`);
  if (sn.p1 !== 1 || sn.p2 !== 1) fail(`${label}:已經載過的再載一次,進度停在 ${sn.p1} / ${sn.p2}(應該直接到 1)`);
  if (sn.maxSec.snare >= 2.5) fail(`${label}:小鼓最長的錄音 ${sn.maxSec.snare.toFixed(2)} 秒 ≥ 2.5 秒,拿掉截斷會改變技巧的聲音`);
  if (bad === n2) ok(`${label}:技巧小鼓與整組鼓共用 buffer(再載一次不增加),小鼓最長 ${sn.maxSec.snare.toFixed(2)} 秒 < 2.5 秒`);

  // 3–5. 播放:記下每個聲音節點的 stop 時間
  const p = await page.evaluate(async () => {
    const A = await import("./js/shared/audio.js");
    const P = AudioScheduledSourceNode.prototype;
    if (!P.__wrapped) { const stop0 = P.stop; P.stop = function(w){ this.__stopAt = w || 0; return stop0.apply(this, arguments); }; P.__wrapped = true; }
    const ctx = A.getCtx();
    const wait = s => new Promise(r => setTimeout(r, s * 1000));
    const out = {};
    // 3. hhOpen → hhClosed、hhOpen → hhFoot
    for (const closer of ["hhClosed", "hhFoot"]) {
      const t = ctx.currentTime + 0.1;
      const o = A.playKit("hhOpen", t, 0.8), c = A.playKit(closer, t + 0.3, 0.7);
      await wait(0.6);
      out[closer] = { open: !!o, close: !!c, faded: !!(o && o.faded), gain: o ? o.g.gain.value : null, level: o ? o.level : null,
        stopAt: o ? Math.min(...o.srcs.map(s => s.__stopAt || Infinity)) - (t + 0.3) : null, closedFaded: !!(c && c.faded) };
    }
    // 3b. cancelFrom 取消了 hhClosed:開放 hi-hat 要恢復
    {
      const t = ctx.currentTime + 0.1;
      const o = A.playKit("hhOpen", t, 0.8), c = A.playKit("hhClosed", t + 0.4, 0.7);
      const fadedBefore = !!(o && o.faded);
      A.cancelFrom(t + 0.2);
      await wait(0.8);
      out.cancel = { ok: !!(o && c), fadedBefore, faded: !!(o && o.faded), gain: o ? o.g.gain.value : null, level: o ? o.level : null,
        stopAt: o ? Math.min(...o.srcs.map(s => s.__stopAt || Infinity)) : null, end: o ? o.end : null,
        ringing: (A.kitStats().ringing.hhOpen || []).filter(v => !v.faded).length };
      A.stopAll();
      const t2 = ctx.currentTime + 0.1;
      const o2 = A.playKit("hhOpen", t2, 0.8), c2 = A.playKit("hhClosed", t2 + 0.3, 0.7);
      await wait(0.6);
      out.cancel.after = { faded: !!(o2 && o2.faded), gain: o2 ? o2.g.gain.value : null, level: o2 ? o2.level : null, close: !!c2 };
      A.stopAll();
    }
    // 4. crash 連打 6 下
    const t = ctx.currentTime + 0.1, hits = [];
    for (let k = 0; k < 6; k++) hits.push(A.playKit("crash", t + k * 0.1, 0.8));
    const ring = A.kitStats().ringing.crashL || [];
    out.crash = { n: hits.filter(Boolean).length, faded: hits.map(h => !!(h && h.faded)), ringing: ring.filter(v => !v.faded).length,
      stopAt: hits.map((h, k) => h && h.faded ? Math.min(...h.srcs.map(s => s.__stopAt || Infinity)) - (t + k * 0.1) : null), poly: A.kitStats().poly.crashL };
    // 5. 交叉淡化:大鼓 5 層的交界 27.5(1-27 / 28-52)、crash 3 層的交界 43.5
    const t5 = ctx.currentTime + 0.05;
    const kx = A.playKit("kick", t5, 27.5 / 127), kn = A.playKit("kick", t5 + 0.2, 0.72), cx = A.playKit("crash", t5 + 0.4, 43.5 / 127);
    out.xfade = { kick: kx ? kx.srcs.length : 0, kickMid: kn ? kn.srcs.length : 0, crash: cx ? cx.srcs.length : 0 };
    out.fade = A.kitStats().chokeFade;
    A.stopAll();
    return out;
  });
  const n3 = bad;
  for (const closer of ["hhClosed", "hhFoot"]) {
    const h = p[closer];
    if (!h.open || !h.close) fail(`${label}:hhOpen / ${closer} 沒有聲音`);
    else {
      if (!h.faded) fail(`${label}:hhOpen 接 ${closer},開放 hi-hat 沒有被淡出`);
      if (!(h.gain < h.level * 0.01)) fail(`${label}:hhOpen 接 ${closer} 0.3 秒後,開放 hi-hat 的音量還有 ${h.gain}(原本 ${h.level})`);
      if (!(Math.abs(h.stopAt - (p.fade + 0.02)) < 0.005)) fail(`${label}:開放 hi-hat 在 ${closer} 之後 ${h.stopAt} 秒停止,應該是 ${p.fade + 0.02}`);
      if (h.closedFaded) fail(`${label}:${closer} 自己被收掉了`);
    }
  }
  if (bad === n3) ok(`${label}:hhOpen 接 hhClosed / 腳踩 hi-hat,開放 hi-hat 在 ${p.fade} 秒內淡出(音量 ${p.hhClosed.level.toFixed(3)} → ${p.hhClosed.gain.toExponential(1)}),${(p.fade + 0.02).toFixed(3)} 秒後停止`);
  const n3b = bad, cc = p.cancel;
  if (!cc.ok) fail(`${label}:cancelFrom 測試的 hhOpen / hhClosed 沒有聲音`);
  else {
    if (!cc.fadedBefore) fail(`${label}:cancelFrom 之前,hhOpen 沒有被之後的 hhClosed 收掉(測試前提不成立)`);
    if (cc.faded) fail(`${label}:cancelFrom 取消了 hhClosed,開放 hi-hat 還標成被收掉`);
    if (!(Math.abs(cc.gain - cc.level) < cc.level * 0.01)) fail(`${label}:cancelFrom 之後開放 hi-hat 在舊的截斷時間之後音量 ${cc.gain}(應該維持 ${cc.level})`);
    if (!(Math.abs(cc.stopAt - cc.end) < 0.005)) fail(`${label}:cancelFrom 之後開放 hi-hat 的停止時間 ${cc.stopAt}(應該回到錄音結束 ${cc.end})`);
    if (cc.ringing !== 1) fail(`${label}:cancelFrom 之後還在響的開放 hi-hat ${cc.ringing} 個(應該 1 個)`);
    const a = cc.after;
    if (!a.close || !a.faded || !(a.gain < a.level * 0.01)) fail(`${label}:cancelFrom + stopAll 之後再打 hhOpen → hhClosed 沒有正常截斷(faded ${a.faded}、音量 ${a.gain})`);
  }
  if (bad === n3b) ok(`${label}:hhClosed 被 cancelFrom 取消後,之前的開放 hi-hat 恢復(音量 ${cc.level.toFixed(3)}、照錄音響完);stopAll 後 hhOpen → hhClosed 照常截斷`);
  const n4 = bad, c = p.crash;
  if (c.n !== 6) fail(`${label}:crash 6 下只有 ${c.n} 下有聲音`);
  if (c.ringing > c.poly[0]) fail(`${label}:crash 連打 6 下,同時響 ${c.ringing} 下 > 上限 ${c.poly[0]}`);
  if (c.faded.join() !== "true,true,false,false,false,false") fail(`${label}:crash 被收掉的是 ${c.faded.map((f, i) => f ? i + 1 : "").filter(Boolean).join("、")},應該是最舊的第 1、2 下`);
  if (c.stopAt.slice(0, 2).some((s, k) => !(Math.abs(s - ((k + 4) * 0.1 + c.poly[1] + 0.02 - k * 0.1)) < 0.005))) fail(`${label}:被收掉的 crash 停止時間 ${c.stopAt.slice(0, 2).join(", ")} 不對`);
  if (bad === n4) ok(`${label}:crash 連打 6 下,同時響 ${c.ringing} 下 ≤ DRUM_POLY ${c.poly[0]},最舊的兩下在 ${c.poly[1]} 秒內收掉`);
  const n5 = bad;
  if (p.xfade.kick !== 2) fail(`${label}:大鼓在力度交界只播 ${p.xfade.kick} 層(應該交叉淡化 2 層)`);
  if (p.xfade.kickMid !== 1) fail(`${label}:大鼓一般力度播了 ${p.xfade.kickMid} 層`);
  if (p.xfade.crash !== 1) fail(`${label}:crash 在力度交界播了 ${p.xfade.crash} 層(鈸只播一層)`);
  if (bad === n5) ok(`${label}:大鼓在力度交界交叉淡化 2 層、一般力度 1 層;crash 在交界也只播 1 層`);

  // 6. unloadKit
  const n6 = bad;
  const u = await page.evaluate(async () => {
    const A = await import("./js/shared/audio.js");
    const gone = A.unloadKit();
    const st = A.kitStats(), t = A.getCtx().currentTime + 0.05;
    const kick = A.playKit("kick", t, 0.7), snareKit = !!A.playKit("snare", t + 0.1, 0.7), snare = A.playDrum("snare", t + 0.2, 0.7);
    A.stopAll();
    await A.loadKit(["kick"]);
    const again = A.kitStats().pieces.kick;
    A.unloadKit();
    return { gone, pieces: st.pieces, bytes: st.bytes48, kick: !!kick, snareKit, snare, again, after: Object.keys(A.kitStats().pieces) };
  });
  if (Object.keys(u.pieces).join() !== "snare") fail(`${label}:unloadKit 之後還有 ${Object.keys(u.pieces).join(", ")}`);
  if (u.gone.length !== 11) fail(`${label}:unloadKit 釋放了 ${u.gone.length} 個鼓件(應該 11 個)`);
  if (u.pieces.snare && u.pieces.snare.join() !== st.pieces.snare.join()) fail(`${label}:unloadKit 之後小鼓變成每層 ${u.pieces.snare.join("/")} 個`);
  if (u.kick) fail(`${label}:unloadKit 之後大鼓還有聲音`);
  if (!u.snare || !u.snareKit) fail(`${label}:unloadKit 之後小鼓沒有聲音(playDrum ${u.snare}、playKit ${u.snareKit})`);
  if (!u.again || !u.again.every(n => n >= 1)) fail(`${label}:unloadKit 之後再 loadKit(kick) 沒有重新載入`);
  if (u.after.join() !== "snare") fail(`${label}:第二次 unloadKit 之後還有 ${u.after.join(", ")}`);
  if (bad === n6) ok(`${label}:unloadKit 之後只剩小鼓(${(u.bytes / E6).toFixed(1)}×10⁶ 位元組),大鼓不出聲、小鼓照常;再 loadKit 會重新載入`);

  // 7. 技巧模組照常播放(小鼓)
  const n7 = bad;
  await page.click("#t-playBtn");
  try { await page.waitForFunction(() => window.__tech.state.play && window.__tech.state.scheduled > 0, null, { timeout: 20000 }); }
  catch (e) { fail(`${label}:技巧按播放沒有開始播小鼓`); }
  await page.waitForTimeout(600);
  await page.click("#t-playBtn"); await page.waitForTimeout(300);
  const s = await page.evaluate(() => window.__tech.state);
  if (s.play || s.scheduled) fail(`${label}:技巧按停止後還在播(排程 ${s.scheduled})`);
  if (bad === n7) ok(`${label}:技巧模組的小鼓照常播放、停止`);

  // 8. 聽力:離開後釋放整組鼓
  const n8 = bad;
  const ul = await page.evaluate(() => window.__ear.unloadMs);
  await page.evaluate(() => { window.__ear.unloadMs = 1500; window.__shell.setExam("rsl", 3); window.__shell.showView("ear", "groove"); });
  await page.waitForFunction(() => window.__ear.state.key === "rsl-3-groove", null, { timeout: 20000 });
  try { await page.waitForFunction(async () => { const A = await import("./js/shared/audio.js"); return Object.keys(A.kitStats().pieces).length >= 10 && !document.getElementById("e-loadingMsg").textContent; }, null, { timeout: 120000, polling: 300 }); }
  catch (e) { fail(`${label}:聽力 Groove 沒有載入整組鼓`); }
  await page.click('#tabbar button[data-view="tech"]');
  await page.waitForTimeout(2500);
  const left = await page.evaluate(async () => Object.keys((await import("./js/shared/audio.js")).kitStats().pieces));
  if (left.join() !== "snare") fail(`${label}:離開聽力之後沒有釋放整組鼓(還有 ${left.join(", ")})`);
  await page.click('#tabbar button[data-view="ear"]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__ear.listen());
  try { await page.waitForFunction(() => window.__ear.state.kind === "listen", null, { timeout: 120000 }); } catch (e) { fail(`${label}:釋放後回到聽力不能播放`); }
  await page.evaluate(() => window.__ear.listen());
  const back = await page.evaluate(async () => Object.keys((await import("./js/shared/audio.js")).kitStats().pieces).length);
  if (back < 10) fail(`${label}:釋放後回到聽力沒有重新載入(${back} 個鼓件)`);
  await page.evaluate(ul => { window.__ear.unloadMs = ul; }, ul);
  if (bad === n8) ok(`${label}:聽力載入整組鼓,離開後釋放(只剩小鼓),回來播放會重新載入`);
}

await run("桌機", 170e6);
await page.addInitScript(ua => { Object.defineProperty(Navigator.prototype, "userAgent", { configurable: true, get: () => ua }); }, IPHONE_UA);
await run("iPhone UA", 85e6);
if (errors.length) { bad++; console.log("✗ 錯誤:\n  " + errors.join("\n  ")); }
await close();
console.log(bad ? `✗ ${bad} 項沒通過` : "✓ 整組鼓取樣與播放全部通過");
process.exit(bad ? 1 : 0);
