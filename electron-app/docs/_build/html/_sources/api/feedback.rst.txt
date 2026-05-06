Feedback API
============

Mounted: see backend router registration (commonly under ``/api``)

Endpoints
---------

- ``POST /api/feedback`` — Create a coach feedback entry.
  - Request body: FeedbackCreate model (see backend model in ``backend/app/models/feedback.py``)
  - Response: created Feedback object (HTTP 201)

- ``GET /api/feedback/{riot_id}/{game}`` — Fetch feedback for a player and game. Optional query param ``match_id`` filters by match.

- ``DELETE /api/feedback/{feedback_id}`` — Remove a feedback item by id.

Details
-------
The feedback endpoints are implemented in ``backend/app/router/feedback.py`` and use SQLAlchemy sessions injected via dependency. Validation errors and database errors will be returned as appropriate HTTP status codes.

Example JSON request
--------------------

(create feedback)

.. code-block:: json

   {
     "riot_id": "Player123",
     "coach_username": "coach_anna",
     "match_id": "match_2025_03_11",
     "timestamp": 125.4,
     "category": "Aim",
     "error_code": "AIM01",
     "feedback_text": "Adjust crosshair placement when holding long angles.",
     "game": "valorant"
   }

Axios example (create feedback)
-------------------------------

.. code-block:: javascript

   import axios from 'axios';

   const payload = {
     riot_id: 'Player123',
     coach_username: 'coach_anna',
     match_id: 'match_2025_03_11',
     timestamp: 125.4,
     feedback_text: 'Adjust crosshair placement when holding long angles.',
     game: 'valorant'
   };

   axios.post('http://localhost:8000/api/feedback', payload)
     .then(resp => console.log('created', resp.data))
     .catch(err => console.error(err.response?.data || err.message));

Curl example (create feedback)
------------------------------

.. code-block:: bash

   curl -X POST http://localhost:8000/api/feedback \
     -H "Content-Type: application/json" \
     -d '{"riot_id":"Player123","coach_username":"coach_anna","timestamp":125.4,"feedback_text":"Adjust crosshair placement","game":"valorant"}'

Module source
-------------

.. automodule:: app.router.feedback
   :noindex:

