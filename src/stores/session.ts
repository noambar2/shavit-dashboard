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

/** The logged-in user and the home-page announcements. */
export const useSessionStore = defineStore('session', () => {
  const user = ref<CurrentUser | null>(null)
  const announcements = ref<Announcement[]>([])
  /** Announcements a regular user hid. In memory only, so they come back on the next page load. */
  const hidden = ref<string[]>([])
  /** Ticks every minute so announcements disappear on time without a reload. */
  const now = ref(Date.now())
  setInterval(() => (now.value = Date.now()), 60_000)

  const isAdmin = computed(() => !!user.value?.isAdmin)

  const activeAnnouncements = computed(() => announcements.value.filter((a) => new Date(a.expiresAt).getTime() > now.value))

  /** Admins always see every active announcement so they can manage them; others can hide ones they've read. */
  const visibleAnnouncements = computed(() =>
    activeAnnouncements.value.filter((a) => isAdmin.value || !hidden.value.includes(a.id)),
  )
  const hiddenCount = computed(() => activeAnnouncements.value.length - visibleAnnouncements.value.length)

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

  function hide(id: string) {
    hidden.value = [...hidden.value, id]
  }

  function showHidden() {
    hidden.value = []
  }

  return {
    user,
    isAdmin,
    announcements,
    visibleAnnouncements,
    hiddenCount,
    load,
    reloadAnnouncements,
    saveAnnouncement,
    removeAnnouncement,
    hide,
    showHidden,
    setTestAdmin,
  }
})
