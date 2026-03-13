import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'

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
            setError('Not a valid Rollcall service QR code')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <Camera className="h-4 w-4 text-blue-700" />
            </div>
            <h3 className="font-bold text-gray-900">Scan Service QR</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-50 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Scanner Container */}
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-900 shadow-inner ring-1 ring-gray-100">
            <div id="qr-reader" className="h-full w-full [&_video]:object-cover" />
            
            {/* Permission Screens */}
            {permissionState !== 'granted' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 p-8 text-center backdrop-blur-sm transition-all duration-300">
                {permissionState === 'denied' ? (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
                      <ShieldAlert className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="mb-2 font-bold text-white">Camera Access Denied</p>
                    <p className="mb-6 text-sm text-gray-400 leading-relaxed">
                      To scan QR codes, Rollcall needs permission to use your camera. 
                      Please enable it in your browser settings.
                    </p>
                    <Button 
                      variant="primary" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => startScanner()}
                    >
                      Try Again
                    </Button>
                  </>
                ) : permissionState === 'requesting' ? (
                  <>
                    <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
                    <p className="font-bold text-white">Requesting Permission...</p>
                    <p className="text-sm text-gray-400">Please tap "Allow" when the prompt appears</p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
                      <Camera className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="mb-2 font-bold text-white">Camera Access Required</p>
                    <p className="mb-6 text-sm text-gray-400">
                      Scanning QR codes is the fastest way to check into a service.
                    </p>
                    <Button 
                      variant="primary" 
                      className="w-full bg-blue-600 shadow-lg shadow-blue-500/20"
                      onClick={() => startScanner()}
                    >
                      Enable Camera
                    </Button>
                  </>
                )}
              </div>
            )}
            
            {/* Guide Overlay for scanning state */}
            {permissionState === 'granted' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-2xl border-2 border-white/50 ring-[1000px] ring-black/40" />
                <div className="absolute top-8 text-center">
                  <p className="rounded-full bg-black/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-2xl ring-1 ring-white/20">
                    Align QR code within the frame
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {error && permissionState === 'granted' && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-center text-xs font-medium text-amber-700 ring-1 ring-amber-100 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
              <ShieldAlert className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
             <Button
                variant="ghost"
                onClick={onClose}
                className="w-full h-12 text-gray-600 border-gray-100 hover:bg-gray-50"
              >
                Close Scanner
              </Button>
              <p className="text-center text-[10px] uppercase tracking-widest text-gray-300 font-bold">
                Advanced Enrollment Module
              </p>
          </div>
        </div>
      </div>
    </div>
  )
}
