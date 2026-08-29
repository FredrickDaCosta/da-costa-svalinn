import { NextRequest, NextResponse } from 'next/server';
import { type ZodSchema, ZodError } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebase } from '@/firebase';

/**
 * Validate and parse a request body against a Zod schema.
 * Returns the parsed data or a NextResponse error.
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: NextResponse.json(
          { error: 'Validation failed', details: err.errors.map(e => e.message) },
          { status: 400 }
        ),
      };
    }
    return {
      error: NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Simple in-memory rate limiter (fallback when Firestore unavailable).
 * Returns true if the request should be rate-limited (blocked).
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  ip: string,
  windowMs: number = 60_000,
  maxRequests: number = 10
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

/**
 * Firestore-backed rate limiter for production use.
 * Returns true if the request should be rate-limited (blocked).
 */
export async function rateLimitFirestore(
  ip: string,
  windowMs: number = 60_000,
  maxRequests: number = 10
): Promise<boolean> {
  try {
    const { firestore } = initializeFirebase();
    const { doc, runTransaction, Timestamp } = await import('firebase/firestore');
    
    const now = Date.now();
    const windowStart = now - windowMs;
    const ref = doc(firestore, 'rateLimits', ip);

    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() || { count: 0, windowStart: now };
      
      if (data.windowStart < windowStart) {
        data.count = 0;
        data.windowStart = now;
      }
      
      data.count++;
      
      if (data.count > maxRequests) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      tx.set(ref, { 
        ...data, 
        expiresAt: Timestamp.fromMillis(now + windowMs) 
      });
    });
    
    return false; // not limited
  } catch (e) {
    if (e instanceof Error && e.message === 'RATE_LIMIT_EXCEEDED') {
      return true; // limited
    }
    // Fallback to in-memory on Firestore error
    return rateLimit(ip, windowMs, maxRequests);
  }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Create a standardized JSON error response.
 */
export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Firebase Auth verification middleware.
 * Verifies the Authorization: Bearer <idToken> header.
 * Returns { uid } on success, or NextResponse error on failure.
 */
export async function withAuth(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 });
  }
  
  const idToken = authHeader.split(' ')[1];
  
  try {
    const { firestore } = initializeFirebase();
    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (error) {
    console.error('[withAuth] Token verification failed:', error);
    return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
  }
}

/**
 * Admin-only middleware. Requires valid auth + admin custom claim.
 */
export async function withAdminAuth(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const authResult = await withAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult; // Already an error response
  }
  
  try {
    const { firestore } = initializeFirebase();
    const adminAuth = getAuth();
    const userRecord = await adminAuth.getUser(authResult.uid);
    
    if (!userRecord.customClaims?.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    return { uid: authResult.uid };
  } catch (error) {
    console.error('[withAdminAuth] Admin check failed:', error);
    return NextResponse.json({ error: 'Forbidden: Admin verification failed' }, { status: 403 });
  }
}