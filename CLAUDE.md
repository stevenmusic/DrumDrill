# DrumDrill 專案規則

DrumDrill 爵士鼓檢定特訓(2026-10,使用者要求):照 PianoDrill(stevenmusic/PianoDrill)的版面與架構做的爵士鼓版,準備上架 App Store。
「鼓」一律指**爵士鼓**(drum kit),不是行進鼓或一般打擊樂;中文名稱、說明都寫「爵士鼓」。

## 回覆
- 所有回覆一律用中文,不要用英文(使用者要求)
- 每次更新(每次 push)都要用中文條列解釋這次改了什麼、為什麼改

## 架構(照 PianoDrill)
- 底部四個分頁:**技巧 / 視奏 / 聽力 / 檢定**。頂欄下面的子項目分段鈕:技巧 = 滾奏/複點/Flam/Drag(PAS 四大類)、視奏 = 照學習順序「認譜 / 節奏 / 律動 / 樂譜」(級數只在檢定頁設)、檢定 = 技巧/視奏/聽力
- 檢定:考試系統 **Trinity Rock & Pop Drums**(初級 Initial、1–8 級)與 **RSL Rockschool Drums**(入門 Debut、1–8 級),在外框設一次(`js/main.js`)。
    檢定頁的考試卡(`#examSetup`)不收起來:系統兩顆大鈕(`#systemSeg`)+ 級數一排按鈕(`#gradeSeg`,第一格 D / I,aria-label 寫完整級名),點一下就換;第一次的問題同樣是按鈕列(`#obGradeSeg`),不用下拉選單。
    已選考試時不另外寫「RSL · 3 級」那行(系統鈕、級數鈕亮著就是);**沒選考試時**系統鈕、級數鈕都不亮(先點系統只亮那一顆,點了級數才算選好),
    內容只寫「先選考試系統和級數」,不進任何模組、不顯示子項目(不拿 Trinity 1 級之類的預設內容充數;main.js 共用部分,兩個 App 一樣)
  - Trinity 只採用 Rock & Pop 大綱;不用 Drum Kit & Percussion 系列的要求(記譜圖例用到 DK p.107 是例外,要標出處)
  - 檢定頁不顯示練習紀錄(模擬考的進行中 / 結果 / 中止說明例外:那個畫面藏起配分、等第與規格卡,只有各項練習回饋,不算總分)
- 第一次打開問「你在準備爵士鼓檢定嗎?」:選了 → 打開檢定分頁;不考 → 技巧分頁自由練習
- **自學者看得懂**(2026-10 第二輪,兩個 App 一樣):
  - 第一次的問題:系統、級數都不預選,沒選級數時「開始準備考試」不能按;級數下面一行「不確定考哪個?先選「自由練習」,之後再改」
  - 檢定頁沒選考試:級數下面一行「看檢定書封面或問老師;不考試可以直接用前三個分頁」;有選考試:一行「推估 = 大綱沒寫清楚,App 先這樣練」(只有畫面上有「推估」標籤的 App 寫;@app 的 `ASSUMED_HINT`,PianoDrill 不寫)
  - 檢定頁三格進度只顯示(`div.part`,不是按鈕;換項目用子項目列,小畫面換項目時捲到那一項的題目卡 `examScroll`)
  - 每個子項目第一次進來一行說明(講在練什麼、怎麼作答,不形容聲音):技巧在題目卡標籤下(`#t-intro`,那一類播放過一次就不再出現,存 `intro`);
    視奏、聽力 / 聽音寫在題目卡狀態那行(做完一題就換回平常的下一步;存 `intro`,認譜 / 認音存在 `read.seen`)
  - 自由練習(沒選考試的分頁)不出現任何出處標記(推估、練習設定、大綱沒寫、頁碼、考試名稱;「…都是 App 的練習設定」那句、速度的「· 練習」也不放),出處區整塊藏起來;檢定頁照舊
  - 結果數字不寫「平均差 n 毫秒(容許 ±n)」;「命中」寫「打中」;統計卡「n 題 · 打中 x%」(聽力 / 聽音的正確率「x% · n 題」)
- 模組 `js/tech/app.js`(基本打法)、`js/sight/app.js`、`js/ear/app.js` 匯出同一組函式:`start(ctx)`、`enter(tab)`、`leave()`、`setExam(exam)`、`relang()`、`examStatus()`、`onKey(e)`
  - 離開模組(`leave`)一定要停止播放與計時(但不清題目;`enter` 有題目就不重新出題);模組看不到時不要量版面(寬度是 0),回到畫面再畫
  - `setExam` 系統與級數沒變就不重設(外框重送同一個考試、資料晚到不能洗掉畫面)
  - ctx:`exam`、`examChanged()`、`gradeLabel(g, sys)`、`showView(view, sub)`,加上 DrumDrill 的 `examData(sys)`、`drumKey()`(最多等 4 秒,晚到時呼叫模組的 `onCtx()`)
  - 檢定頁的考試摘要、規格卡共用 `js/shared/examview.js`(`fillSpec`、`pairStack`、`summaryRows`…)
  - 元素 id 加前綴:技巧 `t-`、視奏 `s-`、聽力 `e-`
- 共用元件(`js/shared/`):`score.js`(技巧、聽力:一整行譜面 + 播放軸,看不到時延後重畫;視奏不用,考卷排法用 `js/sight/stage.js`)、`tempo.js`(速度 − / + / 滑桿 / 拍點燈號)、`landscape.js`(手機橫式)。
  **共用元件不寫死前綴**:一律接收模組自己的 `$`(`id => getElementById(前綴 + id)`)(`grep -n '"t-' js/shared/*.js` 要沒結果);
  共用的 CSS 用 class,或在 `drum.css` 補 `#s-…`、`#e-…` 的規則,`app.css` 不動(兩個 App 共用的規則例外:改了要兩邊同步,例如 S16 的焦點框、字級、對比)
- 視奏(`js/sight/`,卡片 id 與流程照 PianoDrill 視奏;S8 + S9 + S10/S11 的介面)分兩個地方(2026-10 使用者決定的新架構):
  - **視奏分頁 = 練讀譜**:子項目 = 分類(`CATS`:節奏 rhythm / 律動 groove / 樂譜 chart;`main.js` @app 的 `SUBS.sight`,舊版存的級數讀進來改成節奏);
    **難度由 App 自動調整**(`js/shared/level.js`,每個分類各自記在 `drumdrill.sight.v1` 的 `level` / `streak`):難度 n = 一組已有的出題參數(`CAT_LEVELS`,不自己編更難的):
    節奏 1–4 = RSL Debut–3 小鼓、律動 1–2 = RSL 4–5 整組鼓、樂譜 1–9 = Trinity Playback Initial–8;到頂時提示換分類。
    起點:有選考試 → 對應級數(節奏 = 級數 0–3 夾住、律動 = 4–5 級用那一級(6–8 用最高)、其他 1、樂譜 = 級數 + 1);沒選考試 → 1。
    結果下面「太簡單 / 剛好 / 太難」(+1 / 0 / −1);節奏回饋連續 3 題 ≥ 90 自動 +1、連續 2 題 < 50 自動 −1(結果與播報寫出來);題目卡「難度 n」+ ▼ ▲ + 小字「難度 1–n」(「練習設定」只寫在譜下面那一句)。
    **視奏分頁不寫考試名稱、級數名、頁碼、practiceOnly、推估標籤**(圖例用 `drawLegend` 的 `plain`);題目卡大標題 = 「分類 · 難度 n」;
    難度列與主要動作「正式打」(`s-performTop`)都在題目卡上(第一個畫面就看得到,不放在收起來的設定卡);下一步寫在題目卡的狀態(▶ 聽正確版本 / 新題目;結果裡不再寫一次)。
    題目卡(使用者:按鈕太多、三個都像播放;PianoDrill 同一套):第一行大標題 + 右邊圓形 ▶、第二行標籤、難度列(▼ 難度 n ▲)、一句狀態 / 下一步、最後一行左邊小的「新題目」+ 右邊大的「正式打」(唯一的主要動作,進行中變停止)。
    **視奏分頁沒有準備倒數**(「準備 90 秒 / 看譜 30 秒」與倒數藏起來;官方準備時間留在檢定頁的練習與模擬考);鼓墊卡沒有「正式打」長條鈕(鼓墊、麥克風選項、結果照舊)。
    ▶(聽正確版本)還沒打過這一題前不顯示(visibility 保留位置),打完或停止才出現,新題目又藏起來;打完狀態寫「按 ▶ 對照正確版本,或新題目」。空白鍵:還沒打過 = 正式打(`freeQ`、`played`、`syncFree`)
  - **認譜**(第一格,`js/sight/reading.js`):五線鼓組譜上一個記號(`legendXML` + `setupKit` / `decorate`,跟圖例同一套),點鼓件格子作答;答錯標出正確的格子並播那個鼓聲。
    設定都是一直看得到的按鈕,順序:鼓件快捷 → 自訂 → 模式(練習 / 60 秒 / 連對)。
    快捷照學習順序、名稱直接寫內容,每一格包含前一格(下面一行小字寫明):「小鼓 大鼓 Hi-hat」→「+ Toms」(Tom 1、Tom 2、落地鼓)→「+ 鈸」(Ride、Crash)→「全部記號」;
    窄畫面 2×2、每顆一行;存的是鼓件清單(舊版「基本 / 加筒鼓 / 全套」剛好對到第 1 / 2 / 4 格,「只有筒鼓」變成自訂)。題目卡標題 =「n 個鼓件」(快捷的名字亮在按鈕上,不重複;自訂寫「自訂 · n 個鼓件」);作答提示「哪個鼓件?」(60 秒 / 連對還沒開始時不寫)。
    鼓件、自訂、模式三列都是標籤在上、按鈕用滿寬度;自訂(drumkey.json 每個鼓件一顆,13 顆):窄畫面 3 欄、寬的 4–5 欄,每顆一行不換行、高 ≥ 40。
    作答格子名字一行;折疊機「全部記號」4 欄、高 ≥ 40(字可以換行),鼓件快捷才留在第一個畫面。
    **鼓件名稱**(drumkey.json,中 / 英):小鼓 / Snare、大鼓 / Kick(英文一律寫 Kick:快捷、作答格子、鼓墊、圖例)、Tom 1、Tom 2、落地鼓 / Floor tom、Hi-hat、腳踩 Hi-hat / Foot hi-hat、開 Hi-hat / Open hi-hat、關 Hi-hat / Closed hi-hat、
    Ride、Ride bell、Crash、Cross stick;畫面上不用「HH」縮寫(初學者看不懂)、不用「筒鼓」(寫 Toms)。
    第一個畫面(iphone-390、fold-280)要看得到子項目列、譜框、作答格子、鼓件快捷(捲動安排見 PianoDrill CLAUDE.md;tasks.mjs 的 `first` / `common` 檢查)。
    譜框(`js/shared/staffframe.js`,兩個 App 逐位元組相同):不管出哪個鼓件,框的高度與譜表位置都不變(上下一樣多、譜表垂直置中);譜與作答格子之間寫題目「這是哪個鼓件?」。
    挑戰、最高分、最常錯的 3 個(下一輪機率加倍)= `js/shared/drill.js`(兩個 App 逐位元組相同);存在 `drumdrill.sight.v1` 的 `read`;答一題算一題練習
  - **操作方便**(使用者要求;`node tools/test/tasks.mjs` 檢查):視奏頁不用下拉選單、常用設定不藏在收起來的卡、第一個畫面就能開始、改設定馬上換題、作答鈕 ≥ 44(最小 28)、
    目前設定在題目卡上一行寫清楚;任務「≤ 3 下開始練、開始前不用捲動」(開始後的捲動只記注意)在 iphone-390 / fold-280 / iphone-land / ipad / desktop 都要過
  - **檢定頁 = 照考試級數出題**:「練習這一級的視奏」在檢定頁直接出題作答(`xp`;準備 → 正式打 → 回饋 → 正確版本;考試摘要與規格卡藏起來,模擬考卡當標題列:回到規格 / 開始模擬考);
    模擬考結果的「看譜、聽正確版本」也回到這個畫面。三種題目,都標「依 RSL N 級參數的練習 · 」或「依 Trinity Playback N 級參數的練習 · 」+ practiceOnly
  - RSL Debut–3 小鼓視奏:`gen.js` 出題(純函式,照 `data/exam-rsl.json` sight[g] 的白名單時值、休止符、小節數、速度;4/4 標推估;節奏格、結尾規則、混合格標練習設定;
    範圍速度隨機取整數;同種子同題、`fingerprint.js` 的歷史避免重複);單線譜、1 個鼓墊(J / F)
  - RSL 4–5 整組鼓視奏:`js/shared/kitgen.js` 的 `genRslKit`;五線鼓組譜 + 圖例;最後 2 小節自由發展(斜線,位置推估):播放只有拍點、正式打不評分(那裡的敲擊不算多打);
    3 個鼓墊(鈸 F / 鼓 J / 大鼓與腳踩 HH K,`timing.scoreLanes`,評分前 `hitsOnly`);鼓件範圍、預備拍標推估,節奏型、速度隨機標練習設定(出題器的 NOTES 放在譜下面的小字)
  - Trinity Initial–8:Rock & Pop 沒有視奏;「Playback 看譜練習」(`js/shared/playbackgen.js` 的 `genChart(playbackParams(g))`):看譜 30 秒(官方 p.60)→ 跟拍點打一遍 → 聽正確版本;
    題目卡寫明「官方是聽一句打一句、配伴奏音軌;App 只有拍點」;速度官方沒寫:預設 ♩=80 標練習設定、可以改(改了寫練習速度);預備拍官方有、長度推估;力度的播放音量是練習設定(`kitevents`)
  - RSL 6–8 Quick Study Piece(拍號、時值、速度大綱沒寫)不出題:說明卡 + 規格卡 +「到視奏頁練整組鼓讀譜(律動;不是 QSP)」;I&I(1–5)只列規格
  - 流程:出題 → 準備(RSL 90 秒 / Trinity 30 秒,官方;節拍器可開關;鼓墊可試打、不計分)→ 正式打(預備拍 = 第一小節的拍號 1 小節,3/8 是 2 小節)→ 結果(觸控鼓墊的節奏「練習回饋」+ 自我檢查,
    不出現等第字眼、不換算成官方分數)→ 聽正確版本(`js/shared/player.js` + `kitevents.toEvents` + `stage.js`)。RSL 使用者改了速度、在官方範圍外寫「練習速度(官方 ♩=…)」
  - 拍點與小節時間軸:`js/sight/meter.js`(DrumDrill 自己的;PianoDrill 的 meter.js 是它出題器的節奏格換算,用不到,不列入 sync.json):
    x/4 每個四分、x/2 每個二分、複拍子每個附點四分、5/8 = 3+2、7/8 = 2+2+3;有 x/8 的譜播放器用八分音符當一拍;換拍號照小節算(`checks/sight-meter.mjs`)
  - 整組鼓取樣:`audio.loadKit(這一題用到的鼓件)`,載入時 ▶ 外圈畫進度、▶ 與正式打先不能按(載完才能開始;promise 有 catch,失敗再按重試;載入訊息只在還沒開始時寫,載完還原先前的訊息);整組鼓的釋放見下面「整組鼓所有權」
  - 譜面像考卷(下面「版面」);小鼓視奏每小節一樣寬(FixedMeasureWidth),整組鼓 / Playback 照內容排寬度(換拍號、7/4 與 3/8 混在一起);一小節比 4/4 長、兩小節一行放不下時交給 OSMD 換行(縮放 0.55)
  - 檢定頁:「練習這一級」/「練習 Playback 看譜」只在模擬考卡上(規格卡底下不放);Trinity 視奏卡寫明 Rock & Pop 沒有視奏、App 那一段縮成「App:看譜 30 秒 → 跟拍點打 → 聽正確版本(只有拍點)」;
    規格卡每一列的頁碼跟卡片標題一樣就不寫(只標不同的),RSL 跟表重複的大綱附註不放;「準備時節拍器」是模擬考卡標題列右邊的小開關;
    檢定頁出題(xp):模擬考卡 = 標題「這一級的視奏」+ 回到規格 / 開始模擬考(沒有說明、practiceOnly 只在題目卡一次);倒數按了才出現;
    譜下面的出處 / 推估 / 練習設定 / 不出收成 `<details>` 一行「出處與推估(n 項)」(視奏分頁整塊藏起來:自由練習不放出處標記);模擬考進行中模擬考卡不重複題目卡的那句;
    examStatus:RSL 0–5「已練 n 題」、6–8「只列規格」、Trinity「Playback 看譜 n 題」(只算檢定頁出的題目,`stats`;視奏分頁的算在 `cats`)
  - `stage.js`、`random.js` 跟 PianoDrill(`js/sight/stage.js`、`js/sight/generator/random.js`)一模一樣;`fingerprint.js` 只有 `@app` 區段(`fingerprintOf`)不同;三個都列在 `sync.json`
  - 速度:使用者設的速度每一級(檢定頁 `rsl-3`)/ 每個分類的每個難度(視奏分頁 `rhythm-2`)各自記住;RSL 設在官方範圍外才標「練習速度」,Trinity(官方沒寫速度)改了就標「練習速度」、預設 ♩=80 標「練習設定」
  - 測試掛鉤:`__sight.goto(sys, g)`(舊的「視奏分頁某一級」換成同一組參數的分類 + 難度;RSL 6–8 → 檢定頁)、`level` / `setLevel`、`startXp` / `xp`
- 聽力(`js/ear/`,卡片 id 照 PianoDrill 聽音;S12 + S13):子項目 = 題型「過門 Fill / 律動 Groove / 回打 Playback」(`main.js` 的 `@app` 區段;還沒自己選過時 Trinity → 回打、其他 → 過門;
  考試系統換了而且選的題型不適用新系統 → 改成新系統的預設)。
  有選考試時照考試系統與級數(級數只在檢定頁設;不適用的題型只有說明卡 + 規格卡);沒選考試時 Fill / Groove 用 RSL、Playback 用 Trinity,
  級數 = 每個題型的自動難度(`level.js`;難度 n = 第 n − 1 級,從 1 開始;設定卡 `e-levelRow` 的 ▼ ▲、結果下面三顆回饋鈕、節奏回饋自動升降,跟視奏一樣)
  - RSL Fill(`gen.js` 的 `genFill` / `fillOptions`):配拍點聽兩次、各 1 小節預備拍(官方)→ 練習(時間自己定,鼓墊試打不計分)→ 回打(預備拍 1 小節 = 推估;1 個鼓墊)
    → 從 2 / 3 個單線譜選(`e-answers`,每個選項一個 OSMD)→ 揭曉正確的譜 + 節奏練習回饋。♩=70 固定(官方,不能改)
  - RSL Groove(`genGroove`):同流程,兩小節播兩遍(推估)、回打長度一樣(推估)、3 個鼓墊;速度在官方範圍內每題隨機;4–8 級說出風格不出
  - Trinity Playback(`playbackgen.js` 的 `genChart` / `phraseSpec`):看譜 30 秒(官方;「不看譜」= 播放中把譜蓋起來)→ count-in 1 小節(推估)後 App 播一句、
    接著同樣長度只有拍點的空檔回打(空檔不排鼓聲)→ 第一次練習不計分、第二次每一句分開評時間(`scoreLanes` 取那一句的空檔)。
    官方配伴奏音軌,App 只有拍點(畫面註明);速度預設 ♩=80(練習設定,可以改);Improvising 只在檢定頁列規格
  - 播放器的拍用八分音符(`U = 2`):拍點照拍號分組(x/8 附點四分、5/8 = 3+2、7/8 = 2+2+3);RSL 揭曉前不顯示譜(`e-scoreCard` 藏起來)
  - 結果只有「練習回饋」(不出現等第字眼、不換算官方分數);推估 / 練習設定 / 不出的項目收在回打卡最下面的 `<details>` 一行「出處與推估(n 項)」(`e-notesBox` / `e-notes`:出題器 NOTES + `APP_NOTES`);每份譜旁邊有圖例
  - **沒選考試時聽力跟視奏分頁一樣**:不寫考試名稱、級數名、頁碼、practiceOnly、推估標籤(圖例 `plain`、譜卡標題「回打譜」、統計卡寫難度不寫級名、出處區整塊藏起來);
    有選考試時鼓組譜圖例的「待核對」顯示成「App 記法」(資料的 pending 不變)、標籤「4/4(大綱沒寫)」
  - 精簡:還沒聽題目不顯示「準備好了,回打」;回打說明一行「預備拍 1 小節 · 鍵盤 J / F」(觸控不寫鍵盤),Trinity 鼓墊卡只寫鍵盤;「看譜 30 秒」旁的倒數開始才出現;
    Fill 揭曉 = 選項上標出對 / 錯(不再放「正確的譜」與第二份圖例);檢定頁 Groove Recall 卡只留一句流程
  - Trinity 回打的空檔不排鼓聲(`events: []`,評分用每一句自己的 events),也不用 player 的 `gaps`(句首 Flam / Drag 的裝飾音在第一拍之前,gaps 會把它靜音);
    第一次 / 第二次進行中速度鈕不能按;速度每一級各自記(`bpmBy`)
  - 譜卡從檢定頁、說明卡回來要還原(`showPractice`:Trinity 一直有、RSL 揭曉後有),enter 的 rAF 重畫
  - 整組鼓 `audio.loadKit`(進度在題目卡);測試掛鉤 `window.__ear`(`state`、`finishNow`、`expected`…)
- **模擬考**(S14,`js/shared/mock.js`;照 PianoDrill 的 `t-mockBtn` / `e-mockBtn` 與 `.mock-res`):每個模組的檢定頁一張模擬考卡(`#t-mockCard`、`#s-mockCard`、`#e-mockCard`),不做跨模組的整場模擬
  - 技巧(RSL):每一組抽一項(只抽 `pas`、`pattern`;`book` 組顯示「這一組請用檢定書練」並跳過),依組的順序一項一項;官方速度 + 拍點(預備拍 1 小節),
    Debut–3 可選「只聽一小節拍點」(`tech[g].click === "optional"`,p.30 等),4–8 一定跟拍點;只播拍點、不播示範;每項 4 小節(練習設定);Trinity 沒有技巧模擬考(在 Song 3 評;不放模擬考卡,本級要求底下一行字)
  - 視奏:出一題 → 官方準備時間計時,不能暫停、不能提早結束(RSL 90 秒 / Trinity Playback 看譜 30 秒)→ 時間到自動正式打一次;RSL 用這一題的官方速度,Trinity 用自己的練習速度(練習設定);RSL 6–8 沒有模擬考
  - 聽力:RSL = Fill → Groove 各一題(自動聽兩次、不能重聽、不能看答案;練習後回打;Fill 再選譜);Trinity = Playback(看譜 30 秒 → 第一次 → 第二次,自動接下去)
  - 進行中、結果、中止的說明:考試摘要(配分、等第)與規格卡 / 本級要求藏起來;結果只有各項的練習回饋(節奏吻合度、選譜對錯、完成與否),
    **不算總分、不出現 Pass / Merit / Distinction、不換算官方分數**;practiceOnly
  - 中途切分頁、切到背景、重新整理、旋轉螢幕(直式 ↔ 橫式)、換考試 = 中止:不殘留播放與計時,回到檢定頁說明「模擬考已中止」(重新整理靠各模組 localStorage 的 `mockRun` 標記;
    說明的系統與級數用 `mockRun` 存的 {sys, grade}(`mock.who`),不用現在的考試);自動開始的那一步(聽力自動聽題目、Trinity 自動第一次 / 第二次)鼓聲載入失敗 = 中止(`abort("load")`)
  - 按「停止模擬考」= `close()`(不算、回到檢定頁);開始、結果、中止時把模擬考卡捲到頂欄下(`cardToTop`;手機橫式、折疊機才看得到);模擬考中不能換題(視奏的 N 鍵也不行)
  - 準備 / 看譜的倒數照 `performance.now()` 的終點算(主執行緒卡住也不會變慢)
  - 技巧:練習型標「App 依大綱時值排的練習型 · 不是官方譜」(`t-mockMsg`;題目卡標籤只放官方速度與「推估」,組別在下面那一列)、「只聽一小節拍點」鈕不寫頁碼(說明裡有);進行中的說明寫官方速度的頁碼;混合組(pattern + book)結果註明檢定書的項目這次沒練;沒選考試時不顯示模擬考卡(跟視奏、聽力一樣)
  - 進行中、結果也算進練習紀錄(真的打了);測試掛鉤:`__tech.startMock / mockNext / mockFinishRun`、`__sight.startMock / mockSkipPrep`、`__ear.startMock / mockNext / mockSkipStudy`
- **任務腳本** `tools/test/tasks.mjs`(兩個 App 同一份,@app 區段放各自的任務;sync.json markers):模擬真人從打開 App 完成任務,記錄點幾下才開始練、要不要捲動、
  有沒有點到收起來的卡、有沒有下拉選單、點擊區域 ≥ 28、最後的畫面有沒有寫下一步。改版面一定要跑(這一個可以跑,不用跑整套 layout / bilingual)
- **練習紀錄**(`js/shared/practicelog.js`;三個模組同一個格式,PianoDrill 的樣式):三格數字 + 每週目標(`.goal`,最近 7 天的分鐘數;點一下換 15/30/60/90/120/180,預設 60,存各自 localStorage 的 `goal`)+ 最近 7 天
  - 技巧:連續天數 / 今天次數 / 今天分鐘;視奏:連續天數 / 今天題數 / 今天分鐘 + 各分類練過題數與目前難度(`#s-statsCard`);聽力:連續天數 / 今天題數 / 今天正確率(`e-logAcc` = 回打命中的音 + 選對的譜 ÷ 全部)+ 各題型正確率(`#e-statsCard`)
  - 秒數只算真的播放、準備、作答的時間(技巧:預備拍之後的播放;視奏:準備、正式打、聽正確版本;聽力:聽題目、看譜、回打);保留 400 天
  - 紀錄卡、統計卡是練習回饋:檢定頁不放(`app.css` 的 `body.view-exam`,兩個 App 一樣);統計卡沒有資料時整張藏起來(認譜不顯示 `#s-statsCard`);檢定頁三格進度(`examStatus`)只寫進度(會了 n/m、已練 n 題),不寫打中率
- **用麥克風評分節奏**(S15,選用;`js/shared/mic.js` 跟 PianoDrill 逐位元組相同(sync.json same)、`js/shared/micrhythm.js` 是 DrumDrill 自己的):
  視奏「正式打」、聽力「回打 / Trinity 第二次」有「用麥克風評分節奏(選用)」(`s-alongMic`、`e-alongMic`,照 PianoDrill `s-alongMic`),預設關,開關存 `drumdrill.v1` 的 `mic`(視奏、聽力共用,經 ctx 的 `micPref` / `setMicPref`)
  - 錄在播放用的同一個 AudioContext(`createRecorder({ context: audio.ensureAudio })`);getUserMedia 關 echoCancellation / noiseSuppression / autoGainControl;
    網頁版 Safari 17+ 錄音時 `navigator.audioSession.type = "play-and-record"`、錄完還原;App 版不碰,交給原生外掛(`docs/IOS.md` 第 3b 節:`.playAndRecord` + `.defaultToSpeaker` + `.allowBluetoothA2DP`,用完 `.playback` + `.mixWithOthers`)
  - 偵測:`timing.js` 的 `detectHits` = onsets.js 的 `detectOnsets`(**不改 onsets.js**;hop 5 ms、refractory 0.05 秒用參數換算傳進去;分頻帶、分段、補靜音、濾掉大鼓筒鼓的再脹一次,門檻都是練習設定)
  - 評分:全部鼓件合併一條(`MIC_LANES` = `LANES[1]`),只評時間;整體偏移不設上限(`offsetLimit: Infinity`,跟 PianoDrill scoreRhythm 一樣);App 自己被收進去的聲音(預備拍、Trinity App 播的那一句)用 `dropBleed` 拿掉
  - 用麥克風的那一次:鼓墊不出聲、不計分;正式打 / 回打的空檔不放拍點(只有預備拍;拍點跟真的鼓同時響分不開)
  - 拒絕權限 / 沒有麥克風 / 不支援:這一次照觸控鼓墊評分,開關下面與結果說明原因,其他功能不受影響;開關不自己關掉
  - 開關下面一行「在真的鼓上打,只聽時間;不存檔、不上傳。」,打開以後才多一句(鼓墊不出聲、只有預備拍)
  - 整段錄完才在裝置上分析,**不存檔、不上傳**;結果標「練習回饋 · 節奏(麥克風)」+ 一行「只評時間(麥克風,全部鼓件一條)· 練習回饋,不是考試分數」
  - 開麥克風時 AudioContext 被打斷(iOS 切換工作階段,外框 leave + enter):`mic.bumped` 而且還在同一題就照樣開始;正在打開(`mic.opening`)時 stopAll 不 cancel
  - 隱私權頁(`privacy.html`)、`docs/IOS.md`(NSMicrophoneUsageDescription 中英文、實機第 17–20 項)要跟著改
- **整組鼓所有權**(`js/shared/audio.js` 的 @app 區段):視奏、聽力 enter 時 `audio.holdKit(名字)`、leave 時 `audio.dropKit(名字)`;
  沒有人拿著才開始 60 秒計時,到時 `unloadKit()`(小鼓保留),計時中有人拿起來就取消(聽力 ↔ 視奏切換不釋放)。
  載入中被釋放("kit unloaded")不是失敗:在模組裡就靜靜重新載;模組記 `kitGeneration()`,變了就重新 loadKit
- **無障礙**(S16;`js/shared/a11y.js`,`node tools/test/a11y.mjs` 檢查):
  - 鼓譜(OSMD 的 SVG)讀不到 → 容器 `role="img"` + `aria-label`(`imgLabel(el, fn)`,fn 用 `tr()`,換語言自動重算;沒有譜時 `imgLabel(el, null)`):
    技巧 `#t-osmd`(`score.js` 的 `label` 選項)= 標題 + 一輪的左右手(Flam / Drag、重音、多次反彈、休止)+ 反覆次數;
    視奏 `#s-score`、聽力 `#e-osmd` = `describeSpec`(N 小節小鼓譜 / 整組鼓譜、拍號、速度、每小節的簡述);聽力選項按鈕「選項 A:…」帶譜的說明;圖例(`drawLegend`)= 鼓件清單
  - 播報只用一個 `aria-live="polite"` 區(`#srLive`,`announce(text)`):播放 / 停止、準備與看譜開始(幾秒)/ 時間到、正式打 / 回打開始、結果摘要、模擬考結束 / 中止(`mock.js`);同一瞬間的幾句接在一起念(不互相蓋掉);
    **不播報**倒數的每一秒、預備拍的每一下、每一句的進度、載入百分比(模組的 `say(fn, …, quiet)`);卡片、結果不要再加 `aria-live` / `role=status`
  - 鼓墊 `aria-label` 帶按鍵(「小鼓(鍵盤 J / F)」)+ `aria-keyshortcuts`;▶ 播放中 `aria-label` = 停止;分段鈕、級數格、選擇器的列 = `role="group"` + 名稱 + `aria-pressed`
  - 外框(main.js 共用部分,PianoDrill 同一份):分頁列 tablist / tab + `<main>` tabpanel、roving tabindex、方向鍵 / Home / End;第一次的問題:焦點進去、Tab 只在對話框 + 頂欄右邊的主題 / 語言鈕之間轉、Esc = 自由練習、背景(內容、分頁列)inert、關掉回原處;重畫一排按鈕時焦點留在同一顆(`keepFocus`);
    鍵盤聚焦在按鈕上時空白鍵 / Enter 是按那個按鈕(`:focus-visible` 判斷;滑鼠點過的照舊是播放)
  - `app.css`(兩邊同一份):`:focus-visible` 焦點框;字級代幣是 rem(根字級 17px,iOS 用 `-apple-system-body` 跟著系統文字大小;內文最多 2 倍、控制項最多 1.3 倍);
    新的字級用 `var(--fs-…)`,不要寫死 px 也不要用 rem 當長度;控制項高度用 `min-height`、放不下換行不截字;分頁列、鼓墊的字級固定(不放大,跟 iOS 的分頁列一樣)。`layout.mjs` 有「字級 200%」的狀態
  - 文字對比 ≥ 4.5:1(大字 3:1;深淺兩種主題,`a11y.mjs` 量實際背景);改顏色代幣要兩邊同步並看截圖
- **精簡**(2026-10 使用者要求;兩個 App 一樣):同一件事一個畫面只說一次;收起來的設定列(`#t-picker`、`#s-setup`、`#e-setup`)只寫題目卡標題 / 標籤沒有的(例如「♩=80 · 節拍器 開」);
  沒選考試時(自由練習的分頁)不寫考試名稱、級數名、頁碼、practiceOnly(視奏分頁、聽力都是;PianoDrill 同一條);
  頁尾兩行:一行簡短出處 +「授權與出處 · 隱私權政策 · 支援」(完整內容在 `licenses.html`);聽力「看答案」聽過一次題目才出現、答完藏起來,「下一題」是次要按鈕(模擬考裡才是主要)
- 技巧分頁(精簡):速度卡副標「建議:慢 → 快 → 慢」、拍點燈號在 BPM 數字那一行右邊、「每輪加快 4」只在開了循環播放時出現;選擇器的起手 / 反覆列平分整行;
  檢定頁本級要求:開頭一句「名稱後面寫時值的是 App 依大綱排的練習型,不是官方譜(RSL p.42)」,組的速度 / 頁碼跟前一組一樣就不寫,同一段附註第二次縮成「配置見檢定書」
- 視奏、聽力的結果(精簡):固定說明一行「只評時間 · 練習回饋,不是考試分數」;「漏打 / 多打」;結果不要卡中卡(上面一條線分開);打完結果沒露出來就自動捲過去;
  圖例格子約 52px(iphone-390 一行 6 格),只有小鼓一個鼓件(單線譜)時改成一行字「圖例:單線 = 小鼓」(檢定頁加出處),圖例下那行「記法以譜上的圖例為準」;
  視奏速度卡的「回到預設 / 回到官方速度」只在自己改過速度時出現;寬畫面(≥1100)鼓墊卡在左欄
- 中英雙語(預設英文,切過就記住):外框字串 `js/shared/i18n.js`、技巧 `js/tech/strings.js`(前綴 `tech.`)、視奏 `js/sight/strings.js`(前綴 `sight.`)、聽力 `js/ear/strings.js`(前綴 `ear.`);程式產生的文字用 `tr("中", "EN")`
- 用詞:「檢定」「考試」,不用「考級」(只有 App Store 關鍵字可以放)
- localStorage:`drumdrill.v1`(外框;`mic` = 麥克風評分開關)、`drumdrill.tech.v1`(技巧:熟練度、速度、`log`、`goal`、`mockOneBar`、`mockRun`)、`drumdrill.sight.v1`(視奏:節拍器 / 拍點開關、`bpmOverride` 練習速度(`rsl-3`、`trinity-4`、`rhythm-2`)、
  出題歷史、`stats`〔"rsl-3": {n, hits, total}〕檢定頁各級練過幾題、`cats`〔rhythm: {n, hits, total}〕視奏分頁各分類、`level` / `streak`(自動難度)、`log`、`goal`、`mockRun`、譜面排法;讀進來先消毒)、`drumdrill.ear.v1`(聽力:`level` / `streak`(沒選考試時各題型的難度;舊版的 `grades`、`examSeen` 丟掉)、Trinity 每一級的練習速度 `bpmBy`(`trinity-4`)、`hideChart`、
  `stats`〔"rsl-3-fill": {n, picks, ok, hits, total}〕、`log`〔日期: {n, sec, hits, total}〕、`goal`、`mockRun`;讀進來先消毒)、`drumdrill-lang`(語言)。
  `log` 的格式三個模組一樣:`{ "YYYY-MM-DD": { n, sec } }`,聽力另外有 `hits`、`total`(今天正確率);三個模組讀進來都用 `cleanLog` 消毒(技巧在 `js/tech/store.js`);`mockRun` = 進行中的模擬考標記(正常結束拿掉;重新整理後還在 = 說明「模擬考已中止」)

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
  - 熟練度按鈕 = 圖示 + 小字「會了 / 再練」(Got it / Needs work;兩個 App 一樣;清單圖例只寫會了 / 再練,不寫「還沒標」);DrumDrill 模擬考進行中藏起來(只管打)
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
- **視奏譜面要像印出來的考卷**(照 PianoDrill 的 fitScore):每行目標 4 小節(整除優先、不留單獨一小節,太密才退到 2),再縮放到放得下寬度;
  整份在「樂譜卡捲到頂欄下」時一眼看完,放不下再縮,但不小於 0.55(每行 2 小節的最後手段 0.45);同形狀的題目沿用同一個排法與大小(只縮不放大)。
  同形狀 = 系統與級數、小節數、拍號、寬度分級。小鼓單線譜 / 整組鼓五線譜都用 `kitnotation.js` + OSMD compacttight + `legend.js`(圖例一定要有,格子 = 這一題用到的鼓件)
- **中英文版面要一模一樣**:英文長就縮短文字;段落用 `pairText`;標籤數量兩種語言一樣;打法清單用固定格子(最多兩行)
- 快取:改了 css/js/data 一定要跑 `node tools/build/stamp.mjs`(index.html 的 importmap 與 ?v= 版本指紋;verify 會檢查)

## 工作方式
- 改好、測試沒問題就直接 push 到 main(使用者要求,不用另開分支)
  - 雲端工作階段依指定分支(目前是 `claude/text-overflow-issue-52hnyj`,不推 main)
- 測試:
  - `node tools/test/verify.mjs`(不用瀏覽器):基本打法照 PAS 官方表、MusicXML、`checks/examdata.mjs`(考試資料 + 手抄核對)、
    `checks/pattern.mjs`(RSL 練習型)、`checks/gen-sight.mjs`(視奏出題器:每級 1000 個種子)、`checks/sight-meter.mjs`(視奏拍點時間軸、指紋)、`checks/appsamples.mjs`(App 取樣數)、版本指紋、`sync.mjs`(跟 PianoDrill 的共用檔案;`PIANODRILL=…`)
  - 瀏覽器(`cd tools/test && npm i` 一次;Playwright):`node layout.mjs`(19 種尺寸)、`node bilingual.mjs`(中英版面)、`node clip.mjs`(文字被切掉)、
    `node human.mjs 150 3`(模擬真人操作)、`node playback.mjs`(播放排程與停止)、`node pad.mjs`(觸控鼓墊)、
    `node notation.mjs`(OSMD 實際畫譜:40 個打法、鼓組樣張、視奏小鼓譜與整組鼓譜)、`node a11y.mjs [尺寸]`(無障礙:譜的說明、名稱、重複 id、aria-live、群組與分頁、焦點、對話框、播報、對比)、`node kitaudio.mjs`(整組鼓取樣;視奏、聽力離開 60 秒釋放、互相切換不釋放、載入訊息不蓋結果);
    `node mic-check.mjs`(麥克風:Chromium 假麥克風 + Naked Drums 取樣混成的 wav;node 側偵測誤差中位數 ≤ 5 ms、漏偵 ≤ 2%;準時 / 偏晚 / 打開時被打斷 / 亂打 / 沒聲音 / 拒絕權限、整組鼓、聽力 Fill、Trinity 第二次;`ONLY=node|sight|ear`);
    layout / bilingual / clip / human 都有模擬考的狀態(`mockTour`:技巧 RSL 3、視奏 RSL 3 / 4 與 Trinity 4、聽力 RSL 4 與 Trinity 4 × 進行中 / 結果 / 中止;human 的「模擬考中途中止」);
    layout / bilingual / clip / human 都有視奏、聽力的狀態(視奏:RSL 0、3、4、5、6,Trinity 0、4、8 × 準備 / 作答 / 結果 / 正確版本;Trinity 一首很長,測試用 `__sight.finishNow()` 提早出結果;
    聽力:human 的「照節奏回打」要「準」);playback.mjs 有視奏、聽力(換語言不停播、Trinity 空檔只有拍點)
  - 重構前後畫面要一樣:動手前 `node shots.mjs --save`,改完 `node shots.mjs --compare`(19 種尺寸 × 技巧四類 + #40×8 + 檢定頁 × 中英,逐像素比對)
  - `tools/test/notation-preview.html?n=1,2,3`:把指定的打法畫出來,跟官方表對照;`?pattern=rsl-7-A`(或 `rsl-7`):RSL 練習型
- 上架:`docs/APPSTORE.md`;App Store 關鍵字不放 Trinity、RSL、Rockschool(考試機構的商標)
