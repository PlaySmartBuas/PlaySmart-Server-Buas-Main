Project structure
=================

This page describes the main folders, files and responsibilities in the
Play-O-Meter repository (focused on the code shipped in this workspace).


Top-level layout
----------------

The repository is organised into a few focused top-level folders. The
short list below is expanded in the sections that follow.

- ``backend/`` — the FastAPI backend service (Python)
- ``electron-app/`` — the frontend (Electron + Vite + React + TypeScript)
- ``README.md`` — high-level project overview and developer instructions

backend/
--------

This folder contains the Python backend. Important items include:

    - ``app/`` - backend package: routers (``router/``), models (``models/``), CRUD helpers (``crud/``) and services (``services/``).

- project-level items
  - ``pyproject.toml`` — backend Python metadata and dependencies
  - migration scripts such as ``migrate_feedback.py`` and ``migrate_match_id.py``

electron-app/
--------------

Frontend application and Electron packaging. Key parts:

- ``package.json`` — Node dependencies and npm scripts
    - ``src/`` — React application source code (contains ``pages/``, ``components/`` and ``services/``).
- ``electron/`` — Electron main and preload scripts (``main.cjs``, ``preload.cjs``)
- ``public/`` — static assets (example videos, icons)
- ``docs/`` — Sphinx documentation for the frontend and repository (this folder)

Key files
=========

- Starts the FastAPI app and registers routers. If you need to add or
  change API prefixes, this is the canonical place to look.

- Contains the reaction-inference endpoints. Note that the router is
  mounted in ``main.py`` with a prefix; the exact prefix string determines
  the public API path (e.g. ``/api/reaction-time`` vs ``/api/reaction_time``).

- Player-side review page that calls the backend reaction-time API when
  running inference. If you get 404s from the frontend, verify the exact
  request URL matches the backend router prefix here.


How to run (developer hints)
----------------------------

Backend (typical)
~~~~~~~~~~~~~~~~~

1. Create and activate a Python virtual environment in ``backend/``.

   Example (Windows PowerShell)::

      python -m venv .venv
      .\.venv\Scripts\Activate.ps1

2. Install dependencies (project uses ``pyproject.toml`` / Poetry in this
   repository; or ``pip install -r requirements.txt`` if present).

3. Run the server with Uvicorn from the ``backend`` folder::

      uvicorn app.main:app --reload --port 8000

4. Visit the interactive API docs while developing:

   http://localhost:8000/docs


Frontend (Electron + Vite)
~~~~~~~~~~~~~~~~~~~~~~~~~~

1. From ``electron-app/`` install packages::

      npm install

2. Start the renderer app (Vite) during development (typical script name is
   ``dev`` or ``start``; check ``package.json``)::

      npm run dev

3. Build and run the Electron app using the project's npm scripts when
   needed.


Notes and tips
--------------

- API path correctness: Be precise with router prefixes. The backend may be
  mounted with hyphenated paths (``reaction-time``). If your frontend uses
  underscores (``reaction_time``) you will get a 404; check ``main.py`` and
  the route files for the exact prefix used.

- Documentation: This Sphinx site is purposely kept lightweight. Add more
  pages under this ``docs/`` folder and register them in ``index.rst``'s
  toctree so they appear in the site navigation.

- Contributing: When adding new backend routers, include docstrings and
  small API examples in the router module so they can be copied into the
  docs for quick reference.

Appendix — compact tree
-----------------------

.. code-block:: text

  Play-O-Meter-2025-26/
  ├─ ...
  └─ elctron_application/
    ├─ README.md
    ├─ backend/
    │  ├─ pyproject.toml
    │  ├─ migrate_feedback.py
    │  │  ...
    │  └─ app/
    │     ├─ main.py
    │     ├─ database.py
    │     ├─ router/
    │     ├─ models/
    │     └─ services/
    └─ electron-app/
      ├─ package.json
      ├─ src/
      ├─ public/
      ├─ electron/
      └─ docs/
        ├─ conf.py
        └─ index.rst

If you'd like, I can:

- Add more per-file API docs for the backend routes (automatically generated
  references or hand-written short summaries).
- Create a small contribution guide page showing how to add a new API router
  and update the frontend.

Pick what you'd like next and I will expand the docs accordingly.
