import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const server=spawn('node_modules/.bin/vite',['--config','tests/grant-preview/vite.config.ts'],{stdio:'inherit'});let browser;
try {
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4178/tests/reminder-workspace-preview/index.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const page=await browser.newPage({viewport});await page.goto('http://127.0.0.1:4178/tests/reminder-workspace-preview/index.html');
  await page.getByText('غير مسدد · قادم').first().waitFor();
  await page.getByRole('button',{name:'تعديل البند'}).click();await page.getByRole('heading',{name:'تعديل البند'}).waitFor();
  assert.equal(await page.getByLabel('المبلغ',{exact:true}).inputValue(),'3000');
  await page.getByLabel('المبلغ',{exact:true}).fill('2500');await page.getByRole('button',{name:'حفظ البند'}).click();
  await page.getByText(/٢٬٥٠٠/).first().waitFor();
  await page.getByRole('button',{name:'تعديل الاستحقاق'}).nth(1).click();
  await page.getByLabel('المبلغ',{exact:true}).fill('4000');await page.getByText('الاستحقاق المختار وكل المواعيد القادمة').click();await page.getByRole('button',{name:'حفظ البند'}).click();
  await page.getByText(/٤٬٠٠٠/).first().waitFor();
  const paid=page.getByRole('checkbox',{name:'السداد'}).first();const paidLabel=page.locator('article').first().locator('label');assert.equal(await paid.isChecked(),false);await paidLabel.click();await page.getByText('مسدد',{exact:true}).first().waitFor();assert.equal(await paid.isChecked(),true);await page.waitForFunction(()=>!document.querySelector('article input[type=checkbox]').disabled);await paidLabel.click();await page.waitForFunction(()=>!document.querySelector('article input[type=checkbox]').checked);assert.equal(await paid.isChecked(),false);
  await page.getByRole('button',{name:'حذف الاستحقاق'}).nth(1).click();await page.getByText('حذف هذا الاستحقاق فقط؟').waitFor();
  await page.evaluate(()=>window.failDelete=true);await page.getByRole('button',{name:'تأكيد الحذف'}).click();await page.getByText(/تعذر تنفيذ العملية/).waitFor();
  await page.evaluate(()=>window.failDelete=false);await page.getByRole('button',{name:'تأكيد الحذف'}).click();await page.getByRole('heading',{name:'مواعيد الاستحقاق'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'حذف الاستحقاق'}).count(),2);
  await page.getByRole('button',{name:'حذف البند بالكامل'}).click();await page.getByText('حذف البند بالكامل وجميع مواعيده؟').waitFor();await page.getByRole('button',{name:'تأكيد الحذف'}).click();
  await page.getByText('لا توجد بنود في هذا القسم حتى الآن.').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=1);await page.close();
 }
 console.log('PASS reminder editing, payment state and deletion on mobile and desktop');
} finally {await browser?.close();server.kill('SIGTERM');}
