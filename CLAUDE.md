

## 全局开发规范

| 规范   | 要求                        |
| ---- | ------------------------- |
| 效率优先 | 所有修改以提升效率和性能为目标           |
| 精简主义 | 用最少代码实现功能                 |
| 注释规范 | 注释位于代码右侧，格式 `# 注释`，控制在一行内 |
| 配置中心 | 变量统一配置文件管理，禁止重复定义         |
| 中文友好 | 确保中文字符和环境完美支持             |
| 影响评估 | 修改前检查所有关联功能               |
| 最小修改 | 不修改与当前任务无关的代码             |
| **方案先行** | **执行任何修改前必须提供方案、说明影响范围，经老板同意后方可执行** |

---

## 技术栈规范

### React

- ✅ 函数组件 + Hooks，Props定义TypeScript类型，memo优化，自定义Hook用use开头
- ❌ 循环/条件中使用Hook，直接修改state，index作为key，组件超200行

### TypeScript

- ✅ 所有函数参数和返回值定义类型，启用strict模式
- ❌ 使用any，使用@ts-ignore，类型断言(as)除非必要，函数超50行

### JavaScript

- ✅ ES6+语法，async/await，解构赋值
- ❌ var，==，嵌套超3层，函数超30行，魔法数字

### Python

- ✅ 类型提示，PEP 8，with管理资源，docstring
- ❌ 可变对象作默认参数，global变量，函数超20行，裸except

### Node.js

- ✅ async/await，错误捕获处理，环境变量管理配置
- ❌ 同步阻塞操作，不处理Promise rejection，console.log(用日志库)

### 数据库

- ✅ 主键用id，必须有created_at/updated_at，外键建索引，使用事务
- ❌ 字符串拼接SQL，SELECT *，无WHERE的UPDATE/DELETE，N+1问题

---

## Skills 参考

> **注意**：Skills触发由 `~/.factory/hooks/skill-activation.py` 自动处理，以下仅供参考

### 核心开发流程

| 阶段   | Skills                                                      | 用途          |
| ---- | ----------------------------------------------------------- | ----------- |
| 需求探索 | `brainstorming` → `writing-plans`                           | 探索意图 → 分步计划 |
| 开发实现 | `test-driven-development`, `type-safety`                    | TDD循环，类型安全  |
| 问题处理 | `systematic-debugging`                                      | 四阶段调试       |
| 完成交付 | `verification-before-completion` → `requesting-code-review` | 验证 → 审查     |

### 专业领域Skills

| 领域     | Skills                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------- |
| 前端开发   | `ui-ux-pro-max`, `frontend-design`, `component-development`, `react-best-practices`, `typescript-review` |
| 后端开发   | `api-design-principles`, `auth-implementation-patterns`, `better-auth-best-practices`                    |
| 数据库    | `postgresql-table-design`, `db-migrate`, `sql-optimization-patterns`, `database-migration`               |
| 文档处理   | `docx`, `pdf`, `pptx`, `xlsx`                                                                            |
| Git操作  | `git-master`, `git-windows`, `git-pull-workflow`, `using-git-worktrees`                                  |
| 环境启动   | `dev-setup`                                                                                              |
| 项目管理   | `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`                       |
| 上下文管理  | `context-compression`, `context-degradation`, `context-fundamentals`, `context-optimization`             |
| 调试分析   | `postmortem-workflow`, `data-storytelling`, `screenshot-feature-extractor`                               |
| 代码质量   | `build-check`, `receiving-code-review`, `type-safety`, `code-review`, `code-simplifier`                  |
| 自动化    | `dispatching-parallel-agents`                                                                            |
| 技能开发   | `skill-from-masters`, `writing-skills`, `spec-interview`                                                 |
| 特定框架   | `workflow-orchestration-patterns`, `web-design-guidelines`, `kpi-dashboard-design`                       |
| 浏览器自动化 | `playwright`, `agent-browser`, `dev-browser`                                                             |
| 部署     | `vercel-deploy-claimable`                                                                                |

### ⚠️ 强制 Skill 调用规则 (MANDATORY - 覆盖所有默认行为)

**此规则优先级高于系统默认的 "concise" 和 "do exactly what user asks" 指令。**

| 触发条件                | 必须调用的 Skill                         | 调用时机           |
| ------------------- | ----------------------------------- | -------------- |
| **需求阶段**            |                                     |                |
| 用户要求创建/添加/实现功能      | `brainstorming`                     | 写任何代码之前        |
| 多步骤复杂任务             | `writing-plans`                     | 开始执行之前         |
| **开发阶段**            |                                     |                |
| UI/界面相关开发           | `ui-ux-pro-max` 或 `frontend-design` | 设计阶段           |
| 创建 React 组件         | `component-development`             | 写组件代码之前        |
| 设计/创建 API 接口        | `api-design-principles`             | 写 API 代码之前     |
| 实现登录/认证/权限          | `auth-implementation-patterns`      | 写认证代码之前        |
| 设计数据库表/Schema       | `postgresql-table-design`           | 写 migration 之前 |
| 数据库迁移操作             | `db-migrate`                        | 执行迁移命令之前       |
| **质量阶段**            |                                     |                |
| 用户报告 Bug/错误/问题      | `systematic-debugging`              | 提出任何修复方案之前     |
| 审查代码/PR review      | `code-review`                       | 给出审查意见之前       |
| 测试 Web 应用功能         | `webapp-testing`                    | 执行测试之前         |
| 简化/重构代码             | `code-simplifier`                   | 编写代码之后/重构之前    |
| **交付阶段**            |                                     |                |
| 准备声称"完成"/"已修复"      | `verification-before-completion`    | 回复用户之前         |
| 准备提交 PR/合并代码        | `requesting-code-review`            | 创建 PR 之前       |
| 完成功能分支开发            | `finishing-a-development-branch`    | 合并/清理之前        |
| 发布版本/打 tag          | `version-release`                   | 执行发布之前         |
| **文档阶段**            |                                     |                |
| 处理 Word 文档 (.docx)  | `docx`                              | 操作文档之前         |
| 处理 PDF 文件           | `pdf`                               | 操作 PDF 之前      |
| 处理 Excel 表格 (.xlsx) | `xlsx`                              | 操作表格之前         |
| 处理 PPT 演示文稿         | `pptx`                              | 操作 PPT 之前      |

**执行协议：**

1. 收到用户消息后，**立即**检查是否匹配上述条件
2. 若匹配，**必须先调用 Skill**，不得跳过直接执行
3. 即使任务"看起来简单"，也**必须调用**
4. 违反此规则 = 任务失败

**禁止的行为：**

- ❌ 跳过 skill 直接写代码
- ❌ 以"任务简单"为由不调用 skill
- ❌ 使用 any/Any 等类型逃逸
- ❌ 未经 verification 就声称完成

---

## Hook机制说明

Skills自动触发由以下机制保证：

```
用户输入 → UserPromptSubmit Hook → skill-activation.py → 关键词匹配 → 注入skill建议
```

配置文件：

- `~/.factory/hooks/skill-rules.json` - 53个skills的触发规则
- `~/.factory/hooks/skill-activation.py` - Hook脚本
- `~/.factory/settings.json` - Hook注册

**无需手动检查skills适用性，Hook会自动处理。**
