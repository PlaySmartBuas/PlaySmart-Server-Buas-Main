API overview
============

This page summarises the backend API surface grouped by router. It links to
per-router pages with usage examples and expected paths.

Available routers
-----------------

- ``feedback`` (mounted at ``/api`` by the backend's router registration)
  - Endpoints: ``POST /api/feedback`` (create), ``GET /api/feedback/{riot_id}/{game}`` (list), ``DELETE /api/feedback/{feedback_id}``
  - See :doc:`api/feedback` for examples and expected request shapes.

- ``reaction_time`` (mounted at ``/api/reaction-time``)
  - Endpoints: ``POST /api/reaction-time/run`` to perform reaction inference.
  - See :doc:`api/reaction_time` for payload details and example responses.

- ``valorant`` (mounted with prefix ``/api/valorant``)
  - Endpoints: account lookups and match history (detailed in :doc:`api/valorant`).

Other routers
-------------

The backend contains additional routers for auth, toolkit, biometrics, videos
and coach functionality. The router modules are located in
``backend/app/router/``. To add more documentation pages for these modules I
can either create hand-written summaries or attempt to extract docstrings
automatically — tell me which you prefer.

.. toctree::
  :maxdepth: 1

  api/reaction_time
  api/feedback
  api/valorant
  api/auth
  api/biometrics
  api/coach
  api/match_data
  api/riot
  api/toolkit
  api/videos
  api_reference

