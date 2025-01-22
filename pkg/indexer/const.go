package indexer

import starknetgoutils "github.com/NethermindEth/starknet.go/utils"

var (
	promptPaidSelector      = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
	agentRegisteredSelector = starknetgoutils.GetSelectorFromNameFelt("AgentRegistered")
	transferSelector        = starknetgoutils.GetSelectorFromNameFelt("Transfer")
	tokenAddedSelector      = starknetgoutils.GetSelectorFromNameFelt("TokenAdded")
	tokenRemovedSelector    = starknetgoutils.GetSelectorFromNameFelt("TokenRemoved")

	isAgentRegisteredSelector  = starknetgoutils.GetSelectorFromNameFelt("is_agent_registered")
	getSystemPromptUriSelector = starknetgoutils.GetSelectorFromNameFelt("get_system_prompt_uri")
	getPromptPriceSelector     = starknetgoutils.GetSelectorFromNameFelt("get_prompt_price")
	getTokenSelector           = starknetgoutils.GetSelectorFromNameFelt("get_token")
	getNameSelector            = starknetgoutils.GetSelectorFromNameFelt("get_name")

	balanceOfSelector = starknetgoutils.GetSelectorFromNameFelt("balanceOf")
)
