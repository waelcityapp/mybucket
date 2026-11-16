import type { Language } from '../types';
import type { AdScheduleValue } from '../utils/adSchedule';

type Props = { id: 'start' | 'end'; lang: Language; value: AdScheduleValue; onChange: (value: AdScheduleValue) => void };
const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);
const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export function AdScheduleFields({ id, lang, value, onChange }: Props) {
  const ar = lang === 'ar';
  const isStart = id === 'start';
  const label = ar ? (isStart ? 'بداية النشر' : 'نهاية النشر') : (isStart ? 'Publication start' : 'Publication end');
  const field = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const smallLabel = 'block mb-1 text-xs font-bold text-slate-600';
  const set = (change: Partial<AdScheduleValue>) => onChange({ ...value, ...change });
  return <fieldset className="rounded-xl border border-slate-200 p-3 space-y-3">
    <legend className="px-1 text-sm font-extrabold text-slate-800">{label}</legend>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-2">
      <label><span className={smallLabel}>{ar ? 'اليوم' : 'Day'}</span><select aria-label={`${label} - ${ar ? 'اليوم' : 'Day'}`} required value={value.day} onChange={e => set({ day: e.target.value })} className={field}>
        <option value="">{ar ? 'اليوم' : 'Day'}</option>{dayOptions.map(day => <option key={day} value={day}>{day}</option>)}
      </select></label>
      <label><span className={smallLabel}>{ar ? 'الشهر' : 'Month'}</span><select aria-label={`${label} - ${ar ? 'الشهر' : 'Month'}`} required value={value.month} onChange={e => set({ month: e.target.value })} className={field}>
        <option value="">{ar ? 'الشهر' : 'Month'}</option>{(ar ? monthsAr : monthsEn).map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
      </select></label>
      <label><span className={smallLabel}>{ar ? 'السنة' : 'Year'}</span><input aria-label={`${label} - ${ar ? 'السنة' : 'Year'}`} type="number" inputMode="numeric" min="1900" max="2100" required placeholder={ar ? 'السنة' : 'Year'} value={value.year} onChange={e => set({ year: e.target.value })} className={field} /></label>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <label><span className={smallLabel}>{ar ? 'الساعة' : 'Hour'}</span><select aria-label={`${label} - ${ar ? 'الساعة' : 'Hour'}`} required value={value.hour} onChange={e => set({ hour: e.target.value })} className={field}>
        <option value="">{ar ? 'الساعة' : 'Hour'}</option>{hourOptions.map(hour => <option key={hour} value={hour}>{hour}</option>)}
      </select></label>
      <label><span className={smallLabel}>{ar ? 'الدقيقة' : 'Minute'}</span><select aria-label={`${label} - ${ar ? 'الدقيقة' : 'Minute'}`} required value={value.minute} onChange={e => set({ minute: e.target.value })} className={field}>
        <option value="">{ar ? 'الدقيقة' : 'Minute'}</option>{minuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}
      </select></label>
      <label><span className={smallLabel}>{ar ? 'الفترة' : 'Period'}</span><select aria-label={`${label} - ${ar ? 'الفترة' : 'Period'}`} required value={value.period} onChange={e => set({ period: e.target.value as AdScheduleValue['period'] })} className={field}>
        <option value="">{ar ? 'اختر' : 'Select'}</option><option value="am">{ar ? 'صباحًا' : 'AM'}</option><option value="pm">{ar ? 'مساءً' : 'PM'}</option>
      </select></label>
    </div>
  </fieldset>;
}
