const mongoose = require('mongoose');

const CarSchema = new mongoose.Schema({
  make: {
    type: String,
    required: [true, 'Please provide the car make'],
    trim: true,
  },
  model: {
    type: String,
    required: [true, 'Please provide the car model'],
    trim: true,
  },
  year: {
    type: Number,
    required: [true, 'Please provide the car year'],
    min: [1900, 'Year must be 1900 or later'],
    max: [new Date().getFullYear() + 1, `Year cannot be more than ${new Date().getFullYear() + 1}`],
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Please provide the price per day'],
    min: [0, 'Price per day cannot be negative'],
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'maintenance'],
    default: 'available',
  },
  imageURL: {
    type: String,
    // required: [true, 'Please provide a car image'], // Make it optional or handle default if no image
  },
  features: {
    type: [String], // Array of strings for features like 'Air Conditioning', 'GPS', etc.
    default: [],
  },
  // It might be useful to know which admin added the car
  // addedBy: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true, // Assuming only admins can add cars
  // },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // You could also add a field for when the car was last updated
  // updatedAt: {
  //   type: Date,
  //   default: Date.now
  // }
});

// Optional: Middleware to update `updatedAt` field on save, if you add it
// CarSchema.pre('save', function(next) {
//   if (this.isModified()) {
//     this.updatedAt = Date.now();
//   }
//   next();
// });

module.exports = mongoose.model('Car', CarSchema);
