/* 今日練習的路線段(律動 / 過門 / 複習):鼓組譜 + 圖例 + 左右手、▶ 示範(整組鼓 + 拍點,一直循環到停止)、手機鼓墊「打一遍」與評分。
   DrumDrill 自己的(技巧模組用;元素 id 用模組的 $,前綴 t-):
     #t-rScoreCard(#t-rStage / #t-rScroll / #t-rOsmd / #t-rPlayline / #t-rPaperMsg、#t-rLegend、#t-rlBtn「標示左右手」)
     #t-rPadCard(#t-rPads 三個鼓墊、#t-rPadNote、#t-rResult、#t-rKitBtn 改回在鼓上打)、題目卡裡的 #t-rMode(「沒有鼓?用手機鼓墊」/ #t-rPerform 打一遍)
   - 譜:routespec.js 的 toSpec → kitnotation scoreXML → score.js(一整行 + 播放軸);legend.js 的 setupKit / decorate / drawLegend(plain:自由練習不寫出處)
   - 左右手:手打的每個音下面 R / L(routespec 的 hand;和弦上下疊);腳不標。關卡的 rl 預設,題目卡的開關每條路線記住
   - 示範:player.js + kitevents;拍點照拍點模式(daily.js 的 clickPlays;每 4 拍一小節,12/8 = 附點四分一拍);拍點模式不是每拍 = 只有拍點(自己打)
   - 鼓墊:pad.js(LANES[3]:鈸 / 鼓 / 大鼓與腳踩 Hi-hat)、timing.scoreLanes;預備拍 1 小節 → 4 小節(拍點中途消失 8 小節)只有拍點
   - 整組鼓:audio.loadKit(這一關用到的鼓件 + 鼓墊的聲音);被釋放("kit unloaded")靜靜重新載 */
import * as audio from "../shared/audio.js";
import { createPlayer } from "../shared/player.js";
import { createScore } from "../shared/score.js";
import { createPads, showKeys } from "../shared/pad.js";
import { LANES, expectedByLane, scoreLanes, offsetNote, laneNote } from "../shared/timing.js";
import { scoreXML, osmdXML } from "../shared/kitnotation.js";
import { hitsOnly, repeatEvents } from "../shared/kitevents.js";
import { setupKit, decorate, drawLegend, graphicalNotes, headBox } from "../shared/legend.js";
import { describeSpec, announce } from "../shared/a11y.js";
import { clickPlays } from "../shared/daily.js";
import { tr, pairText } from "../shared/i18n.js";
import { toSpec, eventsOf, handsOf } from "./routespec.js";

const NS = "http://www.w3.org/2000/svg";
const DEMO_SEC = 150;   // 示範一直循環:最多這麼久自己停(練習設定)

export function createRouteView({ $, tempo, drumKey, getBpm, isActive, addSec, onResult, onPlayState, onLoad, rlFor, setRl }){
  const $r = id => $("r" + id[0].toUpperCase() + id.slice(1));
  let cur = null;      // { seg, level, r(toSpec 的結果), xml, key }
  let mode = null;     // "demo" | "perform" | null
  let run = null;      // 這一次播放:{ t0, startedAt, unit, pulseU, qbpm, cycleU, lenU, taps }
  let pad = false, active = true, kitJob = null, loadingP = null;

  /* ── 譜 ── */
  /* 縮放:平常照畫面寬度;整份(2 或 4 小節)放不下紙張寬度時縮到放得下(最小 0.5,再小就左右捲) */
  let fitZ = null, fitW = 0;
  const zoom = () => Math.min(window.innerWidth < 600 ? 0.9 : window.innerWidth < 1100 ? 1 : 1.15, fitZ || Infinity);
  function fitOnce(){
    const svg = $r("osmd").querySelector("svg"), avail = $r("stage").clientWidth - 16;
    if (!svg || !avail || !score.osmd) return;
    fitW = $r("stage").clientWidth;
    const w = svg.getBoundingClientRect().width;
    if (w > avail + 1) { fitZ = Math.max(0.45, score.osmd.zoom * avail * 0.97 / w); score.refit(); }
  }
  const score = createScore({
    $: $r, zoom,
    setup: osmd => setupKit(osmd, 5, cur ? cur.xml : ""),
    afterRender: svg => { if (cur && score.osmd && svg) { decorate(score.osmd, cur.xml, svg); drawHands(svg); } },
    lenBeats: () => (cur ? cur.r.lenBeats : null),
    playing: () => !!mode,
    isActive: () => active && isActive() && !$("rScoreCard").hidden,
    label: () => (cur ? describeSpec(cur.r.spec, { key: cur.key, bpm: getBpm(), title: tr(cur.level.name[0], cur.level.name[1]) }) + (rlOn() ? tr(";手的音下面標 R / L", "; R / L under the hand notes") : "") : "")
  });
  const rlOn = () => !!cur && rlFor(cur.level);
  /* 手打的音下面寫 R / L(和弦上下疊:鈸在上);字放在所有音符、符桿、連桿的下面 */
  function drawHands(svg){
    svg.querySelectorAll(".rt-hand").forEach(e => e.remove());
    if (!rlOn() || !score.osmd) return;
    const hs = handsOf(cur.r.spec, cur.key), gns = graphicalNotes(score.osmd).filter(g => g.voice === 1);
    let bottom = -Infinity, sp = 10;
    svg.querySelectorAll(".vf-stavenote, .vf-beam, .vf-stem").forEach(g => { const b = g.getBBox(); if (b.height) bottom = Math.max(bottom, b.y + b.height); });
    if (!isFinite(bottom)) return;
    const h0 = svg.querySelector(".vf-notehead"); if (h0) sp = h0.getBBox().height || sp;
    const fs = sp * 1.45, cols = new Map();
    for (const h of hs) {
      const g = gns.find(x => x.mi === h.mi && x.t === h.t && x.k === h.k), hb = g && headBox(g.gn);
      if (!hb) continue;
      const key = h.mi + ":" + h.t, col = cols.get(key) || { x: hb.head.x + hb.head.width / 2, hands: [] };
      col.hands.push([h.k, h.hand]); cols.set(key, col);
    }
    const frag = document.createDocumentFragment();
    for (const col of cols.values()) {
      const list = [...new Set(col.hands.sort((a, b) => b[0] - a[0]).map(x => x[1]))];   // 高的(鈸)在上
      list.forEach((hand, i) => {
        const el = document.createElementNS(NS, "text");
        el.setAttribute("x", col.x); el.setAttribute("y", bottom + fs * (1.1 + i * 1.05)); el.setAttribute("text-anchor", "middle");
        el.setAttribute("font-family", "Arial, Helvetica, sans-serif"); el.setAttribute("font-weight", "700"); el.setAttribute("font-size", fs);
        el.setAttribute("class", "rt-hand dd-stick"); el.textContent = hand;
        frag.appendChild(el);
      });
    }
    svg.appendChild(frag);
    const vb = svg.viewBox.baseVal, bb = svg.getBBox();
    if (vb && vb.height) {
      const k = parseFloat(svg.getAttribute("height")) / vb.height, y1 = Math.max(vb.y + vb.height, bb.y + bb.height + 6);
      if (y1 > vb.y + vb.height) { svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${y1 - vb.y}`); svg.setAttribute("height", (y1 - vb.y) * k); }
    }
  }
  function syncRlBtn(){
    const b = $("rlBtn"); if (!b) return;
    b.setAttribute("aria-pressed", String(rlOn()));
    b.textContent = tr("標示左右手", "Show R / L");
  }
  $("rlBtn").onclick = () => { if (!cur) return; setRl(cur.level, !rlOn()); syncRlBtn(); if (score.osmd) score.render(); };

  /* 顯示一關(seed:同一天同一題) */
  async function show(seg, seed){
    stop();
    const key = await drumKey();
    if (!key) { $("rPaperMsg").textContent = tr("鼓譜資料還沒載好(第一次要連網路)", "Drum key not loaded yet (needs internet once)"); return; }
    const level = seg.level, r = toSpec(level, seed, { key }), xml = scoreXML(r.spec);
    cur = { seg, level, r, xml, key, seed };
    $("rScoreCard").hidden = false;
    $("rResult").hidden = true; $("rResult").innerHTML = "";
    syncRlBtn(); syncPadUI();
    if (score.osmd) setupKit(score.osmd, 5, xml);
    fitZ = null;
    score.load(osmdXML(xml)).then(done => { if (done && cur && cur.xml === xml) fitOnce(); });
    drawLegend($("rLegend"), { pieces: r.pieces, lines: 5, key, plain: true }).catch(e => console.error(e));
    preload();
  }
  function hide(){ stop(); cur = null; $("rScoreCard").hidden = true; $("rPadCard").hidden = true; $("rMode").hidden = true; }

  /* ── 整組鼓 ── */
  const padPiece = () => ({ cym: cur && cur.r.pieces.includes("ride") && !cur.r.pieces.includes("hh") ? "ride" : "hh", drum: "snare", foot: "kick" });
  function preload(){
    if (!cur) return Promise.resolve(false);
    const pieces = [...new Set([...cur.r.pieces, "hh", "snare", "kick"])];
    const job = kitJob = (async () => {
      try {
        await audio.loadKit(pieces, p => { if (kitJob === job) { loadingP = p < 1 ? p : null; onLoad(loadingP); } });
        await audio.loadClick();
        if (kitJob === job) { loadingP = null; onLoad(null); }
        return true;
      } catch (e) {
        if (e && e.message === "kit unloaded") { if (kitJob === job && active) return preload(); return false; }
        console.error(e);
        if (kitJob === job) { loadingP = null; onLoad(null, true); }
        return false;
      }
    })();
    return job;
  }
  const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

  /* ── 播放 ── */
  const player = createPlayer({
    onTick: u => {
      if (!run) return;
      const q = u * run.unit, pulse = u / run.pulseU;
      tempo.showBeat(pulse < 0 ? pulse : pulse % 4, 4);
      if (score.osmd) score.movePlayline(q < 0 ? 0 : q % cur.r.lenBeats, true);
    },
    onEnd: () => { const m = mode; finish(m === "perform"); },
    onStop: () => finish(false)
  });
  /* 拍點:預備拍 1 小節每拍響;之後照拍點模式(一個循環 = cycleU) */
  function clickFn(R, clickMode){
    return u => {
      if (u < 0) return (u + R.ciU) % R.pulseU === 0 ? ((u + R.ciU) === 0 ? 2 : 1) : 0;
      if (u >= R.lenU || u % R.pulseU) return 0;
      const p = u / R.pulseU, cycP = R.cycleU / R.pulseU, inCyc = p % cycP;
      if (!clickPlays(clickMode, inCyc, 4, cycP)) return 0;
      return inCyc % 4 === 0 ? 2 : 1;
    };
  }
  /* kind = "demo"(▶:整組鼓 + 拍點,一直循環;solo = 只有拍點)/ "perform"(打一遍:預備拍 + 只有拍點,鼓墊評分) */
  async function start(kind, { click = "every", solo = false } = {}){
    if (!cur || mode) return false;
    const c0 = cur;
    onPlayState("busy");
    const actx = audio.ensureAudio();
    if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
    const ok = await preload();
    await within(audio.masterReady, 1500);
    if (cur !== c0 || !active) { onPlayState(null); return false; }
    if (!ok) { onPlayState(null); onLoad(null, true); return false; }
    const bpm = getBpm(), r = cur.r, compound = r.compound;
    const unit = compound ? 0.5 : 1, pulseU = compound ? 3 : 1, qbpm = bpm * r.pulse;
    const barU = r.lenBeats / r.spec.measures.length / unit, patU = r.lenBeats / unit;
    const cycleBars = click === "gap" ? 8 : Math.max(4, r.spec.measures.length);
    const cycleU = cycleBars * barU;
    let lenU, events = [];
    if (kind === "demo") {
      const cycles = Math.max(2, Math.ceil(DEMO_SEC / (cycleU * unit * 60 / qbpm)));
      lenU = cycles * cycleU;
      if (!solo) events = repeatEvents(eventsOf(r, qbpm, cur.level), r.lenBeats, Math.round(lenU / patU)).map(e => ({ ...e, beat: e.beat / unit }));
    } else lenU = cycleU;
    const R = { unit, pulseU, qbpm, cycleU, lenU, ciU: 4 * pulseU, patU, taps: [], startedAt: performance.now(), kind };
    const tail = kind === "perform" ? pulseU : 0;
    const t0 = player.play({ events, lenBeats: lenU + tail, bpm: qbpm / unit, countInBeats: R.ciU, click: clickFn(R, click) });
    if (!(t0 > 0)) { onPlayState(null); return false; }
    R.t0 = t0; run = R; mode = kind;
    onPlayState(kind);
    if (kind === "perform") { $("rPadCard").classList.add("you"); announce(tr("打一遍:先響 1 小節拍點", "Your turn: one bar of count-in first")); }
    else announce(solo ? tr("開始:只有拍點,自己打", "Started: click only, you play") : tr("開始播放示範", "Playing the demo"));
    return true;
  }
  /* 播完或停止:秒數算進今天的練習;打一遍播完才評分 */
  function finish(judge){
    const R = run, m = mode;
    run = null; mode = null;
    tempo.showBeat(null); score.home();
    $("rPadCard").classList.remove("you");
    onPlayState(null);
    if (!R) return;
    const sec = Math.max(0, (performance.now() - R.startedAt) / 1000 - R.ciU * R.unit * 60 / R.qbpm);
    if (sec >= 0.5) addSec(sec);
    if (m === "perform" && judge) judgeRun(R);
    else if (m === "demo") announce(judge ? tr("播完了", "Finished") : tr("停止了", "Stopped"));
  }
  function stop(){ if (mode) { player.stop(true); finish(false); } }
  function retempo(bpm){
    if (!run || run.kind !== "demo" || !cur) return;   // 打一遍中不改(評分照開始的速度)
    const qbpm = bpm * cur.r.pulse;
    run.qbpm = qbpm; player.retempo(qbpm / run.unit);
  }
  function judgeRun(R){
    const r = cur.r, sec = 60 / R.qbpm;
    const reps = Math.round(R.lenU / R.patU);
    const ev = repeatEvents(hitsOnly(eventsOf(r, R.qbpm, cur.level)), r.lenBeats, reps);
    const taps = R.taps.filter(x => x.time >= -sec / 2);
    const res = scoreLanes(expectedByLane(ev, R.qbpm, LANES[3]), taps, { tempoBpm: R.qbpm });
    const sc = taps.length ? res.score : 0;
    paintResult(res, taps.length);
    onResult({ score: res.offsetTooLarge ? null : sc, res, taps: taps.length });
  }
  function paintResult(res, n){
    const el = $("rResult");
    el.hidden = false;
    const notes = [offsetNote(res), laneNote(res, LANES[3])].filter(Boolean);
    const big = res.offsetTooLarge || !n ? "" : `<p class="big">${res.score}<small>/100</small></p>`;
    el.innerHTML = `<p class="r-head"></p>${big}<p class="r-line"></p>` + notes.map(() => `<p class="r-note"></p>`).join("") + `<p class="disclaimer"></p>`;
    pairText(el.querySelector(".r-head"), () => tr("練習回饋 · 節奏", "Practice feedback · rhythm"));
    pairText(el.querySelector(".r-line"), () => (n ? tr(`打中 ${res.hits}/${res.total} · 漏打 ${res.missed} · 多打 ${res.extra}`, `Hit ${res.hits}/${res.total} · missed ${res.missed} · extra ${res.extra}`)
      : tr("沒有打到鼓墊", "No pad taps")));
    el.querySelectorAll(".r-note").forEach((p, i) => pairText(p, () => tr(notes[i][0], notes[i][1])));
    pairText(el.querySelector(".disclaimer"), () => tr("只評時間 · 練習回饋,不是考試分數", "Timing only · practice feedback, not an exam mark"));
  }

  /* ── 鼓墊 ── */
  const pads = createPads($("rPads"), LANES[3], ({ lane, time }) => {
    if (time == null) return;
    audio.playKit(padPiece()[lane] || "snare", Math.max(time, audio.audioNow()), 0.72);
    if (run && mode === "perform") run.taps.push({ lane, time: time - run.t0 });
  });
  function syncPadUI(){
    const on = !!cur && pad;
    $("rPadCard").hidden = !on;
    $("rMode").hidden = !cur;
    $("rModeBtn").hidden = on;
    $("rPerform").hidden = !on;
    pairText($("rModeBtn"), () => tr("沒有鼓?用手機鼓墊", "No kit? Use the phone pads"));
    pairText($("rKitBtn"), () => tr("在鼓上打?改回自己按「穩了」", "On a kit? Back to tapping Steady"));
    pairText($("rPadNote"), () => tr("先響 1 小節拍點再開始打", "One bar of count-in first") + (showKeys() ? tr(" · 鍵盤 F / J / K", " · keys F / J / K") : ""));
    syncPerform();
  }
  function syncPerform(){
    const b = $("rPerform");
    b.textContent = mode === "perform" ? tr("停止", "Stop") : tr("打一遍", "Play it");
    b.disabled = mode === "demo";
  }

  return {
    show, hide, stop, retempo, preload,
    get cur(){ return cur; }, get mode(){ return mode; }, get loading(){ return loadingP; }, score, pads,
    get pad(){ return pad; }, set pad(v){ pad = !!v; syncPadUI(); },
    set active(v){ active = !!v; if (!active) stop(); },
    toggleDemo(opts){ if (mode === "demo") { stop(); return; } if (!mode) start("demo", opts); },
    togglePerform(opts){ if (mode === "perform") { stop(); return; } if (mode) stop(); start("perform", opts); },
    syncPerform, syncPadUI,
    relang(){ syncRlBtn(); syncPadUI(); },
    onResize(){
      if (!cur || $("rScoreCard").hidden) return;
      const pend = score.pending;
      if (Math.abs($r("stage").clientWidth - fitW) > 24) { fitZ = null; score.onResize(); if (score.osmd) { score.refit(); fitOnce(); } return; }
      score.onResize();
      if (pend && !score.pending) requestAnimationFrame(fitOnce);
    },
    key(e){ return pad && pads.key(e); },
    /* 測試用 */
    get run(){ return run; }
  };
}
