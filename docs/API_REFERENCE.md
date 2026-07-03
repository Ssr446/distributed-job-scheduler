# Distributed Job Scheduler — API Reference

> **Base URL:** `http://localhost:3000/api/v1`
> **API Version:** v1
> **Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Common Response Format](#2-common-response-format)
3. [Error Response Format](#3-error-response-format)
4. [Rate Limiting](#4-rate-limiting)
5. [Endpoints](#5-endpoints)
   - [Auth](#51-auth)
   - [Organizations](#52-organizations)
   - [Projects](#53-projects)
   - [Queues](#54-queues)
   - [Jobs](#55-jobs)
   - [Workers](#56-workers)
   - [Dead Letter Queue](#57-dead-letter-queue)
   - [Retry Policies](#58-retry-policies)
   - [Metrics](#59-metrics)
   - [Health](#510-health)

---

## 1. Authentication & Authorization

The API uses **JWT Bearer tokens** for authentication. All authenticated requests must include an `Authorization` header.

### JWT Flow

1. **Register** or **Login** to receive an `accessToken` and a `refreshToken`.
2. Include the access token in every subsequent request:
   ```
   Authorization: Bearer <accessToken>
   ```
3. The **access token** expires after **15 minutes**.
4. The **refresh token** expires after **7 days** and can be used to obtain a new access token pair via the `/auth/refresh` endpoint.
5. On **logout**, both tokens are invalidated server-side.

### Token Lifetimes

| Token          | Expiry | Storage Recommendation       |
| -------------- | ------ | ---------------------------- |
| `accessToken`  | 15 min | In-memory / short-lived      |
| `refreshToken` | 7 days | Secure HTTP-only cookie / DB |

### Roles

| Role      | Description                                      |
| --------- | ------------------------------------------------ |
| `owner`   | Full control over the organization and resources. |
| `admin`   | Manage projects, queues, jobs, and members.       |
| `member`  | Create and manage jobs within assigned projects.  |

---

## 2. Common Response Format

All successful responses follow this envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

> [!NOTE]
> The `meta` field is only present on **paginated list** endpoints. Single-resource responses omit it.

### TypeScript Interface

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

---

## 3. Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body validation failed.",
    "details": [
      { "field": "email", "message": "Must be a valid email address." }
    ]
  }
}
```

### Error Codes

| Code               | HTTP Status | Description                                      |
| ------------------ | ----------- | ------------------------------------------------ |
| `VALIDATION_ERROR` | 400         | Request body or query parameter validation failed. |
| `UNAUTHORIZED`     | 401         | Missing, invalid, or expired authentication token. |
| `FORBIDDEN`        | 403         | Authenticated but lacks required role/permission.  |
| `NOT_FOUND`        | 404         | Requested resource does not exist.                 |
| `CONFLICT`         | 409         | Resource already exists or state conflict.         |
| `RATE_LIMITED`     | 429         | Too many requests; retry after `Retry-After` header. |
| `INTERNAL_ERROR`   | 500         | Unexpected server error.                           |

### TypeScript Interface

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
```

---

## 4. Rate Limiting

| Scope       | Limit              | Window |
| ----------- | ------------------ | ------ |
| Global      | 1000 req           | 1 min  |
| Per-user    | 200 req            | 1 min  |
| Auth routes | 20 req             | 1 min  |

Rate-limited responses include the following headers:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1719928800
Retry-After: 18
```

---

## 5. Endpoints

---

### 5.1 Auth

#### 5.1.1 Register

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/register` |
| **Auth** | None |
| **Description** | Create a new user account. |

**Request Body:**

```typescript
interface RegisterRequest {
  name: string;       // min 2, max 100
  email: string;      // valid email
  password: string;   // min 8, must include uppercase, lowercase, digit
}
```

**Response — `201 Created`:**

```typescript
interface RegisterResponse {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string; // ISO 8601
  };
  accessToken: string;
  refreshToken: string;
}
```

**Error Responses:** `VALIDATION_ERROR`, `CONFLICT` (email taken)

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Chen",
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "name": "Alice Chen",
      "email": "alice@example.com",
      "createdAt": "2026-07-02T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### 5.1.2 Login

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/login` |
| **Auth** | None |
| **Description** | Authenticate with email and password. |

**Request Body:**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response — `200 OK`:**

```typescript
interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
}
```

**Error Responses:** `VALIDATION_ERROR`, `UNAUTHORIZED` (invalid credentials)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "SecurePass123"}'
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "name": "Alice Chen",
      "email": "alice@example.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### 5.1.3 Refresh Token

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/refresh` |
| **Auth** | None (refresh token in body) |
| **Description** | Exchange a valid refresh token for a new access/refresh token pair. |

**Request Body:**

```typescript
interface RefreshRequest {
  refreshToken: string;
}
```

**Response — `200 OK`:**

```typescript
interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
```

**Error Responses:** `UNAUTHORIZED` (expired or revoked refresh token)

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIs..."}'
```

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### 5.1.4 Logout

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/logout` |
| **Auth** | Bearer token |
| **Description** | Invalidate the current access and refresh token. |

**Request Headers:**

```
Authorization: Bearer <accessToken>
```

**Response — `200 OK`:**

```json
{ "success": true, "data": { "message": "Logged out successfully." } }
```

**Error Responses:** `UNAUTHORIZED`

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

#### 5.1.5 Get Current User

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/auth/me` |
| **Auth** | Bearer token |
| **Description** | Retrieve the profile of the currently authenticated user. |

**Response — `200 OK`:**

```typescript
interface MeResponse {
  id: string;
  name: string;
  email: string;
  organizations: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
  }[];
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

```json
{
  "success": true,
  "data": {
    "id": "usr_a1b2c3d4e5f6",
    "name": "Alice Chen",
    "email": "alice@example.com",
    "organizations": [
      { "id": "org_x9y8z7w6", "name": "Acme Corp", "role": "owner" }
    ],
    "createdAt": "2026-07-02T12:00:00.000Z",
    "updatedAt": "2026-07-02T12:00:00.000Z"
  }
}
```

---

### 5.2 Organizations

#### 5.2.1 Create Organization

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations` |
| **Auth** | Bearer token (any authenticated user) |
| **Description** | Create a new organization. The creator becomes the `owner`. |

**Request Body:**

```typescript
interface CreateOrgRequest {
  name: string;          // min 2, max 100
  description?: string;  // max 500
}
```

**Response — `201 Created`:**

```typescript
interface Organization {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "description": "Main engineering organization"}'
```

```json
{
  "success": true,
  "data": {
    "id": "org_x9y8z7w6",
    "name": "Acme Corp",
    "description": "Main engineering organization",
    "createdBy": "usr_a1b2c3d4e5f6",
    "createdAt": "2026-07-02T12:05:00.000Z",
    "updatedAt": "2026-07-02T12:05:00.000Z"
  }
}
```

---

#### 5.2.2 List Organizations

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations` |
| **Auth** | Bearer token |
| **Description** | List organizations the current user belongs to. |

**Query Parameters:**

| Param  | Type   | Default | Description          |
| ------ | ------ | ------- | -------------------- |
| `page` | number | 1       | Page number.         |
| `limit`| number | 20      | Items per page (max 100). |

**Response — `200 OK`:**

```typescript
interface ListOrgsResponse {
  organizations: Organization[];
}
```

```bash
curl "http://localhost:3000/api/v1/organizations?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "id": "org_x9y8z7w6",
      "name": "Acme Corp",
      "description": "Main engineering organization",
      "createdBy": "usr_a1b2c3d4e5f6",
      "createdAt": "2026-07-02T12:05:00.000Z",
      "updatedAt": "2026-07-02T12:05:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

---

#### 5.2.3 Get Organization

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get details of a specific organization. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6 \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `NOT_FOUND`, `FORBIDDEN`

---

#### 5.2.4 Update Organization

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/organizations/:orgId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Update organization details. |

**Request Body:**

```typescript
interface UpdateOrgRequest {
  name?: string;
  description?: string;
}
```

```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/org_x9y8z7w6 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description for engineering org"}'
```

**Error Responses:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`

---

#### 5.2.5 Delete Organization

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId` |
| **Auth** | Bearer token — `owner` |
| **Description** | Permanently delete an organization and all its resources. |

**Response — `200 OK`:**

```json
{ "success": true, "data": { "message": "Organization deleted successfully." } }
```

```bash
curl -X DELETE http://localhost:3000/api/v1/organizations/org_x9y8z7w6 \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `NOT_FOUND`, `FORBIDDEN`

---

#### 5.2.6 List Organization Members

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/members` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | List all members of an organization. |

**Query Parameters:**

| Param  | Type   | Default | Description            |
| ------ | ------ | ------- | ---------------------- |
| `page` | number | 1       | Page number.           |
| `limit`| number | 20      | Items per page.        |
| `role` | string | —       | Filter by role: `owner`, `admin`, `member`. |

**Response — `200 OK`:**

```typescript
interface OrgMember {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/members?role=admin" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "userId": "usr_b2c3d4e5f6g7",
      "name": "Bob Martinez",
      "email": "bob@example.com",
      "role": "admin",
      "joinedAt": "2026-07-02T13:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

#### 5.2.7 Add Organization Member

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/members` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Invite a user to the organization with a specific role. |

**Request Body:**

```typescript
interface AddMemberRequest {
  email: string;
  role: "admin" | "member";
}
```

**Response — `201 Created`:**

```typescript
interface AddMemberResponse {
  userId: string;
  orgId: string;
  role: string;
  joinedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/members \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@example.com", "role": "admin"}'
```

**Error Responses:** `VALIDATION_ERROR`, `NOT_FOUND` (user), `CONFLICT` (already a member), `FORBIDDEN`

---

#### 5.2.8 Update Member Role

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/organizations/:orgId/members/:userId` |
| **Auth** | Bearer token — `owner` |
| **Description** | Change a member's role within the organization. |

**Request Body:**

```typescript
interface UpdateMemberRoleRequest {
  role: "admin" | "member";
}
```

```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/org_x9y8z7w6/members/usr_b2c3d4e5f6g7 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
```

**Error Responses:** `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`

---

#### 5.2.9 Remove Organization Member

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId/members/:userId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Remove a member from the organization. Owners cannot be removed. |

```bash
curl -X DELETE http://localhost:3000/api/v1/organizations/org_x9y8z7w6/members/usr_b2c3d4e5f6g7 \
  -H "Authorization: Bearer eyJhbGci..."
```

**Response — `200 OK`:**

```json
{ "success": true, "data": { "message": "Member removed successfully." } }
```

**Error Responses:** `NOT_FOUND`, `FORBIDDEN`

---

### 5.3 Projects

#### 5.3.1 Create Project

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Create a new project under an organization. |

**Request Body:**

```typescript
interface CreateProjectRequest {
  name: string;          // min 2, max 100
  description?: string;  // max 500
  tags?: string[];       // max 10 tags
}
```

**Response — `201 Created`:**

```typescript
interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Data Pipeline", "description": "ETL processing pipeline", "tags": ["etl", "production"]}'
```

```json
{
  "success": true,
  "data": {
    "id": "prj_m1n2o3p4",
    "orgId": "org_x9y8z7w6",
    "name": "Data Pipeline",
    "description": "ETL processing pipeline",
    "tags": ["etl", "production"],
    "createdBy": "usr_a1b2c3d4e5f6",
    "createdAt": "2026-07-02T12:10:00.000Z",
    "updatedAt": "2026-07-02T12:10:00.000Z"
  }
}
```

---

#### 5.3.2 List Projects

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | List all projects in an organization. |

**Query Parameters:**

| Param   | Type   | Default | Description          |
| ------- | ------ | ------- | -------------------- |
| `page`  | number | 1       | Page number.         |
| `limit` | number | 20      | Items per page.      |
| `search`| string | —       | Search by project name. |
| `tag`   | string | —       | Filter by tag.       |

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects?search=pipeline&limit=5" \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.3.3 Get Project

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get details of a specific project. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4 \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.3.4 Update Project

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Update project details. |

**Request Body:**

```typescript
interface UpdateProjectRequest {
  name?: string;
  description?: string;
  tags?: string[];
}
```

```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"tags": ["etl", "production", "critical"]}'
```

---

#### 5.3.5 Delete Project

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Delete a project and all associated queues and jobs. |

```bash
curl -X DELETE http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4 \
  -H "Authorization: Bearer eyJhbGci..."
```

**Response — `200 OK`:**

```json
{ "success": true, "data": { "message": "Project deleted successfully." } }
```

---

### 5.4 Queues

#### 5.4.1 Create Queue

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Create a new job queue within a project. |

**Request Body:**

```typescript
interface CreateQueueRequest {
  name: string;                 // min 2, max 100
  description?: string;
  concurrency: number;          // 1–1000, default 10
  maxRetries: number;           // 0–50, default 3
  retryPolicyId?: string;       // optional custom retry policy
  rateLimit?: {
    maxPerSecond: number;       // 1–10000
  };
  deadLetterConfig?: {
    maxRetries: number;         // after this, move to DLQ
    enabled: boolean;
  };
}
```

**Response — `201 Created`:**

```typescript
interface Queue {
  id: string;
  projectId: string;
  orgId: string;
  name: string;
  description: string | null;
  concurrency: number;
  maxRetries: number;
  retryPolicyId: string | null;
  rateLimit: { maxPerSecond: number } | null;
  deadLetterConfig: { maxRetries: number; enabled: boolean } | null;
  status: "active" | "paused";
  jobCounts: { pending: number; active: number; completed: number; failed: number };
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "email-notifications",
    "concurrency": 25,
    "maxRetries": 5,
    "rateLimit": { "maxPerSecond": 100 },
    "deadLetterConfig": { "maxRetries": 5, "enabled": true }
  }'
```

```json
{
  "success": true,
  "data": {
    "id": "que_q1r2s3t4",
    "projectId": "prj_m1n2o3p4",
    "orgId": "org_x9y8z7w6",
    "name": "email-notifications",
    "description": null,
    "concurrency": 25,
    "maxRetries": 5,
    "retryPolicyId": null,
    "rateLimit": { "maxPerSecond": 100 },
    "deadLetterConfig": { "maxRetries": 5, "enabled": true },
    "status": "active",
    "jobCounts": { "pending": 0, "active": 0, "completed": 0, "failed": 0 },
    "createdAt": "2026-07-02T12:15:00.000Z",
    "updatedAt": "2026-07-02T12:15:00.000Z"
  }
}
```

---

#### 5.4.2 List Queues

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | List all queues in a project. |

**Query Parameters:**

| Param    | Type   | Default | Description                      |
| -------- | ------ | ------- | -------------------------------- |
| `page`   | number | 1       | Page number.                     |
| `limit`  | number | 20      | Items per page.                  |
| `status` | string | —       | Filter: `active`, `paused`.      |

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues?status=active" \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.4.3 Get Queue

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get queue details including live job counts. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4 \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.4.4 Update Queue

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Update queue configuration. Changes apply to new jobs only. |

**Request Body:**

```typescript
interface UpdateQueueRequest {
  name?: string;
  description?: string;
  concurrency?: number;
  maxRetries?: number;
  retryPolicyId?: string | null;
  rateLimit?: { maxPerSecond: number } | null;
}
```

```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 50}'
```

---

#### 5.4.5 Delete Queue

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Delete a queue. Fails if there are active jobs unless `force=true`. |

**Query Parameters:**

| Param   | Type    | Default | Description                       |
| ------- | ------- | ------- | --------------------------------- |
| `force` | boolean | false   | Force delete, cancelling active jobs. |

```bash
curl -X DELETE "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4?force=true" \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `CONFLICT` (active jobs without `force`), `NOT_FOUND`, `FORBIDDEN`

---

#### 5.4.6 Pause Queue

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/pause` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Pause a queue. Active jobs continue; new jobs are held. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": { "id": "que_q1r2s3t4", "status": "paused", "message": "Queue paused successfully." }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/pause \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.4.7 Resume Queue

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/resume` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Resume a paused queue and begin processing held jobs. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": { "id": "que_q1r2s3t4", "status": "active", "message": "Queue resumed successfully." }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/resume \
  -H "Authorization: Bearer eyJhbGci..."
```

---

### 5.5 Jobs

#### 5.5.1 Create Job

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Enqueue a new job. |

**Request Body:**

```typescript
interface CreateJobRequest {
  name: string;                  // min 2, max 200
  type: string;                  // job handler type identifier
  payload: Record<string, any>;  // arbitrary JSON payload
  priority?: number;             // 1 (lowest) – 10 (highest), default 5
  delay?: number;                // delay in ms before job becomes eligible
  timeout?: number;              // max execution time in ms, default 30000
  scheduledAt?: string;          // ISO 8601 datetime for scheduled execution
  idempotencyKey?: string;       // prevents duplicate job creation
}
```

**Response — `201 Created`:**

```typescript
interface Job {
  id: string;
  queueId: string;
  name: string;
  type: string;
  payload: Record<string, any>;
  priority: number;
  status: "pending" | "active" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxRetries: number;
  delay: number;
  timeout: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  result: Record<string, any> | null;
  error: { message: string; stack?: string } | null;
  workerId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Send welcome email",
    "type": "email.send",
    "payload": { "to": "user@example.com", "template": "welcome", "locale": "en" },
    "priority": 8,
    "timeout": 15000,
    "idempotencyKey": "welcome-email-usr_c3d4e5f6"
  }'
```

```json
{
  "success": true,
  "data": {
    "id": "job_j1k2l3m4n5",
    "queueId": "que_q1r2s3t4",
    "name": "Send welcome email",
    "type": "email.send",
    "payload": { "to": "user@example.com", "template": "welcome", "locale": "en" },
    "priority": 8,
    "status": "pending",
    "attempts": 0,
    "maxRetries": 5,
    "delay": 0,
    "timeout": 15000,
    "scheduledAt": null,
    "startedAt": null,
    "completedAt": null,
    "failedAt": null,
    "result": null,
    "error": null,
    "workerId": null,
    "idempotencyKey": "welcome-email-usr_c3d4e5f6",
    "createdAt": "2026-07-02T12:20:00.000Z",
    "updatedAt": "2026-07-02T12:20:00.000Z"
  }
}
```

**Error Responses:** `VALIDATION_ERROR`, `CONFLICT` (duplicate idempotency key), `NOT_FOUND` (queue)

---

#### 5.5.2 Batch Create Jobs

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/batch` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Create multiple jobs in a single request (max 100 per batch). |

**Request Body:**

```typescript
interface BatchCreateJobsRequest {
  jobs: CreateJobRequest[];  // max 100 items
}
```

**Response — `201 Created`:**

```typescript
interface BatchCreateJobsResponse {
  created: number;
  failed: number;
  jobs: Job[];
  errors: { index: number; error: string }[];
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/batch \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      { "name": "Resize avatar 1", "type": "image.resize", "payload": { "imageId": "img_001", "size": "128x128" } },
      { "name": "Resize avatar 2", "type": "image.resize", "payload": { "imageId": "img_002", "size": "128x128" } }
    ]
  }'
```

```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "jobs": [ { "id": "job_a1a2a3a4", "..." : "..." }, { "id": "job_b1b2b3b4", "..." : "..." } ],
    "errors": []
  }
}
```

---

#### 5.5.3 List Jobs

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | List jobs in a queue with filtering and sorting. |

**Query Parameters:**

| Param      | Type   | Default      | Description                                          |
| ---------- | ------ | ------------ | ---------------------------------------------------- |
| `page`     | number | 1            | Page number.                                         |
| `limit`    | number | 20           | Items per page (max 100).                            |
| `status`   | string | —            | Filter: `pending`, `active`, `completed`, `failed`, `cancelled`. |
| `type`     | string | —            | Filter by job type.                                  |
| `priority` | number | —            | Filter by priority level.                            |
| `sortBy`   | string | `createdAt`  | Sort field: `createdAt`, `priority`, `scheduledAt`.  |
| `order`    | string | `desc`       | Sort order: `asc`, `desc`.                           |

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs?status=failed&sortBy=priority&order=desc&limit=5" \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.5.4 Get Job

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/:jobId` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get full details of a specific job. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/job_j1k2l3m4n5 \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.5.5 Cancel Job

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/:jobId/cancel` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Cancel a pending or active job. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "job_j1k2l3m4n5",
    "status": "cancelled",
    "message": "Job cancelled successfully."
  }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/job_j1k2l3m4n5/cancel \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `NOT_FOUND`, `CONFLICT` (job already completed/cancelled)

---

#### 5.5.6 Retry Job

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/:jobId/retry` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Retry a failed or cancelled job. Resets attempts and re-enqueues. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "job_j1k2l3m4n5",
    "status": "pending",
    "attempts": 0,
    "message": "Job re-enqueued for retry."
  }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/job_j1k2l3m4n5/retry \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `NOT_FOUND`, `CONFLICT` (job is not in a retryable state)

---

#### 5.5.7 Get Job Logs

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/:jobId/logs` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Retrieve execution logs emitted by a job. |

**Query Parameters:**

| Param   | Type   | Default | Description                |
| ------- | ------ | ------- | -------------------------- |
| `page`  | number | 1       | Page number.               |
| `limit` | number | 50      | Log lines per page.        |
| `level` | string | —       | Filter: `info`, `warn`, `error`, `debug`. |

**Response — `200 OK`:**

```typescript
interface JobLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta?: Record<string, any>;
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/job_j1k2l3m4n5/logs?level=error" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-07-02T12:20:05.123Z",
      "level": "info",
      "message": "Job started: Send welcome email"
    },
    {
      "timestamp": "2026-07-02T12:20:05.456Z",
      "level": "error",
      "message": "SMTP connection timed out",
      "meta": { "host": "smtp.example.com", "port": 587 }
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 2, "totalPages": 1 }
}
```

---

#### 5.5.8 Get Job Executions

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/jobs/:jobId/executions` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get the execution history of a job across all attempts. |

**Response — `200 OK`:**

```typescript
interface JobExecution {
  attempt: number;
  workerId: string;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  duration: number;       // ms
  result?: Record<string, any>;
  error?: { message: string; stack?: string };
}
```

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/jobs/job_j1k2l3m4n5/executions \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "attempt": 1,
      "workerId": "wrk_w1x2y3z4",
      "status": "failed",
      "startedAt": "2026-07-02T12:20:05.000Z",
      "finishedAt": "2026-07-02T12:20:06.234Z",
      "duration": 1234,
      "error": { "message": "SMTP connection timed out" }
    },
    {
      "attempt": 2,
      "workerId": "wrk_a5b6c7d8",
      "status": "completed",
      "startedAt": "2026-07-02T12:21:10.000Z",
      "finishedAt": "2026-07-02T12:21:11.567Z",
      "duration": 1567,
      "result": { "messageId": "msg_abc123", "delivered": true }
    }
  ]
}
```

---

### 5.6 Workers

#### 5.6.1 List Workers

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/workers` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | List all registered workers in an organization. |

**Query Parameters:**

| Param    | Type   | Default | Description                                |
| -------- | ------ | ------- | ------------------------------------------ |
| `page`   | number | 1       | Page number.                               |
| `limit`  | number | 20      | Items per page.                            |
| `status` | string | —       | Filter: `online`, `offline`, `draining`.   |
| `queueId`| string | —       | Filter by assigned queue.                  |

**Response — `200 OK`:**

```typescript
interface Worker {
  id: string;
  orgId: string;
  hostname: string;
  pid: number;
  status: "online" | "offline" | "draining";
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  queues: string[];        // queue IDs this worker processes
  lastHeartbeat: string;
  startedAt: string;
  version: string;
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/workers?status=online" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "id": "wrk_w1x2y3z4",
      "orgId": "org_x9y8z7w6",
      "hostname": "worker-node-01.internal",
      "pid": 12345,
      "status": "online",
      "activeJobs": 3,
      "completedJobs": 1542,
      "failedJobs": 23,
      "queues": ["que_q1r2s3t4"],
      "lastHeartbeat": "2026-07-02T12:29:55.000Z",
      "startedAt": "2026-07-02T08:00:00.000Z",
      "version": "1.2.0"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

#### 5.6.2 Get Worker

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/workers/:workerId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Get detailed status of a specific worker. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/workers/wrk_w1x2y3z4 \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.6.3 Drain Worker

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/workers/:workerId/drain` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Gracefully drain a worker. It finishes active jobs but accepts no new ones. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "wrk_w1x2y3z4",
    "status": "draining",
    "activeJobs": 3,
    "message": "Worker is draining. It will shut down after completing 3 active job(s)."
  }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/workers/wrk_w1x2y3z4/drain \
  -H "Authorization: Bearer eyJhbGci..."
```

**Error Responses:** `NOT_FOUND`, `CONFLICT` (worker already offline)

---

### 5.7 Dead Letter Queue

#### 5.7.1 List DLQ Jobs

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/dlq` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | List jobs in the dead letter queue (jobs that exhausted all retries). |

**Query Parameters:**

| Param   | Type   | Default | Description     |
| ------- | ------ | ------- | --------------- |
| `page`  | number | 1       | Page number.    |
| `limit` | number | 20      | Items per page. |
| `type`  | string | —       | Filter by job type. |

**Response — `200 OK`:**

```typescript
interface DLQJob {
  id: string;
  originalJobId: string;
  queueId: string;
  name: string;
  type: string;
  payload: Record<string, any>;
  attempts: number;
  lastError: { message: string; stack?: string };
  failedAt: string;
  movedToDlqAt: string;
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/dlq?limit=10" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": [
    {
      "id": "dlq_d1e2f3g4",
      "originalJobId": "job_j1k2l3m4n5",
      "queueId": "que_q1r2s3t4",
      "name": "Send welcome email",
      "type": "email.send",
      "payload": { "to": "user@example.com", "template": "welcome" },
      "attempts": 5,
      "lastError": { "message": "SMTP server unreachable after 5 attempts" },
      "failedAt": "2026-07-02T12:25:00.000Z",
      "movedToDlqAt": "2026-07-02T12:25:01.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

---

#### 5.7.2 Retry DLQ Job

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/dlq/:dlqJobId/retry` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Move a DLQ job back to the original queue for re-processing. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "dlq_d1e2f3g4",
    "newJobId": "job_n5o6p7q8",
    "status": "pending",
    "message": "Job re-enqueued from dead letter queue."
  }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/dlq/dlq_d1e2f3g4/retry \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.7.3 Purge DLQ

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId/dlq` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Permanently delete all jobs from the dead letter queue. |

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": { "purged": 14, "message": "14 dead letter job(s) purged." }
}
```

```bash
curl -X DELETE http://localhost:3000/api/v1/organizations/org_x9y8z7w6/projects/prj_m1n2o3p4/queues/que_q1r2s3t4/dlq \
  -H "Authorization: Bearer eyJhbGci..."
```

---

### 5.8 Retry Policies

#### 5.8.1 Create Retry Policy

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/organizations/:orgId/retry-policies` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Create a reusable retry policy that can be attached to queues. |

**Request Body:**

```typescript
interface CreateRetryPolicyRequest {
  name: string;                                     // min 2, max 100
  strategy: "fixed" | "exponential" | "linear";     // backoff strategy
  initialDelay: number;                              // ms, min 100
  maxDelay: number;                                  // ms, max 3600000 (1 hour)
  multiplier?: number;                               // for exponential, default 2
  maxRetries: number;                                // 1–50
  retryableErrors?: string[];                        // error codes/patterns to retry on
  nonRetryableErrors?: string[];                     // error codes/patterns to NOT retry on
}
```

**Response — `201 Created`:**

```typescript
interface RetryPolicy {
  id: string;
  orgId: string;
  name: string;
  strategy: "fixed" | "exponential" | "linear";
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  maxRetries: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
  createdAt: string;
  updatedAt: string;
}
```

```bash
curl -X POST http://localhost:3000/api/v1/organizations/org_x9y8z7w6/retry-policies \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Exponential with jitter",
    "strategy": "exponential",
    "initialDelay": 1000,
    "maxDelay": 60000,
    "multiplier": 2,
    "maxRetries": 8,
    "nonRetryableErrors": ["INVALID_PAYLOAD", "AUTH_EXPIRED"]
  }'
```

```json
{
  "success": true,
  "data": {
    "id": "rp_r1s2t3u4",
    "orgId": "org_x9y8z7w6",
    "name": "Exponential with jitter",
    "strategy": "exponential",
    "initialDelay": 1000,
    "maxDelay": 60000,
    "multiplier": 2,
    "maxRetries": 8,
    "retryableErrors": [],
    "nonRetryableErrors": ["INVALID_PAYLOAD", "AUTH_EXPIRED"],
    "createdAt": "2026-07-02T12:30:00.000Z",
    "updatedAt": "2026-07-02T12:30:00.000Z"
  }
}
```

---

#### 5.8.2 List Retry Policies

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/retry-policies` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | List all retry policies for an organization. |

**Query Parameters:**

| Param   | Type   | Default | Description     |
| ------- | ------ | ------- | --------------- |
| `page`  | number | 1       | Page number.    |
| `limit` | number | 20      | Items per page. |

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/retry-policies" \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.8.3 Get Retry Policy

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/retry-policies/:policyId` |
| **Auth** | Bearer token — `owner`, `admin`, `member` |
| **Description** | Get details of a specific retry policy. |

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/retry-policies/rp_r1s2t3u4 \
  -H "Authorization: Bearer eyJhbGci..."
```

---

#### 5.8.4 Update Retry Policy

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/organizations/:orgId/retry-policies/:policyId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Update a retry policy. Changes apply to newly enqueued jobs only. |

**Request Body:**

```typescript
interface UpdateRetryPolicyRequest {
  name?: string;
  strategy?: "fixed" | "exponential" | "linear";
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  maxRetries?: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}
```

```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/org_x9y8z7w6/retry-policies/rp_r1s2t3u4 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"maxRetries": 10, "maxDelay": 120000}'
```

---

#### 5.8.5 Delete Retry Policy

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/organizations/:orgId/retry-policies/:policyId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Delete a retry policy. Fails if it is in use by any queue. |

```bash
curl -X DELETE http://localhost:3000/api/v1/organizations/org_x9y8z7w6/retry-policies/rp_r1s2t3u4 \
  -H "Authorization: Bearer eyJhbGci..."
```

**Response — `200 OK`:**

```json
{ "success": true, "data": { "message": "Retry policy deleted successfully." } }
```

**Error Responses:** `NOT_FOUND`, `CONFLICT` (policy in use by queues), `FORBIDDEN`

---

### 5.9 Metrics

#### 5.9.1 Overview Metrics

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/metrics/overview` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Get a high-level dashboard summary for the organization. |

**Response — `200 OK`:**

```typescript
interface OverviewMetrics {
  totalQueues: number;
  totalJobs: number;
  activeWorkers: number;
  jobsByStatus: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  dlqSize: number;
  avgProcessingTime: number;   // ms
  successRate: number;         // 0.0 – 1.0
  uptime: number;              // seconds
}
```

```bash
curl http://localhost:3000/api/v1/organizations/org_x9y8z7w6/metrics/overview \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": {
    "totalQueues": 12,
    "totalJobs": 58432,
    "activeWorkers": 5,
    "jobsByStatus": {
      "pending": 234,
      "active": 42,
      "completed": 57890,
      "failed": 248,
      "cancelled": 18
    },
    "dlqSize": 37,
    "avgProcessingTime": 1823,
    "successRate": 0.9957,
    "uptime": 604800
  }
}
```

---

#### 5.9.2 Queue Metrics

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/metrics/queues/:queueId` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Get metrics for a specific queue. |

**Query Parameters:**

| Param    | Type   | Default | Description                                |
| -------- | ------ | ------- | ------------------------------------------ |
| `period` | string | `1h`    | Time window: `1h`, `6h`, `24h`, `7d`, `30d`. |

**Response — `200 OK`:**

```typescript
interface QueueMetrics {
  queueId: string;
  queueName: string;
  period: string;
  jobCounts: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
  };
  throughput: {
    processed: number;
    avgPerMinute: number;
  };
  latency: {
    avg: number;        // ms
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;    // 0.0 – 1.0
  topErrors: { message: string; count: number }[];
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/metrics/queues/que_q1r2s3t4?period=24h" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": {
    "queueId": "que_q1r2s3t4",
    "queueName": "email-notifications",
    "period": "24h",
    "jobCounts": { "pending": 12, "active": 5, "completed": 4320, "failed": 18 },
    "throughput": { "processed": 4338, "avgPerMinute": 3.01 },
    "latency": { "avg": 1245, "p50": 980, "p95": 3200, "p99": 8500 },
    "errorRate": 0.0041,
    "topErrors": [
      { "message": "SMTP connection timed out", "count": 12 },
      { "message": "Invalid recipient address", "count": 6 }
    ]
  }
}
```

---

#### 5.9.3 Throughput Metrics

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/organizations/:orgId/metrics/throughput` |
| **Auth** | Bearer token — `owner`, `admin` |
| **Description** | Get time-series throughput data for charting. |

**Query Parameters:**

| Param        | Type   | Default | Description                                    |
| ------------ | ------ | ------- | ---------------------------------------------- |
| `period`     | string | `24h`   | Time window: `1h`, `6h`, `24h`, `7d`, `30d`.  |
| `granularity`| string | `5m`    | Bucket size: `1m`, `5m`, `15m`, `1h`, `1d`.   |
| `queueId`    | string | —       | Optional: scope to a specific queue.           |

**Response — `200 OK`:**

```typescript
interface ThroughputMetrics {
  period: string;
  granularity: string;
  buckets: {
    timestamp: string;
    completed: number;
    failed: number;
    enqueued: number;
  }[];
}
```

```bash
curl "http://localhost:3000/api/v1/organizations/org_x9y8z7w6/metrics/throughput?period=1h&granularity=5m" \
  -H "Authorization: Bearer eyJhbGci..."
```

```json
{
  "success": true,
  "data": {
    "period": "1h",
    "granularity": "5m",
    "buckets": [
      { "timestamp": "2026-07-02T11:30:00.000Z", "completed": 45, "failed": 2, "enqueued": 50 },
      { "timestamp": "2026-07-02T11:35:00.000Z", "completed": 52, "failed": 0, "enqueued": 48 },
      { "timestamp": "2026-07-02T11:40:00.000Z", "completed": 38, "failed": 1, "enqueued": 41 }
    ]
  }
}
```

---

### 5.10 Health

#### 5.10.1 Health Check

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/health` |
| **Auth** | None |
| **Description** | Returns the health status of the API server and its dependencies. |

**Response — `200 OK`:**

```typescript
interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;           // seconds
  timestamp: string;        // ISO 8601
  services: {
    database: { status: "up" | "down"; latency: number };
    redis: { status: "up" | "down"; latency: number };
    messageQueue: { status: "up" | "down"; latency: number };
  };
}
```

```bash
curl http://localhost:3000/api/v1/health
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.2.0",
    "uptime": 604800,
    "timestamp": "2026-07-02T12:30:00.000Z",
    "services": {
      "database": { "status": "up", "latency": 3 },
      "redis": { "status": "up", "latency": 1 },
      "messageQueue": { "status": "up", "latency": 2 }
    }
  }
}
```

---

## Appendix: Endpoint Summary

| #  | Method   | Path                                                                 | Auth         |
|----|----------|----------------------------------------------------------------------|--------------|
| 1  | `POST`   | `/api/v1/auth/register`                                              | None         |
| 2  | `POST`   | `/api/v1/auth/login`                                                 | None         |
| 3  | `POST`   | `/api/v1/auth/refresh`                                               | None         |
| 4  | `POST`   | `/api/v1/auth/logout`                                                | Bearer       |
| 5  | `GET`    | `/api/v1/auth/me`                                                    | Bearer       |
| 6  | `POST`   | `/api/v1/organizations`                                              | Bearer       |
| 7  | `GET`    | `/api/v1/organizations`                                              | Bearer       |
| 8  | `GET`    | `/api/v1/organizations/:orgId`                                       | Bearer       |
| 9  | `PATCH`  | `/api/v1/organizations/:orgId`                                       | Bearer (owner/admin) |
| 10 | `DELETE` | `/api/v1/organizations/:orgId`                                       | Bearer (owner) |
| 11 | `GET`    | `/api/v1/organizations/:orgId/members`                               | Bearer       |
| 12 | `POST`   | `/api/v1/organizations/:orgId/members`                               | Bearer (owner/admin) |
| 13 | `PATCH`  | `/api/v1/organizations/:orgId/members/:userId`                       | Bearer (owner) |
| 14 | `DELETE` | `/api/v1/organizations/:orgId/members/:userId`                       | Bearer (owner/admin) |
| 15 | `POST`   | `/api/v1/organizations/:orgId/projects`                              | Bearer (owner/admin) |
| 16 | `GET`    | `/api/v1/organizations/:orgId/projects`                              | Bearer       |
| 17 | `GET`    | `/api/v1/organizations/:orgId/projects/:projectId`                   | Bearer       |
| 18 | `PATCH`  | `/api/v1/organizations/:orgId/projects/:projectId`                   | Bearer (owner/admin) |
| 19 | `DELETE` | `/api/v1/organizations/:orgId/projects/:projectId`                   | Bearer (owner/admin) |
| 20 | `POST`   | `/api/v1/organizations/:orgId/projects/:projectId/queues`            | Bearer (owner/admin) |
| 21 | `GET`    | `/api/v1/organizations/:orgId/projects/:projectId/queues`            | Bearer       |
| 22 | `GET`    | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId`   | Bearer       |
| 23 | `PATCH`  | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId`   | Bearer (owner/admin) |
| 24 | `DELETE` | `/api/v1/organizations/:orgId/projects/:projectId/queues/:queueId`   | Bearer (owner/admin) |
| 25 | `POST`   | `.../queues/:queueId/pause`                                          | Bearer (owner/admin) |
| 26 | `POST`   | `.../queues/:queueId/resume`                                         | Bearer (owner/admin) |
| 27 | `POST`   | `.../queues/:queueId/jobs`                                           | Bearer       |
| 28 | `POST`   | `.../queues/:queueId/jobs/batch`                                     | Bearer       |
| 29 | `GET`    | `.../queues/:queueId/jobs`                                           | Bearer       |
| 30 | `GET`    | `.../queues/:queueId/jobs/:jobId`                                    | Bearer       |
| 31 | `POST`   | `.../queues/:queueId/jobs/:jobId/cancel`                             | Bearer (owner/admin) |
| 32 | `POST`   | `.../queues/:queueId/jobs/:jobId/retry`                              | Bearer (owner/admin) |
| 33 | `GET`    | `.../queues/:queueId/jobs/:jobId/logs`                               | Bearer       |
| 34 | `GET`    | `.../queues/:queueId/jobs/:jobId/executions`                         | Bearer       |
| 35 | `GET`    | `.../queues/:queueId/workers`                                        | Bearer (owner/admin) |
| 36 | `GET`    | `/api/v1/organizations/:orgId/workers`                               | Bearer (owner/admin) |
| 37 | `GET`    | `/api/v1/organizations/:orgId/workers/:workerId`                     | Bearer (owner/admin) |
| 38 | `POST`   | `/api/v1/organizations/:orgId/workers/:workerId/drain`               | Bearer (owner/admin) |
| 39 | `GET`    | `.../queues/:queueId/dlq`                                            | Bearer (owner/admin) |
| 40 | `POST`   | `.../queues/:queueId/dlq/:dlqJobId/retry`                           | Bearer (owner/admin) |
| 41 | `DELETE` | `.../queues/:queueId/dlq`                                            | Bearer (owner/admin) |
| 42 | `POST`   | `/api/v1/organizations/:orgId/retry-policies`                        | Bearer (owner/admin) |
| 43 | `GET`    | `/api/v1/organizations/:orgId/retry-policies`                        | Bearer       |
| 44 | `GET`    | `/api/v1/organizations/:orgId/retry-policies/:policyId`              | Bearer       |
| 45 | `PATCH`  | `/api/v1/organizations/:orgId/retry-policies/:policyId`              | Bearer (owner/admin) |
| 46 | `DELETE` | `/api/v1/organizations/:orgId/retry-policies/:policyId`              | Bearer (owner/admin) |
| 47 | `GET`    | `/api/v1/organizations/:orgId/metrics/overview`                      | Bearer (owner/admin) |
| 48 | `GET`    | `/api/v1/organizations/:orgId/metrics/queues/:queueId`               | Bearer (owner/admin) |
| 49 | `GET`    | `/api/v1/organizations/:orgId/metrics/throughput`                    | Bearer (owner/admin) |
| 50 | `GET`    | `/api/v1/health`                                                     | None         |

---

> **Generated:** 2026-07-02 · **API Version:** v1 · **Distributed Job Scheduler**
