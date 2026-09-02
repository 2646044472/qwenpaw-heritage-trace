# Macau map restoration

The map artwork, generator and Government map component were restored from
`stephlam-um/Htrace-Frontend` at `92ad0a0ed158ad3d9162aee1e7ded4329b457dc2`.
The subsequent local road reclassification and bridge styling were removed.

The original repository introduced a guessed longitude/latitude bounding box in
`7a1167a`, when replacing the schematic map with DSEC geometry. That is not a
projection into the Macau Grid used by the artwork. Government and Hunter now
use `macau-map-projection.ts` through their existing `normalizeShopPosition`
entry point, so markers and Hunter route vertices use the same map coordinates.
The SVG extent, uniform scale and offsets remain those of the original artwork.

The conversion follows Appendix 1 of the DSCC
[Explanatory Notes on Geodetic Datums in Macao](https://www.dscc.gov.mo/files/geographical_geodetic_control/ENG/Macaucoord_2009_web_EN_v201702.pdf):
WGS84 Transverse Mercator followed by the published six-parameter 2D transform.
Its three example points give Macau Grid coordinates (metres):

| Latitude | Longitude | Easting | Northing |
| --- | --- | --- | --- |
| 22°11′40″ | 113°32′50″ | 20800.08 | 18145.04 |
| 22°09′30″ | 113°32′50″ | 20802.10 | 14146.39 |
| 22°07′20″ | 113°34′50″ | 24243.21 | 10149.87 |

The original six-kei fixture also placed the shop offshore. Its coordinate is
now taken from the Macau Government Tourism Office's
[Lok Kei entry](https://www.macaotourism.gov.mo/zh-hant/dining/specialty-foods/coffee-shops-and-noodle-shops/lok-kei):
latitude `22.20102328332708`, longitude `113.53716804581236`.
No other shop coordinate or route ordering was changed.

Browser inspection confirmed that all ten marker centres intersect the original
land geometry and selecting the Lok Kei marker opens its dossier. Desktop
Government and mobile Hunter screenshots were reviewed before deployment.
