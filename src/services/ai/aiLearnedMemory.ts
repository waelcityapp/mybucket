import { Transaction, TransactionType } from '../../types';

export interface LearnedKeywordEntity {
  keyword: string;
  categoryId?: string | null;
  categoryNameAr?: string | null;
  accountId?: string | null;
  accountNameAr?: string | null;
  type?: TransactionType | null;
  frequency: number;
  lastUpdated: string;
}

const STORAGE_KEY = 'mybucket_ai_learned_memory_v1';

/**
 * In-memory and local storage manager for user's adaptive AI learning.
 */
class AILearnedMemoryService {
  private memory: Map<string, LearnedKeywordEntity> = new Map();
  private isInitialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private normalizeKey(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]+/g, ' ');
  }

  public loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: LearnedKeywordEntity[] = JSON.parse(stored);
        this.memory.clear();
        parsed.forEach((item) => {
          this.memory.set(this.normalizeKey(item.keyword), item);
        });
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('Failed to load AI learned memory:', e);
    }
  }

  public saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.memory.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (e) {
      console.warn('Failed to save AI learned memory to storage:', e);
    }
  }

  /**
   * Sets learned memory from a remote source (e.g. Firestore sync)
   */
  public setMemoryFromRemote(items: LearnedKeywordEntity[]): void {
    if (!items || !Array.isArray(items)) return;
    items.forEach((item) => {
      if (item && item.keyword) {
        const key = this.normalizeKey(item.keyword);
        const existing = this.memory.get(key);
        if (existing) {
          this.memory.set(key, {
            ...existing,
            ...item,
            frequency: Math.max(existing.frequency, item.frequency || 1),
          });
        } else {
          this.memory.set(key, item);
        }
      }
    });
    this.saveToStorage();
  }

  /**
   * Returns all learned keyword associations
   */
  public getLearnedList(): LearnedKeywordEntity[] {
    if (!this.isInitialized) {
      this.loadFromStorage();
    }
    return Array.from(this.memory.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Automatically learns from a completed, user-confirmed transaction or manual edit.
   * E.g. "كافيه عم دهب" -> Category: Food, Account: Cash, Type: Expense
   */
  public recordLearning(
    rawText: string,
    data: {
      categoryId?: string | null;
      categoryNameAr?: string | null;
      accountId?: string | null;
      accountNameAr?: string | null;
      type?: TransactionType | null;
      description?: string | null;
    }
  ): void {
    if (!rawText && !data.description) return;

    // Candidates to extract meaningful entity names
    const textSources = [data.description, rawText].filter(Boolean) as string[];

    for (const source of textSources) {
      // Clean noise words
      const cleaned = source
        .replace(/^(دفعت|صرفت|اشتريت|جبت|حولت|سددت|قبضت|اخدت|استلمت)\s+/i, '')
        .replace(/\b(\d+(?:\.\d+)?)\s*(جنيه|جنية|egp|دولار|\$|ريال)?\b/gi, '')
        .replace(/\b(من|في|عند|بـ|ب|مع|الى|إلى|عشان|حق)\b/gi, ' ')
        .trim();

      const normalized = this.normalizeKey(cleaned);
      if (normalized.length >= 3 && !/^\d+$/.test(normalized)) {
        const existing = this.memory.get(normalized);
        const updated: LearnedKeywordEntity = {
          keyword: cleaned,
          categoryId: data.categoryId ?? existing?.categoryId ?? null,
          categoryNameAr: data.categoryNameAr ?? existing?.categoryNameAr ?? null,
          accountId: data.accountId ?? existing?.accountId ?? null,
          accountNameAr: data.accountNameAr ?? existing?.accountNameAr ?? null,
          type: data.type ?? existing?.type ?? 'expense',
          frequency: (existing?.frequency || 0) + 1,
          lastUpdated: new Date().toISOString(),
        };

        this.memory.set(normalized, updated);
      }
    }

    this.saveToStorage();
  }

  /**
   * Attempts to match learned entities in a text query
   */
  public findLearnedMatch(text: string): LearnedKeywordEntity | null {
    if (!text) return null;
    const norm = this.normalizeKey(text);

    for (const [key, entity] of this.memory.entries()) {
      if (norm.includes(key)) {
        return entity;
      }
    }
    return null;
  }
}

export const aiLearnedMemory = new AILearnedMemoryService();
