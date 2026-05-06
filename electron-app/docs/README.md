# Contributor guide: change docs, preview locally, build, and open a PR

This file explains the concrete steps you should follow when you want to change the documentation (text, examples, or API pages), preview your edits locally, and produce a build that you can review and submit.

Summary workflow

1. Edit the ReST/MD files under `electron-app/docs/` (and `electron-app/docs/api/` if you're adding or updating API pages).
2. Build the docs locally to preview the site quickly (mocked imports — fast).
3. If you need full autodoc fidelity (real Pydantic/SQLAlchemy types), create a venv and install backend deps, then rebuild.
4. Commit your changes and open a branch + PR with a short description of what changed and why.

Quick preview (recommended for most text changes)

Use this when you only change examples, or .rst layout. It uses the current lightweight docs setup which mocks heavy backend imports so the build is fast and reliable.

PowerShell commands (run from repository root):

```powershell
# change to the docs directory
cd .\electron-app\docs

# (optional) create and activate a small venv so installed packages don't affect your base env
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# install the minimal docs tooling
pip install -r requirements.txt

# build HTML into _build/html
sphinx-build -b html . _build/html

# open the result in Windows Explorer / browser
Start-Process _build\html\index.html
```

Notes:

- This path is fast and usable in CI; `conf.py` currently includes `autodoc_mock_imports` so FastAPI/Pydantic/SQLAlchemy are mocked during the build. That allows generating docs without installing backend dependencies.
- Good for verifying layout, wording, and that code blocks render properly.

Using an existing backend venv

If your checkout already contains a Python virtual environment for the backend (common path: `backend/venv`), you can activate and reuse that venv instead of creating a new one inside `electron-app/docs`.

From the `electron-app/docs` folder you can activate that backend venv in PowerShell with either:

```powershell
# dot-source the activation script
. ..\..\backend\venv\Scripts\Activate.ps1

# or invoke it explicitly
& ..\..\backend\venv\Scripts\Activate.ps1
```

After activation you may run `pip install -r requirements.txt` in the docs folder (if required) and then run the same `sphinx-build` commands shown above. Reusing the backend venv is convenient when the backend packages are already installed and you want full autodoc fidelity without duplicating installations.

When to run a full build (real autodoc)

If your changes involve Pydantic model shapes, function signatures, or you want Sphinx to show the real class/attribute details (not mocked), run a full build in an environment that has the backend dependencies installed.

Recommended PowerShell flow (from repo root):

```powershell
cd .\electron-app\docs
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# install backend in editable mode so Sphinx can import it (adjust path if your layout differs)
pip install -e ..\..\backend
# now build
sphinx-build -b html . _build/html
Start-Process _build\html\index.html
```

Troubleshooting tips

- If Sphinx reports import errors from Pydantic or SQLAlchemy, make sure the venv Python version and package versions match what's used by the backend. Creating a fresh venv and installing the backend in editable mode is the cleanest approach.
- If you prefer not to install backend deps, keep using the quick preview flow — it's the fastest and avoids version conflicts.

Committing and opening a PR

1. Create a branch:

```powershell
git checkout -b docs/<short-description>
```

2. Run the quick preview steps and inspect the generated `_build/html` locally.
3. Stage and commit your changes:

```powershell
git add electron-app/docs/path/to/changed/file.rst
git commit -m "docs: update <area> - short reason"
git push --set-upstream origin docs/<short-description>
```

4. Open a PR in GitHub describing what changed, why, and mentioning any reviewers.

Optional: automated helper script

If you'd like, I can add `build-docs.ps1` to automate the common workflows (quick preview and full build). That script can:

- create/activate a venv,
- install `requirements.txt`,
- optionally `pip install -e ../../backend`,
- run `sphinx-build -b html . _build/html`, and
- open the resulting HTML in your browser.

Thanks — follow the steps above to preview changes quickly, and use the full build flow when you need accurate autodoc output from the backend.
