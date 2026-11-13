/** Shared SVG icons — entry types + spend categories. */

export function IconSpend({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v9M9.2 9.8c.7-1 1.8-1.5 2.8-1.5 1.5 0 2.6.9 2.6 2.1 0 2.2-4.6 1.4-4.6 3.8 0 1 .9 1.8 2.2 1.8 1.1 0 2-.5 2.6-1.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconIncome({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 11.5 12 15.5l4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function IconCard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10.5h17" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 15h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlus({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}

export function IconCalendar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconSheet({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconPartial({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 12 12 6A6 6 0 0 1 18 12Z" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

export function IconCheck({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 12.2 10.8 14.8 15.8 9.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChevron({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CAT_PATHS = {
  Food: (
    <>
      <path d="M8 4v9a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 8h4M16 4v16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  Groceries: (
    <>
      <path d="M6 8h12l-1.2 10.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  Investments: (
    <>
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 15l3.5-4 2.5 2.5L17 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8h3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  Wants: (
    <>
      <path d="M12 19s-6.5-4.1-6.5-9A3.5 3.5 0 0 1 12 7.2 3.5 3.5 0 0 1 18.5 10c0 4.9-6.5 9-6.5 9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </>
  ),
  Travel: (
    <>
      <path d="M3.5 16.5 10 14l2.5-7.5L15 14l6.5 2.5-6.5 1.2L12 21l-1.5-5.3L3.5 16.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  needs: (
    <>
      <path d="M12 4.5 5.5 8v5.5c0 4 2.8 6.3 6.5 7.5 3.7-1.2 6.5-3.5 6.5-7.5V8L12 4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </>
  ),
  'Rent & utils': (
    <>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </>
  ),
  others: (
    <>
      <circle cx="7" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="17" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
}

export function CategoryIcon({ name, size = 14 }) {
  const paths = CAT_PATHS[name] || CAT_PATHS.others
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {paths}
    </svg>
  )
}

export function EntryTypeIcon({ type, size = 16 }) {
  if (type === 'income') return <IconIncome size={size} />
  if (type === 'credit') return <IconCard size={size} />
  return <IconSpend size={size} />
}
