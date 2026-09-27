"""Income parsing and school assignment."""

import geopandas as gpd
import pandas as pd
from shapely.geometry import box

from hdst_pipeline.opportunity import (
    assign_districts,
    assign_schools,
    boundary_core,
    district_proficient,
    normalize_district_name,
    prepare_schools,
    school_core,
    school_levels,
)


def test_median_income_skips_census_jam_values(tmp_path):
    from hdst_pipeline.opportunity import load_median_income

    (tmp_path / "acsdt5y2024-b19013.dat").write_text(
        "GEO_ID|B19013_E001|B19013_M001\n"
        "1400000US42003010302|61035|12000\n"
        "1400000US42003010301|-666666666|-666666666\n"
        "0500000US42003|78548|500\n",
        encoding="utf-8",
    )
    incomes, county = load_median_income(tmp_path, "42003")
    assert incomes["42003010302"] == 61035
    assert incomes["42003010301"] is None
    assert county == 78548


def test_district_names_match_across_pde_and_tiger():
    assert normalize_district_name("Mt Lebanon School District") == normalize_district_name(
        "Mount Lebanon School District"
    )
    assert normalize_district_name("Upper St. Clair School District") == normalize_district_name(
        "Upper Saint Clair School District"
    )


def test_school_names_match_across_boundary_and_future_ready():
    assert school_core("Pittsburgh Arsenal K-5") == school_core("Arsenal PK-5") == "arsenal"
    assert school_core("Pittsburgh Allderdice HS") == school_core("Allderdice") == "allderdice"
    assert school_core("Pittsburgh Roosevelt K -5") == "roosevelt"
    assert boundary_core("North Side") == "perry"
    assert boundary_core("U PREP 6-8") == "milliones"
    assert boundary_core("WESTINGHOUSE 9-12") == "academy at westinghouse"
    assert school_levels("K5F, 1, 2, 3, 4, 5") == ["elementary"]
    assert school_levels("K5F, 1, 2") == []
    assert school_levels("6, 7, 8, 9, 10, 11, 12") == ["middle", "high"]
    assert school_levels("PreKF") == []


def test_prepare_schools_skips_suppressed_cells_charters_and_online_schools():
    assessments = pd.DataFrame(
        {
            "AUN": [1, 1, 1],
            "Schl": [10, 11, 12],
            "PercentProficientorAdvancedonMathematicsAlgebra1_AllStudent": ["IS", 40, 90],
            "PercentProficientorAdvancedonELALiterature_AllStudent": [22, 55, 91],
        }
    )
    facts = pd.DataFrame(
        {
            "AUN": [1, 1, 1],
            "Schl": [10, 11, 12],
            "Name": ["Pittsburgh Colfax K-8", "Urban Academy CS", "Pittsburgh Online Academy"],
            "DistrictName": ["Pittsburgh School District"] * 3,
            "GradesOffered": ["K5F, 1, 2, 3, 4, 5, 6, 7, 8", "K5F, 1, 2, 3, 4, 5", "4, 5, 6, 7, 8"],
            "Latitude": [40.45, 40.45, 40.45],
            "Longitude": [-79.93, -79.93, -79.93],
            "OrganizationTypeCode": ["regular", "charter", "regular"],
            "Enrollment": [400, 100, 50],
        }
    )
    table = prepare_schools(assessments, facts)
    assert list(table["name"]) == ["Pittsburgh Colfax K-8"]
    assert pd.isna(table.iloc[0]["mathProficient"])
    assert table.iloc[0]["elaProficient"] == 0.22
    assert table.iloc[0]["levels"] == ["elementary", "middle"]


def test_district_score_weights_each_school_once_by_enrollment():
    scores = district_proficient(
        [
            {"district_key": "pittsburgh school district", "enrollment": 100, "mathProficient": 0.10, "elaProficient": 0.20},
            {"district_key": "pittsburgh school district", "enrollment": 300, "mathProficient": 0.50, "elaProficient": 0.70},
            {"district_key": "pittsburgh school district", "enrollment": 50, "mathProficient": None, "elaProficient": None},
        ]
    )
    assert scores["pittsburgh school district"] == 0.4875


def test_tract_gets_the_district_covering_most_of_its_land():
    tracts = gpd.GeoDataFrame(
        {"id": ["42003010302"], "geometry": [box(-80.0, 40.0, -79.9, 40.1)]},
        crs="EPSG:4326",
    )
    districts = gpd.GeoDataFrame(
        {
            "NAME": ["Mount Lebanon School District", "North Allegheny School District"],
            "geometry": [
                box(-80.0, 40.0, -79.925, 40.1),
                box(-79.925, 40.0, -79.9, 40.1),
            ],
        },
        crs="EPSG:4326",
    )
    assigned = assign_districts(tracts, districts)
    row = assigned["42003010302"]
    assert row["schoolDistrict"] == "Mount Lebanon School District"
    assert row["schoolDistrictShare"] > 0.7
    assert row["schools"] == []


def _school(**overrides) -> dict:
    row = {
        "name": "Example School",
        "district_name": "Pittsburgh School District",
        "district_key": "pittsburgh school district",
        "core": "example",
        "levels": ["elementary"],
        "latitude": 40.45,
        "longitude": -79.92,
        "enrollment": 100,
        "mathProficient": 0.5,
        "elaProficient": 0.6,
    }
    row.update(overrides)
    return row


def test_pittsburgh_tract_uses_the_attendance_zone_not_the_nearer_school():
    tracts = gpd.GeoDataFrame(
        {"id": ["T"], "geometry": [box(-79.93, 40.44, -79.91, 40.46)]},
        crs="EPSG:4326",
    )
    districts = gpd.GeoDataFrame(
        {"NAME": ["Pittsburgh School District"], "geometry": [box(-79.95, 40.43, -79.90, 40.47)]},
        crs="EPSG:4326",
    )
    schools = pd.DataFrame(
        [
            _school(
                name="Pittsburgh Colfax K-8",
                core="colfax",
                levels=["elementary", "middle"],
                latitude=40.445,
                longitude=-79.912,
                mathProficient=0.71,
                elaProficient=0.78,
            ),
            _school(
                name="Pittsburgh Linden K-5",
                core="linden",
                latitude=40.45,
                longitude=-79.92,
                mathProficient=0.22,
                elaProficient=0.31,
            ),
            _school(
                name="Pittsburgh Arsenal K-5",
                core="arsenal",
                latitude=40.47,
                longitude=-79.96,
                mathProficient=0.19,
                elaProficient=0.28,
            ),
            _school(
                name="Pittsburgh Arsenal 6-8",
                core="arsenal",
                levels=["middle"],
                latitude=40.47,
                longitude=-79.96,
                mathProficient=0.81,
                elaProficient=0.74,
            ),
        ]
    )
    zones = {
        "elementary": gpd.GeoDataFrame(
            {
                "SchoolName": ["Colfax K-8", "Arsenal PK-5"],
                "geometry": [
                    box(-79.93, 40.44, -79.91, 40.46),
                    box(-80.2, 40.2, -80.1, 40.3),
                ],
            },
            crs="EPSG:4326",
        )
    }
    assigned = assign_schools(tracts, districts, schools, zones)
    elementary = assigned["T"]["schools"][0]
    assert elementary["name"] == "Pittsburgh Colfax K-8"
    assert elementary["basis"] == "attendance_zone"
    assert elementary["mathProficient"] == 0.71
    assert elementary["elaProficient"] == 0.78
    assert elementary["coverage"] > 0.95
    assert elementary["distanceMiles"] is None


def test_arsenal_zone_matches_the_elementary_not_the_middle_school():
    tracts = gpd.GeoDataFrame(
        {"id": ["T"], "geometry": [box(-80.05, 40.35, -80.03, 40.37)]},
        crs="EPSG:4326",
    )
    districts = gpd.GeoDataFrame(
        {"NAME": ["Pittsburgh School District"], "geometry": [box(-80.1, 40.3, -80.0, 40.4)]},
        crs="EPSG:4326",
    )
    schools = pd.DataFrame(
        [
            _school(
                name="Pittsburgh Arsenal K-5",
                core="arsenal",
                latitude=40.36,
                longitude=-80.04,
                mathProficient=0.19,
                elaProficient=0.28,
            ),
            _school(
                name="Pittsburgh Arsenal 6-8",
                core="arsenal",
                levels=["middle"],
                latitude=40.36,
                longitude=-80.04,
                mathProficient=0.81,
                elaProficient=0.74,
            ),
        ]
    )
    zones = {
        "elementary": gpd.GeoDataFrame(
            {"SchoolName": ["Arsenal PK-5"], "geometry": [box(-80.05, 40.35, -80.03, 40.37)]},
            crs="EPSG:4326",
        ),
        "middle": gpd.GeoDataFrame(
            {"SchoolName": ["ARSENAL 6-8"], "geometry": [box(-80.05, 40.35, -80.03, 40.37)]},
            crs="EPSG:4326",
        ),
    }
    schools_out = {item["level"]: item for item in assign_schools(tracts, districts, schools, zones)["T"]["schools"]}
    assert schools_out["elementary"]["name"] == "Pittsburgh Arsenal K-5"
    assert schools_out["elementary"]["mathProficient"] == 0.19
    assert schools_out["middle"]["name"] == "Pittsburgh Arsenal 6-8"
    assert schools_out["middle"]["mathProficient"] == 0.81


def test_other_districts_use_the_nearest_school_in_that_district():
    tracts = gpd.GeoDataFrame(
        {"id": ["T"], "geometry": [box(-80.06, 40.36, -80.04, 40.38)]},
        crs="EPSG:4326",
    )
    districts = gpd.GeoDataFrame(
        {"NAME": ["Mount Lebanon School District"], "geometry": [box(-80.08, 40.34, -80.02, 40.40)]},
        crs="EPSG:4326",
    )
    district_key = normalize_district_name("Mount Lebanon School District")
    schools = pd.DataFrame(
        [
            _school(
                name="Howe Elementary School",
                district_name="Mt Lebanon School District",
                district_key=district_key,
                core="howe elementary school",
                latitude=40.37,
                longitude=-80.05,
                mathProficient=0.88,
                elaProficient=0.9,
            ),
            _school(
                name="Lincoln Elementary School",
                district_name="Mt Lebanon School District",
                district_key=district_key,
                core="lincoln elementary school",
                latitude=40.30,
                longitude=-80.10,
                mathProficient=0.64,
                elaProficient=0.7,
            ),
            _school(name="Pittsburgh Colfax K-8", core="colfax", latitude=40.37, longitude=-80.05, mathProficient=0.71),
        ]
    )
    zones = {
        "elementary": gpd.GeoDataFrame(
            {"SchoolName": ["Colfax K-8"], "geometry": [box(-80.06, 40.36, -80.04, 40.38)]},
            crs="EPSG:4326",
        )
    }
    elementary = assign_schools(tracts, districts, schools, zones)["T"]["schools"][0]
    assert elementary["name"] == "Howe Elementary School"
    assert elementary["basis"] == "nearest_in_district"
    assert elementary["mathProficient"] == 0.88
    assert elementary["coverage"] is None
    assert elementary["distanceMiles"] < 1
