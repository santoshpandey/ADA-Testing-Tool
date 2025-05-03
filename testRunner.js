const puppeteer = require('puppeteer');
const { login } = require('./login');
const { generateHTMLReport } = require('./reporter');
const fs = require('fs');
const path = require('path');
const open = require('open'); // Importing open module to open HTML report  TO DO

/* 
TO DO
AI Fix Suggestion  OpenAI integration)
//const { Configuration, OpenAIApi } = require("openai"); 
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY })); 
*/

// Config based on the environment specified in the process
const env = process.env.env || 'demo';  // Default to 'demo' environment if not provided
const configPath = `./configs/config.${env}.json`;  // Load config based on environment

// Ensure the config file exists for the selected environment
if (!fs.existsSync(configPath)) {
  throw new Error(`Config file not found for environment: ${env}`);
}

const config = require(configPath);
console.log(`Loaded configuration for '${env}' environment`);

// Function to ensure the page has loaded completely before further actions
async function waitForPageToBeFullyLoaded(page, options = {}) {
  const {
    selectorToWait = '#coreApplication', // Default selector to wait for
    additionalDelay = 2000, // Additional delay after page loads
    timeout = 60000  // Timeout for waiting
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

  await new Promise(res => setTimeout(res, additionalDelay)); // Wait for any extra idle time
}

// Function to retry navigation if it fails (max 2 retries by default)
async function navigateWithRetries(page, screen, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Navigating to ${screen.url} (Attempt ${attempt})`);
      await page.goto(screen.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForPageToBeFullyLoaded(page, { selectorToWait: screen.selector, additionalDelay: 2000 });
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
  TO DO - AI Fix Suggestion (For OpenAI integration)
  async function getFixSuggestion(violation) {
    const prompt = `Accessibility issue: ${violation.description}. 
    How would you fix this in HTML or with ARIA attributes?`;
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });
    return response.data.choices[0].message.content.trim();
  }
*/

// Main function to run the Puppeteer browser and perform accessibility testing
(async () => {
  // Create necessary directories for reports and screenshots
  if (!fs.existsSync('reports')) fs.mkdirSync('reports');
  if (!fs.existsSync('reports/screenshots')) fs.mkdirSync('reports/screenshots');

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    headless: config.headless, // Configurable via environment
    slowMo: 50,  // Slow down the actions for visibility (optional)
    defaultViewport: null,
    timeout: 0
  });

  // Start a new page and login to the application
  const page = await browser.newPage();
  console.log('Logging in...');
  await login(page, config.credentials);

  // Save cookies and close the initial login page
  const cookies = await page.cookies();
  await page.close();

  const results = [];  // Array to store results for each page tested

  // Iterate through each screen (page) to test accessibility
  for (const screen of config.screens) {
    const testPage = await browser.newPage();
    await testPage.setCookie(...cookies);
    await testPage.goto('about:blank');

    try {
      // Attempt to navigate to the screen
      await navigateWithRetries(testPage, screen);

      // Take a screenshot of the page
      const screenshotPath = path.join('reports', 'screenshots', `${screen.name.replace(/\s+/g, '_')}.png`);
      await testPage.screenshot({ path: screenshotPath, fullPage: true });

      // Inject axe-core script into the page for accessibility testing
      await testPage.addScriptTag({ path: require.resolve('axe-core') });

      // Run axe-core accessibility scan
      const axeResults = await testPage.evaluate(async () => {
        return await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa', 'section508'] },
          resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable']
        });
      });

      // Check for keyboard navigation issues
      const keyboardTest = await testPage.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, a[href], input, select, textarea'));
        return elements
          .filter(el => el.offsetParent !== null && el.tabIndex < 0)
          .map(el => el.outerHTML);
      });

      // Process the violations and add additional info
      const detailedViolations = await Promise.all(
        axeResults.violations.map(async (v) => {
          return {
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
          };
        })
      );

      // Calculate score based on the number of violations vs. passes
      const totalViolations = Array.isArray(axeResults.violations) ? axeResults.violations.length : 0;
      const totalTested = (axeResults.passes?.length || 0) + totalViolations;
      const score = totalTested > 0
        ? Math.round(((axeResults.passes?.length || 0) / totalTested) * 100)
        : 100;

      // Check if the score meets the threshold
      const passed = score >= config.threshold;

      // Save the results
      results.push({
        screen: screen.name,
        url: screen.url,
        score,
        passed,
        issues: totalViolations,
        violations: detailedViolations,
        keyboardIssues: keyboardTest,
        screenshotPath
      });

    } catch (err) {
      console.error(`❌ Error during test for ${screen.name}: ${err.message}`);
    }

    // Close the test page after testing
    await testPage.close();
  }

  // Close the browser
  await browser.close();

  // Generate the HTML report
  generateHTMLReport(results);

  // Automatically open the generated HTML report
  const reportPath = path.resolve('reports', 'accessibility-report.html');
  try {
    fs.existsSync(reportPath) ?? await open(reportPath)
    console.log(`✅ Accessibility report opened: ${reportPath}`);
  } catch (error) {
    console.warn(`⚠️ Could not open report automatically. Please open it manually at: ${reportPath}`);
  }
  
})();
