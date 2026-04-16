const { defineConfig } = require('@playwright/test');

// When running in Docker on the same network, use container names
// When running locally, use localhost
const isDocker = process.env.DOCKER_NETWORK === '1';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: isDocker ? 'http://mad-office-frontend:80' : 'http://localhost:80',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
});
