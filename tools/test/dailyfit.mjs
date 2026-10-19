// 今日練習的路線譜(律動 28 關、過門 19 關;每天不一樣的關換幾個種子)× 每種尺寸:譜要整份放進譜框(不左右捲)
// 檢查:SVG 寬度 ≤ 譜框寬度、譜框不能左右捲、整頁沒有橫向捲動、譜的內容(含 R / L)不超出 SVG、縮放不小於可讀的大小
//       (一行 / 每行 2 小節 0.55,一小節一行 0.45)
// 用法:node tools/test/dailyfit.mjs [尺寸,…](預設 fold-280,se1-320,iphone-390,iphone-land,ipad,desktop);V=1 每題印出排法
import { open } from "./harness.mjs";
const VPS = { "fold-280": [280, 653, true], "se1-320": [320, 568, true], "iphone-390": [390, 844, true], "iphone-land": [844, 390, true], "ipad": [820, 1180, true], "desktop": [1440, 900, false] };
const only = (process.argv[2] || Object.keys(VPS).join(",")).split(",");
const SEEDS = [0, 7, 13, 29];
let bad = 0, total = 0;
for (const vp of only) {
  const [w, hh, mobile] = VPS[vp];
  const h = await open({ viewport: { width: w, height: hh }, mobile, dpr: 1 });
  const { page } = h;
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  await page.click("#obNo").catch(() => {}); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("#t-dailyCard .daily-btn").click()); await page.waitForTimeout(1500);
  const list = await page.evaluate(() => ["groove", "fill"].flatMap(r => window.__tech.daily.levelOf(r, r === "groove" ? "A1" : "FA1").route.levels.map(L => [r, L.id])));
  const fails = [];
  for (const [r, id] of list) for (const seed of SEEDS) {
    total++;
    const res = await page.evaluate(async ([r, id, seed]) => {
      const T = window.__tech, L = T.daily.levelOf(r, id);
      const s = { k: "route", r, lv: id, level: L, bpm: L.start, target: L.target, need: 3, click: "every", i: 1, of: 3, tries: 0, streak: 0 };
      if (!seed) T.dShow(s); else T.rv.show(s, seed);
      const svgOk = () => { const o = T.rv.score.osmd, svg = document.querySelector("#t-rOsmd svg"); return T.rv.cur && T.rv.cur.level.id === id && o && svg && !T.rv.score.pending; };
      for (let i = 0; i < 200 && !svgOk(); i++) await new Promise(r => setTimeout(r, 25));
      await new Promise(r => setTimeout(r, 250));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const svg = document.querySelector("#t-rOsmd svg"), sc = document.getElementById("t-rScroll");
      if (!svg) return { err: "沒有譜" };
      const vb = svg.viewBox.baseVal, bb = svg.getBBox(), sr = svg.getBoundingClientRect(), fr = sc.getBoundingClientRect();
      const cut = vb && vb.height ? Math.max(0, bb.y + bb.height - (vb.y + vb.height), vb.y - bb.y, bb.x + bb.width - (vb.x + vb.width)) : 0;
      const f = T.rv.fit;
      return { cut: Math.round(cut), below: Math.round(sr.bottom - fr.bottom), right: Math.round(sr.right - fr.right), sw: Math.round(sr.width), fw: sc.clientWidth,
        scroll: sc.scrollWidth - sc.clientWidth, page: document.documentElement.scrollWidth - innerWidth, n: f.wrapN, zoom: f.zoom };
    }, [r, id, seed]);
    const why = [];
    if (res.err) why.push(res.err);
    else {
      if (res.sw > res.fw + 1) why.push(`SVG ${res.sw} > 譜框 ${res.fw}`);
      if (res.cut > 1) why.push(`譜的內容超出畫布 ${res.cut}`);
      if (res.below > 1 || res.right > 1) why.push(`SVG 超出譜框(下 ${res.below}、右 ${res.right})`);
      if (res.scroll > 1) why.push(`譜框左右捲 ${res.scroll}px`);
      if (res.page > 1) why.push(`整頁橫向捲動 ${res.page}px`);
      if (res.zoom < (res.n === 1 ? 0.45 : 0.55) - 1e-6) why.push(`縮放 ${res.zoom} 太小`);
    }
    if (why.length) { bad++; fails.push(`  ${r} ${id} 種子 ${seed}: ${why.join(";")}`); }
    else if (process.env.V && !seed) console.log(`  ${vp} ${id} ${res.n ? "每行 " + res.n + " 小節" : "一行"} × ${Math.round(res.zoom * 100) / 100}`);
  }
  console.log(`${vp}: ${fails.length ? "✗ " + fails.length + " 個" : "✓"}`); fails.forEach(f => console.log(f));
  if (h.errors.length) { bad++; console.log(h.errors.slice(0, 5)); }
  await h.close();
}
console.log(bad ? `✗ ${bad} 個問題(共 ${total} 題)` : `✓ 全部 ${total} 題放得下`);
process.exit(bad ? 1 : 0);
