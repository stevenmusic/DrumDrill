# 上架 App Store 準備(DrumDrill 爵士鼓檢定特訓)

> 這份是 **App Store Connect 要填的內容與送審準備**;iOS 原生步驟(Xcode、AppDelegate、Info.plist、隱私清單、TestFlight、實機檢查清單)在 `docs/IOS.md`。
> PianoDrill 的 `docs/APPSTORE.md` 用同一個格式(章節一樣,內容各自的)。查證日期 2026-10-18。
> **送審前對照 Apple 現行規格(截圖尺寸、年齡分級問卷)**:這兩項 Apple 常改,以 App Store Connect 當時的畫面為準。

## 1. 這邊已經準備好的

| 項目 | 位置 / 內容 |
|---|---|
| iOS 外殼(Capacitor 8) | `app/capacitor.config.json`、`app/package.json`;Bundle ID `io.github.stevenmusic.drumdrill` |
| 把網頁複製成 App 內容 | `cd app && npm run www`(= `tools/build/app-www.mjs`:複製網頁、**拿掉 Google Fonts 改用系統字型**、寫入版本號、打包取樣);`node tools/test/app-www.mjs` 檢查完整 |
| 取樣打包進 App | `tools/build/app-samples.mjs`:iOS App(iPhone 與 iPad)一律走小記憶體,每層只帶 App 會用到的 round-robin(跟 `js/shared/audio.js` 的 `RR_LIMIT` / `KIT_RR` 一樣,`verify.mjs` 核對):技巧的小鼓 5 層力度 × 6 個 + 整組鼓 12 個鼓件(鼓皮每層前 3 個、鈸每層前 2 個)+ 拍點 + 鼓房殘響,104 個取樣檔(另有 `drums/manifest.json`)、10.9×10⁶ 位元組(小鼓 2.1、ride 2.3、crash 1.8、hhOpen 0.9、tom5 0.7、kick 0.7、tom3 0.6、rideBell 0.6、tom1 0.5、hhClosed 0.4、xstick 0.1、hhPedal 0.1、殘響 0.05)。第一次要連網下載到 `tools/build/samples/` |
| 版本號 | repo 根目錄的 `VERSION`(1.0.0);app-www 寫進 Xcode 的 `MARKETING_VERSION`,build 號 = git commit 數(`docs/IOS.md` 第 6 節) |
| App 圖示 | `icons/icon-1024.png`(金底小鼓 + 勾)、`icon-1024-dark.png`、`icon-1024-tinted.png`;`cd tools/test && node icons.mjs` 重新產生 |
| 隱私權政策(中英) | `privacy.html` → `https://stevenmusic.github.io/DrumDrill/privacy.html` |
| 支援頁(中英) | `support.html` → `https://stevenmusic.github.io/DrumDrill/support.html`(常見問題、GitHub 回報;支援信箱設好才顯示寄信) |
| 授權與出處(中英) | `licenses.html`(Naked Drums CC BY 4.0 + 修改說明、OSMD BSD-3 全文、PAS 出處、商標聲明) |
| 麥克風 | **目前版本未開放**(畫面藏起來,之後再開;隱私權頁也這樣寫):**1.0 不帶麥克風權限**:不加 `NSMicrophoneUsageDescription`、不做 AudioSession 外掛、不測實機第 17–20 項(`docs/IOS.md` 第 0、3b、4、8 節)。之後開放時(視奏「正式打」、聽力「接著打」可選用,S15)再照 `docs/IOS.md` 第 3b、4 節加 |
| 商店截圖 | `app/screenshots/{zh,en}/`:iPhone 6.9 吋 1290×2796、iPad 13 吋 2064×2752 各 5 張(真實畫面、沒有透明通道);`node tools/test/appshots.mjs` 重新產生(第 7 節) |

## 2. 2026 年的硬性規定(先看)

- 2026-04-28 起,上傳的版本必須用 **Xcode 26 / iOS 26 SDK** 建置;Capacitor 8 最低 iOS 15(`docs/IOS.md` 第 1、2 節)。
- 年齡分級改成 4+ / 9+ / 13+ / 16+ / 18+,問卷題目也改了(第 8 節)。
- 歐盟要先在「商務」填 **DSA 交易者身分**,沒填不會在歐盟上架(`docs/IOS.md` 第 1 節)。

## 3. App 資訊

| 欄位(上限) | English (U.S.)(主要語言) | 繁體中文 |
|---|---|---|
| 名稱(上限 30 字元) | DrumDrill: Drum Kit Exam Prep(29) | DrumDrill 爵士鼓檢定特訓(17) |
| 副標題(上限 30 字元) | Rudiments, Reading & Aural(26) | 基本打法、視奏、聽力一次練好(14) |
| 類別 | 教育 Education(次要:音樂 Music) | 同左 |
| 價格 | 免費、沒有內購、沒有廣告 | 同左 |

- 括號裡是實際字數(2026-11-07 量;空格、標點都算一個字)。Apple 上限:名稱 30、副標題 30、關鍵字 100 bytes、描述 4000 字元。
- 名稱在 App Store 必須是唯一的;被用掉就改成「DrumDrill – Drum Exam Trainer」之類,中文名稱不變。
- 用詞:App 內一律「檢定」「考試」;「考級」只放在關鍵字(有人這樣搜尋)。

## 4. 描述

**繁體中文**
> 每天 10 分鐘,跟著打就會。剛開始學爵士鼓的人、準備爵士鼓檢定的學生、上課的老師,或只想把基本功練好的鼓手都可以用。
> 今日練習:App 每天排好約 10 分鐘(暖身、律動路線、過門路線、複習),從「跟拍點數拍」開始一關一關往上;真實鼓聲示範,速度從慢慢加到目標,打穩了就過關,過關的會照日子拿出來複習。沒有鼓也可以用手機當鼓墊打。漏練幾天沒關係,不會扣分。
> 技巧:Percussive Arts Society(PAS)40 個國際標準基本打法,照官方表重新繪製鼓譜、每個音標左右手;真實鼓聲示範、預備拍,速度可以慢慢加,循環播放時每輪自動加快。
> 視奏:依考試大綱的參數產生小鼓與整組鼓的視奏練習題,難度自動調整;用觸控鼓墊打一遍、看節奏的練習回饋,再聽正確版本。
> 聽力:聽一段過門或律動、照節奏打一遍,再從譜裡選出聽到的那一個;也有「聽一句、打一句」的接著打練習。
> 檢定:選好考試系統和級數一次,技巧、視奏、聽力都照這一級;每一項要求都標出大綱頁碼。模擬考照大綱的準備時間與速度,一項一項打完,只看練習回饋、不算分數。支援 Trinity Rock & Pop 與 RSL Rockschool 爵士鼓檢定的練習(Trinity、RSL Rockschool 為各自的商標,本 App 與其無關;僅供練習,實際要求以官方大綱為準)。
> 練習紀錄:連續天數、每週目標、最近 7 天練了幾天。
> 鼓聲內建在 App 裡,不用網路也能用;不需要登入、沒有廣告、不收集任何資料。

**English**
> 10 minutes a day. Play along. For beginners, drum kit students preparing for a grade exam, teachers, and any drummer who wants solid fundamentals.
> Today: the app plans about 10 minutes each day (warm-up, a groove route, a fill route and review), starting from "Count along" and moving up level by level. Real drum demos, a tempo that climbs slowly to the target; play it steadily to pass, and passed levels come back for review. No drums? Tap along on your phone. Missed days are never penalised.
> Technique: all 40 Percussive Arts Society (PAS) International Drum Rudiments, re-engraved from the official sheet with sticking under every note; real drum sounds, count-in, and a tempo you can raise step by step, speeding up each time it loops.
> Sight-reading: snare and full-kit reading tests generated from the syllabus parameters, with difficulty that adjusts to you; play them on the touch pads for rhythm feedback, then hear the correct version.
> Aural: hear a fill or groove, play it in time and pick the matching chart; plus Echo, a listen-and-play-back exercise.
> Exams: set your board and grade once and technique, sight-reading and aural all follow it, with a syllabus page reference for every requirement. Mock exams follow the syllabus prep times and tempos item by item, with practice feedback only (no marks). Practice for Trinity Rock & Pop and RSL Rockschool drums exams (Trinity and RSL Rockschool are trademarks of their owners; this app is not affiliated with them. Practice only — the official syllabus is final).
> Practice log: day streak, weekly goal and the last 7 days.
> Drum sounds are built in and work offline. No sign-in, no ads, no data collected.

- 字數(Apple 上限 4000 字元):繁體中文 635 字、English 1669 字元(2026-11-07 量;改描述要重量)。
- **描述只寫 App 裡真的有的功能**(審核 2.3.1);麥克風評分目前版本未開放,描述不提。
- 宣傳文字(Promotional Text,170 字,可以隨時改不用送審):先留空,有新功能時再寫。

## 5. 關鍵字(上限 100 bytes,逗號分隔、不重複名稱裡的字)

- 上限算的是 **UTF-8 位元組**:中文一個字 3 bytes、英文與逗號 1 byte(2026-11-07 量的數字寫在後面;改了要重量)。

- **繁體中文**:`打鼓,練鼓,鼓譜,鼓組,基本打法,滾奏,視奏,聽力,節奏,節拍器,考級,rudiments,flam`(50 字、100 bytes;舊版 135 bytes 超過上限,拿掉「複點」「打擊」「paradiddle」「drum exam」)
- **English**:`rudiments,paradiddle,flam,drag,drumming,snare,sight reading,aural,rhythm,metronome,grade,groove`(95 bytes)
  - 名稱「DrumDrill: Drum Kit Exam Prep」已經有的 `drum kit`、`exam` 不再放(名稱的字本來就會被搜尋到,重複只浪費字數),換成 `snare`、`groove`。
- **不放考試機構與其他組織的名稱**:Trinity、RSL、Rockschool、ABRSM、PAS(審核 2.3.7:關鍵字不能放別人的商標;本 App 與它們無關,放了容易被當成冒用而退件)。

## 6. 審核備註(App Review Information ▸ Notes,貼英文)

```text
- No sign-in, no account, no network needed: all drum samples, notation engine and exam data are inside the app. It works fully offline from the first launch.
- Exam board names (Trinity College London "Rock & Pop", RSL Rockschool) are used only to describe which syllabus the practice follows. This app is not affiliated with, endorsed by, or sponsored by them; it uses none of their logos, colours or copyrighted test material. Every requirement shown cites the public syllabus page, and screens say "Practice only — the official syllabus is final."
- Rudiments follow the Percussive Arts Society (PAS) International Drum Rudiments (© 1984 PAS); the notation is re-engraved by the app for practice. PAS is a trademark of its owner and is not affiliated with this app.
- Sight-reading and aural tests are generated on the device by the app from the syllabus parameters (time signatures, note values, tempo ranges). They are not official test pieces.
- Native functionality beyond a web page: native audio session (plays with the silent switch on), bundled multi-velocity drum samples with on-device mixing, interactive touch drum pads with rhythm feedback, generated exercises, offline use.
- Microphone: not used in this version (the feature is switched off, and the app does not request microphone permission — there is no NSMicrophoneUsageDescription). When it returns (optional): only in Sight-reading "Perform" and Aural "Echo", only after the user ticks "Score my rhythm with the mic" and allows access; audio is analysed on the device for stroke times only and never recorded or uploaded. Declining keeps every other feature working (the touch pads are used instead).
- No data is collected; no tracking; no analytics or advertising SDKs. Practice settings stay on the device.
- How to test: on first launch tap "Start practicing"; the Technique tab opens on Today — tap "Start today's practice" and press ▶ (or "No drums? Use phone" to use the touch pads). Then open Exams, choose a board and grade, and try Sight-reading and Aural.
```

- 聯絡資訊填自己的姓名、電話、Email(只給審核員看,不公開)。
- 不需要示範帳號(沒有登入)。
- 如果還是被以 4.2(最低功能)退件:可以加原生功能,例如每日練習提醒(`@capacitor/local-notifications`)、觸覺回饋(`@capacitor/haptics`);加外掛要同步更新隱私清單。
- 如果被以 5.2.1(智慧財產)問考試機構名稱:回覆上面第 2 點,並附寄給 Trinity、RSL、PAS 的說明信紀錄(見第 13 節)。

## 7. 截圖清單(真實畫面,中英各一套)

| 尺寸 | 像素(直式) | 狀態 |
|---|---|---|
| iPhone 6.9 吋 | 1320×2868(或 1290×2796、1260×2736) | **做好了**:1290×2796(430×932 × 3) |
| iPhone 6.5 吋 | 1284×2778(或 1242×2688) | 不另外做(有 6.9 吋就不是必填;Apple 會縮給較小的裝置) |
| iPad 13 吋 | 2064×2752(或 2048×2732) | **做好了**:2064×2752(1032×1376 × 2) |

- 每個尺寸 1–10 張,PNG / JPEG,**不能有透明通道**(Playwright 存的 PNG 是 RGB)。Apple 會把最大尺寸縮給較小的裝置用。
- Apple 的規格頁(2026-10)同時寫了「iPhone 至少一張 Dynamic Island(中尺寸,6.3 吋 1206×2622)」;上傳時看 App Store Connect 實際要求哪一格,要的話在 `appshots.mjs` 加一個 402×874 × 3 的尺寸。
- 一定要是 App 的真實畫面(審核 2.3.3),不要放考試機構的標誌;可以加簡短的說明文字,但不要寫「官方」。
- 5 張(中英同一組畫面、同一題;檔名 `app/screenshots/{zh,en}/{iphone,ipad13}-n-名稱.png`;照 PianoDrill 的順序,今日練習放第一張):
  1. `1-today` 今日練習開始後:律動 8 / 30「大鼓加在 3&」(題目卡 + 重點 + 鼓譜(標示左右手)+ 圖例 + 鼓墊)
  2. `2-paradiddle` 技巧:#16 Single Paradiddle(鼓譜、R / L、速度卡)
  3. `3-sight` 視奏:鼓組譜 8 小節(圖例 + 鼓墊)
  4. `4-ear` 聽力:過門(聽一遍、照節奏打回來後「哪一個是剛才的過門?」A / B 兩份譜)
  5. `5-exam` 檢定:RSL 3 級(考試卡 + 本級要求清單)
- 產生方式:`node tools/test/appshots.mjs` 重新產生(Playwright;固定亂數種子讓中英、iPhone / iPad 同一題;練習紀錄與今日練習進度塞幾天假資料,紀錄卡與路線才不是空的)。改了畫面就重跑一次,上傳前每張看過:載入完、沒有「載入中」、沒被切掉。

## 8. 年齡分級

新制問卷(2025 年改版;每一題照實回答):
- 暴力、性、髒話、恐怖、藥物酒精菸草、賭博、競賽:**沒有**
- 醫療或健康資訊:**沒有**
- 使用者產生的內容、使用者之間的通訊、在 App 內不受限制地上網:**沒有**(頁尾、支援頁的 GitHub 連結會打開外部的 Safari,不是 App 內瀏覽器)
- 內購、廣告、AI 產生內容:**沒有**
- 家長控制、年齡驗證:**沒有**

預期結果 **4+**。

## 9. App 隱私

- **Data Not Collected(不收集任何資料)**:沒有分析、沒有當機回報 SDK、沒有帳號;練習紀錄只存在裝置上。
- 跟 `PrivacyInfo.xcprivacy`(全部空的,`docs/IOS.md` 第 5 節)、`privacy.html` 一致。
- 1.0 不用麥克風(沒有麥克風權限);之後開放時也只在裝置上分析敲擊的時間、不存不傳,不算「收集」。
- App 版不載入 Google Fonts(app-www 拿掉了);網頁版的 Google Fonts、GitHub 取樣下載寫在 `privacy.html`。
- 隱私權政策網址:`https://stevenmusic.github.io/DrumDrill/privacy.html`

## 10. 網址

| 欄位 | 網址 |
|---|---|
| 支援網址(必填) | `https://stevenmusic.github.io/DrumDrill/support.html` |
| 行銷網址(選填) | `https://stevenmusic.github.io/DrumDrill/` |
| 隱私權政策(必填) | `https://stevenmusic.github.io/DrumDrill/privacy.html` |

## 11. 版本說明(What's New)

- 1.0 第一版不用填。
- 之後的範本(兩種語言都要):
  - 中文:`修正:…;新增:…。考試資料核對到 <大綱版本>。`
  - English:`Fixes: … New: … Exam data checked against <syllabus edition>.`
- 考試資料改了一定要寫,因為網頁版會先更新,App 要等這一版。

## 12. 價格與供應地區

- 免費,沒有內購(收費會讓商標與 PAS 版權的風險變高,先不做)。
- 供應地區:**中國大陸**上架需要 ICP 備案(據審查員所知,未查證),沒有備案就在「價格與供應」取消勾選中國大陸。
- 簡體中文:目前沒有,簡中使用者看到英文介面。

## 13. 授權與商標提醒

- 鼓聲 Naked Drums(Wilkinson Audio,CC BY 4.0)、OSMD(BSD-3-Clause):`licenses.html` 有授權連結、修改說明、BSD 全文;頁尾有署名。
- PAS 基本打法:鼓譜由 App 依官方寫法重新繪製,標出處;不收費。
- 考試大綱只整理「要求的參數與頁碼」,不含官方譜例、不貼原文句子;視奏、聽力題目由 App 產生。
- Trinity、RSL Rockschool、PAS 是各自的商標:描述只當說明用途,頁尾與 `licenses.html` 註明無關;App 圖示不用它們的標誌或配色。
- 建議(審查意見 C10):寫信給 Trinity College London、RSL、PAS 說明用途(免費練習工具、不用標誌配色),留著寄信紀錄,審核問起時可以附上。

## 14. 實機測試結果

照 `docs/IOS.md` 第 8 節的第 1–16 項(第 17–20 項是麥克風,1.0 沒有麥克風權限、不測),用 TestFlight 版測完把結果填在這裡(✓ / ✗ + 備註)。

| # | iPhone SE | 一般 iPhone | iPad | 備註 |
|---|---|---|---|---|
| 1–16 | 未測 | 未測 | 未測 | |

## 15. 需要你自己做或決定的

1. Apple Developer Program 帳號、App Store Connect 的 App 記錄、DSA 交易者身分。
2. 在 Mac 上照 `docs/IOS.md` 做:`cap add ios`、AppDelegate、Info.plist(1.0 不加麥克風、不做第 3b 節的 AudioSession 外掛)、InfoPlist.strings、PrivacyInfo.xcprivacy、圖示、Archive、TestFlight。
3. 實機測試(第 14 節),特別是「邊放音樂邊練」(`docs/IOS.md` 第 3 節還沒解決的那一點)。
4. 支援信箱:要不要公開一個 Email?要的話填在 `support.html` 的 `APP.EMAIL`(空白時只顯示 GitHub 回報)。
5. 上傳截圖(第 7 節;已產生,上傳前看過一次)、英文名稱是否被用掉(第 3 節)、中國大陸是否上架(第 12 節)。
6. 寄信給 Trinity、RSL、PAS(第 13 節)。
