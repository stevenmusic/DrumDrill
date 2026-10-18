// 整組鼓的取樣與播放(Playwright;js/shared/audio.js 的 loadKit / playKit / unloadKit,docs/STAGES.md S6):
//  1. 載入 12 個鼓件(背景補完 round-robin)後,每層的錄音數 = min(manifest 的 rr, 上限),
//     解碼後的記憶體(換成 manifest 的 48kHz 算,立體聲 32-bit 浮點)iPhone UA ≤ 80 MB、桌機 ≤ 160 MB(MB = 2^20 位元組)
//  2. 技巧的小鼓跟整組鼓共用同一份 buffer:之後再 loadDrums(["snare"]) 不會多載;小鼓的錄音都比 2.5 秒短(拿掉 2.5 秒截斷聲音不變)
//  3. hhOpen 接 hhClosed(或腳踩 hi-hat):還在響的開放 hi-hat 在 DRUM_CHOKE_FADE 內淡出、播放停止
//  4. crash 連打 6 下:同時響(沒被收掉)的 ≤ DRUM_POLY 上限(4),最舊的兩下在 0.65 秒內收掉
//  5. 鼓皮在力度交界同時播兩層(交叉淡化),鈸只播一層
//  6. unloadKit() 之後只剩小鼓;整組鼓不出聲、小鼓照樣出聲;再 loadKit 會重新載入
//  7. 技巧模組的播放(小鼓)照常:按播放有排程、按停止全停
// 用法:node tools/test/kitaudio.mjs
import { open } from "./harness.mjs";
let bad = 0;
const fail = m => { bad++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);
const MB = 1024 * 1024;
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const { page, errors, close } = await open({ viewport: { width: 1280, height: 800 } });

async function run(label, limitMB){
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
  const mb = st.bytes48 / MB;
  if (mb > limitMB) fail(`${label}:解碼後 ${mb.toFixed(1)} MB > ${limitMB} MB`);
  if (Math.abs(st.bytes48 - expect48) / expect48 > 0.01) fail(`${label}:解碼 ${st.bytes48} 位元組,照 manifest 應該 ${Math.round(expect48)}`);
  if (bad === n0) ok(`${label}(上限 鼓皮 ${st.limits.head}、鈸 ${st.limits.cymbal}、小鼓 ${st.limits.snare}):12 個鼓件解碼 ${mb.toFixed(1)} MB(${(st.bytes48 / 1e6).toFixed(1)}×10⁶ 位元組,跟 manifest 的 frames 一致)≤ ${limitMB} MB`);

  // 2. 技巧的小鼓共用同一份 buffer
  const n2 = bad;
  const sn = await page.evaluate(async () => {
    const A = await import("./js/shared/audio.js");
    await A.loadDrums(["snare"]);
    await new Promise(r => setTimeout(r, 500));
    return A.kitStats();
  });
  if (sn.pieces.snare.join() !== st.pieces.snare.join()) fail(`${label}:loadDrums(snare) 之後小鼓每層 ${sn.pieces.snare.join("/")} 個(原本 ${st.pieces.snare.join("/")}):沒有共用`);
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
  if (bad === n6) ok(`${label}:unloadKit 之後只剩小鼓(${(u.bytes / MB).toFixed(1)} MB),大鼓不出聲、小鼓照常;再 loadKit 會重新載入`);

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
}

await run("桌機", 160);
await page.addInitScript(ua => { Object.defineProperty(Navigator.prototype, "userAgent", { configurable: true, get: () => ua }); }, IPHONE_UA);
await run("iPhone UA", 80);
if (errors.length) { bad++; console.log("✗ 錯誤:\n  " + errors.join("\n  ")); }
await close();
console.log(bad ? `✗ ${bad} 項沒通過` : "✓ 整組鼓取樣與播放全部通過");
process.exit(bad ? 1 : 0);
