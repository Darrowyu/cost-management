# 成本分析管理系统

## 快速参考

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前后端开发服务器 |
| `npm run dev:frontend` | 仅启动前端 (Vite) |
| `npm run dev:backend` | 仅启动后端 (Node.js) |
| `npm run build` | 构建前端生产包 |
| `cd frontend && npm run build:help-index` | 重建帮助文档索引 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + Pinia |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL |

## 关键约定

### 响应式数据模式
Vue `ref` 在复杂对象中可能出现响应式丢失，使用计算属性包装：

```javascript
// ✅ 正确做法
const form = ref({ ...defaultForm })
const formData = computed({
  get: () => form.value || defaultForm,
  set: (val) => { form.value = val }
})

// 模板中使用 formData
<el-input v-model="formData.name" />

// script 中修改用 form.value
form.value.name = 'xxx'
```

### 注释规范
```javascript
// 单行注释在右侧，控制在一行内
const count = ref(0) // 计数器

/* 多行注释用于
   说明复杂逻辑 */
```

### 代码规范
- **TypeScript**: 禁用 `any`，启用 `strict` 模式
- **函数**: 控制在 50 行内，单一职责
- **组件**: 控制在 200 行内，超过则拆分

## 项目结构

```
backend/
  routes/          # API 路由
  controllers/     # 业务逻辑
  models/          # 数据模型
  middleware/      # 中间件（权限、日志等）
  utils/           # 工具函数

frontend/src/
  views/           # 页面组件
  components/      # 通用组件
  store/           # Pinia 状态管理
  api/             # API 请求封装
  composables/     # 组合式函数
  config/          # 配置文件
```

## 开发工作流

### 1. 修改前
- 运行 `npm run build` 确保无编译错误
- 检查关联功能影响范围

### 2. 提交规范
```
type: 简短描述

type 类型:
- feat: 新功能
- fix: Bug修复
- refactor: 重构
- ui: 界面调整
- docs: 文档
```

### 3. PR 流程
1. 提交到 fork 的 `main` 分支
2. 创建 PR 到 `OG0914/cost-management`
3. PR 标题格式: `类型: 描述`

## 常见模式

### 工序列表表格操作
```javascript
// 添加行并滚动到底部
const addProcess = () => {
  form.value.processes.push({ name: '', price: null, isNew: true })
  nextTick(() => {
    const table = processTableRef.value?.$el
    const wrapper = table?.querySelector('.el-table__body-wrapper')
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight
  })
}

// 删除前确认
const removeProcess = async (index) => {
  try {
    await ElMessageBox.confirm('确定删除?', '确认')
    form.value.processes.splice(index, 1)
  } catch { /* 取消 */ }
}
```

### 权限检查
```javascript
// 使用 authStore 检查权限
const authStore = useAuthStore()
if (authStore.hasPermission('master:process:manage')) {
  // 有权限
}
```

## 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `reactive` 对象替换后响应式丢失 | Vue 3 `reactive` 限制 | 改用 `ref` + `computed` 包装 |
| 计算属性直接修改属性不生效 | Setter 只在直接赋值触发 | 修改内部值用 `form.value.xxx` |
| el-table 滚动不生效 | 滚动容器选择错误 | 使用 `.el-table__body-wrapper` |
| 表单验证失败但无提示 | 使用 `formData` 而非 `form.value` | 验证时用 `form.value` |

## 外部参考

- [Element Plus 文档](https://element-plus.org/)
- [Vue 3 组合式 API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Skills 参考](~/.claude/skills)（详细 Skill 列表）
