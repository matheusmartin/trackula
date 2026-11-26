# Trackula: repository rules

Read `README.md` first. It has the overview, the commands, the configuration and the project structure. This file
adds the rules for the code.

`docs/product.md` gives the behavior of the app and its words. `docs/design.md` gives the look: the color roles, the
tokens, the layout, the components and the number formats.

`docs/js-port.md` has the decisions of the JavaScript app and its differences from the Kotlin app before it.

## Standards

- Follow *Clean Code* by Robert C. Martin.
- Prettier gives the format: the maximum line length is 120, with single quotes. See `.prettierrc.json`.
- Write all JSDoc, comments and commit messages in ASD-STE100 Simplified Technical English, as in `README.md`.
  - The JSDoc of a boolean starts with "True if", "True while" or a similar phrase, not with "Whether".
    Example: "True if the window shows the newest bar."
  - A JSDoc can have more than one short sentence before its first blank line, as STE text does.
- Each exported function, class and component has a JSDoc with the types of its parameters and of its return value.
  TypeScript checks these types (`npm run typecheck`). Do not write `.ts` files.
- `npm run check` must pass: ESLint, Prettier, the type check, the tests and the build.
- Text for the user never uses `toString()` of a number when the format matters. Use the functions in `Format.js`.
  Example: `formatNumber(3)` gives "3".
- Use `null` for "no value", not `undefined`.

## Dependencies between layers

ESLint checks these rules (`no-restricted-imports` in `eslint.config.js`).

- `src/model/` uses no other layer, no package and no browser API. You can test it in Node.js. Put logic here when you
  can.
- `src/sheets/` can use `model` and `fetch`.
- `src/services/` can use `model` and `sheets`, and the browser APIs.
- `src/app/` can use all the layers above, Preact and BeerCSS. It gets the browser parts through `Platform`, so the UI
  tests can use a fake.
- If you add a layer or a package, add it to this list and to "Project structure" in `README.md`.
- Give each package an exact version in `package.json`, and commit `package-lock.json`.

## UI

- Use Preact function components and hooks. Follow `docs/design.md`: use its color roles and its tokens (`--space-*`,
  `--radius-*`), not fixed colors or sizes. Do not add new uses of BeerCSS: phase 3 of the consolidation removes it.
- Each icon button has a `title` (a tooltip) and an `aria-label`. Each cell, tile and chart mark that has a value has a
  `title`.
- The app works with a mouse, with touch and with the keyboard. The keyboard focus is visible.

## Tests

- The tests of `<Name>.js` are in `<Name>.test.js` in the same folder. Example: `src/model/Zoom.test.js` tests
  `src/model/Zoom.js`. A UI test ends with `.test.jsx`.
- The UI tests use Testing Library (`@testing-library/preact`). Find elements by their role and their name.
- When you change code that has tests, change or add tests in the same commit.

## Docs

- If you change the sheet format (tabs, columns, values), update `docs/data-model.md` in the same commit.
- If you change a command, a requirement or the configuration, update `README.md` in the same commit.

## Commits

- Use Conventional Commits: `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
  Scopes: `ui`, `data`. Example: `feat(data): require a metric icon and show it in the detail title`.
- Write the summary in lowercase, in the imperative.
