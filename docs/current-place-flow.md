# Trust Travel — Current Place Flow

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

These old records are considered test/fake data and may be deleted or cleaned before beta testing.

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

## Publishing an experience

Status: Implemented; verified by automated tests and functional inspection.

A traveler may publish an experience associated with:

1. An existing internal Place.
2. A supported external geographic reference.
3. A supported external Foursquare POI.
4. A manually specified POI within an existing city/locality.

For an external or manual POI, the backend validates the publication
target and resolves the Place during successful publication.

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

## Further work

Status: Planned or under investigation.

- Audit remaining creation and materialization paths.
- Continue geographic consistency and concurrency investigations.
- Review the handling of closed, relocated, or renamed places.
- Review older test data and legacy flows before Beta.
- Complete broader interface and mobile usability review before Beta.
