import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin';

export type Rating = 'bad' | 'acceptable' | 'good' | 'very_good';
export type ErrorSource = 'speech' | 'analysis' | 'both' | 'unspecified';
export type ReportStatus = 'new' | 'reviewing' | 'resolved';

export type FeedbackSettings = {
  enabled: boolean;
  startDate: string;
  durationDays: number; // 0: until admin manually disables
  frequency: 1 | 3 | 5;
};
const CONFIG = 'localAnalyzerFeedback';
const defaults: FeedbackSettings = { enabled: false, startDate: '', durationDays: 14, frequency: 1 };
const ratings: Rating[] = ['bad','acceptable','good','very_good'];
const errorSources: ErrorSource[] = ['speech','analysis','both','unspecified'];
const statuses: ReportStatus[] = ['new','reviewing','resolved'];
const MAX_DAILY_REPORTS = 100;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(d: unknown): d is string {
  if (typeof d !== 'string' || !datePattern.test(d)) return false;
  const test = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(test.getTime()) && test.toISOString().slice(0, 10) === d;
}

export function normalizeSettings(value: any): FeedbackSettings {
  return {
    enabled: value?.enabled === true,
    startDate: validDate(value?.startDate) ? value.startDate : '',
    durationDays: Number.isInteger(value?.durationDays) && value.durationDays >= 0 && value.durationDays <= 365 ? value.durationDays : 14,
    frequency: [1,3,5].includes(value?.frequency) ? value.frequency : 1,
  };
}
export function isFeedbackActive(settings: FeedbackSettings, at = new Date()): boolean {
  if (!settings.enabled || !settings.startDate) return false;
  // Dates are calendar days in Cairo regardless of the server's time zone.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(at).reduce((o:Record<string,string>, part) => ({...o,[part.type]:part.value}), {});
  const cairoDay = today.year + '-' + today.month + '-' + today.day;
  if (cairoDay < settings.startDate) return false;
  if (settings.durationDays === 0) return true;
  const until = new Date(settings.startDate + 'T00:00:00Z');
  until.setUTCDate(until.getUTCDate() + settings.durationDays);
  return cairoDay < until.toISOString().slice(0, 10);
}
const configRef = () => getAdminFirestore().collection('systemConfigs').doc(CONFIG);
export async function getFeedbackSettings(): Promise<FeedbackSettings & { active:boolean }> {
  const doc = await configRef().get();
  const settings = normalizeSettings(doc.exists ? doc.data() : defaults);
  return { ...settings, active: isFeedbackActive(settings) };
}
export async function updateFeedbackSettings(payload: any) {
  if (typeof payload?.enabled !== 'boolean' || !validDate(payload?.startDate) ||
      !(Number.isInteger(payload?.durationDays) && payload.durationDays >= 0 && payload.durationDays <= 365) || ![1,3,5].includes(payload?.frequency)) {
    throw new Error('invalid_feedback_settings');
  }
  const settings = normalizeSettings(payload);
  await configRef().set({ ...settings, updatedAt: FieldValue.serverTimestamp() });
  return { ...settings, active: isFeedbackActive(settings) };
}
const cleanText = (x:unknown, limit:number) => typeof x === 'string' ? x.trim().slice(0,limit) : '';
export async function submitFeedback(payload:any, uid:string) {
  const settings = await getFeedbackSettings();
  if (!settings.active) throw new Error('feedback_disabled');
  const rating = payload?.rating;
  if (!ratings.includes(rating)) throw new Error('invalid_rating');
  const needsDetails = rating === 'bad' || rating === 'acceptable';
  const originalText = cleanText(payload?.originalText, 1500);
  const analyzedText = cleanText(payload?.analyzedText, 1500);
  const correction = cleanText(payload?.correction, 1500);
  const spokenCorrection = cleanText(payload?.spokenCorrection, 1500);
  const source = payload?.inputSource === 'voice' ? 'voice' : 'text';
  const errorSource = errorSources.includes(payload?.errorSource) ? payload.errorSource : 'unspecified';
  if (needsDetails && (payload?.consent !== true || !originalText || !analyzedText || !correction)) {
    throw new Error('feedback_details_and_consent_required');
  }
  const report = {
    rating,
    status: 'new' as ReportStatus,
    inputSource: source,
    errorSource: needsDetails ? errorSource : 'unspecified',
    originalText: needsDetails ? originalText : '',
    analyzedText: needsDetails ? analyzedText : '',
    correction: needsDetails ? correction : '',
    spokenCorrection: needsDetails && source === 'voice' ? spokenCorrection : '',
    appRevision: cleanText(payload?.appRevision, 24),
    createdAt: FieldValue.serverTimestamp(),
  };
  const db=getAdminFirestore();
  const doc = db.collection('analyzerFeedback').doc();
  const day=new Date().toISOString().slice(0,10);
  const counter=db.collection('analyzerFeedbackQuotas').doc(uid+'_'+day);
  // Atomic per-user daily quota protects Firestore from repeated accidental or malicious sends.
  await db.runTransaction(async tx=>{
    const countDoc=await tx.get(counter);
    const count=typeof countDoc.data()?.count==='number' ? countDoc.data()!.count as number : 0;
    if (count>=MAX_DAILY_REPORTS) throw new Error('feedback_daily_limit');
    tx.set(counter,{count:count+1,day,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.create(doc,report);
  });
  return { id:doc.id };
}
export async function listFeedbackReports() {
  const snap = await getAdminFirestore().collection('analyzerFeedback').orderBy('createdAt', 'desc').limit(200).get();
  return snap.docs.map(doc => {
    const value = doc.data();
    return { id:doc.id,...value,createdAt:value.createdAt?.toDate?.()?.toISOString() || null };
  });
}
export async function updateFeedbackStatus(payload:any) {
  if (typeof payload?.id !== 'string' || !/^[A-Za-z0-9]{12,40}$/.test(payload.id) ||
      !statuses.includes(payload?.status)) throw new Error('invalid_feedback_status');
  const ref = getAdminFirestore().collection('analyzerFeedback').doc(payload.id);
  if (!(await ref.get()).exists) throw new Error('feedback_not_found');
  await ref.update({status:payload.status,reviewedAt:FieldValue.serverTimestamp()});
  return {id:payload.id,status:payload.status};
}
