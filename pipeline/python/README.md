# Local Python / VS Code environment

This folder is for optional local Earth Engine API calls and model experiments.
It must not contain private asset IDs, service-account keys, precise langur
locations, raw sightings or exported sensitive rasters.

## Important architecture note

The Earth Engine Python API sends requests to Google's Earth Engine servers.
It does not make Earth Engine use the local GPU. A local GPU is only relevant
after exporting predictor data or image tiles and training a local model such
as XGBoost, LightGBM or a neural network.

## Windows setup in VS Code

Open a PowerShell terminal in the repository root:

```powershell
cd C:\path\to\langur-habitat-monitoring
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r python\requirements.txt
```

The core file deliberately excludes the optional geemap notebook stack. If you
need interactive geemap maps, install `python\\requirements-optional-geemap.txt`
using Python 3.11–3.13, or install Microsoft C++ Build Tools for packages that
do not yet publish Python 3.15 wheels.

If PowerShell blocks activation, run this once in a normal user PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

In VS Code, select the interpreter:

1. `Ctrl+Shift+P`
2. Choose **Python: Select Interpreter**
3. Select `.venv\Scripts\python.exe` (the displayed path should be
   `.venv\\Scripts\\python.exe`)

## Earth Engine authentication

Run this after activating the environment:

```powershell
earthengine authenticate
```

Complete the browser login with the authorised Google account. Do not put the
token or a service-account JSON file in GitHub.

Test the connection:

```powershell
python -c "import ee; ee.Initialize(); print(ee.Number(1).getInfo())"
```

Expected output is `1`.

## First safe test script

Use only a public catalog object for the first test:

```python
import ee

ee.Initialize()

collection = ee.ImageCollection(
    "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL"
).filterDate("2024-01-01", "2025-01-01")

print("Images:", collection.size().getInfo())
print("First image bands:", collection.first().bandNames().getInfo())
```

Only after this succeeds should an authorised private asset configuration be
used. Keep private configuration in a local ignored file, never in a public
script.

## Local model workflow

1. Prepare imagery, masks and exports in Earth Engine.
2. Export a non-sensitive training table or image tiles to Drive/Cloud Storage.
3. Train local models in VS Code.
4. Use the same class definitions and validation protocol as the GEE models.
5. Save metrics and model metadata.
6. Upload only approved non-sensitive prediction rasters back to Earth Engine.

Do not compare a locally trained model with a GEE model unless the predictors,
labels, split and validation design are identical.
