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
const SEALED_VALUES = ['93', 'KO/TKO', 'Punch', 'R1', '2:27', 'Stoppage', 'Performance']

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
        screen.getByRole('button', { name: new RegExp(`reveal ${def.name} —`, 'i') }),
      ).toBeTruthy()
    }
  })
})

describe('single-cell isolation — one variable per reveal', () => {
  it('revealing method shows the method only, no detail or bonus', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal method —/i }))
    expect(screen.getByText('KO/TKO')).toBeTruthy()
    const html = container.innerHTML
    expect(html).not.toContain('Punch')
    expect(html).not.toContain('Performance')
    expect(html).not.toContain('2:27')
    expect(html).not.toContain('93')
    expect(html).not.toContain('Stoppage')
    expect(screen.getAllByRole('button', { pressed: true }).length).toBe(1)
  })

  it('revealing details shows detail text and bonus, not the method', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal details —/i }))
    expect(screen.getByText('Punch')).toBeTruthy()
    expect(screen.getByText('Performance bonus')).toBeTruthy()
    expect(container.innerHTML).not.toContain('KO/TKO')
  })

  it('revealing round shows only the round, not the time', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal round —/i }))
    expect(screen.getByText('R1')).toBeTruthy()
    expect(container.innerHTML).not.toContain('2:27')
  })

  it('revealing time shows only the time, not the round', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal time —/i }))
    expect(screen.getByText('2:27')).toBeTruthy()
    expect(container.innerHTML).not.toContain('R1')
  })

  it('revealing finish shows "Stoppage" for early endings', () => {
    render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal finish —/i }))
    expect(screen.getByText('Stoppage')).toBeTruthy()
  })

  it('revealing rating shows the score and nothing else — no why phrases', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal rating —/i }))
    expect(screen.getByText('93')).toBeTruthy()
    expect(container.innerHTML).not.toContain('Explosive striking')
    expect(container.innerHTML).not.toMatch(/why this rating/i)
    expect(container.innerHTML).not.toContain('pace')
  })
})

describe('column header reveal', () => {
  const second: Fight = {
    ...fight,
    id: 'f02',
    fighters: ['Max Holloway', 'Justin Gaethje'],
    resultClass: 'distance',
    reveal: { round: 5, time: '5:00', method: 'Decision - Unanimous', methodDetail: null, bonuses: [] },
  }

  it('clicking a column header reveals that column for every fight, others stay sealed', () => {
    const { container } = render(<FightTable fights={[fight, second]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal finish for all fights/i }))
    expect(screen.getByText('Stoppage')).toBeTruthy()
    expect(screen.getByText('Went the distance')).toBeTruthy()
    // one finish cell pressed per fight, nothing else revealed
    expect(screen.getAllByRole('button', { pressed: true }).length).toBe(2)
    expect(container.innerHTML).not.toContain('KO/TKO')
    expect(container.innerHTML).not.toContain('Decision')
    expect(container.innerHTML).not.toContain('93')
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

  it('cells stay clickable and reveal a graceful empty state', () => {
    render(<FightTable fights={[bareFight]} />)
    fireEvent.click(screen.getByRole('button', { name: /reveal round —/i }))
    expect(screen.getByText('Not recorded')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /reveal rating —/i }))
    expect(screen.getByText('Not rated')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /reveal details —/i }))
    expect(screen.getByText('None')).toBeTruthy()
  })
})

describe('no persistence', () => {
  it('reveals never touch localStorage', () => {
    render(<FightTable fights={[fight]} />)
    for (const def of CELL_DEFS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`reveal ${def.name} —`, 'i') }))
    }
    expect(Object.keys(localStorage)).toEqual([])
  })
})

describe('spoiler regression: rendered HTML is clean at every state', () => {
  it('sealed, per-cell, and fully revealed states contain no forbidden patterns', () => {
    const { container } = render(<FightTable fights={[fight]} />)
    expect(scanForSpoilers(container.innerHTML)).toEqual([])
    for (const def of CELL_DEFS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`reveal ${def.name} —`, 'i') }))
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
    fireEvent.click(screen.getByRole('button', { name: /reveal finish —/i }))
    expect(screen.getByText('Went the distance')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/draw/i)
    fireEvent.click(screen.getByRole('button', { name: /reveal method —/i }))
    expect(screen.getByText('Draw')).toBeTruthy()
    expect(scanForSpoilers(container.innerHTML)).toEqual([])
  })
})
