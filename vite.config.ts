import {defineConfig} from 'vite';
import {pages} from './src/routes';

export default defineConfig({
  plugins: [{
    name: 'static-subpages',
    enforce: 'post',
    generateBundle(_, bundle) {
      const entry = bundle['index.html'];
      if (!entry || entry.type !== 'asset') throw new Error('Missing HTML entry page.');
      // Relative assets resolve from the app root, including on GitHub project Pages.
      const html = String(entry.source).replace('<head>', '<head><base href="../">');
      for (const [id] of pages) {
        this.emitFile({type: 'asset', fileName: `${id}/index.html`, source: html});
      }
    },
  }],
});
