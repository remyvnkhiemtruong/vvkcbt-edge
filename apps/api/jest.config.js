/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vnu/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
    '^@vnu/exam-package-kit$': '<rootDir>/../../../packages/exam-package-kit/src/index.ts',
  },
};
