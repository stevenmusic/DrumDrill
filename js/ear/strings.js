/* 聽力分頁的固定字串(HTML 上的 data-i18n="ear.xxx";程式產生的文字直接用 tr("中", "EN")) */
import { addStrings } from "../shared/i18n.js";
addStrings("ear", {
  tempo: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"],
  optHide: ["不看譜", "No chart"],
  gradeLbl: ["級數", "Grade"],
  playAria: ["聽題目", "Play the test"],
  countdownUnit: ["秒", "s"],
  next: ["下一題", "Next"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天題數", "Today"], logTotal: ["練過的題目", "Tests done"]
});
