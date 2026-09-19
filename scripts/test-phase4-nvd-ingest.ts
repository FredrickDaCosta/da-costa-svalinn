/**
 * Direct verification of incrementalNVDSync() against real Firestore.
 * Confirms the pubStartDate/pubEndDate pairing fix and the weaknesses/
 * references undefined-field guard both hold against live NVD data.
 */
import { incrementalNVDSync } from '../src/lib/threat-intel/ingest/nvd';
import { requireAdminFirestore, adminCollection, adminQuery, adminOrderBy, adminLimit, adminGetDocs } from '../src/lib/admin-firestore';

async function main() {
  const result = await incrementalNVDSync(1);
  console.log('incrementalNVDSync(1) result:', JSON.stringify(result));

  const firestore = await requireAdminFirestore();
  const recentCves = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'cves'), adminOrderBy('updatedAt', 'desc'), adminLimit(3))
  );
  console.log(`\nMost recently written CVE docs (${recentCves.size}):`);
  recentCves.forEach(doc => {
    const d = doc.data() as Record<string, unknown>;
    console.log(`  ${doc.id}: severity=${d.severity} cvss=${d.cvss} cwes=${JSON.stringify(d.cwes)}`);
  });

  const recentIntel = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'threatIntel'), adminOrderBy('updatedAt', 'desc'), adminLimit(3))
  );
  console.log(`\nMost recently written threatIntel docs (${recentIntel.size}):`);
  recentIntel.forEach(doc => {
    const d = doc.data() as Record<string, unknown>;
    console.log(`  ${doc.id}: type=${d.type} sources=${JSON.stringify(d.sources)}`);
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
