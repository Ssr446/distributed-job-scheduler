import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('PAGE RESPONSE:', response.url(), response.status()));

  console.log('Navigating to http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173');
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('URL:', page.url());

  if (page.url().includes('/login')) {
    await page.type('input[type="email"]', 'admin@scheduler.io');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('URL:', page.url());
  }
  
  await browser.close();
})();
