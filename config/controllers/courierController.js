const Courier = require('../models/Courier');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all couriers
// @route   GET /api/v1/couriers
// @access  Private/Admin
exports.getCouriers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single courier
// @route   GET /api/v1/couriers/:id
// @access  Private
exports.getCourier = asyncHandler(async (req, res, next) => {
  const courier = await Courier.findById(req.params.id).populate({
    path: 'user',
    select: 'name email phone',
  });

  if (!courier) {
    return next(
      new ErrorResponse(`No courier with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is courier owner or admin
  if (courier.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this courier`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: courier,
  });
});

// @desc    Create courier
// @route   POST /api/v1/couriers
// @access  Private
exports.createCourier = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.user = req.user.id;

  // Check if user is already a courier
  const existingCourier = await Courier.findOne({ user: req.user.id });

  if (existingCourier) {
    return next(
      new ErrorResponse(`User ${req.user.id} is already a courier`, 400)
    );
  }

  const courier = await Courier.create(req.body);

  // Update user role to courier
  await User.findByIdAndUpdate(req.user.id, { role: 'courier' });

  res.status(201).json({
    success: true,
    data: courier,
  });
});

// @desc    Update courier
// @route   PUT /api/v1/couriers/:id
// @access  Private
exports.updateCourier = asyncHandler(async (req, res, next) => {
  let courier = await Courier.findById(req.params.id);

  if (!courier) {
    return next(
      new ErrorResponse(`No courier with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is courier owner or admin
  if (courier.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this courier`,
        401
      )
    );
  }

  courier = await Courier.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: courier,
  });
});

// @desc    Update courier location
// @route   PUT /api/v1/couriers/:id/location
// @access  Private
exports.updateCourierLocation = asyncHandler(async (req, res, next) => {
  let courier = await Courier.findById(req.params.id);

  if (!courier) {
    return next(
      new ErrorResponse(`No courier with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is courier owner or admin
  if (courier.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this courier`,
        401
      )
    );
  }

  // Geocode the address if provided
  if (req.body.address) {
    const loc = await geocoder.geocode(req.body.address);
    req.body.currentLocation = {
      type: 'Point',
      coordinates: [loc[0].longitude, loc[0].latitude],
      address: req.body.address,
    };
  }

  courier = await Courier.findByIdAndUpdate(
    req.params.id,
    { currentLocation: req.body.currentLocation },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    data: courier,
  });
});

// @desc    Delete courier
// @route   DELETE /api/v1/couriers/:id
// @access  Private
exports.deleteCourier = asyncHandler(async (req, res, next) => {
  const courier = await Courier.findById(req.params.id);

  if (!courier) {
    return next(
      new ErrorResponse(`No courier with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is courier owner or admin
  if (courier.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this courier`,
        401
      )
    );
  }

  await courier.remove();

  // Update user role back to user
  await User.findByIdAndUpdate(req.user.id, { role: 'user' });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get courier statistics
// @route   GET /api/v1/couriers/stats
// @access  Private/Admin
exports.getCourierStats = asyncHandler(async (req, res, next) => {
  const stats = await Courier.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        avgDeliveries: { $avg: '$deliveryCount' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: stats,
  });
});