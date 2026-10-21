import { build } from 'esbuild';
import { mkdir, copyFile, readFile, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/public', { recursive: true });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await Promise.all([
  build({ entryPoints: ['src/app.ts'], outfile: 'dist/public/app.js', bundle: true,
    format: 'iife', target: ['es2022'], minify: true, legalComments: 'inline',
    banner: { js: `/*! Transit Board App ${version} | MIT | see THIRD_PARTY_NOTICES.md */` } }),
  build({ entryPoints: { server: 'server/index.ts', 'server-lib': 'server/app.ts',
    client: 'src/client.ts', session: 'src/session.ts', config: 'src/config.ts' },
    outdir: 'dist', bundle: true, platform: 'node', format: 'esm', target: ['node22'],
    packages: 'bundle', legalComments: 'inline' }),
  copyFile('static/index.html', 'dist/public/index.html'),
  copyFile('static/app.css', 'dist/public/app.css'),
  copyFile('LICENSE', 'dist/LICENSE'),
  copyFile('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md'),
]);
