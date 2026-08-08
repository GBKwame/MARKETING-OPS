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
  organizations,
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function clean() {
  console.log("🧹 Cleaning multi-tenant database and establishing Super Admin & Client Accounts...");

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
  try { await db.delete(organizations); } catch {}
  try { await db.execute(sql`DROP TABLE IF EXISTS organizations`); } catch {}

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(128) NOT NULL UNIQUE,
      owner_email VARCHAR(255),
      owner_name VARCHAR(255),
      status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await db.execute(sql`ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'manager', 'marketer') NOT NULL DEFAULT 'marketer'`); } catch {}
  try { await db.execute(sql`ALTER TABLE invitations MODIFY COLUMN role ENUM('super_admin', 'admin', 'manager', 'marketer') NOT NULL`); } catch {}

  try { await db.execute(sql`ALTER TABLE users ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE campaigns ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE branches ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE invitations ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE activities ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE todos ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE approvals ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE assets ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE leads ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE company_links ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}
  try { await db.execute(sql`ALTER TABLE notifications ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch {}

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  // Insert Default Organization
  await db.insert(organizations).values({
    id: "org-default",
    name: "Carezza Growth Team",
    slug: "carezza",
    ownerEmail: "admin@carezza.com",
    ownerName: "Ama Boateng",
    status: "active",
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Super Admin Account (SaaS Platform Owner)
  await db.insert(users).values({
    id: "u-superadmin",
    organizationId: "org-default",
    name: "Platform Owner (Super Admin)",
    email: "superadmin@marketops.com",
    passwordHash,
    role: "super_admin",
    branchId: null,
    supervisorId: null,
    avatar: "SA",
  });

  // 2. Primary Client Admin Account
  await db.insert(users).values({
    id: "u-admin",
    organizationId: "org-default",
    name: "Ama Boateng",
    email: "admin@carezza.com",
    passwordHash,
    role: "admin",
    branchId: null,
    supervisorId: null,
    avatar: "AB",
  });

  console.log("✨ Clean Multi-Tenant Database Reset Completed!");
  console.log("🔑 Available Accounts (Password: Password123!):");
  console.log("   - 👑 Super Admin (SaaS Manager): superadmin@marketops.com");
  console.log("   - 🛡️ Client Admin (Carezza Workspace): admin@carezza.com");
}

clean().catch((err) => {
  console.error("❌ Cleaning failed:", err);
  process.exit(1);
});
