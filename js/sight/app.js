/* 視奏模組(準備中):先放中性的說明卡,題目照官方大綱整理好才做(不自己發明題目) */
import { tr, pairText } from "../shared/i18n.js";
const ROOT = document.getElementById("mod-sight");
function render(){ pairText(document.getElementById("s-soonText"), () => tr("題目正在照官方大綱整理。", "Questions are being built from the official syllabus.")); }
export async function start(){ render(); }
export function enter(){ render(); }
export function leave(){}
export function setExam(){}
export function relang(){ render(); }
export function examStatus(){ return tr("準備中", "Coming"); }
export function onKey(){}
void ROOT;
