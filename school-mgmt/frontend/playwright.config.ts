import { defineConfig, devices } from '@playwright/test';

const frontendBaseUrl =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const apiBaseUrl =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

process.env['PLAYWRIGHT_BASE_URL'] ||= frontendBaseUrl;
process.env['PLAYWRIGHT_API_BASE_URL'] ||= apiBaseUrl;

const frontendPort = new URL(frontendBaseUrl).port || '4301';
const frontendHost = new URL(frontendBaseUrl).hostname || 'localhost';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['PLAYWRIGHT_WORKERS']
    ? Number(process.env['PLAYWRIGHT_WORKERS'])
    : 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: '../test-results/e2e-ui/junit.xml' }],
    ['html', { outputFolder: '../test-results/e2e-ui/html', open: 'never' }],
  ],
  outputDir: '../test-videos',
  use: {
    baseURL: frontendBaseUrl,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env['PLAYWRIGHT_DISABLE_WEB_SERVER']
    ? undefined
    : {
        command: `npm run start -- --host ${frontendHost} --port ${frontendPort}`,
        url: frontendBaseUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
