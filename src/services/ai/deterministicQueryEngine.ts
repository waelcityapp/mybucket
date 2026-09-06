import { Transaction, FinancialAccount, Category, Language } from '../../types';
import { AIFinancialQuery, DeterministicQueryResult, DeterministicBreakdownItem } from './types';

export type { DeterministicQueryResult, DeterministicBreakdownItem };

/**
 * Deterministic Financial Calculation Engine
 * 
 * Per architectural requirements:
 * Financial calculations must be performed deterministically by application logic,
 * NOT by Gemini. Gemini only interprets the intent and structured filters;
 * this engine executes the actual mathematical aggregations and queries.
 */
export function executeDeterministicQuery(
  query: AIFinancialQuery,
  question: string,
  transactions: Transaction[],
  accounts: FinancialAccount[],
  categories: Category[],
  lang: Language
): DeterministicQueryResult {
  const isAr = lang === 'ar';
  const now = new Date();

  // 1. Determine Date Range Boundaries
  let startTimestamp = -Infinity;
  let endTimestamp = Infinity;
  let periodLabel = isAr ? 'كل الأوقات' : 'All Time';

  switch (query.period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      periodLabel = isAr ? 'اليوم' : 'Today';
      break;
    }
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      periodLabel = isAr ? 'أمس' : 'Yesterday';
      break;
    }
    case 'this_week': {
      // Current week starting Saturday (common in Arab world) or Sunday
      const day = now.getDay(); // 0 is Sunday, 6 is Saturday
      // Let week start Saturday (day 6): distance = (day + 1) % 7
      const diffToSaturday = (day + 1) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diffToSaturday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      periodLabel = isAr ? 'هذا الأسبوع' : 'This Week';
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      const diffToSaturday = (day + 1) % 7;
      const end = new Date(now);
      end.setDate(now.getDate() - diffToSaturday - 1);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      periodLabel = isAr ? 'الأسبوع الماضي' : 'Last Week';
      break;
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      const monthName = now.toLocaleString(isAr ? 'ar-EG' : 'en-US', { month: 'long' });
      periodLabel = isAr ? `شهر ${monthName}` : `Month of ${monthName}`;
      break;
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      startTimestamp = start.getTime();
      endTimestamp = end.getTime();
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthName = prevDate.toLocaleString(isAr ? 'ar-EG' : 'en-US', { month: 'long' });
      periodLabel = isAr ? `الشهر الماضي (${monthName})` : `Last Month (${monthName})`;
      break;
    }
    case 'custom': {
      if (query.startDate) {
        const parts = query.startDate.split('-').map(Number);
        startTimestamp = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 0, 0, 0, 0).getTime();
      }
      if (query.endDate) {
        const parts = query.endDate.split('-').map(Number);
        endTimestamp = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 23, 59, 59, 999).getTime();
      }
      if (query.startDate && query.endDate) {
        periodLabel = isAr
          ? `من ${query.startDate} إلى ${query.endDate}`
          : `From ${query.startDate} to ${query.endDate}`;
      } else {
        periodLabel = isAr ? 'الفترة المحددة' : 'Selected Period';
      }
      break;
    }
    default: {
      periodLabel = isAr ? 'كافة السجلات' : 'All time records';
      break;
    }
  }

  // 2. Filter transactions by Date Range
  const inRangeTx = transactions.filter((tx) => {
    let txTime = 0;
    if (tx.dateTime) {
      txTime = new Date(tx.dateTime).getTime();
    } else if (tx.date) {
      const parts = tx.date.split('-').map(Number);
      txTime = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0).getTime();
    } else {
      txTime = new Date(tx.createdAt).getTime();
    }
    return txTime >= startTimestamp && txTime <= endTimestamp;
  });

  // Default currency
  const mainCurrency = accounts[0]?.currency || 'EGP';
  const currencySymbol = isAr ? 'ج.م' : mainCurrency;

  // Resolve effective metric (if total_spent was requested but user provided a category, handle as category_spent)
  const effectiveMetric =
    query.metric === 'total_spent' && (query.categoryId || query.categoryName)
      ? 'category_spent'
      : query.metric;

  // 3. Handle Metric Execution
  switch (effectiveMetric) {
    case 'account_balance': {
      // Querying specific account balance (e.g., "معايا كام في الكاش؟" or "رصيد البنك")
      let targetAccount: FinancialAccount | undefined;
      if (query.accountId) {
        targetAccount = accounts.find((a) => a.id === query.accountId);
      }
      if (!targetAccount && query.accountName) {
        const qName = query.accountName.toLowerCase();
        targetAccount = accounts.find(
          (a) =>
            a.name.toLowerCase().includes(qName) ||
            a.nameAr.includes(qName) ||
            (qName.includes('كاش') && a.type === 'cash') ||
            (qName.includes('بنك') && a.type === 'bank') ||
            (qName.includes('فيزا') && a.type === 'card')
        );
      }

      if (targetAccount) {
        const accName = isAr ? targetAccount.nameAr : targetAccount.name;
        const curSym = isAr
          ? targetAccount.currency === 'EGP'
            ? 'ج.م'
            : targetAccount.currency === 'USD'
            ? 'دولار'
            : targetAccount.currency
          : targetAccount.currency;

        return {
          question,
          headline: isAr
            ? `رصيد ${accName} الحالي هو ${targetAccount.balance.toLocaleString()} ${curSym}`
            : `Current balance for ${accName} is ${targetAccount.balance.toLocaleString()} ${curSym}`,
          amount: targetAccount.balance,
          currency: targetAccount.currency,
          details: isAr
            ? `الحساب نشط ويحتوي على ${targetAccount.balance.toLocaleString()} ${curSym}`
            : `Account is active with ${targetAccount.balance.toLocaleString()} ${curSym}`,
          periodText: isAr ? 'الرصيد الفعلي الحالي' : 'Current live balance',
          transactionCount: inRangeTx.filter(
            (tx) => tx.accountId === targetAccount?.id || tx.toAccountId === targetAccount?.id
          ).length,
        };
      } else {
        // Total balance across all accounts
        const totalBal = accounts.reduce((sum, a) => sum + a.balance, 0);
        return {
          question,
          headline: isAr
            ? `إجمالي الرصيد في جميع الحسابات: ${totalBal.toLocaleString()} ${currencySymbol}`
            : `Total balance across all accounts: ${totalBal.toLocaleString()} ${currencySymbol}`,
          amount: totalBal,
          currency: mainCurrency,
          details: isAr
            ? `موزع على ${accounts.length} حسابات`
            : `Distributed across ${accounts.length} accounts`,
          periodText: isAr ? 'الرصيد الفعلي الحالي' : 'Current live balance',
          breakdown: accounts.map((acc) => ({
            id: acc.id,
            label: isAr ? acc.nameAr : acc.name,
            amount: acc.balance,
            percentage: totalBal > 0 ? Math.round((acc.balance / totalBal) * 100) : 0,
            color: acc.color,
          })),
        };
      }
    }

    case 'category_spent': {
      // Querying spending for a specific category (e.g., "صرفت كام بنزين؟" or "كام في المطاعم؟")
      let targetCat: Category | undefined;
      if (query.categoryId) {
        targetCat = categories.find((c) => c.id === query.categoryId);
      }
      if (!targetCat && query.categoryName) {
        const qName = query.categoryName.toLowerCase().trim();
        targetCat = categories.find((c) => {
          const n = c.name.toLowerCase();
          const na = c.nameAr.toLowerCase();
          if (n.includes(qName) || na.includes(qName)) return true;
          if ((qName.includes('بنزين') || qName.includes('fuel')) && (na.includes('مواصلات') || n.includes('transport'))) return true;
          return false;
        });
      }

      let catExpenses: Transaction[];
      if (targetCat) {
        catExpenses = inRangeTx.filter(
          (tx) => tx.type === 'expense' && tx.categoryId === targetCat?.id
        );
      } else {
        catExpenses = inRangeTx.filter((tx) => tx.type === 'expense');
      }

      const totalAmount = catExpenses.reduce((sum, tx) => sum + tx.amount, 0);
      const catTitle = targetCat
        ? isAr
          ? targetCat.nameAr
          : targetCat.name
        : isAr
        ? 'التصنيف المطلوب'
        : 'Category';

      return {
        question,
        headline: isAr
          ? `صرفت ${totalAmount.toLocaleString()} ${currencySymbol} على ${catTitle} (${periodLabel})`
          : `You spent ${totalAmount.toLocaleString()} ${currencySymbol} on ${catTitle} (${periodLabel})`,
        amount: totalAmount,
        currency: mainCurrency,
        details: isAr
          ? `تم إيجاد ${catExpenses.length} معاملة مسجلة في هذه الفترة`
          : `Found ${catExpenses.length} transactions recorded in this period`,
        periodText: periodLabel,
        transactionCount: catExpenses.length,
        matchingTransactions: catExpenses.slice(0, 20),
      };
    }

    case 'total_income': {
      // Total income in period
      const incomes = inRangeTx.filter((tx) => tx.type === 'income');
      const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        question,
        headline: isAr
          ? `إجمالي الدخل (${periodLabel}) هو ${totalIncome.toLocaleString()} ${currencySymbol}`
          : `Total income (${periodLabel}) is ${totalIncome.toLocaleString()} ${currencySymbol}`,
        amount: totalIncome,
        currency: mainCurrency,
        details: isAr
          ? `مسجل ${incomes.length} عملية دخل`
          : `${incomes.length} income transactions recorded`,
        periodText: periodLabel,
        transactionCount: incomes.length,
        matchingTransactions: incomes.slice(0, 5),
      };
    }

    case 'net_savings': {
      // Income - Expense
      const expenses = inRangeTx.filter((tx) => tx.type === 'expense');
      const incomes = inRangeTx.filter((tx) => tx.type === 'income');
      const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);
      const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);
      const net = totalIncome - totalExpense;

      return {
        question,
        headline: isAr
          ? `صافي الفارق (${periodLabel}): ${net >= 0 ? '+' : ''}${net.toLocaleString()} ${currencySymbol}`
          : `Net savings (${periodLabel}): ${net >= 0 ? '+' : ''}${net.toLocaleString()} ${currencySymbol}`,
        amount: net,
        currency: mainCurrency,
        details: isAr
          ? `دخل: ${totalIncome.toLocaleString()} ${currencySymbol} | مصاريف: ${totalExpense.toLocaleString()} ${currencySymbol}`
          : `Income: ${totalIncome.toLocaleString()} ${currencySymbol} | Expenses: ${totalExpense.toLocaleString()} ${currencySymbol}`,
        periodText: periodLabel,
        transactionCount: inRangeTx.length,
      };
    }

    case 'total_spent':
    default: {
      // Default: Total spent in the specified period (e.g. "أنا صرفت كام الأسبوع ده؟")
      const expenses = inRangeTx.filter((tx) => tx.type === 'expense');
      const totalSpent = expenses.reduce((sum, tx) => sum + tx.amount, 0);

      // Group by Category to show spending breakdown
      const catMap = new Map<string, number>();
      expenses.forEach((tx) => {
        const cId = tx.categoryId || 'other';
        catMap.set(cId, (catMap.get(cId) || 0) + tx.amount);
      });

      const breakdown: DeterministicBreakdownItem[] = [];
      catMap.forEach((amt, cId) => {
        const cat = categories.find((c) => c.id === cId);
        breakdown.push({
          id: cId,
          label: cat ? (isAr ? cat.nameAr : cat.name) : isAr ? 'أخرى' : 'Other',
          amount: amt,
          percentage: totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0,
          icon: cat?.icon,
          color: cat?.color,
        });
      });
      breakdown.sort((a, b) => b.amount - a.amount);

      return {
        question,
        headline: isAr
          ? `إجمالي ما صرفته ${periodLabel}: ${totalSpent.toLocaleString()} ${currencySymbol}`
          : `Total spent ${periodLabel}: ${totalSpent.toLocaleString()} ${currencySymbol}`,
        amount: totalSpent,
        currency: mainCurrency,
        details: isAr
          ? `إجمالي ${expenses.length} عملية صرف خلال هذه الفترة`
          : `${expenses.length} expense transactions in this period`,
        periodText: periodLabel,
        transactionCount: expenses.length,
        breakdown: breakdown.slice(0, 4),
        matchingTransactions: expenses.slice(0, 5),
      };
    }
  }
}
