# Bundled timezone and map data

Retrieved 18 October 2026. The picker uses these bundled assets; no external map service is contacted at runtime.

## Timezone locations

- IANA tz database [zone.tab](https://data.iana.org/time-zones/tzdb/zone.tab) and [iso3166.tab](https://data.iana.org/time-zones/tzdb/iso3166.tab). Both source headers explicitly place the files in the public domain.
- All zone.tab entries are retained so country-specific identifiers such as Europe/Prague remain searchable even where a canonical timezone shares its rules. IANA describes zone.tab as a backward-compatibility aid; the file is used here for selectable geographic locations, not to calculate timezone rules. Runtime Intl provides timezone rules.
- Country names come directly from iso3166.tab. City labels are the final IANA path component with underscores replaced by spaces. UTC is a synthetic extra entry (coordinates 0,0 are a display placeholder, not a geographic timezone boundary).
- Coordinates convert IANA ISO 6709 signed degrees/minutes/seconds to decimal degrees, rounded to 5 decimal places. JSON schema: an array of {id,countries,lat,lon,city}.

## World outline

- [Natural Earth 1:110m land dataset](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/), obtained from Natural Earth's [maintainer repository GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson).
- Natural Earth's [terms of use](https://www.naturalearthdata.com/about/terms-of-use/) place all map data in the public domain.
- Land polygons are simplified at 0.25 degrees with Douglas-Peucker, rounded to 0.1 SVG units, and projected into a 720 by 360 viewBox using x=(longitude+180)*2; y=(90-latitude)*2. Country borders and timezone boundaries are intentionally absent.

## Download checksums (SHA-256)

- https://data.iana.org/time-zones/tzdb/zone.tab: e2e8e31c4e10f44576c79345e76060591dbb3eef6ce14e006afc8a373caa9593
- https://data.iana.org/time-zones/tzdb/iso3166.tab: 837c80785080c8433fd9d4ea87e78f161ac7a40389301c5153d4f90198baeb2a
- https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson: 9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9
