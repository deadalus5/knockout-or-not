import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import type { Fight } from '@ko/shared'
import { scanForSpoilers } from '@ko/shared'
import { FightRow } from '../components/FightRow'
import { SpoilerProvider } from '../lib/spoilerLevel'

const fight: Fight = {
  id: 'f01',
  order: 1,
  card: 'main',
  weightClass: 'Lightweight',
  titleFight: true,
  fighters: ['Charles Oliveira', 'Ilia Topuria'],
  scheduledRounds: 5,
  resultClass: 'early',
  excitement: 93,
  stars: 5,
  pace: 'high',
  why: ['Ended inside the distance', 'Explosive striking exchanges'],
  scoreConfidence: 'full',
  stats: {
    combinedKD: 2,
    sigStrPerMin: 11.4,
    combinedTakedowns: 0,
    combinedSubAttempts: 0,
    controlPct: 3,
  },
  reveal: {
    round: 1,
    time: '2:27',
    method: 'KO/TKO',
    methodDetail: 'Punch',
    bonuses: ['PERF'],
  },
}

function Harness({ f = fight }: { f?: Fight }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <SpoilerProvider>
      <FightRow fight={f} revealed={revealed} onReveal={() => setRevealed(true)} />
    </SpoilerProvider>
  )
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('FightRow at level 1 (minimal)', () => {
  it('shows only fighters, weight class, and finish/distance — nothing else', () => {
    localStorage.setItem('ko.spoilerLevel', '1')
    const { container } = render(<Harness />)
    expect(screen.getByText(/Charles Oliveira/)).toBeTruthy()
    expect(screen.getByText('Ended early')).toBeTruthy()
    const html = container.innerHTML
    // level-2 data must not render
    expect(html).not.toContain('93')
    expect(html).not.toMatch(/high pace/i)
    expect(html).not.toContain('Explosive striking')
    // reveal data must not render
    expect(html).not.toContain('KO/TKO')
    expect(html).not.toContain('2:27')
    expect(html).not.toContain('Performance')
  })
})

describe('FightRow at level 2 (ratings)', () => {
  beforeEach(() => localStorage.setItem('ko.spoilerLevel', '2'))

  it('shows excitement and pace but still no reveal data', () => {
    const { container } = render(<Harness />)
    expect(screen.getByText('93')).toBeTruthy()
    expect(screen.getByText('high pace')).toBeTruthy()
    const html = container.innerHTML
    expect(html).not.toContain('KO/TKO')
    expect(html).not.toContain('Round')
    expect(html).not.toContain('2:27')
  })

  it('expands the why breakdown with vetted phrases only', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText(/Why this rating/))
    expect(screen.getByText('Explosive striking exchanges')).toBeTruthy()
  })
})

describe('reveal flow', () => {
  beforeEach(() => localStorage.setItem('ko.spoilerLevel', '2'))

  it('requires explicit confirmation before showing method/round/time', () => {
    const { container } = render(<Harness />)
    fireEvent.click(screen.getByText(/Reveal how it ended/))
    // dialog open, but data still not revealed
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(container.querySelector('.reveal-panel')).toBeNull()
    // cancel keeps it sealed
    fireEvent.click(screen.getByText('Keep it sealed'))
    expect(container.innerHTML).not.toContain('KO/TKO')
    // confirm reveals
    fireEvent.click(screen.getByText(/Reveal how it ended/))
    fireEvent.click(screen.getByText('Reveal'))
    expect(container.innerHTML).toContain('KO/TKO')
    expect(container.innerHTML).toContain('2:27')
  })

  it('warns that the winner is never shown', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText(/Reveal how it ended/))
    expect(screen.getByText(/The winner is never shown/)).toBeTruthy()
  })

  it('never persists reveals to localStorage', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText(/Reveal how it ended/))
    fireEvent.click(screen.getByText('Reveal'))
    const keys = Object.keys(localStorage)
    expect(keys).toEqual(['ko.spoilerLevel'])
  })
})

describe('spoiler regression: rendered HTML is clean at every state', () => {
  it.each(['1', '2'] as const)('level %s markup contains no forbidden patterns', (level) => {
    localStorage.setItem('ko.spoilerLevel', level)
    const { container } = render(<Harness />)
    fireEvent.click(screen.queryByText(/Why this rating/) ?? document.body)
    expect(scanForSpoilers(container.innerHTML)).toEqual([])
  })

  it('draw fights render as "went the distance" with no draw hint before reveal', () => {
    localStorage.setItem('ko.spoilerLevel', '2')
    const drawFight: Fight = {
      ...fight,
      resultClass: 'distance',
      reveal: { round: 3, time: '5:00', method: 'Draw', methodDetail: 'Majority draw', bonuses: [] },
    }
    const { container } = render(<Harness f={drawFight} />)
    expect(screen.getByText('Went the distance')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/draw/i)
  })
})
