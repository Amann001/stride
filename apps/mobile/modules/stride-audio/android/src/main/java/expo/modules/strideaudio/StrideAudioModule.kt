package expo.modules.strideaudio

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Two small jobs for the record screen:
// - duck/unduck: while Stride's voice speaks, ask Android to make other apps' music quieter
//   (audio focus "transient, may duck"), then give the focus back so the music comes back up.
// - openApp/openMusicPicker: open the music app you picked, or the phone's own music app.
class StrideAudioModule : Module() {
  private val listener = AudioManager.OnAudioFocusChangeListener { }
  private var request: AudioFocusRequest? = null

  private val context: Context?
    get() = appContext.reactContext

  private val audio: AudioManager?
    get() = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  override fun definition() = ModuleDefinition {
    Name("StrideAudio")

    Function("duck") {
      val am = audio ?: return@Function false
      val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val r = request ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build()
          )
          .setOnAudioFocusChangeListener(listener)
          .build()
          .also { request = it }
        am.requestAudioFocus(r)
      } else {
        @Suppress("DEPRECATION")
        am.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      }
      result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    Function("unduck") {
      val am = audio ?: return@Function false
      val r = request
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && r != null) {
        am.abandonAudioFocusRequest(r)
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(listener)
      }
      true
    }

    // Opens an installed app by its package name. False if it isn't installed.
    Function("openApp") { packageName: String ->
      val ctx = context ?: return@Function false
      val intent = Intent(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_LAUNCHER)
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(intent)
        true
      } catch (e: ActivityNotFoundException) {
        false
      }
    }

    // Opens the phone's default music app (Android asks which one if there are several).
    Function("openMusicPicker") {
      val ctx = context ?: return@Function false
      val intent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(intent)
        true
      } catch (e: ActivityNotFoundException) {
        false
      }
    }
  }
}
