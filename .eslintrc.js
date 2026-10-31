module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'android/', 'ios/', '.expo/', 'scripts/'],
  extends: [
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // React Native needs require(): bundled assets (images) are required, and
    // native modules absent from Expo Go are required lazily, after a guard.
    '@typescript-eslint/no-require-imports': 'off',
    // Editor-side feedback for the same thing `npm run check:tokens` gates.
    // Warnings here; the script is what actually fails the build.
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Property[key.name='fontSize'][value.type='Literal'][value.raw=/^[0-9]/]",
        message: 'Use a type role from useTheme().type rather than a literal fontSize.',
      },
      {
        selector: "Property[key.name='fontWeight'][value.type='Literal']",
        message: 'Use a type role from useTheme().type rather than a literal fontWeight.',
      },
      {
        selector: "Property[key.name='fontFamily'][value.type='Literal']",
        message: 'Use a type role — theme/typography.ts is the one place a typeface is named.',
      },
      {
        selector: "Literal[value=/^#[0-9A-Fa-f]{3,8}$/]",
        message: 'Use a colour token from useTheme().colors rather than a hex literal.',
      },
    ],
  },
  overrides: [
    {
      // The theme DEFINES the tokens; raw values are the point there.
      files: ['theme/**/*.ts', 'theme/**/*.tsx'],
      rules: { 'no-restricted-syntax': 'off' },
    },
  ],
};
