const router = require('express').Router();
const controller = require('./membership.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/my', authMiddleware, controller.getMine);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
