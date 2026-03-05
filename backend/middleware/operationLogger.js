/**
 * 操作日志中间件
 * 仅记录关键操作：登录/登出、创建/删除/更新、审批等
 */

const logger = require('../utils/logger');

// 需要记录的关键操作路径和方法
const CRITICAL_OPERATIONS = [
    // 认证操作
    { method: 'POST', path: '/api/auth/login', action: '用户登录' },
    { method: 'POST', path: '/api/auth/change-password', action: '修改密码' },

    // 成本分析操作
    { method: 'POST', path: '/api/cost/quotations', action: '创建成本分析' },
    { method: 'PUT', path: '/api/cost/quotations', action: '更新成本分析' },
    { method: 'DELETE', path: '/api/cost/quotations', action: '删除成本分析' },
    { method: 'POST', path: '/api/cost/quotations/*/submit', action: '提交成本分析' },

    // 审批操作
    { method: 'POST', path: '/api/review/approve', action: '审批通过' },
    { method: 'POST', path: '/api/review/reject', action: '审批驳回' },

    // 标准成本操作
    { method: 'POST', path: '/api/standard-costs', action: '设置标准成本' },
    { method: 'PUT', path: '/api/standard-costs', action: '更新标准成本' },
    { method: 'DELETE', path: '/api/standard-costs', action: '删除标准成本' },

    // 基础数据操作
    { method: 'POST', path: '/api/models', action: '创建型号' },
    { method: 'PUT', path: '/api/models', action: '更新型号' },
    { method: 'DELETE', path: '/api/models', action: '删除型号' },

    { method: 'POST', path: '/api/materials', action: '创建原料' },
    { method: 'PUT', path: '/api/materials', action: '更新原料' },
    { method: 'DELETE', path: '/api/materials', action: '删除原料' },

    { method: 'POST', path: '/api/processes', action: '创建工序配置' },
    { method: 'PUT', path: '/api/processes', action: '更新工序配置' },
    { method: 'DELETE', path: '/api/processes', action: '删除工序配置' },

    { method: 'POST', path: '/api/regulations', action: '创建法规' },
    { method: 'PUT', path: '/api/regulations', action: '更新法规' },
    { method: 'DELETE', path: '/api/regulations', action: '删除法规' },

    { method: 'POST', path: '/api/customers', action: '创建客户' },
    { method: 'PUT', path: '/api/customers', action: '更新客户' },
    { method: 'DELETE', path: '/api/customers', action: '删除客户' },

    // 系统配置
    { method: 'PUT', path: '/api/config', action: '更新系统配置' },

    // 用户管理
    { method: 'POST', path: '/api/auth/users', action: '创建用户' },
    { method: 'PUT', path: '/api/auth/users', action: '更新用户' },
    { method: 'DELETE', path: '/api/auth/users', action: '删除用户' },

    // 导入操作
    { method: 'POST', path: '/api/materials/import', action: '导入原料' },
    { method: 'POST', path: '/api/processes/*/import', action: '导入工序' },
    { method: 'POST', path: '/api/bom/import', action: '导入BOM' },
];

/**
 * 匹配请求路径与配置的操作路径
 * 支持通配符 * 匹配任意路径段
 */
function matchPath(requestPath, patternPath) {
    const requestParts = requestPath.split('/');
    const patternParts = patternPath.split('/');

    if (requestParts.length < patternParts.length) {
        return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i] === '*') continue; // 通配符匹配任意
        if (patternParts[i] !== requestParts[i]) return false;
    }

    return true;
}

/**
 * 查找匹配的操作
 */
function findOperation(method, path) {
    return CRITICAL_OPERATIONS.find(op =>
        op.method === method && matchPath(path, op.path)
    );
}

/**
 * 操作日志中间件
 */
const operationLogger = (req, res, next) => {
    const operation = findOperation(req.method, req.path);

    if (!operation) {
        return next(); // 非关键操作，直接跳过
    }

    // 记录请求开始时间
    const startTime = Date.now();

    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 以捕获响应
    res.json = function (data) {
        const duration = Date.now() - startTime;
        // 优先从 req.user 获取（已认证请求），登录操作从响应数据中提取
        let user = '未登录用户';
        if (req.user) {
            user = `${req.user.username}(${req.user.role})`;
        } else if (operation.action === '用户登录' && data?.success && data?.data?.user) {
            // 登录成功，从响应中提取用户信息
            const loginUser = data.data.user;
            user = `${loginUser.username}(${loginUser.role})`;
        }
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const success = data?.success !== false && res.statusCode < 400;

        // 构建日志信息
        const logInfo = {
            action: operation.action,
            user,
            ip,
            method: req.method,
            path: req.path,
            duration: `${duration}ms`,
            success
        };

        // 添加额外的上下文信息（不记录敏感数据）
        if (req.params?.id) logInfo.targetId = req.params.id;
        if (req.body?.customer_name) logInfo.customer = req.body.customer_name;
        if (req.body?.model_id) logInfo.modelId = req.body.model_id;
        if (req.body?.quotation_no) logInfo.quotationNo = req.body.quotation_no;
        if (data?.data?.quotation_no) logInfo.quotationNo = data.data.quotation_no;

        // 记录日志
        const logMessage = `[操作] ${operation.action} | 用户: ${user} | IP: ${ip} | ${success ? '成功' : '失败'} | ${duration}ms`;

        if (success) {
            logger.info(logMessage, { ...logInfo });
        } else {
            logInfo.error = data?.message || '操作失败';
            logger.warn(logMessage, { ...logInfo });
        }

        // 调用原始方法返回响应
        return originalJson(data);
    };

    next();
};

module.exports = operationLogger;
