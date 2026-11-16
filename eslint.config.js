// Code checks. Prettier does the format. Run: npm run lint. See CLAUDE.md, "Dependencies between layers".
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

/** The browser APIs that `src/sheets/` can use: it calls the Sheets REST API with `fetch`. They are in Node.js too. */
const fetchGlobals = Object.fromEntries(
  [
    'fetch',
    'Response',
    'Request',
    'Headers',
    'URL',
    'URLSearchParams',
    'AbortController',
    'setTimeout',
    'clearTimeout',
  ].map((name) => [name, 'readonly']),
);

/**
 * A rule that lets a layer import only from the listed folders of `src/`, and from no package.
 * @param {string[]} allowed The other layers that this layer can use, for example `["model"]`.
 * @returns {import("eslint").Linter.RuleEntry} The rule.
 */
function onlyImports(allowed) {
  const others = ['model', 'sheets', 'services', 'app'];
  return [
    'error',
    {
      patterns: [
        { regex: '^(?![./])', message: 'This layer uses no package. See CLAUDE.md.' },
        ...others
          .filter((layer) => !allowed.includes(layer))
          .map((layer) => ({
            regex: `^\\.\\./(\\.\\./)*${layer}/`,
            message: `This layer cannot use ${layer}. See CLAUDE.md.`,
          })),
      ],
    },
  ];
}

export default [
  { ignores: ['dist/', 'kmp/', 'design/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  jsdoc.configs['flat/recommended-typescript-flavor-error'],
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.es2024 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, ArrowFunctionExpression: true },
        },
      ],
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/tag-lines': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/reject-any-type': 'off',
    },
  },
  { files: ['src/model/**'], rules: { 'no-restricted-imports': onlyImports([]) } },
  {
    files: ['src/sheets/**'],
    languageOptions: { globals: fetchGlobals },
    rules: { 'no-restricted-imports': onlyImports(['model']) },
  },
  {
    files: ['src/services/**'],
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'no-restricted-imports': onlyImports(['model', 'sheets']) },
  },
  { files: ['src/app/**'], languageOptions: { globals: { ...globals.browser } } },
  // Tests import vitest and can use test helpers of other layers.
  {
    files: ['src/**/*.test.{js,jsx}', 'src/**/testing/**'],
    rules: { 'no-restricted-imports': 'off', 'jsdoc/require-jsdoc': 'off' },
  },
  { files: ['*.config.js', 'scripts/**'], languageOptions: { globals: { ...globals.node } } },
];
