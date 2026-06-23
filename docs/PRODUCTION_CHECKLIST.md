# Public Launch Checklist

Do **not** expose the Coordinator publicly until these items have an accountable owner and objective evidence of completion.

## Product and privacy

- [ ] Clear local vs community route labeling in every chat interaction.
- [ ] Explicit confirmation before first Community Compute request, explaining that the selected provider processes plaintext in memory.
- [ ] Privacy policy, retention policy, data-processing mapping and deletion workflow.
- [ ] Localized disclosures, accessibility review and child-safety policy.
- [ ] Model-license inventory, distribution policy and per-model acceptable-use checks.

## Identity, authorization and abuse prevention

- [ ] Authenticated requester accounts, verified provider enrollment and device credential rotation.
- [ ] Invite-only provider beta before any public node directory.
- [ ] Per-user, per-device and per-provider quotas; global abuse rate limits backed by Redis.
- [ ] Content abuse policy, response process, reporting flow and on-call escalation.
- [ ] Job-type allow-list enforced both at Coordinator and Node Agent.
- [ ] No browser API key that can be replayed as an identity credential.

## Security

- [ ] Third-party pentest, dependency/SBOM scanning and signed build/release pipeline.
- [ ] Coordinator state in Postgres with transactional queue semantics; encrypted backups and tested recovery.
- [ ] mTLS or short-lived signed node certificates; key rotation and node revocation.
- [ ] CSP, HSTS, origin allow-list, server-side validation, structured audit events and secrets manager.
- [ ] Independent review of envelope encryption implementation, version negotiation and downgrade protection.
- [ ] Request/response size limits, job deadlines, circuit breakers and provider isolation.

## Operations

- [ ] Metrics for queue time, completion rate, token count, node availability, errors and abuse signals without prompt content.
- [ ] SLOs, dashboards, alerting, incident runbooks and support workflow.
- [ ] Regional deployment, lawful-basis assessment, DPA and tax/legal treatment before any provider compensation.
- [ ] Capacity testing, chaos testing, mobile/browser compatibility matrix and disaster-recovery test.
