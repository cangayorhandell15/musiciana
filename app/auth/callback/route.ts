import { NextResponse } from 'next/server'
// Gagamitin natin yung createClient na nakita sa server.ts mo
import { createClient } from '@/utils/supabase/server' 

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Kung successful ang login/signup, dito natin siya ipapasa
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Kung may problema o nabigo, ibalik sa main/login page
  return NextResponse.redirect(`${origin}`)
}