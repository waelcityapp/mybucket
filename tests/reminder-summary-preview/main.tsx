import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { ReminderHomeCards } from '../../src/components/ReminderHomeCards';
window.fetch=async (_url,init)=>{const {action}=JSON.parse(String(init?.body||'{}'));if(action==='reminders.monthSummary') return new Response(JSON.stringify({ok:true,data:{month:'2026-11',totals:{EGP:{obligations:5000,receivables:1500},USD:{obligations:0,receivables:90}}}}),{status:200,headers:{'content-type':'application/json'}});return new Response('{}',{status:404});};
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-xl p-4"><ReminderHomeCards lang="ar" onOpen={kind=>{(window as any).__opened=kind;}} /></main>);
