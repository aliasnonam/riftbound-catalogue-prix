package com.aliasnonam.riftboundcatalogue;

import android.Manifest;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.util.Size;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.camera.camera2.interop.Camera2CameraInfo;
import androidx.camera.camera2.interop.Camera2Interop;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.FocusMeteringResult;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Locale;

/**
 * Native Android scanner camera for the purchase mode.
 *
 * The CameraX Preview remains independent from ImageAnalysis: OCR work never
 * draws back into the user preview, and CameraControl owns focus/zoom.
 */
@CapacitorPlugin(name = "PurchaseCamera")
public class PurchaseCameraPlugin extends Plugin {
  private static final long ANALYSIS_INTERVAL_MS = 850L;
  private static final int ACCENT = Color.rgb(235, 190, 94);

  private final ExecutorService analysisExecutor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean analysisBusy = new AtomicBoolean(false);

  private ProcessCameraProvider cameraProvider;
  private Camera camera;
  private FrameLayout scannerLayer;
  private PreviewView previewView;
  private ScannerOverlay overlay;
  private TextRecognizer recognizer;
  private long lastAnalysisAt;
  private volatile long analysisBlockedUntil;
  private int previewWidth;
  private int previewHeight;
  private int previewStreamWidth;
  private int previewStreamHeight;
  private int analysisWidth;
  private int analysisHeight;
  private volatile String afState = "starting";
  private volatile String aeState = "starting";

  @Override
  public void load() {
    recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
  }

  @PluginMethod
  public void start(PluginCall call) {
    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      call.reject("Camera permission is required.");
      return;
    }
    getActivity().runOnUiThread(() -> {
      attachPreview(call);
      ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(getContext());
      future.addListener(() -> {
        try {
          cameraProvider = future.get();
          bindCamera(call);
        } catch (Exception error) {
          stopCamera();
          call.reject("CameraX could not start.", error);
        }
      }, ContextCompat.getMainExecutor(getContext()));
    });
  }

  @PluginMethod
  public void updateBounds(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      updateLayerBounds(call);
      call.resolve();
    });
  }

  @PluginMethod
  public void setZoomRatio(PluginCall call) {
    double requested = call.getDouble("zoom", 1d);
    getActivity().runOnUiThread(() -> {
      if (camera == null || camera.getCameraInfo().getZoomState().getValue() == null) {
        call.reject("Camera zoom is unavailable.");
        return;
      }
      ZoomState state = camera.getCameraInfo().getZoomState().getValue();
      float zoom = Math.max(state.getMinZoomRatio(), Math.min((float) requested, state.getMaxZoomRatio()));
      camera.getCameraControl().setZoomRatio(zoom);
      JSObject result = new JSObject();
      result.put("zoom", zoom);
      call.resolve(result);
    });
  }

  @PluginMethod
  public void focus(PluginCall call) {
    double x = call.getDouble("x", 0.5d);
    double y = call.getDouble("y", 0.5d);
    getActivity().runOnUiThread(() -> requestFocus((float) x, (float) y));
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      stopCamera();
      call.resolve();
    });
  }

  @Override
  protected void handleOnDestroy() {
    stopCamera();
    analysisExecutor.shutdown();
    if (recognizer != null) recognizer.close();
    super.handleOnDestroy();
  }

  private void attachPreview(PluginCall call) {
    if (scannerLayer == null) {
      scannerLayer = new FrameLayout(getContext());
      GradientDrawable roundedBackground = new GradientDrawable();
      roundedBackground.setColor(Color.BLACK);
      roundedBackground.setCornerRadius(16f * getContext().getResources().getDisplayMetrics().density);
      scannerLayer.setBackground(roundedBackground);
      scannerLayer.setClipToOutline(true);
      previewView = new PreviewView(getContext());
      previewView.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
      previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
      scannerLayer.addView(previewView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
      overlay = new ScannerOverlay();
      scannerLayer.addView(overlay, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
      scannerLayer.setOnTouchListener((view, event) -> {
        if (event.getAction() == MotionEvent.ACTION_UP && previewView != null) {
          requestFocus(event.getX() / Math.max(1f, previewView.getWidth()), event.getY() / Math.max(1f, previewView.getHeight()));
        }
        return true;
      });
      ViewGroup root = getActivity().findViewById(android.R.id.content);
      root.addView(scannerLayer);
    }
    updateLayerBounds(call);
    scannerLayer.setVisibility(View.VISIBLE);
  }

  private void updateLayerBounds(PluginCall call) {
    if (scannerLayer == null) return;
    float density = call.getDouble("devicePixelRatio", 1d).floatValue();
    int x = Math.round(call.getDouble("x", 0d).floatValue() * density);
    int y = Math.round(call.getDouble("y", 0d).floatValue() * density);
    previewWidth = Math.max(1, Math.round(call.getDouble("width", 1d).floatValue() * density));
    previewHeight = Math.max(1, Math.round(call.getDouble("height", 1d).floatValue() * density));
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(previewWidth, previewHeight);
    params.leftMargin = x;
    params.topMargin = y;
    scannerLayer.setLayoutParams(params);
  }

  private void bindCamera(PluginCall call) {
    if (cameraProvider == null || previewView == null) {
      call.reject("Camera preview is unavailable.");
      return;
    }
    Preview.Builder previewBuilder = new Preview.Builder()
      .setTargetResolution(new Size(1920, 1080));
    // Ask the Android camera device for real continuous autofocus and normal
    // auto-exposure. This is a camera request, not a WebView/CSS hint.
    Camera2Interop.Extender<Preview> previewInterop = new Camera2Interop.Extender<>(previewBuilder);
    previewInterop.setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
    previewInterop.setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
    previewInterop.setSessionCaptureCallback(new CameraCaptureSession.CaptureCallback() {
      @Override
      public void onCaptureCompleted(CameraCaptureSession session, CaptureRequest request, TotalCaptureResult result) {
        updateCaptureStates(result);
      }
    });
    Preview preview = previewBuilder.build();
    preview.setSurfaceProvider(ContextCompat.getMainExecutor(getContext()), surfaceRequest -> {
      Size resolution = surfaceRequest.getResolution();
      previewStreamWidth = resolution.getWidth();
      previewStreamHeight = resolution.getHeight();
      previewView.getSurfaceProvider().onSurfaceRequested(surfaceRequest);
      notifyDiagnostics();
    });

    ImageAnalysis analysis = new ImageAnalysis.Builder()
      .setTargetResolution(new Size(1280, 720))
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .build();
    analysis.setAnalyzer(analysisExecutor, this::analyseFrame);

    cameraProvider.unbindAll();
    // CameraX's DEFAULT_BACK_CAMERA selects Android's standard rear logical
    // camera; unlike WebView it provides native AF/AE and zoom controls.
    camera = cameraProvider.bindToLifecycle((LifecycleOwner) getActivity(), CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis);
    analysisBlockedUntil = System.currentTimeMillis() + 850L;
    afState = "continuous-picture";
    aeState = "searching";
    observeCameraState();

    JSObject result = diagnostics();
    result.put("backend", "CameraX");
    result.put("frameRate", 30);
    result.put("afMode", "continuous-picture");
    call.resolve(result);
  }

  private void observeCameraState() {
    if (camera == null) return;
    camera.getCameraInfo().getZoomState().observe((LifecycleOwner) getActivity(), state -> {
      if (state == null) return;
      JSObject diagnostics = diagnostics();
      diagnostics.put("zoom", state.getZoomRatio());
      diagnostics.put("minZoom", state.getMinZoomRatio());
      diagnostics.put("maxZoom", state.getMaxZoomRatio());
      diagnostics.put("backend", "CameraX");
      diagnostics.put("afMode", "continuous-picture");
      notifyListeners("diagnostics", diagnostics);
    });
  }

  private void analyseFrame(ImageProxy imageProxy) {
    long now = System.currentTimeMillis();
    if (now < analysisBlockedUntil || "passive-scan".equals(afState) || "active-scan".equals(afState) || now - lastAnalysisAt < ANALYSIS_INTERVAL_MS || !analysisBusy.compareAndSet(false, true)) {
      imageProxy.close();
      return;
    }
    lastAnalysisAt = now;
    if (imageProxy.getImage() == null || recognizer == null) {
      analysisBusy.set(false);
      imageProxy.close();
      return;
    }
    InputImage image = InputImage.fromMediaImage(imageProxy.getImage(), imageProxy.getImageInfo().getRotationDegrees());
    recognizer.process(image)
      .addOnSuccessListener(result -> {
        String text = result.getText();
        if (!text.trim().isEmpty()) {
          JSObject payload = new JSObject();
          payload.put("text", text);
          notifyListeners("textRecognized", payload);
        }
      })
      .addOnCompleteListener(result -> {
        int width = imageProxy.getWidth();
        int height = imageProxy.getHeight();
        getActivity().runOnUiThread(() -> {
          analysisWidth = width;
          analysisHeight = height;
          notifyDiagnostics();
        });
        analysisBusy.set(false);
        imageProxy.close();
      });
  }

  private void requestFocus(float normalizedX, float normalizedY) {
    if (camera == null || previewView == null) return;
    float x = Math.max(0f, Math.min(1f, normalizedX)) * previewView.getWidth();
    float y = Math.max(0f, Math.min(1f, normalizedY)) * previewView.getHeight();
    // Give CameraX AF/AE time to settle after an explicit focus request before
    // passing another frame to OCR.
    analysisBlockedUntil = System.currentTimeMillis() + 550L;
    MeteringPoint point = previewView.getMeteringPointFactory().createPoint(x, y);
    FocusMeteringAction action = new FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE)
      .setAutoCancelDuration(3, TimeUnit.SECONDS)
      .build();
    if (!camera.getCameraInfo().isFocusMeteringSupported(action)) {
      JSObject status = new JSObject();
      status.put("success", false);
      notifyListeners("focusStatus", status);
      return;
    }
    if (overlay != null) overlay.showFocus(x, y);
    ListenableFuture<FocusMeteringResult> focusFuture = camera.getCameraControl().startFocusAndMetering(action);
    focusFuture
      .addListener(() -> {
        JSObject status = new JSObject();
        try {
          FocusMeteringResult result = focusFuture.get();
          status.put("success", result.isFocusSuccessful());
        } catch (Exception error) {
          status.put("success", false);
        }
        notifyListeners("focusStatus", status);
      }, ContextCompat.getMainExecutor(getContext()));
  }

  private JSObject diagnostics() {
    JSObject result = new JSObject();
    result.put("debug", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
    if (camera != null) {
      Camera2CameraInfo info = Camera2CameraInfo.from(camera.getCameraInfo());
      result.put("cameraId", info.getCameraId());
      float[] focalLengths = info.getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
      if (focalLengths != null && focalLengths.length > 0) {
        StringBuilder lens = new StringBuilder("rear · ");
        for (int index = 0; index < focalLengths.length; index += 1) {
          if (index > 0) lens.append(", ");
          lens.append(String.format(Locale.US, "%.1f mm", focalLengths[index]));
        }
        result.put("lens", lens.toString());
      } else {
        result.put("lens", "rear");
      }
    }
    result.put("afState", afState);
    result.put("aeState", aeState);
    result.put("previewWidth", previewStreamWidth);
    result.put("previewHeight", previewStreamHeight);
    result.put("analysisWidth", analysisWidth);
    result.put("analysisHeight", analysisHeight);
    if (camera != null && camera.getCameraInfo().getZoomState().getValue() != null) {
      ZoomState zoom = camera.getCameraInfo().getZoomState().getValue();
      result.put("zoom", zoom.getZoomRatio());
      result.put("minZoom", zoom.getMinZoomRatio());
      result.put("maxZoom", zoom.getMaxZoomRatio());
    }
    return result;
  }

  private void stopCamera() {
    if (cameraProvider != null) cameraProvider.unbindAll();
    camera = null;
    analysisBusy.set(false);
    analysisBlockedUntil = 0L;
    afState = "stopped";
    aeState = "stopped";
    if (scannerLayer != null) scannerLayer.setVisibility(View.GONE);
  }

  private void notifyDiagnostics() {
    if (camera == null) return;
    JSObject update = diagnostics();
    update.put("backend", "CameraX");
    update.put("frameRate", 30);
    update.put("afMode", "continuous-picture");
    notifyListeners("diagnostics", update);
  }

  private void updateCaptureStates(TotalCaptureResult result) {
    Integer af = result.get(CaptureResult.CONTROL_AF_STATE);
    Integer ae = result.get(CaptureResult.CONTROL_AE_STATE);
    String nextAf = readableAfState(af);
    String nextAe = readableAeState(ae);
    if (nextAf.equals(afState) && nextAe.equals(aeState)) return;
    afState = nextAf;
    aeState = nextAe;
    getActivity().runOnUiThread(this::notifyDiagnostics);
  }

  private String readableAfState(Integer state) {
    if (state == null) return "unavailable";
    switch (state) {
      case CaptureResult.CONTROL_AF_STATE_INACTIVE: return "inactive";
      case CaptureResult.CONTROL_AF_STATE_PASSIVE_SCAN: return "passive-scan";
      case CaptureResult.CONTROL_AF_STATE_PASSIVE_FOCUSED: return "passive-focused";
      case CaptureResult.CONTROL_AF_STATE_ACTIVE_SCAN: return "active-scan";
      case CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED: return "focused-locked";
      case CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED: return "not-focused-locked";
      case CaptureResult.CONTROL_AF_STATE_PASSIVE_UNFOCUSED: return "passive-unfocused";
      default: return "unknown";
    }
  }

  private String readableAeState(Integer state) {
    if (state == null) return "unavailable";
    switch (state) {
      case CaptureResult.CONTROL_AE_STATE_INACTIVE: return "inactive";
      case CaptureResult.CONTROL_AE_STATE_SEARCHING: return "searching";
      case CaptureResult.CONTROL_AE_STATE_CONVERGED: return "converged";
      case CaptureResult.CONTROL_AE_STATE_LOCKED: return "locked";
      case CaptureResult.CONTROL_AE_STATE_FLASH_REQUIRED: return "flash-required";
      case CaptureResult.CONTROL_AE_STATE_PRECAPTURE: return "precapture";
      default: return "unknown";
    }
  }

  private final class ScannerOverlay extends View {
    private final Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float focusX = -1f;
    private float focusY = -1f;

    ScannerOverlay() {
      super(PurchaseCameraPlugin.this.getContext());
      setWillNotDraw(false);
      border.setColor(ACCENT);
      border.setStyle(Paint.Style.STROKE);
      border.setStrokeWidth(3f * getResources().getDisplayMetrics().density);
      label.setColor(ACCENT);
      label.setTextAlign(Paint.Align.CENTER);
      label.setTextSize(11f * getResources().getDisplayMetrics().scaledDensity);
      label.setFakeBoldText(true);
    }

    void showFocus(float x, float y) {
      focusX = x;
      focusY = y;
      invalidate();
      postDelayed(() -> {
        focusX = -1f;
        focusY = -1f;
        invalidate();
      }, 650L);
    }

    @Override
    protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      float width = getWidth();
      float height = getHeight();
      float guideHeight = height * .78f;
      float guideWidth = Math.min(width * .78f, guideHeight * 63f / 88f);
      float left = (width - guideWidth) / 2f;
      float top = (height - guideHeight) / 2f;
      canvas.drawRoundRect(new RectF(left, top, left + guideWidth, top + guideHeight), 16f, 16f, border);
      canvas.drawText("CARTE", width / 2f, height / 2f, label);
      if (focusX >= 0f && focusY >= 0f) {
        canvas.drawCircle(focusX, focusY, 28f * getResources().getDisplayMetrics().density, border);
      }
    }
  }
}
