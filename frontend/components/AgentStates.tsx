interface AgentLoadingStatesProps {
  loading: boolean
  error: string | null
  isNotFound: boolean
}

const Skeleton = () => {
  return (
    <div className="max-w-[1560px] mx-auto py-5 md:py-10 px-2 animate-pulse">
      <div className="text-center">
        <div className="mb-6">
          <div className="flex items-center gap-3 w-fit mx-auto mb-4">
            <div className="w-7 h-7 rounded-full bg-[#27313666]" />
            <div className="h-8 w-40 bg-[#27313666] rounded" />
          </div>

          <div className="w-2/3 h-4 bg-[#27313666] mx-auto rounded" />
        </div>

        <div className="max-w-[972px] mx-auto mb-8">
          <div className="h-6 w-32 bg-[#27313666] mx-auto mb-2 rounded" />
          <div className="space-y-2">
            <div className="h-4 bg-[#27313666] rounded w-full" />
            <div className="h-4 bg-[#27313666] rounded w-5/6 mx-auto" />
            <div className="h-4 bg-[#27313666] rounded w-4/6 mx-auto" />
          </div>
        </div>

        <div className="bg-gradient-to-l from-[#35546266] via-[#2E404966] to-[#6e9aaf66] p-[1px] rounded-lg max-w-[624px] mx-auto">
          <div className="bg-black w-full h-full rounded-lg">
            <div className="bg-[#12121266] w-full h-full rounded-lg p-3 md:p-[18px] flex justify-between">
              {[1, 2, 3].map((index) => (
                <div key={index} className="flex-1 px-4">
                  <div className="h-3 w-20 bg-[#27313666] mb-2 rounded" />
                  <div className="h-6 w-16 bg-[#27313666] rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-6">
          <div className="flex gap-4 w-full max-w-[400px] mx-auto">
            <div className="h-8 bg-[#27313666] rounded flex-1" />
            <div className="h-8 bg-[#27313666] rounded flex-1" />
          </div>
          <div className="h-[3px] w-full bg-[#132531] mt-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-20">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="flex items-start gap-3 w-full mb-4 p-8 rounded-lg bg-[#27313666]"
            >
              <div className="w-full space-y-2">
                <div className="h-4 bg-[#35546266] rounded w-20" />
                <div className="h-4 bg-[#35546266] rounded w-full" />
                <div className="h-4 bg-[#35546266] rounded w-24 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const ErrorState = ({ error }: { error: string }) => {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="bg-red-500/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
        <p className="text-[#B4B4B4] mb-4">{error}</p>
        <p className="text-sm text-[#B4B4B4]">
          Need help? Join our{' '}
          <a
            href="https://t.me/nm_teeception"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Telegram support
          </a>
        </p>
      </div>
    </div>
  )
}

const NotFound = () => {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="bg-gray-500/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Agent Not Found</h3>
        <p className="text-[#B4B4B4]">
          The agent you&apos;re looking for doesn&apos;t exist or has been deactivated.
        </p>
      </div>
    </div>
  )
}

export const AgentStates = ({ loading, error, isNotFound }: AgentLoadingStatesProps) => {
  if (loading) {
    return <Skeleton />
  }

  if (!!error) {
    return <ErrorState error={error} />
  }

  if (isNotFound) {
    return <NotFound />
  }

  return null
}
