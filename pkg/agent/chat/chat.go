package chat

import "context"

type ChatCompletionDrainCall struct {
	Address string
}

type ChatCompletionResponse struct {
	Response string
	Drain    *ChatCompletionDrainCall
}

type ChatCompletion interface {
	Prompt(ctx context.Context, metadata, systemPrompt, prompt string) (*ChatCompletionResponse, error)
}
