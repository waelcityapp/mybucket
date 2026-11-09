import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const server=spawn('node_modules/.bin/vite',['--config','tests/grant-preview/vite.config.ts'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4178/tests/reminder-alert-preview/index.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
    const page=await browser.newPage({viewport});
    await page.goto('http://127.0.0.1:4178/tests/reminder-alert-preview/index.html');
    await page.getByText('لديك 1 تذكير يحتاج انتباهك').waitFor();
    await page.getByLabel('إخفاء التذكيرات اليوم').click();
    assert.equal(await page.getByText('لديك 1 تذكير يحتاج انتباهك').count(),0);
    await page.reload();
    await page.waitForTimeout(300);
    assert.equal(await page.getByText('لديك 1 تذكير يحتاج انتباهك').count(),0);
    await page.evaluate(()=>{window.addAlert();document.dispatchEvent(new Event('visibilitychange'));});
    await page.getByText('لديك 2 تذكير يحتاج انتباهك').waitFor();
    await page.getByRole('button',{name:'عرض التذكيرات'}).click();
    await page.getByText('قسط السيارة').waitFor();await page.getByText('مستحق آخر').waitFor();
    await page.getByRole('button',{name:'تم السداد'}).click();
    await page.getByText('قسط السيارة').waitFor({state:'detached'});
    await page.getByRole('button',{name:'إيقاف التنبيه'}).click();
    await page.getByText('لا توجد تذكيرات تحتاج انتباهك الآن.').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=1);
    await page.close();
  }
  console.log('PASS reminder banner and page on mobile and desktop');
} finally {await browser?.close();server.kill('SIGTERM');}
