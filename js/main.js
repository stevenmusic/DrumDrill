/* 外框(PianoDrill / DrumDrill 共用,`@app-begin … @app-end` 以外兩邊一模一樣,tools/test/sync.mjs 檢查):
   頂欄、子項目分段鈕、底部分頁、共用的考試設定(系統 + 級數設一次,三個模組都照這一級)、主題、語言、第一次打開的問題。
   三個模組(js/tech、js/sight、js/ear)各自負責自己的卡片;外框只告訴它們「現在顯示哪一頁、考哪一級、語言換了」。
   每個模組匯出同一組函式:start(ctx)、enter(tab)、leave()、setExam(exam)、relang()、examStatus()、onKey(e)
   - ctx = { exam, examChanged(), gradeLabel(g, sys), showView(view, sub) } + 各 App 自己的(@app 區段的 appCtx(),
     例如 DrumDrill 的 examData(sys));模組不能 import 這個檔案。appCtx 最多等 APP_CTX_MS(4 秒):逾時先不給
     (模組要能處理 ctx 裡還沒有這些欄位),之後載好再補進同一個 ctx,通知每個模組重畫(onCtx(),沒有就 relang());
     不呼叫 setExam:考試沒變,不能把進行中的題目、模擬考洗掉
   - leave() 停止播放與計時(題目保留);enter(tab) 有題目就不重新出題
   - 切到背景(visibilitychange / pagehide)或聲音被系統打斷:目前的模組 leave() + 全部停止;回到前景再 enter() */
import { tr, T, applyStatic, setLang, getLang, onLang } from "./shared/i18n.js";
import * as audio from "./shared/audio.js";
import * as tech from "./tech/app.js";
import * as sight from "./sight/app.js";
import * as ear from "./ear/app.js";

const $ = id => document.getElementById(id);
const MODS = { tech, sight, ear };

// @app-begin
/* ── 外框的設定(localStorage;讀不到就用預設值)── */
const KEY = "drumdrill.v1";
const S = (() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  saved = saved || {};
  if (saved.exam && !["trinity", "rsl"].includes(saved.exam.system)) saved.exam = null;
  return { view: "tech", exam: null, onboarded: false, theme: "dark", ...saved,
    sub: { tech: "roll", exam: "tech", ...(saved.sub || {}) } };
})();
/* ── 考試:Trinity Rock & Pop Drums(Initial、1–8 級)、RSL Rockschool Drums(Debut、1–8 級) ── */
const SYSTEMS = { trinity: "Trinity", rsl: "RSL" };
const DEFAULT_EXAM = { system: "trinity", grade: 1 };   // 第一次打開的問題、沒選考試時檢定分頁暫時看的
const examSystem = () => (S.exam ? S.exam.system : autoExam.system);
export const gradeLabel = (g, sys = examSystem()) => g === 0 ? (sys === "rsl" ? tr("入門(Debut)", "Debut") : tr("初級", "Initial")) : tr(g + " 級", "Grade " + g);
/* 子項目分段鈕;檢定分頁三項的名稱 */
const SUBS = {
  // 技巧:PAS 40 個基本打法的四大類
  tech: () => [["roll", tr("滾奏", "Rolls")], ["diddle", tr("複點", "Diddles")], ["flam", "Flam"], ["drag", "Drag"]],
  sight: () => [],
  ear: () => [],
  exam: () => [["tech", tr("技巧", "Technique")], ["sight", tr("視奏", "Sight-reading")], ["ear", tr("聽力", "Aural")]]
};
const PART_LABEL = () => ({ tech: tr("技巧", "Technique"), sight: tr("視奏", "Sight-reading"), ear: tr("聽力", "Aural") });
/* 考試資料(data/exam-rsl.json、data/exam-trinity.json、data/drumkey.json;js/shared/examdata.js):一打開就一起讀(跟模組載入同時進行),
   經 ctx.examData(sys)、ctx.drumKey() 給模組;讀不到是 null(模組照「資料還沒載好」顯示;逾時見共用區段的 APP_CTX_MS) */
import { loadExam, loadDrumKey } from "./shared/examdata.js";
const examLoading = Promise.all(Object.keys(SYSTEMS).map(sys => loadExam(sys).then(d => [sys, d])));
const keyLoading = loadDrumKey();   // 鼓件名稱(檢定頁的規格卡用)
const appCtx = async () => {
  const data = Object.fromEntries(await examLoading), key = await keyLoading;
  return { examData: sys => data[sys] || null, drumKey: () => key || null };
};
// @app-end
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const APP_CTX_MS = 4000;   // appCtx(App 自己的資料)最多等多久才先啟動模組
let autoExam = { ...DEFAULT_EXAM };   // 沒選考試時,檢定分頁暫時看的系統/級數
const examNow = () => S.exam ? { ...S.exam, auto: false } : { ...autoExam, auto: true };

/* ── 主題 ── */
function applyTheme(){
  const light = S.theme === "light";
  document.documentElement.classList.toggle("light", light);
  document.body.classList.toggle("light", light);
  $("themeToggle").setAttribute("aria-pressed", String(light));
  document.querySelector('meta[name="theme-color"]').content = light ? "#FBF7EE" : "#0C0A07";
}
$("themeToggle").onclick = () => { S.theme = S.theme === "light" ? "dark" : "light"; save(); applyTheme(); };
applyTheme();
applyStatic();
$("langToggle").onclick = () => setLang(getLang() === "zh" ? "en" : "zh");
onLang(() => {
  renderSubnav(); renderExamCard();
  if (!$("onboard").hidden) fillGrades($("obGrade"), Number($("obGrade").value), ob.system);
  for (const m of Object.values(MODS)) m.relang();
});

/* ── 分段鈕 ── */
function segBind(el, get, set){
  const seg = typeof el === "string" ? $(el) : el;
  const sync = () => seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === String(get()))));
  seg.onclick = e => { const b = e.target.closest("button"); if (!b || b.disabled) return; set(b.dataset.v); sync(); };
  sync();
  return sync;
}
/* 手機:設定卡收成一行,點了展開(每個模組的設定卡都一樣,在這裡統一處理) */
document.addEventListener("click", e => {
  const btn = e.target.closest(".setup-summary"); if (!btn) return;
  const card = btn.closest(".card"), open = !card.classList.contains("open");
  card.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open));
});

/* ══ 分頁 ══ */
let curMod = null;
function renderSubnav(){
  const opts = SUBS[S.view]();
  $("subnav").hidden = !opts.length;
  document.body.classList.toggle("no-subnav", !opts.length);
  // 視奏的子項目是級數:按鈕上只有數字,aria-label 寫完整級名
  $("subSeg").innerHTML = opts.map(([v, t]) => `<button data-v="${v}" aria-pressed="${S.sub[S.view] === v}"${S.view === "sight" ? ` aria-label="${gradeLabel(Number(v))}"` : ""}>${t}</button>`).join("");
  $("subSeg").setAttribute("aria-label", S.view === "sight" ? tr("級數", "Grade") : "");
}
$("subSeg").onclick = e => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  if (S.sub[S.view] === b.dataset.v) return;
  S.sub[S.view] = b.dataset.v; save();
  showView(S.view);
};
/* 目前分頁的模組與它的子項目(檢定分頁:模組 = 檢定的子項目,tab = "exam") */
const modOf = view => (view === "exam" ? S.sub.exam : view);
const tabOf = view => (view === "exam" ? "exam" : S.sub[view] || "");
/* 切到某一頁;sub = 同時切到那一頁的某個子項目(模組要帶使用者去別的地方練時用,例如檢定清單 → 技巧的某一類) */
function showView(view, sub){
  if (sub != null) S.sub[view] = String(sub);
  S.view = view; save();
  document.querySelectorAll("#tabbar button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  const exam = view === "exam";
  const modName = modOf(view);
  const tab = tabOf(view);
  $("examSetup").hidden = !exam;
  if (curMod && curMod !== modName) MODS[curMod].leave();
  for (const [name, m] of Object.entries(MODS)) $("mod-" + name).hidden = name !== modName;
  curMod = modName;
  document.body.classList.toggle("view-exam", exam);
  document.body.classList.toggle("view-sight", modName === "sight");
  renderSubnav();
  if (exam) renderExamCard();
  window.scrollTo({ top: 0 });
  MODS[modName].enter(tab);
}
$("tabbar").onclick = e => { const b = e.target.closest("button[data-view]"); if (b) showView(b.dataset.view); };
$("examChip").onclick = () => showView("exam");

/* ══ 考試設定卡 ══ */
function fillGrades(sel, grade, sys){
  sel.innerHTML = GRADES.map(g => `<option value="${g}">${gradeLabel(g, sys)}</option>`).join("");
  sel.value = String(GRADES.includes(grade) ? grade : 1);
}
function setExam(system, grade){
  S.exam = { system, grade }; save();
  pushExam();
}
function pushExam(){
  const ex = examNow();
  for (const m of Object.values(MODS)) m.setExam(ex);
  renderExamCard(); renderChip();
}
const syncSystemSeg = segBind("systemSeg", () => examNow().system, v => setExam(v, examNow().grade));
$("selGrade").onchange = () => setExam(examNow().system, Number($("selGrade").value));
function renderChip(){
  $("examChip").hidden = !S.exam;
  if (S.exam) $("examChip").textContent = `${SYSTEMS[S.exam.system]} ${gradeLabel(S.exam.grade)}`;
}
function renderExamCard(){
  const ex = examNow();
  syncSystemSeg(); fillGrades($("selGrade"), ex.grade, ex.system);
  $("examSum").textContent = S.exam ? `${SYSTEMS[ex.system]} · ${gradeLabel(ex.grade)}` : tr("還沒選考試 · 點這裡選考試和級數", "No exam chosen · tap to pick one");
  // 三個項目的進度(各模組自己算),點一下切到那一項
  $("examParts").innerHTML = Object.keys(MODS).map(name => {
    const st = MODS[name].examStatus() || "";
    const label = PART_LABEL()[name];
    return `<button class="part" data-part="${name}" aria-pressed="${S.view === "exam" && S.sub.exam === name}"><b>${label}</b><small>${st}</small></button>`;
  }).join("");
}
$("examParts").onclick = e => {
  const b = e.target.closest("[data-part]"); if (!b) return;
  S.sub.exam = b.dataset.part; save(); showView("exam");
};
/* 模組裡的進度改變了(標記通過、答題):重畫進度 */
export function examChanged(){ if (S.view === "exam") renderExamCard(); }

/* ══ 第一次打開:在準備考試嗎? ══ */
const ob = { ...DEFAULT_EXAM };
function showOnboard(){
  const syncSys = segBind("obSystem", () => ob.system, v => { ob.system = v; fillGrades($("obGrade"), Number($("obGrade").value), v); });
  fillGrades($("obGrade"), ob.grade, ob.system); syncSys();
  $("obGrade").onchange = () => ob.grade = Number($("obGrade").value);
  $("onboard").hidden = false;
  $("obYes").onclick = () => {
    S.onboarded = true; $("onboard").hidden = true;
    setExam(ob.system, Number($("obGrade").value)); showView("exam");
  };
  $("obNo").onclick = () => { S.exam = null; S.onboarded = true; save(); $("onboard").hidden = true; pushExam(); showView("tech"); };
}

/* ══ 全部模組共用的觸控、音訊、螢幕 ══ */
/* 禁止連點放大(iOS 有時不理 touch-action / user-scalable):300ms 內的第二下取消預設動作,自己補一次 click(鍵盤、節拍鍵用 pointerdown,不受影響) */
let lastTouchEnd = 0;
document.addEventListener("touchend", e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300) { e.preventDefault(); const t = e.target.closest("button:not(.tap-pad), .opt, .chip, [role=tab]"); if (t && !t.disabled) t.click(); }
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault());
/* 每一次真的點擊都喚醒音訊(上面補的 click 不算使用者手勢,iOS 不准它打開聲音;被來電、鎖屏打斷的也在這裡叫回來) */
for (const ev of ["touchend", "click", "keydown", "pointerdown"]) document.addEventListener(ev, () => audio.unlockAudio(), { capture: true, passive: true });
/* 練習時螢幕不要暗掉(手機放在譜架上):App 在前景時一直保持亮著 */
let wakeLock = null;
async function keepAwake(){
  try { if ("wakeLock" in navigator && document.visibilityState === "visible" && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {}
}
document.addEventListener("visibilitychange", keepAwake);
document.addEventListener("pointerdown", keepAwake, { once: true });
/* 切到背景(換 App、鎖屏、關分頁):目前的模組停止播放與計時、全部的聲音停掉;回到前景再進來(題目保留,不會自己開始播) */
let inBackground = false;
function toBackground(){
  if (inBackground) return;
  inBackground = true;
  if (curMod) MODS[curMod].leave();
  audio.stopAll();
}
function reenter(){
  if (!curMod) return;
  const y = window.scrollY;
  MODS[curMod].enter(tabOf(S.view));
  window.scrollTo(0, y);   // 回到原本看的位置(enter 有的會捲回頂端)
}
function toForeground(){
  if (!inBackground) return;
  inBackground = false;
  reenter();
}
document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? toBackground() : toForeground()));
window.addEventListener("pagehide", toBackground);
window.addEventListener("pageshow", () => { if (document.visibilityState !== "hidden") toForeground(); });
/* 聲音被系統打斷(來電、Siri;AudioContext 變成 interrupted / suspended)但畫面還在前景:同樣停掉,按鈕回到「播放」 */
audio.onInterrupt(() => {
  if (inBackground || !curMod) return;
  MODS[curMod].leave(); audio.stopAll(); reenter();
});
/* 桌機快捷鍵交給目前的模組 */
document.addEventListener("keydown", e => {
  if (!$("onboard").hidden || e.target.closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (curMod) MODS[curMod].onKey(e);
});

/* ── 啟動 ── */
async function init(){
  fillGrades($("selGrade"), examNow().grade);
  // 各模組讀自己的資料;一個失敗不影響其他兩個
  // App 自己的資料(@app 區段的 appCtx;讀不到不影響啟動)。網路慢、離線又沒快取時最多等 4 秒,不擋住模組啟動:
  // 逾時(null)先用沒有這些欄位的 ctx 啟動,之後載好再補進同一個 ctx(模組拿的是同一個物件),只通知模組重畫
  // (onCtx(),沒有就 relang():只重寫畫面;不走 setExam / pushExam,考試沒變,進行中的題目與模擬考要保留)
  const ctx = { exam: examNow(), examChanged, gradeLabel, showView };
  const extraJob = appCtx().catch(e => (console.error("appCtx", e), {}));
  const extra = await Promise.race([extraJob, new Promise(r => setTimeout(() => r(null), APP_CTX_MS))]);
  if (extra) Object.assign(ctx, extra);
  else extraJob.then(x => {
    Object.assign(ctx, x);
    for (const [name, m] of Object.entries(MODS)) { try { (m.onCtx || m.relang)(); } catch (e) { console.error(name, e); } }
    renderExamCard();
  });
  await Promise.all(Object.entries(MODS).map(([name, m]) => m.start(ctx).catch(e => console.error(name, e))));
  renderChip(); renderExamCard();
  window.__shell = { S, showView, setExam, MODS };
  if (!S.onboarded) { showView("tech"); showOnboard(); }
  else showView(S.view || (S.exam ? "exam" : "tech"));
  window.__stageReady = 1;
}
/* 離線使用:註冊 Service Worker(sw.js);本機開發(localhost)也註冊,方便測試 */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
init().catch(e => console.error(e));
