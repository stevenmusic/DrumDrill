/* 觸控鼓墊(視奏、聽力共用;docs/STAGES.md S7):createPads(el, lanes, onHit) → { key(e), enable(on), relang(), flash(id), destroy(), lanes }
   - lanes:[{ id, label:[中, 英], key:"f" | ["j","f"] }],通常用 timing.js 的 LANES[1](小鼓)或 LANES[3](鈸 / 鼓 / 大鼓與腳踩 HH)
   - onHit({ lane, time, src }):time = 這一下的音訊時間(AudioContext 的時鐘,跟 player.beatToTime 同一個);src = "pointer" | "key"
   - 時間用事件本身的 event.timeStamp(手指碰到的時間),不是處理函式執行的時間:主執行緒忙的時候處理會晚,時間不會晚。
     換算:AudioContext.getOutputTimestamp() 給「喇叭正在播的那一格音訊時間 ↔ performance 時間」的對照,
     用它換 = 手指碰到時耳朵聽到的那個音訊時間(輸出延遲自動扣掉);沒有這個 API(或還沒開始跑)就用 currentTime − outputLatency
     與 performance.now() 配對。剩下的固定延遲由 timing.js 的 scoreLanes 估計後扣掉
   - 多點觸控:每一根手指各自一個 pointerdown(同一個鼓墊兩根手指 = 兩下);touch-action:none,不會被當成捲動或縮放
   - 鍵盤:模組的 onKey(e) 轉給 pads.key(e)(F / J / K;Space 留給播放);按住不放的重複不算
   - 打到閃一下(app.css 的 .tap-pad.hit);不出聲(要出聲由 onHit 自己用 audio.playKit)
   共用元件不寫死前綴:只用傳進來的 el 與 class */
import * as audio from "./audio.js";
import { tr } from "./i18n.js";

const FLASH_MS = 90;

/* 事件時間(performance 的毫秒)→ 音訊時間(秒);沒有 AudioContext 時 null */
export function eventToAudioTime(ts){
  const ctx = audio.getCtx();
  if (!ctx || typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) return null;
  const perfNow = performance.now();
  // 有的舊瀏覽器 timeStamp 是 1970 年起的毫秒或 0:不能用就當作現在
  if (!(ts > 0) || ts > perfNow + 1000 || ts < perfNow - 10000) ts = perfNow;
  let ct = null, pt = null;
  if (ctx.getOutputTimestamp) {
    try { const o = ctx.getOutputTimestamp(); if (o && o.performanceTime > 0 && o.contextTime > 0) { ct = o.contextTime; pt = o.performanceTime; } } catch (e) {}
  }
  if (ct == null) { ct = ctx.currentTime - (ctx.outputLatency || 0); pt = perfNow; }
  return ct + (ts - pt) / 1000;
}

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
      b.querySelector(".pad-name").textContent = name;
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
  const onDown = e => {
    const b = e.target.closest(".tap-pad");
    if (!b || b.disabled || !el.contains(b)) return;
    if (e.button > 0) return;   // 滑鼠右鍵、中鍵不算
    e.preventDefault();         // 不要變成點擊、不要聚焦、不要選字
    hit(b.dataset.lane, e.timeStamp, "pointer");
  };
  const noMenu = e => e.preventDefault();
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("contextmenu", noMenu);
  let on = true;
  function key(e){
    if (!on || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return false;
    const id = keyOf.get((e.key || "").toLowerCase());
    if (!id) return false;
    e.preventDefault();
    hit(id, e.timeStamp, "key");
    return true;
  }
  function enable(v){ on = !!v; for (const b of btns.values()) b.disabled = !on; }
  function destroy(){
    el.removeEventListener("pointerdown", onDown); el.removeEventListener("contextmenu", noMenu);
    for (const t of timers.values()) clearTimeout(t);
    el.innerHTML = "";
  }
  relang();
  return { key, enable, relang, flash, destroy, lanes, el };
}
