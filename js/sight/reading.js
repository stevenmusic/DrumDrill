/* 視奏分頁的「認譜」(子項目第一格;照學習順序:認譜 → 節奏 → 律動 → 樂譜)。
   一題一個記號:五線鼓組譜上畫一個鼓件(js/shared/kitnotation.js 的 legendXML + legend.js 的 setupKit / decorate,跟圖例同一套寫法),
   點下面的鼓件格子作答。答對馬上下一題;答錯:標出正確的格子、寫鼓件名稱、播那個鼓聲(Naked Drums 取樣,audio.playKit)。
   設定全部是一直看得到的按鈕(不用下拉、不收起來),點一下就換題:
     快捷鈕(基本:小鼓 / 大鼓 / 手打 HH;筒鼓(只有三個筒鼓);加筒鼓;全套)、自訂(drumkey.json 每個鼓件一顆,開 HH、閉 HH、Cross stick、Ride 碗這種同鼓不同記號也各一顆)、
     模式(練習 / 60 秒 / 連對)
   挑戰、最高分、最常錯的 3 個(下一輪出現機率加倍)在 js/shared/drill.js;設定與紀錄存在 drumdrill.sight.v1 的 read(消毒)。
   都是 App 的練習設定;不寫級數、考試名稱、頁碼 */
import { tr, pairText } from "../shared/i18n.js";
import * as audio from "../shared/audio.js";
import { createDrill } from "../shared/drill.js";
import { legendXML, osmdXML } from "../shared/kitnotation.js";
import { setupKit, decorate } from "../shared/legend.js";

const BASIC = ["snare", "kick", "hh"], TOMS = ["tomHi", "tomMid", "tomFloor"];
const PRESETS = [
  ["basic", "基本", "Basic", () => BASIC],
  ["toms", "筒鼓", "Toms", () => TOMS],
  ["plus", "加筒鼓", "+Toms", () => [...BASIC, ...TOMS]],
  ["all", "全套", "All", key => Object.keys(key.pieces)]
];
const MODES = ["practice", "time", "streak"];

export function cleanRead(o){
  const r = o && typeof o === "object" && !Array.isArray(o) ? o : {};
  return { pieces: Array.isArray(r.pieces) ? r.pieces.filter(x => typeof x === "string").slice(0, 20) : [...BASIC],
    mode: MODES.includes(r.mode) ? r.mode : "practice", best: r.best, miss: r.miss };
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
  async function draw(){
    if (!q || typeof opensheetmusicdisplay === "undefined" || !key()) return;
    const box = $("rdScore");
    if (!osmd) osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, { backend: "svg", autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false,
      drawPartNames: false, drawMeasureNumbers: false, drawingParameters: "compacttight", renderSingleHorizontalStaffline: true });
    try {
      const xml = legendXML(q, { key: key(), lines: 5 });
      setupKit(osmd, 5, xml);
      await osmd.load(osmdXML(xml));
      osmd.zoom = 1.35; osmd.render();
      decorate(osmd, xml, box.querySelector("svg"));
    } catch (e) { console.error(e); }
  }

  function next(){
    clearTimeout(nextTimer); lock = false;
    const list = valid();
    if (list.length < 2) { q = null; $("rdScore").innerHTML = ""; say(() => tr("至少選兩個鼓件。", "Pick at least two drums.")); paintAns(); return; }
    q = drill.pick(list, setting(), Math.random, last); last = q; t0 = performance.now();
    say(() => "");
    paintAns();
    draw();
  }
  function answer(id){
    if (!q || lock || !active) return;
    if (R.mode !== "practice" && !drill.running) return;
    const ok = id === q;
    session.n++; if (ok) session.ok++;
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
    box.style.setProperty("--n", String(Math.min(4, Math.max(2, list.length <= 4 ? list.length : list.length <= 6 ? 3 : 4))));
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
    pairText($("rdNote"), () => tr("自訂:點一下加入或拿掉(至少兩個)。記號跟視奏的圖例同一套;題目與最常錯的加倍出現都是 App 的練習設定。", "Custom: tap to add or remove (two or more). Same symbols as the drum key; the doubled misses are a practice setting."));
  }
  function setText(){
    const k = key(); if (!k) return "";
    const cur = valid().slice().sort().join(","), hit = PRESETS.find(p => p[3](k).slice().sort().join(",") === cur);
    return hit ? `${tr(hit[1], hit[2])}${tr(`(${valid().length} 個鼓件)`, ` (${valid().length} drums)`)}` : tr(`自訂 ${valid().length} 個鼓件`, `Custom: ${valid().length} drums`);
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
      + tr("。下一輪這幾個會多出現(練習設定)。", ". These come up more often next round (practice setting).") : ""));
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
