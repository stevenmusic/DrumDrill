# DrumDrill 專案規則

DrumDrill 爵士鼓檢定特訓(2026-10,使用者要求):照 PianoDrill(stevenmusic/PianoDrill)的版面與架構做的爵士鼓版,準備上架 App Store。
「鼓」一律指**爵士鼓**(drum kit),不是行進鼓或一般打擊樂;中文名稱、說明都寫「爵士鼓」。

## 回覆
- 所有回覆一律用中文,不要用英文(使用者要求)
- 每次更新(每次 push)都要用中文條列解釋這次改了什麼、為什麼改

## 架構(照 PianoDrill)
- 底部四個分頁:**技巧 / 視奏 / 聽力 / 檢定**。頂欄下面的子項目分段鈕:技巧 = 滾奏/複點/Flam/Drag(PAS 四大類)、檢定 = 技巧/視奏/聽力
- 檢定:考試系統 **Trinity Rock & Pop Drums**(初級 Initial、1–8 級)與 **RSL Rockschool Drums**(入門 Debut、1–8 級),在外框設一次(`js/main.js`)
  - Trinity 只採用 Rock & Pop 大綱;不用 Drum Kit & Percussion 系列的要求(記譜圖例用到 DK p.107 是例外,要標出處)
  - 檢定頁不顯示練習紀錄(練習回饋不跟配分、等第放在同一個畫面,也不換算成官方分數)
- 第一次打開問「你在準備爵士鼓檢定嗎?」:選了 → 打開檢定分頁;不考 → 技巧分頁自由練習
- 模組 `js/tech/app.js`(基本打法)、`js/sight/app.js`、`js/ear/app.js` 匯出同一組函式:`start(ctx)`、`enter(tab)`、`leave()`、`setExam(exam)`、`relang()`、`examStatus()`、`onKey(e)`
  - 離開模組(`leave`)一定要停止播放與計時(但不清題目;`enter` 有題目就不重新出題);模組看不到時不要量版面(寬度是 0),回到畫面再畫
  - `setExam` 系統與級數沒變就不重設(外框重送同一個考試、資料晚到不能洗掉畫面)
  - ctx:`exam`、`examChanged()`、`gradeLabel(g, sys)`、`showView(view, sub)`,加上 DrumDrill 的 `examData(sys)`、`drumKey()`(最多等 4 秒,晚到時呼叫模組的 `onCtx()`)
  - 檢定頁的考試摘要、規格卡共用 `js/shared/examview.js`(`fillSpec`、`pairStack`、`summaryRows`…)
  - 元素 id 加前綴:技巧 `t-`、視奏 `s-`、聽力 `e-`
- 共用元件(`js/shared/`):`score.js`(一整行譜面 + 播放軸,看不到時延後重畫)、`tempo.js`(速度 − / + / 滑桿 / 拍點燈號)、`landscape.js`(手機橫式)。
  **共用元件不寫死前綴**:一律接收模組自己的 `$`(`id => getElementById(前綴 + id)`)(`grep -n '"t-' js/shared/*.js` 要沒結果);
  共用的 CSS 用 class,或在 `drum.css` 補 `#s-…`、`#e-…` 的規則,`app.css` 不動
- 視奏、聽力目前是「準備中」說明卡:題目規則要先照 Trinity / RSL 官方大綱與範例整理才做
- 中英雙語(預設英文,切過就記住):外框字串 `js/shared/i18n.js`、技巧 `js/tech/strings.js`(前綴 `tech.`);程式產生的文字用 `tr("中", "EN")`
- 用詞:「檢定」「考試」,不用「考級」(只有 App Store 關鍵字可以放)
- localStorage:`drumdrill.v1`(外框)、`drumdrill.tech.v1`(技巧)、`drumdrill-lang`(語言)

## 絕不能做的事
- **不要有 build step**:多檔 ES modules,直接部署 GitHub Pages(main 根目錄);App 版只是把同樣的檔案複製到 `app/www`
- **只照官方資料**,不自己發明:
  - 基本打法:`js/tech/rudiments.js` 照 PAS《International Drum Rudiments》官方表(pas.org/wp-content/uploads/2024/04/pas-rudiments.pdf)逐個抄,
    左右手、時值、重音、Flam / Drag、滾奏斜線數都要一樣;改了要跑 `node tools/test/verify.mjs`(裡面有另外照官方表抄的左右手順序表互相核對)
  - 滾奏的擊數由官方的斜線記法算出來(八分音符 + 2 條斜線 = 32 分音符 × 4),示範播放照這個算,不另外編
  - 「左手先」只給官方表有印第二行的打法(2、3、8、9、11、12、14、19、23、28、34),內容就是左右對調
  - 檢定要求(Trinity / RSL):照 `docs/sources/*.md`(已逐頁核對的大綱筆記)放進 `data/exam-*.json`,每項有頁碼;
    改資料要跑 verify(`tools/test/checks/examdata.mjs` 另外手抄了一份大綱的表互相核對)
  - 每個參數旁邊標出處,只有三種:官方頁碼(「RSL p.42」「Trinity p.62」)/ 推估(大綱沒寫、App 先這樣做;資料用 `{v, assumed}` 或 `xxxAssumed: true`)/
    練習設定(App 自訂的);大綱沒寫的數字是 null,不自己補。**沒核對到的不放**(資料是 null / 大綱查不到的,畫面寫「大綱沒寫」,不拿別的考試或別的級數充數)。檢定相關畫面加 `practiceOnly`(「僅供練習;實際要求以官方大綱為準」)
  - RSL 技巧項目分三種(`kind`):`pas` = PAS 原譜;`pattern` = PAS 的左右手、重音、裝飾音 + 大綱時值(`rudiments.js` 的 `pattern()`,
    標「App 依大綱時值排的練習型 · 不是官方譜」,不自己加重音;`tools/test/checks/pattern.mjs` 檢查,另有手寫錨點);`book` = 譜只在官方檢定書,只列名稱
  - 熟練度(已經會了 / 待加強)以 PAS 編號計:同一個編號的練習型共用(`techPasNos`),不另外記
  - 組別的 `bpmSrc: "backing"` = 官方寫「跟伴奏音軌」(有寫,只是沒有數字):顯示「跟伴奏音軌」,**不是推估**
- **不要用合成鼓聲**:一律用 `js/shared/audio.js`(ScrollScore 的 Naked Drums 取樣,CC-BY 4.0),力度分層與音量曲線照原廠 SFZ(照 ScrollScore 的鼓引擎)
  - 整組鼓(S6):12 個鼓件(`KIT_VOICE`),round-robin 有上限(`RR_LIMIT`、`KIT_RR`;iPhone / 小記憶體比較少),離開模組後可以釋放(`unloadKit`);
    choke、DRUM_POLY、音量照 ScrollScore 鼓引擎
  - App 只打包 iOS 用得到的取樣(`tools/build/app-samples.mjs` 的 `PIECES` = audio.js 小記憶體的上限;verify 的 checks/appsamples.mjs 核對)
- 外觀照 PianoDrill 的設計代幣(`css/app.css` 整份沿用,DrumDrill 專屬的放 `css/drum.css`),圖示用線稿 SVG(24 格、stroke 2、圓端點)
- App 圖示(`icons/`)= 小鼓 + 勾(跟 PianoDrill 的琴鍵 + 勾同一套),不放文字、不用考試機構的標誌或配色;改 `tools/test/icons.mjs` 再重新產生

## 鼓譜(js/tech/notation.js)
- 照 PAS 官方表的寫法:單線譜(E4 剛好在線上)、符桿朝上、不印拍號;Flam = 帶斜線的八分裝飾音、Drag = 兩個十六分裝飾音,都有連線接到主音
- 連音(3 / 5 / 6 / 7 / 9 / 10)每一組都標數字(關掉 OSMD 的 TupletNumberLimitConsecutiveRepetitions)
- 左右手(R / L)畫在每個音下面(`drawSticking`),裝飾音的字比較小;多次反彈只畫 z、不寫左右手(官方表就是這樣)
- 反覆:畫反覆記號,右上角寫 ×N
- RSL 練習型(`rudiments.js` 的 `pattern()`):單擊 = #1 的 RL 交替(不是 #1 原譜的三十二分音符)、雙擊 = #6 實際打的 RRLL(播放時第二下輕一點,照 #6);
  其他編號用 PAS 表的左右手、重音、Flam / Drag(取最短重複單位);一輪 = lcm(序列長, 每拍音數) 個音(一定是整數拍,每拍一組連桿);
  原譜有滾奏斜線或多次反彈的不支援(丟錯);一輪不到 4 拍時拍點重拍每 4 拍一次;目標模式不顯示 PAS 原譜的「示範最快」
- 鼓組譜(`js/shared/kitnotation.js`):滾奏斜線(roll)只准四分音符以上、多次反彈(buzz)八分音符以上;寫法與可行性見 `docs/NOTATION.md`

## 版面(所有工具共用的規則)
- 適配所有尺寸:折疊機 280、SE 320 到 iPad、桌機、1080p,手機直式與橫式;沒有橫向捲動、元素不超出畫面、按鈕文字不被截斷、點擊區域至少 28×28、底部分頁列不蓋住內容
- **手機橫式**(orientation:landscape 且高度 ≤ 500):分頁列是左邊的直欄、頂欄一行(`app.css`,跟 PianoDrill 共用);
  譜面依「譜面框到畫面底」放大(`landscape.js` 的 `fitLandZoom`),播放時 body 加 `land-play`:樂譜卡貼到頂欄下、放到滿版,停止後捲回、縮回;播放中點譜面 = 停止
- **中英文版面要一模一樣**:英文長就縮短文字;段落用 `pairText`;標籤數量兩種語言一樣;打法清單用固定格子(最多兩行)
- 快取:改了 css/js/data 一定要跑 `node tools/build/stamp.mjs`(index.html 的 importmap 與 ?v= 版本指紋;verify 會檢查)

## 工作方式
- 改好、測試沒問題就直接 push 到 main(使用者要求,不用另開分支)
  - 雲端工作階段依指定分支(目前是 `claude/text-overflow-issue-52hnyj`,不推 main)
- 測試:
  - `node tools/test/verify.mjs`(不用瀏覽器):基本打法照 PAS 官方表、MusicXML、`checks/examdata.mjs`(考試資料 + 手抄核對)、
    `checks/pattern.mjs`(RSL 練習型)、`checks/appsamples.mjs`(App 取樣數)、版本指紋、`sync.mjs`(跟 PianoDrill 的共用檔案;`PIANODRILL=…`)
  - 瀏覽器(`cd tools/test && npm i` 一次;Playwright):`node layout.mjs`(19 種尺寸)、`node bilingual.mjs`(中英版面)、`node clip.mjs`(文字被切掉)、
    `node human.mjs 150 3`(模擬真人操作)、`node playback.mjs`(播放排程與停止)、`node kitaudio.mjs`(整組鼓取樣)
  - 重構前後畫面要一樣:動手前 `node shots.mjs --save`,改完 `node shots.mjs --compare`(19 種尺寸 × 技巧四類 + #40×8 + 檢定頁 × 中英,逐像素比對)
  - `tools/test/notation-preview.html?n=1,2,3`:把指定的打法畫出來,跟官方表對照;`?pattern=rsl-7-A`(或 `rsl-7`):RSL 練習型
- 上架:`docs/APPSTORE.md`;App Store 關鍵字不放 Trinity、RSL、Rockschool(考試機構的商標)
