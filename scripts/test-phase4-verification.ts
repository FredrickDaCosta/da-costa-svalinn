/**
 * Phase 4 direct verification for the 9 files just converted to
 * src/lib/admin-firestore.ts. Calls the actual fixed functions directly
 * (bypassing the HTTP + withAdminAuth layer, which is unchanged by this
 * pass and was already verified in earlier fixes tonight) against real
 * external APIs and real Firestore -- proving the actual code that
 * changed (the Admin SDK writes) with real data, not assumed.
 *
 * Uses sources that need no API key: URLhaus and NVD (threat-intel),
 * plus the IOC pipeline functions directly.
 */
import { requireAdminFirestore, adminCollection, adminGetDocs, adminQuery, adminOrderBy, adminLimit } from '../src/lib/admin-firestore';
import { ingestURLhaus } from '../src/lib/threat-intel/ingest/urlhaus';
import { incrementalNVDSync } from '../src/lib/threat-intel/ingest/nvd';
import { runThreatIntelIngestion } from '../src/lib/threat-intel/orchestrator';
import { runIOCPipeline, searchIOCs } from '../src/lib/ioc/pipeline';

async function main() {
  const firestore = await requireAdminFirestore();

  console.log('=== URLhaus ingestion (no API key needed) ===');
  const urlhausResult = await ingestURLhaus({});
  console.log('ingestURLhaus result:', JSON.stringify(urlhausResult));

  console.log('\n=== NVD CVE ingestion (no API key needed, small window) ===');
  const nvdResult = await incrementalNVDSync(1);
  console.log('incrementalNVDSync result:', JSON.stringify(nvdResult));

  console.log('\n=== threatIntel collection trace (real Firestore writes from above) ===');
  const intelSnap = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'threatIntel'), adminOrderBy('updatedAt', 'desc'), adminLimit(5))
  );
  console.log(`threatIntel: ${intelSnap.size} doc(s) (most recent 5)`);
  intelSnap.docs.forEach(d => console.log('  ', JSON.stringify({ id: d.id, type: d.data().type, value: d.data().value, sources: d.data().sources })));

  console.log('\n=== orchestrator.storeIngestionResults (via runThreatIntelIngestion, empty API keys) ===');
  // Empty API keys -> only URLhaus + NVD run (the two that don't gate on a key), same as above,
  // but this specifically exercises orchestrator.ts's own Firestore write (tiIngestionLogs).
  await runThreatIntelIngestion({}, { nvdDaysBack: 1 });
  const logsSnap = await adminGetDocs(
    adminQuery(adminCollection(firestore, 'tiIngestionLogs'), adminOrderBy('createdAt', 'desc'), adminLimit(3))
  );
  console.log(`tiIngestionLogs: ${logsSnap.size} doc(s) (most recent 3)`);
  logsSnap.docs.forEach(d => console.log('  ', JSON.stringify({ id: d.id, source: d.data().source, ingested: d.data().ingested })));

  console.log('\n=== IOC pipeline (runIOCPipeline over the threatIntel data just ingested) ===');
  const iocResult = await runIOCPipeline({ source: 'threatIntel', limit: 50 });
  console.log('runIOCPipeline result:', JSON.stringify(iocResult));

  const iocsSnap = await searchIOCs({ limit: 5 });
  console.log(`\nsearchIOCs: ${iocsSnap.length} doc(s) (most recent 5)`);
  iocsSnap.forEach(ioc => console.log('  ', JSON.stringify({ id: ioc.id, type: ioc.type, value: ioc.value, sources: ioc.sources })));

  console.log('\n✓ Phase 4 verification complete -- see real Firestore evidence above.');
}

main().then(() => process.exit(0)).catch(e => { console.error('Phase 4 verification error:', e); process.exit(1); });
