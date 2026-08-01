import dotenv from "dotenv";
dotenv.config();
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
} from "../src/db/schema";
import { eq, desc } from "drizzle-orm";
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

// Helper for session extraction
async function getAuthUser(req: express.Request) {
  const cookieHeader = req.headers.cookie || null;
  const token = getSessionFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return null;

  const [u] = await db.select().from(users).where(eq(users.id, payload.userId));
  return u || null;
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

    const { passwordHash: _, ...userWithoutPass } = u;
    return res.json({ user: userWithoutPass, token });
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

    const cleanEmail = email.toLowerCase().trim();
    let [u] = await db.select().from(users).where(eq(users.email, cleanEmail));

    if (!u) {
      // Check if this is the very first user in the entire database
      const allUsers = await db.select().from(users);
      const isFirstUser = allUsers.length === 0;

      // Check invitations table for auto-join
      const [inv] = await db.select().from(invitations).where(eq(invitations.email, cleanEmail));

      const assignedRole = inv?.role || (isFirstUser ? "admin" : "marketer");
      const assignedBranchId = inv?.branchId || null;
      const assignedCampaignId = inv?.campaignId || null;
      const assignedSupervisorId = inv?.invitedById || null;

      const userId = "u-" + Date.now();
      const userName = name || email.split("@")[0];
      const avatar = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
      const passwordHash = await bcrypt.hash("GoogleOAuthUserPassword123!", 10);

      const newUser = {
        id: userId,
        name: userName,
        email: cleanEmail,
        passwordHash,
        role: assignedRole,
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
      }
      [u] = await db.select().from(users).where(eq(users.id, userId));
    } else {
      // Update name and picture if provided
      const updateData: any = {};
      if (picture) updateData.picture = picture;
      if (name && (!u.name || u.name === u.email.split("@")[0])) updateData.name = name;
      if (u.invitationStatus === "pending") updateData.invitationStatus = "accepted";

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, u.id));
        if (u.invitationStatus === "pending") {
          await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.email, cleanEmail));
        }
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
    const { passwordHash: _, ...cleaned } = u;
    return res.json({ user: cleaned, token: sessionToken });
  } catch (err: any) {
    console.error("Google auth error:", err);
    return res.status(500).json({ error: err.message || "Failed to authenticate with Google." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, token: inviteToken } = req.body;
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

    // Case 1: Pending user record already exists (created during invite)
    if (existingUser && existingUser.invitationStatus === "pending") {
      await db
        .update(users)
        .set({
          name: name.trim(),
          passwordHash,
          invitationStatus: "accepted",
        })
        .where(eq(users.id, existingUser.id));

      await db
        .update(invitations)
        .set({ status: "accepted" })
        .where(eq(invitations.email, cleanEmail));

      const [updatedUser] = await db.select().from(users).where(eq(users.id, existingUser.id));
      const sessionToken = await createSessionToken({
        userId: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role as any,
        branchId: updatedUser.branchId,
        supervisorId: updatedUser.supervisorId,
      });

      res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
      const { passwordHash: _, ...cleaned } = updatedUser;
      return res.json({ user: cleaned, token: sessionToken });
    }

    // Case 2: New user registering from invitation or self-registering
    const allUsers = await db.select().from(users);
    const isFirstUser = allUsers.length === 0;

    let assignedRole: "admin" | "manager" | "marketer" = isFirstUser ? "admin" : "marketer";
    let assignedBranchId: string | null = null;
    let assignedCampaignId: string | null = null;
    let assignedSupervisorId: string | null = null;

    // Check invitations table
    const [inv] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.email, cleanEmail));

    if (inv) {
      assignedRole = inv.role;
      assignedBranchId = inv.branchId;
      assignedCampaignId = inv.campaignId;
      assignedSupervisorId = inv.invitedById;
      await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
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
    const { passwordHash: _, ...cleaned } = newUser;
    return res.json({ user: cleaned, token: sessionToken });
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
    const { passwordHash: _, ...userWithoutPass } = user;
    return res.json({ user: userWithoutPass });
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

// ------------------------------------------------------------------
// BRANCHES & CAMPAIGNS (ADMIN ONLY CREATION)
// ------------------------------------------------------------------
app.get("/api/branches", async (_req, res) => {
  try {
    const rows = await db.select().from(branches);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/branches", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only Admin can create branches." });
    }

    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: "Branch name is required." });

    const newBranch = {
      id: "b-" + Date.now(),
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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

app.get("/api/campaigns", async (_req, res) => {
  try {
    const rows = await db.select().from(campaigns);
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
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only Admin can create campaigns." });
    }

    const { name, description, budget } = req.body;
    if (!name) return res.status(400).json({ error: "Campaign name is required." });

    const newCamp = {
      id: "c-" + Date.now(),
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
    const allUsers = await db.select().from(users);
    const allBranches = await db.select().from(branches);
    const allCampaigns = await db.select().from(campaigns);

    const formatted = allUsers.map((u) => {
      const bObj = allBranches.find((br) => br.id === u.branchId);
      const cObj = allCampaigns.find((c) => c.id === u.campaignId);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        invitationStatus: u.invitationStatus || "accepted",
        branchId: u.branchId,
        branchName: bObj?.name || "Unassigned",
        campaignId: u.campaignId,
        campaignName: cObj?.name || "General / Unassigned",
        supervisorId: u.supervisorId,
        avatar: u.avatar || u.name.substring(0, 2).toUpperCase(),
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

    // Create user with status 'pending'
    const newUser = {
      id: userId,
      name,
      email,
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
    await db.insert(invitations).values({
      id: inviteId,
      email,
      phone: phone || null,
      role: targetRole,
      campaignId: newUser.campaignId,
      branchId: newUser.branchId,
      invitedById: authUser.id,
      status: "pending",
      token: "tok-" + Date.now(),
      createdAt: new Date(),
    });

    // Lookup names
    const [bObj] = newUser.branchId ? await db.select().from(branches).where(eq(branches.id, newUser.branchId)) : [null];
    const [cObj] = newUser.campaignId ? await db.select().from(campaigns).where(eq(campaigns.id, newUser.campaignId)) : [null];

    const branchName = bObj?.name || "Default HQ";
    const campaignName = cObj?.name || "General Campaign";

    // Build Email & Nodemailer SMTP dispatch
    const origin = req.headers.origin || `http://localhost:8080`;
    const inviteLink = `${origin}/login?email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"MarketOps Team" <no-reply@marketops.com>',
      to: email,
      subject: `Invitation to Join MarketOps as ${targetRole.toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">MarketOps Workspace Invitation</h2>
          <p style="color: #475569; font-size: 14px;">Hello <strong>${name}</strong>,</p>
          <p style="color: #475569; font-size: 14px;">
            You have been invited by <strong>${authUser.name}</strong> (${authUser.role.toUpperCase()}) to join <strong>MarketOps</strong> as a <strong>${targetRole.toUpperCase()}</strong>.
          </p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Branch:</strong> ${branchName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Campaign:</strong> ${campaignName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Default Password:</strong> Password123!</p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Accept & Sign In</a>
          </div>
        </div>
      `,
    };

    let emailSent = true;
    const dynamicTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    dynamicTransporter.sendMail(mailOptions).catch((e: any) => {
      console.log("SMTP Info Note (Background dispatch):", e.message);
    });

    // Build WhatsApp URL
    const rawPhone = (phone || "").replace(/[^0-9]/g, "");
    const waText = `Hi ${name}, you've been invited by ${authUser.name} to join MarketOps as ${targetRole.toUpperCase()} for ${branchName} / ${campaignName}. Log in here: ${inviteLink} (Password: Password123!)`;
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
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can edit campaigns." });
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
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can delete campaigns." });
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
app.get("/api/activities", async (_req, res) => {
  try {
    const rows = await db
      .select({
        activity: activities,
        branchName: branches.name,
      })
      .from(activities)
      .leftJoin(branches, eq(activities.branchId, branches.id))
      .orderBy(desc(activities.date));

    const formatted = rows.map((r) => ({
      ...r.activity,
      branch: r.branchName || "Accra HQ",
    }));

    return res.json(formatted);
  } catch (err: any) {
    console.error("Get activities error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/activities", async (req, res) => {
  try {
    const body = req.body;
    let targetBranchId = body.branchId || null;
    if (targetBranchId) {
      const [bCheck] = await db.select().from(branches).where(eq(branches.id, targetBranchId));
      if (!bCheck) targetBranchId = null;
    }

    const newAct = {
      id: "act-" + Date.now(),
      campaign: body.campaign || "General",
      channel: body.channel || "Facebook",
      approach: body.approach || "Organic Post",
      destination: body.destination || "",
      content: body.content || "",
      summary: body.summary || body.content?.substring(0, 100) || "",
      memberId: body.memberId || "u-admin",
      branchId: targetBranchId,
      date: body.date ? new Date(body.date) : new Date(),
      proofUrl: body.proofUrl || null,
      publishedLink: body.publishedLink || null,
      cost: Number(body.cost) || 0,
      leadsCount: Number(body.leadsCount) || 0,
      clientsCount: Number(body.clientsCount) || 0,
    };
    await db.insert(activities).values(newAct);

    // Create notification
    await db.insert(notifications).values({
      id: "notif-" + Date.now(),
      userId: body.memberId || "u-admin",
      title: "New Activity Logged",
      body: `Log created: ${newAct.campaign} on ${newAct.channel}`,
      read: false,
      kind: "activity",
      createdAt: new Date(),
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
app.get("/api/notifications", async (_req, res) => {
  try {
    const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
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
app.get("/api/todos", async (_req, res) => {
  try {
    const rows = await db.select().from(todos).orderBy(desc(todos.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { title, assigneeId, createdById, dueDate, notes } = req.body;
    const newTodo = {
      id: "t-" + Date.now(),
      title,
      assigneeId: assigneeId || "u-admin",
      createdById: createdById || "u-admin",
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 86400000 * 3),
      status: "todo" as const,
      notes: notes || null,
      createdAt: new Date(),
    };
    await db.insert(todos).values(newTodo);
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
app.get("/api/approvals", async (_req, res) => {
  try {
    const rows = await db.select().from(approvals).orderBy(desc(approvals.submittedAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/approvals", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { title, type, description, previewUrl } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });

    const newApproval = {
      id: "app-" + Date.now(),
      title,
      type: type || "image",
      submittedById: user?.id || "u-tm-efua",
      previewUrl: previewUrl || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600",
      description: description || "",
      status: "pending" as const,
      submittedAt: new Date(),
    };

    await db.insert(approvals).values(newApproval);

    await db.insert(notifications).values({
      id: "notif-" + Date.now(),
      userId: "u-admin",
      title: "New Item Submitted for Approval",
      body: `"${title}" submitted by ${user?.name || "Team Member"}.`,
      read: false,
      kind: "approval",
      createdAt: new Date(),
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

    if (item?.submittedById) {
      await db.insert(notifications).values({
        id: "notif-" + Date.now(),
        userId: item.submittedById,
        title: status === "approved" ? "Submission Approved 🎉" : "Submission Rejected ❌",
        body: `Your submission "${item.title}" was ${status} by ${user.name}.`,
        read: false,
        kind: "approval",
        createdAt: new Date(),
      });
    }

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
    // Disassociate any referenced asset approvalId safely to prevent foreign key error
    await db.update(assets).set({ approvalId: null }).where(eq(assets.approvalId, id));
    await db.delete(approvals).where(eq(approvals.id, id));
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete approval error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/assets", async (_req, res) => {
  try {
    const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
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

// ------------------------------------------------------------------
// LEADS
// ------------------------------------------------------------------
app.get("/api/leads", async (_req, res) => {
  try {
    const rows = await db
      .select({
        lead: leads,
        branchName: branches.name,
        memberName: users.name,
      })
      .from(leads)
      .leftJoin(branches, eq(leads.branchId, branches.id))
      .leftJoin(users, eq(leads.assignedToId, users.id))
      .orderBy(desc(leads.createdAt));

    const formatted = rows.map((r) => ({
      ...r.lead,
      branch: r.branchName || "Accra HQ",
      memberName: r.memberName || "Team Member",
    }));

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/leads", async (req, res) => {
  try {
    const { name, contact, campaign, channel, approach, destination, assignedToId, branchId, notes } = req.body;
    if (!name || !contact) {
      return res.status(400).json({ error: "Name and contact are required." });
    }

    const newLead = {
      id: "lead-" + Date.now(),
      name,
      contact,
      campaign: campaign || "General",
      channel: channel || "Direct Outreach",
      approach: approach || "Organic Post",
      destination: destination || "Social Media",
      assignedToId: assignedToId || "u-admin",
      branchId: branchId || null,
      status: "new" as const,
      value: 0,
      notes: notes || "",
      createdAt: new Date(),
    };

    await db.insert(leads).values(newLead);
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
app.get("/api/company-links", async (_req, res) => {
  try {
    const rows = await db.select().from(companyLinks);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  return res.json({ status: "ok", timestamp: new Date() });
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

const server = app.listen(PORT, () => {
  console.log(`🚀 Node.js Express Backend running on http://localhost:${PORT}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error("❌ Server error:", err);
  }
});

