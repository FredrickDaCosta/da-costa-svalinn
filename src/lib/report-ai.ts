import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ReportReason = 
  'harmful' | 'inaccurate' | 'inappropriate' | 'other';

export async function reportAiMessage(
  userId: string,
  messageContent: string,
  reason: ReportReason
): Promise<void> {
  await addDoc(collection(db, 'aiReports'), {
    userId,
    messageContent,
    reason,
    timestamp: serverTimestamp(),
    appVersion: '1.0.0',
    platform: 'web',
    resolved: false,
    assistantModel: 'nemotron-3-ultra-550b-a55b',
  });
}
