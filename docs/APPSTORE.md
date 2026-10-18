# 上架 App Store 準備(DrumDrill 爵士鼓檢定特訓)

> 這份是 **App Store Connect 要填的內容與送審準備**;iOS 原生步驟(Xcode、AppDelegate、Info.plist、隱私清單、TestFlight、實機檢查清單)在 `docs/IOS.md`。
> PianoDrill 的 `docs/APPSTORE.md` 用同一個格式(章節一樣,內容各自的)。查證日期 2026-10-18。

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
| 麥克風 | 目前沒有用到:**不加** `NSMicrophoneUsageDescription`(S15 加麥克風時才加,見 `docs/IOS.md` 第 4 節) |
| 商店截圖 | **還沒有**(第 7 節的清單;要真實畫面) |

## 2. 2026 年的硬性規定(先看)

- 2026-04-28 起,上傳的版本必須用 **Xcode 26 / iOS 26 SDK** 建置;Capacitor 8 最低 iOS 15(`docs/IOS.md` 第 1、2 節)。
- 年齡分級改成 4+ / 9+ / 13+ / 16+ / 18+,問卷題目也改了(第 8 節)。
- 歐盟要先在「商務」填 **DSA 交易者身分**,沒填不會在歐盟上架(`docs/IOS.md` 第 1 節)。

## 3. App 資訊

| 欄位(上限) | English (U.S.)(主要語言) | 繁體中文 |
|---|---|---|
| 名稱(30 字) | DrumDrill: Drum Kit Exam Prep | DrumDrill 爵士鼓檢定特訓 |
| 副標題(30 字) | Rudiments, Reading & Aural | 基本打法、視奏、聽力一次練好 |
| 類別 | 教育 Education(次要:音樂 Music) | 同左 |
| 價格 | 免費、沒有內購、沒有廣告 | 同左 |

- 名稱在 App Store 必須是唯一的;被用掉就改成「DrumDrill – Drum Exam Trainer」之類,中文名稱不變。
- 用詞:App 內一律「檢定」「考試」;「考級」只放在關鍵字(有人這樣搜尋)。

## 4. 描述

**繁體中文**
> 準備爵士鼓檢定的學生、上課的老師,或只想把基本功練好的鼓手都可以用。
> 技巧:Percussive Arts Society(PAS)40 個國際標準基本打法,照官方表重新繪製鼓譜、每個音標左右手;真實鼓聲示範、預備拍,速度可以慢慢加,循環播放時每輪自動加快。
> 視奏:依考試大綱的參數產生小鼓與整組鼓的視奏練習題,準備時間照大綱計時,用觸控鼓墊打一遍、看節奏的練習回饋,再聽正確版本。
> 聽力:聽一段過門或律動、打回來再從譜裡選出聽到的那一個;也有「聽一句、打一句」的回打練習。
> 檢定:選好考試系統和級數一次,技巧、視奏、聽力都照這一級;每一項要求都標出大綱頁碼。支援 Trinity Rock & Pop 與 RSL Rockschool 爵士鼓檢定的練習(Trinity、RSL Rockschool 為各自的商標,本 App 與其無關;僅供練習,實際要求以官方大綱為準)。
> 鼓聲內建在 App 裡,不用網路也能用;不需要登入、沒有廣告、不收集任何資料。

**English**
> For drum kit students preparing for a grade exam, teachers, and any drummer who wants solid fundamentals.
> Technique: all 40 Percussive Arts Society (PAS) International Drum Rudiments, re-engraved from the official sheet with sticking under every note; real drum sounds, count-in, and a tempo you can raise step by step, speeding up each time it loops.
> Sight-reading: snare and full-kit reading tests generated from the syllabus parameters, timed preparation, play them on the touch pads for rhythm feedback, then hear the correct version.
> Aural: hear a fill or groove, play it back and pick the matching chart; plus call-and-response playback practice.
> Exams: set your board and grade once and technique, sight-reading and aural all follow it, with a syllabus page reference for every requirement. Practice for Trinity Rock & Pop and RSL Rockschool drums exams (Trinity and RSL Rockschool are trademarks of their owners; this app is not affiliated with them. Practice only — the official syllabus is final).
> Drum sounds are built in and work offline. No sign-in, no ads, no data collected.

- S14(模擬考、練習紀錄、進度)合併後,在「檢定」那一句後面補一句模擬考;**描述只寫 App 裡真的有的功能**(審核 2.3.1)。
- 宣傳文字(Promotional Text,170 字,可以隨時改不用送審):先留空,有新功能時再寫。

## 5. 關鍵字(100 字元,逗號分隔、不重複名稱裡的字)

- **繁體中文**:`打鼓,練鼓,鼓譜,鼓組,基本打法,滾奏,複點,視奏,聽力,節奏,節拍器,考級,打擊,rudiments,paradiddle,flam,drum exam`(77 字)
- **English**:`rudiments,paradiddle,flam,drag,drumming,snare,sight reading,aural,rhythm,metronome,grade,groove`(95 字)
  - 名稱「DrumDrill: Drum Kit Exam Prep」已經有的 `drum kit`、`exam` 不再放(名稱的字本來就會被搜尋到,重複只浪費字數),換成 `snare`、`groove`。
- **不放考試機構與其他組織的名稱**:Trinity、RSL、Rockschool、ABRSM、PAS(審核 2.3.7:關鍵字不能放別人的商標;本 App 與它們無關,放了容易被當成冒用而退件)。

## 6. 審核備註(App Review Information ▸ Notes,貼英文)

```text
- No sign-in, no account, no network needed: all drum samples, notation engine and exam data are inside the app. It works fully offline from the first launch.
- Exam board names (Trinity College London "Rock & Pop", RSL Rockschool) are used only to describe which syllabus the practice follows. This app is not affiliated with, endorsed by, or sponsored by them; it uses none of their logos, colours or copyrighted test material. Every requirement shown cites the public syllabus page, and screens say "Practice only — the official syllabus is final."
- Rudiments follow the Percussive Arts Society (PAS) International Drum Rudiments (© 1984 PAS); the notation is re-engraved by the app for practice. PAS is a trademark of its owner and is not affiliated with this app.
- Sight-reading and aural tests are generated on the device by the app from the syllabus parameters (time signatures, note values, tempo ranges). They are not official test pieces.
- Native functionality beyond a web page: native audio session (plays with the silent switch on), bundled multi-velocity drum samples with on-device mixing, interactive touch drum pads with rhythm feedback, generated exercises, offline use.
- No data is collected; no tracking; no analytics or advertising SDKs. Practice settings stay on the device.
- How to test: open the Technique tab and press play; open Exams, choose a board and grade, then try Sight-reading and Aural.
```

- 聯絡資訊填自己的姓名、電話、Email(只給審核員看,不公開)。
- 不需要示範帳號(沒有登入)。
- 如果還是被以 4.2(最低功能)退件:可以加原生功能,例如每日練習提醒(`@capacitor/local-notifications`)、觸覺回饋(`@capacitor/haptics`);加外掛要同步更新隱私清單。
- 如果被以 5.2.1(智慧財產)問考試機構名稱:回覆上面第 2 點,並附寄給 Trinity、RSL、PAS 的說明信紀錄(見第 13 節)。

## 7. 截圖清單(真實畫面,中英各一套)

| 尺寸 | 像素(直式) | 狀態 |
|---|---|---|
| iPhone 6.9 吋 | 1320×2868(或 1290×2796、1260×2736) | 要做 |
| iPhone 6.5 吋 | 1284×2778(或 1242×2688) | 要做(沒有 6.9 吋時才是必填,一起準備比較保險) |
| iPad 13 吋 | 2064×2752(或 2048×2732) | 要做(App 支援 iPad 就必填) |

- 每個尺寸 1–10 張,PNG / JPEG,**不能有透明通道**。Apple 會把最大尺寸縮給較小的裝置用。
- Apple 的規格頁(2026-10)同時寫了「iPhone 至少一張 Dynamic Island(中尺寸,6.3 吋 1206×2622)」;上傳時看 App Store Connect 實際要求哪一格,要的話用同一組畫面輸出 1206×2622。
- 一定要是 App 的真實畫面(審核 2.3.3),不要放考試機構的標誌;可以加簡短的說明文字,但不要寫「官方」。
- 建議的 5 張(兩種語言各一套,語言用頂欄的語言按鈕切):
  1. 檢定分頁:選好 RSL 3 級的考試摘要與要求清單(看得到頁碼與「僅供練習」)
  2. 技巧:#16 Single Paradiddle 的鼓譜(左右手、播放軸)
  3. 視奏:RSL 4 級整組鼓譜 + 圖例 + 觸控鼓墊
  4. 聽力:RSL Fill 的選譜作答
  5. 聽力:Trinity Playback 回打(句子與空檔)
- 產生方式:PianoDrill 有 `tools/test/appshots.mjs`(Playwright 依尺寸截圖),DrumDrill 還沒有,要照它做一支或在模擬器 / 實機截圖。

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

照 `docs/IOS.md` 第 8 節的 16 項,用 TestFlight 版測完把結果填在這裡(✓ / ✗ + 備註)。

| # | iPhone SE | 一般 iPhone | iPad | 備註 |
|---|---|---|---|---|
| 1–16 | 未測 | 未測 | 未測 | |

## 15. 需要你自己做或決定的

1. Apple Developer Program 帳號、App Store Connect 的 App 記錄、DSA 交易者身分。
2. 在 Mac 上照 `docs/IOS.md` 做:`cap add ios`、AppDelegate、Info.plist、InfoPlist.strings、PrivacyInfo.xcprivacy、圖示、Archive、TestFlight。
3. 實機測試(第 14 節),特別是「邊放音樂邊練」(`docs/IOS.md` 第 3 節還沒解決的那一點)。
4. 支援信箱:要不要公開一個 Email?要的話填在 `support.html` 的 `APP.EMAIL`(空白時只顯示 GitHub 回報)。
5. 截圖(第 7 節)、英文名稱是否被用掉(第 3 節)、中國大陸是否上架(第 12 節)。
6. 寄信給 Trinity、RSL、PAS(第 13 節)。
