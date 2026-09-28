import sys
from pathlib import Path

import pytest

PIPELINE = Path(__file__).resolve().parents[1]
if str(PIPELINE) not in sys.path:
    sys.path.insert(0, str(PIPELINE))


@pytest.fixture(scope="session")
def model_cfg():
    from hdst_pipeline.paths import load_model_config

    return load_model_config()
