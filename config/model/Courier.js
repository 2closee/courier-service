const mongoose = require('mongoose');

const CourierSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  vehicle: {
    type: mongoose.Schema.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'unavailable', 'on-delivery'],
    default: 'available',
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must not be more than 5'],
  },
  deliveryCount: {
    type: Number,
    default: 0,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create geospatial index for courier location
CourierSchema.index({ currentLocation: '2dsphere' });

// Cascade delete deliveries when a courier is deleted
CourierSchema.pre('remove', async function (next) {
  await this.model('Delivery').deleteMany({ courier: this._id });
  next();
});

module.exports = mongoose.model('Courier', CourierSchema);