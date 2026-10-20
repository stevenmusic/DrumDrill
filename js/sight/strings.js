/* 視奏分頁的固定字串(HTML 上的 data-i18n="sight.xxx";程式產生的文字直接用 tr("中", "EN")) */
import { addStrings } from "../shared/i18n.js";
addStrings("sight", {
  tempo: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"],
  optMetro: ["準備時節拍器", "Prep click"], mockMetro: ["節拍器", "Metronome"], optClick: ["拍點", "Click"], bpmReset: ["官方速度", "Official tempo"],
  playAria: ["聽正確版本", "Hear the correct version"], playCap: ["正確版本", "Correct"],
  countdownUnit: ["秒", "s"],
  generate: ["下一題", "Next"],
  scoreTitle: ["鼓譜", "Drum part"],
  perform: ["正式打", "Perform"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天題數", "Today"], logMin: ["今天分鐘", "Minutes"],
  statsTitle: ["各分類練過題數", "Tests per type"]
});
