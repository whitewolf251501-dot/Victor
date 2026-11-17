package com.velmora.vic.auth

import android.content.Context
import com.velmora.vic.core.VicSessionManager
import com.velmora.vic.core.VicSupabase
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.gotrue.providers.builtin.OTP
import io.github.jan.supabase.gotrue.user.UserInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(private val context: Context) {
    private val auth get() = VicSupabase.get().auth

    suspend fun signInWithPassword(email: String, password: String): Result<UserInfo> = withContext(Dispatchers.IO) {
        try {
            auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val session = auth.currentSessionOrNull()
            if (session != null) {
                VicSessionManager.saveTokens(
                    context,
                    session.accessToken,
                    session.refreshToken,
                    email
                )
            }
            val user = auth.currentUserOrNull() ?: throw IllegalStateException("User profile unavailable after authorization.")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInWithMagicLink(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            auth.signInWith(OTP) {
                this.email = email
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signOut(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            auth.signOut()
            VicSessionManager.clearSession(context)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCurrentUser(): UserInfo? = withContext(Dispatchers.IO) {
        auth.currentUserOrNull()
    }

    suspend fun isUserLoggedIn(): Boolean = withContext(Dispatchers.IO) {
        auth.currentSessionOrNull() != null || VicSessionManager.getAccessToken(context) != null
    }
}
