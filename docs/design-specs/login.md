# Login (`/login`)

The entry point for all users. Accounts are pre-created by an organization admin — there is no self-signup flow in the prototype.

## Layout

Centered card on a plain background. Minimal — no navigation, no sidebar.

## Card contents

- App logo and name
- Email input
- Password input
- **"Log in"** CTA
- "Forgot password?" link (sends a reset email)

After login, the user is redirected based on role:
- Students → `/dashboard`
- Teachers → `/teacher/dashboard`

## What is intentionally excluded

- Self-signup / registration (handled by org admin, out of scope for prototype)
- Social login (future consideration)
- Role selection (role is determined server-side from the account)
