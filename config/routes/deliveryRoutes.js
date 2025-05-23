const express = require('express');
const {
  getDeliveries,
  getDelivery,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  findNearbyCouriers,
  assignCourier,
} = require('../controllers/deliveryController');

const router = express.Router();

const { protect } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getDeliveries)
  .post(protect, createDelivery);

router
  .route('/:id')
  .get(protect, getDelivery)
  .put(protect, updateDelivery)
  .delete(protect, deleteDelivery);

router
  .route('/:id/nearbycouriers')
  .get(protect, findNearbyCouriers);

router
  .route('/:id/assigncourier')
  .put(protect, assignCourier);

// Include other resource routers
const courierRouter = require('./courierRoutes');

// Re-route into other resource routers
router.use('/:deliveryId/couriers', courierRouter);

module.exports = router;