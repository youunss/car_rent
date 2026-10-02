// car-rental-app/models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required for a booking.'],
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: [true, 'Car is required for a booking.'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required.'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required.'],
    // Custom validator to ensure endDate is after startDate
    validate: {
      validator: function(value) {
        return this.startDate < value;
      },
      message: 'End date must be after start date.'
    }
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required.'],
    min: [0, 'Total price cannot be negative.']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'declined'], // Added declined
    default: 'pending',
  },
  // Optional: Payment details or reference
  // paymentId: { type: String },
  // paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index to improve query performance for user's bookings or car's bookings
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ car: 1, startDate: 1, endDate: 1 });

// Virtual for duration (optional)
bookingSchema.virtual('durationDays').get(function() {
  if (this.startDate && this.endDate) {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  }
  return null;
});

module.exports = mongoose.model('Booking', bookingSchema);
