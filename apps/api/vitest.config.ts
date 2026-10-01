import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // Crea la BD SQLite plantilla para los tests de integración (*.it.test.ts)
    globalSetup: ['./src/test/globalSetup.ts'],
    // Las transacciones contra SQLite real tardan más que los unitarios con mocks
    testTimeout: 30_000,
  },
});
