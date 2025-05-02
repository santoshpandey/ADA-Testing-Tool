const puppeteer = require('puppeteer');
const { login } = require('./login');
const { generateHTMLReport } = require('./reporter');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');


// Config based on the env
const env = process.env.env || 'demo';
const configPath = `./configs/config.${env}.json`;

if (!fs.existsSync(configPath)) {
  throw new Error(`Config file not found for environment: ${env}`);
}

const config = require(configPath);
console.log(`Loaded configuration for '${env}' environment`);

// Check Page completly loaded
async function waitForPageToBeFullyLoaded(page, options = {}) {
  const {
    selectorToWait = '#coreApplication',
    additionalDelay = 2000,
    timeout = 60000
  } = options;

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout });
  } catch {
    console.warn('networkidle0 timeout — continuing...');
  }

  if (selectorToWait) {
    try {
      await page.waitForSelector(selectorToWait, { timeout: 15000 });
    } catch {
      console.warn(`Selector ${selectorToWait} not found — continuing...`);
    }
  }

  await page.evaluate(() => new Promise(res => {
    requestIdleCallback(res, { timeout: 2000 });
  }));

  await new Promise(res => setTimeout(res, additionalDelay));
}
// Retry 2 times if navigation failed
async function navigateWithRetries(page, screen, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Navigating to ${screen.url} (Attempt ${attempt})`);
      await page.goto(screen.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForPageToBeFullyLoaded(page, {
        selectorToWait: screen.selector,
        additionalDelay: 2000
      });
      console.log(`✅ Navigation successful: ${screen.url}`);
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${screen.url}: ${error.message}`);
      if (attempt === retries) {
        throw new Error(`Failed to load ${screen.url}`);
      }
      console.log('Retrying...');
    }
  }
}
/* 
 Start folder creation and ADA Scan 
 Report Generation
*/
(async () => {
  if (!fs.existsSync('reports')) fs.mkdirSync('reports');
  if (!fs.existsSync('reports/screenshots')) fs.mkdirSync('reports/screenshots');

  const browser = await puppeteer.launch({
    headless: true,
    slowMo: 50,
    defaultViewport: null,
    timeout: 0
  });

  const page = await browser.newPage();
  console.log('Logging in.....');
  await login(page, config.credentials);

  const cookies = await page.cookies();
  await page.close();

  const results = [];

  for (const screen of config.screens) {
    const testPage = await browser.newPage();
    await testPage.setCookie(...cookies);
    await testPage.goto('about:blank');

    try {
      await navigateWithRetries(testPage, screen);

      const screenshotPath = path.join('reports', 'screenshots', `${screen.name.replace(/\s+/g, '_')}.png`);
      await testPage.screenshot({ path: screenshotPath, fullPage: true });

      await testPage.addScriptTag({ path: require.resolve('axe-core') });
      const axeResults = await testPage.evaluate(async () => {
        return await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa', 'section508']
          },
          resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable']
        });
      });

      const totalViolations = Array.isArray(axeResults.violations) ? axeResults.violations.length : 0;
      const totalTested = (axeResults.passes?.length || 0) + totalViolations;
      const score = totalTested > 0
        ? Math.round(((axeResults.passes?.length || 0) / totalTested) * 100)
        : 100;
      const passed = score >= config.threshold;

      try {
        results.push({
          screen: screen.name,
          url: screen.url,
          score,
          passed,
          issues: totalViolations,
          violations: Array.isArray(axeResults.violations)
            ? axeResults.violations.map(v => ({
                id: v.id,
                description: v.description,
                impact: v.impact || 'unknown',
                help: v.help,
                helpUrl: v.helpUrl,
                nodes: v.nodes.map(n => ({
                  html: n.html,
                  target: n.target,
                  failureSummary: n.failureSummary
                }))
              }))
            : [],
          screenshotPath
        });
      } catch (err) {
        console.error(`❌ Failed to store result for "${screen.name}": ${err.message}`);
      }

    } catch (err) {
      console.error(`❌ Error during test for ${screen.name}: ${err.message}`);
    }

    await testPage.close();
  }

  await browser.close();
  generateHTMLReport(results);
})();
