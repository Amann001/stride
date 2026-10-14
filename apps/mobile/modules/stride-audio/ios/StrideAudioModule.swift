import AVFoundation
import ExpoModulesCore

// Lets other apps' music get quieter (not stop) while Stride's voice speaks.
// openApp and openMusicPicker are Android only; on iPhone the JS side uses links instead.
public class StrideAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StrideAudio")

    Function("duck") { () -> Bool in
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
        try session.setActive(true)
        return true
      } catch {
        return false
      }
    }

    Function("unduck") { () -> Bool in
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return true
      } catch {
        return false
      }
    }
  }
}
