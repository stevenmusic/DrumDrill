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
const CACHE = APP + "-app-a873b5e1";
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
  "css/app.css?v=a9934de4eb",
  "css/drum.css?v=09ec134914",
  "vendor/opensheetmusicdisplay.min.js?v=4bfeb3d01c",
  "js/ear/app.js?v=e11509a0f9",
  "js/ear/gen.js?v=88f8af4408",
  "js/ear/strings.js?v=26e468e125",
  "js/main.js?v=170ee35eab",
  "js/shared/a11y.js?v=4ece20f2e5",
  "js/shared/audio.js?v=453f7237f3",
  "js/shared/daily.js?v=90d712e055",
  "js/shared/dailycard.js?v=2c22da5c40",
  "js/shared/drill.js?v=9f698a5f44",
  "js/shared/examdata.js?v=48f1b46bf2",
  "js/shared/examview.js?v=3f2d59a5c9",
  "js/shared/i18n.js?v=ef283333d2",
  "js/shared/kitevents.js?v=23a7a44853",
  "js/shared/kitgen.js?v=d8b300ef0e",
  "js/shared/kitnotation.js?v=abfe448d01",
  "js/shared/landscape.js?v=31839615ad",
  "js/shared/legend.js?v=40cb0227d1",
  "js/shared/level.js?v=4b5ae773cf",
  "js/shared/mic.js?v=5450b68a2d",
  "js/shared/micrhythm.js?v=2f8f692d8e",
  "js/shared/mock.js?v=3ba9d18038",
  "js/shared/onsets.js?v=d8df0b9ef2",
  "js/shared/pad.js?v=519b87f153",
  "js/shared/playbackgen.js?v=72aac8d275",
  "js/shared/player.js?v=3b242c7289",
  "js/shared/practicelog.js?v=2db3042931",
  "js/shared/score.js?v=b886986d48",
  "js/shared/staffframe.js?v=7d869b31d1",
  "js/shared/tempo.js?v=1e38af7d3f",
  "js/shared/timing.js?v=9ab84e3e3f",
  "js/shared/values.js?v=e240ea1b65",
  "js/sight/app.js?v=12ecdcdae1",
  "js/sight/fingerprint.js?v=3460b8fafa",
  "js/sight/gen.js?v=6633bf6b2e",
  "js/sight/meter.js?v=94d1b94ae1",
  "js/sight/random.js?v=3b9b511386",
  "js/sight/reading.js?v=cdad6c5e79",
  "js/sight/stage.js?v=bee4aca9a4",
  "js/sight/strings.js?v=666e49e89c",
  "js/tech/app.js?v=a4b7697d91",
  "js/tech/notation.js?v=5bee65ac3d",
  "js/tech/route.js?v=572836bc23",
  "js/tech/routes.js?v=3d068fd0ea",
  "js/tech/routespec.js?v=204c6a53af",
  "js/tech/rudiments.js?v=cc1a2635ff",
  "js/tech/store.js?v=46a31a5e45",
  "js/tech/strings.js?v=9301f59c35",
  "data/drumkey.json?v=a479cd9dd6",
  "data/exam-rsl.json?v=62a690625a",
  "data/exam-trinity.json?v=e40791773a"
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
