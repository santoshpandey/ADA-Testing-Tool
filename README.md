# ADA-Testing-Tool
This tool automates accessibility scans for web pages using [Puppeteer](https://github.com/puppeteer/puppeteer) and [axe-core](https://github.com/dequelabs/axe-core), supporting login sessions, dynamic page handling, and WCAG 2.2 (A, AA) standards.

## Project Structure

├── configs
   ├──  config.demo.json
├── login.js
├── reporter.js
├── testRunner.js
├── reports/
│ ├── screenshots/
│ └── report.html

## ✅ Features
- Logs into your web app using credentials
- Waits for dynamic and lazy-loaded content
- Runs Axe-core accessibility scans (WCAG 2.2 A, AA, Section 508)
- Generates HTML report with score, issues, and screenshots
- Expand/collapse per-page issue details
- Can Supports multiple environments via CLI

- ## Setup

```bash
npm install

## Usage
## create config file for each env with the required details
## Run accessibility tests by passing an environment config file like this: npm run test:**env**

bash
Copy
Edit
