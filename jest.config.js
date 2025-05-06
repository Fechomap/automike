module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/main.js', // Excluir temporalmente
      '!src/preload.js' // Excluir temporalmente
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    moduleFileExtensions: ['js', 'json'],
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    testPathIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: ['./tests/setup.js']
  };