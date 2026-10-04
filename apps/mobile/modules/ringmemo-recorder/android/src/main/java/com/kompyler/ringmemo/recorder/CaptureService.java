package com.kompyler.ringmemo.recorder;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.os.Binder;
import org.json.JSONObject;
import java.io.FileOutputStream;

/** Runs in Shizuku's shell/root process. Never falls back to microphone capture. */
public final class CaptureService extends ICaptureService.Stub {
  private static final int SAMPLE_RATE = 16000;
  private volatile boolean running = false;
  private volatile long bytes = 0;
  private volatile int peak = 0;
  private volatile String error = "";
  private Thread worker;

  public CaptureService() {}

  @Override public synchronized String start(ParcelFileDescriptor output) {
    if (worker != null && worker.isAlive()) return result("Capture is already running");
    // Attribute the audio request to the helper, not the app calling this Binder method.
    long identity = Binder.clearCallingIdentity();
    bytes = 0; peak = 0; error = "";
    AudioRecord recorder = null;
    FileOutputStream stream = null;
    try {
      int minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
      if (minimum <= 0) throw new IllegalStateException("PCM format unavailable: " + minimum);
      recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_CALL, SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(minimum * 2, 8192));
      if (recorder.getState() != AudioRecord.STATE_INITIALIZED)
        throw new IllegalStateException("VOICE_CALL initialization rejected");
      // A passed descriptor keeps all audio app-private even when the helper UID is shell.
      stream = new ParcelFileDescriptor.AutoCloseOutputStream(ParcelFileDescriptor.dup(output.getFileDescriptor()));
      stream.write(new byte[44]);
      recorder.startRecording();
      if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING)
        throw new IllegalStateException("VOICE_CALL start rejected");
      running = true;
      final AudioRecord source = recorder;
      final FileOutputStream destination = stream;
      worker = new Thread(() -> capture(source, destination), "RingMemo-PCM");
      worker.start();
    } catch (Exception exception) {
      error = exception.getClass().getSimpleName() + ": " + exception.getMessage();
      running = false;
      if (recorder != null) recorder.release();
      if (stream != null) try { stream.close(); } catch (Exception ignored) {}
    } finally {
      try { output.close(); } catch (Exception ignored) {}
      Binder.restoreCallingIdentity(identity);
    }
    return result(error);
  }

  private void capture(AudioRecord source, FileOutputStream destination) {
    byte[] buffer = new byte[4096];
    try {
      while (running) {
        int count = source.read(buffer, 0, buffer.length, AudioRecord.READ_NON_BLOCKING);
        if (count < 0) throw new IllegalStateException("AudioRecord read failed: " + count);
        if (count == 0) { Thread.sleep(10); continue; }
        destination.write(buffer, 0, count);
        bytes += count;
        for (int i = 0; i + 1 < count; i += 2) {
          int sample = (short) ((buffer[i] & 255) | (buffer[i + 1] << 8));
          peak = Math.max(peak, Math.abs(sample));
        }
        if (bytes > 0xffffffffL - 44) throw new IllegalStateException("WAV size limit reached");
      }
    } catch (Exception exception) {
      error = exception.getClass().getSimpleName() + ": " + exception.getMessage();
    } finally {
      running = false;
      try { source.stop(); } catch (Exception ignored) {}
      source.release();
      try {
        destination.getChannel().position(0);
        destination.write(PcmWav.header(bytes));
        destination.getFD().sync();
        destination.close();
      } catch (Exception exception) {
        error = "WAV finalization failed: " + exception.getMessage();
      }
    }
  }

  @Override public synchronized String stop() {
    running = false;
    if (worker != null) {
      try { worker.join(5000); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
      if (worker.isAlive()) error = "Capture did not stop in time";
    }
    return result(error);
  }

  @Override public String status() { return result(error); }

  private String result(String message) {
    try {
      return new JSONObject().put("running", running).put("bytes", bytes).put("peak", peak)
        .put("error", message).put("uid", Process.myUid()).put("sampleRate", SAMPLE_RATE).toString();
    } catch (Exception exception) { return "{\"running\":false,\"error\":\"Diagnostic serialization failed\"}"; }
  }

  @Override public void destroy() { stop(); System.exit(0); }
}
