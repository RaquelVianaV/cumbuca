const { defineConfig } = require('@playwright/test');
const testPort = process.env.PLAYWRIGHT_PORT || '3014';

module.exports = defineConfig({
  testDir: './test/visual',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: 'retain-on-failure',
    timezoneId: 'America/Fortaleza',
  },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${testPort}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      PORT: testPort,
      DATABASE_URL: '',
      CUMBUCA_USER: 'cumbuca',
      CUMBUCA_PASSWORD: 'cumbuca2026',
      CUMBUCA_AUTH_SECRET: 'visual-test-secret',
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
});
