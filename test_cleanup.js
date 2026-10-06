const mongoose = require("mongoose");
require("./models/User");
const Notification = require("./models/Notification");
const Project = require("./models/Project");

mongoose.connect(
  process.env.MONGO_URI ||
    "mongodb+srv://technovahubcareer_db_user:techadmin123@clusterarun.z03bsdz.mongodb.net/metis"
).then(async () => {
  await Notification.deleteMany({});
  console.log("Notifications cleaned");

  await Project.deleteMany({
    projectName: {
      $in: [
        "Notification API Test",
        "Notification Test 2",
        "Test Persistence Project",
        "Updated Persistence Test",
      ],
    },
  });
  console.log("Test projects cleaned");

  const remaining = await Project.countDocuments({});
  console.log("Remaining projects:", remaining);

  const remainingNotifs =
    await Notification.countDocuments({});
  console.log("Remaining notifications:", remainingNotifs);

  await mongoose.disconnect();
  process.exit(0);
}).catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
