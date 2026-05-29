# Plan de Sprints (4 Semanas)

Proyecto: ClinicaMedica V5  
Fecha de elaboracion: 29 de mayo de 2026  
Duracion total: 4 semanas (4 sprints de 1 semana)

## 1. Contexto

Este documento propone una planificacion hipotetica de 4 sprints para construir el proyecto ClinicaMedica V5 desde cero.  
Se asume un equipo pequeno y se incluyen datos estimados (inventados) pero realistas para una entrega academica.

## 2. Equipo de trabajo (hipotetico)

- 1 Product Owner: define prioridades funcionales y valida entregables.
- 1 Scrum Master / Lider tecnico: organiza sprint, elimina bloqueos y coordina calidad.
- 2 Desarrolladores Full Stack: backend (Python/SQLite) + frontend (HTML/CSS/JS).
- 1 QA funcional (parcial): pruebas manuales, checklist y reporte de incidencias.

Capacidad estimada por sprint: 38 puntos de historia.

## 3. Objetivo general del ciclo

Entregar en 4 semanas un sistema web local para gestion clinica con:
- autenticacion y control de permisos,
- gestion de pacientes y citas,
- historial clinico, tratamientos y recetas,
- pagos, farmacia, auditoria y respaldo.

## 4. Cronograma de 4 sprints

- Sprint 1: Semana 1
- Sprint 2: Semana 2
- Sprint 3: Semana 3
- Sprint 4: Semana 4

---

## Sprint 1 (Semana 1)

### Objetivo
Construir la base tecnica del sistema y dejar operativa la autenticacion con control de acceso inicial.

### Historias de usuario (ejemplo)
- HU-01: Como usuario del sistema, quiero iniciar sesion para acceder solo con credenciales validas.
- HU-02: Como administrador, quiero gestionar usuarios para controlar quien accede al sistema.
- HU-03: Como equipo tecnico, queremos estructura base de API y base de datos para acelerar modulos siguientes.

### Alcance funcional
- Inicializacion de base de datos SQLite.
- Modelo de usuarios con roles (administrador, medico, enfermera, recepcionista).
- Login con token y validacion de sesion.
- CRUD de usuarios (crear/listar/editar/eliminar).
- Layout base del frontend (login, sidebar, area de modulos).

### Tareas tecnicas clave
- Crear tablas principales (users + auditoria base).
- Implementar hash de contrasena y verificacion.
- Implementar endpoint de login y endpoint de usuario autenticado.
- Renderizar vista de login y manejo de token en frontend.
- Configurar estructura de estilos y navegacion principal.

### Entregables
- API funcional de autenticacion.
- Pantalla de login operativa.
- Modulo de usuarios usable por administrador.

### Criterios de aceptacion
- Login correcto retorna token y datos de usuario.
- Usuario inactivo o credenciales invalidas no ingresan.
- Solo rol con permiso puede crear/editar/eliminar usuarios.

### Estimacion
- Compromiso: 34 puntos.
- Completado: 32 puntos.
- Incidencias detectadas: 6 (resueltas: 5, pendiente: 1 menor).

---

## Sprint 2 (Semana 2)

### Objetivo
Implementar operacion clinica basica con pacientes, citas y tablero de seguimiento.

### Historias de usuario (ejemplo)
- HU-04: Como recepcionista, quiero registrar pacientes para programar su atencion.
- HU-05: Como recepcionista, quiero crear y reprogramar citas para organizar agenda.
- HU-06: Como usuario autorizado, quiero ver estadisticas para monitorear actividad.

### Alcance funcional
- CRUD de pacientes.
- Busqueda de pacientes por datos clave.
- CRUD de citas con estados (programada, confirmada, atendida, cancelada, reprogramada).
- Filtros de citas por paciente, medico, fecha y estado.
- Dashboard con indicadores principales.

### Tareas tecnicas clave
- Crear tabla patients y appointments con claves foraneas.
- Implementar endpoints de listado con filtros.
- Construir formularios de paciente y cita.
- Agregar acciones de reprogramacion y cambio de estado.
- Mostrar estadisticas en dashboard.

### Entregables
- Modulo Pacientes estable.
- Modulo Citas estable.
- Dashboard con metricas visibles.

### Criterios de aceptacion
- No se permite duplicar numero de historia clinica.
- Citas se guardan con estado valido.
- Filtros muestran resultados consistentes.

### Estimacion
- Compromiso: 38 puntos.
- Completado: 36 puntos.
- Incidencias detectadas: 8 (resueltas: 7, pendiente: 1).

---

## Sprint 3 (Semana 3)

### Objetivo
Completar el nucleo medico del sistema: consultas, historial clinico, tratamientos y recetas.

### Historias de usuario (ejemplo)
- HU-07: Como medico, quiero registrar consultas para llevar evolucion del paciente.
- HU-08: Como medico, quiero registrar tratamientos y recetas para definir plan terapeutico.
- HU-09: Como medico/enfermera autorizada, quiero consultar historial consolidado por paciente.

### Alcance funcional
- CRUD de consultas medicas (encounters).
- CRUD de tratamientos.
- CRUD de recetas.
- Historial clinico consolidado por paciente.
- Busqueda global sobre pacientes, citas y consultas.
- Impresion de historial clinico.

### Tareas tecnicas clave
- Crear tablas encounters, treatments y prescriptions.
- Crear endpoint de historial consolidado por paciente.
- Implementar vistas de tratamientos y recetas.
- Implementar modulo de historial con resumen y detalle.
- Habilitar impresion de reporte clinico desde frontend.

### Entregables
- Flujo clinico completo (consulta -> tratamiento/receta -> historial).
- Vista de historial funcional para seguimiento medico.

### Criterios de aceptacion
- Cada consulta queda asociada a un paciente.
- Historial muestra datos clinicos y administrativos en una sola vista.
- Solo perfiles autorizados acceden al historial.

### Estimacion
- Compromiso: 40 puntos.
- Completado: 37 puntos.
- Incidencias detectadas: 10 (resueltas: 8, pendientes: 2 menores).

---

## Sprint 4 (Semana 4)

### Objetivo
Cerrar el producto con modulos administrativos finales, seguridad operativa y preparacion de entrega.

### Historias de usuario (ejemplo)
- HU-10: Como recepcionista, quiero registrar pagos para controlar cobros.
- HU-11: Como administrador, quiero auditar acciones para trazabilidad.
- HU-12: Como administrador, quiero generar respaldos para proteger la informacion.
- HU-13: Como personal de farmacia, quiero controlar medicamentos y stock.

### Alcance funcional
- CRUD de pagos + cambio de estado de pago.
- Generacion de numero de recibo y comprobante imprimible.
- Modulo de medicamentos con control de stock.
- Bitacora de auditoria de acciones criticas.
- Respaldo de base de datos.
- Ajustes responsive, validaciones y cierre de defectos.

### Tareas tecnicas clave
- Crear tabla payments y medications.
- Implementar logica de pago vinculado a cita.
- Implementar endpoints de auditoria y backup.
- Construir vistas de pagos, farmacia y auditoria.
- Correccion de bugs y pruebas de regresion.

### Entregables
- Sistema integral completo y navegable por modulos.
- Evidencia de pruebas funcionales y checklist de cierre.
- Documento de requerimientos y manual breve de uso.

### Criterios de aceptacion
- Registrar pago genera recibo unico.
- Cambiar pago a pagado actualiza estado relacionado cuando aplica.
- El respaldo crea archivo sqlite en carpeta de backups.
- Auditoria registra acciones clave con fecha y usuario.

### Estimacion
- Compromiso: 39 puntos.
- Completado: 38 puntos.
- Incidencias detectadas: 7 (resueltas: 7).

---

## 5. Resumen de avance global (simulado)

- Puntos comprometidos: 151
- Puntos completados: 143
- Cumplimiento global: 94.7%
- Incidencias totales: 31
- Incidencias cerradas: 27
- Incidencias pendientes al cierre: 4 (todas menores)

## 6. Riesgos identificados y mitigacion

- Riesgo: retraso por cambios de alcance en roles/permisos.
  Mitigacion: congelar permisos al inicio de cada sprint y mover cambios al backlog.

- Riesgo: errores de integridad en SQLite por relaciones.
  Mitigacion: activar llaves foraneas y pruebas de CRUD por modulo.

- Riesgo: sobrecarga en semana final por bugs acumulados.
  Mitigacion: reservar 20% de capacidad del Sprint 4 para estabilizacion.

## 7. Nota sobre el orden real de trabajo

Aunque en la practica algunos desarrollos pudieron hacerse en orden distinto, este plan presenta una secuencia recomendada y coherente para documentacion academica y seguimiento de proyecto.

## 8. Definicion de terminado (Definition of Done)

Una historia se considera terminada cuando:
- esta implementada en frontend y backend (si aplica),
- respeta permisos por rol,
- tiene validaciones basicas y manejo de errores,
- fue probada manualmente,
- no introduce regresiones visibles en el modulo.