const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 1,
    },

    role: {
      type: String,
      enum: ["admin", "pm", "tl"],
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| NORMALIZE EMAIL
|--------------------------------------------------------------------------
*/

userSchema.pre("validate", async function () {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }
});

/*
|--------------------------------------------------------------------------
| HASH PASSWORD
|--------------------------------------------------------------------------
|
| Automatically hashes a newly created or changed password.
|
| Existing bcrypt hashes are not hashed again.
|
*/

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  if (
    typeof this.password === "string" &&
    /^\$2[aby]\$\d{2}\$/.test(this.password)
  ) {
    return;
  }

  this.password = await bcrypt.hash(
    this.password,
    12
  );
});

/*
|--------------------------------------------------------------------------
| PASSWORD CHECK
|--------------------------------------------------------------------------
*/

userSchema.methods.comparePassword = function (
  password
) {
  return bcrypt.compare(
    password,
    this.password
  );
};

module.exports = mongoose.model(
  "User",
  userSchema
);