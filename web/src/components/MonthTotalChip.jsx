import { Link } from 'react-router-dom'
import { useSummary } from '../hooks/useKharchaData'
import { formatINR, monthLabelFromKey } from '../lib/format'
import { currentMonthKey } from '../lib/insights'
import { IconCard, IconIncome, IconSpend } from './TypeIcons'

/**
 * Compact MTD strip.
 * kind: 'expense' | 'income' | 'credit'
 */
export default function MonthTotalChip({ kind = 'expense' }) {
  const { data, loading } = useSummary()
  const key = currentMonthKey()
  const month = monthLabelFromKey(key)

  let value = null
  let label = ''
  let to = '/expense?view=month'
  let Icon = IconSpend
  let tone = 'spend'

  if (kind === 'income') {
    value = data?.mtd?.income
    label = `${month} income`
    to = '/income?view=month'
    Icon = IconIncome
    tone = 'income'
  } else if (kind === 'credit') {
    value = data?.creditOutstanding ?? data?.mtd?.creditOutstanding ?? data?.mtd?.credit
    label =
      data?.creditOutstanding != null || data?.mtd?.creditOutstanding != null
        ? 'Card due'
        : `${month} card`
    to = '/credit?view=month'
    Icon = IconCard
    tone = 'credit'
  } else {
    value = data?.mtd?.spend
    label = `${month} spend`
    to = '/expense?view=month'
    Icon = IconSpend
    tone = 'spend'
  }

  if (loading && value == null) {
    return <div className={`month-total-chip is-loading tone-${tone}`}>Loading month…</div>
  }
  if (value == null) return null

  return (
    <Link to={to} className={`month-total-chip tone-${tone}`}>
      <span className="month-total-left">
        <span className="month-total-ico" aria-hidden>
          <Icon size={15} />
        </span>
        <span className="month-total-label">{label}</span>
      </span>
      <strong>{formatINR(value)}</strong>
    </Link>
  )
}
