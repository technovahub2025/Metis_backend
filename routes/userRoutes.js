const express = require("express");

const User = require("../models/User");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET USERS
|--------------------------------------------------------------------------
|
| Supported:
|
| GET /api/users
| GET /api/users?role=pm
| GET /api/users?role=tl
| GET /api/users?role=admin
| GET /api/users?role=pm&active=true
| GET /api/users?role=tl&active=true
|
*/

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(
      Number(req.query.limit) || 100,
      500
    );

    /*
     * Optional role filter.
     */
    const requestedRole = String(
      req.query.role || ""
    )
      .trim()
      .toLowerCase();

    /*
     * Optional active filter.
     */
    const requestedActive = String(
      req.query.active || ""
    )
      .trim()
      .toLowerCase();

    /*
     * Build MongoDB filter dynamically.
     */
    const filter = {};

    if (
      ["admin", "pm", "tl"].includes(
        requestedRole
      )
    ) {
      filter.role = requestedRole;
    }

    if (
      requestedActive === "true"
    ) {
      filter.active = true;
    }

    if (
      requestedActive === "false"
    ) {
      filter.active = false;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const formattedUsers = users.map(
      (user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
    );

    return res.json({
      success: true,
      users: formattedUsers,
    });
  } catch (error) {
    console.error(
      "Get users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load users",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET CURRENT USER
|--------------------------------------------------------------------------
*/

router.get("/me", async (req, res) => {
  try {
    /*
     * This route can later use the JWT middleware.
     * Keeping it simple here because your current
     * frontend already uses the existing auth flow.
     */

    return res.status(501).json({
      success: false,
      message:
        "Current user endpoint not configured",
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load current user",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE USER
|--------------------------------------------------------------------------
|
| Used by Admin Team Management / PM & TL Roster.
|
| Admin can create:
|
| PM
| TL
|
| Password is passed as plain text ONLY to the
| User model. User.js automatically bcrypt-hashes
| the password before saving.
|
*/

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      active,
    } = req.body;

    /*
     * Validate required fields.
     */
    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password and role are required",
      });
    }

    /*
     * Only PM and TL accounts can be created
     * through this management endpoint.
     *
     * Admin is managed separately.
     */
    if (
      !["pm", "tl"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only PM and TL users can be created here",
      });
    }

    /*
     * Normalize email.
     */
    const normalizedEmail = String(
      email
    )
      .trim()
      .toLowerCase();

    /*
     * Check whether email already exists.
     */
    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists",
      });
    }

    /*
     * Create user.
     *
     * User.js pre-save middleware automatically
     * hashes the password.
     */
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role,
      active:
        active === undefined
          ? true
          : Boolean(active),
    });

    return res.status(201).json({
      success: true,
      message:
        "User created successfully",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Create user error:",
      error
    );

    /*
     * MongoDB duplicate-key protection.
     */
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create user",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
|
| IMPORTANT:
| The user document is loaded first and then
| .save() is used.
|
| This ensures User.pre("save") runs when the
| password is changed.
|
*/

router.put("/:id", async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      name,
      email,
      password,
      role,
      active,
    } = req.body;

    /*
     * Update name.
     */
    if (name !== undefined) {
      user.name = String(
        name
      ).trim();
    }

    /*
     * Update email.
     */
    if (email !== undefined) {
      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      /*
       * Check duplicate email while
       * excluding the current user.
       */
      const existingUser =
        await User.findOne({
          email: normalizedEmail,
          _id: {
            $ne: user._id,
          },
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "Another user already uses this email",
        });
      }

      user.email =
        normalizedEmail;
    }

    /*
     * Update role.
     */
    if (role !== undefined) {
      if (
        !["admin", "pm", "tl"].includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user role",
        });
      }

      user.role = role;
    }

    /*
     * Update active status.
     */
    if (active !== undefined) {
      user.active =
        Boolean(active);
    }

    /*
     * Update password only when
     * a new password was supplied.
     */
    if (
      password !== undefined &&
      String(password).trim() !== ""
    ) {
      user.password =
        String(password);
    }

    /*
     * Save document.
     *
     * User.js pre-save middleware will
     * automatically hash a changed password.
     */
    await user.save();

    return res.json({
      success: true,
      message:
        "User updated successfully",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt:
          user.createdAt,
        updatedAt:
          user.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update user",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE USER
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
     * Never allow Admin account to be
     * deleted from PM/TL management.
     */
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Admin accounts cannot be deleted here",
      });
    }

    await User.deleteOne({
      _id: user._id,
    });

    return res.json({
      success: true,
      message:
        "User deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete user",
    });
  }
});

module.exports = router;