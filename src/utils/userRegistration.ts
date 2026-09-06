import { AuthUser, Transaction } from '../types';

const STORAGE_KEY_PREFIX = 'mybucket_';

export interface UserDateLimits {
  startYear: number;
  startMonth: number; // 1-12
  startDateStr: string; // YYYY-MM-DD
  currentYear: number;
  currentMonth: number; // 1-12
  currentDateStr: string; // YYYY-MM-DD
  yearsList: number[];
  hasPriorMonth: boolean; // Is there a month before current month within active usage?
}

export function getUserRegistrationDate(authUser?: AuthUser | null, transactions?: Transaction[]): Date {
  const now = new Date();

  // 1. Check AuthUser metadata creation time
  let authDate: Date | null = null;
  if (authUser?.createdAt) {
    const parsed = new Date(authUser.createdAt);
    if (!isNaN(parsed.getTime())) {
      authDate = parsed;
    }
  }

  // 2. Check local storage
  let localDate: Date | null = null;
  const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}user_registered_at`);
  if (saved) {
    const parsed = new Date(saved);
    if (!isNaN(parsed.getTime())) {
      localDate = parsed;
    }
  } else {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user_registered_at`, now.toISOString());
    localDate = now;
  }

  // Pick earliest of authDate and localDate if available
  let candidateDate = authDate || localDate || now;
  if (authDate && localDate && localDate < authDate) {
    candidateDate = localDate;
  }

  // 3. Check earliest transaction (if user already has recorded transactions)
  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      const dateStr = tx.date || tx.createdAt?.split('T')[0];
      if (dateStr) {
        const txDate = new Date(dateStr);
        if (!isNaN(txDate.getTime()) && txDate < candidateDate) {
          candidateDate = txDate;
        }
      }
    }
  }

  // Don't allow a registration date in the future
  if (candidateDate > now) {
    candidateDate = now;
  }

  return candidateDate;
}

export function getUserDateLimits(authUser?: AuthUser | null, transactions?: Transaction[]): UserDateLimits {
  const regDate = getUserRegistrationDate(authUser, transactions);
  const now = new Date();

  const startYear = regDate.getFullYear();
  const startMonth = regDate.getMonth() + 1; // 1-12
  const startDay = String(regDate.getDate()).padStart(2, '0');
  const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${startDay}`;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${currentDay}`;

  // Years list: descending from currentYear down to startYear (strictly NO years prior to registration!)
  const yearsList: number[] = [];
  for (let y = currentYear; y >= startYear; y--) {
    yearsList.push(y);
  }
  if (yearsList.length === 0) {
    yearsList.push(currentYear);
  }

  // Has prior month: if user registered in the current month of current year, hasPriorMonth is false
  const hasPriorMonth = startYear < currentYear || (startYear === currentYear && startMonth < currentMonth);

  return {
    startYear,
    startMonth,
    startDateStr,
    currentYear,
    currentMonth,
    currentDateStr,
    yearsList,
    hasPriorMonth,
  };
}

export function getAvailableMonthsForYear(
  selectedYear: number,
  limits: UserDateLimits,
  allMonths: { value: number; nameAr: string; nameEn: string }[]
): { value: number; nameAr: string; nameEn: string }[] {
  return allMonths.filter((m) => {
    // If it's the start year, cannot be before startMonth
    if (selectedYear === limits.startYear && m.value < limits.startMonth) {
      return false;
    }
    // If it's the current year, cannot be after currentMonth
    if (selectedYear === limits.currentYear && m.value > limits.currentMonth) {
      return false;
    }
    // If selectedYear is before startYear, filter out completely
    if (selectedYear < limits.startYear) {
      return false;
    }
    // If selectedYear is after currentYear, filter out
    if (selectedYear > limits.currentYear) {
      return false;
    }
    return true;
  });
}
