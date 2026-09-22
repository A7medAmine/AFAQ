/**
 * DigiKey Product Information API v4, 2-legged OAuth (client credentials).
 * Tokens live ~10 minutes; one is cached in memory and refreshed a minute early.
 */
const BASE_URL = 'https://api.digikey.com'

let cachedToken = null
let tokenExpiresAt = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const { DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET } = process.env
  if (!DIGIKEY_CLIENT_ID || !DIGIKEY_CLIENT_SECRET) {
    throw new Error('DigiKey credentials are not configured.')
  }

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DIGIKEY_CLIENT_ID,
      client_secret: DIGIKEY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) {
    throw new Error(`DigiKey token request failed (${res.status}).`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 600) - 60, 30) * 1000
  return cachedToken
}

async function digikeyFetch(path, options = {}, retried = false) {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
      'X-DIGIKEY-Locale-Site': process.env.DIGIKEY_SITE || 'US',
      'X-DIGIKEY-Locale-Language': process.env.DIGIKEY_LANGUAGE || 'en',
      'X-DIGIKEY-Locale-Currency': process.env.DIGIKEY_CURRENCY || 'USD',
      Accept: 'application/json',
    },
  })

  // Token revoked or expired early: drop it and retry once.
  if (res.status === 401 && !retried) {
    cachedToken = null
    return digikeyFetch(path, options, true)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const err = new Error(`DigiKey request failed (${res.status}).`)
    err.status = res.status
    err.detail = detail.slice(0, 500)
    throw err
  }
  return res.json()
}

// DigiKey returns some links protocol-relative ("//mm.digikey.com/...").
const absUrl = url => (url ? (url.startsWith('//') ? `https:${url}` : url) : null)

/** Flatten DigiKey's product shape into what the inventory form needs. */
function toProduct(p) {
  let category = p.Category
  while (category?.ChildCategories?.length) category = category.ChildCategories[0]

  return {
    digikeyNumber: p.ProductVariations?.[0]?.DigiKeyProductNumber || null,
    manufacturer: p.Manufacturer?.Name || null,
    partNumber: p.ManufacturerProductNumber || null,
    description: p.Description?.ProductDescription || '',
    detailedDescription: p.Description?.DetailedDescription || '',
    category: category?.Name || p.Category?.Name || null,
    unitPrice: p.UnitPrice ?? null,
    quantityAvailable: p.QuantityAvailable ?? null,
    photoUrl: absUrl(p.PhotoUrl),
    datasheetUrl: absUrl(p.DatasheetUrl),
    productUrl: absUrl(p.ProductUrl),
  }
}

export async function searchProducts(keywords, limit = 10) {
  const data = await digikeyFetch('/products/v4/search/keyword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Keywords: keywords, Limit: limit, Offset: 0 }),
  })

  const exact = (data.ExactMatches || []).map(toProduct)
  const seen = new Set(exact.map(p => p.partNumber))
  const rest = (data.Products || []).map(toProduct).filter(p => !seen.has(p.partNumber))
  return { total: data.ProductsCount ?? 0, products: [...exact, ...rest].slice(0, limit) }
}
