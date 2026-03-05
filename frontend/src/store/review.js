/**
 * 审核状态管理
 */
import { defineStore } from 'pinia'
import request from '@/utils/request'
import logger from '@/utils/logger'

export const useReviewStore = defineStore('review', {
  state: () => ({
    // 待审核列表
    pendingList: [],
    pendingPagination: {
      page: 1,
      pageSize: 20,
      total: 0
    },
    pendingSearchParams: {
      customer_name: '',
      model_name: '',
      date_range: []
    },
    
    // 已审核列表
    approvedList: [],
    approvedPagination: {
      page: 1,
      pageSize: 20,
      total: 0
    },
    approvedSearchParams: {
      status: '', // 'approved' | 'rejected' | ''
      customer_name: '',
      model_name: '',
      date_range: []
    },
    
    // 当前审核详情
    currentDetail: null,
    
    // 加载状态
    loading: false
  }),

  getters: {
    // 待审核数量
    pendingCount: (state) => state.pendingPagination.total,
    
    // 已审核数量
    approvedCount: (state) => state.approvedPagination.total
  },

  actions: {
    /**
     * 获取待审核列表
     */
    async fetchPendingList(params = {}) {
      this.loading = true
      try {
        const queryParams = {
          page: params.page || this.pendingPagination.page,
          page_size: params.page_size || params.pageSize || this.pendingPagination.pageSize,
          keyword: params.keyword // 新增：关键词搜索
        }

        // 添加日期范围
        const dateRange = params.date_range || this.pendingSearchParams.date_range
        if (dateRange && dateRange.length === 2) {
          queryParams.start_date = dateRange[0]
          queryParams.end_date = dateRange[1]
        }

        const response = await request.get('/review/pending', { params: queryParams })
        
        if (response.success) {
          this.pendingList = response.data
          this.pendingPagination = {
            page: response.page,
            pageSize: response.pageSize,
            total: response.total
          }
        }
        
        return response
      } catch (error) {
        logger.error('获取待审核列表失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 获取已审核列表
     */
    async fetchApprovedList(params = {}) {
      this.loading = true
      try {
        const queryParams = {
          page: params.page || this.approvedPagination.page,
          page_size: params.page_size || params.pageSize || this.approvedPagination.pageSize,
          status: params.status ?? this.approvedSearchParams.status,
          keyword: params.keyword // 新增：关键词搜索
        }

        // 添加日期范围
        const dateRange = params.date_range || this.approvedSearchParams.date_range
        if (dateRange && dateRange.length === 2) {
          queryParams.start_date = dateRange[0]
          queryParams.end_date = dateRange[1]
        }

        const response = await request.get('/review/approved', { params: queryParams })
        
        if (response.success) {
          this.approvedList = response.data
          this.approvedPagination = {
            page: response.page,
            pageSize: response.pageSize,
            total: response.total
          }
        }
        
        return response
      } catch (error) {
        logger.error('获取已审核列表失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 获取审核详情
     */
    async fetchReviewDetail(id) {
      this.loading = true
      try {
        const response = await request.get(`/review/${id}/detail`)
        
        if (response.success) {
          this.currentDetail = response.data
        }
        
        return response
      } catch (error) {
        logger.error('获取审核详情失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 审核通过
     */
    async approveQuotation(id, comment = '') {
      this.loading = true
      try {
        const response = await request.post(`/review/${id}/approve`, { comment })
        
        if (response.success) {
          // 刷新列表
          await this.fetchPendingList()
        }
        
        return response
      } catch (error) {
        logger.error('审核通过失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 审核退回
     */
    async rejectQuotation(id, reason) {
      this.loading = true
      try {
        const response = await request.post(`/review/${id}/reject`, { reason })
        
        if (response.success) {
          // 刷新列表
          await this.fetchPendingList()
        }
        
        return response
      } catch (error) {
        logger.error('审核退回失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 重新提交
     */
    async resubmitQuotation(id) {
      this.loading = true
      try {
        const response = await request.post(`/review/${id}/resubmit`)
        return response
      } catch (error) {
        logger.error('重新提交失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 删除成本分析（仅管理员）
     */
    async deleteQuotation(id) {
      this.loading = true
      try {
        const response = await request.delete(`/review/${id}`)

        if (response.success) {
          // 从列表中移除
          this.pendingList = this.pendingList.filter(q => q.id !== id)
          this.approvedList = this.approvedList.filter(q => q.id !== id)
        }

        return response
      } catch (error) {
        logger.error('删除成本分析失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 更新待审核搜索条件
     */
    updatePendingSearchParams(params) {
      this.pendingSearchParams = { ...this.pendingSearchParams, ...params }
    },

    /**
     * 重置待审核搜索条件
     */
    resetPendingSearchParams() {
      this.pendingSearchParams = {
        customer_name: '',
        model_name: '',
        date_range: []
      }
      this.pendingPagination.page = 1
    },

    /**
     * 更新已审核搜索条件
     */
    updateApprovedSearchParams(params) {
      this.approvedSearchParams = { ...this.approvedSearchParams, ...params }
    },

    /**
     * 重置已审核搜索条件
     */
    resetApprovedSearchParams() {
      this.approvedSearchParams = {
        status: '',
        customer_name: '',
        model_name: '',
        date_range: []
      }
      this.approvedPagination.page = 1
    },

    /**
     * 清空当前详情
     */
    clearCurrentDetail() {
      this.currentDetail = null
    },

    /**
     * 获取待审核数量（用于侧边栏气泡显示）
     */
    async fetchPendingCount() {
      try {
        const response = await request.get('/review/pending', { params: { page: 1, page_size: 1 } })
        if (response.success) {
          this.pendingPagination.total = response.total
        }
        return response.total || 0
      } catch (error) {
        // 忽略请求取消错误（组件卸载时正常发生）
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
          return 0
        }
        logger.error('获取待审核数量失败:', error)
        return 0
      }
    }
  }
})
