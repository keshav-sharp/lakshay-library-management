# Security Policy — Lakshay Library Management

The **Lakshay Library Management** team takes the security of our application, library student records, payment ledgers, and cloud synchronization seriously. We appreciate your efforts to responsibly disclose any vulnerabilities.

---

## 1. Supported Versions

We actively provide security updates, bug fixes, and patch releases for the current major release branch.

| Version Branch | Supported          | Release Channel                    |
| :------------- | :----------------- | :--------------------------------- |
| **2.0.x**      | :white_check_mark: | Active (Current Production & APK)  |
| **1.0.x**      | :x:                | Deprecated                         |

---

## 2. Reporting a Vulnerability

If you believe you have discovered a security vulnerability in Lakshay Library Management:

### Responsible Disclosure Channels
1. **GitHub Private Vulnerability Advisory (Preferred)**:
   - Navigate to the repository's **[Security Tab](https://github.com/keshav-sharp/lakshay-library-management/security)**.
   - Click **"Advisories"** $\rightarrow$ **"Report a vulnerability"** to submit a private security advisory directly to repository maintainers.
2. **Issue Tracker Protocol**:
   - **Do NOT** open a public issue, discussion, or PR disclosing undisclosed vulnerabilities, exploit payloads, or sensitive user tokens.

### Information to Include
To help us triage and resolve the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or minimal proof-of-concept (PoC) to reproduce the behavior.
- Affected components (e.g., Web PWA, Android APK, Google Drive Sync service, Firebase Firestore rules).
- Suggested remediation or patch (if available).

### Response Timelines
- **Initial Acknowledgement**: Within **48 hours** of receiving the report.
- **Triage & Impact Assessment**: Within **5 business days**.
- **Fix & Patch Deployment**: Critical vulnerabilities will be patched and released under an expedited semantic patch release (e.g., `v2.0.x`) with appropriate release notes and CVE attribution when requested.

---

## 3. Security Architecture & Threat Model

Lakshay Library Management implements multiple defensive layers to ensure data privacy and integrity:

### A. Google Drive Cloud Synchronization
- **Restricted Scopes**: Uses explicit Google Drive API scopes limited to app-created files and designated folders (`Lakshay_Library_Master/`).
- **Client Presence & Heartbeat Isolation**: Active client sessions exchange heartbeat timestamps and crash logs through sandboxed telemetry files (`active_clients_status.json`, `crash_logs.json`) without exposing customer credentials.
- **Conflict Prevention**: Role-based master/follower architecture prevents race conditions and corrupted write streams across multi-device networks.

### B. Device Storage & Data Isolation
- **Client-Side Persistence**: Primary local state is maintained in IndexedDB / LocalStorage / Capacitor SQLite sandboxes.
- **No Hardcoded Secrets**: All OAuth client IDs, tokens, and sensitive keys are managed securely and never checked into source control or exposed in public commits.
- **Sanitized Exports**: Local backup workers generate JSON and CSV snapshots with sanitized structure and metadata timestamps.

### C. Android APK Security
- **Strict HTTPS / TLS**: Cleartext HTTP traffic is disabled (`allowMixedContent: false`).
- **Sandboxed WebView**: WebContents debugging is disabled in production builds.
- **Input Sanitization**: Phone numbers, student names, fees, and seat identifiers are validated on input to prevent injection attacks.

---

## 4. Policy Updates

This security policy is reviewed periodically and updated in accordance with GitHub Security Best Practices and open-source compliance standards.
