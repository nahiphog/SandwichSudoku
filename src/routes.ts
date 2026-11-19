export const pages = [
  ['generate', 'Generate'],
  ['import-grid', 'Import grid'],
  ['simulation', 'Simulation'],
  ['about', 'About'],
  ['techniques', 'Techniques'],
  ['custom-build', 'Custom build'],
] as const;

export function pagePath(id: string, base: string): string {
  return `${base}${id}/`;
}

export function resolvePage(url: URL, base: string) {
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : '';
  const requested = url.searchParams.get('page') ?? path.replace(/\/$/, '');
  return pages.find(([id]) => id === requested) ?? pages[0];
}
