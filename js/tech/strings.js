/* 基本打法分頁的固定字串(HTML 上的 data-i18n="tech.xxx") */
import { addStrings } from "../shared/i18n.js";
addStrings("tech", {
  pickTitle: ["基本打法", "Rudiments"],
  lblRud: ["打法", "Rudiment"], lblLead: ["起手", "Lead"], lblReps: ["反覆", "Repeats"],
  play: ["播放示範", "Play"], stop: ["停止", "Stop"],
  good: ["會了", "Got it"], weak: ["再練", "Needs work"],
  mGood: ["會了", "Got it"], mWeak: ["再練", "Needs work"],   // 熟練度按鈕上的小字(圖示旁)
  scoreTitle: ["鼓譜與左右手(R 右 · L 左)", "Score & sticking (R right · L left)"],
  metroTitle: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"], tempo: ["速度", "Tempo"],
  optLoop: ["循環播放", "Loop"], optRamp: ["每輪加快 4", "+4 each loop"], optClick: ["只聽拍點", "Click only"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天次數", "Today"], logMin: ["今天分鐘", "Minutes"],
  examTitle: ["本級要求", "This grade"],
  bestLabel: ["示範最快", "Demo best"],
  draw: ["隨機抽一項", "Random"], next: ["下一項", "Next"],
  targetList: ["回到本級要求", "Back to the grade list"], targetClose: ["離開目標(速度回到自己的設定)", "Leave target (back to your tempo)"],
  rScoreTitle: ["鼓譜", "Drum part"]   // 今日練習的路線段(js/tech/route.js)
});
/* 今日練習完成那一行:共用的英文「{s} parts」在 1 段時會變成「1 parts」;共用字串(i18n.js / dailycard.js)改之前,DrumDrill 先換成不用單複數的寫法 */
addStrings("daily", { done: ["今天練完了:{s} 段 · {m} 分鐘 · 過了 {p} 關", "Done today · parts {s} · {m} min · passed {p}"] });
