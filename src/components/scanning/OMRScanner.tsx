'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  Upload, 
  ArrowLeft,
  RotateCcw,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Scan,
  Save,
  User
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { getClassById, getClasses, Class, Student } from '@/services/classService';
import { toast } from 'sonner';
import { AnswerChoice } from '@/types/scanning';

interface OMRScannerProps {
  examId: string;
}

interface ScanResult {
  studentId: string;
  answers: string[];
  score: number;
  totalQuestions: number;
  percentage: number;
  letterGrade: string;
  timestamp: string;
}

export default function OMRScanner({ examId }: OMRScannerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectionLoopRef = useRef<number | null>(null);
  // Temporal stabilization: once markers are found, lock their positions
  const lockedMarkersRef = useRef<{
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
    stableFrames: number;
    locked: boolean;
  } | null>(null);
  
  // State
  const [exam, setExam] = useState<Exam | null>(null);
  const [answerKey, setAnswerKey] = useState<AnswerChoice[]>([]);
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'select' | 'camera' | 'upload' | 'processing' | 'review' | 'results'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [detectedAnswers, setDetectedAnswers] = useState<string[]>([]);
  const [detectedStudentId, setDetectedStudentId] = useState<string>('');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [studentIdError, setStudentIdError] = useState<string | null>(null);
  const [multipleAnswerQuestions, setMultipleAnswerQuestions] = useState<number[]>([]);
  const [idDoubleShadeColumns, setIdDoubleShadeColumns] = useState<number[]>([]);
  const [imageSource, setImageSource] = useState<'camera' | 'upload' | null>(null);
  const [markersDetected, setMarkersDetected] = useState(false);
  // Load exam data
  useEffect(() => {
    async function loadExamData() {
      try {
        setLoading(true);
        const examData = await getExamById(examId);
        if (examData) {
          setExam(examData);
          
          // Load answer key
          const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
          if (akResult.success && akResult.data) {
            setAnswerKey(akResult.data.answers);
          }
          
          // Load class data if exam has classId
          if ((examData as any).classId) {
            const cls = await getClassById((examData as any).classId);
            if (cls) {
              setClassData(cls);
            }
          }
          
          // Fallback: if no classId but has className, try to find class by name
          if (!(examData as any).classId && examData.className && user) {
            try {
              const allClasses = await getClasses(user.id);
              const matchedClass = allClasses.find(c => 
                c.class_name === examData.className || 
                `${c.class_name} - ${c.section_block}` === examData.className
              );
              if (matchedClass) {
                setClassData(matchedClass);
              }
            } catch (e) {
              console.warn('Could not find class by name:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading exam:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    }
    
    loadExamData();
  }, [examId]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Update video when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(err => {
          console.error('Error playing video:', err);
        });
      };
    }
  }, [stream]);

  // Real-time marker detection loop for camera mode
  useEffect(() => {
    if (mode !== 'camera' || !stream) {
      // Stop detection loop when not in camera mode
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
      lockedMarkersRef.current = null;
      return;
    }

    const detectCanvas = document.createElement('canvas');
    const detectCtx = detectCanvas.getContext('2d', { willReadFrequently: true });
    if (!detectCtx) return;

    let lastDetectTime = 0;
    const DETECT_INTERVAL = 500; // Run detection every 500ms to save CPU

    const runDetection = (timestamp: number) => {
      if (mode !== 'camera' || !videoRef.current || videoRef.current.readyState < 2) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      if (timestamp - lastDetectTime < DETECT_INTERVAL) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }
      lastDetectTime = timestamp;

      const video = videoRef.current;
      // Use lower resolution for fast detection (320px wide)
      const scale = 320 / video.videoWidth;
      const w = Math.floor(video.videoWidth * scale);
      const h = Math.floor(video.videoHeight * scale);
      
      detectCanvas.width = w;
      detectCanvas.height = h;
      detectCtx.drawImage(video, 0, 0, w, h);

      try {
        const imgData = detectCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Fast grayscale + threshold
        const grayscale = new Uint8Array(w * h);
        for (let i = 0; i < data.length; i += 4) {
          grayscale[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        const otsu = calculateOtsuThreshold(grayscale);
        const binary = new Uint8Array(w * h);
        for (let i = 0; i < grayscale.length; i++) {
          binary[i] = grayscale[i] < otsu ? 1 : 0;
        }

        // Detect markers
        const markers = findCornerMarkers(binary, w, h, true);
        
        // ── Temporal stabilization: lock positions once confidently found ──
        const LOCK_THRESHOLD = 3;   // frames before hard-lock
        const DEADZONE = 8;         // pixels — ignore jitter smaller than this
        const SMOOTH = 0.15;        // EMA weight for new readings (low = more stable)

        if (markers.found) {
          const prev = lockedMarkersRef.current;
          if (prev) {
            const dist = (a: {x:number;y:number}, b: {x:number;y:number}) =>
              Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

            const dtl = dist(prev.topLeft, markers.topLeft);
            const dtr = dist(prev.topRight, markers.topRight);
            const dbl = dist(prev.bottomLeft, markers.bottomLeft);
            const dbr = dist(prev.bottomRight, markers.bottomRight);
            const maxDrift = Math.max(dtl, dtr, dbl, dbr);

            if (maxDrift < DEADZONE) {
              // Within deadzone — keep locked positions, bump stable counter
              prev.stableFrames = Math.min(prev.stableFrames + 1, LOCK_THRESHOLD + 5);
              if (prev.stableFrames >= LOCK_THRESHOLD) prev.locked = true;
            } else if (prev.locked && maxDrift < DEADZONE * 4) {
              // Locked but mild drift — ignore (keeps overlay rock-solid)
            } else {
              // Significant movement — sheet repositioned, smoothly follow
              const blend = (a: {x:number;y:number}, b: {x:number;y:number}) => ({
                x: a.x + (b.x - a.x) * SMOOTH,
                y: a.y + (b.y - a.y) * SMOOTH,
              });
              prev.topLeft = blend(prev.topLeft, markers.topLeft);
              prev.topRight = blend(prev.topRight, markers.topRight);
              prev.bottomLeft = blend(prev.bottomLeft, markers.bottomLeft);
              prev.bottomRight = blend(prev.bottomRight, markers.bottomRight);
              prev.stableFrames = 0;
              prev.locked = false;
            }
          } else {
            // First detection — seed the locked positions
            lockedMarkersRef.current = {
              topLeft: { ...markers.topLeft },
              topRight: { ...markers.topRight },
              bottomLeft: { ...markers.bottomLeft },
              bottomRight: { ...markers.bottomRight },
              stableFrames: 1,
              locked: false,
            };
          }
        } else {
          // Markers not found — if previously locked, keep showing locked positions
          // for a few frames (don't flash). Only clear after sustained loss.
          if (lockedMarkersRef.current) {
            lockedMarkersRef.current.stableFrames = Math.max(0, lockedMarkersRef.current.stableFrames - 1);
            if (lockedMarkersRef.current.stableFrames <= 0) {
              lockedMarkersRef.current = null;
            }
          }
        }

        // Use stabilized positions for overlay
        const stable = lockedMarkersRef.current;
        const displayMarkers = stable ? {
          found: true,
          topLeft: stable.topLeft,
          topRight: stable.topRight,
          bottomLeft: stable.bottomLeft,
          bottomRight: stable.bottomRight,
        } : markers;

        setMarkersDetected(displayMarkers.found);

        // Draw overlay on the overlay canvas — FIXED positions (static viewfinder)
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          const oCtx = overlay.getContext('2d');
          if (oCtx) {
            overlay.width = overlay.offsetWidth * (window.devicePixelRatio || 1);
            overlay.height = overlay.offsetHeight * (window.devicePixelRatio || 1);
            oCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
            oCtx.clearRect(0, 0, overlay.offsetWidth, overlay.offsetHeight);

            const displayW = overlay.offsetWidth;
            const displayH = overlay.offsetHeight;

            // Fixed corner positions — static margin from each edge
            const margin = 24;
            const cornerLen = 30; // length of each corner bracket arm
            const found = displayMarkers.found;
            const color = found ? '#22c55e' : '#ef4444';
            const fillColor = found ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.15)';

            oCtx.strokeStyle = color;
            oCtx.lineWidth = 3;
            oCtx.lineCap = 'round';

            // Helper: draw an L-shaped corner bracket
            const drawBracket = (cx: number, cy: number, dirX: number, dirY: number) => {
              // Small filled circle at the corner point
              oCtx.fillStyle = fillColor;
              oCtx.beginPath();
              oCtx.arc(cx, cy, 6, 0, Math.PI * 2);
              oCtx.fill();
              oCtx.strokeStyle = color;
              oCtx.stroke();

              // L-bracket arms
              oCtx.beginPath();
              oCtx.moveTo(cx + dirX * cornerLen, cy);
              oCtx.lineTo(cx, cy);
              oCtx.lineTo(cx, cy + dirY * cornerLen);
              oCtx.stroke();
            };

            // Top-Left (arms go right and down)
            drawBracket(margin, margin, 1, 1);
            // Top-Right (arms go left and down)
            drawBracket(displayW - margin, margin, -1, 1);
            // Bottom-Left (arms go right and up)
            drawBracket(margin, displayH - margin, 1, -1);
            // Bottom-Right (arms go left and up)
            drawBracket(displayW - margin, displayH - margin, -1, -1);

            // Static connecting border lines (dashed)
            oCtx.strokeStyle = found ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.2)';
            oCtx.lineWidth = 2;
            oCtx.setLineDash([6, 4]);
            oCtx.beginPath();
            oCtx.moveTo(margin, margin);
            oCtx.lineTo(displayW - margin, margin);
            oCtx.lineTo(displayW - margin, displayH - margin);
            oCtx.lineTo(margin, displayH - margin);
            oCtx.closePath();
            oCtx.stroke();
            oCtx.setLineDash([]);

            // Status label
            oCtx.font = 'bold 13px sans-serif';
            oCtx.textAlign = 'center';
            oCtx.fillStyle = found ? '#22c55e' : '#ef4444';
            oCtx.fillText(
              found ? '✓ Markers Detected — Align Sheet' : 'Align Sheet to Corners',
              displayW / 2,
              displayH - margin + 16
            );
          }
        }
      } catch (e) {
        // Ignore detection errors in live preview
      }

      detectionLoopRef.current = requestAnimationFrame(runDetection);
    };

    detectionLoopRef.current = requestAnimationFrame(runDetection);

    return () => {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stream]);

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      
      setStream(mediaStream);
      setMode('camera');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Ensure video plays when metadata is loaded
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Error playing video:', err);
            toast.error('Could not start video playback');
          });
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMode('select');
    setCapturedImage(null);
    setImageSource(null);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Capture at full video resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Pre-process camera image: auto-crop to the paper region
    const preprocessed = preprocessCameraImage(canvas, ctx);
    
    setCapturedImage(preprocessed);
    setImageSource('camera');
    setMode('review');
    
    // Stop camera after capture
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // ─── AUTO-CROP & CONTRAST ENHANCEMENT for camera images ───
  const preprocessCameraImage = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string => {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 1. Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 2. Compute Sobel-like gradient magnitude for edge detection
    const gradient = new Float64Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx = -gray[(y-1)*width+(x-1)] + gray[(y-1)*width+(x+1)]
                   -2*gray[y*width+(x-1)] + 2*gray[y*width+(x+1)]
                   -gray[(y+1)*width+(x-1)] + gray[(y+1)*width+(x+1)];
        const gy = -gray[(y-1)*width+(x-1)] - 2*gray[(y-1)*width+x] - gray[(y-1)*width+(x+1)]
                   +gray[(y+1)*width+(x-1)] + 2*gray[(y+1)*width+x] + gray[(y+1)*width+(x+1)];
        gradient[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // 3. Row/column brightness AND gradient analysis
    const rowBrightness = new Float64Array(height);
    const colBrightness = new Float64Array(width);
    const rowGradient = new Float64Array(height);
    const colGradient = new Float64Array(width);

    for (let y = 0; y < height; y++) {
      let bSum = 0, gSum = 0;
      for (let x = 0; x < width; x++) {
        bSum += gray[y * width + x];
        gSum += gradient[y * width + x];
      }
      rowBrightness[y] = bSum / width;
      rowGradient[y] = gSum / width;
    }
    for (let x = 0; x < width; x++) {
      let bSum = 0, gSum = 0;
      for (let y = 0; y < height; y++) {
        bSum += gray[y * width + x];
        gSum += gradient[y * width + x];
      }
      colBrightness[x] = bSum / height;
      colGradient[x] = gSum / height;
    }

    // 4. Adaptive thresholds using percentile statistics
    const sortedRow = Array.from(rowBrightness).sort((a, b) => a - b);
    const sortedCol = Array.from(colBrightness).sort((a, b) => a - b);
    const medianRow = sortedRow[Math.floor(sortedRow.length * 0.5)];
    const medianCol = sortedCol[Math.floor(sortedCol.length * 0.5)];
    const sortedRowGrad = Array.from(rowGradient).sort((a, b) => a - b);
    const sortedColGrad = Array.from(colGradient).sort((a, b) => a - b);
    const edgeThreshRow = sortedRowGrad[Math.floor(sortedRowGrad.length * 0.6)];
    const edgeThreshCol = sortedColGrad[Math.floor(sortedColGrad.length * 0.6)];

    const paperThreshRow = medianRow * 0.65;
    const paperThreshCol = medianCol * 0.65;

    // 5. Detect paper boundary using brightness + edge refinement
    let top = 0, bottom = height - 1, left = 0, right = width - 1;

    // Find initial bounds from brightness
    for (let y = 0; y < height; y++) {
      if (rowBrightness[y] > paperThreshRow) { top = y; break; }
    }
    for (let y = height - 1; y >= 0; y--) {
      if (rowBrightness[y] > paperThreshRow) { bottom = y; break; }
    }
    for (let x = 0; x < width; x++) {
      if (colBrightness[x] > paperThreshCol) { left = x; break; }
    }
    for (let x = width - 1; x >= 0; x--) {
      if (colBrightness[x] > paperThreshCol) { right = x; break; }
    }

    // Refine using gradient peaks (paper edge has high gradient)
    const refineRange = Math.floor(Math.min(width, height) * 0.05);
    for (let y = Math.min(top + refineRange, height - 1); y >= Math.max(0, top - refineRange); y--) {
      if (rowGradient[y] > edgeThreshRow * 1.5 && rowBrightness[y] > paperThreshRow * 0.8) { top = y; break; }
    }
    for (let y = Math.max(bottom - refineRange, 0); y <= Math.min(height - 1, bottom + refineRange); y++) {
      if (rowGradient[y] > edgeThreshRow * 1.5 && rowBrightness[y] > paperThreshRow * 0.8) { bottom = y; break; }
    }
    for (let x = Math.min(left + refineRange, width - 1); x >= Math.max(0, left - refineRange); x--) {
      if (colGradient[x] > edgeThreshCol * 1.5 && colBrightness[x] > paperThreshCol * 0.8) { left = x; break; }
    }
    for (let x = Math.max(right - refineRange, 0); x <= Math.min(width - 1, right + refineRange); x++) {
      if (colGradient[x] > edgeThreshCol * 1.5 && colBrightness[x] > paperThreshCol * 0.8) { right = x; break; }
    }

    // Add padding (1.5%)
    const padX = Math.floor((right - left) * 0.015);
    const padY = Math.floor((bottom - top) * 0.015);
    top = Math.max(0, top - padY);
    bottom = Math.min(height - 1, bottom + padY);
    left = Math.max(0, left - padX);
    right = Math.min(width - 1, right + padX);

    const cropW = right - left + 1;
    const cropH = bottom - top + 1;

    // 6. Crop (if needed) and apply contrast enhancement
    const outputCanvas = document.createElement('canvas');
    const shouldCrop = cropW < width * 0.94 || cropH < height * 0.94;

    if (shouldCrop) {
      outputCanvas.width = cropW;
      outputCanvas.height = cropH;
      const outCtx = outputCanvas.getContext('2d');
      if (outCtx) {
        outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
        console.log(`[Camera] Cropped image from ${width}x${height} to ${cropW}x${cropH} (paper region)`);
        applyContrastEnhancement(outCtx, cropW, cropH);
        return outputCanvas.toDataURL('image/png');
      }
    }

    // No significant crop; still enhance contrast
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outCtx = outputCanvas.getContext('2d');
    if (outCtx) {
      outCtx.drawImage(canvas, 0, 0);
      applyContrastEnhancement(outCtx, width, height);
      console.log('[Camera] Applied contrast enhancement (no crop needed)');
      return outputCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  };

  // ─── CANVAS CONTRAST ENHANCEMENT (white balance + local normalization) ───
  const applyContrastEnhancement = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // White balance: find 95th percentile of brightness and scale to 255
    const brightness: number[] = [];
    for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel for speed
      brightness.push(Math.max(d[i], d[i + 1], d[i + 2]));
    }
    brightness.sort((a, b) => a - b);
    const whitePoint = brightness[Math.floor(brightness.length * 0.95)];
    const blackPoint = brightness[Math.floor(brightness.length * 0.02)];
    const range = Math.max(1, whitePoint - blackPoint);
    const scale = 255 / range;

    // Apply white balance + contrast stretch
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.min(255, Math.max(0, Math.round((d[i] - blackPoint) * scale)));
      d[i + 1] = Math.min(255, Math.max(0, Math.round((d[i + 1] - blackPoint) * scale)));
      d[i + 2] = Math.min(255, Math.max(0, Math.round((d[i + 2] - blackPoint) * scale)));
    }

    // Mild sharpening via unsharp mask (3x3 approximation)
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i += 4) {
      gray[i / 4] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    // Box blur for unsharp mask
    const blurred = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            s += gray[(y + dy) * w + (x + dx)];
          }
        }
        blurred[y * w + x] = Math.round(s / 9);
      }
    }
    // Apply mild sharpening: original + 0.3 * (original - blurred)
    const sharpenAmount = 0.3;
    for (let i = 0; i < d.length; i += 4) {
      const idx = i / 4;
      const diff = gray[idx] - blurred[idx];
      const factor = gray[idx] > 0 ? Math.max(0.8, Math.min(1.5, (gray[idx] + diff * sharpenAmount) / gray[idx])) : 1;
      d[i]     = Math.min(255, Math.max(0, Math.round(d[i] * factor)));
      d[i + 1] = Math.min(255, Math.max(0, Math.round(d[i + 1] * factor)));
      d[i + 2] = Math.min(255, Math.max(0, Math.round(d[i + 2] * factor)));
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      setImageSource('upload');
      setMode('review');
    };
    reader.readAsDataURL(file);
  };

  // Process the captured image using OMR
  const processImage = useCallback(async () => {
    if (!capturedImage || !exam) return;
    
    setProcessing(true);
    setMode('processing');
    
    try {
      // Create an image element
      const img = new Image();
      img.src = capturedImage;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Use the processing canvas
      const canvas = processingCanvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Process the image to detect filled bubbles
      const { studentId, answers, multipleAnswers, idDoubleShades } = await detectBubbles(imageData, exam.num_items, exam.choices_per_item, imageSource || 'upload');
      
      setDetectedStudentId(studentId);
      setDetectedAnswers(answers);
      setMultipleAnswerQuestions(multipleAnswers);
      setIdDoubleShadeColumns(idDoubleShades);
      
      // Validate student ID against class roster
      let idError: string | null = null;
      let matched: Student | null = null;
      
      if (idDoubleShades.length > 0) {
        idError = `Student ID has multiple bubbles shaded in column(s): ${idDoubleShades.join(', ')}. Each column must have only one bubble shaded. Please ask the student to correct their answer sheet or manually edit the ID below.`;
      } else if (!studentId || /^0+$/.test(studentId)) {
        idError = 'No Student ID was detected. Please check if the student properly shaded their ID bubbles.';
      } else if (!classData) {
        idError = 'No class is linked to this exam. Please go to exam settings and assign a class before scanning.';
      } else {
        const student = classData.students.find(s => s.student_id === studentId);
        if (student) {
          matched = student;
        } else {
          idError = `Student ID "${studentId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`;
        }
      }
      
      setMatchedStudent(matched);
      setStudentIdError(idError);
      
      // Calculate score
      let score = 0;
      const totalQuestions = Math.min(answers.length, answerKey.length);
      
      for (let i = 0; i < totalQuestions; i++) {
        if (answers[i] && answerKey[i] && answers[i].toUpperCase() === answerKey[i].toUpperCase()) {
          score++;
        }
      }
      
      const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const letterGrade = calculateLetterGrade(percentage);
      
      const result: ScanResult = {
        studentId,
        answers,
        score,
        totalQuestions,
        percentage,
        letterGrade,
        timestamp: new Date().toISOString()
      };
      
      setScanResult(result);
      setMode('results');
      
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Please try again with a clearer image.');
      setMode('review');
    } finally {
      setProcessing(false);
    }
  }, [capturedImage, exam, answerKey, classData, imageSource]);

  // ─── CORNER MARKER DETECTION (Enhanced with refinement & validation) ───
  const findCornerMarkers = (
    binary: Uint8Array,
    width: number,
    height: number,
    isCamera: boolean = false
  ): {
    found: boolean;
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  } => {
    const minDim = Math.min(width, height);
    const baseMarkerSize = Math.max(12, Math.floor(minDim * 0.04));

    // Multi-scale search sizes — always use 3 scales for robustness
    const markerSizes = [
      Math.floor(baseMarkerSize * 0.6),
      baseMarkerSize,
      Math.floor(baseMarkerSize * 1.5),
    ];
    const searchFraction = isCamera ? 0.35 : 0.30;
    const minDensityThreshold = isCamera ? 0.25 : 0.35;

    // Phase 1: Coarse scan — only accepts solid, square-shaped dark regions
    // This filters out answer bubbles (round), text (elongated), and scattered dark pixels
    const findMarkerInRegion = (
      rx1: number, ry1: number, rx2: number, ry2: number
    ): { x: number; y: number; density: number; size: number } => {
      let bestX = (rx1 + rx2) / 2;
      let bestY = (ry1 + ry2) / 2;
      let bestScore = 0;
      let bestDensity = 0;
      let bestSize = baseMarkerSize;

      for (const markerSize of markerSizes) {
        const step = Math.max(1, Math.floor(markerSize / 4));
        const sampleStep = Math.max(1, Math.floor(markerSize / 8));

        for (let y = ry1; y <= ry2 - markerSize; y += step) {
          for (let x = rx1; x <= rx2 - markerSize; x += step) {
            let filled = 0;
            let total = 0;
            // Also track per-quadrant fill to verify squareness
            let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
            let qt1 = 0, qt2 = 0, qt3 = 0, qt4 = 0;
            const halfM = markerSize / 2;

            for (let dy = 0; dy < markerSize; dy += sampleStep) {
              for (let dx = 0; dx < markerSize; dx += sampleStep) {
                const px = Math.min(width - 1, x + dx);
                const py = Math.min(height - 1, y + dy);
                const val = binary[py * width + px];
                filled += val;
                total++;
                // Quadrant tracking
                if (dx < halfM && dy < halfM) { q1 += val; qt1++; }
                else if (dx >= halfM && dy < halfM) { q2 += val; qt2++; }
                else if (dx < halfM && dy >= halfM) { q3 += val; qt3++; }
                else { q4 += val; qt4++; }
              }
            }

            const density = total > 0 ? filled / total : 0;
            if (density < minDensityThreshold) continue;

            // ── SQUARENESS CHECK ──
            // A solid filled square has all 4 quadrants roughly equally filled.
            // Answer bubbles (round) or text will have uneven quadrant fill.
            const qd1 = qt1 > 0 ? q1 / qt1 : 0;
            const qd2 = qt2 > 0 ? q2 / qt2 : 0;
            const qd3 = qt3 > 0 ? q3 / qt3 : 0;
            const qd4 = qt4 > 0 ? q4 / qt4 : 0;
            const qMin = Math.min(qd1, qd2, qd3, qd4);
            const qMax = Math.max(qd1, qd2, qd3, qd4);
            const uniformity = qMax > 0 ? qMin / qMax : 0;

            // Require all quadrants to be at least 40% as filled as the densest one
            if (uniformity < 0.40) continue;

            // ── BORDER CHECK ──
            // A solid square marker should also have filled pixels along all 4 edges.
            // Bubbles have empty centers or hollow edges.
            let topEdgeFill = 0, botEdgeFill = 0, leftEdgeFill = 0, rightEdgeFill = 0;
            let edgeSamples = 0;
            for (let d = 0; d < markerSize; d += sampleStep) {
              // Top edge
              const tx = Math.min(width - 1, x + d), ty = Math.min(height - 1, y);
              topEdgeFill += binary[ty * width + tx];
              // Bottom edge
              const bx = Math.min(width - 1, x + d), by = Math.min(height - 1, y + markerSize - 1);
              botEdgeFill += binary[by * width + bx];
              // Left edge
              const lx2 = Math.min(width - 1, x), ly = Math.min(height - 1, y + d);
              leftEdgeFill += binary[ly * width + lx2];
              // Right edge
              const rx2 = Math.min(width - 1, x + markerSize - 1), ry = Math.min(height - 1, y + d);
              rightEdgeFill += binary[ry * width + rx2];
              edgeSamples++;
            }
            const edgeDensity = edgeSamples > 0
              ? Math.min(topEdgeFill, botEdgeFill, leftEdgeFill, rightEdgeFill) / edgeSamples
              : 0;
            // All 4 edges should be at least 30% filled
            if (edgeDensity < 0.30) continue;

            // Score = density × uniformity — prefers solid, uniform squares
            const score = density * uniformity;
            if (score > bestScore) {
              bestScore = score;
              bestDensity = density;
              bestX = x + markerSize / 2;
              bestY = y + markerSize / 2;
              bestSize = markerSize;
            }
          }
        }
      }
      return { x: bestX, y: bestY, density: bestDensity, size: bestSize };
    };

    // Phase 2: Flood-fill centroid — isolate each marker's connected dark blob
    // This ONLY counts pixels belonging to the marker itself (not nearby text/bubbles)
    // producing a rock-solid, deterministic center that doesn't shift between scans.
    const refineMarkerCenterFloodFill = (
      cx: number, cy: number, markerSize: number
    ): { x: number; y: number; area: number } => {
      const seedX = Math.round(cx);
      const seedY = Math.round(cy);

      // Find a dark seed pixel at or near the approximate center
      let startPx = seedX, startPy = seedY;
      const hasSeed = seedX >= 0 && seedX < width && seedY >= 0 && seedY < height
                      && binary[seedY * width + seedX] === 1;

      if (!hasSeed) {
        // Spiral outward to find the nearest dark pixel
        let foundSeed = false;
        for (let r = 1; r < markerSize * 1.5 && !foundSeed; r++) {
          for (let dy = -r; dy <= r && !foundSeed; dy++) {
            for (let dx = -r; dx <= r && !foundSeed; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const px = seedX + dx, py = seedY + dy;
              if (px >= 0 && px < width && py >= 0 && py < height && binary[py * width + px] === 1) {
                startPx = px; startPy = py;
                foundSeed = true;
              }
            }
          }
        }
        if (!foundSeed) return { x: cx, y: cy, area: 0 };
      }

      // BFS flood-fill from the seed — only follows connected dark pixels
      const maxDist = Math.ceil(markerSize * 1.8); // stay within marker neighbourhood
      const maxPixels = markerSize * markerSize * 6; // safety cap
      const visited = new Uint8Array((2 * maxDist + 1) * (2 * maxDist + 1));
      const vW = 2 * maxDist + 1;

      const queue: number[] = [startPx, startPy]; // flat pairs [x,y,x,y,...]
      let head = 0;
      const localKey = (px: number, py: number) => (py - seedY + maxDist) * vW + (px - seedX + maxDist);
      visited[localKey(startPx, startPy)] = 1;

      let sumX = 0, sumY = 0, count = 0;
      let minBX = startPx, maxBX = startPx, minBY = startPy, maxBY = startPy;

      while (head < queue.length && count < maxPixels) {
        const px = queue[head++];
        const py = queue[head++];
        sumX += px;
        sumY += py;
        count++;
        if (px < minBX) minBX = px;
        if (px > maxBX) maxBX = px;
        if (py < minBY) minBY = py;
        if (py > maxBY) maxBY = py;

        // 4-connected neighbours
        for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
          const nx = px + ddx, ny = py + ddy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (Math.abs(nx - seedX) > maxDist || Math.abs(ny - seedY) > maxDist) continue;
          const key = localKey(nx, ny);
          if (visited[key]) continue;
          if (binary[ny * width + nx] === 1) {
            visited[key] = 1;
            queue.push(nx, ny);
          }
        }
      }

      if (count > 0) {
        // Validate the blob is roughly square — reject elongated features (text, lines)
        const blobW = maxBX - minBX + 1;
        const blobH = maxBY - minBY + 1;
        const aspect = Math.min(blobW, blobH) / Math.max(blobW, blobH);
        if (aspect < 0.55) {
          console.log(`[OMR] Rejected flood-fill blob: ${blobW}x${blobH}, aspect=${aspect.toFixed(2)}, not square enough`);
          return { x: cx, y: cy, area: 0 };
        }
        // Bounding-box fill ratio: solid squares fill ~100% of bbox, circles ~78%
        const bboxArea = blobW * blobH;
        const fillRatio = count / bboxArea;
        if (fillRatio < 0.65) {
          console.log(`[OMR] Rejected flood-fill blob: fillRatio=${fillRatio.toFixed(2)}, too sparse for a solid marker`);
          return { x: cx, y: cy, area: 0 };
        }
        return { x: sumX / count, y: sumY / count, area: count };
      }
      return { x: cx, y: cy, area: 0 };
    };

    const cW = Math.floor(width * searchFraction);
    const cH = Math.floor(height * searchFraction);

    const tlRaw = findMarkerInRegion(0, 0, cW, cH);
    const trRaw = findMarkerInRegion(width - cW, 0, width, cH);
    const blRaw = findMarkerInRegion(0, height - cH, cW, height);
    const brRaw = findMarkerInRegion(width - cW, height - cH, width, height);

    // Phase 2: Flood-fill refine — locks each marker to its own black blob's centroid
    const tl = tlRaw.density > minDensityThreshold
      ? (() => { const r = refineMarkerCenterFloodFill(tlRaw.x, tlRaw.y, tlRaw.size); return { x: r.area > 0 ? r.x : tlRaw.x, y: r.area > 0 ? r.y : tlRaw.y, density: tlRaw.density }; })()
      : tlRaw;
    const tr = trRaw.density > minDensityThreshold
      ? (() => { const r = refineMarkerCenterFloodFill(trRaw.x, trRaw.y, trRaw.size); return { x: r.area > 0 ? r.x : trRaw.x, y: r.area > 0 ? r.y : trRaw.y, density: trRaw.density }; })()
      : trRaw;
    const bl = blRaw.density > minDensityThreshold
      ? (() => { const r = refineMarkerCenterFloodFill(blRaw.x, blRaw.y, blRaw.size); return { x: r.area > 0 ? r.x : blRaw.x, y: r.area > 0 ? r.y : blRaw.y, density: blRaw.density }; })()
      : blRaw;
    const br = brRaw.density > minDensityThreshold
      ? (() => { const r = refineMarkerCenterFloodFill(brRaw.x, brRaw.y, brRaw.size); return { x: r.area > 0 ? r.x : brRaw.x, y: r.area > 0 ? r.y : brRaw.y, density: brRaw.density }; })()
      : brRaw;

    // Phase 3: Geometric validation
    const densitiesValid = tl.density > minDensityThreshold &&
      tr.density > minDensityThreshold &&
      bl.density > minDensityThreshold &&
      br.density > minDensityThreshold;

    let geometryValid = false;
    if (densitiesValid) {
      // Check that markers form a roughly rectangular quadrilateral
      const topEdge = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
      const bottomEdge = Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2);
      const leftEdge = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
      const rightEdge = Math.sqrt((br.x - tr.x) ** 2 + (br.y - tr.y) ** 2);

      // Edges should be roughly parallel (ratio between 0.7 and 1.4)
      const hRatio = Math.min(topEdge, bottomEdge) / Math.max(topEdge, bottomEdge);
      const vRatio = Math.min(leftEdge, rightEdge) / Math.max(leftEdge, rightEdge);

      // Diagonals should be roughly equal
      const diag1 = Math.sqrt((br.x - tl.x) ** 2 + (br.y - tl.y) ** 2);
      const diag2 = Math.sqrt((bl.x - tr.x) ** 2 + (bl.y - tr.y) ** 2);
      const diagRatio = Math.min(diag1, diag2) / Math.max(diag1, diag2);

      // Minimum size: markers should span at least 30% of image
      const minSpan = minDim * 0.3;
      const spansOk = topEdge > minSpan && leftEdge > minSpan;

      geometryValid = hRatio > 0.7 && vRatio > 0.7 && diagRatio > 0.8 && spansOk;

      console.log(`[OMR] Geometry check: hRatio=${hRatio.toFixed(2)}, vRatio=${vRatio.toFixed(2)}, diagRatio=${diagRatio.toFixed(2)}, spansOk=${spansOk}, valid=${geometryValid}`);
    }

    const markersValid = densitiesValid && geometryValid;

    console.log(`[OMR] Marker detection (${isCamera ? 'camera' : 'upload'}): densities TL=${tl.density.toFixed(2)}, TR=${tr.density.toFixed(2)}, BL=${bl.density.toFixed(2)}, BR=${br.density.toFixed(2)}, threshold=${minDensityThreshold}, found=${markersValid}`);

    return {
      found: markersValid,
      topLeft: { x: tl.x, y: tl.y },
      topRight: { x: tr.x, y: tr.y },
      bottomLeft: { x: bl.x, y: bl.y },
      bottomRight: { x: br.x, y: br.y },
    };
  };

  // ─── COORDINATE MAPPING ───
  const mapToPixel = (
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    nx: number,
    ny: number
  ): { px: number; py: number } => {
    const topX = markers.topLeft.x + nx * (markers.topRight.x - markers.topLeft.x);
    const topY = markers.topLeft.y + nx * (markers.topRight.y - markers.topLeft.y);
    const botX = markers.bottomLeft.x + nx * (markers.bottomRight.x - markers.bottomLeft.x);
    const botY = markers.bottomLeft.y + nx * (markers.bottomRight.y - markers.bottomLeft.y);
    return {
      px: topX + ny * (botX - topX),
      py: topY + ny * (botY - topY),
    };
  };

  // ─── TEMPLATE LAYOUT DEFINITIONS ───
  interface AnswerBlock {
    startQ: number;
    endQ: number;
    firstBubbleNX: number;
    firstBubbleNY: number;
    bubbleSpacingNX: number;
    rowSpacingNY: number;
  }

  interface TemplateLayout {
    id: {
      firstColNX: number;
      firstRowNY: number;
      colSpacingNX: number;
      rowSpacingNY: number;
    };
    answerBlocks: AnswerBlock[];
    bubbleDiameterNX: number;
    bubbleDiameterNY: number;
  }

  const getTemplateLayout = (numQuestions: number): TemplateLayout => {
    const templateType = numQuestions <= 20 ? 20 : numQuestions <= 50 ? 50 : 100;

    if (templateType === 20) {
      // Mini sheet 105 × 148.5 mm
      // Marker centers: TL (7, 19)  BR (98, 126)  →  frame 91 × 107 mm
      const fw = 91, fh = 107;
      return {
        id: {
          firstColNX: 11 / fw,
          firstRowNY: 15 / fh,
          colSpacingNX: 4.5 / fw,
          rowSpacingNY: 3.5 / fh,
        },
        answerBlocks: [
          {
            startQ: 1, endQ: 10,
            firstBubbleNX: 13 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 11, endQ: 20,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
        ],
        bubbleDiameterNX: 3.2 / fw,
        bubbleDiameterNY: 3.2 / fh,
      };
    }

    if (templateType === 50) {
      // Half-page sheet 105 × 297 mm
      // Marker centers: TL (7, 19)  BR (98, 230)  →  frame 91 × 211 mm
      const fw = 91, fh = 211;
      return {
        id: {
          firstColNX: 11 / fw,
          firstRowNY: 15 / fh,
          colSpacingNX: 4.5 / fw,
          rowSpacingNY: 3.5 / fh,
        },
        answerBlocks: [
          // Left column: Q1–10, Q11–20, Q21–30
          {
            startQ: 1, endQ: 10,
            firstBubbleNX: 13 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 11, endQ: 20,
            firstBubbleNX: 13 / fw, firstBubbleNY: 110 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 21, endQ: 30,
            firstBubbleNX: 13 / fw, firstBubbleNY: 162 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          // Right column: Q31–40, Q41–50
          {
            startQ: 31, endQ: 40,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 41, endQ: 50,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 110 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
        ],
        bubbleDiameterNX: 3.2 / fw,
        bubbleDiameterNY: 3.2 / fh,
      };
    }

    // 100‑question full page  210 × 297 mm
    // Marker centers: TL (3, 3)  BR (200, 213.5)  →  frame 197 × 210.5 mm
    //
    // CALIBRATION: The firstBubbleNX values are empirically corrected.
    // The PDF draws bubbles at bx + numW (numW=12mm from block left edge).
    // The original NX values were computed from bx alone, causing a leftward
    // shift of ~1 bubble spacing. Adding 5.0mm corrects this.
    const fw = 197, fh = 210.5;
    const xCorrection = 5.0;  // mm – empirical shift to align with actual bubble centers
    return {
      id: {
        // idStartX=21 page mm → (21 - 6.5) = 14.5 mm from TL marker center
        firstColNX: 14.5 / fw,
        // idBubbleY=48 page mm (with logo) → (48 - 6.5) = 41.5 mm from TL marker center
        firstRowNY: 41.5 / fh,
        colSpacingNX: 4.5 / fw,
        rowSpacingNY: 4.8 / fh,
      },
      answerBlocks: [
        // Top row (beside ID section)
        {
          startQ: 41, endQ: 50,
          firstBubbleNX: (83.35 + xCorrection) / fw,
          firstBubbleNY: 45 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 71, endQ: 80,
          firstBubbleNX: (148.85 + xCorrection) / fw,
          firstBubbleNY: 45 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        // Bottom grid – row 0
        {
          startQ: 1, endQ: 10,
          firstBubbleNX: (20.36 + xCorrection) / fw,
          firstBubbleNY: 99 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 21, endQ: 30,
          firstBubbleNX: (64.52 + xCorrection) / fw,
          firstBubbleNY: 99 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 51, endQ: 60,
          firstBubbleNX: (108.68 + xCorrection) / fw,
          firstBubbleNY: 99 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 81, endQ: 90,
          firstBubbleNX: (152.84 + xCorrection) / fw,
          firstBubbleNY: 99 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        // Bottom grid – row 1
        {
          startQ: 11, endQ: 20,
          firstBubbleNX: (20.36 + xCorrection) / fw,
          firstBubbleNY: 155 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 31, endQ: 40,
          firstBubbleNX: (64.52 + xCorrection) / fw,
          firstBubbleNY: 155 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 61, endQ: 70,
          firstBubbleNX: (108.68 + xCorrection) / fw,
          firstBubbleNY: 155 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 91, endQ: 100,
          firstBubbleNX: (152.84 + xCorrection) / fw,
          firstBubbleNY: 155 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
      ],
      bubbleDiameterNX: 3.8 / fw,
      bubbleDiameterNY: 3.8 / fh,
    };
  };

  // ─── FAST BACKGROUND SUBTRACTION (lighting normalization) ───
  const subtractBackground = (
    gray: Uint8Array,
    width: number,
    height: number
  ): Uint8Array => {
    // Downsample by 8x, compute local max (background estimate), then bilinear upsample
    const factor = 8;
    const sW = Math.ceil(width / factor);
    const sH = Math.ceil(height / factor);

    // Each block’s max = local paper brightness (background)
    const bgSmall = new Uint8Array(sW * sH);
    for (let sy = 0; sy < sH; sy++) {
      for (let sx = 0; sx < sW; sx++) {
        let maxVal = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            const ox = sx * factor + dx;
            const oy = sy * factor + dy;
            if (ox < width && oy < height) {
              maxVal = Math.max(maxVal, gray[oy * width + ox]);
            }
          }
        }
        bgSmall[sy * sW + sx] = maxVal;
      }
    }

    // Smooth the background estimate (3x3 box blur on small image)
    const bgBlurred = new Uint8Array(sW * sH);
    for (let sy = 0; sy < sH; sy++) {
      for (let sx = 0; sx < sW; sx++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = sy + dy, nx = sx + dx;
            if (ny >= 0 && ny < sH && nx >= 0 && nx < sW) {
              sum += bgSmall[ny * sW + nx];
              count++;
            }
          }
        }
        bgBlurred[sy * sW + sx] = Math.round(sum / count);
      }
    }

    // Bilinear upsample and normalize: pixel / background * 255
    const normalized = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = (x / factor) - 0.5;
        const sy = (y / factor) - 0.5;
        const x0 = Math.max(0, Math.floor(sx));
        const y0 = Math.max(0, Math.floor(sy));
        const x1 = Math.min(sW - 1, x0 + 1);
        const y1 = Math.min(sH - 1, y0 + 1);
        const fx = Math.max(0, sx - x0);
        const fy = Math.max(0, sy - y0);

        const bg = (1 - fx) * (1 - fy) * bgBlurred[y0 * sW + x0]
                 + fx * (1 - fy) * bgBlurred[y0 * sW + x1]
                 + (1 - fx) * fy * bgBlurred[y1 * sW + x0]
                 + fx * fy * bgBlurred[y1 * sW + x1];

        const bgVal = Math.max(1, bg);
        normalized[y * width + x] = Math.min(255, Math.round((gray[y * width + x] / bgVal) * 255));
      }
    }
    return normalized;
  };

  // ─── MAIN DETECTION PIPELINE (Enhanced) ───
  const detectBubbles = async (
    imageData: ImageData,
    numQuestions: number,
    choicesPerQuestion: number,
    source: 'camera' | 'upload'
  ): Promise<{ studentId: string; answers: string[]; multipleAnswers: number[]; idDoubleShades: number[] }> => {
    const { data, width, height } = imageData;
    const isCamera = source === 'camera';

    console.log(`[OMR] Detection mode: ${source.toUpperCase()}, size: ${width}x${height}`);

    // 1. Convert to grayscale
    const rawGrayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      rawGrayscale[i / 4] = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
    }

    // 2. Background subtraction for lighting normalization
    // This equalises uneven lighting from camera flash, shadows, etc.
    const grayscale = subtractBackground(rawGrayscale, width, height);
    console.log('[OMR] Background subtraction applied');

    // 3. Compute integral image for fast adaptive thresholding
    const integral = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      for (let x = 0; x < width; x++) {
        rowSum += grayscale[y * width + x];
        integral[y * width + x] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
      }
    }

    // 4. Adaptive threshold — tuned per source, benefits from normalized input
    const globalThreshold = calculateOtsuThreshold(grayscale);
    const binary = new Uint8Array(width * height);

    if (isCamera) {
      // Camera: larger block, dynamic offset based on mean brightness
      const halfBlock = Math.max(15, Math.floor(Math.min(width, height) / 18));
      const totalPixels = width * height;
      let totalBrightness = 0;
      for (let i = 0; i < totalPixels; i++) totalBrightness += grayscale[i];
      const meanBrightness = totalBrightness / totalPixels;
      // After background subtraction, the image is more uniform, so smaller offset suffices
      const adaptiveOffset = Math.max(4, Math.floor(meanBrightness * 0.05));

      console.log(`[OMR] Camera: mean=${meanBrightness.toFixed(1)}, otsu=${globalThreshold}, offset=${adaptiveOffset}, block=${halfBlock}`);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const x1 = Math.max(0, x - halfBlock);
          const y1 = Math.max(0, y - halfBlock);
          const x2 = Math.min(width - 1, x + halfBlock);
          const y2 = Math.min(height - 1, y + halfBlock);
          let sum = integral[y2 * width + x2];
          if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
          if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
          if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];
          const area = (x2 - x1 + 1) * (y2 - y1 + 1);
          const localMean = sum / area;
          const threshold = localMean - adaptiveOffset;
          binary[y * width + x] = grayscale[y * width + x] < threshold ? 1 : 0;
        }
      }
    } else {
      // Upload: tighter block, combine global+local threshold
      const halfBlock = Math.max(8, Math.floor(Math.min(width, height) / 35));

      console.log(`[OMR] Upload: otsu=${globalThreshold}, block=${halfBlock}`);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const x1 = Math.max(0, x - halfBlock);
          const y1 = Math.max(0, y - halfBlock);
          const x2 = Math.min(width - 1, x + halfBlock);
          const y2 = Math.min(height - 1, y + halfBlock);
          let sum = integral[y2 * width + x2];
          if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
          if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
          if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];
          const area = (x2 - x1 + 1) * (y2 - y1 + 1);
          const localMean = sum / area;
          const threshold = Math.min(globalThreshold, localMean - 8);
          binary[y * width + x] = grayscale[y * width + x] < threshold ? 1 : 0;
        }
      }
    }

    // 5. Find corner alignment markers
    const markers = findCornerMarkers(binary, width, height, isCamera);
    console.log('[OMR] Corner markers found:', markers.found,
      'TL:', Math.round(markers.topLeft.x), Math.round(markers.topLeft.y),
      'BR:', Math.round(markers.bottomRight.x), Math.round(markers.bottomRight.y));

    // 5b. If markers not found on first pass, retry with raw (un-normalized) grayscale
    //     Some scans have markers that blend after background subtraction
    let effectiveMarkers;
    if (!markers.found) {
      console.log('[OMR] Retrying marker detection on raw grayscale...');
      const rawBinary = new Uint8Array(width * height);
      const rawThreshold = calculateOtsuThreshold(rawGrayscale);
      for (let i = 0; i < rawGrayscale.length; i++) {
        rawBinary[i] = rawGrayscale[i] < rawThreshold ? 1 : 0;
      }
      const rawMarkers = findCornerMarkers(rawBinary, width, height, isCamera);
      console.log('[OMR] Raw retry markers found:', rawMarkers.found);
      effectiveMarkers = rawMarkers.found
        ? rawMarkers
        : {
            topLeft: { x: width * 0.02, y: height * 0.02 },
            topRight: { x: width * 0.98, y: height * 0.02 },
            bottomLeft: { x: width * 0.02, y: height * 0.98 },
            bottomRight: { x: width * 0.98, y: height * 0.98 },
          };
    } else {
      effectiveMarkers = markers;
    }

    // 6. Get template layout for this exam's question count
    const layout = getTemplateLayout(numQuestions);

    // 7. Detect student ID and answers
    // Both camera and upload now benefit from background-subtracted grayscale
    const { studentId, doubleShadeColumns } = detectStudentIdFromImage(
      grayscale, binary, width, height, effectiveMarkers, layout, isCamera
    );
    const { answers, multipleAnswers } = detectAnswersFromImage(
      grayscale, binary, width, height, effectiveMarkers, layout, numQuestions, choicesPerQuestion, isCamera
    );

    return { studentId, answers, multipleAnswers, idDoubleShades: doubleShadeColumns };
  };

  // ─── OTSU'S THRESHOLD ───
  const calculateOtsuThreshold = (grayscale: Uint8Array): number => {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < grayscale.length; i++) histogram[grayscale[i]]++;
    const total = grayscale.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; threshold = t; }
    }
    return threshold;
  };

  // ─── BUBBLE SAMPLING ───
  
  // Binary-based sampling with Gaussian weighting (center-weighted for accuracy)
  const sampleBubbleBinary = (
    binary: Uint8Array,
    imgW: number,
    imgH: number,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number
  ): number => {
    let weightedFilled = 0, totalWeight = 0;
    const rx = radiusX * 0.75;
    const ry = radiusY * 0.75;
    const step = Math.max(1, Math.floor(Math.min(rx, ry) / 6));
    // Gaussian sigma = half the radius for center-weighted sampling
    const sigmaX = rx * 0.6;
    const sigmaY = ry * 0.6;

    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy += step) {
      for (let dx = -Math.floor(rx); dx <= Math.floor(rx); dx += step) {
        if (rx > 0 && ry > 0 && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          // Gaussian weight: more weight to center pixels
          const weight = Math.exp(-0.5 * ((dx * dx) / (sigmaX * sigmaX) + (dy * dy) / (sigmaY * sigmaY)));
          weightedFilled += binary[py * imgW + px] * weight;
          totalWeight += weight;
        }
      }
    }
    return totalWeight > 0 ? weightedFilled / totalWeight : 0;
  };

  // Grayscale-relative sampling (handles uneven lighting)
  // Returns a "darkness" score: 0 = white/empty, 1 = fully dark/filled.
  // Enhanced with Gaussian weighting and robust local contrast.
  const sampleBubbleGrayscale = (
    grayscale: Uint8Array,
    imgW: number,
    imgH: number,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number
  ): number => {
    const rx = radiusX * 0.70;
    const ry = radiusY * 0.70;
    const step = Math.max(1, Math.floor(Math.min(rx, ry) / 6));
    const sigmaX = rx * 0.6;
    const sigmaY = ry * 0.6;

    // Gaussian-weighted mean of inner bubble
    let weightedSum = 0, totalWeight = 0;
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy += step) {
      for (let dx = -Math.floor(rx); dx <= Math.floor(rx); dx += step) {
        if (rx > 0 && ry > 0 && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          const w = Math.exp(-0.5 * ((dx * dx) / (sigmaX * sigmaX) + (dy * dy) / (sigmaY * sigmaY)));
          weightedSum += grayscale[py * imgW + px] * w;
          totalWeight += w;
        }
      }
    }

    if (totalWeight === 0) return 0;
    const mean = weightedSum / totalWeight;

    // Sample surrounding ring for local background reference
    let surroundSum = 0, surroundCount = 0;
    const outerRX = radiusX * 1.6;
    const outerRY = radiusY * 1.6;
    const outerStep = Math.max(1, Math.floor(Math.min(outerRX, outerRY) / 4));

    for (let dy = -Math.floor(outerRY); dy <= Math.floor(outerRY); dy += outerStep) {
      for (let dx = -Math.floor(outerRX); dx <= Math.floor(outerRX); dx += outerStep) {
        const normDist = (dx * dx) / (outerRX * outerRX) + (dy * dy) / (outerRY * outerRY);
        const innerNormDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (normDist > 1 || innerNormDist <= 1) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          surroundSum += grayscale[py * imgW + px];
          surroundCount++;
        }
      }
    }

    // Robust local background: use surrounding ring, with a floor for very dark images
    const localBg = surroundCount > 0
      ? Math.max(surroundSum / surroundCount, 50)
      : 220;

    // Darkness score: how much darker is this bubble compared to its surroundings
    const darkness = Math.max(0, (localBg - mean) / localBg);
    return darkness;
  };

  // ─── DETECT STUDENT ID (Enhanced with statistical adaptive thresholds) ───
  const detectStudentIdFromImage = (
    grayscale: Uint8Array,
    binary: Uint8Array,
    width: number,
    height: number,
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    layout: TemplateLayout,
    isCamera: boolean
  ): { studentId: string; doubleShadeColumns: number[] } => {
    const { id } = layout;
    const idDigits: number[] = [];
    const doubleShadeColumns: number[] = [];

    const frameW = markers.topRight.x - markers.topLeft.x;
    const frameH = markers.bottomLeft.y - markers.topLeft.y;
    const bubbleRX = (layout.bubbleDiameterNX * frameW) / 2;
    const bubbleRY = (layout.bubbleDiameterNY * frameH) / 2;

    // Use smaller radius for ID bubbles (3.5mm vs 3.8mm for answers)
    const idBubbleRX = bubbleRX * (3.5 / 3.8);
    const idBubbleRY = bubbleRY * (3.5 / 3.8);

    console.log(`[ID] BubbleR: ${idBubbleRX.toFixed(1)}x${idBubbleRY.toFixed(1)}, mode=${isCamera ? 'camera' : 'upload'}`);

    // Pass 1: Collect ALL fill values across all ID columns to compute statistics
    const allIdFills: number[][] = [];
    const allFillValues: number[] = [];
    for (let col = 0; col < 9; col++) {
      const colFills: number[] = [];
      for (let row = 0; row < 10; row++) {
        const nx = id.firstColNX + col * id.colSpacingNX;
        const ny = id.firstRowNY + row * id.rowSpacingNY;
        const { px, py } = mapToPixel(markers, nx, ny);
        const fill = isCamera
          ? sampleBubbleGrayscale(grayscale, width, height, px, py, idBubbleRX, idBubbleRY)
          : sampleBubbleBinary(binary, width, height, px, py, idBubbleRX, idBubbleRY);
        colFills.push(fill);
        allFillValues.push(fill);
      }
      allIdFills.push(colFills);
    }

    // Compute statistics for adaptive threshold
    allFillValues.sort((a, b) => a - b);
    const median = allFillValues[Math.floor(allFillValues.length * 0.5)];
    const q75 = allFillValues[Math.floor(allFillValues.length * 0.75)];
    const q90 = allFillValues[Math.floor(allFillValues.length * 0.90)];

    // Adaptive threshold: filled bubbles are statistical outliers
    // Threshold = midpoint between typical (unfilled) and strong fills
    const baseThreshold = isCamera ? 0.08 : 0.18;
    const ID_FILL_THRESHOLD = Math.max(baseThreshold, median + (q90 - median) * 0.35);
    const ID_DOUBLE_SHADE_RATIO = 0.50;

    console.log(`[ID] Stats: median=${median.toFixed(3)}, q75=${q75.toFixed(3)}, q90=${q90.toFixed(3)}, adaptiveThreshold=${ID_FILL_THRESHOLD.toFixed(3)}`);

    // Pass 2: Detect digits using adaptive threshold
    for (let col = 0; col < 9; col++) {
      const fills = allIdFills[col];
      let maxFill = 0;
      let detectedDigit = 0;
      let hasDetection = false;

      for (let row = 0; row < 10; row++) {
        if (fills[row] > maxFill && fills[row] > ID_FILL_THRESHOLD) {
          maxFill = fills[row];
          detectedDigit = row;
          hasDetection = true;
        }
      }

      // Check for double-shade
      if (maxFill > ID_FILL_THRESHOLD) {
        const filledCount = fills.filter(
          f => f > ID_FILL_THRESHOLD && f >= maxFill * ID_DOUBLE_SHADE_RATIO
        ).length;
        if (filledCount > 1) {
          doubleShadeColumns.push(col + 1);
          console.log(`[ID] ⚠️ Col ${col} has DOUBLE SHADE (${filledCount} bubbles filled)`);
        }
      }

      console.log(`[ID] Col ${col}: fills=[${fills.map(f => f.toFixed(3)).join(',')}] → ${hasDetection ? detectedDigit : '?'} (max=${maxFill.toFixed(3)})`);
      idDigits.push(hasDetection ? detectedDigit : 0);
    }

    const raw = idDigits.join('');
    console.log('[ID] Raw digits:', raw, doubleShadeColumns.length > 0 ? `(double-shade in columns: ${doubleShadeColumns.join(',')})` : '');
    return { studentId: raw, doubleShadeColumns };
  };

  // ─── DETECT ANSWERS (Enhanced with statistical adaptive thresholds) ───
  const detectAnswersFromImage = (
    grayscale: Uint8Array,
    binary: Uint8Array,
    width: number,
    height: number,
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    layout: TemplateLayout,
    numQuestions: number,
    choicesPerQuestion: number,
    isCamera: boolean
  ): { answers: string[]; multipleAnswers: number[] } => {
    const answers = new Array<string>(numQuestions).fill('');
    const multipleAnswers: number[] = [];
    const choiceLabels = 'ABCDEFGH'.slice(0, choicesPerQuestion).split('');

    const frameW = markers.topRight.x - markers.topLeft.x;
    const frameH = markers.bottomLeft.y - markers.topLeft.y;
    const bubbleRX = (layout.bubbleDiameterNX * frameW) / 2;
    const bubbleRY = (layout.bubbleDiameterNY * frameH) / 2;

    // Pass 1: Collect all fill values to compute statistics
    const allQuestionFills: { q: number; fills: { choice: string; fill: number }[] }[] = [];
    const allFillValues: number[] = [];

    for (const block of layout.answerBlocks) {
      for (let q = block.startQ; q <= block.endQ && q <= numQuestions; q++) {
        const rowInBlock = q - block.startQ;
        const fills: { choice: string; fill: number }[] = [];

        for (let c = 0; c < choicesPerQuestion; c++) {
          const nx = block.firstBubbleNX + c * block.bubbleSpacingNX;
          const ny = block.firstBubbleNY + rowInBlock * block.rowSpacingNY;
          const { px, py } = mapToPixel(markers, nx, ny);

          const fill = isCamera
            ? sampleBubbleGrayscale(grayscale, width, height, px, py, bubbleRX, bubbleRY)
            : sampleBubbleBinary(binary, width, height, px, py, bubbleRX, bubbleRY);
          fills.push({ choice: choiceLabels[c], fill });
          allFillValues.push(fill);
        }
        allQuestionFills.push({ q, fills });
      }
    }

    // Compute adaptive threshold from statistics
    allFillValues.sort((a, b) => a - b);
    const median = allFillValues[Math.floor(allFillValues.length * 0.5)];
    const q75 = allFillValues[Math.floor(allFillValues.length * 0.75)];
    const q90 = allFillValues[Math.floor(allFillValues.length * 0.90)];

    // The threshold separates unfilled (noise) from filled bubbles
    const baseThreshold = isCamera ? 0.06 : 0.15;
    const FILL_THRESHOLD = Math.max(baseThreshold, median + (q90 - median) * 0.30);
    const MULTI_ANSWER_RATIO = 0.40;

    console.log(`[ANS] Stats: median=${median.toFixed(3)}, q75=${q75.toFixed(3)}, q90=${q90.toFixed(3)}, adaptiveThreshold=${FILL_THRESHOLD.toFixed(3)}`);

    // Pass 2: Detect answers using adaptive threshold
    for (const { q, fills } of allQuestionFills) {
      const qIndex = q - 1;

      let maxFill = 0;
      let selectedChoice = '';

      for (const { choice, fill } of fills) {
        if (fill > maxFill && fill > FILL_THRESHOLD) {
          maxFill = fill;
          selectedChoice = choice;
        }
      }

      // Noise rejection: verify the winner is significantly above the row average
      if (maxFill > FILL_THRESHOLD && fills.length > 1) {
        const otherFills = fills.filter(f => f.choice !== selectedChoice).map(f => f.fill);
        const avgOther = otherFills.reduce((a, b) => a + b, 0) / otherFills.length;
        const contrast = maxFill / Math.max(0.001, avgOther);

        // For camera: require at least 1.8x contrast; for upload: 1.5x
        const minContrast = isCamera ? 1.8 : 1.5;
        if (contrast < minContrast && maxFill < FILL_THRESHOLD * 1.5) {
          console.log(`[ANS] Q${q}: rejected weak detection ${selectedChoice}=${maxFill.toFixed(3)} (contrast=${contrast.toFixed(2)}, avgOther=${avgOther.toFixed(3)})`);
          selectedChoice = '';
          maxFill = 0;
        }
      }

      // Check if multiple bubbles are filled for this question
      if (maxFill > FILL_THRESHOLD) {
        const filledBubbles = fills.filter(
          f => f.fill > FILL_THRESHOLD && f.fill >= maxFill * MULTI_ANSWER_RATIO
        );
        if (filledBubbles.length > 1) {
          multipleAnswers.push(q);
          console.log(`[MULTI] Q${q}: ${filledBubbles.map(f => `${f.choice}=${f.fill.toFixed(3)}`).join(', ')} | all: ${fills.map(f => `${f.choice}=${f.fill.toFixed(3)}`).join(', ')}`);
        }
      }

      answers[qIndex] = selectedChoice;
    }
    return { answers, multipleAnswers };
  };

  // Calculate letter grade
  const calculateLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  // Get grade color
  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'text-green-600 bg-green-100';
    if (grade.startsWith('B')) return 'text-lime-600 bg-lime-100';
    if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-100';
    if (grade.startsWith('D')) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Save scan result
  const saveScanResult = async () => {
    if (!scanResult || !user || !exam) return;

    // Block saving if student ID has errors
    if (studentIdError) {
      toast.error('Cannot save: Student ID is not registered in this class. Please correct the Student ID first.');
      return;
    }
    if (idDoubleShadeColumns.length > 0) {
      toast.error('Cannot save: Student ID has columns with multiple bubbles shaded. Please correct the Student ID first.');
      return;
    }

    // Block saving if no class is linked or student is not in the class
    if (!classData) {
      toast.error('Cannot save: No class is linked to this exam. Please assign a class to the exam first.');
      setStudentIdError('No class is linked to this exam. Please go to exam settings and assign a class before scanning.');
      return;
    }

    const student = classData.students.find(s => s.student_id === detectedStudentId);
    if (!student) {
      toast.error(`Cannot save: Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.section_block}".`);
      setStudentIdError(`Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class.`);
      return;
    }
    
    setSaving(true);
    try {
      const isNullId = !detectedStudentId || detectedStudentId === '0000000000';
      
      const result = await ScanningService.saveScannedResult(
        examId,
        detectedStudentId || `NULL_${Date.now()}`,
        detectedAnswers as AnswerChoice[],
        answerKey,
        user.id,
        isNullId,
        exam.choicePoints
      );
      
      if (result.success) {
        toast.success('Scan saved successfully!');
        setRecentScans(prev => [scanResult, ...prev.slice(0, 9)]);
        
        // Reset for next scan
        setScanResult(null);
        setDetectedAnswers([]);
        setDetectedStudentId('');
        setMatchedStudent(null);
        setStudentIdError(null);
        setMultipleAnswerQuestions([]);
        setIdDoubleShadeColumns([]);
        setCapturedImage(null);
        setImageSource(null);
        setMode('select');
      } else {
        toast.error(result.error || 'Failed to save scan');
      }
    } catch (error) {
      console.error('Error saving scan:', error);
      toast.error('Failed to save scan result');
    } finally {
      setSaving(false);
    }
  };

  // Edit detected answer
  const editAnswer = (index: number, newValue: string) => {
    const upper = newValue.toUpperCase();
    if (upper.length <= 1 && /^[A-Z]?$/.test(upper)) {
      const choiceLimit = String.fromCharCode(64 + (exam?.choices_per_item || 4));
      if (!upper || upper <= choiceLimit) {
        const newAnswers = [...detectedAnswers];
        newAnswers[index] = upper;
        setDetectedAnswers(newAnswers);
        
        // Recalculate score
        let score = 0;
        const totalQuestions = Math.min(newAnswers.length, answerKey.length);
        for (let i = 0; i < totalQuestions; i++) {
          if (newAnswers[i] && answerKey[i] && newAnswers[i].toUpperCase() === answerKey[i].toUpperCase()) {
            score++;
          }
        }
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        
        setScanResult(prev => prev ? {
          ...prev,
          answers: newAnswers,
          score,
          percentage,
          letterGrade: calculateLetterGrade(percentage)
        } : null);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a472a] mx-auto" />
          <p className="text-gray-600">Loading scanner...</p>
        </div>
      </div>
    );
  }

  // No exam found
  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="inline-flex items-center gap-2 text-gray-600 hover:text-[#1a472a]">
          <ArrowLeft className="w-5 h-5" />
          Back to Exams
        </Link>
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Exam Not Found</h2>
          <p className="text-gray-600 mt-2">The exam you're looking for doesn't exist.</p>
        </Card>
      </div>
    );
  }

  // No answer key
  if (answerKey.length === 0) {
    return (
      <div className="space-y-6">
        <Link href={`/exams/${examId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-[#1a472a]">
          <ArrowLeft className="w-5 h-5" />
          Back to Exam
        </Link>
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Answer Key Required</h2>
          <p className="text-gray-600 mt-2">Please set up the answer key before scanning papers.</p>
          <Link href={`/exams/${examId}/edit-key`}>
            <Button className="mt-4 bg-[#1a472a] hover:bg-[#2d6b47]">
              Set Up Answer Key
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/exams/${examId}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a472a]">Scan Answer Sheets</h1>
            <p className="text-gray-600">{exam.title} • {exam.num_items} questions</p>
          </div>
        </div>
        {recentScans.length > 0 && (
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-600" />
            {recentScans.length} scanned this session
          </div>
        )}
      </div>

      {/* Mode: Select */}
      {mode === 'select' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="p-8 border-2 border-dashed hover:border-[#1a472a] cursor-pointer transition-all hover:shadow-lg"
            onClick={startCamera}
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Use Camera</h3>
              <p className="text-gray-600 mt-2">
                Capture answer sheet using your device camera
              </p>
            </div>
          </Card>

          <Card 
            className="p-8 border-2 border-dashed hover:border-[#1a472a] cursor-pointer transition-all hover:shadow-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Upload Image</h3>
              <p className="text-gray-600 mt-2">
                Select an image file from your device
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </Card>
        </div>
      )}

      {/* Mode: Camera */}
      {mode === 'camera' && (
        <Card className="overflow-hidden">
          <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Real-time marker detection overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            />
            {/* Status indicator */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 20 }}>
              <div className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
                markersDetected 
                  ? 'bg-green-600/90 text-white' 
                  : 'bg-red-600/80 text-white'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${markersDetected ? 'bg-green-300 animate-pulse' : 'bg-red-300'}`} />
                {markersDetected ? 'Ready to capture' : 'Align sheet — find all 4 corners'}
              </div>
            </div>
            {/* Bottom instruction */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 20 }}>
              <div className="text-white text-xs bg-black/60 px-3 py-1.5 rounded-full text-center max-w-[85%]">
                {markersDetected 
                  ? '✓ All corners detected — tap Capture now'
                  : 'Align the 4 black squares within view. Keep flat & well-lit.'}
              </div>
            </div>
          </div>
          <div className="p-4 flex justify-center gap-4">
            <Button variant="outline" onClick={stopCamera}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={capturePhoto} 
              disabled={!markersDetected}
              className={`${markersDetected 
                ? 'bg-[#1a472a] hover:bg-[#2d6b47]' 
                : 'bg-gray-400 cursor-not-allowed'}`}
            >
              <Camera className="w-4 h-4 mr-2" />
              {markersDetected ? 'Capture' : 'Aligning...'}
            </Button>
          </div>
        </Card>
      )}

      {/* Mode: Review */}
      {mode === 'review' && capturedImage && (
        <Card className="overflow-hidden">
          <div className="relative bg-gray-100">
            <img 
              src={capturedImage} 
              alt="Captured answer sheet"
              className="w-full max-h-[60vh] object-contain mx-auto"
            />
          </div>
          <div className="p-4 flex justify-center gap-4">
            <Button variant="outline" onClick={() => {
              setCapturedImage(null);
              setImageSource(null);
              setMode('select');
            }}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button onClick={processImage} className="bg-[#1a472a] hover:bg-[#2d6b47]">
              <Scan className="w-4 h-4 mr-2" />
              Process & Grade
            </Button>
          </div>
        </Card>
      )}

      {/* Mode: Processing */}
      {mode === 'processing' && (
        <Card className="p-12 text-center">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Processing Answer Sheet</h3>
              <p className="text-gray-600 mt-2">
                Detecting bubbles and reading answers...
              </p>
            </div>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1a472a] rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Mode: Results */}
      {mode === 'results' && scanResult && (
        <div className="space-y-6">
          {/* Student ID Double Shade Error */}
          {idDoubleShadeColumns.length > 0 && (
            <Card className="p-4 border-orange-300 bg-orange-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-orange-800">Multiple Bubbles Shaded in Student ID</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Column(s) <strong>{idDoubleShadeColumns.join(', ')}</strong> of the Student ID have more than one bubble shaded. Each column must have only <strong>one digit</strong> selected.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    Please ask the student to properly shade only one bubble per column, or manually correct the Student ID below.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Student ID Not Found Error */}
          {studentIdError && idDoubleShadeColumns.length === 0 && (
            <Card className="p-4 border-red-300 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-800">Student ID Not Found</h4>
                  <p className="text-sm text-red-700 mt-1">{studentIdError}</p>
                  <p className="text-xs text-red-600 mt-2">
                    You must correct the Student ID before saving. Edit the ID field below or discard and re-scan.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Multiple Answers Warning */}
          {multipleAnswerQuestions.length > 0 && (
            <Card className="p-4 border-yellow-300 bg-yellow-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Multiple Answers Detected</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    The following question(s) have more than one bubble shaded: <strong>
                    {multipleAnswerQuestions.map(q => `#${q}`).join(', ')}
                    </strong>
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    Only one answer per question is allowed. The system selected the darkest bubble, but please verify and correct if needed. Remind the student to shade only one bubble per question.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Score Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  (studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-red-100' : matchedStudent ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <User className={`w-8 h-8 ${
                    (studentIdError || idDoubleShadeColumns.length > 0) ? 'text-red-600' : matchedStudent ? 'text-green-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={detectedStudentId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setDetectedStudentId(newId);
                        // Clear double-shade error when user manually edits
                        setIdDoubleShadeColumns([]);
                        // Re-validate student ID on change
                        if (!newId || /^0+$/.test(newId)) {
                          setStudentIdError('No Student ID provided. Please enter a valid Student ID.');
                          setMatchedStudent(null);
                        } else if (!classData) {
                          setStudentIdError('No class is linked to this exam. Please go to exam settings and assign a class before scanning.');
                          setMatchedStudent(null);
                        } else {
                          const student = classData.students.find(s => s.student_id === newId);
                          if (student) {
                            setMatchedStudent(student);
                            setStudentIdError(null);
                          } else {
                            setMatchedStudent(null);
                            setStudentIdError(`Student ID "${newId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`);
                          }
                        }
                      }}
                      className={`text-xl font-bold bg-transparent border-b transition-colors focus:outline-none ${
                        (studentIdError || idDoubleShadeColumns.length > 0)
                          ? 'text-red-700 border-red-300 hover:border-red-400 focus:border-red-500'
                          : 'text-gray-900 border-transparent hover:border-gray-300 focus:border-[#1a472a]'
                      }`}
                      placeholder="Enter Student ID"
                    />
                    {matchedStudent && (
                      <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                        {matchedStudent.first_name} {matchedStudent.last_name}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">Student ID</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-block px-4 py-2 rounded-lg text-2xl font-bold ${getGradeColor(scanResult.letterGrade)}`}>
                  {scanResult.letterGrade}
                </div>
                <p className="text-gray-600 mt-1">
                  {scanResult.score}/{scanResult.totalQuestions} ({scanResult.percentage}%)
                </p>
              </div>
            </div>
          </Card>

          {/* Answer Comparison */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Answer Comparison</h3>
            
            {(() => {
              const halfPoint = Math.ceil(detectedAnswers.length / 2);
              const firstRow = detectedAnswers.slice(0, halfPoint);
              const secondRow = detectedAnswers.slice(halfPoint);
              
              return (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Questions 1-{halfPoint}</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {firstRow.map((answer, i) => {
                        const isCorrect = answerKey[i] && answer.toUpperCase() === answerKey[i].toUpperCase();
                        const hasMultiple = multipleAnswerQuestions.includes(i + 1);
                        return (
                          <div key={i} className="text-center">
                            <span className={`text-xs block mb-1 ${hasMultiple ? 'text-yellow-600 font-bold' : 'text-gray-500'}`}>{i + 1}</span>
                            <div className="relative">
                              <input
                                type="text"
                                value={answer}
                                onChange={(e) => editAnswer(i, e.target.value)}
                                maxLength={1}
                                className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                  hasMultiple
                                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700 ring-2 ring-yellow-300'
                                    : isCorrect 
                                      ? 'border-green-500 bg-green-50 text-green-700' 
                                      : answer 
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-300 bg-gray-50 text-gray-500'
                                }`}
                              />
                              {hasMultiple && (
                                <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-yellow-600" />
                              )}
                              {answerKey[i] && !isCorrect && (
                                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-green-600 font-medium">
                                  {answerKey[i]}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {secondRow.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-gray-500 mb-2">Questions {halfPoint + 1}-{detectedAnswers.length}</p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                        {secondRow.map((answer, i) => {
                          const actualIndex = halfPoint + i;
                          const isCorrect = answerKey[actualIndex] && answer.toUpperCase() === answerKey[actualIndex].toUpperCase();
                          const hasMultiple = multipleAnswerQuestions.includes(actualIndex + 1);
                          return (
                            <div key={actualIndex} className="text-center">
                              <span className={`text-xs block mb-1 ${hasMultiple ? 'text-yellow-600 font-bold' : 'text-gray-500'}`}>{actualIndex + 1}</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={answer}
                                  onChange={(e) => editAnswer(actualIndex, e.target.value)}
                                  maxLength={1}
                                  className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                    hasMultiple
                                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700 ring-2 ring-yellow-300'
                                      : isCorrect 
                                        ? 'border-green-500 bg-green-50 text-green-700' 
                                        : answer 
                                          ? 'border-red-500 bg-red-50 text-red-700'
                                          : 'border-gray-300 bg-gray-50 text-gray-500'
                                  }`}
                                />
                                {hasMultiple && (
                                  <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-yellow-600" />
                                )}
                                {answerKey[actualIndex] && !isCorrect && (
                                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-green-600 font-medium">
                                    {answerKey[actualIndex]}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center gap-4 mt-6 pt-4 border-t text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded" />
                <span className="text-gray-600">Correct</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded" />
                <span className="text-gray-600">Incorrect (correct answer shown below)</span>
              </div>
              {multipleAnswerQuestions.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-500 rounded relative">
                    <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-yellow-600" />
                  </div>
                  <span className="text-yellow-700">Multiple answers detected</span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => {
              setScanResult(null);
              setDetectedAnswers([]);
              setDetectedStudentId('');
              setMatchedStudent(null);
              setStudentIdError(null);
              setMultipleAnswerQuestions([]);
              setIdDoubleShadeColumns([]);
              setCapturedImage(null);
              setImageSource(null);
              setMode('select');
            }}>
              <X className="w-4 h-4 mr-2" />
              Discard & Scan Again
            </Button>
            <Button 
              onClick={() => {
                if (idDoubleShadeColumns.length > 0) {
                  toast.error('Student ID has multiple bubbles shaded. Please correct the ID before saving.');
                  return;
                }
                if (studentIdError) {
                  toast.error('Please correct the Student ID before saving. The student must be registered in this class.');
                  return;
                }
                saveScanResult();
              }}
              disabled={saving || !!studentIdError || idDoubleShadeColumns.length > 0}
              className={`${(studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1a472a] hover:bg-[#2d6b47]'}`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Result
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && mode === 'select' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Scans This Session</h3>
          <div className="space-y-2">
            {recentScans.map((scan, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{scan.studentId}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600">{scan.score}/{scan.totalQuestions}</span>
                  <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor(scan.letterGrade)}`}>
                    {scan.letterGrade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hidden canvases for processing */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={processingCanvasRef} className="hidden" />
    </div>
  );
}