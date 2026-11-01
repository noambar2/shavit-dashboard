<script setup lang="ts">
/** Admin form for creating or editing an announcement, including how long it stays up. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { Announcement, AnnouncementSeverity } from '@/api/types'
import { formatDate } from '@/utils/format'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps<{ announcement?: Announcement | null }>()
const emit = defineEmits<{ close: [] }>()

const MAX_MESSAGE = 500
const DURATIONS = [
  { id: '1', label: 'יום אחד', days: 1 },
  { id: '3', label: '3 ימים', days: 3 },
  { id: '7', label: 'שבוע', days: 7 },
  { id: '30', label: 'חודש', days: 30 },
  { id: 'custom', label: 'תאריך אחר', days: 0 },
] as const
type DurationId = (typeof DURATIONS)[number]['id']

const SEVERITIES: { id: AnnouncementSeverity; label: string }[] = [
  { id: 'info', label: 'מידע' },
  { id: 'warning', label: 'חשוב' },
]

const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toIsoDay(d)
}

const editing = computed(() => !!props.announcement)
const title = ref(props.announcement?.title ?? '')
const message = ref(props.announcement?.message ?? '')
const severity = ref<AnnouncementSeverity>(props.announcement?.severity ?? 'info')
const duration = ref<DurationId>(props.announcement ? 'custom' : '7')
const customDay = ref(props.announcement ? toIsoDay(new Date(props.announcement.expiresAt)) : addDays(14))
const todayIso = toIsoDay(new Date())

/** The last day the announcement is shown (inclusive). */
const lastDay = computed(() => {
  const d = DURATIONS.find((x) => x.id === duration.value)!
  return d.id === 'custom' ? customDay.value : addDays(d.days)
})

const errors = computed(() => {
  const list: string[] = []
  if (!message.value.trim()) list.push('יש לכתוב את תוכן ההודעה')
  if (message.value.length > MAX_MESSAGE) list.push(`ההודעה ארוכה מ-${MAX_MESSAGE} תווים`)
  if (!lastDay.value || lastDay.value < todayIso) list.push('יש לבחור תאריך מהיום והלאה')
  return list
})

const submitted = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const session = useSessionStore()

async function submit() {
  submitted.value = true
  if (errors.value.length) return
  saving.value = true
  saveError.value = null
  try {
    // Shown until the end of the chosen day, in the admin's local time.
    const [y, m, d] = lastDay.value.split('-').map(Number)
    const expiresAt = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
    await session.saveAnnouncement(
      { title: title.value.trim() || undefined, message: message.value.trim(), severity: severity.value, expiresAt },
      props.announcement?.id,
    )
    emit('close')
  } catch {
    saveError.value = 'השמירה נכשלה. נסו שוב.'
  } finally {
    saving.value = false
  }
}

const messageEl = ref<HTMLTextAreaElement | null>(null)
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  nextTick(() => messageEl.value?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="ann-title" dir="rtl" @submit.prevent="submit">
        <header class="head">
          <h2 id="ann-title">{{ editing ? 'עריכת הודעה' : 'הודעה חדשה' }}</h2>
          <button type="button" class="icon-btn plain" aria-label="סגירה" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <label class="field">
          <span class="label">כותרת <span class="optional">(לא חובה)</span></span>
          <input v-model="title" type="text" maxlength="80" />
        </label>

        <label class="field">
          <span class="label">תוכן ההודעה</span>
          <textarea ref="messageEl" v-model="message" rows="4" :maxlength="MAX_MESSAGE" />
          <span class="counter num">{{ message.length }}/{{ MAX_MESSAGE }}</span>
        </label>

        <fieldset class="field">
          <legend class="label">סוג</legend>
          <div class="segmented">
            <button
              v-for="s in SEVERITIES"
              :key="s.id"
              type="button"
              :class="[s.id, { active: severity === s.id }]"
              :aria-pressed="severity === s.id"
              @click="severity = s.id"
            >
              {{ s.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="field">
          <legend class="label">משך הצגה</legend>
          <div class="chips">
            <button
              v-for="d in DURATIONS"
              :key="d.id"
              type="button"
              class="chip"
              :class="{ active: duration === d.id }"
              :aria-pressed="duration === d.id"
              @click="duration = d.id"
            >
              {{ d.label }}
            </button>
          </div>
          <input v-if="duration === 'custom'" v-model="customDay" type="date" class="date" :min="todayIso" aria-label="תאריך תפוגה" />
          <p v-if="lastDay" class="hint">
            ההודעה תוצג עד סוף היום <b class="num">{{ formatDate(lastDay) }}</b> ותוסר אוטומטית.
          </p>
        </fieldset>

        <ul v-if="submitted && errors.length" class="errors">
          <li v-for="e in errors" :key="e">{{ e }}</li>
        </ul>
        <p v-if="saveError" class="errors">{{ saveError }}</p>

        <footer class="actions">
          <button type="submit" class="primary" :disabled="saving">{{ saving ? 'שומר…' : editing ? 'שמירת שינויים' : 'פרסום הודעה' }}</button>
          <button type="button" class="secondary" @click="emit('close')">ביטול</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(7 25 56 / 35%);
}
.dialog {
  width: min(480px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 24px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  font-family: var(--font);
  color: var(--text);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 18px;
  color: var(--darkest);
}
.field {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}
.label {
  padding: 0;
  font-weight: 600;
  color: var(--darkest);
}
.optional {
  font-weight: 400;
  color: var(--text-medium);
}
input[type='text'],
textarea,
.date {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
  resize: vertical;
}
input:focus,
textarea:focus {
  border-color: var(--main-blue);
  box-shadow: 0 0 0 3px var(--selected-bg);
}
.counter {
  align-self: flex-end;
  font-size: 11px;
  color: var(--text-light);
}
.segmented {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
}
.segmented button {
  padding: 4px 18px;
  border-radius: 999px;
  color: var(--text-medium);
}
.segmented button.info.active {
  background: var(--selected-bg);
  color: var(--main-blue);
  font-weight: 600;
}
.segmented button.warning.active {
  background: #fef0dc;
  color: #b8700f;
  font-weight: 600;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--darkest);
}
.chip.active {
  border-color: var(--main-blue);
  background: var(--selected-bg);
  color: var(--main-blue);
  font-weight: 600;
}
.date {
  width: auto;
  align-self: flex-start;
}
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-medium);
}
.errors {
  margin: 0;
  padding: 8px 12px;
  list-style: none;
  border-radius: var(--radius-sm);
  background: #fdecee;
  color: var(--error);
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 8px;
}
.primary {
  height: 36px;
  padding: 0 20px;
  border-radius: var(--radius-sm);
  background: var(--main-blue);
  color: #fff;
  font-weight: 600;
}
.primary:disabled {
  opacity: 0.6;
}
.secondary {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  color: var(--darkest);
}
.secondary:hover {
  background: var(--bg);
}
</style>
