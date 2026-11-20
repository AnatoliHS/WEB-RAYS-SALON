"""Build the engraved Visit-section map of downtown Cobourg from OpenStreetMap data.

Usage (from the repo root):
  python3 -I tools/visit-map/build_maps.py tools/visit-map/osm.json tools/visit-map/coast.json src/_includes/visit-map.svg

osm.json   streets, rail, parks, beach, piers (Overpass API export)
coast.json Lake Ontario shoreline way (Overpass API export)
The SVG has no inline colours; it is styled by the .map--b rules in src/assets/css/site.css.
Map data (c) OpenStreetMap contributors, ODbL.
"""
import json, math, os, sys

osm = json.load(open(sys.argv[1]))["elements"]
coast = json.load(open(sys.argv[2]))["elements"]

SALON = (43.9603572, -78.1658874)
KLON = math.cos(math.radians(43.96))
M_PER_DEG = 111320.0


def dist_m(a, b):
    return math.hypot((a[0] - b[0]) * M_PER_DEG, (a[1] - b[1]) * M_PER_DEG * KLON)


class Frame:
    def __init__(self, key, center, width_m, W, H):
        self.key, self.W, self.H = key, W, H
        self.px_per_m = W / width_m
        self.lat0, self.lon0 = center

    def p(self, lat, lon):
        x = self.W / 2 + (lon - self.lon0) * M_PER_DEG * KLON * self.px_per_m
        y = self.H / 2 - (lat - self.lat0) * M_PER_DEG * self.px_per_m
        return (x, y)

    def inside(self, pt, pad=0):
        return -pad <= pt[0] <= self.W + pad and -pad <= pt[1] <= self.H + pad


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def path_d(pts, close=False):
    d = "M" + " L".join(f"{fmt(x)} {fmt(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def kind(t):
    hw = t.get("highway")
    if hw in ("primary", "secondary", "tertiary", "trunk"):
        return "major"
    if hw in ("residential", "unclassified", "living_street"):
        return "minor"
    if hw == "pedestrian":
        return "ped"
    if t.get("railway") == "rail":
        return "rail"
    if t.get("leisure") == "park":
        return "park"
    if t.get("natural") == "beach":
        return "beach"
    if t.get("man_made") in ("pier", "breakwater"):
        return "pier"
    return None


def layer(fr, k, names=None, exclude=None, eps=0.5):
    out = []
    for e in osm:
        if e["type"] != "way":
            continue
        t = e.get("tags", {})
        if kind(t) != k:
            continue
        n = t.get("name")
        if names is not None and n not in names:
            continue
        if exclude is not None and n in exclude:
            continue
        pts = [fr.p(g["lat"], g["lon"]) for g in e["geometry"]]
        if not any(fr.inside(q, 60) for q in pts):
            continue
        closed = k in ("park", "beach") and e["geometry"][0] == e["geometry"][-1]
        out.append(path_d(rdp(pts, eps), closed))
    return out


def division(fr):
    return layer(fr, "major", names={"Division Street"}, eps=0.3) + layer(fr, "minor", names={"Division Street"}, eps=0.3)


def snap_salon():
    best = None
    for e in osm:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("name") != "Division Street":
            continue
        gs = e["geometry"]
        for i in range(len(gs) - 1):
            a = (gs[i]["lat"], gs[i]["lon"]); b = (gs[i + 1]["lat"], gs[i + 1]["lon"])
            for k in range(21):
                q = (a[0] + (b[0] - a[0]) * k / 20, a[1] + (b[1] - a[1]) * k / 20)
                d = dist_m(SALON, q)
                if best is None or d < best[0]:
                    best = (d, q)
    return best[1]


def shoreline(fr):
    pts = [fr.p(g["lat"], g["lon"]) for g in coast[0]["geometry"]]
    pts = rdp(pts, 0.4)
    if pts[0][0] > pts[-1][0]:
        pts = pts[::-1]
    return pts


def lake_poly(fr, shore):
    big = fr.H + 2000
    pts = [(-2000, shore[0][1])] + shore + [(fr.W + 2000, shore[-1][1]), (fr.W + 2000, big), (-2000, big)]
    return path_d(pts, True)


def street_label(fr, name, near, cls="m-lbl", text=None, dy=-6):
    tgt = fr.p(*near)
    best = None
    for e in osm:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("name") != name or "highway" not in t:
            continue
        pts = [fr.p(g["lat"], g["lon"]) for g in e["geometry"]]
        for i in range(len(pts) - 1):
            mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
            d = math.hypot(mx - tgt[0], my - tgt[1])
            if best is None or d < best[0]:
                best = (d, pts[i], pts[i + 1])
    if best is None:
        print("no street", name, file=sys.stderr)
        return ""
    _, a, b = best
    # project target onto the segment so the label sits on the road
    ax, ay = a; bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy or 1e-9
    u = max(0, min(1, ((tgt[0] - ax) * vx + (tgt[1] - ay) * vy) / L2))
    x, y = ax + u * vx, ay + u * vy
    ang = math.degrees(math.atan2(vy, vx))
    if ang > 90:
        ang -= 180
    if ang < -90:
        ang += 180
    label = text or name.replace("Street", "St").replace("Avenue", "Ave").replace(" West", " W").replace(" East", " E")
    return (f'<text class="{cls}" transform="translate({fmt(x)} {fmt(y)}) rotate({ang:.1f})" '
            f'dy="{dy}" text-anchor="middle">{label}</text>')


def walk_min(pt):
    # straight-line distance x 1.3 for the street grid, at ~80 m/min
    return max(1, round(dist_m(SALON, pt) * 1.3 / 80))


LANDMARKS = {
    "hall": ("Victoria Hall", (43.959126, -78.1678125)),
    "beach": ("Cobourg Beach", (43.95731, -78.1605)),
    "station": ("VIA Rail station", (43.9678878, -78.1706241)),
    "park": ("Victoria Park", (43.95809, -78.16178)),
}


def g(cls, paths, extra=""):
    if not paths:
        return ""
    body = "".join(f'<path d="{d}"/>' for d in paths)
    return f'<g class="{cls}"{extra}>{body}</g>'


def svg_open(fr, label):
    return (f'<svg class="map map--{fr.key}" viewBox="0 0 {fr.W} {fr.H}" preserveAspectRatio="xMidYMid slice" '
            f'role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">')


def scale_bar(fr, x, y, meters, cls):
    w = meters * fr.px_per_m
    return (f'<g class="{cls}" transform="translate({fmt(x)} {fmt(y)})">'
            f'<path d="M0 0 H{fmt(w)} M0 -5 V5 M{fmt(w)} -5 V5 M{fmt(w/2)} -3 V3"/>'
            f'<text x="0" y="22">0</text><text x="{fmt(w)}" y="22" text-anchor="end">{meters} m</text></g>')


PIN = snap_salon()
ALT = "Map of downtown Cobourg showing Rays Beauty Salon at 247 Division Street, just north of King Street"


# ───────────────────────── B · Engraved (paper street map) ─────────────────────────
def build_b():
    fr = Frame("b", (43.9592, -78.1655), 1150, 1000, 1000)
    shore = shoreline(fr)
    lake = lake_poly(fr, shore)
    s = svg_open(fr, ALT)
    s += ('<defs>'
          f'<clipPath id="b-lakeclip"><path d="{lake}"/></clipPath>'
          f'<path id="b-shore" d="{path_d(shore)}"/>'
          '<pattern id="b-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
          '<path d="M0 0 V6" class="m-hatch-line"/></pattern>'
          '</defs>')
    s += f'<rect class="m-bg" width="{fr.W}" height="{fr.H}"/>'
    s += f'<path class="m-lake" d="{lake}"/>'
    # engraved water: the shoreline repeated offshore, fading out
    s += '<g class="m-ripples" clip-path="url(#b-lakeclip)">'
    for i in range(1, 22):
        s += f'<use href="#b-shore" y="{i * 7}" style="opacity:{max(0.08, 1 - i * 0.045):.2f}"/>'
    s += "</g>"
    s += f'<use class="m-shore" href="#b-shore"/>'
    parks = layer(fr, "park")
    s += g("m-park", parks) + g("m-park-hatch", parks, ' fill="url(#b-hatch)"')
    s += g("m-beach", layer(fr, "beach"))
    s += g("m-pier", layer(fr, "pier"))
    s += g("m-rail-c", layer(fr, "rail")) + g("m-rail", layer(fr, "rail"))
    minor = layer(fr, "minor", exclude={"Division Street"}) + layer(fr, "ped")
    major = layer(fr, "major")
    s += g("m-minor-c", minor) + g("m-major-c", major)
    s += g("m-minor", minor) + g("m-major", major)
    s += g("m-div", division(fr))
    s += '<g class="m-labels">'
    for n, near in [("Division Street", (43.9628, -78.1668)), ("Division Street", (43.9584, -78.1647)),
                    ("King Street West", (43.95993, -78.1712)), ("King Street East", (43.9594, -78.1606)),
                    ("Albert Street", (43.9588, -78.1612)), ("Chapel Street", (43.9616, -78.1622)),
                    ("Swayne Street", (43.9606, -78.1625)),
                    ("George Street", (43.9608, -78.1600)), ("Hibernia Street", (43.9620, -78.1715)),
                    ("Queen Street", (43.9578, -78.1690)), ("Church Street", (43.9632, -78.1607)),
                    ("Bay Street", (43.9596, -78.1690)), ("Third Street", (43.9618, -78.1745)),
                    ("Durham Street", (43.9630, -78.1745)),
                    ("University Avenue West", (43.9648, -78.1715))]:
        s += street_label(fr, n, near, dy=4)
    for name, ll in [("Victoria Hall", LANDMARKS["hall"][1]), ("Victoria Park", (43.9583, -78.1622)),
                     ("Cobourg Beach", (43.9576, -78.1612))]:
        x, y = fr.p(*ll)
        s += f'<text class="m-place" x="{fmt(x)}" y="{fmt(y)}" text-anchor="middle">{name}</text>'
    x, y = fr.p(43.9552, -78.1614)
    s += f'<text class="m-water-lbl" x="{fmt(x)}" y="{fmt(y)}" text-anchor="middle">Lake Ontario</text>'
    s += "</g>"
    # compass + scale
    s += ('<g class="m-compass" transform="translate(860 120)">'
          '<circle r="34"/><circle r="27" class="m-compass__in"/>'
          '<path class="m-compass__n" d="M0 -40 L7 0 L0 6 L-7 0Z"/><path class="m-compass__s" d="M0 40 L7 0 L0 -6 L-7 0Z"/>'
          '<text y="-48" text-anchor="middle">N</text></g>')
    s += scale_bar(fr, 100, 900, 200, "m-scale")
    s += ('<g class="m-cartouche" transform="translate(90 70)"><rect width="250" height="96"/>'
          '<rect x="6" y="6" width="238" height="84" class="m-cartouche__in"/>'
          '<text class="m-cartouche__t" x="125" y="46" text-anchor="middle">Downtown Cobourg</text>'
          '<text class="m-cartouche__s" x="125" y="72" text-anchor="middle">ONTARIO · LAKE ONTARIO SHORE</text></g>')
    x, y = fr.p(*PIN)
    s += (f'<g class="m-pin" transform="translate({fmt(x)} {fmt(y)})">'
          '<circle class="m-pin__halo" r="30"/><circle class="m-pin__disc" r="19"/>'
          '<text class="m-pin__mono" y="7" text-anchor="middle">R</text>'
          '<g class="m-pin__flag" transform="translate(-26 0)"><text class="m-pin__name" x="0" y="-2" text-anchor="end">Rays</text>'
          '<text class="m-pin__addr" x="0" y="18" text-anchor="end">No. 247</text></g></g>')
    s += "</svg>"
    return s


OUT_FILE = sys.argv[3]
os.makedirs(os.path.dirname(OUT_FILE) or ".", exist_ok=True)
open(OUT_FILE, "w").write(build_b())
print(OUT_FILE, os.path.getsize(OUT_FILE), "bytes")
