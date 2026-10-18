# DrumDrill 1.0 分階段實作規格(給實作者)

> 這份規格由規劃員撰寫,我沒有改任何檔案。依據:`CLAUDE.md`、`docs/ROADMAP.md`(含 Sonnet 審查意見與 2026-10-18 使用者決定)、`docs/sources/rsl-drums.md`(以下簡稱 **[RSL]**,頁碼都是 2026-06 版 PDF)、`docs/sources/trinity-drums.md`(簡稱 **[TR]**,內含 [RP]/[DK]/[ERR] 代號)、DrumDrill 目前的程式碼,以及 `/home/user/pianodrill`(PianoDrill,只讀)。
> 行號以 DrumDrill HEAD `0c974c9`、PianoDrill HEAD `84067b1` 為準。

---

## 0. 怎麼使用這份規格

- **每個 Stage 單獨交付**:做完 → 跑 `node tools/build/stamp.mjs` → 跑該 Stage 列出的測試(DrumDrill,以及要同步時的 PianoDrill)→ 推到 main(依 CLAUDE.md,不開分支)→ 用中文條列說明改了什麼、為什麼改。
- **兩個 repo 都要改的 Stage**:兩邊在同一輪推上去,commit 訊息互相註明對方的 commit。
- **每個 Stage 做完,線上都要是能用的狀態**:還沒做的級數或題型,只顯示「這一級的練習還在做」。最後的 S16 會用 grep 確認已經沒有這類字串,才能送審。
- **標示文字(固定,中英版面要一樣)**
  - 免責:`practiceOnly` =「僅供練習;實際要求以官方大綱為準」/ "Practice only — the official syllabus is final."(照 PianoDrill 頁尾的寫法)
  - 每個參數旁邊用小字標出處,只有三種:
    1. **官方**:「RSL p.42」「Trinity p.62」
    2. **推估**(大綱沒寫,App 先這樣做):「推估」/ "Assumed"。PianoDrill 已有 `confidenceInferred` 的前例
    3. **練習設定**(App 自訂的容許範圍、預設速度等):「練習設定」/ "Practice setting"
  - 練習回饋**不可以**跟 Pass / Merit / Distinction 放在同一個畫面,也不可以換算成官方分數。

---

## 1. 關鍵設計決定(決定 + 理由)

### 決定 1:Trinity Rock & Pop 下,三個子項目各顯示什麼
- **技巧**:說明卡。
  - 內容:Rock & Pop 沒有獨立的技巧項目;技巧在 Song 3(技巧重點曲)裡評,Technical control 滿分 12(Song 1、2 是 8)[TR §2.3、§2.4;RP p.22–23、35、53]。
  - 另外列出這一級「自選曲參數表」的 Techniques 欄 [RP p.55–59],並註明官方說這只是 general guide。
  - 欄位裡寫得出類別的,給「去練」的類別按鈕,例如:
    - 2 級「含裝飾音 rudiment 的過門」→ Flam、Drag 分類
    - 3 級「Simple rolls」→ 滾奏分類
    - 7 級「筒鼓上更快的雙擊滾奏」→ PAS #6
  - 按鈕上加註「官方只寫類別,沒有指定是哪一個打法」。
  - 技巧分頁的 PAS 40 自由練習照常可以用。
- **視奏**:說明卡 + 練習。
  - 說明:Rock & Pop 沒有視奏項目;最接近的是 Session skills 的 Playback(有譜,可以看也可以不看)[RP p.60]。
  - 練習:「Playback 看譜練習」。App 依 Playback 參數表產生 song chart,先給 30 秒看譜(官方),再跟著拍點打一遍。
  - 速度沒有官方數字 → 使用者自己調,標「練習速度(官方沒寫)」,預設 ♩=80 並標「練習設定」。
- **聽力**:說明卡 + 練習。
  - 練習:「Playback 聽句回打」。App 播一句,留同樣長度的空檔讓使用者打回來;播兩次(第一次練習、第二次評分)[RP p.60]。
  - 官方是整段配伴奏;App 只有鼓取樣,所以只播鼓和拍點,並寫明「官方配伴奏音軌;App 只有拍點」。
  - Improvising 只列規格 [RP p.61、64–65],註明「需要伴奏音軌,App 不提供」。
- **不採用 Trinity Drum Kit & Percussion 系列**:不混用、不當作 Rock & Pop 的要求,1.0 也不放「參考」。
  - 理由 1:考試系統是 Trinity Rock & Pop(CLAUDE.md)。
  - 理由 2:DK 的 rudiments 表、視奏、unpitched aural 屬於另一種考試,放進來會讓使用者以為 R&P 要考。
  - 理由 3:PianoDrill 有相同前例:「Trinity 與 ABRSM 初級的視奏還沒有規則 → 不拿 ABRSM 的規則充數」。
  - 唯一例外是記譜:DK p.107 對 HH 開(o)、閉(+)、腳踩(× 在線下)的寫法,可以當「記譜圖例」的出處之一(見決定 3),並標明出自 DK。

### 決定 2:RSL 技巧練習的譜只在付費檢定書裡
- App 只放三樣東西:組別、名稱(意譯)、速度與頁碼。不畫官方譜。
- 每一項分成三種,寫在 `data/exam-rsl.json` 的 `kind` 欄位:
  1. **`pas`(直接用 PAS 原譜)**:大綱沒指定時值,或指定的時值跟 PAS 表一樣。按「練習」→ 跳到技巧分頁的那個 PAS 打法,速度設成官方 ♩。
  2. **`pattern`(PAS 左右手 + 大綱時值)**:大綱有指定時值,而且跟 PAS 表不同(例如 Debut「Paradiddles,八分音符 ♩=70」,PAS #16 是十六分音符)。App 用 PAS 的左右手、重音、裝飾音,改成大綱的時值,在技巧分頁播。
     - 標「App 依大綱時值排的練習型,不是官方譜」。
     - **不可以**用「把速度減半」代替:例如單擊用 #1(三十二分音符),換算成八分音符 ♩=70 只剩 ♩=17.5,低於 30 的下限。
  3. **`book`(只列名稱)**:ruffs、各種 roll phrase、combined rolls、alternative paradiddle-diddle、hands and feet、Fill、Stylistic Study。
     - 只列名稱 +「譜見官方檢定書」。
     - 有相近的 PAS 打法時給「相關 PAS 打法」按鈕(五擊 #7、七擊 #9、九擊 #10),並註明「樂句本身見檢定書」。
- 「用整組鼓/小鼓和 Tom/重音在 Tom/大鼓跟右手」:App 只在小鼓上練左右手,加註「官方要求用整組鼓,怎麼配置見檢定書」。
- 「隔小節交替」「第一次單擊、反覆雙擊」:每一種時值各給一個按鈕、各自循環;加註「官方是隔小節交替;小節長度、拍號見檢定書」。不自己編小節結構。

### 決定 3:鼓組記譜圖例(drum key)
- **PAS 的 Norman Weinberg《Guide to Standardized Drumset Notation》是合適的依據**(PAS 官方出版,Hal Leonard HL06620063,56 頁,約 9–18 美元)。
  - 但這次查不到公開免費版,本環境也讀不到內容,**現在不能宣稱「照 PAS 指南」**。
  - 建議主持人請使用者買一本,交給審查員逐項核對。
- 在那之前:
  - 圖例資料放在 `data/drumkey.json`,每個鼓件都帶 `src`。
  - **公開官方資料能確認的只有三項**:
    1. HH 開 = o、閉 = +、腳踩 HH = × 符頭 [DK p.107](官方只畫 × 符頭與向下的符桿,圖上沒有譜線;「線下」與 D4 是常見寫法,待 PAS 指南核對)
    2. Ride bell = 菱形符頭,寫在最上面那條線 [TR §5,ERR「Sweet Emotion」]
    3. RSL 初中級視奏只用小鼓 [RSL p.31–43] → 單線譜就夠,現有引擎可以用
  - 其他鼓件的位置 `src:"pending-pas-weinberg"`,畫面顯示「App 採用的常見寫法(待依 PAS 指南核對)」。
  - **每一份鼓組譜旁邊一定要有圖例**,使用者不會誤以為那是考試機構的圖例。
- 建議的位置(業界常見寫法,待核對):

  | 鼓件 | 位置 | 符頭 |
  |---|---|---|
  | 大鼓 BD | F4(第一間) | 一般 |
  | 落地鼓 FT | A4 | 一般 |
  | 小鼓 SD | C5 | 一般 |
  | 中鼓 MT | D5 | 一般 |
  | 高鼓 HT | E5 | 一般 |
  | 腳踩 HH | D4 | ×(線下) |
  | HH(手打) | G5 | × |
  | Ride | F5 | × |
  | Crash | A5 | ×(加線) |
  | Ride bell | F5 | 菱形 |
  | Cross stick | C5 | 圈 × |

### 決定 4:出題參數白名單
- 白名單逐項帶頁碼,放在 `data/exam-*.json`。
- 白名單以外一律不放。
- 只有「把官方列出的時值組合成一拍」這種組合規則,屬於 App 的出題設計(使用者決定 3 已經允許),這部分寫在出題器的節奏格(cell)表裡,並標「練習設定」。

### 決定 5:RSL 6–8 級 Quick Study Piece
- 不提供練習。
- 理由:QSP 要伴奏音軌和 lead sheet,拍號、時值、速度也都查不到 [RSL §4.3]。
- 視奏分頁在 RSL 6–8 級:列 QSP 規格(12 小節、3 分鐘研讀、播兩次、風格跟 Stylistic Study 選的一樣),再給「用 5 級整組鼓視奏參數練讀譜」的按鈕(加註「5 級參數」)。
- 1–5 級的 Improvisation & Interpretation 也只列規格(需要伴奏)。

### 決定 6:RSL 聽力
- **Fill Playback & Recognition 全級都做**:1 小節、小鼓、♩=70、聽兩次、每次前面 1 小節預備拍、作答時配拍點、2 或 3 個譜面選項 [RSL §5]。
- **Groove Recall 做「回打」部分**:2 小節、各級的鼓件、速度在官方範圍內隨機。
  - 4–8 級的「說出風格」不出:風格清單查不到。
  - 畫面註明「風格選項大綱沒寫,App 不出這一題」。
- 「two bar groove that is repeated」意思不清楚 [RSL §5.2]。App 播放時兩小節播兩遍,標「推估」。

### 決定 7:觸控鼓墊與麥克風
- **觸控鼓墊放進 1.0**。
  - 評分直接用 PianoDrill `js/sight/scoring.js` 的 `scoreRhythm`:先估計固定延遲、扣掉,再評;容許範圍隨速度調整。
  - 因為延遲會自動扣掉,**1.0 不做延遲校正流程**。結果顯示「整體慢約 X 毫秒(已先扣掉)」,跟 PianoDrill 一樣。
- **麥克風放進 1.0,但是是「選用」**:照 PianoDrill 視奏的做法(`mic.js` 錄完一段,在裝置上離線找起音,只評時間)。
  - 排在 S15,必要時可以整段拿掉,不影響其他 Stage。
  - 不做原藍圖 M7 的即時 AudioWorklet 與分裝置校正。

### 決定 8:模擬考、練習紀錄
- 兩個都放進 1.0,形式照 PianoDrill:
  - **練習紀錄**:每個模組各自存、各自一張紀錄卡(三格數字 + 最近 7 天)。**不另外做** `drumdrill.log.v1` 共用 log(推翻原藍圖 M0 第 3 點)。理由是避免跟 PianoDrill 兩套做法。
  - **模擬考**:各模組的檢定頁各有一個「模擬考」按鈕(PianoDrill 的 `t-mockBtn`、`e-mockBtn`),不做跨模組的整場模擬考。
  - **樂理問答(GMQ)**:不出題,只列範圍。原因見審查意見 B5。

### 決定 9:檢定的配分、等第放在哪裡
- 照 PianoDrill:放在各模組檢定頁的「考試摘要」(`t-examSummary`、`s-examSummary`、`e-examSummary`)。
- 外框不新增整場概要卡(不然要同步改 PianoDrill,範圍會擴大)。
- 整場的總分門檻,以及「本 App 不提供的項目」(演奏曲、GMQ 範圍),放在技巧的考試摘要底下。

### 決定 10:審查員指出的 M0 修正
- **D1 正確修法**:`scheduled` 改成 `Set`;每個節點 `onended` 時自己移除。刪掉 `pruneScheduled`;PianoDrill `js/sight/playback.js:160` 與 `js/ear/app.js:482` 有呼叫它,要同步改。
- **D2**:切到背景或 `pagehide` 時,目前模組 `leave()` + `audio.stopAll()`;回到前景再 `enter()`。iOS 的 AudioContext 變成 `interrupted` 或 `suspended` 時,也走同一條路。
  - `leave()` 只停播放與計時,**不清題目**;`enter()` 有題目就不重新出題。
- **D3**:`gradeLabel` 只留外框一份,經由 `ctx.gradeLabel(g, sys)` 傳給模組。
- **D4**:按熟練標記不算一次練習。
- **D6**:視奏、聽力的說明卡改成中性文字。
- **D10**:App Store 關鍵字拿掉 Trinity / RSL / Rockschool。
- **D12**:`relang()` 只重寫文字,不停止播放。
- **D13**:技巧的 `examStatus()` 先回傳「已會 n/40」,S3 之後改成本級的進度。
- **SW 預快取**:`stamp.mjs` 把完整的 `?v=` 檔案清單寫進 `sw.js`;快取名稱帶上清單的雜湊。
- **共用元件的 id 前綴**:共用函式一律接收模組自己的 `$`(`id => getElementById(prefix + id)`),不在 shared 裡寫死 `t-`。
  - 共用的 CSS 用 class,或在 `drum.css` 補 `#s-…`、`#e-…` 的規則;`app.css` 不動。

### 決定 11:取樣與記憶體
- **鼓件只用 12 個**:kick、snare、xstick、hhClosed、hhOpen、hhPedal、ride、rideBell、crashL、tom1(HT)、tom3(MT)、tom5(FT)。
- **round-robin 上限**:
  - iPhone 與小記憶體裝置:鼓皮每層 3 個、鈸類每層 2 個 → 立體聲解碼實測約 **83×10⁶ 位元組**(照 manifest 的 frames 算)。
  - 其他裝置:鼓皮 6 個、鈸 4 個 → 約 150 MB。
  - 技巧模組的小鼓維持現狀。
- **離開視奏/聽力 60 秒後釋放**整組鼓,小鼓與拍點保留。
- **Choke**:
  - Naked Drums 原廠 SFZ(kinwie 版)這次查不到,不知道有沒有 `off_by`。
  - ScrollScore(raw.githubusercontent.com/stevenmusic/ScrollScore/main/index.html,約 9070–9200 行)的鼓引擎已經實作:
    - `chokeOpenHat`:閉合或踩 HH 會截斷還在響的開放 HH
    - `DRUM_POLY`:註解說「照原廠 sfz 的 note_polyphony 與 off_time」
    - `DRUM_VOICES`:各鼓件音量依 LUFS 校正
    - 鼓皮力度交叉淡化 `DRUM_XFADE`
  - CLAUDE.md 規定「照 ScrollScore 的鼓引擎」,所以**照抄這幾段**,出處寫到 ScrollScore 的函式名稱;原廠 SFZ 的 `off_by` 列為待核對。
  - 同時拿掉固定 2.5 秒截斷(`audio.js:301`):鈸照錄音自然響完,由 `DRUM_POLY` 收掉最舊的那一下。

### 決定 12:兩個 App 同步
- 完整說明見 §3。
- 原則:能共用的檔案,兩邊內容一模一樣,或只有標了記號的區段不同;用 `tools/test/sync.mjs` 檢查。
- DrumDrill 新做的視奏、聽力,ID、卡片結構、流程照 PianoDrill;能照抄的檔案直接照抄。

---

## 2. 全域約定

### localStorage
| 鍵 | 內容 |
|---|---|
| `drumdrill.v1`(外框) | 原有欄位,加 `mic: false` |
| `drumdrill.tech.v1` | 原有 |
| `drumdrill.sight.v1`(新) | `{ pick:{system,grade}, metroPractice:true, clickPerform:true, bpmOverride:null, history:[...fingerprint], stats:{"rsl-3":{n,hits,total}}, log:{} }` |
| `drumdrill.ear.v1`(新) | `{ pick:{system,grade}, autoNext:false, stats:{"rsl-3-fill":{n,ok}}, log:{}, goal:20 }` |

`log` 的格式跟技巧一樣:`{ "YYYY-MM-DD": { n, sec } }`,保留 400 天。

### id 前綴
- 技巧 `t-`、視奏 `s-`、聽力 `e-`。
- 卡片 id **照 PianoDrill 的命名**,讓 `css/app.css` 裡 PianoDrill 留下的 `#s-setup`、`#e-quizCard`、`#t-mockBtn` 等樣式自然套用(審查員要檢查有沒有套錯)。

### i18n
- 新增 `js/sight/strings.js`(前綴 `sight.`)與 `js/ear/strings.js`(前綴 `ear.`)。
- 外框新增 `practiceOnly`、`srcAssumed`、`srcPractice`。

### 資料檔
- 放在 `data/` 第一層(`stamp.mjs` 只讀第一層):`exam-rsl.json`、`exam-trinity.json`、`drumkey.json`。
- 用 `js/shared/examdata.js` 讀取,網址帶 `pdVersions` 的 `?v=`。

### 時值代號(資料與出題器共用)
- 一般:`1`、`2`、`2.`、`4`、`4.`、`8`、`8.`、`16`、`16.`、`32`
- 連音:`8t3`、`4t3`、`16t3`、`16t5`、`16t6`、`16t7`、`32t9`、`32t10`
- 二連音:`dup`
- 休止符一律加前綴 `r`,例如 `r4`、`r8`、`r4.`。

### 不准
- 不改 `css/app.css`(兩個 repo 共用的除外,見 §3)。
- 不加 build step。
- 不用合成鼓聲。
- 資料檔不貼大綱原文句子。

---

## 3. 兩個 App 同步(PianoDrill ↔ DrumDrill)

### 3.1 共用的檔案與行為

| 項目 | DrumDrill | PianoDrill | 同步方式 |
|---|---|---|---|
| 設計代幣與共用元件 | `css/app.css` | `css/app.css` | **完全相同**。現在只差 DrumDrill 最後 2 行(280 寬對話框標題),S0 把這 2 行也加到 PianoDrill。App 專屬樣式放 `drum.css`;PianoDrill 若要專屬樣式,另開 `piano.css` |
| 雙語機制 | `js/shared/i18n.js` | `js/shared/i18n.js` | 標記區段以外相同:`// @app-begin … // @app-end` 包住 `LANG_KEY`、`OLD_KEYS`、`STR` |
| 母帶鏈路、限幅器、拍點、快取、解鎖 | `js/shared/audio.js` | `js/shared/audio.js` | 共用段落相同;樂器專屬(鼓組 / Salamander)包在 `@app` 區段 |
| 外框 | `js/main.js` | `js/main.js` | 標記區段以外相同:`KEY`、`SYSTEMS`、`SUBS`、`examParts` 的標籤、`ob` 預設值、舊工具搬遷放在 `@app` 區段。`view-sight`、子項目 aria-label 的寫法兩邊統一(DrumDrill 採用 PianoDrill 的) |
| Service Worker | `sw.js` | `sw.js` | 標記區段以外相同(快取名稱、預快取清單由 `stamp.mjs` 寫入) |
| 版本指紋 | `tools/build/stamp.mjs` | 同 | **完全相同**(現在已經相同),S0 一起加入 sw.js 預快取 |
| 測試共用件 | `tools/test/harness.mjs` | 同 | **完全相同**(現在已經相同) |
| 版面測試 | `layout.mjs`、`bilingual.mjs`、`human.mjs`、`clip.mjs` | 同 | 檢查函式(audit、snap、compare、各項檢查)相同,畫面狀態腳本放在 `@app` 區段。**DrumDrill 目前沒有 `clip.mjs`**,S0 照抄 |
| 頁尾、授權、隱私 | `i18n.js` footer、`licenses.html`、`privacy.html` | 同 | 版型與段落順序相同,內容依樂器不同;CC BY 的寫法(作者、授權名稱 + 連結、修改說明)一致 |
| 視奏的讀譜舞台 | `js/sight/stage.js` | `js/sight/stage.js` | **完全相同**,S8 照抄 |
| 隨機種子、題目指紋 | `js/sight/random.js`、`fingerprint.js` | `js/sight/generator/random.js`、`fingerprint.js` | random **完全相同**;fingerprint 介面相同,題目格式不同的部分放在 `@app` 區段 |
| 拍號換算 | `js/sight/meter.js` | `js/sight/generator/meter.js` | **完全相同** |
| 節奏評分 | `js/shared/onsets.js`(新) | `js/shared/onsets.js`(新);`js/sight/scoring.js` 改成從它重新匯出 | **完全相同**:`detectOnsets`、`scoreRhythm` 從 PianoDrill `scoring.js` 搬出來 |
| 麥克風收音 | `js/shared/mic.js` | `js/sight/mic.js` → 搬到 `js/shared/mic.js` | **完全相同**(S15) |
| 上架文件 | `docs/IOS.md`(新)、`docs/APPSTORE.md` | 同 | `IOS.md` 兩邊相同(Capacitor 8 的共同步驟);`APPSTORE.md` 格式相同 |

### 3.2 同步檢查工具(S0 新增,兩個 repo 放同一份)
- `tools/test/sync.json`:列出 `[路徑A, 路徑B, 模式]`。模式有兩種:
  - `same`:逐位元組相同
  - `markers`:去掉 `@app-begin…@app-end` 區段後相同
- `tools/test/sync.mjs`:
  - 用環境變數 `PIANODRILL=/home/user/pianodrill`(在 PianoDrill 裡是 `DRUMDRILL=…`)找另一個 repo。
  - 找不到另一個 repo 時印出「略過」並結束碼 0,讓單一 repo 的 CI 也能跑。
  - 不一致時列出檔案與第一個不同的行。
- `verify.mjs` 最後呼叫 `sync.mjs`。

### 3.3 DrumDrill 要補齊的版面規則(PianoDrill CLAUDE.md 有、DrumDrill 沒有)
1. **每種裝置都要飽滿**:
   - `.mod-side`(設定、紀錄、清單)與 `.mod-main`(題目、譜面/作答、速度、正確率)。
   - 寬度 ≥1100 時兩欄、內容最寬 1480;較窄時一欄,照 CSS `order` 排,設定卡收成一行。
   - 第一個畫面題目卡要在上半部。CSS 已共用;DrumDrill 要補 `#s-…`、`#e-…` 的 `order` 規則,並寫進 CLAUDE.md。
2. **手機橫式**(landscape 且高度 ≤500):
   - 分頁列改成左邊的直欄;頂欄一行(藏副標與考試標籤)。
   - 檢定設定與檢定說明左右並排;題目卡的標題、標籤、▶ 擠成一行。
   - **技巧樂譜依「樂譜框到畫面底」放大**(PianoDrill `js/tech/app.js:455-510` 的 `fitLandZoom`、`land-play`):DrumDrill 完全沒有,S1 補上。
3. **分頁列一律滿版**。
4. **三個模組排版一致**:頂欄 → 子項目 → 設定卡 → 題目卡(大標題 + 右邊圓形 ▶、標籤列、左下次要動作、右下主要動作)→ 內容卡 → 練習紀錄(三格 + 7 天);題目大標題三個模組一樣大。
5. **視奏譜面要像印出來的考卷**:每行目標 4 小節,能整除優先;最小縮放 0.55(每行 2 小節時 0.45);同形狀的題目沿用同一個大小(PianoDrill `fitScore`)。DrumDrill 視奏照做(技巧仍是單行捲動)。
6. **子項目**:
   - PianoDrill 視奏的子項目是級數。DrumDrill 也是級數 0–8:第一格 RSL 顯示「D」、Trinity 顯示「I」,`aria-label` 寫完整級名。
   - 聽力的子項目是題型:「過門 Fill / 律動 Groove / 回打 Playback」,照 PianoDrill 聽音的「單音/音程/和弦」位置。
7. **測試**:補 `clip.mjs`;新增 `notation.mjs`(40 個打法 + 鼓組譜實際用 OSMD 畫出來檢查),對應 PianoDrill 的 `notation.mjs`。

---

## 4. 各 Stage 規格

### S0 清債、上線安全與同步骨架(兩個 repo)

**1. 目標與範圍**
- 做:D1、D2、D3、D4、D5(改名)、D6、D10、D12、D13、SW 預快取、`sync.mjs`、`clip.mjs`、測試套件改名;兩個 repo 的共用檔案對齊成 §3 的狀態。
- 不做:抽出共用元件(S1)、換字型(等主持人決定)、刪 `app.css` 舊規則。

**2. 檔案與內容**
- `js/shared/audio.js`(兩邊)
  - `let scheduled = new Set()`;`playDrum`、`playClick`(PianoDrill 還有 `playNote` 等)建立的 source 都加 `src.onended = () => scheduled.delete(src)`。
  - `stopAll()`:全部 `stop` 後 `clear()`。
  - `cancelFrom(t)`:對 `_at >= t` 的節點 `stop()` 並刪除。
  - 刪掉 `pruneScheduled`(PianoDrill 的 `sight/playback.js:160`、`ear/app.js:482` 一起刪)。
  - `scheduledCount()` 回傳 `scheduled.size`。
  - 新增 `export function onInterrupt(fn)`:AudioContext 的 `statechange` 進入 `interrupted` 或 `suspended`,而且頁面是可見的時候呼叫。
  - 共用段落外加 `@app-begin/@app-end`。
- `js/main.js`(兩邊)
  - `visibilitychange`:hidden → `MODS[curMod].leave(); audio.stopAll();`;visible → `MODS[curMod].enter(curTab)`。`pagehide` 同 hidden。
  - `audio.onInterrupt` 也走 `leave()` + `enter()`。
  - `ctx` 加上 `gradeLabel`、`showView(view, sub)`。
  - 模組不能 import `main.js`。
  - App 專屬段落加 `@app` 記號;DrumDrill 補上 `view-sight` 的 body class 與視奏子項目的 aria-label(照 PianoDrill)。
- `js/tech/app.js`
  - D3:`renderExam` 改用 `ctx.gradeLabel`。
  - D4:熟練標記不呼叫 `logPractice`。
  - 手動停止時把已播放的秒數加進 `sec`(次數不加)。
  - D12:`relang()` 不呼叫 `switchTab`,改成 `relabel()`:重畫選擇器、標題、標籤、速度單位、紀錄卡;在檢定頁時重畫 `renderExam`。
  - D13:`examStatus()` 回傳 `tr(\`已會 ${n}/40\`, \`${n}/40 known\`)`。
- `js/tech/strings.js`:D5,`bestLabel` 改成「示範最快」/ "Demo best"。
- `js/sight/app.js`、`js/ear/app.js`:D6,改成「題目正在照官方大綱整理。」/ "Questions are being built from the official syllabus."
- `sw.js`(兩邊)
  - install 時 `addAll(PRECACHE)`。
  - `PRECACHE` 與 `CACHE` 名稱在 `/*@precache-begin*/…/*@precache-end*/` 之間,由 `stamp.mjs` 寫入:`./`、manifest、圖示、`css/*.css?v=`、vendor、`js/**/*.js?v=`、`data/*.json?v=`。
  - 快取名稱 = `drumdrill-app-` + 清單雜湊的前 8 碼。
- `tools/build/stamp.mjs`(兩邊相同):加上寫入 sw.js 的邏輯;`--check` 也檢查 sw.js。
- `css/app.css`(PianoDrill):補 DrumDrill 最後 2 行。
- `tools/test/sync.json`、`sync.mjs`(兩邊);DrumDrill `verify.mjs` 呼叫 sync。
- `tools/test/clip.mjs`(DrumDrill,照抄 PianoDrill;畫面狀態放 `@app` 區段)。
- `tools/test/package.json`:名稱改成 `drumdrill-test`(PianoDrill 也檢查自己的名稱)。
- `tools/test/layout.mjs:85` 的註解改掉(橫放播放模式等 S1 做了再寫回)。
- `docs/APPSTORE.md`:關鍵字改成「爵士鼓,打鼓,鼓譜,基本打法,rudiments,paradiddle,flam,滾奏,節拍器,檢定,考級,drum exam」。描述保留說明用途的寫法,加上「與其無關」。
- `.github/workflows/verify.yml`(DrumDrill;PianoDrill 若沒有也加):push 時跑 `node tools/test/verify.mjs`。

**3. 資料來源**:審查意見 A2、A1、B8;ScrollScore 不需要。

**4. 驗收與測試**
- 新增 `tools/test/playback.mjs`(Playwright):
  1. 技巧 #20 Flam,♩=240,循環 20 輪 → 每輪自然結束後 `scheduledCount() ≤ 一輪的節點數 + 拍點數`。
  2. 播放中按停止 → 300 ms 後 `scheduledCount()===0`,而且 `__tech.state.play===false`。
  3. 送出 hidden 的 `visibilitychange`(用 `Object.defineProperty(document,'visibilityState',…)`)→ 播放停止;回到 visible 不會自動播放。
- `human.mjs`(兩邊):加「切到背景」動作;檢查「不在畫面上的模組沒有在播放」。
- DrumDrill:`verify`、`layout`、`bilingual`、`human 150 3`、`clip`、`playback`。
- **PianoDrill 要跑**:`verify`、`ear-verify`、`node --test test/sight/*.test.js`、`layout`、`bilingual`、`human 150 3`、`clip`、`notation`、`node tools/sight/smoke.js`、`node tools/sight/mic-check.js`。
- 驗收:截圖跟改之前一樣;`sync.mjs` 全部一致;中英版面一致。

**5. 審查員要特別檢查**
- `onended` 在「已排程、還沒開始就被 `stop()`」的節點上也會觸發,不會留下殘留。
- 改用 Set 後,PianoDrill 的視奏、聽音播放沒有退步(連點播放不會變兩份)。
- `relang` 不停止播放,但標題和選擇器的文字都有換成新語言。
- `@app` 區段劃得夠小(共用部分盡量多)。
- sw.js 預快取清單沒有漏掉 `data/*.json`;`--check` 會擋住過期的清單。

**預估**:DrumDrill 約 450 行、PianoDrill 約 250 行。

---

### S1 技巧模組抽出共用元件 + 手機橫式補齊(DrumDrill)

**1. 目標與範圍**
- 把譜面與播放軸、速度介面抽成共用元件,技巧模組改用它們。
- 補上手機橫式的 `fitLandZoom` 與 `land-play`。
- 不做:新功能、共用 log(決定 8)。

**2. 檔案與內容**
- `js/shared/score.js`
  - `createScore({ $, zoom:()=>number, afterRender(svg), onPending })`,回傳 `{ load(xml), render(), fitWidth(), measure(lenBeats), xAtBeat(b), movePlayline(beat, follow), placeExtent(), onResize(), refit(), home(), clear(), landZoom, get osmd, get noteXs, get pending }`(看不看得到由 `opts.isActive()` 決定,沒有 `setActive`;完整說明在 `score.js` 檔頭)。
  - 需要的元素:`$("stage")`、`$("scroll")`、`$("osmd")`、`$("playline")`、`$("paperMsg")`。
  - 搬自 `tech/app.js:118-307`;`drawSticking` 留在技巧模組,當作 `afterRender` 傳入。
- `js/shared/tempo.js`
  - `createTempo({ $, min:30, max:240, get, set })`。
  - 綁定 `bpmDown`、`bpmUp`(按住連續加減)、`bpmRange`(拖拉)、`bpmVal`、`bpmUnit`、`beats`;提供 `showBeat(beat, countIn)`、`setBeats(n)`。
  - 搬自 `tech/app.js:309-349`、`491-495`。
- `js/shared/landscape.js`:`isPhoneLand()`、`fitLandZoom(score, opts)`,照 PianoDrill `js/tech/app.js:455-510` 改寫成共用版;播放時在 body 加 `land-play`。
- `css/drum.css`:把 `#t-playline`、`#t-scroll`、`#t-osmd` 的規則複製給 `#s-…`、`#e-…`;補 `#s-…`、`#e-…` 的 `order`。

**3. 資料來源**:PianoDrill CLAUDE.md「手機橫式」、PianoDrill `tech/app.js`。

**4. 驗收與測試**
- 新增 `tools/test/shots.mjs`:用 `--save`、`--compare`,在 19 種尺寸下拍技巧四類 + 打法 40×8 + 檢定頁,前後逐像素比對。不一致時兩張都存下來。
- 手機橫式的畫面允許改變(新功能),其他都要一樣。
- `layout`(加「手機橫式技巧播放中」狀態)、`bilingual`、`human 150 3`、`clip`、`playback`。

**5. 審查員要特別檢查**
- shared 裡沒有寫死 `t-`。
- 看不到時延後重畫(`pendingRender`)的行為還在。
- 播放軸在 25% 跟著捲動的行為不變。
- 橫式放大跟 PianoDrill 的效果一致。

**同步**:不改 PianoDrill。API 照 PianoDrill 技巧模組的行為設計,以後 PianoDrill 可以改用。

**預估**:約 900 行(搬移為主)。

---

### S2 考試資料檔與驗證(DrumDrill)

**1. 目標與範圍**
- 把兩份 sources 的官方事實整理成機器讀得懂的資料,加上載入器和 verify 檢查。
- 不做:任何介面。

**2. 檔案與內容**
- **`data/exam-rsl.json`**
  - `doc`:`{ title:"Rockschool Drums Syllabus Specification 2018 (rev. 2026-06-02)", url, checked:"2026-10-18", notes:"docs/sources/rsl-drums.md" }`
  - `gradeNames`
  - `marks`:各項配分與等第,出自 [RSL §2.3,p.16–17]。Grade Exam 的 Merit 是 74%。
  - `minutes`:[RSL §2.2,p.15]
  - `other`:演奏曲 3 首、最長時間 [p.30…67]、GMQ 範圍 [§6]
  - `tech[g]`:`{ src:{p}, rule:[中,英], groups:[{ id:"A", name:[..], bpm:70|null, bpmSrc:"backing"|null, items:[ … ] }] }`
    - item 有三種:`{kind:"pas", no:16}`、`{kind:"pattern", pas:1, value:"8", sticking:"single"|"double"}`、`{kind:"book", label:[..], related:[7]}`
    - 每個 item 可以加 `note:[..]`(例如「官方用整組鼓」)、`assumed:true`
  - `sight[g]`:`{ type:"snare"|"kit"|"qsp", bars, time:{v:"4/4", assumed:bool}, values:[...], rests:[...], pieces:[...], bpm:[lo,hi], prepSec:90, metroOption:true, develop:{bars:2, pos:{v:"end", assumed:true}}, src:{p} }`。QSP 只有規格欄位。
  - `improv[g]`:只有規格
  - `ear[g]`:`{ fill:{bars:1, pieces:["snare"], bpm:70, values, rests, options:2|3, plays:2, countInBars:1}, groove:{bars:2, pieces, bpm:[lo,hi], repeat:{v:2, assumed:true}, styleOptions:null}, src:{p} }`
  - `gmq[g]`:範圍
- **RSL 技巧對照表**(照 [RSL §3.2、§3.4] 填):

  | 級 | 組 | 對照方式 |
  |---|---|---|
  | Debut | A | pattern(#1 左右手, 8) |
  | Debut | B | pattern(雙擊 RRLL, 8) |
  | Debut | C | pattern(#16, 8) |
  | Debut | D | book |
  | 1 | A | pattern(#1, 8)、pattern(雙擊, 8);加註隔小節交替 |
  | 1 | B | 同 A,時值 16 |
  | 1 | C | pas #16 |
  | 1 | D | book |
  | 2 | A | 四個 pattern(單擊/雙擊 × 8/16) |
  | 2 | B | pas #16;加註整組鼓 |
  | 2 | C | pas #20 |
  | 2 | D | pattern(#1, 8t3) |
  | 2 | E | book |
  | 3 | A | pattern 8 / 8t3 / 16 |
  | 3 | B | 雙擊 8 / 16;加註小鼓與 Tom |
  | 3 | C | pas #16 |
  | 3 | D | pas #20、#31 |
  | 3 | E | pattern(#1, 8t3);加註重音位置見書 |
  | 3 | F | book ♩80 |
  | 4 | A | 單擊 8/8t3/16 + 雙擊 8/8t3/16 |
  | 4 | B | pas #16、#18 |
  | 4 | C | pattern(#22, 4),`assumed`(「四分音符」是否也適用 flam tap 不明);ruffs = book |
  | 4 | D | book(hands and feet) |
  | 4 | E | book ♩80 |
  | 5 | A | 同 4 級 A,♩80 |
  | 5 | B | pas #16、#18;加註大鼓跟右手 |
  | 5 | C | pas #21、#32 |
  | 5 | D | book,related #7,♩75 |
  | 5 | E | book ♩90 |
  | 5 | F | book ♩90(以 PDF 為準,見 [RSL §9-1]) |
  | 6 | A | 單擊、雙擊 × 8t3/16/16t6 |
  | 6 | B | pas #24;pattern(#19, 16t6) |
  | 6 | C | pas #38 |
  | 6 | D | book,related #7、#10 |
  | 6 | E | book(Stylistic) |
  | 7 | A | 單擊 4/8/8t3/16/16t5/16t6/16t7/32,♩65 |
  | 7 | B | pas #24;pattern(#19, 16t6) |
  | 7 | C | pas #27 |
  | 7 | D | pas #38、#39 |
  | 7 | E | book,related #9、#10,♩85 |
  | 7 | F | book |
  | 8 | A | 單擊,7 級 A 的時值再加 32t9、32t10,♩65 |
  | 8 | B | pattern(#19, 16t6);alternative paradiddle-diddle = book |
  | 8 | C | pas #28、#27 |
  | 8 | D | pas #40 |
  | 8 | E | book,related #9;combined rolls = book |
  | 8 | F | book |

- **`data/exam-trinity.json`**
  - `doc`([RP] Online edition April 2026)
  - `marks`:現場與數位兩種 [TR §2.1、§2.2、§2.4]
  - `minutes` [RP p.48]
  - `sessionBands` [RP p.23]
  - `playback`:`{ flow:{studySec:30, countIn:true, plays:2, backing:true}, grades:{ "0":{ total:[8,8], phrase:[2,2], time:["4/4","2/4"], values:["2","4","8"], rests:["r2","r4"], dyn:[], pieces:["SD","BD","HT","LT","CR"], voices:1 }, … } }`
    - 表上斜線的格子不填,由程式累積。
    - 各級的特殊事項寫進 `extra` 代號:`ties`、`footHH`、`offbeatBD`、`hhOpenClose`、`rimclick`、`flam`、`drag`、`ruff`、`roll`、`ghost`、`meterChange`。
    - 每級帶 `src:{p:"62–63"}`。
  - `improvising`:規格 [RP p.64–65]
  - `ownChoice[g].techniques` [RP p.55–59]
  - `digitalNote`:數位考試沒有 Session skills [RP p.28、31–32]
- **`data/drumkey.json`**:`{ pieces:{ snare:{step:"C",oct:5,head:"normal",src:"pending-pas-weinberg"}, hhFoot:{step:"D",oct:4,head:"x",src:"trinity-dk-p107"}, rideBell:{step:"F",oct:5,head:"diamond",src:"trinity-errata"}, hhOpen:{…,mark:"o",src:"trinity-dk-p107"}, … } }`
- **`js/shared/examdata.js`**:`loadExam(system)` → Promise(快取);`playbackFor(grade)` 回傳累積後的參數(純函式,Node 可以跑);`techItems(g)`。
- **`tools/test/checks/examdata.mjs`**(`verify.mjs` 呼叫)
  - 每個有數值的節點都有 `src.p`。
  - `grade` 是 0–8,9 級都在。
  - 每個 `pas` 都對得到 `RUDIMENTS`。
  - 中英都有;按鈕或標籤用的英文 ≤ 22 字元。
  - `bpm` 介於 30–240。
  - 時值代號在允許清單裡。
  - Trinity 累積後各級的 `time` 不會變少。
  - 配分加總是 100。
  - 等第門檻遞增。

**3. 資料來源**:[RSL §2–§6、§9],[TR §2、§3、§4.1、§5]。查不到的欄位一律 `null` 或 `assumed:true`,不能填數字。

**4. 驗收與測試**:`verify` 全過;`stamp` 有更新 `pdVersions` 和 sw.js 清單。

**5. 審查員要特別檢查**
- 拿 sources 表格逐格對照 JSON(特別是 5 級 Fill ♩=90、6 級 Samba、Merit 74/75)。
- 沒有貼原文長句。
- `assumed` 有標到該標的地方。

**預估**:約 1200 行(JSON 占八成)。

---

### S3 檢定頁:技巧要求清單、一鍵練習、考試摘要(DrumDrill)

**1. 目標與範圍**
- 技巧的檢定頁照 PianoDrill `t-paneExam` 的結構:考試摘要 + 組別清單 + 抽題 + 下一項。
- `kind:"pas"` 一鍵跳到技巧分頁。
- 視奏、聽力的檢定頁先只放「考試摘要」與規格卡(練習在 S8 以後)。
- 不做:pattern 播放(S4)、模擬考(S14)。

**2. 檔案與內容**
- `index.html`:`#t-examCard` 換成 `#t-paneExam`,裡面有 `#t-examSummary`、`#t-listCard`(`#t-qGroups`、`#t-progressBar`)、`#t-drawBtn`、`#t-nextBtn`。id 跟 PianoDrill 一樣。
- `js/tech/app.js` 的 `renderExam()`
  - **RSL**:每組一列(`.qrow`):組別字母、名稱、♩、`p.xx`,加上「已會」狀態。
    - pas → 「練習」:`ctx.showView("tech", 類別)` + `setRudiment(no)` + `setTarget({…})`。
    - book → 「譜見官方檢定書」+ related 按鈕。
  - **Trinity**:決定 1 的說明 + 自選曲 Techniques + 類別按鈕。
- 技巧的「目標」橫幅 `#t-target`:例如「RSL 3 級 D 組 · ♩=75 · p.42 ×」。
  - 目標速度只設定 `bpm`,**不寫入** `S.bpm`。
  - 按 × 離開目標模式。
- `examStatus()`:RSL 是「已會 n/m」(本級連到 PAS 的編號);Trinity 是「在 Song 3 評」/ "Assessed in Song 3"。
- 考試摘要的內容(各模組自己畫):
  - 技巧:這一項的配分、等第,整場的總門檻、考試時間、本 App 不提供的項目。
  - 視奏、聽力:各自的配分。
  - 最後一行固定是 `practiceOnly`。
- 視奏、聽力的檢定頁:規格卡(RSL 視奏、I&I、QSP;Trinity 說明)。

**3. 資料來源**:S2 的 JSON。

**4. 驗收與測試**
- `layout`、`bilingual`、`clip` 加狀態:RSL 0/3/8、Trinity 0/4/8 × 技巧/視奏/聽力。
- `human` 加「從清單點練習」:檢查跳過去的打法編號與 `bpm` 等於 JSON。
- 第一個畫面:題目卡規則對清單頁不適用,但清單頁不能被摘要卡擠到第二個畫面以下;摘要卡在手機上收合。

**5. 審查員要特別檢查**
- 每一列都看得到頁碼。
- 摘要沒有把練習回饋跟等第放在一起。
- 280 寬時清單的英文不會截字。

**預估**:約 1000 行。

---

### S4 RSL 技巧的「依大綱時值」練習型(DrumDrill)

**1. 目標與範圍**
- 支援 `kind:"pattern"`。
- 記譜擴充:連音 5、7、9、10,八分三連音,`normal-type` 修正。
- 不做:整組鼓配置。

**2. 檔案與內容**
- `js/tech/rudiments.js`
  - 新增 `pattern({pas, sticking, value, lead})` → groups。
    - 用 `strokes()` 取主擊的左右手、重音和 Flam/Drag 標記(雙擊取 #6 的 RRLL)。
    - 每一下換成 `value` 的時值,依「每拍幾個音」分組加連桿。
    - 一輪的長度 = 「左右手序列長度」與「每拍音數」的最小公倍數,要是整數拍。
    - 不支援滾奏斜線和多次反彈,會丟出錯誤。
  - `parseToken` 支援 `tN`(N = 3/5/6/7/9/10)。
- `js/tech/notation.js`:連音的 `<normal-notes>` 照 3:2、5:4、6:4、7:4、9:8、10:8;`normal-type` 依時值決定(八分三連音是 eighth,不是寫死的 16th —— 這是現有的錯)。
- `js/tech/app.js`:目標模式下 `groups = pattern(...)`;題目標籤加上「App 依大綱時值排的練習型」。

**3. 資料來源**:[RSL §3.2];PAS 左右手照 `rudiments.js`。

**4. 驗收與測試**
- `checks/pattern.mjs`:每個 RSL pattern 項目一輪是整數拍;左右手序列 = PAS 序列重複;MusicXML 時值加總正確;連音數字標記數量正確。
- `notation-preview.html?pattern=rsl-7-A` 讓人眼對照。
- `layout`(7、8 級 A 組 32t10 最長)、`bilingual`、`human`。

**5. 審查員要特別檢查**
- 4 級 C 組的 Flam tap 標了「推估」。
- 沒有自己加重音。
- 單擊序列是 RL 交替,沒有誤用 #1 的三十二分音符原譜。

**預估**:約 700 行。

---

### S5 鼓組記譜引擎與圖例(DrumDrill)

**1. 目標與範圍**
- 單線與五線的多小節譜。
- 記號可行性樣張。
- 每份譜都附圖例。
- 不做:出題。

**2. 檔案與內容**
- `js/shared/kitnotation.js`(純函式)
  - `scoreXML({ lines:1|5, time:"4/4", showTime, measures:[{ voices:[[ev]] , slash:false }], dyn:[{m,beat,mark}], key })`
  - ev = `{ value, rest, tie, tuplet, notes:[{piece, accent, ghost, open, closed, flam, drag}] }`
  - 手是 voice 1、符桿朝上;腳是 voice 2、朝下。
  - 鈸用 `x` 符頭;ride bell 用 `diamond`;cross stick 用 `circle-x`(OSMD 2.1.0 有 X、CIRCLEX、DIAMOND、SLASH);鬼音用 `parentheses`;自由發展的小節用 `slash`。
  - 開閉 HH 寫成 `<technical><open/>`、`<stopped/>`,OSMD 不畫的話用 SVG 補畫(照 `drawSticking` 的做法)。
- `js/shared/legend.js`:依題目用到的鼓件畫一行圖例(OSMD 畫每個鼓件一個音 + 底下標名稱),小字標 `src`。
- `tools/test/notation-preview.html?kit=all`:所有記號的樣張。
- 新增 `tools/test/notation.mjs`:40 個打法 + 樣張用 OSMD 畫,檢查沒有錯誤、符頭數量正確。

**3. 資料來源**:決定 3;`data/drumkey.json`。

**4. 驗收與測試**
- `checks/kitxml.mjs`:每個聲部每小節的時值 = 拍號長度;鼓件都在 drumkey 裡;沒有 `undefined`/`NaN`。
- `notation.mjs`;`layout` 在 280 寬時樣張不超出紙張。

**5. 審查員要特別檢查**
- 拿樣張逐項對照官方可確認的 3 項。
- 其他位置都標「待核對」。
- 圖例在 280 寬中英版面一樣。

**預估**:約 1100 行。**OSMD 畫不出來的記號要先回報主持人,再決定補畫或改寫法。**

---

### S6 整組鼓取樣與播放(DrumDrill;共用段落要同步)

**1. 目標與範圍**
- 照需要載入、round-robin 上限、離開模組釋放、choke 與同一片鈸的發聲數、各鼓件音量、App 打包。
- 不做:麥克風。

**2. 檔案與內容**
- `js/shared/audio.js`(都在 `@app` 區段)
  - `loadKit(pieces, onProgress)`:鼓皮與鈸各有 round-robin 上限(決定 11)。
  - `unloadKit(keep=["snare"])`:刪除 buffer 和 `drumJobs` 的鍵。
  - `playKit(piece, when, s)`:照抄 ScrollScore 的 `DRUM_VOICES` gain/send、`chokeOpenHat`、`DRUM_POLY`、`fadeDrumVoice`、`pickDrumLayers` 交叉淡化;拿掉 2.5 秒上限。
  - 合成備援不要抄(規則:不用合成鼓聲)。
  - 鼓件代號對照:`SD→snare`、`BD→kick`、`HT→tom1`、`MT→tom3`、`LT/FT→tom5`、`HH→hhClosed`、`HHo→hhOpen`、`HHf→hhPedal`、`RC→ride`、`RB→rideBell`、`CR→crashL`、`XS→xstick`。
- `tools/build/app-samples.mjs`:`PIECES` 加這 12 個鼓件,每層只打包 App 會用到的 round-robin 數(鼓 6、鈸 4)。`docs/APPSTORE.md` 記下大小。
- `licenses.html`:修改說明加上「依鼓件調整音量、hi-hat 互相截斷、同一片鈸發聲數上限、App 版只帶部分錄音」。

**3. 資料來源**:ScrollScore `index.html` 的 `DRUM_VOICES`、`DRUM_POLY`、`chokeOpenHat`、`SFZ_VEL_RANGES`;manifest 的 frames。

**4. 驗收與測試**
- 新增 `tools/test/kitaudio.mjs`:
  - 載入後計算解碼的 frames 總數:iPhone UA ≤ 85×10⁶ 位元組,桌機 ≤ 170×10⁶ 位元組(十進位)。
  - hhOpen 接 hhClosed 時,舊的那一下被淡出。
  - `unloadKit` 之後 buffer 被釋放。
- `sync.mjs` 的共用段落仍然一致。
- PianoDrill:audio.js 的共用段落沒變,只跑 `sync.mjs`。

**5. 審查員要特別檢查**
- 照抄的參數跟 ScrollScore 一字不差,出處寫在註解裡。
- 原廠 SFZ `off_by` 標成待核對。
- 沒有合成聲音。

**預估**:約 700 行。

---

### S7 共用播放器、觸控鼓墊、節奏評分(兩個 repo)

**1. 目標與範圍**
- 視奏與聽力共用的播放、作答、評分元件。
- 不做:題目。

**2. 檔案與內容**
- `js/shared/onsets.js`(兩邊相同):把 PianoDrill `js/sight/scoring.js` 的 `detectOnsets`、`scoreRhythm` 原封不動搬過來。PianoDrill 的 `scoring.js` 改成 `export { detectOnsets, scoreRhythm } from '../shared/onsets.js'` 加上原本的 `expectedOnsets`。
- `js/shared/player.js`(DrumDrill)
  - `createPlayer()` → `play({ events:[{beat, piece, vel}], lenBeats, bpm, countInBeats, click:(beat)=>0|1|2, gaps:[[b0,b1]] })`、`stop()`、`retempo(bpm)`、`beatToTime(b)`、`onTick`、`onEnd`。
  - 用時間窗排程:預先排 1.5 秒,100 ms 的計時器 + rAF。
  - `stop()` 呼叫 `audio.cancelFrom(now)`。
- `js/shared/pad.js`(DrumDrill)
  - `createPads(el, lanes:[{id, label:[zh,en], key}])`,用 `.tap-pad` 樣式。
  - `pointerdown` 的 `event.timeStamp` 用 `ctx.getOutputTimestamp()` 換算成音訊時間(沒有這個 API 就用當下的 `currentTime`/`performance.now()` 配對)。
  - 1 個鼓墊:小鼓;3 個鼓墊:鈸 / 鼓 / 大鼓與腳踩 HH。
  - 鍵盤:J(或 Space 以外的鍵)/ K / F。
- `js/shared/timing.js`(純函式):`expectedByLane(events, bpm)`;`scoreLanes(expected, taps)` 每條 lane 呼叫 `scoreRhythm`,再合併成總結。

**3. 資料來源**:PianoDrill `scoring.js`。容許範圍沿用 PianoDrill(`max(70ms, ¼ 拍)`,上限 160 ms),標「練習設定」。

**4. 驗收與測試**
- `checks/timing.mjs`:已知偏移 0、80、200 ms 的模擬敲擊 → 偏移估對;漏打、多打判斷正確。
- PianoDrill:`node --test test/sight/*.test.js`(scoring.test 不能退步)、`mic-check`、`smoke`。
- `sync.mjs`。

**5. 審查員要特別檢查**
- `onsets.js` 兩邊逐位元組相同。
- 鼓墊的時間是事件時間,不是處理函式執行的時間。
- 多指同時點擊都有收到。

**預估**:DrumDrill 約 800 行、PianoDrill 約 30 行。

---

### S8 視奏模組 + RSL Debut–3 小鼓視奏(DrumDrill)

**1. 目標與範圍**
- 照 PianoDrill 視奏的卡片、流程、讀譜舞台做,第一批是 RSL Debut–3。
- Trinity 與 RSL 4–8 顯示規格卡(S9、S10 補)。

**2. 檔案與內容**
- `js/sight/stage.js`、`random.js`、`fingerprint.js`、`meter.js`:照抄 PianoDrill(`sync.json` 列入)。
- `js/sight/gen.js`(純函式)
  - `genSnare(spec, seed)` → `{ time, bpm, measures, seed }`。
  - 節奏格(每拍):
    - Debut:♩、𝄽、𝅗𝅥(佔兩拍)
    - 1 級:♩、♪♪、𝄽
    - 2–3 級:♩、♪♪、♬♬、𝄽、♪𝄾、𝄾♪
    - 混合格(♪♬、♬♪):標「練習設定」
  - 一律 4/4,標「推估」(大綱沒寫拍號,只有 4、5 級明寫 4/4)。
  - 速度:Debut、1 級 ♩80;2 級 ♩70;3 級在 70–80 隨機。
  - 結尾規則(最後一拍落在 ♩ 或 𝅗𝅥):「練習設定」。
- `js/sight/app.js`:照 PianoDrill 的 id(`s-setup`、`s-quiz`、`s-title`、`s-play`、`s-prepare`、`s-countdown`、`s-generate`、`s-scoreCard`、`s-stage`、`s-highlight`、`s-score`、`s-playline`、`s-checklist`、`s-along`、`s-alongResult`、`s-confidence`、`s-logCard`、`s-logStreak`、`s-logToday`、`s-logTotal`、`s-logWeek`;另加 `s-pads`)。
  - 流程:
    1. 出題
    2. 「準備 90 秒」:官方的準備加練習時間;節拍器可開可關(官方);可以在鼓墊上試打
    3. 「正式打」:1 小節預備拍,標「推估:大綱沒寫」;有拍點
    4. 結果:鼓墊評分 + 自我檢查清單
    5. 「聽正確版本」
  - 速度預設官方值;可以自己改,改了顯示「練習速度(官方 ♩=80)」。
- `js/sight/strings.js`。
- `examStatus()`:`已練 n 題`。

**3. 資料來源**:[RSL §4.1,p.31、35、39、43]。

**4. 驗收與測試**
- `checks/gen-sight.mjs`:每級 1000 個種子,只出現白名單時值;每小節加總正確;同一個種子結果相同;速度在範圍內。
- `layout`、`bilingual`、`clip`:準備中 / 作答中 / 結果 / 正確版本。
- `human`:新增視奏的動作;離開分頁時 `__sight.state.play` 和計時器都停了。
- `node notation.mjs`。

**5. 審查員要特別檢查**
- 譜面像考卷(每行 4 小節,縮放規則照 PianoDrill)。
- 4/4 有標「推估」。
- 結果畫面沒有出現等第字眼。

**預估**:約 1500 行。

---

### S9 視奏 RSL 4–5 整組鼓 + 6–8 說明(DrumDrill)

**1. 目標與範圍**
- 8 小節整組鼓視奏(含 2 小節自由發展)。
- 6–8 級的 QSP 與 I&I 規格卡。

**2. 檔案與內容**
- `js/sight/kitgen.js`(純函式)
  - 手:HH 或 Ride 的節奏型;小鼓:節奏格;大鼓:節奏格;小節末可以有過門(用 Tom、Crash)。
  - 時值白名單 [RSL p.48]:♩、♩.、♪、♪.、♬;休止符 𝄽、𝄾。
  - 鼓件「整組鼓」:HH、SD、BD、HT、MT、FT、RC、CR,標「推估:大綱只寫整組鼓」。
  - 自由發展的 2 小節放在最後兩小節(slash),標「推估」。
  - 速度:4 級 80–90、5 級 80–120。
- 播放時,自由發展的小節只有拍點。
- 3 個鼓墊。
- 圖例(S5)。

**3. 資料來源**:[RSL p.48、53、57–69]。

**4. 驗收與測試**:同 S8,另外檢查每小節兩個聲部的時值、鼓件在白名單內;`kitaudio` 在視奏載入整組鼓後,離開 60 秒會釋放。

**5. 審查員要特別檢查**:「推估」標示;6–8 級沒有假裝出 QSP 題目。

**預估**:約 1000 行。

---

### S10 Trinity Playback 譜產生器(Initial–3)+ 視奏 Trinity 看譜練習(DrumDrill)

**1. 目標與範圍**
- 共用的 Playback chart 產生器(視奏、聽力都會用)。
- 這一批做 Initial–3 級。

**2. 檔案與內容**
- `js/shared/playbackgen.js`(純函式)
  - `genChart(params = playbackFor(g), seed)` → `{ time, phrases:[{bars, measures}], dyn, totalBars }`。
  - 依累積參數:拍號、時值、休止符、力度(p/f/mp/mf/重音)、鼓件、同時幾個聲部(Initial 1 個、1 級部分 2 個、2 級大多 2 個、3 級 3 個)、連結線、腳踩 HH、大鼓反拍。
  - 「總長度是否包含回打的小節」不清楚 → 採「不包含」,標「推估」。
- 視奏分頁在 Trinity 下:30 秒看譜(官方)→ 跟拍點打一遍 → 評分 / 正確版本。速度預設 80,標「練習設定(官方沒寫速度)」。

**3. 資料來源**:[RP p.60、62–63]([TR §3.1、§3.2])。

**4. 驗收與測試**:`checks/gen-playback.mjs`(每級 1000 個種子、白名單、累積規則、長度在範圍內);`layout`、`bilingual`、`clip`、`human`。

**5. 審查員要特別檢查**:累積邏輯(斜線格沿用前一級);力度的播放音量對照(pp 到 ff)放在 player 裡,標「練習設定」。

**預估**:約 1100 行。

---

### S11 Trinity Playback 4–8 級(DrumDrill)

**1. 目標與範圍**
- 加上:6/8、12/8、9/8、3/8、2/2、7/4、7/8、5/4、5/8;八分與十六分三連音、六連音、四分三連音、二連音;附點十六分、三十二分;cresc./dim.、pp/ff/sfz;rim-click、開閉 HH、Flam、Drag;鬼音;換拍號(在句子之間換,標「推估」)。
- **Ruff 與滾奏不出**:寫法和種類查不到,畫面註明。

**2. 檔案與內容**:擴充 `playbackgen.js`(複拍子用 `meter.js` 的 compound 節奏格)、`kitnotation.js` 的力度與漸強漸弱。

**3. 資料來源**:[RP p.62–63]。

**4. 驗收與測試**:同 S10;MusicXML 換拍號正確。

**5. 審查員要特別檢查**:7 級「任何常見術語與記號」只用前面各級列過的,不自己增加。

**預估**:約 1000 行。

---

### S12 聽力模組 + RSL Fill / Groove(DrumDrill)

**1. 目標與範圍**
- 照 PianoDrill 聽音的結構:`e-paneExam`、`e-examSummary`、`e-testsList`、`e-drawBtn`、`e-quizCard`、`e-qTitle`、`e-playBtn`、`e-qTags`、`e-answers`、`e-feedback`、`e-revealBtn`、`e-nextBtn`、`e-statsCard`、`e-logCard`、`e-logAcc`、`e-goalBar`。
- 子項目:過門 / 律動 / 回打。

**2. 檔案與內容**
- `js/ear/gen.js`
  - `genFill(spec, seed)`:1 小節小鼓,白名單照 [RSL §5.2]。
  - `distractors(fill, n, seed)`:改一拍的節奏格;保證跟正確答案以及彼此都不同。
  - `genGroove(spec, seed)`:2 小節,鼓件依級數;速度在範圍內隨機。
- 流程(照 [RSL §5.1]):
  1. 預備拍 1 小節 + 播放,共兩次
  2. 「練習」(時間由使用者決定)
  3. 「作答」:預備拍 + 拍點,在鼓墊上打
  4. Fill 再從 2 或 3 個譜面選項選一個
- 4–8 級 Groove 註明「風格題不出(風格清單大綱沒寫)」。

**3. 資料來源**:[RSL §5,p.31…69]。

**4. 驗收與測試**
- `checks/gen-ear.mjs`:白名單;干擾選項不重複。
- `human`:按題目節奏 ± 隨機誤差點鼓墊 → 結果是「準」。
- `layout`、`bilingual`、`clip`。

**5. 審查員要特別檢查**
- 選項數照級數(2 或 3)。
- ♩=70 固定。
- 回打的回饋旁沒有等第。

**預估**:約 1400 行。

---

### S13 聽力 Trinity Playback 回打(DrumDrill)

**1. 目標與範圍**:播一句、留空檔、打回來;30 秒看譜;播兩次(練習、評分);有拍點、沒有伴奏(註明)。

**2. 檔案與內容**:`js/ear/app.js` 的 playback 題型使用 `playbackgen` + `player`(`gaps`);依句子分段評分;Improvising 規格卡。

**3. 資料來源**:[RP p.60–61、64–65]。

**4. 驗收與測試**:`human` 模擬回打;`layout`、`bilingual`、`clip`。

**5. 審查員要特別檢查**:沒有自己做伴奏;第一次和第二次的標示清楚。

**預估**:約 900 行。

---

### S14 模擬考、練習紀錄、進度(DrumDrill)

**1. 目標與範圍**
- **技巧**:`t-mockBtn`。RSL 每組抽一項(考官抽查的形式 [RSL §3.1]),照官方速度加拍點;book 項目顯示「請自己準備」。
- **聽力**:`e-mockBtn`。RSL 是 Fill → Groove;Trinity 是 Playback。
- **視奏**:「模擬」= 照官方準備時間計時,不能暫停。
- 結果畫面沿用 `.mock-res`。
- 三個模組的紀錄卡格式一樣;`examStatus` 顯示進度;每週目標(`.goal`)。

**2. 檔案**:三個模組的 `app.js`、`strings.js`。

**3. 來源**:[RSL §2.1 考試順序 p.18]。

**4. 驗收與測試**:`human` 在模擬考中途切分頁、重新整理、旋轉螢幕都不會留下播放;`layout`、`bilingual`、`clip`。

**5. 審查員要特別檢查**:沒有總分換算。

**預估**:約 900 行。

---

### S15 麥克風節奏評分,選用(兩個 repo)

**1. 目標與範圍**
- 視奏、聽力的「用麥克風評分節奏(選用)」,照 PianoDrill `s-alongMic`。
- 只評起音時間;在裝置上分析、不上傳。
- `detectOnsets` 用 `refractory: 0.05`(鼓比較密)。

**2. 檔案與內容**
- `js/shared/mic.js`:PianoDrill 的 `js/sight/mic.js` 搬過來,兩邊相同,PianoDrill 改 import 路徑。
- `drumdrill.v1.mic`;`privacy.html`(兩邊格式一致)。
- `docs/IOS.md` 加 `NSMicrophoneUsageDescription`(中英,用 InfoPlist.strings)。

**3. 來源**:PianoDrill 的做法。

**4. 驗收與測試**
- 新增 `tools/test/mic-check.mjs`:注入假的 MediaStream,內容是 Naked Drums 取樣在已知時間點混成的測試訊號,標明是測試訊號、不給使用者聽。
- PianoDrill:`mic-check`、`smoke`、`node --test test/sight`。

**5. 審查員要特別檢查**:關掉 echoCancellation、noiseSuppression、autoGainControl;拒絕權限時的訊息;隱私文字。

**預估**:DrumDrill 約 500 行、PianoDrill 約 20 行。

---

### S16 上架收尾與總驗收(兩個 repo)

**1. 目標與範圍**
- 授權、隱私、關於頁。
- `docs/APPSTORE.md`:中英描述、審核備註、截圖清單。
- `docs/IOS.md`(兩邊相同):
  - `npx cap add ios`(SPM,iOS 15,Xcode 26,檢查 `CapApp-SPM/Package.swift`)
  - AppDelegate 設 `AVAudioSession .playback`(要不要 `.mixWithOthers` 由主持人決定)
  - Info.plist(`ITSAppUsesNonExemptEncryption=NO`、方向、麥克風)
  - `PrivacyInfo.xcprivacy`
  - `.gitignore` 排除 `App/App/public`
  - TestFlight、實機檢查清單:靜音開關、來電、AirPods、SE、iPad 分割畫面、離線第一次打開
- 無障礙:鼓譜容器 `role="img"` + `aria-label`(打法名稱 + 左右手序列)。
- `layout.mjs` 加跑一次 Playwright WebKit。
- 新增 `tools/test/app-www.mjs`:檢查 `app/www` 的檔案完整。
- App 版字型:在 `app-www.mjs` 把 Google Fonts 的 `<link>` 拿掉,改用系統字型(要主持人同意)。
- grep 確認沒有「準備中」「還在做」。

**2. 檔案**:上面列出的文件與測試。

**3. 來源**:審查意見 A7、C1–C13。

**4. 驗收與測試**:兩個 repo 全部測試 + `sync.mjs`。

**5. 審查員要特別檢查**:CC BY 的修改說明完整(S6 的修改都有寫);商標聲明。

**預估**:約 800 行。

---

## 5. CLAUDE.md 建議修改(由主持人決定)

1. 「架構」:
   - 子項目改成「技巧 = 滾奏/複點/Flam/Drag;視奏 = 級數 0–8;聽力 = 過門/律動/回打;檢定 = 技巧/視奏/聽力」。
   - 補上 §3.3 的五條版面規則(飽滿、手機橫式、分頁列滿版、三模組一致、視奏像考卷)。
2. 把「視奏、聽力目前是準備中」改成:
   - 「題目由 App 依 `data/exam-*.json` 的官方參數(每項有頁碼)產生,標示『僅供練習;實際要求以官方大綱為準』。」
   - 「大綱沒寫的參數:不出題,或標『推估』;速度沒寫就讓使用者自己調,標『練習速度』。」
3. 「Trinity 只採用 Rock & Pop(from 2018)大綱;不用 Drum Kit & Percussion 系列的要求(記譜圖例 DK p.107 例外,要標出處)。」
4. 「檢定要求」那一條補上:「已核對的資料在 `docs/sources/*.md`(RSL 2018 規格 2026-06 修訂、Trinity R&P Online edition 2026-04)。」
5. localStorage 加上 `drumdrill.sight.v1`、`drumdrill.ear.v1`;外框加 `mic` 欄位。
6. 字串檔加上 `js/sight/strings.js`(`sight.`)、`js/ear/strings.js`(`ear.`)。
7. 共用模組清單:`score`、`tempo`、`landscape`、`player`、`pad`、`timing`、`onsets`、`mic`、`kitnotation`、`legend`、`examdata`、`playbackgen`。
8. 模組介面:「`leave()` 停止播放與計時,但保留題目;`enter()` 有題目就不重新出題。」
9. 鼓譜:
   - 「鼓組圖例在 `data/drumkey.json`,每份鼓組譜都要附圖例。」
   - 「位置待依 PAS Weinberg《Guide to Standardized Drumset Notation》核對。」
10. 鼓聲:「整組鼓 12 個鼓件、round-robin 上限、離開模組釋放;choke、DRUM_POLY、音量照 ScrollScore 鼓引擎。」
11. 「兩個 App 同步」:§3 的表格,加上 `sync.mjs` 必跑。
12. 測試清單:加 `clip`、`notation`、`playback`、`kitaudio`、`mic-check`、`app-www`、`sync`。
13. 上架:「App Store 關鍵字不放 Trinity、RSL、Rockschool。」「iOS 原生步驟見 `docs/IOS.md`(雲端做不了)。」

---

## 6. 待主持人或使用者決定

1. 要不要買 PAS Weinberg 指南,核對鼓組圖例?(建議買)
2. RSL Debut–3 視奏用 4/4 並標「推估」,可以接受嗎?
3. 4、5 級的 2 小節自由發展放在最後兩小節(推估),可以接受嗎?
4. 麥克風評分要不要放進 1.0?(建議放,選用)
5. App 版改用系統字型?
6. `AVAudioSession` 要不要 `.mixWithOthers`?
7. 「最快速度」改名為「示範最快」,可以嗎?

---

## 7. Stage 總表

| 編號 | 名稱 | 依賴 | DrumDrill 改動量 | 同步改 PianoDrill |
|---|---|---|---|---|
| S0 | 清債、上線安全、同步骨架 | — | 約 450 | 是(audio、main、sw、stamp、app.css、sync、測試;約 250) |
| S1 | 共用元件抽出 + 手機橫式 | S0 | 約 900 | 否 |
| S2 | 考試資料檔與驗證 | S0 | 約 1200 | 否 |
| S3 | 檢定頁:技巧清單、一鍵練習、摘要 | S1、S2 | 約 1000 | 否 |
| S4 | RSL 依大綱時值的練習型 | S3 | 約 700 | 否 |
| S5 | 鼓組記譜與圖例 | S1、S2 | 約 1100 | 否 |
| S6 | 整組鼓取樣 | S0 | 約 700 | 只跑 sync |
| S7 | 播放器、鼓墊、節奏評分 | S1、S6 | 約 800 | 是(`onsets.js`,約 30) |
| S8 | 視奏 + RSL Debut–3 | S5、S7 | 約 1500 | 否(照抄 PianoDrill 的檔案) |
| S9 | 視奏 RSL 4–5 + 6–8 說明 | S8 | 約 1000 | 否 |
| S10 | Trinity Playback 產生器 0–3 + 視奏 | S8 | 約 1100 | 否 |
| S11 | Trinity Playback 4–8 | S10 | 約 1000 | 否 |
| S12 | 聽力 + RSL Fill/Groove | S7、S5 | 約 1400 | 否 |
| S13 | 聽力 Trinity 回打 | S10、S12 | 約 900 | 否 |
| S14 | 模擬考、紀錄、進度 | S4、S9、S11、S13 | 約 900 | 否 |
| S15 | 麥克風(選用) | S8、S12 | 約 500 | 是(`mic.js` 搬到 shared,約 20) |
| S16 | 上架收尾 | 全部 | 約 800 | 是(`IOS.md`、隱私、授權格式) |

**每個 Stage 要跑的 PianoDrill 測試**(有同步的 Stage):`verify`、`ear-verify`、`node --test test/sight/*.test.js`、`layout`、`bilingual`、`human 150 3`、`clip`、`notation`、`tools/sight/smoke.js`、`mic-check`(動到音訊或評分時)。

---

### 參考來源(這次查證)
- ScrollScore 鼓引擎(choke、DRUM_POLY、DRUM_VOICES):https://raw.githubusercontent.com/stevenmusic/ScrollScore/main/index.html
- Naked Drums SFZ 的 `off_by`:搜尋沒有找到原廠檔案。只查到 SFZ 的 `group`/`off_by` 一般用法:[sfzformat Drum basics](https://sfzformat.com/tutorials/drum_basics)、[Renoise 論壇](https://forum.renoise.com/t/done-b4-b5-mute-groups/39991)、[LinuxSampler 論壇](https://bb.linuxsampler.org/viewtopic.php?p=24315)
- PAS Weinberg 指南(付費書,沒有公開 PDF):[Hal Leonard 06620063](https://www.halleonard.com/product/6620063/guide-to-standardized-drumset-notation)、[Poppler's](https://www.popplersmusic.com/item/06620063/)、[Wikipedia: Percussion notation](https://en.wikipedia.org/wiki/Percussion_notation)

### 實作關鍵檔案
- /home/user/DrumDrill/js/main.js
- /home/user/DrumDrill/js/shared/audio.js
- /home/user/DrumDrill/js/tech/app.js
- /home/user/DrumDrill/data/exam-rsl.json、/home/user/DrumDrill/data/exam-trinity.json(新增)
- /home/user/pianodrill/js/sight/scoring.js、/home/user/pianodrill/js/sight/stage.js(範本與同步來源)

---
## 8. 主持人決定(2026-10-18)
1. PAS Weinberg 指南:目前沒有;圖例照決定 3 標「待核對」,之後買到再改 drumkey.json 的 src。
2. RSL Debut–3 視奏用 4/4 標「推估」:接受。
3. 4、5 級自由發展放最後兩小節標「推估」:接受。
4. 麥克風評分:放進 1.0,選用(S15)。
5. App 版字型:S16 時 App 版拿掉 Google Fonts、改系統字型;網頁版不動。
6. AVAudioSession:`.playback` + `.mixWithOthers`(可以邊放歌邊練),寫進 docs/IOS.md。
7. 「最快速度」改名「示範最快」:接受。
8. 推送:DrumDrill 推到本工作階段指定的分支 `claude/text-overflow-issue-52hnyj`(不推 main);PianoDrill 照它的 CLAUDE.md 推 main。每個 Stage 審查通過後才推。
