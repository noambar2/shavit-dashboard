<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import HoverTip from './HoverTip.vue'

defineProps<{
  title: string
  /** Text for the ⓘ tooltip next to the title. */
  info?: string
  loading?: boolean
  error?: string | null
  /** Adds a button that opens the card full screen (Esc or the backdrop closes it). */
  expandable?: boolean
}>()
defineEmits<{ retry: [] }>()

const fullscreen = ref(false)
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (fullscreen.value = false)
watch(fullscreen, (on) => (on ? document.addEventListener('keydown', onKey) : document.removeEventListener('keydown', onKey)))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="card" :class="{ fullscreen }">
    <Teleport to="body">
      <div v-if="fullscreen" class="card-backdrop" @click="fullscreen = false" />
    </Teleport>
    <header class="head">
      <h2 class="title">
        {{ title }}
        <HoverTip v-if="info" :text="info">
          <button class="info" type="button" :aria-label="`מידע על ${title}`">
            <AppIcon name="info" :size="15" />
          </button>
        </HoverTip>
      </h2>
      <div class="actions">
        <slot name="actions" />
        <button
          v-if="expandable"
          type="button"
          class="icon-btn plain"
          :aria-label="fullscreen ? 'סגירת מסך מלא' : 'מסך מלא'"
          @click="fullscreen = !fullscreen"
        >
          <AppIcon :name="fullscreen ? 'collapse' : 'expand'" :size="18" />
        </button>
      </div>
    </header>
    <div class="body">
      <slot />
      <div v-if="error" class="overlay error">
        <span>שגיאה בטעינת הנתונים</span>
        <button type="button" class="retry" @click="$emit('retry')">נסה שוב</button>
      </div>
      <div v-else-if="loading" class="overlay"><span class="spinner" /></div>
    </div>
  </section>
</template>

<style scoped>
.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.card.fullscreen {
  position: fixed;
  z-index: 61;
  inset: 32px;
  padding: 20px 24px;
  box-shadow: var(--shadow-pop);
}
.card-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(7 25 56 / 30%);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
}
.title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--darkest);
}
.info {
  display: inline-grid;
  color: var(--text);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  background: rgb(255 255 255 / 65%);
  border-radius: var(--radius);
}
.overlay.error {
  color: var(--error);
}
.retry {
  color: var(--main-blue);
  text-decoration: underline;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--neutral-tint);
  border-top-color: var(--main-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
