#!/usr/bin/env node
/* global process */
import fs from 'node:fs/promises';
import path from 'node:path';
import shapefile from 'shapefile';

const DEFAULT_OUT_DIR = 'public/maps/states';
const DEFAULT_TOLERANCE = 0.01;

const STATE_NAME_OVERRIDES = {
  'andaman and nicobar island': 'Andaman and Nicobar Islands',
  'arunanchal pradesh': 'Arunachal Pradesh',
  'dadara and nagar havelli': 'Dadra and Nagar Haveli',
  'jammu and kashmir': 'Jammu and Kashmir',
  'nct of delhi': 'Delhi',
};

const TELANGANA_2011_DISTRICTS = new Set([
  'adilabad',
  'hyderabad',
  'karimnagar',
  'khammam',
  'mahbubnagar',
  'medak',
  'nalgonda',
  'nizamabad',
  'rangareddy',
  'warangal',
]);

const LADAKH_2011_DISTRICTS = new Set([
  'kargil',
  'leh ladakh',
]);

const COMBINED_DNH_DD_NAME = 'Dadra and Nagar Haveli and Daman and Diu';

const normalizeMapName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\bdistrict\b/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim();

const slugifyState = (stateName) => normalizeMapName(stateName).replace(/\s+/g, '-');

const canonicalStateName = (stateName) => STATE_NAME_OVERRIDES[normalizeMapName(stateName)] || stateName;

const resolveModernStateName = (stateName, districtName) => {
  const normalizedState = normalizeMapName(stateName);
  const normalizedDistrict = normalizeMapName(districtName);

  if (normalizedState === 'andhra pradesh' && TELANGANA_2011_DISTRICTS.has(normalizedDistrict)) {
    return 'Telangana';
  }

  if (normalizedState === 'jammu and kashmir' && LADAKH_2011_DISTRICTS.has(normalizedDistrict)) {
    return 'Ladakh';
  }

  return stateName;
};

const addFeatureToState = (states, stateName, feature) => {
  const stateSlug = slugifyState(stateName);
  if (!states.has(stateSlug)) {
    states.set(stateSlug, {
      slug: stateSlug,
      stateName,
      features: [],
    });
  }

  states.get(stateSlug).features.push(feature);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    shp: '',
    dbf: '',
    outDir: DEFAULT_OUT_DIR,
    tolerance: DEFAULT_TOLERANCE,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--shp') {
      options.shp = next;
      index += 1;
    } else if (arg === '--dbf') {
      options.dbf = next;
      index += 1;
    } else if (arg === '--out-dir') {
      options.outDir = next;
      index += 1;
    } else if (arg === '--tolerance') {
      options.tolerance = Number.parseFloat(next);
      index += 1;
    }
  }

  if (!options.shp || !options.dbf) {
    throw new Error('Usage: node scripts/prepare-state-maps.mjs --shp <districts.shp> --dbf <districts.dbf> [--out-dir public/maps/states] [--tolerance 0.01]');
  }

  if (!Number.isFinite(options.tolerance) || options.tolerance < 0) {
    throw new Error('--tolerance must be a non-negative number.');
  }

  return options;
};

const squaredDistanceToSegment = (point, start, end) => {
  const [px, py] = point;
  const [sx, sy] = start;
  const [ex, ey] = end;
  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) {
    return (px - sx) ** 2 + (py - sy) ** 2;
  }

  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx ** 2 + dy ** 2)));
  const x = sx + t * dx;
  const y = sy + t * dy;
  return (px - x) ** 2 + (py - y) ** 2;
};

const simplifyLine = (points, tolerance) => {
  if (points.length <= 2 || tolerance === 0) {
    return points;
  }

  const toleranceSquared = tolerance ** 2;
  let maxDistance = 0;
  let indexOfMax = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squaredDistanceToSegment(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      indexOfMax = index;
    }
  }

  if (maxDistance <= toleranceSquared) {
    return [points[0], points[points.length - 1]];
  }

  const left = simplifyLine(points.slice(0, indexOfMax + 1), tolerance);
  const right = simplifyLine(points.slice(indexOfMax), tolerance);
  return left.slice(0, -1).concat(right);
};

const roundPoint = ([x, y]) => [
  Number(x.toFixed(5)),
  Number(y.toFixed(5)),
];

const samePoint = (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1];

const simplifyRing = (ring, tolerance) => {
  const points = ring.map(roundPoint);
  const openRing = samePoint(points[0], points[points.length - 1]) ? points.slice(0, -1) : points;
  const simplified = simplifyLine(openRing, tolerance);
  const deduped = simplified.filter((point, index) => index === 0 || !samePoint(point, simplified[index - 1]));

  if (deduped.length < 3) {
    return [];
  }

  if (!samePoint(deduped[0], deduped[deduped.length - 1])) {
    deduped.push([...deduped[0]]);
  }

  return deduped.length >= 4 ? deduped : [];
};

const simplifyGeometry = (geometry, tolerance) => {
  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    const coordinates = geometry.coordinates
      .map((ring) => simplifyRing(ring, tolerance))
      .filter((ring) => ring.length >= 4);
    return coordinates.length ? { type: 'Polygon', coordinates } : null;
  }

  if (geometry.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates
      .map((polygon) => polygon
        .map((ring) => simplifyRing(ring, tolerance))
        .filter((ring) => ring.length >= 4))
      .filter((polygon) => polygon.length);
    return coordinates.length ? { type: 'MultiPolygon', coordinates } : null;
  }

  return null;
};

const main = async () => {
  const options = parseArgs();
  const outDir = path.resolve(options.outDir);
  const states = new Map();
  const source = await shapefile.open(options.shp, options.dbf);

  let result = await source.read();
  while (!result.done) {
    const feature = result.value;
    const rawStateName = String(feature.properties?.ST_NM || '').trim();
    const districtName = String(feature.properties?.DISTRICT || '').trim();
    const stateName = resolveModernStateName(canonicalStateName(rawStateName), districtName);
    const geometry = simplifyGeometry(feature.geometry, options.tolerance);

    if (!stateName || !districtName || !geometry) {
      continue;
    }

    addFeatureToState(states, stateName, {
      type: 'Feature',
      properties: {
        DISTRICT: districtName,
        ST_NM: stateName,
        ST_CEN_CD: feature.properties?.ST_CEN_CD ?? null,
        DT_CEN_CD: feature.properties?.DT_CEN_CD ?? null,
        censuscode: feature.properties?.censuscode ?? null,
      },
      geometry,
    });

    result = await source.read();
  }

  const dadra = states.get('dadra-and-nagar-haveli');
  const daman = states.get('daman-and-diu');
  if (dadra && daman) {
    [...dadra.features, ...daman.features].forEach((feature) => {
      addFeatureToState(states, COMBINED_DNH_DD_NAME, {
        ...feature,
        properties: {
          ...feature.properties,
          ST_NM: COMBINED_DNH_DD_NAME,
        },
      });
    });
  }

  await fs.mkdir(outDir, { recursive: true });
  const existingFiles = await fs.readdir(outDir);
  await Promise.all(existingFiles
    .filter((file) => file.endsWith('.geojson') || file === 'index.json')
    .map((file) => fs.unlink(path.join(outDir, file))));

  const index = {
    source: 'DataMeet Community Maps Project - Districts/Census_2011',
    sourceUrl: 'https://github.com/datameet/maps/tree/master/Districts/Census_2011',
    tolerance: options.tolerance,
    states: [],
  };

  for (const state of [...states.values()].sort((a, b) => a.stateName.localeCompare(b.stateName))) {
    state.features.sort((a, b) => a.properties.DISTRICT.localeCompare(b.properties.DISTRICT));
    const collection = {
      type: 'FeatureCollection',
      properties: {
        source: index.source,
        state: state.stateName,
        stateSlug: state.slug,
      },
      features: state.features,
    };

    await fs.writeFile(
      path.join(outDir, `${state.slug}.geojson`),
      `${JSON.stringify(collection)}\n`
    );

    index.states.push({
      slug: state.slug,
      name: state.stateName,
      file: `${state.slug}.geojson`,
      districtCount: state.features.length,
    });
  }

  await fs.writeFile(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Generated ${index.states.length} state map assets in ${outDir}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
