Videos API
==========

Endpoints
---------

- ``GET /api/videos/{filename}`` — Serve video files with support for HTTP Range requests for efficient seeking.
  - Filename may be provided as CSV-style (``..._merged.csv``) or direct ``.mp4``; the router normalizes to an MP4 name.
  - Query param ``data_directory`` allows overriding the base video directory (used by the frontend to point to local developer data folders).

Behavior and errors
-------------------
- Returns full ``FileResponse`` when no Range header is present.
- Returns partial ``StreamingResponse`` with status 206 for Range requests.
- Errors: 404 if video directory or file not found; 416 for invalid range.

Example (curl)
--------------

Full fetch:

.. code-block:: bash

   curl -v http://localhost:8000/api/videos/1st_game_P037_league\ of\ legends_03-11-2025_14-49-24.mp4 -o out.mp4

Range request (first 1MB):

.. code-block:: bash

   curl -v -H "Range: bytes=0-1048575" http://localhost:8000/api/videos/yourfile.mp4 -o part.mp4

Module source
-------------

.. automodule:: app.router.videos
   :noindex:
