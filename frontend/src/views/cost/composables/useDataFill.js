/**
 * 报价单数据填充逻辑
 * 处理编辑/复制报价单和标准成本时的数据回填
 * 拆分自 CostAdd.vue，代码完整无修改
 */

import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 创建数据填充 composable
 * @param {Object} deps - 依赖项
 */
export function useDataFill(deps) {
    const {
        form,
        packagingConfigs,
        currentModelCategory,
        materialCoefficient,
        materialCoefficientsCache,
        currentFactory,
        customProfitTiers,
        shippingInfo,
        quantityUnit,
        quantityInput,
        allMaterials,
        configStore,
        setShippingInfoFromConfig,
        calculateShippingInfo,
        handleCalculateCost
    } = deps

    /**
     * 填充报价单数据（编辑/复制模式）
     */
    const fillQuotationData = async (data, isCopy = false) => {
        const { quotation, items, customFees: fees } = data
        form.regulation_id = quotation.regulation_id
        form.packaging_config_id = quotation.packaging_config_id || null
        if (form.packaging_config_id) {
            const config = packagingConfigs.value.find(c => c.id === form.packaging_config_id)
            if (config) currentFactory.value = config.factory || 'dongguan_xunan'
        }
        form.model_id = quotation.model_id
        form.customer_name = isCopy ? `${quotation.customer_name}（复制）` : quotation.customer_name
        form.customer_region = quotation.customer_region
        form.sales_type = quotation.sales_type
        form.shipping_method = quotation.shipping_method || ''
        // 判断港口类型：port 为空/null 表示 FOB 深圳，有值表示其他港口
        form.port_type = quotation.port ? 'other' : 'fob_shenzhen'
        form.port = quotation.port || ''
        form.quantity = quotation.quantity ? parseInt(quotation.quantity) : null
        form.freight_total = quotation.freight_total ? parseFloat(quotation.freight_total) : null
        form.include_freight_in_base = quotation.include_freight_in_base !== false
        form.vat_rate = quotation.vat_rate !== null ? parseFloat(quotation.vat_rate) : (configStore.config.vat_rate || 0.13)
        form.materials = items.material.items.map(item => ({
            category: 'material',
            material_id: item.material_id || null,
            item_name: item.item_name,
            usage_amount: parseFloat(item.usage_amount) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
            is_changed: item.is_changed || 0,
            from_standard: true,
            after_overhead: item.after_overhead || false,
            coefficient_applied: true
        }))
        form.processes = items.process.items.map(item => ({
            category: 'process',
            item_name: item.item_name,
            usage_amount: parseFloat(item.usage_amount) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
            is_changed: item.is_changed || 0,
            from_standard: true
        }))
        form.packaging = items.packaging.items.map(item => ({
            category: 'packaging',
            material_id: item.material_id || null,
            item_name: item.item_name,
            usage_amount: parseFloat(item.usage_amount) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            carton_volume: item.carton_volume ? parseFloat(item.carton_volume) : null,
            subtotal: parseFloat(item.subtotal) || 0,
            is_changed: 0,
            from_standard: true
        }))
        form.materials.forEach(m => {
            if (!m.material_id) {
                const found = allMaterials.value.find(mat => mat.name === m.item_name)
                if (found) m.material_id = found.id
            }
        })
        form.packaging.forEach(p => {
            if (!p.material_id) {
                const found = allMaterials.value.find(mat => mat.name === p.item_name)
                if (found) p.material_id = found.id
            }
        })
        if (quotation.pc_per_bag && quotation.bags_per_box && quotation.boxes_per_carton) {
            const pcsPerCarton = quotation.pc_per_bag * quotation.bags_per_box * quotation.boxes_per_carton
            const cartonMaterial = items.packaging.items.find(item => item.carton_volume && item.carton_volume > 0)
            setShippingInfoFromConfig(pcsPerCarton, cartonMaterial?.carton_volume || null)
            quantityInput.value = form.quantity
            quantityUnit.value = 'pcs'
            calculateShippingInfo(form, handleCalculateCost)
        }
        if (!quantityInput.value && form.quantity) {
            quantityInput.value = form.quantity
            quantityUnit.value = 'pcs'
        }
        if (quotation.custom_profit_tiers) {
            try {
                const parsed = JSON.parse(quotation.custom_profit_tiers)
                customProfitTiers.value = parsed.map(t => ({
                    profitRate: t.profitRate,
                    profitPercentage: t.profitPercentage,
                    price: t.price,
                    sortKey: t.profitRate ? parseFloat(t.profitRate) : 9999
                }))
            }
            catch (e) { customProfitTiers.value = [] }
        }
        if (fees?.length > 0) {
            form.customFees = fees.map((fee, i) => ({
                name: fee.name,
                rate: fee.rate,
                sortOrder: fee.sortOrder ?? i
            }))
        }
        else form.customFees = []
        handleCalculateCost()
        ElMessage.success(isCopy ? '报价单数据已复制，请修改后保存' : '报价单数据已加载')
    }

    /**
     * 填充标准成本数据（从标准成本复制）
     */
    const fillStandardCostData = async (data) => {
        const { standardCost, items } = data
        if (standardCost.model_category) {
            currentModelCategory.value = standardCost.model_category
            if (materialCoefficientsCache.value[standardCost.model_category]) {
                materialCoefficient.value = materialCoefficientsCache.value[standardCost.model_category]
            }
        }
        form.regulation_id = standardCost.regulation_id || null
        await nextTick()
        form.packaging_config_id = standardCost.packaging_config_id || null
        if (form.packaging_config_id) {
            const config = packagingConfigs.value.find(c => c.id === form.packaging_config_id)
            if (config) currentFactory.value = config.factory || 'dongguan_xunan'
        }
        form.model_id = standardCost.model_id || null
        form.customer_name = ''
        form.customer_region = ''
        form.sales_type = standardCost.sales_type
        form.shipping_method = ''
        form.port_type = 'fob_shenzhen'
        form.port = ''
        form.quantity = standardCost.quantity
        form.freight_total = 0
        form.include_freight_in_base = true
        form.vat_rate = configStore.config.vat_rate || 0.13
        if (standardCost.pc_per_bag && standardCost.bags_per_box && standardCost.boxes_per_carton) {
            const pcsPerCarton = standardCost.pc_per_bag * standardCost.bags_per_box * standardCost.boxes_per_carton
            setShippingInfoFromConfig(pcsPerCarton, null)
            quantityInput.value = standardCost.quantity
            quantityUnit.value = 'pcs'
        }
        if (items?.material) {
            form.materials = items.material.items.map(item => ({
                category: 'material',
                material_id: item.material_id || null,
                item_name: item.item_name,
                usage_amount: parseFloat(item.usage_amount) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                subtotal: parseFloat(item.subtotal) || 0,
                is_changed: 0,
                from_standard: true,
                after_overhead: item.after_overhead || false,
                coefficient_applied: true
            }))
        }
        if (items?.process) {
            form.processes = items.process.items.map(item => ({
                category: 'process',
                item_name: item.item_name,
                usage_amount: parseFloat(item.usage_amount) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                subtotal: parseFloat(item.subtotal) || 0,
                is_changed: 0,
                from_standard: true
            }))
        }
        if (items?.packaging) {
            form.packaging = items.packaging.items.map(item => ({
                category: 'packaging',
                material_id: item.material_id || null,
                item_name: item.item_name,
                usage_amount: parseFloat(item.usage_amount) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                carton_volume: item.carton_volume ? parseFloat(item.carton_volume) : null,
                subtotal: parseFloat(item.subtotal) || 0,
                is_changed: 0,
                from_standard: true
            }))
            const cartonMaterial = items.packaging.items.find(item => item.carton_volume && item.carton_volume > 0)
            if (cartonMaterial) shippingInfo.cartonVolume = cartonMaterial.carton_volume
        }
        form.materials.forEach(m => {
            if (!m.material_id) {
                const found = allMaterials.value.find(mat => mat.name === m.item_name)
                if (found) m.material_id = found.id
            }
        })
        form.packaging.forEach(p => {
            if (!p.material_id) {
                const found = allMaterials.value.find(mat => mat.name === p.item_name)
                if (found) p.material_id = found.id
            }
        })
        if (form.quantity && shippingInfo.pcsPerCarton) calculateShippingInfo(form, handleCalculateCost)
        handleCalculateCost()
        ElMessage.success('标准成本数据已复制，请填写客户信息后保存')
    }

    return {
        fillQuotationData,
        fillStandardCostData
    }
}
