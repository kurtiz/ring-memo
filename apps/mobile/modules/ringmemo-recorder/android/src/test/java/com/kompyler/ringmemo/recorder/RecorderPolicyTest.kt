package com.kompyler.ringmemo.recorder

import org.junit.Assert.*
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.io.File

class RecorderPolicyTest {
  @Test fun missedCallDoesNotRecord() {
    val call = CallLifecycle()
    assertEquals(CallLifecycle.Action.NONE, call.update(1))
    assertEquals(CallLifecycle.Action.NONE, call.update(0))
  }

  @Test fun duplicateOffhookDoesNotRestartCapture() {
    val call = CallLifecycle()
    call.update(1)
    assertTrue(call.incoming)
    assertEquals(CallLifecycle.Action.START, call.update(2))
    assertEquals(CallLifecycle.Action.NONE, call.update(2))
    assertEquals(CallLifecycle.Action.FINISH, call.update(0))
    assertEquals(CallLifecycle.Action.START, call.update(2))
  }

  @Test fun stopSuppressesCaptureUntilIdle() {
    val call = CallLifecycle()
    call.update(2)
    call.stopForCurrentCall()
    assertEquals(CallLifecycle.Action.NONE, call.update(2))
    call.update(0)
    assertEquals(CallLifecycle.Action.START, call.update(2))
  }

  @Test fun verificationRequiresBothDirectionsAndScreenScenarios() {
    assertEquals(false, DeviceVerification.evaluate(emptyList())["passed"])
    val trials = List(5) { VerificationTrial(true, false, false) } + List(5) { VerificationTrial(false, false, false) }
    assertEquals(false, DeviceVerification.evaluate(trials)["passed"])
    assertEquals(false, DeviceVerification.evaluate(trials.dropLast(1) + VerificationTrial(true, true, true))["passed"])
    assertEquals(true, DeviceVerification.evaluate(trials.dropLast(1) + VerificationTrial(false, true, true))["passed"])
  }

  @Test fun wavHeaderMatchesActualPcmLength() {
    val header = PcmWav.header(32000)
    val bytes = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)
    assertEquals("RIFF", String(header.copyOfRange(0, 4)))
    assertEquals("WAVE", String(header.copyOfRange(8, 12)))
    assertEquals(32036, bytes.getInt(4))
    assertEquals(16000, bytes.getInt(24))
    assertEquals(32000, bytes.getInt(40))
    assertThrows(IllegalArgumentException::class.java) { PcmWav.header(1) }
  }

  @Test fun interruptedWavRecoveryRepairsHeaderAndDropsIncompleteSample() {
    val file = File.createTempFile("ringmemo-interrupted", ".wav")
    try {
      file.writeBytes(ByteArray(44 + 1001))
      assertEquals(1000L, PcmWav.repair(file))
      assertEquals(1044L, file.length())
      val bytes = ByteBuffer.wrap(file.readBytes()).order(ByteOrder.LITTLE_ENDIAN)
      assertEquals(1000, bytes.getInt(40))
      assertEquals(1036, bytes.getInt(4))
    } finally { file.delete() }
  }

  @Test fun missingInterruptedFileIsNotRecreated() {
    val file = File.createTempFile("ringmemo-missing", ".wav")
    file.delete()
    assertEquals(0L, PcmWav.repair(file))
    assertFalse(file.exists())
  }
}
