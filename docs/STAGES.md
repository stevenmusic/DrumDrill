# DrumDrill 1.0 分階段實作規格(交給實作者)

> 規劃日期 2026-10-18,依據 `0c974c9` 的程式碼、`docs/ROADMAP.md`(含 Sonnet 審查意見與「使用者決定」)、`docs/sources/rsl-drums.md`(下稱 **[RSL]**,頁碼是 2026-06 版 PDF)、`docs/sources/trinity-drums.md`(下稱 **[TR]**,內部再引 [RP]/[DK]/[ERR])。
> 這次只讀檔、沒有改任何檔案。另外讀了 ScrollScore 網頁版(`raw.githubusercontent.com/stevenmusic/ScrollScore/main/index.html` 的鼓引擎;repo 裡沒有 `js/shared/audio.js`,鼓引擎寫在 index.html 第 8860–9200 行附近),也讀了 PianoDrill 的 `CLAUDE.md`、`js/sight/mic.js`、`js/sight/scoring.js` 當作前例,沒有動到它們。

---

## 0. 使用方式與共同規則(每個 Stage 都適用)

1. **一次只做一個 Stage**,照編號依序做。完成條件:這個 Stage 列出的測試全部通過,並跑完 `node tools/build/stamp.mjs` → `node tools/test/verify.mjs` → `layout.mjs`、`bilingual.mjs`、`human.mjs 150 3`(瀏覽器測試三支)。
2. **push 前先打 tag**:`git tag pre-sN`(線上 GitHub Pages 就是 main,出問題可以馬上回滾)。push 之後照 CLAUDE.md,用中文條列說明改了什麼、為什麼改。
3. **每個 Stage 做完,線上都不能出現壞掉的畫面**。還沒做到的級數或題型,顯示一行「這一級的〇〇練習還在做」。最後的 S16 要確認全站已經沒有這種字樣,才可以送審。
4. **來源標示(全 App 統一三種)**:
   - **官方**:小字寫「RSL p.42」或「Trinity R&P p.62」。
   - **推估**:大綱沒寫,App 先採用某個做法。顯示一個小標籤 `推估` / `Assumed`,點開看理由(照 PianoDrill 的 `confidenceInferred` 做法)。
   - **練習設定**:App 自訂的值,例如練習速度、評分容許範圍。標「練習設定」/「Practice setting」。
5. **固定的免責文字**(i18n key `practiceOnly`):中文「僅供練習;實際要求以官方大綱為準」,英文「Practice only — the official syllabus is final」。每一張 App 產生的題目卡、每一張檢定要求卡都要放。
6. **純函式**:出題器、計分、資料驗證(`gen.js`、`timing.js`、`examdata.js` 的驗證部分)不能 import DOM 或 `i18n.js`,這樣 Node 才能直接測。顯示文字只回傳 key 或 `[中, 英]` 陣列。
7. **id 前綴**:技巧 `t-`、視奏 `s-`、聽力 `e-`,新的外框元素不加前綴。注意:`css/app.css` 留有 PianoDrill 的 `#s-setup`、`#s-scoreCard`、`#s-logCard`、`#e-quizCard`、`#e-logCard`、`#e-mockBtn`、`#e-statsCard` 等規則。新元素用到同名 id 時會**自動套上那些樣式**,要嘛刻意沿用,要嘛換 id。審查員每個 Stage 都要檢查這一點。

---

## 1. 關鍵設計決定(決定 + 理由)

### 決定 1:Trinity Rock & Pop 沒有技巧、視奏、聽力時,三個子項目顯示什麼
子項目固定是 技巧/視奏/聽力(使用者決定),每一頁的內容依考試系統決定。

| 子項目 | RSL | Trinity Rock & Pop |
|---|---|---|
| 技巧 | 各級技巧組清單(速度 + 頁碼)。能對到 PAS 的一鍵去練;依大綱時值的練習型(S4) | 說明卡:「沒有獨立技巧項目,技巧在 Song 3(技巧重點曲)評:Technical control 12 分,Song 1、2 是 8 分」[TR §2.3、2.4,RP p.22–23、35、53]。附上自選曲參數表的「Techniques」欄,官方註明只是一般指引 [RP p.55–59];能對到 PAS 類別的(例如「含裝飾音的 rudiment」→ Flam/Drag 類)放類別入口,標「依參數表的類別,官方沒有指定哪一個打法」。另外提供 PAS 自由練習的入口 |
| 視奏 | Debut–3:小鼓 4 小節(S8);4–5:整組鼓 8 小節(S9);6–8:Quick Study Piece 說明卡(見決定 5) | 說明卡:「沒有獨立視奏;最接近的是 Session skills 的 Playback(看譜 30 秒,有譜可看)」[RP p.60]。練習內容是**依 Playback 參數表產生的 song chart「看譜練習」**(S10/S11),速度標「練習速度(官方沒寫)」,使用者自己調 |
| 聽力 | Fill Playback & Recognition、Groove Recall(S12) | **Playback 一句聽、一句回打**(S13),一樣用 Playback 參數表;另外附 Improvising 說明卡(不提供練習,見決定 5) |

**Trinity Drum Kit & Percussion 系列:1.0 不採用,也不做「參考」連結。** 理由:
1. 使用者選的考試系統是 Rock & Pop,另一個系列有獨立的技巧、視奏、聽力,而且規則不一樣。混在一起,使用者會以為 Rock & Pop 也要考 rudiments 表。
2. CLAUDE.md 寫明 Trinity = Rock & Pop。
3. PianoDrill 的前例是「不拿另一套規則充數」。

如果之後要加,要當成第三個考試系統(`trinity-dk`),自己有一份資料檔,不能放進 Rock & Pop 的頁面。這件事寫進 CLAUDE.md(見 §4)。

### 決定 2:RSL 技巧的譜只在付費書裡,App 怎麼呈現
每一組技巧的每一項,在資料檔裡分成三種 `kind`:
- **`pas`(直接用 PAS 原譜)**:大綱**沒寫時值**,或寫的時值跟 PAS 表一樣。按「練習」→ 跳到技巧分頁的那個打法,速度設成官方值。例如 5 級 C 組 Flam accent ♩=80,直接用 PAS #21。
- **`pattern`(PAS 左右手 + RSL 時值)**:大綱寫的時值跟 PAS 表不同。例如 Debut「Paradiddles,八分音符 ♩=70」,PAS #16 原本是十六分音符。
  - 這時候不能只把速度減半:那樣譜上的時值不對,而且 Single strokes 八分音符換算成 PAS #1 的 32 分音符是 ♩=17.5,比 App 的最低速度 30 還低。
  - 所以用 PAS 的左右手、重音、裝飾音,改用 RSL 寫的時值重排一個循環(S4)。標「App 依大綱參數排的練習型,不是官方譜面」。
- **`book`(只列名稱)**:ruffs、roll phrases、combined rolls、alternative paradiddle-diddle、hands and feet patterns、Fill、Stylistic Study。
  - 只列名稱、速度、頁碼,加一句「譜見官方檢定書」。
  - roll phrase 加「相關 PAS 打法」的入口(#7/#9/#10),標「樂句本身見檢定書」。
- **用整組鼓、Tom、大鼓跟右手**這類編配([RSL] 2B、3B、3C、3E、4B、5B、6D、7B、7E、8B、8E):App 只在小鼓上練左右手,註明「官方要求用整組鼓,怎麼分配見檢定書」。
- **「隔小節交替」「第一次單擊、反覆雙擊」**:拍號和小節長度大綱沒寫。拆成每一種時值一個選項,各自循環,註明「官方:隔小節交替(拍號見檢定書)」。不自己編小節結構。

### 決定 3:鼓組記譜圖例
- **PAS Norman Weinberg《Guide to Standardized Drumset Notation》**:確實是 PAS 出版的(56 頁平裝,Hal Leonard 經銷 HL 06620063,約 9–18 美元)。**網路上沒有公開的官方 PDF**,本環境沒辦法查證內容(只查到零售頁和維基百科的轉述)。結論:**可以當依據,但要使用者買書,逐項抄出位置、附頁碼,才算「官方」**。這件事列為待辦。
- **公開資料能確認的只有**:
  - 用腳踩 HH = × 符頭寫在線下 [DK p.107]
  - 開 HH = o、閉 HH = + [DK p.107]
  - Ride bell = 菱形符頭、在最上面那一線 [ERR,Trinity R&P 勘誤]
  - 注意:前兩項來自 Drum Kit 系列,只能當「記號寫法」的佐證,不能當 Rock & Pop 的考試規定。
- **App 的做法**:
  1. 新增 `data/drumkey.json`。每個鼓件有 `step/octave/notehead/src`,`src` 是 `{doc,p}` 或 `"app"`。沒有官方來源的用常見寫法(大鼓第一間、小鼓第三間、筒鼓、Ride 最上線 ×、HH 線上方 ×、Crash 上加線 ×、腳踩 HH 線下 ×),標 `src:"app"`。
  2. **每一張整組鼓的譜上方一律放圖例**,用 OSMD 畫一行樣張,下面寫鼓件名稱。圖例卡寫「App 採用的記譜方式;考試用書可能不同,以書上的圖例為準」。
  3. 使用者買到 Weinberg 指南、或任何官方曲本的 drum key 後,只要改 `drumkey.json` 的 `src`,不用改程式。
- **RSL Debut–3 視奏、RSL 聽力的 Fill 都只用小鼓**:用現有的單線譜引擎,不需要圖例。

### 決定 4:出題器的白名單
- 每一級的元素(時值、休止符、拍號、鼓件、小節數、速度、選項數)只能從 `data/exam-*.json` 讀,每一筆有頁碼。
- **「組合方式」**(哪些時值放在同一拍、groove 的骨架)是出題器的設計,照使用者決定 3 允許。但要分兩層:
  - 只用單一時值的「基本拍型」:直接允許。
  - 混合時值的拍型(例如 ♪ + ♬):放在資料裡,標 `assumed:true`,介面顯示「推估」。
- **官方查不到的參數**:
  - 能用練習設定代替的(速度、預備拍),標「練習設定」。
  - 不能代替的(例如 QSP 的時值、聽力的風格清單):**不出那一題**,只寫說明。

### 決定 5:需要伴奏音軌的項目
App 只有鼓的取樣,CLAUDE.md 又禁止合成聲音,所以不能做伴奏。
- **RSL Quick Study Piece(6–8)**:說明卡寫 12 小節、lead sheet、3 分鐘研讀、播兩次、風格跟 Stylistic Study 一樣(p.57–59、62–64、67–69),標明拍號、時值、速度查不到,**App 不出題**。提供一個入口「改練 5 級整組鼓視奏(依 5 級參數)」,明確標示是 5 級。
- **RSL Improvisation & Interpretation(1–5)、Trinity Improvising**:只放說明卡,寫「需要伴奏音軌,App 不提供」。
- **Trinity Playback、RSL Fill 的 groove 部分**:官方有伴奏,App 改成「只有鼓 + 拍點」,題目卡寫「官方是配伴奏音軌;App 只有拍點」。

### 決定 6:觸控鼓墊與麥克風
- **觸控鼓墊放進 1.0**(S7 做共用元件,視奏、聽力都用)。
  - 時間換算:`pointerdown` 的 `event.timeStamp` 透過 `AudioContext.getOutputTimestamp()` 換成音訊時間;不支援時用 `currentTime` 對 `performance.now()` 當備援。
  - **延遲校正照 PianoDrill 的 `scoring.js`**:取整體偏移的中位數,先扣掉再評分,並顯示「整體慢約 X 毫秒(已先扣掉)」。偏移上限 ±250 毫秒,超過就不扣、改成提醒。這樣不需要另外做校正流程。
- **麥克風放進 1.0,但是選用功能,而且排在最後(S15)**。
  - 照 PianoDrill 的 `mic.js` + `scoring.js`:整段錄完才在裝置上分析起音時間,不用即時 AudioWorklet;不存檔、不上傳;只評時間,不分左右手、不分鼓件。
  - 理由:PianoDrill 已經有同樣功能,而且鼓的起音比鋼琴清楚。
  - 如果 S15 實機測試不過,可以整個拿掉,不影響其他 Stage。
- **容許範圍是練習設定**:命中 = |誤差| ≤ min(80 ms, max(40 ms, 0.3 × 最短音符間隔))。結果畫面不能跟官方等第(Pass、Merit、Distinction)放在同一個畫面,也不能換算成官方分數。

### 決定 7:模擬考、練習紀錄
- **練習紀錄放進 1.0**:S1 改成共用的 `drumdrill.log.v1`;三個模組都有紀錄卡,版型跟技巧一樣。**不做**匯出、匯入,也不做每週目標(留到 1.x)。
- **模擬考放進 1.0,但範圍要小**(S14),照 PianoDrill「各模組在檢定分頁有一個模擬考鈕」的做法:
  - RSL 技巧:每一組抽一項,照官方速度加拍點。只抽 `pas`、`pattern` 兩種;`book` 那幾項只顯示「這一組請用檢定書練」。
  - RSL 視奏:90 秒準備 → 演奏。
  - RSL 聽力:Fill → Groove。
  - Trinity:Playback 流程(30 秒看譜 → 第一次練習 → 第二次)。
  - **不做樂理問答(GMQ)出題**:沒有官方題庫,不能自己編。檢定概要裡只列範圍。
  - **不算總分**。

### 決定 8:取樣
- **整組鼓件**(12 個):kick、snare、xstick、hhClosed、hhOpen、hhPedal、ride、rideBell、crashL、tom1(高)、tom3(中)、tom5(低/落地)。照 ScrollScore 的鍵位註解:48 Tom1、45 Tom3、41 Tom5。
- **記憶體**(我用 manifest 的 frames 算的:12 個鼓件全部 round-robin 共 3,833 萬格,立體聲 32 位元浮點約 307 MB):
  - iPhone、記憶體 ≤ 4 GB 的裝置:鼓皮每層 3 個 round-robin、鈸類(ride、rideBell、crashL、hhOpen)每層 2 個,約 **76 MB**。
  - 其他裝置:鼓皮 6 個、鈸 4 個,約 150 MB。
  - 小鼓維持技巧模組現在的上限(iPhone 6 個),兩邊共用同一份緩衝。
- **choke**:Naked Drums 原廠 SFZ(kinwie 版)**這次查不到原檔**:raw 網址查不到,GitHub API 也被擋。ScrollScore 的引擎已經做了兩件事:
  - `chokeOpenHat`:hhClosed、hhPedal 一打下去,還在響的 hhOpen 立刻收掉。
  - `DRUM_POLY`:同一片鈸最多同時響幾聲,超過時最舊的在幾秒內收掉。註解寫「照原廠 sfz 的 note_polyphony 與 off_time」,數值是 crashL 4/0.65、ride 4/0.5、rideBell 4/0.5、hhOpen 3/0.35。
  - 照 CLAUDE.md「照 ScrollScore 的鼓引擎」,**照抄這兩個機制和數值**,另外照抄各鼓件的響度增益 `DRUM_VOICES.gain`、`send`,和鼓皮的力度交叉淡化 `DRUM_XFADE=8`。
  - 程式註解寫明出處:「ScrollScore index.html 的 DRUM_POLY/chokeOpenHat;原廠 SFZ 的 off_by 本專案沒有查證」。
  - 拿掉固定的 2.5 秒截斷,改成照錄音自然響完,由 DRUM_POLY 收尾。
- **離開視奏、聽力模組 60 秒後釋放**小鼓以外的鼓件(`audio.unloadDrums`),再回來時從 Cache Storage 重新解碼。

### 決定 9:S0 的修正(審查員指出的問題)
| # | 修法 |
|---|---|
| D1 | `audio.js` 的 `scheduled` 改成 `Set`。每個 `src.onended = () => scheduled.delete(src)`;`stopAll` 停全部再清空;`cancelFrom` 跑 Set。**刪掉 `pruneScheduled`**(播放中呼叫它會讓還沒響的節點脫離追蹤,按停止也停不掉)。`scheduledCount` 回傳 Set 的大小 |
| D2 | `main.js`:`visibilitychange` 變成 hidden 或 `pagehide` 時,呼叫目前模組的 `leave()` 再 `audio.stopAll()`;回到前景時呼叫 `enter(同一個 tab)`。另外 `audio.onInterrupt(fn)`:AudioContext 的 `statechange` 變成 `interrupted` 或 `suspended`,而且頁面看得到時,外框做同樣的 leave/enter。**模組規則同時改成**:`leave()` 只停播放和計時器,不清題目;`enter()` 有題目時不重新出題 |
| D3 | `gradeLabel` 只留 `main.js` 一份,透過 `ctx.gradeLabel(g, sys)` 給模組用。刪掉 `tech/app.js:111` 自己的版本 |
| D4 | 按熟練標記不再呼叫 `logPractice`。手動停止時也記入秒數(次數不加);自然播完次數 +1 |
| D6 | 視奏、聽力說明卡改成中性文字:「題目照 RSL/Trinity 官方大綱的參數整理中」,不寫題型細節(S8、S12 會換掉) |
| D10 | `docs/APPSTORE.md` 關鍵字拿掉 Trinity、RSL、Rockschool |
| D12 | `relang()` 不再呼叫 `switchTab`,只重畫文字(題目、標籤、選擇器、速度單位、紀錄、檢定卡),**不停播放、不重畫鼓譜** |
| D13 | `examStatus()`:S0 先回傳「已會 n/40」,S3 改成依考試系統和級數計算 |
| SW | `stamp.mjs` 另外改寫 `sw.js` 裡 `/*PRECACHE*/[…]/*END*/` 中間的清單(全部 css/js/vendor/data,用 ?v= 網址,加上 `./`、manifest、圖示),`CACHE` 名稱改成 `drumdrill-app-` + 清單雜湊。install 時 `addAll` 整份清單。`stamp --check` 也要檢查 sw.js |
| 前綴 | 共用元件(S1)一律接受 `$ = id => document.getElementById(prefix + id)`,**shared 程式裡不能出現 `"t-"`**。CSS 用 class(`.score-scroll`、`.score-osmd`、`.playline`)加在 `drum.css`,不改 `app.css`;`#t-` 的 order 規則替 `s-`、`e-` 各補一份 |

### 決定 10:檢定分頁的資訊放哪裡
- **外框**:在考試設定卡展開的部分(`.setup-body`)加 `#examOverview`(手機上預設收起,不會把題目卡擠到下半部)。內容:
  - 各項配分、等第門檻、考試時間、資料版本和核對日期。
  - 其他項目(演奏曲、樂理問答範圍、Trinity 數位考試沒有 Session skills),一律標「本 App 不提供練習」。
- **三個子項目**:各模組在 `enter("exam")` 時,畫自己的「本級要求」卡和練習。
- **曲名不列**,只寫「3 首,每首 20 分,最長 2:00」這類事實。

---

## 2. 全域約定

### 2.1 資料檔
放在 `data/` 第一層(`stamp.mjs` 只讀第一層):`data/exam-rsl.json`、`data/exam-trinity.json`、`data/drumkey.json`。

時值代號固定為:`"1" "2" "2." "4" "4." "8" "8." "16" "16." "32" "8t3" "16t3" "16t5" "16t6" "16t7" "32t9" "32t10" "4t3" "8d2"`(複拍子的二連音)。休止符用同一套代號,前面加 `r`。

```jsonc
// data/exam-rsl.json(結構;內容照 docs/sources/rsl-drums.md 的表抄)
{ "system": "rsl",
  "doc": { "title": "Rockschool Drums Syllabus Specification 2018 (rev. 2 Jun 2026)", "url": "https://www.rslawards.com/…June_2026.pdf", "checked": "2026-10-18" },
  "gradeName": { "0": ["入門(Debut)", "Debut"] },
  "overview": { "components": [{ "id": "pieces", "name": ["演奏曲 ×3", "Pieces ×3"], "marks": 60, "app": false, "p": 16 }, …],
                "bands": [{ "name": "Pass", "min": 60 }, { "name": "Merit", "min": 74 }, { "name": "Distinction", "min": 90 }], "bandsP": 16,
                "minutes": { "0": 15, "1": 20, … }, "minutesP": 15, "maxPieceLen": { "0": "1:00", … } },
  "tech": { "0": { "p": 30, "rule": "pick", "groups": [
      { "id": "A", "name": ["單擊", "Single strokes"], "bpm": 70,
        "items": [{ "kind": "pattern", "pas": 1, "value": "8" }] }, … ] }, … },
  "sight": { "0": { "type": "snare", "bars": 4, "time": { "v": "4/4", "assumed": true }, "values": ["2", "4"], "rests": ["r4"],
                    "pieces": ["snare"], "bpm": [80, 80], "prepSec": 90, "metroInPrep": true, "p": 31 }, …,
             "6": { "type": "qsp", "bars": 12, "studySec": 180, "plays": 2, "p": 59 } },
  "improv": { "1": { "bars": 4, "bpm": [70, 80], "prepSec": 30, "p": 35 }, … },
  "ear": { "0": { "fill": { "bars": 1, "bpm": 70, "values": ["4", "8"], "rests": [], "options": 2 },
                  "groove": { "bars": 2, "pieces": ["hhClosed", "snare", "kick"], "bpm": [80, 80], "styles": null },
                  "plays": 2, "countInBars": 1, "p": 31 }, … },
  "gmq": { "0": { "music": [[…], […]], "instrument": [[…], […]], "p": 31 }, … } }
```

`data/exam-trinity.json`:`overview`(現場:Song1 25/Song2 25/Session skills 20/Song3 30;數位:Overall 20;等第 60/75/87;Session skills 12/15/17;考試時間;頁碼見 [TR §2])、`playback`(**原始表**,只放有新增的欄,累積由程式計算 `cumulative(grade)`;[RP p.62–63])、`improvising`(只用來顯示)、`ownChoice`(技巧欄,[RP p.55–59])、`sessionFlow`(30 秒、count-in、播兩次;[RP p.60–61])。

`data/drumkey.json`:`{ "kick": { "step": "F", "octave": 4, "head": "normal", "src": "app" }, "hhPedal": { "step": "D", "octave": 4, "head": "x", "src": { "doc": "Trinity DK", "p": 107 } }, "rideBell": { "step": "F", "octave": 5, "head": "diamond", "src": { "doc": "Trinity R&P errata" } }, … }`

### 2.2 localStorage
| 鍵 | 內容 | 從哪個 Stage 開始 |
|---|---|---|
| `drumdrill.v1` | 外框;新增 `mic:false`(S15) | 已存在 |
| `drumdrill.tech.v1` | 不變;`log` 欄位保留只讀(搬家後不再寫) | 已存在 |
| `drumdrill.log.v1` | `{v:1, days:{"YYYY-MM-DD":{n,sec,by:{tech:{n,sec},sight:{n,sec},ear:{n,sec}}}}}`,最多 400 天 | S1 |
| `drumdrill.sight.v1` | `{pick:{system,grade}, metro:true, tempo:{key:bpm}, seen:[seed…≤200], stats:{"rsl-3":{n,hitSum,noteSum}}}` | S8 |
| `drumdrill.ear.v1` | `{pick, stats:{"rsl-3-fill":{n,right}}, autoNext:false}` | S12 |

### 2.3 i18n
- 外框字串加在 `js/shared/i18n.js`:`practiceOnly`、`assumed`、`practiceSetting`、`ovTitle`、`ovMarks`、`ovBands`、`ovMinutes`、`ovOther`、`ovNotInApp`、`srcChecked`。
- 新增 `js/sight/strings.js`(`sight.`)、`js/ear/strings.js`(`ear.`)。
- 資料檔的 `[中, 英]` 陣列由模組直接用;放在固定格子(選項鈕、標籤)裡的英文最多 18 個字元(verify 會檢查),段落一律用 `pairText`。

---

## 3. 各 Stage 規格

### S0 清債與上線安全(約 400–600 行)

**1. 目標與範圍**
- 做:D1、D2、D3、D4、D5(改名)、D6、D10、D12、D13(先做 n/40)、SW 預先快取、`tools/test/package.json` 名稱改成 `drumdrill-test`、`layout.mjs:85` 的 PianoDrill 註解、`.github/workflows/verify.yml`(push 時跑 `node tools/test/verify.mjs`)。
- 不做:共用元件抽出、字型、刪 CSS。

**2. 檔案**
- `js/shared/audio.js`:
  - `scheduled` 改成 Set,加 `onended`(`playDrum`、`playClick` 都要)。
  - 刪 `pruneScheduled`。
  - 新增 `export function onInterrupt(fn)`:在 `ensureAudio` 建立 context 時掛 `onstatechange`。
  - `export function liveCount()`:還沒結束的節點數,給測試用。
- `js/main.js`:
  - `visibilitychange`、`pagehide`、onInterrupt 的處理(見 D2)。
  - ctx 增加 `gradeLabel`、`showView(view, sub)`。
  - `window.__shell` 加上 `hideForTest()`、`showForTest()`。
- `js/tech/app.js`:
  - `relang` 改寫(D12);熟練標記不記練習(D4);手動停止記秒數。
  - `examStatus` 回傳「已會 n/40」,狀態改變時呼叫 `ctx.examChanged()`。
  - `renderExam` 用 `ctx.gradeLabel`。
  - `bestLabel` 改成 `["示範最快","Demo best"]`。
- `js/tech/strings.js`:改 bestLabel。
- `js/sight/app.js`、`js/ear/app.js`:中性文字;`examStatus` 回傳 `tr("整理中","In progress")`。
- `sw.js`:加 `/*PRECACHE*/…/*END*/` 標記和 install 清單。
- `tools/build/stamp.mjs`:產生清單、寫進 sw.js、`--check` 也檢查。
- `docs/APPSTORE.md`:關鍵字改成「爵士鼓,打鼓,基本打法,rudiments,paradiddle,flam,滾奏,鼓譜,節拍器,視奏,聽力,考級,檢定,drum exam」(少於 100 字元)。
- `tools/test/playback.mjs`(新增,Playwright):見第 4 點。

**3. 資料來源**:沒有考試內容。D10 依審核 2.3.7(審查意見 A8)。

**4. 驗收與測試**
- 新增 `playback.mjs`,三項:
  1. 選 #20,開循環,速度 240,播 20 輪。每輪結束時 `liveCount()` ≤ 一輪的節點數 + 拍點數。
  2. 播放中按停止,100 毫秒後 `liveCount()===0`、`scheduledCount()===0`。
  3. 播放中模擬切到背景:`Object.defineProperty(document,'visibilityState',{get:()=>'hidden'})` 再送出事件,`__tech.state.play===false`,然後恢復。
- `human.mjs` 加動作「切到背景再回來」(權重 2)和「播放中切換語言」(播放狀態不能變)。
- `verify.mjs`:`stamp --check` 包含 sw.js。
- 其他三支瀏覽器測試照常通過,而且畫面跟 S0 之前一樣(只有「示範最快」字樣不同)。

**5. 審查重點**
- 每個 `start()` 出來的節點都有 `onended`;`cancelFrom` 不能停到正在響的。
- 切到背景時 wakeLock 的處理沒有被破壞。
- sw.js 的清單跟 importmap 的 ?v= 一模一樣,而且 install 失敗不會讓整個 SW 卡住(`addAll` 的錯誤有接)。
- APPSTORE 的描述仍然可以提考試名稱,但要加「與其無關」。

---

### S1 共用元件抽出:鼓譜、速度、練習紀錄(約 900–1300 行改動)

**1. 目標與範圍**
- 做:把 `tech/app.js:118–349` 的鼓譜、播放軸、速度介面抽成共用模組;練習紀錄改成共用的 log。**技巧分頁的畫面和行為完全不變。**
- 不做:新功能;不改排程方式(技巧照舊一次排完)。

**2. 檔案**
- `js/shared/score.js`:`export function createScore({ $, zoom, afterRender, cursorColor })`。
  - 回傳 `{ load(xml), redraw(), measure(lenBeats), xAtBeat(b), movePlayline(beat, follow), placeExtent(), onResize(), setActive(bool), get noteXs(), get osmd() }`。
  - 需要的 id:`stage`、`scroll`、`osmd`、`playline`、`paperMsg`(加上呼叫者的前綴)。
  - 「看不到時延後重畫」(`pendingRender`)、`fitWidth`、`measureNotes` 都搬進來。
- `js/shared/tempo.js`:`export function createTempo({ $, min, max, get, set })`。綁定 `bpmDown`、`bpmUp`(按住連續加減)、`bpmRange`(拖拉)、`bpmVal`、`bpmUnit`、`beats`;提供 `showBeat(beat, countIn)`、`setBeats(n)`、`sync()`。
- `js/shared/log.js`:
  - 純函式部分:`addEntry(log, mod, {n, sec}, date)`、`summary(log, date)`(連續天數、今天次數、今天分鐘、近 7 天)、`trim(log, 400)`、`migrate(techLog)`。
  - 跟瀏覽器有關的部分:`load()`、`save()`、`logPractice(mod, {n, sec})`、`renderLogCard($)`,id 是 `logStreak`、`logToday`、`logMin`、`logWeek`。
  - 第一次執行時把 `drumdrill.tech.v1.log` 搬到 `by.tech`,在新鍵寫 `migrated:true`,舊資料不刪。
  - 語言改變時重畫:各模組在 `relang` 呼叫 `renderLogCard`。
- `js/tech/app.js`:改用以上三個模組;`drawSticking` 改成 `afterRender` 外掛。
- `css/drum.css`:`.playline` 的 class 規則(從 `#t-playline` 複製)、`.score-scroll`、`.score-osmd`;卡片 order 規則補 `#s-*`、`#e-*`。index.html 技巧的元素同時加上這些 class(不改 id)。

**3. 資料來源**:無。

**4. 驗收與測試**
- 新增 `tools/test/shots.mjs`:用固定狀態截圖(技巧 4 類 × 中英 × 390/1280 兩種寬度,停在 #16 和 #40×8)。S1 開工前先跑 `--save`,完成後跑 `--compare`,**像素要完全一樣**(比 PNG 位元組;不同時把兩張圖都存下來)。
- `verify.mjs` 呼叫新檔 `tools/test/checks/log.mjs`:搬家、跨月、跨年、超過 400 天刪最舊的、連續天數(今天沒練時從昨天算起)。
- `grep -n '"t-' js/shared/*.js` 必須沒有結果。

**5. 審查重點**
- 換語言、轉螢幕、隱藏時延後重畫的行為跟原本一樣。
- 搬家只做一次,舊鍵沒有被改。
- 共用模組沒有任何模組自己的狀態(例如沒有偷偷依賴 `cur`)。

---

### S2 考試資料檔、載入與驗證(約 1000–1400 行,大部分是 JSON)

**1. 目標與範圍**
- 做:`data/exam-rsl.json`、`data/exam-trinity.json`、`data/drumkey.json`(先放位置和來源,S5 才用到)、`js/shared/examdata.js`、驗證。
- 不做:介面。

**2. 檔案**
- `js/shared/examdata.js`:
  - `load(system)`:用 `#pdVersions` 加 `?v=` 去 fetch,結果快取在記憶體;失敗時回傳 null,介面顯示「資料載入失敗,重新整理」。
  - `cumulative(trinity.playback, g)`:Trinity 的 Playback 參數按級累積。
  - `validate(data)`:純函式,回傳錯誤清單。
- `main.js`:啟動時載入兩份資料,放進 `ctx.exam`(`ctx.examData(sys)`)。
- **RSL 技巧對照表**(照 [RSL] 3.2/3.4 寫進 `tech`):

| 級 | 組:項目 → kind |
|---|---|
| Debut p.30 ♩70 | A 單擊八分 → pattern(1,"8");B 雙擊八分 → pattern(6,"8");C Paradiddle 八分 → pattern(16,"8");D Fill → book |
| 1 p.34 ♩70 | A → pattern(1,"8")、pattern(6,"8"),註明隔小節交替;B → pattern(1,"16")、pattern(6,"16");C → pas 16;D Fill → book |
| 2 p.38 ♩70 | A → 單擊/雙擊 × 八分/十六分 四項;B → pas 16 + 整組鼓註記;C Flams 四分 → pas 20;D 三連音 → pattern(1,"8t3");E → book |
| 3 p.42 ♩75(F ♩80) | A → pattern(1, "8"/"8t3"/"16");B → pattern(6, "8"/"16") + 小鼓與 Tom 註記;C → pas 16 + 整組鼓;D → pas 20、pas 31;E → pattern(1,"8t3") + 「重音在小鼓與 Tom,見書」;F → book |
| 4 p.47 ♩75(E ♩80) | A → 單擊/雙擊 × 3 種時值,共 6 項;B → pas 16、pas 18;C → Flam tap **四分** → pattern(22,"4"),`assumed:true`(「四分音符」是否也套用在 Flam tap,大綱文字有歧義);ruffs → book;D Hands & feet → book;E Fill → book |
| 5 p.52 ♩80 | A 同 4 級(6 項);B → pas 16、pas 18 + 大鼓跟右手註記;C → pas 21、pas 32;D 五擊樂句 ♩75 → book,相關 pas 7;E Hands & feet ♩90 → book;F Fill ♩90 → book(採 PDF;官網寫 80,見 [RSL] §9 #1) |
| 6 p.58 ♩80 | A → 單擊/雙擊 × "8t3"/"16"/"16t6";B → pas 24、pattern(19,"16t6");C → pas 38;D → book,相關 7、10;E Stylistic → book |
| 7 p.63 | A ♩65 → pattern(1, "4"/"8"/"8t3"/"16"/"16t5"/"16t6"/"16t7"/"32");B ♩80 → pas 24、pattern(19,"16t6") + 重音在 Tom 註記;C → pas 27;D → pas 38、pas 39;E ♩85 → book,相關 9、10;F → book |
| 8 p.68 | A ♩65 → 同 7 級再加 "32t9"、"32t10";B ♩90 → pattern(19,"16t6") + 繞整組鼓註記;alternative paradiddle-diddle → book;C ♩85 → pas 28、pas 27;D ♩85 → pas 40;E ♩90 → book(七擊樂句,相關 9;combined rolls);F → book |

**3. 資料來源**:全部照 [RSL] §2–6、[TR] §2–4。每個物件都要有 `p`。[RSL] §9 的不一致照「建議」欄處理(5 級 Fill 90、3 級 23 分、Groove Recall、GMQ 5 題、7 級 A 組照內容)。Trinity 的 Playback 參數表裡斜線的格子(沿用前一級)是 [TR] 的推論,不要寫值,由 `cumulative` 處理;總長度的解讀見 S10。

**4. 驗收與測試**:新增 `tools/test/checks/examdata.mjs`(verify 會呼叫),檢查:
- 級數 0–8 都有;每個項目都有 `p`。
- `pas` 編號都在 RUDIMENTS 裡;`value` 都在時值代號表裡。
- `pattern` 項目的 PAS 打法不能是多次反彈(#4)。
- 中英文都有;放在格子裡的英文 ≤ 18 字元。
- 數字要跟 sources 一致:**另外在 checks 裡手抄一份**配分、門檻、BPM 表互相核對(跟 rudiments 的 STICK 表同樣做法)。

**5. 審查重點**
- 逐筆對照 `docs/sources/*.md`,頁碼正確。
- 不能有 sources 裡沒有的數字:例如 Trinity Playback 的速度、RSL 聽力的風格清單,必須是 `null`。
- JSON 裡沒有整段照抄大綱原文。

---

### S3 檢定分頁:考試概要卡 + 技巧要求清單 + 一鍵跳 PAS(約 800–1200 行)

**1. 目標與範圍**
- 做:
  - `#examOverview`。
  - 技巧模組的檢定卡:RSL 各組清單;Trinity 說明卡加上自選曲技巧欄。
  - `pas` 項目一鍵跳到技巧分頁(帶官方速度)。
  - `examStatus`;`ctx.examChanged` 真的會重畫。
- 不做:`pattern` 項目的練習(S4;S3 期間按鈕先顯示「下一版提供」)。

**2. 檔案**
- `index.html`:`#examSetup .setup-body` 裡加 `<div id="examOverview">`;`#t-examCard` 改成 `#t-examTitle`、`#t-examNote`(pairText)、`#t-examList`。
- `js/main.js`:`renderOverview()`,內容是配分表、等第、時間、其他項目、「依 〈doc〉 p.x · 核對 2026-10-18」、practiceOnly。
- `js/tech/app.js`:
  - `renderExam()` 依系統分兩種:
    - **RSL**:每一組一列:組別字母、名稱、♩、頁碼,加上 `pas` 的「練習」鈕、`pattern` 的「依大綱時值練習」鈕、`book` 的「譜見官方檢定書」小字。另外顯示規則:Debut–3「考官從每組抽一部分;可以跟 click 打,或只聽一小節 click」,4–8「一定要跟 click」(p.30/47 等)。
    - **Trinity**:技巧在 Song 3 評的說明、自選曲參數表本級的技巧欄、類別入口。
  - `openTarget({ no, bpm, label, src, value? })`:呼叫 `ctx.showView("tech", 類別)`,再顯示 `#t-target` 列(「RSL 3 級 D 組 · ♩=75 · p.42 ✕」)。速度設成官方值,**不寫進** `S.bpm[no]`。✕ 關閉後恢復原本的速度。
  - `examStatus`:RSL 是「已會 n/m」,m = 本級用到的不同 PAS 編號數;Trinity 是 `tr("在 Song 3 評","In Song 3")`。
- `js/tech/strings.js`:`practice`、`practiceByValue`、`seeBook`、`related`、`target*`、`trinityTechNote` 等。

**3. 資料來源**:[RSL] §2.2–2.4、§3;[TR] §2.1–2.4、§4.1。

**4. 驗收與測試**
- `layout.mjs`、`bilingual.mjs` 新增狀態:RSL 0/3/8 級、Trinity 0/5 級的檢定技巧頁;概要卡展開(280/320 也要放得下);技巧分頁帶著 target 列。
- `human.mjs` 新增「檢定清單 → 練習」:檢查 `__tech.cur.no`、`state.bpm` 等於資料值,而且 view 是 tech。
- 概要卡收起時,技巧分頁的題目卡仍然在畫面上半部(layout 本來就會檢查)。

**5. 審查重點**
- Merit 門檻:RSL Grade Exam 是 74%,不是 75%。
- Trinity 寫明數位考試沒有 Session skills。
- 沒有把 Drum Kit & Percussion 的 rudiments 表放進來。
- target 不會汙染使用者存的速度。
- 檢定卡上看得到 practiceOnly。

---

### S4 RSL 技巧「依大綱時值」練習型(約 600–900 行)

**1. 目標與範圍**
- 做:`pattern` 種類:用 PAS 的左右手、重音、裝飾音,換成 RSL 指定的時值,畫在單線譜上並播放。
- 不做:編配到整組鼓;不做 `book` 那幾種。

**2. 檔案**
- `js/tech/rudiments.js`:
  - `DUR`、`BEAMS` 加上 "1"、"2."、"4."、"16."。
  - 解析器支援 `t3|t5|t6|t7|t9|t10`,一般化的 `TUPLET = {3:[2,"eighth"|"16th"], 5:[4,"16th"], 6:[4,"16th"], 7:[4,"16th"], 9:[8,"32nd"], 10:[8,"32nd"]}`。
  - 新增 `export function pattern(no, value, lead)`:取 `strokes(withLead(byNo(no), lead))` 的主擊,依序變成 `value` 時值的音符,保留 `accent`;前面有 grace 的轉成 `flam`/`drag`;雙擊開放滾奏(#6)的 roll 擊照實際左右手(RRLL)。
  - 一個循環的長度 = lcm(左右手序列長度, 一拍的音符數)個音,每一拍一組連桿。
  - 多次反彈(#4)丟出錯誤。
- `js/tech/notation.js`:`<time-modification>` 的 `normal-notes`、`normal-type` 照 TUPLET 表(**修正現在寫死 `16th` 的 bug**:八分三連音 "8t3" 要是 `eighth`);tuplet 編號照實際數字。
- `js/tech/app.js`:target 有 `value` 時,`groups = pattern(...)`,畫譜與播放都用它;標籤列加「依大綱時值 · App 排的練習型」和 `practiceOnly`;熟練標記仍然記在 PAS 編號上。

**3. 資料來源**:[RSL] §3.2(時值、BPM)、PAS 官方表(左右手)。Flam tap 四分音符這一項標推估(見 S2)。

**4. 驗收與測試**:`verify.mjs` 新增:
- 每一個 `pattern` 項目:一個循環是整數拍;主擊的左右手 = PAS 序列重複;MusicXML 的時值總和 = 循環長度;tuplet 的 normal-type 對應正確;沒有 undefined。
- 對 "16t5"、"16t7"、"32t9"、"32t10" 各做一題用 OSMD 畫出來的檢查:`notation-preview.html?pattern=1:32t10`,截圖存檔給審查員看。
- `bilingual.mjs`:target 列中英高度一樣。

**5. 審查重點**
- 左右手沒有被重新發明:只是時值改變。
- 雙擊的 RRLL、Flam 的手(裝飾音是另一隻手)正確。
- 快速時值在 ♩=65 時播放不卡(32t10 每秒約 11 下)。
- 「App 排的練習型」的字樣一定看得到。

---

### S5 鼓組記譜引擎、圖例與可行性樣張(約 800–1200 行)

**1. 目標與範圍**
- 做:`js/shared/kitnotation.js`(單線和五線)、`data/drumkey.json` 生效、圖例元件、`notation-preview.html?kit=`。**這是第一個「可行性樣張」**:把所有記號畫一遍,記下 OSMD 2.1.0 哪些可以、哪些要自己補畫。
- 不做:出題、播放。

**2. 檔案**
- `js/shared/kitnotation.js`(純函式,Node 可以跑):`kitXML({ time:[4,4], showTime, lines:1|5, measures:[{ voices:[[ev…],[ev…]] , slash?:true }], dynamics?, title })`。
  - `ev = {value, rest, notes:[{piece, accent, ghost, open, closed, flam, drag}], tie, dyn}`。
  - 手(voice 1)符桿朝上、腳(voice 2)符桿朝下,都要補休止符。
  - `<unpitched>` 照 drumkey;符頭 x、diamond、circle-x 用 OSMD 2.1.0 有的 `NoteHeadShape`(vendor 檔裡確認有 X、CIRCLEX、DIAMOND、SLASH)。
  - 幽靈音 `<notehead parentheses="yes">`;開/閉 HH 先試 `<technical><open/>`、`<stopped/>`,畫不出來就學 `drawSticking`,在 SVG 上自己補畫 o/+。
  - 自由發展的小節用 slash 符頭(RSL 4–5 的 2 小節發展)。
- `js/shared/legend.js`:`renderLegend($, pieces)`:用 OSMD 畫一行樣張,下面寫鼓件名稱;`src:"app"` 的鼓件加推估標籤。
- 單線譜的視奏(RSL Debut–3)也用 `kitXML` 的 `lines:1`;要印小節線、拍號(拍號標推估)。
- `tools/test/notation-preview.html`:`?kit=all` 把 drumkey 每個鼓件 × 每種修飾都畫出來。

**3. 資料來源**:決定 3。官方確認的只有 [DK p.107](腳踩 HH、o、+)和 [ERR](Ride bell 菱形在最上線),其他標 `"app"`。

**4. 驗收與測試**
- `verify.mjs` 新增 `checks/kitxml.mjs`:
  - 每個聲部每一小節的時值 = 拍號長度(包括 6/8、12/8、5/8 等)。
  - 每個 piece 都在 drumkey 裡;沒有 undefined。
  - 隨機產生 500 個小節都合法。
- 新增 `tools/test/kitnotation.mjs`(Playwright):`?kit=all` 每個記號的符頭形狀和位置正確(讀 SVG 的 class 與 y),截圖存起來。
- `layout.mjs`:280 寬時鼓組譜可以左右捲,不超出紙張。
- **審查員要拿截圖跟決定 3 的表逐項核對**。

**5. 審查重點**
- 自己補畫的 o/+、括號,在縮放、換語言後位置還是對的。
- 兩個聲部的休止符不會疊在一起。
- 圖例卡的文字沒有聲稱是官方圖例。
- 樣張的結論寫進 `docs/NOTATION.md`(OSMD 可以/補畫/做不到),做不到的記號後面的出題器一律不出。

---

### S6 整組鼓的取樣:載入、釋放、choke、各鼓件增益(約 500–900 行)

**1. 目標與範圍**
- 做:照決定 8。
- 不做:播放器(S7)。

**2. 檔案**
- `js/shared/audio.js`:
  - `RR` 依類別設定:`{skin:[3,6], cymbal:[2,4]}`(前面是 iPhone 或記憶體小的裝置,後面是其他)。`loadDrums(pieces, onProgress, {rr})`。
  - `export function unloadDrums(keep=["snare"])`。
  - `KIT_VOICE` 照抄 ScrollScore 的 `DRUM_VOICES` 的 gain 和 send(kick 1.584、snare 1.0、xstick 0.832、hhClosed 0.27、hhPedal 0.355、hhOpen 0.26、tom1 1.117、tom3 1.233、tom5 1.057、crashL 0.26、ride 0.425、rideBell 0.361)。
  - `playKit(piece, when, vel)`:包含 hhClosed、hhPedal 收掉 hhOpen(收音時間照 ScrollScore 的 DRUM_CHOKE_FADE 0.035)、`DRUM_POLY`、鼓皮的力度交叉淡化(DRUM_XFADE=8)。
  - 拿掉 2.5 秒截斷。原本的 `playDrum("snare")` 介面保留,給技巧用。
- `tools/build/app-samples.mjs`:`PIECES` 加 12 個鼓件。**只打包 round-robin 前 6 個**,`docs/APPSTORE.md` 記下增加的 MB 數。
- `licenses.html`:修改說明補上「hi-hat 互相截斷、同一片鈸發聲數上限、依鼓件調整音量」。
- 視奏、聽力模組在 `leave()` 時排一個 60 秒後的 `unloadDrums`,`enter()` 時取消。

**3. 資料來源**:ScrollScore `index.html`(`DRUM_VOICES`、`DRUM_POLY`、`chokeOpenHat`、`fadeDrumVoice`、`SFZ_VEL_RANGES`、`DRUM_XFADE`)。原廠 SFZ 的 off_by:**查不到**,在註解寫明。

**4. 驗收與測試**:新增 `tools/test/kitaudio.mjs`(Playwright):
- 載入 12 個鼓件後,解碼的位元組數 = Σ(frames/rr × 實際 rr × 聲道 × 4),在「iPhone 模式」(用 UA 模擬)≤ 90 MB。
- hhOpen 後面接 hhClosed:hhOpen 的增益在 0.1 秒內降到 0.001 以下(讀內部的 voice 狀態)。
- crashL 連打 6 下,同時響的 ≤ 4。
- `unloadDrums` 之後 `kit` 只剩 snare。
- 技巧模組的小鼓聲音不變(snare 的增益和路徑跟 S0 一樣)。

**5. 審查重點**
- 照抄的數值跟 ScrollScore 一字不差,有寫出處。
- 網頁版和 App 版的 round-robin 上限一致(App 只打包 6 個)。
- 釋放時正在播放的不能被切掉(只在 leave 60 秒後才做)。

---

### S7 共用播放器、觸控鼓墊、計時評分(約 900–1300 行)

**1. 目標與範圍**
- 做:視奏、聽力共用的「事件清單播放器」(往前看排程)、`timing.js`(純函式)、`pad.js`(鼓墊介面)。
- 不做:題目。

**2. 檔案**
- `js/shared/player.js`:`createPlayer({ onTick, onEnd })`,方法 `play({ events:[{beat, piece, vel}], lenBeats, bpm, countInBeats, click:(beat)=>"strong"|"weak"|null, silentRanges? })`、`stop()`、`setBpm()`、`beatToTime(b)`、`timeToBeat(t)`。
  - 往前看 1.5 秒排程,每 100 毫秒補排(setInterval 加 rAF)。
  - 改速度時用 `cancelFrom` 再重排。
  - 停止時 `stopAll`;`state` 給測試用。
- `js/shared/timing.js`(純函式):
  - `expected(events, {lanes})`:同一時間的多個擊打算一下,依鼓墊分組。
  - `score(expectedSec[], tapSec[], {tolFn, maxOffset:0.25})`,回傳 `{offset, hits, missed, extra, meanAbsMs, notes:[{t, err|null}]}`。偏移量 = 最近配對誤差的中位數。
  - `scoreLanes(...)`:分鼓墊各自評分。
- `js/shared/pad.js`:`createPads(el, lanes:[{id,label,key}], onHit)`。
  - 用 `.tap-pad` 樣式(app.css 已有),多點觸控。
  - `pointerdown` 的 `timeStamp` 換成音訊時間(決定 6),鍵盤 F/J/K 對應三個鼓墊。
  - 打到時閃一下;`touch-action:none`。
  - 一個鼓墊時是「小鼓」;三個鼓墊時是「鈸 / 鼓 / 腳」。
- `css/drum.css`:鼓墊排列(三個時 280 寬也放得下,每個至少 80×96)。

**3. 資料來源**:無官方資料;容許範圍是練習設定(決定 6)。

**4. 驗收與測試**
- `verify.mjs` 新增 `checks/timing.mjs`:
  - 固定偏移 +120 毫秒加 ±15 毫秒抖動 → offset≈120、全部命中。
  - 漏一下 → missed 1;多一下 → extra 1。
  - 偏移超過 250 毫秒 → 不扣,而且有旗標。
  - 三個鼓墊各自評分。
- 新增 `tools/test/pad.mjs`(Playwright):用 `page.touchscreen.tap` 照題目時間點擊,結果是命中。
- `playback.mjs` 擴充:player 播 24 小節的鼓組事件,節點數 ≤ 視窗內的事件數 × 2。

**5. 審查重點**
- 換算時間沒有用 `Date.now()`。
- 頁面隱藏時 setInterval 被節流,但這時已經 leave 了,不能還在補排。
- 評分結果的介面一定標「練習回饋」。

---

### S8 視奏:模組骨架 + RSL Debut–3(小鼓)(約 1200–1500 行)

**1. 目標與範圍**
- 做:視奏模組完整流程;RSL Debut–3 出題器;檢定分頁的「視奏要求卡」(RSL 0–8 全部的說明卡,包括 I&I、QSP;Trinity 的「沒有視奏」說明卡);examStatus;練習紀錄。
- 不做:整組鼓(S9)、Trinity 看譜練習(S10;S8 期間 Trinity 只顯示說明卡)。

**2. 檔案**
- `index.html` 的 `#mod-sight`:
  - `.mod-side`:`s-setup`(考試系統、級數,手機收成一行;預設跟外框的考試一樣)、`s-examCard`(只在檢定分頁顯示,手機上可以收起)、`s-logCard`。
  - `.mod-main`:`s-quizCard`(`s-qTitle`、`s-qTags`、`s-playBtn`、`s-prepBtn`、`s-timer`、`s-newBtn`)、`s-scoreCard`(`s-stage`/`s-scroll`/`s-osmd`/`s-playline`/`s-paperMsg`、`s-legend`)、`s-padCard`(`s-pads`、`s-result`、`s-check`)、`s-metroCard`(共用速度介面,速度 id 用 `s-`)。
  - 注意 app.css 已有 `#s-setup`、`#s-scoreCard`、`#s-logCard` 的規則:決定沿用或改名。
- `js/sight/gen.js`(純函式):`genSnare(spec, seed)` → `{measures, time, bpm}`。
  - 拍型表(4/4,每一拍或每兩拍一格):
    - 只用一種時值:♩、𝄽、二分(兩拍)、♪♪、♬♬♬♬、♪𝄾、𝄾♪。
    - 混合:♪♬♬、♬♬♪,標推估。
  - 依 `values`、`rests` 過濾。最後一小節的最後一個音落在拍點上(出題器的設計)。
  - 同一個種子出同樣的題目;`seen` 裡有的種子跳過。
- `js/sight/app.js`:
  - 狀態:`idle → prep(90 秒倒數;可以開關節拍器跟著試打)→ perform(一小節預備拍,標練習設定;拍點可以開關;鼓墊收集打擊)→ result(鼓墊評分;「聽正確版本」用播放器加播放軸;自我檢查清單:節奏、速度穩定、從頭到尾不停)`。
  - 速度預設是官方值,範圍題(3 級 70–80)隨機取一個整數。使用者可以改,改了顯示「練習速度(官方 ♩=…)」。
  - RSL 4–8 級在 S8 期間顯示說明卡和「下一版」(S9 做完後只剩 6–8 的 QSP 說明)。
  - `examStatus`:`tr("已練 n 題","n done")`。
  - `window.__sight`:state、gen、seed,給測試用。
- `js/sight/strings.js`。

**3. 資料來源**:[RSL] §4.1(小節數、時值、休止符、只用小鼓、BPM、90 秒、練習時可開關節拍器,p.31/35/39/43)。拍號查不到 → 用 4/4,標推估(理由:4、5 級明寫 4/4)。預備拍查不到 → 練習設定。§4.2、§4.3 放說明卡。Trinity 說明卡:[RP p.60]。

**4. 驗收與測試**
- `verify.mjs` 新增 `checks/gen-sight.mjs`:每一級 1000 個種子,只出現白名單內的時值和休止符;小節數、每小節時值正確;同一個種子結果一樣;只有小鼓。
- `layout.mjs`、`bilingual.mjs`:Debut、3 級的 idle、prep、perform、result 四種狀態;檢定視奏卡(RSL 3、6;Trinity 1)。
- `human.mjs`:視奏的各種操作(出題、準備、開始、停止、換級、切分頁)。檢查:離開模組後 `__sight.state.play===false`、倒數計時停止、模擬點擊鼓墊後結果出現。

**5. 審查重點**
- 白名單每一項都有 p.;推估標籤看得到。
- 90 秒是「準備加練習」,不是只看譜。
- 不能顯示「第 N 級視奏考題」字樣,只能寫「依 RSL N 級參數的練習」。
- QSP 和 I&I 只有說明,沒有偷偷出題。

---

### S9 視奏:RSL 4–5 整組鼓(約 900–1300 行)

**1. 目標與範圍**
- 做:8 小節整組鼓譜,其中 2 小節是自由發展;圖例;三個鼓墊;播放用整組鼓取樣。
- 不做:Trinity。

**2. 檔案**
- `js/shared/kitgen.js`(純函式):`genKit({ time, bars, values, rests, pieces, voices:{maxConcurrent}, fills:{everyBars} }, seed)`。
  - 骨架:手部用 HH 或 Ride 跑固定時值;小鼓、大鼓用白名單裡的拍型;每 4 小節最後一拍可以換成過門(小鼓、筒鼓,用白名單時值)。
  - 「骨架」和「過門頻率」是出題器的設計,寫進 `docs/GENERATORS.md`,標推估。
- `js/sight/gen.js`:`genRslKit(spec, seed)`。自由發展的 2 小節放在第 7–8 小節,`develop.position` 標推估(大綱沒寫位置,[RSL] §4.1 註);用 slash 小節表示,播放時那兩小節只放拍點。
- `js/sight/app.js`:4–5 級用三個鼓墊、顯示圖例、等整組鼓載完才能開始(有進度環)。
- 鼓件:「整組鼓」沒有列出明細 → 用決定 8 的 12 個鼓件中「HH(閉)、小鼓、大鼓、高/中/低筒鼓、Ride、Crash」,標推估。

**3. 資料來源**:[RSL] §4.1(4、5 級:8 小節含 2 小節發展、4/4、時值、休止符、整組鼓、80–90/80–120,p.48、53)。

**4. 驗收與測試**
- `checks/gen-sight.mjs` 擴充:4、5 級 1000 個種子;只用白名單時值;小節時值正確;發展小節剛好 2 個;鼓件都在 drumkey 裡。
- `layout.mjs`、`bilingual.mjs`:4 級四種狀態 + 圖例。
- `kitaudio.mjs`:視奏 4 級播放 8 小節,節點數有上限。

**5. 審查重點**
- 推估的地方有三處(拍型骨架、發展位置、鼓件範圍),都要看得到標籤。
- 附點八分只能配十六分出現。
- 280 寬的三個鼓墊不會擠出畫面。

---

### S10 Trinity Playback 譜產生器(Initial–3 級)+ Trinity 視奏「看譜練習」(約 900–1300 行)

**1. 目標與範圍**
- 做:`js/shared/playbackgen.js` 的 Initial–3 級;視奏模組在 Trinity 下的「Playback 看譜練習」:30 秒看譜 → 使用者照譜打一遍(拍點加鼓墊)→ 聽正確版本。
- 不做:4–8 級(S11);一句一句回打(S13)。

**2. 檔案**
- `js/shared/playbackgen.js`(純函式):`genPlayback(cum, seed)`。`cum` 是 `cumulative(grade)` 的結果,包括:總長、句長、拍號清單、時值、休止符、力度、鼓件、聲部數(單線 / 部分 2 聲部 / 大多 2 聲部 / 3 聲部)、連結線、腳踩 HH、反拍大鼓。
  - 回傳 `{time, phrases:[{bars, measures}], dyn}`。
  - **總長的解讀**:「總長度」當成譜上的小節數,句子依「句長」切開,標推估(大綱沒說是否包括回打的小節)。
- `js/sight/app.js`:system 是 trinity 時用 `genPlayback`;標籤「Trinity Playback 參數 · 看譜練習」、practiceOnly、「官方是配伴奏音軌;App 只有拍點」;速度預設 80,標「練習速度(官方沒寫)」。
- 力度:譜上畫 p、f、mp、mf;播放的音量對應(pp .25 / p .4 / mp .55 / mf .7 / f .85 / ff 1.0)是練習設定。

**3. 資料來源**:[TR] §3.1–3.2([RP p.60、62–63])。速度、風格查不到。

**4. 驗收與測試**
- `checks/gen-playback.mjs`:Initial–3 級各 1000 個種子。
  - 只用累積白名單:Initial 只有 4/4、2/4,單線(同一時間只有一個鼓件),鼓件只有 SD、BD、HT、LT、Crash;1 級才可以用中筒鼓;2 級才可以用 HH、Ride、3/4、連結線;3 級才可以用腳踩 HH。
  - 總長、句長都在範圍內。
- `layout.mjs`、`bilingual.mjs`:Trinity 1、3 級的狀態。

**5. 審查重點**
- 累積邏輯不能把高一級的元素帶到低一級。
- Initial「沒有力度或分句記號」:譜上不能出現力度。
- 檢定視奏卡上寫的是「Rock & Pop 沒有視奏;這是 Playback 的看譜練習」。

---

### S11 Trinity Playback 譜產生器(4–8 級)(約 800–1200 行)

**1. 目標與範圍**
- 做:6/8、12/8、9/8、3/8、2/2、7/4、7/8、5/4、5/8、換拍號(8 級);八分三連音、十六分三連音、六連音、四分三連音、二連音、附點十六分、三十二分;cresc./dim.、pp、ff、sfz;rim-click(xstick)、開/閉 HH、Flam、Drag(PAS 寫法);幽靈音(6 級)。
- 不做:**Ruff、滾奏**。理由:[RP] 沒寫是哪一種寫法(Drag 和 Ruff 的區別、滾奏是雙擊還是多次反彈),出題器不出,說明卡寫「Ruff、滾奏的寫法大綱沒寫,App 不出」。

**2. 檔案**:`playbackgen.js`(複拍子用附點四分音符當一拍;二連音只出現在複拍子)、`kitnotation.js`(漸強、漸弱的 wedge;拍號改變)、`checks/gen-playback.mjs`。

**3. 資料來源**:[RP p.62–63]。

**4. 驗收與測試**
- 4–8 級各 1000 個種子,檢查白名單、每小節時值、換拍號只在 8 級出現。
- 每種新記號在 `notation-preview` 截圖。
- layout、bilingual:6/8、7/8 的譜在 280 寬。

**5. 審查重點**
- 一定要遵守 S5 樣張的結論:OSMD 畫不出的記號不能出。
- 複拍子的連桿依附點四分音符分組。
- sfz、幽靈音只在對應級數出現。

---

### S12 聽力:RSL Fill 與 Groove(約 1200–1500 行)

**1. 目標與範圍**
- 做:聽力模組骨架(跟視奏同一套卡片版型)、RSL 兩種題型、檢定聽力要求卡(RSL;Trinity 先放說明卡)、紀錄、examStatus。
- 不做:Groove 的風格題(查不到選項);Trinity 回打(S13)。

**2. 檔案**
- `index.html` 的 `#mod-ear`:`e-setup`、`e-examCard`、`e-quizCard`(`e-qTitle`、`e-playBtn`、`e-stepLabel`)、`e-scoreCard`(答案揭曉後才顯示譜)、`e-padCard`、`e-answers`(用 `.answers` 樣式)、`e-logCard`。注意 app.css 已有 `#e-quizCard`、`#e-logCard` 的規則。
- `js/ear/gen.js`(純函式):
  - `genFill(spec, seed)`:1 小節小鼓。拍型表比照 S8,加上八分三連音、附點八分 + 十六分、十六分六連音(6–8 級)、十六分休止符(7、8 級)。
  - `distractors(fill, n, seed)`:每個干擾選項只改一拍,改成另一個合法拍型;擊打時間集合一定要跟答案不同,干擾選項之間也不能一樣。
  - `genGroove(spec, seed)`:2 小節,用 `kitgen`,鼓件照級數:Debut–1 是 HH、SD、BD;2 加開/閉 HH;3 加 crash;4 加 ride、ride 碗;5 加 cross stick;6–8 用整組鼓。速度在範圍內隨機。
- `js/ear/app.js` 的流程照 [RSL] §5.1:
  1. 一小節預備拍 + 播放 + 拍點,共兩次。
  2. 練習(使用者自己按「準備好了」)。
  3. 一小節預備拍 + 拍點,使用者打(鼓墊)。
  4. Fill 再從 2 個或 3 個印出來的選項(單線譜)選一個。
  5. 揭曉:顯示正確譜、時間評分。
  - Groove 的「repeated」:播放時兩小節播兩遍,標推估。
- `js/ear/strings.js`。

**3. 資料來源**:[RSL] §5.1–5.2(p.31/35/39/43/48/53/59/64/69)。風格選項查不到 → 4–8 級的說明寫「考試還要說出風格(3 選 1 或 4 選 1);風格清單大綱沒寫,App 不出這一題」。

**4. 驗收與測試**
- `checks/gen-ear.mjs`:每一級 1000 個種子;Fill 速度一律 70、小鼓、1 小節、時值白名單;選項數 = 2 或 3;干擾選項跟答案不同;Groove 的鼓件不超過該級。
- layout、bilingual:聽力的五個步驟 × Debut/4/8 級;選項格子中英一樣大。
- human:聽力操作,離開時沒有在播放。

**5. 審查重點**
- Fill 一律 ♩=70,包括 8 級。
- 「聽兩次、各有一小節預備拍」照官方。
- 選項是印出來的譜,不能只用文字描述。
- 不能出現風格題。

---

### S13 聽力:Trinity Playback 一句一句回打(約 700–1000 行)

**1. 目標與範圍**
- 做:用 `playbackgen` 出題。
  1. 30 秒看譜(可以看譜,也可以選「不看譜」把譜蓋起來)。
  2. count-in 之後,App 播一句,接著同樣長度只有拍點,讓使用者回打。一句一句做完。
  3. 照官方播兩次:第一次是練習,第二次評時間。
- Improvising 說明卡([RP p.61、64–65],需要伴奏,不提供)。
- 不做:伴奏。

**2. 檔案**:`js/ear/app.js` 加 Trinity 模式;`player.js` 用 `silentRanges` 安排回打空檔;每一句分開評分(`timing.scoreLanes` 只取該句的時間範圍)。

**3. 資料來源**:[TR] §3.1–3.4。速度是練習設定(預設 80)。

**4. 驗收與測試**
- layout、bilingual:各步驟。
- human:模擬點擊回打,每一句都有結果。
- `checks/gen-playback.mjs` 共用。

**5. 審查重點**
- 「不要變化也不要即興」寫進說明。
- 練習那一遍不計分。
- 每一句的空檔長度 = 句長。

---

### S14 模擬考與練習紀錄整合(約 700–1000 行)

**1. 目標與範圍**
- 做:三個模組在檢定分頁的「模擬考」鈕(決定 7);各模組的紀錄卡用共用 log;檢定卡的三格進度。
- 不做:總分、樂理問答、匯出匯入。

**2. 檔案**
- `js/tech/app.js`:
  - RSL 模擬考:依組順序,每一組抽一個 `pas` 或 `pattern` 項目,照官方速度加拍點播一次預備拍再開始;`book` 組顯示「請用檢定書練」並跳過。
  - Debut–3 可以選「只聽一小節拍點」(p.30)。
  - Trinity:沒有技巧模擬考(說明在 Song 3 評)。
- `js/sight/app.js`、`js/ear/app.js`:模擬流程(見決定 7),結果只顯示各項的練習回饋(用 `.mock-res` 樣式),不顯示官方等第。
- `index.html`:`t-mockBtn`、`s-mockBtn`、`e-mockBtn`(app.css 已有 `#t-mockBtn`、`#e-mockBtn` 的規則,可以沿用)。

**3. 資料來源**:[RSL] §2.1 考試順序 p.18、§3.1;[TR] §3.1。

**4. 驗收與測試**
- human:模擬考中途切分頁、重新整理、旋轉螢幕,不會殘留播放;回來時模擬考已經中止,並顯示說明。
- layout、bilingual:模擬考進行中、結果。
- `checks/log.mjs`:三個模組的紀錄分開記、合計正確。

**5. 審查重點**
- 模擬考的畫面沒有出現 Pass、Merit、Distinction。
- 抽題只抽有練習型的項目。
- 紀錄的分鐘數是真的播放或作答時間。

---

### S15 麥克風節奏評分(選用;約 600–900 行)

**1. 目標與範圍**
- 做:照 PianoDrill。視奏的演奏階段、聽力的作答階段可以勾「用麥克風評分節奏(選用)」:整段錄完後,在裝置上偵測起音時間,評時間(全部鼓件合併成一條)。
- 不做:即時回饋、分鼓件、分左右手、技巧分頁的「打打看」。

**2. 檔案**
- `js/shared/mic.js`:沿用 PianoDrill `mic.js` 的做法(`getUserMedia` 關掉 echoCancellation、noiseSuppression、autoGainControl;ScriptProcessor 收集;`finish()` 之後釋放)。
  - **跟播放用同一個 AudioContext**,時間軸才對得上;PianoDrill 是另開一個,這裡要改。
  - Safari 17 以上開麥克風前設 `navigator.audioSession.type="play-and-record"`,關掉後改回 `"playback"`。
- `js/shared/onset.js`(純函式):照 PianoDrill 的 `detectOnsets`。鼓比較密,不反應期從 0.09 秒改成 0.05 秒;hop 10 毫秒改成 5 毫秒。
- `drumdrill.v1.mic`;`privacy.html`(只在裝置上分析、不錄音檔、不上傳);`licenses.html` 不用改。
- `docs/IOS.md` 加 `NSMicrophoneUsageDescription`(用 InfoPlist.strings 做中英文)。

**3. 資料來源**:PianoDrill `js/sight/mic.js`、`scoring.js`(前例)。

**4. 驗收與測試**
- `checks/onset.mjs`:用程式產生的脈衝訊號(測試用,不是給使用者聽的鼓聲),在已知時間點加上噪音,偵測誤差中位數 ≤ 5 毫秒,漏偵 ≤ 2%。
- Playwright 用 `--use-fake-device-for-media-stream` 加假的 wav 檔做流程測試:流程能走完,拒絕權限時顯示說明。
- **實機驗收寫進 `docs/IOS.md` 的檢查清單**(雲端做不了):iPhone 內建喇叭和麥克風、有線耳機、AirPods 各打 ♩=100 十六分音符,平均偏移和錄音軟體人工量的差 ≤ 10 毫秒。

**5. 審查重點**
- 預設關閉;拒絕權限不影響其他功能。
- 錄音資料沒有存到 localStorage 或快取。
- 結果標「僅供練習參考,不是官方評分;只評時間」。

---

### S16 送審準備:文件、無障礙、App 打包檢查(約 600–1000 行)

**1. 目標與範圍**
- 做:
  - `docs/IOS.md`:完整的原生步驟,因為雲端做不了(見下)。
  - `docs/APPSTORE.md`:中英文的名稱、副標、描述、審核備註、截圖清單、「與其無關」聲明。
  - `support.html`。
  - `licenses.html`、`privacy.html` 更新(取樣修改說明、麥克風、網頁版用 Google Fonts 會讓 Google 看到 IP)。
  - App 版:`app-www.mjs` 複製時拿掉 Google Fonts 的兩行 `<link>`(App 離線本來就載不到,外觀改用備用字型;網頁版不變)。
  - 無障礙:鼓譜容器加 `role="img"` 和 `aria-label`(打法名稱加左右手序列;視奏寫「4 小節小鼓譜」);子項目分段鈕加 `aria-label`。
  - `layout.mjs` 用 WebKit 跑一次(`BROWSER=webkit`)。
  - 新增 `tools/test/app-www.mjs`:檢查 `app/www` 有全部模組、data、`samples/drums/manifest.json`,每個引用到的取樣檔都存在,importmap 指向的檔案都存在。
  - 全站搜尋「準備中」「還在做」「Coming」應該沒有結果。
- `docs/IOS.md` 的內容:
  - Apple Developer 帳號、Xcode 26。
  - `cd app && npm i && npx cap add ios`(SPM;檢查 `CapApp-SPM/Package.swift` 是否寫成 iOS 15)。
  - `AppDelegate`:AVAudioSession `.playback` + `.mixWithOthers`(要不要混音,交給主持人決定);被打斷的處理。
  - Info.plist:`ITSAppUsesNonExemptEncryption=NO`、方向、`NSMicrophoneUsageDescription`、`CFBundleLocalizations`。
  - `PrivacyInfo.xcprivacy`;`.gitignore` 排除 `App/App/public`。
  - 版本號來源(`VERSION` 檔)。
  - 實機測試清單:靜音鍵、來電、鎖定畫面、AirPods、拔掉耳機、iPad 分割畫面、第一次打開不連網、SE 載入整組鼓的記憶體(Instruments)。
  - Archive → TestFlight → 送審。
  - 「Android 不做,用 PWA」寫進文件。
- 不做:原生程式碼本身(雲端做不了)。

**2. 檔案**:如上。另外 `manifest.webmanifest` 的 `lang` 改成 `en`(介面預設英文)。

**3. 資料來源**:審查意見 A7(Capacitor 8 / Xcode 26)、C3、C5、C8、C12、C13。

**4. 驗收與測試**:全部測試加上 `app-www.mjs`、WebKit 版的 layout。`docs/IOS.md` 的每一步都能照著做。

**5. 審查重點**
- App Store 關鍵字沒有商標。
- 描述有聲明。
- 隱私標籤和 privacy.html 一致(有麥克風,但不收集資料)。
- 截圖清單是真實畫面。

---

## 4. CLAUDE.md 建議修改(由主持人決定)

1. **第 12 行**改成:「檢定:考試系統 **Trinity Rock & Pop Drums**(Initial、1–8 級;不含 Trinity Drum Kit & Percussion 系列,要加的話另外當第三個系統)與 **RSL Rockschool Drums**(Debut、1–8 級)」。
2. **第 14–16 行**補充:「`leave()` 只停播放和計時器,不清題目;`enter()` 有題目時不重新出題;切到背景、音訊被打斷時,外框會呼叫 leave/enter」。「ctx 提供 `gradeLabel`、`showView`、`examData`、`examChanged`,模組不能 import `main.js`」。
3. **第 17 行**(視奏、聽力準備中)換成:「視奏、聽力的題目由 App 依 `data/exam-rsl.json`、`data/exam-trinity.json` 的參數產生(每一筆有官方頁碼,資料核對見 `docs/sources/*.md`);題目卡一律標『僅供練習;實際要求以官方大綱為準』。大綱沒寫的參數:能用練習設定代替的(速度、預備拍)標『練習設定』;出題器的組合方式標『推估』;不能代替的(QSP、聽力風格、伴奏)不出題,只寫說明。Trinity Rock & Pop 沒有技巧、視奏、聽力:技巧頁說明 Song 3,視奏和聽力用 Playback 參數表練習」。
4. **第 18 行**:字串檔加 `js/sight/strings.js`(`sight.`)、`js/ear/strings.js`(`ear.`)。
5. **第 20 行** localStorage 加:`drumdrill.log.v1`(三個模組共用的練習紀錄)、`drumdrill.sight.v1`、`drumdrill.ear.v1`;`drumdrill.v1.mic`。
6. **第 29 行**換成:「檢定要求:照 `docs/sources/rsl-drums.md`、`docs/sources/trinity-drums.md`(已逐頁核對)放進 `data/exam-*.json`;改資料要跑 verify(裡面另外手抄一份配分、速度互相核對)」。
7. **第 30 行**補充:「整組鼓照 ScrollScore 的鼓引擎(`DRUM_VOICES` 增益、`DRUM_POLY`、`chokeOpenHat`、`DRUM_XFADE`);iPhone 每層鼓皮 3 個、鈸 2 個 round-robin;離開視奏、聽力 60 秒後釋放」。
8. **新增一節「鼓組譜」**:「`js/shared/kitnotation.js`、`data/drumkey.json`(每個鼓件有 src;`app` = App 採用的寫法);整組鼓的譜一律顯示圖例;OSMD 畫不出的記號出題器不出(`docs/NOTATION.md`)」。
9. **新增「打擊評分」**:「觸控鼓墊與麥克風(選用)只評時間;整體偏移用中位數扣掉;容許範圍是練習設定;不能跟官方等第放在同一個畫面」。
10. **新增「共用元件」**:`score.js`、`tempo.js`、`log.js`、`player.js`、`timing.js`、`pad.js`、`examdata.js`、`legend.js`、`kitgen.js`、`playbackgen.js`、`mic.js`、`onset.js`;**shared 程式裡不能寫死 id 前綴**。
11. **測試清單**加上:`playback.mjs`、`shots.mjs`、`kitnotation.mjs`、`kitaudio.mjs`、`pad.mjs`、`app-www.mjs`、`verify.mjs` 呼叫的 `checks/*.mjs`。
12. **工作方式**補充:「每個 Stage push 前 `git tag pre-sN`」;「App Store 關鍵字不能放 Trinity、RSL、Rockschool」;「iOS 原生步驟見 `docs/IOS.md`(雲端做不了)」。

---

## 5. Stage 總表

| # | 名稱 | 依賴 | 預估改動量 |
|---|---|---|---|
| S0 | 清債與上線安全(D1、D2、D3、D4、D5、D6、D10、D12、D13、SW 預快取、CI) | — | 400–600 |
| S1 | 共用元件抽出(score、tempo、log)+ 截圖比對 | S0 | 900–1300 |
| S2 | 考試資料檔(RSL、Trinity、drumkey)+ 載入 + 驗證 | S0 | 1000–1400 |
| S3 | 檢定分頁:概要卡 + 技巧要求清單 + 一鍵跳 PAS | S1、S2 | 800–1200 |
| S4 | RSL 技巧依大綱時值的練習型(tuplet 擴充) | S3 | 600–900 |
| S5 | 鼓組記譜引擎 + 圖例 + 可行性樣張 | S1、S2 | 800–1200 |
| S6 | 整組鼓取樣(載入、釋放、choke、增益、App 打包) | S0 | 500–900 |
| S7 | 共用播放器 + 觸控鼓墊 + 計時評分 | S1、S6 | 900–1300 |
| S8 | 視奏骨架 + RSL Debut–3 小鼓 | S2、S5、S7 | 1200–1500 |
| S9 | 視奏 RSL 4–5 整組鼓 | S8 | 900–1300 |
| S10 | Trinity Playback 產生器(Initial–3)+ 看譜練習 | S8 | 900–1300 |
| S11 | Trinity Playback 產生器(4–8) | S10 | 800–1200 |
| S12 | 聽力骨架 + RSL Fill、Groove | S7、S9 | 1200–1500 |
| S13 | 聽力 Trinity Playback 回打 | S11、S12 | 700–1000 |
| S14 | 模擬考 + 練習紀錄整合 | S4、S9、S13 | 700–1000 |
| S15 | 麥克風節奏評分(選用,可以整個拿掉) | S8、S12 | 600–900 |
| S16 | 送審準備(文件、無障礙、App 打包檢查、WebKit) | 全部 | 600–1000 |

可以平行做的:S2 和 S1;S5 和 S6;S10 和 S12 在 S9 之後。

---

## 6. 還需要主持人或使用者決定的事(不影響 S0–S4 開工)

1. **要不要買 PAS Weinberg《Guide to Standardized Drumset Notation》**(約 9–18 美元),讓圖例從「App 採用」升級成「PAS 官方」。不買也能上架,只是圖例卡會一直標推估。
2. **AVAudioSession 要不要 `.mixWithOthers`**(邊放歌邊練)。
3. **CLAUDE.md 第 4 節的修改**,請逐條確認。特別是第 1 條(不採用 Trinity Drum Kit 系列)和第 3 條(出題標示規則)。
4. **字型**:我的建議是只在 App 版拿掉 Google Fonts,網頁版不動;如果要全面改成系統字型,會違反「app.css 整份沿用」,需要另外決定。

## 參考來源(本次網路查證)
- PAS《Guide to Standardized Drumset Notation》零售頁(確認是 PAS 出版的付費書,沒有公開 PDF):[Hal Leonard](https://www.halleonard.com/product/6620063/guide-to-standardized-drumset-notation)、[Popplers Music](https://www.popplersmusic.com/item/06620063/)、[ejazzlines](https://ejazzlines.com/guide-to-standardized-drumset-notation-book-norman-weinberg)、[Wikipedia – Percussion notation](https://en.wikipedia.org/wiki/Percussion_notation)(說鼓組圖例照 PAS 建議,是二手轉述,不能當依據)
- SFZ 的 hi-hat 互相截斷(off_by/group)只查到一般說明,**沒有查到 Naked Drums 原廠 SFZ**:[sfzformat Drum basics](https://sfzformat.com/tutorials/drum_basics)、[Renoise forum: mute groups](https://forum.renoise.com/t/done-b4-b5-mute-groups/39991)、[LinuxSampler forum](https://bb.linuxsampler.org/viewtopic.php?p=24315)
- ScrollScore 鼓引擎:`https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/index.html`(`DRUM_VOICES`、`DRUM_POLY`、`chokeOpenHat` 約第 9060–9200 行)、`drums/manifest.json`
- PianoDrill 前例(只讀):`https://raw.githubusercontent.com/stevenmusic/PianoDrill/main/` 的 `CLAUDE.md`、`js/sight/mic.js`、`js/sight/scoring.js`、`js/sight/i18n.js`

### 實作關鍵檔案
- /home/user/DrumDrill/js/main.js
- /home/user/DrumDrill/js/tech/app.js
- /home/user/DrumDrill/js/shared/audio.js
- /home/user/DrumDrill/js/tech/rudiments.js、/home/user/DrumDrill/js/tech/notation.js
- /home/user/DrumDrill/tools/test/verify.mjs(以及新增的 /home/user/DrumDrill/data/exam-rsl.json、/home/user/DrumDrill/data/exam-trinity.json)