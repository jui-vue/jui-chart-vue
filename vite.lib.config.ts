import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Library build: produces dist-lib/{jui-chart-vue.umd.js,jui-chart-vue.es.js,style.css}.
// UMD is the format www.jui-vue.io's play/chart demos actually consume (plain <script> tag,
// global `window.JuiChartVue`, same pattern the old per-type-component build used) - no
// `vite-plugin-dts` here since a plain-JS consumer has no use for declaration files; type-checking
// still runs via `tsc -p tsconfig.lib.json --noEmit` in the `build:lib` script before this bundles.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'JuiChartVue',
      fileName: (format) => `jui-chart-vue.${format}.js`,
      formats: ['umd', 'es'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        exports: 'named',
        globals: { vue: 'Vue' },
        assetFileNames: (asset) => (asset.names?.[0]?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'),
      },
    },
  },
})
