import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  output: {
    // GitHub Pages project sites are served below /<repository-name>/.
    assetPrefix: process.env.GITHUB_ACTIONS ? '/SillyTavern-Lorebook-Preview-L/' : '/',
  },
  html: {
    template: './index.html',
    title: 'Lorebook Reader · SillyTavern 世界书预览',
    meta: {
      description: '在浏览器本地导入、筛选和阅读 SillyTavern LoreBook 世界书 JSON；无需后端，不上传文件内容。',
      'application-name': 'Lorebook Reader',
      'theme-color': '#8b5c31',
      'color-scheme': 'light',
      'og:title': { property: 'og:title', content: 'Lorebook Reader · SillyTavern 世界书预览' },
      'og:description': { property: 'og:description', content: '在浏览器本地导入、筛选和阅读 SillyTavern 世界书 JSON。' },
      'og:type': { property: 'og:type', content: 'website' },
      'og:locale': { property: 'og:locale', content: 'zh_CN' },
      'twitter:card': { name: 'twitter:card', content: 'summary' },
      'twitter:title': { name: 'twitter:title', content: 'Lorebook Reader · SillyTavern 世界书预览' },
      'twitter:description': { name: 'twitter:description', content: '在浏览器本地导入、筛选和阅读 SillyTavern 世界书 JSON。' },
    },
  },
});
