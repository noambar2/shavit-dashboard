<script setup lang="ts">
/** Announcement banners at the top of the home page. Admins get edit/delete; everyone else can hide a banner. */
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@/stores/session'
import type { Announcement } from '@/api/types'
import { formatDate } from '@/utils/format'
import AppIcon from '@/components/common/AppIcon.vue'

const emit = defineEmits<{ edit: [announcement: Announcement] }>()

const session = useSessionStore()
const { visibleAnnouncements, hiddenCount, isAdmin } = storeToRefs(session)

const confirmingDelete = ref<string | null>(null)
const busy = ref<string | null>(null)
const failed = ref<string | null>(null)

const isoDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function remove(id: string) {
  busy.value = id
  failed.value = null
  try {
    await session.removeAnnouncement(id)
    confirmingDelete.value = null
  } catch {
    failed.value = id
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <button v-if="hiddenCount" type="button" class="hidden-note" @click="session.showHidden()">
    <AppIcon name="eye" :size="14" />
    {{ hiddenCount === 1 ? 'הודעה אחת מוסתרת' : `${hiddenCount} הודעות מוסתרות` }} · הצגה
  </button>
  <ul v-if="visibleAnnouncements.length" class="announcements" aria-label="הודעות">
    <li v-for="a in visibleAnnouncements" :key="a.id" class="banner" :class="a.severity" role="status">
      <!-- Filled shape + white glyph reads as a status marker, not a button. -->
      <svg class="badge" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <template v-if="a.severity === 'warning'">
          <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" fill="currentColor" />
          <path d="M12 9v4.5M12 17h.01" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="10.5" fill="currentColor" />
          <path d="M12 11v6M12 7.5h.01" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
        </template>
      </svg>
      <p class="text">
        <strong v-if="a.title">{{ a.title }}</strong>
        {{ a.message }}
      </p>

      <div class="side">
        <template v-if="isAdmin">
          <span class="meta">
            מוצגת עד <span class="num">{{ formatDate(isoDay(a.expiresAt)) }}</span> · {{ a.createdBy.fullName }}
          </span>
          <template v-if="confirmingDelete === a.id">
            <span class="confirm">{{ failed === a.id ? 'המחיקה נכשלה, לנסות שוב?' : 'למחוק את ההודעה?' }}</span>
            <button type="button" class="link danger" :disabled="busy === a.id" @click="remove(a.id)">מחיקה</button>
            <button type="button" class="link" @click="confirmingDelete = null">ביטול</button>
          </template>
          <template v-else>
            <button type="button" class="icon-btn plain" aria-label="עריכת הודעה" @click="emit('edit', a)">
              <AppIcon name="edit" :size="16" />
            </button>
            <button type="button" class="icon-btn plain" aria-label="מחיקת הודעה" @click="confirmingDelete = a.id">
              <AppIcon name="trash" :size="16" />
            </button>
          </template>
        </template>
        <button
          v-else
          type="button"
          class="icon-btn plain"
          aria-label="הסתרת ההודעה עד לרענון הדף"
          title="הסתרה (תחזור ברענון)"
          @click="session.hide(a.id)"
        >
          <AppIcon name="eye-off" :size="16" />
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.hidden-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 2px 4px;
  font-size: 12px;
  color: var(--text-medium);
}
.hidden-note:hover {
  color: var(--main-blue);
}
.announcements {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--radius);
  border: 1px solid;
}
.banner.info {
  background: #eef3ff;
  border-color: #cddbff;
}
.banner.info .badge {
  color: var(--main-blue);
}
.banner.warning {
  background: #fef6ec;
  border-color: #f8dcb5;
}
.banner.warning .badge {
  color: #e39a35;
}
.badge {
  flex: none;
}
.text {
  margin: 0;
  flex: 1;
  color: var(--darkest);
  line-height: 1.5;
}
.text strong {
  margin-inline-end: 6px;
}
.side {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.meta {
  font-size: 12px;
  color: var(--text-medium);
  margin-inline-end: 8px;
}
.confirm {
  font-size: 13px;
  color: var(--darkest);
  margin-inline-end: 4px;
}
.link {
  padding: 4px 8px;
  font-weight: 600;
  color: var(--main-blue);
}
.link.danger {
  color: var(--error);
}
.link:disabled {
  opacity: 0.5;
}
</style>
