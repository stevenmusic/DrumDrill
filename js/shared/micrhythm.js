/* 麥克風節奏評分(選用;docs/STAGES.md S15;視奏的「正式打」、聽力的「回打」共用,DrumDrill 自己的)。
   - 收音:js/shared/mic.js(PianoDrill / DrumDrill 逐位元組相同)。錄在播放用的同一個 AudioContext(audio.ensureAudio()):
     拍點、鼓聲、錄音同一把時間尺,偵測到的起音直接換成「從第一拍算起的秒數」(跟觸控鼓墊一樣)
   - 整段錄完才在裝置上分析(detectHits = onsets.js 的 detectOnsets,hop 5 ms、refractory 0.05 秒);不存檔、不上傳,分析完就丟掉
   - 評分:全部鼓件合併成一條(timing.js 的 LANES[1]),只評時間(不分鼓件、不看力度);整體偏移(裝置的輸入、輸出延遲)先扣掉再評,
     不設上限(offsetLimit: Infinity;結果跟 PianoDrill 視奏的 scoreRhythm 一模一樣)
   - App 自己發出的聲音也會被收進去(echoCancellation 關掉了):
     預備拍的拍點、Trinity 回打時 App 播的那一句。用這些聲音本身估「App 的聲音晚多久被收到」(來回延遲),把落在那些時間的起音拿掉(dropBleed);
     正式打 / 回打的空檔裡不放拍點(只有預備拍):拍點跟真的鼓同時響時分不開(由模組處理)
   - 打開麥克風失敗(拒絕權限、沒有麥克風、瀏覽器不支援):這一次照觸控鼓墊評分,畫面說明原因;不影響其他功能
   結果是練習回饋,不是官方評分(畫面標「僅供練習參考,不是官方評分;只評時間」)。 */
import { createRecorder } from "./mic.js";
import * as audio from "./audio.js";
import { detectHits, LANES } from "./timing.js";

export const MIC_LANES = LANES[1];   // 全部鼓件合併成一條(LANES[1] 的 pieces = null:每個鼓件都算在這一條)
export const BLEED_WINDOW = 0.35;    // App 的聲音之後這麼久內的第一個起音,當作收到的那個聲音(估來回延遲用;練習設定)
export const BLEED_TOL = 0.04;       // 落在「App 的聲音 + 來回延遲」± 這麼多的起音拿掉(練習設定)

/* 打開麥克風失敗的原因:denied = 拒絕權限;none = 沒有麥克風 / 瀏覽器不支援;error = 其他 */
export function failReason(e){
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return "denied";
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError" || n === "NotSupportedError" || n === "NotReadableError") return "none";
  return "error";
}

/* 一次錄音:start() → null(開始了)| 失敗原因;finish() → { hits:[音訊時間(秒)], seconds } | null;cancel() 丟掉。
   opening = 正在打開(等權限、iOS 切換音訊工作階段);bumped = 打開的時候 AudioContext 被「打斷」過(audio.onInterrupt):
   iOS 開麥克風會切換工作階段(play-and-record),AudioContext 可能短暫變成 interrupted,外框會把模組 leave() + enter()。
   模組在 opening 時不要 cancel(stopAll 跳過),打開之後 bumped 而且還在同一題就照樣開始(不是使用者離開);實機要確認(docs/IOS.md 第 8 節)
   錄完(finish / cancel 一段正在錄的)iOS 會再切回只播放的工作階段,也可能「打斷」一下:之後 SETTLE_MS 內的打斷跟 opening 一樣當作自己造成的。
   shielded = 這一次的打斷是自己造成的(只在打斷的同一輪事件有效;外框的 onInterrupt 同步呼叫模組的 leave(),模組用它決定模擬考不要中止) */
export const SETTLE_MS = 1500;   // 錄完之後忽略打斷的時間(練習設定;實機要確認,docs/IOS.md 第 8 節)
export function createMicTake(){
  const rec = createRecorder({ context: () => audio.ensureAudio() });
  let opening = false, bumped = false, settleUntil = 0, shielded = false;
  // 這個監聽在外框的 onInterrupt 之前登記(模組先載入),所以外框呼叫 leave() 時 shielded 已經是這一次的值
  audio.onInterrupt(() => {
    if (opening) bumped = true;
    if (opening || performance.now() < settleUntil) { shielded = true; setTimeout(() => { shielded = false; }, 0); }
  });
  const settle = () => { settleUntil = performance.now() + SETTLE_MS; };
  return {
    async start(){
      opening = true; bumped = false;
      try { await rec.start(); return null; } catch (e) { return failReason(e); } finally { opening = false; }
    },
    finish(){
      if (rec.active) settle();
      const take = rec.finish();
      if (!take || take.contextTime == null) return null;
      const hits = detectHits(take.samples, take.sampleRate).map(t => take.contextTime + t);
      return { hits, seconds: take.samples.length / take.sampleRate, filled: take.filled || 0 };
    },
    cancel(){ if (rec.active) settle(); rec.cancel(); },
    get active(){ return rec.active; },
    get opening(){ return opening; },
    get bumped(){ return bumped; },
    get shielded(){ return shielded; }
  };
}

const median = v => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return !s.length ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* 拿掉 App 自己的聲音(hits、sounds 同一把時間尺,秒):每個 App 的聲音之後 BLEED_WINDOW 內的第一個起音 → 延遲的中位數 lag;
   至少一半的聲音(而且 ≥ 2 個)對得到才算數(沒收到 App 的聲音,例如戴耳機,就什麼都不拿)。
   回傳 { hits(拿掉之後), removed, lagMs(null = 沒有估) } */
export function dropBleed(hits, sounds, { window = BLEED_WINDOW, tol = BLEED_TOL } = {}){
  const hs = [...hits].sort((a, b) => a - b), ss = [...new Set(sounds)].sort((a, b) => a - b);
  if (!ss.length || !hs.length) return { hits: hs, removed: 0, lagMs: null };
  const lags = [];
  for (const s of ss) { const h = hs.find(x => x >= s - 0.005 && x <= s + window); if (h != null) lags.push(h - s); }
  if (lags.length < 2 || lags.length * 2 < ss.length) return { hits: hs, removed: 0, lagMs: null };
  const lag = median(lags);
  const keep = hs.filter(h => !ss.some(s => Math.abs(h - (s + lag)) <= tol));
  return { hits: keep, removed: hs.length - keep.length, lagMs: Math.round(lag * 1000) };
}

/* 畫面上的字 [中, 英] */
export const MIC_TEXT = {
  label: ["用麥克風評分節奏(選用)", "Score my rhythm with the mic (optional)"],
  note: ["在真的鼓(或打擊板)上打,麥克風只聽每一下的時間;勾了以後這一次不用觸控鼓墊(不出聲、不計分),正式打時只有預備拍的拍點。整段錄完才在這台裝置上分析,不存檔、不上傳。",
    "Play a real kit (or practice pad); the mic only listens for when each stroke lands. While on, the touch pads are off for the take (no sound, not scored) and only the count-in clicks. Analysed on this device after the take — never saved or uploaded."],
  starting: ["打開麥克風…(第一次會問權限)", "Opening the microphone… (asks for permission the first time)"],
  head: ["練習回饋 · 節奏(麥克風)", "Practice feedback · rhythm (microphone)"],
  silent: ["沒有聽到鼓聲:把裝置放近一點、不要蓋住麥克風,再打一次。", "No drums heard — move the device closer, keep the mic uncovered and try again."],
  disclaimer: ["僅供練習參考,不是官方評分;只評時間(全部鼓件合併成一條,不分鼓件、不看力度)。容許範圍、偵測靈敏度、扣掉 App 自己聲音的規則都是練習設定。",
    "For practice only — not an official mark. Timing only (all drums merged; no per-drum or dynamics check). Tolerance, detection sensitivity and removal of the App's own sounds are practice settings."]
};
export function micFailText(reason){
  if (reason === "denied") return ["沒有取得麥克風權限,這一次照觸控鼓墊評分。要用麥克風:到瀏覽器 / 系統設定允許麥克風再試。",
    "Microphone access wasn't granted, so this take uses the touch pads. To use the mic, allow it in browser/system settings and try again."];
  if (reason === "none") return ["找不到可以用的麥克風(或瀏覽器不支援),這一次照觸控鼓墊評分。", "No usable microphone (or the browser doesn't support it), so this take uses the touch pads."];
  return ["麥克風打不開,這一次照觸控鼓墊評分。", "The microphone couldn't start, so this take uses the touch pads."];
}
