/**
 * 工序配置历史记录控制器
 * 处理工序配置历史记录的查询操作
 */

const ProcessConfigHistory = require('../../models/ProcessConfigHistory');
const logger = require('../../utils/logger');

function handleError(res, error, message) {
  logger.error(message, error);
  res.status(500).json({ success: false, error: message });
}

class ProcessHistoryController {
  async getHistoryByPackagingConfigId(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const history = await ProcessConfigHistory.findByPackagingConfigId(id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, '获取历史记录失败');
    }
  }

  async getLatestHistory(req, res) {
    try {
      const { id } = req.params;
      const history = await ProcessConfigHistory.findLatestByPackagingConfigId(id);

      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, '获取历史记录失败');
    }
  }
}

module.exports = new ProcessHistoryController();
