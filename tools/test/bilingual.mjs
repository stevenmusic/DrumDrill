// 中英文版面一致:同一個畫面狀態,中文、英文各量一次每個可見元素的位置與高度,
// 高度或上緣不同(= 英文換行、多一行、被擠下去)就列出來。各尺寸 × 各分頁 × 對話框
// PianoDrill / DrumDrill 共用(tools/test/sync.mjs 檢查):檢查函式一模一樣,畫面狀態腳本放在 @app 區段
import { open } from "./harness.mjs";
const ALL = [
  ["fold-280", 280, 653, true], ["se1-320", 320, 568, true], ["iphone-390", 390, 844, true], ["promax-430", 430, 932, true],
  ["se-land", 667, 375, true], ["iphone-land", 844, 390, true], ["ipad", 820, 1180, true], ["ipad-land", 1180, 820, true],
  ["laptop", 1280, 800, false], ["fhd", 1920, 1080, false], ["narrow-window", 500, 900, false]
];
const only = process.argv[2];
const VPS = only ? ALL.filter(v => v[0] === only) : ALL;
let bad = 0; const issues = [];
const snap = page => page.evaluate(() => {
  const vis = e => { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || e.closest("[hidden]")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...document.querySelectorAll("body *")].map(e => {
    if (!vis(e) || e.closest(".opt.rud span") || e.closest(".quick .opt span") || e.closest("#t-osmd") || e.id === "t-playline" || e.closest("#s-score") || e.closest(".stage")) return null;
    const r = e.getBoundingClientRect();
    return { t: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width), l: Math.round(r.left), name: e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.classList.length ? "." + [...e.classList].join(".") : ""), txt: e.textContent.trim().replace(/\s+/g, " ").slice(0, 40) };
  }).filter(Boolean);   // 只比看得到的元素(看不到的 <option> 等數量不同時,不會讓後面全部錯位)
});
async function compare(page, vp, state){
  await page.waitForFunction(() => !document.getElementById("t-loadingMsg").textContent.trim() || document.getElementById("t-loadingMsg").hidden, null, { timeout: 30000 }).catch(() => {});
  const setLang = async l => { const cur = await page.evaluate(() => document.documentElement.lang); if ((cur === "en") !== (l === "en")) { await page.click("#langToggle"); await page.waitForTimeout(900); } };
  await setLang("zh"); const zh = await snap(page);
  await setLang("en"); const en = await snap(page);
  await setLang("zh");
  const seen = new Set();
  for (let i = 0; i < zh.length; i++) {
    const a = zh[i], b = en[i];
    if (!a && !b) continue;
    if (!a || !b) { issues.push(`${vp} ${state}: 只有${a ? "中文" : "英文"}看得到 ${(a || b).name} 「${(a || b).txt}」`); bad++; continue; }
    if (Math.abs(a.h - b.h) > 1) {
      const k = a.name + a.h + b.h; if (seen.has(k)) continue; seen.add(k);
      issues.push(`${vp} ${state}: 高度 ${a.h}→${b.h} ${a.name}「${a.txt}」/「${b.txt}」`); bad++;
    }
  }
  const hz = Math.max(...zh.filter(Boolean).map(x => x.t + x.h)), he = Math.max(...en.filter(Boolean).map(x => x.t + x.h));
  if (Math.abs(hz - he) > 1) { issues.push(`${vp} ${state}: 頁面高度 ${hz}→${he}`); bad++; }
}
for (const [name, w, h, mobile] of VPS) {
  const { page, errors, close } = await open({ viewport: { width: w, height: h }, mobile, dpr: 1 });
  const tab = v => page.click(`#tabbar button[data-view="${v}"]`).then(() => page.waitForTimeout(400));
  const sub = v => page.click(`#subSeg button[data-v="${v}"]`).then(() => page.waitForTimeout(500));
  const expand = async sel => { if (await page.isVisible(sel + " .setup-summary")) { await page.click(sel + " .setup-summary"); await page.waitForTimeout(200); } };
  // @app-begin:各 App 的畫面狀態;最後把題目與標籤的中英行數差異放進 diff
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("drumdrill-lang", "zh"); });
  await page.reload(); await page.waitForFunction(() => window.__stageReady >= 1);
  await compare(page, name, "對話框");
  await page.selectOption("#obGrade", "5"); await page.click("#obYes"); await page.waitForTimeout(300);
  await compare(page, name, "檢定 收合");
  await expand("#examSetup"); await compare(page, name, "檢定 展開");
  await page.click('#systemSeg button[data-v="rsl"]'); await page.waitForTimeout(300);
  await compare(page, name, "檢定 RSL");
  await sub("sight"); await compare(page, name, "檢定 視奏");
  await sub("ear"); await compare(page, name, "檢定 聽力");
  // S3:檢定頁 RSL 0/3/8、Trinity 0/4/8 × 技巧/視奏/聽力
  for (const [sys, g] of [["rsl", 0], ["rsl", 3], ["rsl", 8], ["trinity", 0], ["trinity", 4], ["trinity", 8]]) {
    await page.evaluate(([s, g]) => window.__shell.setExam(s, g), [sys, g]); await page.waitForTimeout(250);
    for (const p of ["tech", "sight", "ear"]) { await sub(p); await compare(page, name, `檢定 ${sys} ${g} ${p}`); }
  }
  // 從清單點練習:技巧分頁的目標橫幅
  await page.evaluate(() => window.__shell.setExam("rsl", 3)); await sub("tech");
  await page.click('#t-qGroups button.xitem[data-act="pas"]'); await page.waitForTimeout(700);
  await compare(page, name, "技巧 目標橫幅");
  await page.click("#t-targetClose"); await page.waitForTimeout(200);
  // S4:依大綱時值的練習型(最長的 8 級 A 組三十二分十連音、4 級 C 組推估的 Flam tap)
  for (const [g, key] of [[8, "rsl-8-A-10"], [4, "rsl-4-C-1"]]) {
    await page.evaluate(g => { window.__shell.setExam("rsl", g); window.__shell.showView("exam", "tech"); }, g); await page.waitForTimeout(300);
    await page.click(`#t-qGroups button.xitem[data-key="${key}"]`); await page.waitForTimeout(900);
    await compare(page, name, "技巧 練習型 " + key);
    await page.click("#t-targetClose"); await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.__shell.showView("exam", "tech")); await page.waitForTimeout(200);
  await tab("tech");
  for (const c of ["roll", "diddle", "flam", "drag"]) { await sub(c); await expand("#t-picker"); await compare(page, name, "技巧 " + c); }
  await tab("sight"); await compare(page, name, "視奏"); await tab("ear"); await compare(page, name, "聽力");
  // 40 個打法的題目與標籤:中英文行數一樣
  await tab("tech");
  const diff = await page.evaluate(async () => {
    const { setLang } = await import("./js/shared/i18n.js"), out = [];
    const T = document.getElementById("t-qTitle"), G = document.getElementById("t-qTags");
    for (let no = 1; no <= 40; no++) {
      setLang("zh"); window.__tech.setRudiment(no); const a = [T.textContent, T.offsetHeight, G.offsetHeight];
      setLang("en"); window.__tech.setRudiment(no); const b = [T.textContent, T.offsetHeight, G.offsetHeight];
      if (a[1] !== b[1] || a[2] !== b[2]) out.push(`題目 ${a[1]}/${a[2]}→${b[1]}/${b[2]}「${a[0]}」/「${b[0]}」`);
    }
    setLang("zh");
    return out;
  });
  // @app-end
  for (const d of [...new Set(diff)]) { issues.push(`${name} ${d}`); bad++; }
  for (const e of errors) { issues.push(`${name} console: ${e}`); bad++; }
  await close();
}
console.log(issues.join("\n"));
console.log(bad ? `✗ ${bad} 處中英版面不同` : `✓ ${VPS.length} 種尺寸中英版面一致`);
process.exit(bad ? 1 : 0);
