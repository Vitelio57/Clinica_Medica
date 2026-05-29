# Requerimientos del Proyecto ClinicaMedica V5

Fecha: 29 de mayo de 2026
Fuente: analisis de la implementacion actual (backend Python, frontend web y base de datos SQLite).

## 1. Alcance del sistema

Sistema web local para gestion de una clinica medica con autenticacion, control de acceso por roles/permisos, gestion de pacientes y su atencion clinica, pagos, farmacia, auditoria y respaldo de datos.

## 2. Requerimientos funcionales

### RF-01 Autenticacion de usuarios
El sistema debe permitir inicio de sesion mediante usuario y contrasena.

### RF-02 Sesion basada en token
El sistema debe emitir y validar un token de sesion con expiracion para proteger los endpoints de la API.

### RF-03 Gestion de usuarios
El sistema debe permitir crear, listar, actualizar y eliminar usuarios.

### RF-04 Roles de usuario
El sistema debe manejar al menos los roles: administrador, medico, enfermera y recepcionista.

### RF-05 Permisos por rol y permisos personalizados
El sistema debe permitir permisos por defecto por rol y tambien permisos personalizados por usuario.

### RF-06 Modulo de pacientes
El sistema debe permitir crear, listar, editar y eliminar pacientes.

### RF-07 Identificador clinico unico del paciente
El sistema debe manejar numero de historia clinica unico por paciente.

### RF-08 Busqueda de pacientes
El sistema debe permitir buscar pacientes por nombre, apellido, numero de historia, documento, telefono o correo.

### RF-09 Gestion de citas
El sistema debe permitir crear, listar, actualizar y eliminar citas medicas.

### RF-10 Estados de cita
El sistema debe manejar estados de cita al menos: programada, confirmada, atendida, cancelada y reprogramada.

### RF-11 Filtros de citas
El sistema debe permitir filtrar citas por paciente, medico, fecha y estado.

### RF-12 Gestion de consultas medicas
El sistema debe permitir registrar y actualizar consultas/evoluciones clinicas con motivo, diagnostico, evolucion y plan.

### RF-13 Gestion de tratamientos
El sistema debe permitir crear, listar, actualizar y eliminar tratamientos asociados al paciente.

### RF-14 Gestion de recetas
El sistema debe permitir crear, listar, actualizar y eliminar recetas medicas asociadas al paciente.

### RF-15 Gestion de pagos
El sistema debe permitir registrar pagos, listar pagos, eliminar pagos y actualizar estado de pago.

### RF-16 Comprobante de pago
El sistema debe generar numero de recibo unico por pago.

### RF-17 Relacion pago-cita
El sistema debe permitir vincular pagos a citas y, al marcar pago como pagado, actualizar la cita relacionada a atendida.

### RF-18 Gestion de medicamentos
El sistema debe permitir crear, listar, actualizar y eliminar medicamentos.

### RF-19 Control basico de stock
El sistema debe permitir ajustar stock por valor absoluto o por delta y no permitir stock negativo.

### RF-20 Historial clinico consolidado
El sistema debe mostrar historial completo por paciente con datos de paciente, citas, consultas, tratamientos, recetas y pagos.

### RF-21 Busqueda global
El sistema debe permitir busqueda global sobre pacientes, citas y consultas.

### RF-22 Indicadores de tablero
El sistema debe mostrar estadisticas generales (usuarios, pacientes, citas, pagos, pendientes y total cobrado).

### RF-23 Auditoria de eventos
El sistema debe registrar eventos clave (login, altas, ediciones, eliminaciones y respaldos) con usuario, entidad y fecha.

### RF-24 Respaldo de base de datos
El sistema debe permitir generar copia de respaldo de la base SQLite en carpeta de backups.

### RF-25 Emision de documentos imprimibles
El sistema debe permitir imprimir comprobante de cita, comprobante de pago y reporte de historial clinico.

### RF-26 Navegacion por modulos
El sistema debe ofrecer modulos de interfaz para Inicio, Usuarios, Pacientes, Historial, Citas, Tratamientos, Recetas, Pagos, Farmacia y Auditoria, segun permisos.

## 3. Requerimientos no funcionales

### RNF-01 Arquitectura y tecnologia
El sistema debe operar con backend Python, base de datos SQLite y frontend web HTML/CSS/JavaScript sin frameworks obligatorios.

### RNF-02 Ejecucion local
El sistema debe ejecutarse localmente por defecto en el puerto 3000.

### RNF-03 Concurrencia basica
El servidor debe soportar multiples solicitudes simultaneas mediante servidor HTTP con hilos.

### RNF-04 Seguridad de contrasenas
Las contrasenas deben almacenarse con hash seguro PBKDF2-HMAC-SHA256 con salt.

### RNF-05 Integridad de token
La sesion debe firmarse criptograficamente y rechazar tokens invalidos o expirados.

### RNF-06 Control de acceso
Los endpoints de negocio deben exigir autenticacion y autorizacion por permiso.

### RNF-07 Integridad de datos
La base de datos debe aplicar llaves foraneas, restricciones de dominio (checks) y unicidad en campos criticos.

### RNF-08 Consistencia temporal
Los registros deben mantener marcas de tiempo de creacion y actualizacion para trazabilidad.

### RNF-09 Persistencia y recuperacion
El sistema debe conservar datos en archivo SQLite y permitir recuperacion mediante respaldos.

### RNF-10 Usabilidad
La interfaz debe estar en espanol, con formularios claros y mensajes de error/estado para operaciones del usuario.

### RNF-11 Compatibilidad responsive
La interfaz debe adaptarse a escritorio y dispositivos moviles con reglas responsive.

### RNF-12 Accesibilidad basica
La interfaz debe incluir elementos de enfoque visible, etiquetas de formulario y soporte para navegacion con teclado en modales.

### RNF-13 Rendimiento de consulta
Las listas deben contemplar paginacion en frontend para mejorar navegacion de grandes volumenes.

### RNF-14 Mantenibilidad
El sistema debe separar responsabilidades entre capa HTTP, logica de datos y capa de presentacion.

### RNF-15 Tolerancia a errores
La API debe retornar errores controlados con codigos HTTP adecuados y mensajes legibles.

### RNF-16 Configuracion desplegable
Parametros clave como puerto y secreto de token deben poder definirse por variables de entorno.

## 4. Supuestos y limites actuales

1. El alcance corresponde a la implementacion actual y puede ampliarse segun nuevas necesidades.
2. La solucion esta orientada a uso local/interno; no incluye, por defecto, despliegue distribuido ni alta disponibilidad.
3. No se identifica en la version actual cifrado de base de datos en reposo ni politicas avanzadas de complejidad/rotacion de contrasenas.
4. No se observa exportacion de reportes a PDF nativo en backend; la impresion se realiza desde navegador.

## 5. Priorizacion sugerida

### Alta prioridad
- RF-01 a RF-06, RF-09, RF-12, RF-15, RF-20, RF-23.
- RNF-04, RNF-05, RNF-06, RNF-07, RNF-09.

### Media prioridad
- RF-10, RF-11, RF-13, RF-14, RF-18, RF-19, RF-21, RF-22, RF-24.
- RNF-10, RNF-11, RNF-12, RNF-13, RNF-14.

### Baja prioridad
- RF-25, RF-26.
- RNF-03, RNF-15, RNF-16.

## 6. Criterio de aceptacion general

Se considera aceptado cada requerimiento cuando:
1. Existe evidencia funcional verificable en interfaz o API.
2. El comportamiento respeta permisos de acceso definidos.
3. Los datos se guardan de forma persistente y consistente en SQLite.
4. Los errores se comunican con mensajes claros y codigos HTTP apropiados.