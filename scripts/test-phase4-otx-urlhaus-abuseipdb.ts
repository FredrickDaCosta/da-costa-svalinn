/**
 * Verifies OTX, URLhaus, and AbuseIPDB threatIntel writes against real
 * Firestore after tonight's credential wiring + real-bug fixes (OTX
 * timeout, URLhaus GET-method + null-tags, AbuseIPDB plaintext parsing).
 */
import { requireAdminFirestore, adminCollection, adminQuery, adminWhere, adminLimit, adminGetDocs } from '../src/lib/admin-firestore';

async function checkSource(source: string) {
  const firestore = await requireAdminFirestore();
  const snap = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'threatIntel'), adminWhere('sources', 'array-contains', source), adminLimit(3))
  );
  console.log(`\n${source}: ${snap.size} sample doc(s)`);
  snap.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    console.log(`  ${d.id}: type=${data.type} value=${data.value} confidence=${data.confidence} sources=${JSON.stringify(data.sources)}`);
  });
}

async function main() {
  await checkSource('OTX');
  await checkSource('URLHAUS');
  await checkSource('ABUSEIPDB');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
