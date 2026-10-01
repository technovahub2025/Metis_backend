const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
    },
    url: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const RawMailSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      trim: true,
    },

    sender: {
      type: String,
      trim: true,
    },

    recipient: {
      type: String,
      trim: true,
    },

    receivedDate: {
      type: Date,
      default: Date.now,
    },

    projectName: {
      type: String,
      trim: true,
    },

    projectType: {
      type: String,
      enum: [
        "Residential",
        "Commercial",
        "Industrial",
        "Infrastructure",
      ],
      trim: true,
    },

    projectStage: {
      type: String,
      enum: [
        "Acknowledged",
        "Model/Quote sent",
        "Implementation",
        "Dropped",
        "Hold",
        "In Discussion - Inhouse",
        "In Discussion - Team",
        "Completed",
      ],
    },

    processingStatus: {
      type: String,
      default: "New",
      enum: [
        "New",
        "Processing",
        "Classified",
        "On Hold",
        "Completed",
      ],
      trim: true,
    },

    hasAttachment: {
      type: Boolean,
      default: false,
    },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    body: {
      type: String,
    },

    snippet: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "RawMail",
  RawMailSchema
);
