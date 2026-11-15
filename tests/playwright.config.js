const { defineConfig } = require('@playwright/test');

// When running in Docker on the same network, use container names
// When running locally, use localhost
const isDocker = process.env.DOCKER_NETWORK === '1';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  // Un solo worker: comparten base y el primero que se registra (0-escenas) es el dueño.
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || (isDocker ? 'http://mad-office-frontend:80' : 'http://localhost:8081'),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
});
