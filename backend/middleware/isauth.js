const jwt = require("jsonwebtoken");

const isauth = (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
      });
    }

    if (!process.env.SECRET_KEY) {
      console.error("SECRET_KEY is missing!");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    if (!decoded || !decoded.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please sign in again.",
      });
    }

    req.userid = decoded.user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please sign in again.",
    });
  }
};

module.exports = isauth;