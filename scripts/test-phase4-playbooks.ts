/**
 * Phase 4 verification for playbooks/engine.ts's 5 Firestore-touching
 * functions -- fixed, but not called by anything in production yet.
 * Verified anyway with real data, same standard as everything else.
 */
import { savePlaybook, getPlaybook, listPlaybooks, getExecutionHistory } from '../src/lib/playbooks/engine';
import { requireAdminFirestore, adminDoc, adminDeleteDoc } from '../src/lib/admin-firestore';

async function main() {
  const firestore = await requireAdminFirestore();

  console.log('=== savePlaybook (create) ===');
  const id = await savePlaybook({
    name: 'Phase 4 verification test playbook',
    description: 'temporary, deleted at the end of this script',
    version: 1,
    trigger: { type: 'manual' },
    steps: [],
    metadata: { tags: ['phase4-test'], executionCount: 0 },
  } as any);
  console.log('Created playbook:', id);

  console.log('\n=== getPlaybook ===');
  const fetched = await getPlaybook(id);
  console.log('Fetched:', JSON.stringify(fetched));

  console.log('\n=== savePlaybook (update, same id) ===');
  await savePlaybook({ id, ...fetched, description: 'updated description' } as any);
  const updated = await getPlaybook(id);
  console.log('After update:', JSON.stringify({ description: updated?.description }));

  console.log('\n=== listPlaybooks (filtered by tag) ===');
  const list = await listPlaybooks({ tag: 'phase4-test' });
  console.log(`Found ${list.length} playbook(s) with tag phase4-test:`, list.map(p => p.id));

  console.log('\n=== getExecutionHistory (empty, but proves the query runs cleanly) ===');
  const history = await getExecutionHistory('nonexistent-incident-id');
  console.log('History (expected empty):', JSON.stringify(history));

  console.log('\n=== Cleanup ===');
  await adminDeleteDoc(adminDoc(firestore, 'playbooks', id));
  console.log('Deleted test playbook.');
}

main().then(() => process.exit(0)).catch(e => { console.error('Phase 4 playbooks verification error:', e); process.exit(1); });
