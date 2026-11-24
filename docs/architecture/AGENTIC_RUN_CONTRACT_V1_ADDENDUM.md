# Agentic run contract v1 addendum

This addendum records the implementation details that are easy to miss when
calling the canonical Lekta RPCs.

- `agent_steps` is denormalized with `project_id` so ownership queries do not
  need to trust a client supplied run relationship.
- `complete_agent_step` accepts `p_worker_id` and checks it against the active
  lease. Katedra always sends the worker ID.
- `register_agent_payload` stores only private storage paths, project identity,
  material identity and expiry. It never stores extracted document text.
- Temporary material is restricted to the private
  `katedra-temporary-materials` bucket and the authenticated project namespace.
- `record_agent_run_snapshot_consent` must succeed before the run-context upload.
- `request_agent_run_payload_deletion` tombstones terminal-run manifests, but
  that is not deletion evidence by itself. The cleanup worker must remove both
  private objects and then call `finalize_agent_run_payload_deletion`.
- `record_agent_run_payload_deletion_failure` keeps a retryable status without
  logging manuscript text or provider output.

The migration is local to the Lekta repository. It must be applied to staging
and tested before Katedra feature flags are enabled.
