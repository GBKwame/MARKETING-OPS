import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  getLeadsApi,
  createLeadApi,
  updateLeadApi,
  deleteLeadApi,
  getCompanyLinksApi,
  getCampaignsApi,
  getNotificationsApi,
  markNotificationsReadApi,
} from "./api";

export type Role = "admin" | "manager" | "marketer";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  branch?: string;
  branchId?: string | null;
  supervisorId?: string | null;
  avatar: string;
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
  const [currentUser, setCurrentUser] = useState<Member | null>(DEFAULT_GUEST);
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
      const [uRes, m, b, c, act, t, app, ass, l, cl, notifs] = await Promise.all([
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
      ]);

      const branchMap = new Map((b || []).map((br: any) => [br.id, br.name]));

      if (uRes?.user) setCurrentUser(uRes.user);
      setMembers(m);
      setBranches(b);
      setCampaigns(c);
      setActivities(
        act.map((a: any) => ({
          ...a,
          proof: a.proofUrl || a.proof || "",
          leads: a.leadsCount ?? a.leads ?? 0,
          clients: a.clientsCount ?? a.clients ?? 0,
          branch: a.branch || (a.branchId ? branchMap.get(a.branchId) : null) || "Accra HQ",
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
      setCompanyLinks((prev) =>
        prev.map((l) => (l.platform === platform ? { ...l, url, handle } : l)),
      );
    },
    []
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
    leads,
    createLead,
    updateLead,
    deleteLead,
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