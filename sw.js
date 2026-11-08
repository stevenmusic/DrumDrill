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
const CACHE = APP + "-app-860f2cf1";
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
  "css/app.css?v=f3ba9d89d4",
  "css/drum.css?v=aae96c4b5f",
  "vendor/opensheetmusicdisplay.min.js?v=4bfeb3d01c",
  "js/ear/app.js?v=23cb07d5f5",
  "js/ear/gen.js?v=cd5d9e1477",
  "js/ear/strings.js?v=7ba8fa190d",
  "js/main.js?v=ff3e07702b",
  "js/shared/a11y.js?v=af6364b77b",
  "js/shared/audio.js?v=cdfead7200",
  "js/shared/backup.js?v=620efafdf5",
  "js/shared/celebrate.js?v=f83964f212",
  "js/shared/daily.js?v=f345ae5399",
  "js/shared/dailycard.js?v=95e418efa6",
  "js/shared/digest.js?v=a0bde17c3e",
  "js/shared/drill.js?v=9f698a5f44",
  "js/shared/examdata.js?v=48f1b46bf2",
  "js/shared/examview.js?v=087d899e81",
  "js/shared/i18n.js?v=78166853a4",
  "js/shared/keystrip.js?v=dd4d105375",
  "js/shared/kitevents.js?v=599b14d902",
  "js/shared/kitgen.js?v=12fd0101b6",
  "js/shared/kitnotation.js?v=1b100f0235",
  "js/shared/landscape.js?v=3a37d0ad2d",
  "js/shared/legend.js?v=a49cc7408c",
  "js/shared/level.js?v=2fc19e17ec",
  "js/shared/mic.js?v=5450b68a2d",
  "js/shared/micrhythm.js?v=21f5734f52",
  "js/shared/milestone.js?v=40a9ff0313",
  "js/shared/mock.js?v=9df65989b6",
  "js/shared/onsets.js?v=d8df0b9ef2",
  "js/shared/pad.js?v=68bda76506",
  "js/shared/playbackgen.js?v=85598e8957",
  "js/shared/player.js?v=3b242c7289",
  "js/shared/practicelog.js?v=251db99df8",
  "js/shared/roadmap.js?v=cd243150ea",
  "js/shared/score.js?v=2cc03a640d",
  "js/shared/staffframe.js?v=7d869b31d1",
  "js/shared/tempo.js?v=1e38af7d3f",
  "js/shared/timing.js?v=c72b213c42",
  "js/shared/values.js?v=e240ea1b65",
  "js/sight/app.js?v=937f13661d",
  "js/sight/fingerprint.js?v=3460b8fafa",
  "js/sight/gen.js?v=7dec9f68c1",
  "js/sight/meter.js?v=94d1b94ae1",
  "js/sight/random.js?v=3b9b511386",
  "js/sight/reading.js?v=bb6b2ae710",
  "js/sight/stage.js?v=bee4aca9a4",
  "js/sight/strings.js?v=fc4ac6d869",
  "js/tech/app.js?v=faa04b1d0d",
  "js/tech/notation.js?v=5bee65ac3d",
  "js/tech/route.js?v=5840174163",
  "js/tech/routes.js?v=7cd78a3977",
  "js/tech/routespec.js?v=8125ab745a",
  "js/tech/rudiments.js?v=553c5590cc",
  "js/tech/store.js?v=70f9c4e359",
  "js/tech/strings.js?v=e67e6d52a8",
  "data/drumkey.json?v=a479cd9dd6",
  "data/exam-rsl.json?v=62a690625a",
  "data/exam-trinity.json?v=e3550ce8e2"
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
