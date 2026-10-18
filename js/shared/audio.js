// @app-begin
/* 音訊:真實爵士鼓取樣(Naked Drums,ScrollScore 的 drums/,CC-BY 4.0)+ 母帶鏈路,照 PianoDrill / ScrollScore 的引擎。
   不用合成鼓聲。 */
const APP_ID = "drumdrill";
// @app-end
/* PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):`@app-begin … @app-end` 以外兩邊一模一樣,樂器專屬的放在 @app 區段。
   已排程的音訊節點放在 scheduled(Set):每個節點播完(onended)自己移除,stopAll() 全部停掉、cancelFrom(t) 停掉 t 之後的 */
/* ══ 音訊:母帶鏈路照 ScrollScore ══════════════════════════════════
   樂器(@app 區段:鼓組匯流排 + 鼓房殘響 / 鋼琴 EQ + 殘響)→ masterGain → 響度壓縮 → makeup → masterBus → 真峰值限幅器(AudioWorklet)→ masterOut
   限幅器上限 −1.3dBFS(4 倍超取樣量),真峰值 ≤ −1dBTP */
const MASTER = {
  compThreshold: -18, compKnee: 8, compRatio: 3, compAttack: 0.008, compRelease: 0.18, makeup: 1.82,
  ceilingDb: -1.3, lookahead: 0.005, release: 0.09, releaseSlow: 0.7
};
/* 母帶限幅器(AudioWorklet 處理器,用 Blob 載入,維持單檔)——原始碼照抄 ScrollScore 的 SSMasterLimiter:
   4 倍超取樣真峰值偵測(16 點 Kaiser sinc)、預讀 5ms、滑動最小值 + 移動平均、兩段放開、立體聲連動 */
const MASTER_LIMITER_SRC = `
class SSMasterLimiter extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.ceil = Math.pow(10, (p.ceilingDb != null ? p.ceilingDb : -1.2) / 20);
    this.L = Math.max(8, Math.round(sampleRate * (p.lookahead || 0.005)));
    this.relFast = Math.exp(-1 / (sampleRate * (p.release || 0.09)));
    this.relSlow = Math.exp(-1 / (sampleRate * (p.releaseSlow || 0.7)));
    this.hold = Math.exp(-1 / (sampleRate * 0.4)); this.pressUp = 1 - Math.exp(-1 / (sampleRate * 0.3));
    const T = 16, H = 7, beta = 8;
    const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / 2) * (x / 2) / (k * k); s += t; } return s; };
    this.k = [0.25, 0.5, 0.75].map(f => {
      const c = new Float64Array(T); let sum = 0;
      for (let j = 0; j < T; j++) { const t = j - H - f, r = t / (T / 2), w = Math.abs(r) < 1 ? i0(beta * Math.sqrt(1 - r * r)) / i0(beta) : 0;
        c[j] = (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * w; sum += c[j]; }
      for (let j = 0; j < T; j++) c[j] /= sum;
      return c;
    });
    this.T = T; this.H = H;
    this.hist = [new Float64Array(2 * T), new Float64Array(2 * T)]; this.hp = 0;   // 兩倍長:寫在 hp 與 hp+T,讀取時連續
    this.W = this.L + T;
    this.D = this.L + 8;
    let sz = 1; while (sz < this.D + 1) sz <<= 1; this.dmask = sz - 1;
    this.dl = [new Float32Array(sz), new Float32Array(sz)]; this.di = 0;
    let qs = 1; while (qs < this.W + 2) qs <<= 1; this.qmask = qs - 1;
    this.qv = new Float64Array(qs); this.qt = new Float64Array(qs); this.qh = 0; this.qn = 0;
    this.ma = new Float64Array(this.L).fill(1); this.maSum = this.L; this.mi = 0;
    this.env = 1; this.press = 0; this.n = 0;
    this.grMax = 0; this.grSamples = 0; this.total = 0;
    this.port.onmessage = e => {
      if (e.data === "stats") this.port.postMessage({ grMaxDb: -20 * Math.log10(Math.max(1e-9, 1 - this.grMax)), grPct: 100 * this.grSamples / Math.max(1, this.total) });
      else if (e.data && e.data.release) {   // 匯出含鼓的曲子時改快放開(只削尖峰),匯出完再改回來
        this.relFast = Math.exp(-1 / (sampleRate * e.data.release));
        this.relSlow = Math.exp(-1 / (sampleRate * (e.data.releaseSlow || e.data.release)));
      }
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0] || [], out = outputs[0], N = out[0].length;
    const iL = inp[0], iR = inp[1] || inp[0];
    const T = this.T, H = this.H, k0 = this.k[0], k1 = this.k[1], k2 = this.k[2], ceil = this.ceil, L = this.L, W = this.W;
    const hl = this.hist[0], hr = this.hist[1], qv = this.qv, qt = this.qt, qmask = this.qmask, ma = this.ma;
    const d0 = this.dl[0], d1 = this.dl[1], dmask = this.dmask, D = this.D;
    const relFast = this.relFast, relSlow = this.relSlow, hold = this.hold, pressUp = this.pressUp;
    const skip = ceil / 1.5;   // 取樣值都低於上限 −3.5dB 時,取樣之間的峰值不可能超過上限,省掉內插
    let hp = this.hp, qh = this.qh, qn = this.qn, maSum = this.maSum, mi = this.mi, env = this.env, press = this.press, n = this.n, di = this.di;
    let minEnv = 1, grS = 0;
    const oL = out[0], oR = out[1];
    for (let i = 0; i < N; i++) {
      let xl = iL ? iL[i] : 0, xr = iR ? iR[i] : 0;
      if (xl !== xl) xl = 0; if (xr !== xr) xr = 0;
      hl[hp] = xl; hl[hp + T] = xl; hr[hp] = xr; hr[hp + T] = xr;
      hp = (hp + 1) & (T - 1);
      // 最舊的在 hp,連續讀 hl[hp .. hp+T-1];中心 m = hp+H
      let raw = 0;
      for (let j = 0; j < T; j++) { const a = Math.abs(hl[hp + j]), b = Math.abs(hr[hp + j]); if (a > raw) raw = a; if (b > raw) raw = b; }
      let pk = Math.max(Math.abs(hl[hp + H]), Math.abs(hr[hp + H]));
      if (raw > skip) {
        let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0;
        for (let j = 0; j < T; j++) { const vl = hl[hp + j], vr = hr[hp + j]; a0 += k0[j] * vl; a1 += k1[j] * vl; a2 += k2[j] * vl; b0 += k0[j] * vr; b1 += k1[j] * vr; b2 += k2[j] * vr; }
        pk = Math.max(pk, Math.abs(a0), Math.abs(a1), Math.abs(a2), Math.abs(b0), Math.abs(b1), Math.abs(b2));
      }
      const g = pk > ceil ? ceil / pk : 1;
      // 滑動最小值(單調佇列),視窗 W
      while (qn > 0 && qv[(qh + qn - 1) & qmask] >= g) qn--;
      const tail = (qh + qn) & qmask; qv[tail] = g; qt[tail] = n; qn++;
      while (qt[qh] <= n - W) { qh = (qh + 1) & qmask; qn--; }
      n++;
      // 移動平均(長度 L)
      const gmin = qv[qh];
      maSum += gmin - ma[mi]; ma[mi] = gmin; mi = mi + 1 === L ? 0 : mi + 1;
      const gs = Math.min(1, maSum / L);
      // press:最近 0.3 秒有多少時間「需要」壓 0.25dB 以上(看目標增益,不看放開中的尾巴)
      if (gs < 0.97) press += (1 - press) * pressUp; else { press *= hold; if (press < 1e-6) press = 0; }
      if (gs < env) env = gs;
      else { const r = relFast + (relSlow - relFast) * press; env = gs + (env - gs) * r; if (1 - env < 1e-7) env = 1; }
      // 延遲 D 後的音訊乘上增益
      d0[di] = xl; d1[di] = xr;
      const ro = (di - D) & dmask;
      oL[i] = d0[ro] * env; if (oR) oR[i] = d1[ro] * env;
      di = (di + 1) & dmask;
      if (env < minEnv) minEnv = env;
      if (env < 0.999) grS++;
    }
    this.hp = hp; this.qh = qh; this.qn = qn; this.maSum = maSum; this.mi = mi; this.env = env; this.press = press; this.n = n; this.di = di;
    if (1 - minEnv > this.grMax) this.grMax = 1 - minEnv;
    this.grSamples += grS; this.total += N;
    return true;
  }
}
registerProcessor("ss-master-limiter", SSMasterLimiter);
`;
const MASTER_CEIL_RANGE = 2, MASTER_CEIL_KNEE = 0.708, MASTER_CEIL = 0.85;   // 曲線涵蓋 ±2、−3dBFS 起彎、上限 −1.4dBFS
function buildCeilingCurve(){
  const n = 8193, c = new Float32Array(n), T = MASTER_CEIL_KNEE, C = MASTER_CEIL;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) * 2 - 1) * MASTER_CEIL_RANGE, a = Math.abs(x);
    c[i] = a <= T ? x : Math.sign(x) * (T + (C - T) * Math.tanh((a - T) / (C - T)));
  }
  return c;
}

let audioCtx = null, masterGain = null, masterBus = null, masterOut = null, masterLimiterNode = null, masterReady = Promise.resolve(false);
let scheduled = new Set();   // 已排程的 audio nodes:播完自己移除,停止時全部關閉
const REVERB_AMOUNT = 0.3;   // ScrollScore 殘響滑桿的預設值(30)
function buildMaster(){
  /* 樂器的總和先降到 0.48 留動態餘裕,再壓縮 + makeup(照 ScrollScore) */
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.48;
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.value = MASTER.compThreshold; comp.knee.value = MASTER.compKnee; comp.ratio.value = MASTER.compRatio;
  comp.attack.value = MASTER.compAttack; comp.release.value = MASTER.compRelease;
  const makeup = audioCtx.createGain(); makeup.gain.value = MASTER.makeup;
  masterGain.connect(comp); comp.connect(makeup);
  masterBus = audioCtx.createGain(); makeup.connect(masterBus);
  masterOut = audioCtx.createGain(); masterOut.connect(audioCtx.destination);
  /* 備援(不支援 AudioWorklet 才用):快起音壓縮器 + 4 倍超取樣軟削波 */
  const fbLim = audioCtx.createDynamicsCompressor();
  fbLim.threshold.value = -3; fbLim.knee.value = 3; fbLim.ratio.value = 12; fbLim.attack.value = 0.001; fbLim.release.value = 0.25;
  const ceilPre = audioCtx.createGain(); ceilPre.gain.value = 1 / MASTER_CEIL_RANGE;
  const ceilShaper = audioCtx.createWaveShaper(); ceilShaper.curve = buildCeilingCurve(); ceilShaper.oversample = "4x";
  const fbTrim = audioCtx.createGain(); fbTrim.gain.value = Math.pow(10, -1.6 / 20);
  masterBus.connect(fbTrim); fbTrim.connect(fbLim); fbLim.connect(ceilPre); ceilPre.connect(ceilShaper); ceilShaper.connect(masterOut);
  const ctx = audioCtx;
  masterReady = (async () => {
    try {
      if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return false;
      const url = URL.createObjectURL(new Blob([MASTER_LIMITER_SRC], { type: "text/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const lim = new AudioWorkletNode(ctx, "ss-master-limiter", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit",
        processorOptions: { ceilingDb: MASTER.ceilingDb, lookahead: MASTER.lookahead, release: MASTER.release, releaseSlow: MASTER.releaseSlow }
      });
      masterBus.disconnect(fbTrim); masterBus.connect(lim); lim.connect(masterOut);
      masterLimiterNode = lim;
      return true;
    } catch (e) { console.warn("母帶限幅器載入失敗,使用備援:", e); return false; }
  })();
}
/* iPhone 側邊靜音開關打開時,網頁的 Web Audio 預設會被靜音(看起來像按播放沒反應);設成 playback 就照樣有聲音(Safari 17+) */
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
/* 在使用者手勢裡呼叫:讓 AudioContext 開始跑(iOS 要在手勢裡 resume + 播一個無聲的音才算解鎖) */
export function unlockAudio(){
  if (!audioCtx) { try { ensureAudio(); } catch (e) { return; } }
  if (audioCtx instanceof OfflineAudioContext || audioCtx.state === "running") return;
  try {
    audioCtx.resume().catch(() => {});
    const src = audioCtx.createBufferSource(); src.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    src.connect(audioCtx.destination); src.start(0);
  } catch (e) {}
}
/* 取樣解碼用的離線 context:打開網頁就能先下載、解碼,真正的 AudioContext 等第一次點畫面才建立
   (iPhone 加到主畫面後,沒有手勢就建立的 AudioContext 常常永遠叫不醒 → 按播放沒聲音也沒反應)。AudioBuffer 可以跨 context 用 */
let decodeCtx = null;
function dec(){
  if (audioCtx) return audioCtx;
  if (!decodeCtx) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; decodeCtx = new O(2, 1, 48000); }
  return decodeCtx;
}
export function ensureAudio(){
  if (audioCtx && !(audioCtx instanceof OfflineAudioContext)) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC({ latencyHint: "interactive" });
  buildMaster();
  watchState(audioCtx);
  return audioCtx;
}
async function runLimited(jobs, limit){
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => { while (i < jobs.length) { const j = jobs[i++]; await j(); } });
  await Promise.all(workers);
}
/* 取樣檔快取(Cache Storage):第一次下載後存在裝置上,之後直接從本機讀 */
export const SAMPLE_CACHE = APP_ID + "-samples-v1";
let sampleCachePromise = null;
function sampleCache(){
  if (!sampleCachePromise) sampleCachePromise = (typeof caches !== "undefined" && window.isSecureContext)
    ? caches.open(SAMPLE_CACHE).then(async c => { for (const k of await caches.keys()) if (k.startsWith(APP_ID + "-samples-") && k !== SAMPLE_CACHE) caches.delete(k); return c; }).catch(() => null)
    : Promise.resolve(null);
  return sampleCachePromise;
}
async function fetchSample(url){
  if (BUNDLED) return fetch(url);   // App 裡的檔案,不用快取
  const cache = await sampleCache();
  if (cache) { try { const hit = await cache.match(url); if (hit) return hit; } catch (e) {} }
  // 網路卡住時不要永遠等(以前會一直停在「準備中」):25 秒沒下載完就算失敗,再按一次重試
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ac && setTimeout(() => ac.abort(), 25000);
  let res;
  try { res = await fetch(url, ac ? { signal: ac.signal } : undefined); if (res.ok) await res.clone().arrayBuffer(); }
  finally { if (timer) clearTimeout(timer); }
  if (res.ok && cache) { try { await cache.put(url, res.clone()); } catch (e) {} }
  return res;
}
const SAMPLE_FETCH_CONCURRENCY = (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (navigator.deviceMemory && navigator.deviceMemory <= 4)) ? 6 : 12;
// App 版(Capacitor)把取樣打包在 App 裡(tools/build/app-samples.mjs → samples/):第一次打開、沒網路也有聲音,不連 GitHub
const BUNDLED = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
const SAMPLE_ROOT = BUNDLED ? "samples/" : "https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/";   // 網頁版直接讀 ScrollScore 的取樣(公開 repo,可跨網域)

// @app-begin
/* ── 鼓:Naked Drums(Wilkinson Audio,CC-BY 4.0;ScrollScore drums/)──
   每個力度層有 10 個 round-robin(同一層換不同的錄音,連打才不會像機關槍);
   力度照原廠 SFZ(照 ScrollScore 的鼓引擎):5 層的分區 1-27 / 28-52 / 53-77 / 78-102 / 103-127,
   各層錄音音量幾乎一樣(代表輕打 / 重打的音色),大小聲由力度曲線決定:音量 = 0.01 + 0.99 ×(力度/127)²。
   鼓房殘響:drums/room.flac(ScrollScore 用幾何聲學模擬的錄音室,RT60 約 0.55 秒)並聯一點點。
   兩條播放路徑共用同一份 buffer(kit):
   - playDrum:技巧模組的小鼓(維持原本的做法:只挑一層、依序輪播 round-robin)
   - playKit :整組鼓(視奏 / 聽力):照抄 ScrollScore 的 DRUM_VOICES 音量、hi-hat 止音、同一片鈸發聲數上限、鼓皮力度交叉淡化。
   不抄 ScrollScore 的合成備援(synthKick / synthCymbal…):取樣沒載到就不出聲(規則:不用合成鼓聲) */
const DRUM_BASE = SAMPLE_ROOT + "drums/";
const KIT_GAIN = 2.3;          // 照 ScrollScore(OWN_KIT_GAIN)
const ROOM_SEND = 0.22;
/* 照抄 ScrollScore SFZ_VEL_RANGES(原廠 SFZ 的力度分區) */
const SFZ_VEL_RANGES = { 1: [[1, 127]], 2: [[1, 85], [86, 127]], 3: [[1, 43], [44, 85], [86, 127]], 5: [[1, 27], [28, 52], [53, 77], [78, 102], [103, 127]] };
const drumVelGain = s => { const v = Math.max(1, Math.min(127, Math.round(s * 127))) / 127; return 0.01 + 0.99 * v * v; };   // ScrollScore drumVelGain
let drumMan = null, drumManPromise = null;
const kit = {};               // 取樣鼓件(manifest 的名稱)→ [力度層][] = AudioBuffer
const kitReq = {};            // 取樣鼓件 → Map("層.rr" → 下載中 / 已載入的 promise):同一個檔案只下載一次
const kitRR = {};
let kitPending = 0, kitQueued = 0;   // 下載中的檔案數、背景還沒輪到的(kitStats 用)
let roomRaw = null, roomFor = null;
function loadDrumManifest(){
  if (!drumManPromise) drumManPromise = (async () => {
    const r = await fetchSample(DRUM_BASE + "manifest.json");
    if (!r.ok) throw new Error("drum manifest " + r.status);
    drumMan = await r.json();
    return drumMan;
  })().catch(e => { drumManPromise = null; throw e; });
  return drumManPromise;
}
/* round-robin 上限(解碼後是 32-bit 浮點立體聲,每秒 384KB,全部載入很佔記憶體):
   - 技巧的小鼓維持原本:iPhone / 記憶體小的裝置每層 6 個,其他 10 個
   - 整組鼓(docs/STAGES.md 決定 11):iPhone 與小記憶體裝置 鼓皮每層 3 個、鈸 2 個;其他 6 / 4 個
   小鼓兩邊共用同一份 buffer,所以整組鼓的小鼓也照技巧的上限 */
const LOW_MEM = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const RR_LIMIT = LOW_MEM ? 6 : 10;
const KIT_CYMBALS = new Set(["hhClosed", "hhOpen", "hhPedal", "ride", "rideBell", "crashL"]);
const KIT_RR = LOW_MEM ? { head: 3, cymbal: 2 } : { head: 6, cymbal: 4 };
const kitLimit = name => name === "snare" ? RR_LIMIT : KIT_CYMBALS.has(name) ? KIT_RR.cymbal : KIT_RR.head;
/* 載入一個錄音檔(同一個檔案只下載一次);unloadKit 之後才回來的就丟掉,不會塞進重新建立的清單 */
function loadSampleFile(name, li, rr){
  const req = kitReq[name], k = li + "." + rr;
  if (req.has(k)) return req.get(k);
  const layers = kit[name], p = drumMan.pieces[name];
  const file = p.prefix + "-L" + (li + 1) + "." + String(rr).padStart(2, "0") + ".flac";
  kitPending++;
  const job = (async () => {
    try {
      const r = await fetchSample(DRUM_BASE + file);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const b = await dec().decodeAudioData(await r.arrayBuffer());
      if (kit[name] === layers) layers[li].push(b);
    } catch (e) { if (kitReq[name] === req) req.delete(k); }   // 失敗的下次再試
    finally { kitPending--; }
  })();
  req.set(k, job);
  return job;
}
/* 第 1 輪每個力度層各 1 個錄音(載完就能播,力度完整),其餘 round-robin 在背景補到上限 */
async function loadPieces(names, limit, onProgress){
  const man = await loadDrumManifest();
  // 殘響的脈衝響應要跟 AudioContext 同一個取樣率(ConvolverNode 不會自己轉):先留原始檔,接上時再用真正的 context 解碼
  if (!roomRaw) fetchSample(DRUM_BASE + "room.flac").then(r => (r.ok ? r.arrayBuffer() : null)).then(a => { if (a) { roomRaw = a; attachRoom(); } }).catch(() => {});
  const first = [];
  for (const name of names) {
    const p = man.pieces[name]; if (!p) continue;
    if (!kit[name]) { kit[name] = p.layers.map(() => []); kitReq[name] = new Map(); }
    p.layers.forEach((l, li) => { if (!kit[name][li].length) first.push([name, li, 1]); });
  }
  let done = 0;
  await runLimited(first.map(j => async () => { if (kit[j[0]]) await loadSampleFile(...j); done++; if (onProgress) onProgress(done / first.length); }), SAMPLE_FETCH_CONCURRENCY);
  if (names.every(n => !kit[n] || kit[n].every(l => !l.length))) throw new Error("drum samples failed");
  // 其餘 round-robin(背景)
  const rest = [];
  for (const name of names) {
    const p = man.pieces[name]; if (!p || !kit[name]) continue;
    p.layers.forEach((l, li) => { for (let rr = 2; rr <= Math.min(l.rr, limit(name)); rr++) rest.push([name, li, rr]); });
  }
  kitQueued += rest.length;
  runLimited(rest.map(j => async () => { try { if (kit[j[0]]) await loadSampleFile(...j); } finally { kitQueued--; } }), 4);
  return true;
}
const drumJobs = {};
function memo(key, names, fn){
  if (drumJobs[key]) return drumJobs[key];
  const job = drumJobs[key] = fn().catch(e => { if (drumJobs[key] === job) delete drumJobs[key]; throw e; });
  job.names = names;
  return job;
}
/* 技巧模組:載入小鼓(照原本的上限) */
export function loadDrums(pieces = ["snare"], onProgress){
  return memo(pieces.join(","), pieces, () => loadPieces(pieces, () => RR_LIMIT, onProgress));
}
/* 整組鼓:鼓件用 data/drumkey.json 的 id → ScrollScore 的 DRUM_VOICES 音色 → 取樣鼓件(manifest 的名稱)。
   照 ScrollScore DRUM_KEY_VOICE 的 GM 對照:HT(48)→ tom1、MT(45)→ tom3、FT(41)→ tom5、crash(49)→ crash1(取樣 crashL);
   hh 與 hhClosed 是同一個聲音(閉合 hi-hat) */
const KIT_VOICE = {
  snare: "snare", kick: "kick", xstick: "xstick", tomHi: "tom1", tomMid: "tom3", tomFloor: "tom5",
  hh: "hhClosed", hhClosed: "hhClosed", hhOpen: "hhOpen", hhFoot: "hhPedal", ride: "ride", rideBell: "rideBell", crash: "crash1"
};
export const KIT_PIECES = Object.keys(KIT_VOICE);
const kitSample = id => (DRUM_VOICES[KIT_VOICE[id] || id] || {}).piece || id;
export function loadKit(pieces = KIT_PIECES, onProgress){
  const names = [...new Set(pieces.map(kitSample))];
  return memo("kit:" + names.join(","), names, () => loadPieces(names, kitLimit, onProgress));
}
/* 釋放整組鼓(離開視奏 / 聽力一段時間後):刪掉 buffer 與載入紀錄,下次 loadKit 重新載;keep 的鼓件(預設小鼓)保留 */
export function unloadKit(keep = ["snare"]){
  const stay = new Set(keep.map(kitSample));
  const gone = Object.keys(kit).filter(n => !stay.has(n));
  for (const n of gone) {
    delete kit[n]; delete kitReq[n]; delete ringingCymbals[n];
    for (const k of Object.keys(kitRR)) if (k.startsWith(n + ":") || (k.startsWith(n) && /^\d+$/.test(k.slice(n.length)))) delete kitRR[k];   // playKit「名稱:層」、playDrum「名稱層」
  }
  if (ringingOpenHat && gone.includes("hhOpen")) ringingOpenHat = null;
  for (const [k, job] of Object.entries(drumJobs)) if (job.names.some(n => gone.includes(n))) delete drumJobs[k];
  return gone;
}
let drumBus = null, roomIn = null, drumBusCtx = null, roomConv = null;
function attachRoom(){
  if (!roomRaw || !roomConv || roomFor === roomConv || !audioCtx || audioCtx instanceof OfflineAudioContext) return;
  const conv = roomConv; roomFor = conv;
  audioCtx.decodeAudioData(roomRaw.slice(0)).then(b => { try { conv.buffer = b; } catch (e) {} }).catch(() => { roomFor = null; });
}
function getDrumBus(){
  if (drumBus && drumBusCtx === audioCtx) { attachRoom(); return drumBus; }
  drumBus = audioCtx.createGain(); drumBus.gain.value = KIT_GAIN; drumBus.connect(masterGain);
  roomIn = audioCtx.createGain(); roomIn.gain.value = ROOM_SEND;
  roomConv = audioCtx.createConvolver(); roomConv.normalize = true;
  roomIn.connect(roomConv); roomConv.connect(masterGain);
  drumBusCtx = audioCtx;
  attachRoom();
  return drumBus;
}
/* 技巧模組的小鼓:s = 力度 0–1(重音約 0.95、一般 0.7、裝飾音 0.35);回傳有沒有聲音。
   照錄音自然響完(以前固定 2.5 秒截斷;小鼓的錄音都比 2.5 秒短,聲音不變) */
export function playDrum(name, when, s){
  const layers = kit[name];
  if (!layers || !audioCtx || audioCtx instanceof OfflineAudioContext) return false;
  const n = layers.length, v = Math.max(1, Math.min(127, Math.round(s * 127)));
  const ranges = SFZ_VEL_RANGES[n] || layers.map((_, k) => [Math.round(k * 127 / n) + 1, Math.round((k + 1) * 127 / n)]);
  let want = ranges.findIndex(([lo, hi]) => v >= lo && v <= hi); if (want < 0) want = n - 1;
  let li = -1;
  for (let d = 0; d < n && li < 0; d++) for (const k of [want - d, want + d]) if (k >= 0 && k < n && layers[k].length) { li = k; break; }
  if (li < 0) return false;
  const list = layers[li], key = name + li;
  kitRR[key] = ((kitRR[key] ?? Math.floor(Math.random() * list.length)) + 1) % list.length;
  const bus = getDrumBus();
  const src = audioCtx.createBufferSource(); src.buffer = list[kitRR[key]];
  const g = audioCtx.createGain(); g.gain.value = drumVelGain(s);
  src.connect(g); g.connect(bus); g.connect(roomIn);
  const at = Math.max(when, audioCtx.currentTime);
  src.start(at); src.stop(at + src.buffer.duration);
  track(src, when);
  return true;
}

/* ── 整組鼓的播放:以下數值照抄 ScrollScore index.html 的鼓引擎(出處寫在每段的註解)── */
/* 照抄 ScrollScore DRUM_XFADE / DRUM_XFADE_LINEAR / DRUM_XFADE_PIECES(pickDrumLayers 的力度交叉淡化):
   力度剛好落在兩層交界附近(±DRUM_XFADE/2)時,同時播相鄰兩層、依力度比例混合。大鼓兩層幾乎同相 → 線性混合;
   其他鼓皮兩層不相關 → 等功率混合。鈸類每一下的泛音都不一樣,疊兩層會像兩片鈸同時響,所以只播一層 */
let DRUM_XFADE = 8;
const DRUM_XFADE_LINEAR = new Set(["kick"]);
const DRUM_XFADE_PIECES = new Set(["kick", "snare", "snare2", "tom1", "tom2", "tom3", "tom4", "tom5"]);
/* 照抄 ScrollScore DRUM_CHOKE_FADE:鈸被抓住(止音)後在這麼多秒內收掉 */
const DRUM_CHOKE_FADE = 0.035;
/* 照抄 ScrollScore DRUM_VOICES 的 piece / gain / send / choke / openHat(只列 DrumDrill 用到的 12 個;合成備援 synth 不抄)。
   gain 是 ScrollScore 用響度計(BS.1770 LUFS,400ms 瞬時響度)量過定的:以小鼓為基準,大鼓、中鼓 ≈ 0,
   開放 hi-hat / ride bell / crash / 邊擊 −3~−5、閉合 hi-hat / ride −6~−7、踩 hi-hat −10。
   send 是 ScrollScore 送進鼓用 plate 殘響(getDrumBus 的 drumVerbIn)的量;DrumDrill 的鼓匯流排沒有 plate
   (只有每一擊都送的鼓房,跟技巧小鼓一樣),所以 send 先照抄記下、沒有接(技巧小鼓的聲音才不會變) */
const DRUM_VOICES = {
  kick:      { piece: "kick",     gain: 1.584,  send: 0.08 },
  snare:     { piece: "snare",    gain: 1.0,  send: 0.35 },
  xstick:    { piece: "xstick",   gain: 0.832,  send: 0.3 },
  hhClosed:  { piece: "hhClosed", gain: 0.27, send: 0.06, choke: true },
  hhPedal:   { piece: "hhPedal",  gain: 0.355, send: 0.05, choke: true },
  hhOpen:    { piece: "hhOpen",   gain: 0.26, send: 0.08, openHat: true },
  tom1:      { piece: "tom1",     gain: 1.117,  send: 0.3 },
  tom3:      { piece: "tom3",     gain: 1.233,  send: 0.3 },
  tom5:      { piece: "tom5",     gain: 1.057,  send: 0.3 },
  crash1:    { piece: "crashL",   gain: 0.26,  send: 0.1 },
  ride:      { piece: "ride",     gain: 0.425, send: 0.08 },
  rideBell:  { piece: "rideBell", gain: 0.361,  send: 0.08 }
};
/* 照抄 ScrollScore DRUM_POLY:同一片鈸同時發聲數(ScrollScore 註解:照原廠 sfz 的 note_polyphony 與 off_time),
   [上限, 收掉的秒數]。真的鈸再打一下不會「多一片鈸」一起響;超過上限時最舊的那一下在 off 秒內收掉。
   鈸照錄音自然響完,不再固定截斷。
   原廠 SFZ(Naked Drums kinwie 版)的 group / off_by(hi-hat 互相截斷)這次查不到原檔:待核對 */
const DRUM_POLY = {
  crashL: [4, 0.65], crashR: [4, 0.65], ride: [4, 0.5], rideBell: [4, 0.5], china: [4, 0.4], splash: [4, 0.2], hhOpen: [3, 0.35]
};
/* 照抄 ScrollScore pickDrumLayers / pickDrumLayer:依力度挑層(交界附近兩層交叉淡化),音量照原廠力度曲線 */
function pickDrumLayers(name, s){
  const layers = kit[name];
  if (!layers) return null;
  if (!DRUM_XFADE_PIECES.has(name)) {
    const one = pickDrumLayer(name, s);
    return one ? { parts: [{ key: one.key, list: one.list, w: 1 }], gain: one.gain } : null;
  }
  const n = layers.length, v = Math.max(1, Math.min(127, s * 127));
  const ranges = SFZ_VEL_RANGES[n] || layers.map((_, k) => [Math.round(k * 127 / n) + 1, Math.round((k + 1) * 127 / n)]);
  const loaded = k => layers[k] && layers[k].length;
  const out = [];
  for (let k = 1; k < n; k++) {
    const b = ranges[k][0] - 0.5, t = (v - (b - DRUM_XFADE / 2)) / DRUM_XFADE;
    if (t > 0 && t < 1 && loaded(k - 1) && loaded(k)) {
      const lin = DRUM_XFADE_LINEAR.has(name);
      out.push({ key: name + ":" + (k - 1), list: layers[k - 1], w: lin ? 1 - t : Math.cos(t * Math.PI / 2) });
      out.push({ key: name + ":" + k, list: layers[k], w: lin ? t : Math.sin(t * Math.PI / 2) });
      return { parts: out, gain: drumVelGain(s) };
    }
  }
  const one = pickDrumLayer(name, s);
  return one ? { parts: [{ key: one.key, list: one.list, w: 1 }], gain: one.gain } : null;
}
function pickDrumLayer(name, s){
  const layers = kit[name];
  if (!layers) return null;
  const n = layers.length, v = Math.max(1, Math.min(127, Math.round(s * 127)));
  const ranges = SFZ_VEL_RANGES[n] || layers.map((_, k) => [Math.round(k * 127 / n) + 1, Math.round((k + 1) * 127 / n)]);
  let want = ranges.findIndex(([lo, hi]) => v >= lo && v <= hi);
  if (want < 0) want = n - 1;
  // 這一層還沒載入(背景還在補)時,用最接近的已載入層
  let best = -1;
  for (let d = 0; d < n && best < 0; d++) for (const k of [want - d, want + d]) if (k >= 0 && k < n && layers[k].length) { best = k; break; }
  if (best < 0) return null;
  return { key: name + ":" + best, list: layers[best], gain: drumVelGain(s) };
}
/* 照抄 ScrollScore playSample(拿掉 pan / plate send / 變調 / sustainSec:DrumDrill 用到的鼓件都沒有):
   共用的包絡 g(止音、發聲數上限都是控制這一個),交叉淡化時兩層的錄音各自乘權重後接進來;
   round-robin 隨機挑,但不連續挑到同一個。回傳這一下的播放資訊 {g, when, level, end, srcs} */
function playSample(name, when, gain, strength){
  const pick = pickDrumLayers(name, strength != null ? strength : 0.72);
  if (!pick) return null;
  const g = audioCtx.createGain();
  const level = gain * pick.gain;
  g.gain.setValueAtTime(level, when);
  const srcs = [];
  let dur = 0;
  for (const part of pick.parts) {
    const n = part.list.length;
    let idx = Math.floor(Math.random() * n);
    if (n > 1 && idx === kitRR[part.key]) idx = (idx + 1) % n;
    kitRR[part.key] = idx;
    const buffer = part.list[idx];
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const w = audioCtx.createGain(); w.gain.value = part.w;   // ScrollScore 的 norm(OWN_KIT_GAIN)在 DrumDrill 是鼓匯流排的 KIT_GAIN
    src.connect(w); w.connect(g);
    src.start(when);
    track(src, when); srcs.push(src);
    dur = Math.max(dur, buffer.duration);
  }
  g.connect(getDrumBus()); g.connect(roomIn);
  return { g, when, level, end: when + dur, srcs };
}
/* 照抄 ScrollScore chokeOpenHat:真實 hi-hat 是同一組鈸,閉合或踩 hi-hat 時,還在響的開放 hi-hat 會立刻被夾住停止 */
let ringingOpenHat = null;
function chokeOpenHat(when){
  const v = ringingOpenHat;
  if (!v || when <= v.when) return;
  chokeCymbal("hhOpen", when);   // 同一組 hi-hat:前面幾下還在響的開放 hi-hat 也一起停
  ringingOpenHat = null;
}
/* 照抄 ScrollScore ringingCymbals / fadeDrumVoice / chokeCymbal:從 when 開始把這一下在 tau 秒內收掉
   (從當下包絡的音量收,避免爆音),收完就停止播放;同一下只收一次 */
let ringingCymbals = {};
function fadeDrumVoice(v, when, tau){
  if (!v || v.faded || when <= v.when || when >= v.end) return;
  let cur = v.level;
  if (v.sustainSec) {   // ScrollScore 主動收尾的鼓件才有(DrumDrill 沒有)
    const holdEnd = v.when + v.sustainSec * 0.5;
    if (when > holdEnd) cur = v.level * Math.pow(0.0001 / v.level, (when - holdEnd) / (v.sustainSec * 0.5));
  }
  v.g.gain.cancelScheduledValues(when);
  v.g.gain.setValueAtTime(cur, when);
  v.g.gain.exponentialRampToValueAtTime(0.0001, when + tau);
  v.faded = true;
  for (const src of v.srcs || []) try { src.stop(when + tau + 0.02); } catch (e) {}
}
function chokeCymbal(piece, when){
  const list = ringingCymbals[piece];
  if (!list) return;
  for (const v of list) fadeDrumVoice(v, when, DRUM_CHOKE_FADE);
  ringingCymbals[piece] = list.filter(v => v.when >= when);
}
/* 整組鼓打一下(照抄 ScrollScore scheduleDrum 的流程):piece = drumkey.json 的 id(或取樣鼓件名),s = 力度 0–1。
   回傳這一下的播放資訊(沒有聲音時 null) */
export function playKit(piece, when, s){
  const voice = DRUM_VOICES[KIT_VOICE[piece] || piece];
  if (!voice || !audioCtx || audioCtx instanceof OfflineAudioContext) return null;
  const at = Math.max(when, audioCtx.currentTime);
  if (voice.choke) chokeOpenHat(at);
  const played = playSample(voice.piece, at, voice.gain, s != null ? s : 0.72);
  if (!played) return null;
  if (voice.openHat) ringingOpenHat = played;
  const poly = DRUM_POLY[voice.piece];
  if (poly) {
    const list = (ringingCymbals[voice.piece] = (ringingCymbals[voice.piece] || []).filter(v => v.end > at && !v.faded));
    list.push(played);
    while (list.length > poly[0]) fadeDrumVoice(list.shift(), at, poly[1]);
  }
  return played;
}
/* 測試用(tools/test/kitaudio.mjs):每個鼓件每層載了幾個錄音、解碼後佔多少記憶體、還在下載幾個、還在響的鈸 */
export function kitStats(){
  const pieces = {}, maxSec = {};
  let bytes = 0, bytes48 = 0;
  for (const [n, layers] of Object.entries(kit)) {
    pieces[n] = layers.map(l => l.length);
    maxSec[n] = 0;
    for (const l of layers) for (const b of l) {
      bytes += b.length * b.numberOfChannels * 4;
      bytes48 += b.length * 48000 / b.sampleRate * b.numberOfChannels * 4;   // 換成 manifest 的 48kHz 算
      maxSec[n] = Math.max(maxSec[n], b.duration);
    }
  }
  const ringing = {};
  for (const [n, list] of Object.entries(ringingCymbals)) ringing[n] = list.map(v => ({ when: v.when, end: v.end, faded: !!v.faded }));
  return { pieces, maxSec, bytes, bytes48, pending: kitPending + kitQueued, ringing, limits: { snare: RR_LIMIT, ...KIT_RR }, lowMem: !!LOW_MEM, poly: DRUM_POLY, chokeFade: DRUM_CHOKE_FADE };
}
/* stopAll()、cancelFrom(t) 時樂器自己要清的東西:還在響的鈸清單(聲音本身由 scheduled 停掉) */
function appStop(now){ ringingOpenHat = null; ringingCymbals = {}; }
function appCancel(t){
  if (ringingOpenHat && ringingOpenHat.when >= t) ringingOpenHat = null;
  for (const n of Object.keys(ringingCymbals)) ringingCymbals[n] = ringingCymbals[n].filter(v => v.when < t);
}
// @app-end

/* ── 節拍器:真的鼓棒敲鼓框(Naked Drums xstick,ScrollScore drums/,CC-BY 4.0),重拍大聲一點 ── */
const CLICK_FILES = ["nk-xstick-L1.01.flac", "nk-xstick-L1.02.flac", "nk-xstick-L1.03.flac"];
let clickBufs = null, clickPromise = null;
export function loadClick(){
  if (!clickPromise) clickPromise = (async () => {
    const bufs = [];
    for (const f of CLICK_FILES) {
      try { const r = await fetchSample(SAMPLE_ROOT + "drums/" + f); if (r.ok) bufs.push(await dec().decodeAudioData(await r.arrayBuffer())); } catch (e) {}
    }
    if (!bufs.length) throw new Error("click samples failed");
    clickBufs = bufs;
    return bufs;
  })().catch(e => { clickPromise = null; throw e; });
  return clickPromise;
}
let clickBus = null, clickBusCtx = null, clickRR = 0;
export function playClick(when, strong){
  if (!clickBufs) return false;
  if (!clickBus || clickBusCtx !== audioCtx) {
    clickBus = audioCtx.createGain(); clickBus.gain.value = 1.6; clickBus.connect(masterBus); clickBusCtx = audioCtx;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = clickBufs[clickRR++ % clickBufs.length];
  const g = audioCtx.createGain(); g.gain.value = strong ? 1 : 0.45;
  src.connect(g); g.connect(clickBus);
  src.start(Math.max(when, audioCtx.currentTime));
  src.stop(Math.max(when, audioCtx.currentTime) + 0.4);
  track(src, when);
  return true;
}

/* 排程一個節點:記下開始時間(cancelFrom 用),播完(或被 stop)時自己從清單移除,清單不會一直變長 */
function track(src, when){
  src._at = when; scheduled.add(src);
  src.onended = () => scheduled.delete(src);
}
export function audioNow(){ return audioCtx ? audioCtx.currentTime : 0; }
export function getCtx(){ return audioCtx; }
export function stopAll(){
  const now = audioCtx ? audioCtx.currentTime : 0;
  for (const s of scheduled) { try { s.stop(now + 0.02); } catch (e) {} }
  scheduled.clear();
  appStop(now);
}
/* 播放中改速度:把還沒開始的音與拍點取消(正在響的不動),再照新速度重排 */
export function cancelFrom(t){
  for (const s of scheduled) if (s._at >= t) { try { s.stop(); } catch (e) {} scheduled.delete(s); }
  appCancel(t);
}
export { masterReady };
/* 測試用:目前排程中的音訊節點數(連點播放不會變兩份;播完的會自己移除) */
export function scheduledCount(){ return scheduled.size; }
/* 聲音被系統打斷(iOS 來電、Siri、其他 App 搶走音訊):AudioContext 變成 interrupted / suspended,而且畫面還在前景時通知外框
   (外框讓目前的模組 leave() + enter(),停掉播放、按鈕回到「播放」;切到背景由外框的 visibilitychange 處理) */
const interruptFns = [];
export function onInterrupt(fn){ interruptFns.push(fn); }
function watchState(ctx){
  try {
    ctx.addEventListener("statechange", () => {
      if ((ctx.state === "interrupted" || ctx.state === "suspended") && document.visibilityState === "visible")
        for (const fn of interruptFns) { try { fn(ctx.state); } catch (e) { console.error(e); } }
    });
  } catch (e) {}
}
