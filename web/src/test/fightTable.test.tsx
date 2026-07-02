import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Fight } from '@ko/shared'
import { scanForSpoilers } from '@ko/shared'
import { CELL_DEFS, FightTable } from '../components/FightTable'

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
    combinedSigStrLanded: 152,
    combinedSigStrAttempted: 301,
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

// Values that must never be in the DOM while their cell is sealed.
const SEALED_VALUES = ['93', 'KO/TKO', '2:27', 'Ended early', '152', '11.4', 'Performance']

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('sealed by default', () => {
  it('shows fighters, weight class, and title marker — no detail values', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    expect(screen.getByText(/Charles Oliveira/)).toBeTruthy()
    expect(screen.getByText('Lightweight')).toBeTruthy()
    expect(screen.getByText('Title')).toBeTruthy()
    const html = container.innerHTML
    for (const value of SEALED_VALUES) expect(html).not.toContain(value)
  })

  it('renders one sealed reveal button per cell', () => {
    render(<FightTable fights={[fight]} />)
    const buttons = screen.getAllByRole('button', { pressed: false })
    expect(buttons.length).toBe(CELL_DEFS.length)
    for (const def of CELL_DEFS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`reveal ${def.name}`, 'i') }),
      ).toBeTruthy()
    }
  })
})

describe('single-cell isolation', () => {
  it('revealing method shows only method (+detail +bonus), nothing else', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal method/i }))
    expect(screen.getByText('KO/TKO')).toBeTruthy()
    expect(screen.getByText('Punch')).toBeTruthy()
    expect(screen.getByText('Performance bonus')).toBeTruthy()
    const html = container.innerHTML
    expect(html).not.toContain('2:27')
    expect(html).not.toContain('93')
    expect(html).not.toContain('Ended early')
    expect(html).not.toContain('152')
    expect(screen.getAllByRole('button', { pressed: true }).length).toBe(1)
  })

  it('revealing round shows only round and time', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal round/i }))
    expect(container.innerHTML).toContain('2:27')
    expect(container.innerHTML).not.toContain('KO/TKO')
  })

  it('revealing significant strikes shows landed of attempted', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal significant strikes/i }))
    expect(container.innerHTML).toContain('152')
    expect(container.innerHTML).toContain('301')
    expect(container.innerHTML).not.toContain('KO/TKO')
  })
})

describe('rating cell', () => {
  it('reveals score, pace, and vetted why phrases', () => {
    render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal rating/i }))
    expect(screen.getByText('93')).toBeTruthy()
    expect(screen.getByText('high pace')).toBeTruthy()
    expect(screen.getByText('Explosive striking exchanges')).toBeTruthy()
  })

  it('filters finish-restating phrases so rating cannot leak the sealed finish cell', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal rating/i }))
    expect(container.innerHTML).not.toContain('Ended inside the distance')
    expect(container.innerHTML).not.toContain('Ended early')
  })
})

describe('missing data', () => {
  const bareFight: Fight = {
    ...fight,
    excitement: null,
    stars: null,
    pace: null,
    why: ['Not enough data to rate'],
    scoreConfidence: 'none',
    stats: null,
    reveal: { round: null, time: '1:44', method: 'Submission', methodDetail: null, bonuses: [] },
  }

  it('stat cells stay clickable and reveal a graceful empty state', () => {
    render(<FightTable fights={[bareFight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal significant strikes/i }))
    fireEvent.click(screen.getByRole('button', { name: /reveal knockdowns/i }))
    expect(screen.getAllByText('No data').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /reveal round/i }))
    expect(screen.getByText('Not recorded')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /reveal rating/i }))
    expect(screen.getByText('Not rated')).toBeTruthy()
  })
})

describe('no persistence', () => {
  it('reveals never touch localStorage', () => {
    render(<FightTable fights={[fight]} />)
    for (const def of CELL_DEFS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`reveal ${def.name}`, 'i') }))
    }
    expect(Object.keys(localStorage)).toEqual([])
  })
})

describe('spoiler regression: rendered HTML is clean at every state', () => {
  it('sealed, per-cell, and fully revealed states contain no forbidden patterns', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    expect(scanForSpoilers(container.innerHTML)).toEqual([])
    for (const def of CELL_DEFS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`reveal ${def.name}`, 'i') }))
      expect(scanForSpoilers(container.innerHTML)).toEqual([])
    }
  })

  it('draw fights show no draw hint until the method cell is revealed', () => {
    const drawFight: Fight = {
      ...fight,
      resultClass: 'distance',
      why: ['Went the distance'],
      reveal: { round: 3, time: '5:00', method: 'Draw', methodDetail: 'Majority draw', bonuses: [] },
    }
    const { container } = render(<FightTable fights={[drawFight]} />)
    expect(container.innerHTML).not.toMatch(/draw/i)
    fireEvent.click(screen.getByRole('button', { name: /reveal finish/i }))
    expect(screen.getByText('Went the distance')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/draw/i)
    fireEvent.click(screen.getByRole('button', { name: /reveal method/i }))
    expect(screen.getAllByText(/draw/i).length).toBeGreaterThan(0)
    expect(scanForSpoilers(container.innerHTML)).toEqual([])
  })
})
