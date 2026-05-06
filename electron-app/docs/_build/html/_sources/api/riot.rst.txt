Riot API
========

Mounted prefix: ``/riot``

Purpose
-------
Proxy helper endpoints that call the Riot Games API for League of Legends data. These endpoints require a Riot API key configured on the server (``RIOT_API_KEY``).

Notable endpoints
-----------------

- ``GET /riot/account/{region}/{game_name}/{tag_line}`` — Resolve Riot ID to account data (PUUID).
- ``GET /riot/summoner/{platform}/{puuid}`` — Summoner profile by PUUID.
- ``GET /riot/ranked-by-puuid/{platform}/{puuid}`` — Ranked entries for a PUUID.
- ``GET /riot/matches/{region}/{puuid}`` — Retrieve match IDs for a player (query params supported).
- ``GET /riot/match/{region}/{match_id}`` — Match details for a Riot match ID.
- ``GET /riot/mastery/{platform}/{puuid}`` — Top champion mastery entries.

Notes
-----
These endpoints forward upstream HTTP status codes and messages where appropriate. Ensure the server has a valid `RIOT_API_KEY` environment variable set.

Module source
-------------

.. automodule:: app.router.riot
	:noindex:
