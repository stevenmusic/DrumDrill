/* 手機橫式(orientation:landscape 且高度 ≤ 500;平板不算),照 PianoDrill js/tech/app.js 的 fitLandZoom / land-play 改寫成共用版:
   - fitLandZoom:譜面依「譜面框到畫面底」放大,讓「工具列 + 樂譜卡標題 + 譜」剛好一個畫面(雙手兩行譜、左右手字母都看得到)
   - 播放時 body 加 land-play:樂譜卡貼到頂欄下面、延伸到畫面底(css/app.css),譜再放大到滿版;
     停止(或播完)時捲回播放前的位置、縮回;循環的下一輪不捲;播放中點譜面 = 停止(橫式看不到播放鈕)
   元素都用模組自己的 $(id => document.getElementById(前綴 + id)),這裡不寫死前綴:$("osmd")、$("stage")、$("scoreCard") */
export const PHONE_LAND = "(orientation: landscape) and (max-height: 500px)";
export const isPhoneLand = () => matchMedia(PHONE_LAND).matches;

/* 上方展開的設定卡不算(照收合時的位置算):不然展開/收合設定、切語言時譜面大小跟著變;並排的設定卡垂直範圍重疊,只算一次 */
function openSetupHeight(stage){
  const st = stage.getBoundingClientRect().top;
  const spans = [...document.querySelectorAll(".setup.open .setup-body, .picker.open .setup-body")]
    .map(el => el.getBoundingClientRect()).filter(r => r.height && r.bottom <= st)
    .map(r => [r.top - 8, r.bottom]).sort((a, b) => a[0] - b[0]);
  let h = 0, end = -Infinity;
  for (const [a, b] of spans) { if (b <= end) continue; h += b - Math.max(a, end); end = b; }
  return h;
}
/* score:js/shared/score.js 的 createScore 回傳的物件(landZoom、osmd、refit());回傳 true = 縮放改了、已經重畫 */
export function fitLandZoom(score, { $ }){
  if (!score.osmd) { score.landZoom = null; return false; }   // 沒有譜(clear 之後):不能 refit
  if (!isPhoneLand()) { if (score.landZoom) { score.landZoom = null; return score.refit(); } return false; }
  const osmd = score.osmd, svg = $("osmd").querySelector("svg"); if (!svg || !osmd) return false;
  const H = svg.getBoundingClientRect().height; if (!H) return false;
  // 第一個畫面(沒有捲動時)譜面上緣以下還剩多少高度;播放中(樂譜卡貼在頂欄下面)可以放到滿版
  const playing = document.body.classList.contains("land-play");
  const top = playing ? document.querySelector("header").offsetHeight + $("scoreCard").querySelector(".card-title").offsetHeight + 30
    : $("stage").getBoundingClientRect().top + scrollY - openSetupHeight($("stage"));
  const avail = Math.max(130, innerHeight - top - 14);
  const z = Math.max(0.6, Math.min(1.8, osmd.zoom * avail / H));
  if (Math.abs(z - osmd.zoom) < 0.03) { score.landZoom = osmd.zoom; return false; }
  score.landZoom = z; return score.refit();
}
/* 播放時的手機橫式畫面:reveal()(播放開始;不是手機橫式回傳 false,模組自己捲)、release(keepView)(停止)、onResize()(播放中轉向)
   opts:$、score、playing()(是不是在播放)、stop()(停止播放)、reveal()(模組的「讓譜面看得到」:轉回直式時呼叫) */
export function createLandPlay({ $, score, playing, stop, reveal }){
  let landScroll = null;   // 播放前的捲動位置(播完捲回去,播放鈕才看得到)
  const fit = () => fitLandZoom(score, { $ });
  function show(){
    if (!isPhoneLand()) return false;
    // 樂譜卡貼在頂欄下面、譜面延伸到底
    if (landScroll == null) landScroll = scrollY;
    document.body.classList.add("land-play");
    if (fit()) score.movePlayline(0, false);   // 播放時譜面放大到滿版
    const top = $("scoreCard").getBoundingClientRect().top - document.querySelector("header").getBoundingClientRect().bottom - 6;
    if (Math.abs(top) > 2) window.scrollBy({ top, behavior: "smooth" });
    return true;
  }
  function release(keepView){
    if (keepView || landScroll == null) return;
    document.body.classList.remove("land-play");
    window.scrollTo({ top: landScroll, behavior: "smooth" }); landScroll = null;
    fit();   // 停止後縮回第一個畫面放得下的大小
  }
  /* 播放中轉向:直式 → 橫式 譜面貼到頂欄下;橫式 → 直式 拿掉 land-play,照直式的方式讓譜面看得到 */
  function onResize(){
    if (!playing()) return;
    const land = document.body.classList.contains("land-play");
    if (isPhoneLand() && !land) { show(); setTimeout(() => { if (playing()) show(); }, 400); }   // 譜面放大重畫後再對齊一次
    else if (!isPhoneLand() && land) { document.body.classList.remove("land-play"); landScroll = null; reveal(); }
  }
  // 手機橫式播放中看不到播放鈕:點譜面就停止(並捲回播放鈕)
  $("stage").addEventListener("click", () => { if (playing() && document.body.classList.contains("land-play")) stop(); });
  return { reveal: show, release, onResize, fit };
}
