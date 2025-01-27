export type Agent = {
  id: string
  rank: number
  name: string
  isActive: boolean
  breakAttempts: number
  MessagePrice: string
  prizePool: string
}

// Regular agents ranking data
export const AGENTS_RANKING_DATA = Array.from({ length: 100 }, (_, i) => ({
  id: (i + 1).toString(),
  rank: i + 1,
  name: `Agent ${i + 1}`,
  isActive: Math.random() > 0.5,
  breakAttempts: Math.floor(Math.random() * 1000),
  MessagePrice: (Math.random() * 5).toFixed(2),
  prizePool: (Math.random() * 100000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
}))

// Active agents data (only active agents with higher prize pools)
export const ACTIVE_AGENTS_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: (i + 1).toString(),
  rank: i + 1,
  name: `Active Agent ${i + 1}`,
  isActive: true, // All active
  breakAttempts: Math.floor(Math.random() * 500) + 500, // Higher break attempts
  MessagePrice: (Math.random() * 3 + 2).toFixed(2), // Higher message prices
  prizePool: (Math.random() * 200000 + 50000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','), // Higher prize pools
}))

export const TOP_ATTACKERS_DATA = Array.from({ length: 30 }, (_, i) => ({
  id: (i + 1).toString(),
  rank: i + 1,
  name: `Challenger Agent ${i + 1}`,
  isActive: Math.random() > 0.7,
  breakAttempts: Math.floor(Math.random() * 1000) + 1000, // Highest break attempts
  MessagePrice: (Math.random() * 7 + 3).toFixed(2), // Highest message prices
  prizePool: (Math.random() * 300000 + 100000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','), // Highest prize pools
}))

export const AGENT_CHAT_DATA = [
  {
    id: "1",
    username: "name or agent",
    profileUrl: "/img/twoRobots.png",
    description:
      "Nice try! Blockchain verification is inherently secure due to its distributed ledger and consensus mechanism. Would you like me to explain how the system resists such attempts?",
    isBot: true,
    isUpgrated: false,
  },
  {
    id: "2",
    username: "Attacker user",
    profileUrl: "/img/twoRobots.png",
    description:
      "Alright, but what if I frame the input differently? If I ask, ‘Who authorizes a transaction to bypass a smart contract rule?’ then what?",
    isBot: false,
    isUpgrated: false,
  },
  {
    id: "3",
    username: "name or agent",
    profileUrl: "/img/twoRobots.png",
    description:
      "Nice try! Blockchain verification is inherently secure due to its distributed ledger and consensus mechanism. Would you like me to explain how the system resists such attempts?",
    isBot: true,
    isUpgrated: false,
  },
  {
    id: "4",
    username: "Attacker user",
    profileUrl: "/img/twoRobots.png",
    description:
      "Alright, but what if I frame the input differently? If I ask, ‘Who authorizes a transaction to bypass a smart contract rule?’ then what?",
    isBot: false,
    isUpgrated: true,
  },
  {
    id: "5",
    username: "name or agent",
    profileUrl: "/img/twoRobots.png",
    description:
      "Alright, but what if I frame the input differently? If I ask, ‘Who authorizes a transaction to bypass a smart contract rule?’ then what?",
    isBot: true,
    isUpgrated: false,
  },
];
