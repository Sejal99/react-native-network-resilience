package com.networkresilience

import com.facebook.react.bridge.ReactApplicationContext

class NetworkResilienceModule(reactContext: ReactApplicationContext) :
  NativeNetworkResilienceSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeNetworkResilienceSpec.NAME
  }
}
