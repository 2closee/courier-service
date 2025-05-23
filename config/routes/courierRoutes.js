const express = require('express');
const {
  getCouriers,
  getCourier,
  createCourier,
  updateCourier,
  deleteCourier,
  updateCourierLocation,
  getCourierStats,
} = require('../controllers/courierController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, authorize('admin'), getCouriers)
  .post(protect, createCourier);

router
  .route('/:id')
  .get(protect, getCourier)
  .put(protect, updateCourier)
  .delete(protect, deleteCourier);

router.route('/:id/location').put(protect, updateCourierLocation);
router.route('/stats').get(protect, authorize('admin'), getCourierStats);

module.exports = router;