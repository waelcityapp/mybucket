import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { AdminUserGrantView } from '../../src/components/views/AdminUserGrantView';
import { AdminAiQuotaSettings } from '../../src/components/views/AdminAiQuotaSettings';
let grant: Record<string,unknown>|null=null;
let limits={basicLocalEntries:10,basicLocalInquiries:2,proGeminiEntries:15,proGeminiInquiries:5,proLocalEntries:30,proLocalInquiries:10};
window.fetch=async (_url,init)=>{
  const {action,payload}=JSON.parse(String(init?.body||'{}'));
  let data:unknown={};
  if(action==='admin.grant.get') data={uid:'sample',name:'سارة محمد',email:'demo@example.com',paidAccessUntil:null,grant};
  if(action==='admin.grant.set') grant={plan:payload.plan,startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+60*86400000).toISOString(),active:true,reason:payload.reason,note:payload.note};
  if(action==='admin.grant.end' && grant) grant={...grant,active:false};
  if(action==='admin.aiQuota.get') data=limits;
  if(action==='admin.aiQuota.save') {limits={...payload};data=limits;}
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:{'content-type':'application/json'}});
};
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-3xl space-y-4 p-4"><AdminUserGrantView uid="sample" lang="ar" onBack={()=>{}} /><AdminAiQuotaSettings lang="ar" /></main>);
