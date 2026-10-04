package com.kompyler.ringmemo.recorder

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class RingMemoRecorderModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  private val handler = Handler(Looper.getMainLooper())

  private fun requireSetup() {
    check(appContext.currentActivity != null) { "Open RingMemo before arming recording" }
    check(HelperConnection.authorized() && HelperConnection.capture != null) { "Authorize and connect Shizuku first" }
    check(RecorderStore.preferences(context).getBoolean("consent", false)) { "Acknowledge recording consent first" }
    check(context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED &&
      context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Grant audio and phone permissions first" }
    check(RecorderStore.notificationsEnabled(context)) { "Enable recording notifications first" }
  }

  private fun status(): Map<String, Any?> {
    val app = context
    val uid = HelperConnection.uid()
    val permissions = app.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
      app.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
    val verification = RecorderStore.verification(app, uid)
    val error = RecordingService.lastError ?: HelperConnection.error
    val consent = RecorderStore.preferences(app).getBoolean("consent", false)
    val notifications = RecorderStore.notificationsEnabled(app)
    val ready = permissions && consent && notifications && HelperConnection.capture != null && HelperConnection.authorized()
    return mapOf(
      "state" to when {
        RecordingService.currentId != null -> "recording"
        error != null -> "failed"
        ready && verification["passed"] == true -> "ready"
        else -> "setup_required"
      },
      "error" to error, "helperAvailable" to HelperConnection.available(), "helperAuthorized" to HelperConnection.authorized(),
      "helperConnected" to (HelperConnection.capture != null), "helperUid" to uid,
      "permissionsGranted" to permissions, "notificationsEnabled" to notifications, "consent" to consent,
      "armed" to (RecordingService.instance != null), "currentId" to RecordingService.currentId,
      "automationRequested" to RecorderStore.preferences(app).getBoolean("automation", false),
      "verification" to verification,
      "device" to mapOf("manufacturer" to Build.MANUFACTURER, "model" to Build.MODEL, "android" to Build.VERSION.RELEASE,
        "api" to Build.VERSION.SDK_INT, "fingerprint" to Build.FINGERPRINT, "abis" to Build.SUPPORTED_ABIS.toList())
    )
  }

  override fun definition() = ModuleDefinition {
    Name("RingMemoRecorder")
    Events("onStatusChanged")
    OnCreate {
      RecorderStore.recover(context)
      RecorderEvents.listener = { handler.post { sendEvent("onStatusChanged", status()) } }
      handler.post { HelperConnection.initialize(context.applicationContext) }
    }
    OnDestroy { RecorderEvents.listener = null; handler.removeCallbacksAndMessages(null) }
    AsyncFunction("getStatus") { status() }
    AsyncFunction("requestHelperAuthorization") {
      check(HelperConnection.available()) { "Start Shizuku first, then return to RingMemo" }
      handler.post { try { HelperConnection.request() } catch (exception: Exception) {
        HelperConnection.error = exception.message
        RecorderEvents.emit()
      } }
      true
    }
    AsyncFunction("acknowledgeConsent") { accepted: Boolean ->
      RecorderStore.preferences(context).edit().putBoolean("consent", accepted).commit()
      if (!accepted) {
        RecorderStore.preferences(context).edit().putBoolean("automation", false).commit()
        if (RecordingService.instance != null) context.startService(Intent(context, RecordingService::class.java).setAction(RecordingService.DISARM))
      }
      status()
    }
    AsyncFunction("armDiagnostic") {
      requireSetup()
      check(RecordingService.instance == null) { "Disarm the current session first" }
      context.startForegroundService(Intent(context, RecordingService::class.java).setAction(RecordingService.ARM_TEST))
      true
    }
    AsyncFunction("setAutomationEnabled") { enabled: Boolean ->
      if (enabled) {
        requireSetup()
        check(RecorderStore.verification(context, HelperConnection.uid())["passed"] == true) { "Five incoming and five outgoing handset tests, including background and locked screen, must pass first" }
        check(RecordingService.instance == null) { "Disarm the current session first" }
      }
      RecorderStore.preferences(context).edit().putBoolean("automation", enabled).commit()
      if (enabled) context.startForegroundService(Intent(context, RecordingService::class.java).setAction(RecordingService.ENABLE))
      else if (RecordingService.instance != null) context.startService(Intent(context, RecordingService::class.java).setAction(RecordingService.DISARM))
      true
    }
    AsyncFunction("stopCurrentRecording") {
      if (RecordingService.instance != null) context.startService(Intent(context, RecordingService::class.java).setAction(RecordingService.STOP))
      true
    }
    AsyncFunction("disarm") {
      if (RecordingService.instance != null) context.startService(Intent(context, RecordingService::class.java).setAction(RecordingService.DISARM))
      true
    }
    AsyncFunction("listRecordings") { RecorderStore.records(context).map { RecorderStore.map(it) } }
    AsyncFunction("deleteRecording") { id: String -> RecorderStore.delete(context, id); true }
    AsyncFunction("reviewDiagnostic") { id: String, review: Map<String, Any> ->
      RecorderStore.review(context, id, JSONObject(review), HelperConnection.uid())
      status()
    }
    AsyncFunction("getDiagnosticReport") {
      JSONObject().put("generatedAt", System.currentTimeMillis()).put("status", JSONObject(status()))
        .put("captureSource", "VOICE_CALL / PCM16 mono 16000Hz")
        .put("limitations", "OFFHOOK may include dialing. Voice intelligibility is verified by the user, not inferred from file size. No physical capture results ship with this app.")
        .put("tests", org.json.JSONArray(RecorderStore.records(context).map {
          JSONObject(it.toString()).apply { remove("notes"); remove("title"); remove("fileUri") }
        })).toString(2)
    }
  }
}
