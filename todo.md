# Hilcot TaskFlow - Project TODO

## Database & Backend
- [x] Design and apply DB schema: tasks, task_shares, task_reminders, activity_log tables
- [x] Backend: user listing procedure (for assignment/sharing)
- [x] Backend: task CRUD procedures (create, update, delete, list, get)
- [x] Backend: task assignment and sharing procedures
- [x] Backend: task status management (pending, in-progress, completed, overdue)
- [x] Backend: activity log procedures (create, list per task)
- [x] Backend: reminder configuration procedures (create, update, delete)
- [x] Backend: daily rollover logic (mark overdue tasks)
- [x] Backend: search and filter procedures (by priority, status, assignee, date range)
- [x] Backend: dashboard summary procedure (counts by category)
- [x] Backend: seed data (demo tasks and activity log)

## Frontend - Layout & Navigation
- [x] Global DashboardLayout with sidebar navigation
- [x] Professional corporate color palette and typography (index.css)
- [x] Responsive sidebar with collapsible navigation and badge counts
- [x] User profile/avatar in sidebar footer with dropdown

## Frontend - Pages
- [x] Login/Landing page
- [x] Executive Dashboard page (overview cards, priority filters, activity timeline)
- [x] All Tasks page (full list with search/filter)
- [x] Task Detail page (full info, activity log, collaborators, reminder info)
- [x] Create/Edit Task modal (all fields including reminder config)
- [x] Assigned To Me page
- [x] Assigned By Me page
- [x] Shared With Me page
- [x] Overdue Tasks page
- [x] Team Members page
- [x] Activity Log page (global)

## Frontend - Features
- [x] Task priority color coding (critical=red, priority=amber, normal=neutral)
- [x] Task status badges (pending, in-progress, completed, overdue)
- [x] Reminder frequency panel (shows when Priority/Critical selected)
- [x] Task completion with "completed by" and timestamp
- [x] Optimistic updates for task operations
- [x] Search bar with live filtering
- [x] Date range picker for filters
- [x] Activity timeline component
- [x] Background scheduler for reminders and daily rollover

## Testing & Delivery
- [x] Vitest unit tests for core backend procedures (9 tests, all passing)
- [x] Seed data applied (10 demo tasks, activity log entries)
- [x] Final checkpoint and publish

## Phase 2 — Production Upgrade

### Schema & Database
- [x] Add reminder_jobs table (id, task_id, interval_minutes, next_run_at, last_run_at, status, recipients JSON, reminder_count, created_by, created_at)
- [x] Add device_tokens table (id, user_id, token, platform, created_at, updated_at)
- [x] Add user_preferences table (id, user_id, quiet_hours_start, quiet_hours_end, max_reminders_per_day, created_at, updated_at)
- [x] Add completion_permission field to tasks (creator_only / assignee_only / any_participant)
- [x] Add escalated status to tasks enum
- [x] Add password_hash field to users (for email+password auth)
- [x] Apply all migrations via webdev_execute_sql

### Backend — Reminder Engine
- [x] Implement reminder_jobs DB helpers (create, fetch due, update, stop)
- [x] Rewrite scheduler to use reminder_jobs table (1-minute cycle)
- [x] Multi-user notification delivery (assignee + shared users + creator)
- [x] Escalation logic: 3 reminders → escalated, 6 → dashboard highlight, 12 → alert creator
- [x] Quiet hours enforcement per user preferences
- [x] Max reminders per day enforcement
- [x] Stop reminder_jobs immediately when task is completed

### Backend — Push Notifications (FCM/APNs)
- [x] Integrate Firebase Admin SDK for FCM (Android/Web push)
- [x] Implement APNs HTTP/2 push for iOS
- [x] Device token registration endpoint (trpc.notifications.registerDevice)
- [x] Push notification payload: task title, message, task ID for deep linking
- [x] Graceful fallback to Manus notifyOwner if no device tokens registered

### Backend — Authentication
- [x] Email + password registration procedure
- [x] Email + password login procedure (bcrypt hash comparison)
- [x] Keep Manus OAuth as secondary login option
- [x] Account deletion procedure (deletes user + all associated data)

### Backend — Task Logic
- [x] Enforce completion_permission on tasks.complete procedure
- [x] Waiting on Others query (creator = me, assignedTo ≠ me, status ≠ completed)
- [x] Escalated status tracking and dashboard highlight

### Frontend — New Views & Pages
- [x] Waiting on Others page/view in sidebar
- [x] Privacy Policy page (/privacy)
- [x] Terms of Service page (/terms)
- [x] Notification preferences panel (quiet hours, max per day, device token registration)
- [x] Escalated Tasks view in sidebar

### Frontend — UI Improvements
- [x] Dashboard escalation section (escalated tasks panel with rose highlight)
- [x] Waiting on Others and Escalated summary cards on dashboard
- [x] Footer with Privacy Policy and Terms of Service links
- [x] Preferences link in user profile dropdown

### Testing & Delivery
- [x] Update vitest tests to cover new procedures (28 tests, all passing)
- [x] Save checkpoint

## Phase 3 — Launch Blockers & Collaboration

### Email + Password Login / Registration UI
- [x] /login route with Sign In and Register tabs
- [x] Sign In form: email, password, validation, backend error display
- [x] Register form: full name, email, password, confirm password, validation
- [x] Wire to trpc.auth.emailLogin and trpc.auth.register
- [x] On success: redirect to /dashboard
- [x] Loading states and disabled button during submission
- [x] Manus OAuth kept as optional secondary method
- [x] Logout clearly accessible from sidebar

### Account Deletion UI
- [x] Danger Zone section on Notification Preferences or Settings page
- [x] Delete My Account button
- [x] Confirmation modal with clear warning text
- [x] Call trpc.auth.deleteAccount on confirm
- [x] On success: clear session, redirect to /login, show success message

### Task Comments Thread
- [x] Add task_comments table to schema (id, task_id, user_id, content, created_at, updated_at)
- [x] Generate and apply Drizzle migration
- [x] Backend: comments.list procedure (by task_id, authorized users only)
- [x] Backend: comments.add procedure (authorized users only)
- [x] Backend: comments.delete procedure (own comment or admin)
- [x] Frontend: Comments thread section on Task Detail page
- [x] Real-time optimistic updates for new comments
- [x] Avatar + name + timestamp per comment
- [x] Delete own comment button

### Testing & Delivery
- [x] Update vitest tests to cover new procedures (43 total, all passing)
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Phase 4 — Launch Blocker Verification & Completion

### Audit
- [ ] Verify Account Deletion UI is fully functional (not placeholder)
- [ ] Verify /login page is fully functional with both Sign In and Register tabs
- [ ] Verify Comments Thread has edit-own-comment support
- [ ] Verify comments table has deleted_at nullable field
- [ ] Verify activity log entry written on comment creation

### Account Deletion UI
- [ ] Danger Zone section visible on /settings/notifications
- [ ] Delete My Account button opens confirmation dialog
- [ ] Dialog explains permanent deletion clearly
- [ ] Require explicit confirmation before proceeding
- [ ] Loading state + disabled button during deletion
- [ ] Cancel option in dialog
- [ ] On success: clear session, redirect to /login, show success toast
- [ ] Error handling with user-friendly messages

### Email + Password Login / Registration
- [ ] /login route with Sign In and Register tabs
- [ ] Sign In: email, password, submit with loading state
- [ ] Register: full name, email, password, confirm password, submit
- [ ] Inline validation errors (email format, min password, confirm match)
- [ ] Backend error messages displayed clearly
- [ ] Redirect to /dashboard on success
- [ ] Manus OAuth labeled as optional secondary method
- [ ] Works fully without Manus OAuth

### Task Comments Thread
- [ ] task_comments table with deleted_at nullable field
- [ ] Edit own comment inline (textarea replace + save/cancel)
- [ ] Activity log entry on comment creation
- [ ] Soft-delete support (deleted_at)
- [ ] Empty state shown when no comments
- [ ] Loading skeleton while fetching

### Testing & Delivery
- [ ] Tests for valid registration, duplicate email, invalid confirm password
- [ ] Tests for valid login, invalid login
- [ ] Tests for comment CRUD and authorization
- [ ] TypeScript: 0 errors
- [ ] Screenshots: /login sign in, /login register, delete account modal, task detail with comments
- [ ] Save checkpoint

## Phase 5 — Final Production Launch Readiness

- [ ] Implement comment-edit activity logging (backend + tests)
- [ ] Publish production build via Manus UI checkpoint
- [ ] Capture production screenshots (no preview banner)
- [ ] Demonstrate multi-user collaboration flow with screenshots
- [ ] Prepare App Store submission metadata pack
- [ ] Compose full evidence report (all 7 output requirements)

## Phase 6 — Final Launch Delivery

### 1. Preview Banner Removal
- [ ] Audit codebase for any preview/demo banners or mode indicators
- [ ] Confirm production URL is live and public
- [ ] Capture screenshots showing no preview banner

### 2. Real Push Notifications
- [x] Wire FIREBASE_SERVICE_ACCOUNT_JSON secret to backend
- [x] Implement device token registration on frontend (service worker + Notification API)
- [ ] Test real FCM delivery with server logs

### 3. Multi-User Collaboration Test
- [ ] Seed second user account via SQL
- [ ] Demonstrate task assignment flow between two users with screenshots

### 4. Capacitor Mobile Wrapper
- [ ] Install Capacitor CLI and iOS/Android platforms
- [ ] Configure capacitor.config.ts
- [ ] Install @capacitor/push-notifications plugin
- [ ] Implement permission request and token registration flow in frontend
- [ ] Capture Xcode and Android Studio project screenshots

### 5. App Store Submission Pack
- [ ] Generate 1024x1024 app icon
- [ ] Prepare store metadata (name, subtitle, description, keywords)
- [ ] Capture store-quality screenshots

### 6. Final Status Declaration
- [ ] Honest assessment: Prototype / Beta / Production-Ready / App Store Ready

## Phase 7 — Mandatory Validation & Launch Steps

### 1. Real Browser Push Notification Test
- [ ] Log in via browser, go to Notification Preferences
- [ ] Click "Enable Push Notifications", confirm permission granted
- [ ] Confirm device token registered (screenshot)
- [ ] Create Priority task with 1-minute reminder interval
- [ ] Wait for reminder delivery, screenshot received notification
- [ ] Screenshot task detail opened from notification click
- [ ] Server log showing successful FCM send
- [ ] Mark task complete, verify reminders stop

### 2. Multi-User Collaboration Test
- [x] Seed Account B user via SQL
- [x] Account A creates Priority task, assigns to Account B
- [x] Account B logs in, sees task in correct view (screenshot)
- [x] Account B adds comment (screenshot)
- [x] Account A sees updated activity trail (screenshot)
- [x] Confirm completion_permission behavior
- [x] Confirm notifications go to correct users

### 3. Capacitor Mobile Wrapper
- [x] Install @capacitor/core, @capacitor/cli, @capacitor/ios, @capacitor/android
- [x] Install @capacitor/push-notifications
- [x] Run npx cap init with correct app ID
- [x] Build web assets (pnpm build)
- [x] Run npx cap add ios and npx cap add android
- [x] Run npx cap sync
- [x] Screenshot ios/ and android/ project directories
- [x] Document what remains before TestFlight/Play Console

### 4. Final Evidence Report
- [x] All screenshots collected
- [x] Server log snippets captured
- [x] Test count verified (58 tests, all passing)
- [x] TypeScript 0 errors confirmed
- [x] Production URL confirmed
- [x] Readiness status declared

## Phase 8 — Push Notification Fix

- [x] Audit and rewrite push support detection (check Notification, serviceWorker, PushManager, isSecureContext)
- [x] Surface exact failing reason in UI instead of generic "Unsupported"
- [x] Fix service worker registration: explicit register() call before token request
- [x] Add diagnostics panel to Notifications page (7 checks visible)
- [x] Add iOS browser-tab detection with correct explanation message
- [x] Verify /firebase-messaging-sw.js is served at correct path in production
- [x] Verify VITE_FIREBASE_* env vars are injected into service worker
- [x] Run tests, TypeScript check, save checkpoint

## Phase 9 — iOS Capacitor Startup Fix

- [x] Guard analytics script injection: only inject when VITE_ANALYTICS_ENDPOINT is a valid http/https URL
- [x] Skip analytics in Capacitor native context (capacitor:// protocol)
- [x] Fix index.html so no %VITE_ANALYTICS_ENDPOINT% placeholder appears in built output
- [x] Rebuild web assets (pnpm build)
- [x] Re-sync Capacitor iOS project (npx cap sync ios)
- [x] Verify no broken URLs in dist/public/index.html
- [x] Run tests, TypeScript check, save checkpoint
- [x] Export updated ZIP with fixed iOS project

## Phase 10 — iOS Runtime Startup Fix

- [x] Audit main.tsx for browser-only API calls (serviceWorker, Notification, PushManager, Firebase messaging)
- [x] Add Capacitor detection utility (isNativeApp helper)
- [x] Guard all browser-only startup code behind isNativeApp checks
- [x] Add window.onerror and unhandledrejection handlers before React mounts
- [x] Update ErrorBoundary to log full error details (message, stack, cause)
- [x] Add Capacitor-specific error reporting via console.error with full detail
- [x] Audit App.tsx and all route-level components for browser-only API usage
- [x] Audit firebaseMessaging.ts for browser-only calls at module load time
- [x] Rebuild web assets (pnpm build)
- [x] Re-sync Capacitor iOS project (npx cap sync)
- [x] Run tests and TypeScript check
- [x] Save checkpoint and export updated ZIP
