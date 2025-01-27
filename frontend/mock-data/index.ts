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
