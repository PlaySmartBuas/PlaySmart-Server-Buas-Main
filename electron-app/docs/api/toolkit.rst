Toolkit API
===========

Endpoints
---------

- ``GET /api/toolkit/select-file`` — Open native file dialog to select the toolkit batch file.
- ``GET /api/toolkit/select-obs`` — Open native file dialog to select OBS executable.
- ``GET /api/toolkit/select-tobii`` — Open native file dialog to select Tobii manager.
- ``POST /api/toolkit/start-obs`` — Start OBS (request JSON with ``obsPath``).
- ``POST /api/toolkit/start-tobii`` — Start Tobii manager (JSON with ``tobiiPath``).
- ``POST /api/toolkit/start-toolkit`` — Start the toolkit by launching batch file (JSON with ``batPath``).
- ``POST /api/toolkit/stop-toolkit`` — Stop the running toolkit process.
- ``GET /api/toolkit/toolkit-status`` — Check toolkit running status.
- ``GET/POST /api/toolkit/config`` — Get or save toolkit configuration for the user.

Notes
-----
This router controls local processes and uses OS-specific mechanisms (e.g., creating new consoles on Windows). Use with care on production servers; intended for local developer machines.

Axios example (start toolkit)
-----------------------------

.. code-block:: javascript

	import axios from 'axios';

	axios.post('http://localhost:8000/api/toolkit/start-toolkit', { batPath: 'C:\\path\\to\\main.bat' })
	  .then(res => console.log(res.data))
	  .catch(err => console.error(err.response?.data || err.message));

Toolkit config example (response) - ``ToolkitConfig``
-----------------------------------------------------

.. code-block:: json

	{
	  "id": 1,
	  "user_id": 5,
	  "toolkit_path": "C:\\path\\to\\main.bat",
	  "obs_path": "C:\\Program Files\\obs\\obs64.exe",
	  "tobii_path": "C:\\Program Files\\Tobii\\Tobii.exe",
	  "data_directory": "C:\\data",
	  "created_at": "2026-01-01T12:00:00",
	  "updated_at": null
	}

Module source
-------------

.. automodule:: app.router.toolkit
	:noindex:
