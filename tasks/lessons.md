# 项目经验沉淀

## 2026-03-02

### 方案推荐规范

**触发条件**: 需要老板在多个方案中选择时

**规范要求**:
1. 必须同时提供方案A和方案B的详细说明
2. **必须说明推荐理由**，包括：
   - 技术原理（为什么可行）
   - 维护成本（长期影响）
   - 扩展性（未来变更的灵活度）
3. 明确标注推荐方案，但让老板做最终决策

**错误示例**:
```
方案A：删除组件内样式
方案B：提高选择器优先级
请问您倾向于哪个？
```

**正确示例**:
```
推荐方案A：删除组件内样式
理由：
1. 单一职责 - 样式统一在dialog.css管理
2. 避免优先级战争 - :deep()与全局样式混用不可预期
3. 维护成本 - 其他页面复用只需改一处

方案B：提高选择器优先级
适用场景：需要组件级特殊覆盖时

请问老板倾向于哪个？
```

---

## 2026-03-03

### Bug: 审核退回功能故障

**问题现象**:
1. 已退回的成本分析详情页无法显示退回原因
2. 审核退回时报错 `dbManager.getClient is not a function`

**根因分析**:
1. 前端 `RejectedDetailDialog.vue` 查询 `c.type === 'reject'`，但数据库 `comments` 表没有 `type` 字段
2. 后端使用 `dbManager.getClient()`，但 `DatabaseManager` 类没有这个方法

**修复方案**:
```javascript
// 前端修改 - 通过内容前缀查找
const rejectComment = comments.find(c => c.content?.includes('【退回原因】'))
rejectReason.value = rejectComment?.content?.replace('【退回原因】', '') || ''

// 后端修改 - 使用正确的连接池方法
const client = await dbManager.pool.connect();
```

**经验总结**:
1. **API 一致性**: 修改数据库模块后要全局检查所有调用点
2. **连接池管理**: 只在 `finally` 块中释放连接，避免重复释放
3. **最小改动**: 优先修复问题本身，避免引入新的复杂性

**相关文件**:
- `frontend/src/components/review/RejectedDetailDialog.vue:195`
- `backend/controllers/review/reviewController.js:268,341`

---
