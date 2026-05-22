import { NextRequest, NextResponse } from 'next/server'
import { detectCountry, getTier, getPricing } from '@/lib/geo'

export async function GET(request: NextRequest) {
  const country = detectCountry(request.headers)
  const tier = getTier(country)
  const pricing = getPricing(tier)
  pricing.country = country

  return NextResponse.json(pricing)
}
