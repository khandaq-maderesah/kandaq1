# Human Action Queue (Owner Tasks Only)

This queue contains tasks that **CANNOT** be performed autonomously by AI agents and require direct action, account credentials, payment authorization, or business decisions from the human project owner.

Agents: Whenever you identify a requirement for API keys, external service accounts, domain verification, or design approval, append it here immediately.

---

## Active Human Queue

### 1. SMS Provider Selection & API Credentials (Phase 4)
- **Status**: PENDING OWNER DECISION
- **Description**: Decide on the SMS provider for parent notifications (e.g., Twilio, Africa's Talking, local Ethiopian SMS gateway) and provide:
  - Account SID / API Key
  - Auth Token / API Secret
  - Sender ID / Shortcode
- **Target File**: `.env.local`

### 2. Firebase Production Service Account Credentials
- **Status**: IN PLACE (Local dev), PENDING PRODUCTION REVIEW
- **Description**: Verify that the production Firebase project settings match `apphosting.yaml` and `.firebaserc`. Ensure automated database backup storage bucket has appropriate lifecycle retention policies configured.

### 3. Superadmin Initial Password Verification
- **Status**: PENDING OWNER CONFIRMATION
- **Description**: Confirm successful login and password reset for superadmin email (`abduha2222@gmail.com`) in the deployed or staging environment.

---


### 4. Persistent Login & Offline Device Cache (Phase 5) - Owner Security Sign-off
- **Status**: PENDING OWNER CONFIRMATION
- **Description**: Phase 5 keeps an Ustaz or Admin signed in for one year (`browserLocalPersistence` plus a 1-year `khandaq_session` cookie) and stores a copy of the user profile and the madrasa record in the device's `localStorage` (`kmms_cached_user_*`, `kmms_cached_school_*`) so the app opens and marks attendance without an internet connection. On a shared or borrowed tablet this means the next person can open the app and read the cached identity data without a password.
- **Owner decision needed**:
  1. Accept the convenience for shared madrasa tablets (recommended for the offline attendance use case), or
  2. Require a password / PIN unlock when the app is reopened after inactivity, or
  3. Reduce the session lifetime and drop the cached profile (which removes offline app opening).
- **Target Files**: `src/lib/firebase/config.ts`, `src/context/AuthContext.tsx`

## Completed Human Queue
*(Items resolved by the project owner will be archived here with resolution date)*
