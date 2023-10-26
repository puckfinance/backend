module.exports = {
  env: {
    'jest/globals': true,
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  globals: {
    Stripe: 'readonly',
    google: 'readonly',
    grecaptcha: 'readonly',
    google_site_key: 'readonly',
    ipsun_app: 'readonly',
    jsPlumbInstance: 'readonly',
    Prism: 'readonly',
    gapi: 'readonly',
  },
  ignorePatterns: ['!.*'],
  rules: {
    // https://eslint.org/docs/latest/rules/indent
    indent: ['error', 4, {
      SwitchCase: 1,
    }],
    // https://eslint.org/docs/latest/rules/linebreak-style
    'linebreak-style': ['error', 'unix'],
    // https://eslint.org/docs/latest/rules/quotes
    quotes: ['error', 'single'],
    // https://eslint.org/docs/latest/rules/semi
    semi: ['error', 'always', {
      omitLastInOneLineBlock: false,
    }],
    // https://eslint.org/docs/latest/rules/arrow-spacing
    'arrow-spacing': [
      'warn',
      {
        before: true,
        after: true,
      },
    ],
    // https://eslint.org/docs/latest/rules/keyword-spacing
    'keyword-spacing': [
      'warn',
      {
        before: true,
        after: true,
      },
    ],
    // https://eslint.org/docs/latest/rules/space-unary-ops
    'space-unary-ops': [
      'warn',
      {
        words: true,
        nonwords: true,
        overrides: {
          '++': false,
          '--': false,
        },
      },
    ],
    // https://eslint.org/docs/latest/rules/space-before-function-paren
    'space-before-function-paren': [
      'warn',
      {
        anonymous: 'always',
        named: 'always',
        asyncArrow: 'always',
      },
    ],
    // https://eslint.org/docs/latest/rules/array-bracket-spacing
    'array-bracket-spacing': ['warn', 'always'],
    // https://eslint.org/docs/latest/rules/computed-property-spacing
    'computed-property-spacing': ['warn', 'always'],
    // https://eslint.org/docs/latest/rules/object-curly-spacing
    'object-curly-spacing': ['warn', 'always'],
    // https://eslint.org/docs/latest/rules/template-curly-spacing
    'template-curly-spacing': ['warn', 'always'],
    // https://eslint.org/docs/latest/rules/comma-spacing
    'comma-spacing': [
      'warn',
      {
        before: false,
        after: true,
      },
    ],
    // https://eslint.org/docs/latest/rules/space-in-parens
    'space-in-parens': ['error', 'always'],
    // https://eslint.org/docs/latest/rules/arrow-parens
    'arrow-parens': ['error', 'always'],
    // https://eslint.org/docs/latest/rules/padded-blocks
    'padded-blocks': ['error', 'always'],
    // https://eslint.org/docs/latest/rules/comma-dangle
    'comma-dangle': ['error', {
      'arrays': 'only-multiline',
      'objects': 'only-multiline',
      'imports': 'never',
      'exports': 'never',
      'functions': 'never'
    }],
    'react/prop-types': ['off'],
    // https://eslint.org/docs/latest/rules/jsx-quotes
    'jsx-quotes': ['error', 'prefer-double'],
    // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-curly-spacing.md
    'react/jsx-curly-spacing': ['error', { 'when': 'always', 'children': true }],
    'jsx-a11y/anchor-is-valid': ['off'],
    // https://eslint.org/docs/latest/rules/space-infix-ops
    'space-infix-ops': ['error', { 'int32Hint': false }],
    // https://eslint.org/docs/latest/rules/implicit-arrow-linebreak
    'implicit-arrow-linebreak': ['error', 'beside'],
    // https://eslint.org/docs/latest/rules/operator-linebreak
    'operator-linebreak': ['error', 'none', { 'overrides': { '?': 'before', ':': 'before' } }],
    // https://eslint.org/docs/latest/rules/no-multi-spaces
    'no-multi-spaces': 'error',
    // https://eslint.org/docs/latest/rules/function-paren-newline
    'function-paren-newline': ['error', 'consistent'],
    // https://eslint.org/docs/latest/rules/no-multiple-empty-lines
    'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1 }],
    'padding-line-between-statements': ['error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: '*', next: 'iife' },
      { blankLine: 'always', prev: '*', next: 'const' },
      { blankLine: 'always', prev: 'if', next: '*' },
    ],
    // https://eslint.org/docs/latest/rules/nonblock-statement-body-position
    'nonblock-statement-body-position': ['error', 'below'],
    'jsdoc/check-access': 1, // Recommended
    'jsdoc/check-alignment': 1, // Recommended
    'jsdoc/check-param-names': 1, // Recommended
    'jsdoc/check-property-names': 1, // Recommended
    'jsdoc/check-types': 1, // Recommended
    'jsdoc/check-values': 1, // Recommended
    'jsdoc/empty-tags': 1, // Recommended
    'jsdoc/implements-on-classes': 1, // Recommended
    'jsdoc/multiline-blocks': 1, // Recommended
    'jsdoc/no-multi-asterisks': 1, // Recommended
    'jsdoc/require-jsdoc': 1, // Recommended
    'jsdoc/require-param': 1, // Recommended
    'jsdoc/require-property': 1, // Recommended
    'jsdoc/require-property-name': 1, // Recommended
    'jsdoc/require-property-type': 1, // Recommended
    'jsdoc/require-returns-check': 1, // Recommended
    'jsdoc/require-returns-type': 1, // Recommended
    'jsdoc/require-yields': 1, // Recommended
    'jsdoc/require-yields-check': 1, // Recommended
    'jsdoc/tag-lines': 1, // Recommended
  },
  plugins: ['react', 'jsdoc', 'jest'],
};
