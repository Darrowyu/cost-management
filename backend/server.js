/**
 * Express 服务器主入口
 * PostgreSQL 异步版本
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dbManager = require('./db/database');
const errorHandler = require('./middleware/errorHandler');
const operationLogger = require('./middleware/operationLogger');
const logger = require('./utils/logger');
const { initRoleCache } = require('./config/rolePermissions');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// CORS 配置 - 白名单模式
// 默认值与 .env 中 ALLOWED_ORIGINS 保持一致
function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  for (const item of allowedOrigins) {
    if (item === '*') return true;

    let allowedUrl;
    try {
      allowedUrl = new URL(item);
    } catch {
      continue;
    }

    if (allowedUrl.protocol !== originUrl.protocol) continue;
    if (allowedUrl.hostname !== originUrl.hostname) continue;

    if (allowedUrl.port) {
      if (allowedUrl.port === originUrl.port) return true;
      continue;
    }

    return true; // 未配置端口：允许该 host 的任意端口
  }

  return false;
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  : ['http://192.168.0.58:5173', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin, allowedOrigins));
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 请求限流配置 - 防止暴力破解和 DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟窗口
  max: process.env.RATE_LIMIT_MAX || 1000, // 每 IP 最多 1000 次请求 (Default increased from 200)
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// 登录接口更严格的限流
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 登录每 IP 每 15 分钟最多 100 次 (Increased from 10)
  message: { success: false, message: '登录尝试过于频繁，请 15 分钟后再试' }
});
app.use('/api/auth/login', authLimiter);

app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码请求体

// 静态文件服务 - 图片上传目录
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 健康检查路由
app.get('/api/health', (req, res) => {
  // 格式化为北京时间
  const now = new Date();
  const beijingTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: beijingTime,
    database: dbManager.isInitialized ? 'connected' : 'disconnected'
  });
});

// 操作日志中间件 - 记录关键操作
app.use(operationLogger);

// API 路由
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/regulations', require('./routes/regulationRoutes'));
app.use('/api/models', require('./routes/modelRoutes'));
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/processes', require('./routes/processRoutes'));
app.use('/api/config', require('./routes/configRoutes'));
app.use('/api/cost', require('./routes/costRoutes'));
app.use('/api/standard-costs', require('./routes/standardCostRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/review', require('./routes/reviewRoutes'));
app.use('/api/bom', require('./routes/bomRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/permissions', require('./routes/permissionRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

// 统一错误处理
app.use(errorHandler);

// 服务器实例（用于优雅关闭）
let server = null;

/**
 * 启动服务器
 * 异步初始化数据库后再启动 HTTP 服务
 */
async function startServer() {
  try {
    // 异步初始化数据库连接
    logger.info('正在连接 PostgreSQL 数据库...');
    await dbManager.initialize();
    logger.info('数据库连接成功');

    // 初始化角色缓存
    await initRoleCache();

    // 启动 HTTP 服务
    server = app.listen(PORT, HOST, () => {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const localIPs = [];

      // 获取所有局域网 IP
      Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName].forEach(iface => {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIPs.push(iface.address);
          }
        });
      });

      logger.info('========================================');
      logger.info('成本分析管理系统后端服务已启动');
      logger.info(`端口: ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info('数据库: PostgreSQL');
      logger.info('----------------------------------------');
      logger.info(`本地访问: http://localhost:${PORT}`);
      if (localIPs.length > 0) {
        logger.info('局域网访问:');
        localIPs.forEach(ip => {
          logger.info(`  http://${ip}:${PORT}`);
        });
      }
      logger.info('----------------------------------------');
      logger.info(`健康检查: http://localhost:${PORT}/api/health`);
      logger.info('========================================');
    });

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

/**
 * 优雅关闭服务器
 * 先关闭 HTTP 服务，再关闭数据库连接
 */
async function gracefulShutdown(signal) {
  logger.warn(`收到 ${signal} 信号，正在优雅关闭服务器...`);

  try {
    // 关闭 HTTP 服务器（停止接受新连接）
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP 服务已关闭');
    }

    // 关闭数据库连接池
    await dbManager.close();
    logger.info('数据库连接已关闭');

    logger.info('服务器已安全关闭');
    process.exit(0);
  } catch (error) {
    logger.error('关闭服务器时发生错误:', error);
    process.exit(1);
  }
}

// 监听进程信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

// 启动服务器
startServer();
