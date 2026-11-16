/**
 * DSH Plugin: Live Browser & Web Navigation Provider
 * Manages Google live searches, URL scraping, and proxy interaction.
 */

const { SEAMS } = require('../seams');

const BrowserPlugin = {
  name: 'dsh-provider-browser',
  version: '1.2.0',
  category: 'Networking',
  description: 'Web navigation, Google search extraction, and live DOM content proxy.',

  apply(ctx) {
    const browser = require('../../browser_service');

    const browserService = {
      isWebSearchNeeded(prompt) {
        return browser.isWebSearchNeeded(prompt);
      },

      async searchWeb(query) {
        return browser.googleSearch(query);
      },

      async browseUrl(url) {
        return browser.fetchPage(url);
      },

      getTools() {
        return browser.BROWSING_TOOLS;
      },

      async executeTool(name, args) {
        return browser.executeTool(name, args);
      }
    };

    SEAMS.BROWSER.validateProvider(browserService);
    ctx.provide('browser', browserService);
  }
};

module.exports = BrowserPlugin;
