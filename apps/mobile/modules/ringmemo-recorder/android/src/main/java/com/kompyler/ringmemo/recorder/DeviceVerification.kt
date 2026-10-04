package com.kompyler.ringmemo.recorder

data class VerificationTrial(val incoming: Boolean, val background: Boolean, val locked: Boolean)

object DeviceVerification {
  fun evaluate(trials: List<VerificationTrial>): Map<String, Any> {
    val incoming = trials.count { it.incoming }
    val outgoing = trials.size - incoming
    val background = trials.any { it.background }
    val locked = trials.any { it.locked }
    return mapOf("incoming" to incoming, "outgoing" to outgoing, "background" to background,
      "locked" to locked, "passed" to (incoming >= 5 && outgoing >= 5 && background && locked))
  }
}
