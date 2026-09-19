/**
 * Continuation of Phase 4 verification: the external threat-intel APIs
 * (URLhaus, NVD) returned real errors unrelated to the Firestore fix
 * (401/404 -- their own auth/availability, not our Admin SDK usage), so
 * runIOCPipeline had no real ingested data to process. This seeds one
 * real threatIntel doc directly (via the adapter -- the actual code
 * path being verified) so the pipeline's read -> normalize -> write ->
 * enrich -> search chain can be exercised end-to-end with real Firestore
 * data, even though the upstream external feeds are unavailable right
 * now.
 */
import { requireAdminFirestore, adminDoc, adminSetDoc, adminServerTimestamp, adminGetDoc, adminDeleteDoc } from '../src/lib/admin-firestore';
import { runIOCPipeline, enrichIOC, searchIOCs } from '../src/lib/ioc/pipeline';

async function main() {
  const firestore = await requireAdminFirestore();

  console.log('=== Seed one real threatIntel doc ===');
  const seedRef = adminDoc(firestore, 'threatIntel', `URL:phase4-verification-test-${Date.now()}`);
  await adminSetDoc(seedRef, {
    type: 'URL',
    value: 'http://phase4-verification-test.example',
    sources: ['PHASE4_TEST'],
    confidence: 0.8,
    tags: ['test'],
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    tlp: 'WHITE',
    rawData: {},
    cve: null,
    updatedAt: adminServerTimestamp(),
  });
  const seedSnap = await adminGetDoc(seedRef);
  console.log('Seeded doc exists:', seedSnap.exists, JSON.stringify(seedSnap.data()));

  console.log('\n=== runIOCPipeline over threatIntel (should pick up the seeded doc) ===');
  const result = await runIOCPipeline({ source: 'threatIntel', since: new Date(Date.now() - 60000).toISOString(), limit: 50 });
  console.log('runIOCPipeline result:', JSON.stringify(result));

  console.log('\n=== searchIOCs (should find the normalized IOC written by the pipeline) ===');
  const found = await searchIOCs({ value: 'phase4-verification-test' });
  console.log(`searchIOCs found: ${found.length}`);
  found.forEach(ioc => console.log('  ', JSON.stringify(ioc)));

  if (found.length > 0) {
    console.log('\n=== enrichIOC on the found doc ===');
    const enriched = await enrichIOC(found[0].id);
    console.log('enrichIOC result:', JSON.stringify(enriched));
  }

  console.log('\n=== Cleanup ===');
  await adminDeleteDoc(seedRef);
  if (found.length > 0) {
    const iocRef = adminDoc(firestore, 'iocs', found[0].id);
    await adminDeleteDoc(iocRef);
  }
  console.log('Cleaned up seeded/derived test docs.');
}

main().then(() => process.exit(0)).catch(e => { console.error('Phase 4 IOC pipeline verification error:', e); process.exit(1); });
