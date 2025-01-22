import Popup from './Popup'
import { StarknetProvider } from './starknet-provider'

const App = () => {
  return (
    <StarknetProvider>
      <Popup />
    </StarknetProvider>
  )
}

export default App
