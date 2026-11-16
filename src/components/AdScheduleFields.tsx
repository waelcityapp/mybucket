import { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Clock3, X } from 'lucide-react';
import type { Language } from '../types';
import { adScheduleDate, type AdScheduleValue } from '../utils/adSchedule';

type Props = { id: 'start' | 'end'; lang: Language; value: AdScheduleValue; onChange: (value: AdScheduleValue) => void };

const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1);
const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1);
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

export function AdScheduleFields({ id, lang, value, onChange }: Props) {
  const ar = lang === 'ar';
  const label = ar
    ? (id === 'start' ? 'بداية النشر' : 'نهاية النشر')
    : (id === 'start' ? 'Publication start' : 'Publication end');
  const selectedDate = adScheduleDate(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdScheduleValue>(value);
  const [pickerError, setPickerError] = useState(false);

  const field = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const smallLabel = 'block mb-1 text-xs font-bold text-slate-600';

  const openPicker = () => {
    if (open) { setOpen(false); return; }
    // Capture the user's device-local date and time at the exact moment
    // the calendar is opened. Previously confirmed dates are preserved.
    if (adScheduleDate(value)) {
      setDraft(value);
    } else {
      const now = new Date();
      const hour = now.getHours();
      setDraft({
        day: String(now.getDate()),
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        hour: String(hour % 12 || 12),
        minute: String(now.getMinutes()).padStart(2, '0'),
        period: hour < 12 ? 'am' : 'pm',
      });
    }
    setPickerError(false);
    setOpen(true);
  };

  const cancel = () => {
    setDraft(value);
    setPickerError(false);
    setOpen(false);
  };

  const updateDraft = (change: Partial<AdScheduleValue>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    setPickerError(false);
  };

  const confirm = () => {
    if (!adScheduleDate(draft)) { setPickerError(true); return; }
    onChange(draft);
    setOpen(false);
    setPickerError(false);
  };

  const locale = ar ? 'ar-EG' : 'en-GB';
  const dateText = selectedDate?.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const timeText = selectedDate?.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const panelId = 'ad-schedule-' + id;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button type="button" onClick={openPicker} aria-controls={panelId} aria-expanded={open}
        aria-label={ar ? 'اختيار ' + label : 'Choose ' + label}
        className="w-full min-h-[76px] flex items-center gap-3 px-3 py-3 text-start hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500">
        <span className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-extrabold text-slate-700 mb-1">{label}</span>
          {selectedDate ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-slate-900" aria-live="polite">
              <span>{dateText}</span>
              <span className="inline-flex items-center gap-1 text-emerald-700"><Clock3 className="w-3.5 h-3.5" /><span>{timeText}</span></span>
            </span>
          ) : (
            <span className="block text-sm text-slate-500">{ar ? 'اضغط لاختيار التاريخ والساعة' : 'Tap to select date and time'}</span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div id={panelId} className="border-t border-slate-100 bg-slate-50/70 p-3 space-y-3"
          onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-slate-700">{ar ? 'اختر التاريخ والوقت' : 'Choose date and time'}</p>
            <button type="button" onClick={cancel} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />{ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-2">
            <label><span className={smallLabel}>{ar ? 'اليوم' : 'Day'}</span>
              <select aria-label={label + ' - ' + (ar ? 'اليوم' : 'Day')} value={draft.day}
                onChange={event => updateDraft({ day: event.target.value })} className={field}>
                <option value="">{ar ? 'اليوم' : 'Day'}</option>
                {dayOptions.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label><span className={smallLabel}>{ar ? 'الشهر' : 'Month'}</span>
              <select aria-label={label + ' - ' + (ar ? 'الشهر' : 'Month')} value={draft.month}
                onChange={event => updateDraft({ month: event.target.value })} className={field}>
                <option value="">{ar ? 'الشهر' : 'Month'}</option>
                {(ar ? monthsAr : monthsEn).map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
            <label><span className={smallLabel}>{ar ? 'السنة' : 'Year'}</span>
              <input aria-label={label + ' - ' + (ar ? 'السنة' : 'Year')} type="number" inputMode="numeric"
                min="1900" max="2100" placeholder={ar ? 'السنة' : 'Year'} value={draft.year}
                onChange={event => updateDraft({ year: event.target.value })} className={field} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label><span className={smallLabel}>{ar ? 'الساعة' : 'Hour'}</span>
              <select aria-label={label + ' - ' + (ar ? 'الساعة' : 'Hour')} value={draft.hour}
                onChange={event => updateDraft({ hour: event.target.value })} className={field}>
                <option value="">{ar ? 'الساعة' : 'Hour'}</option>
                {hourOptions.map(hour => <option key={hour} value={hour}>{hour}</option>)}
              </select>
            </label>
            <label><span className={smallLabel}>{ar ? 'الدقيقة' : 'Minute'}</span>
              <select aria-label={label + ' - ' + (ar ? 'الدقيقة' : 'Minute')} value={draft.minute}
                onChange={event => updateDraft({ minute: event.target.value })} className={field}>
                <option value="">{ar ? 'الدقيقة' : 'Minute'}</option>
                {minuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </label>
            <label><span className={smallLabel}>{ar ? 'الفترة' : 'Period'}</span>
              <select aria-label={label + ' - ' + (ar ? 'الفترة' : 'Period')} value={draft.period}
                onChange={event => updateDraft({ period: event.target.value as AdScheduleValue['period'] })} className={field}>
                <option value="">{ar ? 'اختر' : 'Select'}</option>
                <option value="am">{ar ? 'صباحًا' : 'AM'}</option>
                <option value="pm">{ar ? 'مساءً' : 'PM'}</option>
              </select>
            </label>
          </div>
          {pickerError && <p role="alert" className="text-xs font-bold text-red-700">
            {ar ? 'يرجى اختيار تاريخ ووقت صحيحين.' : 'Please choose a valid date and time.'}
          </p>}
          <button type="button" onClick={confirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2.5 text-sm font-extrabold text-white">
            <Check className="w-4 h-4" />{ar ? 'تم اختيار الموعد' : 'Confirm date and time'}
          </button>
        </div>
      )}
    </div>
  );
}
