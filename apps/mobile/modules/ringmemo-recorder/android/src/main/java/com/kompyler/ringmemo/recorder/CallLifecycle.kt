package com.kompyler.ringmemo.recorder

/** Android-independent call boundary policy; OFFHOOK includes outgoing dialing. */
class CallLifecycle {
  enum class Action { NONE, START, FINISH }
  var incoming = false
    private set
  private var active = false
  private var suppressed = false

  fun stopForCurrentCall() { suppressed = true; active = false }

  fun update(state: Int): Action = when (state) {
    1 -> { incoming = true; Action.NONE }
    2 -> if (active || suppressed) Action.NONE else { active = true; Action.START }
    0 -> {
      val action = if (active) Action.FINISH else Action.NONE
      active = false; suppressed = false; incoming = false
      action
    }
    else -> Action.NONE
  }
}
