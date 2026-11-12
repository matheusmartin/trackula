package trackula.app.pages

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.painterResource
import trackula.app.Platform
import trackula.app.Session
import trackula.app.components.Notice
import trackula.app.components.NoticeKind
import trackula.app.components.PrimaryButton
import trackula.app.errorText
import trackula.app.resources.Res
import trackula.app.resources.logo
import kotlin.math.hypot

/** The padding of the sign-in page on the left and on the right. */
private val SIDE_PADDING = 24.dp

/** The padding of the sign-in page at the top and at the bottom. */
private val END_PADDING = 32.dp

/**
 * The full-screen sign-in page: the logo, the app name and a short text in the middle, and the Google sign-in button
 * at the bottom. Sizes use the smaller of the width and the height, so the page fits portrait and landscape screens.
 * If the screen is too small for all parts, for example a phone in landscape, the page scrolls.
 *
 * While the Google window is open, the button is disabled and a progress circle shows.
 *
 * [expired] is true if the user was signed out because the 1-hour token expired.
 */
@Composable
fun SignInPage(platform: Platform, expired: Boolean, onSignedIn: (Session) -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val colors = MaterialTheme.colorScheme

    // The latest parameters: Compose can keep a function reference of an earlier composition, with its values.
    val isExpired by rememberUpdatedState(expired)
    val signedIn by rememberUpdatedState(onSignedIn)

    fun signIn() {
        busy = true
        error = null
        scope.launch {
            try {
                signedIn(platform.signIn(selectAccount = !isExpired))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = "Sign-in failed: ${errorText(e)}"
            } finally {
                busy = false
            }
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .drawBehind {
                // A circle of light behind the logo, as `radial-gradient(circle at 50% 38%, …)` of the Dart app.
                val center = Offset(size.width * 0.5f, size.height * 0.38f)
                val radius = hypot(maxOf(center.x, size.width - center.x), maxOf(center.y, size.height - center.y))
                drawRect(
                    Brush.radialGradient(
                        0f to colors.surfaceContainerHighest,
                        0.65f to colors.surface,
                        center = center,
                        radius = radius,
                    ),
                )
            },
    ) {
        val short = min(maxWidth, maxHeight)
        // At least as high as the screen: the logo is in the middle and the button is at the bottom. A higher
        // content scrolls.
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .heightIn(min = maxHeight)
                .padding(horizontal = SIDE_PADDING, vertical = END_PADDING),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // An empty first part: then the logo part is in the middle of the page.
            Spacer(Modifier.size(0.dp))
            Column(
                modifier = Modifier.padding(vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(
                    painterResource(Res.drawable.logo),
                    contentDescription = null,
                    modifier = Modifier.size(min(short * 0.4f, 280.dp)),
                )
                Text(
                    "Trackula",
                    modifier = Modifier.semantics { heading() },
                    color = colors.primary,
                    fontSize = (short.value * 0.12f).coerceIn(36f, 96f).sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.02).sp,
                )
                Text(
                    "Track your habits and your body measurements.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
            Column(
                modifier = Modifier.widthIn(max = 384.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (expired) Notice("Google access lasts 1 hour. Sign in again to continue.")
                error?.let { Notice(it, kind = NoticeKind.ERROR) }
                if (busy) Progress("Continue in the Google window.")
                PrimaryButton(
                    text = "Sign in with Google",
                    onClick = ::signIn,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    icon = "login",
                )
                Text(
                    "Your data stays in your own Google Sheet. The app has no server.",
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** A progress circle and a [text] that tells what the app waits for. */
@Composable
internal fun Progress(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
