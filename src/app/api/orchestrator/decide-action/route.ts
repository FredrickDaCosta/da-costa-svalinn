import { NextRequest, NextResponse } from 'next/server';
import { withAuth, jsonError, validateBody } from '@/lib/api-helpers';
import { DecideActionSchema } from '@/lib/api-schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import '@/lib/actions'; // registers quarantine_email/block_url/block_number/flag_deepfake
import { getAction } from '@/lib/playbooks/engine';
import type { PendingAction } from '@/lib/analyst/types';

export const dynamic = 'force-dynamic';

/**
 * Approve or deny a gated automated action (quarantine_email,
 * flag_deepfake — see orchestrator.ts's Step 5). This is the only
 * place those two actions actually execute; the dashboard's
 * Approve/Deny buttons call this route rather than writing a status
 * flag directly to Firestore, so the decision and the execution are
 * the same authenticated, server-verified step.
 */
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const { data, error } = await validateBody(req, DecideActionSchema);
  if (error) return error;
  const { pendingActionId, decision } = data;

  try {
    const firestore = await getAdminFirestore();
    if (!firestore) throw new Error('Admin Firestore unavailable');
    const ref = firestore.collection('users').doc(uid).collection('pendingActions').doc(pendingActionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return jsonError(404, 'Pending action not found.');
    }

    const pending = snap.data() as PendingAction;

    if (pending.userId !== uid) {
      return jsonError(403, 'Forbidden: this action does not belong to you.');
    }

    if (pending.status !== 'pending') {
      return jsonError(409, `Action already ${pending.status}.`);
    }

    const decidedAt = new Date().toISOString();

    if (decision === 'deny') {
      const denied: PendingAction = { ...pending, status: 'denied', decidedAt, decidedBy: uid };
      await ref.set(denied);
      return NextResponse.json({ success: true, pendingAction: denied });
    }

    // decision === 'approve' — invoke the same handler the immediate
    // (block_url/block_number) path uses, with the params captured at
    // request time.
    const handler = getAction(pending.action);
    if (!handler) {
      const failed: PendingAction = { ...pending, status: 'failed', decidedAt, decidedBy: uid, result: { success: false, error: `Unknown action: ${pending.action}` } };
      await ref.set(failed);
      return jsonError(500, `No handler registered for action: ${pending.action}`);
    }

    const result = await handler(pending.params, { userId: uid, dryRun: false });
    const finalStatus: PendingAction['status'] = result.success ? 'executed' : 'failed';
    const decided: PendingAction = { ...pending, status: finalStatus, decidedAt, decidedBy: uid, result };
    await ref.set(decided);

    return NextResponse.json({ success: true, pendingAction: decided });
  } catch (e: unknown) {
    console.error('[decide-action] Failed:', e instanceof Error ? e.message : String(e));
    return jsonError(500, 'Failed to process action decision.');
  }
}
