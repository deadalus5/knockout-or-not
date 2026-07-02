import { useSpoilerLevel } from '../lib/spoilerLevel'

export function SpoilerLevelPicker() {
  const { level, setLevel } = useSpoilerLevel()
  return (
    <div className="level-picker">
      <span className="label">Detail</span>
      <div className="segmented" role="group" aria-label="Spoiler detail level">
        <button aria-pressed={level === 1} onClick={() => setLevel(1)}>
          Minimal
        </button>
        <button aria-pressed={level === 2} onClick={() => setLevel(2)}>
          Ratings
        </button>
      </div>
    </div>
  )
}
