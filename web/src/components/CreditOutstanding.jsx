import { Link } from 'react-router-dom'
import { useSummary } from '../hooks/useKharchaData'
import { formatINR } from '../lib/format'
import { IconCard, IconChevron } from './TypeIcons'

/** Compact card due strip (from summary — payment ledger is Kharcha-only for now). */
export default function CreditOutstanding() {
  const { data: summary, loading } = useSummary()
  const outstanding =
    summary?.creditOutstanding ?? summary?.mtd?.creditOutstanding ?? summary?.mtd?.credit ?? null
  const dueLabel = outstanding == null && loading ? '…' : formatINR(outstanding || 0)
  const hasDue = Boolean(outstanding)

  return (
    <section className="due-card">
      <div className="due-card-head">
        <div className="due-card-title">
          <span className="due-card-ico" aria-hidden>
            <IconCard size={16} />
          </span>
          <div>
            <p className="due-card-label">Card this month</p>
            <p className="due-card-amount">{dueLabel}</p>
          </div>
        </div>
        {!hasDue && !loading ? <span className="due-card-ok">Cleared</span> : null}
      </div>
      <Link to="/credit?view=month" className="due-link">
        Month view <IconChevron size={13} />
      </Link>
    </section>
  )
}
