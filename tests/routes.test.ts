import {expect, it} from 'vitest';
import {pages, pagePath, resolvePage} from '../src/routes';

it('resolves every subpage at the domain root and under a GitHub Pages project', () => {
  for (const base of ['/', '/SandwichSudoku/']) {
    for (const [id, label] of pages) {
      const path = pagePath(id, base);
      expect(path).not.toContain('?');
      expect(resolvePage(new URL(path, 'https://example.com'), base)).toEqual([id, label]);
      expect(resolvePage(new URL(path.slice(0, -1), 'https://example.com'), base)).toEqual([id, label]);
      expect(resolvePage(new URL(`${base}?page=${id}`, 'https://example.com'), base)).toEqual([id, label]);
    }
    expect(resolvePage(new URL(base, 'https://example.com'), base)[0]).toBe('generate');
  }
});
