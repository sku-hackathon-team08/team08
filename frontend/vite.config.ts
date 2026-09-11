import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), vworld: fileURLToPath(new URL('./vworld.html', import.meta.url)) } } },
  plugins: [{
    name: 'concert-model-reload',
    configureServer(server) {
      const assets = fileURLToPath(new URL('../backend/demo/assets/', import.meta.url))
      server.watcher.add(assets)
      let refresh: ReturnType<typeof setTimeout> | undefined
      server.watcher.on('change', path => {
        if (!path.startsWith(assets)) return
        clearTimeout(refresh)
        refresh = setTimeout(() => server.ws.send({ type: 'full-reload' }), 1000)
      })
      server.httpServer?.once('close', () => clearTimeout(refresh))
    },
  }, react(), tailwindcss(), viteStaticCopy({ targets: [
    { src: 'node_modules/cesium/Build/Cesium/Workers', dest: 'cesium', rename: { stripBase: 4 } },
    { src: 'node_modules/cesium/Build/Cesium/Assets', dest: 'cesium', rename: { stripBase: 4 } },
    { src: 'node_modules/cesium/Build/Cesium/Widgets', dest: 'cesium', rename: { stripBase: 4 } },
    { src: 'node_modules/cesium/Build/Cesium/ThirdParty', dest: 'cesium', rename: { stripBase: 4 } },
  ] })],
  server: { proxy: { '/api': 'http://127.0.0.1:8001' } },
})
