import { db } from "./index";
import {
  activities,
  leads,
  todos,
  approvals,
  assets,
  notifications,
  companyLinks,
  campaigns,
  users,
  branches,
  invitations,
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function clean() {
  console.log("🧹 Cleaning activity data and establishing 3-Tier User Hierarchy in MySQL...");

  // Disable foreign key checks for bulk deletion
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

  await db.delete(leads);
  await db.delete(activities);
  try { await db.delete(invitations); } catch {}
  await db.delete(todos);
  await db.delete(assets);
  await db.delete(approvals);
  await db.delete(notifications);
  await db.delete(companyLinks);
  await db.delete(campaigns);
  await db.delete(users);
  await db.delete(branches);

  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN campaign VARCHAR(255)`); } catch {}
  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN channel VARCHAR(128)`); } catch {}
  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN approach VARCHAR(128)`); } catch {}
  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN destination VARCHAR(255)`); } catch {}
  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN branch_id VARCHAR(64)`); } catch {}
  try { await db.execute(sql`ALTER TABLE users ADD COLUMN campaign_id VARCHAR(64)`); } catch {}
  try { await db.execute(sql`ALTER TABLE users ADD COLUMN picture TEXT`); } catch {}
  try { await db.execute(sql`ALTER TABLE users ADD COLUMN invitation_status ENUM('pending', 'accepted', 'revoked') DEFAULT 'accepted'`); } catch {}

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invitations (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(128),
        role ENUM('admin', 'manager', 'marketer') NOT NULL,
        campaign_id VARCHAR(64),
        branch_id VARCHAR(64),
        invited_by_id VARCHAR(64) NOT NULL,
        status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
        token VARCHAR(128) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {}

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Initial Clean Super Admin
  await db.insert(users).values({
    id: "u-admin",
    name: "Ama Boateng",
    email: "admin@carezza.com",
    passwordHash,
    role: "admin",
    branchId: null,
    supervisorId: null,
    avatar: "AB",
  });

  console.log("✨ Clean Database Reset Completed!");
  console.log("🔑 Primary Admin Account (Password: Password123!):");
  console.log("   - 🛡️ Admin: admin@carezza.com");
}

clean().catch((err) => {
  console.error("❌ Cleaning failed:", err);
  process.exit(1);
});
