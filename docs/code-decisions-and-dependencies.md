# Trust Travel — Code Decisions and Dependencies

## Document status

Status: Living technical reference.

This document records important implementation decisions whose rationale,
dependencies, or regression risks may not be obvious from isolated code.

It is intended as a first consultation point before audits, refactoring,
removal of apparently obsolete functions, or changes to critical workflows.

The implementation and automated tests remain the source of truth.
Documentation must be checked against the current code before changes.

## How to use and maintain this register

Before changing a documented behavior:

1. Read the relevant decision and linked architecture documents.
2. Inspect the current implementations and their callers.
3. Verify the actual dependency chain, including alternate workflows.
4. Review and run the relevant regression tests.
5. Identify effects on identity, persistence, security, and data integrity.
6. Update this register when a decision or dependency changes.

Do not infer that a function is unused solely because its original endpoint
or user interface is no longer active.

Each entry distinguishes verified implementation, identified test coverage,
open investigations, and future requirements.

## Decision index

| ID | Decision | Status |
| --- | --- | --- |
| DEP-GEO-001 | Separate geographic discovery from Place persistence | Implemented in documented flows; broader audit pending |
| DEP-GEO-002 | Keep geographic result presentation separate from identity resolution | Implemented and regression-tested; map confirmation planned |
| DEP-GEO-003 | Distinguish geographic search failures, unsupported contexts, and genuine no-match results | Implemented in inspected search flows; broader UX verification pending |
| DEP-AUTH-001 | Require authentication for contribution publication | Implemented in inspected frontend flows; partial browser verification |


---

## DEP-GEO-002 — Keep geographic result presentation separate from identity resolution

### Decision

Geographic search may reduce redundant provider references in the
results presented to travelers, but presentation filtering must not
modify geographic identity or persistence decisions.

Name similarity alone does not establish that two references represent
the same geographic entity.

### Verified implementation connections

- `backend/core/geography/discovery.py`:
  `filter_city_search_presentation` evaluates supported equivalence
  between city-search results.
- `backend/core/views.py`:
  `GeographyCitySearchView` applies the presentation filter after
  annotating results with existing Trust Travel Place identities.
- `frontend/app/destinations/page.tsx`:
  guided city search presents available administrative context.
- `frontend/app/places/[id]/page.tsx`:
  country-level geographic search presents administrative context.

### Invariants and dependencies

1. Presentation filtering must not create, delete, merge, or modify
   internal Places or external identities.
2. References associated with existing Trust Travel Places must remain
   available in search results.
3. Distinct homonymous localities must remain distinguishable.
4. Uncertain geographic equivalence must not justify hiding results.
5. Geographic identity resolution and publication safeguards remain
   governed by DEP-GEO-001.
6. Administrative labels must use available provider context rather
   than inventing geographic relationships.
7. Geographic map inspection, when implemented, must remain read-only
   and must not authorize Place materialization.

### Verification and limitations

- Six `GeographyCityPresentationFilterTests` passed.
- The complete backend core suite passed 386 tests.
- The frontend production build passed.
- Live GeoNames searches were inspected for Campinas, Fernando de
  Noronha, and Valinhos.
- Browser inspection verified administrative labels in the guided
  city search and country-level geographic search.
- The main Destinations search uses a different discovery path;
  its presentation behavior must be evaluated independently.
- Provider behavior outside the verified scenarios remains subject
  to further testing.
- Map-assisted geographic confirmation is planned, not implemented.

### Before modifying

Inspect the presentation filter, its caller, existing Place identity
annotation, provider administrative context, and frontend result
rendering together.

Run the presentation-filter regression tests and relevant geographic
publication tests. Verify that filtering does not affect identity
reuse, conflict preservation, or late materialization.

### Related documents

- `docs/geographic-architecture.md`
- `docs/current-place-flow.md`

### Maintenance history

- 2026-11-16: Documented city-search presentation filtering,
  administrative context labels, verification, and planned
  map-assisted confirmation.

---

## DEP-GEO-003 — Geographic search diagnostics and recovery

**Status:** Implemented in inspected search paths; broader
end-to-end UX verification remains open.

### Decision

Geographic search interfaces must distinguish a genuine absence
of matching results from incomplete data sources, provider errors,
invalid responses, and valid geographic references that cannot
serve as nearby POI search contexts.

### Implemented behavior

- The main Destinations search distinguishes completed no-match
  searches from incomplete internal Place or country catalog loading.
- External geographic search failures are presented separately
  from successful searches without matches.
- A request identifier prevents outdated external search responses
  from replacing newer results.
- The guided POI search recognizes HTTP 422 with code
  `unsupported_poi_search_context` and requests a more specific
  city or locality.
- Missing geographic coordinates receive separate guidance.
- Failed POI searches are not marked as completed zero-result searches.
- The guided flow provides an action to choose another geographic place.

### Invariants

1. Search failures must not be interpreted as proof that a
   geographic reference does not exist.
2. A valid geographic reference unsuitable for nearby POI
   discovery must not be treated as globally invalid.
3. Search, refinement, and geographic selection must not
   materialize a Place.
4. Geographic identity and contribution-publication safeguards
   remain governed by DEP-GEO-001.
5. Error recovery must preserve the distinction between
   geographic discovery and contribution persistence.

### Verification and remaining work

Backend regression coverage includes
`test_search_distinguishes_unsupported_geographic_context`.
The previously completed backend suite passed 386 tests,
and the frontend production build passed.

Broader browser verification remains open for provider failures,
no-match refinement, recovery navigation, and potential manual
locality creation.

### Related documentation

- `docs/current-place-flow.md`
- `docs/geographic-architecture.md`
- `DEP-GEO-001`
- `DEP-GEO-002`

**Last reviewed:** 2026-11-16.

---

## DEP-AUTH-001 — Require authentication for contribution publication

### Decision

Public geographic discovery, exploration, and Place viewing remain accessible
without authentication.

Publishing an Experience or an Update requires an authenticated session.
The frontend uses a reusable publication gate to prevent anonymous visitors
from accessing the protected publication forms.

Authentication must not silently discard the selected publication target.

### Verified implementation connections

- `frontend/app/components/PublicationAuthGate.tsx` reads authentication
  state from `AuthProvider` and displays either the publication form or
  the sign-in/create-account invitation.
- `frontend/app/destinations/page.tsx` protects Experience publication
  and the inspected external-geographic Update publication flow.
- `frontend/app/places/[id]/page.tsx` protects the existing-Place
  Update form.
- `frontend/app/login/page.tsx` validates the internal `next` path,
  refreshes the authenticated user, and redirects to the requested path.
- `frontend/app/register/page.tsx` preserves a safe `next` path when
  directing a newly registered user to login.

### Invariants and dependencies

1. Public exploration must not depend on an authenticated session.
2. Publication forms must not become available while authentication
   status is still loading.
3. Return paths must remain internal to the application.
4. Experience return navigation must preserve supported existing Place,
   external geographic, external POI, and manual POI selection context.
5. Authentication does not authorize geographic materialization by itself;
   Place persistence remains governed by DEP-GEO-001.
6. Frontend gating is a user-interface control, not a substitute for
   backend authentication and publication authorization.

### Verification and limitations

- Browser checks confirmed the anonymous publication gate for an
  existing Place and an external geographic reference.
- Browser checks confirmed return to an external geographic Experience
  publication context after login.
- TypeScript validation (`npx tsc --noEmit`) passed on 2026-11-15.
- The complete registration-to-login-to-publication return journey
  has not yet been browser-tested.
- All manual POI and alternate navigation return paths have not been
  exhaustively browser-tested.
- Backend authorization coverage was not re-audited as part of this
  frontend authentication review.
- Visual differentiation of authentication actions and mobile UX
  remain deferred to a broader interface review.

### Before modifying

Inspect `AuthProvider`, the gate, login/register redirects, all
publication entry points, and backend authorization together.
Recheck public exploration, anonymous access, return navigation,
and geographic non-materialization behavior.

### Related documents

- `docs/current-place-flow.md`
- `docs/geographic-architecture.md`

### Maintenance history

- 2026-11-15: Documented frontend publication authentication and
  verified return-navigation behavior, with outstanding test scope.

---

## DEP-GEO-001 — Separate geographic discovery from Place persistence

### Decision

Searching, selecting, reconstructing, or exploring a geographic reference
must not independently create an internal Trust Travel Place.

Geographic Place creation or reuse is authorized during successful
publication of a legitimate Experience or Update, within the publication
transaction.

Standalone geographic materialization and manual POI creation endpoints
remain registered but reject direct POST creation with HTTP 409 and code
`contribution_publication_required`.

### Why this decision exists

External provider references are evidence about possible places, not
automatically authorized internal records.

Separating discovery from persistence reduces premature Place creation
and prevents an exploratory action from silently changing the registry.

Identity resolution must also avoid merging ambiguous candidates merely
because their names, aliases, or geographic positions are similar.

### Verified implementation connections

**Discovery and exploration**

- `backend/core/views.py`: `GeographyPlaceSearchView`,
  `GeographyCitySearchView`, `GeographyPOISearchView`,
  `GeographyPlaceExternalDetailView`, and
  `GeographyPOIExternalDetailView`.
- `backend/core/geography/services.py`:
  `reconstruct_external_geographic_reference` and the geographic
  reference evaluation/resolution services.

**Experience publication**

- `backend/core/views.py`: `ExperienceListView.perform_create`.
- Supports existing Places, external geographic references, external
  Foursquare POIs, manual POIs, and manual geographic localities.
- Uses `transaction.atomic()` around Place resolution/materialization,
  Experience persistence, and associated feed Update creation.
- For a Foursquare POI with an external city, resolves the city first,
  then resolves the POI within the same transaction.
- Relevant services include
  `resolve_reconstructed_geographic_reference_for_commit` and
  `materialize_poi_place`.

**Independent Update publication**

- `backend/core/views.py`: `UpdateListView.post`.
- Supports an existing Place or an external GeoNames/Google Places
  geographic reference in the inspected path.
- Uses `transaction.atomic()` around geographic resolution and
  Update persistence.
- Uses `resolve_reconstructed_geographic_reference_for_commit`.

**Standalone endpoint protection**

- `backend/core/views.py`: `GeographyCountryMaterializeView`,
  `GeographyPlaceMaterializeView`, `GeographyCityMaterializeView`,
  `GeographyPOIMaterializeView`, and `GeographyPOIManualCreateView`.
- These endpoints remain registered for compatibility but direct
  creation is blocked as documented in
  `docs/geographic-architecture.md`.

### Invariants to preserve

1. Discovery and exploration remain read-only with respect to Place
   materialization.
2. Place creation or reuse through documented contribution workflows
   occurs inside the same transaction as contribution persistence.
3. A `preserve` resolution must not silently merge or overwrite
   ambiguous geographic identities.
4. An external POI's city context must be validated before publication.
5. A failed publication must not leave its newly materialized geographic
   records committed.
6. An Update can be published independently of an Experience.

### Risks when changing this behavior

- Premature or duplicate Place creation.
- Incorrect reuse of a geographically incompatible Place.
- Partial city/POI persistence after a failed Experience publication.
- Geographic records without the intended published contribution.
- Breaking independent Update publication while changing Experience
  creation, or the reverse.
- Accidentally restoring a standalone creation path.

### Identified regression tests

Located in `backend/core/tests.py`:

- `IndependentGeographicMaterializationProtectionTests`
- `GeographicPlaceExternalDetailAPITests`
- `ExternalGeographicReferenceCommitResolutionTests`
- `ExternalExperienceCreationTests`
- `ManualPOIExperienceCreationTests`
- `ManualGeographicExperienceCreationTests`
- `ExternalPOIExperienceCreationTests`
- `ExternalUpdateCreationTests`

Particularly relevant methods include:

- `test_independent_materialization_endpoints_do_not_create_places`
- `test_external_geographic_materialization_rolls_back_with_feed_failure`
- `test_external_poi_external_city_rolls_back_on_feed_failure`
- `test_external_update_materializes_place_on_successful_publication`
- `test_external_place_materialization_rolls_back_if_update_fails`

These tests were identified by source inspection; they have not been
rerun as part of this documentation task.

### Before modifying

- Trace all callers of the geographic commit-resolution and POI
  materialization services, not only their original endpoints.
- Inspect both `ExperienceListView.perform_create` and
  `UpdateListView.post`.
- Verify city-before-POI resolution and transaction boundaries.
- Check `preserve`, provider-unavailable, validation, and rollback paths.
- Review the related tests and run appropriate regression coverage.
- Recheck whether any new creation path bypasses publication safeguards.

### Scope and open investigations

This entry describes inspected, documented contribution flows. It does
not claim that every possible internal ORM or administrative creation
path has been exhaustively audited.

Database-level concurrency guarantees, historical preservation,
non-destructive deletion, and recovery controls require additional
work. Consult `docs/geographic-architecture.md` for current limitations.

### Related documents

- `docs/geographic-architecture.md`
- `docs/current-place-flow.md`

### Maintenance history

- 2026-11-13: Initial dependency record created from GEO-05F
  documentation and inspected implementation/test references.
