# Guernsey Property Finder

Live app: https://jd8gr92sjw-cyber.github.io/Guernsey-Property-Finder/

Deployed successfully on 30 September 2026 using free public GitHub Pages
hosting and GitHub Actions. The app and collector run independently of the
original computer. The original working local app is preserved separately.

## Collection and hosting
- Cooper Brouard residential sales, including Local and Open Market properties.
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

## Validation
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
