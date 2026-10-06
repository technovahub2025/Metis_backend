require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("./models/Notification");
const Project = require("./models/Project");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("Connected");
  
  const pmUser = await User.findOne({ email: "surya@metis.com" }).lean();
  const adminUser = await User.findOne({ email: "admin@metis.com" }).lean();

  // Create a project to get a valid ObjectId
  const testProj = await Project.findOne({ projectName: "Notification Test 2" }).lean();
  const projectId = testProj?._id;
  console.log("Project ID:", projectId);

  // Create notification directly
  try {
    const notif = await Notification.create({
      recipient: pmUser._id,
      recipientRole: "pm",
      sender: adminUser._id,
      senderName: "admin@metis.com",
      type: "project_assigned",
      title: "New Project Assignment",
      message: "You have been assigned to project: Test",
      project: projectId,
    });
    console.log("Notification created:", notif._id);
  } catch (e) {
    console.error("Notification error:", e.message);
    console.error("Stack:", e.stack);
  }

  const notifs = await Notification.find({}).lean();
  console.log("Total notifications:", notifs.length);
  notifs.forEach(n => console.log("  - recipient:", n.recipient, "| title:", n.title));

  await mongoose.disconnect();
  process.exit(0);
}).catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
