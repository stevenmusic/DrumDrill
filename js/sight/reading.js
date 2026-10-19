/* 視奏分頁的「認譜」(子項目第一格;照學習順序:認譜 → 節奏 → 律動 → 樂譜)。
   一題一個記號:五線鼓組譜上畫一個鼓件(js/shared/kitnotation.js 的 legendXML + legend.js 的 setupKit / decorate,跟圖例同一套寫法),
   點下面的鼓件格子作答。答對馬上下一題;答錯:標出正確的格子、寫鼓件名稱、播那個鼓聲(Naked Drums 取樣,audio.playKit)。
   設定全部是一直看得到的按鈕(不用下拉、不收起來),點一下就換題:
     快捷鈕照學習順序、名稱直接寫內容,每一格包含前一格(1 小鼓 大鼓 Hi-hat → 2 + Toms(Tom 1、Tom 2、落地鼓)→ 3 + 鈸(Ride、Crash)→ 4 全部記號);
     存的是鼓件清單(不是快捷的名字),舊版的「基本 / 加筒鼓 / 全套」讀進來剛好等於 1 / 2 / 4,「只有筒鼓」變成自訂三個 Toms;
     自訂(drumkey.json 每個鼓件一顆,開 Hi-hat、關 Hi-hat、Cross stick、Ride bell 這種同鼓不同記號也各一顆)、
     模式(練習 / 60 秒 / 連對)
   挑戰、最高分、最常錯的 3 個(下一輪出現機率加倍)在 js/shared/drill.js;設定與紀錄存在 drumdrill.sight.v1 的 read(消毒)。
   都是 App 的練習設定;不寫級數、考試名稱、頁碼 */
import { tr, pairText } from "../shared/i18n.js";
import * as audio from "../shared/audio.js";
import { createDrill } from "../shared/drill.js";
import { legendXML, osmdXML } from "../shared/kitnotation.js";
import { setupKit, decorate } from "../shared/legend.js";
import { frameStaff } from "../shared/staffframe.js";

const BASIC = ["snare", "kick", "hh"], TOMS = ["tomHi", "tomMid", "tomFloor"];
const CYMBALS = ["ride", "crash"];
const PRESETS = [
  ["core", "小鼓 大鼓 Hi-hat", "Snare Kick Hi-hat", () => BASIC],
  ["toms", "+ Toms", "+ Toms", () => [...BASIC, ...TOMS]],
  ["cym", "+ 鈸", "+ Cymbals", () => [...BASIC, ...TOMS, ...CYMBALS]],
  ["all", "全部記號", "All marks", key => Object.keys(key.pieces)]
];
const MODES = ["practice", "time", "streak"];

export function cleanRead(o){
  const r = o && typeof o === "object" && !Array.isArray(o) ? o : {};
  return { pieces: Array.isArray(r.pieces) ? r.pieces.filter(x => typeof x === "string").slice(0, 20) : [...BASIC],
    mode: MODES.includes(r.mode) ? r.mode : "practice", best: r.best, miss: r.miss,
    seen: r.seen === true };   // 答過一題:題目那行不再寫第一次的說明
}

export function createReading({ $, store, save, drumKey, onAnswered = () => {} }){
  const R = store;
  const drill = createDrill({ store: R, save, onEnd: res => showEnd(res) });
  let osmd = null, q = null, last = null, active = false, lock = false, nextTimer = 0, session = { ok: 0, n: 0 }, endRes = null, t0 = 0, wrongName = null, msgFn = null;
  const key = () => drumKey();
  const valid = () => { const k = key(); return k ? R.pieces.filter(p => k.pieces[p]) : []; };
  const setting = () => valid().slice().sort().join(",");
  const nameOf = id => { const p = key() && key().pieces[id]; return p ? tr(p.name[0], p.name[1]) : id; };
  const order = () => Object.keys(key() ? key().pieces : {});

  /* ── 畫一個記號(跟圖例同一套;放大、留譜號)── */
  let drawSeq = 0;
  async function draw(){
    if (!q || typeof opensheetmusicdisplay === "undefined" || !key()) return;
    const box = $("rdScore");
    if (!osmd) osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false,
      drawPartNames: false, drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true });
    const my = ++drawSeq;
    try {
      const xml = legendXML(q, { key: key(), lines: 5 });
      setupKit(osmd, 5, xml);
      await osmd.load(osmdXML(xml));
      if (my !== drawSeq) return;   // 載入中又換了題目:交給新的那一次畫
      osmd.zoom = 1; osmd.render();
      decorate(osmd, xml, box.querySelector("svg"));
      fit();
    } catch (e) { console.error(e); }
  }
  /* 譜框:不管出哪個鼓件(上面的 Crash、下面的腳踩 HH),框的高度與譜表位置都不變;上面留 5.8 間距(Crash 的加線 + 朝上的符桿)、下面 4.5(實測全套 60 題最多 5.79 / 4.43;js/shared/staffframe.js) */
  function fit(){
    const box = $("rdScore"), svg = box.querySelector("svg");
    if (!svg || !box.clientWidth) return;
    const land = matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
    // 直式矮畫面(折疊機、SE):譜框小一點,第一個畫面連作答格子(+ Toms 兩排)下面的鼓件快捷都看得到(tools/test/tasks.mjs 檢查)
    const maxH = land ? Math.max(130, innerHeight - 200) : innerHeight <= 700 ? Math.max(110, Math.round(innerHeight * 0.2)) : Math.max(150, Math.min(220, innerHeight * 0.26));
    frameStaff(svg, box, { key: "kit", above: 5.8, below: 4.5, spPx: 12, maxH });
  }
  let lastW = innerWidth, rzT = 0;
  addEventListener("resize", () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rzT); rzT = setTimeout(() => { if (active) fit(); }, 150); });

  function next(){
    clearTimeout(nextTimer); lock = false;
    const list = valid();
    if (list.length < 2) { q = null; $("rdScore").innerHTML = ""; say(() => tr("至少選兩個鼓件。", "Pick at least two drums.")); paintAns(); return; }
    q = drill.pick(list, setting(), Math.random, last); last = q; t0 = performance.now();
    // 譜和作答格子之間這一行不空著:平常寫題目,答了寫對錯
    // 60 秒 / 連對還沒開始:不寫題目(先按「開始」)
    // 第一次(還沒答過):寫這一格在練什麼、怎麼作答
    say(() => (R.mode === "practice" || drill.running ? (R.seen ? tr("哪個鼓件?", "Which drum?") : tr("看記號,點出是哪個鼓", "Read the mark, tap the drum")) : ""));
    paintAns();
    draw();
  }
  function answer(id){
    if (!q || lock || !active) return;
    if (R.mode !== "practice" && !drill.running) return;
    const ok = id === q;
    session.n++; if (ok) session.ok++;
    if (!R.seen) { R.seen = true; save(); }
    onAnswered((performance.now() - t0) / 1000);
    lock = true;
    wrongName = ok ? null : q;
    paintAns(id, ok);
    if (ok) say(() => tr("對了", "Right"), "ok");
    else { const t = q; say(() => tr(`答案是${nameOf(t)}`, `It was ${nameOf(t)}`), "no"); play(t); }
    const res = drill.answer(setting(), q, id, ok);
    paintTop(); paintMiss();
    if (res) return;
    if (R.mode !== "practice" && !drill.running) return;
    nextTimer = setTimeout(() => { if (active) next(); }, ok ? 450 : 1500);
  }
  async function play(piece){
    try {
      const ctx = audio.ensureAudio();
      if (ctx.state !== "running") await ctx.resume().catch(() => {});
      await audio.loadKit([piece]);
      audio.playKit(piece, audio.audioNow() + 0.02, 0.8);
    } catch (e) { /* 取樣載不到就不出聲 */ }
  }
  function say(fn, cls = ""){ msgFn = fn; const el = $("rdMsg"); el.classList.remove("ok", "no"); if (cls) el.classList.add(cls); pairText(el, fn); }

  /* ── 作答:這一輪的鼓件格子(照圖例的順序)── */
  function paintAns(tapped = null, ok = null){
    const box = $("rdAns"), list = valid().sort((a, b) => order().indexOf(a) - order().indexOf(b));
    const sig = list.join(",");
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = list.map(id => `<button type="button" class="opt rd-ans" data-v="${id}"></button>`).join("");
    }
    const n = Math.min(4, Math.max(2, list.length <= 4 ? list.length : list.length <= 6 ? 3 : 4));
    box.style.setProperty("--n", String(n)); box.dataset.n = String(n);   // 4 欄(全部記號)在折疊機上也是 4 欄,字可以換行
    for (const b of box.children) {
      b.textContent = nameOf(b.dataset.v);
      b.classList.toggle("wrong", tapped != null && ok === false && b.dataset.v === tapped);
      b.classList.toggle("right", tapped != null && b.dataset.v === q);
    }
  }

  /* ── 設定(一直看得到的按鈕)── */
  function paintOpts(){
    const k = key(); if (!k) return;
    const cur = valid().slice().sort().join(","), hit = PRESETS.find(p => p[3](k).slice().sort().join(",") === cur);
    $("rdQuick").innerHTML = PRESETS.map(([v, zh, en]) => `<button type="button" class="opt" data-v="${v}" aria-pressed="${!!hit && hit[0] === v}">${tr(zh, en)}</button>`).join("");
    $("rdPieces").innerHTML = order().map(id => `<button type="button" class="opt" data-v="${id}" aria-pressed="${R.pieces.includes(id)}">${nameOf(id)}</button>`).join("");
    $("rdMode").innerHTML = [["practice", "練習", "Practice"], ["time", "60 秒", "60 s"], ["streak", "連對", "Streak"]]
      .map(([v, zh, en]) => `<button type="button" class="opt" data-v="${v}" aria-pressed="${R.mode === v}">${tr(zh, en)}</button>`).join("");
    for (const [id, zh, en] of [["rdQuickLbl", "鼓件", "Drums"], ["rdPiecesLbl", "自訂", "Custom"], ["rdModeLbl", "模式", "Mode"]]) $(id).textContent = tr(zh, en);
    pairText($("rdQuickHint"), () => tr("每一格都包含前一格的鼓件", "Each one adds to the one before"));
    pairText($("rdNote"), () => tr("自訂:點一下加入或拿掉(至少兩個)", "Custom: tap to add or remove (two or more)"));
  }
  function setText(){
    const k = key(); if (!k) return "";
    const cur = valid().slice().sort().join(","), hit = PRESETS.find(p => p[3](k).slice().sort().join(",") === cur);
    const n = valid().length;
    // 快捷的名字已經亮在下面的按鈕上:標題只寫幾個鼓件(自訂才寫「自訂 ·」)
    return `${hit ? "" : tr("自訂 · ", "Custom · ")}${tr(`${n} 個鼓件`, `${n} drums`)}`;
  }
  function paintTop(){
    pairText($("rdSet"), setText);
    const run = drill.running, m = R.mode;
    let s = "";
    if (m === "practice") s = session.n ? tr(`答對 ${session.ok} / ${session.n}`, `${session.ok} / ${session.n} right`) : "";
    else if (run) s = m === "time" ? tr(`${drill.score} 題 · 剩 ${drill.left()} 秒`, `${drill.score} · ${drill.left()} s left`) : tr(`連對 ${drill.score}`, `Streak ${drill.score}`);
    else s = tr(`最高 ${drill.best(setting(), m)}`, `Best ${drill.best(setting(), m)}`);
    $("rdScoreTxt").textContent = s;
    const waiting = m !== "practice" && !run;
    $("rdStart").hidden = !waiting;
    $("rdAns").classList.toggle("idle", waiting);
    if (waiting) $("rdStartLbl").textContent = endRes ? tr("再挑戰一次", "Try again") : m === "time" ? tr("開始 60 秒挑戰", "Start 60 s challenge") : tr("開始連對挑戰", "Start streak challenge");
  }
  function paintMiss(){
    const t = drill.top(setting());
    pairText($("rdMiss"), () => (t.length ? tr("最常錯:", "Most missed: ") + t.map(x => tr(`把${nameOf(x.target)}看成${nameOf(x.answer)}(${x.n} 次)`, `${nameOf(x.target)} read as ${nameOf(x.answer)} (${x.n}×)`)).join(tr(";", "; "))
      + tr("。下一輪這幾個會多出現。", ". These come up more often next round.") : ""));
  }
  function showEnd(res){
    endRes = res; clearTimeout(nextTimer); lock = true;
    if (res.reason === "stop" || res.reason === "restart") { paintTop(); return; }
    const wn = res.reason === "wrong" ? wrongName : null;
    say(() => (wn ? tr(`答案是${nameOf(wn)}。`, `It was ${nameOf(wn)}. `) : "") + (res.kind === "time" ? tr(`時間到:答對 ${res.score} 題`, `Time's up: ${res.score} right`) : tr(`連對 ${res.score} 題`, `Streak: ${res.score}`))
      + (res.newBest ? tr(" · 新紀錄!", " · New best!") : tr(` · 最高 ${res.best}`, ` · best ${res.best}`)), res.newBest ? "ok" : "");
    paintTop(); paintMiss();
  }
  function changed(){
    if (drill.running) drill.stop();
    endRes = null; session = { ok: 0, n: 0 };
    save(); paintOpts(); paintTop(); paintMiss(); next();
  }
  const segClick = (id, fn) => $(id).addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) fn(b.dataset.v); });
  segClick("rdQuick", v => { const p = PRESETS.find(x => x[0] === v); if (p && key()) { R.pieces = p[3](key()).slice(); changed(); } });
  segClick("rdPieces", v => {
    const on = R.pieces.includes(v);
    if (on && valid().length <= 2) { say(() => tr("至少選兩個鼓件。", "Pick at least two drums.")); return; }
    R.pieces = on ? R.pieces.filter(x => x !== v) : [...R.pieces, v];
    changed();
  });
  // 換成挑戰模式:把題目卡捲到畫面上(「開始挑戰」的大按鈕在譜上)
  segClick("rdMode", v => { R.mode = v; changed(); if (v !== "practice") toTop($("rdCard")); });
  function toTop(card){
    const r = card.getBoundingClientRect(), head = document.querySelector("header"), top = head ? head.getBoundingClientRect().bottom : 0;
    if (r.top < top || r.bottom > innerHeight - 60) window.scrollTo({ top: Math.max(0, scrollY + r.top - top - 8) });
  }
  segClick("rdAns", v => answer(v));
  $("rdStart").onclick = () => { endRes = null; session = { ok: 0, n: 0 }; drill.start(R.mode, setting(), () => paintTop()); paintTop(); next(); };

  return {
    enter(){ active = true; paintOpts(); paintTop(); paintMiss(); if (!q || !valid().includes(q)) next(); else { paintAns(); draw(); } },
    leave(){ active = false; clearTimeout(nextTimer); if (drill.running) drill.stop(); },
    relang(){ paintOpts(); paintTop(); paintMiss(); paintAns(); if (msgFn) say(msgFn); },
    get state(){ return { q, mode: R.mode, running: drill.running, score: drill.score, session: { ...session }, setting: setting() }; },
    answer, next
  };
}
