import { useEffect, useState } from 'react';
import type { OfferCategorySettings } from '../data/offerAds';
import { offerAdsRequest } from './offerAdsClient';

export function useOfferCategories() {
  const [categories, setCategories] = useState<OfferCategorySettings[] | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCategoryError(false);
    offerAdsRequest<OfferCategorySettings[]>('ads.categories')
      .then(items => { if (active) setCategories(items); })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [attempt]);
  return { categories, setCategories, categoryError, reloadCategories: () => setAttempt(value => value + 1) };
}
