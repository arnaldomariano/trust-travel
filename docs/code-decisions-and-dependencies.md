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
