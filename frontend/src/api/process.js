import request from '@/utils/request'

/**
 * 获取工序配置历史记录
 * @param {number} id - 包装配置ID
 * @param {Object} params - 查询参数
 */
export function getProcessConfigHistory(id, params = {}) {
  return request.get(`/processes/packaging-configs/${id}/history`, { params })
}

/**
 * 获取最新历史记录
 * @param {number} id - 包装配置ID
 */
export function getLatestProcessConfigHistory(id) {
  return request.get(`/processes/packaging-configs/${id}/history/latest`)
}
