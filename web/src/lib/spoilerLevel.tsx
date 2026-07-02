import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/**
 * Spoiler level:
 *  1 — Minimal: only finish vs distance per fight
 *  2 — Ratings: adds excitement score, pace, and the "why" breakdown
 * Per-fight reveals (round/method) are NOT a level — they are deliberate,
 * per-fight, unpersisted actions. The winner exists at no level: that data
 * is not in the app's files at all.
 */
export type SpoilerLevel = 1 | 2

const STORAGE_KEY = 'ko.spoilerLevel'

interface SpoilerContextValue {
  level: SpoilerLevel
  setLevel: (level: SpoilerLevel) => void
}

const SpoilerContext = createContext<SpoilerContextValue>({ level: 1, setLevel: () => {} })

function readStored(): SpoilerLevel {
  try {
    return localStorage.getItem(STORAGE_KEY) === '2' ? 2 : 1
  } catch {
    return 1
  }
}

export function SpoilerProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<SpoilerLevel>(readStored)
  const setLevel = useCallback((next: SpoilerLevel) => {
    setLevelState(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* private mode */
    }
  }, [])
  return <SpoilerContext.Provider value={{ level, setLevel }}>{children}</SpoilerContext.Provider>
}

export function useSpoilerLevel(): SpoilerContextValue {
  return useContext(SpoilerContext)
}
