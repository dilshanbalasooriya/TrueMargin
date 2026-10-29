import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/+$/, '')
  const redirectPath = next.startsWith('/') ? next : `/${next}`

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // redirect user to specified redirect URL or root of app
      return NextResponse.redirect(new URL(redirectPath, baseUrl))
    }
  }

  // redirect the user to an error page with some instructions
  return NextResponse.redirect(new URL('/auth/auth-code-error', baseUrl))
}
