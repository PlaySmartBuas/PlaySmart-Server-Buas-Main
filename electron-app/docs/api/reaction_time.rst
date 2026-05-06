Reaction time API
==================

Mounted prefix: ``/api/reaction-time``

Endpoint: ``POST /api/reaction-time/run``

Description
-----------
Runs a YOLO-based reaction time inference pipeline for a gameplay video.

Payload (JSON)
--------------

- ``model_path`` (optional, string) — path to the model file to use. If omitted, the default model is used.
- ``video_path`` (string) — filesystem path or URL to the video to analyse. This may be a backend-served URL such as ``http://localhost:8000/api/videos/<name>.mp4``.
- ``input_log_path`` (string) — path to input-event CSV (required). The endpoint expects at least a ``unix_time`` column; ``event_type`` is recommended for click detection.
- ``gaze_log_path`` (optional) — optional gaze CSV path.
- ``threshold`` (optional, float) — detection threshold (default 0.8).
- ``output_csv_path`` (optional) — where to write a CSV output (backend may ignore depending on configuration).

Response
--------

On success returns JSON with a ``reaction_data`` list. Each item is a dict with timing and metadata the frontend can use to place timeline markers.

Errors
------

- 400: Validation problems such as missing paths, missing CSV columns, or missing files. The response contains a structured ``issues`` list describing which fields failed and why.
- 500: Internal errors (import or inference errors).

See also: backend implementation at ``backend/app/router/reaction_time.py`` for full details and behaviour.

Example JSON request
---------------------

.. code-block:: json

	 {
		 "model_path": "",
		 "video_path": "http://localhost:8000/api/videos/recording_123.mp4",
		 "input_log_path": "C:/data/logs/recording_123_input.csv",
		 "gaze_log_path": "C:/data/logs/recording_123_gaze.csv",
		 "threshold": 0.8,
		 "output_csv_path": ""
	 }

Example response (success)
--------------------------

.. code-block:: json

	 {
		 "reaction_data": [
			 {"timestamp": 12.34, "event": "reaction", "confidence": 0.92, "meta": {"frame": 1234}},
			 {"timestamp": 45.67, "event": "reaction", "confidence": 0.88, "meta": {"frame": 4567}}
		 ],
		 "meta": {"duration": 300.12, "model": "default"}
	 }

Axios example
-------------

.. code-block:: javascript

	 import axios from 'axios';

	 const payload = {
		 model_path: '',
		 video_path: 'http://localhost:8000/api/videos/recording_123.mp4',
		 input_log_path: 'C:/data/logs/recording_123_input.csv',
		 gaze_log_path: 'C:/data/logs/recording_123_gaze.csv',
		 threshold: 0.8,
	 };

	 axios.post('http://localhost:8000/api/reaction-time/run', payload)
		 .then(res => {
			 console.log('reaction_data', res.data.reaction_data);
		 })
		 .catch(err => {
			 console.error('Inference error', err.response?.data || err.message);
		 });

Curl example
------------

.. code-block:: bash

	 curl -X POST http://localhost:8000/api/reaction-time/run \
		 -H "Content-Type: application/json" \
		 -d '{"video_path":"http://localhost:8000/api/videos/recording_123.mp4","input_log_path":"C:/data/logs/recording_123_input.csv","threshold":0.8}'

	Module source
	-------------

	.. automodule:: app.router.reaction_time
		 :noindex:

