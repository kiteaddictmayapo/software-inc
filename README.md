# Software Inc — Gestión de escuela de deportes acuáticos

App de **escritorio (Windows 11)** que reemplaza y amplía el Excel `software inc.xlsx`.
Corre **100 % local** (sin nube, salvo para enviar correos), guarda los datos en tu equipo y
añade **fotos a los perfiles**, **facturas PDF + envío por correo**, **exportación a Excel** y
**PIN de acceso**.

Construida con **Electron + React + TypeScript + SQLite (better-sqlite3)**.

---

## 0. Demo rápido (sin instalar nada)

Para ver la interfaz funcionando al instante, con **datos de ejemplo** (no reales):

```powershell
npm install        # una sola vez
npm run demo       # abre el demo en el navegador (http://localhost:5174)
```

O genera un **archivo único** que se abre con doble clic (sin servidor):

```powershell
npm run build:demo
# luego abre  demo-dist\index.html  en tu navegador
```

El demo corre 100 % en el navegador (sin base de datos ni Electron) y muestra un banner
**“MODO DEMO”**. Guardar/PDF/correo están desactivados en el demo; son de la app instalada.

---

## 1. Requisitos (en el PC Windows 11)

1. **Node.js 20 LTS** — https://nodejs.org (instalador .msi).
2. Para compilar los módulos nativos (better-sqlite3, sharp), normalmente basta con los
   **prebuilds** que se descargan solos. Si tu equipo pide compilar, instala también
   **“Desktop development with C++”** de Visual Studio Build Tools y Python 3
   (o ejecuta `npm install --global windows-build-tools` en una consola de administrador).

## 2. Instalación

Abre **PowerShell** en la carpeta `software-inc-app` y ejecuta:

```powershell
npm install
```

> `npm install` ejecuta al final `electron-builder install-app-deps`, que **recompila
> better-sqlite3 y sharp para la versión de Electron**. Esto es obligatorio en el equipo donde
> vas a usar/empaquetar la app. (En un Mac de desarrollo puedes usar `npm install --ignore-scripts`
> para solo revisar el código, pero para ejecutar la app hay que hacer el rebuild).

## 3. Ejecutar en desarrollo

```powershell
npm run dev
```

Se abre la ventana de la app. La **primera vez**:
1. Crea un **PIN** de acceso.
2. Pulsa **“Seleccionar Excel e importar”** y elige tu `software inc.xlsx` para cargar todo el
   histórico (clientes, profesores, proveedores, catálogo, transacciones, gastos, bar, plan de
   pago). O elige **“Empezar de cero”**.

## 4. Empaquetar el instalador .exe (Windows 11)

```powershell
npm run package:win
```

Genera el instalador en `dist\Software Inc-Setup-<versión>.exe` (NSIS: doble clic, elige carpeta,
crea accesos directos). Alternativa portable (sin instalar): `npm run package:portable`.

> Sin firma de código, Windows SmartScreen puede advertir la primera vez → “Más información →
> Ejecutar de todas formas”. Para distribuir a terceros, considera un certificado de firma.

## 5. ¿Dónde se guardan los datos?

Todo bajo `%APPDATA%\Software Inc\` en tu Windows:

```
%APPDATA%\Software Inc\
├─ data\      escuela.db          (base de datos SQLite)
├─ media\     persons\<id>\...    (fotos de perfiles)
├─ exports\   facturas PDF, reportes .xlsx
└─ backups\   copias automáticas de la BD
```

- **Respaldos:** se crea una copia automática al abrir (si la última tiene > 24 h) y puedes crear
  una manual en **Ajustes → Respaldos**. Recomendación: copia la carpeta `backups\` a un USB u OneDrive.

## 6. Enviar facturas por correo

En **Ajustes → Correo (SMTP)** configura tu servidor de salida. Con **Gmail**:
- Servidor `smtp.gmail.com`, puerto `587`.
- Usuario: tu correo. Contraseña: una **“contraseña de aplicación”** (requiere verificación en 2
  pasos en tu cuenta Google). Pulsa **Probar conexión**.
- La contraseña se guarda **cifrada** con la protección de datos de Windows (DPAPI).

Luego, en **Facturación**: elige cliente → **Guardar factura** → **PDF** o **Enviar por correo**.

## 7. Funcionalidades

Personas (con foto) · Catálogo de servicios/precios y equipos · Transacciones con **motor de
precios** y salario del profesor automáticos · **Bar** (POS + inventario/stock) · Gastos ·
**Facturación** de cliente (descuentos, +5 % tarjeta, PDF, correo) · **Liquidación mensual** de
profesores (PDF) · **Finanzas** (balance diario, resumen mensual, estadísticas de edades) ·
**Planes de pago** / amortización · **Ajustes** (empresa, SMTP, PIN, respaldos).

## 8. Qué se corrigió respecto al Excel

- **Autodetección de curso** (antes `#REF!`): se recalcula por horas acumuladas del cliente, sin errores.
- **Fechas de nacimiento inválidas** (p. ej. `17/08/`, edades negativas): se aíslan en cuarentena y
  se excluyen del histograma, sin perder la persona.
- **Bar plenamente funcional**: POS + inventario con control de stock.
- **Ingreso de clientes en balance/resumen**: ahora usa el **valor real de los servicios prestados**
  (transacciones), no la columna `Paid?` del Excel que estaba casi vacía.
- **Liquidación de profesores**: ya **no** descuenta automáticamente los gastos de `Outcome` a nombre
  del profesor (en el Excel esos registros solían ser su propio pago; restarlos daba netos negativos).
  Se muestran como referencia para decidir caso por caso.
- **Dinero en pesos enteros (COP)** con redondeo consistente.

## 8.b Distribución al cliente por internet (GitHub)

El instalador `.exe` se compila **en la nube** con GitHub Actions (no necesitas una PC Windows) y
se publica en **GitHub Releases**. Para publicar una versión:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Eso dispara el workflow `.github/workflows/release.yml` (runner `windows-latest`), que compila y
sube el instalador. **El cliente descarga desde este link permanente:**

```
https://github.com/<TU-USUARIO>/software-inc/releases/latest/download/Software-Inc-Setup.exe
```

(o desde la página `https://github.com/<TU-USUARIO>/software-inc/releases/latest`). Sin firma de
código, Windows SmartScreen puede advertir la 1.ª vez → “Más información → Ejecutar de todas formas”.

## 8.c Qué NO se sube al repositorio

El `.gitignore` excluye todo lo sensible: `node_modules/`, `out/`, `dist/`, `demo-dist/`,
`media/`, `backups/`, `exports/`, `*.db*`, **`*.xlsx` (el Excel real con datos de clientes)** y la
carpeta **`private/`**. Guarda en `private\` cualquier cosa que deba quedarse solo en tu equipo (la
copia del Excel real, certificados, notas). El repo contiene **solo código**, nunca datos de clientes.

## 9. Pruebas (verificación)

```powershell
npm test                                   # 18 tests del núcleo de negocio (fórmulas portadas)
npx tsx test\integration.ts "..\software inc.xlsx"   # import + finanzas + facturación end-to-end
npx tsx src\main\services\importCli.ts "..\software inc.xlsx"   # reporte de importación
```

La importación del Excel real produjo: **635** filas de clientes (586 tras deduplicar), **82**
profesores, **42** proveedores, **1.513** transacciones, **167** servicios, **22** equipos, **18**
productos de bar y **9** abonos del plan de pago; **9** filas problemáticas quedaron en cuarentena.

## 10. Estructura del proyecto

```
src/main/        proceso Electron: db (esquema+migraciones), repositories, services, ipc, templates
src/preload/     puente contextBridge (window.api tipado)
src/renderer/    UI React (features por módulo, componentes, estilos)
shared/types/    tipos de dominio y contrato de la API
test/            tests de dominio + integración
```
