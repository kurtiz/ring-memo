package com.kompyler.ringmemo.recorder;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

public final class PcmWav {
  /** Repair an interrupted streaming WAV without certifying it as a completed recording. */
  public static long repair(File audio) throws IOException {
    if (!audio.exists()) return 0;
    try (RandomAccessFile file = new RandomAccessFile(audio, "rw")) {
      long bytes = Math.max(0, file.length() - 44) / 2 * 2;
      if (bytes > 0) {
        file.setLength(bytes + 44);
        file.seek(0);
        file.write(header(bytes));
        file.getFD().sync();
      }
      return bytes;
    }
  }

  public static byte[] header(long bytes) {
    if (bytes < 0 || bytes > 0xffffffffL - 36 || bytes % 2 != 0)
      throw new IllegalArgumentException("Invalid PCM data length");
    ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
    header.put(new byte[] {'R','I','F','F'}).putInt((int) (bytes + 36));
    header.put(new byte[] {'W','A','V','E','f','m','t',' '}).putInt(16);
    header.putShort((short) 1).putShort((short) 1).putInt(16000);
    header.putInt(32000).putShort((short) 2).putShort((short) 16);
    header.put(new byte[] {'d','a','t','a'}).putInt((int) bytes);
    return header.array();
  }
}
