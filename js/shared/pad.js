/* 觸控鼓墊(視奏、聽力共用;docs/STAGES.md S7):createPads(el, lanes, onHit) → { key(e), enable(on), relang(), flash(id), destroy(), lanes }
   - lanes:[{ id, label:[中, 英], key:"f" | ["j","f"] }],通常用 timing.js 的 LANES[1](小鼓)或 LANES[3](鈸 / 鼓 / 大鼓與腳踩 HH)
   - onHit({ lane, time, src }):time = 這一下的音訊時間(AudioContext 的時鐘,跟 player.beatToTime 同一個);src = "pointer" | "key" | "a11y"
   - 時間用事件本身的 event.timeStamp(手指碰到的時間),不是處理函式執行的時間:主執行緒忙的時候處理會晚,時間不會晚。
     換算:AudioContext.getOutputTimestamp() 給「喇叭正在播的那一格音訊時間 ↔ performance 時間」的對照,
     用它換 = 手指碰到時耳朵聽到的那個音訊時間(輸出延遲自動扣掉);沒有這個 API(或還沒開始跑)就用 currentTime − outputLatency
     與 performance.now() 配對(player.js 的 perfToAudioTime,播放色塊也用同一個)。剩下的固定延遲由 timing.js 的 scoreLanes 估計後扣掉
   - 多點觸控:每一根手指各自一個 pointerdown(同一個鼓墊兩根手指 = 兩下);touch-action:none,不會被當成捲動或縮放
   - 鍵盤:模組的 onKey(e) 轉給 pads.key(e)(F / J / K;Space 留給播放);按住不放的重複不算。
     先看 e.key,對不到再看 e.code(KeyF / KeyJ / KeyK = 實體按鍵):注音等輸入法開著時 e.key 是「ㄑ」或 "Process"
   - 輔助使用:VoiceOver 點兩下、鍵盤聚焦後按 Enter 不會有 pointerdown,只有 click(detail = 0)→ 也算一下;
     手指 / 滑鼠的 click(detail ≥ 1,或剛剛同一個鼓墊有 pointerdown)不重複算。
     聚焦在鼓墊上按住 Enter:瀏覽器每次自動重複的 keydown 都會再送一個 click → 重複的 keydown 擋掉預設動作(就不會有 click);
     另外同一個鼓墊兩個 a11y click 間隔 < A11Y_MIN_MS 也當作重複(擋不掉 keydown 的情況)。手指、F / J / K 的快速連打不受影響
   - 打到閃一下(app.css 的 .tap-pad.hit);不出聲(要出聲由 onHit 自己用 audio.playKit)
   共用元件不寫死前綴:只用傳進來的 el 與 class */
import { perfToAudioTime } from "./player.js";
import { tr, pairText } from "./i18n.js";

const FLASH_MS = 90;
const CLICK_DUP_MS = 800;   // pointerdown 之後這麼久內同一個鼓墊的 click 當作同一下(有的瀏覽器 detail 也是 0)
export const A11Y_MIN_MS = 60;   // 同一個鼓墊兩個 a11y click 至少隔這麼久(按鍵自動重複約 30 ms 一次;人按 Enter / 點兩下不會這麼快)

/* 事件時間(performance 的毫秒)→ 音訊時間(秒);沒有 AudioContext 時 null */
export function eventToAudioTime(ts){
  const perfNow = performance.now();
  // 有的舊瀏覽器 timeStamp 是 1970 年起的毫秒或 0:不能用就當作現在
  if (!(ts > 0) || ts > perfNow + 1000 || ts < perfNow - 10000) ts = perfNow;
  return perfToAudioTime(ts);
}
const CODE_KEY = /^Key([A-Z])$/;

export function createPads(el, lanes, onHit){
  el.classList.add("pads");
  el.dataset.n = String(lanes.length);
  el.innerHTML = "";
  const btns = new Map(), timers = new Map();
  const keyOf = new Map();
  for (const l of lanes) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tap-pad"; b.dataset.lane = l.id;
    b.innerHTML = '<span class="pad-name"></span><kbd class="pad-key"></kbd>';
    el.appendChild(b); btns.set(l.id, b);
    for (const k of [].concat(l.key || [])) keyOf.set(k.toLowerCase(), l.id);
  }
  function relang(){
    for (const l of lanes) {
      const b = btns.get(l.id), name = tr(l.label[0], l.label[1]);
      // 名稱兩種語言保留比較高的高度(窄畫面「大鼓・腳踩」會換行、「Kick · HH」不會:中英版面一樣)
      pairText(b.querySelector(".pad-name"), () => tr(l.label[0], l.label[1]));
      b.querySelector(".pad-key").textContent = [].concat(l.key || [])[0] ? [].concat(l.key)[0].toUpperCase() : "";
      b.setAttribute("aria-label", name);
    }
  }
  function flash(id){
    const b = btns.get(id); if (!b) return;
    b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit");
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => b.classList.remove("hit"), FLASH_MS));
  }
  function hit(id, ts, src){
    const time = eventToAudioTime(ts);
    flash(id);
    if (onHit) { try { onHit({ lane: id, time, src }); } catch (e) { console.error(e); } }
  }
  const lastDown = new Map();   // 鼓墊 → 最近一次 pointerdown 的 performance 時間
  const lastA11y = new Map();   // 鼓墊 → 最近一次 a11y click 的 performance 時間
  const padOf = e => {
    const b = e.target && e.target.closest ? e.target.closest(".tap-pad") : null;
    return b && !b.disabled && el.contains(b) ? b : null;
  };
  const onDown = e => {
    const b = padOf(e);
    if (!b) return;
    if (e.button > 0) return;   // 滑鼠右鍵、中鍵不算
    e.preventDefault();         // 不要聚焦、不要選字(click 還是會來,由 onClick 濾掉)
    lastDown.set(b.dataset.lane, performance.now());
    hit(b.dataset.lane, e.timeStamp, "pointer");
  };
  // 沒有 pointerdown 的啟動(VoiceOver、Enter):click 的 detail = 0。手指 / 滑鼠的 click 已經在 pointerdown 算過
  const onClick = e => {
    const b = padOf(e);
    if (!b || e.detail !== 0) return;
    const id = b.dataset.lane, d = lastDown.get(id);
    const now = performance.now();
    if (d != null && now - d < CLICK_DUP_MS) return;
    const a = lastA11y.get(id);
    if (a != null && now - a < A11Y_MIN_MS) return;
    lastA11y.set(id, now);
    hit(id, e.timeStamp, "a11y");
  };
  // 按住 Enter 的自動重複:擋掉預設動作 = 不送 click(第一下照常)
  const onKeyDown = e => {
    if (e.repeat && (e.key === "Enter" || e.code === "NumpadEnter") && padOf(e)) e.preventDefault();
  };
  const noMenu = e => e.preventDefault();
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("contextmenu", noMenu);
  let on = true;
  function key(e){
    if (!on || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return false;
    let id = keyOf.get((e.key || "").toLowerCase());
    if (!id) { const m = CODE_KEY.exec(e.code || ""); if (m) id = keyOf.get(m[1].toLowerCase()); }   // 輸入法開著:看實體按鍵
    if (!id) return false;
    e.preventDefault();
    hit(id, e.timeStamp, "key");
    return true;
  }
  function enable(v){ on = !!v; for (const b of btns.values()) b.disabled = !on; }
  function destroy(){
    el.removeEventListener("pointerdown", onDown); el.removeEventListener("click", onClick); el.removeEventListener("keydown", onKeyDown); el.removeEventListener("contextmenu", noMenu);
    for (const t of timers.values()) clearTimeout(t);
    el.innerHTML = "";
  }
  relang();
  return { key, enable, relang, flash, destroy, lanes, el };
}
