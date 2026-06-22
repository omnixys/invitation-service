# Omnixys Invitation Service

The Invitation Service owns event invitations, RSVP state, approval policy, plus-one relationships, invitation imports, and the link between an invitation and its eventual guest profile. It exposes a federated GraphQL API and participates in identity, ticket, event, and notification workflows through Kafka.

## Ownership boundaries

This service owns:

- private and public invitations;
- RSVP and approval state transitions;
- automatic approval policy for accepted invitations;
- plus-one capacity and relationships;
- temporary pending-contact references;
- invitation import preview and persistence;
- invitation-to-guest-profile linkage.

It does not verify or issue tokens, own user identities, create tickets directly, send notifications, or implement logging/tracing transports. Those capabilities come from `@omnixys/security`, the Authentication and Ticket services, the Notification service, `@omnixys/logger`, and `@omnixys/observability`.

## Architecture

```text
HTTP / GraphQL
      |
      v
Context + Security + Validation
      |
      v
Resolvers / Upload controller
      |
      v
Invitation read/write services ----> PostgreSQL
      |                    |--------> Valkey pending-contact records
      |                    `--------> S3-compatible import storage
      v
Kafka package ----> Authentication / Event / Notification / Ticket workflows
```

The canonical request scope is provided by `@omnixys/context`. Logger enrichment, framework errors, traces, and Kafka headers therefore share the same request ID, correlation ID, actor, tenant, and trace metadata. OpenTelemetry runtime state remains owned by `@omnixys/observability`.

## Core workflows

### RSVP and automatic approval

An RSVP validates the requested state transition and plus-one limit, stores contact details in Valkey when identity verification is required, and commits invitation changes transactionally. When `autoApproveOnAccept` is enabled, an accepted RSVP invokes the same approval workflow used by an administrator.

Approval emits the confirmation workflow. The Ticket service creates the ticket only after identity verification supplies a user ID and verification token; the invitation is then linked back to that guest profile. This preserves identity and ticket ownership while making automatic approval continuous from the guest's perspective.

Automatic approval requires an event name, event end time, and event administrator when the invitation is created. Existing invitations remain compatible because the policy defaults to `false` and the new event snapshot fields are nullable.

### Plus-ones

Plus-ones are child invitations. Their count is capped by `maxInvitees`, and mutations verify that the authenticated user owns or created the parent invitation. Removing linked guests emits authentication cleanup commands.

### Bulk import

CSV and XLSX files are uploaded to object storage, previewed, mapped, validated, checked for duplicates, and then imported. Uploads are limited to one 5 MiB file per request. Storage is accessed only through `@omnixys/media`.

### Event milestones

Invitation creation and approval publish idempotent event milestone identifiers. The Event service consumes them to maintain the event timeline without coupling either service to the other's database.

## Interfaces

### GraphQL

The federated schema is generated at startup unless `SCHEMA_TARGET=false`. Main operations include:

- invitation, event, current-user, and plus-one queries;
- create, approve, reject, bulk-approve, and remove invitation mutations;
- private and public RSVP mutations;
- create, update, and remove plus-one mutations;
- CSV/XLSX import mutations.

Protected operations use the package-provided cookie authentication guard. DTO validation is enabled globally with transformation and whitelisting.

### HTTP

- `GET /health/liveness` checks the process.
- `GET /health/readiness` checks Kafka, Valkey, object storage, and any configured external endpoints.
- the upload controller accepts authenticated invitation import files.

### Kafka

Consumed topics:

| Topic registry key                  | Responsibility                                 |
| ----------------------------------- | ---------------------------------------------- |
| `invitation.deleteUserInvitations`  | Delete invitations linked to a removed user    |
| `invitation.deleteEventInvitations` | Delete invitations for removed events          |
| `invitation.addGuestId`             | Link a verified guest profile to an invitation |

Produced topics:

| Topic registry key               | Responsibility                            |
| -------------------------------- | ----------------------------------------- |
| `notification.confirmGuest`      | Start guest confirmation after approval   |
| `authentication.deleteGuest`     | Remove one obsolete guest identity        |
| `authentication.deleteGuestList` | Remove multiple obsolete guest identities |
| `event.milestoneRecorded`        | Record invitation lifecycle milestones    |

Handlers await their work so package-level retry and dead-letter handling can observe failures. Kafka lifecycle, propagation, retry, and shutdown behavior are supplied by `@omnixys/kafka`.

## Data model and migrations

PostgreSQL stores invitations and normalized phone numbers. Run migrations before deploying a version that uses automatic approval:

```bash
pnpm prisma migrate deploy
```

The `20260622001000_add_auto_approval` migration adds nullable event snapshot fields and a non-null automatic-approval flag with a safe `false` default.

## Local development

Requirements:

- Node.js 24.10 or newer;
- pnpm 11.1 or newer;
- PostgreSQL;
- Kafka;
- Valkey;
- S3-compatible object storage;
- a JWT issuer compatible with the configured Keycloak realm.

Setup:

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

Production requires `DATABASE_URL`, `COOKIE_SECRET`, storage credentials, the storage bucket, and configured secrets. Do not use the development cookie secret outside local development.

Important environment variables:

| Variable             | Purpose                         | Development default       |
| -------------------- | ------------------------------- | ------------------------- |
| `PORT`               | HTTP/GraphQL port               | `4000`                    |
| `DATABASE_URL`       | PostgreSQL connection           | none                      |
| `KAFKA_BROKER`       | Kafka bootstrap broker          | `localhost:9092`          |
| `VALKEY_URL`         | Pending-contact and cache store | `valkey://localhost:6380` |
| `COOKIE_SECRET`      | Signed cookie secret            | development-only fallback |
| `KC_URL`, `KC_REALM` | JWT issuer coordinates          | local Keycloak values     |
| `STORAGE_*`          | S3-compatible import storage    | none                      |
| `TEMPO_URI`          | OTLP HTTP trace endpoint        | local collector           |
| `SCHEMA_TARGET`      | schema path, `tmp`, or `false`  | `true`                    |

Optional external readiness URLs are disabled when empty. This avoids making local or production readiness depend on monitoring systems unless that dependency is explicitly configured.

## Validation and tests

```bash
pnpm generate
pnpm build
pnpm test:unit
pnpm test:e2e
pnpm lint
pnpm pack --dry-run
```

Unit tests cover RSVP state validation, canonical diagnostic metadata, automatic approval, and emitted milestone metadata. Resolver integration tests use Nest's testing container with in-memory collaborators, so they do not require live infrastructure. Infrastructure-dependent system tests should be run in an environment that provisions all dependencies explicitly.

## Operational behavior

Nest shutdown hooks close package-managed Kafka, cache, storage, telemetry, logging, and Prisma resources. Readiness reports owned dependencies separately, which makes deployment failures diagnosable. Optional external health checks should be configured only when they are intentional availability dependencies.

Framework exceptions include stable error codes and canonical diagnostic identifiers. Clients should branch on error codes rather than message text.

## Troubleshooting

- A readiness failure names the failing dependency (`kafka`, `cache`, or `storage`). Verify that dependency and its environment variables first.
- Automatic approval validation failures indicate that the invitation lacks its event snapshot or administrator ID.
- A missing pending-contact record usually means its Valkey TTL expired; restart the RSVP confirmation flow.
- Duplicate ticket creation is handled by the Ticket service's invitation identifier constraint; do not bypass that service by writing to its database.
- If generated Prisma types do not match the schema, run `pnpm generate` and rebuild.

## License

GPL-3.0-or-later. See [LICENSE.md](LICENSE.md).
