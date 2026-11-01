import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/candidate/:id?', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'פרטי מלש"ב' } },
    { path: '/users', component: () => import('@/views/PlaceholderView.vue'), props: { title: 'משתמשים' } },
  ],
})
