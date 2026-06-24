const todoService = require('../../services/todo')
const categoryService = require('../../services/category')
const { requireAuth } = require('../../utils/auth')
const { todayDateValue, formatDate } = require('../../utils/time')
const { chooseLocation } = require('../../utils/location')

const priorityOptions = [
  { text: '无', value: 0 },
  { text: '普通', value: 1 },
  { text: '重要', value: 2 },
  { text: '紧急', value: 3 },
]

function emptyLocation() {
  return { name: '', lat: null, lng: null }
}

Page({
  data: {
    id: null,
    isEdit: false,
    saving: false,
    categories: [],
    categoryIndex: 0,
    categoryLabel: '',
    priorityOptions,
    priorityLabel: '无',
    minDate: todayDateValue(),
    dateValue: todayDateValue(),
    dateLabel: '',
    form: {
      title: '',
      content: '',
      category_id: null,
      priority: 0,
      due_at: '',
      is_urgent: false,
      is_pinned: false,
    },
    locations: [emptyLocation()],
  },

  onLoad(options) {
    if (!requireAuth()) return
    const id = options.id ? Number(options.id) : null
    this.setData({ id, isEdit: Boolean(id) })
    wx.setNavigationBarTitle({ title: id ? '编辑待办' : '新建待办' })
    this.bootstrap()
  },

  async bootstrap() {
    await this.fetchCategories()
    if (this.data.id) {
      await this.fetchTodo()
    }
    this.refreshComputedLabels()
  },

  async fetchCategories() {
    try {
      const categories = await categoryService.list()
      let categoryIndex = categories.findIndex((item) => item.name === '其他')
      if (categoryIndex < 0) categoryIndex = 0
      this.setData({
        categories,
        categoryIndex,
        'form.category_id': categories[categoryIndex]?.id || null,
      })
    } catch {
      // handled by request layer
    }
  },

  async fetchTodo() {
    try {
      const todo = await todoService.get(this.data.id)
      const categoryIndex = Math.max(0, this.data.categories.findIndex((item) => item.id === todo.category_id))
      const locations = this.getTodoLocations(todo)
      this.setData({
        categoryIndex,
        form: {
          title: todo.title,
          content: todo.content || '',
          category_id: todo.category_id,
          priority: todo.priority || 0,
          due_at: todo.due_at || '',
          is_urgent: Boolean(todo.is_urgent),
          is_pinned: Boolean(todo.is_pinned),
        },
        dateValue: todo.due_at ? formatDate(todo.due_at) : todayDateValue(),
        locations,
      })
    } catch {
      wx.showToast({ title: '待办不存在', icon: 'none' })
      wx.navigateBack()
    }
  },

  getTodoLocations(todo) {
    if (Array.isArray(todo.locations) && todo.locations.length) {
      return todo.locations.slice(0, 5).map((item) => ({
        name: item.name || '',
        lat: item.lat == null ? null : item.lat,
        lng: item.lng == null ? null : item.lng,
      }))
    }
    if (todo.location) {
      return [{ name: todo.location, lat: todo.location_lat, lng: todo.location_lng }]
    }
    return [emptyLocation()]
  },

  refreshComputedLabels() {
    const category = this.data.categories[this.data.categoryIndex]
    const priority = priorityOptions.find((item) => item.value === this.data.form.priority) || priorityOptions[0]
    this.setData({
      categoryLabel: category?.name || '',
      priorityLabel: priority.text,
      dateLabel: this.data.form.due_at ? formatDate(this.data.form.due_at) : '',
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: event.detail.value })
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value)
    const category = this.data.categories[index]
    this.setData({ categoryIndex: index, 'form.category_id': category?.id || null }, () => this.refreshComputedLabels())
  },

  onPriorityChange(event) {
    const index = Number(event.detail.value)
    const priority = priorityOptions[index]?.value || 0
    this.setData({ 'form.priority': priority }, () => this.refreshComputedLabels())
  },

  onDateChange(event) {
    const value = event.detail.value
    this.setData({ dateValue: value, 'form.due_at': `${value} 23:59:59` }, () => this.refreshComputedLabels())
  },

  onUrgentChange(event) {
    this.setData({ 'form.is_urgent': event.detail.value })
  },

  onPinnedChange(event) {
    this.setData({ 'form.is_pinned': event.detail.value })
  },

  addLocation() {
    if (this.data.locations.length >= 5) return
    this.setData({ locations: [...this.data.locations, emptyLocation()] })
  },

  removeLocation(event) {
    const index = Number(event.currentTarget.dataset.index)
    const locations = this.data.locations.filter((_, itemIndex) => itemIndex !== index)
    this.setData({ locations: locations.length ? locations : [emptyLocation()] })
  },

  async chooseLocation(event) {
    const index = Number(event.currentTarget.dataset.index)
    try {
      const location = await chooseLocation()
      const locations = [...this.data.locations]
      locations[index] = location
      this.setData({ locations })
    } catch {
      // user cancelled or no permission
    }
  },

  selectedLocations() {
    return this.data.locations
      .map((location) => ({
        name: String(location.name || '').trim(),
        lat: location.lat == null ? null : Number(location.lat),
        lng: location.lng == null ? null : Number(location.lng),
      }))
      .filter((location) => location.name)
      .slice(0, 5)
  },

  async handleSave() {
    const title = this.data.form.title.trim()
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }

    const locations = this.selectedLocations()
    const primaryLocation = locations[0]
    const payload = {
      title,
      content: this.data.form.content || '',
      category_id: this.data.form.category_id,
      priority: this.data.form.priority,
      due_at: this.data.form.due_at || undefined,
      location: primaryLocation?.name,
      location_lat: primaryLocation?.lat ?? null,
      location_lng: primaryLocation?.lng ?? null,
      locations,
      is_urgent: this.data.form.is_urgent ? 1 : 0,
      is_pinned: this.data.form.is_pinned ? 1 : 0,
    }

    this.setData({ saving: true })
    try {
      if (this.data.isEdit) {
        await todoService.update(this.data.id, payload)
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        await todoService.create(payload)
        wx.showToast({ title: '已创建', icon: 'success' })
      }
      wx.navigateBack()
    } catch {
      // handled by request layer
    } finally {
      this.setData({ saving: false })
    }
  },

  handleDelete() {
    wx.showModal({
      title: '删除待办',
      content: '删除后无法恢复，确定删除吗？',
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await todoService.remove(this.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          wx.navigateBack()
        } catch {
          // handled by request layer
        }
      },
    })
  },
})
