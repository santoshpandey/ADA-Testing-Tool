async function login(page, credentials) {
  console.log("🔐 Navigating to login page...");
  await page.goto(credentials.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log("⌛ Waiting for login button (ensures page is loaded)...");
  await page.waitForSelector('#btnLogin_I', { timeout: 60000 });

  // Optional small pause after page appears stable
  await new Promise(resolve => setTimeout(resolve, 1000));


  // Wait for and type into username field
  console.log("Typing username...");
  await page.waitForSelector(credentials.usernameSelector, { visible: true });
  await page.click(credentials.usernameSelector, { clickCount: 3 });
  await page.keyboard.type(credentials.username, { delay: 100 });

  // give page time to handle input scripts
  await new Promise(resolve => setTimeout(resolve, 200));

  await page.keyboard.press('Tab');
  // Wait for and type into password field
  console.log("Typing password...");
  await page.evaluate(() => console.log('Focused element:', document.activeElement.id));
  await page.waitForSelector(credentials.passwordSelector, { visible: true });
  await page.click(credentials.passwordSelector, { clickCount: 3 });
  await page.keyboard.type(credentials.password, { delay: 100 });

  // small wait before submitting 
    await new Promise(resolve => setTimeout(resolve, 100));


  console.log("Submitting login form...");
  if (credentials.loginButtonSelector) {
    await page.waitForSelector(credentials.loginButtonSelector, { visible: true });
    await page.click(credentials.loginButtonSelector);
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for dashboard/landing page after login
  console.log("Waiting for dashboard to load...");
  await page.waitForSelector('#coreApplication', { timeout: 60000 });

  console.log("✅ Logged in and dashboard loaded.");
  await new Promise(resolve => setTimeout(resolve, 2000));

}

module.exports = { login };
