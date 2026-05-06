API Reference (generated)
=========================

This page provides a compact reference of all API endpoints discovered in
``backend/app/router/`` and the prefixes used when routers are mounted in
``backend/app/main.py``.

Note: This is a machine-assisted summary created from the router modules.

Auth
----

- POST /api/auth/signup
- POST /api/auth/login

Feedback
--------

- POST /api/feedback
- GET  /api/feedback/{riot_id}/{game}
- DELETE /api/feedback/{feedback_id}

Reaction time
-------------

- POST /api/reaction-time/run

Valorant
--------

- GET /api/valorant/account/{riot_id}
- GET /api/valorant/account/{name}/{tag}
- GET /api/valorant/matches/{region}/{name}/{tag}
- GET /api/valorant/matches/{riot_id}

Riot
----

- GET /riot/account/{region}/{game_name}/{tag_line}
- GET /riot/summoner/{platform}/{puuid}
- GET /riot/ranked-by-puuid/{platform}/{puuid}
- GET /riot/matches/{region}/{puuid}
- GET /riot/match/{region}/{match_id}
- GET /riot/mastery/{platform}/{puuid}

Match Data
----------

- GET /api/list-matches
- GET /api/match-details/{filename}
- GET /api/csv-summary
- GET /api/read-csv

Toolkit
-------

- GET /api/toolkit/select-file
- GET /api/toolkit/select-obs
- GET /api/toolkit/select-tobii
- POST /api/toolkit/start-obs
- POST /api/toolkit/start-tobii
- POST /api/toolkit/start-toolkit
- POST /api/toolkit/stop-toolkit
- GET  /api/toolkit/toolkit-status
- POST /api/toolkit/reset-toolkit
- GET/POST /api/toolkit/config

Biometrics
----------

- GET /api/biometrics/match/{filename}
- GET /api/biometrics/test

Videos
------

- GET /api/videos/{filename}

Coach
-----

- GET /api/coach/select-data-directory
- GET /api/coach/config
- POST /api/coach/config
- DELETE /api/coach/config

If you want this file to be fully auto-generated from source, I can add a
small script to extract decorators and prefixes and re-run it as part of
your docs build. That would keep the reference synchronized with code.
