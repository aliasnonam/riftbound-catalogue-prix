package com.aliasnonam.riftboundcatalogue;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(CollectionBackupPlugin.class);
    registerPlugin(PurchaseCameraPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
