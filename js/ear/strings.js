/* 聽力分頁的固定字串(HTML 上的 data-i18n="ear.xxx";程式產生的文字直接用 tr("中", "EN")) */
import { addStrings } from "../shared/i18n.js";
addStrings("ear", {
  xList: ["本級聽力", "This grade's tests"],   // 檢定頁的清單(畫面設計 2026-10)
  tempo: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"],
  optHide: ["不看譜", "No chart"],
  playAria: ["聽題目", "Play the test"], playCap: ["題目", "Question"],
  countdownUnit: ["秒", "s"],
  next: ["下一題", "Next"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天題數", "Today"], logAcc: ["今天打中率", "Today's hit rate"],
  statsTitle: ["各題型正確率", "Accuracy by test"]
});
