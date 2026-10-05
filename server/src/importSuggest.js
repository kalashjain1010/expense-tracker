/**
 * Free categorization for SMS imports: rule map first, optional Gemini Flash.
 * Never requires a paid API — falls back to "others" + user confirm.
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

const MERCHANT_RULES = [
  { re: /swiggy|zomato|eat|restaurant|cafe|starbucks|dominos|mcdonald/i, cat: 'Food' },
  { re: /bigbasket|blinkit|zepto|instamart|grocery|dmart|reliance fresh|more supermarket/i, cat: 'Groceries' },
  { re: /zerodha|groww|mf |mutual|sip|kuvera|coin|stocks?/i, cat: 'Investments' },
  { re: /uber|ola|rapido|irctc|makemytrip|goibibo|indigo|air india|train|metro|petrol|fuel|hpcl|bpcl|iocl/i, cat: 'Travel' },
  { re: /rent|electricity|bescom|tata power|airtel|jio|vi |vodafone|broadband|wifi|gas|cylinder/i, cat: 'Rent & utils' },
  { re: /amazon|flipkart|myntra|ajio|nykaa|meesho|apple\.com|steam/i, cat: 'Wants' },
  { re: /pharmacy|1mg|pharmeasy|apollo|hospital|clinic|medicine/i, cat: 'needs' },
]

export function suggestCategoryFromMerchant(merchant = '') {
  const m = String(merchant || '')
  for (const rule of MERCHANT_RULES) {
    if (rule.re.test(m)) return { category: rule.cat, confidence: 0.85, source: 'rules' }
  }
  return { category: 'others', confidence: 0.4, source: 'rules' }
}

export async function suggestCategoryWithAi({ merchant, amount, note }) {
  const fallback = suggestCategoryFromMerchant(merchant)
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return fallback

  const prompt = `Classify this Indian UPI/bank debit into exactly one category key.
Categories: ${EXPENSE_CATEGORIES.join(', ')}
Merchant: ${merchant || 'unknown'}
Amount: ${amount ?? ''}
Note: ${note || ''}
Reply with ONLY the category key, nothing else.`

  try {
    const models = ['gemini-flash-latest', 'gemini-3.8-flash']
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 16 },
        }),
      })
      if (res.status === 503) continue
      if (!res.ok) continue
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      const cleaned = text.replace(/[`"'*_]/g, '').split(/\s|\n/)[0] || ''
      const hit = EXPENSE_CATEGORIES.find(
        (c) => c.toLowerCase() === cleaned.toLowerCase() || c.toLowerCase() === text.toLowerCase(),
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
