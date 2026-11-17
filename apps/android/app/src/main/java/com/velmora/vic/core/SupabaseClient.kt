package com.velmora.vic.core

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.Postgrest
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "vic_preferences")

object VicSessionManager {
    private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
    private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
    private val USER_EMAIL_KEY = stringPreferencesKey("user_email")

    suspend fun saveTokens(context: Context, accessToken: String, refreshToken: String, email: String? = null) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = accessToken
            prefs[REFRESH_TOKEN_KEY] = refreshToken
            if (email != null) prefs[USER_EMAIL_KEY] = email
        }
    }

    suspend fun getAccessToken(context: Context): String? {
        return context.dataStore.data.map { it[ACCESS_TOKEN_KEY] }.firstOrNull()
    }

    suspend fun getRefreshToken(context: Context): String? {
        return context.dataStore.data.map { it[REFRESH_TOKEN_KEY] }.firstOrNull()
    }

    suspend fun clearSession(context: Context) {
        context.dataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN_KEY)
            prefs.remove(REFRESH_TOKEN_KEY)
            prefs.remove(USER_EMAIL_KEY)
        }
    }
}

object VicSupabase {
    @Volatile
    private var instance: SupabaseClient? = null

    fun initialize(@Suppress("UNUSED_PARAMETER") context: Context): SupabaseClient {
        return instance ?: synchronized(this) {
            instance ?: createSupabaseClient(
                supabaseUrl = VicConfig.supabaseUrl,
                supabaseKey = VicConfig.supabaseAnonKey
            ) {
                install(Auth)
                install(Postgrest)
            }.also { instance = it }
        }
    }

    fun get(): SupabaseClient {
        return instance ?: throw IllegalStateException(
            "VicSupabase is not initialized. Ensure VicApplication.onCreate() has executed."
        )
    }
}
