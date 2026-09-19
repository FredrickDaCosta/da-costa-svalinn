/**
 * Verifies runIOCPipeline() + searchIOCs() against real Firestore before
 * wiring the UI to them -- same discipline as tonight's NVD verification:
 * confirm the real query shapes work (and surface any missing composite
 * index) before trusting a clean typecheck.
 */
import { runIOCPipeline, searchIOCs } from '../src/lib/ioc/pipeline';

async function main() {
  const runResult = await runIOCPipeline({ source: 'threatIntel' });
  console.log('runIOCPipeline({source:"threatIntel"}) result:', JSON.stringify(runResult));

  const allResults = await searchIOCs({ limit: 5 });
  console.log(`\nsearchIOCs({}) -> ${allResults.length} result(s):`);
  allResults.forEach(ioc => console.log(`  ${ioc.type} ${ioc.value} confidence=${ioc.confidence} sources=${JSON.stringify(ioc.sources)}`));

  const typedResults = await searchIOCs({ type: 'CVE', limit: 5 });
  console.log(`\nsearchIOCs({type:'CVE'}) -> ${typedResults.length} result(s):`);
  typedResults.forEach(ioc => console.log(`  ${ioc.type} ${ioc.value} confidence=${ioc.confidence}`));

  if (allResults.length > 0) {
    const probeValue = allResults[0].value.slice(0, 6);
    const valueResults = await searchIOCs({ value: probeValue, limit: 5 });
    console.log(`\nsearchIOCs({value:'${probeValue}'}) -> ${valueResults.length} result(s)`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
