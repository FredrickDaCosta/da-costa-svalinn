import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonError } from "@/lib/api-helpers";
import { initializeFirebase } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { handleAnalyzeUrl } from "@/lib/scans/analyze-url";
import { handleDetectLure } from "@/lib/scans/detect-lure";
import { handleAnalyzeEmail } from "@/lib/scans/analyze-email";
import { handleAnalyzeSms } from "@/lib/scans/analyze-sms";
import { handleAnalyzeAudio } from "@/lib/scans/analyze-audio";
import { handleAssessVideo } from "@/lib/scans/assess-video";
import { processScan } from "@/lib/analyst/orchestrator";

export const dynamic = "force-dynamic";

interface ScanTarget {
  userId: string;
  moduleType: 'link' | 'lure' | 'email' | 'sms' | 'video' | 'deepfake';
  subject: string;
  rawData?: Record<string, unknown>;
}

async function getScheduledTargets(scanType: 'full' | 'quick'): Promise<ScanTarget[]> {
  const { firestore } = initializeFirebase();
  const targets: ScanTarget[] = [];
  
  try {
    // Get all users with assets
    const usersSnap = await getDocs(collection(firestore, 'users'));
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      
      // Get user's assets
      const assetsQuery = query(collection(firestore, 'users', userId, 'assets'));
      const assetsSnap = await getDocs(assetsQuery);
      
      for (const assetDoc of assetsSnap.docs) {
        const asset = assetDoc.data();
        
        // For quick scans, only scan high-priority assets
        if (scanType === 'quick' && asset.tags?.includes('low-priority')) {
          continue;
        }
        
        // Determine which modules to run based on asset type
        const modulesToRun = getModulesForAsset(asset.type);
        
        for (const moduleType of modulesToRun) {
          targets.push({
            userId,
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
    const mockScanData = createMockScanData(target.moduleType, target.subject, target.rawData);
    
    // Run the actual scan module
    let scanResult: Record<string, unknown> = {};
    
    switch (target.moduleType) {
      case 'link':
        scanResult = await handleAnalyzeUrl({ url: target.subject });
        break;
      case 'lure':
        scanResult = await handleDetectLure({ text: mockScanData.text });
        break;
      case 'email':
        scanResult = await handleAnalyzeEmail({ emailContent: mockScanData.emailContent });
        break;
      case 'sms':
        scanResult = await handleAnalyzeSms({ 
          phoneNumber: mockScanData.phoneNumber, 
          messageText: mockScanData.messageText 
        });
        break;
      case 'deepfake':
        scanResult = await handleAnalyzeAudio({ audioDataUri: mockScanData.audioDataUri });
        break;
      case 'video':
        scanResult = await handleAssessVideo({ mp4HeaderDataUri: mockScanData.mp4HeaderDataUri });
        break;
    }
    
    // Feed to orchestrator
    await processScan({
      userId: target.userId,
      moduleType: target.moduleType,
      rawData: scanResult,
      subject: target.subject,
    });
    
  } catch (error) {
    console.error(`[scheduled-scan] Error scanning ${target.moduleType} for ${target.subject}:`, error);
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
    const authResult = await withAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const scanType = body.scanType || 'full';
    
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