// 把鼓的取樣打包進 App(app/www/samples/),App 第一次打開就有聲音、完全不用網路。
// 來源跟網頁版一樣:ScrollScore 的 Naked Drums(drums/,CC-BY 4.0)。只帶 App 用得到的鼓件:
// 技巧的小鼓(5 層力度 × 6 個 round-robin)、整組鼓 12 個鼓件(視奏 / 聽力)、節拍器的鼓框聲(xstick)、鼓房殘響(room.flac)。
// iOS App(iPhone 與 iPad)在 js/shared/audio.js 一律走小記憶體(LOW_MEM),所以每層只帶 App 真的會用到的 round-robin:
// 小鼓 = RR_LIMIT 的小記憶體值 6、鼓皮 / 鈸 = KIT_RR 的小記憶體值 3 / 2(docs/STAGES.md 決定 11)。
// 這裡的數字跟 audio.js 不一致時 tools/test/verify.mjs 會失敗(checks/appsamples.mjs)。鼓件名稱照 ScrollScore drums/manifest.json。
// 下載過的原檔存在 tools/build/samples/(不進 git),之後重跑不用再下載。
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../../", import.meta.url).pathname;
const SRC = "https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/";
// 鼓件 → 每層帶幾個 round-robin(= audio.js 小記憶體的上限:小鼓 RR_LIMIT 6;鼓皮 KIT_RR.head 3、鈸 KIT_RR.cymbal 2)
export const PIECES = {
  snare: 6,
  kick: 3, xstick: 3, tom1: 3, tom3: 3, tom5: 3,
  hhClosed: 2, hhOpen: 2, hhPedal: 2, ride: 2, rideBell: 2, crashL: 2
};
const CLICKS = ["nk-xstick-L1.01.flac", "nk-xstick-L1.02.flac", "nk-xstick-L1.03.flac"];
const cacheDir = root + "tools/build/samples/";
const out = root + "app/www/samples/";

function download(path) {
  const file = cacheDir + path.replace(/\//g, "__");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync("curl", ["-fsSL", "--retry", "3", "-o", file + ".part", SRC + path]);
    fs.renameSync(file + ".part", file);
  }
  return file;
}

export function bundleSamples() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out + "drums", { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(download("drums/manifest.json"), "utf8"));
  let bytes = 0, count = 0;
  const per = {}, done = new Set();
  const copy = (name, piece = "other") => {
    if (done.has(name)) return; done.add(name);   // 節拍器的 xstick 跟整組鼓的 xstick 是同一批檔案
    const dst = out + "drums/" + name; fs.copyFileSync(download("drums/" + name), dst);
    const b = fs.statSync(dst).size; bytes += b; count++; per[piece] = (per[piece] || 0) + b;
  };
  for (const [piece, max] of Object.entries(PIECES)) {
    const p = manifest.pieces[piece];
    if (!p) throw new Error("manifest 沒有 " + piece);
    p.layers.forEach((l, li) => { for (let rr = 1; rr <= Math.min(l.rr, max); rr++) copy(`${p.prefix}-L${li + 1}.${String(rr).padStart(2, "0")}.flac`, piece); });
  }
  CLICKS.forEach(f => copy(f, "xstick"));
  copy("room.flac");
  fs.writeFileSync(out + "drums/manifest.json", JSON.stringify(manifest));
  console.log(`app/www/samples:${count} 個檔、${(bytes / 1e6).toFixed(1)} MB`);
  console.log(Object.entries(per).map(([k, b]) => `  ${k} ${(b / 1e6).toFixed(1)} MB`).join("\n"));
}

if (import.meta.url === `file://${process.argv[1]}`) bundleSamples();
