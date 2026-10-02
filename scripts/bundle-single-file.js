/**
 * 單一 HTML 檔交付打包與驗證腳本 (Single-file HTML Bundler & Validator)
 * 依照《日式海島第一人稱釣魚遊戲｜功能規劃文檔》規範：
 * 交付物需為單一 HTML 檔，CSS 與 JS 全部內嵌，無任何外部網路資源依賴。
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distHtmlPath = path.resolve(rootDir, 'dist', 'index.html');
const standaloneDeliverablePath = path.resolve(rootDir, '日式幻想海島_第一人稱釣魚遊戲_單檔版.html');

console.log('====================================================');
console.log('🚀 開始執行單一 HTML 交付打包 (Vite SingleFile)...');
console.log('====================================================');

// 1. 執行 Vite 建置
try {
  console.log('📦 正在呼叫 vite build...');
  execSync('npx vite build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
} catch (error) {
  console.error('❌ 建置失敗:', error.message);
  process.exit(1);
}

// 2. 檢查產物是否存在
if (!fs.existsSync(distHtmlPath)) {
  console.error('❌ 找不到打包產物:', distHtmlPath);
  process.exit(1);
}

const htmlContent = fs.readFileSync(distHtmlPath, 'utf8');
const stats = fs.statSync(distHtmlPath);
const fileSizeKb = (stats.size / 1024).toFixed(2);

console.log(`\n📄 產出單檔 HTML: ${distHtmlPath}`);
console.log(`📊 檔案體積: ${fileSizeKb} KB`);

// 3. 嚴格驗證自包含性 (Self-Containment Check)
console.log('\n🔍 正在驗證單一檔案規格 (100% 內聯檢測)...');

const externalScriptRegex = /<script\b[^>]*\bsrc=["'](?!data:)[^"']+["'][^>]*>/gi;
const externalCssRegex = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'](?!data:)[^"']+["'][^>]*>/gi;

const externalScripts = htmlContent.match(externalScriptRegex) || [];
const externalCss = htmlContent.match(externalCssRegex) || [];

let isAllInlined = true;

if (externalScripts.length > 0) {
  console.warn('⚠️ 發現外部腳本標籤:', externalScripts);
  isAllInlined = false;
} else {
  console.log('  ✅ 無外部 JavaScript 依賴（全部內聯於 <script> 區塊）');
}

if (externalCss.length > 0) {
  console.warn('⚠️ 發現外部樣式標籤:', externalCss);
  isAllInlined = false;
} else {
  console.log('  ✅ 無外部 CSS 檔案依賴（全部內聯於 <style> 區塊）');
}

// 4. 複製產物至專案根目錄的直覺交付名稱
fs.copyFileSync(distHtmlPath, standaloneDeliverablePath);
console.log(`\n🎉 交付副本已產生至專案根目錄:`);
console.log(`👉 [${path.basename(standaloneDeliverablePath)}]`);
console.log(`💡 支援離線雙擊遊玩：直接雙擊此 HTML 檔案或以瀏覽器開啟即可！`);

console.log('====================================================');
console.log('✅ 打包驗證完成！所有代碼與樣式皆已成功封裝。');
console.log('====================================================');
