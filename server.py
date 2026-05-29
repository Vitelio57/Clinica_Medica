import json
import os
import sqlite3
import traceback
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from db import (
    _appointment, _encounter, _payment, _prescription, _treatment, _medication,
    _safe_patient, _safe_user,
    backup_database, create_audit,
    create_appointment, create_encounter, create_patient, create_payment,
    create_prescription, create_treatment, create_user, create_medication,
    decode_token, encode_token,
    delete_appointment, delete_encounter, delete_patient, delete_payment,
    delete_prescription, delete_treatment, delete_user, delete_medication,
    get_audit_logs, get_patient_by_id, get_patient_history, get_stats,
    get_user_by_id, get_user_by_username,
    initialize_database,
    list_appointments, list_encounters, list_patients, list_payments,
    search_appointments, search_encounters,
    list_prescriptions, list_treatments, list_users, list_medications,
    update_appointment, update_encounter, update_patient, update_payment_status,
    update_prescription, update_treatment, update_user, update_medication,
    verify_password,
)


ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / 'public'
PORT = int(os.environ.get('PORT', '3000'))
JWT_SECRET = os.environ.get('JWT_SECRET', 'clinica-medica-secret')

DEFAULT_ROLE_PERMISSIONS = {
    'administrador': ['*'],
    'medico': [
        'users.read.medics',
        'stats.read', 'search.read',
        'patients.read', 'patients.create', 'patients.update', 'patients.delete', 'patients.history',
        'appointments.read', 'appointments.create', 'appointments.update', 'appointments.delete',
        'encounters.read', 'encounters.create', 'encounters.update', 'encounters.delete',
        'treatments.read', 'treatments.create', 'treatments.update', 'treatments.delete',
        'prescriptions.read', 'prescriptions.create', 'prescriptions.update', 'prescriptions.delete',
        'payments.create',
        'medications.read', 'medications.create', 'medications.update',
    ],
    'enfermera': [
        'users.read.medics',
        'stats.read', 'search.read',
        'patients.read', 'patients.create', 'patients.update',
        'appointments.read', 'appointments.create', 'appointments.update',
        'encounters.create', 'encounters.update',
        'treatments.read', 'treatments.create', 'treatments.update',
        'medications.read', 'medications.create', 'medications.update',
    ],
    'recepcionista': [
        'users.read.medics',
        'stats.read', 'search.read',
        'patients.read', 'patients.create', 'patients.update',
        'appointments.read', 'appointments.create', 'appointments.update',
        'payments.read', 'payments.create', 'payments.update_status', 'payments.delete',
    ],
}

initialize_database()


def parse_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class ClinicHandler(SimpleHTTPRequestHandler):
    server_version = 'ClinicMedica/1.0'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def _json_response(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode('utf-8'))

    def _send_error(self, status, message):
        self._json_response(status, {'error': message})

    def _current_user(self):
        auth = self.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None
        payload = decode_token(auth[7:].strip(), JWT_SECRET)
        if not payload:
            return None
        user = get_user_by_id(payload['sub'])
        if not user or not user['active']:
            return None
        return user

    def _require_auth(self):
        user = self._current_user()
        if not user:
            self._send_error(HTTPStatus.UNAUTHORIZED, 'Se requiere autenticación.')
            return None
        return user

    def _require_role(self, user, *roles):
        if user['role'] not in roles:
            self._send_error(HTTPStatus.FORBIDDEN, 'No tienes permisos para esta acción.')
            return False
        return True

    def _effective_permissions(self, user) -> set[str]:
        role_defaults = DEFAULT_ROLE_PERMISSIONS.get(user['role'], [])
        raw_permissions = user['permissions_json'] if 'permissions_json' in user.keys() else None
        custom_permissions = []

        if raw_permissions:
            try:
                parsed = json.loads(raw_permissions)
                if isinstance(parsed, list):
                    custom_permissions = [p.strip() for p in parsed if isinstance(p, str) and p.strip()]
            except Exception:
                custom_permissions = []

        # Si existen permisos personalizados, tienen prioridad sobre el rol.
        if custom_permissions:
            return set(custom_permissions)
        return set(role_defaults)

    def _has_permission(self, user, permission: str) -> bool:
        perms = self._effective_permissions(user)
        return '*' in perms or permission in perms

    def _require_permission(self, user, permission: str):
        if not self._has_permission(user, permission):
            self._send_error(HTTPStatus.FORBIDDEN, 'No tienes permisos para esta acción.')
            return False
        return True

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            if parsed.path.startswith('/api/'):
                self._handle_api_get(parsed)
                return
            return super().do_GET()
        except sqlite3.IntegrityError as e:
            self._send_error(HTTPStatus.BAD_REQUEST, f'Error de integridad: {e}')
        except Exception:
            traceback.print_exc()
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor.')

    def do_POST(self):
        try:
            if self.path.startswith('/api/'):
                self._handle_api_post(urlparse(self.path))
                return
            self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')
        except sqlite3.IntegrityError as e:
            self._send_error(HTTPStatus.BAD_REQUEST, f'Error de integridad: {e}')
        except Exception:
            traceback.print_exc()
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor.')

    def do_PUT(self):
        try:
            if self.path.startswith('/api/'):
                self._handle_api_put(urlparse(self.path))
                return
            self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')
        except sqlite3.IntegrityError as e:
            self._send_error(HTTPStatus.BAD_REQUEST, f'Error de integridad: {e}')
        except Exception:
            traceback.print_exc()
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor.')

    def do_DELETE(self):
        try:
            if self.path.startswith('/api/'):
                self._handle_api_delete(urlparse(self.path))
                return
            self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')
        except sqlite3.IntegrityError as e:
            self._send_error(HTTPStatus.BAD_REQUEST, f'Error de integridad: {e}')
        except Exception:
            traceback.print_exc()
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor.')

    # ── GET ────────────────────────────────────────────────────────────────────

    def _handle_api_get(self, parsed):
        path = parsed.path
        query = parse_qs(parsed.query)
        user = self._require_auth() if path != '/api/health' else None
        if path != '/api/health' and not user:
            return

        if path == '/api/health':
            return self._json_response(HTTPStatus.OK, {'ok': True, 'name': 'ClinicaMedica API'})

        if path == '/api/me':
            return self._json_response(HTTPStatus.OK, {'user': _safe_user(user)})

        if path == '/api/stats':
            if not self._require_permission(user, 'stats.read'):
                return
            return self._json_response(HTTPStatus.OK, get_stats())

        if path == '/api/users':
            role_filter = query.get('role', [None])[0]
            if not role_filter:
                if self._has_permission(user, 'users.read.all'):
                    return self._json_response(HTTPStatus.OK, list_users(''))
                if not self._require_permission(user, 'users.read.medics'):
                    return
                return self._json_response(HTTPStatus.OK, list_users('medico'))
            if role_filter == 'medico':
                if not self._require_permission(user, 'users.read.medics'):
                    return
            else:
                if not self._require_permission(user, 'users.read.all'):
                    return
            return self._json_response(HTTPStatus.OK, list_users(role_filter or ''))

        if path == '/api/patients':
            if not self._require_permission(user, 'patients.read'):
                return
            return self._json_response(HTTPStatus.OK, list_patients(query.get('q', [''])[0]))

        if path.startswith('/api/patients/') and path.endswith('/history'):
            if not self._require_permission(user, 'patients.history'):
                return
            patient_id = parse_id(path.split('/')[3])
            if patient_id is None:
                return self._send_error(HTTPStatus.BAD_REQUEST, 'ID inválido.')
            history = get_patient_history(patient_id)
            if not history:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Paciente no encontrado.')
            return self._json_response(HTTPStatus.OK, history)

        if path == '/api/appointments':
            if not self._require_permission(user, 'appointments.read'):
                return
            patient_id = parse_id(query.get('patientId', [None])[0])
            doctor_id = parse_id(query.get('doctorId', [None])[0])
            date_filter = query.get('date', [None])[0]
            status_filter = query.get('status', [None])[0]
            return self._json_response(HTTPStatus.OK, list_appointments(patient_id, doctor_id, date_filter, status_filter))

        if path == '/api/encounters':
            if not self._require_permission(user, 'encounters.read'):
                return
            patient_id = parse_id(query.get('patientId', [None])[0])
            return self._json_response(HTTPStatus.OK, list_encounters(patient_id))

        if path == '/api/treatments':
            if not self._require_permission(user, 'treatments.read'):
                return
            patient_id = parse_id(query.get('patientId', [None])[0])
            return self._json_response(HTTPStatus.OK, list_treatments(patient_id))

        if path == '/api/prescriptions':
            if not self._require_permission(user, 'prescriptions.read'):
                return
            patient_id = parse_id(query.get('patientId', [None])[0])
            return self._json_response(HTTPStatus.OK, list_prescriptions(patient_id))

        if path == '/api/payments':
            if not self._require_permission(user, 'payments.read'):
                return
            patient_id = parse_id(query.get('patientId', [None])[0])
            status_filter = query.get('status', [None])[0]
            return self._json_response(HTTPStatus.OK, list_payments(patient_id, status_filter))

        if path == '/api/medications':
            if not self._require_permission(user, 'medications.read'):
                return
            return self._json_response(HTTPStatus.OK, list_medications(query.get('q', [''])[0]))

        if path == '/api/audit':
            if not self._require_permission(user, 'audit.read'):
                return
            return self._json_response(HTTPStatus.OK, get_audit_logs())

        if path == '/api/search':
            if not self._require_permission(user, 'search.read'):
                return
            q = (query.get('q', [''])[0] or '').strip()
            if not q:
                return self._json_response(HTTPStatus.OK, {'patients': [], 'appointments': [], 'encounters': []})
            patients = list_patients(q, limit=20)
            appointments = search_appointments(q, limit=20)
            encounters = search_encounters(q, limit=20)
            return self._json_response(HTTPStatus.OK, {'patients': patients, 'appointments': appointments, 'encounters': encounters})

        self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')

    # ── POST ───────────────────────────────────────────────────────────────────

    def _handle_api_post(self, parsed):
        path = parsed.path
        body = self._read_json()

        if path == '/api/auth/login':
            username = (body.get('username') or '').strip()
            password = body.get('password') or ''
            if not username or not password:
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan credenciales.')
            u = get_user_by_username(username)
            if not u or not u['active'] or not verify_password(password, u['password_hash']):
                return self._send_error(HTTPStatus.UNAUTHORIZED, 'Credenciales inválidas.')
            token = encode_token(u, JWT_SECRET)
            create_audit(user_id=u['id'], action='login', entity='auth', entity_id=u['id'], details={'username': u['username']})
            return self._json_response(HTTPStatus.OK, {'token': token, 'user': _safe_user(u)})

        user = self._require_auth()
        if not user:
            return

        if path == '/api/users':
            if not self._require_permission(user, 'users.create'):
                return
            if not all(body.get(f) for f in ('username', 'password', 'fullName', 'role')):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos del usuario.')
            created = create_user(body)
            create_audit(user_id=user['id'], action='create', entity='user', entity_id=created['id'], details={'username': created['username'], 'role': created['role']})
            return self._json_response(HTTPStatus.CREATED, _safe_user(created))

        if path == '/api/patients':
            if not self._require_permission(user, 'patients.create'):
                return
            if not all(body.get(f) for f in ('medicalRecordNumber', 'firstName', 'lastName')):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos del paciente.')
            created = create_patient(body)
            create_audit(user_id=user['id'], action='create', entity='patient', entity_id=created['id'], details={'medicalRecordNumber': created['medical_record_number']})
            return self._json_response(HTTPStatus.CREATED, _safe_patient(created))

        if path == '/api/appointments':
            if not self._require_permission(user, 'appointments.create'):
                return
            if not all(body.get(f) for f in ('patientId', 'scheduledAt', 'reason')):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos de la cita.')
            created = create_appointment({
                'patientId': parse_id(body.get('patientId')),
                'doctorUserId': parse_id(body.get('doctorUserId')) if body.get('doctorUserId') else None,
                'scheduledAt': body.get('scheduledAt'),
                'reason': body.get('reason'),
                'status': body.get('status'),
                'notes': body.get('notes'),
            })
            payload = _appointment(created)
            create_audit(user_id=user['id'], action='create', entity='appointment', entity_id=payload['id'], details={'patientId': payload['patientId'], 'status': payload['status']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/encounters':
            if not self._require_permission(user, 'encounters.create'):
                return
            if not body.get('patientId'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Falta el paciente.')
            created = create_encounter({
                'patientId': parse_id(body.get('patientId')),
                'userId': user['id'],
                'visitDate': body.get('visitDate'),
                'complaint': body.get('complaint'),
                'diagnosis': body.get('diagnosis'),
                'evolution': body.get('evolution'),
                'plan': body.get('plan'),
            })
            payload = _encounter(created)
            create_audit(user_id=user['id'], action='create', entity='encounter', entity_id=payload['id'], details={'patientId': payload['patientId']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/treatments':
            if not self._require_permission(user, 'treatments.create'):
                return
            if not body.get('patientId') or not body.get('name'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos del tratamiento.')
            created = create_treatment({
                'patientId': parse_id(body.get('patientId')),
                'encounterId': parse_id(body.get('encounterId')) if body.get('encounterId') else None,
                'name': body.get('name'),
                'dosage': body.get('dosage'),
                'frequency': body.get('frequency'),
                'startDate': body.get('startDate'),
                'endDate': body.get('endDate'),
                'notes': body.get('notes'),
            })
            payload = _treatment(created)
            create_audit(user_id=user['id'], action='create', entity='treatment', entity_id=payload['id'], details={'patientId': payload['patientId']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/prescriptions':
            if not self._require_permission(user, 'prescriptions.create'):
                return
            if not body.get('patientId') or not body.get('medication'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos de la receta.')
            created = create_prescription({
                'patientId': parse_id(body.get('patientId')),
                'encounterId': parse_id(body.get('encounterId')) if body.get('encounterId') else None,
                'medication': body.get('medication'),
                'dose': body.get('dose'),
                'instructions': body.get('instructions'),
            })
            payload = _prescription(created)
            create_audit(user_id=user['id'], action='create', entity='prescription', entity_id=payload['id'], details={'patientId': payload['patientId']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/payments':
            if not self._require_permission(user, 'payments.create'):
                return
            if not body.get('patientId') or not body.get('amount'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Faltan datos del pago.')
            created = create_payment({
                'patientId': parse_id(body.get('patientId')),
                'appointmentId': parse_id(body.get('appointmentId')) if body.get('appointmentId') else None,
                'amount': float(body.get('amount')),
                'paymentMethod': body.get('paymentMethod', 'efectivo'),
                'status': body.get('status', 'pendiente'),
                'notes': body.get('notes'),
            })
            payload = _payment(created)
            create_audit(user_id=user['id'], action='create', entity='payment', entity_id=payload['id'], details={'patientId': payload['patientId'], 'amount': payload['amount'], 'receipt': payload['receiptNumber']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/medications':
            if not self._require_permission(user, 'medications.create'):
                return
            if not body.get('name'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Falta el nombre del medicamento.')
            created = create_medication(body)
            payload = _medication(created)
            create_audit(user_id=user['id'], action='create', entity='medication', entity_id=payload['id'], details={'name': payload['name']})
            return self._json_response(HTTPStatus.CREATED, payload)

        if path == '/api/backup':
            if not self._require_permission(user, 'backup.create'):
                return
            backup_path = backup_database()
            create_audit(user_id=user['id'], action='backup', entity='database', entity_id=backup_path)
            return self._json_response(HTTPStatus.OK, {'ok': True, 'backupPath': backup_path})

        self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')

    # ── PUT ────────────────────────────────────────────────────────────────────

    def _handle_api_put(self, parsed):
        path = parsed.path
        body = self._read_json()
        user = self._require_auth()
        if not user:
            return

        if path.startswith('/api/users/'):
            if not self._require_permission(user, 'users.update'):
                return
            user_id = parse_id(path.split('/')[3])
            updated = update_user(user_id, body)
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Usuario no encontrado.')
            create_audit(user_id=user['id'], action='update', entity='user', entity_id=user_id)
            return self._json_response(HTTPStatus.OK, _safe_user(updated))

        if path.startswith('/api/patients/') and path.count('/') == 3:
            if not self._require_permission(user, 'patients.update'):
                return
            patient_id = parse_id(path.split('/')[3])
            updated = update_patient(patient_id, body)
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Paciente no encontrado.')
            create_audit(user_id=user['id'], action='update', entity='patient', entity_id=patient_id)
            return self._json_response(HTTPStatus.OK, _safe_patient(updated))

        if path.startswith('/api/appointments/'):
            if not self._require_permission(user, 'appointments.update'):
                return
            appointment_id = parse_id(path.split('/')[3])
            updated = update_appointment(appointment_id, {
                'patientId': parse_id(body.get('patientId')) if body.get('patientId') else None,
                'doctorUserId': parse_id(body.get('doctorUserId')) if body.get('doctorUserId') else None,
                'scheduledAt': body.get('scheduledAt'),
                'reason': body.get('reason'),
                'status': body.get('status'),
                'notes': body.get('notes'),
            })
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Cita no encontrada.')
            create_audit(user_id=user['id'], action='update', entity='appointment', entity_id=appointment_id, details={'status': updated['status']})
            return self._json_response(HTTPStatus.OK, _appointment(updated))

        if path.startswith('/api/encounters/'):
            if not self._require_permission(user, 'encounters.update'):
                return
            encounter_id = parse_id(path.split('/')[3])
            updated = update_encounter(encounter_id, {
                'patientId': parse_id(body.get('patientId')) if body.get('patientId') else None,
                'userId': parse_id(body.get('userId')) if body.get('userId') else None,
                'visitDate': body.get('visitDate'),
                'complaint': body.get('complaint'),
                'diagnosis': body.get('diagnosis'),
                'evolution': body.get('evolution'),
                'plan': body.get('plan'),
            })
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Consulta no encontrada.')
            create_audit(user_id=user['id'], action='update', entity='encounter', entity_id=encounter_id)
            return self._json_response(HTTPStatus.OK, _encounter(updated))

        if path.startswith('/api/treatments/'):
            if not self._require_permission(user, 'treatments.update'):
                return
            treatment_id = parse_id(path.split('/')[3])
            updated = update_treatment(treatment_id, {
                'patientId': parse_id(body.get('patientId')) if body.get('patientId') else None,
                'encounterId': parse_id(body.get('encounterId')) if body.get('encounterId') else None,
                'name': body.get('name'),
                'dosage': body.get('dosage'),
                'frequency': body.get('frequency'),
                'startDate': body.get('startDate'),
                'endDate': body.get('endDate'),
                'notes': body.get('notes'),
            })
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Tratamiento no encontrado.')
            create_audit(user_id=user['id'], action='update', entity='treatment', entity_id=treatment_id)
            return self._json_response(HTTPStatus.OK, _treatment(updated))

        if path.startswith('/api/prescriptions/'):
            if not self._require_permission(user, 'prescriptions.update'):
                return
            prescription_id = parse_id(path.split('/')[3])
            updated = update_prescription(prescription_id, {
                'patientId': parse_id(body.get('patientId')) if body.get('patientId') else None,
                'encounterId': parse_id(body.get('encounterId')) if body.get('encounterId') else None,
                'medication': body.get('medication'),
                'dose': body.get('dose'),
                'instructions': body.get('instructions'),
            })
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Receta no encontrada.')
            create_audit(user_id=user['id'], action='update', entity='prescription', entity_id=prescription_id)
            return self._json_response(HTTPStatus.OK, _prescription(updated))

        if path.startswith('/api/payments/') and path.endswith('/status'):
            if not self._require_permission(user, 'payments.update_status'):
                return
            payment_id = parse_id(path.split('/')[3])
            status = body.get('status')
            if status not in ('pendiente', 'pagado'):
                return self._send_error(HTTPStatus.BAD_REQUEST, 'Estado inválido.')
            updated = update_payment_status(payment_id, status)
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Pago no encontrado.')
            create_audit(user_id=user['id'], action='update', entity='payment', entity_id=payment_id, details={'status': status})
            return self._json_response(HTTPStatus.OK, _payment(updated))

        if path.startswith('/api/medications/'):
            if not self._require_permission(user, 'medications.update'):
                return
            med_id = parse_id(path.split('/')[3])
            updated = update_medication(med_id, body)
            if not updated:
                return self._send_error(HTTPStatus.NOT_FOUND, 'Medicamento no encontrado.')
            create_audit(user_id=user['id'], action='update', entity='medication', entity_id=med_id, details={'name': updated['name'], 'stock': updated['stock']})
            return self._json_response(HTTPStatus.OK, _medication(updated))

        self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')

    # ── DELETE ─────────────────────────────────────────────────────────────────

    def _handle_api_delete(self, parsed):
        path = parsed.path
        user = self._require_auth()
        if not user:
            return

        if path.startswith('/api/users/'):
            if not self._require_permission(user, 'users.delete'):
                return
            user_id = parse_id(path.split('/')[3])
            removed = delete_user(user_id)
            create_audit(user_id=user['id'], action='delete', entity='user', entity_id=user_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/patients/'):
            if not self._require_permission(user, 'patients.delete'):
                return
            patient_id = parse_id(path.split('/')[3])
            removed = delete_patient(patient_id)
            create_audit(user_id=user['id'], action='delete', entity='patient', entity_id=patient_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/appointments/'):
            if not self._require_permission(user, 'appointments.delete'):
                return
            appointment_id = parse_id(path.split('/')[3])
            removed = delete_appointment(appointment_id)
            create_audit(user_id=user['id'], action='delete', entity='appointment', entity_id=appointment_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/encounters/'):
            if not self._require_permission(user, 'encounters.delete'):
                return
            encounter_id = parse_id(path.split('/')[3])
            removed = delete_encounter(encounter_id)
            create_audit(user_id=user['id'], action='delete', entity='encounter', entity_id=encounter_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/treatments/'):
            if not self._require_permission(user, 'treatments.delete'):
                return
            treatment_id = parse_id(path.split('/')[3])
            removed = delete_treatment(treatment_id)
            create_audit(user_id=user['id'], action='delete', entity='treatment', entity_id=treatment_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/prescriptions/'):
            if not self._require_permission(user, 'prescriptions.delete'):
                return
            prescription_id = parse_id(path.split('/')[3])
            removed = delete_prescription(prescription_id)
            create_audit(user_id=user['id'], action='delete', entity='prescription', entity_id=prescription_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/payments/'):
            if not self._require_permission(user, 'payments.delete'):
                return
            payment_id = parse_id(path.split('/')[3])
            removed = delete_payment(payment_id)
            create_audit(user_id=user['id'], action='delete', entity='payment', entity_id=payment_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        if path.startswith('/api/medications/'):
            if not self._require_permission(user, 'medications.delete'):
                return
            med_id = parse_id(path.split('/')[3])
            removed = delete_medication(med_id)
            create_audit(user_id=user['id'], action='delete', entity='medication', entity_id=med_id)
            return self._json_response(HTTPStatus.OK, {'deleted': removed > 0})

        self._send_error(HTTPStatus.NOT_FOUND, 'Ruta no encontrada.')

    def log_message(self, format, *args):
        return


def main():
    os.chdir(ROOT_DIR)
    server = ThreadingHTTPServer(('0.0.0.0', PORT), ClinicHandler)
    print(f'ClinicaMedica ejecutándose en http://localhost:{PORT}')
    print('Usuario inicial: admin / Admin123!')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
