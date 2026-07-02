import { useEffect, useRef } from 'react'

/**
 * The deliberate-consent gate for partial spoilers. Nothing about the fight's
 * ending renders anywhere until the user confirms here, per fight, every
 * session. Confirmation is never persisted.
 */
export function RevealDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reveal-title">Reveal how it ended?</h2>
        <p>
          This shows the <strong>round, time, and method</strong> for this one fight — a partial
          spoiler you are choosing to see.
        </p>
        <p className="never">
          The winner is never shown. That data does not exist in this app.
        </p>
        <div className="actions">
          <button ref={cancelRef} className="btn ghost" onClick={onCancel}>
            Keep it sealed
          </button>
          <button className="btn primary" onClick={onConfirm}>
            Reveal
          </button>
        </div>
      </div>
    </div>
  )
}
