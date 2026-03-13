import { useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X } from 'lucide-react'

interface QRScannerProps {
  onScan: (serviceId: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    )

    scanner.render(
      (decodedText) => {
        // Expected URL: .../checkin?service_id=UUID
        try {
          const url = new URL(decodedText)
          const serviceId = url.searchParams.get('service_id')
          if (serviceId) {
            scanner.clear()
            onScan(serviceId)
          }
        } catch (e) {
          console.error('Invalid QR code URL', decodedText)
        }
      },
      () => {
        // Optimization: don't log every frame error
      }
    )

    return () => {
      scanner.clear().catch(err => console.error('Failed to clear scanner', err))
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="p-6">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-bold text-gray-900">Scan Service QR</h3>
            <p className="text-xs text-gray-500">Point your camera at the service QR code</p>
          </div>
          
          <div id="qr-reader" className="overflow-hidden rounded-2xl border-none bg-gray-50 aspect-square" />
          
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
