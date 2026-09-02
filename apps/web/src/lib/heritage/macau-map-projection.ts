export type MapPoint = { x: number; y: number };

// The original DSEC artwork uses Macau Grid metres, fitted uniformly into this SVG.
export const MACAU_MAP_EXTENT = {
  xmin: 18536.7217795573,
  ymin: 8163.48490623796,
  xmax: 26422.385156711,
  ymax: 21477.6220520839,
} as const;
export const MACAU_MAP_SIZE = 1000;
export const MACAU_MAP_MARGIN = 58;
export const MACAU_MAP_SCALE = Math.min(
  (MACAU_MAP_SIZE - MACAU_MAP_MARGIN * 2) / (MACAU_MAP_EXTENT.xmax - MACAU_MAP_EXTENT.xmin),
  (MACAU_MAP_SIZE - MACAU_MAP_MARGIN * 2) / (MACAU_MAP_EXTENT.ymax - MACAU_MAP_EXTENT.ymin),
);
export const MACAU_MAP_OFFSET = {
  x: (MACAU_MAP_SIZE - (MACAU_MAP_EXTENT.xmax - MACAU_MAP_EXTENT.xmin) * MACAU_MAP_SCALE) / 2,
  y: (MACAU_MAP_SIZE - (MACAU_MAP_EXTENT.ymax - MACAU_MAP_EXTENT.ymin) * MACAU_MAP_SCALE) / 2,
};

export function macauGridToSvg({ x, y }: MapPoint): MapPoint {
  return {
    x: MACAU_MAP_OFFSET.x + (x - MACAU_MAP_EXTENT.xmin) * MACAU_MAP_SCALE,
    y: MACAU_MAP_OFFSET.y + (MACAU_MAP_EXTENT.ymax - y) * MACAU_MAP_SCALE,
  };
}

const radians = Math.PI / 180;
const semiMajor = 6378137;
const flattening = 1 / 298.257223563;
const eccentricitySquared = flattening * (2 - flattening);
const originLat = (22 + 12 / 60 + 44.63 / 3600) * radians;
const originLng = (113 + 32 / 60 + 11.29 / 3600) * radians;

function meridianArc(lat: number): number {
  const e2 = eccentricitySquared;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return semiMajor * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat)
    - 35 * e6 / 3072 * Math.sin(6 * lat)
  );
}

// DSCC, Explanatory Notes on Geodetic Datums in Macao, Appendix 1 (2017):
// WGS84 -> Transverse Mercator -> six-parameter 2D transformation -> Macau Grid.
// https://www.dscc.gov.mo/files/geographical_geodetic_control/ENG/Macaucoord_2009_web_EN_v201702.pdf
// Do not pass DSEC's legacy service identifier 3064 to an EPSG projection library.
export function wgs84ToMacauGrid({ lat, lng }: { lat: number; lng: number }): MapPoint {
  const phi = lat * radians;
  const e2 = eccentricitySquared;
  const ep2 = e2 / (1 - e2);
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const n = semiMajor / Math.sqrt(1 - e2 * sin * sin);
  const t = tan * tan;
  const c = ep2 * cos * cos;
  const a = (lng * radians - originLng) * cos;
  const easting = 20000 + n * (
    a + (1 - t + c) * a ** 3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * a ** 5 / 120
  );
  const northing = 20000 + meridianArc(phi) - meridianArc(originLat) + n * tan * (
    a * a / 2 + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24
    + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * a ** 6 / 720
  );
  const rotation = -89.586 / 3600 * radians;
  const scale = 1 - 6.513e-6;
  const dx = easting - 21995.742;
  const dy = northing - 14829.896;
  return {
    x: 21995.742 - 307.377 + scale * (Math.cos(rotation) * dx + Math.sin(rotation) * dy),
    y: 14829.896 + 133.374 + scale * (-Math.sin(rotation) * dx + Math.cos(rotation) * dy),
  };
}

export function geographicToMacauSvg(coordinates: { lat: number; lng: number }): MapPoint {
  return macauGridToSvg(wgs84ToMacauGrid(coordinates));
}
