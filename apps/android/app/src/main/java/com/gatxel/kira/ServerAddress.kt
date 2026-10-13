package com.gatxel.kira

import android.content.Context
import android.net.Uri
import androidx.annotation.StringRes
import androidx.core.content.edit
import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

/**
 * Alamat server Kira disimpan sebagai origin, misalnya https://kira.gatxel.com.
 * Hanya https, host harus memuat titik, tanpa userinfo. Path, query, dan fragmen dibuang.
 */
object ServerAddress {

    sealed interface Result {
        data class Valid(val origin: String) : Result
        data class Invalid(@param:StringRes val message: Int) : Result
    }

    private const val PREFS = "kira"
    private const val KEY_ORIGIN = "server_origin"
    private val HOST = Regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$")

    /** Baca alamat yang diketik orang dewasa. Tanpa skema dianggap https. */
    fun parse(input: String): Result {
        val text = input.trim()
        if (text.isEmpty()) return Result.Invalid(R.string.setup_error_empty)
        val withScheme = if ("://" in text) text else "https://$text"
        val uri = try {
            URI(withScheme)
        } catch (e: URISyntaxException) {
            return Result.Invalid(R.string.setup_error_invalid)
        }
        if (!uri.scheme.equals("https", ignoreCase = true)) return Result.Invalid(R.string.setup_error_https)
        if (uri.rawUserInfo != null) return Result.Invalid(R.string.setup_error_invalid)
        val host = uri.host?.lowercase(Locale.ROOT)?.removeSuffix(".")
            ?: return Result.Invalid(R.string.setup_error_invalid)
        if ('.' !in host) return Result.Invalid(R.string.setup_error_host)
        if (!HOST.matches(host)) return Result.Invalid(R.string.setup_error_invalid)
        val port = uri.port
        if (port != -1 && port !in 1..65535) return Result.Invalid(R.string.setup_error_invalid)
        return Result.Valid(originFor(host, port))
    }

    /** Origin https dari URL yang dibuka WebView, atau null untuk skema lain (http, blob, data, intent). */
    fun originOf(uri: Uri): String? {
        if (!uri.scheme.equals("https", ignoreCase = true)) return null
        val host = uri.host?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() } ?: return null
        return originFor(host, uri.port)
    }

    fun isSameOrigin(uri: Uri, origin: String): Boolean = originOf(uri) == origin

    /** Alamat tersimpan, lalu alamat dari build (-PkiraUrl), atau null bila keduanya kosong. */
    fun current(context: Context): String? = saved(context) ?: fromBuild()

    fun fromBuild(): String? = (parse(BuildConfig.KIRA_URL) as? Result.Valid)?.origin

    fun save(context: Context, origin: String) {
        prefs(context).edit(commit = true) { putString(KEY_ORIGIN, origin) }
    }

    private fun saved(context: Context): String? =
        prefs(context).getString(KEY_ORIGIN, null)?.let { (parse(it) as? Result.Valid)?.origin }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun originFor(host: String, port: Int): String =
        if (port == -1 || port == 443) "https://$host" else "https://$host:$port"
}
