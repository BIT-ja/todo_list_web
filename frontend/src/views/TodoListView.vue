<template>
  <div
    class="page-with-button todo-page"
    @pointerdown.passive="spawnParticles"
  >
    <van-nav-bar title="待办事项">
      <template #right>
        <van-icon name="manager-o" size="20" @click="handleLogout" />
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="activeTab" @change="handleTabChange" sticky>
      <van-tab v-for="tab in tabs" :key="tab.title" :title="tab.title">
        <van-pull-refresh v-model="refreshing" class="todo-refresh" @refresh="onRefresh">
          <div v-if="loading && !todos.length" class="loading-wrapper">
            <van-loading size="24px">加载中...</van-loading>
          </div>

          <TodoEmpty
            v-else-if="!todos.length"
            text="暂无待办事项"
            :show-action="tab.showCreate"
            action-text="新建待办"
            @action="router.push('/todos/new')"
          />

          <div v-else class="todo-list">
            <TodoRow
              v-for="todo in todos"
              :key="todo.id"
              :todo="todo"
              @click="router.push(`/todos/${todo.id}/edit`)"
              @toggle="handleToggle"
              @pin="handlePin"
              @urgent="handleUrgent"
              @delete="handleDelete"
            />
          </div>
        </van-pull-refresh>
      </van-tab>
    </van-tabs>

    <van-floating-bubble icon="plus" @click="router.push('/todos/new')" />

    <div class="click-particles" aria-hidden="true">
      <span
        v-for="particle in particles"
        :key="particle.id"
        class="click-particle"
        :style="{
          left: `${particle.x}px`,
          top: `${particle.y}px`,
          '--particle-x': `${particle.dx}px`,
          '--particle-y': `${particle.dy}px`,
          '--particle-color': particle.color,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getTodoList,
  completeTodo,
  uncompleteTodo,
  deleteTodo,
  pinTodo,
  unpinTodo,
  urgentTodo,
  unurgentTodo,
  type TodoItem,
} from '../api/todo'
import { useUserStore } from '../stores/user'
import { showDialog, showToast } from 'vant'
import TodoRow from '../components/TodoRow.vue'
import TodoEmpty from '../components/TodoEmpty.vue'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref(0)
const todos = ref<TodoItem[]>([])
const loading = ref(false)
const refreshing = ref(false)
const particles = ref<ClickParticle[]>([])

const tabs = [
  { title: '未完成', status: 'active', showCreate: true },
  { title: '已完成', status: 'completed', showCreate: false },
  { title: '全部', status: undefined, showCreate: true },
] as const

type ClickParticle = {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  color: string
}

let particleId = 0
let fetchId = 0

function spawnParticles(event: PointerEvent) {
  if (!event.isPrimary || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const colors = ['#1989fa', '#07c160', '#ff976a', '#ee0a24']
  const nextParticles = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8
    const distance = 20 + Math.random() * 18
    return {
      id: particleId++,
      x: event.clientX,
      y: event.clientY,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      color: colors[index % colors.length],
    }
  })

  particles.value.push(...nextParticles)
  window.setTimeout(() => {
    const ids = new Set(nextParticles.map((particle) => particle.id))
    particles.value = particles.value.filter((particle) => !ids.has(particle.id))
  }, 620)
}

async function fetchTodos() {
  const currentFetchId = ++fetchId
  loading.value = true
  try {
    const status = tabs[activeTab.value]?.status
    const res = await getTodoList({ status })
    if (currentFetchId !== fetchId) return
    todos.value = res.list
  } catch {
    // handled by interceptor
  } finally {
    if (currentFetchId === fetchId) {
      loading.value = false
    }
  }
}

function onRefresh() {
  fetchTodos().finally(() => {
    refreshing.value = false
  })
}

function handleTabChange() {
  todos.value = []
  fetchTodos()
}

async function handleToggle(todo: TodoItem) {
  try {
    if (todo.status === 'active') {
      await completeTodo(todo.id)
      showToast('已完成')
    } else {
      await uncompleteTodo(todo.id)
      showToast('已恢复')
    }
    fetchTodos()
  } catch {
    // handled by interceptor
  }
}

async function handleDelete(todo: TodoItem) {
  try {
    await showDialog({ title: '确认删除', message: `确定删除「${todo.title}」吗？`, showCancelButton: true })
    await deleteTodo(todo.id)
    showToast('已删除')
    fetchTodos()
  } catch {
    // cancelled or error
  }
}

async function handlePin(todo: TodoItem) {
  try {
    if (todo.is_pinned) {
      await unpinTodo(todo.id)
      showToast('已取消置顶')
    } else {
      await pinTodo(todo.id)
      showToast('已置顶')
    }
    fetchTodos()
  } catch {
    // handled by interceptor
  }
}

async function handleUrgent(todo: TodoItem) {
  try {
    if (todo.is_urgent) {
      await unurgentTodo(todo.id)
      showToast('已取消加急')
    } else {
      await urgentTodo(todo.id)
      showToast('已加急')
    }
    fetchTodos()
  } catch {
    // handled by interceptor
  }
}

function handleLogout() {
  showDialog({ title: '退出登录', message: '确定要退出登录吗？', showCancelButton: true })
    .then(() => {
      userStore.logout()
      router.replace('/login')
    })
    .catch(() => {})
}

onMounted(() => {
  fetchTodos()
})
</script>

<style scoped>
.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.todo-page {
  min-height: 100%;
  padding-bottom: 0;
  background: #f7f8fa;
}

.todo-refresh {
  min-height: calc(100vh - var(--van-nav-bar-height, 46px) - var(--van-tabs-line-height, 44px));
  background: #f7f8fa;
}

.todo-refresh :deep(.van-pull-refresh__track) {
  min-height: inherit;
  padding-bottom: calc(var(--safe-bottom) + 80px);
  box-sizing: border-box;
}

.todo-list {
  margin-top: 8px;
  overflow: hidden;
  background: #fff;
  border-radius: 8px 8px 0 0;
}

.click-particles {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: none;
}

.click-particle {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--particle-color);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: click-particle-pop 620ms ease-out forwards;
}

@keyframes click-particle-pop {
  0% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.75);
  }

  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--particle-x)), calc(-50% + var(--particle-y))) scale(0.2);
  }
}
</style>
