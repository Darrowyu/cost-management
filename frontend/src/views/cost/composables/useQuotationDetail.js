import { ref, computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import logger from '@/utils/logger'
import { useConfigStore } from '@/store/config'
import { useAuthStore } from '@/store/auth'

export function useQuotationDetail(quotationId) {
    const router = useRouter()
    const configStore = useConfigStore()

    const loading = ref(false)
    const settingStandardCost = ref(false)
    const exporting = ref(false)

    const quotation = ref({})
    const items = ref({
        material: { items: [], total: 0 },
        process: { items: [], total: 0 },
        packaging: { items: [], total: 0 }
    })
    const calculation = ref(null)
    const customProfitTiers = ref([])

    // Shipping Info
    const shippingInfo = reactive({
        cartons: null,
        cbm: null
    })

    // Permissions
    const authStore = useAuthStore()
    const isAdminOrReviewer = computed(() => {
        return authStore.hasAnyPermission(['cost:manage', 'cost:edit', 'review:approve'])
    })
    const canEdit = computed(() => {
        const canEditStatus = quotation.value.status === 'draft' || quotation.value.status === 'rejected'
        return canEditStatus && authStore.hasPermission('cost:edit')
    })

    // Fetch Data
    const loadDetail = async () => {
        if (!quotationId) return
        loading.value = true
        try {
            const res = await request.get(`/cost/quotations/${quotationId}`)
            if (res.success) {
                quotation.value = res.data.quotation
                items.value = res.data.items
                calculation.value = res.data.calculation

                if (quotation.value.custom_profit_tiers) {
                    try {
                        customProfitTiers.value = JSON.parse(quotation.value.custom_profit_tiers)
                    } catch (e) {
                        customProfitTiers.value = []
                    }
                }
                calculateShippingInfo()
            }
        } catch (error) {
            logger.error('加载详情失败:', error)
            ElMessage.error('加载详情失败')
        } finally {
            loading.value = false
        }
    }

    // Calculate Shipping
    const calculateShippingInfo = () => {
        shippingInfo.cartons = null
        shippingInfo.cbm = null

        if (!quotation.value.quantity || quotation.value.quantity <= 0) return
        if (!quotation.value.pc_per_bag || !quotation.value.bags_per_box || !quotation.value.boxes_per_carton) return

        const pcsPerCarton = quotation.value.pc_per_bag * quotation.value.bags_per_box * quotation.value.boxes_per_carton
        if (!pcsPerCarton) return

        const cartons = Math.ceil(quotation.value.quantity / pcsPerCarton)
        shippingInfo.cartons = cartons

        const cartonMaterial = items.value.packaging.items.find(item => item.carton_volume && parseFloat(item.carton_volume) > 0)
        if (cartonMaterial && parseFloat(cartonMaterial.carton_volume) > 0) {
            const totalVolume = parseFloat(cartonMaterial.carton_volume) * cartons
            shippingInfo.cbm = (totalVolume / 35.32).toFixed(1)
        }
    }

    // Actions
    const setAsStandardCost = async () => {
        if (!quotation.value.packaging_config_id) {
            ElMessage.warning('该报价单没有关联包装配置，无法设为标准成本')
            return
        }

        try {
            await ElMessageBox.confirm(
                '确定要将此报价单设为标准成本吗？如果该包装配置已有标准成本，将创建新版本。',
                '设为标准成本',
                { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
            )

            settingStandardCost.value = true
            const res = await request.post('/standard-costs', { quotation_id: quotation.value.id })
            if (res.success) {
                ElMessage.success('已成功设为标准成本')
            }
        } catch (error) {
            if (error !== 'cancel') {
                logger.error('设为标准成本失败:', error)
                ElMessage.error(error.response?.data?.message || '设为标准成本失败')
            }
        } finally {
            settingStandardCost.value = false
        }
    }

    const handleExport = async () => {
        exporting.value = true
        try {
            const res = await request.post(
                `/cost/quotations/${quotation.value.id}/export`,
                {},
                { responseType: 'blob' }
            )

            const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const link = document.createElement('a')
            link.href = window.URL.createObjectURL(blob)
            link.download = `Quot_${quotation.value.quotation_no}.xlsx`
            link.click()
            window.URL.revokeObjectURL(link.href)

            ElMessage.success('导出成功')
        } catch (error) {
            logger.error('导出失败:', error)
            ElMessage.error('导出失败')
        } finally {
            exporting.value = false
        }
    }

    return {
        loading,
        quotation,
        items,
        calculation,
        customProfitTiers,
        shippingInfo,
        isAdminOrReviewer,
        canEdit,
        settingStandardCost,
        exporting,
        loadDetail,
        setAsStandardCost,
        handleExport,
        configStore
    }
}
