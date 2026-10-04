package com.kompyler.ringmemo.recorder

import android.content.Context
import android.os.Build
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.util.UUID
import android.app.NotificationManager

object RecorderStore {
  fun directory(context: Context) = File(context.filesDir, "ringmemo").apply { mkdirs() }
  fun preferences(context: Context) = context.getSharedPreferences("ringmemo-recorder", Context.MODE_PRIVATE)
  fun notificationsEnabled(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.areNotificationsEnabled() &&
      manager.getNotificationChannel("ringmemo_recording")?.importance != NotificationManager.IMPORTANCE_NONE
  }
  fun identity(uid: Int) = "${Build.FINGERPRINT}:$uid:voice_call_pcm16_v1"
  fun audio(context: Context, id: String): File {
    require(UUID.fromString(id).toString() == id) { "Invalid recording ID" }
    return File(directory(context), "$id.wav")
  }

  @Synchronized fun save(context: Context, record: JSONObject) {
    val id = record.getString("id")
    audio(context, id)
    val atomic = AtomicFile(File(directory(context), "$id.json"))
    val stream = atomic.startWrite()
    try { stream.write(record.toString().toByteArray()); atomic.finishWrite(stream) }
    catch (exception: Exception) { atomic.failWrite(stream); throw exception }
  }

  @Synchronized fun records(context: Context): List<JSONObject> = directory(context).listFiles()
    ?.filter { it.extension == "json" }
    ?.mapNotNull { file ->
      try { JSONObject(AtomicFile(file).openRead().bufferedReader().use { reader -> reader.readText() }) }
      catch (_: Exception) {
        val id = file.nameWithoutExtension
        try {
          val audio = audio(context, id)
          JSONObject().put("id", id).put("title", "Recovered capture").put("notes", "")
            .put("startedAt", file.lastModified()).put("endedAt", JSONObject.NULL).put("durationMs", 0)
            .put("fileUri", android.net.Uri.fromFile(audio).toString()).put("status", "recording")
            .put("bytes", 0).put("peak", 0).put("diagnostic", false).put("direction", "unknown")
            .put("identity", "").put("error", "Recording journal was interrupted")
        } catch (_: Exception) { null }
      }
    }
    ?.sortedByDescending { it.optLong("startedAt") } ?: emptyList()

  @Synchronized fun recover(context: Context) {
    records(context).filter { it.optString("status") in listOf("recording", "interrupted") }.forEach {
      if (it.optString("id") != RecordingService.currentId) {
        val bytes = repairAudio(context, it.getString("id"))
        it.put("status", "interrupted").put("error", "Recording process was interrupted; audio may be incomplete")
        if (it.isNull("endedAt")) it.put("endedAt", System.currentTimeMillis())
        it.put("bytes", bytes).put("durationMs", bytes * 1000 / 32000)
        save(context, it)
      }
    }
  }

  fun repairAudio(context: Context, id: String): Long {
    return PcmWav.repair(audio(context, id))
  }

  @Synchronized fun delete(context: Context, id: String) {
    require(id != RecordingService.currentId) { "Stop the recording before deleting it" }
    val file = audio(context, id)
    check(!file.exists() || file.delete()) { "Could not delete audio" }
    val metadata = File(directory(context), "$id.json")
    check(!metadata.exists() || metadata.delete()) { "Could not delete recording metadata" }
  }

  @Synchronized fun review(context: Context, id: String, review: JSONObject, uid: Int) {
    val record = records(context).first { it.getString("id") == id }
    require(record.optBoolean("diagnostic") && record.optString("status") == "completed" && record.optLong("durationMs") >= 3000 && record.optLong("bytes") > 0 && record.optInt("peak") > 0) {
      "Only completed, non-silent captures can be reviewed"
    }
    require(record.optString("identity") == identity(uid)) { "Helper or firmware changed; rerun this test" }
    require(review.optString("route") in listOf("handset", "speakerphone", "bluetooth"))
    require(review.optString("direction") in listOf("incoming", "outgoing"))
    record.put("review", review)
    save(context, record)
  }

  fun verification(context: Context, uid: Int): Map<String, Any> {
    val passed = records(context).filter {
      val review = it.optJSONObject("review")
      it.optBoolean("diagnostic") && it.optString("identity") == identity(uid) && it.optString("status") == "completed" &&
        it.optLong("durationMs") >= 3000 && it.optLong("bytes") > 0 && it.optInt("peak") > 0 && review != null && review.optBoolean("localVoice") &&
        review.optBoolean("remoteVoice") && review.optString("route") == "handset"
    }
    return DeviceVerification.evaluate(passed.map {
      val review = it.getJSONObject("review")
      VerificationTrial(review.optString("direction") == "incoming", review.optBoolean("background"), review.optBoolean("locked"))
    })
  }

  fun map(record: JSONObject): Map<String, Any?> = record.keys().asSequence().associateWith { key ->
    when (val value = record.get(key)) {
      JSONObject.NULL -> null
      is JSONObject -> map(value)
      else -> value
    }
  }
}
