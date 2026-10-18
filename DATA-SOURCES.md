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

## Interactive timezone-offset regions

- [Natural Earth 1:10m timezone dataset](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/timezones/), obtained from its [maintainer GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson). Natural Earth explicitly states that the timezone data is public domain, donated by International Mapping Associates.
- **Historical illustrative data:** Natural Earth describes its source as a CIA May 2012 timezone map with subsequent edits. Its bundled offsets and boundaries are not a current or authoritative timezone database: for example, it retains Venezuela UTC-04:30 and Norfolk UTC+11:30. Daylight-saving changes and later legal changes are not represented reliably. The interactive chart is a visual discovery aid only. Current browser Intl/IANA named-zone rules and explicit user selection must determine saved timezone and deadlines. Do not infer an exact IANA zone from a colored region or longitude.
- JSON schema: array of {id,sourceOffset,label,color,places,path,zones}. Each of 120 source geographic features becomes a distinct SVG path. sourceOffset is the historical source standard UTC offset **in hours** (including fractions); label is its historical source UTC label, not a present-day authority; color is the source 8-color palette index; places is the source explanatory place text. zones lists exact IANA IDs whose known representative-city coordinates fall inside the source geometry. Named timezone candidates come from this geographic membership, not the source offset. Derive displayed current/standard offsets from runtime Intl rules for those IDs.
- Render path with fill-rule="evenodd" in viewBox="0 0 720 360"; coordinates use x=(longitude+180)*2 and y=(90-latitude)*2. Rings simplified with Douglas-Peucker tolerance 0.25 degrees and rounded to 0.1 SVG units. Tiny rings retain their original points when simplification would collapse them. The map is not a timezone-boundary authority.
- Retrieved 18 October 2026. SHA-256 of original GeoJSON: aa52ab97e5f906693f31fe2e625c9d6be78a4e74fcd4142a7261235b355cacfe.

### Region-to-city membership

- Membership is computed against the original unsimplified Natural Earth Polygon/MultiPolygon geometry, including holes, using the IANA representative city coordinates. UTC is excluded because its (0,0) coordinate is synthetic.
- A city outside all regions may match its nearest polygon boundary only when within 0.03 degrees; no broader longitude/offset heuristic is used. Historical boundary differences can put modern zones with different offsets into one source region; offer explicit named-zone selection.
- 418 geographic zones examined; 418 assigned; 0 unmatched. 0 assignments used boundary tolerance.
- Unmatched IANA locations: none. These remain available through the full searchable picker.
- Historical source offset/label may be used only as a schematic ocean UTC aid for regions with no named zones. Regions with named zones must derive live labels/candidates from those zones.
