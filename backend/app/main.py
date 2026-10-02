from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional
import base64
import hashlib
import hmac
import io
import json
import math
import os
import shutil
import secrets
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from .database import (
    fetch_admin_stats,
    fetch_history,
    fetch_reminders,
    initialize_db,
    load_profile,
    save_feedback,
    save_prediction,
    save_profile,
    save_reminder,
)
from .model import (
    SYMPTOMS,
    get_condition_catalog,
    get_doctor_recommendation,
    get_doctor_recommendations,
    get_hospital_recommendations,
    get_ml_insights,
    get_symptom_library,
    get_prediction_history,
    get_decision_tree_structure,
    get_personalized_summary,
    get_translation_catalog,
    load_model,
    predict_treatment,
)

app = FastAPI(
    title="TreatmentPath Advisor",
    description="AI-assisted healthcare guidance that recommends symptom-based care pathways and referral information.",
    version="0.1.0",
)
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_TOKEN_SECRET = os.environ.get("TREATMENTPATH_AUTH_SECRET")
AUTH_TOKEN_SECRET = AUTH_TOKEN_SECRET.encode("utf-8") if AUTH_TOKEN_SECRET else secrets.token_bytes(32)
DOCTOR_HEARTBEAT_TIMEOUT_SECONDS = 90
bearer_scheme = HTTPBearer(auto_error=False)


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _issue_access_token(username: str, role: str) -> str:
    payload = _base64url_encode(
        json.dumps(
            {"sub": username, "role": role, "exp": int(time.time()) + 28800},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signature = hmac.new(AUTH_TOKEN_SECRET, payload.encode("ascii"), hashlib.sha256).digest()
    return f"{payload}.{_base64url_encode(signature)}"


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def _verify_password(stored_password: str, supplied_password: str) -> bool:
    if stored_password.startswith("pbkdf2_sha256$"):
        try:
            _, salt_hex, digest_hex = stored_password.split("$", 2)
            expected = bytes.fromhex(digest_hex)
            actual = hashlib.pbkdf2_hmac(
                "sha256", supplied_password.encode("utf-8"), bytes.fromhex(salt_hex), 210000
            )
            return hmac.compare_digest(actual, expected)
        except ValueError:
            return False
    return hmac.compare_digest(stored_password.encode("utf-8"), supplied_password.encode("utf-8"))


def get_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload, supplied_signature = credentials.credentials.split(".", 1)
        expected_signature = _base64url_encode(
            hmac.new(AUTH_TOKEN_SECRET, payload.encode("ascii"), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise ValueError("Invalid token signature")
        decoded = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        principal = json.loads(decoded)
        if principal["exp"] < int(time.time()) or not principal.get("sub"):
            raise ValueError("Expired token")
        return {"username": principal["sub"], "role": principal["role"]}
    except (ValueError, KeyError, TypeError, UnicodeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(principal: dict, *roles: str):
    if principal.get("role") not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _emergency_row_to_dict(row):
    result = dict(row)
    result["symptoms"] = json.loads(result.get("symptoms") or "[]")
    result["vitals"] = json.loads(result.get("vitals_json") or "{}")
    return result


def _expire_emergency_locations(connection):
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
    connection.execute(
        "UPDATE emergency_requests SET lat = NULL, lng = NULL, accuracy = NULL "
        "WHERE request_time < ? OR status IN ('CANCELLED', 'RESOLVED')",
        (cutoff,),
    )


def _can_access_emergency(principal: dict, row):
    return (
        principal["role"] == "Admin"
        or row["patient_username"] == principal["username"]
        or (
            principal["role"] == "Doctor"
            and row["accepted_by"] == principal["username"]
        )
    )


def _fetch_osm_hospitals(latitude: float, longitude: float, radius_km: int):
    radius_meters = radius_km * 1000
    query = (
        "[out:json][timeout:15];"
        "(node[amenity=hospital](around:{radius},{lat},{lng});"
        "way[amenity=hospital](around:{radius},{lat},{lng});"
        "relation[amenity=hospital](around:{radius},{lat},{lng}););"
        "out center tags 50;"
    ).format(radius=radius_meters, lat=latitude, lng=longitude)
    request = UrlRequest(
        "https://overpass-api.de/api/interpreter",
        data=urlencode({"data": query}).encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "TreatmentPathAdvisor/0.1 (emergency nearby lookup)",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=18) as response:
            elements = json.loads(response.read().decode("utf-8")).get("elements", [])
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="Nearby hospital data is unavailable") from error

    hospitals_result = []
    for element in elements:
        tags = element.get("tags", {})
        point = element.get("center", element)
        hospital_lat = point.get("lat")
        hospital_lng = point.get("lon")
        if hospital_lat is None or hospital_lng is None:
            continue
        distance = _haversine_km(latitude, longitude, hospital_lat, hospital_lng)
        if distance > radius_km:
            continue
        hospitals_result.append(
            {
                "id": f"osm-{element.get('type')}-{element.get('id')}",
                "name": tags.get("name") or "Unnamed hospital",
                "lat": hospital_lat,
                "lng": hospital_lng,
                "distance_km": round(distance, 1),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "emergency_availability": "Emergency availability not verified",
                "opening_status": "Status unavailable",
                "source": "OpenStreetMap",
            }
        )
    return sorted(hospitals_result, key=lambda hospital: hospital["distance_km"])


def _haversine_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    earth_radius_km = 6371.0
    latitude_delta = math.radians(latitude_b - latitude_a)
    longitude_delta = math.radians(longitude_b - longitude_a)
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(math.radians(latitude_a))
        * math.cos(math.radians(latitude_b))
        * math.sin(longitude_delta / 2) ** 2
    )
    return earth_radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


class SymptomRequest(BaseModel):
    symptoms: List[str] = Field(min_length=1)
    severity: Literal["Mild", "Moderate", "Severe"] = "Moderate"
    language: str = "en"
    age: Optional[int] = None
    gender: Optional[str] = None
    duration: Optional[str] = None
    vitals_temp: Optional[float] = None
    vitals_heart_rate: Optional[int] = None
    vitals_spo2: Optional[int] = None
    vitals_bp: Optional[str] = None

    @field_validator("symptoms")
    @classmethod
    def validate_symptoms(cls, symptoms: List[str]) -> List[str]:
        canonical_names = {symptom.casefold(): symptom for symptom in SYMPTOMS}
        aliases = {"difficulty breathing": "Difficulty Breathing", "severe weakness": "Severe Weakness"}
        normalized = []
        for symptom in symptoms:
            canonical = canonical_names.get(symptom.strip().casefold()) or aliases.get(symptom.strip().casefold())
            if not canonical:
                raise ValueError(f"Invalid symptom name: {symptom}")
            normalized.append(canonical)
        return normalized

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, duration: Optional[str]) -> Optional[str]:
        if duration is not None and not duration.strip():
            raise ValueError("Duration must not be empty")
        return duration


class TopPrediction(BaseModel):
    condition: str
    confidence: float


class TreatmentPathResponse(BaseModel):
    condition: str
    confidence: float
    recommended_path: List[str]
    note: str
    risk_score: str
    top_predictions: List[TopPrediction]
    explanation: str
    severity_label: str
    emergency_warning: bool
    visual_path: List[str]
    health_summary: str
    doctor_recommendation: str
    specialty: str
    medication_guidance: List[str]
    symptom_comparison: List[str]
    doctors: List[Dict[str, Any]] = []
    hospitals: List[Dict[str, Any]] = []
    feature_importance: List[Dict[str, Any]] = []
    decision_path: List[str] = []
    self_care: List[str] = []
    precautions: List[str] = []
    see_a_doctor_if: List[str] = []
    risk_alert: bool = False
    disclaimer: str = "This educational system does not provide a medical diagnosis."
    case_id: str = ""


class PredictionHistoryItem(BaseModel):
    id: int
    created_at: str
    symptoms: List[str]
    severity: str
    language: str
    top_conditions: List[str]
    confidences: List[float]
    risk_score: str
    condition: str
    explanation: str
    recommended_path: List[str]
    emergency_warning: bool


class MlInsightsResponse(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: List[List[int]]
    feature_importance: dict
    labels: List[str]
    decision_tree: Dict[str, Any]
    popular_symptoms: List[str]
    top_conditions: List[Dict[str, Any]]


class SymptomLibraryItem(BaseModel):
    name: str
    description: str
    severity: str
    common_conditions: List[str]


class UserProfile(BaseModel):
    username: str
    password: Optional[str] = None
    role: str = "Patient"
    full_name: Optional[str] = None
    age: Optional[int] = None
    chronic_conditions: List[str] = []
    preferred_language: str = "en"
    gender: Optional[str] = None
    vitals_heart_rate: Optional[int] = None
    vitals_bp: Optional[str] = None
    vitals_spo2: Optional[int] = None
    vitals_temp: Optional[float] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None


class ReminderRequest(BaseModel):
    username: str
    title: str
    due_date: str


class PhoneFeedback(BaseModel):
    username: str
    rating: int
    comments: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    total_assessments: int
    top_conditions: List[Dict[str, Any]]
    average_feedback_rating: float
    total_feedback: int
    total_doctors: int
    total_hospitals: int


@app.on_event("startup")
def startup_event():
    initialize_db()
    load_model()


@app.post("/api/treatment-path", response_model=TreatmentPathResponse)
@app.post("/predict", response_model=TreatmentPathResponse)
async def get_treatment_path(request: SymptomRequest):
    prediction = predict_treatment(
        symptoms=request.symptoms,
        severity=request.severity,
        language=request.language,
        vitals_heart_rate=request.vitals_heart_rate,
        vitals_spo2=request.vitals_spo2,
        age=request.age,
        gender=request.gender,
        duration=request.duration,
        vitals_temp=request.vitals_temp,
        vitals_bp=request.vitals_bp
    )
    prediction["health_summary"] = get_personalized_summary(request.symptoms, request.severity)
    prediction["doctor_recommendation"] = get_doctor_recommendation(prediction["condition"], prediction["risk_score"], "Bengaluru")
    prediction["symptom_comparison"] = [
        f"{symptom}: {'present' if symptom in request.symptoms else 'absent'}"
        for symptom in ["Fever", "Cough", "Chest pain", "Shortness of breath", "Headache"]
    ]
    prediction["doctors"] = get_doctor_recommendations(prediction["condition"], "Bengaluru")
    prediction["hospitals"] = get_hospital_recommendations("Bengaluru", prediction["specialty"])
    prediction["risk_alert"] = prediction["emergency_warning"]

    import uuid
    case_id = f"CASE-{str(uuid.uuid4())[:8].upper()}"
    prediction["case_id"] = case_id
    
    # Store in runtime cache for PDF generation
    if not hasattr(app, "case_cache"):
        app.case_cache = {}
    app.case_cache[case_id] = prediction

    save_prediction(
        {
            "created_at": datetime.utcnow().isoformat() + "Z",
            "symptoms": request.symptoms,
            "severity": prediction["severity_label"],
            "language": request.language,
            "top_predictions": prediction["top_predictions"],
            "risk_score": prediction["risk_score"],
            "condition": prediction["condition"],
            "explanation": prediction["explanation"],
            "recommended_path": prediction["recommended_path"],
            "emergency_warning": prediction["emergency_warning"],
        }
    )
    return prediction


@app.get("/model-info")
def model_info():
    return {"success": True, "data": get_ml_insights()}



@app.get("/api/prediction-history", response_model=List[PredictionHistoryItem])
async def prediction_history():
    return get_prediction_history()

@app.get("/api/report/{case_id}.pdf")
async def download_report(case_id: str):
    if not hasattr(app, "case_cache") or case_id not in app.case_cache:
        raise HTTPException(status_code=404, detail="Case not found or expired")
    
    prediction = app.case_cache[case_id]
    
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generator not installed")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "TreatmentPath Advisor Assessment Report")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, 730, f"Case ID: {case_id}")
    c.drawString(50, 715, f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 680, "Assessment Result")
    c.setFont("Helvetica", 12)
    c.drawString(50, 660, f"Condition: {prediction.get('condition', 'Unknown')}")
    c.drawString(50, 645, f"Risk Score: {prediction.get('risk_score', 'Unknown')}")
    c.drawString(50, 630, f"Severity: {prediction.get('severity_label', 'Moderate')}")
    c.drawString(50, 615, f"Confidence: {prediction.get('confidence', 'N/A')}%")
    
    y = 585
    patient = prediction.get('patient_details', {})
    if patient.get('age') or patient.get('gender') or patient.get('vitals_heart_rate'):
        c.setFont("Helvetica-Bold", 12)
        c.drawString(300, 680, "Patient Information & Vitals")
        c.setFont("Helvetica", 11)
        py = 660
        if patient.get('age'): c.drawString(300, py, f"Age: {patient.get('age')}"); py -= 15
        if patient.get('gender'): c.drawString(300, py, f"Gender: {patient.get('gender')}"); py -= 15
        if patient.get('duration'): c.drawString(300, py, f"Duration: {patient.get('duration')}"); py -= 15
        if patient.get('vitals_heart_rate'): c.drawString(300, py, f"Heart Rate: {patient.get('vitals_heart_rate')} bpm"); py -= 15
        if patient.get('vitals_spo2'): c.drawString(300, py, f"SpO2: {patient.get('vitals_spo2')}%"); py -= 15
        if patient.get('vitals_temp'): c.drawString(300, py, f"Temp: {patient.get('vitals_temp')} F"); py -= 15
        if patient.get('vitals_bp'): c.drawString(300, py, f"BP: {patient.get('vitals_bp')}"); py -= 15
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Feature Importance (XAI)")
    y -= 20
    c.setFont("Helvetica", 11)
    features = prediction.get('feature_importance', [])
    for f in features:
        if y < 150:
            c.showPage()
            y = 750
        c.drawString(60, y, f"- {f['symptom']}: {int(f['importance'] * 100)}%")
        y -= 15
        
    y -= 20
    if y < 150:
        c.showPage()
        y = 750
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Recommended Path")
    y -= 20
    c.setFont("Helvetica", 11)
    for path in prediction.get('recommended_path', []):
        if y < 150:
            c.showPage()
            y = 750
        c.drawString(60, y, f"- {path}")
        y -= 15
        
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, 50, "This report is generated by an educational decision-support demonstration")
    c.drawString(50, 40, "and is not a medical diagnosis or a substitute for professional medical advice.")
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=TreatmentPath_Advisor_Report_{case_id}.pdf"}
    )



@app.get("/api/ml-insights", response_model=MlInsightsResponse)
async def ml_insights():
    metrics = get_ml_insights()
    metrics["decision_tree"] = get_decision_tree_structure()
    metrics["popular_symptoms"] = ["Fever", "Cough", "Chest pain", "Fatigue", "Headache"]
    metrics["top_conditions"] = [{"condition": label, "count": 0} for label in metrics["labels"]]
    return metrics


@app.get("/api/symptom-library", response_model=List[SymptomLibraryItem])
async def symptom_library():
    return get_symptom_library()


@app.get("/api/doctors")
async def doctors(specialty: str = "", location: str = "Bengaluru", lat: float = None, lng: float = None):
    if specialty:
        return get_doctor_recommendations(specialty, location, lat, lng)
    return get_doctor_recommendations("General medical evaluation", location, lat, lng)


@app.get("/api/hospitals")
async def hospitals(location: str = "Bengaluru", specialty: str = "", lat: float = None, lng: float = None):
    return get_hospital_recommendations(location, specialty or None, lat, lng)


@app.get("/api/conditions")
async def conditions():
    return get_condition_catalog()


@app.get("/api/translations")
async def translations(language: str | None = None):
    return get_translation_catalog(language)


@app.post("/api/profile", response_model=UserProfile)
async def update_profile(profile: UserProfile, principal: dict = Depends(get_principal)):
    if principal["username"] != profile.username and principal["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Cannot modify another user's profile")
    existing = load_profile(profile.username)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    data = profile.model_dump()
    if principal["role"] != "Admin":
        data["role"] = existing["role"]
    data["password_hash"] = _hash_password(profile.password) if profile.password else existing["password_hash"]
    save_profile(data)
    profile.password = None
    profile.role = data["role"]
    return profile


@app.get("/api/profile/{username}", response_model=UserProfile)
async def get_profile(username: str, principal: dict = Depends(get_principal)):
    if principal["username"] != username and principal["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Cannot access another user's profile")
    profile = load_profile(username)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

class AuthRegistration(UserProfile):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("username", mode="before")
    @classmethod
    def strip_username(cls, value):
        return value.strip() if isinstance(value, str) else value


class AuthLogin(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)

@app.post("/api/auth/login")
async def login(req: AuthLogin):
    profile = load_profile(req.username)
    stored_password = profile.get("password_hash", "") if profile else ""
    if not profile or not _verify_password(stored_password, req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not stored_password.startswith("pbkdf2_sha256$"):
        profile["password_hash"] = _hash_password(req.password)
        save_profile(profile)
    return {
        "success": True,
        "message": "Login successful",
        "token": _issue_access_token(profile["username"], profile.get("role", "Patient")),
        "expires_in": 28800,
        "role": profile.get("role", "Patient"),
        "username": profile["username"],
    }

@app.post("/api/auth/register")
async def register(profile: AuthRegistration):
    if profile.role != "Patient":
        raise HTTPException(status_code=403, detail="Doctor and admin accounts must be provisioned by an administrator")
    if not profile.password:
        raise HTTPException(status_code=422, detail="Password is required")
    if load_profile(profile.username):
        raise HTTPException(status_code=409, detail="Username already exists")
    data = profile.model_dump()
    data["role"] = "Patient"
    data["password_hash"] = _hash_password(profile.password)
    save_profile(data)
    return {"success": True, "message": "Registration successful"}

class EmergencyVitals(BaseModel):
    heart_rate: Optional[int] = Field(default=None, ge=0, le=300)
    spo2: Optional[int] = Field(default=None, ge=0, le=100)
    temperature: Optional[float] = Field(default=None, ge=50, le=115)
    blood_pressure: Optional[str] = Field(default=None, max_length=20)


class EmergencyRequest(BaseModel):
    patient_age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = Field(default=None, max_length=40)
    symptoms: List[str] = Field(default_factory=list, max_length=50)
    risk_level: Literal["Low", "Medium", "High", "Critical", "Unknown"] = "Unknown"
    severity: Optional[Literal["Mild", "Moderate", "Severe"]] = None
    duration: Optional[str] = Field(default=None, max_length=80)
    vitals: EmergencyVitals = Field(default_factory=EmergencyVitals)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0, le=100000)


class LocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=100000)


class DoctorAccept(BaseModel):
    emergency_id: str = Field(min_length=1, max_length=80)


class DoctorHeartbeat(BaseModel):
    status: str = Field(pattern="^(AVAILABLE|BUSY|OFFLINE)$")
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class ChatMessage(BaseModel):
    emergency_id: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=2000)


def _get_emergency_for_principal(emergency_id: str, principal: dict):
    from .database import get_connection

    connection = get_connection()
    _expire_emergency_locations(connection)
    connection.commit()
    row = connection.execute(
        "SELECT * FROM emergency_requests WHERE emergency_id = ?", (emergency_id,)
    ).fetchone()
    connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if not _can_access_emergency(principal, row):
        raise HTTPException(status_code=403, detail="Not authorized for this emergency request")
    return row


@app.get("/api/hospitals/nearby")
def nearby_hospitals(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: int = Query(default=10, ge=5, le=25),
    principal: dict = Depends(get_principal),
):
    require_role(principal, "Patient", "Doctor", "Admin")
    if radius_km not in (5, 10, 25):
        raise HTTPException(status_code=422, detail="Radius must be 5, 10, or 25 km")
    hospitals_result = _fetch_osm_hospitals(lat, lng, radius_km)
    return {"source": "OpenStreetMap", "hospitals": hospitals_result}


@app.get("/api/doctors/nearby")
def nearby_doctors(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: int = Query(default=10, ge=5, le=25),
    principal: dict = Depends(get_principal),
):
    require_role(principal, "Patient", "Doctor", "Admin")
    if radius_km not in (5, 10, 25):
        raise HTTPException(status_code=422, detail="Radius must be 5, 10, or 25 km")

    from .database import get_connection

    cutoff = (datetime.utcnow() - timedelta(seconds=DOCTOR_HEARTBEAT_TIMEOUT_SECONDS)).isoformat() + "Z"
    connection = get_connection()
    connection.execute(
        "UPDATE doctors SET availability_status = 'OFFLINE', lat = NULL, lng = NULL "
        "WHERE username IS NOT NULL AND (last_seen IS NULL OR last_seen < ?)",
        (cutoff,),
    )
    rows = connection.execute(
        "SELECT username, name, specialty, lat, lng, availability_status, last_seen "
        "FROM doctors WHERE username IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL"
    ).fetchall()
    connection.commit()
    connection.close()

    result = []
    for row in rows:
        distance = _haversine_km(lat, lng, row["lat"], row["lng"])
        if distance <= radius_km:
            result.append(
                {
                    "name": row["name"],
                    "specialization": row["specialty"],
                    "distance_km": round(distance, 1),
                    "status": row["availability_status"],
                    "last_seen": row["last_seen"],
                    "availability_source": "demo account heartbeat",
                    "phone": None,
                    "eta": None,
                }
            )
    return sorted(result, key=lambda doctor: doctor["distance_km"])


@app.post("/api/doctors/heartbeat")
def update_doctor_heartbeat(
    heartbeat: DoctorHeartbeat, principal: dict = Depends(get_principal)
):
    require_role(principal, "Doctor")
    if (heartbeat.lat is None) != (heartbeat.lng is None):
        raise HTTPException(status_code=422, detail="Both coordinates must be provided together")

    from .database import get_connection

    profile = load_profile(principal["username"])
    if not profile:
        raise HTTPException(status_code=401, detail="Doctor account no longer exists")
    last_seen = datetime.utcnow().isoformat() + "Z" if heartbeat.status != "OFFLINE" else None
    name = profile.get("full_name") or f"Dr. {principal['username']}"
    connection = get_connection()
    existing = connection.execute(
        "SELECT id FROM doctors WHERE username = ?", (principal["username"],)
    ).fetchone()
    values = (
        name,
        heartbeat.lat,
        heartbeat.lng,
        "Doctor-shared location" if heartbeat.lat is not None else "Location not shared",
        heartbeat.status,
        last_seen,
    )
    if existing:
        connection.execute(
            "UPDATE doctors SET name = ?, lat = ?, lng = ?, "
            "location = ?, availability_status = ?, last_seen = ? WHERE id = ?",
            (*values, existing["id"]),
        )
    else:
        connection.execute(
            "INSERT INTO doctors (name, specialty, location, lat, lng, username, availability_status, last_seen) "
            "VALUES (?, 'Emergency Medicine', ?, ?, ?, ?, ?, ?)",
            (name, values[3], heartbeat.lat, heartbeat.lng, principal["username"], heartbeat.status, last_seen),
        )
    connection.commit()
    connection.close()
    return {"status": heartbeat.status, "last_seen": last_seen}


@app.post("/api/emergency/request")
def create_emergency_request(
    req: EmergencyRequest, principal: dict = Depends(get_principal)
):
    require_role(principal, "Patient")
    import uuid
    from .database import get_connection

    if (req.lat is None) != (req.lng is None):
        raise HTTPException(status_code=422, detail="Both coordinates must be provided together")
    vitals = req.vitals.model_dump(exclude_none=True)
    emergency_id = f"ER-{str(uuid.uuid4())[:8].upper()}"
    now = datetime.utcnow().isoformat() + "Z"
    vital_signs = ", ".join(f"{key}: {value}" for key, value in vitals.items()) or "Not provided"
    connection = get_connection()
    connection.execute(
        """INSERT INTO emergency_requests (
            emergency_id, patient_username, patient_age, symptoms, vital_signs,
            risk_level, medical_info, allergies, lat, lng, accuracy, gender, severity,
            duration, vitals_json, request_time, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SEARCHING')""",
        (
            emergency_id,
            principal["username"],
            req.patient_age,
            json.dumps(req.symptoms),
            vital_signs,
            req.risk_level,
            req.lat,
            req.lng,
            req.accuracy,
            req.gender,
            req.severity,
            req.duration,
            json.dumps(vitals),
            now,
            now,
        ),
    )
    connection.commit()
    connection.close()
    return {"emergency_id": emergency_id, "status": "SEARCHING", "created_at": now}


@app.get("/api/emergency/requests")
def get_emergency_requests(principal: dict = Depends(get_principal)):
    from .database import get_connection

    connection = get_connection()
    _expire_emergency_locations(connection)
    connection.commit()
    if principal["role"] == "Admin":
        rows = connection.execute(
            "SELECT * FROM emergency_requests ORDER BY id DESC"
        ).fetchall()
    elif principal["role"] == "Doctor":
        rows = connection.execute(
            "SELECT * FROM emergency_requests WHERE status NOT IN ('CANCELLED', 'RESOLVED') "
            "AND (status IN ('SEARCHING', 'Pending') OR accepted_by = ?) ORDER BY id DESC",
            (principal["username"],),
        ).fetchall()
    elif principal["role"] == "Patient":
        rows = connection.execute(
            "SELECT * FROM emergency_requests WHERE patient_username = ? ORDER BY id DESC",
            (principal["username"],),
        ).fetchall()
    else:
        connection.close()
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    connection.close()
    return [_emergency_row_to_dict(row) for row in rows]


@app.get("/api/emergency/{emergency_id}")
def get_emergency_request(emergency_id: str, principal: dict = Depends(get_principal)):
    return _emergency_row_to_dict(_get_emergency_for_principal(emergency_id, principal))


@app.post("/api/doctor/request/accept")
def accept_emergency(
    req: DoctorAccept, principal: dict = Depends(get_principal)
):
    require_role(principal, "Doctor")
    from .database import get_connection

    connection = get_connection()
    cursor = connection.execute(
        "UPDATE emergency_requests SET status = 'DOCTOR_ASSIGNED', accepted_by = ?, updated_at = ? "
        "WHERE emergency_id = ? AND status IN ('SEARCHING', 'Pending')",
        (principal["username"], datetime.utcnow().isoformat() + "Z", req.emergency_id),
    )
    if cursor.rowcount > 0:
        connection.execute(
            "UPDATE doctors SET availability_status = 'BUSY', last_seen = ? WHERE username = ?",
            (datetime.utcnow().isoformat() + "Z", principal["username"]),
        )
    connection.commit()
    connection.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=409, detail="Request is no longer available")
    return {"status": "DOCTOR_ASSIGNED", "accepted_by": principal["username"]}


@app.put("/api/emergency/{emergency_id}/location")
def update_emergency_location(
    emergency_id: str,
    location: LocationUpdate,
    principal: dict = Depends(get_principal),
):
    require_role(principal, "Patient")
    row = _get_emergency_for_principal(emergency_id, principal)
    if row["status"] in ("CANCELLED", "RESOLVED"):
        raise HTTPException(status_code=409, detail="Emergency request is no longer active")
    from .database import get_connection

    connection = get_connection()
    connection.execute(
        "UPDATE emergency_requests SET lat = ?, lng = ?, accuracy = ?, updated_at = ? WHERE emergency_id = ?",
        (location.lat, location.lng, location.accuracy, datetime.utcnow().isoformat() + "Z", emergency_id),
    )
    connection.commit()
    connection.close()
    return {"status": "Location updated"}


@app.delete("/api/emergency/{emergency_id}/location")
def stop_emergency_location(emergency_id: str, principal: dict = Depends(get_principal)):
    require_role(principal, "Patient")
    _get_emergency_for_principal(emergency_id, principal)
    from .database import get_connection

    connection = get_connection()
    connection.execute(
        "UPDATE emergency_requests SET lat = NULL, lng = NULL, accuracy = NULL, updated_at = ? WHERE emergency_id = ?",
        (datetime.utcnow().isoformat() + "Z", emergency_id),
    )
    connection.commit()
    connection.close()
    return {"status": "Location sharing stopped"}


@app.post("/api/emergency/{emergency_id}/cancel")
def cancel_emergency_request(emergency_id: str, principal: dict = Depends(get_principal)):
    require_role(principal, "Patient")
    row = _get_emergency_for_principal(emergency_id, principal)
    if row["status"] in ("CANCELLED", "RESOLVED"):
        raise HTTPException(status_code=409, detail="Emergency request is already closed")
    from .database import get_connection

    connection = get_connection()
    connection.execute(
        "UPDATE emergency_requests SET status = 'CANCELLED', lat = NULL, lng = NULL, accuracy = NULL, updated_at = ? WHERE emergency_id = ?",
        (datetime.utcnow().isoformat() + "Z", emergency_id),
    )
    connection.commit()
    connection.close()
    return {"status": "CANCELLED"}


@app.post("/api/emergency/{emergency_id}/resolve")
def resolve_emergency_request(emergency_id: str, principal: dict = Depends(get_principal)):
    require_role(principal, "Doctor", "Admin")
    row = _get_emergency_for_principal(emergency_id, principal)
    if row["status"] in ("CANCELLED", "RESOLVED"):
        raise HTTPException(status_code=409, detail="Emergency request is already closed")
    from .database import get_connection

    connection = get_connection()
    connection.execute(
        "UPDATE emergency_requests SET status = 'RESOLVED', lat = NULL, lng = NULL, accuracy = NULL, updated_at = ? WHERE emergency_id = ?",
        (datetime.utcnow().isoformat() + "Z", emergency_id),
    )
    connection.commit()
    connection.close()
    return {"status": "RESOLVED"}


@app.post("/api/emergency/chat")
def post_chat_message(req: ChatMessage, principal: dict = Depends(get_principal)):
    _get_emergency_for_principal(req.emergency_id, principal)
    from .database import get_connection

    connection = get_connection()
    connection.execute(
        "INSERT INTO emergency_chats (emergency_id, sender_username, message, timestamp) VALUES (?, ?, ?, ?)",
        (req.emergency_id, principal["username"], req.message.strip(), datetime.utcnow().isoformat() + "Z"),
    )
    connection.commit()
    connection.close()
    return {"status": "Message sent"}


@app.get("/api/emergency/chat/{emergency_id}")
def get_chat_messages(emergency_id: str, principal: dict = Depends(get_principal)):
    _get_emergency_for_principal(emergency_id, principal)
    from .database import get_connection

    connection = get_connection()
    rows = connection.execute(
        "SELECT * FROM emergency_chats WHERE emergency_id = ? ORDER BY id ASC",
        (emergency_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.post("/api/reminder")
async def add_reminder(request: ReminderRequest):
    save_reminder(request.username, request.title, request.due_date)
    return {"message": "Reminder added"}


@app.get("/api/reminders/{username}")
async def get_reminders(username: str):
    return fetch_reminders(username)


@app.post("/api/feedback")
async def submit_feedback(feedback: PhoneFeedback):
    save_feedback(feedback.rating, feedback.comments or "", feedback.username)
    return {"status": "ok"}


@app.get("/api/admin-stats", response_model=AdminStatsResponse)
async def admin_stats():
    return fetch_admin_stats()


# --- Notification APIs ---

@app.get("/api/notifications/{username}")
async def get_notifications(username: str):
    from .database import get_connection
    conn = get_connection()
    rows = conn.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC", (username,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.patch("/api/notifications/{id}/read")
async def mark_notification_read(id: int):
    from .database import get_connection
    conn = get_connection()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.patch("/api/notifications/read-all/{username}")
async def mark_all_read(username: str):
    from .database import get_connection
    conn = get_connection()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (username,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/notifications/{id}")
async def delete_notification(id: int):
    from .database import get_connection
    conn = get_connection()
    conn.execute("DELETE FROM notifications WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# --- Document Vault APIs ---

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/documents/upload")
async def upload_document(
    username: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...)
):
    from .database import get_connection
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.pdf', '.jpg', '.jpeg', '.png']:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and images are supported.")
        
    safe_filename = f"{username}_{datetime.utcnow().timestamp()}{file_ext}"
    file_path = UPLOAD_DIR / safe_filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size_kb = round(os.path.getsize(file_path) / 1024)
    file_size_str = f"{file_size_kb} KB" if file_size_kb < 1024 else f"{round(file_size_kb/1024, 2)} MB"
    
    conn = get_connection()
    conn.execute(
        "INSERT INTO documents (user_id, category, filename, file_path, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (username, category, file.filename, str(file_path), file_size_str, datetime.utcnow().isoformat() + "Z")
    )
    conn.commit()
    
    # Also create a notification
    conn.execute(
        "INSERT INTO notifications (user_id, type, title_en, title_ta, message_en, message_ta, target_route, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (username, "document", "Document Uploaded", "ஆவணம் பதிவேற்றப்பட்டது", f"{file.filename} uploaded successfully.", f"{file.filename} வெற்றிகரமாக பதிவேற்றப்பட்டது.", "/patient/documents", datetime.utcnow().isoformat() + "Z")
    )
    conn.commit()
    conn.close()
    
    return {"status": "ok", "filename": file.filename}

@app.get("/api/documents/{username}")
async def get_documents(username: str):
    from .database import get_connection
    conn = get_connection()
    rows = conn.execute("SELECT id, category, filename, file_size, created_at FROM documents WHERE user_id = ? ORDER BY id DESC", (username,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.delete("/api/documents/{id}")
async def delete_document(id: int):
    from .database import get_connection
    conn = get_connection()
    doc = conn.execute("SELECT file_path FROM documents WHERE id = ?", (id,)).fetchone()
    if doc and os.path.exists(doc["file_path"]):
        os.remove(doc["file_path"])
    conn.execute("DELETE FROM documents WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


def _frontend_response(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    index_file = FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build not found. Run npm run build in frontend.")
    requested_file = (FRONTEND_DIST / path).resolve() if path else index_file
    if FRONTEND_DIST.resolve() not in requested_file.parents and requested_file != index_file.resolve():
        raise HTTPException(status_code=404, detail="Not found")
    if requested_file.is_file():
        return FileResponse(requested_file)
    return FileResponse(index_file)


@app.get("/", include_in_schema=False)
async def frontend_index():
    return _frontend_response("")


@app.get("/{path:path}", include_in_schema=False)
async def frontend_routes(path: str):
    return _frontend_response(path)
