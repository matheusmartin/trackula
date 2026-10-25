package trackula.services

/**
 * The Google values of the app: the OAuth client ID and the Picker API key. They are build values, not values in the
 * code. See README.md.
 *
 * @property clientId The OAuth client ID from Google Auth Platform → Clients → Trackula web. The client ID is public.
 *   Do not put the client secret in a build value.
 * @property apiKey The API key for the Google Picker, from APIs & Services → Credentials. The key is visible in the
 *   browser. Restrict it to the app's websites and to the Google Picker API.
 */
data class Config(val clientId: String, val apiKey: String) {
    /**
     * The Cloud project number. The Picker uses it to give this app access to the picked file. The first part of the
     * client ID is the project number.
     */
    val projectNumber: String get() = clientId.substringBefore('-')

    /** True if the build has a client ID, not the example value of config.example.env. */
    val hasClientId: Boolean get() = clientId.isNotEmpty() && !clientId.startsWith("REPLACE_WITH")

    /** True if the build has an API key, not the example value of config.example.env. */
    val hasApiKey: Boolean get() = apiKey.isNotEmpty() && !apiKey.startsWith("REPLACE_WITH")

    companion object {
        /** The values of this build: environment variables or config.env. See the generateConfig task. */
        val build = Config(BuildConfig.GOOGLE_CLIENT_ID, BuildConfig.GOOGLE_API_KEY)
    }
}
