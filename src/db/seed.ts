import { db } from "./index";
import {
  branches,
  users,
  campaigns,
  activities,
  todos,
  approvals,
  assets,
  leads,
  companyLinks,
  notifications,
} from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Starting MySQL Database Seed...");

  const defaultPasswordHash = await bcrypt.hash("Password123!", 10);

  // 1. Seed Branches
  const branchData = [
    { id: "b-accra", name: "Accra HQ", location: "Accra, Ghana" },
    { id: "b-kumasi", name: "Kumasi", location: "Kumasi, Ghana" },
    { id: "b-takoradi", name: "Takoradi", location: "Takoradi, Ghana" },
    { id: "b-tamale", name: "Tamale", location: "Tamale, Ghana" },
  ];
  for (const b of branchData) {
    await db.insert(branches).values(b).onDuplicateKeyUpdate({ set: { name: b.name } });
  }

  // 2. Seed Users with 3-Tier Supervision Hierarchy
  // Admin -> Manager -> Team Members
  const userData = [
    {
      id: "u-admin",
      name: "Ama Boateng",
      email: "admin@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "admin" as const,
      branchId: "b-accra",
      supervisorId: null,
      avatar: "AB",
    },
    {
      id: "u-mgr-accra",
      name: "Kwame Mensah",
      email: "manager.accra@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "manager" as const,
      branchId: "b-accra",
      supervisorId: "u-admin", // Supervised by Admin
      avatar: "KM",
    },
    {
      id: "u-mgr-kumasi",
      name: "Akua Konadu",
      email: "manager.kumasi@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "manager" as const,
      branchId: "b-kumasi",
      supervisorId: "u-admin", // Supervised by Admin
      avatar: "AK",
    },
    {
      id: "u-tm-efua",
      name: "Efua Owusu",
      email: "efua@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "marketer" as const,
      branchId: "b-kumasi",
      supervisorId: "u-mgr-kumasi", // Supervised by Kumasi Manager
      avatar: "EO",
    },
    {
      id: "u-tm-yaw",
      name: "Yaw Asante",
      email: "yaw@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "marketer" as const,
      branchId: "b-takoradi",
      supervisorId: "u-mgr-accra", // Supervised by HQ Manager
      avatar: "YA",
    },
    {
      id: "u-tm-akosua",
      name: "Akosua Nyarko",
      email: "akosua@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "marketer" as const,
      branchId: "b-accra",
      supervisorId: "u-mgr-accra", // Supervised by HQ Manager
      avatar: "AN",
    },
    {
      id: "u-tm-kojo",
      name: "Kojo Frimpong",
      email: "kojo@carezza.com",
      passwordHash: defaultPasswordHash,
      role: "marketer" as const,
      branchId: "b-tamale",
      supervisorId: "u-admin", // Supervised by Admin
      avatar: "KF",
    },
  ];

  for (const u of userData) {
    await db.insert(users).values(u).onDuplicateKeyUpdate({
      set: {
        name: u.name,
        role: u.role,
        supervisorId: u.supervisorId,
        branchId: u.branchId,
      },
    });
  }

  // 3. Seed Campaigns
  const campaignData = [
    { id: "c1", name: "Caregiver Recruitment Q3", description: "Targeting qualified caregivers in Ghana", budget: 5000 },
    { id: "c2", name: "Home Care Awareness", description: "Educating families on senior & disability home care", budget: 3000 },
    { id: "c3", name: "Grace Chapel Outreach", description: "Community church outreach programs", budget: 1500 },
    { id: "c4", name: "Ramadan Wellness", description: "Seasonal wellness campaigns", budget: 2000 },
    { id: "c5", name: "Back-to-School Nannies", description: "Recruiting nannies for home schooling and childcare", budget: 4000 },
  ];
  for (const c of campaignData) {
    await db.insert(campaigns).values(c).onDuplicateKeyUpdate({ set: { name: c.name } });
  }

  // 4. Seed Marketing Activities
  const proofUrls = [
    "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600",
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600",
    "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?w=600",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600",
  ];

  const activityData = [
    {
      id: "act-1",
      campaign: "Caregiver Recruitment Q3",
      channel: "Facebook",
      approach: "Organic Post",
      destination: "Caregiver Jobs Ghana",
      content: "Looking for trusted caregivers in Accra? Carezza matches vetted, trained professionals with families in under 48 hours. Reply CARE to learn more.",
      summary: "Recruitment post targeting caregivers in Greater Accra",
      memberId: "u-tm-efua",
      branchId: "b-kumasi",
      date: new Date(Date.now() - 1 * 86400000),
      proofUrl: proofUrls[0],
      publishedLink: "https://facebook.com/post/1001",
      cost: 50,
      leadsCount: 8,
      clientsCount: 2,
    },
    {
      id: "act-2",
      campaign: "Grace Chapel Outreach",
      channel: "Field Visit",
      approach: "Church Visit",
      destination: "Grace Chapel Bulletin",
      content: "Join our free wellness workshop this Saturday at Grace Chapel — refreshments provided.",
      summary: "Community outreach for weekend wellness event",
      memberId: "u-tm-akosua",
      branchId: "b-accra",
      date: new Date(Date.now() - 2 * 86400000),
      proofUrl: proofUrls[1],
      publishedLink: "https://facebook.com/post/1002",
      cost: 120,
      leadsCount: 12,
      clientsCount: 3,
    },
    {
      id: "act-3",
      campaign: "Ramadan Wellness",
      channel: "TikTok",
      approach: "Organic Video",
      destination: "@carezza_gh",
      content: "3 tips for family caregiver health during Ramadan. Save and share with someone who needs this!",
      summary: "Short form video awareness post",
      memberId: "u-tm-yaw",
      branchId: "b-takoradi",
      date: new Date(Date.now() - 3 * 86400000),
      proofUrl: proofUrls[2],
      publishedLink: "https://tiktok.com/@carezza_gh/video/101",
      cost: 0,
      leadsCount: 4,
      clientsCount: 1,
    },
    {
      id: "act-4",
      campaign: "Home Care Awareness",
      channel: "WhatsApp",
      approach: "Broadcast",
      destination: "Carezza WhatsApp Broadcast",
      content: "Hello! Carezza matches families with trusted, vetted caregivers in under 48 hours. Reply CARE to get started.",
      summary: "Monthly broadcast message to community leads",
      memberId: "u-mgr-accra",
      branchId: "b-accra",
      date: new Date(Date.now() - 4 * 86400000),
      proofUrl: proofUrls[3],
      publishedLink: undefined,
      cost: 0,
      leadsCount: 15,
      clientsCount: 5,
    },
  ];

  for (const a of activityData) {
    await db.insert(activities).values(a).onDuplicateKeyUpdate({ set: { content: a.content } });
  }

  // 5. Seed To-Dos
  const todoData = [
    {
      id: "t1",
      title: "Post in Caregiver Jobs Ghana by Friday",
      assigneeId: "u-tm-efua",
      createdById: "u-mgr-kumasi",
      dueDate: new Date(Date.now() + 3 * 86400000),
      status: "todo" as const,
      notes: "Focus on recruitment requirements",
    },
    {
      id: "t2",
      title: "Visit Grace Chapel for weekend prep",
      assigneeId: "u-tm-akosua",
      createdById: "u-mgr-accra",
      dueDate: new Date(Date.now() + 2 * 86400000),
      status: "in_progress" as const,
      notes: "Bring printed flyers and sign-up banner",
    },
    {
      id: "t3",
      title: "Record TikTok for Ramadan campaign",
      assigneeId: "u-tm-yaw",
      createdById: "u-admin",
      dueDate: new Date(Date.now() + 5 * 86400000),
      status: "todo" as const,
      notes: "Follow approved script",
    },
  ];
  for (const t of todoData) {
    await db.insert(todos).values(t).onDuplicateKeyUpdate({ set: { title: t.title } });
  }

  // 6. Seed Approvals & Assets
  const approvalData = [
    {
      id: "ap1",
      title: "Ramadan Wellness Flyer v3",
      type: "flyer" as const,
      submittedById: "u-tm-akosua",
      reviewerId: "u-mgr-accra",
      previewUrl: proofUrls[0],
      description: "Updated brand colors and call-to-action",
      status: "pending" as const,
      submittedAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      id: "ap2",
      title: "Caregiver Recruitment Reel",
      type: "video" as const,
      submittedById: "u-tm-efua",
      reviewerId: "u-mgr-kumasi",
      previewUrl: proofUrls[2],
      description: "30-sec vertical video for IG & TikTok",
      status: "pending" as const,
      submittedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      id: "ap3",
      title: "WhatsApp broadcast copy — August",
      type: "text" as const,
      submittedById: "u-tm-yaw",
      reviewerId: "u-admin",
      previewUrl: proofUrls[4],
      description: "Approved draft copy for monthly broadcast",
      status: "approved" as const,
      submittedAt: new Date(Date.now() - 3 * 86400000),
      reviewedAt: new Date(Date.now() - 2 * 86400000),
    },
  ];

  for (const ap of approvalData) {
    await db.insert(approvals).values(ap).onDuplicateKeyUpdate({ set: { title: ap.title } });
  }

  const assetData = [
    {
      id: "as1",
      approvalId: "ap3",
      title: "Carezza Master Flyer",
      description: "Approved recruitment flyer",
      type: "flyer" as const,
      previewUrl: proofUrls[0],
      version: "v4.1",
      fileUrl: proofUrls[0],
    },
    {
      id: "as2",
      title: "Brand Story Video",
      description: "60-sec brand video with subtitles",
      type: "video" as const,
      previewUrl: proofUrls[2],
      version: "v2.0",
      fileUrl: proofUrls[2],
    },
    {
      id: "as3",
      title: "Standard WhatsApp Broadcast",
      description: "Approved monthly broadcast copy",
      type: "text" as const,
      previewUrl: proofUrls[3],
      version: "v3.0",
      body: "Hello 👋 — Carezza matches families with trusted, vetted caregivers in under 48 hours. Reply CARE to get started.",
    },
  ];

  for (const as of assetData) {
    await db.insert(assets).values(as).onDuplicateKeyUpdate({ set: { title: as.title } });
  }

  // 7. Seed Leads
  const leadData = [
    { id: "l1", name: "Adjoa Mensah", contact: "+233 24 100 1001", activityId: "act-1", assignedToId: "u-admin", status: "new" as const },
    { id: "l2", name: "Kofi Boateng", contact: "+233 24 101 1002", activityId: "act-1", assignedToId: "u-admin", status: "contacted" as const },
    { id: "l3", name: "Ama Owusu", contact: "+233 24 102 1003", activityId: "act-2", assignedToId: "u-admin", status: "qualified" as const },
    { id: "l4", name: "Yaw Asante", contact: "+233 24 103 1004", activityId: "act-2", assignedToId: "u-admin", status: "client" as const },
  ];
  for (const l of leadData) {
    await db.insert(leads).values(l).onDuplicateKeyUpdate({ set: { name: l.name } });
  }

  // 8. Seed Company Links
  const linkData = [
    { id: "cl1", platform: "Website", label: "Official Website", category: "primary", url: "https://carezza.com", handle: "carezza.com" },
    { id: "cl2", platform: "Facebook", label: "Facebook Page", category: "social", url: "https://facebook.com/carezzagh", handle: "@carezzagh" },
    { id: "cl3", platform: "Instagram", label: "Instagram Handle", category: "social", url: "https://instagram.com/carezza_gh", handle: "@carezza_gh" },
    { id: "cl4", platform: "TikTok", label: "TikTok Profile", category: "social", url: "https://tiktok.com/@carezza_gh", handle: "@carezza_gh" },
    { id: "cl5", platform: "LinkedIn", label: "LinkedIn Page", category: "social", url: "https://linkedin.com/company/carezza", handle: "Carezza" },
    { id: "cl6", platform: "YouTube", label: "YouTube Channel", category: "social", url: null, handle: undefined },
    { id: "cl7", platform: "X", label: "X Profile", category: "social", url: null, handle: undefined },
    { id: "cl8", platform: "WhatsApp Business", label: "WhatsApp Support", category: "contact", url: "https://wa.me/233241234567", handle: "+233 24 123 4567" },
    { id: "cl9", platform: "Email", label: "Contact Email", category: "contact", url: "mailto:hello@carezza.com", handle: "hello@carezza.com" },
  ];

  for (const cl of linkData) {
    await db.insert(companyLinks).values(cl).onDuplicateKeyUpdate({ set: { url: cl.url, handle: cl.handle } });
  }

  console.log("✅ MySQL Database Seeding Complete!");
  console.log("🔑 Default Seed User Accounts (Password: Password123!):");
  console.log("   - Admin:       admin@carezza.com");
  console.log("   - Manager HQ:  manager.accra@carezza.com");
  console.log("   - Manager Kum: manager.kumasi@carezza.com");
  console.log("   - Team Member: efua@carezza.com");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
