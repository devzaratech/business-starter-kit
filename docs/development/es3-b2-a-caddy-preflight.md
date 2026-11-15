# ES3-B2-A trusted runtime observation and Caddy preflight

`createCaddyPreflight(options)` in the Caddy adapter constructs an in-process
preflight function for a single installation, host, gateway and Docker engine.
The function accepts an ES3-A `IngressCandidate`. It is a worker integration
boundary with no HTTP handler, Docker discovery, default socket, or executable
runner. The provider-neutral `IngressDriver` and ES1/ES2 data formats are unchanged.

## Worker wiring

Construct the worker from operator-controlled configuration. Keep the port
implementations and their credentials out of project request handling. A project
must never provide the registry snapshot, inventory, observation, source ID,
clock, validation tool, or command arguments. Only trusted composition code may
hold the worker capabilities. An allowlisted caller or operation will still be
required at any future API or activation boundary.

| Port | Required worker behavior |
| --- | --- |
| `readRegistry` | Read the installed `RouteRegistry.snapshot()` for the pinned installation. |
| `readInventory` | Read the validated ES2 `Inventory.snapshot()` for the pinned host. Keep the revision and entries from the same snapshot. |
| `readRuntime` | Collect fresh ES2 normalized resource objects for the selected plans, from an explicitly authorized engine. Verify the context/endpoint and actual engine identity before and after the collection. Report the independently established source and engine identities and the original request scope. Keep the collection private to the worker. |
| `validator.version` and `validator.validate` | Use the same operator-provisioned immutable Caddy **v2.10.2** build. Normalize its reported version to the exact tag. Validate only the supplied native JSON bytes with a bounded, isolated operation. Return a boolean for a completed validation and signal unavailability for tool or execution failure. |

The runtime port delivers objects from the same collection, with supplemental
container facts and independent network-side peer records. Derive attached
network IDs and running state from container inspect. Get the network-side
peer IP and subnet from network inspect and IPAM. Compare the ID recorded by
each container with an image inspection of that exact ID and carry the
normalized repository digests. The admitted immutable image reference must
match the container's configured image reference and a matching repository
digest for that image object. Missing evidence fails closed. Do not substitute
desired values from inventory for observed fields, or echo the requested
source/engine IDs as evidence of what was connected. ES2's approved secret-mount
normalization still applies. Never put secret source paths or values in this port.

The validation interface supplies no tool path, install mechanism or shell
arguments. A future runner can send the native JSON to the pinned
`caddy validate --config -` process. It must independently establish binary
provenance, prevent substitution or fallback and isolate the process from host
credentials, uncontrolled storage and network access. Caddy validation
provisions modules even though it does not start the config. Use a bounded
runtime and output size and honor the supplied abort signal. The adapter checks
the normalized version before and after validation. A version string alone
cannot establish artifact provenance.
[Caddy command reference](https://caddyserver.com/docs/command-line#caddy-validate)

## Result and failure behavior

1. Read the current registry and rederive the candidate. Reject stale
   generations, any candidate mismatch, a foreign gateway/host/installation,
   or listeners other than HTTP `[80]` for this adapter.
2. Resolve only the candidate's admitted deployments from inventory. Check
   actual Docker IDs and ownership labels with the existing B1 resolver and
   ES2 runtime policy checks. Compare both sides of ingress/data attachments,
   container and image IDs, and ingress peers/IPAM. Only running public HTTP
   endpoints on admitted private IPv4 ingress networks enter Caddy JSON.
3. Validate the exact renderer output for this candidate, generation, engine and
   render identity. Repeat the runtime observation and confirm that it yields
   the same render and runtime evidence. Recheck the complete inventory and
   registry snapshots before returning success, including changes that reuse
   the existing revision or generation.

Both samples must finish within their own collection windows. The deadline is
10 seconds by default, configurable only by worker setup up to 30 seconds.
It bounds cooperative port calls and rejects results that arrive after expiry.
A synchronous port can still block the JavaScript event loop. The runtime
port must report freshly collected data and tools must enforce their own I/O
and process bounds. The first collection has no render ID because its facts
derive the render. The second collection is scoped to that exact render ID
and independently derives the same render. OS timestamps and `sourceRef`
describe evidence. Even a fresh timestamp with matching IDs and hashes
confers no authority on an untrusted source.

The result includes a scoped, deterministic `preflightId` for the same
inputs and collection times. Its `observationId` is stable across order
changes in normalized Docker facts. Diagnostics are bounded codes. The
result contains no raw tool output, config bytes, endpoint addresses or
secret paths. `state: 'rejected'` can accompany `validation: 'valid'` when
state changed after the tool ran. Both `applied` and `observed` remain null
even when preflight passes.

## Verification and next boundary

Run `node --test scripts/edge/test/preflight.test.mjs` for injected observation
and validator regressions, `npm run edge:test` for all edge tests, and
`npm run architecture:test` for the provider and side-effect guards. Existing
ordinary Linux and Windows CI discovers these tests. A synthetic validator
returning true does not prove that Caddy accepts or serves the config. This
slice has no live Docker or Caddy acceptance result.

The ES2 ownership rule rejects any extra peer on a deployment network.
This slice verifies the pre-attachment topology and cannot preflight through
an already attached gateway. ES3-B2-B needs an explicit gateway ownership
and attachment policy that preserves ES2 isolation, verified local worker
and pinned Caddy wiring, and fresh checks under a scoped lease/CAS before a
protected activation. Two matching observations cannot fence Docker changes
between reads or after return. Treat preflight evidence as time-bound and
revalidate under that lease. Add post-activation probes, separate
applied/observed records, last-known-good restoration and crash reconciliation.
Real routing, spoofing, reload failure and unaffected-route checks require a
separately owner-authorized disposable runtime run.

Reverting this change removes only additive preflight code, types, tests and
documentation. There is no activation, state migration or persisted gateway
configuration to roll back.
