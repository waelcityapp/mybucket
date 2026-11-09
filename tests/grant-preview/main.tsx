import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { AdminUserGrantView } from '../../src/components/views/AdminUserGrantView';
import { AdminAiQuotaSettings } from '../../src/components/views/AdminAiQuotaSettings';
import { AdminAppUsersView } from '../../src/components/views/AdminAppUsersView';
import { SubscriptionCard } from '../../src/components/SubscriptionCard';
import { TrialSubscriptionPages } from '../../src/components/views/TrialSubscriptionPages';
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
  if(action==='ai.quota.status') { (window as any).__quotaReads = ((window as any).__quotaReads || 0) + 1; data={day:'2026-11-10',plan:'basic',local:{entries:{used:3,limit:10,remaining:7},inquiries:{used:1,limit:2,remaining:1}}}; }
  if(action==='admin.users.countFiltered') data={count:2,nextCursor:null,registeredCount:2,installsWithSignedInAccounts:0};
  if(action==='admin.users.list') { const users=[{uid:'a',name:'وائل عوض',email:'wael@example.com',createdAt:'2026-01-01',lastSeenAt:null,online:false,disabled:false,tier:'trial',plan:'Pro',installed:false},{uid:'b',name:'سارة محمد',email:'sara@example.com',createdAt:'2026-01-02',lastSeenAt:null,online:false,disabled:false,tier:'trial',plan:'Pro',installed:false}].filter(u=>!payload.search || u.name.includes(payload.search) || u.email.includes(payload.search)); data={registeredCount:2,registeredCountComplete:true,installsWithSignedInAccounts:0,displayedCount:users.length,users,nextCursor:null}; }
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:{'content-type':'application/json'}});
};
const previewSub={tier:'basic' as const,hasAppliedAffiliateCode:false,totalTrialDays:75,trialStartedAt:new Date(Date.now()-86400000).toISOString(),trialExpiresAt:new Date(Date.now()+86400000).toISOString(),isPaid:false,dailyExpenseAiLimit:10,dailyInquiryAiLimit:2,maxHistoricalQueryDays:35};
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-3xl space-y-4 p-4"><AdminUserGrantView uid="sample" lang="ar" onBack={()=>{}} /><AdminAiQuotaSettings lang="ar" /><AdminAppUsersView lang="ar" onOpenGrant={()=>{}} /><SubscriptionCard subscription={previewSub} lang="ar" /><TrialSubscriptionPages lang="ar" subscription={previewSub} error={null} page="subscription" onBack={()=>{}} onSubscription={()=>{}} onUpdateSubscription={async()=>{}} /></main>);
