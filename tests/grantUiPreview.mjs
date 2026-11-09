import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const server=spawn('node_modules/.bin/vite',['--config','tests/grant-preview/vite.config.ts'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<60;i++){try{const response=await fetch('http://127.0.0.1:4178/tests/grant-preview/index.html');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'preview server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    page.on('console', msg => console.log('browser:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('browser-error:', err.message));
    page.on('response', response => { if (response.status() >= 400) console.log('http-error:', response.status(), response.url()); });
    await page.goto('http://127.0.0.1:4178/tests/grant-preview/index.html');
    await page.getByText('سارة محمد').waitFor();
    await page.screenshot({path:`grant-preview-${viewport.width}.png`,fullPage:true});
    await page.locator('select').first().selectOption('pro');
    await page.getByLabel('عدد أيام المنحة').fill('90');
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
    await page.getByRole('button',{name:'عرض المستخدمين'}).click();
    await page.getByText('وائل عوض').waitFor();
    await page.getByPlaceholder('بحث بالاسم أو البريد').fill('و');
    await page.getByText('وائل عوض').waitFor();
    assert.equal(await page.getByText('سارة محمد', { exact: true }).count(), 1); // Grant preview only; no user row.
    await page.getByPlaceholder('بحث بالاسم أو البريد').fill('لا يوجد');
    await page.getByText('لا يوجد مستخدمون يطابقون البحث.').waitFor();
    await page.getByText('الخطة الحالية: Basic').waitFor();
    await page.getByText('التسجيلات: 3 من 10 · المتبقي 7').waitFor();
    await page.getByText('الاستعلامات: 1 من 2 · المتبقي 1').waitFor();
    assert.equal(await page.getByText('تحديث الاستخدام').count(), 0);
    const readsBefore = await page.evaluate(() => window.__quotaReads);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(previous => window.__quotaReads > previous, readsBefore);
    await page.locator('#affiliate-redeem-input').fill('WAEL2026');
    await page.locator('#btn-apply-promo-code').click();
    await page.getByText('تم تطبيق خصم Pro دون إضافة أيام تجربة.').waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=1,`horizontal overflow at ${viewport.width}px: ${overflow}`);
    await page.close();
  }
  console.log('PASS grant and quota controls on desktop and mobile with isolated mock data');
} finally {await browser?.close();server.kill('SIGTERM');}
