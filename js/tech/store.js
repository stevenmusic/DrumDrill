/* 基本打法分頁的設定與紀錄(localStorage;讀不到就用預設值) */
import { cleanLog } from "../shared/practicelog.js";
const KEY = "drumdrill.tech.v1";
let S = null;
export function load(){
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  S = { cat: "roll", pick: {}, lead: "R", reps: 4, bpm: {}, mastery: {}, best: {}, loop: false, ramp: false, clickOnly: false, log: {}, ...(S || {}) };
  S.log = cleanLog(S.log);   // 讀進來先消毒(日期格式、數字)
  // 第一次進來各類的一行說明:播放過一次的類別 = true
  const intro = {}; if (S.intro && typeof S.intro === "object") for (const k of ["roll", "diddle", "flam", "drag"]) if (S.intro[k] === true) intro[k] = true;
  S.intro = intro;
  return S;
}
export function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
