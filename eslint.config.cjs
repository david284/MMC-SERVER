const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'public/**'
    ],

    languageOptions: {
      globals: {
        ...globals.node
      }
    },

    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  },

  {
    files: ['unit_tests/**/*.js'],

    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  }
];
