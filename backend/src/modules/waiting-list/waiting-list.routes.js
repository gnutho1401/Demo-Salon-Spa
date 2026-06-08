const router = require('express').Router();
const controller = require('./waiting-list.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/my', authMiddleware, controller.getMine);
router.post('/', authMiddleware, controller.create);
router.delete('/:id', authMiddleware, controller.cancel);

module.exports = router;
