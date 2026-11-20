"""REST 공통 예시와 잘못된 형식을 독립 JSON Schema 검사기로 확인한다."""

from copy import deepcopy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker, ValidationError
from referencing import Registry, Resource

DOCS = Path(__file__).resolve().parents[2] / "docs"
SCHEMAS = {name: json.loads((DOCS / f"{name}-schema.json").read_text())
           for name in ("report", "checklist")}
REGISTRY = Registry().with_resources((schema["$id"], Resource.from_contents(schema))
                                     for schema in SCHEMAS.values())


def example(name):
    return json.loads((DOCS / "examples" / f"{name}.json").read_text())


def validator(name):
    return Draft202012Validator(SCHEMAS[name], registry=REGISTRY, format_checker=FormatChecker())


@pytest.mark.parametrize("name", ["report", "checklist"])
def test_schema_is_valid(name):
    Draft202012Validator.check_schema(SCHEMAS[name])


@pytest.mark.parametrize("name", ["report-normal", "report-unknown", "report-mock",
                                  "checklist-timeline", "checklist-category"])
def test_shared_examples_validate_without_network(name):
    validator(name.split("-")[0]).validate(example(name))


@pytest.mark.parametrize("mutation", [
    lambda row: row.update(id=row.pop("item_id")),
    lambda row: row.update(explanation=row.pop("reason")),
    lambda row: row.update(verdict="판단 불가"),
    lambda row: row.update(verdict="high", decided_by="ai"),
    lambda row: row.update(evidence=[]),
    lambda row: row["evidence"][0].update(kind="data"),
    lambda row: row["options"][0].update(site_id="old-site"),
    lambda row: row["options"][0]["apply"].update(type="set_main_site"),
    lambda row: row["options"][0]["cost"].update(delta_krw=10000),
    lambda row: row["options"][0]["time"].update(text="3일"),
    lambda row: row.update(action_status="finished"),
    lambda row: row["evidence"][0].update(fetched_at="어제"),
])
def test_old_or_unsafe_report_formats_are_rejected(mutation):
    payload = example("report-normal")
    mutation(payload["groups"][0]["items"][0])
    with pytest.raises(ValidationError):
        validator("report").validate(payload)


def test_old_combined_report_and_schedule_is_rejected():
    with pytest.raises(ValidationError):
        validator("report").validate({"input": {}, "items": [], "schedule": [], "disclaimer": "예시"})


def test_checklist_rejects_bad_date_and_accepts_unknown_date():
    payload = example("checklist-timeline")
    row = payload["groups"][0]["items"][0]
    row["due_date"] = "2027-02-30"
    with pytest.raises(ValidationError):
        validator("checklist").validate(payload)
    row.update(due_date=None, dday=None)
    validator("checklist").validate(payload)


def test_examples_preserve_provenance_and_unknown_contact():
    normal = example("report-normal")
    mock = example("report-mock")
    unknown = example("report-unknown")
    assert all(p["is_example"] and p["example_notice"] for p in (normal, mock, unknown))
    assert mock["groups"][0]["items"][0]["evidence"][0]["from_mock"]
    assert not unknown["groups"][0]["items"][0]["evidence"]
    contact = normal["groups"][0]["items"][0]["contact"]
    assert contact["phone"] is None and contact["is_example"]


def test_timeline_and_category_share_identical_checklist_items():
    timeline = example("checklist-timeline")
    category = example("checklist-category")
    assert timeline["groups"][0]["items"] == category["groups"][0]["items"]
    payload = deepcopy(timeline)
    payload["groups"][0]["items"][0]["auto_checked"] = "true"
    with pytest.raises(ValidationError):
        validator("checklist").validate(payload)


@pytest.mark.parametrize("field,value", [("prepared", []), ("contact", {"agency": "기관", "phone": None, "verified": False})])
def test_obsolete_prepared_and_verified_contracts_are_rejected(field, value):
    payload = example("report-normal")
    payload["groups"][0]["items"][0][field] = value
    with pytest.raises(ValidationError):
        validator("report").validate(payload)


def test_checklist_documents_require_objects_with_links():
    payload = example("checklist-timeline")
    payload["groups"][0]["items"][0]["documents"] = ["서류 이름만"]
    with pytest.raises(ValidationError):
        validator("checklist").validate(payload)
