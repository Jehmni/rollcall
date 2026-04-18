import { type ReactNode, useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      document.body.style.overflow = 'hidden'
    } else {
      const timer = setTimeout(() => setIsRendered(false), 300)
      document.body.style.overflow = 'unset'
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isRendered) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        className={`absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-sm overflow-hidden rounded-none bg-white shadow-2xl transition-all duration-300 transform ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'} border border-brand-border`}>
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
          <h3 className="text-lg font-bold text-brand-text">{title}</h3>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-none text-brand-slate hover:bg-brand-secondary hover:text-brand-text active:scale-95 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="px-6 py-4">
          {description && <p className="mb-4 text-sm text-gray-500">{description}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'info'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  isLoading = false
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-none ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-brand-primary/10 text-brand-primary'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="text-sm leading-relaxed text-brand-slate">
            {description}
          </p>
        </div>
        
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'primary' : 'primary'} 
            size="sm" 
            onClick={onConfirm} 
            loading={isLoading}
            className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700 ring-red-100' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}


