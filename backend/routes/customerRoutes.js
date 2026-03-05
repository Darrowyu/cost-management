const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const customerController = require('../controllers/master/customerController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

router.use(verifyToken);

// 查看权限
router.get('/', checkPermission('master:customer:view'), customerController.getCustomerList);
router.get('/search', checkPermission('master:customer:view'), customerController.searchCustomers);
router.get('/:id', checkPermission('master:customer:view'), customerController.getCustomerById);
router.post('/export/excel', checkPermission('master:customer:view'), customerController.exportCustomers);

// 管理权限
router.get('/template/download', checkPermission('master:customer:manage'), customerController.downloadTemplate);
router.post('/', checkPermission('master:customer:manage'), customerController.createCustomer);
router.post('/import', checkPermission('master:customer:manage'), upload.single('file'), customerController.importCustomers);
router.post('/batch-delete', checkPermission('master:customer:manage'), customerController.batchDeleteCustomers);
router.put('/:id', checkPermission('master:customer:manage'), customerController.updateCustomer);
router.delete('/:id', checkPermission('master:customer:manage'), customerController.deleteCustomer);

module.exports = router;
