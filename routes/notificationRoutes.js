const express = require("express");

const {
  authenticate,
} = require("../middleware/auth");

const Notification = require("../models/Notification");

const router = express.Router();

// GET /api/notifications
router.get(
  "/",
  authenticate,
  async (req, res) => {
    try {
      const { limit = "50" } = req.query;

      const limitNumber = Math.max(
        1,
        Number(limit) || 50
      );

      const notifications =
        await Notification.find({
          recipient: req.user.id,
        })
          .populate(
            "project",
            "projectName projectCode"
          )
          .sort({ createdAt: -1 })
          .limit(limitNumber)
          .lean();

      const totalUnread =
        await Notification.countDocuments({
          recipient: req.user.id,
          isRead: false,
        });

      return res.json({
        success: true,
        data: notifications,
        unreadCount: totalUnread,
      });
    } catch (error) {
      console.error(
        "Fetch notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch notifications",
      });
    }
  }
);

// GET /api/notifications/unread-count
router.get(
  "/unread-count",
  authenticate,
  async (req, res) => {
    try {
      const count =
        await Notification.countDocuments({
          recipient: req.user.id,
          isRead: false,
        });

      return res.json({
        success: true,
        unreadCount: count,
      });
    } catch (error) {
      console.error(
        "Fetch unread count error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch unread count",
      });
    }
  }
);

// PATCH /api/notifications/:id/read
router.patch(
  "/:id/read",
  authenticate,
  async (req, res) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id: req.params.id,
            recipient: req.user.id,
          },
          {
            isRead: true,
            readAt: new Date(),
          },
          {
            new: true,
            runValidators: true,
          }
        ).lean();

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found",
        });
      }

      return res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error(
        "Mark notification read error:",
        error
      );

      if (
        error.name ===
        "CastError"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to mark notification",
      });
    }
  }
);

// DELETE /api/notifications/:id
router.delete(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
      const notification =
        await Notification.findById(
          req.params.id
        ).lean();

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification does not exist",
          notificationId:
            req.params.id,
        });
      }

      if (
        String(notification.recipient) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot clear this notification",
          notificationRecipient:
            String(
              notification.recipient
            ),
          loggedInUser:
            String(req.user.id),
        });
      }

      await Notification.findByIdAndDelete(
        req.params.id
      );

      return res.json({
        success: true,
        message:
          "Notification cleared",
        notificationId:
          req.params.id,
      });
    } catch (error) {
      console.error(
        "Clear notification error:",
        error
      );

      if (
        error.name ===
        "CastError"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid notification ID",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to clear notification",
      });
    }
  }
);

// PATCH /api/notifications/read-all
router.patch(
  "/read-all",
  authenticate,
  async (req, res) => {
    try {
      const result =
        await Notification.updateMany(
          {
            recipient: req.user.id,
            isRead: false,
          },
          {
            $set: {
              isRead: true,
              readAt: new Date(),
            },
          }
        );

      return res.json({
        success: true,
        message:
          "All notifications marked as read",
        modified:
          result.modifiedCount,
      });
    } catch (error) {
      console.error(
        "Mark all notifications read error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to mark notifications",
      });
    }
  }
);

module.exports = router;
