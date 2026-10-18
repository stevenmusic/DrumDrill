# 上架 App Store 準備(DrumDrill 爵士鼓檢定特訓)

流程跟 PianoDrill 一樣(見 PianoDrill 的 `docs/APPSTORE.md`),差別只有下面這些。

| 項目 | 位置 / 內容 |
|---|---|
| Bundle ID | `io.github.stevenmusic.drumdrill`(`app/capacitor.config.json`) |
| 把網頁複製成 App 內容 | `cd app && npm install && npx cap add ios`(第一次),之後 `npm run sync` |
| 取樣打包進 App | `tools/build/app-samples.mjs`:小鼓 5 層力度 × 10 個 round-robin + 拍點 + 鼓房殘響,約 3.7MB(第一次要連網下載到 `tools/build/samples/`) |
| App 圖示 | `icons/icon-1024.png`(金底小鼓 + 勾)、`icon-1024-dark.png`、`icon-1024-tinted.png` |
| 隱私權政策 | `privacy.html` → `https://stevenmusic.github.io/DrumDrill/privacy.html` |
| 麥克風 | 目前沒有用到,不用加 `NSMicrophoneUsageDescription` |

## App Store Connect 填寫
- **名稱**:DrumDrill 爵士鼓檢定特訓
- **副標題**:40 個基本打法 · 鼓譜與示範
- **類別**:教育(次要:音樂);**年齡分級**:4+;**App 隱私**:不收集任何資料
- **關鍵字**:爵士鼓,打鼓,鼓譜,基本打法,rudiments,paradiddle,flam,滾奏,節拍器,檢定,考級,drum exam
  - 不放 Trinity、RSL、Rockschool(考試機構的商標;本 App 與其無關,放在關鍵字容易被當成冒用而退件)
- **描述**:
  > 爵士鼓的 40 個國際標準基本打法(PAS),照官方表重新繪製鼓譜、每個音標左右手;真實鼓聲示範、預備拍、速度可以慢慢加,
  > 循環播放時每輪自動加快,記住每個打法示範播完的最快速度。準備 Trinity、RSL Rockschool 爵士鼓檢定的學生、上課的老師都可以用
  > (Trinity、RSL Rockschool 為各自的商標,本 App 與其無關)。
  > 鼓聲內建在 App 裡,不用網路也能用;不需要登入、沒有廣告。
