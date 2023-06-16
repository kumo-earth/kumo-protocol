const { defineConfig } = require('cypress');
const synpressPlugins = require('@synthetixio/synpress/plugins');
 
module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://dev.kumo.earth/',
    specPattern: 'tests/e2e/specs',
    supportFile: 'tests/support/index.js',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    video: true,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 40000,
    pageLoadTimeout: 180000,
    requestTimeout: 40000,
    chromeWebSecurity: true,
    setupNodeEvents(on, config) {
      synpressPlugins(on, config);
      return config
    },
  }
});