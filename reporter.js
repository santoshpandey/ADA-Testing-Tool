const fs = require('fs');
const path = require('path');

function generateHTMLReport(results) {
  const rows = results.map(result => {
    const screenshotRelativePath = path.relative(
      path.join(__dirname, 'reports'),
      result.screenshotPath
    ).replace(/\\/g, '/');

    /*
    TO DO
    const critical = result.violations.filter(v => v.impact === 'critical').length;
    const serious = result.violations.filter(v => v.impact === 'serious').length;
    const moderate = result.violations.filter(v => v.impact === 'moderate').length;
    const minor = result.violations.filter(v => v.impact === 'minor').length;
    */

    return `
      <tr class="result-row">
        <td>${result.screen}</td>
        <td><a href="${result.url}" target="_blank">${result.url}</a></td>
        <td>${result.score}</td>
        <td>${result.passed ? '✅' : '❌'}</td>
        <td>${result.issues}</td>
        <td><button onclick="toggleDetails(this)">View Issues</button></td>
      </tr>
      <tr class="details-row" style="display:none;">
  <td colspan="6">
    <ul>
      ${result.violations.map(v => `
        <li>
          <strong>${v.id}</strong> (${v.impact}) — ${v.description}<br/>
          <strong>⚠️ Priority:</strong> ${v.impact} <br>
          <em><a href="${v.helpUrl}" target="_blank">Learn more</a></em>
          <ul>
            ${v.nodes.map(n => `
              <li>
                <code>${n.html}</code><br/>
                Target: <code>${n.target.join(', ')}</code><br/>
                <em><strong>Issue:</strong> ${n.failureSummary}</em>
                ${n.suggestedFixes ? `<strong>Suggested Fix:</strong> ${n.suggestedFixes}` : ''}
                ${n.keyboardCheck ? `<br/><strong>Keyboard Access:</strong> ${n.keyboardCheck}` : ''}
              </li>
            `).join('')}
          </ul>
        </li>
      `).join('')}
    </ul><img class="screenShot" src="${screenshotRelativePath}" width="300" />
  </td>
</tr>
    `;
  }).join('');

  const html = `
    <html>
      <head>
        <title>AE ADA Testing Utility tool</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
          h1 { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th, td { padding: 10px; border: 1px solid #ccc; vertical-align: top; }
          tr.result-row { background-color: #f4f4f4; cursor: pointer; }
          tr.details-row { display: none; background-color: #fafafa; }
          .severity-badges { font-size: 0.85em; margin-top: 5px; }
          img { border: 1px solid #999; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Accessibility Report</h1>
        <table>
          <thead>
            <tr>
              <th>Screen</th>
              <th>URL</th>
              <th>Score & Severity</th>
              <th>Pass</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>
            function toggleDetails(button) {
              const row = button.closest('tr');
              const detailsRow = row.nextElementSibling;
              if (detailsRow && detailsRow.classList.contains('details-row')) {
                detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
              }
            }
          </script>
      </body>
    </html>
  `;

  fs.writeFileSync(path.join('reports', 'accessibility-report.html'), html);
  console.log('✅ Report generated: reports/accessibility-report.html');
}
module.exports = {
  generateHTMLReport
};
