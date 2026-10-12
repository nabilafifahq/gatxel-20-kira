package com.gatxel.kira

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.getSystemService
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream
import java.io.File
import java.util.Locale

/**
 * Cangkang WebView Kira. Halaman dari origin server dimuat di dalam aplikasi, URL lain dibuka di
 * browser luar. Bila halaman utama gagal dimuat, layar native menjelaskan apa yang harus diperiksa.
 */
class MainActivity : ComponentActivity() {

    private enum class Screen { WEB, OFFLINE, SETUP }

    private lateinit var webContainer: ViewGroup
    private lateinit var progress: ProgressBar
    private lateinit var offlineScreen: View
    private lateinit var offlineDetail: TextView
    private lateinit var offlineRetry: Button
    private lateinit var setupScreen: View
    private lateinit var setupInput: EditText
    private lateinit var setupError: TextView
    private lateinit var setupCancel: Button

    private var origin: String? = null
    private var web: WebView? = null
    private var bridge: NativeBridge? = null
    private var screen = Screen.WEB
    private var screenBeforeSetup = Screen.WEB
    private var failedUrl: String? = null
    private var retrying = false

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var fileRequest = FileRequest.ANY
    private var cameraFile: File? = null
    private var cameraUri: Uri? = null
    private var mediaRequest: PermissionRequest? = null

    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = onBack()
    }

    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val file = cameraFile
        val uri = cameraUri
        cameraFile = null
        cameraUri = null
        deliverFiles(if (saved && uri != null && file != null && file.length() > 0) arrayOf(uri) else null)
    }
    private val pickImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        deliverFiles(uri?.let { arrayOf(it) })
    }
    private val pickImages = registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia()) { uris ->
        deliverFiles(uris.takeIf { it.isNotEmpty() }?.toTypedArray())
    }
    private val openDocument = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        deliverFiles(uri?.let { arrayOf(it) })
    }
    private val openDocuments = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        deliverFiles(uris.takeIf { it.isNotEmpty() }?.toTypedArray())
    }
    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            launchCamera()
        } else {
            toast(R.string.camera_denied)
            launchPicker()
        }
    }
    private val mediaPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        finishMediaRequest()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(
                getColor(R.color.kira_nav_scrim),
                getColor(R.color.kira_nav_scrim_dark),
            ),
        )
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        bindViews()
        onBackPressedDispatcher.addCallback(this, backCallback)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        clearOldPhotos()

        val start = ServerAddress.current(this)
        origin = start
        if (start == null) showSetup(cancelable = false) else openServer(start, savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        web?.onResume()
    }

    override fun onPause() {
        web?.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onStop() {
        bridge?.stopSpeech()
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        val view = web ?: return
        val state = Bundle()
        if (view.saveState(state) != null) {
            outState.putBundle(STATE_WEB, state)
            outState.putString(STATE_ORIGIN, origin)
        }
    }

    override fun onDestroy() {
        deliverFiles(null)
        mediaRequest?.deny()
        mediaRequest = null
        bridge?.close()
        bridge = null
        dropWebView()
        super.onDestroy()
    }

    private fun bindViews() {
        webContainer = findViewById(R.id.web_container)
        progress = findViewById(R.id.progress)
        offlineScreen = findViewById(R.id.offline_screen)
        offlineDetail = findViewById(R.id.offline_detail)
        offlineRetry = findViewById(R.id.offline_retry)
        setupScreen = findViewById(R.id.setup_screen)
        setupInput = findViewById(R.id.setup_input)
        setupError = findViewById(R.id.setup_error)
        setupCancel = findViewById(R.id.setup_cancel)

        offlineRetry.setOnClickListener { retry() }
        findViewById<Button>(R.id.offline_change).setOnClickListener { showSetup(cancelable = true) }
        findViewById<Button>(R.id.setup_save).setOnClickListener { saveSetup() }
        setupCancel.setOnClickListener { closeSetup() }
        setupInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                saveSetup()
                true
            } else {
                false
            }
        }

        // Konten tidak berada di bawah status bar, bar navigasi, potongan layar, atau keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { root, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            root.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
    }

    // ---------------------------------------------------------------------------------------------
    // WebView

    private fun openServer(serverOrigin: String, state: Bundle?) {
        val view = try {
            WebView(this)
        } catch (e: RuntimeException) {
            // Android System WebView tidak terpasang atau sedang diperbarui.
            showOffline(getString(R.string.webview_missing))
            return
        }
        configureWebView(view, serverOrigin)
        webContainer.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = view
        val saved = state?.takeIf { it.getString(STATE_ORIGIN) == serverOrigin }?.getBundle(STATE_WEB)
        if (saved == null || view.restoreState(saved) == null) view.loadUrl("$serverOrigin/")
        showScreen(Screen.WEB)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(view: WebView, serverOrigin: String) {
        view.setBackgroundColor(getColor(R.color.kira_bg))
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            setGeolocationEnabled(false)
            userAgentString = "$userAgentString KiraAndroid/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(view, false)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            val worker = ServiceWorkerControllerCompat.getInstance().serviceWorkerWebSettings
            if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_FILE_ACCESS)) worker.setAllowFileAccess(false)
            if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_CONTENT_ACCESS)) worker.setAllowContentAccess(false)
        }
        view.webViewClient = KiraWebClient(serverOrigin)
        view.webChromeClient = KiraChromeClient(serverOrigin)
        view.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            download(serverOrigin, url, userAgent, contentDisposition, mimeType)
        }
        // Didaftarkan sebelum loadUrl supaya objek KiraNative ada sejak dokumen pertama.
        bridge = NativeBridge.attach(this, view, serverOrigin) { on -> setKeepScreenOn(on) }
    }

    /** Layar tetap menyala selama runner terbuka (pesan keep-awake dari halaman). */
    private fun setKeepScreenOn(on: Boolean) {
        if (on) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun dropWebView() {
        val view = web ?: return
        web = null
        webContainer.removeView(view)
        view.destroy()
    }

    private inner class KiraWebClient(private val allowedOrigin: String) : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (ServerAddress.isSameOrigin(request.url, allowedOrigin)) return false
            if (request.isForMainFrame) openExternal(request.url)
            return true
        }

        // Lapisan kedua: navigasi halaman utama ke origin lain (misalnya POST) tidak pernah dikirim dari WebView.
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (request.isForMainFrame && !ServerAddress.isSameOrigin(request.url, allowedOrigin)) {
                return WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
            return null
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            bridge?.stopSpeech()
            // Halaman baru memutuskan sendiri apakah layar perlu tetap menyala (runner mengirim keep-awake).
            setKeepScreenOn(false)
        }

        override fun onPageFinished(view: WebView, url: String?) {
            // Halaman galat bawaan WebView juga memanggil onPageFinished dengan URL yang gagal.
            val loaded = url != null && url != failedUrl && ServerAddress.isSameOrigin(Uri.parse(url), allowedOrigin)
            if (loaded) pageLoaded()
            updateBack()
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            updateBack()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            val description = error.description?.toString().orEmpty()
            if ("ERR_ABORTED" in description) return
            mainFrameFailed(request.url.toString(), "${error.errorCode} $description".trim())
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
            // 502 sampai 504 datang dari tailscale serve saat Kira di server rumah mati.
            if (request.isForMainFrame && errorResponse.statusCode in 502..504) {
                mainFrameFailed(request.url.toString(), "HTTP ${errorResponse.statusCode}")
            }
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
            val url = error.url ?: return
            if (ServerAddress.isSameOrigin(Uri.parse(url), allowedOrigin)) mainFrameFailed(url, "TLS ${error.primaryError}")
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // Renderer berhenti (kehabisan memori atau crash). WebView ini tidak bisa dipakai lagi.
            dropWebView()
            recreate()
            return true
        }
    }

    private inner class KiraChromeClient(private val allowedOrigin: String) : WebChromeClient() {

        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.progress = newProgress
            progress.isVisible = newProgress < 100 && screen == Screen.WEB
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            handleMediaRequest(allowedOrigin, request)
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (mediaRequest === request) mediaRequest = null
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
            callback?.invoke(origin, false, false)
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            showFileChooser(filePathCallback, fileChooserParams)
            return true
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Layar

    private fun showScreen(next: Screen) {
        screen = next
        web?.visibility = if (next == Screen.WEB) View.VISIBLE else View.INVISIBLE
        offlineScreen.isVisible = next == Screen.OFFLINE
        setupScreen.isVisible = next == Screen.SETUP
        if (next != Screen.WEB) progress.isVisible = false
        updateBack()
    }

    private fun pageLoaded() {
        failedUrl = null
        retrying = false
        offlineRetry.setText(R.string.offline_retry)
        when (screen) {
            Screen.OFFLINE -> showScreen(Screen.WEB)
            Screen.SETUP -> if (screenBeforeSetup == Screen.OFFLINE) screenBeforeSetup = Screen.WEB
            Screen.WEB -> Unit
        }
    }

    private fun mainFrameFailed(url: String, code: String) {
        failedUrl = url
        bridge?.stopSpeech()
        showOffline(code)
    }

    private fun showOffline(code: String) {
        retrying = false
        offlineRetry.setText(R.string.offline_retry)
        offlineDetail.text = getString(R.string.offline_detail, origin.orEmpty(), code)
        if (screen == Screen.SETUP) screenBeforeSetup = Screen.OFFLINE else showScreen(Screen.OFFLINE)
    }

    private fun retry() {
        if (retrying) return
        val view = web
        if (view == null) {
            recreate()
            return
        }
        val target = failedUrl ?: origin?.let { "$it/" } ?: return
        failedUrl = null
        retrying = true
        offlineRetry.setText(R.string.offline_retrying)
        view.loadUrl(target)
    }

    private fun showSetup(cancelable: Boolean) {
        if (screen != Screen.SETUP) screenBeforeSetup = screen
        setupInput.setText(origin ?: ServerAddress.fromBuild() ?: "https://")
        setupInput.setSelection(setupInput.text.length)
        setupError.isVisible = false
        setupCancel.isVisible = cancelable
        showScreen(Screen.SETUP)
        setupInput.requestFocus()
    }

    private fun closeSetup() {
        hideKeyboard()
        showScreen(screenBeforeSetup)
    }

    private fun saveSetup() {
        when (val result = ServerAddress.parse(setupInput.text.toString())) {
            is ServerAddress.Result.Invalid -> {
                setupError.setText(result.message)
                setupError.isVisible = true
                setupInput.requestFocus()
            }
            is ServerAddress.Result.Valid -> {
                ServerAddress.save(this, result.origin)
                if (result.origin == origin && web != null) {
                    closeSetup()
                    if (screen == Screen.OFFLINE) retry()
                } else {
                    // Origin baru: WebView dan jembatan dibuat ulang untuk origin itu.
                    hideKeyboard()
                    recreate()
                }
            }
        }
    }

    private fun hideKeyboard() {
        getSystemService<InputMethodManager>()?.hideSoftInputFromWindow(setupInput.windowToken, 0)
    }

    private fun updateBack() {
        backCallback.isEnabled = when (screen) {
            Screen.SETUP -> setupCancel.isVisible
            Screen.WEB, Screen.OFFLINE -> web?.canGoBack() == true
        }
    }

    private fun onBack() {
        if (screen == Screen.SETUP) {
            closeSetup()
            return
        }
        val view = web
        if (view != null && view.canGoBack()) {
            view.goBack()
            return
        }
        // Tidak ada riwayat lagi: serahkan ke sistem, aplikasi keluar.
        backCallback.isEnabled = false
        onBackPressedDispatcher.onBackPressed()
    }

    // ---------------------------------------------------------------------------------------------
    // Mikrofon dan kamera untuk getUserMedia

    private fun handleMediaRequest(allowedOrigin: String, request: PermissionRequest) {
        val wanted = request.resources.filter { it in MEDIA_PERMISSIONS }
        if (!ServerAddress.isSameOrigin(request.origin, allowedOrigin) || wanted.isEmpty() || mediaRequest != null) {
            request.deny()
            return
        }
        mediaRequest = request
        val missing = wanted.mapNotNull { MEDIA_PERMISSIONS[it] }.filterNot(::hasPermission)
        if (missing.isEmpty()) finishMediaRequest() else mediaPermissions.launch(missing.toTypedArray())
    }

    private fun finishMediaRequest() {
        val request = mediaRequest ?: return
        mediaRequest = null
        val granted = request.resources.filter { resource -> MEDIA_PERMISSIONS[resource]?.let(::hasPermission) == true }
        if (granted.isEmpty()) request.deny() else request.grant(granted.toTypedArray())
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    // ---------------------------------------------------------------------------------------------
    // Pemilih berkas untuk <input type="file">

    private class FileRequest(val mimeTypes: List<String>, val multiple: Boolean) {
        val imagesOnly: Boolean get() = mimeTypes.all { it.startsWith("image/") }
        val allowsImages: Boolean get() = mimeTypes.any { it == "*/*" || it.startsWith("image/") }

        companion object {
            val ANY = FileRequest(listOf("*/*"), multiple = false)

            fun from(params: WebChromeClient.FileChooserParams): FileRequest {
                val types = params.acceptTypes.orEmpty()
                    .flatMap { it.split(',') }
                    .map { it.trim().lowercase(Locale.ROOT) }
                    .mapNotNull { type ->
                        when {
                            type.startsWith(".") -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(type.drop(1))
                            '/' in type -> type
                            else -> null
                        }
                    }
                    .distinct()
                return FileRequest(
                    mimeTypes = types.ifEmpty { listOf("*/*") },
                    multiple = params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE,
                )
            }
        }
    }

    private fun showFileChooser(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams) {
        deliverFiles(null)
        fileCallback = callback
        val request = FileRequest.from(params)
        fileRequest = request
        if (request.allowsImages && packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            AlertDialog.Builder(this)
                .setTitle(R.string.chooser_title)
                .setItems(arrayOf<CharSequence>(getString(R.string.chooser_camera), getString(R.string.chooser_files))) { _, which ->
                    if (which == 0) startCamera() else launchPicker()
                }
                .setOnCancelListener { deliverFiles(null) }
                .show()
        } else {
            launchPicker()
        }
    }

    private fun launchPicker() {
        val request = fileRequest
        val images = PickVisualMediaRequest.Builder()
            .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly)
            .build()
        try {
            when {
                request.imagesOnly && request.multiple -> pickImages.launch(images)
                request.imagesOnly -> pickImage.launch(images)
                request.multiple -> openDocuments.launch(request.mimeTypes.toTypedArray())
                else -> openDocument.launch(request.mimeTypes.toTypedArray())
            }
        } catch (e: ActivityNotFoundException) {
            toast(R.string.picker_missing)
            deliverFiles(null)
        }
    }

    private fun startCamera() {
        // CAMERA ada di manifest (untuk getUserMedia), jadi ACTION_IMAGE_CAPTURE juga butuh izin itu.
        if (hasPermission(Manifest.permission.CAMERA)) launchCamera() else cameraPermission.launch(Manifest.permission.CAMERA)
    }

    private fun launchCamera() {
        val dir = File(cacheDir, PHOTO_DIR).apply { mkdirs() }
        val file = File(dir, "foto-${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        cameraFile = file
        cameraUri = uri
        try {
            takePicture.launch(uri)
        } catch (e: ActivityNotFoundException) {
            cameraFile = null
            cameraUri = null
            toast(R.string.camera_missing)
            launchPicker()
        }
    }

    /** Selalu dipanggil tepat sekali per pemilihan, termasuk null saat batal, supaya halaman tidak menunggu. */
    private fun deliverFiles(uris: Array<Uri>?) {
        val callback = fileCallback ?: return
        fileCallback = null
        callback.onReceiveValue(uris)
    }

    private fun clearOldPhotos() {
        val cutoff = System.currentTimeMillis() - PHOTO_MAX_AGE_MS
        File(cacheDir, PHOTO_DIR).listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.delete() }
    }

    // ---------------------------------------------------------------------------------------------
    // Unduhan dan tautan luar

    private fun download(allowedOrigin: String, url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        val uri = Uri.parse(url)
        if (!ServerAddress.isSameOrigin(uri, allowedOrigin)) {
            toast(R.string.download_blocked)
            return
        }
        val name = safeFileName(URLUtil.guessFileName(url, contentDisposition, mimeType))
        try {
            val request = DownloadManager.Request(uri)
                .setTitle(name)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            if (!mimeType.isNullOrBlank()) request.setMimeType(mimeType)
            if (!userAgent.isNullOrBlank()) request.addRequestHeader("User-Agent", userAgent)
            CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            } else {
                // Android 8 dan 9: folder unduhan milik aplikasi, tanpa izin penyimpanan.
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name)
            }
            val manager = getSystemService<DownloadManager>() ?: throw IllegalStateException("DownloadManager tidak ada")
            manager.enqueue(request)
            toast(getString(R.string.download_started, name))
        } catch (e: RuntimeException) {
            toast(R.string.download_failed)
        }
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme?.lowercase(Locale.ROOT) !in EXTERNAL_SCHEMES) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            toast(R.string.external_missing)
        }
    }

    private fun toast(message: Int) = toast(getString(message))

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()

    private companion object {
        const val STATE_WEB = "kira.web"
        const val STATE_ORIGIN = "kira.origin"
        const val PHOTO_DIR = "camera"
        const val PHOTO_MAX_AGE_MS = 24L * 60 * 60 * 1000
        val EXTERNAL_SCHEMES = setOf("http", "https", "mailto", "tel")
        val MEDIA_PERMISSIONS = mapOf(
            PermissionRequest.RESOURCE_AUDIO_CAPTURE to Manifest.permission.RECORD_AUDIO,
            PermissionRequest.RESOURCE_VIDEO_CAPTURE to Manifest.permission.CAMERA,
        )

        fun safeFileName(raw: String): String =
            raw.replace(Regex("[^A-Za-z0-9._ -]"), "_").trim().trimStart('.').take(100).ifEmpty { "kira-unduhan" }
    }
}
