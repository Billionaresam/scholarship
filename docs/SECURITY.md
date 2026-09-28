# Security checklist

For database structure, capacity planning, permissions, and migration safety, use the [database design guide](DATABASE_DESIGN.md).

- Use a strong random `JWT_SECRET` and managed secrets.
- Force HTTPS and secure browser headers in production.
- Add MFA to admin, reviewer and finance accounts.
- Keep student documents in private object storage; expose them through short-lived signed URLs.
- Malware-scan uploaded files and enforce type/size limits.
- Add email verification and password reset tokens with short expiration.
- Apply least-privilege RBAC and record privileged actions in `AuditLog`.
- Encrypt backups and establish retention/deletion policies.
- Minimize collection of personal data and publish privacy/retention policies.
- Add CSRF protection if cookie-based authentication is introduced.
- Run dependency, SAST and penetration testing before launch.
- Keep consequential eligibility/review decisions explainable and subject to human review.
