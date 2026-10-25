export interface PromoBannerData {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  badgeAr?: string;
  badgeEn?: string;
  targetUrl: string;
  imageUrl?: string;
  ctaTextAr: string;
  ctaTextEn: string;
  isActive: boolean;
  bgColor?: string;
  textColor?: string;
}

export interface PerkDealItem {
  id: string;
  partnerNameAr: string;
  partnerNameEn: string;
  categoryAr: string;
  categoryEn: string;
  discountTextAr: string;
  discountTextEn: string;
  descriptionAr: string;
  descriptionEn: string;
  promoCode?: string;
  targetUrl: string;
  logoBgColor: string;
  iconName: string; // e.g. 'Coffee', 'ShoppingBag', 'Car', 'Percent', 'Utensils'
  validUntil?: string;
  featured?: boolean;
}
