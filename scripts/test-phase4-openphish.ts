import { ingestOpenPhish } from '../src/lib/threat-intel/ingest/openphish';
import { requireAdminFirestore, adminCollection, adminQuery, adminWhere, adminLimit, adminGetDocs } from '../src/lib/admin-firestore';

async function main() {
  const result = await ingestOpenPhish({ limit: 200 });
  console.log('ingestOpenPhish({limit:200}) result:', JSON.stringify(result));

  const firestore = await requireAdminFirestore();
  const snap = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'threatIntel'), adminWhere('sources', 'array-contains', 'OPENPHISH'), adminLimit(5))
  );
  console.log(`\nSample OPENPHISH threatIntel docs (${snap.size}):`);
  snap.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    console.log(`  ${d.id}: value=${data.value} domain=${data.domain} confidence=${data.confidence}`);
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
