<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import HoverTip from './HoverTip.vue'

defineProps<{
  title: string
  /** Text for the ⓘ tooltip next to the title. */
  info?: string
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="card">
    <header class="head">
      <h2 class="title">
        {{ title }}
        <HoverTip v-if="info" :text="info">
          <button class="info" type="button" :aria-label="`מידע על ${title}`">
            <AppIcon name="info" :size="15" />
          </button>
        </HoverTip>
      </h2>
      <div class="actions"><slot name="actions" /></div>
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
