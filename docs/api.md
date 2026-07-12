# MessMate API Reference

Base URL: `https://api.messmate.app` (Production)

## Authentication
All secured endpoints require the `Authorization: Bearer <token>` header.

### `POST /api/auth/register`
Registers a new user (Admin or Student) and dispatches an OTP.

### `POST /api/auth/login`
Authenticates a user via Email and Password. Returns JWT and Refresh Token.

### `POST /api/auth/refresh`
Rotates the session and provides a fresh JWT access token.

## Subscription & Billing (Admins Only)
### `GET /api/subscription/status`
Fetches the current capacity, limits, and expiry dates of the institution.

### `GET /api/subscription/transactions`
Fetches a paginated list of all payments.
**Query Parameters**:
- `skip` (default: 0)
- `limit` (default: 50)

## Students (Students Only)
### `GET /api/student/today`
Returns today's specific menu and the student's opt-in status.

### `PUT /api/student/today`
Updates a student's eating status (ON/OFF) and specific food preferences to reduce waste.
