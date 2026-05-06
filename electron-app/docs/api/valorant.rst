Valorant API
============

Mounted prefix: ``/api/valorant`` (see ``backend/app/router/valorant.py``)

Purpose: convenience wrappers over HenrikDev's Valorant API to fetch account and match data.

Notable endpoints
------------------

- ``GET /api/valorant/account/{riot_id}`` — Riot ID form ``name#tag``. Returns player account info (level, region, etc.).
- ``GET /api/valorant/account/{name}/{tag}`` — Same as above using separate parameters.
- ``GET /api/valorant/matches/{region}/{name}/{tag}`` — Player match history (query params: ``mode``, ``map``, ``size`` 1-10).
- ``GET /api/valorant/matches/{riot_id}`` — Match history by Riot ID format.

Error handling: the router translates upstream HTTP errors (400, 403, 404, 408, 429, 503) from HenrikDev into matching HTTPExceptions so the frontend can handle them.
