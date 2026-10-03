const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const loginEmail = email
      .trim()
      .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | ADMIN LOGIN
    |--------------------------------------------------------------------------
    |
    | Admin credentials come directly from .env.
    | MongoDB is used to store the Admin user record,
    | but the .env password is authoritative.
    |
    */

    const adminEmail = (
      process.env.ADMIN_EMAIL || ""
    )
      .trim()
      .toLowerCase();

    const adminPassword =
      process.env.ADMIN_PASSWORD || "";

    if (
      adminEmail &&
      adminPassword &&
      loginEmail === adminEmail
    ) {
      /*
       * IMPORTANT:
       * Compare directly with the configured
       * Admin password.
       *
       * This prevents old MongoDB password hashes
       * from causing intermittent login failures.
       */

      if (password !== adminPassword) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      /*
       * Find Admin account.
       */

      let admin = await User.findOne({
        email: adminEmail,
      });

      /*
       * Create Admin automatically if it
       * doesn't exist.
       */

      if (!admin) {
        const hashedPassword =
          await bcrypt.hash(
            adminPassword,
            12
          );

        admin = await User.create({
          name: "METIS Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          active: true,
        });
      } else {
        /*
         * Make sure this account is actually
         * the Admin account.
         */

        if (admin.role !== "admin") {
          return res.status(403).json({
            success: false,
            message:
              "Configured Admin email belongs to another role",
          });
        }

        if (admin.active === false) {
          return res.status(403).json({
            success: false,
            message:
              "Admin account is inactive",
          });
        }

        /*
         * Synchronize the MongoDB password hash
         * with ADMIN_PASSWORD.
         *
         * This keeps the database consistent.
         */

        const passwordMatches =
          await bcrypt.compare(
            adminPassword,
            admin.password
          );

        if (!passwordMatches) {
          admin.password =
            await bcrypt.hash(
              adminPassword,
              12
            );

          await admin.save();
        }
      }

      const token = createToken(admin);

      return res.json({
        success: true,
        message: "Login successful",
        token,
        user: formatUser(admin),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | SUPER ADMIN LOGIN
    |--------------------------------------------------------------------------
    |
    | Super Admin credentials come from .env.
    |
    */

    const superAdminEmail = (
      process.env.SUPER_ADMIN_EMAIL || ""
    )
      .trim()
      .toLowerCase();

    const superAdminPassword =
      process.env.SUPER_ADMIN_PASSWORD || "";

    if (
      superAdminEmail &&
      superAdminPassword &&
      loginEmail === superAdminEmail
    ) {
      if (password !== superAdminPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      let superAdmin = await User.findOne({
        email: superAdminEmail,
      });

      if (!superAdmin) {
        const hashedPassword =
          await bcrypt.hash(
            superAdminPassword,
            12
          );

        superAdmin = await User.create({
          name: "METIS Super Admin",
          email: superAdminEmail,
          password: hashedPassword,
          role: "super_admin",
          active: true,
        });
      } else {
        if (superAdmin.role !== "super_admin") {
          return res.status(403).json({
            success: false,
            message:
              "Configured Super Admin email belongs to another role",
          });
        }

        if (superAdmin.active === false) {
          return res.status(403).json({
            success: false,
            message: "Super Admin account is inactive",
          });
        }

        const passwordMatches =
          await bcrypt.compare(
            superAdminPassword,
            superAdmin.password
          );

        if (!passwordMatches) {
          superAdmin.password =
            await bcrypt.hash(
              superAdminPassword,
              12
            );

          await superAdmin.save();
        }
      }

      const token = createToken(superAdmin);

      return res.json({
        success: true,
        message: "Login successful",
        token,
        user: formatUser(superAdmin),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PM / TL LOGIN
    |--------------------------------------------------------------------------
    */

    const user = await User.findOne({
      email: loginEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error during login",
    });
  }
});

module.exports = router;