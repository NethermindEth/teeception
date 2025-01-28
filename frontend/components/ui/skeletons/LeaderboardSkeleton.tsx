export const LeaderboardSkeleton = () => {
  return (
    <div className="text-xs flex flex-col gap-1 whitespace-nowrap overflow-x-auto">
      <div className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-10 p-4 rounded-lg mb-2 animate-pulse gap-5">
        <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
          <div className="pr-1 col-span-2 lg:col-span-1 h-3 bg-gray-700 rounded"></div>
          <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
          <div className="col-span-2 h-3 bg-gray-700 rounded"></div>
        </div>
        <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
        <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
        <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
      </div>

      {new Array(10).fill(1).map((_, index) => (
        <div
          className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-11 p-4 rounded-lg animate-pulse gap-1"
          key={`agent-skeleton-${index}`}
        >
          <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
            <div className="pr-1 col-span-2 lg:col-span-1 h-3 bg-gray-700 rounded"></div>
            <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
            <div className="col-span-2 h-3 bg-gray-700 rounded"></div>
          </div>
          <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
          <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
          <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4 h-3 bg-gray-700 rounded w-16"></div>
        </div>
      ))}
    </div>
  );
};
