/**
 * Frontend REST API Client
 * Communicates with Express backend via /api/* proxied by Vite.
 */

export async function fetchApi<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed with status ${res.status}`);
  }

  return res.json();
}

// Auth
export async function loginApi(credentials: { email: string; password: string }) {
  return fetchApi<{ user: any; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function registerApi(data: { name: string; email: string; password: string; token?: string }) {
  return fetchApi<{ user: any; token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function googleAuthApi(data: { credential?: string; email?: string; name?: string; picture?: string }) {
  return fetchApi<{ user: any; token: string }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyInvitationApi(params: { email?: string; token?: string }) {
  const query = new URLSearchParams();
  if (params.email) query.set("email", params.email);
  if (params.token) query.set("token", params.token);
  return fetchApi<{
    exists: boolean;
    userExists?: boolean;
    name?: string;
    email?: string;
    role?: string;
    branchName?: string;
    campaignName?: string;
    invitationStatus?: string;
  }>(`/api/invitations/verify?${query.toString()}`);
}

export async function logoutApi() {
  return fetchApi<{ success: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function getMeApi() {
  return fetchApi<{ user: any }>("/api/auth/me");
}

// Data Getters
export async function getUsersApi() {
  return fetchApi<any[]>("/api/users");
}

export async function getBranchesApi() {
  return fetchApi<any[]>("/api/branches");
}

export async function createBranchApi(data: { name: string; location?: string }) {
  return fetchApi<any>("/api/branches", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteBranchApi(id: string) {
  return fetchApi<{ success: boolean }>(`/api/branches/${id}`, { method: "DELETE" });
}

export async function updateBranchApi(id: string, data: { name?: string; location?: string }) {
  return fetchApi<{ success: boolean }>(`/api/branches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getCampaignsApi() {
  return fetchApi<any[]>("/api/campaigns");
}

export async function createCampaignApi(data: { name: string; description?: string; budget?: number }) {
  return fetchApi<any>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCampaignApi(id: string, data: { name?: string; budget?: number; description?: string }) {
  return fetchApi<{ success: boolean }>(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCampaignApi(id: string) {
  return fetchApi<{ success: boolean }>(`/api/campaigns/${id}`, { method: "DELETE" });
}

export async function getActivitiesApi() {
  return fetchApi<any[]>("/api/activities");
}

export async function createActivityApi(data: any) {
  return fetchApi<any>("/api/activities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateActivityApi(id: string, data: any) {
  return fetchApi<{ success: boolean; id: string }>(`/api/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteActivityApi(id: string) {
  return fetchApi<{ success: boolean; id: string }>(`/api/activities/${id}`, {
    method: "DELETE",
  });
}

export async function getNotificationsApi() {
  return fetchApi<any[]>("/api/notifications");
}

export async function markNotificationsReadApi(notificationId?: string) {
  return fetchApi<{ success: boolean }>("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify({ notificationId }),
  });
}

export async function getTodosApi() {
  return fetchApi<any[]>("/api/todos");
}

export async function createTodoApi(data: any) {
  return fetchApi<any>("/api/todos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTodoApi(id: string, data: any) {
  return fetchApi<any>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getApprovalsApi() {
  return fetchApi<any[]>("/api/approvals");
}

export async function createApprovalApi(data: any) {
  return fetchApi<any>("/api/approvals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateApprovalStatusApi(id: string, status: "approved" | "rejected") {
  return fetchApi<{ success: boolean; status: string }>(`/api/approvals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteApprovalApi(id: string) {
  return fetchApi<{ success: boolean; id: string }>(`/api/approvals/${id}`, {
    method: "DELETE",
  });
}

export async function getAssetsApi() {
  return fetchApi<any[]>("/api/assets");
}

export async function createAssetApi(data: any) {
  return fetchApi<any>("/api/assets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAssetApi(id: string) {
  return fetchApi<{ success: boolean; id: string }>(`/api/assets/${id}`, {
    method: "DELETE",
  });
}

export async function getLeadsApi() {
  return fetchApi<any[]>("/api/leads");
}

export async function createLeadApi(data: any) {
  return fetchApi<any>("/api/leads", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLeadApi(id: string, data: any) {
  return fetchApi<{ success: boolean; id: string }>(`/api/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteLeadApi(id: string) {
  return fetchApi<{ success: boolean; id: string }>(`/api/leads/${id}`, {
    method: "DELETE",
  });
}

export async function getCompanyLinksApi() {
  return fetchApi<any[]>("/api/company-links");
}

// Team Management & Invitations
export async function getTeamApi() {
  return fetchApi<any[]>("/api/team");
}

export async function inviteTeamMemberApi(data: {
  name: string;
  email: string;
  phone?: string;
  role: "manager" | "marketer";
  campaignId?: string;
  branchId?: string;
}) {
  return fetchApi<{
    success: boolean;
    emailSent: boolean;
    whatsappUrl: string;
    inviteMessage: string;
    user: any;
  }>("/api/team/invite", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTeamMemberApi(id: string) {
  return fetchApi<{ success: boolean; id: string }>(`/api/team/${id}`, {
    method: "DELETE",
  });
}

export async function promoteTeamMemberApi(
  id: string,
  data: {
    targetRole: "admin" | "manager" | "marketer";
    branchId?: string;
    campaignId?: string;
  }
) {
  return fetchApi<{ success: boolean; user: any }>(`/api/team/${id}/promote`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
