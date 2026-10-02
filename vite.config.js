import { defineConfig } from 'vite';

// 使用相對路徑輸出，讓網站能部署在 GitHub Pages 的子路徑下
export default defineConfig({
  base: './',
});
