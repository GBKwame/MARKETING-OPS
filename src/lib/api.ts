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

export async function renameAssetCategoryApi(oldCategory: string, newCategory: string) {
  return fetchApi<{ success: boolean; oldCategory: string; newCategory: string }>("/api/assets/rename-category", {
    method: "POST",
    body: JSON.stringify({ oldCategory, newCategory }),
  });
}

export async function deleteAssetCategoryApi(category: string) {
  return fetchApi<{ success: boolean; category: string }>("/api/assets/delete-category", {
    method: "POST",
    body: JSON.stringify({ category }),
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

export async function updateCompanyLinkApi(data: {
  platform: string;
  url: string | null;
  handle?: string;
  label?: string;
  category?: string;
}) {
  return fetchApi<any>("/api/company-links", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
    targetRole: "super_admin" | "admin" | "manager" | "marketer";
    branchId?: string;
    campaignId?: string;
  }
) {
  return fetchApi<{ success: boolean; user: any }>(`/api/team/${id}/promote`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// SaaS Super Admin Organizations
export async function getOrganizationsApi() {
  return fetchApi<any[]>("/api/organizations");
}

export async function createOrganizationApi(data: {
  name: string;
  slug?: string;
  adminEmail: string;
}) {
  return fetchApi<{
    organization: any;
    inviteToken: string;
    inviteUrl: string;
    emailSent: boolean;
  }>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOrgStatusApi(id: string, status: "active" | "suspended") {
  return fetchApi<{ success: boolean; status: string; emailSent?: boolean }>(`/api/organizations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Workspace Instance Requests
export async function submitWorkspaceRequestApi(data: {
  organizationName: string;
  organizationSlug?: string;
}) {
  return fetchApi<{ success: boolean; request: any; emailSent: boolean }>("/api/workspace-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyWorkspaceRequestStatusApi() {
  return fetchApi<{ isApproved: boolean; request?: any; organization?: any }>("/api/workspace-requests/my-status");
}

export async function getWorkspaceRequestsApi() {
  return fetchApi<any[]>("/api/workspace-requests");
}

export async function approveWorkspaceRequestApi(id: string) {
  return fetchApi<{ success: boolean; organizationId: string; emailSent: boolean }>(`/api/workspace-requests/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectWorkspaceRequestApi(id: string, reason?: string) {
  return fetchApi<{ success: boolean; emailSent: boolean }>(`/api/workspace-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// Organization Settings (Cross-Branch Notifications)
export async function getOrgSettingsApi() {
  return fetchApi<{ organizationId: string; allowCrossBranchNotifications: boolean }>("/api/organization/settings");
}

export async function updateOrgSettingsApi(data: { allowCrossBranchNotifications: boolean }) {
  return fetchApi<{ success: boolean; allowCrossBranchNotifications: boolean }>("/api/organization/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
