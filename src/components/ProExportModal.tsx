import { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { Language, Transaction } from '../types';

export type ExportFormat = 'csv' | 'pdf';

interface ProExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  title?: string;
  transactions: Transaction[];
  initialFormat: ExportFormat;
}

export function reportCsvCell(value: string | number) {
  if (typeof value === 'number') return String(value);
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function ProExportModal({ isOpen, onClose, lang, title, transactions, initialFormat }: ProExportModalProps) {
  const ar = lang === 'ar';
  const [format, setFormat] = useState(initialFormat);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const inFlight = useRef(false);
  if (!isOpen) return null;

  const heading = title || (ar ? 'كشف العمليات' : 'Transaction report');

  async function exportReport() {
    if (inFlight.current || !transactions.length) return;
    inFlight.current = true;
    setRunning(true);
    setNotice(null);
    let report: Window | null = null;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('authentication_required');
      if (format === 'pdf') {
        report = window.open('', '_blank');
        if (!report) throw new Error('popup_blocked');
        report.opener = null;
      }
      const headers = ar
        ? ['التاريخ', 'الوقت', 'النوع', 'المبلغ', 'العملة', 'الملاحظات']
        : ['Date', 'Time', 'Type', 'Amount', 'Currency', 'Notes'];
      const labels = ar ? { income: 'دخل', expense: 'مصروف', transfer: 'تحويل' } : { income: 'Income', expense: 'Expense', transfer: 'Transfer' };
      const rows = transactions.map(item => [item.date, item.time ?? '', labels[item.type], item.amount, item.currency, item.description ?? '']);
      const response = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
        body: JSON.stringify({ action: 'report.export.reserve', payload: { format } }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error);
      if (auth.currentUser?.uid !== user.uid) throw new Error('authentication_required');

      if (report) {
        const doc = report.document;
        doc.title = heading;
        doc.documentElement.lang = lang;
        doc.documentElement.dir = ar ? 'rtl' : 'ltr';
        const style = doc.createElement('style');
        style.textContent = 'body{font:14px sans-serif;margin:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:6px;text-align:start;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}';
        doc.head.append(style);
        const header = doc.createElement('h1');
        header.textContent = heading;
        const table = doc.createElement('table');
        const headerRow = table.createTHead().insertRow();
        for (const field of headers) {
          const cell = doc.createElement('th');
          cell.scope = 'col';
          cell.textContent = field;
          headerRow.append(cell);
        }
        const body = table.createTBody();
        for (const row of rows) {
          const element = body.insertRow();
          for (const field of row) element.insertCell().textContent = String(field);
        }
        doc.body.append(header, table);
        report.print();
      } else {
        const contents = [headers, ...rows].map(row => row.map(reportCsvCell).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF', contents], { type: 'text/csv;charset=utf-8' }));
        const download = document.createElement('a');
        download.href = url;
        download.download = 'mybucket-transactions.csv';
        document.body.append(download);
        download.click();
        download.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice({ error: false, text: ar ? `المتبقي اليوم: ${result.data.remaining}` : `Exports remaining today: ${result.data.remaining}` });
    } catch (error) {
      report?.close();
      const code = error instanceof Error ? error.message : '';
      const messages: Record<string, string> = {
        report_export_limit: ar ? 'وصلت لحد التصدير اليومي.' : 'You reached your daily export limit.',
        pro_plan_required: ar ? 'التصدير متاح مع خطة Pro نشطة.' : 'Export requires an active Pro plan.',
        popup_blocked: ar ? 'اسمح بفتح نافذة الطباعة من إعدادات المتصفح.' : 'Allow pop-ups in your browser to open the print report.',
      };
      setNotice({ error: true, text: messages[code] || (ar ? 'تعذّر تجهيز التصدير.' : 'Could not prepare the export.') });
    } finally {
      setRunning(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" dir={ar ? 'rtl' : 'ltr'}>
      <section role="dialog" aria-modal="true" aria-label={heading} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-extrabold">{heading}</h2>
          <button type="button" onClick={onClose} disabled={running} className="grid size-10 shrink-0 place-items-center" aria-label={ar ? 'إغلاق' : 'Close'}><X className="size-5" /></button>
        </div>
        <p className="text-sm">{ar ? `عدد العمليات: ${transactions.length}` : `Transactions: ${transactions.length}`}</p>
        <label className="block text-sm font-semibold">
          {ar ? 'صيغة التصدير' : 'Export format'}
          <select value={format} disabled={running} onChange={event => setFormat(event.currentTarget.value === 'pdf' ? 'pdf' : 'csv')}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="csv">{ar ? 'CSV متوافق مع Excel' : 'Excel-compatible CSV'}</option>
            <option value="pdf">{ar ? 'طباعة أو حفظ PDF' : 'Print or save PDF'}</option>
          </select>
        </label>
        {notice && <p role={notice.error ? 'alert' : 'status'} className="text-sm">{notice.text}</p>}
        <button type="button" onClick={exportReport} disabled={running || !transactions.length} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 font-bold text-white disabled:opacity-50">
          <Download className="size-4" />
          {running ? (ar ? 'جارٍ التجهيز…' : 'Preparing…') : format === 'pdf'
            ? (ar ? 'طباعة أو حفظ PDF' : 'Print or save PDF')
            : (ar ? 'تنزيل CSV لـExcel' : 'Download CSV for Excel')}
        </button>
      </section>
    </div>
  );
}
