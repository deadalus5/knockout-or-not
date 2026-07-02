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
  localStorage.setItem('ko.spoilerLevel', '2')
  localStorage.setItem('ko.promiseDismissed', '1')
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
  it('renders the event list, navigates to an event, and leaks nothing', async () => {
    render(<App />)
    // real newest event from the dataset appears
    await waitFor(() => expect(screen.getByText(/Fiziev vs\. Torres/)).toBeTruthy(), {
      timeout: 5000,
    })

    fireEvent.click(screen.getByText(/Fiziev vs\. Torres/))
    await waitFor(() => expect(screen.getAllByText(/Reveal how it ended/).length).toBeGreaterThan(5), {
      timeout: 5000,
    })

    // Whole-document spoiler scan at ratings level, pre-reveal
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])
    expect(document.body.innerHTML).not.toMatch(/KO \(|def\.|48[–-]47/)

    // reveal the main event deliberately
    fireEvent.click(screen.getAllByText(/Reveal how it ended/)[0]!)
    fireEvent.click(screen.getByText('Reveal'))
    await waitFor(() => expect(screen.getByText('KO/TKO')).toBeTruthy())
    // even after reveal: no winner vocabulary anywhere
    expect(scanForSpoilers(document.body.innerHTML)).toEqual([])
  }, 20000)
})
