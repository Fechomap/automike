module.exports = {
    env: {
      node: true,
      es6: true,
      jest: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    },
    rules: {
      'no-console': 'off', // Por ahora permitimos console.log
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
      'indent': ['warn', 2],
      'arrow-spacing': ['warn', { before: true, after: true }],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always']
    }
  };