import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { env } from '../../config/env.validation';

export const USERS_COLLECTION = 'users';
export const REFRESH_SESSIONS_COLLECTION = 'refreshSessions';
export const DEVICES_COLLECTION = 'devices';
export const YOOKASSA_PAYMENTS_COLLECTION = 'yookassaPayments';
export const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _firestore: admin.firestore.Firestore | null = null;

  onModuleInit() {
    if (admin.apps.length > 0) {
      this._firestore = admin.firestore();
      this.logger.log('Firebase already initialized');
      return;
    }

    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      this._firestore = admin.firestore();
      this.logger.log('Firebase initialized with GOOGLE_APPLICATION_CREDENTIALS');
      return;
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      this._firestore = admin.firestore();
      this.logger.log('Firebase initialized with service account env vars');
      return;
    }

    this.logger.warn('Firebase not configured: set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars');
  }

  get firestore(): admin.firestore.Firestore {
    if (!this._firestore) {
      throw new Error('Firebase Firestore not initialized');
    }
    return this._firestore;
  }

  /** Timestamp для Firestore (admin.firestore.Timestamp). */
  get timestamp(): typeof admin.firestore.Timestamp {
    return admin.firestore.Timestamp;
  }
}
