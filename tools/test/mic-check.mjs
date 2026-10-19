// 麥克風節奏評分(選用;docs/STAGES.md S15):照 PianoDrill tools/sight/mic-check.js,改用 Chromium 的假麥克風
//   node tools/test/mic-check.mjs            全部(node 側偵測準確度 + 瀏覽器端到端)
//   ONLY=node|sight|ear node tools/test/mic-check.mjs
// 測試訊號:用 Naked Drums 取樣(ScrollScore 的 drums/*.flac,跟 App 一樣)在已知時間點混成 WAV,只給假麥克風用,不給使用者聽。
// 1. node 側:同樣的混音(App 真的出的題目:視奏 RSL Debut–5、Trinity Playback 2、5 級,照題目的速度與力度;固定種子)→ js/shared/timing.js 的 detectHits
//    (onsets.js 的 detectOnsets,hop 5 ms、refractory 0.05 秒,分頻帶、分段)→ 偵測誤差中位數 ≤ 5 ms、漏偵 ≤ 2%;
//    多偵:小鼓 ≤ 2%、全部 ≤ 5%
// 2. 瀏覽器:--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>(檔案在按「正式打」之前才寫好:
//    Chromium 在 getUserMedia 時才讀),整個 App 照真的流程跑(開關、權限、預備拍、錄音、分析、結果):
//    視奏 RSL 3 級(小鼓,♩=150):準時 / 偏晚 250 ms / 開麥克風時 AudioContext 被打斷 / 亂打 / 沒聲音 / 拒絕權限;視奏 RSL 4 級(整組鼓合併一條,官方速度)準時;
//    聽力 RSL Fill 準時;聽力 Trinity Playback 第二次準時(混進 App 自己那一句的鼓聲,dropBleed 要拿掉);
//    聽力 RSL 模擬考:Fill 錄完馬上被打斷不中止、過了緩衝時間才打斷照樣中止
//    預備拍的拍點也混進去(慢 60 ms、小聲),模擬喇叭被麥克風收到
import { open } from "./harness.mjs";
import { detectHits } from "../../js/shared/timing.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ONLY = process.env.ONLY || "";
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "drumdrill-mic-"));
const SR = 48000;
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };
/* 題目要每次一樣(出題用 Math.random 的種子):頁面的 Math.random 換成固定種子的 mulberry32 */
const SEEDED = seed => `(() => { let s = ${seed} >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

/* 在頁面裡混音(OfflineAudioContext;取樣從 ScrollScore 下載,harness 會快取):hits = [{ time(秒), piece(App 的鼓件 id), vel(0–1) }]
   → 單聲道 16-bit WAV(base64)或 Float32(base64);attack = 每個取樣檔真正開始響的位置(第一個 ≥ 峰值 10% 的取樣,秒) */
async function mixInPage(page, hits, seconds, { format = "wav", gainScale = 1 } = {}){
  return page.evaluate(async ({ hits, seconds, SR, format, gainScale }) => {
    const ROOT = "https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/drums/";
    const MAP = { snare: "snare", kick: "kick", xstick: "xstick", tomHi: "tom1", tomMid: "tom3", tomFloor: "tom5", hh: "hhClosed", hhClosed: "hhClosed",
      hhOpen: "hhOpen", hhFoot: "hhPedal", ride: "ride", rideBell: "rideBell", crash: "crashL" };
    const man = window.__mixMan || (window.__mixMan = await (await fetch(ROOT + "manifest.json")).json());
    const cache = window.__mixBufs || (window.__mixBufs = {});
    const dec = new OfflineAudioContext(1, 1, SR);
    async function buf(name, layer, rr){
      const p = man.pieces[name], file = `${p.prefix}-L${layer + 1}.${String(rr).padStart(2, "0")}.flac`;
      if (!cache[file]) cache[file] = await dec.decodeAudioData(await (await fetch(ROOT + file)).arrayBuffer());
      return cache[file];
    }
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR);
    const attack = {};
    let i = 0;
    for (const h of hits) {
      const name = MAP[h.piece] || h.piece, p = man.pieces[name];
      if (!p) throw new Error("no sample " + h.piece);
      const v = Math.max(0.05, Math.min(1, h.vel == null ? 0.7 : h.vel));
      const layer = Math.min(p.layers.length - 1, Math.floor(v * p.layers.length));
      const rr = 1 + (i++ % Math.min(3, p.layers[layer].rr));
      const b = await buf(name, layer, rr);
      if (attack[b.length] == null) {
        const d = b.getChannelData(0); let pk = 0; for (let k = 0; k < Math.min(d.length, SR); k++) pk = Math.max(pk, Math.abs(d[k]));
        let a = 0; while (a < d.length && Math.abs(d[a]) < pk * 0.1) a++;
        attack[b.length] = a / SR;
      }
      h.attack = attack[b.length];
      if (h.time < 0) continue;
      const src = ctx.createBufferSource(); src.buffer = b;
      const g = ctx.createGain(); g.gain.value = (0.01 + 0.99 * v * v) * 0.5 * gainScale;
      src.connect(g).connect(ctx.destination); src.start(h.time);
    }
    const out = (await ctx.startRendering()).getChannelData(0);
    let peak = 0; for (const x of out) peak = Math.max(peak, Math.abs(x));
    const norm = peak > 0.9 ? 0.9 / peak : 1;
    let bytes;
    if (format === "f32") { const f = new Float32Array(out.length); for (let k = 0; k < out.length; k++) f[k] = out[k] * norm; bytes = new Uint8Array(f.buffer); }
    else {
      const n = out.length, ab = new ArrayBuffer(44 + n * 2), dv = new DataView(ab), w = (o, s) => { for (let k = 0; k < s.length; k++) dv.setUint8(o + k, s.charCodeAt(k)); };
      w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
      for (let k = 0; k < n; k++) dv.setInt16(44 + k * 2, Math.max(-32767, Math.min(32767, Math.round(out[k] * norm * 32767))), true);
      bytes = new Uint8Array(ab);
    }
    let bin = ""; for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
    return { b64: btoa(bin), attacks: hits.map(h => h.attack) };
  }, { hits, seconds, SR, format, gainScale });
}
function silentWav(seconds){
  const n = Math.ceil(seconds * SR), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  // 很小的雜音(房間底噪),不是完全 0
  let s = 1; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; buf.writeInt16LE(Math.round((s / 2147483647 - 0.5) * 20), 44 + i * 2); }
  return buf;
}
const median = v => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
function rng(seed){ return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ── 1. node 側:偵測準確度 ──
   混音的內容 = App 真的出的題目(照題目的速度、力度):視奏 RSL Debut–5 各一題、Trinity Playback 2、5 級各一份(整組鼓,含鈸一直在響、Flam / Drag 的裝飾音),
   一題接一題(中間空 1.5 秒)。答案 = 每一個主音(裝飾音不算;落在同一時間 40 ms 內的算一下,跟評分一樣) */
async function collectPlans(page){
  const plans = [];
  const sightPlan = async (sys, g) => {
    await page.evaluate(([sys, g]) => { if (sys === "trinity") window.__shell.setExam("trinity", g); window.__sight.goto("trinity", g); }, [sys, g]);
    await page.waitForFunction(([sys, g]) => { const s = window.__sight.state; return s.key === `${sys}-${g}`; }, [sys, g], { timeout: 30000 });
    const p = await page.evaluate(() => window.__sight.micPlan());
    plans.push({ name: `視奏 ${sys} ${g}`, ...p });
  };
  for (const g of [0, 1, 2, 3, 4, 5]) await sightPlan("rsl", g);
  for (const g of [2, 5]) await sightPlan("trinity", g);
  return plans;
}
async function nodeSide(){
  const { page, ctx, close } = await open(IPHONE);
  await ctx.addInitScript(SEEDED(20261018));
  await page.evaluate(() => { localStorage.setItem("drumdrill.v1", JSON.stringify({ onboarded: true, view: "sight", exam: null })); });
  await page.reload();
  await page.waitForFunction(() => window.__stageReady >= 1 && window.__sight && window.__sight.state.key, null, { timeout: 30000 });
  const plans = await collectPlans(page);
  const hits = [], truth = [], planOf = [];
  let at = 0.5;
  plans.forEach((p, pi) => {
    for (const h of p.pieces) hits.push({ time: at + h.time, piece: h.piece, vel: typeof h.vel === "number" ? h.vel : 0.7 });
    let last = -1;
    for (const t of p.expected) { if (t - last > 0.04) { truth.push(at + t); planOf.push(pi); } last = t; }
    at += Math.max(...p.expected) + 1.5;
  });
  const seconds = at + 1;
  const { b64, attacks } = await mixInPage(page, hits, seconds, { format: "f32" });
  await close();
  const samples = new Float32Array(new Uint8Array(Buffer.from(b64, "base64")).buffer);
  const det = detectHits(samples, SR);
  // 每一個答案的「真正開始響的位置」= 同一時間(40 ms 內)第一個取樣開始響的地方
  const truthA = truth.map(t => Math.min(...hits.map((h, i) => (Math.abs(h.time - t) <= 0.04 ? h.time + attacks[i] : Infinity))));
  const errsA = [], errs = []; let missed = 0;
  const used = new Set(), missList = [];
  truth.forEach((t, k) => {
    let bi = -1, be = Infinity;
    det.forEach((d, j) => { const e = Math.abs(d - truthA[k]); if (!used.has(j) && e < be) { be = e; bi = j; } });
    if (bi >= 0 && be <= 0.03) { used.add(bi); errsA.push(det[bi] - truthA[k]); errs.push(det[bi] - t); } else { missed++; missList.push(t); plans[planOf[k]].missed = (plans[planOf[k]].missed || 0) + 1; }
  });
  const extra = det.length - used.size;
  const medAbs = median(errsA.map(Math.abs)) * 1000, medSched = median(errs.map(Math.abs)) * 1000;
  console.log(`node 側:${plans.map(p => p.name).join("、")}(${seconds.toFixed(0)} 秒)· 答案 ${truth.length} 下、偵測到 ${det.length}`);
  console.log(`  誤差中位數 ${medAbs.toFixed(1)} ms(取樣真正開始響的位置;對排定的時間 ${medSched.toFixed(1)} ms)· 漏 ${missed}(${(missed / truth.length * 100).toFixed(1)}%)· 多 ${extra}(${(extra / truth.length * 100).toFixed(1)}%)`);
  console.log("  各題漏掉:" + plans.map((p, i) => `${p.name} ${p.missed || 0}/${planOf.filter(x => x === i).length}`).join("、"));
  if (process.env.DEBUG) {
    console.log("  漏掉的:", missList.slice(0, 20).map(t => `${t.toFixed(3)}[${hits.filter(h => Math.abs(h.time - t) <= 0.04).map(h => h.piece + ":" + h.vel.toFixed(2)).join("+")}]`).join(" "));
    fs.writeFileSync(process.env.DEBUG, JSON.stringify({ hits, truth, attacks, sr: SR, b64 }));
  }
  // 全部:誤差中位數 ≤ 5 ms、漏偵 ≤ 2%(docs/STAGES.md S15);小鼓(RSL Debut–3)多偵也 ≤ 2%。
  // 整組鼓的多偵:鈸的餘音起伏、大鼓筒鼓的低中頻再脹一次(detectHits 已經濾掉大部分),目前約 3%:門檻 ≤ 5%,數字照實印出來
  const snareIdx = plans.map((p, i) => (/rsl [0-3]$/.test(p.name) ? i : -1)).filter(i => i >= 0);
  const sn = truth.filter((_, k) => snareIdx.includes(planOf[k])).length, snMiss = snareIdx.reduce((a, i) => a + (plans[i].missed || 0), 0);
  const snSpan = [Math.min(...truth.filter((_, k) => snareIdx.includes(planOf[k]))) - 0.5, Math.max(...truth.filter((_, k) => snareIdx.includes(planOf[k]))) + 0.5];
  const snExtra = det.filter((d, j) => !used.has(j) && d >= snSpan[0] && d <= snSpan[1]).length;
  console.log(`  小鼓(RSL Debut–3):${sn} 下,漏 ${snMiss}、多 ${snExtra};整組鼓:漏 ${missed - snMiss}、多 ${extra - snExtra}`);
  ok(medAbs <= 5, `node 側:偵測誤差中位數 ${medAbs.toFixed(1)} ms(要 ≤ 5)`);
  ok(snMiss / sn <= 0.02 && snExtra / sn <= 0.02, `node 側:小鼓漏偵 ${snMiss}、多偵 ${snExtra} / ${sn}(要都 ≤ 2%)`);
  ok(missed / truth.length <= 0.02, `node 側:全部漏偵 ${missed} / ${truth.length}(要 ≤ 2%)`);
  ok(extra / truth.length <= 0.05, `node 側:全部多偵 ${extra} / ${truth.length}(要 ≤ 5%)`);
}

/* ── 2. 瀏覽器端到端 ── */
const fakeArgs = wav => ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}%noloop`];
/* 開 App(假麥克風讀 wav;wav 稍後才寫)。store = drumdrill.* 的 localStorage */
async function openApp(wav, store){
  const app = await open({ ...IPHONE, args: fakeArgs(wav) });
  await app.ctx.addInitScript(SEEDED(7));
  await app.page.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); }, { "drumdrill-lang": "zh", ...store });
  await app.page.reload();
  await app.page.waitForFunction(() => window.__stageReady >= 1, null, { timeout: 30000 });
  return app;
}
/* 照計畫混音:App 在拿到麥克風之後 0.15 秒開始預備拍(player.js START_DELAY),預備拍之後是第一拍。
   假麥克風的檔案大約從拿到麥克風那一刻開始放,所以 wav 的第一拍放在 LEAD = 0.15 + 預備拍(誤差是固定的,評分會先扣掉)。
   預備拍的拍點(xstick)晚 60 ms、小聲混進去,模擬喇叭的聲音被收進去 */
const LEAD0 = 0.17;
function planHits(plan, mode, r){
  const lead = LEAD0 + plan.countIn, beat = 60 / plan.bpm, out = [];
  const nIn = Math.round(plan.countIn / beat);
  for (let k = 0; k < nIn; k++) out.push({ time: LEAD0 + k * beat + 0.06, piece: "xstick", vel: 0.35 });
  const src = plan.pieces || plan.expected.map(time => ({ time, piece: "snare", vel: 0.8 }));
  if (mode === "sloppy") {
    const len = Math.max(...plan.expected) + beat;
    plan.expected.forEach(() => out.push({ time: lead + r() * len, piece: "snare", vel: 0.8 }));
  } else for (const h of src) out.push({ time: lead + h.time + (mode === "late" ? 0.25 : 0), piece: h.piece, vel: h.vel == null || typeof h.vel === "string" ? 0.8 : h.vel });
  for (const h of plan.app || []) out.push({ time: lead + h.time + 0.06, piece: h.piece, vel: 0.45 });   // Trinity:App 自己那一句(喇叭被收進去)
  return out;
}
async function writeWav(page, wav, plan, mode, seconds){
  if (mode === "silent") { fs.writeFileSync(wav, silentWav(seconds)); return; }
  const { b64 } = await mixInPage(page, planHits(plan, mode, rng(5)), seconds);
  fs.writeFileSync(wav, Buffer.from(b64, "base64"));
}

async function sightTake(mode, grade = 3, bpm = 150, { bump = false } = {}){
  const wav = path.join(TMP, `sight-${grade}-${mode}.wav`);
  // 視奏分頁的分類 + 難度(RSL 0–3 = 節奏難度 1–4、RSL 4–5 = 律動難度 1–2)
  const cat = grade <= 3 ? "rhythm" : "groove", lv = grade <= 3 ? grade + 1 : grade - 3;
  const { page, errors, close } = await openApp(wav, { "drumdrill.v1": { onboarded: true, view: "sight", exam: null, mic: true, sub: { sight: cat } }, "drumdrill.sight.v1": { level: { [cat]: lv } } });
  await page.waitForFunction(k => { const s = window.__sight && window.__sight.state; return s && s.key === k && s.drawn > 0 && s.loaded; }, `${cat}-${lv}`, { timeout: 60000 });
  if (bpm) await page.evaluate(b => window.__sight.setBpm(b), bpm);   // 練習速度(短一點);null = 這一題的官方速度
  const plan = await page.evaluate(() => window.__sight.micPlan());
  const seconds = LEAD0 + plan.countIn + Math.max(...plan.expected) + 3;
  await writeWav(page, wav, plan, mode, seconds);
  if (mode === "denied") await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); }; });
  // 開麥克風的時候 AudioContext 被「打斷」(iOS 切換工作階段):外框 leave + enter,打開之後還是要照樣開始
  if (bump) await page.evaluate(async () => {
    const a = await import("./js/shared/audio.js"), orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async c => { await a.ensureAudio().suspend(); await new Promise(r => setTimeout(r, 150)); return orig(c); };
  });
  await page.click("#s-playAlong");
  await page.waitForFunction(() => window.__sight.state.phase === "result", null, { timeout: (seconds + 30) * 1000 });
  const out = await page.evaluate(() => ({ r: window.__sight.state.result, mic: window.__sight.lastMic, text: document.getElementById("s-alongResult").innerText.replace(/\s+/g, " "),
    note: document.getElementById("s-alongMicNote").textContent, checked: document.getElementById("s-alongMic").checked, micActive: window.__sight.state.micActive }));
  if (errors.length) problems.push(`視奏 ${mode}:` + errors.join(" | "));
  await close();
  return { ...out, plan };
}
async function earTake(type, grade, mode = "exact"){
  const wav = path.join(TMP, `ear-${type}-${grade}.wav`);
  const sys = type === "playback" ? "trinity" : "rsl";
  const { page, errors, close } = await openApp(wav, { "drumdrill.v1": { onboarded: true, view: "ear", exam: null, mic: true, sub: { ear: type } },
    "drumdrill.ear.v1": { grades: { rsl: grade, trinity: grade } } });
  await page.waitForFunction(k => { const s = window.__ear && window.__ear.state; return s && s.key === k; }, `${sys}-${grade}-${type}`, { timeout: 60000 });
  if (sys === "trinity") {
    await page.evaluate(() => window.__ear.setBpm(150));
    await page.click("#e-performBtn");   // 第一次(練習,不錄音):馬上結束
    await page.waitForFunction(() => window.__ear.state.kind === "pass", null, { timeout: 60000 });
    await page.evaluate(() => window.__ear.finishNow());
  } else {
    await page.click("#e-playBtn");      // 聽題目(兩次):馬上結束
    await page.waitForFunction(() => window.__ear.state.kind === "listen", null, { timeout: 60000 });
    await page.evaluate(() => window.__ear.finishNow());
  }
  const plan = await page.evaluate(() => window.__ear.micPlan());
  const last = Math.max(...plan.expected, ...(plan.app || []).map(x => x.time));
  const seconds = LEAD0 + plan.countIn + last + 3;
  await writeWav(page, wav, plan, mode, seconds);
  await page.click("#e-performBtn");
  await page.waitForFunction(() => { const s = window.__ear.state; return s.phase === "result" || s.phase === "choose"; }, null, { timeout: (seconds + 30) * 1000 });
  const out = await page.evaluate(() => ({ r: window.__ear.state.result, mic: window.__ear.lastMic, text: document.getElementById("e-alongResult").innerText.replace(/\s+/g, " ") }));
  if (errors.length) problems.push(`聽力 ${type}:` + errors.join(" | "));
  await close();
  return { ...out, plan };
}
/* 聽力 RSL 模擬考(Fill → Groove):Fill 用麥克風回打完、選譜之前 iOS 切回只播放的工作階段(AudioContext 被「打斷」,外框 leave + enter):
   錄完之後 SETTLE_MS 內的打斷是自己造成的,模擬考不能中止;過了之後的打斷照樣中止 */
async function earMockSettle(){
  const wav = path.join(TMP, "ear-mock-fill-3.wav");
  const { page, errors, close } = await openApp(wav, { "drumdrill.v1": { onboarded: true, view: "exam", exam: { system: "rsl", grade: 3 }, mic: true, sub: { exam: "ear" } } });
  // 檢定頁(還沒有題目):考試資料載好以後 startMock 才會開始
  await page.waitForFunction(() => { const E = window.__ear; if (!E || !E.state || E.state.mode !== "exam") return false; if (E.mock.state !== "run") E.startMock(); return E.mock.state === "run"; }, null, { timeout: 60000, polling: 500 });
  await page.waitForFunction(() => window.__ear.state.kind === "listen", null, { timeout: 60000 });
  await page.evaluate(() => window.__ear.finishNow());
  await page.waitForFunction(() => !window.__ear.state.kind && !document.getElementById("e-performBtn").disabled, null, { timeout: 30000 });
  const plan = await page.evaluate(() => window.__ear.micPlan());
  const seconds = LEAD0 + plan.countIn + Math.max(...plan.expected) + 3;
  await writeWav(page, wav, plan, "exact", seconds);
  await page.click("#e-performBtn");
  await page.waitForFunction(() => window.__ear.state.phase === "choose", null, { timeout: (seconds + 30) * 1000 });
  const suspend = () => page.evaluate(async () => { const a = await import("./js/shared/audio.js"); await a.ensureAudio().suspend(); });
  await suspend(); await page.waitForTimeout(400);
  const soon = await page.evaluate(() => ({ st: window.__ear.mock.state, phase: window.__ear.state.phase, answers: !document.getElementById("e-answers").hidden }));
  await page.evaluate(async () => { const a = await import("./js/shared/audio.js"); await a.ensureAudio().resume(); });
  await page.waitForTimeout(2000);
  await suspend(); await page.waitForTimeout(400);
  const later = await page.evaluate(() => ({ st: window.__ear.mock.state, reason: window.__ear.mock.reason }));
  if (errors.length) problems.push("聽力模擬考:" + errors.join(" | "));
  await close();
  return { soon, later };
}
const show = (name, x) => console.log(`${name.padEnd(14)} ${x.r ? `分數 ${x.r.score} 命中 ${x.r.hits}/${x.r.total}` : "—"}${x.mic ? ` · 偵測 ${x.mic.detected.length}(拿掉 App 的聲音 ${x.mic.removed},延遲 ${x.mic.lagMs} ms)` : ""} | ${x.text.slice(0, 120)}`);

async function sightSide(){
  const exact = await sightTake("exact");
  show("視奏 準時", exact);
  ok(exact.r && exact.r.score >= 85, `視奏準時:分數 ${exact.r && exact.r.score}(要 ≥ 85)`);
  ok(/麥克風/.test(exact.text) && /不是官方評分/.test(exact.text) && /只評時間/.test(exact.text), "視奏準時:結果要標「麥克風」「不是官方評分」「只評時間」");
  ok(exact.mic && exact.mic.removed >= 2, `視奏準時:預備拍的拍點要被拿掉(拿掉 ${exact.mic && exact.mic.removed})`);
  ok(!exact.micActive, "視奏準時:打完麥克風要關掉");
  const offExact = (exact.text.match(/慢約 (\d+)/) || [])[1];

  const late = await sightTake("late");
  show("視奏 偏晚", late);
  ok(late.r && late.r.score >= 85, `視奏偏晚 250 ms:固定延遲被扣分了(${late.r && late.r.score})`);
  const lateMs = Number((late.text.match(/慢約 (\d+)/) || [])[1]);
  ok(lateMs >= 200 + (Number(offExact) || 0) - 60 && lateMs <= 300 + (Number(offExact) || 0) + 60, `視奏偏晚 250 ms:說明寫慢約 ${lateMs} 毫秒(準時那次 ${offExact || 0})`);

  const bumped = await sightTake("exact", 3, 150, { bump: true });
  show("視奏 打開時被打斷", bumped);
  ok(bumped.r && bumped.r.score >= 85 && /麥克風/.test(bumped.text), `視奏:開麥克風時 AudioContext 被打斷(外框 leave + enter)要照樣開始、照樣評分(${bumped.r && bumped.r.score})`);

  const sloppy = await sightTake("sloppy");
  show("視奏 亂打", sloppy);
  ok(sloppy.r && sloppy.r.score < 50, `視奏亂打:分數 ${sloppy.r && sloppy.r.score}(要 < 50)`);

  const silent = await sightTake("silent");
  show("視奏 沒聲音", silent);
  ok(/沒有聽到鼓聲/.test(silent.text), "視奏沒聲音:要說明沒有聽到鼓聲");

  const denied = await sightTake("denied");
  show("視奏 拒絕權限", denied);
  ok(/沒有取得麥克風權限/.test(denied.note) && /沒有取得麥克風權限/.test(denied.text), "視奏拒絕權限:開關下面與結果都要說明");
  ok(/觸控鼓墊/.test(denied.text), "視奏拒絕權限:這一次照觸控鼓墊評分");
  ok(denied.checked, "視奏拒絕權限:開關不自己關掉(下次再試)");

  // 整組鼓用這一題的官方速度(RSL 4 約 ♩=90):已知限制(timing.js detectHits)是比官方快很多時(♩=150),crash 還在響的時候同時的輕 hi-hat 會漏(約兩成)
  const kit = await sightTake("exact", 4, null);
  show("視奏 整組鼓", kit);
  if (process.env.DEBUG) console.log("  expected", kit.mic.expected.map(t => t.toFixed(3)).join(" "), "\n  detected", kit.mic.detected.map(t => t.toFixed(3)).join(" "), "\n  pieces", JSON.stringify(kit.plan.pieces.map(h => [h.time.toFixed(3), h.piece, h.vel])));
  // 命中門檻 93%:node 側同樣的混音漏偵 ≤ 2%(上面);瀏覽器端多了假麥克風開始放的時間、AudioContext 排程的抖動,每次會再差一兩下
  // (這一題約 54 下,一兩下 = 2–4%)。95% 太接近會偶爾失敗;90% 太鬆,偵測真的變差(漏好幾下輕 hi-hat 那種)也會過。93% = 最多漏 3 下
  ok(kit.r && kit.r.score >= 85 && kit.r.hits / kit.r.total >= 0.93, `視奏 RSL 4 整組鼓(合併一條、官方速度)準時:分數 ${kit.r && kit.r.score}、命中 ${kit.r && kit.r.hits}/${kit.r && kit.r.total}(要 ≥ 85、≥ 93%)`);
}
async function earSide(){
  const fill = await earTake("fill", 3);
  show("聽力 Fill", fill);
  if (process.env.DEBUG) console.log("  expected", fill.mic.expected.map(t => t.toFixed(3)).join(" "), "\n  detected", fill.mic.detected.map(t => t.toFixed(3)).join(" "), "\n  all", fill.mic.all.map(t => t.toFixed(3)).join(" "));
  ok(fill.r && fill.r.score >= 85, `聽力 Fill 準時:分數 ${fill.r && fill.r.score}(要 ≥ 85)`);
  ok(/麥克風/.test(fill.text) && /不是官方評分/.test(fill.text), "聽力 Fill:結果要標「麥克風」「不是官方評分」");
  const pb = await earTake("playback", 1);
  show("聽力 Playback", pb);
  const x = pb.r;
  ok(x && x.rows && x.rows.every(s => s >= 80), `聽力 Trinity 第二次準時:每一句 ${x && x.rows}(要都 ≥ 80)`);
  ok(pb.mic && pb.mic.removed >= Math.min(5, pb.plan.app.length / 2), `聽力 Trinity:App 自己那一句的鼓聲要被拿掉(拿掉 ${pb.mic && pb.mic.removed} / App ${pb.plan.app.length} 下)`);
  const ms = await earMockSettle();
  console.log(`聽力模擬考 錄完被打斷  馬上:${JSON.stringify(ms.soon)} · 2 秒後:${JSON.stringify(ms.later)}`);
  ok(ms.soon.st === "run" && ms.soon.phase === "choose" && ms.soon.answers, `聽力模擬考:錄完 ${1.5} 秒內被打斷(iOS 切回只播放)模擬考不能中止、選譜要還在(${JSON.stringify(ms.soon)})`);
  ok(ms.later.st !== "run", `聽力模擬考:錄完過了緩衝時間的打斷照樣中止(${JSON.stringify(ms.later)})`);
}

try {
  if (!ONLY || ONLY === "node") await nodeSide();
  if (!ONLY || ONLY === "sight") await sightSide();
  if (!ONLY || ONLY === "ear") await earSide();
} finally { if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true }); else console.log("wav:", TMP); }
if (problems.length) { console.error("\n✗ " + problems.length + " 項問題:\n - " + problems.join("\n - ")); process.exit(1); }
console.log("\n✓ 麥克風節奏評分全部通過");
