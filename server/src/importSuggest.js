/**
 * Free categorization for SMS imports: rule map first (merchant + full SMS),
 * optional Gemini Flash. Falls back to "others" + user confirm.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Investments',
  'Wants',
  'Travel',
  'needs',
  'Rent & utils',
  'others',
]

/** Match against merchant name AND full SMS body */
const MERCHANT_RULES = [
  {
    re: /swiggy|zomato|eatclub|restaurant|cafe|starbucks|dominos|mcdonald|burger\s*king|kfc|pizza|dunzo\s*food|magicpin|eatsure|box8|faasos|behrouz|subway|haldiram|bikanervala|chai|coffee\s*day|ccd\b/i,
    cat: 'Food',
  },
  {
    re: /bigbasket|blinkit|zepto|instamart|grocery|dmart|d-mart|reliance\s*fresh|more\s*supermarket|nature'?s\s*basket|spencer|jiomart|bbdaily|milkbasket|freshtohome|licious|meatigo/i,
    cat: 'Groceries',
  },
  {
    re: /zerodha|groww|upstox|angel\s*one|mf\b|mutual\s*fund|\bsip\b|kuvera|coin\b|stocks?|nse\b|bse\b|etmoney|paytm\s*money|hdfc\s*sec|icici\s*direct|kite\b/i,
    cat: 'Investments',
  },
  {
    re: /uber|ola\b|rapido|irctc|makemytrip|goibibo|indigo|air\s*india|spicejet|vistara|train|metro|petrol|fuel|hpcl|bpcl|iocl|nayara|shell\b|quickride|blusmart|namma\s*yatri|redbus|abhibus|rapido|parking/i,
    cat: 'Travel',
  },
  {
    re: /rent\b|electricity|bescom|tata\s*power|adani\s*electricity|airtel|jio\b|vi\b|vodafone|broadband|wifi|gas\b|cylinder|indane|hp\s*gas|water\s*bill|society\s*maint|maintenance|wifi|act\s*fibernet|hathway|bsnl/i,
    cat: 'Rent & utils',
  },
  {
    re: /amazon|flipkart|myntra|ajio|nykaa|meesho|ajio|tatacliq|snapdeal|shopify|apple\.com|steam\b|decathlon|ikea|croma|reliancedigital|vijaysales|lifestyle|pantaloons|westside|zara|h&m|hm\b|nike|adidas|puma/i,
    cat: 'Wants',
  },
  {
    re: /pharmacy|1mg|pharmeasy|apollo|hospital|clinic|medicine|netmed|medplus|practom|dentist|doctor|lab\s*test|healthians|thyrocare/i,
    cat: 'needs',
  },
]

export function suggestCategoryFromText(merchant = '', body = '') {
  const hay = `${merchant} ${body}`
  for (const rule of MERCHANT_RULES) {
    if (rule.re.test(hay)) return { category: rule.cat, confidence: 0.88, source: 'rules' }
  }
  return { category: 'others', confidence: 0.35, source: 'rules' }
}

/** @deprecated use suggestCategoryFromText */
export function suggestCategoryFromMerchant(merchant = '') {
  return suggestCategoryFromText(merchant, '')
}

export async function suggestCategoryWithAi({ merchant, amount, note, body }) {
  const fallback = suggestCategoryFromText(merchant, body || note || '')
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return fallback

  // Strong rule hit — skip AI (faster + reliable)
  if (fallback.source === 'rules' && fallback.category !== 'others' && fallback.confidence >= 0.85) {
    return fallback
  }

  const prompt = `You classify Indian UPI/bank debit SMS into ONE expense category.

Valid category keys (reply with exactly one key, nothing else):
Food, Groceries, Investments, Wants, Travel, needs, Rent & utils, others

Hints:
- Food = restaurants, cafes, food delivery (Swiggy, Zomato)
- Groceries = kirana, Blinkit, Zepto, BigBasket, Instamart
- Travel = Uber, Ola, fuel, metro, flights, trains
- Wants = Amazon, Flipkart, fashion, shopping, gadgets
- needs = pharmacy, hospital, medicines
- Rent & utils = rent, electricity, mobile/broadband recharge, gas
- Investments = stocks, MF, SIP, Zerodha, Groww
- others = only if unclear

Merchant: ${merchant || 'unknown'}
Amount: ${amount ?? ''}
SMS: ${(body || note || '').slice(0, 280)}

Reply with ONLY the category key.`

  try {
    const models = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-3.8-flash']
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 24 },
        }),
      })
      if (res.status === 503 || res.status === 429) continue
      if (!res.ok) continue
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      const cleaned = text
        .replace(/[`"'*_]/g, '')
        .split(/[\s\n,.]/)
        .map((s) => s.trim())
        .filter(Boolean)[0] || ''
      const hit = EXPENSE_CATEGORIES.find(
        (c) =>
          c.toLowerCase() === cleaned.toLowerCase() ||
          c.toLowerCase() === text.toLowerCase().trim() ||
          text.toLowerCase().includes(c.toLowerCase()),
      )
      if (hit) return { category: hit, confidence: 0.9, source: 'gemini' }
    }
    return fallback
  } catch {
    return fallback
  }
}

/**
 * Merge a confirmed import into an existing day entry (or create fresh maps).
 */
export function mergeImportIntoEntry(existing, { amount, category, noteAppend }) {
  const cats = {}
  for (const k of EXPENSE_CATEGORIES) cats[k] = 0
  if (existing?.found && existing.categories) {
    for (const [k, v] of Object.entries(existing.categories)) {
      if (k in cats) cats[k] = Number(v) || 0
    }
  }
  const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'others'
  cats[cat] = (Number(cats[cat]) || 0) + Number(amount || 0)

  let note = existing?.found ? String(existing.note || '') : ''
  const bit = String(noteAppend || '').trim()
  if (bit) {
    note = note ? `${note} | ${bit}` : bit
  }
  return { categories: cats, note }
}
