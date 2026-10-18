// 把鼓的取樣打包進 App(app/www/samples/),App 第一次打開就有聲音、完全不用網路。
// 來源跟網頁版一樣:ScrollScore 的 Naked Drums(drums/,CC-BY 4.0)。只帶 App 用得到的鼓件:
// 技巧的小鼓(5 層力度 × 10 個 round-robin)、整組鼓 12 個鼓件(視奏 / 聽力)、節拍器的鼓框聲(xstick)、鼓房殘響(room.flac)。
// 整組鼓每層只帶前幾個 round-robin(docs/STAGES.md 決定 11:鼓皮 6、鈸 4;js/shared/audio.js 的 KIT_RR
// 在 iPhone / iPad / 小記憶體裝置只用前 3 / 2 個,其他 6 / 4 個)。鼓件名稱照 ScrollScore drums/manifest.json。
// 下載過的原檔存在 tools/build/samples/(不進 git),之後重跑不用再下載。
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../../", import.meta.url).pathname;
const SRC = "https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/";
// 鼓件 → 每層帶幾個 round-robin(小鼓照技巧的上限 10;鼓皮 6、鈸 4,docs/STAGES.md 決定 11)
const PIECES = {
  snare: 10,
  kick: 6, xstick: 6, tom1: 6, tom3: 6, tom5: 6,
  hhClosed: 4, hhOpen: 4, hhPedal: 4, ride: 4, rideBell: 4, crashL: 4
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
  CLICKS.forEach(copy);
  copy("room.flac");
  fs.writeFileSync(out + "drums/manifest.json", JSON.stringify(manifest));
  console.log(`app/www/samples:${count} 個檔、${(bytes / 1e6).toFixed(1)} MB`);
  console.log(Object.entries(per).map(([k, b]) => `  ${k} ${(b / 1e6).toFixed(1)} MB`).join("\n"));
}

if (import.meta.url === `file://${process.argv[1]}`) bundleSamples();
