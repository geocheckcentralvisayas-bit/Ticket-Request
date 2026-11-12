# ENVIS Ticket Request & Account Handler Manager

A centralized, Discord-style ticketing and account-handling platform for **DENR-EMB Region VII (ENVIS)**. It replaces fragmented, ad-hoc account requests with a single auditable workflow — from public intake to approval, provisioning, and email correspondence.

![ENVIS Staff Workspace](docs/screenshots/dashboard.png)

## Why It Matters

Account and access requests in government operations often move through chat messages, paper forms, and spreadsheets — making them hard to track, easy to lose, and difficult to audit. This system provides:

- **A single source of truth** for every access request, ticket, decision, and message.
- **Transparency for requesters** through reference-number tracking and email updates.
- **Accountability for handlers** with role-based actions, recorded approvals/rejections, and a complete correspondence trail.
- **Faster, safer provisioning** by handling multiple accounts in one ticket and delivering outcomes directly by email.

## At a Glance

| Public Access Portal | Staff Workspace |
|:--:|:--:|
| ![Public access portal](docs/screenshots/request-access.png) | ![Ticket dashboard](docs/screenshots/dashboard.png) |
| *Anyone can submit and track a request without an account.* | *Handlers review, prioritize, and act on requests in one place.* |

| Shared Inbox & Triage | Request Detail & Reply |
|:--:|:--:|
| ![Staff inbox](docs/screenshots/inbox.png) | ![Request detail](docs/screenshots/request-detail.png) |
| *Incoming requests are triaged, assigned, and managed centrally.* | *Staff reply by email and maintain a full conversation thread.* |

| Ticket Conversation & Account Decisions |
|:--:|
| ![Ticket detail](docs/screenshots/ticket-detail.png) |
| *A single ticket can carry multiple accounts, each approved or rejected with a recorded outcome.* |

## How It Works

The platform supports the complete lifecycle of an ENVIS access request:

1. **Public intake** — A requester submits an access or account request through the public portal (no staff sign-in required) and receives a unique reference number.
2. **Confirmation & notification** — The requester receives an email confirmation, while the ENVIS team is notified of the new request.
3. **Inbox triage** — Handlers review incoming requests in a shared inbox, update status (*New → In Review → Contacted → Approved / Rejected / Closed*), assign ownership, and reply directly by email.
4. **Ticket handling** — Internal tickets organize the work. A single ticket can contain **multiple account rows**, each with its own role, division, and decision.
5. **Account decisions** — Authorized handlers approve or reject accounts individually or in bulk. Approved accounts are provisioned and credentials are delivered to the requester by email; rejections include the recorded reason.
6. **Email correspondence & outbox** — Notifications, replies, and credential deliveries are queued, logged, and traceable. Failed deliveries can be retried without recreating messages, so correspondence is never silently lost.
7. **Administration** — Role-based permissions govern who can view, approve, manage users, and manage accounts, ensuring actions are limited to authorized personnel.

## Request Access Guide (Public Users)

This section is for **requesters** using the public portal. No staff account is required.

### Quick steps

1. **Open the Request Access portal** and select **New request**.
2. **Enter your details** — full name and a valid email address (required), plus organization/division if applicable.
3. **Describe the access you need** — choose the request type and requested access/role, then provide a clear subject and message.
4. **Submit the request** — after submission, save your **reference number** (e.g. `REQ-YYYYMMDD-####`). A confirmation is sent to your email.
5. **Track your request** — open **Check status**, enter your reference number and the same email address to view the current status and updates.

### Request status at a glance

| Status | Meaning |
|---|---|
| **New** | Received and awaiting review |
| **In Review** | Being validated by a handler |
| **Contacted** | The team has replied or requested information |
| **Approved** | Approved; access/account details provided as instructed |
| **Rejected** | Not approved; see the message for the reason or next steps |
| **Closed** | Completed; no further action pending |

### Download the full user manual

For detailed, step-by-step instructions with screenshots, download the guide:

**[📄 Request Access User Guide (PDF)](docs/Request-Access-User-Guide.pdf)**

> Tip: Keep your reference number and use the same email address when checking status. Do not include passwords or sensitive credentials in your request message.

## Key Capabilities

- **Public intake with tracking** — reference-number submission and status lookup without sign-in.
- **Shared staff inbox** — centralized triage, assignment, status management, and email replies.
- **Multi-account tickets** — multiple account requests handled within a single ticket and decision flow.
- **Role-based access control** — permissions aligned to ENVIS roles (Admin, Regional Director, EMED, CPD, MIS, Extractor, GIS).
- **Email outbox & audit trail** — logged correspondence with retry support for failed deliveries.
- **Secure-by-default design** — hardened authentication, protected routes, and credential-safe handling.

## Roles & Permissions

| Permission | Admin | Regional Director | EMED | CPD | MIS | Extractor | GIS |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View all tickets | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Approve accounts | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Reject accounts | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Manage users | ✓ | ✓ | | | | | |
| Manage accounts | ✓ | | | | ✓ | | |
| Create tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Security & Data Handling

- **No credentials in the repository.** Secrets and passwords are never committed; sensitive configuration is managed outside version control.
- **Strong authentication & authorization.** Short-lived sessions, role-based access on every route, and ownership checks for protected resources.
- **Protected credential handling.** Passwords are stored as one-way hashes and are never exposed through the interface or API.
- **Hardened application surface.** Parameterized data access, strict request validation, rate limiting on sensitive/public endpoints, locked-down CORS and security headers, and redaction of sensitive values from logs and errors.
- **Auditable operations.** Requests, account decisions, and email correspondence are recorded to support traceability.

## Technology

| Layer | Stack |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Data | SQLite (WAL) with parameterized access |
| Email | SMTP via Nodemailer |
| Auth | JWT-based sessions with role permissions |

## License

Copyright (c) 2026 **Kent Agbayani (K3nt-Bytes)** and **EMB MIS, DENR-EMB Region VII**.  
All rights reserved. Internal/official use only — see [LICENSE](LICENSE) for details.
