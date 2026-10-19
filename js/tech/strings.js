/* 基本打法分頁的固定字串(HTML 上的 data-i18n="tech.xxx") */
import { addStrings } from "../shared/i18n.js";
addStrings("tech", {
  pickTitle: ["基本打法", "Rudiments"],
  lblRud: ["打法", "Rudiment"], lblLead: ["起手", "Lead"], lblReps: ["反覆", "Repeats"],
  play: ["播放示範", "Play"], stop: ["停止", "Stop"],
  good: ["已經會了", "Got it"], weak: ["待加強", "Needs work"],
  mGood: ["會了", "Got it"], mWeak: ["待加強", "Practise"],   // 熟練度按鈕上的小字(圖示旁)
  scoreTitle: ["鼓譜與左右手", "Score & sticking"],
  metroTitle: ["速度", "Tempo"],
  bpmDown: ["慢 1(按住連續減少)", "Slower (hold)"], bpmUp: ["快 1(按住連續增加)", "Faster (hold)"], tempo: ["速度", "Tempo"],
  optLoop: ["循環播放", "Loop"], optRamp: ["每輪 +4", "+4 / loop"], optClick: ["只聽拍點", "Click only"],
  logTitle: ["練習紀錄", "Practice log"], logStreak: ["連續天數", "Day streak"], logToday: ["今天次數", "Today"], logMin: ["今天分鐘", "Minutes"],
  examTitle: ["本級要求", "This grade"],
  bestLabel: ["示範最快", "Demo best"],
  draw: ["隨機抽一項", "Random"], next: ["下一項", "Next"],
  targetList: ["回到本級要求", "Back to the grade list"], targetClose: ["離開目標(速度回到自己的設定)", "Leave target (back to your tempo)"]
});
