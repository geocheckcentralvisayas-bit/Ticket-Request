// Shared types for ENVIS Ticket Request & Account Handler Manager

export type UserRole =
  | 'Regional Director'
  | 'EMED'
  | 'CPD'
  | 'MIS'
  | 'Extractor'
  | 'GIS'
  | 'Admin';

export type TicketCategory =
  | 'New Account'
  | 'Access Change'
  | 'Reset'
  | 'Deactivation'
  | 'Issue';

export type TicketStatus = 'Open' | 'In Review' | 'Approved' | 'Rejected' | 'Closed';

export type AccountStatus = 'Active' | 'Disabled' | 'Pending' | 'Approved' | 'Rejected';

export type MessageType = 'user' | 'handler' | 'system' | 'internal';

export type AccessRequestStatus = 'New' | 'In Review' | 'Contacted' | 'Approved' | 'Rejected' | 'Closed';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  division: string;
  is_active: boolean;
  notification_prefs?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requester_id: number;
  assignee_id: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  requester?: User;
  assignee?: User;
  requester_username?: string;
  requester_name?: string;
  requester_email?: string;
  assignee_username?: string;
  assignee_name?: string;
  assignee_email?: string;
  accounts?: TicketAccount[];
  messages?: Message[];
}

export interface TicketAccount {
  id: number;
  ticket_id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  division: string;
  status: AccountStatus;
  generated_password: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: number | null;
}

export interface Message {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  type: MessageType;
  is_internal: boolean;
  created_at: string;
  user?: User;
}

export interface EmailLog {
  id: number;
  ticket_id: number | null;
  request_id?: number | null;
  to_emails: string;
  cc_emails: string | null;
  subject: string;
  body: string;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AccessRequest {
  id: number;
  ref_number: string;
  full_name: string;
  email: string;
  organization?: string | null;
  division?: string | null;
  requested_role?: string | null;
  request_type: string;
  subject: string;
  message: string;
  status: AccessRequestStatus;
  assigned_to: number | null;
  internal_notes?: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assignee?: User;
  messages?: AccessRequestMessage[];
}

export interface AccessRequestMessage {
  id: number;
  request_id: number;
  direction: 'inbound' | 'outbound';
  channel: 'web' | 'email' | 'internal';
  sender_name?: string | null;
  sender_email?: string | null;
  recipient_emails?: string | null;
  subject?: string | null;
  body: string;
  email_log_id?: number | null;
  user_id?: number | null;
  is_internal: boolean;
  created_at: string;
  user?: User;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  category: TicketCategory;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  accounts: CreateTicketAccountRequest[];
}

export interface CreateTicketAccountRequest {
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  division: string;
}

export interface UpdateTicketStatusRequest {
  status: TicketStatus;
  note?: string;
}

export interface ApproveRejectAccountRequest {
  accountIds: number[];
  action: 'approve' | 'reject';
  note?: string;
}

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  ticketId?: number;
  requestId?: number;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const TICKET_CATEGORIES: { value: TicketCategory; label: string; icon: string }[] = [
  { value: 'New Account', label: 'New Account', icon: '👤' },
  { value: 'Access Change', label: 'Access Change', icon: '🔐' },
  { value: 'Reset', label: 'Reset', icon: '🔄' },
  { value: 'Deactivation', label: 'Deactivation', icon: '🚫' },
  { value: 'Issue', label: 'Issue', icon: '⚠️' },
];

export const TICKET_STATUSES: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'Open', label: 'Open', color: 'bg-green-500' },
  { value: 'In Review', label: 'In Review', color: 'bg-yellow-500' },
  { value: 'Approved', label: 'Approved', color: 'bg-blue-500' },
  { value: 'Rejected', label: 'Rejected', color: 'bg-red-500' },
  { value: 'Closed', label: 'Closed', color: 'bg-gray-500' },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'Regional Director', label: 'Regional Director' },
  { value: 'EMED', label: 'EMED' },
  { value: 'CPD', label: 'CPD' },
  { value: 'MIS', label: 'MIS' },
  { value: 'Extractor', label: 'Extractor' },
  { value: 'GIS', label: 'GIS' },
  { value: 'Admin', label: 'Admin' },
];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Regional Director': ['view_all', 'approve', 'reject', 'manage_users', 'view_reports', 'create_tickets', 'view_own'],
  'EMED': ['view_all', 'approve', 'reject', 'create_tickets', 'view_own'],
  'CPD': ['view_all', 'approve', 'reject', 'create_tickets', 'view_own'],
  'MIS': ['view_all', 'approve', 'reject', 'create_tickets', 'view_own', 'manage_accounts'],
  'Extractor': ['create_tickets', 'view_own'],
  'GIS': ['create_tickets', 'view_own'],
  'Admin': ['view_all', 'approve', 'reject', 'manage_users', 'manage_accounts', 'view_reports', 'manage_settings', 'create_tickets', 'view_own'],
};

export function canApprove(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.includes('approve') ?? false;
}

export function canReject(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.includes('reject') ?? false;
}

export function canViewAll(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.includes('view_all') ?? false;
}

export function canManageAccounts(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.includes('manage_accounts') ?? false;
}

export function generateTicketNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ENVIS-${year}${month}-${random}`;
}

export function generateRequestRef(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REQ-${y}${m}${d}-${random}`;
}

export function generateUsername(fullName: string): string {
  const parts = fullName.toLowerCase().trim().split(/\s+/);
  const firstName = parts[0] || 'user';
  const lastName = parts[parts.length - 1] || '';
  const base = lastName ? `${firstName}.${lastName}` : firstName;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${base}${random}`.replace(/[^a-z0-9.]/g, '').slice(0, 20);
}

export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}