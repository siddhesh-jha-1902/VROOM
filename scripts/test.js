import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request => console.log('FAIL:', request.url(), request.failure().errorText));
  page.on('response', response => {
    if (!response.ok()) console.log('RESP ERROR:', response.url(), response.status());
  });

  await page.goto('http://localhost:5173/user', { waitUntil: 'networkidle2' });
  
  const html = await page.$eval('body', el => el.innerHTML);
  console.log('--- BODY HTML START ---');
  console.log(html);
  console.log('--- BODY HTML END ---');
  
  await browser.close();
})();
