import { NextRequest, NextResponse } from 'next/server';
import { type ZodSchema, ZodError } from 'zod';

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
 * Simple in-memory rate limiter.
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
