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

Status: Pending documentation.

## 4. Identity Resolution

Status: Pending documentation.

## 5. Geographic Materialization

Status: Pending documentation.

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

Status: Pending documentation.

## 8. API Contracts

Status: Pending documentation.

## 9. Test Coverage

Status: Pending documentation.

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


## 11. Open Investigations

- Extend country consistency auditing across Country, Destination, city, and POI records, beyond the GEO-04/004 materialization guard.
- Audit the complete POI creation and concurrent recovery paths.
- Verify test coverage for POI identity and context conflicts.
- Review the representation of closed, renamed, or relocated places.
- Determine how historical experience locations should be preserved.
- Audit remaining geographic creation paths for bypasses.
