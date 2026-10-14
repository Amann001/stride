Pod::Spec.new do |s|
  s.name           = 'StrideAudio'
  s.version        = '1.0.0'
  s.summary        = 'Lowers other apps\' music while Stride speaks.'
  s.description    = 'Lowers other apps\' music while Stride speaks.'
  s.license        = 'MIT'
  s.author         = 'Stride'
  s.homepage       = 'https://github.com/Amann001/stride'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Amann001/stride.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
