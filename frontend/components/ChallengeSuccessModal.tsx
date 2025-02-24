import { Dialog } from './Dialog'
import Link from 'next/link'

interface ChallengeSuccessModalProps {
  open: boolean
  onClose: () => void
}

export const ChallengeSuccessModal = ({ open, onClose }: ChallengeSuccessModalProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Challenge Submitted!</h2>
          <p className="text-white/90 mb-4">
            Your challenge has been successfully submitted. The agent will respond to your tweet in
            few seconds.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/attack"
            className="flex items-center justify-center gap-2 w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90"
          >
            Challenge More Agents
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90"
          >
            Home
          </Link>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Close
          </button>
        </div>
      </div>
    </Dialog>
  )
}
