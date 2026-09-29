const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ============================================================
// TEMPORARY IN-MEMORY MAIL STORAGE
// ============================================================
// MongoDB is disabled during workflow testing.
// Raw mails will remain only while the backend is running.

const TEMP_MAILS = [];

// ============================================================
// HELPERS
// ============================================================

const daysBetween = (
  start,
  end = new Date()
) => {
  if (!start) {
    return 0;
  }

  const received = new Date(start);

  if (Number.isNaN(received.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (end.getTime() - received.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
};

const shape = (mail) => {
  if (!mail) {
    return null;
  }

  return {
    ...mail,

    ageDays:
      mail.ageDays ??
      daysBetween(mail.receivedDate),

    lastActivity:
      mail.lastActivity ||
      mail.updatedAt ||
      mail.createdAt,
  };
};

// ============================================================
// GET /api/mails
// ============================================================

router.get(
  "/",
  authenticate,
  async (req, res) => {
    try {
      const {
        status,
        project,
        search,
        limit = "100",
        page = "1",
      } = req.query;

      let mails = [
        ...TEMP_MAILS,
      ];

      // --------------------------------------------------------
      // STATUS FILTER
      // --------------------------------------------------------

      if (status) {
        mails = mails.filter(
          (mail) =>
            mail.processingStatus ===
            status
        );
      }

      // --------------------------------------------------------
      // PROJECT FILTER
      // --------------------------------------------------------

      if (project) {
        const projectSearch =
          String(project).toLowerCase();

        mails = mails.filter(
          (mail) =>
            String(
              mail.projectName || ""
            )
              .toLowerCase()
              .includes(projectSearch)
        );
      }

      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      if (search) {
        const searchText =
          String(search).toLowerCase();

        mails = mails.filter(
          (mail) =>
            String(
              mail.subject || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              mail.sender || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              mail.projectName || ""
            )
              .toLowerCase()
              .includes(searchText)
        );
      }

      // --------------------------------------------------------
      // SORT
      // --------------------------------------------------------

      mails.sort(
        (a, b) =>
          new Date(
            b.receivedDate || b.createdAt
          ).getTime() -
          new Date(
            a.receivedDate || a.createdAt
          ).getTime()
      );

      // --------------------------------------------------------
      // PAGINATION
      // --------------------------------------------------------

      const pageNumber = Math.max(
        1,
        Number(page) || 1
      );

      const limitNumber = Math.max(
        1,
        Number(limit) || 100
      );

      const total = mails.length;

      const skip =
        (pageNumber - 1) *
        limitNumber;

      const paginatedMails =
        mails.slice(
          skip,
          skip + limitNumber
        );

      res.json({
        success: true,
        total,
        page: pageNumber,
        limit: limitNumber,
        data: paginatedMails.map(
          shape
        ),
      });
    } catch (error) {
      console.error(
        "Fetch raw mails error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch raw mails",
      });
    }
  }
);

// ============================================================
// GET /api/mails/:id
// ============================================================

router.get(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
      const mail =
        TEMP_MAILS.find(
          (item) =>
            String(item.id) ===
            String(req.params.id)
        );

      if (!mail) {
        return res.status(404).json({
          success: false,
          message: "Mail not found",
        });
      }

      res.json({
        success: true,
        data: shape(mail),
      });
    } catch (error) {
      console.error(
        "Fetch mail error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch mail",
      });
    }
  }
);

// ============================================================
// PUT /api/mails/:id
// ============================================================

router.put(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
      const mail =
        TEMP_MAILS.find(
          (item) =>
            String(item.id) ===
            String(req.params.id)
        );

      if (!mail) {
        return res.status(404).json({
          success: false,
          message: "Mail not found",
        });
      }

      // Update allowed mail fields
      Object.keys(req.body || {}).forEach(
        (key) => {
          if (
            key !== "id" &&
            key !== "createdAt"
          ) {
            mail[key] = req.body[key];
          }
        }
      );

      mail.updatedAt =
        new Date().toISOString();

      mail.lastActivity =
        mail.updatedAt;

      res.json({
        success: true,
        data: shape(mail),
      });
    } catch (error) {
      console.error(
        "Update mail error:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;