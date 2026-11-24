import { Toast } from '@base-ui/react/toast'
import { CircleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { messages } from './messageStore'

export function Messages({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={messages} limit={4}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-6 left-1/2 z-50 flex w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 flex-col items-center gap-2">
          <List />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function List() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      swipeDirection={[]}
      className="rounded-control bg-midnight text-sea-mist shadow-lifted transition-opacity duration-150 data-ending-style:opacity-0 data-limited:hidden data-starting-style:opacity-0"
    >
      <Toast.Content className="flex items-center gap-3 py-2 pr-2 pl-4">
        {toast.type === 'problem' && <CircleAlert size={18} aria-hidden className="text-coral" />}
        <Toast.Title className="line-clamp-2 max-w-110 py-1 font-medium text-white" />
        <Toast.Action className="cursor-pointer rounded-tag px-3 py-1.5 font-semibold text-sea-green hover:bg-white/10" />
        <Toast.Close aria-label="Close message" className="grid size-8 cursor-pointer place-items-center rounded-tag hover:bg-white/10">
          <X size={16} aria-hidden />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}
