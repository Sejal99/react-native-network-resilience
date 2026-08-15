package com.networkresilience

import com.facebook.react.bridge.ReactApplicationContext

class NetworkResilienceModule(reactContext: ReactApplicationContext) :
  NativeNetworkResilienceSpec(reactContext) {

  companion object {
    const val NAME = NativeNetworkResilienceSpec.NAME
  }
}
