/* 模擬考(技巧、視奏、聽力共用;docs/STAGES.md S14,照 PianoDrill 的 t-mockBtn / e-mockBtn 與 .mock-res)。
   每個模組在自己的檢定頁有一個模擬考(不做跨模組的整場模擬);題目與流程由模組決定,這裡只管共同的部分:
   - 狀態:idle(檢定頁:說明 + 開始)| run(進行中)| result(結果:各項的練習回饋)| aborted(中止的說明)
   - 進行中的標記存在模組自己的 localStorage(store.mockRun):重新整理、關掉 App 之後回來,說明「模擬考已中止」
   - 螢幕旋轉(直式 ↔ 橫式)時中止(使用者規格);切分頁、切到背景由模組的 leave() / enter() 呼叫 abort();鼓聲載入失敗(自動開始的那一步卡住)= abort("load")
   - 使用者按「停止模擬考」= close()(不算、沒有結果,直接回到檢定頁);finish() 只在做完最後一項(或視奏正式打中按停止 = 記「中途停止」的結果)
   - 中止說明的系統與級數用 mark(begin 存的 {sys, grade};重新整理後從 store.mockRun 讀回),不用現在的考試設定
   - 結果只有各項的練習回饋(節奏吻合度、完成與否):不算總分、不出現等第字眼、不換算官方分數;practiceOnly
   不寫死前綴:元素用模組自己的 $ */
import { tr, pairText, T } from "./i18n.js";
import { announce } from "./a11y.js";

export function createMock({ store, save, onAbort }){
  const m = { state: "idle", reason: null, id: 0, data: null, mark: null };
  const okSys = x => x === "rsl" || x === "trinity", okGrade = x => Number.isInteger(x) && x >= 0 && x <= 8;
  // 上一次進行中沒有正常結束(重新整理、關掉 App):回來時說明(系統與級數照那一次存的;讀進來先消毒)
  if (store.mockRun && typeof store.mockRun === "object") {
    m.state = "aborted"; m.reason = "reload";
    const r = store.mockRun;
    m.mark = okSys(r.sys) && okGrade(r.grade) ? { sys: r.sys, grade: r.grade } : null;
  }
  else delete store.mockRun;
  m.running = () => m.state === "run";
  /* 開始:id 換新(進行中的非同步步驟用 id 確認自己還是同一場) */
  m.begin = (data, mark) => { m.id++; m.state = "run"; m.reason = null; m.data = data; m.mark = mark ? { sys: mark.sys, grade: mark.grade } : null; store.mockRun = { at: Date.now(), ...(mark || {}) }; save(); return m.id; };
  m.alive = id => m.state === "run" && m.id === id;
  /* 正常結束(做完最後一項;視奏正式打中按停止也到這裡,記「中途停止」):標記拿掉。按「停止模擬考」是 close() */
  m.finish = () => { m.id++; m.state = "result"; delete store.mockRun; save(); announce(tr("模擬考結束,結果在模擬考卡。", "Mock exam finished; see the results on the mock exam card.")); };
  /* 中止(切分頁、背景、重新整理、旋轉、換考試):模組停掉播放與計時;標記留著,說明顯示過才拿掉(重新整理之後也看得到) */
  m.abort = reason => {
    if (m.state !== "run") return false;
    m.id++; m.state = "aborted"; m.reason = reason || "leave";
    announce(tr("模擬考已中止。", "Mock exam stopped."));   // 無障礙:中止也要聽得到(切分頁、載入失敗…)
    try { onAbort && onAbort(m.reason); } catch (e) { console.error(e); }
    return true;
  };
  /* 中止的說明已經畫在畫面上 */
  m.seen = () => { if (store.mockRun) { delete store.mockRun; save(); } };
  /* 回到檢定頁(關掉結果或說明、換了考試) */
  m.close = () => { m.id++; m.state = "idle"; m.data = null; m.mark = null; m.reason = null; m.seen(); };
  /* 這一場的系統與級數(進行中 / 結果 / 中止的說明);沒有就用現在的考試 ex */
  m.who = ex => { const w = m.data || m.mark; return w ? { sys: w.sys, grade: w.grade } : { sys: ex.system, grade: ex.grade }; };
  // 旋轉螢幕:進行中就中止(畫面重排、鼓墊移位,這一次不算)
  if (typeof matchMedia === "function") {
    const mq = matchMedia("(orientation: portrait)"), h = () => { if (m.state === "run") m.abort("rotate"); };
    if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h);
  }
  return m;
}

/* 中止的說明(為什麼中止;這一次不算) */
export const abortText = reason => ({
  leave: tr("中途切換了分頁或切到背景,模擬考已中止(這一次不算)。", "You left the page mid-way, so the mock exam was stopped (not counted)."),
  reload: tr("上次的模擬考沒有做完(重新整理或關掉了 App),已中止(不算)。", "The last mock exam didn't finish (reloaded or closed), so it was stopped (not counted)."),
  rotate: tr("螢幕旋轉了,模擬考已中止(這一次不算)。", "The screen rotated, so the mock exam was stopped (not counted)."),
  exam: tr("考試或級數換了,模擬考已中止(這一次不算)。", "The exam or grade changed, so the mock exam was stopped (not counted)."),
  load: tr("鼓聲載入失敗(第一次要連網路),模擬考已中止(這一次不算);按「再考一次」重試。", "The drum sounds didn't load (needs internet once), so the mock exam was stopped (not counted). Tap Again to retry.")
}[reason] || tr("模擬考已中止(這一次不算)。", "The mock exam was stopped (not counted)."));

/* 結果 / 進度的清單(.mock-res):rows = [{ id:"A", name:() => 文字, detail:() => 文字, mark:"ok" | "no" | "skip" | "cur" | "todo" }]
   名稱、說明用 pairText(中英高度一樣);右邊的記號:✓ 完成、✗ 沒有完成、– 跳過(用檢定書練)、▸ 進行中 */
const MARK = { ok: "✓", no: "✗", skip: "–", cur: "▸", todo: "·" };
export function renderRows(box, rows){
  box.innerHTML = "";
  box.classList.add("mock-res");
  for (const r of rows) {
    const d = document.createElement("div");
    if (r.mark === "cur") d.className = "cur";
    d.innerHTML = `<b></b><span class="mr-text"><span class="mr-name"></span><small class="mr-detail"></small></span><i class="${r.mark}" aria-hidden="true">${MARK[r.mark] || ""}</i>`;
    d.querySelector("b").textContent = r.id;
    box.appendChild(d);
    pairText(d.querySelector(".mr-name"), r.name);
    const det = d.querySelector(".mr-detail");
    if (r.detail) pairText(det, r.detail); else det.remove();
  }
}
/* 模擬考卡捲到頂欄下面(開始、結果、中止的說明):scrollTo top 在手機橫式、折疊機只看得到設定卡 */
export function cardToTop(card){
  if (!card || card.hidden || !card.getClientRects().length) { window.scrollTo({ top: 0 }); return; }
  const header = document.querySelector("header"), top = header ? header.getBoundingClientRect().bottom : 0;
  window.scrollTo({ top: Math.max(0, scrollY + card.getBoundingClientRect().top - top - 8) });
}
/* 模擬考卡的固定說明:practiceOnly + 不算總分 */
export const resultNote = () => tr("只有各項的練習回饋:不算總分、不換算成官方分數。", "Feedback per item only: no total, and it doesn't convert to an exam mark.") + " " + T("practiceOnly");
/* 開始 / 停止按鈕的文字 */
export const mockLabel = state => (state === "run" ? tr("停止模擬考", "Stop mock") : state === "idle" ? tr("開始模擬考", "Start mock") : tr("再考一次", "Again"));

/* 模擬考卡(模組的 $("mockCard") 裡固定的 id:mockTitle、mockSub、mockText、mockList、mockBtn、mockLabel、mockClose、mockCloseLabel、mockNote)。
   btn = { label:() => 文字, disabled } | null(藏起來);close = { label } | null;rows = renderRows 的格式(null = 沒有清單) */
export function paintCard($, { title, sub = "", text, rows = null, btn = null, close = null, note = resultNote }){
  pairText($("mockTitle"), title);
  $("mockSub").textContent = sub;
  const tx = text || (() => "");
  pairText($("mockText"), tx); $("mockText").hidden = !tx().trim();   // 沒有說明就不留空行
  const list = $("mockList");
  if (rows && rows.length) { list.hidden = false; renderRows(list, rows); } else { list.hidden = true; list.innerHTML = ""; }
  $("mockBtn").hidden = !btn;
  if (btn) { pairText($("mockLabel"), btn.label); $("mockBtn").disabled = !!btn.disabled; $("mockBtn").setAttribute("aria-label", btn.label()); }
  $("mockClose").hidden = !close;
  if (close) pairText($("mockCloseLabel"), close.label);
  $("mockBtn").parentElement.classList.toggle("one", !btn || !close);
  const nt = note || (() => "");   // note: null = 不寫(practiceOnly 已經在題目卡上)
  pairText($("mockNote"), nt); $("mockNote").hidden = !nt().trim();
}
