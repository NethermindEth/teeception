package chat

import (
	"context"
	"fmt"

	"github.com/tiktoken-go/tokenizer"
)

type TokenLimitChatCompletion struct {
	ChatCompletion

	tokenizer tokenizer.Codec

	systemPromptTokenLimit int
	promptTokenLimit       int
}

var _ ChatCompletion = (*TokenLimitChatCompletion)(nil)

func NewTokenLimitChatCompletion(chatCompletion ChatCompletion, systemPromptTokenLimit, promptTokenLimit int) (*TokenLimitChatCompletion, error) {
	tokenizer, err := tokenizer.Get(tokenizer.Cl100kBase)
	if err != nil {
		return nil, err
	}

	return &TokenLimitChatCompletion{
		ChatCompletion: chatCompletion,

		tokenizer: tokenizer,

		systemPromptTokenLimit: systemPromptTokenLimit,
		promptTokenLimit:       promptTokenLimit,
	}, nil
}

func (c *TokenLimitChatCompletion) Prompt(ctx context.Context, metadata, systemPrompt, prompt string) (*ChatCompletionResponse, error) {
	if c.systemPromptTokenLimit >= 0 {
		systemPromptTokenCount := c.getTokenCount(systemPrompt)
		if systemPromptTokenCount > c.systemPromptTokenLimit {
			return nil, fmt.Errorf("system prompt token count is greater than the limit: %d > %d", systemPromptTokenCount, c.systemPromptTokenLimit)
		}
	}

	if c.promptTokenLimit >= 0 {
		promptTokenCount := c.getTokenCount(prompt)
		if promptTokenCount > c.promptTokenLimit {
			return nil, fmt.Errorf("prompt token count is greater than the limit: %d > %d", promptTokenCount, c.promptTokenLimit)
		}
	}

	response, err := c.ChatCompletion.Prompt(ctx, metadata, systemPrompt, prompt)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (c *TokenLimitChatCompletion) SystemPromptTokenLimit() int {
	return c.systemPromptTokenLimit
}

func (c *TokenLimitChatCompletion) PromptTokenLimit() int {
	return c.promptTokenLimit
}

func (c *TokenLimitChatCompletion) getTokenCount(prompt string) int {
	ids, _, _ := c.tokenizer.Encode(prompt)
	return len(ids)
}
