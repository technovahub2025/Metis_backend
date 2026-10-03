require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
    if (!process.env.SUPER_ADMIN_EMAIL) throw new Error("SUPER_ADMIN_EMAIL is missing");
    if (!process.env.SUPER_ADMIN_PASSWORD) throw new Error("SUPER_ADMIN_PASSWORD is missing");

    await mongoose.connect(process.env.MONGO_URI);

    const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: "METIS Super Admin",
          email,
          password: hashedPassword,
          role: "super_admin",
          active: true
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    console.log("====================================");
    console.log("SUPER ADMIN CREATED/SYNCHRONIZED");
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Active:", user.active);
    console.log("====================================");

    await mongoose.disconnect();
  } catch (error) {
    console.error("SUPER ADMIN SETUP FAILED:");
    console.error(error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
})();
