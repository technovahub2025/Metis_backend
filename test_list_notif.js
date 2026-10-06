const mongoose = require("mongoose");
require("./models/User");
const Notification = require("./models/Notification");
const User = require("./models/User");

mongoose.connect(
  process.env.MONGO_URI ||
    "mongodb+srv://technovahubcareer_db_user:techadmin123@clusterarun.z03bsdz.mongodb.net/metis"
).then(async () => {
  const notifs = await Notification.find({}).lean();
  console.log("Total notifications:", notifs.length);
  
  for (const n of notifs) {
    const recipientInfo = await User.findById(n.recipient).lean();
    const projectName = n.project;
    console.log(
      "  - recipient:", recipientInfo?.email,
      "| role:", n.recipientRole,
      "| title:", n.title,
      "| isRead:", n.isRead,
      "| createdAt:", n.createdAt
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
