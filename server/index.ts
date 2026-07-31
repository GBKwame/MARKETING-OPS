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
// AUTH ROUTES
// ------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!u || !u.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, u.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
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

// ------------------------------------------------------------------
// BRANCHES & CAMPAIGNS
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
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can add branches." });
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
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can delete branches." });
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
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Only Admins and Managers can edit branches." });
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
    const { name, description, budget } = req.body;
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

