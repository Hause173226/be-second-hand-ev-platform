#!/usr/bin/env node

import mongoose from "mongoose";
import { User } from "./src/models/User";
import { migrationService } from "./src/services/migrationService";

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/second-hand-ev-platform"
    );
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Migration commands
const runMigration = async () => {
  const command = process.argv[2];

  switch (command) {
    case "migrate":
      console.log("Starting user migration...");
      await migrationService.migrateUserSchema();
      break;

    case "rollback":
      console.log("Starting user rollback...");
      await migrationService.rollbackUserSchema();
      break;

    case "check":
      console.log("Checking user data compatibility...");
      const users = await User.find({}).limit(5);
      console.log(
        "Sample users:",
        users.map((u) => ({
          id: u._id,
          email: u.email,
          phone: u.phone,
          roles: u.roles,
          status: u.status,
          legacyRole: u.role,
          legacyActive: u.isActive,
        }))
      );
      break;

    default:
      console.log("Usage: npm run migrate [migrate|rollback|check]");
      console.log("  migrate  - Migrate users to new schema");
      console.log("  rollback - Rollback to old schema");
      console.log("  check    - Check data compatibility");
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await runMigration();
  await mongoose.disconnect();
  console.log("Migration completed");
};

main().catch(console.error);
