/* 技巧模組:PAS 40 個基本打法(分頁:滾奏 / 複點 / Flam / Drag),練習面板(題目、鼓譜、速度)照 PianoDrill 的技巧分頁。
   外框(js/main.js)負責頂欄、分頁、考試系統與級數;這裡的元素 id 都加 "t-" 前綴 */
import * as store from "./store.js";
import { RUDIMENTS, CATEGORIES, byNo, withLead, strokes, cycleLength, DIV } from "./rudiments.js";
import { rudimentXML } from "./notation.js";
import { tr, scoped, getLang, pairText } from "../shared/i18n.js";
import * as audio from "../shared/audio.js";
import { createScore } from "../shared/score.js";
import { createTempo } from "../shared/tempo.js";
import { fitLandZoom, createLandPlay } from "../shared/landscape.js";
import "./strings.js";
const T = scoped("tech");

const $ = id => document.getElementById("t-" + id);
const ROOT = document.getElementById("mod-tech");
let active = false, ctx = null, exam = null;
const S = store.load();
let tab = S.cat;            // roll / diddle / flam / drag / exam
let cur = null, groups = null;
let bpm = 60;

/* ══ 外框呼叫 ══ */
/* 換語言:只重寫文字(不停止播放、不重畫鼓譜) */
export function relang(){ relabel(); }
export function setExam(ex){ exam = ex; if (active && tab === "exam") renderExam(); }
/* 進來:同一類、已經有題目就照原樣(回到前景、從別的分頁回來不會重新出題);換了類別或檢定頁才重畫 */
export function enter(t){
  active = true;
  if (t !== tab || t === "exam" || !cur) switchTab(t);
  requestAnimationFrame(onStageResize);
}
/* 離開(切分頁、切到背景):停止播放,題目保留 */
export function leave(){ active = false; stopPlayback(); }
/* 檢定分頁的進度:已經會了幾個(S3 之後改成本級的進度) */
export function examStatus(){
  const n = RUDIMENTS.filter(r => S.mastery[r.no] === "good").length;
  return tr(`已會 ${n}/40`, `${n}/40 known`);
}
export function onKey(e){
  if (e.code === "Space") { e.preventDefault(); $("playBtn").click(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setBpm(bpm + 1, true); }
  else if (e.key === "ArrowDown") { e.preventDefault(); setBpm(bpm - 1, true); }
}

const name = r => tr(r.zh, r.en);
const catOf = id => CATEGORIES.find(c => c.id === id);
const subOf = r => catOf(r.cat).sub.find(s => r.no >= s.from && r.no <= s.to);

/* 換語言時重寫的文字:選擇器、題目、標籤、速度單位、按鈕、紀錄卡;在檢定頁時重畫檢定說明 */
function relabel(){
  if (tab === "exam") renderExam();
  else if (cur) {
    renderPicker(); renderTitle();
    if (active) fitTitle();
  }
  syncTempoUI(); showBest();
  $("playLabel").textContent = play ? T("stop") : starting ? tr("準備中…", "Preparing…") : T("play");
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
  $("picker").hidden = isExam; $("examCard").hidden = !isExam;
  for (const id of ["quizCard", "scoreCard", "metroCard"]) $(id).hidden = isExam;
  if (isExam) { renderExam(); return; }
  S.cat = t; store.save();
  const list = RUDIMENTS.filter(r => r.cat === t);
  const no = S.pick[t] && list.some(r => r.no === S.pick[t]) ? S.pick[t] : list[0].no;
  setRudiment(no);
}

/* ══ 選擇器:這一類的打法(號碼 + 名稱)、起手、反覆次數 ══ */
function renderPicker(){
  const list = RUDIMENTS.filter(r => r.cat === tab);
  const rows = [
    ["no", T("lblRud"), list.map(r => [r.no, `<b>${r.no}</b><span>${name(r)}</span>`])],
    cur.second && ["lead", T("lblLead"), [["R", tr("右手先", "Right")], ["L", tr("左手先", "Left")]]],
    ["reps", T("lblReps"), [1, 2, 4, 8].map(n => [n, "×" + n])]
  ].filter(Boolean);
  const val = { no: cur.no, lead: S.lead, reps: S.reps };
  $("picker").querySelector(".rows").innerHTML = rows.map(([k, lbl, opts]) =>
    `<div class="prow"><span class="lbl">${lbl}</span><div class="opts" data-k="${k}">` +
    opts.map(([v, t]) => `<button class="opt${k === "no" ? " rud" : ""}" data-v="${v}" aria-pressed="${String(v) === String(val[k])}">${t}</button>`).join("") + `</div></div>`).join("");
  $("picker").querySelector(".sum").textContent = [`${cur.no}. ${name(cur)}`, cur.second ? (S.lead === "L" ? tr("左手先", "Left lead") : tr("右手先", "Right lead")) : "", "×" + S.reps].filter(Boolean).join(" · ");
}
$("picker").querySelector(".rows").onclick = e => {
  const b = e.target.closest(".opt"); if (!b) return;
  const k = b.closest(".opts").dataset.k, v = b.dataset.v;
  if (k === "no") { S.pick[tab] = Number(v); store.save(); setRudiment(Number(v)); return; }
  if (k === "lead") S.lead = v;
  if (k === "reps") S.reps = Number(v);
  store.save();
  setRudiment(cur.no);
};

/* ══ 題目 ══ */
function setRudiment(no){
  stopPlayback();
  cur = byNo(no);
  groups = withLead(cur, S.lead);
  renderPicker();
  renderTitle();
  showBest();
  fitTitle();
  $("playBtn").disabled = false;
  syncMastery();
  bpm = S.bpm[cur.no] || 60;
  syncTempoUI();
  renderScore();
  preloadSamples();
}

function renderTitle(){
  $("qTitle").textContent = `${cur.no}. ${name(cur)}`;
  // 中英文標籤數量一樣(版面才會一樣):中文 = 英文名,英文 = PAS 編號;左手先/右手先另加一個。
  // 類別不放(上面分段鈕已經看得到,放了標籤列會擠不下)。英文名太長時縮成「…」;示範最快的速度放在速度卡
  const tags = [getLang() === "en" ? "PAS No. " + cur.no : cur.en,
    cur.second ? (S.lead === "L" ? tr("左手先", "Left lead") : tr("右手先", "Right lead")) : null].filter(Boolean);
  $("qTags").innerHTML = tags.map((t, i) => `<span class="q-tag${i ? "" : " fold"}" title="${t}">${t}</span>`).join("");
}

/* ══ 已經會了 / 待加強(只是標記,不算一次練習)══ */
function syncMastery(){
  const m = cur && S.mastery[cur.no];
  ROOT.querySelectorAll(".mbtn").forEach(b => { b.disabled = !cur; b.setAttribute("aria-pressed", String(b.dataset.m === m)); });
}
ROOT.querySelectorAll(".mbtn").forEach(b => b.onclick = () => {
  if (!cur) return;
  const m = b.dataset.m;
  if (S.mastery[cur.no] === m) delete S.mastery[cur.no]; else S.mastery[cur.no] = m;
  store.save(); syncMastery();
  if (ctx) ctx.examChanged();   // 檢定分頁「已會 n/40」
});

/* ══ 檢定分頁:本級要求(還沒照官方大綱整理之前,只說明還沒有,不自己編) ══ */
function renderExam(){
  const ex = exam || { system: "trinity", grade: 1 };
  const sys = ex.system === "rsl" ? "RSL Rockschool Drums" : "Trinity Rock & Pop Drums";
  $("examTitle").textContent = `${sys} · ${ctx.gradeLabel(ex.grade, ex.system)}`;
  pairText($("examText"), () => tr(
    "這一級的技巧要求(基本打法、節奏型、過門)還在照官方大綱逐頁核對,核對完才會放上來,不會先用猜的。在那之前,可以先到「技巧」分頁練 PAS 40 個基本打法。",
    "This grade's technical requirements (rudiments, grooves, fills) are still being checked page by page against the official syllabus and will appear once verified. Until then, practise the 40 PAS rudiments in Technique."));
}

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
  fitLand: () => fitLandZoom(score, { $ })
});
function renderScore(){ if (cur) score.load(rudimentXML(groups, { reps: S.reps, title: cur.en })); }

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
  if (!cur) return;
  score.onResize();
};
window.addEventListener("resize", onStageResize);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => requestAnimationFrame(onStageResize)).observe($("stage"));

/* ══ 速度(♩ = 每分鐘幾拍;js/shared/tempo.js)══ */
const MIN_BPM = 30, MAX_BPM = 240;
const tempo = createTempo({ $, min: MIN_BPM, max: MAX_BPM, get: () => bpm, set: v => setBpm(v, true) });
function syncTempoUI(){
  tempo.sync(`♩ / ${tr("分", "min")}`);
  $("examTempo").textContent = tr("由慢到快、再由快到慢(PAS:open – close – open)", "Slow to fast to slow (PAS: open – close – open)");
  const beats = Math.max(1, Math.round(cycleLength(groups || [[{ dur: 4 * DIV }]]) / DIV));
  tempo.setBeats(Math.min(8, beats));
}
function setBpm(v, fromUser){
  bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
  if (fromUser && cur) { S.bpm[cur.no] = bpm; store.save(); }
  syncTempoUI(); retempo();
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
const VEL = { accent: 0.95, tap: 0.6, roll: 0.55, buzz: 0.5, grace: 0.3 };
let play = null, starting = 0;
function schedulePlay(p, from){
  const { t0, beatSec, reps, cyc } = p;
  const gap = Math.min(0.032, beatSec / 10);   // 裝飾音在主音前面多久(慢速時 32ms,快速時跟著縮短)
  if (!S.clickOnly) for (let rep = 0; rep < reps; rep++) for (const s of p.list) {
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
    if (at >= from) audio.playClick(at, b < 0 ? b === -COUNT_IN : (b * DIV) % cyc === 0);
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
    $("playLabel").textContent = T("play");
    setMsg("loadingMsg", () => tr("播放失敗:", "Playback failed: ") + (e && e.message || e));
  }
  if (r === "failed") land.release();
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
  if (starting !== token || cur !== r0) { if (starting === token) { starting = 0; $("playLabel").textContent = T("play"); } $("playBtn").classList.remove("busy"); return "busy"; }
  starting = 0; $("playBtn").classList.remove("busy");
  if (!loaded) { $("playLabel").textContent = T("play"); return "failed"; }
  const beatSec = 60 / bpm, cyc = cycleLength(groups), reps = S.reps;
  // 雙擊的第二下標記出來(播放時輕一點)
  const list = strokes(groups).map((s, i, a) => (s.kind === "roll" && !s.first && a[i - 1] && a[i - 1].kind === "roll" && a[i - 1].hand === s.hand && !a[i - 1].second ? { ...s, second: true } : s));
  const t0 = actx.currentTime + 0.15 + COUNT_IN * beatSec;
  play = { t0, real0: t0, beatSec, reps, cyc, list, raf: 0, endBeat: reps * cyc / DIV };
  schedulePlay(play, -Infinity);
  revealScore();
  $("playLabel").textContent = T("stop");
  $("playIcon").innerHTML = '<rect x="6" y="6" width="12" height="12" rx="1.5"/>';
  const tick = () => {
    if (!play) return;
    const beat = (audio.audioNow() - play.t0) / play.beatSec;
    tempo.showBeat(beat, COUNT_IN);
    const len = play.cyc / DIV;
    score.movePlayline(beat < 0 ? 0 : beat >= play.endBeat ? len : beat % len, true);
    if (beat > play.endBeat + 0.3) {
      const sec = play.endBeat * play.beatSec;
      lastEnd = { n: lastEnd.n + 1, scheduled: audio.scheduledCount(), at: audio.audioNow() };   // 測試用:自然播完時還排著的節點數(播完的會自己移除)與當時的時間
      stopPlayback(true, !!(S.loop && cur));   // 循環的下一輪:手機橫式不捲回去
      logPractice(sec);
      if (!S.clickOnly && (!S.best[cur.no] || bpm > S.best[cur.no])) { S.best[cur.no] = bpm; store.save(); showBest(); }
      if (S.loop && cur) { if (S.ramp) setBpm(bpm + 4, true); startPlayback(); }
      return;
    }
    play.raf = requestAnimationFrame(tick);
  };
  play.raf = requestAnimationFrame(tick);
  return "started";
}
let lastEnd = { n: 0, scheduled: 0, at: 0 };
function showBest(){ const b = cur && S.best[cur.no]; $("bestTempo").textContent = b ? `${T("bestLabel")} ♩=${b}` : ""; }
function stopPlayback(natural, keepView){
  starting = 0; $("playBtn").classList.remove("busy");
  land.release(keepView);   // 手機橫式:播完(或停止)捲回播放前的位置、縮回;循環的下一輪不捲
  if (play) {
    cancelAnimationFrame(play.raf);
    // 中途停止(按停止、換題、切分頁、切到背景):已經播的秒數算進今天的練習時間,次數不加
    if (!natural) { const sec = audio.audioNow() - play.real0; if (sec >= 0.5) addPracticeSec(sec); }
    play = null;
    if (!natural) audio.stopAll();
  }
  score.home();
  $("playLabel").textContent = T("play");
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
$("playBtn").onclick = () => { if (play) stopPlayback(); else if (!starting) startPlayback(); };
function syncPlayOpts(){
  $("optLoop").setAttribute("aria-pressed", String(!!S.loop));
  $("optRamp").setAttribute("aria-pressed", String(!!S.ramp));
  $("optRamp").disabled = !S.loop;
  $("optClick").setAttribute("aria-pressed", String(!!S.clickOnly));
}
for (const [id, k] of [["optLoop", "loop"], ["optRamp", "ramp"], ["optClick", "clickOnly"]]) $(id).onclick = () => { S[k] = !S[k]; store.save(); syncPlayOpts(); };
syncPlayOpts();

/* ══ 練習紀錄:示範完整播完算一次;中途停止只加秒數(熟練標記不算練習)══ */
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function logPractice(sec){ addPracticeSec(sec, 1); }
function addPracticeSec(sec, n = 0){
  const k = dayKey(new Date()), e = S.log[k] || (S.log[k] = { n: 0, sec: 0 });
  e.n += n; e.sec += Math.round(sec || 0);
  const keys = Object.keys(S.log).sort();
  while (keys.length > 400) delete S.log[keys.shift()];
  store.save(); renderLog();
}
function renderLog(){
  const log = S.log || {}, today = new Date();
  let streak = 0, d = new Date(today);
  if (!(log[dayKey(d)] && log[dayKey(d)].n)) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)] && log[dayKey(d)].n) { streak++; d.setDate(d.getDate() - 1); }
  const t = log[dayKey(today)] || { n: 0, sec: 0 };
  $("logStreak").textContent = streak; $("logToday").textContent = t.n; $("logMin").textContent = Math.round(t.sec / 60);
  const names = getLang() === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["日", "一", "二", "三", "四", "五", "六"];
  let html = "";
  for (let i = 6; i >= 0; i--) {
    const x = new Date(today); x.setDate(x.getDate() - i);
    const e = log[dayKey(x)];
    html += `<span class="${i === 0 ? "today" : ""}"><i class="${e && e.n ? "on" : ""}"></i>${names[x.getDay()]}</span>`;
  }
  $("logWeek").innerHTML = html;
}

/* ── 啟動(外框呼叫)── */
export async function start(c){
  ctx = c; exam = c.exam;
  renderLog();
  window.__tech = { get cur(){ return cur; }, get groups(){ return groups; }, get osmd(){ return score.osmd; }, score,
    get state(){ return { play: !!play, starting: !!starting, bpm, scheduled: audio.scheduledCount(), noteXs: score.noteXs.length, landZoom: score.landZoom, lastEnd: { ...lastEnd } }; }, setRudiment, switchTab, setBpm, S };
}
