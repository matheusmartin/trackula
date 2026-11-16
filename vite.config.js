// Build, development server and tests. See README.md, "Commands".
import { readFileSync, existsSync } from 'node:fs';
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

export default defineConfig({
  plugins: [preact()],
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
