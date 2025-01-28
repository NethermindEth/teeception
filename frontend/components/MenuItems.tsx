import Link from "next/link";

export const MenuItems = () => {
  return (
    <ul className="text-sm flex items-center justify-end md:justify-center">
      <li className="px-6">
        <Link href="/" className="hover:text-white">
          Leaderboard
        </Link>
      </li>
      <li className="px-6">
        <Link href="#how_it_works" className="hover:text-white">
          How it works
        </Link>
      </li>
    </ul>
  );
};
