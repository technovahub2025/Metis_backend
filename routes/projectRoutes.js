const express = require("express");
const mongoose = require("mongoose");

const {
  authenticate,
  authorize,
} = require("../middleware/auth");

const User = require("../models/User");

const router = express.Router();

// ============================================================
// TEMPORARY IN-MEMORY PROJECT STORAGE
// ============================================================
//
// Project data is still stored in memory during workflow testing.
// User data is now read from MongoDB.
//
// Projects will remain available until the backend restarts.
// ============================================================

const TEMP_PROJECTS = [];

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

  const date = new Date(start);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (end.getTime() - date.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
};

// ============================================================
// SHAPE PROJECT
// ============================================================

const shape = (project) => {
  if (!project) {
    return null;
  }

  return {
    ...project,

    ageDays: daysBetween(
      project.mailDate
    ),

    lastActivity:
      project.lastActivity ||
      project.updatedAt ||
      project.createdAt,
  };
};

// ============================================================
// FIND USER BY MONGODB ID OR EMAIL
// ============================================================
//
// Supports both:
//
//   MongoDB ObjectId
//   Email address
//
// Also verifies:
//
//   role
//   active === true
//
// This is used for PM and TL assignment.
// ============================================================

const findUserByIdOrEmail = async (
  value,
  role
) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(
    value
  ).trim();

  if (!normalizedValue) {
    return null;
  }

  // ----------------------------------------------------------
  // Try MongoDB ObjectId first
  // ----------------------------------------------------------

  if (
    mongoose.Types.ObjectId.isValid(
      normalizedValue
    )
  ) {
    const userById =
      await User.findOne({
        _id: normalizedValue,
        role,
        active: true,
      }).lean();

    if (userById) {
      return userById;
    }
  }

  // ----------------------------------------------------------
  // Try email
  // ----------------------------------------------------------

  const userByEmail =
    await User.findOne({
      email:
        normalizedValue.toLowerCase(),
      role,
      active: true,
    }).lean();

  return userByEmail || null;
};

// ============================================================
// CREATE INITIALS
// ============================================================

const createInitials = (name) => {
  if (!name) {
    return "";
  }

  return String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
};

// ============================================================
// GET PROJECT INDEX
// ============================================================

const getProjectIndex = (id) => {
  return TEMP_PROJECTS.findIndex(
    (project) =>
      String(project.id) === String(id)
  );
};

// ============================================================
// GET /api/projects
// ============================================================
//
// Admin:
//   Gets all projects.
//
// PM:
//   Gets only projects assigned to that PM.
//
// TL:
//   Gets only projects assigned to that TL.
// ============================================================

router.get(
  "/",
  authenticate,
  async (req, res) => {
    try {
      const {
        type,
        stage,
        status,
        search,
        limit = "100",
        page = "1",
      } = req.query;

      let projects = [
        ...TEMP_PROJECTS,
      ];

      // --------------------------------------------------------
      // ROLE-BASED ACCESS
      // --------------------------------------------------------

      if (req.user.role === "pm") {
        const pmEmail = String(
          req.user.email || ""
        )
          .toLowerCase()
          .trim();

        projects = projects.filter(
          (project) =>
            String(
              project.pmEmail || ""
            )
              .toLowerCase()
              .trim() === pmEmail
        );
      }

      if (req.user.role === "tl") {
        const tlEmail = String(
          req.user.email || ""
        )
          .toLowerCase()
          .trim();

        projects = projects.filter(
          (project) =>
            String(
              project.tlEmail || ""
            )
              .toLowerCase()
              .trim() === tlEmail
        );
      }

      // --------------------------------------------------------
      // FILTERS
      // --------------------------------------------------------

      if (type) {
        projects = projects.filter(
          (project) =>
            project.projectType === type
        );
      }

      if (stage) {
        projects = projects.filter(
          (project) =>
            project.projectStage === stage
        );
      }

      if (status) {
        projects = projects.filter(
          (project) =>
            project.status === status
        );
      }

      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      if (search) {
        const searchText =
          String(search)
            .toLowerCase()
            .trim();

        projects = projects.filter(
          (project) =>
            String(
              project.projectName || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              project.projectCode || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              project.subject || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              project.pmName || ""
            )
              .toLowerCase()
              .includes(searchText) ||
            String(
              project.tlName || ""
            )
              .toLowerCase()
              .includes(searchText)
        );
      }

      // --------------------------------------------------------
      // SORT
      // --------------------------------------------------------

      projects.sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
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

      const total =
        projects.length;

      const skip =
        (pageNumber - 1) *
        limitNumber;

      const paginatedProjects =
        projects.slice(
          skip,
          skip + limitNumber
        );

      return res.json({
        success: true,
        total,
        page: pageNumber,
        limit: limitNumber,
        data: paginatedProjects.map(
          shape
        ),
      });
    } catch (error) {
      console.error(
        "Fetch projects error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch projects",
      });
    }
  }
);

// ============================================================
// GET /api/projects/:id
// ============================================================

router.get(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
      const project =
        TEMP_PROJECTS.find(
          (item) =>
            String(item.id) ===
            String(req.params.id)
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found",
        });
      }

      // --------------------------------------------------------
      // PM ACCESS
      // --------------------------------------------------------

      if (
        req.user.role === "pm" &&
        String(project.pmEmail || "")
          .toLowerCase()
          .trim() !==
          String(req.user.email || "")
            .toLowerCase()
            .trim()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this project",
        });
      }

      // --------------------------------------------------------
      // TL ACCESS
      // --------------------------------------------------------

      if (
        req.user.role === "tl" &&
        String(project.tlEmail || "")
          .toLowerCase()
          .trim() !==
          String(req.user.email || "")
            .toLowerCase()
            .trim()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this project",
        });
      }

      return res.json({
        success: true,
        data: shape(project),
      });
    } catch (error) {
      console.error(
        "Fetch project error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch project",
      });
    }
  }
);

// ============================================================
// POST /api/projects
// ============================================================
//
// ONLY ADMIN can create projects.
//
// PM is resolved from MongoDB using:
//   pm = MongoDB user ID
// or
//   pmEmail = email
//
// The selected user MUST:
//   role = "pm"
//   active = true
// ============================================================

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const {
        subject,
        mailDate,
        projectName,
        projectCode,
        projectType,
        emailStage,
        projectStage,
        pm,
        pmEmail,
        pmName,
        location,
        scope,
        assignmentPriority,
        delegationNote,
      } = req.body;

      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !projectName ||
        !String(projectName).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Project name is required",
        });
      }

      // --------------------------------------------------------
      // FIND PM FROM MONGODB
      // --------------------------------------------------------

      let selectedPM = null;

      const requestedPM =
        pmEmail || pm;

      if (requestedPM) {
        selectedPM =
          await findUserByIdOrEmail(
            requestedPM,
            "pm"
          );

        if (!selectedPM) {
          return res.status(400).json({
            success: false,
            message:
              "PM not found or inactive",
          });
        }
      }

      // --------------------------------------------------------
      // CREATE PROJECT
      // --------------------------------------------------------

      const now =
        new Date().toISOString();

      const project = {
        id: `project-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

        subject:
          typeof subject === "string"
            ? subject.trim()
            : "",

        mailDate:
          mailDate || null,

        projectName:
          String(projectName).trim(),

        projectCode:
          typeof projectCode === "string"
            ? projectCode.trim()
            : "",

        projectType:
          projectType || "",

        emailStage:
          emailStage || "",

        projectStage:
          projectStage || "Planning",

        status:
          "Awaiting PM Review",

        // ------------------------------------------------------
        // PM
        // ------------------------------------------------------

        pmId:
          selectedPM?._id
            ? String(selectedPM._id)
            : "",

        pmEmail:
          selectedPM?.email || "",

        pmName:
          selectedPM?.name || "",

        pmInitials:
          selectedPM
            ? createInitials(
                selectedPM.name
              )
            : "",

        // ------------------------------------------------------
        // TL
        // ------------------------------------------------------

        tlId: "",
        tlEmail: "",
        tlName: "",
        tlInitials: "",
        assignedTL: "",
        assignedDate: null,

        // ------------------------------------------------------
        // DETAILS
        // ------------------------------------------------------

        location:
          typeof location === "string"
            ? location.trim()
            : "",

        scope:
          typeof scope === "string"
            ? scope.trim()
            : "",

        assignmentPriority:
          assignmentPriority ||
          "Normal",

        delegationNote:
          typeof delegationNote ===
          "string"
            ? delegationNote.trim()
            : "",

        lastActivity: now,

        createdAt: now,
        updatedAt: now,
      };

      TEMP_PROJECTS.push(project);

      return res.status(201).json({
        success: true,
        message:
          "Project created successfully",
        data: shape(project),
      });
    } catch (error) {
      console.error(
        "Create project error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to create project",
      });
    }
  }
);

// ============================================================
// PUT /api/projects/:id/assign-tl
// ============================================================
//
// Admin or PM can assign a TL.
//
// PM can only assign a TL to their own project.
//
// TL is resolved from MongoDB using:
//   tlId = MongoDB user ID
// or
//   tlEmail = email
//
// The selected user MUST:
//   role = "tl"
//   active = true
// ============================================================

router.put(
  "/:id/assign-tl",
  authenticate,
  authorize("admin", "pm"),
  async (req, res) => {
    try {
      const {
        tlId,
        tlEmail,
        tlName,
        assignmentPriority,
        delegationNote,
      } = req.body;

      // --------------------------------------------------------
      // FIND PROJECT
      // --------------------------------------------------------

      const project =
        TEMP_PROJECTS.find(
          (item) =>
            String(item.id) ===
            String(req.params.id)
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found",
        });
      }

      // --------------------------------------------------------
      // PM ACCESS
      // --------------------------------------------------------

      if (
        req.user.role === "pm" &&
        String(project.pmEmail || "")
          .toLowerCase()
          .trim() !==
          String(req.user.email || "")
            .toLowerCase()
            .trim()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this project",
        });
      }

      // --------------------------------------------------------
      // FIND TL FROM MONGODB
      // --------------------------------------------------------

      const requestedTL =
        tlEmail || tlId;

      let selectedTL = null;

      if (requestedTL) {
        selectedTL =
          await findUserByIdOrEmail(
            requestedTL,
            "tl"
          );
      }

      if (!selectedTL) {
        return res.status(404).json({
          success: false,
          message:
            "TL not found or inactive",
        });
      }

      // --------------------------------------------------------
      // ASSIGN TL
      // --------------------------------------------------------

      project.tlId =
        selectedTL._id
          ? String(selectedTL._id)
          : "";

      project.tlEmail =
        selectedTL.email || "";

      project.tlName =
        selectedTL.name || "";

      project.tlInitials =
        createInitials(
          selectedTL.name
        );

      project.assignedTL =
        selectedTL.name || "";

      project.assignedDate =
        new Date().toISOString();

      project.lastActivity =
        new Date().toISOString();

      project.updatedAt =
        new Date().toISOString();

      project.assignmentPriority =
        assignmentPriority ||
        "Normal";

      project.delegationNote =
        typeof delegationNote ===
        "string"
          ? delegationNote.trim()
          : "";

      // --------------------------------------------------------
      // STATUS
      // --------------------------------------------------------

      if (
        !project.status ||
        project.status ===
          "Awaiting TL"
      ) {
        project.status =
          "In Progress";
      }

      return res.json({
        success: true,
        message:
          "TL assigned successfully",
        data: shape(project),
      });
    } catch (error) {
      console.error(
        "Assign TL error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to assign TL",
      });
    }
  }
);

// ============================================================
// PUT /api/projects/:id
// ============================================================
//
// Admin:
//   Can update any project.
//
// PM:
//   Can update only their projects.
//
// TL:
//   Can update only their projects.
// ============================================================

router.put(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
      const project =
        TEMP_PROJECTS.find(
          (item) =>
            String(item.id) ===
            String(req.params.id)
        );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found",
        });
      }

      // --------------------------------------------------------
      // ACCESS CHECK
      // --------------------------------------------------------

      if (
        req.user.role === "pm" &&
        String(project.pmEmail || "")
          .toLowerCase()
          .trim() !==
          String(req.user.email || "")
            .toLowerCase()
            .trim()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this project",
        });
      }

      if (
        req.user.role === "tl" &&
        String(project.tlEmail || "")
          .toLowerCase()
          .trim() !==
          String(req.user.email || "")
            .toLowerCase()
            .trim()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this project",
        });
      }

      // --------------------------------------------------------
      // BUILD UPDATE
      // --------------------------------------------------------

      const update = {
        ...req.body,
      };

      // --------------------------------------------------------
      // PM RESTRICTIONS
      // --------------------------------------------------------

      if (req.user.role === "pm") {
        delete update.pm;
        delete update.pmId;
        delete update.pmEmail;
        delete update.pmName;
        delete update.pmInitials;

        delete update.tl;
        delete update.tlId;
        delete update.tlEmail;
        delete update.tlName;
        delete update.tlInitials;
        delete update.assignedTL;
        delete update.assignedDate;
      }

      // --------------------------------------------------------
      // TL RESTRICTIONS
      // --------------------------------------------------------

      if (req.user.role === "tl") {
        delete update.pm;
        delete update.pmId;
        delete update.pmEmail;
        delete update.pmName;
        delete update.pmInitials;

        delete update.tl;
        delete update.tlId;
        delete update.tlEmail;
        delete update.tlName;
        delete update.tlInitials;
        delete update.assignedTL;
        delete update.assignedDate;
      }

      // --------------------------------------------------------
      // ASSIGNMENT FIELDS CONTROLLED
      // THROUGH assign-tl
      // --------------------------------------------------------

      if (
        req.user.role === "pm" ||
        req.user.role === "tl"
      ) {
        delete update.assignmentPriority;
        delete update.delegationNote;
      }

      // --------------------------------------------------------
      // APPLY UPDATE
      // --------------------------------------------------------

      Object.keys(update).forEach(
        (key) => {
          if (
            key !== "id" &&
            key !== "createdAt"
          ) {
            project[key] =
              update[key];
          }
        }
      );

      project.lastActivity =
        new Date().toISOString();

      project.updatedAt =
        new Date().toISOString();

      return res.json({
        success: true,
        message:
          "Project updated successfully",
        data: shape(project),
      });
    } catch (error) {
      console.error(
        "Update project error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update project",
      });
    }
  }
);

// ============================================================
// DELETE /api/projects/:id
// ============================================================
//
// ONLY ADMIN can delete projects.
// ============================================================

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const index =
        getProjectIndex(
          req.params.id
        );

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found",
        });
      }

      TEMP_PROJECTS.splice(
        index,
        1
      );

      return res.json({
        success: true,
        message:
          "Project deleted",
      });
    } catch (error) {
      console.error(
        "Delete project error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete project",
      });
    }
  }
);

module.exports = router;