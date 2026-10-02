# 🌐 現代網頁 3D 技術體系全景指南 (Web 3D Tech Landscape)

本文件整理了現代網頁 3D 技術體系的架構圖譜，從底層繪圖 API、渲染引擎、宣告式框架、物理模擬、格式標準到最新前沿技術（WebGPU、3DGS、Wasm），作為本專案進行架構決策與 Vibe Coding 的技術參考基準。

---

## 1. 底層繪圖 API（標準與硬體加速介面）

瀏覽器本身不具備 3D 場景概念，僅提供底層 API 讓程式碼直接調用裝置 GPU 進行硬體加速：

* **WebGL (1.0 / 2.0)**：
  * 基於 OpenGL ES 規格建構，相容性最高（幾乎 100% 現代瀏覽器支援）。
  * **WebGL 2.0**（基於 OpenGL ES 3.0）支援 Transform Feedback、多重渲染目標 (MRT)、3D 紋理與頂點陣列物件 (VAO)，大幅減輕 CPU 與 GPU 間的通訊瓶頸。
* **WebGPU**：
  * 現代網頁圖形核心演進，設計理念對齊 Vulkan、DirectX 12 與 Metal。
  * **關鍵優勢**：極低的 CPU Overhead、支援多執行緒指令錄製、原生支援 **Compute Shaders（計算著色器）**。不僅能高效渲染數十萬個幾何實體，還可直接在 GPU 上執行物理模擬、粒子系統運算與機器學習推論。
* **WebXR Device API**：
  * 整合 VR/AR 裝置的通用標準，讓瀏覽器可直接接入 Vision Pro、Meta Quest 及手機的空間定位、姿態感測與空間映射。

---

## 2. 主流高階 3D 渲染引擎與函式庫

直接撰寫原生 WebGL/WebGPU 需手動管理著色器（GLSL/WGSL）與緩衝區，門檻極高。常見高階封裝方案：

| 引擎 / 函式庫 | 核心特色 | 適用場景 |
| :--- | :--- | :--- |
| **Three.js** | 網頁 3D 業界標準與基石，生態最成熟、社群最大、擴展插件豐富。 | 品牌互動官網、數據視覺化、產品展示、創意 3D 遊戲。 |
| **Babylon.js** | 微軟主導維護，全功能遊戲級引擎，內建完整物理、音效、動畫、GUI 與除錯工具，對 WebGPU 支援極為領先。 | 網頁 3D 遊戲、複雜建築導覽、數位分身 (Digital Twin)。 |
| **PlayCanvas** | 輕量高效率，搭配雲端視覺化編輯器，注重手機端加載速度與多人協作。 | 輕量級 H5 網頁遊戲、互動式廣告、AR 輕應用。 |
| **Cesium.js** | 專注地理空間資訊 (GIS)，支援大規模地球拓撲、3D Tiles、高精度空間坐標。 | 智慧城市、無人機航線視覺化、國土測繪、大比例尺地理展示。 |

---

## 3. 前端框架整合與宣告式生態

將指令式 3D API 轉換為宣告式結構，融入現代前端元件化工作流（React / Vue）：

* **React Three Fiber (R3F)**：
  * React 的 Three.js 宣告式包裝器，搭配 `@react-three/drei`（工具集）與 `@react-three/postprocessing`（後製特效），國外頂級互動網站主流方案。
  * 3D 物件、光源、相機皆為標準 React Component，兼具 React 狀態管理與 Three.js 渲染效能。
* **TresJS**：
  * 專為 Vue 3 設計的宣告式 Three.js 封裝，語法直觀，深度融入 Vue 生態系。

---

## 4. 遊戲引擎匯出方案 (WebAssembly / Wasm)

利用 WebAssembly 將成熟遊戲引擎編譯至網頁端運行：

* **Unity (WebGL / WebGPU 匯出)**：
  * 成熟的商業遊戲管線，打包為 Wasm 執行效率高，近年持續最佳化行動瀏覽器載入體積。
* **Unreal Engine (Pixel Streaming 雲端串流)**：
  * 雲端 GPU 伺服器即時運算 Lumen/Nanite 高畫質畫面，透過 WebRTC 即時串流影像至瀏覽器並回傳用戶輸入。
* **Godot 4**：
  * 開源遊戲引擎，對 Web 匯出支援良好，輕中度跨平台遊戲開發首選之一。

---

## 5. 格式標準與效能最佳化技術

* **glTF / GLB（3D 界的 JPEG）**：
  * Khronos Group 制定的通用標準，內含頂點、材質、骨架骨骼動畫與 PBR 材質規範。
* **網格與紋理壓縮**：
  * **Draco / Meshopt**：幾何網格壓縮率達 80%~90%，顯著降低模型網路傳輸體積。
  * **KTX2 / Basis Universal**：GPU 壓縮紋理，無需解壓至 RAM 即可直接載入 VRAM 解碼，大幅降低記憶體負擔與掉幀率。

---

## 6. 前沿與新興熱門技術 (2025–2026)

* **3D Gaussian Splatting (3DGS) 網頁即時渲染**：
  * 實景拍攝轉化為數十萬至數百萬個 3D 高斯橢球，結合 WebGL/WebGPU 計算著色器實現 60 FPS 真實場景即時重現。
* **WebAssembly 物理引擎**：
  * 如 **Rapier**（Rust 編寫並編譯成 Wasm）、**PhysX (Wasm)**，具備接近原生 C++ 的碰撞檢測與剛體動力學效能。
* **無代碼／低代碼 3D 工具 (如 Spline)**：
  * 網頁版 3D 設計工具，可直接調整材質、物理與互動動畫，一鍵匯出 Web Component 或 React 代碼。

---

## 🎯 Vibe Coding 實戰最佳選型評估

在「**AI 協同（Gemini + Claude Opus 5.5）**」與「**極速迭代（Vibe Coding）**」情境下的核心考量：

1. **代碼透明度與即時修改性**：
   * 排除 Unity/Godot 打包 Wasm（黑盒子，無法直接透過對話修改特定邏輯代碼）。
   * 優先選擇 **純 JavaScript/TypeScript 原始碼**（Three.js 或 R3F），AI 可以直接針對每一行代碼進行重構、微調參數與增加功能。
2. **AI 模型先驗知識密度**：
   * Claude Opus 與 Gemini 在 **Three.js** 的程式碼訓練量最豐富，編寫著色器、攝影機視角、光影調優的成功率最高。
3. **推薦甜蜜點組合**：
   * **MVP 原型**：`Vite + Three.js + Rapier (Wasm) + HTML HUD`
   * **進階 UI 豐富型**：`Vite + React Three Fiber (R3F) + Drei + Rapier`
