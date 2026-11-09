import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
const root = 'apps/web/src/i18n/locales/';
it('keeps all namespaces and interpolation parameters in both languages', () => {
  const pt = readdirSync(root + 'pt-BR');
  expect(readdirSync(root + 'en')).toEqual(pt);
  for (const ns of pt) {
    const a = JSON.parse(readFileSync(root + 'pt-BR/' + ns, 'utf8')),
      b = JSON.parse(readFileSync(root + 'en/' + ns, 'utf8'));
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    for (const key of Object.keys(a)) {
      expect(b[key].trim()).not.toBe('');
      expect(a[key].match(/{{.*?}}/g)).toEqual(b[key].match(/{{.*?}}/g));
    }
  }
});
it('covers static translation keys referenced by components', () => {
  const source = ['main.tsx', 'components.tsx']
    .map((path) => readFileSync('apps/web/src/' + path, 'utf8'))
    .join('\n');
  for (const match of source.matchAll(/\bt\(['"]([\w:]+)['"]/g)) {
    const [ns, key] = match[1].includes(':') ? match[1].split(':') : ['common', match[1]];
    const values = JSON.parse(readFileSync(root + 'en/' + ns + '.json', 'utf8'));
    expect(values, key).toHaveProperty(key);
  }
});
