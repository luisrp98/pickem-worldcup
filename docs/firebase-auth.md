# Crear usuarios manualmente en Firebase Console

Los usuarios los generás vos a mano y les entregás las credenciales por el canal que prefieras (WhatsApp, email, etc.). Acá va el paso a paso.

## 1. Crear el proyecto Firebase (una sola vez)

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → nombre → continuar
3. (Opcional) Desactivar Google Analytics → crear proyecto
4. Una vez creado, te quedas en la consola del proyecto

## 2. Habilitar Email/Password (una sola vez)

1. En el menú lateral: **Build → Authentication**
2. **Get started**
3. Pestaña **Sign-in method** → **Email/Password**
4. Habilitar el primer switch (Email/Password). **NO** habilitar el segundo (Email link)
5. **Save**

## 3. Deshabilitar sign-up público (clave para tu caso)

1. Misma pantalla: **Authentication → Settings** (o el tab "Settings" en la parte de arriba)
2. Pestaña **User account creation**
3. Apagar el switch (Off)
4. **Save**

Esto garantiza que NADIE pueda registrarse solo, ni siquiera si alguien descubre tu API key.

## 4. Configurar dominios autorizados

1. **Authentication → Settings → Authorized domains**
2. Por defecto ya están `localhost` y tu dominio de Firebase
3. Agregar:
   - `localhost` (ya está)
   - Tu dominio de Vercel: `tu-proyecto.vercel.app`
   - Tu dominio custom si lo vas a usar
4. **Add domain** por cada uno

## 5. Generar la Web App config (una sola vez)

1. **Project settings** (ícono de engranaje) → **General**
2. En "Your apps" → click en el ícono **`</>`** (Web app)
3. Nombre (ej. "PICKEM Web") → **Register app**
4. Te muestra el `firebaseConfig`. Copiá todos los valores, los necesitás para el `.env`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## 6. Generar la Service Account key (una sola vez)

1. **Project settings → Service accounts**
2. Verificar que **Firebase Admin SDK** está seleccionado
3. **Generate new private key** → te baja un JSON
4. **NO COMMITEAR ESE JSON.** Lo necesitás solo para llenar las env vars:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (con los `\n` literales, ver abajo)

## 7. Crear los usuarios (uno por uno)

Por cada amigo al que le vas a dar acceso:

1. **Authentication → Users** (tab)
2. **Add user**
3. **Email**: el que le vas a dar (ej. `martin@gmail.com`)
4. **Password**: el que vos generes. Recomendaciones:
   - Mínimo 8 caracteres
   - Combiná letras, números y algún símbolo
   - **No uses la misma para todos** (cada uno la suya)
   - Anotala en un lugar seguro antes de confirmar (Firebase no te la muestra después)
5. **Add user**

Repetir para cada uno.

## 8. Entregar las credenciales

Armate un mensaje tipo:

> Hola Martin, te llegó la cuenta del PICKEM.
> URL: https://tu-proyecto.vercel.app
> Email: martin@gmail.com
> Contraseña: La-Que-Pusiste
> (Recomendado cambiarla después desde el menú, cuando esté listo)

## Sobre el `FIREBASE_PRIVATE_KEY` con `\n`

El JSON que descargás tiene el `private_key` con saltos de línea reales:

```
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Cuando lo pongas en `.env` (o en Vercel), tenés que **escapar los `\n`** como `\\n` (dos caracteres: barra y n) para que el archivo de texto quede en una sola línea. Ojo: Vercel UI a veces lo pega bien solo, a veces no. Si te da error `Failed to parse private key`, es esto.

Ejemplo correcto en `.env`:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

(comillas dobles alrededor para que `\n` no se interprete en el shell)

## Resumen de env vars

| Variable | Origen |
|---|---|
| `PUBLIC_FIREBASE_API_KEY` | Paso 5 |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | Paso 5 |
| `PUBLIC_FIREBASE_PROJECT_ID` | Paso 5 |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | Paso 5 |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Paso 5 |
| `PUBLIC_FIREBASE_APP_ID` | Paso 5 |
| `FIREBASE_PROJECT_ID` | Paso 6 |
| `FIREBASE_CLIENT_EMAIL` | Paso 6 |
| `FIREBASE_PRIVATE_KEY` | Paso 6 (con `\n` escapados) |

## Recomendaciones de seguridad (no bloqueantes)

- **Cambiar la contraseña periódicamente** o cada vez que alguien deje el grupo
- **No compartir credenciales entre personas** — cada una la suya
- Si una cuenta se compromete, desde **Authentication → Users** se puede resetear la contraseña o deshabilitar el usuario
- Si querés borrar a alguien definitivamente: **Authentication → Users → ⋮ → Delete account**
