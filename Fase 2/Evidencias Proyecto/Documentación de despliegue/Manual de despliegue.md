# Manual de despliegue de CampusLink

## 1. Objetivo

El presente manual describe los pasos necesarios para instalar, configurar y ejecutar el proyecto **CampusLink** en un entorno local de desarrollo.

El sistema está compuesto por un **frontend desarrollado con React Native y Expo** y un **backend basado en Node.js**, cuya ejecución se realiza mediante **Docker Compose**.

---

## 2. Requisitos previos

Antes de comenzar, se debe contar con las siguientes herramientas instaladas en el equipo:

- Git.
- Node.js.
- npm.
- Docker Desktop.
- Expo Go, en caso de ejecutar la aplicación desde un dispositivo móvil.

También se debe disponer de acceso al repositorio del proyecto y de las variables de entorno necesarias para configurar correctamente el backend.

---

## 3. Clonar el proyecto

El primer paso consiste en clonar el repositorio del proyecto en el equipo local.

Desde una terminal, ejecutar:

```bash
git clone <https://github.com/Qvverty72/CampusLink>
```

Una vez finalizada la descarga, el proyecto queda disponile.


---

## 4. Instalar las dependencias del frontend

Abrir una terminal y dirigirse a la carpeta correspondiente al frontend:

```bash
cd frontendclink
```

Instalar las dependencias del proyecto ejecutando:

```bash
npm install
```

Este comando descargará todas las dependencias necesarias para ejecutar la aplicación móvil y web.

---

## 5. Instalar las dependencias del backend

Abrir una segunda terminal y dirigirse a la carpeta correspondiente al backend:

```bash
cd backendclink
```

Luego ejecutar:

```bash
npm install
```

Esto instalará las dependencias necesarias para el funcionamiento del servidor.

---

## 6. Configurar las variables de entorno

Dentro de la carpeta del frontend y backend se debe crear o configurar el archivo:

```text
.env
```

En este archivo se deben ingresar las variables de entorno necesarias para la conexión con los distintos servicios utilizados por CampusLink, como MongoDB, Supabase y la configuración general del servidor.

La estructura puede basarse en el archivo:

```text
.env.example
```

Es importante verificar que todas las variables requeridas tengan valores válidos antes de iniciar el servidor.

---

## 7. Levantar el backend mediante Docker

Antes de ejecutar el backend, se debe iniciar **Docker Desktop** y comprobar que se encuentre funcionando correctamente.

Desde la terminal ubicada en la carpeta del backend, ejecutar:

```bash
docker compose up -d --build
```

El parámetro `--build` permite construir nuevamente las imágenes necesarias, mientras que `-d` ejecuta los contenedores en segundo plano.

Para comprobar que los contenedores se encuentran funcionando se puede utilizar:

```bash
docker compose ps
```

Si la configuración de las variables de entorno es correcta y los servicios se levantaron correctamente, el backend quedará disponible para recibir solicitudes desde el frontend.

---

## 8. Iniciar el frontend

Una vez que el backend se encuentre funcionando, regresar a la terminal ubicada en la carpeta del frontend.

Ejecutar:

```bash
npx expo start -c
```

La opción `-c` permite limpiar la caché de Expo antes de iniciar el proyecto, lo que ayuda a evitar problemas producidos por configuraciones anteriores.

Expo comenzará a compilar la aplicación y mostrará las diferentes opciones disponibles para ejecutarla.

---

## 9. Abrir la aplicación

Una vez finalizada la compilación de Expo, la aplicación puede ejecutarse de diferentes maneras.

### Ejecución en navegador web

Desde la terminal de Expo se puede seleccionar la opción correspondiente a **Web** para abrir CampusLink directamente en el navegador.

### Ejecución en dispositivo móvil

Para ejecutar CampusLink desde un teléfono móvil se debe instalar previamente la aplicación **Expo Go**.

Una vez instalada, se puede utilizar el código QR generado por Expo para abrir el proyecto desde el dispositivo.

El computador y el dispositivo móvil deben encontrarse conectados a una red compatible para permitir la comunicación con el servidor de desarrollo.

---

## 10. Verificación del despliegue

Si todos los pasos anteriores se realizaron correctamente, se deberían encontrar funcionando los siguientes componentes:

- Backend de CampusLink ejecutándose mediante Docker.
- Servicios y conexiones del backend configurados mediante variables de entorno.
- Frontend ejecutándose mediante Expo.
- Comunicación entre frontend y backend.
- Acceso a la aplicación desde navegador web o dispositivo móvil.

Con esto, el entorno local de **CampusLink queda correctamente desplegado y preparado para su ejecución y pruebas**.

---

## 11. Resumen de comandos

```bash
# Clonar proyecto
git clone <https://github.com/Qvverty72/CampusLink>

# Instalar frontend
cd frontendclink
npm install

# Instalar backend
cd backendclink
npm install

# Levantar backend
docker compose up -d --build

# Verificar contenedores
docker compose ps

# Levantar frontend
cd frontendclink
npx expo start -c
```

## 12. Detener el proyecto

Cuando se desee detener los servicios ejecutados mediante Docker, desde la carpeta del backend se puede utilizar:

```bash
docker compose down
```

Para finalizar Expo se puede presionar:

```text
Ctrl + C
```

en la terminal donde se encuentra ejecutándose el frontend.