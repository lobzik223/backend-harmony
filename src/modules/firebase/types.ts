import type { Timestamp } from 'firebase-admin/firestore';

export interface UserRecord {
  email: string;
  name: string;
  surname: string;
  passwordHash: string | null;
  premiumUntil: Timestamp | null;
  nameUpdatedAt: Timestamp;
  nameChangeCount: number;
  createdAt: Timestamp;
}

export interface RefreshSessionRecord {
  userId: string;
  expiresAt: Timestamp;
  revokedAt: Timestamp | null;
  replacedById: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface DeviceRecord {
  userId: string | null;
  pushToken: string | null;
  platform: string | null;
  preferredLocale: string | null;
  lastSeenAt: Timestamp;
}

export interface YooKassaPaymentRecord {
  yookassaPaymentId: string;
  planId: string;
  emailOrId: string;
  status: string;
  userId: string | null;
  grantedAt: Timestamp | null;
  createdAt: Timestamp;
}

export type SubscriptionStore = 'INTERNAL' | 'APPLE' | 'GOOGLE';

export interface SubscriptionRecord {
  userId: string;
  productId: string;
  store: SubscriptionStore | null;
  currentPeriodStart: Timestamp | null;
  currentPeriodEnd: Timestamp | null;
  appleOriginalTransactionId?: string | null;
  googlePurchaseToken?: string | null;
  updatedAt: Timestamp;
}
