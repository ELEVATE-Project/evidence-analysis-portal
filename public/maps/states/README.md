# State District GeoJSON Assets

Place simplified district-boundary GeoJSON files here using normalized state slugs:

```text
public/maps/states/bihar.geojson
public/maps/states/haryana.geojson
public/maps/states/uttar-pradesh.geojson
```

The report map loader reads files from:

```text
${import.meta.env.BASE_URL}maps/states/<state-slug>.geojson
```

Recommended source: DataMeet Community Maps Project.

- Districts: https://projects.datameet.org/maps/districts/
- Repository: https://github.com/datameet/maps

Keep assets simplified enough for browser rendering and PDF capture. If a state file is missing, invalid, or cannot be matched to report district names, the report automatically renders the schematic district relevance map.
