import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // GitHub Pages serves this app from https://juijs-vue.github.io/jui-chart-vue/,
  // so only the production build needs the repo-name base path - the dev server
  // should keep serving from the root.
  base: command === 'build' ? '/jui-chart-vue/' : '/',
}))
