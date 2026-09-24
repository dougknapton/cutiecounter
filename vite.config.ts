import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Emits dist/sw.js from sw-template.js, filling in the list of built files to
 * precache and a version derived from their content. Any rebuild that changes
 * a file changes the version, which makes the browser install the new worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'tasks-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files = new Set<string>(['./']);
      for (const [fileName, item] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        files.add(`./${fileName}`);
        hash.update(fileName);
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const name of readdirSync('public')) {
        files.add(`./${name}`);
        hash.update(name);
        hash.update(readFileSync(`public/${name}`));
      }
      const template = readFileSync('sw-template.js', 'utf8');
      const source = template
        .replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__PRECACHE__', JSON.stringify([...files].sort(), null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base works for Netlify (site root) and GitHub Pages (/repo-name/).
  base: './',
  plugins: [react(), serviceWorker()],
  build: { sourcemap: false },
});
