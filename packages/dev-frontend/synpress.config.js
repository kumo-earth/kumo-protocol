const { defineConfig } = require('cypress');
const synpressPlugins = require('@synthetixio/synpress/plugins');
 
module.exports = defineConfig({
  e2e: {
    browser: 'chrome',
    baseUrl: 'http://localhost:3000/',
    specPattern: 'tests/e2e/specs',
    supportFile: 'tests/support/index.js',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    video: true,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 100000,
    pageLoadTimeout: 180000,
    requestTimeout: 40000,
    chromeWebSecurity: true,
    setupNodeEvents(on, config) {
      synpressPlugins(on, config);
      return config
    },
  }
});