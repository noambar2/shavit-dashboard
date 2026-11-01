import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getCurrentUser,
  setMockAdmin,
  updateAnnouncement,
} from '@/api/dashboard'
import type { Announcement, AnnouncementInput, CurrentUser } from '@/api/types'

const DISMISSED_KEY = 'dismissed-announcements'

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** The logged-in user and the home-page announcements. */
export const useSessionStore = defineStore('session', () => {
  const user = ref<CurrentUser | null>(null)
  const announcements = ref<Announcement[]>([])
  const dismissed = ref<string[]>(loadDismissed())
  /** Ticks every minute so announcements disappear on time without a reload. */
  const now = ref(Date.now())
  setInterval(() => (now.value = Date.now()), 60_000)

  const isAdmin = computed(() => !!user.value?.isAdmin)

  /** Admins always see every active announcement so they can manage them; others can hide ones they've read. */
  const visibleAnnouncements = computed(() =>
    announcements.value.filter(
      (a) => new Date(a.expiresAt).getTime() > now.value && (isAdmin.value || !dismissed.value.includes(a.id)),
    ),
  )

  async function load() {
    const [me, list] = await Promise.all([getCurrentUser(), getAnnouncements()])
    user.value = me
    announcements.value = list
  }

  async function reloadAnnouncements() {
    announcements.value = await getAnnouncements()
  }

  async function saveAnnouncement(input: AnnouncementInput, id?: string) {
    if (id) await updateAnnouncement(id, input)
    else await createAnnouncement(input)
    await reloadAnnouncements()
  }

  async function removeAnnouncement(id: string) {
    await deleteAnnouncement(id)
    await reloadAnnouncements()
  }

  /** Test toggle (mock mode only). */
  function setTestAdmin(isAdmin: boolean) {
    setMockAdmin(isAdmin)
    if (user.value) user.value = { ...user.value, isAdmin }
  }

  function dismiss(id: string) {
    dismissed.value = [...dismissed.value, id]
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed.value))
    } catch {
      /* storage unavailable — stays hidden until reload */
    }
  }

  return {
    user,
    isAdmin,
    announcements,
    visibleAnnouncements,
    load,
    reloadAnnouncements,
    saveAnnouncement,
    removeAnnouncement,
    dismiss,
    setTestAdmin,
  }
})
