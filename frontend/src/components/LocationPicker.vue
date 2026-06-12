<template>
  <van-field
    :model-value="displayLocation"
    :label="label"
    is-link
    readonly
    :placeholder="placeholder"
    @click="openPicker"
  />

  <van-popup v-model:show="showPicker" position="bottom" round class="location-popup" @opened="initMap">
    <div class="location-picker">
      <div class="location-picker__header">
        <button class="location-picker__text-btn" type="button" @click="showPicker = false">取消</button>
        <div class="location-picker__title">选择地点</div>
        <button class="location-picker__text-btn location-picker__text-btn--primary" type="button" @click="confirmSelection">
          确定
        </button>
      </div>

      <van-search
        v-model="keyword"
        placeholder="搜索地点、地址或建筑"
        shape="round"
        show-action
        @search="searchPlaces"
        @clear="clearSearch"
      >
        <template #action>
          <button class="location-picker__search-btn" type="button" @click="searchPlaces">搜索</button>
        </template>
      </van-search>

      <div v-if="!amapKey" class="location-picker__config">
        <van-icon name="warning-o" />
        <span>请在 `frontend/.env` 配置 VITE_AMAP_KEY 后使用地图选点。</span>
      </div>

      <div v-else class="location-picker__map-shell">
        <div ref="mapEl" class="location-picker__map"></div>
        <div v-if="mapLoading" class="location-picker__map-state">地图加载中...</div>
      </div>

      <div v-if="selected.name" class="location-picker__selected">
        <van-icon name="location-o" />
        <div>
          <strong>{{ selected.name }}</strong>
          <span v-if="selected.address">{{ selected.address }}</span>
        </div>
      </div>

      <div v-if="searchResults.length" class="location-picker__results">
        <button v-for="poi in searchResults" :key="poi.id || `${poi.name}-${poi.lng}-${poi.lat}`" type="button" @click="selectPoi(poi)">
          <span>{{ poi.name }}</span>
          <small>{{ poi.address || '地址未提供' }}</small>
        </button>
      </div>

      <div class="location-picker__footer">
        <van-button round plain type="primary" :loading="locating" @click="useCurrentLocation">当前位置</van-button>
        <van-button round plain type="success" :disabled="!selected.name" @click="navigateToSelected">导航</van-button>
        <van-button round plain type="default" @click="clearSelection">清除</van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { load } from '@amap/amap-jsapi-loader'
import { openAmapNavigation } from '../utils/amap'

interface PoiOption {
  id?: string
  name: string
  address?: string
  lng: number
  lat: number
}

const props = withDefaults(defineProps<{
  location: string
  lat?: number | null
  lng?: number | null
  label?: string
  placeholder?: string
}>(), {
  label: '地点',
  placeholder: '在地图上选择地点',
})

const emit = defineEmits<{
  'update:location': [value: string]
  'update:lat': [value: number | null]
  'update:lng': [value: number | null]
}>()

const amapKey = (import.meta.env.VITE_AMAP_KEY || '').trim()
const amapSecurityJsCode = (import.meta.env.VITE_AMAP_SECURITY_JS_CODE || '').trim()

const DEFAULT_LOCATION: PoiOption = {
  name: '杭州市',
  address: '浙江省杭州市',
  lng: 120.15515,
  lat: 30.27415,
}

const showPicker = ref(false)
const mapEl = ref<HTMLDivElement | null>(null)
const mapLoading = ref(false)
const locating = ref(false)
const keyword = ref('')
const searchResults = ref<PoiOption[]>([])

const selected = reactive<PoiOption>({
  ...DEFAULT_LOCATION,
})

let AMap: any
let map: any
let marker: any
let geocoder: any
let placeSearch: any
let autoComplete: any
let geolocation: any
let searchRequestId = 0

const displayLocation = computed(() => props.location || '')

function openPicker() {
  selected.name = props.location || DEFAULT_LOCATION.name
  selected.address = props.location ? '' : DEFAULT_LOCATION.address
  selected.lng = props.lng ?? DEFAULT_LOCATION.lng
  selected.lat = props.lat ?? DEFAULT_LOCATION.lat
  keyword.value = props.location || ''
  searchResults.value = []
  showPicker.value = true
}

async function initMap() {
  if (!amapKey) return
  await nextTick()
  if (!mapEl.value) return

  mapLoading.value = true
  try {
    if (!AMap) {
      if (amapSecurityJsCode) {
        window._AMapSecurityConfig = { securityJsCode: amapSecurityJsCode }
      }
      AMap = await load({
        key: amapKey,
        version: '2.0',
        plugins: ['AMap.PlaceSearch', 'AMap.AutoComplete', 'AMap.Geocoder', 'AMap.Geolocation'],
      })
    }

    if (!map) {
      const hasInitialPoint = props.lng != null && props.lat != null
      map = new AMap.Map(mapEl.value, {
        center: [selected.lng, selected.lat],
        zoom: hasInitialPoint ? 16 : 11,
        resizeEnable: true,
      })
      geocoder = new AMap.Geocoder()
      placeSearch = new AMap.PlaceSearch({ city: '全国', pageSize: 10, pageIndex: 1 })
      autoComplete = new AMap.AutoComplete({ city: '全国' })
      geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        position: 'RB',
        offset: [12, 12],
        zoomToAccuracy: true,
      })
      map.addControl(geolocation)
      marker = new AMap.Marker({ position: [selected.lng, selected.lat] })
      map.add(marker)
      map.on('click', (event: any) => {
        const lng = event.lnglat.getLng()
        const lat = event.lnglat.getLat()
        setSelectedPoint(lng, lat)
        reverseGeocode(lng, lat)
      })
    } else {
      const hasInitialPoint = props.lng != null && props.lat != null
      map.setCenter([selected.lng, selected.lat])
      marker.setPosition([selected.lng, selected.lat])
      marker.show()
      map.setZoom(hasInitialPoint ? 16 : 11)
      map.resize()
    }
  } catch (error) {
    console.error(error)
    showToast('高德地图加载失败')
  } finally {
    mapLoading.value = false
  }
}

function searchPlaces() {
  const term = keyword.value.trim()
  if (!term) {
    showToast('请输入搜索关键词')
    return
  }
  if (!placeSearch) {
    showToast('地图尚未加载完成')
    return
  }

  const requestId = ++searchRequestId
  placeSearch.search(term, (status: string, result: any) => {
    if (requestId !== searchRequestId) return

    const pois = normalizePois(result?.poiList?.pois)
    if (status === 'complete' && pois.length) {
      searchResults.value = pois
      return
    }

    if (result?.info === 'TIP_CITIES' && Array.isArray(result.cityList) && result.cityList.length) {
      searchResults.value = []
      searchFromTipCities(term, result.cityList, requestId)
      return
    }

    searchWithAutoComplete(term, requestId, getPlaceSearchErrorMessage(result))
  })
}

async function searchFromTipCities(term: string, cityList: any[], requestId: number) {
  for (const city of cityList.slice(0, 5)) {
    const cityCode = city?.adcode || city?.citycode || city?.name
    if (!cityCode) continue

    const pois = await searchPlacesInCity(term, String(cityCode))
    if (requestId !== searchRequestId) return
    if (pois.length) {
      searchResults.value = pois
      return
    }
  }

  searchWithAutoComplete(term, requestId, '请补充城市名后再搜索')
}

function searchPlacesInCity(term: string, city: string): Promise<PoiOption[]> {
  return new Promise((resolve) => {
    const scopedSearch = new AMap.PlaceSearch({ city, pageSize: 10, pageIndex: 1 })
    scopedSearch.search(term, (status: string, result: any) => {
      if (status !== 'complete') {
        resolve([])
        return
      }
      resolve(normalizePois(result?.poiList?.pois))
    })
  })
}

function searchWithAutoComplete(term: string, requestId: number, fallbackMessage: string) {
  if (!autoComplete) {
    showToast(fallbackMessage)
    return
  }

  autoComplete.search(term, (status: string, result: any) => {
    if (requestId !== searchRequestId) return

    const tips = normalizeTips(result?.tips)
    if (status === 'complete' && tips.length) {
      searchResults.value = tips
      return
    }

    searchResults.value = []
    showToast(fallbackMessage)
  })
}

function getPlaceSearchErrorMessage(result: any) {
  if (result?.info === 'INVALID_USER_SCODE' || result?.infocode === '10008') {
    return '地图搜索鉴权失败，请检查高德安全密钥'
  }
  return result?.info || '未找到相关地点'
}

function normalizePois(pois: unknown): PoiOption[] {
  const results: PoiOption[] = []
  if (!Array.isArray(pois)) return results

  for (const poi of pois) {
    const point = normalizePoint(poi.location)
    if (!point || !poi.name) continue
    results.push({
      id: poi.id,
      name: poi.name,
      address: normalizeAddress(poi.address),
      lng: point.lng,
      lat: point.lat,
    })
  }

  return results
}

function normalizeTips(tips: unknown): PoiOption[] {
  const results: PoiOption[] = []
  if (!Array.isArray(tips)) return results

  for (const tip of tips) {
    const point = normalizePoint(tip.location)
    if (!point || !tip.name) continue
    results.push({
      id: tip.id,
      name: tip.name,
      address: normalizeAddress(tip.district || tip.address),
      lng: point.lng,
      lat: point.lat,
    })
  }

  return results
}

function normalizePoint(location: any): { lng: number; lat: number } | null {
  if (!location) return null

  const stringParts = typeof location === 'string' ? location.split(',') : []
  const lng = Number(location.lng ?? location.getLng?.() ?? location[0] ?? stringParts[0])
  const lat = Number(location.lat ?? location.getLat?.() ?? location[1] ?? stringParts[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null
  }
  return { lng, lat }
}

function selectPoi(poi: PoiOption) {
  selected.name = poi.name
  selected.address = poi.address || ''
  selected.lng = poi.lng
  selected.lat = poi.lat
  keyword.value = poi.name
  searchResults.value = []
  setSelectedPoint(poi.lng, poi.lat)
}

function setSelectedPoint(lng: number, lat: number) {
  selected.lng = lng
  selected.lat = lat
  selected.name ||= '地图选点'
  marker?.setPosition([lng, lat])
  marker?.show()
  map?.setZoomAndCenter(16, [lng, lat])
}

function reverseGeocode(lng: number, lat: number) {
  if (!geocoder) return
  geocoder.getAddress([lng, lat], (status: string, result: any) => {
    if (status !== 'complete' || !result?.regeocode) return
    selected.name = result.regeocode.formattedAddress || '地图选点'
    selected.address = result.regeocode.addressComponent?.district || ''
    keyword.value = selected.name
  })
}

function useCurrentLocation() {
  if (!geolocation) {
    showToast('地图尚未加载完成')
    return
  }

  locating.value = true
  geolocation.getCurrentPosition((status: string, result: any) => {
    locating.value = false
    if (status !== 'complete' || !result?.position) {
      showToast(result?.message || '定位失败，请检查浏览器定位权限')
      return
    }

    const lng = Number(result.position.lng ?? result.position.getLng?.())
    const lat = Number(result.position.lat ?? result.position.getLat?.())
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      showToast('定位结果无效')
      return
    }

    selected.name = result.formattedAddress || '当前位置'
    selected.address = result.formattedAddress ? '' : '当前位置'
    keyword.value = selected.name
    searchResults.value = []
    setSelectedPoint(lng, lat)
    reverseGeocode(lng, lat)
  })
}

function navigateToSelected() {
  if (!selected.name) {
    showToast('请先选择地点')
    return
  }
  openAmapNavigation(selected)
}

function confirmSelection() {
  if (!selected.name) {
    showToast('请先选择地点')
    return
  }

  emit('update:location', selected.name)
  emit('update:lng', selected.lng)
  emit('update:lat', selected.lat)
  showPicker.value = false
}

function clearSelection() {
  selected.name = ''
  selected.address = ''
  searchResults.value = []
  keyword.value = ''
  marker?.hide()
  emit('update:location', '')
  emit('update:lng', null)
  emit('update:lat', null)
  showPicker.value = false
}

function clearSearch() {
  searchResults.value = []
}

function normalizeAddress(address: unknown) {
  if (Array.isArray(address)) return address.join('')
  return typeof address === 'string' ? address : ''
}

onBeforeUnmount(() => {
  map?.destroy()
})
</script>

<style scoped>
.location-popup {
  height: min(86vh, 720px);
}

.location-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
  text-align: left;
}

.location-picker__header {
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
  min-height: 48px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.location-picker__title {
  color: #1f2329;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.location-picker__text-btn,
.location-picker__search-btn {
  border: 0;
  background: transparent;
  color: #6b7280;
  font: inherit;
}

.location-picker__text-btn {
  padding: 8px 0;
}

.location-picker__text-btn--primary,
.location-picker__search-btn {
  color: #1677ff;
}

.location-picker__config {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 16px;
  padding: 14px;
  color: #7a4b00;
  background: #fff7e6;
  border: 1px solid #ffe1a3;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.location-picker__map-shell {
  position: relative;
  flex: 1;
  min-height: 280px;
  margin: 0 12px;
  overflow: hidden;
  background: #e9edf3;
  border-radius: 8px;
}

.location-picker__map {
  width: 100%;
  height: 100%;
}

.location-picker__map-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.72);
  font-size: 14px;
}

.location-picker__selected {
  display: flex;
  gap: 8px;
  margin: 12px 12px 0;
  padding: 12px;
  color: #1f2329;
  background: #fff;
  border-radius: 8px;
}

.location-picker__selected strong,
.location-picker__selected span {
  display: block;
}

.location-picker__selected strong {
  font-size: 15px;
  line-height: 1.35;
}

.location-picker__selected span {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.location-picker__results {
  max-height: 190px;
  margin: 12px 12px 0;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
}

.location-picker__results button {
  width: 100%;
  padding: 12px;
  border: 0;
  background: #fff;
  text-align: left;
}

.location-picker__results button + button {
  border-top: 1px solid #eef0f4;
}

.location-picker__results span,
.location-picker__results small {
  display: block;
}

.location-picker__results span {
  color: #1f2329;
  font-size: 14px;
}

.location-picker__results small {
  margin-top: 3px;
  color: #8a919f;
  font-size: 12px;
}

.location-picker__footer {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 12px 16px 18px;
}
</style>
