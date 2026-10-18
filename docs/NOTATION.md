# 鼓組記譜:OSMD 可行性樣張的結論(S5)

> 2026-10-18 實測。引擎 `js/shared/kitnotation.js`(鼓組譜 → MusicXML)、補畫與圖例 `js/shared/legend.js`、OSMD = `vendor/opensheetmusicdisplay.min.js`(2.1.0)。
> 樣張:`tools/test/notation-preview.html?kit=all`(樣張清單 `tools/test/kitsamples.mjs`);
> 自動檢查:`node tools/test/notation.mjs`(符頭數、形狀、高度、補畫記號與位置、連音組數、記號不碰撞、280 寬、圖例出處)、
> `node tools/test/checks/kitxml.mjs`(verify 會跑;時值用 type/dot/time-modification 獨立重算、連音組總長、鼓件、不合法資料一定丟錯、隨機 500 小節)。
> 截圖:`tools/test/out/notation/`(`kit-1000-en.png`、`kit-280-zh.png`、`kit-280-en.png`、`sample-*.png`、`legend5.png`、`legend1.png`、`rudiments.png`)。

## 1. 結論一覽

分三種:**OSMD 可以**(照 MusicXML 寫就畫得出來)、**自己補畫**(OSMD 不畫,`legend.js` 的 `decorate` 照 MusicXML 在 SVG 上補)、**做不到**(出題器一律不出)。

| 記號 | MusicXML 寫法 | 結論 | 備註 |
|---|---|---|---|
| 五線打擊樂譜、鼓件位置 | `<clef><sign>percussion</sign>`、`<unpitched><display-step>` | OSMD 可以 | 13 個鼓件的高度都量過(notation.mjs:符頭中心離最下面那條線幾個半格 = drumkey.json) |
| 單線譜(RSL 小鼓視奏) | `<staff-lines>1</staff-lines>`、E4 | OSMD 可以 | 要維持 OSMD 預設 `PercussionOneLineCutoff = 3`(設 0 的話 E4 畫在線下兩格);小節線、拍號照印 |
| 一般符頭 / ×(鈸)/ 菱形(ride bell)/ 圈 ×(cross stick) | `<notehead>x / diamond / circle-x</notehead>` | OSMD 可以 | VexFlow 字形:一般 vb、× v3e(二分以上 v95)、菱形 v22(實心)、圈 × v3b;notation.mjs 逐一核對數量 |
| 斜線符頭(自由發展小節) | `<notehead>slash</notehead>` + `<stem>none</stem>` | OSMD 可以 | 每拍(複拍子每個附點四分)一個,放在中線 B4(單線譜放在線上) |
| 手 / 腳兩個聲部 | voice 1 `<stem>up</stem>`、voice 2 `<stem>down</stem>`、`<backup>` | OSMD 可以 | 休止符用 `<rest><display-step>` 分開(手 C5、腳 E4;整小節休止 手 D5、腳 G4) |
| 整小節休止 | `<rest measure="yes"/>` + **`<type>whole</type>`** | OSMD 可以 | 沒寫 `<type>` 的話,OSMD 在 7/8 會畫成複附點二分休止符 |
| 和弦(手同時打兩個) | `<chord/>` | OSMD 可以 | |
| 重音 | `<articulations><accent/>` | OSMD 可以 | 手在上、腳在下 |
| Flam / Drag | `<grace slash="yes"/>` 八分 / 兩個 `<grace/>` 十六分 + `<slur>` | OSMD 可以 | 跟技巧的單線譜同一套寫法;裝飾音照主音的鼓件(× 鈸的裝飾音也是 ×) |
| 滾奏(斜線 1–3 條) | `<ornaments><tremolo type="single">n</tremolo>` | OSMD 可以 | |
| 多次反彈滾奏(z) | `<tremolo type="unmeasured">0</tremolo>` | OSMD 可以 | OSMD 會在符桿上畫 z(技巧的單線譜目前是自己補畫 z,之後可以改用這個) |
| 連結線(含跨小節、和弦) | `<tie>` + `<tied>` | OSMD 可以 | |
| 連音數字 3 / 5 / 6 / 7 / 9 / 10、二連音 2 | `<time-modification>` + `<tuplet show-number="actual">` | OSMD 可以 | 每一組都標數字要關掉 `TupletNumberLimitConsecutiveRepetitions`(`setupKit` 會設);有休止符或四分三連音時畫括號。8t3 與 16t3 混在一拍(例如 8t3 16t3 16t3 8t3)是一組「3」(每個音各自的 `<time-modification>`,一個 start / stop;樣張 `tuplets-mixed`)。VexFlow 的連音數字只看符桿頂端、不看記號,`decorate` 會把跟 o、重音疊到的數字往上移 |
| 拍號 2/4 3/4 4/4 5/4 7/4 2/2 3/8 6/8 9/8 12/8 5/8 7/8、換拍號 | `<time>` | OSMD 可以 | 換拍號時行尾有預告拍號;`print-object="no"` 可以不印;C、¢ 符號 OSMD 也會畫(引擎目前一律印數字)。**連桿 / 補休止的分組(待核對)**:x/4、2/2 每個四分音符一組(2/2 是否該照二分音符連桿待依 PAS 指南核對);6/8、9/8、12/8 附點四分一組;5/8 = 3+2、7/8 = 2+2+3(常見寫法,待核對;別的分法要寫分組拍號 `3+2+2/8`) |
| 力度 pp p mp mf f ff sfz | `<direction><dynamics>` | OSMD 可以 | 五線放在譜上方(下方是腳的符桿),單線放在下方;同一個位置只能一個力度(兩個會丟錯)。OSMD 排力度的高度沒算到開 HH 的小圓圈,`decorate` 會把那一行譜上方的力度、漸強線整排往上移(保持對齊) |
| 漸強 / 漸弱(wedge) | `<wedge type="crescendo / diminuendo / stop">` | OSMD 可以 | 跨小節、跨行 OSMD 會自己拆 |
| 閉 HH(+) | `<technical><stopped/>` | OSMD 可以 | OSMD 把 `stopped` 讀成 left-hand pizzicato,畫的就是 +(位置在符桿 / 連桿上方,會跟重音疊好) |
| **開 HH(o)** | `<technical><open/>`(MusicXML 4.0) | **混合做法**(主持人決定) | OSMD 不讀 `<open/>`。MusicXML 維持 `<open/>`;交給 OSMD 前用 `osmdXML(xml)` 換成 `<open-string/>`,OSMD 畫小圓圈並預留位置(跟重音疊放好);`decorate` 把小圓圈藏起來(class `kit-ah`)、在同一個中心補畫清楚的大 o(class `kit-open`)。連結線接續的音不再畫 o(+ 也一樣)。notation.mjs 檢查:o 中心跟符頭中心水平差 < 0.1 符頭高(縮放 0.8 與 1.3)、不碰到力度 / 漸強線 / 重音 / + / 連音數字 |
| **鬼音(括號)** | `<notehead parentheses="yes">` | **自己補畫** | OSMD 不讀 `parentheses`;`decorate` 在符頭兩邊畫 ( )。和弦裡的音照 VexFlow 的 keyProps 找到對的符頭。OSMD 不知道有括號,所以有鬼音的譜 `setupKit(osmd, lines, xml)` 把音符間距放寬(VoiceSpacing ×1.5、+2),連續十六分鬼音的括號才不會擠在一起(notation.mjs 檢查括號不重疊) |
| 平的連桿 | — | OSMD 可以 | 鼓譜慣用平桿:`setupKit` 設 `EngravingRules.FlatBeams = true` |
| 圖例不印譜號 | `<clef print-object="no">` | 自己處理 | OSMD 不管這個屬性,圖例格子把 `.vf-clef` 拿掉 |
| 自由發展小節的 `<measure-style><slash>` | — | 改寫法 | OSMD 不讀 measure-style 的 slash;改成上面的斜線符頭(畫出來一樣) |
| **不規則拍的分組拍號(2+2+3/8)** | `<beats>2+2+3</beats>` | **做不到** | OSMD 只印 7/8,分組只看得出連桿(連桿照分組是對的)。出題器可以出 7/8 照 2+2+3 連桿,但**不能要求譜上印出 2+2+3**。引擎只接受 x/8 的分組、每組 2 或 3 個八分音符(`3+2/4`、`4+3/8` 會丟錯) |
| **一小節反覆記號(%)** | `<measure-style><measure-repeat>` | **做不到** | OSMD 不讀 measure-repeat,畫出來變成「多小節休止 2」(會誤導)。**出題器一律不出**,要反覆就把音符寫出來 |
| **Choke(鈸止音)** | 沒有標準寫法 | **做不到** | 大綱提到 choke cymbal(RSL p.48、54、59),但沒有公開官方寫法;OSMD 也沒有對應記號。**出題器一律不出**,等 PAS 指南或官方範例確認寫法 |
| **半開 HH、rim-shot** | 沒有標準寫法 | **做不到(暫時)** | 同上:寫法待 PAS 指南核對,**出題器一律不出** |

## 2. 官方可確認的 3 項(STAGES.md 決定 3),樣張對照

1. **HH 開 = o、閉 = +、腳踩 HH = × 符頭、符桿朝下** [Trinity DK p.107]:樣張 `piece-hh` 第 3 小節、`open-hh`、`piece-hhOpen`、`piece-hhClosed`、`piece-hhFoot`;
   圖例格子標「Trinity DK p.107」(寫明是 Drum Kit 大綱,不是 Rock & Pop 的書)。
   位置(腳踩 HH 在 D4 線下、手打 HH 在 G5)官方圖上沒有譜線,圖例第二行標「位置待核對 / Pos. pending」。
2. **Ride bell = 菱形符頭,寫在最上面那條線** [Trinity 勘誤 Sweet Emotion]:樣張 `piece-rideBell`、`groove-ride`;F5 就是最上面那條線(notation.mjs 量過高度)。圖例標「Trinity 勘誤 / Trinity errata」。
3. **RSL 初中級視奏只用小鼓** [RSL p.31–43]:單線譜(`lines:1`)只准小鼓(其他鼓件丟出錯誤);樣張 `line1`、`line1-34`;
   單線譜的圖例標「RSL p.31–43」,第二行「單線譜為 App 的選擇 / 1-line: App's choice」(這一格佔兩格寬,兩行都放得下)。

圖例的出處小字一律用 `drumkey.json` 的 `srcs[…].short`(`kitnotation.js` 的 `legendSrc`;待核對的第二行用 `posShort`),
格子 74px 寬最多兩行、中英一樣(notation.mjs 檢查);之後 src 改成 PAS 指南只要在 `srcs` 加一筆帶 `short` 的出處(kitxml.mjs 模擬過,不會出現 undefined)。
其他鼓件的位置都是常見寫法,`drumkey.json` 的 `src:"pending-pas-weinberg"`,圖例格子寫「待核對 / Pending」;圖例下面一律寫「App 採用的記譜方式;考試用書可能不同,以書上圖例為準」。

## 3. 實作重點(給之後的 Stage)

- **OSMD 設定與載入**:建立 OSMD 之後 `setupKit(osmd, lines, xml)`(`legend.js`:五線 `PercussionOneLineCutoff = 0`、單線維持 3;連音每組標數字;平桿;有鬼音時間距放寬),
  再 `osmd.load(osmdXML(xml))`(`kitnotation.js`:`<open/>` 換成 `<open-string/>`)。
- **畫完之後**:`decorate(osmd, xml, svg)`(傳原本的 xml)補畫 o 與鬼音括號、把連音數字與譜上方的力度 / 漸強線移開 o 與重音(每次 render 都要再叫一次,跟技巧的 `drawSticking` 一樣放在 `score.js` 的 `afterRender`)。
- **資料驗證**(`scoreXML` 丟出中文錯誤,含第幾小節、手 / 腳、第幾個):open / closed 只准手打的 hh 類、不能同時;flam / drag 只准手、同一個音或和弦擇一;
  roll / buzz 只准手、時值要八分音符以上(十六分以下含 16t / 32t 連音不可:斜線會跟連桿疊在一起,也不是常見寫法;待依 PAS 指南核對);同一個位置不能兩個力度或兩個漸強 / 漸弱。
- **每一份鼓組譜旁邊都要有圖例**:`drawLegend(el, { pieces: piecesUsed(spec), lines })`。圖例一格 74×88、名稱與出處用 `pairText`,中英版面一樣(notation.mjs 在 280 寬逐格比對)。
- **力度的位置**要對到某個音或休止符的開頭(`beat` = 從小節開頭算幾個四分音符);對不到會丟出錯誤,出題器要放在音上。
- **連音**照時值代號自動分組:同一種比例連續的音是一段,加起來等於段裡某一種的一組長度、而且至少一拍(段裡最長的一組比一拍短時 = 那一組)就結束一組
  → `[8t3,16t3,16t3,8t3]` 一組、`[16t3×3]` 半拍一組、`[4t3,8t3]` 一拍一組、`[4t3×3]` 兩拍一組;要別的分法寫 `tuplet:"stop"`(提早結束,要剛好是一組)或 `tuplet:"continue"`(到了也不結束)。
  連音不能跨小節,也不能在小節中間沒結束就接一般時值。
- **補休止**:手 / 腳沒寫滿一小節會自動補休止符(照拍子分組;4/4、2/2 第 1、3 拍可以合成二分休止符)。樣張自己寫的休止符也照拍子分組(不在 4/4 開頭寫附點二分休止)。
