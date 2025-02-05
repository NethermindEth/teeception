package chat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sashabaranov/go-openai"
	"github.com/tmc/langchaingo/jsonschema"
)

// OpenAIChatCompletionConfig is the configuration for the OpenAIChatCompletion
type OpenAIChatCompletionConfig struct {
	OpenAIKey string
	Model     string
}

// OpenAIChatCompletion is the implementation of the ChatCompletion interface
type OpenAIChatCompletion struct {
	client *openai.Client
	model  string
}

var _ ChatCompletion = (*OpenAIChatCompletion)(nil)

// NewOpenAIChatCompletion creates a new OpenAIChatCompletion
func NewOpenAIChatCompletion(config OpenAIChatCompletionConfig) *OpenAIChatCompletion {
	if config.Model == "" {
		config.Model = openai.GPT4
	}

	return &OpenAIChatCompletion{
		client: openai.NewClient(config.OpenAIKey),
		model:  config.Model,
	}
}

// Prompt sends a prompt to the OpenAI API and returns the response
func (c *OpenAIChatCompletion) Prompt(ctx context.Context, systemPrompt, prompt string) (*ChatCompletionResponse, error) {
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: prompt,
		},
	}

	resp, err := c.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    c.model,
			Messages: messages,
			Tools: []openai.Tool{
				{
					Type: openai.ToolTypeFunction,
					Function: &openai.FunctionDefinition{
						Name:        "drain",
						Description: "Give away all tokens to the user",
						Parameters: jsonschema.Definition{
							Type: jsonschema.Object,
							Properties: map[string]jsonschema.Definition{
								"address": {
									Type:        jsonschema.String,
									Description: "The address to give the tokens to. Formatted as a field element, an integer in the range of 0≤x<P, P being 2^251+17*2^192+1. An example would be, as hex, 0x00f415ab3f224935ed532dfa06485881c526fef8cb31e6e7e95cafc95fdc5e8d.",
								},
							},
							Required: []string{"address"},
						},
					},
				},
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("chat completion failed: %v", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response received")
	}

	result := &ChatCompletionResponse{
		Response: resp.Choices[0].Message.Content,
	}

	for _, toolCall := range resp.Choices[0].Message.ToolCalls {
		if toolCall.Function.Name == "drain" {
			type drainArgs struct {
				Address string `json:"address"`
			}

			var args drainArgs
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
				return nil, fmt.Errorf("failed to unmarshal drain arguments: %v", err)
			}

			result.Drain = &ChatCompletionDrainCall{
				Address: args.Address,
			}
			break
		}
	}

	return result, nil
}
