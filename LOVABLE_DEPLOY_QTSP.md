# QTSP Edge Functions - Lovable Deployment Guide

## 📦 Archivos Modificados para Deploy

### Principal: `supabase/functions/qtsp-notarize/index.ts`

**Commit:** `54689d8` - fix(qtsp-notarize): correct Digital Trust API schema

**Cambios clave:**
1. **Case File** - Usa `title`, `code`, `category`, `owner`, `metadata` en lugar de `name`, `description`
2. **Evidence Group** - Añade `type: 'VIDEO'` y `code` requeridos
3. **Evidence** - Endpoint correcto con `caseFileId` y `testimony` como objeto

---

## 🔐 Secrets Requeridos en Supabase

Configurar en: **Project Settings → Edge Functions → Secrets**

| Secret Name | Value |
|-------------|-------|
| `DIGITALTRUST_LOGIN_URL` | `https://legalappfactory.okta.com/oauth2/aus653dgdgTFL2mhw417/v1/token` |
| `DIGITALTRUST_CLIENT_ID` | `<your-client-id>` |
| `DIGITALTRUST_CLIENT_SECRET` | `<your-client-secret>` |
| `DIGITALTRUST_API_URL` | `https://api.pre.gcloudfactory.com` |

> ⚠️ **SECURITY WARNING:** Never commit actual secrets to the repository. The values above are placeholders. Set the actual values in Supabase Dashboard.

---

## 🚀 Instrucciones para Lovable

### Opción 1: Sync desde GitHub
1. En Lovable, hacer **Sync** con el repositorio GitHub
2. Lovable debería detectar los cambios en `supabase/functions/`
3. Desplegar automáticamente

### Opción 2: Forzar Deploy
Si Lovable no detecta los cambios:
1. Hacer un cambio menor en cualquier archivo (ej: añadir un comentario)
2. Guardar y esperar el deploy

---

## ✅ Verificar Deploy

Probar con curl:
```bash
curl -X POST "https://rsbwqgzespcltmufkhdx.supabase.co/functions/v1/qtsp-notarize" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "timestamp_daily", "daily_root_id": "<uuid>", "root_hash": "<hash>", "date": "2026-01-05"}'
```

Respuesta exitosa incluirá:
```json
{
  "success": true,
  "evidence": {
    "status": "completed",
    "tsp_token": "MIIM3Q..."
  }
}
```
