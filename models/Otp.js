const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'forgot_password'],
      required: true,
      default: 'registration',
    },
    userData: {
      name: { type: String, trim: true },
      password: { type: String },
      referralCode: { type: String, trim: true },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete when current time reaches expiresAt
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Otp', otpSchema);
