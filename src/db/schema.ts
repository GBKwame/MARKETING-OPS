import {
  mysqlTable,
  varchar,
  text,
  longtext,
  int,
  boolean,
  datetime,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

export const roleEnum = mysqlEnum(["super_admin", "admin", "manager", "marketer"]);
export const todoStatusEnum = mysqlEnum(["todo", "in_progress", "done"]);
export const approvalStatusEnum = mysqlEnum(["draft", "pending", "approved", "rejected"]);
export const assetTypeEnum = mysqlEnum(["flyer", "video", "image", "text", "other"]);
export const leadStatusEnum = mysqlEnum(["new", "contacted", "qualified", "client"]);
export const notificationKindEnum = mysqlEnum(["activity", "todo", "approval"]);
export const campaignStatusEnum = mysqlEnum(["active", "paused", "completed"]);
export const invitationStatusEnum = mysqlEnum(["pending", "accepted", "revoked"]);
export const orgStatusEnum = mysqlEnum(["active", "suspended"]);
export const workspaceRequestStatusEnum = mysqlEnum(["pending", "approved", "rejected"]);

// --- Multi-Tenant SaaS Organizations ---
export const organizations = mysqlTable("organizations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  ownerEmail: varchar("owner_email", { length: 255 }),
  ownerName: varchar("owner_name", { length: 255 }),
  status: orgStatusEnum.notNull().default("active"),
  allowCrossBranchNotifications: boolean("allow_cross_branch_notifications").notNull().default(false),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Workspace Instance Requests (Pending Super Admin Approval) ---
export const workspaceRequests = mysqlTable("workspace_requests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationName: varchar("organization_name", { length: 255 }).notNull(),
  organizationSlug: varchar("organization_slug", { length: 128 }).notNull(),
  applicantUserId: varchar("applicant_user_id", { length: 64 }).notNull(),
  applicantEmail: varchar("applicant_email", { length: 255 }).notNull(),
  applicantName: varchar("applicant_name", { length: 255 }).notNull(),
  status: workspaceRequestStatusEnum.notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  processedByUserId: varchar("processed_by_user_id", { length: 64 }),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
  updatedAt: datetime("updated_at").$defaultFn(() => new Date()),
});

// --- Campaigns ---
export const campaigns = mysqlTable("campaigns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budget: int("budget").notNull().default(0),
  status: campaignStatusEnum.notNull().default("active"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Branches ---
export const branches = mysqlTable("branches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Users (Super Admin, Admin, Manager, Marketer) ---
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 128 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum.notNull().default("marketer"),
  branchId: varchar("branch_id", { length: 64 }),
  campaignId: varchar("campaign_id", { length: 64 }),
  supervisorId: varchar("supervisor_id", { length: 64 }),
  avatar: varchar("avatar", { length: 16 }),
  picture: text("picture"),
  invitationStatus: mysqlEnum("invitation_status", ["pending", "accepted", "revoked"]).notNull().default("accepted"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Team Invitations ---
export const invitations = mysqlTable("invitations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 128 }),
  role: roleEnum.notNull(),
  campaignId: varchar("campaign_id", { length: 64 }),
  branchId: varchar("branch_id", { length: 64 }),
  invitedById: varchar("invited_by_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  status: mysqlEnum("status", ["pending", "accepted", "revoked"]).notNull().default("pending"),
  token: varchar("token", { length: 128 }).notNull(),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Marketing Activities ---
export const activities = mysqlTable("activities", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  campaign: varchar("campaign", { length: 255 }).notNull(),
  channel: varchar("channel", { length: 128 }).notNull(),
  approach: varchar("approach", { length: 128 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  memberId: varchar("member_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  branchId: varchar("branch_id", { length: 64 }),
  date: datetime("date").notNull(),
  proofUrl: longtext("proof_url").notNull(),
  publishedLink: text("published_link"),
  cost: int("cost").notNull().default(0),
  leadsCount: int("leads_count").notNull().default(0),
  clientsCount: int("clients_count").notNull().default(0),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- To-Do Tasks ---
export const todos = mysqlTable("todos", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  title: varchar("title", { length: 255 }).notNull(),
  assigneeId: varchar("assignee_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  createdById: varchar("created_by_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  dueDate: datetime("due_date").notNull(),
  status: todoStatusEnum.notNull().default("todo"),
  notes: text("notes"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Approvals (Sign-off queue) ---
export const approvals = mysqlTable("approvals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  title: varchar("title", { length: 255 }).notNull(),
  type: assetTypeEnum.notNull().default("image"),
  submittedById: varchar("submitted_by_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  reviewerId: varchar("reviewer_id", { length: 64 }).references(() => users.id),
  previewUrl: longtext("preview_url").notNull(),
  description: text("description").notNull(),
  status: approvalStatusEnum.notNull().default("pending"),
  submittedAt: datetime("submitted_at").$defaultFn(() => new Date()),
  reviewedAt: datetime("reviewed_at"),
});

// --- Asset Vault ---
export const assets = mysqlTable("assets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  approvalId: varchar("approval_id", { length: 64 }).references(() => approvals.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: assetTypeEnum.notNull().default("image"),
  previewUrl: longtext("preview_url").notNull(),
  category: varchar("category", { length: 64 }).notNull().default("General"),
  version: varchar("version", { length: 32 }).notNull().default("v1.0"),
  body: text("body"),
  fileUrl: longtext("file_url"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Leads & Attribution ---
export const leads = mysqlTable("leads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  name: varchar("name", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 128 }).notNull(),
  campaign: varchar("campaign", { length: 255 }),
  channel: varchar("channel", { length: 128 }),
  approach: varchar("approach", { length: 128 }),
  destination: varchar("destination", { length: 255 }),
  activityId: varchar("activity_id", { length: 64 }).references(() => activities.id),
  assignedToId: varchar("assigned_to_id", { length: 64 }).references(() => users.id),
  branchId: varchar("branch_id", { length: 64 }).references(() => branches.id),
  status: leadStatusEnum.notNull().default("new"),
  value: int("value").notNull().default(0),
  notes: text("notes"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});

// --- Company Links ---
export const companyLinks = mysqlTable("company_links", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  platform: varchar("platform", { length: 64 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  url: text("url"),
  handle: varchar("handle", { length: 128 }),
  category: varchar("category", { length: 64 }).notNull(),
});

// --- Notifications ---
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull().default("org-default"),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  kind: notificationKindEnum.notNull().default("activity"),
  createdAt: datetime("created_at").$defaultFn(() => new Date()),
});
