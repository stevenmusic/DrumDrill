/* 聽音模組(準備中):先放說明卡,規則照官方大綱整理好才做(不自己發明題目) */
import { tr, pairText } from "../shared/i18n.js";
const ROOT = document.getElementById("mod-ear");
function render(){ pairText(document.getElementById("e-soonText"), () => tr("節奏聽力(準備中):聽一段節奏或過門,在鼓墊上打回來、App 自動批改。題目要先照 Trinity / RSL 的官方聽力要求整理,整理好才會放上來。", "Rhythm ear tests (coming): hear a groove or fill and play it back on your pad, marked automatically. Built only from the official Trinity / RSL requirements.")); }
export async function start(){ render(); }
export function enter(){ render(); }
export function leave(){}
export function setExam(){}
export function relang(){ render(); }
export function examStatus(){ return tr("準備中", "Coming"); }
export function onKey(){}
void ROOT;
