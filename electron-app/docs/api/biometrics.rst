Biometrics API
==============

Mounted: typically under the backend router registration prefix (see ``main.py``).

Endpoints
---------

- ``GET /api/biometrics/match/{filename}`` — Run biometric analysis for a merged CSV file and return results.
  - Query param: ``data_directory`` (optional) — base path for CSV files.
- ``GET /api/biometrics/test`` — Simple test endpoint that reads the first CSV it finds and returns an analysis or a message.

Notes
-----
This router delegates work to ``app.services.biometric_processor.get_complete_analysis``. If the file cannot be found or processed the endpoint returns an HTTP 404 with a helpful message.

Example response
----------------

(biometric analysis)

.. code-block:: json

   {
     "success": true,
     "summary": {
       "avg_heart_rate": 78.5,
       "gaze_metrics": {"fixations": 12, "saccades": 5},
       "emotion_counts": {"Happiness": 15, "Neutral": 45}
     }
   }

Module source
-------------

.. automodule:: app.router.biometrics
   :noindex:
