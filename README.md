# Guernsey Property Finder

Live app: https://jd8gr92sjw-cyber.github.io/Guernsey-Property-Finder/

Deployed successfully on 30 September 2026 using free public GitHub Pages
hosting and GitHub Actions. The app and collector run independently of the
original computer. The original working local app is preserved separately.

## Collection and hosting
- Cooper Brouard, Swoffers and Cherry Godfrey residential sales, including Local and Open Market properties.
- Only positive numerical asking prices are collected. POA, Price on Application,
  Price on Request and missing-price listings are excluded from all agents.
- Swoffers pagination totals and source type filters are checked before publication.
  All three agents must finish successfully before the combined feed replaces the previous one.
- Scheduled collection at 02:23, 08:23, 14:23 and 20:23 UTC every day.
  GitHub may delay scheduled jobs; the app shows the actual collection time.
- Pushes to main and manual workflow runs also collect, test and deploy.
- Failed collection stops publication, preserving the last successful live site.
- Each successful feed is committed before deployment. No custom secrets or
  personal access tokens are embedded in this repository.
- The public repository contains app source and public property information.
  Shortlists, saved searches and notes stay in the user's browser.

The hosted Refresh listings button loads the latest published feed. For an
immediate cloud collection, open Actions > Collect and deploy property finder >
Run workflow. Check Actions if the collection timestamp becomes stale. GitHub
can disable schedules after 60 days of repository inactivity.

## Swoffers integration

The same collector command and six-hour schedule now collect both agents. Cooper
Brouard IDs remain unchanged; Swoffers uses negative source IDs to avoid conflicts
with existing notes and shortlists. Search, details and photographs support both
agents without changing the layout. Previously saved property snapshots and notes
are retained, even when a listing is removed from the current feed.

## Cherry Godfrey integration

The public website's buy feed is collected once per refresh. Its declared count,
unique source identities and completeness flags are checked before publication.
Sold listings, agricultural fields, private listings and unpriced listings are
excluded. Available and under-offer residential sales retain explicit market,
bedroom, price and advertised size data. Missing parish and sizes remain unknown.
Cherry Godfrey IDs use a reserved negative range; existing IDs are unchanged.
Original links use the website's public detail routes, and Expert Agent photos
use HTTPS. The existing layout and collection schedule are unchanged.

## Original deployment validation
The first cloud workflow successfully collected 114 properties, passed the 12
application/collector tests, preserved the feed and deployed the HTTPS site:
https://github.com/jd8gr92sjw-cyber/Guernsey-Property-Finder/actions/runs/36685983598

Live browser checks passed: search by type/parish, saved-search recall after
reload, shortlist persistence, property details, descriptions, photographs,
notes after reload, removal of test data, feed refresh and narrow-screen layout
at 375 and 320 pixel viewport settings. No browser warnings/errors were recorded.
The live service worker reports offline readiness. Offline reload and note
storage were previously tested locally; an offline reload of the public site
and installation on a physical iPhone have not been performed here. The future
scheduled trigger is configured; the initial successful run was triggered by a push.

GitHub reported action-runtime deprecation warnings while successfully running
the deployment actions on Node 24. These did not prevent collection or deployment.

## Install on iPhone
1. Open the live app link above in Safari on your iPhone.
2. Wait for the listings and the offline-ready message.
3. Tap Share (use More first if Share is not directly visible).
4. Tap Add to Home Screen.
5. If shown, turn on Open as Web App, then tap Add.
6. Open Guernsey Property Finder using its Home Screen icon.

Shortlists, saved searches and notes are local to each browser/device. Existing
localhost records do not automatically transfer to the HTTPS site or iPhone.
Photographs need a connection or an existing browser cache. Avoid clearing
website data if you want to keep your notes.

## Development
### Advertised plot sizes

The collector reads explicit acreage from each listing's description and key
features. Exact, approximate and lower/upper-bound measurements retain their
qualifications and source wording in the property details. It does not estimate
land from photographs, sum separate parcels, infer total floor area from room
dimensions, or convert unsupported land units.

Conflicting figures use the smaller stated amount and are flagged in the app.
When amounts are equal, the stricter qualification is retained. Ranges and
partial land measurements remain unconfirmed. An upper bound such as "under half
an acre" cannot establish a minimum. The Include unknown data checkbox lets
missing or insufficient size evidence remain as clearly labelled possibilities;
turning it off requires stated sizes. Known measurements below a minimum are
always excluded, including upper bounds that rule out the minimum. Search counts
show how many results have unconfirmed sizes. Approximate sizes are compared at their
advertised value and visibly labelled; check the original agent listing before
relying on a threshold.

Floor areas are collected from explicit dwelling totals in descriptions and key
features. Square metres are converted using 1 sq m = 10.76391041671 sq ft, with
the original value, unit and wording retained in details. Approximate and bounded
totals keep their qualifications; upper bounds that cannot confirm a minimum
remain labelled possibilities only when unknown data is included. Conflicting
totals use the smaller figure. Room dimensions are not summed, and terrace,
garage, shed, proposed extension and individual-floor areas are excluded.
PDF brochures and floorplan images are not yet extracted, so many areas remain
unknown. No new collection dependencies or requests have been added.

Node.js 24; no npm packages required.

    node --test collector.test.cjs app.test.cjs
    node --use-system-ca collector.cjs
    node build.cjs

The build publishes only seven public app/data files plus .nojekyll in _site.
The hosted app uses relative paths, a separate service-worker cache version,
and the published feed instead of a local collection API. Existing search,
shortlist, saved-search, property-detail and note functionality is preserved.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://support.apple.com/guide/iphone/iph42ab2f3a7/ios
