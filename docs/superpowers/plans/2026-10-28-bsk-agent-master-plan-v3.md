# BSK — Plan maestro v3 para agentes de código: PaaS/IDP multi-proyecto, CI/CD por proyecto y gobierno de recursos

**Fecha:** 28 de octubre de 2026  
**Repositorio:** `devzaratech/business-starter-kit` (privado)  
**Baseline verificada:** `main` → `2559b6a175489a24a9437323edee954b79cfdaad` (30-09-2026), sin PR abiertos al momento de la revisión.  
**Estado de este documento:** propuesta integral para implementación; no se declara implementada ninguna función futura. **Alcance consolidado:** añade como requisito de primera clase múltiples proyectos por host, múltiples dominios y servicios por proyecto, un proxy de borde por host, y la política Tailscale como conectividad privada. Esta **v3** es la única fuente principal para nuevas implementaciones: añade CI/CD por proyecto, presupuestos y cuotas por proyecto/ambiente, reconciliación, catálogo de golden paths, criterios de madurez y un plan de entregas verificables.

**Restricción operativa:** no ejecutar scripts, modificar DNS/Tailnet, conectar VPS ni abrir servicios públicos en PR0–PR2. Todas las pruebas con infraestructura deben ser locales/efímeras hasta aprobación específica.

## 0A. Decisión de producto y alcance definitivo (v3)

**Definición:** BSK es una plataforma abierta de ingeniería y operación de aplicaciones (*Internal Developer Platform + PaaS*), con Control Plane, Dashboard, CLI, API y una interfaz de automatización para agentes con permisos restringidos. No es un clon de interfaz de Coolify ni una reimplementación monolítica de Kubernetes o Humanitec.

**Cuatro diferenciadores objetivo, verificables:**
1. Un mismo modelo declarativo para aplicaciones y servicios en N proyectos, N ambientes, múltiples dominios y varios VPS; adaptadores Compose/K3s/cloud/Coolify opcional.
2. Golden Paths empresariales funcionales (Java, React, Angular, Node y servicios opcionales) con CI/CD *por proyecto* y promoción de artefactos inmutables.
3. Gobierno de capacidad y costos *por proyecto y ambiente* con políticas que puedan denegar despliegues y métricas de consumo medido.
4. Trust & Compliance Plane con políticas de seguridad y privacidad por jurisdicción, evidencia y revisión humana; nunca auto-certificación jurídica.

**Puntos de no retorno técnico:** no crear paneles o CLI que salten el API de operaciones; no desplegar código arbitrario desde la interfaz web; no mezclar credenciales entre proyectos; no convertir Kubernetes, Jenkins, WordPress, IA, Supabase o Coolify en dependencias obligatorias.

**Estado:** esta especificación no implementa funciones ni implica despliegue o cambios en infraestructura real. La evaluación se basa en el commit base identificado y debe revalidarse antes de cada PR.

## 0. Fuente principal para agentes

**Este documento v3 es el único plan maestro vigente que debe agregarse para iniciar el trabajo.** Consolida los requisitos de las versiones anteriores (ambientes dinámicos, proyectos/servicios/dominios múltiples por VPS, Tailscale, panel web, CI/CD por proyecto, límites de recursos, Kubernetes, multi-cloud, observabilidad, WordPress/IA y compliance). **Los archivos v1/v2 y los documentos externos históricos no son requisitos para ejecutar PR0.**

Respeta como fuente de verdad para el **código ya existente** los ADR, esquemas, manifests y scripts versionados del repositorio. Revisa especialmente `docs/architecture/`, `contracts/schemas/`, `docs/ci-cd/`, `docs/environments/` y `infra/`. Ante contradicciones entre esta **hoja de ruta propuesta** y el comportamiento actual, no modifiques ni rompas sistemas silenciosamente: documenta un ADR y presenta el cambio en un PR para revisión.

**Este plan no es código ejecutable, no prueba que las funcionalidades futuras existan y no autoriza cambios remotos.** Cada etapa tiene que demostrar sus capacidades en pruebas reales antes de ser anunciada como terminada.

## 1. Misión y límites

**Misión:** convertir un VPS recién contratado en una plataforma reproducible y segura; crear, desplegar y operar aplicaciones en cualquier cantidad práctica de ambientes, incluso distribuidos en varios VPS/proveedores cloud; proporcionar plantillas empresariales, CI/CD, observabilidad, seguridad, panel web y capacidades de evidencia para protección de datos.

La implementación debe servir para **dos usos**:

1. **Operación real**: bootstrap idempotente, Docker Compose por defecto, Tailscale, proxy, backup/restauración, actualizaciones, CLI/API, panel web y diagnóstico.
2. **Demostraciones profesionales**: Java, Angular, React, PostgreSQL, Docker, K3s/Helm, Jenkins, GitHub Actions, GitLab CI, OpenTofu, OpenTelemetry, DevSecOps, recuperación y troubleshooting.

No convertir cada VPS en una instalación de veinte contenedores. Cada servicio es optativo y se habilita explícitamente. Los controles regulatorios **ayudan a cumplir** obligaciones; no certifican cumplimiento legal ni sustituyen asesoramiento de especialistas.

## 2. Invariantes no negociables

1. **Código fuente y Git:** no escribir directamente en `main`; ramas por PR; no hacer público el repositorio ni cambiar su licencia sin aprobación. Conservar Apache-2.0 del núcleo y verificar licencias de terceros.
2. **Despliegues seguros:** no tocar VPS, DNS, Cloudflare, Tailnet, secretos ni producción reales sin autorización independiente y específica. `plan`, `validate` y `doctor` no modifican infraestructura.
3. **N ambientes:** ningún enum cerrado `dev/qa/uat/staging/prod`, ni restricción de cantidad en esquemas, CLI, API, UI, GitHub Actions, Jenkins o Kubernetes. Son etiquetas o perfiles de ejemplo. Capacidad real limitada por recursos y cuotas explícitas.
4. **Entidades distintas:** `organization/tenant`, `installation`, `host`, `cluster`, `environment`, `project`, `application`, `release`, `deployment`, `jurisdictionPack` y `evidence` no se confunden. Ambiente no equivale a servidor ni a cliente.
5. **Un motor y varias interfaces:** Dashboard React, CLI y API/MCP consumen servicios de aplicación y operaciones compartidos. No ejecutar SSH arbitrario desde el navegador ni crear una segunda lógica de despliegue en la interfaz.
6. **Idempotencia y reversibilidad:** comandos repetidos sin duplicación, operación resumible, plan visible, rollback, backups probados, no eliminar volúmenes con `down`. En acciones destructivas, enumerar recursos y exigir confirmación.
7. **Separación de secretos:** no almacenar contraseñas/tokens de acceso en Git, logs, eventos, salidas de pruebas, imágenes, snapshots o respuestas de la API; referenciar secret stores.
8. **Módulos desacoplados:** mantener Golden Path y las reglas de dependencias de `bsk.module.json`. Kernel no depende de WordPress, Cloudflare, Coolify, un proveedor cloud ni un motor de CI/CD.
9. **Estado comprobable:** marcar capacidades `Planned`, `Lab`, `Preview` o `GA` según evidencia; ningún YAML o README aislado basta para decir “soportado”.
10. **Seguridad:** RBAC, auditoría, rate limits, autenticación de agentes remotos, mínimo privilegio, protección ante SSRF/inyección, no ejecución arbitraria de instrucciones de un repositorio externo.
11. **Muchos proyectos por host:** el host no es el proyecto ni el ambiente; cada uno posee su identidad, redes privadas, recursos, rutas y persistencia. No existe la premisa un VPS = un stack.
12. **Un plano de entrada público por host:** un *edge gateway* con listeners 80/443 coordina rutas de todos los proyectos. No crear N proxies que compitan por los mismos puertos. Proxies externos pueden existir como motores alternativos, jamás como instancias en conflicto.
13. **Dominio como recurso gestionado:** el FQDN + protocolo + puerto + path/método de coincidencia, según corresponda, constituye una clave única dentro del inventario de rutas activas. Se verifica titularidad/control y no se pisa el dominio de un tercero.
14. **No exposición accidental:** todo servicio interno nace privado; solamente servicios/rutas explícitamente autorizados se conectan al plano de entrada. Credenciales, Docker socket, BD, Jenkins y paneles internos no se publican por error.
15. **Tailscale es plano privado, no RBAC de la aplicación:** instalación opcional pero recomendada en host, políticas grants/SSH verificadas, credenciales efímeras donde corresponda, modo recuperación fuera de banda y no dependencia circular del propio BSK para recuperar su acceso.
16. **Sin falsa seguridad multi-tenant:** Docker/Compose a nivel de host compartido no equivale a aislamiento de clientes mutuamente hostiles. Para cargas de distinta confianza, separar hosts, VM o clusters y aplicar políticas pertinentes.
17. **Plano de control recuperable:** su base de datos, secretos, definiciones de rutas, auditoría y estado de jobs tienen respaldo verificable, y una falla suya no debe detener las aplicaciones ya desplegadas.

## 3. Arquitectura objetivo — recursos y límites de confianza

### 3.1 Modelo de dominio, no modelo de contenedores

```text
Organization (seguridad, facturación, políticas)
 └─ Installation (instancia de BSK y credenciales separadas)
     ├─ Host / Cluster (capacidad y ubicaciones)
     │   ├─ HostAgent / conexión SSH administrada
     │   ├─ EdgeGateway (por host; rutas públicas autorizadas)
     │   └─ TailnetNode (por host, opcional)
     ├─ Project (propietarios, cuotas y visibilidad)
     │   ├─ Environment [N dinámicos, names arbitrarios]
     │   │   ├─ Application / Service / Worker (uno o varios)
     │   │   │   ├─ Release (imagen digest + manifiesto)
     │   │   │   ├─ Deployment (instancia en host/cluster)
     │   │   │   ├─ Routes: [DomainBinding...] (0..N)
     │   │   │   ├─ StorageBindings / BackupPolicies
     │   │   │   └─ SecretReferences (nunca valores en Git)
     │   │   └─ DataServices (BD/Redis/S3; compartidos sólo por política explícita)
     │   └─ Policies (exposición, residencias, retención, recursos)
     ├─ DomainZone / DomainBinding / Certificate / DNSProvider
     ├─ NetworkPolicy / TailnetPolicyRef / PrivateService
     └─ Operations / AuditEvents / Evidence
```

**Semántica estricta:** un *Project* es agrupación lógica y permisos; *Environment* es configuración/ciclo de vida y no es un servidor; un *Service* es componente desplegable; *Deployment* une un servicio, un ambiente y un target; *DomainBinding* une un endpoint HTTP(S) concreto con un servicio/ambiente; *Host* tiene su capacidad y ubicación. Un mismo proyecto puede correr en uno o varios hosts. No prometer réplica ni failover automático de datos por el mero hecho de tener múltiples deployments.

### 3.2 Diagrama operacional

```text
                 React Dashboard -- CLI -- API/MCP limitada
                                |   OIDC/RBAC/audit
                   BSK Control Plane (estado deseado + observado)
                 DB de control / jobs / locks / reconciler / plan
                                |
             conectividad autenticada y autorizada (Tailscale, SSH)
                   +------------+------------------+
                   |                               |
                 Host A                          Host B / K3s
            Agent/SSH executor                Agent / K8s API
                   |                               |
             ONE EdgeGateway                 Gateway API/Ingress
         Caddy o Nginx (80/443)               múltiples proyectos
        +----------+----------+
        |          |          |
     Project P   Project Q   Project R
     env dev     env prod    env demo
       |            |          |
     app+db      wordpress   java+react
      net P      net Q      net R
        |            |          |
    privados por defecto; recursos expuestos sólo mediante DomainBindings

 Public traffic: Internet -> Cloudflare (optional) -> Host EdgeGateway -> app
 Private admin: operator/CI -> Tailnet -> SSH/API privada -> host agent
                           (TLS, OIDC/RBAC en paneles igualmente)
```

**Control plane:** una API común para web/CLI; estado deseado/observado versionado; reconciliación con locks por host/proyecto/ambiente y idempotencia. Jobs `queued/running/succeeded/failed/cancelled`, reintentos acotados, auditoría y rollback declarados. En instalación pequeña puede convivir con apps, pero como `bsk-system` independiente y respaldado; para operación empresarial se recomienda gestión separada. Si cae, las aplicaciones desplegadas siguen disponibles mientras sus dependencias funcionen.

### 3.3 Multi-proyecto en un VPS: topología de red

- **Una única instancia EdgeGateway administrada por BSK por host**, independiente de proyectos/ambientes, con entrada `80/443`. Seleccionar backend de configuración Caddy o Nginx; Traefik como tercer backend futuro opcional, no obligatorio.
- Un proyecto Compose por **deployment** o por entorno de proyecto según la unidad de lifecycle; asignar `-p bsk-<identificador-estable>`, sin `container_name` manual. El identificador debe incorporar IDs estables y no sólo slugs susceptibles de colisión.
- Redes internas dedicadas a cada deployment; bases de datos y cachés conectadas sólo a servicios autorizados. Para L7, el gateway se conecta **a redes de entrada por aplicación/entorno**, no a redes privadas con bases de datos. Una red global con todos los frontends es la alternativa de laboratorio, pero tiene mayor superficie de movimiento lateral y **no será el perfil seguro por defecto**.
- De ser necesario, usar un `localhost`-only binding para servicios privados consumidos por el host (nunca `0.0.0.0` por defecto), o un gateway privado accesible desde Tailnet. Los servicios TCP/UDP requieren policy y un diseño de puerto/endpoint separado de HTTP.
- Evitar montar `/var/run/docker.sock` en el gateway; ejecutar la configuración del proxy desde un worker limitado con plantillas validadas, no autodescubrimiento con credenciales root del daemon. Si se habilita descubrimiento Docker futuro, mediarlo mediante componente read-only restringido, documentando sus límites.
- Etiquetar y versionar recursos gestionados por `bsk.installation`, `bsk.project`, `bsk.environment`, `bsk.deployment`, `bsk.managed=true`; no borrar recursos sin etiqueta/propiedad.
- Recursos compartidos (PostgreSQL del host, storage, monitoring) deben ser **opt-in** y tener permisos/bases/buckets segregados; instalaciones de alta confianza pueden compartir motor, clientes de diferente confianza requieren aislamiento más fuerte.
- Cuotas/placement: CPU, memoria, disco, PIDs, ulimits, log rotation, puertos reservados, almacenamiento y espacio para backups. Scheduler inicial: placement explícito con validación de capacidad, no simular planificación multicloud avanzada.

### 3.4 Registro de dominios, DNS y certificados

`DomainZone` (zona verificada) -> `DomainBinding` (FQDN, protocolo, puerto, `pathPrefix`/precedencia, service endpoint y ambiente) -> `Certificate`/`DNSRecord` controlados. Cada servicio admite 0..N dominios. Varios servicios pueden compartir dominio sólo con reglas de path no ambiguas. Dominios cruzados entre clientes requieren verificación independiente y autoridad del propietario.

**Ciclo de vida de publicación:**
1. Reservar atómicamente el hostname/ruta para que ningún otro proyecto lo capture; validar IDNA/punycode, FQDN, wildcards, paths, colisiones y URL encoding.
2. Probar control del dominio (por verificación DNS) y autorización sobre la zona; trabajar con Cloudflare mediante token de mínimo alcance o modo manual sin API.
3. Seleccionar `Cloudflare proxied + Full (strict)` con origen y certificado verificados, o DNS directo + ACME, o Cloudflare Tunnel de host a edge interno, sin mezclar supuestos. El Cloudflare Tunnel no es sinónimo de autenticación: un hostname publicado puede quedar accesible a Internet si no se añade Access.
4. Generar config de gateway desde el registro; `nginx -t` o `caddy validate` antes de aplicar; escribir nueva configuración atómicamente, recargar sin cortar otras aplicaciones y conservar last-known-good/rollback.
5. Probar ruta pública, TLS, healthcheck y cabeceras `X-Forwarded-*` confiables; no aceptar `CF-Connecting-IP` de clientes directos; corregir rutas con prefijo para WordPress/SPA/webhooks según compatibilidad.
6. Borrar dominio: desaprovisionar únicamente bindings/certificados/DNS de propiedad comprobada y tras aprobación; nunca borrar una zona DNS completa.

**Disponibilidad:** un solo gateway por host es un punto de falla reconocido: auto-restart, healthcheck, respaldo de config, deploy atómico y alertas son obligatorios. HA entre hosts requiere balanceador externo y estrategia de datos/volúmenes definida por separado. No crear certificados wildcard sin necesidad; DNS-01 si aplica.

### 3.5 Tailscale: la respuesta senior para múltiples proyectos

**Tres planos separados:**
- **Público:** Cloudflare/DNS -> EdgeGateway -> servicios explícitamente publicados (frontend, webhooks con autenticación y rate limits).
- **Privado:** Tailscale en **host** como opción recomendada del bootstrap; administración SSH, backend del control plane, paneles Jenkins/n8n, pgAdmin, etc. Un nodo de Tailnet por host en el MVP, no un nodo Tailscale por contenedor/proyecto.
- **Aplicación a aplicación:** redes Compose en el host y endpoints internos autenticados entre hosts. No usar Tailscale para fingir que todas las bases de datos deben hablar directamente entre sí; cada conexión debe justificarse y autorizarse.

**Seguridad y aprovisionamiento de Tailnet:**
- Tailscale es **opt-in** y BSK puede funcionar sin él mediante SSH seguro alternativo; soporte de Tailnets externas por instalación, no añadir clientes no relacionados a una Tailnet global del desarrollador.
- Enrollment con identity/OAuth o auth key de alcance mínimo y tags de servidor; no escribir claves de enrolamiento a disco ni imprimirlas en logs, no exponerlas en `.env.example` real. Políticas **Grants** con mínimo privilegio por rol, tags/combinaciones probadas y revisadas. Una etiqueta `tag:prod` no se combina por intersección automáticamente con otra; usar etiquetas compuestas específicas.
- Primero registrar nodo y verificar acceso privado desde un dispositivo administrativo; luego restringir SSH público si hay alternativa de recuperación por consola del proveedor. `bsk doctor network` detecta salida y entrada Tailscale, grants efectivos, SSH y pérdida de enlace. **Nunca cerrar SSH público en el mismo paso sin verificación y autorización de recovery.**
- Ofrecer SSH tradicional **sobre Tailscale** en fase 1; Tailscale SSH (con políticas de SSH/check mode) como opción separada: no equivale a SSH tradicional y puede ser inapropiado para servidores multiusuario.
- Paneles internos deben mantener OIDC/RBAC y TLS donde corresponda. Tailscale otorga conectividad, **no reemplaza** autenticación/autorización de cada servicio.
- CI/CD: runner efímero en Tailnet mediante integración oficial de GitHub Action/federación, con tag exclusivo y acceso únicamente a destinos/puertos requeridos; misma política para Jenkins agents si tienen acceso privado.
- **Tailscale Services**, disponible a fecha de diseño, como módulo opcional *después* del MVP: nombres privados estables (`svc:...`) que desacoplan endpoint de host y ayudan en migraciones/HA, con ownership y aprobación. No son garantía automática de réplica de datos ni sustituyen políticas de aplicación; atender límites de protocolo y versión.
- K3s/Kubernetes: uso posterior del **Tailscale Kubernetes Operator** para exponer servicios/API privada con permisos y políticas de clúster propios.
- Recovery: consola OVH/cloud fuera de banda, acceso de emergencia documentado, rotación/revocación de dispositivos; probar un fallo de Tailnet sin inutilizar el servidor.

### 3.6 Múltiples VPS y placement

Primer MVP: `Project + Environment + Deployment -> Host` con placement **explícito** validado. Permitir varios deployments de distintos proyectos en un host, y el mismo proyecto en varios hosts. Mantener gateway y datos específicos de cada host; un dominio público tiene una política explícita de target(s) y DNS/routing y no puede apuntar por accidente a dos releases incompatibles. Más tarde ofrecer balanceo externo, réplica, failover y migración de datos únicamente con pruebas de consistencia, RPO y RTO documentados. No confundir inventario multihost con alta disponibilidad o multicloud real.

### 3.7 API pública de gestión y contratos versionados

Contratos mínimos (`spec/status` con UIDs estables y scope de organización): `Project`, `Environment`, `Service`, `Host`, `Cluster`, `Deployment`, `Release`, `DomainZone`, `DomainBinding`, `EdgeGateway`, `NetworkAttachment`, `PrivateService`, `TailnetConnectionRef`, `SecretRef`, `BackupPolicy`, `Operation`, `PolicyDecision`. Restricciones globales en DB (uniqueness de rutas, pertenencia y reservas) y controles RBAC *por proyecto/ambiente* además de por organización. Auditoría de cambios, versionado de manifiesto y validación *server-side*. Las herramientas de IA usan API estrecha con `plan` primero, permisos por acción y aprobaciones: nunca `exec arbitrary shell` por MCP.

### 3.8 Ejemplo declarativo canónico (ilustrativo, NO implementado)

```yaml
apiVersion: bsk.dev/v1alpha1
kind: Project
metadata:
  name: data-signal
spec:
  owner: team-editorial
  environments:
    - name: production
      target: vps-canada
      services:
        - name: cms
          type: wordpress
          access: public
          domains:
            - host: noticias.example.org
            - host: editorial.example.net
        - name: automation
          type: n8n
          access: private
        - name: database
          type: mariadb
          access: internal
    - name: preview-42
      target: vps-chile
      services:
        - name: cms
          type: wordpress
          access: private
```

El esquema real se definirá con JSON Schema estricto, `SecretRef`, `resources`, `storage`, `backup` y políticas de dominio; no asumir que una sola plantilla cubre todas las reglas de WordPress, Supabase o bases de datos.

### 3.9 Diferenciación frente a Coolify

**BSK no debe copiar visualmente Coolify ni implementar otra consola Docker sin propuesta diferenciada.** Debe destacar por: modelo declarativo multi-proyecto/entorno/host desde API común, plantillas productivas Java/React/Angular, despliegue equivalente Compose/K3s, conectividad privada Tailscale, CI/CD interchangeable, políticas de seguridad/compliance versionadas y auditoría reproducible. Puede integrar Coolify mediante driver opcional; no hacerlo dependencia del núcleo ni asumir paridad de API. El tablero web opera sobre Control Plane y no sobre el socket Docker directamente.

## 3A. Flujo mínimo extremo a extremo (funcionalidad objetivo)

```text
bsk host register vps-ca --connection tailscale-ssh
bsk project create data-signal
bsk env create data-signal/production --on vps-ca
bsk service add data-signal/production cms --template wordpress
bsk service add data-signal/production workflows --template n8n --private
bsk domain attach noticias.example.org --to data-signal/production/cms
bsk plan --project data-signal --env production
bsk apply --project data-signal --env production
bsk status --project data-signal --env production
```

**Comandos puramente ilustrativos.** `host register`, `plan` o `domain attach` no pueden ejecutar instalaciones remotas implícitas; `apply` requiere permisos/autorización/confirmación según criticidad. Nunca escribir claves reales ni hostnames privados en el manifiesto de ejemplo.

## 3B. CI/CD DE CADA PROYECTO: requisito obligatorio y no negociable (v3)

### 3B.1 Entidades y modelo

Añadir al modelo de control plane entidades separadas: `SourceRepository`, `PipelineDefinition`, `PipelineRun`, `BuildArtifact`, `Release`, `Promotion`, `DeploymentRun`, `Approval`, `BuildRunner`, `RegistryRef`, `SecretRef` y `DeploymentPolicy`. Cada objeto tiene UID estable, tenant/organization y project/ambient scope, auditoría y estado observado.

**Relaciones:**
- `Project 1:N SourceRepository`, `Project 1:N PipelineDefinition`, `PipelineDefinition 1:N PipelineRun`.
- `PipelineRun 0:N BuildArtifact` (OCI digest, SBOM, firmas y procedencia).
- `Release = set de artefactos inmutables + configuración versionada + metadatos de verificación`.
- `Promotion` apunta a *la misma release* entre ambientes; no recompilar para producción.
- `DeploymentRun` registra quién, qué, dónde, por qué y resultados, con correlación a CI, plataforma y telemetría.
- Soportar monorepo, repos múltiples, varios servicios por proyecto y despliegues parciales con dependencias explícitas.

### 3B.2 Flujo nominal y contratos

`Git event / manual trigger -> CI provider -> validate/test -> SAST/SCA/secret scan -> SBOM -> build OCI -> sign/attest -> registry -> BSK Release -> policy evaluation -> approval -> CD/driver -> probes -> post-deploy smoke tests -> deployment evidence`.

**Flujos alternativos:** rollback de imagen y configuración, cancelación segura, reintento idempotente con `operation_id`, preview efímero de PR con TTL, despliegue selectivo de servicios, canary/blue-green donde el driver lo implemente; no prometer zero-downtime universal ni rollback seguro de migraciones de DB.

**Un único contrato `PipelineProvider`:**
- `github-actions` primera implementación; `jenkins` segundo adaptador; `gitlab-ci` laboratorio/integración opcional.
- CI externa construye y publica. El *Delivery Controller* de BSK recibe artefactos verificables, no ejecuta toda CI dentro del Control Plane.
- Jenkins/GitHub/GitLab ejecutan equivalentes lógicos `bsk validate`, `bsk test`, `bsk build`, `bsk release publish`, `bsk deploy plan`, `bsk deploy apply`.
- Webhooks autenticados: verificar firma, replay protection, idempotencia, permisos y relación al repositorio/proyecto. No aceptar inputs como shell libre.
- Registrar calidad y estado de cada check sin disfrazar skips como tests pasados.
- Separar build runners de hosts de producción; límites de concurrencia y capacidad de la cola por runner, proyecto y host.
- Secrets: credenciales por proyecto y mínimo privilegio, OIDC cuando el proveedor lo admita, inventario y rotación, sanitización en logs.
- CD: bloquear de forma explícita env desconocido, despliegues que exceden cuotas, firma/digest no aceptados, políticas fallidas y aplicaciones no autorizadas.

### 3B.3 Ejemplo ilustrativo de pipeline por proyecto (no implementado)

```yaml
apiVersion: bsk.dev/v1alpha1
kind: DeliveryPipeline
metadata:
  name: crm-web
  project: crm
spec:
  source:
    provider: github
    repository: organization/crm
  trigger:
    branches: [main]
    pullRequestPreview:
      enabled: true
      ttl: 24h
  ci:
    provider: github-actions
    tasks: [unit-tests, integration-tests, e2e, sast, sca, secret-scan, sbom, build-image]
  artifact:
    type: oci
    immutable: true
    signatureRequired: true
  delivery:
    dev:
      trigger: auto
    staging:
      trigger: approved-promotion
    production:
      trigger: manual-approval
      healthGate: true
      rollbackOnFailure: true
```

`DeliveryPipeline` y las propiedades anteriores deben consolidarse en **un contrato JSON Schema versionado**, nunca interpretarse como YAML libre de comandos ejecutables. La compatibilidad real de controles (firmas, promociones, despliegue sin downtime) depende del driver y debe anunciarse mediante `capabilities`.

### 3B.4 Pruebas de aceptación CI/CD

- Dos proyectos A y B tienen repositorios, permisos, secretos y pipelines diferentes: un push en A **no** despliega B.
- `prod` recibe el mismo **digest** que pasó QA/Staging; no reconstruye.
- PR-preview se crea y se destruye por TTL sin borrar volúmenes de otros proyectos.
- Dos despliegues concurrentes al mismo ambiente se serializan; despliegues a ambientes independientes pueden paralelizar hasta las cuotas.
- Un rollout que falla su readiness retorna estado FAILED y revierte el artefacto cuando es seguro; el reporte declara si la DB requiere intervención.
- Una credencial o permiso de proyecto A no funciona en B. Log de CI/CD nunca incluye un secreto.
- Proyecto con pipelines deshabilitados puede usar despliegue manual aprobado, sin romper otros proyectos.
- Errores de CI no se confunden con errores de despliegue, ni los despliegues iniciados se registran como completados.

## 3C. RESOURCE GOVERNANCE: cuotas reales por proyecto y ambiente (v3)

### 3C.1 Dos niveles: presupuesto y ejecución

**Nivel declarativo:** `HostCapacity`, `ResourceClass`, `ProjectBudget`, `EnvironmentQuota`, `ServiceResources`, `BuildBudget`, `BackupBudget`, `StoragePolicy` y `CostBudget`.

**Nivel efectivo:** límites concretos aplicados por Docker/cgroups/Compose o K3s/Kubernetes, cuota de almacenamiento **sólo si el filesystem/driver la puede aplicar**, telemetría real y alertas. El Control Plane debe mostrar por separado `desired`, `admitted`, `effective`, `observed` y `usage`; nunca confundir un valor YAML con una garantía aplicada.

**Recursos mínimos:**
- `cpu.request` y `cpu.limit` (millicores/cores), `memory.request` y `memory.limit` (MiB/GiB);
- límites de PIDs, ulimits, número de réplicas y procesos de build;
- volúmenes/persistencia, capacidad y retención; espacio para snapshots/backups;
- logs por proyecto (retención, bytes), límites operativos por worker/cola y concurrencia CI/CD;
- red: aislamiento/permisos primero; ancho de banda sólo tras validar soporte de enforcement real;
- gastos estimados por host, proyecto y proveedor, con umbral de alerta; **estimación no es facturación del proveedor**.

**Capacidad del VPS:** deducir reservas del SO, Docker, proxy, Control Plane, observabilidad, buffers y backups antes de contabilizar capacidad asignable. No hacer placement en función únicamente del uso instantáneo; sumar requests/reservas, topología, requisitos de región/privacidad y margen operativo. Rechazar `plan/apply` si el presupuesto se excede. No crear una capacidad de CPU/IO reservada ficticia en Compose.

**Kubernetes:** convertir a requests/limits + `ResourceQuota`/`LimitRange`, asociar namespace/labels y RBAC; quotas son por namespace y no bastan para aislar tenants mutuamente hostiles. `NetworkPolicy` según CNI comprobado.
**Compose:** traducir los valores admitidos a los campos compatibles con el modo de ejecución probado y verificar con inspección de contenedores/cgroups; declarar límites no soportados como `unsupported` o fallar por política, no falsear éxito.
**Storage:** probar filesystem/volúmenes contra la cuota declarada; si no está soportado, impedir modo `enforce` y ofrecer monitoreo/alerta con advertencia visible.
**Costos:** presupuestos por ambiente, alertas e informes por VPS; integración de facturas cloud como capacidad futura, con costos compartidos repartidos mediante regla explícita.

### 3C.2 Ejemplo de cuotas: demostración, NO implementado

```yaml
apiVersion: bsk.dev/v1alpha1
kind: ProjectBudget
metadata:
  name: data-signal
spec:
  scope:
    project: data-signal
    environment: production
  policy: deny-overcommit
  allocations:
    cpu:
      requests: "1500m"
      limits: "3000m"
    memory:
      requests: "2048Mi"
      limits: "4096Mi"
    persistentStorage:
      monitoredBudget: "20Gi"
      enforcement: best-effort
    build:
      concurrentJobs: 1
      maxDuration: "30m"
    logs:
      retention: "14d"
  alertThresholds: [70, 85, 95]
```

La semántica de suma es obligatoria: el presupuesto de un proyecto engloba **todos los servicios y réplicas de ese entorno**, y no se cuenta dos veces un servicio compartido sin reglas de cost/allocation explícitas.

### 3C.3 Pruebas de aceptación de recursos

- Dos proyectos A/B comparten un VPS. A consume CPU/RAM; B conserva sus límites y no pierde permisos/visibilidad.
- Un despliegue que excede las reservas o cuota declarada falla antes de mutar servicios, con razón explicable.
- Se configuran límites de RAM/CPU del contenedor; la inspección del runtime confirma la configuración efectiva.
- Un servicio supera la memoria: sistema detecta OOM y informa salud degradada, sin prometer que nunca hay riesgo al host.
- El dashboard muestra `límite declarado`, `límite aplicado`, `uso real`, `capacidad libre` y `costo estimado`.
- En Kubernetes, `ResourceQuota` impide admisiones que superan presupuesto del namespace.
- Cuotas no soportadas (ejemplo: bytes estrictos de volumen en un backend sin quota) no se anuncian como efectivas.
- Se prueban tres escenarios de capacidad: VPS muy pequeño, VPS compartido y múltiples VPS, con margen para el SO.

## 3D. Control de estado y confiabilidad operacional (v3)

**Reconciliation loop:** almacenar `desired state`, `observed state`, diff, `operations`, lock/lease de propietario, reconciliación idempotente, backoff y reintento. Operación declarativa sin necesidad de ejecutar scripts del repositorio arbitrariamente. `plan` debe calcular cambios y dependencias; `apply` solo ejecuta un plan firmado/identificable y autorizado; las operaciones peligrosas requieren confirmación y backup.

**Control Plane HA y recuperación:** backups/restore de BD de control, inventario reconstruible, rotación de credenciales, actualización con migraciones seguras, reconciliación cuando un VPS vuelve a estar disponible y posibilidad de reactivar un host sin reinstalar contenedores.

**Rendimiento y fiabilidad:** establecer SLOs explícitos por servicio y entorno, no imponer cifras arbitrarias a cualquier VPS; instrumentación OTLP sin filtrar PII/secretos; trazas, métricas, logs y alertas. Fijar RPO/RTO por categoría de proyecto, runbooks de incidente, restores probados y evidencia.

**Seguridad operativa:** control de acceso por proyecto y ambiente, SSO/OIDC, MFA por proveedor, cuentas de servicio, audit logs inmutables o protegidos, API rate limits, validación SSRF, protección webhooks, imagen firmada, SBOM, vulnerability scans, políticas de egress y Tailscale de privilegio mínimo. El servidor Edge nunca monta `docker.sock` ni dispone de credenciales globales. El acceso de agente IA requiere `read/plan` por defecto y aprobación en mutaciones críticas; no se aceptan instrucciones hostiles desde contenidos de repos o logs.

**Cumplimiento legal y soberanía:** las jurisdicciones son políticas versionadas y revisadas por humanos; residencia de datos, transferencias, DSR, retención, subprocessors, control de IA y trazabilidad. Ninguna evaluación técnica afirma cumplimiento legal total. Separar secretos y datos sensibles de la telemetría.

**Modelo multi-host real:** un servicio persistente no se declara altamente disponible por duplicar contenedores. Para multi-VPS requiere estrategia de ingress/LB, sesiones, volúmenes, replicación de DB, migración expand/contract, consistencia, failover verificado y RPO/RTO. Implementación incremental.

## 3E. Experiencia de producto: qué tendrá la consola (v3)

Paneles operativos mínimos después de los contratos:
- `Portfolio`: organizaciones, proyectos, owners, ambientes, etiquetas, costes.
- `Project > Services`: componentes, versiones, dependencias, dominios y conectividad.
- `Project > Delivery`: repos, pipelines, estado CI, artefactos, releases, aprobaciones, deployment history, rollback.
- `Project > Resources`: CPU/RAM requests/limits/real, disco, cuota, alertas y capacidad de cada VPS, costo estimado.
- `Project > Security & Compliance`: SAST/SCA/SBOM, vulnerabilidades, políticas, residencia, evidencia y revisión legal.
- `Servers`: capacity, Tailscale, edge, backups, storage y salud.
- `Observability`: logs, traces, métricas, SLOs, alertas, incidentes.
- `Catalog`: Golden Paths Java/React/Angular, módulos de WordPress/Supabase/n8n/SeaweedFS, ejemplos y documentación.

CLI/API/MCP deben compartir los mismos permisos y controlador; dashboards son lecturas del estado real y operaciones mediadas, no acceso directo a Docker/SSH/Cloudflare.

## 3F. Contratos de adaptador y portabilidad (v3)

Con interfaces versionadas y `capabilities` negociadas:
- `SourceProvider` (GitHub/GitLab), `PipelineProvider` (Actions/Jenkins/GitLab), `ArtifactRegistry` (OCI),
- `DeploymentDriver` (Compose/Kubernetes/Coolify opcional), `ProvisioningProvider` (OpenTofu/cloud),
- `IngressDriver` (Nginx/Caddy/Gateway API), `PrivateConnectivity` (Tailscale/SSH alternativo),
- `SecretStore`, `ResourceMetering`, `ResourceEnforcement`, `PolicyEvaluator`, `ComplianceEvidence`.

Probar una misma aplicación con el **mismo digest OCI** en Compose y K3s. No suponer equivalencia de features no disponibles por driver; exponer `capabilities` efectivas y errores explícitos. Inspirarse en el estándar abierto Score para especificar cargas de trabajo sin convertir Humanitec o Score en dependencia de núcleo.

## 3G. Metodología de entrega para los agentes (v3)

Cada cambio incluye:
1. ADR o especificación pequeña que indique problema, alternativas, tradeoffs y límites.
2. Contrato (schema + validación + migración) y tests unitarios, de integración y de seguridad pertinentes.
3. Driver/adaptador real con pruebas del efecto observado (no sólo pruebas de parseo YAML).
4. CLI/API y luego UI sobre misma capa; trazabilidad `project/env/service/operation`.
5. Runbook, amenazas, límites conocidos y capacidad anunciada `preview/GA` verificada.
6. PR pequeño, aislado, con CI verde, revisor distinto al implementador y sin cambios en infraestructura real sin aprobación.

**Paralelización:** primero freeze del esquema `Project/Service/Environment/Deployment` y de API; después CI/quotas/UI pueden dividirse entre agentes distintos. Evitar que dos agentes editen los mismos contratos en ramas sin sincronización. Prohibidos cambios de producción, DNS y Tailnet sin autorización concreta.

**V3 modifica el roadmap existente así:**
- PR0 incorpora ADR de `PipelineDefinition/PipelineRun/Release/Promotion` y `ResourceBudget/Quota/Enforcement`, más matriz `Coolify/Humanitec/BSK` sin declarar superioridad no demostrada.
- PR1 añade contratos y validadores de recursos/pipelines.
- PR2 aplica límites Compose y prueba admisión de recursos; ya no basta con aislar contenedores.
- PR3 incorpora vista de recursos, pipelines e historial al dashboard básico (solo lo realmente implementado).
- PR5 se divide en **PR5a**: pipeline por proyecto con GitHub Actions y artefactos inmutables; **PR5b**: Jenkins como proveedor alternativo; **PR5c**: promoción, aprobación, rollback, límites de builds/preview efímero. GitLab CI opcional como PR posterior.
- PR8 aplica ResourceQuota/LimitRange en K3s y prueba fallos de cuota.
- PR9 agrega presupuesto de hosts, capacidad de placement y estimación de costos multi-host.
- PR12+ despliega paneles avanzados y SLOs sin adelantarlos a sus servicios API.

## 3H. Gate de lanzamiento: no llamar “PaaS enterprise” a un esqueleto (v3)

**MVP VPS:** 1 host, 3 proyectos, N ambientes, 6 dominios, proxy seguro, recursos aislados, backups restaurables y rollback de despliegue seguro.
**MVP Platform Developer Experience:** generar app Java+React o Angular; CI por proyecto -> OCI digest -> deploy Compose, pruebas E2E, logs/trazas, límites y secretos por proyecto, dashboard consistente.
**MVP Orchestrator:** 2 VPS, placement explícito, reconciliación, fallo de host aislado, release consistente, registro y alertas.
**Enterprise-readiness (posterior):** HA del Control Plane y gateway entre hosts, auditorías de terceros, SLO medidos, aislamiento de tenants con distintos niveles de confianza, tests de seguridad adversariales, operador de incidentes, política de licencias/SBOM y migraciones/restores verificadas.
**Compliance-readiness (posterior):** al menos una jurisdicción implementada con revisión legal, evidencia de controles y casos de derechos de titulares; nunca “legalidad automática”.
**Posicionamiento competitivo:** medir tiempo de primer deploy, cantidad de clics/pasos, tasa de éxito, cambios seguros, restorability, costos por workload, cobertura de seguridad y DX. No afirmar superioridad frente a Coolify/Humanitec sin benchmarking reproducible, comparación de versiones y feedback externo.

**Referencias oficiales v3:**
- Coolify límites: https://coolify.io/docs/applications/configuration/resource-limits
- Coolify Build Servers: https://coolify.io/docs/core/infrastructure/servers/build-servers
- Humanitec CI/CD: https://developer.humanitec.com/platform-orchestrator/guides/developers/ci-cd/integrate-your-ci/cd-flows/
- Humanitec Score: https://developer.humanitec.com/platform-orchestrator/docs/score/overview/
- Docker Deploy Resources: https://docs.docker.com/reference/compose-file/deploy
- Kubernetes quota: https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/quota-memory-cpu-namespace/
- GitHub deploy controls: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments

## 4. División del trabajo entre agentes de IA

| Agente / rol | Responsabilidad principal | Artefactos típicos | Restricciones |
|---|---|---|---|
| **A0: Arquitecto / integrador** | Auditoría, ADR, contratos, dependencias, roadmap, revisión de PR | ADR, esquema, backlog | No introducir arquitectura imaginaria ni fusionar sin tests |
| **A1: Core + CLI** | Entidades, proyectos, ambientes, servicios, dominio/rutas, validadores, CLI y contratos | `packages/`, `contracts/`, `bsk`, tests | No tocar VPS ni añadir comandos destructivos sin guardas |
| **A2: Infra / operaciones** | Multi-proyecto Compose, proxy único, dominios/TLS/DNS, bootstrap, Tailscale y backups | `infra/`, `scripts/`, tests de integración | Nunca tocar hosts reales; pruebas desechables |
| **A3: Delivery / platform** | CI/CD, Jenkins, GitHub Actions, GitLab, K3s/Helm, OpenTofu, OTel | workflows, charts, IaC, runbooks | No duplicar políticas de build en cada pipeline |
| **A4: Golden Paths / CMS** | Java, React, Angular, Spring, WordPress, Supabase, n8n, agentes IA | templates, demos, e2e | No hacer obligatorios los servicios opcionales |
| **A5: Seguridad / privacidad** | Modelado jurisdiccional, políticas, DSR, auditoría, filtrado de datos en IA | compliance packs, tests de policy | No declarar conformidad jurídica; revisión humana |
| **A6: Dashboard / UX** | React, proyectos/ambientes/servicios/dominios, operaciones, RBAC y estado en tiempo real | `apps/web`, UI tests | API primero, no lanzar comandos shell desde UI |
| **A7: Reviewer independiente** | Calidad, seguridad, licencias, reproducibilidad, pruebas negativas | informe de review | No aprobar su propio código |

**Orquestación:** un agente por rama funcional; trabajos paralelos **sólo si sus interfaces están acordadas y no editan los mismos archivos**. Integrar en PRs secuenciales, con CI y revisión humana. Ningún agente autónomo obtiene permiso general para alterar prod.

## 5. Backlog ordenado en PR pequeños

### PR0 — Inventario y contratos de arquitectura (A0 + A7)

- Inspeccionar `main`, README, ADR, manifiestos, scripts, Dockerfiles, Compose, CI, estado de módulos y pruebas.
- Crear matriz `Implemented / Preview / Planned`, detectar versiones y dependencias incompatibles.
- Documentar ADR: control plane compartido, jerarquía `Host/Project/Environment/Service/Deployment/DomainBinding`, route registry, gateway por host, Tailnet/SSH, API común, secretos y límites de confianza.
- Definir criterios de aceptación y plan de migración sin romper los ejemplos existentes.
- **Aceptación:** documentación precisa, tests base enumerados con resultados y riesgos visibles; sin cambios operativos sobre infraestructura.

### PR1 — Modelo de ambientes + CLI no destructiva (A1)

- Esquema YAML/JSON versionado para instalaciones, hosts, proyectos, ambientes, servicios, despliegues, dominios, puertos, rutas, cuotas, redes, runtime y secretos referenciados; sin valores secretos.
- `bsk doctor`, `bsk host list`, `bsk project create/list`, `bsk env create/list/show/validate/plan`, `bsk domain validate`; el modo inicial sólo muta manifiestos locales versionados, no hosts remotos.
- Validación de IDs estables, pertenencia proyecto/ambiente, dominios verificados o reservados, recursos, duplicados, rutas, reserved paths, nombres maliciosos y ownership; migrador no destructivo de perfiles históricos.
- **Aceptación:** tests de 1, 5 y 10 ambientes arbitrarios **en varios proyectos de un host**, 0/1/N servicios y dominios; rechazar colisiones y escalación de RBAC; `doctor/plan` sin mutaciones; sin límite codificado.

### PR2 — Docker Compose multi-proyecto, proxy por host y rutas dinámicas (A1 + A2)

- Al menos dos proyectos y dos ambientes simultáneos **sobre un mismo host**; Compose project name único por deployment. Quitar `container_name` fijo, separar redes, recursos y volúmenes; prohibir publicación de base de datos accidental.
- Un único EdgeGateway Caddy **o** Nginx en 80/443 para todos los proyectos; implementar registry de dominios/rutas, configuración generada, validación y recarga atómica/rollback. No inventar certificados ni DNS reales en pruebas; utilizar DNS/test CA local.
- `bsk env up/status/logs/down`, `bsk project status`, `bsk domain attach/plan` con locks, healthcheck y dry-run; `down` nunca borra datos, `destroy` separado.
- **Aceptación:** 3 proyectos y 3 ambientes con **al menos 6 dominios de prueba** y un único proxy, incluyendo dos dominios para un servicio y rutas por path para distintos servicios; probar colisiones, cabeceras maliciosas, rollback proxy, no exposición privada y que detener uno no afecte a los demás.

### PR3 — API central + primer dashboard (A0 + A6)

- API autenticada con inventario host/proyecto/ambiente/aplicación/servicio/dominio/edge, estado observado, historial de despliegues y operaciones en cola. CRUD de configuración separado de ejecución privilegiada.
- Dashboard React mínimo: Overview, Hosts, Projects, Environments, Services, Domains, Operations. Visualizar estados reales y errores, rutas públicas vs privadas; RBAC por proyecto, auditoría y CSRF/CORS según arquitectura.
- CLI y web llaman la misma capa de operaciones; no añadir SSH directo en el navegador.
- **Aceptación:** desde UI y CLI gestionar un proyecto con múltiples servicios y dominios sin duplicar lógica; ambas rutas llegan al mismo reconciler, con autorización por proyecto e historial; sin credenciales en respuestas/logs.

### PR4 — Bootstrap VPS + Tailscale + edge (A2 + A7)

- Primer SO soportado explícitamente (Debian/Ubuntu LTS tras validación); installer reejecutable `bsk bootstrap --plan/--dry-run`; detectar instalaciones preexistentes.
- Instalar/configurar Docker, Compose, firewall de forma segura, estructura de carpetas, backups, gateway por host Nginx **o** Caddy, Tailscale en host como perfil opcional recomendado. Verificar acceso y consola de rescate antes de restringir SSH.
- Cloudflare DNS + Full (strict) **o** Tunnel como perfiles diferentes; permisos DNS mínimos, rutas públicas sólo opt-in, comprobación de dominio controlado y cadena de proxies; no confiar en IP aportada por clientes directos.
- **Aceptación:** bootstrap dos veces en host efímero sin pérdida de acceso/datos; host en Tailnet accesible antes de cerrar SSH público; falla simulada de Tailnet con recuperación alternativa; admin sólo por red privada; múltiples dominios funcionan y el rollback de gateway no afecta otras aplicaciones.

### PR5 — CI/CD y DevSecOps (A3 + A7)

- Comandos únicos `bsk test`, `bsk build`, `bsk deploy` (o equivalentes), reutilizados por GitHub Actions y Jenkins; GitLab CI opcional para laboratorios.
- SBOM, SCA, secretos, escáner de contenedores y pruebas de contratos; imágenes por SHA/digest inmutable; aprobaciones de prod y rollback.
- Despliegue remoto privado por Tailscale o medio seguro alternativo, verificación de host SSH, sin credenciales persistentes innecesarias.
- **Aceptación:** mismo artefacto desplegable desde Actions/Jenkins, no requiere ejecutar ambos; `deploy` a entorno desconocido rechaza y no permite inyección de shell.

### PR6 — Golden Path full-stack empresarial (A4)

- JDK **25 LTS por defecto** + Spring Boot compatible y soportado; mantener plantillas o pruebas de compatibilidad para Java 17/21 cuando tenga sentido en banca.
- Aplicación funcional: organizaciones/tenants, usuarios, OIDC, roles, proyectos, persistencia PostgreSQL, Flyway, auditoría y OpenAPI.
- Dos clientes independientes: React + TypeScript y Angular + TypeScript; tests unitarios, integración y Playwright e2e.
- **Aceptación:** login, permisos, CRUD y aislamiento de tenant probados; ambas interfaces consumen el mismo contrato API; construcción en contenedores.

### PR7 — Observabilidad y resiliencia (A3)

- OTel SDK/auto-instrumentación, Collector OTLP, backend demo para métricas/trazas/logs; correlación trace ID y redacción de PII/secretos.
- Health/readiness, errores deliberados, dashboard, backups con restauración probada y runbooks.
- **Aceptación:** seguir una petición frontend→API→worker, diagnosticar un error deliberado y restaurar un backup en entorno efímero.

### PR8 — Kubernetes/K3s y Helm (A3)

- Mismos artefactos OCI y configuraciones deseadas en Compose y K3s; un namespace y release Helm por ambiente, cuotas, límites y políticas de red cuando estén soportadas.
- Gateway API con implementación mantenida o Ingress compatible, sin afirmar aislamiento fuerte por namespaces únicamente.
- **Aceptación:** deploy por digest en K3s, healthchecks, rollback y control de permisos; lab no requerido para BSK mínimo en VPS.

### PR9 — Multi-VPS, proveedores cloud e integración Coolify (A2 + A3)

- Registry de varios hosts con múltiples proyectos en cada uno; placement explícito, conectividad segura por host, reconciliación de despliegues, disponibilidad del gateway y aislamiento de fallos.
- OpenTofu desde un proveedor cloud **por PR** (empezar por proveedor elegido y probado), plan/apply con aprobación y presupuestos; no prometer HA multi-cloud sin replicación, failover y recuperación comprobados.
- Adaptador Coolify por API opcional, con inventario/capacidades y tests; no acoplar todo BSK a Coolify.
- **Aceptación:** dos VPS desechables o simulados, fallo de uno no borra el estado del otro; provisioning cloud opcional y plan visible.

### PR10 — Servicios optativos, CMS y agentes de contenido (A4 + A5)

- Perfiles seleccionables Supabase/PostgREST, SeaweedFS S3, Redis, n8n, WordPress con MariaDB/MySQL separado.
- WordPress tradicional primero y headless como opción; API REST, credenciales mínimas; flujo IA `fuentes → borrador → verificación → revisión humana → publicación` con deduplicación, auditoría y protección de PII.
- **Aceptación:** desplegar sin WordPress ni n8n; habilitarlos en un ambiente de prueba no altera los demás; ninguna publicación automática sin política habilitada.

### PR11 — Privacy & Compliance Engine (A5 + A7 + revisor jurídico humano)

- Paquetes jurídicos versionados: jurisdicción, fuente oficial, vigencia, condiciones de aplicación, controles automáticos, excepciones y estado de revisión humana.
- Primera jurisdicción: Chile, Ley 21.719 (entrada en vigor 01-12-2026). Extender después a GDPR, LGPD y otras normas por iteraciones independientes, con especialistas.
- Inventario y clasificación de datos, bases/finalidades, tratamientos, retención, solicitudes de titulares, transferencia, incidentes, evidencia e informes de brechas; políticas de salida de información hacia IA y observabilidad.
- **Aceptación:** prueba de solicitud de eliminación con excepción legal modelada; evidencia de controles `passed/failed/not-applicable/not-evaluated`, sin convertir resultados técnicos en certificación legal.

### PR12+ — Dashboard avanzado y operabilidad del producto (A6 + A7)

- Paneles de servidores, proyectos, N ambientes, logs, métricas, redes, bases de datos, pipelines, compliance y automatización con IA.
- Accesibilidad, permisos granulares, alertas, paginación, respaldo de estado, seguridad del control plane; UX equiparable en tareas básicas a una PaaS, no clon visual.
- **Aceptación:** pruebas de autorización, UX, contratos API, estado consistente, carga degradada, reintentos y operaciones concurrentes.

## 6. Estrategia para los agentes al ejecutar cada PR

Para cada PR, seguir este contrato:

1. **Leer** el plan, ADR, código real y pruebas de su ámbito. Declarar dependencias y alcance máximo.
2. **Planificar** por archivos, riesgos, criterios de aceptación, comandos de prueba, migración y rollback. No inventar interfaces futuras.
3. **Implementar** la mínima sección vertical completa: código + tests + docs + CI. Preferir cambios incrementales que mantengan operativos los ejemplos antiguos.
4. **Probar** ruta feliz y rutas negativas. Si Docker/Maven/servicios no están disponibles, decir exactamente qué no se ejecutó.
5. **Revisar** con A7; revisar vulnerabilidades, control de secretos, aislamiento, permisos y licencias.
6. **Entregar** PR con cambios, pruebas, riesgos y comandos exactos de reproducción. No fusionar ni desplegar automáticamente en infraestructura ajena.

Un PR no puede ser “exitoso” si sólo genera archivos vacíos, README, mock sin contrato o capturas simuladas. La UI podrá mostrar datos ficticios únicamente cuando esté rotulada inequívocamente como demo.

## 7. Pruebas de aceptación transversales

- 1, 5 y 10 entornos configurados, repartidos entre 3 proyectos; como mínimo 3 proyectos simultáneos en 1 host con 6 dominios de prueba y 1 proxy 80/443. Probar dominio múltiple por aplicación, path routing y ausencia de colisiones. No confundir cantidad permitida con capacidad real.
- `doctor`, `plan`, `validate` no realizan cambios; `bootstrap` reejecutable; `down` conserva volúmenes; `destroy/restore` exige protección y registra acciones.
- Secrets nunca se registran; interfaces, workers y CI aplican RBAC y permisos mínimos; prueba de cabeceras `X-Forwarded-For` falsificadas.
- Una aplicación Spring/React y otra Spring/Angular con tests de autenticación, autorización, aislamiento, persistencia y e2e.
- Artefacto OCI con digest reproducible promovido de dev a prueba; tests de deploy y rollback en Compose; equivalencia en K3s cuando esté implementado.
- Administración por Tailscale sin abrir paneles internos al público, grants/tags verificados y acceso fuera de banda si falla la Tailnet; pruebas de que conexión Tailnet no sustituye login/RBAC.
- Backup restaurado en host desechable, sin afectar a otros ambientes.
- OpenTelemetry puede trazar llamadas entre servicios sin registrar datos personales innecesarios.
- Compliance registra evidencia, incertidumbre y decisiones humanas; no declara automáticamente “GDPR compliant” ni “cumple toda legislación”.
- No cargar todos los servicios por defecto. Tests de laboratorio deben evitar facturación y cambios externos por defecto.

## 7A. Matriz de fallos de aceptación

| Escenario | Resultado exigido |
|---|---|
| Dos proyectos intentan usar `api.example.test` con reglas superpuestas | El segundo es rechazado sin afectar el primero; la reserva es transaccional |
| Un proyecto configura `*.example.test` y otro `app.example.test` | Política de precedencia explícita; conflicto/ownership validado antes de desplegar |
| Dos apps publican 80/443 en el mismo VPS | Sólo el EdgeGateway enlaza 80/443; ningún contenedor de app puede publicar esos puertos directamente |
| Una base de datos intenta aparecer en una ruta pública | `plan` falla por policy: no se genera exposición de servicios `internal/private` |
| `nginx -t`/`caddy validate` falla durante actualización | Mantener last-known-good y no interrumpir otros dominios/proyectos |
| Tailscale cae después de desplegar | Apps públicas siguen atendiendo; operador mantiene procedimiento de rescate y alerta |
| Un operador de proyecto A lee secretos de proyecto B | API deniega por RBAC; no hay exposición por listados, logs ni eventos |
| Agente CI mal etiquetado intenta SSH a producción | Grants/SSH deniegan; test del policy bundle registra el rechazo |
| Dos ambientes usan la misma base de datos sin declararlo | Se rechaza el sharing o requiere política/consentimiento explícito y credenciales segregadas |
| Falla un VPS con un deployment replicado | Se muestra disponibilidad degradada; no declarar failover de datos sin prueba de réplicas/consistencia |
| Control Plane se reinicia | Los servicios existentes no se reinician; estado se reconstruye desde registro persistente y observación |
| Ruta de borrado elimina ambiente A | Sólo recursos etiquetados de A son candidatos; dominios/volúmenes ajenos intactos |

## 7B. Modelo de capacidad y riesgos operativos

La cantidad de proyectos/ambientes es lógicamente ilimitada, pero el Control Plane debe negar deploy por insuficiencia de recursos. Mantener reservas de memoria y disco para el sistema operativo, Docker, edge y observabilidad. Volúmenes, transacciones, backups y bases de datos no se moverán automáticamente entre VPS: primero respaldos/restauración verificados y luego migración con ventana de consistencia. Multi-proyecto en un Docker daemon compartido **no equivale a aislamiento fuerte de tenants hostiles**; el contrato debe describir el nivel de confianza admisible por tipo de despliegue.

## 7C. Dependencias/orden de implementación revisado

- **PR0:** ADRs, modelos, ownership y threat modeling de rutas/dominios/Tailscale.
- **PR1:** contratos `Project/Environment/Service/Deployment/DomainBinding` y CLI sin red.
- **PR2:** Compose multi-proyecto y EdgeGateway multi-dominio en un host efímero.
- **PR3:** Control Plane API y panel Projects/Environments/Services/Domains con RBAC.
- **PR4:** bootstrap remoto seguro, Cloudflare/Tailscale y protección de SSH.
- **PR5+:** mantener roadmap previo; CI/CD, Golden Paths, observabilidad, K3s, multicloud, servicios opcionales y privacidad.

**No paralelizar PR1/PR2 sin congelar los esquemas y las garantías de ownership.** Revisores A0/A7 validan seguridad antes de avanzar a acceso remoto real.

## 8. Primera orden a Codex / Claude Code: PR0 solamente

> Actúa como arquitecto principal y agente de implementación de BSK. Lee `docs/superpowers/plans/2026-10-28-bsk-agent-master-plan-v3.md`, los ADR, contratos, scripts y documentación ya existentes en el repositorio `devzaratech/business-starter-kit`. Crea la rama `docs/bsk-agent-pr0-architecture`. Ejecuta únicamente PR0: inventario real, matriz de capacidades y dependencias, ADR de `Host/Project/Environment/Service/Deployment/DomainBinding`, gateway por host y separación pública/Tailnet, Control Plane/API/CLI/UI, riesgos, diseño mínimo y secuencia de PR1–PR3. Ejecuta los tests base disponibles; registra resultados sin inventar éxitos. No toques VPS, DNS, Cloudflare, Tailnet ni producción. No implementes todos los módulos. Entrega PR o diff, pruebas ejecutadas, riesgos, decisiones y siguiente PR recomendado. Mantén el núcleo open-core y compatibilidad existente.

**Orden posterior:** una vez aprobado PR0, entregar a A1 el PR1 de esquema y CLI; luego PR2 de Compose; luego PR3 de API y dashboard inicial. No dar en paralelo a varios agentes permisos de escritura sobre los mismos archivos o servidores.

## 9. Fuentes oficiales útiles

- BSK (repositorio privado): https://github.com/devzaratech/business-starter-kit
- Docker Compose y nombres de proyectos: https://docs.docker.com/compose/how-tos/project-name/
- Kubernetes multi-tenancy: https://kubernetes.io/docs/concepts/security/multi-tenancy/
- Coolify API (para adaptador opcional): https://coolify.io/docs/api/overview
- OpenTelemetry Collector: https://opentelemetry.io/docs/collector/
- Chile, Ley 21.719: https://www.leychile.cl/leychile/navegar?i=1209272&f=2026-12-01

**Definición de éxito del primer ciclo:** PR0 aprobado, PR1 con múltiples proyectos y ambientes arbitrarios, y PR2 que demuestra 3 proyectos y 3 ambientes en un único VPS desechable con 6 dominios de prueba, 1 proxy y redes privadas aisladas. Después desarrollar API/dashboard y demás capas; no presentar el producto como terminado antes de esas pruebas.

### Referencias ampliadas, modelo heredado de v2

- Docker Compose project name: https://docs.docker.com/compose/how-tos/project-name/
- Docker Compose networking: https://docs.docker.com/compose/how-tos/networking/
- Protección del Docker socket: https://docs.docker.com/engine/security/protect-access/
- Tailscale Grants: https://tailscale.com/docs/features/access-control/grants
- Tailscale tags: https://tailscale.com/docs/features/tags
- Tailscale SSH: https://tailscale.com/docs/features/tailscale-ssh
- Tailscale Services: https://tailscale.com/docs/features/tailscale-services
- Tailscale GitHub Action: https://tailscale.com/docs/integrations/github/github-action
- Tailscale Kubernetes Operator: https://tailscale.com/docs/features/kubernetes-operator
- Cloudflare Full (strict): https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- Kubernetes isolation: https://kubernetes.io/docs/concepts/security/multi-tenancy/

---
**Nota para los agentes:** esta v3 es la hoja de ruta principal, sujeta a revisión del código real y los ADR aceptados. Si el entorno real difiere del baseline, volver a auditar antes de aplicar cambios. No ejecutar cambios remotos sin autorización específica. El proyecto debe distinguir entre *diseño*, *código validado localmente* y *operación real verificada*.