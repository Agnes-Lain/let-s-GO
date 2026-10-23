// Component tests (*.test.tsx): let the app's progress and settings stores read its (mocked) AsyncStorage
// before the first render, so hydration never lands outside act(). beforeAll runs after the
// test file's jest.mock calls, so mocked modules (e.g. a test lesson registry) are respected.
beforeAll(async () => {
  if (!/\.test\.tsx$/.test(expect.getState().testPath ?? '')) return;
  const { progressStore, settingsStore } = jest.requireActual<typeof import('@/store')>('@/store');
  const hydrated = () => progressStore.getState().hydrated && settingsStore.getState().hydrated;
  for (let i = 0; i < 5 && !hydrated(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});
