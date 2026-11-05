import { useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Language } from '../../types';

interface AdminPinViewProps {
  lang: Language;
  onBack: () => void;
  onVerify: (pin: string) => boolean;
}

export function AdminPinView({ lang, onBack, onVerify }: AdminPinViewProps) {
  const [pin, setPin] = useState('');
  const [invalid, setInvalid] = useState(false);
  const isAr = lang === 'ar';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onVerify(pin)) { setInvalid(true); setPin(''); }
  };
  return (
    <section className="space-y-6 pb-20" aria-labelledby="admin-pin-heading">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700">
        {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        {isAr ? 'العودة' : 'Back'}
      </button>
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-emerald-700" /></div>
        <div className="space-y-1">
          <h1 id="admin-pin-heading" className="text-xl font-extrabold text-slate-900">{isAr ? 'الدخول إلى لوحة الإدارة' : 'Open admin dashboard'}</h1>
          <p className="text-xs text-slate-500">{isAr ? 'أدخل الرقم السري للمتابعة' : 'Enter your PIN to continue'}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="admin-pin" className="block text-sm font-bold text-slate-700">{isAr ? 'الرقم السري' : 'Admin PIN'}</label>
          <div className="relative">
            <LockKeyhole className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400" />
            <input id="admin-pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" autoFocus required value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setInvalid(false); }} className="w-full border border-slate-300 rounded-xl py-3 ps-10 pe-4 text-slate-900 tracking-widest outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {invalid && <p role="alert" className="text-sm font-bold text-rose-600">{isAr ? 'الرقم السري غير صحيح' : 'Incorrect PIN'}</p>}
          <button type="submit" disabled={pin.length !== 4} className="w-full rounded-xl bg-emerald-600 text-white font-bold py-3 hover:bg-emerald-700 disabled:opacity-50">{isAr ? 'دخول لوحة الإدارة' : 'Open dashboard'}</button>
        </form>
      </div>
    </section>
  );
}
