function chooseLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success(res) {
        resolve({
          name: res.name || res.address || '',
          lat: typeof res.latitude === 'number' ? res.latitude : null,
          lng: typeof res.longitude === 'number' ? res.longitude : null,
        })
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

function openLocation(location) {
  if (!location || location.lat == null || location.lng == null) {
    wx.showToast({ title: '该地点缺少经纬度', icon: 'none' })
    return
  }

  wx.openLocation({
    latitude: Number(location.lat),
    longitude: Number(location.lng),
    name: location.name || '目的地',
    address: location.name || '',
    scale: 16,
  })
}

module.exports = {
  chooseLocation,
  openLocation,
}
