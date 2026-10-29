# ADR 0010: Optional Tailscale with private administration and recovery

## Status

Proposed for PR0 / ES0 review, 2026-10-29. No Tailnet, DNS, host or account
configuration is changed or authorized by this document.

## Context

The repository has a Tailscale README, not a bootstrap or access-policy adapter.
Loopback database/admin binds are useful defaults but do not establish remote
identity, grants, break-glass recovery or application authorization.

## Proposed decision

Define private administrative reachability independently of Tailscale. An
optional adapter uses a Tailnet connection reference, least-privilege grants,
scoped node identities/tags and short-lived enrollment credentials. Host secrets
never enter declarations or logs. Tailscale reachability does not replace
control-plane authentication, project RBAC or audit. Public application ingress
remains independent of Tailnet availability; do not enable Funnel or public admin
fallback as a recovery mechanism.

Provide a documented alternative (local/SSH tunnel or another reviewed private
transport). Enforce no public databases, Docker API, gateway admin or control
panel by default. Preflight the private route and an operator-approved recovery
channel before applying firewall/access changes; apply in recoverable stages.
Remote bootstrap and Tailnet mutation always require explicit authorization.

## Alternatives

Mandatory Tailscale couples the kernel to an external account and control path.
Public admin panels with only network filtering expand exposure. Manual SSH can
remain a supported narrow operator path, with pinned host identity and auditable
credentials; it is not permission for a public API to execute shell commands.

## Consequences, acceptance and rollback

ES1–ES6 can run with Tailscale disabled on disposable local targets. ES5 must
simulate private-transport loss without exposing administration. PR4/ES7 adds
actual optional bootstrap tests: repeated idempotent execution, denied identities,
revocation, public-admin denial and recovery after simulated lockout. Credential
rotation/deletion remains an explicit audited operation. Never auto-delete
external Tailnet nodes or DNS during a project teardown.

Rollback restores the prior reviewed access policy via the verified recovery
channel; do not restore access by opening public admin ports. Tested Tailscale
versions and actual grant behavior must be recorded before adapter support.

Reference checked 2026-10-29: [Tailscale grants](https://tailscale.com/docs/features/access-control/grants)
provides the adapter's access-policy mechanism. BSK's RBAC, optionality and
recovery rules above are proposed platform requirements.
