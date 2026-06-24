const ICON_OPTIONS = [
  { text: '吃喝', value: 'utensils', glyph: '🍜' },
  { text: '玩乐', value: 'gamepad-2', glyph: '🎮' },
  { text: '骑行', value: 'bike', glyph: '🚲' },
  { text: '开车', value: 'car', glyph: '🚗' },
  { text: '出游', value: 'map', glyph: '🗺️' },
  { text: '露营', value: 'tent-tree', glyph: '⛺' },
  { text: '其他', value: 'sparkles', glyph: '✨' },
]

function getIconOption(value) {
  return ICON_OPTIONS.find((item) => item.value === value) || ICON_OPTIONS[ICON_OPTIONS.length - 1]
}

module.exports = {
  ICON_OPTIONS,
  getIconOption,
}
