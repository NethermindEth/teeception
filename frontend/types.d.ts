export type Prompt = {
  prompt: string
  is_success: boolean
  drained_to: string
}

interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  image: string
}
