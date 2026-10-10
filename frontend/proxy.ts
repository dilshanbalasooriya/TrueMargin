import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // First run i18n routing to get the response (with redirects/headers)
  const response = handleI18nRouting(request);
  // Then pass that response to Supabase to attach session cookies
  return await updateSession(request, response);
}

export const config = {
  // Match only internationalized pathnames, plus auth callback
  matcher: ['/', '/(en|si)/:path*', '/auth/:path*']
};
