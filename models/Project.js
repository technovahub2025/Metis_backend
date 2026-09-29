const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    projectCode: {
      type: String,
      trim: true,
    },

    projectType: {
      type: String,
      enum: [
        "RCC",
        "Steel",
        "Outsource",
        "TMC",
      ],
      trim: true,
    },

    subject: {
      type: String,
      trim: true,
    },

    mailDate: {
      type: Date,
    },

    emailStage: {
      type: String,
      enum: ["Sent", "Hold", "Draft", "Review"],
      trim: true,
    },

    projectStage: {
      type: String,
      enum: [
        "Planning",
        "Design",
        "Construction",
        "Execution",
        "Closure",
      ],
      default: "Planning",
    },

    status: {
      type: String,
      default: "Awaiting PM Review",
      trim: true,
    },

    // Temporary testing assignment fields
    pmEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    pmName: {
      type: String,
      trim: true,
    },

    pmInitials: {
      type: String,
      trim: true,
    },

    tlEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    tlName: {
      type: String,
      trim: true,
    },

    tlInitials: {
      type: String,
      trim: true,
    },

    assignedTL: {
      type: String,
      trim: true,
    },

    assignedDate: {
      type: Date,
    },

    location: {
      type: String,
      trim: true,
    },

    scope: {
      type: String,
      trim: true,
    },

    assignmentPriority: {
      type: String,
      default: "Normal",
      enum: ["Normal", "Urgent", "Critical"],
    },

    delegationNote: {
      type: String,
      trim: true,
    },

    lastActivity: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Project", ProjectSchema);