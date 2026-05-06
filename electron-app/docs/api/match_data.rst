Match Data API
==============

Endpoints
---------

- ``GET /api/list-matches`` — List merged matches present in a data directory. Query param ``data_directory`` is required.
- ``GET /api/match-details/{filename}`` — Details for a specific match file (path, video availability).
- ``GET /api/csv-summary`` — Quick summary for a CSV file (columns, sample rows, total rows).
- ``GET /api/read-csv`` — Read a CSV with pagination parameters (``file_path``, ``max_rows``, ``skip_rows``).

Notes
-----
This router is useful for building match listings in the frontend. The endpoints operate on CSV files under your configured data directory and return structured metadata useful for the UI.

Example response
----------------

(``list_matches`` — array of ``MatchFile``)

.. code-block:: json

   {
     "success": true,
     "matches": [
       {
         "filename": "2nd_game_P035_league of legends_03-11-2025_15-41-49",
         "display_name": "2Nd Game P035 League Of Legends 03-11-2025 15-41-49",
         "game_type": "league of legends",
         "date": "March 11, 2025",
         "has_video": true,
         "has_merged_data": true,
         "video_path": "/videos/2nd_game_P035_...mp4",
         "merged_data_path": "/merged/2nd_game_P035_..._merged.csv"
       }
     ],
     "count": 1,
     "game_type_filter": null,
     "data_directory": "C:/data"
   }

Module source
-------------

.. automodule:: app.router.match_data
	 :noindex:
