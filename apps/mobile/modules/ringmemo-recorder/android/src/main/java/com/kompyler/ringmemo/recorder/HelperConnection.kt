package com.kompyler.ringmemo.recorder

import android.content.ComponentName
import android.content.Context
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.content.pm.PackageManager
import rikka.shizuku.Shizuku

object HelperConnection {
  @Volatile var capture: ICaptureService? = null
  @Volatile var error: String? = null
  private var initialized = false
  private var binding = false
  private lateinit var context: Context
  private val handler = Handler(Looper.getMainLooper())
  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
      capture = ICaptureService.Stub.asInterface(binder)
      if (RecordingService.currentId == null) {
        try { capture?.stop(); RecorderStore.recover(context) }
        catch (exception: Exception) { error = "Stale capture cleanup failed: ${exception.message}" }
      }
      binding = false
      if (error?.startsWith("Stale capture") != true) error = null
      RecorderEvents.emit()
    }
    override fun onServiceDisconnected(name: ComponentName) { lost() }
  }

  fun initialize(app: Context) {
    if (initialized) return
    initialized = true
    context = app.applicationContext
    Shizuku.addBinderReceivedListenerSticky { handler.post { connect() } }
    Shizuku.addBinderDeadListener { handler.post { lost() } }
    Shizuku.addRequestPermissionResultListener { _, result ->
      handler.post {
        if (result == PackageManager.PERMISSION_GRANTED) connect()
        else { error = "Shizuku permission denied"; RecorderEvents.emit() }
      }
    }
    connect()
  }

  fun available() = try { Shizuku.pingBinder() } catch (_: Exception) { false }
  fun authorized() = try { available() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED } catch (_: Exception) { false }
  fun uid() = try { if (authorized()) Shizuku.getUid() else -1 } catch (_: Exception) { -1 }

  fun request() {
    check(available()) { "Start Shizuku first, then return to RingMemo" }
    if (authorized()) connect() else Shizuku.requestPermission(410)
  }

  fun connect() {
    if (!authorized() || capture != null || binding) return
    try {
      binding = true
      Shizuku.bindUserService(Shizuku.UserServiceArgs(ComponentName(context, CaptureService::class.java))
        .daemon(false).processNameSuffix("ringmemo_capture").debuggable(false).version(1), connection)
      handler.postDelayed({
        if (binding && capture == null) {
          binding = false
          error = "Capture helper did not connect. Restart Shizuku and retry."
          RecorderEvents.emit()
        }
      }, 10000)
    } catch (exception: Exception) {
      binding = false
      error = "Helper connection failed: ${exception.message}"
      RecorderEvents.emit()
    }
  }

  private fun lost() {
    capture = null
    binding = false
    error = "Shizuku disconnected; recording is unavailable"
    RecordingService.instance?.helperLost()
    RecorderEvents.emit()
  }
}

object RecorderEvents {
  var listener: (() -> Unit)? = null
  fun emit() { listener?.invoke() }
}
