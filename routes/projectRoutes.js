const express = require("express");
const mongoose = require("mongoose");

const {
  authenticate,
  authorize,
} = require("../middleware/auth");

const User = require("../models/User");
const Project = require("../models/Project");
const Notification = require("../models/Notification");

const router = express.Router();

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

    id: project.id ||
      (project._id
        ? String(project._id)
        : undefined),

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
// CREATE NOTIFICATION
// ============================================================

const createNotification = async (
  recipientId,
  recipientRole,
  senderId,
  senderName,
  type,
  title,
  message,
  projectId
) => {
  try {
    if (!recipientId) {
      return null;
    }

    const notification =
      await Notification.create({
        recipient: recipientId,
        recipientRole,
        sender: senderId || null,
        senderName: senderName || "",
        type,
        title,
        message,
        project: projectId,
      });

    return notification;
  } catch (error) {
    console.error("Create notification error:", error); throw error;
  }
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
        emailStage,
      } = req.query;

      // --------------------------------------------------------
      // BUILD MONGODB QUERY
      // --------------------------------------------------------

      const query = {};

      // ROLE-BASED ACCESS
      if (req.user.role === "pm") {
        query.pmEmail = String(req.user.email || "")
          .toLowerCase()
          .trim();
      } else if (req.user.role === "tl") {
        query.tlEmail = String(req.user.email || "")
          .toLowerCase()
          .trim();
      }

      // FILTERS
      if (type) {
        query.projectType = type;
      }

      if (stage) {
        query.projectStage = stage;
      }

      if (status) {
        query.status = status;
      }

      if (emailStage) {
        query.emailStage = emailStage;
      }

      if (search) {
        const searchText = String(search)
          .toLowerCase()
          .trim();

        query.$or = [
          {
            projectName: {
              $regex: searchText,
              $options: "i",
            },
          },
          {
            projectCode: {
              $regex: searchText,
              $options: "i",
            },
          },
          {
            subject: {
              $regex: searchText,
              $options: "i",
            },
          },
          {
            pmName: {
              $regex: searchText,
              $options: "i",
            },
          },
          {
            tlName: {
              $regex: searchText,
              $options: "i",
            },
          },
        ];
      }

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

      const skip =
        (pageNumber - 1) * limitNumber;

      // --------------------------------------------------------
      // QUERY MONGODB
      // --------------------------------------------------------

      const [projects, total] = await Promise.all([
        Project.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean({ virtuals: true }),
        Project.countDocuments(query),
      ]);

      return res.json({
        success: true,
        total,
        page: pageNumber,
        limit: limitNumber,
        data: projects.map(shape),
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
      const { id } = req.params;

      let project = null;

      // --------------------------------------------------------
      // SUPPORT BOTH MongoDB ObjectId AND string id
      // --------------------------------------------------------

      if (
        mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        project = await Project.findById(
          id
        ).lean({ virtuals: true });
      }

      // If not found by ObjectId, try string id match
      if (!project) {
        project = await Project.findOne({
          id: String(id),
        }).lean({ virtuals: true });
      }

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
  authorize("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        subject,
        mailDate,
        startDate,
        endDate,
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
      // CREATE PROJECT IN MONGODB
      // --------------------------------------------------------

      const now = new Date().toISOString();

      const projectData = {
        subject:
          typeof subject === "string"
            ? subject.trim()
            : "",

        mailDate:
          mailDate || null,

        startDate:
          startDate || null,

        endDate:
          endDate || null,

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
          projectStage || "Acknowledged",

        status:
          "Awaiting PM Review",

        // PM
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

        // TL
        tlId: "",
        tlEmail: "",
        tlName: "",
        tlInitials: "",
        assignedTL: "",
        assignedDate: null,

        // Details
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

        lastActivity: new Date(now),

        createdAt: new Date(now),
        updatedAt: new Date(now),
      };

      const createdProject =
        await Project.create(
          projectData
        );

      const populatedProject =
        await Project.findById(
          createdProject._id
        ).lean({ virtuals: true });

      // --------------------------------------------------------
      // CREATE NOTIFICATION FOR PM IF ASSIGNED
      // --------------------------------------------------------

      if (
        selectedPM &&
        String(selectedPM._id) !==
          String(req.user.id)
      ) {
        await createNotification(
          String(selectedPM._id),
          "pm",
          req.user.id,
          req.user.name ||
            req.user.email,
          "project_assigned",
          "New Project Assignment",
          `You have been assigned to project: ${
            populatedProject.projectName
          }`,
          createdProject._id
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Project created successfully",
        data: shape(populatedProject),
      });
    } catch (error) {
      console.error(
        "Create project error:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          success: false,
          message:
            error.message ||
            "Failed to create project",
        });
      }

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
  authorize("admin", "super_admin", "pm"),
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

      const { id } = req.params;

      let project = null;

      if (
        mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        project = await Project.findById(
          id
        );
      }

      if (!project) {
        project = await Project.findOne({
          id: String(id),
        });
      }

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
        new Date();

      project.lastActivity =
        new Date();

      project.updatedAt =
        new Date();

      project.assignmentPriority =
        assignmentPriority ||
        project.assignmentPriority ||
        "Normal";

      project.delegationNote =
        typeof delegationNote ===
        "string"
          ? delegationNote.trim()
          : project.delegationNote ||
            "";

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

      await project.save();

      const updated = await Project.findById(
        project._id
      ).lean({ virtuals: true });

      // --------------------------------------------------------
      // CREATE NOTIFICATION FOR TL
      // --------------------------------------------------------

      if (
        selectedTL &&
        String(selectedTL._id) !==
          String(req.user.id)
      ) {
        await createNotification(
          String(selectedTL._id),
          "tl",
          req.user.id,
          req.user.name ||
            req.user.email,
          "project_assigned",
          "New Project Assignment",
          `You have been assigned to project: ${
            updated.projectName
          }`,
          project._id
        );
      }

      return res.json({
        success: true,
        message:
          "TL assigned successfully",
        data: shape(updated),
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
      const { id } = req.params;

      let project = null;

      if (
        mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        project = await Project.findById(
          id
        );
      }

      if (!project) {
        project = await Project.findOne({
          id: String(id),
        });
      }

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
      // RESOLVE PM ASSIGNMENT
      // --------------------------------------------------------

      let newPM = null;

      if (Object.prototype.hasOwnProperty.call(update, "pm")) {
        if (update.pm) {
          const selectedPM = await findUserByIdOrEmail(
            update.pm,
            "pm"
          );

          if (!selectedPM) {
            return res.status(400).json({
              success: false,
              message:
                "PM not found or inactive",
            });
          }

          newPM = selectedPM;

          update.pmId = String(selectedPM._id);
          update.pmEmail = selectedPM.email || "";
          update.pmName = selectedPM.name || "";
          update.pmInitials = createInitials(selectedPM.name);

          delete update.pm;
        } else {
          update.pmId = "";
          update.pmEmail = "";
          update.pmName = "";
          update.pmInitials = "";

          delete update.pm;
        }
      }

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

      const now = new Date();

      const updateFields = {
        ...update,
        lastActivity: now,
      };

      Object.keys(updateFields).forEach(
        (key) => {
          if (
            key !== "_id" &&
            key !== "id" &&
            key !== "createdAt" &&
            key !== "updatedAt" &&
            key !== "__v"
          ) {
            project[key] =
              updateFields[key];
          }
        }
      );

      project.updatedAt = now;

      await project.save();

      const updated = await Project.findById(
        project._id
      ).lean({ virtuals: true });

      // --------------------------------------------------------
      // CREATE NOTIFICATION IF PM CHANGED
      // --------------------------------------------------------

      if (
        newPM &&
        String(newPM._id) !==
          String(req.user.id)
      ) {
        await createNotification(
          String(newPM._id),
          "pm",
          req.user.id,
          req.user.name ||
            req.user.email,
          "project_assigned",
          "New Project Assignment",
          `You have been assigned to project: ${
            updated.projectName
          }`,
          project._id
        );
      }

      return res.json({
        success: true,
        message:
          "Project updated successfully",
        data: shape(updated),
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
  authorize("admin", "super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      let deletedProject = null;

      if (
        mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        deletedProject =
          await Project.findByIdAndDelete(
            id
          );
      }

      if (!deletedProject) {
        deletedProject =
          await Project.findOneAndDelete({
            id: String(id),
          });
      }

      if (!deletedProject) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found",
        });
      }

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


