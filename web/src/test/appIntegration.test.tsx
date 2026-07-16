import fs from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanForSpoilers } from '@ko/shared'
import App from '../App'

// Serve the real published dataset through a mocked fetch (cwd = web/).
const dataDir = path.resolve(process.cwd(), 'public', 'data', 'v1')

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input)
    const m = url.match(/data\/v1\/(.+)$/)
    if (!m) return new Response('not found', { status: 404 })
    const file = path.join(dataDir, m[1]!)
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 })
    return new Response(fs.readFileSync(file, 'utf8'), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('app integration over real published data', () => {
  it('shows the explainer masthead with the demo fight, and it dismisses', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Khabib Nurmagomedov/)).toBeTruthy(), {
      timeout: 5000,
    })
    expect(screen.getByText('Submission')).toBeTruthy()
    expect(screen.getByText('Stoppage')).toBeTruthy()
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /dismiss explainer/i }))
    expect(screen.queryByText(/Khabib Nurmagomedov/)).toBeNull()
    expect(localStorage.getItem('ko.explainerDismissed')).toBe('1')
  })

  it('renders the event list, navigates to an event, and leaks nothing', async () => {
    render(<App />)
    // real newest event from the dataset appears
    await waitFor(() => expect(screen.getByText(/Fiziev vs\. Torres/)).toBeTruthy(), {
      timeout: 5000,
    })
    // home list carries no excitement/heat info anymore
    expect(document.querySelector('.heat-badge')).toBeNull()

    fireEvent.click(screen.getByText(/Fiziev vs\. Torres/))
    await waitFor(
      () =>
        expect(screen.getAllByRole('button', { name: /reveal method —/i }).length).toBeGreaterThan(5),
      { timeout: 5000 },
    )

    // Whole-document spoiler scan, everything sealed
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])
    expect(document.body.innerHTML).not.toMatch(/KO \(|def\.|48[–-]47/)

    // unseal one cell of the main event: only that cell's value appears
    fireEvent.click(screen.getAllByRole('button', { name: /reveal method —/i })[0]!)
    await waitFor(() => expect(screen.getByText('KO/TKO')).toBeTruthy())
    expect(screen.getAllByRole('button', { pressed: true }).length).toBe(1)
    // the same fight's round/time stays sealed
    expect(document.body.innerHTML).not.toMatch(/>R\d+</)
    // even after reveal: no winner vocabulary anywhere
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])

    // unseal a combined-stat cell: real published stats render spoiler-free
    fireEvent.click(screen.getAllByRole('button', { name: /reveal control time —/i })[0]!)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { pressed: true }).length).toBe(2),
    )
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])
  }, 20000)
})
