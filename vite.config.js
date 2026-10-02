import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 建置結果為單一 HTML 檔（CSS 與 JS 全部內嵌），可直接用瀏覽器開啟，也能部署在 GitHub Pages 的子路徑下
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
