import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "app.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            symptoms TEXT NOT NULL,
            severity TEXT NOT NULL,
            language TEXT NOT NULL,
            top_conditions TEXT NOT NULL,
            confidences TEXT NOT NULL,
            risk_score TEXT NOT NULL,
            condition TEXT NOT NULL,
            explanation TEXT NOT NULL,
            treatment_path TEXT NOT NULL,
            emergency_warning INTEGER NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT,
            role TEXT DEFAULT 'Patient',
            full_name TEXT,
            age INTEGER,
            chronic_conditions TEXT,
            preferred_language TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            gender TEXT,
            vitals_heart_rate INTEGER,
            vitals_bp TEXT,
            vitals_spo2 INTEGER,
            vitals_temp REAL,
            allergies TEXT,
            current_medications TEXT,
            FOREIGN KEY(username) REFERENCES users(username)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emergency_id TEXT NOT NULL UNIQUE,
            patient_username TEXT,
            patient_age INTEGER,
            symptoms TEXT,
            vital_signs TEXT,
            risk_level TEXT,
            medical_info TEXT,
            allergies TEXT,
            lat REAL,
            lng REAL,
            request_time TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            accepted_by TEXT
        )
        """
    )
    _ensure_columns(
        connection,
        "emergency_requests",
        {
            "accuracy": "REAL",
            "gender": "TEXT",
            "severity": "TEXT",
            "duration": "TEXT",
            "vitals_json": "TEXT NOT NULL DEFAULT '{}'",
            "updated_at": "TEXT",
        },
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emergency_id TEXT NOT NULL,
            sender_username TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            username TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comments TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            due_date TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            location TEXT NOT NULL,
            lat REAL,
            lng REAL,
            phone TEXT,
            rating REAL DEFAULT 4.8,
            verified INTEGER NOT NULL DEFAULT 1,
            availability TEXT DEFAULT 'Available this week'
        )
        """
    )
    _ensure_columns(
        connection,
        "doctors",
        {
            "username": "TEXT",
            "availability_status": "TEXT NOT NULL DEFAULT 'OFFLINE'",
            "last_seen": "TEXT",
            "hospital_id": "INTEGER",
        },
    )
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS doctors_username_unique "
        "ON doctors(username) WHERE username IS NOT NULL"
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS hospitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            lat REAL,
            lng REAL,
            specialty TEXT NOT NULL,
            phone TEXT,
            beds INTEGER DEFAULT 0,
            emergency INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS condition_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            condition TEXT NOT NULL,
            specialty TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            summary TEXT NOT NULL,
            key_symptoms TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            key_name TEXT NOT NULL,
            value TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title_en TEXT NOT NULL,
            title_ta TEXT NOT NULL,
            message_en TEXT NOT NULL,
            message_ta TEXT NOT NULL,
            target_route TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            category TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.commit()
    location_expiry = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
    connection.execute(
        "UPDATE emergency_requests SET lat = NULL, lng = NULL, accuracy = NULL "
        "WHERE request_time < ? OR status IN ('CANCELLED', 'RESOLVED')",
        (location_expiry,),
    )
    connection.execute(
        "UPDATE emergency_requests SET status = 'SEARCHING' WHERE status = 'Pending'"
    )
    connection.execute(
        "UPDATE emergency_requests SET status = 'DOCTOR_ASSIGNED' WHERE status = 'Accepted'"
    )
    connection.commit()
    seed_reference_data(connection)
    connection.close()


def _ensure_columns(connection, table_name: str, columns: dict[str, str]):
    existing = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    for name, definition in columns.items():
        if name not in existing:
            connection.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {name} {definition}"
            )


def seed_reference_data(connection):
    if connection.execute("SELECT COUNT(*) FROM translations").fetchone()[0] == 0:
        language_entries = {
            "en": {"title": "TreatmentPath Advisor", "subtitle": "AI-assisted healthcare guidance for symptoms and treatment pathways.", "alert": "This is educational AI support, not a diagnosis or prescription.", "doctor_label": "Doctor recommendation", "hospital_label": "Hospital & clinic information"},
            "ta": {"title": "மருத்துவ பாதை ஆலோசகர்", "subtitle": "அறிகுறிகள் மற்றும் சிகிச்சை பாதைகளுக்கான AI உதவி.", "alert": "இது கல்வி நோக்கிலான AI உதவி மட்டுமே; நோயறிதல் அல்லது மருந்து பரிந்துரை அல்ல.", "doctor_label": "மருத்துவர் பரிந்துரை", "hospital_label": "மருத்துவமனை தகவல்"},
            "hi": {"title": "ट्रीटमेंटपाथ एडवाइजर", "subtitle": "लक्षणों और उपचार मार्गों के लिए AI सहायक स्वास्थ्य मार्गदर्शन।", "alert": "यह शैक्षिक AI सहायता है, निदान या prescription नहीं है।", "doctor_label": "डॉक्टर सिफारिश", "hospital_label": "हॉस्पिटल जानकारी"},
            "te": {"title": "ట్రీట్‌మెంట్‌పాత్ అడ్వైజర్", "subtitle": "లక్షణాలు మరియు చికిత్స మార్గాల కోసం AI సహాయక ఆరోగ్య మార్గదర్శకత్వం।", "alert": "ఇది విద్యా ప్రయోజనాల కోసిన AI సహాయం; రోగనిర్ధారణ లేదా 처 prescription కాదు.", "doctor_label": "డాక్టర్ సిఫారిష్", "hospital_label": "హాస్పిటల్ సమాచారం"},
            "ml": {"title": "ട്രീറ്റ്മെന്റ് പാത്ത് അഡ്വൈസർ", "subtitle": "രോഗലക്ഷണങ്ങൾക്കും ചികിത്സാ പാതകൾക്കുമായി AI-ആംശമായ ആരോഗ്യ മാർഗ്ഗനിർദേശങ്ങൾ.", "alert": "ഇത് വിദ്യാഭ്യാസ ആവശ്യങ്ങൾക്കുള്ള AI പിന്തുണ മാത്രമാണ്; ഡയഗ്നോഡിക്സോ 처방യോ അല്ല.", "doctor_label": "ഡോക്ടർ ശുപാർശ", "hospital_label": "ഹോस्पിറ്റൽ വിവരങ്ങൾ"},
            "kn": {"title": "ಟ್ರೀಟ್‌ಮೆಂಟ್ ಪಾತ್ ಅಡ್ವೈಸರ್", "subtitle": "ರೋಗಲಕ್ಷಣಗಳು ಮತ್ತು ಚಿಕಿತ್ಸೆ ಮಾರ್ಗಗಳಿಗೆ AI ಸಹಾಯದ ಆರೋಗ್ಯ ಮಾರ್ಗದರ್ಶನ।", "alert": "ಇದು ಶೈಕ್ಷಣಿಕ AI ಸಹಾಯ ಮಾತ್ರ; ರೋಗನಿರ್ಣಯ ಅಥವಾ ಔಷಧಿ ನೀಡುವಿಕೆ ಅಲ್ಲ.", "doctor_label": "ವೈದ್ಯರ ಶಿಫಾರಸು", "hospital_label": "ಆಸ್ಪತ್ರೆ ಮಾಹಿತಿ"},
        }
        rows = []
        for language, values in language_entries.items():
            for key, value in values.items():
                rows.append((language, key, value))
        connection.executemany(
            "INSERT INTO translations (language, key_name, value) VALUES (?, ?, ?)",
            rows,
        )

    connection.commit()


def save_prediction(record: dict):
    connection = get_connection()
    connection.execute(
        """
        INSERT INTO predictions (
            created_at,
            symptoms,
            severity,
            language,
            top_conditions,
            confidences,
            risk_score,
            condition,
            explanation,
            treatment_path,
            emergency_warning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record["created_at"],
            json.dumps(record["symptoms"]),
            record["severity"],
            record["language"],
            json.dumps([prediction["condition"] for prediction in record["top_predictions"]]),
            json.dumps([prediction["confidence"] for prediction in record["top_predictions"]]),
            record["risk_score"],
            record["condition"],
            record["explanation"],
            json.dumps(record["recommended_path"]),
            1 if record["emergency_warning"] else 0,
        ),
    )
    connection.commit()
    connection.close()


def save_profile(profile: dict):
    connection = get_connection()
    # Save user basic info
    connection.execute(
        """
        INSERT INTO users (username, password_hash, role, full_name, age, chronic_conditions, preferred_language)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            password_hash=COALESCE(excluded.password_hash, users.password_hash),
            role=COALESCE(excluded.role, users.role),
            full_name=excluded.full_name,
            age=excluded.age,
            chronic_conditions=excluded.chronic_conditions,
            preferred_language=excluded.preferred_language
        """,
        (
            profile["username"],
            profile.get("password_hash", ""),
            profile.get("role", "Patient"),
            profile.get("full_name"),
            profile.get("age"),
            json.dumps(profile.get("chronic_conditions", [])),
            profile.get("preferred_language", "en"),
        ),
    )
    
    # Save patient specific info if they are a patient
    if profile.get("role", "Patient") == "Patient":
        connection.execute(
            """
            INSERT INTO patients (username, gender, vitals_heart_rate, vitals_bp, vitals_spo2, vitals_temp, allergies, current_medications)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                gender=excluded.gender,
                vitals_heart_rate=excluded.vitals_heart_rate,
                vitals_bp=excluded.vitals_bp,
                vitals_spo2=excluded.vitals_spo2,
                vitals_temp=excluded.vitals_temp,
                allergies=excluded.allergies,
                current_medications=excluded.current_medications
            """,
            (
                profile["username"],
                profile.get("gender"),
                profile.get("vitals_heart_rate"),
                profile.get("vitals_bp"),
                profile.get("vitals_spo2"),
                profile.get("vitals_temp"),
                profile.get("allergies"),
                profile.get("current_medications"),
            ),
        )

    connection.commit()
    connection.close()


def load_profile(username: str):
    connection = get_connection()
    cursor = connection.execute(
        """
        SELECT u.username, u.password_hash, u.role, u.full_name, u.age, u.chronic_conditions, u.preferred_language,
               p.gender, p.vitals_heart_rate, p.vitals_bp, p.vitals_spo2, p.vitals_temp, p.allergies, p.current_medications
        FROM users u
        LEFT JOIN patients p ON u.username = p.username
        WHERE u.username = ?
        """,
        (username,),
    )
    row = cursor.fetchone()
    connection.close()
    if not row:
        return None
    return {
        "username": row["username"],
        "password_hash": row["password_hash"],
        "role": row["role"],
        "full_name": row["full_name"],
        "age": row["age"],
        "chronic_conditions": json.loads(row["chronic_conditions"] or "[]"),
        "preferred_language": row["preferred_language"],
        "gender": row["gender"] if "gender" in row.keys() else None,
        "vitals_heart_rate": row["vitals_heart_rate"] if "vitals_heart_rate" in row.keys() else None,
        "vitals_bp": row["vitals_bp"] if "vitals_bp" in row.keys() else None,
        "vitals_spo2": row["vitals_spo2"] if "vitals_spo2" in row.keys() else None,
        "vitals_temp": row["vitals_temp"] if "vitals_temp" in row.keys() else None,
        "allergies": row["allergies"] if "allergies" in row.keys() else None,
        "current_medications": row["current_medications"] if "current_medications" in row.keys() else None,
    }


def save_feedback(rating: int, comments: str, username: str):
    connection = get_connection()
    connection.execute(
        "INSERT INTO feedback (created_at, username, rating, comments) VALUES (?, ?, ?, ?)",
        (datetime.utcnow().isoformat() + "Z", username, rating, comments),
    )
    connection.commit()
    connection.close()


def save_reminder(username: str, title: str, due_date: str):
    connection = get_connection()
    connection.execute(
        "INSERT INTO reminders (username, title, due_date, completed) VALUES (?, ?, ?, 0)",
        (username, title, due_date),
    )
    connection.commit()
    connection.close()


def fetch_reminders(username: str):
    connection = get_connection()
    cursor = connection.execute(
        "SELECT id, title, due_date, completed FROM reminders WHERE username = ? ORDER BY due_date ASC",
        (username,),
    )
    rows = cursor.fetchall()
    connection.close()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "due_date": row["due_date"],
            "completed": bool(row["completed"]),
        }
        for row in rows
    ]


def fetch_history(limit: int = 20):
    connection = get_connection()
    cursor = connection.execute(
        """
        SELECT
            id,
            created_at,
            symptoms,
            severity,
            language,
            top_conditions,
            confidences,
            risk_score,
            condition,
            explanation,
            treatment_path,
            emergency_warning
        FROM predictions
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cursor.fetchall()
    connection.close()

    history = []
    for row in rows:
        history.append(
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "symptoms": json.loads(row["symptoms"] or "[]"),
                "severity": row["severity"],
                "language": row["language"],
                "top_conditions": json.loads(row["top_conditions"] or "[]"),
                "confidences": json.loads(row["confidences"] or "[]"),
                "risk_score": row["risk_score"],
                "condition": row["condition"],
                "explanation": row["explanation"],
                "recommended_path": json.loads(row["treatment_path"] or "[]"),
                "emergency_warning": bool(row["emergency_warning"]),
            }
        )
    return history


def fetch_admin_stats():
    connection = get_connection()
    total_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_assessments = connection.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
    total_feedback = connection.execute("SELECT COUNT(*) FROM feedback").fetchone()[0]
    avg_rating = connection.execute("SELECT AVG(rating) FROM feedback").fetchone()[0] or 0
    top_conditions = connection.execute(
        "SELECT condition, COUNT(*) as count FROM predictions GROUP BY condition ORDER BY count DESC LIMIT 5"
    ).fetchall()
    total_doctors = connection.execute("SELECT COUNT(*) FROM doctors").fetchone()[0]
    total_hospitals = connection.execute("SELECT COUNT(*) FROM hospitals").fetchone()[0]
    connection.close()

    return {
        "total_users": total_users,
        "total_assessments": total_assessments,
        "average_feedback_rating": round(float(avg_rating), 2),
        "total_feedback": total_feedback,
        "total_doctors": total_doctors,
        "total_hospitals": total_hospitals,
        "top_conditions": [
            {"condition": row["condition"], "count": row["count"]} for row in top_conditions
        ],
    }
