const Delivery = require('../models/Delivery');
const Courier = require('../models/Courier');
const ErrorResponse = require('../utils/errorResponse');
const geocoder = require('../utils/geocoder');
const asyncHandler = require('../middleware/async');

// @desc    Get all deliveries
// @route   GET /api/v1/deliveries
// @route   GET /api/v1/users/:userId/deliveries
// @route   GET /api/v1/couriers/:courierId/deliveries
// @access  Private/Admin
exports.getDeliveries = asyncHandler(async (req, res, next) => {
  if (req.params.userId) {
    const deliveries = await Delivery.find({ user: req.params.userId });

    return res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } else if (req.params.courierId) {
    const deliveries = await Delivery.find({ courier: req.params.courierId });

    return res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single delivery
// @route   GET /api/v1/deliveries/:id
// @access  Private
exports.getDelivery = asyncHandler(async (req, res, next) => {
  const delivery = await Delivery.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'name email phone',
    })
    .populate({
      path: 'courier',
      select: 'user status',
      populate: {
        path: 'user',
        select: 'name phone',
      },
    });

  if (!delivery) {
    return next(
      new ErrorResponse(`No delivery with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is delivery owner or admin
  if (
    delivery.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this delivery`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: delivery,
  });
});

// @desc    Create new delivery
// @route   POST /api/v1/deliveries
// @access  Private
exports.createDelivery = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.user = req.user.id;

  // Geocode pickup and delivery locations
  const pickupLoc = await geocoder.geocode(req.body.pickupLocation.address);
  const deliveryLoc = await geocoder.geocode(req.body.deliveryLocation.address);

  req.body.pickupLocation = {
    type: 'Point',
    coordinates: [pickupLoc[0].longitude, pickupLoc[0].latitude],
    address: req.body.pickupLocation.address,
  };

  req.body.deliveryLocation = {
    type: 'Point',
    coordinates: [deliveryLoc[0].longitude, deliveryLoc[0].latitude],
    address: req.body.deliveryLocation.address,
  };

  // Calculate distance (simplified - in a real app you'd use a proper distance API)
  const distance = calculateDistance(
    req.body.pickupLocation.coordinates,
    req.body.deliveryLocation.coordinates
  );
  req.body.distance = distance;

  // Calculate price (simplified pricing model)
  req.body.price = calculatePrice(
    distance,
    req.body.packageDetails.weight,
    req.body.packageDetails.dimensions
  );

  // Generate tracking number
  req.body.trackingNumber = generateTrackingNumber();

  const delivery = await Delivery.create(req.body);

  res.status(201).json({
    success: true,
    data: delivery,
  });
});

// @desc    Update delivery
// @route   PUT /api/v1/deliveries/:id
// @access  Private
exports.updateDelivery = asyncHandler(async (req, res, next) => {
  let delivery = await Delivery.findById(req.params.id);

  if (!delivery) {
    return next(
      new ErrorResponse(`No delivery with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is delivery owner or admin
  if (delivery.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this delivery`,
        401
      )
    );
  }

  // If courier is updating, only allow status updates
  if (req.user.role === 'courier') {
    if (Object.keys(req.body).length !== 1 || !req.body.status) {
      return next(
        new ErrorResponse(`Couriers can only update delivery status`, 400)
      );
    }
  }

  delivery = await Delivery.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: delivery,
  });
});

// @desc    Delete delivery
// @route   DELETE /api/v1/deliveries/:id
// @access  Private
exports.deleteDelivery = asyncHandler(async (req, res, next) => {
  const delivery = await Delivery.findById(req.params.id);

  if (!delivery) {
    return next(
      new ErrorResponse(`No delivery with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is delivery owner or admin
  if (delivery.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this delivery`,
        401
      )
    );
  }

  await delivery.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Find nearby couriers
// @route   GET /api/v1/deliveries/:id/nearbycouriers
// @access  Private
exports.findNearbyCouriers = asyncHandler(async (req, res, next) => {
  const delivery = await Delivery.findById(req.params.id);

  if (!delivery) {
    return next(
      new ErrorResponse(`No delivery with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is delivery owner or admin
  if (delivery.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this delivery`,
        401
      )
    );
  }

  // Find couriers within 10km radius who are available
  const couriers = await Courier.find({
    status: 'available',
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: delivery.pickupLocation.coordinates,
        },
        $maxDistance: 10000, // 10km in meters
      },
    },
  }).populate({
    path: 'user',
    select: 'name phone',
  });

  res.status(200).json({
    success: true,
    count: couriers.length,
    data: couriers,
  });
});

// @desc    Assign courier to delivery
// @route   PUT /api/v1/deliveries/:id/assigncourier
// @access  Private
exports.assignCourier = asyncHandler(async (req, res, next) => {
  let delivery = await Delivery.findById(req.params.id);

  if (!delivery) {
    return next(
      new ErrorResponse(`No delivery with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is admin or the delivery owner
  if (delivery.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to assign couriers to this delivery`,
        401
      )
    );
  }

  // Check if courier exists
  const courier = await Courier.findById(req.body.courierId);

  if (!courier) {
    return next(
      new ErrorResponse(`No courier with the id of ${req.body.courierId}`, 404)
    );
  }

  // Check if courier is available
  if (courier.status !== 'available') {
    return next(
      new ErrorResponse(
        `Courier ${courier.id} is not available for delivery`,
        400
      )
    );
  }

  // Update delivery with courier and change status
  delivery.courier = req.body.courierId;
  delivery.status = 'accepted';

  // Update courier status
  courier.status = 'on-delivery';
  await courier.save();

  delivery = await delivery.save();

  res.status(200).json({
    success: true,
    data: delivery,
  });
});

// Helper function to calculate distance (simplified)
function calculateDistance(point1, point2) {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  // Haversine formula (simplified for demo)
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

// Helper function to calculate price (simplified)
function calculatePrice(distance, weight, dimensions) {
  // Base price + distance price + weight price
  const basePrice = 5.0;
  const distancePrice = distance * 1.5;
  const weightPrice = weight * 0.2;
  
  // Simple volume calculation if dimensions provided
  let volumePrice = 0;
  if (dimensions) {
    const volume = dimensions.length * dimensions.width * dimensions.height;
    volumePrice = volume * 0.0001; // Adjust multiplier as needed
  }
  
  return basePrice + distancePrice + weightPrice + volumePrice;
}

// Helper function to generate tracking number
function generateTrackingNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}