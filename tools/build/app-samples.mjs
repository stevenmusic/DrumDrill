// 把鼓的取樣打包進 App(app/www/samples/),App 第一次打開就有聲音、完全不用網路。
// 來源跟網頁版一樣:ScrollScore 的 Naked Drums(drums/,CC-BY 4.0)。只帶 App 用得到的鼓件:
// 小鼓(5 層力度 × 10 個 round-robin)、節拍器的鼓框聲(xstick)、鼓房殘響(room.flac)。之後加視奏(整組鼓)時把鼓件加進 PIECES。
// 下載過的原檔存在 tools/build/samples/(不進 git),之後重跑不用再下載。
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../../", import.meta.url).pathname;
const SRC = "https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/";
const PIECES = ["snare"];
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
  const copy = (name) => { const dst = out + "drums/" + name; fs.copyFileSync(download("drums/" + name), dst); bytes += fs.statSync(dst).size; count++; };
  for (const piece of PIECES) {
    const p = manifest.pieces[piece];
    p.layers.forEach((l, li) => { for (let rr = 1; rr <= l.rr; rr++) copy(`${p.prefix}-L${li + 1}.${String(rr).padStart(2, "0")}.flac`); });
  }
  CLICKS.forEach(copy);
  copy("room.flac");
  fs.writeFileSync(out + "drums/manifest.json", JSON.stringify(manifest));
  console.log(`app/www/samples:${count} 個檔、${(bytes / 1e6).toFixed(1)} MB`);
}

if (import.meta.url === `file://${process.argv[1]}`) bundleSamples();
