<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import AppNavbar from '@/components/layout/AppNavbar.vue'

const session = useSessionStore()
onMounted(() => session.load().catch(() => {
  /* not logged in or API down — the dashboard still works, just without announcements/admin tools */
}))
</script>

<template>
  <AppNavbar />
  <RouterView />
</template>
