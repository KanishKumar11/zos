/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: { node: true, jest: true },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
