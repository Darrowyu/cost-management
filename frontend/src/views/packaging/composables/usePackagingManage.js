import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/utils/format';
import logger from '@/utils/logger';
import { getPackagingTypeOptions, getPackagingTypeByKey } from '@/config/packagingTypes';

export function usePackagingManage() {
  const authStore = useAuthStore();
  const showToolbar = ref(false);

  // 权限检查 - 配置需要 工序管理权限，包材需要 原料管理权限
  const canEditConfig = computed(() => authStore.hasPermission('master:process:manage'));
  const canEditMaterial = computed(() => authStore.hasPermission('master:material:manage'));

  // 包装类型选项
  const packagingTypeOptions = getPackagingTypeOptions();

  // 数据
  const models = ref([]);
  const categories = ref([]);
  const packagingConfigs = ref([]);
  const selectedConfigs = ref([]);
  const selectedCategory = ref(null);
  const selectedModelId = ref(null);
  const selectedPackagingType = ref(null);
  const loading = ref(false);
  const allMaterials = ref([]); // 所有原料列表

  // 根据产品类别过滤型号
  const filteredModels = computed(() => {
    if (!selectedCategory.value) return models.value;
    return models.value.filter(m => m.model_category === selectedCategory.value);
  });

  // 产品类别变化
  const onCategoryChange = () => {
    selectedModelId.value = null;
    loadPackagingConfigs();
  };

  // 视图切换状态: 'card' | 'list'
  const viewMode = ref('card');

  // 切换视图时清空选择
  watch(viewMode, (newMode) => {
    if (newMode === 'card') {
      selectedConfigs.value = [];
    }
  });

  // 分页状态
  const currentPage = ref(1);
  const pageSize = ref(10);

  // 根据视图模式获取数据源（卡片视图只显示启用的，列表视图显示全部）
  const filteredByViewMode = computed(() => {
    if (viewMode.value === 'card') {
      return packagingConfigs.value.filter(c => c.is_active); // 卡片视图过滤禁用项
    }
    return packagingConfigs.value; // 列表视图显示全部
  });

  // 分页后的数据
  const paginatedConfigs = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredByViewMode.value.slice(start, end);
  });

  // 对话框
  const dialogVisible = ref(false);
  const materialDialogVisible = ref(false);
  const isEdit = ref(false);
  const formRef = ref(null);

  // 表单
  let form = reactive({
    id: null,
    model_id: null,
    config_name: '',
    packaging_type: 'standard_box',
    layer1_qty: null,
    layer2_qty: null,
    layer3_qty: null,
    // 兼容旧字段名
    pc_per_bag: null,
    bags_per_box: null,
    boxes_per_carton: null,
    is_active: 1,
    factory: 'dongguan_xunan',
    materials: []
  });

  // 当前查看的配置
  const currentConfig = ref(null);
  const currentMaterials = ref([]);

  // 一键复制包材相关
  const showMaterialCopyDialog = ref(false);
  const copySourceConfigId = ref(null);
  const copyMode = ref('replace');
  const copyLoading = ref(false);
  const copyConfigsLoading = ref(false);
  const copySourcePreview = ref([]);
  const allConfigsForCopy = ref([]);

  // 过滤有包材的配置（排除当前配置）
  const configsWithMaterials = computed(() => {
    return allConfigsForCopy.value.filter(c => c.id !== form.id && c.material_count > 0);
  });

  // 编辑表单的合计方法
  const getSummaries = (param) => {
    const { columns, data } = param;
    const sums = [];
    columns.forEach((column, index) => {
      if (index === 0) {
        sums[index] = '合计';
        return;
      }
      if (index === 4) { // 小计列
        const values = data.map(item => {
          const usage = item.basic_usage || 0;
          const price = item.unit_price || 0;
          return usage !== 0 ? price / usage : 0;
        });
        const total = values.reduce((prev, curr) => prev + curr, 0);
        sums[index] = `¥${formatNumber(total)}`;
      } else {
        sums[index] = '';
      }
    });
    return sums;
  };

  // 加载型号列表
  const loadModels = async () => {
    try {
      const response = await request.get('/models/active');
      if (response.success) {
        models.value = response.data;
      }
    } catch (error) {
      // 错误已在拦截器处理
    }
  };

  // 加载产品类别
  const loadCategories = async () => {
    try {
      const response = await request.get('/models/categories');
      if (response.success) {
        categories.value = response.data;
      }
    } catch (error) {
      // 错误已在拦截器处理
    }
  };

  // 加载包材类别的原料（只加载 category=包材 的数据）
  const loadMaterials = async () => {
    try {
      const response = await request.get('/materials', { params: { category: '包材' } });
      if (response.success) {
        allMaterials.value = response.data;
      }
    } catch (error) {
      logger.error('加载包材原料失败:', error);
    }
  };

  // 搜索原料（用于自动完成）
  const queryMaterials = (queryString, cb) => {
    if (!queryString) {
      cb(allMaterials.value.slice(0, 20)); // 默认显示前20条
      return;
    }

    const results = allMaterials.value.filter(material => {
      const query = queryString.toLowerCase();
      return (
        material.name.toLowerCase().includes(query) ||
        material.item_no.toLowerCase().includes(query)
      );
    });

    cb(results.slice(0, 20)); // 最多显示20条结果
  };

  // 选择原料后自动填充单价
  const handleSelectMaterial = (row, material) => {
    row.material_name = material.name;
    row.unit_price = material.price;
  };

  // 加载包装配置（包含禁用记录，前端根据视图模式过滤）
  const loadPackagingConfigs = async () => {
    loading.value = true;
    try {
      let url = '/processes/packaging-configs';
      const params = new URLSearchParams();
      params.append('include_inactive', 'true'); // 请求包含禁用记录

      if (selectedModelId.value) {
        url = `/processes/packaging-configs/model/${selectedModelId.value}`;
      }

      if (selectedPackagingType.value) {
        params.append('packaging_type', selectedPackagingType.value);
      }

      const queryString = params.toString();
      url += '?' + queryString;

      const response = await request.get(url);

      if (response.success) {
        let data = response.data;
        // 按产品类别过滤
        if (selectedCategory.value && !selectedModelId.value) {
          data = data.filter(item => item.model_category === selectedCategory.value);
        }
        packagingConfigs.value = data;
      }
    } catch (error) {
      ElMessage.error('加载包装配置失败');
    } finally {
      loading.value = false;
    }
  };

  // 加载所有配置及其包材数量（用于一键复制，使用优化后的单次查询接口）
  const loadConfigsForCopy = async () => {
    copyConfigsLoading.value = true;
    try {
      const response = await request.get('/processes/packaging-configs/with-material-count');
      if (response.success) {
        allConfigsForCopy.value = response.data;
      }
    } catch (error) {
      logger.error('加载配置列表失败:', error);
    } finally {
      copyConfigsLoading.value = false;
    }
  };

  // 打开一键复制弹窗
  const openMaterialCopyDialog = async () => {
    copySourceConfigId.value = null;
    copySourcePreview.value = [];
    copyMode.value = 'replace';
    showMaterialCopyDialog.value = true;
    await loadConfigsForCopy();
  };

  // 选择源配置时加载预览
  const handleCopySourceChange = async (configId) => {
    if (!configId) {
      copySourcePreview.value = [];
      return;
    }
    try {
      const response = await request.get(`/processes/packaging-configs/${configId}/full`);
      if (response.success) {
        copySourcePreview.value = response.data.materials || [];
      }
    } catch (error) {
      copySourcePreview.value = [];
    }
  };

  // 执行包材复制
  const handleCopyMaterials = () => {
    if (!copySourceConfigId.value || copySourcePreview.value.length === 0) {
      ElMessage.warning('请选择有包材的源配置');
      return;
    }

    copyLoading.value = true;
    try {
      if (copyMode.value === 'replace') {
        // 替换模式：清空现有包材
        form.materials = copySourcePreview.value.map((m, index) => ({
          material_name: m.material_name,
          basic_usage: m.basic_usage,
          unit_price: m.unit_price,
          carton_volume: m.carton_volume,
          sort_order: index
        }));
      } else {
        // 合并模式：追加新包材（跳过重复）
        const existingNames = form.materials.map(m => m.material_name);
        const newMaterials = copySourcePreview.value
          .filter(m => !existingNames.includes(m.material_name))
          .map((m, index) => ({
            material_name: m.material_name,
            basic_usage: m.basic_usage,
            unit_price: m.unit_price,
            carton_volume: m.carton_volume,
            sort_order: form.materials.length + index
          }));
        form.materials.push(...newMaterials);

        if (newMaterials.length < copySourcePreview.value.length) {
          const skipped = copySourcePreview.value.length - newMaterials.length;
          ElMessage.info(`已跳过 ${skipped} 个重复包材`);
        }
      }

      showMaterialCopyDialog.value = false;
      ElMessage.success(`成功复制 ${copyMode.value === 'replace' ? copySourcePreview.value.length : form.materials.length} 项包材`);
    } finally {
      copyLoading.value = false;
    }
  };

  // 编辑配置
  const editConfig = async (row) => {
    isEdit.value = true;

    try {
      const response = await request.get(`/processes/packaging-configs/${row.id}/full`);

      if (response.success) {
        const data = response.data;
        form.id = data.id;
        form.model_id = data.model_id;
        form.config_name = data.config_name;
        form.packaging_type = data.packaging_type || 'standard_box';
        form.layer1_qty = data.layer1_qty ?? data.pc_per_bag;
        form.layer2_qty = data.layer2_qty ?? data.bags_per_box;
        form.layer3_qty = data.layer3_qty ?? data.boxes_per_carton;
        form.factory = data.factory || 'dongguan_xunan';
        // 兼容旧字段名
        form.pc_per_bag = data.pc_per_bag;
        form.bags_per_box = data.bags_per_box;
        form.boxes_per_carton = data.boxes_per_carton;
        form.is_active = data.is_active ? 1 : 0;
        form.materials = data.materials || [];

        dialogVisible.value = true;
      }
    } catch (error) {
      // 错误已在拦截器处理
    }
  };

  // 查看包材
  const viewMaterials = async (row) => {
    try {
      const response = await request.get(`/processes/packaging-configs/${row.id}/full`);

      if (response.success) {
        currentConfig.value = response.data;
        currentMaterials.value = response.data.materials || [];
        materialDialogVisible.value = true;
      }
    } catch (error) {
      // 错误已在拦截器处理
    }
  };

  // 删除配置
  const deleteConfig = async (row) => {
    try {
      await ElMessageBox.confirm(`确定要删除包装配置"${row.config_name}"吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });

      await request.delete(`/processes/packaging-configs/${row.id}`);
      ElMessage.success('删除成功');
      loadPackagingConfigs();
    } catch (error) {
      if (error !== 'cancel') {
        // 错误已在拦截器处理
      }
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedConfigs.value.length === 0) { ElMessage.warning('请先选择要删除的配置'); return; }
    try {
      await ElMessageBox.confirm(`确定要删除选中的 ${selectedConfigs.value.length} 条包装配置吗？`, '批量删除确认', { type: 'warning' });
      const ids = selectedConfigs.value.map(item => item.id);
      const res = await request.post('/processes/packaging-configs/batch-delete', { ids });

      if (res.success) {
        const { deleted, failed } = res.data;
        if (deleted > 0 && failed.length === 0) {
          ElMessage.success(`成功删除 ${deleted} 条配置`);
        } else if (deleted > 0 && failed.length > 0) {
          ElMessage.warning(`成功删除 ${deleted} 条，${failed.length} 条因被引用无法删除`);
        } else if (failed.length > 0) {
          ElMessage.error(`${failed.length} 条配置被引用，无法删除`);
        }
        loadPackagingConfigs();
      }
    } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
  };

  // 添加包材
  const addMaterial = () => {
    form.materials.push({
      material_name: '',
      basic_usage: null,
      unit_price: null,
      carton_volume: null,
      sort_order: form.materials.length
    });
  };

  // 删除包材
  const removeMaterial = (index) => {
    form.materials.splice(index, 1);
    // 重新排序
    form.materials.forEach((m, i) => {
      m.sort_order = i;
    });
  };

  // 提交表单
  const submitForm = async () => {
    // 获取当前用户权限
    const hasMaterialManage = authStore.hasPermission('master:material:manage');
    const hasProcessManage = authStore.hasPermission('master:process:manage');

    // 验证必填字段（有工序管理权限的需要验证）
    if (!form.model_id) {
      ElMessage.warning('请选择型号');
      return;
    }
    if (hasProcessManage && !form.config_name) {
      ElMessage.warning('请输入配置名称');
      return;
    }

    // 获取包装类型配置
    const typeConfig = getPackagingTypeByKey(form.packaging_type);
    const l1 = form.layer1_qty ?? form.pc_per_bag;
    const l2 = form.layer2_qty ?? form.bags_per_box;
    const l3 = form.layer3_qty ?? form.boxes_per_carton;

    // 有工序管理权限的需要验证包装规格
    if (hasProcessManage && (!l1 || !l2)) {
      ElMessage.warning('请填写完整的包装方式');
      return;
    }
    if (hasProcessManage && typeConfig && typeConfig.layers === 3 && !l3) {
      ElMessage.warning('请填写完整的包装方式');
      return;
    }

    loading.value = true;
    try {
      // 根据权限组装提交数据
      let data;
      if (hasMaterialManage && !hasProcessManage) {
        // 只有原料管理权限只能提交包材
        data = {
          materials: form.materials
        };
      } else {
        // 有工序管理权限的提交完整数据
        data = {
          model_id: form.model_id,
          config_name: form.config_name,
          packaging_type: form.packaging_type,
          layer1_qty: l1,
          layer2_qty: l2,
          layer3_qty: typeConfig && typeConfig.layers === 3 ? l3 : null,
          factory: form.factory,
          is_active: form.is_active,
          materials: form.materials
        };
      }

      if (isEdit.value) {
        await request.put(`/processes/packaging-configs/${form.id}`, data);
        ElMessage.success('更新成功');
      } else {
        await request.post('/processes/packaging-configs', data);
        ElMessage.success('创建成功');
      }

      dialogVisible.value = false;
      loadPackagingConfigs();
    } catch (error) {
      // 错误已在拦截器处理
    } finally {
      loading.value = false;
    }
  };

  // 重置表单
  const resetForm = () => {
    form.id = null;
    form.model_id = selectedModelId.value || null;
    form.config_name = '';
    form.packaging_type = 'standard_box';
    form.layer1_qty = null;
    form.layer2_qty = null;
    form.layer3_qty = null;
    form.pc_per_bag = null;
    form.bags_per_box = null;
    form.boxes_per_carton = null;
    form.factory = 'dongguan_xunan';
    form.is_active = 1;
    form.materials = [];
  };

  // 选择变化
  const handleSelectionChange = (selection) => {
    selectedConfigs.value = selection;
  };

  // 文件选择
  const handleFileChange = async (file) => {
    const formData = new FormData();
    formData.append('file', file.raw);

    try {
      const response = await request.post('/processes/packaging-materials/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.success) {
        const { created, updated, errors } = response.data;
        let message = `导入成功！创建 ${created} 条，更新 ${updated} 条`;
        if (errors && errors.length > 0) {
          message += `\n${errors.slice(0, 3).join('\n')}`;
          if (errors.length > 3) {
            message += `\n...还有 ${errors.length - 3} 条错误`;
          }
        }
        ElMessage.success(message);
        loadPackagingConfigs();
      }
    } catch (error) {
      // 错误已在拦截器处理
    }
  };

  // 导出
  const handleExport = async () => {
    if (selectedConfigs.value.length === 0) {
      ElMessage.warning('请先选择要导出的数据');
      return;
    }

    try {
      const ids = selectedConfigs.value.map(item => item.id);
      const response = await request.post('/processes/packaging-materials/export/excel',
        { ids },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `包材清单_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ElMessage.success('导出成功');
    } catch (error) {
      ElMessage.error('导出失败');
    }
  };

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const response = await request.get('/processes/packaging-materials/template/download', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '包材导入模板.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ElMessage.success('下载成功');
    } catch (error) {
      ElMessage.error('下载失败');
    }
  };

  onMounted(() => {
    loadModels();
    loadCategories();
    loadMaterials();
    loadPackagingConfigs();
  });

  return {
    // 状态
    showToolbar,
    canEditConfig,
    canEditMaterial,
    packagingTypeOptions,
    models,
    categories,
    packagingConfigs,
    selectedConfigs,
    selectedCategory,
    selectedModelId,
    selectedPackagingType,
    loading,
    allMaterials,
    filteredModels,
    viewMode,
    currentPage,
    pageSize,
    filteredByViewMode,
    paginatedConfigs,
    dialogVisible,
    materialDialogVisible,
    isEdit,
    formRef,
    form,
    currentConfig,
    currentMaterials,
    showMaterialCopyDialog,
    copySourceConfigId,
    copyMode,
    copyLoading,
    copyConfigsLoading,
    copySourcePreview,
    configsWithMaterials,
    getSummaries,
    // 方法
    onCategoryChange,
    loadPackagingConfigs,
    queryMaterials,
    handleSelectMaterial,
    openMaterialCopyDialog,
    handleCopySourceChange,
    handleCopyMaterials,
    editConfig,
    viewMaterials,
    deleteConfig,
    handleBatchDelete,
    addMaterial,
    removeMaterial,
    submitForm,
    resetForm,
    handleSelectionChange,
    handleFileChange,
    handleExport,
    handleDownloadTemplate
  };
}
