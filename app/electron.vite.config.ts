import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const root = __dirname;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(root, 'src/shared')
      }
    },
    build: {
      outDir: resolve(root, 'out/main'),
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(root, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(root, 'src/shared')
      }
    },
    build: {
      outDir: resolve(root, 'out/preload'),
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(root, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve(root, 'src/shared'),
        '@core': resolve(root, 'src/renderer/core')
      }
    },
    // Every asset is inlined or emitted locally. No CDN, no remote font, no analytics.
    build: {
      outDir: resolve(root, 'out/renderer'),
      emptyOutDir: true,
      assetsInlineLimit: 0,
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(root, 'src/renderer/index.html') }
      }
    },
    server: {
      fs: { strict: true }
    }
  }
});
