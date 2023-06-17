const { defineConfig } = require('cypress');
const synpressPlugins = require('@synthetixio/synpress/plugins');
 
module.exports = defineConfig({
  env: {
    "ELECTRON_DISABLE_GPU": "1"
  },
  e2e: {
    browser: 'chrome',
    baseUrl: 'http://localhost:3000/',
    specPattern: 'tests/e2e/specs',
    supportFile: 'tests/support/index.js',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    video: true,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 40000,
    pageLoadTimeout: 180000,
    requestTimeout: 40000,
    viewportWidth: 1366,
    viewportHeight: 850,
    chromeWebSecurity: true,
    setupNodeEvents(on, config) {
      synpressPlugins(on, config);
      if (config.env.browser === "chrome") {
        config.env.DISABLE_GPU = "1";
      }
      return config
    },
  }
});