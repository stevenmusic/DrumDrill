/* 視奏模組(準備中):先放說明卡,規則照官方大綱整理好才做(不自己發明題目) */
import { tr, pairText } from "../shared/i18n.js";
const ROOT = document.getElementById("mod-sight");
function render(){ pairText(document.getElementById("s-soonText"), () => tr("鼓譜視奏(準備中):依級數出節奏,五線鼓譜上大鼓、小鼓、Hi-hat、筒鼓分開寫;30 秒準備、聽正確版本比對。題目規則要先照 Trinity / RSL 的官方大綱與範例整理,整理好才會放上來。", "Drum-kit sight-reading (coming): graded rhythms on a five-line kit staff (kick, snare, hi-hat, toms), 30-second preparation, then hear it played. Built only from the official Trinity / RSL syllabuses and specimens.")); }
export async function start(){ render(); }
export function enter(){ render(); }
export function leave(){}
export function setExam(){}
export function relang(){ render(); }
export function examStatus(){ return tr("準備中", "Coming"); }
export function onKey(){}
void ROOT;
