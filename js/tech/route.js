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
import { isPhoneLand } from "../shared/landscape.js";
import { toSpec, eventsOf, handsOf, displaySpec } from "./routespec.js";

const NS = "http://www.w3.org/2000/svg";
const DEMO_SEC = 150;   // 示範一直循環:最多這麼久自己停(練習設定)

export function createRouteView({ $, tempo, drumKey, getBpm, isActive, addSec, onResult, onPlayState, onLoad, rlFor, setRl, onHeard = () => {} }){
  const $r = id => $("r" + id[0].toUpperCase() + id.slice(1));
  let cur = null;      // { seg, level, r(toSpec 的結果), xml, key }
  let mode = null;     // "demo" | "perform" | null
  let starting = null, gen = 0;   // 準備中(載入鼓聲)的那一次:"demo" | "perform";stop() 取消(gen 換號,準備好了也不開始)
  let run = null;      // 這一次播放:{ t0, startedAt, unit, pulseU, qbpm, cycleU, lenU, taps }
  let pad = false, active = true, kitJob = null, loadingP = null;

  /* ── 譜 ── */
  /* 縮放:平常照畫面寬度;整份(2 或 4 小節)一行放不下紙張寬度時縮到放得下(不小於 ONE_MIN);
     再小就換行(像視奏的考卷):4 小節先試每行 2 小節(不小於 ONE_MIN),最後一小節一行(不小於 WRAP_MIN1)— 不左右捲 */
  const ONE_MIN = 0.55, WRAP_MIN1 = 0.45;   // 0.55 = 視奏考卷排法的下限(口袋總譜大小)
  const FILL = 1.35, FILL_H = 0.34;   // 短譜放大:最多正常大小的 1.35 倍、譜高 ≤ 畫面高的 34%(docs/DESIGN.md 第 5 節;照 PianoDrill 的 fitWrap)
  const FILL_WIDE = 1.6;   // 寬畫面(wideFit):圖例併進譜卡標題列(drum.css;2026-11-07 使用者選乙+),譜照到底部按鈕列剩下的高度最多放大到 1.6 倍
  let fitZ = null, fillZ = null, fitW = 0, wrapN = 0, settled = false;
  const baseZ = () => (window.innerWidth < 600 ? 0.9 : window.innerWidth < 1100 ? 1 : 1.15);
  const zoom = () => fillZ || Math.min(baseZ(), fitZ || Infinity);
  function fitOnce(){
    const svg = $r("osmd").querySelector("svg"), avail = $r("stage").clientWidth - 16;
    if (!svg || !avail || !score.osmd) return;
    fitW = $r("stage").clientWidth;
    if (wrapN || fillZ) { landCap(); return; }
    const w = svg.getBoundingClientRect().width;
    if (w <= avail + 1) { fill(avail); landCap(); return; }
    const z1 = score.osmd.zoom * avail * 0.97 / w;
    if (z1 >= ONE_MIN) { fitZ = z1; score.refit(); landCap(); return; }
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
    landCap();
  }
  /* 手機橫式鼓墊模式(鼓譜、鼓墊並排;padTop):譜高不超過「頂欄下 → 底部按鈕列」(按打一遍捲到譜紙頂),只縮不放大、不小於 ONE_MIN;借用 score.landZoom(路線譜平常不用它) */
  function landCap(){
    const mod = $("rPadCard").closest(".mod"), on = isPhoneLand() && !!mod && mod.classList.contains("r-pad");
    if (score.landZoom) { score.landZoom = null; score.refit(); }
    const o = score.osmd, svg = $r("osmd").querySelector("svg"); if (!on || !o || !svg) return;
    const r = svg.getBoundingClientRect(), st = $r("stage").getBoundingClientRect(), hd = document.querySelector("header");
    const c = [...document.querySelectorAll("#mod-tech .daily-cta")].find(e => e.offsetHeight && getComputedStyle(e).position === "fixed");
    const room = (c ? c.getBoundingClientRect().top : innerHeight) - 4 - (hd ? hd.getBoundingClientRect().bottom + 4 : 0) - (r.top - st.top) - Math.max(0, st.bottom - r.bottom);
    if (r.height > room && room > 0) { const z = Math.max(ONE_MIN, Math.floor(o.zoom * room / r.height * 100) / 100); if (z < o.zoom) { score.landZoom = z; score.refit(); } }
  }
  /* 短譜(整份一行、原本的大小就放得下):放大到用滿寬度,最多 FILL 倍、譜高不超過畫面的 FILL_H(第一個畫面還看得到題目卡與主要按鈕);
     R / L、×N、% 都畫完才量(不能超出畫布)。手機橫放照舊(score.js 的 fitWidth) */
  /* 寬畫面(≥ 1100 寬、不是手機橫放;PianoDrill docs/DESIGN.md 9.6):譜高上限不用畫面高的 FILL_H,改照「譜到底部按鈕列(沒有就到分頁列)」剩下的高度;
     原本的大小就太高 → 縮到放得下(不小於 ONE_MIN;縮到 ONE_MIN 還放不下 = 只縮到正常大小的 85%,讓它捲) */
  const wideFit = () => innerWidth >= 1100 && innerHeight > 500 && !isPhoneLand();
  const tabFit = () => innerWidth >= 700 && innerHeight > 500 && !wideFit() && !isPhoneLand();   // 平板直式(fill 的放大上限;鼓墊模式除外)
  function wideRoomH(){
    const svg = $r("osmd").querySelector("svg"); if (!svg) return Infinity;
    const r = svg.getBoundingClientRect(), st = $r("stage").getBoundingClientRect();
    const c = [...document.querySelectorAll("#mod-tech .daily-cta")].find(e => e.offsetHeight && getComputedStyle(e).position === "fixed"), bar = document.getElementById("tabbar");
    const bb = bar && bar.getClientRects().length ? bar.getBoundingClientRect() : null;
    const floor = c ? c.getBoundingClientRect().top : bb && bb.top > innerHeight / 2 ? bb.top : innerHeight;
    return floor - 4 - (r.top + scrollY) - Math.max(0, st.bottom - r.bottom);
  }
  function fill(avail){
    const o = score.osmd; if (isPhoneLand() || !o) return;
    const capH = wideFit() ? wideRoomH() : innerHeight * FILL_H;
    const ok = z => {
      o.zoom = z; score.render();
      const svg = $r("osmd").querySelector("svg"); if (!svg) return false;
      const r = svg.getBoundingClientRect();
      if (r.width > avail * 0.97 + 1 || r.height > capH) return false;
      const vb = svg.viewBox && svg.viewBox.baseVal, bb = svg.getBBox();
      return !(vb && vb.width) || (bb.x >= vb.x - 1 && bb.x + bb.width <= vb.x + vb.width + 1 && bb.y >= vb.y - 1 && bb.y + bb.height <= vb.y + vb.height + 1);
    };
    // 平板直式(700–1099 寬、高 > 500):譜高照舊 ≤ FILL_H(圖例還在下面),放大上限跟寬畫面一樣 FILL_WIDE(原本 FILL 只到白紙一半寬);鼓墊模式照舊(鼓墊要在底部按鈕列上面)
    const tab = tabFit() && !pad;
    const z0 = o.zoom; let lo = z0, hi = baseZ() * (wideFit() || tab ? FILL_WIDE : FILL);
    if (hi > z0 + 0.005) {
      if (ok(hi)) lo = hi;
      else for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    }
    const z = Math.max(z0, Math.floor(lo * 100) / 100);   // 取整不能比原本的大小還小
    if (z > z0 + 0.005) fillZ = z;
    else if (wideFit()) {
      const tall = z => { o.zoom = z; score.render(); const svg = $r("osmd").querySelector("svg"); return !!svg && svg.getBoundingClientRect().height > capH; };
      // 矮視窗(1280×720 等):縮到放得下,不小於 ONE_MIN(考卷排法的下限);縮到 ONE_MIN 還放不下(1280×600:譜在按鈕列下面)= 照舊只縮到 85%,捲動看
      const min = Math.ceil(baseZ() * 85) / 100;
      if (z0 > ONE_MIN && tall(z0)) {
        if (!tall(ONE_MIN)) {
          let lo2 = ONE_MIN, hi2 = z0;
          for (let k = 0; k < 7; k++) { const mid = (lo2 + hi2) / 2; if (tall(mid)) hi2 = mid; else lo2 = mid; }
          fillZ = Math.max(ONE_MIN, Math.floor(lo2 * 100) / 100);
        } else if (z0 > min) fillZ = min;
        // 第一次量的時候題目卡與鼓譜卡可能還沒合成一張(main.js 的 syncJoin 下一幀才做,中間多 12px):等兩幀照最後的版面再量一次(每份譜一次)
        if (fillZ && !settled) { settled = true; requestAnimationFrame(() => requestAnimationFrame(() => { if (fillZ && !mode && cur && wideFit() && score.osmd && $r("osmd").offsetWidth) { fillZ = null; score.refit(); fitOnce(); } })); }
      }
    }
    score.refit();
  }
  const score = createScore({
    $: $r, zoom, perLine: () => wrapN, noFill: () => !isPhoneLand(),   // 直式不用 fitWidth 的放大(fill 照畫面高度放大);手機橫放照舊
    // 換行時:R / L 寫在譜上面,行與行之間多留空間
    beforeRender: (osmd, n) => { const R = osmd.EngravingRules; if (R._sysGap == null) R._sysGap = R.MinSkyBottomDistBetweenSystems; R.MinSkyBottomDistBetweenSystems = R._sysGap + (n && rlOn() ? 5 : 0); },
    setup: osmd => setupKit(osmd, 5, cur ? cur.xml : ""),
    afterRender: svg => { if (cur && score.osmd && svg) { decorate(score.osmd, cur.xml, svg); drawPct(svg); drawHands(svg); } },
    lenBeats: () => (cur ? cur.disp.len : null),
    playing: () => !!mode,
    isActive: () => active && isActive() && !$("rScoreCard").hidden,
    label: () => (cur ? describeSpec(cur.r.spec, { key: cur.key, bpm: getBpm(), title: tr(cur.level.name[0], cur.level.name[1]) }) + (rlOn() ? tr("；手的音上面標 R / L", "; R / L above the hand notes") : "") : "")
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
    const vb0 = svg.viewBox.baseVal, k = vb0 && vb0.width ? svg.getBoundingClientRect().width / vb0.width : 0;
    const fs = Math.max(sp * 1.45, k ? 12 / k : 0), cols = new Map();   // 畫面上的字至少 12px(窄畫面譜縮小時)
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
    if (!key) { $("rPaperMsg").textContent = tr("鼓譜資料還沒載好（第一次要連網路）", "Drum key not loaded yet (needs internet once)"); return; }
    // 畫面用的譜:一樣的小節縮起來(反覆記號 ×N、%);播放、評分照原本的 r.spec。×N = 一遍打幾小節(中途消失 8、其他 4)
    const level = seg.level, r = toSpec(level, seed, { key }), disp = displaySpec(r.spec, seg.click === "gap" ? 8 : 4), xml = scoreXML(disp.spec);
    cur = { seg, level, r, disp, xml, key, seed };
    $("rScoreCard").hidden = false;
    $("rResult").hidden = true; $("rResult").innerHTML = "";
    syncRlBtn(); syncPadUI();
    if (score.osmd) setupKit(score.osmd, 5, xml);
    fitZ = null; fillZ = null; wrapN = 0; settled = false; score.landZoom = null;
    score.load(osmdXML(xml)).then(done => { if (done && cur && cur.xml === xml) fitOnce(); });
    drawLegend($("rLegend"), { pieces: r.pieces, lines: 5, key, plain: true }).catch(e => console.error(e));
    preload();
  }
  function hide(){ stop(); cur = null; $("rScoreCard").hidden = true; $("rPadCard").hidden = true; const m = $("rPadCard").closest(".mod"); if (m) m.classList.remove("r-pad"); }

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
    if (!cur || mode || starting) return false;
    const c0 = cur, g = ++gen;
    starting = kind;
    onPlayState("busy");
    const actx = audio.ensureAudio();
    if (actx.state !== "running") await within(actx.resume().catch(() => {}), 1500);
    const ok = await preload();
    await within(audio.masterReady, 1500);
    if (g !== gen) return false;   // 準備中被 stop() 取消了(畫面那邊已經處理)
    starting = null;
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
    if (kind === "perform") { $("rPadCard").classList.add("you"); announce(tr("打一遍：先響 1 小節拍點", "Your turn: one bar of count-in first")); }
    else announce(solo ? tr("開始：只有拍點，自己打", "Started: click only, you play") : tr("開始播放示範", "Playing the demo"));
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
  function stop(){
    if (mode) { player.stop(true); finish(false); }
    else if (starting) { starting = null; gen++; onPlayState(null); }   // 還在準備(載入鼓聲):取消,準備好了也不開始
  }
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
    pairText(el.querySelector(".disclaimer"), () => tr("只評時間，不是考試分數", "Timing only, not an exam mark"));
  }

  /* ── 鼓墊 ── */
  const pads = createPads($("rPads"), LANES[3], ({ lane, time }) => {
    if (time == null) return;
    audio.playKit(padPiece()[lane] || "snare", Math.max(time, audio.audioNow()), 0.72);
    if (run && mode === "perform") run.taps.push({ lane, time: time - run.t0 });
  });
  let done = false;   // 這一段過關 / 複習完(面板的主要按鈕是「下一段 ›」)
  /* 手機橫式的鼓墊模式(2026-11-07 使用者選甲):鼓譜在左、鼓墊在右並排(drum.css 的 #mod-tech.r-pad);
     鼓墊頂對齊譜紙頂(--r-pad-top = 譜卡頂到譜紙頂),譜照剩下的寬度重排(resize) */
  function padTop(){
    const pc = $("rPadCard");
    const d = isPhoneLand() && !pc.hidden ? $r("stage").getBoundingClientRect().top - $("rScoreCard").getBoundingClientRect().top : 0;
    if (d > 0) pc.style.setProperty("--r-pad-top", Math.round(d) + "px"); else pc.style.removeProperty("--r-pad-top");
  }
  function syncPadUI(){
    const on = !!cur && pad;
    const mod = $("rPadCard").closest(".mod");
    if (mod && mod.classList.contains("r-pad") !== on) { mod.classList.toggle("r-pad", on); if (tabFit()) fitW = 0; requestAnimationFrame(resize); }   // 平板直式:鼓墊模式的放大上限不一樣,重新排
    $("rPadCard").hidden = !on;
    $("rModeBtn").hidden = on;
    $("rPerform").hidden = !on;
    pairText($("rModeBtn"), () => tr("沒有鼓？用手機打", "No drums? Use phone"));   // 短:折疊機上跟「還要練 / 穩了」排在同一行
    pairText($("rKitBtn"), () => tr("改回在鼓上打", "Back to the kit"));
    pairText($("rPadNote"), () => tr("先聽 1 小節拍點再打", "One bar of count-in first") + (showKeys() ? tr(" · 鍵盤 F / J / K", " · keys F / J / K") : ""));
    syncPerform();
  }
  function resize(){
    if (!cur || $("rScoreCard").hidden) return;
    padTop();
    const pend = score.pending;
    if (Math.abs($r("stage").clientWidth - fitW) > 24) { fitZ = null; fillZ = null; wrapN = 0; score.landZoom = null; score.onResize(); if (score.osmd) { score.refit(); fitOnce(); } return; }
    score.onResize();
    if (pend && !score.pending) requestAnimationFrame(fitOnce); else landCap();
  }
  function syncPerform(){
    const b = $("rPerform");
    b.textContent = mode === "perform" ? tr("停止", "Stop") : tr("打一遍", "Play it");
    // 同一時間只有一顆主要:過關 / 複習完出現「下一段 ›」時「打一遍」改成次要(還可以再打一次);打的時候「停止」= 次要的樣子(跟底部按鈕的「■ 停止」一樣)
    b.classList.toggle("primary", !done && mode !== "perform");
    b.disabled = mode === "demo";
  }

  return {
    show, hide, stop, retempo, preload,
    get cur(){ return cur; }, get mode(){ return mode; }, get fit(){ return { wrapN, zoom: score.osmd ? score.osmd.zoom : null }; }, get loading(){ return loadingP; }, score, pads,
    get pad(){ return pad; }, set pad(v){ pad = !!v; syncPadUI(); },
    get done(){ return done; }, set done(v){ done = !!v; syncPadUI(); },
    set active(v){ active = !!v; if (!active) stop(); },
    get starting(){ return !!starting; },
    toggleDemo(opts){ if (mode === "demo" || starting === "demo") { stop(); return; } if (!mode && !starting) start("demo", opts); },
    togglePerform(opts){ if (mode === "perform" || starting === "perform") { stop(); return; } if (mode || starting) stop(); start("perform", opts); },
    syncPerform, syncPadUI,
    relang(){ syncRlBtn(); syncPadUI(); },
    onResize: resize,
    key(e){ return pad && pads.key(e); },
    /* 測試用 */
    get run(){ return run; }
  };
}
