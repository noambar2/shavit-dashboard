/**
 * Fake current user + announcements. Announcements created in the demo are kept
 * in this browser's localStorage so they survive a page reload.
 */
import type { Announcement, AnnouncementInput, CurrentUser } from '@/api/types'

const ROLE_KEY = 'mock-is-admin'

function initialIsAdmin(): boolean {
  try {
    const saved = localStorage.getItem(ROLE_KEY)
    if (saved !== null) return saved === 'true'
  } catch {
    /* storage unavailable — use .env */
  }
  return import.meta.env.VITE_MOCK_ADMIN !== 'false'
}

/** Starts from `VITE_MOCK_ADMIN` in .env; the test toggle in the navbar switches it and remembers the choice. */
export const mockUser: CurrentUser = {
  employeeId: '7654321',
  fullName: 'משתמש לדוגמה',
  isAdmin: initialIsAdmin(),
}

export function setMockAdmin(isAdmin: boolean) {
  mockUser.isAdmin = isAdmin
  try {
    localStorage.setItem(ROLE_KEY, String(isAdmin))
  } catch {
    /* storage unavailable — lasts until reload */
  }
}

const STORAGE_KEY = 'mock-announcements'
const DAY = 24 * 60 * 60 * 1000

function seed(): Announcement[] {
  const now = Date.now()
  return [
    {
      id: 'a1',
      title: 'עדכון מערכת',
      message: 'ביום חמישי בין 18:00 ל-20:00 המערכת תהיה בתחזוקה ועשויה לא להיות זמינה.',
      severity: 'warning',
      createdAt: new Date(now - DAY).toISOString(),
      expiresAt: new Date(now + 6 * DAY).toISOString(),
      createdBy: { employeeId: '1111111', fullName: 'מנהל מערכת' },
    },
  ]
}

function load(): Announcement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Announcement[]
  } catch {
    /* storage unavailable — fall back to the seed */
  }
  return seed()
}

function save(list: Announcement[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable — changes last until reload */
  }
}

let store = load()

function forbiddenUnlessAdmin() {
  if (!mockUser.isAdmin) throw new Error('403 Forbidden')
}

export function active(): Announcement[] {
  const now = Date.now()
  return store
    .filter((a) => new Date(a.expiresAt).getTime() > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function create(input: AnnouncementInput): Announcement {
  forbiddenUnlessAdmin()
  const item: Announcement = {
    ...input,
    id: `a${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: { employeeId: mockUser.employeeId, fullName: mockUser.fullName },
  }
  store = [item, ...store]
  save(store)
  return item
}

export function update(id: string, input: AnnouncementInput): Announcement {
  forbiddenUnlessAdmin()
  const existing = store.find((a) => a.id === id)
  if (!existing) throw new Error('404 Not Found')
  const item = { ...existing, ...input, title: input.title || undefined }
  store = store.map((a) => (a.id === id ? item : a))
  save(store)
  return item
}

export function remove(id: string) {
  forbiddenUnlessAdmin()
  store = store.filter((a) => a.id !== id)
  save(store)
}
