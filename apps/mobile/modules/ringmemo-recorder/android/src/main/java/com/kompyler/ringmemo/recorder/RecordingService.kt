package com.kompyler.ringmemo.recorder

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import org.json.JSONObject
import java.util.UUID

class RecordingService : Service() {
  companion object {
    const val ARM_TEST = "ringmemo.ARM_TEST"
    const val ENABLE = "ringmemo.ENABLE"
    const val DISARM = "ringmemo.DISARM"
    const val STOP = "ringmemo.STOP"
    private const val CHANNEL = "ringmemo_recording"
    private const val NOTIFICATION = 410
    @Volatile var instance: RecordingService? = null
    @Volatile var currentId: String? = null
    @Volatile var lastError: String? = null
  }
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var telephony: TelephonyManager
  private var callback: TelephonyCallback? = null
  private var legacy: PhoneStateListener? = null
  private var record: JSONObject? = null
  private var diagnostic = true
  private var skipping = false
  private var sawRinging = false
  private val lifecycle = CallLifecycle()
  private var stopping = false
  private var pendingCapture: Runnable? = null
  var callState: Int = TelephonyManager.CALL_STATE_IDLE
    private set

  private val health = object : Runnable {
    override fun run() {
      if (stopping) return
      try {
        check(HelperConnection.authorized() && HelperConnection.capture != null) { "Capture helper unavailable" }
        check(checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) { "Phone permission revoked" }
        check(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Audio permission revoked" }
        check(RecorderStore.notificationsEnabled(this@RecordingService)) { "Recording notifications disabled" }
        check(RecorderStore.preferences(this@RecordingService).getBoolean("consent", false)) { "Recording consent revoked" }
        if (!diagnostic) check(RecorderStore.verification(this@RecordingService, HelperConnection.uid())["passed"] == true) {
          "Device verification is no longer valid; rerun the handset tests"
        }
        if (record != null) {
          val result = JSONObject(HelperConnection.capture!!.status())
          check(result.optBoolean("running")) { result.optString("error").ifBlank { "Capture stopped unexpectedly" } }
        }
        handler.postDelayed(this, 1000)
      } catch (exception: Exception) {
        lastError = exception.message
        finishCapture("failed", lastError)
        disarm()
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    telephony = getSystemService(TelephonyManager::class.java)
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Call recording status", NotificationManager.IMPORTANCE_LOW))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == DISARM) { finishCapture(); disarm(); return START_NOT_STICKY }
    if (intent?.action == STOP) {
      skipping = true
      lifecycle.stopForCurrentCall()
      pendingCapture?.let { handler.removeCallbacks(it) }
      pendingCapture = null
      finishCapture()
      if (diagnostic) disarm() else notifyStatus()
      return START_NOT_STICKY
    }
    try {
      require(intent?.action == ARM_TEST || intent?.action == ENABLE) { "Open RingMemo to rearm recording" }
      require(record == null) { "A recording is already running" }
      require(HelperConnection.capture != null && HelperConnection.authorized()) { "Connect Shizuku first" }
      require(checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) { "Phone permission required" }
      require(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Audio permission required" }
      require(RecorderStore.notificationsEnabled(this)) { "Enable notifications first" }
      require(RecorderStore.preferences(this).getBoolean("consent", false)) { "Acknowledge recording consent first" }
      diagnostic = intent.action == ARM_TEST
      if (!diagnostic) require(RecorderStore.verification(this, HelperConnection.uid())["passed"] == true) { "Device tests have not passed" }
      lastError = null
      skipping = false
      stopping = false
      startForeground(NOTIFICATION, notification())
      registerCallMonitor()
      handler.removeCallbacks(health)
      handler.postDelayed(health, 1000)
    } catch (exception: Exception) {
      lastError = exception.message
      disarm()
    }
    RecorderEvents.emit()
    // Reboot/process death requires foreground rearming; do not evade Android's start restrictions.
    return START_NOT_STICKY
  }

  @Suppress("DEPRECATION")
  private fun registerCallMonitor() {
    if (callback != null || legacy != null) return
    if (Build.VERSION.SDK_INT >= 31) {
      val listener = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) { onCallState(state) }
      }
      callback = listener
      telephony.registerTelephonyCallback(mainExecutor, listener)
    } else {
      legacy = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, number: String?) { onCallState(state) }
      }
      telephony.listen(legacy, PhoneStateListener.LISTEN_CALL_STATE)
    }
  }

  private fun onCallState(state: Int) {
    if (stopping) return
    val previous = callState
    callState = state
    val action = lifecycle.update(state)
    when (state) {
      TelephonyManager.CALL_STATE_RINGING -> sawRinging = true
      TelephonyManager.CALL_STATE_OFFHOOK -> if (action == CallLifecycle.Action.START && !skipping && record == null) waitForTelephonyAudio()
      TelephonyManager.CALL_STATE_IDLE -> {
        pendingCapture?.let { handler.removeCallbacks(it) }
        pendingCapture = null
        val captured = record != null
        finishCapture()
        skipping = false
        sawRinging = false
        if (diagnostic && (captured || previous == TelephonyManager.CALL_STATE_OFFHOOK)) disarm()
      }
    }
    RecorderEvents.emit()
  }

  private fun waitForTelephonyAudio() {
    var attempts = 0
    val task = object : Runnable {
      override fun run() {
        if (stopping || skipping || callState != TelephonyManager.CALL_STATE_OFFHOOK) return
        if (getSystemService(AudioManager::class.java).mode == AudioManager.MODE_IN_CALL) {
          pendingCapture = null
          beginCapture()
        } else if (++attempts < 40) handler.postDelayed(this, 250)
        else {
          lastError = "Telephony audio mode never became active; no audio was captured"
          pendingCapture = null
          disarm()
        }
      }
    }
    pendingCapture = task
    handler.post(task)
  }

  private fun beginCapture() {
    try {
      // OFFHOOK may include outgoing dialing. It does not establish an exact answer timestamp.
      val audio = getSystemService(AudioManager::class.java)
      require(audio.mode == AudioManager.MODE_IN_CALL) { "Telephony audio mode is not active; retry the test during the call" }
      val id = UUID.randomUUID().toString()
      val file = RecorderStore.audio(this, id)
      val started = System.currentTimeMillis()
      record = JSONObject().put("id", id).put("startedAt", started).put("endedAt", JSONObject.NULL)
        .put("durationMs", 0).put("fileUri", android.net.Uri.fromFile(file).toString())
        .put("title", "Call · ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date(started))}")
        .put("notes", "").put("status", "recording").put("diagnostic", diagnostic)
        .put("direction", if (sawRinging) "incoming" else "unknown").put("bytes", 0).put("peak", 0)
        .put("identity", RecorderStore.identity(HelperConnection.uid())).put("error", JSONObject.NULL)
      currentId = id
      RecorderStore.save(this, record!!)
      val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_CREATE or
        ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE)
      val result = descriptor.use { JSONObject(HelperConnection.capture!!.start(it)) }
      require(result.optBoolean("running")) { result.optString("error", "VOICE_CALL capture failed") }
      notifyStatus()
    } catch (exception: Exception) {
      lastError = exception.message
      skipping = true
      finishCapture("failed", lastError)
      disarm()
    }
  }

  private fun finishCapture(status: String = "completed", reason: String? = null) {
    val current = record ?: return
    try {
      val result = HelperConnection.capture?.let { JSONObject(it.stop()) }
      val bytes = result?.optLong("bytes") ?: RecorderStore.repairAudio(this, current.getString("id"))
      val error = reason ?: result?.optString("error")?.takeIf { it.isNotBlank() }
      val finalStatus = if (status != "completed") status else if (result == null || error != null || bytes == 0L) "failed" else "completed"
      current.put("endedAt", System.currentTimeMillis()).put("durationMs", bytes * 1000 / 32000)
        .put("bytes", bytes).put("peak", result?.optInt("peak") ?: 0).put("status", finalStatus)
        .put("error", error ?: if (finalStatus == "failed") "No audio captured" else JSONObject.NULL)
      RecorderStore.save(this, current)
    } catch (exception: Exception) {
      lastError = "Finalization failed: ${exception.message}"
      current.put("status", "interrupted").put("error", lastError)
      try { RecorderStore.save(this, current) } catch (_: Exception) { /* Recovered on next launch. */ }
    } finally {
      record = null
      currentId = null
      RecorderEvents.emit()
    }
  }

  fun helperLost() { handler.post { finishCapture("interrupted", "Capture helper disconnected"); disarm() } }

  private fun disarm() {
    stopping = true
    pendingCapture?.let { handler.removeCallbacks(it) }
    pendingCapture = null
    handler.removeCallbacks(health)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    RecorderEvents.emit()
  }

  private fun notification(): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)!!
    val content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val stop = PendingIntent.getBroadcast(this, 1,
      Intent(this, RecordingActionReceiver::class.java).setAction(if (record == null) DISARM else STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    return Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(if (record == null) "RingMemo is armed" else "Recording cellular call")
      .setContentText(if (record == null) { if (diagnostic) "Waiting for one test call" else "Automatic recording enabled" } else "Tap Stop to end this recording")
      .setOngoing(true).setContentIntent(content)
      .addAction(Notification.Action.Builder(null, if (record == null) "Disarm" else "Stop", stop).build()).build()
  }

  private fun notifyStatus() { getSystemService(NotificationManager::class.java).notify(NOTIFICATION, notification()) }
  override fun onBind(intent: Intent?): IBinder? = null

  @Suppress("DEPRECATION")
  override fun onDestroy() {
    stopping = true
    handler.removeCallbacksAndMessages(null)
    finishCapture("interrupted", "Recording service stopped")
    try {
      if (Build.VERSION.SDK_INT >= 31) callback?.let { telephony.unregisterTelephonyCallback(it) }
      legacy?.let { telephony.listen(it, PhoneStateListener.LISTEN_NONE) }
    } catch (_: SecurityException) { /* Revoked permissions must not crash service teardown. */ }
    instance = null
    RecorderEvents.emit()
    super.onDestroy()
  }
}

class RecordingActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (RecordingService.instance != null) context.startService(Intent(context, RecordingService::class.java).setAction(intent.action))
  }
}
