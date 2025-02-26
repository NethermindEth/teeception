import { Dialog } from './Dialog'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

interface ChallengeSuccessModalProps {
  open: boolean
  onClose: () => void
  verificationStatus: 'loading' | 'success' | 'failed' | 'tries_exceeded' | null
  transactionLanded: boolean
}

export const ChallengeSuccessModal = ({ 
  open, 
  onClose, 
  verificationStatus, 
  transactionLanded 
}: ChallengeSuccessModalProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-6 space-y-6">
        <div className="text-center">
          {!transactionLanded ? (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Submitting Challenge...</h2>
              <p className="text-white/90 mb-4">
                Your transaction is being processed. Please wait while we confirm your submission.
              </p>
            </>
          ) : verificationStatus === 'loading' ? (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Challenge Submitted!</h2>
              <p className="text-white/90 mb-4">
                Your challenge has been successfully submitted. The agent is processing your request.
              </p>
            </>
          ) : verificationStatus === 'success' ? (
            <>
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
              <h2 className="text-2xl font-bold mb-2">Challenge Successful!</h2>
              <p className="text-white/90 mb-4">
                Congratulations! You successfully drained the agent and claimed the reward.
              </p>
            </>
          ) : verificationStatus === 'failed' ? (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Challenge Failed</h2>
              <p className="text-white/90 mb-4">
                The agent is still up and running. Your challenge was unsuccessful, but you can try again with a different approach.
              </p>
            </>
          ) : verificationStatus === 'tries_exceeded' ? (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Verification Timeout</h2>
              <p className="text-white/90 mb-4">
                We couldn't verify the result of your challenge. The transaction was submitted, but verification attempts exceeded the limit. Check your tweet for a response and report this if needed.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
