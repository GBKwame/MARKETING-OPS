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
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function clean() {
  console.log("🧹 Cleaning activity data and establishing 3-Tier User Hierarchy in MySQL...");

  // Disable foreign key checks for bulk deletion
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

  await db.delete(leads);
  await db.delete(activities);
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

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Branches (Start clean - 0 branches)
  // Branches are managed dynamically from Settings

  // 2. Super Admin (Supervises Managers)
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

  // 3. Manager (Supervised by Admin, Supervises Team Members)
  await db.insert(users).values({
    id: "u-mgr-accra",
    name: "Kwame Mensah",
    email: "manager.accra@carezza.com",
    passwordHash,
    role: "manager",
    branchId: null,
    supervisorId: "u-admin",
    avatar: "KM",
  });

  // 4. Marketer (Supervised by Manager)
  await db.insert(users).values({
    id: "u-tm-efua",
    name: "Efua Owusu",
    email: "efua@carezza.com",
    passwordHash,
    role: "marketer",
    branchId: null,
    supervisorId: "u-mgr-accra",
    avatar: "EO",
  });

  console.log("✨ 3-Tier User Hierarchy Ready in MySQL!");
  console.log("🔑 Default Credentials (Password: Password123!):");
  console.log("   - 🛡️ Admin:       admin@carezza.com");
  console.log("   - 👔 Manager:     manager.accra@carezza.com");
  console.log("   - 👤 Marketer:    efua@carezza.com");
}

clean().catch((err) => {
  console.error("❌ Cleaning failed:", err);
  process.exit(1);
});
