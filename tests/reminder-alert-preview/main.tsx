import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { ReminderAlerts } from '../../src/components/ReminderAlerts';
let items = [{id:'one',kind:'obligation',title:'قسط السيارة',amount:100,currency:'EGP',dueDate:'2026-01-01',leadDays:1,remindTime:'00:00',done:false}];
(window as any).addAlert=()=>{items.push({id:'two',kind:'receivable',title:'مستحق آخر',amount:50,currency:'EGP',dueDate:'2026-01-01',leadDays:1,remindTime:'00:00',done:false});};
window.fetch=async(_url,init)=>{const {action,payload}=JSON.parse(String(init?.body||'{}'));if(action==='reminders.toggle')items=items.map(x=>x.id===payload.id?{...x,done:true}:x);if(action==='reminders.alert')items=items.filter(x=>x.id!==payload.id);return new Response(JSON.stringify({ok:true,data:{reminders:items}}),{status:200,headers:{'content-type':'application/json'}});};
function Preview(){const [page,setPage]=useState(false);return <ReminderAlerts uid="mock" lang="ar" page={page} onOpen={()=>setPage(true)} onBack={()=>setPage(false)} />;}
createRoot(document.getElementById('root')!).render(<Preview/>);
