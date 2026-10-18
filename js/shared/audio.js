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
   小鼓每個力度層 10 個 round-robin(同一層換不同的錄音,連打才不會像機關槍);
   力度照原廠 SFZ(照 ScrollScore 的鼓引擎):5 層的分區 1-27 / 28-52 / 53-77 / 78-102 / 103-127,
   各層錄音音量幾乎一樣(代表輕打 / 重打的音色),大小聲由力度曲線決定:音量 = 0.01 + 0.99 ×(力度/127)²。
   鼓房殘響:drums/room.flac(ScrollScore 用幾何聲學模擬的錄音室,RT60 約 0.55 秒)並聯一點點 */
const DRUM_BASE = SAMPLE_ROOT + "drums/";
const KIT_GAIN = 2.3;          // 照 ScrollScore(OWN_KIT_GAIN)
const ROOM_SEND = 0.22;
const VEL_RANGES = { 1: [[1, 127]], 2: [[1, 85], [86, 127]], 3: [[1, 43], [44, 85], [86, 127]], 5: [[1, 27], [28, 52], [53, 77], [78, 102], [103, 127]] };
const drumVelGain = s => { const v = Math.max(1, Math.min(127, Math.round(s * 127))) / 127; return 0.01 + 0.99 * v * v; };
let drumMan = null, drumManPromise = null;
const kit = {};               // 鼓件 → [力度層][round-robin] = AudioBuffer
const kitRR = {};
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
/* 載入鼓件:第 1 輪每個力度層各 1 個錄音(載完就能播,力度完整),其餘 round-robin 在背景補。
   iPhone / 記憶體小的裝置每層最多 6 個(解碼後是 32-bit 浮點,全部載入很佔記憶體) */
const RR_LIMIT = (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (navigator.deviceMemory && navigator.deviceMemory <= 4)) ? 6 : 10;
const drumJobs = {};
export function loadDrums(pieces = ["snare"], onProgress){
  const key = pieces.join(",");
  if (drumJobs[key]) return drumJobs[key];
  drumJobs[key] = (async () => {
    const man = await loadDrumManifest();
    // 殘響的脈衝響應要跟 AudioContext 同一個取樣率(ConvolverNode 不會自己轉):先留原始檔,接上時再用真正的 context 解碼
    if (!roomRaw) fetchSample(DRUM_BASE + "room.flac").then(r => (r.ok ? r.arrayBuffer() : null)).then(a => { if (a) { roomRaw = a; attachRoom(); } }).catch(() => {});
    const load = async (name, li, rr) => {
      const p = man.pieces[name];
      const file = p.prefix + "-L" + (li + 1) + "." + String(rr).padStart(2, "0") + ".flac";
      try { const r = await fetchSample(DRUM_BASE + file); if (r.ok) kit[name][li].push(await dec().decodeAudioData(await r.arrayBuffer())); } catch (e) {}
    };
    const first = [];
    for (const name of pieces) {
      const p = man.pieces[name]; if (!p) continue;
      if (!kit[name]) kit[name] = p.layers.map(() => []);
      p.layers.forEach((l, li) => { if (!kit[name][li].length) first.push([name, li, 1]); });
    }
    let done = 0;
    await runLimited(first.map(j => async () => { await load(...j); done++; if (onProgress) onProgress(done / first.length); }), SAMPLE_FETCH_CONCURRENCY);
    if (pieces.every(n => !kit[n] || kit[n].every(l => !l.length))) throw new Error("drum samples failed");
    // 其餘 round-robin(背景)
    const rest = [];
    for (const name of pieces) { const p = man.pieces[name]; if (!p) continue; p.layers.forEach((l, li) => { for (let rr = 2; rr <= Math.min(l.rr, RR_LIMIT); rr++) rest.push([name, li, rr]); }); }
    runLimited(rest.map(j => () => load(...j)), 4);
    return true;
  })().catch(e => { delete drumJobs[key]; throw e; });
  return drumJobs[key];
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
/* 打一下:s = 力度 0–1(重音約 0.95、一般 0.7、裝飾音 0.35);回傳有沒有聲音 */
export function playDrum(name, when, s){
  const layers = kit[name];
  if (!layers || !audioCtx || audioCtx instanceof OfflineAudioContext) return false;
  const n = layers.length, v = Math.max(1, Math.min(127, Math.round(s * 127)));
  const ranges = VEL_RANGES[n] || layers.map((_, k) => [Math.round(k * 127 / n) + 1, Math.round((k + 1) * 127 / n)]);
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
  src.start(at); src.stop(at + Math.min(src.buffer.duration, 2.5));
  track(src, when);
  return true;
}
/* stopAll()、cancelFrom(t) 時樂器自己要清的東西(鼓沒有) */
function appStop(now){}
function appCancel(t){}
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
