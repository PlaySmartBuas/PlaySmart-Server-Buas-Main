Coach API
=========

Endpoints
---------

- ``GET /api/coach/select-data-directory`` — Opens a native directory picker (server-side).
- ``GET /api/coach/config`` — Retrieve the coach configuration for the authenticated user.
- ``POST /api/coach/config`` — Save or update coach configuration.
- ``DELETE /api/coach/config`` — Delete coach configuration for the current user.

Notes
-----
The coach endpoints use authentication dependencies to resolve the current user. The directory picker endpoint uses Tkinter on the server; it expects a GUI-capable environment when invoked.

Example response
----------------

(``CoachConfig``)

.. code-block:: json

   {
     "id": 1,
     "user_id": 5,
     "data_directory": "C:\\data",
     "created_at": "2026-01-01T12:00:00",
     "updated_at": null
   }

Module source
-------------

.. automodule:: app.router.coach
	:noindex:
