<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <main class="placeholder">
    <h1>{{ title }}</h1>
    <p>העמוד הזה עדיין לא עוצב.</p>
  </main>
</template>

<style scoped>
.placeholder {
  padding: 48px 30px;
  color: var(--text-medium);
}
h1 {
  color: var(--darkest);
  font-size: 22px;
}
</style>
