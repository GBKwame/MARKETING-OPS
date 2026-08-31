import dotenv from "dotenv";
dotenv.config();
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db } from "../src/db/index";
import {
  users,
  branches,
  campaigns,
  activities,
  todos,
  approvals,
  assets,
  leads,
  companyLinks,
  notifications,
  organizations,
  workspaceRequests,
} from "../src/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jwtDecode } from "jwt-decode";
import {
  createSessionToken,
  verifySessionToken,
  buildSessionCookie,
  buildClearSessionCookie,
  getSessionFromCookieHeader,
} from "../src/functions/session";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Drop legacy unique constraint on company_links to support multiple accounts per platform
db.execute(sql`ALTER TABLE company_links DROP INDEX company_links_platform_unique`).catch(() => {});
db.execute(sql`ALTER TABLE users ADD COLUMN phone VARCHAR(128)`).catch(() => {});

async function isOrgSuspended(organizationId?: string | null, role?: string): Promise<boolean> {
  if (role === "super_admin") return false;
  if (!organizationId) return false;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  return org?.status === "suspended";
}

// Helper for session extraction
async function getAuthUser(req: express.Request) {
  const cookieHeader = req.headers.cookie || null;
  const token = getSessionFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return null;

  const [u] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!u) return null;

  // Check if organization is suspended (super_admin bypasses)
  if (u.role !== "super_admin" && u.organizationId) {
    const suspended = await isOrgSuspended(u.organizationId, u.role);
    if (suspended) return null;
  }

  return u;
}

async function formatUserWithOrg(u: any) {
  if (!u) return null;
  const { passwordHash: _, ...cleaned } = u;
  const targetOrgId = u.organizationId || "org-default";
  const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId));
  return {
    ...cleaned,
    organizationName: org?.name || "Carezza Growth Team",
    organizationSlug: org?.slug || "carezza",
  };
}

// ------------------------------------------------------------------
// AUTH & REGISTRATION ROUTES
// ------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [u] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (!u || !u.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, u.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if organization is suspended
    if (await isOrgSuspended(u.organizationId, u.role)) {
      return res.status(403).json({
        error: "This organization workspace has been suspended by the platform administrator. Please contact support.",
      });
    }

    // Auto-accept invitation if pending
    if (u.invitationStatus === "pending") {
      await db.update(users).set({ invitationStatus: "accepted" }).where(eq(users.id, u.id));
      await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.email, cleanEmail));
      u.invitationStatus = "accepted";
    }

    const token = await createSessionToken({
      userId: u.id,
      email: u.email,
      role: u.role as any,
      branchId: u.branchId,
      supervisorId: u.supervisorId,
    });

    const cookieHeader = buildSessionCookie(token);
    res.setHeader("Set-Cookie", cookieHeader);

    const formattedUser = await formatUserWithOrg(u);
    return res.json({ user: formattedUser, token });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential, email: rawEmail, name: rawName, picture: rawPicture } = req.body;
    let email = rawEmail;
    let name = rawName;
    let picture = rawPicture;

    if (credential) {
      try {
        const decoded: any = jwtDecode(credential);
        email = decoded.email;
        name = decoded.name;
        picture = decoded.picture;
      } catch (e: any) {
        console.error("JWT Decode error:", e.message);
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Valid Google email is required." });
    }

    const { token: inviteToken, orgId } = req.body || {};
    const cleanEmail = email.toLowerCase().trim();
    let [u] = await db.select().from(users).where(eq(users.email, cleanEmail));

    if (u && (await isOrgSuspended(u.organizationId, u.role))) {
      return res.status(403).json({
        error: "This organization workspace has been suspended by the platform administrator. Please contact support.",
      });
    }

    // Look up invitation by token first, then by email
    let [inv] = inviteToken
      ? await db.select().from(invitations).where(eq(invitations.token, inviteToken))
      : [];
    if (!inv && cleanEmail) {
      [inv] = await db.select().from(invitations).where(eq(invitations.email, cleanEmail));
    }

    const assignedRole = inv?.role || "admin";
    const assignedOrgId = inv?.organizationId || orgId || "org-default";
    const assignedBranchId = inv?.branchId || null;
    const assignedCampaignId = inv?.campaignId || null;
    const assignedSupervisorId = inv?.invitedById || null;

    if (!u) {
      const finalRole = assignedRole;

      const userId = "u-" + Date.now();
      const userName = name || email.split("@")[0];
      const avatar = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
      const passwordHash = await bcrypt.hash("GoogleOAuthUserPassword123!", 10);

      const newUser = {
        id: userId,
        organizationId: assignedOrgId,
        name: userName,
        email: cleanEmail,
        passwordHash,
        role: finalRole,
        branchId: assignedBranchId,
        campaignId: assignedCampaignId,
        supervisorId: assignedSupervisorId,
        avatar,
        picture: picture || null,
        invitationStatus: "accepted" as const,
        createdAt: new Date(),
      };

      await db.insert(users).values(newUser);
      if (inv) {
        await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
        if (inv.role === "admin") {
          await db.update(organizations).set({ ownerEmail: cleanEmail, ownerName: userName }).where(eq(organizations.id, inv.organizationId));
        }
      }
      [u] = await db.select().from(users).where(eq(users.id, userId));
    } else {
      // Update name, picture, role, and organizationId if accepting an invite
      const updateData: any = {};
      if (picture) updateData.picture = picture;
      if (name && (!u.name || u.name === u.email.split("@")[0])) updateData.name = name;
      if (u.invitationStatus === "pending") updateData.invitationStatus = "accepted";

      if (inv) {
        updateData.role = inv.role;
        updateData.organizationId = inv.organizationId;
        if (inv.branchId) updateData.branchId = inv.branchId;
        if (inv.campaignId) updateData.campaignId = inv.campaignId;
        await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
        if (inv.role === "admin") {
          await db.update(organizations).set({ ownerEmail: cleanEmail, ownerName: u.name || name || cleanEmail }).where(eq(organizations.id, inv.organizationId));
        }
      } else if (orgId && u.organizationId === "org-default") {
        updateData.organizationId = orgId;
        updateData.role = "admin";
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, u.id));
        [u] = await db.select().from(users).where(eq(users.id, u.id));
      }
    }

    const sessionToken = await createSessionToken({
      userId: u.id,
      email: u.email,
      role: u.role as any,
      branchId: u.branchId,
      supervisorId: u.supervisorId,
    });

    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
    const formattedUser = await formatUserWithOrg(u);
    return res.json({ user: formattedUser, token: sessionToken });
  } catch (err: any) {
    console.error("Google auth error:", err);
    return res.status(500).json({ error: err.message || "Failed to authenticate with Google." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, token: inviteToken, orgId } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, cleanEmail));

    if (existingUser && existingUser.invitationStatus === "accepted") {
      return res.status(400).json({ error: "An account with this email already exists. Please sign in." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Look up invitation by token first, then by email
    let [inv] = inviteToken
      ? await db.select().from(invitations).where(eq(invitations.token, inviteToken))
      : [];
    if (!inv && cleanEmail) {
      [inv] = await db.select().from(invitations).where(eq(invitations.email, cleanEmail));
    }

    // Case 1: Pending user record already exists (created during invite)
    if (existingUser && existingUser.invitationStatus === "pending") {
      const updateData: any = {
        name: name.trim(),
        passwordHash,
        invitationStatus: "accepted",
      };

      if (inv) {
        updateData.role = inv.role;
        updateData.organizationId = inv.organizationId;
        if (inv.branchId) updateData.branchId = inv.branchId;
        if (inv.campaignId) updateData.campaignId = inv.campaignId;
      } else if (orgId) {
        updateData.organizationId = orgId;
        updateData.role = "admin";
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id));

      if (inv) {
        await db
          .update(invitations)
          .set({ status: "accepted" })
          .where(eq(invitations.id, inv.id));

        if (inv.role === "admin") {
          await db
            .update(organizations)
            .set({ ownerEmail: cleanEmail, ownerName: name.trim() })
            .where(eq(organizations.id, inv.organizationId));
        }
      }

      const [updatedUser] = await db.select().from(users).where(eq(users.id, existingUser.id));
      const sessionToken = await createSessionToken({
        userId: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role as any,
        branchId: updatedUser.branchId,
        supervisorId: updatedUser.supervisorId,
      });

      res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
      const formattedUser = await formatUserWithOrg(updatedUser);
      return res.json({ user: formattedUser, token: sessionToken });
    }

    // Case 2: New user registering from invitation or self-registering
    const allUsers = await db.select().from(users);
    const isFirstUser = allUsers.length === 0;

    let assignedRole: "super_admin" | "admin" | "manager" | "marketer" = inv?.role || "admin";
    let assignedOrgId = inv?.organizationId || orgId || "org-default";
    let assignedBranchId: string | null = inv?.branchId || null;
    let assignedCampaignId: string | null = inv?.campaignId || null;
    let assignedSupervisorId: string | null = inv?.invitedById || null;

    if (inv) {
      await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
      if (inv.role === "admin") {
        await db.update(organizations).set({ ownerEmail: cleanEmail, ownerName: name.trim() }).where(eq(organizations.id, inv.organizationId));
      }
    }

    const userId = "u-" + Date.now();
    const avatar = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    const newUser = {
      id: userId,
      organizationId: assignedOrgId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      branchId: assignedBranchId,
      campaignId: assignedCampaignId,
      supervisorId: assignedSupervisorId,
      avatar,
      invitationStatus: "accepted" as const,
      createdAt: new Date(),
    };

    await db.insert(users).values(newUser);

    const sessionToken = await createSessionToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role as any,
      branchId: newUser.branchId,
      supervisorId: newUser.supervisorId,
    });

    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
    const formattedUser = await formatUserWithOrg(newUser);
    return res.json({ user: formattedUser, token: sessionToken });
  } catch (err: any) {
    console.error("Register error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.get("/api/invitations/verify", async (req, res) => {
  try {
    const rawEmail = (req.query.email as string) || "";
    const cleanEmail = rawEmail.toLowerCase().trim();

    if (!cleanEmail) {
      return res.json({ exists: false });
    }

    const [pendingUser] = await db.select().from(users).where(eq(users.email, cleanEmail));
    const [inv] = await db.select().from(invitations).where(eq(invitations.email, cleanEmail));

    if (!pendingUser && !inv) {
      return res.json({ exists: false, userExists: false });
    }

    const userExists = pendingUser ? pendingUser.invitationStatus === "accepted" : false;
    const targetBranchId = pendingUser?.branchId || inv?.branchId || null;
    const targetCampaignId = pendingUser?.campaignId || inv?.campaignId || null;

    const [bObj] = targetBranchId
      ? await db.select().from(branches).where(eq(branches.id, targetBranchId))
      : [null];
    const [cObj] = targetCampaignId
      ? await db.select().from(campaigns).where(eq(campaigns.id, targetCampaignId))
      : [null];

    return res.json({
      exists: true,
      userExists,
      name: pendingUser?.name || "",
      email: cleanEmail,
      role: pendingUser?.role || inv?.role || "marketer",
      branchName: bObj?.name || "Workspace HQ",
      campaignName: cObj?.name || "General Campaign",
      invitationStatus: pendingUser?.invitationStatus || inv?.status || "pending",
    });
  } catch (err: any) {
    console.error("Verify invitation error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildClearSessionCookie());
  return res.json({ success: true });
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.json({ user: null });
    const formatted = await formatUserWithOrg(user);
    return res.json({ user: formatted });
  } catch (err) {
    return res.json({ user: null });
  }
});

// ------------------------------------------------------------------
// USERS / MEMBERS
// ------------------------------------------------------------------
app.get("/api/users", async (_req, res) => {
  try {
    const rows = await db.select().from(users);
    const cleaned = rows.map(({ passwordHash: _, ...u }) => u);
    return res.json(cleaned);
  } catch (err: any) {
    console.error("Get users error:", err);
    return res.status(500).json({ error: err.message });
  }
});

import nodemailer from "nodemailer";
import { invitations } from "../src/db/schema";

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "test@marketops.com",
    pass: process.env.SMTP_PASS || "testpass",
  },
});

function getCleanOrigin(req: express.Request): string {
  const rawOrigin = req.get("origin") || req.get("referer");
  if (rawOrigin) {
    try {
      const url = new URL(rawOrigin);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return `http://${url.host}`;
      }
      return url.origin;
    } catch {}
  }
  const host = req.get("host") || "localhost:8080";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}`;
  }
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

// ------------------------------------------------------------------
// SAAS MULTI-TENANT ORGANIZATIONS (SUPER ADMIN ONLY)
// ------------------------------------------------------------------
app.get("/api/organizations", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can manage SaaS client instances." });
    }

    const allOrgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const allUsers = await db.select().from(users);
    const allLeads = await db.select().from(leads);
    const allInvs = await db.select().from(invitations);

    const formatted = allOrgs.map((org) => {
      const orgUsers = allUsers.filter((u) => u.organizationId === org.id);
      const orgLeads = allLeads.filter((l) => l.organizationId === org.id);

      // Find actual Workspace Admin for this organization
      const adminUser = orgUsers.find((u) => u.role === "admin");
      const adminInv = allInvs.find((i) => i.organizationId === org.id && i.role === "admin");

      const displayEmail = adminUser?.email || adminInv?.email || org.ownerEmail;
      const displayName = adminUser ? adminUser.name : (adminInv?.status === "accepted" ? "Active Admin" : org.ownerName);

      return {
        ...org,
        ownerEmail: displayEmail,
        ownerName: displayName,
        userCount: orgUsers.length,
        leadCount: orgLeads.length,
      };
    });

    return res.json(formatted);
  } catch (err: any) {
    console.error("Get organizations error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/organizations", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can create client instances." });
    }

    const { name, slug: rawSlug, adminEmail } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Client Organization Name is required." });
    if (!adminEmail || !adminEmail.trim()) return res.status(400).json({ error: "Client Admin Email is required." });

    const cleanEmail = adminEmail.toLowerCase().trim();
    const slug = (rawSlug || name).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const orgId = "org-" + Date.now();

    const newOrg = {
      id: orgId,
      name: name.trim(),
      slug,
      ownerEmail: cleanEmail,
      ownerName: "Pending Signup",
      status: "active" as const,
      createdAt: new Date(),
    };

    await db.insert(organizations).values(newOrg);

    // Create an invite token for the client admin
    const inviteToken = "inv-" + Date.now() + Math.random().toString(36).substring(2, 8);
    await db.insert(invitations).values({
      id: "inv-" + Date.now(),
      organizationId: orgId,
      email: cleanEmail,
      role: "admin",
      invitedById: authUser.id,
      status: "pending",
      token: inviteToken,
      createdAt: new Date(),
    });

    const origin = getCleanOrigin(req);
    const inviteUrl = `${origin}/register?orgId=${orgId}&token=${inviteToken}`;

    // Send automated email via SMTP if configured
    let emailSent = false;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpPort = parseInt(process.env.SMTP_PORT || "465");
      const isSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : smtpPort === 465;

      const dynamicTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: isSecure,
        family: 4,
        lookup: (hostname: string, opts: any, cb: any) => dns.lookup(hostname, { family: 4 }, cb),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 15000,
      } as any);

      const mailOptions = {
        from: process.env.SMTP_FROM || `"Zexpand SaaS" <${process.env.SMTP_USER || "no-reply@zexpand.app"}>`,
        to: cleanEmail,
        subject: `🚀 Welcome to Zexpand — Your Workspace Instance for ${name.trim()} is Ready!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0;">Zexpand SaaS</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Client Workspace Instance Provisioned</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="font-size: 15px; color: #334155;">Hello,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Your new Zexpand workspace instance for <strong>${name.trim()}</strong> (<code>${slug}.zexpand.app</code>) has been successfully created!
            </p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Click the button below to complete your registration as the Workspace Admin:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                Accept & Register Admin Workspace
              </a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
              Direct Link: <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              Zexpand SaaS — Isolated Workspace Management
            </p>
          </div>
        `,
      };

      try {
        await dynamicTransporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`✉️ Automated SaaS provision email sent to ${cleanEmail}`);
      } catch (smtpErr: any) {
        console.error("❌ SaaS Email Delivery Error:", smtpErr.message || smtpErr);
      }
    }

    return res.json({
      organization: newOrg,
      inviteToken,
      inviteUrl,
      emailSent,
    });
  } catch (err: any) {
    console.error("Create organization error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/organizations/:id/status", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can update instance status." });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!org) return res.status(404).json({ error: "Organization instance not found." });

    await db.update(organizations).set({ status }).where(eq(organizations.id, id));

    // Send automated email to client admin about status change
    let emailSent = false;
    const targetEmail = org.ownerEmail;

    if (targetEmail && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const isSuspended = status === "suspended";
      const subject = isSuspended
        ? `⚠️ Important Notice: Zexpand Workspace [${org.name}] Suspended`
        : `✅ Workspace Reactivated: Zexpand [${org.name}] is Active`;

      const html = isSuspended
        ? `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <h2 style="color: #dc2626; margin-top: 0;">Workspace Suspended</h2>
            <p style="color: #334155; font-size: 15px;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              Please be advised that your Zexpand workspace <strong>${org.name}</strong> (<code>${org.slug}.zexpand.app</code>) has been <strong>suspended</strong> by the platform administrator.
            </p>
            <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
              All team members under this workspace will be temporarily unable to log in until reactivated. If you believe this is an error, please reach out to platform support.
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Zexpand SaaS Management</p>
          </div>
        `
        : `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #d1fae5; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <h2 style="color: #059669; margin-top: 0;">Workspace Reactivated</h2>
            <p style="color: #334155; font-size: 15px;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              Great news! Your Zexpand workspace <strong>${org.name}</strong> (<code>${org.slug}.zexpand.app</code>) has been <strong>reactivated</strong>.
            </p>
            <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
              You and your team can now log back in and resume full operations.
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Zexpand SaaS Management</p>
          </div>
        `;

      const dynamicTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "465"),
        secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : parseInt(process.env.SMTP_PORT || "465") === 465,
        family: 4,
        lookup: (hostname: string, opts: any, cb: any) => dns.lookup(hostname, { family: 4 }, cb),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      } as any);

      try {
        await dynamicTransporter.sendMail({
          from: process.env.SMTP_FROM || `"Zexpand SaaS" <${process.env.SMTP_USER}>`,
          to: targetEmail,
          subject,
          html,
        });
        emailSent = true;
        console.log(`✉️ Automated workspace ${status} notification email sent to ${targetEmail}`);
      } catch (smtpErr: any) {
        console.error("❌ Status Email Delivery Error:", smtpErr.message || smtpErr);
      }
    }

    return res.json({ success: true, status, emailSent });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// BRANCHES & CAMPAIGNS (ADMIN ONLY CREATION)
// ------------------------------------------------------------------
app.get("/api/branches", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    const rows = user?.role === "super_admin"
      ? await db.select().from(branches)
      : await db.select().from(branches).where(eq(branches.organizationId, orgId));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/branches", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin can create branches." });
    }

    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: "Branch name is required." });

    const newBranch = {
      id: "b-" + Date.now(),
      organizationId: user.organizationId || "org-default",
      name,
      location: location || null,
      createdAt: new Date(),
    };
    await db.insert(branches).values(newBranch);
    return res.json(newBranch);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/branches/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin can delete branches." });
    }

    const { id } = req.params;
    await db.delete(branches).where(eq(branches.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/branches/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin can edit branches." });
    }

    const { id } = req.params;
    const { name, location } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;

    await db.update(branches).set(updateData).where(eq(branches.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/campaigns", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    const rows = user?.role === "super_admin"
      ? await db.select().from(campaigns)
      : await db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
    return res.json(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        budget: c.budget ?? 0,
        status: c.status ?? "active",
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin can create campaigns." });
    }

    const { name, description, budget } = req.body;
    if (!name) return res.status(400).json({ error: "Campaign name is required." });

    const newCamp = {
      id: "c-" + Date.now(),
      organizationId: user.organizationId || "org-default",
      name,
      description: description || null,
      budget: Number(budget) || 0,
      status: "active" as const,
    };
    await db.insert(campaigns).values(newCamp);
    return res.json(newCamp);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// TEAM MANAGEMENT & INVITATIONS
// ------------------------------------------------------------------
app.get("/api/team", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    const orgId = authUser?.organizationId || "org-default";
    const allUsers = authUser?.role === "super_admin"
      ? await db.select().from(users)
      : await db.select().from(users).where(eq(users.organizationId, orgId));
    const allBranches = await db.select().from(branches);
    const allCampaigns = await db.select().from(campaigns);
    const allInvitations = await db.select().from(invitations);
    const inviteMap = new Map(allInvitations.map((i) => [i.email.toLowerCase(), i]));

    const formatted = allUsers.map((u) => {
      const bObj = allBranches.find((br) => br.id === u.branchId);
      const cObj = allCampaigns.find((c) => c.id === u.campaignId);
      const invObj = inviteMap.get(u.email.toLowerCase());
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || invObj?.phone || null,
        role: u.role,
        invitationStatus: u.invitationStatus || "accepted",
        branchId: u.branchId,
        branchName: bObj?.name || (u.role === "admin" ? "Workspace HQ" : "Default Branch"),
        campaignId: u.campaignId,
        campaignName: cObj?.name || (u.role === "admin" ? "All Campaigns" : "General Campaign"),
        supervisorId: u.supervisorId,
        avatar: u.avatar || u.name.substring(0, 2).toUpperCase(),
        picture: u.picture || null,
        createdAt: u.createdAt,
      };
    });

    // Scope by role:
    if (!authUser || authUser.role === "admin") {
      return res.json(formatted);
    }

    if (authUser.role === "manager") {
      // Manager sees marketers assigned to them / their branch/campaign, plus themselves
      const scoped = formatted.filter(
        (m) =>
          m.id === authUser.id ||
          m.role === "marketer" &&
          (m.supervisorId === authUser.id ||
            m.branchId === authUser.branchId ||
            m.campaignId === authUser.campaignId)
      );
      return res.json(scoped);
    }

    // Marketer sees their supervisor and themselves
    const scoped = formatted.filter(
      (m) => m.id === authUser.id || m.id === authUser.supervisorId
    );
    return res.json(scoped);
  } catch (err: any) {
    console.error("Get team error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/team/invite", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "manager")) {
      return res.status(403).json({ error: "Unauthorized to invite team members." });
    }

    const { name, email, phone, role, campaignId, branchId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email.trim()));
    if (existing) {
      return res.status(400).json({ error: "A member with this email address already exists in the workspace." });
    }

    const targetRole = role || "marketer";

    // Permission check: Manager can only invite Marketers
    if (authUser.role === "manager" && targetRole !== "marketer") {
      return res.status(403).json({ error: "Managers can only invite Marketers." });
    }

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const userId = "u-" + Date.now();
    const avatar = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);

    const targetBranchId = (branchId && branchId.trim()) || (authUser.branchId && authUser.branchId.trim()) || null;
    const targetCampaignId = (campaignId && campaignId.trim()) || (authUser.campaignId && authUser.campaignId.trim()) || null;
    const rawSupervisor = authUser.role === "manager" ? authUser.id : authUser.supervisorId;
    const targetSupervisorId = (rawSupervisor && rawSupervisor.trim()) || null;

    const userOrgId = authUser.organizationId || "org-default";

    // Create user with status 'pending'
    const newUser = {
      id: userId,
      organizationId: userOrgId,
      name,
      email,
      phone: phone ? phone.trim() : null,
      passwordHash,
      role: targetRole,
      branchId: targetBranchId ? targetBranchId : null,
      campaignId: targetCampaignId ? targetCampaignId : null,
      supervisorId: targetSupervisorId ? targetSupervisorId : null,
      avatar,
      invitationStatus: "pending" as const,
      createdAt: new Date(),
    };

    await db.insert(users).values(newUser);

    // Record in invitations table
    const inviteId = "inv-" + Date.now();
    const inviteToken = "inv-" + Date.now() + Math.random().toString(36).substring(2, 8);
    await db.insert(invitations).values({
      id: inviteId,
      organizationId: userOrgId,
      email,
      phone: phone || null,
      role: targetRole,
      campaignId: newUser.campaignId,
      branchId: newUser.branchId,
      invitedById: authUser.id,
      status: "pending",
      token: inviteToken,
      createdAt: new Date(),
    });

    // Lookup names
    const [bObj] = newUser.branchId ? await db.select().from(branches).where(eq(branches.id, newUser.branchId)) : [null];
    const [cObj] = newUser.campaignId ? await db.select().from(campaigns).where(eq(campaigns.id, newUser.campaignId)) : [null];

    const branchName = bObj?.name || "Default HQ";
    const campaignName = cObj?.name || "General Campaign";

    // Build Email & Nodemailer SMTP dispatch
    const origin = getCleanOrigin(req);
    const inviteLink = `${origin}/login?email=${encodeURIComponent(email)}&orgId=${userOrgId}&token=${inviteToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Zexpand Team" <${process.env.SMTP_USER}>` : '"Zexpand Team" <no-reply@zexpand.com>'),
      to: email,
      subject: `Invitation to Join Zexpand as ${targetRole.toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Zexpand Workspace Invitation</h2>
          <p style="color: #475569; font-size: 14px;">Hello <strong>${name}</strong>,</p>
          <p style="color: #475569; font-size: 14px;">
            You have been invited by <strong>${authUser.name}</strong> (${authUser.role.toUpperCase()}) to join <strong>Zexpand</strong> as a <strong>${targetRole.toUpperCase()}</strong>.
          </p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Branch:</strong> ${branchName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Campaign:</strong> ${campaignName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Access:</strong> Sign in with Google or create your own password</p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Accept & Join Workspace</a>
          </div>
        </div>
      `,
    };

    let emailSent = true;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpPort = parseInt(process.env.SMTP_PORT || "465");
      const isSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : smtpPort === 465;

      console.log("Looking Up mail")
      console.log("process.env.SMTP_HOST::", process.env.SMTP_HOST);
      console.log("smtpPort::", smtpPort);
      console.log("isSecure::", isSecure);
      console.log("process.env.SMTP_USER::", process.env.SMTP_USER);

      const dynamicTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: isSecure,
        family: 4,
        lookup: (hostname: string, opts: any, cb: any) => dns.lookup(hostname, { family: 4 }, cb),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      } as any);

      dynamicTransporter.sendMail(mailOptions).then(() => {
        console.log(`✉️ Email successfully sent to ${email} via SMTP.`);
      }).catch((smtpErr: any) => {
        console.error("❌ SMTP Delivery Error:", smtpErr.message || smtpErr);
      });
    } else {
      console.warn("⚠️ SMTP credentials (SMTP_USER / SMTP_PASS) not configured in environment variables.");
    }

    // Build WhatsApp URL
    const rawPhone = (phone || "").replace(/[^0-9]/g, "");
    const waText = `Hi ${name}, you've been invited by ${authUser.name} to join Zexpand as ${targetRole.toUpperCase()} for ${branchName} / ${campaignName}. Join workspace here: ${inviteLink}`;
    const whatsappUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;

    return res.json({
      success: true,
      emailSent,
      whatsappUrl,
      inviteMessage: waText,
      user: {
        ...newUser,
        branchName,
        campaignName,
      },
    });
  } catch (err: any) {
    console.error("Invite team member error cause:", err.cause || err);
    return res.status(500).json({ error: err.cause?.message || err.sqlMessage || err.message });
  }
});

app.delete("/api/team/:id", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "manager")) {
      return res.status(403).json({ error: "Unauthorized to delete members." });
    }

    const { id } = req.params;
    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) return res.status(404).json({ error: "Member not found." });

    if (authUser.role === "manager" && targetUser.role !== "marketer") {
      return res.status(403).json({ error: "Managers can only revoke Marketers." });
    }

    // Revoke user by setting invitationStatus to 'revoked' and deleting record
    await db.update(users).set({ invitationStatus: "revoked" }).where(eq(users.id, id));
    await db.delete(users).where(eq(users.id, id));

    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete team member error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/team/:id", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "manager")) {
      return res.status(403).json({ error: "Unauthorized to edit team member." });
    }

    const { id } = req.params;
    const { name, email, phone, role, branchId, campaignId } = req.body;

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) return res.status(404).json({ error: "Member not found." });

    if (authUser.role === "manager" && targetUser.role !== "marketer") {
      return res.status(403).json({ error: "Managers can only edit Marketers." });
    }

    const updatePayload: any = {};
    if (name) updatePayload.name = name.trim();
    if (email) updatePayload.email = email.trim();
    if (phone !== undefined) updatePayload.phone = phone ? phone.trim() : null;
    if (role && ["admin", "manager", "marketer"].includes(role)) {
      if (authUser.role === "admin") updatePayload.role = role;
    }
    if (branchId !== undefined) updatePayload.branchId = branchId || null;
    if (campaignId !== undefined) updatePayload.campaignId = campaignId || null;

    await db.update(users).set(updatePayload).where(eq(users.id, id));

    const [updated] = await db.select().from(users).where(eq(users.id, id));
    return res.json({ success: true, user: updated });
  } catch (err: any) {
    console.error("Edit team member error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/team/:id/promote", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "Only Admin can change member roles." });
    }

    const { id } = req.params;
    const { targetRole, branchId, campaignId } = req.body;

    if (!targetRole || !["admin", "manager", "marketer"].includes(targetRole)) {
      return res.status(400).json({ error: "Valid targetRole (admin, manager, marketer) is required." });
    }

    const updatePayload: any = {
      role: targetRole,
      invitationStatus: "accepted",
    };

    if (targetRole === "manager") {
      if (branchId) updatePayload.branchId = branchId;
      if (campaignId) updatePayload.campaignId = campaignId;
    } else if (targetRole === "admin") {
      // Admins have full access
      updatePayload.branchId = null;
      updatePayload.campaignId = null;
      updatePayload.supervisorId = null;
    }

    await db.update(users).set(updatePayload).where(eq(users.id, id));

    const [updatedUser] = await db.select().from(users).where(eq(users.id, id));
    const cleaned = { ...updatedUser, passwordHash: undefined };

    return res.json({ success: true, user: cleaned });
  } catch (err: any) {
    console.error("Promote team member error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/campaigns/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only Admin can edit campaigns." });
    }

    const { id } = req.params;
    const { name, budget, description } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (budget !== undefined) updateData.budget = Number(budget);
    if (description !== undefined) updateData.description = description;

    await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/campaigns/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only Admin can delete campaigns." });
    }

    const { id } = req.params;
    await db.delete(campaigns).where(eq(campaigns.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// ACTIVITIES
// ------------------------------------------------------------------
app.get("/api/activities", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const baseQuery = db
      .select({
        activity: activities,
        branchName: branches.name,
        memberName: users.name,
      })
      .from(activities)
      .leftJoin(branches, eq(activities.branchId, branches.id))
      .leftJoin(users, eq(activities.memberId, users.id));

    let rows;
    if (user?.role === "super_admin") {
      rows = await baseQuery.orderBy(desc(activities.date));
    } else if (user?.role === "admin") {
      rows = await baseQuery.where(eq(activities.organizationId, orgId)).orderBy(desc(activities.date));
    } else if (user?.branchId) {
      // Enforce strict Branch Isolation for Marketer & Manager
      rows = await baseQuery
        .where(
          and(
            eq(activities.organizationId, orgId),
            sql`(${activities.branchId} = ${user.branchId} OR ${activities.memberId} = ${user.id} OR ${activities.branchId} IS NULL)`
          )
        )
        .orderBy(desc(activities.date));
    } else {
      rows = await baseQuery.where(eq(activities.organizationId, orgId)).orderBy(desc(activities.date));
    }

    const formatted = rows.map((r) => ({
      ...r.activity,
      branch: r.branchName || "HQ",
      memberName: r.memberName || "Team Member",
    }));

    return res.json(formatted);
  } catch (err: any) {
    console.error("Get activities error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/activities", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const body = req.body;
    let targetBranchId = body.branchId || null;
    if (targetBranchId) {
      const [bCheck] = await db.select().from(branches).where(eq(branches.id, targetBranchId));
      if (!bCheck) targetBranchId = null;
    }

    const newAct = {
      id: "act-" + Date.now(),
      organizationId: orgId,
      campaign: body.campaign || "General",
      channel: body.channel || "Facebook",
      approach: body.approach || "Organic Post",
      destination: body.destination || "",
      content: body.content || "",
      summary: body.summary || body.content?.substring(0, 100) || "",
      memberId: user?.id || body.memberId || "u-admin",
      branchId: targetBranchId,
      date: body.date ? new Date(body.date) : new Date(),
      proofUrl: body.proofUrl || null,
      publishedLink: body.publishedLink || null,
      cost: Number(body.cost) || 0,
      leadsCount: Number(body.leadsCount) || 0,
      clientsCount: Number(body.clientsCount) || 0,
    };
    await db.insert(activities).values(newAct);

    // Dispatch automatic notification
    await dispatchEventNotification({
      organizationId: orgId,
      branchId: targetBranchId,
      title: "New Activity Logged",
      body: `${user?.name || "A team member"} logged activity for ${newAct.campaign} (${newAct.channel})`,
      kind: "activity",
      excludeUserId: user?.id,
    });

    return res.json(newAct);
  } catch (err: any) {
    console.error("Create activity error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/activities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const updateData: any = {};
    if (body.campaign !== undefined) updateData.campaign = body.campaign;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.approach !== undefined) updateData.approach = body.approach;
    if (body.destination !== undefined) updateData.destination = body.destination;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.branchId !== undefined) updateData.branchId = body.branchId || null;
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.proofUrl !== undefined) updateData.proofUrl = body.proofUrl;
    if (body.publishedLink !== undefined) updateData.publishedLink = body.publishedLink;
    if (body.cost !== undefined) updateData.cost = Number(body.cost);
    if (body.leadsCount !== undefined) updateData.leadsCount = Number(body.leadsCount);
    if (body.clientsCount !== undefined) updateData.clientsCount = Number(body.clientsCount);

    await db.update(activities).set(updateData).where(eq(activities.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Update activity error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/activities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(activities).where(eq(activities.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete activity error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------------
app.get("/api/notifications", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    const rows = user?.role === "super_admin"
      ? await db.select().from(notifications).orderBy(desc(notifications.createdAt))
      : await db.select().from(notifications).where(and(eq(notifications.organizationId, orgId), eq(notifications.userId, user?.id || ""))).orderBy(desc(notifications.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/read", async (req, res) => {
  try {
    const { notificationId } = req.body || {};
    if (notificationId) {
      await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
    } else {
      await db.update(notifications).set({ read: true });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// TODOS
// ------------------------------------------------------------------
app.get("/api/todos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    let rows;
    if (user?.role === "super_admin") {
      rows = await db.select().from(todos).orderBy(desc(todos.createdAt));
    } else if (user?.role === "admin") {
      rows = await db.select().from(todos).where(eq(todos.organizationId, orgId)).orderBy(desc(todos.createdAt));
    } else {
      // Marketer & Manager only see tasks assigned to them or created by them
      rows = await db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.organizationId, orgId),
            sql`(${todos.assigneeId} = ${user?.id} OR ${todos.createdById} = ${user?.id})`
          )
        )
        .orderBy(desc(todos.createdAt));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const { title, assigneeId, createdById, dueDate, notes } = req.body;
    const newTodo = {
      id: "t-" + Date.now(),
      organizationId: orgId,
      title,
      assigneeId: assigneeId || user?.id || "u-admin",
      createdById: createdById || user?.id || "u-admin",
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 86400000 * 3),
      status: "todo" as const,
      notes: notes || null,
      createdAt: new Date(),
    };
    await db.insert(todos).values(newTodo);

    await dispatchEventNotification({
      organizationId: orgId,
      branchId: user?.branchId || null,
      title: "New Task Assigned",
      body: `Task "${title}" created by ${user?.name || "Team Member"}`,
      kind: "todo",
      excludeUserId: user?.id,
    });

    return res.json(newTodo);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, title, notes } = req.body;
    const updateData: any = {};
    if (status) updateData.status = status;
    if (title) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;

    await db.update(todos).set(updateData).where(eq(todos.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// APPROVALS & ASSETS
// ------------------------------------------------------------------
app.get("/api/approvals", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    let rows;
    if (user?.role === "super_admin") {
      rows = await db.select().from(approvals).orderBy(desc(approvals.submittedAt));
    } else if (user?.role === "admin") {
      rows = await db.select().from(approvals).where(eq(approvals.organizationId, orgId)).orderBy(desc(approvals.submittedAt));
    } else {
      // Marketer & Manager only see approvals submitted by them or submitted by users in their branch
      rows = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.organizationId, orgId),
            sql`(${approvals.submittedById} = ${user?.id} OR ${approvals.submittedById} IN (SELECT id FROM users WHERE branch_id = ${user?.branchId || ''}))`
          )
        )
        .orderBy(desc(approvals.submittedAt));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/approvals", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const { title, type, description, previewUrl } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });

    const newApproval = {
      id: "app-" + Date.now(),
      organizationId: orgId,
      title,
      type: type || "image",
      submittedById: user?.id || "u-admin",
      previewUrl: previewUrl || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600",
      description: description || "",
      status: "pending" as const,
      submittedAt: new Date(),
    };

    await db.insert(approvals).values(newApproval);

    await dispatchEventNotification({
      organizationId: orgId,
      branchId: user?.branchId || null,
      title: "New Approval Request",
      body: `"${title}" submitted for approval by ${user?.name || "Team Member"}.`,
      kind: "approval",
      excludeUserId: user?.id,
    });

    return res.json(newApproval);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/approvals/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can review approvals." });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status || (status !== "approved" && status !== "rejected")) {
      return res.status(400).json({ error: "Status must be approved or rejected." });
    }

    await db.update(approvals).set({
      status,
      reviewerId: user.id,
      reviewedAt: new Date(),
    }).where(eq(approvals.id, id));

    const [item] = await db.select().from(approvals).where(eq(approvals.id, id));

    if (status === "approved" && item) {
      const newAsset = {
        id: "ast-" + Date.now(),
        organizationId: user.organizationId || "org-default",
        approvalId: item.id,
        title: item.title,
        description: item.description,
        type: item.type,
        previewUrl: item.previewUrl,
        fileUrl: item.previewUrl,
        version: "v1.0",
        createdAt: new Date(),
      };
      await db.insert(assets).values(newAsset).catch((e) => console.log("Asset notice:", e));
    }

    await dispatchEventNotification({
      organizationId: user.organizationId || "org-default",
      branchId: user.branchId || null,
      title: status === "approved" ? "Submission Approved 🎉" : "Submission Rejected ❌",
      body: `Submission "${item?.title || 'Item'}" was ${status} by ${user.name}.`,
      kind: "approval",
    });

    return res.json({ success: true, status });
  } catch (err: any) {
    console.error("Update approval status error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/approvals/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can delete approvals." });
    }
    const { id } = req.params;
    await db.update(assets).set({ approvalId: null }).where(eq(assets.approvalId, id));
    await db.delete(approvals).where(eq(approvals.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete approval error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/assets", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    const rows = user?.role === "super_admin"
      ? await db.select().from(assets).orderBy(desc(assets.createdAt))
      : await db.select().from(assets).where(eq(assets.organizationId, orgId)).orderBy(desc(assets.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/assets", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can upload assets." });
    }

    const { title, description, type, previewUrl, fileUrl, body, category, version } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: "Title and type are required." });
    }

    const newAsset = {
      id: "ast-" + Date.now(),
      organizationId: user.organizationId || "org-default",
      title,
      description: description || "",
      type: type || "image",
      previewUrl: previewUrl || fileUrl || "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600",
      fileUrl: fileUrl || previewUrl || null,
      body: body || null,
      category: category || "General",
      version: version || "v1.0",
      createdAt: new Date(),
    };

    await db.insert(assets).values(newAsset);

    await dispatchEventNotification({
      organizationId: user.organizationId || "org-default",
      branchId: user.branchId || null,
      title: "New Marketing Asset Added",
      body: `${user.name} shared a new asset: "${title}" (${type})`,
      kind: "activity",
      excludeUserId: user.id,
    });

    return res.json(newAsset);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/assets/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can delete assets." });
    }
    const { id } = req.params;
    await db.delete(assets).where(eq(assets.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/assets/rename-category", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can rename categories." });
    }
    const { oldCategory, newCategory } = req.body;
    if (!oldCategory || !newCategory) {
      return res.status(400).json({ error: "oldCategory and newCategory are required." });
    }
    const orgId = user.organizationId || "org-default";
    await db
      .update(assets)
      .set({ category: newCategory })
      .where(and(eq(assets.organizationId, orgId), eq(assets.category, oldCategory)));
    return res.json({ success: true, oldCategory, newCategory });
  } catch (err: any) {
    console.error("Rename category error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/assets/delete-category", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can delete categories." });
    }
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: "Category is required." });
    }
    const orgId = user.organizationId || "org-default";
    // Reassign all assets in this category to 'General'
    await db
      .update(assets)
      .set({ category: "General" })
      .where(and(eq(assets.organizationId, orgId), eq(assets.category, category)));
    return res.json({ success: true, category });
  } catch (err: any) {
    console.error("Delete category error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// LEADS
// ------------------------------------------------------------------
app.get("/api/leads", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const baseQuery = db
      .select({
        lead: leads,
        branchName: branches.name,
        memberName: users.name,
      })
      .from(leads)
      .leftJoin(branches, eq(leads.branchId, branches.id))
      .leftJoin(users, eq(leads.assignedToId, users.id));

    let rows;
    if (user?.role === "super_admin") {
      rows = await baseQuery.orderBy(desc(leads.createdAt));
    } else if (user?.role === "admin") {
      rows = await baseQuery.where(eq(leads.organizationId, orgId)).orderBy(desc(leads.createdAt));
    } else if (user?.branchId) {
      // Enforce strict Branch Isolation for Marketer & Manager
      rows = await baseQuery
        .where(
          and(
            eq(leads.organizationId, orgId),
            sql`(${leads.branchId} = ${user.branchId} OR ${leads.assignedToId} = ${user.id} OR ${leads.branchId} IS NULL)`
          )
        )
        .orderBy(desc(leads.createdAt));
    } else {
      rows = await baseQuery.where(eq(leads.organizationId, orgId)).orderBy(desc(leads.createdAt));
    }

    const formatted = rows.map((r) => ({
      ...r.lead,
      branch: r.branchName || "HQ",
      memberName: r.memberName || "Team Member",
    }));

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/leads", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";

    const { name, contact, campaign, channel, approach, destination, assignedToId, branchId, notes } = req.body;
    if (!name || !contact) {
      return res.status(400).json({ error: "Name and contact are required." });
    }

    const newLead = {
      id: "lead-" + Date.now(),
      organizationId: orgId,
      name,
      contact,
      campaign: campaign || "General",
      channel: channel || "Direct Outreach",
      approach: approach || "Organic Post",
      destination: destination || "Social Media",
      assignedToId: assignedToId || user?.id || "u-admin",
      branchId: branchId || null,
      status: "new" as const,
      value: 0,
      notes: notes || "",
      createdAt: new Date(),
    };

    await db.insert(leads).values(newLead);

    // Dispatch automatic notification
    await dispatchEventNotification({
      organizationId: orgId,
      branchId: newLead.branchId,
      title: "New Lead Recorded",
      body: `${user?.name || "A team member"} captured lead: ${newLead.name} (${newLead.campaign})`,
      kind: "activity",
      excludeUserId: user?.id,
    });

    return res.json(newLead);
  } catch (err: any) {
    console.error("Create lead error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.contact !== undefined) updateData.contact = body.contact;
    if (body.campaign !== undefined) updateData.campaign = body.campaign;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.approach !== undefined) updateData.approach = body.approach;
    if (body.destination !== undefined) updateData.destination = body.destination;
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId;
    if (body.branchId !== undefined) updateData.branchId = body.branchId || null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    await db.update(leads).set(updateData).where(eq(leads.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Update lead error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(leads).where(eq(leads.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete lead error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// COMPANY LINKS
// ------------------------------------------------------------------
app.get("/api/company-links", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const orgId = user?.organizationId || "org-default";
    const rows = user?.role === "super_admin"
      ? await db.select().from(companyLinks)
      : await db.select().from(companyLinks).where(eq(companyLinks.organizationId, orgId));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-links", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admins can add or edit company links." });
    }

    const orgId = user.organizationId || "org-default";
    const { id, platform, url, handle, label, category } = req.body;

    if (!platform) {
      return res.status(400).json({ error: "Platform name is required." });
    }

    if (id) {
      // Update existing specific link entry
      await db
        .update(companyLinks)
        .set({
          platform,
          url: url || null,
          handle: handle || null,
          label: label || platform,
          category: category || "Social",
        })
        .where(and(eq(companyLinks.id, id), eq(companyLinks.organizationId, orgId)));

      const [updated] = await db.select().from(companyLinks).where(eq(companyLinks.id, id));
      return res.json(updated || { id, platform, label, url, handle });
    } else {
      // Insert new multi-account link entry
      const newLinkId = "cl-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const newLink = {
        id: newLinkId,
        organizationId: orgId,
        platform,
        label: label || platform,
        url: url || null,
        handle: handle || null,
        category: category || "Social",
      };
      await db.insert(companyLinks).values(newLink);
      return res.json(newLink);
    }
  } catch (err: any) {
    console.error("Save company link error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/company-links/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admins can delete company links." });
    }
    const { id } = req.params;
    const orgId = user.organizationId || "org-default";
    await db.delete(companyLinks).where(and(eq(companyLinks.id, id), eq(companyLinks.organizationId, orgId)));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete company link error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Helper function to send email via SMTP to one or multiple recipients
async function sendSmtpEmail({ to, subject, html }: { to: string | string[]; subject: string; html: string }) {
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;
      const dynamicTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: isSecure,
        family: 4,
        lookup: (hostname: string, opts: any, cb: any) => dns.lookup(hostname, { family: 4 }, cb),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      } as any);

      const targetRecipients = Array.isArray(to) ? to.join(",") : to;
      await dynamicTransporter.sendMail({
        from: `"Zexpand SaaS Platform" <${process.env.SMTP_USER}>`,
        to: targetRecipients,
        subject,
        html,
      });
      console.log(`✉️ Email successfully sent to ${targetRecipients}`);
      return true;
    }
  } catch (err: any) {
    console.error("❌ SMTP Delivery Error:", err.message || err);
  }
  return false;
}

// Helper function to dispatch automatic event notifications (with branch isolation & cross-branch admin toggle)
async function dispatchEventNotification({
  organizationId,
  branchId,
  title,
  body,
  kind = "activity",
  excludeUserId,
}: {
  organizationId: string;
  branchId?: string | null;
  title: string;
  body: string;
  kind?: "activity" | "todo" | "approval";
  excludeUserId?: string;
}) {
  try {
    const targetOrgId = organizationId || "org-default";

    const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId));
    const isCrossBranch = Boolean((org as any)?.allowCrossBranchNotifications);

    const orgUsers = await db.select().from(users).where(eq(users.organizationId, targetOrgId));
    let targetUsers = orgUsers;

    if (!isCrossBranch && branchId) {
      targetUsers = orgUsers.filter(
        (u) =>
          u.branchId === branchId ||
          u.role === "admin" ||
          u.role === "super_admin"
      );
    }

    if (excludeUserId) {
      targetUsers = targetUsers.filter((u) => u.id !== excludeUserId);
    }

    const newNotifications = targetUsers.map((u) => ({
      id: "notif-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      organizationId: targetOrgId,
      userId: u.id,
      title,
      body,
      read: false,
      kind: kind as any,
      createdAt: new Date(),
    }));

    if (newNotifications.length > 0) {
      await db.insert(notifications).values(newNotifications);
    }
  } catch (err: any) {
    console.error("❌ Notification dispatch error:", err.message || err);
  }
}

// ------------------------------------------------------------------
// ORGANIZATION SETTINGS (CROSS-BRANCH NOTIFICATIONS TOGGLE)
// ------------------------------------------------------------------
app.get("/api/organization/settings", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const targetOrgId = user.organizationId || "org-default";
    const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId));

    return res.json({
      organizationId: targetOrgId,
      allowCrossBranchNotifications: Boolean((org as any)?.allowCrossBranchNotifications),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/organization/settings", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Only Organization Admins can modify notification preferences." });
    }

    const { allowCrossBranchNotifications } = req.body;
    const targetOrgId = user.organizationId || "org-default";

    await db.update(organizations).set({
      allowCrossBranchNotifications: Boolean(allowCrossBranchNotifications),
    }).where(eq(organizations.id, targetOrgId));

    return res.json({
      success: true,
      allowCrossBranchNotifications: Boolean(allowCrossBranchNotifications),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// WORKSPACE REQUESTS (ADMIN APPLICANT -> SUPER ADMIN APPROVAL)
// ------------------------------------------------------------------

// 1. Submit Workspace Request (Admin applicant)
app.post("/api/workspace-requests", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { organizationName, organizationSlug } = req.body;
    if (!organizationName || !organizationName.trim()) {
      return res.status(400).json({ error: "Company / Workspace Name is required." });
    }

    const name = organizationName.trim();
    const slug = (organizationSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).trim();

    if (!slug) {
      return res.status(400).json({ error: "Valid Workspace Domain Slug is required." });
    }

    // Check if slug is already registered in active organizations
    const [existingOrg] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    if (existingOrg) {
      return res.status(400).json({ error: `Domain slug '${slug}.zexpand.app' is already registered to an active workspace.` });
    }

    // Check if user has an existing pending request
    const [existingPending] = await db
      .select()
      .from(workspaceRequests)
      .where(and(eq(workspaceRequests.applicantUserId, user.id), eq(workspaceRequests.status, "pending")));

    if (existingPending) {
      return res.status(400).json({
        error: `You already have a pending request for '${existingPending.organizationName}'. Please wait for Super Admin review.`,
        request: existingPending,
      });
    }

    const requestId = "wr-" + Date.now();
    const newRequest = {
      id: requestId,
      organizationName: name,
      organizationSlug: slug,
      applicantUserId: user.id,
      applicantEmail: user.email,
      applicantName: user.name,
      status: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(workspaceRequests).values(newRequest);

    // Notify ALL Super Admins via Email & In-App Notification
    const superAdmins = await db.select().from(users).where(eq(users.role, "super_admin"));
    const superAdminEmails = superAdmins.map((sa) => sa.email).filter(Boolean);

    if (superAdminEmails.length === 0 && process.env.SMTP_USER) {
      superAdminEmails.push(process.env.SMTP_USER);
    }

    const emailSent = await sendSmtpEmail({
      to: superAdminEmails,
      subject: `🚨 New Workspace Instance Request: ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">New Workspace Request Received</h2>
          <p>An Admin applicant has submitted a request to provision a new Zexpand client workspace instance:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Company Name:</td><td style="padding: 8px;">${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Domain Slug:</td><td style="padding: 8px;">${slug}.zexpand.app</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Applicant Name:</td><td style="padding: 8px;">${user.name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Applicant Email:</td><td style="padding: 8px;">${user.email}</td></tr>
          </table>
          <p style="margin-top: 20px;">
            <a href="${getCleanOrigin(req)}/super-admin" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Review Request on Super Admin Portal
            </a>
          </p>
        </div>
      `,
    });

    for (const sa of superAdmins) {
      await db.insert(notifications).values({
        id: "notif-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        organizationId: "org-default",
        userId: sa.id,
        title: "New Workspace Request",
        body: `"${name}" (${slug}.zexpand.app) requested by ${user.email}`,
        read: false,
        kind: "activity",
        createdAt: new Date(),
      }).catch(() => {});
    }

    return res.json({ success: true, request: newRequest, emailSent });
  } catch (err: any) {
    console.error("Submit workspace request error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Fetch User's Request Status
app.get("/api/workspace-requests/my-status", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (user.organizationId && user.organizationId !== "org-default") {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
      if (org && org.status === "active") {
        return res.json({ isApproved: true, organization: org });
      }
    }

    const [latestRequest] = await db
      .select()
      .from(workspaceRequests)
      .where(eq(workspaceRequests.applicantUserId, user.id))
      .orderBy(desc(workspaceRequests.createdAt));

    return res.json({
      isApproved: false,
      request: latestRequest || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Fetch All Workspace Requests (Super Admin Portal)
app.get("/api/workspace-requests", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "super_admin") {
      return res.status(403).json({ error: "Super Admin access required." });
    }

    const rows = await db.select().from(workspaceRequests).orderBy(desc(workspaceRequests.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Approve Workspace Request (Super Admin)
app.post("/api/workspace-requests/:id/approve", async (req, res) => {
  try {
    const superAdmin = await getAuthUser(req);
    if (!superAdmin || superAdmin.role !== "super_admin") {
      return res.status(403).json({ error: "Super Admin access required." });
    }

    const { id } = req.params;
    const [request] = await db.select().from(workspaceRequests).where(eq(workspaceRequests.id, id));

    if (!request) {
      return res.status(404).json({ error: "Workspace request not found." });
    }

    if (request.status === "approved") {
      return res.status(400).json({ error: "This request has already been approved." });
    }

    const [existingOrg] = await db.select().from(organizations).where(eq(organizations.slug, request.organizationSlug));
    const newOrgId = existingOrg ? existingOrg.id : "org-" + Date.now();

    if (!existingOrg) {
      await db.insert(organizations).values({
        id: newOrgId,
        name: request.organizationName,
        slug: request.organizationSlug,
        ownerEmail: request.applicantEmail,
        ownerName: request.applicantName,
        status: "active",
        createdAt: new Date(),
      });
    }

    await db.update(users).set({
      organizationId: newOrgId,
      role: "admin",
    }).where(eq(users.id, request.applicantUserId));

    await db.update(workspaceRequests).set({
      status: "approved",
      processedByUserId: superAdmin.id,
      updatedAt: new Date(),
    }).where(eq(workspaceRequests.id, id));

    const emailSent = await sendSmtpEmail({
      to: request.applicantEmail,
      subject: `🎉 Your Workspace '${request.organizationName}' Has Been Approved!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #10b981; margin-top: 0;">Workspace Approved! 🎉</h2>
          <p>Great news ${request.applicantName}! Your request to provision <strong>${request.organizationName}</strong> has been approved by the platform administrator.</p>
          <p><strong>Subdomain Slug:</strong> ${request.organizationSlug}.zexpand.app</p>
          <p style="margin-top: 24px;">
            <a href="${getCleanOrigin(req)}/" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Launch Your Zexpand Workspace
            </a>
          </p>
        </div>
      `,
    });

    return res.json({ success: true, organizationId: newOrgId, emailSent });
  } catch (err: any) {
    console.error("Approve workspace request error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 5. Reject Workspace Request (Super Admin)
app.post("/api/workspace-requests/:id/reject", async (req, res) => {
  try {
    const superAdmin = await getAuthUser(req);
    if (!superAdmin || superAdmin.role !== "super_admin") {
      return res.status(403).json({ error: "Super Admin access required." });
    }

    const { id } = req.params;
    const { reason } = req.body || {};

    const [request] = await db.select().from(workspaceRequests).where(eq(workspaceRequests.id, id));
    if (!request) {
      return res.status(404).json({ error: "Workspace request not found." });
    }

    const rejectionNote = reason?.trim() || "The request did not meet platform workspace guidelines.";

    await db.update(workspaceRequests).set({
      status: "rejected",
      rejectionReason: rejectionNote,
      processedByUserId: superAdmin.id,
      updatedAt: new Date(),
    }).where(eq(workspaceRequests.id, id));

    const emailSent = await sendSmtpEmail({
      to: request.applicantEmail,
      subject: `Workspace Request Update for ${request.organizationName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #ef4444; margin-top: 0;">Workspace Request Declined</h2>
          <p>Hello ${request.applicantName},</p>
          <p>Your request to provision the workspace <strong>${request.organizationName}</strong> was reviewed by a Super Admin and was not approved at this time.</p>
          <p><strong>Reason:</strong> ${rejectionNote}</p>
          <p>If you believe this was an error or have questions, please reach out to platform support.</p>
        </div>
      `,
    });

    return res.json({ success: true, emailSent });
  } catch (err: any) {
    console.error("Reject workspace request error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Health check endpoints for Railway / cloud deployments
app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok", timestamp: new Date() });
});

app.get("/api/health", (_req, res) => {
  return res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Serve built frontend assets in production
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function initDbSchema() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        budget INT NOT NULL DEFAULT 0,
        status ENUM('active', 'paused', 'completed') NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'marketer') NOT NULL DEFAULT 'marketer',
        branch_id VARCHAR(64),
        campaign_id VARCHAR(64),
        supervisor_id VARCHAR(64),
        avatar VARCHAR(16),
        picture TEXT,
        invitation_status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'accepted',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(64) PRIMARY KEY,
        campaign VARCHAR(255) NOT NULL,
        channel VARCHAR(128) NOT NULL,
        approach VARCHAR(128) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        summary TEXT NOT NULL,
        member_id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64),
        date DATETIME NOT NULL,
        proof_url LONGTEXT NOT NULL,
        published_link TEXT,
        cost INT NOT NULL DEFAULT 0,
        leads_count INT NOT NULL DEFAULT 0,
        clients_count INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS todos (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        assignee_id VARCHAR(64) NOT NULL,
        created_by_id VARCHAR(64) NOT NULL,
        due_date DATETIME NOT NULL,
        status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type ENUM('flyer', 'video', 'image', 'text', 'other') NOT NULL DEFAULT 'image',
        submitted_by_id VARCHAR(64) NOT NULL,
        reviewer_id VARCHAR(64),
        preview_url LONGTEXT NOT NULL,
        description TEXT NOT NULL,
        status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS assets (
        id VARCHAR(64) PRIMARY KEY,
        approval_id VARCHAR(64),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type ENUM('flyer', 'video', 'image', 'text', 'other') NOT NULL DEFAULT 'image',
        preview_url LONGTEXT NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'General',
        version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
        body TEXT,
        file_url LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(128) NOT NULL,
        campaign VARCHAR(255),
        channel VARCHAR(128),
        approach VARCHAR(128),
        destination VARCHAR(255),
        activity_id VARCHAR(64),
        assigned_to_id VARCHAR(64),
        branch_id VARCHAR(64),
        status ENUM('new', 'contacted', 'qualified', 'client') NOT NULL DEFAULT 'new',
        value INT NOT NULL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS company_links (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(128) NOT NULL,
        url TEXT,
        handle VARCHAR(128),
        category VARCHAR(64) NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        \`read\` TINYINT(1) NOT NULL DEFAULT 0,
        kind ENUM('activity', 'todo', 'approval') NOT NULL DEFAULT 'activity',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workspace_requests (
        id VARCHAR(64) PRIMARY KEY,
        organization_name VARCHAR(255) NOT NULL,
        organization_slug VARCHAR(128) NOT NULL,
        applicant_user_id VARCHAR(64) NOT NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        processed_by_user_id VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try { await db.execute(sql`ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'manager', 'marketer') NOT NULL DEFAULT 'admin'`); } catch { }
    try { await db.execute(sql`ALTER TABLE invitations MODIFY COLUMN role ENUM('super_admin', 'admin', 'manager', 'marketer') NOT NULL`); } catch { }

    try { await db.execute(sql`ALTER TABLE users ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE campaigns ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE branches ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE invitations ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE activities ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE todos ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE approvals ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE assets ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE company_links ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE notifications ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org-default'`); } catch { }
    try { await db.execute(sql`ALTER TABLE organizations ADD COLUMN allow_cross_branch_notifications TINYINT(1) NOT NULL DEFAULT 0`); } catch { }

    // Ensure default organization exists
    const [existingOrg] = await db.select().from(organizations).where(eq(organizations.id, "org-default"));
    if (!existingOrg) {
      await db.insert(organizations).values({
        id: "org-default",
        name: "Carezza Growth Team",
        slug: "carezza",
        ownerEmail: "admin@carezza.com",
        ownerName: "Ama Boateng",
        status: "active",
      });
    }

    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN campaign VARCHAR(255)`); } catch { }
    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN channel VARCHAR(128)`); } catch { }
    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN approach VARCHAR(128)`); } catch { }
    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN destination VARCHAR(255)`); } catch { }
    try { await db.execute(sql`ALTER TABLE leads ADD COLUMN branch_id VARCHAR(64)`); } catch { }
    try { await db.execute(sql`ALTER TABLE users ADD COLUMN campaign_id VARCHAR(64)`); } catch { }
    try { await db.execute(sql`ALTER TABLE users ADD COLUMN picture TEXT`); } catch { }
    try { await db.execute(sql`ALTER TABLE users ADD COLUMN invitation_status ENUM('pending', 'accepted', 'revoked') DEFAULT 'accepted'`); } catch { }
    console.log("✨ All MySQL Multi-Tenant SaaS tables initialized successfully!");
  } catch (e: any) {
    console.error("DB Init Schema Note:", e.message);
  }
}

const HOST = "0.0.0.0";
const server = app.listen(Number(PORT), HOST, async () => {
  console.log(`🚀 Node.js Express Backend running on http://${HOST}:${PORT}`);
  await initDbSchema();
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error("❌ Server error:", err);
  }
});

