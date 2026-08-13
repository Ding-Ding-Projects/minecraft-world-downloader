import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The local test runner.
 *
 * Node's own `node:test` was tried first, per the standing preference for no new
 * heavyweight dependency. It fails at the first import: this renderer is written
 * against Vite's "bundler" module resolution (extensionless relative imports,
 * `.css` side-effect imports, the `@core`/`@shared` aliases declared in
 * `electron.vite.config.ts`), and plain Node ESM resolution requires an explicit
 * file extension on every specifier — `import '../../core/settings'` throws
 * `ERR_MODULE_NOT_FOUND` under `node --test` even though the exact same source
 * compiles and runs correctly through electron-vite. Rewriting every relative
 * import across 35 feature directories to satisfy a different resolver, just to
 * avoid one devDependency, would be a larger and riskier change than the tests
 * themselves. Vitest already sits on the Vite toolchain this project builds
 * with, resolves the source tree exactly as electron-vite does, and needed zero
 * changes to application source to run against it.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@core': resolve(__dirname, 'src/renderer/core')
    }
  },
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    setupFiles: ['tests/setup.ts']
  }
});
