<script setup lang="ts">
import type { useReportExport } from '@/composables/useReportExport'
import AppIcon from '@/components/common/AppIcon.vue'

defineProps<{ status: ReturnType<typeof useReportExport>['status']['value'] }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="status.state !== 'idle'" class="toast" :class="status.state" role="status" aria-live="polite" dir="rtl">
      <template v-if="status.state === 'working'">
        <span class="spinner" />
        <div class="text">
          <strong>{{ status.kind === 'consolidated' ? 'מרכזים עבורכם את הדוחות…' : 'מכינים עבורכם את הדוח השמי…' }}</strong>
          <span>{{ status.name }} · זה עשוי לקחת כמה שניות</span>
        </div>
      </template>
      <template v-else-if="status.state === 'done'">
        <svg class="badge" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="currentColor" />
          <path d="m7.5 12.5 3 3 6-6.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="text">
          <strong>הדוח מוכן והורד למחשב</strong>
          <span>{{ status.filename }}</span>
        </div>
      </template>
      <template v-else>
        <svg class="badge" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="currentColor" />
          <path d="M12 7v6M12 16.5h.01" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        <div class="text">
          <strong>הפקת הדוח נכשלה</strong>
          <span>{{ status.name }} · נסו שוב בעוד רגע</span>
        </div>
      </template>
      <button v-if="status.state !== 'working'" type="button" class="close" aria-label="סגירה" @click="$emit('dismiss')">
        <AppIcon name="close" :size="14" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  z-index: 95;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 320px;
  max-width: calc(100vw - 32px);
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-pop);
  font-family: var(--font);
  color: var(--darkest);
  animation: rise 0.2s ease-out;
}
.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.text span {
  font-size: 12px;
  color: var(--text-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spinner {
  flex: none;
  width: 22px;
  height: 22px;
  border: 3px solid var(--neutral-tint);
  border-top-color: var(--main-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.badge {
  flex: none;
}
.done .badge {
  color: var(--success);
}
.error .badge {
  color: var(--error);
}
.close {
  display: grid;
  color: var(--text-medium);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
}
</style>
