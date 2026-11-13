# Trust Travel — Geographic Architecture

## Related technical dependency register

Before changing geographic discovery, identity resolution, materialization, or contribution publication, consult `docs/code-decisions-and-dependencies.md` for cross-component dependencies and regression risks.

## Document status

Status: Work in progress

This document describes the geographic architecture of Trust Travel,
its foundational principles, implementation decisions, invariants,
verified behavior, and open investigations.

The implementation and automated tests remain the source of truth.

Each technical claim should be classified as:

- Verified in code
- Verified by automated tests
- Under investigation
- Planned

## 1. Foundational Principles

### 1.1 Preservation of Travel Experiences

Places may change or disappear. Travel experiences must remain preserved.

Trust Travel treats travel experiences as historical records of what
travelers encountered at a particular place and time.

The closure, relocation, renaming, or disappearance of a place must not,
by itself, invalidate or erase experiences associated with that place.

Status: Product principle.

### 1.2 Internal Place Identity

A Place represents an internal Trust Travel record.

External provider identities are references to that record, not
replacements for its internal identity.

A Place may exist without an external provider identity.

Status: Verified in the current POI creation implementation.

### 1.3 Identity Integrity

Matching names, aliases, or geographic proximity do not independently
establish that two places represent the same entity.

Ambiguous identity matches must not trigger automatic consolidation.

Status: Verified in the POI reference gate implementation.

### 1.4 Geographic Accuracy

Trust Travel must distinguish the identity of a place from its
geographic context.

Geographic reconciliation must avoid associating existing records
with incompatible countries, localities, or place types.

Status: Partially verified; further GEO-04 auditing required.

### 1.5 Historical Location

A place's current location may differ from the location where an
earlier travel experience occurred.

The architecture should preserve the ability to distinguish
historical experience locations from current place locations.

Status: Architectural requirement; implementation not yet verified.

## 2. Geographic Data Model

### 2.1 Country

Country provides a structured national reference through:

- code: unique two-character country identifier.
- canonical_name: unique canonical country name.
- aliases: alternative names and spellings.

Status: Verified in code.

### 2.2 Destination

Destination provides an organizational record for places.

Its name and country fields form a unique combination.

Place references Destination through a required foreign key
configured with ON DELETE CASCADE.

Status: Verified in code.

### 2.3 Place

Place represents an internal Trust Travel location record.

Relevant fields include:

- Internal primary key.
- Destination reference.
- Optional structured Country reference.
- Optional parent Place.
- Name, canonical name, and aliases.
- Country code.
- Place type and geographic type.
- Optional coordinates.
- Creator and creation timestamp.

The parent relationship supports geographic hierarchy.

The geographic_type field is distinct from place_type:
a geographic entity may serve a particular navigation role
without changing its underlying geographic classification.

Status: Verified in code.

### 2.4 PlaceExternalIdentity

PlaceExternalIdentity associates an internal Place with an
external provider identity.

The combination of external_source and external_id is unique.

A Place may have multiple external identities.

A Place may also exist without any external identity.

Status: Verified in code.

### 2.5 Identity and Historical Preservation

Internal Place identity is distinct from provider identity
and from geographic attributes.

The inspected Place model does not itself provide a versioned
history of locations or addresses.

The effects of Place and Destination deletion on historical
experiences require further investigation.

Status: Partially verified; historical preservation under investigation.


## 3. Geographic Discovery

Geographic discovery combines internal Trust Travel records with
references obtained from supported external providers.

The implementation includes GeoNames and Google Places for geographic
discovery and Foursquare for specific POI discovery.

An external search result may be displayed and explored without
creating an internal Place.

External reference detail endpoints reconstruct provider information
for exploration. They do not independently materialize Places.

POI search may return internal registry results even when external
search is unavailable. The API distinguishes missing city coordinates,
missing provider configuration, and provider unavailability.

Status: Verified in inspected code and automated tests for the
documented discovery and exploration paths.

## 4. Identity Resolution

Internal Place identity is distinct from provider identity.

PlaceExternalIdentity records confirmed provider references using
external_source and external_id.

A matching name, alias, or nearby location is not sufficient to
confirm that two records represent the same place.

POI resolution distinguishes:

- reuse: a compatible existing identity has been confirmed.
- created: a new internal Place has been persisted.
- preserve: identity or geographic context requires resolution.

Preserve results must not automatically merge or modify ambiguous
existing records.

City discovery likewise preserves multiple same-name candidates
without treating name similarity as confirmed external identity.

Geographic country, city, parent, Destination, and place-type
compatibility remain relevant to resolution decisions.

Status: Verified in inspected implementation and relevant automated
tests. Broader concurrency and geographic consistency guarantees
remain under investigation.

## 5. Geographic Materialization

Geographic materialization creates or reuses an internal Place
from a validated geographic or POI reference.

The current contribution flow separates exploration from persistence:

1. Search and reconstruct external reference information.
2. Allow exploration without creating an internal Place.
3. Validate the selected publication target.
4. Resolve and materialize or reuse the Place during publication.
5. Persist the associated contribution.

Supported experience publication targets include existing Places,
external geographic references, Foursquare POIs, and manually
specified POIs within an existing city/locality.

The shared POI materialization service checks identity and geographic
compatibility. Ambiguous candidates produce preserve results instead
of automatic consolidation.

Standalone geographic materialization and manual POI creation
endpoints remain registered for compatibility, but their POST
handlers reject direct creation with HTTP 409 and code
contribution_publication_required. Geographic Places may be
materialized only during successful Experience or Update publication
through the authorized contribution workflows.

This restriction is verified in the Country, Place, City, POI,
and manual POI creation endpoint implementations. It does not,
by itself, establish that every other possible creation path
has been exhaustively audited.

Status: Verified in inspected implementation and automated tests
for the documented experience publication paths.

## 6. Geographic Invariants

### 6.1 Historical Experience Preservation

The closure, relocation, renaming, or disappearance of a place
must not automatically invalidate or erase historical experiences.

A change in the operational status of a place must be distinguished
from deletion of its internal Place record.

Status: Foundational product requirement; enforcement under investigation.

### 6.2 Place Identity and Deletion

The Django model relationship inventory identifies the following
direct references to Place:

| Referencing field | on_delete |
| --- | --- |
| Place.parent_place | SET_NULL |
| PlaceExternalIdentity.place | CASCADE |
| PlaceLocationSuggestion.place | CASCADE |
| PlaceLocationSuggestion.suggested_parent_place | CASCADE |
| BusinessPresence.place | CASCADE |
| ProfessionalContribution.place | CASCADE |
| OfficialSource.place | SET_NULL |
| OfficialSourceEntry.place | SET_NULL |
| Update.place | CASCADE |
| Experience.place | CASCADE |
| TripPlanDestination.place | CASCADE |
| SavedPlace.place | CASCADE |
| TripPlanResource.place | SET_NULL |
| TripPlanWatchedPlace.place | CASCADE |
| ContentReport.place | CASCADE |

Place.destination also references Destination with CASCADE.
Update.experience uses CASCADE and creates an additional indirect
deletion dependency through Experience.

Deleting a Place through Django's deletion machinery can therefore
delete related contributions, identities, trip-plan associations,
saved references, reports, and business records. SET_NULL can retain
a dependent record while removing its geographic association.

Deleting a Destination can cascade through its Places and their
dependent records. These are current model-level deletion behaviors,
not an approved lifecycle or historical-preservation policy.

Status: Direct relationships verified through Django model
introspection; indirect dependencies and deletion effects require
further auditing.

### 6.3 Place Lifecycle Versus Record Deletion

Trust Travel must distinguish:

- A place closing or ceasing operations.
- A place changing its name or location.
- A correction to geographic identity or ancestry.
- Permanent deletion of an internal Place record.

These operations have different implications for historical content.

The inspected Place model does not define an explicit lifecycle
status or versioned location history.

Status: Architectural requirement; implementation under investigation.

### 6.4 Audited Deletion Operations

The following application operations were examined:

- ExperiencePhotoDetailView.perform_destroy deletes an extra
  ExperiencePhoto and clears Gallery selection when necessary.
- replace_trip_plan_destinations deletes existing
  TripPlanDestination associations and recreates the requested set.

Neither examined operation directly deletes a Place.

The Django Admin now blocks individual and bulk deletion of
Place and Destination records through ProtectedGeographicAdmin.

This protection was introduced in commit 17f3a8d and verified by
four dedicated regression tests. The complete backend core suite
passed 346 tests at that checkpoint.

The protection applies to Django Admin operations only. It does
not prevent deletion through direct ORM calls, database access,
or other application paths that have not yet been audited.

Status: Admin protection implemented and verified by automated
tests; broader deletion-path audit remains open.


### 6.5 Historical Preservation and Place Merge Preconditions

Any future reconciliation or merge of two internal Places must be
non-destructive and must preserve the integrity of all associated
historical contributions and references.

Before a merge can be authorized, the implementation must demonstrate:

- Verified identity evidence; matching names or proximity alone
  must never authorize consolidation.
- Preservation of Experiences, Updates, authorship, publication dates,
  photographs, evaluations, and their historical context.
- Preservation or explicitly controlled reconciliation of external
  identities, business presence, professional contributions, official
  sources, reports, saved places, and trip-plan relationships.
- No silent loss, duplication, or reassignment of contributions.
- An auditable record of the original Places, identity evidence,
  authorization, affected relationships, and resulting changes.
- A tested recovery procedure for an incorrect consolidation,
  including restoration of historical associations.
- Explicit handling of conflicting or ambiguous relationships
  before any destructive action is permitted.

Closing, renaming, relocating, archiving, correcting, and merging
Places are distinct operations and must not be implemented as
interchangeable forms of deletion.

The direct relationship inventory in Section 6.2 is a starting
point, not proof that all indirect dependencies, media files,
evaluations, and downstream effects have been audited.

Status: Mandatory architectural preconditions agreed for future
Place reconciliation; a safe merge workflow, audit trail, and
recovery mechanism are not yet implemented or verified.


## 7. Concurrency and Transactions

Experience publication involving a new or reused POI executes
Place resolution/materialization and Experience/Update persistence
inside transaction.atomic().

A failure while creating the associated feed Update rolls back
the transaction, including a newly materialized Place.

External provider lookup and validation occur before entering
the publication transaction in the audited external POI flow.

The shared materialization services also include identity reuse
and IntegrityError recovery paths. Their geographic compatibility
guards are documented in the architecture decision log.

The following POI regression tests were inspected:

- test_poi_materialization_preserves_concurrent_identity_conflict:
  verifies that a second gate evaluation returning preserve prevents
  reuse after an initial simulated create decision.
- test_create_poi_recovers_existing_identity_after_integrity_error:
  verifies recovery of an existing external identity without
  creating a duplicate Place or identity record.
- test_poi_materialization_preserves_integrity_error_identity_conflict:
  verifies that a second gate evaluation rejects incompatible
  identity context and leaves the existing Place name, parent,
  Place count, and BusinessPresence count unchanged.

These tests verify specific recovery and conflict-handling paths.
They do not execute two independent database transactions
concurrently. Real concurrent transaction testing and exhaustive
coverage of alternate creation paths remain open investigations.

Status: Inspected implementation and regression tests support
the specified identity recovery, preservation, and rollback
behaviors; broader concurrency guarantees are not yet verified.

## 8. API Contracts

The following routes are registered under the backend API prefix.

### 8.1 Geographic discovery and exploration

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/geography/places/search/ | Geographic discovery |
| GET | /api/geography/places/external-detail/ | External geographic reference preview |
| GET | /api/geography/cities/search/ | City/locality search |
| GET | /api/geography/pois/search/ | POI search |
| GET | /api/geography/pois/external-detail/ | Foursquare POI reference preview |

The external POI detail endpoint requires external_source=foursquare
and a nonempty external_id.

For this endpoint, invalid source or missing ID returns HTTP 400,
a missing reference returns HTTP 404, and provider configuration
or request failures return HTTP 503.

These discovery and external-detail operations do not independently
materialize internal Places.

### 8.2 Explicit materialization and validation

| Method | Endpoint | Current behavior |
| --- | --- | --- |
| POST | /api/geography/places/preflight/ | Validate geographic reference without materialization |
| POST | /api/geography/countries/materialize/ | Reject standalone materialization |
| POST | /api/geography/places/materialize/ | Reject standalone materialization |
| POST | /api/geography/cities/materialize/ | Reject standalone materialization |
| POST | /api/geography/pois/materialize/ | Reject standalone materialization |
| POST | /api/geography/pois/create-manual/ | Reject standalone manual POI creation |

The five standalone creation/materialization POST handlers remain
registered but return HTTP 409 with code
contribution_publication_required for authenticated requests.
They do not independently create geographic Places.

Preflight is a separate validation operation and does not
materialize a Place. Successful geographic materialization
belongs to the authorized Experience or Update publication flow.

Status: Verified in the inspected view implementations.
Other creation paths require separate auditing.

### 8.3 Experience publication

POST /api/experiences/ supports publication against an existing
Place or supported external/manual publication targets.

External Foursquare POI publication requires a complete external
identity, external_poi_type, and exactly one supported city context:

- An existing internal city identified by external_city_place_id.
- An external city identified by external_city_source
  (geonames or google_places) together with external_city_id.

An external city reference is reconstructed and validated before
publication. During the atomic publication transaction, the city
reference is resolved and materialized or reused before resolving
the Foursquare POI. Geographic ambiguity or incompatible context
must not result in automatic consolidation.

Manual POI publication requires manual_poi_name, manual_poi_type,
and manual_city_place_id.

The serializer rejects incomplete or incompatible combinations
of publication targets.

The publication view validates external POI type and city context
before materialization. Ambiguous POI resolution returns HTTP 409
with code poi_resolution_required.

Place resolution/materialization and Experience/Update persistence
are atomic in the audited publication flow.

Experience editing prevents reassignment to another Place.

Status: Routes and HTTP methods verified in code; the documented
external POI error handling, publication validation, and rollback
behavior are verified in inspected code and automated tests.
This is not an exhaustive specification of every endpoint parameter
or response schema.

## 9. Test Coverage

### GEO-05F completion checkpoint

The GEO-05F implementation was completed and committed on branch
dev at b2c03c2 (Complete GEO-05F geographic discovery and
publication safeguards).

At that checkpoint:

- The complete backend core suite passed 371 tests.
- The frontend production build passed.
- Geographic discovery, guided manual creation, and contribution
  publication safeguards were included in the completed work.
- Standalone geographic materialization endpoints were restricted
  to HTTP 409 contribution_publication_required responses.

These results are historical verification evidence, not a claim
that the complete suite was rerun during the present documentation
audit. Earlier checkpoints below are retained for traceability.

Status: Implementation checkpoint recorded; broader lifecycle,
deletion, real concurrency, and recovery audits remain open.

### GEO-05E.3 verification checkpoint

The backend core test suite completed successfully with 342 tests.

An AST-based comparison of backend/core/tests.py against the
HEAD baseline identified:

- 305 test methods in the baseline.
- 37 additional test methods.
- 342 test methods in the current working tree.
- No missing or renamed baseline test methods.
- No duplicate top-level test classes.
- No duplicate test methods within the same class.

The comparison verifies method names and class membership; it does
not establish that every existing test body remained unchanged.

The added regression tests cover:

- Manual POI publication and late materialization.
- External Foursquare POI publication and identity reuse.
- Ambiguous name-only candidates and geographic conflicts.
- Incomplete or incompatible publication targets.
- Provider errors and unavailable external references.
- Transaction rollback when feed publication fails.
- Read-only external POI detail exploration.
- City identity annotation without name-only confirmation.
- POI search fallback and name matching.
- Experience editing and feed association.
- Gallery main-photo selection cleanup.

The frontend production build also completed successfully.

A browser-based functional test verified publication of an external
Foursquare hotel POI, creation of its Place and associated feed entry,
subsequent experience editing, and navigation to the Place Hub.

These results apply to the inspected GEO-05E.3 working tree and do
not establish complete coverage of all geographic creation paths,
concurrent modifications, historical preservation, or user interfaces.

Status: Verified by test execution, source inspection, and functional
inspection. Earlier GEO-04 test counts remain historical checkpoints
in the architecture decision log.

### GEO-05F verification checkpoint

The complete backend core suite passed 351 tests.

All 16 ExternalPOIExperienceCreationTests passed, covering the
supported external Foursquare POI publication paths, including
external geographic city references, validation, identity reuse,
geographic resolution conflicts, and transactional rollback.

The frontend production build completed successfully.

A functional browser test followed this path:

1. Search for Amsterdam and select GeoNames reference 2759794.
2. Explore hotels and select Hilton Amsterdam from Foursquare.
3. Open the external POI preview without publishing.
4. Publish a fictional test Experience through the contribution form.
5. Verify the persisted Experience, city, POI, and external identities.

The resulting development records were:

- Experience: 82.
- City Place: 131 (Amsterdam), GeoNames identity 2759794.
- POI Place: 132 (Hilton Amsterdam), Foursquare identity
  4a2706a5f964a5209a8b1fe3.

A subsequent database query confirmed one PlaceExternalIdentity
record for each of those external references.

This browser test validates the successful publication path.
Non-materialization before publication, conflict handling, and
rollback are supported by automated tests rather than a direct
before-and-after database comparison in this browser session.

The fictional Experience is development test data and should be
reviewed during the planned pre-Beta data cleanup.

Implementation checkpoint:

- Commit: 0a8ff89.
- Branch: dev.
- Backend core tests: 351 passed.
- ExternalPOIExperienceCreationTests: 16 passed.
- Frontend production build: passed.

Status: Implemented and verified for the documented GEO-05F
publication paths. Broader concurrency and geographic lifecycle
guarantees remain under investigation.

## 10. Architecture Decision Log

### GEO-04/001 — POI Identity Resolution

The POI reference gate distinguishes reuse, preserve, and create.

Reuse requires a matching external identity and compatible place type,
parent city, and country reference.

Name-based candidates without confirmed identity are preserved for
further resolution rather than automatically merged.

Dedicated regression tests cover name-only preservation, confirmed
identity reuse, creation without conflicting candidates, and
preservation of incompatible external identity contexts.

Status: Verified in code and covered by dedicated regression tests
for the specified identity resolution scenarios.

### GEO-04/002 — External POI Materialization

The shared external POI materialization service validates geographic
compatibility and applies the POI identity reference gate.

Historically, standalone endpoints exposed materialization operations.
Following GEO-05F, the standalone POI materialization POST endpoint
remains registered but returns HTTP 409 with code
contribution_publication_required.

External POI materialization is performed within authorized
contribution publication workflows, with regression tests covering
selected identity, geographic conflict, and rollback scenarios.

Status: Current endpoint restriction verified in code; shared
materialization and selected publication behaviors covered by
regression tests. Exhaustive validation remains under investigation.

### GEO-04/003 — Manual POI Materialization

Manual POI publication uses shared geographic materialization logic
without requiring an external provider identity. Name-based candidate
resolution remains applicable and must not silently merge Places.

Following GEO-05F, the standalone manual POI creation POST endpoint
remains registered but returns HTTP 409 with code
contribution_publication_required.

Manual POI creation is supported through authorized contribution
publication, with dedicated tests covering selected preservation,
validation, geographic conflict, and rollback scenarios.

Status: Current endpoint restriction verified in code; selected
manual POI publication behaviors covered by regression tests.
Exhaustive validation remains under investigation.

### GEO-04/004 — POI Country Ancestry Consistency

POI materialization must not proceed when the selected city contains
known national references that contradict the country code supplied
to the materialization service.

The shared materialize_poi_place service calls
assert_compatible_geographic_country before evaluating POI identity.

When a contradiction is detected, materialization returns:

- state: preserve
- reason: country_ancestry_conflict
- candidate_place_ids: []

No new Place is created and existing geographic records are not
automatically modified.

Both manual and external POI endpoints use this shared service.
They translate the preserve result into HTTP 409 with the existing
poi_resolution_required API code.

The create_poi_place persistence helper does not independently
validate country ancestry. Its current production caller is the
shared materialization service, which performs the validation first.

The protection does not establish complete consistency across
Country, Destination, city, and POI records. It also does not
independently guarantee protection against concurrent changes
to the selected city's geographic references.

Verification:

- A regression test reproduced the original incorrect creation.
- The service-level country conflict test passes.
- The manual POI API country conflict test passes.
- The external POI API country conflict test passes.
- All 16 POIPlaceReconciliationTests pass.

Status: Verified by automated tests for the specified conflict
scenario; broader geographic invariants remain under investigation.


### GEO-04/005 — City Destination Consistency During Geographic Reuse

City materialization must not reuse an existing Place when its
Destination contradicts the Destination associated with the
resolved country Place.

Compatible country_code and country_ref values alone do not
establish complete geographic context compatibility.

The shared assert_compatible_city_reuse_context helper verifies:

- Compatibility of existing country_code and country_ref evidence.
- Equality between the existing Place destination_id and the
  resolved country Place destination_id.

A detected contradiction raises GeographicContextConflict with
reason destination.

The validation protects the following reuse paths:

- Existing city enrichment.
- Reuse through an alternative external identity owner.
- Recovery after an IntegrityError during city creation.
- Reuse at geographic reference commit resolution.
- Reuse at the city materialization boundary.

The existing country ancestry validation remains separate.

Materialization boundaries convert geographic context conflicts
into preserve results rather than automatically modifying or
consolidating conflicting records.

The geographic materialization API returns HTTP 409 with code
geographic_resolution_required for the tested preserve scenario.

Verification:

- A regression test verifies HTTP 409 when an existing city has
  compatible national references but an incompatible Destination.
- A regression test verifies preservation when an alternative
  external identity owner has an incompatible Destination.
- A regression test verifies preservation during IntegrityError
  recovery when the winning identity owner has an incompatible
  Destination.
- The existing concurrency test was updated to represent the
  Destination relationship required by the shared validation.
- All 269 backend tests passed.
- Django detected no pending model migrations.

This protection does not establish complete geographic consistency
across all Place creation paths or guarantee protection against
concurrent changes to geographic references.

Implementation checkpoint:

- Commit: 05a1fb3
- Branch: dev

Status: Verified by automated tests for the specified city reuse
and Destination conflict scenarios; broader geographic invariants
remain under investigation.


### GEO-05E/001 — Exploration Without Automatic Materialization

Decision:

External geographic and POI references may be searched, selected,
and explored without creating an internal Trust Travel Place.

For the audited experience publication flow, Place materialization
or confirmed identity reuse occurs only when the contribution is
being persisted.

Rationale:

- Avoid creating unused internal Places from exploratory searches.
- Preserve the distinction between provider information and
  traveler-contributed Trust Travel content.
- Prevent name-only matches from silently consolidating identities.
- Keep Place, Experience, and feed Update persistence atomic.

Implementation:

- External geographic and Foursquare POI detail views are read-only.
- Manual and external POI publication use shared materialization logic.
- Ambiguous resolution returns preserve rather than automatic reuse.
- Publication uses transaction.atomic() for Place resolution and
  Experience/Update persistence.
- Standalone materialization endpoints remain registered but
  their POST handlers now reject direct creation with HTTP 409
  contribution_publication_required (GEO-05F completion).

Limitations:

- The contribution workflow and standalone endpoint restrictions
  are verified in the inspected implementation. Other internal
  creation paths have not been exhaustively audited.
- Complete concurrency and geographic consistency guarantees
  remain under investigation.
- Historical Place lifecycle and deletion behavior require
  separate architectural work.

Verification:

- Relevant backend regression tests passed.
- The complete backend core suite passed 342 tests.
- The frontend production build passed.
- External POI exploration and experience publication were
  inspected in a functional browser test.

Status: Implemented and verified for the audited GEO-05E.3 paths.

### GEO-05F/001 — External City Resolution During POI Publication

Decision:

An external Foursquare POI may be published against either an
existing internal city or a supported external geographic city
reference that has not yet been materialized in Trust Travel.

The two city contexts are mutually exclusive.

Rationale:

- Allow travelers to contribute experiences without requiring
  preliminary creation of geographic records.
- Keep exploration separate from contribution persistence.
- Preserve authoritative external identities and geographic context.
- Avoid unnecessary Places created by abandoned exploration.
- Prevent partial persistence when Experience publication fails.

Implementation:

- The publication serializer accepts external_city_place_id or the
  pair external_city_source and external_city_id.
- Supported external city sources are geonames and google_places.
- The publication view reconstructs and validates the external
  city reference before entering the persistence transaction.
- Within transaction.atomic(), the city reference is resolved
  and materialized or reused before the Foursquare POI.
- The Experience and associated feed Update are persisted within
  the same transaction.
- Geographic ambiguity is preserved rather than automatically
  merged. Geographic and POI resolution conflicts use their
  respective HTTP 409 responses.

Limitations:

- Explicit materialization endpoints remain registered but now
  reject standalone creation with HTTP 409
  contribution_publication_required.
- The audited publication workflows follow late materialization;
  exhaustive verification of other internal creation paths remains open.
- Full concurrency safety, historical geographic preservation,
  and lifecycle protection remain separate investigations.

Verification:

- All 351 backend core tests passed.
- All 16 ExternalPOIExperienceCreationTests passed.
- The frontend production build passed.
- A browser-based test successfully published a fictional
  experience against Hilton Amsterdam, using an external
  GeoNames city reference and a Foursquare POI reference.
- Database inspection confirmed the resulting external identities.

Implementation checkpoint:

- Commit: 0a8ff89.
- Branch: dev.

Status: Implemented and verified for the audited GEO-05F
experience publication workflow.

## 11. Open Investigations

- Extend geographic consistency auditing across Country, Destination, city, and POI records, beyond the GEO-04/004 and GEO-04/005 guards.
- Complete the POI creation and concurrent recovery audit.
  Existing regression tests verify selected identity recovery,
  second-gate conflict preservation, and rollback behaviors.
  They do not establish safety under two genuinely concurrent
  independent database transactions.
- Extend regression coverage for alternate creation paths,
  concurrent transactions, and geographic context changes
  that occur between validation and persistence.
- Review the representation of closed, renamed, or relocated places.
- Determine how historical experience locations should be preserved.
- Audit remaining geographic creation paths for bypasses.
- Inventory indirect Place dependencies, evaluations, experience
  photographs, media storage, and downstream references before
  authorizing any Place merge or destructive lifecycle operation.
- Design non-destructive Place reconciliation and merge procedures
  that preserve independent contributions, authorship, historical
  references, and existing links. Record merge decisions and support
  recovery from incorrect reconciliation.
- Establish a controlled Place lifecycle and deletion policy,
  including archival, retention, and protection against destructive
  cascading operations outside Django Admin.
- Plan auditable histories for critical geographic changes,
  moderation decisions, administrative actions, and identity merges.
- Design isolated, immutable backups for databases and media,
  with appropriate retention, access separation, and recovery testing.
- Plan incident recovery, including point-in-time restoration,
  integrity verification, and reconciliation of legitimate changes
  made after the last recoverable checkpoint.
- Define stronger authorization and independent approval for
  high-impact operations, including bulk changes to countries,
  Places, and their historical contributions.
- Ensure preservation and recovery policies respect privacy,
  consent withdrawal, and applicable personal-data deletion rights.
