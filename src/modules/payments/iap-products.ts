/**
 * Product IDs подписок в Google Play и App Store Connect.
 * Эти же ID нужно создать в консолях и в приложении (Flutter in_app_purchase).
 */
export const IAP_PRODUCT_IDS = {
  // Premium — аудио и медитации (кроме курсов)
  PREMIUM_MONTH: 'harmony_premium_month',
  PREMIUM_YEAR: 'harmony_premium_year',
  // Pro — раздел «Курсы»
  PRO_MONTH: 'harmony_pro_month',
  PRO_3MONTHS: 'harmony_pro_3months',
  PRO_6MONTHS: 'harmony_pro_6months',
  PRO_YEAR: 'harmony_pro_year',
} as const;

export type IAPProductId = (typeof IAP_PRODUCT_IDS)[keyof typeof IAP_PRODUCT_IDS];

export type SubscriptionType = 'PREMIUM' | 'PRO';

const PREMIUM_IDS = new Set<string>([IAP_PRODUCT_IDS.PREMIUM_MONTH, IAP_PRODUCT_IDS.PREMIUM_YEAR]);
const PRO_IDS = new Set<string>([
  IAP_PRODUCT_IDS.PRO_MONTH,
  IAP_PRODUCT_IDS.PRO_3MONTHS,
  IAP_PRODUCT_IDS.PRO_6MONTHS,
  IAP_PRODUCT_IDS.PRO_YEAR,
]);

export function getSubscriptionType(productId: string): SubscriptionType | null {
  if (PREMIUM_IDS.has(productId)) return 'PREMIUM';
  if (PRO_IDS.has(productId)) return 'PRO';
  return null;
}

export function isKnownIAPProductId(productId: string): boolean {
  return getSubscriptionType(productId) != null;
}
