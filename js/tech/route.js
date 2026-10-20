/* 今日練習的路線段(律動 / 過門 / 複習):鼓組譜 + 圖例 + 左右手、▶ 示範(整組鼓 + 拍點,一直循環到停止)、手機鼓墊「打一遍」與評分。
   DrumDrill 自己的(技巧模組用;元素 id 用模組的 $,前綴 t-):
     #t-rScoreCard(#t-rStage / #t-rScroll / #t-rOsmd / #t-rPlayline / #t-rPaperMsg、#t-rLegend、#t-rlBtn「標示左右手」)
     #t-rPadCard(#t-rPads 三個鼓墊、#t-rPadNote、#t-rResult、#t-rKitBtn 改回在鼓上打)、段落面板按鈕列的 #t-rModeBtn(「沒有鼓?用手機鼓墊」)/ #t-rPerform(打一遍)(dailycard.js 的 acts 放進去)
   - 譜:routespec.js 的 toSpec → kitnotation scoreXML → score.js(一整行 + 播放軸);legend.js 的 setupKit / decorate / drawLegend(plain:自由練習不寫出處)
   - 左右手:手打的音上面 R / L(routespec 的 hand;和弦上下疊、鈸在上);腳不標;律動 A、B 組只標第 1 小節、過門只標過門的音。關卡的 rl 預設,題目卡的開關每條路線記住
   - 一樣的小節縮起來(routespec 的 displaySpec):全部一樣 = 一小節 + 反覆 ×N、跟前一小節一樣 = %;播放照原本的譜
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
import { toSpec, eventsOf, handsOf, displaySpec } from "./routespec.js";

const NS = "http://www.w3.org/2000/svg";
const DEMO_SEC = 150;   // 示範一直循環:最多這麼久自己停(練習設定)

export function createRouteView({ $, tempo, drumKey, getBpm, isActive, addSec, onResult, onPlayState, onLoad, rlFor, setRl, onHeard = () => {} }){
  const $r = id => $("r" + id[0].toUpperCase() + id.slice(1));
  let cur = null;      // { seg, level, r(toSpec 的結果), xml, key }
  let mode = null;     // "demo" | "perform" | null
  let run = null;      // 這一次播放:{ t0, startedAt, unit, pulseU, qbpm, cycleU, lenU, taps }
  let pad = false, active = true, kitJob = null, loadingP = null;

  /* ── 譜 ── */
  /* 縮放:平常照畫面寬度;整份(2 或 4 小節)一行放不下紙張寬度時縮到放得下(不小於 ONE_MIN);
     再小就換行(像視奏的考卷):4 小節先試每行 2 小節(不小於 ONE_MIN),最後一小節一行(不小於 WRAP_MIN1)— 不左右捲 */
  const ONE_MIN = 0.55, WRAP_MIN1 = 0.45;   // 0.55 = 視奏考卷排法的下限(口袋總譜大小)
  let fitZ = null, fitW = 0, wrapN = 0;
  const baseZ = () => (window.innerWidth < 600 ? 0.9 : window.innerWidth < 1100 ? 1 : 1.15);
  const zoom = () => Math.min(baseZ(), fitZ || Infinity);
  function fitOnce(){
    const svg = $r("osmd").querySelector("svg"), avail = $r("stage").clientWidth - 16;
    if (!svg || !avail || !score.osmd) return;
    fitW = $r("stage").clientWidth;
    if (wrapN) return;
    const w = svg.getBoundingClientRect().width;
    if (w <= avail + 1) return;
    const z1 = score.osmd.zoom * avail * 0.97 / w;
    if (z1 >= ONE_MIN) { fitZ = z1; score.refit(); return; }
    // 一行放不下:換行
    const bars = score.osmd.GraphicSheet.MeasureList.length, o = score.osmd;
    const fits = (n, z) => {
      wrapN = n; o.zoom = z; score.render();
      const sys = score.systems(), rem = bars % n;
      return sys.length === Math.ceil(bars / n) && sys.every((sy, i) => (sy.GraphicalMeasures || []).length === (i === sys.length - 1 && rem ? rem : n));
    };
    let pick = null;
    for (const n of bars > 2 && bars % 2 === 0 ? [2, 1] : [1]) {
      const floor = n === 1 ? WRAP_MIN1 : ONE_MIN;
      if (!fits(n, floor)) continue;
      let lo = floor, hi = baseZ();
      if (fits(n, hi)) lo = hi;
      else for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (fits(n, mid)) lo = mid; else hi = mid; }
      pick = { n, z: Math.floor(lo * 100) / 100 }; break;
    }
    if (!pick) pick = { n: 1, z: WRAP_MIN1 };
    wrapN = pick.n; fitZ = pick.z; score.refit();
  }
  const score = createScore({
    $: $r, zoom, perLine: () => wrapN,
    // 換行時:R / L 寫在譜上面,行與行之間多留空間
    beforeRender: (osmd, n) => { const R = osmd.EngravingRules; if (R._sysGap == null) R._sysGap = R.MinSkyBottomDistBetweenSystems; R.MinSkyBottomDistBetweenSystems = R._sysGap + (n && rlOn() ? 5 : 0); },
    setup: osmd => setupKit(osmd, 5, cur ? cur.xml : ""),
    afterRender: svg => { if (cur && score.osmd && svg) { decorate(score.osmd, cur.xml, svg); drawPct(svg); drawHands(svg); } },
    lenBeats: () => (cur ? cur.disp.len : null),
    playing: () => !!mode,
    isActive: () => active && isActive() && !$("rScoreCard").hidden,
    label: () => (cur ? describeSpec(cur.r.spec, { key: cur.key, bpm: getBpm(), title: tr(cur.level.name[0], cur.level.name[1]) }) + (rlOn() ? tr(";手的音上面標 R / L", "; R / L above the hand notes") : "") : "")
  });
  const rlOn = () => !!cur && rlFor(cur.level);
  /* 左右手(使用者 / 審查定案 2026-10):R / L 寫在譜表上方(手的聲部在上;和弦上下疊、鈸在上),字放在所有音符、符桿、連桿、記號的上面;
     律動 A、B 組只標第 1 小節(後面重複的不標);過門只標過門的音(有鈸的拍 = 律動,不標);換行時每一行各自量 */
  function drawHands(svg){
    svg.querySelectorAll(".rt-hand").forEach(e => e.remove());
    if (!rlOn() || !score.osmd) return;
    const L = cur.level, route = L.route ? L.route.id : "", firstOnly = route === "groove" && ["A", "B"].includes(L.g);
    const hs = handsOf(cur.r.spec, cur.key).filter(h => !(route === "fill" && h.groove) && !(firstOnly && h.mi > 0));
    const gns = graphicalNotes(score.osmd).filter(g => g.voice === 1);
    const tops = wrapN ? score.systems().map(sy => (sy.PositionAndShape.AbsolutePosition.y + sy.PositionAndShape.BorderTop) * 10) : [-Infinity];
    const sysOf = y => tops.reduce((b, t, i) => (y + 2 >= t ? i : b), 0);
    const inkTop = tops.map(() => Infinity);
    let sp = 10;
    const isRep = g => g.tagName === "text" && /^×\d+$/.test(g.textContent.trim());   // ×N 下面另外放(不墊高 R / L)
    svg.querySelectorAll(".vf-stavenote, .vf-beam, .vf-stem, .staffline, text:not(.rt-hand), .rt-pct").forEach(g => { if (isRep(g)) return; const b = g.getBBox(); if (b.height || b.width) { const i = sysOf(b.y + b.height / 2); inkTop[i] = Math.min(inkTop[i], b.y); } });
    const h0 = svg.querySelector(".vf-notehead"); if (h0) sp = h0.getBBox().height || sp;
    const fs = sp * 1.45, cols = new Map();
    for (const h of hs) {
      const g = gns.find(x => x.mi === h.mi && x.t === h.t && x.k === h.k), hb = g && headBox(g.gn);
      if (!hb) continue;
      const si = sysOf(hb.head.y + hb.head.height / 2), key = h.mi + ":" + h.t, col = cols.get(key) || { x: hb.head.x + hb.head.width / 2, top: inkTop[si], si, hands: [] };
      col.hands.push([h.k, h.hand]); cols.set(key, col);
    }
    const frag = document.createDocumentFragment();
    for (const col of cols.values()) {
      const list = [...new Set(col.hands.sort((a, b) => b[0] - a[0]).map(x => x[1]))];   // 高的(鈸)在上
      const base = (isFinite(col.top) ? col.top : 0) - fs * 0.3;
      list.forEach((hand, i) => {
        const el = document.createElementNS(NS, "text");
        el.setAttribute("x", col.x); el.setAttribute("y", base - (list.length - 1 - i) * fs * 1.05); el.setAttribute("text-anchor", "middle");
        el.setAttribute("font-family", "Arial, Helvetica, sans-serif"); el.setAttribute("font-weight", "700"); el.setAttribute("font-size", fs);
        el.setAttribute("class", "rt-hand dd-stick"); el.textContent = hand;
        frag.appendChild(el);
      });
    }
    svg.appendChild(frag);
    // 反覆的「×N」(kitnotation 寫在第一個音上方)跟第一個 R / L 撞在一起:移到第一個 R / L 的左邊、同一條基線(譜號、拍號上面是空的)
    const first = [...cols.values()].filter(c => c.si === 0).sort((a, b) => a.x - b.x)[0];
    if (first) {
      const n = new Set(first.hands.map(x => x[1])).size, y = (isFinite(first.top) ? first.top : 0) - fs * 0.3 - (n - 1) * fs * 1.05;
      svg.querySelectorAll(".vf-text text").forEach(t => { if (isRep(t)) { t.setAttribute("x", first.x - fs * 1.2); t.setAttribute("y", y); t.setAttribute("text-anchor", "end"); } });
    }
    const vb = svg.viewBox.baseVal, bb = svg.getBBox();
    if (vb && vb.height && bb.y - 4 < vb.y) {
      const k = parseFloat(svg.getAttribute("height")) / vb.height, y0 = bb.y - 4;
      svg.setAttribute("viewBox", `${vb.x} ${y0} ${vb.width} ${vb.y + vb.height - y0}`); svg.setAttribute("height", (vb.y + vb.height - y0) * k);
    }
  }
  /* 一小節反覆記號 %(跟前一小節一模一樣;routespec.js displaySpec 的 pct):斜線 + 兩個點,放在小節正中間 */
  function drawPct(svg){
    svg.querySelectorAll(".rt-pct").forEach(e => e.remove());
    const pct = cur.disp.pct; if (!pct || !pct.some(Boolean)) return;
    const frag = document.createDocumentFragment();
    score.osmd.GraphicSheet.MeasureList.forEach((row, mi) => {
      const gm = row && row[0]; if (!gm || !pct[mi] || !gm.getVFStave) return;
      const st = gm.getVFStave(), sp = st.getSpacingBetweenLines(), cx = st.getX() + st.getWidth() / 2, cy = st.getYForLine(2);
      const g = document.createElementNS(NS, "g"); g.setAttribute("class", "rt-pct");
      g.innerHTML = `<path d="M${cx - sp * 1.1} ${cy + sp * 1.1} L${cx + sp * 1.1} ${cy - sp * 1.1}" stroke="#16130D" stroke-width="${sp * 0.45}" stroke-linecap="butt"/>` +
        `<circle cx="${cx - sp * 0.9}" cy="${cy - sp * 0.55}" r="${sp * 0.3}" fill="#16130D"/><circle cx="${cx + sp * 0.9}" cy="${cy + sp * 0.55}" r="${sp * 0.3}" fill="#16130D"/>`;
      frag.appendChild(g);
    });
    svg.appendChild(frag);
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
    // 畫面用的譜:一樣的小節縮起來(反覆記號 ×N、%);播放、評分照原本的 r.spec。×N = 一遍打幾小節(中途消失 8、其他 4)
    const level = seg.level, r = toSpec(level, seed, { key }), disp = displaySpec(r.spec, seg.click === "gap" ? 8 : 4), xml = scoreXML(disp.spec);
    cur = { seg, level, r, disp, xml, key, seed };
    $("rScoreCard").hidden = false;
    $("rResult").hidden = true; $("rResult").innerHTML = "";
    syncRlBtn(); syncPadUI();
    if (score.osmd) setupKit(score.osmd, 5, xml);
    fitZ = null; wrapN = 0;
    score.load(osmdXML(xml)).then(done => { if (done && cur && cur.xml === xml) fitOnce(); });
    drawLegend($("rLegend"), { pieces: r.pieces, lines: 5, key, plain: true }).catch(e => console.error(e));
    preload();
  }
  function hide(){ stop(); cur = null; $("rScoreCard").hidden = true; $("rPadCard").hidden = true; }

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
      run.u = u;
      // 用現在的速度播過 2 小節(預備拍之後;中途改速度重算):「穩了」才能按(今日練習,dailycard 的 ready)
      if (!run.heard && u - run.mark >= run.heardU) { run.heard = true; onHeard(); }
      const q = u * run.unit, pulse = u / run.pulseU;
      tempo.showBeat(pulse < 0 ? pulse : pulse % 4, 4);
      if (score.osmd) score.movePlayline(q < 0 ? 0 : q % cur.disp.len, true);
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
    const R = { unit, pulseU, qbpm, cycleU, lenU, ciU: 4 * pulseU, patU, taps: [], startedAt: performance.now(), kind, u: -4 * pulseU, mark: 0, heardU: 2 * barU, heard: false };
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
    if (m === "perform" && judge) { onHeard(); judgeRun(R); }   // 鼓墊打完一遍也算播過
    else if (m === "demo") announce(judge ? tr("播完了", "Finished") : tr("停止了", "Stopped"));
  }
  function stop(){ if (mode) { player.stop(true); finish(false); } }
  function retempo(bpm){
    if (!run || run.kind !== "demo" || !cur) return;   // 打一遍中不改(評分照開始的速度)
    const qbpm = bpm * cur.r.pulse;
    run.qbpm = qbpm; player.retempo(qbpm / run.unit);
    run.mark = Math.max(0, run.u); run.heard = false;   // 換了速度:要用新的速度再播 2 小節
  }
  function judgeRun(R){
    const r = cur.r, sec = 60 / R.qbpm;
    const reps = Math.round(R.lenU / R.patU);
    const ev = repeatEvents(hitsOnly(eventsOf(r, R.qbpm, cur.level)), r.lenBeats, reps);
    const taps = R.taps.filter(x => x.time >= -sec / 2);
    const res = scoreLanes(expectedByLane(ev, R.qbpm, LANES[3]), taps, { tempoBpm: R.qbpm });
    const sc = taps.length ? res.score : 0;
    paintResult(res, taps.length);
    onResult({ score: res.offsetTooLarge ? null : sc, res, taps: taps.length, bpm: Math.round(R.qbpm / r.pulse) });   // 速度 = 開始打的那一個(打的時候改了不算)
  }
  function paintResult(res, n){
    const el = $("rResult");
    el.hidden = false;
    const notes = [offsetNote(res), laneNote(res, LANES[3])].filter(Boolean);
    const big = res.offsetTooLarge || !n ? "" : `<p class="big"><small class="lead"></small>${res.score}<small>/ 100</small></p>`;
    el.innerHTML = `<p class="r-head"></p>${big}<p class="r-line"></p>` + notes.map(() => `<p class="r-note"></p>`).join("") + `<p class="disclaimer"></p>`;
    pairText(el.querySelector(".r-head"), () => tr("練習回饋 · 節奏", "Practice feedback · rhythm"));
    const lead = el.querySelector(".big .lead"); if (lead) pairText(lead, () => tr("準度", "Accuracy"));
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
    $("rModeBtn").hidden = on;
    $("rPerform").hidden = !on;
    pairText($("rModeBtn"), () => tr("沒有鼓?手機鼓墊", "No kit? Phone pads"));   // 短:折疊機上跟「還要練 / 穩了」排在同一行
    pairText($("rKitBtn"), () => tr("在鼓上打?改回按「穩了」", "On a kit? Back to Steady"));
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
    get cur(){ return cur; }, get mode(){ return mode; }, get fit(){ return { wrapN, zoom: score.osmd ? score.osmd.zoom : null }; }, get loading(){ return loadingP; }, score, pads,
    get pad(){ return pad; }, set pad(v){ pad = !!v; syncPadUI(); },
    set active(v){ active = !!v; if (!active) stop(); },
    toggleDemo(opts){ if (mode === "demo") { stop(); return; } if (!mode) start("demo", opts); },
    togglePerform(opts){ if (mode === "perform") { stop(); return; } if (mode) stop(); start("perform", opts); },
    syncPerform, syncPadUI,
    relang(){ syncRlBtn(); syncPadUI(); },
    onResize(){
      if (!cur || $("rScoreCard").hidden) return;
      const pend = score.pending;
      if (Math.abs($r("stage").clientWidth - fitW) > 24) { fitZ = null; wrapN = 0; score.onResize(); if (score.osmd) { score.refit(); fitOnce(); } return; }
      score.onResize();
      if (pend && !score.pending) requestAnimationFrame(fitOnce);
    },
    key(e){ return pad && pads.key(e); },
    /* 測試用 */
    get run(){ return run; }
  };
}
