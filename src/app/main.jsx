// Starts the app in the element `app` of index.html.
import { render } from 'preact';
import './base.css';
import './theme.css';
import { App } from './App.jsx';
import { browserPlatform } from './BrowserPlatform.js';

/** The longest wait for the icon font, in milliseconds. After it, the app shows without the font. */
const FONT_TIMEOUT = 3000;

render(<App platform={browserPlatform} />, /** @type {HTMLElement} */ (document.getElementById('app')));

// The start screen (the element `splash`) shows until the browser loaded the icon font: before that, the icons are
// empty. Then it goes away.
Promise.race([
  document.fonts.load('24px Symbols', 'refresh'),
  new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT)),
])
  .catch(() => {})
  .finally(() => document.getElementById('splash')?.remove());
