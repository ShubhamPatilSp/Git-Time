// Geo-detection utility for PPP pricing tiers
// Tier 1 = High purchasing power countries (USD pricing)
// Tier 2 = Emerging markets (INR pricing)

const TIER1_COUNTRIES = new Set([
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK',
  'CH', 'AT', 'IE', 'NZ', 'SG', 'JP', 'KR', 'FI', 'BE', 'LU',
  'IT', 'ES', 'PT', 'IL', 'AE', 'QA', 'KW', 'BH', 'SA',
])

export type PricingTier = 'tier1' | 'tier2'

export interface PricingInfo {
  tier: PricingTier
  country: string
  monthly: { amount: number; currency: string; display: string }
  annual: { amount: number; currency: string; display: string }
}

export function detectCountry(headers: Headers): string {
  // Render sets x-forwarded-for but not country headers by default.
  // Vercel sets x-vercel-ip-country, Cloudflare sets cf-ipcountry.
  // We check all of them and default to 'IN' (India) as fallback
  // since the primary user base is Indian.
  return (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    headers.get('x-country-code') ||
    'IN'
  ).toUpperCase()
}

export function getTier(countryCode: string): PricingTier {
  return TIER1_COUNTRIES.has(countryCode.toUpperCase()) ? 'tier1' : 'tier2'
}

export function getPricing(tier: PricingTier): PricingInfo {
  if (tier === 'tier1') {
    return {
      tier: 'tier1',
      country: '',
      monthly: { amount: 999, currency: 'USD', display: '$9.99' },
      annual: { amount: 7900, currency: 'USD', display: '$79.00' },
    }
  }
  return {
    tier: 'tier2',
    country: '',
    monthly: { amount: 39900, currency: 'INR', display: '₹399' },
    annual: { amount: 299900, currency: 'INR', display: '₹2,999' },
  }
}

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxCommitsPerGen: 100,
    maxRunsPerMonth: 3,
    maxZipSizeMB: 10,
    canUseAI: false,
    canUsePRMerges: false,
    canUseDensity: false,
  },
  pro: {
    maxCommitsPerGen: 2000,
    maxRunsPerMonth: 30,
    maxZipSizeMB: 150,
    canUseAI: true,
    canUsePRMerges: true,
    canUseDensity: true,
  },
} as const
