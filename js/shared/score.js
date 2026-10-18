/* 共用的譜面元件:一整行 OSMD + 播放軸(照 PianoDrill / ScrollScore;技巧用,之後聽力也用;視奏不用:考卷排法是 js/sight/stage.js + app.js 的 fitScore)
   元素都用模組自己的 $(id => document.getElementById(前綴 + id)),這裡不寫死前綴:
     $("stage") 紙張、$("scroll") 左右捲的框、$("osmd") OSMD 畫在這裡、$("playline") 播放軸、$("paperMsg") 紙上的訊息
   - 看不到的時候(在別的分頁、寬度 0)不畫:記下 pending,回到畫面(onResize)時用同一份 MusicXML 再畫
   - 比紙張短的置中、放大到大約填滿(最多 1.6 倍,fitWidth);比紙張長的左右捲,播放時目前位置停在畫面 25%
   - noteXs:每一步(OSMD 游標的每個位置)的拍點(四分音符)與 x;播放軸在兩步之間內插
   - 手機橫式的縮放(landZoom)由 js/shared/landscape.js 的 fitLandZoom 決定(opts.fitLand 每次畫完、版面變了時呼叫)
   opts:
     $            模組的 id 查詢函式
     zoom()       平常的縮放(依畫面寬度)
     afterRender(svg)  OSMD 畫完之後(例如技巧畫左右手);每次 render 都會呼叫
     lenBeats()   一輪的長度(拍);measure 在最後補一個「這一輪結束」的位置
     playing()    是不是在播放(播放中捲動紙張時不把播放軸拉回開頭)
     isActive()   模組是不是在畫面上
     msg(fn)      紙上的訊息(fn 產生文字;null 清掉);預設直接寫 $("paperMsg")
     errorText(e) 繪製失敗的訊息
     onDrawn(xml) 畫好(或失敗)之後(測試用的計數)
     onPending()  因為看不到而延後時
     fitLand()    手機橫式依高度放大;回傳 true 表示已經重畫
     setup(osmd)  第一次建立 OSMD 時(EngravingRules 之類)
   回傳的物件(實際 API;沒有 setActive,看不看得到一律問 opts.isActive()):
     landZoom             手機橫式的縮放(fitLandZoom 設定;null = 用 zoom())
     osmd / noteXs / pending   目前的 OSMD(沒有譜時 null)、每一步的拍點與 x、是不是因為看不到而延後
     zoom()               目前的縮放(landZoom 或 opts.zoom())
     load(xml)            載入並畫出來(看不到時先記著);回傳 Promise<true = 畫好了>
     render()             照目前的縮放重畫一次(之後呼叫 afterRender)
     fitWidth()           短的譜放大到大約填滿紙張
     refit()              縮放改了(手機橫式放大 / 縮回):重畫、重量;回傳 true
     measure(len)         重量 noteXs(len = 一輪幾拍,預設 opts.lenBeats())
     xAtBeat(b)           第 b 拍的 x
     movePlayline(beat, follow)  播放軸移到第 beat 拍;follow = 播放中(目前位置停在 25%)
     placeExtent()        播放軸的上下範圍
     home()               停止後:捲回開頭、播放軸回到第一個音
     clear()              清掉譜面(osmd 變 null、landZoom 歸零、延後的不畫了)
     onResize()           畫面大小改了 / 回到畫面:延後的先畫;縮放或寬度改了就重畫 */
import { tr } from "./i18n.js";
const PLAYLINE_RATIO = 0.25;
export function createScore(opts){
  const { $ } = opts;
  const zoom = opts.zoom, afterRender = opts.afterRender || (() => {}), lenBeats = opts.lenBeats || (() => null);
  const playing = opts.playing || (() => false), isActive = opts.isActive || (() => true);
  const msg = opts.msg || (fn => { $("paperMsg").textContent = fn ? fn() : ""; });
  const errorText = opts.errorText || (e => tr("樂譜繪製失敗:", "Could not draw the score: ") + e.message);
  const onDrawn = opts.onDrawn || (() => {}), onPending = opts.onPending || (() => {}), fitLand = opts.fitLand || (() => false);
  let osmd = null, noteXs = [], seq = 0, lastZoom = null, stageW = 0, pending = false, lastXml = null;
  const api = {
    landZoom: null,
    get osmd(){ return osmd; },
    get noteXs(){ return noteXs; },
    get pending(){ return pending; },
    zoom: () => api.landZoom || zoom(),
    load, render, fitWidth, measure, xAtBeat, movePlayline, placeExtent, onResize, refit, home, clear
  };
  /* 載入一份 MusicXML 並畫出來(看不到時先記著,回到畫面再畫);回傳 true = 畫好了 */
  async function load(xml){
    const my = ++seq;
    lastXml = xml;
    if (!osmd) {
      osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay($("osmd"), {
        backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawPartNames: false,
        drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true,
        cursorsOptions: [{ type: 0, color: "#F2B94B", alpha: 0, follow: false }]
      });
      if (opts.setup) opts.setup(osmd);
    }
    msg(null);
    try {
      await osmd.load(xml);
      if (my !== seq) return false;
      // 看不到的時候(在別的分頁)不畫:量不到位置,另外畫的字會跑到奇怪的地方;回到這一頁時再畫
      if (!isActive() || !$("stage").clientWidth) { pending = true; onPending(); return false; }
      pending = false;
      osmd.zoom = api.zoom(); lastZoom = osmd.zoom;
      render();
      if (!api.landZoom) fitWidth();
      measure();
      fitLand();
    } catch (e) {
      console.error(e);
      msg(() => errorText(e));
    }
    onDrawn(xml);
    return true;
  }
  function render(){ osmd.render(); afterRender($("osmd").querySelector("svg")); }
  /* 短的譜放大到大約填滿紙張(最多 1.6 倍);太長的照原本大小,左右捲動、播放軸跟著走 */
  function fitWidth(){
    const svg = $("osmd").querySelector("svg"); if (!svg) return;
    const w = svg.getBoundingClientRect().width, avail = $("stage").clientWidth - 16;
    if (!w || !avail) return;
    const z = Math.max(api.zoom(), Math.min(1.6, osmd.zoom * avail * 0.94 / w));
    if (Math.abs(z - osmd.zoom) < 0.03) return;
    osmd.zoom = z; lastZoom = api.zoom(); render();
  }
  /* 縮放改了(手機橫式放大 / 縮回):照新的縮放重畫、重量 */
  function refit(){
    osmd.zoom = api.zoom(); lastZoom = osmd.zoom;
    render();
    if (!api.landZoom) fitWidth();
    measure();
    return true;
  }
  /* 走一遍 OSMD 游標,記下每一步的拍點(四分音符)與 x(符頭正中央,裝飾音不算);最後補「這一輪結束」的位置 */
  function measure(len = lenBeats()){
    noteXs = [];
    const c = osmd.cursor;
    c.show(); c.reset();
    let guard = 0;
    const ox = $("osmd").getBoundingClientRect().x;
    while (!c.Iterator.EndReached && guard++ < 3000) {
      const el = c.cursorElement;
      let xs = [];
      try {
        xs = c.GNotesUnderCursor().map(n => { const g = n.getSVGGElement && n.getSVGGElement(); const h = g && [...g.querySelectorAll(".vf-notehead")].find(e => !e.closest(".vf-modifiers")); const r = h && h.getBoundingClientRect(); return r && r.width ? r.x - ox + r.width / 2 : null; }).filter(v => v != null);
      } catch (e) {}
      const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : parseFloat(el.style.left) + (el.offsetWidth || 0) / 2;
      const beat = c.Iterator.currentTimeStamp.RealValue * 4;
      if (!noteXs.length || beat > noteXs[noteXs.length - 1].beat + 1e-6) noteXs.push({ beat, x });
      c.next();
    }
    c.reset(); c.hide();
    // 最後補一個「這一輪結束」的位置(右邊的小節線前面)
    const svg = $("osmd").querySelector("svg");
    if (svg && noteXs.length && len != null) {
      const lastX = noteXs[noteXs.length - 1].x, sr = svg.getBoundingClientRect();
      noteXs.push({ beat: len, x: Math.max(lastX + 10, sr.right - ox - 14) });
    }
    $("scroll").scrollLeft = 0;
    placeExtent();
    movePlayline(0, false);
  }
  /* 播放軸的上下:貼著譜線與音符再往外留一點 */
  function placeExtent(){
    const stage = $("stage"), pl = $("playline"), svg = $("osmd").querySelector("svg");
    if (!svg) { pl.hidden = true; return; }
    const sr = stage.getBoundingClientRect();
    let top = Infinity, bot = -Infinity;
    svg.querySelectorAll(".vf-stavenote, .staffline").forEach(g => { const r = g.getBoundingClientRect(); if (r.height) { top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); } });
    if (!isFinite(top)) { pl.hidden = true; return; }
    const pad = 10;
    pl.style.top = Math.max(0, top - sr.top - pad) + "px";
    pl.style.bottom = Math.max(0, sr.bottom - bot - pad) + "px";
    pl.hidden = false;
  }
  function xAtBeat(beat){
    if (!noteXs.length) return 0;
    if (beat <= noteXs[0].beat) return noteXs[0].x;
    for (let i = 0; i + 1 < noteXs.length; i++) {
      const a = noteXs[i], b = noteXs[i + 1];
      if (beat < b.beat) return a.x + (b.x - a.x) * (beat - a.beat) / (b.beat - a.beat);
    }
    return noteXs[noteXs.length - 1].x;
  }
  /* follow = true:播放中,目前位置停在 25%(能捲才捲)。播放中用 transform 移動譜(小數像素),不改 scrollLeft(整數,會抖) */
  function movePlayline(beat, follow){
    const scroll = $("scroll"), o = $("osmd"), pl = $("playline");
    const x = o.offsetLeft + xAtBeat(beat);
    if (follow) {
      if (scroll.scrollLeft) scroll.scrollLeft = 0;
      const max = Math.max(0, o.offsetLeft + o.offsetWidth - scroll.clientWidth);
      const shift = Math.max(0, Math.min(max, x - scroll.clientWidth * PLAYLINE_RATIO));
      o.style.transform = shift ? `translate3d(${-shift}px,0,0)` : "";
      pl.style.transform = `translate3d(${x - shift - 1}px,0,0)`;
      return;
    }
    if (o.style.transform) o.style.transform = "";
    pl.style.transform = `translate3d(${x - scroll.scrollLeft - 1}px,0,0)`;
  }
  /* 停止播放後:捲回開頭、播放軸回到第一個音 */
  function home(){ if (osmd && noteXs.length) { $("scroll").scrollLeft = 0; movePlayline(0, false); } }
  /* 清掉譜面(沒有題目時) */
  function clear(){ if (osmd) { try { osmd.clear(); } catch (e) {} } $("osmd").innerHTML = ""; osmd = null; noteXs = []; $("playline").hidden = true; seq++; pending = false; api.landZoom = null; lastXml = null; }
  /* 畫面大小改了 / 回到畫面:延後的先畫;縮放或紙張寬度改了就重畫;不然只重量播放軸 */
  function onResize(){
    if (!osmd) return;
    if (pending && $("stage").clientWidth) { if (lastXml) load(lastXml); return; }
    if (pending) return;
    if (fitLand()) return;
    const z = api.zoom();
    if (z !== lastZoom || Math.abs(($("stage").clientWidth || 0) - (stageW || 0)) > 24) {
      stageW = $("stage").clientWidth; lastZoom = z; osmd.zoom = z;
      render();
      if (!api.landZoom) fitWidth();
      measure(); return;
    }
    placeExtent();
    if (!playing()) movePlayline(0, false);
  }
  $("scroll").addEventListener("scroll", () => { if (!playing()) movePlayline(0, false); }, { passive: true });
  return api;
}
