import clsx from 'clsx'
import Link from 'next/link'

export const MenuItems = ({ menuOpen }: { menuOpen: boolean }) => {
  return (
    <ul
      className={clsx('flex flex-col xl:flex-row items-start xl:items-center', {
        'w-full': menuOpen,
      })}
    >
      <li className="py-1 xl:py-0 xl:px-6 w-full xl:w-auto">
        <Link
          href="/leaderboard"
          className={clsx(
            'block text-center py-2 xl:py-0 hover:text-white',
            'xl:bg-transparent xl:text-inherit',
            'bg-white text-black px-6 rounded-full hover:bg-white/90 xl:hover:bg-transparent xl:hover:text-white xl:px-0'
          )}
        >
          Leaderboard
        </Link>
      </li>
      {/* Add more menu items here as needed */}
    </ul>
  )
}
