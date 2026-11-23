import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=(f)=>readFileSync(f,'utf8');
const modal=src('src/components/TransactionModal.tsx');
const admin=src('src/components/views/AdminView.tsx');
const dashboard=src('src/components/views/AnalyzerFeedbackAdmin.tsx');
const app=src('src/App.tsx');
const history=src('src/utils/navigationHistory.ts');
const card=src('src/components/AnalyzerFeedbackCard.tsx');

assert.ok(modal.includes('{!showDateTimeEditor && <button'), 'When date editor is open, summary should be hidden');
assert.ok(modal.includes('{showDateTimeEditor && ('), 'Date/time inputs still work');
assert.ok(modal.includes('onClick={() => setShowDateTimeEditor(true)}'), 'Collapsed summary opens editor');
assert.ok(modal.includes('setShowDateTimeEditor(Boolean(initialValues))'), 'Existing editor opening behavior preserved');

assert.ok(admin.includes("id: 'reports' as const"), 'The admin dashboard offers a dedicated reports section');
assert.ok(admin.includes("section.id === 'reports' ? onOpenFeedbackAdmin() : onOpenSection(section.id)"), 'The reports tile opens analyzer feedback');
assert.ok(admin.includes("selected === 'reports'") && admin.includes('onClick={onOpenFeedbackAdmin}'), 'The reports section also contains an explicit feedback link');
assert.ok(dashboard.includes("useState<'reports'|'settings'>('settings')"), 'Admin feedback opens on settings so pilot can be activated');

assert.ok(history.includes("path === '/admin' || path.startsWith('/admin/')"), 'Admin deep links, including analyzer feedback, resolve to the admin tab');
assert.ok(app.includes("window.history.pushState({ myBucketTab:'admin', feedbackAdmin:true }, '', '/admin/analyzer-feedback')"), 'Admin feedback opens as full linked page');
assert.ok(app.includes("window.history.state?.feedbackAdmin"), 'Back behavior respects history');
assert.ok(app.includes("adminRoute === '/admin/analyzer-feedback'"), 'The current admin route renders the feedback page');
assert.ok(app.includes("onOpenFeedbackAdmin={openFeedbackAdmin}"), 'The admin dashboard receives the feedback navigation handler');
assert.ok(app.includes("<AnalyzerFeedbackAdmin lang={lang} onBack={closeFeedbackAdmin} />"), 'Feedback admin renders on the dedicated page');
assert.ok(card.includes("setAdminStatus('off')"), 'Admin gets an explanation when campaign is disabled');
assert.ok(card.includes("setAdminStatus('error')"), 'Admin gets an error when config endpoint fails');

assert.ok(modal.includes('isAiProposal && feedbackContext && <AnalyzerFeedbackCard'), 'Ratings only for interpreted drafts');
console.log('PASS feedback UI placement, deep link, disabled notice, date/time single presentation, manual entry exclusion');
