module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/.kilo/'],
  moduleNameMapper: {
    '^@env$': '<rootDir>/__mocks__/env.js',
  },
};
