import base64
import hashlib
import hmac
import json
import os
import secrets
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / 'data'
BACKUPS_DIR = ROOT_DIR / 'backups'
DB_PATH = DATA_DIR / 'clinic.sqlite3'

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 120000)
    return f"{base64.b64encode(salt).decode('ascii')}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password: str, stored_value: str) -> bool:
    try:
        salt_b64, digest_b64 = stored_value.split('$', 1)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        candidate = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 120000)
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False


def _normalize_permissions(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []

    cleaned = []
    seen = set()
    for item in value:
        if not isinstance(item, str):
            continue
        perm = item.strip()
        if not perm or perm in seen:
            continue
        seen.add(perm)
        cleaned.append(perm)
    return cleaned


def _permissions_to_json(value) -> str:
    return json.dumps(_normalize_permissions(value), ensure_ascii=False)


def _permissions_from_value(value) -> list[str]:
    if not value:
        return []
    try:
        return _normalize_permissions(json.loads(value))
    except Exception:
        return []


def _safe_user(row: sqlite3.Row | None):
    if row is None:
        return None
    permissions = []
    if 'permissions_json' in row.keys():
        permissions = _permissions_from_value(row['permissions_json'])
    return {
        'id': row['id'],
        'username': row['username'],
        'fullName': row['full_name'],
        'role': row['role'],
        'specialty': row['specialty'] if 'specialty' in row.keys() else None,
        'permissions': permissions,
        'active': bool(row['active']),
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _safe_patient(row: sqlite3.Row | None):
    if row is None:
        return None
    return {
        'id': row['id'],
        'medicalRecordNumber': row['medical_record_number'],
        'firstName': row['first_name'],
        'lastName': row['last_name'],
        'documentId': row['document_id'],
        'birthDate': row['birth_date'],
        'gender': row['gender'],
        'phone': row['phone'],
        'email': row['email'],
        'address': row['address'],
        'allergies': row['allergies'],
        'notes': row['notes'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _appointment(row: sqlite3.Row):
    return {
        'id': row['id'],
        'patientId': row['patient_id'],
        'doctorUserId': row['doctor_user_id'],
        'scheduledAt': row['scheduled_at'],
        'reason': row['reason'],
        'status': row['status'],
        'notes': row['notes'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _encounter(row: sqlite3.Row):
    return {
        'id': row['id'],
        'patientId': row['patient_id'],
        'userId': row['user_id'],
        'visitDate': row['visit_date'],
        'complaint': row['complaint'],
        'diagnosis': row['diagnosis'],
        'evolution': row['evolution'],
        'plan': row['plan'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _treatment(row: sqlite3.Row):
    return {
        'id': row['id'],
        'patientId': row['patient_id'],
        'encounterId': row['encounter_id'],
        'name': row['name'],
        'dosage': row['dosage'],
        'frequency': row['frequency'],
        'startDate': row['start_date'],
        'endDate': row['end_date'],
        'notes': row['notes'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _prescription(row: sqlite3.Row):
    return {
        'id': row['id'],
        'patientId': row['patient_id'],
        'encounterId': row['encounter_id'],
        'medication': row['medication'],
        'dose': row['dose'],
        'instructions': row['instructions'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _payment(row: sqlite3.Row):
    return {
        'id': row['id'],
        'patientId': row['patient_id'],
        'amount': row['amount'],
        'paymentMethod': row['payment_method'],
        'status': row['status'],
        'notes': row['notes'],
        'receiptNumber': row['receipt_number'],
        'appointmentId': row['appointment_id'],
        'createdAt': row['created_at'],
    }


def _medication(row: sqlite3.Row):
    return {
        'id': row['id'],
        'name': row['name'],
        'description': row['description'],
        'stock': row['stock'],
        'unit': row['unit'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def _dict_row(row: sqlite3.Row | None):
    if row is None:
        return None
    return dict(row)


def initialize_database() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              full_name TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('administrador', 'medico', 'enfermera', 'recepcionista')),
              specialty TEXT,
              active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS patients (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              medical_record_number TEXT NOT NULL UNIQUE,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              document_id TEXT,
              birth_date TEXT,
              gender TEXT,
              phone TEXT,
              email TEXT,
              address TEXT,
              allergies TEXT,
              notes TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS appointments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              doctor_user_id INTEGER,
              scheduled_at TEXT NOT NULL,
              reason TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'confirmada', 'atendida', 'cancelada', 'reprogramada')),
              notes TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (doctor_user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS encounters (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              user_id INTEGER,
              visit_date TEXT NOT NULL DEFAULT (datetime('now')),
              complaint TEXT,
              diagnosis TEXT,
              evolution TEXT,
              plan TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS treatments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              encounter_id INTEGER,
              name TEXT NOT NULL,
              dosage TEXT,
              frequency TEXT,
              start_date TEXT,
              end_date TEXT,
              notes TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS prescriptions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              encounter_id INTEGER,
              medication TEXT NOT NULL,
              dose TEXT,
              instructions TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS payments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              appointment_id INTEGER,
              amount REAL NOT NULL,
              payment_method TEXT NOT NULL DEFAULT 'efectivo',
              status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
              notes TEXT,
              receipt_number TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS medications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              description TEXT,
              stock INTEGER NOT NULL DEFAULT 0,
              unit TEXT NOT NULL DEFAULT 'unidad',
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              action TEXT NOT NULL,
              entity TEXT NOT NULL,
              entity_id TEXT,
              details_json TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )

        # Migraciones seguras: agregar columnas si no existen
        existing_cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if 'specialty' not in existing_cols:
            conn.execute("ALTER TABLE users ADD COLUMN specialty TEXT")
        if 'permissions_json' not in existing_cols:
            conn.execute("ALTER TABLE users ADD COLUMN permissions_json TEXT DEFAULT '[]'")

        conn.execute("UPDATE users SET permissions_json = '[]' WHERE permissions_json IS NULL")

        pay_cols = [r[1] for r in conn.execute("PRAGMA table_info(payments)").fetchall()]
        if 'receipt_number' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN receipt_number TEXT")
        if 'appointment_id' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN appointment_id INTEGER")

        admin_exists = conn.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'administrador'").fetchone()['count']
        if admin_exists == 0:
            conn.execute(
                "INSERT INTO users (username, password_hash, full_name, role, active, permissions_json) VALUES (?, ?, ?, ?, 1, ?)",
                ('admin', _hash_password('Admin123!'), 'Administrador', 'administrador', '[]'),
            )
        conn.commit()


def create_audit(user_id=None, action='', entity='', entity_id=None, details=None) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity, entity_id, details_json) VALUES (?, ?, ?, ?, ?)",
            (user_id, action, entity, None if entity_id is None else str(entity_id),
             None if details is None else json.dumps(details, ensure_ascii=False)),
        )
        conn.commit()


# ── USERS ──────────────────────────────────────────────────────────────────────

def get_user_by_username(username: str):
    with get_connection() as conn:
        return conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()


def get_user_by_id(user_id: int):
    with get_connection() as conn:
        return conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def list_users(role: str = ''):
    with get_connection() as conn:
        if role:
            rows = conn.execute('SELECT * FROM users WHERE role = ? ORDER BY full_name', (role,)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM users ORDER BY id DESC').fetchall()
    return [_safe_user(row) for row in rows]


def create_user(data):
    with get_connection() as conn:
        permissions_json = _permissions_to_json(data.get('permissions'))
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role, specialty, permissions_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (data['username'], _hash_password(data['password']), data['fullName'], data['role'],
             data.get('specialty'), permissions_json, now_iso(), now_iso()),
        )
        conn.commit()
        return get_user_by_id(cursor.lastrowid)


def update_user(user_id: int, data):
    current = get_user_by_id(user_id)
    if current is None:
        return None
    password_hash = _dict_row(current)['password_hash']
    if data.get('password'):
        password_hash = _hash_password(data['password'])
    current_permissions = _permissions_from_value(current['permissions_json']) if 'permissions_json' in current.keys() else []
    permissions_json = _permissions_to_json(data.get('permissions', current_permissions))
    with get_connection() as conn:
        conn.execute(
            "UPDATE users SET username=?, password_hash=?, full_name=?, role=?, specialty=?, permissions_json=?, active=?, updated_at=? WHERE id=?",
            (data.get('username', current['username']), password_hash,
             data.get('fullName', current['full_name']), data.get('role', current['role']),
             data.get('specialty', current['specialty'] if 'specialty' in current.keys() else None),
             permissions_json,
             current['active'] if data.get('active') is None else (1 if data['active'] else 0),
             now_iso(), user_id),
        )
        conn.commit()
    return get_user_by_id(user_id)


def delete_user(user_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        return cursor.rowcount


# ── PATIENTS ───────────────────────────────────────────────────────────────────

def list_patients(q: str = '', limit: int = 100):
    search = f'%{q.strip()}%'
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT * FROM patients
               WHERE first_name LIKE ? OR last_name LIKE ? OR medical_record_number LIKE ?
                  OR document_id LIKE ? OR phone LIKE ? OR email LIKE ?
               ORDER BY id DESC LIMIT ?""",
            (search, search, search, search, search, search, limit),
        ).fetchall()
    return [_safe_patient(row) for row in rows]


def get_patient_by_id(patient_id: int):
    with get_connection() as conn:
        return conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()


def create_patient(data):
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO patients (medical_record_number, first_name, last_name, document_id,
               birth_date, gender, phone, email, address, allergies, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['medicalRecordNumber'], data['firstName'], data['lastName'],
             data.get('documentId'), data.get('birthDate'), data.get('gender'),
             data.get('phone'), data.get('email'), data.get('address'),
             data.get('allergies'), data.get('notes'), now_iso(), now_iso()),
        )
        conn.commit()
        return get_patient_by_id(cursor.lastrowid)


def update_patient(patient_id: int, data):
    current = get_patient_by_id(patient_id)
    if current is None:
        return None
    with get_connection() as conn:
        conn.execute(
            """UPDATE patients SET medical_record_number=?, first_name=?, last_name=?, document_id=?,
               birth_date=?, gender=?, phone=?, email=?, address=?, allergies=?, notes=?, updated_at=?
               WHERE id=?""",
            (data.get('medicalRecordNumber', current['medical_record_number']),
             data.get('firstName', current['first_name']), data.get('lastName', current['last_name']),
             data.get('documentId', current['document_id']), data.get('birthDate', current['birth_date']),
             data.get('gender', current['gender']), data.get('phone', current['phone']),
             data.get('email', current['email']), data.get('address', current['address']),
             data.get('allergies', current['allergies']), data.get('notes', current['notes']),
             now_iso(), patient_id),
        )
        conn.commit()
    return get_patient_by_id(patient_id)


def delete_patient(patient_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM patients WHERE id = ?', (patient_id,))
        conn.commit()
        return cursor.rowcount


# ── APPOINTMENTS ───────────────────────────────────────────────────────────────

def list_appointments(patient_id=None, doctor_id=None, date_filter=None, status_filter=None):
    query = 'SELECT * FROM appointments WHERE 1=1'
    params = []
    if patient_id:
        query += ' AND patient_id = ?'
        params.append(patient_id)
    if doctor_id:
        query += ' AND doctor_user_id = ?'
        params.append(doctor_id)
    if date_filter:
        query += ' AND DATE(scheduled_at) = ?'
        params.append(date_filter)
    if status_filter:
        query += ' AND status = ?'
        params.append(status_filter)
    query += ' ORDER BY datetime(scheduled_at) DESC'
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_appointment(row) for row in rows]


def search_appointments(q: str, limit: int = 20):
    term = q.strip()
    if not term:
        return []
    search = f'%{term}%'
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT * FROM appointments
               WHERE reason LIKE ?
               ORDER BY datetime(scheduled_at) DESC
               LIMIT ?""",
            (search, limit),
        ).fetchall()
    return [_appointment(row) for row in rows]


def create_appointment(data):
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO appointments (patient_id, doctor_user_id, scheduled_at, reason, status, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['patientId'], data.get('doctorUserId'), data['scheduledAt'], data['reason'],
             data.get('status', 'programada'), data.get('notes'), now_iso(), now_iso()),
        )
        conn.commit()
        return conn.execute('SELECT * FROM appointments WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_appointment(appointment_id: int, data):
    with get_connection() as conn:
        current = conn.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,)).fetchone()
        if current is None:
            return None
        conn.execute(
            """UPDATE appointments SET patient_id=?, doctor_user_id=?, scheduled_at=?, reason=?,
               status=?, notes=?, updated_at=? WHERE id=?""",
            (data.get('patientId', current['patient_id']),
             current['doctor_user_id'] if data.get('doctorUserId') is None else data.get('doctorUserId'),
             data.get('scheduledAt', current['scheduled_at']),
             data.get('reason', current['reason']), data.get('status', current['status']),
             data.get('notes', current['notes']), now_iso(), appointment_id),
        )
        conn.commit()
        return conn.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,)).fetchone()


def delete_appointment(appointment_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM appointments WHERE id = ?', (appointment_id,))
        conn.commit()
        return cursor.rowcount


# ── ENCOUNTERS ─────────────────────────────────────────────────────────────────

def list_encounters(patient_id=None):
    query = 'SELECT * FROM encounters'
    params = []
    if patient_id:
        query += ' WHERE patient_id = ?'
        params.append(patient_id)
    query += ' ORDER BY datetime(visit_date) DESC'
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_encounter(row) for row in rows]


def search_encounters(q: str, limit: int = 20):
    term = q.strip()
    if not term:
        return []
    search = f'%{term}%'
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT * FROM encounters
               WHERE diagnosis LIKE ? OR complaint LIKE ?
               ORDER BY datetime(visit_date) DESC
               LIMIT ?""",
            (search, search, limit),
        ).fetchall()
    return [_encounter(row) for row in rows]


def create_encounter(data):
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO encounters (patient_id, user_id, visit_date, complaint, diagnosis, evolution, plan, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['patientId'], data.get('userId'), data.get('visitDate', now_iso()),
             data.get('complaint'), data.get('diagnosis'), data.get('evolution'),
             data.get('plan'), now_iso(), now_iso()),
        )
        conn.commit()
        return conn.execute('SELECT * FROM encounters WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_encounter(encounter_id: int, data):
    with get_connection() as conn:
        current = conn.execute('SELECT * FROM encounters WHERE id = ?', (encounter_id,)).fetchone()
        if current is None:
            return None
        conn.execute(
            """UPDATE encounters SET patient_id=?, user_id=?, visit_date=?, complaint=?,
               diagnosis=?, evolution=?, plan=?, updated_at=? WHERE id=?""",
            (data.get('patientId', current['patient_id']),
             current['user_id'] if data.get('userId') is None else data.get('userId'),
             data.get('visitDate', current['visit_date']), data.get('complaint', current['complaint']),
             data.get('diagnosis', current['diagnosis']), data.get('evolution', current['evolution']),
             data.get('plan', current['plan']), now_iso(), encounter_id),
        )
        conn.commit()
        return conn.execute('SELECT * FROM encounters WHERE id = ?', (encounter_id,)).fetchone()


def delete_encounter(encounter_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM encounters WHERE id = ?', (encounter_id,))
        conn.commit()
        return cursor.rowcount


# ── TREATMENTS ─────────────────────────────────────────────────────────────────

def list_treatments(patient_id=None):
    query = 'SELECT * FROM treatments'
    params = []
    if patient_id:
        query += ' WHERE patient_id = ?'
        params.append(patient_id)
    query += ' ORDER BY id DESC'
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_treatment(row) for row in rows]


def create_treatment(data):
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO treatments (patient_id, encounter_id, name, dosage, frequency,
               start_date, end_date, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['patientId'], data.get('encounterId'), data['name'], data.get('dosage'),
             data.get('frequency'), data.get('startDate'), data.get('endDate'),
             data.get('notes'), now_iso(), now_iso()),
        )
        conn.commit()
        return conn.execute('SELECT * FROM treatments WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_treatment(treatment_id: int, data):
    with get_connection() as conn:
        current = conn.execute('SELECT * FROM treatments WHERE id = ?', (treatment_id,)).fetchone()
        if current is None:
            return None
        conn.execute(
            """UPDATE treatments SET patient_id=?, encounter_id=?, name=?, dosage=?, frequency=?,
               start_date=?, end_date=?, notes=?, updated_at=? WHERE id=?""",
            (data.get('patientId', current['patient_id']),
             current['encounter_id'] if data.get('encounterId') is None else data.get('encounterId'),
             data.get('name', current['name']), data.get('dosage', current['dosage']),
             data.get('frequency', current['frequency']), data.get('startDate', current['start_date']),
             data.get('endDate', current['end_date']), data.get('notes', current['notes']),
             now_iso(), treatment_id),
        )
        conn.commit()
        return conn.execute('SELECT * FROM treatments WHERE id = ?', (treatment_id,)).fetchone()


def delete_treatment(treatment_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM treatments WHERE id = ?', (treatment_id,))
        conn.commit()
        return cursor.rowcount


# ── PRESCRIPTIONS ──────────────────────────────────────────────────────────────

def list_prescriptions(patient_id=None):
    query = 'SELECT * FROM prescriptions'
    params = []
    if patient_id:
        query += ' WHERE patient_id = ?'
        params.append(patient_id)
    query += ' ORDER BY id DESC'
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_prescription(row) for row in rows]


def create_prescription(data):
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO prescriptions (patient_id, encounter_id, medication, dose, instructions, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data['patientId'], data.get('encounterId'), data['medication'],
             data.get('dose'), data.get('instructions'), now_iso(), now_iso()),
        )
        conn.commit()
        return conn.execute('SELECT * FROM prescriptions WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_prescription(prescription_id: int, data):
    with get_connection() as conn:
        current = conn.execute('SELECT * FROM prescriptions WHERE id = ?', (prescription_id,)).fetchone()
        if current is None:
            return None
        conn.execute(
            """UPDATE prescriptions SET patient_id=?, encounter_id=?, medication=?, dose=?,
               instructions=?, updated_at=? WHERE id=?""",
            (data.get('patientId', current['patient_id']),
             current['encounter_id'] if data.get('encounterId') is None else data.get('encounterId'),
             data.get('medication', current['medication']), data.get('dose', current['dose']),
             data.get('instructions', current['instructions']), now_iso(), prescription_id),
        )
        conn.commit()
        return conn.execute('SELECT * FROM prescriptions WHERE id = ?', (prescription_id,)).fetchone()


def delete_prescription(prescription_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM prescriptions WHERE id = ?', (prescription_id,))
        conn.commit()
        return cursor.rowcount


# ── PAYMENTS ───────────────────────────────────────────────────────────────────

def _generate_receipt_number():
    ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    suffix = secrets.token_hex(2).upper()
    return f'REC-{ts}-{suffix}'


def list_payments(patient_id=None, status_filter=None):
    query = 'SELECT * FROM payments WHERE 1=1'
    params = []
    if patient_id:
        query += ' AND patient_id = ?'
        params.append(patient_id)
    if status_filter:
        query += ' AND status = ?'
        params.append(status_filter)
    query += ' ORDER BY id DESC'
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_payment(row) for row in rows]


def create_payment(data):
    receipt = _generate_receipt_number()
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO payments (patient_id, appointment_id, amount, payment_method, status, notes, receipt_number, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['patientId'], data.get('appointmentId'), data['amount'],
             data.get('paymentMethod', 'efectivo'), data.get('status', 'pendiente'),
             data.get('notes'), receipt, now_iso()),
        )
        conn.commit()
        # Si el pago es marcado como pagado, actualizar la cita vinculada
        if data.get('status') == 'pagado' and data.get('appointmentId'):
            conn.execute(
                "UPDATE appointments SET status='atendida', updated_at=? WHERE id=?",
                (now_iso(), data['appointmentId'])
            )
            conn.commit()
        return conn.execute('SELECT * FROM payments WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_payment_status(payment_id: int, status: str):
    with get_connection() as conn:
        row = conn.execute('SELECT * FROM payments WHERE id = ?', (payment_id,)).fetchone()
        if row is None:
            return None
        conn.execute('UPDATE payments SET status=? WHERE id=?', (status, payment_id))
        if status == 'pagado' and row['appointment_id']:
            conn.execute(
                "UPDATE appointments SET status='atendida', updated_at=? WHERE id=?",
                (now_iso(), row['appointment_id'])
            )
        conn.commit()
        return conn.execute('SELECT * FROM payments WHERE id = ?', (payment_id,)).fetchone()


def delete_payment(payment_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM payments WHERE id = ?', (payment_id,))
        conn.commit()
        return cursor.rowcount


# ── MEDICATIONS ────────────────────────────────────────────────────────────────

def list_medications(q: str = ''):
    search = f'%{q.strip()}%'
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM medications WHERE name LIKE ? OR description LIKE ? ORDER BY name",
            (search, search)
        ).fetchall()
    return [_medication(row) for row in rows]


def get_medication_by_id(med_id: int):
    with get_connection() as conn:
        return conn.execute('SELECT * FROM medications WHERE id = ?', (med_id,)).fetchone()


def create_medication(data):
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO medications (name, description, stock, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (data['name'], data.get('description'), int(data.get('stock', 0)),
             data.get('unit', 'unidad'), now_iso(), now_iso()),
        )
        conn.commit()
        return conn.execute('SELECT * FROM medications WHERE id = ?', (cursor.lastrowid,)).fetchone()


def update_medication(med_id: int, data):
    with get_connection() as conn:
        current = conn.execute('SELECT * FROM medications WHERE id = ?', (med_id,)).fetchone()
        if current is None:
            return None
        new_stock = current['stock']
        if data.get('stockDelta') is not None:
            new_stock = max(0, current['stock'] + int(data['stockDelta']))
        elif data.get('stock') is not None:
            new_stock = max(0, int(data['stock']))
        conn.execute(
            "UPDATE medications SET name=?, description=?, stock=?, unit=?, updated_at=? WHERE id=?",
            (data.get('name', current['name']), data.get('description', current['description']),
             new_stock, data.get('unit', current['unit']), now_iso(), med_id),
        )
        conn.commit()
        return conn.execute('SELECT * FROM medications WHERE id = ?', (med_id,)).fetchone()


def delete_medication(med_id: int):
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM medications WHERE id = ?', (med_id,))
        conn.commit()
        return cursor.rowcount


# ── HISTORY / STATS ────────────────────────────────────────────────────────────

def get_audit_logs(limit: int = 200):
    with get_connection() as conn:
        rows = conn.execute(
            'SELECT * FROM audit_log ORDER BY datetime(created_at) DESC, id DESC LIMIT ?', (limit,)
        ).fetchall()
    return [_dict_row(row) for row in rows]


def get_patient_history(patient_id: int):
    patient = get_patient_by_id(patient_id)
    if patient is None:
        return None
    return {
        'patient': _safe_patient(patient),
        'appointments': list_appointments(patient_id),
        'encounters': list_encounters(patient_id),
        'treatments': list_treatments(patient_id),
        'prescriptions': list_prescriptions(patient_id),
        'payments': list_payments(patient_id),
    }


def get_stats():
    with get_connection() as conn:
        row = conn.execute(
            """SELECT
              (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM patients) AS patients,
              (SELECT COUNT(*) FROM appointments) AS appointments,
              (SELECT COUNT(*) FROM appointments WHERE status='pendiente' OR status='programada') AS appointments_pending,
              (SELECT COUNT(*) FROM encounters) AS encounters,
              (SELECT COUNT(*) FROM treatments) AS treatments,
              (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
              (SELECT COUNT(*) FROM payments) AS payments,
              (SELECT COUNT(*) FROM payments WHERE status='pendiente') AS payments_pending,
              (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='pagado') AS total_collected,
              (SELECT COUNT(*) FROM medications) AS medications,
              (SELECT COUNT(*) FROM audit_log) AS audit
            """
        ).fetchone()
    return dict(row)


def backup_database():
    backup_name = f"clinic-{now_iso().replace(':', '-').replace('.', '-')}.sqlite3"
    backup_path = BACKUPS_DIR / backup_name
    shutil.copy2(DB_PATH, backup_path)
    return str(backup_path)


def encode_token(user_row, secret_key: str, expires_seconds: int = 43200) -> str:
    payload = {
        'sub': user_row['id'],
        'username': user_row['username'],
        'role': user_row['role'],
        'fullName': user_row['full_name'],
        'exp': int(datetime.utcnow().timestamp()) + expires_seconds,
    }
    raw = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')
    signature = hmac.new(secret_key.encode('utf-8'), payload_b64.encode('ascii'), hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode('ascii')
    return f'{payload_b64}.{signature_b64}'


def decode_token(token: str, secret_key: str):
    try:
        payload_b64, signature_b64 = token.split('.', 1)
        expected_signature = hmac.new(secret_key.encode('utf-8'), payload_b64.encode('ascii'), hashlib.sha256).digest()
        provided_signature = base64.urlsafe_b64decode(signature_b64 + '===')
        if not hmac.compare_digest(expected_signature, provided_signature):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + '===').decode('utf-8'))
        if int(datetime.utcnow().timestamp()) > int(payload['exp']):
            return None
        return payload
    except Exception:
        return None


__all__ = [
    'DB_PATH', 'BACKUPS_DIR', 'initialize_database', 'verify_password',
    'get_user_by_username', 'get_user_by_id', 'list_users', 'create_user', 'update_user', 'delete_user',
    'list_patients', 'get_patient_by_id', 'create_patient', 'update_patient', 'delete_patient',
    'list_appointments', 'search_appointments', 'create_appointment', 'update_appointment', 'delete_appointment',
    'list_encounters', 'search_encounters', 'create_encounter', 'update_encounter', 'delete_encounter',
    'list_treatments', 'create_treatment', 'update_treatment', 'delete_treatment',
    'list_prescriptions', 'create_prescription', 'update_prescription', 'delete_prescription',
    'list_payments', 'create_payment', 'update_payment_status', 'delete_payment',
    'list_medications', 'get_medication_by_id', 'create_medication', 'update_medication', 'delete_medication',
    'create_audit', 'get_audit_logs', 'get_patient_history', 'get_stats', 'backup_database',
    'encode_token', 'decode_token',
    '_safe_user', '_safe_patient', '_appointment', '_encounter', '_treatment',
    '_prescription', '_payment', '_medication',
]
