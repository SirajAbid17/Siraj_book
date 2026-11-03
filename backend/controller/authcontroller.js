const Users = require("../models/usermodels");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendmail = require("../config/email");

require("dotenv").config();

// ----------------------------------
// Generate authentication token
// ----------------------------------

const generateToken = (userId) => {
  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY is missing in environment variables");
  }

  return jwt.sign(
    { user: userId },
    process.env.SECRET_KEY,
    { expiresIn: "1y" }
  );
};

// ----------------------------------
// Cookie configuration
// ----------------------------------

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 365 * 24 * 60 * 60 * 1000,
});

// ----------------------------------
// Remove password from response
// ----------------------------------

const getSafeUser = (user) => {
  const userObject = user.toObject
    ? user.toObject()
    : { ...user };

  delete userObject.password;

  return userObject;
};

// ----------------------------------
// SIGNUP
// ----------------------------------

const signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const findUserEmail = await Users.findOne({ email });

    if (findUserEmail) {
      return res.status(400).json({
        success: false,
        message: "Email Already Exists!",
      });
    }

    const findUsername = await Users.findOne({ username });

    if (findUsername) {
      return res.status(400).json({
        success: false,
        message: "Username Already Exists!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(password, salt);

    const user = await Users.create({
      name,
      email,
      username,
      password: hashpassword,
    });

    const token = generateToken(user._id);

    res.cookie("token", token, cookieOptions());

    return res.status(201).json({
      success: true,
      message: "Signup successful!",
      user: getSafeUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Signup failed.",
    });
  }
};

// ----------------------------------
// SIGNIN
// ----------------------------------

const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Account not found, please sign up.",
      });
    }

    const comparePassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!comparePassword) {
      return res.status(400).json({
        success: false,
        message: "Incorrect Password.",
      });
    }

    const token = generateToken(user._id);

    res.cookie("token", token, cookieOptions());

    return res.status(200).json({
      success: true,
      message: "Signin successfully!",
      user: getSafeUser(user),
    });
  } catch (error) {
    console.error("Signin error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Signin failed.",
    });
  }
};

// ----------------------------------
// SIGNOUT
// ----------------------------------

const signout = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logout Successfully!",
    });
  } catch (error) {
    console.error("Signout error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ----------------------------------
// SEND OTP
// ----------------------------------

const sendotp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found!",
      });
    }

    const otp = Math.floor(
      1000 + Math.random() * 9000
    ).toString();

    user.resetotp = otp;
    user.otpexpire = Date.now() + 5 * 60 * 1000;
    user.otpverify = false;

    await user.save();

    await sendmail(email, `Your OTP is: ${otp}`);

    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json({
        message: "OTP sent to email!",
        otp,
        debug: "Development mode only",
      });
    }

    return res.status(200).json({
      message: "OTP sent to email!",
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ----------------------------------
// VERIFY OTP
// ----------------------------------

const verifyotp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required.",
      });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found.",
      });
    }

    if (!user.resetotp || user.resetotp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP.",
      });
    }

    if (!user.otpexpire || user.otpexpire < Date.now()) {
      return res.status(400).json({
        message: "OTP has expired.",
      });
    }

    user.otpverify = true;
    user.resetotp = undefined;
    user.otpexpire = undefined;

    await user.save();

    return res.status(200).json({
      message: "OTP Verified Successfully.",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ----------------------------------
// RESET PASSWORD
// ----------------------------------

const resetpassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found.",
      });
    }

    if (!user.otpverify) {
      return res.status(400).json({
        message: "OTP verification required.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(password, salt);

    user.password = hashpassword;
    user.otpverify = false;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully!",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  signup,
  signin,
  signout,
  sendotp,
  verifyotp,
  resetpassword,
};