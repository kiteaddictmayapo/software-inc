import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * La CSP estricta del index.html (script-src 'self') bloquearía el script inline del
 * demo autocontenido al abrirlo con doble clic (file://). Se elimina solo para el demo;
 * la app Electron conserva su CSP.
 */
function stripCsp(): Plugin {
  return {
    name: 'strip-csp-demo',
    transformIndexHtml(html) {
      return html.replace(/<meta[^>]*Content-Security-Policy[^>]*>\s*/i, '')
    }
  }
}

/**
 * Build de solo-renderer para el MODO DEMO (navegador, sin Electron).
 *   npm run demo        -> servidor de desarrollo en http://localhost:5174
 *   npm run build:demo  -> demo-dist/index.html autocontenido (doble clic)
 */
export default defineConfig({
  root: 'src/renderer',
  base: './',
  define: {
    'import.meta.env.VITE_DEMO': JSON.stringify('1')
  },
  resolve: {
    alias: {
      '@shared': resolve('shared'),
      '@renderer': resolve('src/renderer')
    }
  },
  plugins: [react(), stripCsp(), viteSingleFile()],
  server: { port: 5174, open: true },
  build: {
    outDir: resolve('demo-dist'),
    emptyOutDir: true
  }
})
