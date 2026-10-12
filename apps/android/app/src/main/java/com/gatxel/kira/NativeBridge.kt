package com.gatxel.kira

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject
import java.util.Locale

/**
 * Jembatan KiraNative. Halaman dari origin server Kira mengirim string JSON lewat
 * WebViewCompat.addWebMessageListener; aplikasi membalas lewat JavaScriptReplyProxy.
 * Tanpa addJavascriptInterface, dan isi pesan tidak pernah dijalankan sebagai kode.
 *
 * Dari halaman:
 *   {"type":"hello"}
 *   {"type":"speak","id":"s1","text":"...","lang":"en-GB"|"id","rate":0.5..1.5}
 *   {"type":"stop"}
 *   {"type":"keep-awake","on":true|false}  layar tetap menyala selama runner terbuka
 * Ke halaman:
 *   {"type":"ready","tts":true|false,"app":"1.0.12"}
 *   {"type":"speech-start","id":"s1","lang":"en-GB","fallback":false}
 *   {"type":"speech-end","id":"s1","interrupted":false}
 *   {"type":"speech-error","id":"s1","reason":"invalid"|"unavailable"|"engine"}
 */
class NativeBridge private constructor(
    context: Context,
    private val origin: String,
    private val onKeepAwake: (Boolean) -> Unit,
) : WebViewCompat.WebMessageListener, TextToSpeech.OnInitListener {

    private enum class TtsState { STARTING, READY, FAILED }

    private class Utterance(
        val id: String,
        val reply: JavaScriptReplyProxy,
        val lang: String,
        val fallback: Boolean,
    )

    private val main = Handler(Looper.getMainLooper())
    private var closed = false
    private var ttsState = TtsState.STARTING
    private val waitingForReady = mutableListOf<JavaScriptReplyProxy>()
    private val utterances = LinkedHashMap<String, Utterance>()
    private var counter = 0

    // Dibuat paling akhir: onInit bisa terpanggil saat konstruktor TextToSpeech berjalan.
    private val tts = TextToSpeech(context.applicationContext, this)

    override fun onInit(status: Int) {
        main.post {
            if (closed) return@post
            ttsState = if (status == TextToSpeech.SUCCESS) TtsState.READY else TtsState.FAILED
            if (ttsState == TtsState.READY) tts.setOnUtteranceProgressListener(progress)
            waitingForReady.forEach(::sendReady)
            waitingForReady.clear()
        }
    }

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (closed || !isMainFrame || !ServerAddress.isSameOrigin(sourceOrigin, origin)) return
        val raw = try {
            message.data
        } catch (e: IllegalStateException) {
            null
        } ?: return
        val json = parse(raw) ?: return
        when (json.opt("type")) {
            "hello" -> {
                if (ttsState == TtsState.STARTING) waitingForReady.add(replyProxy) else sendReady(replyProxy)
            }
            "speak" -> speak(json, replyProxy)
            "stop" -> stopSpeech()
            "keep-awake" -> {
                val on = json.opt("on") as? Boolean ?: return
                main.post { if (!closed) onKeepAwake(on) }
            }
            // Jenis lain diabaikan.
        }
    }

    /** Hentikan bacaan yang sedang berjalan; halaman menerima speech-end dengan interrupted true. */
    fun stopSpeech() {
        if (ttsState != TtsState.READY) return
        tts.stop()
        interruptAll()
    }

    fun close() {
        if (closed) return
        closed = true
        waitingForReady.clear()
        utterances.clear()
        tts.stop()
        tts.shutdown()
    }

    private fun speak(json: JSONObject, reply: JavaScriptReplyProxy) {
        val id = json.opt("id") as? String
        if (id == null || !ID.matches(id)) return
        val text = json.opt("text") as? String
        val locale = (json.opt("lang") as? String)?.let { LOCALES[it] }
        val rate = when (val value = json.opt("rate")) {
            null -> 1.0
            is Number -> value.toDouble()
            else -> Double.NaN
        }
        if (text == null || text.isBlank() || text.length > MAX_TEXT || locale == null || !(rate >= 0.5 && rate <= 1.5)) {
            sendError(reply, id, "invalid")
            return
        }
        if (ttsState != TtsState.READY) {
            sendError(reply, id, "unavailable")
            return
        }
        // QUEUE_FLUSH memotong bacaan sebelumnya; halaman yang menunggu langsung diberi tahu.
        interruptAll()
        val fallback = !useLanguage(locale)
        tts.setSpeechRate(rate.toFloat())
        val key = "u${++counter}"
        val voiceTag = tts.voice?.locale?.toLanguageTag() ?: locale.toLanguageTag()
        utterances[key] = Utterance(id, reply, voiceTag, fallback)
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, key) != TextToSpeech.SUCCESS) {
            utterances.remove(key)
            sendError(reply, id, "engine")
        }
    }

    /** true bila bahasa yang diminta tersedia; false bila memakai suara bawaan perangkat. */
    private fun useLanguage(locale: Locale): Boolean {
        if (tts.setLanguage(locale) >= TextToSpeech.LANG_AVAILABLE) return true
        val defaultVoice = tts.defaultVoice
        if (defaultVoice != null) tts.setVoice(defaultVoice) else tts.setLanguage(Locale.getDefault())
        return false
    }

    private fun interruptAll() {
        val current = utterances.values.toList()
        utterances.clear()
        current.forEach { send(it.reply, event("speech-end", it.id).put("interrupted", true)) }
    }

    private val progress = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) = onMain(utteranceId, remove = false) {
            send(it.reply, event("speech-start", it.id).put("lang", it.lang).put("fallback", it.fallback))
        }

        override fun onDone(utteranceId: String?) = onMain(utteranceId, remove = true) {
            send(it.reply, event("speech-end", it.id).put("interrupted", false))
        }

        override fun onStop(utteranceId: String?, interrupted: Boolean) = onMain(utteranceId, remove = true) {
            send(it.reply, event("speech-end", it.id).put("interrupted", true))
        }

        override fun onError(utteranceId: String?, errorCode: Int) = onMain(utteranceId, remove = true) {
            sendError(it.reply, it.id, "engine")
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) = onMain(utteranceId, remove = true) {
            sendError(it.reply, it.id, "engine")
        }
    }

    // Callback TTS datang dari thread lain; semua status jembatan diubah di thread utama.
    private fun onMain(utteranceId: String?, remove: Boolean, action: (Utterance) -> Unit) {
        val key = utteranceId ?: return
        main.post {
            val utterance = if (remove) utterances.remove(key) else utterances[key]
            if (utterance != null && !closed) action(utterance)
        }
    }

    private fun sendReady(reply: JavaScriptReplyProxy) {
        send(
            reply,
            JSONObject()
                .put("type", "ready")
                .put("tts", ttsState == TtsState.READY)
                .put("app", BuildConfig.VERSION_NAME),
        )
    }

    private fun sendError(reply: JavaScriptReplyProxy, id: String, reason: String) {
        send(reply, event("speech-error", id).put("reason", reason))
    }

    private fun event(type: String, id: String): JSONObject = JSONObject().put("type", type).put("id", id)

    private fun send(reply: JavaScriptReplyProxy, payload: JSONObject) {
        try {
            reply.postMessage(payload.toString())
        } catch (e: IllegalStateException) {
            // Halaman pengirim sudah berganti.
        }
    }

    private fun parse(raw: String): JSONObject? {
        if (raw.length > MAX_MESSAGE || nestingDepth(raw) > MAX_DEPTH) return null
        return try {
            JSONObject(raw)
        } catch (e: JSONException) {
            null
        }
    }

    companion object {
        const val OBJECT_NAME = "KiraNative"
        private const val MAX_MESSAGE = 16_384
        private const val MAX_TEXT = 2000
        private const val MAX_DEPTH = 2
        private val ID = Regex("^[A-Za-z0-9_-]{1,64}$")
        private val LOCALES = mapOf(
            "en-GB" to Locale.UK,
            "id" to Locale.forLanguageTag("id-ID"),
        )

        /** Pasang jembatan sebelum halaman dimuat. Null bila WebView terlalu lama untuk WEB_MESSAGE_LISTENER. */
        fun attach(context: Context, view: WebView, origin: String, onKeepAwake: (Boolean) -> Unit): NativeBridge? {
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return null
            val bridge = NativeBridge(context, origin, onKeepAwake)
            return try {
                WebViewCompat.addWebMessageListener(view, OBJECT_NAME, setOf(origin), bridge)
                bridge
            } catch (e: IllegalArgumentException) {
                bridge.close()
                null
            }
        }

        /** Kedalaman objek dan larik JSON tanpa membaca isi string, supaya pesan bersarang ditolak sebelum diparse. */
        private fun nestingDepth(raw: String): Int {
            var depth = 0
            var max = 0
            var inString = false
            var escaped = false
            for (c in raw) {
                if (inString) {
                    when {
                        escaped -> escaped = false
                        c == '\\' -> escaped = true
                        c == '"' -> inString = false
                    }
                } else {
                    when (c) {
                        '"' -> inString = true
                        '{', '[' -> {
                            depth++
                            if (depth > max) max = depth
                        }
                        '}', ']' -> depth--
                    }
                }
            }
            return max
        }
    }
}
