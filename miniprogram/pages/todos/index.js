const todoService = require('../../services/todo')
const authService = require('../../services/auth')
const { requireAuth, getStoredUser, setStoredUser } = require('../../utils/auth')
const { getDueMeta } = require('../../utils/time')
const { getIconOption } = require('../../utils/icon')

const PRIORITY_LABELS = ['无', '普通', '重要', '紧急']
const SWIPE_COMPLETE_THRESHOLD = 92
const SWIPE_ACTION_THRESHOLD = -70
const SWIPE_ACTION_OPEN = -216
const ROW_HEIGHT = 126

Page({
  data: {
    user: {},
    avatarText: '我',
    tabs: [
      { title: '未完成', status: 'active' },
      { title: '已完成', status: 'completed' },
      { title: '全部', status: '' },
    ],
    activeTab: 0,
    todos: [],
    loading: false,
    touch: null,
    draggingId: null,
    draggingGroupKey: '',
    dragStartIndex: -1,
    dragStartY: 0,
    dragMoved: false,
  },

  onLoad() {
    if (!requireAuth()) return
    this.bootstrap()
  },

  onShow() {
    if (!requireAuth()) return
    this.fetchTodos()
  },

  onPullDownRefresh() {
    this.fetchTodos().finally(() => wx.stopPullDownRefresh())
  },

  async bootstrap() {
    let user = getStoredUser()
    try {
      user = await authService.getMe()
      setStoredUser(user)
    } catch {
      user = getStoredUser() || {}
    }
    const username = user.username || '我'
    this.setData({
      user,
      avatarText: username.trim().charAt(0).toUpperCase() || '我',
    })
    this.fetchTodos()
  },

  async fetchTodos() {
    this.setData({ loading: true })
    try {
      const tab = this.data.tabs[this.data.activeTab]
      const result = await todoService.list({ status: tab.status || undefined, pageSize: 100 })
      this.setData({ todos: (result.list || []).map((todo) => this.decorateTodo(todo)) })
    } catch {
      // handled by request layer
    } finally {
      this.setData({ loading: false })
    }
  },

  decorateTodo(todo) {
    const due = getDueMeta(todo.due_at)
    const icon = getIconOption(todo.category_icon)
    const locations = Array.isArray(todo.locations) ? todo.locations : []
    return {
      ...todo,
      swipeX: 0,
      completeHintActive: false,
      priorityLabel: PRIORITY_LABELS[todo.priority] || '无',
      dueLabel: due.label,
      dueLevel: due.level,
      categoryGlyph: icon.glyph,
      locationText: locations[0]?.name || todo.location || '',
      dragGroupKey: this.getDragGroupKey(todo),
    }
  },

  switchTab(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index, todos: [] })
    this.fetchTodos()
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goNew() {
    wx.navigateTo({ url: '/pages/todos/form' })
  },

  goDetail(event) {
    const id = Number(event.currentTarget.dataset.id)
    const todo = this.data.todos.find((item) => item.id === id)
    if (!todo || Math.abs(todo.swipeX || 0) > 8 || this.data.draggingId) {
      this.resetSwipe()
      return
    }
    wx.navigateTo({ url: `/pages/todos/detail?id=${id}` })
  },

  getDragGroupKey(todo) {
    return [todo.status, todo.is_pinned ? 1 : 0, todo.is_urgent ? 1 : 0, todo.priority].join(':')
  },

  updateTodoView(id, patch) {
    const todos = this.data.todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo))
    this.setData({ todos })
  },

  resetSwipe(exceptId) {
    const todos = this.data.todos.map((todo) => (
      exceptId && todo.id === exceptId ? todo : { ...todo, swipeX: 0, completeHintActive: false }
    ))
    this.setData({ todos })
  },

  onCardTouchStart(event) {
    if (this.data.draggingId) return
    const touch = event.touches[0]
    this.setData({
      touch: {
        id: Number(event.currentTarget.dataset.id),
        startX: touch.clientX,
        startY: touch.clientY,
      },
    })
  },

  onCardTouchMove(event) {
    if (this.data.draggingId) {
      this.onDragMove(event)
      return
    }

    const touchState = this.data.touch
    if (!touchState) return
    const touch = event.touches[0]
    const dx = touch.clientX - touchState.startX
    const dy = touch.clientY - touchState.startY
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return

    const offset = Math.max(SWIPE_ACTION_OPEN, Math.min(112, dx))
    this.resetSwipe(touchState.id)
    this.updateTodoView(touchState.id, {
      swipeX: offset,
      completeHintActive: offset >= 62,
    })
  },

  async onCardTouchEnd() {
    if (this.data.draggingId) {
      this.finishDrag(true)
      return
    }

    const touchState = this.data.touch
    if (!touchState) return
    const todo = this.data.todos.find((item) => item.id === touchState.id)
    this.setData({ touch: null })
    if (!todo) return

    if (todo.swipeX >= SWIPE_COMPLETE_THRESHOLD) {
      this.resetSwipe()
      await this.toggleComplete(todo)
      return
    }

    if (todo.swipeX <= SWIPE_ACTION_THRESHOLD) {
      this.resetSwipe(todo.id)
      this.updateTodoView(todo.id, { swipeX: SWIPE_ACTION_OPEN, completeHintActive: false })
      return
    }

    this.resetSwipe()
  },

  async toggleComplete(todo) {
    try {
      if (todo.status === 'active') {
        await todoService.complete(todo.id)
        wx.showToast({ title: '已完成', icon: 'success' })
      } else {
        await todoService.uncomplete(todo.id)
        wx.showToast({ title: '已恢复', icon: 'success' })
      }
      this.fetchTodos()
    } catch {
      // handled by request layer
    }
  },

  async togglePin(event) {
    const id = Number(event.currentTarget.dataset.id)
    const todo = this.data.todos.find((item) => item.id === id)
    if (!todo) return
    try {
      if (todo.is_pinned) await todoService.unpin(id)
      else await todoService.pin(id)
      wx.showToast({ title: todo.is_pinned ? '已取消置顶' : '已置顶', icon: 'success' })
      this.fetchTodos()
    } catch {
      // handled by request layer
    }
  },

  async toggleUrgent(event) {
    const id = Number(event.currentTarget.dataset.id)
    const todo = this.data.todos.find((item) => item.id === id)
    if (!todo) return
    try {
      if (todo.is_urgent) await todoService.unurgent(id)
      else await todoService.urgent(id)
      wx.showToast({ title: todo.is_urgent ? '已取消加急' : '已加急', icon: 'success' })
      this.fetchTodos()
    } catch {
      // handled by request layer
    }
  },

  deleteTodo(event) {
    const id = Number(event.currentTarget.dataset.id)
    const todo = this.data.todos.find((item) => item.id === id)
    if (!todo) return
    wx.showModal({
      title: '删除待办',
      content: `确定删除「${todo.title}」吗？`,
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await todoService.remove(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.fetchTodos()
        } catch {
          // handled by request layer
        }
      },
    })
  },

  onLongPress(event) {
    const id = Number(event.currentTarget.dataset.id)
    const index = Number(event.currentTarget.dataset.index)
    const todo = this.data.todos[index]
    if (!todo) return
    const groupCount = this.data.todos.filter((item) => item.dragGroupKey === todo.dragGroupKey).length
    if (groupCount < 2) {
      wx.showToast({ title: '同优先级内暂无可拖动项', icon: 'none' })
      return
    }

    wx.vibrateShort({ type: 'light' })
    this.resetSwipe()
    this.setData({
      draggingId: id,
      draggingGroupKey: todo.dragGroupKey,
      dragStartIndex: index,
      dragStartY: event.touches?.[0]?.clientY || 0,
      dragMoved: false,
    })
  },

  onDragMove(event) {
    const draggingId = this.data.draggingId
    if (!draggingId) return
    const touch = event.touches[0]
    const offsetIndex = Math.round((touch.clientY - this.data.dragStartY) / ROW_HEIGHT)
    let targetIndex = this.data.dragStartIndex + offsetIndex
    targetIndex = Math.max(0, Math.min(this.data.todos.length - 1, targetIndex))
    const target = this.data.todos[targetIndex]
    if (!target || target.dragGroupKey !== this.data.draggingGroupKey) return

    const fromIndex = this.data.todos.findIndex((item) => item.id === draggingId)
    if (fromIndex < 0 || fromIndex === targetIndex) return
    const todos = [...this.data.todos]
    const [dragged] = todos.splice(fromIndex, 1)
    todos.splice(targetIndex, 0, dragged)
    this.setData({ todos, dragStartIndex: targetIndex, dragStartY: touch.clientY, dragMoved: true })
  },

  async finishDrag(shouldPersist) {
    const groupKey = this.data.draggingGroupKey
    const moved = this.data.dragMoved
    this.setData({ draggingId: null, draggingGroupKey: '', dragStartIndex: -1, dragMoved: false })
    if (!shouldPersist || !moved) return

    try {
      const groupTodos = this.data.todos.filter((todo) => todo.dragGroupKey === groupKey)
      await Promise.all(groupTodos.map((todo, index) => todoService.update(todo.id, {
        sort_order: groupTodos.length - index,
      })))
      wx.showToast({ title: '排序已更新', icon: 'success' })
      this.fetchTodos()
    } catch {
      // handled by request layer
    }
  },
})
