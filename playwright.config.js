const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './browser_tests',
  timeout: 30000,
  outputDir: 'browser_tests/test-results',
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
