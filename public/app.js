// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
const state = {
  token: '',
  user: null,
  activeModule: 'dashboard',
  pageSize: 10,
  tablePage: {},
  patients: [],
  users: [],
  appointments: [],
  encounters: [],
  treatments: [],
  prescriptions: [],
  payments: [],
  medications: [],
  audit: [],
};

const ROLE_PERMISSION_DEFAULTS = {
  administrador: ['*'],
  medico: [
    'users.read.medics', 'stats.read', 'search.read',
    'patients.read', 'patients.create', 'patients.update', 'patients.delete', 'patients.history',
    'appointments.read', 'appointments.create', 'appointments.update', 'appointments.delete',
    'encounters.read', 'encounters.create', 'encounters.update', 'encounters.delete',
    'treatments.read', 'treatments.create', 'treatments.update', 'treatments.delete',
    'prescriptions.read', 'prescriptions.create', 'prescriptions.update', 'prescriptions.delete',
    'payments.create',
    'medications.read', 'medications.create', 'medications.update',
  ],
  enfermera: [
    'users.read.medics', 'stats.read', 'search.read',
    'patients.read', 'patients.create', 'patients.update',
    'appointments.read', 'appointments.create', 'appointments.update',
    'encounters.create', 'encounters.update',
    'treatments.read', 'treatments.create', 'treatments.update',
    'medications.read', 'medications.create', 'medications.update',
  ],
  recepcionista: [
    'users.read.medics', 'stats.read', 'search.read',
    'patients.read', 'patients.create', 'patients.update',
    'appointments.read', 'appointments.create', 'appointments.update',
    'payments.read', 'payments.create', 'payments.update_status', 'payments.delete',
  ],
};

const PERMISSION_GROUPS = [
  {
    label: 'Usuarios',
    items: [
      ['users.read.all', 'Ver todos los usuarios'],
      ['users.read.medics', 'Ver solo medicos'],
      ['users.create', 'Crear usuarios'],
      ['users.update', 'Editar usuarios'],
      ['users.delete', 'Eliminar usuarios'],
    ],
  },
  {
    label: 'Pacientes',
    items: [
      ['patients.read', 'Ver pacientes'],
      ['patients.create', 'Crear pacientes'],
      ['patients.update', 'Editar pacientes'],
      ['patients.delete', 'Eliminar pacientes'],
      ['patients.history', 'Ver historial clinico'],
    ],
  },
  {
    label: 'Citas y Consultas',
    items: [
      ['appointments.read', 'Ver citas'],
      ['appointments.create', 'Crear citas'],
      ['appointments.update', 'Editar/reprogramar citas'],
      ['appointments.delete', 'Eliminar citas'],
      ['encounters.read', 'Ver consultas'],
      ['encounters.create', 'Crear consultas'],
      ['encounters.update', 'Editar consultas'],
      ['encounters.delete', 'Eliminar consultas'],
    ],
  },
  {
    label: 'Tratamientos y Recetas',
    items: [
      ['treatments.read', 'Ver tratamientos'],
      ['treatments.create', 'Crear tratamientos'],
      ['treatments.update', 'Editar tratamientos'],
      ['treatments.delete', 'Eliminar tratamientos'],
      ['prescriptions.read', 'Ver recetas'],
      ['prescriptions.create', 'Crear recetas'],
      ['prescriptions.update', 'Editar recetas'],
      ['prescriptions.delete', 'Eliminar recetas'],
    ],
  },
  {
    label: 'Pagos y Farmacia',
    items: [
      ['payments.read', 'Ver pagos'],
      ['payments.create', 'Registrar pagos'],
      ['payments.update_status', 'Cambiar estado de pago'],
      ['payments.delete', 'Eliminar pagos'],
      ['medications.read', 'Ver medicamentos'],
      ['medications.create', 'Crear medicamentos'],
      ['medications.update', 'Editar stock/medicamentos'],
      ['medications.delete', 'Eliminar medicamentos'],
    ],
  },
  {
    label: 'Sistema',
    items: [
      ['stats.read', 'Ver estadisticas'],
      ['search.read', 'Usar buscador global'],
      ['audit.read', 'Ver auditoria'],
      ['backup.create', 'Generar respaldo'],
    ],
  },
];

const tabs = [
  { id: 'dashboard',     label: 'Inicio',       icon: 'I' },
  { id: 'users',         label: 'Usuarios',     icon: 'U', permissions: ['users.read.all'] },
  { id: 'patients',      label: 'Pacientes',    icon: 'P', permissions: ['patients.read'] },
  { id: 'history',       label: 'Historial',    icon: 'H', permissions: ['patients.history'] },
  { id: 'appointments',  label: 'Citas',        icon: 'C', permissions: ['appointments.read'] },
  { id: 'treatments',    label: 'Tratamientos', icon: 'T', permissions: ['treatments.read'] },
  { id: 'prescriptions', label: 'Recetas',      icon: 'R', permissions: ['prescriptions.read'] },
  { id: 'payments',      label: 'Pagos',        icon: '$', permissions: ['payments.read'] },
  { id: 'medications',   label: 'Farmacia',     icon: 'F', permissions: ['medications.read'] },
  { id: 'audit',         label: 'Auditoria',    icon: 'A', permissions: ['audit.read'] },
];

function getEffectivePermissions(user) {
  if (!user) return new Set();
  const custom = Array.isArray(user.permissions) ? user.permissions.filter(Boolean) : [];
  if (custom.length) return new Set(custom);
  return new Set(ROLE_PERMISSION_DEFAULTS[user.role] || []);
}

function can(permission) {
  const perms = getEffectivePermissions(state.user);
  return perms.has('*') || perms.has(permission);
}

function canAny(permissions = []) {
  return permissions.some(can);
}

function canAccessTab(tab) {
  if (!tab.permissions || !tab.permissions.length) return true;
  return canAny(tab.permissions);
}

function setSidebarCollapsed(collapsed) {
  if (!shell || !btnToggleSidebar) return;
  shell.classList.toggle('sidebar-collapsed', collapsed);
  btnToggleSidebar.textContent = collapsed ? '>>' : '<<';
  btnToggleSidebar.setAttribute('aria-label', collapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral');
  localStorage.setItem('clinic.sidebarCollapsed', collapsed ? '1' : '0');
}

// ── DOM ───────────────────────────────────────────────────────────────────────
const navTabs      = document.getElementById('navTabs');
const shell        = document.querySelector('.shell');
const loginView    = document.getElementById('loginView');
const appView      = document.getElementById('appView');
const loginForm    = document.getElementById('loginForm');
const loginMsg     = document.getElementById('loginMsg');
const moduleCard   = document.getElementById('moduleCard');
const statsBox     = document.getElementById('statsBox');
const searchInput  = document.getElementById('searchInput');
const searchResults= document.getElementById('searchResults');
const heroPanel    = document.getElementById('dashboardHero');
const searchPanel  = document.getElementById('dashboardSearchCard');
const btnLogout    = document.getElementById('btnLogout');
const btnBackup    = document.getElementById('btnBackup');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');

// ── API HELPER ────────────────────────────────────────────────────────────────
function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(`/api${path}`, { ...options, headers }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Error inesperado');
    return payload;
  });
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatMoney(n) {
  return `Q ${parseFloat(n || 0).toFixed(2)}`;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showRescheduleModal(defaultValue = '') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="rescheduleTitle">
        <h3 id="rescheduleTitle">Reprogramar cita</h3>
        <p class="muted">Selecciona la nueva fecha y hora para el paciente.</p>
        <form id="rescheduleForm" class="form-grid">
          <label>
            Nueva fecha y hora
            <input id="rescheduleDateInput" name="scheduledAt" type="datetime-local" required>
          </label>
          <div class="modal-actions">
            <button type="button" class="ghost" data-cancel-reschedule>Cancelar</button>
            <button type="submit">Guardar cambio</button>
          </div>
        </form>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');

    const input = backdrop.querySelector('#rescheduleDateInput');
    const form = backdrop.querySelector('#rescheduleForm');
    const cancelBtn = backdrop.querySelector('[data-cancel-reschedule]');

    const close = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      backdrop.remove();
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(null);
    };

    document.addEventListener('keydown', onKeyDown);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null);
    });

    cancelBtn.addEventListener('click', () => close(null));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.value) return;
      close(input.value);
    });

    input.value = defaultValue;
    setTimeout(() => input.focus(), 0);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function printAppointmentTicket(appointmentId) {
  const appointment = state.appointments.find(a => a.id === Number(appointmentId));
  if (!appointment) {
    alert('No se encontró la cita para imprimir.');
    return;
  }

  const patient = state.patients.find(p => p.id === appointment.patientId);
  const doctor = state.users.find(u => u.id === appointment.doctorUserId);
  const createdAt = new Date().toLocaleString('es-ES');
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'No disponible';
  const patientRecord = patient?.medicalRecordNumber || '-';
  const doctorName = doctor?.fullName || 'Por asignar';

  const printableHtml = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Comprobante de cita</title>
      <style>
        @page {
          size: 5.5in 8.5in;
          margin: 0.35in;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #143245;
          background: #fff;
        }
        .ticket {
          width: 100%;
          min-height: 100%;
          border: 1.5px solid #9ec2d6;
          border-radius: 10px;
          padding: 14px;
        }
        .header {
          border-bottom: 1px solid #c5dceb;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 3px;
        }
        .sub {
          color: #4c6a7a;
          font-size: 12px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 10px;
          margin-top: 8px;
        }
        .field {
          border: 1px solid #d3e4ef;
          border-radius: 8px;
          padding: 7px;
        }
        .label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #4f7082;
          margin-bottom: 4px;
          font-weight: 700;
        }
        .value {
          font-size: 13px;
          color: #123447;
          font-weight: 600;
          word-break: break-word;
        }
        .full {
          grid-column: 1 / -1;
        }
        .footer {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed #b3cbdb;
          display: grid;
          gap: 14px;
        }
        .line {
          border-top: 1px solid #8fb0c3;
          width: 100%;
          margin-top: 18px;
          padding-top: 4px;
          font-size: 11px;
          color: #4c6b7c;
          text-align: center;
        }
        .note {
          font-size: 11px;
          color: #4b6b7b;
          line-height: 1.35;
        }
      </style>
    </head>
    <body>
      <section class="ticket">
        <header class="header">
          <h1>Clínica Médica - Comprobante de cita</h1>
          <div class="sub">Emitido: ${escapeHtml(createdAt)} | ID cita: ${escapeHtml(appointment.id)}</div>
        </header>

        <div class="grid">
          <div class="field">
            <span class="label">Paciente</span>
            <span class="value">${escapeHtml(patientName)}</span>
          </div>
          <div class="field">
            <span class="label">Nro. historia</span>
            <span class="value">${escapeHtml(patientRecord)}</span>
          </div>
          <div class="field">
            <span class="label">Fecha y hora</span>
            <span class="value">${escapeHtml(formatDate(appointment.scheduledAt))}</span>
          </div>
          <div class="field">
            <span class="label">Médico</span>
            <span class="value">${escapeHtml(doctorName)}</span>
          </div>
          <div class="field full">
            <span class="label">Motivo</span>
            <span class="value">${escapeHtml(appointment.reason || '-')}</span>
          </div>
          <div class="field full">
            <span class="label">Notas</span>
            <span class="value">${escapeHtml(appointment.notes || 'Sin observaciones.')}</span>
          </div>
          <div class="field">
            <span class="label">Estado</span>
            <span class="value">${escapeHtml(appointment.status || '-')}</span>
          </div>
        </div>

        <div class="footer">
          <p class="note">Presentar este comprobante el dia de la cita. Llegar al menos 15 minutos antes para registro en recepcion.</p>
          <div class="line">Firma o sello de recepción</div>
        </div>
      </section>
      <script>
        window.addEventListener('load', () => {
          window.print();
        });
      </script>
    </body>
    </html>`;

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.setAttribute('aria-hidden', 'true');

  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    printFrame.remove();
    alert('No fue posible preparar la impresion. Intenta de nuevo.');
    return;
  }

  frameDoc.open();
  frameDoc.write(printableHtml);
  frameDoc.close();

  const cleanup = () => {
    setTimeout(() => printFrame.remove(), 600);
  };

  const frameWindow = printFrame.contentWindow;
  if (frameWindow) {
    frameWindow.onafterprint = cleanup;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
    }, 120);
  } else {
    cleanup();
  }
}

function printPaymentTicket(paymentId) {
  const payment = state.payments.find(p => p.id === Number(paymentId));
  if (!payment) {
    alert('No se encontró el pago para imprimir.');
    return;
  }

  const patient = state.patients.find(p => p.id === payment.patientId);
  const appointment = state.appointments.find(a => a.id === payment.appointmentId);
  const createdAt = new Date().toLocaleString('es-ES');
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'No disponible';
  const patientRecord = patient?.medicalRecordNumber || '-';
  const relatedAppointment = appointment ? formatDate(appointment.scheduledAt) : 'No vinculada';

  const printableHtml = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Comprobante de pago</title>
      <style>
        @page {
          size: 5.5in 8.5in;
          margin: 0.35in;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #143245;
          background: #fff;
        }
        .ticket {
          width: 100%;
          min-height: 100%;
          border: 1.5px solid #9ec2d6;
          border-radius: 10px;
          padding: 14px;
        }
        .header {
          border-bottom: 1px solid #c5dceb;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 3px;
        }
        .sub {
          color: #4c6a7a;
          font-size: 12px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 10px;
          margin-top: 8px;
        }
        .field {
          border: 1px solid #d3e4ef;
          border-radius: 8px;
          padding: 7px;
        }
        .label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #4f7082;
          margin-bottom: 4px;
          font-weight: 700;
        }
        .value {
          font-size: 13px;
          color: #123447;
          font-weight: 600;
          word-break: break-word;
        }
        .full {
          grid-column: 1 / -1;
        }
        .footer {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed #b3cbdb;
          display: grid;
          gap: 14px;
        }
        .line {
          border-top: 1px solid #8fb0c3;
          width: 100%;
          margin-top: 18px;
          padding-top: 4px;
          font-size: 11px;
          color: #4c6b7c;
          text-align: center;
        }
        .note {
          font-size: 11px;
          color: #4b6b7b;
          line-height: 1.35;
        }
      </style>
    </head>
    <body>
      <section class="ticket">
        <header class="header">
          <h1>Clínica Médica - Comprobante de pago</h1>
          <div class="sub">Emitido: ${escapeHtml(createdAt)} | Pago ID: ${escapeHtml(payment.id)} | Recibo: ${escapeHtml(payment.receiptNumber || '-')}</div>
        </header>

        <div class="grid">
          <div class="field">
            <span class="label">Paciente</span>
            <span class="value">${escapeHtml(patientName)}</span>
          </div>
          <div class="field">
            <span class="label">Nro. historia</span>
            <span class="value">${escapeHtml(patientRecord)}</span>
          </div>
          <div class="field">
            <span class="label">Monto pagado</span>
            <span class="value">${escapeHtml(formatMoney(payment.amount))}</span>
          </div>
          <div class="field">
            <span class="label">Metodo de pago</span>
            <span class="value">${escapeHtml(payment.paymentMethod || '-')}</span>
          </div>
          <div class="field">
            <span class="label">Estado</span>
            <span class="value">${escapeHtml(payment.status || '-')}</span>
          </div>
          <div class="field">
            <span class="label">Fecha de registro</span>
            <span class="value">${escapeHtml(formatDate(payment.createdAt))}</span>
          </div>
          <div class="field full">
            <span class="label">Cita vinculada</span>
            <span class="value">${escapeHtml(relatedAppointment)}</span>
          </div>
          <div class="field full">
            <span class="label">Notas</span>
            <span class="value">${escapeHtml(payment.notes || 'Sin observaciones.')}</span>
          </div>
        </div>

        <div class="footer">
          <p class="note">Conserva este comprobante para cualquier consulta administrativa o clinica relacionada con tu pago.</p>
          <div class="line">Firma o sello de caja</div>
        </div>
      </section>
    </body>
    </html>`;

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.setAttribute('aria-hidden', 'true');

  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    printFrame.remove();
    alert('No fue posible preparar la impresion. Intenta de nuevo.');
    return;
  }

  frameDoc.open();
  frameDoc.write(printableHtml);
  frameDoc.close();

  const cleanup = () => {
    setTimeout(() => printFrame.remove(), 600);
  };

  const frameWindow = printFrame.contentWindow;
  if (frameWindow) {
    frameWindow.onafterprint = cleanup;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
    }, 120);
  } else {
    cleanup();
  }
}

function printPatientHistoryReport(history) {
  if (!history || !history.patient) {
    alert('No hay historial disponible para imprimir.');
    return;
  }

  const patient = history.patient;
  const appointments = [...(history.appointments || [])].sort((a, b) => new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime());
  const encounters = [...(history.encounters || [])].sort((a, b) => new Date(b.visitDate || 0).getTime() - new Date(a.visitDate || 0).getTime());
  const treatments = [...(history.treatments || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const prescriptions = [...(history.prescriptions || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const payments = [...(history.payments || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const totalPaid = payments.filter(p => p.status === 'pagado').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status !== 'pagado').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const createdAt = new Date().toLocaleString('es-ES');
  const clinicName = 'Clínica Médica';
  const clinicAddress = 'Zona 1, 7a avenida 12-34, Ciudad';
  const clinicPhone = '(502) 2222-3333';
  const clinicEmail = 'contacto@clinicamedia.local';
  const clinicHours = 'Lun-Vie 08:00-17:00 · Sáb 08:00-12:00';

  const listItems = (items, itemRenderer, fallback = 'Sin registros') => {
    if (!items.length) return `<li>${fallback}</li>`;
    return items.slice(0, 8).map(itemRenderer).join('');
  };

  const printableHtml = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Historial clínico</title>
      <style>
        @page {
          size: 5.5in 8.5in;
          margin: 0.35in;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #143245;
          background: #fff;
        }
        .sheet {
          border: 1.5px solid #9ec2d6;
          border-radius: 10px;
          padding: 12px;
        }
        .header-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid #c5dceb;
        }
        .brand-mark {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          flex: 0 0 46px;
          background: linear-gradient(140deg, #1263dc, #0f8b8d);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 16px rgba(18, 99, 220, 0.18);
        }
        .brand-mark svg {
          width: 26px;
          height: 26px;
          display: block;
        }
        .brand-copy {
          flex: 1;
          min-width: 0;
        }
        h1 {
          margin: 0 0 4px;
          font-size: 18px;
        }
        h2 {
          margin: 10px 0 6px;
          font-size: 13px;
          color: #194760;
        }
        .sub {
          font-size: 11px;
          color: #4d6c7c;
          margin-bottom: 8px;
        }
        .clinic-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 2px 10px;
          font-size: 10px;
          color: #4f7082;
          line-height: 1.25;
          margin-top: 2px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 4px;
        }
        .box {
          border: 1px solid #d1e3ee;
          border-radius: 8px;
          padding: 7px;
          font-size: 11px;
        }
        .label {
          color: #527487;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }
        ul {
          margin: 4px 0 0;
          padding-left: 16px;
        }
        li {
          margin-bottom: 3px;
          font-size: 11px;
          line-height: 1.3;
        }
        .cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .signature-area {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: end;
        }
        .signature-box {
          border: 1px solid #d1e3ee;
          border-radius: 8px;
          min-height: 72px;
          padding: 7px;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .signature-line {
          margin-top: 22px;
          border-top: 1px solid #8fb0c3;
          padding-top: 4px;
          text-align: center;
          color: #4c6b7c;
          font-size: 11px;
        }
        .stamp-box {
          border: 2px dashed #9ec2d6;
          border-radius: 10px;
          min-height: 72px;
          padding: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #5d7a8c;
          font-size: 11px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <section class="sheet">
        <div class="header-wrap">
          <div class="brand-mark" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#1263dc"/>
              <path d="M28 14h8v14h14v8H36v14h-8V36H14v-8h14z" fill="#ffffff"/>
            </svg>
          </div>
          <div class="brand-copy">
            <h1>${escapeHtml(clinicName)} - Historial clínico</h1>
            <div class="sub">Emitido: ${escapeHtml(createdAt)} · Paciente: ${escapeHtml(patient.firstName || '')} ${escapeHtml(patient.lastName || '')}</div>
            <div class="clinic-meta">
              <span>Dirección: ${escapeHtml(clinicAddress)}</span>
              <span>Tel: ${escapeHtml(clinicPhone)}</span>
              <span>Correo: ${escapeHtml(clinicEmail)}</span>
              <span>Horario: ${escapeHtml(clinicHours)}</span>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="box"><div class="label">Historia</div>${escapeHtml(patient.medicalRecordNumber || '-')}</div>
          <div class="box"><div class="label">Documento</div>${escapeHtml(patient.documentId || '-')}</div>
          <div class="box"><div class="label">Nacimiento / Genero</div>${escapeHtml(patient.birthDate || '-')} · ${escapeHtml(patient.gender || '-')}</div>
          <div class="box"><div class="label">Contacto</div>${escapeHtml(patient.phone || '-')} · ${escapeHtml(patient.email || '-')}</div>
          <div class="box"><div class="label">Alergias</div>${escapeHtml(patient.allergies || 'Ninguna registrada')}</div>
          <div class="box"><div class="label">Saldo pendiente</div>${escapeHtml(formatMoney(totalPending))}</div>
          <div class="box"><div class="label">Total pagado</div>${escapeHtml(formatMoney(totalPaid))}</div>
          <div class="box"><div class="label">Resumen</div>Citas ${appointments.length} · Consultas ${encounters.length} · Recetas ${prescriptions.length}</div>
        </div>

        <div class="cols">
          <div class="box">
            <h2>Últimas citas</h2>
            <ul>${listItems(appointments, a => `<li>${escapeHtml(formatDate(a.scheduledAt))} · ${escapeHtml(a.reason || '-')} · ${escapeHtml(a.status || '-')}</li>`)}</ul>
          </div>
          <div class="box">
            <h2>Últimas consultas</h2>
            <ul>${listItems(encounters, e => `<li>${escapeHtml(formatDate(e.visitDate))} · Dx: ${escapeHtml(e.diagnosis || '-')}</li>`)}</ul>
          </div>
        </div>

        <div class="cols">
          <div class="box">
            <h2>Tratamientos</h2>
            <ul>${listItems(treatments, t => `<li>${escapeHtml(t.name || '-')} · ${escapeHtml(t.dosage || '-')} · hasta ${escapeHtml(t.endDate || 'Activo')}</li>`)}</ul>
          </div>
          <div class="box">
            <h2>Recetas</h2>
            <ul>${listItems(prescriptions, p => `<li>${escapeHtml(formatDate(p.createdAt))} · ${escapeHtml(p.medication || '-')} (${escapeHtml(p.dose || '-')})</li>`)}</ul>
          </div>
        </div>

        <div class="signature-area">
          <div class="signature-box">
            <div><strong>Observaciones médicas:</strong></div>
            <div style="margin-top:6px">Espacio para anotaciones adicionales, indicaciones o seguimiento posterior.</div>
            <div class="signature-line">Firma y sello del médico tratante</div>
          </div>
          <div class="stamp-box">Sello institucional<br>${escapeHtml(clinicName)}</div>
        </div>
      </section>
    </body>
    </html>`;

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.setAttribute('aria-hidden', 'true');

  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    printFrame.remove();
    alert('No fue posible preparar la impresion. Intenta de nuevo.');
    return;
  }

  frameDoc.open();
  frameDoc.write(printableHtml);
  frameDoc.close();

  const cleanup = () => {
    setTimeout(() => printFrame.remove(), 600);
  };

  const frameWindow = printFrame.contentWindow;
  if (frameWindow) {
    frameWindow.onafterprint = cleanup;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
    }, 120);
  } else {
    cleanup();
  }
}

// ── RENDER BASE ───────────────────────────────────────────────────────────────
function renderLoginState() {
  const loggedIn = Boolean(state.user);
  loginView.hidden = loggedIn;
  appView.hidden = !loggedIn;
  btnLogout.hidden = !loggedIn;
  btnBackup.hidden = !loggedIn || !can('backup.create');
}

function renderTabs() {
  navTabs.innerHTML = '';
  const availableTabs = tabs.filter(canAccessTab);
  if (!availableTabs.some(t => t.id === state.activeModule)) {
    state.activeModule = availableTabs[0]?.id || 'dashboard';
  }
  availableTabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="nav-icon">${tab.icon || tab.label.charAt(0)}</span><span class="nav-label">${tab.label}</span><span class="nav-chevron">&gt;</span>`;
    btn.title = tab.label;
    btn.className = state.activeModule === tab.id ? 'active' : '';
    btn.addEventListener('click', () => { state.activeModule = tab.id; renderTabs(); renderModule(); });
    navTabs.appendChild(btn);
  });
}

function renderStats(stats) {
  statsBox.innerHTML = `
    <div class="stat"><div class="pill">Pacientes</div><h3>${stats.patients ?? 0}</h3></div>
    <div class="stat"><div class="pill">Citas hoy</div><h3>${stats.appointments_pending ?? 0}</h3></div>
    <div class="stat"><div class="pill">Cobros pendientes</div><h3>${stats.payments_pending ?? 0}</h3></div>
    <div class="stat"><div class="pill">Total cobrado</div><h3>${formatMoney(stats.total_collected)}</h3></div>
    <div class="stat"><div class="pill">Usuarios</div><h3>${stats.users ?? 0}</h3></div>
  `;
}

function patientLabel(p) {
  return `${p.lastName}, ${p.firstName} (${p.medicalRecordNumber})`;
}

function optionList(records, labelFn, valueKey = 'id') {
  return records.map(r => `<option value="${r[valueKey]}">${labelFn(r)}</option>`).join('');
}

function getDefaultPermissionsForRole(role) {
  const defaults = ROLE_PERMISSION_DEFAULTS[role] || [];
  if (defaults.includes('*')) {
    return PERMISSION_GROUPS.flatMap(g => g.items.map(([perm]) => perm));
  }
  return [...defaults];
}

function renderPermissionChecklist(selected = [], name = 'permissions') {
  const selectedSet = new Set(selected);
  return `
    <div class="permissions-grid">
      ${PERMISSION_GROUPS.map(group => `
        <fieldset class="perm-group">
          <legend>${group.label}</legend>
          ${group.items.map(([perm, label]) => `
            <label class="perm-item">
              <input type="checkbox" name="${name}" value="${perm}" ${selectedSet.has(perm) ? 'checked' : ''}>
              <span>${label}</span>
            </label>
          `).join('')}
        </fieldset>
      `).join('')}
    </div>`;
}

function collectSelectedPermissions(container, inputName = 'permissions') {
  return [...container.querySelectorAll(`input[name="${inputName}"]:checked`)].map(el => el.value);
}

function applyPermissionSelection(container, selected, inputName = 'permissions') {
  const set = new Set(selected);
  container.querySelectorAll(`input[name="${inputName}"]`).forEach((el) => {
    el.checked = set.has(el.value);
  });
}

function showPermissionsModal(userRow) {
  const roleDefaults = getDefaultPermissionsForRole(userRow.role);
  const currentPermissions = Array.isArray(userRow.permissions) && userRow.permissions.length ? userRow.permissions : roleDefaults;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-card modal-card-lg" role="dialog" aria-modal="true" aria-labelledby="permTitle">
        <h3 id="permTitle">Permisos de ${escapeHtml(userRow.fullName)}</h3>
        <p class="muted">Selecciona qué puede ver y gestionar este usuario.</p>
        <form id="permEditForm" class="form-grid">
          ${renderPermissionChecklist(currentPermissions, 'permEdit')}
          <div class="modal-actions">
            <button type="button" class="ghost" data-restore-role>Restaurar por rol</button>
            <button type="button" class="ghost" data-cancel-perm>Cerrar</button>
            <button type="submit">Guardar permisos</button>
          </div>
        </form>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');

    const form = backdrop.querySelector('#permEditForm');
    const cancelBtn = backdrop.querySelector('[data-cancel-perm]');
    const restoreBtn = backdrop.querySelector('[data-restore-role]');

    const close = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      backdrop.remove();
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(null);
    };

    document.addEventListener('keydown', onKeyDown);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null);
    });

    cancelBtn.addEventListener('click', () => close(null));
    restoreBtn.addEventListener('click', () => applyPermissionSelection(form, roleDefaults, 'permEdit'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      close(collectSelectedPermissions(form, 'permEdit'));
    });
  });
}

function makeTable(columns, rows, actionsBuilder = null, paginationKey = '') {
  const tpl = document.getElementById('listTemplate');
  const frag = tpl.content.cloneNode(true);
  const thead = frag.querySelector('thead');
  const tbody = frag.querySelector('tbody');

  let visibleRows = rows;
  let pagerHtml = '';

  if (paginationKey) {
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const current = Math.min(Math.max(state.tablePage[paginationKey] || 1, 1), totalPages);
    state.tablePage[paginationKey] = current;
    const start = total === 0 ? 0 : (current - 1) * state.pageSize + 1;
    const end = Math.min(current * state.pageSize, total);
    visibleRows = rows.slice((current - 1) * state.pageSize, current * state.pageSize);

    pagerHtml = `
      <div class="table-pager">
        <span class="muted small">Mostrando ${start}-${end} de ${total}</span>
        <div class="pager-actions">
          <button type="button" class="ghost" data-page-prev="${paginationKey}" ${current <= 1 ? 'disabled' : ''}>Anterior</button>
          <span class="muted small">Página ${current} de ${totalPages}</span>
          <button type="button" class="ghost" data-page-next="${paginationKey}" ${current >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>`;
  }

  thead.innerHTML = `<tr>${columns.map(c => `<th>${c.label}</th>`).join('')}${actionsBuilder ? '<th>Acciones</th>' : ''}</tr>`;
  tbody.innerHTML = visibleRows.map(row => {
    const cells = columns.map(c => `<td>${c.render(row)}</td>`).join('');
    const actions = actionsBuilder ? `<td>${actionsBuilder(row)}</td>` : '';
    return `<tr>${cells}${actions}</tr>`;
  }).join('');

  if (pagerHtml) {
    const wrapper = frag.querySelector('.table-wrap');
    wrapper.insertAdjacentHTML('beforeend', pagerHtml);
  }

  return frag;
}

function moduleHeader(title, subtitle = '') {
  return `<div class="section-head"><div><h2>${title}</h2><p class="muted">${subtitle}</p></div></div>`;
}

function renderSearchResults(results) {
  const items = [];
  if (results.patients?.length)
    items.push(`<div><div class="pill">Pacientes</div><div class="stack">${results.patients.map(p => `<div class="module-box small">${patientLabel(p)}</div>`).join('')}</div></div>`);
  if (results.appointments?.length)
    items.push(`<div><div class="pill">Citas</div><div class="stack">${results.appointments.map(a => `<div class="module-box small">${formatDate(a.scheduledAt)} · ${a.reason} · ${a.status}</div>`).join('')}</div></div>`);
  if (results.encounters?.length)
    items.push(`<div><div class="pill">Consultas</div><div class="stack">${results.encounters.map(e => `<div class="module-box small">${formatDate(e.visitDate)} · ${e.diagnosis || e.complaint || '-'}</div>`).join('')}</div></div>`);
  searchResults.innerHTML = items.length ? items.join('') : '<p class="muted">Sin resultados.</p>';
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  moduleCard.innerHTML = `
    ${moduleHeader('Inicio', 'Estado general del sistema.')}
    <div class="module-layout">
      <div class="module-box">
        <h3>Bienvenido, ${state.user?.fullName || 'Usuario'}</h3>
        <p class="muted">Sistema de gestión clínica. Rol activo: <strong>${state.user?.role}</strong></p>
        <ul>
          <li>Gestión de pacientes y expedientes</li>
          <li>Citas médicas con agenda por médico</li>
          <li>Historial clínico completo</li>
          <li>Módulo de pagos y comprobantes</li>
          <li>Farmacia e inventario de medicamentos</li>
          <li>Auditoría y respaldo de datos</li>
        </ul>
      </div>
      <div class="module-box">
        <h3>Roles del sistema</h3>
        <p><span class="pill">Administrador</span> Acceso total al sistema.</p>
        <p><span class="pill">Médico</span> Pacientes, citas, historial, recetas.</p>
        <p><span class="pill">Enfermera</span> Pacientes, citas, tratamientos.</p>
        <p><span class="pill">Recepcionista</span> Pacientes, citas, pagos.</p>
        <p class="muted" style="margin-top:12px">Usuario inicial: admin / Admin123!</p>
      </div>
    </div>`;
}

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadUsers(role = '') {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  state.users = await api(`/users${query}`);
}
async function loadPatients()      { state.patients      = await api('/patients'); }
async function loadAppointments()  { state.appointments  = await api('/appointments'); }
async function loadEncounters()    { state.encounters    = await api('/encounters'); }
async function loadTreatments()    { state.treatments    = await api('/treatments'); }
async function loadPrescriptions() { state.prescriptions = await api('/prescriptions'); }
async function loadPayments()      { state.payments      = await api('/payments'); }
async function loadMedications()   { state.medications   = await api('/medications'); }
async function loadAudit()         { state.audit         = await api('/audit'); }

// ── USUARIOS ──────────────────────────────────────────────────────────────────
function renderUsers() {
  const defaultRole = 'administrador';
  const defaultPermissions = getDefaultPermissionsForRole(defaultRole);
  const form = `
    <div class="module-box">
      <h3>Crear usuario</h3>
      <form id="userForm" class="form-grid">
        <input name="username"  placeholder="Usuario"         required>
        <input name="password"  placeholder="Contraseña"      type="password" required>
        <input name="fullName"  placeholder="Nombre completo" required>
        <select name="role" required>
          <option value="administrador">Administrador</option>
          <option value="medico">Médico</option>
          <option value="enfermera">Enfermera</option>
          <option value="recepcionista">Recepcionista</option>
        </select>
        <input name="specialty" placeholder="Especialidad (médicos)">
        <div>
          <p class="muted small" style="margin-bottom:0.4rem">Permisos de este usuario</p>
          ${renderPermissionChecklist(defaultPermissions, 'permissions')}
        </div>
        <button type="submit">Guardar</button>
      </form>
      <div id="userMsg" class="msg"></div>
    </div>`;
  const table = makeTable([
    { label: 'Usuario',       render: r => r.username },
    { label: 'Nombre',        render: r => r.fullName },
    { label: 'Rol',           render: r => `<span class="pill">${r.role}</span>` },
    { label: 'Permisos',      render: r => (Array.isArray(r.permissions) && r.permissions.length) ? r.permissions.length : 'Por rol' },
    { label: 'Especialidad',  render: r => r.specialty || '-' },
    { label: 'Activo',        render: r => r.active ? 'Sí' : 'No' },
  ], state.users, r => `<div class="actions"><button data-edit-user-perms="${r.id}">Permisos</button><button data-delete-user="${r.id}">Borrar</button></div>`, 'users');
  moduleCard.innerHTML = `${moduleHeader('Usuarios', 'Gestión de usuarios y permisos.')}<div class="module-layout">${form}<div class="module-box"><h3>Listado</h3></div></div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(table);
  bindUserForm();
  bindUserActions();
}

// ── PACIENTES ─────────────────────────────────────────────────────────────────
function renderPatients() {
  const form = `
    <div class="module-box">
      <h3>Nuevo paciente</h3>
      <form id="patientForm" class="form-grid">
        <input name="medicalRecordNumber" placeholder="Nro. historia"       required>
        <input name="firstName"           placeholder="Nombres"             required>
        <input name="lastName"            placeholder="Apellidos"           required>
        <input name="documentId"          placeholder="DPI / Documento">
        <input name="birthDate"           type="date">
        <select name="gender">
          <option value="">Género</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
          <option value="Otro">Otro</option>
        </select>
        <input name="phone"   placeholder="Teléfono">
        <input name="email"   type="email" placeholder="Correo">
        <textarea name="address"   placeholder="Dirección"></textarea>
        <textarea name="allergies" placeholder="Alergias"></textarea>
        <textarea name="notes"     placeholder="Notas"></textarea>
        <button type="submit">Guardar</button>
      </form>
      <div id="patientMsg" class="msg"></div>
    </div>`;
  const table = makeTable([
    { label: 'Historia',   render: r => r.medicalRecordNumber },
    { label: 'Paciente',   render: r => `${r.lastName}, ${r.firstName}` },
    { label: 'DPI',        render: r => r.documentId || '-' },
    { label: 'Teléfono',   render: r => r.phone || '-' },
    { label: 'Correo',     render: r => r.email || '-' },
  ], state.patients, r => `
    <div class="actions">
      <button data-history="${r.id}">Historial</button>
      <button class="danger" data-delete-patient="${r.id}">Borrar</button>
    </div>`, 'patients');
  moduleCard.innerHTML = `${moduleHeader('Pacientes', 'Registro y gestión de pacientes.')}<div class="module-layout">${form}<div class="module-box"><h3>Listado</h3></div></div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(table);
  bindPatientForm();
  bindPatientActions();
}

// ── HISTORIAL ─────────────────────────────────────────────────────────────────
function renderHistory() {
  const options = optionList(state.patients, patientLabel);
  moduleCard.innerHTML = `
    ${moduleHeader('Historial clínico', 'Expediente completo por paciente.')}
    <div class="module-layout">
      <div class="module-box">
        <form id="historyForm" class="form-grid">
          <select name="patientId" required>
            <option value="">Selecciona paciente</option>${options}
          </select>
          <button type="submit">Cargar historial</button>
        </form>
        <div id="historyMsg" class="msg"></div>
      </div>
      <div class="module-box" id="historyResult">
        <p class="muted">Elige un paciente para ver su historial.</p>
      </div>
    </div>`;
  bindHistoryForm();
}

// ── CITAS ─────────────────────────────────────────────────────────────────────
function renderAppointments() {
  const patOpts = optionList(state.patients, patientLabel);
  const docOpts = optionList(state.users.filter(u => u.role === 'medico'), u => `${u.fullName}${u.specialty ? ' – '+u.specialty : ''}`);
  moduleCard.innerHTML = `
    ${moduleHeader('Citas', 'Programar, reprogramar y cancelar citas médicas.')}
    <div class="module-layout">
      <div class="module-box">
        <h3>Nueva cita</h3>
        <form id="appointmentForm" class="form-grid">
          <select name="patientId" required><option value="">Paciente</option>${patOpts}</select>
          <select name="doctorUserId"><option value="">Médico (opcional)</option>${docOpts}</select>
          <input name="scheduledAt" type="datetime-local" required>
          <input name="reason" placeholder="Motivo" required>
          <select name="status">
            <option value="programada">Programada</option>
            <option value="confirmada">Confirmada</option>
            <option value="atendida">Atendida</option>
            <option value="cancelada">Cancelada</option>
            <option value="reprogramada">Reprogramada</option>
          </select>
          <textarea name="notes" placeholder="Notas"></textarea>
          <button type="submit">Guardar</button>
        </form>
        <div id="appointmentMsg" class="msg"></div>
      </div>
      <div class="module-box"><h3>Listado de citas</h3></div>
    </div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(makeTable([
    { label: 'Fecha',    render: r => formatDate(r.scheduledAt) },
    { label: 'Paciente', render: r => state.patients.find(p => p.id === r.patientId)?.lastName || r.patientId },
    { label: 'Médico',   render: r => state.users.find(u => u.id === r.doctorUserId)?.fullName || '-' },
    { label: 'Motivo',   render: r => r.reason },
    { label: 'Estado',   render: r => `<span class="pill">${r.status}</span>` },
  ], state.appointments, r => `
    <div class="actions">
      <button data-print-appointment="${r.id}">Imprimir</button>
      <button data-reschedule="${r.id}">Reprogramar</button>
      <button data-cancel-apt="${r.id}">Cancelar</button>
      <button class="danger" data-delete-appointment="${r.id}">Borrar</button>
    </div>`, 'appointments'));
  bindAppointmentForm();
  bindAppointmentActions();
}

// ── TRATAMIENTOS ──────────────────────────────────────────────────────────────
function renderTreatments() {
  const options = optionList(state.patients, patientLabel);
  moduleCard.innerHTML = `
    ${moduleHeader('Tratamientos', 'Tratamientos y seguimiento clínico.')}
    <div class="module-layout">
      <div class="module-box">
        <form id="treatmentForm" class="form-grid">
          <select name="patientId" required><option value="">Paciente</option>${options}</select>
          <input name="name"      placeholder="Tratamiento"  required>
          <input name="dosage"    placeholder="Dosis">
          <input name="frequency" placeholder="Frecuencia">
          <input name="startDate" type="date">
          <input name="endDate"   type="date">
          <textarea name="notes"  placeholder="Notas"></textarea>
          <button type="submit">Guardar</button>
        </form>
        <div id="treatmentMsg" class="msg"></div>
      </div>
      <div class="module-box"><h3>Listado</h3></div>
    </div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(makeTable([
    { label: 'Paciente',   render: r => state.patients.find(p => p.id === r.patientId)?.medicalRecordNumber || r.patientId },
    { label: 'Tratamiento',render: r => r.name },
    { label: 'Dosis',      render: r => r.dosage || '-' },
    { label: 'Frecuencia', render: r => r.frequency || '-' },
    { label: 'Inicio',     render: r => r.startDate || '-' },
    { label: 'Fin',        render: r => r.endDate || '-' },
  ], state.treatments, r => `<div class="actions"><button class="danger" data-delete-treatment="${r.id}">Borrar</button></div>`, 'treatments'));
  bindTreatmentForm();
  bindTreatmentActions();
}

// ── RECETAS ───────────────────────────────────────────────────────────────────
function renderPrescriptions() {
  const patOpts = optionList(state.patients, patientLabel);
  const medOpts = optionList(state.medications, m => `${m.name} (stock: ${m.stock})`);
  moduleCard.innerHTML = `
    ${moduleHeader('Recetas', 'Prescripción farmacológica.')}
    <div class="module-layout">
      <div class="module-box">
        <form id="prescriptionForm" class="form-grid">
          <select name="patientId" required><option value="">Paciente</option>${patOpts}</select>
          <input name="medication" list="medList" placeholder="Medicamento" required>
          <datalist id="medList">${medOpts.replace(/value="[^"]*"/g, m => m.replace(/value="(\d+)"/, (_, id) => `value="${state.medications.find(x => x.id == id)?.name || id}"`))}</datalist>
          <input name="dose" placeholder="Dosis">
          <textarea name="instructions" placeholder="Indicaciones"></textarea>
          <button type="submit">Guardar</button>
        </form>
        <div id="prescriptionMsg" class="msg"></div>
      </div>
      <div class="module-box"><h3>Listado</h3></div>
    </div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(makeTable([
    { label: 'Paciente',    render: r => state.patients.find(p => p.id === r.patientId)?.medicalRecordNumber || r.patientId },
    { label: 'Medicamento', render: r => r.medication },
    { label: 'Dosis',       render: r => r.dose || '-' },
    { label: 'Indicaciones',render: r => r.instructions || '-' },
    { label: 'Fecha',       render: r => formatDate(r.createdAt) },
  ], state.prescriptions, r => `<div class="actions"><button class="danger" data-delete-prescription="${r.id}">Borrar</button></div>`, 'prescriptions'));
  bindPrescriptionForm();
  bindPrescriptionActions();
}

// ── PAGOS ─────────────────────────────────────────────────────────────────────
function renderPayments() {
  const patOpts = optionList(state.patients, patientLabel);
  const pendingApts = state.appointments.filter(a => a.status !== 'cancelada');
  const aptOpts = optionList(pendingApts, a => {
    const pat = state.patients.find(p => p.id === a.patientId);
    return `${pat ? pat.lastName : a.patientId} – ${formatDate(a.scheduledAt)} (${a.status})`;
  });
  moduleCard.innerHTML = `
    ${moduleHeader('Pagos', 'Gestión de pagos, comprobantes y cobros pendientes.')}
    <div class="module-layout">
      <div class="module-box">
        <h3>Registrar pago</h3>
        <form id="paymentForm" class="form-grid">
          <select name="patientId" required><option value="">Paciente</option>${patOpts}</select>
          <select name="appointmentId"><option value="">Cita vinculada (opcional)</option>${aptOpts}</select>
          <input name="amount" type="number" step="0.01" placeholder="Monto (Q)" required>
          <select name="paymentMethod" required>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <select name="status">
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
          <textarea name="notes" placeholder="Notas"></textarea>
          <button type="submit">Guardar</button>
        </form>
        <div id="paymentMsg" class="msg"></div>
      </div>
      <div class="module-box"><h3>Listado de pagos</h3></div>
    </div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(makeTable([
    { label: 'Recibo',   render: r => `<code style="font-size:11px">${r.receiptNumber || '-'}</code>` },
    { label: 'Paciente', render: r => state.patients.find(p => p.id === r.patientId)?.medicalRecordNumber || r.patientId },
    { label: 'Monto',    render: r => formatMoney(r.amount) },
    { label: 'Método',   render: r => r.paymentMethod },
    { label: 'Estado',   render: r => `<span class="pill" style="${r.status==='pagado'?'background:var(--success,#2a9d3a);color:#fff':''}">${r.status}</span>` },
    { label: 'Fecha',    render: r => formatDate(r.createdAt) },
  ], state.payments, r => `
    <div class="actions">
      <button data-print-payment="${r.id}">Imprimir</button>
      ${r.status === 'pendiente' ? `<button data-pay-now="${r.id}">Marcar pagado</button>` : ''}
      <button class="danger" data-delete-payment="${r.id}">Borrar</button>
    </div>`, 'payments'));
  bindPaymentForm();
  bindPaymentActions();
}

// ── FARMACIA ──────────────────────────────────────────────────────────────────
function renderMedications() {
  moduleCard.innerHTML = `
    ${moduleHeader('Farmacia', 'Inventario de medicamentos.')}
    <div class="module-layout">
      <div class="module-box">
        <h3>Agregar medicamento</h3>
        <form id="medicationForm" class="form-grid">
          <input name="name"        placeholder="Nombre"      required>
          <input name="description" placeholder="Descripción">
          <input name="stock"       type="number" placeholder="Stock inicial" value="0">
          <input name="unit"        placeholder="Unidad (ej: tableta, ml)" value="unidad">
          <button type="submit">Guardar</button>
        </form>
        <div id="medicationMsg" class="msg"></div>
        <hr style="margin:16px 0">
        <h3>Ajustar stock</h3>
        <form id="stockForm" class="form-grid">
          <select name="medId" required>
            <option value="">Medicamento</option>
            ${optionList(state.medications, m => `${m.name} (stock: ${m.stock})`)}
          </select>
          <input name="delta" type="number" placeholder="Cantidad (+/-)  ej: -5 o +10" required>
          <button type="submit">Actualizar stock</button>
        </form>
        <div id="stockMsg" class="msg"></div>
      </div>
      <div class="module-box"><h3>Inventario</h3></div>
    </div>`;
  moduleCard.querySelector('.module-layout .module-box:last-child').appendChild(makeTable([
    { label: 'Nombre',      render: r => r.name },
    { label: 'Descripción', render: r => r.description || '-' },
    { label: 'Stock',       render: r => `<strong style="${r.stock < 5 ? 'color:red' : ''}">${r.stock}</strong>` },
    { label: 'Unidad',      render: r => r.unit },
  ], state.medications, r => `<div class="actions"><button class="danger" data-delete-med="${r.id}">Borrar</button></div>`, 'medications'));
  bindMedicationForm();
  bindMedicationActions();
}

// ── AUDITORÍA ─────────────────────────────────────────────────────────────────
function renderAudit() {
  moduleCard.innerHTML = `${moduleHeader('Auditoría', 'Registro de cambios en el sistema.')}<div class="module-box"></div>`;
  moduleCard.querySelector('.module-box').appendChild(makeTable([
    { label: 'Fecha',    render: r => formatDate(r.created_at) },
    { label: 'Acción',   render: r => `<span class="pill">${r.action}</span>` },
    { label: 'Entidad',  render: r => r.entity },
    { label: 'ID',       render: r => r.entity_id || '-' },
    { label: 'Detalle',  render: r => r.details_json ? `<small>${r.details_json}</small>` : '-' },
  ], state.audit, null, 'audit'));
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
function renderModule() {
  renderLoginState();
  const showDashboardPanels = state.activeModule === 'dashboard';
  if (appView) appView.dataset.module = state.activeModule;
  if (heroPanel) heroPanel.hidden = !showDashboardPanels;
  if (searchPanel) searchPanel.hidden = !showDashboardPanels || !can('search.read');
  switch (state.activeModule) {
    case 'users':         return renderUsers();
    case 'patients':      return renderPatients();
    case 'history':       return renderHistory();
    case 'appointments':  return renderAppointments();
    case 'treatments':    return renderTreatments();
    case 'prescriptions': return renderPrescriptions();
    case 'payments':      return renderPayments();
    case 'medications':   return renderMedications();
    case 'audit':         return renderAudit();
    default:              return renderDashboard();
  }
}

// ── REFRESH ───────────────────────────────────────────────────────────────────
async function refreshAll() {
  const tasks = [];

  if (can('patients.read')) tasks.push(loadPatients()); else state.patients = [];
  if (can('appointments.read')) tasks.push(loadAppointments()); else state.appointments = [];
  if (can('encounters.read')) tasks.push(loadEncounters()); else state.encounters = [];
  if (can('treatments.read')) tasks.push(loadTreatments()); else state.treatments = [];
  if (can('prescriptions.read')) tasks.push(loadPrescriptions()); else state.prescriptions = [];
  if (can('payments.read')) tasks.push(loadPayments()); else state.payments = [];
  if (can('medications.read')) tasks.push(loadMedications()); else state.medications = [];
  if (can('users.read.all')) {
    tasks.push(loadUsers());
  } else if (can('users.read.medics')) {
    tasks.push(loadUsers('medico'));
  } else {
    state.users = [];
  }
  if (can('audit.read')) tasks.push(loadAudit()); else state.audit = [];

  const results = await Promise.allSettled(tasks);
  if (can('stats.read')) {
    try { const stats = await api('/stats'); renderStats(stats); } catch {}
  } else {
    statsBox.innerHTML = `
      <div class="stat"><div class="pill">Estadísticas</div><h3>--</h3></div>
      <div class="stat"><div class="pill">Acceso</div><h3>Restringido</h3></div>`;
  }
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) console.error('Cargas fallidas:', failures.map(f => f.reason));
  renderTabs();
  renderModule();
  return failures;
}

// ── BIND FORMS ────────────────────────────────────────────────────────────────
function bindLogin() {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMsg.textContent = '';
    const fd = new FormData(loginForm);
    try {
      const payload = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
      state.token = payload.token;
      state.user  = payload.user;
      renderLoginState();
      renderTabs();
      renderModule();
      await refreshAll();
      renderLoginState();
    } catch (err) { loginMsg.textContent = err.message; }
  });
}

function bindLogout() {
  btnLogout.addEventListener('click', () => {
    state.token = ''; state.user = null; state.activeModule = 'dashboard';
    renderLoginState(); renderTabs();
  });
}

function bindBackup() {
  btnBackup.addEventListener('click', async () => {
    if (!can('backup.create')) return;
    await api('/backup', { method: 'POST' });
    alert('Respaldo generado correctamente.');
  });
}

function bindSidebarToggle() {
  if (!shell || !btnToggleSidebar) return;
  const collapsed = localStorage.getItem('clinic.sidebarCollapsed') === '1';
  setSidebarCollapsed(collapsed);
  btnToggleSidebar.addEventListener('click', () => {
    setSidebarCollapsed(!shell.classList.contains('sidebar-collapsed'));
  });
}

function bindSearch() {
  searchInput.addEventListener('input', async () => {
    if (!can('search.read')) {
      searchResults.innerHTML = '<p class="muted">No tienes permiso para buscar.</p>';
      return;
    }
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = '<p class="muted">Escribe para buscar.</p>'; return; }
    const results = await api(`/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(results);
  });
}

function bindTablePagination() {
  moduleCard.addEventListener('click', (e) => {
    const prevBtn = e.target.closest('[data-page-prev]');
    if (prevBtn) {
      const key = prevBtn.dataset.pagePrev;
      state.tablePage[key] = Math.max(1, (state.tablePage[key] || 1) - 1);
      renderModule();
      return;
    }

    const nextBtn = e.target.closest('[data-page-next]');
    if (nextBtn) {
      const key = nextBtn.dataset.pageNext;
      state.tablePage[key] = (state.tablePage[key] || 1) + 1;
      renderModule();
    }
  });
}

function bindUserForm() {
  const form = document.getElementById('userForm');
  const msg  = document.getElementById('userMsg');
  const roleSel = form.querySelector('select[name="role"]');
  const applyDefaultsByRole = () => {
    const role = roleSel.value;
    applyPermissionSelection(form, getDefaultPermissionsForRole(role), 'permissions');
  };

  roleSel.addEventListener('change', applyDefaultsByRole);
  applyDefaultsByRole();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      data.permissions = collectSelectedPermissions(form, 'permissions');
      await api('/users', { method: 'POST', body: JSON.stringify(data) });
      msg.textContent = 'Usuario creado.'; form.reset(); await refreshAll();
      applyDefaultsByRole();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindPatientForm() {
  const form = document.getElementById('patientForm');
  const msg  = document.getElementById('patientMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/patients', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      msg.textContent = 'Paciente guardado.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindHistoryForm() {
  const form   = document.getElementById('historyForm');
  const msg    = document.getElementById('historyMsg');
  const result = document.getElementById('historyResult');

  const sortByDateDesc = (items, field) => [...items].sort((a, b) => {
    const aT = new Date(a?.[field] || 0).getTime();
    const bT = new Date(b?.[field] || 0).getTime();
    return bT - aT;
  });

  const renderMiniTable = (title, headers, rows) => {
    if (!rows.length) {
      return `<div class="module-box"><h3>${title}</h3><p class="muted">Sin registros.</p></div>`;
    }
    return `
      <div class="module-box">
        <h3>${title}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const patientId = new FormData(form).get('patientId');
      const h = await api(`/patients/${patientId}/history`);

      const appointments = sortByDateDesc(h.appointments || [], 'scheduledAt');
      const encounters = sortByDateDesc(h.encounters || [], 'visitDate');
      const treatments = sortByDateDesc(h.treatments || [], 'createdAt');
      const prescriptions = sortByDateDesc(h.prescriptions || [], 'createdAt');
      const payments = sortByDateDesc(h.payments || [], 'createdAt');

      const now = Date.now();
      const nextAppointment = appointments
        .filter(a => a.scheduledAt && new Date(a.scheduledAt).getTime() >= now && a.status !== 'cancelada')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

      const activeTreatments = treatments.filter(t => {
        if (!t.endDate) return true;
        return new Date(t.endDate).getTime() >= now;
      });

      const latestDiagnosis = encounters.find(e => (e.diagnosis || '').trim());
      const totalPaid = payments
        .filter(p => p.status === 'pagado')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalPending = payments
        .filter(p => p.status !== 'pagado')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const appointmentsRows = appointments.slice(0, 5).map(a => `
        <tr>
          <td>${formatDate(a.scheduledAt)}</td>
          <td>${a.reason || '-'}</td>
          <td><span class="pill">${a.status || '-'}</span></td>
        </tr>`);

      const encountersRows = encounters.slice(0, 5).map(en => `
        <tr>
          <td>${formatDate(en.visitDate)}</td>
          <td>${en.complaint || '-'}</td>
          <td>${en.diagnosis || '-'}</td>
        </tr>`);

      const treatmentsRows = treatments.slice(0, 5).map(t => `
        <tr>
          <td>${t.name || '-'}</td>
          <td>${t.dosage || '-'}</td>
          <td>${t.endDate || 'Activo'}</td>
        </tr>`);

      const prescriptionsRows = prescriptions.slice(0, 5).map(p => `
        <tr>
          <td>${formatDate(p.createdAt)}</td>
          <td>${p.medication || '-'}</td>
          <td>${p.dose || '-'}</td>
        </tr>`);

      const paymentsRows = payments.slice(0, 5).map(p => `
        <tr>
          <td>${formatDate(p.createdAt)}</td>
          <td>${formatMoney(p.amount)}</td>
          <td><span class="pill">${p.status || '-'}</span></td>
        </tr>`);

      result.innerHTML = `
        <div class="stack">
          <div class="module-box">
            <h3>${patientLabel(h.patient)}</h3>
            <p class="muted">Género: ${h.patient.gender || '-'} · Fecha nac.: ${h.patient.birthDate || '-'} · Documento: ${h.patient.documentId || '-'}</p>
            <p class="muted">Alergias: ${h.patient.allergies || 'Ninguna registrada'}</p>
            <p class="muted">Contacto: ${h.patient.phone || '-'} · ${h.patient.email || '-'}</p>
            <p class="muted">Dirección: ${h.patient.address || '-'}</p>
            <div class="actions" style="margin-top:0.6rem">
              <button id="btnPrintHistory" type="button">Imprimir historial</button>
            </div>
          </div>

          <div class="module-layout">
            <div class="module-box small"><strong>Próxima cita:</strong><br>${nextAppointment ? `${formatDate(nextAppointment.scheduledAt)}<br>${nextAppointment.reason || '-'}` : 'Sin cita programada'}</div>
            <div class="module-box small"><strong>Último diagnóstico:</strong><br>${latestDiagnosis ? (latestDiagnosis.diagnosis || '-') : 'Sin diagnóstico registrado'}</div>
          </div>

          <div class="module-layout">
            <div class="module-box small"><strong>Tratamientos activos:</strong> ${activeTreatments.length}</div>
            <div class="module-box small"><strong>Total pagado:</strong> ${formatMoney(totalPaid)}</div>
          </div>

          <div class="module-layout">
            <div class="module-box small"><strong>Saldo pendiente:</strong> ${formatMoney(totalPending)}</div>
            <div class="module-box small"><strong>Resumen:</strong> Citas ${appointments.length} · Consultas ${encounters.length} · Recetas ${prescriptions.length}</div>
          </div>

          ${renderMiniTable('Últimas citas', ['Fecha', 'Motivo', 'Estado'], appointmentsRows)}
          ${renderMiniTable('Últimas consultas', ['Fecha', 'Motivo', 'Diagnóstico'], encountersRows)}
          ${renderMiniTable('Tratamientos recientes', ['Tratamiento', 'Dosis', 'Vigencia'], treatmentsRows)}
          ${renderMiniTable('Recetas recientes', ['Fecha', 'Medicamento', 'Dosis'], prescriptionsRows)}
          ${renderMiniTable('Pagos recientes', ['Fecha', 'Monto', 'Estado'], paymentsRows)}
        </div>`;

      const printBtn = result.querySelector('#btnPrintHistory');
      if (printBtn) {
        printBtn.addEventListener('click', () => printPatientHistoryReport(h));
      }

      msg.textContent = 'Historial cargado.';
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindAppointmentForm() {
  const form = document.getElementById('appointmentForm');
  const msg  = document.getElementById('appointmentMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/appointments', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      msg.textContent = 'Cita guardada.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindTreatmentForm() {
  const form = document.getElementById('treatmentForm');
  const msg  = document.getElementById('treatmentMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/treatments', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      msg.textContent = 'Tratamiento guardado.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindPrescriptionForm() {
  const form = document.getElementById('prescriptionForm');
  const msg  = document.getElementById('prescriptionMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/prescriptions', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      msg.textContent = 'Receta guardada.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindPaymentForm() {
  const form = document.getElementById('paymentForm');
  const msg  = document.getElementById('paymentMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      if (!data.appointmentId) delete data.appointmentId;
      await api('/payments', { method: 'POST', body: JSON.stringify(data) });
      msg.textContent = 'Pago registrado.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });
}

function bindMedicationForm() {
  const form    = document.getElementById('medicationForm');
  const msg     = document.getElementById('medicationMsg');
  const sForm   = document.getElementById('stockForm');
  const sMsg    = document.getElementById('stockMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/medications', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      msg.textContent = 'Medicamento agregado.'; form.reset(); await refreshAll();
    } catch (err) { msg.textContent = err.message; }
  });

  sForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(sForm);
    const medId = fd.get('medId');
    const delta = parseInt(fd.get('delta'), 10);
    try {
      await api(`/medications/${medId}`, { method: 'PUT', body: JSON.stringify({ stockDelta: delta }) });
      sMsg.textContent = 'Stock actualizado.'; sForm.reset(); await refreshAll();
    } catch (err) { sMsg.textContent = err.message; }
  });
}

// ── BIND ACTIONS ──────────────────────────────────────────────────────────────
function bindUserActions() {
  moduleCard.querySelectorAll('[data-edit-user-perms]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = Number(btn.dataset.editUserPerms);
      const target = state.users.find(u => u.id === userId);
      if (!target) return;
      const selected = await showPermissionsModal(target);
      if (!selected) return;
      await api(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: selected }),
      });
      await refreshAll();
    });
  });
  moduleCard.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar usuario?')) return;
      await api(`/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

function bindPatientActions() {
  moduleCard.querySelectorAll('[data-history]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeModule = 'history'; renderTabs(); renderModule();
      setTimeout(() => {
        const sel = document.querySelector('#historyForm select[name="patientId"]');
        if (sel) sel.value = btn.dataset.history;
      }, 0);
    });
  });
  moduleCard.querySelectorAll('[data-delete-patient]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar paciente? Se eliminará todo su historial.')) return;
      await api(`/patients/${btn.dataset.deletePatient}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

function bindAppointmentActions() {
  moduleCard.querySelectorAll('[data-print-appointment]').forEach(btn => {
    btn.addEventListener('click', () => {
      printAppointmentTicket(btn.dataset.printAppointment);
    });
  });
  moduleCard.querySelectorAll('[data-delete-appointment]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar cita?')) return;
      await api(`/appointments/${btn.dataset.deleteAppointment}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
  moduleCard.querySelectorAll('[data-reschedule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appointment = state.appointments.find(a => a.id === Number(btn.dataset.reschedule));
      const defaultValue = toDateTimeLocalValue(appointment?.scheduledAt);
      const newDate = await showRescheduleModal(defaultValue);
      if (!newDate) return;
      await api(`/appointments/${btn.dataset.reschedule}`, { method: 'PUT', body: JSON.stringify({ scheduledAt: newDate, status: 'reprogramada' }) });
      await refreshAll();
    });
  });
  moduleCard.querySelectorAll('[data-cancel-apt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Cancelar esta cita?')) return;
      await api(`/appointments/${btn.dataset.cancelApt}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelada' }) });
      await refreshAll();
    });
  });
}

function bindTreatmentActions() {
  moduleCard.querySelectorAll('[data-delete-treatment]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/treatments/${btn.dataset.deleteTreatment}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

function bindPrescriptionActions() {
  moduleCard.querySelectorAll('[data-delete-prescription]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/prescriptions/${btn.dataset.deletePrescription}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

function bindPaymentActions() {
  moduleCard.querySelectorAll('[data-print-payment]').forEach(btn => {
    btn.addEventListener('click', () => {
      printPaymentTicket(btn.dataset.printPayment);
    });
  });
  moduleCard.querySelectorAll('[data-delete-payment]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar pago?')) return;
      await api(`/payments/${btn.dataset.deletePayment}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
  moduleCard.querySelectorAll('[data-pay-now]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/payments/${btn.dataset.payNow}/status`, { method: 'PUT', body: JSON.stringify({ status: 'pagado' }) });
      await refreshAll();
    });
  });
}

function bindMedicationActions() {
  moduleCard.querySelectorAll('[data-delete-med]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar medicamento?')) return;
      await api(`/medications/${btn.dataset.deleteMed}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  bindLogin();
  bindLogout();
  bindBackup();
  bindSearch();
  bindSidebarToggle();
  bindTablePagination();
  renderLoginState();
  renderTabs();
}

bootstrap();
