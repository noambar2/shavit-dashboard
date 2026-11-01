<script setup lang="ts">
/**
 * Testing aid: switch the fake user between admin and regular user.
 * Only rendered while VITE_USE_MOCKS=true, so it never appears against the real backend.
 */
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const { user, isAdmin } = storeToRefs(session)
</script>

<template>
  <div v-if="user" class="test-toggle" role="radiogroup" aria-label="מצב בדיקה: סוג משתמש">
    <span class="tag">מצב בדיקה</span>
    <button type="button" role="radio" :aria-checked="isAdmin" :class="{ active: isAdmin }" @click="session.setTestAdmin(true)">
      מנהלן
    </button>
    <button type="button" role="radio" :aria-checked="!isAdmin" :class="{ active: !isAdmin }" @click="session.setTestAdmin(false)">
      משתמש רגיל
    </button>
  </div>
</template>

<style scoped>
.test-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 2px 2px 4px;
  border: 1px dashed #e0a24e;
  border-radius: 999px;
  background: #fffaf2;
  font-size: 12px;
}
.tag {
  padding: 0 8px;
  color: #b8700f;
  font-weight: 600;
}
button {
  padding: 3px 12px;
  border-radius: 999px;
  color: var(--text-medium);
}
button.active {
  background: #fde7c6;
  color: #8a5207;
  font-weight: 600;
}
</style>
