package com.velmora.vic.device

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.velmora.vic.core.VicSupabase
import com.velmora.vic.core.dataStore
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.UUID

@Serializable
data class DeviceInsertPayload(
    val id: String,
    val owner_id: String,
    val type: String,
    val name: String,
    val status: String,
    val last_seen: String,
    val enrolled_at: String
)

@Serializable
data class DeviceStatusUpdate(
    val status: String,
    val last_seen: String
)

class DeviceManager(private val context: Context) {
    private val DEVICE_ID_KEY = stringPreferencesKey("stable_device_id")

    suspend fun getOrCreateDeviceId(): String = withContext(Dispatchers.IO) {
        val existing = context.dataStore.data.map { it[DEVICE_ID_KEY] }.firstOrNull()
        if (!existing.isNullOrBlank()) {
            return@withContext existing
        }
        val newId = UUID.randomUUID().toString()
        context.dataStore.edit { it[DEVICE_ID_KEY] = newId }
        newId
    }

    suspend fun onFirstLogin(ownerId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val deviceId = getOrCreateDeviceId()
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android Client" }
            val now = Instant.now().toString()

            val payload = DeviceInsertPayload(
                id = deviceId,
                owner_id = ownerId,
                type = "android",
                name = deviceName,
                status = "online",
                last_seen = now,
                enrolled_at = now
            )

            VicSupabase.get().postgrest["devices"].upsert(payload)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun onAppStart(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val deviceId = getOrCreateDeviceId()
            val user = VicSupabase.get().auth.currentUserOrNull() ?: return@withContext Result.success(Unit)
            val now = Instant.now().toString()

            VicSupabase.get().postgrest["devices"].update(
                DeviceStatusUpdate(status = "online", last_seen = now)
            ) {
                filter {
                    eq("id", deviceId)
                    eq("owner_id", user.id)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun onAppBackground(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val deviceId = getOrCreateDeviceId()
            val user = VicSupabase.get().auth.currentUserOrNull() ?: return@withContext Result.success(Unit)
            val now = Instant.now().toString()

            VicSupabase.get().postgrest["devices"].update(
                DeviceStatusUpdate(status = "offline", last_seen = now)
            ) {
                filter {
                    eq("id", deviceId)
                    eq("owner_id", user.id)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
