/* 視奏分頁的固定字串(HTML 上的 data-i18n="sight.xxx";程式產生的文字直接用 tr("中", "EN")) */
import { addStrings } from "../shared/i18n.js";
addStrings("sight", {
  tempo: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"],
  optMetro: ["準備時節拍器", "Prep metronome"], optClick: ["正式打的拍點", "Perform click"], bpmReset: ["官方速度", "Official tempo"],
  playAria: ["聽正確版本", "Hear the correct version"],
  countdownUnit: ["秒", "s"],
  generate: ["新題目", "New test"],
  scoreTitle: ["小鼓譜", "Snare part"],
  perform: ["正式打", "Perform"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天題數", "Today"], logMin: ["今天分鐘", "Minutes"],
  statsTitle: ["各級練過題數", "Tests per grade"]
});
