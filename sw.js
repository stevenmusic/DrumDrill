/* 離線使用(Service Worker)
   - 安裝時先把整份 App(首頁、manifest、圖示、授權 / 隱私 / 支援頁、css、js、data、vendor;清單 PRECACHE 由 tools/build/stamp.mjs 寫入)存好,
     第一次打開之後就算沒網路、沒點過的分頁也能用;快取名稱帶「清單 + 沒有 ?v= 的檔案內容」的雜湊,版本一變就換一個快取,舊的在新版啟用時刪掉
   - 頁面(首頁、授權、隱私、支援):先上網拿最新的,沒網路才用快取 → 有更新時一定拿到新版
   - 同網域的 css / js / data / vendor:網址都帶 ?v=內容指紋(tools/build/stamp.mjs),同一個網址內容不會變 → 先用快取;
     存了新版本就刪掉同一個檔案的舊版本
   - Google 字型:先用快取
   - 樂器取樣(raw.githubusercontent)由 js/shared/audio.js 自己存在 APP-samples-* 快取,這裡不管;
     App 版打包在 App 裡的取樣(samples/)本來就在裝置上,也不再存一份
   PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):@app 區段與預快取清單以外兩邊一模一樣 */
// @app-begin
const APP = "drumdrill";
// @app-end
/*@precache-begin*/
const CACHE = APP + "-app-ec4ce049";
const PRECACHE = [
  "./",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "licenses.html",
  "privacy.html",
  "support.html",
  "css/app.css?v=477a64fb06",
  "css/drum.css?v=19d8c0c73b",
  "vendor/opensheetmusicdisplay.min.js?v=4bfeb3d01c",
  "js/ear/app.js?v=511ea96349",
  "js/ear/gen.js?v=353441acde",
  "js/ear/strings.js?v=814ce27ed7",
  "js/main.js?v=6c76534d4e",
  "js/shared/a11y.js?v=a88a3682ab",
  "js/shared/audio.js?v=453f7237f3",
  "js/shared/drill.js?v=9f698a5f44",
  "js/shared/examdata.js?v=48f1b46bf2",
  "js/shared/examview.js?v=b4959afa11",
  "js/shared/i18n.js?v=e896a8227f",
  "js/shared/kitevents.js?v=967a5358a2",
  "js/shared/kitgen.js?v=62dcae587f",
  "js/shared/kitnotation.js?v=65e0d6b2cb",
  "js/shared/landscape.js?v=8ab1bab3eb",
  "js/shared/legend.js?v=32309a03b5",
  "js/shared/level.js?v=8cd64a3754",
  "js/shared/mic.js?v=5450b68a2d",
  "js/shared/micrhythm.js?v=5cf0c5d447",
  "js/shared/mock.js?v=7e54be8c58",
  "js/shared/onsets.js?v=d8df0b9ef2",
  "js/shared/pad.js?v=1076ad7ccb",
  "js/shared/playbackgen.js?v=bb16cf9be2",
  "js/shared/player.js?v=3b242c7289",
  "js/shared/practicelog.js?v=acd9cd53aa",
  "js/shared/score.js?v=6b5e241a71",
  "js/shared/staffframe.js?v=7d869b31d1",
  "js/shared/tempo.js?v=1e38af7d3f",
  "js/shared/timing.js?v=dfff79a71a",
  "js/sight/app.js?v=a6bbf2365e",
  "js/sight/fingerprint.js?v=c0cdf7916e",
  "js/sight/gen.js?v=6633bf6b2e",
  "js/sight/meter.js?v=94d1b94ae1",
  "js/sight/random.js?v=3b9b511386",
  "js/sight/reading.js?v=d3ec018ecf",
  "js/sight/stage.js?v=9ca7fb07ed",
  "js/sight/strings.js?v=2b03e5348e",
  "js/tech/app.js?v=ea058f045c",
  "js/tech/notation.js?v=5bee65ac3d",
  "js/tech/rudiments.js?v=cc1a2635ff",
  "js/tech/store.js?v=f34a09889a",
  "js/tech/strings.js?v=37a7590b02",
  "data/drumkey.json?v=a479cd9dd6",
  "data/exam-rsl.json?v=0fe7ae1fe3",
  "data/exam-trinity.json?v=5a8f14c380"
];
/*@precache-end*/
self.addEventListener("install", e => {
  // ?v= 的網址內容不會變,可以用瀏覽器快取裡的;首頁、manifest、圖示要先問伺服器(GitHub Pages 會讓瀏覽器快取 10 分鐘)
  const reqs = PRECACHE.map(u => new Request(u, { cache: u.includes("?v=") ? "default" : "no-cache" }));
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(reqs)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(APP + "-app-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(req){
  const c = await caches.open(CACHE);
  // 首頁存在 "./";其他頁面(licenses.html、privacy.html、support.html)各存各的(不帶 ?query),不能蓋掉首頁
  const u = new URL(req.url);
  const key = /\/(index\.html)?$/.test(u.pathname) ? "./" : u.origin + u.pathname;
  try {
    const res = await fetch(req);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch (e) {
    return (await c.match(key)) || (await c.match("./")) || Response.error();
  }
}
async function cacheFirst(req){
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    await c.put(req, res.clone());
    // 同一個檔案的舊版本(?v= 不同)刪掉
    const u = new URL(req.url);
    if (u.origin === location.origin && u.searchParams.has("v")) {
      for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }
    }
  }
  return res;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname.includes("/samples/")) return;
    if (req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("/index.html")) e.respondWith(networkFirst(req));
    else e.respondWith(cacheFirst(req));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
