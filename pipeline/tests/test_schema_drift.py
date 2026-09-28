"""Source-schema drift detection: readers must fail loudly when expected fields vanish."""

import pandas as pd
import pytest

from hdst_pipeline import acs
from hdst_pipeline.allowed import MATRIX_COLUMNS, load_matrix
from hdst_pipeline.parcels import ASSESSMENT_COLS, FORBIDDEN_COLS, load_assessments
from hdst_pipeline.transit import busiest_weekday_services


def test_acs_schema_check_passes_on_expected_layout():
    cols = ["GEO_ID"] + [f"B25003_E{i:03d}" for i in range(1, 4)] + [f"B25003_M{i:03d}" for i in range(1, 4)]
    df = pd.DataFrame(columns=cols).set_index("GEO_ID")
    acs.check_table_schema(df, "B25003", 3)


def test_acs_schema_check_detects_missing_line():
    cols = ["GEO_ID", "B25003_E001", "B25003_M001", "B25003_E002", "B25003_M002"]
    df = pd.DataFrame(columns=cols).set_index("GEO_ID")
    with pytest.raises(ValueError, match="schema drift"):
        acs.check_table_schema(df, "B25003", 3)


def test_acs_read_table_filters_prefix(tmp_path):
    p = tmp_path / "acsdt5y2024-b25003.dat"
    p.write_text(
        "GEO_ID|B25003_E001|B25003_M001|B25003_E002|B25003_M002|B25003_E003|B25003_M003\n"
        "0100000US|100|1|60|1|40|1\n"
        "1400000US42003010301|200|20|120|15|80|12\n"
        "1400000US42005010100|300|20|120|15|180|12\n"
    )
    df = acs.read_table(p, ["1400000US42003"])
    assert list(df.index) == ["1400000US42003010301"]
    assert df.loc["1400000US42003010301", "B25003_E003"] == 80


def test_assessments_missing_column_is_drift(tmp_path):
    p = tmp_path / "assessments.csv"
    cols = [c for c in ASSESSMENT_COLS if c != "LOTAREA"]
    pd.DataFrame(columns=cols).to_csv(p, index=False)
    with pytest.raises(ValueError, match="schema drift"):
        load_assessments(p)


def test_assessment_usecols_never_include_pii():
    assert not (set(ASSESSMENT_COLS) & FORBIDDEN_COLS)


def test_assessments_reader_drops_pii_columns(tmp_path):
    p = tmp_path / "assessments.csv"
    row = {c: "1" for c in ASSESSMENT_COLS}
    row.update({"PARID": "0001G00224140400", "USEDESC": "SINGLE FAMILY", "CLASS": "R", "OWNERDESC": "JANE DOE", "CHANGENOTICEADDRESS1": "1 MAIN ST"})
    pd.DataFrame([row]).to_csv(p, index=False)
    df = load_assessments(p)
    assert "ownerdesc" not in df.columns and "changenoticeaddress1" not in df.columns
    assert df.index.tolist() == ["0001G00224140400"]


def test_zoning_matrix_columns_are_enforced(tmp_path):
    p = tmp_path / "m.csv"
    p.write_text("district,type,status\nR1D,adu,unknown\n")
    with pytest.raises(ValueError, match="columns"):
        load_matrix(p)
    good = tmp_path / "good.csv"
    good.write_text(",".join(MATRIX_COLUMNS) + "\nR1D,adu,unknown,,911.02,,,,\n")
    assert load_matrix(good)[0]["status"] == "unknown"


def test_zoning_matrix_rejects_bad_status_and_duplicates(tmp_path):
    p = tmp_path / "m.csv"
    p.write_text(",".join(MATRIX_COLUMNS) + "\nR1D,adu,maybe,,911.02,,,,\n")
    with pytest.raises(ValueError, match="unknown status"):
        load_matrix(p)
    p.write_text(",".join(MATRIX_COLUMNS) + "\nR1D,adu,unknown,,911.02,,,,\nR1D,adu,by_right,,911.02,,,,\n")
    with pytest.raises(ValueError, match="duplicate"):
        load_matrix(p)


def test_gtfs_calendar_drift():
    calendar = pd.DataFrame({"service_id": ["a"], "monday": [1]})
    trips = pd.DataFrame({"trip_id": ["t"], "service_id": ["a"], "route_id": ["r"]})
    with pytest.raises(ValueError, match="calendar.txt"):
        busiest_weekday_services(calendar, trips)
