/**
 * Admin Stats API — returns aggregated metrics for the admin dashboard.
 *
 * Protected by UID check (matching NEXT_PUBLIC_ADMIN_UID).
 * Uses Firebase Admin SDK for cross-collection aggregation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { validateBody, rateLimit } from '@/lib/api-helpers';
import { z } from 'zod';

const AdminStatsSchema = z.object({
  adminUid: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Rate limit: 30 req/min for admin stats
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (rateLimit(ip, 60_000, 30)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const { data: body, error: validationError } = await validateBody(req, AdminStatsSchema);
  if (validationError) return validationError;

  // Verify admin UID
  const expectedUid = process.env.NEXT_PUBLIC_ADMIN_UID;
  if (!expectedUid || body.adminUid !== expectedUid) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
  }

  const adminDb = await getAdminFirestore();
  if (!adminDb) {
    return NextResponse.json({ error: 'Admin SDK unavailable.' }, { status: 503 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    // ─── User Metrics ────────────────────────────────────────────
    const usersSnap = await adminDb.collection('users').get();
    const totalUsers = usersSnap.size;
    let freeUsers = 0;
    let premiumUsers = 0;
    let newUsersToday = 0;
    let newUsersWeek = 0;
    let newUsersMonth = 0;

    usersSnap.forEach((doc) => {
      const d = doc.data();
      if (d.subscriptionStatus === 'premium') premiumUsers++;
      else freeUsers++;

      const createdAt = d.createdAt ? new Date(d.createdAt) : null;
      if (createdAt && !isNaN(createdAt.getTime())) {
        if (createdAt >= startOfToday) newUsersToday++;
        if (createdAt >= sevenDaysAgo) newUsersWeek++;
        if (createdAt >= thirtyDaysAgo) newUsersMonth++;
      }
    });

    // ─── Scan Metrics (from allScans root collection) ────────────
    let totalScans = 0;
    let scansToday = 0;
    let threatsDetected = 0;
    let threatsToday = 0;
    const moduleCounts: Record<string, number> = {};
    const alertLevelCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const dailyScans: { date: string; count: number }[] = [];

    // Build daily scan buckets for last 7 days
    const dayBuckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayBuckets[key] = 0;
    }

    const scansSnap = await adminDb.collection('allScans').get();
    scansSnap.forEach((doc) => {
      const d = doc.data();
      totalScans++;

      const scanDate = d.scanTimestamp ? new Date(d.scanTimestamp) : null;
      if (scanDate && !isNaN(scanDate.getTime())) {
        if (scanDate >= startOfToday) {
          scansToday++;
          if (d.threatDetected) threatsToday++;
        }
      }

      if (d.threatDetected) threatsDetected++;

      if (d.moduleType) {
        moduleCounts[d.moduleType] = (moduleCounts[d.moduleType] || 0) + 1;
      }

      if (d.alertLevel && alertLevelCounts[d.alertLevel] !== undefined) {
        alertLevelCounts[d.alertLevel]++;
      }

      // Daily bucket
      if (scanDate && !isNaN(scanDate.getTime())) {
        const dayKey = scanDate.toISOString().split('T')[0];
        if (dayKey in dayBuckets) {
          dayBuckets[dayKey]++;
        }
      }
    });

    for (const [date, count] of Object.entries(dayBuckets)) {
      dailyScans.push({ date, count });
    }

    // ─── Revenue / Ad Events ─────────────────────────────────────
    let totalAdImpressions = 0;
    let totalRewardedAds = 0;
    let totalScanEvents = 0;

    const eventsSnap = await adminDb.collection('adminEvents').get();
    eventsSnap.forEach((doc) => {
      const d = doc.data();
      if (d.type === 'ad_impression') totalAdImpressions++;
      if (d.type === 'rewarded_ad_completed') totalRewardedAds++;
      if (d.type === 'scan_completed') totalScanEvents++;
    });

    // ─── Geographic Distribution (from allScans country field) ────
    const countryCounts: Record<string, number> = {};
    scansSnap.forEach((doc) => {
      const d = doc.data();
      if (d.country) {
        countryCounts[d.country] = (countryCounts[d.country] || 0) + 1;
      }
    });

    // ─── Top Threats (from allScans) ─────────────────────────────
    const topThreats: { module: string; count: number; level: string }[] = [];
    const threatModules: Record<string, { count: number; level: string }> = {};
    scansSnap.forEach((doc) => {
      const d = doc.data();
      if (d.threatDetected && d.moduleType) {
        if (!threatModules[d.moduleType]) {
          threatModules[d.moduleType] = { count: 0, level: d.alertLevel || 'low' };
        }
        threatModules[d.moduleType].count++;
        // Keep highest alert level
        const levels = ['low', 'medium', 'high', 'critical'];
        if (levels.indexOf(d.alertLevel) > levels.indexOf(threatModules[d.moduleType].level)) {
          threatModules[d.moduleType].level = d.alertLevel;
        }
      }
    });
    for (const [module, data] of Object.entries(threatModules)) {
      topThreats.push({ module, ...data });
    }
    topThreats.sort((a, b) => b.count - a.count);

    // ─── Churn Rate (simplified: users with 0 scans in 30 days) ──
    const activeUserIds = new Set<string>();
    scansSnap.forEach((doc) => {
      const d = doc.data();
      const scanDate = d.scanTimestamp ? new Date(d.scanTimestamp) : null;
      if (scanDate && scanDate >= thirtyDaysAgo && d.userId) {
        activeUserIds.add(d.userId);
      }
    });
    const churnRate = totalUsers > 0
      ? Math.round(((totalUsers - activeUserIds.size) / totalUsers) * 100 * 10) / 10
      : 0;

    return NextResponse.json({
      users: {
        total: totalUsers,
        free: freeUsers,
        premium: premiumUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
        newThisMonth: newUsersMonth,
      },
      scans: {
        total: totalScans,
        today: scansToday,
        threatsDetected,
        threatsToday,
        moduleCounts,
        alertLevelCounts,
        dailyScans,
      },
      revenue: {
        adImpressions: totalAdImpressions,
        rewardedAds: totalRewardedAds,
        scanEvents: totalScanEvents,
      },
      enterprise: {
        geographicDistribution: countryCounts,
        topThreats,
        churnRate,
        activeUsers30d: activeUserIds.size,
      },
    });
  } catch (e: any) {
    console.error('[admin/stats] Error:', e);
    return NextResponse.json({ error: 'Failed to fetch admin stats.' }, { status: 500 });
  }
}
