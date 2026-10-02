import json
import sqlite3
import asyncio
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app import database, main


@pytest.fixture

def emergency_database(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "emergency-test.db")
    database.initialize_db()
    database.save_profile(
        {
            "username": "patient-one",
            "password_hash": "test-password",
            "role": "Patient",
            "full_name": "Patient One",
            "age": 35,
            "gender": "Other",
        }
    )
    database.save_profile(
        {
            "username": "doctor-one",
            "password_hash": "test-password",
            "role": "Doctor",
            "full_name": "Doctor One",
        }
    )
    database.save_profile(
        {
            "username": "patient-two",
            "password_hash": "test-password",
            "role": "Patient",
            "full_name": "Patient Two",
        }
    )
    return database.DB_PATH


def test_emergency_request_is_private_and_allows_missing_location(emergency_database):
    patient = {"username": "patient-one", "role": "Patient"}
    request = main.EmergencyRequest(
        symptoms=["Chest pain"],
        risk_level="Critical",
        vitals={"heart_rate": 104, "private_field": "discard"},
    )

    created = main.create_emergency_request(request, patient)
    stored = main.get_emergency_request(created["emergency_id"], patient)

    assert created["status"] == "SEARCHING"
    assert stored["lat"] is None
    assert stored["lng"] is None
    assert stored["vitals"] == {"heart_rate": 104}
    with pytest.raises(HTTPException) as error:
        main.get_emergency_request(
            created["emergency_id"], {"username": "patient-two", "role": "Patient"}
        )
    assert error.value.status_code == 403


def test_doctor_heartbeat_is_role_scoped_and_expires(emergency_database):
    patient = {"username": "patient-one", "role": "Patient"}
    doctor = {"username": "doctor-one", "role": "Doctor"}

    with pytest.raises(HTTPException) as error:
        main.update_doctor_heartbeat(main.DoctorHeartbeat(status="AVAILABLE"), patient)
    assert error.value.status_code == 403

    main.update_doctor_heartbeat(
        main.DoctorHeartbeat(status="AVAILABLE", lat=12.9716, lng=77.5946), doctor
    )
    nearby = main.nearby_doctors(12.9716, 77.5946, 10, patient)
    assert len(nearby) == 1
    assert nearby[0]["status"] == "AVAILABLE"
    assert nearby[0]["phone"] is None

    connection = sqlite3.connect(emergency_database)
    stale_time = (datetime.utcnow() - timedelta(minutes=2)).isoformat() + "Z"
    connection.execute(
        "UPDATE doctors SET last_seen = ? WHERE username = 'doctor-one'", (stale_time,)
    )
    connection.commit()
    connection.close()

    stale = main.nearby_doctors(12.9716, 77.5946, 10, patient)
    assert stale == []


def test_doctor_acceptance_and_cancel_clear_location(emergency_database):
    patient = {"username": "patient-one", "role": "Patient"}
    doctor = {"username": "doctor-one", "role": "Doctor"}
    created = main.create_emergency_request(
        main.EmergencyRequest(symptoms=["Fever"], lat=12.97, lng=77.59, accuracy=15),
        patient,
    )

    with pytest.raises(HTTPException) as error:
        main.accept_emergency(main.DoctorAccept(emergency_id=created["emergency_id"]), patient)
    assert error.value.status_code == 403

    accepted = main.accept_emergency(
        main.DoctorAccept(emergency_id=created["emergency_id"]), doctor
    )
    assert accepted["status"] == "DOCTOR_ASSIGNED"
    assert main.get_emergency_request(created["emergency_id"], patient)["accepted_by"] == "doctor-one"

    main.cancel_emergency_request(created["emergency_id"], patient)
    closed = main.get_emergency_request(created["emergency_id"], patient)
    assert closed["status"] == "CANCELLED"
    assert closed["lat"] is None
    assert closed["accuracy"] is None


def test_token_signature_is_verified():
    token = main._issue_access_token("patient-one", "Patient")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    assert main.get_principal(credentials) == {"username": "patient-one", "role": "Patient"}

    tampered = HTTPAuthorizationCredentials(scheme="Bearer", credentials=f"{token}x")
    with pytest.raises(HTTPException) as error:
        main.get_principal(tampered)
    assert error.value.status_code == 401


def test_public_registration_cannot_assign_privileged_roles():
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            main.register(
                main.AuthRegistration(username="self-admin", password="test-password", role="Admin")
            )
        )
    assert error.value.status_code == 403


def test_registration_rejects_whitespace_username():
    with pytest.raises(ValidationError):
        main.AuthRegistration(username="   ", password="test-password")


def test_patient_registration_hashes_password_and_cannot_elevate_role(emergency_database):
    asyncio.run(
        main.register(
            main.AuthRegistration(
                username="new-patient",
                password="test-password",
                role="Patient",
                age=19,
                gender="Female",
            )
        )
    )
    stored = database.load_profile("new-patient")
    assert stored["password_hash"].startswith("pbkdf2_sha256$")
    assert stored["age"] == 19
    assert stored["gender"] == "Female"

    patient = {"username": "patient-one", "role": "Patient"}
    updated = asyncio.run(
        main.update_profile(
            main.UserProfile(username="patient-one", role="Admin"), patient
        )
    )
    assert updated.role == "Patient"
    assert database.load_profile("patient-one")["role"] == "Patient"


def test_public_registration_cannot_replace_an_existing_account(emergency_database):
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            main.register(
                main.AuthRegistration(username="patient-one", password="attacker-password", role="Patient")
            )
        )
    assert error.value.status_code == 409
    assert error.value.detail == "Username already exists"
    assert database.load_profile("patient-one")["password_hash"] == "test-password"


def test_login_verifies_hashed_password_and_returns_session(emergency_database):
    asyncio.run(
        main.register(
            main.AuthRegistration(username="new-patient", password="test-password")
        )
    )

    result = asyncio.run(
        main.login(main.AuthLogin(username="new-patient", password="test-password"))
    )

    assert result["success"] is True
    assert result["username"] == "new-patient"
    assert result["role"] == "Patient"
    assert result["token"]


def test_login_rejects_invalid_password(emergency_database):
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            main.login(main.AuthLogin(username="patient-one", password="wrong-password"))
        )

    assert error.value.status_code == 401


def test_osm_hospital_results_are_sorted_and_unverified(monkeypatch):
    elements = {
        "elements": [
            {"type": "node", "id": 2, "lat": 12.98, "lon": 77.59, "tags": {"name": "Far Hospital"}},
            {"type": "node", "id": 1, "lat": 12.9717, "lon": 77.5946, "tags": {"name": "Near Hospital", "phone": "+1 555 0100"}},
        ]
    }

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(elements).encode("utf-8")

    monkeypatch.setattr(main, "urlopen", lambda *_args, **_kwargs: FakeResponse())
    hospitals = main._fetch_osm_hospitals(12.9716, 77.5946, 10)

    assert hospitals[0]["name"] == "Near Hospital"
    assert hospitals[0]["source"] == "OpenStreetMap"
    assert hospitals[0]["emergency_availability"] == "Emergency availability not verified"
    assert hospitals[0]["opening_status"] == "Status unavailable"
    assert hospitals[0]["phone"] == "+1 555 0100"
    assert hospitals[0]["distance_km"] < hospitals[1]["distance_km"]
