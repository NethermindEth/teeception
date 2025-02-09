import Link from 'next/link'

export const MenuItems = () => {
  return (
    <ul className="text-sm flex items-center justify-end md:justify-center">
      <li className="px-6">
        <Link href="/leaderboard" className="hover:text-white">
          Leaderboard
        </Link>
      </li>
    </ul>
  )
}
