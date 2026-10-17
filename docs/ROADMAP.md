# DrumDrill 爵士鼓檢定特訓：完整實作藍圖

> 範圍：只做了分析與規劃，沒有改任何檔案。行號以 2026-10-17 的 `e034946` 為準。
> 官方大綱的內容我只做了初步網路查證（來源列在文末），**所有考試內容都要再對照官方 PDF 逐頁核對**，文中標「待核對」的都不能直接拿來實作。

---

## 0. 先講結論：五個會影響整體方向的發現

1. **Trinity Rock & Pop 鼓的考試結構，可能跟 App 的「技巧／視奏／聽力」三分法不一樣。**
   - 初步查到的是：唱三首歌，再從兩種「臨場技巧」（Session skills）選一種考：
     - **Playback**：跟著伴奏音軌，一句一句回打沒看過的節奏型和過門。
     - **Improvising**：在伴奏音軌上依指定風格即興。
   - 看起來**沒有獨立的視奏和聽力項目**（待核對）。如果屬實，Trinity 的「視奏」分頁應該寫「本考試沒有這一項」，「聽力」最接近的是 Playback。
   - 另外，`main.js:67-73` 和 `main.js:131-135` 把檢定的子項目寫死成三項，需要改成依考試系統決定。

2. **RSL Rockschool 鼓的結構（待核對）。**
   - 依序考：三首演奏曲、技巧練習（Technical exercises）、視奏或即興與詮釋（二選一）、聽力（過門回打與辨認、節奏型回打）、一般樂理問答（GMQ）。
   - 有資料說初中級的視奏是「沒看過的**小鼓**短曲」。如果屬實，初中級視奏用單線譜就夠，不一定要五線鼓組譜。
   - 6–8 級可能改成 Quick Study Piece。
   - RSL 已經出了 **Drums 2024** 新大綱和新書，2018 版的有效期限要確認。

3. **視奏、聽力的「準備中」說明卡已經寫了沒核對過的內容。**
   - `js/sight/app.js:4` 寫了「30 秒準備」「五線鼓譜」。
   - `js/ear/app.js:4` 寫了「App 自動批改」。
   - 這違反「只照官方資料」的規則，應該先改成中性的說法。

4. **上架前不能留「準備中」的佔位畫面。**
   - App Store 審核 2.1（App 要完整）常會退回佔位內容。
   - 建議：1.0 版先**隱藏**視奏和聽力分頁，或者等內容做完再上架。這需要你決定（見 §4）。

5. **整套鼓組取樣全部解碼後大約 524 MB**（照 manifest 估算：18 個鼓件、立體聲、32 位元浮點、全部 round-robin）。
   - iPhone 不可能全部載入。視奏要用整組鼓的話，一定要挑鼓件、限制 round-robin 數量、照需要才載入（見 M4）。

---

## 1. 現況盤點

### 1.1 外框 `js/main.js`（197 行）
**已完成**
- 底部四個分頁、子項目分段鈕、考試系統和級數只設一次（`S.exam`）、第一次打開的問題。
- 深淺主題、雙語切換、讓螢幕保持亮著、禁止連點放大、在使用者手勢裡喚醒音訊。
- Service Worker 註冊、各模組的介面（`start/enter/leave/setExam/relang/examStatus/onKey`）。

**缺少**
- 檢定的子項目寫死成技巧／視奏／聽力三項（`main.js:72`、`main.js:131-135`），不能依考試系統變化（Trinity 可能沒有視奏和聽力，RSL 有 GMQ）。
- App 被切到背景、iOS 音訊被打斷時，不會停止播放。`main.js:174` 的 `visibilitychange` 只處理螢幕亮著。
- 沒有「關於／授權」頁面。

**技術債**
- `gradeLabel` 在 `main.js:29` 和 `tech/app.js:111` 各寫一份，而且結果不一樣：RSL 入門級在中文版，外框顯示「入門(Debut)」，技巧卡顯示「Debut」。
- 外框傳了 `examChanged`（`main.js:186`），但沒有模組呼叫它（技巧模組把它存在 `ctx`，`tech/app.js:13,533`，之後沒用到）。

### 1.2 技巧 `js/tech/*`（約 760 行）
**已完成**
- PAS 40 個基本打法的資料（`rudiments.js:28-69`），用 `verify.mjs` 另外抄的左右手表互相核對。
- MusicXML 轉換（`notation.js`），OSMD 單線譜，左右手字母、z、反覆 ×N。
- 示範播放：預備拍、拍點、裝飾音提前、滾奏雙擊第二下輕一點、多次反彈。
- 速度 30–240（可以按住連續加減、拖拉）、循環、每輪 +4、只聽拍點。
- 熟練度標記、每個打法的最快速度、練習紀錄（連續天數、今天次數、今天分鐘、近 7 天）。

**缺少**
- 檢定分頁的「本級要求」只寫「還在核對」（`tech/app.js:108-116`）。
- `examStatus()` 回傳空字串（`tech/app.js:24`），檢定卡上技巧那一格沒有進度。
- 沒有打擊回饋（麥克風／觸控），沒有分手練習、重音型變化（變化要有官方依據才能做）。

**技術債與風險**
- **「最快速度」其實是示範播放的速度**（`tech/app.js:465`），不是使用者真的打到的速度。標示容易誤導，可以改名為「示範播過最快」，或等 M7 有偵測後改成「實測」。
- 按熟練標記也算一次練習（`tech/app.js:103` 呼叫 `logPractice(0)`），會灌水「今天次數」。
- 切換語言會呼叫 `switchTab`，播放會被停止（`tech/app.js:20`）。
- 中途按停止不記練習時間（`tech/app.js:461-464` 只有自然播完才記）。
- 譜面、播放軸、節拍器、速度介面全部寫在 `tech/app.js` 裡（`:118-349`），視奏要重用必須先抽出來。

### 1.3 視奏、聽力 `js/sight/app.js`、`js/ear/app.js`（各 12 行）
- 只有說明卡，`examStatus` 回傳「準備中」。
- 說明文字有未經核對的描述（見 §0 第 3 點）。
- `css/app.css` 留有 PianoDrill 的視奏樣式（`#s-title`、`#s-play`、`#s-checklist`、`.tap-pad`、`.answers`、`.mock-res`，約在 `:540-610`、`:720-738`），可以參考重用，不需要的要清掉。

### 1.4 檢定分頁
- 系統和級數設定卡、三格進度（`main.js:126-140`）已經完成。
- 內容只有技巧模組的「還在核對」卡片。
- `data/` 只有 `.gitkeep`。不過 `stamp.mjs` 已經支援 `data/*.json` 的版本指紋（`pdVersions`），而且只讀第一層資料夾，所以考試資料要放成 `data/exam-*.json`，不要放子資料夾。

### 1.5 共用 `js/shared/audio.js`（355 行）、`i18n.js`
**已完成**
- 照 ScrollScore 的母帶鏈路（壓縮 + AudioWorklet 真峰值限幅器）。
- Naked Drums 5 層力度 × round-robin、鼓房殘響、xstick 拍點。
- Cache Storage 快取、App 內建取樣（`BUNDLED`）、`navigator.audioSession.type="playback"`（`:154`，讓 iPhone 靜音開關打開時也有聲音）。

**風險與技術債**
- `pruneScheduled()`（`audio.js:351`）**從來沒被呼叫**。循環播放自然結束時不清 `scheduled`（`tech/app.js:476`），長時間循環時節點陣列一直變大，`cancelFrom` 也會越來越慢。
- 每一下最多只播 2.5 秒（`audio.js:301`）。銅鈸（crash、china）的尾音會被硬切掉，鼓組要依鼓件設定長度和淡出。
- 沒有「互相截斷」的分組（choke group）：開的 Hi-hat 在閉合或踩下時應該被截斷，鼓組播放一定要有。
- `playDrum` 不能在 OfflineAudioContext 用（`:287`），所以沒辦法離線渲染做自動測試。
- 判斷裝置的 UA 程式重複兩次（`:207`、`:237`）。
- `App 版只打包 snare`（`tools/build/app-samples.mjs:10` 的 `PIECES=["snare"]`）。

### 1.6 CSS
- `css/app.css` 整份是 PianoDrill 的，留有不會用到的規則：鋼琴鍵盤 `.kbd`（約 `:547-556`）、`#t-mockBtn`（`:268`）、哈農曲目格子（`:739-742`，目前被 `drum.css:7` 蓋掉，不會出錯，但是死程式碼）、`:1` 的註解還寫 PianoDrill。
- 規則說 `app.css` 要整份沿用。建議做法：不刪，加一段「DrumDrill 沒用到」的註解；或者你同意後清掉。

### 1.7 PWA／離線
- `sw.js`：首頁先上網拿最新版、帶 `?v=` 的資源先用快取。取樣由 `audio.js` 自己的快取處理。
- 風險：
  - 第一次安裝只預先快取 4 個檔案（`sw.js:13`）。沒打開過的模組離線時會缺檔，加了視奏和聽力後要改成安裝時把全部 js/css/vendor 存起來。
  - 字型從 Google Fonts 載入（`index.html:19-20`）：App 離線時拿不到；隱私權政策（`privacy.html`）也沒提到 Google 會看到 IP。
  - `manifest.webmanifest` 的 `lang` 是 `zh-Hant`，但介面預設英文（`i18n.js:12`），小問題。

### 1.8 iOS App 外殼 `app/`
- 用的是 **Capacitor 8**（`app/package.json`），`webDir: www`，Bundle ID 是 `io.github.stevenmusic.drumdrill`。
- **還沒有 `app/ios/` 專案**（還沒跑過 `cap add ios`），所以沒有 Info.plist、AppDelegate、PrivacyInfo.xcprivacy。
- `tools/build/app-www.mjs` 複製 index/privacy/manifest/sw/css/js/data/vendor/icons，再打包取樣，流程正確。
- Service Worker 在 `capacitor://localhost` 底下不會生效（`main.js:194` 有先檢查 `"serviceWorker" in navigator`，不會報錯）。

### 1.9 測試 `tools/test/`
- `verify.mjs`：40 個打法、滾奏擊數、左右手順序、左手先、MusicXML 時值、版本指紋。
- `layout.mjs`：19 種尺寸。
- `bilingual.mjs`：11 種尺寸，中英版面一致。
- `human.mjs`：4 種裝置隨機操作。
- `icons.mjs`、`notation-preview.html`。
- 技術債：
  - `package.json` 的名字是 `fingerdrill-test`。
  - `layout.mjs` 第 85 行註解提到「樂譜全螢幕的橫放播放模式」，DrumDrill 沒有這個功能。
  - 沒有音訊時間精確度的測試。

### 1.10 文件與上架
- `docs/APPSTORE.md:18` 的**關鍵字放了 Trinity、RSL、Rockschool**。這違反審核 2.3.7（關鍵字不能用別人的商標），很可能被退。
- 描述（`:21-22`）也提到考試機構名稱：說明用途、加上「與其無關」的聲明風險比較低，但仍要小心。
- 頁尾（`i18n.js:28`）有 CC-BY 標示，但**沒有授權網址，也沒說明修改了什麼**，CC-BY 4.0 要求三者都要有。OSMD 的 BSD 授權全文只放在 `vendor/` 裡，App 裡看不到。

### 1.11 技術債總表（建議在 M0 一起清）
| # | 問題 | 位置 |
|---|---|---|
| D1 | `pruneScheduled` 沒被呼叫，循環播放時節點越積越多 | `audio.js:351`、`tech/app.js:466,476` |
| D2 | 切到背景或被打斷時不停止播放 | `main.js:174` |
| D3 | `gradeLabel` 重複兩份，中文版結果不一樣 | `main.js:29`、`tech/app.js:111` |
| D4 | 熟練標記算一次練習 | `tech/app.js:103` |
| D5 | 「最快速度」語意不清 | `tech/app.js:465` |
| D6 | 準備中說明卡寫了未核對的考試內容 | `sight/app.js:4`、`ear/app.js:4` |
| D7 | 檢定子項目寫死三項 | `main.js:72,131-135` |
| D8 | 依賴 Google Fonts（離線、隱私） | `index.html:19-20` |
| D9 | 授權標示不完整 | `i18n.js:28` |
| D10 | 關鍵字放了商標 | `docs/APPSTORE.md:18` |
| D11 | PianoDrill 留下的 CSS 和註解 | `css/app.css:1,268,547-556,739-742`、`layout.mjs:85`、`tools/test/package.json` |
| D12 | 切換語言會停止播放 | `tech/app.js:20` |
| D13 | 技巧的 `examStatus` 是空的 | `tech/app.js:24` |

---

## 2. 里程碑藍圖

工作量是一個熟悉這個專案的人（加上 AI 協助）大約要幾天。每個里程碑結束時都要跑 `node tools/build/stamp.mjs`，再跑 verify、layout、bilingual、`human 150 3`。

### M0：清債、抽出共用元件（約 3–4 天）
**目標**：視奏和聽力開工前，先把技巧模組裡可以共用的東西抽出來，修掉 D1–D4、D6、D11–D13。

**要做的事**
1. 新增 `js/shared/score.js`：從 `tech/app.js:118-307` 抽出 OSMD 建立、`fitWidth`、`measureNotes`、播放軸、看不到時延後重畫。技巧模組另外保留 `drawSticking` 當外掛。
2. 新增 `js/shared/metro.js`：預備拍、拍點排程、播放中改速度、`tick` 迴圈、速度介面（按住連續加減、拖拉）。技巧、視奏、聽力共用。
3. 新增 `js/shared/log.js`：練習紀錄移到共用的 `drumdrill.log.v1`，記錄格式是 `{day:{n, sec, by:{tech, sight, ear}}}`；第一次讀取時把 `drumdrill.tech.v1.log` 搬過來。技巧的紀錄卡改用它。
4. `gradeLabel` 只留 `main.js` 一份，透過 `ctx` 傳給各模組（不要讓模組回頭 import `main.js`，會循環依賴）。
5. `main.js`：`visibilitychange` 變成 hidden 時，呼叫目前模組的 `leave()` 和 `audio.stopAll()`；回到前景時再 `enter`。
6. 播放自然結束時呼叫 `audio.pruneScheduled()`，或者在 `stopPlayback(true)` 清掉已經結束的節點。
7. 熟練標記不再算一次練習；練習時間改成「播放了多久就記多久」（包括中途停止）。
8. 視奏、聽力說明卡改成中性文字，例如「題目正在照官方大綱整理」，不要寫任何題型細節。
9. 清掉 PianoDrill 留下的 CSS 和註解（需要你同意，因為規則寫「app.css 整份沿用」）。
10. 技巧的 `examStatus()` 回傳「已會 n／40」。

**測試**
- `human.mjs` 加一個「切到背景」動作（`page.evaluate` 送出 `visibilitychange`），檢查播放已經停了。
- 加一個長時間循環的檢查：`window.__tech.state.scheduled` 在循環 20 輪後要小於 400。
- `verify.mjs` 加：舊紀錄搬到新 log 的單元測試（純 JS，不用瀏覽器）。

**驗收**：功能和畫面跟現在一樣（截圖比對 `tools/test/out/`），四支測試全部通過。

### M1：官方資料取得與資料格式（約 2–3 天，大部分時間要等你提供資料）
**目標**：建立「每一條要求都有來源頁碼」的資料流程。**這個里程碑做完以前，M2、M5、M6 的題目內容都不能開始做。**

**要核對的官方資料**
| 系統 | 資料 | 用途 |
|---|---|---|
| Trinity Rock & Pop Drums | 目前有效版本的大綱 PDF（免費下載，2018 起的版本或更新版，待核對） | 考試項目、Session skills 規格、配分、通過標準 |
| Trinity | Session Skills for Drums（Initial–2、3–5、6–8，付費書） | Playback 長度、速度、記譜方式。只能抽取參數，不能抄題目 |
| RSL Rockschool | **Drums 2024** 大綱說明（Syllabus Guide；2018 版有公開 PDF，2024 版要到官網或代理商找） | 項目、技巧練習清單、視奏／即興規格、聽力題型、GMQ 範圍、配分 |
| RSL | 各級書（Drums 2024+ Debut–8，付費） | 技巧練習速度、鼓譜圖例。只抽取參數和事實 |
| PAS | 已經在用的 rudiments PDF | 已完成 |
| 鼓組記譜 | 各考試機構書上的「鼓譜圖例（Drum key）」頁 | 每個鼓件放在譜上哪個位置 |

**資料格式**：新增 `data/exam-trinity.json`、`data/exam-rsl.json`（放在 `data/` 第一層，才會被 `stamp.mjs` 處理）。每一筆長這樣：
```json
{ "grade": 3, "part": "tech", "kind": "rudiment", "pas": 16, "tempo": [70, null],
  "text": ["…中文…", "…English…"],
  "src": { "doc": "RSL Drums Syllabus Guide 2024", "page": 12, "checked": "2026-11-02" } }
```
- 不能整段照抄大綱文字，只寫事實性的摘要。
- 新增 `docs/SOURCES.md`：列出每份文件的版本、網址、取得日期、有效期限。**不要把付費 PDF 放進 repo。**

**測試**：`verify.mjs` 新增以下檢查：
- 每一筆都有 `src.doc`、`src.page`、`src.checked`。
- `grade` 在 0–8 之間。
- `pas` 對得到 `RUDIMENTS`。
- 中英文都有。
- 沒有出現在檔案裡的級數，介面必須顯示「還在核對」。

**驗收**：至少一個考試系統的一個級數整份核對完成（建議先做 RSL 3 級當樣板）。你看過、簽核。

### M2：檢定分頁的「各級要求對照」（約 3–4 天，要等 M1）
**目標**：檢定分頁照大綱列出這一級的每個項目。有對應練習的可以一鍵跳過去（例如 RSL 技巧練習裡的 PAS 打法 → 技巧分頁、帶上目標速度）。

**要做的事**
- `main.js`：子項目改成依考試系統決定，例如 `SUBS.exam = () => examParts(system)`，從 `data/exam-*.json` 的 `parts` 讀出來。
  - RSL 可能是：技巧／視奏（或即興）／聽力／樂理問答。
  - Trinity 可能是：Session skills（Playback／即興）。
  - 這會改到 CLAUDE.md 寫好的「技巧／視奏／聽力」，**需要你同意**。
- `tech/app.js` 的 `renderExam()`：列出這一級要求的基本打法（PAS 編號 + 官方速度 + 來源頁碼小字）；每一條旁邊顯示「已會」和「示範播過最快」。
- 曲目（Songs／Performance pieces）有版權，只列「本級有 N 首、可以自選幾首」等事實，不放曲名清單（除非你決定放，見 §4）。
- 檢定卡每一項顯示進度，例如「技巧 4/6 已會」；用 `ctx.examChanged()` 重畫。

**測試**
- `layout.mjs` 和 `bilingual.mjs` 加狀態：Trinity 和 RSL 各一個已核對的級數、一個沒核對的級數。
- `human.mjs` 加「從要求一鍵跳到技巧」的動作，檢查跳過去的打法和速度正確。

**驗收**：沒核對的級數仍然只顯示「還在核對」；已核對的每一條都看得到出處頁碼。

### M3：iOS 外殼，可以送審的 1.0（約 3–5 天，可以跟 M1、M2 同時做）
**目標**：技巧功能完整的 App 可以送審（前提是你決定 1.0 先上架，見 §4）。

**要做的事**
1. `cd app && npm i && npx cap add ios`，把 `app/ios/` 放進 git（`.gitignore` 已經排除 `app/www`）。Capacitor 8 預設用 SPM 還是 CocoaPods、最低 iOS 版本、需要的 Xcode 版本，都照官方文件確認（待核對）。
2. **原生音訊設定**：在 `AppDelegate.swift` 設定 `AVAudioSession` 類別為 `.playback`（模式 `.default`）。
   - 這樣靜音開關打開也有聲音，比 `navigator.audioSession` 可靠。
   - 監聽 `AVAudioSession.interruptionNotification`，被打斷結束後通知網頁恢復（Capacitor 的事件，或者讓網頁靠下一次點擊的 `unlockAudio` 恢復，目前已經有）。
3. **背景播放：建議不要做。**不要加 `UIBackgroundModes: audio`。練習 App 用不到，審核也會問理由；切到背景就停止（M0 已經做）。
4. Info.plist：
   - `ITSAppUsesNonExemptEncryption = NO`。
   - 支援直式和橫式；iPad 支援全部方向（多工視窗需要）。
   - 暫時**不要**加 `NSMicrophoneUsageDescription`，M7 才加。
5. 新增 `PrivacyInfo.xcprivacy`：不追蹤、不收集資料。Capacitor 用到的必須說明理由的 API 照它的範本。
6. 字型：App 版不要從 Google 拿。兩個做法：
   - 自己打包 Noto Sans/Serif TC 的子集（OFL 授權）。字型檔很大，要用常用字子集。
   - 或者 App 版直接用系統字型（`-apple-system`、`PingFang TC`）。
   - 我建議：網頁和 App 都改成系統字型優先，順便解決 D8 和隱私問題（要看你能不能接受外觀改變）。
7. 「關於與授權」頁：放在外框，新增 `#about` 對話框或 `about.html`。內容：
   - Naked Drums（Wilkinson Audio）+ CC-BY 4.0 授權連結 + 「取樣經 ScrollScore 剪輯、整理」的修改說明。
   - OSMD 的 BSD-3 授權全文。
   - PAS 版權聲明。
   - Trinity、RSL 為各自的商標、與本 App 無關的聲明。
8. `docs/APPSTORE.md`：
   - 關鍵字拿掉 Trinity、RSL、Rockschool，改成「檢定、考級、爵士鼓、drum exam」之類。
   - 描述保留說明用途的寫法，加上「與其無關」聲明。
   - 截圖要是真實畫面。
9. 從 Xcode 實機測試：靜音開關、來電打斷、鎖螢幕、AirPods、拔掉耳機、iPad 分割畫面、1.0 第一次打開不連網。

**測試**
- 新增 `tools/test/app-www.mjs`：跑完 `app-www` 後，檢查 `app/www` 有 `index.html`、全部模組、`samples/drums/manifest.json`、所有引用的取樣檔，而且 importmap 指向的檔案都存在。
- 實機測試照上面第 9 點的清單做，結果記在 `docs/APPSTORE.md`。

**驗收**：TestFlight 版本在 iPhone SE、iPhone 15、iPad 上所有清單項目都通過。

### M4：鼓組記譜引擎 + 整套鼓組取樣（約 6–8 天）
**目標**：可以畫出、播出多聲部的鼓組譜（手在上、腳在下）。視奏、聽力、檢定都會用到。

**記譜**
- 新增 `js/shared/kitnotation.js`：輸入是 `{ time:[4,4], measures:[{ voices:[[{dur, pieces:["hhClosed","snare"], accent, ghost, open}]] }] }`。
- 輸出 MusicXML：
  - 打擊樂譜號、5 線。
  - `<unpitched>` 的位置照 M1 核對過的考試機構圖例（不同機構可能不一樣，表格放在 `data/exam-*.json` 的 `drumKey` 裡）。
  - 鈸類用 `<notehead>x</notehead>`，鬼音用 `<notehead parentheses="yes">`。
  - 開的 Hi-hat 畫「o」：OSMD 對 `<technical><open/>` 的支援不確定，不行就照 `drawSticking` 的做法自己畫在 SVG 上。
  - 手（voice 1）符桿朝上、腳（voice 2）符桿朝下，要有休止符。
- 跟現有的單線打法譜共用 `beamLevels` 等工具。
- `tools/test/notation-preview.html` 加 `?kit=` 模式，把各種記號畫出來，跟官方圖例對照。

**取樣**
- `audio.js` 新增：
  - `loadKit(pieces, {rrLimit})`：照需要才載入。
  - choke 分組：hhOpen 被 hhClosed 或 hhPedal 截斷，crash 可以用 xstick 抓住（如果需要的話）。
  - 依鼓件設定最長播放時間和淡出（例如鈸 4–6 秒），取代固定 2.5 秒。
- 鼓件只取最少需要的：kick、snare、hhClosed、hhOpen、hhPedal、ride、crashL、tom1、tom3、tom5（實際要哪些照官方圖例決定）。
- iPhone 上每層最多 3–4 個 round-robin，鈸類每層 2 個；有需要時解碼後把聲道合成單聲道，記憶體減半。
  - 估計 10 個鼓件 × 40% round-robin ≈ 110 MB，再合成單聲道 ≈ 55 MB，iPhone 還可以接受。
- `tools/build/app-samples.mjs` 的 `PIECES` 加上這些鼓件。App 大小估計增加 30–40 MB（FLAC），要在 `docs/APPSTORE.md` 記下來。

**測試**
- `verify.mjs`：
  - 鼓組 MusicXML 每個聲部每小節的時值加起來等於拍號長度。
  - 每個鼓件都在圖例表裡。
  - 不會出現 `undefined/NaN`。
- 新增 `tools/test/kitaudio.mjs`（Playwright）：
  - 載入鼓組後，用 `performance.memory`（Chromium）或解碼的位元組數估算記憶體，不能超過上限。
  - 開的 Hi-hat 後面接閉合時，舊的那個音被停掉（看 `scheduled` 狀態）。
- `layout.mjs`：鼓組譜在 280 寬時可以左右捲，不會超出紙張。

**驗收**：在 `notation-preview` 逐項跟官方圖例對照，由你簽核；iPhone SE 實機載入整組不會當掉。

### M5：視奏（約 8–12 天，要等 M1 和 M4）
**目標**：依照**已核對的**各級參數出題，給你準備時間、作答、聽正確版本、回饋。

**哪些內容要先拿到官方資料（拿到之前不能做）**
- RSL：各級視奏的長度（幾小節）、拍號、可以用的音符和休止符時值、是否只用小鼓或用整組鼓、速度範圍、準備時間、有沒有預備拍或伴奏。6–8 級的 Quick Study Piece 規格。**全部待核對。**
- Trinity：如果沒有視奏，這一頁顯示「Trinity Rock & Pop 沒有視奏項目（大綱第 X 頁）」，同時提供不分級的自由讀譜練習。

**出題方式**（需要你決定可不可以接受，見 §4 Q3）
- 不抄官方範例（有版權）。
- 各級題目由程式從「已核對的元素白名單」隨機組合：例如 1 級只能用 ♩、♪♪、四分休止，拍號只有 4/4。
- 每一題都帶種子（seed），可以重現。
- 介面上標示「App 依大綱參數產生的練習題，不是官方考題」。

**新增檔案**
- `js/sight/app.js`（改寫）、`js/sight/gen.js`（純函式出題器，Node 也能跑）、`js/sight/strings.js`（前綴 `sight.`）。
- `index.html` 的 `#mod-sight` 加卡片：`s-setup`、`s-quizCard`、`s-scoreCard`、`s-metroCard`，id 一律用 `s-` 開頭。

**流程**
1. 出題，鼓譜先用霧面蓋住，按「開始準備」才顯示。準備時間的倒數長度**照官方規格**，沒核對前不顯示倒數。
2. 作答：拍點和預備拍都照官方設定。
3. 播放「正確版本」，播放軸跟著走，用的是真實鼓組取樣。
4. 回饋：
   - **(a) 自我評分清單**：節奏、速度穩定、拍號、強弱。只列項目，不打成績。
   - **(b) 觸控鼓墊打節奏**：螢幕上一個或兩個大鍵（手／腳），只檢查時間。
   - **(c) 麥克風**：等 M7 做完再開放。
5. 記錄練習次數、各級正確率。

**測試**
- `verify.mjs`：
  - 出題器對每個已核對級數各跑 1000 個種子，每題只用白名單裡的元素。
  - 每小節時值正確。
  - 同一個種子出的題目一樣。
  - 不會出現白名單以外的拍號。
- `layout.mjs`、`bilingual.mjs`：視奏的準備中、作答中、聽正確版本、結果四種狀態。
- `human.mjs`：加視奏的各種操作；離開分頁時不能還在播放（用 `window.__sight.state`）。

### M6：聽力／回打（約 8–10 天，要等 M1 和 M4）
**目標**：照考試機構實際考的題型練習。

**哪些內容要先拿到官方資料**
- RSL 聽力：目前查到的是「過門回打與辨認」（聽完要打出來，再從寫好的選項中選出聽到的那個）和「節奏型回打」（Groove recall）。每一級的小節數、速度、聽幾次、有沒有伴奏、選項怎麼呈現：**全部待核對**；2024 版可能有改。
- Trinity Session skills **Playback**：在伴奏音軌上一句一句回打節奏型和過門，**有附譜**。每一級的長度、速度：**待核對**。
  - **限制**：官方的伴奏有其他樂器。這個 App 只有鼓的取樣，也不能自己編伴奏。所以只能做「只有鼓和拍點」的版本，要不要做需要你決定。
- Trinity Improvising：需要伴奏音軌，**目前做不了**。

**題目產生**：做法跟視奏一樣，用白名單元素組合、帶種子、標示「App 產生」。
- 「從選項中辨認」：同一個種子產生正確答案和 1–3 個相似的干擾選項（改一個節奏格）。干擾選項的數量照官方規格。

**作答方式**
- 觸控鼓墊：沿用 `css/app.css` 裡現成的 `.tap-pad` 樣式，用 `pointerdown` 的 `event.timeStamp` 換算成音訊時間，要先做觸控延遲校正。
- 選擇題按鈕。
- 麥克風：等 M7。

**新增檔案**：`js/ear/app.js`（改寫）、`js/ear/gen.js`、`js/ear/strings.js`、`js/shared/timing.js`（打擊時間對齊與評分：容許範圍是 App 自訂的，**要標示「App 的練習回饋，不是考試評分」**）。

**測試**
- `verify.mjs`：出題器白名單檢查；干擾選項一定跟正確答案不同。
- `timing.js` 純函式測試：給一串打擊時間 + 已知偏移，對齊結果正確；漏打、多打都能正確判斷。
- `human.mjs`：模擬在鼓墊上點擊（點擊之間的間隔照題目的節奏 ± 隨機誤差），檢查結果是「準」。

### M7：麥克風打擊偵測（技巧、視奏、聽力都能用；約 8–12 天，Beta）
**目標**：使用者在練習墊或真鼓上打，App 顯示每一下早了或晚了多少毫秒、平均誤差、速度穩定度，讓「最快速度」變成真的測出來的。

**可行性和範圍**（詳見 §3.2）
- 能做：單擊的時間偵測（校正後 ±5–10 ms）、相對大小聲（重音）、兩下相隔約 15 ms 以上的 Flam。
- **做不到**：分辨左右手；多次反彈或快速雙擊滾奏的擊數；分辨鼓組上是哪個鼓件。所以視奏和聽力只能評時間（只看節奏的單一聲部）。

**新增檔案**
- `js/shared/onset.js`：getUserMedia 拿麥克風，加上用 Blob 載入的 AudioWorklet 偵測器，做法跟限幅器一樣維持單檔、不需要 build。
- `js/shared/calib.js`：延遲校正。
- 技巧模組加一個「打打看」模式。

**iOS**
- Info.plist 加 `NSMicrophoneUsageDescription`（中英文，例如「偵測你打鼓的時間，只在裝置上分析，不錄音、不上傳」）。
- 打開麥克風時，`AVAudioSession` 改成 `.playAndRecord`，選項 `.defaultToSpeaker`、`.allowBluetoothA2DP`，模式 `.measurement`（關掉系統的訊號處理）；關掉麥克風時改回 `.playback`。
- 網頁版在 Safari 17+ 用 `navigator.audioSession.type = "play-and-record"`。要在實機確認聲音不會跑到聽筒、音量不會變小。

**隱私**：只在裝置上分析，不存音檔。`privacy.html`、App 隱私標籤（仍然是「不收集」）、`docs/APPSTORE.md` 第 13 行都要更新。

**測試**
- 新增 `tools/test/onset.mjs`（Playwright + OfflineAudioContext + 同一份偵測器程式）：
  - 用 samplecache 裡的 **Naked Drums 真實取樣**，在已知時間點混成測試訊號（這是測試用的訊號，不是給使用者聽的合成鼓聲）。
  - 加上噪音、拍點漏音、殘響。
  - 要求：偵測時間誤差中位數 ≤ 2 ms、最大 ≤ 5 ms、誤判率 0、漏偵 ≤ 1%；相隔 15–40 ms 的 Flam 要偵測出兩下。
- 校正測試：模擬 0、50、150、250 ms 的往返延遲，校正結果誤差 ≤ 3 ms。
- 實機測試矩陣：iPhone 內建喇叭和麥克風、有線耳機、AirPods（只能用打拍子校正）、iPad、Mac Chrome 和 Safari。

**驗收**：實機在練習墊上打 ♩=100 的十六分音符，App 顯示的平均偏移和用錄音軟體人工量的差距 ≤ 10 ms。

### M8：模擬考流程（約 5–7 天，要等 M2、M5、M6）
**目標**：照官方的考試順序走一遍，練習「考試中的切換與時間壓力」。

**流程**
- RSL（待核對）：技巧練習（依清單抽題，用官方速度加拍點）→ 視奏或即興（二選一）→ 聽力 → 一般樂理問答。
- 一般樂理問答只能出「看譜上的記號回答」這類可以從圖例或樂理事實出的題目，題目範圍要照大綱。
- Trinity：Session skills（Playback）。演奏曲只顯示「這部分請自己準備」的提示。

**計分**
- 只有在核對過官方配分和等第門檻後，才顯示「各項配分」的參考。
- App 的回饋**不換算成官方分數**，避免誤導。
- 等第門檻（例如 Pass、Merit、Distinction 的分數線）**待核對**。

**新增檔案**：`js/mock/app.js`（或放在外框 `main.js`，以子項目「模擬考」的方式出現），`id` 前綴 `m-`。CLAUDE.md 要同步更新規則。

**測試**
- `human.mjs`：模擬考流程中途切分頁、重新整理、旋轉螢幕，都能保持狀態或正確中止，不會有殘留的播放。
- 版面和雙語：每一步的畫面。

### M9：練習紀錄與進度（約 3–4 天，可以排在 M0 之後任何時間）
- 共用 log（M0 已做）加上：
  - 各模組的次數和分鐘數。
  - 每週目標（`css/app.css` 已經有 `.goal` 樣式）。
  - 各打法的熟練度熱圖。
  - 視奏、聽力各級正確率（`.srow` 樣式可以重用）。
- 匯出、匯入 JSON（沒有伺服器，用分享或下載檔案），換手機時可以轉移。
- 儲存：
  - 網頁版呼叫 `navigator.storage.persist()`。
  - App 版可以考慮用 `@capacitor/preferences` 鏡像備份。iOS 在儲存空間不足時可能清掉 WKWebView 的資料，這個要你決定是否加外掛。
- 測試：`verify.mjs` 加 log 的計算測試（跨月、跨年、時區、超過 400 天自動刪掉最舊的）；`human.mjs` 檢查 localStorage 讀得回來（已經有）。

### M10：上架與送審（約 2–3 天）
- 截圖：iPhone 6.9 吋、6.5 吋，iPad 13 吋。
- 「最低功能」（審核 4.2）的說明重點：
  - 原生音訊設定（靜音開關）、離線內建取樣、麥克風偵測（如果有做）。
  - 不是網站包一層殼。
- 審核備註要寫：考試機構名稱只是說明用途，與它們無關；PAS 打法的出處。
- 年齡分級問卷（2025 年 Apple 改了分級制度，照當時的問卷填）。
- 「需要你回答的審核問題」寫進 `docs/APPSTORE.md`。

---

## 3. 技術決策與取捨

### 3.1 鼓組記譜：繼續用 OSMD 嗎？
- **建議：繼續用 OSMD**，搭配「SVG 補畫」的方式。
- 優點：
  - 單線打法譜已經用 OSMD 驗證過；游標、播放軸、`measureNotes` 都可以共用。
  - MusicXML 可以用 Node 直接驗證時值（verify 已經這樣做）。
  - 不需要 build step。
- 缺點和對策：
  - 打擊樂的特殊記號（開的 Hi-hat 畫 o、鈸類的抓住、幽靈音括號等）支援不完整 → 像 `drawSticking` 一樣自己畫在 SVG 上。
  - 雙聲部的休止符位置可能需要調整。
- 其他選擇：
  - 直接用 VexFlow：OSMD 已經包含 VexFlow，可以只用底層 API。比較靈活，但要自己處理排版和換行。等 OSMD 真的畫不好再考慮。
  - 自己寫 SVG 引擎：工作量大，不建議。
- **先做 M4 第一週的「記號可行性樣張」**：把官方圖例上的每個記號都用 OSMD 畫一次，有缺的再決定要補畫還是換方案。

### 3.2 打擊偵測（Web Audio）的準確度和延遲校正
- **偵測方法**：
  - AudioWorklet 每 128 個取樣點處理一次，但用逐點的包絡線來偵測：先高通濾波（大約 > 2 kHz，強調鼓棒擊打的瞬間），取絕對值加 1 ms 平滑，再用自適應門檻（中位數加 k 倍標準差）加 30 ms 的不反應期。
  - 時間戳 = `currentFrame + i`，可以精確到取樣點，直接對到 `AudioContext` 的時間軸。
  - 不要用 FFT 頻譜通量，時間解析度不夠。
- **一定要關掉**：`echoCancellation`、`noiseSuppression`、`autoGainControl`，不然鼓聲會被系統當成噪音壓掉。
- **延遲校正（關鍵）**：
  - 使用者是聽到拍點才跟著打。要修正的量 = 輸出延遲 + 輸入延遲 = **聲音往返延遲**。
  - 方法 A，聲音迴圈：App 播 8 下 xstick 拍點，麥克風偵測到的時間減掉排程時間，取中位數。適用內建喇叭和有線耳機加麥克風。
  - 方法 B，跟著打拍子：使用者跟著拍點打 16 下，取中位數。適用藍牙耳機（延遲 150–250 ms，而且麥克風聽不到耳機裡的聲音）。
  - Safari 的 `outputLatency` 不可靠，不要依賴。
  - 校正結果依輸出裝置分開存在 `drumdrill.v1.calib`（網頁沒辦法知道目前是哪個輸出裝置，所以要讓使用者自己選「喇叭／有線／藍牙」）。
- **喇叭漏音**：App 自己的拍點會被麥克風收到。對策：
  1. 打打看模式只播拍點，音量降低。
  2. 在每個排程好的拍點前後 ±15 ms 內，如果偵測到的音量小於校正時記下的「拍點音量 × 2」，就忽略。
  3. 建議戴耳機。真鼓的音量遠大於拍點，練習墊則接近，所以練習墊建議用耳機。
  - 打打看模式**不要同時播示範**。
- **觸控鼓墊**：iOS 觸控延遲大約 30–60 ms，而且會變動。同樣要用方法 B 校正，容許範圍要放寬。
- **評分容許範圍**（例如 ±25 ms 算準、±50 ms 算可以）是 App 自己定的，**一定要在介面標示「練習回饋」**，不能說成考試標準。

### 3.3 題目產生 vs.「不自己發明」
- 建議把規則解讀成：**參數和元素照官方，組合由程式產生**。
- 每一個可以用的元素都要有來源頁碼，`verify.mjs` 強制檢查。
- 介面標示「App 依大綱參數產生」。
- 這個解讀需要你確認（§4 Q3）。如果你不接受，視奏和聽力只能做「不分級的自由練習」，或者每一題都要人工照官方範例的風格寫，再逐題核對。

### 3.4 播放架構
- 繼續用 Web Audio 預先排程（`AudioContext` 的時間軸）+ `requestAnimationFrame` 畫面更新，這已經證明好用。
- 改速度沿用 `cancelFrom` + 重新排程。
- 鼓組要加 choke 分組和依鼓件設定的長度。
- 每小節排程一次（往前看 1–2 秒），不要一次排完整首，才不會產生幾千個節點。

### 3.5 共用元件抽出的時間點
- 一定要在 M5 之前（放在 M0）。
- 不然 `tech/app.js` 的譜面、節拍器邏輯會被複製到視奏和聽力，以後要修三份。
- 技巧的行為靠 `human.mjs` 和截圖比對來保證不變。

### 3.6 字型與離線
- 建議改用系統字型：省掉約 1–5 MB 的字型、解決離線和隱私問題。
- 代價：標題的襯線字（Noto Serif TC）外觀會改變，在 iOS 上會變成 PingFang 或 Songti。
- 需要你決定（§4 Q8）。

---

## 4. 主要風險與待你決定的問題

### 4.1 風險表
| # | 風險 | 影響 | 對策 |
|---|---|---|---|
| R1 | Trinity Rock & Pop 可能沒有視奏、聽力 | 三分頁的架構對不上 | M1 先核對，子項目改成依考試系統決定 |
| R2 | RSL 2024 新大綱跟 2018 不同 | 用錯版本 | `docs/SOURCES.md` 記版本和有效期限；資料檔帶 `src.doc` |
| R3 | 官方題目、教材有版權 | 侵權、下架 | 只抽參數，不抄範例；不放曲名或樂譜 |
| R4 | 商標（Trinity、RSL、Rockschool） | 審核 2.3.7、5.2 退件 | 從關鍵字移除；不用它們的標誌、配色；加「與其無關」聲明 |
| R5 | PAS 打法表的版權（© 1984 PAS） | 重新繪製的譜可能算衍生作品 | 打法名稱和左右手順序是事實；鼓譜是 App 自己繪製。要不要寫信問 PAS 授權由你決定 |
| R6 | 送審時有「準備中」畫面 | 審核 2.1 退件 | 1.0 先隱藏，或做完再送 |
| R7 | 審核 4.2「只是包了網頁」 | 退件 | 原生音訊設定、內建取樣、離線；有做的話加麥克風偵測 |
| R8 | 整組鼓組記憶體（全部 524 MB） | iPhone 當掉 | 挑鼓件、限制 round-robin、合成單聲道、照需要載入、實機測試 |
| R9 | iOS 開麥克風後，聲音跑到聽筒或變小 | 打打看模式不能用 | App 版用原生 `.defaultToSpeaker`；網頁版實機確認 |
| R10 | 藍牙耳機延遲、喇叭漏音 | 回饋不準 | 依裝置分開校正；建議有線耳機；漏音遮罩 |
| R11 | iOS 清掉 WKWebView 的 localStorage | 練習紀錄不見 | `storage.persist()`、匯出匯入、可以考慮 Preferences 外掛 |
| R12 | 抽出共用元件時技巧功能壞掉 | 現有功能退步 | M0 一次做完，用截圖比對和 `human.mjs` 驗證 |
| R13 | 官方大綱取得困難（付費書） | M5、M6 一直不能開始 | 你先決定要買哪幾本，或者先只做 RSL 有公開 PDF 的部分 |

### 4.2 待你決定的問題
1. **1.0 怎麼上架？** 選項：
   - (a) 1.0 只有技巧 + 練習紀錄，隱藏視奏和聽力分頁，先上架。
   - (b) 等視奏和聽力都做完一起上。
   - 我建議 (a)，但檢定分頁要先有至少一個系統的要求對照，不然「檢定特訓」這個名字名不副實。
2. **檢定子項目能不能改成依考試系統決定？**（例如 RSL：技巧／視奏或即興／聽力／樂理問答；Trinity：Session skills）這會改到 CLAUDE.md 寫好的規則。
3. **題目可以「參數照官方、組合由程式產生」嗎？**（§3.3）這決定視奏和聽力能不能分級出題。
4. **官方資料由誰取得？** 要買哪幾本書（RSL Drums 2024+ 各級、Trinity Session Skills for Drums）？要先做哪個系統、哪幾級？（建議先做 RSL 1–3 級當樣板）
5. **Trinity Playback 要不要做「只有鼓和拍點、沒有伴奏」的版本？** Improvising 需要伴奏音軌，要不要直接標示「不提供」？
6. **要不要做麥克風打擊偵測（M7）？** 做了的話要加麥克風權限、更新隱私權政策；回饋只能看時間，不能看左右手。
7. **「最快速度」要改名為「示範播過最快」，還是等 M7 改成實測？**
8. **字型改成系統字型**（離線、隱私），還是自己打包 Noto 子集（App 會變大）？
9. **可以清掉 `css/app.css` 裡 PianoDrill 留下的規則嗎？**（規則寫「整份沿用」）
10. **App Store 描述要不要提考試機構名稱？** 只放描述裡、加上「與其無關」聲明，關鍵字拿掉，這樣可以嗎？
11. **PAS 打法表要不要寫信問 PAS 授權？**
12. **曲目清單（考試指定曲名）要不要列？** 曲名本身是事實，但很接近官方內容。建議不列，只寫「本級 N 首」。
13. **App 版要不要加 `@capacitor/preferences` 備份練習紀錄？** 會多一個原生外掛。

---

## 參考來源（初步查證，全部仍要對照官方 PDF）
- Trinity Rock & Pop 鼓 Session skills（Playback／Improvising、三首歌）：[trinitycollege.com resource 7898](https://trinitycollege.com/resource/?id=7898)、[resource 6787](https://www.trinitycollege.com/resource?id=6787)、[Presto Session Skills Drums 6–8](https://www.prestomusic.com/sheet-music/products/7697451--trinity-session-skills-drums-grades-6-8)、[Chimes Session Skills Initial–2](https://www.chimesmusic.com/products/trinity-rock-and-pop---session-skills-for-drums-grades-initial---2.html)
- RSL 考試順序、聽力題型、樂理問答：[Turra Music – Drums Companion Guide](https://www.turramusic.com.au/rockschool-drums-companion-guide)、[AMEB Rockschool Exam Options PDF](https://rockschool.ameb.edu.au/wp-content/uploads/2024/09/Rockschool-Australia-Exam-Options.pdf)、[AMEB Rockschool Drums Grade 5](https://stg.ameb.edu.au/rockschool-drums-grade-5)
- RSL 2018 大綱說明 PDF：[AMEB 鏡像](https://rockschool.ameb.edu.au/wp-content/uploads/2019/09/RSL_Drums_Syllabus_Guide_2018_DIGITAL_31May2019-1.pdf)
- RSL Drums 2024 新版：[AMEB Rockschool Drums Debut 2024](https://www.ameb.edu.au/rockschool-drums-debut-2024)、[Grade 8 2024](https://www.ameb.edu.au/rockschool-drums-grade-8-2024)

---

### 實作關鍵檔案
- /home/user/DrumDrill/js/main.js：檢定子項目改成依考試系統、切到背景就停、`gradeLabel` 統一、模擬考入口
- /home/user/DrumDrill/js/tech/app.js：抽出譜面和節拍器到 `js/shared/score.js`、`js/shared/metro.js`；本級要求對照；`examStatus`
- /home/user/DrumDrill/js/shared/audio.js：鼓組載入、choke 分組、依鼓件設定長度、清除已排程節點；之後的麥克風和 AudioWorklet 偵測器
- /home/user/DrumDrill/js/sight/app.js 和 /home/user/DrumDrill/js/ear/app.js：從說明卡改成完整模組（加上 `gen.js`、`strings.js`）
- /home/user/DrumDrill/tools/test/verify.mjs：資料來源頁碼、出題器白名單、鼓組 MusicXML 時值檢查（另外新增 `tools/test/onset.mjs`、`kitaudio.mjs`、`app-www.mjs`）
- 其他會動到的：/home/user/DrumDrill/data/exam-rsl.json、/home/user/DrumDrill/data/exam-trinity.json（新增）、/home/user/DrumDrill/tools/build/app-samples.mjs、/home/user/DrumDrill/docs/APPSTORE.md、/home/user/DrumDrill/app/（`cap add ios` 之後的 AppDelegate.swift、Info.plist、PrivacyInfo.xcprivacy）

---
## 審查意見(Sonnet 審查員)

> 審查日期 2026-10-17,對照 `e034946` 的程式碼逐條核對。網路查證只做了 Capacitor 8 與 Trinity / RSL 的大方向,**考試內容本身我沒有核對官方 PDF**,仍照藍圖「待核對」處理。

### A. 事實錯誤與更正

**已確認正確(不用改)**
- `pruneScheduled`(`js/shared/audio.js:351`)全專案沒有任何呼叫(grep 只有定義那一行)。
- `main.js:72` 的 `SUBS.exam` 與 `main.js:131` 的標籤表確實寫死 技巧/視奏/聽力;`examChanged` 外框傳了(`main.js:186`)、技巧存進 `ctx`(`tech/app.js:533`)後沒人呼叫。
- `docs/APPSTORE.md:18` 關鍵字確實有 Trinity、RSL、Rockschool(整串 76 字,沒超過 100 字上限,問題只在商標)。
- `app/` 只有 `package.json` 和 `capacitor.config.json`,**沒有 `ios/`**。
- `stamp.mjs` 的 `data` 只讀第一層:`fs.readdirSync(root+"data").filter(f=>f.endsWith(".json"))`,子資料夾不會被指紋。
- 取樣解碼約 524 MB:**算過了,是對的**。`manifest.json` 的 `frames` 是「該力度層全部 round-robin 的總格數」(snare L1 十個檔實測加起來 660811,等於 manifest),18 個鼓件合計 65,472,569 格 × 2 聲道 × 4 位元組 = 523.8 MB。藍圖的「10 個鼓件 × 40% round-robin ≈ 110 MB、單聲道 55 MB」也對(實算 112 / 56 MB)。FLAC 約每格 1 byte,所以「App 增加 30–40 MB」(取全部 round-robin 的話)合理。
- 其他行號(`audio.js:154/207/237/301`、`tech/app.js:103/465/476`、`sw.js:13`、`layout.mjs:85`、`tools/test/package.json` 名稱 `fingerdrill-test`)都對。

**需要更正**
1. **§1.7 的 Service Worker 風險寫錯原因。** 藍圖說「沒打開過的模組離線時會缺檔」。實際上三個模組都是 `main.js:7-9` 靜態 `import`,第一次載入就全部抓了,「沒打開過」不成立。**真正的洞**是:SW 在 `window.load` 之後才註冊(`main.js` 檔尾),第一次載入的 css/js/OSMD 都是 SW 接管前抓的,不在 SW 快取裡;安裝時只預先快取 `./`、manifest、2 個圖示(`sw.js:13`)。所以「只上線一次、第二次離線」可能打不開(要靠瀏覽器自己的 HTTP 快取碰運氣)。另外 M1 新增的 `data/exam-*.json` 是之後才 `fetch` 的,沒讀過就不會在快取裡。修法:install 時 `addAll` 完整檔案清單(可由 `stamp.mjs` 產生),不是「加了視奏聽力才要做」。App 版不受影響(不用 SW)。
2. **D1 的修法有陷阱。** 藍圖第 6 點「自然結束時呼叫 `pruneScheduled()`」。但 `schedulePlay` 是把**全部反覆次數一次排完**(`tech/app.js:385-406`,reps 最多 ×8、滾奏每個音都是一個節點),播放中本來就常有 >400 個還沒響的節點;`pruneScheduled` 的 `slice(-200)` 是「丟掉最舊的」,若在播放中呼叫會讓還沒響的節點脫離追蹤,之後按停止 `stopAll()` 停不掉(鬼音)。只有在**自然播完**(`tech/app.js:462` 之後,此時全部都已結束)才安全,最簡單的修法是自然結束直接 `scheduled = []`,或每個節點加 `onended` 自己移除。M0 的測試門檻「循環 20 輪後 < 400」用現在的 `pruneScheduled` 也會過,但測不出上述風險,要另加「播放中按停止後確實無聲」的檢查。行號小修:`logPractice` 在 `tech/app.js:464`,迴圈重播在 `:466`。
3. **§M4 的 `loadKit(pieces,{rrLimit})` 已經有一半了。** `audio.js:238` 的 `loadDrums(pieces)` 本來就是「依鼓件載入」,而且 `RR_LIMIT`(`audio.js:237`)在 iPhone / 小記憶體裝置已經是每層 6 個。要新增的是更低的上限、鈸類獨立上限、卸載(離開模組就釋放),不是從零寫。注意:現有 iPhone 上限 6 時,若載入整組 18 個鼓件仍約 314 MB(立體聲),所以「挑鼓件」比「限制 round-robin」更有效。
4. **§3.4「繼續用預先排程」與「每小節排程一次(往前看 1–2 秒)」互相矛盾。** 現況是整首一次排完(見上),往前看排程是**重寫排程器**(含改速度、循環、暫停、`rAF` 被節流時的補排),不是沿用。要列成 M0/M4 的明確工作。
5. **§1.6 的 CSS 行號不準。** `.kbd` 實際在 `css/app.css:523–553`(不是 547–556);`#s-title/#s-play/#s-checklist` 在 `:731–735`(不是 720–738);`.tap-pad` 在 `:557`。`tools/test/bilingual.mjs` 的視窗只有 4 種(`:89`:iPhone/SE/iPad/桌機),藍圖寫「11 種尺寸」我找不到對應。
6. **§1.10 CC-BY 的說法略不精確。** CC BY 4.0 §3(a) 要求:(1)署名資訊(作者、版權聲明、授權聲明、免責聲明、素材的連結)、(2)標示有無修改、(3)授權條款的名稱**加上連結**。現在頁尾(`i18n.js:28`)有作者與「CC-BY 4.0」名稱,缺連結、版權/免責聲明;「取樣經 ScrollScore 整理」算含糊的修改標示。**修改的範圍會隨 M4 擴大**(裁短、淡出、降成單聲道、增益、加殘響),關於頁要一起寫進去。§3(a)(2) 允許「合理的方式」,所以關於頁放連結就夠,不必每頁都放。
7. **Capacitor 8(藍圖標「待核對」)我查了:** 2025-12 發布;`cap add ios` 預設 **Swift Package Manager**(CocoaPods 要用 `--packagemanager CocoaPods`),iOS 最低 15.0,需 Xcode 26。另外 Apple 自 2026-04-28 起上傳 App Store Connect 一律要用 Xcode 26 / iOS 26 SDK。有社群回報 SPM 產生的 `CapApp-SPM/Package.swift` 寫死 `.iOS(.v14)`,`cap sync` 後要檢查。M3 第 1 點可以把「待核對」改成這些。(來源:[Ionic 官方公告](https://ionic.io/blog/announcing-capacitor-8)、[Capawesome 升級指南](https://capawesome.io/docs/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/)、[論壇回報](https://forum.ionicframework.com/t/capapp-spm-package-swift-always-generates-ios-14-instead-of-ios-15-after-capacitor-8-spm-migration/251606);第三方整理,動手前再對一次官方升級指南。)
8. **審核條款編號,查證結果:** 2.1(App 完整、不可有占位內容)、2.3.7(metadata/關鍵字不可塞商標與無關詞)、4.2(最低功能,不能只是包網頁)、5.2(智慧財產;商標用在 App 內容是 5.2.1)——編號與用途都正確。藍圖 R4 把風險集中在關鍵字,**低估了 5.2.1**:App 介面(`main.js` 的考試晶片、檢定卡)顯示 Trinity / RSL 名稱,審核員可以要求提出授權或合理使用說明,「與其無關」聲明不能保證放行(見 C 第 10 點)。
9. **`AudioContext.outputLatency`**:藍圖說「Safari 不可靠」。據我所知 Safari 根本沒實作這個屬性(Chromium 有),寫「不要依賴」即可,別寫成「不準」,實機再確認。
10. **M7 的 `AVAudioSession` 設定:** `.playAndRecord` + `.defaultToSpeaker` + `.allowBluetoothA2DP` 是合法組合;但 `.measurement` 模式在內建喇叭上常被回報輸出變小,且 `allowBluetoothA2DP` 和「藍牙耳機的麥克風」是不同路徑(A2DP 沒有麥克風)。藍圖已經寫「實機確認」,維持,但不要在計畫裡當成已知可行。

### B. 違反專案規則的地方

1. **M0 第 9 點(清 PianoDrill CSS)、Q8/§3.6(改系統字型)直接牴觸「`css/app.css` 整份沿用、外觀照 PianoDrill 設計代幣」。** 藍圖有標「需要你同意」,OK;但這兩項**在 CLAUDE.md 改掉之前不能動工**,排程上要當成「等決定」的項目,別放進 M0 的 3–4 天。`app.css` 有 5 處寫死 `"Noto Serif TC"`(`:89/141/193/586/604`),換字型不是只改 `index.html:20`。
2. **架構規則會被改的地方,要先改 CLAUDE.md 再做:** (a) 檢定子項目依考試系統變化(M2)、(b) 1.0 隱藏視奏/聽力分頁(R6 的做法 a;CLAUDE.md 寫死「底部四個分頁」)、(c) 新增 `m-` 前綴與 `js/mock/`(M8)、(d) 新的 localStorage 鍵 `drumdrill.log.v1`、`drumdrill.v1.calib`(M0、§3.2;CLAUDE.md 只列兩個鍵,而且 `drumdrill.v1.calib` 到底是鍵名還是 `drumdrill.v1` 裡的欄位,藍圖沒寫清楚,建議放在 `drumdrill.v1` 內以免多鍵)。
3. **M7 測試混音:不算合成鼓聲,但有兩個要說清楚。** 用的是 Naked Drums 真實取樣在已知時間點相加,聲音不給使用者聽,精神上沒違規。問題是 (a) 規則寫「一律用 `audio.js`」,而 `playDrum` 在 OfflineAudioContext 直接 `return false`(`audio.js:287`),測試只能繞過 `audio.js` 自己解碼——力度分層與音量曲線(照原廠 SFZ)就沒被測到。建議在 `audio.js` 加一個離線渲染入口共用同一套力度曲線,或在 CLAUDE.md 寫明「測試工具可直接解碼取樣」的例外。(b) 「加上噪音」的白噪音是合成的,但不是鼓聲,測試檔裡標清楚即可。(c) 乾淨取樣混音通過≠麥克風實錄通過,驗收標準必須以藍圖寫的「實機 ≤10 ms」為準,中位數 ≤2 ms 的離線門檻只是迴歸測試。(d) `tools/test/samplecache/` 在 `.gitignore` 裡,CI 要自己下載。
4. **出題器(§3.3、M5、M6)落在規則的灰色地帶,不能預設允許。** CLAUDE.md:「題目規則要先照 Trinity / RSL 官方大綱與範例整理才做」「只照官方資料,不自己發明」。程式隨機組出來的節奏本身就是新發明的內容;而「白名單」要從大綱文字推出來,官方大綱對視奏/聽力多半只寫描述(例如「簡單的四分與八分音符」),不是逐項列舉,所以白名單其實是**作者的解讀**。`verify.mjs` 能檢查「每個元素有頁碼」,但檢查不出「大綱沒說可以,但也沒說不可以」的組合(例如連結線、切分、休止符位置)。建議:Q3 要使用者明確回答並寫進 CLAUDE.md;出題範圍要用「只放大綱明文列出的元素,沒列的一律不放」;UI 不可寫「第 N 級視奏」而是「依大綱參數的練習」(藍圖已有類似標示,維持);官方有公開範例(specimen)的級數,優先做成「把官方範例的參數量出來」而不是隨機。
5. **M8 的「一般樂理問答只能出從圖例或樂理事實出的題目」同樣是自己出題。** 若沒有官方題庫或範例可依據,這一項建議直接砍掉(只做考試順序計時器,見 D)。
6. **§3.2 的容許範圍(±25 / ±50 ms)和 M6 的「準/可以」分級是 App 自訂的。** 藍圖已要求標示「練習回饋」,維持;補一條:**不可把它和官方等第(Pass/Merit/Distinction)放在同一個畫面或做換算**(M8 已有此意,但 M6 也要)。
7. **中英文版面一樣:** M1 的資料 `text: ["中文","English"]` 會直接進畫面,英文長度沒有上限,違反「英文長就縮短」。`verify.mjs` 要加「每筆英文字元數 ≤ 中文字元數的 N 倍或固定上限」與「兩種語言的筆數一致」。M2 的檢定子項目依系統變動(Trinity 1 個、RSL 4 個)在 280 寬放得下嗎?要進 `layout.mjs` 的 280/320 狀態。
8. **id 前綴:** M0 抽出的 `score.js` / `metro.js` 目前依賴 `t-` 開頭的元素(`t-scroll`、`t-playBtn`…,`tech/app.js` 內的 `$("playBtn")` 是模組自己的 `$` 幫忙加前綴)。藍圖沒說共用程式碼怎麼收前綴——要明寫成「共用函式接 `prefix` 或根元素」,否則會把 `t-` 寫死在 shared。`css/drum.css:4` 的 `order` 規則也是 `#t-` 開頭,視奏聽力要各自補。
9. **不要有 build step:沒有違反。** Blob AudioWorklet、系統字型、Noto 子集(一次性前處理,產物進 git)都可以;但「單聲道轉檔」若放進 `app-samples.mjs` 要注意那是 App 專用的打包前處理,網頁版仍直接讀 ScrollScore,兩邊的聲音就不一致(也要寫進 CC-BY 的修改說明)。
10. **「力度分層與音量曲線照原廠 SFZ」:** M4 的 choke 分組、依鼓件長度與淡出是**原廠 SFZ 的 `group/off_by/ampeg_release` 有寫才能做**。動工前先讀 Naked Drums 的 SFZ,有就照抄,沒有才當 App 自訂並列入修改說明。現有的「一律 2.5 秒截斷」(`audio.js:301`)本身已經是偏離原廠的設計。
11. **工作方式:** 規則是「測試好就直接 push main」,而 main 就是 GitHub Pages 的正式站。M0 是大重構,直接 push 會讓線上使用者立刻吃到;建議照規則 push,但先打 tag(例如 `pre-m0`)方便回滾,並在 M0 之前補上 CI(見 C 第 6 點)。每次 push 還要照規則用中文條列說明,藍圖沒提醒。

### C. 遺漏與風險補充

1. **無障礙(VoiceOver / 動態字級):** 藍圖完全沒提。現況:分頁列有 `role=tablist/tab`,速度、播放等有 `aria-label`,`prefers-reduced-motion` 有處理(`app.css:313`),但**鼓譜是 OSMD 畫的 SVG,沒有任何文字替代**,VoiceOver 讀不到打法內容;子項目分段鈕只有 `aria-pressed` 沒有群組標籤;`aria-live` 只在題目卡。至少要:鼓譜容器 `role="img"` + `aria-label`(打法名、左右手序列如 `R L R R L R L L`)、動態字級不破版(`layout.mjs` 加 200% 字級案例)、播放狀態朗讀。Apple 也有 App Store Connect 的無障礙聲明欄位(據我所知是 2025 年起的選填標示,上架時看一下)。
2. **Android 要不要做:** 藍圖沒決定。Capacitor 可以出 Android,但 (a) Web Audio 在 Android 的輸出延遲遠大於 iOS,M7 的打擊偵測幾乎不可行;(b) Google Play 另有新帳號 12 位測試者 14 天等條件(據我所知,政策常變,動工前查);(c) 現有 PWA 已經可以裝到 Android 主畫面。建議在計畫裡**明寫「Android 不做,用 PWA」**,並在 `docs/APPSTORE.md` 記下。
3. **網頁版與 App 版同步 / 版本更新流程:** 網頁 push 即上線,App 要走審核,兩邊資料(`data/exam-*.json`)會出現版本差。需要:(a) 發佈清單寫進 `docs/`:`stamp → verify → app-www → cap sync → Xcode archive → TestFlight → 送審 → 打 git tag`;(b) `Info.plist` 的版本號與 build number 來源(建議放一個 `VERSION` 檔,`app-www.mjs` 寫進 `app/www`);(c) 網頁版可以修錯字,App 版只能等下一版,所以**考試資料的錯誤修正流程**要定(App 內顯示「資料版本 / 核對日期」);(d) 取樣快取名 `drumdrill-samples-v1`(`audio.js`)和 SW 快取名 `drumdrill-app-v1`(`sw.js:10`)在取樣或檔案結構改變時要記得升版;(e) 不要讓 App 下載可執行程式碼(審核 2.5.2),只下載 JSON 資料沒問題。
4. **網頁版取樣來源是別人的 repo 的 raw 網址**(`audio.js:209` 的 `raw.githubusercontent.com/stevenmusic/ScrollScore/main/`):repo 改名、改私有、改檔名或被限流,線上版立刻沒聲音。App 版有內建不受影響。建議把 M4 要用的取樣固定版本(指定 commit 或複製到本 repo 的 Pages 目錄),並在 `docs/` 記下。
5. **錯誤回報:** 沒有任何遙測是對的(隱私承諾),但也沒有回報管道。建議:關於頁放「回報問題」`mailto:`(使用者自己按才送,可預填 App 版本、裝置、語言,不含練習資料)、GitHub Issues 連結;App 內留一個本機的錯誤環形緩衝(`window.onerror` 記最近 20 筆,關於頁可「複製診斷資訊」);TestFlight 與 App Store Connect 的當機報告是免費的。App Store Connect 還要「支援網址」,不能只丟 GitHub 首頁,建議做一頁 `support.html`。
6. **測試沒進 CI:** 專案沒有 `.github/`,GitHub Pages 直接從 main 部署,所有測試靠手動。至少加一個 GitHub Actions:`node tools/test/verify.mjs`(含 `stamp --check`,純 Node,幾秒)每次 push 跑;Playwright 三支(layout/bilingual/human)因為要下載取樣與瀏覽器,放 PR 或每晚。另外**測試只用 Chromium**(`harness.mjs` 匯入 `chromium`),實際執行環境是 iOS WKWebView;至少 `layout.mjs` 加 Playwright WebKit 跑一遍。音訊時間精確度與靜音開關只能實機。
7. **App 內購 / 收費模式:** 藍圖沒提,但它會影響很多決定。免費、買斷、內購解鎖各有不同:內購需要 StoreKit(Capacitor 沒有官方外掛,通常用 RevenueCat 或社群外掛,這就違反「沒有第三方 SDK、不收集」的隱私定位,審核 3.1.1 要用 Apple 內購)。**一旦收費,R3 / R5(版權、商標)的風險明顯上升**:PAS 版權頁(© 1984)的重繪、考試機構名稱的使用,免費教學用途和商業用途的合理使用判斷不同。Q11(問 PAS 授權)應從「由你決定」升為上架前要做的事。建議 1.0 免費、無內購,把收費留到取得授權之後。
8. **本地化:** (a) `Info.plist` 的 `NSMicrophoneUsageDescription` 等要用 `InfoPlist.strings` 與 `CFBundleLocalizations`(`zh-Hant`、`en`)才會顯示對應語言,藍圖只寫「中英文」沒說怎麼做;(b) App Store 的名稱、副標題、描述、關鍵字、截圖要各備 zh-Hant 與 en(`APPSTORE.md` 目前只有中文);(c) 沒有簡體中文,簡中使用者會看到英文——是否要出 zh-Hans 要決定;(d) **中國大陸 storefront 需要 ICP 備案**(據我所知),若不備案,在 App Store Connect 把中國大陸取消勾選;(e) `manifest.webmanifest` 的 `lang:"zh-Hant"` 與預設英文介面不一致(藍圖已提,小事)。
9. **iPad 鍵盤:** 外框已有 `onKey`(空白鍵播放)。補:iPad 外接鍵盤的焦點環要看得到(`:focus-visible`)、`keydown` 在 WKWebView 的 `event.code` 可用,但 Tab 順序與 VoiceOver 手勢要實測;M7 的觸控鼓墊在 iPad 可考慮鍵盤對應(例如 `F`/`J` 當左右手),這也能當無麥克風時的備案輸入。
10. **商標/授權的實際取得:** 在介面與 App Store 描述使用 Trinity / RSL / PAS 名稱,藍圖的對策只有聲明。建議多一步:寫信給 Trinity College London、RSL(Rockschool)和 PAS,說明用途(免費練習工具、不使用標誌配色),**取得書面回覆**。即使沒回,留著寄信紀錄,審核問起時比較有東西可附。資料取得方面(M1),「只抽取參數」是事實性資訊風險低,但大綱的選擇與編排本身仍有著作權,資料檔不要貼原文句子(藍圖已寫)。
11. **M9 匯出/匯入在 WKWebView 的限制:** `<a download>` 與 `Blob` 下載在 Capacitor iOS 內通常不會彈出儲存/分享。要用 `navigator.share({files})`(iOS 15+ WKWebView 是否可用要實測)或 Capacitor 的 Share / Filesystem 外掛,等於又多一個外掛,要算進 Q13。`navigator.storage.persist()` 在 WKWebView 也沒效果,iOS 對 App 的 WKWebView 資料是否會被清,實際上只有儲存空間極度不足才發生,但藍圖 R11 的「清掉」建議以匯出備份為主,別依賴 persist。
12. **M3 的 AVAudioSession `.playback` 要不要 `.mixWithOthers`:** 練鼓的人常常邊放歌邊打。只設 `.playback` 會把使用者的音樂中斷;建議 `.playback` + `.mixWithOthers`(並提供設定,或預設混音)。這是產品決定,藍圖沒有討論。
13. **開發環境與帳號:** 沒提 Apple Developer Program(年費)、Mac / Xcode 26 的取得、App Store Connect 的稅務與銀行資料(免費 App 也要填付費 App 協議以外的基本資料)。`app/ios` 進 git 時確認 Capacitor 產生的 `.gitignore` 排除了 `App/App/public`(`cap sync` 會把整個 `www` 含取樣複製進去,不能進 git)。
14. **記憶體:** 除了藍圖的估算,iOS 的 WebContent 程序有獨立的 jetsam 上限(低於整機記憶體,各機型不同)。建議 M4 加「離開視奏/聽力就釋放 `kit` 緩衝」與 Instruments 實測,SE 系列(RAM 較小)當底線。
15. **Trinity 版本有效期:** 藍圖只對 RSL 提醒 2018/2024 版本;Trinity Rock & Pop 也有版本期限(我只查到 2018 版的網頁,是否已有更新版未確認)。`docs/SOURCES.md` 兩邊都要記有效期。我的網路查證只確認了 Trinity「三首歌 + 短的 session skills(Playback 或 Improvising 擇一)」這個大方向與藍圖相符,RSL 2024 的各項規格沒查到,**沒有取得官方 PDF 之前一律以「待核對」處理**。

### D. 工作量與順序調整

1. **M0 低估,而且不該擋住 M3。** 抽出 `tech/app.js:118–349`(約 230 行,譜面、播放軸、節拍器、速度介面互相纏在一起)+ 新 log + 遷移 + 可見性處理 + 重寫排程,實際約 5–7 天,而且是整個計畫裡退步風險最高的一步(R12)。建議拆開:**M0a(1–2 天)**只做小而獨立的修正:D1(正確版)、D2、D3、D4、D6、D9、D10,先出貨;**M0b(共用元件抽出)**延到真的要做 M5 才做,避免只為「可能的」重用先動核心。
2. **M3(iOS 1.0)提前,與 M1 平行開工,並與 M10 合併。** 首次上架要走:Apple Developer 帳號、App Store Connect 記錄、隱私政策網址、截圖(iPhone 6.9"/iPad 13")、TestFlight、審核,第一次送審被退很常見。日曆時間 1–2 週,不是 3–5 天加 2–3 天。
3. **M1 是日曆時間不是工作天。** 「2–3 天」大部分是等你取得資料(買書、找 PDF)。實際會是 1–3 週,而且它是 M2、M5、M6、M8 的共同阻塞點;Q1–Q4 一天都不該拖。建議**第一天就開始**,先只做一個系統、一級(RSL 3 級或 Trinity 的結構頁),先弄清 R1(Trinity 到底有沒有視奏/聽力)。
4. **M4 風險被放在里程碑中間,應該前移。** OSMD 對打擊樂譜(打擊樂譜號、`<unpitched>`、`x` 符頭、雙聲部符桿方向、開 Hi-hat 的 o 記號)的支援不確定。藍圖把「記號可行性樣張」放在 M4 第一週;應改為**專案第 1–2 天的 spike**,結果決定 M5 / M6 能不能共用 OSMD。保守估計 M4 為 10–15 天。
5. **M5 + M6 合計藍圖 16–22 天,未含:** 出題規則逐條核對(M1 的產出品質決定)、觸控鼓墊延遲校正(M6 要新做 `timing.js` + 校正流程,至少 +5 天)、視奏的 UI 狀態(準備/作答/回放/結果)的雙語與 19 種版面測試。實際較可能 30 天以上,且全部取決於 Q3(能不能產生題目)。
6. **M7 維持「Beta、可選」,從主線移出。** 藍圖 8–12 天沒算實機矩陣(內建麥、有線、AirPods、iPad、Mac)與 iOS 音訊路由問題,保守 15–20 天,還要多麥克風權限與隱私政策更新的審核風險。上架後再做,不要擋 1.0 到 M6。
7. **M8 建議縮小:** 只做「依官方考試順序的計時器 + 切換練習項目」,不做樂理問答(B5)、不做配分。**M9** 的記錄卡與每週目標可提前到 1.0 後的第一個小版本(很便宜,`.goal` 樣式現成)。
8. **建議的新順序:**
   - 第 0 週:Q1–Q3 決定、CI 的 `verify` 工作流程、OSMD 鼓組記譜 spike、開始 M1(RSL 或 Trinity 擇一的一級)、寫信給 Trinity / RSL / PAS。
   - 第 1–3 週:M0a + M3/M10(1.0:技巧完整,視奏/聽力處理好 2.1 的問題)送審。
   - 第 3 週起:M1 → M2(檢定要求對照;1.1 版)。
   - 之後:M0b → M4 → M5 → M6(各自一個小版本),M7、M8 視情況。

### E. 建議先做的三件事

1. **把 1.0 的「可送審」缺口一次補掉(M0a + M3):** 修 D2(切背景停止播放)、D1 正確版、D3/D4;**D6 說明卡改中性文字**、**決定 2.1 的處理(隱藏視奏聽力分頁,並同步改 CLAUDE.md、`onboard` 說明文字 `i18n.js` 的 obSub、README、檢定卡三格)**;**D10 關鍵字拿掉商標**;**D9 補關於頁(CC-BY 連結與修改說明、OSMD BSD-3 全文、商標聲明)**;**D8 去掉 Google Fonts**(同時改 `privacy.html`,否則「不收集任何資料」的說法在 App 內有疑義);然後跑 `cap add ios`、`AVAudioSession`、實機測試靜音鍵/來電/AirPods,進 TestFlight。這一步最確定、最能直接降低被退件的風險。
2. **立刻開始 M1,並先回答 Q1–Q3:** 取得一個系統、一級的官方大綱,弄清 Trinity 是否沒有視奏/聽力(R1)。它決定檢定分頁的結構、M2、M5、M6 要不要做、做多大;每多拖一天,後面所有里程碑的估算都是猜的。同時決定出題器的立場(B4)——這是 CLAUDE.md「不自己發明」的直接衝突,要先改規則或放棄隨機出題。
3. **做兩個小而便宜的風險探測:** (a) OSMD 鼓組譜 spike(1–2 天,把官方圖例上的符號全畫一遍,結論決定 M4 工期與是否換 VexFlow);(b) 整組鼓取樣在 iPhone SE 實機的解碼記憶體與載入時間測試(挑 10 個鼓件、每層 3–4 個 round-robin)。順手加上 GitHub Actions 跑 `verify.mjs`(30 分鐘,之後每個 push 都有保護)。這兩個結果會推翻或確認藍圖 M4–M6 的工期,越早知道越好。

### 附:來源
- Capacitor 8 / Xcode 26 / SPM:[Ionic 官方公告](https://ionic.io/blog/announcing-capacitor-8)、[Capawesome 升級指南](https://capawesome.io/docs/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/)、[Ionic 論壇 SPM iOS 14 回報](https://forum.ionicframework.com/t/capapp-spm-package-swift-always-generates-ios-14-instead-of-ios-15-after-capacitor-8-spm-migration/251606)
- RSL Drums 2018 大綱說明(可核對項目名稱):[AMEB 鏡像 PDF](https://rockschool.ameb.edu.au/wp-content/uploads/2019/09/RSL_Drums_Syllabus_Guide_2018_DIGITAL_31May2019-1.pdf);2024 書:[AMEB Drums Debut 2024](https://www.ameb.edu.au/rockschool-drums-debut-2024)
- Trinity Rock & Pop 結構(零售/彙整頁,非官方,僅供方向):[Artium Academy](https://artiumacademy.com/music-theory/music-certifications/trinity/rock-and-pop)、[Boosey Trinity Rock & Pop Drums](https://www.boosey.com/shop/ucat/2063)
