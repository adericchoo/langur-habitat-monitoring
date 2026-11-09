"""Safe Earth Engine connection test.

This script only reads a public catalog collection. It does not load private
langur assets, export imagery, train a model or modify Earth Engine state.
"""

import ee
import os


def main() -> None:
    # Keep the Cloud project ID in the local environment, not in GitHub.
    project_id = os.environ.get("GEE_PROJECT_ID")
    if not project_id:
        raise RuntimeError(
            "Set GEE_PROJECT_ID in your local terminal before running this test."
        )

    ee.Initialize(project=project_id)

    collection = (
        ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL")
        .filterDate("2024-01-01", "2025-01-01")
    )

    print("Earth Engine connection: OK")
    print("Earth Engine project:", project_id)
    print("Public AlphaEarth images found:", collection.size().getInfo())
    print("First image bands:", collection.first().bandNames().getInfo())


if __name__ == "__main__":
    main()
