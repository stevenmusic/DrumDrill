// MusicXML → 擊打事件(獨立於 js/shared/kitevents.js 的 toEvents,檢查「播放的拍位 = 譜上的音」用;gen-kit.mjs、gen-ear.mjs 共用)
// 只看 MusicXML:<time> 算小節長度、<duration> / <backup> 算位置、<chord/> 同一個位置、<grace> 裝飾音另外數、
// <tie type="stop"/> = 連結線接續(不出聲)、<notehead>slash</notehead> = 自由發揮(不出聲)、休止符不出聲;
// 鼓件 = 符頭位置 + 形狀照 drumkey.json(手打 HH 看 <open/>、<stopped/>;單線譜一律小鼓)
const D = 2520;
export function xmlEvents(xml, key, lines = 5){
  const POS = {};
  for (const [id, p] of Object.entries(key.pieces)) (POS[`${p.step}${p.oct}:${p.head}`] = POS[`${p.step}${p.oct}:${p.head}`] || []).push(id);
  const out = [], graces = [], slash = [];
  let barStart = 0, len = 4 * D;
  for (const mm of xml.matchAll(/<measure number="(\d+)">([\s\S]*?)<\/measure>/g)) {
    const body = mm[2];
    const tm = /<time[^>]*><beats>([\d+]+)<\/beats><beat-type>(\d+)<\/beat-type><\/time>/.exec(body);
    if (tm) len = tm[1].split("+").map(Number).reduce((a, b) => a + b, 0) * 4 / Number(tm[2]) * D;
    let t = 0, start = 0;
    for (const el of body.matchAll(/<note(?: print-object="no")?>([\s\S]*?)<\/note>|<backup><duration>(\d+)<\/duration><\/backup>/g)) {
      if (el[2]) { t -= Number(el[2]); continue; }
      const n = el[1];
      const beatOf = s => +((barStart + s) / D).toFixed(4);
      if (n.includes("<grace")) { graces.push(beatOf(t)); continue; }
      if (!n.includes("<chord/>")) { start = t; t += Number((/<duration>(\d+)<\/duration>/.exec(n) || [])[1]); }
      if (n.includes("<rest")) continue;
      if (/<notehead[^>]*>slash<\/notehead>/.test(n)) { slash.push(beatOf(start)); continue; }
      if (n.includes('<tie type="stop"/>')) continue;
      const st = /<display-step>(\w)<\/display-step><display-octave>(\d)<\/display-octave>/.exec(n), head = (/<notehead[^>]*>([\w-]+)<\/notehead>/.exec(n) || [, "normal"])[1];
      let piece;
      if (lines === 1) piece = key.singleLine.piece;
      else {
        const ids = POS[`${st[1]}${st[2]}:${head}`] || ["?"];
        piece = ids.includes("hh") ? (n.includes("<open ") ? "hhOpen" : n.includes("<stopped ") ? "hhClosed" : "hh") : ids[0];
      }
      out.push({ beat: beatOf(start), piece });
    }
    barStart += len;
  }
  return { hits: out, graces, slash, beats: barStart / D };
}
/* 事件清單 → 比較用的字串(拍位四捨五入到 0.001 拍;鼓件) */
export const evKey = evs => evs.map(e => `${(+e.beat).toFixed(3)}:${e.piece}`).sort().join(" ");
/* 兩份事件不一樣的地方(最多 n 個) */
export function evDiff(a, b, n = 3){
  const A = evKey(a).split(" "), B = evKey(b).split(" "), out = [];
  const cnt = arr => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const ca = cnt(A), cb = cnt(B);
  for (const [k, v] of ca) if ((cb.get(k) || 0) < v) out.push("多 " + k);
  for (const [k, v] of cb) if ((ca.get(k) || 0) < v) out.push("少 " + k);
  return out.slice(0, n);
}

const TYPE = { whole: "1", half: "2", quarter: "4", eighth: "8", "16th": "16", "32nd": "32" };
/* MusicXML 用到的時值 / 休止符(不含斜線、不印的音;連音寫成 8t3、16t6 這種代號)*/
export function xmlCodes(xml){
  const values = new Set(), rests = new Set();
  for (const m of xml.matchAll(/<note( print-object="no")?>([\s\S]*?)<\/note>/g)) {
    const n = m[2];
    if (m[1] || n.includes("<grace") || /slash<\/notehead>/.test(n)) continue;
    if (/<rest measure="yes"/.test(n)) { rests.add("r1"); continue; }
    const type = TYPE[(/<type>(\w+)<\/type>/.exec(n) || [])[1]], tm = /<actual-notes>(\d+)<\/actual-notes>/.exec(n);
    const code = type + (n.includes("<dot/>") ? "." : "") + (tm ? "t" + tm[1] : "");
    (n.includes("<rest") ? rests : values).add(n.includes("<rest") ? "r" + code : code);
  }
  return { values, rests };
}

