package com.tonhub.wallet.push;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Manager for handling push notifications
 */
public class PushNotificationManager {

    private static final String TAG = "PushNotificationMgr";
    private static Bundle lastPushData = null;
    private static boolean waitingToEmitEvent = false;
    private static boolean isFirstLaunch = true;
    private static PushNotificationManager instance;

    private final ReactApplication mReactApplication;

    private PushNotificationManager(ReactApplication reactApplication) {
        mReactApplication = reactApplication;
    }

    public static synchronized PushNotificationManager getInstance(ReactApplication reactApplication) {
        if (instance == null) {
            instance = new PushNotificationManager(reactApplication);
        }
        return instance;
    }

    /**
     * Processes the push notification intent
     */
    public void processNotificationIntent(Intent intent) {
        if (intent == null)
            return;

        Bundle extras = intent.getExtras();
        if (extras != null) {
            lastPushData = (Bundle) extras.clone();
        }
    }

    /**
     * Called on activity onStart, tracks the first launch of the app
     */
    public void onStart() {
        if (!isFirstLaunch) {
            emitNotificationDataIfNeeded();
        }
        isFirstLaunch = false;
    }

    /**
     * Called on activity onResume
     */
    public void onResume() {
        if (!isFirstLaunch) {
            emitNotificationDataIfNeeded();
        }
    }

    /**
     * Processes new intents that may contain push notification data
     */
    public void onNewIntent(Intent intent) {
        processNotificationIntent(intent);
        emitNotificationDataIfNeeded();
    }

    /**
     * Sends data to JavaScript if needed
     */
    private void emitNotificationDataIfNeeded() {
        if (lastPushData == null) {
            return;
        }

        try {
            final ReactInstanceManager reactInstanceManager = mReactApplication.getReactNativeHost()
                    .getReactInstanceManager();
            ReactContext reactContext = reactInstanceManager.getCurrentReactContext();

            if (reactContext != null) {
                sendDataToJS(reactContext, lastPushData);
                lastPushData = null;
                waitingToEmitEvent = false;
            } else {
                waitingToEmitEvent = true;
                reactInstanceManager
                        .addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
                            @Override
                            public void onReactContextInitialized(ReactContext context) {
                                sendDataToJS(context, lastPushData);
                                lastPushData = null;
                                waitingToEmitEvent = false;
                                reactInstanceManager.removeReactInstanceEventListener(this);
                            }
                        });
            }
        } catch (Exception e) {
            if (!waitingToEmitEvent) {
                waitingToEmitEvent = true;
                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        waitingToEmitEvent = false;
                        emitNotificationDataIfNeeded();
                    }
                }, 1000);
            }
        }
    }

    /**
     * Sends data to JavaScript
     */
    private void sendDataToJS(ReactContext reactContext, Bundle data) {
        try {
            WritableMap params = Arguments.createMap();
            bundleToWritableMap(data, params);
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("pushNotificationOpened", params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending  notification data to JS: ", e);
        }
    }

    /**
     * Converts Bundle to WritableMap for passing to JS
     */
    private void bundleToWritableMap(Bundle bundle, WritableMap map) {
        for (String key : bundle.keySet()) {
            Object value = bundle.get(key);
            if (value == null) {
                map.putNull(key);
            } else if (value instanceof String) {
                map.putString(key, (String) value);
            } else if (value instanceof Integer) {
                map.putInt(key, (Integer) value);
            } else if (value instanceof Boolean) {
                map.putBoolean(key, (Boolean) value);
            } else if (value instanceof Double) {
                map.putDouble(key, (Double) value);
            } else {
                map.putString(key, value.toString());
            }
        }
    }
}