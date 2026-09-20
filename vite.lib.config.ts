import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Library build: produces dist-lib/{jui-chart-vue.es.js,jui-chart-vue.cjs.js,index.d.ts,style.css}
export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
      outDirs: 'dist-lib',
      insertTypesEntry: true,
    }),
  ],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'JuiChartVue',
      fileName: (format) => `jui-chart-vue.${format}.js`,
      formats: ['es', 'cjs'],
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
