Adding a new API router
=======================

This short guide shows the minimal steps to add a new FastAPI router to the
backend and surface it in the documentation.

1. Create the router module

   Path: ``backend/app/router/your_router.py``

   Example start::

      from fastapi import APIRouter

      router = APIRouter()

      @router.get('/hello')
      async def hello():
          return {'message': 'hello'}

2. Register the router

   Open ``backend/app/main.py`` and add an ``include_router`` call.

   Prefer adding a prefix to the include for public routes, e.g.::

      from app.router import your_router as your_router_module

      app.include_router(your_router_module.router, prefix='/api/your', tags=['Your'])

3. Document the router

   - Add a short ReST page under ``electron-app/docs/api/`` named
     ``your_router.rst``.
   - Add the page to ``electron-app/docs/api_overview.rst``'s toctree so it
     appears in the site.

4. Rebuild docs

   From ``electron-app/docs`` run::

      sphinx-build -b html . _build/html

5. Optional: Auto-generate API reference

   If you want the API reference kept in sync automatically, add a small
   script that parses router files for decorator lines (``@router.get/post``)
   and writes an rst file. I can help implement that script if you'd like.
