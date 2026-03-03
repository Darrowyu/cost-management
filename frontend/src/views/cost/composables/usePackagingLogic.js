import { computed } from 'vue'
import { getPackagingTypeName, formatPackagingMethodFromConfig, calculateTotalFromConfig, PACKAGING_TYPES } from '@/config/packagingTypes'
import logger from '@/utils/logger'
import { ElMessage } from 'element-plus'

export function usePackagingLogic({ form, packagingConfigs, currentModelCategory, materialCoefficientsCache, materialCoefficient, loadMaterialCoefficients, loadPackagingConfigDetails, currentFactory, loadBomMaterials, editMode, setShippingInfoFromConfig, quantityInput, quantityUnit, calculateShippingInfo, handleCalculateCost }) {

    const selectedConfigInfo = computed(() => {
        if (!form.packaging_config_id || !packagingConfigs.value.length) return ''
        const config = packagingConfigs.value.find(c => c.id === form.packaging_config_id)
        return config ? `${config.model_name} - ${config.config_name}` : ''
    })

    const selectedConfigMethod = computed(() => {
        if (!form.packaging_config_id || !packagingConfigs.value.length) return ''
        const config = packagingConfigs.value.find(c => c.id === form.packaging_config_id)
        return config ? formatPackagingMethodFromConfig(config) : ''
    })

    const filteredPackagingConfigs = computed(() => {
        if (!form.regulation_id) return []
        let filtered = packagingConfigs.value.filter(c => c.regulation_id === form.regulation_id)
        if (currentModelCategory.value) filtered = filtered.filter(c => c.model_category === currentModelCategory.value)
        return filtered
    })

    const groupedPackagingConfigs = computed(() => {
        const configs = filteredPackagingConfigs.value
        if (!configs.length) return []
        const groups = {}
        for (const config of configs) {
            const type = config.packaging_type || 'standard_box'
            if (!groups[type]) groups[type] = { type, typeName: getPackagingTypeName(type) || '标准彩盒', configs: [] }
            groups[type].configs.push(config)
        }
        const orderedTypes = Object.keys(PACKAGING_TYPES)
        return orderedTypes.filter(type => groups[type]?.configs.length > 0).map(type => groups[type])
    })

    const onPackagingConfigChange = async () => {
        if (!form.packaging_config_id) return
        try {
            const data = await loadPackagingConfigDetails(form.packaging_config_id)
            if (!data) return
            const { config, processes, materials } = data
            form.model_id = config.model_id

            // Set factory for CIF Shenzhen calculation
            if (currentFactory) currentFactory.value = config.factory || 'dongguan_xunan'

            const selectedConfig = packagingConfigs.value.find(c => c.id === form.packaging_config_id)
            if (selectedConfig?.model_category) {
                currentModelCategory.value = selectedConfig.model_category
                if (Object.keys(materialCoefficientsCache.value).length === 0 && loadMaterialCoefficients) await loadMaterialCoefficients(currentModelCategory.value)
                else if (materialCoefficientsCache.value[selectedConfig.model_category]) materialCoefficient.value = materialCoefficientsCache.value[selectedConfig.model_category]
            }

            const pcsPerCarton = calculateTotalFromConfig(config)
            const cartonMaterial = materials.find(m => m.carton_volume && parseFloat(m.carton_volume) > 0)

            if (setShippingInfoFromConfig) setShippingInfoFromConfig(pcsPerCarton, cartonMaterial ? parseFloat(cartonMaterial.carton_volume) : null)

            if (!cartonMaterial) {
                ElMessage.warning({ message: '当前配置缺少外箱材积数据，无法自动计算CBM和运费。请前往「包材管理」补充外箱的材积信息', duration: 8000, showClose: true })
            }

            if (form.quantity) quantityInput.value = quantityUnit.value === 'carton' ? Math.ceil(form.quantity / pcsPerCarton) : form.quantity

            if (loadBomMaterials) form.materials = await loadBomMaterials(config.model_id, materialCoefficient.value, currentModelCategory.value)

            editMode.materials = false
            form.processes = (processes || []).map(p => ({ category: 'process', item_name: p.process_name, usage_amount: 1, unit_price: parseFloat(p.unit_price) || 0, subtotal: parseFloat(p.unit_price) || 0, is_changed: 0, from_standard: true }))
            form.packaging = (materials || []).map(m => ({ category: 'packaging', item_name: m.material_name, usage_amount: parseFloat(m.basic_usage) || 0, unit_price: parseFloat(m.unit_price) || 0, carton_volume: m.carton_volume ? parseFloat(m.carton_volume) : null, subtotal: (parseFloat(m.basic_usage) || 0) !== 0 ? (parseFloat(m.unit_price) || 0) / (parseFloat(m.basic_usage) || 1) : 0, is_changed: 0, from_standard: true }))

            editMode.processes = false
            editMode.packaging = false

            if (calculateShippingInfo) calculateShippingInfo(form, handleCalculateCost)
            if (handleCalculateCost) handleCalculateCost()

            if (form.processes.length > 0 || form.packaging.length > 0) ElMessage.success(`已加载 ${config.config_name}：${form.processes.length} 个工序和 ${form.packaging.length} 个包材`)
            else ElMessage.warning('该配置暂无绑定的工序和包材数据')

        } catch (error) {
            logger.error('加载包装配置数据失败:', error)
            ElMessage.error('加载包装配置数据失败')
        }
    }

    return {
        selectedConfigInfo,
        selectedConfigMethod,
        filteredPackagingConfigs,
        groupedPackagingConfigs,
        formatPackagingMethodFromConfig,
        onPackagingConfigChange
    }
}
