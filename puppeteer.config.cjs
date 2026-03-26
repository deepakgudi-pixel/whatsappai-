const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // This tells Puppeteer to store Chrome inside your project folder
  // so it survives the transition from 'Build' to 'Start'
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};