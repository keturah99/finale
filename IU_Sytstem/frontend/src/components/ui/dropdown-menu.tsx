import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

interface MenuPosition {
  top: number
  left: number
  minWidth: number
}

export function DropdownMenu({
  trigger,
  children,
  align = 'right',
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click — but check both the trigger and the portal
  useClickOutside(
    menuRef,
    () => setOpen(false),
    open,
  )

  // Compute position from the trigger's bounding rect when opening
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = 180
    const left =
      align === 'right'
        ? rect.right - width + window.scrollX
        : rect.left + window.scrollX
    const top = rect.bottom + window.scrollY + 4
    setPosition({ top, left, minWidth: width })
  }, [open, align])

  // Close on scroll/resize to avoid stale positioning
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex"
      >
        {trigger}
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              minWidth: position.minWidth,
            }}
            className={cn(
              'z-50 rounded-md border border-slate-200 bg-white py-1 shadow-lg',
              className,
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}

export function DropdownItem({
  children,
  onClick,
  className,
  destructive,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full px-3 py-1.5 text-left text-sm transition',
        destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function DropdownSeparator() {
  return <div className="my-1 border-t border-slate-100" />
}