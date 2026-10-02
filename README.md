# AI_Vibe_Coding_MCU_1002_project

本專案致力於 **Vibe Coding** 實戰練習，透過 **Gemini** 與 **Claude Opus 5.5** 雙 AI 協同開發，打造高互動性、視覺效果出色的 3D 網頁遊戲。

## 📁 核心協作與技術文件

* [CLAUDE_OPUS_COLLAB.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/CLAUDE_OPUS_COLLAB.md)：與 Claude Opus 5.5 溝通專用的提示詞模板、分工架構與任務委派手冊。
* [WEB3D_TECH_STACK.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/WEB3D_TECH_STACK.md)：現代網頁 3D 技術體系全景指南（底層 API、渲染引擎、R3F、Rapier、WebGPU 等選型分析）。
* [planning/README.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/planning/README.md)：專案規劃文件（遊戲主題提案、技術決策、階段目標與任務拆解）。

## 🎣 日式海島第一人稱釣魚遊戲

以 Vite + Three.js 製作：三渲二微縮海島場景，加上第一人稱釣魚玩法。規格見 [docs/FISHING_GAME_SPEC.md](docs/FISHING_GAME_SPEC.md)。

```bash
npm install
npm run dev
```

啟動後開啟終端機顯示的網址即可。網址加上 `?debug` 會在左上角顯示狀態機目前的 state。

`npm run build` 會產出單一檔案 `dist/index.html`（CSS 與 JS 全部內嵌），可直接用瀏覽器開啟。

| 輸入 | 功能 |
| --- | --- |
| 點擊畫面（開場時） | 結束環繞，進入第一人稱 |
| 滑鼠移動 | 轉動視角 |
| W A S D／Shift | 移動／加速 |
| 左鍵按住／放開 | 蓄力／拋竿；咬鉤時點擊收竿；張力遊戲中按住收線 |
| 右鍵 | 等待中收回浮標 |
| Tab | 開關圖鑑 |
| Esc | 釋放滑鼠並暫停，點擊恢復 |
| Q | 跳過新手教學（暫停畫面可重看） |

* `src/core/`：共用工具（雜訊、零件合併、卡通材質、描邊後製）。
* `src/world/`：場景內容（地形、底座、海洋、木屋與燈塔、碼頭漁船、植被、魚群、天空）。
* `src/game/`：遊戲邏輯（鏡頭導演、玩家移動、釣竿、浮標與釣線、釣魚狀態機、魚種資料、圖鑑、音效）。
* `src/ui/`：情境式 HUD（準心、蓄力條、張力條、魚卡、圖鑑、暫停畫面）與新手教學。

## 👥 角色分工

* **Gemini**：系統架構、檔案管理、環境配置、後端與排錯整合。
* **Claude Opus 5.5**：前端 3D 視覺（Three.js）、著色器效果、遊戲互動手感與 UI 呈現。
* **開發者 (User)**：導演與試玩評估，給予直覺回饋與方向指引。
