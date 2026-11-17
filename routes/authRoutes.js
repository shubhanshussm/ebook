const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendEmailOtp, generate6DigitOtp } = require('../utils/emailService');
const { protect } = require('../middleware/authMiddleware');

// Helper to sign JWT token
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role || 'user' },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '7d' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax',
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  res.cookie('token', token, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      purchasedBooks: user.purchasedBooks,
    },
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user (with optional referral code)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    let referredByUser = null;
    if (referralCode && referralCode.trim()) {
      referredByUser = await User.findOne({ referralCode: referralCode.toUpperCase().trim() });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      referredBy: referredByUser ? referredByUser._id : null,
      walletCredits: referredByUser ? 50 : 0, // ₹50 welcome bonus if referred
      notifications: [
        {
          title: 'Welcome to BookVault! 📚',
          message: referredByUser
            ? `Welcome! You earned ₹50 signup credits thanks to ${referredByUser.name}'s referral.`
            : 'Welcome to BookVault. Explore world-class technical eBooks and start learning!',
          type: 'reward',
        },
      ],
    });

    if (referredByUser) {
      referredByUser.notifications.push({
        title: 'New Referral Joined! 🤝',
        message: `${user.name} just signed up using your referral link.`,
        type: 'reward',
      });
      await referredByUser.save();
    }

    sendTokenResponse(user, 201, res, 'Registration successful! Welcome to the eBook Store.');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
});

// @route   POST /api/auth/register-send-otp
// @desc    Initiate OTP verification for registration
router.post('/register-send-otp', async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    // Clean up any stale registration OTPs for this email
    await Otp.deleteMany({ email: cleanEmail, purpose: 'registration' });

    // Generate 6-digit OTP
    const otp = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.create({
      email: cleanEmail,
      otp,
      purpose: 'registration',
      userData: {
        name: name.trim(),
        password,
        referralCode: referralCode ? referralCode.trim() : '',
      },
      expiresAt,
    });

    // Send email OTP
    await sendEmailOtp({
      email: cleanEmail,
      otp,
      purpose: 'registration',
      name: name.trim(),
    });

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code was sent to ${cleanEmail}.`,
      email: cleanEmail,
      otpPreview: otp, // Always provided for seamless dev testing
    });
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.',
    });
  }
});

// @route   POST /api/auth/register-verify-otp
// @desc    Verify OTP and complete account registration
router.post('/register-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    // Verify OTP record
    const otpDoc = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      purpose: 'registration',
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new code.',
      });
    }

    const { name, password, referralCode } = otpDoc.userData || {};

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Registration session expired. Please start registration again.',
      });
    }

    // Double check user doesn't already exist
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      await Otp.findByIdAndDelete(otpDoc._id);
      return res.status(400).json({
        success: false,
        message: 'Account with this email already exists. Please log in.',
      });
    }

    let referredByUser = null;
    if (referralCode && referralCode.trim()) {
      referredByUser = await User.findOne({ referralCode: referralCode.toUpperCase().trim() });
    }

    // Create verified user
    const newUser = await User.create({
      name,
      email: cleanEmail,
      password,
      referredBy: referredByUser ? referredByUser._id : null,
      walletCredits: referredByUser ? 50 : 0,
      notifications: [
        {
          title: 'Welcome to BookVault! 📚',
          message: referredByUser
            ? `Welcome! You earned ₹50 signup credits thanks to ${referredByUser.name}'s referral.`
            : 'Welcome to BookVault. Explore world-class technical eBooks and start learning!',
          type: 'reward',
        },
      ],
    });

    if (referredByUser) {
      referredByUser.notifications.push({
        title: 'New Referral Joined! 🤝',
        message: `${newUser.name} just signed up using your referral link.`,
        type: 'reward',
      });
      await referredByUser.save();
    }

    // Clean up OTP record
    await Otp.findByIdAndDelete(otpDoc._id);

    sendTokenResponse(newUser, 201, res, 'Email verified! Account created successfully.');
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete registration.',
    });
  }
});

// @route   POST /api/auth/forgot-password-send-otp
// @desc    Send password reset OTP code
router.post('/forgot-password-send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered email address.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No registered account found with this email address.',
      });
    }

    // Clean up any stale forgot-password OTPs for this email
    await Otp.deleteMany({ email: cleanEmail, purpose: 'forgot_password' });

    // Generate 6-digit OTP
    const otp = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.create({
      email: cleanEmail,
      otp,
      purpose: 'forgot_password',
      userData: { name: user.name },
      expiresAt,
    });

    // Send email
    await sendEmailOtp({
      email: cleanEmail,
      otp,
      purpose: 'forgot_password',
      name: user.name,
    });

    res.status(200).json({
      success: true,
      message: `Password reset code sent to ${cleanEmail}.`,
      email: cleanEmail,
      otpPreview: otp, // Always provided for seamless dev testing
    });
  } catch (error) {
    console.error('Send forgot password OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reset code. Please try again.',
    });
  }
});

// @route   POST /api/auth/reset-password-verify-otp
// @desc    Verify OTP and set new password
router.post('/reset-password-verify-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, verification code, and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    // Verify OTP record
    const otpDoc = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      purpose: 'forgot_password',
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code. Please request a new code.',
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      await Otp.findByIdAndDelete(otpDoc._id);
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Update password (pre-save hook hashes with bcrypt)
    user.password = newPassword;
    user.notifications.push({
      title: 'Password Changed Successfully 🔒',
      message: 'Your account password was updated via email OTP verification.',
      type: 'system',
    });
    await user.save();

    // Clean up OTP record
    await Otp.findByIdAndDelete(otpDoc._id);

    sendTokenResponse(user, 200, res, 'Password reset successful! You are now logged in.');
  } catch (error) {
    console.error('Reset password OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset password.',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    // Check for user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful!');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get currently logged in user profile and purchased books
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('purchasedBooks');
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        purchasedBooks: user.purchasedBooks,
      },
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update current user's profile info
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
    }

    const user = await User.findById(req.user._id);
    user.name = name.trim();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        purchasedBooks: user.purchasedBooks,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change account password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide both current and new password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user & clear cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

module.exports = router;
