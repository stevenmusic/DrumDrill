/* 技巧模組:PAS 40 個基本打法(分頁:滾奏 / 複點 / Flam / Drag),練習面板(題目、鼓譜、速度)照 PianoDrill 的技巧分頁。
   外框(js/main.js)負責頂欄、分頁、考試系統與級數;這裡的元素 id 都加 "t-" 前綴 */
import * as store from "./store.js";
import { RUDIMENTS, CATEGORIES, byNo, withLead, strokes, cycleLength, DIV, pattern } from "./rudiments.js";
import { rudimentXML } from "./notation.js";
import { tr, T as TS, scoped, getLang, pairText, unpair } from "../shared/i18n.js";
import { techItems, techPasNos } from "../shared/examdata.js";
import { L, srcOf, assumed, fillSpec, para, valueName, bandsText, summaryRows, notInApp, dataRow, pairStack } from "../shared/examview.js";
import * as audio from "../shared/audio.js";
import { createScore } from "../shared/score.js";
import { announce } from "../shared/a11y.js";
import { createTempo } from "../shared/tempo.js";
import { fitLandZoom, createLandPlay } from "../shared/landscape.js";
import { addLog, renderLog as paintLog, today, nextGoal, cleanGoal } from "../shared/practicelog.js";
import { createMock, abortText, paintCard, resultNote, mockLabel, cardToTop } from "../shared/mock.js";
import { createDaily, clickPlays, dayNum } from "../shared/daily.js";
import { createDailyCard } from "../shared/dailycard.js";
import { ROUTES, WARM } from "./routes.js";
import { createRouteView } from "./route.js";
import { toSpec, valueTag } from "./routespec.js";
import "./strings.js";
const T = scoped("tech");

const $ = id => document.getElementById("t-" + id);
const ROOT = document.getElementById("mod-tech");
let active = false, ctx = null, exam = null;
const S = store.load();
let tab = S.cat;            // roll / diddle / flam / drag / exam
let cur = null, groups = null;
let bpm = 60;
/* 從檢定清單點「練習」的目標:{ system, grade, group, no, bpm, p, key, pattern?, assumed? }。目標速度只放在 bpm,不寫進 S.bpm(× 離開就回到自己的速度);
   pattern = { pas, sticking, value }:RSL 的「依大綱時值」練習型(rudiments.js pattern();no = 那個 PAS 編號,熟練度記在 PAS 編號上);
   換到別的打法(選擇器、別的類別)自動離開 */
let target = null, lastKey = null;
let dseg = null;   // 今日練習目前顯示的段落(下面「今日練習」一段)
let rv = null;     // 今日練習的路線段(js/tech/route.js;下面「今日練習」一段建立)
/* 模擬考(下面「模擬考」一段):中止時停止播放、速度還原,在檢定頁就重畫(說明「模擬考已中止」) */
const mock = createMock({ store: S, save: store.save, onAbort: () => { stopPlayback(); mockRestore(); if (tab === "exam") { renderExam(); if (active) cardToTop($("mockCard")); } } });
let mockSaved = null;   // 開始模擬考前的速度(結束後還原;目標模式的速度也不受影響)

/* ══ 外框呼叫 ══ */
/* 換語言:只重寫文字(不停止播放、不重畫鼓譜) */
export function relang(){ relabel(); }
/* 外框改了考試(系統、級數):沒變就不重設(外框重送同一個考試、晚到的資料不能把畫面洗掉) */
export function setExam(ex){
  const same = exam && ex && exam.system === ex.system && exam.grade === ex.grade && !!exam.auto === !!ex.auto;
  const moved = !exam || !ex || exam.system !== ex.system || exam.grade !== ex.grade;
  exam = ex;
  // 系統或級數換了:進行中的模擬考中止(結果、中止的說明收起來);之前那一級的目標(官方速度、組別)已經不適用 → 離開目標模式(速度回到自己的設定)
  if (moved) { if (!mock.abort("exam") && mock.state === "result") mock.close(); }
  if (moved && target && !target.daily) leaveTarget();
  if (!same && active && tab === "exam") renderExam();
  if (moved) replanWarm();   // 今日練習:還沒開始的暖身換成這一級的項目
}
/* 外框的 appCtx(考試資料)晚到:只重畫用得到資料的地方 */
export function onCtx(){ if (tab === "exam") renderExam(); if (ctx) ctx.examChanged(); replanWarm(); }
/* 進來:同一類、已經有題目就照原樣(回到前景、從別的分頁回來不會重新出題);換了類別或檢定頁才重畫 */
export function enter(t){
  active = true;
  audio.holdKit("tech"); rv.active = true;   // 今日練習的路線段用整組鼓(跟視奏、聽力共用一份;離開 60 秒沒人拿才釋放)
  // 今日練習的段落:點了子項目(外框把分段鈕亮回來)或到檢定頁 = 暫停,回到一般的打法畫面(卡片寫「繼續今天的練習」)
  if (dseg && (t === "exam" || (ctx && ctx.subActive && ctx.subActive("tech")))) { dExit(); if (t !== "exam") { switchTab(t); requestAnimationFrame(onStageResize); return; } }
  // 模擬考進行中:離開檢定頁(到技巧分頁)= 中止;還在檢定頁(再點一次同一項)只重畫,不停止
  if (mock.running() && t !== "exam") mock.abort("leave");
  if (mock.running() && t === "exam" && tab === "exam") { renderExam(); requestAnimationFrame(onStageResize); return; }
  if (t !== tab || t === "exam" || !cur) switchTab(t);
  requestAnimationFrame(onStageResize);
}
/* 離開(切分頁、切到背景):停止播放,題目保留;模擬考進行中就中止(回來時說明) */
export function leave(){ active = false; mock.abort("leave"); stopPlayback(); rv.active = false; audio.dropKit("tech"); }
/* 檢定分頁的進度:RSL = 本級用到的 PAS 編號已經會了幾個(pattern 也算在它的 PAS 編號上);Trinity 沒有技巧項目 = 在 Song 3 評 */
export function examStatus(){
  const ex = curExam(), d = dataOf(ex.system);
  if (ex.system === "trinity") return tr("在 Song 3 評", "Assessed in Song 3");
  const nos = d ? techPasNos(ex.grade, d) : RUDIMENTS.map(r => r.no);
  const n = nos.filter(no => S.mastery[no] === "good").length;
  return tr(`會了 ${n}/${nos.length}`, `Got it ${n}/${nos.length}`);
}
export function onKey(e){
  if (tab === "exam" && mock.running()) {   // 模擬考:空白鍵 = 開始 / 停止、N = 下一組
    if (e.code === "Space") { e.preventDefault(); if (cur) $("playBtn").click(); }
    else if (e.key === "n" || e.key === "N") $("mockNext").click();
    return;
  }
  if (tab === "exam") {   // 檢定頁沒有播放鈕:N = 下一項
    if ((e.key === "n" || e.key === "N") && !$("nextBtn").hidden && !$("nextBtn").disabled) $("nextBtn").click();
    return;
  }
  if (routeOn()) {   // 今日練習的路線段:鼓墊模式 F / J / K = 鼓墊、空白鍵 = 打一遍 / 停止;在鼓上打 = ▶ 示範
    if (rv.key(e)) return;
    if (e.code === "Space") { e.preventDefault(); if (rv.pad && !$("rPerform").hidden) $("rPerform").click(); else $("playBtn").click(); return; }
  }
  if (e.code === "Space") { e.preventDefault(); $("playBtn").click(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setBpm(bpm + 1, true); }
  else if (e.key === "ArrowDown") { e.preventDefault(); setBpm(bpm - 1, true); }
}

const name = r => tr(r.zh, r.en);
const catOf = id => CATEGORIES.find(c => c.id === id);
const subOf = r => catOf(r.cat).sub.find(s => r.no >= s.from && r.no <= s.to);

/* 換語言時重寫的文字:選擇器、題目、標籤、速度單位、按鈕、紀錄卡;在檢定頁時重畫檢定說明 */
function relabel(){
  syncTarget();
  dcard.relang(dseg);
  rv.relang();
  if (tab === "exam") renderExam();
  else if (cur || routeOn()) {
    if (cur) renderPicker();
    renderTitle();
    if (active) fitTitle();
  }
  syncTempoUI(); showBest();
  $("playLabel").textContent = play ? T("stop") : starting ? tr("準備中…", "Preparing…") : playText();
  remsg();
  renderLog();
}
/* 暫時訊息(載入中、載入失敗、繪製失敗):記住產生文字的函式,換語言時重寫 */
const msgs = {};
function setMsg(id, fn){ msgs[id] = fn || null; $(id).textContent = fn ? fn() : ""; }
function remsg(){ for (const id in msgs) if (msgs[id]) $(id).textContent = msgs[id](); }
function switchTab(t){
  stopPlayback();
  tab = t;
  const isExam = t === "exam";
  ROOT.classList.toggle("exam-view", isExam);
  // 檢定頁:考試摘要 + 本級要求(練習的卡片、練習紀錄都藏起來:練習回饋不跟等第放在同一個畫面)
  ROOT.querySelectorAll(".pane").forEach(el => { el.hidden = !isExam; });
  $("picker").hidden = isExam;
  for (const id of ["quizCard", "scoreCard", "metroCard", "logCard"]) $(id).hidden = isExam;
  $("dailyCard").hidden = isExam; if (!isExam) dcard.render();
  $("mockFoot").hidden = $("mockMsg").hidden = true;
  syncTarget();
  if (isExam) { renderExam(); return; }
  $("mockCard").hidden = true;
  S.cat = t; store.save();
  const list = RUDIMENTS.filter(r => r.cat === t);
  // 滾奏第一次進來 = 初學的「單擊 四分音符」練習型(不是 #1 原譜的三十二分音符;原譜在選單裡照舊)
  if (t === "roll" && (S.pick.roll == null || BEGIN[S.pick.roll])) { freePat = BEGIN[S.pick.roll || "s4"]; setRudiment(1); return; }
  freePat = null;
  const no = S.pick[t] && list.some(r => r.no === S.pick[t]) ? S.pick[t] : list[0].no;
  setRudiment(no);
}
/* 初學的練習型(自由練習的滾奏分頁最前面兩格;rudiments.js 的 pattern(),PAS #1 的 RL 交替 + 四分 / 八分音符;熟練度、速度記在 #1) */
const BEGIN = { s4: { pas: 1, sticking: "single", value: "4" }, s8: { pas: 1, sticking: "single", value: "8" } };
let freePat = null;
const curPattern = () => (target && target.pattern) || (!target ? freePat : null);

/* ══ 選擇器:這一類的打法(號碼 + 名稱)、起手、反覆次數 ══ */
function renderPicker(){
  const list = RUDIMENTS.filter(r => r.cat === tab);
  const rows = [
    ["no", T("lblRud"), (tab === "roll" ? [["s4", `<b>♩</b><span>${tr("單擊 四分音符", "Singles, quarters")}</span>`], ["s8", `<b>♪</b><span>${tr("單擊 八分音符", "Singles, eighths")}</span>`]] : [])
      .concat(list.map(r => [r.no, `<b>${r.no}</b><span>${name(r)}</span>`]))],
    cur.second && ["lead", T("lblLead"), [["R", tr("右手先", "Right")], ["L", tr("左手先", "Left")]]],
    ["reps", T("lblReps"), [1, 2, 4, 8].map(n => [n, "×" + n])]
  ].filter(Boolean);
  const val = { no: freePat ? Object.keys(BEGIN).find(k => BEGIN[k] === freePat) : cur.no, lead: S.lead, reps: S.reps };
  $("picker").querySelector(".rows").innerHTML = rows.map(([k, lbl, opts]) =>
    `<div class="prow"><span class="lbl">${lbl}</span><div class="opts${k === "no" ? "" : " even"}" data-k="${k}" role="group" aria-label="${lbl}">` +
    opts.map(([v, t]) => `<button class="opt${k === "no" ? " rud" : ""}" data-v="${v}" aria-pressed="${String(v) === String(val[k])}">${t}</button>`).join("") + `</div></div>`).join("");
  // 收起來的一行只寫題目卡(標題、標籤)沒有的:這張卡是選打法的 + 反覆次數(打法名稱、左右手先已經在題目卡上)
  $("picker").querySelector(".sum").textContent = [tr("選打法", "Choose"), T("lblReps") + " ×" + S.reps].join(" · ");
}
$("picker").querySelector(".rows").onclick = e => {
  const b = e.target.closest(".opt"); if (!b) return;
  const k = b.closest(".opts").dataset.k, v = b.dataset.v;
  if (k === "no" && BEGIN[v]) { S.pick[tab] = v; store.save(); freePat = BEGIN[v]; setRudiment(1); return; }
  if (k === "no") { S.pick[tab] = Number(v); store.save(); freePat = null; setRudiment(Number(v)); return; }
  if (k === "lead") S.lead = v;
  if (k === "reps") S.reps = Number(v);
  store.save();
  setRudiment(cur.no);
};

/* ══ 題目 ══ */
function setRudiment(no){
  stopPlayback();
  if (target && target.no !== no) { target = null; syncTarget(); }   // 換到別的打法:離開檢定目標
  cur = byNo(no);
  // 練習型:PAS 的左右手、重音、裝飾音 + 大綱的時值(不是官方譜);否則照 PAS 原譜
  groups = curPattern() ? pattern({ ...curPattern(), lead: S.lead }) : withLead(cur, S.lead);
  renderPicker();
  renderTitle();
  showBest();
  if (active) fitTitle();   // 看不到時不量(寬度是 0);回到畫面時 enter → onStageResize 會再量
  $("playBtn").disabled = false;
  syncMastery();
  // 檢定目標:官方速度只在剛設定目標時套用一次(不寫進 S.bpm);之後改反覆次數、左右手(又走一次 setRudiment)保留使用者調過的速度
  if (!target) bpm = S.bpm[cur.no] || 60;
  else if (!target.bpmSet) { target.bpmSet = true; if (target.bpm) bpm = target.bpm; }
  syncTempoUI();
  renderScore();
  preloadSamples();
}

function renderTitle(){
  if (!play && !starting) $("playLabel").textContent = playText();
  if (mockOn()) { renderMockTitle(); return; }
  if (dseg && target && target.daily) {   // 今日練習:標題 = 關卡(或暖身)的名稱,標籤 = 路線第幾關、速度 → 目標
    const nm = dseg.k === "warm" ? warmName(dseg.item) : dseg.level.name;
    $("qTitle").textContent = Array.isArray(nm) ? tr(nm[0], nm[1]) : nm;
    paintTags();   // 標籤的速度 = 現在實際的速度(自己改了速度也跟著變)
    renderIntro(); return;
  }
  const pt = curPattern();
  $("qTitle").textContent = pt ? patternName(pt) : `${cur.no}. ${name(cur)}`;
  // 中英文標籤數量一樣(版面才會一樣):中文 = 英文名,英文 = PAS 編號;左手先/右手先另加一個;練習型再加「App 練習型」(完整說明在目標橫幅)與「推估」(時值是推估的)。
  // 類別不放(上面分段鈕已經看得到,放了標籤列會擠不下)。英文名太長時縮成「…」;示範最快的速度放在速度卡
  // 英文原名跟中文名一樣(Flam、Drag…):標題已經寫了,第一個標籤兩種語言都不放(標籤數量一樣)
  const tags = [cur.en === cur.zh ? null : getLang() === "en" ? "PAS No. " + cur.no : cur.en,
    cur.second ? (S.lead === "L" ? tr("左手先", "Left lead") : tr("右手先", "Right lead")) : null,
    pt ? tr("App 練習型", "App drill") : null,
    pt && target && target.assumed ? TS("srcAssumed") : null].filter(Boolean);   // 時值是推估的(4 級 C 組 Flam tap 的四分音符)
  const fold = cur.en !== cur.zh;   // 第一個標籤(英文名)太長時縮成「…」
  $("qTags").innerHTML = tags.map((t, i) => `<span class="q-tag${i || !fold ? "" : " fold"}" title="${t}">${t}</span>`).join("");
  renderIntro();
}
/* 這一類在練什麼(題目卡標籤下一行):Flam、Drag、複點是鼓手通用的名稱(老師、教材都這樣叫,保留),但初學者看不懂 → 一直顯示一句白話說明(使用者要求);
   模擬考、檢定頁、今日練習的段落不顯示 */
const INTRO = {
  roll: ["滾奏:兩手交替,連續打出密集的聲音", "Rolls: hand to hand, close together"],
  diddle: ["複點:單擊和雙擊混在一起,例如 RLRR LRLL", "Diddles: singles and doubles mixed, e.g. RLRR LRLL"],
  flam: ["Flam:主音前面先輕打一個小音符,兩下幾乎同時", "Flam: one soft grace note just before the main stroke"],
  drag: ["Drag:主音前面先輕打兩個小音符,再打主音", "Drag: two soft grace notes, then the main stroke"]
};
function renderIntro(){
  const txt = tab !== "exam" && !mockOn() && !dseg ? INTRO[tab] : null;
  $("intro").hidden = !txt;
  if (txt) pairText($("intro"), () => tr(txt[0], txt[1])); else unpair($("intro"));
}

/* ══ 已經會了 / 待加強(只是標記,不算一次練習)══ */
function syncMastery(){
  const m = cur && S.mastery[cur.no];
  ROOT.querySelector(".mastery").hidden = mockOn() || !!dseg;   // 模擬考進行中不標熟練度(只管打);今日練習每一段(含暖身)都不標(段落用「穩了 / 還要練」)
  ROOT.querySelectorAll(".mbtn").forEach(b => { b.disabled = !cur; b.setAttribute("aria-pressed", String(b.dataset.m === m)); });
}
ROOT.querySelectorAll(".mbtn").forEach(b => b.onclick = () => {
  if (!cur) return;
  const m = b.dataset.m;
  if (S.mastery[cur.no] === m) delete S.mastery[cur.no]; else S.mastery[cur.no] = m;
  store.save(); syncMastery();
  if (ctx) ctx.examChanged();   // 檢定分頁「已會 n/m」
});

/* ══ 檢定分頁(照 PianoDrill 的 t-paneExam:考試摘要 + 本級要求 + 抽一項 / 下一項)══
   資料:data/exam-rsl.json、exam-trinity.json(外框經 ctx.examData 給;還沒載好是 null)。只列官方大綱寫的,不自己編:
   - RSL:每組一列(組別、名稱、♩、頁碼、已會狀態)。
       pas = PAS 原譜 → 「練習」跳到技巧分頁那個打法,速度設成官方 ♩(目標模式,#t-target);
       pattern = PAS 左右手 + 大綱時值 → 「依大綱時值練習」:技巧分頁用 rudiments.js pattern() 排的練習型(標「不是官方譜」),速度也設成官方 ♩;
       book = 譜只在官方檢定書 → 只列名稱 + 相關 PAS 打法
   - Trinity:Rock & Pop 沒有獨立的技巧項目(在 Song 3 評)→ 說明 + 這一級自選曲參數表的 Techniques + 類別按鈕(官方只寫類別) */
const curExam = () => exam || { system: "trinity", grade: 1 };
const dataOf = sys => (ctx && ctx.examData ? ctx.examData(sys) : null);
const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const ICON = {
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16l13-8z"/></svg>',
  book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
  go: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
};
const markOf = no => S.mastery[no] || "";

function renderExam(){
  const ex = curExam(), sys = ex.system, g = ex.grade, d = dataOf(sys);
  // 模擬考進行中、結果、中止的說明:考試摘要(配分、等第)與本級要求藏起來(練習回饋不跟等第放在同一個畫面)
  const ms = mock.state, run = ms === "run", only = ms === "result" || ms === "aborted";
  $("paneExam").hidden = $("listCard").hidden = run || only;
  $("quizCard").hidden = $("scoreCard").hidden = $("mockFoot").hidden = $("mockMsg").hidden = !run;
  if (run && !(mockStep() && mockStep().it)) $("scoreCard").hidden = true;   // 用檢定書練的組:沒有譜
  renderMockCard(d, g);
  if (run) { renderMockStep(); return; }
  renderSummary(sys, g, d);
  $("drawBtn").hidden = $("nextBtn").hidden = true; $("listActions").hidden = true;
  $("progress").hidden = true;
  $("listEmpty").hidden = true;
  $("qGroups").innerHTML = "";
  delete $("listRule").dataset.src;
  if (!d) {
    $("listSub").textContent = "";
    para($("listRule"), () => tr("考試資料還沒載好(第一次要連網路,之後會存在裝置上)。", "Exam data isn't loaded yet (needs internet once; then it's cached)."));
    return;
  }
  if (sys === "rsl") renderRsl(d, g); else renderTrinity(d, g);
}

/* ── 考試摘要(手機收成一行):這一項的配分與等第、整場門檻、考試時間、本 App 不提供的、資料版本;最後一行固定是 practiceOnly ── */
function renderSummary(sys, g, d){
  $("sumSub").textContent = `${sys === "rsl" ? "RSL" : "Trinity"} · ${ctx.gradeLabel(g, sys)}`;
  pairText($("sumNote"), () => TS("practiceOnly"));
  if (!d) { fillSpec($("sumSpec"), []); $("examSummary").textContent = TS("sumTitle"); return; }
  const rows = [];
  if (sys === "rsl") {
    const it = d.marks.gradeExam.items.find(i => i.id === "tech");
    rows.push({ k: () => tr("本項配分", "This section"), v: () => tr(`技巧 ${it.max} 分:`, `Technique, ${it.max} marks: `) + bandsText(it.bands), src: srcOf(sys, d.marks.gradeExam.src.p) });
    $("examSummary").textContent = tr(`考試摘要 · 技巧 ${it.max} 分`, `Exam summary · Technique ${it.max} marks`);
  } else {
    const sp = d.marks.songParts.parts.find(p => p.id === "technical"), b = d.songBands.song3;
    rows.push({ k: () => tr("本項配分", "This section"), v: () => tr(`在 Song 3 評:Technical control(技巧控制)${sp.song3} 分(Song 3 滿分 ${b.max};Song 1、2 的 Technical control 是 ${sp.song12})`,
      `Marked in Song 3: Technical control ${sp.song3} (Song 3 out of ${b.max}; Songs 1–2: ${sp.song12})`), src: srcOf(sys, d.marks.songParts.src.p) });
    rows.push({ k: () => tr("Song 3 等第", "Song 3 bands"), v: () => bandsText(b.bands), src: srcOf(sys, d.songBands.src.p) });
    $("examSummary").textContent = tr("考試摘要", "Exam summary");   // 「在 Song 3 評」只寫在進度格與本級要求
  }
  rows.push(...summaryRows(sys, d, g));
  if (sys === "trinity") rows.push({ k: () => tr("數位考試", "Digital exam"), v: () => L(d.digitalNote.text), src: srcOf(sys, d.digitalNote.src.p) });
  rows.push(notInApp(sys, d), dataRow(d));
  fillSpec($("sumSpec"), rows);
}

/* ── RSL:每組一列 ── */
const patternName = it => {
  const st = it.sticking === "single" ? tr("單擊", "Singles") : it.sticking === "double" ? tr("雙擊", "Doubles") : `${it.pas}. ${name(byNo(it.pas))}`;
  return `${st} · ${valueName(it.value)}`;
};
const itemName = it => (it.kind === "pas" ? `${it.no}. ${name(byNo(it.no))}` : it.kind === "pattern" ? patternName(it) : L(it.label));
function renderRsl(d, g){
  const t = d.tech[g], items = techItems(g, d), nos = techPasNos(g, d);
  const good = nos.filter(no => S.mastery[no] === "good").length;
  $("listSub").textContent = tr(`會了 ${good}/${nos.length}`, `Got it ${good}/${nos.length}`);
  $("progress").hidden = false;
  $("progressBar").style.width = (nos.length ? 100 * good / nos.length : 0) + "%";
  // 開頭只說一次:名稱後面寫時值的是練習型(拍點、抽考方式寫在模擬考卡,不重複);頁碼接在後面
  const hasPattern = items.some(x => x.kind === "pattern");
  if (hasPattern) $("listRule").dataset.src = srcOf("rsl", t.src.p);
  para($("listRule"), () => (hasPattern ? tr("名稱後面寫時值的是 App 依大綱排的練習型,不是官方譜;同一個打法的練習型一起算", "Items with a note value are App drills in the syllabus values, not official parts; variants of one rudiment count together") : ""));
  // 同一段附註(「官方用小鼓和 Tom… App 只在小鼓上練左右手」)第二次出現時縮成「配置見檢定書」
  let snareNoteSeen = false;
  const noteFn = n => {
    const again = /sticking on snare/.test(n[1]) && snareNoteSeen;
    if (/sticking on snare/.test(n[1])) snareNoteSeen = true;
    return again ? () => tr("配置見檢定書", "Layout: see the grade book") : () => L(n);
  };
  let prevBpm = null, prevSrc = null;
  const box = $("qGroups");
  for (const gr of t.groups) {
    const G = el("div", "xgroup"), head = el("div", "xhead");
    // 速度、頁碼跟前一組一樣就不寫(頁碼在開頭的說明或第一組)
    const bpmTxt = gr.bpm ? "♩=" + gr.bpm : "♩ —", srcTxt = hasPattern ? "" : "p." + t.src.p;
    head.innerHTML = `<b class="xid">${gr.id}</b><span class="xname"></span>${bpmTxt !== prevBpm ? `<small class="xbpm">${bpmTxt}</small>` : ""}${srcTxt && srcTxt !== prevSrc ? `<small class="xsrc">${srcTxt}</small>` : ""}`;
    prevBpm = bpmTxt; prevSrc = srcTxt || prevSrc;
    G.appendChild(head); box.appendChild(G);
    pairText(head.querySelector(".xname"), () => L(gr.name));
    const its = el("div", "xitems"); G.appendChild(its);
    for (const it of items.filter(x => x.group === gr.id)) {
      let row;
      if (it.kind === "pas") {
        row = el("button", "xitem", { "data-key": it.key, "data-act": "pas" });
        row.innerHTML = `<i class="dot ${markOf(it.no)}"></i><span class="xi-name"></span>${ICON.play}`;
      } else if (it.kind === "pattern") {
        row = el("button", "xitem", { "data-key": it.key, "data-act": "pattern" });
        row.innerHTML = `<i class="dot ${markOf(it.pas)}"></i><span class="xi-name"></span>${ICON.play}`;
      } else {
        row = el("div", "xitem book", { "data-key": it.key });
        row.innerHTML = `${ICON.book}<span class="xi-name"></span>`;
      }
      const w = el("div", "xwrap"); its.appendChild(w); w.appendChild(row);
      pairText(row.querySelector(".xi-name"), () => itemName(it));
      if (it.kind === "pas") row.setAttribute("aria-label", tr("練習 ", "Practise ") + itemName(it));
      if (it.kind === "pattern") row.setAttribute("aria-label", tr("依大綱時值練習 ", "Practise in the syllabus values: ") + itemName(it));
      // 這一項的說明:book = 譜見官方檢定書(+ 相關 PAS 打法);項目自己的備註、推估(4 級 C 組 Flam tap 的四分音符)
      const itNote = it.note && it.note !== gr.note ? noteFn(it.note) : null;
      const note = () => [
        it.kind === "book" && !itNote ? tr("譜見官方檢定書。", "See the official grade book.") : "",
        itNote ? itNote() + tr("。", ".") : "",
        // 推估:項目自己的備註已經寫了「推估」(4 級 C 組 Flam tap)就不再重複
        it.assumed && !(it.note && it.note !== gr.note) ? TS("srcAssumed") + tr("。", ".") : "",
        it.kind === "book" && it.related.length ? tr("可以先練相關的 PAS 打法:", "Related PAS rudiments:") : ""
      ].filter(Boolean).join(" ");
      if (note()) { const p = el("p", "xi-note"); w.appendChild(p); pairText(p, note); }
      if (it.kind === "book" && it.related.length) {
        const rel = el("div", "xi-rel"); w.appendChild(rel);
        for (const no of it.related) {
          const b = el("button", "chip", { "data-act": "rel", "data-no": String(no) });
          b.innerHTML = `<i class="dot ${markOf(no)}"></i>PAS #${no}`;
          b.setAttribute("aria-label", tr(`相關 PAS 打法 ${no}. ${byNo(no).zh}`, `Related PAS ${no}. ${byNo(no).en}`));
          rel.appendChild(b);
        }
      }
    }
    // 這一組的說明:速度跟伴奏音軌(官方寫的,只是沒有數字;不標推估)、組的備註、風格練習曲的三種風格
    const grNote = gr.note ? noteFn(gr.note) : null;
    const gnote = () => [
      gr.bpmSrc === "backing" ? tr("速度:跟伴奏音軌(大綱沒寫數字)。", "Tempo: the backing track (no number given).") : "",
      grNote ? grNote() : "",
      gr.styles ? gr.styles.map(x => L(x.name) + tr(":", ": ") + L(x.focus)).join(tr(";", "; ")) : ""
    ].filter(Boolean).join(" ");
    if (gnote()) { const p = el("p", "xnote"); G.appendChild(p); pairText(p, gnote); }
  }
  // 抽一項 / 下一項:App 能直接練的項目(PAS 原譜 + 依大綱時值的練習型;book 不算)
  const pool = practiceItems();
  $("drawBtn").hidden = $("nextBtn").hidden = false; $("listActions").hidden = false;
  $("drawBtn").disabled = $("nextBtn").disabled = !pool.length;
  // 沒有可以抽的項目(這一級的項目 App 都還不能直接練):按鈕停用,並說一句為什麼
  para($("listEmpty"), () => (pool.length ? "" : tr("這一級還沒有 App 能直接練的項目,所以不能抽一項。", "Nothing in this grade can be practised in the App yet, so there is nothing to draw.")));
}
/* 從清單去練:跳到技巧分頁的那個打法、速度設成官方 ♩(目標模式)。
   順序有依賴:先設 target、S.pick[類別],再 ctx.showView("tech", 類別) → 外框呼叫 enter(類別) → (從檢定頁過來 tab 是 "exam",一定)switchTab(類別)
   → setRudiment(S.pick[類別]) = 這個打法:因為 target.no 相同,setRudiment 不會清掉目標,並在這時套用一次官方速度(target.bpmSet)。
   下面的 setRudiment 是保險(外框沒有走到 switchTab 時);syncTarget 畫目標橫幅 */
function practiceItem(it){
  const ex = curExam(), no = it.kind === "pattern" ? it.pas : it.no, r = byNo(no);
  target = { system: ex.system, grade: ex.grade, group: it.group, no, bpm: it.bpm, p: it.src.p, key: it.key,
    pattern: it.kind === "pattern" ? { pas: it.pas, sticking: it.sticking, value: it.value } : null, assumed: !!it.assumed };
  lastKey = it.key;
  S.pick[r.cat] = r.no; store.save();
  ctx.showView("tech", r.cat);   // → enter(類別) → switchTab → setRudiment(S.pick[類別]):同一個打法,保留目標
  if (!cur || cur.no !== r.no) setRudiment(r.no);
  syncTarget();
}
/* 相關 PAS 打法、Trinity 的類別按鈕:只是帶過去練(沒有官方速度,不設目標) */
function openRudiment(no){
  target = null;
  const r = byNo(no);
  S.pick[r.cat] = r.no; store.save();
  ctx.showView("tech", r.cat);
  if (!cur || cur.no !== r.no) setRudiment(r.no);
  syncTarget();
}
function openCategory(cat){ target = null; ctx.showView("tech", cat); syncTarget(); }
/* App 能直接練的項目:PAS 原譜(pas)+ 依大綱時值的練習型(pattern);熟練度都看 PAS 編號 */
const practiceItems = () => { const ex = curExam(); return ex.system === "rsl" ? techItems(ex.grade, dataOf("rsl")).filter(x => x.kind === "pas" || x.kind === "pattern") : []; };
const pasNoOf = it => (it.kind === "pattern" ? it.pas : it.no);
$("drawBtn").onclick = () => {
  const all = practiceItems(); if (!all.length) return;
  // 先抽還沒標「已經會了」的(全部都會了就全部);不連續抽到同一項
  let pool = all.filter(x => S.mastery[pasNoOf(x)] !== "good"); if (!pool.length) pool = all;
  if (pool.length > 1) pool = pool.filter(x => x.key !== lastKey);
  practiceItem(pool[Math.floor(Math.random() * pool.length)]);
};
$("nextBtn").onclick = () => {
  const all = practiceItems(); if (!all.length) return;
  const i = all.findIndex(x => x.key === lastKey);
  practiceItem(all[(i + 1) % all.length]);
};
$("qGroups").onclick = e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  if (b.dataset.act === "pas" || b.dataset.act === "pattern") { const it = practiceItems().find(x => x.key === b.dataset.key); if (it) practiceItem(it); }
  else if (b.dataset.act === "rel") openRudiment(Number(b.dataset.no));
  else if (b.dataset.act === "cat") openCategory(b.dataset.cat);
  else if (b.dataset.act === "pasno") openRudiment(Number(b.dataset.no));
};

/* ── Trinity:說明 + 自選曲參數表的 Techniques(官方說只是一般參考)+ 類別按鈕 ── */
function renderTrinity(d, g){
  $("listSub").textContent = tr("在 Song 3 評", "Assessed in Song 3");
  $("listRule").dataset.src = srcOf("trinity", d.techNote.src.p);
  para($("listRule"), () => L(d.techNote.text));
  const oc = d.ownChoice.grades[g], box = $("qGroups"), G = el("div", "xgroup"), head = el("div", "xhead");
  head.innerHTML = `<span class="xname"></span><small class="xsrc">p.${oc.src.p}</small>`;
  G.appendChild(head); box.appendChild(G);
  pairText(head.querySelector(".xname"), () => tr("自選曲參數表:技巧", "Own-choice songs: techniques"));
  const t1 = el("p", "xnote strong"); G.appendChild(t1); pairText(t1, () => L(oc.techniques));
  const t2 = el("p", "xnote"); G.appendChild(t2); pairText(t2, () => L(d.ownChoice.legend));
  if (oc.practice.length) {
    const cats = el("div", "xcats"); G.appendChild(cats);
    for (const x of oc.practice) {
      const b = el("button", "xcat", x.cat ? { "data-act": "cat", "data-cat": x.cat } : { "data-act": "pasno", "data-no": String(x.pas) });
      b.innerHTML = `<span></span>${ICON.go}`;
      cats.appendChild(b);
      pairText(b.querySelector("span"), () => (x.cat ? tr("去練 ", "Practise ") + L([catOf(x.cat).zh, catOf(x.cat).en]) : tr("去練 ", "Practise ") + `${x.pas}. ${name(byNo(x.pas))}`));
    }
    const n = el("p", "xnote"); G.appendChild(n); pairText(n, () => L(d.ownChoice.practiceNote));
  }
  const f = el("p", "xnote"); G.appendChild(f);
  pairText(f, () => tr("技巧分頁的 PAS 40 個基本打法照常可以自由練習。沒有技巧模擬考。", "The 40 PAS rudiments in Technique are always free to practise. No technique mock."));
}

/* ── 目標橫幅(技巧分頁):「RSL 3 級 · D 組 · ♩=75 · p.42」;清單鈕回檢定頁、× 離開目標(速度回到自己的) ── */
function syncTarget(){
  const show = !!target && !target.daily && tab !== "exam";
  $("target").hidden = !show;
  showBest();   // 目標模式不顯示「示範最快」(進出目標都要更新)
  if (!show) return;
  const t = target, sysName = t.system === "rsl" ? "RSL" : "Trinity", gl = () => ctx.gradeLabel(t.grade, t.system);   // 級名要在 fn 裡算(兩種語言各算一次)
  pairStack($("targetText"), () => tr(`${sysName} ${gl()} · ${t.group} 組 · ♩=${t.bpm} · p.${t.p}`, `${sysName} ${gl()} · Group ${t.group} · ♩=${t.bpm} · p.${t.p}`));
  // 練習型:不是官方譜 + practiceOnly(時值是推估的那一項另外在題目標籤標「推估」,橫幅才不會在窄手機上太高)
  $("targetNote").hidden = !t.pattern;
  if (t.pattern) pairStack($("targetNote"), () => tr("App 依大綱時值排的練習型 · 不是官方譜", "App drill in the syllabus values · not the official part") +
    tr("。", ". ") + TS("practiceOnly"));
}
/* 離開目標模式:速度回到自己的設定(× 按鈕、換了考試系統或級數) */
function leaveTarget(){
  const wasPattern = !!(target && target.pattern);
  target = null; syncTarget();
  if (!cur) return;
  if (wasPattern) setRudiment(cur.no);   // 練習型 → 回到 PAS 原譜(速度也回到自己的)
  else { stopPlayback(); bpm = S.bpm[cur.no] || 60; syncTempoUI(); }
}
$("targetClose").onclick = leaveTarget;
$("targetList").onclick = () => ctx.showView("exam", "tech");

/* ══ 鼓譜:一整行 + 播放軸(js/shared/score.js,照 PianoDrill / ScrollScore)══
   看不到時延後重畫、短的放大填滿、長的左右捲、播放軸停在 25% 都在共用元件裡;這裡只給縮放、左右手字母、一輪的長度 */
const scoreZoom = () => (window.innerWidth < 600 ? 1 : window.innerWidth < 1100 ? 1.15 : 1.35);
const score = createScore({
  $, zoom: scoreZoom,
  setup: osmd => { osmd.EngravingRules.TupletNumberLimitConsecutiveRepetitions = false; },   // 每一組三連音都標「3」(官方表就是這樣)
  afterRender: drawSticking,
  lenBeats: () => cycleLength(groups) / DIV,
  playing: () => !!play, isActive: () => active,
  msg: fn => setMsg("paperMsg", fn),
  errorText: e => tr("鼓譜繪製失敗:", "Could not draw the score: ") + e.message,
  onDrawn: xml => { window.__lastXml = xml; window.__scoreReady = (window.__scoreReady || 0) + 1; },
  fitLand: () => fitLandZoom(score, { $ }),
  label: () => scoreLabel()
});
function renderScore(){ if (cur) score.load(rudimentXML(groups, { reps: (dailyPlay() || {}).reps || S.reps, title: cur.en })); }   // 今日練習:反覆次數 = 這一段實際播的
/* 無障礙:鼓譜的文字說明 = 標題(打法名稱 / 練習型名稱)+ 一輪的左右手(Flam / Drag、重音、滾奏、多次反彈、休止標出來)+ 反覆次數 */
function scoreLabel(){
  if (!cur || !groups) return "";
  const title = $("qTitle").textContent.trim() || `${cur.no}. ${name(cur)}`;
  const words = [];
  for (const n of groups.flat()) {
    if (n.rest) { words.push(tr("休止", "rest")); continue; }
    const orn = n.flam ? "Flam " : n.drag ? "Drag " : "";
    if (n.buzz) { words.push(orn + tr("多次反彈滾奏(z,兩手交替)", "multiple-bounce roll (z, alternating hands)")); continue; }
    const hands = strokes([[n]]).filter(x => x.kind !== "grace").map(x => x.hand);
    const roll = n.trem ? tr("滾奏:", "roll: ") : "";   // 滾奏斜線展開的音:前面標「滾奏:」(不然聽起來像一般的單擊)
    hands.forEach((h, i) => words.push((i ? "" : orn + roll) + h + (i === 0 && n.accent ? tr("(重音)", " accent") : "")));
  }
  return tr(`${title}:${words.join(" ")};反覆 ${S.reps} 次`, `${title}: ${words.join(" ")}; repeat ×${S.reps}`);
}

/* 左右手(R / L)畫在每個音下面,裝飾音的字小一點(照 PAS 官方表);多次反彈畫 z(OSMD 不會畫) */
function drawSticking(svg){
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg", frag = document.createDocumentFragment();
  const mains = [...svg.querySelectorAll(".vf-measure > .vf-stavenote")];
  const notes = groups.flat();
  // 字放在所有音符、連線的下面
  let bottom = -Infinity, sp = 10;
  svg.querySelectorAll(".vf-stavenote, .vf-stavetie, .vf-beam").forEach(g => { const b = g.getBBox(); if (b.height) bottom = Math.max(bottom, b.y + b.height); });
  if (!isFinite(bottom)) return;
  const head0 = svg.querySelector(".vf-notehead"); if (head0) sp = head0.getBBox().height || sp;
  const fs = sp * 1.45, small = fs * 0.72, y = bottom + fs * 1.15;
  const text = (x, t, size, bold) => {
    const el = document.createElementNS(NS, "text");
    el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("text-anchor", "middle");
    el.setAttribute("font-family", "Arial, Helvetica, sans-serif"); el.setAttribute("font-weight", bold ? "700" : "600");
    el.setAttribute("font-size", size); el.setAttribute("class", "dd-stick"); el.textContent = t;
    frag.appendChild(el);
  };
  const other = h => (h === "R" ? "L" : "R");
  notes.forEach((n, i) => {
    const el = mains[i]; if (!el || n.rest) return;
    const head = [...el.querySelectorAll(".vf-notehead")].find(h => !h.closest(".vf-modifiers"));
    if (!head) return;
    const hb = head.getBBox();
    if (!n.buzz) text(hb.x + hb.width / 2, n.hand, fs, true);   // 多次反彈:官方表不寫左右手(兩手交替)
    const graces = [...el.querySelectorAll(".vf-modifiers .vf-stavenote .vf-notehead")].map(h => h.getBBox()).sort((a, b) => a.x - b.x);
    graces.forEach(g => text(g.x + g.width / 2, other(n.hand), small, false));
    if (n.buzz) {   // z 畫在符桿中間
      const stem = el.querySelector(".vf-stem"); const sb = stem && stem.getBBox();
      if (sb) {
        const z = document.createElementNS(NS, "text");
        z.setAttribute("x", sb.x + sb.width / 2); z.setAttribute("y", sb.y + sb.height * 0.55); z.setAttribute("text-anchor", "middle");
        z.setAttribute("font-family", "Times New Roman, serif"); z.setAttribute("font-style", "italic"); z.setAttribute("font-weight", "700");
        z.setAttribute("font-size", fs * 1.3); z.textContent = "z"; frag.appendChild(z);
      }
    }
  });
  svg.appendChild(frag);
  // 字超出 OSMD 預留的範圍時把畫布撐大
  const vb = svg.viewBox.baseVal, bb = svg.getBBox();
  if (vb && vb.height) {
    const k = parseFloat(svg.getAttribute("height")) / vb.height;
    const y0 = Math.min(vb.y, bb.y - 4), y1 = Math.max(vb.y + vb.height, bb.y + bb.height + 6);
    if (y0 < vb.y || y1 > vb.y + vb.height) { svg.setAttribute("viewBox", `${vb.x} ${y0} ${vb.width} ${y1 - y0}`); svg.setAttribute("height", (y1 - y0) * k); }
  }
}

/* 題目固定一行:太長就把字縮小(中英文版面一樣) */
function fitTitle(){
  const el = $("qTitle"); el.style.fontSize = ""; el.classList.remove("two");
  let fs = parseFloat(getComputedStyle(el).fontSize);
  const min = Math.max(14, fs * 0.55);
  while (el.scrollWidth > el.clientWidth + 1 && fs > min) { fs -= 1; el.style.fontSize = fs + "px"; }
  // 縮到最小還放不下(折疊機的長英文名):在同一個高度裡排成兩行,不截字
  if (el.scrollWidth > el.clientWidth + 1) {
    el.classList.add("two"); fs = Math.floor(el.clientHeight / 2.3);
    el.style.fontSize = fs + "px";
    while (el.scrollHeight > el.clientHeight + 1 && fs > 11) { fs -= 1; el.style.fontSize = fs + "px"; }
  }
  // 標籤先縮字(最多到 0.6,跟原本一樣),還放不下就讓名稱、類別縮成「…」(不會跑出卡片)
  const g = $("qTags"); let k = 1; g.style.setProperty("--tag-scale", 1); g.classList.add("measure");
  // 量最後一個標籤的右緣(留 2px:小數寬度四捨五入時不會多出「…」)
  const over = () => g.lastElementChild && g.lastElementChild.getBoundingClientRect().right + 2 > g.getBoundingClientRect().right;
  while (over() && k > 0.6) { k -= 0.04; g.style.setProperty("--tag-scale", k); }
  g.classList.remove("measure");
}
const onStageResize = () => {
  if (!active) return;
  fitTitle();
  land.onResize();   // 播放中轉向(手機橫式 ↔ 直式)
  if (routeOn()) { rv.onResize(); return; }
  if (!cur) return;
  score.onResize();
};
window.addEventListener("resize", onStageResize);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => requestAnimationFrame(onStageResize)).observe($("stage"));

/* ══ 速度(♩ = 每分鐘幾拍;js/shared/tempo.js)══ */
const MIN_BPM = 30, MAX_BPM = 240;
const tempo = createTempo({ $, min: MIN_BPM, max: MAX_BPM, get: () => bpm, set: v => setBpm(v, true) });
function syncTempoUI(){
  tempo.sync(tr("拍 / 分鐘", "beats / min"));
  $("examTempo").textContent = dseg ? tr("今日練習會自動調整", "Set by today's practice") : tr("建議:慢 → 快 → 慢", "Slow → fast → slow");   // PAS 的 open – close – open
  if (routeOn()) { tempo.setBeats(4); return; }
  const beats = Math.max(1, Math.round(accentEvery(cycleLength(groups || [[{ dur: 4 * DIV }]])) / DIV));
  tempo.setBeats(Math.min(8, beats));
}
function setBpm(v, fromUser){
  bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
  if (fromUser && cur && !target) { S.bpm[cur.no] = bpm; store.save(); }   // 檢定目標模式:只改這一次的速度,× 離開就回到自己的
  syncTempoUI(); retempo();
  if (routeOn()) rv.retempo(bpm);
  if (dseg) paintTags();
}

/* ══ 音訊 ══ */
function setRing(p){
  const r = $("playRing"); if (!r) return;
  r.classList.toggle("indet", p == null);
  r.querySelector(".ring-fg").style.strokeDashoffset = String(p == null ? 0.82 : 1 - Math.max(0.03, p));
}
let preloadJob = null;
function preloadSamples(){
  if (preloadJob) return preloadJob;
  preloadJob = (async () => {
    try {
      setRing(null);
      setMsg("loadingMsg", () => tr("載入小鼓取樣…", "Loading snare samples…"));
      await audio.loadDrums(["snare"], p => { setRing(p * 0.95); setMsg("loadingMsg", () => tr("載入小鼓取樣… ", "Loading snare samples… ") + Math.round(p * 100) + "%"); });
      await audio.loadClick().catch(() => {});
      setRing(1); setMsg("loadingMsg", null);
      return true;
    } catch (e) {
      preloadJob = null;
      setMsg("loadingMsg", () => tr("小鼓取樣載入失敗,再按一次播放重試(需要網路,之後會存在裝置上)", "Could not load the snare — tap play to retry (needs internet once; then cached)"));
      return false;
    }
  })();
  return preloadJob;
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

/* ── 示範播放:預備拍一小節(四拍)+ 每拍一個拍點 ── */
const COUNT_IN = 4;
/* 拍點的重拍:每一輪的開頭。練習型的一輪常常只有 1、2 拍(例如單擊八分音符 = 1 拍),每一下都是重拍就沒有意義
   → 練習型一輪不到 4 拍(而且 4 拍是整數輪)時,重拍改成每 4 拍一次(取「4 拍」與「一輪」比較大的);PAS 原譜照舊每一輪 */
function accentEvery(cyc){ return curPattern() && cyc < 4 * DIV && (4 * DIV) % cyc === 0 ? 4 * DIV : cyc; }
const VEL = { accent: 0.95, tap: 0.6, roll: 0.55, buzz: 0.5, grace: 0.3 };
let play = null, starting = 0;
function schedulePlay(p, from){
  const { t0, beatSec, reps, cyc } = p;
  const gap = Math.min(0.032, beatSec / 10);   // 裝飾音在主音前面多久(慢速時 32ms,快速時跟著縮短)
  if (!(p.mock || p.solo || clickOnlyOn())) for (let rep = 0; rep < reps; rep++) for (const s of p.list) {
    const on = t0 + (rep * cyc + s.at) / DIV * beatSec;
    if (s.kind === "grace") {
      const at = on - gap * s.grace;
      if (at >= from) audio.playDrum("snare", at, VEL.grace + (Math.random() * 0.04 - 0.02));
      continue;
    }
    if (on < from) continue;
    const jit = Math.random() * 0.04 - 0.02;
    if (s.kind === "buzz") {   // 多次反彈:一下之後鼓棒在鼓面上連續彈好幾下,越來越小聲
      audio.playDrum("snare", on, VEL.buzz + jit);
      for (let k = 1; k <= 4; k++) audio.playDrum("snare", on + k * Math.min(0.022, beatSec / 20), VEL.buzz * (1 - k * 0.17));
      continue;
    }
    // 滾奏的雙擊:第二下(反彈)比第一下輕一點
    const v = s.kind === "roll" ? (s.second ? VEL.roll - 0.06 : VEL.roll) : VEL[s.kind];
    audio.playDrum("snare", on, v + jit);
  }
  const clicks = Math.ceil(reps * cyc / DIV);
  for (let b = -COUNT_IN; b < clicks; b++) {
    const at = t0 + b * beatSec;
    // 模擬考「只聽一小節拍點」:預備拍之後沒有拍點;今日練習的拍點模式(只響 2、4 拍、第 1 拍、中途消失 2 小節;一小節 = 4 拍)
    if (at >= from && !(p.oneBar && b >= 0) && clickPlays(p.click, b, 4, clicks)) audio.playClick(at, b < 0 ? b === -COUNT_IN : (b * DIV) % p.acc === 0);
  }
}
let retempoTimer = 0;
function retempo(){
  if (!play) return;
  clearTimeout(retempoTimer);
  retempoTimer = setTimeout(() => {
    if (!play) return;
    const beatSec = 60 / bpm;
    if (Math.abs(beatSec - play.beatSec) < 1e-6) return;
    const from = audio.audioNow() + 0.06;
    const beat = (from - play.t0) / play.beatSec;
    audio.cancelFrom(from);
    play.t0 = from - beat * beatSec; play.beatSec = beatSec;
    schedulePlay(play, from);
  }, 60);
}
/* 開始播放。沒有開始(取樣沒載到、播放失敗)時 land.release():循環的下一輪是 stopPlayback(true, keepView) 留著 land-play 的,
   不放掉會卡在「樂譜卡貼頂、放大」的畫面(別人接手的 "busy" 不放:那一次會自己處理) */
async function startPlayback(){
  let r = "failed";
  try { r = await startInner(); }
  catch (e) {
    console.error(e);
    starting = 0; $("playBtn").classList.remove("busy");
    if (play) stopPlayback();
    $("playLabel").textContent = playText();
    setMsg("loadingMsg", () => tr("播放失敗:", "Playback failed: ") + (e && e.message || e));
  }
  if (r === "failed") land.release();
  if (r !== "started") loopNext = false;
  // 這一類播放過一次:說明不再出現(換打法、換類別時才收起來,播放中版面不動)
  else if (tab !== "exam" && !S.intro[tab]) { S.intro[tab] = true; store.save(); }   // 沒有開始(失敗、被取代):下一次使用者按播放要照常播報
  return r;
}
/* 回傳 "started"(開始播了)、"busy"(正在準備 / 被換題或停止取代)、"failed"(取樣沒載到) */
async function startInner(){
  if (!cur || starting) return "busy";
  const token = starting = Date.now() + Math.random();
  const r0 = cur;
  const actx = audio.ensureAudio();
  $("playLabel").textContent = tr("準備中…", "Preparing…"); $("playBtn").classList.add("busy");
  if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
  const loaded = await preloadSamples();
  await within(audio.masterReady, 1500);
  if (starting !== token || cur !== r0) { if (starting === token) { starting = 0; $("playLabel").textContent = playText(); } $("playBtn").classList.remove("busy"); return "busy"; }
  starting = 0; $("playBtn").classList.remove("busy");
  if (!loaded) { $("playLabel").textContent = playText(); return "failed"; }
  const mk = mockPlay(), dp = dailyPlay(), beatSec = 60 / bpm, cyc = cycleLength(groups), reps = mk ? mk.reps : dp ? dp.reps : S.reps;
  // 雙擊的第二下標記出來(播放時輕一點);RSL 雙擊練習型(RRLL)照 #6 雙擊開放滾奏的播法:每一對的第二下輕一點
  const dbl = !!(curPattern() && curPattern().sticking === "double");
  const list = strokes(groups).map((s, i, a) => {
    if (dbl && s.kind === "tap") return { ...s, kind: "roll", second: i % 2 === 1 };
    return s.kind === "roll" && !s.first && a[i - 1] && a[i - 1].kind === "roll" && a[i - 1].hand === s.hand && !a[i - 1].second ? { ...s, second: true } : s;
  });
  const t0 = actx.currentTime + 0.15 + COUNT_IN * beatSec;
  play = { t0, real0: t0, beatSec, reps, cyc, acc: accentEvery(cyc), list, raf: 0, endBeat: reps * cyc / DIV, mock: !!mk, oneBar: !!(mk && mk.oneBar), mockId: mk ? mock.id : 0,
    click: dp ? dp.click : "every", solo: !!(dp && dp.solo) };
  schedulePlay(play, -Infinity);
  revealScore();
  if (!loopNext) announce(mk || (dp && dp.solo) ? tr("開始:跟拍點打", "Started: play along with the click") : tr("開始播放示範", "Playing the demo"));
  loopNext = false;
  $("playLabel").textContent = T("stop");
  $("playIcon").innerHTML = '<rect x="6" y="6" width="12" height="12" rx="1.5"/>';
  const tick = () => {
    if (!play) return;
    const beat = (audio.audioNow() - play.t0) / play.beatSec;
    tempo.showBeat(beat, COUNT_IN);
    const len = play.cyc / DIV;
    score.movePlayline(beat < 0 ? 0 : beat >= play.endBeat ? len : beat % len, true);
    if (beat > play.endBeat + 0.3) {
      const sec = play.endBeat * play.beatSec, wasMock = play.mock;
      lastEnd = { n: lastEnd.n + 1, scheduled: audio.scheduledCount(), at: audio.audioNow() };   // 測試用:自然播完時還排著的節點數(播完的會自己移除)與當時的時間
      if (wasMock) { const id = play.mockId; stopPlayback(true); logPractice(sec); mockRunDone(id); return; }   // 模擬考:這一項跟拍點打完(不循環、不記示範最快)
      loopNext = !!(loopOn() && cur);   // 循環的下一輪不再播報「開始 / 播完」
      stopPlayback(true, !!(loopOn() && cur));   // 循環的下一輪:手機橫式不捲回去
      logPractice(sec);
      // 示範最快只記自由練習(目標模式是官方速度的練習,不算)
      if (!target && !clickOnlyOn() && (!S.best[cur.no] || bpm > S.best[cur.no])) { S.best[cur.no] = bpm; store.save(); showBest(); }
      if (loopOn() && cur) { if (S.ramp && !dseg) setBpm(bpm + 4, true); startPlayback(); }   // 今日練習的速度照速度階梯(不每輪加快)
      return;
    }
    play.raf = requestAnimationFrame(tick);
  };
  play.raf = requestAnimationFrame(tick);
  return "started";
}
let lastEnd = { n: 0, scheduled: 0, at: 0 };
let loopNext = false;   // 循環播放的下一輪(無障礙:不重複播報)
/* 示範最快:PAS 原譜自由練習的紀錄;目標模式(官方速度、練習型)不顯示(那是別的譜、別的速度) */
function showBest(){ const b = cur && !target && S.best[cur.no]; $("bestTempo").textContent = b ? `${T("bestLabel")} ♩=${b}` : ""; }
function stopPlayback(natural, keepView){
  if (!natural && rv) rv.stop();   // 今日練習的路線段(示範、打一遍)
  if (!natural) loopNext = false;   // 中途停止(包括循環下一輪準備中被停):下一次開始要播報
  starting = 0; $("playBtn").classList.remove("busy");
  land.release(keepView);   // 手機橫式:播完(或停止)捲回播放前的位置、縮回;循環的下一輪不捲
  if (play) {
    cancelAnimationFrame(play.raf);
    // 中途停止(按停止、換題、切分頁、切到背景):已經播的秒數算進今天的練習時間,次數不加;模擬考的這一項記「中途停止」
    if (!natural) { const sec = audio.audioNow() - play.real0; if (sec >= 0.5) addPracticeSec(sec); if (play.mock) mockRunStopped(play.mockId); }
    if (!keepView) announce(natural ? tr("播完了", "Finished") : tr("停止了", "Stopped"));
    play = null;
    if (!natural) audio.stopAll();
  }
  score.home();
  $("playLabel").textContent = playText();
  $("playIcon").innerHTML = '<path d="M7 4v16l13-8z"/>';
  tempo.showBeat(null);
}
/* 按播放時鼓譜要看得到:手機橫式 → 樂譜卡貼到頂欄下、放大到滿版(landscape.js);其他 → 沒露出來就捲過去 */
const land = createLandPlay({ $, score, playing: () => !!play, stop: () => stopPlayback(), reveal: () => revealScore() });
function revealScore(){
  if (land.reveal()) return;
  const r = $("scoreCard").getBoundingClientRect(), bar = document.querySelector(".tabbar");
  const bt = bar ? bar.getBoundingClientRect().top : innerHeight;
  const bottom = bt > innerHeight / 2 ? bt : innerHeight;
  if (r.bottom > bottom - 4) window.scrollBy({ top: Math.min(r.bottom - bottom + 8, r.top - 4), behavior: "smooth" });
  else if (r.top < 0) window.scrollBy({ top: r.top - 8, behavior: "smooth" });
}
$("playBtn").onclick = () => { if (routeOn()) { rv.toggleDemo(playOpts()); return; } if (play) stopPlayback(); else if (!starting) startPlayback(); };
function syncPlayOpts(){
  $("optLoop").setAttribute("aria-pressed", String(!!S.loop));
  $("optRamp").setAttribute("aria-pressed", String(!!S.ramp));
  $("optRamp").hidden = !S.loop;   // 沒開循環播放時「每輪加快 4」沒有作用:藏起來(不放一顆不能按的鈕)
  $("optClick").setAttribute("aria-pressed", String(!!S.clickOnly));
}
/* 今日練習的段落不用循環 / 只聽拍點(速度卡的選項藏起來,播放照段落的設定) */
function loopOn(){ return !!S.loop && !dseg; }
function clickOnlyOn(){ return !!S.clickOnly && !dseg; }
for (const [id, k] of [["optLoop", "loop"], ["optRamp", "ramp"], ["optClick", "clickOnly"]]) $(id).onclick = () => { S[k] = !S[k]; store.save(); syncPlayOpts(); };
syncPlayOpts();

/* ══ 練習紀錄(js/shared/practicelog.js):示範(或模擬考的一項)完整播完算一次;中途停止只加秒數(熟練標記不算練習)。
   秒數 = 真的播放的時間(預備拍之後);每週目標 = 最近 7 天的分鐘數(點一下換目標,存在 drumdrill.tech.v1 的 goal)══ */
function logPractice(sec){ addPracticeSec(sec, 1); }
function addPracticeSec(sec, n = 0){
  // 今日練習的段落:秒數也算進這一段;次數改成「完成一段算一次」(dNext)
  if (dseg && target && target.daily) { daily.addSec(sec); n = 0; }
  addLog(S.log, { sec, n });
  store.save(); renderLog();
  if (dseg) dcard.render();
}
function renderLog(){
  paintLog($, S.log, S.goal);
  $("logMin").textContent = Math.floor(today(S.log).sec / 60);
}
$("goalBtn").onclick = () => { S.goal = nextGoal(S.goal); store.save(); renderLog(); };

/* ══ 模擬考(S14;js/shared/mock.js):RSL 照考試形式,每一組抽一項(考官從每一組抽一部分考 [RSL §3.1]),依組的順序一項一項;
   只抽 App 能直接練的(pas = PAS 原譜、pattern = 依大綱時值的練習型);只有檢定書譜的組(Fill 等)顯示「這一組請用檢定書練」並跳過。
   每一項:官方速度 + 拍點(預備拍 1 小節);Debut–3 可以選「只聽一小節拍點」(p.30 等;之後沒有拍點),4–8 一定跟拍點(p.47 等)。
   長度:MOCK_BEATS 拍(4 小節,練習設定;大綱沒寫,譜在檢定書),整數輪。App 只播拍點、不播示範(考的是你打)。
   結果只有每一項「跟拍點打完 / 中途停止 / 沒有打 / 用檢定書練」與自己標的熟練度:不算總分、不出現等第、不換算官方分數。
   Trinity Rock & Pop 沒有技巧項目(在 Song 3 評),沒有技巧模擬考 ══ */
const MOCK_BEATS = 16;
const mockOn = () => tab === "exam" && mock.running();
/* ▶ 的名稱(無障礙):模擬考只播拍點,不播示範 */
const playText = () => (mockOn() ? tr("開始(只有拍點)", "Start (click only)") : T("play"));
const mockStep = () => (mock.running() && mock.data ? mock.data.steps[mock.data.i] : null);
const mockGrade = () => (mock.data ? mock.data.grade : curExam().grade);
const oneBarOK = g => { const d = dataOf("rsl"), t = d && d.tech && d.tech[g]; return !!t && t.click === "optional"; };
/* 這一次播放是模擬考的一項:長度(整數輪,至少 MOCK_BEATS 拍)、只聽一小節拍點 */
function mockPlay(){
  const st = mockStep();
  if (!mockOn() || !st || !st.it) return null;
  return { reps: Math.max(1, Math.ceil(MOCK_BEATS * DIV / cycleLength(groups))), oneBar: !!S.mockOneBar && oneBarOK(mockGrade()) };
}
function startMock(){
  const ex = curExam(), d = dataOf("rsl");
  if (ex.system !== "rsl" || ex.auto || !d || !d.tech || !d.tech[ex.grade]) return;
  stopPlayback();
  const items = techItems(ex.grade, d);
  const steps = d.tech[ex.grade].groups.map(gr => {
    const pool = items.filter(x => x.group === gr.id && (x.kind === "pas" || x.kind === "pattern"));
    const book = items.filter(x => x.group === gr.id && x.kind === "book").length;   // 混合組:只在檢定書的項目這次沒練(結果註明)
    return { gr, it: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null, status: "todo", book: pool.length ? book : 0 };
  });
  mockSaved = { bpm };
  mock.begin({ sys: "rsl", grade: ex.grade, steps, i: 0 }, { sys: "rsl", grade: ex.grade });
  goMockStep(0);
  cardToTop($("mockCard"));
}
function goMockStep(i){
  stopPlayback();
  const m = mock.data; m.i = i;
  const st = m.steps[i];
  if (st.it) {
    const it = st.it, no = pasNoOf(it);
    cur = byNo(no);
    groups = it.kind === "pattern" ? pattern({ pas: it.pas, sticking: it.sticking, value: it.value, lead: S.lead }) : withLead(cur, S.lead);
    bpm = st.gr.bpm || 60;
    $("playBtn").disabled = false;
    syncMastery(); syncTempoUI(); showBest();
    renderScore(); preloadSamples();
  } else { cur = null; groups = null; $("playBtn").disabled = true; syncMastery(); }
  st.status = st.it ? st.status : "skip";
  renderExam();
  if (active) requestAnimationFrame(() => { if (active && mock.running()) fitTitle(); onStageResize(); });
}
/* 這一項跟拍點打完 / 中途停止(同一場模擬考才算) */
function mockRunDone(id){
  if (!mock.alive(id)) return;
  const st = mockStep(); if (st) st.status = "done";
  renderExam();
}
function mockRunStopped(id){
  if (!mock.alive(id)) return;
  const st = mockStep(); if (st && st.status !== "done") st.status = "stopped";
  if (tab === "exam") renderMockCard(dataOf("rsl"), mockGrade());
}
$("mockNext").onclick = () => {
  if (!mock.running()) return;
  stopPlayback();
  const m = mock.data, st = m.steps[m.i];
  if (st.status === "todo") st.status = "none";
  if (m.i >= m.steps.length - 1) { finishMock(); return; }
  goMockStep(m.i + 1);
};
function finishMock(){
  stopPlayback();
  mock.data.marks = mock.data.steps.map(s => (s.it ? S.mastery[pasNoOf(s.it)] || "" : ""));   // 結果畫面的熟練度(做完當下的)
  mock.finish();
  mockRestore();
  renderExam();
  cardToTop($("mockCard"));
  if (ctx) ctx.examChanged();
}
/* 模擬考結束(做完、中止、停止):速度還原;技巧分頁回來時 switchTab 會照自己的選擇重設打法 */
function mockRestore(){ if (mockSaved) { bpm = mockSaved.bpm; mockSaved = null; } syncTempoUI(); }
$("mockBtn").onclick = () => {
  if (mock.running()) { stopPlayback(); mock.close(); mockRestore(); renderExam(); return; }   // 停止(不算,回到檢定頁)
  startMock();
};
$("mockClose").onclick = () => { mock.close(); renderExam(); window.scrollTo({ top: 0 }); };
$("mockOneBar").onclick = () => { S.mockOneBar = !S.mockOneBar; store.save(); renderMockCard(dataOf("rsl"), mockGrade()); if (mock.running()) renderMockStep(); };

const stepName = st => () => (st.it ? itemName(st.it) : L(st.gr.name));
const stepDetail = (st, i) => () => {
  const b = st.gr.bpm ? `♩=${st.gr.bpm}` : "";
  const mk = mock.state === "result" && mock.data.marks ? mock.data.marks[i] : "";
  const mark = (mk === "good" ? tr(" · 會了", " · got it") : mk === "weak" ? tr(" · 再練", " · needs work") : "")
    + (mock.state === "result" && st.book ? tr(` · 這一組另有 ${st.book} 項只在檢定書(這次沒練)`, ` · ${st.book} more in the grade book (not practised)`) : "");
  if (st.status === "skip") return tr("這一組請用檢定書練(App 沒有譜)", "Use the grade book for this group (no part in the App)");
  if (st.status === "done") return tr(`跟拍點打完 · ${b}`, `Played through with the click · ${b}`) + mark;
  if (st.status === "stopped") return tr(`中途停止 · ${b}`, `Stopped part-way · ${b}`) + mark;
  if (st.status === "none") return tr(`沒有打 · ${b}`, `Not played · ${b}`) + mark;
  return mock.running() && mock.data.i === i ? tr(`進行中 · ${b}`, `Now · ${b}`) : b;
};
const stepMark = (st, i) => (st.status === "done" ? "ok" : st.status === "skip" ? "skip" : st.status === "stopped" || st.status === "none" ? "no" : mock.running() && mock.data.i === i ? "cur" : "todo");
/* 模擬考卡:檢定頁的說明 + 開始 / 進行中的進度 / 結果 / 中止的說明 */
function renderMockCard(d, g){
  const ex = curExam(), card = $("mockCard"), ms = mock.state;
  card.hidden = ms === "idle" && (!!ex.auto || ex.system !== "rsl");   // 沒選考試:跟視奏、聽力一樣不顯示模擬考卡;Trinity 沒有技巧模擬考(本級要求底下一行字)
  if (card.hidden) return;
  const name = (sys, gg) => `${sys === "rsl" ? "RSL" : "Trinity"} ${ctx.gradeLabel(gg, sys)}`;
  const g0 = mock.who(ex).grade;   // 中止的說明(含重新整理後):那一場的級數
  $("mockOpts").hidden = !((ms === "idle" || ms === "run") && ex.system === "rsl" && oneBarOK(g0));
  if (!$("mockOpts").hidden) {
    $("mockOneBar").setAttribute("aria-pressed", String(!!S.mockOneBar));
    pairText($("mockOneBar"), () => tr("拍點只響第一小節", "Count-in only"));   // 頁碼在說明裡
  }
  const rows = mock.data && (ms === "run" || ms === "result") ? mock.data.steps.map((st, i) => ({ id: st.gr.id, name: stepName(st), detail: stepDetail(st, i), mark: stepMark(st, i) })) : null;
  if (ms === "aborted") {
    paintCard($, { title: () => tr("模擬考已中止", "Mock exam stopped"), sub: name(mock.who(ex).sys, g0), text: () => abortText(mock.reason),
      btn: ex.system === "rsl" && !ex.auto && d ? { label: () => mockLabel("aborted") } : null, close: { label: () => tr("回到本級要求", "Back to the list") } });
    if (active) mock.seen();
    return;
  }
  if (ms === "result") {
    const steps = mock.data.steps, c = k => steps.filter(s => s.status === k).length;
    paintCard($, { title: () => tr("模擬考結果", "Mock exam result"), sub: name("rsl", mock.data.grade),
      text: () => [tr(`跟拍點打完 ${c("done")} 組`, `${c("done")} played through`), c("stopped") ? tr(`中途停止 ${c("stopped")} 組`, `${c("stopped")} stopped`) : "",
        c("none") ? tr(`沒有打 ${c("none")} 組`, `${c("none")} not played`) : "", c("skip") ? tr(`用檢定書練 ${c("skip")} 組`, `${c("skip")} from the grade book`) : ""].filter(Boolean).join(tr(" · ", " · ")) +
        tr("。「會了 / 再練」是你在技巧分頁自己標的。", ". Got it / Needs work are your own marks (Technique tab)."),
      rows, btn: ex.system === "rsl" && !ex.auto && d ? { label: () => mockLabel("result") } : null, close: { label: () => tr("回到本級要求", "Back to the list") } });
    return;
  }
  if (ms === "run") {
    const m = mock.data;
    paintCard($, { title: () => tr("模擬考 · 技巧", "Mock exam · Technique"), sub: tr(`${m.i + 1} / ${m.steps.length} 組`, `Group ${m.i + 1} / ${m.steps.length}`),
      text: () => { const p = d && d.tech && d.tech[m.grade] ? srcOf("rsl", d.tech[m.grade].src.p) : "";
        return tr(`每一組抽一項,照官方速度(${p})。`, `One item per group at the official tempo (${p}).`); },
      rows, btn: { label: () => mockLabel("run") }, note: () => tr(`每一項 ${MOCK_BEATS / 4} 小節(${TS("srcPractice")})。`, `${MOCK_BEATS / 4} bars each (${TS("srcPractice").toLowerCase()}).`) + " " + resultNote() });
    return;
  }
  // idle(檢定頁):RSL 說明 + 開始(Trinity 沒有技巧模擬考:卡片藏起來,本級要求底下一行字)
  const t = d && d.tech && d.tech[g];
  paintCard($, { title: () => tr("模擬考", "Mock exam"), sub: name("rsl", g),
    // 說明只寫一句(「拍點只響第一小節」的開關在標題列、只有檢定書譜的組在結果裡註明)
    text: () => (!t ? tr("考試資料還沒載好。", "Exam data isn't loaded yet.") : tr(`每一組抽一項,照官方速度(${srcOf("rsl", t.src.p)})。`, `One item per group at the official tempo (${srcOf("rsl", t.src.p)}).`)),
    btn: t && !ex.auto ? { label: () => mockLabel("idle"), disabled: !techItems(g, d).some(x => x.kind === "pas" || x.kind === "pattern") } : null,
    note: () => resultNote() });
}
/* 模擬考進行中的題目卡:這一組的項目(或「用檢定書練」)、第幾組、下一組 */
function renderMockStep(){
  const m = mock.data, st = m.steps[m.i], last = m.i >= m.steps.length - 1;
  $("mockStep").textContent = tr(`${st.gr.id} 組 · ${m.i + 1} / ${m.steps.length}`, `Group ${st.gr.id} · ${m.i + 1} / ${m.steps.length}`);
  pairText($("mockNextLabel"), () => (last ? tr("結束", "Finish") : tr("下一組", "Next group")));
  renderMockTitle();
  const one = !!S.mockOneBar && oneBarOK(m.grade);
  const ptn = () => (st.it && st.it.kind === "pattern" ? tr("App 依大綱時值排的練習型 · 不是官方譜。", "App drill in the syllabus values · not the official part. ") : "");
  pairText($("mockMsg"), () => ptn() + (!st.it ? tr("這一組請用檢定書練(譜只在官方檢定書);按「下一組」繼續。", "Use the grade book for this group (the part is only in the book); tap Next group.")
    : st.status === "done" ? tr("完成。按「下一組」。", "Done. Tap Next group.")
    : st.status === "stopped" ? tr("中途停止。可以再按 ▶ 打一次,或按「下一組」。", "Stopped. Tap ▶ to play it again, or Next group.")
    : one ? tr("按 ▶:一小節拍點之後自己保持速度打。", "Tap ▶: one bar of click, then keep the tempo yourself.")
    : tr("按 ▶:預備拍一小節,之後跟著拍點打。", "Tap ▶: a 1-bar count-in, then play with the click.")));
  syncMastery();
  if (active) fitTitle();
}
function renderMockTitle(){
  const st = mockStep(); if (!st) return;
  $("qTitle").textContent = st.it ? itemName(st.it) : L(st.gr.name);
  // 組別、官方速度(頁碼在模擬考卡的說明裡)、練習型、推估;中英數量一樣,都不縮成「…」
  // 組別在下面那一列(「A 組 · 1 / 6」)、練習型在說明(t-mockMsg)已經寫了:標籤只放官方速度與推估
  const tags = [st.gr.bpm ? `♩=${st.gr.bpm}` : "♩ —", st.it && st.it.kind === "pattern" && st.it.assumed ? TS("srcAssumed") : null].filter(Boolean);   // 時值是推估的(4 級 C 組 Flam tap)
  $("qTags").innerHTML = tags.map(t => `<span class="q-tag">${t}</span>`).join("");
}


/* ══ 今日練習(js/shared/daily.js 引擎 + js/shared/dailycard.js 卡片;路線在 js/tech/routes.js:律動 28 關、過門 19 關;畫面與播放 js/tech/route.js)══
   技巧分頁最上面的卡片 → 「開始今天的練習」→ 一段一段:暖身(現有打法,不過關、只記時間)、路線的這一關、複習(用這一盒的變化)。
   路線段:題目卡(段落面板)+ 鼓組譜卡(#t-rScoreCard;圖例 plain、手打的音下面 R / L)+ 速度卡(藏起循環 / 每輪 +4 / 只聽拍點);
   以真的鼓 / 打擊墊為主:▶ 示範(整組鼓 + 拍點,一直循環)→ 自己按「穩了 / 再練」;「沒有鼓?用手機鼓墊」→ 鼓墊卡(#t-rPadCard)+ 題目卡的「打一遍」,打中 ≥ 85 = 穩。
   拍點模式不是每拍的那一次(複習的變化),▶ 只有拍點(自己打)。段落用 target(daily = 段落種類;route = 路線段):不寫進 S.bpm、不顯示目標橫幅;
   進行中子項目分段鈕都不亮(ctx.setSubActive);點子項目或到檢定頁 = 暫停 */
/* 暖身:有選 RSL 考試 → 本級的 PAS / 練習型(沒標「會了」的優先;畫面不寫考試名稱;Trinity Rock & Pop 沒有技巧項目 → 一般暖身);
   沒選 → WARM 照律動的進度一層一層加進來,從最新的兩層照日子輪流(標「再練」的優先);一開始是單擊四分音符的練習型 */
function warmItem(d, today){
  const ex = exam && !exam.auto ? exam : null;
  if (ex && ex.system === "rsl" && dataOf("rsl")) {
    const all = practiceItems(); let pool = all.filter(x => S.mastery[pasNoOf(x)] !== "good"); if (!pool.length) pool = all;
    if (pool.length) {
      const it = pool[Math.floor(Math.abs(hashDay(today)) % pool.length)];
      return it.kind === "pattern" ? { pas: it.pas, sticking: it.sticking, value: it.value, bpm: it.bpm || 60, exam: true }
        : { pas: it.no, bpm: it.bpm || 60, exam: true };
    }
  }
  const passed = id => { const e = d && d.lv && d.lv["groove/" + id]; return !!(e && e.passed); };
  const open = WARM.filter(w => !w.after || passed(w.after));
  const tiers = [...new Set(open.map(w => w.after || ""))].slice(-2);
  const list0 = open.filter(w => tiers.includes(w.after || ""));
  const weak = list0.filter(w => S.mastery[w.pas] === "weak"), list = weak.length ? weak : list0;
  const w = list[Math.abs(hashDay(today)) % list.length];
  return { pas: w.pas, sticking: w.sticking, value: w.value, name: w.name, check: w.check, bpm: w.value ? 60 : S.bpm[w.pas] || 56 };
}
/* 暖身項目的名稱:WARM 有寫的照寫;練習型 = PAS 名稱 + 時值;PAS 原譜 = 編號 + 名稱(換語言重算) */
function warmName(it){
  if (it.name) return it.name;
  const r = byNo(it.pas);
  return it.value ? patternName({ pas: it.pas, sticking: it.sticking, value: it.value }) : [`${r.no}. ${r.zh}`, `${r.no}. ${r.en}`];
}
const hashDay = k => Number(k.replace(/-/g, "")) || 0;
/* 今天的暖身還沒開始時重排(考試資料晚到、換了考試):隔天也一樣,打開 App 時資料還沒到,到了就換成本級項目 */
function replanWarm(){
  const t = daily.today(), i = t.plan.findIndex(p => p.k === "warm");
  if (i < 0 || t.done[i] || t.sec[i] > 0 || (dseg && dseg.k === "warm")) return;
  const it = warmItem(daily.data, t.date);
  if (JSON.stringify(it) === JSON.stringify(t.plan[i].item)) return;
  t.plan[i].item = it; S.daily = daily.data; store.save();
  if (!dseg) dcard.render();
}
const daily = createDaily({ routes: ROUTES, load: () => S.daily, save: d => { S.daily = d; store.save(); }, extras: { warm: warmItem } });
const dcard = createDailyCard({ $, daily, announce,
  // 段落按鈕「穩了 / 還要練」(不跟熟練度的「會了 / 再練」撞名);狀態一句短話(fold-280 不超過兩行)
  labels: { ok: ["穩了", "Steady"], again: ["還要練", "Not yet"],
    hint: ["▶ 聽示範,在鼓上跟著打;穩了按 ✓", "▶ Demo; play along, then ✓"],
    solo: ["▶ 只有拍點:在鼓上自己打,穩了按 ✓", "Click only: play it, then ✓"] },
  mark: s => (s && s.level && s.level.time === "12/8" ? "♩.=" : "♩="),   // 12/8 的速度是附點四分
  warmName: warmName, log: () => S.log,
  onStart: () => { dShow(daily.begin()); window.scrollTo({ top: 0 }); },
  onNext: () => dNext(), onMore: () => { const s = daily.addExtra(); if (s) dShow(s); },
  onOk: () => dTry({ self: "ok" }), onAgain: () => dTry({ self: "again" }),
  onBack: () => { stopPlayback(); if (daily.back()) dShow(daily.seg()); },
  // 路線段的按鈕列:「沒有鼓?用手機鼓墊」接在「回上一關」後面、「打一遍」放在最右邊(主要按鈕;藏不藏照鼓墊模式,route.js syncPadUI)
  acts: { left: () => (routeOn() ? [$("rModeBtn")] : []), right: () => (routeOn() ? [$("rPerform")] : []) } });
/* 鼓墊模式的下一步(還沒打過 / 打完):照路線的狀態一句 */
const PAD_HINT = { hint: ["▶ 聽示範,再按「打一遍」用鼓墊打", "▶ for the demo, then Play it on the pads"],
  solo: ["只有拍點:按「打一遍」用鼓墊打", "Click only: tap Play it, use the pads"] };
/* 路線段(律動 / 過門 / 複習)的畫面與播放 */
const routeOn = () => !!(dseg && dseg.k !== "warm" && target && target.route);
const rlFor = level => { const r = level.route ? level.route.id : null, v = S.rl && r ? S.rl[r] : undefined; return typeof v === "boolean" ? v : level.rl !== false; };
rv = createRouteView({ $, tempo, drumKey: () => (ctx && ctx.drumKey ? ctx.drumKey() : Promise.resolve(null)), getBpm: () => bpm,
  isActive: () => active,
  addSec: sec => addPracticeSec(sec),
  onResult: ({ score: sc, res, bpm: b }) => dTry({ score: sc, res, at: b }),
  onPlayState: st => {
    $("playBtn").classList.toggle("busy", st === "busy");
    const on = st === "demo";
    $("playLabel").textContent = on ? T("stop") : st === "busy" ? tr("準備中…", "Preparing…") : playText();
    $("playIcon").innerHTML = on ? '<rect x="6" y="6" width="12" height="12" rx="1.5"/>' : '<path d="M7 4v16l13-8z"/>';
    $("playBtn").disabled = st === "perform";
    rv.syncPerform();
    if (st === "perform" || on) revealRoute(st === "perform");
  },
  onLoad: (p, failed) => {
    setRing(p == null ? 1 : p);
    setMsg("loadingMsg", failed ? () => tr("鼓聲載入失敗,再按一次重試(需要網路,之後會存在裝置上)", "Could not load the drums — try again (needs internet once; then cached)")
      : p == null ? null : () => tr(`載入鼓聲 ${Math.round(p * 100)}%`, `Loading drums ${Math.round(p * 100)}%`));
  },
  rlFor, setRl: (level, v) => { S.rl = { ...(S.rl || {}), [level.route.id]: !!v }; store.save(); } });
rv.pad = !!S.padMode;
/* 按 ▶ / 打一遍:鼓譜(鼓墊模式連鼓墊)沒露出來就捲過去 */
function revealRoute(pads){
  const el = pads ? $("rPadCard") : $("rScoreCard"); if (!el || el.hidden) return;
  const r = el.getBoundingClientRect(), bar = document.querySelector(".tabbar");
  const bt = bar ? bar.getBoundingClientRect().top : innerHeight, bottom = bt > innerHeight / 2 ? bt : innerHeight;
  if (r.bottom > bottom - 4) window.scrollBy({ top: Math.min(r.bottom - bottom + 8, r.top - 60), behavior: "smooth" });
}
const playOpts = () => ({ click: (dseg && dseg.click) || "every", solo: !!(dseg && dseg.click && dseg.click !== "every") });
$("rModeBtn").onclick = () => setPadMode(true);
$("rKitBtn").onclick = () => setPadMode(false);
$("rPerform").onclick = () => rv.togglePerform(playOpts());
function setPadMode(on){
  stopPlayback();
  S.padMode = !!on; store.save();
  rv.pad = !!on;
  $("quizCard").classList.toggle("pad-mode", !!on && routeOn());
  if (dseg) paintStep(dseg, { status: stepStatus(), passedDone: stepDone });
  if (on) requestAnimationFrame(() => revealRoute(true));
}
let stepDone = false, stepText = null;
/* 段落面板(dailycard.js 畫的;路線段的兩顆按鈕經 createDailyCard 的 acts 放進按鈕列) */
function paintStep(s, o){ dcard.renderStep(s, o); }
const stepStatus = () => stepText || (routeOn() && rv.pad ? () => { const s = dseg; return (s.welcome ? TS("daily.welcome").replace("{b}", s.bpm).replace("♩=", s.level && s.level.time === "12/8" ? "♩.=" : "♩=") + tr("", " ") : "") + tr(...(s.click && s.click !== "every" ? PAD_HINT.solo : PAD_HINT.hint)); } : null);
/* 路線段的標籤:[律動 第 3 關] [♩=68 → 90](現在的實際速度;12/8 寫 ♩.) */
function routeTags(){
  // 時值放在標籤(關卡名稱不放時值括號):[律動 第 1 關] [四分音符] [♩=56 → 80]
  const tags = dcard.segTags({ ...dseg, bpm }), vt = valueOfSeg(dseg);
  if (vt) tags.splice(1, 0, tr(vt[0], vt[1]));
  return tags;   // 12/8 的 ♩.= 由 dailycard 的 mark 處理
}
let vtCache = { k: null, v: null };
function valueOfSeg(s){
  const k = s.level ? s.level.id + ":" + seedOf(s) : null; if (!k) return null;
  if (vtCache.k !== k) { let v = null; try { v = valueTag(toSpec(s.level, seedOf(s)).spec); } catch (e) { console.error(e); } vtCache = { k, v }; }
  return vtCache.v;
}
function paintTags(){ if (dseg && target && target.daily) $("qTags").innerHTML = (dseg.k === "warm" ? dcard.segTags({ ...dseg, bpm }) : routeTags()).map(t => `<span class="q-tag">${t}</span>`).join(""); }
/* 路線段:藏起打法的鼓譜卡、選擇器的選項;顯示鼓組譜卡(鼓墊卡看模式) */
function routeMode(on){
  ROOT.classList.toggle("route-mode", on);
  $("scoreCard").hidden = on || tab === "exam";
  $("quizCard").classList.toggle("pad-mode", on && rv.pad);
  if (!on) rv.hide();
}
/* 這一段的播放(暖身用現有的打法播放):長度 4 小節(中途消失 8 小節);拍點模式不是每拍 = 只有拍點 */
function dailyPlay(){
  if (!dseg || !target || !target.daily || target.route || mockOn()) return null;
  const click = dseg.click || "every", beats = click === "gap" ? 32 : 16;
  return { reps: Math.max(1, Math.ceil(beats * DIV / cycleLength(groups))), click, solo: dseg.k !== "warm" && click !== "every" };
}
/* 同一天同一題(每天不一樣的關):種子 = 日期序數 × 100 + 關卡序號 */
const seedOf = s => dayNum(daily.today().date) * 100 + (s.level ? s.level.n : 0);
/* 顯示一段(暖身 / 路線 / 複習) */
function dShow(s, status = null){
  stopPlayback();
  if (!s) { dExit(); return; }
  dseg = s; dcard.showing = true; stepDone = false; stepText = status;
  ROOT.classList.add("daily-on");   // 段落進行中:練習紀錄卡、速度卡的選項藏起來(app.css)
  if (ctx && ctx.setSubActive) ctx.setSubActive(false, "tech");
  $("picker").hidden = true;
  if (s.k === "warm") {
    routeMode(false);
    const it = s.item;
    target = { daily: s.k, no: it.pas, bpm: it.bpm, pattern: it.value ? { pas: it.pas, sticking: it.sticking, value: it.value } : null };
    setRudiment(it.pas);
  } else {
    target = { daily: s.k, route: true, no: cur ? cur.no : 1, bpm: s.bpm, pattern: null };
    bpm = s.bpm;
    routeMode(true);
    rv.show(s, seedOf(s));
    syncMastery(); renderTitle(); syncTempoUI();
    if (active) fitTitle();
    $("playBtn").disabled = false;
  }
  syncTarget();
  dcard.render(); paintStep(s, { status: stepStatus() });
  announce(tr("今日練習:", "Today: ") + $("qTitle").textContent);
}
/* 離開段落(暫停或今天練完):回到一般的打法畫面 */
function dExit(){
  stopPlayback();
  const wasRoute = routeOn();
  dseg = null; dcard.showing = false;
  ROOT.classList.remove("daily-on");
  if (target && target.daily) target = null;
  routeMode(false);
  if (ctx && ctx.setSubActive) ctx.setSubActive(true, "tech");
  paintStep(null);
  if (tab !== "exam") { $("picker").hidden = false; dcard.render(); if (wasRoute && cur) setRudiment(cur.no); }
}
/* 一次嘗試:自評(穩了 / 再練)或鼓墊的分數 */
function dTry({ self = null, score: sc = null, res = null, at = null } = {}){
  if (!dseg || dseg.k === "warm") return;
  if (self) stopPlayback();
  const s = dseg, r = daily.attempt(res ? { bpm: at || bpm, score: sc } : { bpm, self });
  if (!r) return;
  const head = res ? (res.offsetTooLarge ? () => "" : () => tr(`準度 ${sc} · `, `Accuracy ${sc} · `)) : () => "";
  const txt = () => head() + dcard.resultText(r, s);
  announce(txt());
  if (r.passed && r.cont) { dShow(daily.seg(), txt); return; }
  dseg = daily.seg();
  if (s.k === "route") { bpm = r.nextBpm; target.bpm = bpm; syncTempoUI(); }
  renderTitle(); if (active) fitTitle();
  stepDone = r.passed || s.k === "review"; stepText = txt;
  paintStep(dseg, { status: txt, passedDone: stepDone });
  $("rPerform").hidden = !rv.pad || stepDone;
  dcard.render();
}
/* 下一段:練過的那一段算一次練習 */
function dNext(){
  stopPlayback();
  const t = daily.today(), i = t.i, worked = t.sec[i] > 0 || t.tries[i] > 0;
  const s = daily.next();
  if (worked) { addLog(S.log, { n: 1 }); store.save(); renderLog(); }
  if (s) { dShow(s); return; }
  dExit(); switchTab(tab); window.scrollTo({ top: 0 });
  announce(tr("今天練完了", "Done for today"));
}

/* ── 啟動(外框呼叫)── */
export async function start(c){
  ctx = c; exam = c.exam;
  S.goal = cleanGoal(S.goal);
  renderLog();
  dcard.render();
  replanWarm();
  window.__tech = { daily, dcard, rv, routeOn, dShow, setPadMode, get dseg(){ return dseg; }, dTry, dNext, get target(){ return target; }, get cur(){ return cur; }, get groups(){ return groups; }, get osmd(){ return score.osmd; }, score,
    get state(){ return { play: !!play, starting: !!starting, bpm, scheduled: audio.scheduledCount(), noteXs: score.noteXs.length, landZoom: score.landZoom, lastEnd: { ...lastEnd },
      mock: mock.state, mockStep: mock.data ? mock.data.i : null, mockSteps: mock.data ? mock.data.steps.map(s => s.status) : null }; }, setRudiment, switchTab, setBpm, S,
    startMock, mockNext: () => $("mockNext").click(),
    /* 測試用:模擬考這一項馬上當作跟拍點打完 */
    mockFinishRun(){ if (play && play.mock) { const id = play.mockId, sec = audio.audioNow() - play.real0; stopPlayback(true); audio.stopAll(); if (sec > 0) addPracticeSec(sec, 1); mockRunDone(id); return true; } return false; } };
}
