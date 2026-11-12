/**
 * Converts flat SQLite rows (which use snake_case and joined "*_name" columns)
 * into the nested shapes consumed by the React frontend.
 */

export function mapTicketRow(row: any) {
  if (!row) return row;

  const requester = row.requester_id
    ? {
        id: row.requester_id,
        username: row.requester_username,
        email: row.requester_email,
        full_name: row.requester_name,
        role: row.requester_role,
        division: row.requester_division,
      }
    : undefined;

  const assignee = row.assignee_id
    ? {
        id: row.assignee_id,
        username: row.assignee_username,
        email: row.assignee_email,
        full_name: row.assignee_name,
        role: row.assignee_role,
        division: row.assignee_division,
      }
    : undefined;

  return { ...row, requester, assignee };
}

export function mapMessageRow(row: any) {
  if (!row) return row;

  const { username, full_name, role, ...message } = row;
  return {
    ...message,
    user: username
      ? { id: row.user_id, username, full_name, role }
      : undefined,
  };
}

export function mapRequestRow(row: any) {
  if (!row) return row;
  const assignee = row.assigned_to
    ? {
        id: row.assigned_to,
        username: row.assignee_username,
        email: row.assignee_email,
        full_name: row.assignee_name,
        role: row.assignee_role,
        division: row.assignee_division,
      }
    : undefined;
  return { ...row, assignee };
}

export function mapRequestMessageRow(row: any) {
  if (!row) return row;
  const { username, full_name, role, ...message } = row;
  return {
    ...message,
    is_internal: !!message.is_internal,
    user: username ? { id: row.user_id, username, full_name, role } : undefined,
  };
}
