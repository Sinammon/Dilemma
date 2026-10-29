# NRCan fuel-consumption reference snapshot

Publisher: Natural Resources Canada. Source: https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64

Contains information licensed under the Open Government Licence – Canada: https://open.canada.ca/en/open-government-licence-canada

Adapted reference data, not endorsed by the Government of Canada. Snapshot downloaded 29 October 2026. Exact URLs, source hashes, coverage and columns are in `manifest.json`. Year files contain compact arrays using those columns. `sourceIndex` selects a manifest resource. Numeric CSV values are converted to JSON numbers; no consumption values are estimated by Dilemma.

Coverage: 1995–2026 conventional and non-plug-in-hybrid vehicles. Pre-2015 values are NRCan's adjusted 5-cycle estimates. EV and plug-in-hybrid consumption is not included. This reference dataset is not user-listing or comparison storage.

Refresh with `python scripts/update-nrcan.py`. Review the downloaded resources and matching tests before committing an update.
