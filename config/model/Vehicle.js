const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['bicycle', 'motorcycle', 'car', 'van', 'truck'],
    required: true,
  },
  make: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  licensePlate: {
    type: String,
    required: true,
    unique: true,
  },
  color: String,
  capacity: {
    weight: Number,
    volume: Number,
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
  },
  registration: {
    number: String,
    expiryDate: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Vehicle', VehicleSchema);