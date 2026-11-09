const puppeteer = require('puppeteer');

module.exports = async function renderPdf(html, outputPath) {
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true
    });
  } finally {
    await browser.close();
  }
};