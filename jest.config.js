/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/domain/**/*.test.ts', '<rootDir>/services/**/*.test.ts', '<rootDir>/data/**/*.test.ts'],
};
