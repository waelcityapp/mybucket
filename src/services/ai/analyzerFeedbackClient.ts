import { auth } from '../../lib/firebase';

export type FeedbackRating = 'bad'|'acceptable'|'good'|'very_good';
export type FeedbackErrorSource = 'speech'|'analysis'|'both'|'unspecified';
export type FeedbackStatus = 'new'|'reviewing'|'resolved';
export type FeedbackConfig = {
  enabled:boolean;
  startDate:string;
  durationDays:number;
  frequency:1|3|5;
  active:boolean;
};
export type AnalyzerFeedbackContext = {
  analyzedText:string;
  originalText:string;
  inputSource:'voice'|'text';
  analysisId:string;
  appRevision:string;
};
export type AnalyzerFeedbackReport = {
  id:string;
  rating: FeedbackRating;
  status:FeedbackStatus;
  inputSource:'voice'|'text';
  errorSource:FeedbackErrorSource;
  originalText:string;
  analyzedText:string;
  spokenCorrection:string;
  correction:string;
  appRevision:string;
  createdAt:string|null;
};
export async function feedbackRequest<T>(action:string, payload:Record<string,unknown>={}):Promise<T>{
  const user=auth.currentUser;
  if(!user) throw new Error('login_required');
  const token=await user.getIdToken();
  const response=await fetch('/api/gateway',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({action,payload}),
  });
  const body=await response.json();
  if(!response.ok || !body.ok)throw new Error(body?.error||body?.message||'feedback_request_failed');
  return body.data as T;
}
