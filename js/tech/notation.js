/* 基本打法 → MusicXML(OSMD 畫)。照 PAS 官方表的寫法:單線譜、符桿朝上、不印拍號;
   Flam = 一個帶斜線的八分裝飾音、Drag = 兩個十六分裝飾音(都有連線接到主音);
   滾奏 = 音符加斜線(tremolo)、滾奏音到放開的那個音之間有連線;多次反彈 = 音符上的 z(OSMD 不會畫,app.js 自己補)。
   左右手(R / L)不用歌詞:app.js 照音符位置自己畫在下面(裝飾音的字比較小),跟官方表一樣 */
import { DIV } from "./rudiments.js";

const TYPE = { "32": "32nd", "16": "16th", "8": "eighth", "8.": "eighth", "4": "quarter", "2": "half" };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* 一組連桿裡每一層的 begin / continue / end / 單獨一個時的短桿(hook) */
function beamLevels(group){
  const out = group.map(() => []);
  const max = Math.max(0, ...group.map(n => (n.rest ? 0 : n.beams)));
  if (group.filter(n => !n.rest && n.beams >= 1).length < 2) return out;
  for (let L = 1; L <= max; L++) {
    const has = group.map(n => !n.rest && n.beams >= L);
    for (let i = 0; i < group.length; i++) {
      if (!has[i]) continue;
      const prev = i > 0 && has[i - 1], next = i + 1 < group.length && has[i + 1];
      if (prev && next) out[i].push([L, "continue"]);
      else if (!prev && next) out[i].push([L, "begin"]);
      else if (prev && !next) out[i].push([L, "end"]);
      else if (L > 1) out[i].push([L, i + 1 < group.length ? "forward hook" : "backward hook"]);
    }
  }
  return out;
}

// 單線譜:E4 剛好畫在線上(OSMD 的單線打擊樂譜)
export let PITCH = "<unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched>";
export const setPitch = (s, o) => { PITCH = `<unpitched><display-step>${s}</display-step><display-octave>${o}</display-octave></unpitched>`; };

/* reps:反覆幾次(> 1 時畫反覆記號,右上角寫 ×N) */
export function rudimentXML(groups, { reps = 1, title = "" } = {}){
  const total = groups.flat().reduce((s, n) => s + n.dur, 0);
  const notes = [];
  let slurOpen = false;
  const flat = groups.flatMap((g, gi) => g.map((n, i) => ({ n, gi, i })));
  const tupletPos = new Map();   // 三連音、六連音:每 n 個一組,標「開始 / 結束」
  for (let k = 0; k < flat.length;) {
    const t = flat[k].n.tuplet;
    if (!t) { k++; continue; }
    for (let j = 0; j < t && k + j < flat.length; j++) tupletPos.set(k + j, j === 0 ? "start" : j === t - 1 ? "stop" : "");
    k += t;
  }
  groups.forEach((g, gi) => {
    const levels = beamLevels(g);
    g.forEach((n, i) => {
      const idx = flat.findIndex(f => f.gi === gi && f.i === i);
      if (n.rest) {
        notes.push(`<note><rest/><duration>${n.dur}</duration><voice>1</voice><type>${TYPE[n.value]}</type></note>`);
        return;
      }
      // 裝飾音
      if (n.flam) notes.push(`<note><grace slash="yes"/>${PITCH}<voice>1</voice><type>eighth</type><stem>up</stem><notations><slur type="start" number="2" placement="below"/></notations></note>`);
      if (n.drag) {
        notes.push(`<note><grace/>${PITCH}<voice>1</voice><type>16th</type><stem>up</stem><beam number="1">begin</beam><beam number="2">begin</beam><notations><slur type="start" number="2" placement="below"/></notations></note>`);
        notes.push(`<note><grace/>${PITCH}<voice>1</voice><type>16th</type><stem>up</stem><beam number="1">end</beam><beam number="2">end</beam></note>`);
      }
      const nt = [];
      if (n.flam || n.drag) nt.push('<slur type="stop" number="2"/>');
      // 滾奏:滾奏音到下一個音之間有連線(官方表的寫法)
      if (slurOpen) { nt.push('<slur type="stop" number="1"/>'); slurOpen = false; }
      const next = flat[idx + 1];
      if ((n.trem || n.buzz) && next && !next.n.rest) { nt.push('<slur type="start" number="1" placement="below"/>'); slurOpen = true; }
      const tp = tupletPos.get(idx);
      if (tp === "start") nt.push(`<tuplet type="start" bracket="no" show-number="actual"/>`);
      if (tp === "stop") nt.push(`<tuplet type="stop"/>`);
      if (n.accent) nt.push("<articulations><accent placement=\"above\"/></articulations>");
      if (n.trem) nt.push(`<ornaments><tremolo type="single">${n.trem}</tremolo></ornaments>`);
      const tm = n.tuplet ? `<time-modification><actual-notes>${n.tuplet}</actual-notes><normal-notes>${n.tuplet === 3 ? 2 : 4}</normal-notes><normal-type>16th</normal-type></time-modification>` : "";
      notes.push(`<note>${PITCH}<duration>${n.dur}</duration><voice>1</voice><type>${TYPE[n.value]}</type>${n.value === "8." ? "<dot/>" : ""}${tm}<stem>up</stem>` +
        levels[i].map(([L, v]) => `<beam number="${L}">${v}</beam>`).join("") +
        (nt.length ? `<notations>${nt.join("")}</notations>` : "") + `</note>`);
    });
  });
  const beats = total / DIV;
  const left = reps > 1 ? `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>` : "";
  const right = reps > 1 ? `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="${reps}"/></barline>`
    : `<barline location="right"><bar-style>light-heavy</bar-style></barline>`;
  const words = reps > 1 ? `<direction placement="above"><direction-type><words font-size="11">×${reps}</words></direction-type></direction>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${esc(title)}</work-title></work>
<part-list><score-part id="P1"><part-name print-object="no">Snare</part-name></score-part></part-list>
<part id="P1"><measure number="1">${left}<attributes><divisions>${DIV}</divisions><key print-object="no"><fifths>0</fifths></key>
<time print-object="no"><beats>${beats}</beats><beat-type>4</beat-type></time>
<clef><sign>percussion</sign></clef><staff-details><staff-lines>1</staff-lines></staff-details></attributes>
${words}${notes.join("\n")}${right}</measure></part></score-partwise>`;
}
