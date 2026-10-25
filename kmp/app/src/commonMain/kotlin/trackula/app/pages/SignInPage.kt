package trackula.app.pages

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.painterResource
import trackula.app.LocalExtraColors
import trackula.app.Platform
import trackula.app.Session
import trackula.app.components.Symbol
import trackula.app.errorText
import trackula.app.resources.Res
import trackula.app.resources.logo
import kotlin.math.hypot

/**
 * The full-screen sign-in page: a large logo in the center and a Google sign-in button at the bottom. Sizes use the
 * smaller of the width and the height, so the page fits portrait and landscape screens.
 *
 * [expired] is true if the user was signed out because the 1-hour token expired.
 */
@Composable
fun SignInPage(platform: Platform, expired: Boolean, onSignedIn: (Session) -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val colors = MaterialTheme.colorScheme
    val extra = LocalExtraColors.current

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
            }
            .padding(horizontal = 24.dp, vertical = 32.dp),
    ) {
        val short = min(maxWidth, maxHeight)
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(
                    painterResource(Res.drawable.logo),
                    contentDescription = null,
                    modifier = Modifier.size(min(short * 0.55f, 352.dp)),
                )
                Text(
                    "Trackula",
                    color = colors.primary,
                    fontSize = (short.value * 0.13f).coerceIn(44f, 112f).sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.02).sp,
                )
            }
            Column(
                modifier = Modifier.widthIn(max = 384.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (expired) {
                    Text(
                        "Google access lasts 1 hour. Sign in again to continue.",
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                }
                // The main button of the app, with the darker logo gradient.
                val buttonBackground = if (busy) Modifier else Modifier.background(extra.actionBrush)
                Box(Modifier.clip(CircleShape).then(buttonBackground)) {
                    Button(
                        onClick = ::signIn,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.Transparent,
                            contentColor = extra.onAction,
                        ),
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Symbol("login")
                            Text("Sign in with Google", fontSize = 16.sp)
                        }
                    }
                }
                error?.let {
                    Text(it, color = colors.error, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                }
            }
        }
    }
}
