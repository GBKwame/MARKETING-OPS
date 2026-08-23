import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  getMeApi,
  logoutApi,
  getUsersApi,
  getBranchesApi,
  createBranchApi,
  getActivitiesApi,
  createActivityApi,
  updateActivityApi,
  deleteActivityApi,
  getTodosApi,
  updateTodoApi,
  createTodoApi,
  getApprovalsApi,
  createApprovalApi,
  updateApprovalStatusApi,
  deleteApprovalApi,
  getAssetsApi,
  createAssetApi,
  deleteAssetApi,
  renameAssetCategoryApi,
  deleteAssetCategoryApi,
  getLeadsApi,
  createLeadApi,
  updateLeadApi,
  deleteLeadApi,
  getCompanyLinksApi,
  updateCompanyLinkApi,
  getCampaignsApi,
  getNotificationsApi,
  markNotificationsReadApi,
  getTeamApi,
  inviteTeamMemberApi,
  deleteTeamMemberApi,
  promoteTeamMemberApi,
} from "./api";

export type Role = "super_admin" | "admin" | "manager" | "marketer";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  branch?: string;
  branchName?: string;
  branchId?: string | null;
  campaignId?: string | null;
  campaignName?: string;
  invitationStatus?: "pending" | "accepted" | "revoked";
  supervisorId?: string | null;
  avatar: string;
  picture?: string | null;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  budget: number;
  status: string;
}

export interface Activity {
  id: string;
  campaign: string;
  channel: string;
  approach: string;
  destination: string;
  content: string;
  summary: string;
  memberId: string;
  memberName?: string;
  branch: string;
  branchId?: string;
  date: string;
  proofUrl?: string;
  proof: string;
  publishedLink?: string;
  cost: number;
  leadsCount?: number;
  leads: number;
  clientsCount?: number;
  clients: number;
}

export interface Todo {
  id: string;
  title: string;
  assigneeId: string;
  createdById?: string;
  dueDate: string;
  status: "todo" | "in_progress" | "done";
  notes?: string;
}

export interface Approval {
  id: string;
  title: string;
  type: "flyer" | "video" | "image" | "text" | "other";
  submittedById: string;
  submittedAt: string;
  previewUrl?: string;
  preview?: string;
  description: string;
  status: "draft" | "pending" | "approved" | "rejected";
}

export interface Asset {
  id: string;
  title: string;
  description: string;
  type: "flyer" | "video" | "image" | "text" | "other";
  previewUrl?: string;
  preview?: string;
  category?: string;
  version: string;
  body?: string;
  fileUrl?: string;
}

export interface Lead {
  id: string;
  name: string;
  contact: string;
  campaign?: string | null;
  channel?: string | null;
  approach?: string | null;
  destination?: string | null;
  assignedToId?: string | null;
  memberName?: string | null;
  branchId?: string | null;
  branch?: string | null;
  notes?: string | null;
  comments?: string | null;
  activityId?: string | null;
  status?: "new" | "contacted" | "qualified" | "client";
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  createdAt: string;
  read: boolean;
  kind?: "activity" | "todo" | "approval";
}

export interface CompanyLink {
  platform:
    | "Website"
    | "Facebook"
    | "Instagram"
    | "TikTok"
    | "LinkedIn"
    | "YouTube"
    | "X"
    | "WhatsApp Business"
    | "Email";
  url: string | null;
  handle?: string;
}

export interface Branch {
  id: string;
  name: string;
  location?: string | null;
}

interface StoreValue {
  currentUser: Member | null;
  setCurrentUser: (user: Member | null) => void;
  logout: () => Promise<void>;
  members: Member[];
  branches: Branch[];
  campaigns: Campaign[];
  totalBudget: number;
  activities: Activity[];
  todos: Todo[];
  setTodoStatus: (id: string, status: Todo["status"]) => Promise<void>;
  createTodo: (title: string, assigneeId: string, dueDate: string, notes?: string) => Promise<void>;
  approvals: Approval[];
  setApprovalStatus: (id: string, status: Approval["status"]) => Promise<void>;
  deleteApproval: (id: string) => Promise<void>;
  assets: Asset[];
  createAsset: (data: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  renameAssetCategory: (oldCategory: string, newCategory: string) => Promise<void>;
  deleteAssetCategory: (category: string) => Promise<void>;
  leads: Lead[];
  createLead: (data: Partial<Lead>) => Promise<void>;
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  companyLinks: CompanyLink[];
  updateCompanyLink: (platform: string, url: string | null, handle?: string) => Promise<void>;
  notifications: Notification[];
  markAllRead: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  memberById: (id: string) => Member | undefined;
  logActivity: (data: Partial<Activity>) => Promise<void>;
  updateActivity: (id: string, data: Partial<Activity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  inviteTeamMember: (data: any) => Promise<{ success: boolean; emailSent: boolean; whatsappUrl: string; inviteMessage: string; user: any }>;
  deleteTeamMember: (id: string) => Promise<void>;
  promoteTeamMember: (id: string, data: any) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading: boolean;
  refreshData: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

const DEFAULT_GUEST: Member = {
  id: "u-admin",
  name: "Ama Boateng",
  email: "admin@carezza.com",
  role: "admin",
  branch: "Accra HQ",
  avatar: "AB",
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyLinks, setCompanyLinks] = useState<CompanyLink[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const [branches, setBranches] = useState<Branch[]>([]);

  const loadAllData = useCallback(async () => {
    try {
      const [uRes, m, b, c, act, t, app, ass, l, cl, notifs, teamRes] = await Promise.all([
        getMeApi().catch(() => ({ user: null })),
        getUsersApi().catch(() => []),
        getBranchesApi().catch(() => []),
        getCampaignsApi().catch(() => []),
        getActivitiesApi().catch(() => []),
        getTodosApi().catch(() => []),
        getApprovalsApi().catch(() => []),
        getAssetsApi().catch(() => []),
        getLeadsApi().catch(() => []),
        getCompanyLinksApi().catch(() => []),
        getNotificationsApi().catch(() => []),
        getTeamApi().catch(() => null),
      ]);

      const branchMap = new Map((b || []).map((br: any) => [br.id, br.name]));
      const campaignMap = new Map((c || []).map((cp: any) => [cp.id, cp.name]));

      if (uRes?.user) setCurrentUser(uRes.user);

      if (teamRes && Array.isArray(teamRes)) {
        setMembers(teamRes);
      } else if (Array.isArray(m)) {
        setMembers(
          m.map((usr: any) => ({
            ...usr,
            branchName: usr.branchName || (usr.branchId ? branchMap.get(usr.branchId) : null) || "Workspace HQ",
            campaignName: usr.campaignName || (usr.campaignId ? campaignMap.get(usr.campaignId) : null) || "General Campaign",
          }))
        );
      }
      setBranches(b);
      setCampaigns(c);
      setActivities(
        act.map((a: any) => ({
          ...a,
          proof: a.proofUrl || a.proof || "",
          leads: a.leadsCount ?? a.leads ?? 0,
          clients: a.clientsCount ?? a.clients ?? 0,
          branch: a.branch || (a.branchId ? branchMap.get(a.branchId) : null) || "Accra HQ",
          memberName: a.memberName || null,
        }))
      );
      setTodos(t);
      setApprovals(app);
      setAssets(ass);
      setLeads(l);
      setCompanyLinks(cl);
      setNotifications(
        notifs.map((n: any) => ({
          ...n,
          body: n.message || n.body || "",
        }))
      );
    } catch (e) {
      console.error("Error loading API data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // 10-second periodic background notification polling for instant live updates & browser push alerts
    const interval = setInterval(async () => {
      try {
        const notifs = await getNotificationsApi().catch(() => null);
        if (notifs && Array.isArray(notifs)) {
          const formatted = notifs.map((n: any) => ({
            ...n,
            body: n.message || n.body || "",
          }));

          setNotifications((prev) => {
            const prevIds = new Set(prev.map((p) => p.id));
            const newArrived = formatted.filter((n) => !prevIds.has(n.id) && !n.read);

            // Trigger browser notification & toast for new incoming events
            newArrived.forEach((n) => {
              toast.info(n.title, { description: n.body });
              if ("Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification(n.title, {
                    body: n.body,
                    icon: "/logo.jpg",
                  });
                } catch (e) {}
              }
            });

            return formatted;
          });
        }
      } catch (e) {}
    }, 10000);

    return () => clearInterval(interval);
  }, [loadAllData]);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
    setCurrentUser(null);
  }, []);

  const totalBudget = useMemo(
    () => campaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
    [campaigns],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markNotificationsReadApi().catch(() => {});
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationsReadApi(id).catch(() => {});
  }, []);

  const setTodoStatus = useCallback(async (id: string, status: Todo["status"]) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await updateTodoApi(id, { status }).catch(() => {});
  }, []);

  const createTodo = useCallback(
    async (title: string, assigneeId: string, dueDate: string, notes?: string) => {
      const creatorId = currentUser?.id || "u-admin";
      const newT = await createTodoApi({ title, assigneeId, createdById: creatorId, dueDate, notes });
      setTodos((prev) => [newT, ...prev]);
      const updatedNotifs = await getNotificationsApi().catch(() => []);
      if (updatedNotifs.length > 0) {
        setNotifications(updatedNotifs.map((n: any) => ({ ...n, body: n.message || n.body })));
      }
    },
    [currentUser]
  );

  const setApprovalStatus = useCallback(async (id: string, status: Approval["status"]) => {
    if (status === "approved" || status === "rejected") {
      await updateApprovalStatusApi(id, status);
    }
    await loadAllData();
  }, [loadAllData]);

  const deleteApproval = useCallback(async (id: string) => {
    await deleteApprovalApi(id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateCompanyLink = useCallback(
    async (platform: string, url: string | null, handle?: string) => {
      await updateCompanyLinkApi({ platform, url, handle });
      await loadAllData();
    },
    [loadAllData]
  );

  const logActivity = useCallback(
    async (data: Partial<Activity>) => {
      const memId = currentUser?.id || "u-admin";
      const newAct = await createActivityApi({
        campaign: data.campaign || "Caregiver Recruitment Q3",
        channel: data.channel || "Facebook",
        approach: data.approach || "Organic Post",
        destination: data.destination || "Caregiver Jobs Ghana",
        content: data.content || "Logged new campaign activity",
        summary: data.summary || "Summary note",
        memberId: memId,
        branchId: data.branchId || currentUser?.branchId || "b-accra",
        proofUrl: data.proofUrl || data.proof || null,
        publishedLink: data.publishedLink || null,
        cost: data.cost ?? 0,
        leadsCount: data.leads ?? data.leadsCount ?? 0,
        clientsCount: data.clients ?? data.clientsCount ?? 0,
      });

      const matchedBranch = branches.find((b) => b.id === (newAct.branchId || data.branchId));

      const formattedNew: Activity = {
        ...newAct,
        proof: newAct.proofUrl || newAct.proof || "",
        leads: newAct.leadsCount ?? newAct.leads ?? 0,
        clients: newAct.clientsCount ?? newAct.clients ?? 0,
        branch: matchedBranch?.name || newAct.branch || "Accra HQ",
      };

      setActivities((prev) => [formattedNew, ...prev]);
      const updatedNotifs = await getNotificationsApi().catch(() => []);
      if (updatedNotifs.length > 0) {
        setNotifications(updatedNotifs.map((n: any) => ({ ...n, body: n.message || n.body })));
      }
    },
    [currentUser]
  );

  const updateActivity = useCallback(async (id: string, data: Partial<Activity>) => {
    await updateActivityApi(id, {
      ...data,
      proofUrl: data.proofUrl || data.proof,
      leadsCount: data.leads,
      clientsCount: data.clients,
    });
    await loadAllData();
  }, [loadAllData]);

  const deleteActivity = useCallback(async (id: string) => {
    await deleteActivityApi(id);
    setActivities((prev) => prev.filter((act) => act.id !== id));
  }, []);

  const createAsset = useCallback(async (data: Partial<Asset>) => {
    await createAssetApi(data);
    await loadAllData();
  }, [loadAllData]);

  const deleteAsset = useCallback(async (id: string) => {
    await deleteAssetApi(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const renameAssetCategory = useCallback(async (oldCategory: string, newCategory: string) => {
    await renameAssetCategoryApi(oldCategory, newCategory);
    await loadAllData();
  }, [loadAllData]);

  const deleteAssetCategory = useCallback(async (category: string) => {
    await deleteAssetCategoryApi(category);
    await loadAllData();
  }, [loadAllData]);

  const createLead = useCallback(async (data: Partial<Lead>) => {
    const newLead = await createLeadApi(data);
    await loadAllData();
  }, [loadAllData]);

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    await updateLeadApi(id, data);
    await loadAllData();
  }, [loadAllData]);

  const deleteLead = useCallback(async (id: string) => {
    await deleteLeadApi(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const inviteTeamMember = useCallback(async (data: any) => {
    const res = await inviteTeamMemberApi(data);
    await loadAllData();
    return res;
  }, [loadAllData]);

  const deleteTeamMember = useCallback(async (id: string) => {
    await deleteTeamMemberApi(id);
    await loadAllData();
  }, [loadAllData]);

  const promoteTeamMember = useCallback(async (id: string, data: any) => {
    await promoteTeamMemberApi(id, data);
    await loadAllData();
  }, [loadAllData]);

  const value: StoreValue = {
    currentUser,
    setCurrentUser,
    logout,
    members,
    branches,
    campaigns,
    totalBudget,
    activities,
    logActivity,
    updateActivity,
    deleteActivity,
    todos,
    setTodoStatus,
    createTodo,
    approvals,
    setApprovalStatus,
    deleteApproval,
    assets,
    createAsset,
    deleteAsset,
    renameAssetCategory,
    deleteAssetCategory,
    leads,
    createLead,
    updateLead,
    deleteLead,
    inviteTeamMember,
    deleteTeamMember,
    promoteTeamMember,
    companyLinks,
    updateCompanyLink,
    notifications,
    markAllRead,
    markNotificationRead,
    memberById: (id) => members.find((m) => m.id === id),
    searchQuery,
    setSearchQuery,
    loading,
    refreshData: loadAllData,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}