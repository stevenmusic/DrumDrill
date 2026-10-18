/* 考試資料(data/exam-rsl.json、data/exam-trinity.json、data/drumkey.json)的載入與查詢。
   - 資料逐筆照官方大綱整理(docs/sources/*.md),每個有數值的節點都帶 src.p(頁碼);官方沒寫的是 null 或 assumed:true
     (tools/test/checks/examdata.mjs 檢查,verify.mjs 會跑)
   - loadExam(system) / loadDrumKey():網址帶 index.html 的版本指紋(pdVersions,tools/build/stamp.mjs 產生),
     讀過的放在記憶體;讀不到(離線又沒快取、檔案壞掉)回 null,下次再試
   - 下面的查詢都是純函式(資料當參數;沒給就用已經載入的那份),不碰 DOM、不 import i18n,Node 可以直接測
   時值代號(STAGES.md §2):1 2 2. 4 4. 8 8. 16 16. 32;連音 8t3 4t3 16t3 16t5 16t6 16t7 32t9 32t10;二連音 dup;休止符前面加 r */

export const SYSTEMS = ["rsl", "trinity"];
export const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const VALUE_CODES = ["1", "2", "2.", "4", "4.", "8", "8.", "16", "16.", "32", "8t3", "4t3", "16t3", "16t5", "16t6", "16t7", "32t9", "32t10", "dup"];
export const isValueCode = c => VALUE_CODES.includes(c);
export const isRestCode = c => typeof c === "string" && c[0] === "r" && VALUE_CODES.includes(c.slice(1));

/* ── 載入(瀏覽器)── */
const loaded = {};    // 檔名 → 資料(已經讀到的)
const pending = {};   // 檔名 → Promise(讀取中)
function versions(){
  try { return JSON.parse(document.getElementById("pdVersions").textContent) || {}; } catch (e) { return {}; }
}
function loadFile(file, valid){
  if (loaded[file]) return Promise.resolve(loaded[file]);
  if (pending[file]) return pending[file];
  const v = versions()[file];
  return pending[file] = Promise.resolve().then(() => fetch(file + (v ? "?v=" + v : "")))
    .then(r => (r.ok ? r.json() : null))
    .then(d => (d && valid(d) ? (loaded[file] = d) : null))
    .catch(() => null)
    .finally(() => { delete pending[file]; });
}
/* 考試資料:system = "rsl" | "trinity" → Promise<資料 | null> */
export function loadExam(system){
  if (!SYSTEMS.includes(system)) return Promise.resolve(null);
  return loadFile(`data/exam-${system}.json`, d => d.system === system);
}
/* 鼓組記譜圖例 → Promise<資料 | null> */
export const loadDrumKey = () => loadFile("data/drumkey.json", d => !!d.pieces);
/* 已經載入的那份(還沒載入或讀不到是 null) */
export const examCached = system => loaded[`data/exam-${system}.json`] || null;
export const drumKeyCached = () => loaded["data/drumkey.json"] || null;

/* ── 查詢(純函式)── */
const okGrade = g => GRADES.includes(g);
const union = (a, b) => [...a, ...b.filter(x => !a.includes(x))];
const LISTS = ["time", "values", "rests", "dyn", "pieces", "extra"];
const SCALARS = ["total", "phrase", "voices", "voicesAmount"];

/* Trinity Playback 參數(累積):Initial 到 grade 每一級的「新增」合起來;
   清單(拍號、時值、休止符、力度/奏法、鼓件、其他)取聯集,長度與聲部取最近一級有寫的。
   回傳 { grade, total, phrase, time, values, rests, dyn, pieces, voices, voicesAmount, extra, from, src, flow };
   from[欄位] = 那一欄的值來自哪一級(UI 標出處用);src = 用到的頁碼。資料沒有或級數不對回 null */
export function playbackFor(grade, data = examCached("trinity")){
  const G = data && data.playback && data.playback.grades;
  if (!G || !okGrade(grade)) return null;
  const out = { grade, total: null, phrase: null, voices: null, voicesAmount: null, from: {}, src: [] };
  for (const k of LISTS) out[k] = [];
  for (let g = 0; g <= grade; g++) {
    const d = G[String(g)]; if (!d) return null;
    for (const k of LISTS) if (Array.isArray(d[k])) { out[k] = union(out[k], d[k]); if (d[k].length) out.from[k] = g; }
    for (const k of SCALARS) if (k in d) { out[k] = d[k]; out.from[k] = g; }
    if (d.src && d.src.p && !out.src.includes(d.src.p)) out.src.push(d.src.p);
  }
  out.flow = data.playback.flow || null;
  return out;
}

/* RSL 技巧:這一級每一組的每一項攤平成一張清單(依組別、順序)。
   每項 = 原本的項目({kind:"pas", no} / {kind:"pattern", pas, value, sticking?} / {kind:"book", label, related})
   加上 key("rsl-3-D-1",練習紀錄用)、group(組別字母)、groupName、bpm、bpmSrc、src(頁碼)、note(項目的,沒有就用組的)。
   Trinity 沒有技巧項目 → []。資料沒有或級數不對 → [] */
export function techItems(g, data = examCached("rsl")){
  const t = data && data.tech && data.tech[String(g)];
  if (!t || !okGrade(g)) return [];
  const sys = data.system || "rsl";
  return t.groups.flatMap(gr => gr.items.map((it, i) => ({
    ...it, key: `${sys}-${g}-${gr.id}-${i + 1}`, group: gr.id, groupName: gr.name,
    bpm: gr.bpm, bpmSrc: gr.bpmSrc, src: t.src, note: it.note || gr.note || null
  })));
}
/* 這一級用到的 PAS 編號(去掉重複;examStatus 的「已會 n/m」、清單的「已會」狀態用):
   kind:"pas" 的 no,加上 kind:"pattern" 的 pas——pattern 是「PAS 的左右手 + 大綱時值」,熟練度(已經會了 / 待加強)
   一律記在那個 PAS 編號上(技巧分頁的 mastery[no]),不另外記一份;book 的 related 只是參考,不算 */
export const techPasNos = (g, data) => [...new Set(techItems(g, data).flatMap(it => it.kind === "pas" ? [it.no] : it.kind === "pattern" ? [it.pas] : []))];
