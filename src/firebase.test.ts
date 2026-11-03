export {};

// Regression test for the 2026-11-02 incident: a build run without .env.local
// (so all REACT_APP_FIREBASE_* vars are undefined) made getAnalytics() throw
// synchronously at module-import time, before React could render anything -
// a blank/gray screen in production with nothing in the console to explain it.
describe('firebase init with missing env config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('REACT_APP_FIREBASE_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not throw when every REACT_APP_FIREBASE_* var is undefined', () => {
    expect(() => require('./firebase')).not.toThrow();
  });

  it('still exports a usable Firestore db instance', () => {
    const { db } = require('./firebase');
    expect(db).toBeDefined();
  });
});
