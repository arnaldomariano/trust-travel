# Trust Travel — Current Place Flow

## Related technical dependency register

For implementation dependencies between Place discovery, exploration, and publication, consult `docs/code-decisions-and-dependencies.md` before refactoring the associated code paths.

## Current status

The place search flow is now organized around a clearer hierarchy:

1. Country
2. City / Region
3. Specific places such as attractions, hotels, restaurants and nature spots

The user should generally start with a country or city/region. Specific places are easier to add after the main destination is clear.

## Main search page

File:

frontend/app/destinations/page.tsx

The main search page supports:

- Country search
- City / region search
- Specific place search
- Manual place creation when no local result is found
- External geographic discovery through supported providers
- External POI search and exploration, including Foursquare references
- Exploration of external references without creating internal Places

Search results distinguish internal Trust Travel Places from external geographic and POI references. External references can be explored without creating an internal Place. If a traveler publishes an experience, the backend resolves the selected reference and materializes or reuses the Place as part of the publication transaction.

## Country experience page

File:

frontend/app/places/[id]/experiences/page.tsx

Country pages show:

- Country overview
- General country-level experiences
- Overview metrics
- Search for related cities and specific places inside the country

Country-level experiences are kept separate from city, region, hotel, restaurant, attraction or nature spot experiences.

## City / region experience page

File:

frontend/app/places/[id]/experiences/page.tsx

City and region pages show:

- Experiences specifically about that city or region
- Empty-state message when there are no experiences yet
- Button to share the first experience
- Button to go back to the parent country when available
- Button to search another place

## Place overview page

File:

frontend/app/places/[id]/page.tsx

The place overview page shows:

- Place type
- Parent country or location context
- Experiences count
- Average rating
- Events and info count
- Navigation buttons for experiences, sharing, ratings and updates

## Important note about current data

Many existing places and experiences were created before the new hierarchy was implemented. Some old test data may have incomplete or inconsistent fields.

Examples:

- Missing country fields
- Country names mixed between English and Portuguese
- Cities saved as destinations
- Opinion-based names used as places

Most legacy records are believed to be experimental development data,
many created before external geographic providers were integrated.

A broad cleanup, potentially including a complete reset of development
data, is planned before Beta. Its exact scope will be decided after
inventorying the database, identifying useful records and dependencies,
and preparing a verified backup and recovery procedure.

The cleanup requires explicit approval before execution. Development
data cleanup must not weaken the permanent preservation and integrity
rules intended for legitimate traveler contributions.

## External discovery and exploration

Status: Implemented; supported flows verified by automated tests.

Trust Travel supports discovery of geographic references from external
providers and search for specific places, including Foursquare POIs.

External search results may represent places that do not yet have
an internal Trust Travel Place record.

Selecting or exploring an external result does not, by itself,
create a Place.

External geographic references and Foursquare POIs can be explored
before the traveler decides whether to contribute.

The external POI exploration page is:

- frontend/app/explore/poi/page.tsx

It displays available provider information and distinguishes that
information from traveler experiences published on Trust Travel.

## Geographic search diagnostics and recovery

Status: Implemented in inspected frontend and backend paths;
broader end-to-end UX verification remains open.

The main Destinations search distinguishes:

- A completed search with no matching internal Places, country
  catalog entries, or external geographic results.
- Incomplete internal Place or country catalog loading.
- External geographic search errors or invalid response structures.

A genuine no-match presentation suggests alternative spelling,
local names, translations, and refinement by country or region.

Incomplete search sources produce a separate warning rather than
being treated as evidence that a locality does not exist.

The main external geographic search uses a request identifier to
prevent outdated responses from replacing newer search results.

In the guided specific-place search:

- HTTP 422 with code `unsupported_poi_search_context` indicates
  that a valid geographic reference is unsuitable as the context
  for nearby POI discovery.
- A geographic reference without usable coordinates receives a
  separate explanation.
- A failed POI request is not marked as a successfully completed
  search with zero results.
- The traveler can return to the geographic selection step using
  the 'Choose another geographic place' action.

These behaviors do not invalidate the geographic reference for
other supported exploration or contribution workflows.

Remaining work includes broader browser verification of recovery
paths, provider failures, no-match refinement, and eventual manual
locality creation.

## Geographic search presentation and locality confirmation

Status: Administrative context implemented and visually verified;
map-assisted confirmation planned.

Geographic search results may include homonymous localities and
different provider references for related geographic entities.

The guided city search in `frontend/app/destinations/page.tsx` and
the country Place search in `frontend/app/places/[id]/page.tsx`
display available administrative context to help travelers identify
the intended locality.

The backend city-search presentation filter reduces supported
equivalent references while preserving existing Trust Travel Places,
distinct geographic identities, and uncertain matches.

The filter changes presentation only. It does not merge references,
create Places, or establish identity from name similarity.

The 2026-11-16 verification included Campinas, Fernando de Noronha,
and Valinhos searches, browser inspection, 386 passing backend core
tests, and a successful frontend production build.

A future 'View on map' action may help travelers confirm a geographic
reference using provider coordinates before selecting it.

Map inspection must remain read-only and must not materialize a Place.
A representative locality coordinate must not be confused with an
exact POI position, territorial boundary, or photo GPS location.

## Publishing an experience

Status: Implemented; verified by automated tests and functional inspection.

A traveler may publish an experience associated with:

1. An existing internal Place.
2. A supported external geographic reference.
3. A supported external Foursquare POI.
4. A manually specified POI within an existing city/locality.

For external Foursquare POI publication, the traveler may select
a POI associated with either:

- An existing internal Trust Travel city/locality.
- An external GeoNames or Google Places city reference that has
  not yet been materialized internally.

These alternatives are mutually exclusive. The publication API
accepts external_city_place_id for an internal city, or the pair
external_city_source and external_city_id for an external city.

For an external or manual POI, the backend validates the publication
target and resolves the Place during successful publication.

When the Foursquare POI is associated with an external city,
the backend resolves or materializes the city before resolving
the POI, within the same publication transaction.

A functional GEO-05F browser test verified the path from
GeoNames Amsterdam discovery through Hilton Amsterdam Foursquare
exploration to successful publication of a fictional Experience.
The resulting city and hotel retained their respective external
provider identities.

Place materialization and Experience/Update creation occur inside
a database transaction. If publication fails, the transaction rolls back.

Confirmed external identity may allow reuse of an existing Place.
Name similarity alone does not establish identity; ambiguous candidates
must be preserved rather than automatically merged.

A newly explored external place does not become a Trust Travel Place
merely because it was selected or viewed.

## Geographic identity and historical content

Status: Architectural principles; lifecycle enforcement remains
under investigation.

Internal Place identity is separate from external provider identity.

Experiences are intended to preserve travelers' historical accounts
even when real-world places close, move, or change names.

Current model deletion cascades and historical-location representation
require further architectural work, as documented in
docs/geographic-architecture.md.

## Publication authentication and return navigation

Status: Implemented in inspected frontend flows; partial browser verification.

Visitors can search, discover, and explore Trust Travel Places without
signing in. Authentication is required when they decide to publish an
Experience or an Update (event, alert, or useful information).

The reusable `PublicationAuthGate` checks `AuthProvider` before showing
the protected publication form. Anonymous visitors receive sign-in,
create-account, and continue-exploring options.

The login flow accepts a validated internal `next` path. Registration
preserves that path through the subsequent login step.

For Experiences, the return path can reconstruct the selected existing
Place, external geographic reference, external Foursquare POI with city
context, or manual POI with city context. External geographic Updates
preserve the provider reference; existing-Place Updates return to the
Place Hub with the Update form requested.

Browser checks confirmed the anonymous gate for an existing Place and
an external geographic reference, and confirmed the external geographic
Experience return after login. TypeScript validation passed on
2026-11-15.

The full registration return journey, alternate/manual selection paths,
and backend authorization coverage remain outside this verification
checkpoint. Authentication alone never materializes a Place; successful
publication and the geographic integrity rules still govern persistence.

A comprehensive visual UX and mobile review is planned separately.

## Further work

Status: Planned or under investigation.

- Continue the end-to-end search -> no results -> geographic diagnosis
  and refinement -> eventual locality creation workflow.
- Distinguish genuine no-match responses from provider errors or
  incomplete results; guide spelling, translation, country, and
  regional refinement without forcing additional hierarchy levels.
- Plan map-assisted confirmation of ambiguous geographic references
  without premature Place materialization.
- Inventory experimental development records and prepare an approved,
  backed-up cleanup plan, potentially covering the entire development
  dataset.
- Audit remaining creation and materialization paths.
- Continue geographic consistency and concurrency investigations.
- Review the handling of closed, relocated, or renamed places.
- Review older test data and legacy flows before Beta.
- Complete broader interface and mobile usability review before Beta.
