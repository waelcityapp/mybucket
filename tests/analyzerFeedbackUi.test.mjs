import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=(f)=>readFileSync(f,'utf8');
const modal=src('src/components/TransactionModal.tsx');
const settings=src('src/components/views/SettingsView.tsx');
const admin=src('src/components/views/AdminView.tsx');
const dashboard=src('src/components/views/AnalyzerFeedbackAdmin.tsx');
const app=src('src/App.tsx');
const history=src('src/utils/navigationHistory.ts');
const card=src('src/components/AnalyzerFeedbackCard.tsx');

assert.ok(modal.includes('{!showDateTimeEditor && <button'), 'When date editor is open, summary should be hidden');
assert.ok(modal.includes('{showDateTimeEditor && ('), 'Date/time inputs still work');
assert.ok(modal.includes('onClick={() => setShowDateTimeEditor(true)}'), 'Collapsed summary opens editor');
assert.ok(modal.includes('setShowDateTimeEditor(Boolean(initialValues))'), 'Existing editor opening behavior preserved');

assert.ok(settings.includes('isAdmin && onOpenFeedbackAdmin'), 'Settings shows direct link to admin only');
assert.ok(settings.indexOf('isAdmin && onOpenFeedbackAdmin') < settings.indexOf('Google Account & Cloud Sync Section'), 'Link is visible at top of settings');
assert.ok(admin.indexOf('onClick={onOpenFeedbackAdmin}') < admin.indexOf('onClick={handleZeroBalances}'), 'Feedback link is visible above destructive controls');
assert.ok(dashboard.includes("useState<'reports'|'settings'>('settings')"), 'Admin feedback opens on settings so pilot can be activated');

assert.ok(history.includes("if (path === '/admin/analyzer-feedback') return 'admin'"), 'Deep link can be refreshed');
assert.ok(app.includes("window.history.pushState({ myBucketTab:'admin', feedbackAdmin:true }, '', '/admin/analyzer-feedback')"), 'Admin feedback opens as full linked page');
assert.ok(app.includes("window.history.state?.feedbackAdmin"), 'Back behavior respects history');
assert.ok(app.includes("window.location.pathname === '/admin/analyzer-feedback'"), 'Special route renders feedback page');
assert.ok(app.includes("onOpenFeedbackAdmin={openFeedbackAdmin}"), 'Settings page directly opens feedback');
assert.ok(app.includes("<AnalyzerFeedbackAdmin lang={lang} onBack={closeFeedbackAdmin} />"), 'Feedback admin renders on the dedicated page');
assert.ok(card.includes("setAdminStatus('off')"), 'Admin gets an explanation when campaign is disabled');
assert.ok(card.includes("setAdminStatus('error')"), 'Admin gets an error when config endpoint fails');

assert.ok(modal.includes('isAiProposal && feedbackContext && <AnalyzerFeedbackCard'), 'Ratings only for interpreted drafts');
console.log('PASS feedback UI placement, deep link, disabled notice, date/time single presentation, manual entry exclusion');
