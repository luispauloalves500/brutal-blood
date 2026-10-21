import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '/index.ts']) {
      if (existsSync(fileURLToPath(url) + suffix)) return next(url.href + suffix, context);
    }
  }
  return next(specifier, context);
}});
await import('./game-regression.test.mjs');
