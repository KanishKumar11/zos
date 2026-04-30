// Edge middleware — gates app routes by auth cookie + role. Decodes JWT payload (NOT verified
// here; the API verifies signatures); uses payload solely to perform UX-level redirects.
import { type NextRequest, NextResponse } from 'next/server';

import { ruleForPath } from '@/lib/route-rules';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/accept-invite'];

function decodeRole(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
    ) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;
  if (!accessToken && !refreshToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const role = decodeRole(accessToken);
  const rule = ruleForPath(pathname);
  if (rule && role && !rule.allow.includes(role as never)) {
    const url = req.nextUrl.clone();
    url.pathname = '/forbidden';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
