# Guernsey Property Finder — hosted deployment

Status: prepared and locally tested; not yet published. GitHub account sign-in
is required before repository creation, Pages activation and live validation.
The original working app in the sibling Guernsey-Property-Finder folder is unchanged.

## Planned deployment
- Free public GitHub repository, HTTPS GitHub Pages site.
- GitHub Actions collects Cooper Brouard every six hours at 02:23, 08:23, 14:23
  and 20:23 UTC; GitHub may delay scheduled jobs.
- Pushes to main and manual workflow runs also collect, test and deploy.
- A failed collection stops publication, keeping the existing live site intact.
- Each successful feed is committed before deployment so subsequent runs start
  from the latest good snapshot. No custom secrets or personal access tokens are
  embedded in this repository.
- A public repository contains the source code and public property data, not
  browser-local notes, saved searches or shortlist data.

## Necessary hosting adaptation
The hosted Refresh listings button fetches the latest cloud-published feed.
It does not call a local Node API or expose an unauthenticated collector endpoint.
To force an immediate cloud collection, use Actions > Collect and deploy property
finder > Run workflow. Normal collection runs automatically every six hours.
The hosted offline cache has a separate version. Other application functions
are unchanged. Relative paths support a repository subdirectory.

## Validation completed locally
- All 12 collector/application tests pass.
- Static build includes only the eight public app/data assets and .nojekyll.
- Browser preview under /guernsey-property-finder/ loads 114 listings and photos.
- Clear and hosted Refresh work, with no recorded browser warnings/errors.
- Workflow configuration has not yet executed on GitHub; live HTTPS and scheduled
  collector operation still require post-deployment verification.

## Remaining deployment steps
1. Sign in to the user's GitHub account.
2. Create the public guernsey-property-finder repository and upload these source
   files, including .github/workflows/deploy.yml, on main.
3. Set Settings > Pages > Source to GitHub Actions.
4. Run Collect and deploy property finder; verify collection, tests and deployment.
5. Open the actual HTTPS URL returned by the successful deployment and test
   search, saved search, shortlist, notes, photos, refresh and offline reload.
6. Confirm the schedule is present on main and enabled in Actions. An initial
   manual run validates the collector but does not prove a future scheduled run.

GitHub can disable schedules after 60 days of repository inactivity; successful
feed commits normally provide ongoing activity. Check Actions if the on-screen
collection timestamp becomes stale or GitHub sends a workflow failure notice.

## iPhone installation — after successful deployment
1. Open the confirmed HTTPS site address in Safari on the iPhone.
2. Wait for properties to appear and the offline-ready message.
3. Tap Share (use the More menu first if Share is not directly visible).
4. Tap Add to Home Screen.
5. If shown, enable Open as Web App, then tap Add.
6. Launch Guernsey Property Finder from its new Home Screen icon.

The HTTPS URL is intentionally not guessed before deployment. Saved searches,
shortlists and notes are local to each device/site origin; existing localhost
records do not automatically transfer to the hosted address or iPhone. Photos
need a connection or an existing browser cache. Do not clear website data if you
want to retain local notes.

Official references:
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
https://support.apple.com/guide/iphone/iph42ab2f3a7/ios
