<template>
  <div
    class="page-with-button todo-page"
    @pointerdown.passive="spawnParticles"
  >
    <van-nav-bar title="待办事项">
      <template #right>
        <button class="nav-avatar" type="button" @click="router.push('/profile')">
          {{ avatarText }}
        </button>
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

          <div v-else class="todo-list" :class="{ 'todo-list--dragging': draggingTodoId !== null }">
            <div
              v-for="todo in todos"
              :key="todo.id"
              class="todo-list__row"
              :class="{
                'todo-list__row--dragging': draggingTodoId === todo.id,
                'todo-list__row--same-group': draggingGroupKey === getDragGroupKey(todo),
              }"
              :data-todo-id="todo.id"
            >
              <TodoRow
                :todo="todo"
                @click="router.push(`/todos/${todo.id}/edit`)"
                @toggle="handleToggle"
                @pin="handlePin"
                @urgent="handleUrgent"
                @delete="handleDelete"
                @drag-start="handleDragStart"
              />
            </div>
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
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getTodoList,
  completeTodo,
  uncompleteTodo,
  deleteTodo,
  updateTodo,
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
const draggingTodoId = ref<number | null>(null)
const draggingGroupKey = ref('')

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
let dragStartOrder: number[] = []
let dragMoved = false

const avatarText = computed(() => {
  const username = userStore.username || '我'
  return username.trim().charAt(0).toUpperCase() || '我'
})

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

function getDragGroupKey(todo: TodoItem) {
  return [
    todo.status,
    todo.is_pinned ? 1 : 0,
    todo.is_urgent ? 1 : 0,
    todo.priority,
  ].join(':')
}

function handleDragStart({ todo, event }: { todo: TodoItem; event: PointerEvent }) {
  event.preventDefault()
  const groupKey = getDragGroupKey(todo)
  const groupCount = todos.value.filter((item) => getDragGroupKey(item) === groupKey).length
  if (groupCount < 2) {
    showToast('同优先级内暂无可拖动项')
    return
  }

  draggingTodoId.value = todo.id
  draggingGroupKey.value = groupKey
  dragStartOrder = todos.value.map((item) => item.id)
  dragMoved = false

  document.addEventListener('pointermove', handleDragMove, { passive: false })
  document.addEventListener('pointerup', handleDragEnd, { once: true })
  document.addEventListener('pointercancel', handleDragCancel, { once: true })
}

function handleDragMove(event: PointerEvent) {
  if (draggingTodoId.value == null) return

  event.preventDefault()
  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.todo-list__row')
  if (!row?.dataset.todoId) return

  const targetId = Number(row.dataset.todoId)
  if (!Number.isFinite(targetId) || targetId === draggingTodoId.value) return

  const targetTodo = todos.value.find((todo) => todo.id === targetId)
  if (!targetTodo || getDragGroupKey(targetTodo) !== draggingGroupKey.value) return

  const fromIndex = todos.value.findIndex((todo) => todo.id === draggingTodoId.value)
  const toIndex = todos.value.findIndex((todo) => todo.id === targetId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const nextTodos = [...todos.value]
  const [draggedTodo] = nextTodos.splice(fromIndex, 1)
  nextTodos.splice(toIndex, 0, draggedTodo)
  todos.value = nextTodos
  dragMoved = true
}

function handleDragEnd() {
  finishDrag(true)
}

function handleDragCancel() {
  finishDrag(false)
}

function cleanupDragListeners() {
  document.removeEventListener('pointermove', handleDragMove)
  document.removeEventListener('pointerup', handleDragEnd)
  document.removeEventListener('pointercancel', handleDragCancel)
}

async function finishDrag(shouldPersist: boolean) {
  if (draggingTodoId.value == null) return

  const groupKey = draggingGroupKey.value
  const hasOrderChanged = todos.value.some((todo, index) => todo.id !== dragStartOrder[index])
  cleanupDragListeners()
  draggingTodoId.value = null
  draggingGroupKey.value = ''

  if (!shouldPersist || !dragMoved || !hasOrderChanged) {
    return
  }

  try {
    const groupTodos = todos.value.filter((todo) => getDragGroupKey(todo) === groupKey)
    await Promise.all(groupTodos.map((todo, index) => updateTodo(todo.id, {
      sort_order: groupTodos.length - index,
    })))
    showToast('排序已更新')
  } catch {
    // handled by interceptor
  } finally {
    fetchTodos()
  }
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

onMounted(async () => {
  if (!userStore.username) {
    await userStore.fetchUser()
  }
  fetchTodos()
})

onBeforeUnmount(() => {
  cleanupDragListeners()
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

.nav-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #1989fa, #7b61ff);
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding: 8px 12px 0;
  background: transparent;
}

.todo-list__row {
  overflow: hidden;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(31, 35, 41, 0.05);
  transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.todo-list--dragging .todo-list__row:not(.todo-list__row--same-group) {
  opacity: 0.56;
}

.todo-list__row--dragging {
  transform: scale(0.985);
  box-shadow: 0 8px 22px rgba(25, 137, 250, 0.16);
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
