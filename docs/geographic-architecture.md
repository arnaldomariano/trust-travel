# Trust Travel — Geographic Architecture

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

Existing standalone materialization endpoints also remain in the
backend. Therefore, late materialization describes the audited
contribution flow, not an absolute prohibition on every other
materialization operation.

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

The current Django model relationships include:

- Place.destination: CASCADE.
- Experience.place: CASCADE.
- Update.place: CASCADE.
- Update.experience: CASCADE.
- PlaceExternalIdentity.place: CASCADE.

Consequently, deleting a Place through Django's deletion machinery
can also delete associated experiences, updates, and external identities.

Deleting a Destination can initiate a cascade through its Places.

These relationships describe current deletion behavior, not the
intended lifecycle policy for real-world places.

Status: Verified in model definitions.

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

This is not an exhaustive audit of deletion paths, including
administrative actions and indirect deletion behavior.

Status: Verified in inspected application code.


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

These mechanisms do not establish complete protection against
all concurrent geographic reference changes or all possible
creation paths.

Status: Verified in inspected code and automated rollback tests;
broader concurrency guarantees remain under investigation.

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

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /api/geography/places/preflight/ | Geographic reference preflight |
| POST | /api/geography/places/materialize/ | Geographic Place materialization |
| POST | /api/geography/cities/materialize/ | City materialization |
| POST | /api/geography/pois/materialize/ | POI materialization |
| POST | /api/geography/pois/create-manual/ | Manual POI creation |

These explicit endpoints remain registered. They must not be
confused with read-only discovery or exploration.

### 8.3 Experience publication

POST /api/experiences/ supports publication against an existing
Place or supported external/manual publication targets.

External Foursquare POI publication requires a complete external
identity together with external_poi_type and external_city_place_id.

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

## 10. Architecture Decision Log

### GEO-04/001 — POI Identity Resolution

The POI reference gate distinguishes reuse, preserve, and create.

Reuse requires a matching external identity and compatible place type,
parent city, and country reference.

Name-based candidates without confirmed identity are preserved for
further resolution rather than automatically merged.

Status: Verified in code; dedicated test coverage pending audit.

### GEO-04/002 — External POI Materialization

The external POI endpoint validates the requested place type and
checks locality compatibility before invoking the shared POI
materialization service.

Status: Verified in code; complete validation coverage pending audit.

### GEO-04/003 — Manual POI Materialization

Manual POI creation uses the shared materialization service without
requiring an external provider identity.

Name-based candidate resolution remains applicable.

Status: Verified in code; dedicated test coverage pending audit.

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
- Existing explicit materialization endpoints remain available.

Limitations:

- The decision describes the audited contribution workflow, not
  every possible backend materialization path.
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

## 11. Open Investigations

- Extend geographic consistency auditing across Country, Destination, city, and POI records, beyond the GEO-04/004 and GEO-04/005 guards.
- Audit the complete POI creation and concurrent recovery paths.
- Extend the existing regression coverage for POI identity and
  geographic context conflicts. GEO-05E.3 tests verify selected
  ambiguity, identity reuse, validation, and rollback scenarios,
  but exhaustive coverage of concurrent and alternate creation
  paths remains open.
- Review the representation of closed, renamed, or relocated places.
- Determine how historical experience locations should be preserved.
- Audit remaining geographic creation paths for bypasses.
