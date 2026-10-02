# 🤝 Claude Opus 5.5 協同開發溝通指南 (Vibe Coding)

本文件是專為本專案在與 **Claude Opus 5.5** 進行溝通、任務委派與前端 3D 網頁遊戲協同開發所建立的專用對話手冊與規格協議。

---

## 🎯 專案基本資訊

* **專案名稱**：`AI_Vibe_Coding_MCU_1002_project`
* **核心理念**：**Vibe Coding** —— 透過自然語言引導、快速原型迭代、重視互動體驗與直覺反饋。
* **開發架構**：雙 AI 協同開發模式
  * **🧠 Gemini**：負責整體架構規劃、專案結構管理、技術評估、規格整理與排錯分析。
  * **🎨 Claude Opus 5.5**：負責發揮強大的前端直覺與代碼生成能力，主力攻堅 **3D 視覺渲染、遊戲物理與手感、著色器光影、UI 介面**。
  * **👤 使用者 (人類導演)**：負責提供靈感、試玩回饋、微調手感與決定遊戲節奏。

---

## 🛠️ 建議技術選型 (3D 網頁遊戲)

本專案已建立完整的 [WEB3D_TECH_STACK.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/WEB3D_TECH_STACK.md) 技術體系指南。為了讓 Opus 5.5 能最快產出高品質、即時可玩的 3D 網頁遊戲原型，建議優先採用以下技術組合：

1. **構建工具**：[Vite](https://vitejs.dev/)（極速熱重載，開箱即用）
2. **3D 核心庫**：[Three.js](https://threejs.org/) 或 [@react-three/fiber](https://r3f.docs.pmnd.rs/)（底層 WebGL 2.0 / WebGPU Renderer）
3. **物理引擎**：[Rapier.js](https://rapier.rs/)（Rust/Wasm 高效剛體動力學）或 [cannon-es](https://github.com/pmndrs/cannon-es)
4. **控制與鏡頭**：Three.js 內建 `OrbitControls` / `PointerLockControls`
5. **UI & HUD**：HTML5 / CSS3（利用絕對定位覆蓋於 3D Canvas 上）
6. **音效庫**：[Howler.js](https://howlerjs.com/) 或 Web Audio API

---

## 🚀 給 Claude Opus 5.5 的首輪對話提示詞 (可直接複製)

> 複製下方區塊內容，直接貼給 Claude Opus 5.5 開啟對話：

```markdown
你好，Claude Opus 5.5！
我們目前正在進行一個學習「Vibe Coding」的專案（AI_Vibe_Coding_MCU_1002_project）。
在本次專案中，我們採用雙 AI 協作模式：
- Gemini 負責架構規劃、版本控制與檔案管理。
- 你（Opus 5.5）將主導前端 3D 網頁遊戲的視覺呈現、Three.js 場景建構、動畫、著色器與遊戲核心玩法手感！

【當前任務：第一階段 - 專案技術起步與遊戲原型提案】
請你針對「適合在瀏覽器流暢運行、視覺衝擊力強、開發迭代快速」的 3D 網頁遊戲，提供：
1. 3 個高吸睛度、適合 Vibe Coding 快速實現的 3D 遊戲核心玩法概念（例如：霓虹風格無限跑酷、微縮星球探索、或低多邊形重力滾球冒險）。
2. 推薦的最小可行性專案架構（包含目錄結構、推薦使用 Vite + Three.js 還是其他搭配）。
3. 一份開箱即用的最小可行性原型（Minimal Viable Prototype）的 index.html / main.js 程式碼，能立即在瀏覽器中看到旋轉光源與帶有基本物理/控制反饋的 3D 物件。

請以熱情且富有創意的 Vibe Coding 風格回覆，並給出具體且模組化的代碼！
```

---

## 📋 日常任務委派溝通模板 (Gemini ➡️ Opus 5.5)

當後續有具體功能需求要請 Opus 5.5 實作時，請使用以下結構填寫並發送給 Opus：

```markdown
### 🎮 任務指派：[功能名稱，例：加入第三人稱跟隨視角與跳躍物理]

**1. 當前進度狀態**：
- 目前已完成：[簡述現有功能，例如已有地板與基本方塊移動]
- 使用技術：Vite + Three.js

**2. 本次需要實作的目標**：
- [具體目標 1]
- [具體目標 2]

**3. 期望的互動與視覺效果 (Vibe 要求)**：
- [例如：跳躍要有緩動彈性、視角轉動要有平滑阻尼感、添加落地粒子效果]

**4. 交付規範**：
- 請給出清晰的模組化代碼（指明放置的檔案名稱與路徑）。
- 若需要安裝額外 npm 套件，請附上安裝指令。
```

---

## 🔄 程式碼交接與工作流 (Workflow)

```
[使用者靈感 / 需求]
        ⬇️
[Claude Opus 5.5] ──實作──> 輸出前端 3D 程式碼、著色器效果、互動手感
        ⬇️
[Gemini] ───────────────> 協助建立檔案、安裝依賴、啟動 Vite 伺服器、Git Commit
        ⬇️
[使用者試玩測試] ─────────> 提供 Vibe 反饋與微調方向（回到第一步）
```

---

## 📝 專案進度追蹤日誌 (Log)

* **[2026-10-02]**：
  * 建立專案資料夾與 Git 存放庫。
  * 建立 [CLAUDE_OPUS_COLLAB.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/CLAUDE_OPUS_COLLAB.md) 協作指南與 [WEB3D_TECH_STACK.md](file:///C:/Users/Student/Desktop/AI_Vibe_Coding_MCU_1002_project/WEB3D_TECH_STACK.md)。
  * **開立分支 `feature/fishing-system`**：已實作完整非 3D 依賴之底層遊戲核心模組：
    * `src/game/fishData.js`：淺灘與深水 6 種魚種完整資料表、出現權重、難度與均勻隨機重量抽取。
    * `src/game/fishingSystem.js`：完整 8 狀態釣魚狀態機（IDLE、CHARGING、CASTING、WAITING、BITING 0.8s 反應窗、REELING 張力小遊戲、CAUGHT、ESCAPED）。
    * `src/game/collectionSystem.js`：圖鑑記憶體紀錄與解鎖進度計算。
    * `src/ui/hud.js` & `src/ui/hud.css`：準心、蓄力條、咬鉤警示「！」、右側張力條與進度條、魚卡彈窗、Tab 圖鑑面板、Esc 暫停。
    * `test_fishing.html`：免 3D 前提之獨立互動測試台，即開即玩即驗證。
    * 規格文件已封存至 `docs/FISHING_GAME_SPEC.md`。
  * **下一步整合（等待 Opus 5.5 3D 完成）**：將 3D 場景點擊拋竿射線與浮標落點判定串接至 `FishingSystem.handlePointerUp({ zone, isLand })`，並將 HUD 疊加在 3D Canvas 上。
