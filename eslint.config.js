import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // The API and its libraries are plain Node modules that lean on a few
    // short module-level helpers (`up`, `err`). A local of the same name
    // does not warn, it puts the helper in the temporal dead zone, and the
    // route 500s before it validates anything. That is exactly how POST
    // /placements broke: `const { data: up }` shadowed the code normaliser
    // and killed every placement write while the workers reported healthy.
    files: ['api/**/*.js', 'src/lib/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false, variables: true }],
    },
  },
]
