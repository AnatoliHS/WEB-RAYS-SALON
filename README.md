# Rays Beauty Salon

Website for **Rays Beauty Salon**, 247 Division St, Cobourg, ON K9A 3P9.
Built with [Eleventy](https://www.11ty.dev/).

## Develop

```sh
npm install
npm start        # dev server at http://localhost:8080
npm run build    # static output in dist/
```

## Where things live

| What | File |
| --- | --- |
| Salon details (address, phone, hours, Facebook) | `src/_data/site.json` |
| Service menu and prices | `src/_data/services.json` |
| Vagaro booking widget | `src/_data/site.json` → `booking.widget` (embed code) and `booking.url` (booking page link) |
| Page layout (head, nav, footer) | `src/_includes/base.njk` |
| Homepage | `src/index.njk` |
| Styles / scripts | `src/assets/css/site.css`, `src/assets/js/site.js` |
| Web-optimized images | `src/assets/img/` |
| Full-resolution source photos (not published) | `src/assets/salon images/` |

Fill in `phone`, `hours` and service `price` values in the data files and
the site picks them up. Empty values fall back to "By appointment" /
"On consultation".
