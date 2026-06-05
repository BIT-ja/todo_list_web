import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../utils/token'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'todoList',
      component: () => import('../views/TodoListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/todos/new',
      name: 'todoNew',
      component: () => import('../views/TodoNewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/todos/:id/edit',
      name: 'todoEdit',
      component: () => import('../views/TodoEditView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const token = getToken()
  if (to.meta.requiresAuth && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (!to.meta.requiresAuth && token && (to.name === 'login' || to.name === 'register')) {
    return { name: 'todoList' }
  }
})

export default router
