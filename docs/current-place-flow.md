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
- A placeholder area for future external places API integration

When a place is not found locally, the page now explains that Trust Travel did not find the place in the current database and that this area can later be connected to an external places API.

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

## Future external API preparation

The current search flow is prepared conceptually for a future external places API.

Expected future behavior:

1. User searches for a place.
2. Trust Travel checks the local database first.
3. If no local result exists, Trust Travel queries an external places API.
4. The user selects an official suggested place.
5. Trust Travel saves the selected place locally with external metadata.
6. The user can then share an experience, event, alert or useful information.

Potential future fields:

- external_source
- external_id
- external_place_name
- external_country_code
- latitude
- longitude
- parent_place