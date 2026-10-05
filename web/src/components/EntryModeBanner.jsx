/**
 * Shows whether the selected date already has a sheet row (edit) or is new.
 */
export default function EntryModeBanner({ loading, existing, label = 'entry' }) {
  if (loading) {
    return (
      <div className="entry-mode loading" role="status">
        <span className="spinner spinner-ink" />
        Checking this date…
      </div>
    )
  }

  if (existing?.found) {
    return (
      <div className="entry-mode edit" role="status">
        <strong>Editing existing {label}</strong>
        <span>
          Data for this date is loaded
          {existing.count > 1
            ? ` · ${existing.count} rows found — updating the latest`
            : ' · save will update this row (no duplicate)'}
        </span>
      </div>
    )
  }

  return (
    <div className="entry-mode fresh" role="status">
      <strong>New {label}</strong>
      <span>No row for this date yet · save will add one</span>
    </div>
  )
}
