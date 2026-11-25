import { randomUUID } from 'node:crypto';
import { OFFER_CATEGORY_LABELS, type OfferCategorySettings } from '../src/data/offerAds.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const categoryConfigPath = 'offerAdSettings/categories';

function categoryList(value: unknown): readonly OfferCategorySettings[] {
  return Array.isArray(value) ? value : OFFER_CATEGORY_LABELS;
}

export async function readOfferCategories(db = getAdminFirestore()) {
  return categoryList((await db.doc(categoryConfigPath).get()).get('items'));
}

export async function assertActiveOfferCategory(db: FirebaseFirestore.Firestore, tx: FirebaseFirestore.Transaction, id: string, previousId?: string) {
  if (id === previousId) return;
  const categories = categoryList((await tx.get(db.doc(categoryConfigPath))).get('items'));
  if (!categories.some(item => item.id === id && !item.archived)) {
    throw new SubscriptionError(400, 'ad_category_unavailable', 'This category is unavailable.');
  }
}

export async function manageOfferCategories(payload: Record<string, unknown>, db = getAdminFirestore()) {
  const operation = payload.operation;
  if (operation !== 'add' && operation !== 'rename' && operation !== 'archive' && operation !== 'restore') {
    throw new SubscriptionError(400, 'invalid_category_operation', 'Invalid category operation.');
  }
  const ar = typeof payload.ar === 'string' ? payload.ar.trim() : '';
  const en = typeof payload.en === 'string' ? payload.en.trim() : '';
  const naming = operation === 'add' || operation === 'rename';
  if (naming && (!ar || !en || ar.length > 80 || en.length > 80)) {
    throw new SubscriptionError(400, 'invalid_category_name', 'Enter both names with at most 80 characters each.');
  }
  const id = operation === 'add' ? `category-${randomUUID()}` : payload.id;
  const ref = db.doc(categoryConfigPath);
  return db.runTransaction(async tx => {
    const categories = categoryList((await tx.get(ref)).get('items'));
    if (operation !== 'add' && !categories.some(item => item.id === id)) {
      throw new SubscriptionError(404, 'ad_category_unavailable', 'This category is unavailable.');
    }
    if (operation === 'add' && categories.length >= 150) {
      throw new SubscriptionError(409, 'ad_category_limit', 'Category limit reached.');
    }
    const items = operation === 'add' ? [...categories, { id, ar, en }] : categories.map(item => item.id !== id ? item : naming
      ? { ...item, ar, en } : { ...item, archived: operation === 'archive' });
    tx.set(ref, { items });
    return items;
  });
}
