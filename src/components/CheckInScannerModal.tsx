import React, { useState, useEffect, useRef } from 'react';
import { Student } from '../types/student';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { updateStudentCheckIn, getDaysDifference, formatDueDateDisplay } from '../services/storageService';
import { 
  X, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Camera, 
  Users, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  Check
} from 'lucide-react';

interface CheckInScannerModalProps {
  students: Student[];
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
  preSelectedStudent?: Student | null;
  onCheckInSuccess?: (student: Student) => void;
}

export const CheckInScannerModal: React.FC<CheckInScannerModalProps> = ({
  students,
  isOpen,
  onClose,
  theme,
  preSelectedStudent,
  onCheckInSuccess,
}) => {
  const { darkModeClass } = useTheme();
  const [activeScanMode, setActiveScanMode] = useState<'simulator' | 'camera'>('simulator');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(preSelectedStudent?.id || students[0]?.id || '');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedStudent, setLastScannedStudent] = useState<Student | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<{ student: Student; time: string }[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (preSelectedStudent) {
      setSelectedStudentId(preSelectedStudent.id);
      // Auto-trigger scan if requested from pass modal
      handleExecuteScan(preSelectedStudent);
    }
  }, [preSelectedStudent]);

  // Clean up camera stream on unmount or mode switch
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (activeScanMode === 'camera' && isOpen) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
          }
        })
        .catch((err) => {
          console.warn('Webcam permission not granted or unavailable in iframe', err);
          setCameraError('Camera not available in preview environment. Using desk simulator mode.');
          setActiveScanMode('simulator');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [activeScanMode, isOpen]);

  if (!isOpen) return null;

  const handleExecuteScan = (targetStudent: Student) => {
    setIsScanning(true);

    setTimeout(() => {
      try {
        const updated = updateStudentCheckIn(targetStudent.id);
        const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setLastScannedStudent(updated);
        setRecentCheckIns((prev) => [
          { student: updated, time: timeFormatted },
          ...prev.filter((item) => item.student.id !== updated.id)
        ]);

        setIsScanning(false);
        if (onCheckInSuccess) onCheckInSuccess(updated);
      } catch (err) {
        console.error(err);
        setIsScanning(false);
      }
    }, 450);
  };

  const currentTarget = students.find((s) => s.id === selectedStudentId);

  // Filter students for quick simulator picker
  const filteredStudents = students.filter((s) => 
    s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.seatNumber.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${theme.headerBg} text-white`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Front-Desk Check-in Scanner
              </h3>
              <p className="text-xs text-white/80">
                Lakshay Library &bull; QR Code Verification &amp; Attendance Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Scanner Viewfinder Area */}
          <div className="relative bg-slate-950 rounded-3xl p-6 text-white overflow-hidden border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[220px]">
            {/* Viewfinder Reticle Corners */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-400 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-400 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-400 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-400 rounded-br-lg" />

            {/* Scanning Laser Beam Animation */}
            {isScanning && (
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-pulse" />
            )}

            {activeScanMode === 'camera' ? (
              <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              </div>
            ) : (
              <div className="text-center z-10 space-y-2 py-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40 animate-pulse">
                  <Scan className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  Front-Desk Optical Reader Ready
                </h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Simulates Android CameraX &amp; ML Kit Barcode scanning to verify student desk passes and update Firestore <code className="text-amber-300 font-mono">lastCheckIn</code>.
                </p>
              </div>
            )}

            {/* Quick Trigger Bar below viewfinder */}
            {currentTarget && (
              <div className="mt-4 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-slate-400 block text-[10px]">Ready to scan:</span>
                  <span className="font-bold text-white">{currentTarget.name} (Seat {currentTarget.seatNumber})</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleExecuteScan(currentTarget)}
                  disabled={isScanning}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Reading QR...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-3.5 h-3.5" />
                      <span>Scan Pass Now</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              {cameraError}
            </p>
          )}

          {/* Verification Result Card if student scanned */}
          {lastScannedStudent && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 animate-in slide-in-from-top-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {lastScannedStudent.name} Checked In!
                      </h4>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-200 text-emerald-900">
                        Seat {lastScannedStudent.seatNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Shift: {lastScannedStudent.shiftTimings} &bull; Timestamp updated in Firestore
                    </p>
                  </div>
                </div>

                {/* Fee Status Badge */}
                {(() => {
                  const diff = getDaysDifference(lastScannedStudent.nextFeeDueDate);
                  if (diff < 0) {
                    return (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Fee Overdue
                      </span>
                    );
                  }
                  if (diff <= 3) {
                    return (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Fee Due in {diff}d
                      </span>
                    );
                  }
                  return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Fees Cleared
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Quick Select Student to Simulate Scanning */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Desk Simulation &bull; Pick Student Pass to Scan
              </h4>
              <span className="text-[11px] text-slate-400">
                {students.length} registered students
              </span>
            </div>

            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by student name or seat..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredStudents.map((s) => {
                const isSelected = s.id === selectedStudentId;
                const isJustScanned = lastScannedStudent?.id === s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      handleExecuteScan(s);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between ${
                      isJustScanned
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400'
                        : isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-950'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="font-bold truncate">{s.name}</div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span className="font-mono font-semibold">Seat {s.seatNumber}</span>
                      <span className="text-amber-600 font-semibold hover:underline">Scan</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Today's Check-in Log Table */}
          {recentCheckIns.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Today&apos;s Verified Desk Attendance ({recentCheckIns.length})</span>
              </h4>

              <div className="divide-y divide-slate-100 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden text-xs">
                {recentCheckIns.map(({ student, time }) => (
                  <div key={student.id + time} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-bold text-slate-900">{student.name}</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.2 bg-white border border-slate-200 rounded text-slate-600">
                        Seat {student.seatNumber}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 font-semibold">
                      {time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Updates student document in Firestore immediately</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 font-semibold text-white ${theme.primary} ${theme.primaryHover} rounded-xl shadow-xs`}
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
