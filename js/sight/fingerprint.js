/**
 * Test fingerprinting, so the same question does not come back within a
 * session. Hashing the musical content (key, metre, rhythm, pitches) rather
 * than the MusicXML means two tests that differ only in, say, their dynamic
 * marking still count as duplicates.
 */

// @app-begin
/* DrumDrill:題目 = 視奏的鼓譜(js/sight/gen.js 小鼓、js/shared/kitgen.js 整組鼓、js/shared/playbackgen.js Trinity Playback):
   系統、級數、拍號、小節數、每一個時值與休止符;整組鼓另外看鼓件與記號(開閉 HH、重音、鬼音、Flam / Drag、連結線)、自由發展的斜線、換拍號、力度。
   速度不算(同樣的節奏換速度還是同一題)。小鼓視奏的寫法跟以前一樣(只看時值,存著的出題歷史照樣有效)。
   PianoDrill 的版本在這一段看調性、音高(兩邊這一段不同,其他相同) */
const MARKS = ['open', 'closed', 'accent', 'ghost', 'flam', 'drag'];
const noteKey = (n) => n.piece + MARKS.filter((k) => n[k]).map((k) => k[0]).join('');
export function fingerprintOf(score) {
  const parts = score.system ? [score.system, score.grade, score.time, score.bars] : [score.grade, score.time, score.bars];
  const kit = !!score.system;
  for (const measure of score.measures) {
    if (measure.slash) { parts.push('/', '|'); continue; }
    if (measure.time) parts.push('T' + measure.time);
    for (const voice of measure.voices) {
      for (const event of voice) parts.push(kit && event.notes ? event.value + ':' + event.notes.map(noteKey).join('+') + (event.tie ? '~' : '') : event.value);
      if (kit) parts.push(';');
    }
    parts.push('|');
  }
  if (kit && score.dyn) for (const d of score.dyn) parts.push(`${d.m}@${d.beat}${d.mark}`);
  return hash(parts.join('|'));
}
// @app-end

/** FNV-1a, 32-bit, rendered as hex. */
function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}

/** Ring buffer of recent fingerprints. */
export function createHistory({ capacity = 50, load, save } = {}) {
  let entries = load?.() ?? [];

  return {
    has: (fingerprint) => entries.includes(fingerprint),
    add(fingerprint) {
      entries = [fingerprint, ...entries.filter((item) => item !== fingerprint)].slice(0, capacity);
      save?.(entries);
    },
    clear() {
      entries = [];
      save?.(entries);
    },
    get size() {
      return entries.length;
    },
  };
}

/**
 * Generate until the result is not in recent history.
 * @param {() => object} produce
 */
export function generateUnique(produce, history, attempts = 12) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const score = produce();
    const fingerprint = fingerprintOf(score);
    last = { score, fingerprint };
    if (!history.has(fingerprint)) {
      history.add(fingerprint);
      return last;
    }
  }
  // Every attempt collided (a very small rule space, e.g. Grade 1 in 2/4):
  // return the last one rather than looping forever.
  history.add(last.fingerprint);
  return last;
}
