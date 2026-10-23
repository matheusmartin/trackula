package trackula.app

/** The text of [e] for the user: its message, as the Dart app showed `'$e'`. */
fun errorText(e: Throwable): String = e.message ?: e.toString()
