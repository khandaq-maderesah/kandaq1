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

## Completed Human Queue
*(Items resolved by the project owner will be archived here with resolution date)*
