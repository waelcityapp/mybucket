import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const server=spawn('node_modules/.bin/vite',['--config','tests/grant-preview/vite.config.ts'],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<60;i++){try{const response=await fetch('http://127.0.0.1:4178/tests/grant-preview/index.html');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'preview server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    await page.goto('http://127.0.0.1:4178/tests/grant-preview/index.html');
    await page.getByText('سارة محمد').waitFor();
    await page.locator('select').first().selectOption('pro');
    await page.getByRole('button',{name:'3 شهور'}).click();
    assert.ok(await page.locator('input[type=date]').inputValue());
    await page.getByPlaceholder('مثال: فريق المبيعات').fill('فريق المبيعات');
    await page.getByRole('button',{name:'حفظ المنحة'}).click();
    await page.getByText('تم حفظ المنحة المجانية.').waitFor();
    await page.getByRole('button',{name:'إنهاء المنحة',exact:true}).click();
    await page.getByRole('button',{name:'تأكيد إنهاء المنحة'}).click();
    await page.getByText('تم إنهاء المنحة.').waitFor();
    await page.getByLabel('Pro: تسجيلات Gemini').fill('17');
    await page.getByRole('button',{name:'حفظ حدود الاستخدام'}).click();
    await page.getByText('تم حفظ الحدود اليومية.').waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=1,`horizontal overflow at ${viewport.width}px: ${overflow}`);
    await page.close();
  }
  console.log('PASS grant and quota controls on desktop and mobile with isolated mock data');
} finally {await browser?.close();server.kill('SIGTERM');}
