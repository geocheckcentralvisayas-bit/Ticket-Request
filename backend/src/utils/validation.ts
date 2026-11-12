import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createTicketAccountSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  role: z.enum(['Regional Director', 'EMED', 'CPD', 'MIS', 'Extractor', 'GIS', 'Admin']),
  division: z.string().min(1, 'Division is required').max(100),
});

export const createTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['New Account', 'Access Change', 'Reset', 'Deactivation', 'Issue']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  accounts: z.array(createTicketAccountSchema).min(1, 'At least one account is required'),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['Open', 'In Review', 'Approved', 'Rejected', 'Closed']),
  note: z.string().optional(),
});

export const approveRejectAccountSchema = z.object({
  accountIds: z.array(z.number().int().positive()).min(1, 'At least one account ID required'),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
});

export const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, 'At least one recipient required'),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required'),
  ticketId: z.number().int().positive().optional(),
  requestId: z.number().int().positive().optional(),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['Regional Director', 'EMED', 'CPD', 'MIS', 'Extractor', 'GIS', 'Admin']).optional(),
  division: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  notification_prefs: z.string().max(2000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

export const resetPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const publicAccessRequestSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(120),
  email: z.string().email('Valid email is required'),
  organization: z.string().max(120).optional().or(z.literal('')),
  division: z.string().max(120).optional().or(z.literal('')),
  requested_role: z.string().max(80).optional().or(z.literal('')),
  request_type: z.string().max(80).optional().or(z.literal('')),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(5000),
});

export const accessRequestStatusSchema = z.object({
  status: z.enum(['New', 'In Review', 'Contacted', 'Approved', 'Rejected', 'Closed']),
  note: z.string().max(2000).optional(),
});

export const accessRequestReplySchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Message is required'),
  cc: z.array(z.string().email()).optional(),
  sendEmail: z.boolean().optional().default(true),
  isInternal: z.boolean().optional().default(false),
});

export const accessRequestLookupSchema = z.object({
  ref_number: z.string().min(1, 'Reference number is required'),
  email: z.string().email('Valid email is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateTicketAccountInput = z.infer<typeof createTicketAccountSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type ApproveRejectAccountInput = z.infer<typeof approveRejectAccountSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PublicAccessRequestInput = z.infer<typeof publicAccessRequestSchema>;
export type AccessRequestStatusInput = z.infer<typeof accessRequestStatusSchema>;
export type AccessRequestReplyInput = z.infer<typeof accessRequestReplySchema>;