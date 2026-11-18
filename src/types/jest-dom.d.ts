// `allowJs` is false, so `src/setupTests.js` (a .js file) never enters the
// TypeScript program and its `import '@testing-library/jest-dom'` never
// reaches the compiler — meaning the global `jest.Matchers` augmentation
// (toBeInTheDocument, etc.) it provides is invisible to .ts/.tsx test files.
// Re-importing it from a .d.ts, which is always included regardless of
// allowJs, pulls the same augmentation into the program.
import '@testing-library/jest-dom';
