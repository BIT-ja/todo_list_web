<template>
  <div class="page-with-button">
    <van-nav-bar title="待办事项">
      <template #right>
        <van-icon name="manager-o" size="20" @click="handleLogout" />
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="activeTab" @change="handleTabChange" sticky>
      <van-tab title="全部" />
      <van-tab title="未完成" />
      <van-tab title="已完成" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="loading && !todos.length" class="loading-wrapper">
        <van-loading size="24px">加载中...</van-loading>
      </div>

      <TodoEmpty
        v-else-if="!todos.length"
        text="暂无待办事项"
        :show-action="activeTab !== 2"
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

    <van-floating-bubble icon="plus" @click="router.push('/todos/new')" />
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

const statusMap = [undefined, 'active', 'completed'] as const

async function fetchTodos() {
  loading.value = true
  try {
    const status = statusMap[activeTab.value]
    const res = await getTodoList({ status })
    todos.value = res.list
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  fetchTodos().finally(() => {
    refreshing.value = false
  })
}

function handleTabChange() {
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

.todo-list {
  margin-top: 8px;
  overflow: hidden;
  background: #fff;
  border-radius: 8px 8px 0 0;
}
</style>
