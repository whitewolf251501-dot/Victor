package com.velmora.vic.core

import com.velmora.vic.BuildConfig

object VicConfig {
    val supabaseUrl: String
        get() = BuildConfig.SUPABASE_URL.ifBlank {
            throw IllegalStateException("SUPABASE_URL is not configured in local.properties")
        }

    val supabaseAnonKey: String
        get() = BuildConfig.SUPABASE_ANON_KEY.ifBlank {
            throw IllegalStateException("SUPABASE_ANON_KEY is not configured in local.properties")
        }

    val webApiUrl: String
        get() = BuildConfig.VIC_WEB_API_URL.ifBlank {
            "http://10.0.2.2:3000"
        }
}
