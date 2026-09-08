// Shared API helpers — every route returns the same envelope.
import { NextResponse } from 'next/server';
import { z } from 'zod';

export interface ApiOk<T> { ok: true; data: T }
export interface ApiErr { ok: false; error: { code: string; message: string; details?: unknown } }
export type ApiResult<T> = ApiOk<T> | ApiErr;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, init);
}

export function err(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiErr>({ ok: false, error: { code, message, details } }, { status });
}

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { ok: true; data: T } | { ok: false; error: ReturnType<typeof err> } {
  const r = schema.safeParse(body);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: err('INVALID_INPUT', 'Validation failed', 400, r.error.flatten()) };
}

// JSON helpers for Prisma stringified-JSON fields
export const jParse = <T = unknown>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
export const jString = (v: unknown): string => JSON.stringify(v ?? []);
