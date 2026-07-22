'use client';

import { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onRetake?: () => void;
  capturedImage: string | null;
}

/**
 * Komponen pengambilan foto real-time via kamera browser.
 * Galeri tidak diizinkan — foto harus diambil langsung.
 */
export function CameraCapture({ onCapture, onRetake, capturedImage }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (screenshot) {
      onCapture(screenshot);
    }
  }, [onCapture]);

  const handleUserMediaError = useCallback(() => {
    setError(
      'Kamera diperlukan untuk absensi. Izinkan akses kamera di pengaturan browser, lalu muat ulang halaman.'
    );
  }, []);

  if (error) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-lg bg-slate-100 p-6 text-center md:aspect-video">
        <Camera className="h-10 w-10 text-text-secondary" aria-hidden="true" />
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (capturedImage) {
    return (
      <div className="flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capturedImage}
          alt="Pratinjau foto absensi"
          className="aspect-[3/4] w-full rounded-lg object-cover md:aspect-video"
        />
        <Button type="button" variant="outline" onClick={onRetake}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Ambil Ulang
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-lg bg-slate-900">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.8}
          videoConstraints={{
            facingMode,
            width: { ideal: 1200 },
            height: { ideal: 900 },
          }}
          onUserMedia={() => setIsReady(true)}
          onUserMediaError={handleUserMediaError}
          playsInline
          muted
          mirrored={facingMode === 'user'}
          className="aspect-[3/4] w-full object-cover md:aspect-video"
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-white">Menyiapkan kamera...</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
          aria-label="Ganti kamera depan/belakang"
          className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        >
          <SwitchCamera className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <Button type="button" size="lg" onClick={handleCapture} disabled={!isReady}>
        <Camera className="h-5 w-5" aria-hidden="true" />
        Ambil Foto
      </Button>
    </div>
  );
}
