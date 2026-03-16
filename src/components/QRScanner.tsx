import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  onScan: (serviceId: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied' | 'requesting'>('pending')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    
    // Check if permissions might already be granted
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setPermissionState('granted')
          startScanner(scanner)
        }
      })
      .catch(() => {
        setPermissionState('pending')
      })

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(console.error)
      }
    }
  }, [])

  const startScanner = async (existingScanner?: Html5Qrcode) => {
    const scanner = existingScanner || scannerRef.current
    if (!scanner) return
    
    setError(null)
    setPermissionState('requesting')
    
    try {
      await scanner.start(
        { facingMode: "environment" },
        { 
          fps: 15, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        },
        (decodedText) => {
          try {
            const url = new URL(decodedText)
            const serviceId = url.searchParams.get('service_id')
            if (serviceId) {
              scanner.stop().then(() => onScan(serviceId))
            }
          } catch (e) {
            console.error('Invalid QR URL', decodedText)
            setError('Not a valid Rollcally service QR code')
          }
        },
        () => {} // Silent frame errors
      )
      setPermissionState('granted')
    } catch (err: any) {
      console.error(err)
      setPermissionState('denied')
      setError('Camera access failed. Please enable permissions in your browser settings.')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-500 font-display">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-background-dark border border-primary/20 shadow-[0_0_100px_rgba(82,71,230,0.15)] animate-in zoom-in-95 duration-500">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-primary/10 rounded-full blur-[80px]"></div>
        
        {/* Header */}
        <div className="relative flex items-center justify-between px-8 py-6 border-b border-primary/10 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-white text-2xl">qr_code_scanner</span>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase italic">Scan Venue Node</h3>
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Intel Capture Module</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group rounded-2xl bg-white/5 p-3 text-slate-400 hover:text-white hover:bg-red-500/20 transition-all border border-white/5"
          >
            <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">close</span>
          </button>
        </div>
        
        <div className="p-8">
          {/* Scanner Container */}
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-black border border-primary/20 shadow-2xl">
            <div id="qr-reader" className="h-full w-full [&_video]:object-cover" />
            
            {/* Permission Screens */}
            {permissionState !== 'granted' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background-dark p-8 text-center backdrop-blur-md transition-all duration-300 z-10">
                {permissionState === 'denied' ? (
                  <>
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/10 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                      <span className="material-symbols-outlined text-4xl text-red-500">no_photography</span>
                    </div>
                    <p className="mb-2 text-xl font-black text-white uppercase italic tracking-tighter">Access Denied</p>
                    <p className="mb-8 text-sm text-slate-400 leading-relaxed font-medium">
                      Camera permissions are required to scan venue nodes. Please update your system settings.
                    </p>
                    <button 
                      className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
                      onClick={() => startScanner()}
                    >
                      Retry Authorization
                    </button>
                  </>
                ) : permissionState === 'requesting' ? (
                  <>
                    <div className="mb-6 relative">
                      <div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse"></div>
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20">
                        <span className="material-symbols-outlined text-5xl animate-spin text-primary">sync</span>
                      </div>
                    </div>
                    <p className="text-xl font-black text-white uppercase italic tracking-tighter mb-2 italic">Syncing...</p>
                    <p className="text-sm text-slate-400 font-medium">Authorizing system camera access</p>
                  </>
                ) : (
                  <>
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20">
                      <span className="material-symbols-outlined text-4xl text-primary">photo_camera</span>
                    </div>
                    <p className="mb-2 text-xl font-black text-white uppercase italic tracking-tighter">Capture Ready</p>
                    <p className="mb-8 text-sm text-slate-400 font-medium leading-relaxed">
                      Initialize your physical scan module to continue check-in protocol.
                    </p>
                    <button 
                      className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
                      onClick={() => startScanner()}
                    >
                      Enable Scanner
                    </button>
                  </>
                )}
              </div>
            )}
            
            {/* Guide Overlay for scanning state */}
            {permissionState === 'granted' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <div className="h-48 w-48 rounded-[2rem] border-2 border-primary shadow-[0_0_40px_rgba(82,71,230,0.3)] ring-[1000px] ring-black/60" />
                <div className="absolute top-10 text-center px-4">
                  <p className="rounded-full bg-primary/20 border border-primary/40 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary backdrop-blur-xl shadow-2xl">
                    Position QR code within node frame
                  </p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none"></div>
              </div>
            )}
          </div>
          
          {error && permissionState === 'granted' && (
            <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-4 animate-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-red-500">error</span>
              <p className="text-xs font-bold text-red-500 uppercase tracking-wide">
                {error}
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-col items-center">
              <button
                onClick={onClose}
                className="w-full h-16 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] hover:text-white transition-colors"
              >
                Close Scanner
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}
