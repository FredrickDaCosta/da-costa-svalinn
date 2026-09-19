import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, withSchedulerAuth, jsonError } from "@/lib/api-helpers";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { handleAnalyzeUrl } from "@/lib/scans/analyze-url";
import { handleDetectLure } from "@/lib/scans/detect-lure";
import { handleAnalyzeEmail } from "@/lib/scans/analyze-email";
import { handleAnalyzeSms } from "@/lib/scans/analyze-sms";
import { handleAnalyzeAudio } from "@/lib/scans/analyze-audio";
import { handleAssessVideo } from "@/lib/scans/assess-video";
import { processScan } from "@/lib/analyst/orchestrator";
import { checkBlocklist, buildSyntheticBlockedResult, type BlocklistCheckModuleType } from "@/lib/analyst/blocklist-check";
import { claimAssetForScan, updateAssetScanStatus } from "@/lib/assets/registry";

export const dynamic = "force-dynamic";

type ScheduledScanType = 'quick' | 'full' | 'deep';

/**
 * Minimum time between scans of the SAME asset, per job tier -- matches
 * each Cloud Scheduler job's own cron interval (see
 * infrastructure/cloudscheduler-setup.sh): hourly-quick-scan (1h),
 * daily-full-scan (24h), weekly-deep-scan (168h). A 10% buffer below
 * the nominal interval tolerates normal cron jitter without letting a
 * near-simultaneous retry (minutes apart, not the full interval) count
 * as "due again".
 */
const SCAN_INTERVAL_HOURS: Record<ScheduledScanType, number> = {
  quick: 1,
  full: 24,
  deep: 168,
};

function isDueForScan(lastScanned: string | null, scanType: ScheduledScanType): boolean {
  if (!lastScanned) return true;
  const intervalMs = SCAN_INTERVAL_HOURS[scanType] * 60 * 60 * 1000 * 0.9;
  return Date.now() - new Date(lastScanned).getTime() >= intervalMs;
}

interface ScanTarget {
  userId: string;
  assetId: string;
  moduleType: 'link' | 'lure' | 'email' | 'sms' | 'video' | 'deepfake';
  subject: string;
  rawData?: Record<string, unknown>;
}

async function getScheduledTargets(scanType: ScheduledScanType): Promise<ScanTarget[]> {
  const targets: ScanTarget[] = [];

  try {
    const firestore = await getAdminFirestore();
    if (!firestore) throw new Error('Admin Firestore unavailable');

    // Get all users with assets
    const usersSnap = await firestore.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      // Get user's assets
      const assetsSnap = await firestore.collection('users').doc(userId).collection('assets').get();

      for (const assetDoc of assetsSnap.docs) {
        const asset = assetDoc.data();

        // For quick scans, only scan high-priority assets
        if (scanType === 'quick' && asset.tags?.includes('low-priority')) {
          continue;
        }

        // Cheap pre-filter: skip assets scanned within this tier's own
        // interval, using the value already fetched in this query --
        // avoids opening a transaction for the (common) case of an
        // asset that obviously isn't due yet.
        if (!isDueForScan(asset.lastScanned ?? null, scanType)) {
          continue;
        }

        // Atomic claim: the real race-safety guard against a near-
        // simultaneous overlapping request (e.g. a Cloud Scheduler
        // retry) also selecting this same asset before either has
        // recorded a scan. Claimed once per ASSET here, not per module
        // target below -- a DOMAIN asset expands into 3 module targets
        // that must all proceed together as one logical "scan this
        // asset" operation, not be gated against each other.
        const claimed = await claimAssetForScan(userId, assetDoc.id, SCAN_INTERVAL_HOURS[scanType] * 0.9);
        if (!claimed) continue;

        // Determine which modules to run based on asset type
        const modulesToRun = getModulesForAsset(asset.type);

        for (const moduleType of modulesToRun) {
          targets.push({
            userId,
            assetId: assetDoc.id,
            moduleType,
            subject: asset.value,
            rawData: { assetId: assetDoc.id, ...asset.metadata }
          });
        }
      }
    }
  } catch (error) {
    console.error('[scheduled-scan] Error fetching targets:', error);
  }
  
  return targets;
}

function getModulesForAsset(assetType: string): Array<'link' | 'lure' | 'email' | 'sms' | 'video' | 'deepfake'> {
  switch (assetType) {
    case 'DOMAIN':
      return ['link', 'lure', 'email'];
    case 'IP_RANGE':
      return ['link', 'sms'];
    case 'GITHUB_REPO':
      return ['lure', 'email'];
    case 'GCP_PROJECT':
    case 'AZURE_SUB':
      return ['link', 'email', 'video'];
    default:
      return ['link', 'lure', 'email', 'sms', 'video', 'deepfake'];
  }
}

async function runScanForTarget(target: ScanTarget): Promise<void> {
  try {
    // Create mock scan data based on module type
    const mockScanData = createMockScanData(target.moduleType, target.subject, target.rawData) as {
      text?: string;
      emailContent?: string;
      phoneNumber?: string;
      messageText?: string;
      audioDataUri?: string;
      mp4HeaderDataUri?: string;
    };
    
    // Resolved once and reused for both the blocklist check and the
    // real handleAnalyzeAudio call below, so the hash the check derives
    // is guaranteed to match what a real (non-blocked) scan would hash.
    const resolvedAudioDataUri = mockScanData.audioDataUri || `data:audio/wav;base64,${Buffer.from(target.subject).toString('base64')}`;

    // Blocklist enforcement — same lookup keys as the manual-scan routes.
    // On a hit, skip the AI call entirely and feed a synthetic result
    // into processScan() below instead (same call that already happens
    // for every target here, blocked or not — so this doesn't add a new
    // AI cost, it just replaces the module's own AI call with a lookup).
    const blocklistTarget: Record<string, unknown> =
      target.moduleType === 'link' ? { url: target.subject } :
      target.moduleType === 'sms' ? { phoneNumber: mockScanData.phoneNumber || target.subject } :
      target.moduleType === 'email' ? { emailContent: mockScanData.emailContent } :
      target.moduleType === 'deepfake' ? { audioDataUri: resolvedAudioDataUri } :
      {};
    const blocklistHit = await checkBlocklist(target.userId, target.moduleType as BlocklistCheckModuleType, blocklistTarget);

    // Run the actual scan module
    let scanResult: Record<string, unknown> = {};

    if (blocklistHit) {
      scanResult = buildSyntheticBlockedResult(target.moduleType as BlocklistCheckModuleType, blocklistHit);
    } else {
      switch (target.moduleType) {
        case 'link':
          scanResult = await handleAnalyzeUrl({ url: target.subject }) as unknown as Record<string, unknown>;
          break;
        case 'lure':
          scanResult = await handleDetectLure({ text: mockScanData.text || `Content from ${target.subject}` }) as unknown as Record<string, unknown>;
          break;
        case 'email':
          scanResult = await handleAnalyzeEmail({ emailContent: mockScanData.emailContent || `Email from ${target.subject}` }) as unknown as Record<string, unknown>;
          break;
        case 'sms':
          scanResult = await handleAnalyzeSms({
            phoneNumber: mockScanData.phoneNumber || target.subject,
            messageText: mockScanData.messageText || `SMS from ${target.subject}`
          }) as unknown as Record<string, unknown>;
          break;
        case 'deepfake':
          scanResult = await handleAnalyzeAudio({ audioDataUri: resolvedAudioDataUri }) as unknown as Record<string, unknown>;
          break;
        case 'video':
          scanResult = await handleAssessVideo({ mp4HeaderDataUri: mockScanData.mp4HeaderDataUri || `data:video/mp4;base64,${Buffer.from(target.subject).toString('base64')}` }) as unknown as Record<string, unknown>;
          break;
      }
    }

    // Feed to orchestrator
    await processScan({
      userId: target.userId,
      moduleType: target.moduleType,
      rawData: scanResult,
      subject: target.subject,
    });

    await updateAssetScanStatus(target.userId, target.assetId, 'completed');
  } catch (error) {
    console.error(`[scheduled-scan] Error scanning ${target.moduleType} for ${target.subject}:`, error);
    try {
      await updateAssetScanStatus(target.userId, target.assetId, 'failed', error instanceof Error ? error.message : String(error));
    } catch (statusError) {
      console.error(`[scheduled-scan] Also failed to record scan status for ${target.assetId}:`, statusError);
    }
  }
}

function createMockScanData(moduleType: string, subject: string, rawData?: Record<string, unknown>): Record<string, unknown> {
  // In production, this would fetch real data from the asset
  // For now, return minimal mock data to trigger the scan modules
  const base = { assetSubject: subject, ...rawData };
  
  switch (moduleType) {
    case 'link':
      return { url: subject };
    case 'lure':
      return { text: `Content from ${subject}` };
    case 'email':
      return { emailContent: `Email from ${subject}` };
    case 'sms':
      return { phoneNumber: subject, messageText: `SMS from ${subject}` };
    case 'deepfake':
      return { audioDataUri: `data:audio/wav;base64,${Buffer.from(subject).toString('base64')}` };
    case 'video':
      return { mp4HeaderDataUri: `data:video/mp4;base64,${Buffer.from(subject).toString('base64')}` };
    default:
      return base;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Two legitimate callers: Cloud Scheduler (shared-secret header, no
    // Firebase identity to authenticate with) and an admin manually
    // triggering a scan from the dashboard (Firebase ID token). Try the
    // scheduler secret first since it's a cheap sync check; only fall
    // back to the async admin-token verification if that header is absent.
    const schedulerResult = withSchedulerAuth(req);
    if (schedulerResult !== true) {
      const authResult = await withAdminAuth(req);
      if (authResult instanceof NextResponse) return authResult;
    }

    const body = await req.json();
    const requestedScanType = body.scanType;
    const scanType: ScheduledScanType =
      requestedScanType === 'quick' || requestedScanType === 'deep' ? requestedScanType : 'full';
    
    console.log(`[scheduled-scan] Starting ${scanType} scan`);
    
    const targets = await getScheduledTargets(scanType);
    console.log(`[scheduled-scan] Found ${targets.length} targets to scan`);
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    let processed = 0;
    let errors = 0;
    
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await Promise.all(batch.map(async (target) => {
        try {
          await runScanForTarget(target);
          processed++;
        } catch {
          errors++;
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < targets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return NextResponse.json({
      success: true,
      scanType,
      targetsFound: targets.length,
      processed,
      errors,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: unknown) {
    console.error("[scheduled-scan] Fatal error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scheduled scan failed." }, { status: 500 });
  }
}