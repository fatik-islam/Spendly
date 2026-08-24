package com.spendly.finance.app.data

import com.spendly.finance.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class SpendlyApi(private val sessionStore: SecureSessionStore) {
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }
    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val refreshMutex = Mutex()
    private var session: AuthSession? = null
    private var persistSession = true
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun currentSession(): AuthSession? = session

    suspend fun restoreSession(): AuthSession? {
        val saved = sessionStore.load() ?: return null
        session = saved
        return runCatching {
            val response = request<CurrentUserResponse>("GET", "/api/auth/sessions/current")
            saved.copy(user = response.user).also(::store)
        }.recoverCatching {
            if (saved.refreshToken != null) refresh() else throw it
        }.getOrElse {
            clearSession()
            null
        }
    }

    suspend fun publicAuthConfig(): AuthConfig =
        request("GET", "/api/auth/public-config", authenticated = false)

    suspend fun signIn(email: String, password: String, rememberMe: Boolean): AuthSession {
        requireAnonKey()
        val result: AuthSession = request(
            "POST", "/api/auth/sessions?client_type=mobile",
            buildJsonObject { put("email", email); put("password", password) },
            authenticated = false,
        )
        persistSession = rememberMe
        store(result)
        return result
    }

    suspend fun signUp(email: String, password: String, name: String): SignUpResponse {
        requireAnonKey()
        val result: SignUpResponse = request(
            "POST", "/api/auth/users?client_type=mobile",
            buildJsonObject { put("email", email); put("password", password); put("name", name) },
            authenticated = false,
        )
        if (result.user != null && result.accessToken != null) {
            store(AuthSession(result.user, result.accessToken, result.refreshToken))
        }
        return result
    }

    suspend fun verifyEmail(email: String, code: String): AuthSession =
        request<AuthSession>(
            "POST", "/api/auth/email/verify?client_type=mobile",
            buildJsonObject { put("email", email); put("otp", code) }, authenticated = false,
        ).also(::store)

    suspend fun resendVerification(email: String) {
        requestUnit("POST", "/api/auth/email/send-verification", buildJsonObject { put("email", email) }, false)
    }

    suspend fun sendPasswordReset(email: String) {
        requestUnit("POST", "/api/auth/email/send-reset-password", buildJsonObject { put("email", email) }, false)
    }

    suspend fun resetPassword(email: String, code: String, newPassword: String) {
        val token: ResetTokenResponse = request(
            "POST", "/api/auth/email/exchange-reset-password-token",
            buildJsonObject { put("email", email); put("code", code) }, false,
        )
        requestUnit(
            "POST", "/api/auth/email/reset-password",
            buildJsonObject { put("newPassword", newPassword); put("otp", token.token) }, false,
        )
    }

    suspend fun signOut() {
        runCatching { requestUnit("POST", "/api/auth/logout?client_type=mobile") }
        clearSession()
    }

    suspend fun deleteCurrentUserAccount() {
        requestUnit(
            "POST", "/api/account/delete",
            buildJsonObject { put("confirmation", "DELETE") },
            baseUrl = BuildConfig.SPENDLY_APP_BASE_URL,
        )
        clearSession()
    }

    suspend inline fun <reified T> fetchRows(
        table: String,
        select: String = "*",
        order: String? = null,
        filters: List<Pair<String, String>> = emptyList(),
    ): List<T> {
        val query = mutableListOf("select" to select).apply {
            addAll(filters)
            if (order != null) add("order" to order)
        }
        return request("GET", "/api/database/records/$table?${encodeQuery(query)}")
    }

    suspend fun insert(table: String, rows: List<JsonObject>) =
        requestUnit("POST", "/api/database/records/$table", JsonArray(rows), headers = mapOf("Prefer" to "return=minimal"))

    suspend fun update(table: String, values: JsonObject, filters: List<Pair<String, String>>) =
        requestUnit(
            "PATCH", "/api/database/records/$table?${encodeQuery(filters)}", values,
            headers = mapOf("Prefer" to "return=minimal"),
        )

    suspend fun delete(table: String, filters: List<Pair<String, String>>) =
        requestUnit(
            "DELETE", "/api/database/records/$table?${encodeQuery(filters)}",
            headers = mapOf("Prefer" to "return=minimal"),
        )

    suspend inline fun <reified T> rpc(function: String, arguments: JsonObject = JsonObject(emptyMap())): T =
        request("POST", "/api/database/rpc/$function", arguments)

    suspend fun rpcUnit(function: String, arguments: JsonObject = JsonObject(emptyMap())) =
        requestUnit("POST", "/api/database/rpc/$function", arguments)

    suspend fun registerFcmToken(token: String) =
        rpcUnit("register_fcm_device_token", buildJsonObject { put("p_device_token", token); put("p_package_name", BuildConfig.APPLICATION_ID) })

    suspend fun unregisterFcmToken(token: String) =
        rpcUnit("unregister_fcm_device_token", buildJsonObject { put("p_device_token", token) })

    private suspend fun refresh(): AuthSession = refreshMutex.withLock {
        val current = session ?: throw SpendlyException("Your session has expired. Sign in again.")
        val refreshToken = current.refreshToken ?: throw SpendlyException("Your session has expired. Sign in again.")
        val result: AuthSession = request(
            "POST", "/api/auth/refresh?client_type=mobile",
            buildJsonObject { put("refresh_token", refreshToken) },
            authenticated = false, allowRefresh = false,
        )
        result.copy(refreshToken = result.refreshToken ?: refreshToken).also(::store)
    }

    private fun store(value: AuthSession) {
        session = value
        if (persistSession) sessionStore.save(value) else sessionStore.clear()
    }

    fun clearSession() {
        session = null
        persistSession = true
        sessionStore.clear()
    }

    private fun requireAnonKey() {
        if (BuildConfig.INSFORGE_ANON_KEY.isBlank()) {
            throw SpendlyException("The Android build is missing SPENDLY_INSFORGE_ANON_KEY. Add it to android/local.properties to use the shared backend.")
        }
    }

    suspend inline fun <reified T> request(
        method: String,
        path: String,
        body: JsonElement? = null,
        authenticated: Boolean = true,
        headers: Map<String, String> = emptyMap(),
        allowRefresh: Boolean = true,
        baseUrl: String = BuildConfig.INSFORGE_BASE_URL,
    ): T {
        val text = perform(method, path, body, authenticated, headers, allowRefresh, baseUrl)
        return try {
            json.decodeFromString(text.ifBlank { "{}" })
        } catch (_: Exception) {
            throw SpendlyException("Spendly received an unexpected response.")
        }
    }

    suspend fun requestUnit(
        method: String,
        path: String,
        body: JsonElement? = null,
        authenticated: Boolean = true,
        headers: Map<String, String> = emptyMap(),
        allowRefresh: Boolean = true,
        baseUrl: String = BuildConfig.INSFORGE_BASE_URL,
    ) {
        perform(method, path, body, authenticated, headers, allowRefresh, baseUrl)
    }

    suspend fun perform(
        method: String,
        path: String,
        body: JsonElement?,
        authenticated: Boolean,
        headers: Map<String, String>,
        allowRefresh: Boolean,
        baseUrl: String,
    ): String = withContext(Dispatchers.IO) {
        val url = if (path.startsWith("http")) path.toHttpUrl() else "${baseUrl.trimEnd('/')}/${path.trimStart('/')}".toHttpUrl()
        val requestBody = body?.let { json.encodeToString(it).toRequestBody(jsonMedia) }
        val builder = Request.Builder().url(url).header("Accept", "application/json")
        headers.forEach { (key, value) -> builder.header(key, value) }
        if (authenticated) {
            val accessToken = session?.accessToken ?: throw SpendlyException("Your session has expired. Sign in again.")
            builder.header("Authorization", "Bearer $accessToken")
        } else if (BuildConfig.INSFORGE_ANON_KEY.isNotBlank()) {
            builder.header("Authorization", "Bearer ${BuildConfig.INSFORGE_ANON_KEY}")
        }
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(requestBody ?: "{}".toRequestBody(jsonMedia))
            "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(jsonMedia))
            "DELETE" -> if (requestBody == null) builder.delete() else builder.delete(requestBody)
            else -> error("Unsupported HTTP method")
        }
        val response = http.newCall(builder.build()).execute()
        val responseText = response.body.string()
        if (response.code == 401 && authenticated && allowRefresh && session?.refreshToken != null) {
            response.close()
            refresh()
            return@withContext perform(method, path, body, authenticated, headers, false, baseUrl)
        }
        if (!response.isSuccessful) {
            val message = runCatching {
                val payload = json.parseToJsonElement(responseText) as JsonObject
                listOf("message", "error_description", "error").firstNotNullOfOrNull { key ->
                    (payload[key] as? JsonPrimitive)?.content
                }
            }.getOrNull() ?: "Request failed (${response.code})."
            response.close()
            throw SpendlyException(message)
        }
        response.close()
        responseText
    }

    companion object {
        fun eq(value: String) = "eq.$value"
        fun isNull() = "is.null"
        fun encodeQuery(items: List<Pair<String, String>>) = items.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, "UTF-8") }=${URLEncoder.encode(value, "UTF-8") }"
        }
    }
}
