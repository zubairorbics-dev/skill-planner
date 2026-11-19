# Smart Skill Planner — Security Specification (Phase 0)

## Data Invariants
1. **Profile Ownership & PII Isolation**: A profile document at `/profiles/{userId}` can only be read by its owner (`request.auth.uid == userId`) or a verified administrator. Users cannot list other users' profiles.
2. **No Privilege Escalation**: A user can only create a profile with `role == 'user'` (unless verified as an administrator) and can never modify their own `role` or `uid` field after creation.
3. **Roadmap Integrity**: Every roadmap belongs strictly to `request.auth.uid`, has a bounded number of phases (2–8), and once `status == 'archived'`, it is locked against further non-admin mutations.
4. **Task Relational Consistency**: Every task at `/tasks/{taskId}` MUST reference an existing roadmap (`existsAfter`) owned by the same `request.auth.uid`. Non-admin updates to tasks are restricted solely to toggling completion (`isCompleted`, `completedAt`, `updatedAt`).
5. **Immutable AI Audit Trail**: Documents in `/ai_logs/{logId}` are append-only (`update` and `delete` are denied for everyone) and readable only by the owning user or a verified administrator.
6. **Temporal Integrity**: All `createdAt` fields must equal `request.time` on creation and remain immutable; all `updatedAt` fields must equal `request.time`.

## The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Role Escalation on Create**: `{ uid: "u1", role: "admin", ... }` written by non-admin user `u1`.
2. **Role Escalation on Update**: Updating `/profiles/u1` with `{ role: "admin" }`.
3. **Shadow Field Injection**: Updating `/profiles/u1` with `{ fullName: "Alex", isPremium: true }`.
4. **Cross-User PII Read**: Authenticated user `u2` executing `get('/profiles/u1')`.
5. **Unprivileged Profile Scraping**: Non-admin user `u2` executing `list('/profiles')`.
6. **Spoofed Roadmap Ownership**: User `u1` creating `/roadmaps/r1` with `{ userId: "u2", ... }`.
7. **Orphaned Task Write**: User `u1` creating `/tasks/t1` with `roadmapId: "nonexistent_roadmap"`.
8. **Cross-User Task Tampering**: User `u2` updating `/tasks/t1` owned by `u1`.
9. **Archived Roadmap Mutation**: User `u1` modifying an already `archived` roadmap.
10. **ID Poisoning**: Creating `/tasks/<200-char-invalid-id!@#>` to bypass ID constraints.
11. **Timestamp Forgery**: Creating `/roadmaps/r2` with client-supplied `createdAt: Timestamp(2020-01-01)`.
12. **Audit Log Tampering**: User `u1` updating or deleting `/ai_logs/log1` to hide failed AI generations.
