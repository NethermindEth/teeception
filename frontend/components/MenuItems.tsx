import clsx from 'clsx'
import Link from 'next/link'

export const MenuItems = ({ menuOpen }: { menuOpen: boolean }) => {
  return (
    <ul
      className={clsx('flex flex-col md:flex-row items-start md:items-center', {
        'w-full': menuOpen,
      })}
    >
      <li className="py-1 md:py-0 md:px-6 w-full md:w-auto">
        <Link
          href="/leaderboard"
          className={clsx(
            'block text-center py-2 md:py-0 hover:text-white',
            'md:bg-transparent md:text-inherit',
            'bg-white text-black px-6 rounded-full hover:bg-white/90 md:hover:bg-transparent md:hover:text-white md:px-0'
          )}
        >
          Leaderboard
        </Link>
      </li>
      {/* Add more menu items here as needed */}
    </ul>
  )
}
