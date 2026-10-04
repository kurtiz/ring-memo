package com.kompyler.ringmemo.recorder;
import android.os.ParcelFileDescriptor;

interface ICaptureService {
  String start(in ParcelFileDescriptor output) = 0;
  String stop() = 1;
  String status() = 2;
  void destroy() = 16777114;
}
