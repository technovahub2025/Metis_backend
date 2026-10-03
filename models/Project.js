
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
      enum: ["RCC", "Steel", "Outsource", "PMC"],
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
      enum: [
        "Sent to Client",
        "Acknowledgement",
        "In Discussion",
        "Sent by IT",
        "Hold",
        "Waiting for IC/IT",
      ],
      trim: true,
    },

    projectStage: {
      type: String,
      enum: [
        "Acknowledgement",
        "Model/Quote sent",
        "Implementation",
        "Dropped",
        "Hold",
        "In Discussion - Inhouse",
        "In Discussion - Team",
        "Completed",
      ],
      default: "Acknowledgement",
    },

    status: {
      type: String,
      default: "Awaiting PM Review",
      trim: true,
    },

    // PM assignment fields
    pmId: {
      type: String,
      trim: true,
    },

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

    // TL assignment fields
    tlId: {
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