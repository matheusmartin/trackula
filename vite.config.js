// Build, development server and tests. See README.md, "Commands".
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

/**
 * The build values: from the environment variables, else from `config.env`. Empty if they are missing: then the app
 * shows a message and does not start the sign-in. They are public in the built app.
 * @param {string} name The name of the value, for example `GOOGLE_CLIENT_ID`.
 * @returns {string} The value, or an empty text.
 */
function buildValue(name) {
  const fromEnvironment = process.env[name];
  if (fromEnvironment) return fromEnvironment;
  if (!existsSync('config.env')) return '';
  for (const line of readFileSync('config.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '');
  }
  return '';
}

/**
 * All files in the folder and its subfolders, as paths relative to `root` with `/`.
 * @param {string} folder
 * @param {string} root
 * @returns {string[]}
 */
function filesIn(folder, root = folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesIn(path, root) : [relative(root, path).split(sep).join('/')];
  });
}

/**
 * Writes the service worker `web/sw.js` to `dist/sw.js` after the build, with the build ID and the list of the app
 * files. The names of the code, style and font files change with each build. The build ID is a hash of all files, so a
 * new build gets a new cache. See "Install the app" in README.md.
 * @returns {import('vite').Plugin}
 */
function serviceWorker() {
  /** @type {string} */
  let outDir;
  return {
    name: 'trackula-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = filesIn(outDir)
        .filter((file) => file !== 'index.html' && file !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const file of [...files, 'index.html']) hash.update(file).update(readFileSync(join(outDir, file)));
      const template = readFileSync('web/sw.js', 'utf8');
      if (!template.includes("'/* build */'") || !template.includes('/* app-files */')) {
        throw new Error('web/sw.js has no markers.');
      }
      const worker = template
        .replace("'/* build */'", JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('/* app-files */', files.map((file) => `, ${JSON.stringify(file)}`).join(''));
      writeFileSync(join(outDir, 'sw.js'), worker);
    },
  };
}

export default defineConfig({
  // Relative paths: the app can be in a folder of the site, for example on GitHub Pages.
  base: './',
  plugins: [preact(), serviceWorker()],
  define: {
    __GOOGLE_CLIENT_ID__: JSON.stringify(buildValue('GOOGLE_CLIENT_ID')),
    __GOOGLE_API_KEY__: JSON.stringify(buildValue('GOOGLE_API_KEY')),
  },
  server: { port: 8080 },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'logic', include: ['src/{model,sheets,services}/**/*.test.js'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'ui', include: ['src/app/**/*.test.{js,jsx}'], environment: 'happy-dom' },
      },
    ],
  },
});
