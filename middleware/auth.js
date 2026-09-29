const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || "";

  const token =
    header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

   req.user = {
  id: payload.userId,
  email: payload.email,
  role: payload.role,
};

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (
    roles.length &&
    !roles.includes(req.user.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "Insufficient permissions",
    });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
};
